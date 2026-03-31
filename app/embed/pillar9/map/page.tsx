import { Suspense } from 'react';
import { Metadata } from 'next';
import Pillar9MapClient from './Pillar9MapClient';

export const metadata: Metadata = {
  title: 'Pillar 9 MLS Search',
  description: 'Search MLS properties with interactive map',
};

export default function Pillar9MapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-white">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <Pillar9MapClient />
    </Suspense>
  );
}
