import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  await initDb();
  const body = await req.json();
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
  }

  // Only allow @flat.com emails
  if (!email.toLowerCase().endsWith("@flat.com")) {
    return NextResponse.json(
      { error: "Only @flat.com email addresses are allowed to register." },
      { status: 403 }
    );
  }

  // Check if email already exists
  const existing = await query<{ id: number }>(
    "SELECT id FROM members WHERE email = $1",
    [email]
  );
  if (existing.length > 0) {
    return NextResponse.json({ error: "An account with this email already exists. Please log in." }, { status: 409 });
  }

  // Hash password
  const password_hash = await bcrypt.hash(password, 10);

  // Insert new member
  const newMembers = await query<{ id: number }>(
    `INSERT INTO members (name, email, password_hash, is_guest)
     VALUES ($1, $2, $3, FALSE)
     RETURNING id`,
    [name, email, password_hash]
  );
  const memberId = newMembers[0].id;

  // Add them to group 1 (The Flat) with today as joined_at
  const today = new Date().toISOString().slice(0, 10);
  await query(
    `INSERT INTO group_memberships (group_id, member_id, joined_at)
     VALUES (1, $1, $2)
     ON CONFLICT DO NOTHING`,
    [memberId, today]
  );

  return NextResponse.json({ success: true, memberId }, { status: 201 });
}
