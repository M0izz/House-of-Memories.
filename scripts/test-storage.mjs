// ============================================================================
// House of Memories — Private Media Storage Lifecycle Acceptance Tests
// ============================================================================

import {
  createUploadAuthorization,
  verifyAndCompleteUpload,
  pruneExpiredReservations,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  SPACE_QUOTA_BYTES,
} from "../src/lib/storage/r2.ts";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

console.log("============================================================");
console.log("📦 House of Memories — Media Storage Lifecycle Tests");
console.log("============================================================\n");

async function runStorageTests() {
  const spaceId = "space-test-r2";
  const userId = "user-alex";

  // Test 1: Valid Image Authorization
  {
    const auth = await createUploadAuthorization({
      spaceId,
      userId,
      fileName: "beach_sunset.jpg",
      fileSizeBytes: 4.5 * 1024 * 1024, // 4.5 MB
      mimeType: "image/jpeg",
    });

    assert(Boolean(auth.reservationId), "Reservation ID must be returned");
    assert(auth.storagePath.startsWith(`spaces/${spaceId}/`), "Storage path must be organized under spaceId");
    assert(auth.storagePath.includes("beach_sunset.jpg"), "Storage path must retain sanitized filename");
    assert(auth.expiresInSeconds === 900, "Signed URL must expire in 15 minutes (900s)");
    console.log("✓ Test 1: Valid image upload authorization generated successfully");

    // Test 2: Upload completion verification
    const { verified, reservation } = await verifyAndCompleteUpload({
      reservationId: auth.reservationId,
      storagePath: auth.storagePath,
    });
    assert(verified === true, "Upload must verify successfully");
    assert(reservation.status === "completed", "Reservation must be marked completed");
    console.log("✓ Test 2: Upload completion verification and status transition passed");
  }

  // Test 3: Disallowed MIME type rejected
  {
    let rejected = false;
    try {
      await createUploadAuthorization({
        spaceId,
        userId,
        fileName: "malicious.exe",
        fileSizeBytes: 1024 * 1024,
        mimeType: "application/x-msdownload",
      });
    } catch (err) {
      rejected = true;
      assert(err.message.includes("Unsupported file type"), "Expected unsupported file type message");
    }
    assert(rejected, "Executable MIME type must be rejected");
    console.log("✓ Test 3: Disallowed MIME types strictly rejected");
  }

  // Test 4: File size over 100MB rejected
  {
    let sizeRejected = false;
    try {
      await createUploadAuthorization({
        spaceId,
        userId,
        fileName: "massive_video.mov",
        fileSizeBytes: 150 * 1024 * 1024, // 150 MB (> 100 MB limit)
        mimeType: "video/quicktime",
      });
    } catch (err) {
      sizeRejected = true;
      assert(err.message.includes("exceeds maximum limit"), "Expected file size limit message");
    }
    assert(sizeRejected, "File over 100MB must be rejected");
    console.log("✓ Test 4: Files exceeding 100MB strictly rejected");
  }

  // Test 5: Space quota enforcement (10GB limit)
  {
    let quotaRejected = false;
    try {
      await createUploadAuthorization({
        spaceId,
        userId,
        fileName: "over_quota.jpg",
        fileSizeBytes: 50 * 1024 * 1024,
        mimeType: "image/jpeg",
        currentSpaceUsageBytes: SPACE_QUOTA_BYTES - 10 * 1024 * 1024, // only 10MB space left!
      });
    } catch (err) {
      quotaRejected = true;
      assert(err.message.includes("Space quota exceeded"), "Expected quota exceeded message");
    }
    assert(quotaRejected, "Upload exceeding 10GB space quota must be rejected");
    console.log("✓ Test 5: Space quota enforcement prevents exceeding 10GB limit");
  }

  // Test 6: Storage path traversal prevention & sanitization
  {
    const auth = await createUploadAuthorization({
      spaceId,
      userId,
      fileName: "../../etc/passwd/unsafe name!?.png",
      fileSizeBytes: 500 * 1024,
      mimeType: "image/png",
    });
    assert(!auth.storagePath.includes(".."), "Storage path must not contain path traversal components");
    assert(!auth.storagePath.includes("?"), "Storage path must not contain special query characters");
    console.log("✓ Test 6: Path traversal and dangerous characters strictly sanitized");
  }

  console.log("\n============================================================");
  console.log("🎉 ALL MEDIA STORAGE LIFECYCLE TESTS PASSED!");
  console.log("============================================================\n");
}

runStorageTests();
