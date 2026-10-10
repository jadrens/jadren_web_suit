import dnsPromises from "dns/promises";
import type { CaaRecord, MxRecord, NaptrRecord, SoaRecord, SrvRecord } from "dns";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { JsonObject } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import type { DictionaryService, ToolsService } from "@gen/jadren/v1/tools_pb";
import { requestIp } from "@lib/auth/email-send-rate-limit";
import {
  lookupChineseDictionaryEntry,
  lookupDictionaryEntry,
  suggestChineseDictionaryEntries,
  suggestDictionaryEntries,
} from "@lib/dictionary/server";
import type { Locale } from "@lib/publishing/posts";
import { getAllTags, getSearchIndex } from "@lib/publishing/search-index";
import { consumeTtsRequest } from "@lib/tts/rate-limit";
import { apiFailure } from "../errors";
import { headersOf } from "../context";

// --- Dictionary ------------------------------------------------------------

const DIRECTIONS = ["auto", "en-zh", "zh-en"];
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isReverse(direction: string, text: string) {
  return direction === "zh-en" || (direction === "auto" && /\p{Script=Han}/u.test(text));
}

// Dictionary documents are plain JSON read from SQLite, so they round-trip through Struct.
function asJson<T>(value: T) {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

export const dictionaryService: ServiceImpl<typeof DictionaryService> = {
  async lookup(request, context) {
    const word = request.word.trim();
    const direction = request.direction || "auto";
    if (!word || word.length > 120 || CONTROL_CHARACTERS.test(word)) {
      throw apiFailure("word must contain 1 to 120 printable characters", 400, "invalid_word");
    }
    if (!DIRECTIONS.includes(direction)) {
      throw apiFailure("direction must be auto, en-zh, or zh-en", 400, "invalid_direction");
    }
    let result;
    try {
      result = isReverse(direction, word) ? lookupChineseDictionaryEntry(word) : lookupDictionaryEntry(word);
    } catch (cause) {
      console.error("Dictionary lookup failed", cause);
      throw apiFailure("Dictionary service is unavailable", 503, "dictionary_unavailable");
    }
    if (!result) throw apiFailure("Dictionary entry not found", 404, "word_not_found");
    context.responseHeader.set("Cache-Control", "public, max-age=300, s-maxage=86400");
    return { result: asJson(result) };
  },

  async search(request, context) {
    const query = request.query.trim();
    const direction = request.direction || "auto";
    const limit = request.limit || 20;
    if (!query || query.length > 120 || CONTROL_CHARACTERS.test(query)) {
      throw apiFailure("q must contain 1 to 120 printable characters", 400, "invalid_query");
    }
    if (limit < 1 || limit > 50) {
      throw apiFailure("limit must be an integer from 1 to 50", 400, "invalid_limit");
    }
    if (!DIRECTIONS.includes(direction)) {
      throw apiFailure("direction must be auto, en-zh, or zh-en", 400, "invalid_direction");
    }
    try {
      const results = isReverse(direction, query)
        ? suggestChineseDictionaryEntries(query, limit)
        : suggestDictionaryEntries(query, limit);
      context.responseHeader.set("Cache-Control", "public, max-age=60, s-maxage=3600");
      return { query, count: results.length, results: results.map(asJson) };
    } catch (cause) {
      console.error("Dictionary search failed", cause);
      throw apiFailure("Dictionary service is unavailable", 503, "dictionary_unavailable");
    }
  },
};

// --- DNS lookup ------------------------------------------------------------

interface DnsRecord { name: string; type: string; ttl: number; data: string }
interface DnsSection { answer: DnsRecord[]; authority: DnsRecord[]; additional: DnsRecord[] }

// Record types Node's resolver handles natively; the rest go through DNS-over-HTTPS.
const NATIVE_TYPES = new Set(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "SRV", "NAPTR", "CAA"]);
const ALLOWED_TYPES = [
  "A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "SRV",
  "PTR", "NAPTR", "CAA", "DS", "DNSKEY", "TLSA", "SSHFP",
  "HTTPS", "SVCB",
];

const record = (name: string, type: string, data: string, ttl = 0): DnsRecord => ({ name, type, ttl, data });

