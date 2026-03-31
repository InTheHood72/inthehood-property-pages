'use client';

import DefaultTemplateClient from '../../property/default/DefaultTemplateClient';
import NumeroClient from '../../property/numero/NumeroClient';

interface TemplateRendererProps {
  propertyId: string;
  template: string;
  theme: string;
  agentId?: string;
}

export default function TemplateRenderer({ 
  propertyId, 
  template, 
  theme,
  agentId 
}: TemplateRendererProps) {
  // Pass property ID directly as props - NO URL modification needed
  if (template === 'creative' || template === 'numero') {
    return <NumeroClient propertyIdProp={propertyId} agentIdProp={agentId} />;
  }
  
  return <DefaultTemplateClient propertyIdProp={propertyId} agentIdProp={agentId} />;
}
