import { NextRequest, NextResponse } from "next/server";

const HOST_TO_SITE: Record<string, "main" | "blog" | "tool"> = {
  "main.localhost": "main",
  "jadren.debug": "main",
  "jadren.me": "main",
  "example.com": "main",
  "blog.localhost": "blog",
  "blog.jadren.debug": "blog",
  "blog.jadren.me": "blog",
  "blog.com": "blog",
  "tool.localhost": "tool",
  "tool.jadren.debug": "tool",
  "tool.jadren.me": "tool",
  "tool.com": "tool",
};

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  const site = host ? HOST_TO_SITE[host] : undefined;

  if (!site) {
    return new NextResponse("Unknown host", { status: 404 });
  }

  url.pathname = `/sites/${site}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/|sites/|shared/).*)"],
};
