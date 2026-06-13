# CoGallery

**Collaborative photo platform for trips, events, and memories.**

![Status](https://img.shields.io/badge/status-production--ready-green)
![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What is CoGallery?

CoGallery is a real-time photo sharing platform for group trips and events. It preserves original-quality media with collaborative tools: moodboards, E2E vault rooms, and P2P seeding.

```
Room (trip) → Event (day/theme) → Photos & Videos
```

---

## Features

| Feature | Status |
|---------|--------|
| Real-time gallery with masonry grid | ✅ |
| Offline upload queue (IndexedDB) | ✅ |
| Chunked + TUS resumable uploads | ✅ |
| E2E encrypted vault rooms | ✅ |
| Collaborative moodboard (tldraw + Yjs) | ✅ |
| WebRTC P2P file seeding | ✅ |
| Admin developer dashboard | ✅ |
| PWA installable | ✅ |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind, Zustand |
| Deploy | Cloudflare Pages |
| Database & Auth | Supabase (PostgreSQL + Realtime) |
| Storage | Cloudflare R2 + Oracle streaming backend |
| Canvas | tldraw v5 + Yjs CRDT |
| P2P | WebRTC + Supabase signaling |

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/yourusername/cogallery.git
cd cogallery/client
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_BACKEND_URL
npm run dev
```

### 2. Oracle backend (uploads)

```bash
cd ../bot
npm install
cp .env.example .env
# Fill in SUPABASE_SERVICE_ROLE_KEY
npm start
```

### 3. Database migrations

Run in Supabase SQL Editor (in order):

1. `SCHEMA_MIGRATION_HIERARCHICAL.sql`
2. `FIX_EVENT_ACCESS_AND_PROFILES.sql`
3. `CANVAS_STATES_MIGRATION.sql`
4. `FIX_CANVAS_RLS.sql` — **required** for canvas security

---

## Architecture

```
Browser (React PWA)
    ├── Supabase (auth, DB, realtime)
    ├── Oracle Bot (upload, stream, telemetry)
    ├── Cloudflare R2 (object storage)
    └── WebRTC P2P (file seeding between peers)
```

---



## Development

```bash
cd client
npm run dev          # Start Vite dev server
npm run type-check   # TypeScript
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
npm run build        # Production build
```

CI runs on every push via `.github/workflows/ci.yml`.

---

## Observability & Analytics
CoGallery is configured for production-grade observability:
- **Sentry**: Error tracking and session replay. Requires `VITE_SENTRY_DSN` in your `.env`.
- **PostHog**: Product analytics. Requires `VITE_POSTHOG_KEY` in your `.env`.

---

## Security

- JWT-gated media streaming (zero-trust)
- Event-scoped canvas RLS (`FIX_CANVAS_RLS.sql`)
- Client-side E2E encryption for vault rooms
- EXIF scrubbing on upload

---

## License

MIT
