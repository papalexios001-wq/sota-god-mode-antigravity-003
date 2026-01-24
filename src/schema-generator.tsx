// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - SCHEMA GENERATOR v12.1
// Enterprise-Grade JSON-LD Schema Generation
// CRITICAL FIX: Now accepts object parameter with defensive null checks
// =============================================================================

import { SiteInfo, FAQItem } from './types';

// ==================== INPUT INTERFACE ====================

export interface SchemaGeneratorInput {
  title: string;
  description: string;
  content?: string;
  author?: string;
  authorName?: string;
  datePublished: string;
  dateModified?: string;
  url?: string;
  siteInfo?: SiteInfo | null;
  faqs?: FAQItem[];
  faqItems?: FAQItem[];
}

// ==================== DEFAULT SITE INFO ====================

const DEFAULT_SITE_INFO: SiteInfo = {
  orgName: 'Website',
  orgUrl: '',
  logoUrl: '',
  authorName: 'Expert Author',
  authorUrl: '',
  authorSameAs: [],
  orgSameAs: [],
};

// ==================== FULL SCHEMA GENERATION ====================

export const generateFullSchema = (
  input: SchemaGeneratorInput | string,
  descriptionOrNothing?: string,
  authorNameParam?: string,
  datePublishedParam?: string,
  urlParam?: string,
  siteInfoParam?: SiteInfo,
  faqsParam?: FAQItem[]
): Record<string, any> => {
  
  // Handle both object and legacy parameter formats
  let title: string;
  let description: string;
  let authorName: string;
  let datePublished: string;
  let url: string;
  let siteInfo: SiteInfo;
  let faqs: FAQItem[];

  if (typeof input === 'object' && input !== null) {
    // NEW: Object parameter format (from services.tsx)
    title = input.title || 'Untitled';
    description = input.description || '';
    authorName = input.author || input.authorName || DEFAULT_SITE_INFO.authorName || 'Expert Author';
    datePublished = input.datePublished || new Date().toISOString();
    url = input.url || (typeof window !== 'undefined' ? window.location.href : '');
    
    // CRITICAL: Defensive siteInfo handling
    siteInfo = input.siteInfo 
      ? { ...DEFAULT_SITE_INFO, ...input.siteInfo }
      : { ...DEFAULT_SITE_INFO };
    
    faqs = input.faqs || input.faqItems || [];
  } else {
    // LEGACY: Individual parameters format
    title = input || 'Untitled';
    description = descriptionOrNothing || '';
    authorName = authorNameParam || DEFAULT_SITE_INFO.authorName || 'Expert Author';
    datePublished = datePublishedParam || new Date().toISOString();
    url = urlParam || (typeof window !== 'undefined' ? window.location.href : '');
    
    // CRITICAL: Defensive siteInfo handling
    siteInfo = siteInfoParam 
      ? { ...DEFAULT_SITE_INFO, ...siteInfoParam }
      : { ...DEFAULT_SITE_INFO };
    
    faqs = faqsParam || [];
  }

  const currentYear = new Date().getFullYear();
  const schemas: any[] = [];

  // Safe access helper
  const safeGet = <T,>(value: T | undefined | null, fallback: T): T => {
    return value !== undefined && value !== null ? value : fallback;
  };

  // 1. Article Schema
  const articleSchema: any = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "author": {
      "@type": "Person",
      "name": authorName || safeGet(siteInfo?.authorName, 'Expert Author'),
    },
    "publisher": {
      "@type": "Organization",
      "name": safeGet(siteInfo?.orgName, 'Website'),
      "url": safeGet(siteInfo?.orgUrl, url),
    },
    "datePublished": datePublished,
    "dateModified": new Date().toISOString(),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    },
    "inLanguage": "en-US",
    "copyrightYear": currentYear,
    "copyrightHolder": {
      "@type": "Organization",
      "name": safeGet(siteInfo?.orgName, 'Website')
    }
  };

  // Only add image if logoUrl exists and is non-empty
  if (siteInfo?.logoUrl) {
    articleSchema.image = siteInfo.logoUrl;
    articleSchema.publisher.logo = {
      "@type": "ImageObject",
      "url": siteInfo.logoUrl
    };
  }

  // Only add author URL if exists
  if (siteInfo?.authorUrl) {
    articleSchema.author.url = siteInfo.authorUrl;
  }

  // Only add sameAs arrays if they have values
  if (siteInfo?.authorSameAs && siteInfo.authorSameAs.length > 0) {
    articleSchema.author.sameAs = siteInfo.authorSameAs;
  }
  if (siteInfo?.orgSameAs && siteInfo.orgSameAs.length > 0) {
    articleSchema.publisher.sameAs = siteInfo.orgSameAs;
  }

  schemas.push(articleSchema);

  // 2. Breadcrumb Schema
  const baseUrl = (typeof url === 'string' && url) ? url.split('/').slice(0, 3).join('/') : '';  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": safeGet(siteInfo?.orgUrl, baseUrl) || baseUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": title,
        "item": url
      }
    ]
  };
  schemas.push(breadcrumbSchema);

  // 3. FAQ Schema (if FAQs provided)
  if (faqs && Array.isArray(faqs) && faqs.length > 0) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question || '',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer || ''
        }
      }))
    };
    schemas.push(faqSchema);
  }

  // 4. WebPage Schema
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": title,
    "description": description,
    "url": url,
    "isPartOf": {
      "@type": "WebSite",
      "name": safeGet(siteInfo?.orgName, 'Website'),
      "url": safeGet(siteInfo?.orgUrl, baseUrl) || baseUrl
    },
    "about": {
      "@type": "Thing",
      "name": title
    },
    "datePublished": datePublished,
    "dateModified": new Date().toISOString()
  };
  schemas.push(webPageSchema);

  // Return combined schema graph
  return {
    "@context": "https://schema.org",
    "@graph": schemas
  };
};

