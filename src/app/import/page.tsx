"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportCsv() {
  const [file, setFile] = useState<File | null>(null);
  const [usdRate, setUsdRate] = useState("83.5");
  const [isCustomRate, setIsCustomRate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [decisions, setDecisions] = useState<Record<number, "approve" | "reject">>({});
  const [committing, setCommitting] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("usdRate", usdRate);
    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSessionData(data);
      const initialDecisions: any = {};
      data.parsed.forEach((p: any) => { initialDecisions[p.rowIndex] = "approve"; });
      setDecisions(initialDecisions);
    } catch (err: any) {
      alert("Import failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionData.sessionId, parsed: sessionData.parsed, decisions }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setReport(result);
    } catch (err: any) {
      alert("Commit failed: " + err.message);
    } finally {
      setCommitting(false);
    }
  };

  const approveAll = () => {
    const all: any = {};
    sessionData.parsed.forEach((p: any) => { all[p.rowIndex] = "approve"; });
    setDecisions(all);
  };
  const rejectAll = () => {
    const all: any = {};
    sessionData.parsed.forEach((p: any) => { all[p.rowIndex] = "reject"; });
    setDecisions(all);
  };

  /* ── Import Complete ── */
  if (report) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div className="animate-fade-up" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "20px",
            background: "linear-gradient(135deg, rgba(34,211,165,0.2), rgba(34,211,165,0.05))",
            border: "1px solid rgba(34,211,165,0.3)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: "32px", marginBottom: "20px",
          }}>✓</div>
          <h1 className="page-title" style={{ color: "var(--green)", marginBottom: "8px" }}>Import Complete!</h1>
          <p className="page-subtitle">
            <strong style={{ color: "var(--green)" }}>{report.imported}</strong> rows imported successfully.{" "}
            {report.skipped > 0 && <span style={{ color: "var(--amber)" }}>{report.skipped} skipped.</span>}
          </p>
          <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "center" }}>
            <button onClick={() => router.push("/expenses")} className="btn-primary">View Expenses →</button>
            <button onClick={() => { setReport(null); setSessionData(null); setFile(null); }} className="btn-ghost">Import Another</button>
          </div>
        </div>

        <div className="card animate-fade-up-1" style={{ overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
            </svg>
            <p className="section-title">Import Report</p>
          </div>
          <div style={{ padding: "16px", maxHeight: "400px", overflowY: "auto" }}>
            <div style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.8" }}>
              {report.report.map((line: string, i: number) => (
                <div key={i} style={{
                  padding: "3px 8px", borderRadius: "4px",
                  color: line.includes("IMPORTED") ? "var(--green)" : line.includes("SKIPPED") ? "var(--amber)" : "var(--text-secondary)",
                }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Review Anomalies ── */
  if (sessionData) {
    const approvedCount = Object.values(decisions).filter((d) => d === "approve").length;
    const rejectedCount = Object.values(decisions).filter((d) => d === "reject").length;
    const anomalyRows = sessionData.parsed.filter((r: any) => r.anomalies.length > 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Sticky Header */}
        <div className="card animate-fade-up" style={{
          padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: "16px", zIndex: 10,
          background: "rgba(24,28,53,0.92)", backdropFilter: "blur(16px)",
        }}>
          <div>
            <p className="section-title">Review Import</p>
            <p className="section-subtitle">
              {sessionData.anomalyCount} anomalies across {sessionData.totalRows} rows •{" "}
              <span style={{ color: "var(--green)" }}>{approvedCount} approved</span>
              {rejectedCount > 0 && <> • <span style={{ color: "var(--red)" }}>{rejectedCount} rejected</span></>}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={approveAll} className="btn-ghost" style={{ fontSize: "12px", padding: "7px 14px" }}>✓ All</button>
            <button onClick={rejectAll} className="btn-danger" style={{ fontSize: "12px", padding: "7px 14px" }}>✕ Reject All</button>
            <button onClick={handleCommit} disabled={committing} className="btn-primary">
              {committing ? <><div className="spinner" />Committing…</> : `Commit ${approvedCount} Rows`}
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="animate-fade-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
          {[
            { label: "Total Rows", value: sessionData.totalRows, color: "var(--accent-light)" },
            { label: "Anomalies", value: anomalyRows.length, color: "var(--amber)" },
            { label: "Clean Rows", value: sessionData.totalRows - anomalyRows.length, color: "var(--green)" },
          ].map((s) => (
            <div key={s.label} className="stat-card" style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{s.label}</p>
              <p style={{ fontSize: "28px", fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk',sans-serif" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Row Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {sessionData.parsed.map((row: any, idx: number) => {
            const approved = decisions[row.rowIndex] === "approve";
            const hasAnomalies = row.anomalies.length > 0;
            return (
              <div
                key={row.rowIndex}
                className="card"
                style={{
                  overflow: "hidden",
                  opacity: approved ? 1 : 0.45,
                  borderColor: approved ? (hasAnomalies ? "rgba(251,191,36,0.25)" : "rgba(34,211,165,0.2)") : "var(--border)",
                  animation: `fadeUp 0.3s ${idx * 0.02}s both`,
                }}
              >
                {/* Row Header */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 20px",
                  background: hasAnomalies ? "rgba(251,191,36,0.04)" : "rgba(34,211,165,0.03)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{
                      fontFamily: "monospace", fontSize: "11px", fontWeight: 600,
                      padding: "3px 8px", borderRadius: "6px",
                      background: "rgba(99,102,241,0.1)", color: "var(--accent-light)", border: "1px solid rgba(99,102,241,0.2)",
                    }}>
                      Row {row.rowIndex}
                    </span>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {row.date} — {row.description}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                        ₹{row.amount} • paid by {row.paidByName}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setDecisions({ ...decisions, [row.rowIndex]: "approve" })}
                      style={{
                        padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        border: "none",
                        background: approved ? "rgba(34,211,165,0.15)" : "rgba(255,255,255,0.05)",
                        color: approved ? "var(--green)" : "var(--text-muted)",
                        outline: approved ? "1px solid rgba(34,211,165,0.3)" : "1px solid var(--border)",
                        transition: "all 0.2s",
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => setDecisions({ ...decisions, [row.rowIndex]: "reject" })}
                      style={{
                        padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        border: "none",
                        background: !approved ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.05)",
                        color: !approved ? "var(--red)" : "var(--text-muted)",
                        outline: !approved ? "1px solid rgba(248,113,113,0.3)" : "1px solid var(--border)",
                        transition: "all 0.2s",
                      }}
                    >
                      ✕ Skip
                    </button>
                  </div>
                </div>

                {/* Anomalies or Clean */}
                {hasAnomalies ? (
                  <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {row.anomalies.map((a: any, i: number) => (
                      <div key={i} style={{
                        display: "flex", gap: "10px", padding: "10px 14px", borderRadius: "8px",
                        background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.12)",
                      }}>
                        <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--amber)" }}>{a.description}</p>
                          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
                            <strong style={{ color: "var(--text-secondary)" }}>Suggested action:</strong> {a.suggestedAction}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20,6 9,17 4,12"/>
                    </svg>
                    <span style={{ fontSize: "12px", color: "var(--green)", fontWeight: 500 }}>No anomalies detected</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Upload Form ── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="animate-fade-up">
        <h1 className="page-title">Import Expenses</h1>
        <p className="page-subtitle">Upload your CSV — we'll scan for anomalies before writing anything to the database</p>
      </div>

      <div style={{ maxWidth: "560px" }}>
        <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Drop Zone */}
          <div
            className="card animate-fade-up-1"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) setFile(dropped);
            }}
            style={{
              padding: "40px 24px", textAlign: "center", cursor: "pointer",
              borderColor: dragOver ? "var(--accent)" : file ? "rgba(34,211,165,0.4)" : "var(--border)",
              borderStyle: "dashed", borderWidth: "2px",
              background: dragOver ? "rgba(99,102,241,0.06)" : file ? "rgba(34,211,165,0.04)" : "transparent",
              transition: "all 0.2s",
            }}
          >
            {file ? (
              <>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>📄</div>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--green)" }}>{file.name}</p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  style={{ marginTop: "12px", fontSize: "12px", color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>☁️</div>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                  Drop your CSV here
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>or</p>
                <label
                  htmlFor="file-input"
                  className="btn-ghost"
                  style={{ cursor: "pointer", display: "inline-flex" }}
                >
                  Browse Files
                </label>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.tsv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
              </>
            )}
          </div>

          {/* Exchange Rate */}
          <div className="card animate-fade-up-2" style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span style={{ fontSize: "18px" }}>💱</span>
              <div>
                <p className="section-title">USD → INR Exchange Rate</p>
                <p className="section-subtitle">Used to convert all USD expenses in the CSV</p>
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label>Select a preset rate</label>
              <select
                className="input"
                value={isCustomRate ? "custom" : usdRate}
                onChange={(e) => {
                  if (e.target.value === "custom") { setIsCustomRate(true); }
                  else { setIsCustomRate(false); setUsdRate(e.target.value); }
                }}
              >
                <option value="83.5">₹83.50 (Default)</option>
                <option value="84">₹84.00</option>
                <option value="85">₹85.00</option>
                <option value="86">₹86.00</option>
                <option value="87">₹87.00</option>
                <option value="88">₹88.00</option>
                <option value="custom">Custom rate…</option>
              </select>
            </div>

            {isCustomRate && (
              <div>
                <label>Custom rate (1 USD = ₹?)</label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>1 USD = ₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 83.72"
                    className="input"
                    value={usdRate}
                    onChange={(e) => setUsdRate(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
            )}

            {!isCustomRate && (
              <div className="alert-info" style={{ marginTop: "10px" }}>
                All USD expenses will be converted at <strong>1 USD = ₹{usdRate}</strong>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="btn-primary animate-fade-up-3"
            style={{ padding: "14px", fontSize: "15px", width: "100%" }}
          >
            {uploading ? (
              <><div className="spinner" />Scanning for anomalies…</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Scan for Anomalies
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
