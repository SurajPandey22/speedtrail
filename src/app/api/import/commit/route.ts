import { NextRequest, NextResponse } from "next/server";
import { query, initDb, getPool } from "@/lib/db";
import { detectAnomalies, parseCSV, computeSplits } from "@/lib/importer";

// POST /api/import/commit — apply user decisions and write expenses to DB
export async function POST(req: NextRequest) {
  await initDb();
  const body = await req.json();
  const {
    sessionId,
    groupId = 1,
    parsed,           // ParsedExpense[] from the earlier parse step
    decisions,        // { [rowIndex]: 'approve' | 'reject' }
    usdRate = 83.5,
  } = body;

  if (!sessionId || !parsed) {
    return NextResponse.json({ error: "sessionId and parsed required" }, { status: 400 });
  }

  const client = await getPool().connect();
  let imported = 0;
  let skipped = 0;
  const report: string[] = [];

  try {
    await client.query("BEGIN");

    for (const expense of parsed) {
      const decision = decisions?.[expense.rowIndex] ?? "approve";

      if (decision === "reject") {
        skipped++;
        report.push(`Row ${expense.rowIndex}: SKIPPED — user rejected`);
        await client.query(
          "UPDATE import_anomalies SET user_decision='reject', resolved=TRUE WHERE session_id=$1 AND row_index=$2",
          [sessionId, expense.rowIndex]
        );
        continue;
      }

      // Resolve payer member
      let payerRows = await client.query("SELECT id FROM members WHERE name = $1", [expense.paidByName]);
      if (!payerRows.rows.length) {
        const ins = await client.query(
          "INSERT INTO members (name, is_guest) VALUES ($1, TRUE) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
          [expense.paidByName]
        );
        payerRows = ins;
      }
      const payerId = payerRows.rows[0].id;

      if (expense.isSettlement) {
        // Settlement: payer pays splitWith[0]
        const payeeName = expense.splitWith?.[0];
        if (payeeName) {
          let payeeRows = await client.query("SELECT id FROM members WHERE name = $1", [payeeName]);
          if (!payeeRows.rows.length) {
            payeeRows = await client.query(
              "INSERT INTO members (name, is_guest) VALUES ($1, TRUE) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
              [payeeName]
            );
          }
          const payeeId = payeeRows.rows[0].id;
          await client.query(`
            INSERT INTO settlements (group_id, payer_member_id, payee_member_id, amount, settled_at, notes)
            VALUES ($1,$2,$3,$4,$5,$6)
          `, [groupId, payerId, payeeId, Math.abs(expense.amount), expense.date, expense.notes]);
          imported++;
          report.push(`Row ${expense.rowIndex}: IMPORTED as settlement — ${expense.paidByName} → ${payeeName} ₹${expense.amount}`);
        }
        continue;
      }

      // Compute splits
      const splitMap = computeSplits(expense);
      if (!Object.keys(splitMap).length) {
        skipped++;
        report.push(`Row ${expense.rowIndex}: SKIPPED — no valid split members`);
        continue;
      }

      // Insert expense
      const expRes = await client.query(`
        INSERT INTO expenses
          (group_id, description, amount, original_amount, original_currency,
           exchange_rate, paid_by_member_id, split_type, expense_date,
           is_settlement, is_refund, import_row_index, import_session_id, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id
      `, [
        groupId,
        expense.description,
        expense.isRefund ? -Math.abs(expense.amount) : expense.amount,
        expense.originalAmount,
        expense.originalCurrency,
        expense.exchangeRate,
        payerId,
        expense.splitType,
        expense.date,
        false,
        expense.isRefund,
        expense.rowIndex,
        sessionId,
        expense.notes,
      ]);
      const expenseId = expRes.rows[0].id;

      // Insert splits
      for (const [memberName, shareAmount] of Object.entries(splitMap)) {
        let memberRows = await client.query("SELECT id FROM members WHERE name = $1", [memberName]);
        if (!memberRows.rows.length) {
          memberRows = await client.query(
            "INSERT INTO members (name, is_guest) VALUES ($1, TRUE) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
            [memberName]
          );
        }
        const memberId = memberRows.rows[0].id;
        await client.query(
          "INSERT INTO expense_splits (expense_id, member_id, share_amount) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [expenseId, memberId, shareAmount]
        );
      }

      imported++;
      report.push(`Row ${expense.rowIndex}: IMPORTED — "${expense.description}" ₹${expense.amount} [${expense.originalCurrency}]`);

      await client.query(
        "UPDATE import_anomalies SET user_decision='approve', resolved=TRUE WHERE session_id=$1 AND row_index=$2",
        [sessionId, expense.rowIndex]
      );
    }

    // Update session
    await client.query(`
      UPDATE import_sessions
      SET status='committed', committed_at=NOW(), imported_rows=$1, skipped_rows=$2
      WHERE id=$3
    `, [imported, skipped, sessionId]);

    await client.query("COMMIT");
  } catch (e) {
    console.error("COMMIT ERROR:", e);
    await client.query("ROLLBACK");
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ imported, skipped, report });
}
