'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import OpenHouseBar from '@/components/numero/OpenHouseBar';

// Constants
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Dark Theme Colors
const COLORS = {
  bg: '#121212',
  bgSurface: '#1B1B1B',
  bgSurface2: '#222222',
  text: '#F5F5F5',
  textGray: '#A3A3A3',
  textMuted: '#6B7280',
  border: '#333333',
  accent: '#3B82F6',
  accentSecondary: '#F59E0B',
};

// Fetch backend URL
async function fetchBackendUrl(): Promise<string> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/global_settings?select=api_config&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    return data?.[0]?.api_config?.current_backend_url?.replace(/\/$/, '') || '';
  } catch { return ''; }
}

// Fetch and inject custom CSS from admin panel settings
async function fetchAndInjectCSS(backendUrl: string): Promise<void> {
  if (!backendUrl) return;
  try {
    const res = await fetch(`${backendUrl}/api/numero-template/global-css`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success || !data.settings) return;
    
    const settings = data.settings;
    let cssToInject = '';
    
    // Global CSS - Dark theme
    if (settings.global_css_dark) cssToInject += `\n/* Global CSS - Dark */\n${settings.global_css_dark}\n`;
    if (settings.dark_css) cssToInject += `\n/* Dark Theme CSS */\n${settings.dark_css}\n`;
    if (settings.breakpoint_css_dark) cssToInject += `\n/* Breakpoint CSS - Dark */\n${settings.breakpoint_css_dark}\n`;
    if (settings.typography_css) cssToInject += `\n/* Typography CSS */\n${settings.typography_css}\n`;
    
    if (cssToInject.trim()) {
      const styleId = 'numero-admin-custom-css';
      let styleEl = document.getElementById(styleId) as HTMLStyleElement;
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
      styleEl.textContent = cssToInject;
    }
  } catch (e) { console.warn('Could not fetch Numero CSS settings:', e); }
}

// Supabase fetch helper
const supabaseFetch = async (table: string, query: string) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  return res.json();
};

// Date picker helper
const getDateOptions = () => {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
};

// Strip HTML helper
const stripHtml = (html: string | null | undefined) => {
  if (!html) return '';
  const decoded = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded.replace(/<[^>]*>/g, '');
};

// Format location helper - uses neighbourhood.name from linked table, then property fields
const formatLocation = (neighbourhoodObj: any, property: any) => {
  const locationParts = [];
  
  // Priority 1: Neighbourhood name from linked neighborhoods table
  const neighbourhoodName = neighbourhoodObj?.name;
  if (neighbourhoodName && neighbourhoodName.trim() !== '' && neighbourhoodName.toUpperCase() !== 'NONE') {
    locationParts.push(neighbourhoodName);
  }
  
  // Priority 2: Property's neighbourhood field (fallback)
  if (!neighbourhoodName && property?.neighbourhood) {
    const propNeighbourhood = property.neighbourhood;
    if (propNeighbourhood && propNeighbourhood.trim() !== '' && propNeighbourhood.toUpperCase() !== 'NONE') {
      locationParts.push(propNeighbourhood);
    }
  }
  
  // City
  const city = property?.city;
  if (city && city.trim() !== '' && city.toUpperCase() !== 'NONE') {
    if (!locationParts.length || locationParts[0].toLowerCase() !== city.toLowerCase()) {
      locationParts.push(city);
    }
  }
  
  // Province
  const province = property?.province;
  if (province && province.trim() !== '' && province.toUpperCase() !== 'NONE') {
    locationParts.push(province);
  }
  
  return locationParts.join(', ');
};

// Dynamic Section Numbering Helper - Dark Theme
interface SectionNumbers {
  story: string; gallery: string; virtualTour: string; features: string;
  roomDimensions: string; neighbourhood: string; map: string;
  outside: string; amenities: string; shopDine: string;
}

const getSectionNumbers = (property: any, hasNeighbourhoodOrCity: boolean, profileConfig: any): SectionNumbers => {
  let num = 1;
  const story = num.toString().padStart(2, '0'); num++;
  const gallery = num.toString().padStart(2, '0');
  if (property?.images?.length > 0) num++;
  
  let virtualTour = '';
  if (property?.virtual_tour_url) { virtualTour = num.toString().padStart(2, '0'); num++; }
  
  let features = '';
  const hasFeatures = (property?.appliances?.length > 0) || (property?.interior_features?.length > 0) || 
    (property?.exterior_features?.length > 0) || (property?.community_features?.length > 0);
  if (hasFeatures) { features = num.toString().padStart(2, '0'); num++; }
  
  let roomDimensions = '';
  if (property?.room_dimensions) {
    try {
      const rooms = typeof property.room_dimensions === 'string' ? JSON.parse(property.room_dimensions) : property.room_dimensions;
      if (Array.isArray(rooms) && rooms.length > 0) { roomDimensions = num.toString().padStart(2, '0'); num++; }
    } catch (e) {}
  }
  
  let neighbourhood = '', map = '', outside = '', amenities = '', shopDine = '';
  if (hasNeighbourhoodOrCity) {
    // Neighbourhood intro - only show if neighbourhoodIntro config exists
    if (profileConfig?.neighbourhoodIntro) { neighbourhood = num.toString().padStart(2, '0'); num++; }
    // Interactive Map - always show if neighbourhood/city exists
    map = num.toString().padStart(2, '0'); num++;
    if (profileConfig?.outside?.images?.length > 0) { outside = num.toString().padStart(2, '0'); num++; }
    if (profileConfig?.amenities?.images?.length > 0) { amenities = num.toString().padStart(2, '0'); num++; }
    if (profileConfig?.shopDine?.images?.length > 0) { shopDine = num.toString().padStart(2, '0'); num++; }
  }
  
  return { story, gallery, virtualTour, features, roomDimensions, neighbourhood, map, outside, amenities, shopDine };
};

