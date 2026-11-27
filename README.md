# 🌸 House of Memories

<p align="center">
  <em>A warm, private digital sanctuary for two — crafted to preserve cherished moments, shared laughter, and lifelong memories.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v3.4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Motion-Framer-FF0055?style=flat-square&logo=framer" alt="Motion" />
  <img src="https://img.shields.io/badge/Cloudflare-Workers%20%26%20D1-F38020?style=flat-square&logo=cloudflare" alt="Cloudflare" />
  <img src="https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" />
</p>

---

## ✨ Overview

**House of Memories** is an intimate, scrapbook-inspired private archive designed exclusively for two people. It abandons sterile SaaS dashboard aesthetics in favor of tactile paper textures, delicate blush tones, warm cream surfaces, washi-tape accents, and handwritten touches.

> *"Some moments deserve a place that time cannot touch."*

---

## 🎨 Design Philosophy & Aesthetic

- **Color Palette:**
  - **Warm Cream** (`#FFF8F5`) — Soft, parchment-like canvas background
  - **Blush Pink** (`#F6E4EC`) — Gentle romantic accents and tags
  - **Plum Ink** (`#493C46`) — Elegant, readable contrast for typography
  - **Butter / Warm Sand** (`#F7EBD5`) — Nostalgic polaroid paper feel
- **Scrapbook Detailing:** Organic card rotations (`-rotate-1`, `rotate-2`), washi-tape corners, stitched borders, paper drop shadows, and soft ambient light.
- **Typography:** Refined serif headlines paired with intimate handwritten scripts and clean sans-serif body copy.

---

## 🚀 Key Features

### 1. 📖 Living Home & Memory Lane
- **Dynamic Featured Memory:** Periodically highlights unforgettable moments with stories, dates, and locations.
- **Time Capsule ("One Year Ago Today"):** Automatically surfaces memories captured on today's date in previous years.
- **Serendipity ("Discover a Memory"):** Randomly presents a memory to relive together.
- **Quick Shortcuts:** Direct access to Open When letters, the current featured album, and milestone previews.

### 2. 📂 Direct Folder & Multi-File Uploader
- **Folder Upload (`webkitdirectory`):** Upload entire nested folders directly from your computer in one click.
- **Recursive Drag & Drop:** Traverses directories recursively using `webkitGetAsEntry` without flattening or losing origin data.
- **Visual Staging Area:** Instant thumbnail previews, folder origin attribution badges (`📁 Summer2024`), media type indicators (Photos, Videos, Audio), and tag inputs before committing.
- **Batch Pipeline:** Seamless bulk upload API (`/api/memories`) saving both individual items and full collections.

### 3. 🖼️ Collaborative Many-to-Many Albums (`/albums`)
- **Album Grid & Search:** Filter by keyword and sort by Newest, Oldest, Recently Updated, or Alphabetical.
- **Many-to-Many Junction Architecture (`album_memories`):** A single memory can belong to multiple albums simultaneously without duplicating original files.
- **Direct Album Ingestion:** Upload new files or folders directly into a specific album, or select from existing archive memories.
- **Album Management:** Customize titles, descriptions, and cover photos with safe deletion (removes the album container while keeping all original memories intact).

### 4. 🎂 Annual Birthday Countdown & Celebration System
- **Floating Draggable Widget:** Persistent, draggable countdown widget with minimize/expand states and screen-edge snapping.
- **Perpetual Annual Recurrence:** Automatically calculates the next occurrence (repeating annually on November 24) without requiring manual year updates.
- **Celebration Mode:** Switches to a festive birthday greeting with celebratory animations when the countdown arrives.

### 5. 🔔 Automated Web Push Notifications
- **Browser Push API & Service Worker:** Zero-cost notification pipeline powered by standard Web Push API and VAPID authentication.
- **Scheduled Delivery via Cloudflare Workers:** Cloudflare Cron Triggers periodically scan schedules, calculate local timezones, and deliver reminder notifications with strict idempotency.
- **Preference Controls:** Opt-in permission flow, timezone configurations, and test notification dispatchers.

### 6. 💌 Open When Letters & Milestone Timeline
- **Digital Envelopes:** Sealed letters to open during specific moments ("Open when you miss me", "Open when you need a laugh").
- **Our Timeline:** Visual roadmap of core milestones and relationship chapters.

---

## 🏗️ Technical Architecture

```
House of Memories
├── src/
│   ├── app/
│   │   ├── albums/                 # Albums list & detail pages (/albums, /albums/[id])
│   │   ├── api/                    # API routes (memories, albums, push notifications)
│   │   ├── birthday/               # Dedicated Birthday celebration page
│   │   ├── memories/               # Memory library with folder uploader
│   │   ├── timeline/               # Milestone timeline
│   │   ├── letters/                # Open When envelopes
│   │   ├── dates/                  # Special recurring dates
│   │   └── settings/               # Notifications & space settings
│   ├── components/
│   │   ├── birthday/               # FloatingCountdown widget
│   │   └── navigation/             # Sidebar, Header, MobileNav
│   └── lib/
│       ├── albums-store.ts         # In-memory & D1 many-to-many store
│       ├── birthday.ts             # Annual recurrence calculation engine
│       ├── push-notifications.ts   # VAPID & Web Push utilities
│       └── sample-data.ts          # Memory, Album & Milestone models
├── worker/                         # Cloudflare Worker for Push Cron Triggers
│   ├── src/index.ts                # Notification scheduler worker
│   ├── wrangler.toml               # Cloudflare configuration
│   └── d1-schema.sql               # SQLite / D1 table definitions
├── supabase/                       # Supabase PostgreSQL migrations
└── docs/                           # Comprehensive product & architecture specifications
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, React Server Components) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **Motion & Animation** | [Motion (Framer Motion)](https://motion.dev/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Backend & Auth** | [Supabase](https://supabase.com/) & [Cloudflare D1 / Workers](https://workers.cloudflare.com/) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) |
| **PWA & Push** | Service Workers, Web Push API, Web App Manifest |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.17+ or later
- npm or pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/M0izz/House-of-Memories..git
   cd "House of Memories"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file from the provided example:
   ```bash
   cp .env.example .env.local
   ```
   Add your VAPID keys and Supabase credentials if integrating external storage.

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

5. **Open in Browser:**
   Visit [http://localhost:3000](http://localhost:3000) to enter House of Memories.

---

## 🔒 Privacy & Security

- **Private by Design:** Built specifically as an intimate two-person space.
- **No Third-Party Trackers:** Zero ad networks, telemetry scripts, or analytics payloads.
- **VAPID Secured Push:** Browser notifications authenticated using industry-standard VAPID keys without transmitting private data to external providers.

---

<p align="center">
  Made with ❤️ for our unforgettable moments.
</p>
