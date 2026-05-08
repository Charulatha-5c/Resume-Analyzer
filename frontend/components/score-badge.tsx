export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const tier = score >= 80 ? "good" : score >= 50 ? "ok" : "low";
  const colors = {
    good: "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-800 ring-emerald-200",
    ok: "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-800 ring-amber-200",
    low: "bg-gradient-to-br from-rose-50 to-rose-100 text-rose-800 ring-rose-200",
  }[tier];
  const sizes = {
    sm: "text-xs px-2 py-0.5 ring-1",
    md: "text-sm px-3 py-1 ring-1 font-semibold",
    lg: "text-lg px-4 py-2 ring-2 font-bold shadow-sm",
  }[size];
  return (
    <span className={`inline-flex items-center rounded-full ${colors} ${sizes}`}>{score}</span>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const gradient =
    pct >= 80
      ? "linear-gradient(90deg, #10b981 0%, #059669 100%)"
      : pct >= 50
        ? "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)"
        : "linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)";
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: gradient }}
      />
    </div>
  );
}
