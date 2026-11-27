# House of Memories — Storage Architecture Audit & Implementation Correction Report

## 1. Executive Summary

This audit reviews the repository storage state following commit `f7923d5` and documents the critical implementation corrections applied to ensure true cloud compatibility, bounded-memory streaming, fail-closed boundaries, and genuine database disaster recovery.

---

## 2. Flaws Identified in Previous Implementation (`f7923d5`)

1. **Silent Fallback to Local Storage:**
   `src/lib/storage/index.ts` silently defaulted to `LocalStorageProvider` (`.data/media-storage`) whenever MinIO was not configured. This created a false illusion of cloud storage while silently writing files to the local container disk.
2. **In-Memory Buffering of Entire Media Files:**
   `scripts/migrate-archive.mjs` called `fs.readFileSync(filePath)` on every file, storing full binary buffers in an inventory array. Attempting to run this on a 50–100 GB archive would exhaust Node.js heap memory immediately.
3. **Local Secondary Replicas:**
   `scripts/backup-worker.mjs` wrote replicas to local `.data/secondary-storage` instead of invoking actual cloud provider adapters (Cloudflare R2 or OCI Object Storage).
4. **Non-PostgreSQL Database Backup:**
   `scripts/db-backup.mjs` simply exported `.data/albums-store.json`. It did not export relational tables, constraints, foreign keys, or schema DDL from Supabase PostgreSQL.
5. **Hardcoded IDs & Incomplete API Authority:**
   Hardcoded space and user UUIDs were present in CLI scripts, and the capacity API returned synthetic fixed text without validating member authentication.

---

## 3. Structural Corrections Implemented

### A. Fail-Closed Primary Router (`src/lib/storage/index.ts`)
- In production, missing MinIO credentials throws a hard error.
- Local storage fallback is strictly disabled unless explicitly enabled via `ALLOW_LOCAL_STORAGE=true` or `NODE_ENV=test`.
- Credentials remain strictly server-side.

### B. Bounded-Memory Streaming Storage (`src/lib/storage/providers/minio-provider.ts`)
- Implemented `uploadStream()` using S3 multipart uploads (minimum 5 MB part size) with automatic abort on failure.
- Buffers only a single part in RAM at any instant ($O(1)$ memory).
- Implemented streaming SHA-256 calculation piped through chunks.
- Large files (> 100 MB) are blocked from single-buffer `download()` and routed to `downloadStream()`.

### C. Streaming Migration CLI (`scripts/migrate-archive.mjs`)
- Inventory scans store paths, sizes, and MIME types only—zero file buffers in memory.
- Concurrency-bounded streaming uploads directly into the configured primary store.
- Database-backed idempotency skips existing files by SHA-256 digest.
- Source media files are strictly read-only and preserved untouched.
- Rejects missing space or user UUIDs.

### D. Multi-Cloud Backup Worker (`scripts/backup-worker.mjs`)
- Replaces local replica writes with streaming replication to configured secondary providers (R2 / OCI Object Storage).
- Safe atomic job acquisition preventing duplicate concurrent worker processing.
- Quota check prior to replication to prevent secondary provider overages.
- Verified replica requires independent remote availability and matching SHA-256 digest.

### E. Real PostgreSQL Database Backup & Restore (`scripts/db-backup.mjs` & `scripts/db-restore.mjs`)
- Exports all 11 application tables and includes migration DDL schemas.
- Encrypts backup bundles with AES-256-GCM.
- Generates cryptographic SHA-256 manifests.
- Enforces pre-restore integrity verification and requires `--confirm-production-overwrite` or test database targets.
