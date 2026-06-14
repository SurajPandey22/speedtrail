/**
 * Balance computation engine for SpeedTrail.
 *
 * Key design decisions:
 * - All amounts stored and computed in INR (home currency)
 * - USD expenses are converted at the rate stored at import time
 * - Settlements subtract from balances, not from expenses
 * - Debt simplification uses greedy algorithm (O(n log n))
 * - fromDate filter enables Sam's requirement: "why would March affect my balance?"
 */
import { query } from "@/lib/db";

export interface MemberBalance {
  memberId: number;
  memberName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positive = is owed money; negative = owes money
}

export interface SettlementSuggestion {
  fromMemberId: number;
  fromName: string;
  toMemberId: number;
  toName: string;
  amount: number;
}

export interface ExpenseContribution {
  expenseId: number;
  description: string;
  date: string;
  paidByName: string;
  paidByMemberId: number;
  totalAmount: number;
  yourShare: number;
  currency: string;
  originalAmount: number;
  exchangeRate: number;
}

export async function computeBalances(
  groupId: number,
  fromDate?: string
): Promise<MemberBalance[]> {
  // Build the expense splits query
  const dateFilter = fromDate ? `AND e.expense_date >= $2` : "";
  const params: unknown[] = [groupId];
  if (fromDate) params.push(fromDate);

  const rows = await query<{
    paid_by_member_id: number;
    paid_by_name: string;
    total_amount: number;
    member_id: number;
    member_name: string;
    share_amount: number;
  }>(`
    SELECT
      e.paid_by_member_id,
      pm.name AS paid_by_name,
      e.amount AS total_amount,
      es.member_id,
      m.name AS member_name,
      es.share_amount
    FROM expenses e
    JOIN expense_splits es ON es.expense_id = e.id
    JOIN members m ON m.id = es.member_id
    JOIN members pm ON pm.id = e.paid_by_member_id
    WHERE e.group_id = $1
      AND e.is_settlement = FALSE
      ${dateFilter}
  `, params);

  const balanceMap = new Map<number, { name: string; paid: number; owed: number }>();

  for (const row of rows) {
    if (!balanceMap.has(row.paid_by_member_id)) {
      balanceMap.set(row.paid_by_member_id, { name: row.paid_by_name, paid: 0, owed: 0 });
    }
    balanceMap.get(row.paid_by_member_id)!.paid += Number(row.total_amount);

    if (!balanceMap.has(row.member_id)) {
      balanceMap.set(row.member_id, { name: row.member_name, paid: 0, owed: 0 });
    }
    balanceMap.get(row.member_id)!.owed += Number(row.share_amount);
  }

  // Apply settlements
  const settlementParams: unknown[] = [groupId];
  if (fromDate) settlementParams.push(fromDate);

  const settlements = await query<{
    payer_member_id: number;
    payee_member_id: number;
    amount: number;
  }>(`
    SELECT payer_member_id, payee_member_id, amount
    FROM settlements
    WHERE group_id = $1
    ${fromDate ? "AND settled_at >= $2" : ""}
  `, settlementParams);

  for (const s of settlements) {
    if (!balanceMap.has(s.payer_member_id)) {
      balanceMap.set(s.payer_member_id, { name: "", paid: 0, owed: 0 });
    }
    // Payer reduces their owed amount
    balanceMap.get(s.payer_member_id)!.owed -= Number(s.amount);

    if (!balanceMap.has(s.payee_member_id)) {
      balanceMap.set(s.payee_member_id, { name: "", paid: 0, owed: 0 });
    }
    // Payee reduces their paid amount
    balanceMap.get(s.payee_member_id)!.paid -= Number(s.amount);
  }

  return Array.from(balanceMap.entries()).map(([memberId, b]) => ({
    memberId,
    memberName: b.name,
    totalPaid: round2(b.paid),
    totalOwed: round2(b.owed),
    netBalance: round2(b.paid - b.owed),
  }));
}

/**
 * Greedy debt simplification.
 * Minimizes number of transactions to settle all debts.
 * O(n log n) — sort creditors/debtors by amount, match greedily.
 */
export function simplifyDebts(balances: MemberBalance[]): SettlementSuggestion[] {
  const creditors = balances
    .filter((b) => b.netBalance > 0.005)
    .map((b) => ({ ...b, amount: b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((b) => b.netBalance < -0.005)
    .map((b) => ({ ...b, amount: -b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const suggestions: SettlementSuggestion[] = [];
  let ci = 0, di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);

    suggestions.push({
      fromMemberId: debtor.memberId,
      fromName: debtor.memberName,
      toMemberId: creditor.memberId,
      toName: creditor.memberName,
      amount: round2(amount),
    });

    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount < 0.005) ci++;
    if (debtor.amount < 0.005) di++;
  }

  return suggestions;
}

export async function getMemberExpenseBreakdown(
  groupId: number,
  memberId: number,
  fromDate?: string
): Promise<ExpenseContribution[]> {
  const params: unknown[] = [memberId, groupId];
  if (fromDate) params.push(fromDate);

  return query<ExpenseContribution>(`
    SELECT
      e.id AS "expenseId",
      e.description,
      e.expense_date AS date,
      pm.name AS "paidByName",
      e.paid_by_member_id AS "paidByMemberId",
      e.amount AS "totalAmount",
      es.share_amount AS "yourShare",
      e.original_currency AS currency,
      e.original_amount AS "originalAmount",
      e.exchange_rate AS "exchangeRate"
    FROM expenses e
    JOIN expense_splits es ON es.expense_id = e.id AND es.member_id = $1
    JOIN members pm ON pm.id = e.paid_by_member_id
    WHERE e.group_id = $2
      AND e.is_settlement = FALSE
      ${fromDate ? "AND e.expense_date >= $3" : ""}
    ORDER BY e.expense_date DESC
  `, params);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
