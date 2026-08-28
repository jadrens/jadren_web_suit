import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // 从反向代理头获取真实客户端 IP
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwarded?.split(",")[0]?.trim() || realIp || "unknown";

  return NextResponse.json({
    ip: clientIp,
    headers: {
      "x-forwarded-for": forwarded || null,
      "x-real-ip": realIp || null,
    },
  });
}
