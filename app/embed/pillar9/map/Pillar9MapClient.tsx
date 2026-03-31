'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Supercluster from 'supercluster';

// ============ CONSTANTS ============
// Supabase credentials for fetching dynamic backend URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Fallback URL if dynamic fetch fails - should match the Supabase stored URL
const FALLBACK_BACKEND_URL = 'https://api-production-531c.up.railway.app';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Fetch the current backend URL from Supabase global_settings
async function fetchBackendUrl(): Promise<string> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/global_settings?select=api_config&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store'
    });
    
    if (response.ok) {
      const data = await response.json();
      // Check both possible paths for the backend URL
      const apiConfig = data?.[0]?.api_config;
      const url_raw = apiConfig?.current_backend_url || apiConfig?.map_config?.current_backend_url;
      if (url_raw) {
        let url = url_raw;
        if (url.endsWith('/')) url = url.slice(0, -1);
        console.log('📡 Pillar9 Map: Using dynamic backend URL:', url);
        return url;
      }
    }
  } catch (e) {
    console.warn('⚠️ Could not fetch backend URL:', e);
  }
  return FALLBACK_BACKEND_URL;
}

const NEXTJS_TEMPLATE_URL = 'https://in-the-hood-io-5dmw.vercel.app';

const cityCenters: Record<string, [number, number]> = {
  'calgary': [-114.0719, 51.0447],
  'cochrane': [-114.4686, 51.1919],
  'edmonton': [-113.4938, 53.5461],
  'airdrie': [-114.0144, 51.2917],
  'chestermere': [-113.8227, 51.0506],
  'okotoks': [-113.9765, 50.7273]
};

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

// Pillar 9 properties use the Air template
// URL structure is ALWAYS the same - no theme indicator in URL
// Theme is stored in Supabase and looked up by the property page
const getNextJsPropertyUrl = (property: any, theme: string, agentId?: string | null): string => {
  const slug = generateMlsSlug(property);
  const agentParam = agentId ? `?agentId=${agentId}` : '';
  return `${NEXTJS_TEMPLATE_URL}/mls-property/${slug}${agentParam}`;
};

// ============ TYPES ============
interface FilterConfig {
  id: string;
  label: string;
  field: string;
  type: 'dropdown' | 'slider' | 'sort';
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  enabled: boolean;
  order: number;
  autoPopulate?: boolean;
  multiSelect?: boolean;
}

interface SearchSuggestion {
  label: string;
  value: string;
  type: 'city' | 'neighbourhood' | 'address' | 'mls';
}

