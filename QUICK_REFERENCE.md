# CoGallery - Quick Reference Guide

## 🎯 At a Glance

| Aspect | Details |
|--------|---------|
| **Project** | Permanent photo sharing platform |
| **Phase** | 1 of 4 (MVP building) |
| **Frontend Status** | ✅ Scaffolding complete |
| **Backend Status** | 🔄 Ready to build |
| **Timeline** | 12 weeks total (4 phases) |
| **Team Size** | 1-2 developers |
| **Estimated MVP Hours** | 50-60 hours |

---

## 🏗️ Architecture at a Glance

```
Browser (React)  →  Supabase (PostgreSQL + Realtime)  →  AWS S3 (Photos)
    ↓                         ↓
  Vite                    GitHub Pages (Archive)
  React Router
  Tailwind CSS
  Zustand
```

---

## 📦 Tech Stack

```
FRONTEND              BACKEND              STORAGE
├─ React 18          ├─ Supabase           ├─ AWS S3
├─ TypeScript        ├─ PostgreSQL         ├─ CloudFront
├─ Vite              ├─ Realtime WS        └─ GitHub Pages
├─ Tailwind CSS      └─ Auth
├─ PhotoSwipe
├─ Zustand
└─ React Router
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/          ← Reusable UI components
│   ├── gallery/     ← Gallery-specific
│   └── shared/      ← Layout components
├── pages/           ← Page components
├── hooks/           ← Custom React hooks
├── store/           ← Zustand stores
├── lib/             ← Utilities & SDK clients
├── types/           ← TypeScript definitions
├── styles/          ← Global CSS
└── utils/           ← Helper functions
```

---

## 🎨 Design System Colors

```
Primary:      #3B82F6 (Blue)      [Main brand color]
Secondary:    #8B5CF6 (Purple)    [Secondary accent]
Accent:       #EC4899 (Pink)      [Call-to-action]
Success:      #10B981 (Green)     [Success states]
Error:        #EF4444 (Red)       [Error states]
Warning:      #F59E0B (Amber)     [Warnings]

Grayscale:
├─ Primary:   #0F172A (Slate-900)  ← Text
├─ Secondary: #475569 (Slate-600)  ← Secondary text
└─ Tertiary:  #94A3B8 (Slate-400)  ← Disabled text
```

---

## 📱 Responsive Breakpoints

```
sm:  640px   │ md:  768px   │ lg:  1024px  │ xl:  1280px  │ 2xl: 1536px
─────────────┼──────────────┼──────────────┼──────────────┼─────────────
Mobile      │ Tablet       │ Desktop      │ Large Desktop
```

---

## ⌨️ Keyboard Shortcuts

```
npm run dev          → Start dev server (port 5173)
npm run build        → Production build
npm run preview      → Preview production
npm run lint         → Run ESLint
npm run type-check   → TypeScript check
```

---

## 🗂️ File Locations

```
Components:     src/components/ui/ and src/components/shared/
Pages:          src/pages/
Styles:         src/styles/globals.css
Types:          src/types/index.ts
State:          src/store/
Hooks:          src/hooks/
Backend Client: src/lib/supabase.ts
Config:         vite.config.ts, tailwind.config.ts
Environment:    .env.local (create from .env.example)
```

---

## 🔐 Authentication Flows

```
Sign Up                Login                Guest Mode
├─ Email input         ├─ Email input       ├─ No input
├─ Password input      ├─ Password input    ├─ Generate anon ID
├─ Display name        └─ Authenticate     └─ Create session
├─ Confirm password
├─ Create account
└─ Auto-login
```

---

## 🖼️ Page Hierarchy

```
/ (Home)
├─ /auth (Login)
│  ├─ Sign Up
│  ├─ Login
│  └─ Guest
├─ /event/:code (Event Gallery)
│  ├─ PhotoGrid
│  ├─ PhotoLightbox
│  ├─ ShareDialog
│  └─ Upload
└─ /* (404)
```

---

## 📊 Data Models

```
User {
  id: UUID
  email?: string
  displayName: string
  avatarUrl?: string
  isGuest: boolean
  createdAt: timestamp
}

Event {
  id: UUID
  code: string (6 chars)
  title: string
  description?: string
  ownerId: UUID
  privacy: 'private' | 'shared' | 'public'
  createdAt: timestamp
}

Photo {
  id: UUID
  eventId: UUID
  uploaderId: UUID
  filename: string
  contentHash: string (SHA256)
  fileSizeBytes: number
  s3Url: string
  thumbnailUrl?: string
  takenAt?: timestamp
  createdAt: timestamp
}
```

---

## 🔄 Real-Time Events

