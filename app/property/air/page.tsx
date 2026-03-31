import { Suspense } from 'react';
import AirTemplateClient from './AirTemplateClient';

export default function PropertyAirPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>}>
      <AirTemplateClient />
    </Suspense>
  );
}
