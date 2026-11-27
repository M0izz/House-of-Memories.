# House of Memories — API Contracts

The application primarily uses **Supabase client-side queries** with Row Level Security, supplemented by **Next.js Server Actions** for operations requiring server-side validation (uploads, birthday config, membership changes).

All API interactions require an authenticated Supabase session.

---

## 1. Authentication

| Action | Method | Endpoint / Call |
|---|---|---|
| Sign in | Supabase Auth | `supabase.auth.signInWithOAuth` / `signInWithPassword` |
| Sign out | Supabase Auth | `supabase.auth.signOut()` |
| Get session | Supabase Auth | `supabase.auth.getSession()` |
| Invite user | Server Action | `POST /api/auth/invite` (creator only) |

**Invite body:**
```ts
{ email: string }
```

**Response:**
```ts
{ success: boolean, inviteToken?: string }
```

---

## 2. Memory Spaces & Membership

| Action | Method | Call |
|---|---|---|
| Get current space | Query | `select * from memory_spaces where is_space_member(id)` |
| Get members | Query | `select * from space_members where space_id = ?` |
| Create space | Server Action | `POST /api/spaces` (creator only) |

---

## 3. Memories

### List Memories
**GET** (Supabase query)
```ts
supabase
  .from("memories")
  .select(`
    *,
    memory_media(*),
    memory_tags(tag_id),
    albums(title)
  `)
  .eq("space_id", spaceId)
  .is("deleted_at", null)
  .order("created_at", { ascending: false })
```

### Create Memory
**Server Action** `POST /api/memories`

**Body:**
```ts
{
  title?: string;
  caption?: string;
  captured_at?: string;
  album_id?: string;
  space_id: string; // validated server-side
  files: File[]; // uploaded to Supabase Storage first
}
```

**Response:**
```ts
{ memoryId: string, mediaIds: string[] }
```

### Update Memory
**Server Action** `PATCH /api/memories/[id]`
Only the creator of the memory can update it.

### Soft Delete Memory
**Server Action** `DELETE /api/memories/[id]`
Sets `deleted_at` instead of hard delete.

### Restore Memory
**Server Action** `POST /api/memories/[id]/restore`
Clears `deleted_at`.

---

## 4. Memory Media

| Action | Method | Call |
|---|---|---|
| Upload media file | Server Action | `POST /api/uploads` |
| Get signed URL | Server Action | `GET /api/media/[id]/signed-url` |
| Delete media | Server Action | `DELETE /api/media/[id]` |

**Upload flow:**
1. Client uploads file to Supabase Storage bucket `memories`
2. Server creates `memory_media` record with `storage_path`
3. Server generates thumbnail and stores in `memory-derivatives`
4. Server returns signed URL for client consumption

**Signed URL response:**
```ts
{ signedUrl: string, expiresIn: number } // seconds
```

---

## 5. Albums

| Action | Method | Call |
|---|---|---|
| List albums | Query | `select * from albums where space_id = ?` |
| Create album | Server Action | `POST /api/albums` |
| Update album | Server Action | `PATCH /api/albums/[id]` |
| Delete album | Server Action | `DELETE /api/albums/[id]` (set album_id null on memories) |

## 6. Timeline Events

| Action | Method | Call |
|---|---|---|
| List events | Query | `select * from timeline_events where space_id = ? order by event_date` |
| Create event | Server Action | `POST /api/timeline-events` |
| Update event | Server Action | `PATCH /api/timeline-events/[id]` |
| Delete event | Server Action | `DELETE /api/timeline-events/[id]` |

## 7. Open When Letters

| Action | Method | Call |
|---|---|---|
| List letters | Query | `select * from letters where space_id = ?` |
| Create letter | Server Action | `POST /api/letters` (creator only) |
| Update letter | Server Action | `PATCH /api/letters/[id]` (creator only) |
| Check unlock status | Query | `select unlock_at, is_locked from letters where id = ?` |

**Letter open event:** Record in `memory_views` or `activity_events` when opened.

## 8. Special Dates

| Action | Method | Call |
|---|---|---|
| List special dates | Query | `select * from special_dates where space_id = ? order by event_date` |
| Create special date | Server Action | `POST /api/special-dates` |
| Update | Server Action | `PATCH /api/special-dates/[id]` |
| Delete | Server Action | `DELETE /api/special-dates/[id]` |

## 9. Memory Map / Locations

| Action | Method | Call |
|---|---|---|
| Add location to memory | Server Action | `POST /api/memories/[id]/location` |
| Get all locations | Query | `select * from memory_locations ml join memories m on ... where m.space_id = ?` |

**Location body:**
```ts
{
  place_name: string;
  latitude: number;
  longitude: number;
  date_visited?: string;
  description?: string;
}
```

## 10. Birthday Experience

| Action | Method | Call |
|---|---|---|
| Get config | Query | `select * from birthday_experiences where space_id = ?` |
| Create/update config | Server Action | `POST /api/birthday` (creator only) |
| Publish | Server Action | `POST /api/birthday/publish` (creator only) |
| Preview | Server Action | `GET /api/birthday/preview?token=...` (creator only) |

**Config (jsonb) example:**
```json
{
  "slideshowImages": ["memoryId1", "memoryId2"],
  "messages": ["Happy birthday!", "..."],
  "revealAnimation": "confetti",
  "backgroundMusic": "track-id",
  "unlockDate": "2026-11-11"
}
```

## 11. Random Memory (Memory Lane)

| Action | Method | Call |
|---|---|---|
| Get random memory | Server Action | `GET /api/memory-lane/random?mode=surprise&exclude=[]` |

**Logic:** Select random memory from space, excluding the last N viewed by the user (from `memory_views`).

## 12. User Preferences

| Action | Method | Call |
|---|---|---|
| Get preferences | Query | `select * from user_preferences where user_id = auth.uid()` |
| Update preferences | Server Action | `PATCH /api/preferences` |

**Fields:** theme, sound_enabled, volume, mute, reduced_motion

## 13. Activity Events (Internal)

| Action | Method | Call |
|---|---|---|
| Log activity | Server Action | `POST /api/activity` |
| List activity | Query | `select * from activity_events where space_id = ? order by created_at desc limit 20` |

**Actions:** `memory_uploaded`, `letter_opened`, `album_created`, `birthday_viewed`

## 14. Error Handling

All server actions return a consistent shape:

```ts
{ success: boolean; error?: string; data?: unknown }
```

Client components should handle:
- `401` — Unauthorized (redirect to login)
- `403` — Forbidden (not a member / not creator)
- `413` — File too large
- `415` — Unsupported media type
- `500` — Server error (show generic error UI)

## 15. Rate Limits & Quotas

- Max file size: 100 MB per file (configurable)
- Max images per upload: 20
- Max video duration: 10 minutes
- Storage quota warning at 80% of plan limit

