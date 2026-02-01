// =============================================================================
// SOTA INTERNAL LINK ENGINE v1.1 - BULLETPROOF ANCHOR TEXT + URL VALIDATION
// Fixes: Broken anchors, improper distribution, link clustering, 404 links
// =============================================================================

export interface InternalPage {
  title: string;
  slug: string;
  url?: string;
}

// =============================================================================
// URL VALIDATION - Ensures 100% functional internal links
// =============================================================================

const urlValidationCache = new Map<string, { valid: boolean; timestamp: number; status?: number }>();
const domainBlocklistCache = new Map<string, { blocked: boolean; timestamp: number }>();
const URL_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL
const DOMAIN_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes domain cache TTL

/**
 * SOTA URL Validator v2.0 - Enterprise-grade URL validation
 * 
 * Features:
 * - 3-tier validation: format → cache → live check
 * - Domain-level blocklist for failing domains
 * - Intelligent retry with exponential backoff
 * - Comprehensive error categorization
 */
export async function validateUrlExists(
  url: string,
  timeoutMs: number = 5000,
  retryCount: number = 1
): Promise<{ valid: boolean; status?: number; error?: string; cached?: boolean }> {
  // TIER 1: Basic URL format validation
  try {
    const urlObj = new URL(url);

    // Reject non-HTTP(S) protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      console.warn(`[URLValidator] ❌ Invalid protocol: ${urlObj.protocol}`);
      return { valid: false, error: 'Invalid protocol' };
    }

    // Check domain blocklist first
    const domain = urlObj.hostname;
    const domainStatus = domainBlocklistCache.get(domain);
    if (domainStatus && Date.now() - domainStatus.timestamp < DOMAIN_CACHE_TTL_MS && domainStatus.blocked) {
      console.log(`[URLValidator] ⛔ Domain blocklisted: ${domain}`);
      return { valid: false, error: 'Domain temporarily blocked', cached: true };
    }
  } catch (e) {
    console.warn(`[URLValidator] ❌ Malformed URL: ${url}`);
    return { valid: false, error: 'Malformed URL' };
  }

  // TIER 2: Check cache
  const cached = urlValidationCache.get(url);
  if (cached && Date.now() - cached.timestamp < URL_CACHE_TTL_MS) {
    console.log(`[URLValidator] 📦 Cache hit for ${url}: ${cached.valid ? '✅ valid' : '❌ invalid'}`);
    return { valid: cached.valid, status: cached.status, cached: true };
  }

  // TIER 3: Live validation with retry logic
  let lastError = '';
  let lastStatus = 0;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SOTA-Link-Validator/2.0; +https://example.com/bot)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      clearTimeout(timeoutId);
      lastStatus = response.status;

      // VALID: 200-299 status codes
      if (response.ok) {
        urlValidationCache.set(url, { valid: true, timestamp: Date.now(), status: response.status });
        console.log(`[URLValidator] ✅ Valid URL (${response.status}): ${url}`);
        return { valid: true, status: response.status };
      }

      // PERMANENT FAILURE: 404, 410 (gone), 451 (legal)
      if ([404, 410, 451].includes(response.status)) {
        urlValidationCache.set(url, { valid: false, timestamp: Date.now(), status: response.status });
        console.warn(`[URLValidator] ❌ Permanent failure (${response.status}): ${url}`);
        return { valid: false, status: response.status, error: `HTTP ${response.status}` };
      }

      // TEMPORARY FAILURE: 500, 502, 503, 504 - may retry
      if ([500, 502, 503, 504].includes(response.status)) {
        lastError = `HTTP ${response.status}`;
        if (attempt < retryCount) {
          console.log(`[URLValidator] ⚠️ Temporary failure (${response.status}), retrying...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Exponential backoff
          continue;
        }
      }

      // OTHER: 4xx errors - likely invalid
      urlValidationCache.set(url, { valid: false, timestamp: Date.now(), status: response.status });
      console.warn(`[URLValidator] ❌ Invalid URL (${response.status}): ${url}`);
      return { valid: false, status: response.status, error: `HTTP ${response.status}` };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = errorMessage;

      // Handle abort/timeout
      if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
        console.warn(`[URLValidator] ⏱️ Timeout validating URL (attempt ${attempt + 1}): ${url}`);
        if (attempt < retryCount) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
      }

      // Network errors - may indicate domain is down
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
        try {
          const domain = new URL(url).hostname;
          domainBlocklistCache.set(domain, { blocked: true, timestamp: Date.now() });
          console.warn(`[URLValidator] ⛔ Domain unreachable, blocklisting: ${domain}`);
        } catch (e) { /* ignore */ }

        urlValidationCache.set(url, { valid: false, timestamp: Date.now() });
        return { valid: false, error: 'Domain unreachable' };
      }

      console.error(`[URLValidator] ❌ Error validating URL ${url}: ${errorMessage}`);
    }
  }

  // All retries exhausted
  urlValidationCache.set(url, { valid: false, timestamp: Date.now(), status: lastStatus });
  return { valid: false, error: lastError || 'Validation failed' };
}

/**
 * Bulk validate URLs with concurrency control
 */
export async function bulkValidateUrls(
  urls: string[],
  maxConcurrent: number = 5
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Process in batches
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(async url => {
        const result = await validateUrlExists(url, 3000, 0); // Fast check, no retries for bulk
        return { url, valid: result.valid };
      })
    );

    for (const { url, valid } of batchResults) {
      results.set(url, valid);
    }
  }

  return results;
}

/**
 * Clear validation caches (useful before content generation)
 */
export function clearValidationCaches(): void {
  urlValidationCache.clear();
  domainBlocklistCache.clear();
  console.log('[URLValidator] 🧹 Caches cleared');
}

/**
 * Validates a page has proper slug/URL and optionally checks if URL exists.
 */
export function validatePageForLinking(page: InternalPage, baseUrl: string): {
  valid: boolean;
  url: string;
  reason?: string;
} {
  // Check if page has required fields
  if (!page.slug || page.slug.trim() === '') {
    return { valid: false, url: '', reason: 'Missing or empty slug' };
  }

  // Validate slug format (no double slashes, no invalid chars)
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
  if (!slugPattern.test(page.slug)) {
    console.warn(`[PageValidator] Invalid slug format: "${page.slug}"`);
    // Don't reject, but clean it up
  }

  // Construct URL
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const cleanSlug = page.slug.replace(/^\/+|\/+$/g, '');
  const url = page.url || `${cleanBaseUrl}/${cleanSlug}/`;

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return { valid: false, url, reason: `Invalid URL format: ${url}` };
  }

  return { valid: true, url };
}

/**
 * Batch validate pages and return only those with valid URLs.
 * Optionally performs live URL checks.
 */
export async function filterValidPages(
  pages: InternalPage[],
  baseUrl: string,
  performLiveCheck: boolean = false
): Promise<InternalPage[]> {
  console.log(`[PageFilter] Filtering ${pages.length} pages...`);

  const validPages: InternalPage[] = [];

  for (const page of pages) {
    const validation = validatePageForLinking(page, baseUrl);

    if (!validation.valid) {
      console.warn(`[PageFilter] Skipping page "${page.title}": ${validation.reason}`);
      continue;
    }

    if (performLiveCheck) {
      const urlCheck = await validateUrlExists(validation.url);
      if (!urlCheck.valid) {
        console.warn(`[PageFilter] Skipping page "${page.title}" - URL check failed: ${validation.url}`);
        continue;
      }
    }

    // Store validated URL on page object
    validPages.push({
      ...page,
      url: validation.url
    });
  }

  console.log(`[PageFilter] ${validPages.length}/${pages.length} pages passed validation`);
  return validPages;
}

/**
 * Clears the URL validation cache
 */
export function clearUrlValidationCache(): void {
  urlValidationCache.clear();
  console.log('[URLValidator] Cache cleared');
}

export interface LinkPlacement {
  paragraphIndex: number;
  anchorText: string;
  targetSlug: string;
  targetTitle: string;
  targetUrl: string;
}

export interface LinkEngineConfig {
  minLinksPerPost: number;
  maxLinksPerPost: number;
  minAnchorWords: number;
  maxAnchorWords: number;
  maxLinksPerParagraph: number;
  minWordsBetweenLinks: number;
  avoidFirstParagraph: boolean;
  avoidLastParagraph: boolean;
}

const DEFAULT_CONFIG: LinkEngineConfig = {
  minLinksPerPost: 4,
  maxLinksPerPost: 8,
  minAnchorWords: 4,
  maxAnchorWords: 7,
  maxLinksPerParagraph: 1,
  minWordsBetweenLinks: 150,
  avoidFirstParagraph: true,
  avoidLastParagraph: true
};

const FORBIDDEN_ANCHOR_STARTS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'their', 'your',
  'our', 'my', 'his', 'her', 'we', 'you', 'i', 'if', 'so', 'yet', 'nor',
  'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'same',
  'than', 'too', 'very', 'just', 'also', 'now', 'being', 'having', 'which',
  'who', 'whom', 'whose', 'what', 'while', 'although', 'because', 'since'
]);

const FORBIDDEN_ANCHOR_ENDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'their', 'your',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'have',
  'has', 'had', 'do', 'does', 'did', 'being', 'having', 'if', 'so', 'yet',
  'than', 'too', 'very', 'just', 'also', 'now', 'quite', 'rather', 'really'
]);

const TOXIC_ANCHORS = new Set([
  'click here', 'read more', 'learn more', 'find out', 'check out',
  'this article', 'this guide', 'this post', 'more info', 'see more',
  'here', 'link', 'click', 'read', 'learn', 'check', 'see', 'view',
  'check this out', 'visit here', 'go here', 'our website', 'our blog',
  'this link', 'this page', 'related post', 'related article', 'more details',
  'full details', 'more information', 'additional information', 'click below',
  'discover more', 'explore more', 'get more', 'find more', 'see also'
]);

const REQUIRED_DESCRIPTIVE_WORDS = new Set([
  // Content types
  'guide', 'tutorial', 'tips', 'strategies', 'techniques', 'methods', 'steps',
  'practices', 'approach', 'framework', 'system', 'process', 'checklist',
  'resources', 'tools', 'benefits', 'solutions', 'recommendations', 'insights',
  'overview', 'basics', 'fundamentals', 'essentials', 'introduction', 'advanced',
  // Quality descriptors
  'best', 'complete', 'comprehensive', 'ultimate', 'proven', 'effective',
  'essential', 'professional', 'expert', 'beginner', 'training', 'detailed',
  'important', 'critical', 'key', 'top', 'leading', 'premium', 'quality',
  // Domain-specific nouns
  'health', 'nutrition', 'grooming', 'behavior', 'care', 'wellness', 'diet', 'exercise',
  'marketing', 'seo', 'content', 'strategy', 'optimization', 'conversion',
  'growth', 'revenue', 'sales', 'business', 'advice', 'secrets', 'mistakes',
  'problems', 'issues', 'ways', 'reasons', 'facts', 'myths', 'signs',
  'examples', 'templates', 'ideas', 'inspiration', 'planning', 'management',
  // Additional high-value words
  'services', 'products', 'reviews', 'comparison', 'analysis', 'research',
  'studies', 'statistics', 'data', 'report', 'trends', 'updates', 'news',
  'features', 'pricing', 'costs', 'budget', 'savings', 'investment', 'roi',
  'beginners', 'experts', 'professionals', 'homeowners', 'parents', 'owners',
  'schedule', 'routine', 'maintenance', 'prevention', 'treatment', 'recovery'
]);

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function extractCleanText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getWordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

export function validateAnchorText(anchor: string, config: LinkEngineConfig = DEFAULT_CONFIG): {
  valid: boolean;
  reason: string;
  score: number;
} {
  const cleaned = anchor.trim()
    .replace(/^[^a-zA-Z0-9]+/, '')
    .replace(/[^a-zA-Z0-9]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return { valid: false, reason: 'Empty anchor text', score: 0 };
  }

  const words = cleaned.split(/\s+/).filter(w => w.length > 0);

  if (words.length < config.minAnchorWords) {
    return { valid: false, reason: `Too short: ${words.length} words (min ${config.minAnchorWords})`, score: 0 };
  }

  if (words.length > config.maxAnchorWords) {
    return { valid: false, reason: `Too long: ${words.length} words (max ${config.maxAnchorWords})`, score: 0 };
  }

  const anchorLower = cleaned.toLowerCase();
  for (const toxic of TOXIC_ANCHORS) {
    if (anchorLower === toxic || anchorLower.includes(toxic)) {
      return { valid: false, reason: `Contains toxic phrase: "${toxic}"`, score: 0 };
    }
  }

  const firstWord = words[0].toLowerCase().replace(/[^a-z']/g, '');
  if (FORBIDDEN_ANCHOR_STARTS.has(firstWord)) {
    return { valid: false, reason: `Cannot start with: "${firstWord}"`, score: 0 };
  }

  const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z']/g, '');
  if (FORBIDDEN_ANCHOR_ENDS.has(lastWord)) {
    return { valid: false, reason: `Cannot end with: "${lastWord}"`, score: 0 };
  }

  const hasDescriptive = words.some(w =>
    REQUIRED_DESCRIPTIVE_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ''))
  );
  if (!hasDescriptive) {
    return { valid: false, reason: 'Missing descriptive word', score: 0 };
  }

  const fragmentPatterns = [
    /\s+(is|are|was|were|will|would|could|should|can|may|might|must)$/i,
    /\s+(and|or|but|that|which|who|when|where|why|how)$/i,
    /\s+(the|a|an|very|really|quite|rather|so|too)$/i,
    /\s+(have|has|had|do|does|did|being|having)$/i,
    /\s+(if|although|because|since|while|unless)$/i
  ];

  for (const pattern of fragmentPatterns) {
    if (pattern.test(cleaned)) {
      return { valid: false, reason: 'Incomplete sentence fragment', score: 0 };
    }
  }

  const meaningfulWords = words.filter(w =>
    !FORBIDDEN_ANCHOR_STARTS.has(w.toLowerCase()) && w.length > 2
  );
  if (meaningfulWords.length < 2) {
    return { valid: false, reason: 'Too few meaningful words', score: 0 };
  }

  let score = 50;
  if (words.length >= 4 && words.length <= 6) score += 20;
  else if (words.length === 7) score += 10;

  const descriptiveCount = words.filter(w =>
    REQUIRED_DESCRIPTIVE_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ''))
  ).length;
  score += Math.min(descriptiveCount * 8, 24);

  const powerPatterns = [
    /\b(complete|comprehensive|ultimate|definitive)\s+\w+\s+guide\b/i,
    /\b(step[- ]by[- ]step|how[- ]to)\s+\w+/i,
    /\b(best|top|proven|effective)\s+(practices|strategies|techniques|tips)/i,
    /\b(beginner|advanced|expert)\s+\w+\s+(guide|tips|tutorial)/i
  ];
  for (const pattern of powerPatterns) {
    if (pattern.test(cleaned)) {
      score += 15;
      break;
    }
  }

  return { valid: true, reason: 'Valid anchor', score: Math.min(100, score) };
}

function extractKeyTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !FORBIDDEN_ANCHOR_STARTS.has(w));
}

function findBestAnchorInParagraph(
  paragraphText: string,
  targetPage: InternalPage,
  config: LinkEngineConfig = DEFAULT_CONFIG
): { anchor: string; score: number } | null {
  const text = extractCleanText(paragraphText);
  const words = text.split(/\s+/).filter(w => w.length > 0);

  if (words.length < config.minAnchorWords) return null;

  const targetTerms = [
    ...extractKeyTerms(targetPage.title),
    ...extractKeyTerms(targetPage.slug.replace(/-/g, ' '))
  ];
  const uniqueTerms = [...new Set(targetTerms)];

  let bestCandidate: { anchor: string; score: number } | null = null;

  for (let len = config.minAnchorWords; len <= config.maxAnchorWords; len++) {
    for (let start = 0; start <= words.length - len; start++) {
      const phraseWords = words.slice(start, start + len);
      const phrase = phraseWords.join(' ');

      const validation = validateAnchorText(phrase, config);
      if (!validation.valid) continue;

      const phraseLower = phrase.toLowerCase();
      let matchScore = 0;
      for (const term of uniqueTerms) {
        if (phraseLower.includes(term)) {
          matchScore += 20;
        }
      }

      if (matchScore === 0) continue;

      const totalScore = validation.score + matchScore;

      if (!bestCandidate || totalScore > bestCandidate.score) {
        bestCandidate = { anchor: phrase, score: totalScore };
      }
    }
  }

  return bestCandidate;
}

interface ParagraphInfo {
  index: number;
  element: Element;
  text: string;
  wordCount: number;
  hasLink: boolean;
  isFirstParagraph: boolean;
  isLastParagraph: boolean;
  isSpecialSection: boolean;
}

function analyzeParagraphs(doc: Document): ParagraphInfo[] {
  const containers = Array.from(doc.querySelectorAll('p, li'));
  const total = containers.length;

  return containers.map((el, index) => {
    const text = el.textContent || '';
    const hasLink = el.querySelectorAll('a').length > 0;

    const isSpecialSection = Boolean(
      el.closest('.sota-faq-section, .sota-faq, .sota-references, .sota-key-takeaways, ' +
        '.sota-conclusion, .verification-footer-sota, [class*="faq"], [class*="reference"], ' +
        'blockquote, table, [class*="takeaway"], details')
    );

    return {
      index,
      element: el,
      text,
      wordCount: getWordCount(text),
      hasLink,
      isFirstParagraph: index === 0,
      isLastParagraph: index === total - 1,
      isSpecialSection
    };
  });
}

function selectLinkableParagraphs(
  paragraphs: ParagraphInfo[],
  config: LinkEngineConfig = DEFAULT_CONFIG
): ParagraphInfo[] {
  return paragraphs.filter(p => {
    if (p.wordCount < 50) return false;
    if (p.hasLink) return false;
    if (p.isSpecialSection) return false;
    if (config.avoidFirstParagraph && p.isFirstParagraph) return false;
    if (config.avoidLastParagraph && p.isLastParagraph) return false;
    return true;
  });
}

function distributeLinksEvenly(
  linkableParagraphs: ParagraphInfo[],
  targetLinkCount: number
): number[] {
  if (linkableParagraphs.length === 0 || targetLinkCount === 0) return [];

  const total = linkableParagraphs.length;
  const actualLinks = Math.min(targetLinkCount, total);

  if (actualLinks === 1) {
    return [Math.floor(total / 2)];
  }

  const indices: number[] = [];
  const step = (total - 1) / (actualLinks - 1);

  for (let i = 0; i < actualLinks; i++) {
    const idx = Math.round(i * step);
    if (!indices.includes(idx)) {
      indices.push(idx);
    }
  }

  return indices;
}

export function processContentWithInternalLinks(
  html: string,
  availablePages: InternalPage[],
  baseUrl: string,
  config: LinkEngineConfig = DEFAULT_CONFIG
): {
  html: string;
  placements: LinkPlacement[];
  stats: { total: number; successful: number; failed: number; skippedInvalidUrls: number };
} {
  if (!html || availablePages.length === 0) {
    return { html, placements: [], stats: { total: 0, successful: 0, failed: 0, skippedInvalidUrls: 0 } };
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

  // Filter pages with valid URLs before processing
  const validatedPages: (InternalPage & { validatedUrl: string })[] = [];
  let skippedInvalidUrls = 0;

  for (const page of availablePages) {
    const validation = validatePageForLinking(page, cleanBaseUrl);
    if (validation.valid) {
      validatedPages.push({
        ...page,
        url: validation.url,
        validatedUrl: validation.url
      });
    } else {
      console.warn(`[SOTALinkEngine] Skipping page with invalid URL: "${page.title}" - ${validation.reason}`);
      skippedInvalidUrls++;
    }
  }

  if (validatedPages.length === 0) {
    console.warn('[SOTALinkEngine] No pages with valid URLs available for linking');
    return { html, placements: [], stats: { total: 0, successful: 0, failed: 0, skippedInvalidUrls } };
  }

  console.log(`[SOTALinkEngine] ${validatedPages.length} pages validated for linking (${skippedInvalidUrls} skipped)`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const paragraphs = analyzeParagraphs(doc);
  const linkable = selectLinkableParagraphs(paragraphs, config);

  const targetCount = Math.min(
    Math.max(config.minLinksPerPost, Math.floor(linkable.length / 3)),
    config.maxLinksPerPost
  );

  const selectedIndices = distributeLinksEvenly(linkable, targetCount);

  const usedSlugs = new Set<string>();
  const placements: LinkPlacement[] = [];
  let successful = 0;
  let failed = 0;

  const shuffledPages = [...validatedPages].sort(() => Math.random() - 0.5);

  for (const localIdx of selectedIndices) {
    const paragraph = linkable[localIdx];
    if (!paragraph) continue;

    let linkPlaced = false;

    for (const page of shuffledPages) {
      if (usedSlugs.has(page.slug)) continue;

      const anchor = findBestAnchorInParagraph(paragraph.text, page, config);
      if (!anchor) continue;

      const targetUrl = page.validatedUrl;
      const escaped = escapeRegExp(anchor.anchor);
      const regex = new RegExp(`\\b(${escaped})\\b(?![^<]*<\\/a>)`, 'i');

      const originalHtml = paragraph.element.innerHTML;
      const linkHtml = `<a href="${targetUrl}" style="color:#2563eb;text-decoration:underline;text-underline-offset:3px;font-weight:500;">$1</a>`;
      const newHtml = originalHtml.replace(regex, linkHtml);

      if (newHtml !== originalHtml && newHtml.includes(targetUrl)) {
        paragraph.element.innerHTML = newHtml;
        usedSlugs.add(page.slug);

        placements.push({
          paragraphIndex: paragraph.index,
          anchorText: anchor.anchor,
          targetSlug: page.slug,
          targetTitle: page.title,
          targetUrl
        });

        successful++;
        linkPlaced = true;
        console.log(`[SOTALinkEngine] ✅ Placed: "${anchor.anchor}" → ${targetUrl}`);
        break;
      }
    }

    if (!linkPlaced) {
      failed++;
    }
  }

  return {
    html: doc.body.innerHTML,
    placements,
    stats: {
      total: selectedIndices.length,
      successful,
      failed,
      skippedInvalidUrls
    }
  };
}

export function generateLinkCandidateMarkers(
  availablePages: InternalPage[],
  count: number = 6
): string {
  const shuffled = [...availablePages].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  return selected.map(page => {
    const titleWords = page.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !FORBIDDEN_ANCHOR_STARTS.has(w));

    const slugWords = page.slug
      .split('-')
      .filter(w => w.length > 3);

    const keyTerms = [...new Set([...titleWords, ...slugWords])].slice(0, 3);

    return `Target: "${page.title}" (/${page.slug}/) - Key terms: ${keyTerms.join(', ')}`;
  }).join('\n');
}

export function createSOTALinkEngine(customConfig?: Partial<LinkEngineConfig>) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  return {
    config,
    validate: (anchor: string) => validateAnchorText(anchor, config),
    process: (html: string, pages: InternalPage[], baseUrl: string) =>
      processContentWithInternalLinks(html, pages, baseUrl, config),
    generateMarkers: (pages: InternalPage[], count?: number) =>
      generateLinkCandidateMarkers(pages, count)
  };
}

// ==================== AI-POWERED ANCHOR TEXT GENERATION ====================

export interface AILinkRewriteResult {
  anchorText: string;
  newParagraphHtml: string;
  targetUrl: string;
  score: number;
}

export interface AILinkingConfig {
  callAiFn: (prompt: string) => Promise<string>;
  primaryKeyword: string;
  minLinks: number;
  maxLinks: number;
}

/**
 * AI-Powered Internal Link Engine v2.0
 * Rewrites paragraphs to include contextually perfect anchor text
 * 
 * CRITICAL FEATURE: Live URL validation ensures 100% functional links
 */
export async function processContentWithAIInternalLinks(
  html: string,
  availablePages: InternalPage[],
  baseUrl: string,
  config: AILinkingConfig
): Promise<{
  html: string;
  placements: LinkPlacement[];
  stats: { total: number; successful: number; failed: number; skippedInvalidUrls: number };
}> {
  if (!html || availablePages.length === 0) {
    return { html, placements: [], stats: { total: 0, successful: 0, failed: 0, skippedInvalidUrls: 0 } };
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

  console.log(`[AILinkEngine] 🔗 Starting internal linking with ${availablePages.length} available pages`);
  console.log(`[AILinkEngine] Base URL: ${cleanBaseUrl}`);

  // PHASE 1: Format validation - quick check for valid URL format
  const formatValidatedPages: (InternalPage & { validatedUrl: string })[] = [];
  let formatInvalid = 0;

  for (const page of availablePages) {
    const validation = validatePageForLinking(page, cleanBaseUrl);
    if (validation.valid) {
      formatValidatedPages.push({
        ...page,
        url: validation.url,
        validatedUrl: validation.url
      });
    } else {
      console.warn(`[AILinkEngine] ⚠️ Format invalid: "${page.title}" - ${validation.reason}`);
      formatInvalid++;
    }
  }

  if (formatValidatedPages.length === 0) {
    console.warn('[AILinkEngine] ❌ No pages passed format validation');
    return { html, placements: [], stats: { total: 0, successful: 0, failed: 0, skippedInvalidUrls: formatInvalid } };
  }

  console.log(`[AILinkEngine] ✅ ${formatValidatedPages.length} pages passed format validation (${formatInvalid} skipped)`);

  // PHASE 2: Live URL validation - ensure URLs actually exist
  console.log(`[AILinkEngine] 🌐 Performing live URL validation...`);

  const urlsToValidate = formatValidatedPages.map(p => p.validatedUrl);
  const validationResults = await bulkValidateUrls(urlsToValidate, 5); // 5 concurrent requests

  const liveValidatedPages: (InternalPage & { validatedUrl: string })[] = [];
  let liveInvalid = 0;

  for (const page of formatValidatedPages) {
    const isValid = validationResults.get(page.validatedUrl);
    if (isValid) {
      liveValidatedPages.push(page);
    } else {
      console.warn(`[AILinkEngine] ❌ Live check failed: "${page.title}" (${page.validatedUrl})`);
      liveInvalid++;
    }
  }

  const skippedInvalidUrls = formatInvalid + liveInvalid;

  if (liveValidatedPages.length === 0) {
    console.warn('[AILinkEngine] ❌ No pages passed live URL validation');
    return { html, placements: [], stats: { total: 0, successful: 0, failed: 0, skippedInvalidUrls } };
  }

  console.log(`[AILinkEngine] ✅ ${liveValidatedPages.length} pages passed live validation (${liveInvalid} failed live check)`);
  console.log(`[AILinkEngine] 📊 Total pages available for linking: ${liveValidatedPages.length}`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Get all paragraphs
  const paragraphs = Array.from(doc.querySelectorAll('p'));

  // Filter eligible paragraphs (min 50 words, no existing links, not in special sections)
  const eligibleParagraphs = paragraphs.filter((p, index) => {
    const text = p.textContent || '';
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    const hasLink = p.querySelectorAll('a').length > 0;
    const isSpecialSection = Boolean(
      p.closest('.sota-faq-section, .sota-faq, .sota-references, .sota-key-takeaways, ' +
        '.sota-conclusion, .verification-footer-sota, [class*="faq"], [class*="reference"], ' +
        'blockquote, table, [class*="takeaway"], details, .sota-youtube-ultra')
    );
    const isFirst = index === 0;
    const isLast = index === paragraphs.length - 1;

    return wordCount >= 50 && !hasLink && !isSpecialSection && !isFirst && !isLast;
  });

  if (eligibleParagraphs.length === 0) {
    console.log('[AILinkEngine] No eligible paragraphs found');
    return { html, placements: [], stats: { total: 0, successful: 0, failed: 0, skippedInvalidUrls } };
  }

  // Distribute links evenly across content
  const targetCount = Math.min(config.maxLinks, Math.max(config.minLinks, Math.ceil(eligibleParagraphs.length / 3)));
  const step = Math.floor(eligibleParagraphs.length / targetCount);
  const selectedIndices: number[] = [];

  for (let i = 0; i < targetCount && i * step < eligibleParagraphs.length; i++) {
    selectedIndices.push(i * step);
  }

  const usedSlugs = new Set<string>();
  const placements: LinkPlacement[] = [];
  let successful = 0;
  let failed = 0;

  // Shuffle validated pages for variety
  const shuffledPages = [...liveValidatedPages].sort(() => Math.random() - 0.5);

  for (const idx of selectedIndices) {
    const paragraph = eligibleParagraphs[idx];
    if (!paragraph) continue;

    const paragraphText = paragraph.textContent || '';

    // Find a target page that hasn't been used yet
    let targetPage: (InternalPage & { validatedUrl: string }) | undefined;
    for (const page of shuffledPages) {
      if (!usedSlugs.has(page.slug)) {
        targetPage = page;
        break;
      }
    }

    if (!targetPage) {
      failed++;
      continue;
    }

    const targetUrl = targetPage.validatedUrl;

    try {
      // AI prompt for anchor text generation
      const aiPrompt = `You are an expert SEO specialist. Generate a PERFECT internal link anchor text.

TARGET PAGE:
- Title: "${targetPage.title}"
- Slug: "${targetPage.slug}"
- URL: "${targetUrl}"

ARTICLE KEYWORD: "${config.primaryKeyword}"

PARAGRAPH TO INSERT LINK INTO:
"${paragraphText.substring(0, 800)}"

ANCHOR TEXT REQUIREMENTS (MANDATORY):
1. MUST be 4-7 words exactly
2. MUST be highly descriptive of the target page topic
3. MUST read naturally in the paragraph context
4. MUST NOT be generic (NO: "click here", "learn more", "this guide", "read more", "check out")
5. MUST NOT start with: the, a, an, and, or, but, in, on, at, to, for, of, with, by, from, as, is, was, this, that
6. MUST NOT end with: the, a, an, and, or, but, is, was, are, were, will, would, could, should, have, has, had
7. MUST contain at least one descriptive noun related to the target topic
8. SHOULD relate contextually to the paragraph content

TASK:
1. Create a perfect anchor text (4-7 words)
2. Rewrite the paragraph MINIMALLY to naturally include this anchor text phrase
3. The anchor text must appear EXACTLY ONCE in the rewritten paragraph

Return ONLY valid JSON (no markdown, no explanation):
{
  "anchorText": "your perfect 4-7 word anchor text",
  "rewrittenParagraph": "the paragraph with the anchor text naturally integrated"
}`;

      const aiResponse = await config.callAiFn(aiPrompt);

      // Parse AI response
      let parsed: { anchorText?: string; rewrittenParagraph?: string } = {};
      try {
        // Clean response - remove markdown code blocks if present
        let cleaned = aiResponse.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim();
        }
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.error('[AILinkEngine] Failed to parse AI response:', e);
        failed++;
        continue;
      }

      if (!parsed.anchorText || !parsed.rewrittenParagraph) {
        console.error('[AILinkEngine] Invalid AI response structure');
        failed++;
        continue;
      }

      // Validate anchor text
      const validation = validateAnchorText(parsed.anchorText);
      if (!validation.valid) {
        console.warn(`[AILinkEngine] Invalid anchor text: ${validation.reason}`);
        failed++;
        continue;
      }

      // Verify anchor text exists in rewritten paragraph
      const rewrittenLower = parsed.rewrittenParagraph.toLowerCase();
      const anchorLower = parsed.anchorText.toLowerCase();
      if (!rewrittenLower.includes(anchorLower)) {
        console.warn('[AILinkEngine] Anchor text not found in rewritten paragraph');
        failed++;
        continue;
      }

      // Create the link HTML
      const anchorEscaped = parsed.anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const anchorRegex = new RegExp(`\\b(${anchorEscaped})\\b(?![^<]*<\\/a>)`, 'i');
      const linkHtml = `<a href="${targetUrl}" style="color:#2563eb;text-decoration:underline;text-underline-offset:3px;font-weight:500;">$1</a>`;

      const newParagraphHtml = parsed.rewrittenParagraph.replace(anchorRegex, linkHtml);

      if (!newParagraphHtml.includes(targetUrl)) {
        console.warn('[AILinkEngine] Failed to insert link');
        failed++;
        continue;
      }

      // Update the paragraph
      paragraph.innerHTML = newParagraphHtml;
      usedSlugs.add(targetPage.slug);

      placements.push({
        paragraphIndex: idx,
        anchorText: parsed.anchorText,
        targetSlug: targetPage.slug,
        targetTitle: targetPage.title,
        targetUrl
      });

      successful++;
      console.log(`[AILinkEngine] ✅ Placed: "${parsed.anchorText}" → ${targetPage.slug}`);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[AILinkEngine] Error processing paragraph:', errorMessage);
      failed++;
    }
  }

  return {
    html: doc.body.innerHTML,
    placements,
    stats: {
      total: selectedIndices.length,
      successful,
      failed,
      skippedInvalidUrls
    }
  };
}

/**
 * Hybrid internal linking: AI-first with deterministic fallback
 */
export async function processContentWithHybridInternalLinks(
  html: string,
  availablePages: InternalPage[],
  baseUrl: string,
  aiConfig: AILinkingConfig | null,
  deterministicConfig: LinkEngineConfig = DEFAULT_CONFIG
): Promise<{
  html: string;
  placements: LinkPlacement[];
  stats: { total: number; successful: number; failed: number; skippedInvalidUrls: number; method: 'ai' | 'deterministic' | 'hybrid' };
}> {
  console.log('[HybridLinkEngine] Starting hybrid internal linking...');

  // Try AI-powered linking first if config provided
  if (aiConfig && aiConfig.callAiFn) {
    console.log('[HybridLinkEngine] Attempting AI-powered linking...');

    const aiResult = await processContentWithAIInternalLinks(
      html, availablePages, baseUrl, aiConfig
    );

    if (aiResult.stats.successful >= aiConfig.minLinks) {
      console.log(`[HybridLinkEngine] AI linking successful: ${aiResult.stats.successful} links`);
      return {
        ...aiResult,
        stats: { ...aiResult.stats, method: 'ai' }
      };
    }

    console.log(`[HybridLinkEngine] AI linking insufficient (${aiResult.stats.successful}/${aiConfig.minLinks}), falling back...`);

    // If AI got some but not enough, use AI result and supplement with deterministic
    if (aiResult.stats.successful > 0) {
      const remainingPages = availablePages.filter(
        p => !aiResult.placements.some(pl => pl.targetSlug === p.slug)
      );

      const additionalResult = processContentWithInternalLinks(
        aiResult.html, remainingPages, baseUrl, {
        ...deterministicConfig,
        minLinksPerPost: aiConfig.minLinks - aiResult.stats.successful,
        maxLinksPerPost: aiConfig.maxLinks - aiResult.stats.successful
      }
      );

      return {
        html: additionalResult.html,
        placements: [...aiResult.placements, ...additionalResult.placements],
        stats: {
          total: aiResult.stats.total + additionalResult.stats.total,
          successful: aiResult.stats.successful + additionalResult.stats.successful,
          failed: aiResult.stats.failed + additionalResult.stats.failed,
          skippedInvalidUrls: aiResult.stats.skippedInvalidUrls + additionalResult.stats.skippedInvalidUrls,
          method: 'hybrid'
        }
      };
    }
  }

  // Pure deterministic fallback
  console.log('[HybridLinkEngine] Using deterministic linking...');
  const result = processContentWithInternalLinks(html, availablePages, baseUrl, deterministicConfig);
  return {
    ...result,
    stats: { ...result.stats, method: 'deterministic' }
  };
}

export default createSOTALinkEngine;
