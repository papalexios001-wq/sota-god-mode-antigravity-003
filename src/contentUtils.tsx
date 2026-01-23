// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - CONTENT UTILITIES v15.0
// ENTERPRISE GRADE: Strict Anchor Validation + Zone-Based Link Distribution
// =============================================================================

import { 
  TARGET_MIN_WORDS, 
  TARGET_MAX_WORDS, 
  BLOCKED_REFERENCE_DOMAINS, 
  BLOCKED_SPAM_DOMAINS 
} from './constants';

// ==================== TYPE DEFINITIONS ====================

export interface ExistingPage {
  title: string;
  slug: string;
  id?: string;
}

export interface AnchorValidationResult {
  valid: boolean;
  reason: string;
  score: number;
}

export interface ProcessedLinkResult {
  content: string;
  injectedCount: number;
  rejectedCount: number;
  rejectedAnchors: string[];
  acceptedAnchors: string[];
}

export interface CrawlResult {
  title: string;
  content: string;
  metaDescription: string;
  headings: string[];
  images: { src: string; alt: string }[];
  wordCount: number;
}

// ==================== ANCHOR TEXT VALIDATION CONSTANTS ====================

const ANCHOR_BOUNDARY_STOPWORDS = new Set([
  'the', 'a', 'an',
  'and', 'or', 'but', 'nor', 'so', 'yet', 'for',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'about', 'over',
  'is', 'was', 'are', 'were', 'been', 'be', 'being', 'am',
  "isn't", "aren't", "wasn't", "weren't",
  'have', 'has', 'had', "hasn't", "haven't", "hadn't",
  'do', 'does', 'did', "don't", "doesn't", "didn't",
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
  "won't", "wouldn't", "couldn't", "shouldn't", "can't", "cannot",
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'their', 'them',
  'he', 'she', 'him', 'her', 'his', 'hers', 'we', 'us', 'our', 'ours',
  'you', 'your', 'yours', 'i', 'me', 'my', 'mine', 'who', 'whom', 'whose',
  'what', 'which', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'any', 'many', 'much', 'several',
  'not', 'only', 'very', 'just', 'also', 'now', 'here', 'there',
  'too', 'really', 'quite', 'extremely', 'highly', 'already', 'still',
  'own', 'same', 'than', 'if', 'unless', 'although', 'because', 'since', 'while',
]);

const TOXIC_ANCHOR_PATTERNS = new Set([
  'click here', 'read more', 'learn more', 'find out more', 'find out',
  'check out', 'check it out', 'this article', 'this guide', 'this post',
  'this page', 'this link', 'this resource', 'here', 'link', 'website',
  'site', 'page', 'more info', 'more information', 'click', 'tap here',
  'go here', 'see more', 'view more', 'continue reading', 'read this',
  'see this', 'visit', 'visit here',
]);

const REQUIRED_DESCRIPTIVE_WORDS = new Set([
  'guide', 'tutorial', 'tips', 'strategies', 'techniques', 'methods', 'steps',
  'practices', 'approach', 'framework', 'system', 'process', 'checklist',
  'resources', 'tools', 'benefits', 'solutions', 'recommendations', 'insights',
  'overview', 'basics', 'fundamentals', 'essentials', 'introduction', 'advanced',
  'best', 'complete', 'comprehensive', 'ultimate', 'proven', 'effective',
  'essential', 'professional', 'expert', 'beginner',
  'care', 'training', 'health', 'nutrition', 'grooming', 'behavior', 'breed',
  'puppy', 'dog', 'pet', 'animal', 'food', 'diet', 'exercise', 'wellness',
  'marketing', 'seo', 'content', 'strategy', 'optimization', 'conversion',
  'analytics', 'growth', 'revenue', 'sales', 'business', 'startup',
  'information', 'advice', 'secrets', 'mistakes', 'problems', 'issues', 'ways',
  'reasons', 'facts', 'myths', 'signs', 'symptoms', 'causes', 'treatments',
  'examples', 'templates', 'samples', 'ideas', 'inspiration',
]);

