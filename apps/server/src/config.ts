import path from "node:path";

const num = (v: string | undefined, fallback: number) =>
  v && !Number.isNaN(Number(v)) ? Number(v) : fallback;

const bool = (v: string | undefined, fallback: boolean) =>
  v === undefined ? fallback : v === "true" || v === "1";

export const config = {
  port: num(process.env.PORT, 3001),

  // Where submission JSON documents live (one file per submission).
  dataDir: process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(process.cwd(), "data", "submissions"),

  // Max resume upload size in bytes (default 10MB, matches the form copy).
  maxUploadBytes: num(process.env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024),

  minio: {
    endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: num(process.env.MINIO_PORT, 9000),
    useSSL: bool(process.env.MINIO_USE_SSL, false),
    accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
    bucket: process.env.MINIO_BUCKET ?? "kiewit-resumes",
  },
} as const;
