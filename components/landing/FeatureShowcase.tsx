'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutDashboard, Map, Code, BarChart3, MapPin, Film } from 'lucide-react';

const features = [
  {
    id: 'landing-pages',
    icon: LayoutDashboard,
    label: 'Custom Landing Pages',
    title: 'Capture more leads with stunning property pages',
    description: 'High-quality visuals, video tours, and neighbourhood content give each property its own stage. Optimized for mobile and web with built-in lead capture.',
    screenshot: '/landing/screenshot-dashboard.jpg',
    accent: 'var(--ith-green-500)',
  },
  {
    id: 'neighbourhood',
    icon: MapPin,
    label: 'Neighbourhood Profiles',
    title: 'Comprehensive guides buyers actually want',
    description: 'Highlight local amenities, schools, parks, shopping, dining, and lifestyle insights. Buyers explore the area before stepping inside.',
    screenshot: '/landing/screenshot-mls.jpg',
    accent: 'var(--ith-forest)',
  },
  {
    id: 'maps',
    icon: Map,
    label: 'Interactive Maps',
    title: 'Pinpoint everything around the property',
    description: 'Our maps show amenities, transit options, and essentials instantly. Users see distances, lifestyle options, and local highlights at a glance.',
    screenshot: '/landing/screenshot-mls.jpg',
    accent: '#0EA5E9',
  },
  {
    id: 'embeds',
    icon: Code,
    label: 'Embed Generator',
    title: 'Embed property feeds anywhere',
    description: 'Generate carousel, grid, half-map, or showcase embeds for any website. Filter by agent, status, price, or property type with one click.',
    screenshot: '/landing/screenshot-embeds.jpg',
    accent: 'var(--ith-green-400)',
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: 'Dashboard & Analytics',
    title: 'Track visitors, leads, and performance',
    description: 'See stats by location, time on site, and device type. Monitor MLS sync, featured properties, and lead conversion from one dashboard.',
    screenshot: '/landing/screenshot-dashboard.jpg',
    accent: '#F59E0B',
  },
  {
    id: 'studio',
    icon: Film,
    label: 'Studio Posters',
    title: 'Turn listings into viral marketing',
    description: 'Create eye-catching movie-poster style thumbnails and video shorts for social media. Showcase both the home and its neighbourhood lifestyle.',
    screenshot: '/landing/screenshot-embeds.jpg',
    accent: '#EC4899',
  },
];

export default function FeatureShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);

  const setFeatureRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    featureRefs.current[idx] = el;
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = featureRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      {
        root: null,
        rootMargin: '-40% 0px -40% 0px',
        threshold: 0,
      }
    );

    featureRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToFeature = (idx: number) => {
    featureRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section
      id="features"
      ref={sectionRef}
      className="py-24 lg:py-32 bg-[var(--ith-surface)]"
      data-testid="feature-showcase-section"
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-20">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[var(--ith-green-500)] mb-4">
            Features
          </span>
          <h2 className="font-[family-name:var(--font-outfit)] text-4xl sm:text-5xl font-800 tracking-tight text-[var(--ith-forest-deep)]">
            Everything You Need to Market Properties Smarter
          </h2>
        </div>

        {/* Framer-style sticky tabs + content */}
        <div className="lg:grid lg:grid-cols-[280px_1fr] gap-12">
          {/* Left: Sticky tabs */}
          <div className="hidden lg:block">
            <div className="sticky top-24 space-y-1">
              {/* Progress line */}
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--ith-border)] rounded-full">
                <div
                  className="scroll-progress-bar w-full bg-[var(--ith-green-500)] rounded-full"
                  style={{
                    height: `${((activeIndex + 1) / features.length) * 100}%`,
                  }}
                />
              </div>

              {features.map((feature, idx) => (
                <button
                  key={feature.id}
                  onClick={() => scrollToFeature(idx)}
                  className={`w-full text-left pl-6 pr-4 py-4 rounded-r-xl transition-all duration-300 ${
                    idx === activeIndex
                      ? 'feature-tab-active'
                      : 'hover:bg-gray-50'
                  }`}
                  data-testid={`feature-tab-${feature.id}`}
                >
                  <div className="flex items-center gap-3">
                    <feature.icon
                      className="w-5 h-5 flex-shrink-0 transition-colors"
                      style={{ color: idx === activeIndex ? feature.accent : 'var(--ith-muted)' }}
                    />
                    <span
                      className={`text-sm font-medium transition-colors ${
                        idx === activeIndex ? 'text-[var(--ith-forest-deep)]' : 'text-[var(--ith-muted)]'
                      }`}
                    >
                      {feature.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Scrollable feature sections */}
          <div className="space-y-32">
            {features.map((feature, idx) => (
              <div
                key={feature.id}
                ref={(el) => setFeatureRef(el, idx)}
                className="scroll-mt-32"
                data-testid={`feature-content-${feature.id}`}
              >
                {/* Mobile tab pill */}
                <div className="lg:hidden mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--ith-green-50)] border border-[var(--ith-green-100)]">
                    <feature.icon className="w-4 h-4" style={{ color: feature.accent }} />
                    <span className="text-xs font-semibold text-[var(--ith-forest)]">{feature.label}</span>
                  </div>
                </div>

                <h3 className="font-[family-name:var(--font-outfit)] text-2xl sm:text-3xl font-700 text-[var(--ith-forest-deep)] mb-3">
                  {feature.title}
                </h3>
                <p className="text-base text-[var(--ith-muted)] max-w-lg mb-8 leading-relaxed">
                  {feature.description}
                </p>

                {/* Screenshot mockup */}
                <div className="mockup-frame">
                  <div className="bg-[#f4f5f4] px-4 py-2 flex items-center gap-2 border-b border-gray-200">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <div className="w-2 h-2 rounded-full bg-yellow-400" />
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 mx-3">
                      <div className="bg-white rounded px-3 py-0.5 text-[9px] text-gray-400 text-center font-mono">
                        app.inthehood.io
                      </div>
                    </div>
                  </div>
                  <img
                    src={feature.screenshot}
                    alt={feature.title}
                    className="w-full"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