const SEO_POWER_PATTERNS = [
  { pattern: /\b(complete|comprehensive|ultimate|definitive)\s+\w+\s+guide\b/i, boost: 25 },
  { pattern: /\b(step[- ]by[- ]step|how[- ]to)\s+\w+/i, boost: 20 },
  { pattern: /\b(best|top|proven|effective)\s+(practices|strategies|techniques|methods|tips)/i, boost: 22 },
  { pattern: /\b(beginner|advanced|expert|professional)\s+\w+\s+(guide|tips|tutorial)/i, boost: 18 },
  { pattern: /\b(essential|critical|important)\s+\w+\s+(tips|strategies|guide)/i, boost: 15 },
  { pattern: /\bfor\s+(beginners|professionals|experts|small business|startups)/i, boost: 12 },
];

const ENHANCED_STOP_WORDS = new Set([
  'with', 'from', 'that', 'this', 'your', 'what', 'when', 'where', 'which', 'have',
  'been', 'were', 'will', 'would', 'could', 'should', 'about', 'into', 'through',
  'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'these', 'those', 'other', 'some', 'such',
  'only', 'same', 'than', 'very', 'just', 'also', 'most', 'more', 'much',
  'each', 'every', 'both', 'while', 'being', 'having', 'doing', 'made', 'make',
  'like', 'even', 'back', 'still', 'well', 'take', 'come', 'over', 'think',
  'good', 'know', 'want', 'give', 'find', 'tell', 'become', 'leave', 'feel',
  'seem', 'look', 'need', 'keep', 'mean', 'help', 'show', 'hear', 'play',
  'move', 'live', 'believe', 'hold', 'bring', 'happen', 'write', 'provide'
]);

const SEMANTIC_VARIATIONS: Record<string, string[]> = {
  'price': ['cost', 'pricing', 'fee', 'rate', 'charge', 'expense'],
  'cost': ['price', 'pricing', 'fee', 'expense', 'charge'],
  'buy': ['purchase', 'acquire', 'order', 'shop', 'get'],
  'purchase': ['buy', 'acquire', 'order', 'shop'],
  'review': ['reviews', 'rating', 'ratings', 'feedback', 'opinion'],
  'best': ['top', 'excellent', 'premium', 'quality', 'greatest'],
  'guide': ['tutorial', 'howto', 'instructions', 'manual', 'tips'],
  'tutorial': ['guide', 'howto', 'lesson', 'course', 'training'],
  'benefits': ['advantages', 'pros', 'perks', 'upsides'],
  'features': ['specs', 'specifications', 'capabilities', 'functions'],
  'comparison': ['compare', 'versus', 'difference', 'alternative'],
  'alternative': ['option', 'substitute', 'replacement', 'choice'],
  'health': ['wellness', 'wellbeing', 'medical', 'healthcare'],
  'training': ['exercise', 'workout', 'practice', 'coaching'],
  'care': ['maintenance', 'upkeep', 'looking after', 'tending'],
};

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

// ==================== UTILITY FUNCTIONS ====================

export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const extractSlugFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(s => s.length > 0);
    return segments[segments.length - 1] || '';
  } catch {
    const segments = url.split('/').filter(s => s.length > 0);
    return segments[segments.length - 1] || url;
  }
};

const simpleStem = (word: string): string => {
  const w = word.toLowerCase();
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('tion')) return w.slice(0, -4);
  if (w.endsWith('sion')) return w.slice(0, -4);
  if (w.endsWith('ness')) return w.slice(0, -4);
  if (w.endsWith('ment')) return w.slice(0, -4);
  if (w.endsWith('able')) return w.slice(0, -4);
  if (w.endsWith('ible')) return w.slice(0, -4);
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ly') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
};

// ==================== STRICT ANCHOR TEXT VALIDATION ====================

