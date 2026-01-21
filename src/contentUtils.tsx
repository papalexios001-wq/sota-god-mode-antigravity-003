// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - CONTENT UTILITIES v13.0
// Enterprise-Grade Content Processing with Smart Post-Processing
// =============================================================================

import { TARGET_MIN_WORDS, TARGET_MAX_WORDS, BLOCKED_REFERENCE_DOMAINS, BLOCKED_SPAM_DOMAINS } from './constants';

// ==================== CUSTOM ERRORS ====================

export class ContentTooShortError extends Error {
  wordCount: number;
  constructor(wordCount: number, minRequired: number) {
    super(`Content too short: ${wordCount} words (minimum ${minRequired})`);
    this.name = 'ContentTooShortError';
    this.wordCount = wordCount;
  }
}

export class ContentTooLongError extends Error {
  wordCount: number;
  constructor(wordCount: number, maxAllowed: number) {
    super(`Content too long: ${wordCount} words (maximum ${maxAllowed})`);
    this.name = 'ContentTooLongError';
    this.wordCount = wordCount;
  }
}

// ==================== PROXY FETCH ====================

const CORS_PROXIES = [
  '',
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
];

export const fetchWithProxies = async (
  url: string,
  options: RequestInit = {},
  onProgress?: (message: string) => void
): Promise<Response> => {
  let lastError: Error | null = null;

  for (const proxy of CORS_PROXIES) {
    try {
      const targetUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
      onProgress?.(`Trying: ${proxy || 'direct'}...`);
      
      const response = await fetch(targetUrl, {
        ...options,
        signal: AbortSignal.timeout(30000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SOTA-Bot/1.0)',
          ...options.headers,
        },
      });

      if (response.ok) {
        return response;
      }
    } catch (e: any) {
      lastError = e;
      continue;
    }
  }

  throw lastError || new Error(`Failed to fetch: ${url}`);
};

// ==================== SMART CRAWL ====================

export const smartCrawl = async (url: string): Promise<string> => {
  try {
    const response = await fetchWithProxies(url);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const removeSelectors = [
      'script', 'style', 'noscript', 'iframe', 'nav', 'header', 'footer',
      '.sidebar', '#sidebar', '.menu', '#menu', '.navigation', '.comments',
      '.comment-section', '.related-posts', '.social-share', '.advertisement',
      '.cookie-notice', '.subscribe-form', '.newsletter', '[role="navigation"]',
      '.widget', '.ad', '.ads', '.banner', '.popup', '.modal'
    ];

    removeSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    const mainContent = 
      doc.querySelector('main') ||
      doc.querySelector('article') ||
      doc.querySelector('[role="main"]') ||
      doc.querySelector('.content') ||
      doc.querySelector('#content') ||
      doc.querySelector('.post-content') ||
      doc.querySelector('.entry-content') ||
      doc.querySelector('.article-content') ||
      doc.body;

    return mainContent?.innerHTML || html;
  } catch (error: any) {
    console.error('[smartCrawl] Error:', error);
    throw error;
  }
};

// ==================== WORD COUNT ====================

export const countWords = (html: string): number => {
  const text = html.replace(/<[^>]*>/g, ' ').trim();
  return text.split(/\s+/).filter(word => word.length > 0).length;
};

export const enforceWordCount = (
  html: string,
  minWords: number = TARGET_MIN_WORDS,
  maxWords: number = TARGET_MAX_WORDS
): void => {
  const wordCount = countWords(html);
  if (wordCount < minWords) throw new ContentTooShortError(wordCount, minWords);
  if (wordCount > maxWords) throw new ContentTooLongError(wordCount, maxWords);
};

// ==================== CONTENT NORMALIZATION ====================

