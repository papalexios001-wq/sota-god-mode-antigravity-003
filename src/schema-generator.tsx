// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - SCHEMA GENERATOR v12.0
// Enterprise-Grade JSON-LD Schema Generation
// =============================================================================

import { SiteInfo, FAQItem } from './types';

// ==================== FULL SCHEMA GENERATION ====================

export const generateFullSchema = (
  title: string,
  description: string,
  authorName: string,
  datePublished: string,
  url: string,
  siteInfo: SiteInfo,
  faqs?: FAQItem[]
): Record<string, any> => {
  const currentYear = new Date().getFullYear();
  
  const schemas: any[] = [];

  // 1. Article Schema
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "image": siteInfo.logoUrl || undefined,
    "author": {
      "@type": "Person",
      "name": authorName || siteInfo.authorName || "Expert Author",
      "url": siteInfo.authorUrl || undefined,
      "sameAs": siteInfo.authorSameAs || []
    },
    "publisher": {
      "@type": "Organization",
      "name": siteInfo.orgName || "Website",
      "logo": siteInfo.logoUrl ? {
        "@type": "ImageObject",
        "url": siteInfo.logoUrl
      } : undefined,
      "url": siteInfo.orgUrl || url,
      "sameAs": siteInfo.orgSameAs || []
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
      "name": siteInfo.orgName || "Website"
    }
  };
  schemas.push(articleSchema);

  // 2. Breadcrumb Schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": siteInfo.orgUrl || url.split('/').slice(0, 3).join('/')
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
  if (faqs && faqs.length > 0) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
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
      "name": siteInfo.orgName || "Website",
      "url": siteInfo.orgUrl || url.split('/').slice(0, 3).join('/')
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
  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
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
    "name": name,
    "description": description,
    "offers": {
      "@type": "Offer",
      "price": price,
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
    "name": name,
    "description": description,
    "step": steps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.name,
      "text": step.text,
      "image": step.imageUrl || undefined
    }))
  };

  if (totalTime) {
    schema.totalTime = totalTime;
  }

  if (estimatedCost) {
    schema.estimatedCost = {
      "@type": "MonetaryAmount",
      "currency": estimatedCost.currency,
      "value": estimatedCost.value
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
    "name": name,
    "description": description,
    "address": {
      "@type": "PostalAddress",
      ...address
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

  if (geo) {
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
    "name": name,
    "description": description,
    "thumbnailUrl": thumbnailUrl,
    "uploadDate": uploadDate
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
    "name": name,
    "description": description,
    "startDate": startDate,
    "endDate": endDate,
    "eventStatus": `https://schema.org/${eventStatus}`,
    "eventAttendanceMode": `https://schema.org/${eventAttendanceMode}`
  };

  if ('url' in location) {
    schema.location = {
      "@type": "VirtualLocation",
      "url": location.url
    };
  } else {
    schema.location = {
      "@type": "Place",
      "name": location.name,
      "address": location.address
    };
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
      "price": offers.price,
      "priceCurrency": offers.currency,
      "availability": `https://schema.org/${offers.availability}`
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
      "@type": itemReviewed.type,
      "name": itemReviewed.name
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": reviewRating,
      "bestRating": 5,
      "worstRating": 1
    },
    "author": {
      "@type": "Person",
      "name": author
    },
    "reviewBody": reviewBody,
    "datePublished": datePublished
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
