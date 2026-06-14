import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { parseCSV, detectAnomalies } from "@/lib/importer";

export async function POST(req: NextRequest) {
  await initDb();
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const usdRate = parseFloat((formData.get("usdRate") as string) || "83.5");
  const groupId = parseInt((formData.get("groupId") as string) || "1");

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const content = await file.text();
  let rows;
  try {
    rows = parseCSV(content);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  const parsed = detectAnomalies(rows, usdRate);

  // Create import session
  const sessions = await query<{ id: number }>(`
    INSERT INTO import_sessions (group_id, filename, usd_to_inr_rate, status, total_rows)
    VALUES ($1,$2,$3,'reviewing',$4) RETURNING id
  `, [groupId, file.name, usdRate, rows.length]);

  const sessionId = sessions[0].id;

  // Persist anomalies
  for (const p of parsed) {
    for (const a of p.anomalies) {
      const rawRow = rows.find((r) => r.rowIndex === a.rowIndex) || {};
      await query(`
        INSERT INTO import_anomalies
          (session_id, row_index, raw_row, anomaly_type, description, suggested_action)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [sessionId, a.rowIndex, JSON.stringify(rawRow), a.type, a.description, a.suggestedAction])
        .catch(() => {}); // non-blocking
    }
  }

  return NextResponse.json({
    sessionId,
    totalRows: rows.length,
    anomalyCount: parsed.reduce((n, p) => n + p.anomalies.length, 0),
    parsed: parsed.map((p) => ({
      rowIndex: p.rowIndex,
      date: p.date,
      description: p.description,
      paidByName: p.paidByName,
      amount: p.amount,
      originalAmount: p.originalAmount,
      originalCurrency: p.originalCurrency,
      exchangeRate: p.exchangeRate,
      splitType: p.splitType,
      splitWith: p.splitWith,
      splitDetails: p.splitDetails,
      isRefund: p.isRefund,
      isSettlement: p.isSettlement,
      notes: p.notes,
      anomalies: p.anomalies,
      hasAnomalies: p.anomalies.length > 0,
    })),
  });
}

export async function GET(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const sessions = await query("SELECT * FROM import_sessions WHERE id = $1", [parseInt(sessionId)]);
  const anomalies = await query(
    "SELECT * FROM import_anomalies WHERE session_id = $1 ORDER BY row_index",
    [parseInt(sessionId)]
  );

  return NextResponse.json({ session: sessions[0] || null, anomalies });
}
