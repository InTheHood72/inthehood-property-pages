'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';

// ============ CONSTANTS ============
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const FALLBACK_BACKEND_URL = 'https://api-production-531c.up.railway.app';

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

const NEXTJS_TEMPLATE_URL = 'https://in-the-hood-io-5dmw.vercel.app';

interface FilterConfig {
  id: string; label: string; field: string; type: 'dropdown' | 'slider' | 'sort';
  options?: { label: string; value: string }[]; min?: number; max?: number; step?: number;
  enabled: boolean; order: number; autoPopulate?: boolean; multiSelect?: boolean;
}

interface SearchSuggestion { label: string; value: string; type: 'city' | 'neighbourhood' | 'address' | 'mls'; }

const CheckIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
);

const ChevronDownIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
);

const CloseIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

// Generate SEO-friendly slug for MLS properties
// Format: {mls_number}-{address}-{neighbourhood}-{city}
const generateMlsSlug = (property: any): string => {
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

export default function Pillar9GridClient() {
  const searchParams = useSearchParams();

  // URL Parameters - Core
  const theme = searchParams.get('theme') || 'light';
  const listingTheme = searchParams.get('listingTheme') || searchParams.get('theme') || 'light'; // Template theme for property links (air vs air-dark)
  const columns = parseInt(searchParams.get('columns') || '3');
  const showFilters = searchParams.get('showFilters') !== 'false';
  const openInNewWindow = searchParams.get('openInNewWindow') !== 'false';
  const assignedAgentId = searchParams.get('agentId');
  const itemsPerPage = parseInt(searchParams.get('itemsPerPage') || '21');
  const maxItems = parseInt(searchParams.get('maxItems') || '21'); // Default max items to 21
  const paginationType = searchParams.get('paginationType') || 'none'; // Default no pagination
  const sortOrder = searchParams.get('sortOrder') || 'latest';
  const showStatusBadges = searchParams.get('showStatusBadges') !== 'false';
  const cardStyle = searchParams.get('cardStyle') || 'meta-below';
  const listingStyle = searchParams.get('listingStyle') || 'top';
  const aspectRatio = searchParams.get('aspectRatio') || '16:10';
  const aspectCSS = aspectRatio.replace(':', '/');
  const bgColorParam = searchParams.get('bgColor') || '';
  const useTypography = searchParams.get('useTypography') === 'true';

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

  // Parse JSON params safely
  const fonts = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('fonts') || '{}')); } catch { return {}; } })();
  const mapColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('mapColors') || '{}')); } catch { return {}; } })();
  const badgeColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('badgeColors') || '{}')); } catch { return {}; } })();

  const isDark = theme === 'dark';
  
  // Compute colors - use overrides if provided, otherwise use theme defaults
  const textColor = (useTypography && fonts.priceColor) ? fonts.priceColor : (isDark ? '#ffffff' : '#000000');
  const mutedTextColor = (useTypography && fonts.metaColor) ? fonts.metaColor : (isDark ? '#a1a1aa' : '#666666');
  const addressTextColor = (useTypography && fonts.addressColor) ? fonts.addressColor : (isDark ? '#d4d4d8' : '#333333');
  const bgColor = (overrideTheme && mapColors.mapBgColor) ? mapColors.mapBgColor : (isDark ? '#09090b' : '#ffffff');
  const cardBgColor = (overrideTheme && mapColors.cardBgColor) ? mapColors.cardBgColor : (isDark ? '#18181b' : '#ffffff');
  const borderColor = (overrideTheme && mapColors.borderColor) ? mapColors.borderColor : (isDark ? '#3f3f46' : '#e5e5e5');
  const filterBgColor = (overrideTheme && mapColors.filterBgColor) ? mapColors.filterBgColor : (isDark ? '#27272a' : '#f5f5f5');
  const filterFontColor = (overrideTheme && mapColors.filterFontColor) ? mapColors.filterFontColor : (isDark ? '#ffffff' : '#000000');
  const filterBorderColor = (overrideTheme && mapColors.filterBorderColor) ? mapColors.filterBorderColor : (isDark ? '#3f3f46' : '#e5e5e5');
  const dropdownBgColor = (overrideTheme && mapColors.dropdownBgColor) ? mapColors.dropdownBgColor : (isDark ? '#27272a' : '#ffffff');
  const dropdownHoverColor = (overrideTheme && mapColors.dropdownHoverColor) ? mapColors.dropdownHoverColor : (isDark ? '#3f3f46' : '#f5f5f5');
  
  // Badge colors with overrides
  const activeBadgeBg = badgeColors.activeBg || '#10b981';
  const pendingBadgeBg = badgeColors.pendingBg || '#f59e0b';
  const soldBadgeBg = badgeColors.soldBg || '#ef4444';
  const badgeFontColor = badgeColors.fontColor || '#ffffff';

  // Dynamic backend URL
  const [backendUrl, setBackendUrl] = useState<string>(FALLBACK_BACKEND_URL);
  const [backendUrlLoaded, setBackendUrlLoaded] = useState(false);

  // State
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // CRITICAL: filters now stores cities/neighbourhoods/addresses DIRECTLY just like the map
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [filterConfig, setFilterConfig] = useState<FilterConfig[]>([]);
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchSuggestion[]>([]);

  // Multi-select state
  const [multiSelectValues, setMultiSelectValues] = useState<Record<string, string[]>>({});
  const [allSubTypeOptions, setAllSubTypeOptions] = useState<{ label: string; value: string }[]>([]);

  // More Filters Modal state
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [moreFiltersTemp, setMoreFiltersTemp] = useState<Record<string, any>>({});

  // PropertyType to SubType mapping
  const propertySubTypeMapping: Record<string, string[]> = {
    'Residential': ['Apartment', 'Detached', 'Full Duplex', 'Mobile', 'Multi Family', 'Row/Townhouse', 'Semi Detached (Half Duplex)'],
    'Commercial': ['Business', 'Hotel/Motel', 'Industrial', 'Mixed Use', 'Office', 'Recreational', 'Retail', 'Warehouse'],
    'Land': ['Agriculture', 'Commercial Land', 'Industrial Land', 'Residential Land', 'Land'],
  };

  // Slider state
  const [sliderValues, setSliderValues] = useState<Record<string, [number, number]>>({});
  const [tempSliderValues, setTempSliderValues] = useState<Record<string, [number, number]>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Responsive columns
  const getResponsiveColumns = () => {
    if (typeof window === 'undefined') return columns;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 1024) return 2;
    return columns;
  };

  const [responsiveColumns, setResponsiveColumns] = useState(columns);

  useEffect(() => {
    const handleResize = () => setResponsiveColumns(getResponsiveColumns());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [columns]);

  // ============ FETCH BACKEND URL ============
  useEffect(() => {
    const init = async () => {
      const url = await fetchBackendUrl();
      setBackendUrl(url);
      setBackendUrlLoaded(true);
    };
    init();
  }, []);

  // ============ INITIALIZE FILTERS FROM URL PARAMS ============
  useEffect(() => {
    const initialFilters: Record<string, any> = {};
    
    // Geographic filters
    if (citiesParam.length > 0) initialFilters.cities = citiesParam;
    if (zonesParam.length > 0) initialFilters.zones = zonesParam;
    if (neighbourhoodsParam.length > 0) initialFilters.neighbourhoods = neighbourhoodsParam;
    
    // Property type filters
    if (propertyTypesParam.length > 0) initialFilters.PropertyType = propertyTypesParam;
    if (propertySubTypesParam.length > 0) initialFilters.PropertySubType = propertySubTypesParam;
    
    // Price filters
    if (priceMinParam || priceMaxParam) {
      initialFilters.ListPrice = [
        priceMinParam ? parseInt(priceMinParam) : 0,
        priceMaxParam ? parseInt(priceMaxParam) : 50000000
      ];
    }
    
    // Bed/bath filters
    if (bedsMinParam) initialFilters.BedroomsTotal = `${bedsMinParam}+`;
    if (bathsMinParam) initialFilters.BathroomsTotal = `${bathsMinParam}+`;
    
    // Special features
    if (hasOpenHouseParam) initialFilters.hasOpenHouse = true;
    if (hasVirtualTourParam) initialFilters.hasVirtualTour = true;
    
    // Only set if we have filters from URL
    if (Object.keys(initialFilters).length > 0) {
      console.log('📋 Grid: Initializing filters from URL params:', initialFilters);
      setFilters(initialFilters);
    }
  }, []); // Run once on mount

  // ============ LOAD FILTER CONFIG ============
  useEffect(() => {
    if (!backendUrlLoaded) return;
    
    const loadFilterConfig = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/mls-filter-config`);
        const data = await res.json();
        if (data.filters) {
          let config = [...data.filters];
          
          const propertyTypeFilter = config.find((f: FilterConfig) => f.field === 'PropertyType');
          const propertySubTypeFilter = config.find((f: FilterConfig) => f.field === 'PropertySubType');
          
          if (propertyTypeFilter?.autoPopulate) {
            try {
              const res = await fetch(`${backendUrl}/api/supabase/filter-options/PropertyType`);
              const data = await res.json();
              if (data?.success && data.options) {
                propertyTypeFilter.options = [{ label: 'All types', value: 'all' }, ...data.options.map((opt: string) => ({ label: opt, value: opt }))];
              }
            } catch (e) {}
          }
          
          if (propertySubTypeFilter?.autoPopulate) {
            try {
              const res = await fetch(`${backendUrl}/api/supabase/filter-options/PropertySubType`);
              const data = await res.json();
              if (data?.success && data.options) {
                const subTypeOpts = [{ label: 'All types', value: 'all' }, ...data.options.map((opt: string) => ({ label: opt, value: opt }))];
                propertySubTypeFilter.options = subTypeOpts;
                setAllSubTypeOptions(subTypeOpts);
              }
            } catch (e) {}
          }
          
          setFilterConfig(config);
          
          const initialSliders: Record<string, [number, number]> = {};
          config.forEach((f: FilterConfig) => {
            if (f.type === 'slider') initialSliders[f.field] = [f.min || 0, f.max || 100];
          });
          setSliderValues(initialSliders);
          setTempSliderValues(initialSliders);
        }
      } catch (err) { console.error('Filter config error:', err); }
    };
    
    try {
      const saved = localStorage.getItem('recentPropertySearches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch (e) {}
    
    loadFilterConfig();
  }, [backendUrlLoaded, backendUrl]);

  // Filter helpers - Main filters (order < 100) excluding Sort
  const mainFilterFields = ['PropertyType', 'PropertySubType', 'ListPrice', 'BedroomsTotal', 'BathroomsTotal'];
  const mainFilters = filterConfig.filter(f => f.enabled && mainFilterFields.includes(f.field) && f.type !== 'sort').sort((a, b) => a.order - b.order);
  const sortFilter = filterConfig.find(f => f.type === 'sort' && f.enabled);
  
  // More Filters (order >= 100) - Square Feet, Year Built, Lot Size, Garage Spaces
  const moreFiltersConfig = filterConfig.filter(f => f.enabled && f.order >= 100);

  const formatCurrency = (v: number) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`;
  const formatFullPrice = (price: number) => `$${Math.round(price).toLocaleString()}`;
  const formatNumber = (v: number) => v.toLocaleString();

  // ============ LOAD PROPERTIES - EXACT SAME LOGIC AS MAP ============
  const loadProperties = useCallback(async (page = 1, append = false) => {
    if (!backendUrlLoaded) return;
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      // CRITICAL: Spread filters directly, same as map
      const apiFilters: any = { ...filters };
      
      // Convert filter format for API - EXACT SAME AS MAP
      if (apiFilters.PropertyType) {
        apiFilters.propertyTypes = Array.isArray(apiFilters.PropertyType) 
          ? apiFilters.PropertyType : [apiFilters.PropertyType];
        delete apiFilters.PropertyType;
      }
      if (apiFilters.PropertySubType) {
        apiFilters.propertySubTypes = Array.isArray(apiFilters.PropertySubType) 
          ? apiFilters.PropertySubType : [apiFilters.PropertySubType];
        delete apiFilters.PropertySubType;
      }
      if (apiFilters.ListPrice) {
        if (Array.isArray(apiFilters.ListPrice)) {
          apiFilters.priceMin = apiFilters.ListPrice[0];
          apiFilters.priceMax = apiFilters.ListPrice[1];
        } else if (typeof apiFilters.ListPrice === 'object') {
          apiFilters.priceMin = apiFilters.ListPrice.min;
          apiFilters.priceMax = apiFilters.ListPrice.max;
        }
        delete apiFilters.ListPrice;
      }
      if (apiFilters.BedroomsTotal && apiFilters.BedroomsTotal !== 'any') {
        apiFilters.bedsMin = parseInt(String(apiFilters.BedroomsTotal).replace('+', ''));
        delete apiFilters.BedroomsTotal;
      }
      if (apiFilters.BathroomsTotal && apiFilters.BathroomsTotal !== 'any') {
        apiFilters.bathsMin = parseInt(String(apiFilters.BathroomsTotal).replace('+', ''));
        delete apiFilters.BathroomsTotal;
      }
      
      // cities, neighbourhoods, addresses are already in the correct format from search selection
      // No need to transform them - they're already arrays like { cities: ['Cochrane'] }

      console.log('📡 Grid API Request filters:', apiFilters);

      // Use maxItems as the limit for the API call
      const effectiveLimit = maxItems > 0 ? maxItems : 21;

      const res = await fetch(`${backendUrl}/api/supabase/live-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filters: apiFilters, 
          page, 
          limit: effectiveLimit,
          sortOrder: filters.sort || sortOrder
        })
      });

      const data = await res.json();
      console.log('📡 Grid API Response - Total:', data.pagination?.total_items, 'Properties:', data.data?.properties?.length);
      
      if (data.success && data.data?.properties) {
        const mappedProps = data.data.properties.map((p: any) => ({
          mls_number: p.mls_number, 
          address: p.address || `${p.street_number || ''} ${p.street_name || ''}`.trim(),
          city: p.city, 
          state: p.state || 'AB', 
          subdivision: p.subdivision || p.subdivision_name,
          price: parseFloat(p.price) || 0,
          bedrooms: parseInt(p.bedrooms) || 0, 
          bathrooms: parseInt(p.bathrooms_full) || parseInt(p.bathrooms) || 0,
          square_feet: parseInt(p.sqft) || parseInt(p.square_feet) || 0,
          images: p.images || [], 
          property_sub_type: p.property_sub_type || p.property_type,
          listing_status: p.listing_status || 'active', 
          office_name: p.office_name
        }));

        if (append) setProperties(prev => [...prev, ...mappedProps]);
        else setProperties(mappedProps);
        
        // Use pagination object like the map does
        if (data.pagination) {
          setTotalItems(data.pagination.total_items);
          setTotalPages(data.pagination.total_pages || Math.ceil(data.pagination.total_items / maxItems));
          setHasMore(data.pagination.has_next);
          setCurrentPage(page);
        }
      }
    } catch (err) { console.error('Load error:', err); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [backendUrlLoaded, backendUrl, filters, maxItems, sortOrder]);

  // Initial load
  useEffect(() => { if (backendUrlLoaded) loadProperties(); }, [backendUrlLoaded, loadProperties]);
  
  // Reload when filters change
  useEffect(() => { if (backendUrlLoaded) loadProperties(); }, [filters]);

  // ============ SEARCH HANDLERS - EXACT SAME AS MAP ============
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSearchSubmitted(false);
    
    if (value.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);

    searchDebounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${backendUrl}/api/mls/search-suggestions?query=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (data.success) setSearchSuggestions(data.suggestions || []);
      } catch (err) { setSearchSuggestions([]); }
    }, 300);
  }, [backendUrl]);

  // CRITICAL: This is EXACTLY how the map handles search selection
  const handleSearchSelect = useCallback(async (item: SearchSuggestion) => {
    // Save to recent searches
    const newRecent = [item, ...recentSearches.filter(r => r.value !== item.value)].slice(0, 5);
    setRecentSearches(newRecent);
    try { localStorage.setItem('recentPropertySearches', JSON.stringify(newRecent)); } catch (e) {}
    
    setSearchQuery(item.label);
    setSearchSubmitted(true);
    setSearchDropdownOpen(false);
    
    // Apply search based on type - EXACT SAME AS MAP
    if (item.type === 'city') {
      console.log('🔍 City selected:', item.value);
      // This REPLACES filters with just the city filter - same as map line 404
      setFilters({ cities: [item.value] });
      
    } else if (item.type === 'neighbourhood') {
      console.log('🔍 Neighbourhood selected:', item.value);
      // This REPLACES filters with just the neighbourhood filter - same as map line 433
      setFilters({ neighbourhoods: [item.value] });
      
    } else if (item.type === 'address') {
      console.log('🔍 Address selected:', item.value);
      // This REPLACES filters with just the address filter - same as map line 459
      setFilters({ addresses: [item.value] });
      
    } else if (item.type === 'mls') {
      // Direct navigation to property - URL is always the same
      const slug = item.value.toLowerCase();
      const agentParam = assignedAgentId ? `?agentId=${assignedAgentId}` : '';
      window.open(`${NEXTJS_TEMPLATE_URL}/mls-property/${slug}${agentParam}`, openInNewWindow ? '_blank' : '_self');
    }
  }, [recentSearches, listingTheme, assignedAgentId, openInNewWindow]);

  // Clear search - EXACT SAME AS MAP
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchSubmitted(false);
    setSearchDropdownOpen(false);
    
    // Remove search filters from the filters object - same as map lines 523-527
    const clearedFilters = { ...filters };
    delete clearedFilters.cities;
    delete clearedFilters.neighbourhoods;
    delete clearedFilters.addresses;
    setFilters(clearedFilters);
  }, [filters]);

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setFilters(prev => ({ ...prev, nearLat: pos.coords.latitude, nearLng: pos.coords.longitude })),
        (err) => console.error('Location error:', err)
      );
    }
    setSearchDropdownOpen(false);
  };

  // ============ FILTER HANDLERS ============
  const handleDropdownChange = (field: string, value: string) => {
    if (value === 'all' || value === 'any') {
      setFilters(prev => { const { [field]: _, ...rest } = prev; return rest; });
    } else {
      setFilters(prev => ({ ...prev, [field]: value }));
    }
    setOpenFilter(null);
  };

  const handleMultiSelectToggle = (field: string, value: string) => {
    setMultiSelectValues(prev => {
      const current = prev[field] || [];
      if (value === 'all') return { ...prev, [field]: [] };
      if (current.includes(value)) return { ...prev, [field]: current.filter(v => v !== value) };
      return { ...prev, [field]: [...current, value] };
    });
  };

  const applyMultiSelect = (field: string) => {
    const values = multiSelectValues[field] || [];
    if (values.length === 0) {
      setFilters(prev => { const { [field]: _, ...rest } = prev; return rest; });
    } else {
      setFilters(prev => ({ ...prev, [field]: values }));
    }
    setOpenFilter(null);
  };

  const applySliderFilter = (field: string, filter: FilterConfig) => {
    const [min, max] = tempSliderValues[field] || [filter.min || 0, filter.max || 100];
    setSliderValues(prev => ({ ...prev, [field]: [min, max] }));
    if (min === (filter.min || 0) && max === (filter.max || 100)) {
      setFilters(prev => { const { [field]: _, ...rest } = prev; return rest; });
    } else {
      setFilters(prev => ({ ...prev, [field]: [min, max] }));
    }
    setOpenFilter(null);
  };

  const resetSlider = (field: string, filter: FilterConfig) => {
    const defaultVal: [number, number] = [filter.min || 0, filter.max || 100];
    setTempSliderValues(prev => ({ ...prev, [field]: defaultVal }));
    setSliderValues(prev => ({ ...prev, [field]: defaultVal }));
    setFilters(prev => { const { [field]: _, ...rest } = prev; return rest; });
  };

  // More Filters handlers
  const getMoreFiltersLabel = () => {
    const activeCount = moreFiltersConfig.filter(f => filters[f.field]).length;
    if (activeCount === 0) return 'More Filters';
    return `More Filters (${activeCount})`;
  };

  const applyMoreFilters = () => {
    setFilters(prev => ({ ...prev, ...moreFiltersTemp }));
    setShowMoreFilters(false);
  };

  const resetMoreFilters = () => {
    moreFiltersConfig.forEach(config => {
      if (config.type === 'slider') {
        const defaultVal: [number, number] = [config.min || 0, config.max || 100];
        setTempSliderValues(prev => ({ ...prev, [config.field]: defaultVal }));
      }
    });
    setMoreFiltersTemp({});
    setFilters(prev => {
      const newFilters = { ...prev };
      moreFiltersConfig.forEach(config => {
        delete newFilters[config.field];
      });
      return newFilters;
    });
  };

  // Check if we have active search filters
  const hasSearchFilters = Boolean(filters.cities || filters.neighbourhoods || filters.addresses);
  
  const hasActiveFilters = () => {
    return Object.keys(filters).filter(k => !['sort'].includes(k)).length > 0;
  };

  const clearAllFilters = () => {
    setFilters({});
    setMultiSelectValues({});
    setMoreFiltersTemp({});
    filterConfig.forEach(f => {
      if (f.type === 'slider') {
        const defaultVal: [number, number] = [f.min || 0, f.max || 100];
        setSliderValues(prev => ({ ...prev, [f.field]: defaultVal }));
        setTempSliderValues(prev => ({ ...prev, [f.field]: defaultVal }));
      }
    });
    setSearchQuery('');
    setSearchSubmitted(false);
  };

  const getFilterLabel = (filter: FilterConfig) => {
    const val = filters[filter.field];
    if (!val) return filter.label;
    if (Array.isArray(val) && val.length > 0) {
      if (filter.type === 'slider') {
        if (filter.field === 'ListPrice') return `${formatCurrency(val[0])} - ${formatCurrency(val[1])}`;
        return `${val[0]} - ${val[1]}`;
      }
      return `${filter.label} (${val.length})`;
    }
    if (typeof val === 'object' && val.min !== undefined) {
      if (filter.field === 'ListPrice') return `${formatCurrency(val.min)} - ${formatCurrency(val.max)}`;
      return `${val.min} - ${val.max}`;
    }
    const opt = filter.options?.find(o => o.value === val);
    return opt?.label || val;
  };

  // Infinite scroll
  useEffect(() => {
    if (paginationType !== 'infinite') return;
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !loadingMore && hasMore) {
        loadProperties(currentPage + 1, true);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, currentPage, paginationType, loadProperties]);

  const handlePropertyClick = (property: any) => {
    // URL is always the same - no theme indicator
    const slug = generateMlsSlug(property);
    const agentParam = assignedAgentId ? `?agentId=${assignedAgentId}` : '';
    window.open(`${NEXTJS_TEMPLATE_URL}/mls-property/${slug}${agentParam}`, openInNewWindow ? '_blank' : '_self');
  };

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: bgColor, color: textColor }}>
      <style>{`
        input[type="range"] { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 22px; width: 22px; border-radius: 50%; background: #1a1a1a; cursor: pointer; margin-top: -9px; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
        input[type="range"]::-moz-range-thumb { height: 22px; width: 22px; border-radius: 50%; background: #1a1a1a; cursor: pointer; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
        input[type="range"]::-webkit-slider-runnable-track { height: 4px; background: transparent; }
        input[type="range"]::-moz-range-track { height: 4px; background: transparent; }
        .dual-range-min, .dual-range-max { pointer-events: none; }
        .dual-range-min::-webkit-slider-thumb { pointer-events: auto; }
        .dual-range-max::-webkit-slider-thumb { pointer-events: auto; }
        .dual-range-min::-moz-range-thumb { pointer-events: auto; }
        .dual-range-max::-moz-range-thumb { pointer-events: auto; }
      `}</style>
      <div className="max-w-[1600px] mx-auto p-4 md:p-8">
        {/* Search Bar */}
        <div className="relative mb-4">
          <div className="relative w-full px-4 py-3 pr-12 border rounded-lg" style={{ backgroundColor: isDark ? '#18181b' : '#fff', borderColor }}>
            {!searchSubmitted ? (
              <>
                <input ref={searchInputRef} type="text" value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setSearchDropdownOpen(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && searchSuggestions.length > 0) { e.preventDefault(); handleSearchSelect(searchSuggestions[0]); } }}
                  placeholder="Search by city, neighbourhood, address or mls #"
                  className="w-full bg-transparent focus:outline-none"
                  style={{ fontFamily: 'Jost, sans-serif', fontSize: '15px', color: textColor }} />
                <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-medium">
                    <span className="truncate max-w-[300px]">{searchQuery}</span>
                    <button onClick={clearSearch} className="hover:bg-emerald-200 rounded-full p-0.5"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>
                <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
              </>
            )}
          </div>

          {/* Search Dropdown */}
          {searchDropdownOpen && !searchSubmitted && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSearchDropdownOpen(false)} />
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border z-20 max-h-96 overflow-y-auto" style={{ backgroundColor: isDark ? '#18181b' : '#fff', borderColor }}>
                {searchQuery.length >= 2 && searchSuggestions.length > 0 && searchSuggestions.map((item, idx) => (
                  <button key={idx} onClick={() => handleSearchSelect(item)} className="w-full px-4 py-3 text-left hover:bg-gray-50" style={{ fontFamily: 'Jost, sans-serif', backgroundColor: isDark ? '#18181b' : '#fff' }}>
                    <div className="font-medium" style={{ color: textColor }}>{item.label}</div>
                    <div className="text-sm text-gray-500 capitalize">{item.type}</div>
                  </button>
                ))}
                {searchQuery.length >= 2 && searchSuggestions.length === 0 && <div className="px-4 py-6 text-center text-gray-500">No results found</div>}
                {recentSearches.length > 0 && searchQuery.length < 2 && (
                  <>
                    <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor }}>
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                      <span className="font-semibold" style={{ color: textColor }}>Recent</span>
                    </div>
                    {recentSearches.slice(0, 3).map((item, idx) => (
                      <button key={idx} onClick={() => handleSearchSelect(item)} className="w-full px-4 py-3 text-left hover:bg-gray-50" style={{ fontFamily: 'Jost, sans-serif', backgroundColor: isDark ? '#18181b' : '#fff' }}>
                        <div className="font-medium" style={{ color: textColor }}>{item.label}</div>
                        <div className="text-sm text-gray-500 capitalize">{item.type}</div>
                      </button>
                    ))}
                  </>
                )}
                {searchQuery.length < 2 && (
                  <button onClick={handleCurrentLocation} className="w-full px-4 py-3 text-left hover:bg-gray-50 border-t flex items-center gap-3" style={{ fontFamily: 'Jost, sans-serif', backgroundColor: isDark ? '#18181b' : '#fff', borderColor }}>
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                    <div><div className="font-semibold" style={{ color: textColor }}>Current location</div><div className="text-sm text-gray-500">Homes near your current location</div></div>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Filter Pills - Main filters only, with More Filters button */}
        {showFilters && (
          <div className="relative mb-6">
            <div className="flex flex-wrap items-center gap-2">
              {/* Property Type Filter */}
              {mainFilters.filter(f => f.field === 'PropertyType').map(filter => (
                <button key={filter.id}
                  onClick={() => {
                    if (openFilter === filter.field) { setOpenFilter(null); }
                    else {
                      const current = filters[filter.field];
                      if (Array.isArray(current)) setMultiSelectValues(prev => ({ ...prev, [filter.field]: current }));
                      else if (current) setMultiSelectValues(prev => ({ ...prev, [filter.field]: [current] }));
                      else setMultiSelectValues(prev => ({ ...prev, [filter.field]: [] }));
                      setOpenFilter(filter.field);
                    }
                  }}
                  className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                  style={{ backgroundColor: openFilter === filter.field ? '#1a1a1a' : filterBgColor, color: openFilter === filter.field ? '#fff' : textColor, fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>
                  {getFilterLabel(filter)}
                  <ChevronDownIcon className="ml-1 h-4 w-4" />
                </button>
              ))}

              {/* Property SubType Filter */}
              {mainFilters.filter(f => f.field === 'PropertySubType').map(filter => (
                <button key={filter.id}
                  onClick={() => {
                    if (openFilter === filter.field) { setOpenFilter(null); }
                    else {
                      const current = filters[filter.field];
                      if (Array.isArray(current)) setMultiSelectValues(prev => ({ ...prev, [filter.field]: current }));
                      else if (current) setMultiSelectValues(prev => ({ ...prev, [filter.field]: [current] }));
                      else setMultiSelectValues(prev => ({ ...prev, [filter.field]: [] }));
                      setOpenFilter(filter.field);
                    }
                  }}
                  className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                  style={{ backgroundColor: openFilter === filter.field ? '#1a1a1a' : filterBgColor, color: openFilter === filter.field ? '#fff' : textColor, fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>
                  {getFilterLabel(filter)}
                  <ChevronDownIcon className="ml-1 h-4 w-4" />
                </button>
              ))}

              {/* Price Filter */}
              {mainFilters.filter(f => f.field === 'ListPrice').map(filter => (
                <button key={filter.id}
                  onClick={() => setOpenFilter(openFilter === filter.field ? null : filter.field)}
                  className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                  style={{ backgroundColor: openFilter === filter.field ? '#1a1a1a' : filterBgColor, color: openFilter === filter.field ? '#fff' : textColor, fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>
                  {getFilterLabel(filter)}
                  <ChevronDownIcon className="ml-1 h-4 w-4" />
                </button>
              ))}

              {/* Bedrooms Filter */}
              {mainFilters.filter(f => f.field === 'BedroomsTotal').map(filter => (
                <button key={filter.id}
                  onClick={() => setOpenFilter(openFilter === filter.field ? null : filter.field)}
                  className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                  style={{ backgroundColor: openFilter === filter.field ? '#1a1a1a' : filterBgColor, color: openFilter === filter.field ? '#fff' : textColor, fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>
                  {getFilterLabel(filter)}
                  <ChevronDownIcon className="ml-1 h-4 w-4" />
                </button>
              ))}

              {/* Baths Filter */}
              {mainFilters.filter(f => f.field === 'BathroomsTotal').map(filter => (
                <button key={filter.id}
                  onClick={() => setOpenFilter(openFilter === filter.field ? null : filter.field)}
                  className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                  style={{ backgroundColor: openFilter === filter.field ? '#1a1a1a' : filterBgColor, color: openFilter === filter.field ? '#fff' : textColor, fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>
                  {getFilterLabel(filter)}
                  <ChevronDownIcon className="ml-1 h-4 w-4" />
                </button>
              ))}

              {/* More Filters Button */}
              {moreFiltersConfig.length > 0 && (
                <button
                  onClick={() => {
                    const temp: Record<string, any> = {};
                    moreFiltersConfig.forEach(f => {
                      if (filters[f.field]) temp[f.field] = filters[f.field];
                    });
                    setMoreFiltersTemp(temp);
                    setShowMoreFilters(true);
                  }}
                  className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                  style={{ backgroundColor: filterBgColor, color: textColor, fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>
                  {getMoreFiltersLabel()}
                </button>
              )}

              {/* Sort Dropdown */}
              {sortFilter && (
                <button onClick={() => setOpenFilter(openFilter === 'sort' ? null : 'sort')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: openFilter === 'sort' ? '#1a1a1a' : filterBgColor, color: openFilter === 'sort' ? '#fff' : textColor }}>
                  {filters.sort ? sortFilter.options?.find(o => o.value === filters.sort)?.label || 'Sort' : 'Sort'}
                  <ChevronDownIcon className="ml-1 h-4 w-4" />
                </button>
              )}

              {/* Reset Filters */}
              {hasActiveFilters() && (
                <button onClick={clearAllFilters} className="text-sm underline whitespace-nowrap px-2" style={{ color: textColor, fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>reset filters</button>
              )}
            </div>

            {/* DROPDOWN PANELS */}
            {openFilter && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setOpenFilter(null)} />
                <div className="absolute left-0 mt-3 p-4 rounded-[24px] shadow-lg border z-30" style={{ backgroundColor: cardBgColor, borderColor, maxWidth: (openFilter === 'ListPrice') ? '480px' : undefined }}>
                  {mainFilters.filter(f => f.field === openFilter).map(filter => {
                    const isMultiSelect = filter.multiSelect || filter.field === 'PropertyType' || filter.field === 'PropertySubType';
                    
                    let displayOptions = filter.options;
                    if (filter.field === 'PropertySubType' && allSubTypeOptions.length > 0) {
                      const selectedPropertyTypes = filters.PropertyType;
                      if (selectedPropertyTypes && Array.isArray(selectedPropertyTypes) && selectedPropertyTypes.length > 0) {
                        const allowedSubTypes = new Set<string>();
                        selectedPropertyTypes.forEach((pt: string) => {
                          const subtypes = propertySubTypeMapping[pt];
                          if (subtypes) subtypes.forEach(st => allowedSubTypes.add(st));
                        });
                        displayOptions = allSubTypeOptions.filter(opt => opt.value === 'all' || allowedSubTypes.has(opt.value));
                      } else if (typeof selectedPropertyTypes === 'string' && selectedPropertyTypes !== 'all') {
                        const subtypes = propertySubTypeMapping[selectedPropertyTypes];
                        if (subtypes) displayOptions = allSubTypeOptions.filter(opt => opt.value === 'all' || subtypes.includes(opt.value));
                      }
                    }
                    
                    return (
                      <div key={filter.id}>
                        {filter.type === 'dropdown' && (
                          <div className="flex flex-wrap gap-2">
                            {displayOptions?.map((option) => {
                              const currentSelections = multiSelectValues[filter.field] || [];
                              const isSelected = isMultiSelect
                                ? (option.value === 'all' ? currentSelections.length === 0 : currentSelections.includes(option.value))
                                : (filters[filter.field] === option.value || (!filters[filter.field] && (option.value === 'any' || option.value === 'all')));
                              
                              return (
                                <button key={option.value}
                                  onClick={() => isMultiSelect ? handleMultiSelectToggle(filter.field, option.value) : handleDropdownChange(filter.field, option.value)}
                                  className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2"
                                  style={{ fontFamily: 'Jost, sans-serif', fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}>
                                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>
                                    {isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}
                                  </div>
                                  {option.label}
                                </button>
                              );
                            })}
                            {isMultiSelect && (
                              <button onClick={() => applyMultiSelect(filter.field)} className="text-sm underline whitespace-nowrap px-3 py-2" style={{ color: textColor, fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>Apply</button>
                            )}
                          </div>
                        )}
                        {filter.type === 'slider' && (
                          <div className="space-y-4" style={{ width: '440px' }}>
                            <h3 className="text-lg font-bold" style={{ color: textColor }}>{filter.label}</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-semibold" style={{ color: textColor }}>From</label>
                                <input type="number" value={tempSliderValues[filter.field]?.[0] === (filter.min || 0) ? '' : tempSliderValues[filter.field]?.[0]} onChange={(e) => { const val = e.target.value === '' ? filter.min || 0 : parseInt(e.target.value); setTempSliderValues(prev => ({ ...prev, [filter.field]: [val, prev[filter.field]?.[1] || filter.max || 100] })); }} placeholder="Min" className="w-full px-3 py-2 text-base rounded-lg border" style={{ backgroundColor: cardBgColor, color: textColor, borderColor }} />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-semibold" style={{ color: textColor }}>To</label>
                                <input type="number" value={tempSliderValues[filter.field]?.[1] === (filter.max || 100) ? '' : tempSliderValues[filter.field]?.[1]} onChange={(e) => { const val = e.target.value === '' ? filter.max || 100 : parseInt(e.target.value); setTempSliderValues(prev => ({ ...prev, [filter.field]: [prev[filter.field]?.[0] || filter.min || 0, val] })); }} placeholder="Max" className="w-full px-3 py-2 text-base rounded-lg border" style={{ backgroundColor: cardBgColor, color: textColor, borderColor }} />
                              </div>
                            </div>
                            <div className="relative h-8 mt-4" style={{ width: '440px' }}>
                              <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-gray-200 rounded-full"></div>
                              <div className="absolute top-1/2 -translate-y-1/2 h-2 bg-black rounded-full" style={{ left: `${((tempSliderValues[filter.field]?.[0] || filter.min || 0) - (filter.min || 0)) / ((filter.max || 100) - (filter.min || 0)) * 100}%`, right: `${100 - ((tempSliderValues[filter.field]?.[1] || filter.max || 100) - (filter.min || 0)) / ((filter.max || 100) - (filter.min || 0)) * 100}%` }}></div>
                              <input type="range" min={filter.min || 0} max={filter.max || 100} step={filter.step || 1} value={tempSliderValues[filter.field]?.[0] || filter.min || 0} onChange={(e) => { const val = parseInt(e.target.value); const maxVal = tempSliderValues[filter.field]?.[1] || filter.max || 100; if (val <= maxVal) setTempSliderValues(prev => ({ ...prev, [filter.field]: [val, maxVal] })); }} className="dual-range-min absolute w-full h-8 appearance-none bg-transparent cursor-pointer" style={{ zIndex: 20, pointerEvents: 'none' }} />
                              <input type="range" min={filter.min || 0} max={filter.max || 100} step={filter.step || 1} value={tempSliderValues[filter.field]?.[1] || filter.max || 100} onChange={(e) => { const val = parseInt(e.target.value); const minVal = tempSliderValues[filter.field]?.[0] || filter.min || 0; if (val >= minVal) setTempSliderValues(prev => ({ ...prev, [filter.field]: [minVal, val] })); }} className="dual-range-max absolute w-full h-8 appearance-none bg-transparent cursor-pointer" style={{ zIndex: 21, pointerEvents: 'none' }} />
                            </div>
                            <div className="flex justify-between text-sm pt-2" style={{ color: mutedTextColor, width: '440px' }}>
                              <span>{filter.field === 'ListPrice' ? formatCurrency(tempSliderValues[filter.field]?.[0] || filter.min || 0) : (tempSliderValues[filter.field]?.[0] || filter.min || 0).toLocaleString()}</span>
                              <span>{filter.field === 'ListPrice' ? formatCurrency(tempSliderValues[filter.field]?.[1] || filter.max || 100) : (tempSliderValues[filter.field]?.[1] || filter.max || 100).toLocaleString()}</span>
                            </div>
                            <div className="flex gap-2 pt-4" style={{ width: '440px' }}>
                              <button onClick={() => resetSlider(filter.field, filter)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100" style={{ borderColor, color: textColor }}>Reset</button>
                              <button onClick={() => applySliderFilter(filter.field, filter)} className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800">Apply</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Sort Options */}
                  {openFilter === 'sort' && sortFilter && (
                    <div className="flex flex-wrap gap-2">
                      {sortFilter.options?.map((opt) => {
                        const isSelected = filters.sort === opt.value || (!filters.sort && opt.value === 'latest');
                        return (
                          <button key={opt.value}
                            onClick={() => handleDropdownChange('sort', opt.value)}
                            className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2"
                            style={{ fontFamily: 'Jost, sans-serif', fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}>
                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>
                              {isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}
                            </div>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* More Filters Modal - Rendered via Portal to fix Safari z-index/transform issues */}
        {showMoreFilters && typeof document !== 'undefined' && createPortal(
          <>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.5)', WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)' }} onClick={() => setShowMoreFilters(false)} />
            <div style={{ position: 'fixed', zIndex: 100000, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', WebkitTransform: 'translate(-50%, -50%)', width: '90%', maxWidth: '672px', maxHeight: '80vh', overflowY: 'auto' as const, borderRadius: '32px', padding: '24px', backgroundColor: cardBgColor, color: textColor, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold" style={{ fontFamily: 'Jost, sans-serif' }}>More Filters</h2>
                <button onClick={() => setShowMoreFilters(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                {moreFiltersConfig.map((filter) => (
                  <div key={filter.id} className="space-y-3">
                    <div className="font-semibold" style={{ fontFamily: 'Jost, sans-serif', fontSize: '15px' }}>{filter.label}</div>
                    
                    {filter.type === 'dropdown' && (
                      <div className="flex flex-wrap gap-2">
                        {filter.options?.map((option) => {
                          const isSelected = moreFiltersTemp[filter.field] === option.value || 
                                           (!moreFiltersTemp[filter.field] && (option.value === 'any' || option.value === 'all'));
                          return (
                            <button
                              key={option.value}
                              onClick={() => {
                                setMoreFiltersTemp(prev => {
                                  const newTemp = { ...prev };
                                  if (option.value === 'any' || option.value === 'all') {
                                    delete newTemp[filter.field];
                                  } else {
                                    newTemp[filter.field] = option.value;
                                  }
                                  return newTemp;
                                });
                              }}
                              className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2"
                              style={{
                                fontFamily: 'Jost, sans-serif',
                                fontWeight: 500,
                                fontSize: '14px',
                                backgroundColor: isSelected ? '#1a1a1a' : 'transparent',
                                color: isSelected ? '#fff' : textColor,
                                borderColor: isSelected ? '#1a1a1a' : borderColor,
                                borderRadius: '40px',
                              }}>
                              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>
                                {isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}
                              </div>
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {filter.type === 'slider' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold" style={{ color: textColor }}>From</label>
                            <input 
                              type="number" 
                              value={tempSliderValues[filter.field]?.[0] === (filter.min || 0) ? '' : tempSliderValues[filter.field]?.[0]} 
                              onChange={(e) => { 
                                const val = e.target.value === '' ? filter.min || 0 : parseInt(e.target.value); 
                                setTempSliderValues(prev => ({ ...prev, [filter.field]: [val, prev[filter.field]?.[1] || filter.max || 100] }));
                                setMoreFiltersTemp(prev => {
                                  const maxVal = tempSliderValues[filter.field]?.[1] || filter.max || 100;
                                  if (val !== filter.min || maxVal !== filter.max) {
                                    return { ...prev, [filter.field]: [val, maxVal] };
                                  }
                                  const { [filter.field]: _, ...rest } = prev;
                                  return rest;
                                });
                              }} 
                              placeholder="Min" 
                              className="w-full px-3 py-2 text-base rounded-lg border" 
                              style={{ backgroundColor: cardBgColor, color: textColor, borderColor }} 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold" style={{ color: textColor }}>To</label>
                            <input 
                              type="number" 
                              value={tempSliderValues[filter.field]?.[1] === (filter.max || 100) ? '' : tempSliderValues[filter.field]?.[1]} 
                              onChange={(e) => { 
                                const val = e.target.value === '' ? filter.max || 100 : parseInt(e.target.value); 
                                setTempSliderValues(prev => ({ ...prev, [filter.field]: [prev[filter.field]?.[0] || filter.min || 0, val] }));
                                setMoreFiltersTemp(prev => {
                                  const minVal = tempSliderValues[filter.field]?.[0] || filter.min || 0;
                                  if (minVal !== filter.min || val !== filter.max) {
                                    return { ...prev, [filter.field]: [minVal, val] };
                                  }
                                  const { [filter.field]: _, ...rest } = prev;
                                  return rest;
                                });
                              }} 
                              placeholder="Max" 
                              className="w-full px-3 py-2 text-base rounded-lg border" 
                              style={{ backgroundColor: cardBgColor, color: textColor, borderColor }} 
                            />
                          </div>
                        </div>
                        <div className="relative h-8 mt-4">
                          <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-gray-200 rounded-full"></div>
                          <div className="absolute top-1/2 -translate-y-1/2 h-2 bg-black rounded-full" style={{ 
                            left: `${((tempSliderValues[filter.field]?.[0] || filter.min || 0) - (filter.min || 0)) / ((filter.max || 100) - (filter.min || 0)) * 100}%`, 
                            right: `${100 - ((tempSliderValues[filter.field]?.[1] || filter.max || 100) - (filter.min || 0)) / ((filter.max || 100) - (filter.min || 0)) * 100}%` 
                          }}></div>
                          <input type="range" min={filter.min || 0} max={filter.max || 100} step={filter.step || 1} value={tempSliderValues[filter.field]?.[0] || filter.min || 0} onChange={(e) => { 
                            const val = parseInt(e.target.value); 
                            const maxVal = tempSliderValues[filter.field]?.[1] || filter.max || 100; 
                            if (val <= maxVal) {
                              setTempSliderValues(prev => ({ ...prev, [filter.field]: [val, maxVal] }));
                              setMoreFiltersTemp(prev => {
                                if (val !== filter.min || maxVal !== filter.max) {
                                  return { ...prev, [filter.field]: [val, maxVal] };
                                }
                                const { [filter.field]: _, ...rest } = prev;
                                return rest;
                              });
                            }
                          }} className="dual-range-min absolute w-full h-8 appearance-none bg-transparent cursor-pointer" style={{ zIndex: 20, pointerEvents: 'none' }} />
                          <input type="range" min={filter.min || 0} max={filter.max || 100} step={filter.step || 1} value={tempSliderValues[filter.field]?.[1] || filter.max || 100} onChange={(e) => { 
                            const val = parseInt(e.target.value); 
                            const minVal = tempSliderValues[filter.field]?.[0] || filter.min || 0; 
                            if (val >= minVal) {
                              setTempSliderValues(prev => ({ ...prev, [filter.field]: [minVal, val] }));
                              setMoreFiltersTemp(prev => {
                                if (minVal !== filter.min || val !== filter.max) {
                                  return { ...prev, [filter.field]: [minVal, val] };
                                }
                                const { [filter.field]: _, ...rest } = prev;
                                return rest;
                              });
                            }
                          }} className="dual-range-max absolute w-full h-8 appearance-none bg-transparent cursor-pointer" style={{ zIndex: 21, pointerEvents: 'none' }} />
                        </div>
                        <div className="flex justify-between text-sm" style={{ color: mutedTextColor }}>
                          <span>{formatNumber(tempSliderValues[filter.field]?.[0] || filter.min || 0)}</span>
                          <span>{formatNumber(tempSliderValues[filter.field]?.[1] || filter.max || 100)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-6 mt-6 border-t" style={{ borderColor }}>
                <button onClick={resetMoreFilters} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100" style={{ borderColor, color: textColor, fontFamily: 'Jost, sans-serif' }}>Reset</button>
                <button onClick={applyMoreFilters} className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800" style={{ fontFamily: 'Jost, sans-serif' }}>Apply Filters</button>
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Results Header */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Jost, sans-serif' }}>Properties</h2>
          <p className="text-sm" style={{ color: mutedTextColor }}>{loading ? 'Loading...' : `Showing ${properties.length} of ${totalItems.toLocaleString()} properties`}</p>
        </div>

        {/* Property Grid */}
        {loading && properties.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-16" style={{ color: mutedTextColor }}>No properties found</div>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${responsiveColumns}, minmax(0, 1fr))` }}>
            {properties.map(property => {
              const isMetaOverlay = cardStyle === 'meta-overlay';
              const isSideCard = listingStyle === 'side';
              return (
              <div key={property.mls_number} onClick={() => handlePropertyClick(property)}
                className="rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-xl"
                style={{ backgroundColor: cardBgColor, border: `1px solid ${borderColor}` }}>
                <div className={isSideCard ? 'flex h-full' : ''}>
                <div className={`overflow-hidden relative ${isSideCard ? 'w-2/5 flex-shrink-0' : ''}`} style={isSideCard ? {} : { aspectRatio: aspectCSS }}>
                  <img src={property.images?.[0] || `https://mlsmedia.inthehood.io/property-images/${property.mls_number}/full/${property.mls_number}-1.webp`} alt={property.address} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                  <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff' }}>{property.property_sub_type === 'Detached' ? 'House' : (property.property_sub_type || 'House')}</span>
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold rounded" style={{ backgroundColor: '#22c55e', color: '#fff' }}>Active</span>
                  {isMetaOverlay && (
                    <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                      <div className="text-xl font-bold text-white mb-0.5" style={{ fontFamily: 'Jost, sans-serif' }}>{formatFullPrice(property.price)}</div>
                      <div className="text-white/80 text-sm truncate" style={{ fontFamily: 'Jost, sans-serif' }}>{property.address}, {property.city}</div>
                      <div className="flex gap-4 mt-1 text-white/90 text-xs">
                        {property.bedrooms > 0 && <span>{property.bedrooms} Beds</span>}
                        {property.bathrooms > 0 && <span>{property.bathrooms} Baths</span>}
                        {property.square_feet > 0 && <span>{property.square_feet.toLocaleString()} Sqft</span>}
                      </div>
                    </div>
                  )}
                </div>
                {!isMetaOverlay && (
                <div className={`p-4 ${isSideCard ? 'flex flex-col justify-center' : ''}`}>
                  <div className="text-xl font-bold mb-1" style={{ color: textColor, fontFamily: 'Jost, sans-serif' }}>{formatFullPrice(property.price)}</div>
                  <div className="flex items-start gap-1 mb-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="#6B7280"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    <span className="text-sm line-clamp-2" style={{ color: mutedTextColor, fontFamily: 'Jost, sans-serif' }}>{property.address}, {property.city}</span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="flex flex-col"><span className="font-bold" style={{ color: textColor }}>{property.bedrooms}</span><span style={{ color: mutedTextColor, fontSize: '12px' }}>Beds</span></div>
                    <div className="flex flex-col"><span className="font-bold" style={{ color: textColor }}>{property.bathrooms}</span><span style={{ color: mutedTextColor, fontSize: '12px' }}>Baths</span></div>
                    {property.square_feet > 0 && <div className="flex flex-col"><span className="font-bold" style={{ color: textColor }}>{property.square_feet.toLocaleString()}</span><span style={{ color: mutedTextColor, fontSize: '12px' }}>Sqft</span></div>}
                  </div>
                </div>
                )}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {paginationType === 'loadMore' && hasMore && (
          <div className="text-center mt-8">
            <button onClick={() => loadProperties(currentPage + 1, true)} disabled={loadingMore} className="px-8 py-3 rounded-lg bg-black text-white font-medium disabled:opacity-50">
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

        {/* Numbered Pagination */}
        {paginationType === 'numbered' && totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8 pb-4">
            <button
              onClick={() => loadProperties(1, false)}
              disabled={currentPage === 1 || loading}
              className="px-3 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor, color: textColor, backgroundColor: cardBgColor }}
            >
              First
            </button>
            <button
              onClick={() => loadProperties(currentPage - 1, false)}
              disabled={currentPage === 1 || loading}
              className="px-3 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor, color: textColor, backgroundColor: cardBgColor }}
            >
              Prev
            </button>
            
            {/* Page numbers */}
            {(() => {
              const pages = [];
              const showPages = 5;
              let start = Math.max(1, currentPage - Math.floor(showPages / 2));
              let end = Math.min(totalPages, start + showPages - 1);
              if (end - start < showPages - 1) start = Math.max(1, end - showPages + 1);
              
              if (start > 1) {
                pages.push(
                  <button key={1} onClick={() => loadProperties(1, false)} className="px-3 py-2 rounded-lg border" style={{ borderColor, color: textColor, backgroundColor: cardBgColor }}>1</button>
                );
                if (start > 2) pages.push(<span key="dots1" className="px-2" style={{ color: mutedTextColor }}>...</span>);
              }
              
              for (let i = start; i <= end; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => loadProperties(i, false)}
                    disabled={loading}
                    className={`px-3 py-2 rounded-lg border ${currentPage === i ? 'font-bold' : ''}`}
                    style={{ 
                      borderColor, 
                      color: currentPage === i ? (isDark ? '#000' : '#fff') : textColor,
                      backgroundColor: currentPage === i ? (isDark ? '#fff' : '#000') : cardBgColor
                    }}
                  >
                    {i}
                  </button>
                );
              }
              
              if (end < totalPages) {
                if (end < totalPages - 1) pages.push(<span key="dots2" className="px-2" style={{ color: mutedTextColor }}>...</span>);
                pages.push(
                  <button key={totalPages} onClick={() => loadProperties(totalPages, false)} className="px-3 py-2 rounded-lg border" style={{ borderColor, color: textColor, backgroundColor: cardBgColor }}>{totalPages}</button>
                );
              }
              
              return pages;
            })()}
            
            <button
              onClick={() => loadProperties(currentPage + 1, false)}
              disabled={currentPage === totalPages || loading}
              className="px-3 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor, color: textColor, backgroundColor: cardBgColor }}
            >
              Next
            </button>
            <button
              onClick={() => loadProperties(totalPages, false)}
              disabled={currentPage === totalPages || loading}
              className="px-3 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor, color: textColor, backgroundColor: cardBgColor }}
            >
              Last
            </button>
          </div>
        )}

        {loadingMore && paginationType === 'infinite' && (
          <div className="flex justify-center mt-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div></div>
        )}
      </div>
    </div>
  );
}
