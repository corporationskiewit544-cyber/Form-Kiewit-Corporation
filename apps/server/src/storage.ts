import { pool } from "./db.js";
import type { Submission } from "./types.js";

/**
 * Postgres-backed store. Typed columns exist for querying/reporting, but reads
 * return the `raw` JSONB column, which holds the complete submission object.
 */

export async function saveSubmission(s: Submission): Promise<void> {
  await pool.query(
    `INSERT INTO submissions
       (id, submitted_at, full_name, email, phone, company, experience, notice,
        current_ctc, expected_ctc, linkedin, portfolio, cover_letter, resume, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      s.id,
      s.submittedAt,
      s.fullName,
      s.email,
      s.phone,
      s.company,
      s.experience,
      s.notice,
      s.currentCtc,
      s.expectedCtc,
      s.linkedin,
      s.portfolio,
      s.coverLetter,
      s.resume ? JSON.stringify(s.resume) : null,
      JSON.stringify(s),
    ],
  );
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const { rows } = await pool.query<{ raw: Submission }>(
    "SELECT raw FROM submissions WHERE id = $1",
    [id],
  );
  return rows[0]?.raw ?? null;
}

export async function listSubmissions(): Promise<Submission[]> {
  const { rows } = await pool.query<{ raw: Submission }>(
    "SELECT raw FROM submissions ORDER BY submitted_at DESC",
  );
  return rows.map((r) => r.raw);
}

export async function deleteSubmission(id: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM submissions WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
