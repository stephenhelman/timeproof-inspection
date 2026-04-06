import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// ── Validate env vars ─────────────────────────────────────

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET     = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY || !BUCKET || !PUBLIC_URL) {
  throw new Error(
    "Missing required Cloudflare R2 env vars: " +
      [
        !ACCOUNT_ID && "CLOUDFLARE_ACCOUNT_ID",
        !ACCESS_KEY && "R2_ACCESS_KEY_ID",
        !SECRET_KEY && "R2_SECRET_ACCESS_KEY",
        !BUCKET     && "R2_BUCKET_NAME",
        !PUBLIC_URL && "R2_PUBLIC_URL",
      ]
        .filter(Boolean)
        .join(", ")
  );
}

// ── R2 client ─────────────────────────────────────────────

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

// ── Upload a file to R2 ───────────────────────────────────
// Returns the public URL of the uploaded file.
// Note: public access is configured at the bucket level in the
// Cloudflare R2 dashboard — set the bucket to "Public" there.

export async function uploadFileToR2({
  buffer,
  key,
  mimeType,
}: {
  buffer: Buffer;
  key: string;
  mimeType: string;
}): Promise<{ url: string; key: string }> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  const url = `${PUBLIC_URL}/${key}`;
  return { url, key };
}

// ── Delete a file from R2 ─────────────────────────────────

export async function deleteFileFromR2(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

// ── Generate a storage key for an inspection photo ────────
// Format: inspections/{inspectionId}/photo-{photoNumber}-{timestamp}.{ext}

export function generatePhotoKey({
  inspectionId,
  photoNumber,
  mimeType,
}: {
  inspectionId: string;
  photoNumber: number;
  mimeType: string;
}): string {
  const ext = mimeType.split("/")[1] ?? "jpg";
  const timestamp = Date.now();
  return `inspections/${inspectionId}/photo-${photoNumber}-${timestamp}.${ext}`;
}
