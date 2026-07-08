import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import type { Submission } from "./types.js";

/**
 * Dead-simple JSON store: every submission is written as its own
 * `<id>.json` file inside DATA_DIR. No database required — the folder
 * of JSON files *is* the database, which is easy to back up and inspect.
 */

export async function initStorage(): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true });
}

function fileFor(id: string): string {
  return path.join(config.dataDir, `${id}.json`);
}

export async function saveSubmission(submission: Submission): Promise<void> {
  await fs.writeFile(fileFor(submission.id), JSON.stringify(submission, null, 2), "utf8");
}

export async function getSubmission(id: string): Promise<Submission | null> {
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    return JSON.parse(raw) as Submission;
  } catch {
    return null;
  }
}

export async function listSubmissions(): Promise<Submission[]> {
  const entries = await fs.readdir(config.dataDir);
  const files = entries.filter((f) => f.endsWith(".json"));

  const results = await Promise.all(
    files.map(async (f) => {
      try {
        return JSON.parse(await fs.readFile(path.join(config.dataDir, f), "utf8")) as Submission;
      } catch {
        return null;
      }
    }),
  );

  return results
    .filter((s): s is Submission => s !== null)
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)); // newest first
}

export async function deleteSubmission(id: string): Promise<boolean> {
  try {
    await fs.unlink(fileFor(id));
    return true;
  } catch {
    return false;
  }
}
