import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initDb();
  const { id } = await params;
  const expenses = await query(`
    SELECT e.*, m.name AS paid_by_name
    FROM expenses e
    JOIN members m ON m.id = e.paid_by_member_id
    WHERE e.id = $1
  `, [parseInt(id)]);

  if (!expenses.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const splits = await query(`
    SELECT es.share_amount, m.id AS member_id, m.name AS member_name
    FROM expense_splits es
    JOIN members m ON m.id = es.member_id
    WHERE es.expense_id = $1
    ORDER BY m.name
  `, [parseInt(id)]);

  const exp = expenses[0] as Record<string, unknown>;
  return NextResponse.json({
    ...exp,
    amount: Number(exp.amount),
    original_amount: Number(exp.original_amount),
    exchange_rate: Number(exp.exchange_rate),
    splits: splits.map((s) => {
      const row = s as Record<string, unknown>;
      return { ...row, share_amount: Number(row.share_amount) };
    }),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initDb();
  const { id } = await params;
  await query("DELETE FROM expenses WHERE id = $1", [parseInt(id)]);
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initDb();
  const { id } = await params;
  const body = await req.json();

  if (body.notes !== undefined) {
    await query("UPDATE expenses SET notes = $1 WHERE id = $2", [body.notes, parseInt(id)]);
  }
  if (body.description !== undefined) {
    await query("UPDATE expenses SET description = $1 WHERE id = $2", [body.description, parseInt(id)]);
  }
  return NextResponse.json({ success: true });
}
