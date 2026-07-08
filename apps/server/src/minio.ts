import { Client } from "minio";
import type { Readable } from "node:stream";
import { config } from "./config.js";

export const minioClient = new Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const BUCKET = config.minio.bucket;

/** Ensure the bucket exists. Retries so we survive MinIO booting slower than us in Docker. */
export async function initMinio(retries = 15, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const exists = await minioClient.bucketExists(BUCKET);
      if (!exists) {
        await minioClient.makeBucket(BUCKET, "");
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

export async function putResume(
  objectKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  await minioClient.putObject(BUCKET, objectKey, buffer, buffer.length, {
    "Content-Type": mimeType,
  });
}

export async function getResumeStream(objectKey: string): Promise<Readable> {
  return minioClient.getObject(BUCKET, objectKey);
}

export async function removeResume(objectKey: string): Promise<void> {
  await minioClient.removeObject(BUCKET, objectKey);
}
