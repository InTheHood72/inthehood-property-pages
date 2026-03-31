'use client';

import { useEffect, useRef } from 'react';
import { Send, Paintbrush, Share2 } from 'lucide-react';

const steps = [
  {
    icon: Send,
    number: '01',
    title: 'Submit Your Listing',
    description: 'Send your property details: photos, floor plans, videos, virtual tours, and any key highlights.',
    color: 'var(--ith-green-500)',
    bgColor: 'var(--ith-green-50)',
  },
  {
    icon: Paintbrush,
    number: '02',
    title: 'We Craft Your Landing Page',
    description: 'We create a custom-branded page that showcases your property and its neighbourhood profile. Your branding, colors, and property features are seamlessly integrated.',
    color: 'var(--ith-forest)',
    bgColor: '#EFF6F1',
  },
  {
    icon: Share2,
    number: '03',
    title: 'Showcase Your Space',
    description: 'Share the link on your website, MLS, and third-party platforms like Realtor.ca. Every page is mobile-ready and optimized to convert leads.',
    color: 'var(--ith-green-400)',
    bgColor: 'var(--ith-green-50)',
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.15 }
    );

    const cards = sectionRef.current?.querySelectorAll('.step-card');
    cards?.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="py-24 lg:py-32" ref={sectionRef} data-testid="how-it-works-section">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[var(--ith-green-500)] mb-4">
            How It Works
          </span>
          <h2 className="font-[family-name:var(--font-outfit)] text-4xl sm:text-5xl font-800 tracking-tight text-[var(--ith-forest-deep)]">
            The Easiest Way to Promote Your Listings
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="step-card animate-fade-up relative group"
              style={{ animationDelay: `${idx * 0.15}s` }}
              data-testid={`step-card-${idx}`}
            >
              {/* Connector line */}
              {idx < 2 && (
                <div className="hidden md:block absolute top-12 left-[calc(100%+4px)] w-[calc(100%-56px)] h-px border-t-2 border-dashed border-[var(--ith-green-200)]" />
              )}

              <div className="relative p-8 rounded-2xl bg-white border border-[var(--ith-border)] hover:border-[var(--ith-green-300)] transition-all hover:shadow-lg hover:shadow-[var(--ith-glow)]">
                {/* Number */}
                <span className="absolute top-6 right-6 text-5xl font-[family-name:var(--font-outfit)] font-800 text-gray-100 select-none">
                  {step.number}
                </span>

                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: step.bgColor }}
                >
                  <step.icon className="w-6 h-6" style={{ color: step.color }} />
                </div>

                <h3 className="font-[family-name:var(--font-outfit)] text-xl font-700 text-[var(--ith-forest-deep)] mb-3">
                  {step.title}
                </h3>
                <p className="text-sm text-[var(--ith-muted)] leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <a
            href="https://app.inthehood.io"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[var(--ith-forest)] text-white font-semibold text-sm hover:bg-[var(--ith-forest-deep)] transition-all"
            data-testid="how-it-works-cta"
          >
            Get Started
          </a>
        </div>
      </div>
    </section>
  );
}
