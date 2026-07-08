export interface ResumeMeta {
  objectKey: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface Submission {
  id: string;
  submittedAt: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  experience: string;
  notice: string;
  currentCtc: string;
  expectedCtc: string;
  linkedin: string;
  coverLetter: string;
  resume: ResumeMeta | null;
  meta: { ip: string; userAgent: string };
}

export type ApplicationPayload = Omit<
  Submission,
  "id" | "submittedAt" | "resume" | "meta"
> & {
  resume: { objectKey: string; originalName: string; mimeType: string };
};

/** Ask the server for a presigned URL to upload the resume straight to MinIO. */
export async function presignResume(
  file: File,
): Promise<{ url: string; objectKey: string; expiresIn: number }> {
  const res = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not start the upload.");
  return data;
}

/** Upload the file directly to MinIO using the presigned PUT URL. */
export async function uploadToStorage(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: file.type ? { "Content-Type": file.type } : undefined,
    body: file,
  });
  if (!res.ok) throw new Error("Resume upload failed. Please try again.");
}

export async function submitApplication(
  payload: ApplicationPayload,
): Promise<{ ok: true; id: string }> {
  const res = await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Submission failed. Please try again.");
  return data;
}

export async function fetchApplications(): Promise<Submission[]> {
  const res = await fetch("/api/applications");
  if (!res.ok) throw new Error("Failed to load applications.");
  return res.json();
}

export async function deleteApplication(id: string): Promise<void> {
  const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete application.");
}

export const resumeUrl = (id: string, download = false) =>
  `/api/applications/${id}/resume${download ? "?download=1" : ""}`;
