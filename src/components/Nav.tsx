"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navLinks = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
      </svg>
    ),
  },
  {
    href: "/balances",
    label: "Balances",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    href: "/import",
    label: "Import CSV",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
      </svg>
    ),
  },
];

export default function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session) return null;

  const userName = session.user?.name || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <aside
      style={{
        width: "240px",
        minHeight: "100vh",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "28px 24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(99,102,241,0.45)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700, fontSize: "17px",
              background: "linear-gradient(135deg, #818cf8, #a78bfa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}
          >
            SpeedTrail
          </span>
        </div>
      </div>

      {/* Nav Label */}
      <div style={{ padding: "0 24px 8px" }}>
        <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>
          Navigation
        </span>
      </div>

      {/* Links */}
      <nav style={{ padding: "0 12px", flex: 1 }}>
        {navLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 12px", borderRadius: "10px", marginBottom: "2px",
                fontWeight: active ? 600 : 500,
                fontSize: "14px",
                color: active ? "#fff" : "var(--text-secondary)",
                background: active ? "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))" : "transparent",
                border: active ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                textDecoration: "none",
                transition: "all 0.18s",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.08)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }
              }}
            >
              <span style={{ color: active ? "#818cf8" : "var(--text-muted)", flexShrink: 0 }}>{link.icon}</span>
              {link.label}
              {active && (
                <span
                  style={{
                    marginLeft: "auto", width: "6px", height: "6px",
                    borderRadius: "50%", background: "#818cf8",
                    boxShadow: "0 0 8px #6366f1",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: "1px", background: "var(--border)", margin: "8px 24px" }} />

      {/* User profile + sign out */}
      <div style={{ padding: "16px 16px 24px" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 12px", borderRadius: "12px",
            background: "rgba(99,102,241,0.06)", border: "1px solid var(--border)",
          }}
        >
          <div
            className="avatar"
            style={{ width: "32px", height: "32px", fontSize: "13px", borderRadius: "8px" }}
          >
            {userInitial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {userName}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>Member</p>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--text-muted)", padding: "4px", borderRadius: "6px",
              display: "flex", alignItems: "center", transition: "color 0.2s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--red)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
