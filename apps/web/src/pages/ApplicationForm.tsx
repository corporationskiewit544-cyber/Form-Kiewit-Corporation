import {
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  IndianRupee,
  Linkedin,
  Loader2,
  Mail,
  Phone,
  UploadCloud,
  User,
  X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useRef, useState } from "react";
import { presignResume, submitApplication, uploadToStorage } from "../lib/api";

const EXPERIENCE = ["0-1", "1-3", "3-5", "5-7", "7-10", "10+"];
const NOTICE = ["Immediate", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"];

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = [".pdf", ".doc", ".docx"];

const FIELD_NAMES = [
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

// ---------------------------------------------------------------- validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns an error message for a field, or "" when it's valid. */
function fieldError(name: string, raw: string): string {
  const v = raw.trim();
  switch (name) {
    case "fullName":
      if (!v) return "Full name is required.";
      if (v.length < 2) return "Please enter your full name.";
      return "";
    case "email":
      if (!v) return "Email address is required.";
      if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
      return "";
    case "phone": {
      if (!v) return "Phone number is required.";
      const digits = (v.match(/\d/g) ?? []).length;
      if (digits < 7 || digits > 15) return "Enter a valid phone number.";
      return "";
    }
    case "company":
      if (!v) return "Current company is required.";
      return "";
    case "experience":
      if (!v) return "Please select your experience.";
      return "";
    case "notice":
      if (!v) return "Please select your notice period.";
      return "";
    case "currentCtc":
      if (!v) return "Current CTC is required.";
      return "";
    case "expectedCtc":
      if (!v) return "Expected CTC is required.";
      return "";
    case "linkedin":
      if (!v) return "LinkedIn profile is required.";
      if (!isValidUrl(v)) return "Enter a valid URL (https://…).";
      if (!/linkedin\./i.test(v)) return "Enter a LinkedIn profile URL.";
      return "";
    case "coverLetter":
      if (!v) return "Cover letter is required.";
      if (v.length < 10) return "Please add a little more detail.";
      return "";
    default:
      return "";
  }
}

function fileError(f: File | null): string {
  if (!f) return "Please attach your resume / CV.";
  if (!ALLOWED_EXT.some((ext) => f.name.toLowerCase().endsWith(ext)))
    return "Resume must be a PDF, DOC, or DOCX file.";
  if (f.size > MAX_BYTES) return "Resume exceeds the 10MB limit.";
  return "";
}

type Errors = Partial<Record<string, string>>;

// ---------------------------------------------------------------- primitives
const inputBase =
  "block w-full rounded-lg border bg-gray-50 p-2.5 pl-10 text-sm text-gray-900 " +
  "placeholder:text-gray-400 outline-none transition-colors";
const inputOk = "border-gray-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500";
const inputBad = "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500";

const controlClass = (invalid: boolean, extra = "") =>
  `${inputBase} ${invalid ? inputBad : inputOk} ${extra}`;

function Field({
  label,
  htmlFor,
  required,
  error,
  className = "",
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-brand-600"> *</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TextInput({
  icon,
  invalid,
  ...props
}: { icon: ReactNode; invalid?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span
        className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${
          invalid ? "text-red-400" : "text-gray-400"
        }`}
      >
        {icon}
      </span>
      <input {...props} aria-invalid={invalid} className={controlClass(!!invalid)} />
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">
      <span className="text-brand-600">{icon}</span>
      {title}
    </h3>
  );
}

function Chevron() {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ------------------------------------------------------------------- screen
export default function ApplicationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setErr = useCallback((name: string, msg: string) => {
    setErrors((prev) => {
      if ((prev[name] ?? "") === msg) return prev;
      return { ...prev, [name]: msg };
    });
  }, []);

  const acceptFile = useCallback(
    (f: File | undefined | null) => {
      if (!f) return;
      const msg = fileError(f);
      setErr("resume", msg);
      if (!msg) setFile(f);
    },
    [setErr],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      acceptFile(e.dataTransfer.files?.[0]);
    },
    [acceptFile],
  );

  function handleFocus(e: React.FocusEvent<HTMLFormElement>) {
    const el = e.target as unknown as HTMLInputElement | HTMLSelectElement;
    if (el?.name && errors[el.name]) setErr(el.name, "");
  }

  function handleChange(e: React.FormEvent<HTMLFormElement>) {
    const el = e.target as unknown as HTMLInputElement | HTMLSelectElement;
    if (el?.name && errors[el.name]) setErr(el.name, "");
  }

  function handleBlur(e: React.FocusEvent<HTMLFormElement>) {
    const el = e.target as unknown as HTMLInputElement | HTMLSelectElement;
    if (el?.name && (FIELD_NAMES as readonly string[]).includes(el.name)) {
      setErr(el.name, fieldError(el.name, el.value));
    }
  }

  function validateAll(): Errors {
    const fd = new FormData(formRef.current!);
    const next: Errors = {};
    for (const name of FIELD_NAMES) {
      const msg = fieldError(name, String(fd.get(name) ?? ""));
      if (msg) next[name] = msg;
    }
    const fMsg = fileError(file);
    if (fMsg) next.resume = fMsg;
    return next;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    const found = validateAll();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const firstBad = [...FIELD_NAMES, "resume"].find((n) => found[n]);
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }

    const resumeFile = file as File;
    setSubmitting(true);
    try {
      // 1) upload the resume straight to MinIO via a presigned URL
      const { url, objectKey } = await presignResume(resumeFile);
      await uploadToStorage(url, resumeFile);

      // 2) submit the rest of the form as JSON, referencing the uploaded object
      //    (use the ref, not e.currentTarget — React nulls it after the await above)
      const fd = new FormData(formRef.current!);
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      await submitApplication({
        fullName: get("fullName"),
        email: get("email"),
        phone: get("phone"),
        company: get("company"),
        experience: get("experience"),
        notice: get("notice"),
        currentCtc: get("currentCtc"),
        expectedCtc: get("expectedCtc"),
        linkedin: get("linkedin"),
        coverLetter: get("coverLetter"),
        resume: {
          objectKey,
          originalName: resumeFile.name,
          mimeType: resumeFile.type || "application/octet-stream",
        },
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSubmitted(false);
    setFile(null);
    setErrors({});
    setSubmitError(null);
    formRef.current?.reset();
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full overflow-hidden bg-black">
              <img src="/logo.png" alt="Kiewit" className="h-full w-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Kiewit Corporation
            </h1>
          </div>
          <p className="text-gray-500">Join our engineering and construction team</p>
        </header>

        {submitted ? (
          <div className="rounded-lg border border-gray-200 border-t-4 border-t-brand-500 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">Application Submitted</h2>
            <p className="mx-auto mb-6 max-w-md text-sm text-gray-500">
              Thank you for applying to Kiewit Corporation. Our talent acquisition team will review
              your profile and get back to you shortly.
            </p>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              Submit another application
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 border-t-4 border-t-brand-500 bg-white shadow-sm">
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onChange={handleChange}
              noValidate
              className="space-y-9 p-6 sm:p-8"
            >
              {/* Personal Information */}
              <section>
                <SectionHeader icon={<User className="h-5 w-5" />} title="Personal Information" />
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Field label="Full Name" htmlFor="fullName" required error={errors.fullName}>
                    <TextInput
                      icon={<User className="h-4 w-4" />}
                      invalid={!!errors.fullName}
                      id="fullName"
                      name="fullName"
                      placeholder="John Doe"
                    />
                  </Field>
                  <Field label="Email Address" htmlFor="email" required error={errors.email}>
                    <TextInput
                      icon={<Mail className="h-4 w-4" />}
                      invalid={!!errors.email}
                      id="email"
                      name="email"
                      type="email"
                      placeholder="john@example.com"
                    />
                  </Field>
                  <Field
                    label="Phone Number"
                    htmlFor="phone"
                    required
                    error={errors.phone}
                    className="md:col-span-2"
                  >
                    <TextInput
                      icon={<Phone className="h-4 w-4" />}
                      invalid={!!errors.phone}
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                    />
                  </Field>
                </div>
              </section>

              {/* Professional Details */}
              <section>
                <SectionHeader
                  icon={<Briefcase className="h-5 w-5" />}
                  title="Professional Details"
                />
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Field
                    label="Current Company"
                    htmlFor="company"
                    required
                    error={errors.company}
                    className="md:col-span-2"
                  >
                    <TextInput
                      icon={<Building2 className="h-4 w-4" />}
                      invalid={!!errors.company}
                      id="company"
                      name="company"
                      placeholder="Acme Corp"
                    />
                  </Field>
                  <Field
                    label="Years of Relevant Experience"
                    htmlFor="experience"
                    required
                    error={errors.experience}
                  >
                    <div className="relative">
                      <select
                        id="experience"
                        name="experience"
                        defaultValue=""
                        aria-invalid={!!errors.experience}
                        className={controlClass(!!errors.experience, "appearance-none pr-10")}
                      >
                        <option value="">Select experience</option>
                        {EXPERIENCE.map((v) => (
                          <option key={v} value={v}>
                            {v} Years
                          </option>
                        ))}
                      </select>
                      <span
                        className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${
                          errors.experience ? "text-red-400" : "text-gray-400"
                        }`}
                      >
                        <Briefcase className="h-4 w-4" />
                      </span>
                      <Chevron />
                    </div>
                  </Field>
                  <Field label="Notice Period" htmlFor="notice" required error={errors.notice}>
                    <div className="relative">
                      <select
                        id="notice"
                        name="notice"
                        defaultValue=""
                        aria-invalid={!!errors.notice}
                        className={controlClass(!!errors.notice, "appearance-none pr-10")}
                      >
                        <option value="">Select notice period</option>
                        {NOTICE.map((v) => (
                          <option key={v} value={v}>
                            {v === "Immediate" ? "Immediate / Serving Notice" : v}
                          </option>
                        ))}
                      </select>
                      <span
                        className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${
                          errors.notice ? "text-red-400" : "text-gray-400"
                        }`}
                      >
                        <Clock className="h-4 w-4" />
                      </span>
                      <Chevron />
                    </div>
                  </Field>
                </div>
              </section>

              {/* Compensation Details */}
              <section>
                <SectionHeader
                  icon={<IndianRupee className="h-5 w-5" />}
                  title="Compensation Details"
                />
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Field label="Current CTC" htmlFor="currentCtc" required error={errors.currentCtc}>
                    <TextInput
                      icon={<IndianRupee className="h-4 w-4" />}
                      invalid={!!errors.currentCtc}
                      id="currentCtc"
                      name="currentCtc"
                      placeholder="e.g. ₹15 LPA"
                    />
                  </Field>
                  <Field
                    label="Expected CTC"
                    htmlFor="expectedCtc"
                    required
                    error={errors.expectedCtc}
                  >
                    <TextInput
                      icon={<IndianRupee className="h-4 w-4" />}
                      invalid={!!errors.expectedCtc}
                      id="expectedCtc"
                      name="expectedCtc"
                      placeholder="e.g. ₹20 LPA"
                    />
                  </Field>
                </div>
              </section>

              {/* Resume & Additional Details */}
              <section>
                <SectionHeader
                  icon={<UploadCloud className="h-5 w-5" />}
                  title="Resume & Additional Details"
                />
                <div className="space-y-5">
                  <Field label="Resume / CV" required error={errors.resume}>
                    {file ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="h-5 w-5 shrink-0 text-gray-500" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                          aria-label="Remove file"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="resume"
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors ${
                          dragging
                            ? "border-brand-500 bg-brand-50"
                            : errors.resume
                              ? "border-red-400 bg-red-50/40"
                              : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <UploadCloud
                          className={`mb-2 h-10 w-10 ${errors.resume ? "text-red-300" : "text-gray-400"}`}
                        />
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-brand-600">Upload a file</span> or drag
                          and drop
                        </p>
                        <p className="mt-1 text-xs text-gray-400">PDF, DOC, DOCX up to 10MB</p>
                        <input
                          ref={fileInputRef}
                          id="resume"
                          name="resume"
                          type="file"
                          className="sr-only"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => acceptFile(e.target.files?.[0])}
                        />
                      </label>
                    )}
                  </Field>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field
                      label="LinkedIn Profile"
                      htmlFor="linkedin"
                      required
                      error={errors.linkedin}
                    >
                      <TextInput
                        icon={<Linkedin className="h-4 w-4" />}
                        invalid={!!errors.linkedin}
                        id="linkedin"
                        name="linkedin"
                        type="url"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </Field>
                  </div>

                  <Field
                    label="Cover Letter / Note"
                    htmlFor="coverLetter"
                    required
                    error={errors.coverLetter}
                  >
                    <div className="relative">
                      <span
                        className={`pointer-events-none absolute left-3 top-3 ${
                          errors.coverLetter ? "text-red-400" : "text-gray-400"
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                      </span>
                      <textarea
                        id="coverLetter"
                        name="coverLetter"
                        rows={4}
                        aria-invalid={!!errors.coverLetter}
                        placeholder="Tell us why you're a great fit for Kiewit..."
                        className={controlClass(!!errors.coverLetter, "resize-y")}
                      />
                    </div>
                  </Field>
                </div>
              </section>

              {submitError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-8 py-3 text-base font-semibold text-gray-900 transition-colors hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Submitting…
                  </>
                ) : (
                  "Submit Application"
                )}
              </button>
            </form>
          </div>
        )}

        <p className="mx-auto mt-6 max-w-xl text-center text-xs text-gray-400">
          By submitting this form, you acknowledge that Kiewit Corporation will process your data
          for recruitment purposes.
        </p>
      </div>
    </div>
  );
}
