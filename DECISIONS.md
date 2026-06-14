# DECISIONS.md — Engineering & Product Decision Log

## 1. Multi-Currency Approach (Priya's Requirement)
**Problem**: The CSV contains USD expenses from a Goa trip, but the group operates in INR.
**Options Considered**:
1. Fetch historical FX rates for exact dates via a third-party API.
2. Ask the user for a single conversion rate during the CSV import.
3. Keep balances multi-currency (User owes $50 and ₹200).
**Decision**: Option 2 (User provides rate at import).
**Why**: Keeping separate currency ledgers (Option 3) overcomplicates debt settlement (how do you settle a $50 debt with INR?). Historical rates (Option 1) are unpredictable and might not match the actual markup their bank charged them. Giving the user control over the exact rate at the time of import is the most deterministic and realistic approach for a flat trip.

## 2. Dealing with Departed/New Members (Sam & Meera)
**Problem**: Meera left in March, Sam joined in April. How do we prevent Sam from being billed for March electricity, or Meera for April rent?
**Options Considered**:
1. Create separate groups (Group 1: Aisha, Rohan, Priya, Meera. Group 2: Aisha, Rohan, Priya, Sam).
2. Time-bound memberships (`joined_at`, `left_at` fields in a join table).
**Decision**: Option 2.
**Why**: Flats consider themselves one continuous entity. Splitting into multiple groups fragments the history. By adding `joined_at` and `left_at` to the `group_memberships` table, the importer can validate split participants against the expense date, and the Balances engine can filter views by date (Sam can filter balances from April 15 onward).

## 3. Debt Simplification Algorithm
**Problem**: If A owes B ₹100, and B owes C ₹100, A should just pay C ₹100.
**Options Considered**:
1. Exact path resolution (Graph flow network / Ford-Fulkerson).
2. Greedy matching (Sort creditors and debtors by net balance, match largest to largest).
**Decision**: Option 2 (Greedy Matching).
**Why**: Graph algorithms yield the absolute optimal minimum transactions but are computationally heavy and complex to write. The greedy approach is $O(N \log N)$ and guarantees $N-1$ transactions at worst, which is practically optimal for a 6-person flat.

## 4. Import Philosophy
**Problem**: The CSV is full of messy data (ambiguous dates, missing names, typos, invalid math).
**Options Considered**:
1. "Best effort" import: auto-guess fixes and insert silently.
2. "Strict" import: fail the entire file if one row is bad.
3. "Staging" approach: parse, flag anomalies, require user review.
**Decision**: Option 3.
**Why**: Silent fixes erode trust (Meera explicitly requested to approve changes). Strict failures cause high user frustration. The staging approach allows the system to be helpful (suggesting fixes) while keeping the user in control, fulfilling all assignment requirements.

## 5. Database Selection
**Problem**: Need a relational database for a Node.js/Next.js stack that works seamlessly on Windows without complex native build pipelines (node-gyp/Python issues).
**Options Considered**:
1. `better-sqlite3` (Requires native compilation, often fails on Windows without Python).
2. `sql.js` (WASM, but in-memory only).
3. PostgreSQL via pure-JS `pg` driver.
**Decision**: Option 3.
**Why**: After initial build failures with SQLite native bindings on the Windows environment, switching to a remote/local PostgreSQL DB with a pure JavaScript driver (`pg`) guaranteed zero build issues, while providing a far more robust relational schema (JSONB, strict types, better date handling) suitable for financial data.
