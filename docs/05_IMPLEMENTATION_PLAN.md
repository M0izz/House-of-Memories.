# House of Memories — Implementation Plan & Roadmap

## 1. Development Roadmap (7 Phases)

### Phase 1 — Foundation (Critical)
**Estimated:** 1–2 days  
**Deliverable:** Secure application foundation

| Task | Description |
|---|---|
| Initialize Next.js + TypeScript project | App Router, Tailwind CSS, TypeScript strict mode |
| Establish design tokens | Colours, typography, spacing, animation config in Tailwind config |
| Configure Supabase project | Auth, PostgreSQL, Storage buckets |
| Build authentication | Login, invite-only access, session persistence |
| Create friendship space | `memory_spaces` + `space_members` (creator + member) |
| Database migrations | Run `001_initial_schema.sql` and `002_extended_features.sql` |
| RLS policies | Apply and test all row level security policies |
| Responsive application shell | Layout, navigation, mobile bottom nav, desktop sidebar |
| Environment config | `.env.example`, Vercel env vars |

**Exit criteria:** Both users can log in, see the shared space, and access the app shell securely.

---

### Phase 2 — Memory Engine (Critical)
**Estimated:** 2–3 days  
**Deliverable:** Fully functional collaborative memory library

| Task | Description |
|---|---|
| Private file upload | Supabase Storage upload, file validation (type/size) |
| Media derivatives | Thumbnail generation for images, video poster frames |
| Memory metadata | Title, caption, captured_at, location, tags, album |
| Memory CRUD | Create, read, update, soft-delete (deleted_at) |
| Albums & collections | Create albums, assign cover memory, add/remove memories |
| Masonry gallery | Responsive masonry layout, lazy loading |
| Full-screen viewer | Swipe between photos, metadata display, download |
| Favorites | Per-user favorite toggle |
| Trash/restore | Soft delete with 30-day recovery |
| Contributor attribution | Show who uploaded each memory |
| Realtime updates | Notify other member when a memory is added |

**Exit criteria:** Both members can upload, view, organize, and delete memories; changes appear in realtime for the other user.

---

### Phase 3 — Friendship Experiences
**Estimated:** 1–2 days  
**Deliverable:** The core emotional features

| Task | Description |
|---|---|
| Timeline | Vertical chronological timeline, month/year separators, milestone events |
| Open When letters | Illustrated envelopes, unlock dates, opening animation, handwritten typography |
| Special dates | Countdowns, recurring events, birthday highlighted |
| Random memory generator | Memory Lane modes, anti-repeat logic, shuffle animation |
| Contributor attribution | Displayed on memories and timeline events |

**Exit criteria:** Timeline displays events chronologically; letters respect unlock dates; Memory Lane returns non-repeating random memories.

---

### Phase 4 — Birthday Experience
**Estimated:** 1–2 days  
**Deliverable:** Birthday surprise ready for presentation

| Task | Description |
|---|---|
| Birthday landing | Secret entry point, immersive full-screen experience |
| Countdown | Days/hours until birthday |
| Configurable surprise | JSON config for slideshow, messages, reveal |
| Photo slideshow | Animated photo transitions |
| Birthday letter | Handwritten personal message |
| Celebration animations | Confetti, flowers, floating elements |
| Preview & publish | Creator-only preview via token, publish toggle |
| Link back to library | CTA after reveal |

**Exit criteria:** Creator can configure, preview, and publish the birthday experience; recipient experiences it as a surprise.

---

### Phase 5 — Immersive Features
**Estimated:** 1–2 days  
**Deliverable:** Rich, immersive experience

| Task | Description |
|---|---|
| Interactive memory map | MapLibre GL JS, location markers, memory popups |
| Ambient music & soundscapes | Optional audio, play/pause, volume, mute preference |
| Advanced gallery transitions | Shared-element transitions, spring animations |
| Micro-interactions | Custom cursor (hearts/sparkles), photo tilt on hover |
| Haptic feedback | Mobile touch feedback where supported |

**Exit criteria:** Map displays location memories; audio controls work and respect mute; transitions feel fluid.

---

### Phase 6 — PWA & Reliability
**Estimated:** 1–2 days  
**Deliverable:** Production-ready application

