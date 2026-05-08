import type { Candidate, ParsedResume } from "./types";

const BASE_URL = process.env.NOCODB_BASE_URL!;
const TOKEN = process.env.NOCODB_TOKEN!;
const BASE_ID = process.env.NOCODB_BASE_ID!;
const TABLE_ID = process.env.NOCODB_CANDIDATES_TABLE_ID!;
const VIEW_ID = process.env.NOCODB_CANDIDATES_VIEW_ID!;

if (!BASE_URL || !TOKEN || !BASE_ID || !TABLE_ID) {
  console.warn("[nocodb] Missing required env vars. Check .env.local.");
}

const headers = { "xc-token": TOKEN };

function safeParseResume(raw: unknown): ParsedResume {
  if (!raw) return {};
  if (typeof raw === "object") return raw as ParsedResume;
  try {
    const s = String(raw).trim();
    if (!s) return {};
    return JSON.parse(s) as ParsedResume;
  } catch {
    return { error: "parse_failed", raw_excerpt: String(raw).slice(0, 200) };
  }
}

function rowToCandidate(r: Record<string, unknown>): Candidate {
  const id = String((r.Id ?? r.id) as string);
  const first = (r["first name"] as string) ?? "";
  const last = (r["last name"] as string) ?? "";
  const name = `${first} ${last}`.trim() || id;
  const score = Number(r["LLM score"] ?? 0);
  return {
    candidate_id: id,
    name,
    email: (r.email as string) ?? null,
    phone: (r["phone number"] as string) ?? null,
    department: (r.department as string) ?? null,
    position: (r.position as string) ?? null,
    cover_letter: (r["cover letter"] as string) ?? null,
    cv_drive_link: (r["cv drive link"] as string) ?? null,
    llm_score: Number.isFinite(score) ? score : 0,
    reason: (r.Reason as string) ?? "",
    parsed_resume: safeParseResume(r["extracted resume"]),
    created_at: (r.CreatedAt as string) ?? null,
    updated_at: (r.UpdatedAt as string) ?? null,
  };
}

/** Fetch ALL scored candidates across all pages (server-side filter for LLM score > 0). */
export async function fetchScoredCandidates(): Promise<Candidate[]> {
  const where = encodeURIComponent("(LLM score,gt,0)");
  const all: Record<string, unknown>[] = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const url = `${BASE_URL}/api/v1/db/data/noco/${BASE_ID}/${TABLE_ID}/views/${VIEW_ID}?limit=${pageSize}&offset=${offset}&where=${where}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      throw new Error(`NocoDB fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as {
      list?: Record<string, unknown>[];
      pageInfo?: { isLastPage?: boolean };
    };
    const rows = data.list ?? [];
    all.push(...rows);
    if (rows.length < pageSize || data.pageInfo?.isLastPage) break;
    offset += pageSize;
  }
  return all
    .map(rowToCandidate)
    .filter(
      (c) =>
        c.llm_score > 0 &&
        c.reason &&
        c.parsed_resume &&
        Object.keys(c.parsed_resume).length > 0 &&
        !c.parsed_resume.error,
    );
}

export async function fetchCandidateById(id: string): Promise<Candidate | null> {
  const url = `${BASE_URL}/api/v1/db/data/noco/${BASE_ID}/${TABLE_ID}/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return null;
  const row = (await res.json()) as Record<string, unknown>;
  return rowToCandidate(row);
}
