import { NextResponse } from "next/server";

export const revalidate = 600; // cache 10 min

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const limit = searchParams.get("limit") ?? "100";
  const page = searchParams.get("page") ?? "0";

  const url = new URL("https://take.skin/api/public/v1/skins");
  url.searchParams.set("limit", limit);
  url.searchParams.set("page", page);
  if (search) url.searchParams.set("search", search);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("take.skin error:", res.status, text.slice(0, 300));
      return NextResponse.json(
        { error: "take.skin failed", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Proxy crashed:", err);
    return NextResponse.json(
      { error: "Proxy crashed", message: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}