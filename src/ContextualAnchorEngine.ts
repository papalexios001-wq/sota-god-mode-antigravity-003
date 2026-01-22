// =============================================================================
// CONTEXTUAL ANCHOR ENGINE v1.0.0 - Enterprise-Grade Internal Link Generator
// SOTA Implementation: Rich, Semantic, Context-Aware Anchor Text
// =============================================================================

import { escapeRegExp } from './contentUtils';

// ==================== TYPE DEFINITIONS ====================

export interface PageInfo {
  title: string;
  slug: string;
  description?: string;
  keywords?: string[];
  category?: string;
}

export interface AnchorCandidate {
  text: string;
  score: number;
  wordCount: number;
  contextMatch: number;
  semanticRelevance: number;
  position: 'start' | 'middle' | 'end';
}

export interface LinkInjectionResult {
  success: boolean;
  anchor: string;
  targetSlug: string;
  position: number;
  contextScore: number;
}

export interface ContextualAnchorConfig {
  minAnchorWords: number;
  maxAnchorWords: number;
  minContextScore: number;
  preferredPosition: 'middle' | 'end' | 'any';
  avoidHeadingDuplication: boolean;
  semanticWeighting: number;
  contextWindowSize: number;
}

// ==================== CONSTANTS ====================

const DEFAULT_CONFIG: ContextualAnchorConfig = {
  minAnchorWords: 3,
  maxAnchorWords: 7,
  minContextScore: 0.35,
  preferredPosition: 'middle',
  avoidHeadingDuplication: true,
  semanticWeighting: 1.5,
  contextWindowSize: 50,
};

// Stopwords to exclude from anchor text starts/ends
const ANCHOR_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'their',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there',
]);

// Generic terms to penalize in anchors
const GENERIC_ANCHOR_TERMS = new Set([
  'click here', 'read more', 'learn more', 'find out', 'check out',
  'this article', 'this guide', 'this post', 'more info', 'more information',
  'here', 'link', 'page', 'website', 'site', 'resource',
]);

// SEO power words that boost anchor quality
const SEO_POWER_WORDS = new Set([
  'guide', 'tutorial', 'strategy', 'strategies', 'techniques', 'tips',
  'best', 'practices', 'complete', 'ultimate', 'proven', 'effective',
  'step-by-step', 'comprehensive', 'essential', 'advanced', 'beginner',
  'professional', 'expert', 'optimize', 'optimization', 'improve',
  'increase', 'boost', 'maximize', 'tools', 'methods', 'examples',
]);

// Topic modifiers that indicate specificity
const TOPIC_MODIFIERS = [
  'for beginners', 'for professionals', 'for ecommerce', 'for wordpress',
  'in 2024', 'in 2025', 'in 2026', 'step by step', 'from scratch',
  'best practices', 'complete guide', 'ultimate guide', 'how to',
  'without coding', 'for small business', 'for startups', 'advanced',
];

console.log('[ContextualAnchorEngine] Module loaded');

// ==================== SEMANTIC ANALYSIS ====================

/**
 * Calculate semantic similarity between two text strings
 * Uses Jaccard similarity with n-gram enhancement
 */
export const calculateSemanticSimilarity = (
  text1: string,
  text2: string,
  ngramSize: number = 2
): number => {
  const normalize = (text: string): string[] => {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !ANCHOR_STOPWORDS.has(w));
  };

  const words1 = normalize(text1);
  const words2 = normalize(text2);

  if (words1.length === 0 || words2.length === 0) return 0;

  // Word-level Jaccard
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  const wordJaccard = intersection.size / union.size;

  // N-gram similarity
  const getNgrams = (words: string[], n: number): Set<string> => {
    const ngrams = new Set<string>();
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(' '));
    }
    return ngrams;
  };

  const ngrams1 = getNgrams(words1, ngramSize);
  const ngrams2 = getNgrams(words2, ngramSize);
  const ngramIntersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
  const ngramUnion = new Set([...ngrams1, ...ngrams2]);
  const ngramJaccard = ngramUnion.size > 0 ? ngramIntersection.size / ngramUnion.size : 0;

  // Weighted combination
  return (wordJaccard * 0.6) + (ngramJaccard * 0.4);
};