export const normalizeGeneratedContent = (html: string): string => {
  let normalized = html
    .replace(/```html\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/<\/?(html|head|body)[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized;
};

// ==================== MARKDOWN TABLE TO HTML CONVERTER ====================

export const convertMarkdownTablesToHtml = (content: string): string => {
  // Pattern to match markdown tables
  const tablePattern = /(?:^|\n)(\|[^\n]+\|\n)(\|[-:|\s]+\|\n)((?:\|[^\n]+\|\n?)+)/gm;
  
  let result = content;
  let match;
  
  while ((match = tablePattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const headerRow = match[1].trim();
    const separatorRow = match[2].trim();
    const bodyRows = match[3].trim();
    
    // Parse header cells
    const headers = headerRow
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);
    
    // Parse body rows
    const rows = bodyRows
      .split('\n')
      .filter(row => row.includes('|'))
      .map(row => 
        row
          .split('|')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0 || row.split('|').length > 2)
      );
    
    // Build HTML table with beautiful styling
    const htmlTable = `
<div style="margin: 2.5rem 0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
  <table style="width: 100%; border-collapse: collapse; background: white;">
    <thead>
      <tr style="background: linear-gradient(135deg, #1E40AF 0%, #7C3AED 100%);">
        ${headers.map(h => `<th style="padding: 1.25rem; color: white; text-align: left; font-weight: 700;">${h}</th>`).join('\n        ')}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#F8FAFC' : 'white'};">
        ${row.map((cell, cellIdx) => `<td style="padding: 1rem; border-bottom: 1px solid #E2E8F0;${cellIdx === 0 ? ' font-weight: 600;' : ''}">${cell}</td>`).join('\n        ')}
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;
    
    result = result.replace(fullMatch, htmlTable);
    console.log('[Table Converter] Converted markdown table to HTML');
  }
  
  // Also fix inline broken table rendering (|---|)
  result = result.replace(/\|---\|---\|---\|/g, '');
  result = result.replace(/\|\s*\|\s*\|\s*\|/g, '');
  
  return result;
};

// ==================== ENHANCED DUPLICATE REMOVAL ====================

