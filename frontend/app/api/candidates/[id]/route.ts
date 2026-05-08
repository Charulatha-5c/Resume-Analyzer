import { NextResponse } from "next/server";
import { fetchCandidateById } from "@/lib/nocodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const candidate = await fetchCandidateById(id);
    if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ candidate });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch candidate", detail: (e as Error).message },
      { status: 500 },
    );
  }
}
