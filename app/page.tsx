import Image from 'next/image';

const logos = [
  'Royal LePage', 'RE/MAX', 'Century 21', 'Keller Williams',
  'Coldwell Banker', 'Pillar 9', "Sotheby's", 'EXIT Realty',
];

/* Masonry-style property card grid — same layout as Framer hero */
const cards = [
  { w: 'w-[220px]', h: 'h-[320px]', img: '/landing/screenshot-dashboard.jpg', label: 'Dashboard' },
  { w: 'w-[200px]', h: 'h-[260px]', img: '/landing/screenshot-embeds.jpg', label: 'Embed Generator' },
  { w: 'w-[240px]', h: 'h-[340px]', img: '/landing/screenshot-mls.jpg', label: 'MLS Search' },
  { w: 'w-[260px]', h: 'h-[300px]', img: '/landing/screenshot-dashboard.jpg', label: 'Analytics' },
  { w: 'w-[200px]', h: 'h-[280px]', img: '/landing/screenshot-embeds.jpg', label: 'Property Pages' },
  { w: 'w-[220px]', h: 'h-[350px]', img: '/landing/screenshot-mls.jpg', label: 'Neighbourhood' },
  { w: 'w-[240px]', h: 'h-[260px]', img: '/landing/screenshot-dashboard.jpg', label: 'Half Map' },
  { w: 'w-[200px]', h: 'h-[310px]', img: '/landing/screenshot-embeds.jpg', label: 'Studio' },
];

/* Second row */
const cards2 = [
  { w: 'w-[240px]', h: 'h-[280px]', img: '/landing/screenshot-mls.jpg', label: 'Lead CRM' },
  { w: 'w-[220px]', h: 'h-[340px]', img: '/landing/screenshot-dashboard.jpg', label: 'Movie Posters' },
  { w: 'w-[260px]', h: 'h-[260px]', img: '/landing/screenshot-embeds.jpg', label: 'Custom Pages' },
  { w: 'w-[200px]', h: 'h-[320px]', img: '/landing/screenshot-mls.jpg', label: 'Tour Scheduler' },
  { w: 'w-[240px]', h: 'h-[290px]', img: '/landing/screenshot-dashboard.jpg', label: 'Carousel Embed' },
  { w: 'w-[220px]', h: 'h-[350px]', img: '/landing/screenshot-embeds.jpg', label: 'Grid Embed' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <Image src="/landing/logos/ith-favicon.webp" alt="InTheHood" width={28} height={28} className="rounded" />
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition">Pricing</a>
            <a href="#showcase" className="hover:text-gray-900 transition">Showcase</a>
            <a href="#testimonials" className="hover:text-gray-900 transition">Testimonials</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://app.inthehood.io" className="text-[13px] font-medium text-gray-500 hover:text-gray-900 transition">Log in</a>
            <a href="https://app.inthehood.io" className="text-[13px] font-medium px-4 py-1.5 rounded-lg border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition">Sign up</a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="pt-16 pb-0 text-center" data-testid="hero-section">
        {/* Badge */}
        <p className="text-[13px] text-gray-400 mb-6">
          Property Marketing Platform &middot; <span className="text-emerald-500 font-medium">Now with AI</span>
        </p>

        {/* Headline */}
        <h1 className="text-[clamp(48px,7vw,88px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-gray-900 max-w-3xl mx-auto px-6">
          Level up your listings
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-[17px] leading-relaxed text-gray-400 max-w-md mx-auto px-6">
          Promote every property with a stunning landing page that highlights the home, its neighbourhood, and nearby amenities.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <a
            href="https://app.inthehood.io"
            className="text-[14px] font-medium px-5 py-2.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition"
            data-testid="hero-cta-start"
          >
            Get started
          </a>
          <a
            href="#showcase"
            className="text-[14px] font-medium px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 transition"
            data-testid="hero-cta-designs"
          >
            See our designs
          </a>
        </div>

        {/* ─── PROPERTY CARD GRID (Framer-style masonry) ─── */}
        <div className="mt-16 overflow-hidden">
          {/* Row 1 */}
          <div className="flex justify-center gap-3 px-4">
            {cards.map((card, i) => (
              <div
                key={i}
                className={`${card.w} ${card.h} flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 relative group`}
              >
                <img
                  src={card.img}
                  alt={card.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
          {/* Row 2 */}
          <div className="flex justify-center gap-3 px-4 mt-3">
            {cards2.map((card, i) => (
              <div
                key={i}
                className={`${card.w} ${card.h} flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 relative group`}
              >
                <img
                  src={card.img}
                  alt={card.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOGO BAR ─── */}
      <section className="py-10 border-t border-gray-100 mt-10">
        <div className="flex items-center justify-center flex-wrap gap-x-10 gap-y-4 px-6">
          {logos.map((name) => (
            <span key={name} className="text-[14px] font-semibold text-gray-300 tracking-wide whitespace-nowrap">
              {name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
