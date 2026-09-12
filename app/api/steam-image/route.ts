import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing url", { status: 400 });
  }

  // Only allow Steam CDN URLs — prevents SSRF
  const allowed = [
    "https://community.akamai.steamstatic.com/",
    "https://community.cloudflare.steamstatic.com/",
    "https://steamcommunity-a.akamaihd.net/",
  ];

  const isAllowed = allowed.some((prefix) => targetUrl.startsWith(prefix));
  if (!isAllowed) {
    return new NextResponse("URL not allowed", { status: 403 });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        Referer: "https://steamcommunity.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Encoding": "identity",
        Accept: "image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        "[steam-image] upstream error:",
        res.status,
        targetUrl.slice(0, 80)
      );
      return new NextResponse("Upstream error", { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/png";

    console.log("[steam-image] ok:", {
      url: targetUrl.slice(-40),
      status: res.status,
      contentType,
      bytes: buffer.byteLength,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[steam-image] proxy error:", err);
    return new NextResponse("Proxy failed", { status: 502 });
  }
}