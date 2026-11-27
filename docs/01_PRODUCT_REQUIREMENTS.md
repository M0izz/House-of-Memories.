# House of Memories — Product Requirements Document
**Product Blueprint v1.0**  
**Status:** Final — approved for implementation  
**Application:** Private two-person digital memory archive  
**Name:** House of Memories

---

## 1. Product Definition

### 1.1 Product Vision
House of Memories is a private digital space shared by two people, designed to preserve, organize, experience, and continuously create memories together. It starts as a birthday surprise but evolves into a living digital archive of a friendship.

Unlike conventional cloud storage, the product focuses on the **emotional experience** of revisiting memories rather than merely storing files. Every interaction should feel personal, delightful, and intentional.

### 1.2 Product Objectives

| Objective | Expected Outcome |
|---|---|
| **Preserve** | Store photos, videos, audio, and written memories privately and durably |
| **Connect** | Give both people a shared digital space for their friendship |
| **Discover** | Make revisiting forgotten moments enjoyable and surprising |
| **Create** | Allow both people to contribute new memories effortlessly |
| **Surprise** | Deliver birthday experiences and hidden interactive moments |
| **Last** | Preserve memories across devices, browser refreshes, and over years |

### 1.3 Core Product Principles

1. **Emotion before functionality:** Every screen should feel personal, not like a dashboard.
2. **Simplicity before complexity:** Uploading a photograph should take seconds.
3. **Privacy by default:** Nobody except the two members can access the archive.
4. **Delight in interaction:** Animations should feel natural, spring-based, and intentional.
5. **Persistence:** Memories must survive browser refreshes, device changes, and app updates.
6. **Continuity:** The app remains useful long after the birthday surprise.

### 1.4 Target Users

Two authenticated members only:

| Role | Description |
|---|---|
| **Creator** | The person who initially prepares the archive and birthday surprise; retains administrative control of the shared space |
| **Recipient** | The friend who receives access and becomes an equal contributor |

**There is no public registration, no public profiles, and no public memory feed.**

---

## 2. Application Structure & Information Architecture

The application has **seven sections** organized around a central home experience.

### 2.1 Main Navigation (Desktop & Tablet)

| Section | Purpose |
|---|---|
| **Home** | Personalized welcome, featured memory, countdowns, quick upload |
| **Memories** | Photos, videos, albums, collections, search |
| **Timeline** | Chronological friendship history with milestones |
| **Open When** | Private letters with conditional unlocking |
| **Memory Lane** | Randomized memory discovery |
| **Memory Map** | Geographic collection of shared places |
| **Special Dates** | Countdowns and important occasion calendar |
| **Settings** | Accounts, privacy, storage, preferences |

### 2.2 Mobile Navigation

A floating bottom navigation with **four primary destinations**:
1. Home
2. Memories
3. Timeline
4. More (contains Open When, Memory Lane, Memory Map, Special Dates, Settings)

---

## 3. Detailed Functional Requirements

### 3.1 Home — The Emotional Starting Point

The homepage should feel like entering a personal space, not opening a dashboard.

**Requirements:**
- Personalized greeting (e.g., "Welcome home, [name]")
- Current date and relevant countdown (birthday, special dates)
- Featured memory (rotates periodically or on user request)
- Recently added photographs
- Memory of the day
- Quick upload button (prominent)
- Recently opened albums
- Special occasion notifications
- Birthday surprise entry point (secret/hidden)
- Small ambient visual details (floating elements, subtle particles)

**Key interaction:** The featured memory should change periodically or when the user explicitly requests another one.

### 3.2 Memory Library — The Heart of the App

**Supported content:**

| Content | Supported Formats |
|---|---|
| Images | JPG, JPEG, PNG, WebP, HEIC (converted on upload) |
| Videos | MP4, MOV (browser-compatible derivatives generated) |
| Audio | MP3, M4A, WAV |
| Text | Captions, stories, notes |

**Features:**
- Masonry-style gallery layout
- Albums and custom collections
- Date-based organization (year/month groupings)
- Search by caption, tags, date, and album
- Favorites (per-user)
- Multi-file upload
- Drag-and-drop upload on desktop
- Camera/gallery selection on mobile
- Edit captions and metadata
- Soft delete with trash/restore (30-day recovery)
- Full-screen photo viewer
- Swipe between photographs
- Download original files
- Contributor attribution (who uploaded each memory)

**Memory metadata (each memory supports):**
- Title
- Description / caption
- Date captured
- Date uploaded
- Location (optional)
- Tags
- Album
- Contributor (user ID)
- Media type
- Favorite status

**Critical design decision:** Store original files independently of optimized display versions. Never destroy the original photograph when generating thumbnails.

### 3.3 Our Timeline — Chronological Friendship History

**Example events:**
- The day you first met
- Your first photograph together
- First outing / adventure
- Birthdays
- Trips and vacations
- Funny incidents
- Recent memories

**Requirements:**
- Vertical chronological timeline
- Month and year separators
- Photograph and video previews per event
- Custom milestones (manually created events)
- Editable event dates
- Filters by year
- Jump to a specific date
- Ability to attach multiple memories to one event
- Progressive reveal as user scrolls (memories fade in)

### 3.4 Open When — Private Letters

**Opening conditions:**

| Letter | Opening Condition |
|---|---|
| Open when you're sad | Immediate |
| Open when you miss our memories | Immediate |
| Open when you need a laugh | Immediate |
| Open on your birthday | Specific date (unlock_at) |
| Open on our next adventure | Manual unlock |
| Open when you forget how special you are | Immediate |