// ==================== SCHEMA MARKUP HTML ====================

export const generateSchemaMarkup = (schema: Record<string, any>): string => {
  try {
    return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
  } catch (error) {
    console.error('[generateSchemaMarkup] Error:', error);
    return '';
  }
};

// ==================== PRODUCT SCHEMA ====================

export const generateProductSchema = (
  name: string,
  description: string,
  price: number,
  currency: string = 'USD',
  availability: 'InStock' | 'OutOfStock' | 'PreOrder' = 'InStock',
  ratingValue?: number,
  reviewCount?: number,
  brand?: string,
  imageUrl?: string
): Record<string, any> => {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": name || 'Product',
    "description": description || '',
    "offers": {
      "@type": "Offer",
      "price": price || 0,
      "priceCurrency": currency,
      "availability": `https://schema.org/${availability}`,
      "url": typeof window !== 'undefined' ? window.location.href : ''
    }
  };

  if (brand) {
    schema.brand = {
      "@type": "Brand",
      "name": brand
    };
  }

  if (imageUrl) {
    schema.image = imageUrl;
  }

  if (ratingValue && reviewCount) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": ratingValue,
      "reviewCount": reviewCount,
      "bestRating": 5,
      "worstRating": 1
    };
  }

  return schema;
};

// ==================== HOW-TO SCHEMA ====================

export const generateHowToSchema = (
  name: string,
  description: string,
  steps: Array<{ name: string; text: string; imageUrl?: string }>,
  totalTime?: string,
  estimatedCost?: { value: number; currency: string }
): Record<string, any> => {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": name || 'How To Guide',
    "description": description || '',
    "step": (steps || []).map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step?.name || `Step ${index + 1}`,
      "text": step?.text || '',
      ...(step?.imageUrl ? { "image": step.imageUrl } : {})
    }))
  };

  if (totalTime) {
    schema.totalTime = totalTime;
  }

  if (estimatedCost) {
    schema.estimatedCost = {
      "@type": "MonetaryAmount",
      "currency": estimatedCost.currency || 'USD',
      "value": estimatedCost.value || 0
    };
  }

  return schema;
};

// ==================== LOCAL BUSINESS SCHEMA ====================

