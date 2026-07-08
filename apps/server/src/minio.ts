import { Client } from "minio";
import { config } from "./config.js";

const BUCKET = config.minio.bucket;
// Pinning the region makes presigning a pure local signature computation — otherwise
// minio-js does a region-lookup network call, which the public client (pointed at the
// browser-facing host) can't reach from inside the container.
const REGION = config.minio.region;

// Server-side client: bucket ops, stat, delete (reaches MinIO on the internal network).
const internalClient = new Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: REGION,
});

// Presigning client: builds signed URLs against the *public* host the browser uses.
const publicClient = new Client({
  endPoint: config.minio.public.endPoint,
  port: config.minio.public.port,
  useSSL: config.minio.public.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: REGION,
});

console.log(
  `[minio] public presign client configured: endpoint=${config.minio.public.endPoint}, port=${config.minio.public.port}, useSSL=${config.minio.public.useSSL}, region=${REGION}, bucket=${BUCKET}`,
);

/** Ensure the bucket exists. Retries so we survive MinIO booting slower than us in Docker. */
export async function initMinio(retries = 15, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!(await internalClient.bucketExists(BUCKET))) {
        await internalClient.makeBucket(BUCKET, "");
        console.log(`[minio] created bucket "${BUCKET}"`);
      } else {
        console.log(`[minio] bucket "${BUCKET}" ready`);
      }
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[minio] not ready (attempt ${attempt}/${retries}): ${msg}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/** Presigned PUT URL — the browser uploads the resume directly to MinIO. */
export function presignUpload(objectKey: string): Promise<string> {
  return publicClient.presignedPutObject(BUCKET, objectKey, config.presignExpirySeconds);
}

/** Presigned GET URL — used to view or download a resume from the dashboard. */
export function presignDownload(
  objectKey: string,
  opts: { fileName: string; mimeType: string; download: boolean },
): Promise<string> {
  const disposition = `${opts.download ? "attachment" : "inline"}; filename="${encodeURIComponent(
    opts.fileName,
  )}"`;
  return publicClient.presignedGetObject(BUCKET, objectKey, config.presignExpirySeconds, {
    "response-content-disposition": disposition,
    "response-content-type": opts.mimeType,
  });
}

/** Confirm an uploaded object actually exists (and read its real size). */
export async function statResume(objectKey: string): Promise<{ size: number; mimeType: string }> {
  const stat = await internalClient.statObject(BUCKET, objectKey);
  return {
    size: stat.size,
    mimeType: (stat.metaData?.["content-type"] as string) ?? "application/octet-stream",
  };
}

export async function removeResume(objectKey: string): Promise<void> {
  await internalClient.removeObject(BUCKET, objectKey);
}