export const validateAnchorTextStrict = (
  anchor: string,
  minWords: number = 4,
  maxWords: number = 7
): AnchorValidationResult => {
  if (!anchor || typeof anchor !== 'string') {
    return { valid: false, reason: 'Empty or invalid anchor text', score: 0 };
  }

  const cleanAnchor = anchor.trim()
    .replace(/[.,!?;:]+$/, '')
    .replace(/^[.,!?;:\-–—"']+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanAnchor.split(/\s+/).filter(w => w.length > 0);

  if (words.length < minWords) {
    return { valid: false, reason: `Too short: ${words.length} words, need ${minWords}-${maxWords}`, score: 0 };
  }
  
  if (words.length > maxWords) {
    return { valid: false, reason: `Too long: ${words.length} words, max ${maxWords}`, score: 0 };
  }

  const anchorLower = cleanAnchor.toLowerCase();
  for (const toxic of TOXIC_ANCHOR_PATTERNS) {
    if (anchorLower.includes(toxic)) {
      return { valid: false, reason: `Contains generic/toxic phrase: "${toxic}"`, score: 0 };
    }
  }

  const firstWord = words[0].toLowerCase().replace(/[^a-z']/g, '');
  if (ANCHOR_BOUNDARY_STOPWORDS.has(firstWord)) {
    return { valid: false, reason: `Cannot START with stopword: "${firstWord}"`, score: 0 };
  }

  const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z']/g, '');
  if (ANCHOR_BOUNDARY_STOPWORDS.has(lastWord)) {
    return { valid: false, reason: `Cannot END with stopword: "${lastWord}"`, score: 0 };
  }

  const fragmentPatterns = [
    /\b(is|are|was|were|isn't|aren't|wasn't|weren't)$/i,
    /\b(can|could|will|would|should|might|may|must)$/i,
    /\b(have|has|had|do|does|did)$/i,
    /\b(and|or|but|that|which|who|when|where|why|how)$/i,
    /\b(very|really|quite|extremely|highly|so|too)$/i,
    /\b(the|a|an)$/i,
    /\b(if|unless|although|because|since|while|whether)$/i,
    /\b(than|as|like)$/i,
  ];
  
  for (const pattern of fragmentPatterns) {
    if (pattern.test(cleanAnchor)) {
      return { valid: false, reason: `Incomplete sentence fragment detected`, score: 0 };
    }
  }

  const badStartPatterns = [
    /^(and|but|or|so|yet|for|nor)\s/i,
    /^(that|which|who|whom|whose|when|where|why|how)\s/i,
    /^(if|unless|although|because|since|while|whether)\s/i,
    /^(very|really|quite|extremely|highly)\s/i,
  ];
  
  for (const pattern of badStartPatterns) {
    if (pattern.test(cleanAnchor)) {
      return { valid: false, reason: `Cannot start with conjunction/relative/adverb word`, score: 0 };
    }
  }

  const hasDescriptiveWord = words.some(w => 
    REQUIRED_DESCRIPTIVE_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ''))
  );
  
  if (!hasDescriptiveWord) {
    return { valid: false, reason: `Missing descriptive word`, score: 0 };
  }

  const meaningfulWords = words.filter(w => 
    !ANCHOR_BOUNDARY_STOPWORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')) && w.length > 2
  );
  
  if (meaningfulWords.length < 2) {
    return { valid: false, reason: `Too few meaningful words (need 2+)`, score: 0 };
  }

  let score = 50;
  if (words.length >= 4 && words.length <= 6) score += 15;
  else if (words.length === 7) score += 8;
  
  for (const { pattern, boost } of SEO_POWER_PATTERNS) {
    if (pattern.test(cleanAnchor)) {
      score += boost;
      break;
    }
  }
  
  const descriptiveCount = words.filter(w =>
    REQUIRED_DESCRIPTIVE_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ''))
  ).length;
  score += Math.min(descriptiveCount * 5, 15);

  return { valid: true, reason: 'Passes all validation checks', score: Math.min(100, score) };
};

