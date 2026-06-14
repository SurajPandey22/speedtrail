"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function Balances() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [recording, setRecording] = useState<number | null>(null);

  const handleRecordPayment = async (suggestionIndex: number, suggestion: any) => {
    setRecording(suggestionIndex);
    try {
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: 1,
          payerMemberId: suggestion.fromMemberId,
          payeeMemberId: suggestion.toMemberId,
          amount: suggestion.amount,
          settledAt: new Date().toISOString().slice(0, 10),
          notes: `Recorded settlement from ${suggestion.fromName} to ${suggestion.toName}`,
        }),
      });
      if (res.ok) {
        // Refresh balances
        const userId = (session?.user as any)?.id;
        if (userId) {
          const url = new URL("/api/balances", window.location.origin);
          url.searchParams.set("groupId", "1");
          url.searchParams.set("memberId", userId);
          if (fromDate) url.searchParams.set("fromDate", fromDate);
          const fresh = await fetch(url.toString()).then((r) => r.json());
          setData(fresh);
        }
      } else {
        alert("Failed to record payment.");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong while recording payment.");
    } finally {
      setRecording(null);
    }
  };

  useEffect(() => {
    const userId = (session?.user as any)?.id;
    if (userId) {
      const url = new URL("/api/balances", window.location.origin);
      url.searchParams.set("groupId", "1");
      url.searchParams.set("memberId", userId);
      if (fromDate) url.searchParams.set("fromDate", fromDate);
      fetch(url.toString()).then((res) => res.json()).then(setData);
    }
  }, [session, fromDate]);

  if (!data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "12px" }}>
        <div className="spinner" />
        <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Loading balances…</span>
      </div>
    );
  }

  const userId = (session?.user as any)?.id;
  const myBalance = data.balances.find((b: any) => b.memberId === parseInt(userId as string));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div className="animate-fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 className="page-title">Group Balances</h1>
          <p className="page-subtitle">Who owes whom, and how to settle up</p>
        </div>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <label htmlFor="fromDate" style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>From:</label>
          <input
            type="date"
            id="fromDate"
            className="input"
            style={{ padding: "6px 10px", width: "150px", fontSize: "13px" }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          {fromDate && (
            <button onClick={() => setFromDate("")} style={{
              background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: "13px", fontWeight: 600,
            }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Top Row: Net Balances + Settle Up */}
      <div className="animate-fade-up-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Net Balances */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ marginBottom: "18px" }}>
            <p className="section-title">Net Balances</p>
            <p className="section-subtitle">Aisha's View — simple overview</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.balances.map((b: any) => (
              <div key={b.memberId} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: "12px",
                background: b.memberId === myBalance?.memberId ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${b.memberId === myBalance?.memberId ? "rgba(99,102,241,0.25)" : "var(--border)"}`,
                transition: "all 0.2s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="avatar" style={{ width: "34px", height: "34px", fontSize: "13px", borderRadius: "9px" }}>
                    {b.memberName.charAt(0)}
                  </div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {b.memberName}
                      {b.memberId === myBalance?.memberId && (
                        <span className="badge badge-indigo" style={{ marginLeft: "8px" }}>You</span>
                      )}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{
                    fontSize: "15px", fontWeight: 700,
                    color: b.netBalance >= 0 ? "var(--green)" : "var(--red)",
                  }}>
                    {b.netBalance >= 0 ? "+" : ""}₹{Math.abs(b.netBalance).toLocaleString()}
                  </span>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {b.netBalance >= 0 ? "is owed" : "owes"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settle Up */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
            <div>
              <p className="section-title">How to Settle Up</p>
              <p className="section-subtitle">Minimum payments to clear all debts</p>
            </div>
            <span className="badge badge-indigo">{data.suggestions.length} payment{data.suggestions.length !== 1 ? "s" : ""}</span>
          </div>
          {data.suggestions.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px 16px",
              background: "rgba(34,211,165,0.05)", borderRadius: "12px", border: "1px solid rgba(34,211,165,0.1)",
            }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>🎉</div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--green)" }}>All debts are cleared!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.suggestions.map((s: any, i: number) => (
                <div key={i} style={{
                  borderRadius: "12px", padding: "14px",
                  background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.1)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: s.fromMemberId === myBalance?.memberId ? "10px" : "0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="avatar" style={{ width: "28px", height: "28px", fontSize: "11px", borderRadius: "7px" }}>
                        {s.fromName.charAt(0)}
                      </div>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        <strong style={{ color: "var(--text-primary)" }}>{s.fromName}</strong>
                        {" → "}
                        <strong style={{ color: "var(--text-primary)" }}>{s.toName}</strong>
                      </span>
                    </div>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--red)" }}>
                      ₹{s.amount.toLocaleString()}
                    </span>
                  </div>
                  {s.fromMemberId === myBalance?.memberId && (
                    <button
                      className="btn-primary"
                      disabled={recording !== null}
                      onClick={() => handleRecordPayment(i, s)}
                      style={{ width: "100%", padding: "8px", fontSize: "12px" }}
                    >
                      {recording === i ? (
                        <>
                          <div className="spinner" style={{ width: "12px", height: "12px", borderWidth: "2px", marginRight: "6px" }} />
                          Recording…
                        </>
                      ) : (
                        "💸 Record Payment"
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="card animate-fade-up-2" style={{ overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <p className="section-title">Your Expense Breakdown</p>
          <p className="section-subtitle">Rohan's View — every expense making up your balance</p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "right" }}>Your Share</th>
              </tr>
            </thead>
            <tbody>
              {data.memberBreakdown?.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    No expenses found for you.
                  </td>
                </tr>
              )}
              {data.memberBreakdown?.map((exp: any) => (
                <tr key={exp.expenseId}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: "12px" }}>{exp.date}</span>
                  </td>
                  <td>
                    <Link href={`/expenses/${exp.expenseId}`} style={{
                      color: "var(--text-primary)", fontWeight: 500, textDecoration: "none", fontSize: "14px",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-light)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                    >
                      {exp.description}
                    </Link>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Paid by {exp.paidByName}</p>
                  </td>
                  <td style={{ textAlign: "right", fontSize: "14px", color: "var(--text-secondary)" }}>
                    ₹{exp.totalAmount?.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--red)" }}>
                      ₹{exp.yourShare?.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
