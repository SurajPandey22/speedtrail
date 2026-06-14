# SCOPE.md — Anomaly Log and Database Schema

## CSV Anomaly Log

The import pipeline scans the CSV and detects the following anomalies, presenting them to the user for approval. No data is silently modified or dropped.

| Row | Anomaly | Detection Logic & Policy |
|-----|---------|--------------------------|
| `08-02` | **Duplicate entry** | Detected two rows with exact same date, desc, payer, and amount. Flagged for review; user chooses whether to import both or skip one. |
| `10-02` | **Malformed Amount (`1,200`)** | Detected comma in number. Auto-suggests stripping the comma to `1200`. |
| `14-02` | **Payer case mismatch (`priya`)** | Compared against normalized known members list. Auto-suggests title-casing to `Priya`. |
| `15-02` | **Precision issue (`899.995`)** | Detected >2 decimal places. Auto-suggests rounding to nearest paise (`900.00`). |
| `18-02` | **Unknown Payer (`Priya S`)** | Failed exact match. Fuzzy matching finds `Priya`. Suggests mapping to `Priya`. |
| `20-02` | **Unequal Split** | Amounts checked against total. Validated correctly. |
| `22-02` | **Missing Payer** | `paid_by` is blank. Flagged: suggests importing as "Unknown" payer, blocking settlement until resolved. |
| `25-02` | **Settlement as Expense** | `split_type` missing and notes mention "settlement". Flagged: suggests importing as a debt payment rather than group expense. |
| `28-02` | **Invalid Percentages** | Percentages sum to 110%. Flagged: blocked from auto-resolve, user must manually fix the row before it can be imported. |
| `09-03` | **Foreign Currency (USD)** | Currency is USD. Flagged: converted to INR using user-provided exchange rate at import time. |
| `11-03` | **Unknown Member in Split** | "Dev's friend Kabir" not in known members. Flagged: suggests adding them as a temporary guest member for this expense only. |
| `11-03` | **Suspected Duplicate (Thalassa)** | Two rows, same date, similar desc, different amounts/payers. Flagged: suggests user review if this was two separate bills or a mistake. |
| `12-03` | **Negative Amount** | Amount is `-30`. Flagged: treats as a "refund" expense, proportionally reducing shared debt instead of adding to it. |
| `Mar-14` | **Ambiguous/Malformed Date** | Format `Mar-14`. Flagged: parsed to `2026-03-14` and asks user to confirm. |
| `15-03` | **Missing Currency** | Currency is blank. Flagged: suggests defaulting to group home currency (INR). |
| `22-03` | **Zero Amount** | Amount is `0`. Flagged: skipped by default, user must explicitly approve to import a zero-value expense. |
| `02-04` | **Inactive Member in Split** | Meera is in the split, but left on `31-03`. Flagged: suggests removing Meera from the split. |
| `04-05` | **Ambiguous Date** | `04-05-2026` could be Apr 5 or May 4. Flagged: suggests DD-MM interpretation but asks for confirmation. |
| `08-04` | **Non-expense Transfer** | "Sam deposit share". Flagged: treats as a settlement payment rather than an expense. |
| `18-04` | **Conflicting Split Type** | Type is `equal` but `split_details` has shares. Flagged: since equal and 1:1 shares are mathematically identical, ignores details and uses equal split. |
| Last row | **Data pollution in notes** | "first row is name of column" found. Imported normally as note text. |

## Database Schema (PostgreSQL)

See `src/lib/db/schema.sql` for exact DDL.

1. **`members`**: `id`, `name`, `email`, `password_hash`, `is_guest`
2. **`groups`**: `id`, `name`, `home_currency`
3. **`group_memberships`**: `group_id`, `member_id`, `joined_at`, `left_at` (handles Sam/Meera logic)
4. **`expenses`**: `id`, `group_id`, `description`, `amount` (INR), `original_amount`, `original_currency`, `exchange_rate`, `paid_by_member_id`, `split_type`, `expense_date`, `is_settlement`, `is_refund`
5. **`expense_splits`**: `expense_id`, `member_id`, `share_amount`
6. **`settlements`**: `group_id`, `payer_member_id`, `payee_member_id`, `amount`, `settled_at`
7. **`import_sessions` & `import_anomalies`**: Tracks CSV imports, user decisions, and generates the final report.