/**
 * Extract semantic topics from a page title and slug
 */
export const extractPageTopics = (page: PageInfo): string[] => {
  const topics: string[] = [];
  
  // Extract from title
  const titleWords = page.title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !ANCHOR_STOPWORDS.has(w));
  
  topics.push(...titleWords);

  // Extract from slug
  const slugWords = page.slug.toLowerCase()
    .split('-')
    .filter(w => w.length > 3);
  
  topics.push(...slugWords);

  // Generate 2-5 word phrases from title
  for (let len = 2; len <= 5 && len <= titleWords.length; len++) {
    for (let i = 0; i <= titleWords.length - len; i++) {
      const phrase = titleWords.slice(i, i + len).join(' ');
      if (phrase.length > 8) {
        topics.push(phrase);
      }
    }
  }

  // Add topic modifiers if relevant
  TOPIC_MODIFIERS.forEach(mod => {
    const modLower = mod.toLowerCase();
    if (page.title.toLowerCase().includes(modLower)) {
      topics.push(modLower);
    }
  });

  // Add keywords if provided
  if (page.keywords) {
    topics.push(...page.keywords.map(k => k.toLowerCase()));
  }

  return [...new Set(topics)];
};

// ==================== ANCHOR QUALITY SCORING ====================

/**
 * Score the quality of a potential anchor text
 * Higher scores indicate better, more contextual anchors
 */
export const scoreAnchorQuality = (
  anchor: string,
  targetPage: PageInfo,
  paragraphContext: string,
  nearbyHeading?: string,
  config: ContextualAnchorConfig = DEFAULT_CONFIG
): number => {
  const anchorLower = anchor.toLowerCase().trim();
  const words = anchorLower.split(/\s+/).filter(w => w.length > 0);
  
  // Base score starts at 0
  let score = 0;

  // === Word count scoring (3-7 words ideal) ===
  if (words.length >= config.minAnchorWords && words.length <= config.maxAnchorWords) {
    score += 15; // Perfect word count range
    // Bonus for 4-5 words (sweet spot)
    if (words.length >= 4 && words.length <= 5) score += 5;
  } else if (words.length < config.minAnchorWords) {
    score -= 10 * (config.minAnchorWords - words.length); // Penalty for too short
  } else {
    score -= 5 * (words.length - config.maxAnchorWords); // Penalty for too long
  }

  // === Stopword check ===
  const firstWord = words[0]?.toLowerCase();
  const lastWord = words[words.length - 1]?.toLowerCase();
  
  if (firstWord && ANCHOR_STOPWORDS.has(firstWord)) {
    score -= 8; // Penalty for starting with stopword
  }
  if (lastWord && ANCHOR_STOPWORDS.has(lastWord)) {
    score -= 5; // Penalty for ending with stopword
  }

  // === Generic term penalty ===
  for (const generic of GENERIC_ANCHOR_TERMS) {
    if (anchorLower.includes(generic)) {
      score -= 25; // Heavy penalty for generic anchors
      break;
    }
  }

  // === SEO power word bonus ===
  let powerWordCount = 0;
  for (const word of words) {
    if (SEO_POWER_WORDS.has(word)) {
      powerWordCount++;
    }
  }
  score += Math.min(powerWordCount * 5, 15); // Up to 15 point bonus

  // === Semantic relevance to target page ===
  const semanticScore = calculateSemanticSimilarity(anchor, targetPage.title);
  score += semanticScore * 30 * config.semanticWeighting;

  // === Context relevance (anchor fits naturally in paragraph) ===
  const contextScore = calculateSemanticSimilarity(anchor, paragraphContext);
  score += contextScore * 20;

  // === Heading duplication penalty ===
  if (config.avoidHeadingDuplication && nearbyHeading) {
    const headingLower = nearbyHeading.toLowerCase();
    const headingWords = headingLower.split(/\s+/).filter(w => w.length > 3);
    const anchorWords = words.filter(w => w.length > 3);
    
    const overlapCount = anchorWords.filter(w => headingWords.includes(w)).length;
    const overlapRatio = overlapCount / Math.max(anchorWords.length, 1);
    
    if (overlapRatio > 0.6) {
      score -= 15; // Penalty for too similar to heading
    }
  }

  // === Position scoring ===
  const anchorPosition = paragraphContext.toLowerCase().indexOf(anchorLower);
  const paragraphLength = paragraphContext.length;
  
  if (anchorPosition > -1) {
    const positionRatio = anchorPosition / paragraphLength;
    
    if (config.preferredPosition === 'middle') {
      if (positionRatio >= 0.25 && positionRatio <= 0.75) {
        score += 8; // Bonus for middle position
      }
    } else if (config.preferredPosition === 'end') {
      if (positionRatio >= 0.6) {
        score += 8; // Bonus for end position
      }
    }
    
    // Penalty for very start of paragraph
    if (positionRatio < 0.1) {
      score -= 5;
    }
  }

  // === Descriptive modifier bonus ===
  for (const modifier of TOPIC_MODIFIERS) {
    if (anchorLower.includes(modifier.toLowerCase())) {
      score += 8;
      break;
    }
  }

  return Math.max(0, score);
};