// ============ CHECK ICON COMPONENT ============
const CheckIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ============ CHEVRON DOWN ICON ============
const ChevronDownIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ============ MAIN COMPONENT ============
export default function Pillar9MapClient() {
  const searchParams = useSearchParams();

  // URL Parameters - Core
  const theme = searchParams.get('theme') || 'light';
  const listingTheme = searchParams.get('listingTheme') || searchParams.get('theme') || 'light'; // Template theme for property links (air vs air-dark)
  const showFilters = searchParams.get('showFilters') !== 'false';
  const filterPosition = searchParams.get('filterPosition') || 'side';
  const listingPosition = searchParams.get('listingPosition') || 'right';
  const openInNewWindow = searchParams.get('openInNewWindow') !== 'false';
  const listingTitle = searchParams.get('listingTitle') || 'Properties';
  const listingSubtitle = searchParams.get('listingSubtitle') || '';
  const mapZoom = parseInt(searchParams.get('mapZoom') || '11');
  const mapMinZoom = parseInt(searchParams.get('mapMinZoom') || '5'); // Max zoom-out level (lower = more zoomed out)
  const itemsPerPage = parseInt(searchParams.get('itemsPerPage') || '50');
  const assignedAgentId = searchParams.get('agentId');
  const paginationType = searchParams.get('paginationType') || 'infinite';
  const sortOrder = searchParams.get('sortOrder') || 'latest';
  
  // Extended params for full embed generator support
  const cardStyle = searchParams.get('cardStyle') || 'meta-below';
  const showStatusBadges = searchParams.get('showStatusBadges') !== 'false';
  const useTypography = searchParams.get('useTypography') === 'true';
  const overrideTheme = searchParams.get('overrideTheme') === 'true';
  const listingStyle = searchParams.get('listingStyle') || 'side';
  const aspectRatio = searchParams.get('aspectRatio') || '16:10';
  const aspectCSS = aspectRatio.replace(':', '/');
  const filterAlignment = searchParams.get('filterAlignment') || 'left';
  const mapColumns = parseInt(searchParams.get('mapColumns') || '1');
  
  // MLS filter params
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
  const popupBgColor = (overrideTheme && mapColors.popupBgColor) ? mapColors.popupBgColor : (isDark ? '#18181b' : '#ffffff');
  
  // Badge colors with overrides
  const activeBadgeBg = badgeColors.activeBg || '#10b981';
  const pendingBadgeBg = badgeColors.pendingBg || '#f59e0b';
  const soldBadgeBg = badgeColors.soldBg || '#ef4444';
  const badgeFontColor = badgeColors.fontColor || '#ffffff';

  // Dynamic backend URL state
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
  const [hoveredProperty, setHoveredProperty] = useState<any>(null);
  const [showMap, setShowMap] = useState(true);
  
  // CRITICAL: Build initial filters from URL params IMMEDIATELY (not in useEffect)
  // This ensures filters are available for the first loadMapPins() call
  const initialUrlFilters = useMemo(() => {
    const initFilters: Record<string, any> = {};
    if (citiesParam.length > 0) initFilters.cities = citiesParam;
    if (zonesParam.length > 0) initFilters.zones = zonesParam;
    if (neighbourhoodsParam.length > 0) initFilters.neighbourhoods = neighbourhoodsParam;
    if (propertyTypesParam.length > 0) initFilters.PropertyType = propertyTypesParam;
    if (propertySubTypesParam.length > 0) initFilters.PropertySubType = propertySubTypesParam;
    if (priceMinParam || priceMaxParam) {
      initFilters.ListPrice = [
        priceMinParam ? parseInt(priceMinParam) : 0,
        priceMaxParam ? parseInt(priceMaxParam) : 50000000
      ];
    }
    if (bedsMinParam) initFilters.BedroomsTotal = `${bedsMinParam}+`;
    if (bathsMinParam) initFilters.BathroomsTotal = `${bathsMinParam}+`;
    if (hasOpenHouseParam) initFilters.hasOpenHouse = true;
    if (hasVirtualTourParam) initFilters.hasVirtualTour = true;
    console.log('📋 Map: Initial URL filters computed:', initFilters);
    return initFilters;
  }, [citiesParam, zonesParam, neighbourhoodsParam, propertyTypesParam, propertySubTypesParam, priceMinParam, priceMaxParam, bedsMinParam, bathsMinParam, hasOpenHouseParam, hasVirtualTourParam]);
  
  // Initialize filters state WITH the URL params
  const [filters, setFilters] = useState<Record<string, any>>(initialUrlFilters);
  const [filterConfig, setFilterConfig] = useState<FilterConfig[]>([]);
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchSuggestion[]>([]);

  // Multi-select state for filters
  const [multiSelectValues, setMultiSelectValues] = useState<Record<string, string[]>>({});

  // Store all subtype options for conditional filtering
  const [allSubTypeOptions, setAllSubTypeOptions] = useState<{ label: string; value: string }[]>([]);

  // PropertyType to SubType mapping
  const propertySubTypeMapping: Record<string, string[]> = {
    'Residential': ['Apartment', 'Detached', 'Full Duplex', 'Mobile', 'Multi Family', 'Row/Townhouse', 'Semi Detached (Half Duplex)'],
    'Commercial': ['Business', 'Hotel/Motel', 'Industrial', 'Mixed Use', 'Office', 'Recreational', 'Retail', 'Warehouse'],
    'Land': ['Agriculture', 'Commercial Land', 'Industrial Land', 'Residential Land', 'Land'],
  };

  // Slider state
  const [sliderValues, setSliderValues] = useState<Record<string, [number, number]>>({});
  const [tempSliderValues, setTempSliderValues] = useState<Record<string, [number, number]>>({});

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPolygon, setDrawnPolygon] = useState<any>(null);
  
  // Flag to track initial load (for fit bounds)
  const isInitialLoad = useRef(true);

  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapInitRetries = useRef(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const markersMap = useRef<Map<string, { marker: mapboxgl.Marker; element: HTMLElement }>>(new Map());
  const currentPopup = useRef<mapboxgl.Popup | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const mapReady = useRef(false);
  const enableBoundsFiltering = useRef(false);
  const drawnPolygonRef = useRef<any>(null);
  const drawingPoints = useRef<[number, number][]>([]);
  const isMouseDown = useRef(false);
  const shouldSkipFitBounds = useRef(false);
  const currentBounds = useRef<{minLat: number, maxLat: number, minLng: number, maxLng: number} | null>(null);
  const boundsUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Supercluster refs
  const superclusterRef = useRef<Supercluster | null>(null);
  const cachedGeoJSON = useRef<any>(null);
  const mapEventHandlersSetup = useRef(false);
  
  // CRITICAL: Ref to always have the latest backend URL (prevents stale closures)
  const backendUrlRef = useRef<string>(FALLBACK_BACKEND_URL);

  // Additional theme-based colors (computed above use overrides if available)
  const mapBgColor = (overrideTheme && mapColors.mapBgColor) ? mapColors.mapBgColor : (isDark ? '#18181b' : '#ffffff');
  const filterBgColor = (overrideTheme && mapColors.filterBgColor) ? mapColors.filterBgColor : (isDark ? '#27272a' : '#f5f5f5');
  const filterFontColor = (overrideTheme && mapColors.filterFontColor) ? mapColors.filterFontColor : (isDark ? '#ffffff' : '#000000');
  const filterBorderColor = (overrideTheme && mapColors.filterBorderColor) ? mapColors.filterBorderColor : (isDark ? '#3f3f46' : '#e5e5e5');
  const dropdownBgColor = (overrideTheme && mapColors.dropdownBgColor) ? mapColors.dropdownBgColor : (isDark ? '#27272a' : '#ffffff');
  const dropdownHoverColor = (overrideTheme && mapColors.dropdownHoverColor) ? mapColors.dropdownHoverColor : (isDark ? '#3f3f46' : '#f5f5f5');

  // ============ FETCH BACKEND URL ON MOUNT ============
  useEffect(() => {
    const initBackendUrl = async () => {
      const url = await fetchBackendUrl();
      backendUrlRef.current = url; // CRITICAL: Update ref FIRST (no stale closures)
      setBackendUrl(url);
      setBackendUrlLoaded(true);
    };
    initBackendUrl();
  }, []);

  // Format helpers
  const formatMarkerPrice = (price: number): string => {
    if (price >= 999500) return `$${(price / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (price >= 1000) return `$${Math.round(price / 1000)}K`;
    return `$${price.toLocaleString()}`;
  };

  const formatFullPrice = (price: number): string => `$${Math.round(price).toLocaleString()}`;

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  // ============ SMART CARD HELPERS ============
  // Property types that are "land" — should show lot size, NOT beds/baths
  const LAND_SUBTYPES = ['residential land', 'commercial land', 'industrial land', 'agriculture', 'land'];
  const LAND_TYPES = ['land'];
  // Property types that are "commercial" — should show sqft, NOT beds
  const COMMERCIAL_SUBTYPES = ['retail', 'business', 'office', 'industrial', 'mixed use', 'warehouse', 'hotel/motel', 'recreational'];
  const COMMERCIAL_TYPES = ['commercial', 'agri-business'];

  const isLandProperty = (property: any): boolean => {
    const pt = (property.property_type || '').toLowerCase();
    const pst = (property.property_sub_type || '').toLowerCase();
    return LAND_TYPES.includes(pt) || LAND_SUBTYPES.includes(pst);
  };

  const isCommercialProperty = (property: any): boolean => {
    const pt = (property.property_type || '').toLowerCase();
    const pst = (property.property_sub_type || '').toLowerCase();
    return COMMERCIAL_TYPES.includes(pt) || COMMERCIAL_SUBTYPES.includes(pst);
  };

  // Format address — handle "None None None" and other missing data patterns
  const formatAddress = (address: string | null | undefined, city: string | null | undefined): string => {
    let addr = (address || '').trim();
    // Detect bad address patterns
    if (!addr || /^(none\s*)+$/i.test(addr) || /none\s+none/i.test(addr)) {
      addr = 'Address Not Available';
    }
    const cityStr = (city || '').trim();
    if (cityStr && addr !== 'Address Not Available') return `${addr}, ${cityStr}`;
    if (cityStr) return `${addr}, ${cityStr}`;
    return addr;
  };

  // Format lot size for display
  const formatLotSize = (lotSize: number | null, lotSizeAcres: number | null): string | null => {
    if (lotSizeAcres && lotSizeAcres > 0) {
      return lotSizeAcres >= 1 ? `${lotSizeAcres.toFixed(1)} Acres` : `${Math.round(lotSizeAcres * 43560).toLocaleString()} Sqft`;
    }
    if (lotSize && lotSize > 0) {
      return `${Math.round(lotSize).toLocaleString()} Sqft`;
    }
    return null;
  };

  // ============ LOAD FILTER CONFIG ============
  useEffect(() => {
    if (!backendUrlLoaded) return;
    
    const loadFilterConfig = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/mls-filter-config`);
        const data = await res.json();
        if (data.filters) {
          let config = [...data.filters];
          
          // Fetch options for PropertyType and PropertySubType
          const propertyTypeFilter = config.find((f: FilterConfig) => f.field === 'PropertyType');
          const propertySubTypeFilter = config.find((f: FilterConfig) => f.field === 'PropertySubType');
          
          if (propertyTypeFilter?.autoPopulate) {
            try {
              const res = await fetch(`${backendUrl}/api/supabase/filter-options/PropertyType`);
              const data = await res.json();
              if (data?.success && data.options) {
                propertyTypeFilter.options = [
                  { label: 'All types', value: 'all' },
                  ...data.options.map((opt: string) => ({ label: opt, value: opt }))
                ];
              }
            } catch (e) {}
          }
          
          if (propertySubTypeFilter?.autoPopulate) {
            try {
              const res = await fetch(`${backendUrl}/api/supabase/filter-options/PropertySubType`);
              const data = await res.json();
              if (data?.success && data.options) {
                const allOptions = [
                  { label: 'All types', value: 'all' },
                  ...data.options.map((opt: string) => ({ label: opt, value: opt }))
                ];
                propertySubTypeFilter.options = allOptions;
                setAllSubTypeOptions(allOptions);
              }
            } catch (e) {}
          }
          
          setFilterConfig(config);
          
          // Initialize slider values
          const initialSliders: Record<string, [number, number]> = {};
          config.forEach((f: FilterConfig) => {
            if (f.type === 'slider') {
              initialSliders[f.field] = [f.min || 0, f.max || 100];
            }
          });
          setSliderValues(initialSliders);
          setTempSliderValues(initialSliders);
        }
      } catch (err) {
        console.error('Filter config error:', err);
      }
    };
    
    // Load recent searches from localStorage
    try {
      const saved = localStorage.getItem('recentPropertySearches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch (e) {}
    
    loadFilterConfig();
  }, [backendUrlLoaded, backendUrl]);

  // ============ LOAD PROPERTIES ============
  const loadProperties = useCallback(async (page = 1, append = false, customFilters?: Record<string, any>) => {
    if (!backendUrlLoaded) return; // Wait for backend URL to be loaded
    
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      const apiFilters: any = customFilters || { ...filters };
      
      // Convert filter format for API
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
        apiFilters.priceMin = apiFilters.ListPrice[0];
        apiFilters.priceMax = apiFilters.ListPrice[1];
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
      
      const res = await fetch(`${backendUrl}/api/supabase/live-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filters: apiFilters, 
          page, 
          limit: itemsPerPage,
          sortOrder: filters.sort || sortOrder
        })
      });
      const data = await res.json();

      if (data.success && data.data?.properties) {
        const props = data.data.properties.map((p: any) => ({
          id: p.mls_number,
          mls_number: p.mls_number,
          address: p.address,
          city: p.city,
          subdivision: p.subdivision || p.subdivision_name,
          price: parseFloat(p.price) || 0,
          bedrooms: parseInt(p.bedrooms) || 0,
          bathrooms: parseInt(p.bathrooms_full) || parseInt(p.bathrooms) || 0,
          square_feet: parseInt(p.square_feet) || parseInt(p.sqft) || null,
          property_type: p.property_type,
          property_sub_type: p.property_sub_type,
          images: p.images || [],
          latitude: parseFloat(p.latitude),
          longitude: parseFloat(p.longitude),
          office_name: p.office_name,
          lot_size: parseFloat(p.lot_size) || null,
          lot_size_acres: parseFloat(p.lot_size_acres) || null,
        }));
        setProperties(prev => append ? [...prev, ...props] : props);
        if (data.pagination) {
          setTotalItems(data.pagination.total_items);
          setTotalPages(data.pagination.total_pages || Math.ceil(data.pagination.total_items / itemsPerPage));
          setHasMore(data.pagination.has_next);
          setCurrentPage(page);
        }
      }
    } catch (err) {
      console.error('Load properties error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, itemsPerPage, sortOrder, backendUrlLoaded, backendUrl]);

  // ============ UPDATE PROPERTIES BY MAP BOUNDS ============
  const updatePropertiesByMapBounds = useCallback(async () => {
    if (!map.current || !enableBoundsFiltering.current || drawnPolygonRef.current) return;
    
    const bounds = map.current.getBounds();
    if (!bounds) return;
    
    // Store current bounds for reference
    currentBounds.current = {
      minLat: bounds.getSouth(),
      maxLat: bounds.getNorth(),
      minLng: bounds.getWest(),
      maxLng: bounds.getEast()
    };
    
    console.log('🗺️ Updating properties by map bounds:', currentBounds.current);
    
    try {
      setLoading(true);
      
      // Build API filters - include current filters PLUS bounds
      const apiFilters: any = {
        minLat: currentBounds.current.minLat,
        maxLat: currentBounds.current.maxLat,
        minLng: currentBounds.current.minLng,
        maxLng: currentBounds.current.maxLng
      };
      
      // Include current filter state
      if (filters.cities?.length > 0) apiFilters.cities = filters.cities;
      if (filters.neighbourhoods?.length > 0) apiFilters.neighbourhoods = filters.neighbourhoods;
      if (filters.addresses?.length > 0) apiFilters.addresses = filters.addresses;
      if (filters.PropertyType) {
        apiFilters.propertyTypes = Array.isArray(filters.PropertyType) ? filters.PropertyType : [filters.PropertyType];
      }
      if (filters.PropertySubType) {
        apiFilters.propertySubTypes = Array.isArray(filters.PropertySubType) ? filters.PropertySubType : [filters.PropertySubType];
      }
      if (filters.ListPrice) {
        apiFilters.priceMin = filters.ListPrice[0];
        apiFilters.priceMax = filters.ListPrice[1];
      }
      if (filters.BedroomsTotal && filters.BedroomsTotal !== 'any') {
        apiFilters.bedsMin = parseInt(String(filters.BedroomsTotal).replace('+', ''));
      }
      if (filters.BathroomsTotal && filters.BathroomsTotal !== 'any') {
        apiFilters.bathsMin = parseInt(String(filters.BathroomsTotal).replace('+', ''));
      }
      
      console.log('🗺️ API filters with bounds:', apiFilters);
      
      const res = await fetch(`${backendUrl}/api/supabase/live-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filters: apiFilters, 
          page: 1, 
          limit: itemsPerPage,
          sortOrder: filters.sort || sortOrder
        })
      });
      
      const data = await res.json();
      
      if (data.success && data.data?.properties) {
        const props = data.data.properties.map((p: any) => ({
          mls_number: p.mls_number,
          listing_id: p.listing_id,
          address: p.address,
          city: p.city,
          state: p.state || 'AB',
          subdivision: p.subdivision || p.subdivision_name,
          price: parseFloat(p.price) || 0,
          bedrooms: parseInt(p.bedrooms) || 0,
          bathrooms: parseInt(p.bathrooms_full) || parseInt(p.bathrooms) || 0,
          square_feet: parseInt(p.square_feet) || parseInt(p.sqft) || null,
          property_type: p.property_type,
          property_sub_type: p.property_sub_type,
          images: p.images || [],
          latitude: parseFloat(p.latitude),
          longitude: parseFloat(p.longitude),
          office_name: p.office_name,
          lot_size: parseFloat(p.lot_size) || null,
          lot_size_acres: parseFloat(p.lot_size_acres) || null,
        }));
        
        setProperties(props);
        
        if (data.pagination) {
          setTotalItems(data.pagination.total_items);
          setTotalPages(data.pagination.total_pages || Math.ceil(data.pagination.total_items / itemsPerPage));
          setHasMore(data.pagination.has_next);
          setCurrentPage(1);
        }
      }
    } catch (err) {
      console.error('Update by bounds error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, itemsPerPage, sortOrder, backendUrl]);

  // Debounced version to prevent too many calls during pan/zoom
  const debouncedUpdateByBounds = useCallback(() => {
    if (boundsUpdateTimer.current) {
      clearTimeout(boundsUpdateTimer.current);
    }
    boundsUpdateTimer.current = setTimeout(() => {
      updatePropertiesByMapBounds();
    }, 500);
  }, [updatePropertiesByMapBounds]);

  // ============ SEARCH FUNCTIONALITY ============
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSearchSubmitted(false);
    
    if (value.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    // Clear existing timer
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    // Debounce API call
    searchDebounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${backendUrlRef.current}/api/mls/search-suggestions?query=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (data.success) {
          setSearchSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.error('Search suggestions error:', err);
        setSearchSuggestions([]);
      }
    }, 300);
  }, []);

  const handleSearchSelect = useCallback(async (item: SearchSuggestion) => {
    // Save to recent searches
    const newRecent = [item, ...recentSearches.filter(r => r.value !== item.value)].slice(0, 5);
    setRecentSearches(newRecent);
    try { localStorage.setItem('recentPropertySearches', JSON.stringify(newRecent)); } catch (e) {}
    
    setSearchQuery(item.label);
    setSearchSubmitted(true);
    setSearchDropdownOpen(false);
    
    // Apply search based on type
    if (item.type === 'city') {
      console.log('🔍 City selected:', item.value);
      setFilters({ cities: [item.value] });
      enableBoundsFiltering.current = false;
      
      // Fit map to city
      try {
        const res = await fetch(`${backendUrlRef.current}/api/supabase/map-pins-lite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters: { cities: [item.value] } })
        });
        const data = await res.json();
        
        if (map.current && data.pins && data.pins.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          data.pins.forEach((pin: any) => {
            if (pin.lng && pin.lat) {
              bounds.extend([parseFloat(pin.lng), parseFloat(pin.lat)]);
            }
          });
          map.current.fitBounds(bounds, { padding: 50, maxZoom: 12, duration: 1500 });
          setTimeout(() => { enableBoundsFiltering.current = true; }, 1600);
        } else {
          const coords = cityCenters[item.value.toLowerCase()] || cityCenters['calgary'];
          map.current?.flyTo({ center: coords, zoom: 11, duration: 1500 });
        }
      } catch (e) {}
      
    } else if (item.type === 'neighbourhood') {
      console.log('🔍 Neighbourhood selected:', item.value);
      setFilters({ neighbourhoods: [item.value] });
      enableBoundsFiltering.current = false;
      
      // Fit map to neighbourhood pins
      try {
        const res = await fetch(`${backendUrlRef.current}/api/supabase/map-pins-lite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters: { neighbourhoods: [item.value] } })
        });
        const data = await res.json();
        
        if (map.current && data.pins && data.pins.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          data.pins.forEach((pin: any) => {
            if (pin.lng && pin.lat) {
              bounds.extend([parseFloat(pin.lng), parseFloat(pin.lat)]);
            }
          });
          map.current.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1500 });
          setTimeout(() => { enableBoundsFiltering.current = true; }, 1600);
        }
      } catch (e) {}
      
    } else if (item.type === 'address') {
      console.log('🔍 Address selected:', item.value);
      setFilters({ addresses: [item.value] });
      enableBoundsFiltering.current = false;
      
      // Fit map to address pins
      try {
        const res = await fetch(`${backendUrlRef.current}/api/supabase/map-pins-lite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters: { addresses: [item.value] } })
        });
        const data = await res.json();
        
        if (map.current && data.pins && data.pins.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          data.pins.forEach((pin: any) => {
            if (pin.lng && pin.lat) {
              bounds.extend([parseFloat(pin.lng), parseFloat(pin.lat)]);
            }
          });
          map.current.fitBounds(bounds, { padding: 100, maxZoom: 16, duration: 1500 });
          setTimeout(() => { enableBoundsFiltering.current = true; }, 1600);
        }
      } catch (e) {}
      
    } else if (item.type === 'mls') {
      // Direct navigation to property - build SEO slug from the search label
      // Label format: "A2277140 - 9 Ghost Road, Benchlands, Cochrane"
      const parts = item.label.split(' - ');
      const mlsNum = parts[0]?.trim() || item.value;
      const addrParts = (parts[1] || '').split(',').map(s => s.trim());
      const address = addrParts[0] || '';
      const neighbourhood = addrParts[1] || '';
      const city = addrParts[2] || addrParts[1] || '';
      window.open(getNextJsPropertyUrl({ mls_number: mlsNum, address, city, subdivision: neighbourhood }, listingTheme, assignedAgentId), openInNewWindow ? '_blank' : '_self');
    }
  }, [recentSearches, theme, assignedAgentId, openInNewWindow]);

  const handleCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (map.current) {
            map.current.flyTo({ center: [longitude, latitude], zoom: 13, duration: 1500 });
            enableBoundsFiltering.current = true;
            setTimeout(() => {
              if (map.current) {
                const bounds = map.current.getBounds();
                if (bounds) {
                  loadProperties(1, false, {
                    minLat: bounds.getSouth(),
                    maxLat: bounds.getNorth(),
                    minLng: bounds.getWest(),
                    maxLng: bounds.getEast()
                  });
                }
              }
            }, 1600);
          }
        },
        (error) => console.error('Geolocation error:', error)
      );
    }
    setSearchDropdownOpen(false);
  }, [loadProperties]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchSubmitted(false);
    setSearchDropdownOpen(false);
    
    const clearedFilters = { ...filters };
    delete clearedFilters.cities;
    delete clearedFilters.neighbourhoods;
    delete clearedFilters.addresses;
    setFilters(clearedFilters);
    
    enableBoundsFiltering.current = true;
    loadProperties(1, false, clearedFilters);
  }, [filters, loadProperties]);

  // ============ FILTER HANDLERS ============
  const handleMultiSelectToggle = (field: string, value: string) => {
    setMultiSelectValues(prev => {
      const current = prev[field] || [];
      if (value === 'all') {
        return { ...prev, [field]: [] };
      }
      const isSelected = current.includes(value);
      const newValues = isSelected ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [field]: newValues };
    });
  };

  const applyMultiSelect = (field: string) => {
    const selected = multiSelectValues[field] || [];
    setFilters(prev => {
      const newFilters = { ...prev };
      if (selected.length === 0) {
        delete newFilters[field];
      } else {
        newFilters[field] = selected;
      }
      return newFilters;
    });
    setOpenFilter(null);
  };

  const handleDropdownChange = (field: string, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (value === 'any' || value === 'all') {
        delete newFilters[field];
      } else {
        newFilters[field] = value;
      }
      return newFilters;
    });
    setOpenFilter(null);
  };

  const handleSliderChange = (field: string, value: [number, number]) => {
    setTempSliderValues(prev => ({ ...prev, [field]: value }));
  };

  const applySliderFilter = (field: string, config: FilterConfig) => {
    const value = tempSliderValues[field];
    setFilters(prev => {
      const newFilters = { ...prev };
      if (value[0] !== config.min || value[1] !== config.max) {
        newFilters[field] = value;
      } else {
        delete newFilters[field];
      }
      return newFilters;
    });
    setSliderValues(prev => ({ ...prev, [field]: value }));
    setOpenFilter(null);
  };

  const resetSlider = (field: string, config: FilterConfig) => {
    const defaultValue: [number, number] = [config.min || 0, config.max || 100];
    setTempSliderValues(prev => ({ ...prev, [field]: defaultValue }));
    setSliderValues(prev => ({ ...prev, [field]: defaultValue }));
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[field];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    const preservedFilters: any = {};
    if (filters.cities) preservedFilters.cities = filters.cities;
    if (filters.neighbourhoods) preservedFilters.neighbourhoods = filters.neighbourhoods;
    setFilters(preservedFilters);
    setMultiSelectValues({});
    
    const resetSliders: Record<string, [number, number]> = {};
    filterConfig.forEach(config => {
      if (config.type === 'slider') {
        resetSliders[config.field] = [config.min || 0, config.max || 100];
      }
    });
    setSliderValues(resetSliders);
    setTempSliderValues(resetSliders);
  };

  const hasActiveFilters = () => {
    return Object.keys(filters).filter(key => 
      key !== 'sort' && key !== 'cities' && key !== 'neighbourhoods' && key !== 'addresses'
    ).length > 0;
  };

  const getFilterLabel = (filter: FilterConfig): string => {
    const value = filters[filter.field];
    
    if (filter.field === 'PropertyType') {
      if (!value) return 'All types';
      if (Array.isArray(value) && value.length === 1) return value[0];
      if (Array.isArray(value) && value.length > 1) return `${filter.label} (${value.length})`;
      return value;
    }
    
    if (!value) return filter.label;
    
    if (filter.field === 'PropertySubType' && Array.isArray(value)) {
      if (value.length === 1) return value[0];
      if (value.length > 1) return `${filter.label}s (${value.length})`;
    }
    
    if (filter.type === 'dropdown') {
      const option = filter.options?.find(opt => opt.value === value);
      if (option && option.value !== 'any' && option.value !== 'all') {
        if (filter.field === 'BedroomsTotal' || filter.field === 'BathroomsTotal') {
          return `${option.label} ${filter.label}`;
        }
        return option.label;
      }
    }
    
    if (filter.type === 'slider' && Array.isArray(value)) {
      if (filter.field === 'ListPrice') {
        const configMax = filter.max || 5000000;
        if (value[0] > (filter.min || 0) && value[1] >= configMax) {
          return `${formatCurrency(value[0])}+`;
        } else if (value[0] > (filter.min || 0) || value[1] < configMax) {
          return `${formatCurrency(value[0])} - ${formatCurrency(value[1])}`;
        }
      }
    }
    
    return filter.label;
  };

  // ============ MAP PIN CREATION ============
  const createPriceMarker = useCallback((props: any, coords: [number, number]) => {
    if (!map.current) return;
    
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="marker-content" style="
        background: white;
        color: black;
        padding: 3px 7px;
        border-radius: 20px;
        border: 2px solid rgba(0,0,0,0.1);
        font-weight: 500;
        font-size: 15px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        font-family: Jost, sans-serif;
        white-space: nowrap;
      ">${formatMarkerPrice(props.price)}</div>
    `;

    const popupBg = isDark ? '#18181b' : '#ffffff';
    const priceColor = isDark ? '#ffffff' : '#000000';
    const addressColor = isDark ? '#d4d4d4' : '#333333';
    const metaColor = isDark ? '#a3a3a3' : '#666666';
    const propertyUrl = getNextJsPropertyUrl({
      mls_number: props.listing_id,
      address: props.address,
      city: props.city,
      subdivision: props.neighbourhood
    }, listingTheme, assignedAgentId);
    const thumbnailUrl = `https://mlsmedia.inthehood.io/property-images/${props.listing_id}/full/${props.listing_id}-1.webp`;

    // Smart meta for popup — check property type from GeoJSON properties
    const pt = (props.property_type || '').toLowerCase();
    const pst = (props.property_sub_type || '').toLowerCase();
    const popupIsLand = LAND_TYPES.includes(pt) || LAND_SUBTYPES.includes(pst);
    const popupIsCommercial = COMMERCIAL_TYPES.includes(pt) || COMMERCIAL_SUBTYPES.includes(pst);
    
    // Smart address for popup
    const popupAddr = (props.address || '').trim();
    const cleanAddr = (!popupAddr || /^(none\s*)+$/i.test(popupAddr) || /none\s+none/i.test(popupAddr)) ? 'Address Not Available' : popupAddr;
    const popupCity = (props.city || '').trim();

    let metaHtml = '';
    if (popupIsLand) {
      // Land: show lot size (acres preferred, then sqft)
      if (props.lot_size_acres && props.lot_size_acres > 0) {
        const lotDisplay = props.lot_size_acres >= 1 ? `${parseFloat(props.lot_size_acres).toFixed(1)} Acres` : `${Math.round(props.lot_size_acres * 43560).toLocaleString()} Sqft`;
        metaHtml = `<div><div style="font-size: 16px; font-weight: 600; color: ${priceColor};">${lotDisplay}</div><div style="font-size: 12px; color: ${metaColor};">Lot</div></div>`;
      } else if (props.lot_size && props.lot_size > 0) {
        metaHtml = `<div><div style="font-size: 16px; font-weight: 600; color: ${priceColor};">${Math.round(props.lot_size).toLocaleString()} Sqft</div><div style="font-size: 12px; color: ${metaColor};">Lot</div></div>`;
      } else if (props.sqft) {
        metaHtml = `<div><div style="font-size: 16px; font-weight: 600; color: ${priceColor};">${Math.round(props.sqft).toLocaleString()} Sqft</div><div style="font-size: 12px; color: ${metaColor};">Lot</div></div>`;
      }
    } else if (popupIsCommercial) {
      // Commercial: show sqft, no beds
      if (props.sqft) metaHtml += `<div><div style="font-size: 16px; font-weight: 600; color: ${priceColor};">${Math.round(props.sqft).toLocaleString()}</div><div style="font-size: 12px; color: ${metaColor};">Sqft</div></div>`;
      if (props.bathrooms && props.bathrooms > 0) metaHtml += `<div><div style="font-size: 16px; font-weight: 600; color: ${priceColor};">${props.bathrooms}</div><div style="font-size: 12px; color: ${metaColor};">Baths</div></div>`;
    } else {
      // Residential: beds, baths, sqft
      if (props.bedrooms != null && props.bedrooms > 0) metaHtml += `<div><div style="font-size: 16px; font-weight: 600; color: ${priceColor};">${props.bedrooms}</div><div style="font-size: 12px; color: ${metaColor};">Beds</div></div>`;
      if (props.bathrooms && props.bathrooms > 0) metaHtml += `<div><div style="font-size: 16px; font-weight: 600; color: ${priceColor};">${props.bathrooms}</div><div style="font-size: 12px; color: ${metaColor};">Baths</div></div>`;
      if (props.sqft) metaHtml += `<div><div style="font-size: 16px; font-weight: 600; color: ${priceColor};">${Math.round(props.sqft).toLocaleString()}</div><div style="font-size: 12px; color: ${metaColor};">Sqft</div></div>`;
    }

    const popup = new mapboxgl.Popup({
      offset: 25, closeButton: true, closeOnClick: true, maxWidth: '500px', className: 'custom-popup'
    }).setHTML(`
      <div onclick="window.open('${propertyUrl}', '${openInNewWindow ? '_blank' : '_self'}')" 
           style="display: flex; gap: 16px; padding: 16px; font-family: Jost, sans-serif; width: 450px; cursor: pointer; background-color: ${popupBg};">
        <div style="width: 180px; height: 180px; flex-shrink: 0; border-radius: 12px; overflow: hidden; background-color: #f0f0f0;">
          <img src="${thumbnailUrl}" alt="${cleanAddr}" onerror="this.style.display='none'" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="font-size: 24px; font-weight: 600; margin-bottom: 8px; color: ${priceColor};">${formatFullPrice(props.price)}</div>
          <div style="font-size: 14px; color: ${addressColor}; margin-bottom: 12px; line-height: 1.5;">${cleanAddr}${popupCity ? '<br/>' + popupCity : ''}</div>
          <div style="display: flex; gap: 24px; margin-bottom: 12px;">${metaHtml}</div>
          ${props.brokerage ? `<div style="font-size: 12px; color: ${metaColor}; margin-top: auto;">Listed by ${props.brokerage}</div>` : ''}
        </div>
      </div>
    `);

    el.addEventListener('click', () => {
      if (currentPopup.current && currentPopup.current !== popup) currentPopup.current.remove();
      currentPopup.current = popup;
    });
    popup.on('close', () => { if (currentPopup.current === popup) currentPopup.current = null; });

    const marker = new mapboxgl.Marker(el).setLngLat(coords).setPopup(popup).addTo(map.current);
    markers.current.push(marker);
    markersMap.current.set(props.listing_id, { marker, element: el });
  }, [isDark, theme, assignedAgentId, openInNewWindow]);

  const createBuildingMarker = useCallback((units: any[], coords: [number, number]) => {
    if (!map.current) return;
    
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="background: white; color: black; padding: 3px 7px; border-radius: 20px; border: 2px solid rgba(0,0,0,0.1); font-weight: 500; font-size: 15px; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.2); font-family: Jost, sans-serif; display: flex; align-items: center; gap: 2px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 20V2H3v18H1v2h22v-2h-2zM8 19H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V9h2v2zm0-4H6V5h2v2zm4 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm4 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2z"/></svg>
        <span style="font-weight: 500;">${units.length}</span>
      </div>
    `;

    const popupBg = isDark ? '#18181b' : '#ffffff';
    const priceColor = isDark ? '#ffffff' : '#000000';
    const addressColor = isDark ? '#d4d4d4' : '#333333';
    const metaColor = isDark ? '#a3a3a3' : '#666666';
    
    // Extract base street address (without unit number)
    const firstAddress = units[0]?.address || '';
    const addressParts = firstAddress.split(',').map((s: string) => s.trim());
    let baseAddress = '';
    if (addressParts.length >= 2) {
      if (/^\d+$/.test(addressParts[0]) || /^#?\d+[A-Za-z]?$/.test(addressParts[0])) {
        baseAddress = addressParts[1];
      } else {
        baseAddress = addressParts[0];
      }
    } else {
      baseAddress = firstAddress;
    }

    const unitsHtml = units.map((unit: any, idx: number) => {
      const fullPrice = formatFullPrice(parseFloat(unit.price));
      const thumbnailUrl = `https://mlsmedia.inthehood.io/property-images/${unit.listing_id}/full/${unit.listing_id}-1.webp`;
      const propertyUrl = getNextJsPropertyUrl({
        mls_number: unit.listing_id,
        address: unit.address,
        city: unit.city,
        subdivision: unit.neighbourhood
      }, listingTheme, assignedAgentId);
      const bgColorUnit = isDark ? '#18181b' : '#ffffff';
      const borderColorUnit = idx < units.length - 1 ? '#e5e7eb' : 'transparent';
      
      const beds = unit.bedrooms != null ? `<div><div style="font-size: 18px; font-weight: 600; color: ${priceColor};">${unit.bedrooms === 0 ? 'Studio' : unit.bedrooms}</div><div style="font-size: 12px; color: ${metaColor};">${unit.bedrooms === 0 ? '' : 'Beds'}</div></div>` : '';
      const baths = unit.bathrooms ? `<div><div style="font-size: 18px; font-weight: 600; color: ${priceColor};">${unit.bathrooms}</div><div style="font-size: 12px; color: ${metaColor};">Baths</div></div>` : '';
      const sqft = unit.sqft ? `<div><div style="font-size: 18px; font-weight: 600; color: ${priceColor};">${Math.round(unit.sqft).toLocaleString()}</div><div style="font-size: 12px; color: ${metaColor};">Sqft</div></div>` : '';
      
      return `
        <div onclick="window.open('${propertyUrl}', '${openInNewWindow ? '_blank' : '_self'}')" style="display: flex; gap: 14px; padding: 14px; cursor: pointer; background-color: ${bgColorUnit}; border-bottom: 1px solid ${borderColorUnit};">
          <img src="${thumbnailUrl}" alt="${unit.address}" onerror="this.src='/placeholder.svg'" style="width: 140px; height: 140px; object-fit: cover; border-radius: 10px; flex-shrink: 0;" />
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 22px; font-weight: 600; margin-bottom: 6px; color: ${priceColor};">${fullPrice}</div>
            <div style="font-size: 14px; color: ${addressColor}; margin-bottom: 10px; line-height: 1.4;">${unit.address}</div>
            <div style="display: flex; gap: 18px; font-family: Jost, sans-serif;">${beds}${baths}${sqft}</div>
          </div>
        </div>
      `;
    }).join('');

    const popup = new mapboxgl.Popup({
      offset: 25, closeButton: true, closeOnClick: true, maxWidth: '680px', className: 'custom-popup'
    }).setHTML(`
      <div style="font-family: Jost, sans-serif; background: white;">
        <div style="padding: 16px; border-bottom: 1px solid #e5e7eb; background: white;">
          <div style="font-weight: 600; font-size: 19px; color: #000; margin-bottom: 4px;">${baseAddress}</div>
          <div style="color: #666; font-size: 14px; font-weight: 400;">${units.length} unit${units.length > 1 ? 's' : ''} for sale</div>
        </div>
        <div style="max-height: 260px; overflow-y: auto; background: white;">${unitsHtml}</div>
      </div>
    `);

    el.addEventListener('click', () => {
      if (currentPopup.current && currentPopup.current !== popup) currentPopup.current.remove();
      currentPopup.current = popup;
    });
    popup.on('close', () => { if (currentPopup.current === popup) currentPopup.current = null; });

    const marker = new mapboxgl.Marker(el).setLngLat(coords).setPopup(popup).addTo(map.current);
    markers.current.push(marker);
  }, [isDark, theme, assignedAgentId, openInNewWindow]);

  // ============ UPDATE CLUSTER MARKERS (SUPERCLUSTER) ============
  const updateClusterMarkers = useCallback(() => {
    if (!map.current || !superclusterRef.current) return;
    if (currentPopup.current) return;

    markers.current.forEach(m => m.remove());
    markers.current = [];
    markersMap.current.clear();

    const bounds = map.current.getBounds();
    if (!bounds) return;
    const zoom = Math.floor(map.current.getZoom());
    const bbox: [number, number, number, number] = [
      bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()
    ];
    
    const features = superclusterRef.current.getClusters(bbox, zoom);
    const addedClusters = new Set<string>();

    features.forEach((feature: any) => {
      const coords = feature.geometry.coordinates as [number, number];
      const props = feature.properties;
      const id = props.cluster_id !== undefined ? `cluster_${props.cluster_id}` : `${coords[0]},${coords[1]}`;

      if (addedClusters.has(id)) return;
      addedClusters.add(id);

      // Staggered fade-in delay (max 400ms spread across all markers)

      if (props.cluster) {
        const el = document.createElement('div');
        el.innerHTML = `<div style="background:white;color:black;padding:3px 7px;border-radius:20px;border:2px solid rgba(0,0,0,0.1);font-weight:500;font-size:15px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.2);font-family:Jost,sans-serif;display:flex;align-items:center;gap:2px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg><span style="font-weight:500;">${props.point_count}</span></div>`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!superclusterRef.current || !map.current) return;
          try {
            const expansionZoom = superclusterRef.current.getClusterExpansionZoom(props.cluster_id);
            map.current.easeTo({ center: coords, zoom: expansionZoom + 1, duration: 500 });
          } catch (err) {
            map.current.easeTo({ center: coords, zoom: map.current.getZoom() + 2, duration: 500 });
          }
        });
        const marker = new mapboxgl.Marker(el).setLngLat(coords).addTo(map.current!);
        markers.current.push(marker);
      } else if (props.is_building && props.building_units) {
        const units = typeof props.building_units === 'string' ? JSON.parse(props.building_units) : props.building_units;
        createBuildingMarker(units, coords);
      } else {
        createPriceMarker(props, coords);
      }
    });
  }, [createPriceMarker, createBuildingMarker]);

  // ============ LOAD MAP PINS (SUPERCLUSTER + STATIC GEOJSON) ============
  const loadMapPins = useCallback(async (currentFilters = filters) => {
    if (!map.current) return;
    
    // Use ref for GeoJSON fetch to prevent stale closure URL issue
    const geoJsonUrl = backendUrlRef.current;
    if (!geoJsonUrl) {
      console.log('⏳ Map pins: Waiting for backend URL...');
      return;
    }
    
    const skipFitBoundsThisCall = shouldSkipFitBounds.current;
    shouldSkipFitBounds.current = false;

    try {
      // STEP 1: Fetch static GeoJSON (once, cached)
      if (!cachedGeoJSON.current) {
        console.log('📡 Fetching static GeoJSON from:', `${geoJsonUrl}/api/map/geojson`);
        const res = await fetch(`${geoJsonUrl}/api/map/geojson`);
        if (!res.ok) {
          console.error(`❌ GeoJSON fetch failed: ${res.status}`);
          return;
        }
        const rawGeoJSON = await res.json();
        console.log(`✅ Loaded ${rawGeoJSON.features?.length || 0} features from static GeoJSON`);
        
        // Expand abbreviated property names and filter out fly-away pins (bad coordinates)
        const ALBERTA_BOUNDS = { minLng: -121, maxLng: -109, minLat: 48.5, maxLat: 60.5 };
        cachedGeoJSON.current = {
          ...rawGeoJSON,
          features: rawGeoJSON.features.map((f: any) => {
            const p = f.properties;
            return {
              type: 'Feature',
              geometry: f.geometry,
              properties: {
                listing_id: p.id || p.listing_id,
                price: p.p !== undefined ? p.p : (p.price || 0),
                bedrooms: p.bd !== undefined ? p.bd : p.bedrooms,
                bathrooms: p.ba !== undefined ? p.ba : p.bathrooms,
                property_type: p.pt || p.property_type || '',
                structure_type: p.st || p.structure_type || '',
                property_sub_type: p.ps || p.property_sub_type || '',
                city: p.ct || p.city || '',
                subdivision: p.cn || p.subdivision || '',
                address: (p.sa || p.address || '').trim(),
                sqft: p.sf !== undefined ? p.sf : p.sqft,
                photo_count: p.pc !== undefined ? p.pc : (p.photo_count || 0),
                brokerage: p.br || p.brokerage || '',
                lot_size: p.ls !== undefined ? p.ls : p.lot_size,
                lot_size_acres: p.la !== undefined ? p.la : p.lot_size_acres,
              }
            };
          }).filter((f: any) => {
            const [lng, lat] = f.geometry.coordinates;
            return lng >= ALBERTA_BOUNDS.minLng && lng <= ALBERTA_BOUNDS.maxLng && 
                   lat >= ALBERTA_BOUNDS.minLat && lat <= ALBERTA_BOUNDS.maxLat;
          })
        };
      }
      
      const allFeatures = cachedGeoJSON.current.features;
      if (!allFeatures || allFeatures.length === 0) return;
      
      // STEP 2: Filter features within Alberta bounds (tighter than before)
      // Alberta: lat 49-60, lng -120 to -110
      let filteredFeatures = allFeatures.filter((f: any) => {
        const [lng, lat] = f.geometry.coordinates;
        return lat >= 49 && lat <= 60 && lng >= -120.5 && lng <= -109.5;
      });
      
      // STEP 3: Apply client-side filters
      const filterPropertyTypes = currentFilters.PropertyType 
        ? (Array.isArray(currentFilters.PropertyType) ? currentFilters.PropertyType : [currentFilters.PropertyType]) : [];
      const filterSubTypes = currentFilters.PropertySubType
        ? (Array.isArray(currentFilters.PropertySubType) ? currentFilters.PropertySubType : [currentFilters.PropertySubType]) : [];
      const filterCities = currentFilters.cities?.length > 0 ? currentFilters.cities : [];
      const filterNeighbourhoods = currentFilters.neighbourhoods?.length > 0 ? currentFilters.neighbourhoods : [];
      const filterAddresses = currentFilters.addresses?.length > 0 ? currentFilters.addresses : [];
      
      const hasFilters = filterPropertyTypes.length > 0 || filterSubTypes.length > 0 || 
        filterCities.length > 0 || filterNeighbourhoods.length > 0 || filterAddresses.length > 0 ||
        currentFilters.ListPrice || currentFilters.BedroomsTotal || currentFilters.BathroomsTotal;
      
      if (hasFilters) {
        filteredFeatures = filteredFeatures.filter((f: any) => {
          const p = f.properties;
          if (filterPropertyTypes.length > 0 && !filterPropertyTypes.some((t: string) => 
            p.property_type?.toLowerCase() === t.toLowerCase()
          )) return false;
          if (filterSubTypes.length > 0 && !filterSubTypes.some((t: string) => 
            p.property_sub_type?.toLowerCase() === t.toLowerCase()
          )) return false;
          if (filterCities.length > 0 && !filterCities.some((c: string) => 
            p.city?.toLowerCase().includes(c.toLowerCase())
          )) return false;
          if (filterNeighbourhoods.length > 0 && !filterNeighbourhoods.some((n: string) => 
            p.subdivision?.toLowerCase().includes(n.toLowerCase())
          )) return false;
          if (filterAddresses.length > 0 && !filterAddresses.some((a: string) => 
            p.address?.toLowerCase().includes(a.toLowerCase())
          )) return false;
          if (currentFilters.ListPrice) {
            const [minP, maxP] = currentFilters.ListPrice;
            if (minP && p.price < minP) return false;
            if (maxP && p.price > maxP) return false;
          }
          if (currentFilters.BedroomsTotal && currentFilters.BedroomsTotal !== 'any') {
            if (p.bedrooms < parseInt(String(currentFilters.BedroomsTotal).replace('+', ''))) return false;
          }
          if (currentFilters.BathroomsTotal && currentFilters.BathroomsTotal !== 'any') {
            if (p.bathrooms < parseInt(String(currentFilters.BathroomsTotal).replace('+', ''))) return false;
          }
          return true;
        });
      }
      
      // STEP 4: Apply drawn polygon filter
      if (drawnPolygonRef.current?.geometry?.coordinates?.[0]) {
        const polygon = drawnPolygonRef.current.geometry.coordinates;
        filteredFeatures = filteredFeatures.filter((f: any) => {
          const [x, y] = f.geometry.coordinates;
          let inside = false;
          for (const ring of polygon) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
              const [xi, yi] = ring[i];
              const [xj, yj] = ring[j];
              if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
              }
            }
          }
          return inside;
        });
      }
      
      console.log(`🔍 After filtering: ${filteredFeatures.length} features`);
      
      // STEP 5: Pre-process building clusters (group by coordinates)
      const groups = new Map<string, any[]>();
      for (const f of filteredFeatures) {
        const [lng, lat] = f.geometry.coordinates;
        const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(f);
      }
      
      const processedFeatures: any[] = [];
      const groupEntries = Array.from(groups.values());
      for (const group of groupEntries) {
        if (group.length === 1) {
          processedFeatures.push(group[0]);
        } else {
          const units = group.map((f: any) => ({
            listing_id: f.properties.listing_id,
            address: f.properties.address,
            price: f.properties.price,
            bedrooms: f.properties.bedrooms,
            bathrooms: f.properties.bathrooms,
            sqft: f.properties.sqft,
          }));
          processedFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [
              group.reduce((s: number, f: any) => s + f.geometry.coordinates[0], 0) / group.length,
              group.reduce((s: number, f: any) => s + f.geometry.coordinates[1], 0) / group.length
            ]},
            properties: {
              is_building: true,
              building_units: JSON.stringify(units),
              listing_id: group[0].properties.listing_id,
              price: Math.min(...group.map((f: any) => f.properties.price || 0)),
              address: group[0].properties.address,
              city: group[0].properties.city,
              bedrooms: group[0].properties.bedrooms,
              bathrooms: group[0].properties.bathrooms,
              sqft: group[0].properties.sqft,
              brokerage: group[0].properties.brokerage,
            }
          });
        }
      }
      
      console.log(`🏢 After building clustering: ${processedFeatures.length} features`);
      
      // STEP 6: Build Supercluster index
      const index = new Supercluster({ radius: 80, maxZoom: 14, minZoom: 0, minPoints: 2 });
      index.load(processedFeatures as any);
      superclusterRef.current = index;
      console.log('✅ Supercluster index built');

      if (!map.current.isStyleLoaded()) {
        map.current.once('style.load', () => loadMapPins(currentFilters));
        return;
      }

      // Remove old Mapbox clustering layers if they exist
      if (map.current.getSource('properties')) {
        try {
          if (map.current.getLayer('clusters')) map.current.removeLayer('clusters');
          if (map.current.getLayer('cluster-count')) map.current.removeLayer('cluster-count');
          if (map.current.getLayer('unclustered-point')) map.current.removeLayer('unclustered-point');
          map.current.removeSource('properties');
        } catch (e) {}
      }

      // STEP 7: Set up event handlers (once) - with mapReady guard + debounce
      if (!mapEventHandlersSetup.current) {
        mapEventHandlersSetup.current = true;
        let renderTimer: NodeJS.Timeout | null = null;
        const debouncedRender = () => {
          if (!mapReady.current) return;
          if (renderTimer) clearTimeout(renderTimer);
          renderTimer = setTimeout(() => updateClusterMarkers(), 150);
        };
        
        map.current.on('dragstart', () => {
          if (mapReady.current && !drawnPolygonRef.current) {
            enableBoundsFiltering.current = true;
          }
        });
        
        map.current.on('moveend', () => {
          debouncedRender();
          // Update property list based on new map bounds
          if (mapReady.current && enableBoundsFiltering.current && !drawnPolygonRef.current) {
            debouncedUpdateByBounds();
          }
        });
        
        map.current.on('zoomend', () => {
          debouncedRender();
          if (mapReady.current && !drawnPolygonRef.current) {
            enableBoundsFiltering.current = true;
          }
        });
      }

      // STEP 8: FitBounds and initial render
      const validCoords = processedFeatures.map((f: any) => f.geometry.coordinates)
        .filter(([lng, lat]: number[]) => !isNaN(lng) && !isNaN(lat));
      
      const hasBoundaryFilter = drawnPolygonRef.current !== null;
      const shouldFitBounds = validCoords.length > 0 && !skipFitBoundsThisCall && !hasBoundaryFilter && (isInitialLoad.current || !mapReady.current);

      if (shouldFitBounds) {
        console.log('📍 Flying to fit', validCoords.length, 'features');
        const bounds = new mapboxgl.LngLatBounds();
        validCoords.forEach(([lng, lat]: number[]) => bounds.extend([lng, lat]));
        map.current.fitBounds(bounds, { padding: 50, duration: 1500 });
        map.current.once('moveend', () => { 
          mapReady.current = true;
          isInitialLoad.current = false;
          updateClusterMarkers();
          setTimeout(() => { enableBoundsFiltering.current = true; }, 1000);
        });
      } else {
        updateClusterMarkers();
        if (!mapReady.current) setTimeout(() => { mapReady.current = true; }, 1000);
      }
    } catch (err) {
      console.error('Load map pins error:', err);
    }
  }, [filters, updateClusterMarkers]);

  // ============ DRAW AREA FUNCTIONALITY ============
  const startDrawing = useCallback(() => {
    if (!map.current) return;
    setIsDrawing(true);
    drawingPoints.current = [];
    map.current.dragPan.disable();
    map.current.scrollZoom.disable();
    map.current.doubleClickZoom.disable();
    
    if (!map.current.getSource('drawing-line')) {
      map.current.addSource('drawing-line', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
      map.current.addLayer({ id: 'drawing-line-layer', type: 'line', source: 'drawing-line', paint: { 'line-color': '#000000', 'line-width': 3, 'line-opacity': 0.8 } });
      map.current.addLayer({ id: 'drawing-fill-layer', type: 'fill', source: 'drawing-line', paint: { 'fill-color': '#000000', 'fill-opacity': 0.1 } });
    }
    
    const handleMouseDown = (e: any) => { e.preventDefault(); isMouseDown.current = true; drawingPoints.current = [[e.lngLat.lng, e.lngLat.lat]]; };
    const handleMouseMove = (e: any) => {
      if (!isMouseDown.current) return;
      const lastPoint = drawingPoints.current[drawingPoints.current.length - 1];
      const distance = Math.sqrt(Math.pow(e.lngLat.lng - lastPoint[0], 2) + Math.pow(e.lngLat.lat - lastPoint[1], 2));
      if (distance > 0.0001) {
        drawingPoints.current.push([e.lngLat.lng, e.lngLat.lat]);
        const source = map.current?.getSource('drawing-line') as mapboxgl.GeoJSONSource;
        if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: drawingPoints.current } });
      }
    };
    const handleMouseUp = async () => {
      if (!isMouseDown.current) return;
      isMouseDown.current = false;
      
      if (drawingPoints.current.length > 2) {
        drawingPoints.current.push(drawingPoints.current[0]);
        const polygon = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [drawingPoints.current] } };
        
        if (map.current?.getLayer('drawing-line-layer')) map.current.removeLayer('drawing-line-layer');
        if (map.current?.getLayer('drawing-fill-layer')) map.current.removeLayer('drawing-fill-layer');
        if (map.current?.getSource('drawing-line')) map.current.removeSource('drawing-line');
        
        if (!map.current?.getSource('drawn-polygon')) {
          map.current?.addSource('drawn-polygon', { type: 'geojson', data: polygon as any });
          map.current?.addLayer({ id: 'drawn-polygon-fill', type: 'fill', source: 'drawn-polygon', paint: { 'fill-color': '#ff9800', 'fill-opacity': 0.2 } });
          map.current?.addLayer({ id: 'drawn-polygon-outline', type: 'line', source: 'drawn-polygon', paint: { 'line-color': '#ff9800', 'line-width': 3, 'line-opacity': 0.8 } });
        }
        
        setDrawnPolygon(polygon);
        drawnPolygonRef.current = polygon;
        setIsDrawing(false);
        map.current?.dragPan.enable();
        map.current?.scrollZoom.enable();
        map.current?.doubleClickZoom.enable();
        
        // Filter properties by polygon via backend
        await filterPropertiesByPolygon(polygon);
        
        map.current?.off('mousedown', handleMouseDown);
        map.current?.off('mousemove', handleMouseMove);
        map.current?.off('mouseup', handleMouseUp);
        if (map.current) map.current.getCanvas().style.cursor = '';
      } else {
        cancelDrawing();
      }
    };
    
    setTimeout(() => {
      if (map.current) {
        map.current.on('mousedown', handleMouseDown);
        map.current.on('mousemove', handleMouseMove);
        map.current.on('mouseup', handleMouseUp);
        map.current.getCanvas().style.cursor = 'crosshair';
      }
    }, 100);
  }, []);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    isMouseDown.current = false;
    drawingPoints.current = [];
    if (map.current) { map.current.dragPan.enable(); map.current.scrollZoom.enable(); map.current.doubleClickZoom.enable(); }
    if (map.current?.getLayer('drawing-line-layer')) map.current.removeLayer('drawing-line-layer');
    if (map.current?.getLayer('drawing-fill-layer')) map.current.removeLayer('drawing-fill-layer');
    if (map.current?.getSource('drawing-line')) map.current.removeSource('drawing-line');
    if (map.current) map.current.getCanvas().style.cursor = '';
  }, []);

  const clearBounds = useCallback(() => {
    if (map.current?.getLayer('drawn-polygon-fill')) map.current.removeLayer('drawn-polygon-fill');
    if (map.current?.getLayer('drawn-polygon-outline')) map.current.removeLayer('drawn-polygon-outline');
    if (map.current?.getSource('drawn-polygon')) map.current.removeSource('drawn-polygon');
    setDrawnPolygon(null);
    drawnPolygonRef.current = null;
    loadProperties();
    shouldSkipFitBounds.current = true;
    loadMapPins();
  }, [loadProperties, loadMapPins]);

  const filterPropertiesByPolygon = useCallback(async (polygon: any) => {
    if (!polygon?.geometry?.coordinates?.[0]) return;
    setLoading(true);
    
    try {
      const apiFilters: any = { ...filters, polygon: polygon.geometry.coordinates[0] };
      
      // Convert filter format
      if (apiFilters.PropertyType) {
        apiFilters.propertyTypes = Array.isArray(apiFilters.PropertyType) ? apiFilters.PropertyType : [apiFilters.PropertyType];
        delete apiFilters.PropertyType;
      }
      if (apiFilters.PropertySubType) {
        apiFilters.propertySubTypes = Array.isArray(apiFilters.PropertySubType) ? apiFilters.PropertySubType : [apiFilters.PropertySubType];
        delete apiFilters.PropertySubType;
      }
      if (apiFilters.ListPrice) {
        apiFilters.priceMin = apiFilters.ListPrice[0];
        apiFilters.priceMax = apiFilters.ListPrice[1];
        delete apiFilters.ListPrice;
      }
      
      const res = await fetch(`${backendUrlRef.current}/api/supabase/live-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: apiFilters, limit: 10000 })
      });
      const data = await res.json();
      
      if (data.success && data.data?.properties) {
        const props = data.data.properties.map((p: any) => ({
          id: p.mls_number,
          mls_number: p.mls_number,
          address: p.address,
          city: p.city,
          subdivision: p.subdivision || p.subdivision_name,
          price: parseFloat(p.price) || 0,
          bedrooms: parseInt(p.bedrooms) || 0,
          bathrooms: parseInt(p.bathrooms_full) || parseInt(p.bathrooms) || 0,
          square_feet: parseInt(p.square_feet) || parseInt(p.sqft) || null,
          property_type: p.property_type,
          property_sub_type: p.property_sub_type,
          images: p.images || [],
          latitude: parseFloat(p.latitude),
          longitude: parseFloat(p.longitude),
          office_name: p.office_name,
          lot_size: parseFloat(p.lot_size) || null,
          lot_size_acres: parseFloat(p.lot_size_acres) || null,
        }));
        setProperties(props);
        setTotalItems(props.length);
        setHasMore(false);
        
        // CRITICAL: Create filtered GeoJSON with ONLY properties inside polygon and update map
        if (map.current) {
          const filteredGeojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: props.filter((p: any) => p.latitude && p.longitude).map((p: any) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
              properties: {
                listing_id: p.mls_number,
                price: p.price,
                address: p.address,
                city: p.city,
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms,
                sqft: p.square_feet,
                is_building: false,
                building_units: null
              }
            }))
          };
          
          // Rebuild Supercluster with ONLY the polygon-filtered features
          const index = new Supercluster({ radius: 80, maxZoom: 14, minZoom: 0, minPoints: 2 });
          index.load(filteredGeojson.features as any);
          superclusterRef.current = index;

          // Remove old source and add filtered one
          if (map.current.getSource('properties')) {
            try {
              if (map.current.getLayer('clusters')) map.current.removeLayer('clusters');
              if (map.current.getLayer('cluster-count')) map.current.removeLayer('cluster-count');
              if (map.current.getLayer('unclustered-point')) map.current.removeLayer('unclustered-point');
              map.current.removeSource('properties');
            } catch (e) {}
          }
          
          map.current.addSource('properties', { type: 'geojson', data: filteredGeojson, cluster: true, clusterMaxZoom: 14, clusterRadius: 80 });
          map.current.addLayer({ id: 'clusters', type: 'circle', source: 'properties', filter: ['has', 'point_count'], paint: { 'circle-opacity': 0 } });
          map.current.addLayer({ id: 'cluster-count', type: 'symbol', source: 'properties', filter: ['has', 'point_count'], layout: { 'text-field': '', 'text-size': 0 } });
          map.current.addLayer({ id: 'unclustered-point', type: 'circle', source: 'properties', filter: ['!', ['has', 'point_count']], paint: { 'circle-opacity': 0 } });
          
          // Fit map to polygon bounds
          const coordinates = polygon.geometry.coordinates[0];
          const bounds = new mapboxgl.LngLatBounds();
          coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
          map.current.fitBounds(bounds, { padding: 50, duration: 1500 });
          
          // Update markers after fit — now using the rebuilt supercluster with filtered data
          setTimeout(() => updateClusterMarkers(), 1100);
        }
      }
    } catch (err) {
      console.error('Filter by polygon error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, loadMapPins]);

  // ============ INITIALIZE MAP ============
  const initMap = useCallback(() => {
    if (!mapContainer.current || map.current) return;
    
    // Ensure container has dimensions before initializing
    const rect = mapContainer.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn('🗺️ Map container has zero dimensions, retrying in 500ms...');
      if (mapInitRetries.current < 5) {
        mapInitRetries.current++;
        setTimeout(initMap, 500);
      } else {
        setMapError('Map container failed to get dimensions. Please refresh the page.');
      }
      return;
    }
    
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      // Initialize map with Alberta bounds directly (not Calgary center)
      // This prevents the "flash" from Calgary to full bounds
      const albertaBounds: [[number, number], [number, number]] = [[-120, 49], [-110, 54.5]];
      
      map.current = new mapboxgl.Map({ 
        container: mapContainer.current, 
        style: 'mapbox://styles/mapbox/streets-v12', 
        bounds: albertaBounds,
        fitBoundsOptions: { padding: 20 },
        minZoom: mapMinZoom 
      });
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
      map.current.on('load', () => { 
        console.log('✅ Map loaded'); 
        mapReady.current = true;
        setMapError(null);
        // Don't load pins here - let the dedicated useEffect handle it when backendUrlLoaded is true
      });
      map.current.on('idle', () => { if (map.current?.getSource('properties')) updateClusterMarkers(); });
      
      // CRITICAL: Update properties when map is moved/zoomed
      map.current.on('moveend', () => {
        console.log('🗺️ Map moveend - checking if should update properties');
        if (mapReady.current && enableBoundsFiltering.current && !drawnPolygonRef.current) {
          console.log('✅ Updating properties by map bounds after move');
          debouncedUpdateByBounds();
        }
      });
      
      map.current.on('dragend', () => { 
        if (mapReady.current && !drawnPolygonRef.current) {
          enableBoundsFiltering.current = true;
        }
      });
      map.current.on('zoomend', () => { 
        if (mapReady.current && !drawnPolygonRef.current) {
          enableBoundsFiltering.current = true;
        }
      });
      
      console.log('✅ Map initialized successfully');
    } catch (err: any) {
      console.error('🗺️ Map initialization failed:', err?.message || err);
      
      // Retry up to 3 times with increasing delay
      if (mapInitRetries.current < 3) {
        mapInitRetries.current++;
        const delay = mapInitRetries.current * 1000; // 1s, 2s, 3s
        console.log(`🗺️ Retrying map init in ${delay}ms (attempt ${mapInitRetries.current}/3)...`);
        setTimeout(initMap, delay);
      } else {
        setMapError('Unable to initialize the map. Your browser may need a restart to restore WebGL. Click "Retry" or refresh the page.');
      }
    }
  }, [mapMinZoom, debouncedUpdateByBounds, updateClusterMarkers]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  // CRITICAL: Initial load - wait for BOTH backend URL loaded AND map ready
  // This is the SINGLE source of truth for initial data loading
  const initialLoadDone = useRef(false);
  useEffect(() => { 
    if (!backendUrlLoaded || !mapReady.current || !map.current || initialLoadDone.current) return;
    
    console.log('🚀 Initial load triggered - backendUrl:', backendUrl);
    initialLoadDone.current = true;
    loadProperties();
    loadMapPins(initialUrlFilters);
  }, [backendUrlLoaded, backendUrl, loadProperties, loadMapPins, initialUrlFilters]);
  
  // Reload when filters change (not on initial load)
  const filtersInitialized = useRef(false);
  useEffect(() => { 
    if (!backendUrl || !map.current) return;
    
    // Skip first run (initial load handled by map.on('load'))
    if (!filtersInitialized.current) {
      filtersInitialized.current = true;
      return;
    }
    
    loadProperties(); 
    shouldSkipFitBounds.current = true; 
    loadMapPins(filters);
  }, [filters, backendUrl, loadProperties, loadMapPins]);

  // ============ HANDLERS ============
  const handlePropertyClick = (property: any) => {
    window.open(getNextJsPropertyUrl(property, listingTheme, assignedAgentId), openInNewWindow ? '_blank' : '_self');
  };

  const handlePropertyHover = (property: any | null) => {
    setHoveredProperty(property);
    markersMap.current.forEach((data, id) => {
      const content = data.element.querySelector('.marker-content') as HTMLElement;
      if (content) {
        if (property && id === property.mls_number) { content.style.background = 'black'; content.style.color = 'white'; }
        else { content.style.background = 'white'; content.style.color = 'black'; }
      }
    });
  };

  const handleScroll = () => {
    if (!listContainerRef.current || loadingMore || !hasMore || paginationType !== 'infinite') return;
    const { scrollTop, scrollHeight, clientHeight } = listContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight * 0.8) loadProperties(currentPage + 1, true);
  };

  // Get main filters, "more" filters, and sort filter
  const mainFilters = filterConfig.filter(f => f.enabled && f.order < 100 && f.type !== 'sort');
  const moreFilters = filterConfig.filter(f => f.enabled && f.order >= 100 && f.type !== 'sort');
  const sortFilter = filterConfig.find(f => f.enabled && f.type === 'sort');
  
  // Check if any "more" filters are active
  const hasActiveMoreFilters = moreFilters.some(f => {
    const val = filters[f.field];
    if (!val) return false;
    if (f.type === 'slider') {
      const [min, max] = val;
      return min !== f.min || max !== f.max;
    }
    return val !== 'any' && val !== 'all';
  });

  // ============ RENDER ============
  return (
    <div className={`flex flex-col h-[100dvh] ${isDark ? 'dark' : ''}`} style={{ backgroundColor: bgColor, fontFamily: 'Jost, sans-serif' }}>
      <style>{`
        .custom-popup .mapboxgl-popup-content { border-radius: 16px; padding: 0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .custom-popup .mapboxgl-popup-close-button { width: 28px; height: 28px; font-size: 20px; background-color: #000; color: white; border-radius: 100px; right: 8px; top: 8px; }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .property-card { opacity: 1; transform: translateY(0); transition: opacity 0.3s ease-out, transform 0.3s ease-out, box-shadow 0.2s ease; }
        .property-list-container { transition: opacity 0.2s ease-out; }
        .mapboxgl-popup-tip { display: none; }
        input[type="range"] { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 22px; width: 22px; border-radius: 50%; background: #1a1a1a; cursor: pointer; margin-top: -9px; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
        input[type="range"]::-moz-range-thumb { height: 22px; width: 22px; border-radius: 50%; background: #1a1a1a; cursor: pointer; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
        input[type="range"]::-webkit-slider-runnable-track { height: 4px; background: transparent; }
        input[type="range"]::-moz-range-track { height: 4px; background: transparent; }
        /* Dual range slider fix: allow both thumbs to be grabbed independently */
        .dual-range-min, .dual-range-max { pointer-events: none; }
        .dual-range-min::-webkit-slider-thumb { pointer-events: auto; }
        .dual-range-max::-webkit-slider-thumb { pointer-events: auto; }
        .dual-range-min::-moz-range-thumb { pointer-events: auto; }
        .dual-range-max::-moz-range-thumb { pointer-events: auto; }
      `}</style>

      {/* Top Filters */}
      {showFilters && filterPosition === 'top' && (
        <div className="shrink-0 border-b z-20 px-4 py-3" style={{ backgroundColor: bgColor, borderColor }}>
          {renderFilters()}
        </div>
      )}

      <div className="flex flex-1 min-h-0 h-full">
        {/* MAP (left when listingPosition=right) */}
        {listingPosition === 'right' && (
          <div className={`flex-1 relative min-h-0 ${!showMap ? 'hidden' : 'block'} lg:block p-4`} style={{ backgroundColor: mapBgColor }}>
            <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" style={{ backgroundColor: '#fff', border: 'none' }} />
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-xl z-50">
                <div className="text-center p-6 max-w-md">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  <p className="text-sm text-gray-600 mb-4">{mapError}</p>
                  <button
                    onClick={() => { setMapError(null); mapInitRetries.current = 0; setTimeout(initMap, 100); }}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
                  >
                    Retry Map
                  </button>
                </div>
              </div>
            )}
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10 flex gap-2">
              {!isDrawing && !drawnPolygon && (
                <button onClick={startDrawing} className="px-4 py-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200 flex items-center gap-2" style={{ fontFamily: 'Jost, sans-serif' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  <span className="font-medium">Draw area</span>
                </button>
              )}
              {isDrawing && (
                <button onClick={cancelDrawing} className="px-4 py-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200 flex items-center gap-2" style={{ fontFamily: 'Jost, sans-serif' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  <span className="font-medium">Cancel drawing</span>
                </button>
              )}
              {drawnPolygon && (
                <button onClick={clearBounds} className="px-4 py-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200 flex items-center gap-2" style={{ fontFamily: 'Jost, sans-serif' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  <span className="font-medium">Clear bounds</span>
                </button>
              )}
            </div>
            <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-10" style={{ marginBottom: '20px' }}>
              <button onClick={() => setShowMap(false)} className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full shadow-lg font-medium">View List</button>
            </div>
          </div>
        )}

        {/* LISTINGS */}
        <div className={`w-full ${showMap ? 'hidden' : 'block'} lg:block ${mapColumns >= 2 ? 'lg:w-[800px] xl:w-[900px]' : 'lg:w-[600px] xl:w-[675px]'} flex flex-col h-full`} style={{ backgroundColor: cardBgColor }}>
          {/* Search Bar */}
          <div className="shrink-0 sticky top-0 z-20 p-4 pb-2" style={{ backgroundColor: bgColor }}>
            <div className="relative w-full px-4 py-3 pr-12 border rounded-lg" style={{ backgroundColor: isDark ? '#18181b' : '#fff', borderColor }}>
              {!searchSubmitted ? (
                <>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => setSearchDropdownOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && searchSuggestions.length > 0) { e.preventDefault(); handleSearchSelect(searchSuggestions[0]); } }}
                    placeholder="Search by city, neighbourhood, address or mls #"
                    className="w-full bg-transparent focus:outline-none"
                    style={{ fontFamily: 'Jost, sans-serif', fontSize: '15px', color: textColor }}
                  />
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
                <div className="absolute top-full left-4 right-4 mt-2 bg-white rounded-lg shadow-lg border z-20 max-h-96 overflow-y-auto" style={{ backgroundColor: isDark ? '#18181b' : '#fff', borderColor }}>
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

          {/* Scrollable Content */}
          <div ref={listContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(100vh - 80px)' }}>
            <div className="p-4 pb-3">
              <h2 className="font-semibold mb-1" style={{ fontSize: '1.75rem', fontWeight: 600, color: textColor }}>{listingTitle}</h2>
              {listingSubtitle && <p className="mb-3" style={{ color: mutedTextColor }}>{listingSubtitle}</p>}
              <p className="text-sm" style={{ color: mutedTextColor }}>{loading ? 'Loading...' : `Showing ${properties.length} of ${totalItems.toLocaleString()} properties`}</p>
            </div>

            {/* Side Filters */}
            {showFilters && filterPosition === 'side' && (
              <div className="shrink-0 sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
                <div className="flex flex-wrap items-center gap-2">
                  {mainFilters.map(filter => {
                    const isMultiSelect = filter.multiSelect || filter.field === 'PropertyType' || filter.field === 'PropertySubType';
                    return (
                      <button
                        key={filter.id}
                        onClick={() => {
                          if (openFilter === filter.field) { setOpenFilter(null); }
                          else {
                            if (isMultiSelect) {
                              const current = filters[filter.field];
                              if (Array.isArray(current)) setMultiSelectValues(prev => ({ ...prev, [filter.field]: current }));
                              else if (current) setMultiSelectValues(prev => ({ ...prev, [filter.field]: [current] }));
                              else setMultiSelectValues(prev => ({ ...prev, [filter.field]: [] }));
                            }
                            setOpenFilter(filter.field);
                          }
                        }}
                        className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                        style={{ backgroundColor: openFilter === filter.field ? '#1a1a1a' : filterBgColor, color: openFilter === filter.field ? '#fff' : textColor, fontFamily: 'Jost, sans-serif', fontWeight: 500 }}
                      >
                        {getFilterLabel(filter)}
                        <ChevronDownIcon className="ml-1 h-4 w-4" />
                      </button>
                    );
                  })}

                  {/* More Filters */}
                  {moreFilters.length > 0 && (
                    <button 
                      onClick={() => setOpenFilter(openFilter === 'more' ? null : 'more')} 
                      className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                      style={{ 
                        backgroundColor: openFilter === 'more' || hasActiveMoreFilters ? '#1a1a1a' : filterBgColor, 
                        color: openFilter === 'more' || hasActiveMoreFilters ? '#fff' : textColor, 
                        fontFamily: 'Jost, sans-serif', 
                        fontWeight: 500 
                      }}
                    >
                      More{hasActiveMoreFilters && ` (${moreFilters.filter(f => {
                        const val = filters[f.field];
                        if (!val) return false;
                        if (f.type === 'slider') {
                          const [min, max] = val;
                          return min !== f.min || max !== f.max;
                        }
                        return val !== 'any' && val !== 'all';
                      }).length})`}
                      <ChevronDownIcon className="ml-1 h-4 w-4" />
                    </button>
                  )}

                  {/* Sort */}
                  {sortFilter && (
                    <button onClick={() => setOpenFilter(openFilter === 'sort' ? null : 'sort')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: openFilter === 'sort' ? '#1a1a1a' : filterBgColor, color: openFilter === 'sort' ? '#fff' : textColor }}>
                      {filters.sort ? sortFilter.options?.find(o => o.value === filters.sort)?.label || 'Sort' : 'Sort'}
                      <ChevronDownIcon className="ml-1 h-4 w-4" />
                    </button>
                  )}

                  {/* Reset Filters */}
                  {hasActiveFilters() && (
                    <button onClick={clearAllFilters} className="text-sm underline whitespace-nowrap px-2" style={{ color: '#000', fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>reset filters</button>
                  )}
                </div>

                {/* DROPDOWN PANEL - Full width, below filter buttons */}
                {openFilter && openFilter !== 'more' && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setOpenFilter(null)} />
                    <div className="absolute left-0 right-0 mt-3 mx-4 p-4 rounded-[24px] shadow-lg border z-30" style={{ backgroundColor: cardBgColor, borderColor, maxWidth: (openFilter === 'ListPrice' || openFilter === 'BathroomsTotal') ? '480px' : undefined }}>
                      {/* Dropdown content based on openFilter */}
                      {mainFilters.filter(f => f.field === openFilter).map(filter => {
                        const isMultiSelect = filter.multiSelect || filter.field === 'PropertyType' || filter.field === 'PropertySubType';
                        
                        // Get filtered options for PropertySubType based on selected PropertyType
                        let displayOptions = filter.options;
                        if (filter.field === 'PropertySubType' && allSubTypeOptions.length > 0) {
                          const selectedPropertyTypes = filters.PropertyType;
                          if (selectedPropertyTypes && Array.isArray(selectedPropertyTypes) && selectedPropertyTypes.length > 0) {
                            // Get all allowed subtypes for selected property types
                            const allowedSubTypes = new Set<string>();
                            selectedPropertyTypes.forEach((pt: string) => {
                              const subtypes = propertySubTypeMapping[pt];
                              if (subtypes) subtypes.forEach(st => allowedSubTypes.add(st));
                            });
                            displayOptions = allSubTypeOptions.filter(opt => 
                              opt.value === 'all' || allowedSubTypes.has(opt.value)
                            );
                          } else if (typeof selectedPropertyTypes === 'string' && selectedPropertyTypes !== 'all') {
                            const subtypes = propertySubTypeMapping[selectedPropertyTypes];
                            if (subtypes) {
                              displayOptions = allSubTypeOptions.filter(opt => 
                                opt.value === 'all' || subtypes.includes(opt.value)
                              );
                            }
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
                                    <button
                                      key={option.value}
                                      onClick={() => isMultiSelect ? handleMultiSelectToggle(filter.field, option.value) : handleDropdownChange(filter.field, option.value)}
                                      className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2"
                                      style={{ fontFamily: 'Jost, sans-serif', fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}
                                    >
                                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>
                                        {isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}
                                      </div>
                                      {option.label}
                                    </button>
                                  );
                                })}
                                {isMultiSelect && (
                                  <button onClick={() => applyMultiSelect(filter.field)} className="text-sm underline whitespace-nowrap px-3 py-2" style={{ color: '#000', fontFamily: 'Jost, sans-serif', fontWeight: 500 }}>Apply</button>
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

                      {/* Sort dropdown content */}
                      {openFilter === 'sort' && sortFilter && (
                        <div className="flex flex-wrap gap-2">
                          {sortFilter.options?.map((opt) => {
                            const isSelected = filters.sort === opt.value || (!filters.sort && opt.value === 'latest');
                            return (
                              <button
                                key={opt.value}
                                onClick={() => handleDropdownChange('sort', opt.value)}
                                className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2"
                                style={{ fontFamily: 'Jost, sans-serif', fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}
                              >
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

                {/* MORE FILTERS MODAL - Rendered via Portal to fix Safari z-index/transform issues */}
                {openFilter === 'more' && moreFilters.length > 0 && typeof document !== 'undefined' && createPortal(
                  <>
                    {/* Dark overlay backdrop */}
                    <div 
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.5)', WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)' }}
                      onClick={() => setOpenFilter(null)} 
                    />
                    {/* Centered modal */}
                    <div 
                      style={{ 
                        position: 'fixed',
                        zIndex: 100000,
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        WebkitTransform: 'translate(-50%, -50%)',
                        width: '90%',
                        maxWidth: '560px',
                        maxHeight: '80vh',
                        padding: '28px',
                        backgroundColor: cardBgColor, 
                        borderColor,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderRadius: '24px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflowY: 'auto' as const,
                      }}
                    >
                      {/* Modal header */}
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold" style={{ color: textColor, fontFamily: 'Jost, sans-serif' }}>More Filters</h3>
                        <button 
                          onClick={() => setOpenFilter(null)} 
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                          style={{ color: textColor }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>

                      {/* Filter sections */}
                      <div className="space-y-6">
                        {moreFilters.map(filter => (
                          <div key={filter.id} className="space-y-3">
                            <label className="text-sm font-semibold block" style={{ color: textColor, fontFamily: 'Jost, sans-serif' }}>{filter.label}</label>
                            {filter.type === 'dropdown' && (
                              <div className="flex flex-wrap gap-2">
                                {filter.options?.map((option) => {
                                  const isSelected = filters[filter.field] === option.value || (!filters[filter.field] && (option.value === 'any' || option.value === 'all'));
                                  return (
                                    <button
                                      key={option.value}
                                      onClick={() => handleDropdownChange(filter.field, option.value)}
                                      className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2"
                                      style={{ fontFamily: 'Jost, sans-serif', fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}
                                    >
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
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-xs" style={{ color: mutedTextColor }}>Min</label>
                                    <input 
                                      type="number" 
                                      value={tempSliderValues[filter.field]?.[0] === (filter.min || 0) ? '' : tempSliderValues[filter.field]?.[0]} 
                                      onChange={(e) => { 
                                        const val = e.target.value === '' ? filter.min || 0 : parseInt(e.target.value); 
                                        setTempSliderValues(prev => ({ ...prev, [filter.field]: [val, prev[filter.field]?.[1] || filter.max || 100] })); 
                                      }} 
                                      placeholder={String(filter.min || 0)}
                                      className="w-full px-3 py-2 text-sm rounded-lg border" 
                                      style={{ backgroundColor: cardBgColor, color: textColor, borderColor }} 
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs" style={{ color: mutedTextColor }}>Max</label>
                                    <input 
                                      type="number" 
                                      value={tempSliderValues[filter.field]?.[1] === (filter.max || 100) ? '' : tempSliderValues[filter.field]?.[1]} 
                                      onChange={(e) => { 
                                        const val = e.target.value === '' ? filter.max || 100 : parseInt(e.target.value); 
                                        setTempSliderValues(prev => ({ ...prev, [filter.field]: [prev[filter.field]?.[0] || filter.min || 0, val] })); 
                                      }} 
                                      placeholder={String(filter.max || 100)}
                                      className="w-full px-3 py-2 text-sm rounded-lg border" 
                                      style={{ backgroundColor: cardBgColor, color: textColor, borderColor }} 
                                    />
                                  </div>
                                </div>
                                {/* Dual range slider with proper pointer-events for both thumbs */}
                                <div className="relative h-8 mt-2">
                                  <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-gray-200 rounded-full"></div>
                                  <div 
                                    className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full" 
                                    style={{ 
                                      backgroundColor: '#1a1a1a',
                                      left: `${((tempSliderValues[filter.field]?.[0] || filter.min || 0) - (filter.min || 0)) / ((filter.max || 100) - (filter.min || 0)) * 100}%`, 
                                      right: `${100 - ((tempSliderValues[filter.field]?.[1] || filter.max || 100) - (filter.min || 0)) / ((filter.max || 100) - (filter.min || 0)) * 100}%` 
                                    }}
                                  ></div>
                                  {/* Min slider */}
                                  <input 
                                    type="range" 
                                    min={filter.min || 0} max={filter.max || 100} step={filter.step || 1} 
                                    value={tempSliderValues[filter.field]?.[0] || filter.min || 0} 
                                    onChange={(e) => { 
                                      const val = parseInt(e.target.value); 
                                      const maxVal = tempSliderValues[filter.field]?.[1] || filter.max || 100; 
                                      if (val <= maxVal) setTempSliderValues(prev => ({ ...prev, [filter.field]: [val, maxVal] })); 
                                    }} 
                                    className="dual-range-min absolute w-full h-8 appearance-none bg-transparent cursor-pointer" 
                                    style={{ zIndex: 20, pointerEvents: 'none' }} 
                                  />
                                  {/* Max slider */}
                                  <input 
                                    type="range" 
                                    min={filter.min || 0} max={filter.max || 100} step={filter.step || 1} 
                                    value={tempSliderValues[filter.field]?.[1] || filter.max || 100} 
                                    onChange={(e) => { 
                                      const val = parseInt(e.target.value); 
                                      const minVal = tempSliderValues[filter.field]?.[0] || filter.min || 0; 
                                      if (val >= minVal) setTempSliderValues(prev => ({ ...prev, [filter.field]: [minVal, val] })); 
                                    }} 
                                    className="dual-range-max absolute w-full h-8 appearance-none bg-transparent cursor-pointer" 
                                    style={{ zIndex: 21, pointerEvents: 'none' }} 
                                  />
                                </div>
                                <div className="flex justify-between text-xs" style={{ color: mutedTextColor }}>
                                  <span>{(tempSliderValues[filter.field]?.[0] || filter.min || 0).toLocaleString()}</span>
                                  <span>{(tempSliderValues[filter.field]?.[1] || filter.max || 100).toLocaleString()}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Modal footer with Reset/Apply */}
                      <div className="flex gap-3 pt-6 mt-4 border-t" style={{ borderColor }}>
                        <button 
                          onClick={() => {
                            moreFilters.forEach(f => {
                              if (f.type === 'slider') {
                                resetSlider(f.field, f);
                              } else {
                                handleDropdownChange(f.field, 'any');
                              }
                            });
                          }} 
                          className="flex-1 px-4 py-3 border rounded-xl hover:bg-gray-100 text-sm font-medium transition-colors" 
                          style={{ borderColor, color: textColor, fontFamily: 'Jost, sans-serif' }}
                        >
                          Reset All
                        </button>
                        <button 
                          onClick={() => {
                            moreFilters.forEach(f => {
                              if (f.type === 'slider') {
                                applySliderFilter(f.field, f);
                              }
                            });
                            setOpenFilter(null);
                          }} 
                          className="flex-1 px-4 py-3 bg-black text-white rounded-xl hover:bg-gray-800 text-sm font-medium transition-colors"
                          style={{ fontFamily: 'Jost, sans-serif' }}
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            )}

            {/* Property List */}
            <div className={mapColumns >= 2 ? 'grid grid-cols-2 gap-3 p-4 property-list-container' : 'p-4 space-y-3 property-list-container'}>
              {loading && properties.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mb-4"></div>
                  <div style={{ color: mutedTextColor }}>Loading properties...</div>
                </div>
              )}
              {properties.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-2" style={{ color: mutedTextColor }}>No properties found in this area</div>
                  <div className="text-sm" style={{ color: mutedTextColor }}>Try zooming out or adjusting your filters</div>
                </div>
              )}
              {properties.map((property, idx) => (
                <div key={property.mls_number} className={`property-card rounded-xl overflow-hidden cursor-pointer ${hoveredProperty?.mls_number === property.mls_number ? 'ring-2 ring-gray-800' : ''}`} style={{ backgroundColor: cardBgColor, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} onClick={() => handlePropertyClick(property)} onMouseEnter={() => handlePropertyHover(property)} onMouseLeave={() => handlePropertyHover(null)}>
                  <div className={(listingStyle === 'top' || mapColumns >= 2) ? '' : 'sm:flex'}>
                    {/* Thumbnail */}
                    <div className={`relative flex-shrink-0 ${(listingStyle === 'top' || mapColumns >= 2) ? 'w-full' : 'sm:w-[280px] sm:h-[200px]'}`} style={(listingStyle === 'top' || mapColumns >= 2) ? { aspectRatio: aspectCSS } : {}}>
                      <img src={property.images?.[0] || `https://mlsmedia.inthehood.io/property-images/${property.mls_number}/full/${property.mls_number}-1.webp`} alt={property.address} className={`w-full ${(listingStyle === 'top' || mapColumns >= 2) ? 'h-full' : 'aspect-video sm:h-full'} object-cover rounded-xl`} onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                      <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff' }}>{property.property_sub_type === 'Detached' ? 'House' : (property.property_sub_type || 'House')}</span>
                      <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold rounded" style={{ backgroundColor: '#22c55e', color: '#fff' }}>Active</span>
                      {cardStyle === 'meta-overlay' && (
                        <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                          <div className="font-bold text-white" style={{ fontSize: '20px', fontFamily: 'Jost, sans-serif' }}>{formatFullPrice(property.price)}</div>
                          <div className="text-white/80 text-sm truncate" style={{ fontFamily: 'Jost, sans-serif' }}>{formatAddress(property.address, property.city)}</div>
                          <div className="flex gap-4 mt-1 text-white/90 text-sm">
                            {isLandProperty(property) ? (
                              <>{formatLotSize(property.lot_size, property.lot_size_acres) && <span>{formatLotSize(property.lot_size, property.lot_size_acres)} Lot</span>}</>
                            ) : (
                              <>
                                {property.bedrooms > 0 && <span>{property.bedrooms} Beds</span>}
                                {property.bathrooms > 0 && <span>{property.bathrooms} Baths</span>}
                                {property.square_feet && <span>{property.square_feet.toLocaleString()} Sqft</span>}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Details - only when NOT meta-overlay */}
                    {cardStyle !== 'meta-overlay' && (
                    <div className="flex-1 p-4 min-w-0 flex flex-col">
                      <div className="font-bold mb-1" style={{ fontSize: '22px', color: textColor, fontFamily: 'Jost, sans-serif' }}>{formatFullPrice(property.price)}</div>
                      <div className="flex items-start gap-1 mb-2">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="#6B7280"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        <span className="line-clamp-2" style={{ fontSize: '15px', color: mutedTextColor, fontFamily: 'Jost, sans-serif' }}>{formatAddress(property.address, property.city)}</span>
                      </div>
                      {/* Smart Meta — adapts based on property type */}
                      <div className="flex gap-6 mb-3" style={{ fontSize: '15px' }}>
                        {isLandProperty(property) ? (
                          /* LAND: Show lot size — no beds/baths */
                          <>
                            {formatLotSize(property.lot_size, property.lot_size_acres) ? (
                              <div className="flex flex-col"><span className="font-bold text-lg" style={{ color: textColor }}>{formatLotSize(property.lot_size, property.lot_size_acres)}</span><span style={{ color: mutedTextColor, fontSize: '13px' }}>Lot</span></div>
                            ) : property.square_feet ? (
                              <div className="flex flex-col"><span className="font-bold text-lg" style={{ color: textColor }}>{Math.round(property.square_feet).toLocaleString()} Sqft</span><span style={{ color: mutedTextColor, fontSize: '13px' }}>Lot</span></div>
                            ) : null}
                          </>
                        ) : isCommercialProperty(property) ? (
                          /* COMMERCIAL: Show sqft — no beds */
                          <>
                            {property.square_feet && <div className="flex flex-col"><span className="font-bold text-lg" style={{ color: textColor }}>{Math.round(property.square_feet).toLocaleString()}</span><span style={{ color: mutedTextColor, fontSize: '13px' }}>Sqft</span></div>}
                            {property.bathrooms > 0 && <div className="flex flex-col"><span className="font-bold text-lg" style={{ color: textColor }}>{property.bathrooms}</span><span style={{ color: mutedTextColor, fontSize: '13px' }}>Baths</span></div>}
                          </>
                        ) : (
                          /* RESIDENTIAL (default): Show beds, baths, sqft */
                          <>
                            {property.bedrooms > 0 && <div className="flex flex-col"><span className="font-bold text-lg" style={{ color: textColor }}>{property.bedrooms}</span><span style={{ color: mutedTextColor, fontSize: '13px' }}>Beds</span></div>}
                            {property.bathrooms > 0 && <div className="flex flex-col"><span className="font-bold text-lg" style={{ color: textColor }}>{property.bathrooms}</span><span style={{ color: mutedTextColor, fontSize: '13px' }}>Baths</span></div>}
                            {property.square_feet && <div className="flex flex-col"><span className="font-bold text-lg" style={{ color: textColor }}>{property.square_feet.toLocaleString()}</span><span style={{ color: mutedTextColor, fontSize: '13px' }}>Sqft</span></div>}
                          </>
                        )}
                      </div>
                      {property.office_name && <div className="mt-auto text-sm" style={{ color: mutedTextColor, fontFamily: 'Jost, sans-serif' }}>Listed by {property.office_name}</div>}
                    </div>
                    )}
                  </div>
                </div>
              ))}
              {loadingMore && <div className="text-center py-4"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-800"></div></div>}
              
              {/* Numbered Pagination for Half Map */}
              {paginationType === 'numbered' && totalPages > 1 && !loadingMore && (
                <div className="flex justify-center items-center gap-2 py-4 px-4 border-t" style={{ borderColor }}>
                  <button
                    onClick={() => loadProperties(1, false)}
                    disabled={currentPage === 1 || loading}
                    className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor, color: textColor, backgroundColor: cardBgColor }}
                  >
                    First
                  </button>
                  <button
                    onClick={() => loadProperties(currentPage - 1, false)}
                    disabled={currentPage === 1 || loading}
                    className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor, color: textColor, backgroundColor: cardBgColor }}
                  >
                    Prev
                  </button>
                  
                  <span className="text-sm px-2" style={{ color: mutedTextColor }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => loadProperties(currentPage + 1, false)}
                    disabled={currentPage === totalPages || loading}
                    className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor, color: textColor, backgroundColor: cardBgColor }}
                  >
                    Next
                  </button>
                  <button
                    onClick={() => loadProperties(totalPages, false)}
                    disabled={currentPage === totalPages || loading}
                    className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor, color: textColor, backgroundColor: cardBgColor }}
                  >
                    Last
                  </button>
                </div>
              )}
              
              {!hasMore && properties.length > 0 && paginationType !== 'numbered' && <div className="py-4 text-center text-sm" style={{ color: mutedTextColor }}>All properties loaded</div>}
            </div>
          </div>

          <div className="lg:hidden shrink-0 p-4 border-t" style={{ borderColor }}>
            <button onClick={() => setShowMap(true)} className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800">View Map</button>
          </div>
        </div>

        {/* MAP (right when listingPosition=left) */}
        {listingPosition === 'left' && (
          <div className={`flex-1 relative min-h-0 ${!showMap ? 'hidden' : 'block'} lg:block p-4`} style={{ backgroundColor: mapBgColor }}>
            <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" style={{ backgroundColor: '#fff', border: 'none' }} />
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-xl z-50">
                <div className="text-center p-6 max-w-md">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  <p className="text-sm text-gray-600 mb-4">{mapError}</p>
                  <button
                    onClick={() => { setMapError(null); mapInitRetries.current = 0; setTimeout(initMap, 100); }}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
                  >
                    Retry Map
                  </button>
                </div>
              </div>
            )}
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10 flex gap-2">
              {!isDrawing && !drawnPolygon && <button onClick={startDrawing} className="px-4 py-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg><span className="font-medium">Draw area</span></button>}
              {isDrawing && <button onClick={cancelDrawing} className="px-4 py-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg><span className="font-medium">Cancel drawing</span></button>}
              {drawnPolygon && <button onClick={clearBounds} className="px-4 py-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg><span className="font-medium">Clear bounds</span></button>}
            </div>
            <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-10" style={{ marginBottom: '20px' }}><button onClick={() => setShowMap(false)} className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full shadow-lg font-medium">View List</button></div>
          </div>
        )}
      </div>
    </div>
  );

  function renderFilters() {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {mainFilters.map(filter => (
          <div key={filter.id} className="relative">
            <button onClick={() => setOpenFilter(openFilter === filter.field ? null : filter.field)} className="flex items-center px-4 py-2 rounded-full text-sm font-medium border" style={{ backgroundColor: cardBgColor, color: textColor, borderColor }}>
              {getFilterLabel(filter)}
              <ChevronDownIcon className="ml-1 h-4 w-4" />
            </button>
          </div>
        ))}
        {sortFilter && (
          <div className="relative ml-auto">
            <button onClick={() => setOpenFilter(openFilter === 'sort' ? null : 'sort')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium border" style={{ backgroundColor: cardBgColor, color: textColor, borderColor }}>
              Sort
              <ChevronDownIcon className="ml-1 h-4 w-4" />
            </button>
          </div>
        )}
        {hasActiveFilters() && <button onClick={clearAllFilters} className="text-sm underline" style={{ color: textColor }}>reset filters</button>}
      </div>
    );
  }
}