export const removeDuplicateSections = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  // Track seen section types
  const seenSections = new Map<string, Element>();
  
  // Enhanced detection patterns
  const sectionPatterns = [
    // Key Takeaways - multiple detection methods
    { 
      type: 'takeaways',
      selectors: [
        '[class*="takeaway"]',
        '[class*="key-takeaway"]',
        'div[style*="#064E3B"]',  // Our gradient color
        'div[style*="#047857"]',
      ],
      textMatch: /key takeaways/i
    },
    // FAQ sections
    { 
      type: 'faq',
      selectors: [
        '[class*="faq"]',
        '[itemtype*="FAQPage"]',
      ],
      textMatch: /frequently asked questions/i
    },
    // References
    { 
      type: 'references',
      selectors: [
        '[class*="reference"]',
        '[class*="sources"]',
      ],
      textMatch: /references|sources|citations/i
    },
    // Verification footer
    { 
      type: 'verification',
      selectors: [
        '.verification-footer-sota',
        '[class*="verification"]',
      ],
      textMatch: /fact-checked|expert reviewed/i
    },
  ];

  // Process each pattern
  sectionPatterns.forEach(({ type, selectors, textMatch }) => {
    const foundElements: Element[] = [];
    
    // Find by selectors
    selectors.forEach(selector => {
      try {
        body.querySelectorAll(selector).forEach(el => {
          if (!foundElements.includes(el)) {
            foundElements.push(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    // Find by text content matching
    if (textMatch) {
      body.querySelectorAll('div, section').forEach(el => {
        const h3 = el.querySelector('h3, h2');
        if (h3 && textMatch.test(h3.textContent || '')) {
          if (!foundElements.includes(el)) {
            foundElements.push(el);
          }
        }
      });
    }
    
    // Keep first, remove duplicates
    foundElements.forEach((el, index) => {
      if (index === 0) {
        seenSections.set(type, el);
        console.log(`[Dedup] Keeping first ${type} section`);
      } else {
        el.remove();
        console.log(`[Dedup] Removed duplicate ${type} section`);
      }
    });
  });

  // Remove duplicate H2 headings with same text
  const h2Map = new Map<string, Element>();
  body.querySelectorAll('h2').forEach(h2 => {
    const text = h2.textContent?.trim().toLowerCase() || '';
    if (text && h2Map.has(text)) {
      const parent = h2.closest('section, div.section, article > div') || h2.parentElement;
      if (parent && parent !== body) {
        parent.remove();
        console.log(`[Dedup] Removed duplicate section: ${text}`);
      }
    } else if (text) {
      h2Map.set(text, h2);
    }
  });

  // Remove SOTA comment markers (for dedup tracking)
  let resultHtml = body.innerHTML;
  resultHtml = resultHtml.replace(/<!--\s*SOTA-TAKEAWAYS-START\s*-->/gi, '');
  resultHtml = resultHtml.replace(/<!--\s*SOTA-TAKEAWAYS-END\s*-->/gi, '');
  resultHtml = resultHtml.replace(/<!--\s*SOTA-FAQ-START\s*-->/gi, '');
  resultHtml = resultHtml.replace(/<!--\s*SOTA-FAQ-END\s*-->/gi, '');

  return resultHtml;
};

// ==================== EXTRACT FAQ FOR SCHEMA ====================

export const extractFaqForSchema = (html: string): Array<{question: string; answer: string}> => {
  const faqs: Array<{question: string; answer: string}> = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Method 1: Schema.org markup
  doc.querySelectorAll('[itemtype*="Question"]').forEach(questionEl => {
    const question = questionEl.querySelector('[itemprop="name"]')?.textContent?.trim();
    const answer = questionEl.querySelector('[itemprop="text"]')?.textContent?.trim();
    if (question && answer) {
      faqs.push({ question, answer });
    }
  });
  
  // Method 2: Details/Summary elements
  if (faqs.length === 0) {
    doc.querySelectorAll('details').forEach(details => {
      const question = details.querySelector('summary')?.textContent?.trim();
      const answerEl = details.querySelector('div, p');
      const answer = answerEl?.textContent?.trim();
      if (question && answer) {
        faqs.push({ question: question.replace(/[\u25BC\u25B6]/g, '').trim(), answer });
      }
    });
  }
  
  console.log(`[FAQ Extractor] Found ${faqs.length} FAQ items`);
  return faqs;
};

// ==================== SMART POST-PROCESSOR ====================

export const smartPostProcess = (html: string): string => {
  console.log('[Post-Processor] Starting smart post-processing...');
  
  let processed = html;
  
  // Step 1: Normalize content (remove code blocks, etc)
  processed = normalizeGeneratedContent(processed);
  console.log('[Post-Processor] Step 1: Normalized content');
  
  // Step 2: Convert markdown tables to HTML
  processed = convertMarkdownTablesToHtml(processed);
  console.log('[Post-Processor] Step 2: Converted markdown tables');
  
  // Step 3: Remove duplicate sections
  processed = removeDuplicateSections(processed);
  console.log('[Post-Processor] Step 3: Removed duplicates');
  
  // Step 4: Sanitize dangerous content
  processed = sanitizeContentHtml(processed);
  console.log('[Post-Processor] Step 4: Sanitized content');
  
  // Step 5: Clean up empty elements
  processed = processed
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<div>\s*<\/div>/g, '')
    .replace(/\n{4,}/g, '\n\n');
  console.log('[Post-Processor] Step 5: Cleaned empty elements');
  
  console.log('[Post-Processor] Complete!');
  return processed;
};

// ==================== VERIFICATION FOOTER ====================

export const generateVerificationFooterHtml = (): string => {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  return `
<div class="verification-footer-sota" style="margin-top: 4rem; padding: 2rem; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 16px; border: 1px solid #cbd5e1; text-align: center;">
  <div style="display: flex; justify-content: center; align-items: center; gap: 2rem; flex-wrap: wrap; margin-bottom: 1rem;">
    <div style="display: flex; align-items: center; gap: 0.5rem; color: #10b981;">
      <span style="font-size: 1.5rem;">✅</span>
      <span style="font-weight: 600;">Fact-Checked</span>
    </div>
    <div style="display: flex; align-items: center; gap: 0.5rem; color: #3b82f6;">
      <span style="font-size: 1.5rem;">📊</span>
      <span style="font-weight: 600;">Data-Driven</span>
    </div>
    <div style="display: flex; align-items: center; gap: 0.5rem; color: #8b5cf6;">
      <span style="font-size: 1.5rem;">🔬</span>
      <span style="font-weight: 600;">Expert Reviewed</span>
    </div>
  </div>
  <p style="margin: 0; color: #64748b; font-size: 0.875rem;">
    Last updated: ${currentDate} | Content verified for ${currentYear}
  </p>
</div>`;
};

// ==================== SURGICAL UPDATE ====================

export const performSurgicalUpdate = (
  originalHtml: string,
  snippets: {
    introHtml?: string;
    faqHtml?: string;
    referencesHtml?: string;
    keyTakeawaysHtml?: string;
    conclusionHtml?: string;
  }
): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(originalHtml, 'text/html');
  const body = doc.body;

  // Remove existing sections before injecting new ones (prevent duplicates)
  if (snippets.keyTakeawaysHtml) {
    body.querySelectorAll('[class*="takeaway"], div[style*="#064E3B"], div[style*="#047857"]').forEach(el => {
      const h3 = el.querySelector('h3');
      if (h3?.textContent?.toLowerCase().includes('takeaway')) {
        el.remove();
        console.log('[Surgical] Removed existing takeaways before injection');
      }
    });
  }

  // Inject intro at beginning
  if (snippets.introHtml) {
    const intro = doc.createElement('div');
    intro.innerHTML = snippets.introHtml;
    intro.className = 'sota-intro-section';
    if (body.firstChild) {
      body.insertBefore(intro, body.firstChild);
    } else {
      body.appendChild(intro);
    }
  }

  // Inject key takeaways after intro (before first H2)
  if (snippets.keyTakeawaysHtml) {
    const takeaways = doc.createElement('div');
    takeaways.innerHTML = snippets.keyTakeawaysHtml;
    takeaways.className = 'sota-takeaways-section';
    
    const firstH2 = body.querySelector('h2');
    if (firstH2 && firstH2.parentNode) {
      firstH2.parentNode.insertBefore(takeaways, firstH2);
    } else {
      const introSection = body.querySelector('.sota-intro-section');
      if (introSection && introSection.nextSibling) {
        body.insertBefore(takeaways, introSection.nextSibling);
      } else {
        body.appendChild(takeaways);
      }
    }
  }

  // Inject FAQ section before conclusion
  if (snippets.faqHtml) {
    const faq = doc.createElement('div');
    faq.innerHTML = snippets.faqHtml;
    faq.className = 'sota-faq-section';
    
    const headings = Array.from(body.querySelectorAll('h2, h3'));
    const conclusionHeading = headings.find(h => 
      h.textContent?.toLowerCase().includes('conclusion') ||
      h.textContent?.toLowerCase().includes('final') ||
      h.textContent?.toLowerCase().includes('summary')
    );
    
    if (conclusionHeading && conclusionHeading.parentNode) {
      conclusionHeading.parentNode.insertBefore(faq, conclusionHeading);
    } else {
      body.appendChild(faq);
    }
  }

  // Inject conclusion at end
  if (snippets.conclusionHtml) {
    const conclusion = doc.createElement('div');
    conclusion.innerHTML = snippets.conclusionHtml;
    conclusion.className = 'sota-conclusion-section';
    body.appendChild(conclusion);
  }

  // Inject references at the very end
  if (snippets.referencesHtml) {
    const refs = doc.createElement('div');
    refs.innerHTML = snippets.referencesHtml;
    refs.className = 'sota-references-section';
    body.appendChild(refs);
  }

  return body.innerHTML;
};

// ==================== YOUTUBE VIDEOS ====================

const YOUTUBE_SEARCH_CACHE = new Map<string, any[]>();

export const getGuaranteedYoutubeVideos = async (
  keyword: string,
  serperApiKey: string,
  count: number = 2
): Promise<Array<{ videoId: string; title: string }>> => {
  if (!serperApiKey) return [];

  const cacheKey = `${keyword}_${count}`;
  if (YOUTUBE_SEARCH_CACHE.has(cacheKey)) {
    return YOUTUBE_SEARCH_CACHE.get(cacheKey)!;
  }

  try {
    const response = await fetchWithProxies('https://google.serper.dev/videos', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: keyword, num: 10 }),
    });

    const data = await response.json();
    const videos: Array<{ videoId: string; title: string }> = [];

    for (const video of data.videos || []) {
      if (videos.length >= count) break;
      if (video.link?.includes('youtube.com/watch?v=')) {
        const videoId = video.link.split('v=')[1]?.split('&')[0];
        if (videoId) {
          videos.push({ videoId, title: video.title });
        }
      }
    }

    YOUTUBE_SEARCH_CACHE.set(cacheKey, videos);
    return videos;
  } catch (error) {
    console.error('[getGuaranteedYoutubeVideos] Error:', error);
    return [];
  }
};

export const generateYoutubeEmbedHtml = (videos: Array<{ videoId: string; title: string }>): string => {
  if (videos.length === 0) return '';

  const embedsHtml = videos.map(video => `
    <div style="margin: 1.5rem 0;">
      <iframe 
        width="100%" 
        height="400" 
        src="https://www.youtube.com/embed/${video.videoId}" 
        title="${video.title}"
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen
        loading="lazy"
        style="border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);"
      ></iframe>
      <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #64748b; text-align: center;">
        ${video.title}
      </p>
    </div>
  `).join('');

  return `
<div class="sota-video-section" style="margin: 3rem 0; padding: 2rem; background: #f8fafc; border-radius: 16px;">
  <h3 style="margin-top: 0; font-size: 1.5rem; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
    <span>🎬</span> Related Videos
  </h3>
  ${embedsHtml}
</div>`;
};

// ==================== DOMAIN VALIDATION ====================

export const isBlockedDomain = (url: string): boolean => {
  try {
    const domain = new URL(url).hostname.replace('www.', '').toLowerCase();
    if (BLOCKED_REFERENCE_DOMAINS.some(blocked => domain.includes(blocked))) return true;
    if (BLOCKED_SPAM_DOMAINS.some(blocked => domain.includes(blocked))) return true;
    return false;
  } catch {
    return true;
  }
};

// ==================== HTML SANITIZATION ====================

export const sanitizeContentHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const dangerousSelectors = ['script', 'style:not([type])', 'iframe[src*="javascript"]', 'object', 'embed'];
  dangerousSelectors.forEach(selector => {
    try {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    } catch (e) {}
  });

  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
      if (attr.value.toLowerCase().includes('javascript:')) el.removeAttribute(attr.name);
    });
  });

  return doc.body.innerHTML;
};