// ==================== ANCHOR EXTRACTION ====================

/**
 * Extract potential anchor candidates from a paragraph
 * Generates 3-7 word phrases that could serve as anchors
 */
export const extractAnchorCandidates = (
  paragraph: string,
  targetPage: PageInfo,
  nearbyHeading?: string,
  config: ContextualAnchorConfig = DEFAULT_CONFIG
): AnchorCandidate[] => {
  const candidates: AnchorCandidate[] = [];
  const text = paragraph.replace(/<[^>]*>/g, ' ').trim();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length < config.minAnchorWords) return candidates;

  const pageTopics = extractPageTopics(targetPage);

  // Generate all possible n-word phrases
  for (let phraseLen = config.minAnchorWords; phraseLen <= config.maxAnchorWords; phraseLen++) {
    for (let startIdx = 0; startIdx <= words.length - phraseLen; startIdx++) {
      const phraseWords = words.slice(startIdx, startIdx + phraseLen);
      const phrase = phraseWords.join(' ');
      
      // Skip if phrase starts/ends with punctuation-heavy words
      const cleanPhrase = phrase.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
      if (cleanPhrase.length < 10) continue;

      // Check for topic relevance
      const phraseLower = cleanPhrase.toLowerCase();
      let topicMatch = false;
      
      for (const topic of pageTopics) {
        if (phraseLower.includes(topic) || topic.includes(phraseLower.split(' ')[0])) {
          topicMatch = true;
          break;
        }
      }

      // Calculate position
      const positionRatio = startIdx / words.length;
      let position: 'start' | 'middle' | 'end' = 'middle';
      if (positionRatio < 0.2) position = 'start';
      else if (positionRatio > 0.7) position = 'end';

      // Score the candidate
      const score = scoreAnchorQuality(
        cleanPhrase,
        targetPage,
        text,
        nearbyHeading,
        config
      );

      // Only add if score meets minimum threshold and has topic match
      if (score >= config.minContextScore * 100 || topicMatch) {
        const contextMatch = calculateSemanticSimilarity(cleanPhrase, text);
        const semanticRelevance = calculateSemanticSimilarity(cleanPhrase, targetPage.title);

        candidates.push({
          text: cleanPhrase,
          score,
          wordCount: phraseWords.length,
          contextMatch,
          semanticRelevance,
          position,
        });
      }
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Return top candidates (deduplicated)
  const seen = new Set<string>();
  const uniqueCandidates: AnchorCandidate[] = [];
  
  for (const candidate of candidates) {
    const normalized = candidate.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueCandidates.push(candidate);
      if (uniqueCandidates.length >= 10) break;
    }
  }

  return uniqueCandidates;
};

