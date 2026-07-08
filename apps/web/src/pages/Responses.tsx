import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Inbox,
  IndianRupee,
  Linkedin,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteApplication,
  fetchApplications,
  resumeUrl,
  type Submission,
} from "../lib/api";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fullDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];
function avatarColor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function exportCsv(rows: Submission[]) {
  const cols: (keyof Submission)[] = [
    "submittedAt",
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
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `kiewit-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
        {icon}
      </span>
      <div>
        <p className="text-2xl font-bold leading-none text-gray-900">{value}</p>
        <p className="mt-1 text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function Responses() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSubs(await fetchApplications());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subs;
    return subs.filter((s) =>
      [s.fullName, s.email, s.phone, s.company, s.experience, s.notice]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [subs, query]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const thisWeek = subs.filter((s) => new Date(s.submittedAt).getTime() >= weekAgo).length;
    const senior = subs.filter((s) => ["5-7", "7-10", "10+"].includes(s.experience)).length;
    return { total: subs.length, thisWeek, senior };
  }, [subs]);

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await deleteApplication(id);
      setSubs((prev) => prev.filter((s) => s.id !== id));
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-lg font-black text-gray-900">
              K
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight text-gray-900 sm:text-base">
                Applications
              </h1>
              <p className="text-xs text-gray-500">Kiewit Corporation · Talent Acquisition</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => exportCsv(filtered)}
              disabled={!subs.length}
              className="hidden items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:flex"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Form
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile icon={<Users className="h-5 w-5" />} label="Total applications" value={stats.total} />
          <StatTile icon={<TrendingUp className="h-5 w-5" />} label="Last 7 days" value={stats.thisWeek} />
          <StatTile icon={<Briefcase className="h-5 w-5" />} label="Senior (5+ yrs)" value={stats.senior} />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, company…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-400 focus:ring-4 focus:ring-brand-400/15"
            />
          </div>
          <span className="hidden text-sm text-gray-500 sm:block">
            {filtered.length} of {subs.length}
          </span>
        </div>

        {/* States */}
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-24 text-gray-400">
            <Loader2 className="mb-3 h-8 w-8 animate-spin" />
            Loading applications…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-24 text-center">
            <Inbox className="mb-3 h-12 w-12 text-gray-300" />
            <p className="font-medium text-gray-700">
              {subs.length === 0 ? "No applications yet" : "No matches"}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {subs.length === 0
                ? "Submitted applications will appear here."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {/* Desktop table */}
            <div className="scroll-thin hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Candidate</th>
                    <th className="px-5 py-3 font-semibold">Company</th>
                    <th className="px-5 py-3 font-semibold">Experience</th>
                    <th className="px-5 py-3 font-semibold">Expected CTC</th>
                    <th className="px-5 py-3 font-semibold">Applied</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className="cursor-pointer transition-colors hover:bg-brand-50/50"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(s.fullName)}`}
                          >
                            {initials(s.fullName) || "?"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">{s.fullName}</p>
                            <p className="truncate text-xs text-gray-500">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">{s.company}</td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {s.experience} yrs
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">{s.expectedCtc}</td>
                      <td className="px-5 py-3.5 text-gray-500" title={fullDate(s.submittedAt)}>
                        {timeAgo(s.submittedAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <ExternalLink className="ml-auto h-4 w-4 text-gray-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-gray-50 md:hidden">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor(s.fullName)}`}
                  >
                    {initials(s.fullName) || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{s.fullName}</p>
                    <p className="truncate text-xs text-gray-500">
                      {s.company} · {s.experience} yrs
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{timeAgo(s.submittedAt)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Detail slide-over */}
      <AnimatePresence>
        {selected && (
          <DetailDrawer
            key={selected.id}
            submission={selected}
            onClose={() => setSelected(null)}
            onDelete={handleDelete}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="break-words text-sm text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function DetailDrawer({
  submission: s,
  onClose,
  onDelete,
  deleting,
}: {
  submission: Submission;
  onClose: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="scroll-thin relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
      >
        {/* header */}
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${avatarColor(s.fullName)}`}
              >
                {initials(s.fullName) || "?"}
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{s.fullName}</h2>
                <p className="text-xs text-gray-500">Applied {fullDate(s.submittedAt)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-4">
          {/* Resume */}
          {s.resume && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-700">
                  <FileText className="h-5 w-5" />
                </span>
                <p className="truncate text-sm font-medium text-gray-900">{s.resume.originalName}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <a
                  href={resumeUrl(s.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-600 hover:text-brand-700"
                  title="View"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={resumeUrl(s.id, true)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-600 hover:text-brand-700"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}

          <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={<a className="text-brand-700 hover:underline" href={`mailto:${s.email}`}>{s.email}</a>} />
          <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={s.phone} />
          <DetailRow icon={<Building2 className="h-4 w-4" />} label="Current Company" value={s.company} />
          <DetailRow icon={<Briefcase className="h-4 w-4" />} label="Experience" value={`${s.experience} years`} />
          <DetailRow icon={<Clock className="h-4 w-4" />} label="Notice Period" value={s.notice} />
          <DetailRow icon={<IndianRupee className="h-4 w-4" />} label="Current CTC" value={s.currentCtc} />
          <DetailRow icon={<IndianRupee className="h-4 w-4" />} label="Expected CTC" value={s.expectedCtc} />
          {s.linkedin && (
            <DetailRow
              icon={<Linkedin className="h-4 w-4" />}
              label="LinkedIn"
              value={<a className="text-brand-700 hover:underline" href={s.linkedin} target="_blank" rel="noreferrer">{s.linkedin}</a>}
            />
          )}
          {s.portfolio && (
            <DetailRow
              icon={<ExternalLink className="h-4 w-4" />}
              label="Portfolio"
              value={<a className="text-brand-700 hover:underline" href={s.portfolio} target="_blank" rel="noreferrer">{s.portfolio}</a>}
            />
          )}

          {s.coverLetter && (
            <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                Cover Letter / Note
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {s.coverLetter}
              </p>
            </div>
          )}
        </div>

        {/* footer actions */}
        <div className="sticky bottom-0 border-t border-gray-100 bg-white px-6 py-4">
          {confirm ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-gray-600">Delete this application?</span>
              <button
                onClick={() => setConfirm(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => onDelete(s.id)}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Delete application
            </button>
          )}
        </div>
      </motion.aside>
    </div>
  );
}
