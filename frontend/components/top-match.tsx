"use client";

import Link from "next/link";
import type { Candidate } from "@/lib/types";
import { ScoreBadge, ScoreBar } from "./score-badge";
import { ArrowRightIcon } from "./icons";

export function TopMatch({ candidates }: { candidates: Candidate[] }) {
  if (candidates.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-lg font-semibold text-slate-900">Top Match</h2>
        <span className="text-sm text-slate-500">— best fits for current filter</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {candidates.map((c, i) => (
          <Link
            key={c.candidate_id}
            href={`/candidate/${c.candidate_id}`}
            className="card-hover p-4 group"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">#{i + 1}</span>
              <ScoreBadge score={c.llm_score} size="md" />
            </div>
            <div className="mt-2 font-semibold text-slate-900 truncate">{c.name}</div>
            <div className="text-xs text-slate-500 truncate">{c.position}</div>
            <div className="mt-3"><ScoreBar score={c.llm_score} /></div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                {c.parsed_resume.total_experience_years ?? 0} yrs ·{" "}
                {c.parsed_resume.skills?.length ?? 0} skills
              </span>
              <span className="text-slate-500 group-hover:translate-x-0.5 transition-transform">
                <ArrowRightIcon size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
