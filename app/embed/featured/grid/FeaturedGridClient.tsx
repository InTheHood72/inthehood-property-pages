'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
  id: string; mls_number: string; address: string; city: string; province: string; price: number;
  bedrooms: number; bathrooms: number; square_feet: number; property_subtype: string; listing_type: string;
  listing_status: string; images: string[]; main_thumbnail: string; latitude: number; longitude: number;
  agent_name: string; postal_code: string; subdivision_name: string; presentation_settings?: any;
  selected_template?: string; agent_profile_image_url?: string;
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
    if (property.square_feet && property.square_feet > 0) meta.push({ label: 'Sqft', value: property.square_feet.toLocaleString() });
    return meta.length > 0 ? meta : [{ label: 'Land', value: propSubtype || 'Vacant Land' }];
  }
  if (isCommercial) {
    const meta: { label: string; value: string }[] = [];
    if (property.square_feet && property.square_feet > 0) meta.push({ label: 'Sqft', value: property.square_feet.toLocaleString() });
    if (property.lot_size && property.lot_size > 0) meta.push({ label: 'Lot Sqft', value: Math.round(property.lot_size).toLocaleString() });
    if (property.lot_size_acres && property.lot_size_acres > 0) meta.push({ label: 'Acres', value: parseFloat(String(property.lot_size_acres)).toFixed(2) });
    return meta.length > 0 ? meta : [{ label: 'Type', value: propSubtype || 'Commercial' }];
  }
  const meta: { label: string; value: string }[] = [];
  if (property.bedrooms > 0) meta.push({ label: 'Beds', value: String(property.bedrooms) });
  if (property.bathrooms > 0) meta.push({ label: 'Baths', value: String(property.bathrooms) });
  if (property.square_feet && property.square_feet > 0) meta.push({ label: 'Sqft', value: property.square_feet.toLocaleString() });
  return meta;
}

const CheckIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
);
const ChevronDownIcon = () => <svg className="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>;

function parseAspectRatio(ar: string): string {
  return ar.replace(':', '/');
}

