# House of Memories — Technical Architecture

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                      │
│  Mobile PWA  ·  Desktop Browser  ·  Tablet                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js Application (App Router)               │
│  React · TypeScript · Tailwind CSS · Motion (Framer Motion) │
│  UI Components · Server Actions · API Routes · PWA Shell    │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────┐       ┌───────────────────────┐
│   Supabase: Auth    │       │  Supabase: PostgreSQL │
│   (2-user auth)     │       │  (memory metadata)    │
└─────────────────────┘       └───────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────┐       ┌───────────────────────┐
│  Supabase: Storage  │       │  Supabase: Realtime   │
│  (private media)    │       │  (shared updates)     │
└─────────────────────┘       └───────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ External Services│
                    │ MapLibre · Tiles │
                    │ Licensed Audio   │
                    │ Image Processing │
                    └──────────────────┘
```

**Key principle:** Supabase services communicate through authenticated client and server requests. This is **not** a single sequential execution pipeline — each service is called independently as needed.

## 2. Technology Stack

| Component | Technology | Reason |
|---|---|---|
| Framework | Next.js App Router | Routing, server rendering, API routes |
| Language | TypeScript | Type safety across the stack |
| Styling | Tailwind CSS | Consistent design system, utility-first |
| Animations | Motion (Framer Motion) | Spring-based & shared-element animations |
| UI Primitives | Radix UI | Accessible, unstyled interaction components |
| Icons | Lucide | Consistent, lightweight iconography |
| Backend | Supabase | Integrated backend (Auth + DB + Storage + Realtime) |
| Database | PostgreSQL | Relational memory data with RLS |
| Storage | Supabase Storage | Private media files (photos/videos/audio) |
| Authentication | Supabase Auth | Two-user private authentication |
| Maps | MapLibre GL JS | Interactive memory map (OpenStreetMap-compatible tiles) |
| Dates | date-fns | Date formatting and calculations |
| Validation | Zod | Input validation for forms and server actions |
| Forms | React Hook Form | Upload and editing forms |
| PWA | Web App Manifest + Service Worker | Installable application |
| Hosting | Vercel | Frontend deployment |

**Deliberate exclusions:** No Redis, no Kafka, no separate Python backend, no complex microservices. Keep it maintainable.

## 3. Application Flow

### 3.1 Authentication Flow

1. User opens the application
2. Supabase validates the session (cookie-based)
3. Application checks membership in the private friendship space (`space_members`)
4. If authorized → loads the shared experience
5. If unauthorized → access denied (login/invite screen)

### 3.2 Uploading a Memory

1. User selects photo/video/audio file(s)
2. Client validates file type and size
3. Original file uploads to private Supabase Storage bucket (`memories`)
4. Application inserts metadata into PostgreSQL (`memories` + `memory_media`)
5. Thumbnail/optimized derivative generated and stored (`memory-derivatives`)
6. Realtime channel notifies the other participant
7. New memory appears in the library for both users

### 3.3 Viewing a Memory

1. Application fetches memory metadata from PostgreSQL
2. Verifies membership via RLS
3. Requests a short-lived signed URL for the original or optimized file
4. Browser loads the media
5. Viewer presents the photograph/video with its metadata

## 4. Security Model

### 4.1 Database Security (Row Level Security)
RLS enabled on **every** user-facing table. Example policy for `memories`:

```sql
-- Read: members of the space can read memories
create policy "Space members can read memories"
on memories for select
to authenticated
using (
  exists (
    select 1 from space_members sm
    where sm.space_id = memories.space_id
      and sm.user_id = (select auth.uid())
  )
);

