import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import AirTemplateRenderer from './AirTemplateRenderer';

// Parse slug to extract MLS number
function parseSlug(slug: string): string {
  const parts = slug.split('-');
  if (parts[0] && /^[A-Z]\d+$/i.test(parts[0])) {
    return parts[0].toUpperCase();
  }
  return '';
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: 'Jost, sans-serif' }}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    </div>
  );
}

// Server Component
export default async function MLSPropertyPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ agentId?: string; theme?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const mlsNumber = parseSlug(resolvedParams.slug);
  
  if (!mlsNumber) {
    notFound();
  }
  
  const theme = resolvedSearchParams.theme || 'light';
  
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AirTemplateRenderer 
        mlsNumber={mlsNumber}
        theme={theme}
        agentId={resolvedSearchParams.agentId}
      />
    </Suspense>
  );
}