export default function FeaturedGridClient() {
  const searchParams = useSearchParams();
  
  // URL Params
  const theme = searchParams.get('theme') || 'light';
  const userId = searchParams.get('userId');
  const userIds = searchParams.get('userIds')?.split(',').filter(Boolean);
  const propertyType = searchParams.get('propertyType') || 'both';
  const showFilters = searchParams.get('showFilters') !== 'false';
  const openInNewWindow = searchParams.get('openInNewWindow') !== 'false';
  const columns = parseInt(searchParams.get('columns') || '3');
  const maxItems = parseInt(searchParams.get('maxItems') || '50');
  const cardStyle = searchParams.get('cardStyle') || 'meta-below';
  const listingStyle = searchParams.get('listingStyle') || 'top';
  const aspectRatioRaw = searchParams.get('aspectRatio') || '16/9';
  const listingStatusFilter = searchParams.get('listingStatus') || 'active,pending';
  const sortOrderParam = searchParams.get('sortOrder') || 'date-desc';
  const pinnedListingsParam = searchParams.get('pinnedListings') || '';
  const selectedListingsParam = searchParams.get('selectedListings') || '';
  const aspectCSS = parseAspectRatio(aspectRatioRaw);
  const showStatusBadges = searchParams.get('showStatusBadges') === 'true';
  const useTypography = searchParams.get('useTypography') === 'true';
  const overrideTheme = searchParams.get('overrideTheme') === 'true';
  const thumbnailSource = searchParams.get('thumbnailSource') || 'standard';

  // Responsive columns from embed generator
  const columnsResponsive = (() => {
    try { return JSON.parse(decodeURIComponent(searchParams.get('columnsResponsive') || '{}')); }
    catch { return {}; }
  })();

  // Parse JSON params safely
  const fonts = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('fonts') || '{}')); } catch { return {}; } })();
  const badgeColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('badgeColors') || '{}')); } catch { return {}; } })();
  const mapColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('mapColors') || '{}')); } catch { return {}; } })();
  const overlayOpacity = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('overlayOpacity') || '{}')); } catch { return {}; } })();

  // State
  const [backendUrl, setBackendUrl] = useState<string>(FALLBACK_BACKEND_URL);
  const [backendUrlLoaded, setBackendUrlLoaded] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedBeds, setSelectedBeds] = useState<string>('any');
  const [selectedBaths, setSelectedBaths] = useState<string>('any');
  const [selectedSort, setSelectedSort] = useState<string>('newest');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 30000000]);
  const [tempPriceRange, setTempPriceRange] = useState<[number, number]>([0, 30000000]);
  const [priceApplied, setPriceApplied] = useState(false);
  const [minMaxPrices, setMinMaxPrices] = useState<{ min: number; max: number }>({ min: 0, max: 30000000 });

  // Theme / color resolution
  const isDark = theme === 'dark';
  const bgColor = overrideTheme && mapColors.mapBgColor ? mapColors.mapBgColor : (isDark ? '#09090b' : '#ffffff');
  const textColor = overrideTheme && mapColors.priceColor ? mapColors.priceColor : (isDark ? '#ffffff' : '#000000');
  const borderColor = isDark ? '#3f3f46' : '#e5e7eb';
  const cardBgColor = overrideTheme && mapColors.cardBgColor ? mapColors.cardBgColor : (isDark ? '#18181b' : '#ffffff');
  const mutedTextColor = overrideTheme && mapColors.metaColor ? mapColors.metaColor : (isDark ? '#a1a1aa' : '#6b7280');
  const addressColor = overrideTheme && mapColors.addressColor ? mapColors.addressColor : mutedTextColor;
  const filterBgColor = isDark ? '#27272a' : '#f5f5f5';

  // Font styles
  const priceStyleObj = useTypography && fonts.priceFont ? {
    fontFamily: `'${fonts.priceFont}', sans-serif`, fontWeight: fonts.priceFontWeight || '600',
    fontSize: `${fonts.priceFontSize || '18'}px`, letterSpacing: `${fonts.priceLetterSpacing || '0'}px`, color: fonts.priceColor || textColor,
  } : { color: textColor };
  const addressStyleObj = useTypography && fonts.addressFont ? {
    fontFamily: `'${fonts.addressFont}', sans-serif`, fontWeight: fonts.addressFontWeight || '400',
    fontSize: `${fonts.addressFontSize || '14'}px`, letterSpacing: `${fonts.addressLetterSpacing || '0'}px`, color: fonts.addressColor || addressColor,
  } : { color: addressColor };
  const metaStyleObj = useTypography && fonts.metaFont ? {
    fontFamily: `'${fonts.metaFont}', sans-serif`, fontWeight: fonts.metaFontWeight || '600',
    fontSize: `${fonts.metaFontSize || '14'}px`, letterSpacing: `${fonts.metaLetterSpacing || '0'}px`, color: fonts.metaColor || textColor,
  } : { color: textColor };
  const labelStyleObj = useTypography && fonts.labelFont ? {
    fontFamily: `'${fonts.labelFont}', sans-serif`, fontWeight: fonts.labelFontWeight || '400',
    fontSize: `${fonts.labelFontSize || '12'}px`, letterSpacing: `${fonts.labelLetterSpacing || '0'}px`, color: fonts.labelColor || mutedTextColor,
  } : { color: mutedTextColor };

  // Responsive columns
  const [responsiveColumns, setResponsiveColumns] = useState(columns);
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      if (w < 640) setResponsiveColumns(columnsResponsive.mobile || 1);
      else if (w < 768) setResponsiveColumns(columnsResponsive.mobile || 1);
      else if (w < 1024) setResponsiveColumns(columnsResponsive.tablet || 2);
      else if (w < 1366) setResponsiveColumns(columnsResponsive.laptop || Math.min(3, columns));
      else setResponsiveColumns(columnsResponsive.desktop || columns);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [columns, columnsResponsive]);

  useEffect(() => {
    const init = async () => { const url = await fetchBackendUrl(); setBackendUrl(url); setBackendUrlLoaded(true); };
    init();
  }, []);

  const formatFullPrice = (price: number): string => `$${Math.round(price).toLocaleString()}`;
  const formatCurrency = (v: number) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`;

  const generateSlug = (p: Property): string => {
    const parts = [p.mls_number, p.address, p.city, p.province || 'Alberta', p.postal_code];
    if (p.subdivision_name && p.subdivision_name.toUpperCase() !== 'NONE') parts.push(p.subdivision_name);
    return parts.filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  };
  const getPropertyUrl = (p: Property): string => `${NEXTJS_TEMPLATE_URL}/featured-property/${generateSlug(p)}`;

  const typeOptions = useMemo(() => {
    if (properties.length === 0) return [{ label: 'All types', value: 'all' }];
    const typesSet = new Set<string>();
    properties.forEach(p => { let subtype = p.property_subtype || 'House'; if (subtype.toLowerCase() === 'detached') subtype = 'House'; typesSet.add(subtype); });
    return [{ label: 'All types', value: 'all' }, ...Array.from(typesSet).sort().map(t => ({ label: t, value: t.toLowerCase() }))];
  }, [properties]);

  const bedOptions = [{ label: 'Any', value: 'any' }, { label: '1+', value: '1' }, { label: '2+', value: '2' }, { label: '3+', value: '3' }, { label: '4+', value: '4' }, { label: '5+', value: '5' }];
  const bathOptions = [{ label: 'Any', value: 'any' }, { label: '1+', value: '1' }, { label: '2+', value: '2' }, { label: '3+', value: '3' }, { label: '4+', value: '4' }];
  const sortOptions = [{ label: 'Newest', value: 'newest' }, { label: 'Price low to high', value: 'price_asc' }, { label: 'Price high to low', value: 'price_desc' }, { label: 'Beds low to high', value: 'beds_asc' }, { label: 'Beds high to low', value: 'beds_desc' }];

  useEffect(() => {
    if (initialLoadDone || !backendUrlLoaded) return;
    const loadProps = async () => {
      setLoading(true);
      try {
        const allUserIds = [...(userId ? [userId] : []), ...(userIds || [])].filter(Boolean);
        if (allUserIds.length === 0) { setLoading(false); setInitialLoadDone(true); return; }
        const res = await fetch(`${backendUrl}/api/featured-properties?user_ids=${allUserIds.join(',')}&listing_status=${listingStatusFilter}&sort_order=${sortOrderParam}${pinnedListingsParam ? `&pinned_listings=${pinnedListingsParam}` : ''}${selectedListingsParam ? `&selected_listings=${selectedListingsParam}` : ''}`);        const data = await res.json();
        if (data.properties) {
          let propsData = data.properties.filter((p: any) => p.latitude && p.longitude);
          if (propertyType === 'for_sale') propsData = propsData.filter((p: any) => p.listing_type === 'sale' || !p.listing_type);
          else if (propertyType === 'for_rent') propsData = propsData.filter((p: any) => p.listing_type === 'rent');
          const props: Property[] = propsData.map((p: any) => ({
            id: p.id, mls_number: p.mls_number, address: p.address, city: p.city, province: p.province || 'AB',
            price: p.listing_type === 'rent' ? p.rent_price : p.price,
            bedrooms: p.bedrooms || 0, bathrooms: p.bathrooms || 0,
            square_feet: p.square_feet || p.sqft || 0,
            property_subtype: p.property_subtype || p.building_type || 'House', listing_type: p.listing_type || 'sale',
            property_type: p.property_type || '', property_sub_type: p.property_sub_type || p.property_subtype || '',
            lot_size: p.lot_size || p.lot_size_sqft || 0, lot_size_acres: p.lot_size_acres || 0,
            listing_status: p.listing_status || 'active', images: p.images || [], main_thumbnail: p.main_thumbnail,
            latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude), agent_name: p.agent_name || 'Agent',
            postal_code: p.postal_code, subdivision_name: p.subdivision_name,
            presentation_settings: p.presentation_settings, selected_template: p.selected_template,
            agent_profile_image_url: p.agent_profile_image_url,
            creative_video_thumbnail: p.creative_video_thumbnail || null,
            creative_hero_image: p.creative_hero_image || null,
            co_list_agent_name: p.co_list_agent_name, co_listing_agent_profiles: p.co_listing_agent_profiles || []
          }));
          const prices = props.map(p => p.price).filter(p => p > 0);
          if (prices.length > 0) {
            const minP = Math.floor(Math.min(...prices) / 10000) * 10000;
            const maxP = Math.ceil(Math.max(...prices) / 10000) * 10000;
            setMinMaxPrices({ min: minP, max: maxP }); setPriceRange([minP, maxP]); setTempPriceRange([minP, maxP]);
          }
          setProperties(props); setFilteredProperties(props);
        }
      } catch (e) { console.error('Load error:', e); }
      finally { setLoading(false); setInitialLoadDone(true); }
    };
    loadProps();
  }, [userId, userIds, propertyType, initialLoadDone, backendUrlLoaded, backendUrl]);

  useEffect(() => {
    let filtered = [...properties];
    if (selectedType !== 'all') filtered = filtered.filter(p => { const subtype = p.property_subtype?.toLowerCase() === 'detached' ? 'house' : (p.property_subtype || 'house').toLowerCase(); return subtype === selectedType; });
    if (selectedBeds !== 'any') filtered = filtered.filter(p => p.bedrooms >= parseInt(selectedBeds));
    if (selectedBaths !== 'any') filtered = filtered.filter(p => p.bathrooms >= parseInt(selectedBaths));
    if (priceApplied) filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    switch (selectedSort) {
      case 'price_asc': filtered.sort((a, b) => a.price - b.price); break;
      case 'price_desc': filtered.sort((a, b) => b.price - a.price); break;
      case 'beds_asc': filtered.sort((a, b) => a.bedrooms - b.bedrooms); break;
      case 'beds_desc': filtered.sort((a, b) => b.bedrooms - a.bedrooms); break;
    }
    setFilteredProperties(filtered.slice(0, maxItems));
  }, [properties, selectedType, selectedBeds, selectedBaths, selectedSort, priceApplied, priceRange, maxItems]);

  const getTypeLabel = () => selectedType === 'all' ? 'Property Type' : typeOptions.find(o => o.value === selectedType)?.label || selectedType;
  const getPriceLabel = () => priceApplied ? `${formatCurrency(priceRange[0])} - ${formatCurrency(priceRange[1])}` : 'Price';
  const getBedLabel = () => selectedBeds === 'any' ? 'Beds' : `${selectedBeds}+ Beds`;
  const getBathLabel = () => selectedBaths === 'any' ? 'Baths' : `${selectedBaths}+ Baths`;
  const getSortLabel = () => sortOptions.find(o => o.value === selectedSort)?.label || 'Sort';
  const hasActiveFilters = selectedType !== 'all' || selectedBeds !== 'any' || selectedBaths !== 'any' || priceApplied || selectedSort !== 'newest';

  const handleMinSliderChange = (value: number) => { if (value < tempPriceRange[1]) setTempPriceRange([value, tempPriceRange[1]]); };
  const handleMaxSliderChange = (value: number) => { if (value > tempPriceRange[0]) setTempPriceRange([tempPriceRange[0], value]); };
  const applyPriceFilter = () => { setPriceRange(tempPriceRange); setPriceApplied(true); setOpenFilter(null); };
  const resetPriceFilter = () => { setTempPriceRange([minMaxPrices.min, minMaxPrices.max]); setPriceApplied(false); setOpenFilter(null); };
  const resetAllFilters = () => { setSelectedType('all'); setSelectedBeds('any'); setSelectedBaths('any'); setSelectedSort('newest'); setPriceApplied(false); setTempPriceRange([minMaxPrices.min, minMaxPrices.max]); };

  const getStatusBadgeStyle = (status: string) => {
    if (!showStatusBadges) return null;
    const bg = status === 'active' ? (badgeColors.activeBg || '#22c55e') : status === 'pending' ? (badgeColors.pendingBg || '#eab308') : (badgeColors.soldBg || '#ef4444');
    return { backgroundColor: bg, color: badgeColors.fontColor || '#ffffff' };
  };

  const allUserIds = [...(userId ? [userId] : []), ...(userIds || [])].filter(Boolean);

  const getPropertyImage = (property: Property): string => {
    if (thumbnailSource === 'studio') {
      // Card layouts always use the poster thumbnail (2:3 design)
      // The banner (16:9) is only for the showcase hover state
      if (property.creative_video_thumbnail) return property.creative_video_thumbnail;
      if (property.creative_hero_image) return property.creative_hero_image;
    }
    return property.main_thumbnail || property.images?.[0] || '/placeholder.svg';
  };

  if (allUserIds.length === 0) {
    return <div className="flex items-center justify-center min-h-[400px]" style={{ backgroundColor: bgColor, color: mutedTextColor }}>No user specified.</div>;
  }

  const isSideCard = listingStyle === 'side';
  const isMetaOverlay = cardStyle === 'meta-overlay';

  // Google Fonts
  const fontFamilies = useTypography ? [fonts.priceFont, fonts.addressFont, fonts.metaFont, fonts.labelFont].filter(Boolean) : [];
  const uniqueFonts = [...new Set(fontFamilies)];

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: bgColor, fontFamily: 'Jost, sans-serif' }}>
      {uniqueFonts.length > 0 && (
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${uniqueFonts.map(f => `family=${f.replace(/\s+/g, '+')}:wght@300;400;600;700`).join('&')}&display=swap`} />
      )}
      <style>{`
        input[type="range"] { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; background: #000; cursor: pointer; margin-top: -8px; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        input[type="range"]::-moz-range-thumb { height: 20px; width: 20px; border-radius: 50%; background: #000; cursor: pointer; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        input[type="range"]::-webkit-slider-runnable-track { height: 4px; background: transparent; }
        input[type="range"]::-moz-range-track { height: 4px; background: transparent; }
      `}</style>

      <div className="max-w-[1600px] mx-auto p-4 md:p-8">
        {/* Filter Pills */}
        {showFilters && (
          <div className="relative mb-6">
            <div className="relative flex flex-wrap gap-2 items-center">
              <button onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: openFilter === 'type' ? '#1a1a1a' : filterBgColor, color: openFilter === 'type' ? '#fff' : textColor }}>{getTypeLabel()}<ChevronDownIcon /></button>
              <button onClick={() => setOpenFilter(openFilter === 'price' ? null : 'price')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: openFilter === 'price' ? '#1a1a1a' : filterBgColor, color: openFilter === 'price' ? '#fff' : textColor }}>{getPriceLabel()}<ChevronDownIcon /></button>
              <button onClick={() => setOpenFilter(openFilter === 'beds' ? null : 'beds')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: openFilter === 'beds' ? '#1a1a1a' : filterBgColor, color: openFilter === 'beds' ? '#fff' : textColor }}>{getBedLabel()}<ChevronDownIcon /></button>
              <button onClick={() => setOpenFilter(openFilter === 'baths' ? null : 'baths')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: openFilter === 'baths' ? '#1a1a1a' : filterBgColor, color: openFilter === 'baths' ? '#fff' : textColor }}>{getBathLabel()}<ChevronDownIcon /></button>
              <button onClick={() => setOpenFilter(openFilter === 'sort' ? null : 'sort')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: openFilter === 'sort' ? '#1a1a1a' : filterBgColor, color: openFilter === 'sort' ? '#fff' : textColor }}>{getSortLabel()}<ChevronDownIcon /></button>
              {hasActiveFilters && <button onClick={resetAllFilters} className="text-sm underline whitespace-nowrap ml-1" style={{ color: mutedTextColor }}>reset filters</button>}
            </div>
            {openFilter && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setOpenFilter(null)} />
                <div className="absolute left-0 mt-3 p-4 rounded-[24px] shadow-lg border z-30" style={{ backgroundColor: cardBgColor, borderColor, maxWidth: openFilter === 'price' ? '480px' : openFilter === 'baths' ? '440px' : undefined }}>
                  {openFilter === 'type' && (
                    <div className="flex flex-wrap gap-2">{typeOptions.map(opt => { const isSelected = selectedType === opt.value; return (<button key={opt.value} onClick={() => { setSelectedType(opt.value); setOpenFilter(null); }} className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2" style={{ fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}><div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>{isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}</div>{opt.label}</button>); })}</div>
                  )}
                  {openFilter === 'price' && (
                    <div className="space-y-4" style={{ width: '440px' }}>
                      <h3 className="text-lg font-bold" style={{ color: textColor }}>Price</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-sm font-semibold" style={{ color: textColor }}>From</label><input type="number" value={tempPriceRange[0] === minMaxPrices.min ? '' : tempPriceRange[0]} onChange={(e) => setTempPriceRange([e.target.value === '' ? minMaxPrices.min : parseInt(e.target.value), tempPriceRange[1]])} placeholder="Min" className="w-full px-3 py-2 text-base rounded-lg border" style={{ backgroundColor: cardBgColor, color: textColor, borderColor }} /></div>
                        <div className="space-y-2"><label className="text-sm font-semibold" style={{ color: textColor }}>To</label><input type="number" value={tempPriceRange[1] === minMaxPrices.max ? '' : tempPriceRange[1]} onChange={(e) => setTempPriceRange([tempPriceRange[0], e.target.value === '' ? minMaxPrices.max : parseInt(e.target.value)])} placeholder="Max" className="w-full px-3 py-2 text-base rounded-lg border" style={{ backgroundColor: cardBgColor, color: textColor, borderColor }} /></div>
                      </div>
                      <div className="relative h-6 mt-4">
                        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full"></div>
                        <div className="absolute top-1/2 -translate-y-1/2 h-2 bg-black rounded-full" style={{ left: `${((tempPriceRange[0] - minMaxPrices.min) / (minMaxPrices.max - minMaxPrices.min)) * 100}%`, right: `${100 - ((tempPriceRange[1] - minMaxPrices.min) / (minMaxPrices.max - minMaxPrices.min)) * 100}%` }}></div>
                        <input type="range" min={minMaxPrices.min} max={minMaxPrices.max} step={10000} value={tempPriceRange[0]} onChange={(e) => handleMinSliderChange(parseInt(e.target.value))} className="absolute w-full h-6 appearance-none bg-transparent cursor-pointer" style={{ zIndex: 10 }} />
                        <input type="range" min={minMaxPrices.min} max={minMaxPrices.max} step={10000} value={tempPriceRange[1]} onChange={(e) => handleMaxSliderChange(parseInt(e.target.value))} className="absolute w-full h-6 appearance-none bg-transparent cursor-pointer" style={{ zIndex: 11, clipPath: `inset(0 0 0 ${((tempPriceRange[0] + tempPriceRange[1]) / 2 / minMaxPrices.max) * 100}%)` }} />
                      </div>
                      <div className="flex justify-between text-sm" style={{ color: mutedTextColor }}><span>{formatCurrency(tempPriceRange[0])}</span><span>{formatCurrency(tempPriceRange[1])}</span></div>
                      <div className="flex gap-2 pt-2"><button onClick={resetPriceFilter} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100" style={{ borderColor, color: textColor }}>Reset</button><button onClick={applyPriceFilter} className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800">Apply</button></div>
                    </div>
                  )}
                  {openFilter === 'beds' && (<div className="flex flex-wrap gap-2">{bedOptions.map(opt => { const isSelected = selectedBeds === opt.value; return (<button key={opt.value} onClick={() => { setSelectedBeds(opt.value); setOpenFilter(null); }} className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2" style={{ fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}><div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>{isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}</div>{opt.label}</button>); })}</div>)}
                  {openFilter === 'baths' && (<div className="flex flex-wrap gap-2">{bathOptions.map(opt => { const isSelected = selectedBaths === opt.value; return (<button key={opt.value} onClick={() => { setSelectedBaths(opt.value); setOpenFilter(null); }} className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2" style={{ fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}><div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>{isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}</div>{opt.label}</button>); })}</div>)}
                  {openFilter === 'sort' && (<div className="flex flex-wrap gap-2">{sortOptions.map(opt => { const isSelected = selectedSort === opt.value; return (<button key={opt.value} onClick={() => { setSelectedSort(opt.value); setOpenFilter(null); }} className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2" style={{ fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}><div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>{isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}</div>{opt.label}</button>); })}</div>)}
                </div>
              </>
            )}
          </div>
        )}

        {/* Results */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold" style={{ color: textColor }}>Properties</h2>
          <p className="text-sm" style={{ color: mutedTextColor }}>{loading ? 'Loading...' : `Showing ${filteredProperties.length} properties`}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div></div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-16" style={{ color: mutedTextColor }}>No properties found</div>
        ) : isSideCard ? (
          /* === SIDE CARD LAYOUT === */
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(responsiveColumns, 2)}, minmax(0, 1fr))` }}>
            {filteredProperties.map(property => (
              <div key={property.id} onClick={() => window.open(getPropertyUrl(property), openInNewWindow ? '_blank' : '_self')}
                className="rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-xl flex"
                style={{ backgroundColor: cardBgColor, border: `1px solid ${borderColor}` }}>
                <div className="relative flex-shrink-0 overflow-hidden" style={{ width: '45%', aspectRatio: aspectCSS }}>
                  <img src={getPropertyImage(property)} alt={property.address} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                  <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff' }}>{property.property_subtype === 'Detached' ? 'House' : property.property_subtype}</span>
                  {property.listing_type === 'rent' && <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded bg-blue-600 text-white">For Rent</span>}
                  {showStatusBadges && property.listing_status && <div className="absolute bottom-2 left-2"><span className="px-2 py-0.5 text-xs font-bold rounded capitalize" style={getStatusBadgeStyle(property.listing_status) || {}}>{property.listing_status === 'pending' ? 'Active' : property.listing_status}</span></div>}
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="text-xl font-bold mb-1" style={priceStyleObj}>{formatFullPrice(property.price)}</div>
                    <div className="flex items-start gap-1 mb-2">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="#6B7280"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      <span className="text-sm line-clamp-2" style={addressStyleObj}>{property.address}, {property.city}</span>
                    </div>
                    <div className="flex gap-6 text-sm">
                      {getSmartMeta(property).map((m, i) => (
                        <div key={i} className="flex flex-col"><span className="font-bold" style={metaStyleObj}>{m.value}</span><span style={labelStyleObj}>{m.label}</span></div>
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
            ))}
          </div>
        ) : (
          /* === TOP CARD LAYOUT (default) === */
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${responsiveColumns}, minmax(0, 1fr))` }}>
            {filteredProperties.map(property => (
              <div key={property.id} onClick={() => window.open(getPropertyUrl(property), openInNewWindow ? '_blank' : '_self')}
                className="rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-xl"
                style={{ backgroundColor: cardBgColor, border: `1px solid ${borderColor}` }}>
                <div className={`${isMetaOverlay ? 'relative' : ''} overflow-hidden`} style={{ aspectRatio: aspectCSS }}>
                  <img src={getPropertyImage(property)} alt={property.address} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                  <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff' }}>{property.property_subtype === 'Detached' ? 'House' : property.property_subtype}</span>
                  {property.listing_type === 'rent' && <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded bg-blue-600 text-white">For Rent</span>}
                  {showStatusBadges && property.listing_status && <div className="absolute bottom-2 left-2"><span className="px-2 py-0.5 text-xs font-bold rounded capitalize" style={getStatusBadgeStyle(property.listing_status) || {}}>{property.listing_status === 'pending' ? 'Active' : property.listing_status}</span></div>}
                  {isMetaOverlay && (
                    <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                      <div className="text-xl font-bold text-white mb-0.5" style={useTypography && fonts.priceFont ? { ...priceStyleObj, color: fonts.priceColor || '#ffffff' } : {}}>{formatFullPrice(property.price)}</div>
                      <div className="text-white/80 text-sm truncate" style={useTypography && fonts.addressFont ? { ...addressStyleObj, color: fonts.addressColor || 'rgba(255,255,255,0.8)' } : {}}>{property.address}, {property.city}</div>
                      <div className="flex gap-4 mt-1 text-white/90 text-xs">
                        {getSmartMeta(property).map((m, i) => (
                          <span key={i}>{m.value} {m.label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {!isMetaOverlay && (
                <div className="p-4">
                  <div className="text-xl font-bold mb-1" style={priceStyleObj}>{formatFullPrice(property.price)}</div>
                  <div className="flex items-start gap-1 mb-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="#6B7280"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    <span className="text-sm line-clamp-2" style={addressStyleObj}>{property.address}, {property.city}</span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    {getSmartMeta(property).map((m, i) => (
                      <div key={i} className="flex flex-col"><span className="font-bold" style={metaStyleObj}>{m.value}</span><span style={labelStyleObj}>{m.label}</span></div>
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
                            {co.profile_image_url ? <img src={co.profile_image_url} alt={co.full_name} className="w-5 h-5 rounded-full object-cover" /> : <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', color: mutedTextColor }}>{(co.full_name || 'C').charAt(0)}</div>}
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
                )}
                {isMetaOverlay && (
                  <div className="flex items-center gap-2 px-3 py-2">
                    {property.agent_profile_image_url ? (
                      <img src={property.agent_profile_image_url} alt={property.agent_name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', color: mutedTextColor }}>{(property.agent_name || 'A').charAt(0).toUpperCase()}</div>
                    )}
                    <span className="text-xs truncate" style={{ color: mutedTextColor }}>{property.agent_name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
