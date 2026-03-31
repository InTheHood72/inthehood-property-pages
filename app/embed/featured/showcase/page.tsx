import { Suspense } from 'react';
import FeaturedShowcaseClient from './FeaturedShowcaseClient';

export const dynamic = 'force-dynamic';

export default function FeaturedShowcasePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    }>
      <FeaturedShowcaseClient />
    </Suspense>
  );
}
