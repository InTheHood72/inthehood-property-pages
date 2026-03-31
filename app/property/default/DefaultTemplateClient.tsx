'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Constants
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const FALLBACK_BACKEND_URL = 'https://api-production-531c.up.railway.app';
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Icons
const Icons = {
  Bed: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 18V12C3 10.3431 4.34315 9 6 9H18C19.6569 9 21 10.3431 21 12V18" strokeLinecap="round"/><path d="M3 18V19C3 19.5523 3.44772 20 4 20H20C20.5523 20 21 19.5523 21 19V18" strokeLinecap="round"/><path d="M3 12V7C3 5.89543 3.89543 5 5 5H8C9.10457 5 10 5.89543 10 7V9" strokeLinecap="round"/><rect x="4" y="12" width="16" height="3" rx="1"/></svg>,
  Bath: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12H20C20.5523 12 21 12.4477 21 13V14C21 16.2091 19.2091 18 17 18H7C4.79086 18 3 16.2091 3 14V13C3 12.4477 3.44772 12 4 12Z" strokeLinecap="round"/><path d="M6 18V20M18 18V20" strokeLinecap="round"/><path d="M7 12V5C7 4.44772 7.44772 4 8 4H9C9.55228 4 10 4.44772 10 5V6" strokeLinecap="round"/></svg>,
  Size: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>,
  Phone: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Mail: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  X: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  ChevronLeft: () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  ChevronRight: () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  Check: () => <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  Document: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Book: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  ArrowUpRight: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" /></svg>,
  ArrowRight: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
  Home: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// Supabase helper
const supabaseFetch = async (table: string, query: string) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  return res.json();
};