export const validateAndFixAnchor = (
  anchor: string
): { valid: boolean; anchor: string; reason: string } => {
  const validation = validateAnchorTextStrict(anchor);
  
  if (validation.valid) {
    return { valid: true, anchor: anchor.trim(), reason: 'Valid' };
  }
  
  let fixed = anchor.trim();
  const words = fixed.split(/\s+/);
  
  while (words.length > 4 && ANCHOR_BOUNDARY_STOPWORDS.has(words[0].toLowerCase().replace(/[^a-z]/g, ''))) {
    words.shift();
  }
  
  while (words.length > 4 && ANCHOR_BOUNDARY_STOPWORDS.has(words[words.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) {
    words.pop();
  }
  
  fixed = words.join(' ');
  
  const revalidation = validateAnchorTextStrict(fixed);
  if (revalidation.valid) {
    return { valid: true, anchor: fixed, reason: 'Fixed and valid' };
  }
  
  return { valid: false, anchor: anchor, reason: validation.reason };
};

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

// ==================== MARKDOWN TABLE TO HTML ====================

export const convertMarkdownTablesToHtml = (content: string): string => {
  const tablePattern = /(?:^|\n)(\|[^\n]+\|\n)(\|[-:|\s]+\|\n)((?:\|[^\n]+\|\n?)+)/gm;
  
  let result = content;
  let match;
  
  while ((match = tablePattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const headerRow = match[1].trim();
    const bodyRows = match[3].trim();
    
    const headers = headerRow.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
    const rows = bodyRows.split('\n').filter(row => row.includes('|')).map(row => 
      row.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0 || row.split('|').length > 2)
    );
    
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
  }
  
  result = result.replace(/\|---\|---\|---\|/g, '');
  result = result.replace(/\|\s*\|\s*\|\s*\|/g, '');
  
  return result;
};

// ==================== LINK CANDIDATE PROCESSING ====================

export const processLinkCandidatesStrict = (
  content: string,
  availablePages: ExistingPage[],
  baseUrl: string
): ProcessedLinkResult => {
  const linkCandidateRegex = /\[LINK_CANDIDATE:\s*([^\]]+)\]/gi;
  let injectedCount = 0;
  let rejectedCount = 0;
  const rejectedAnchors: string[] = [];
  const acceptedAnchors: string[] = [];
  const usedSlugs = new Set<string>();

  const sortedPages = [...availablePages].sort((a, b) => b.title.length - a.title.length);

  const processedContent = content.replace(linkCandidateRegex, (match, anchorText) => {
    const anchor = anchorText.trim();

    const validation = validateAnchorTextStrict(anchor);

    if (!validation.valid) {
      rejectedAnchors.push(`"${anchor}" - ${validation.reason}`);
      rejectedCount++;
      return anchor;
    }

    const anchorLower = anchor.toLowerCase();
    let matchedPage: ExistingPage | null = null;

    for (const page of sortedPages) {
      if (usedSlugs.has(page.slug)) continue;

      const titleWords = page.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const anchorWords = anchorLower.split(/\s+/).filter(w => w.length > 3);

      const overlap = anchorWords.filter(w =>
        titleWords.some(tw => tw.includes(w) || w.includes(tw))
      );

      if (overlap.length >= 1) {
        matchedPage = page;
        break;
      }
    }

    if (!matchedPage) {
      matchedPage = sortedPages.find(p => !usedSlugs.has(p.slug)) || null;
    }

    if (matchedPage) {
      usedSlugs.add(matchedPage.slug);
      const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
      const targetUrl = `${cleanBaseUrl}/${matchedPage.slug}/`;
      injectedCount++;
      acceptedAnchors.push(anchor);
      return `<a href="${targetUrl}" title="${matchedPage.title}" style="color: #1E40AF; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 2px; font-weight: 500;">${anchor}</a>`;
    }

    rejectedAnchors.push(`"${anchor}" - No available target page`);
    rejectedCount++;
    return anchor;
  });

  return { content: processedContent, injectedCount, rejectedCount, rejectedAnchors, acceptedAnchors };
};

// ==================== FORCE NATURAL INTERNAL LINKS ====================

export const forceNaturalInternalLinks = (
  content: string,
  availablePages: ExistingPage[],
  baseUrl: string,
  targetLinks: number = 10
): string => {
  if (availablePages.length === 0) return content;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const body = doc.body;
  
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const usedSlugs = new Set<string>();
  let linksAdded = 0;
  
  body.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    const match = href.match(/\/([^\/]+)\/?$/);
    if (match) usedSlugs.add(match[1]);
  });
  
  const textContainers = Array.from(body.querySelectorAll('p, li')).filter(el => {
    const existingLinks = el.querySelectorAll('a').length;
    if (existingLinks >= 2) return false;
    if (el.closest('.sota-faq-section, .sota-references-section, .sota-references-wrapper, [class*="faq"], [class*="reference"], .verification-footer-sota')) return false;
    const textLength = el.textContent?.length || 0;
    return textLength > 80;
  });
  
  interface KeywordPageMapping {
    keywords: string[];
    page: ExistingPage;
    priority: number;
  }
  
  const keywordPageMap: KeywordPageMapping[] = [];
  
  for (const page of availablePages) {
    if (usedSlugs.has(page.slug)) continue;
    
    const titleWords = page.title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !ENHANCED_STOP_WORDS.has(w));
    
    const slugWords = page.slug.toLowerCase().split('-').filter(w => w.length > 3);
    
    const phrases: string[] = [];
    for (let i = 0; i < titleWords.length - 1; i++) {
      phrases.push(`${titleWords[i]} ${titleWords[i + 1]}`);
      if (i < titleWords.length - 2) {
        phrases.push(`${titleWords[i]} ${titleWords[i + 1]} ${titleWords[i + 2]}`);
      }
    }
    
    const keywords = [...new Set([...titleWords, ...slugWords, ...phrases])];
    
    if (keywords.length > 0) {
      const priority = page.title.split(' ').length;
      keywordPageMap.push({ keywords, page, priority });
    }
  }
  
  keywordPageMap.sort((a, b) => b.priority - a.priority);
  
  for (const container of textContainers) {
    if (linksAdded >= targetLinks) break;
    
    const originalHtml = container.innerHTML;
    
    for (const { keywords, page } of keywordPageMap) {
      if (usedSlugs.has(page.slug)) continue;
      if (linksAdded >= targetLinks) break;
      
      let bestAnchor = '';
      let bestScore = 0;
      
      const words = (container.textContent || '').split(/\s+/);
      
      for (let startIdx = 0; startIdx < words.length - 3; startIdx++) {
        for (let len = 4; len <= Math.min(6, words.length - startIdx); len++) {
          const phraseWords = words.slice(startIdx, startIdx + len);
          const potentialAnchor = phraseWords.join(' ').replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').trim();
          
          const phraseLower = potentialAnchor.toLowerCase();
          const hasKeyword = keywords.some(kw => phraseLower.includes(kw));
          
          if (!hasKeyword) continue;
          
          const validation = validateAnchorTextStrict(potentialAnchor);
          
          if (validation.valid && validation.score > bestScore) {
            bestScore = validation.score;
            bestAnchor = potentialAnchor;
          }
        }
      }
      
      if (bestAnchor && bestScore >= 50) {
        const url = `${cleanBaseUrl}/${page.slug}/`;
        const linkHtml = `<a href="${url}" title="${page.title}" style="color: #1E40AF; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 2px; font-weight: 500;">${bestAnchor}</a>`;
        
        const escapedAnchor = escapeRegExp(bestAnchor);
        const regex = new RegExp(`(?<!<a[^>]*>)(?<!<[^>]*)\\b(${escapedAnchor})\\b(?![^<]*<\\/a>)`, 'i');
        const newHtml = container.innerHTML.replace(regex, linkHtml);
        
        if (newHtml !== originalHtml && newHtml.includes(url)) {
          container.innerHTML = newHtml;
          usedSlugs.add(page.slug);
          linksAdded++;
          break;
        }
      }
    }
  }
  
  return body.innerHTML;
};

