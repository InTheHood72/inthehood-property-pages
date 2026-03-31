'use client';

import { useState, useEffect } from 'react';
import AirTemplateClient from '../../property/air/AirTemplateClient';
import AirTemplateDarkClient from '../../property/air-dark/AirTemplateDarkClient';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface AirTemplateRendererProps {
  mlsNumber: string;
  theme: string;
  agentId?: string;
}

export default function AirTemplateRenderer({ 
  mlsNumber, 
  theme: themeProp,
  agentId 
}: AirTemplateRendererProps) {
  const [isDark, setIsDark] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  
  // Fetch theme from Supabase global settings on mount
  useEffect(() => {
    const fetchThemePreference = async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/global_settings?select=api_config&limit=1`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          const listingTheme = data?.[0]?.api_config?.listing_template_theme;
          setIsDark(listingTheme === 'dark');
        }
      } catch (error) {
        console.warn('Failed to fetch theme preference:', error);
      } finally {
        setThemeLoaded(true);
      }
    };
    
    fetchThemePreference();
  }, []);

  // Show appropriate loading based on expected theme
  if (!themeLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" style={{ fontFamily: 'Jost, sans-serif' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400" />
      </div>
    );
  }

  // Render template based on Supabase setting
  if (isDark) {
    return <AirTemplateDarkClient propertyIdProp={mlsNumber} agentIdProp={agentId} />;
  }
  return <AirTemplateClient propertyIdProp={mlsNumber} agentIdProp={agentId} />;
}
