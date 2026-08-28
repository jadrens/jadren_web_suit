import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://hkns.koi.ci";

// Domain must match *.track.rayne.cn
const TRACK_DOMAIN_RE = /^[a-z0-9]+[a-z0-9\-]*[a-z0-9]\.track\.rayne\.cn$/i;

interface QueryItem {
  id?: number;
  domain: string;
  query_type: string;
  client_ip: string;
  country_code: string;
  city: string;
  edns_subnet?: string;
  edns_country_code?: string;
  nsid?: string;
  geo_cached?: boolean;
  created_at: string;
}

interface QueryListResponse {
  total: number;
  items: QueryItem[];
}

async function fetchQueries(
  domain: string,
  token: string
): Promise<QueryItem[]> {
  const url = `${API_BASE}/api/queries?domain=${encodeURIComponent(domain)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`API error ${res.status}: ${err.error || res.statusText}`);
  }

  const data: QueryListResponse = await res.json();
  return data.items || [];
}

export async function POST(request: NextRequest) {
  try {
    const token = process.env.DNS_MANAGER_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Server not configured: missing DNS_MANAGER_TOKEN" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.domains)) {
      return NextResponse.json(
        { error: 'Missing "domains" array in request body' },
        { status: 400 }
      );
    }

    const { domains } = body as { domains: string[] };

    // Strict domain validation — only *.track.rayne.cn
    for (const domain of domains) {
      if (typeof domain !== "string" || !TRACK_DOMAIN_RE.test(domain)) {
        return NextResponse.json(
          {
            error: `Invalid domain "${domain}". Only *.track.rayne.cn subdomains (alphanumeric + hyphens) are allowed.`,
          },
          { status: 403 }
        );
      }
    }

    if (domains.length === 0) {
      return NextResponse.json({ results: [] });
    }

    if (domains.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 domains per request" },
        { status: 400 }
      );
    }

    // Fetch queries for all domains in parallel
    const results = await Promise.all(
      domains.map(async (domain) => {
        try {
          const items = await fetchQueries(domain, token);
          return {
            domain,
            found: items.length > 0,
            queries: items.map((q) => ({
              id: q.id,
              query_type: q.query_type,
              client_ip: q.client_ip,
              country_code: q.country_code || "unknown",
              city: q.city || "",
              edns_subnet: q.edns_subnet || null,
              edns_country_code: q.edns_country_code || null,
              nsid: q.nsid || null,
              created_at: q.created_at,
            })),
          };
        } catch {
          return { domain, found: false, queries: [] };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
