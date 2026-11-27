# STORAGE ARCHITECTURE AUDIT — HOUSE OF MEMORIES
**Audit Date:** November 27, 2026  
**Repository Branch:** `main` (Post-commit `4f85d83`)  
**Scope:** Repository-wide audit of architecture, storage mechanisms, database contracts, sample data, and failure domains under a strict $0/month budget.

---

## 1. Executive Summary

House of Memories is a Next.js 15 App Router web application designed as an intimate, collaborative two-person digital sanctuary. This audit establishes the exact current state of the codebase, contrasts documented designs against active runtime implementations, and outlines the storage migration requirements for handling a 50–100 GB existing archive with 10–25 GB/year growth at zero recurring cost.

---

## 2. Framework, Runtime & Deployment Stack

| Component | Repository Implementation | Verified Status |
|---|---|---|
| **Web Framework** | Next.js 15.5.29 (React 19, TypeScript 5.4.5) | Production build tested (`npm run build`), 23 static/dynamic routes |
| **Styling & UI** | Tailwind CSS v3.4.4, Motion v12.0.0, Lucide React v0.460.0 | Scrapbook pastel aesthetic (Cream `#FFF8F5`, Blush `#F6E4EC`, Plum `#493C46`) |
| **Hosting Target** | Vercel / Node.js Serverless runtime | Operational locally on `localhost:3000` |
| **Edge Worker** | Cloudflare Workers (`worker/src/index.ts`, `worker/wrangler.toml`) | Notification cron trigger scaffolded |
| **ORM / Querying** | Supabase SSR (`@supabase/ssr` v0.5.2) + Direct PostgreSQL Migrations | Schema migrations `001` through `005` in `supabase/migrations/` |

---

## 3. Database & Authentication State

### Primary Database: Supabase PostgreSQL
The authoritative production database schema is defined in SQL migrations:
1. `001_initial_schema.sql`: Core entities (`memory_spaces`, `space_members`, `memories`, `memory_media`, `albums`, `tags`).
2. `002_extended_features.sql`: Milestone timelines, open-when envelopes, memory maps.
3. `003_birthday_notifications.sql`: Web push subscriptions and notification delivery logs.
4. `004_album_memories.sql`: Many-to-many junction table `album_memories` with space-matching trigger validation (`validate_album_memory_space_match`).
5. `005_space_member_limit.sql`: Concurrency-safe membership serialization locking parent `memory_spaces` row (`SELECT ... FOR UPDATE`) enforcing exactly $\le 2$ members per space.

### Authentication Layer
- Managed via `@supabase/ssr` server client (`src/lib/supabase/server.ts`) using secure HTTP-only session cookies.
- Server repository layer (`src/lib/repositories/memory-repository.ts`) checks `supabase.auth.getUser()`, resolving the active user and their `space_members` row.

---

## 4. Current Storage Architecture & Data Sources

### A. Media Storage (Pre-Migration)
* **S3/R2 Presigner Layer:** `src/lib/storage/r2.ts` contains AWS S3 SDK v3 presigned URL generation for Cloudflare R2, MIME type whitelisting, 100MB size limits, and 10GB space quota enforcement.
* **API Endpoints:**
  * `POST /api/media/upload/presign`: Issues short-lived presigned upload URLs (15 min expiry).
  * `POST /api/media/upload/complete`: Verifies S3 `HeadObject` and registers metadata in PostgreSQL.
  * `GET /api/media/download`: Generates signed download URLs (1 hour expiry) with space-boundary checks.
  * `DELETE /api/media`: Removes S3 object and deletes metadata.
* **Limitations:**
  * Cloudflare R2 provides only **10 GB** free storage. A 50–100 GB archive will exceed this free allocation by 5× to 10×, incurring unwanted charges if uncapped.
  * OCI Object Storage provides only **20 GB** combined free tier.

### B. In-Memory, Dev Disk Cache, & Sample Data
* **`src/lib/albums-store.ts`:**
  * Contains local development disk persistence synced to `.data/albums-store.json`.
  * Pre-seeded from `src/lib/sample-data.ts` (mock memories and albums).
  * **Audit Verdict:** The repository layer (`src/lib/repositories/memory-repository.ts`) acts as an adapter: when Supabase environment variables are missing or set to placeholder, it routes to `.data/albums-store.json` with an explicit `isDemoMode: true` flag. In production with live Supabase credentials, it queries PostgreSQL with full RLS.
* **`src/app/page.tsx` (Home Dashboard):**
  * Fully connected to `/api/memories` and `/api/albums`.
  * Renders real counts, dynamically picks featured memories, and displays empty states when the archive is empty.

---

## 5. Risk Assessment & Failure Domains

| Failure Domain | Current Exposure | Mitigation Required |
|---|---|---|
| **Storage Quota Depletion** | Free R2 (10 GB) and OCI Object Storage (20 GB) cannot store 50–100 GB. | Deploy an OCI Always Free Compute instance with a **separate 100–200 GB attached block volume** hosting MinIO S3 object storage. |
| **Compute Instance Reclamation** | OCI idle compute instances can be reclaimed by Oracle. | Boot volume and media block volume MUST be decoupled. Automated volume backups and off-site replica syncs are mandatory. |
| **Database Loss** | Supabase Free projects do not include automated daily backups. | Implement independent daily database dump scripts to off-site storage. |
| **Silent Corruption / Bit Rot** | Browser uploads without checksum verification risk corrupted transfers. | End-to-end SHA-256 generation on client, stored in database, and verified at every replica destination. |
| **Accidental Billing** | Automatic overages on cloud providers. | Hard stop at 90% capacity; strictly zero credit card dependencies. |

---

## 6. Migration & Architecture Roadmap

1. **Database Schema:** Create `006_archive_disaster_recovery.sql` defining `media_assets`, `media_replicas`, `backup_jobs`, `integrity_scans`, and `audit_logs`.
2. **Storage Abstraction:** Implement `StorageProvider` interface supporting MinIO (OCI Block Volume primary), OCI Object Storage, Cloudflare R2, Google Drive, and local filesystem adapters.
3. **Disaster Recovery Engine:** Asynchronous backup job queue, checksum matching, and point-in-time restore scripts.
4. **Migration CLI:** Idempotent CLI tool for inventorying, SHA-256 hashing, batch uploading, and verifying the 50–100 GB archive.
