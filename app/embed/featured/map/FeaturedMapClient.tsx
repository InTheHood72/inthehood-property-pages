'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ============ CONSTANTS ============
// Supabase credentials for fetching dynamic backend URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Fallback URL if dynamic fetch fails
const FALLBACK_BACKEND_URL = 'https://api-production-531c.up.railway.app';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const NEXTJS_TEMPLATE_URL = 'https://in-the-hood-io-5dmw.vercel.app';

// Fetch the current backend URL from Supabase global_settings
// This ensures the URL from Admin Panel > API Settings is used
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
      if (data && data[0]?.api_config?.current_backend_url) {
        let url = data[0].api_config.current_backend_url;
        // Remove trailing slash if present
        if (url.endsWith('/')) {
          url = url.slice(0, -1);
        }
        console.log('📡 Featured Map: Using dynamic backend URL from Admin Settings:', url);
        return url;
      }
    }
  } catch (e) {
    console.warn('⚠️ Could not fetch backend URL from Supabase:', e);
  }
  
  console.log('📡 Featured Map: Using fallback backend URL:', FALLBACK_BACKEND_URL);
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

export default function FeaturedMapClient() {
  const searchParams = useSearchParams();
  
  // Core params
  const theme = searchParams.get('theme') || 'light';
  const userId = searchParams.get('userId');
  const userIds = searchParams.get('userIds')?.split(',').filter(Boolean);
  const propertyType = searchParams.get('propertyType') || 'both';
  const showFilters = searchParams.get('showFilters') !== 'false';
  const listingPosition = searchParams.get('listingPosition') || 'right';
  const openInNewWindow = searchParams.get('openInNewWindow') !== 'false';
  
  // Extended params for full embed generator support
  const cardStyle = searchParams.get('cardStyle') || 'meta-below';
  const showStatusBadges = searchParams.get('showStatusBadges') !== 'false';
  const useTypography = searchParams.get('useTypography') === 'true';
  const overrideTheme = searchParams.get('overrideTheme') === 'true';
  const listingTitle = searchParams.get('listingTitle') || 'Properties';
  const listingSubtitle = searchParams.get('listingSubtitle') || '';
  const listingStyle = searchParams.get('listingStyle') || 'side';
  const filterPosition = searchParams.get('filterPosition') || 'side';
  const listingStatusFilter = searchParams.get('listingStatus') || 'active,pending';
  const sortOrderParam = searchParams.get('sortOrder') || 'date-desc';
  const pinnedListingsParam = searchParams.get('pinnedListings') || '';
  const selectedListingsParam = searchParams.get('selectedListings') || '';
  const filterAlignment = searchParams.get('filterAlignment') || 'left';
  const mapColumns = parseInt(searchParams.get('mapColumns') || '1');
  const thumbnailSource = searchParams.get('thumbnailSource') || 'standard';
  const mapZoom = parseInt(searchParams.get('mapZoom') || '11');
  const aspectRatioRaw = searchParams.get('aspectRatio') || '16/9';
  const aspectCSS = aspectRatioRaw.replace(':', '/');
  
  // Studio image selection — always use poster thumbnail for card layouts
  const getStudioImage = (property: Property): string => {
    if (thumbnailSource !== 'studio') {
      return property.main_thumbnail || property.images?.[0] || '/placeholder.svg';
    }
    // Card layouts always use the poster thumbnail (2:3 design)
    // The banner (16:9) is only for the showcase hover state
    return property.creative_video_thumbnail || property.creative_hero_image || property.main_thumbnail || property.images?.[0] || '/placeholder.svg';
  };
  
  // Parse JSON params safely
  const fonts = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('fonts') || '{}')); } catch { return {}; } })();
  const badgeColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('badgeColors') || '{}')); } catch { return {}; } })();
  const mapColors = (() => { try { return JSON.parse(decodeURIComponent(searchParams.get('mapColors') || '{}')); } catch { return {}; } })();
  
  const isDark = theme === 'dark';

  // Dynamic backend URL state
  const [backendUrl, setBackendUrl] = useState<string>(FALLBACK_BACKEND_URL);
  const [backendUrlLoaded, setBackendUrlLoaded] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null);
  const [highlightedPropertyId, setHighlightedPropertyId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedBeds, setSelectedBeds] = useState<string>('any');
  const [selectedBaths, setSelectedBaths] = useState<string>('any');
  const [selectedSort, setSelectedSort] = useState<string>('newest');
  
  // Price slider state
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 30000000]);
  const [tempPriceRange, setTempPriceRange] = useState<[number, number]>([0, 30000000]);
  const [priceApplied, setPriceApplied] = useState(false);
  const [minMaxPrices, setMinMaxPrices] = useState<{ min: number; max: number }>({ min: 0, max: 30000000 });

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const markersMap = useRef<Map<string, { marker: mapboxgl.Marker; element: HTMLElement }>>(new Map());
  const currentPopup = useRef<mapboxgl.Popup | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const mapInitialized = useRef(false);

  // isDark already declared above with extended params
  const bgColor = isDark ? '#09090b' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';
  const borderColor = isDark ? '#3f3f46' : '#e5e7eb';
  const cardBgColor = isDark ? '#18181b' : '#ffffff';
  const mapBgColor = isDark ? '#18181b' : '#ffffff';
  const mutedTextColor = isDark ? '#a1a1aa' : '#6b7280';
  const filterBgColor = isDark ? '#27272a' : '#f5f5f5';

  // ============ FETCH BACKEND URL ON MOUNT ============
  useEffect(() => {
    const initBackendUrl = async () => {
      const url = await fetchBackendUrl();
      setBackendUrl(url);
      setBackendUrlLoaded(true);
    };
    initBackendUrl();
  }, []);

  const formatMarkerPrice = (price: number): string => {
    if (price >= 999500) return `$${(price / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (price >= 1000) return `$${Math.round(price / 1000)}K`;
    return `$${price.toLocaleString()}`;
  };
  const formatFullPrice = (price: number): string => `$${Math.round(price).toLocaleString()}`;
  const formatCurrency = (v: number) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`;

  const generateSlug = (p: Property): string => {
    const parts = [p.mls_number, p.address, p.city, p.province || 'Alberta', p.postal_code];
    if (p.subdivision_name && p.subdivision_name.toUpperCase() !== 'NONE') parts.push(p.subdivision_name);
    return parts.filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  };

  // Generate SEO-friendly property URL
  // Format: /featured-property/{mls_number}-{address}-{neighbourhood}-{city}
  const getPropertyUrl = (p: Property): string => {
    const slug = generateSlug(p);
    return `${NEXTJS_TEMPLATE_URL}/featured-property/${slug}`;
  };

  // Dynamic type options based on loaded properties
  const typeOptions = useMemo(() => {
    if (properties.length === 0) return [{ label: 'All types', value: 'all' }];
    
    const typesSet = new Set<string>();
    properties.forEach(p => {
      let subtype = p.property_subtype || 'House';
      // Normalize "Detached" to "House"
      if (subtype.toLowerCase() === 'detached') subtype = 'House';
      typesSet.add(subtype);
    });
    
    const sortedTypes = Array.from(typesSet).sort();
    return [
      { label: 'All types', value: 'all' },
      ...sortedTypes.map(t => ({ label: t, value: t.toLowerCase() }))
    ];
  }, [properties]);

  // Load properties ONCE (wait for backend URL to load)
  useEffect(() => {
    if (initialLoadDone || !backendUrlLoaded) return;
    
    const loadProps = async () => {
      setLoading(true);
      try {
        // Combine userId and userIds into one array
        const allUserIds = [
          ...(userId ? [userId] : []),
          ...(userIds || [])
        ].filter(Boolean);
        if (allUserIds.length === 0) { setLoading(false); setInitialLoadDone(true); return; }

        const res = await fetch(`${backendUrl}/api/featured-properties?user_ids=${allUserIds.join(',')}&listing_status=${listingStatusFilter}&sort_order=${sortOrderParam}${pinnedListingsParam ? `&pinned_listings=${pinnedListingsParam}` : ''}${selectedListingsParam ? `&selected_listings=${selectedListingsParam}` : ''}`);
        const data = await res.json();

        if (data.properties) {
          let propsData = data.properties.filter((p: any) => p.latitude && p.longitude);
          if (propertyType === 'for_sale') propsData = propsData.filter((p: any) => p.listing_type === 'sale' || !p.listing_type);
          else if (propertyType === 'for_rent') propsData = propsData.filter((p: any) => p.listing_type === 'rent');

          const props: Property[] = propsData.map((p: any) => ({
            id: p.id, mls_number: p.mls_number, address: p.address, city: p.city, province: p.province || 'AB',
            price: p.listing_type === 'rent' ? p.rent_price : p.price,
            bedrooms: p.bedrooms || 0, bathrooms: p.bathrooms || 0, 
            square_feet: p.square_feet || p.sqft || p.building_area_total || 0,
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
            co_list_agent_name: p.co_list_agent_name,
            co_listing_agent_profiles: p.co_listing_agent_profiles || []
          }));
          
          // Calculate min/max prices for slider
          const prices = props.map(p => p.price).filter(p => p > 0);
          if (prices.length > 0) {
            const minPrice = Math.floor(Math.min(...prices) / 10000) * 10000;
            const maxPrice = Math.ceil(Math.max(...prices) / 10000) * 10000;
            setMinMaxPrices({ min: minPrice, max: maxPrice });
            setPriceRange([minPrice, maxPrice]);
            setTempPriceRange([minPrice, maxPrice]);
          }
          
          setProperties(props);
          setFilteredProperties(props);
        }
      } catch (e) { console.error('Load error:', e); }
      finally { setLoading(false); setInitialLoadDone(true); }
    };
    
    loadProps();
  }, [userId, userIds, propertyType, initialLoadDone, backendUrlLoaded, backendUrl]);

  // Apply filters
  useEffect(() => {
    if (properties.length === 0) return;
    
    let filtered = [...properties];
    
    if (selectedType !== 'all') {
      filtered = filtered.filter(p => {
        let pType = p.property_subtype?.toLowerCase();
        if (pType === 'detached') pType = 'house';
        return pType === selectedType.toLowerCase();
      });
    }
    
    if (selectedBeds !== 'any') {
      const minBeds = parseInt(selectedBeds);
      filtered = filtered.filter(p => p.bedrooms >= minBeds);
    }
    
    if (selectedBaths !== 'any') {
      const minBaths = parseInt(selectedBaths);
      filtered = filtered.filter(p => p.bathrooms >= minBaths);
    }
    
    if (priceApplied) {
      filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    }
    
    // Sorting
    filtered = [...filtered].sort((a, b) => {
      switch (selectedSort) {
        case 'price_asc': return (a.price || 0) - (b.price || 0);
        case 'price_desc': return (b.price || 0) - (a.price || 0);
        case 'price_sqft_asc': return ((a.price || 0) / (a.square_feet || 1)) - ((b.price || 0) / (b.square_feet || 1));
        case 'price_sqft_desc': return ((b.price || 0) / (b.square_feet || 1)) - ((a.price || 0) / (a.square_feet || 1));
        case 'bedrooms_asc': return (a.bedrooms || 0) - (b.bedrooms || 0);
        case 'bedrooms_desc': return (b.bedrooms || 0) - (a.bedrooms || 0);
        case 'bathrooms_asc': return (a.bathrooms || 0) - (b.bathrooms || 0);
        case 'bathrooms_desc': return (b.bathrooms || 0) - (a.bathrooms || 0);
        case 'oldest': return 0;
        case 'newest': 
        default: return 0;
      }
    });
    
    setFilteredProperties(filtered);
  }, [properties, selectedType, selectedBeds, selectedBaths, selectedSort, priceRange, priceApplied]);

  // Initialize map ONCE
  useEffect(() => {
    if (!mapContainer.current || filteredProperties.length === 0 || mapInitialized.current) return;
    
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const bounds = new mapboxgl.LngLatBounds();
    filteredProperties.forEach(p => { if (p.longitude && p.latitude) bounds.extend([p.longitude, p.latitude]); });

    map.current = new mapboxgl.Map({ container: mapContainer.current, style: 'mapbox://styles/mapbox/streets-v12', bounds, fitBoundsOptions: { padding: 50 } });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    
    map.current.on('load', () => {
      mapInitialized.current = true;
      // Use clustering if more than 10 properties
      if (filteredProperties.length > 10) {
        initClusteredMarkers();
      } else {
        addMarkersToMap(filteredProperties);
      }
    });
    
    // Update cluster markers when map moves (for clustering mode)
    map.current.on('idle', () => {
      if (map.current?.getSource('properties-cluster')) {
        updateClusterMarkers();
      }
    });
    
    // Close popup when clicking on the map (not on a marker)
    map.current.on('click', (e) => {
      // Check if click was on a marker
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest('.property-marker') || target.closest('.cluster-marker')) {
        return; // Click was on a marker, don't close popup
      }
      if (currentPopup.current) { 
        currentPopup.current.remove(); 
        currentPopup.current = null; 
        setHighlightedPropertyId(null);
      }
    });
  }, [filteredProperties.length > 0]);

  // Update markers when filters change (but NOT on initial load)
  useEffect(() => {
    if (mapInitialized.current && map.current && map.current.isStyleLoaded()) {
      if (filteredProperties.length > 10 && map.current.getSource('properties-cluster')) {
        // Update cluster source data
        const source = map.current.getSource('properties-cluster') as mapboxgl.GeoJSONSource;
        if (source) {
          const geojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: filteredProperties
              .filter(p => p.longitude && p.latitude)
              .map(property => ({
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [property.longitude, property.latitude]
                },
                properties: {
                  id: property.id,
                  price: property.price,
                  listing_type: property.listing_type,
                  address: property.address,
                  city: property.city,
                  province: property.province,
                  bedrooms: property.bedrooms,
                  bathrooms: property.bathrooms,
                  square_feet: property.square_feet,
                  mls_number: property.mls_number,
                  postal_code: property.postal_code,
                  subdivision_name: property.subdivision_name,
                  presentation_settings: property.presentation_settings,
                  main_thumbnail: property.main_thumbnail,
                  images: property.images,
                  agent_name: property.agent_name,
                  property_subtype: property.property_subtype
                }
              }))
          };
          source.setData(geojson);
          setTimeout(() => updateClusterMarkers(), 100);
        }
      } else if (filteredProperties.length > 10) {
        initClusteredMarkers();
      } else {
        // Clear clustering and use regular markers
        try {
          if (map.current?.getSource('properties-cluster')) {
            if (map.current.getLayer('clusters')) map.current.removeLayer('clusters');
            if (map.current.getLayer('cluster-count')) map.current.removeLayer('cluster-count');
            if (map.current.getLayer('unclustered-point')) map.current.removeLayer('unclustered-point');
            map.current.removeSource('properties-cluster');
          }
        } catch (e) {}
        addMarkersToMap(filteredProperties);
      }
    }
  }, [filteredProperties]);

  // Initialize clustering for maps with many markers
  const initClusteredMarkers = () => {
    if (!map.current) return;
    
    // Wait for style to load before adding sources
    if (!map.current.isStyleLoaded()) {
      map.current.once('style.load', () => {
        initClusteredMarkers();
      });
      return;
    }

    // Remove existing source and layers if they exist
    try {
      if (map.current.getSource('properties-cluster')) {
        if (map.current.getLayer('clusters')) map.current.removeLayer('clusters');
        if (map.current.getLayer('cluster-count')) map.current.removeLayer('cluster-count');
        if (map.current.getLayer('unclustered-point')) map.current.removeLayer('unclustered-point');
        map.current.removeSource('properties-cluster');
      }
    } catch (e) {
      console.log('No existing cluster source to remove');
    }

    // Clear regular markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];
    markersMap.current.clear();

    // Create GeoJSON from properties
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: filteredProperties
        .filter(p => p.longitude && p.latitude)
        .map(property => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [property.longitude, property.latitude]
          },
          properties: {
            id: property.id,
            price: property.price,
            listing_type: property.listing_type,
            address: property.address,
            city: property.city,
            province: property.province,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            square_feet: property.square_feet,
            mls_number: property.mls_number,
            postal_code: property.postal_code,
            subdivision_name: property.subdivision_name,
            presentation_settings: property.presentation_settings,
            main_thumbnail: property.main_thumbnail,
            images: property.images,
            agent_name: property.agent_name,
            property_subtype: property.property_subtype
          }
        }))
    };

    console.log(`Creating cluster source with ${geojson.features.length} properties`);

    try {
      // Add source with clustering enabled
      map.current.addSource('properties-cluster', {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 60
      });

      // Add invisible layers (we use custom markers)
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'properties-cluster',
        filter: ['has', 'point_count'],
        paint: { 'circle-radius': 0 }
      });

      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'properties-cluster',
        filter: ['has', 'point_count'],
        layout: { 'text-size': 0 }
      });

      map.current.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'properties-cluster',
        filter: ['!', ['has', 'point_count']],
        paint: { 'circle-radius': 0 }
      });

      // Initial cluster markers
      setTimeout(() => updateClusterMarkers(), 100);
    } catch (err) {
      console.error('Error initializing cluster markers:', err);
      // Fall back to regular markers
      addMarkersToMap(filteredProperties);
    }
  };

  // Update cluster markers based on current map view
  const updateClusterMarkers = () => {
    if (!map.current) return;

    const source = map.current.getSource('properties-cluster') as mapboxgl.GeoJSONSource;
    if (!source) return;

    // Don't update if popup is open
    if (currentPopup.current) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];
    markersMap.current.clear();

    const features = map.current.querySourceFeatures('properties-cluster');
    if (features.length === 0) return;

    const addedClusters = new Set<string>();

    features.forEach((feature: any) => {
      const coords = feature.geometry.coordinates;
      const props = feature.properties;
      const id = feature.id || `${coords[0]},${coords[1]}`;

      if (addedClusters.has(String(id))) return;
      addedClusters.add(String(id));

      if (props.cluster) {
        // CLUSTER MARKER
        const count = props.point_count;
        const el = document.createElement('div');
        el.className = 'cluster-marker';
        el.innerHTML = `
          <div style="
            background: white;
            color: black;
            padding: 6px 12px;
            border-radius: 20px;
            border: 2px solid rgba(0,0,0,0.1);
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            font-family: Jost, sans-serif;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            <span>${count}</span>
          </div>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          
          if (currentPopup.current) {
            currentPopup.current.remove();
            currentPopup.current = null;
          }
          
          const currentSource = map.current?.getSource('properties-cluster') as mapboxgl.GeoJSONSource;
          if (!currentSource) return;

          (currentSource as any).getClusterExpansionZoom(props.cluster_id, (err: any, zoom: number) => {
            if (err) return;
            map.current?.easeTo({
              center: coords,
              zoom: Math.min(zoom, 16)
            });
          });
        });

        const marker = new mapboxgl.Marker(el)
          .setLngLat(coords)
          .addTo(map.current!);
        markers.current.push(marker);
      } else {
        // INDIVIDUAL PROPERTY MARKER
        const property = filteredProperties.find(p => p.id === props.id);
        if (!property) return;

        createPropertyMarker(property, coords);
      }
    });
  };

  const createPropertyMarker = (property: Property, coords: [number, number]) => {
    if (!map.current) return;

    const el = document.createElement('div');
    el.className = 'property-marker';
    el.setAttribute('data-property-id', property.id);
    el.innerHTML = `<div class="marker-content" style="background: white; color: black; padding: 3px 7px; border-radius: 20px; border: 2px solid rgba(0,0,0,0.1); font-weight: 500; font-size: 15px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-family: Jost, sans-serif; white-space: nowrap;">${formatMarkerPrice(property.price || 0)}</div>`;

    const popupBg = isDark ? '#18181b' : '#fff';
    const popupText = isDark ? '#fff' : '#000';
    const popupMuted = isDark ? '#a3a3a3' : '#666';
    const img = getStudioImage(property);
    const url = getPropertyUrl(property);

    const smartMetaItems = getSmartMeta(property);
    const smartMetaHtml = smartMetaItems.map(m => `<div><div style="font-size: 16px; font-weight: 600; color: ${popupText};">${m.value}</div><div style="font-size: 12px; color: ${popupMuted};">${m.label}</div></div>`).join('');

    const popupHtml = `<div onclick="window.open('${url}', '${openInNewWindow ? '_blank' : '_self'}')" style="display: flex; gap: 16px; padding: 16px; font-family: Jost, sans-serif; width: 450px; cursor: pointer; background-color: ${popupBg};"><div style="width: 180px; height: 180px; flex-shrink: 0; border-radius: 12px; overflow: hidden; background-color: #f0f0f0;"><img src="${img}" alt="${property.address}" onerror="this.style.display='none'" style="width: 100%; height: 100%; object-fit: cover;" /></div><div style="flex: 1; display: flex; flex-direction: column;"><div style="font-size: 24px; font-weight: 600; margin-bottom: 8px; color: ${popupText};">${formatFullPrice(property.price || 0)}</div><div style="font-size: 14px; color: ${popupMuted}; margin-bottom: 12px; line-height: 1.5;">${property.address}<br/>${property.city}, ${property.province}</div><div style="display: flex; gap: 24px; margin-bottom: 12px;">${smartMetaHtml}</div><div style="font-size: 12px; color: ${popupMuted}; margin-top: auto;">Listed by ${property.agent_name}</div></div></div>`;

    const popup = new mapboxgl.Popup({ offset: 25, closeButton: true, closeOnClick: true, maxWidth: '500px', className: 'custom-popup' })
      .setHTML(popupHtml);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentPopup.current) { currentPopup.current.remove(); currentPopup.current = null; }
      popup.setLngLat(coords).addTo(map.current!);
      currentPopup.current = popup;
      setHighlightedPropertyId(property.id);
    });

    popup.on('close', () => { 
      if (currentPopup.current === popup) {
        currentPopup.current = null; 
      }
    });

    const marker = new mapboxgl.Marker(el).setLngLat(coords).addTo(map.current!);
    markers.current.push(marker);
    markersMap.current.set(property.id, { marker, element: el });
  };

  const addMarkersToMap = (props: Property[]) => {
    if (!map.current) return;
    
    // Clear existing markers
    markers.current.forEach(m => m.remove());
    markers.current = [];
    markersMap.current.clear();

    props.forEach(property => {
      if (!property.longitude || !property.latitude) return;
      createPropertyMarker(property, [property.longitude, property.latitude]);
    });
  };

  // Scroll handler
  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const delta = scrollTop - lastScrollTop.current;
      if (Math.abs(delta) > 8) { setIsFilterVisible(delta <= 0); lastScrollTop.current = scrollTop; }
      if (scrollTop <= 5) setIsFilterVisible(true);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePropertyHover = (property: Property | null) => {
    setHoveredProperty(property);
    markersMap.current.forEach((data, id) => {
      const content = data.element.querySelector('.marker-content') as HTMLElement;
      if (content) { content.style.background = property && id === property.id ? 'black' : 'white'; content.style.color = property && id === property.id ? 'white' : 'black'; }
    });
  };

  // Static filter options
  const bedOptions = [{ label: 'Any', value: 'any' }, { label: '1+', value: '1' }, { label: '2+', value: '2' }, { label: '3+', value: '3' }, { label: '4+', value: '4' }, { label: '5+', value: '5' }];
  const bathOptions = [{ label: 'Any', value: 'any' }, { label: '1+', value: '1' }, { label: '2+', value: '2' }, { label: '3+', value: '3' }, { label: '4+', value: '4' }];
  const sortOptions = [
    { label: 'Price low to high', value: 'price_asc' },
    { label: 'Price high to low', value: 'price_desc' },
    { label: 'Price per sqft low to high', value: 'price_sqft_asc' },
    { label: 'Price per sqft high to low', value: 'price_sqft_desc' },
    { label: 'Bedrooms low to high', value: 'bedrooms_asc' },
    { label: 'Bedrooms high to low', value: 'bedrooms_desc' },
    { label: 'Baths low to high', value: 'bathrooms_asc' },
    { label: 'Baths high to low', value: 'bathrooms_desc' },
    { label: 'Newest', value: 'newest' },
    { label: 'Oldest', value: 'oldest' }
  ];

  const getTypeLabel = () => selectedType === 'all' ? 'All Property Types' : typeOptions.find(o => o.value === selectedType)?.label || 'All Property Types';
  const getBedLabel = () => selectedBeds === 'any' ? 'Bedrooms' : `${selectedBeds}+ Beds`;
  const getBathLabel = () => selectedBaths === 'any' ? 'Baths' : `${selectedBaths}+ Baths`;
  const getSortLabel = () => sortOptions.find(o => o.value === selectedSort)?.label || 'Newest';
  const getPriceLabel = () => priceApplied ? `${formatCurrency(priceRange[0])} - ${formatCurrency(priceRange[1])}` : 'Price';

  // Price slider helpers
  const handleMinSliderChange = (value: number) => {
    const maxVal = tempPriceRange[1];
    if (value <= maxVal) setTempPriceRange([value, maxVal]);
  };

  const handleMaxSliderChange = (value: number) => {
    const minVal = tempPriceRange[0];
    if (value >= minVal) setTempPriceRange([minVal, value]);
  };

  const resetPriceFilter = () => {
    setTempPriceRange([minMaxPrices.min, minMaxPrices.max]);
    setPriceRange([minMaxPrices.min, minMaxPrices.max]);
    setPriceApplied(false);
    setOpenFilter(null);
  };

  const applyPriceFilter = () => {
    setPriceRange(tempPriceRange);
    setPriceApplied(true);
    setOpenFilter(null);
  };

  // Check if any filter is active
  const hasActiveFilters = selectedType !== 'all' || selectedBeds !== 'any' || selectedBaths !== 'any' || priceApplied;

  // Reset all filters
  const resetAllFilters = () => {
    setSelectedType('all');
    setSelectedBeds('any');
    setSelectedBaths('any');
    setSelectedSort('newest');
    setPriceRange([minMaxPrices.min, minMaxPrices.max]);
    setTempPriceRange([minMaxPrices.min, minMaxPrices.max]);
    setPriceApplied(false);
  };

  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden ${isDark ? 'dark' : ''}`} style={{ backgroundColor: bgColor, fontFamily: 'Jost, sans-serif' }}>
      <style>{`
        .custom-popup .mapboxgl-popup-content { border-radius: 16px; padding: 0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .custom-popup .mapboxgl-popup-close-button { width: 28px; height: 28px; font-size: 20px; background-color: #000; color: white; border-radius: 100px; right: 8px; top: 8px; }
        .mapboxgl-popup-tip { display: none; }
        input[type="range"] { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; background: #000; cursor: pointer; margin-top: -8px; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        input[type="range"]::-moz-range-thumb { height: 20px; width: 20px; border-radius: 50%; background: #000; cursor: pointer; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        input[type="range"]::-webkit-slider-runnable-track { height: 4px; background: transparent; }
        input[type="range"]::-moz-range-track { height: 4px; background: transparent; }
      `}</style>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {listingPosition === 'right' && (
          <div className={`flex-1 relative min-h-0 ${!showMap ? 'hidden' : 'block'} lg:block p-4`} style={{ backgroundColor: mapBgColor }}>
            <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" />
            <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-10" style={{ marginBottom: '20px' }}><button onClick={() => setShowMap(false)} className="px-6 py-3 bg-white text-black rounded-full shadow-lg font-medium">View List</button></div>
          </div>
        )}

        <div 
          ref={listContainerRef}
          className={`w-full ${showMap ? 'hidden' : 'flex'} lg:flex flex-col ${mapColumns >= 2 ? 'lg:w-[800px] xl:w-[900px]' : 'lg:w-[600px] xl:w-[675px]'} min-h-0`} 
          style={{ backgroundColor: cardBgColor }}
        >
          <div className="flex-1 overflow-y-auto overscroll-contain">
          {showFilters && (
            <div 
              className="shrink-0 z-10 px-4 py-3" 
              style={{ 
                backgroundColor: bgColor, 
                position: 'sticky',
                top: isFilterVisible ? '0px' : '-200px',
                transition: 'top 0.3s ease-out',
              }}
            >
              <div className="relative flex flex-wrap gap-2 items-center">
                <button onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: openFilter === 'type' ? '#1a1a1a' : filterBgColor, color: openFilter === 'type' ? '#fff' : textColor }}>{getTypeLabel()}<ChevronDownIcon /></button>
                <button onClick={() => setOpenFilter(openFilter === 'price' ? null : 'price')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: openFilter === 'price' ? '#1a1a1a' : filterBgColor, color: openFilter === 'price' ? '#fff' : textColor }}>{getPriceLabel()}<ChevronDownIcon /></button>
                <button onClick={() => setOpenFilter(openFilter === 'beds' ? null : 'beds')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: openFilter === 'beds' ? '#1a1a1a' : filterBgColor, color: openFilter === 'beds' ? '#fff' : textColor }}>{getBedLabel()}<ChevronDownIcon /></button>
                <button onClick={() => setOpenFilter(openFilter === 'baths' ? null : 'baths')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: openFilter === 'baths' ? '#1a1a1a' : filterBgColor, color: openFilter === 'baths' ? '#fff' : textColor }}>{getBathLabel()}<ChevronDownIcon /></button>
                <button onClick={() => setOpenFilter(openFilter === 'sort' ? null : 'sort')} className="flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: openFilter === 'sort' ? '#1a1a1a' : filterBgColor, color: openFilter === 'sort' ? '#fff' : textColor }}>{getSortLabel()}<ChevronDownIcon /></button>
                {hasActiveFilters && (
                  <button onClick={resetAllFilters} className="text-sm underline whitespace-nowrap ml-1" style={{ color: mutedTextColor }}>reset filters</button>
                )}
              </div>

              {openFilter && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setOpenFilter(null)} />
                  <div className="absolute left-0 right-0 mt-3 mx-4 p-4 rounded-[24px] shadow-lg border z-30" style={{ backgroundColor: cardBgColor, borderColor, maxWidth: openFilter === 'price' ? '480px' : openFilter === 'baths' ? '440px' : undefined }}>
                    {openFilter === 'type' && (
                      <div className="flex flex-wrap gap-2">
                        {typeOptions.map(opt => {
                          const isSelected = selectedType === opt.value;
                          return (
                            <button key={opt.value} onClick={() => { setSelectedType(opt.value); setOpenFilter(null); }} className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2" style={{ fontFamily: 'Jost, sans-serif', fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}>
                              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>{isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}</div>
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {openFilter === 'price' && (
                      <div className="space-y-4" style={{ width: '440px' }}>
                        <h3 className="text-lg font-bold" style={{ color: textColor }}>Price</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold" style={{ color: textColor }}>From</label>
                            <input 
                              type="number" 
                              value={tempPriceRange[0] === minMaxPrices.min ? '' : tempPriceRange[0]} 
                              onChange={(e) => setTempPriceRange([e.target.value === '' ? minMaxPrices.min : parseInt(e.target.value), tempPriceRange[1]])} 
                              placeholder="Min" 
                              className="w-full px-3 py-2 text-base rounded-lg border" 
                              style={{ backgroundColor: cardBgColor, color: textColor, borderColor }} 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold" style={{ color: textColor }}>To</label>
                            <input 
                              type="number" 
                              value={tempPriceRange[1] === minMaxPrices.max ? '' : tempPriceRange[1]} 
                              onChange={(e) => setTempPriceRange([tempPriceRange[0], e.target.value === '' ? minMaxPrices.max : parseInt(e.target.value)])} 
                              placeholder="Max" 
                              className="w-full px-3 py-2 text-base rounded-lg border" 
                              style={{ backgroundColor: cardBgColor, color: textColor, borderColor }} 
                            />
                          </div>
                        </div>
                        {/* Price Slider */}
                        <div className="relative h-6 mt-4">
                          <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full"></div>
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 h-2 bg-black rounded-full" 
                            style={{ 
                              left: `${((tempPriceRange[0] - minMaxPrices.min) / (minMaxPrices.max - minMaxPrices.min)) * 100}%`, 
                              right: `${100 - ((tempPriceRange[1] - minMaxPrices.min) / (minMaxPrices.max - minMaxPrices.min)) * 100}%` 
                            }}
                          ></div>
                          <input 
                            type="range" 
                            min={minMaxPrices.min} 
                            max={minMaxPrices.max} 
                            step={10000} 
                            value={tempPriceRange[0]} 
                            onChange={(e) => handleMinSliderChange(parseInt(e.target.value))} 
                            className="absolute w-full h-6 appearance-none bg-transparent cursor-pointer" 
                            style={{ zIndex: 10 }} 
                          />
                          <input 
                            type="range" 
                            min={minMaxPrices.min} 
                            max={minMaxPrices.max} 
                            step={10000} 
                            value={tempPriceRange[1]} 
                            onChange={(e) => handleMaxSliderChange(parseInt(e.target.value))} 
                            className="absolute w-full h-6 appearance-none bg-transparent cursor-pointer" 
                            style={{ zIndex: 11, clipPath: `inset(0 0 0 ${((tempPriceRange[0] + tempPriceRange[1]) / 2 / minMaxPrices.max) * 100}%)` }} 
                          />
                        </div>
                        <div className="flex justify-between text-sm" style={{ color: mutedTextColor }}>
                          <span>{formatCurrency(tempPriceRange[0])}</span>
                          <span>{formatCurrency(tempPriceRange[1])}</span>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={resetPriceFilter} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100" style={{ borderColor, color: textColor }}>Reset</button>
                          <button onClick={applyPriceFilter} className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800">Apply</button>
                        </div>
                      </div>
                    )}
                    {openFilter === 'beds' && (
                      <div className="flex flex-wrap gap-2">
                        {bedOptions.map(opt => {
                          const isSelected = selectedBeds === opt.value;
                          return (
                            <button key={opt.value} onClick={() => { setSelectedBeds(opt.value); setOpenFilter(null); }} className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2" style={{ fontFamily: 'Jost, sans-serif', fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}>
                              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>{isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}</div>
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {openFilter === 'baths' && (
                      <div className="flex flex-wrap gap-2">
                        {bathOptions.map(opt => {
                          const isSelected = selectedBaths === opt.value;
                          return (
                            <button key={opt.value} onClick={() => { setSelectedBaths(opt.value); setOpenFilter(null); }} className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2" style={{ fontFamily: 'Jost, sans-serif', fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}>
                              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>{isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}</div>
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {openFilter === 'sort' && (
                      <div className="flex flex-wrap gap-2">
                        {sortOptions.map(opt => {
                          const isSelected = selectedSort === opt.value;
                          return (
                            <button key={opt.value} onClick={() => { setSelectedSort(opt.value); setOpenFilter(null); }} className="flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap border px-3 py-2" style={{ fontFamily: 'Jost, sans-serif', fontWeight: 500, fontSize: '14px', backgroundColor: isSelected ? '#1a1a1a' : 'transparent', color: isSelected ? '#fff' : textColor, borderColor: isSelected ? '#1a1a1a' : borderColor, borderRadius: '40px' }}>
                              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isSelected ? '#10b981' : borderColor }}>{isSelected && <CheckIcon className="w-3 h-3 text-emerald-500" />}</div>
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

          <div className={mapColumns >= 2 ? 'grid grid-cols-2 gap-3 p-4 flex-1' : 'p-4 space-y-3 flex-1'}>
            {loading && <div className="flex flex-col items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mb-4"></div></div>}
            {!loading && filteredProperties.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-center"><div style={{ color: mutedTextColor }}>No properties found</div></div>}
            {filteredProperties.map(property => {
              const isTopCard = listingStyle === 'top' || mapColumns >= 2;
              const isMetaOverlay = cardStyle === 'meta-overlay';
              
              return (
              <div key={property.id} className={`rounded-xl overflow-hidden cursor-pointer transition-all ${hoveredProperty?.id === property.id || highlightedPropertyId === property.id ? 'ring-2 ring-gray-800' : ''}`} style={{ backgroundColor: cardBgColor, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} onClick={() => window.open(getPropertyUrl(property), openInNewWindow ? '_blank' : '_self')} onMouseEnter={() => handlePropertyHover(property)} onMouseLeave={() => handlePropertyHover(null)}>
                <div className={isTopCard ? '' : 'sm:flex'}>
                  <div className={`relative flex-shrink-0 ${isTopCard ? 'w-full' : 'sm:w-[280px]'}`} style={isTopCard ? { aspectRatio: aspectCSS } : {}}>
                    <img src={getStudioImage(property)} alt={property.address} className={`w-full ${isTopCard ? 'h-full' : 'aspect-video sm:h-full'} object-cover rounded-xl`} style={isTopCard ? {} : { aspectRatio: aspectCSS }} onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff' }}>{property.property_subtype === 'Detached' ? 'House' : property.property_subtype}</span>
                    {isMetaOverlay && (
                      <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }}>
                        <div className="font-bold text-white" style={{ fontSize: '20px' }}>{formatFullPrice(property.price || 0)}</div>
                        <div className="text-white/80 text-sm truncate">{property.address}, {property.city}</div>
                        <div className="flex gap-4 mt-1 text-white/90 text-sm">
                          {getSmartMeta(property).map((m, i) => (
                            <span key={i}>{m.value} {m.label}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {!isMetaOverlay && (
                  <div className="flex-1 p-4 min-w-0 flex flex-col">
                    <div className="font-bold mb-1" style={{ fontSize: '22px', color: textColor }}>{formatFullPrice(property.price || 0)}</div>
                    <div className="flex items-start gap-1 mb-2"><svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="#6B7280"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg><span className="line-clamp-2" style={{ fontSize: '15px', color: mutedTextColor }}>{property.address}, {property.city}</span></div>
                    <div className="flex gap-6 mb-3">
                      {getSmartMeta(property).map((m, i) => (
                        <div key={i} className="flex flex-col"><span className="font-bold text-lg" style={{ color: textColor }}>{m.value}</span><span style={{ color: mutedTextColor, fontSize: '13px' }}>{m.label}</span></div>
                      ))}
                    </div>
                    {/* Agent Info - Inline display for primary and co-listing agents */}
                    <div className="flex items-center gap-3 mt-auto pt-2 flex-wrap" style={{ borderTop: `1px solid ${borderColor}` }}>
                      {/* Primary Agent */}
                      <div className="flex items-center gap-1.5">
                        {property.agent_profile_image_url ? (
                          <img src={property.agent_profile_image_url} alt={property.agent_name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', color: mutedTextColor }}>{(property.agent_name || 'A').charAt(0).toUpperCase()}</div>
                        )}
                        <span className="text-xs font-medium" style={{ color: textColor }}>{property.agent_name}</span>
                      </div>
                      {/* Co-listing Agents - Inline */}
                      {property.co_listing_agent_profiles && property.co_listing_agent_profiles.map((co: any) => (
                        <div key={co.id} className="flex items-center gap-1.5">
                          {co.profile_image_url ? (
                            <img src={co.profile_image_url} alt={co.full_name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: isDark ? '#3f3f46' : '#e5e7eb', color: mutedTextColor }}>{(co.full_name || 'C').charAt(0)}</div>
                          )}
                          <span className="text-xs font-medium" style={{ color: textColor }}>{co.full_name}</span>
                        </div>
                      ))}
                      {!property.co_listing_agent_profiles?.length && property.co_list_agent_name && (
                        <span className="text-xs" style={{ color: mutedTextColor }}>& {property.co_list_agent_name}</span>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
          </div>
          <div className="lg:hidden shrink-0 p-4 border-t" style={{ borderColor }}><button onClick={() => setShowMap(true)} className="w-full py-3 bg-black text-white rounded-lg font-medium">View Map</button></div>
        </div>

        {listingPosition === 'left' && (
          <div className={`flex-1 relative min-h-0 ${!showMap ? 'hidden' : 'block'} lg:block p-4`} style={{ backgroundColor: mapBgColor }}>
            <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" />
            <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-10" style={{ marginBottom: '20px' }}><button onClick={() => setShowMap(false)} className="px-6 py-3 bg-white text-black rounded-full shadow-lg font-medium">View List</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
