# CoGallery Client - React Frontend

Modern, real-time photo gallery built with React 18, TypeScript, and Vite.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

   App opens at `http://localhost:5173`

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/                 # Reusable UI components (buttons, inputs, etc.)
│   ├── gallery/            # Gallery-specific components (grid, lightbox, upload)
│   └── shared/             # Shared layout components (header, footer, theme)
├── pages/                  # Page components (HomePage, EventPage, LoginPage)
├── hooks/
│   ├── queries/            # React Query hooks for data fetching
│   └── realtime/           # Supabase realtime subscription hooks
├── store/                  # Zustand stores (auth, event, gallery state)
├── lib/
│   └── supabase.ts        # Supabase client configuration
├── types/                  # TypeScript type definitions
├── styles/                 # Global CSS and design system
├── utils/                  # Utility functions
└── main.tsx               # App entry point
```

## 🎨 Design System

### Colors
- **Primary**: #3B82F6 (Blue)
- **Secondary**: #8B5CF6 (Purple)
- **Accent**: #EC4899 (Pink)

### Tailwind CSS
All styling uses Tailwind CSS utility classes. Custom components use CSS classes in `globals.css`.

### Dark Mode
- Automatic detection + manual toggle
- Persisted to localStorage
- All components support dark mode

## 📦 Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS
- **Supabase** - Backend, auth, realtime
- **Zustand** - State management
- **React Router** - Client-side routing
- **PhotoSwipe** - Image lightbox
- **Framer Motion** - Animations
- **Lucide React** - Icons

## 🔄 Real-Time Features

Powered by Supabase Realtime WebSockets:
- Live photo uploads
- Real-time reactions
- Instant comments
- User presence indicators

## 📱 Responsive Design

Breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

All components are mobile-first and fully responsive.

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript check
```

### Component Development

Create new components in appropriate folders:

**UI Component** (`src/components/ui/Button.tsx`):
```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return <button className={`btn-${variant} btn-${size}`} {...props} />
}
```

**Page Component** (`src/pages/NewPage.tsx`):
```tsx
export function NewPage() {
  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Page content */}
    </div>
  )
}
```

## 🔐 Authentication

Supabase Auth handles:
- Email/password signup
- Email/password login
- Guest mode (anonymous)
- Social logins (Phase 2)

## 🗄️ Database

Supabase PostgreSQL with:
- Row-Level Security (RLS) policies
- Real-time subscriptions
- Type-safe queries via PostgREST API

## 📚 Resources

- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase Docs](https://supabase.com/docs)
- [Vite Docs](https://vitejs.dev)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test locally
4. Submit a pull request

## 📝 License

MIT
