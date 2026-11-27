// ============================================================================
// House of Memories — Private Cloudflare R2 Storage Service
// ============================================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Allowed MIME types for memories archive
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
]);

// Maximum file size: 100 MB
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

// Space quota: 10 GB (free Cloudflare R2 tier)
export const SPACE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

// Short-lived signed upload URL expiration: 15 minutes (900 seconds)
export const UPLOAD_URL_EXPIRY_SECONDS = 15 * 60;

// Short-lived signed download URL expiration: 1 hour (3600 seconds)
export const DOWNLOAD_URL_EXPIRY_SECONDS = 60 * 60;

export interface UploadReservation {
  id: string;
  spaceId: string;
  userId: string;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  status: "pending" | "completed" | "expired" | "failed";
  createdAt: number;
  expiresAt: number;
}

// In-memory reservations store (for local validation & short-lived verification)
declare global {
  // eslint-disable-next-line no-var
  var __homUploadReservations: Map<string, UploadReservation> | undefined;
}

function getReservationsMap(): Map<string, UploadReservation> {
  if (!global.__homUploadReservations) {
    global.__homUploadReservations = new Map();
  }
  return global.__homUploadReservations;
}

export function isR2Configured(): boolean {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  return Boolean(
    accountId &&
    accessKeyId &&
    secretAccessKey &&
    bucketName &&
    !accountId.includes("placeholder")
  );
}

export function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID || "placeholder-account";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || "placeholder-key";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "placeholder-secret";

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Validates file MIME type, size, and generates a short-lived presigned upload URL.
 */
export async function createUploadAuthorization(params: {
  spaceId: string;
  userId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  currentSpaceUsageBytes?: number;
}): Promise<{
  reservationId: string;
  storagePath: string;
  uploadUrl: string;
  expiresInSeconds: number;
  isDemoMode: boolean;
}> {
  const { spaceId, userId, fileName, fileSizeBytes, mimeType, currentSpaceUsageBytes = 0 } = params;

  // 1. MIME Validation
  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Allowed formats are JPG, PNG, WebP, HEIC, MP4, MOV, and MP3.`
    );
  }

  // 2. File Size Validation
  if (fileSizeBytes <= 0 || fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${(fileSizeBytes / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of 100MB.`
    );
  }

  // 3. Quota Enforcement
  if (currentSpaceUsageBytes + fileSizeBytes > SPACE_QUOTA_BYTES) {
    throw new Error(
      `Space quota exceeded. Adding this file would exceed the 10GB space storage limit.`
    );
  }

  // 4. Generate structured storage path: spaces/<spaceId>/<year>/<month>/<uuid>-<filename>
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const bareName = fileName.split(/[/\\]/).pop() || "upload";
  const sanitizedName = bareName.replace(/^\.+/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `spaces/${spaceId}/${year}/${month}/${Date.now()}-${randomSuffix}-${sanitizedName}`;

  const reservationId = `res_${Date.now()}_${randomSuffix}`;
  const nowEpoch = Date.now();
  const expiresAt = nowEpoch + UPLOAD_URL_EXPIRY_SECONDS * 1000;

  const reservation: UploadReservation = {
    id: reservationId,
    spaceId,
    userId,
    storagePath,
    fileName,
    fileSizeBytes,
    mimeType,
    status: "pending",
    createdAt: nowEpoch,
    expiresAt,
  };

  const reservations = getReservationsMap();
  reservations.set(reservationId, reservation);

  // If R2 is not configured, provide mock presigned upload URL for local dev
  if (!isR2Configured()) {
    return {
      reservationId,
      storagePath,
      uploadUrl: `/api/media/upload/mock?reservationId=${reservationId}`,
      expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS,
      isDemoMode: true,
    };
  }

  // 5. Generate genuine short-lived S3/R2 signed upload URL
  const s3 = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME!;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storagePath,
    ContentType: mimeType,
    ContentLength: fileSizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
  });

  return {
    reservationId,
    storagePath,
    uploadUrl,
    expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS,
    isDemoMode: false,
  };
}

/**
 * Verifies that the client uploaded the file to R2, validates object headers,
 * and marks reservation as completed.
 */
export async function verifyAndCompleteUpload(params: {
  reservationId: string;
  storagePath: string;
}): Promise<{ verified: boolean; reservation: UploadReservation }> {
  const reservations = getReservationsMap();
  const reservation = reservations.get(params.reservationId);

  if (!reservation) {
    throw new Error("Upload reservation not found or expired.");
  }

  if (reservation.storagePath !== params.storagePath) {
    throw new Error("Storage path mismatch for this reservation.");
  }

  if (Date.now() > reservation.expiresAt) {
    reservation.status = "expired";
    throw new Error("Upload authorization has expired. Please retry.");
  }

  if (isR2Configured()) {
    const s3 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;

    try {
      const head = await s3.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: reservation.storagePath,
        })
      );

      // Verify uploaded size is non-zero
      if (!head.ContentLength || head.ContentLength === 0) {
        reservation.status = "failed";
        throw new Error("Uploaded object in storage is empty.");
      }
    } catch (err: any) {
      reservation.status = "failed";
      throw new Error(`Upload verification failed: ${err.message || "Object not found in R2"}`);
    }
  }

  reservation.status = "completed";
  return { verified: true, reservation };
}

/**
 * Generates an authenticated, short-lived download URL for private media.
 */
export async function getAuthorizedDownloadUrl(storagePath: string): Promise<string> {
  if (!isR2Configured()) {
    // In local dev without R2, return the storagePath or mock asset
    return storagePath.startsWith("http")
      ? storagePath
      : `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80`;
  }

  const s3 = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME!;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storagePath,
  });

  return getSignedUrl(s3, command, {
    expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
  });
}

/**
 * Permanently deletes an object from private Cloudflare R2 bucket.
 */
export async function deleteR2Object(storagePath: string): Promise<boolean> {
  if (!isR2Configured()) {
    return true;
  }

  try {
    const s3 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;

    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: storagePath,
      })
    );
    return true;
  } catch (err) {
    console.error("Failed to delete object from R2:", err);
    return false;
  }
}

/**
 * Cleans up expired upload reservations.
 */
export function pruneExpiredReservations(): number {
  const reservations = getReservationsMap();
  const now = Date.now();
  let pruned = 0;

  for (const [id, res] of reservations.entries()) {
    if (res.status === "pending" && now > res.expiresAt) {
      reservations.delete(id);
      pruned++;
    }
  }

  return pruned;
}