// ==================== PROCESS INTERNAL LINKS (MAIN EXPORT) ====================

export const processInternalLinks = (
  content: string,
  existingPages: Array<{ id?: string; title: string; slug?: string }>,
  baseUrl?: string
): string => {
  if (!content || !existingPages || existingPages.length === 0) {
    return content;
  }

  const cleanBaseUrl = (baseUrl || '').replace(/\/+$/, '');
  
  const normalizedPages: ExistingPage[] = existingPages.map(p => ({
    title: p.title,
    slug: p.slug || extractSlugFromUrl(p.id || ''),
  })).filter(p => p.slug && p.title);

  const { content: processedContent, injectedCount } = processLinkCandidatesStrict(
    content, 
    normalizedPages, 
    cleanBaseUrl
  );

  const parser = new DOMParser();
  const doc = parser.parseFromString(processedContent, 'text/html');
  const currentLinkCount = doc.body.querySelectorAll('a[href]').length;
  const targetTotal = 12;
  const remainingLinks = Math.max(0, targetTotal - currentLinkCount);

  const usedSlugs = new Set<string>();
  doc.body.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    const match = href.match(/\/([^\/]+)\/?$/);
    if (match) usedSlugs.add(match[1]);
  });

  const remainingPages = normalizedPages.filter(p => !usedSlugs.has(p.slug));

  if (remainingLinks > 0 && remainingPages.length > 0) {
    return forceNaturalInternalLinks(processedContent, remainingPages, cleanBaseUrl, remainingLinks);
  }

  return processedContent;
};

