"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { ScoreBadge, ScoreBar } from "@/components/score-badge";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  GraduationIcon,
  MailIcon,
  PhoneIcon,
  SparkleIcon,
  UserIcon,
} from "@/components/icons";
import type { Candidate } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

export default function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reasonExpanded, setReasonExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/candidates/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setError(d.error);
        else setCandidate(d.candidate);
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, user]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  }
  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-slate-500">Loading candidate…</div>
      </div>
    );
  }
  if (error || !candidate) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Link href="/" className="text-brand-600 hover:underline text-sm inline-flex items-center gap-1">
            <ArrowRightIcon size={14} /> Back
          </Link>
          <div className="card p-6 mt-3 text-rose-700 bg-rose-50 border-rose-200">
            {error || "Candidate not found."}
          </div>
        </div>
      </div>
    );
  }

  const r = candidate.parsed_resume;
  const exp = r.total_experience_years ?? 0;
  const reason = candidate.reason || "No reasoning available.";
  const reasonShort = reason.length > 240 && !reasonExpanded ? reason.slice(0, 240) + "…" : reason;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link
          href="/"
          className="text-brand-600 hover:text-brand-700 text-sm inline-flex items-center gap-1 hover:gap-2 transition-all"
        >
          ← Back to all candidates
        </Link>

        {/* Header card — score badge in top right, NO progress bar */}
        <div className="card-accent p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center w-14 h-14 rounded-xl text-white text-lg font-bold shadow-md flex-shrink-0"
                style={{ background: avatarGradient(candidate.name) }}
              >
                {initials(candidate.name)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{candidate.name}</h1>
                <p className="text-slate-600 mt-1">
                  Applied for{" "}
                  <span className="font-medium text-slate-800">{candidate.position ?? "—"}</span>
                  {candidate.department ? <> · {candidate.department}</> : null}
                </p>
              </div>
            </div>
            <ScoreBadge score={candidate.llm_score} size="lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT */}
          <div className="space-y-6">
            <section className="card p-6">
              <SectionTitle icon={<UserIcon size={18} />} color="blue">
                Personal
              </SectionTitle>
              <dl className="text-sm divide-y divide-slate-100">
                <Row icon={<UserIcon size={14} />} label="Name" value={candidate.name} />
                <Row icon={<MailIcon size={14} />} label="Email" value={candidate.email ?? "—"} />
                <Row icon={<PhoneIcon size={14} />} label="Phone" value={candidate.phone ?? "—"} />
                <Row icon={<BuildingIcon size={14} />} label="Department" value={candidate.department ?? "—"} />
                <Row icon={<BriefcaseIcon size={14} />} label="Position" value={candidate.position ?? "—"} />
                <Row icon={<CalendarIcon size={14} />} label="Applied at" value={candidate.created_at?.replace("T", " ").slice(0, 19) ?? "—"} />
                <Row icon={<ClockIcon size={14} />} label="Total experience" value={`${exp} years`} />
              </dl>
            </section>

            <section className="card p-6">
              <SectionTitle icon={<GraduationIcon size={18} />} color="purple">
                Education
              </SectionTitle>
              {(r.education ?? []).length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {(r.education ?? []).map((e, i) => (
                    <li key={i} className="border-l-2 border-purple-200 pl-3">
                      <div className="font-medium text-slate-800">{e.degree ?? "Degree"}</div>
                      <div className="text-slate-600">
                        {e.college ?? "Institution"}
                        {e.year ? ` · ${e.year}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No education info extracted.</p>
              )}
            </section>

            <section className="card p-6">
              <SectionTitle icon={<BriefcaseIcon size={18} />} color="amber">
                Previous experience
              </SectionTitle>
              {(r.previous_jobs ?? []).length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {(r.previous_jobs ?? []).map((j, i) => (
                    <li key={i} className="border-l-2 border-amber-200 pl-3">
                      <div className="font-medium text-slate-800">{j.title ?? "Role"}</div>
                      <div className="text-slate-600 text-xs">
                        {j.company ?? "Company"} · {j.start ?? "?"} — {j.end ?? "Present"}
                      </div>
                      {j.description && (
                        <p className="text-slate-600 text-xs mt-1.5 line-clamp-2">
                          {j.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No prior jobs extracted.</p>
              )}
            </section>

            {(r.skills ?? []).length > 0 && (
              <section className="card p-6">
                <SectionTitle icon={<SparkleIcon size={18} />} color="green">
                  Skills
                </SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {(r.skills ?? []).map((s, i) => (
                    <span key={i} className="badge-blue text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT */}
          <div className="space-y-6">
            <section className="card-accent p-6">
              <SectionTitle icon={<SparkleIcon size={18} />} color="blue">
                AI score breakdown
              </SectionTitle>
              <div className="text-4xl font-bold text-slate-900">
                {candidate.llm_score}
                <span className="text-base font-normal text-slate-500"> / 100</span>
              </div>
              <div className="mt-3">
                <ScoreBar score={candidate.llm_score} />
              </div>
              <h3 className="font-medium text-slate-800 mt-5 mb-2 text-sm uppercase tracking-wide">
                Reason
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {reasonShort}
              </p>
              {reason.length > 240 && (
                <button
                  onClick={() => setReasonExpanded((v) => !v)}
                  className="text-xs text-brand-600 hover:text-brand-700 mt-2 font-medium"
                >
                  {reasonExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </section>

            {candidate.cover_letter && candidate.cover_letter.trim() && (
              <section className="card p-6">
                <SectionTitle icon={<FileTextIcon size={18} />} color="purple">
                  Cover letter
                </SectionTitle>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line line-clamp-6">
                  {candidate.cover_letter}
                </p>
              </section>
            )}

            {r.summary && (
              <section className="card p-6">
                <SectionTitle icon={<UserIcon size={18} />} color="slate">
                  Summary
                </SectionTitle>
                <p className="text-sm text-slate-700">{r.summary}</p>
              </section>
            )}

            <section className="card p-6">
              <SectionTitle icon={<FileTextIcon size={18} />} color="green">
                Resume
              </SectionTitle>
              {candidate.cv_drive_link ? (
                <a
                  href={candidate.cv_drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full"
                >
                  <FileTextIcon size={16} /> Download / view PDF
                </a>
              ) : (
                <p className="text-sm text-slate-500">No CV link available.</p>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function SectionTitle({
  children,
  icon,
  color,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  color: "blue" | "purple" | "amber" | "green" | "slate";
}) {
  const colors = {
    blue: "bg-brand-50 text-brand-600 ring-brand-200",
    purple: "bg-purple-50 text-purple-600 ring-purple-200",
    amber: "bg-amber-50 text-amber-600 ring-amber-200",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
  }[color];
  return (
    <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ring-1 ${colors}`}>
        {icon}
      </span>
      {children}
    </h2>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-slate-500 inline-flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-slate-800 text-right font-medium text-sm">{value}</dd>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarGradient(name: string): string {
  const colors = [
    ["#347dff", "#1c5cf5"],
    ["#8b5cf6", "#6d28d9"],
    ["#ec4899", "#be185d"],
    ["#f59e0b", "#d97706"],
    ["#10b981", "#047857"],
    ["#06b6d4", "#0891b2"],
    ["#6366f1", "#4338ca"],
    ["#f43f5e", "#be123c"],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % colors.length;
  const [a, b] = colors[Math.abs(hash) % colors.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}
