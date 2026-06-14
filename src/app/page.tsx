"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetch("/api/balances?groupId=1")
        .then((res) => res.json())
        .then(setData);
    }
  }, [status, router]);

  if (status === "loading" || !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "12px" }}>
        <div className="spinner" />
        <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Loading dashboard…</span>
      </div>
    );
  }

  const userId = (session?.user as any)?.id;
  const myBalance = data.balances.find((b: any) => b.memberId === parseInt(userId as string));
  const net = myBalance?.netBalance ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* Header */}
      <div className="animate-fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">
            Welcome back, <span className="gradient-text">{session?.user?.name}</span> 👋
          </h1>
          <p className="page-subtitle">Here's your snapshot for <strong style={{ color: "var(--text-primary)" }}>{data.group?.name}</strong></p>
        </div>
        <Link href="/import" className="btn-primary" style={{ textDecoration: "none" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          Import CSV
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="animate-fade-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        {/* Total Paid */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Total Paid
            </span>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            </div>
          </div>
          <p style={{ fontSize: "30px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
            ₹{myBalance?.totalPaid?.toLocaleString() ?? 0}
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>Amount you've paid for the group</p>
        </div>

        {/* Your Share */}
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Your Share
            </span>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(248,113,113,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
              </svg>
            </div>
          </div>
          <p style={{ fontSize: "30px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
            ₹{myBalance?.totalOwed?.toLocaleString() ?? 0}
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>Your total share of group expenses</p>
        </div>

        {/* Net Balance */}
        <div className="stat-card" style={{ borderColor: net >= 0 ? "rgba(34,211,165,0.2)" : "rgba(248,113,113,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Net Balance
            </span>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: net >= 0 ? "rgba(34,211,165,0.1)" : "rgba(248,113,113,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={net >= 0 ? "#22d3a5" : "#f87171"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>
          <p style={{ fontSize: "30px", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: net >= 0 ? "var(--green)" : "var(--red)" }}>
            {net >= 0 ? "+" : ""}₹{Math.abs(net).toLocaleString()}
          </p>
          <p style={{ fontSize: "12px", color: net >= 0 ? "rgba(34,211,165,0.7)" : "rgba(248,113,113,0.7)", marginTop: "6px" }}>
            {net >= 0 ? "🟢 You are owed money" : "🔴 You owe money"}
          </p>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="animate-fade-up-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Settle Up */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
            <div>
              <p className="section-title">How to Settle Up</p>
              <p className="section-subtitle">Minimum transactions to clear all debts</p>
            </div>
            <span className="badge badge-indigo">{data.suggestions.length} payment{data.suggestions.length !== 1 ? "s" : ""}</span>
          </div>

          {data.suggestions.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "32px 16px",
              background: "rgba(34,211,165,0.05)", borderRadius: "12px",
              border: "1px solid rgba(34,211,165,0.1)",
            }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎉</div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--green)" }}>All settled up!</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>No outstanding debts</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.suggestions.map((s: any, i: number) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: "10px",
                  background: "rgba(99,102,241,0.06)", border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className="avatar" style={{ width: "28px", height: "28px", fontSize: "11px", borderRadius: "7px" }}>
                      {s.fromName.charAt(0)}
                    </div>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                      <strong style={{ color: "var(--text-primary)" }}>{s.fromName}</strong>
                      {" → "}
                      <strong style={{ color: "var(--text-primary)" }}>{s.toName}</strong>
                    </span>
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--red)" }}>₹{s.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <Link href="/balances" style={{
              display: "block", textAlign: "center", padding: "10px",
              fontSize: "13px", fontWeight: 500, color: "var(--accent-light)",
              textDecoration: "none", borderRadius: "8px", border: "1px solid var(--border)",
              transition: "all 0.2s",
            }}>
              View Full Balances →
            </Link>
          </div>
        </div>

        {/* All Balances */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ marginBottom: "18px" }}>
            <p className="section-title">Group Members</p>
            <p className="section-subtitle">Net balance for everyone</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.balances.map((b: any) => (
              <div key={b.memberId} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: "10px",
                background: b.memberId === myBalance?.memberId ? "rgba(99,102,241,0.08)" : "transparent",
                border: b.memberId === myBalance?.memberId ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="avatar" style={{ width: "32px", height: "32px", fontSize: "12px", borderRadius: "8px" }}>
                    {b.memberName.charAt(0)}
                  </div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {b.memberName}
                      {b.memberId === myBalance?.memberId && (
                        <span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--accent-light)" }}>(You)</span>
                      )}
                    </p>
                  </div>
                </div>
                <span style={{
                  fontSize: "14px", fontWeight: 700,
                  color: b.netBalance >= 0 ? "var(--green)" : "var(--red)",
                }}>
                  {b.netBalance >= 0 ? "+" : ""}₹{b.netBalance?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="animate-fade-up-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
        {[
          { href: "/expenses", label: "View Expenses", desc: "Browse all group expenses", icon: "📄", color: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.15)" },
          { href: "/balances", label: "Balances", desc: "Detailed breakdown & settle up", icon: "💰", color: "rgba(34,211,165,0.06)", border: "rgba(34,211,165,0.15)" },
          { href: "/import", label: "Import CSV", desc: "Upload & scan for anomalies", icon: "📤", color: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.15)" },
        ].map((a) => (
          <Link key={a.href} href={a.href} style={{
            display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px",
            borderRadius: "12px", background: a.color, border: `1px solid ${a.border}`,
            textDecoration: "none", transition: "all 0.2s",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            <span style={{ fontSize: "24px" }}>{a.icon}</span>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{a.label}</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
