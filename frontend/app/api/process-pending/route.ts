import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_URL not configured in .env.local" },
      { status: 500 },
    );
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `n8n returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ status: "started" });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not reach n8n webhook: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
