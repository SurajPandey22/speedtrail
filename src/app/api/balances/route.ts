import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { computeBalances, simplifyDebts, getMemberExpenseBreakdown } from "@/lib/balances";

export async function GET(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const groupId = parseInt(searchParams.get("groupId") || "1");
  const fromDate = searchParams.get("fromDate") || undefined;
  const memberId = searchParams.get("memberId") ? parseInt(searchParams.get("memberId")!) : undefined;

  const groups = await query("SELECT * FROM groups WHERE id = $1", [groupId]);
  const group = groups[0];
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const balances = await computeBalances(groupId, fromDate);
  const suggestions = simplifyDebts(balances);

  let memberBreakdown = null;
  if (memberId) {
    memberBreakdown = await getMemberExpenseBreakdown(groupId, memberId, fromDate);
  }

  return NextResponse.json({ group, balances, suggestions, memberBreakdown, fromDate: fromDate || null });
}
