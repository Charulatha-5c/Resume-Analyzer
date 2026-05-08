import { NextResponse } from "next/server";
import { fetchScoredCandidates } from "@/lib/nocodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const candidates = await fetchScoredCandidates();
    return NextResponse.json({ candidates });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch candidates", detail: (e as Error).message },
      { status: 500 },
    );
  }
}
