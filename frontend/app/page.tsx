"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/header";
import { FilterBar } from "@/components/filter-bar";
import { TopMatch } from "@/components/top-match";
import { CandidateTable } from "@/components/candidate-table";
import { applyFilters, rankCandidates, uniquePositions } from "@/lib/ranking";
import type { Candidate } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

const TOP_MATCH_COUNT = 5;

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [position, setPosition] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    fetch("/api/candidates")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setError(d.error);
        else setCandidates(d.candidates ?? []);
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user]);

  const positions = useMemo(() => uniquePositions(candidates), [candidates]);

  const filtered = useMemo(
    () => applyFilters(candidates, { position, dateFrom, dateTo, search }),
    [candidates, position, dateFrom, dateTo, search],
  );
  const ranked = useMemo(() => rankCandidates(filtered), [filtered]);
  const filtersActive = !!(position || dateFrom || dateTo || search);
  const top = filtersActive ? ranked.slice(0, TOP_MATCH_COUNT) : [];

  function clearFilters() {
    setPosition("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Hero / page header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-800">
            Find the Right candidate faster
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Automatically score and rank applicants against role requirements.
          </p>
        </div>

        <FilterBar
          positions={positions}
          position={position}
          dateFrom={dateFrom}
          dateTo={dateTo}
          search={search}
          onChange={(p) => {
            if (p.position !== undefined) setPosition(p.position);
            if (p.dateFrom !== undefined) setDateFrom(p.dateFrom);
            if (p.dateTo !== undefined) setDateTo(p.dateTo);
            if (p.search !== undefined) setSearch(p.search);
          }}
          onClear={clearFilters}
          resultCount={ranked.length}
        />

        {error && (
          <div className="card p-4 text-rose-700 bg-rose-50 border-rose-200">{error}</div>
        )}

        {loading ? (
          <div className="card p-12 text-center text-slate-500">Loading candidates…</div>
        ) : (
          <>
            {filtersActive && top.length > 0 && <TopMatch candidates={top} />}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {filtersActive ? "Matching candidates" : "All candidates"}
                </h2>
                <span className="text-xs text-slate-500">
                  {ranked.length} of {candidates.length}
                </span>
              </div>
              <CandidateTable candidates={ranked} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
