// =============================================================================
// INTERNAL LINK ORCHESTRATOR v3.0 - SOTA Enterprise Grade
// Rich Contextual Anchor Text with Minimum 3-Word Descriptive Anchors
// =============================================================================

import { SitemapPage } from './types';
import { escapeRegExp } from './contentUtils';

console.log('[InternalLinkOrchestrator v3.0] Enterprise Linking Engine Loaded');

// ==================== TYPES ====================

export interface LinkCandidate {
  anchorText: string;
  targetSlug: string;
  targetTitle: string;
  qualityScore: number;
  wordCount: number;
  semanticRelevance: number;
  contextualFit: number;
  position: number;
  paragraphIndex: number;
}

export interface LinkInjectionResult {
  success: boolean;
  anchor: string;
  targetUrl: string;
  score: number;
}

export interface OrchestratorConfig {
  minAnchorWords: number;
  maxAnchorWords: number;
  minQualityScore: number;
  targetLinksPerPost: number;
  maxLinksPerPost: number;
  minWordsBetweenLinks: number;
  avoidGenericAnchors: boolean;
  preferDescriptiveAnchors: boolean;
}

// ==================== CONSTANTS ====================

const DEFAULT_CONFIG: OrchestratorConfig = {
  minAnchorWords: 3,          // MINIMUM 3 words
  maxAnchorWords: 7,          // Maximum 7 words
  minQualityScore: 0.5,       // Minimum quality threshold
  targetLinksPerPost: 10,     // Target link count
  maxLinksPerPost: 15,        // Maximum links
  minWordsBetweenLinks: 80,   // Space between links
  avoidGenericAnchors: true,  // No "click here", "read more"
  preferDescriptiveAnchors: true
};

// Generic anchors to NEVER use
const FORBIDDEN_ANCHORS = new Set([
  'click here', 'read more', 'learn more', 'find out', 'check out',
  'this article', 'this guide', 'this post', 'more info', 'see more',
  'here', 'link', 'page', 'article', 'post', 'guide', 'resource',
  'click', 'read', 'learn', 'find', 'check', 'see', 'view'
]);

// Stopwords to avoid at anchor boundaries
const BOUNDARY_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'this', 'that', 'these',
  'those', 'it', 'its', 'they', 'their', 'your', 'our', 'my'
]);

// SEO power words that boost anchor quality
const POWER_WORDS = new Set([
  'guide', 'tutorial', 'tips', 'strategies', 'techniques', 'methods',
  'best', 'ultimate', 'complete', 'comprehensive', 'essential', 'proven',
  'effective', 'professional', 'advanced', 'beginner', 'step-by-step',
  'how-to', 'examples', 'tools', 'resources', 'practices', 'benefits'
]);

// ==================== MAIN ORCHESTRATOR CLASS ====================

