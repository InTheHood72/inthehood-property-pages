import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import PremiumTemplate from './PremiumTemplate';

// Known template names — if the [id] segment is a template name, use ?id= query param
const TEMPLATE_NAMES = new Set([
  'air', 'air-dark', 'air-light',
  'numero', 'numero-dark', 'numero-light',
  'default', 'default-dark', 'default-light',
  'prestige', 'prestige-dark',
  'luxe', 'luxe-dark',
  'haven', 'haven-dark',
  'creative', 'creative-dark',
  'premium', 'premium-dark',
]);

interface PropertyPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ id?: string; mls?: string; agentId?: string }>;
}

export default async function PropertyPage({ params, searchParams }: PropertyPageProps) {
  const { id: pathId } = await params;
  const query = await searchParams;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Determine the actual property ID:
  // If pathId is a template name (e.g. "air"), use the ?id= or ?mls= query param
  // Otherwise, pathId IS the property ID
  const isTemplateName = TEMPLATE_NAMES.has(pathId.toLowerCase());
  const propertyId = isTemplateName ? (query.id || query.mls) : pathId;

  if (!propertyId) {
    return notFound();
  }

  let property = null;
  let agent = null;
  let images: { url: string; is_hero: boolean; caption: string }[] = [];

  // Try featured properties table first (by id or mls_number)
  const { data: featuredProperty } = await supabase
    .from('properties')
    .select('*, property_media(url, is_hero, display_order, caption)')
    .or(`id.eq.${propertyId},mls_number.eq.${propertyId}`)
    .maybeSingle();

  if (featuredProperty) {
    property = featuredProperty;
  } else {
    // Try MLS properties table
    const { data: mlsProperty } = await supabase
      .from('mls_properties')
      .select('*')
      .eq('mls_number', propertyId)
      .maybeSingle();

    if (mlsProperty) {
      property = {
        id: mlsProperty.mls_number,
        title: mlsProperty.address || mlsProperty.unparsed_address,
        address: mlsProperty.address || mlsProperty.unparsed_address,
        city: mlsProperty.city,
        province: mlsProperty.province || mlsProperty.state_or_province || 'Alberta',
        postal_code: mlsProperty.postal_code,
        price: mlsProperty.price || mlsProperty.list_price,
        bedrooms: mlsProperty.bedrooms || mlsProperty.bedrooms_total,
        bathrooms: mlsProperty.bathrooms || mlsProperty.bathroom_total,
        bathrooms_full: mlsProperty.bathrooms_full,
        bathrooms_half: mlsProperty.bathrooms_half,
        sqft: mlsProperty.sqft || mlsProperty.building_area_total || mlsProperty.living_area,
        square_feet: mlsProperty.sqft || mlsProperty.building_area_total || mlsProperty.living_area,
        year_built: mlsProperty.year_built,
        description: mlsProperty.public_remarks || mlsProperty.description,
        lot_size: mlsProperty.lot_size_area,
        mls_number: mlsProperty.mls_number,
        listing_status: mlsProperty.listing_status,
        property_type: mlsProperty.property_type,
      };
    }
  }

  if (!property) {
    return notFound();
  }

  // Fetch agent info
  const agentId = query.agentId || property.user_id;
  if (agentId) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('name, email, phone_number, website, profile_image, logo, logo_light, logo_dark, company_id')
      .eq('id', agentId)
      .maybeSingle();

    if (profileData) {
      let companyData = null;
      if (profileData.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name, logo, logo_light, logo_dark')
          .eq('id', profileData.company_id)
          .maybeSingle();
        companyData = company;
      }
      agent = { ...profileData, company: companyData ?? undefined };
    }
  }

  // Sort and format images
  images = (property.property_media || [])
    .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((m: any) => ({ url: m.url, is_hero: !!m.is_hero, caption: m.caption || '' }));

  // Fallback: Generate MLS images
  if (images.length === 0 && (property.mls_number || propertyId)) {
    const mls = property.mls_number || propertyId;
    images = Array.from({ length: 9 }, (_, i) => ({
      url: `https://mlsmedia.inthehood.io/property-images/${mls}/full/${mls}-${i + 1}.webp`,
      is_hero: i === 0,
      caption: ''
    }));
  }

  return <PremiumTemplate property={property} images={images} agent={agent} />;
}
