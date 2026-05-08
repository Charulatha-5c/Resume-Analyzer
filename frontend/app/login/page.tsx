"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/");
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")
          ? "Wrong email or password."
          : msg.includes("auth/user-not-found")
            ? "No account with that email."
            : msg.includes("auth/too-many-requests")
              ? "Too many attempts. Try again in a few minutes."
              : msg.replace("Firebase: ", ""),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="https://www.5cnetwork.com/_astro/prodigi.DoGieTEj.svg" alt="5C Network" className="h-12 w-auto" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-brand-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Resume Fit Analyzer
          </h1>
          <p className="text-sm text-slate-500 mt-2">Find the right candidate faster</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4" suppressHydrationWarning>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@5cnetwork.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Accounts are managed by your admin in the Firebase console.
        </p>
      </div>
    </div>
  );
}
