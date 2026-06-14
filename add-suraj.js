import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:Suraj@123@localhost:5433/speedtrail"
});

async function run() {
  try {
    const res = await pool.query(
      "INSERT INTO members (name, email, is_guest) VALUES ($1, $2, FALSE) ON CONFLICT (name) DO NOTHING RETURNING *",
      ["Suraj", "suraj@flat.com"]
    );
    console.log("Added Suraj:", res.rows);
    
    const member = await pool.query("SELECT id FROM members WHERE name = 'Suraj'");
    if (member.rows.length > 0) {
      await pool.query(
        "INSERT INTO group_memberships (group_id, member_id, joined_at) VALUES (1, $1, '2026-05-01') ON CONFLICT DO NOTHING",
        [member.rows[0].id]
      );
      console.log("Added Suraj to Group 1");
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
