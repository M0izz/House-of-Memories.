# House of Memories — UI/UX Design Specification

## 1. Visual Identity

### 1.1 Design Languages (Combined)

| Language | Characteristics |
|---|---|
| **Apple-like fluidity** | Glass, depth, spring motion, responsive interactions |
| **Nostalgic scrapbook** | Paper textures, Polaroids, handwritten notes, organic layouts |
| **Dreamy atmosphere** | Soft colours, delicate lighting, floating particles, subtle details |
| **Premium editorial** | Beautiful typography, whitespace, intentional composition |

### 1.2 Colour System

| Role | Name | Hex | Usage |
|---|---|---|---|
| Background | Warm Cream | `#FFF8F5` | Primary foundation, most surfaces |
| Accent | Blush Pink | `#F6E4EC` | Meaningful accents, buttons, highlights |
| Accent | Lavender | `#EDE8F7` | Secondary accents, hover states |
| Accent | Sage | `#E4F0E8` | Success states, nature elements |
| Accent | Butter | `#F7EBD5` | Warm highlights, envelopes, cards |
| Text | Plum Ink | `#493C46` | Headings, body text, primary contrast |

**Usage guidance:** Use cream as the foundation. Reserve pink, lavender, and sage for meaningful accents — do not paint every screen pink.

### 1.3 Typography

| Use | Font | Fallback |
|---|---|---|
| Headings | Playfair Display | Georgia, serif |
| Body | DM Sans | Inter, sans-serif |
| Handwritten accents | Caveat | Comic Sans MS, cursive |

### 1.4 Materials & Textures

- Soft paper surfaces
- Subtle grain and film textures
- Delicate shadows
- Translucent floating panels (glassmorphism)
- Rounded cards with varied, intentional shapes

---

## 2. Animation System

Built with Motion (Framer Motion) using spring-based animations.

| Interaction | Behaviour |
|---|---|
| Photo hover | Gentle scale + subtle tilt (responds to cursor) |
| Album opening | Expanding shared-element transition |
| Page navigation | Soft fade + directional movement |
| Modal opening | Spring scale + opacity |
| Upload completion | Small visual celebration |
| Letter opening | Envelope unfolding animation |
| Timeline scroll | Progressive reveal (fade-in as user scrolls) |
| Gallery swipe | Natural momentum + snapping |
| Birthday reveal | Layered confetti + floating elements |

**Example configuration:**

```tsx
import { motion } from "motion/react";

export function MemoryCard({ children }) {
  return (
    <motion.div
      whileHover={{ scale: 1.025, y: -4 }}
      whileTap={{ scale: 0.975 }}
      transition={{
        type: "spring",
        stiffness: 280,
        damping: 22
      }}
      layout
    >
      {children}
    </motion.div>
  );
}
```

### 2.1 Animation Tokens

| Property | Value |
|---|---|
| Spring stiffness | 280 |
| Spring damping | 22 |
| Default duration | 0.4s |
| Ease | `easeOut` / `circOut` |

### 2.2 Reduced Motion

Respect `prefers-reduced-motion`. When enabled, disable or significantly reduce:
- Parallax effects
- Floating particles
- Hover tilts
- Complex shared-element transitions

## 3. Responsive Layouts

| Device | Gallery Columns | Layout Pattern |
|---|---|---|
| Small mobile | 1–2 | Bottom nav, swipeable galleries, touch-first |
| Large mobile | 2 | Bottom nav, touch-first |
| Tablet | 2–3 | Sidebar or top nav, expanded cards |
| Desktop | 3–5 | Sidebar navigation, larger viewer |
| Large desktop | 4–6 | Constrained content width, sidebar |

**Mobile-first design:** Do not simply shrink the desktop design. Create separate mobile interaction patterns:
- Touch targets ≥ 44 × 44 CSS pixels
- Swipe gestures must not interfere with vertical scrolling
- Haptics only where supported and permitted

---

## 4. Screen-by-Screen Specification

### 4.1 Home — Welcome Experience

**Layout:** Centered, personal, atmospheric.

**Elements:**
- Personalized greeting: "Welcome home, [name]"
- Current date + relevant countdown (birthday/special dates)
- Featured memory card (rotates periodically or on request)
- Recently added photographs (small horizontal scroll)
- Memory of the day
- Prominent quick upload button (floating action button)
- Recently opened albums (horizontal carousel)
- Special occasion notifications
- Secret birthday surprise entry point (discreet, discoverable)
- Ambient visual details: floating particles, subtle parallax

**Interactions:**
- Featured memory changes on timer or user tap
- Quick upload opens the upload modal
- Birthday entry point is hidden behind a subtle gesture or icon

### 4.2 Memory Library — Gallery

**Layout:** Masonry grid (responsive columns).