const formatSoa = (soa: SoaRecord) =>
  `${soa.nsname} ${soa.hostmaster} ${soa.serial} ${soa.refresh} ${soa.retry} ${soa.expire} ${soa.minttl}`;

const formatSrv = (records: SrvRecord[]) =>
  records.map((r) => record(r.name, "SRV", `${r.priority} ${r.weight} ${r.port} ${r.name}`));

const formatMx = (records: MxRecord[]) =>
  records.map((r) => record(r.exchange, "MX", `${r.priority} ${r.exchange}`));

const formatNaptr = (records: NaptrRecord[]) =>
  records.map((r) =>
    record(r.replacement, "NAPTR", `${r.order} ${r.preference} "${r.flags}" "${r.service}" "${r.regexp}" ${r.replacement}`)
  );

function formatCaa(records: CaaRecord[]) {
  return records.map((r) => {
    const parts: string[] = [];
    if (r.issue) parts.push(`issue "${r.issue}"`);
    if (r.issuewild) parts.push(`issuewild "${r.issuewild}"`);
    if (r.iodef) parts.push(`iodef "${r.iodef}"`);
    if (r.contactemail) parts.push(`contactemail "${r.contactemail}"`);
    if (r.contactphone) parts.push(`contactphone "${r.contactphone}"`);
    return record("", "CAA", `${r.critical} ${parts.join(" ")}`);
  });
}

/**
 * Convert an IPv4 or IPv6 address to its .arpa reverse-lookup domain.
 * IPv4: 203.0.113.1 → 1.113.0.203.in-addr.arpa
 * IPv6: 2001:db8::1  → 1.0.0.0.…8.b.d.0.1.0.0.2.ip6.arpa
 */
function ipToArpa(ip: string): string {
  if (ip.includes(":")) {
    const expanded = (() => {
      const parts = ip.split("::");
      if (parts.length > 2) return ip;
      if (parts.length === 2) {
        const left = parts[0] ? parts[0].split(":") : [];
        const right = parts[1] ? parts[1].split(":") : [];
        const middle = Array.from({ length: 8 - (left.length + right.length) }, () => "0000");
        return [...left, ...middle, ...right].map((g) => g.padStart(4, "0")).join(":");
      }
      return ip.split(":").map((g) => g.padStart(4, "0")).join(":");
    })();
    const nibbles = expanded.replace(/:/g, "").split("").reverse().join(".");
    return `${nibbles}.ip6.arpa`;
  }
  const octets = ip.split(".");
  if (octets.length !== 4) return ip;
  return `${octets.reverse().join(".")}.in-addr.arpa`;
}

async function resolveWithNative(hostname: string, rrtype: string): Promise<DnsRecord[]> {
  switch (rrtype) {
    case "A":
      return (await dnsPromises.resolve4(hostname, { ttl: true })).map((r) => record(hostname, "A", r.address, r.ttl));
    case "AAAA":
      return (await dnsPromises.resolve6(hostname, { ttl: true })).map((r) => record(hostname, "AAAA", r.address, r.ttl));
    case "CNAME":
      return (await dnsPromises.resolveCname(hostname)).map((r) => record(hostname, "CNAME", r));
    case "MX":
      return formatMx(await dnsPromises.resolveMx(hostname));
    case "TXT":
      return (await dnsPromises.resolveTxt(hostname)).map((chunks) => record(hostname, "TXT", chunks.join("")));
    case "NS":
      return (await dnsPromises.resolveNs(hostname)).map((r) => record(hostname, "NS", r));
    case "SOA":
      return [record(hostname, "SOA", formatSoa(await dnsPromises.resolveSoa(hostname)))];
    case "SRV":
      return formatSrv(await dnsPromises.resolveSrv(hostname));
    case "NAPTR":
      return formatNaptr(await dnsPromises.resolveNaptr(hostname));
    case "CAA":
      return formatCaa(await dnsPromises.resolveCaa(hostname));
    default:
      return [];
  }
}

