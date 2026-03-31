import { Suspense } from 'react';
import NumeroDarkClient from './NumeroDarkClient';

export default function NumeroDarkPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" /></div>}>
      <NumeroDarkClient />
    </Suspense>
  );
}
