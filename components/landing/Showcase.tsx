'use client';

import { useEffect, useRef } from 'react';

const presentations = [
  {
    title: '52 Sandstone Ridge Crescent',
    location: 'Okotoks, AB',
    price: '$887,900',
    template: 'Air Template',
    image: '/landing/screenshot-embeds.jpg',
  },
  {
    title: '416 Ranch Gate',
    location: 'Strathmore, AB',
    price: '$589,900',
    template: 'Numero Template',
    image: '/landing/screenshot-dashboard.jpg',
  },
  {
    title: '214 Cityside Grove NE',
    location: 'Calgary, AB',
    price: '$459,900',
    template: 'Default Template',
    image: '/landing/screenshot-mls.jpg',
  },
  {
    title: '102 Walden Circle SE',
    location: 'Calgary, AB',
    price: '$440,000',
    template: 'Air Template',
    image: '/landing/screenshot-embeds.jpg',
  },
];

export default function Showcase() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animId: number;
    let pos = 0;

    const animate = () => {
      pos += 0.3;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    const pause = () => cancelAnimationFrame(animId);
    const resume = () => { animId = requestAnimationFrame(animate); };

    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);

    return () => {
      cancelAnimationFrame(animId);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
    };
  }, []);

  return (
    <section id="showcase" className="py-24 lg:py-32" data-testid="showcase-section">
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[var(--ith-green-500)] mb-4">
            Showcase
          </span>
          <h2 className="font-[family-name:var(--font-outfit)] text-4xl sm:text-5xl font-800 tracking-tight text-[var(--ith-forest-deep)]">
            Custom Creations That Stand Out
          </h2>
          <p className="text-base text-[var(--ith-muted)] mt-4 leading-relaxed">
            See how our clients&apos; listings shine with professional property and neighbourhood presentations.
          </p>
        </div>
      </div>

      {/* Horizontal scrolling showcase */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex gap-6 px-6 pb-4" style={{ width: 'max-content' }}>
          {[...presentations, ...presentations].map((item, i) => (
            <div
              key={i}
              className="w-[380px] flex-shrink-0 group cursor-pointer"
              data-testid={`showcase-card-${i}`}
            >
              <div className="relative overflow-hidden rounded-2xl mb-4">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-[240px] object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-[var(--ith-forest)]/0 group-hover:bg-[var(--ith-forest)]/60 transition-all duration-300 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/20 backdrop-blur-sm px-5 py-2 rounded-full">
                    View Presentation
                  </span>
                </div>
                {/* Template badge */}
                <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/90 backdrop-blur text-[10px] font-semibold text-[var(--ith-forest)]">
                  {item.template}
                </span>
              </div>
              <h3 className="font-[family-name:var(--font-outfit)] font-700 text-[var(--ith-forest-deep)]">
                {item.title}
              </h3>
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm text-[var(--ith-muted)]">{item.location}</p>
                <p className="text-sm font-semibold text-[var(--ith-green-500)]">{item.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