export default function DefaultTemplateClient() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('id') || searchParams.get('property');
  const agentIdOverride = searchParams.get('agentId');

  // State
  const [property, setProperty] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [coListingAgents, setCoListingAgents] = useState<any[]>([]);
  const [neighbourhood, setNeighbourhood] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [backendUrl, setBackendUrl] = useState<string>(FALLBACK_BACKEND_URL);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [neighbourhoodLightboxOpen, setNeighbourhoodLightboxOpen] = useState(false);
  const [neighbourhoodLightboxImages, setNeighbourhoodLightboxImages] = useState<any[]>([]);
  const [neighbourhoodLightboxIndex, setNeighbourhoodLightboxIndex] = useState(0);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '', tourType: 'video', selectedAgent: 'primary' });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const backendUrlFetched = useRef(false);

  const isMLS = propertyId && !/^[0-9a-f]{8}-[0-9a-f]{4}/.test(propertyId);

  // Fetch dynamic backend URL from Supabase
  useEffect(() => {
    const fetchBackendUrl = async () => {
      if (backendUrlFetched.current) return;
      backendUrlFetched.current = true;
      
      try {
        const response = await fetch(`${FALLBACK_BACKEND_URL}/api/backend-config`);
        if (response.ok) {
          const data = await response.json();
          if (data.backend_url) {
            console.log('📡 DefaultTemplate: Using dynamic backend URL:', data.backend_url);
            setBackendUrl(data.backend_url);
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch dynamic backend URL, using fallback');
      }
    };
    
    fetchBackendUrl();
  }, []);

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => setShowStickyHeader(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch data - depends on backendUrl being ready
  useEffect(() => {
    if (!propertyId) { setLoading(false); return; }
    if (!backendUrl) return; // Wait for backend URL
    
    const fetchData = async () => {
      try {
        let propData: any = null;
        if (isMLS) {
          console.log('📡 Fetching MLS property:', propertyId, 'from', backendUrl);
          const res = await fetch(`${backendUrl}/api/supabase/properties/${propertyId}`);
          const data = await res.json();
          if (data.success && data.data) {
            const p = data.data;
            propData = {
              ...p, id: p.mls_number, mls_number: p.mls_number, address: p.address, city: p.city,
              province: p.state || 'Alberta', postal_code: p.postal_code, price: parseFloat(p.price),
              bedrooms: parseInt(p.bedrooms) || 0, bathrooms_full: parseInt(p.bathrooms_full) || 0,
              bathrooms_half: parseInt(p.bathrooms_half) || 0, sqft: parseInt(p.sqft) || 0,
              lot_size_acres: parseFloat(p.lot_size_acres) || 0, property_type: p.property_type,
              property_subtype: p.property_sub_type, description: p.description, year_built: p.year_built,
              latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude),
              images: (p.images || []).map((url: string, i: number) => ({ url, is_hero: i === 0 })),
              subdivision_name: p.subdivision, neighbourhood: p.subdivision,
              virtual_tour_url: p.virtual_tour_url, video_tour_url: p.video_tour_url,
              virtual_tour_url_branded: p.virtual_tour_url_branded, virtual_tour_url_unbranded: p.virtual_tour_url_unbranded,
              garage_spaces: p.garage_spaces,
              basement: p.basement, heating: p.heating, cooling: p.cooling, appliances: p.appliances,
              flooring: p.flooring, exterior_features: p.exterior_features, community_features: p.community_features,
              fireplace_total: p.fireplace_total, association_fee: p.association_fee,
              association_fee_frequency: p.association_fee_frequency, condo_name: p.condo_name,
              association_amenities: p.association_amenities, roof_type: p.roof_type,
              foundation_details: p.foundation_details, zoning: p.zoning, parking_total: p.parking_total,
              room_dimensions: p.room_dimensions, url_floorplan: p.url_floorplan, url_brochure: p.url_brochure,
              laundry_features: p.laundry_features, lot_features: p.lot_features, patio_features: p.patio_features,
              pets_allowed: p.pets_allowed, zone: p.zone, region: p.region,
              open_houses: p.open_houses || []
            };
            setAgent({ name: p.agent_name, phone_number: p.agent_phone, email: p.agent_email, brokerage: p.office_name });
          }
        } else {
          const data = await supabaseFetch('properties', `id=eq.${propertyId}&select=*`);
          if (data?.[0]) {
            propData = data[0];
            if (propData.images && Array.isArray(propData.images)) {
              propData.images = propData.images.map((url: string, i: number) => ({ url, is_hero: i === 0 }));
            }
            if (propData.user_id) {
              const profiles = await supabaseFetch('profiles', `id=eq.${propData.user_id}&select=*`);
              if (profiles?.[0]) {
                const p = profiles[0];
                setAgent({ name: p.full_name || p.name, phone_number: p.phone_number || p.phone, email: p.email, profile_image: p.profile_image_url, brokerage: p.brokerage_name || p.office_name });
              }
            }
            if (propData.co_listing_agents?.length > 0) {
              try {
                // Supabase expects: id=in.(val1,val2) without quotes for UUIDs
                const coAgentIds = propData.co_listing_agents.join(',');
                const coAgents = await supabaseFetch('profiles', `id=in.(${coAgentIds})`);
                if (coAgents?.length > 0 && !coAgents.error) {
                  setCoListingAgents(coAgents.map((p: any) => ({ id: p.id, name: p.full_name || p.name, phone_number: p.phone_number || p.phone, email: p.email, profile_image: p.profile_image_url })));
                }
              } catch (e) { console.error('Error fetching co-listing agents:', e); }
            }
            if (propData.neighborhood_id) {
              const hoods = await supabaseFetch('neighborhoods', `id=eq.${propData.neighborhood_id}&select=*`);
              if (hoods?.[0]) setNeighbourhood(hoods[0]);
            }
          }
        }
        if (agentIdOverride) {
          const profiles = await supabaseFetch('profiles', `id=eq.${agentIdOverride}&select=*`);
          if (profiles?.[0]) {
            const p = profiles[0];
            setAgent({ name: p.full_name || p.name, phone_number: p.phone_number || p.phone, email: p.email, profile_image: p.profile_image_url, brokerage: p.brokerage_name || p.office_name });
          }
        }
        setProperty(propData);
      } catch (err) { console.error('Fetch error:', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [propertyId, isMLS, agentIdOverride, backendUrl]);

  // Map - use streets style like pillar9 half-map search with pulsating marker
  useEffect(() => {
    if (!property?.latitude || !property?.longitude || !mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({ 
      container: mapContainerRef.current, 
      style: 'mapbox://styles/mapbox/streets-v12', 
      center: [property.longitude, property.latitude], 
      zoom: 14 
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    
    // Wait for map to load before adding marker
    map.on('load', () => {
      // Custom pulsating marker with house icon (matching redox-light template)
      const markerEl = document.createElement('div');
      markerEl.style.width = '40px';
      markerEl.style.height = '40px';
      markerEl.style.cursor = 'pointer';
      markerEl.innerHTML = `
        <style>
          @keyframes ping-animation {
            0% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.5); opacity: 0; }
            100% { transform: scale(1); opacity: 0; }
          }
        </style>
        <div style="position: relative;">
          <div style="position: absolute; inset: 0; width: 40px; height: 40px; background-color: #000000; border-radius: 50%; opacity: 0.3; animation: ping-animation 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 40px; height: 40px; background-color: #000000; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center;">
            <svg fill="none" stroke="white" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
          <div style="position: absolute; left: 50%; transform: translateX(-50%); top: 37px; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 6px solid #000000;"></div>
        </div>
      `;
      new mapboxgl.Marker({ element: markerEl, anchor: 'bottom' }).setLngLat([property.longitude, property.latitude]).addTo(map);
    });
    
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [property]);

  // Helpers
  const formatPrice = (p: number) => `C$${p?.toLocaleString() || '0'}`;
  const getBaths = () => (property?.bathrooms_full || 0) + (property?.bathrooms_half || 0) || property?.bathrooms || 0;
  const getDetailedBaths = () => {
    const full = property?.bathrooms_full || 0, half = property?.bathrooms_half || 0;
    if (full && half) return `${full} full, ${half} half`;
    if (full) return `${full} full`;
    return property?.bathrooms || 0;
  };
  const images = property?.images || [];
  const openNeighbourhoodLightbox = (imgs: any[], idx: number) => { setNeighbourhoodLightboxImages(imgs); setNeighbourhoodLightboxIndex(idx); setNeighbourhoodLightboxOpen(true); };

  // Generate 10 days for tour picker
  const generateDates = () => {
    const dates = [];
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 10; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" /></div>;
  if (!property && !loading) return <div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Property not found</h1></div>;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Jost, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sticky Header */}
      <div className={`fixed top-0 left-0 right-0 bg-white shadow-md z-50 transition-transform duration-300 ${showStickyHeader ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div><h2 className="font-bold text-gray-900 text-lg">{property.address}</h2><p className="text-sm text-gray-500">{property.subdivision_name || property.neighbourhood ? `${property.subdivision_name || property.neighbourhood}, ` : ''}{property.city}, {property.province}</p></div>
          <div className="hidden lg:flex items-center gap-6">
            {property.mls_number && <div className="text-center"><div className="font-semibold">{property.mls_number}</div><div className="text-xs text-gray-500">MLS#</div></div>}
            {property.bedrooms > 0 && <div className="text-center"><div className="font-semibold">{property.bedrooms}</div><div className="text-xs text-gray-500">Beds</div></div>}
            {getBaths() > 0 && <div className="text-center"><div className="font-semibold">{getBaths()}</div><div className="text-xs text-gray-500">Baths</div></div>}
            {property.sqft > 0 && <div className="text-center"><div className="font-semibold">{property.sqft.toLocaleString()}</div><div className="text-xs text-gray-500">Sqft</div></div>}
          </div>
          <div className="hidden md:block"><div className="text-xs text-gray-500">Price</div><div className="font-bold text-lg">{formatPrice(property.price)}</div></div>
          <button onClick={() => setTourModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium">Request Tour</button>
        </div>
      </div>

      {/* Property Header - Full Width Above Gallery */}
      <section className="max-w-[1200px] mx-auto px-4 pt-28 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <p className="text-gray-500 text-sm">{property.subdivision_name || property.neighbourhood ? `${property.subdivision_name || property.neighbourhood}, ` : ''}{property.city}, {property.province} {property.postal_code}</p>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">{property.address}</h1>
            <div className="flex flex-wrap items-center gap-6 pt-2">
              {property.mls_number && <div className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg><span className="font-semibold">{property.mls_number}</span><span className="text-gray-500">MLS#</span></div>}
              {property.bedrooms > 0 && <div className="flex items-center gap-2"><Icons.Bed /><span className="font-semibold">{property.bedrooms}</span><span className="text-gray-500">Beds</span></div>}
              {getBaths() > 0 && <div className="flex items-center gap-2"><Icons.Bath /><span className="font-semibold">{getBaths()}</span><span className="text-gray-500">Baths</span></div>}
              {property.sqft > 0 && <div className="flex items-center gap-2"><Icons.Size /><span className="font-semibold">{property.sqft.toLocaleString()}</span><span className="text-gray-500">Sqft</span></div>}
            </div>
          </div>
          <div className="text-left lg:text-right">
            <p className="text-sm text-gray-500">List Price</p>
            <p className="text-3xl lg:text-4xl font-bold text-gray-900">{formatPrice(property.price)}</p>
            {property.property_subtype && <span className="inline-block mt-2 px-3 py-1 bg-gray-100 rounded-full text-sm font-medium">{property.property_subtype}</span>}
          </div>
        </div>
      </section>

      {/* Hero Gallery */}
      <section className="max-w-[1200px] mx-auto px-4">
        <div className="grid grid-cols-4 gap-2 rounded-2xl overflow-hidden" style={{ height: '500px' }}>
          {images[0] && <div className="col-span-2 row-span-2 cursor-pointer relative group" onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}><img src={images[0].url} alt="Main" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" /></div>}
          {images.slice(1, 5).map((img: any, i: number) => (
            <div key={i} className="cursor-pointer relative group" onClick={() => { setLightboxIndex(i + 1); setLightboxOpen(true); }}>
              <img src={img.url} alt={`Photo ${i + 2}`} className="w-full h-full object-cover" />
              {i === 3 && images.length > 5 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button className="bg-white/95 hover:bg-white text-gray-900 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
                    See all images <Icons.ArrowRight />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Open House Banner - Above Description */}
            {property.open_houses && property.open_houses.length > 0 && (() => {
              // Filter for upcoming open houses only
              const now = new Date();
              const upcomingOpenHouses = property.open_houses.filter((oh: any) => {
                const ohDate = new Date(oh.open_house_date || oh.openHouseDate);
                return ohDate >= new Date(now.toDateString()); // Compare date only
              }).sort((a: any, b: any) => {
                const dateA = new Date(a.open_house_date || a.openHouseDate);
                const dateB = new Date(b.open_house_date || b.openHouseDate);
                return dateA.getTime() - dateB.getTime();
              });
              
              if (upcomingOpenHouses.length === 0) return null;
              
              const formatOpenHouseDate = (dateStr: string) => {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              };
              
              const formatOpenHouseTime = (startStr: string, endStr: string) => {
                const formatTime = (str: string) => {
                  if (!str) return '';
                  const date = new Date(str);
                  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                };
                const start = formatTime(startStr);
                const end = formatTime(endStr);
                return start && end ? `${start} - ${end}` : start || end || '';
              };
              
              return (
                <div className="bg-red-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-bold text-lg">Open House{upcomingOpenHouses.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {upcomingOpenHouses.slice(0, 3).map((oh: any, idx: number) => (
                      <div key={idx} className="flex flex-wrap items-center gap-x-3 text-sm">
                        <span className="font-semibold">
                          {formatOpenHouseDate(oh.open_house_date || oh.openHouseDate)}
                        </span>
                        <span className="opacity-90">
                          {formatOpenHouseTime(oh.open_house_start_time || oh.openHouseStartTime, oh.open_house_end_time || oh.openHouseEndTime)}
                        </span>
                      </div>
                    ))}
                    {upcomingOpenHouses.length > 3 && (
                      <div className="text-sm opacity-80">+{upcomingOpenHouses.length - 3} more open house{upcomingOpenHouses.length - 3 > 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>
              );
            })()}
            
            {/* Description */}
            {property.description && (
              <section className="pb-6">
                <h2 className="text-2xl font-bold mb-4">Description</h2>
                <div className="text-gray-600 leading-relaxed">
                  {property.description.split(/\n\s*\n/).filter((p: string) => p.trim()).map((paragraph: string, i: number) => (
                    <p key={i} className="mb-4 last:mb-0">{paragraph.trim()}</p>
                  ))}
                </div>
              </section>
            )}

            {/* Smart Media Detection - Video Tour & Virtual Tour */}
            {(() => {
              const allUrls = [property.virtual_tour_url, property.video_tour_url, property.virtual_tour_url_branded, property.virtual_tour_url_unbranded].filter(Boolean);
              const isVideoUrl = (url: string) => /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
              const getYouTubeEmbed = (url: string) => {
                const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
                return match ? `https://www.youtube.com/embed/${match[1]}` : url.replace('watch?v=', 'embed/');
              };
              const videoUrl = allUrls.find(u => isVideoUrl(u));
              const virtualUrl = allUrls.find(u => !isVideoUrl(u));
              return (
                <>
                  {videoUrl && (
                    <section className="border-t pt-8">
                      <h2 className="text-2xl font-bold mb-4">Video Tour</h2>
                      <div className="aspect-video rounded-2xl overflow-hidden bg-gray-100">
                        <iframe src={getYouTubeEmbed(videoUrl)} className="w-full h-full" allowFullScreen title="Video Tour" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                      </div>
                    </section>
                  )}
                  {virtualUrl && (
                    <section className="border-t pt-8">
                      <h2 className="text-2xl font-bold mb-4">Virtual Tour</h2>
                      <div className="aspect-video rounded-2xl overflow-hidden bg-gray-100">
                        <iframe src={virtualUrl} className="w-full h-full" allowFullScreen title="Virtual Tour" />
                      </div>
                    </section>
                  )}
                </>
              );
            })()}

            {/* Location Map - Right after Virtual Tour */}
            {property.latitude && property.longitude && (
              <section className="border-t pt-8">
                <h2 className="text-2xl font-bold mb-4">Location</h2>
                <div ref={mapContainerRef} className="w-full h-[400px] rounded-2xl overflow-hidden" />
              </section>
            )}

            {/* Property Features & Details */}
            <section className="border-t pt-8">
              <h2 className="text-2xl font-bold mb-4">Property Features & Details</h2>
              <div className="bg-white rounded-lg p-6 space-y-8" style={{ border: '1px solid rgba(215,219,227,.4)' }}>
                
                {/* Basic Info */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Basic Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    {property.mls_number && <DetailRow label="MLS#" value={property.mls_number} />}
                    {property.city && <DetailRow label="City" value={property.city} />}
                    {(property.subdivision_name || property.neighbourhood) && <DetailRow label="Neighbourhood" value={property.subdivision_name || property.neighbourhood} />}
                    {property.zone && <DetailRow label="Zone" value={property.zone} />}
                    {property.region && <DetailRow label="Region" value={property.region} />}
                    {property.property_type && <DetailRow label="Property Type" value={property.property_type} />}
                    {property.property_subtype && <DetailRow label="Subtype" value={property.property_subtype} />}
                    {property.bedrooms > 0 && <DetailRow label="Bedrooms" value={property.bedrooms} />}
                    {getBaths() > 0 && <DetailRow label="Bathrooms" value={getDetailedBaths()} />}
                    {property.sqft > 0 && <DetailRow label="Square Feet" value={property.sqft.toLocaleString()} />}
                    {property.year_built && <DetailRow label="Year Built" value={property.year_built} />}
                    {property.lot_size_acres > 0 && <DetailRow label="Lot Size" value={`${property.lot_size_acres} acres`} />}
                    {property.parking_total > 0 && <DetailRow label="Parking Spaces" value={property.parking_total} />}
                    {(agent?.brokerage || property.office_name) && <DetailRow label="Listing Brokerage" value={agent?.brokerage || property.office_name} />}
                  </div>
                </div>

                {/* Heating & Cooling */}
                {(property.heating || property.cooling) && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Heating & Cooling</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      {property.heating && <DetailRow label="Heating" value={Array.isArray(property.heating) ? property.heating.join(', ') : property.heating} />}
                      {property.cooling && <DetailRow label="Cooling" value={Array.isArray(property.cooling) ? property.cooling.join(', ') : property.cooling} />}
                    </div>
                  </div>
                )}

                {/* Condo/HOA */}
                {(property.association_fee || property.condo_name) && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Condo/HOA Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      {property.association_fee && parseFloat(property.association_fee) > 0 && <DetailRow label="HOA/Condo Fee" value={`$${parseFloat(property.association_fee).toLocaleString()}${property.association_fee_frequency ? `/${property.association_fee_frequency}` : '/month'}`} />}
                      {property.condo_name && property.condo_name !== 'Z-name Not Listed' && <DetailRow label="Condo Name" value={property.condo_name} />}
                      {property.association_amenities && <DetailRow label="Association Amenities" value={property.association_amenities} />}
                      {property.pets_allowed && <DetailRow label="Pets Allowed" value={property.pets_allowed} />}
                    </div>
                  </div>
                )}

                {/* Appliances */}
                {property.appliances && Array.isArray(property.appliances) && property.appliances.length > 0 && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Appliances & Amenities</h3>
                    <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 text-sm text-gray-700">
                      {property.appliances.map((item: string, i: number) => <div key={i} className="flex items-center gap-2"><Icons.Check /><span>{item.replace(/_/g, ' ')}</span></div>)}
                    </div>
                  </div>
                )}

                {/* Exterior Features */}
                {property.exterior_features && Array.isArray(property.exterior_features) && property.exterior_features.length > 0 && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Exterior Features</h3>
                    <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 text-sm text-gray-700">
                      {property.exterior_features.map((item: string, i: number) => <div key={i} className="flex items-center gap-2"><Icons.Check /><span>{item}</span></div>)}
                    </div>
                  </div>
                )}

                {/* Flooring */}
                {property.flooring && Array.isArray(property.flooring) && property.flooring.length > 0 && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Flooring</h3>
                    <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 text-sm text-gray-700">
                      {property.flooring.map((item: string, i: number) => <div key={i} className="flex items-center gap-2"><Icons.Check /><span>{item}</span></div>)}
                    </div>
                  </div>
                )}

                {/* Community Features */}
                {property.community_features && Array.isArray(property.community_features) && property.community_features.length > 0 && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Community Features</h3>
                    <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 text-sm text-gray-700">
                      {property.community_features.map((item: string, i: number) => <div key={i} className="flex items-center gap-2"><Icons.Check /><span>{item}</span></div>)}
                    </div>
                  </div>
                )}

                {/* Building Details */}
                {(property.roof_type || property.foundation_details || property.fireplace_total || property.zoning) && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Building Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      {property.roof_type && <DetailRow label="Roof Type" value={property.roof_type} />}
                      {property.foundation_details && <DetailRow label="Foundation" value={property.foundation_details} />}
                      {property.fireplace_total > 0 && <DetailRow label="Fireplaces" value={property.fireplace_total} />}
                      {property.zoning && <DetailRow label="Zoning" value={property.zoning} />}
                    </div>
                  </div>
                )}

                {/* Room Dimensions */}
                {property.room_dimensions && (() => {
                  try {
                    const rooms = typeof property.room_dimensions === 'string' ? JSON.parse(property.room_dimensions) : property.room_dimensions;
                    if (Array.isArray(rooms) && rooms.length > 0) {
                      return (
                        <div>
                          <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Room Dimensions</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b bg-gray-50"><tr><th className="text-left p-3 font-semibold text-gray-700">Room Type</th><th className="text-left p-3 font-semibold text-gray-700">Level</th><th className="text-right p-3 font-semibold text-gray-700">Dimensions</th></tr></thead>
                              <tbody className="divide-y divide-gray-100">
                                {rooms.filter((r: any) => (r.dimensions || r.RoomDimensions)?.trim()).map((r: any, i: number) => (
                                  <tr key={i} className="hover:bg-gray-50">
                                    <td className="p-3 text-gray-900">{r.type || r.RoomType || '-'}</td>
                                    <td className="p-3 text-gray-600">{r.level || r.RoomLevel || '-'}</td>
                                    <td className="p-3 text-right text-gray-900">{r.dimensions || r.RoomDimensions || ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    }
                  } catch (e) {}
                  return null;
                })()}

                {/* Property Documents */}
                {(property.url_floorplan || property.url_brochure) && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Property Documents</h3>
                    <div className="flex flex-wrap gap-3 pt-4">
                      {property.url_floorplan && (
                        <a href={property.url_floorplan} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200">
                          <Icons.Document /><div className="text-left"><div className="text-sm font-semibold text-gray-900">Floor Plan</div><div className="text-xs text-gray-600">View PDF</div></div>
                        </a>
                      )}
                      {property.url_brochure && (
                        <a href={property.url_brochure} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200">
                          <Icons.Book /><div className="text-left"><div className="text-sm font-semibold text-gray-900">Property Brochure</div><div className="text-xs text-gray-600">View PDF</div></div>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>

          {/* Right Column - Agent Card */}
          <div className="lg:col-span-1">
            <div className="sticky" style={{ top: '120px' }}>
              {agent && (
                <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: '1px solid rgba(215,219,227,.4)' }}>
                  <AgentCard agent={agent} />
                  {coListingAgents.map((coAgent, i) => <AgentCard key={i} agent={coAgent} isCoListing />)}
                  <button onClick={() => setContactModalOpen(true)} className="w-full mt-6 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-lg">
                    Contact {coListingAgents.length > 0 ? `${agent.name?.split(' ')[0]} & ${coListingAgents[0]?.name?.split(' ')[0]}` : agent.name}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Neighbourhood Profile */}
      {neighbourhood?.presentation_config && <NeighbourhoodProfile neighbourhood={neighbourhood} openLightbox={openNeighbourhoodLightbox} />}

      {/* Lightbox */}
      {lightboxOpen && <Lightbox images={images} index={lightboxIndex} setIndex={setLightboxIndex} onClose={() => setLightboxOpen(false)} />}
      {neighbourhoodLightboxOpen && <Lightbox images={neighbourhoodLightboxImages} index={neighbourhoodLightboxIndex} setIndex={setNeighbourhoodLightboxIndex} onClose={() => setNeighbourhoodLightboxOpen(false)} />}

      {/* Tour Modal */}
      {tourModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto" style={{ maxWidth: '38rem' }}>
            <div className="sticky top-0 bg-white p-6 rounded-t-2xl flex items-center justify-between border-b"><h2 className="text-2xl font-bold">Schedule Tour</h2><button onClick={() => setTourModalOpen(false)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><Icons.X /></button></div>
            <form className="p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Tour requested!'); setTourModalOpen(false); }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Select Date</label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {generateDates().map((date, i) => (
                    <button key={i} type="button" onClick={() => setSelectedDate(date)} className={`flex flex-col items-center py-4 px-6 rounded-xl transition-all flex-shrink-0 ${selectedDate?.toDateString() === date.toDateString() ? 'bg-black text-white shadow-lg' : 'bg-white hover:bg-gray-50 border border-gray-200'}`} style={{ minWidth: '90px' }}>
                      <span className={`text-sm font-medium mb-2 ${selectedDate?.toDateString() === date.toDateString() ? 'text-white' : 'text-gray-600'}`}>{date.toLocaleString('default', { weekday: 'short' })}</span>
                      <span className={`text-2xl font-bold mb-1 ${selectedDate?.toDateString() === date.toDateString() ? 'text-white' : 'text-gray-900'}`}>{date.getDate()}</span>
                      <span className={`text-xs font-medium ${selectedDate?.toDateString() === date.toDateString() ? 'text-white/80' : 'text-gray-500'}`}>{date.toLocaleString('default', { month: 'short' })}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tour Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" onClick={() => setFormData({ ...formData, tourType: 'video' })} className={`px-6 py-4 rounded-lg font-medium transition-colors ${formData.tourType === 'video' ? 'bg-black text-white' : 'hover:bg-gray-50 border border-gray-200'}`}>Video Tour</button>
                  <button type="button" onClick={() => setFormData({ ...formData, tourType: 'live' })} className={`px-6 py-4 rounded-lg font-medium transition-colors ${formData.tourType === 'live' ? 'bg-black text-white' : 'hover:bg-gray-50 border border-gray-200'}`}>In-Person Tour</button>
                </div>
              </div>
              <input type="text" placeholder="Your name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black" />
              <input type="email" placeholder="Email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black" />
              <input type="tel" placeholder="Phone" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black" />
              <button type="submit" className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-4 rounded-lg">Request Tour</button>
            </form>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {contactModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto" style={{ maxWidth: '38rem' }}>
            <div className="sticky top-0 bg-white p-6 rounded-t-2xl flex items-center justify-between border-b"><h2 className="text-2xl font-bold">Contact {coListingAgents.length > 0 ? `${agent?.name?.split(' ')[0]} & ${coListingAgents[0]?.name?.split(' ')[0]}` : agent?.name}</h2><button onClick={() => setContactModalOpen(false)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><Icons.X /></button></div>
            <form className="p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Message sent!'); setContactModalOpen(false); }}>
              {coListingAgents.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Contact Agent</label>
                  <div className="space-y-3">
                    <button type="button" onClick={() => setFormData({ ...formData, selectedAgent: 'primary' })} className={`w-full p-4 rounded-lg text-left transition-colors flex items-center gap-3 ${formData.selectedAgent === 'primary' ? 'bg-gray-900 text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      {agent.profile_image ? <img src={agent.profile_image} alt={agent.name} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center"><span className="text-gray-600 font-semibold">{agent.name?.charAt(0)}</span></div>}
                      <div><div className="font-semibold">{agent.name}</div><div className="text-sm opacity-80">{agent.email}</div></div>
                    </button>
                    {coListingAgents.map((coAgent) => (
                      <button key={coAgent.id} type="button" onClick={() => setFormData({ ...formData, selectedAgent: coAgent.id })} className={`w-full p-4 rounded-lg text-left transition-colors flex items-center gap-3 ${formData.selectedAgent === coAgent.id ? 'bg-gray-900 text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        {coAgent.profile_image ? <img src={coAgent.profile_image} alt={coAgent.name} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center"><span className="text-gray-600 font-semibold">{coAgent.name?.charAt(0)}</span></div>}
                        <div><div className="font-semibold">{coAgent.name}</div><div className="text-sm opacity-80">{coAgent.email}</div></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input type="text" placeholder="Your name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black" />
              <input type="email" placeholder="Email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black" />
              <input type="tel" placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black" />
              <textarea placeholder={`I'm interested in ${property.address}...`} required value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={4} className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black" />
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-900 mb-2">{coListingAgents.length > 0 ? 'Selected Agent Contact' : 'Contact Information'}</p>
                {(() => { const sel = formData.selectedAgent === 'primary' ? agent : coListingAgents.find(a => a.id === formData.selectedAgent) || agent; return sel && (<><a href={`mailto:${sel.email}`} className="text-sm text-gray-600 flex items-center gap-2 hover:underline"><Icons.Mail />{sel.email}</a>{sel.phone_number && <a href={`tel:${sel.phone_number}`} className="text-sm text-gray-600 flex items-center gap-2 mt-1 hover:underline"><Icons.Phone />{sel.phone_number}</a>}</>); })()}
              </div>
              <button type="submit" className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-4 rounded-lg">Send message</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Components
const DetailRow = ({ label, value }: { label: string; value: any }) => (<div className="flex justify-between"><span className="text-gray-600">{label}</span><span className="font-medium text-gray-900 text-right">{value}</span></div>);

const AgentCard = ({ agent, isCoListing }: { agent: any; isCoListing?: boolean }) => (
  <div className={`flex items-start gap-4 ${isCoListing ? 'pt-4 mt-4 border-t' : ''}`}>
    {agent.profile_image ? <img src={agent.profile_image} alt={agent.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" /> : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><span className="text-gray-500 text-xl font-semibold">{agent.name?.charAt(0)}</span></div>}
    <div className="flex-1"><h3 className="font-bold text-xl text-gray-900 mb-1">{agent.name}</h3>{agent.email && <a href={`mailto:${agent.email}`} className="text-sm text-gray-500 hover:underline block">{agent.email}</a>}{agent.phone_number && <a href={`tel:${agent.phone_number}`} className="text-sm text-gray-500 hover:underline block">{agent.phone_number}</a>}</div>
  </div>
);

const Lightbox = ({ images, index, setIndex, onClose }: { images: any[]; index: number; setIndex: (i: number) => void; onClose: () => void }) => (
  <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
    <button onClick={onClose} className="absolute top-4 right-4 text-gray-900 hover:text-gray-600 z-10 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><Icons.X /></button>
    <button onClick={() => setIndex((index - 1 + images.length) % images.length)} className="absolute left-4 text-gray-900 hover:text-gray-600 p-2 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"><Icons.ChevronLeft /></button>
    <img src={images[index]?.url} alt="" className="max-h-[85vh] max-w-[85vw] object-contain rounded-2xl" style={{ borderRadius: '15px' }} />
    <button onClick={() => setIndex((index + 1) % images.length)} className="absolute right-4 text-gray-900 hover:text-gray-600 p-2 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"><Icons.ChevronRight /></button>
    <div className="absolute bottom-6 text-gray-900 bg-gray-100 px-4 py-2 rounded-full font-medium">{index + 1} / {images.length}</div>
  </div>
);

const NeighbourhoodProfile = ({ neighbourhood, openLightbox }: { neighbourhood: any; openLightbox: (imgs: any[], idx: number) => void }) => {
  const config = neighbourhood.presentation_config;
  if (!config) return null;
  const gallerySizes = ['col-span-3 row-span-2', 'col-span-3 row-span-1', 'col-span-3 row-span-1', 'col-span-4 row-span-2', 'col-span-2 row-span-1', 'col-span-2 row-span-1'];
  const renderGallery = (images: any[], section: string) => images?.length > 0 && (
    <div className="grid grid-cols-6 gap-2 flex-1">
      {images.slice(0, 6).map((img: any, i: number) => {
        const remaining = images.length - 6;
        return (
          <button key={i} onClick={() => openLightbox(images, i)} className={`${gallerySizes[i]} overflow-hidden rounded-lg cursor-pointer relative group`}>
            <img src={typeof img === 'string' ? img : img.url} alt={`${section} ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            {i === 5 && remaining > 0 && <div className="absolute bottom-2 right-2 bg-white bg-opacity-90 px-3 py-1 rounded-full"><span className="text-gray-900 text-lg font-semibold">+{remaining}</span></div>}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Hero Banner */}
      {config.heroBanner && (
        <section className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="relative min-h-[500px] bg-cover bg-center rounded-2xl overflow-hidden" style={{ backgroundImage: `url(${config.heroBanner.heroImage})` }}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative p-8 lg:p-16 text-white max-w-2xl" style={{ paddingTop: '7rem' }}>
              {config.heroBanner.introText && <p className="text-xl mb-4">{config.heroBanner.introText}</p>}
              <h2 className="text-4xl lg:text-5xl font-bold mb-4">{config.heroBanner.headline}</h2>
              {config.heroBanner.subHeadline && <h3 className="text-xl lg:text-2xl mb-4">{config.heroBanner.subHeadline}</h3>}
              {config.heroBanner.shortIntro && <p className="text-lg mb-8">{config.heroBanner.shortIntro}</p>}
              <button onClick={() => document.getElementById('neighbourhood-intro')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-full font-medium hover:bg-gray-100 transition-colors">Learn More <Icons.ArrowUpRight /></button>
            </div>
          </div>
        </section>
      )}

      {/* Intro Section */}
      {config.neighbourhoodIntro && (
        <section id="neighbourhood-intro" className="max-w-[1200px] mx-auto px-8 pt-4 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              {config.neighbourhoodIntro.headline && <h2 className="text-[2.5rem] leading-[1.15] md:text-[3.2rem] md:leading-[1.1] font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: config.neighbourhoodIntro.headline }} />}
              {config.neighbourhoodIntro.videoUrl && <div className="aspect-video rounded-3xl overflow-hidden bg-black"><iframe src={config.neighbourhoodIntro.videoUrl.replace('watch?v=', 'embed/')} className="w-full h-full" allowFullScreen title="Video" /></div>}
            </div>
            <div className="space-y-6">
              {config.neighbourhoodIntro.subHeadline && <h3 className="text-gray-700 font-medium" style={{ fontSize: '1.8rem', lineHeight: '2.2rem' }} dangerouslySetInnerHTML={{ __html: config.neighbourhoodIntro.subHeadline }} />}
              {config.neighbourhoodIntro.textParagraph && <div className="text-gray-600 text-base md:text-[1.3rem] md:leading-[1.95rem] leading-relaxed" dangerouslySetInnerHTML={{ __html: config.neighbourhoodIntro.textParagraph }} />}
              {config.neighbourhoodIntro.images?.length > 0 && <button onClick={() => openLightbox(config.neighbourhoodIntro.images, 0)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-full transition-colors italic text-sm">See neighbourhood photos</button>}
            </div>
          </div>
        </section>
      )}

      {/* On The Map */}
      {config.onTheMap && (
        <section className="max-w-[1200px] mx-auto px-4 py-8">
          {config.onTheMap.subHeadline && <p className="text-xl lg:text-2xl font-medium text-gray-400 mb-2">{config.onTheMap.subHeadline}</p>}
          {config.onTheMap.headline && <h2 className="text-3xl lg:text-4xl font-semibold text-gray-900 mb-8">{config.onTheMap.headline}</h2>}
          <div className="rounded-2xl overflow-hidden bg-gray-100" style={{ height: '600px' }}><iframe src={`/embed?id=${neighbourhood.id}`} className="w-full h-full" title="Map" style={{ border: 'none' }} /></div>
        </section>
      )}

      {/* Get Outside */}
      {config.outside && (
        <section className="max-w-[1200px] mx-auto px-8 pt-8 pb-20">
          {config.outside.categoryHeadline && <p className="text-gray-500 mb-2 text-sm">{config.outside.categoryHeadline}</p>}
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-4">
              {config.outside.headline && <h2 className="text-4xl font-semibold text-gray-900">{config.outside.headline}</h2>}
              {config.outside.subHeadline && <h3 className="text-xl text-gray-700 font-medium">{config.outside.subHeadline}</h3>}
              {config.outside.textParagraph && <p className="text-gray-600 leading-relaxed">{config.outside.textParagraph}</p>}
            </div>
            {renderGallery(config.outside.images, 'Outside')}
          </div>
        </section>
      )}

      {/* Amenities */}
      {config.amenities && (
        <section className="max-w-[1200px] mx-auto px-8 pt-8 pb-20">
          <div className="flex flex-col-reverse lg:flex-row gap-12 items-start">
            {renderGallery(config.amenities.images, 'Amenity')}
            <div className="space-y-4 flex-1">
              {config.amenities.categoryHeadline && <p className="text-gray-500 text-sm">{config.amenities.categoryHeadline}</p>}
              {config.amenities.headline && <h2 className="text-4xl font-semibold text-gray-900">{config.amenities.headline}</h2>}
              {config.amenities.subHeadline && <h3 className="text-xl text-gray-700 font-medium">{config.amenities.subHeadline}</h3>}
              {config.amenities.textParagraph && <p className="text-gray-600 leading-relaxed">{config.amenities.textParagraph}</p>}
            </div>
          </div>
        </section>
      )}

      {/* Shop & Dine */}
      {config.shopDine && (
        <section className="max-w-[1200px] mx-auto px-8 pt-8 pb-20">
          {config.shopDine.categoryHeadline && <p className="text-gray-500 mb-2 text-sm">{config.shopDine.categoryHeadline}</p>}
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-4">
              {config.shopDine.headline && <h2 className="text-4xl font-semibold text-gray-900">{config.shopDine.headline}</h2>}
              {config.shopDine.subHeadline && <h3 className="text-xl text-gray-700 font-medium">{config.shopDine.subHeadline}</h3>}
              {config.shopDine.textParagraph && <p className="text-gray-600 leading-relaxed">{config.shopDine.textParagraph}</p>}
            </div>
            {renderGallery(config.shopDine.images, 'Shop & Dine')}
          </div>
        </section>
      )}
    </>
  );
};
