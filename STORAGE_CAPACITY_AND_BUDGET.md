# House of Memories — Storage Capacity & Budget Analysis

## 1. Zero-Cost Architecture & Quota Realities

House of Memories is designed to operate under a strict **$0.00 / month infrastructure budget** by maximizing permanent Always Free cloud tiers.

### Critical Distinction: "Free Tier Optimization" vs "Guaranteed Permanent Storage"
- Free tier offerings are governed by each provider's terms of service and subject to account eligibility, quota limits, and policy changes.
- Oracle Cloud reserves the right to reclaim idle compute instances.
- Multi-cloud redundancy is constrained by free-tier storage capacities (10 GB on Cloudflare R2, 20 GB on OCI Object Storage).
- Therefore, the architecture **optimizes** for zero ongoing cost with honest boundaries, rather than making unrealistic claims of "perpetual guaranteed free storage."

---

## 2. Cloud Provider Free Tier Inventory

| Provider | Service Tier | Free Allowance | House of Memories Role |
| :--- | :--- | :--- | :--- |
| **Oracle Cloud (OCI)** | Always Free Block Volume | **200 GB Total** per tenancy | Primary Media Archive (150 GB data + 50 GB boot) |
| **Oracle Cloud (OCI)** | Always Free Compute | Up to 4 Arm Ampere OCPUs / 24 GB RAM | MinIO Gateway Host |
| **Oracle Cloud (OCI)** | Always Free Object Storage | **20 GB** Standard Storage | Secondary Replicas (Tier A) |
| **Cloudflare** | R2 Free Tier | **10 GB** Storage, 0 egress cost | Secondary Replicas (Tier B) |
| **Supabase** | Free Tier PostgreSQL | 500 MB Database / 50,000 MAU | Relational Metadata & RLS |

---

## 3. Realistic Capacity Runway Analysis

- **Existing Archive Size:** 50–100 GB.
- **Estimated Annual Growth:** 10–25 GB per year.
- **Allocated Primary Volume:** 150 GB (within the 200 GB OCI Always Free total).

### Runway Projections on 150 GB Primary Volume:
- **Starting at 50 GB:**
  - Year 0: 50 GB (33.3% capacity) — Normal.
  - Year 1 (+15 GB): 65 GB (43.3% capacity) — Normal.
  - Year 2 (+15 GB): 80 GB (53.3% capacity) — Normal.
  - Year 3 (+15 GB): 95 GB (63.3% capacity) — Normal.
  - Year 4 (+15 GB): 110 GB (73.3% capacity) — Notice threshold reached.
  - Year 5 (+15 GB): 125 GB (83.3% capacity) — Warning threshold reached.
- **Starting at 85 GB:**
  - Year 0: 85 GB (56.7% capacity) — Normal.
  - Year 1 (+15 GB): 100 GB (66.7% capacity) — Normal.
  - Year 2 (+15 GB): 115 GB (76.7% capacity) — Notice threshold reached.
  - Year 3 (+15 GB): 130 GB (86.7% capacity) — Warning threshold reached.

**Realistic Runway:** Approximately **2–4 years** on the 150 GB allocation before archive pruning, video compression, or cold offloading is required.

---

## 4. Tiered Capacity Alerts & Safeguards

The application monitors primary storage via `/api/storage/capacity` and enforces graduated safeguards:

1. **Normal (< 70%):** Standard operations, all upload sizes permitted up to 100 MB per file.
2. **Notice (70% – 79%):** Subtle banner informing space members of storage growth.
3. **Warning (80% – 89%):** Storage advisory recommending review of cold video archives or manual export.
4. **Hard Restriction (≥ 90%):** Uploads larger than 25 MB are rejected to prevent hard disk exhaustion on the primary block volume.

---

## 5. Secondary Replica Allocation Policy

Because Cloudflare R2 provides 10 GB and OCI Object Storage provides 20 GB free, the backup worker prioritizes assets for secondary replication:
1. **Curated Album Favorites:** Photos marked as album covers or favorites.
2. **Recent Milestones:** Memories from the current calendar year.
3. **Special Letters / "Open When":** High emotional value documents.
4. Large raw 4K video files remain on the primary 150 GB volume and are encouraged to be backed up locally by members.
