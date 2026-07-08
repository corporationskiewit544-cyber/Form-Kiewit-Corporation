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
  portfolio: string;
  coverLetter: string;
  resume: ResumeMeta | null;
  meta: { ip: string; userAgent: string };
}

export async function submitApplication(form: FormData): Promise<{ ok: true; id: string }> {
  const res = await fetch("/api/applications", { method: "POST", body: form });
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
