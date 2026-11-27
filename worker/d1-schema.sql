-- ============================================================================
-- House of Memories — Cloudflare D1 SQL Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS birthday_settings (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT 'Maya',
  birth_month INTEGER NOT NULL DEFAULT 11,
  birth_day INTEGER NOT NULL DEFAULT 24,
  initial_year INTEGER NOT NULL DEFAULT 2027,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  delivery_time TEXT NOT NULL DEFAULT '09:00',
  countdown_widget_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  space_id TEXT NOT NULL,
  birthday_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  day_before_reminder_enabled INTEGER NOT NULL DEFAULT 1,
  preferred_time TEXT NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  space_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  target_year INTEGER NOT NULL,
  scheduled_date TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  error_message TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_memory_id TEXT,
  cover_image_url TEXT,
  created_by TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  title TEXT,
  caption TEXT,
  story TEXT,
  captured_at TEXT,
  location TEXT,
  image_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS album_memories (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL,
  memory_id TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(album_id, memory_id)
);

CREATE INDEX IF NOT EXISTS idx_album_memories_album_id ON album_memories(album_id);
CREATE INDEX IF NOT EXISTS idx_album_memories_memory_id ON album_memories(memory_id);
