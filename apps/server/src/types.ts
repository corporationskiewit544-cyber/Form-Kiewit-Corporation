export interface ResumeMeta {
  /** Object key inside the MinIO bucket. */
  objectKey: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/** A single job application submission, persisted as one JSON file. */
export interface Submission {
  id: string;
  submittedAt: string; // ISO timestamp

  // Personal Information
  fullName: string;
  email: string;
  phone: string;

  // Professional Details
  company: string;
  experience: string;
  notice: string;

  // Compensation
  currentCtc: string;
  expectedCtc: string;

  // Additional
  linkedin: string;
  coverLetter: string;

  resume: ResumeMeta | null;

  // Lightweight request context (handy in the dashboard).
  meta: {
    ip: string;
    userAgent: string;
  };
}