// Animation component
const FadeIn = ({ children, delay = 0, direction = 'up', className = '' }: { children: React.ReactNode; delay?: number; direction?: 'up' | 'down' | 'left' | 'right'; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  
  const getInitial = () => ({
    opacity: 0,
    y: direction === 'up' ? 40 : direction === 'down' ? -40 : 0,
    x: direction === 'left' ? 40 : direction === 'right' ? -40 : 0,
  });

  return (
    <motion.div ref={ref} initial={getInitial()} animate={isInView ? { opacity: 1, y: 0, x: 0 } : getInitial()} transition={{ duration: 0.8, delay, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>
  );
};

// Animated Headline - LEFT to RIGHT character reveal (Dark Theme)
const AnimatedHeadline = ({ text, isDark = true }: { text: string; isDark?: boolean }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  
  const words = text.split(' ');
  let charIndex = 0;
  
  return (
    <h1 
      ref={ref}
      className="numero-hero-headline text-[clamp(2.5rem,8vw,5.5rem)] font-light leading-[1.05] tracking-[-0.04em]"
      style={{ color: isDark ? '#F5F5F5' : '#000000' }}
    >
      {words.map((word, wordIdx) => {
        const wordChars = word.split('').map((char, idx) => {
          const currentCharIndex = charIndex++;
          return (
            <motion.span
              key={`${wordIdx}-${idx}`}
              initial={{ x: 20, opacity: 0 }}
              animate={isInView ? { x: 0, opacity: 1 } : { x: 20, opacity: 0 }}
              transition={{ 
                duration: 0.8, 
                delay: 0.45 + currentCharIndex * 0.035,
                ease: [0.25, 0.1, 0.25, 1]
              }}
              style={{ display: 'inline-block' }}
            >
              {char}
            </motion.span>
          );
        });
        charIndex++;
        return (
          <span key={wordIdx} style={{ display: 'inline-block', marginRight: '0.25em' }}>
            {wordChars}
          </span>
        );
      })}
      <motion.img 
        src={isDark ? '/assets/numero/arrow-dark.webp' : '/assets/numero/arrow-light.webp'}
        alt=""
        initial={{ x: 30, opacity: 0 }}
        animate={isInView ? { x: 0, opacity: 1 } : { x: 30, opacity: 0 }}
        transition={{ 
          duration: 0.8, 
          delay: 0.45 + (text.length + words.length) * 0.035 + 0.1,
          ease: [0.25, 0.1, 0.25, 1]
        }}
        style={{ 
          height: 'clamp(2rem, 5vw, 3.5rem)', 
          width: 'auto', 
          marginLeft: '0.25rem',
          display: 'inline-block',
          verticalAlign: 'middle'
        }}
      />
    </h1>
  );
};

// Hero Image - Grows from 60% to 100% WIDTH on scroll
const GrowHeroImage = ({ src, alt }: { src: string; alt: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const widthRef = useRef(60);
  const targetWidthRef = useRef(60);
  
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    let animationFrameId: number;
    
    const updateWidth = () => {
      const lerpFactor = 0.08;
      widthRef.current += (targetWidthRef.current - widthRef.current) * lerpFactor;
      if (containerRef.current) containerRef.current.style.width = `${widthRef.current}%`;
      animationFrameId = requestAnimationFrame(updateWidth);
    };
    
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const startPoint = windowHeight * 0.9;
      const endPoint = windowHeight * 0.5;
      // Progress works both directions - grows on scroll down, shrinks on scroll up
      const progress = Math.max(0, Math.min(1, (startPoint - rect.top) / (startPoint - endPoint)));
      targetWidthRef.current = 60 + (progress * 40);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    setTimeout(handleScroll, 50);
    animationFrameId = requestAnimationFrame(updateWidth);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
  return (
    <div 
      ref={containerRef} 
      className="mx-auto overflow-hidden"
      style={{ 
        width: '60%',
        borderRadius: '20px',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 0.8s ease-out, transform 0.8s ease-out'
      }}
    >
      <img src={src} alt={alt} style={{ width: '100%', height: 'auto', maxHeight: '75vh', objectFit: 'cover', display: 'block' }} />
    </div>
  );
};

// Explore Button Component - rr-btn-group style (level by default, rotates on hover)
const ExploreButtonDark = () => {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const introSection = document.getElementById('neighbourhood-intro');
    if (introSection) {
      introSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  return (
    <a 
      href="#neighbourhood-intro"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
    >
      <span style={{
        padding: '9px 25px',
        fontWeight: 500,
        fontSize: '18px',
        lineHeight: 1,
        color: '#fff',
        backgroundColor: 'transparent',
        border: '1px solid rgba(255,255,255,0.5)',
        borderRadius: '50px',
        transition: 'all 0.3s',
        transform: isHovered ? 'rotate(-20deg)' : 'rotate(0deg)',
        display: 'inline-block',
      }}>
        Explore
      </span>
      <span style={{
        padding: '9px 11px',
        fontWeight: 500,
        fontSize: '18px',
        lineHeight: 1,
        color: '#fff',
        backgroundColor: 'transparent',
        border: '1px solid rgba(255,255,255,0.5)',
        borderRadius: '50px',
        transition: 'all 0.3s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: isHovered ? 'translate(-7px, 0px)' : 'translate(0, 0)',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: 'rotate(-30deg)' }}>
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </a>
  );
};

// Floor Plan CTA Component - cta-area-4 style with underline animation (Dark theme)
const FloorPlanCTADark = ({ url }: { url: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div className="mt-10">
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          fontSize: '40px',
          fontWeight: 400,
          lineHeight: 0.96,
          letterSpacing: '-0.05em',
          paddingBottom: '20px',
          position: 'relative',
          display: 'inline-block',
          cursor: 'pointer',
          color: '#F5F5F5',
          textDecoration: 'none',
        }}
      >
        {/* Underline */}
        <span style={{
          position: 'absolute',
          content: '""',
          left: 0,
          bottom: 0,
          width: isHovered ? '0%' : '100%',
          height: '4px',
          backgroundColor: '#F5F5F5',
          transition: 'width 0.3s ease',
        }} />
        See the
        <span style={{
          marginLeft: '16px',
          display: 'inline-block',
          lineHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          width: '1.4em',
          height: '1.4em',
          verticalAlign: 'middle',
        }}>
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{
              transition: 'all 0.3s',
              width: '100%',
              height: '100%',
              transform: isHovered ? 'translate(100%, -100%)' : 'translate(0, 0)',
            }}
          >
            <path d="M7 17L17 7M17 7H7M17 7V17" />
          </svg>
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              transform: isHovered ? 'translate(0%, 0%)' : 'translate(-100%, 100%)',
              transition: 'all 0.3s',
              width: '100%',
              height: '100%',
            }}
          >
            <path d="M7 17L17 7M17 7H7M17 7V17" />
          </svg>
        </span>
        <br />
        floor plan
      </a>
    </div>
  );
};

// Masonry Gallery Component - Dark theme with cta-area-4 animation
const MasonryGallery = ({ images, onImageClick, isDark = true, showMoreText = 'Show more property photos' }: { images: string[]; onImageClick: (index: number) => void; isDark?: boolean; showMoreText?: string }) => {
  const [visibleCount, setVisibleCount] = useState(8);
  
  useEffect(() => {
    const updateVisibleCount = () => {
      const width = window.innerWidth;
      if (width > 900) setVisibleCount(8);
      else if (width > 600) setVisibleCount(5);
      else setVisibleCount(3);
    };
    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);
  
  const displayImages = images.slice(0, visibleCount);
  const hasMore = images.length > visibleCount;

  // Parse showMoreText into two lines: "See more" on line 1, rest on line 2
  const parseShowMoreText = (text: string) => {
    const match = text.match(/^Show more (.+)$/i);
    if (match) {
      return { line2: match[1] };
    }
    return { line2: 'photos' };
  };
  const ctaText = parseShowMoreText(showMoreText);
  
  return (
    <div className="numero-masonry-gallery-dark">
      <style jsx>{`
        .numero-masonry-gallery-dark {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: auto auto auto;
          grid-template-areas: "a b b c" "d d e e" "f g g h";
          gap: 16px;
        }
        .numero-masonry-gallery-dark .gallery-item { min-height: 200px; cursor: pointer; overflow: hidden; border-radius: 12px; }
        .numero-masonry-gallery-dark .gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
        .numero-masonry-gallery-dark .gallery-item:hover img { transform: scale(1.05); }
        .numero-masonry-gallery-dark .gallery-item:nth-child(1) { grid-area: a; }
        .numero-masonry-gallery-dark .gallery-item:nth-child(2) { grid-area: b; }
        .numero-masonry-gallery-dark .gallery-item:nth-child(3) { grid-area: c; }
        .numero-masonry-gallery-dark .gallery-item:nth-child(4) { grid-area: d; }
        .numero-masonry-gallery-dark .gallery-item:nth-child(5) { grid-area: e; }
        .numero-masonry-gallery-dark .gallery-item:nth-child(6) { grid-area: f; }
        .numero-masonry-gallery-dark .gallery-item:nth-child(7) { grid-area: g; }
        .numero-masonry-gallery-dark .gallery-item:nth-child(8) { grid-area: h; }
        @media (max-width: 900px) {
          .numero-masonry-gallery-dark { grid-template-columns: repeat(2, 1fr); grid-template-areas: "a b" "c c" "d e"; }
          .numero-masonry-gallery-dark .gallery-item:nth-child(n+6) { display: none; }
        }
        @media (max-width: 600px) {
          .numero-masonry-gallery-dark { grid-template-columns: 1fr; grid-template-areas: "a" "b" "c"; }
          .numero-masonry-gallery-dark .gallery-item:nth-child(n+4) { display: none; }
        }
        /* CTA Area 4 - See More Styles - Dark Theme - IDENTICAL to redox */
        .numero-cta-area-4-dark {
          grid-column: 1 / -1;
          width: 100%;
          margin-top: 40px;
          padding: 0;
        }
        .numero-cta-area-4-dark .cta-title {
          font-size: 40px;
          font-weight: 400;
          line-height: 0.96;
          letter-spacing: -0.05em;
          padding-bottom: 20px;
          position: relative;
          display: inline-block;
          cursor: pointer;
          color: #F5F5F5;
          text-decoration: none;
        }
        .numero-cta-area-4-dark .cta-title::before {
          position: absolute;
          content: "";
          left: 0;
          bottom: 0;
          width: 100%;
          height: 4px;
          background-color: #F5F5F5;
          transition: width 0.3s ease;
        }
        .numero-cta-area-4-dark .cta-title:hover::before {
          width: 0;
        }
        .numero-cta-area-4-dark .cta-title .icon-wrapper {
          margin-left: 16px;
          display: inline-block;
          line-height: 0;
          position: relative;
          overflow: hidden;
          width: 1.4em;
          height: 1.4em;
          vertical-align: middle;
        }
        .numero-cta-area-4-dark .cta-title .icon-wrapper .icon-first {
          transition: all 0.3s;
          width: 100%;
          height: 100%;
        }
        .numero-cta-area-4-dark .cta-title .icon-wrapper .icon-second {
          position: absolute;
          bottom: 0;
          left: 0;
          transform: translate(-100%, 100%);
          transition: all 0.3s;
          width: 100%;
          height: 100%;
        }
        .numero-cta-area-4-dark .cta-title:hover .icon-wrapper .icon-first {
          transform: translate(100%, -100%);
        }
        .numero-cta-area-4-dark .cta-title:hover .icon-wrapper .icon-second {
          transform: translate(0%, 0%);
        }
      `}</style>
      {displayImages.map((img, idx) => (
        <div key={idx} className="gallery-item" onClick={() => onImageClick(idx)}><img src={img} alt={`Photo ${idx + 1}`} /></div>
      ))}
      {hasMore && (
        <div className="numero-cta-area-4-dark">
          <a className="cta-title" onClick={() => onImageClick(visibleCount)}>
            See more
            <span className="icon-wrapper">
              <svg className="icon-first" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
              <svg className="icon-second" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </span>
            <br />
            {ctaText.line2}
          </a>
        </div>
      )}
    </div>
  );
};

// Video Lightbox
const VideoLightbox = ({ youtubeId, isOpen, onClose }: { youtubeId: string; isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95" onClick={onClose}>
      <div className="relative w-[90%] max-w-[1200px] aspect-video" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-12 right-0 text-white text-4xl font-bold hover:opacity-70">×</button>
        <iframe src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
      </div>
    </div>
  );
};

// Image Lightbox - Dark theme: styled like default template with dark colors
const ImageLightbox = ({ images, index, setIndex, onClose }: { images: string[]; index: number; setIndex: (i: number) => void; onClose: () => void }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((index - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setIndex((index + 1) % images.length);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, images.length, setIndex, onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: '#121212' }} tabIndex={0}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
      <button onClick={(e) => { e.stopPropagation(); setIndex((index - 1 + images.length) % images.length); }} className="absolute left-4 text-white hover:text-gray-300 p-2 w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <img src={images[index]} alt="" className="max-h-[85vh] max-w-[85vw] object-contain" style={{ borderRadius: '15px' }} onClick={e => e.stopPropagation()} />
      <button onClick={(e) => { e.stopPropagation(); setIndex((index + 1) % images.length); }} className="absolute right-4 text-white hover:text-gray-300 p-2 w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      <div className="absolute bottom-6 text-white bg-gray-800 px-4 py-2 rounded-full font-medium">{index + 1} / {images.length}</div>
    </div>
  );
};

interface NavItem { id: string; label: string; sectionId: string; }

export default function NumeroDarkClient() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('id');
  const [property, setProperty] = useState<any>(null);
  const [content, setContent] = useState<any>(null);
  const [neighbourhood, setNeighbourhood] = useState<any>(null);
  const [city, setCity] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [coListingAgents, setCoListingAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [BACKEND_URL, setBackendUrl] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [videoLightboxOpen, setVideoLightboxOpen] = useState(false);
  const [showStickyNav, setShowStickyNav] = useState(false);
  const [activeSection, setActiveSection] = useState('property-hero');
  const [showContactModal, setShowContactModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '', tourType: 'video' as 'video' | 'live', selectedAgent: 'primary' });

  useEffect(() => { fetchBackendUrl().then(setBackendUrl); }, []);
  
  // Inject custom CSS from admin panel settings
  useEffect(() => { if (BACKEND_URL) fetchAndInjectCSS(BACKEND_URL); }, [BACKEND_URL]);
  
  useEffect(() => { const today = new Date(); today.setHours(0, 0, 0, 0); setSelectedDate(today); }, []);
  useEffect(() => {
    const handleScroll = () => setShowStickyNav(window.scrollY > 150);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!propertyId) { setLoading(false); return; }
    const loadData = async () => {
      try {
        // First get the MLS number from the property ID
        const propLookup = await supabaseFetch('properties', `id=eq.${propertyId}&select=mls_number,user_id,co_listing_agents,neighborhood_id,images`);
        if (!propLookup?.[0]) { setLoading(false); return; }
        
        const mlsNumber = propLookup[0].mls_number;
        const userId = propLookup[0].user_id;
        const coAgentIds = propLookup[0].co_listing_agents;
        const neighborhoodId = propLookup[0].neighborhood_id;
        const rawImages = propLookup[0].images;
        
        // Use the backend API (same as redox) to get properly merged content
        const backendUrl = await fetchBackendUrl();
        if (backendUrl && mlsNumber) {
          try {
            const apiRes = await fetch(`${backendUrl}/api/creative-template/${mlsNumber}`);
            if (apiRes.ok) {
              const apiData = await apiRes.json();
              const p = apiData.property || {};
              p.images = rawImages ? rawImages.map((url: string) => typeof url === 'string' ? { url } : url) : [];
              setProperty(p);
              setContent(apiData.content || {});
              setNeighbourhood(apiData.neighbourhood || apiData.neighborhood || null);
            }
          } catch (apiErr) {
            console.error('Backend API error, falling back to direct fetch:', apiErr);
          }
        }
        
        if (userId) {
          const profiles = await supabaseFetch('profiles', `id=eq.${userId}&select=*`);
          if (profiles?.[0]) {
            const a = profiles[0];
            setAgent({ id: a.id, name: a.full_name || a.name, phone: a.phone_number, email: a.email, profile_image: a.profile_image_url, brokerage: a.brokerage_name });
          }
        }
        if (coAgentIds?.length > 0) {
          const coAgents = await supabaseFetch('profiles', `id=in.(${coAgentIds.join(',')})`);
          if (coAgents?.length > 0) setCoListingAgents(coAgents.map((a: any) => ({ id: a.id, name: a.full_name || a.name, phone: a.phone_number, email: a.email, profile_image: a.profile_image_url })));
        }
        if (!neighbourhood && neighborhoodId) {
          const hoods = await supabaseFetch('neighborhoods', `id=eq.${neighborhoodId}&select=*`);
          if (hoods?.[0]) setNeighbourhood(hoods[0]);
        }
      } catch (e) { console.error('Error loading data:', e); }
      setLoading(false);
    };
    loadData();
  }, [propertyId]);

  const hasVirtualTour = useMemo(() => !!(property?.virtual_tour_url || property?.virtual_tour_link), [property]);
  const hasNeighbourhood = useMemo(() => !!(neighbourhood?.name || neighbourhood?.id), [neighbourhood]);
  const hasCity = useMemo(() => !!(city?.name || city?.id), [city]);
  const profileData = useMemo(() => neighbourhood || city || null, [neighbourhood, city]);
  const hasProfileData = hasNeighbourhood || hasCity;

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { id: 'intro', label: 'Intro', sectionId: 'property-hero' },
      { id: 'details', label: 'Details', sectionId: 'the-property-numbers' },
      { id: 'gallery', label: 'Gallery', sectionId: 'property-gallery' },
    ];
    if (hasVirtualTour) items.push({ id: '360-tour', label: '360 Tour', sectionId: 'virtual-tour-section' });
    items.push({ id: 'features', label: 'Features', sectionId: 'property-features' });
    if (hasProfileData) {
      items.push({ id: 'the-hood', label: hasNeighbourhood ? 'The Hood' : 'The City', sectionId: 'neighbourhood-section' });
      items.push({ id: 'on-the-map', label: 'On The Map', sectionId: 'neighbourhood-map-section' });
    }
    return items;
  }, [hasVirtualTour, hasNeighbourhood, hasProfileData]);

  const scrollToSection = useCallback((sectionId: string, navId: string) => {
    setActiveSection(navId);
    setShowMobileMenu(false);
    const element = document.getElementById(sectionId);
    if (element) {
      const offsetTop = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  }, []);

  const getAgentButtonText = useCallback(() => {
    if (!agent?.name) return 'Contact Agent';
    const primaryFirstName = agent.name.split(' ')[0];
    if (coListingAgents.length > 0 && coListingAgents[0]?.name) {
      return `Contact ${primaryFirstName} & ${coListingAgents[0].name.split(' ')[0]}`;
    }
    return `Contact ${agent.name}`;
  }, [agent, coListingAgents]);

  const selectedAgentData = useMemo(() => {
    if (formData.selectedAgent === 'primary') return agent;
    return coListingAgents.find((ca: any) => ca.id === formData.selectedAgent) || agent;
  }, [formData.selectedAgent, agent, coListingAgents]);

  const openLightbox = (images: string[], index: number) => { setLightboxImages(images); setLightboxIndex(index); setLightboxOpen(true); };
  const getYoutubeId = (url: string) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch')) return url.split('v=')[1]?.split('&')[0];
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split('?')[0];
    return null;
  };
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Form submitted!');
    setShowContactModal(false);
    setShowTourModal(false);
    setFormData({ name: '', email: '', phone: '', message: '', tourType: 'video', selectedAgent: 'primary' });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" /></div>;
  if (!property) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}><h1 className="text-2xl font-bold text-white">Property not found</h1></div>;

  const images = property.images?.map((img: any) => typeof img === 'string' ? img : img.url) || [];
  const heroImage = content?.hero_image_override_url || images[0] || '';
  const youtubeId = getYoutubeId(property.video_tour_url);
  const videoThumbnail = content?.video_thumbnail_url;
  const config = profileData?.presentation_config;
  const formatPrice = (p: number) => `$${p?.toLocaleString() || '0'}`;
  const getSqft = () => property.sqft || property.square_feet || 0;
  const sectionNums = getSectionNumbers(property, hasProfileData, config);

  return (
    <>
      {/* Sequel Sans Font & Dark Theme Styles */}
      <style jsx global>{`
        @font-face { font-family: 'Sequel Sans'; src: url('/assets/fonts/Sequel Sans Medium Body.otf') format('opentype'); font-weight: 500; font-style: normal; font-display: swap; }
        @font-face { font-family: 'Sequel Sans'; src: url('/assets/fonts/Sequel Sans Roman Body.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
        .numero-dark, .numero-dark * { font-family: 'Sequel Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important; }
        
        /* Prose paragraph margins - ensure spacing between paragraphs */
        .numero-dark .prose p, .numero-dark [class*="prose"] p { margin-bottom: 1.25em; }
        .numero-dark .prose p:last-child, .numero-dark [class*="prose"] p:last-child { margin-bottom: 0; }
        
        .numero-nav-agent-btn:hover { background: #2A2A2A !important; }
        .numero-nav-agent-btn:hover .numero-nav-arrow { transform: rotate(45deg); }
        .numero-nav-tour-btn:hover { background: #e5e7eb !important; }
        .numero-nav-tour-btn:hover .numero-nav-arrow { transform: rotate(45deg); }
        .numero-nav-item:hover { background: rgba(255,255,255,0.1) !important; color: #F5F5F5 !important; }
        .contact-panel-close:hover, .tour-panel-close:hover { transform: rotate(90deg) !important; }
        
        @keyframes bar_anim { 0%, 100% { clip-path: inset(-2px 0); } 42% { clip-path: inset(-2px 0 -2px 100%); } 43% { clip-path: inset(-2px 100% -2px 0); } }
        .numero-hamburger-btn:hover { background: #d91f2d !important; transform: scale(1.05); }
        .numero-hamburger-btn:hover .hamburger-line { animation: bar_anim 0.8s cubic-bezier(0.44, 1.1, 0.53, 0.99) 1 forwards; }
        .numero-hamburger-btn:hover .hamburger-line:nth-child(2) { animation-delay: 0.1s; }
        .offcanvas-close-btn:hover { transform: rotate(90deg) !important; }
        .offcanvas-menu-item button:hover { color: #fa2837 !important; transform: translateX(15px) !important; }
        .offcanvas-contact-btn:hover { background: #333333 !important; }
        
        .numero-modal-content input:focus, .numero-modal-content textarea:focus { outline: none; border-color: #fff !important; box-shadow: 0 0 0 2px rgba(255,255,255,0.2); }
        
        @media (min-width: 1200px) { .numero-agent-text { display: inline !important; } .numero-hamburger-btn { display: none !important; } }
        @media (max-width: 1199px) and (min-width: 768px) { .numero-agent-text { display: none !important; } .numero-nav-center { display: none !important; } .numero-hamburger-btn { display: flex !important; } }
        @media (max-width: 767px) { .numero-nav-center { display: none !important; } .numero-sticky-nav { padding: 8px 12px !important; } .numero-nav-agent-btn { padding: 6px !important; } .numero-agent-text { display: none !important; } .numero-hamburger-btn { display: none !important; } .numero-contact-panel, .numero-tour-panel { width: calc(100% - 40px) !important; max-width: none !important; } }
        @media (max-width: 575px) { .numero-sticky-nav { width: 92% !important; padding: 6px 10px !important; } .numero-tour-text { font-size: 13px !important; } }
      `}</style>

      {/* Background */}
      <div className="fixed inset-0 z-0" style={{ backgroundColor: COLORS.bg }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url(/assets/numero/shape-9-dark.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
      </div>

      {/* Open House Bar */}
      <OpenHouseBar property={property} theme="dark" />

      <div className="numero-dark relative z-10 min-h-screen">
        {/* Sticky Navigation - Dark Theme */}
        <nav className="numero-sticky-nav" style={{ position: 'fixed', top: showStickyNav ? '20px' : '-100px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, width: '95%', maxWidth: '1400px', background: 'rgba(27, 27, 27, 0.98)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: '50px', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)', padding: '12px 20px', transition: 'top 0.4s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left - Agent Button */}
          <button onClick={() => setShowContactModal(true)} className="numero-nav-agent-btn" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#222222', border: 'none', borderRadius: '50px', padding: '6px 6px 6px 8px', cursor: 'pointer', transition: 'all 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {agent?.profile_image ? <img src={agent.profile_image} alt={agent.name || 'Agent'} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #333', position: 'relative', zIndex: 2 }} /> : <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A3A3A3', fontWeight: 600, fontSize: '14px', border: '2px solid #333', position: 'relative', zIndex: 2 }}>{agent?.name?.charAt(0) || 'A'}</div>}
              {coListingAgents.length > 0 && (coListingAgents[0]?.profile_image ? <img src={coListingAgents[0].profile_image} alt={coListingAgents[0].name || 'Co-Agent'} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #333', marginLeft: '-12px', position: 'relative', zIndex: 1 }} /> : <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A3A3A3', fontWeight: 600, fontSize: '14px', border: '2px solid #333', marginLeft: '-12px', position: 'relative', zIndex: 1 }}>{coListingAgents[0]?.name?.charAt(0) || 'A'}</div>)}
            </div>
            <span className="numero-agent-text" style={{ fontWeight: 500, fontSize: '14px', color: '#F5F5F5' }}>{getAgentButtonText()}</span>
            <div className="numero-nav-arrow" style={{ background: '#F5F5F5', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s ease', flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg></div>
          </button>

          {/* Center - Nav Items */}
          <div className="numero-nav-center" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#222222', borderRadius: '50px', padding: '4px' }}>
            {navItems.map((item) => (
              <button key={item.id} onClick={() => scrollToSection(item.sectionId, item.id)} className="numero-nav-item" style={{ padding: '10px 18px', border: 'none', borderRadius: '50px', background: activeSection === item.id ? '#333333' : 'transparent', color: activeSection === item.id ? '#F5F5F5' : '#A3A3A3', fontWeight: 500, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap' }}>{item.label}</button>
            ))}
          </div>

          {/* Right - Tour Button + Hamburger */}
          <div className="numero-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setShowTourModal(true)} className="numero-nav-tour-btn" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F5F5F5', border: 'none', borderRadius: '50px', padding: '6px 6px 6px 20px', cursor: 'pointer', transition: 'all 0.3s ease' }}>
              <span className="numero-tour-text" style={{ fontWeight: 500, fontSize: '14px', color: '#121212' }}>Request Tour</span>
              <div className="numero-nav-arrow" style={{ background: '#121212', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s ease', flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg></div>
            </button>
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="numero-hamburger-btn" style={{ display: 'none', width: '44px', height: '44px', background: '#fa2837', border: 'none', borderRadius: '50%', cursor: 'pointer', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', paddingRight: '2px', transition: 'all 0.3s ease' }}>
              <span className="hamburger-line" style={{ display: 'block', width: '13px', height: '2px', background: '#ffffff', borderRadius: '2px', marginLeft: 'auto', marginRight: '10px', transition: 'all 0.3s ease' }} />
              <span className="hamburger-line" style={{ display: 'block', width: '20px', height: '2px', background: '#ffffff', borderRadius: '2px', marginLeft: 'auto', marginRight: '10px', transition: 'all 0.3s ease' }} />
            </button>
          </div>
        </nav>

        {/* Mobile Offcanvas - Dark */}
        <div className={`numero-offcanvas-area ${showMobileMenu ? 'menu-open' : ''}`} style={{ position: 'fixed', top: 0, right: 0, width: showMobileMenu ? '60%' : '0', height: '100%', zIndex: 10001, pointerEvents: showMobileMenu ? 'auto' : 'none' }}>
          <div className="offcanvas-bg" style={{ position: 'fixed', top: '20px', right: '20px', bottom: '20px', width: 'calc(60% - 40px)', borderRadius: '20px', background: 'rgba(27, 27, 27, 0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', boxShadow: '0 20px 30px -8px rgba(0, 0, 0, 0.3)', clipPath: showMobileMenu ? 'circle(150% at calc(100% - 45px) 45px)' : 'circle(0% at calc(100% - 45px) 45px)', transition: 'clip-path 0.7s ease-in-out', zIndex: 2 }} />
          <div className="offcanvas-content" style={{ position: 'relative', zIndex: 3, padding: '100px 60px 60px', height: '100%', overflowY: 'auto', opacity: showMobileMenu ? 1 : 0, transition: 'opacity 0.3s ease 0.3s' }}>
            <button onClick={() => setShowMobileMenu(false)} className="offcanvas-close-btn" style={{ position: 'absolute', top: '30px', right: '30px', width: '50px', height: '50px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: '#F5F5F5', transition: 'transform 0.4s ease' }}>✕</button>
            <nav style={{ marginBottom: '60px' }}>
              {navItems.map((item, index) => (
                <div key={item.id} className="offcanvas-menu-item" style={{ overflow: 'hidden', opacity: showMobileMenu ? 1 : 0, transition: `opacity 0.5s ease ${0.4 + index * 0.1}s` }}>
                  <button onClick={() => scrollToSection(item.sectionId, item.id)} style={{ display: 'block', width: '100%', padding: '12px 0', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '48px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, color: activeSection === item.id ? '#fa2837' : '#F5F5F5', cursor: 'pointer', transition: 'color 0.3s ease, transform 0.3s ease', transform: showMobileMenu ? 'translateY(0)' : 'translateY(-100px)', transitionDelay: `${0.5 + index * 0.1}s` }}>{item.label}</button>
                </div>
              ))}
            </nav>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
              <button onClick={() => { setShowMobileMenu(false); setShowContactModal(true); }} className="offcanvas-contact-btn" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px 12px 12px', background: '#222222', border: 'none', borderRadius: '50px', cursor: 'pointer', transition: 'background 0.2s ease, opacity 0.3s ease, transform 0.3s ease', opacity: showMobileMenu ? 1 : 0, transform: showMobileMenu ? 'translateY(0)' : 'translateY(20px)', transitionDelay: '0.8s' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {agent?.profile_image ? <img src={agent.profile_image} alt={agent.name || 'Agent'} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #333', position: 'relative', zIndex: 2 }} /> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A3A3A3', fontWeight: 600, fontSize: '14px', border: '2px solid #333', position: 'relative', zIndex: 2 }}>{agent?.name?.charAt(0) || 'A'}</div>}
                  {coListingAgents.length > 0 && (coListingAgents[0]?.profile_image ? <img src={coListingAgents[0].profile_image} alt={coListingAgents[0].name || 'Co-Agent'} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #333', marginLeft: '-12px', position: 'relative', zIndex: 1 }} /> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A3A3A3', fontWeight: 600, fontSize: '14px', border: '2px solid #333', marginLeft: '-12px', position: 'relative', zIndex: 1 }}>{coListingAgents[0]?.name?.charAt(0) || 'A'}</div>)}
                </div>
                <span style={{ fontWeight: 500, fontSize: '16px', color: '#F5F5F5' }}>{getAgentButtonText()}</span>
              </button>
              <button onClick={() => { setShowMobileMenu(false); setShowTourModal(true); }} style={{ padding: '16px 28px', background: '#fa2837', border: 'none', borderRadius: '50px', color: '#ffffff', fontSize: '16px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s ease, opacity 0.3s ease, transform 0.3s ease', opacity: showMobileMenu ? 1 : 0, transform: showMobileMenu ? 'translateY(0)' : 'translateY(20px)', transitionDelay: '0.9s' }}>Request Tour</button>
            </div>
          </div>
        </div>
        {showMobileMenu && <div onClick={() => setShowMobileMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, transition: 'opacity 0.3s ease' }} />}

        {/* Contact Modal - Dark */}
        {showContactModal && <div className="numero-modal-overlay" onClick={() => setShowContactModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000 }} />}
        <div className={`numero-contact-panel ${showContactModal ? 'panel-open' : ''}`} style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: '450px', maxHeight: '90vh', borderRadius: '20px', background: 'rgba(27, 27, 27, 0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', boxShadow: '0 20px 30px -8px rgba(0, 0, 0, 0.4)', clipPath: showContactModal ? 'circle(150% at 0% 0%)' : 'circle(0% at 0% 0%)', transition: 'clip-path 0.7s ease-in-out', zIndex: 10001, overflowY: 'auto', pointerEvents: showContactModal ? 'auto' : 'none' }}>
          <div className="numero-modal-content" style={{ padding: '30px', opacity: showContactModal ? 1 : 0, transition: 'opacity 0.3s ease 0.3s' }}>
            <button onClick={() => setShowContactModal(false)} className="contact-panel-close" style={{ position: 'absolute', top: '15px', right: '15px', width: '40px', height: '40px', background: '#333333', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#F5F5F5', transition: 'transform 0.4s ease' }}>✕</button>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '20px', color: '#F5F5F5' }}>{getAgentButtonText()}</h2>
            <form onSubmit={handleFormSubmit}>
              {coListingAgents.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#A3A3A3', marginBottom: '0.5rem' }}>Select Agent</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button type="button" onClick={() => setFormData({ ...formData, selectedAgent: 'primary' })} style={{ width: '100%', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left', border: 'none', background: formData.selectedAgent === 'primary' ? '#F5F5F5' : '#222222', color: formData.selectedAgent === 'primary' ? '#121212' : '#F5F5F5', transition: 'all 0.2s' }}>
                      {agent?.profile_image ? <img src={agent.profile_image} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: formData.selectedAgent === 'primary' ? '#333' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: formData.selectedAgent === 'primary' ? '#121212' : '#A3A3A3' }}>{agent?.name?.charAt(0)}</span></div>}
                      <div><div style={{ fontWeight: 600 }}>{agent?.name}</div><div style={{ fontSize: '0.875rem', opacity: 0.8 }}>{agent?.email}</div></div>
                    </button>
                    {coListingAgents.map((ca: any) => (
                      <button key={ca.id} type="button" onClick={() => setFormData({ ...formData, selectedAgent: ca.id })} style={{ width: '100%', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left', border: 'none', background: formData.selectedAgent === ca.id ? '#F5F5F5' : '#222222', color: formData.selectedAgent === ca.id ? '#121212' : '#F5F5F5', transition: 'all 0.2s' }}>
                        {ca.profile_image ? <img src={ca.profile_image} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: formData.selectedAgent === ca.id ? '#121212' : '#A3A3A3' }}>{ca.name?.charAt(0)}</span></div>}
                        <div><div style={{ fontWeight: 600 }}>{ca.name}</div><div style={{ fontSize: '0.875rem', opacity: 0.8 }}>{ca.email}</div></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#A3A3A3', marginBottom: '0.5rem' }}>Name</label><input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Your name" style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', background: '#222222', color: '#F5F5F5' }} /></div>
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#A3A3A3', marginBottom: '0.5rem' }}>Email</label><input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="your@email.com" style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', background: '#222222', color: '#F5F5F5' }} /></div>
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#A3A3A3', marginBottom: '0.5rem' }}>Phone</label><input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="(555) 123-4567" style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', background: '#222222', color: '#F5F5F5' }} /></div>
              <div style={{ marginBottom: '1.5rem' }}><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#A3A3A3', marginBottom: '0.5rem' }}>Message</label><textarea required value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} rows={4} placeholder="I'm interested in this property..." style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '1rem', resize: 'vertical', minHeight: '100px', boxSizing: 'border-box', background: '#222222', color: '#F5F5F5' }} /></div>
              {selectedAgentData && (
                <div style={{ padding: '1rem', borderRadius: '0.5rem', background: '#222222', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', margin: '0 0 0.5rem 0', color: '#F5F5F5' }}>{coListingAgents.length > 0 ? 'Selected Agent Contact' : 'Contact Information'}</p>
                  {selectedAgentData.email && <a href={`mailto:${selectedAgentData.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#A3A3A3', fontSize: '0.875rem', marginBottom: '0.25rem', textDecoration: 'none' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z"/></svg>{selectedAgentData.email}</a>}
                  {selectedAgentData.phone && <a href={`tel:${selectedAgentData.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#A3A3A3', fontSize: '0.875rem', textDecoration: 'none' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>{selectedAgentData.phone}</a>}
                </div>
              )}
              <button type="submit" style={{ width: '100%', padding: '1rem', background: '#F5F5F5', color: '#121212', border: 'none', borderRadius: '0.5rem', fontWeight: 500, fontSize: '1rem', cursor: 'pointer' }}>Send Message</button>
            </form>
          </div>
        </div>

        {/* Tour Modal - Dark */}
        {showTourModal && <div className="numero-modal-overlay" onClick={() => setShowTourModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000 }} />}
        <div className={`numero-tour-panel ${showTourModal ? 'panel-open' : ''}`} style={{ position: 'fixed', top: '50%', right: '50%', transform: 'translate(50%, -50%)', width: '90%', maxWidth: '450px', maxHeight: '90vh', borderRadius: '20px', background: 'rgba(27, 27, 27, 0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', boxShadow: '0 20px 30px -8px rgba(0, 0, 0, 0.4)', clipPath: showTourModal ? 'circle(150% at 100% 0%)' : 'circle(0% at 100% 0%)', transition: 'clip-path 0.7s ease-in-out', zIndex: 10001, overflowY: 'auto', pointerEvents: showTourModal ? 'auto' : 'none' }}>
          <div className="numero-modal-content" style={{ padding: '30px', opacity: showTourModal ? 1 : 0, transition: 'opacity 0.3s ease 0.3s' }}>
            <button onClick={() => setShowTourModal(false)} className="tour-panel-close" style={{ position: 'absolute', top: '15px', right: '15px', width: '40px', height: '40px', background: '#333333', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#F5F5F5', transition: 'transform 0.4s ease' }}>✕</button>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '20px', color: '#F5F5F5' }}>Schedule a Tour</h2>
            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#A3A3A3', marginBottom: '0.5rem' }}>Select Date</label>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {getDateOptions().map((d, i) => {
                    const isSelected = selectedDate?.toDateString() === d.toDateString();
                    return (
                      <button key={i} type="button" onClick={() => setSelectedDate(d)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #333', background: isSelected ? '#F5F5F5' : '#222222', color: isSelected ? '#121212' : '#F5F5F5', cursor: 'pointer', minWidth: '80px', flexShrink: 0, transition: 'all 0.2s' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{d.toLocaleString('default', { weekday: 'short' })}</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2 }}>{d.getDate()}</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{d.toLocaleString('default', { month: 'short' })}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#A3A3A3', marginBottom: '0.5rem' }}>Tour Type</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="button" onClick={() => setFormData({ ...formData, tourType: 'video' })} style={{ flex: 1, padding: '1rem', border: '1px solid #333', borderRadius: '0.5rem', background: formData.tourType === 'video' ? '#F5F5F5' : '#222222', color: formData.tourType === 'video' ? '#121212' : '#F5F5F5', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}>Video Tour</button>
                  <button type="button" onClick={() => setFormData({ ...formData, tourType: 'live' })} style={{ flex: 1, padding: '1rem', border: '1px solid #333', borderRadius: '0.5rem', background: formData.tourType === 'live' ? '#F5F5F5' : '#222222', color: formData.tourType === 'live' ? '#121212' : '#F5F5F5', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}>In-Person Tour</button>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#A3A3A3', marginBottom: '0.5rem' }}>Name</label><input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Your name" style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', background: '#222222', color: '#F5F5F5' }} /></div>
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#A3A3A3', marginBottom: '0.5rem' }}>Email</label><input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="your@email.com" style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', background: '#222222', color: '#F5F5F5' }} /></div>
              <div style={{ marginBottom: '1.5rem' }}><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#A3A3A3', marginBottom: '0.5rem' }}>Phone</label><input type="tel" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="(555) 123-4567" style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box', background: '#222222', color: '#F5F5F5' }} /></div>
              <button type="submit" style={{ width: '100%', padding: '1rem', background: '#F5F5F5', color: '#121212', border: 'none', borderRadius: '0.5rem', fontWeight: 500, fontSize: '1rem', cursor: 'pointer' }}>Request Tour</button>
            </form>
          </div>
        </div>

        {/* Hero Section - Dark */}
        <section id="property-hero" className="numero-dark-hero pt-16 pb-10 px-8">
          <div className="max-w-[1400px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-8 lg:gap-12">
              {/* Left Column - Address & Headline */}
              <div className="pt-16 lg:pt-20">
                <FadeIn delay={0.2} direction="left">
                  <div className="flex flex-wrap items-baseline gap-4 mb-6">
                    <span className="numero-hero-address px-4 py-2 text-lg lg:text-xl font-medium text-black bg-white" style={{ borderRadius: '8px' }}>{property.address?.toUpperCase()}</span>
                    <span className="numero-hero-location text-base lg:text-lg" style={{ color: COLORS.text }}>{formatLocation(neighbourhood, property).toUpperCase()}</span>
                  </div>
                </FadeIn>
                
                {/* Animated Headline with Arrow */}
                <div className="mb-6">
                  <AnimatedHeadline 
                    text={stripHtml(content?.hero_headline) || property.title || 'Luxury Living'} 
                    isDark={true}
                  />
                </div>
                
                {/* Price Badge */}
                <FadeIn delay={1.8} direction="left">
                  <span className="numero-hero-price inline-block px-5 py-3 text-xl lg:text-2xl font-medium text-black bg-white" style={{ borderRadius: '8px' }}>
                    {formatPrice(property.price)}
                  </span>
                </FadeIn>
              </div>
              
              {/* Right Column - Video & Introduction */}
              <div style={{ paddingTop: youtubeId ? '7.75rem' : '20.75rem' }}>
                {youtubeId && (
                  <FadeIn delay={0.45} direction="right">
                    <div 
                      className="cursor-pointer relative mb-6" 
                      onClick={() => setVideoLightboxOpen(true)}
                      style={{ borderRadius: '20px', overflow: 'hidden' }}
                    >
                      {videoThumbnail ? (
                        <div className="relative">
                          <img 
                            src={videoThumbnail} 
                            alt="Video" 
                            className="w-full object-cover" 
                            style={{ aspectRatio: '16/9', borderRadius: '20px' }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div 
                              className="w-20 h-20 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                              style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
                            >
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="black" style={{ marginLeft: '4px' }}>
                                <polygon points="5 3 19 12 5 21" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-center mt-3 text-sm tracking-wide font-medium" style={{ color: COLORS.textGray }}>
                            [ Play the video ]
                          </p>
                        </div>
                      ) : (
                        <iframe 
                          src={`https://www.youtube.com/embed/${youtubeId}`} 
                          className="w-full" 
                          style={{ aspectRatio: '16/9', borderRadius: '20px' }}
                          allowFullScreen 
                        />
                      )}
                    </div>
                  </FadeIn>
                )}
                
                <FadeIn delay={0.5} direction="right">
                  <p className="numero-hero-intro text-base lg:text-lg leading-[1.6] tracking-[-0.01em]" style={{ color: COLORS.text }}>
                    {stripHtml(content?.hero_introduction) || property.public_remarks?.substring(0, 300) || 'Experience unparalleled luxury living.'}
                  </p>
                </FadeIn>
              </div>
            </div>
          </div>
        </section>

        {/* Hero Image - Grows from 70% to 100% width on scroll */}
        {heroImage && (
          <section className="numero-dark-hero-image px-8" style={{ paddingTop: '60px', paddingBottom: '60px' }}>
            <div className="max-w-[1400px] mx-auto">
              <GrowHeroImage src={heroImage} alt={property.address || 'Property'} />
            </div>
          </section>
        )}

        {/* The Numbers */}
        {/* The Numbers Section - 5 items: MLS(2fr), Bed(1fr), Bath(1fr), Size(2fr), Year(2fr) on desktop */}
        <section id="the-property-numbers" className="numero-dark-numbers px-8 py-20">
          <div className="max-w-[1400px] mx-auto">
            <FadeIn delay={0.1}><p className="numero-numbers-label text-xs tracking-[0.2em] uppercase mb-2" style={{ color: COLORS.textGray }}>The Details</p></FadeIn>
            <FadeIn delay={0.2}><h2 className="numero-numbers-headline text-4xl lg:text-5xl font-medium mb-12" style={{ color: COLORS.text }}>{content?.numbers_headline || 'Numbers that matter.'}</h2></FadeIn>
            
            {/* Custom grid: MLS, Bed(half), Bath(half), Size, Year - 5 items where Bed/Bath are smaller */}
            <div className="numero-numbers-grid hidden lg:grid gap-6" style={{ gridTemplateColumns: '2fr 1fr 1fr 2fr 2fr' }}>
              <FadeIn delay={0.3}>
                <div className="numero-numbers-box p-6 rounded-2xl h-full" style={{ backgroundColor: COLORS.bgSurface }}>
                  <p className="numero-numbers-box-label text-xs tracking-[0.15em] uppercase mb-2" style={{ color: COLORS.textGray }}>{content?.numbers_box1_label || 'MLS Number'}</p>
                  <p className="numero-numbers-box-value text-2xl lg:text-3xl font-medium" style={{ color: COLORS.text }}>{content?.numbers_box1_value || property.mls_number || 'N/A'}</p>
                </div>
              </FadeIn>
              <FadeIn delay={0.4}>
                <div className="numero-numbers-box p-6 rounded-2xl h-full" style={{ backgroundColor: COLORS.bgSurface }}>
                  <p className="numero-numbers-box-label text-xs tracking-[0.15em] uppercase mb-2" style={{ color: COLORS.textGray }}>{content?.numbers_box2_label || 'Bedrooms'}</p>
                  <p className="numero-numbers-box-value text-2xl lg:text-3xl font-medium" style={{ color: COLORS.text }}>{content?.numbers_box2_value || property.bedrooms || 0}</p>
                </div>
              </FadeIn>
              <FadeIn delay={0.5}>
                <div className="numero-numbers-box p-6 rounded-2xl h-full" style={{ backgroundColor: COLORS.bgSurface }}>
                  <p className="numero-numbers-box-label text-xs tracking-[0.15em] uppercase mb-2" style={{ color: COLORS.textGray }}>Bathrooms</p>
                  <p className="numero-numbers-box-value text-2xl lg:text-3xl font-medium" style={{ color: COLORS.text }}>{(property.bathrooms_full || 0) + (property.bathrooms_half ? property.bathrooms_half * 0.5 : 0) || property.bathrooms || 0}</p>
                </div>
              </FadeIn>
              <FadeIn delay={0.6}>
                <div className="numero-numbers-box p-6 rounded-2xl h-full" style={{ backgroundColor: COLORS.bgSurface }}>
                  <p className="numero-numbers-box-label text-xs tracking-[0.15em] uppercase mb-2" style={{ color: COLORS.textGray }}>{content?.numbers_box3_label || 'Property Size'}</p>
                  <p className="numero-numbers-box-value text-2xl lg:text-3xl font-medium" style={{ color: COLORS.text }}>{content?.numbers_box3_value || `${getSqft().toLocaleString()} sqft`}</p>
                </div>
              </FadeIn>
              <FadeIn delay={0.7}>
                <div className="numero-numbers-box p-6 rounded-2xl h-full" style={{ backgroundColor: COLORS.bgSurface }}>
                  <p className="numero-numbers-box-label text-xs tracking-[0.15em] uppercase mb-2" style={{ color: COLORS.textGray }}>{content?.numbers_box4_label || 'Year Built'}</p>
                  <p className="numero-numbers-box-value text-2xl lg:text-3xl font-medium" style={{ color: COLORS.text }}>{content?.numbers_box4_value || property.year_built || 'N/A'}</p>
                </div>
              </FadeIn>
            </div>
            
            {/* Mobile/Tablet: 2 column grid */}
            <div className="numero-numbers-grid-mobile grid lg:hidden grid-cols-2 gap-4">
              <FadeIn delay={0.3}>
                <div className="numero-numbers-box p-5 rounded-2xl col-span-2" style={{ backgroundColor: COLORS.bgSurface }}>
                  <p className="numero-numbers-box-label text-xs tracking-[0.15em] uppercase mb-2" style={{ color: COLORS.textGray }}>{content?.numbers_box1_label || 'MLS Number'}</p>
                  <p className="numero-numbers-box-value text-xl font-medium" style={{ color: COLORS.text }}>{content?.numbers_box1_value || property.mls_number || 'N/A'}</p>
                </div>
              </FadeIn>
              <FadeIn delay={0.4}>
                <div className="numero-numbers-box p-5 rounded-2xl" style={{ backgroundColor: COLORS.bgSurface }}>
                  <p className="numero-numbers-box-label text-xs tracking-[0.15em] uppercase mb-2" style={{ color: COLORS.textGray }}>{content?.numbers_box2_label || 'Bedrooms'}</p>
                  <p className="numero-numbers-box-value text-xl font-medium" style={{ color: COLORS.text }}>{content?.numbers_box2_value || property.bedrooms || 0}</p>
                </div>
              </FadeIn>
              <FadeIn delay={0.5}>
                <div className="numero-numbers-box p-5 rounded-2xl" style={{ backgroundColor: COLORS.bgSurface }}>
                  <p className="numero-numbers-box-label text-xs tracking-[0.15em] uppercase mb-2" style={{ color: COLORS.textGray }}>Bathrooms</p>
                  <p className="numero-numbers-box-value text-xl font-medium" style={{ color: COLORS.text }}>{(property.bathrooms_full || 0) + (property.bathrooms_half ? property.bathrooms_half * 0.5 : 0) || property.bathrooms || 0}</p>
                </div>
              </FadeIn>
              <FadeIn delay={0.6}>
                <div className="numero-numbers-box p-5 rounded-2xl" style={{ backgroundColor: COLORS.bgSurface }}>
                  <p className="numero-numbers-box-label text-xs tracking-[0.15em] uppercase mb-2" style={{ color: COLORS.textGray }}>{content?.numbers_box3_label || 'Property Size'}</p>
                  <p className="numero-numbers-box-value text-xl font-medium" style={{ color: COLORS.text }}>{content?.numbers_box3_value || `${getSqft().toLocaleString()} sqft`}</p>
                </div>
              </FadeIn>
              <FadeIn delay={0.7}>
                <div className="numero-numbers-box p-5 rounded-2xl" style={{ backgroundColor: COLORS.bgSurface }}>
                  <p className="numero-numbers-box-label text-xs tracking-[0.15em] uppercase mb-2" style={{ color: COLORS.textGray }}>{content?.numbers_box4_label || 'Year Built'}</p>
                  <p className="numero-numbers-box-value text-xl font-medium" style={{ color: COLORS.text }}>{content?.numbers_box4_value || property.year_built || 'N/A'}</p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* The Story */}
        <section className="numero-dark-story px-8 py-20">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
            <FadeIn delay={0.2}><div className="numero-section-number text-[140px] lg:text-[180px] font-bold leading-none" style={{ color: COLORS.text }}>{sectionNums.story}</div></FadeIn>
            <div>
              <FadeIn delay={0.3}><p className="numero-section-label text-xs tracking-[0.2em] uppercase mb-4" style={{ color: COLORS.textGray }}>The Story</p></FadeIn>
              <FadeIn delay={0.4}><h2 className="numero-property-headline text-3xl lg:text-4xl font-medium leading-tight mb-4" style={{ color: COLORS.text }}>{stripHtml(content?.property_headline) || property.title || 'Welcome Home'}</h2></FadeIn>
              {content?.property_subheadline && (<FadeIn delay={0.45}><h3 className="numero-property-subheadline text-xl lg:text-2xl font-normal mb-6" style={{ color: COLORS.textGray }}>{stripHtml(content.property_subheadline)}</h3></FadeIn>)}
              <FadeIn delay={0.5}>
                <div 
                  className="numero-property-description prose prose-lg max-w-none text-base lg:text-lg leading-relaxed [&_p]:text-[#cccccc] [&_span]:text-[#cccccc] [&_div]:text-[#cccccc] [&_p]:mb-5 [&_p:last-child]:mb-0" 
                  style={{ color: '#cccccc' }}
                  dangerouslySetInnerHTML={{ __html: content?.property_description || property.public_remarks || property.description || 'A remarkable property featuring exceptional design and premium finishes throughout.' }} 
                />
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Gallery - Masonry Layout */}
        {images.length > 0 && (
          <section id="property-gallery" className="numero-dark-gallery px-8 py-20">
            <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
              <FadeIn delay={0.2}><div className="numero-section-number text-[140px] lg:text-[180px] font-bold leading-none" style={{ color: COLORS.text }}>{sectionNums.gallery}</div></FadeIn>
              <div>
                <FadeIn delay={0.3}><p className="numero-section-label text-xs tracking-[0.2em] uppercase mb-4" style={{ color: COLORS.textGray }}>Photo Gallery</p><h2 className="numero-gallery-headline text-3xl lg:text-4xl font-medium mb-8" style={{ color: COLORS.text }}>Explore every stunning detail</h2></FadeIn>
                <FadeIn delay={0.4}>
                  <MasonryGallery images={images} onImageClick={(idx) => openLightbox(images, idx)} isDark={true} />
                </FadeIn>
              </div>
            </div>
          </section>
        )}

        {/* Virtual Tour */}
        {property.virtual_tour_url && (
          <section id="virtual-tour-section" className="numero-dark-virtual-tour px-8 py-20">
            <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
              <FadeIn delay={0.2}><div className="numero-section-number text-[140px] lg:text-[180px] font-bold leading-none" style={{ color: COLORS.text }}>{sectionNums.virtualTour}</div></FadeIn>
              <div>
                <FadeIn delay={0.3}><p className="numero-section-label text-xs tracking-[0.2em] uppercase mb-4" style={{ color: COLORS.textGray }}>Virtual Tour</p><h2 className="numero-virtual-tour-headline text-3xl lg:text-4xl font-medium mb-8" style={{ color: COLORS.text }}>Step inside</h2></FadeIn>
                <FadeIn delay={0.4}><div className="numero-virtual-tour-container aspect-video rounded-lg overflow-hidden" style={{ backgroundColor: COLORS.bgSurface }}><iframe src={property.virtual_tour_url} className="w-full h-full" allowFullScreen title="Virtual Tour" /></div></FadeIn>
              </div>
            </div>
          </section>
        )}

        {/* Features & Amenities - redox style: 3-column grid per row (number | category | features) */}
        {(Array.isArray(property.appliances) && property.appliances.length > 0) || (Array.isArray(property.exterior_features) && property.exterior_features.length > 0) || (Array.isArray(property.interior_features) && property.interior_features.length > 0) || (Array.isArray(property.community_features) && property.community_features.length > 0) ? (
          <section id="property-features" className="numero-dark-features px-8 py-20">
            <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
              <FadeIn delay={0.2}><div className="numero-section-number text-[140px] lg:text-[180px] font-bold leading-none" style={{ color: COLORS.text }}>{sectionNums.features}</div></FadeIn>
              <div>
                <FadeIn delay={0.3}><p className="numero-section-label text-xs tracking-[0.2em] uppercase mb-4" style={{ color: COLORS.textGray }}>Features & Amenities</p><h2 className="numero-features-headline text-3xl lg:text-4xl font-medium mb-12" style={{ color: COLORS.text }}>{content?.features_description || 'Discover what makes this property special with a comprehensive list of features and amenities.'}</h2></FadeIn>
                <div className="numero-features-list space-y-10">
                  {(() => {
                    const categories: { title: string; items: string[] }[] = [];
                    if (Array.isArray(property.appliances) && property.appliances.length > 0) {
                      categories.push({ title: 'Appliances & Amenities', items: property.appliances });
                    }
                    if (Array.isArray(property.exterior_features) && property.exterior_features.length > 0) {
                      categories.push({ title: 'Exterior Features', items: property.exterior_features });
                    }
                    if (Array.isArray(property.interior_features) && property.interior_features.length > 0) {
                      categories.push({ title: 'Interior Features', items: property.interior_features });
                    }
                    if (Array.isArray(property.community_features) && property.community_features.length > 0) {
                      categories.push({ title: 'Community Features', items: property.community_features });
                    }
                    return categories.map((cat, idx) => (
                      <FadeIn key={idx} delay={0.4 + idx * 0.1}>
                        <div className="numero-feature-row grid grid-cols-[60px_200px_1fr] gap-6 items-start" style={{ borderBottom: `1px solid ${COLORS.border}`, paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                          <span className="numero-feature-number text-lg font-normal" style={{ color: COLORS.textGray }}>{(idx + 1).toString().padStart(2, '0')}</span>
                          <h3 className="numero-feature-category text-2xl font-normal" style={{ color: COLORS.text, letterSpacing: '-0.02em' }}>{cat.title}</h3>
                          <p className="numero-feature-items text-base leading-relaxed" style={{ color: COLORS.textGray }}>{cat.items.map((item: string) => String(item).replace(/_/g, ' ')).join(', ')}</p>
                        </div>
                      </FadeIn>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* Room Dimensions */}
        {property.room_dimensions && (() => {
          try {
            const rooms = typeof property.room_dimensions === 'string' ? JSON.parse(property.room_dimensions) : property.room_dimensions;
            if (Array.isArray(rooms) && rooms.length > 0) {
              const floorPlanUrl = property.floor_plan_url || property.url_floorplan || property.floorplan_url;
              return (
                <section className="numero-dark-room-dimensions px-8 py-20">
                  <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
                    <FadeIn delay={0.2}><div className="numero-section-number text-[140px] lg:text-[180px] font-bold leading-none" style={{ color: COLORS.text }}>{sectionNums.roomDimensions}</div></FadeIn>
                    <div>
                      <FadeIn delay={0.3}><p className="numero-section-label text-xs tracking-[0.2em] uppercase mb-4" style={{ color: COLORS.textGray }}>Room Dimensions</p><h2 className="numero-room-dimensions-headline text-3xl lg:text-4xl font-medium mb-8" style={{ color: COLORS.text }}>{content?.room_dimensions_description || 'Explore the spacious layout and precise room sizes throughout this exceptional property.'}</h2></FadeIn>
                      <FadeIn delay={0.4}>
                        <div className="numero-room-dimensions-table overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="numero-room-dimensions-header" style={{ backgroundColor: '#252525' }}>
                                <th className="numero-room-dimensions-th py-4 px-6 text-xs tracking-[0.15em] uppercase font-semibold" style={{ color: '#fff' }}>Level</th>
                                <th className="numero-room-dimensions-th py-4 px-6 text-xs tracking-[0.15em] uppercase font-semibold" style={{ color: '#fff' }}>Room</th>
                                <th className="numero-room-dimensions-th py-4 px-6 text-xs tracking-[0.15em] uppercase font-semibold text-right" style={{ color: '#fff' }}>Dimensions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rooms.filter((r: any) => (r.dimensions || r.RoomDimensions)?.trim()).map((r: any, i: number) => (
                                <tr key={i} className="numero-room-dimensions-row" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                                  <td className="numero-room-dimensions-level py-4 px-6" style={{ color: COLORS.textGray }}>{r.level || r.RoomLevel || 'Main'}</td>
                                  <td className="numero-room-dimensions-room py-4 px-6" style={{ color: COLORS.text }}>{r.type || r.RoomType || r.room_type || '-'}</td>
                                  <td className="numero-room-dimensions-size py-4 px-6 text-right font-mono text-sm" style={{ color: COLORS.text }}>{r.dimensions || r.RoomDimensions || ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Floor Plan CTA */}
                        {floorPlanUrl && (
                          <FloorPlanCTADark url={floorPlanUrl} />
                        )}
                      </FadeIn>
                    </div>
                  </div>
                </section>
              );
            }
          } catch (e) {}
          return null;
        })()}

        {/* Neighbourhood Sections */}
        {neighbourhood && config && (
          <>
            {/* Neighbourhood Hero Banner - Full Width */}
            {config.heroBanner && (
              <section 
                id="neighbourhood-section" 
                className="numero-dark-neighbourhood-hero relative w-full"
                style={{
                  backgroundImage: config.heroBanner.heroImage ? `url(${config.heroBanner.heroImage})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center center',
                  minHeight: '600px',
                }}
              >
                {/* Dark overlay */}
                {config.heroBanner.heroImage && (
                  <div 
                    className="absolute inset-0"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', zIndex: 1 }}
                  />
                )}
                
                {/* Content */}
                <div className="relative z-10 max-w-[1400px] mx-auto px-8 py-20 flex flex-col justify-end" style={{ minHeight: '600px' }}>
                  <FadeIn delay={0.2}>
                    <p className="numero-neighbourhood-hero-label text-sm tracking-[0.2em] uppercase mb-6 text-white/90">
                      Know The Neighbourhood
                    </p>
                  </FadeIn>
                  <FadeIn delay={0.3}>
                    <h2 className="numero-neighbourhood-hero-headline text-5xl lg:text-7xl font-bold text-white mb-4">
                      {config.heroBanner.headline}
                    </h2>
                  </FadeIn>
                  {config.heroBanner.subHeadline && (
                    <FadeIn delay={0.4}>
                      <h4 className="numero-neighbourhood-hero-subheadline text-xl lg:text-2xl text-white/80 mb-8">
                        {config.heroBanner.subHeadline}
                      </h4>
                    </FadeIn>
                  )}
                  {config.heroBanner.shortIntro && (
                    <FadeIn delay={0.5}>
                      <p className="numero-neighbourhood-hero-intro text-base lg:text-lg text-white/90 max-w-2xl mb-8">
                        {config.heroBanner.shortIntro}
                      </p>
                    </FadeIn>
                  )}
                  {/* Explore Button - rr-btn-group style */}
                  <FadeIn delay={0.6}>
                    <ExploreButtonDark />
                  </FadeIn>
                </div>
              </section>
            )}

            {/* Neighbourhood Introduction Section - 06 on left, content on right */}
            {config.neighbourhoodIntro && (
              <section id="neighbourhood-intro" className="numero-dark-neighbourhood-intro px-8 py-20">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
                  {/* Section Number - Left Column */}
                  <FadeIn delay={0.2}>
                    <div className="numero-section-number text-[140px] lg:text-[180px] font-bold leading-none" style={{ color: COLORS.text }}>{sectionNums.neighbourhood}</div>
                  </FadeIn>
                  {/* Content - Right Column */}
                  <div>
                    <FadeIn delay={0.3}>
                      <p className="numero-section-label text-xs tracking-[0.2em] uppercase mb-4" style={{ color: COLORS.textGray }}>The Neighbourhood</p>
                    </FadeIn>
                    <FadeIn delay={0.4}>
                      <h2 className="numero-neighbourhood-intro-headline text-3xl lg:text-4xl font-medium leading-tight mb-6" style={{ color: COLORS.text }} dangerouslySetInnerHTML={{ __html: config.neighbourhoodIntro.headline || '' }} />
                    </FadeIn>
                    {config.neighbourhoodIntro.subHeadline && (
                      <FadeIn delay={0.5}>
                        <h3 className="numero-neighbourhood-intro-subheadline text-xl font-medium mb-6" style={{ color: COLORS.textGray }} dangerouslySetInnerHTML={{ __html: config.neighbourhoodIntro.subHeadline }} />
                      </FadeIn>
                    )}
                    {config.neighbourhoodIntro.textParagraph && (
                      <FadeIn delay={0.6}>
                        <div className="numero-neighbourhood-intro-text text-base leading-relaxed" style={{ color: COLORS.text }} dangerouslySetInnerHTML={{ __html: config.neighbourhoodIntro.textParagraph }} />
                      </FadeIn>
                    )}
                  </div>
                </div>
              </section>
            )}

            {config.onTheMap && BACKEND_URL && (
              <section id="neighbourhood-map-section" className="numero-dark-map px-8 py-20">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
                  <FadeIn delay={0.2}><div className="numero-section-number text-[140px] lg:text-[180px] font-bold leading-none" style={{ color: COLORS.text }}>{sectionNums.map}</div></FadeIn>
                  <div>
                    <FadeIn delay={0.3}><p className="numero-section-label text-xs tracking-[0.2em] uppercase mb-4" style={{ color: COLORS.textGray }}>On The Map</p><h2 className="numero-map-headline text-3xl lg:text-4xl font-medium mb-8" style={{ color: COLORS.text }}>{config.onTheMap.headline || "What's Nearby"}</h2></FadeIn>
                    <FadeIn delay={0.4}><div className="numero-map-container rounded-2xl overflow-hidden" style={{ height: '600px', backgroundColor: COLORS.bgSurface }}><iframe src={`${BACKEND_URL}/embed?id=${neighbourhood.id}&hideNav=true&theme=dark`} className="w-full h-full" title="Map" style={{ border: 'none' }} /></div></FadeIn>
                  </div>
                </div>
              </section>
            )}

            {config.outside && (
              <section className="numero-dark-get-outside px-8 py-20">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
                  <FadeIn delay={0.2}><div className="numero-section-number text-[140px] lg:text-[180px] font-bold leading-none" style={{ color: COLORS.text }}>{sectionNums.outside}</div></FadeIn>
                  <div>
                    <FadeIn delay={0.3}><p className="numero-section-label text-xs tracking-[0.2em] uppercase mb-4" style={{ color: COLORS.textGray }}>Get Outside</p><h2 className="numero-outside-headline text-3xl lg:text-4xl font-medium mb-4" style={{ color: COLORS.text }}>{config.outside.headline}</h2>{config.outside.subHeadline && <h3 className="numero-outside-subheadline text-lg mb-6" style={{ color: COLORS.textGray }}>{config.outside.subHeadline}</h3>}</FadeIn>
                    <FadeIn delay={0.4}><p className="numero-outside-text text-base leading-relaxed mb-8" style={{ color: COLORS.text }}>{config.outside.textParagraph}</p></FadeIn>
                    {config.outside.images?.length > 0 && (
                      <FadeIn delay={0.5}>
                        <MasonryGallery 
                          images={config.outside.images.map((img: any) => typeof img === 'string' ? img : img.url)} 
                          onImageClick={(idx) => openLightbox(config.outside.images.map((img: any) => typeof img === 'string' ? img : img.url), idx)}
                          showMoreText="Show more outdoor photos"
                        />
                      </FadeIn>
                    )}
                  </div>
                </div>
              </section>
            )}

            {config.amenities && (
              <section className="numero-dark-amenities px-8 py-20">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
                  <FadeIn delay={0.2}><div className="numero-section-number text-[140px] lg:text-[180px] font-bold leading-none" style={{ color: COLORS.text }}>{sectionNums.amenities}</div></FadeIn>
                  <div>
                    <FadeIn delay={0.3}><p className="numero-section-label text-xs tracking-[0.2em] uppercase mb-4" style={{ color: COLORS.textGray }}>Amenities</p><h2 className="numero-amenities-headline text-3xl lg:text-4xl font-medium mb-4" style={{ color: COLORS.text }}>{config.amenities.headline}</h2>{config.amenities.subHeadline && <h3 className="numero-amenities-subheadline text-lg mb-6" style={{ color: COLORS.textGray }}>{config.amenities.subHeadline}</h3>}</FadeIn>
                    <FadeIn delay={0.4}><p className="numero-amenities-text text-base leading-relaxed mb-8" style={{ color: COLORS.text }}>{config.amenities.textParagraph}</p></FadeIn>
                    {config.amenities.images?.length > 0 && (
                      <FadeIn delay={0.5}>
                        <MasonryGallery 
                          images={config.amenities.images.map((img: any) => typeof img === 'string' ? img : img.url)} 
                          onImageClick={(idx) => openLightbox(config.amenities.images.map((img: any) => typeof img === 'string' ? img : img.url), idx)}
                          showMoreText="Show more amenity photos"
                        />
                      </FadeIn>
                    )}
                  </div>
                </div>
              </section>
            )}

            {config.shopDine && (
              <section className="numero-dark-shop-dine px-8 py-20">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
                  <FadeIn delay={0.2}><div className="numero-section-number text-[140px] lg:text-[180px] font-bold leading-none" style={{ color: COLORS.text }}>{sectionNums.shopDine}</div></FadeIn>
                  <div>
                    <FadeIn delay={0.3}><p className="numero-section-label text-xs tracking-[0.2em] uppercase mb-4" style={{ color: COLORS.textGray }}>Shop & Dine</p><h2 className="numero-shop-dine-headline text-3xl lg:text-4xl font-medium mb-4" style={{ color: COLORS.text }}>{config.shopDine.headline}</h2>{config.shopDine.subHeadline && <h3 className="numero-shop-dine-subheadline text-lg mb-6" style={{ color: COLORS.textGray }}>{config.shopDine.subHeadline}</h3>}</FadeIn>
                    <FadeIn delay={0.4}><p className="numero-shop-dine-text text-base leading-relaxed mb-8" style={{ color: COLORS.text }}>{config.shopDine.textParagraph}</p></FadeIn>
                    {config.shopDine.images?.length > 0 && (
                      <FadeIn delay={0.5}>
                        <MasonryGallery 
                          images={config.shopDine.images.map((img: any) => typeof img === 'string' ? img : img.url)} 
                          onImageClick={(idx) => openLightbox(config.shopDine.images.map((img: any) => typeof img === 'string' ? img : img.url), idx)}
                          showMoreText="Show more shop & dine photos"
                        />
                      </FadeIn>
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="numero-dark-footer px-8 pt-20 pb-8">
          <div className="max-w-[1400px] mx-auto text-center"><p className="text-sm" style={{ color: COLORS.textGray }}>© {new Date().getFullYear()} In The Hood. All rights reserved.</p></div>
        </footer>

        {/* Lightboxes */}
        {lightboxOpen && <ImageLightbox images={lightboxImages} index={lightboxIndex} setIndex={setLightboxIndex} onClose={() => setLightboxOpen(false)} />}
        {videoLightboxOpen && youtubeId && <VideoLightbox youtubeId={youtubeId} isOpen={videoLightboxOpen} onClose={() => setVideoLightboxOpen(false)} />}
      </div>
    </>
  );
}
