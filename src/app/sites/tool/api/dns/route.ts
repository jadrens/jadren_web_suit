import { NextRequest, NextResponse } from "next/server";
import dnsPromises from "dns/promises";
import type {
  SoaRecord,
  SrvRecord,
  MxRecord,
  NaptrRecord,
  CaaRecord,
} from "dns";

// Record types that Node.js dns module supports natively
// PTR is excluded — system DNS may not have the PTR record;
// we route PTR through DoH after converting the IP to .arpa format.
const NATIVE_TYPES = new Set([
  "A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "SRV", "NAPTR", "CAA",
]);

interface DnsRecord {
  name: string;
  type: string;
  TTL: number;
  data: string;
}

interface DnsSection {
  Answer?: DnsRecord[];
  Authority?: DnsRecord[];
  Additional?: DnsRecord[];
}

function formatTxt(values: string[][]): string[] {
  return values.map((chunks) => chunks.join(""));
}

function formatSoa(soa: SoaRecord): string {
  return `${soa.nsname} ${soa.hostmaster} ${soa.serial} ${soa.refresh} ${soa.retry} ${soa.expire} ${soa.minttl}`;
}

function formatSrv(records: SrvRecord[]): DnsRecord[] {
  return records.map((r) => ({
    name: r.name,
    type: "SRV",
    TTL: 0,
    data: `${r.priority} ${r.weight} ${r.port} ${r.name}`,
  }));
}

function formatMx(records: MxRecord[]): DnsRecord[] {
  return records.map((r) => ({
    name: r.exchange,
    type: "MX",
    TTL: 0,
    data: `${r.priority} ${r.exchange}`,
  }));
}

function formatNaptr(records: NaptrRecord[]): DnsRecord[] {
  return records.map((r) => ({
    name: r.replacement,
    type: "NAPTR",
    TTL: 0,
    data: `${r.order} ${r.preference} "${r.flags}" "${r.service}" "${r.regexp}" ${r.replacement}`,
  }));
}

/**
 * Convert an IPv4 or IPv6 address to its .arpa reverse-lookup domain.
 * IPv4: 203.0.113.1 → 1.113.0.203.in-addr.arpa
 * IPv6: 2001:db8::1  → 1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa
 */
function ipToArpa(ip: string): string {
  if (ip.includes(":")) {
    // IPv6: expand, reverse nibbles
    const expanded = (() => {
      const parts = ip.split("::");
      if (parts.length > 2) return ip; // invalid
      if (parts.length === 2) {
        const left = parts[0] ? parts[0].split(":") : [];
        const right = parts[1] ? parts[1].split(":") : [];
        const missing = 8 - (left.length + right.length);
        const middle = Array.from({ length: missing }, () => "0000");
        return [...left, ...middle, ...right]
          .map((g) => g.padStart(4, "0"))
          .join(":");
      }
      return ip
        .split(":")
        .map((g) => g.padStart(4, "0"))
        .join(":");
    })();
    const nibbles = expanded.replace(/:/g, "").split("").reverse().join(".");
    return `${nibbles}.ip6.arpa`;
  }

  // IPv4: reverse octets
  const octets = ip.split(".");
  if (octets.length !== 4) return ip; // not a valid IP, pass through
  return `${octets.reverse().join(".")}.in-addr.arpa`;
}

function formatCaa(records: CaaRecord[]): DnsRecord[] {
  return records.map((r) => {
    const parts: string[] = [];
    if (r.issue) parts.push(`issue "${r.issue}"`);
    if (r.issuewild) parts.push(`issuewild "${r.issuewild}"`);
    if (r.iodef) parts.push(`iodef "${r.iodef}"`);
    if (r.contactemail) parts.push(`contactemail "${r.contactemail}"`);
    if (r.contactphone) parts.push(`contactphone "${r.contactphone}"`);
    return {
      name: "",
      type: "CAA",
      TTL: 0,
      data: `${r.critical} ${parts.join(" ")}`,
    };
  });
}

