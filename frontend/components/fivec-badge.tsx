export function FiveCBadge({ size = 36 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-xl text-white font-bold shadow-md"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 50%, #1c5cf5 100%)",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        className="absolute inset-0 opacity-25"
      >
        <circle cx="9" cy="9" r="2.5" fill="white" />
        <circle cx="27" cy="9" r="2" fill="white" />
        <circle cx="18" cy="18" r="3" fill="white" />
        <circle cx="9" cy="27" r="2" fill="white" />
        <circle cx="27" cy="27" r="2.5" fill="white" />
        <line x1="9" y1="9" x2="18" y2="18" stroke="white" strokeWidth="0.8" />
        <line x1="27" y1="9" x2="18" y2="18" stroke="white" strokeWidth="0.8" />
        <line x1="9" y1="27" x2="18" y2="18" stroke="white" strokeWidth="0.8" />
        <line x1="27" y1="27" x2="18" y2="18" stroke="white" strokeWidth="0.8" />
      </svg>
      <span className="relative z-10 tracking-tight">5C</span>
    </div>
  );
}

export function FiveCBrand() {
  return (
    <span className="inline-flex items-center gap-1 font-bold text-base">
      <span className="text-rose-600">5</span>
      <span className="text-rose-600">C</span>
      <span className="text-slate-400 font-normal text-xs ml-1">Network</span>
    </span>
  );
}
