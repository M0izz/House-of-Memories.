# House of Memories — Disaster Recovery Runbook

This runbook provides actionable, step-by-step procedures for handling hardware failures, OCI VM termination, storage corruption, and database loss.

---

## Scenario A: OCI Always Free Compute Instance Reclaimed or Terminated

**Impact:** The virtual machine running MinIO is stopped, terminated, or reclaimed by Oracle Cloud due to inactivity or hypervisor maintenance.  
**Critical Protection:** The attached Block Volume (150 GB) containing the media archive is independent from the boot disk and survives instance termination.

### Recovery Procedure:
1. Log in to the **Oracle Cloud Infrastructure Console**.
2. Navigate to **Storage** > **Block Volumes**. Locate `hom-media-volume` and verify its state is `Available`.
3. Navigate to **Compute** > **Instances** and launch a replacement Always Free instance (`VM.Standard.A1.Flex` with 2 OCPUs, 12 GB RAM, or `VM.Standard.E2.1.Micro`).
4. Under **Attached Block Volumes**, attach `hom-media-volume` to the new instance as Paravirtualized.
5. SSH into the new instance and remount the media volume:
   ```bash
   sudo mkdir -p /mnt/hom-media-data
   sudo mount /dev/oracleoci/oraclevdb /mnt/hom-media-data
   ```
6. Add the mount to `/etc/fstab` for boot persistence:
   ```text
   /dev/oracleoci/oraclevdb /mnt/hom-media-data ext4 defaults,noatime,_netdev 0 2
   ```
7. Start the MinIO container via Docker:
   ```bash
   docker run -d --name minio \
     --restart unless-stopped \
     -p 9000:9000 -p 9001:9001 \
     -v /mnt/hom-media-data:/data \
     -e "MINIO_ROOT_USER=${MINIO_ACCESS_KEY}" \
     -e "MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}" \
     quay.io/minio/minio server /data --console-address ":9001"
   ```
8. Update `MINIO_ENDPOINT` in application configuration or update the DNS A-record to the new VM public IP.
9. Verify health:
   ```bash
   node --experimental-strip-types scripts/tests/real-provider-tests.mjs
   ```

---

## Scenario B: Primary Storage Loss or Block Volume Corruption

**Impact:** Primary disk has suffered an unrecoverable hardware failure.  
**Failover & Restoration:**

1. **Immediate Read Availability:**  
   The application's `downloadWithFailoverStream()` automatically routes read requests to verified secondary replicas on Cloudflare R2 and OCI Object Storage. Users can continue viewing photos without downtime.

2. **Primary Volume Re-creation:**  
   Attach and format a fresh 150 GB block volume to the compute instance.

3. **Restoration from Secondary Replicas:**  
   Execute the automated streaming restore tool:
   ```bash
   node --experimental-strip-types scripts/restore-archive.mjs --from "cloudflare_r2"
   ```
   The tool streams replicas directly from Cloudflare R2 into the fresh MinIO volume, verifying destination SHA-256 digests for each asset.

---

## Scenario C: Database Metadata Loss or Corruption

**Impact:** Relational tables in Supabase were dropped or corrupted.  
**Recovery Procedure:**

1. Locate the latest encrypted backup in `.data/db-backups/` (or from offsite backup storage).
2. **Step 1: Cryptographic Verification (Dry Run):**
   ```bash
   node --experimental-strip-types scripts/db-restore.mjs \
     --backup "/path/to/hom_pg_backup_<timestamp>.enc" \
     --verify-only
   ```
   Validates the SHA-256 digest against the manifest and tests AES-256-GCM decryption.
3. **Step 2: Restore into Separate Test Database First:**
   ```bash
   node --experimental-strip-types scripts/db-restore.mjs \
     --backup "/path/to/hom_pg_backup_<timestamp>.enc" \
     --target-db "https://test-project.supabase.co"
   ```
4. **Step 3: Restore into Production (Requires Explicit Confirmation):**
   ```bash
   node --experimental-strip-types scripts/db-restore.mjs \
     --backup "/path/to/hom_pg_backup_<timestamp>.enc" \
     --confirm-production-overwrite
   ```

---

## Scenario D: Silent Media Bit-Rot Detected

**Impact:** A file on disk no longer matches its recorded SHA-256 checksum.  
**Mitigation:**
1. Detected by periodic integrity scans (`backup_jobs` or health checks).
2. The asset is marked with `backup_status = "integrity_error"`.
3. The system pulls the untampered byte stream from the secondary replica on R2 or OCI Object Storage.
4. Overwrites the corrupted primary file with the verified stream.
5. Updates status back to `partially_backed_up` / `fully_backed_up`.