async function resolveWithNative(
  hostname: string,
  rrtype: string
): Promise<DnsRecord[]> {
  // Most resolve functions don't return TTL, so we default to 0
  switch (rrtype) {
    case "A": {
      const records = await dnsPromises.resolve4(hostname, { ttl: true });
      return records.map((r) => ({
        name: hostname,
        type: "A",
        TTL: r.ttl,
        data: r.address,
      }));
    }
    case "AAAA": {
      const records = await dnsPromises.resolve6(hostname, { ttl: true });
      return records.map((r) => ({
        name: hostname,
        type: "AAAA",
        TTL: r.ttl,
        data: r.address,
      }));
    }
    case "CNAME": {
      const records = await dnsPromises.resolveCname(hostname);
      return records.map((r) => ({
        name: hostname,
        type: "CNAME",
        TTL: 0,
        data: r,
      }));
    }
    case "MX": {
      const records = await dnsPromises.resolveMx(hostname);
      return formatMx(records);
    }
    case "TXT": {
      const records = await dnsPromises.resolveTxt(hostname);
      return formatTxt(records).map((data) => ({
        name: hostname,
        type: "TXT",
        TTL: 0,
        data,
      }));
    }
    case "NS": {
      const records = await dnsPromises.resolveNs(hostname);
      return records.map((r) => ({
        name: hostname,
        type: "NS",
        TTL: 0,
        data: r,
      }));
    }
    case "SOA": {
      const record = await dnsPromises.resolveSoa(hostname);
      return [
        {
          name: hostname,
          type: "SOA",
          TTL: 0,
          data: formatSoa(record),
        },
      ];
    }
    case "SRV": {
      const records = await dnsPromises.resolveSrv(hostname);
      return formatSrv(records);
    }
    case "NAPTR": {
      const records = await dnsPromises.resolveNaptr(hostname);
      return formatNaptr(records);
    }
    case "CAA": {
      const records = await dnsPromises.resolveCaa(hostname);
      return formatCaa(records);
    }
    default:
      return [];
  }
}

async function resolveWithDoH(
  hostname: string,
  rrtype: string
): Promise<DnsSection> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${rrtype}`;
  const res = await fetch(url, {
    headers: { Accept: "application/dns-json" },
  });
  if (!res.ok) {
    throw new Error(`DNS-over-HTTPS failed: ${res.status}`);
  }
  const data = await res.json();

  // Normalize section records — strip trailing dot from PTR data
  const normalize = (records: Array<{ name: string; type: number; TTL: number; data: string }> | undefined): DnsRecord[] =>
    (records || []).map((r) => ({
      name: r.name,
      type: rrtype,
      TTL: r.TTL,
      data: rrtype === "PTR" && r.data.endsWith(".") ? r.data.slice(0, -1) : r.data,
    }));

  return {
    Answer: normalize(data.Answer),
    Authority: normalize(data.Authority),
    Additional: normalize(data.Additional),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  const rrtype = searchParams.get("type")?.toUpperCase() || "A";

  if (!domain) {
    return NextResponse.json(
      { error: "Missing domain parameter" },
      { status: 400 }
    );
  }

  // Validate record type
  const allowedTypes = [
    "A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "SRV",
    "PTR", "NAPTR", "CAA", "DS", "DNSKEY", "TLSA", "SSHFP",
    "HTTPS", "SVCB",
  ];
  if (!allowedTypes.includes(rrtype)) {
    return NextResponse.json(
      { error: `Unsupported record type: ${rrtype}` },
      { status: 400 }
    );
  }

  try {
    if (NATIVE_TYPES.has(rrtype)) {
      const records = await resolveWithNative(domain, rrtype);
      return NextResponse.json({
        domain,
        type: rrtype,
        Answer: records,
        Authority: [],
        Additional: [],
      });
    }

    // PTR needs the IP converted to .arpa format for DoH lookup
    const dohName = rrtype === "PTR" ? ipToArpa(domain) : domain;
    const result = await resolveWithDoH(dohName, rrtype);
    return NextResponse.json({
      domain,
      type: rrtype,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DNS lookup failed";

    // ENODATA / ENOTFOUND — domain exists but no records of this type
    if (
      (err as NodeJS.ErrnoException).code === "ENODATA" ||
      (err as NodeJS.ErrnoException).code === "ENOTFOUND"
    ) {
      return NextResponse.json({
        domain,
        type: rrtype,
        Answer: [],
        Authority: [],
        Additional: [],
        comment: message,
      });
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
