'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const testimonials = [
  {
    quote: "InTheHood completely transformed how I present listings. The neighbourhood profiles alone have generated more leads than any open house I've held.",
    name: 'Sarah Mitchell',
    title: 'Senior Agent, Royal LePage Benchmark',
    initials: 'SM',
  },
  {
    quote: "The embed generator saved us hours of work. We now have live property feeds on every agent's website, and the half-map view is a game changer.",
    name: 'David Chen',
    title: 'Team Lead, RE/MAX Real Estate',
    initials: 'DC',
  },
  {
    quote: "Buyers love the interactive maps and neighbourhood guides. It sets our listings apart and shows we truly know the communities we serve.",
    name: 'Lisa Thompson',
    title: 'Broker, Century 21 All Stars',
    initials: 'LT',
  },
  {
    quote: "The studio posters are incredible — they turn our listings into viral social media content. We've seen a 3x increase in engagement since using InTheHood.",
    name: 'Marcus Rivera',
    title: 'Marketing Director, EXIT Realty',
    initials: 'MR',
  },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);

  const next = () => setCurrent((c) => (c + 1) % testimonials.length);
  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);

  return (
    <section className="py-24 lg:py-32 bg-[var(--ith-surface)]" data-testid="testimonials-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[var(--ith-green-500)] mb-4">
            Testimonials
          </span>
          <h2 className="font-[family-name:var(--font-outfit)] text-4xl sm:text-5xl font-800 tracking-tight text-[var(--ith-forest-deep)]">
            Trusted by Top-Rated Agents
          </h2>
        </div>

        {/* Desktop: Grid view */}
        <div className="hidden md:grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="testimonial-card bg-white rounded-2xl p-8 border border-[var(--ith-border)] relative"
              data-testid={`testimonial-card-${i}`}
            >
              <Quote className="w-8 h-8 text-[var(--ith-green-100)] mb-4" />
              <p className="text-[var(--ith-text)] leading-relaxed mb-6 text-[15px]">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--ith-green-400)] to-[var(--ith-forest)] flex items-center justify-center text-white text-xs font-bold">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--ith-forest-deep)]">{t.name}</p>
                  <p className="text-xs text-[var(--ith-muted)]">{t.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: Carousel */}
        <div className="md:hidden">
          <div className="bg-white rounded-2xl p-8 border border-[var(--ith-border)] relative">
            <Quote className="w-8 h-8 text-[var(--ith-green-100)] mb-4" />
            <p className="text-[var(--ith-text)] leading-relaxed mb-6 text-[15px] min-h-[120px]">
              &ldquo;{testimonials[current].quote}&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--ith-green-400)] to-[var(--ith-forest)] flex items-center justify-center text-white text-xs font-bold">
                {testimonials[current].initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--ith-forest-deep)]">{testimonials[current].name}</p>
                <p className="text-xs text-[var(--ith-muted)]">{testimonials[current].title}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={prev} className="p-2 rounded-full border border-[var(--ith-border)] hover:bg-white transition" data-testid="testimonial-prev">
              <ChevronLeft className="w-4 h-4 text-[var(--ith-muted)]" />
            </button>
            <div className="flex gap-1.5">
              {testimonials.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? 'bg-[var(--ith-green-500)]' : 'bg-gray-200'}`} />
              ))}
            </div>
            <button onClick={next} className="p-2 rounded-full border border-[var(--ith-border)] hover:bg-white transition" data-testid="testimonial-next">
              <ChevronRight className="w-4 h-4 text-[var(--ith-muted)]" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
