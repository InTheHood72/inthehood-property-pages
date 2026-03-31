'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight, Play } from 'lucide-react';

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (el) el.classList.add('in-view');
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-[90vh] flex items-center overflow-hidden pt-16"
      data-testid="hero-section"
    >
      {/* Background blobs */}
      <div className="hero-blob w-[600px] h-[600px] bg-[var(--ith-green-100)] top-[-200px] right-[-100px]" />
      <div className="hero-blob w-[400px] h-[400px] bg-[var(--ith-green-300)] bottom-[-100px] left-[-50px]" style={{ opacity: 0.2 }} />
      <div className="hero-blob w-[300px] h-[300px] bg-[#bbf7d0] top-[40%] right-[20%]" style={{ opacity: 0.15 }} />

      <div className="max-w-7xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="space-y-8 relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--ith-green-50)] border border-[var(--ith-green-100)] text-[var(--ith-green-500)] text-xs font-semibold tracking-wide uppercase animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ith-green-500)] animate-pulse" />
              Now with AI-Powered Neighbourhood Profiles
            </div>

            <h1 className="font-[family-name:var(--font-outfit)] text-5xl sm:text-6xl lg:text-7xl font-800 tracking-tight leading-[1.05] text-[var(--ith-forest-deep)] animate-fade-up delay-100">
              Level Up
              <br />
              Your <span className="relative inline-block">
                Listings
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 8c40-6 80-6 120-2s56 4 76 0" stroke="var(--ith-green-400)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-[var(--ith-muted)] max-w-lg leading-relaxed animate-fade-up delay-200">
              Promote every property with a stunning landing page that highlights the home, its neighbourhood, and nearby amenities.
            </p>

            <div className="flex flex-wrap items-center gap-4 animate-fade-up delay-300">
              <a
                href="https://app.inthehood.io"
                className="btn-glow inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[var(--ith-forest)] text-white font-semibold text-sm hover:bg-[var(--ith-forest-deep)] transition-all group"
                data-testid="hero-get-started"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#showcase"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-[var(--ith-border)] text-[var(--ith-forest)] font-semibold text-sm hover:bg-[var(--ith-green-50)] transition-all"
                data-testid="hero-see-designs"
              >
                <Play className="w-4 h-4 fill-current" />
                See Our Designs
              </a>
            </div>

            {/* Social proof mini */}
            <div className="flex items-center gap-4 pt-4 animate-fade-up delay-400">
              <div className="flex -space-x-2">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--ith-green-300)] to-[var(--ith-green-500)] border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
                    {['KM','JR','AL','ST'][i-1]}
                  </div>
                ))}
              </div>
              <p className="text-sm text-[var(--ith-muted)]">
                Trusted by <span className="font-semibold text-[var(--ith-forest)]">1,000+</span> agents across Canada
              </p>
            </div>
          </div>

          {/* Right: Product mockup */}
          <div className="relative animate-fade-up delay-300">
            <div className="mockup-frame relative">
              {/* Browser chrome */}
              <div className="bg-[#f4f5f4] px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-3">
                  <div className="bg-white rounded-md px-3 py-1 text-[10px] text-gray-400 text-center font-mono">
                    app.inthehood.io/dashboard
                  </div>
                </div>
              </div>
              {/* Screenshot */}
              <img
                src="/landing/screenshot-dashboard.jpg"
                alt="InTheHood Dashboard"
                className="w-full"
                data-testid="hero-screenshot"
              />
            </div>

            {/* Floating stats card */}
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl border border-[var(--ith-border)] p-4 hidden lg:block">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--ith-green-50)] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--ith-green-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--ith-muted)]">Page Views</p>
                  <p className="text-lg font-bold text-[var(--ith-forest)]">9,208</p>
                </div>
                <span className="text-[11px] font-semibold text-[var(--ith-green-500)] bg-[var(--ith-green-50)] px-2 py-0.5 rounded-full">+175%</span>
              </div>
            </div>

            {/* Floating MLS card */}
            <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl border border-[var(--ith-border)] p-3 hidden lg:block">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--ith-forest)] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">92</span>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--ith-muted)]">New MLS Today</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-[var(--ith-green-500)]">+382%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
