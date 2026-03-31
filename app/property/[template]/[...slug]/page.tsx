import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import PremiumTemplate from '../../[id]/PremiumTemplate';
import type { Metadata } from 'next';

interface SlugPageProps {
  params: Promise<{ template: string; slug: string[] }>;
  searchParams: Promise<{ id?: string; agentId?: string }>;
}

/**
 * Extract MLS number from the end of an SEO slug.
 * 
 * Slug format: "3-1339-14-avenue-sw-bankview-calgary-alberta-A2295778"
 * MLS number is the LAST segment that matches the pattern [A-Z]\d+ or is all digits.
 */
function extractMlsFromSlug(slugParts: string[]): string | null {
  // Join all slug parts (in case URL had multiple path segments)
  const fullSlug = slugParts.join('/');
  
  // Split by hyphens and find the MLS number (last alphanumeric segment)
  const segments = fullSlug.split('-');
  
  // Try last segment first (most likely location for MLS number)
  const lastSegment = segments[segments.length - 1];
  if (lastSegment && /^[A-Za-z]?\d{5,}$/.test(lastSegment)) {
    return lastSegment.toUpperCase();
  }
  
  // Try second-to-last (in case there's a trailing segment)
  if (segments.length >= 2) {
    const secondLast = segments[segments.length - 2];
    if (secondLast && /^[A-Za-z]\d{5,}$/.test(secondLast)) {
      return secondLast.toUpperCase();
    }
  }

  // Fallback: scan all segments for MLS-like pattern
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i] && /^[A-Za-z]\d{5,}$/.test(segments[i])) {
      return segments[i].toUpperCase();
    }
  }

  return null;
}

/**
 * Generate SEO metadata from slug and property data.
 */
export async function generateMetadata({ params, searchParams }: SlugPageProps): Promise<Metadata> {
  const { template, slug } = await params;
  const query = await searchParams;
  
  // Build a human-readable title from the slug
  const slugText = slug.join('-')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  
  const mlsNumber = query.id || extractMlsFromSlug(slug);
  
  return {
    title: `${slugText} | InTheHood`,
    description: `Property listing ${mlsNumber ? `MLS# ${mlsNumber}` : ''} - View details, photos, and schedule a tour.`,
    openGraph: {
      title: `${slugText} | InTheHood`,
      description: `Property listing ${mlsNumber ? `MLS# ${mlsNumber}` : ''} on InTheHood`,
      type: 'website',
    },
  };
}

export default async function PropertySlugPage({ params, searchParams }: SlugPageProps) {
  const { template, slug } = await params;
  const query = await searchParams;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Get MLS number — from ?id= query param OR extracted from slug
  const mlsNumber = query.id || extractMlsFromSlug(slug);
  
  if (!mlsNumber) {
    return notFound();
  }

  // 2. Try fetching from featured properties first (by mls_number or id)
  let property = null;
  let agent = null;
  let images: { url: string; is_hero: boolean; caption: string }[] = [];

  // Check featured properties table
  const { data: featuredProperty } = await supabase
    .from('properties')
    .select('*, property_media(url, is_hero, display_order, caption)')
    .or(`id.eq.${mlsNumber},mls_number.eq.${mlsNumber}`)
    .maybeSingle();

  if (featuredProperty) {
    property = featuredProperty;
    
    // Fetch agent info
    if (property.user_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, email, phone_number, website, profile_image, logo, logo_light, logo_dark, company_id')
        .eq('id', property.user_id)
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

    // Sort images
    images = (property.property_media || [])
      .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((m: any) => ({ url: m.url, is_hero: !!m.is_hero, caption: m.caption || '' }));
  }

  // 3. If no featured property, try MLS properties table
  if (!property) {
    const { data: mlsProperty } = await supabase
      .from('mls_properties')
      .select('*')
      .eq('mls_number', mlsNumber)
      .maybeSingle();
    
    if (mlsProperty) {
      // Map MLS property fields to template format
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
        property_sub_type: mlsProperty.property_sub_type,
        listing_date: mlsProperty.list_date,
      };

      // If agent is assigned via query param, fetch their info
      if (query.agentId) {
        const { data: agentProfile } = await supabase
          .from('profiles')
          .select('name, email, phone_number, website, profile_image, logo, logo_light, logo_dark, company_id')
          .eq('id', query.agentId)
          .maybeSingle();
        
        if (agentProfile) {
          let companyData = null;
          if (agentProfile.company_id) {
            const { data: company } = await supabase
              .from('companies')
              .select('name, logo, logo_light, logo_dark')
              .eq('id', agentProfile.company_id)
              .maybeSingle();
            companyData = company;
          }
          agent = { ...agentProfile, company: companyData ?? undefined };
        }
      }
    }
  }

  if (!property) {
    return notFound();
  }

  // 4. Generate MLS images if no media exists
  if (images.length === 0 && (property.mls_number || mlsNumber)) {
    const mls = property.mls_number || mlsNumber;
    images = Array.from({ length: 9 }, (_, i) => ({
      url: `https://mlsmedia.inthehood.io/property-images/${mls}/full/${mls}-${i + 1}.webp`,
      is_hero: i === 0,
      caption: ''
    }));
  }

  // 5. Render template
  // Currently uses PremiumTemplate for all templates.
  // When Air/Numero/Default are added, use `template` param to select.
  return <PremiumTemplate property={property} images={images} agent={agent} />;
}
