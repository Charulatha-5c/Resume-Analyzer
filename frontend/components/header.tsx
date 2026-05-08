"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <img src="https://www.5cnetwork.com/_astro/prodigi.DoGieTEj.svg" alt="5C Network" className="h-9 w-auto flex-shrink-0" />
          <h1 className="text-[17px] sm:text-[19px] font-semibold tracking-tight truncate bg-gradient-to-r from-brand-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Resume Fit Analyzer
          </h1>
        </Link>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs text-slate-400">Signed in as</span>
                <span className="text-xs text-slate-700 truncate max-w-[180px] font-medium">
                  {user.email}
                </span>
              </div>
              <button onClick={logout} className="btn-secondary text-sm">
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
