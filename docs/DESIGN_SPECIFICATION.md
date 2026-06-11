# CoGallery UI/UX Design Specification
**Version 1.0** | May 27, 2026

---

## Executive Summary

This document provides a comprehensive design specification for CoGallery, synthesizing modern UI/UX trends from 2024-2026 with patterns from leading photo gallery and collaboration apps. The design emphasizes:

- **Real-time collaboration visibility** (presence, live reactions)
- **Fast, smooth photo interactions** (inspired by Apple Photos)
- **Accessible, mobile-first design** (WCAG 2.1 AA compliant)
- **Modern aesthetics** (glassmorphism, smooth animations, dark mode)
- **Intuitive sharing & invite flows** (like Figma's multiplayer model)

---

## Part 1: Design System Fundamentals

### 1.1 Color System

#### Primary Palette (Semantic)
```
Brand Primary:     #3B82F6 (Blue-500)   [Instagram-inspired]
Brand Secondary:   #8B5CF6 (Purple-500) [Modern, distinguishes from competitors]
Accent:            #EC4899 (Pink-500)   [Vibrant, for CTAs]
Success:           #10B981 (Green-500)
Warning:           #F59E0B (Amber-500)
Error:             #EF4444 (Red-500)
```

#### Grayscale + Surfaces (Contrast-focused)
```
Light Mode:
  - Background:        #FFFFFF
  - Surface:           #F8FAFC (Slate-50)
  - Border:            #E2E8F0 (Slate-200)
  - Text Primary:      #0F172A (Slate-900)
  - Text Secondary:    #475569 (Slate-600)
  - Text Tertiary:     #94A3B8 (Slate-400)

Dark Mode:
  - Background:        #0F172A (Slate-900)
  - Surface:           #1E293B (Slate-800)
  - Border:            #334155 (Slate-700)
  - Text Primary:      #F1F5F9 (Slate-100)
  - Text Secondary:    #CBD5E1 (Slate-300)
  - Text Tertiary:     #64748B (Slate-500)
```

#### Accessibility Compliance
- **Contrast Ratios:** All text ≥ 4.5:1 (WCAG AA standard)
- **Suggested pairs:**
  - Text Primary on Background: 14.5:1 ✓
  - Text Secondary on Surface: 7.2:1 ✓
  - Brand Primary on White: 3.9:1 ⚠️ (use white text instead for buttons)

#### Glassmorphism Color Overlay
```css
/* For frosted glass effect on overlays */
.glass-light {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.glass-dark {
  background: rgba(15, 23, 42, 0.5);  /* Slate-900 with transparency */
  backdrop-filter: blur(10px);
  border: 1px solid rgba(226, 232, 240, 0.1);  /* Slate-200 @ 10% */
}
```

### 1.2 Typography System

#### Font Stack
```css
/* Modern, widely available, excellent legibility */
--font-sans:   -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono:   "Cascadia Code", "Monaco", "Courier New", monospace;
```

#### Scale (Modular: 1.125 ratio - similar to Tailwind's default)
```
H1 (Hero):     2.66rem (42px)  | font-weight: 700 | line-height: 1.1
H2 (Section):  2.37rem (38px)  | font-weight: 700 | line-height: 1.2
H3 (Subsec):   2.11rem (34px)  | font-weight: 600 | line-height: 1.3
H4:            1.88rem (30px)  | font-weight: 600 | line-height: 1.4
Body XL:       1.33rem (21px)  | font-weight: 400 | line-height: 1.5
Body LG:       1.19rem (19px)  | font-weight: 400 | line-height: 1.6
Body MD:       1rem    (16px)  | font-weight: 400 | line-height: 1.6 [default]
Body SM:       0.89rem (14px)  | font-weight: 400 | line-height: 1.5
Caption:       0.79rem (12px)  | font-weight: 500 | line-height: 1.4
```

**Line Height Rules:**
- Headings: 1.1–1.4 (tighter for visual impact)
- Body: 1.5–1.6 (readability, accessibility)
- Form labels: 1.4 (compact but readable)

### 1.3 Spacing System (8px Base)
```
xs:  4px    (spacing/0.5)
sm:  8px    (spacing/1)
md:  16px   (spacing/2)
lg:  24px   (spacing/3)
xl:  32px   (spacing/4)
2xl: 48px   (spacing/6)
3xl: 64px   (spacing/8)
4xl: 96px   (spacing/12)
```

**Application:**
- Padding in cards/buttons: 12–16px
- Gap between grid items: 16–24px
- Top-level section margins: 48–64px
- Modal padding: 32px

### 1.4 Border Radius
```
none:   0
xs:     2px   (subtle, for buttons)
sm:     4px   (controls, small cards)
md:     8px   (default for cards, modals)
lg:     12px  (large cards, prominent elements)
xl:     16px  (hero sections, large panels)
2xl:    24px  (oversized, distinctive)
full:   9999px (pill buttons, avatars, FAB)
```

### 1.5 Shadow System (Depth & Elevation)

```css
--shadow-none:    none;
--shadow-xs:      0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-sm:      0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
--shadow-md:      0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg:      0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl:      0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-2xl:     0 25px 50px -12px rgba(0, 0, 0, 0.25);

/* Elevation levels */
Floating (hover/active): shadow-md
Modal/Dropdown:          shadow-lg
Toast/Popover:           shadow-xl
```

---

## Part 2: Modern Design Trends (2024-2026)

### 2.1 Glassmorphism + Frosted Glass

**Why it works for CoGallery:**
- Signals "real-time, modern, transparent" (literally transparent!)
- Works beautifully for presence indicators overlays
- Reduces visual clutter while maintaining readability

**Implementation Pattern:**

```jsx
// Frosted glass modal for share/invite
<div className="fixed inset-0 backdrop-blur-md bg-black/30">
  <div className="glass-md rounded-xl p-6 shadow-lg">
    {/* Content */}
  </div>
</div>
```

```css
/* Tailwind classes (requires @tailwindcss/forms) */
.glass-sm {
  @apply backdrop-blur-sm bg-white/5 border border-white/10;
}

.glass-md {
  @apply backdrop-blur-md bg-white/10 border border-white/20;
}

.glass-lg {
  @apply backdrop-blur-lg bg-white/20 border border-white/30;
}

/* Dark mode variants */
.dark .glass-sm {
  @apply bg-slate-900/30 border-slate-400/10;
}
```

### 2.2 Dark Mode + Light Mode Switching

**Design Pattern:**
- **Default:** Light mode (approachable, accessible by default)
- **Toggle:** Header-based switcher (like Twitter, Figma)
- **Persistence:** localStorage + system preference detection

```jsx
// Dark mode toggle component (top-right)
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const toggleTheme = () => {
    setIsDark(!isDark);
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
    document.documentElement.classList.toggle('dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
```

### 2.3 Micro-interactions & Animations

**Philosophy:** Animations should feel instant (< 200ms) and purposeful, never distracting.

#### Animation Timings
```css
--duration-instant:  50ms   (immediate feedback, no "loading" feel)
--duration-fast:     100ms  (micro-interactions, hovers)
--duration-base:     200ms  (page transitions, modals)
--duration-slow:     300ms  (deliberate reveals, important changes)
--duration-slower:   500ms  (entrance animations for hero content)

--easing-ease-out:   cubic-bezier(0.4, 0, 0.2, 1);  [default, feels natural]
--easing-ease-in:    cubic-bezier(0.4, 0, 1, 1);    [for exit animations]
--easing-spring:     cubic-bezier(0.34, 1.56, 0.64, 1); [bounce, playful]
```

#### Key Micro-interactions

**1. Photo Upload Progress**
```jsx
<div className="space-y-2">
  <p className="text-sm font-medium">Uploading: {Math.round(progress)}%</p>
  <div className="h-2 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700">
    {/* Smooth width animation */}
    <div 
      className="h-full bg-blue-500 transition-all duration-300"
      style={{ width: `${progress}%` }}
    />
  </div>
</div>
```

**2. Reaction Animation (Like/Heart)**
```jsx
// When user clicks like button
<motion.div
  initial={{ scale: 1 }}
  animate={{ scale: [1, 1.3, 1] }}
  transition={{ duration: 0.3 }}
  className="text-2xl"
>
  ❤️
</motion.div>
```

**3. Page/Modal Transitions**
```jsx
// Using Framer Motion (recommended alternative: react-spring)
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
  {children}
</motion.div>
```

**4. Skeleton Screen (Loading State)**
```jsx
export function PhotoGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="aspect-square bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
```

**5. Toast Notifications (Non-intrusive)**
```jsx
// Position: bottom-right, auto-dismiss 5s
<div className="fixed bottom-6 right-6 flex flex-col gap-3 pointer-events-none">
  {toasts.map((toast) => (
    <motion.div
      key={toast.id}
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg pointer-events-auto"
    >
      {toast.message}
    </motion.div>
  ))}
</div>
```

### 2.4 Accessibility-First Design (WCAG 2.1 AA)

#### Core Principles
1. **Keyboard Navigation:** All interactive elements reachable via Tab/Shift+Tab
2. **Focus Indicators:** Always visible, high contrast (min 3:1)
3. **Semantic HTML:** Use `<button>`, `<a>`, `<form>`, not `<div>` with onClick
4. **ARIA Labels:** For icons/non-text buttons
5. **Color != Information:** Don't rely solely on color (e.g., red error text alone)

#### Implementation Examples

```jsx
// ❌ Bad: Not accessible
<div onClick={() => handleLike()} className="cursor-pointer text-red-500">❤️</div>

// ✅ Good: Accessible button with focus indicator
<button
  onClick={() => handleLike()}
  className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
  aria-label="Like this photo"
  title="Like"
>
  <Heart size={20} aria-hidden="true" />
</button>

// ✅ Icon + Text for clarity (best for buttons)
<button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
  <Share2 size={18} />
  <span>Share</span>
</button>
```

#### Focus Indicator Strategy
```css
/* Custom focus ring (less aggressive than default) */
@layer components {
  .focus-ring {
    @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900;
  }
}

/* For links */
a {
  @apply underline focus:outline-none focus:ring-2 focus:ring-blue-500;
}
```

#### Semantic HTML Template
```jsx
// ✅ Good structure
<form onSubmit={handleSubmit}>
  <label htmlFor="email">Email Address</label>
  <input id="email" type="email" required aria-describedby="email-hint" />
  <p id="email-hint" className="text-sm text-slate-500">We'll never share your email</p>
  
  <button type="submit">Send Invite</button>
</form>
```

#### Color + Icon Combination Rule
```jsx
// ❌ Color alone
<div className="text-red-500">Error: Network failed</div>

// ✅ Color + Icon + Text
<div className="flex items-center gap-2 text-red-600">
  <AlertCircle size={18} />
  <span>Error: Network failed</span>
</div>
```

---

## Part 3: Component Library & Patterns

### 3.1 Recommended Tech Stack

**Consensus across 2024-2026 design trends:**

```json
{
  "component-library": "shadcn/ui (Radix UI primitives + Tailwind CSS)",
  "reasoning": [
    "Headless, unstyled base (maximum customization)",
    "Accessible by default (WCAG 2.1 AA compliant)",
    "Uses Tailwind (modern, utility-first)",
    "Zero runtime dependency bloat",
    "Adopted by Vercel, Stripe, etc."
  ],
  "alternatives": {
    "daisyUI": "Good if you want simpler plug-and-play components",
    "Chakra UI": "If you prefer prop-based customization",
    "Mantine": "If you want more batteries-included features"
  },
  "recommendation": "shadcn/ui + custom Tailwind utilities for CoGallery-specific components"
}
```

### 3.2 Essential Components & Patterns

#### 3.2.1 Image Grid Layouts

**Pattern 1: Fixed Column Grid (Simple, Instagram-like)**
```jsx
export function PhotoGrid({ photos }) {
  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}
```

**Pattern 2: Masonry Grid (Pinterest-like, JavaScript-based)**
```jsx
// Use 'react-masonry-css' library
import Masonry from 'react-masonry-css';

export function MasonryGallery({ photos }) {
  const breakpoints = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1
  };

  return (
    <Masonry
      breakpointCols={breakpoints}
      className="grid gap-4"
      columnClassName="space-y-4"
    >
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </Masonry>
  );
}
```

**Pattern 3: Adaptive Grid (Best for Mixed Aspect Ratios)**
```jsx
// Apple Photos-like: automatically group landscape/portrait
export function AdaptivePhotoGrid({ photos }) {
  const groupedPhotos = groupByAspectRatio(photos);
  
  return (
    <div className="space-y-2">
      {groupedPhotos.map((group, idx) => (
        <div key={idx} className="flex gap-2">
          {group.map((photo) => (
            <div
              key={photo.id}
              className="flex-1"
              style={{ aspectRatio: photo.aspectRatio }}
            >
              <img
                src={photo.thumbnailUrl}
                alt={photo.title}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Recommendation for CoGallery:** Start with **Fixed Column (3-5 cols)**, add Masonry in Phase 2.

#### 3.2.2 Lightbox/Modal (Full-Screen Photo Viewer)

**Implementation (Using PhotoSwipe)**
```jsx
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';

export function PhotoGalleryWithLightbox({ photos }) {
  const lightboxRef = useRef(null);

  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      gallery: lightboxRef.current,
      children: 'a',
      pswpModule: PhotoSwipe,
    });
    lightbox.init();

    return () => lightbox.destroy();
  }, []);

  return (
    <div ref={lightboxRef} className="grid grid-cols-4 gap-4">
      {photos.map((photo) => (
        <a
          key={photo.id}
          href={photo.fullUrl}
          data-pswp-width={photo.width}
          data-pswp-height={photo.height}
          className="group relative overflow-hidden rounded-lg"
        >
          <img
            src={photo.thumbnailUrl}
            alt={photo.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
        </a>
      ))}
    </div>
  );
}
```

**Custom Lightbox (If needed later)**
```jsx
<AnimatePresence>
  {selectedPhoto && (
    <motion.div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setSelectedPhoto(null)}
    >
      <motion.img
        src={selectedPhoto.fullUrl}
        alt={selectedPhoto.title}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="max-w-4xl max-h-screen rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  )}
</AnimatePresence>
```

#### 3.2.3 Upload Drag-and-Drop Zone

```jsx
export function UploadDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    await uploadFiles(files);
  };

  return (
    <motion.div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      animate={{
        backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0)',
        borderColor: isDragging ? '#3B82F6' : '#E2E8F0'
      }}
      className="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer"
    >
      <motion.div
        animate={{ scale: isDragging ? 1.1 : 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <Upload size={32} className="mx-auto mb-3 text-slate-400" />
        <p className="text-lg font-medium">Drop photos here</p>
        <p className="text-sm text-slate-500">or click to browse</p>
      </motion.div>

      {uploadProgress > 0 && (
        <div className="mt-4 space-y-2">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">{Math.round(uploadProgress)}%</p>
        </div>
      )}
    </motion.div>
  );
}
```

#### 3.2.4 Share/Invite Dialog (Figma-style)

```jsx
export function ShareEventDialog({ eventId, onClose }) {
  const [shareUrl, setShareUrl] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [role, setRole] = useState('viewer');

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="glass-lg rounded-2xl p-8 max-w-md w-full mx-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <h2 className="text-2xl font-bold mb-6">Share Event</h2>

        {/* Share Link */}
        <div className="space-y-3 mb-6">
          <label className="block text-sm font-medium">Public Link</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm border border-slate-200 dark:border-slate-700"
            />
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Invite by Email */}
        <div className="space-y-3 border-t pt-6">
          <h3 className="font-medium">Invite by Email</h3>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="name@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <option value="viewer">View</option>
              <option value="editor">Edit</option>
            </select>
          </div>
          <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            Send Invite
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}
```

#### 3.2.5 Real-Time Presence Avatars

```jsx
export function RealtimePresenceIndicators({ members }) {
  return (
    <div className="flex items-center -space-x-2">
      {members.slice(0, 3).map((member) => (
        <motion.div
          key={member.id}
          title={member.name}
          className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-blue-500 flex items-center justify-center text-xs font-bold text-white relative"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring' }}
        >
          {member.avatar ? (
            <img src={member.avatar} alt={member.name} className="w-full h-full rounded-full" />
          ) : (
            member.name.charAt(0).toUpperCase()
          )}
          {/* Online indicator */}
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-white dark:border-slate-900" />
        </motion.div>
      ))}
      {members.length > 3 && (
        <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-xs font-bold">
          +{members.length - 3}
        </div>
      )}
    </div>
  );
}
```

#### 3.2.6 Floating Action Button (FAB)

```jsx
// Primary action: "Add Photos"
<motion.button
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.95 }}
  className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600 flex items-center justify-center transition-colors focus-ring"
  aria-label="Upload photos"