async function resolveWithDoH(hostname: string, rrtype: string): Promise<DnsSection> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${rrtype}`,
    { headers: { Accept: "application/dns-json" } }
  );
  if (!res.ok) throw new Error(`DNS-over-HTTPS failed: ${res.status}`);
  const data = await res.json();

  const normalize = (records: Array<{ name: string; type: number; TTL: number; data: string }> | undefined) =>
    (records || []).map((r) =>
      record(r.name, rrtype, rrtype === "PTR" && r.data.endsWith(".") ? r.data.slice(0, -1) : r.data, r.TTL)
    );
  return { answer: normalize(data.Answer), authority: normalize(data.Authority), additional: normalize(data.Additional) };
}

// --- DNS leak test ---------------------------------------------------------

const LEAK_API_BASE = "https://hzns.koi.ci";
const TRACK_DOMAIN_RE = /^[a-z0-9]+[a-z0-9-]*[a-z0-9]\.track\.rayne\.cn$/i;

interface LeakQueryItem {
  id?: number;
  query_type: string;
  client_ip: string;
  country_code: string;
  city: string;
  edns_subnet?: string;
  edns_country_code?: string;
  nsid?: string;
  created_at: string;
}

async function fetchLeakQueries(domain: string, token: string): Promise<LeakQueryItem[]> {
  const res = await fetch(`${LEAK_API_BASE}/api/queries?domain=${encodeURIComponent(domain)}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`API error ${res.status}: ${err.error || res.statusText}`);
  }
  const data: { items?: LeakQueryItem[] } = await res.json();
  return data.items || [];
}

// --- IP geolocation --------------------------------------------------------

// Pro-only key (higher rate limit), used server-side so it is not exposed to clients.
const IP_API_PRO_KEY = "O40YckkbgRCMWLu";
const IP_API_FIELDS = "66846719";

// --- Pronunciation ---------------------------------------------------------

const execFileAsync = promisify(execFile);
const MAX_AUDIO_BYTES = 2_000_000;

function isWav(audio: Buffer) {
  return audio.length > 44 && audio.length <= MAX_AUDIO_BYTES &&
    audio.toString("ascii", 0, 4) === "RIFF" && audio.toString("ascii", 8, 12) === "WAVE";
}

