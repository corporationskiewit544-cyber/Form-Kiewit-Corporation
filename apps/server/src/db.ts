import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.databaseUrl });

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS submissions (
    id            UUID PRIMARY KEY,
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    full_name     TEXT NOT NULL,
    email         TEXT NOT NULL,
    phone         TEXT NOT NULL,
    company       TEXT NOT NULL,
    experience    TEXT NOT NULL,
    notice        TEXT NOT NULL,
    current_ctc   TEXT NOT NULL,
    expected_ctc  TEXT NOT NULL,
    linkedin      TEXT,
    portfolio     TEXT,
    cover_letter  TEXT,
    resume        JSONB,
    -- Full submission object, stored verbatim as JSON (the "save as JSON" requirement).
    raw           JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS submissions_submitted_at_idx ON submissions (submitted_at DESC);
`;

/** Connect (with retry, for Docker startup ordering) and ensure the schema exists. */
export async function initDb(retries = 15, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      await pool.query(CREATE_TABLE);
      console.log("[db] connected and schema ready");
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[db] not ready (attempt ${attempt}/${retries}): ${msg}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
