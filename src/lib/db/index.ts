import { Pool } from "pg";
import fs from "fs";
import path from "path";

// PostgreSQL connection pool singleton
let pool: Pool;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/speedtrail",
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

// Run a query — convenience wrapper
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = getPool();
  const result = await client.query(sql, params);
  return result.rows as T[];
}

// Run a query returning a single row
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

// Initialize schema + seed
export async function initDb(): Promise<void> {
  const pool = getPool();

  // Run schema
  const schemaPath = path.join(process.cwd(), "src", "lib", "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  const client = await pool.connect();
  try {
    await client.query(schema);
    await seedIfEmpty(client);
  } finally {
    client.release();
  }
}

async function seedIfEmpty(client: import("pg").PoolClient): Promise<void> {
  const { rows } = await client.query("SELECT COUNT(*)::int as c FROM groups");
  if (rows[0].c > 0) return;

  // Create group
  const { rows: [group] } = await client.query(
    "INSERT INTO groups (name, home_currency) VALUES ($1, $2) RETURNING id",
    ["The Flat", "INR"]
  );
  const groupId = group.id;

  // Members
  const members = [
    { name: "Aisha", email: "aisha@flat.com", is_guest: false },
    { name: "Rohan", email: "rohan@flat.com", is_guest: false },
    { name: "Priya", email: "priya@flat.com", is_guest: false },
    { name: "Meera", email: "meera@flat.com", is_guest: false },
    { name: "Sam", email: "sam@flat.com", is_guest: false },
    { name: "Dev", email: "dev@flat.com", is_guest: true },
    { name: "Dev's friend Kabir", email: null, is_guest: true },
  ];

  const memberIds: Record<string, number> = {};
  for (const m of members) {
    const { rows: [row] } = await client.query(
      "INSERT INTO members (name, email, is_guest) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET email = EXCLUDED.email RETURNING id",
      [m.name, m.email, m.is_guest]
    );
    memberIds[m.name] = row.id;
  }

  // Memberships (time-aware)
  const memberships = [
    { name: "Aisha",  joined: "2026-02-01", left: null },
    { name: "Rohan",  joined: "2026-02-01", left: null },
    { name: "Priya",  joined: "2026-02-01", left: null },
    { name: "Meera",  joined: "2026-02-01", left: "2026-03-31" },
    { name: "Sam",    joined: "2026-04-08", left: null },
  ];

  for (const m of memberships) {
    await client.query(
      "INSERT INTO group_memberships (group_id, member_id, joined_at, left_at) VALUES ($1, $2, $3, $4)",
      [groupId, memberIds[m.name], m.joined, m.left]
    );
  }
}

export default getPool;
