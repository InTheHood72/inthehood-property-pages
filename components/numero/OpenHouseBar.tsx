"use client";
import { useEffect, useState, useRef } from "react";

interface OpenHouse {
  OpenHouseDate?: string;
  OpenHouseStartTime?: string;
  OpenHouseEndTime?: string;
  OpenHouseRemarks?: string;
  open_house_date?: string;
  open_house_start_time?: string;
  open_house_end_time?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
}

interface OpenHouseBarSettings {
  enabled: boolean;
  backgroundColor: string;
  textColor: string;
  fontSize: string;
  animationEnabled: boolean;
}

interface OpenHouseBarProps {
  property: any;
  theme?: 'light' | 'dark';
}

// Fetch backend URL dynamically from Supabase database
async function fetchBackendUrl(): Promise<string> {
  try {
    const supabaseUrl = 'https://ojfjawuxpchgeinhdkff.supabase.co';
    const response = await fetch(`${supabaseUrl}/rest/v1/global_settings?select=api_config&limit=1`, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qZmphd3V4cGNoZ2Vpbmhka2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNDc5OTcsImV4cCI6MjA3MjgyMzk5N30.SW3K2j5bVM2LodWVOVaM11bW_VYb70Ym2irGNeIq2UE',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qZmphd3V4cGNoZ2Vpbmhka2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNDc5OTcsImV4cCI6MjA3MjgyMzk5N30.SW3K2j5bVM2LodWVOVaM11bW_VYb70Ym2irGNeIq2UE',
      },
      cache: 'no-store'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data[0]?.api_config?.current_backend_url) {
        return data[0].api_config.current_backend_url;
      }
    }
  } catch (e) {
    console.warn('Could not fetch backend URL from Supabase:', e);
  }
  
  return 'https://hood-staging.preview.emergentagent.com';
}

