"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setMessage(null);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "인증 실패");
      }

      const meRes = await fetch("/api/me", { cache: "no-store" });
      const meJson = await meRes.json();
      if (meJson.onboarding_completed) {
        router.replace("/");
      } else {
        router.replace("/onboarding");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto mt-10 w-full max-w-md panel p-5">
      <h2 className="text-xl font-black tracking-tight">시작하기</h2>
      <p className="small mt-1">이메일과 비밀번호로 바로 시작할 수 있어요.</p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className={`btn flex-1 ${mode === "login" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setMode("login")}
        >
          로그인
        </button>
        <button
          type="button"
          className={`btn flex-1 ${mode === "signup" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setMode("signup")}
        >
          회원가입
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="label">이메일</label>
          <input
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="label">비밀번호 (8자 이상)</label>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary w-full" disabled={loading} onClick={submit}>
          {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
        </button>
      </div>

      {message && <p className="small mt-3 text-red-600">{message}</p>}
    </section>
  );
}
