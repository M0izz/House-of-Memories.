# House of Memories — Storage Capacity & Budget Analysis

## 1. Zero-Cost Budget Policy ($0.00 / month Guaranteed)

House of Memories enforces a strict policy: **never cross into paid cloud tiers**. No automated payment authorizations, no "surprise" overage bills, and no reliance on transient free trials that expire after 30 or 90 days.

All selected tiers are **Permanent Always Free** offerings.

---

## 2. Cloud Provider Free Tier Inventory

| Provider | Service Tier | Free Quota | House of Memories Role |
| :--- | :--- | :--- | :--- |
| **Oracle Cloud Infrastructure (OCI)** | Always Free Block Volume | **200 GB Total** (combined boot + block) | **Primary Archive (150–200 GB)** |
| **Oracle Cloud Infrastructure (OCI)** | Always Free Compute | Up to 4 Arm Ampere OCPUs / 24 GB RAM | MinIO Gateway Host |
| **Oracle Cloud Infrastructure (OCI)** | Always Free Object Storage | **20 GB** Standard Storage | Secondary Replicas (Tier A) |
| **Cloudflare** | R2 Free Tier | **10 GB** Storage, 0 egress cost | Secondary Replicas (Tier B) |
| **Google** | Google Drive Personal | **15 GB** Free Tier | Offsite Cold Redundancy |
| **Supabase** | Free Tier PostgreSQL | 500 MB Database / 50,000 MAU | Relational Metadata & RLS |

---

## 3. Capacity Runway Projections

- **Initial Archive:** 50–100 GB.
- **Projected Ingestion:** 10–25 GB per year.

### Primary Archive Runway (200 GB OCI Allocation):
- Year 0 (Current): 75 GB used (37.5% capacity).
- Year 1 (+15 GB): 90 GB used (45.0% capacity).
- Year 2 (+15 GB): 105 GB used (52.5% capacity).
- Year 3 (+15 GB): 120 GB used (60.0% capacity).
- Year 4 (+15 GB): 135 GB used (67.5% capacity).
- Year 5 (+15 GB): 150 GB used (75.0% capacity — Threshold 1 Triggered).

**Safe Runway:** **5–7 Years** without modifying the $0 infrastructure architecture.

---

## 4. Automated Tiered Capacity Alerts

The application monitors storage usage via `/api/storage/capacity` and issues graduated responses:

1. **Normal (< 70%):** Standard operations, unrestricted uploads.
2. **Notice (70% - 79%):** Subtle dashboard notice informing members of archive growth.
3. **Warning (80% - 89%):** Recommended archive review. Prompts members to compress cold video clips or export cold years to secondary archive storage.
4. **Hard Restriction (≥ 90%):** Large single uploads (> 50 MB) are rejected to prevent hard volume exhaust, preserving system stability and metadata integrity.
