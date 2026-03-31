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
  images: string[]; property_subtype?: string; listing_status?: string;
  subdivision?: string; neighbourhood?: string;
}

const formatPrice = (price: number): string => `$${Math.round(price).toLocaleString()}`;

// Generate SEO-friendly slug for MLS properties
const generateMlsSlug = (property: Property): string => {
  const parts = [
    property.mls_number,
    property.address,
    property.subdivision || property.neighbourhood,
    property.city
  ];
  return parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

const ChevronLeftIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>;
const ChevronRightIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>;

export default function Pillar9CarouselClient() {
  const searchParams = useSearchParams();

  // URL Parameters - Core
  const theme = searchParams.get('theme') || 'light';
  const listingTheme = searchParams.get('listingTheme') || searchParams.get('theme') || 'light'; // Template theme for property links (air vs air-dark)
  const itemsPerView = parseInt(searchParams.get('itemsPerView') || '3');
  const maxItems = parseInt(searchParams.get('maxItems') || '50');
  const openInNewWindow = searchParams.get('openInNewWindow') !== 'false';
  const assignedAgentId = searchParams.get('agentId');
  const sortOrder = searchParams.get('sortOrder') || 'latest';
  const bgColor = searchParams.get('bgColor') || '#ffffff';
  const bleed = searchParams.get('bleed') || 'none';
  const autoPlay = searchParams.get('autoPlay') === 'true';
  const showStatusBadges = searchParams.get('showStatusBadges') !== 'false';
  const cardStyle = searchParams.get('cardStyle') || 'meta-below';
  const listingStyle = searchParams.get('listingStyle') || 'top';
  const aspectRatio = searchParams.get('aspectRatio') || '16:10';
  const aspectCSS = aspectRatio.replace(':', '/');

  // URL Parameters - MLS Pre-filters (from Embed Generator)
  const citiesParam = searchParams.get('cities')?.split(',').filter(Boolean) || [];
  const zonesParam = searchParams.get('zones')?.split(',').filter(Boolean) || [];
  const neighbourhoodsParam = searchParams.get('neighbourhoods')?.split(',').filter(Boolean) || [];
  const priceMinParam = searchParams.get('priceMin');
  const priceMaxParam = searchParams.get('priceMax');
  const bedsMinParam = searchParams.get('bedsMin');
  const bathsMinParam = searchParams.get('bathsMin');
  const propertyTypesParam = searchParams.get('propertyTypes')?.split(',').filter(Boolean) || [];
  const propertySubTypesParam = searchParams.get('propertySubTypes')?.split(',').filter(Boolean) || [];
  const hasOpenHouseParam = searchParams.get('hasOpenHouse') === 'true';
  const hasVirtualTourParam = searchParams.get('hasVirtualTour') === 'true';
  const overrideTheme = searchParams.get('overrideTheme') === 'true';
  const useTypography = searchParams.get('useTypography') === 'true';

  // Parse JSON params safely
  const fonts = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('fonts') || '{}')); } catch { return {}; } })();
  const mapColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('mapColors') || '{}')); } catch { return {}; } })();
  const badgeColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('badgeColors') || '{}')); } catch { return {}; } })();

  const isDark = theme === 'dark';
  
  // Compute colors - use overrides if provided, otherwise use theme defaults
  const textColor = (useTypography && fonts.priceColor) ? fonts.priceColor : (isDark ? '#ffffff' : '#000000');
  const mutedTextColor = (useTypography && fonts.metaColor) ? fonts.metaColor : (isDark ? '#a1a1aa' : '#666666');
  const addressTextColor = (useTypography && fonts.addressColor) ? fonts.addressColor : (isDark ? '#d4d4d8' : '#333333');
  const carouselBgColor = (overrideTheme && mapColors.mapBgColor) ? mapColors.mapBgColor : bgColor;
  const cardBgColor = (overrideTheme && mapColors.cardBgColor) ? mapColors.cardBgColor : (isDark ? '#18181b' : '#ffffff');
  const borderColor = (overrideTheme && mapColors.borderColor) ? mapColors.borderColor : (isDark ? '#3f3f46' : '#e5e5e5');
  
  // Badge colors with overrides
  const activeBadgeBg = badgeColors.activeBg || '#10b981';
  const pendingBadgeBg = badgeColors.pendingBg || '#f59e0b';
  const soldBadgeBg = badgeColors.soldBg || '#ef4444';
  const badgeFontColor = badgeColors.fontColor || '#ffffff';

  // State
  const [backendUrl, setBackendUrl] = useState<string>(FALLBACK_BACKEND_URL);
  const [backendUrlLoaded, setBackendUrlLoaded] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [responsiveItems, setResponsiveItems] = useState(itemsPerView);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth < 640) setResponsiveItems(1);
      else if (window.innerWidth < 1024) setResponsiveItems(Math.min(2, itemsPerView));
      else setResponsiveItems(itemsPerView);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [itemsPerView]);

  const carouselRef = useRef<HTMLDivElement>(null);

  // Fetch backend URL
  useEffect(() => {
    const init = async () => {
      const url = await fetchBackendUrl();
      setBackendUrl(url);
      setBackendUrlLoaded(true);
    };
    init();
  }, []);

  // Load properties
  const loadProperties = useCallback(async () => {
    if (!backendUrlLoaded) return;
    setLoading(true);

    try {
      const apiFilters: any = { sortOrder };

      // Apply URL-based pre-filters
      if (citiesParam.length > 0) apiFilters.cities = citiesParam;
      if (zonesParam.length > 0) apiFilters.zones = zonesParam;
      if (neighbourhoodsParam.length > 0) apiFilters.neighbourhoods = neighbourhoodsParam;
      if (propertyTypesParam.length > 0) apiFilters.PropertyType = propertyTypesParam;
      if (propertySubTypesParam.length > 0) apiFilters.PropertySubType = propertySubTypesParam;
      if (priceMinParam || priceMaxParam) {
        apiFilters.ListPrice = [
          priceMinParam ? parseInt(priceMinParam) : 0,
          priceMaxParam ? parseInt(priceMaxParam) : 50000000
        ];
      }
      if (bedsMinParam) apiFilters.BedroomsTotal = `${bedsMinParam}+`;
      if (bathsMinParam) apiFilters.BathroomsTotal = `${bathsMinParam}+`;
      if (hasOpenHouseParam) apiFilters.hasOpenHouse = true;
      if (hasVirtualTourParam) apiFilters.hasVirtualTour = true;

      console.log('📋 Carousel: Loading properties with filters:', apiFilters);

      const res = await fetch(`${backendUrl}/api/supabase/live-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: apiFilters, limit: maxItems })
      });

      const data = await res.json();
      if (data.success && data.data?.properties) {
        const mappedProps: Property[] = data.data.properties.map((p: any) => ({
          id: p.mls_number, mls_number: p.mls_number, address: p.address || `${p.street_number || ''} ${p.street_name || ''}`.trim(),
          city: p.city, province: p.state || 'AB', price: parseFloat(p.price) || 0,
          bedrooms: parseInt(p.bedrooms) || 0, bathrooms: parseInt(p.bathrooms) || 0,
          sqft: parseInt(p.sqft) || parseInt(p.square_feet) || 0,
          images: p.images || [], property_subtype: p.property_sub_type || p.property_type,
          listing_status: p.listing_status || 'active'
        }));
        setProperties(mappedProps);
      }
    } catch (err) { console.error('Load error:', err); }
    finally { setLoading(false); }
  }, [backendUrlLoaded, backendUrl, sortOrder, maxItems]);

  useEffect(() => { if (backendUrlLoaded) loadProperties(); }, [backendUrlLoaded, loadProperties]);

  // Auto play
  useEffect(() => {
    if (!autoPlay || properties.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + responsiveItems >= properties.length ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [autoPlay, properties.length, responsiveItems]);

  const getNextJsPropertyUrl = (property: Property): string => {
    // URL is always the same - no theme indicator
    const slug = generateMlsSlug(property);
    const agentParam = assignedAgentId ? `?agentId=${assignedAgentId}` : '';
    return `${NEXTJS_TEMPLATE_URL}/mls-property/${slug}${agentParam}`;
  };

  const handlePropertyClick = (property: Property) => {
    window.open(getNextJsPropertyUrl(property), openInNewWindow ? '_blank' : '_self');
  };

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex + responsiveItems < properties.length;

  const goToPrev = () => {
    if (canGoPrev) setCurrentIndex(prev => Math.max(0, prev - responsiveItems));
  };

  const goToNext = () => {
    if (canGoNext) setCurrentIndex(prev => Math.min(properties.length - responsiveItems, prev + responsiveItems));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" style={{ backgroundColor: bgColor }}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" style={{ backgroundColor: bgColor, color: mutedTextColor }}>
        No properties found
      </div>
    );
  }

  const containerPadding = bleed === 'right' ? 'pl-4 md:pl-8' : 'px-4 md:px-8';
  const itemWidth = bleed === 'right' ? `${100 / (responsiveItems + 0.5)}%` : `${100 / responsiveItems}%`;

  return (
    <div className="w-full py-8" style={{ backgroundColor: bgColor, color: textColor }}>
      <div className={`relative group ${containerPadding}`}>
        {/* Carousel Container */}
        <div ref={carouselRef} className="overflow-hidden">
          <div 
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${currentIndex * (100 / responsiveItems)}%)` }}
          >
            {properties.map(property => {
              const isMetaOverlay = cardStyle === 'meta-overlay';
              const isSideCard = listingStyle === 'side';
              return (
              <div 
                key={property.id} 
                className="flex-shrink-0 px-2"
                style={{ width: itemWidth }}
              >
                <div onClick={() => handlePropertyClick(property)} 
                  className="rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-xl h-full"
                  style={{ backgroundColor: cardBgColor, border: `1px solid ${borderColor}` }}>
                  <div className={isSideCard ? 'flex h-full' : ''}>
                  {/* Image */}
                  <div className={`overflow-hidden relative ${isSideCard ? 'w-2/5 flex-shrink-0' : ''}`} style={isSideCard ? {} : { aspectRatio: aspectCSS }}>
                    {property.images?.[0] ? (
                      <img src={property.images[0]} alt={property.address} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center" style={{ color: mutedTextColor }}>No Image</div>
                    )}
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="px-2 py-1 text-xs font-medium rounded text-white bg-black/70">{property.property_subtype || 'Property'}</span>
                      {property.listing_status && (
                        <span className={`px-2 py-1 text-xs font-medium rounded text-white ${property.listing_status === 'active' ? 'bg-green-600' : 'bg-yellow-500'}`}>
                          {property.listing_status.charAt(0).toUpperCase() + property.listing_status.slice(1)}
                        </span>
                      )}
                    </div>
                    {isMetaOverlay && (
                      <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                        <div className="text-xl font-bold text-white mb-0.5">{formatPrice(property.price)}</div>
                        <div className="text-white/80 text-sm truncate">{property.address}, {property.city}</div>
                        <div className="flex gap-4 mt-1 text-white/90 text-xs">
                          {property.bedrooms > 0 && <span>{property.bedrooms} Beds</span>}
                          {property.bathrooms > 0 && <span>{property.bathrooms} Baths</span>}
                          {property.sqft && property.sqft > 0 && <span>{property.sqft.toLocaleString()} Sqft</span>}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Details - only for meta-below */}
                  {!isMetaOverlay && (
                  <div className="p-4">
                    <div className="text-xl font-bold mb-1" style={{ color: textColor }}>{formatPrice(property.price)}</div>
                    <div className="text-sm mb-3 flex items-center gap-1" style={{ color: mutedTextColor }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {property.address}, {property.city}
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div><span className="font-semibold" style={{ color: textColor }}>{property.bedrooms}</span> <span style={{ color: mutedTextColor }}>Beds</span></div>
                      <div><span className="font-semibold" style={{ color: textColor }}>{property.bathrooms}</span> <span style={{ color: mutedTextColor }}>Baths</span></div>
                      {property.sqft && property.sqft > 0 && <div><span className="font-semibold" style={{ color: textColor }}>{property.sqft.toLocaleString()}</span> <span style={{ color: mutedTextColor }}>Sqft</span></div>}
                    </div>
                  </div>
                  )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Navigation Buttons */}
        <button 
          onClick={goToPrev}
          disabled={!canGoPrev}
          className={`absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed`}
          style={{ color: '#000' }}
        >
          <ChevronLeftIcon />
        </button>
        <button 
          onClick={goToNext}
          disabled={!canGoNext}
          className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed`}
          style={{ color: '#000' }}
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}
