-- ============================================================================
-- House of Memories — Zero-Cost Cloud Archive & Disaster Recovery (Migration 006)
-- ============================================================================

-- 1. Media Assets Table
create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  uploader_id uuid not null references auth.users(id),
  memory_id uuid references memories(id) on delete set null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  sha256_checksum text not null,
  primary_provider text not null default 'oci_minio',
  primary_object_key text not null,
  backup_status text not null default 'primary_only'
    check (backup_status in (
      'primary_only',
      'backup_pending',
      'partially_backed_up',
      'fully_backed_up',
      'backup_failed',
      'integrity_error'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, sha256_checksum)
);

create index if not exists idx_media_assets_space_id on media_assets(space_id);
create index if not exists idx_media_assets_checksum on media_assets(sha256_checksum);
create index if not exists idx_media_assets_backup_status on media_assets(backup_status);

-- 2. Media Replicas Table
create table if not exists media_replicas (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references media_assets(id) on delete cascade,
  provider text not null,
  object_key text not null,
  sha256_checksum text not null,
  verified_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed', 'corrupted')),
  created_at timestamptz not null default now(),
  unique (media_id, provider)
);

create index if not exists idx_media_replicas_media_id on media_replicas(media_id);
create index if not exists idx_media_replicas_status on media_replicas(status);

-- 3. Backup Jobs Queue Table
create table if not exists backup_jobs (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references media_assets(id) on delete cascade,
  target_provider text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_backup_jobs_status_retry on backup_jobs(status, next_retry_at);

-- 4. Storage Integrity Scans
create table if not exists integrity_scans (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  scanned_assets integer not null default 0,
  corrupted_assets integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- 5. Storage Audit Logs
create table if not exists storage_audit_logs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  media_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_storage_audit_space_action on storage_audit_logs(space_id, action);

-- Enable RLS
alter table media_assets enable row level security;
alter table media_replicas enable row level security;
alter table backup_jobs enable row level security;
alter table integrity_scans enable row level security;
alter table storage_audit_logs enable row level security;

-- Policies for media_assets
create policy "Space members can view media_assets"
  on media_assets for select
  using (
    exists (
      select 1 from space_members sm
      where sm.space_id = media_assets.space_id
      and sm.user_id = auth.uid()
    )
  );

create policy "Space members can insert media_assets"
  on media_assets for insert
  with check (
    exists (
      select 1 from space_members sm
      where sm.space_id = media_assets.space_id
      and sm.user_id = auth.uid()
    )
  );

create policy "Space members can delete media_assets"
  on media_assets for delete
  using (
    exists (
      select 1 from space_members sm
      where sm.space_id = media_assets.space_id
      and sm.user_id = auth.uid()
    )
  );

-- Policies for media_replicas
create policy "Space members can view media_replicas"
  on media_replicas for select
  using (
    exists (
      select 1 from media_assets ma
      join space_members sm on sm.space_id = ma.space_id
      where ma.id = media_replicas.media_id
      and sm.user_id = auth.uid()
    )
  );

-- Policies for backup_jobs
create policy "Space members can view backup_jobs"
  on backup_jobs for select
  using (
    exists (
      select 1 from media_assets ma
      join space_members sm on sm.space_id = ma.space_id
      where ma.id = backup_jobs.media_id
      and sm.user_id = auth.uid()
    )
  );

-- Policies for integrity_scans
create policy "Space members can view integrity_scans"
  on integrity_scans for select
  using (
    exists (
      select 1 from space_members sm
      where sm.space_id = integrity_scans.space_id
      and sm.user_id = auth.uid()
    )
  );

-- Policies for storage_audit_logs
create policy "Space members can view storage_audit_logs"
  on storage_audit_logs for select
  using (
    exists (
      select 1 from space_members sm
      where sm.space_id = storage_audit_logs.space_id
      and sm.user_id = auth.uid()
    )
  );