**Elements:**
- Memory cards (Polaroid-style with slight rotation variance)
- Album/collection filters
- Search bar (caption, tags, date, album)
- Favorite toggle (heart)
- Upload button (multi-select supported)
- Empty state: "No memories yet — add your first"

**Card interactions:**
- Tap → open full-screen viewer
- Long press → selection mode (multi-select)
- Heart tap → toggle favorite
- Drag → reorder (within album, optional)

**Viewer interactions:**
- Swipe left/right → navigate between photographs
- Pinch → zoom (images)
- Tap → toggle UI controls
- Drag down → close viewer

### 4.3 Albums

**Layout:** Album covers look like little books/scrapbook pages.

**Elements:**
- Album cover image (cover memory)
- Album title + description
- Memory count
- Member contribution indicators
- Add memory to album button

### 4.4 Full-Screen Memory Viewer

**Elements:**
- Media (image/video/audio player)
- Title, caption, date captured
- Location (if available)
- Contributor attribution ("Added by [name]")
- Tags
- Favorite button
- Download original button
- Share within app (send to the other member)
- Close button

### 4.5 Upload Experience

**Desktop:** Drag-and-drop zone + file browser button
**Mobile:** Camera/gallery selection button

**Flow:**
1. Select file(s)
2. Validation (type, size) — inline feedback
3. Upload progress bar per file
4. Metadata entry (title, caption, date, location, tags, album)
5. Submit → success celebration animation
6. Realtime notification to other member

**Supported formats:** JPG, JPEG, PNG, WebP, HEIC, MP4, MOV, MP3, M4A, WAV

### 4.6 Timeline — Friendship History

**Layout:** Vertical chronological timeline.

**Elements:**
- Month/year separators
- Event cards with photograph/video previews
- Custom milestone markers
- Year filter pills
- "Jump to date" control
- Progressive reveal on scroll

**Event card:**
- Event title + description
- Date
- Attached memories (multiple per event)
- Cover media

### 4.7 Open When — Letters

**Layout:** Collection of illustrated envelopes arranged organically.

**Elements:**
- Envelope cards (each represents a letter)
- Letter title (e.g., "Open when you're sad")
- Lock indicator (if unlock date in future)
- Open button / tap envelope

**Opening flow:**
1. User taps envelope
2. Envelope unfolding animation plays
3. Letter unfolds with handwritten typography (Caveat font)
4. Content appears (text, optional photo/audio/background music)
5. Close → returns to envelope collection

**Locked letters:** Show lock icon and unlock date; cannot be opened before `unlock_at`.

### 4.8 Memory Lane — Random Discovery

**Layout:** Centered discovery experience.

**Elements:**
- Mode selector (Surprise me / Photo / Video / Album / This month previous years / Particular year)
- Shuffle button
- Reveal area (animated shuffle → memory appears)
- "Another one" button
- Anti-repeat notice (last N memories excluded)

### 4.9 Memory Map

**Layout:** Full-screen map with memory markers.

**Elements:**
- MapLibre GL JS map (OpenStreetMap-compatible tiles)
- Location markers (one per location-linked memory)
- Marker click → small memory card popup
- Cluster markers when zoomed out
- Location filter

### 4.10 Special Dates

**Layout:** Calendar + countdown list.

**Elements:**
- Upcoming special dates with countdowns
- Recurring vs one-time indicators
- Add/edit date form
- Birthday highlighted prominently

### 4.11 Birthday Surprise (Hidden Experience)

**Layout:** Full-screen immersive experience, separate from normal navigation.

**Sequence:**
1. **The invitation** — Animated message invites opening
2. **The journey** — Photograph slideshow (friendship evolution)
3. **The little things** — Inside jokes, screenshots, moments
4. **The letter** — Personal handwritten message
5. **The reveal** — Confetti, flowers, celebration + link back to library

**Controls:**
- Countdown timer (before birthday)
- Preview mode (creator only, via preview token)
- Publish toggle
- Background music toggle

### 4.12 Settings

**Elements:**
- Account info
- Sound/music preferences (toggle, volume slider)
- Theme preference
- Storage usage view
- Data export button
- Logout button (clears cache)

---

## 5. Custom Cursor (Desktop)

- Default: subtle dot or ring
- Hover over interactive elements: tiny heart or sparkle
- Respect `prefers-reduced-motion` (disable cursor effects if needed)

---

## 6. Accessibility

- Touch targets ≥ 44 × 44 CSS pixels
- Sufficient colour contrast (Plum Ink on Warm Cream meets WCAG AA)
- Keyboard navigation support
- ARIA labels on all interactive elements
- Reduced motion support
- Focus visible states
- Screen reader friendly (image alt text, live regions for upload progress)

