# 🚀 SpeedTrail — Flatmate Expense Tracker

> A production-grade shared expense management app for flatmates — built with Next.js 15, PostgreSQL, and TypeScript.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-336791?style=flat-square&logo=postgresql)
![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)
![NextAuth](https://img.shields.io/badge/NextAuth.js-v4-purple?style=flat-square)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Database Schema](#-database-schema)
- [CSV Anomaly Detection](#-csv-anomaly-detection)
- [Setup & Installation](#-setup--installation)
- [Default Accounts](#-default-accounts)
- [Project Structure](#-project-structure)
- [Engineering Decisions](#-engineering-decisions)
- [Known Limitations](#-known-limitations)
- [Documentation Index](#-documentation-index)

---

## 🌟 Overview

**SpeedTrail** is a full-stack flatmate expense tracking web app. It allows a group of flatmates to:

- Import shared expenses from a **CSV file** with intelligent anomaly detection
- Track **who paid what**, and compute **who owes whom**
- Handle complex scenarios: **mid-tenure member changes**, **multi-currency expenses**, **unequal splits**, **settlements**, and **refunds**
- Simplify outstanding debts into the **minimum number of transactions**

> ⚠️ This app is **private** — registration is restricted to `@flat.com` email addresses only.

---

## ✨ Features

### 🔐 Authentication
- Secure login with **NextAuth.js** (credentials provider)
- Passwords hashed with **bcrypt** (salt rounds: 10)
- Session-protected routes — unauthenticated users are redirected to `/login`
- Registration restricted to **`@flat.com` domain only** (both client + server enforced)
- Smart redirect: unregistered users are sent from login → signup with email pre-filled

### 📥 Smart CSV Import (Zero Silent Failures)
- Upload any `.csv` or `.tsv` file of expenses
- Full **anomaly detection pipeline** across 18+ anomaly types (see below)
- Staging review UI — every row shows its detected issues with a suggested fix
- User **approves or rejects** each row individually before anything is written to the database
- Post-commit **import report** showing every row's final status

### 💱 Multi-Currency Support
- All USD expenses are converted to INR at a **user-provided exchange rate** during import
- Preset rates (₹83.5, ₹84, ₹85…) + **custom rate input** supported
- Original amount and currency are preserved in the database for full auditability

### 💸 Flexible Split Types
| Type | Description |
|------|-------------|
| `equal` | Total divided equally among all listed members |
| `unequal` | Each member's exact share specified in rupees |
| `percentage` | Each member's share specified as a percentage |
| `share` | Each member assigned a number of shares (weighted equal split) |

### 📊 Balances & Debt Simplification
- **Net Balances view** (Aisha's requirement): Who owes (+) or is owed (-) overall
- **Exact Breakdown view** (Rohan's requirement): Every single expense with your share
- **Settle Up suggestions**: Greedy algorithm computing the minimum number of payments to clear all debts
- Date-range filter to view balances from a specific date (useful for Sam who joined mid-period)

### 👥 Time-Aware Memberships
- Members have `joined_at` and `left_at` dates on the group
- The import engine **validates split participants against expense date** — Meera (left Mar 31) won't be billed for April expenses
- The balances engine filters by membership window

---

## 🛠 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 15 (App Router) | Full-stack React with server/client components and API Routes |
| **Language** | TypeScript 5 | Type safety across the entire codebase |
| **Database** | PostgreSQL 13+ via `pg` | Pure-JS driver — no native compilation, works on Windows out of the box |
| **Auth** | NextAuth.js v4 | Credentials provider, session management, JWT |
| **Styling** | Tailwind CSS v4 | Utility-first, responsive design |
| **Hashing** | bcryptjs | Password hashing without native bindings |

---

## 🏗 Architecture

```
speedtrail-app/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── page.tsx                # Dashboard (balance summary + settle up)
│   │   ├── expenses/               # Expense list + detail view
│   │   ├── balances/               # Net balances + exact breakdown
│   │   ├── import/                 # CSV import + anomaly review UI
│   │   ├── login/                  # Login page (Suspense-wrapped)
│   │   ├── signup/                 # Signup page (@flat.com only)
│   │   └── api/
│   │       ├── auth/               # NextAuth + /signup endpoint
│   │       ├── expenses/           # GET all expenses / GET single expense
│   │       ├── balances/           # GET net balances + settle-up suggestions
│   │       ├── import/             # POST upload CSV → staging
│   │       │   └── commit/         # POST commit approved rows → DB
│   │       ├── members/            # GET members list / check-email
│   │       └── settlements/        # POST record a manual settlement
│   ├── components/
│   │   ├── Nav.tsx                 # Top navigation bar (session-aware)
│   │   └── AuthProvider.tsx        # NextAuth session provider wrapper
│   └── lib/
│       ├── importer.ts             # Full CSV parse + anomaly detection engine
│       ├── balances.ts             # Balance calculation + debt simplification
│       └── db/
│           ├── index.ts            # pg Pool, query helper, initDb()
│           └── schema.sql          # Full PostgreSQL DDL
```

### Request Flow

```
Browser → Next.js App Router
             │
             ├─ Page Components (RSC / Client)
             │       └─ fetch() → API Routes
             │
             └─ API Routes → lib/db (PostgreSQL via pg)
                                  │
                                  └─ PostgreSQL (port 5433)
```

---

## 🗃 Database Schema

```
members            groups             group_memberships
──────────         ──────             ─────────────────
id (PK)            id (PK)            id (PK)
name               name               group_id → groups
email (UNIQUE)     home_currency      member_id → members
password_hash      created_at         joined_at
is_guest                              left_at
created_at

expenses                              expense_splits
────────                              ──────────────
id (PK)                               id (PK)
group_id → groups                     expense_id → expenses
description                           member_id → members
amount (INR)                          share_amount
original_amount
original_currency                     settlements
exchange_rate                         ───────────
paid_by_member_id → members           id (PK)
split_type                            group_id → groups
expense_date                          payer_member_id → members
is_settlement                         payee_member_id → members
is_refund                             amount
import_session_id                     settled_at
notes

import_sessions       import_anomalies
───────────────       ────────────────
id (PK)               id (PK)
group_id              session_id → import_sessions
filename              row_index
usd_to_inr_rate       raw_row (JSONB)
status                anomaly_type
total_rows            description
imported_rows         suggested_action
skipped_rows          user_decision
                      resolved
```

---

## 🔍 CSV Anomaly Detection

The import engine (`src/lib/importer.ts`) detects **18 anomaly types** before any data touches the database:

| Anomaly | Detection Logic |
|---------|----------------|
| `DUPLICATE` | Same date + description + payer + amount as another row |
| `MALFORMED_AMOUNT` | Commas in number (e.g. `1,200`) — suggests stripping comma |
| `MALFORMED_DATE` | Unparseable date format |
| `AMBIGUOUS_DATE` | `DD-MM` vs `MM-DD` is ambiguous — asks for confirmation |
| `UNKNOWN_PAYER` | Payer name fails exact match; fuzzy (Levenshtein) suggests closest |
| `PAYER_CASE_MISMATCH` | `priya` vs `Priya` — suggests title-cased version |
| `MISSING_PAYER` | `paid_by` field is blank |
| `MISSING_CURRENCY` | Currency field is blank — suggests group default (INR) |
| `SETTLEMENT_AS_EXPENSE` | Notes mention "settlement" but row is structured as expense |
| `PERCENTAGE_SUM_INVALID` | Percentages don't add up to 100% — blocked, must fix manually |
| `NEGATIVE_AMOUNT` | Negative value treated as a **refund** expense |
| `ZERO_AMOUNT` | Zero-value expense — skipped by default, user must approve |
| `EXTRA_PRECISION` | More than 2 decimal places — suggests rounding |
| `INACTIVE_MEMBER_IN_SPLIT` | A split member has `left_at` before the expense date |
| `UNKNOWN_MEMBER_IN_SPLIT` | A split member is not in the known members list |
| `FOREIGN_CURRENCY` | Non-INR currency — converted using the user-provided rate |
| `CONFLICTING_SPLIT_TYPE` | e.g. `equal` type but `split_details` present — resolves gracefully |
| `NON_EXPENSE_TRANSFER` | Notes indicate a bank transfer / deposit — treated as settlement |

---

## ⚙ Setup & Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [PostgreSQL](https://www.postgresql.org/) 13 or higher (running locally)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd speedtrail-app
npm install --legacy-peer-deps
```

### 2. Configure Environment

Create a `.env.local` file in the project root:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/speedtrail"
NEXTAUTH_SECRET="your-secret-key-change-in-production"
```

> ℹ️ If you have multiple PostgreSQL versions, check which port your instance is running on (common: `5432` for v14+, `5433` for v13).

### 3. Initialize the Database

The app auto-runs `schema.sql` on first boot via `initDb()`. To seed the initial members manually, run:

```bash
node add-suraj.js
```

Or connect to your PostgreSQL instance and run `src/lib/db/schema.sql` directly.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Import Expenses

1. Navigate to **Import CSV**
2. Upload `expenses_export.csv` from the project root
3. Set the USD → INR exchange rate (default: ₹83.5)
4. Review the detected anomalies
5. Click **Commit Approved Rows**

---

## 👤 Default Accounts

> All accounts use `@flat.com` emails. Registration is restricted to this domain.

| Name | Email | Password | Notes |
|------|-------|----------|-------|
| Suraj | `suraj@flat.com` | `Suraj` | Admin / app owner |
| Aisha | `aisha@flat.com` | `password` | Active member |
| Rohan | `rohan@flat.com` | `password` | Active member |
| Priya | `priya@flat.com` | `password` | Active member |
| Meera | `meera@flat.com` | `password` | Left on 2026-03-31 |
| Sam | `sam@flat.com` | `password` | Joined 2026-04-15 |

---

## 🧠 Engineering Decisions

### 1. Multi-Currency — User-provided rate at import time
Instead of calling an FX API or maintaining multi-currency ledgers, the user specifies the USD→INR rate when uploading the CSV. This matches the actual bank rate they paid and keeps the debt ledger in a single currency (INR), making settlement trivial.

### 2. Time-Aware Memberships — `joined_at` / `left_at`
Rather than splitting into separate groups when Meera left and Sam joined, a single group with time-bound membership rows is used. The importer validates split participants against the expense date, and the balances view accepts a `fromDate` parameter so Sam can filter to only his period.

### 3. Debt Simplification — Greedy Algorithm `O(N log N)`
Sort creditors and debtors by net balance descending, then repeatedly match the largest debtor with the largest creditor. This guarantees at most `N−1` transactions — practically optimal for ≤10 flatmates, and far simpler than a full graph-flow solution.

### 4. Import Philosophy — Staging, not silent fixes
The entire CSV is parsed into a staging session. No data touches the production tables until the user explicitly clicks **Commit**. Every anomaly is surfaced with a suggested action. This was a hard requirement from Meera.

### 5. Database — PostgreSQL over SQLite
`better-sqlite3` requires `node-gyp` native compilation which fails on Windows without Python + VS Build Tools. Switching to PostgreSQL with the pure-JavaScript `pg` driver eliminated all build issues while giving a more robust, production-grade database (JSONB, strict types, proper date handling for financial data).

---

## ⚠️ Known Limitations

- **Single group only**: The app is hardcoded to `group_id = 1`. Multi-group support would require routing changes.
- **No real-time updates**: The UI doesn't use WebSockets; refresh the page to see changes made by other users.
- **Manual settlement recording**: Clicking "Record Payment" on the Balances page is a UI stub — it will be wired to the `/api/settlements` endpoint in a future update.
- **No email verification**: Signup is validated by domain (`@flat.com`) but no email OTP is sent.

---

## 📚 Documentation Index

| File | Description |
|------|-------------|
| [`README.md`](./README.md) | This file — full project overview |
| [`SCOPE.md`](./SCOPE.md) | Detailed anomaly log + database schema reference |
| [`DECISIONS.md`](./DECISIONS.md) | Engineering & product decision log with rationale |
| [`AI_USAGE.md`](./AI_USAGE.md) | How AI was used, what it got wrong, and how it was corrected |

---

## 📄 License

This project was built as a technical assignment. All rights reserved.