async function generateWav(word: string): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "dictionary-tts-"));
  try {
    const output = join(directory, "speech.wav");
    try {
      await execFileAsync("pico2wave", ["-l", "en-US", "-w", output, word], { timeout: 8_000 });
      const wav = await readFile(output);
      if (isWav(wav)) return wav;
    } catch {
      // eSpeak is the local fallback when Pico is unavailable.
    }
    for (const command of ["espeak-ng", "espeak"]) {
      try {
        const { stdout } = await execFileAsync(command, ["-v", "en-us", "-s", "155", "--stdout", word], {
          encoding: "buffer", maxBuffer: MAX_AUDIO_BYTES, timeout: 8_000,
        });
        const wav = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
        if (isWav(wav)) return wav;
      } catch { /* Try the next installed engine. */ }
    }
    throw new Error("No local TTS engine is available");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

// --- Service ---------------------------------------------------------------

export const toolsService: ServiceImpl<typeof ToolsService> = {
  async getClientIp(_request, context) {
    // The real client address comes from the reverse proxy headers.
    const forwarded = context.requestHeader.get("x-forwarded-for");
    const realIp = context.requestHeader.get("x-real-ip");
    return {
      ip: forwarded?.split(",")[0]?.trim() || realIp || "unknown",
      xForwardedFor: forwarded || undefined,
      xRealIp: realIp || undefined,
    };
  },

  async lookupIpGeo(request) {
    const { ip } = request;
    if (!ip) throw apiFailure('Missing "ip" query parameter', 400, "missing_ip");

    // Try the pro API first, then fall back to the free tier.
    const urls = [
      `http://pro.ip-api.com/json/${encodeURIComponent(ip)}?fields=${IP_API_FIELDS}&key=${IP_API_PRO_KEY}`,
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${IP_API_FIELDS}`,
    ];
    let lastError: string | null = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
          lastError = `Upstream HTTP ${res.status}`;
          continue;
        }
        const data = await res.json();
        if (data.status === "fail") {
          lastError = data.message || data.country || "Lookup failed";
          continue;
        }
        return { data: asJson(data) };
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Unknown error";
      }
    }
    throw apiFailure(lastError || "All upstream requests failed", 502, "upstream_failed");
  },

  async resolveDns(request) {
    const domain = request.domain;
    const rrtype = request.type.toUpperCase() || "A";
    if (!domain) throw apiFailure("Missing domain parameter", 400, "missing_domain");
    if (!ALLOWED_TYPES.includes(rrtype)) {
      throw apiFailure(`Unsupported record type: ${rrtype}`, 400, "unsupported_type");
    }

    try {
      if (NATIVE_TYPES.has(rrtype)) {
        return { domain, type: rrtype, answer: await resolveWithNative(domain, rrtype), authority: [], additional: [] };
      }
      // PTR needs the IP converted to .arpa format for the DoH lookup.
      const section = await resolveWithDoH(rrtype === "PTR" ? ipToArpa(domain) : domain, rrtype);
      return { domain, type: rrtype, ...section };
    } catch (err) {
      const message = err instanceof Error ? err.message : "DNS lookup failed";
      // ENODATA / ENOTFOUND: the name exists but has no records of this type.
      const errno = (err as NodeJS.ErrnoException).code;
      if (errno === "ENODATA" || errno === "ENOTFOUND") {
        return { domain, type: rrtype, answer: [], authority: [], additional: [], comment: message };
      }
      throw apiFailure(message, 500, "dns_lookup_failed");
    }
  },

  async checkDnsLeak(request) {
    const token = process.env.DNS_MANAGER_TOKEN;
    if (!token) throw apiFailure("Server not configured: missing DNS_MANAGER_TOKEN", 500, "not_configured");

    const { domains } = request;
    // Strict domain validation: only *.track.rayne.cn.
    for (const domain of domains) {
      if (!TRACK_DOMAIN_RE.test(domain)) {
        throw apiFailure(
          `Invalid domain "${domain}". Only *.track.rayne.cn subdomains (alphanumeric + hyphens) are allowed.`,
          403,
          "invalid_domain"
        );
      }
    }
    if (domains.length > 20) throw apiFailure("Maximum 20 domains per request", 400, "too_many_domains");

    const results = await Promise.all(
      domains.map(async (domain) => {
        try {
          const items = await fetchLeakQueries(domain, token);
          return {
            domain,
            found: items.length > 0,
            queries: items.map((q) => ({
              id: q.id === undefined ? undefined : BigInt(q.id),
              queryType: q.query_type,
              clientIp: q.client_ip,
              countryCode: q.country_code || "unknown",
              city: q.city || "",
              ednsSubnet: q.edns_subnet || undefined,
              ednsCountryCode: q.edns_country_code || undefined,
              nsid: q.nsid || undefined,
              createdAt: q.created_at,
            })),
          };
        } catch {
          return { domain, found: false, queries: [] };
        }
      })
    );
    return { results };
  },

  async synthesizePronunciation(request, context) {
    const word = request.word.trim().replace(/\s+/g, " ");
    if (!/^[A-Za-z][A-Za-z '-]{0,63}$/.test(word)) throw apiFailure("invalid_word", 400, "invalid_word");
    if (!consumeTtsRequest(requestIp(headersOf(context)))) {
      throw apiFailure("rate_limited", 429, "rate_limited");
    }
    try {
      const wav = await generateWav(word);
      context.responseHeader.set("Cache-Control", "private, no-store");
      return { audio: new Uint8Array(wav), contentType: "audio/wav" };
    } catch (error) {
      console.error("Unable to generate pronunciation", error);
      throw apiFailure("tts_unavailable", 503, "tts_unavailable");
    }
  },

  async searchPosts(request) {
    const query = request.query;
    const locale = (request.locale || "en") as Locale;
    const tags = await getAllTags(locale);
    if (!query.trim()) return { results: [], tags };

    const index = await getSearchIndex(locale);
    const keyword = query.toLowerCase();
    const results = index.postsByDate.filter(
      (post) =>
        post.title.toLowerCase().includes(keyword) ||
        post.tags.some((tag) => tag.toLowerCase().includes(keyword))
    );
    return { results: results.map(asJson), tags };
  },
};
