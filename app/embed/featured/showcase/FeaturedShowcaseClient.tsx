'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface Property {
  id: string; mls_number: string; address: string; city: string; province?: string;
  price: number; bedrooms: number; bathrooms: number; square_feet?: number;
  images: string[]; main_thumbnail: string; property_subtype?: string;
  listing_status?: string; listing_type?: string; agent_name?: string;
  agent_profile_image_url?: string; co_listing_agent_profiles?: any[];
  selected_template?: string; subdivision_name?: string;
  presentation_settings?: { theme?: string };
  creative_video_thumbnail?: string;  // Custom AI thumbnail
  creative_hero_image?: string;       // Custom AI banner
  property_type?: string;
  property_sub_type?: string;
  lot_size?: number;
  lot_size_acres?: number;
}

// Smart meta: detect property type and return appropriate metadata items
function getSmartMeta(property: Property): { label: string; value: string }[] {
  const propType = (property.property_type || '').toLowerCase();
  const propSubtype = (property.property_sub_type || property.property_subtype || '').toLowerCase();
  const isLand = propType === 'land' || propSubtype.includes('land') || propSubtype.includes('farm') || propSubtype.includes('vacant') || propSubtype.includes('acreage');
  const isCommercial = propType === 'commercial' || propSubtype.includes('commercial') || propSubtype.includes('business') || propSubtype.includes('retail') || propSubtype.includes('office') || propSubtype.includes('industrial');

  if (isLand) {
    const meta: { label: string; value: string }[] = [];
    if (property.lot_size_acres && property.lot_size_acres > 0) {
      meta.push({ label: 'Acres', value: parseFloat(String(property.lot_size_acres)).toFixed(2) });
    }
    if (property.lot_size && property.lot_size > 0) {
      meta.push({ label: 'Lot Sqft', value: Math.round(property.lot_size).toLocaleString() });
    }
    if (property.square_feet && property.square_feet > 0) {
      meta.push({ label: 'Sqft', value: property.square_feet.toLocaleString() });
    }
    return meta.length > 0 ? meta : [{ label: 'Land', value: propSubtype || 'Vacant Land' }];
  }

  if (isCommercial) {
    const meta: { label: string; value: string }[] = [];
    if (property.square_feet && property.square_feet > 0) {
      meta.push({ label: 'Sqft', value: property.square_feet.toLocaleString() });
    }
    if (property.lot_size && property.lot_size > 0) {
      meta.push({ label: 'Lot Sqft', value: Math.round(property.lot_size).toLocaleString() });
    }
    if (property.lot_size_acres && property.lot_size_acres > 0) {
      meta.push({ label: 'Acres', value: parseFloat(String(property.lot_size_acres)).toFixed(2) });
    }
    return meta.length > 0 ? meta : [{ label: 'Type', value: propSubtype || 'Commercial' }];
  }

  // Residential default: beds, baths, sqft
  const meta: { label: string; value: string }[] = [];
  if (property.bedrooms > 0) meta.push({ label: 'Beds', value: String(property.bedrooms) });
  if (property.bathrooms > 0) meta.push({ label: 'Baths', value: String(property.bathrooms) });
  if (property.square_feet && property.square_feet > 0) meta.push({ label: 'Sqft', value: property.square_feet.toLocaleString() });
  return meta;
}

interface RowConfig {
  aspectRatio: string;
  itemsPerRow: number;
  maxItems: number;
  title: string;
  hoverView?: 'shuffle' | 'slide';  // shuffle = pop-up effect, slide = horizontal expand
  hoverAspectRatio?: string;  // aspect ratio to transition to on hover
  bleedDesktop?: number;
  bleedLaptop?: number;
  bleedTablet?: number;
  bleedMobile?: number;
  laptopItems?: number;
  tabletItems?: number;
  mobileItems?: number;
}

const FALLBACK_BACKEND = 'https://api-production-531c.up.railway.app';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const NEXTJS_TEMPLATE_URL = 'https://in-the-hood-io-5dmw.vercel.app';

function formatFullPrice(price: number): string {
  if (!price) return '$0';
  return `$${price.toLocaleString()}`;
}

