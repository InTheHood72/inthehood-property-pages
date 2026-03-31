'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Showcase', href: '#showcase' },
  { label: 'Pricing', href: '#pricing' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      data-testid="navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-nav border-b border-[var(--ith-border)] shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2" data-testid="nav-logo">
          <Image
            src="/landing/logos/logo-dark-full.png"
            alt="InTheHood"
            width={140}
            height={32}
            className="h-7 w-auto"
          />
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--ith-muted)] hover:text-[var(--ith-forest)] transition-colors"
              data-testid={`nav-link-${link.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://app.inthehood.io"
            className="text-sm font-medium text-[var(--ith-forest)] hover:text-[var(--ith-green-500)] transition-colors"
            data-testid="nav-login"
          >
            Log in
          </a>
          <a
            href="https://app.inthehood.io"
            className="btn-glow text-sm font-semibold px-5 py-2.5 rounded-full bg-[var(--ith-forest)] text-white hover:bg-[var(--ith-forest-deep)] transition-colors"
            data-testid="nav-get-started"
          >
            Get Started
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="nav-mobile-toggle"
        >
          <div className="w-5 flex flex-col gap-1">
            <span className={`block h-0.5 w-full bg-[var(--ith-forest)] transition-transform ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <span className={`block h-0.5 w-full bg-[var(--ith-forest)] transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-full bg-[var(--ith-forest)] transition-transform ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass-nav border-t border-[var(--ith-border)] px-6 py-4 space-y-3">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-sm font-medium text-[var(--ith-muted)] hover:text-[var(--ith-forest)]"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://app.inthehood.io"
            className="block text-sm font-semibold px-5 py-2.5 rounded-full bg-[var(--ith-forest)] text-white text-center mt-3"
          >
            Get Started
          </a>
        </div>
      )}
    </nav>
  );
}