export const processInternalLinkCandidates = (
  content: string,
  availablePages: ExistingPage[],
  baseUrl: string,
  maxLinks: number = 12
): string => {
  const { content: processedContent } = processLinkCandidatesStrict(content, availablePages, baseUrl);

  const usedSlugs = new Set<string>();
  const parser = new DOMParser();
  const doc = parser.parseFromString(processedContent, 'text/html');
  doc.body.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    const match = href.match(/\/([^\/]+)\/?$/);
    if (match) usedSlugs.add(match[1]);
  });
  
  const remainingPages = availablePages.filter(p => !usedSlugs.has(p.slug));
  const currentLinkCount = usedSlugs.size;
  const remainingLinks = Math.max(0, maxLinks - currentLinkCount);
  
  if (remainingLinks > 0 && remainingPages.length > 0) {
    return forceNaturalInternalLinks(processedContent, remainingPages, baseUrl, remainingLinks);
  }
  
  return processedContent;
};

export const injectNaturalInternalLinks = forceNaturalInternalLinks;

// ==================== DUPLICATE REMOVAL ====================

export const removeDuplicateSections = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  const seenSections = new Map<string, Element>();
  
  const sectionPatterns = [
    { type: 'takeaways', selectors: ['[class*="takeaway"]', 'div[style*="#064E3B"]', 'div[style*="#047857"]'], textMatch: /key takeaways/i },
    { type: 'faq', selectors: ['[class*="faq"]', '[itemtype*="FAQPage"]'], textMatch: /frequently asked questions/i },
    { type: 'references', selectors: ['[class*="reference"]', '[class*="sources"]', '.sota-references-section'], textMatch: /references|sources|citations|further reading/i },
    { type: 'verification', selectors: ['.verification-footer-sota', '[class*="verification"]'], textMatch: /fact-checked|expert reviewed/i },
  ];

  sectionPatterns.forEach(({ type, selectors, textMatch }) => {
    const foundElements: Element[] = [];
    
    selectors.forEach(selector => {
      try {
        body.querySelectorAll(selector).forEach(el => {
          if (!foundElements.includes(el)) foundElements.push(el);
        });
      } catch (e) {}
    });
    
    if (textMatch) {
      body.querySelectorAll('div, section').forEach(el => {
        const h3 = el.querySelector('h3, h2');
        if (h3 && textMatch.test(h3.textContent || '')) {
          if (!foundElements.includes(el)) foundElements.push(el);
        }
      });
    }
    
    foundElements.forEach((el, index) => {
      if (index === 0) {
        seenSections.set(type, el);
      } else {
        el.remove();
      }
    });
  });

  const h2Map = new Map<string, Element>();
  body.querySelectorAll('h2').forEach(h2 => {
    const text = h2.textContent?.trim().toLowerCase() || '';
    if (text && h2Map.has(text)) {
      const parent = h2.closest('section, div.section, article > div') || h2.parentElement;
      if (parent && parent !== body) {
        parent.remove();
      }
    } else if (text) {
      h2Map.set(text, h2);
    }
  });

  const headingsToCheck = Array.from(body.querySelectorAll('h2, h3, h4, strong'));
  headingsToCheck.forEach(heading => {
    const text = (heading.textContent || '').toLowerCase();
    if (text.includes('internal link') || text.includes('related resources') || text.includes('related links') ||
        text.includes('more resources') || text.includes('useful links') || text.includes('helpful links')) {
      
      let container = heading.closest('section, div.section, article > div');
      let elementsToRemove: Element[] = [];
      
      if (container && container !== body) {
        const listItems = container.querySelectorAll('li, a').length;
        if (listItems > 2) elementsToRemove.push(container);
      }
      
      if (elementsToRemove.length === 0) {
        elementsToRemove.push(heading);
        let sibling = heading.nextElementSibling;
        while (sibling && !['H2', 'H3', 'H4'].includes(sibling.tagName)) {
          elementsToRemove.push(sibling);
          sibling = sibling.nextElementSibling;
        }
      }
      
      elementsToRemove.forEach(el => {
        if (el.parentNode) el.remove();
      });
    }
  });

  let resultHtml = body.innerHTML;
  resultHtml = resultHtml.replace(/<!--\s*SOTA-[A-Z]+-START\s*-->/gi, '');
  resultHtml = resultHtml.replace(/<!--\s*SOTA-[A-Z]+-END\s*-->/gi, '');

  return resultHtml;
};

