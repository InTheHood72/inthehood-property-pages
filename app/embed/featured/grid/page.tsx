import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const FeaturedGridClient = dynamic(
  () => import('./FeaturedGridClient'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px] bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500"></div>
      </div>
    )
  }
);

export default function FeaturedGridPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px] bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500"></div>
      </div>
    }>
      <FeaturedGridClient />
    </Suspense>
  );
}
