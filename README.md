# CoGallery

**Collaborative photo platform for trips, events, and memories — with permanent GitHub archival.**

![Status](https://img.shields.io/badge/status-production--ready-green)
![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What is CoGallery?

CoGallery is a real-time photo sharing platform for group trips and events. It preserves original-quality media with collaborative tools: moodboards, E2E vault rooms, P2P seeding, and free permanent archives on GitHub Pages.

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
| Guest access via invite links | ✅ |
| E2E encrypted vault rooms | ✅ |
| Collaborative moodboard (tldraw + Yjs) | ✅ |
| WebRTC P2P file seeding | ✅ |
| GitHub Pages permanent archive | ✅ |
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
| Archive | GitHub API + GitHub Pages |
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

### 2. Oracle backend (uploads + archive)

```bash
cd ../bot
npm install
cp .env.example .env
# Fill in SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, GITHUB_USERNAME
npm start
```

### 3. Database migrations

Run in Supabase SQL Editor (in order):

1. `SCHEMA_MIGRATION_HIERARCHICAL.sql`
2. `FIX_EVENT_ACCESS_AND_PROFILES.sql`
3. `CANVAS_STATES_MIGRATION.sql`
4. `FIX_CANVAS_RLS.sql` — **required** for canvas security
5. `ADD_EVENT_ARCHIVE_COLUMNS.sql`

Enable **Anonymous sign-ins** in Supabase Auth for guest mode.

---

## Architecture

```
Browser (React PWA)
    ├── Supabase (auth, DB, realtime)
    ├── Oracle Bot (upload, stream, archive, telemetry)
    ├── Cloudflare R2 (object storage)
    └── WebRTC P2P (file seeding between peers)
```

---

## GitHub Archive

Event owners can archive any event to GitHub Pages from **Event Settings → Archive to GitHub**.

The archive includes:
- Static HTML gallery (searchable, mobile-friendly)
- `manifest.json` with photo metadata
- Links to original full-resolution photos on your storage backend

Requires `GITHUB_TOKEN` and `GITHUB_USERNAME` on the Oracle bot.

---

## Development

```bash
cd client
npm run dev          # Start Vite dev server
npm run type-check   # TypeScript
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run build        # Production build
```

CI runs on every push via `.github/workflows/ci.yml`.

---

## Security

- JWT-gated media streaming (zero-trust)
- Event-scoped canvas RLS (`FIX_CANVAS_RLS.sql`)
- Client-side E2E encryption for vault rooms
- EXIF scrubbing on upload

---

## License

MIT
