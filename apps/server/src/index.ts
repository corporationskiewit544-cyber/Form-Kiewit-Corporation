import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { initDb } from "./db.js";
import {
  initMinio,
  presignDownload,
  presignUpload,
  removeResume,
  statResume,
} from "./minio.js";
import {
  deleteSubmission,
  getSubmission,
  listSubmissions,
  saveSubmission,
} from "./storage.js";
import type { Submission } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_EXT = [".pdf", ".doc", ".docx"];
const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const extOf = (name: string) => name.toLowerCase().slice(name.lastIndexOf("."));
const isUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const REQUIRED_FIELDS = [
  "fullName",
  "email",
  "phone",
  "company",
  "experience",
  "notice",
  "currentCtc",
  "expectedCtc",
  "linkedin",
  "coverLetter",
] as const;

/** Server-side field validation mirroring the client. Returns { field: message }. */
function validateFields(b: Record<string, unknown>): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const f of REQUIRED_FIELDS) {
    if (!str(b[f])) errs[f] = "This field is required.";
  }
  if (str(b.email) && !EMAIL_RE.test(str(b.email))) errs.email = "Invalid email address.";
  const digits = (str(b.phone).match(/\d/g) ?? []).length;
  if (str(b.phone) && (digits < 7 || digits > 15)) errs.phone = "Invalid phone number.";
  if (str(b.linkedin) && !isUrl(str(b.linkedin))) errs.linkedin = "Invalid URL.";
  return errs;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --- Step 1: hand the browser a presigned URL to upload the resume to MinIO -
app.post("/api/uploads/presign", async (req, res) => {
  try {
    const filename = str(req.body?.filename);
    const contentType = str(req.body?.contentType);
    console.log(`[uploads] presign request: filename="${filename}", contentType="${contentType}"`);

    if (!filename) {
      console.log("[uploads] presign validation failed: filename is required");
      return res.status(400).json({ error: "filename is required." });
    }

    const ext = extOf(filename);
    if (!ALLOWED_EXT.includes(ext) && !ALLOWED_MIME.includes(contentType)) {
      console.log(`[uploads] presign validation failed: disallowed extension "${ext}" or content type "${contentType}"`);
      return res.status(400).json({ error: "Resume must be a PDF, DOC, or DOCX file." });
    }

    // Sanitise the name and give each upload a unique prefix.
    const safeName = filename.replace(/[^\w.\-]+/g, "_").slice(-120);
    const objectKey = `resumes/${randomUUID()}/${safeName}`;
    console.log(`[uploads] presign generated objectKey: ${objectKey}`);

    console.log("[uploads] presign calling presignUpload...");
    const start = Date.now();
    const url = await presignUpload(objectKey);
    const duration = Date.now() - start;
    console.log(`[uploads] presignUpload completed in ${duration}ms (url length=${url.length})`);

    res.json({ url, objectKey, expiresIn: config.presignExpirySeconds });
  } catch (err) {
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[uploads] presign failed:", err);
    if (stack) console.error("[uploads] presign error stack:", stack);
    res.status(500).json({ error: "Could not create upload URL." });
  }
});

// --- Step 2: create the application (JSON), referencing the uploaded object --
app.post("/api/applications", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const fieldErrors = validateFields(body);
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        error: "Please correct the highlighted fields.",
        fields: fieldErrors,
      });
    }

    const resumeIn = body.resume as
      | { objectKey?: string; originalName?: string; mimeType?: string }
      | undefined;
    const objectKey = str(resumeIn?.objectKey);
    const originalName = str(resumeIn?.originalName);
    if (!objectKey || !originalName) {
      return res.status(400).json({ error: "Resume is required." });
    }
    if (!objectKey.startsWith("resumes/")) {
      return res.status(400).json({ error: "Invalid resume reference." });
    }

    // Confirm the object was actually uploaded, and read its true size/type.
    let size: number;
    let mimeType: string;
    try {
      const stat = await statResume(objectKey);
      size = stat.size;
      mimeType = str(resumeIn?.mimeType) || stat.mimeType;
    } catch {
      return res.status(400).json({ error: "Resume upload not found. Please re-upload." });
    }
    if (size > config.maxUploadBytes) {
      await removeResume(objectKey).catch(() => {});
      return res.status(400).json({ error: "Resume exceeds the 10MB limit." });
    }

    const id = randomUUID();
    const submission: Submission = {
      id,
      submittedAt: new Date().toISOString(),
      fullName: str(body.fullName),
      email: str(body.email),
      phone: str(body.phone),
      company: str(body.company),
      experience: str(body.experience),
      notice: str(body.notice),
      currentCtc: str(body.currentCtc),
      expectedCtc: str(body.expectedCtc),
      linkedin: str(body.linkedin),
      coverLetter: str(body.coverLetter),
      resume: { objectKey, originalName, mimeType, size },
      meta: {
        ip: req.ip ?? "",
        userAgent: str(req.get("user-agent")),
      },
    };

    await saveSubmission(submission);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error("[applications] create failed:", err);
    res.status(500).json({ error: "Failed to save application." });
  }
});

// --- List applications ----------------------------------------------------
app.get("/api/applications", async (_req, res) => {
  try {
    res.json(await listSubmissions());
  } catch (err) {
    console.error("[applications] list failed:", err);
    res.status(500).json({ error: "Failed to list applications." });
  }
});

// --- Single application ---------------------------------------------------
app.get("/api/applications/:id", async (req, res) => {
  const submission = await getSubmission(req.params.id);
  if (!submission) return res.status(404).json({ error: "Not found." });
  res.json(submission);
});

// --- View / download the resume (redirect to a presigned GET URL) --------
app.get("/api/applications/:id/resume", async (req, res) => {
  const submission = await getSubmission(req.params.id);
  if (!submission?.resume) return res.status(404).json({ error: "Resume not found." });
  try {
    const url = await presignDownload(submission.resume.objectKey, {
      fileName: submission.resume.originalName,
      mimeType: submission.resume.mimeType,
      download: req.query.download === "1",
    });
    res.redirect(url);
  } catch (err) {
    console.error("[applications] resume presign failed:", err);
    res.status(500).json({ error: "Failed to build resume link." });
  }
});

// --- Delete an application ------------------------------------------------
app.delete("/api/applications/:id", async (req, res) => {
  const submission = await getSubmission(req.params.id);
  if (!submission) return res.status(404).json({ error: "Not found." });
  try {
    if (submission.resume) await removeResume(submission.resume.objectKey).catch(() => {});
    await deleteSubmission(submission.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[applications] delete failed:", err);
    res.status(500).json({ error: "Failed to delete application." });
  }
});

async function main() {
  await initDb();
  await initMinio();
  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
