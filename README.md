# House of Memories

A private digital home for shared memories — a two-person memory archive application built with Next.js, Supabase, Tailwind CSS, and Motion.

> Some moments deserve a place that time can't touch.

## 📋 Specification Documents

| Document | Path |
|---|---|
| Product Requirements | `docs/01_PRODUCT_REQUIREMENTS.md` |
| Technical Architecture | `docs/02_TECHNICAL_ARCHITECTURE.md` |
| Database Schema | `docs/03_DATABASE_SCHEMA.md` |
| UI/UX Specification | `docs/04_UI_UX_SPECIFICATION.md` |
| Implementation Plan | `docs/05_IMPLEMENTATION_PLAN.md` |
| API Contracts | `docs/06_API_CONTRACTS.md` |

## 🗄️ Database Migrations

| Migration | Path |
|---|---|
| Initial Schema | `supabase/migrations/001_initial_schema.sql` |
| Extended Features | `supabase/migrations/002_extended_features.sql` |
| Seed Data | `supabase/seed.sql` |

## 🚀 Getting Started

1. Copy `.env.example` to `.env.local` and fill in Supabase credentials.
2. Install dependencies: `npm install`
3. Run migrations against your Supabase project.
4. Start the dev server: `npm run dev`
5. Open `http://localhost:3000`

## 🛠️ Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Motion (Framer Motion)
- **Backend:** Supabase (Auth, PostgreSQL, Storage, Realtime)
- **Maps:** MapLibre GL JS
- **Deployment:** Vercel
- **PWA:** Web App Manifest + Service Worker

## 📦 Releases

- **Release 1 — Birthday Edition:** Auth, memory library, albums, uploads, timeline, Open When letters, birthday reveal
- **Release 2 — Living Archive:** Memory map, ambient music, PWA offline, export/backup
- **Release 3 — The Forever Version:** Advanced organization, richer personalization

## 🔒 Privacy

Private by default. Exactly two members per space. Row Level Security on all tables. Private storage buckets with signed URLs.
