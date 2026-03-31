import { Suspense } from 'react';
import AirTemplateDarkClient from './AirTemplateDarkClient';

export default function AirTemplateDarkPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#121212' }}><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>}>
      <AirTemplateDarkClient />
    </Suspense>
  );
}