export class InternalLinkOrchestrator {
  private config: OrchestratorConfig;
  private usedSlugs: Set<string>;
  private usedAnchors: Set<string>;
  private linkPositions: number[];
  private linkCount: number;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.usedSlugs = new Set();
    this.usedAnchors = new Set();
    this.linkPositions = [];
    this.linkCount = 0;
  }

  /**
   * Reset state for new document
   */
  reset(): void {
    this.usedSlugs.clear();
    this.usedAnchors.clear();
    this.linkPositions = [];
    this.linkCount = 0;
  }

  /**
   * Process HTML content and inject internal links
   */
  async processContent(
    html: string,
    availablePages: SitemapPage[],
    baseUrl: string,
    currentKeyword?: string
  ): Promise<{ html: string; links: LinkCandidate[]; stats: any }> {
    this.reset();

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const injectedLinks: LinkCandidate[] = [];

    // Get linkable containers
    const containers = Array.from(doc.querySelectorAll('p, li'))
      .filter(el => this.isValidContainer(el));

    // Filter available pages
    const linkablePages = this.filterLinkablePages(availablePages, currentKeyword);

    // Process each container
    for (let i = 0; i < containers.length; i++) {
      if (this.linkCount >= this.config.maxLinksPerPost) break;

      const container = containers[i];
      const paragraphText = container.textContent || '';

      // Skip if already has links
      if (container.querySelectorAll('a').length >= 2) continue;

      // Find best link opportunity
      for (const page of linkablePages) {
        if (this.usedSlugs.has(page.slug)) continue;
        if (this.linkCount >= this.config.maxLinksPerPost) break;

        const candidate = this.findBestAnchor(paragraphText, page, i);
        if (!candidate) continue;

        // Inject the link
        const injected = this.injectLink(container, candidate, baseUrl);
        if (injected) {
          this.usedSlugs.add(page.slug);
          this.usedAnchors.add(candidate.anchorText.toLowerCase());
          this.linkCount++;
          injectedLinks.push(candidate);

          console.log(`[Orchestrator] ✅ Injected: "${candidate.anchorText}" → ${page.slug} (score: ${candidate.qualityScore.toFixed(2)})`);
          break; // One link per paragraph
        }
      }
    }

    return {
      html: doc.body.innerHTML,
      links: injectedLinks,
      stats: {
        totalLinks: this.linkCount,
        averageScore: injectedLinks.length > 0
          ? injectedLinks.reduce((s, l) => s + l.qualityScore, 0) / injectedLinks.length
          : 0,
        averageWordCount: injectedLinks.length > 0
          ? injectedLinks.reduce((s, l) => s + l.wordCount, 0) / injectedLinks.length
          : 0
      }
    };
  }

  /**
   * Check if container is valid for link injection
   */
  private isValidContainer(el: Element): boolean {
    const text = el.textContent || '';
    
    // Minimum text length
    if (text.length < 60) return false;
    
    // Skip special sections
    if (el.closest('.faq-section')) return false;
    if (el.closest('.key-takeaways')) return false;
    if (el.closest('.references-section')) return false;
    if (el.closest('blockquote')) return false;
    if (el.closest('table')) return false;
    
    return true;
  }

  /**
   * Filter pages suitable for linking
   */
  private filterLinkablePages(pages: SitemapPage[], currentKeyword?: string): SitemapPage[] {
    return pages.filter(page => {
      if (!page.slug || !page.title) return false;
      if (page.slug.length < 3) return false;
      
      // Don't link to current topic
      if (currentKeyword) {
        const titleLower = page.title.toLowerCase();
        const keywordLower = currentKeyword.toLowerCase();
        if (titleLower === keywordLower) return false;
      }
      
      return true;
    });
  }

  /**
   * Find the best anchor text for a page within paragraph text
   */
  private findBestAnchor(
    paragraphText: string,
    page: SitemapPage,
    paragraphIndex: number
  ): LinkCandidate | null {
    const words = paragraphText.split(/\s+/).filter(w => w.length > 0);
    if (words.length < this.config.minAnchorWords) return null;

    // Extract key terms from page title
    const titleTerms = this.extractKeyTerms(page.title);
    const slugTerms = this.extractKeyTerms(page.slug.replace(/-/g, ' '));
    const allTerms = [...new Set([...titleTerms, ...slugTerms])];

    let bestCandidate: LinkCandidate | null = null;
    let highestScore = 0;

    // Generate candidate phrases (3-7 words)
    for (let len = this.config.minAnchorWords; len <= this.config.maxAnchorWords; len++) {
      for (let start = 0; start <= words.length - len; start++) {
        const phraseWords = words.slice(start, start + len);
        const phrase = this.cleanPhrase(phraseWords.join(' '));
        
        if (!phrase || phrase.length < 12) continue;

        // Check if this is a forbidden anchor
        if (this.isForbiddenAnchor(phrase)) continue;

        // Check if already used
        if (this.usedAnchors.has(phrase.toLowerCase())) continue;

        // Calculate quality score
        const score = this.calculateAnchorScore(phrase, allTerms, paragraphText);
        
        if (score > highestScore && score >= this.config.minQualityScore) {
          highestScore = score;
          bestCandidate = {
            anchorText: phrase,
            targetSlug: page.slug,
            targetTitle: page.title,
            qualityScore: score,
            wordCount: phraseWords.length,
            semanticRelevance: this.calculateSemanticRelevance(phrase, allTerms),
            contextualFit: this.calculateContextualFit(phrase, paragraphText),
            position: start,
            paragraphIndex
          };
        }
      }
    }

    return bestCandidate;
  }

  /**
   * Extract key terms from text (removing stopwords)
   */
  private extractKeyTerms(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !BOUNDARY_STOPWORDS.has(w));
  }

  /**
   * Clean and validate phrase
   */
  private cleanPhrase(phrase: string): string {
    // Remove leading/trailing punctuation
    let cleaned = phrase.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]+$/, '').trim();
    
    const words = cleaned.split(/\s+/);
    
    // Remove leading stopwords
    while (words.length > this.config.minAnchorWords && 
           BOUNDARY_STOPWORDS.has(words[0].toLowerCase())) {
      words.shift();
    }
    
    // Remove trailing stopwords
    while (words.length > this.config.minAnchorWords && 
           BOUNDARY_STOPWORDS.has(words[words.length - 1].toLowerCase())) {
      words.pop();
    }
    
    return words.join(' ');
  }

  /**
   * Check if anchor is forbidden
   */
  private isForbiddenAnchor(anchor: string): boolean {
    const lower = anchor.toLowerCase();
    
    // Exact match
    if (FORBIDDEN_ANCHORS.has(lower)) return true;
    
    // Contains forbidden phrase
    for (const forbidden of FORBIDDEN_ANCHORS) {
      if (lower === forbidden) return true;
    }
    
    return false;
  }

  /**
   * Calculate overall anchor quality score
   */
  private calculateAnchorScore(
    anchor: string,
    targetTerms: string[],
    paragraphText: string
  ): number {
    let score = 0;
    const anchorLower = anchor.toLowerCase();
    const anchorWords = anchorLower.split(/\s+/);

    // Term matching (0-40 points)
    let matchedTerms = 0;
    for (const term of targetTerms) {
      if (anchorLower.includes(term)) {
        matchedTerms++;
        score += 0.12;
      }
    }
    
    // Require at least 1 term match
    if (matchedTerms === 0) return 0;

    // Multiple term matches bonus
    if (matchedTerms >= 2) score += 0.15;
    if (matchedTerms >= 3) score += 0.1;

    // Word count scoring (4-5 words is ideal)
    const wordCount = anchorWords.length;
    if (wordCount >= 4 && wordCount <= 5) score += 0.15;
    else if (wordCount === 3 || wordCount === 6) score += 0.08;

    // Power words bonus
    for (const word of anchorWords) {
      if (POWER_WORDS.has(word)) {
        score += 0.08;
        break; // Only count once
      }
    }

    // Descriptive quality
    if (this.isDescriptiveAnchor(anchor)) {
      score += 0.12;
    }

    // Contextual fit
    const contextScore = this.calculateContextualFit(anchor, paragraphText);
    score += contextScore * 0.15;

    // Penalize very short anchors
    if (anchor.length < 15) score -= 0.1;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate semantic relevance to target
   */
  private calculateSemanticRelevance(anchor: string, targetTerms: string[]): number {
    const anchorTerms = this.extractKeyTerms(anchor);
    if (anchorTerms.length === 0 || targetTerms.length === 0) return 0;

    const matches = anchorTerms.filter(t => targetTerms.includes(t)).length;
    return matches / Math.min(anchorTerms.length, targetTerms.length);
  }

  /**
   * Calculate how well anchor fits in context
   */
  private calculateContextualFit(anchor: string, paragraph: string): number {
    const paragraphLower = paragraph.toLowerCase();
    const anchorLower = anchor.toLowerCase();
    
    // Check if anchor appears naturally
    if (!paragraphLower.includes(anchorLower)) return 0;
    
    // Position scoring (middle is best)
    const position = paragraphLower.indexOf(anchorLower) / paragraph.length;
    let score = 0.5;
    
    if (position >= 0.2 && position <= 0.8) score += 0.3;
    if (position >= 0.3 && position <= 0.7) score += 0.2;
    
    return score;
  }

  /**
   * Check if anchor is descriptive (not generic)
   */
  private isDescriptiveAnchor(anchor: string): boolean {
    const words = anchor.toLowerCase().split(/\s+/);
    
    // Check for descriptive patterns
    const hasNoun = words.some(w => w.length > 4);
    const hasModifier = words.some(w => 
      POWER_WORDS.has(w) || 
      ['how', 'what', 'why', 'when', 'which', 'best', 'top', 'great'].includes(w)
    );
    
    return hasNoun && (hasModifier || words.length >= 4);
  }

  /**
   * Inject link into container
   */
  private injectLink(
    container: Element,
    candidate: LinkCandidate,
    baseUrl: string
  ): boolean {
    const html = container.innerHTML;
    const anchor = candidate.anchorText;
    
    // Create regex that matches the exact phrase
    const escapedAnchor = escapeRegExp(anchor);
    const regex = new RegExp(`\\b(${escapedAnchor})\\b(?![^<]*<\\/a>)`, 'i');
    
    if (!regex.test(html)) return false;
    
    // Build link HTML
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const linkUrl = `${cleanBaseUrl}/${candidate.targetSlug}/`;
    const linkHtml = `<a href="${linkUrl}">${anchor}</a>`;
    
    // Replace first occurrence only
    const newHtml = html.replace(regex, linkHtml);
    
    if (newHtml !== html) {
      container.innerHTML = newHtml;
      return true;
    }
    
    return false;
  }

  /**
   * Get statistics
   */
  getStats(): { linksInjected: number; uniqueTargets: number; uniqueAnchors: number } {
    return {
      linksInjected: this.linkCount,
      uniqueTargets: this.usedSlugs.size,
      uniqueAnchors: this.usedAnchors.size
    };
  }
}

// ==================== FACTORY FUNCTION ====================

export const createLinkOrchestrator = (config?: Partial<OrchestratorConfig>) => {
  return new InternalLinkOrchestrator(config);
};

// ==================== EXPORTS ====================

export default InternalLinkOrchestrator;