```
photo_uploaded    → New photo added to gallery
photo_deleted     → Photo removed
reaction_added    → User reacted with emoji
comment_added     → New comment posted
user_invited      → Someone joined event
event_archived    → Event archived to GitHub
```

---

## 🎯 MVP Feature Checklist

**Week 1:**
- [ ] Database schema created
- [ ] Authentication working
- [ ] Event creation done

**Week 2:**
- [ ] Photo upload working
- [ ] Gallery grid showing
- [ ] Real-time sync enabled

**Week 3:**
- [ ] Thumbnail generation
- [ ] Search/filter working
- [ ] Mobile optimized

**Week 4:**
- [ ] Archive to GitHub
- [ ] Full E2E testing
- [ ] Performance optimized

---

## 🚀 Deployment Checklist

```
Frontend:
- [ ] Build succeeds (npm run build)
- [ ] No console errors
- [ ] Lighthouse 80+
- [ ] Mobile responsive ✅
- [ ] Dark mode works ✅
- [ ] Push to GitHub
- [ ] Deploy to Vercel

Backend:
- [ ] Supabase RLS policies
- [ ] Environment variables set
- [ ] Database backups enabled
- [ ] API rate limiting
- [ ] CORS configured
- [ ] S3 bucket secured

Archive:
- [ ] GitHub Actions workflow
- [ ] GitHub Pages enabled
- [ ] Test archive flow
```

---

## 📞 Troubleshooting Quick Links

| Problem | Solution |
|---------|----------|
| Port 5173 in use | `npm run dev -- --port 5174` |
| Supabase connect error | Check `.env.local` credentials |
| Tailwind not working | Rebuild with `npm run dev` |
| TypeScript errors | Run `npm run type-check` |
| Module not found | Check import path aliases |

---

## 🔗 Important URLs

```
Local Dev:        http://localhost:5173
Supabase:         https://supabase.com/dashboard
AWS Console:      https://aws.amazon.com/
GitHub:           https://github.com/yourusername/cogallery
Vercel:           https://vercel.com/dashboard
```

---

## 📚 Documentation Map

```
PROJECT OVERVIEW
├─ README.md                    ← Start here
├─ PROJECT_STATUS.md           ← Current status
├─ PROJECT_SPEC.md             ← Original spec
└─ IMPROVED_SPEC.md            ← Validated spec

TECHNICAL
├─ ARCHITECTURE.md             ← System design
├─ API_DOCS.md                 ← API reference
├─ DESIGN_SPECIFICATION.md     ← UI/UX patterns
└─ IMPLEMENTATION_GUIDE.md     ← Week-by-week plan

RESEARCH
└─ RESEARCH_ANALYSIS.md        ← Competitive analysis

FRONTEND
└─ client/README.md            ← Frontend docs
```

---

## ✅ Definition of Done

For each feature:
- [ ] Code is written and tested
- [ ] Types are defined (TypeScript)
- [ ] Styles are applied (Tailwind)
- [ ] Mobile responsive
- [ ] Dark mode works
- [ ] No console errors
- [ ] Accessibility tested
- [ ] Documentation updated

---

## 🎓 Learning Path

**Day 1-2:** Understand the structure
- Read README.md
- Explore src/ folder
- Run `npm run dev`
- Check components

**Day 3-4:** Learn the patterns
- Study existing components
- Read DESIGN_SPECIFICATION.md
- Try modifying Header.tsx

**Day 5:** Start contributing
- Pick a task from IMPLEMENTATION_GUIDE.md
- Follow the patterns
- Ask questions in issues

---

## 🤝 Code Style Guide

```typescript
// Imports (organized)
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'

// Component naming (PascalCase, descriptive)
export function MyComponent() {
  // Hooks first
  const [value, setValue] = useState('')
  const store = useAuthStore()
  
  // Functions
  const handleClick = () => {}
  
  // Render
  return (
    <div className="space-y-4">
      {/* Component JSX */}
    </div>
  )
}
```

---

## 🎯 Next 3 Hours

1. **Hour 1:** Read PROJECT_STATUS.md
2. **Hour 2:** Run `npm install` && `npm run dev`
3. **Hour 3:** Plan first task (see IMPLEMENTATION_GUIDE.md)

---

## 📞 Questions?

Refer to:
- [DESIGN_SPECIFICATION.md](../DESIGN_SPECIFICATION.md) - How to style
- [IMPLEMENTATION_GUIDE.md](../IMPLEMENTATION_GUIDE.md) - What to build
- [client/README.md](../client/README.md) - Frontend details
- Component examples in `src/components/shared/`

---

**Last Updated:** May 27, 2026  
**Version:** 1.0  
**Status:** Ready to build 🚀
