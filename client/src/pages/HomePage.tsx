import { Link } from 'react-router-dom'
import {
  ArrowRight, Zap, Lock, Share2, Archive, Image, Video,
  Users, Star, ChevronDown, Infinity
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const FEATURES = [
  {
    icon: Zap,
    color: 'from-yellow-400 to-orange-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    title: 'Real-Time Sync',
    desc: 'Photos & videos appear the instant they\'re uploaded. Everyone sees it live.',
  },
  {
    icon: Lock,
    color: 'from-emerald-400 to-teal-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'Original Quality',
    desc: 'Zero compression. Every photo & video preserved at full resolution, forever.',
  },
  {
    icon: Share2,
    color: 'from-blue-400 to-cyan-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    title: 'Instant Sharing',
    desc: 'Share with a link or QR code. No signup needed for guests to upload.',
  },
  {
    icon: Archive,
    color: 'from-violet-400 to-purple-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    title: 'Permanent Archive',
    desc: 'Automatic GitHub backup. Your memories preserved at zero cost, forever.',
  },
  {
    icon: Infinity,
    color: 'from-rose-400 to-pink-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    title: 'No Size Limit',
    desc: 'Upload files of any size — raw photos, 4K videos, anything.',
  },
  {
    icon: Users,
    color: 'from-amber-400 to-yellow-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    title: 'Collaborative',
    desc: 'Multiple people upload together. React, comment, and relive memories.',
  },
]

const STEPS = [
  { step: '01', title: 'Create a Room', desc: 'A room is your trip, vacation, or event. Invite friends in seconds.' },
  { step: '02', title: 'Add Events', desc: 'Break your room into days, themes, or activities for easy browsing.' },
  { step: '03', title: 'Upload Together', desc: 'Everyone uploads photos and videos. They appear live for all members.' },
]

export function HomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="w-full overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-[100px] animate-float animate-delay-500" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 text-center space-y-8 py-24">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 text-blue-400 text-sm font-medium animate-fade-in">
            <Star size={14} fill="currentColor" />
            Permanent photo & video sharing
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-[#f4f4f5] leading-tight animate-slide-up">
            Every Memory,
            <br />
            <span className="gradient-text">Preserved Forever</span>
          </h1>

          <p className="text-lg sm:text-xl text-[#a1a1aa] max-w-2xl mx-auto animate-slide-up animate-delay-100">
            Organize trips and events into rooms. Upload photos & videos together in real-time.
            No compression. No size limit. No expiry. Ever.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 animate-slide-up animate-delay-200">
            <Link
              id="hero-cta-primary"
              to={isAuthenticated ? '/dashboard' : '/auth'}
              className="btn-blue px-8 py-3.5 text-base"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Start for Free'}
              <ArrowRight size={18} />
            </Link>
            <a href="#how-it-works" className="btn-secondary px-8 py-3.5 text-base">
              See How It Works
              <ChevronDown size={18} />
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8 text-sm text-[#71717a] animate-fade-in animate-delay-400">
            <Stat icon={<Image size={14} />} text="Unlimited photos" />
            <Dot />
            <Stat icon={<Video size={14} />} text="Unlimited videos" />
            <Dot />
            <Stat icon={<Infinity size={14} />} text="No size limit" />
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#f4f4f5] mb-3">How It Works</h2>
            <p className="text-[#a1a1aa]">Three steps to shared memories</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.step} className={`card-hover p-6 animate-slide-up animate-delay-${(i+1) * 100}`}>
                <div className="text-5xl font-black gradient-text mb-4">{s.step}</div>
                <h3 className="text-lg font-semibold text-[#f4f4f5] mb-2">{s.title}</h3>
                <p className="text-[#a1a1aa] text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#f4f4f5] mb-3">Everything You Need</h2>
            <p className="text-[#a1a1aa]">Built for real trips, real events, real people</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`card-hover p-6 group animate-slide-up animate-delay-${(i % 3 + 1) * 100}`}
              >
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-4 ${f.bg}`}>
                  <f.icon size={22} className={`bg-gradient-to-r ${f.color} bg-clip-text text-transparent`}
                    style={{ color: 'transparent', backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` }}
                  />
                  <f.icon size={22} className="opacity-0 absolute" />
                </div>
                <h3 className="text-base font-semibold text-[#f4f4f5] mb-1.5">{f.title}</h3>
                <p className="text-[#a1a1aa] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] p-12 text-center">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/15 via-violet-600/10 to-transparent" />
            <div className="absolute inset-0 bg-[#0a0a0a]/60" />

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#f4f4f5] mb-4">
                Ready to share your memories?
              </h2>
              <p className="text-[#a1a1aa] mb-8 max-w-lg mx-auto">
                Create your first room now. Invite friends to upload photos and videos from any device.
              </p>
              <Link
                id="cta-get-started"
                to={isAuthenticated ? '/dashboard' : '/auth'}
                className="btn-blue px-10 py-4 text-base"
              >
                {isAuthenticated ? 'Open Dashboard' : 'Get Started — Free'}
                <ArrowRight size={18} />
              </Link>
              <p className="text-[#52525b] text-sm mt-4">No credit card required</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Stat({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      {text}
    </span>
  )
}

function Dot() {
  return <span className="w-1 h-1 rounded-full bg-[#3f3f46] hidden sm:block" />
}
