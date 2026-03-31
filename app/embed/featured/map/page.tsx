'use client';

import { Suspense } from 'react';
import FeaturedMapClient from './FeaturedMapClient';

export default function FeaturedMapPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <FeaturedMapClient />
    </Suspense>
  );
}
