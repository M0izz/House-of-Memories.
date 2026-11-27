-- ============================================================================
-- House of Memories — Birthday & Automatic Notifications (Migration 003)
-- ============================================================================

-- 1. birthday_settings — Recurring annual birthday configuration
create table if not exists birthday_settings (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  recipient_name text not null default 'Maya',
  birth_month integer not null default 11 check (birth_month between 1 and 12),
  birth_day integer not null default 24 check (birth_day between 1 and 31),
  initial_year integer not null default 2027,
  timezone text not null default 'UTC',
  delivery_time text not null default '09:00',
  countdown_widget_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(space_id)
);

-- 2. push_subscriptions — Browser Web Push subscriptions
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. notification_preferences — Per-user notification settings
create table if not exists notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references memory_spaces(id) on delete cascade,
  birthday_notifications_enabled boolean not null default true,
  day_before_reminder_enabled boolean not null default true,
  preferred_time text not null default '09:00',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- 4. notification_deliveries — Delivery tracking & idempotency log
create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references memory_spaces(id) on delete cascade,
  notification_type text not null check (notification_type in ('birthday_day', 'day_before', 'test')),
  target_year integer not null,
  scheduled_date text not null,
  idempotency_key text not null unique,
  status text not null check (status in ('pending', 'delivered', 'failed')),
  error_message text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- Row Level Security (RLS)
alter table birthday_settings enable row level security;
alter table push_subscriptions enable row level security;
alter table notification_preferences enable row level security;
alter table notification_deliveries enable row level security;

-- Policies for birthday_settings
create policy "Space members can read birthday settings"
  on birthday_settings for select
  using (is_space_member(space_id));

create policy "Space members can update birthday settings"
  on birthday_settings for update
  using (is_space_member(space_id));

create policy "Space creators can insert birthday settings"
  on birthday_settings for insert
  with check (is_space_member(space_id));

-- Policies for push_subscriptions (user-scoped)
create policy "Users manage their own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policies for notification_preferences (user-scoped)
create policy "Users manage their own notification preferences"
  on notification_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policies for notification_deliveries (member read, server insert/update)
create policy "Space members can read deliveries"
  on notification_deliveries for select
  using (is_space_member(space_id));
