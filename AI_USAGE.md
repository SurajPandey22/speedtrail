# AI_USAGE.md

## AI Tools Used
- **Agent**: Antigravity (Google DeepMind coding assistant) utilizing Gemini 3.1 Pro / Claude 3.5 Sonnet.
- **Workflow**: The AI acted as a pair programmer. I defined the architecture, reviewed all generated logic, specifically designed the data anomaly detection rules, and guided the technology stack transitions.

## Prompts & Directives
Key prompts focused on:
1. "Analyze the attached CSV for anomalies based on the provided business rules (Meera leaving, Sam joining, USD conversions)."
2. "Design a Next.js App Router API that parses the CSV into a staging environment rather than writing directly to the database, so the user can approve changes."
3. "Switch the database stack from better-sqlite3 to PostgreSQL via the pg driver to resolve native Windows build tool chain issues."

## 3 Cases Where AI Made Mistakes

### 1. The SQLite Build Issue
**What went wrong**: The AI initially chose `better-sqlite3` for local development. On my Windows machine, the `node-gyp` native build failed because Python and Visual Studio Build Tools were either missing or misconfigured.
**How I caught it**: The `npm install` task failed with a stack trace complaining about missing Python 3.6+.
**What I changed**: I instructed the AI to abandon SQLite and rewrite the entire database layer, schema, and API routes to use PostgreSQL via the pure JavaScript `pg` driver, bypassing the native build requirement entirely.

### 2. Handling the "Settlement" Anomaly
**What went wrong**: When parsing the row "Rohan paid Aisha back", the AI's initial script logic tried to import it as an equal split expense where Rohan paid for the group, ignoring the note saying "this is a settlement".
**How I caught it**: I reviewed the anomaly detection logic (`importer.ts`) and noticed it was strictly checking `split_type`. Since `split_type` was blank on that row, it defaulted to `equal`.
**What I changed**: I added explicit logic to scan the `notes` field for the word "settlement", and if found, to flag the row as `SETTLEMENT_AS_EXPENSE` and handle it via the `settlements` table instead of the `expenses` table.

### 3. Debt Simplification Algorithm Efficiency
**What went wrong**: The AI proposed a simple algorithm that iteratively picked random debtors and creditors. This occasionally resulted in circular payments or an unnecessarily high number of transactions.
**How I caught it**: I read through the `simplifyDebts` function in `balances.ts` and realized it wasn't sorting the arrays.
**What I changed**: I modified the algorithm to a Greedy approach: sort creditors descending by amount owed to them, sort debtors descending by amount they owe, and always match the largest debtor with the largest creditor. This guarantees the minimum number of transactions ($N-1$ worst case).