function generateSlug(p: Property): string {
  const parts = [p.mls_number, p.address, p.city, p.province || 'Alberta'];
  if (p.subdivision_name && p.subdivision_name.toUpperCase() !== 'NONE') parts.push(p.subdivision_name);
  return parts.filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

function getPropertyUrl(property: Property, agentId?: string | null): string {
  const slug = generateSlug(property);
  const agentParam = agentId ? `?agentId=${agentId}` : '';
  return `${NEXTJS_TEMPLATE_URL}/featured-property/${slug}${agentParam}`;
}

// Aspect ratio string to paddingBottom %
function getAspectPadding(ratio: string): number {
  switch (ratio) {
    case '2:3': return 150;
    case '9:16': return 177.78;
    case '16:9': return 56.25;
    case '4:3': return 75;
    case '1:1': return 100;
    default: return 150;
  }
}

export default function FeaturedShowcaseClient() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || '';
  const userIds = searchParams.get('userIds') || '';
  const theme = searchParams.get('theme') || 'dark';
  const showTitle = searchParams.get('showTitle') !== 'false';
  const title = searchParams.get('title') || 'Featured Listings';
  const subtitle = searchParams.get('subtitle') || '';
  const bleed = searchParams.get('bleed') || '5';  // right-side bleed percentage
  const heroCard = searchParams.get('heroCard') === 'true';
  const openInNewWindow = searchParams.get('openInNewWindow') !== 'false';
  const maxItems = parseInt(searchParams.get('maxItems') || '30');
  const showStatusBadges = searchParams.get('showStatusBadges') === 'true';
  const useTypography = searchParams.get('useTypography') === 'true';
  const assignedAgentId = searchParams.get('agentId');
  
  // Showcase styling controls
  const cardGap = parseInt(searchParams.get('cardGap') || '8');
  const shuffleScale = parseFloat(searchParams.get('shuffleScale') || '1.35');
  const gradientOpacity = parseFloat(searchParams.get('gradientOpacity') || '0.7');

  // Slide-specific styling controls
  const slideGradientMode = searchParams.get('slideGradientMode') || 'gradient';
  let slideGradientVal = { c1: '#000000', c2: '#000000', o1: 80, o2: 0, l1: 0, l2: 100, angle: 0 };
  try { slideGradientVal = JSON.parse(searchParams.get('slideGradientValue') || '{}'); } catch {}
  const slideSolidColor = searchParams.get('slideSolidColor') || '#000000';
  const slideSolidOpacity = parseInt(searchParams.get('slideSolidOpacity') || '70');
  const slideTextPosition = searchParams.get('slideTextPosition') || 'bottom-left';
  const slideButtonColor = searchParams.get('slideButtonColor') || '#ffffff';
  const slideButtonTextColor = searchParams.get('slideButtonTextColor') || '#000000';
  const slideButtonRadius = searchParams.get('slideButtonRadius') || '4';
  const slideButtonFont = searchParams.get('slideButtonFont') || '';
  const slideButtonFontWeight = searchParams.get('slideButtonFontWeight') || '700';
  const slideButtonLetterSpacing = searchParams.get('slideButtonLetterSpacing') || '0';
  const slideButtonPaddingX = searchParams.get('slideButtonPaddingX') || '16';
  const slideButtonPaddingY = searchParams.get('slideButtonPaddingY') || '6';
  const slideButtonFontSize = searchParams.get('slideButtonFontSize') || '11';
  const slideFontColor = searchParams.get('slideFontColor') || '#ffffff';
  const slidePriceFontSize = searchParams.get('slidePriceFontSize') || '14';
  const slideHoverGradientDirection = searchParams.get('slideHoverGradientDirection') || 'to right';
  
  // Thumbnail source — standard MLS or Studio poster overlays
  const thumbnailSource = searchParams.get('thumbnailSource') || 'standard';
  const listingStatusFilter = searchParams.get('listingStatus') || 'active,pending';
  const sortOrderParam = searchParams.get('sortOrder') || 'date-desc';
  const pinnedListingsParam = searchParams.get('pinnedListings') || '';
  const selectedListingsParam = searchParams.get('selectedListings') || '';

  const fonts = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('fonts') || '{}')); } catch { return {}; } })();
  const badgeColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('badgeColors') || '{}')); } catch { return {}; } })();

  // Per-row configs
  const rowConfigs: RowConfig[] = (() => {
    try {
      const raw = searchParams.get('rowConfigs');
      if (raw) {
        const parsed = JSON.parse(decodeURIComponent(raw));
        // Ensure each row has hoverView and hoverAspectRatio with defaults
        return parsed.map((rc: any) => ({
          ...rc,
          hoverView: rc.hoverView || 'shuffle',
          hoverAspectRatio: rc.hoverAspectRatio || '16:9'
        }));
      }
    } catch {}
    const rows = parseInt(searchParams.get('rows') || '1');
    const itemsPerRow = parseInt(searchParams.get('itemsPerRow') || '6');
    const aspectRatio = searchParams.get('aspectRatio') || '2:3';
    const configs: RowConfig[] = [];
    for (let i = 0; i < rows; i++) {
      configs.push({ aspectRatio, itemsPerRow, maxItems: itemsPerRow * 2, title: '', hoverView: 'shuffle', hoverAspectRatio: '16:9' });
    }
    return configs;
  })();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isLaptop, setIsLaptop] = useState(false);
  const [rowHeights, setRowHeights] = useState<number[]>([]); // Store fixed heights for each row
  const [scrollOffsets, setScrollOffsets] = useState<number[]>([]); // translateX offset per row
  const scrollRefs = useRef<(HTMLDivElement | null)[]>([]); // refs to the inner flex track
  const clipRefs = useRef<(HTMLDivElement | null)[]>([]); // refs to the clip wrapper (visible width)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map()); // Store refs to measure card heights
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0a0a0a' : '#fafafa';
  const textColor = isDark ? '#ffffff' : '#1a1a2e';
  const mutedColor = isDark ? '#a1a1aa' : '#6b7280';
  const cardBg = isDark ? '#181818' : '#ffffff';
  const borderCol = isDark ? '#333' : '#e5e7eb';

  const priceStyle = useTypography && fonts.priceFont ? {
    fontFamily: `'${fonts.priceFont}', sans-serif`, fontWeight: fonts.priceFontWeight || '600',
    fontSize: `${fonts.priceFontSize || '16'}px`, color: fonts.priceColor || '#ffffff',
  } : {};
  const addressStyleTypo = useTypography && fonts.addressFont ? {
    fontFamily: `'${fonts.addressFont}', sans-serif`, fontWeight: fonts.addressFontWeight || '400',
    fontSize: `${fonts.addressFontSize || '13'}px`, color: fonts.addressColor || 'rgba(255,255,255,0.8)',
  } : {};

  useEffect(() => { loadProperties(); }, [userId, userIds]);

  // Mobile/tablet/laptop detection — uses clientWidth to exclude scrollbar
  useEffect(() => {
    const check = () => {
      const w = document.documentElement.clientWidth || window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1024);
      setIsLaptop(w >= 1024 && w < 1440);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // On mobile/tablet: tap outside any card to close expanded state
  useEffect(() => {
    if (!isMobile && !isTablet && !isLaptop) return;
    const handleTouchOutside = () => setHoveredId(null);
    document.addEventListener('touchstart', handleTouchOutside, { passive: true });
    return () => document.removeEventListener('touchstart', handleTouchOutside);
  }, [isMobile, isTablet]);


  const loadProperties = async () => {
    setLoading(true);
    try {
      let backendUrl = FALLBACK_BACKEND;
      try {
        const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/global_settings?select=api_config&limit=1`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
          cache: 'no-store'
        });
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          if (data?.[0]?.api_config?.current_backend_url) backendUrl = data[0].api_config.current_backend_url.replace(/\/$/, '');
        }
      } catch {}

      const allUserIds = userIds || userId;
      const res = await fetch(`${backendUrl}/api/featured-properties?user_ids=${allUserIds}&listing_status=${listingStatusFilter}&sort_order=${sortOrderParam}${pinnedListingsParam ? `&pinned_listings=${pinnedListingsParam}` : ''}${selectedListingsParam ? `&selected_listings=${selectedListingsParam}` : ''}`);
      const data = await res.json();
      const propsData = data.properties || data || [];

      const mapped: Property[] = propsData.slice(0, maxItems).map((p: any) => ({
        id: p.id, mls_number: p.mls_number, address: p.address, city: p.city,
        province: p.province || 'AB',
        price: p.listing_type === 'rent' ? p.rent_price : p.price,
        bedrooms: p.bedrooms || 0, bathrooms: p.bathrooms || 0,
        square_feet: p.square_feet || p.sqft || 0,
        images: p.images || [], main_thumbnail: p.main_thumbnail,
        creative_video_thumbnail: p.creative_video_thumbnail || null,
        creative_hero_image: p.creative_hero_image || null,
        property_subtype: p.property_subtype || 'House',
        property_type: p.property_type || '',
        property_sub_type: p.property_sub_type || p.property_subtype || '',
        lot_size: p.lot_size || p.lot_size_sqft || 0,
        lot_size_acres: p.lot_size_acres || 0,
        listing_status: p.listing_status || 'active',
        listing_type: p.listing_type || 'sale',
        agent_name: p.agent_name || 'Agent',
        agent_profile_image_url: p.agent_profile_image_url,
        co_listing_agent_profiles: p.co_listing_agent_profiles || [],
        selected_template: p.selected_template,
        subdivision_name: p.subdivision_name,
        presentation_settings: p.presentation_settings,
      }));
      setProperties(mapped);
    } catch (error) { console.error('Failed to load properties:', error); }
    finally { setLoading(false); }
  };

  const preHoverOffsets = useRef<number[]>([]);

  const handleMouseEnter = useCallback((id: string, rowIdx?: number) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      // Save scroll offset BEFORE expanding so we can restore on leave
      if (rowIdx !== undefined) {
        preHoverOffsets.current[rowIdx] = scrollOffsets[rowIdx] || 0;
      }
      setHoveredId(id);
      // Prime Video-style auto-scroll: keep expanded card FULLY in view
      if (rowIdx !== undefined) {
        const cardEl = cardRefs.current.get(`${rowIdx}-${id}`);
        const clipEl = clipRefs.current[rowIdx];
        const trackEl = scrollRefs.current[rowIdx];
        if (cardEl && clipEl && trackEl) {
          const clipRect = clipEl.getBoundingClientRect();
          const cardRect = cardEl.getBoundingClientRect();
          const cardWidth = cardRect.width;
          const currentOffset = scrollOffsets[rowIdx] || 0;
          const visibleWidth = clipRect.width;
          
          const rc = rowConfigs[rowIdx];
          const hoverView = rc?.hoverView || 'shuffle';
          
          if (hoverView === 'slide') {
            const aspectMap: Record<string, number> = {
              '2:3': 150, '3:4': 133.33, '1:1': 100, '4:3': 75, '16:9': 56.25, '9:16': 177.78, '3:2': 66.67,
            };
            const defaultPad = aspectMap[rc?.aspectRatio || '2:3'] || 150;
            const hoverPad = aspectMap[rc?.hoverAspectRatio || '16:9'] || 56.25;
            const realExpansionFactor = (defaultPad / 100) / (hoverPad / 100);
            const expandedWidth = cardWidth * realExpansionFactor;
            
            const cardLeftInClip = cardRect.left - clipRect.left;
            const cardRightInClip = cardLeftInClip + expandedWidth;
            const peekMargin = 20;
            
            if (cardRightInClip > visibleWidth - peekMargin) {
              const overshoot = cardRightInClip - visibleWidth + peekMargin;
              const maxOffset = Math.max(0, trackEl.scrollWidth + (expandedWidth - cardWidth) - visibleWidth);
              setScrollOffsets(prev => {
                const newOffsets = [...prev];
                newOffsets[rowIdx] = Math.min(maxOffset, currentOffset + overshoot);
                return newOffsets;
              });
            } else if (cardLeftInClip < peekMargin) {
              const overshoot = peekMargin - cardLeftInClip;
              setScrollOffsets(prev => {
                const newOffsets = [...prev];
                newOffsets[rowIdx] = Math.max(0, currentOffset - overshoot);
                return newOffsets;
              });
            }
          } else {
            const scaledWidth = cardWidth * shuffleScale;
            const cardLeftInClip = cardRect.left - clipRect.left;
            const cardRightInClip = cardLeftInClip + scaledWidth;
            
            if (cardRightInClip > visibleWidth - 10) {
              const overshoot = cardRightInClip - visibleWidth + 20;
              const maxOffset = Math.max(0, trackEl.scrollWidth - visibleWidth);
              setScrollOffsets(prev => {
                const newOffsets = [...prev];
                newOffsets[rowIdx] = Math.min(maxOffset, currentOffset + overshoot);
                return newOffsets;
              });
            } else if (cardLeftInClip < 10) {
              const overshoot = 20 - cardLeftInClip;
              setScrollOffsets(prev => {
                const newOffsets = [...prev];
                newOffsets[rowIdx] = Math.max(0, currentOffset - overshoot);
                return newOffsets;
              });
            }
          }
        }
      }
    }, 200);
  }, [scrollOffsets, rowConfigs, shuffleScale]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredId(null);
    // Smooth restoration: restore scroll offsets to pre-hover positions.
    // Combined with the CSS flex transition, this creates a clean contraction
    // without the stutter from rAF clamping.
    setScrollOffsets(prev => {
      const restored = [...prev];
      preHoverOffsets.current.forEach((savedOffset, idx) => {
        if (savedOffset !== undefined) {
          restored[idx] = savedOffset;
        }
      });
      return restored;
    });
  }, []);

  const scroll = (rowIdx: number, direction: 'left' | 'right') => {
    const track = scrollRefs.current[rowIdx];
    const clipContainer = clipRefs.current[rowIdx];
    if (!track || !clipContainer) return;
    const visibleWidth = clipContainer.clientWidth;
    const totalWidth = track.scrollWidth;
    const scrollAmount = visibleWidth * 0.75;
    setScrollOffsets(prev => {
      const newOffsets = [...prev];
      const current = newOffsets[rowIdx] || 0;
      const maxOffset = Math.max(0, totalWidth - visibleWidth);
      if (direction === 'left') {
        newOffsets[rowIdx] = Math.max(0, current - scrollAmount);
      } else {
        newOffsets[rowIdx] = Math.min(maxOffset, current + scrollAmount);
      }
      return newOffsets;
    });
  };

  // Split properties into rows
  const rowData: { props: Property[]; config: RowConfig }[] = [];
  let propIndex = 0;
  for (let i = 0; i < rowConfigs.length; i++) {
    const rc = rowConfigs[i];
    const count = rc.maxItems || rc.itemsPerRow * 2;
    rowData.push({ props: properties.slice(propIndex, propIndex + count), config: rc });
    propIndex += count;
  }

  // Measure and store row heights for SLIDE view (needs fixed pixel heights)
  // Recalculate when viewport changes so aspect ratios are correct at ALL breakpoints
  useEffect(() => {
    if (properties.length === 0) return;
    
    const measureHeights = () => {
      const heights: number[] = [];
      rowData.forEach((rd, idx) => {
        const firstProp = rd.props[0];
        if (firstProp) {
          const cardEl = cardRefs.current.get(`${idx}-${firstProp.id}`);
          if (cardEl) {
            heights[idx] = cardEl.offsetHeight;
          }
        }
      });
      if (heights.some(h => h > 0)) {
        setRowHeights(heights);
      }
    };

    // Reset heights to force re-measure, then re-measure after render
    setRowHeights([]);
    const timeout = setTimeout(measureHeights, 250);
    
    // Also re-measure on window resize for smooth breakpoint transitions
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      setRowHeights([]);
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measureHeights, 300);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timeout);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [properties.length, isMobile, isTablet, isLaptop]); // Re-measure on viewport change

  // Right-side bleed as percentage (how much of the next card peeks from the right)
  const bleedPct = parseFloat(bleed) || 5;
  // Fixed content indent on the left (same as Prime Video — all content starts here)
  const CONTENT_INDENT = '4%';

  const getStatusBadgeStyle = (status: string) => {
    if (!showStatusBadges) return null;
    const bg = status === 'active' ? (badgeColors.activeBg || '#22c55e') : status === 'pending' ? (badgeColors.pendingBg || '#eab308') : (badgeColors.soldBg || '#ef4444');
    return { backgroundColor: bg, color: badgeColors.fontColor || '#ffffff' };
  };

  const fontFamilies = useTypography ? [fonts.priceFont, fonts.addressFont, fonts.metaFont, fonts.labelFont, slideButtonFont].filter(Boolean) : [slideButtonFont].filter(Boolean);
  const uniqueFonts = [...new Set(fontFamilies)];

  return (
    <div className="showcase-root" style={{ backgroundColor: bgColor, fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100vh', overflowX: 'hidden', overflowY: 'visible' }}>
      {uniqueFonts.length > 0 && (
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${uniqueFonts.map(f => `family=${f.replace(/\s+/g, '+')}:wght@300;400;600;700`).join('&')}&display=swap`} />
      )}

      {showTitle && (
        <div style={{ paddingTop: '24px', paddingBottom: '8px', paddingLeft: CONTENT_INDENT, paddingRight: CONTENT_INDENT }}>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: textColor }}>{title}</h1>
          {subtitle && <p className="text-sm mt-1" style={{ color: mutedColor }}>{subtitle}</p>}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 32, height: 32, border: `2px solid ${textColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {!loading && properties.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: mutedColor }}>No properties found</div>
      )}

      {rowData.map(({ props: rowProperties, config: rc }, rowIdx) => {
        // Per-row responsive bleed as percentage of ONE CARD WIDTH that peeks on right
        const hoverView = rc.hoverView || 'shuffle';
        const rowBleedDesktop = rc.bleedDesktop ?? 10;
        const rowBleedLaptop = rc.bleedLaptop ?? rowBleedDesktop;
        const rowBleedTablet = rc.bleedTablet ?? 15;
        const rowBleedMobile = rc.bleedMobile ?? 25;
        const rowBleed = isMobile ? rowBleedMobile : isTablet ? rowBleedTablet : isLaptop ? rowBleedLaptop : rowBleedDesktop;

        return rowProperties.length > 0 && (
        <div key={rowIdx} className="showcase-row" style={{
          position: 'relative',
          marginBottom: isMobile ? '16px' : '24px',
          overflow: 'visible',
          zIndex: rowProperties.some(p => p.id === hoveredId) ? 10 : 1,
        }}>
          {rc.title && (
            <div style={{ paddingTop: '12px', paddingBottom: '6px', paddingLeft: CONTENT_INDENT, paddingRight: CONTENT_INDENT }}>
              <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 600, color: textColor }}>{rc.title}</h2>
            </div>
          )}

          {/* Left arrow — only shows when scrolled (Prime Video style) */}
          {(scrollOffsets[rowIdx] || 0) > 0 && (
          <button
            onClick={() => scroll(rowIdx, 'left')}
            className="showcase-arrow showcase-arrow-left"
            style={{ left: 0, width: CONTENT_INDENT, background: `linear-gradient(to right, ${bgColor}, transparent)` }}
          >
            <svg width="24" height="24" fill="none" stroke={textColor} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          )}

          {/* Clip wrapper — clips X overflow, allows Y overflow for shuffle scale */}
          <div
            ref={(el) => { clipRefs.current[rowIdx] = el; }}
            className="showcase-clip"
            style={{ position: 'relative' }}
          >
            {/* Inner flex track — moves via translateX for scrolling */}
            <div
              ref={(el) => { scrollRefs.current[rowIdx] = el; }}
              className="showcase-scroll"
              style={{
                paddingTop: '8px',
                paddingBottom: '8px',
                paddingLeft: CONTENT_INDENT,
                paddingRight: '0px',
                gap: `${cardGap}px`,
                transform: `translateX(-${scrollOffsets[rowIdx] || 0}px)`,
                transition: 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)',
              }}
            >
            {rowProperties.map((property, cardIdx) => {
              const isHovered = hoveredId === property.id;
              const isHero = heroCard && rowIdx === 0 && cardIdx === 0;
              // Responsive items per row from row config
              const mobileItems = rc.mobileItems || 2;
              const tabletItems = rc.tabletItems || Math.min(rc.itemsPerRow, 4);
              const laptopItems = rc.laptopItems || Math.min(rc.itemsPerRow, 5);
              const itemsInRow = isMobile ? mobileItems : isTablet ? tabletItems : isLaptop ? laptopItems : rc.itemsPerRow;
              const defaultPadding = getAspectPadding(isHero ? '16:9' : rc.aspectRatio);
              const hoverView = rc.hoverView || 'shuffle';
              const hoverAspectRatio = rc.hoverAspectRatio || '16:9';
              const expandedPadding = getAspectPadding(hoverAspectRatio);

              // Position for transform-origin (Shuffle mode)
              const isFirst = cardIdx === 0;
              const isLast = cardIdx === rowProperties.length - 1;
              const transformOrigin = isFirst ? 'left center' : isLast ? 'right center' : 'center center';
              
              // Card width: bleed% means "show bleed% of the next card as a peek"
              // So total card units visible = itemsInRow + bleed/100
              // Each card = 100% / totalUnits
              const cardWidthPct = 100 / (itemsInRow + rowBleed / 100);

              // Calculate expansion ratio for Slide mode
              // We need to expand horizontally to match the new aspect ratio while keeping height constant
              const defaultAspectValue = defaultPadding / 100; // e.g., 1.5 for 2:3
              const hoverAspectValue = expandedPadding / 100; // e.g., 0.5625 for 16:9
              // Expansion factor = how much wider the card needs to be
              const expansionFactor = defaultAspectValue / hoverAspectValue;

              // SHUFFLE VIEW: Scale up, pop above other cards — ZERO layout shift
              if (hoverView === 'shuffle') {
                return (
                  <div
                    key={property.id}
                    className="showcase-card-wrapper"
                    style={{
                      flex: `0 0 calc(${cardWidthPct}% - ${cardGap}px)`,
                      minWidth: isHero ? '280px' : '130px',
                      position: 'relative',
                      zIndex: isHovered ? 50 : 1,
                      // Lock wrapper dimensions — hover changes are purely visual
                      aspectRatio: `${100 / defaultPadding}`,
                    }}
                    onMouseEnter={() => handleMouseEnter(property.id, rowIdx)}
                    onMouseLeave={() => handleMouseLeave()}
                    onClick={() => {
                      if ((isMobile || isTablet) && !isHovered) {
                        setHoveredId(property.id); // First tap: expand
                        return;
                      }
                      window.open(getPropertyUrl(property, assignedAgentId), openInNewWindow ? '_blank' : '_self');
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    {/* Card is absolutely positioned — size changes don't affect wrapper or row */}
                    <div
                      className="showcase-card"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '8px',
                        overflow: 'visible',
                        cursor: 'pointer',
                        transform: isHovered ? `scale(${shuffleScale})` : 'scale(1)',
                        transformOrigin: transformOrigin,
                        transition: 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 0.35s ease',
                        boxShadow: isHovered ? '0 12px 40px rgba(0,0,0,0.7)' : '0 2px 8px rgba(0,0,0,0.2)',
                      }}
                    >
                      {/* Image fills the entire card */}
                      <div
                        className="showcase-image-wrap"
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '100%',
                          overflow: 'hidden',
                          borderRadius: isHovered ? '8px 8px 0 0' : '8px',
                          transition: 'border-radius 0.2s ease',
                        }}
                      >
                        {/* Studio mode: poster overlay IS the card — no extra meta */}
                        {thumbnailSource === 'studio' && property.creative_video_thumbnail ? (
                          <>
                            <img
                              src={property.creative_video_thumbnail}
                              alt={property.address}
                              style={{
                                position: 'absolute',
                                top: 0, left: 0, width: '100%', height: '100%',
                                objectFit: 'cover',
                              }}
                              onError={(e) => { (e.target as HTMLImageElement).src = property.main_thumbnail || property.images?.[0] || '/placeholder.svg'; }}
                            />
                          </>
                        ) : (
                          <>
                        <img
                          src={property.main_thumbnail || property.images?.[0] || '/placeholder.svg'}
                          alt={property.address}
                          style={{
                            position: 'absolute',
                            top: 0, left: 0, width: '100%', height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                        />
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: isHovered
                            ? `linear-gradient(to top, rgba(0,0,0,${Math.min(gradientOpacity + 0.15, 1)}) 0%, rgba(0,0,0,${gradientOpacity * 0.3}) 50%, transparent 70%)`
                            : `linear-gradient(to top, rgba(0,0,0,${gradientOpacity}) 0%, transparent 50%)`,
                          transition: 'background 0.3s ease',
                        }} />
                        <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 4 }}>
                          <span style={{
                            padding: '2px 8px', fontSize: '9px', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                            borderRadius: '4px', color: '#fff',
                            backgroundColor: 'rgba(255,255,255,0.15)',
                            backdropFilter: 'blur(8px)',
                          }}>
                            {property.listing_type === 'rent' ? 'For Rent' : property.property_subtype === 'Detached' ? 'House' : (property.property_subtype || 'House')}
                          </span>
                          {showStatusBadges && property.listing_status && (
                            <span style={{
                              padding: '2px 8px', fontSize: '9px', fontWeight: 700,
                              borderRadius: '4px', textTransform: 'capitalize',
                              ...(getStatusBadgeStyle(property.listing_status) || {}),
                            }}>{property.listing_status === 'pending' ? 'Active' : property.listing_status}</span>
                          )}
                        </div>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px' }}>
                          <div style={{
                            fontWeight: 700, color: '#fff',
                            fontSize: '14px',
                            textShadow: '0 2px 6px rgba(0,0,0,0.6)',
                            ...priceStyle,
                          }}>
                            {formatFullPrice(property.price)}
                          </div>
                          <div style={{
                            color: 'rgba(255,255,255,0.8)', fontSize: '11px',
                            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            ...addressStyleTypo,
                          }}>
                            {property.address}{isHovered ? `, ${property.city}` : ''}
                          </div>
                        </div>
                          </>
                        )}
                      </div>
                      {/* Info panel — absolutely positioned below the card image, never affects layout */}
                      <div
                        className="showcase-info"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          opacity: isHovered ? 1 : 0,
                          maxHeight: isHovered ? '120px' : '0',
                          overflow: 'hidden',
                          backgroundColor: cardBg,
                          borderRadius: '0 0 8px 8px',
                          transition: 'max-height 0.35s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.25s ease 0.1s',
                          padding: isHovered ? '10px 12px' : '0 12px',
                          pointerEvents: isHovered ? 'auto' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', marginBottom: '8px' }}>
                          {getSmartMeta(property).map((m, i) => (
                            <span key={i}><span style={{ fontWeight: 700, color: textColor }}>{m.value}</span> <span style={{ color: mutedColor }}>{m.label}</span></span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${borderCol}`, paddingTop: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {property.agent_profile_image_url ? (
                              <img src={property.agent_profile_image_url} alt={property.agent_name}
                                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div style={{
                                width: 22, height: 22, borderRadius: '50%', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700,
                                backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', color: mutedColor,
                              }}>{(property.agent_name || 'A').charAt(0)}</div>
                            )}
                            <span style={{ fontSize: '11px', color: textColor, fontWeight: 500 }}>{property.agent_name}</span>
                          </div>
                          <button style={{
                            padding: '4px 12px', fontSize: '10px', fontWeight: 700,
                            borderRadius: '4px', border: 'none', cursor: 'pointer',
                            backgroundColor: isDark ? '#fff' : '#1a1a2e',
                            color: isDark ? '#000' : '#fff',
                          }}>
                            View Property
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // SLIDE VIEW: Horizontal expansion on desktop/tablet, tap to show info on mobile
              const fixedHeight = rowHeights[rowIdx];
              const useFixedHeight = fixedHeight && fixedHeight > 0;
              const slideExpands = isHovered && !isMobile; // Desktop/tablet: expand card. Mobile: no expand, just show info on tap
              
              // Gradient helper using slide controls
              const hexToRgb = (hex: string) => {
                try {
                  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
                  return `${r},${g},${b}`;
                } catch { return '0,0,0'; }
              };

              // Build gradient from the proper picker values
              let normalGradient: string;
              let hoverGradient: string;

              if (slideGradientMode === 'solid') {
                const sc = hexToRgb(slideSolidColor);
                normalGradient = `rgba(${sc},${slideSolidOpacity / 100})`;
                hoverGradient = `rgba(${sc},${Math.min((slideSolidOpacity + 20) / 100, 1)})`;
              } else {
                const gv = slideGradientVal;
                const c1 = hexToRgb(gv.c1 || '#000000');
                const c2 = hexToRgb(gv.c2 || '#000000');
                normalGradient = `linear-gradient(${gv.angle || 0}deg, rgba(${c1},${(gv.o1 || 80) / 100}) ${gv.l1 || 0}%, rgba(${c2},${(gv.o2 || 0) / 100}) ${gv.l2 || 100}%)`;
                hoverGradient = `linear-gradient(${slideHoverGradientDirection}, rgba(${c1},${Math.min(((gv.o1 || 80) + 15) / 100, 1)}) 0%, rgba(${c1},${(gv.o1 || 80) / 100 * 0.7}) 40%, rgba(${c2},${(gv.o2 || 0) / 100 * 0.5}) 70%, transparent 100%)`;
              }

              // Text position styles
              const textPosStyle: Record<string, any> = {
                'bottom-left': { bottom: 0, left: 0, right: 0, alignItems: 'flex-start', justifyContent: 'flex-end' },
                'bottom-center': { bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'flex-end', textAlign: 'center' as const },
                'bottom-right': { bottom: 0, left: 0, right: 0, alignItems: 'flex-end', justifyContent: 'flex-end' },
                'center': { top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', textAlign: 'center' as const },
              };
              const posStyle = textPosStyle[slideTextPosition] || textPosStyle['bottom-left'];
              
              return (
                <div
                  key={property.id}
                  ref={(el) => { if (el) cardRefs.current.set(`${rowIdx}-${property.id}`, el); }}
                  className="showcase-card-wrapper-slide"
                  style={{
                    flex: slideExpands 
                      ? `0 0 calc(${cardWidthPct * expansionFactor}% - ${cardGap}px)` 
                      : `0 0 calc(${cardWidthPct}% - ${cardGap}px)`,
                    minWidth: isHero ? '280px' : '130px',
                    position: 'relative',
                    zIndex: isHovered ? 20 : 1,
                    transition: 'flex 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
                    height: useFixedHeight ? `${fixedHeight}px` : 'auto',
                  }}
                    onMouseEnter={() => handleMouseEnter(property.id, rowIdx)}
                    onMouseLeave={() => handleMouseLeave()}
                    onClick={() => {
                      if ((isMobile || isTablet) && !isHovered) {
                        setHoveredId(property.id);
                        return;
                      }
                      window.open(getPropertyUrl(property, assignedAgentId), openInNewWindow ? '_blank' : '_self');
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                  <div
                    className="showcase-card-slide"
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: useFixedHeight ? '100%' : 'auto',
                      paddingBottom: useFixedHeight ? undefined : `${defaultPadding}%`,
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      boxShadow: isHovered ? '0 8px 32px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.2)',
                      transition: 'box-shadow 0.35s ease',
                    }}
                  >
                    {/* Studio mode: show poster thumbnail when not expanded, banner when expanded */}
                    {thumbnailSource === 'studio' && property.creative_video_thumbnail ? (
                      <>
                        {/* Poster thumbnail (always present, fades out on hover) */}
                        <img
                          src={property.creative_video_thumbnail}
                          alt={property.address}
                          style={{
                            position: 'absolute',
                            top: 0, left: 0, width: '100%', height: '100%',
                            objectFit: 'cover',
                            opacity: slideExpands && property.creative_hero_image ? 0 : 1,
                            transition: 'opacity 0.4s ease',
                            zIndex: 2,
                          }}
                          onError={(e) => { (e.target as HTMLImageElement).src = property.main_thumbnail || property.images?.[0] || '/placeholder.svg'; }}
                        />
                        {/* Banner (behind poster, revealed on hover expand) */}
                        {property.creative_hero_image && (
                          <img
                            src={property.creative_hero_image}
                            alt={property.address}
                            style={{
                              position: 'absolute',
                              top: 0, left: 0, width: '100%', height: '100%',
                              objectFit: 'contain',
                              backgroundColor: '#000',
                              zIndex: 1,
                              transition: 'transform 0.4s ease',
                            }}
                            onError={(e) => { (e.target as HTMLImageElement).src = property.main_thumbnail || property.images?.[0] || '/placeholder.svg'; }}
                          />
                        )}
                        {/* Light gradient for expanded state readability — only in standard mode, studio posters have their own design */}
                        {slideExpands && !property.creative_hero_image && (
                          <div style={{
                            position: 'absolute', inset: 0, zIndex: 3,
                            background: hoverGradient,
                            transition: 'opacity 0.35s ease',
                          }} />
                        )}
                      </>
                    ) : (
                      <>
                    <img
                      src={property.main_thumbnail || property.images?.[0] || '/placeholder.svg'}
                      alt={property.address}
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, width: '100%', height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.4s ease',
                      }}
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />

                    {/* Gradient overlay — configurable */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: (slideExpands || (isMobile && isHovered)) ? hoverGradient : normalGradient,
                      transition: 'background 0.35s ease',
                    }} />
                      </>
                    )}

                    {/* Badge — show in both modes */}
                    <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 4 }}>
                      <span style={{
                        padding: '2px 8px', fontSize: '9px', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        borderRadius: '4px', color: '#fff',
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                      }}>
                        {property.listing_type === 'rent' ? 'For Rent' : property.property_subtype === 'Detached' ? 'House' : (property.property_subtype || 'House')}
                      </span>
                      {showStatusBadges && property.listing_status && (
                        <span style={{
                          padding: '2px 8px', fontSize: '9px', fontWeight: 700,
                          borderRadius: '4px', textTransform: 'capitalize',
                          ...(getStatusBadgeStyle(property.listing_status) || {}),
                        }}>{property.listing_status === 'pending' ? 'Active' : property.listing_status}</span>
                      )}
                    </div>

                    {/* Content container — uses configurable text position */}
                    {/* In studio mode, the poster/banner images have all design baked in — skip HTML overlay entirely */}
                    {!(thumbnailSource === 'studio' && (property.creative_hero_image || property.creative_video_thumbnail)) && (
                    <div style={{
                      position: 'absolute',
                      ...posStyle,
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                    }}>
                      {/* Expanded info — desktop: positioned left on hover. Mobile: always visible on tap */}
                      {(slideExpands || (isMobile && isHovered)) && (
                        <div style={{
                          opacity: 1,
                          marginBottom: 'auto',
                          marginTop: '40px',
                          color: slideFontColor,
                        }}>
                          <div style={{ display: 'flex', gap: '10px', fontSize: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            {getSmartMeta(property).map((m, i) => (
                              <span key={i}><span style={{ fontWeight: 700 }}>{m.value}</span> {m.label}</span>
                            ))}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            {property.agent_profile_image_url ? (
                              <img src={property.agent_profile_image_url} alt={property.agent_name}
                                style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : null}
                            <span style={{ fontSize: '12px', fontWeight: 500 }}>{property.agent_name}</span>
                          </div>
                          <button className="slide-view-btn" style={{
                            padding: `${slideButtonPaddingY}px ${slideButtonPaddingX}px`, fontSize: `${slideButtonFontSize}px`,
                            fontWeight: parseInt(slideButtonFontWeight) || 700,
                            fontFamily: slideButtonFont ? `"${slideButtonFont}", sans-serif` : undefined,
                            letterSpacing: slideButtonLetterSpacing !== '0' ? `${slideButtonLetterSpacing}px` : undefined,
                            borderRadius: `${slideButtonRadius}px`, border: 'none', cursor: 'pointer',
                            backgroundColor: slideButtonColor,
                            color: slideButtonTextColor,
                            transition: 'background-color 0.2s ease, color 0.2s ease',
                            ['--btn-bg' as any]: slideButtonColor,
                            ['--btn-text' as any]: slideButtonTextColor,
                          }}>
                            View Property
                          </button>
                        </div>
                      )}

                      {/* Price & address - always at bottom */}
                      <div>
                        <div style={{
                          fontWeight: 700, color: slideFontColor,
                          fontSize: `${slidePriceFontSize}px`,
                          textShadow: '0 2px 6px rgba(0,0,0,0.6)',
                          ...priceStyle,
                        }}>
                          {formatFullPrice(property.price)}
                        </div>
                        <div style={{
                          color: `${slideFontColor}dd`, fontSize: '11px',
                          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          ...addressStyleTypo,
                        }}>
                          {property.address}{isHovered ? `, ${property.city}` : ''}
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* Right arrow — covers the bleed/peek area */}
          <button
            onClick={() => scroll(rowIdx, 'right')}
            className="showcase-arrow showcase-arrow-right"
            style={{ right: 0, width: '4%', minWidth: '36px', background: `linear-gradient(to left, ${bgColor}, transparent)` }}
          >
            <svg width="24" height="24" fill="none" stroke={textColor} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        );
      })}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .showcase-clip {
          overflow-x: clip;
          overflow-y: visible;
        }
        .showcase-scroll {
          display: flex;
          gap: 8px;
          overflow: visible;
          will-change: transform;
        }
        .showcase-row:hover .showcase-arrow { opacity: 1; }
        .showcase-arrow {
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: 25;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .slide-view-btn:hover {
          background-color: var(--btn-text) !important;
          color: var(--btn-bg) !important;
        }
      `}</style>
    </div>
  );
}
