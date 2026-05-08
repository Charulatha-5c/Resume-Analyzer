import type { Candidate } from "./types";

function candidateKey(c: Candidate): string {
  if (c.email) return `email:${c.email.toLowerCase().trim()}`;
  if (c.phone) return `np:${c.name.toLowerCase().trim()}|${c.phone.trim()}`;
  return `id:${c.candidate_id}`;
}

/** Collapse repeated submissions from the same person, keeping their highest-scored entry. */
export function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const map = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = candidateKey(c);
    const existing = map.get(key);
    if (!existing || c.llm_score > existing.llm_score) {
      map.set(key, c);
    }
  }
  return Array.from(map.values());
}

/** Dedupe by person, then stable sort: score desc, then experience desc, then skills desc, then updated_at desc. */
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return dedupeCandidates(candidates).sort((a, b) => {
    if (b.llm_score !== a.llm_score) return b.llm_score - a.llm_score;
    const aExp = a.parsed_resume.total_experience_years ?? 0;
    const bExp = b.parsed_resume.total_experience_years ?? 0;
    if (bExp !== aExp) return bExp - aExp;
    const aSkills = a.parsed_resume.skills?.length ?? 0;
    const bSkills = b.parsed_resume.skills?.length ?? 0;
    if (bSkills !== aSkills) return bSkills - aSkills;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  });
}

export type Filters = {
  position?: string | null;
  department?: string | null;
  dateFrom?: string | null; // ISO date
  dateTo?: string | null; // ISO date
  search?: string | null;
};

export function applyFilters(candidates: Candidate[], f: Filters): Candidate[] {
  return candidates.filter((c) => {
    if (f.position && c.position !== f.position) return false;
    if (f.department && c.department !== f.department) return false;
    if (f.dateFrom && c.created_at && c.created_at < f.dateFrom) return false;
    if (f.dateTo && c.created_at && c.created_at > f.dateTo + "T23:59:59") return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${c.name} ${c.email ?? ""} ${c.position ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function uniquePositions(candidates: Candidate[]): string[] {
  return Array.from(new Set(candidates.map((c) => c.position).filter(Boolean) as string[])).sort();
}
export function uniqueDepartments(candidates: Candidate[]): string[] {
  return Array.from(new Set(candidates.map((c) => c.department).filter(Boolean) as string[])).sort();
}