-- Insert: only authenticated members can create, and only as themselves
create policy "Space members can create memories"
on memories for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from space_members sm
    where sm.space_id = memories.space_id
      and sm.user_id = (select auth.uid())
  )
);
```

Equivalent policies for updates, deletions, and all related tables (`albums`, `letters`, `timeline_events`, `special_dates`, `memory_locations`, `memory_favorites`, etc.).

**Composite uniqueness:** For production, add composite uniqueness on `(id, space_id)` for parent tables and use composite foreign keys to prevent records from accidentally referencing resources belonging to another memory space.

### 4.2 Storage Security
- Private bucket `memories` for original files
- Private bucket `memory-derivatives` for thumbnails/optimized derivatives
- Access restricted to authenticated members of the corresponding memory space
- Signed URLs with short expirations (e.g., 5–15 minutes)
- File size and MIME type validation on upload
- **Never** expose the Supabase service-role key to the browser

### 4.3 Membership Rules
- A shared space has exactly **two active members** in v1
- Account invitations are explicit
- Membership changes restricted to the creator role
- Creator retains administrative control; both members are equal contributors

## 5. PWA Architecture

| Capability | Implementation |
|---|---|
| Home-screen installation | Web App Manifest (`manifest.json`) |
| Standalone window | `display: standalone` in manifest |
| Custom icon/splash | Icon set in `public/icons/` + manifest icons |
| Persistent auth | Supabase client persists session in localStorage/cookies |
| Offline shell | Service worker caches app shell |
| Cached thumbnails | Recently viewed thumbnails cached via Cache API |
| Upload retry queue | Failed uploads queued in IndexedDB; retried on reconnect |
| Logout cleanup | Clear sensitive cached data on logout |
| Signed URL cache limit | Never cache signed media URLs beyond lifetime |

## 6. Repository Architecture (Monorepo-style Next.js)

```
house-of-memories/
├── public/
│   ├── icons/
│   ├── illustrations/
│   ├── textures/
│   ├── sounds/
│   ├── fonts/
│   └── manifest.json
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── invite/
│   │   ├── (app)/
│   │   │   ├── home/
│   │   │   ├── memories/
│   │   │   ├── albums/
│   │   │   ├── timeline/
│   │   │   ├── open-when/
│   │   │   ├── memory-lane/
│   │   │   ├── memory-map/
│   │   │   ├── special-dates/
│   │   │   ├── birthday/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── uploads/
│   │   │   ├── memories/
│   │   │   └── birthday/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   ├── navigation/
│   │   ├── gallery/
│   │   ├── albums/
│   │   ├── timeline/
│   │   ├── letters/
│   │   ├── birthday/
│   │   ├── map/
│   │   ├── audio/
│   │   └── animations/
│   ├── features/
│   │   ├── auth/
│   │   ├── memories/
│   │   ├── uploads/
│   │   ├── albums/
│   │   ├── timeline/
│   │   ├── letters/
│   │   ├── memory-lane/
│   │   ├── birthday/
│   │   └── special-dates/
│   ├── hooks/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── storage/
│   │   ├── security/
│   │   ├── validation/
│   │   └── dates/
│   ├── types/
│   └── config/
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── 002_extended_features.sql
│   ├── seed.sql
│   └── config.toml
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── next.config.ts
├── package.json
└── README.md
```

## 7. Deployment & Cost Considerations

| Service | Initial Choice |
|---|---|
| Frontend | Vercel |
| Backend | Supabase |
| Database | Supabase PostgreSQL |
| File storage | Supabase Storage |
| Domain | Custom domain |
| Maps | MapLibre + compatible tile provider |

**Storage planning example:**
- 1,000 photographs averaging 3 MB = 3 GB
- 100 videos averaging 30 MB = 3 GB
- Total original media ≈ 6 GB (excluding derivatives/thumbnails and backups)

**Note:** Free tiers may not provide unlimited media storage, backups, or bandwidth. Monitor usage and configure upload limits from the beginning.

**Biggest cost variable:** Number and size of uploaded photographs and videos.

## 8. Environment Configuration

`.env.example`:

```env
# Supabase (Client)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase (Server-only — NEVER expose to browser)
SUPABASE_SERVICE_ROLE_KEY=

# Application
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME="House of Memories"

# Optional map provider
NEXT_PUBLIC_MAP_STYLE_URL=

# Optional media processing
MEDIA_PROCESSING_ENABLED=false
```

The service-role key must **only** be accessed from trusted server-side code. Never commit real credentials to GitHub.