// ==================== INTERNAL LINK PROCESSING ====================

export const processInternalLinkCandidates = (
  content: string,
  availablePages: Array<{ title: string; slug: string }>,
  baseUrl: string,
  maxLinks: number = 12
): string => {
  const linkPattern = /\[LINK_CANDIDATE:\s*([^\]]+)\]/g;
  let processedContent = content;
  let linkCount = 0;
  const usedSlugs = new Set<string>();

  processedContent = processedContent.replace(linkPattern, (match, anchorText) => {
    if (linkCount >= maxLinks) return anchorText;

    const targetPage = findBestMatchingPage(anchorText.trim(), availablePages, usedSlugs);
    
    if (targetPage) {
      linkCount++;
      usedSlugs.add(targetPage.slug);
      const url = `${baseUrl.replace(/\/+$/, '')}/${targetPage.slug}`;
      return `<a href="${url}" title="${targetPage.title}">${anchorText}</a>`;
    }
    
    return anchorText;
  });

  console.log(`[Internal Links] Added ${linkCount} links`);
  return processedContent;
};

function findBestMatchingPage(
  anchorText: string,
  pages: Array<{ title: string; slug: string }>,
  usedSlugs: Set<string>
): { title: string; slug: string } | null {
  const anchorWords = anchorText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (anchorWords.length === 0) return null;

  let bestMatch: { title: string; slug: string } | null = null;
  let bestScore = 0;

  for (const page of pages) {
    if (usedSlugs.has(page.slug)) continue;

    const titleWords = page.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const slugWords = page.slug.toLowerCase().split('-').filter(w => w.length > 3);
    const allPageWords = [...titleWords, ...slugWords];
    
    const matchingWords = anchorWords.filter(w => 
      allPageWords.some(pw => pw.includes(w) || w.includes(pw))
    );
    
    const score = matchingWords.length / Math.max(anchorWords.length, 1);
    
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestMatch = page;
    }
  }

  return bestMatch;
}

