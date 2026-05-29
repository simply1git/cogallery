export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-white/10 bg-[#0f0f0f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-sm font-semibold text-[#f4f4f5] mb-4">CoGallery</h3>
            <p className="text-sm text-[#a1a1aa]">
              Permanent photo sharing for trips, events & memories.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-[#f4f4f5] mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-[#a1a1aa]">
              <li><a href="#features" className="hover:text-[#f4f4f5]">Features</a></li>
              <li><a href="#pricing" className="hover:text-[#f4f4f5]">Pricing</a></li>
              <li><a href="#roadmap" className="hover:text-[#f4f4f5]">Roadmap</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-[#f4f4f5] mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-[#a1a1aa]">
              <li><a href="#docs" className="hover:text-[#f4f4f5]">Documentation</a></li>
              <li><a href="#blog" className="hover:text-[#f4f4f5]">Blog</a></li>
              <li><a href="#support" className="hover:text-[#f4f4f5]">Support</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-[#f4f4f5] mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-[#a1a1aa]">
              <li><a href="#privacy" className="hover:text-[#f4f4f5]">Privacy</a></li>
              <li><a href="#terms" className="hover:text-[#f4f4f5]">Terms</a></li>
              <li><a href="#contact" className="hover:text-[#f4f4f5]">Contact</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/10 pt-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#a1a1aa]">
              © {currentYear} CoGallery. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#twitter" className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">
                Twitter
              </a>
              <a href="#github" className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">
                GitHub
              </a>
              <a href="#discord" className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">
                Discord
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
