"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters."); return; }
    if (!email.toLowerCase().endsWith("@flat.com")) {
      setError("Only @flat.com email addresses are allowed to register.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed. Please try again.");
      } else {
        router.push("/login?signup=success");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-base)", padding: "24px",
      backgroundImage: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,92,246,0.13) 0%, transparent 60%)",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }} className="animate-fade-up">

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
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
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Create your account
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "6px" }}>
            Join SpeedTrail — your flat's expense tracker
          </p>
        </div>

        {/* Domain restriction notice */}
        <div className="alert-warning" style={{ marginBottom: "20px", textAlign: "center" }}>
          🔒 Registration restricted to <strong>@flat.com</strong> emails only
        </div>

        {prefillEmail && (
          <div className="alert-info" style={{ marginBottom: "20px", textAlign: "center" }}>
            📧 <strong>{prefillEmail}</strong> is not registered yet
          </div>
        )}

        {/* Card */}
        <div className="card" style={{ padding: "32px" }}>
          {error && (
            <div className="alert-error" style={{ marginBottom: "20px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label htmlFor="signup-name">Full Name</label>
              <input id="signup-name" type="text" required autoFocus className="input"
                placeholder="e.g. Rahul Sharma" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="signup-email">Email Address</label>
              <input id="signup-email" type="email" required className="input"
                placeholder="yourname@flat.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="signup-password">Password</label>
              <input id="signup-password" type="password" required className="input"
                placeholder="Min. 4 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label htmlFor="signup-confirm">Confirm Password</label>
              <input id="signup-confirm" type="password" required className="input"
                placeholder="Re-enter your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", marginTop: "4px", padding: "12px" }}>
              {loading ? <><div className="spinner" />Creating account…</> : "Create Account →"}
            </button>
          </form>

          <div className="divider" />
          <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--accent-light)", fontWeight: 500, textDecoration: "none" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Signup() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "12px" }}>
        <div className="spinner" /><span style={{ color: "var(--text-secondary)" }}>Loading…</span>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
