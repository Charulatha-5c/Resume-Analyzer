"use client";

import { useState } from "react";
import { RefreshIcon, SparkleIcon } from "./icons";

export function ProcessButton({ onProcessed }: { onProcessed?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/process-pending", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start processing");
      setMsg("✓ Processing started — new scores will appear in a few minutes");
      onProcessed?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setTimeout(() => {
        setMsg(null);
        setErr(null);
      }, 6000);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleClick}
        disabled={busy}
        className="btn-accent text-sm"
        title="Trigger n8n to process any new pending candidates"
      >
        {busy ? (
          <>
            <RefreshIcon size={16} />
            Triggering…
          </>
        ) : (
          <>
            <SparkleIcon size={16} />
            Process new resumes
          </>
        )}
      </button>
      {msg && (
        <div className="text-xs px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
          {msg}
        </div>
      )}
      {err && (
        <div className="text-xs px-3 py-1.5 rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200">
          ⚠ {err}
        </div>
      )}
    </div>
  );
}
