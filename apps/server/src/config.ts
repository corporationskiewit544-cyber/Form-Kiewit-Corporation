const num = (v: string | undefined, fallback: number) =>
  v && !Number.isNaN(Number(v)) ? Number(v) : fallback;

const bool = (v: string | undefined, fallback: boolean) =>
  v === undefined ? fallback : v === "true" || v === "1";

const endPoint = process.env.MINIO_ENDPOINT ?? "localhost";
const port = num(process.env.MINIO_PORT, 9000);
const useSSL = bool(process.env.MINIO_USE_SSL, false);

export const config = {
  port: num(process.env.PORT, 3001),

  // Postgres is the source of truth. Full submission payload is stored as JSONB.
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://kiewit:kiewit@localhost:5432/kiewit",

  // Resume constraints (mirrored on the client).
  maxUploadBytes: num(process.env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024),
  presignExpirySeconds: num(process.env.MINIO_PRESIGN_EXPIRY, 300),

  minio: {
    // Internal client — how the *server* reaches MinIO (e.g. "minio" in Docker).
    endPoint,
    port,
    useSSL,
    accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
    bucket: process.env.MINIO_BUCKET ?? "kiewit-resumes",
    region: process.env.MINIO_REGION ?? "us-east-1",

    // Public client — the host baked into presigned URLs, which the *browser*
    // must be able to reach. In Docker set MINIO_PUBLIC_ENDPOINT to the host/domain
    // that is exposed to users (defaults to the internal endpoint for local dev).
    public: {
      endPoint: process.env.MINIO_PUBLIC_ENDPOINT ?? endPoint,
      port: num(process.env.MINIO_PUBLIC_PORT, port),
      useSSL: bool(process.env.MINIO_PUBLIC_USE_SSL, useSSL),
    },
  },
} as const;