export const generateLocalBusinessSchema = (
  name: string,
  description: string,
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  },
  telephone?: string,
  openingHours?: string[],
  priceRange?: string,
  imageUrl?: string,
  geo?: { latitude: number; longitude: number }
): Record<string, any> => {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": name || 'Business',
    "description": description || '',
    "address": {
      "@type": "PostalAddress",
      "streetAddress": address?.streetAddress || '',
      "addressLocality": address?.addressLocality || '',
      "addressRegion": address?.addressRegion || '',
      "postalCode": address?.postalCode || '',
      "addressCountry": address?.addressCountry || ''
    }
  };

  if (telephone) {
    schema.telephone = telephone;
  }

  if (openingHours && openingHours.length > 0) {
    schema.openingHours = openingHours;
  }

  if (priceRange) {
    schema.priceRange = priceRange;
  }

  if (imageUrl) {
    schema.image = imageUrl;
  }

  if (geo?.latitude && geo?.longitude) {
    schema.geo = {
      "@type": "GeoCoordinates",
      "latitude": geo.latitude,
      "longitude": geo.longitude
    };
  }

  return schema;
};

// ==================== VIDEO SCHEMA ====================

export const generateVideoSchema = (
  name: string,
  description: string,
  thumbnailUrl: string,
  uploadDate: string,
  duration?: string,
  contentUrl?: string,
  embedUrl?: string
): Record<string, any> => {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": name || 'Video',
    "description": description || '',
    "thumbnailUrl": thumbnailUrl || '',
    "uploadDate": uploadDate || new Date().toISOString()
  };

  if (duration) {
    schema.duration = duration;
  }

  if (contentUrl) {
    schema.contentUrl = contentUrl;
  }

  if (embedUrl) {
    schema.embedUrl = embedUrl;
  }

  return schema;
};

// ==================== EVENT SCHEMA ====================

export const generateEventSchema = (
  name: string,
  description: string,
  startDate: string,
  endDate: string,
  location: {
    name: string;
    address: string;
  } | { url: string },
  eventStatus: 'EventScheduled' | 'EventCancelled' | 'EventPostponed' = 'EventScheduled',
  eventAttendanceMode: 'OfflineEventAttendanceMode' | 'OnlineEventAttendanceMode' | 'MixedEventAttendanceMode' = 'OfflineEventAttendanceMode',
  imageUrl?: string,
  performer?: string,
  offers?: { price: number; currency: string; availability: string }
): Record<string, any> => {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": name || 'Event',
    "description": description || '',
    "startDate": startDate || new Date().toISOString(),
    "endDate": endDate || new Date().toISOString(),
    "eventStatus": `https://schema.org/${eventStatus}`,
    "eventAttendanceMode": `https://schema.org/${eventAttendanceMode}`
  };

  if (location) {
    if ('url' in location) {
      schema.location = {
        "@type": "VirtualLocation",
        "url": location.url || ''
      };
    } else {
      schema.location = {
        "@type": "Place",
        "name": location.name || 'Venue',
        "address": location.address || ''
      };
    }
  }

  if (imageUrl) {
    schema.image = imageUrl;
  }

  if (performer) {
    schema.performer = {
      "@type": "Person",
      "name": performer
    };
  }

  if (offers) {
    schema.offers = {
      "@type": "Offer",
      "price": offers.price || 0,
      "priceCurrency": offers.currency || 'USD',
      "availability": `https://schema.org/${offers.availability || 'InStock'}`
    };
  }

  return schema;
};

// ==================== REVIEW SCHEMA ====================

export const generateReviewSchema = (
  itemReviewed: { type: string; name: string },
  reviewRating: number,
  author: string,
  reviewBody: string,
  datePublished: string
): Record<string, any> => {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": {
      "@type": itemReviewed?.type || 'Thing',
      "name": itemReviewed?.name || 'Item'
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": reviewRating || 5,
      "bestRating": 5,
      "worstRating": 1
    },
    "author": {
      "@type": "Person",
      "name": author || 'Anonymous'
    },
    "reviewBody": reviewBody || '',
    "datePublished": datePublished || new Date().toISOString()
  };
};

// ==================== EXPORTS ====================

export default {
  generateFullSchema,
  generateSchemaMarkup,
  generateProductSchema,
  generateHowToSchema,
  generateLocalBusinessSchema,
  generateVideoSchema,
  generateEventSchema,
  generateReviewSchema
};
