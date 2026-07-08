# Kiewit Corporation — Careers Form

A job-application form (a clean clone of the Kiewit careers form) plus a
Google-Forms-style responses dashboard.

- **`/`** — the application form
- **`/responses`** — dashboard to browse, search, export, and inspect every submission

## Stack

| Layer    | Tech                                                          |
| -------- | ------------------------------------------------------------- |
| Web      | React 19 · Vite · Tailwind CSS v4 · lucide                    |
| Server   | Express · MinIO SDK · node-postgres                           |
| Storage  | **Submissions → PostgreSQL** (full payload as JSONB) · **Resumes → MinIO** (S3) |
| Uploads  | Browser uploads resumes **directly to MinIO via presigned URLs** (no multipart through the server) |
| Runtime  | Turborepo + Bun · Docker Compose                              |

PostgreSQL is the source of truth. Each row keeps typed columns for querying plus a
`raw` JSONB column holding the complete submission. Resumes live in a MinIO bucket
(`kiewit-resumes`); the browser PUTs them straight to MinIO with a short-lived
presigned URL, and the dashboard views/downloads them via presigned GET URLs.

## Upload / submit flow

1. `POST /api/uploads/presign` → server returns a presigned PUT URL + object key.
2. Browser `PUT`s the file directly to MinIO.
3. `POST /api/applications` (JSON) → server verifies the object exists, then writes the
   submission to Postgres.

## Run with Docker (recommended)

```bash
cp .env.example .env          # then change the DB + MinIO credentials for production
docker compose up --build
```

| Service        | URL                             |
| -------------- | ------------------------------- |
| App (form)     | http://localhost:3000           |
| Dashboard      | http://localhost:3000/responses |
| API            | http://localhost:3001/api       |
| PostgreSQL     | localhost:5432                  |
| MinIO console  | http://localhost:9001           |

The built SPA calls the API directly at `VITE_API_URL` (set at build time; see
`.env.example`). nginx no longer reverse-proxies `/api`.

Data persists in the `postgres-data` and `minio-data` Docker volumes.

> **Presigned URLs & the public host:** presigned URLs must point at a MinIO host the
> **browser** can reach. Locally that's `localhost:9000` (the default). In production set
> `MINIO_PUBLIC_ENDPOINT` (and `MINIO_PUBLIC_USE_SSL`) to your public MinIO domain, and
> keep `MINIO_ENDPOINT=minio` for the server's internal access.

## Local development (without Docker)

Start the backing services, then run the apps with Bun:

```bash
docker compose up -d postgres minio     # DB + object storage
bun install
bun run dev                             # web on :3000, server on :3001
```

The Vite dev server proxies `/api` → `http://localhost:3001`. Set `VITE_API_URL`
to make the SPA call the API directly instead (used in the Docker build).

## Configuration

Env-driven (see `.env.example` and `apps/server/src/config.ts`): `PORT`, `DATABASE_URL`,
`MAX_UPLOAD_BYTES`, `MINIO_PRESIGN_EXPIRY`, `CORS_ORIGIN`, the `MINIO_*` (internal)
and `MINIO_PUBLIC_*` (browser-facing) variables, and `VITE_API_URL` (web build-time
API base URL). For production use strong DB and MinIO credentials and set `CORS_ORIGIN`
to the web origin.

## API

| Method | Route                          | Purpose                                  |
| ------ | ------------------------------ | ---------------------------------------- |
| POST   | `/api/uploads/presign`         | Get a presigned PUT URL for the resume   |
| POST   | `/api/applications`            | Create a submission (JSON)               |
| GET    | `/api/applications`            | List all (newest first)                  |
| GET    | `/api/applications/:id`        | Single submission                        |
| GET    | `/api/applications/:id/resume` | Redirects to a presigned resume URL (`?download=1`) |
| DELETE | `/api/applications/:id`        | Delete submission + resume               |
