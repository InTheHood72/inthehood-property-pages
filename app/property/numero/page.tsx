import { Suspense } from 'react';
import NumeroClient from './NumeroClient';

export default function NumeroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f7f7f7]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black" /></div>}>
      <NumeroClient />
    </Suspense>
  );
}
