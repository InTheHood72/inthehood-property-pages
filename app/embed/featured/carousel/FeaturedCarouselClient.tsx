'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

// ============ CONSTANTS ============
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const FALLBACK_BACKEND_URL = 'https://api-production-531c.up.railway.app';
const NEXTJS_TEMPLATE_URL = 'https://in-the-hood-io-5dmw.vercel.app';

async function fetchBackendUrl(): Promise<string> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/global_settings?select=api_config&limit=1`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      cache: 'no-store'
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.[0]?.api_config?.current_backend_url) {
        let url = data[0].api_config.current_backend_url;
        return url.endsWith('/') ? url.slice(0, -1) : url;
      }
    }
  } catch (e) { console.warn('Could not fetch backend URL:', e); }
  return FALLBACK_BACKEND_URL;
}

interface Property {
  id: string; mls_number: string; address: string; city: string; province?: string;
  price: number; bedrooms: number; bathrooms: number; sqft?: number;
  images: string[]; property_subtype?: string; listing_status?: string; listing_type?: string;
  selected_template?: string; subdivision_name?: string;
  presentation_settings?: { theme?: string };
  agent_name?: string; agent_profile_image_url?: string;
  creative_video_thumbnail?: string; creative_hero_image?: string;
  co_list_agent_name?: string; co_listing_agent_profiles?: { id: string; full_name: string; profile_image_url?: string }[];
  property_type?: string; property_sub_type?: string; lot_size?: number; lot_size_acres?: number;
}

// Smart meta: detect property type and return appropriate metadata items
function getSmartMeta(property: Property): { label: string; value: string }[] {
  const propType = (property.property_type || '').toLowerCase();
  const propSubtype = (property.property_sub_type || property.property_subtype || '').toLowerCase();
  const isLand = propType === 'land' || propSubtype.includes('land') || propSubtype.includes('farm') || propSubtype.includes('vacant') || propSubtype.includes('acreage');
  const isCommercial = propType === 'commercial' || propSubtype.includes('commercial') || propSubtype.includes('business') || propSubtype.includes('retail') || propSubtype.includes('office') || propSubtype.includes('industrial');

  if (isLand) {
    const meta: { label: string; value: string }[] = [];
    if (property.lot_size_acres && property.lot_size_acres > 0) meta.push({ label: 'Acres', value: parseFloat(String(property.lot_size_acres)).toFixed(2) });
    if (property.lot_size && property.lot_size > 0) meta.push({ label: 'Lot Sqft', value: Math.round(property.lot_size).toLocaleString() });
    if (property.sqft && property.sqft > 0) meta.push({ label: 'Sqft', value: property.sqft.toLocaleString() });
    return meta.length > 0 ? meta : [{ label: 'Land', value: propSubtype || 'Vacant Land' }];
  }
  if (isCommercial) {
    const meta: { label: string; value: string }[] = [];
    if (property.sqft && property.sqft > 0) meta.push({ label: 'Sqft', value: property.sqft.toLocaleString() });
    if (property.lot_size && property.lot_size > 0) meta.push({ label: 'Lot Sqft', value: Math.round(property.lot_size).toLocaleString() });
    if (property.lot_size_acres && property.lot_size_acres > 0) meta.push({ label: 'Acres', value: parseFloat(String(property.lot_size_acres)).toFixed(2) });
    return meta.length > 0 ? meta : [{ label: 'Type', value: propSubtype || 'Commercial' }];
  }
  const meta: { label: string; value: string }[] = [];
  if (property.bedrooms > 0) meta.push({ label: 'Beds', value: String(property.bedrooms) });
  if (property.bathrooms > 0) meta.push({ label: 'Baths', value: String(property.bathrooms) });
  if (property.sqft && property.sqft > 0) meta.push({ label: 'Sqft', value: property.sqft.toLocaleString() });
  return meta;
}

const formatPrice = (price: number): string => `$${Math.round(price).toLocaleString()}`;

const generateSlug = (p: Property): string => {
  const parts = [p.mls_number, p.address, p.city, p.province || 'Alberta'];
  if (p.subdivision_name && p.subdivision_name.toUpperCase() !== 'NONE') parts.push(p.subdivision_name);
  return parts.filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
};

const ChevronLeftIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>;
const ChevronRightIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>;

// Convert aspect ratio string to CSS value
function parseAspectRatio(ar: string): string {
  // Handle both "16/9" and "16:9" formats
  return ar.replace(':', '/');
}

export default function FeaturedCarouselClient() {
  const searchParams = useSearchParams();

  // URL Parameters
  const theme = searchParams.get('theme') || 'light';
  const userId = searchParams.get('userId');
  const userIds = searchParams.get('userIds')?.split(',').filter(Boolean) || [];
  const itemsPerView = parseInt(searchParams.get('itemsPerView') || '3');
  const maxItems = parseInt(searchParams.get('maxItems') || '50');
  const openInNewWindow = searchParams.get('openInNewWindow') !== 'false';
  const cardStyle = searchParams.get('cardStyle') || 'meta-below';
  const listingStyle = searchParams.get('listingStyle') || 'top';
  const aspectRatioRaw = searchParams.get('aspectRatio') || '16/9';
  const listingStatusFilter = searchParams.get('listingStatus') || 'active,pending';
  const sortOrderParam = searchParams.get('sortOrder') || 'date-desc';
  const pinnedListingsParam = searchParams.get('pinnedListings') || '';
  const selectedListingsParam = searchParams.get('selectedListings') || '';
  const aspectCSS = parseAspectRatio(aspectRatioRaw);
  const assignedAgentId = searchParams.get('agentId');
  const bgColor = searchParams.get('bgColor') || '#ffffff';
  const bleed = searchParams.get('bleed') || 'none';
  const autoPlay = searchParams.get('autoPlay') === 'true';
  const propertyType = searchParams.get('propertyType') || 'both';
  const showStatusBadges = searchParams.get('showStatusBadges') === 'true';
  const thumbnailSource = searchParams.get('thumbnailSource') || 'standard';
  
  // Responsive items per view from embed generator
  const itemsPerViewResponsive = (() => {
    try { return JSON.parse(decodeURIComponent(searchParams.get('itemsPerViewResponsive') || '{}')); }
    catch { return {}; }
  })();
  const useTypography = searchParams.get('useTypography') === 'true';
  const overrideTheme = searchParams.get('overrideTheme') === 'true';
  
  // Parse JSON params safely
  const fonts = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('fonts') || '{}')); } catch { return {}; } })();
  const badgeColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('badgeColors') || '{}')); } catch { return {}; } })();
  const mapColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('mapColors') || '{}')); } catch { return {}; } })();
  const overlayOpacity = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('overlayOpacity') || '{}')); } catch { return {}; } })();

  const allUserIds = userId ? [userId, ...userIds] : userIds;

  const [backendUrl, setBackendUrl] = useState<string>(FALLBACK_BACKEND_URL);
  const [backendUrlLoaded, setBackendUrlLoaded] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [responsiveItems, setResponsiveItems] = useState(itemsPerView);
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      // Use responsive settings from embed generator if available, else sensible defaults
      if (w < 640) setResponsiveItems(itemsPerViewResponsive.mobile || 1);
      else if (w < 768) setResponsiveItems(itemsPerViewResponsive.mobile || 1);
      else if (w < 1024) setResponsiveItems(itemsPerViewResponsive.tablet || Math.min(2, itemsPerView));
      else if (w < 1366) setResponsiveItems(itemsPerViewResponsive.laptop || Math.min(3, itemsPerView));
      else setResponsiveItems(itemsPerViewResponsive.desktop || itemsPerView);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [itemsPerView, itemsPerViewResponsive]);

  const carouselRef = useRef<HTMLDivElement>(null);

  // Theme / color resolution
  const isDark = theme === 'dark';
  const textColor = overrideTheme && mapColors.priceColor ? mapColors.priceColor : (isDark ? '#ffffff' : '#000000');
  const borderColor = isDark ? '#3f3f46' : '#e5e7eb';
  const cardBgColor = overrideTheme && mapColors.cardBgColor ? mapColors.cardBgColor : (isDark ? '#18181b' : '#ffffff');
  const mutedTextColor = overrideTheme && mapColors.metaColor ? mapColors.metaColor : (isDark ? '#a1a1aa' : '#6b7280');
  const addressColor = overrideTheme && mapColors.addressColor ? mapColors.addressColor : mutedTextColor;

  // Font helpers
  const priceStyle = useTypography && fonts.priceFont ? {
    fontFamily: `'${fonts.priceFont}', sans-serif`,
    fontWeight: fonts.priceFontWeight || '600',
    fontSize: `${fonts.priceFontSize || '18'}px`,
    letterSpacing: `${fonts.priceLetterSpacing || '0'}px`,
    color: fonts.priceColor || textColor,
  } : { color: textColor };
  
  const addressStyle = useTypography && fonts.addressFont ? {
    fontFamily: `'${fonts.addressFont}', sans-serif`,
    fontWeight: fonts.addressFontWeight || '400',
    fontSize: `${fonts.addressFontSize || '14'}px`,
    letterSpacing: `${fonts.addressLetterSpacing || '0'}px`,
    color: fonts.addressColor || addressColor,
  } : { color: addressColor };

  const metaStyle = useTypography && fonts.metaFont ? {
    fontFamily: `'${fonts.metaFont}', sans-serif`,
    fontWeight: fonts.metaFontWeight || '600',
    fontSize: `${fonts.metaFontSize || '14'}px`,
    letterSpacing: `${fonts.metaLetterSpacing || '0'}px`,
    color: fonts.metaColor || textColor,
  } : { color: textColor };

  const labelStyle = useTypography && fonts.labelFont ? {
    fontFamily: `'${fonts.labelFont}', sans-serif`,
    fontWeight: fonts.labelFontWeight || '400',
    fontSize: `${fonts.labelFontSize || '12'}px`,
    letterSpacing: `${fonts.labelLetterSpacing || '0'}px`,
    color: fonts.labelColor || mutedTextColor,
  } : { color: mutedTextColor };

  useEffect(() => {
    const init = async () => {
      const url = await fetchBackendUrl();
      setBackendUrl(url);
      setBackendUrlLoaded(true);
    };
    init();
  }, []);

  const loadProperties = useCallback(async () => {
    if (!backendUrlLoaded || allUserIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/featured-properties?user_ids=${allUserIds.join(',')}&listing_status=${listingStatusFilter}&sort_order=${sortOrderParam}${pinnedListingsParam ? `&pinned_listings=${pinnedListingsParam}` : ''}${selectedListingsParam ? `&selected_listings=${selectedListingsParam}` : ''}`);
      const data = await res.json();
      if (data.properties) {
        let propsData = data.properties.filter((p: any) => p.latitude && p.longitude);
        if (propertyType === 'for_sale') propsData = propsData.filter((p: any) => p.listing_type === 'sale' || !p.listing_type);
        else if (propertyType === 'for_rent') propsData = propsData.filter((p: any) => p.listing_type === 'rent');
        const mappedProps: Property[] = propsData.slice(0, maxItems).map((p: any) => ({
          id: p.id, mls_number: p.mls_number, address: p.address, city: p.city, province: p.province || 'AB',
          price: p.listing_type === 'rent' ? p.rent_price : p.price,
          bedrooms: p.bedrooms || 0, bathrooms: p.bathrooms || 0,
          sqft: p.square_feet || p.sqft || 0,
          images: p.images || [], property_subtype: p.property_subtype || p.building_type || 'House',
          property_type: p.property_type || '', property_sub_type: p.property_sub_type || p.property_subtype || '',
          lot_size: p.lot_size || p.lot_size_sqft || 0, lot_size_acres: p.lot_size_acres || 0,
          listing_status: p.listing_status || 'active', listing_type: p.listing_type || 'sale',
          subdivision_name: p.subdivision_name || '', selected_template: p.selected_template,
          presentation_settings: p.presentation_settings,
          agent_name: p.agent_name || 'Agent', agent_profile_image_url: p.agent_profile_image_url,
          creative_video_thumbnail: p.creative_video_thumbnail || null,
          creative_hero_image: p.creative_hero_image || null,
          co_list_agent_name: p.co_list_agent_name,
          co_listing_agent_profiles: p.co_listing_agent_profiles || []
        }));
        setProperties(mappedProps);
      }
    } catch (err) { console.error('Load error:', err); }
    finally { setLoading(false); }
  }, [backendUrlLoaded, backendUrl, allUserIds.join(','), propertyType, maxItems]);

  useEffect(() => { if (backendUrlLoaded && allUserIds.length > 0) loadProperties(); }, [backendUrlLoaded, loadProperties]);

  useEffect(() => {
    if (!autoPlay || properties.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + responsiveItems >= properties.length ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [autoPlay, properties.length, responsiveItems]);

  const getNextJsPropertyUrl = (property: Property): string => {
    const slug = generateSlug(property);
    const agentParam = assignedAgentId ? `?agentId=${assignedAgentId}` : '';
    return `${NEXTJS_TEMPLATE_URL}/featured-property/${slug}${agentParam}`;
  };

  const handlePropertyClick = (property: Property) => {
    window.open(getNextJsPropertyUrl(property), openInNewWindow ? '_blank' : '_self');
  };

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex + responsiveItems < properties.length;
  const goToPrev = () => { if (canGoPrev) setCurrentIndex(prev => Math.max(0, prev - responsiveItems)); };
  const goToNext = () => { if (canGoNext) setCurrentIndex(prev => Math.min(properties.length - responsiveItems, prev + responsiveItems)); };

  // Badge helpers
  const getStatusBadgeStyle = (status: string) => {
    if (!showStatusBadges) return null;
    const bg = status === 'active' ? (badgeColors.activeBg || '#22c55e') : status === 'pending' ? (badgeColors.pendingBg || '#eab308') : (badgeColors.soldBg || '#ef4444');
    return { backgroundColor: bg, color: badgeColors.fontColor || '#ffffff' };
  };

  const getPropertyImage = (property: Property): string => {
    if (thumbnailSource === 'studio') {
      // Card layouts always use the poster thumbnail (2:3 design)
      // The banner (16:9) is only for the showcase hover state
      if (property.creative_video_thumbnail) return property.creative_video_thumbnail;
      if (property.creative_hero_image) return property.creative_hero_image;
    }
    return property.main_thumbnail || property.images?.[0] || '/placeholder.svg';
  };

  const getStatusLabel = (status: string): string => {
    // Pillar 9 Rule: Pending listings must display as "Active"
    return status === 'pending' ? 'Active' : status;
  };

  if (allUserIds.length === 0) {
    return <div className="flex items-center justify-center min-h-[400px]" style={{ backgroundColor: bgColor, color: mutedTextColor }}>No user specified. Add userId or userIds parameter.</div>;
  }
  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]" style={{ backgroundColor: bgColor }}><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500"></div></div>;
  }
  if (properties.length === 0) {
    return <div className="flex items-center justify-center min-h-[400px]" style={{ backgroundColor: bgColor, color: mutedTextColor }}>No properties found</div>;
  }

  const containerPadding = bleed === 'right' ? 'pl-4 md:pl-8' : 'px-4 md:px-8';
  const itemWidth = bleed === 'right' ? `${100 / (responsiveItems + 0.5)}%` : `${100 / responsiveItems}%`;

  const isMetaOverlay = cardStyle === 'meta-overlay';
  const isSideCard = listingStyle === 'side';

  // Overlay settings
  const overlayBgColor = overlayOpacity?.bgColor || '#000000';
  const overlayNormal = parseFloat(overlayOpacity?.normal || '0.8');
  const overlayHover = parseFloat(overlayOpacity?.hover || '0.95');

  // Google Fonts link
  const fontFamilies = useTypography ? [fonts.priceFont, fonts.addressFont, fonts.metaFont, fonts.labelFont].filter(Boolean) : [];
  const uniqueFonts = [...new Set(fontFamilies)];

  return (
    <div className="w-full py-8" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Google Fonts */}
      {uniqueFonts.length > 0 && (
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${uniqueFonts.map(f => `family=${f.replace(/\s+/g, '+')}:wght@300;400;600;700`).join('&')}&display=swap`} />
      )}
      <div className={`relative group ${containerPadding}`}>
        <div ref={carouselRef} className="overflow-hidden">
          <div 
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${currentIndex * (100 / responsiveItems)}%)` }}
          >
            {properties.map(property => (
              <div 
                key={property.id} 
                className="flex-shrink-0 px-2"
                style={{ width: itemWidth }}
              >
                <div onClick={() => handlePropertyClick(property)} 
                  className="rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-xl h-full"
                  style={{ backgroundColor: cardBgColor, border: `1px solid ${borderColor}` }}>
                  
                  {/* === SIDE CARD LAYOUT === */}
                  {isSideCard ? (
                    <div className="flex h-full">
                      <div className="relative flex-shrink-0 overflow-hidden" style={{ width: '45%', aspectRatio: aspectCSS }}>
                        {property.images?.[0] || property.creative_video_thumbnail ? (
                          <img src={getPropertyImage(property)} alt={property.address} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center" style={{ color: mutedTextColor }}>No Image</div>
                        )}
                        <div className="absolute top-2 left-2 flex gap-1.5">
                          <span className="px-2 py-0.5 text-xs font-medium rounded text-white bg-black/70">{property.property_subtype || 'Property'}</span>
                          {property.listing_type === 'rent' && <span className="px-2 py-0.5 text-xs font-medium rounded text-white bg-blue-600">For Rent</span>}
                        </div>
                        {showStatusBadges && property.listing_status && (
                          <div className="absolute top-2 right-2">
                            <span className="px-2 py-0.5 text-xs font-bold rounded capitalize" style={getStatusBadgeStyle(property.listing_status) || {}}>{getStatusLabel(property.listing_status)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <div className="text-xl font-bold mb-1" style={priceStyle}>{formatPrice(property.price)}</div>
                          <div className="text-sm mb-2 flex items-center gap-1" style={addressStyle}>
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {property.address}, {property.city}
                          </div>
                          <div className="flex gap-4 text-sm">
                            {getSmartMeta(property).map((m, i) => (
                              <div key={i}><span className="font-semibold" style={metaStyle}>{m.value}</span> <span style={labelStyle}>{m.label}</span></div>
                            ))}
                          </div>
                        </div>
                        {/* Agent */}
                        <div className="flex items-center gap-2 mt-3 pt-2" style={{ borderTop: `1px solid ${borderColor}` }}>
                          {property.agent_profile_image_url ? (
                            <img src={property.agent_profile_image_url} alt={property.agent_name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', color: mutedTextColor }}>{(property.agent_name || 'A').charAt(0).toUpperCase()}</div>
                          )}
                          <span className="text-xs font-medium truncate" style={{ color: textColor }}>{property.agent_name}</span>
                        </div>
                      </div>
                    </div>
                  ) : isMetaOverlay ? (
                    /* === META OVERLAY (TOP CARD) === */
                    <>
                      <div className="relative overflow-hidden" style={{ aspectRatio: aspectCSS }}>
                        {property.images?.[0] || property.creative_video_thumbnail ? (
                          <img src={getPropertyImage(property)} alt={property.address} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center" style={{ color: mutedTextColor }}>No Image</div>
                        )}
                        <div className="absolute top-2 left-2 flex gap-1.5">
                          <span className="px-2 py-0.5 text-xs font-medium rounded text-white bg-black/70">{property.property_subtype || 'Property'}</span>
                          {property.listing_type === 'rent' && <span className="px-2 py-0.5 text-xs font-medium rounded text-white bg-blue-600">For Rent</span>}
                        </div>
                        {showStatusBadges && property.listing_status && (
                          <div className="absolute top-2 right-2">
                            <span className="px-2 py-0.5 text-xs font-bold rounded capitalize" style={getStatusBadgeStyle(property.listing_status) || {}}>{getStatusLabel(property.listing_status)}</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: `linear-gradient(transparent, ${overlayBgColor})` }}>
                          <div className="text-xl font-bold text-white mb-0.5" style={useTypography && fonts.priceFont ? { ...priceStyle, color: fonts.priceColor || '#ffffff' } : {}}>{formatPrice(property.price)}</div>
                          <div className="text-white/80 text-sm truncate" style={useTypography && fonts.addressFont ? { ...addressStyle, color: fonts.addressColor || 'rgba(255,255,255,0.8)' } : {}}>{property.address}, {property.city}</div>
                          <div className="flex gap-4 mt-1 text-white/90 text-xs">
                            {getSmartMeta(property).map((m, i) => (
                              <span key={i} style={useTypography && fonts.metaFont ? { ...metaStyle, color: fonts.metaColor || 'rgba(255,255,255,0.9)' } : {}}>{m.value} {m.label}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Agent row for overlay */}
                      <div className="flex items-center gap-2 px-3 py-2">
                        {property.agent_profile_image_url ? (
                          <img src={property.agent_profile_image_url} alt={property.agent_name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', color: mutedTextColor }}>{(property.agent_name || 'A').charAt(0).toUpperCase()}</div>
                        )}
                        <span className="text-xs truncate" style={{ color: mutedTextColor }}>{property.agent_name}</span>
                      </div>
                    </>
                  ) : (
                    /* === DEFAULT: META BELOW (TOP CARD) === */
                    <>
                      <div className="overflow-hidden relative" style={{ aspectRatio: aspectCSS }}>
                        {property.images?.[0] || property.creative_video_thumbnail ? (
                          <img src={getPropertyImage(property)} alt={property.address} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center" style={{ color: mutedTextColor }}>No Image</div>
                        )}
                        <div className="absolute top-3 left-3 flex gap-2">
                          <span className="px-2 py-1 text-xs font-medium rounded text-white bg-black/70">{property.property_subtype || 'Property'}</span>
                          {property.listing_type === 'rent' && <span className="px-2 py-1 text-xs font-medium rounded text-white bg-blue-600">For Rent</span>}
                        </div>
                        {showStatusBadges && property.listing_status && (
                          <div className="absolute top-3 right-3">
                            <span className="px-2 py-1 text-xs font-bold rounded capitalize" style={getStatusBadgeStyle(property.listing_status) || {}}>{getStatusLabel(property.listing_status)}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="text-xl font-bold mb-1" style={priceStyle}>{formatPrice(property.price)}</div>
                        <div className="text-sm mb-3 flex items-center gap-1" style={addressStyle}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {property.address}, {property.city}
                        </div>
                        <div className="flex gap-6 text-sm">
                          {getSmartMeta(property).map((m, i) => (
                            <div key={i}><span className="font-semibold" style={metaStyle}>{m.value}</span> <span style={labelStyle}>{m.label}</span></div>
                          ))}
                        </div>
                        {/* Agent */}
                        <div className="flex items-center gap-2 mt-3 pt-2" style={{ borderTop: `1px solid ${borderColor}` }}>
                          {property.agent_profile_image_url ? (
                            <img src={property.agent_profile_image_url} alt={property.agent_name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', color: mutedTextColor }}>{(property.agent_name || 'A').charAt(0).toUpperCase()}</div>
                          )}
                          <span className="text-xs font-medium truncate" style={{ color: textColor }}>{property.agent_name}</span>
                          {property.co_listing_agent_profiles && property.co_listing_agent_profiles.length > 0 && (
                            <div className="flex items-center gap-1 ml-1">
                              {property.co_listing_agent_profiles.map((co: any) => (
                                <div key={co.id} className="flex items-center gap-1">
                                  <span className="text-[11px]" style={{ color: mutedTextColor }}>&</span>
                                  {co.profile_image_url ? <img src={co.profile_image_url} alt={co.full_name} className="w-5 h-5 rounded-full object-cover" /> : null}
                                  <span className="text-[11px] truncate" style={{ color: mutedTextColor }}>{co.full_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {!property.co_listing_agent_profiles?.length && property.co_list_agent_name && (
                            <span className="text-[11px] ml-1" style={{ color: mutedTextColor }}>& {property.co_list_agent_name}</span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <button onClick={goToPrev} disabled={!canGoPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: '#000' }}><ChevronLeftIcon /></button>
        <button onClick={goToNext} disabled={!canGoNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: '#000' }}><ChevronRightIcon /></button>
      </div>
    </div>
  );
}
