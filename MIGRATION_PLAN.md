# House of Memories — Media Archive Migration Plan

This document outlines the step-by-step migration procedure to safely ingest an existing **50–100 GB** media archive into the zero-cost storage architecture without data loss or duplication.

---

## 1. Pre-Flight Verification

Before beginning the migration:
1. Ensure the primary storage endpoint (MinIO on OCI Block Volume or local staging store) is active.
2. Confirm adequate disk space on the primary volume:
   ```bash
   df -h /mnt/hom-media-data
   ```
3. Verify database connectivity:
   ```bash
   node scripts/db-backup.mjs
   ```

---

## 2. Dry-Run & Inventory Scan

Execute an inventory dry-run to discover files, check MIME types, compute SHA-256 digests, and identify any duplicate files before touching primary storage:

```bash
node scripts/migrate-archive.mjs --source "/path/to/archive" --dry-run
```

**Output Review Checklist:**
- [ ] Confirm total file count and total gigabytes match local expectations.
- [ ] Confirm unsupported or corrupted files are noted.
- [ ] Review detected duplicates (files with identical SHA-256 hashes will be automatically deduplicated).

---

## 3. Batched Ingestion & Checksum Verification

Run the migration in batches (default: 20 files per batch) with resume capability:

```bash
node scripts/migrate-archive.mjs --source "/path/to/archive" --batch-size 20
```

### Key Safety Features:
- **Resumable:** If the connection or script is interrupted, re-running the command skips all files whose SHA-256 checksum is already present in `media_assets`.
- **Atomic Verification:** Each file is written to primary storage and immediately re-read to verify its SHA-256 checksum before committing the database record. If a checksum fails, the corrupt file is unlinked immediately.
- **Asynchronous Replication Queue:** Each uploaded asset queues an automated backup job for secondary replica replication.

---

## 4. Post-Migration Verification & Manifest

Upon completion, a signed migration manifest is generated at:
`.data/migrations/manifest-<timestamp>.json`

Verify post-migration health:
```bash
# Verify integrity of all assets
node scripts/backup-worker.mjs --scan-integrity

# Process background replication to secondary storage
node scripts/backup-worker.mjs
```
