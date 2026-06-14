"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/expenses?groupId=1")
      .then((res) => res.json())
      .then((data) => {
        setExpenses(data);
        setLoading(false);
      });
  }, []);

  const filtered = expenses.filter((e) =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.paidBy?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "12px" }}>
        <div className="spinner" />
        <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Loading expenses…</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div className="animate-fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title">All Expenses</h1>
          <p className="page-subtitle">{expenses.length} total transactions for the group</p>
        </div>
        <Link href="/import" className="btn-primary" style={{ textDecoration: "none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          Import CSV
        </Link>
      </div>

      {/* Search */}
      <div className="animate-fade-up-1" style={{ position: "relative" }}>
        <svg
          style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="input"
          style={{ paddingLeft: "40px" }}
          placeholder="Search by description or payer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card animate-fade-up-2" style={{ overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <p style={{ fontSize: "32px", marginBottom: "10px" }}>🔍</p>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>No expenses found</p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
              {expenses.length === 0 ? "Import a CSV to get started!" : "Try a different search term."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Paid By</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th style={{ textAlign: "center" }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((expense) => (
                <tr key={expense.id}>
                  <td>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {expense.date}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/expenses/${expense.id}`}
                      style={{ color: "var(--text-primary)", fontWeight: 500, textDecoration: "none", fontSize: "14px" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-light)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                    >
                      {expense.description}
                    </Link>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="avatar" style={{ width: "26px", height: "26px", fontSize: "11px", borderRadius: "7px" }}>
                        {expense.paidBy?.name?.charAt(0)}
                      </div>
                      <span style={{ fontSize: "13px" }}>{expense.paidBy?.name}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span style={{ fontWeight: 700, color: expense.isRefund ? "var(--green)" : "var(--text-primary)", fontSize: "14px" }}>
                      {expense.isRefund ? "-" : ""}₹{Math.abs(expense.amount).toLocaleString()}
                    </span>
                    {expense.currency !== "INR" && (
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                        ({expense.originalAmount} {expense.currency})
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {expense.isSettlement ? (
                      <span className="badge badge-green">Settlement</span>
                    ) : expense.isRefund ? (
                      <span className="badge badge-amber">Refund</span>
                    ) : (
                      <span className="badge badge-indigo">Expense</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer count */}
      {filtered.length > 0 && (
        <p style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
          Showing {filtered.length} of {expenses.length} expenses
        </p>
      )}
    </div>
  );
}
