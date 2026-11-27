# House of Memories — Database Schema Specification

## 1. Entity Relationship Model

```
memory_spaces (1) ─────< space_members (>1) ─────(1) auth.users
       │
       (1) ─────< albums
       (1) ─────< memories
       (1) ─────< timeline_events
       (1) ─────< letters
       (1) ─────< special_dates
       (1) ─────< birthday_experiences
       (1) ─────< activity_events
       (1) ─────< tags

memories (1) ─────< memory_media
memories (1) ─────< memory_tags >─── tags
memories (1) ─────< memory_locations
memories (1) ─────< memory_favorites
memories (1) ─────< memory_comments
memories (1) ─────< memory_reactions
memories (1) ─────< memory_views

albums (1) ─────< memories (cover via cover_memory_id)
timeline_events (1) ── memories (cover via cover_memory_id)

letters (1) ─────< letter_media

users (1) ─────< user_preferences
users (1) ─────< memory_favorites
users (1) ─────< memory_comments
users (1) ─────< memory_reactions
users (1) ─────< memory_views
users (1) ─────< activity_events
users (1) ─────< upload_jobs
```

## 2. Core Tables Summary

| Table | Purpose | Key Fields |
|---|---|---|
| `memory_spaces` | Shared friendship space | id, name, created_by, created_at |
| `space_members` | Two-user membership | space_id, user_id, role (creator/member) |
| `albums` | Memory collections | id, space_id, title, description, cover_memory_id |
| `memories` | Core memory records | id, space_id, album_id, created_by, title, caption, captured_at, is_favorite, deleted_at |
| `memory_media` | Original + derivative files | id, memory_id, storage_path, bucket, media_type, mime_type, file_size, width, height, duration_seconds |
| `tags` | Reusable labels | id, space_id, name, color |
| `memory_tags` | Memory ↔ tag join | memory_id, tag_id |
| `timeline_events` | Friendship milestones | id, space_id, title, description, event_date, cover_memory_id |
| `memory_locations` | Geographic data | id, memory_id, place_name, latitude, longitude, date_visited |
| `memory_favorites` | Per-user favorites | memory_id, user_id |
| `memory_comments` | Notes on memories | id, memory_id, user_id, content |
| `memory_reactions` | Lightweight reactions | memory_id, user_id, reaction |
| `letters` | Open When letters | id, space_id, created_by, title, content, unlock_at, is_locked, editable_by_recipient |
| `letter_media` | Media attached to letters | id, letter_id, storage_path, media_type, mime_type, file_size |
| `special_dates` | Countdowns/occasions | id, space_id, title, event_date, recurrence |
| `birthday_experiences` | Birthday reveal config | id, space_id, title, config (jsonb), is_published, preview_token |
| `user_preferences` | Per-user settings | user_id, theme, sound_enabled, volume, mute, reduced_motion |
| `memory_views` | View history (anti-repeat) | id, memory_id, user_id, viewed_at |
| `activity_events` | Shared activity history | id, space_id, user_id, action, target_type, target_id, metadata |
| `upload_jobs` | Upload processing state | id, user_id, status, file_name, storage_path, error_message |

## 3. Row Level Security (RLS)

RLS is enabled on **every** user-facing table. Access is governed by the `is_space_member(space_id)` helper function, which checks whether `auth.uid()` is a member of the given space.

Key policies:
- **Read:** Any member of the space can read that space's data.
- **Create:** Only the authenticated user themselves can create records as `created_by`/`user_id`, and only if they are a member of the space.
- **Update/Delete:** Users can update/delete their own records; the `creator` role can manage all records in the space.
- **Favorites/Preferences/Views:** Scoped to the individual user (`user_id = auth.uid()`).

## 4. Storage Security

Two private Supabase Storage buckets:
- `memories` — original files (photos, videos, audio)
- `memory-derivatives` — thumbnails and optimized display versions

Access to both buckets is restricted to authenticated members of the corresponding memory space. Media is served via short-lived signed URLs (5–15 minute expiration). The Supabase service-role key is **never** exposed to the browser.

## 5. Migration Files

- `supabase/migrations/001_initial_schema.sql` — Foundational schema (all 20 tables, indexes, RLS policies)
- `supabase/migrations/002_extended_features.sql` — Composite constraints, `created_by` on tags, additional indexes

## 6. Seed Data (Example)

See `supabase/seed.sql` for initial space creation, default tags, and sample letters. Seed data should only be run in development/staging, never in production with real user data.

## 7. Implementation Notes

- Composite uniqueness on `(id, space_id)` and composite foreign keys prevent cross-space data leakage.
- Soft deletes via `deleted_at` on `memories` enable 30-day recovery.
- `birthday_experiences.config` uses `jsonb` for flexible, configurable surprise experiences without schema changes.
- `memory_views` tracks viewed memories so Memory Lane can avoid immediate repetition.
- `activity_events` provides an internal activity feed (not public).
