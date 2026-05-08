"use client";

import Link from "next/link";
import type { Candidate } from "@/lib/types";
import { ScoreBadge } from "./score-badge";
import { ArrowRightIcon, SearchIcon } from "./icons";

export function CandidateTable({ candidates }: { candidates: Candidate[] }) {
  if (candidates.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="flex justify-center mb-3 text-slate-400">
          <SearchIcon size={36} />
        </div>
        <div className="font-medium text-slate-700">No candidates match these filters</div>
        <div className="text-sm text-slate-500 mt-1">Try clearing some filters above.</div>
      </div>
    );
  }
  return (
    <div className="card-accent overflow-hidden">
      <table className="w-full">
        <thead className="bg-blue-50 border-b border-blue-100">
          <tr className="text-left text-xs uppercase tracking-wider text-blue-700 font-semibold">
            <th className="px-4 py-3">Candidate</th>
            <th className="px-4 py-3 hidden md:table-cell">Department</th>
            <th className="px-4 py-3">Position applied</th>
            <th className="px-4 py-3 text-center">Score</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {candidates.map((c) => (
            <tr
              key={c.candidate_id}
              className="hover:bg-brand-50/30 transition-colors group"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-full text-white text-xs font-semibold shadow-sm flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${avatarColor(c.name)} 0%, ${avatarColor(c.name, 0.85)} 100%)`,
                    }}
                  >
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{c.name}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[260px]">
                      {c.email ?? ""}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="badge-purple">{c.department ?? "—"}</span>
              </td>
              <td className="px-4 py-3 text-slate-700">{c.position ?? "—"}</td>
              <td className="px-4 py-3 text-center"><ScoreBadge score={c.llm_score} /></td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/candidate/${c.candidate_id}`}
                  className="btn-primary !py-1.5 !px-3 group-hover:translate-x-0.5 transition-transform"
                >
                  Review
                  <ArrowRightIcon size={14} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PALETTE = [
  "#347dff", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#06b6d4", "#6366f1", "#f43f5e", "#22c55e", "#0ea5e9",
];
function avatarColor(seed: string, brightness = 1): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % PALETTE.length;
  const c = PALETTE[Math.abs(hash) % PALETTE.length];
  if (brightness === 1) return c;
  // Darken the color slightly
  return c;
}
