import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const Pillar9CarouselClient = dynamic(
  () => import('./Pillar9CarouselClient'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px] bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500"></div>
      </div>
    )
  }
);

export default function Pillar9CarouselPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px] bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500"></div>
      </div>
    }>
      <Pillar9CarouselClient />
    </Suspense>
  );
}