**Letter experience:**
1. Collection of illustrated envelopes displayed
2. User selects an envelope
3. Opening animation plays (envelope unfolds)
4. Letter unfolds with handwritten typography
5. Content appears (text, optional photo, audio, background music)
6. Letters can optionally have unlock dates

**Security:** Letters are **not editable by the recipient** unless the creator explicitly permits it.

### 3.5 Hidden Birthday Surprise

A separate experience, not simply another page.

**Proposed experience:**
- Secret entry point on the home screen
- Countdown before the birthday
- Animated envelope or gift opening
- Personalized introductory message
- Photograph slideshow
- Collection of handwritten messages
- Special birthday letter
- Final reveal with confetti, flowers, celebratory effects

**Possible sequence:**
1. **The invitation** — Animated message invites her to open something special
2. **The journey** — Photographs showing how the friendship evolved
3. **The little things** — Inside jokes, silly screenshots, unforgettable moments
4. **The letter** — Personal message written by the creator
5. **The reveal** — Final birthday animation + link back to memory library

**Configuration:** The reveal is configurable — preparable and testable before the birthday without exposing the surprise.

### 3.6 Random Memory Generator (Memory Lane)

**Modes:**
- Surprise me
- Random photograph
- Random video
- Random album
- Random memory from this month in previous years
- Random memory from a particular year

**Constraint:** The system should avoid immediately repeating the last few memories (tracked in `memory_views`).

**Interaction:** Small animated shuffle effect reveals the selected photograph.

### 3.7 Music & Ambient Soundscapes

**Principles:** Optional, never intrusive, never autoplay unexpectedly.

**Features:**
- Ambient background sound (soft piano, rain, café ambience, gentle instrumental, nature sounds)
- Optional playlists
- Play/pause controls
- Volume control
- Mute preference (persisted)
- Per-experience sound settings
- Music accompanying birthday slideshows

**License:** Use original, licensed, or royalty-free tracks only.

### 3.8 Interactive Memory Map

**Per location-linked memory:**
- Place name
- Latitude and longitude
- Date visited
- Attached photographs
- Description
- Contributor

**Interaction:** Clicking a marker opens a small memory card.

**Technical:** MapLibre GL JS with OpenStreetMap-compatible tiles (subject to tile provider usage/attribution requirements).

**Privacy:** Locations visible only inside the authenticated application. Consider approximate locations instead of precise coordinates.

### 3.9 Special Dates — Countdown Calendar

- Shared calendar of meaningful dates
- Countdown to each date
- Recurring and one-time events
- Notifications on home screen

### 3.10 Settings

- Account management
- Sound/music preferences
- Theme preferences
- Storage usage view
- Data export
- Logout (clears sensitive cached data)

---

## 4. Non-Functional Requirements

### 4.1 Privacy & Security
- **Private by default:** No public URLs, no public albums, no public feeds
- **Two-user limit:** A shared space has exactly two active members in v1
- **Row Level Security (RLS):** Enabled on every user-facing table
- **Storage policies:** Supabase Storage policies separate from PostgreSQL RLS; both must be configured
- **Signed URLs:** Short-lived signed URLs for media access; no direct public file URLs
- **Service role key:** Never exposed to the browser; server-side only
- **Membership validation:** Never trust client-submitted `space_id` or ownership claims; validate server-side

### 4.2 Performance Targets

| Metric | Target |
|---|---|
| Lighthouse Performance | 90+ on representative production pages |
| Initial page interaction | Under 3 seconds on typical mobile connection |
| Gallery images | Lazy-loaded, appropriately sized |
| Animations | 60 FPS on supported devices |
| Full-page reloads | No unnecessary reloads |
| Video downloads | No unbounded original-video downloads |
| Upload progress | Must be visible |
| Failed uploads | Must be recoverable |

### 4.3 Persistence & Backup
- Scheduled PostgreSQL backups via Supabase
- Periodic export of original media to separate backup location
- Documented restoration procedure
- 30-day deletion recovery period (soft delete)
- Ability to export all memories and metadata
- Database backups and media backups are separate concerns

### 4.4 PWA / Offline
- Home-screen installation (Android, iOS, desktop)
- Standalone application window
- Custom icon and splash experience
- Persistent authentication
- Offline application shell
- Cached thumbnails for recently viewed memories
- Upload retry queue (IndexedDB) when connectivity returns
- Clear sensitive cached data on logout
- Never cache signed media URLs beyond intended lifetime

---

## 5. Release Strategy

| Release | Name | Must Have |
|---|---|---|
| **Release 1** | Birthday Edition | Authentication, shared memory library, albums, uploads, timeline, Open When letters, birthday reveal, responsive animations |
| **Release 2** | Living Archive | Memory map, ambient music, advanced discovery, PWA offline capabilities, export and backup |
| **Release 3** | The Forever Version | Advanced memory organization, additional interactive experiences, richer personalization |

---

## 6. Features Deliberately Postponed

- AI-generated descriptions of memories
- Automatic face recognition
- AI-generated friendship summaries
- Public sharing pages
- Social feeds
- Complex recommendation systems
- Real-time collaborative editing
- Multiple friendship spaces

*Avoid introducing AI simply because it's fashionable. This product's uniqueness comes from the memories themselves and how beautifully they are experienced.*

---

## 7. Open Questions / Decisions Needed Before Development

1. **Birthday date:** Required to determine countdown, letter unlocking, reveal scheduling, and development deadline priority.
2. **Custom domain:** To be configured for production deployment.
3. **Map tile provider:** Selection subject to usage and attribution requirements.
4. **Audio tracks:** Licensed or royalty-free ambient tracks to be procured.
5. **Storage quota:** Initial upload limits to be configured based on expected media volume.