| Task | Description |
|---|---|
| PWA manifest | `manifest.json`, icons, splash screen |
| Service worker | App shell caching, offline fallback |
| Thumbnail caching | Recently viewed thumbnails cached |
| Upload retry queue | IndexedDB queue, retry on reconnect |
| Performance optimization | Lazy loading, image sizing, bundle splitting |
| Logout cleanup | Clear sensitive cached data |
| Mobile & desktop testing | Cross-device verification |

**Exit criteria:** App is installable; offline shell works; failed uploads retry automatically.

---

### Phase 7 — Deployment & Gift Preparation
**Estimated:** 1 day  
**Deliverable:** Live House of Memories

| Task | Description |
|---|---|
| Deploy to Vercel | Production build, environment variables |
| Configure production Supabase | RLS, storage buckets, backups |
| Custom domain | DNS configuration |
| Test both accounts | Creator and recipient access |
| Populate initial memories | Upload seed photos/videos/letters |
| Verify birthday reveal | Test end-to-end surprise flow |
| Send private invitation | Share access with recipient |

**Exit criteria:** Application live on custom domain; both accounts verified; birthday surprise ready.

---

## 2. Suggested Development Schedule (One Developer)

| Phase | Est. Time | Cumulative |
|---|---|---|
| Foundation | 1–2 days | 1–2 days |
| Memory Engine | 2–3 days | 3–5 days |
| Friendship Experiences | 1–2 days | 4–7 days |
| Birthday Experience | 1–2 days | 5–9 days |
| Immersive Features | 1–2 days | 6–11 days |
| PWA & Reliability | 1–2 days | 7–13 days |
| Deployment & Preparation | 1 day | 8–14 days |

**Total: 8–14 working days**

> These are planning estimates, not guaranteed delivery times. Media processing, authentication edge cases, and security testing may extend the schedule. If the birthday is closer, prioritize Phases 1–4 and deploy remaining features incrementally.

---

## 3. Release Strategy

| Release | Name | Scope |
|---|---|---|
| **Release 1** | Birthday Edition | Auth, memory library, albums, uploads, timeline, Open When letters, birthday reveal, responsive animations |
| **Release 2** | Living Archive | Memory map, ambient music, advanced discovery, PWA offline, export/backup |
| **Release 3** | The Forever Version | Advanced organization, more interactions, richer personalization |

---

## 4. Definition of Done (Acceptance Criteria)

### Functional
- [ ] Only the two invited accounts can enter the application
- [ ] Both members can upload media (photos, videos, audio)
- [ ] Uploaded files remain available after logout and across devices
- [ ] Media displays correctly across screen sizes
- [ ] Memories can be organized into albums/collections
- [ ] Timeline events appear in chronological order
- [ ] Locked letters respect their unlock dates
- [ ] Birthday surprise can be previewed (creator) and published
- [ ] Random memory selection works without immediate repetition
- [ ] Location-linked memories appear on the map
- [ ] Music controls work and respect mute preferences
- [ ] App can be installed as a PWA on supported devices
- [ ] Unauthorized users cannot access metadata or files

### Performance
- [ ] Lighthouse Performance: 90+ on representative production pages
- [ ] Initial page interaction: under 3 seconds on typical mobile connection
- [ ] Gallery images lazy-loaded and appropriately sized
- [ ] Animations target 60 FPS on supported devices
- [ ] No unnecessary full-page reloads
- [ ] Upload progress visible; failed uploads recoverable

### Privacy & Security
- [ ] RLS enabled and tested on all tables
- [ ] Storage buckets private; signed URLs short-lived
- [ ] Service-role key never exposed to browser
- [ ] Exactly two members in the shared space

### Persistence
- [ ] PostgreSQL backups configured (Supabase)
- [ ] Media export/backup procedure documented
- [ ] 30-day soft-delete recovery
- [ ] Full data export capability

---

## 5. Features Deliberately Postponed (Not for Release 1)

- AI-generated descriptions of memories
- Automatic face recognition
- AI-generated friendship summaries
- Public sharing pages
- Social feeds
- Complex recommendation systems
- Real-time collaborative editing
- Multiple friendship spaces

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Birthday deadline too close | Prioritize Phases 1–4; ship incremental updates after |
| Media storage costs | Configure upload limits early; monitor Supabase usage |
| Autoplay browser restrictions | Never autoplay audio; require user interaction |
| RLS misconfiguration | Test policies with both accounts before launch |
| Large video downloads | Serve optimized derivatives; no unbounded original downloads |
| Offline data leakage | Clear sensitive cache on logout; don't cache signed URLs long-term |


