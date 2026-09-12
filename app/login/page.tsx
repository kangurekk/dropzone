"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07080d] p-5 text-[#f4f5f7]">
      <div className="w-full max-w-[380px] rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-6 shadow-[0_35px_100px_rgba(0,0,0,0.6)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#5b21b6] text-[20px] text-white shadow-[0_0_30px_rgba(139,92,246,0.35)]">
            ◆
          </div>
          <h1 className="text-[20px] font-bold tracking-[-0.4px]">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="mt-1 text-[10px] text-[#737887]">
            {mode === "login"
              ? "Sign in to your большой дроп account"
              : "Pick a username and password"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              maxLength={20}
              className="h-[42px] w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[13px] text-white outline-none focus:border-[#8b5cf6]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={4}
              className="h-[42px] w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[13px] text-white outline-none focus:border-[#8b5cf6]"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] px-3 py-2 text-[11px] text-[#eb4b4b]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-[46px] w-full rounded-lg border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] text-[12px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-center text-[10px] text-[#737887]">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="font-bold text-[#a78bfa] hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have one?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="font-bold text-[#a78bfa] hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}