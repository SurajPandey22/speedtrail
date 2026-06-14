import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const groupId = parseInt(searchParams.get("groupId") || "1");
  const memberId = searchParams.get("memberId");

  let sql = `
    SELECT
      e.id, e.description, e.amount, e.original_amount, e.original_currency,
      e.exchange_rate, e.split_type, e.expense_date AS date, e.is_settlement,
      e.is_refund, e.notes, e.import_row_index, e.created_at,
      m.id AS paid_by_id, m.name AS paid_by_name,
      JSON_AGG(JSON_BUILD_OBJECT('memberId', es.member_id, 'name', sm.name, 'share', es.share_amount)) AS splits
    FROM expenses e
    JOIN members m ON m.id = e.paid_by_member_id
    LEFT JOIN expense_splits es ON es.expense_id = e.id
    LEFT JOIN members sm ON sm.id = es.member_id
    WHERE e.group_id = $1
  `;
  const params: unknown[] = [groupId];

  if (memberId) {
    sql += ` AND e.id IN (SELECT expense_id FROM expense_splits WHERE member_id = $2)`;
    params.push(parseInt(memberId));
  }

  sql += ` GROUP BY e.id, m.id ORDER BY e.expense_date DESC, e.id DESC`;

  const rows = await query<{
    id: number; description: string; amount: string; original_amount: string;
    original_currency: string; exchange_rate: string; split_type: string;
    date: string; is_settlement: boolean; is_refund: boolean; notes: string;
    import_row_index: number; created_at: string; paid_by_id: number;
    paid_by_name: string; splits: Array<{ memberId: number; name: string; share: string }>;
  }>(sql, params);

  return NextResponse.json(rows.map(r => ({
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    originalAmount: Number(r.original_amount),
    currency: r.original_currency,
    exchangeRate: Number(r.exchange_rate),
    splitType: r.split_type,
    date: r.date,
    isSettlement: r.is_settlement,
    isRefund: r.is_refund,
    notes: r.notes,
    importRowIndex: r.import_row_index,
    paidBy: { id: r.paid_by_id, name: r.paid_by_name },
    splits: (r.splits || []).filter(Boolean).map(s => ({
      memberId: s.memberId,
      name: s.name,
      share: Number(s.share),
    })),
  })));
}

export async function POST(req: NextRequest) {
  await initDb();
  const body = await req.json();
  const {
    groupId = 1, description, amount, originalAmount, originalCurrency = "INR",
    exchangeRate = 1, paidByMemberId, splitType, date, notes = "", splits,
  } = body;

  if (!description || amount == null || !paidByMemberId || !splitType || !date || !splits?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { getPool } = await import("@/lib/db");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows: [exp] } = await client.query(`
      INSERT INTO expenses
        (group_id, description, amount, original_amount, original_currency,
         exchange_rate, paid_by_member_id, split_type, expense_date, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `, [groupId, description, amount, originalAmount ?? amount, originalCurrency,
        exchangeRate, paidByMemberId, splitType, date, notes]);

    for (const s of splits) {
      await client.query(
        "INSERT INTO expense_splits (expense_id, member_id, share_amount) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [exp.id, s.memberId, s.shareAmount]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ id: exp.id }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    client.release();
  }
}
