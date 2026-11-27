# House of Memories — Disaster Recovery Runbook

This runbook documents actionable procedures to respond to outages, hardware failure, VM reclamation, bit-rot corruption, and metadata loss, preserving the $0/month budget throughout.

---

## Scenario A: OCI Always Free Compute Instance Reclaimed or Terminated

**Impact:** The virtual machine running MinIO is stopped or destroyed by Oracle Cloud due to inactivity or hypervisor maintenance.  
**Critical Protection:** The attached Block Volume (150–200 GB) containing the actual media files is distinct from the boot volume and survives instance termination.

### Recovery Procedure:
1. Log in to the Oracle Cloud Infrastructure Console.
2. Navigate to **Storage** > **Block Volumes** and locate `hom-media-volume`. Verify its state is `Available`.
3. Navigate to **Compute** > **Instances** and launch a new Always Free instance (e.g. `VM.Standard.A1.Flex` with 2 OCPUs, 12 GB RAM, Ubuntu 22.04 / 24.04 LTS).
4. Under **Attached Block Volumes**, attach `hom-media-volume` to the new instance as Paravirtualized or iSCSI.
5. SSH into the new instance and mount the volume:
   ```bash
   sudo mkdir -p /mnt/hom-media-data
   sudo mount /dev/oracleoci/oraclevdb /mnt/hom-media-data
   # Add to /etc/fstab for boot persistence:
   # /dev/oracleoci/oraclevdb /mnt/hom-media-data ext4 defaults,noatime,_netdev 0 2
   ```
6. Start the MinIO container using Docker Compose:
   ```bash
   docker run -d --name minio \
     -p 9000:9000 -p 9001:9001 \
     -v /mnt/hom-media-data:/data \
     -e "MINIO_ROOT_USER=${MINIO_ACCESS_KEY}" \
     -e "MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}" \
     quay.io/minio/minio server /data --console-address ":9001"
   ```
7. Update `MINIO_ENDPOINT` in application environment variables (or update DNS A-record to the new public IP).
8. Verify primary health:
   ```bash
   curl -s http://localhost:3000/api/storage/capacity | jq .
   ```

---

## Scenario B: Primary Storage Loss or Full Block Volume Corruption

**Impact:** Primary disk has suffered an unrecoverable hardware failure.  
**Recovery Procedure (Secondary Replicas Failover):**
1. The application's `downloadWithFailover()` automatically routes read requests to the secondary Cloudflare R2 and OCI Object Storage replicas. Users continue viewing photos and videos without downtime.
2. Attach a fresh 150–200 GB block volume to the compute instance.
3. Run the automated replica-to-primary restore script:
   ```bash
   node scripts/restore-archive.mjs --from "cloudflare_r2" --target-dir "/mnt/hom-media-data"
   ```
4. Verify all SHA-256 checksums match the `media_assets` database records:
   ```bash
   node scripts/backup-worker.mjs --scan-integrity
   ```

---

## Scenario C: Database Metadata Deletion or Corruption

**Impact:** PostgreSQL metadata in Supabase was dropped, corrupted, or accidentally truncated.  
**Recovery Procedure:**
1. Locate the latest verified database backup in `.data/db-backups/`.
2. First, verify the SHA-256 cryptographic manifest:
   ```bash
   node scripts/db-restore.mjs --verify-only
   ```
3. Restore the verified tables:
   ```bash
   node scripts/db-restore.mjs
   ```
4. Re-run an archive scan to sync any media assets uploaded since the backup was taken:
   ```bash
   node scripts/backup-worker.mjs --scan-integrity
   ```

---

## Scenario D: Silent Media Bit-Rot Detected

**Impact:** A periodic integrity scan detects that a file on disk no longer matches its recorded SHA-256 checksum.  
**Automatic Mitigation:**
1. The asset's status is automatically marked as `integrity_error`.
2. The system fetches the untampered byte stream from the secondary replica (Cloudflare R2 or OCI Object Storage).
3. The corrupted primary file is replaced with the verified replica.
4. The asset status is restored to `fully_backed_up`.
