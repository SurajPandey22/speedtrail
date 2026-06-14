"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const signupSuccess = searchParams.get("signup") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const checkRes = await fetch(`/api/members?email=${encodeURIComponent(email)}`);
      const checkData = await checkRes.json();
      if (!checkData.exists) {
        router.push(`/signup?email=${encodeURIComponent(email)}`);
        return;
      }
    } catch {}

    const res = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);
    if (res?.error) {
      setError("Incorrect password. Please try again.");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-base)", padding: "24px",
      backgroundImage: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%)",
    }}>
      <div style={{ width: "100%", maxWidth: "400px" }} className="animate-fade-up">

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "16px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 30px rgba(99,102,241,0.4)", marginBottom: "16px",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            SpeedTrail
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "6px" }}>Sign in to your flat's expense tracker</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "32px" }}>
          {signupSuccess && (
            <div className="alert-success" style={{ marginBottom: "20px", textAlign: "center" }}>
              ✅ Account created! Please sign in.
            </div>
          )}
          {error && (
            <div className="alert-error" style={{ marginBottom: "20px", textAlign: "center" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                className="input"
                placeholder="yourname@flat.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                required
                className="input"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", marginTop: "4px", padding: "12px" }}>
              {loading ? <><div className="spinner" />Checking…</> : "Sign In →"}
            </button>
          </form>

          <div className="divider" />

          <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
            New to SpeedTrail?{" "}
            <Link href="/signup" style={{ color: "var(--accent-light)", fontWeight: 500, textDecoration: "none" }}>
              Create an account
            </Link>
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)", marginTop: "20px" }}>
          🔒 Restricted to <strong style={{ color: "var(--text-secondary)" }}>@flat.com</strong> members
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "12px" }}>
        <div className="spinner" /><span style={{ color: "var(--text-secondary)" }}>Loading…</span>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
