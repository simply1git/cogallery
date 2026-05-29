# CoGallery

**Permanent Photo Sharing Platform for Trips, Events & Memories**

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Version](https://img.shields.io/badge/version-1.0--planning-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 What is CoGallery?

CoGallery is a modern photo sharing platform designed for group trips, events, and occasions where you want to **permanently preserve original-quality photos** with real-time collaboration.

**Unlike traditional alternatives:**
- ❌ Not temporary (photos don't disappear)
- ❌ Not compressed (original quality preserved)
- ❌ Not enterprise-complex (built for casual users)
- ✅ Real-time uploads during events
- ✅ Permanent archival with GitHub Pages
- ✅ Free at small scale, predictable costs at scale

---

## ✨ Key Features

### 🚀 Phase 1: MVP (Core)
- **Real-Time Photo Upload** - Direct upload to AWS S3
- **Gallery View** - Responsive thumbnail grid with pagination
- **Guest Mode** - No account needed to share
- **QR Code Sharing** - Easy event discovery
- **Instant Sync** - Photos appear live across all devices

### 📸 Phase 2: Enhancement
- **Metadata Extraction** - EXIF data, location, camera info
- **Search & Filter** - Find photos by date, uploader, location
- **Comments & Reactions** - Interact with photos
- **Slideshow Mode** - Auto-play gallery
- **ZIP Download** - Download entire event

### 📦 Phase 3: Archive
- **GitHub Auto-Archive** - Permanent backup with GitHub Pages
- **Static HTML Gallery** - Searchable offline archive
- **Version History** - Access any past moment
- **Forever Accessible** - $0 permanent storage

### 🎨 Phase 4: Polish
- **Mobile App** - React Native version
- **Offline Support** - Browse cached photos
- **Analytics** - See popular photos
- **Admin Controls** - Manage photos & members

---

## 🏗️ Technology Stack

```
Frontend:  React 18 + TypeScript + Vite + Tailwind CSS
Database:  PostgreSQL (Supabase)
Storage:   AWS S3 + CloudFront CDN
Real-time: Supabase Realtime WebSocket
Archive:   GitHub Pages + Actions
Deploy:    Vercel (frontend), Supabase (backend)
```

---

## 📊 Architecture Overview

```
┌────────────────────────────────────────┐
│  Browser (React App)                   │
│  Real-time gallery + photo upload      │
└────────┬─────────────────────────────┬─┘
         │                             │
    [Upload]                     [View]
         │                             │
    ┌────▼───┐                   ┌────▼───┐
    │ AWS S3 │                   │Supabase│
    │ Photos │                   │ DB     │
    └────────┘                   └────────┘
         │                             │
    [CDN]                         [RLS]
         │                             │
    CloudFront              Row-Level Security
         │
    ┌────▼────────────────┐
    │ GitHub Pages        │
    │ (Archive + Backup)  │
    └─────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
```bash
Node.js 18+, npm, Git, AWS account, Supabase account
```

### 2. Clone & Install
```bash
git clone https://github.com/yourusername/cogallery.git
cd cogallery/client
npm install
```

### 3. Setup Environment
```bash
cp .env.example .env.local
# Edit with your Supabase and AWS credentials
```

### 4. Run Locally
```bash
npm run dev
# Open http://localhost:5173
```

### 5. Deploy
```bash
vercel deploy
```

**[🔗 Full Setup Guide →](./SETUP_GUIDE.md)**

---

## 📚 Documentation

- **[PROJECT_SPEC.md](./PROJECT_SPEC.md)** - Complete project specification, features, roadmap
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical architecture, system design, scalability
- **[API_DOCS.md](./API_DOCS.md)** - REST API reference, endpoints, examples
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Installation, configuration, deployment

---

## 💰 Pricing

### Free Forever (For Casual Users)
- Up to 1 event per month
- Up to 500 photos per event
- Access for 1 year
- **Cost: $0**

### Creator Plan ($4.99/month)
- Unlimited events
- Unlimited photos
- Access forever
- GitHub auto-archive
- Priority support

### Team Plan ($9.99/month)
- Everything in Creator
- 10+ collaborators per event
- Advanced analytics
- Admin controls
- Team management

**[Check full pricing →](#pricing)**

---

## 📈 Roadmap

### ✅ Completed
- Project specification
- Architecture design
- Database schema
- API documentation

### 🚧 In Progress (Weeks 1-12)
- [ ] Week 1-2: Foundation (Supabase + React setup)
- [ ] Week 3-4: Core features (Upload + Gallery)
- [ ] Week 5-6: Metadata (EXIF + Search)
- [ ] Week 7-8: Downloads (ZIP + Slideshow)
- [ ] Week 9-10: Archive (GitHub integration)
- [ ] Week 11-12: Polish (Mobile + Analytics)

### 📅 Future (Post-Launch)
- Mobile app (React Native)
- AI photo tagging
- Face recognition
- Live streaming events
- Social features

**[Full Roadmap →](./PROJECT_SPEC.md#-implementation-roadmap)**

---

## 🎯 Use Cases

### 🏖️ Trip Memory Sharing
Create event → Friends upload during trip → Photos archived forever → Access anytime

### 🎉 Event Coverage
Wedding, graduation, conference → Real-time uploads → Guest gallery → Permanent archive

### 👨‍👩‍👧‍👦 Family Memories
Family reunion → Collective album → Searchable archive → Share with relatives

### 📸 Professional Events
Photography assignment → Client gallery → Deliverables → Backup archive

---

## 🔐 Security & Privacy

- **Encryption:** TLS 1.3 in transit, AES-256 at rest
- **Row-Level Security:** Supabase PostgreSQL policies
- **Data Control:** You own your photos
- **Private Events:** Invitation-only by default
- **GDPR Compliant:** Full data export & deletion

---

## 📊 Performance Specs

- **Real-time Latency:** < 500ms photo updates
- **Upload Speed:** Direct S3 (no bottleneck)
- **Gallery Load:** < 2s for 50 photos
- **Concurrent Users:** 10,000+
- **Storage Capacity:** Unlimited (scales infinitely)
- **Uptime:** 99.9%

---

## 🤝 Contributing

We welcome contributions! 

```bash
# Fork the repo
git clone https://github.com/yourusername/cogallery.git
git checkout -b feature/your-feature

# Make changes & commit
git add .
git commit -m "Add your feature"

# Push & create PR
git push origin feature/your-feature
```

**[Contributing Guide →](./CONTRIBUTING.md)**

---

## 📝 License

MIT License - feel free to use, modify, and distribute

---

## 🆘 Support

- **Documentation:** [/docs](./PROJECT_SPEC.md)
- **Issues:** [GitHub Issues](https://github.com/yourusername/cogallery/issues)
- **Email:** support@cogallery.app
- **Discord:** [Join Community](https://discord.gg/cogallery)

---

## 👥 Authors

- **Founder:** You
- **Contributors:** [See CONTRIBUTORS.md](./CONTRIBUTORS.md)

---

## 🙏 Acknowledgments

- Supabase for PostgreSQL + Real-time
- AWS for S3 + CloudFront
- Vercel for hosting
- GitHub for archival
- React ecosystem for tooling

---

## 📞 Contact

- **Website:** cogallery.app (coming soon)
- **Email:** hello@cogallery.app
- **Twitter:** [@cogallery](https://twitter.com/cogallery)
- **GitHub:** [@cogallery](https://github.com/cogallery)

---

## 🌟 Show Your Support

If you like this project, please ⭐ star it on GitHub!

---

**CoGallery** - *Preserve your memories. Forever.*

---

**Status:** 🚀 Ready for Development  
**Last Updated:** May 27, 2026  
**Version:** 1.0 (Planning Phase)