// ==================== EXTRACT FAQ FOR SCHEMA ====================

export const extractFaqForSchema = (html: string): Array<{question: string; answer: string}> => {
  const faqs: Array<{question: string; answer: string}> = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  doc.querySelectorAll('[itemtype*="Question"]').forEach(questionEl => {
    const question = questionEl.querySelector('[itemprop="name"]')?.textContent?.trim();
    const answer = questionEl.querySelector('[itemprop="text"]')?.textContent?.trim();
    if (question && answer) faqs.push({ question, answer });
  });
  
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
  
  return faqs;
};

// ==================== SMART POST-PROCESSOR ====================

export const smartPostProcess = (html: string): string => {
  let processed = html;
  processed = normalizeGeneratedContent(processed);
  processed = convertMarkdownTablesToHtml(processed);
  processed = removeDuplicateSections(processed);
  processed = sanitizeContentHtml(processed);
  processed = processed.replace(/<p>\s*<\/p>/g, '').replace(/<div>\s*<\/div>/g, '').replace(/\n{4,}/g, '\n\n');
  return processed;
};

// ==================== VERIFICATION FOOTER ====================

export const generateVerificationFooterHtml = (): string => {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  return `
<div class="verification-footer-sota" style="margin-top: 4rem; padding: 2rem; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 16px; border: 1px solid #cbd5e1; text-align: center;">
  <div style="display: flex; justify-content: center; align-items: center; gap: 2rem; flex-wrap: wrap; margin-bottom: 1rem;">
    <div style="display: flex; align-items: center; gap: 0.5rem; color: #10b981;"><span style="font-size: 1.5rem;">✅</span><span style="font-weight: 600;">Fact-Checked</span></div>
    <div style="display: flex; align-items: center; gap: 0.5rem; color: #3b82f6;"><span style="font-size: 1.5rem;">📊</span><span style="font-weight: 600;">Data-Driven</span></div>
    <div style="display: flex; align-items: center; gap: 0.5rem; color: #8b5cf6;"><span style="font-size: 1.5rem;">🔬</span><span style="font-weight: 600;">Expert Reviewed</span></div>
  </div>
  <p style="margin: 0; color: #64748b; font-size: 0.875rem;">Last updated: ${currentDate} | Content verified for ${currentYear}</p>
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

  if (snippets.keyTakeawaysHtml) {
    body.querySelectorAll('[class*="takeaway"], div[style*="#064E3B"], div[style*="#047857"]').forEach(el => {
      const h3 = el.querySelector('h3');
      if (h3?.textContent?.toLowerCase().includes('takeaway')) el.remove();
    });
  }

  if (snippets.introHtml) {
    const intro = doc.createElement('div');
    intro.innerHTML = snippets.introHtml;
    intro.className = 'sota-intro-section';
    if (body.firstChild) body.insertBefore(intro, body.firstChild);
    else body.appendChild(intro);
  }

  if (snippets.keyTakeawaysHtml) {
    const takeaways = doc.createElement('div');
    takeaways.innerHTML = snippets.keyTakeawaysHtml;
    takeaways.className = 'sota-takeaways-section';
    
    const firstH2 = body.querySelector('h2');
    if (firstH2 && firstH2.parentNode) {
      firstH2.parentNode.insertBefore(takeaways, firstH2);
    } else {
      const introSection = body.querySelector('.sota-intro-section');
      if (introSection && introSection.nextSibling) body.insertBefore(takeaways, introSection.nextSibling);
      else body.appendChild(takeaways);
    }
  }

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
    
    if (conclusionHeading && conclusionHeading.parentNode) conclusionHeading.parentNode.insertBefore(faq, conclusionHeading);
    else body.appendChild(faq);
  }

  if (snippets.conclusionHtml) {
    const conclusion = doc.createElement('div');
    conclusion.innerHTML = snippets.conclusionHtml;
    conclusion.className = 'sota-conclusion-section';
    body.appendChild(conclusion);
  }

  if (snippets.referencesHtml && snippets.referencesHtml.trim().length > 50) {
    body.querySelectorAll('.sota-references-section, [class*="references-section"]').forEach(el => el.remove());
    const refs = doc.createElement('div');
    refs.innerHTML = snippets.referencesHtml;
    refs.className = 'sota-references-wrapper';
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
  if (YOUTUBE_SEARCH_CACHE.has(cacheKey)) return YOUTUBE_SEARCH_CACHE.get(cacheKey)!;

  try {
    const response = await fetchWithProxies('https://google.serper.dev/videos', {
      method: 'POST',
      headers: { 'X-API-KEY': serperApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: keyword, num: 10 }),
    });

    const data = await response.json();
    const videos: Array<{ videoId: string; title: string }> = [];

    for (const video of data.videos || []) {
      if (videos.length >= count) break;
      if (video.link?.includes('youtube.com/watch?v=')) {
        const videoId = video.link.split('v=')[1]?.split('&')[0];
        if (videoId) videos.push({ videoId, title: video.title });
      }
    }

    YOUTUBE_SEARCH_CACHE.set(cacheKey, videos);
    return videos;
  } catch (error) {
    return [];
  }
};

export const generateYoutubeEmbedHtml = (videos: Array<{ videoId: string; title: string }>): string => {
  if (videos.length === 0) return '';

  const embedsHtml = videos.map(video => `
    <div style="margin: 1.5rem 0;">
      <iframe width="100%" height="400" src="https://www.youtube.com/embed/${video.videoId}" title="${video.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy" style="border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);"></iframe>
      <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #64748b; text-align: center;">${video.title}</p>
    </div>
  `).join('');

  return `<div class="sota-video-section" style="margin: 3rem 0; padding: 2rem; background: #f8fafc; border-radius: 16px;">
  <h3 style="margin-top: 0; font-size: 1.5rem; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;"><span>🎬</span> Related Videos</h3>
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
    try { doc.querySelectorAll(selector).forEach(el => el.remove()); } catch (e) {}
  });

  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
      if (attr.value.toLowerCase().includes('javascript:')) el.removeAttribute(attr.name);
    });
  });

  return doc.body.innerHTML;
};

