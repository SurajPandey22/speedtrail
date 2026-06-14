-- SpeedTrail PostgreSQL Schema
-- Run this against your PostgreSQL database to set up all tables.

-- Members (flatmates + guests like Dev, Kabir)
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- A flat/group
CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  home_currency TEXT NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time-aware membership
CREATE TABLE IF NOT EXISTS group_memberships (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  joined_at DATE NOT NULL,
  left_at DATE
);

-- Import sessions
CREATE TABLE IF NOT EXISTS import_sessions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  filename TEXT,
  usd_to_inr_rate NUMERIC(10,4) NOT NULL DEFAULT 83.5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewing','committed','cancelled')),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  committed_at TIMESTAMPTZ,
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  original_amount NUMERIC(12,4),
  original_currency TEXT NOT NULL DEFAULT 'INR',
  exchange_rate NUMERIC(10,4) NOT NULL DEFAULT 1.0,
  paid_by_member_id INTEGER NOT NULL REFERENCES members(id),
  split_type TEXT NOT NULL CHECK(split_type IN ('equal','unequal','percentage','share')),
  expense_date DATE NOT NULL,
  is_settlement BOOLEAN NOT NULL DEFAULT FALSE,
  is_refund BOOLEAN NOT NULL DEFAULT FALSE,
  import_row_index INTEGER,
  import_session_id INTEGER REFERENCES import_sessions(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-member share of each expense
CREATE TABLE IF NOT EXISTS expense_splits (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id),
  share_amount NUMERIC(12,2) NOT NULL,
  UNIQUE(expense_id, member_id)
);

-- Settlements (debt payments between members)
CREATE TABLE IF NOT EXISTS settlements (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  payer_member_id INTEGER NOT NULL REFERENCES members(id),
  payee_member_id INTEGER NOT NULL REFERENCES members(id),
  amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
  settled_at DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-row anomalies detected during import
CREATE TABLE IF NOT EXISTS import_anomalies (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_row JSONB NOT NULL,
  anomaly_type TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_action TEXT,
  user_decision TEXT CHECK(user_decision IN ('approve','reject','modify')),
  modified_value TEXT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_splits_member ON expense_splits(member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_memberships_group ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_session ON import_anomalies(session_id);