// ==================== LINK INJECTION ====================

/**
 * Normalize anchor text to meet quality standards
 * Ensures 3-7 words, proper capitalization, no stopword boundaries
 */
export const normalizeAnchorText = (
  anchor: string,
  config: ContextualAnchorConfig = DEFAULT_CONFIG
): string | null => {
  // Clean the input
  let cleaned = anchor
    .replace(/^[^a-zA-Z0-9]+/, '')
    .replace(/[^a-zA-Z0-9]+$/, '')
    .trim();

  const words = cleaned.split(/\s+/).filter(w => w.length > 0);

  // Too short - cannot use
  if (words.length < config.minAnchorWords) {
    return null;
  }

  // Trim to max words if needed
  if (words.length > config.maxAnchorWords) {
    // Try to find a natural break point
    const targetLen = Math.min(config.maxAnchorWords, 5);
    const trimmed = words.slice(0, targetLen);
    
    // Don't end on a stopword
    while (trimmed.length > config.minAnchorWords && 
           ANCHOR_STOPWORDS.has(trimmed[trimmed.length - 1].toLowerCase())) {
      trimmed.pop();
    }
    
    cleaned = trimmed.join(' ');
  }

  // Remove leading stopwords
  const finalWords = cleaned.split(/\s+/);
  while (finalWords.length > config.minAnchorWords && 
         ANCHOR_STOPWORDS.has(finalWords[0].toLowerCase())) {
    finalWords.shift();
  }

  if (finalWords.length < config.minAnchorWords) {
    return null;
  }

  return finalWords.join(' ');
};

/**
 * Check if an anchor is too similar to a nearby heading
 */
export const isAnchorTooSimilarToHeading = (
  anchor: string,
  heading: string | null | undefined
): boolean => {
  if (!heading) return false;

  const anchorLower = anchor.toLowerCase();
  const headingLower = heading.toLowerCase();

  // Check for direct inclusion
  if (headingLower.includes(anchorLower) || anchorLower.includes(headingLower)) {
    return true;
  }

  // Check for high word overlap
  const anchorWords = anchorLower.split(/\s+/).filter(w => w.length > 3);
  const headingWords = headingLower.split(/\s+/).filter(w => w.length > 3);

  if (anchorWords.length === 0 || headingWords.length === 0) return false;

  const overlapCount = anchorWords.filter(w => headingWords.includes(w)).length;
  const overlapRatio = overlapCount / Math.min(anchorWords.length, headingWords.length);

  return overlapRatio >= 0.7;
};

/**
 * Inject a contextual link into HTML content
 * Returns the modified HTML and injection result
 */
export const injectContextualLink = (
  html: string,
  anchor: string,
  targetUrl: string,
  config: ContextualAnchorConfig = DEFAULT_CONFIG
): { html: string; result: LinkInjectionResult } => {
  const escapedAnchor = escapeRegExp(anchor);
  
  // Create regex that matches the anchor text NOT inside existing links
  // Match only in text content (after >) and not before </a>
  const regex = new RegExp(
    `(>[^<]*?)\\b(${escapedAnchor})\\b(?![^<]*<\\/a>)`,
    'i'
  );

  const linkHtml = `<a href="${targetUrl}">${anchor}</a>`;
  let injected = false;
  let matchPosition = -1;

  const newHtml = html.replace(regex, (match, prefix, matchedText, offset) => {
    if (injected) return match; // Only inject once
    
    // Verify we're not inside an existing link
    const beforeMatch = html.slice(Math.max(0, offset - 100), offset);
    const afterMatch = html.slice(offset, offset + 100);
    
    if (beforeMatch.lastIndexOf('<a ') > beforeMatch.lastIndexOf('</a>') ||
        afterMatch.indexOf('</a>') < afterMatch.indexOf('<a ')) {
      return match; // Skip - inside existing link
    }

    injected = true;
    matchPosition = offset;
    return `${prefix}${linkHtml}`;
  });

  return {
    html: newHtml,
    result: {
      success: injected,
      anchor,
      targetSlug: targetUrl.split('/').filter(s => s).pop() || '',
      position: matchPosition,
      contextScore: injected ? 1 : 0,
    },
  };
};

