# Kiewit Corporation — Careers Form

A job-application form (a polished clone of the original Kiewit careers form) plus a
Google-Forms-style responses dashboard.

- **`/`** — the application form
- **`/responses`** — dashboard to browse, search, export, and inspect every submission

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Web      | React 19 · Vite · Tailwind CSS v4 · framer-motion · lucide  |
| Server   | Express · Multer · MinIO SDK                                |
| Storage  | **Submissions → JSON files** on disk · **Resumes → MinIO** (S3) |
| Runtime  | Turborepo + Bun · Docker Compose                            |

Each submission is stored as a standalone `data/submissions/<id>.json` file — the folder
_is_ the database. Uploaded resumes go to a MinIO bucket (`kiewit-resumes`).

## Run with Docker (recommended)

```bash
cp .env.example .env          # then change the MinIO credentials for production
docker compose up --build
```

| Service        | URL                             |
| -------------- | ------------------------------- |
| App (form)     | http://localhost:3000           |
| Dashboard      | http://localhost:3000/responses |
| API            | http://localhost:3001/api       |
| MinIO console  | http://localhost:9001           |

Data persists in the `minio-data` and `submissions-data` Docker volumes.

## Local development (without Docker)

Start MinIO (needed for resume uploads), then run the apps with Bun:

```bash
docker compose up -d minio          # just object storage
bun install
bun run dev                         # web on :3000, server on :3001
```

The Vite dev server proxies `/api` → `http://localhost:3001`.

## Configuration

All server config is env-driven (see `.env.example` and `apps/server/src/config.ts`):
`PORT`, `DATA_DIR`, `MAX_UPLOAD_BYTES`, and the `MINIO_*` variables. For production,
set strong `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` and point `DATA_DIR` at a persistent
volume.

## API

| Method | Route                          | Purpose                            |
| ------ | ------------------------------ | ---------------------------------- |
| POST   | `/api/applications`            | Create (multipart, `resume` file)  |
| GET    | `/api/applications`            | List all (newest first)            |
| GET    | `/api/applications/:id`        | Single submission                  |
| GET    | `/api/applications/:id/resume` | Stream resume (`?download=1`)      |
| DELETE | `/api/applications/:id`        | Delete submission + resume         |
