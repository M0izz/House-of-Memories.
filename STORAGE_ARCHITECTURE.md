# House of Memories — Storage Architecture & Cloud Strategy

## 1. System Overview & Core Principles

House of Memories safeguards shared memories for a private two-person memory space.

### Core Principles
1. **Source Preservation:** The original 50–100 GB media archive is read-only during migration and is never modified or deleted.
2. **Fail-Closed Primary Storage:** In production, storage operations must reach the primary OCI MinIO object store. If MinIO configuration is missing or invalid, uploads fail closed immediately—never silently writing to unmonitored local storage.
3. **Bounded Memory Streaming:** Media files are never buffered entirely in memory. Uploads, downloads, and replication use streaming chunks and S3 multipart uploads (minimum 5 MB parts) with $O(1)$ memory consumption.
4. **Metadata Authority:** Supabase PostgreSQL is the authoritative system of record for all asset metadata, permissions (RLS), and replica tracking.
5. **Honest Redundancy & Quota Truth:** Secondary cloud replicas (Cloudflare R2 and OCI Object Storage) have strict free quotas (10 GB and 20 GB respectively). They protect high-priority curated media and recent uploads rather than providing 100% mirroring of a 100 GB archive.

---

## 2. Implementation Status Matrix

| Component | Status | Verification Detail |
| :--- | :--- | :--- |
| **Provider-Neutral Storage Interface** | **Implemented & Tested** | Full abstraction with streaming upload/download, multipart chunking, and failover router. Verified via 23 unit tests and 24 integration tests. |
| **Fail-Closed Security Boundary** | **Implemented & Tested** | In production, unconfigured primary storage throws hard exception. Local storage is strictly rejected unless `NODE_ENV=test` or `ALLOW_LOCAL_STORAGE=true`. |
| **Streaming Migration CLI** | **Implemented & Tested** | `scripts/migrate-archive.mjs` streams files without buffering the archive in RAM. Includes streaming SHA-256, concurrency limiting, and resume deduplication. |
| **Cloud Backup Worker** | **Implemented & Tested** | `scripts/backup-worker.mjs` streams directly between providers with atomic job acquisition and exponential backoff. |
| **Encrypted Database Backup & Restore** | **Implemented & Tested** | `scripts/db-backup.mjs` & `scripts/db-restore.mjs` export all application tables with schema DDL, encrypted with AES-256-GCM and verified with SHA-256 manifests. |
| **Live OCI MinIO Primary Store** | **Implemented, Not Integration-Tested** | Tested with local S3 emulation and mocks; live connection skipped pending user deployment of OCI VM and MinIO. |
| **Live Cloudflare R2 Replica** | **Implemented, Not Integration-Tested** | Tested with local S3 emulation; live connection skipped pending `R2_ACCOUNT_ID` configuration. |
| **Live OCI Object Storage Replica** | **Implemented, Not Integration-Tested** | Tested with local S3 emulation; live connection skipped pending `OCI_OBJECT_STORAGE_NAMESPACE` configuration. |
| **Live Supabase PostgreSQL Backup** | **Implemented, Not Integration-Tested** | Tested with mock relational store and schema parser; live export skipped pending production `SUPABASE_SERVICE_ROLE_KEY`. |

---

## 3. Storage Topology & Data Flow

```mermaid
graph TD
    Client[Authenticated Client / API] -->|Stream Upload / Presigned| Router[Storage Router (src/lib/storage)]
    Router -->|Check Production Environment| ConfigCheck{MinIO Configured?}
    
    ConfigCheck -->|Yes| MinIO[OCI Primary MinIO (Attached Block Volume)]
    ConfigCheck -->|No & Production| FailClosed[FAIL CLOSED: Throw Hard Error]
    ConfigCheck -->|No & Test/Dev| DevLocal[Local Storage Fallback (Dev Only)]

    MinIO -->|Asynchronous Replication| BackupWorker[Backup Worker]
    BackupWorker -->|Stream Original| R2[Cloudflare R2 (10 GB Free Tier)]
    BackupWorker -->|Stream Original| OCIObj[OCI Object Storage (20 GB Free Tier)]

    Router -->|Metadata & RLS| Supabase[(Supabase PostgreSQL)]
```

---

## 4. Realistic Risk Analysis & Operational Realities

### A. Oracle Cloud Always Free Compute Idle Reclamation
- **Policy:** Oracle reserves the right to reclaim Always Free compute instances if CPU utilization is under 20% over a 7-day period.
- **Architectural Mitigation:** The boot volume (50 GB) is strictly separate from the media data volume (150 GB). If Oracle stops or terminates the compute instance, the block volume detached survives intact and can be reattached to a new instance within 15 minutes.
- **Operational Requirement:** The VM should execute periodic maintenance cron jobs (such as integrity sweeps or health probes) to maintain activity and avoid idle flagging.

### B. Free Tier Quota Constraints
- **Primary Block Volume:** 200 GB total allowance per tenancy (including boot volumes). Formatting a 150 GB media volume leaves 50 GB for OS boot.
- **Cloudflare R2:** 10 GB storage free per month.
- **OCI Object Storage:** 20 GB standard storage free per month.
- **Implication:** Full three-way cloud mirroring of a 100 GB archive is mathematically impossible under $0/month. The system prioritizes primary OCI volume persistence, with secondary cloud replicas dedicated to high-value curated favorites and recent additions.

---

## 5. Required Environment Variables

### Primary Storage (OCI MinIO)
```bash
MINIO_ENDPOINT="https://minio.your-domain.com" # or http://<oci-vm-ip>:9000
MINIO_ACCESS_KEY="your-access-key"
MINIO_SECRET_KEY="your-secret-key"
MINIO_BUCKET_NAME="hom-archive-primary"
MINIO_REGION="us-ashburn-1"
MINIO_TOTAL_CAPACITY_BYTES="161061273600" # 150 GB in bytes
```

### Secondary Storage (Cloudflare R2)
```bash
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key"
R2_SECRET_ACCESS_KEY="your-r2-secret-key"
R2_BUCKET_NAME="hom-archive-backup"
```

### Secondary Storage (OCI Object Storage)
```bash
OCI_OBJECT_STORAGE_NAMESPACE="your-tenancy-namespace"
OCI_OBJECT_STORAGE_REGION="us-ashburn-1"
OCI_CUSTOMER_SECRET_KEY_ID="your-customer-secret-key-id"
OCI_CUSTOMER_SECRET_KEY="your-customer-secret-key"
OCI_OBJECT_STORAGE_BUCKET="hom-archive-secondary"
```

### Database & Security (Supabase)
```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" # Server-side only
HOM_BACKUP_ENCRYPTION_KEY="your-aes256-passphrase"
HOM_SPACE_ID="your-space-uuid"
HOM_USER_ID="your-user-uuid"
```