export default function OpenHouseBar({ property, theme = 'light' }: OpenHouseBarProps) {
  const [showBottomBar, setShowBottomBar] = useState(false);
  const [hideTopBar, setHideTopBar] = useState(false);
  const [settings, setSettings] = useState<OpenHouseBarSettings>({
    enabled: true,
    backgroundColor: '#d10000',
    textColor: '#ffffff',
    fontSize: '1rem',
    animationEnabled: true
  });
  const [upcomingOpenHouses, setUpcomingOpenHouses] = useState<OpenHouse[]>([]);
  const lastScrollY = useRef(0);
  const topBarRef = useRef<HTMLDivElement>(null);

  // Fetch bar settings from backend API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const backendUrl = await fetchBackendUrl();
        
        const response = await fetch(`${backendUrl}/api/numero-template/global-css`);
        if (response.ok) {
          const data = await response.json();
          const barSettings = data.settings?.open_house_bar;
          if (barSettings) {
            setSettings(barSettings);
          }
        }
      } catch (e) {
        console.warn('Could not fetch open house bar settings:', e);
      }
    };
    fetchSettings();
  }, []);

  // Find ALL upcoming open houses
  useEffect(() => {
    if (property?.open_houses && Array.isArray(property.open_houses)) {
      const now = new Date();
      const upcoming = property.open_houses
        .filter((oh: OpenHouse) => {
          const dateStr = oh.OpenHouseDate || oh.open_house_date || oh.date;
          if (!dateStr) return false;
          // Handle both formats: "2026-01-31" and "2026-01-31T00:00:00"
          let fullDateStr = dateStr;
          if (!dateStr.includes('T')) {
            fullDateStr = dateStr + 'T23:59:59';
          } else {
            fullDateStr = dateStr.split('T')[0] + 'T23:59:59';
          }
          const ohDate = new Date(fullDateStr);
          return !isNaN(ohDate.getTime()) && ohDate >= now;
        })
        .sort((a: OpenHouse, b: OpenHouse) => {
          const dateA = a.OpenHouseDate || a.open_house_date || a.date || '';
          const dateB = b.OpenHouseDate || b.open_house_date || b.date || '';
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
      
      setUpcomingOpenHouses(upcoming);
    }
  }, [property]);

  // Handle scroll for sticky bottom bar behavior
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show bottom bar when scrolled past 400px
      if (currentScrollY > 400) {
        setShowBottomBar(true);
        setHideTopBar(true);
      } else if (currentScrollY <= 200) {
        // Hide bottom bar and show top bar when near top
        setShowBottomBar(false);
        setHideTopBar(false);
      }
      
      lastScrollY.current = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!settings.enabled || upcomingOpenHouses.length === 0) return null;

  // Format a single open house
  const formatOpenHouse = (oh: OpenHouse): string => {
    const dateStr = oh.OpenHouseDate || oh.open_house_date || oh.date;
    const startStr = oh.OpenHouseStartTime || oh.open_house_start_time || oh.start_time;
    const endStr = oh.OpenHouseEndTime || oh.open_house_end_time || oh.end_time;

    let formattedDate = 'Date TBD';
    if (dateStr) {
      const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const date = new Date(datePart + 'T12:00:00');
      formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }

    const formatTime = (timeStr: string | undefined): string => {
      if (!timeStr) return '';
      try {
        let timePart = timeStr;
        if (timeStr.includes('T')) {
          timePart = timeStr.split('T')[1];
        } else if (timeStr.includes(' ')) {
          timePart = timeStr.split(' ')[1];
        }
        timePart = timePart.split('.')[0];
        const [hours, minutes] = timePart.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
      } catch {
        return timeStr;
      }
    };

    const start = formatTime(startStr);
    const end = formatTime(endStr);
    const timeRange = start && end ? `${start} - ${end}` : '';

    return `${formattedDate}${timeRange ? ` • ${timeRange}` : ''}`;
  };

  // Create display text for all open houses
  const openHouseText = upcomingOpenHouses.map(formatOpenHouse).join('   |   ');
  const fullDisplayText = `OPEN HOUSE: ${openHouseText}`;

  const barStyle: React.CSSProperties = {
    backgroundColor: settings.backgroundColor,
    color: settings.textColor,
    fontSize: settings.fontSize,
    fontWeight: 600,
    letterSpacing: '0.5px',
    zIndex: 9999,
  };

  return (
    <>
      {/* Top Bar - Shows initially, hides on scroll down */}
      <div 
        ref={topBarRef}
        className="numero-open-house-bar numero-open-house-top"
        style={{
          ...barStyle,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          padding: '10px 20px',
          transform: hideTopBar ? 'translateY(-100%)' : 'translateY(0)',
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Desktop: inline display */}
        <div className="open-house-desktop text-center">
          {fullDisplayText}
        </div>
        
        {/* Mobile: ticker animation */}
        <div className="open-house-mobile">
          <div className="ticker-wrapper">
            <div className="ticker-content">
              <span>{fullDisplayText}</span>
              <span className="mx-12">{fullDisplayText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar - Slides up on scroll, sticks to bottom */}
      <div 
        className="numero-open-house-bar numero-open-house-bottom"
        style={{
          ...barStyle,
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '10px 20px',
          transform: showBottomBar ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Desktop: inline display */}
        <div className="open-house-desktop text-center">
          {fullDisplayText}
        </div>
        
        {/* Mobile: ticker animation */}
        <div className="open-house-mobile">
          <div className="ticker-wrapper">
            <div className="ticker-content">
              <span>{fullDisplayText}</span>
              <span className="mx-12">{fullDisplayText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for top bar */}
      <div style={{ height: '45px' }} />

      <style jsx global>{`
        /* Desktop view - hide ticker, show static */
        @media (min-width: 769px) {
          .open-house-desktop {
            display: block;
          }
          .open-house-mobile {
            display: none;
          }
        }
        
        /* Mobile/Tablet view - show ticker, hide static */
        @media (max-width: 768px) {
          .open-house-desktop {
            display: none;
          }
          .open-house-mobile {
            display: block;
          }
          
          .ticker-wrapper {
            overflow: hidden;
            white-space: nowrap;
          }
          
          .ticker-content {
            display: inline-block;
            animation: ticker 20s linear infinite;
          }
          
          .ticker-content span {
            display: inline-block;
          }
        }
        
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        /* Pause ticker on hover */
        .ticker-wrapper:hover .ticker-content {
          animation-play-state: paused;
        }
      `}</style>
    </>
  );
}
