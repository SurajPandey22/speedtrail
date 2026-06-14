import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const groupId = parseInt(searchParams.get("groupId") || "1");

  const rows = await query(`
    SELECT s.*,
      p.name AS payer_name,
      r.name AS payee_name
    FROM settlements s
    JOIN members p ON p.id = s.payer_member_id
    JOIN members r ON r.id = s.payee_member_id
    WHERE s.group_id = $1
    ORDER BY s.settled_at DESC
  `, [groupId]);

  return NextResponse.json(rows.map(r => {
    const row = r as Record<string, unknown>;
    return { ...row, amount: Number(row.amount) };
  }));
}

export async function POST(req: NextRequest) {
  await initDb();
  const body = await req.json();
  const { groupId = 1, payerMemberId, payeeMemberId, amount, settledAt, notes = "" } = body;

  if (!payerMemberId || !payeeMemberId || !amount || !settledAt)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  if (payerMemberId === payeeMemberId)
    return NextResponse.json({ error: "Cannot settle with yourself" }, { status: 400 });
  if (amount <= 0)
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });

  const rows = await query(`
    INSERT INTO settlements (group_id, payer_member_id, payee_member_id, amount, settled_at, notes)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [groupId, payerMemberId, payeeMemberId, amount, settledAt, notes]);

  return NextResponse.json({ id: (rows[0] as { id: number }).id }, { status: 201 });
}
