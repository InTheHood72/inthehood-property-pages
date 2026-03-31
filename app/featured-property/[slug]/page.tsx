import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import TemplateRenderer from './TemplateRenderer';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function parseSlug(slug: string): { id: string; isMLS: boolean } {
  const parts = slug.split('-');
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  if (uuidPattern.test(slug)) {
    return { id: slug.substring(0, 36), isMLS: false };
  }
  if (parts[0] && /^[A-Z]\d+$/i.test(parts[0])) {
    return { id: parts[0].toUpperCase(), isMLS: true };
  }
  return { id: parts[0] || '', isMLS: false };
}

async function getPropertyData(id: string, isMLS: boolean) {
  try {
    const query = isMLS 
      ? `mls_number=eq.${id}&select=id,mls_number,selected_template,presentation_settings`
      : `id=eq.${id}&select=id,mls_number,selected_template,presentation_settings`;
    
    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?${query}&limit=1`, {
      headers: { 
        'apikey': SUPABASE_KEY, 
        'Authorization': `Bearer ${SUPABASE_KEY}` 
      },
      cache: 'no-store'
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] || null;
  } catch (error) {
    console.error('Error fetching property:', error);
    return null;
  }
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: 'Jost, sans-serif' }}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    </div>
  );
}

export default async function FeaturedPropertyPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ agentId?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const { id, isMLS } = parseSlug(resolvedParams.slug);
  
  if (!id) {
    notFound();
  }
  
  const property = await getPropertyData(id, isMLS);
  const propertyId = property?.id || id;
  const template = property?.selected_template || 'default';
  const theme = property?.presentation_settings?.theme || 'light';
  
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TemplateRenderer 
        propertyId={propertyId}
        template={template}
        theme={theme}
        agentId={resolvedSearchParams.agentId}
      />
    </Suspense>
  );
}
