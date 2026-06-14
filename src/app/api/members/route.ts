import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, initDb } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const emailCheck = searchParams.get("email");

  // If ?email= param provided, check existence only
  if (emailCheck) {
    const found = await queryOne("SELECT id FROM members WHERE email = $1", [emailCheck]);
    return NextResponse.json({ exists: !!found });
  }

  const members = await query(`
    SELECT m.id, m.name, m.email, m.is_guest,
      gm.joined_at, gm.left_at, gm.group_id
    FROM members m
    LEFT JOIN group_memberships gm ON gm.member_id = m.id
    ORDER BY m.name
  `);
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  await initDb();
  const body = await req.json();
  const { name, email, password } = body;
  if (!name || !email || !password)
    return NextResponse.json({ error: "name, email, password required" }, { status: 400 });

  const existing = await queryOne("SELECT id FROM members WHERE email = $1", [email]);
  if (existing)
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const hash = await bcrypt.hash(password, 10);

  // Try to update existing seeded member first (by name)
  const rows = await query(
    "UPDATE members SET email = $1, password_hash = $2 WHERE name = $3 AND password_hash IS NULL RETURNING id, name, email",
    [email, hash, name]
  );
  if (rows.length > 0) return NextResponse.json(rows[0], { status: 201 });

  const inserted = await query(
    "INSERT INTO members (name, email, password_hash, is_guest) VALUES ($1, $2, $3, FALSE) RETURNING id, name, email",
    [name, email, hash]
  );
  return NextResponse.json(inserted[0], { status: 201 });
}
