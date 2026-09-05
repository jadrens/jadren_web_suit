import { NextRequest, NextResponse } from "next/server";

// Pro-only key (higher rate limit), used server-side so not exposed to clients
const PRO_KEY = "O40YckkbgRCMWLu";
const FIELDS = "66846719";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get("ip");

  if (!ip || typeof ip !== "string") {
    return NextResponse.json(
      { error: 'Missing "ip" query parameter' },
      { status: 400 }
    );
  }

  // Try pro API first, fall back to free tier
  const urls = [
    `http://pro.ip-api.com/json/${encodeURIComponent(ip)}?fields=${FIELDS}&key=${PRO_KEY}`,
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${FIELDS}`,
  ];

  let lastError: string | null = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        lastError = `Upstream HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();

      if (data.status === "fail") {
        lastError = data.message || data.country || "Lookup failed";
        continue;
      }

      return NextResponse.json(data);
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      // continue to fallback
    }
  }

  return NextResponse.json(
    { error: lastError || "All upstream requests failed" },
    { status: 502 }
  );
}