// ==================== MAIN ENGINE CLASS ====================

export class ContextualAnchorEngine {
  private config: ContextualAnchorConfig;
  private usedAnchors: Set<string>;
  private usedSlugs: Set<string>;
  private linkCount: number;

  constructor(config: Partial<ContextualAnchorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.usedAnchors = new Set();
    this.usedSlugs = new Set();
    this.linkCount = 0;
  }

  /**
   * Reset the engine state for a new document
   */
  reset(): void {
    this.usedAnchors.clear();
    this.usedSlugs.clear();
    this.linkCount = 0;
  }

  /**
   * Find the best anchor for a page within a given paragraph
   */
  findBestAnchor(
    paragraph: string,
    targetPage: PageInfo,
    nearbyHeading?: string
  ): AnchorCandidate | null {
    const candidates = extractAnchorCandidates(
      paragraph,
      targetPage,
      nearbyHeading,
      this.config
    );

    // Filter out used anchors
    const availableCandidates = candidates.filter(c => {
      const normalized = c.text.toLowerCase().replace(/[^a-z0-9]/g, '');
      return !this.usedAnchors.has(normalized);
    });

    if (availableCandidates.length === 0) return null;

    // Return highest scoring candidate
    return availableCandidates[0];
  }

  /**
   * Process a paragraph and inject a link if appropriate
   */
  processContainer(
    container: Element,
    availablePages: PageInfo[],
    baseUrl: string,
    nearbyHeading?: string
  ): LinkInjectionResult | null {
    const text = container.textContent || '';
    const html = container.innerHTML;

    // Skip if too short
    if (text.length < 60) return null;

    // Skip if already has 2+ links
    const existingLinks = container.querySelectorAll('a').length;
    if (existingLinks >= 2) return null;

    // Find best matching page
    for (const page of availablePages) {
      if (this.usedSlugs.has(page.slug)) continue;

      const candidate = this.findBestAnchor(text, page, nearbyHeading);
      if (!candidate) continue;

      // Verify anchor exists in the HTML
      if (!html.toLowerCase().includes(candidate.text.toLowerCase())) continue;

      // Check heading similarity
      if (this.config.avoidHeadingDuplication && 
          isAnchorTooSimilarToHeading(candidate.text, nearbyHeading)) {
        continue;
      }

      // Normalize the anchor
      const normalizedAnchor = normalizeAnchorText(candidate.text, this.config);
      if (!normalizedAnchor) continue;

      // Build URL
      const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
      const targetUrl = `${cleanBaseUrl}/${page.slug}/`;

      // Inject the link
      const { html: newHtml, result } = injectContextualLink(
        html,
        normalizedAnchor,
        targetUrl,
        this.config
      );

      if (result.success) {
        container.innerHTML = newHtml;
        this.usedSlugs.add(page.slug);
        this.usedAnchors.add(normalizedAnchor.toLowerCase().replace(/[^a-z0-9]/g, ''));
        this.linkCount++;

        console.log(
          `[ContextualAnchorEngine] Injected: "${normalizedAnchor}" -> ${page.slug} (score: ${candidate.score.toFixed(1)})`
        );

        return result;
      }
    }

    return null;
  }

  /**
   * Get statistics about link injection
   */
  getStats(): { linksInjected: number; uniqueAnchors: number; uniqueTargets: number } {
    return {
      linksInjected: this.linkCount,
      uniqueAnchors: this.usedAnchors.size,
      uniqueTargets: this.usedSlugs.size,
    };
  }
}

// ==================== EXPORTS ====================

export default {
  ContextualAnchorEngine,
  calculateSemanticSimilarity,
  extractPageTopics,
  scoreAnchorQuality,
  extractAnchorCandidates,
  normalizeAnchorText,
  isAnchorTooSimilarToHeading,
  injectContextualLink,
  DEFAULT_CONFIG,
};
