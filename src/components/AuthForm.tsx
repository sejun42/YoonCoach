"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setMessage("");
    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "로그인 정보를 확인해 주세요.");
      const me = await fetch("/api/me", { cache: "no-store" });
      if (!me.ok) throw new Error("계정 정보를 불러오지 못했습니다.");
      const account = await me.json();
      router.replace(account.onboarding_completed ? "/weights" : "/onboarding");
    } catch (error) { setMessage(error instanceof Error ? error.message : "연결 상태를 확인해 주세요."); }
    finally { setLoading(false); }
  }
  return <section className="auth-wrap">
    <div className="brand"><Image src="/icon.svg" alt="" width={34} height={34} priority /><span>YoonCoach</span></div>
    <h1>{mode === "login" ? "나의 기록으로 돌아가기" : "새로운 기록 시작하기"}</h1>
    <div className="segmented" role="group" aria-label="계정 접속">
      <button type="button" aria-pressed={mode === "login"} disabled={loading} onClick={() => { setMode("login"); setMessage(""); }}>로그인</button>
      <button type="button" aria-pressed={mode === "signup"} disabled={loading} onClick={() => { setMode("signup"); setMessage(""); }}>회원가입</button>
    </div>
    <form onSubmit={submit}>
      <label>이메일<input className="field" type="email" autoComplete="email" required value={email} disabled={loading} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      <label>비밀번호<input className="field" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} disabled={loading} onChange={(event) => setPassword(event.target.value)} /></label>
      <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "확인 중" : mode === "login" ? "로그인" : "계정 만들기"}<ArrowRight size={18} /></button>
      {message && <p className="form-message error-text" role="alert">{message}</p>}
    </form>
  </section>;
}
