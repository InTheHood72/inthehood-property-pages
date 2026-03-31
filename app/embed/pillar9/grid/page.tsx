'use client';

import { Suspense } from 'react';
import Pillar9GridClient from './Pillar9GridClient';

export default function Pillar9GridPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px] bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500"></div>
      </div>
    }>
      <Pillar9GridClient />
    </Suspense>
  );
}