// ==================== IMAGE HANDLING ====================

export const extractImagesFromHtml = (html: string): Array<{ src: string; alt: string; title?: string }> => {
  const images: Array<{ src: string; alt: string; title?: string }> = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:image/svg')) {
      images.push({
        src,
        alt: img.getAttribute('alt') || '',
        title: img.getAttribute('title') || undefined,
      });
    }
  });

  doc.querySelectorAll('iframe').forEach(iframe => {
    const src = iframe.getAttribute('src') || '';
    if (src.includes('youtube.com') || src.includes('vimeo.com')) {
      images.push({
        src,
        alt: iframe.getAttribute('title') || 'Embedded video',
        title: iframe.getAttribute('title') || undefined,
      });
    }
  });

  return images;
};

export const injectImagesIntoContent = (
  content: string,
  images: Array<{ src: string; alt: string; title?: string }>,
  maxImages: number = 10
): string => {
  if (images.length === 0) return content;

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const body = doc.body;
  
  const h2s = Array.from(body.querySelectorAll('h2'));
  const imagesToInject = images.slice(0, maxImages);
  
  imagesToInject.forEach((img, idx) => {
    const targetH2Index = idx % Math.max(h2s.length, 1);
    const targetH2 = h2s[targetH2Index];
    
    if (targetH2) {
      const imgEl = doc.createElement('img');
      imgEl.src = img.src;
      imgEl.alt = img.alt;
      if (img.title) imgEl.title = img.title;
      imgEl.loading = 'lazy';
      imgEl.style.cssText = 'width: 100%; height: auto; border-radius: 12px; margin: 1.5rem 0; box-shadow: 0 4px 15px rgba(0,0,0,0.1);';
      
      const figure = doc.createElement('figure');
      figure.style.cssText = 'margin: 2rem 0; text-align: center;';
      figure.appendChild(imgEl);
      
      if (img.alt && img.alt !== 'Embedded video') {
        const caption = doc.createElement('figcaption');
        caption.style.cssText = 'margin-top: 0.5rem; font-size: 0.875rem; color: #64748b; font-style: italic;';
        caption.textContent = img.alt;
        figure.appendChild(caption);
      }
      
      const nextSibling = targetH2.nextElementSibling;
      if (nextSibling?.nextSibling) {
        nextSibling.parentNode?.insertBefore(figure, nextSibling.nextSibling);
      } else if (targetH2.nextSibling) {
        targetH2.parentNode?.insertBefore(figure, targetH2.nextSibling);
      }
    }
  });

  console.log(`[Image Injection] Injected ${imagesToInject.length} images`);
  return body.innerHTML;
};

