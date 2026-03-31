'use client';

import React, { useState } from 'react';
import { Phone, Mail, Home as HomeIcon, ArrowUpRight, Bed, Bath, ChevronRight, Maximize } from 'lucide-react';

interface Property {
  id: string;
  title?: string;
  address?: string;
  city?: string;
  province?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  bathrooms_full?: number;
  bathrooms_half?: number;
  sqft?: number;
  square_feet?: number;
  year_built?: number;
  description?: string;
  intro_headline?: string;
  intro_paragraph?: string;
  virtual_tour_url?: string;
  video_tour_url?: string;
  property_features?: string[];
  amenities?: string[];
  lot_size?: number;
}

interface Image {
  url: string;
  is_hero: boolean;
  caption: string;
}

interface Agent {
  name?: string;
  email?: string;
  phone_number?: string;
  website?: string;
  profile_image?: string;
  logo?: string;
  logo_light?: string;
  logo_dark?: string;
  company?: {
    name?: string;
    logo?: string;
    logo_light?: string;
    logo_dark?: string;
  };
}

interface PremiumTemplateProps {
  property: Property;
  images: Image[];
  agent: Agent | null;
}

export default function PremiumTemplate({ property, images, agent }: PremiumTemplateProps) {
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const galleryImages = images.length > 0 ? images : [];
  const agentLogo = agent?.logo_light || agent?.logo || null;
  const brokerageLogo = agent?.company?.logo_light || agent?.company?.logo || null;

  // Limit intro paragraph to 2 lines (approx 100 characters)
  const introParagraph = property.intro_paragraph || "Experience the perfect blend of comfort, style, and nature right at your doorstep.";
  const limitedIntroParagraph = introParagraph.length > 100 ? introParagraph.substring(0, 97) + '...' : introParagraph;

  // Limit headline to ensure 3 lines max
  const introHeadline = property.intro_headline || "evolution of our beautiful & serene backyard";
  const limitedHeadline = introHeadline.length > 80 ? introHeadline.substring(0, 77) + '...' : introHeadline;

  const formatBathrooms = () => {
    if (property.bathrooms_full !== undefined) {
      return property.bathrooms_full + (property.bathrooms_half || 0) * 0.5;
    }
    return property.bathrooms || 0;
  };

  const sqft = property.sqft || property.square_feet;

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-sm shadow-sm">
        <div className="max-w-[1500px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left - Logo with Contact */}
            <div className="flex items-center gap-6">
              {agentLogo && (
                <img src={agentLogo} alt="Agent Logo" className="h-10 object-contain" />
              )}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {agent?.phone_number && (
                  <a href={`tel:${agent.phone_number}`} className="flex items-center gap-2 hover:text-gray-900 transition-colors">
                    <Phone className="w-4 h-4" />
                    <span>{agent.phone_number}</span>
                  </a>
                )}
                {agent?.email && (
                  <a href={`mailto:${agent.email}`} className="flex items-center gap-2 hover:text-gray-900 transition-colors">
                    <Mail className="w-4 h-4" />
                    <span>{agent.email}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Center - Navigation with rounded background */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 bg-gray-100 rounded-[50px] px-6 py-2">
              <button
                onClick={() => scrollToSection('hero')}
                className="flex items-center gap-2 px-4 py-2 text-gray-900 bg-white rounded-full transition-all"
              >
                <HomeIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Home</span>
              </button>
              <button
                onClick={() => scrollToSection('gallery')}
                className="px-4 py-2 text-gray-500 hover:bg-white hover:text-gray-900 rounded-full transition-all text-sm"
              >
                Gallery
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="px-4 py-2 text-gray-500 hover:bg-white hover:text-gray-900 rounded-full transition-all text-sm"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="px-4 py-2 text-gray-500 hover:bg-white hover:text-gray-900 rounded-full transition-all text-sm"
              >
                About
              </button>
            </div>

            {/* Right - CTA Button */}
            <button
              onClick={() => scrollToSection('contact')}
              className="bg-black text-white rounded-full pl-6 pr-3 py-2 flex items-center gap-4 hover:bg-black/90 transition-colors"
            >
              <span className="text-base font-medium">Schedule A Tour</span>
              <div className="bg-white rounded-full p-2.5">
                <ArrowUpRight className="w-5 h-5 text-black" />
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="relative pt-20 bg-white">
        <div className="max-w-[1500px] mx-auto px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 items-end">
            {/* Left Column - Intro Content (75%) */}
            <div className="space-y-0 lg:col-span-3 lg:pr-12 lg:border-r border-gray-300">
              {/* First Line: Grey headline + italic paragraph */}
              <div className="flex items-end gap-6 mb-0">
                <h1 className="text-[5.7rem] leading-[0.9] font-light whitespace-nowrap" style={{ color: '#bfc1c0' }}>
                  We bring new
                </h1>
                <p className="text-gray-500 text-[1.3rem] leading-[1.2] italic pb-[7px]">
                  {limitedIntroParagraph}
                </p>
              </div>

              {/* Black headline text with inline button */}
              <h1 className="text-[5.7rem] leading-[0.9] font-light text-black inline">
                {limitedHeadline}{' '}
                <button
                  onClick={() => scrollToSection('gallery')}
                  className="inline-flex items-center gap-2 bg-black text-white rounded-full pl-6 pr-3 py-2 hover:bg-gray-900 transition-colors text-base font-medium translate-y-[-8px]"
                >
                  <span>more info</span>
                  <div className="bg-white rounded-full p-2">
                    <ArrowUpRight className="w-4 h-4 text-black" />
                  </div>
                </button>
              </h1>
            </div>

            {/* Right Column - Property Info Box (25%) */}
            <div className="lg:col-span-1 lg:pl-12 flex items-end mt-8 lg:mt-0">
              {/* Black Property Info Box */}
              <div className="bg-black text-white rounded-3xl p-7 w-full space-y-4">
                {/* Bedrooms */}
                {property.bedrooms && (
                  <div className="flex items-center gap-4">
                    <Bed className="w-[1.3rem] h-[1.3rem]" />
                    <span className="text-[1.1rem]">{property.bedrooms} Bedroom{property.bedrooms !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* Bathrooms */}
                {formatBathrooms() > 0 && (
                  <div className="flex items-center gap-4">
                    <Bath className="w-[1.3rem] h-[1.3rem]" />
                    <span className="text-[1.1rem]">{formatBathrooms()} Bathroom{formatBathrooms() !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* Square Footage */}
                {sqft && (
                  <div className="flex items-center gap-4">
                    <svg className="w-[1.3rem] h-[1.3rem]" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                    <span className="text-[1.1rem]">{sqft.toLocaleString()} sqft</span>
                  </div>
                )}

                {/* Price */}
                {property.price && (
                  <div className="pt-4 space-y-2">
                    <p className="text-sm text-white/60">Price</p>
                    <p className="text-4xl font-light">${property.price.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent/Tour Section - Moved Below Hero */}
      <section className="bg-white pb-12">
        <div className="max-w-[1500px] mx-auto px-8">
          <div className="max-w-md">
            {(property.virtual_tour_url || property.video_tour_url) ? (
              // Take The Tour Option
              <div className="relative bg-gray-900 rounded-3xl overflow-hidden aspect-[4/3] group cursor-pointer">
                {galleryImages[0] && (
                  <img
                    src={galleryImages[0].url}
                    alt="Virtual Tour"
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity"
                  />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <Maximize className="w-12 h-12 mb-4" />
                  <h3 className="text-2xl font-light mb-2">Let's watch</h3>
                  <p className="text-lg">inside 3D view</p>
                </div>
                <button
                  onClick={() => window.open(property.virtual_tour_url || property.video_tour_url, '_blank')}
                  className="absolute top-6 right-6 w-12 h-12 bg-white rounded-2xl flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <ArrowUpRight className="w-5 h-5 text-black" />
                </button>
              </div>
            ) : (
              // Meet The Agent Option
              agent && (
                <div className="relative bg-white border border-gray-200 rounded-3xl overflow-hidden p-6">
                  {agent.profile_image && (
                    <div className="aspect-[4/3] mb-4 rounded-2xl overflow-hidden">
                      <img
                        src={agent.profile_image}
                        alt={agent.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <h3 className="text-2xl font-light text-gray-900 mb-2">
                    Meet {agent.name || 'Your Agent'}
                  </h3>
                  {agent.company && (
                    <p className="text-gray-600 mb-4">With {agent.company.name}</p>
                  )}
                  {brokerageLogo && (
                    <img src={brokerageLogo} alt="Brokerage" className="h-8 object-contain mb-4" />
                  )}
                  <button
                    onClick={() => agent.website ? window.open(agent.website, '_blank') : null}
                    className="absolute top-6 right-6 w-12 h-12 bg-black rounded-2xl flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <ArrowUpRight className="w-5 h-5 text-white" />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Gallery Section - 50/50 Split Carousel */}
      {galleryImages.length > 0 && (
        <section id="gallery" className="py-20 bg-white">
          <div className="max-w-[1500px] mx-auto px-8">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Image */}
              <div className="relative">
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden cursor-pointer">
                  <img
                    src={galleryImages[currentGalleryIndex]?.url}
                    alt={property.title || 'Property'}
                    className="w-full h-full object-cover"
                  />

                  {/* Previous Arrow - Left Image */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
                    }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <ChevronRight className="w-6 h-6 text-black rotate-180" />
                  </button>
                </div>

                {/* Pagination - Bottom Left */}
                <div className="absolute bottom-6 left-6 bg-black text-white rounded-full px-5 py-2 text-sm font-medium">
                  {currentGalleryIndex + 1} / {galleryImages.length}
                </div>
              </div>

              {/* Right Image */}
              <div className="relative">
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden cursor-pointer">
                  <img
                    src={galleryImages[(currentGalleryIndex + 1) % galleryImages.length]?.url}
                    alt={property.title || 'Property'}
                    className="w-full h-full object-cover"
                  />

                  {/* Next Arrow - Right Image */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentGalleryIndex((prev) => (prev + 1) % galleryImages.length);
                    }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <ChevronRight className="w-6 h-6 text-black" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-[1500px] mx-auto px-8">
          <h2 className="text-4xl font-light text-gray-900 mb-12">Property Features</h2>

          {property.description && (
            <div className="prose prose-lg max-w-none mb-12">
              <p className="text-gray-600 whitespace-pre-line">{property.description}</p>
            </div>
          )}

          {property.property_features && property.property_features.length > 0 && (
            <div className="grid md:grid-cols-3 gap-6">
              {property.property_features.map((feature: string, idx: number) => (
                <div key={idx} className="bg-white rounded-2xl p-6 border border-gray-200">
                  <p className="text-gray-900">{feature}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-[1500px] mx-auto px-8">
          <h2 className="text-4xl font-light text-gray-900 mb-8">About This Property</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">Location</h3>
                <p className="text-gray-600">{property.address}{property.city ? `, ${property.city}` : ''}{property.province ? `, ${property.province}` : ''}</p>
              </div>
              {property.year_built && (
                <div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">Year Built</h3>
                  <p className="text-gray-600">{property.year_built}</p>
                </div>
              )}
              {property.lot_size && (
                <div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">Lot Size</h3>
                  <p className="text-gray-600">{property.lot_size.toLocaleString()} sq ft</p>
                </div>
              )}
            </div>
            <div className="space-y-6">
              {property.amenities && property.amenities.length > 0 && (
                <div>
                  <h3 className="text-xl font-medium text-gray-900 mb-4">Amenities</h3>
                  <ul className="space-y-2">
                    {property.amenities.map((amenity: string, idx: number) => (
                      <li key={idx} className="flex items-center gap-2 text-gray-600">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                        {amenity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gray-50">
        <div className="max-w-[800px] mx-auto px-8 text-center">
          <h2 className="text-4xl font-light text-gray-900 mb-4">Get In Touch</h2>
          <p className="text-gray-600 mb-8">Interested in this property? Contact us to schedule a tour.</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {agent?.phone_number && (
              <button
                className="rounded-full bg-black text-white hover:bg-gray-800 px-6 py-3 flex items-center justify-center gap-2"
                onClick={() => window.location.href = `tel:${agent.phone_number}`}
              >
                <Phone className="w-4 h-4" />
                Call {agent.phone_number}
              </button>
            )}
            {agent?.email && (
              <button
                className="rounded-full border-2 border-gray-900 text-gray-900 hover:bg-gray-100 px-6 py-3 flex items-center justify-center gap-2"
                onClick={() => window.location.href = `mailto:${agent.email}`}
              >
                <Mail className="w-4 h-4" />
                Email Agent
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
