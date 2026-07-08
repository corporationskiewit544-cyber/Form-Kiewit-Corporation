import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import multer from "multer";
import { config } from "./config.js";
import { getResumeStream, initMinio, putResume, removeResume } from "./minio.js";
import {
  deleteSubmission,
  getSubmission,
  initStorage,
  listSubmissions,
  saveSubmission,
} from "./storage.js";
import type { Submission } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes },
});

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_EXT = [".pdf", ".doc", ".docx"];
const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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
  "portfolio",
  "coverLetter",
] as const;

/** Server-side field validation mirroring the client. Returns { field: message }. */
function validateFields(b: Record<string, string>): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const f of REQUIRED_FIELDS) {
    if (!str(b[f])) errs[f] = "This field is required.";
  }
  if (str(b.email) && !EMAIL_RE.test(str(b.email))) errs.email = "Invalid email address.";
  const digits = (str(b.phone).match(/\d/g) ?? []).length;
  if (str(b.phone) && (digits < 7 || digits > 15)) errs.phone = "Invalid phone number.";
  if (str(b.linkedin) && !isUrl(str(b.linkedin))) errs.linkedin = "Invalid URL.";
  if (str(b.portfolio) && !isUrl(str(b.portfolio))) errs.portfolio = "Invalid URL.";
  return errs;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --- Create an application ------------------------------------------------
app.post("/api/applications", upload.single("resume"), async (req, res) => {
  try {
    const body = req.body as Record<string, string>;

    const fieldErrors = validateFields(body);
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        error: "Please correct the highlighted fields.",
        fields: fieldErrors,
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Resume file is required." });
    }
    const ext = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf("."));
    if (!ALLOWED_EXT.includes(ext) && !ALLOWED_MIME.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Resume must be a PDF, DOC, or DOCX file." });
    }

    const id = randomUUID();
    const objectKey = `${id}/${req.file.originalname}`;
    await putResume(objectKey, req.file.buffer, req.file.mimetype);

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
      portfolio: str(body.portfolio),
      coverLetter: str(body.coverLetter),
      resume: {
        objectKey,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
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

// --- Download / view the resume ------------------------------------------
app.get("/api/applications/:id/resume", async (req, res) => {
  const submission = await getSubmission(req.params.id);
  if (!submission?.resume) return res.status(404).json({ error: "Resume not found." });

  const { originalName, mimeType, objectKey } = submission.resume;
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  try {
    const stream = await getResumeStream(objectKey);
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${encodeURIComponent(originalName)}"`,
    );
    stream.on("error", () => res.status(500).end());
    stream.pipe(res);
  } catch (err) {
    console.error("[applications] resume fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch resume." });
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

// Multer / generic error handler (e.g. file too large).
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File exceeds the 10MB limit." : err.message;
    return res.status(400).json({ error: msg });
  }
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

async function main() {
  await initStorage();
  await initMinio();
  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