// ==================== TABLE GENERATION ====================

export const generateComparisonTableHtml = (
  headers: string[],
  rows: string[][],
  caption?: string
): string => {
  const headerHtml = headers.map(h => `<th style="padding: 1.25rem; color: white; text-align: left; font-weight: 700;">${h}</th>`).join('');
  
  const rowsHtml = rows.map((row, idx) => {
    const bgColor = idx % 2 === 0 ? '#F8FAFC' : 'white';
    const cellsHtml = row.map((cell, cellIdx) => `<td style="padding: 1rem; border-bottom: 1px solid #E2E8F0;${cellIdx === 0 ? ' font-weight: 600;' : ''}">${cell}</td>`).join('');
    return `<tr style="background: ${bgColor};">${cellsHtml}</tr>`;
  }).join('');

  return `
<div style="margin: 2.5rem 0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
  ${caption ? `<p style="font-weight: 600; margin-bottom: 1rem; color: #1e293b;">${caption}</p>` : ''}
  <table style="width: 100%; border-collapse: collapse; background: white;">
    <thead>
      <tr style="background: linear-gradient(135deg, #1E40AF 0%, #7C3AED 100%);">${headerHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</div>`;
};

// ==================== READABILITY ====================

export const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
};

export const calculateFleschReadability = (text: string): number => {
  if (!text || text.trim().length === 0) return 100;
  const words: string[] = text.match(/\b\w+\b/g) || [];
  const wordCount = words.length;
  if (wordCount < 100) return 100;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const sentenceCount = sentences.length || 1;
  const syllables = words.reduce((acc, word) => {
    let currentWord = word.toLowerCase();
    if (currentWord.length <= 3) return acc + 1;
    currentWord = currentWord.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const syllableMatches = currentWord.match(/[aeiouy]{1,2}/g);
    return acc + (syllableMatches ? syllableMatches.length : 0);
  }, 0);
  const score = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllables / wordCount);
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const getReadabilityVerdict = (score: number): { verdict: string, color: string } => {
  if (score >= 90) return { verdict: 'Very Easy', color: '#10B981' };
  if (score >= 80) return { verdict: 'Easy', color: '#10B981' };
  if (score >= 70) return { verdict: 'Fairly Easy', color: '#34D399' };
  if (score >= 60) return { verdict: 'Standard', color: '#FBBF24' };
  if (score >= 50) return { verdict: 'Fairly Difficult', color: '#F59E0B' };
  if (score >= 30) return { verdict: 'Difficult', color: '#EF4444' };
  return { verdict: 'Very Difficult', color: '#DC2626' };
};

export const extractYouTubeID = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// ==================== EXPORTS ====================

export default {
  fetchWithProxies,
  smartCrawl,
  countWords,
  enforceWordCount,
  normalizeGeneratedContent,
  convertMarkdownTablesToHtml,
  generateVerificationFooterHtml,
  performSurgicalUpdate,
  getGuaranteedYoutubeVideos,
  generateYoutubeEmbedHtml,
  isBlockedDomain,
  sanitizeContentHtml,
  removeDuplicateSections,
  smartPostProcess,
  extractFaqForSchema,
  processInternalLinkCandidates,
  extractImagesFromHtml,
  injectImagesIntoContent,
  generateComparisonTableHtml,
};