>
  <Plus size={24} />
</motion.button>
```

#### 3.2.7 Context Menu / Popover

```jsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function PhotoContextMenu({ photo }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
          aria-label="Photo actions"
        >
          <MoreVertical size={20} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Download</DropdownMenuItem>
        <DropdownMenuItem>Share</DropdownMenuItem>
        <DropdownMenuItem>Comment</DropdownMenuItem>
        <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### 3.2.8 Empty States (Engaging, Not Blank)

```jsx
export function EmptyPhotosState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring' }}
        className="text-6xl mb-4"
      >
        📸
      </motion.div>
      <h3 className="text-xl font-semibold mb-2">No photos yet</h3>
      <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-sm">
        Start sharing memories! Upload your first photo to get the moment rolling.
      </p>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Upload Photos
      </motion.button>
    </div>
  );
}
```

### 3.3 Component Checklist for MVP

```
Core Components:
[✓] PhotoGrid (fixed column)
[✓] PhotoCard (with hover state)
[✓] UploadDropZone
[✓] ShareDialog
[✓] ThemeToggle
[✓] RealtimePresenceIndicators
[✓] Toast notifications
[✓] Button (primary, secondary, ghost)
[✓] Input (text, email, password)
[✓] Modal/Dialog
[✓] Dropdown menu
[✓] Loading skeleton

Phase 2:
[  ] Lightbox (PhotoSwipe integration)
[  ] Masonry grid
[  ] Comments section
[  ] Reactions/emoji reactions
[  ] Image annotations
```

---

## Part 4: Real-Time Collaboration UX Patterns

### 4.1 Presence Indicators

**Pattern: Live User Avatars + Status**

```jsx
export function LivePresence({ eventId }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    // Subscribe to real-time member changes
    const channel = supabase
      .channel(`presence:${eventId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setMembers(Object.values(state).flat());
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Animation: scale-in new member
        console.log('Member joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // Animation: fade-out leaving member
        console.log('Member left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: currentUser.id });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [eventId]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">Now viewing:</span>
      <RealtimePresenceIndicators members={members} />
    </div>
  );
}
```

### 4.2 Live Reactions (Like/Emoji)

**Pattern: Ephemeral Emoji Animations**

```jsx
export function PhotoWithReactions({ photo }) {
  const [reactions, setReactions] = useState([]);

  const handleReaction = async (emoji) => {
    // Create ephemeral reaction that animates in and out
    const reactionId = Date.now();
    const randomX = Math.random() * 40 - 20; // -20 to 20px offset
    const randomY = Math.random() * 40 - 20;

    setReactions((prev) => [
      ...prev,
      {
        id: reactionId,
        emoji,
        x: randomX,
        y: randomY,
      },
    ]);

    // Broadcast to other users via Supabase Realtime
    await supabase.from('reactions').insert({
      photo_id: photo.id,
      user_id: currentUser.id,
      emoji,
      created_at: new Date(),
    });

    // Remove after animation completes
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reactionId));
    }, 1200);
  };

  return (
    <div className="relative">
      <img src={photo.url} alt="photo" className="w-full rounded-lg" />

      {/* Reaction animations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            animate={{ opacity: 0, scale: 1.5, y: -60, x: reaction.x }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute bottom-4 left-1/2 text-3xl"
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </div>

      {/* Like button */}
      <button
        onClick={() => handleReaction('❤️')}
        className="absolute bottom-4 right-4 p-3 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
      >
        <Heart size={20} />
      </button>
    </div>
  );
}
```

### 4.3 Live Comments (Real-time)

```jsx
export function CommentsSection({ photoId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Initial fetch
    const fetchComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*, author:users(id, name, avatar)')
        .eq('photo_id', photoId)
        .order('created_at', { ascending: true });
      setComments(data || []);
    };

    fetchComments();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`comments:${photoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `photo_id=eq.${photoId}`,
        },
        (payload) => {
          // Animate in new comment
          setComments((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [photoId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    await supabase.from('comments').insert({
      photo_id: photoId,
      author_id: currentUser.id,
      text: newComment,
      created_at: new Date(),
    });

    setNewComment('');
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Comments</h4>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {comments.map((comment) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <img
              src={comment.author.avatar}
              alt={comment.author.name}
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
              <p className="text-sm font-medium">{comment.author.name}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{comment.text}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus-ring"
        />
        <button
          type="submit"
          disabled={!newComment.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

---

## Part 5: Mobile vs. Desktop Adaptation

### 5.1 Responsive Breakpoints

```css
/* Tailwind defaults (recommended) */
--breakpoint-sm:    640px   (small phones)
--breakpoint-md:    768px   (tablets)
--breakpoint-lg:    1024px  (small desktops)
--breakpoint-xl:    1280px  (desktops)
--breakpoint-2xl:   1536px  (large screens)
```

### 5.2 Grid Responsive Behavior

```jsx
// Mobile-first approach
export function ResponsivePhotoGrid({ photos }) {
  return (
    <div className="
      grid 
      grid-cols-2         // Mobile: 2 columns
      sm:grid-cols-3      // Small phone: 3 columns
      md:grid-cols-4      // Tablet: 4 columns
      lg:grid-cols-5      // Desktop: 5 columns
      gap-2
      md:gap-4
    ">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}
```

### 5.3 Mobile-Specific Patterns

**Touch-friendly buttons:**
```css
/* Mobile buttons must be ≥ 44px tap target (WCAG) */
.mobile-button {
  @apply min-h-12 min-w-12 px-4 py-3;
}
```

**Mobile navigation:**
```jsx
export function MobileNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-6">
        <Link to="/gallery">Gallery</Link>
        <Link to="/shared">Shared</Link>
        <Link to="/settings">Settings</Link>
      </nav>

      {/* Mobile hamburger menu */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden p-2 rounded focus-ring"
      >
        {menuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-12 right-0 flex flex-col bg-white dark:bg-slate-900 rounded-lg shadow-lg z-50"
        >
          <Link to="/gallery" onClick={() => setMenuOpen(false)}>
            Gallery
          </Link>
          <Link to="/shared" onClick={() => setMenuOpen(false)}>
            Shared
          </Link>
          <Link to="/settings" onClick={() => setMenuOpen(false)}>
            Settings
          </Link>
        </motion.div>
      )}
    </>
  );
}
```

**Mobile: Swipe gestures (Phase 2)**
```jsx
// Using react-use-gesture or Framer Motion drag
<motion.img
  drag="x"
  dragElastic={0.2}
  onDragEnd={(event, info) => {
    if (info.offset.x > 50) {
      // Swiped right
      handlePreviousPhoto();
    } else if (info.offset.x < -50) {
      // Swiped left
      handleNextPhoto();
    }
  }}
  src={currentPhoto.url}
/>
```

---

## Part 6: Competitive Analysis

### 6.1 Instagram Reels/Stories
**What makes it feel premium:**
- ✅ Immediate feedback (instant like animation)
- ✅ Smooth scroll momentum (mobile feels physical)
- ✅ AI-driven recommendations (engagement)
- ✅ Story indicators (visual progression)
- ✅ Minimal UI chrome (full-screen by default)

**What CoGallery should steal:**
- Ephemeral reaction animations
- Smooth momentum scrolling
- Minimal top bar (hide on scroll)

### 6.2 Pinterest Infinite Scroll + Grid
**What works:**
- ✅ Masonry layout (no awkward empty space)
- ✅ Infinite scroll (seamless discovery)
- ✅ Hover preview (zoom on hover)
- ✅ Save/collection UI (simple, intuitive)

**What CoGallery should steal:**
- Masonry grid (Phase 2)
- Hover effects (scale, brighten)
- Simple "Add to collection" UX

### 6.3 Apple Photos (iOS/macOS)
**Why it feels smooth:**
- ✅ Hardware acceleration (smooth animations)
- ✅ Adaptive layouts (landscape/portrait grouping)
- ✅ Gesture support (pinch zoom, swipe)
- ✅ Minimal loading states (fast cache)
- ✅ "Moments" feature (auto-grouping by date/location)

**What CoGallery should steal:**
- Adaptive grid layouts
- Hardware-accelerated animations
- Gesture support (swipe, pinch)
- Smart grouping (by event date, people)

### 6.4 Google Photos
**Strengths:**
- ✅ Unlimited storage (value prop)
- ✅ Smart search (by text, face, object)
- ✅ Auto-organization (timeline)
- ✅ Sharing UI (simple link + role-based)

**What CoGallery should steal:**
- Role-based sharing (viewer, editor, owner)
- Timeline grouping (by date)
- Smart search (Phase 2+)

### 6.5 Figma's Multiplayer
**What makes collaboration feel real-time:**
- ✅ Live cursors (see where teammates are)
- ✅ Presence avatars (who's online)
- ✅ Real-time edits (instant sync)
- ✅ Change awareness (see who changed what)

**What CoGallery should steal:**
- Presence avatars (top-right)
- Activity log (who uploaded when)
- Real-time sync (Supabase Realtime)

### 6.6 Vercel Deployments UI
**Why it's beautiful:**
- ✅ Status indicators (clear, simple)
- ✅ Smooth progress (not blocky)
- ✅ Link previews (integrated, not dialogs)
- ✅ Copy-to-clipboard (one-click actions)

**What CoGallery should steal:**
- Progress bars (upload status)
- Status badges (syncing, shared, archived)
- One-click copy (share link)

### 6.7 Discord Communities
**UI excellence:**
- ✅ Nested channels (clear hierarchy)
- ✅ @mention patterns (inline, searchable)
- ✅ Emoji reactions (simple, effective)
- ✅ Message threads (focused discussions)

**What CoGallery should steal:**
- Emoji reactions (on photos)
- Comment threading (Phase 2)
- User mentions (@username)

---

## Part 7: CoGallery-Specific Design Patterns

### 7.1 Event Gallery Header

```jsx
export function EventGalleryHeader({ event }) {
  return (
    <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Left: Event name + member count */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {event.photoCount} photos · {event.memberCount} members
          </p>
        </div>

        {/* Right: Actions + Presence */}
        <div className="flex items-center gap-4">
          <RealtimePresenceIndicators members={event.members} />
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus-ring">
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 7.2 Unified Photo Card (Multi-purpose)

```jsx
export function PhotoCard({ photo, isSelected, onSelect, onReaction }) {
  return (
    <motion.div
      layoutId={`photo-${photo.id}`}
      className={`relative group cursor-pointer rounded-lg overflow-hidden ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={() => onSelect(photo)}
    >
      {/* Image */}
      <img
        src={photo.thumbnailUrl}
        alt={photo.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

      {/* Photo meta (hover) */}
      <motion.div
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3"
      >
        <p className="text-white text-sm font-medium truncate">{photo.title}</p>
        <p className="text-white/70 text-xs">{formatDate(photo.uploadedAt)}</p>
      </motion.div>

      {/* Real-time indicator (if being viewed by someone) */}
      {photo.currentViewers?.length > 0 && (
        <div className="absolute top-2 right-2 flex gap-1">
          {photo.currentViewers.slice(0, 2).map((viewer) => (
            <img
              key={viewer.id}
              src={viewer.avatar}
              alt={viewer.name}
              title={viewer.name}
              className="w-6 h-6 rounded-full border border-white"
            />
          ))}
        </div>
      )}

      {/* Reaction button (on hover) */}
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        whileHover={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          onReaction(photo.id, '❤️');
        }}
        className="absolute bottom-3 right-3 p-2 bg-white/90 dark:bg-slate-900/90 rounded-full hover:bg-white transition-colors"
      >
        <Heart size={18} />
      </motion.button>
    </motion.div>
  );
}
```

### 7.3 Activity Feed (Who did what)

```jsx
export function ActivityFeed({ eventId }) {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const subscription = supabase
      .channel(`activity:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events_audit' }, (payload) => {
        setActivities((prev) => [payload.new, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, [eventId]);

  return (
    <div className="space-y-2 text-sm">
      {activities.map((activity) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400"
        >
          <img src={activity.user.avatar} alt={activity.user.name} className="w-6 h-6 rounded-full" />
          <span>
            <strong>{activity.user.name}</strong> {activity.action}{' '}
            {activity.photoCount && `${activity.photoCount} photo${activity.photoCount > 1 ? 's' : ''}`}
          </span>
          <span className="text-xs text-slate-500">{formatTime(activity.createdAt)}</span>
        </motion.div>
      ))}
    </div>
  );
}
```

### 7.4 Guest Invite Flow (No Sign-up)

```jsx
export function GuestInviteModal({ shareLink }) {
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');

  const handleGuestAccess = async () => {
    // Create guest session (no password needed)
    const { data } = await supabase.auth.signInWithOtp({
      email: guestEmail,
      options: {
        emailRedirectTo: `${shareLink}?guest_token=true`,
      },
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Guest Access</h2>
      <p className="text-sm text-slate-600">No account needed—view as guest</p>

      <input
        type="text"
        placeholder="Your name"
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
      />

      <input
        type="email"
        placeholder="Your email"
        value={guestEmail}
        onChange={(e) => setGuestEmail(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
      />

      <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
        Send Magic Link
      </button>
    </div>
  );
}
```

---

## Part 8: Animation Principles & Code Examples

### 8.1 Entrance Animations

```jsx
// Fade + Slide (recommended, not too dramatic)
export const enterAnimation = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

// Scale (for important content)
export const scaleEnter = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.2, type: 'spring', stiffness: 300 },
};

// Quick fade (for modals)
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.15 },
};
```

### 8.2 Hover States

```jsx
// Subtle scale (Apple-style)
export function HoverableCard({ children }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}

// Soft shadow lift
export function LiftOnHover({ children }) {
  return (
    <motion.div
      className="shadow-md"
      whileHover={{ shadow: 'lg', y: -2 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
```

### 8.3 Loading Animations

```jsx
// Pulse (for skeleton screens)
<div className="animate-pulse">
  <div className="h-12 bg-slate-200 rounded-lg" />
</div>

// Spinner
<motion.div
  animate={{ rotate: 360 }}
  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
  className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
/>

// Dots
<motion.div className="flex gap-1">
  {[0, 1, 2].map((i) => (
    <motion.div
      key={i}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
      className="w-2 h-2 bg-blue-500 rounded-full"
    />
  ))}
</motion.div>
```

### 8.4 Page Transitions

```jsx
// Using react-router + Framer Motion
import { motion } from 'framer-motion';

export function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
```

---

## Part 9: Tailwind CSS Configuration

### 9.1 Custom Configuration (tailwind.config.js)

```javascript
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom color scale
        primary: {
          50: '#EFF6FF',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          900: '#1E3A8A',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: ['"Cascadia Code"', 'Monaco', '"Courier New"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
```

### 9.2 Global Styles (index.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom global styles */
@layer base {
  /* Smooth scrolling */
  html {
    @apply scroll-smooth;
  }

  /* Better typography */
  body {
    @apply antialiased bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200;
  }

  /* Focus rings */
  :focus-visible {
    @apply outline-none ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900;
  }

  /* Selection */
  ::selection {
    @apply bg-blue-500 text-white;
  }
}

@layer components {
  /* Buttons */
  .btn-primary {
    @apply px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900;
  }

  .btn-secondary {
    @apply px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors;
  }

  .btn-ghost {
    @apply px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors;
  }

  /* Cards */
  .card {
    @apply bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 transition-colors;
  }

  /* Glass effect */
  .glass {
    @apply backdrop-blur-md bg-white/10 dark:bg-slate-900/30 border border-white/20 dark:border-slate-700/30;
  }

  /* Focus ring utility */
  .focus-ring {
    @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900;
  }
}
```

---

## Part 10: Accessibility Checklist

- [ ] Color contrast: ≥ 4.5:1 for text (verified with WebAIM)
- [ ] Keyboard navigation: All interactive elements reachable via Tab
- [ ] Focus indicators: Always visible, high contrast
- [ ] Semantic HTML: Use `<button>`, `<a>`, `<form>`, not `<div>` with onClick
- [ ] ARIA labels: All icons/non-text buttons have `aria-label`
- [ ] Alt text: All images have descriptive `alt` attributes
- [ ] Color not information: Never rely on color alone (use icons + text)
- [ ] Motion safety: Respect `prefers-reduced-motion`
- [ ] Form accessibility: Labels properly associated with inputs
- [ ] Skip links: Option to skip to main content

### Accessibility Code Example

```jsx
// ✅ Accessible photo gallery
export function AccessiblePhotoGallery({ photos }) {
  return (
    <main>
      <h1>Photo Gallery</h1>
      <div
        role="region"
        aria-label="Photo gallery"
        className="grid grid-cols-4 gap-4"
      >
        {photos.map((photo) => (
          <article key={photo.id} className="flex flex-col">
            <img
              src={photo.url}
              alt={photo.description} // Descriptive alt text
              className="w-full h-auto rounded-lg"
            />
            <h2 className="mt-2 font-semibold">{photo.title}</h2>
            <button
              onClick={() => handleShare(photo)}
              aria-label={`Share photo: ${photo.title}`}
              className="focus-ring mt-2 px-4 py-2 bg-blue-500 text-white rounded"
            >
              <Share2 size={18} aria-hidden="true" />
              <span>Share</span>
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
```

---

## Part 11: Implementation Roadmap

### Phase 1: MVP Design (Weeks 1-2)
```
[✓] Color system + typography
[✓] Basic components (Button, Input, Card)
[✓] Photo grid (fixed 4 columns)
[✓] Dark mode toggle
[✓] Responsive basics (mobile nav)
```

### Phase 2: Enhanced Interactions (Weeks 3-4)
```
[  ] Photo card hover states
[  ] Upload drop zone + progress
[  ] Share dialog (Figma-style)
[  ] Presence avatars
[  ] Toast notifications
[  ] Lightbox (PhotoSwipe)
```

### Phase 3: Real-Time & Collaboration (Weeks 5-6)
```
[  ] Live reactions (emoji)
[  ] Comments section
[  ] Activity feed
[  ] Typing indicators
[  ] User mention (@username)
```

### Phase 4: Polish & Refinement (Weeks 7-8)
```
[  ] Animation fine-tuning
[  ] Accessibility audit
[  ] Mobile gesture support
[  ] Masonry grid (optional)
[  ] Offline support skeleton
```

---

## Part 12: Design System Reference Implementations

### 12.1 Figma File Structure (Recommended)

Create a shared Figma design file with:
```
Components
├── Button (primary, secondary, ghost, sizes)
├── Input (text, email, password, states)
├── Card (default, elevated, outline)
├── Modal
├── Dropdown
├── Badge
├── Avatar
└── Icons (custom set)

Patterns
├── Photo Grid
├── Upload Zone
├── Share Dialog
├── Presence Indicators
└── Reactions

Pages
├── Home / Event Gallery
├── Settings
├── Share Modal
└── Mobile Wireframes
```

### 12.2 Storybook Integration (Phase 2)

```bash
npx storybook@latest init
```

Example Storybook story:

```jsx
import { PhotoCard } from './PhotoCard';

export default {
  title: 'Components/PhotoCard',
  component: PhotoCard,
  argTypes: {
    isSelected: { control: 'boolean' },
  },
};

export const Default = {
  args: {
    photo: {
      id: '1',
      url: 'https://via.placeholder.com/300x300',
      title: 'Beach sunset',
      uploadedAt: new Date(),
    },
  },
};

export const Selected = {
  args: {
    ...Default.args,
    isSelected: true,
  },
};
```

---

## Conclusion

This design specification provides a modern, accessible, and delightful UI/UX for CoGallery that:

1. **Stands out:** Glassmorphism + smooth animations
2. **Collaborates real-time:** Presence indicators, live reactions
3. **Feels premium:** Like Apple Photos, but easier to share
4. **Accessible:** WCAG 2.1 AA compliant by default
5. **Mobile-first:** Responsive, gesture-friendly
6. **Developer-friendly:** Tailwind CSS, shadcn/ui, Framer Motion

**Next Steps:**
1. Review with design/product team
2. Create Figma design file from this spec
3. Begin component library development (shadcn/ui setup)
4. Implement dark mode toggle + core components
5. Build photo grid + upload flow
6. Integrate real-time presence via Supabase

---

**Document Version:** 1.0  
**Last Updated:** May 27, 2026  
**Author:** Design Research Team  
**Status:** Ready for Implementation
