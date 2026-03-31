'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Dark Theme Color Palette
const COLORS = {
  base: '#121212',
  surface1: '#1B1B1B',
  surface2: '#222222',
  surface3: '#2A2A2A',
  primaryAccent: '#3B82F6',
  secondaryAccent: '#F59E0B',
  textPrimary: '#F5F5F5',
  textSecondary: '#cccccc',
  textMuted: '#6B7280',
  border: '#333333',
  borderLight: '#404040',
};

// Constants
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

async function fetchBackendUrl(): Promise<string> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/global_settings?select=api_config&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    return data?.[0]?.api_config?.current_backend_url || '';
  } catch { return ''; }
}

// Icons
const Icons = {
  Bed: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v11m0-4h18m0 0V7a2 2 0 00-2-2H5a2 2 0 00-2 2v7m18 0v4M3 18h18M7 14v-2a1 1 0 011-1h2a1 1 0 011 1v2m4 0v-2a1 1 0 011-1h2a1 1 0 011 1v2" /></svg>,
  Bath: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12h16M4 12a2 2 0 01-2-2V6a2 2 0 012-2h1m15 8a2 2 0 002-2V6a2 2 0 00-2-2h-1M4 12v4a2 2 0 002 2h12a2 2 0 002-2v-4M8 18v2m8-2v2" /></svg>,
  Size: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>,
  X: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  ChevronLeft: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  ChevronRight: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  ArrowRight: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
  Mail: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Phone: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Check: () => <svg className="w-4 h-4" style={{ color: '#10B981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  Document: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Book: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
};

interface AirTemplateDarkClientProps {
  propertyIdProp?: string;
  agentIdProp?: string;
}

export default function AirTemplateDarkClient({ propertyIdProp, agentIdProp }: AirTemplateDarkClientProps = {}) {
  const searchParams = useSearchParams();
  // Use prop if provided, otherwise fall back to URL params
  const mlsId = propertyIdProp || searchParams.get('id');
  const agentIdOverride = agentIdProp || searchParams.get('agentId');
  const [property, setProperty] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '', tourType: 'video' });
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [BACKEND_URL, setBackendUrl] = useState('');
  const [backendUrlLoaded, setBackendUrlLoaded] = useState(false);

  useEffect(() => { 
    fetchBackendUrl().then(url => {
      setBackendUrl(url);
      setBackendUrlLoaded(true);
    }); 
  }, []);

  useEffect(() => {
    if (!mlsId || !backendUrlLoaded) return;
    const loadData = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/supabase/properties/${mlsId}`);
        const data = await res.json();
        
        if (data.success && data.data) {
          const p = data.data;
          setProperty({
            id: p.mls_number || p.listing_id, mls_number: p.mls_number || p.listing_id, address: p.address,
            city: p.city, province: p.state || 'Alberta', postal_code: p.postal_code,
            price: parseFloat(p.price) || parseFloat(p.list_price) || 0, bedrooms: parseInt(p.bedrooms) || 0,
            bathrooms_full: parseInt(p.bathrooms_full) || 0, bathrooms_half: parseInt(p.bathrooms_half) || 0,
            sqft: parseInt(p.sqft) || parseInt(p.square_feet) || 0, year_built: p.year_built,
            description: p.description, images: (p.images || []).map((url: string) => ({ url })),
            virtual_tour_url: p.virtual_tour_url || p.virtual_tour, video_tour_url: p.video_url || p.video_tour_url,
            virtual_tour_url_branded: p.virtual_tour_url_branded, virtual_tour_url_unbranded: p.virtual_tour_url_unbranded, virtual_tour_link: p.virtual_tour_link,
            latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude),
            property_type: p.property_type, property_subtype: p.property_sub_type,
            listing_brokerage: p.office_name, subdivision_name: p.subdivision, neighbourhood: p.subdivision,
            parking_total: p.parking_total || p.garage_spaces, garage_spaces: p.garage_spaces,
            lot_size_acres: p.lot_size_acres, appliances: p.appliances, heating: p.heating, cooling: p.cooling,
            flooring: p.flooring, exterior_features: p.exterior_features, community_features: p.community_features,
            basement: p.basement, room_dimensions: p.room_dimensions, url_floorplan: p.url_floorplan,
            url_brochure: p.url_brochure, zone: p.zone, region: p.region, roof_type: p.roof_type,
            foundation_details: p.foundation_details, fireplace_total: p.fireplace_total, zoning: p.zoning,
            association_fee: p.association_fee, association_fee_frequency: p.association_fee_frequency,
            condo_name: p.condo_name, association_amenities: p.association_amenities, office_name: p.office_name,
            open_houses: p.open_houses || [],
          });
          
          if (p.agent_name) {
            setAgent({ name: p.agent_name, phone_number: p.agent_phone, email: p.agent_email, brokerage: p.office_name });
          }
        }
      } catch (e) { console.error('Error loading property:', e); }
      setLoading(false);
    };
    loadData();
  }, [mlsId, BACKEND_URL]);

  useEffect(() => {
    const handleScroll = () => setShowStickyHeader(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Map scroll protection state
  const [mapScrollEnabled, setMapScrollEnabled] = useState(false);
  
  // Map with dark style
  useEffect(() => {
    if (!property?.latitude || !property?.longitude || !mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({ 
      container: mapContainerRef.current, 
      style: 'mapbox://styles/mapbox/dark-v11', 
      center: [property.longitude, property.latitude], 
      zoom: 14,
      scrollZoom: false // Disable scroll zoom by default
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    
    map.on('load', () => {
      const markerEl = document.createElement('div');
      markerEl.innerHTML = `<div style="width:40px;height:40px;background:${COLORS.primaryAccent};border-radius:50%;border:3px solid ${COLORS.surface1};box-shadow:0 4px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><svg fill="none" stroke="${COLORS.textPrimary}" viewBox="0 0 24 24" stroke-width="2" style="width:20px;height:20px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></div>`;
      new mapboxgl.Marker({ element: markerEl, anchor: 'bottom' }).setLngLat([property.longitude, property.latitude]).addTo(map);
    });
    
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [property]);

  // Enable map scroll on click
  const enableMapScroll = () => {
    if (mapRef.current) {
      mapRef.current.scrollZoom.enable();
      setMapScrollEnabled(true);
    }
  };

  const images = property?.images || [];
  const formatPrice = (p: number) => p ? `C$${p.toLocaleString()}` : 'Price TBD';
  const getBaths = () => (property?.bathrooms_full || 0) + (property?.bathrooms_half || 0) * 0.5;
  const getDetailedBaths = () => {
    const full = property?.bathrooms_full || 0, half = property?.bathrooms_half || 0;
    if (full && half) return `${full} full, ${half} half`;
    if (full) return `${full} full`;
    return 0;
  };
  
  const generateDates = () => {
    const dates = [];
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 10; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.base }}><div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: COLORS.primaryAccent }} /></div>;
  if (!property) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.base }}><h1 className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>Property not found</h1></div>;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap');
        .dark-air-template, .dark-air-template * { font-family: 'Jost', sans-serif !important; }
        .dark-air-template h3.section-heading { font-size: 1.4rem !important; margin-top: 30px !important; font-weight: 700 !important; }
      `}</style>
      <div className="min-h-screen dark-air-template" style={{ backgroundColor: COLORS.base }}>

      {/* Sticky Header */}
      <div className={`fixed top-0 left-0 right-0 shadow-lg z-50 transition-transform duration-300 ${showStickyHeader ? 'translate-y-0' : '-translate-y-full'}`} style={{ backgroundColor: COLORS.surface1, borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div><h2 className="font-bold text-lg" style={{ color: COLORS.textPrimary }}>{property.address}</h2><p className="text-sm" style={{ color: '#cccccc' }}>{property.neighbourhood ? `${property.neighbourhood}, ` : ''}{property.city}, {property.province}</p></div>
          <div className="hidden lg:flex items-center gap-6">
            {property.mls_number && <div className="text-center"><div className="font-semibold" style={{ color: COLORS.textPrimary }}>{property.mls_number}</div><div className="text-xs" style={{ color: COLORS.textMuted }}>MLS#</div></div>}
            {property.bedrooms > 0 && <div className="text-center"><div className="font-semibold" style={{ color: COLORS.textPrimary }}>{property.bedrooms}</div><div className="text-xs" style={{ color: COLORS.textMuted }}>Beds</div></div>}
            {getBaths() > 0 && <div className="text-center"><div className="font-semibold" style={{ color: COLORS.textPrimary }}>{getBaths()}</div><div className="text-xs" style={{ color: COLORS.textMuted }}>Baths</div></div>}
            {property.sqft > 0 && <div className="text-center"><div className="font-semibold" style={{ color: COLORS.textPrimary }}>{property.sqft.toLocaleString()}</div><div className="text-xs" style={{ color: COLORS.textMuted }}>Sqft</div></div>}
          </div>
          <div className="hidden md:block"><div className="text-xs" style={{ color: '#cccccc' }}>Price</div><div className="font-bold text-lg" style={{ color: COLORS.textPrimary }}>{formatPrice(property.price)}</div></div>
          <button onClick={() => setTourModalOpen(true)} className="px-6 py-2 rounded-lg font-medium" style={{ backgroundColor: COLORS.primaryAccent, color: COLORS.textPrimary }}>Request Tour</button>
        </div>
      </div>

      {/* Property Header */}
      <section className="max-w-[1200px] mx-auto px-4 pt-28 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm" style={{ color: '#cccccc' }}>{property.neighbourhood ? `${property.neighbourhood}, ` : ''}{property.city}, {property.province} {property.postal_code}</p>
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight" style={{ color: COLORS.textPrimary }}>{property.address}</h1>
            <div className="flex flex-wrap items-center gap-6 pt-2" style={{ color: '#cccccc' }}>
              {property.mls_number && <div className="flex items-center gap-2"><span>MLS #</span><span className="font-semibold" style={{ color: COLORS.textPrimary }}>{property.mls_number}</span></div>}
              {property.bedrooms > 0 && <div className="flex items-center gap-2"><Icons.Bed /><span className="font-semibold" style={{ color: COLORS.textPrimary }}>{property.bedrooms}</span><span>Beds</span></div>}
              {getBaths() > 0 && <div className="flex items-center gap-2"><Icons.Bath /><span className="font-semibold" style={{ color: COLORS.textPrimary }}>{getBaths()}</span><span>Baths</span></div>}
              {property.sqft > 0 && <div className="flex items-center gap-2"><Icons.Size /><span className="font-semibold" style={{ color: COLORS.textPrimary }}>{property.sqft.toLocaleString()}</span><span>Sqft</span></div>}
            </div>
          </div>
          <div className="text-left lg:text-right">
            <p className="text-sm" style={{ color: '#cccccc' }}>List Price</p>
            <p className="text-3xl lg:text-4xl font-bold" style={{ color: COLORS.textPrimary }}>{formatPrice(property.price)}</p>
            {property.property_subtype && <span className="inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: COLORS.surface2, color: '#cccccc' }}>{property.property_subtype}</span>}
          </div>
        </div>
      </section>

      {/* Hero Gallery - Fluid based on image count */}
      <section className="max-w-[1200px] mx-auto px-4">
        {/* Desktop: Fluid grid based on image count */}
        <div className="hidden md:block rounded-2xl overflow-hidden" style={{ height: '500px' }}>
          {/* 1 image: Full width and height */}
          {images.length === 1 && (
            <div className="h-full cursor-pointer relative group" onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}>
              <img src={images[0].url} alt="Main" className="w-full h-full object-cover object-center" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
          )}
          
          {/* 2 images: 50/50 horizontal split, full height */}
          {images.length === 2 && (
            <div className="grid grid-cols-2 gap-2 h-full">
              {images.map((img: any, i: number) => (
                <div key={i} className="cursor-pointer relative group h-full" onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}>
                  <img src={img.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover object-center" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              ))}
            </div>
          )}
          
          {/* 3 images: 2/3 large left (full height) + 1/3 right column with 2 stacked images */}
          {images.length === 3 && (
            <div className="grid grid-cols-3 gap-2 h-full">
              <div className="col-span-2 cursor-pointer relative group h-full" onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}>
                <img src={images[0].url} alt="Main" className="w-full h-full object-cover object-center" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
              <div className="grid grid-rows-2 gap-2 h-full">
                {images.slice(1, 3).map((img: any, i: number) => (
                  <div key={i} className="cursor-pointer relative group h-full" onClick={() => { setLightboxIndex(i + 1); setLightboxOpen(true); }}>
                    <img src={img.url} alt={`Photo ${i + 2}`} className="w-full h-full object-cover object-center" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 4 images: 2/3 large left + 1/3 right column with 3 stacked images */}
          {images.length === 4 && (
            <div className="grid grid-cols-3 gap-2 h-full">
              <div className="col-span-2 cursor-pointer relative group h-full" onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}>
                <img src={images[0].url} alt="Main" className="w-full h-full object-cover object-center" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
              <div className="grid grid-rows-3 gap-2 h-full">
                {images.slice(1, 4).map((img: any, i: number) => (
                  <div key={i} className="cursor-pointer relative group h-full" onClick={() => { setLightboxIndex(i + 1); setLightboxOpen(true); }}>
                    <img src={img.url} alt={`Photo ${i + 2}`} className="w-full h-full object-cover object-center" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 5+ images: Standard grid (1 large left + 4 smaller right in 2x2 grid) */}
          {images.length >= 5 && (
            <div className="grid grid-cols-4 gap-2 h-full">
              <div className="col-span-2 row-span-2 cursor-pointer relative group" onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}>
                <img src={images[0].url} alt="Main" className="w-full h-full object-cover object-center" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
              {images.slice(1, 5).map((img: any, i: number) => (
                <div key={i} className="cursor-pointer relative group" onClick={() => { setLightboxIndex(i + 1); setLightboxOpen(true); }}>
                  <img src={img.url} alt={`Photo ${i + 2}`} className="w-full h-full object-cover object-center" />
                  {i === 3 && images.length > 5 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <button className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2" style={{ backgroundColor: COLORS.surface1, color: COLORS.textPrimary }}>
                        See all images <Icons.ArrowRight />
                      </button>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Mobile */}
        <div className="md:hidden">{images[0] && <div className="relative rounded-2xl overflow-hidden cursor-pointer" onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}><img src={images[0].url} alt="Main" className="w-full aspect-[4/3] object-cover" />{images.length > 1 && <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: COLORS.textPrimary }}>1 of {images.length}</div>}</div>}</div>
      </section>

      {/* Main Content */}
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Open House Banner - Above Description */}
            {property.open_houses && property.open_houses.length > 0 && (() => {
              // Filter for upcoming open houses only
              const now = new Date();
              const parseLocalDate = (d: string) => { const [y,m,dd] = (d||'').split('T')[0].split('-').map(Number); return new Date(y, m-1, dd); };
              const upcomingOpenHouses = property.open_houses.filter((oh: any) => {
                const ohDate = parseLocalDate(oh.open_house_date || oh.openHouseDate);
                return ohDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
              }).sort((a: any, b: any) => {
                return parseLocalDate(a.open_house_date || a.openHouseDate).getTime() - parseLocalDate(b.open_house_date || b.openHouseDate).getTime();
              });
              
              if (upcomingOpenHouses.length === 0) return null;
              
              const formatOpenHouseDate = (dateStr: string) => {
                const [y,m,d] = (dateStr||'').split('T')[0].split('-').map(Number);
                return new Date(y, m-1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              };
              
              const formatOpenHouseTime = (startStr: string, endStr: string) => {
                const formatTime = (str: string) => {
                  if (!str) return '';
                  const raw = str.includes('T') ? str.split('T')[1] : str;
                  const [h, min] = raw.split(':').map(Number);
                  return `${h % 12 || 12}:${(min||0).toString().padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
                };
                const start = formatTime(startStr);
                const end = formatTime(endStr);
                return start && end ? `${start} - ${end}` : start || end || '';
              };
              
              return (
                <div className="rounded-xl p-4 shadow-lg mb-6" style={{ backgroundColor: '#DC2626' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-bold text-lg text-white">Open House{upcomingOpenHouses.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {upcomingOpenHouses.slice(0, 3).map((oh: any, idx: number) => (
                      <div key={idx} className="flex flex-wrap items-center gap-x-3 text-sm text-white">
                        <span className="font-semibold">
                          {formatOpenHouseDate(oh.open_house_date || oh.openHouseDate)}
                        </span>
                        <span className="opacity-90">
                          {formatOpenHouseTime(oh.open_house_start_time || oh.openHouseStartTime, oh.open_house_end_time || oh.openHouseEndTime)}
                        </span>
                      </div>
                    ))}
                    {upcomingOpenHouses.length > 3 && (
                      <div className="text-sm text-white opacity-80">+{upcomingOpenHouses.length - 3} more open house{upcomingOpenHouses.length - 3 > 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>
              );
            })()}
            
            {/* Description */}
            {property.description && (
              <section>
                <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.textPrimary }}>Description</h2>
                <p className="leading-relaxed whitespace-pre-line" style={{ color: '#cccccc' }}>{property.description}</p>
              </section>
            )}

            {/* Smart Media Detection - Video Tour & Virtual Tour */}
            {(() => {
              const allUrls = [property.virtual_tour_url, property.video_tour_url, property.virtual_tour_url_branded, property.virtual_tour_url_unbranded, property.virtual_tour_link].filter(Boolean);
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
                    <section className="pt-8" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.textPrimary }}>Video Tour</h2>
                      <div className="aspect-video rounded-2xl overflow-hidden" style={{ backgroundColor: COLORS.surface1 }}><iframe src={getYouTubeEmbed(videoUrl)} className="w-full h-full" allowFullScreen title="Video Tour" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" /></div>
                    </section>
                  )}
                  {virtualUrl && (
                    <section className="pt-8" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.textPrimary }}>Virtual Tour</h2>
                      <div className="aspect-video rounded-2xl overflow-hidden" style={{ backgroundColor: COLORS.surface1 }}><iframe src={virtualUrl} className="w-full h-full" allowFullScreen title="Virtual Tour" /></div>
                    </section>
                  )}
                </>
              );
            })()}

            {/* Location Map */}
            {property.latitude && property.longitude && (
              <section className="pt-8" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.textPrimary }}>Location</h2>
                <div className="relative">
                  <div ref={mapContainerRef} className="w-full h-[400px] rounded-2xl overflow-hidden" />
                  {!mapScrollEnabled && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center cursor-pointer rounded-2xl"
                      onClick={enableMapScroll}
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      <div className="px-4 py-2 rounded-full shadow-lg text-sm font-medium" style={{ backgroundColor: COLORS.surface1, color: COLORS.textPrimary }}>
                        Click to enable map interaction
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Property Features & Details */}
            <section className="pt-8" style={{ borderTop: `1px solid ${COLORS.border}` }}>
              <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.textPrimary }}>Property Features & Details</h2>
              <div className="rounded-lg p-6 space-y-8" style={{ backgroundColor: COLORS.surface1, border: `1px solid ${COLORS.border}` }}>
                
                {/* Basic Info */}
                <div>
                  <h3 className="section-heading font-bold pb-2" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>Basic Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm pt-4">
                    {property.city && <DetailRow label="City" value={property.city} />}
                    {property.neighbourhood && <DetailRow label="Neighbourhood" value={property.neighbourhood} />}
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
                    {property.mls_number && <DetailRow label="MLS#" value={property.mls_number} />}
                    {property.listing_brokerage && <DetailRow label="Listing Brokerage" value={property.listing_brokerage} />}
                  </div>
                </div>

                {/* Heating & Cooling */}
                {(property.heating || property.cooling) && (
                  <div>
                    <h3 className="section-heading font-bold pb-2" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>Heating & Cooling</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm pt-4">
                      {property.heating && <DetailRow label="Heating" value={Array.isArray(property.heating) ? property.heating.join(', ') : property.heating} />}
                      {property.cooling && <DetailRow label="Cooling" value={Array.isArray(property.cooling) ? property.cooling.join(', ') : property.cooling} />}
                    </div>
                  </div>
                )}

                {/* Condo/HOA */}
                {(property.association_fee || property.condo_name) && (
                  <div>
                    <h3 className="section-heading font-bold pb-2" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>Condo/HOA Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm pt-4">
                      {property.association_fee && parseFloat(property.association_fee) > 0 && <DetailRow label="HOA/Condo Fee" value={`$${parseFloat(property.association_fee).toLocaleString()}${property.association_fee_frequency ? `/${property.association_fee_frequency}` : '/month'}`} />}
                      {property.condo_name && property.condo_name !== 'Z-name Not Listed' && <DetailRow label="Condo Name" value={property.condo_name} />}
                      {property.association_amenities && <DetailRow label="Association Amenities" value={property.association_amenities} />}
                    </div>
                  </div>
                )}

                {/* Appliances */}
                {property.appliances && Array.isArray(property.appliances) && property.appliances.length > 0 && (
                  <div>
                    <h3 className="section-heading font-bold pb-2" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>Appliances & Amenities</h3>
                    <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 text-sm pt-4" style={{ color: '#cccccc' }}>
                      {property.appliances.map((item: string, i: number) => <div key={i} className="flex items-center gap-2"><Icons.Check /><span>{item.replace(/_/g, ' ')}</span></div>)}
                    </div>
                  </div>
                )}

                {/* Exterior Features */}
                {property.exterior_features && Array.isArray(property.exterior_features) && property.exterior_features.length > 0 && (
                  <div>
                    <h3 className="section-heading font-bold pb-2" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>Exterior Features</h3>
                    <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 text-sm pt-4" style={{ color: '#cccccc' }}>
                      {property.exterior_features.map((item: string, i: number) => <div key={i} className="flex items-center gap-2"><Icons.Check /><span>{item}</span></div>)}
                    </div>
                  </div>
                )}

                {/* Flooring */}
                {property.flooring && Array.isArray(property.flooring) && property.flooring.length > 0 && (
                  <div>
                    <h3 className="section-heading font-bold pb-2" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>Flooring</h3>
                    <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 text-sm pt-4" style={{ color: '#cccccc' }}>
                      {property.flooring.map((item: string, i: number) => <div key={i} className="flex items-center gap-2"><Icons.Check /><span>{item}</span></div>)}
                    </div>
                  </div>
                )}

                {/* Community Features */}
                {property.community_features && Array.isArray(property.community_features) && property.community_features.length > 0 && (
                  <div>
                    <h3 className="section-heading font-bold pb-2" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>Community Features</h3>
                    <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 text-sm pt-4" style={{ color: '#cccccc' }}>
                      {property.community_features.map((item: string, i: number) => <div key={i} className="flex items-center gap-2"><Icons.Check /><span>{item}</span></div>)}
                    </div>
                  </div>
                )}

                {/* Building Details */}
                {(property.roof_type || property.foundation_details || property.fireplace_total || property.zoning) && (
                  <div>
                    <h3 className="section-heading font-bold pb-2" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>Building Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm pt-4">
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
                          <h3 className="section-heading font-bold pb-2" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>Room Dimensions</h3>
                          <div className="overflow-x-auto pt-4">
                            <table className="w-full text-sm">
                              <thead style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.surface2 }}><tr><th className="text-left p-3 font-semibold" style={{ color: '#cccccc' }}>Room Type</th><th className="text-left p-3 font-semibold" style={{ color: '#cccccc' }}>Level</th><th className="text-right p-3 font-semibold" style={{ color: '#cccccc' }}>Dimensions</th></tr></thead>
                              <tbody>
                                {rooms.filter((r: any) => (r.dimensions || r.RoomDimensions)?.trim()).map((r: any, i: number) => (
                                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                                    <td className="p-3" style={{ color: COLORS.textPrimary }}>{r.type || r.RoomType || '-'}</td>
                                    <td className="p-3" style={{ color: '#cccccc' }}>{r.level || r.RoomLevel || '-'}</td>
                                    <td className="p-3 text-right" style={{ color: COLORS.textPrimary }}>{r.dimensions || r.RoomDimensions || ''}</td>
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
                    <h3 className="section-heading font-bold pb-2" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>Property Documents</h3>
                    <div className="flex flex-wrap gap-3 pt-4">
                      {property.url_floorplan && (
                        <a href={property.url_floorplan} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-3 rounded-lg transition-colors" style={{ backgroundColor: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}>
                          <Icons.Document /><div className="text-left"><div className="text-sm font-semibold">Floor Plan</div><div className="text-xs" style={{ color: '#cccccc' }}>View PDF</div></div>
                        </a>
                      )}
                      {property.url_brochure && (
                        <a href={property.url_brochure} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-3 rounded-lg transition-colors" style={{ backgroundColor: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}>
                          <Icons.Book /><div className="text-left"><div className="text-sm font-semibold">Property Brochure</div><div className="text-xs" style={{ color: '#cccccc' }}>View PDF</div></div>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Sidebar - Agent Card */}
          <div className="space-y-6">
            <div className="rounded-2xl p-6 sticky top-24" style={{ backgroundColor: COLORS.surface1, border: `1px solid ${COLORS.border}` }}>
              {agent && <AgentCard agent={agent} />}
              <button onClick={() => setTourModalOpen(true)} className="w-full mt-6 py-4 rounded-lg font-semibold" style={{ backgroundColor: COLORS.primaryAccent, color: COLORS.textPrimary }}>
                Contact {agent?.name?.split(' ')[0] || 'Agent'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && <Lightbox images={images} index={lightboxIndex} setIndex={setLightboxIndex} onClose={() => setLightboxOpen(false)} />}

      {/* Tour Modal - Numero Style Dark */}
      {tourModalOpen && (
        <>
          <div className="fixed inset-0 z-[10000]" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setTourModalOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[450px] max-h-[90vh] rounded-[20px] z-[10001] overflow-y-auto" style={{ backgroundColor: COLORS.surface1, boxShadow: '0 20px 30px -8px rgba(0,0,0,0.4)' }}>
            <div className="p-[30px]">
              <button onClick={() => setTourModalOpen(false)} className="absolute top-[15px] right-[15px] w-10 h-10 border-none rounded-full cursor-pointer flex items-center justify-center text-xl transition-colors" style={{ backgroundColor: COLORS.surface2, color: COLORS.textPrimary }}>✕</button>
              <h2 className="text-2xl font-semibold mb-5" style={{ color: COLORS.textPrimary }}>Schedule a Tour</h2>
              <form onSubmit={(e) => { e.preventDefault(); alert('Tour requested!'); setTourModalOpen(false); }}>
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2" style={{ color: '#cccccc' }}>Select Date</label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {generateDates().map((date, i) => {
                      const isSelected = selectedDate?.toDateString() === date.toDateString();
                      return (
                        <button key={i} type="button" onClick={() => setSelectedDate(date)} className="flex flex-col items-center p-4 rounded-xl cursor-pointer min-w-[80px] flex-shrink-0 transition-all" style={{ backgroundColor: isSelected ? COLORS.primaryAccent : COLORS.surface2, border: isSelected ? 'none' : `1px solid ${COLORS.border}` }}>
                          <span className="text-sm font-medium" style={{ color: isSelected ? '#fff' : '#cccccc' }}>{date.toLocaleString('default', { weekday: 'short' })}</span>
                          <span className="text-2xl font-bold leading-tight" style={{ color: isSelected ? '#fff' : COLORS.textPrimary }}>{date.getDate()}</span>
                          <span className="text-xs" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : COLORS.textMuted }}>{date.toLocaleString('default', { month: 'short' })}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2" style={{ color: '#cccccc' }}>Tour Type</label>
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setFormData({ ...formData, tourType: 'video' })} className="flex-1 p-4 rounded-lg font-medium transition-all" style={{ backgroundColor: formData.tourType === 'video' ? COLORS.primaryAccent : COLORS.surface2, color: formData.tourType === 'video' ? '#fff' : COLORS.textPrimary, border: formData.tourType === 'video' ? 'none' : `1px solid ${COLORS.border}` }}>Video Tour</button>
                    <button type="button" onClick={() => setFormData({ ...formData, tourType: 'live' })} className="flex-1 p-4 rounded-lg font-medium transition-all" style={{ backgroundColor: formData.tourType === 'live' ? COLORS.primaryAccent : COLORS.surface2, color: formData.tourType === 'live' ? '#fff' : COLORS.textPrimary, border: formData.tourType === 'live' ? 'none' : `1px solid ${COLORS.border}` }}>In-Person Tour</button>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2" style={{ color: '#cccccc' }}>Name</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Your name" className="w-full text-base" style={{ padding: '0.75rem 1rem', backgroundColor: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', color: COLORS.textPrimary, boxSizing: 'border-box' }} />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2" style={{ color: '#cccccc' }}>Email</label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="your@email.com" className="w-full text-base" style={{ padding: '0.75rem 1rem', backgroundColor: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', color: COLORS.textPrimary, boxSizing: 'border-box' }} />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2" style={{ color: '#cccccc' }}>Phone</label>
                  <input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(555) 123-4567" className="w-full text-base" style={{ padding: '0.75rem 1rem', backgroundColor: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', color: COLORS.textPrimary, boxSizing: 'border-box' }} />
                </div>
                <button type="submit" className="w-full p-4 border-none rounded-lg font-medium text-base cursor-pointer transition-colors" style={{ backgroundColor: COLORS.primaryAccent, color: '#fff' }}>Request Tour</button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}

// Components
const DetailRow = ({ label, value }: { label: string; value: any }) => (
  <div className="flex justify-between"><span style={{ color: '#cccccc' }}>{label}</span><span className="font-medium text-right" style={{ color: COLORS.textPrimary }}>{value}</span></div>
);

const AgentCard = ({ agent }: { agent: any }) => (
  <div className="flex items-start gap-4">
    {agent.profile_image ? <img src={agent.profile_image} alt={agent.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" /> : <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLORS.surface2 }}><span className="text-xl font-semibold" style={{ color: '#cccccc' }}>{agent.name?.charAt(0)}</span></div>}
    <div className="flex-1"><h3 className="font-bold text-xl mb-1" style={{ color: COLORS.textPrimary }}>{agent.name}</h3>{agent.email && <a href={`mailto:${agent.email}`} className="text-sm hover:underline block" style={{ color: '#cccccc' }}>{agent.email}</a>}{agent.phone_number && <a href={`tel:${agent.phone_number}`} className="text-sm hover:underline block" style={{ color: '#cccccc' }}>{agent.phone_number}</a>}</div>
  </div>
);

const Lightbox = ({ images, index, setIndex, onClose }: { images: any[]; index: number; setIndex: (i: number) => void; onClose: () => void }) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((index - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setIndex((index + 1) % images.length);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, images.length, setIndex, onClose]);

  const currentUrl = images[index]?.url;
  if (!currentUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: COLORS.base }} tabIndex={0}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surface2, color: COLORS.textPrimary }}><Icons.X /></button>
      <button onClick={() => setIndex((index - 1 + images.length) % images.length)} className="absolute left-4 p-2 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surface2, color: COLORS.textPrimary }}><Icons.ChevronLeft /></button>
      <img src={currentUrl} alt="" className="max-h-[85vh] max-w-[85vw] object-contain rounded-2xl" />
      <button onClick={() => setIndex((index + 1) % images.length)} className="absolute right-4 p-2 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surface2, color: COLORS.textPrimary }}><Icons.ChevronRight /></button>
      <div className="absolute bottom-6 px-4 py-2 rounded-full font-medium" style={{ backgroundColor: COLORS.surface2, color: COLORS.textPrimary }}>{index + 1} / {images.length}</div>
    </div>
  );
};