// ==================== IMAGE HANDLING ====================

export const extractImagesFromHtml = (html: string): Array<{ src: string; alt: string; title?: string }> => {
  const images: Array<{ src: string; alt: string; title?: string }> = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:image/svg')) {
      images.push({ src, alt: img.getAttribute('alt') || '', title: img.getAttribute('title') || undefined });
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
      
      if (img.alt) {
        const caption = doc.createElement('figcaption');
        caption.style.cssText = 'margin-top: 0.5rem; font-size: 0.875rem; color: #64748b; font-style: italic;';
        caption.textContent = img.alt;
        figure.appendChild(caption);
      }
      
      const nextSibling = targetH2.nextElementSibling;
      if (nextSibling?.nextSibling) nextSibling.parentNode?.insertBefore(figure, nextSibling.nextSibling);
      else if (targetH2.nextSibling) targetH2.parentNode?.insertBefore(figure, targetH2.nextSibling);
    }
  });

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
    <thead><tr style="background: linear-gradient(135deg, #1E40AF 0%, #7C3AED 100%);">${headerHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</div>`;
};

// ==================== READABILITY ====================

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

// ==================== CONTEXTUAL LINKING ====================

export const injectContextualInternalLinks = (
  content: string,
  availablePages: ExistingPage[],
  baseUrl: string,
  targetLinks: number = 12
): string => {
  if (availablePages.length === 0) return content;
  return forceNaturalInternalLinks(content, availablePages, baseUrl, targetLinks);
};

// ==================== END OF FILE ====================
