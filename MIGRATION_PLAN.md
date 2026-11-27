# House of Memories — Media Archive Migration Plan

This document outlines the step-by-step procedure to migrate the 50–100 GB personal media archive into the House of Memories cloud storage architecture.

---

## 1. Non-Negotiable Safety Rules

1. **Source Preservation:** The original media archive must remain strictly read-only. No migration script may move, rename, delete, or modify source files.
2. **Pre-Flight Configuration:** Do not attempt live migration until MinIO endpoint, credentials, and bucket connectivity have been verified with `verifyBucket()`.
3. **Mandatory Dry Run:** Every migration must be preceded by a dry run to verify file counts, sizes, and duplicate detection without touching cloud storage.
4. **Idempotency:** Re-running the migration must resume cleanly, skipping any file whose SHA-256 digest already exists in the destination space.

---

## 2. Pre-Flight Verification Checklist

Before running any migration command:
- [ ] OCI Compute instance is running and MinIO Docker container is healthy (`http://<oci-vm-ip>:9000/minio/health/live`).
- [ ] Attached block volume (150 GB) is mounted at `/mnt/hom-media-data`.
- [ ] Primary bucket (`hom-archive-primary`) is created and private.
- [ ] Environment variables are configured in `.env.local` or exported:
  ```bash
  export MINIO_ENDPOINT="https://minio.your-domain.com"
  export MINIO_ACCESS_KEY="your-access-key"
  export MINIO_SECRET_KEY="your-secret-key"
  export MINIO_BUCKET_NAME="hom-archive-primary"
  export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  export HOM_SPACE_ID="your-space-uuid"
  export HOM_USER_ID="your-user-uuid"
  ```
- [ ] Run the provider connectivity check:
  ```bash
  node --experimental-strip-types scripts/tests/real-provider-tests.mjs
  ```

---

## 3. Step 1: Inventory Scan & Dry Run

Run the migration tool in dry-run mode against the local archive path:

```bash
node --experimental-strip-types scripts/migrate-archive.mjs \
  --source "/path/to/archive" \
  --space-id "$HOM_SPACE_ID" \
  --user-id "$HOM_USER_ID" \
  --dry-run
```

### Dry-Run Output Validation
- Review total file count and aggregate size.
- Verify that memory usage remains steady (the tool does not load file contents into memory).
- Verify duplicate count: files already present in the target space will be noted as skipped.

---

## 4. Step 2: Live Bounded-Memory Migration

Execute live streaming migration with bounded concurrency:

```bash
node --experimental-strip-types scripts/migrate-archive.mjs \
  --source "/path/to/archive" \
  --space-id "$HOM_SPACE_ID" \
  --user-id "$HOM_USER_ID" \
  --concurrency 2
```

### Operational Behavior
- **Streaming Transfer:** Files stream directly from local disk into MinIO via S3 multipart uploads (5 MB chunks).
- **Integrity Verification:** Post-upload, the CLI queries the object's SHA-256 and compares it against the local streaming hash. Any mismatch triggers an immediate delete and failure record.
- **Database Tracking:** Each successful asset creates a `media_assets` row with status `backup_pending` and queues a `backup_jobs` record for secondary replication.
- **Manifest:** Generates a signed migration manifest at `.data/migrations/migration_<timestamp>.json`.

---

## 5. Step 3: Secondary Backup Replication

After primary migration completes, trigger the secondary replication worker to create cloud replicas on Cloudflare R2 / OCI Object Storage:

```bash
node --experimental-strip-types scripts/backup-worker.mjs
```

### Replication Validation
- Verify jobs transition from `pending` -> `in_progress` -> `completed`.
- Verify secondary replicas have status `verified` and match primary SHA-256 digests.
- Check capacity via the API:
  ```bash
  curl -s http://localhost:3000/api/storage/capacity | jq .
  ```
