// =============================================================================
// SOTA SERVICES.TSX v15.0 - ENTERPRISE GRADE
// Complete Content Generation Engine with YouTube, References, Internal Links
// =============================================================================

// =============================================================================
// ADD THESE IMPORTS AT THE TOP OF services.tsx
// =============================================================================

// YouTube Service
import { 
  searchYouTubeVideos, 
  generateYouTubeEmbed,
  findAndEmbedYouTubeVideo,
  YouTubeSearchResult 
} from './YouTubeService';

// Reference Service
import { 
  fetchVerifiedReferences as fetchRefsFromService,
  generateReferencesHtml,
  detectCategory,
  determineAuthorityLevel,
  REFERENCE_CATEGORIES,
  VerifiedReference,
  ReferenceCategory
} from './ReferenceService';

// Internal Link Orchestrator
import { 
  InternalLinkOrchestrator,
  createLinkOrchestrator,
  LinkCandidate 
} from './InternalLinkOrchestrator';


import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { PROMPT_TEMPLATES } from './prompts';
import { generateFullSchema } from './schema-generator';
import { 
  ContentItem, GeneratedContent, SitemapPage, GenerationContext, 
  ApiClients, WpConfig, ExpandedGeoTargeting 
} from './types';
import { fetchWithProxies, smartCrawl, processInternalLinks, escapeRegExp } from './contentUtils';
import { callAiWithRetry, extractSlugFromUrl, parseJsonWithAiRepair } from './utils';

console.log('[SOTA Services v15.0] Enterprise Engine Initialized');

// ==================== TYPES ====================

interface YouTubeVideo {
  title: string;
  videoId: string;
  channel: string;
  description: string;
  thumbnail: string;
  relevanceScore: number;
}

interface VerifiedReference {
  title: string;
  url: string;
  domain: string;
  description: string;
  authority: 'high' | 'medium' | 'low';
  verified: boolean;
}

interface GenerationAnalytics {
  phase: string;
  progress: number;
  details: Record<string, any>;
  timestamp: Date;
}

// ==================== ANALYTICS ENGINE ====================

class AnalyticsEngine {
  private logs: GenerationAnalytics[] = [];
  private callback: ((msg: string, analytics?: GenerationAnalytics) => void) | null = null;

  setCallback(cb: (msg: string, analytics?: GenerationAnalytics) => void) {
    this.callback = cb;
  }

  log(phase: string, message: string, details: Record<string, any> = {}, progress: number = 0) {
    const analytics: GenerationAnalytics = {
      phase,
      progress,
      details,
      timestamp: new Date()
    };
    this.logs.push(analytics);
    
    const formattedMsg = `[${new Date().toLocaleTimeString()}] ${this.getEmoji(phase)} ${message}`;
    console.log(formattedMsg, details);
    
    if (this.callback) {
      this.callback(formattedMsg, analytics);
    }
  }

  private getEmoji(phase: string): string {
    const emojis: Record<string, string> = {
      'init': '🚀',
      'research': '🔍',
      'serp': '📊',
      'keywords': '🏷️',
      'competitors': '🎯',
      'youtube': '📹',
      'references': '📚',
      'content': '✍️',
      'links': '🔗',
      'schema': '📋',
      'validation': '✅',
      'publish': '🌐',
      'error': '❌',
      'success': '✨',
      'warning': '⚠️'
    };
    return emojis[phase] || '📝';
  }

  getSummary() {
    return {
      totalPhases: this.logs.length,
      phases: this.logs.map(l => l.phase),
      duration: this.logs.length > 1 
        ? (this.logs[this.logs.length - 1].timestamp.getTime() - this.logs[0].timestamp.getTime()) / 1000
        : 0
    };
  }

  reset() {
    this.logs = [];
  }
}

const analytics = new AnalyticsEngine();

// ==================== YOUTUBE VIDEO FINDER ====================

/**
 * Find highly relevant YouTube videos using Serper API
 * Returns embedded video HTML with proper formatting
 */
export const findRelevantYouTubeVideo = async (
  keyword: string,
  serperApiKey: string,
  logCallback?: (msg: string) => void
): Promise<{ html: string; video: YouTubeVideo | null }> => {
  if (!serperApiKey) {
    logCallback?.('[YouTube] ⚠️ No Serper API key - skipping YouTube search');
    return { html: '', video: null };
  }

  analytics.log('youtube', 'Searching for relevant YouTube videos...', { keyword });

  try {
    // Search YouTube specifically via Serper
    const searchQueries = [
      `${keyword} tutorial guide`,
      `${keyword} explained how to`,
      `${keyword} tips 2024 2025`
    ];

    let bestVideo: YouTubeVideo | null = null;
    let highestScore = 0;

    for (const query of searchQueries) {
      try {
        const response = await fetchWithProxies('https://google.serper.dev/videos', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: query,
            num: 10
          })
        });

        if (!response.ok) continue;
        const data = await response.json();
        const videos = data.videos || [];

        for (const video of videos) {
          // Only process YouTube videos
          if (!video.link?.includes('youtube.com/watch') && !video.link?.includes('youtu.be')) {
            continue;
          }

          // Extract video ID
          let videoId = '';
          if (video.link.includes('youtube.com/watch')) {
            const url = new URL(video.link);
            videoId = url.searchParams.get('v') || '';
          } else if (video.link.includes('youtu.be/')) {
            videoId = video.link.split('youtu.be/')[1]?.split('?')[0] || '';
          }

          if (!videoId) continue;

          // Calculate relevance score
          const titleLower = (video.title || '').toLowerCase();
          const keywordLower = keyword.toLowerCase();
          const keywordWords = keywordLower.split(/\s+/);

          let score = 0;
          
          // Title contains full keyword
          if (titleLower.includes(keywordLower)) score += 50;
          
          // Title contains keyword words
          keywordWords.forEach(word => {
            if (word.length > 3 && titleLower.includes(word)) score += 15;
          });

          // Prefer tutorials, guides, how-to content
          if (titleLower.includes('tutorial')) score += 20;
          if (titleLower.includes('guide')) score += 15;
          if (titleLower.includes('how to')) score += 15;
          if (titleLower.includes('explained')) score += 10;
          if (titleLower.includes('tips')) score += 10;

          // Prefer recent content (2024/2025 in title)
          if (titleLower.includes('2024') || titleLower.includes('2025') || titleLower.includes('2026')) {
            score += 25;
          }

          // Penalize very short titles (likely spam)
          if (video.title && video.title.length < 20) score -= 20;

          // Penalize clickbait patterns
          if (titleLower.includes('you won\'t believe') || titleLower.includes('shocking')) {
            score -= 30;
          }

          if (score > highestScore) {
            highestScore = score;
            bestVideo = {
              title: video.title || 'Related Video',
              videoId,
              channel: video.channel || 'YouTube',
              description: video.snippet || video.description || '',
              thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              relevanceScore: score
            };
          }
        }
      } catch (e) {
        console.error('[YouTube Search] Query failed:', query, e);
      }
    }

    if (!bestVideo || highestScore < 30) {
      analytics.log('youtube', 'No sufficiently relevant YouTube video found', { 
        highestScore, 
        threshold: 30 
      });
      return { html: '', video: null };
    }

    analytics.log('youtube', `Found relevant video: "${bestVideo.title}"`, {
      videoId: bestVideo.videoId,
      relevanceScore: bestVideo.relevanceScore,
      channel: bestVideo.channel
    });

    // Generate embedded video HTML
    const videoHtml = `
<div class="sota-youtube-embed" style="margin: 2.5rem 0; background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
  <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <span style="font-size: 1.5rem;">📹</span>
      <div>
        <h4 style="margin: 0; color: #E2E8F0; font-size: 1rem; font-weight: 600;">Recommended Video</h4>
        <p style="margin: 0.25rem 0 0; color: #94A3B8; font-size: 0.85rem;">${bestVideo.channel}</p>
      </div>
    </div>
  </div>
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
    <iframe 
      src="https://www.youtube.com/embed/${bestVideo.videoId}?rel=0&modestbranding=1" 
      title="${bestVideo.title.replace(/"/g, '&quot;')}"
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
      allowfullscreen
      loading="lazy"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    ></iframe>
  </div>
  <div style="padding: 1rem 1.5rem; background: rgba(0,0,0,0.2);">
    <p style="margin: 0; color: #CBD5E1; font-size: 0.9rem; line-height: 1.5;">
      <strong style="color: #E2E8F0;">${bestVideo.title}</strong>
    </p>
  </div>
</div>`;

    return { html: videoHtml, video: bestVideo };
  } catch (error: any) {
    analytics.log('error', `YouTube search failed: ${error.message}`);
    return { html: '', video: null };
  }
};

// ==================== VERIFIED REFERENCES ENGINE ====================

/**
 * Fetch and verify references using Serper API
 * Only returns links with HTTP 200 status
 */
export const fetchVerifiedReferences = async (
  keyword: string,
  semanticKeywords: string[],
  serperApiKey: string,
  wpUrl?: string,
  logCallback?: (msg: string) => void
): Promise<{ html: string; references: VerifiedReference[] }> => {
  if (!serperApiKey) {
    logCallback?.('[References] ⚠️ No Serper API key - skipping reference fetch');
    return { html: '', references: [] };
  }

  analytics.log('references', 'Fetching verified references...', { keyword, keywordCount: semanticKeywords.length });

  try {
    // Detect content category for targeted searches
    const category = detectContentCategory(keyword, semanticKeywords);
    const categoryConfig = REFERENCE_CATEGORIES[category];
    const currentYear = new Date().getFullYear();

    let userDomain = '';
    if (wpUrl) {
      try {
        userDomain = new URL(wpUrl).hostname.replace('www.', '');
      } catch (e) {}
    }

    // Build search queries based on category
    const searchQueries: string[] = [];
    
    if (categoryConfig) {
      const modifiers = categoryConfig.searchModifiers.slice(0, 2).join(' OR ');
      const domains = categoryConfig.authorityDomains.slice(0, 3).map(d => `site:${d}`).join(' OR ');
      searchQueries.push(`${keyword} "${modifiers}" (${domains}) ${currentYear}`);
      searchQueries.push(`${keyword} research study ${currentYear}`);
    } else {
      searchQueries.push(`${keyword} "research" "study" "data" ${currentYear}`);
      searchQueries.push(`${keyword} official guide ${currentYear}`);
    }

    const potentialReferences: any[] = [];

    // Execute searches
    for (const query of searchQueries) {
      try {
        const response = await fetchWithProxies('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query, num: 15 })
        });

        if (response.ok) {
          const data = await response.json();
          potentialReferences.push(...(data.organic || []));
        }
      } catch (e) {
        console.error('[Reference Search] Query failed:', query);
      }
    }

    analytics.log('references', `Found ${potentialReferences.length} potential references, validating...`);

    // Validate each reference
    const validatedReferences: VerifiedReference[] = [];
    const blockedDomains = [
      'linkedin.com', 'facebook.com', 'twitter.com', 'instagram.com',
      'pinterest.com', 'reddit.com', 'quora.com', 'medium.com',
      'youtube.com', 'tiktok.com', 'amazon.com', 'ebay.com'
    ];

    for (const ref of potentialReferences) {
      if (validatedReferences.length >= 10) break;

      try {
        const url = new URL(ref.link);
        const domain = url.hostname.replace('www.', '');

        // Skip blocked domains
        if (blockedDomains.some(d => domain.includes(d))) continue;
        
        // Skip own domain
        if (userDomain && domain.includes(userDomain)) continue;

        // Skip if already have this domain
        if (validatedReferences.some(r => r.domain === domain)) continue;

        // Validate link is accessible (HEAD request with timeout)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const checkResponse = await fetch(ref.link, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          clearTimeout(timeoutId);

          // ONLY accept 200 status
          if (checkResponse.status !== 200) {
            analytics.log('references', `Rejected: ${domain} (status ${checkResponse.status})`);
            continue;
          }
        } catch (e) {
          clearTimeout(timeoutId);
          continue;
        }

        // Determine authority level
        const authority = determineAuthorityLevel(domain, categoryConfig);

        validatedReferences.push({
          title: ref.title || domain,
          url: ref.link,
          domain,
          description: ref.snippet || '',
          authority,
          verified: true
        });

        analytics.log('references', `✅ Verified: ${domain}`, { authority, title: ref.title?.substring(0, 50) });
      } catch (e) {
        continue;
      }
    }

    if (validatedReferences.length === 0) {
      analytics.log('warning', 'No references passed validation');
      return { html: '', references: [] };
    }

    analytics.log('references', `Successfully validated ${validatedReferences.length} references`);

    // Generate HTML
    const referencesHtml = generateReferencesHtml(validatedReferences, category, keyword);

    return { html: referencesHtml, references: validatedReferences };
  } catch (error: any) {
    analytics.log('error', `Reference fetch failed: ${error.message}`);
    return { html: '', references: [] };
  }
};

// ==================== REFERENCE CATEGORIES ====================

interface CategoryConfig {
  keywords: string[];
  authorityDomains: string[];
  searchModifiers: string[];
}

const REFERENCE_CATEGORIES: Record<string, CategoryConfig> = {
  health: {
    keywords: ['health', 'medical', 'doctor', 'hospital', 'disease', 'treatment', 'symptom', 'medicine', 'wellness'],
    authorityDomains: ['nih.gov', 'cdc.gov', 'who.int', 'mayoclinic.org', 'healthline.com', 'webmd.com', 'ncbi.nlm.nih.gov'],
    searchModifiers: ['research', 'clinical study', 'medical review', 'health guidelines']
  },
  fitness: {
    keywords: ['fitness', 'workout', 'exercise', 'gym', 'training', 'muscle', 'cardio', 'running', 'strength', 'sports'],
    authorityDomains: ['acsm.org', 'nsca.com', 'runnersworld.com', 'bodybuilding.com', 'menshealth.com', 'womenshealthmag.com'],
    searchModifiers: ['training study', 'exercise science', 'sports research', 'fitness guidelines']
  },
  nutrition: {
    keywords: ['nutrition', 'diet', 'food', 'eating', 'calories', 'protein', 'vitamins', 'supplements', 'meal'],
    authorityDomains: ['nutrition.gov', 'eatright.org', 'examine.com', 'usda.gov', 'health.harvard.edu'],
    searchModifiers: ['nutrition research', 'dietary guidelines', 'food science', 'nutritional study']
  },
  technology: {
    keywords: ['technology', 'software', 'programming', 'code', 'app', 'digital', 'computer', 'AI', 'machine learning'],
    authorityDomains: ['ieee.org', 'acm.org', 'techcrunch.com', 'wired.com', 'arstechnica.com', 'github.com'],
    searchModifiers: ['technical documentation', 'research paper', 'industry analysis', 'tech review']
  },
  business: {
    keywords: ['business', 'startup', 'entrepreneur', 'marketing', 'sales', 'finance', 'investment', 'management'],
    authorityDomains: ['hbr.org', 'forbes.com', 'bloomberg.com', 'wsj.com', 'entrepreneur.com', 'inc.com'],
    searchModifiers: ['business study', 'market research', 'industry report', 'case study']
  },
  science: {
    keywords: ['science', 'research', 'study', 'experiment', 'physics', 'chemistry', 'biology', 'environment'],
    authorityDomains: ['nature.com', 'science.org', 'sciencedirect.com', 'plos.org', 'arxiv.org'],
    searchModifiers: ['peer-reviewed', 'scientific study', 'research paper', 'academic journal']
  }
};

function detectContentCategory(keyword: string, semanticKeywords: string[]): string {
  const allText = [keyword, ...semanticKeywords].join(' ').toLowerCase();
  
  let bestCategory = 'general';
  let highestScore = 0;

  for (const [category, config] of Object.entries(REFERENCE_CATEGORIES)) {
    let score = 0;
    for (const kw of config.keywords) {
      if (allText.includes(kw)) score += 10;
    }
    if (score > highestScore) {
      highestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

function determineAuthorityLevel(domain: string, categoryConfig?: CategoryConfig): 'high' | 'medium' | 'low' {
  // Government and educational domains
  if (domain.endsWith('.gov') || domain.endsWith('.edu')) return 'high';
  
  // International organizations
  if (domain.endsWith('.org') && ['who.int', 'nih.gov', 'cdc.gov'].some(d => domain.includes(d))) return 'high';
  
  // Category-specific authority domains
  if (categoryConfig?.authorityDomains.some(d => domain.includes(d))) return 'high';
  
  // Well-known publications
  const majorPublications = ['nytimes.com', 'bbc.com', 'reuters.com', 'apnews.com', 'npr.org'];
  if (majorPublications.some(d => domain.includes(d))) return 'high';

  // Academic and research
  if (domain.includes('ncbi') || domain.includes('pubmed') || domain.includes('scholar')) return 'high';

  return 'medium';
}

function generateReferencesHtml(references: VerifiedReference[], category: string, keyword: string): string {
  const categoryEmoji: Record<string, string> = {
    health: '🏥',
    fitness: '💪',
    nutrition: '🥗',
    technology: '💻',
    business: '📈',
    science: '🔬',
    general: '📚'
  };

  const emoji = categoryEmoji[category] || '📚';

  return `
<div class="sota-references-section" style="margin: 3rem 0; padding: 2rem; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 16px; border-left: 5px solid #3B82F6;">
  <h2 style="display: flex; align-items: center; gap: 0.75rem; margin: 0 0 1.5rem; color: #1e293b; font-size: 1.5rem;">
    <span>${emoji}</span> Trusted References & Further Reading
  </h2>
  <p style="margin: 0 0 1.5rem; color: #64748b; font-size: 0.9rem;">
    ✅ All sources verified as of ${new Date().toLocaleDateString()} • ${references.length} authoritative references
  </p>
  <div style="display: grid; gap: 1rem;">
    ${references.map((ref, idx) => `
    <div style="display: flex; gap: 1rem; padding: 1rem; background: white; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: transform 0.2s; border: 1px solid #e2e8f0;">
      <div style="flex-shrink: 0; width: 32px; height: 32px; background: ${ref.authority === 'high' ? '#10B981' : '#3B82F6'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.85rem;">
        ${idx + 1}
      </div>
      <div style="flex: 1; min-width: 0;">
        <a href="${ref.url}" target="_blank" rel="noopener noreferrer" style="color: #1e40af; text-decoration: none; font-weight: 600; font-size: 1rem; display: block; margin-bottom: 0.25rem;">
          ${ref.title}
        </a>
        <p style="margin: 0 0 0.5rem; color: #64748b; font-size: 0.85rem; line-height: 1.5;">
          ${ref.description.substring(0, 150)}${ref.description.length > 150 ? '...' : ''}
        </p>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="padding: 2px 8px; background: ${ref.authority === 'high' ? '#dcfce7' : '#e0f2fe'}; color: ${ref.authority === 'high' ? '#166534' : '#0369a1'}; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">
            ${ref.authority} authority
          </span>
          <span style="color: #94a3b8; font-size: 0.75rem;">${ref.domain}</span>
        </div>
      </div>
    </div>
    `).join('')}
  </div>
</div>`;
}

// ==================== ENHANCED INTERNAL LINKING ====================

/**
 * Generate high-quality internal links with rich contextual anchors
 * Minimum 3 words per anchor, highly relevant and descriptive
 */
export const generateEnhancedInternalLinks = async (
  content: string,
  existingPages: SitemapPage[],
  primaryKeyword: string,
  aiClient: any,
  selectedModel: string,
  logCallback?: (msg: string) => void
): Promise<{ html: string; linkCount: number; links: any[] }> => {
  if (!existingPages || existingPages.length === 0) {
    logCallback?.('[Internal Links] ⚠️ No existing pages available for linking');
    return { html: content, linkCount: 0, links: [] };
  }

  analytics.log('links', 'Generating enhanced internal links...', { 
    pageCount: existingPages.length,
    keyword: primaryKeyword 
  });

  // Extract paragraphs for link injection
  const doc = new DOMParser().parseFromString(content, 'text/html');
  const paragraphs = Array.from(doc.querySelectorAll('p, li')).filter(p => {
    const text = p.textContent || '';
    return text.length > 80 && !p.closest('blockquote') && !p.closest('.faq-section');
  });

  // Filter pages for linking (exclude current topic)
  const linkablePages = existingPages.filter(page => {
    const pageTitleLower = (page.title || '').toLowerCase();
    const keywordLower = primaryKeyword.toLowerCase();
    
    // Don't link to pages too similar to current content
    if (pageTitleLower.includes(keywordLower) && keywordLower.includes(pageTitleLower)) {
      return false;
    }
    
    return page.slug && page.title && page.slug.length > 3;
  });

  if (linkablePages.length === 0) {
    analytics.log('warning', 'No suitable pages for internal linking');
    return { html: content, linkCount: 0, links: [] };
  }

  const usedSlugs = new Set<string>();
  const injectedLinks: any[] = [];
  const targetLinkCount = Math.min(12, Math.max(6, Math.floor(paragraphs.length / 3)));

  // Process each paragraph
  for (const paragraph of paragraphs) {
    if (injectedLinks.length >= targetLinkCount) break;
    
    // Skip if already has links
    if (paragraph.querySelectorAll('a').length >= 2) continue;

    const paragraphText = paragraph.textContent || '';
    
    for (const page of linkablePages) {
      if (usedSlugs.has(page.slug)) continue;
      if (injectedLinks.length >= targetLinkCount) break;

      // Find the best anchor text (3-7 words)
      const anchor = findContextualAnchor(paragraphText, page);
      
      if (anchor && anchor.score >= 0.5) {
        // Verify anchor exists in paragraph
        if (paragraphText.toLowerCase().includes(anchor.text.toLowerCase())) {
          // Inject the link
          const linkUrl = `/${page.slug}/`;
          const linkHtml = `<a href="${linkUrl}">${anchor.text}</a>`;
          
          // Replace first occurrence only
          const regex = new RegExp(`\\b${escapeRegExp(anchor.text)}\\b`, 'i');
          if (regex.test(paragraph.innerHTML) && !paragraph.innerHTML.includes(`href="${linkUrl}"`)) {
            paragraph.innerHTML = paragraph.innerHTML.replace(regex, linkHtml);
            usedSlugs.add(page.slug);
            
            injectedLinks.push({
              anchor: anchor.text,
              targetSlug: page.slug,
              targetTitle: page.title,
              score: anchor.score,
              wordCount: anchor.text.split(/\s+/).length
            });

            analytics.log('links', `✅ Injected: "${anchor.text}" → ${page.slug}`, {
              score: anchor.score.toFixed(2),
              words: anchor.text.split(/\s+/).length
            });
          }
        }
      }
    }
  }

  analytics.log('links', `Internal linking complete: ${injectedLinks.length} links injected`, {
    targetCount: targetLinkCount,
    actualCount: injectedLinks.length,
    avgScore: injectedLinks.length > 0 
      ? (injectedLinks.reduce((s, l) => s + l.score, 0) / injectedLinks.length).toFixed(2)
      : 0
  });

  return {
    html: doc.body.innerHTML,
    linkCount: injectedLinks.length,
    links: injectedLinks
  };
};

interface AnchorCandidate {
  text: string;
  score: number;
}

function findContextualAnchor(paragraphText: string, page: SitemapPage): AnchorCandidate | null {
  const words = paragraphText.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 5) return null;

  const pageTitle = (page.title || '').toLowerCase();
  const pageSlug = (page.slug || '').toLowerCase().replace(/-/g, ' ');
  
  // Extract key terms from page title
  const titleWords = pageTitle
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  let bestCandidate: AnchorCandidate | null = null;
  let highestScore = 0;

  // Generate 3-7 word phrases
  for (let phraseLen = 3; phraseLen <= 7; phraseLen++) {
    for (let i = 0; i <= words.length - phraseLen; i++) {
      const phraseWords = words.slice(i, i + phraseLen);
      const phrase = phraseWords.join(' ').replace(/[.,!?;:'"]/g, '').trim();
      
      if (phrase.length < 15) continue;

      const phraseLower = phrase.toLowerCase();
      let score = 0;

      // Check for title word matches
      let matchedWords = 0;
      for (const titleWord of titleWords) {
        if (phraseLower.includes(titleWord)) {
          matchedWords++;
          score += 0.15;
        }
      }

      // Require at least 1 matching word
      if (matchedWords === 0) continue;

      // Bonus for multiple matches
      if (matchedWords >= 2) score += 0.2;
      if (matchedWords >= 3) score += 0.15;

      // Penalize stopword starts/ends
      const stopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
      if (stopwords.includes(phraseWords[0].toLowerCase())) score -= 0.1;
      if (stopwords.includes(phraseWords[phraseLen - 1].toLowerCase())) score -= 0.05;

      // Bonus for descriptive words
      const descriptive = ['guide', 'tips', 'best', 'how', 'complete', 'essential', 'ultimate', 'proven', 'effective'];
      descriptive.forEach(d => {
        if (phraseLower.includes(d)) score += 0.1;
      });

      // Prefer 4-5 word phrases (sweet spot)
      if (phraseLen === 4 || phraseLen === 5) score += 0.1;

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = { text: phrase, score };
      }
    }
  }

  return bestCandidate && bestCandidate.score >= 0.4 ? bestCandidate : null;
}

// ==================== MAIN AI CALL FUNCTION ====================

export const callAI = async (
  apiClients: ApiClients,
  selectedModel: string,
  geoTargeting: ExpandedGeoTargeting,
  openrouterModels: string[],
  selectedGroqModel: string,
  promptKey: keyof typeof PROMPT_TEMPLATES | string,
  args: any[],
  format: 'json' | 'html' = 'json',
  grounding: boolean = false
): Promise<string> => {
  const promptTemplate = PROMPT_TEMPLATES[promptKey as keyof typeof PROMPT_TEMPLATES];
  if (!promptTemplate) {
    throw new Error(`Unknown prompt key: ${promptKey}`);
  }

  const systemInstruction = promptTemplate.systemInstruction || '';
  const userPrompt = typeof promptTemplate.userPrompt === 'function'
    ? promptTemplate.userPrompt(...args)
    : promptTemplate.userPrompt;

  // Try selected model first, then fallback
  const modelOrder = [selectedModel, 'gemini', 'anthropic', 'openai', 'openrouter', 'groq'];
  
  for (const model of modelOrder) {
    const client = apiClients[model as keyof ApiClients];
    if (!client) continue;

    try {
      let response: string = '';

      switch (model) {
        case 'gemini':
          const geminiResult = await callAiWithRetry(() =>
            (client as any).models.generateContent({
              model: 'gemini-2.0-flash-exp',
              systemInstruction,
              contents: userPrompt,
              generationConfig: {
                responseMimeType: format === 'json' ? 'application/json' : 'text/plain',
                temperature: 0.7,
                maxOutputTokens: 8192
              }
            })
          );
          response = geminiResult?.response?.text?.() || geminiResult?.text || '';
          break;

        case 'anthropic':
          const anthropicResult = await callAiWithRetry(() =>
            (client as Anthropic).messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 8192,
              system: systemInstruction,
              messages: [{ role: 'user', content: userPrompt }]
            })
          );
          response = (anthropicResult as any).content?.[0]?.text || '';
          break;

        case 'openai':
          const openaiResult = await callAiWithRetry(() =>
            (client as OpenAI).chat.completions.create({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userPrompt }
              ],
              max_tokens: 8192,
              temperature: 0.7
            })
          );
          response = openaiResult.choices[0]?.message?.content || '';
          break;

        case 'openrouter':
          for (const orModel of openrouterModels) {
            try {
              const orResult = await (client as OpenAI).chat.completions.create({
                model: orModel,
                messages: [
                  { role: 'system', content: systemInstruction },
                  { role: 'user', content: userPrompt }
                ],
                max_tokens: 8192
              });
              response = orResult.choices[0]?.message?.content || '';
              if (response) break;
            } catch (e) {
              continue;
            }
          }
          break;

        case 'groq':
          const groqResult = await callAiWithRetry(() =>
            (client as OpenAI).chat.completions.create({
              model: selectedGroqModel,
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userPrompt }
              ],
              max_tokens: 8192
            })
          );
          response = groqResult.choices[0]?.message?.content || '';
          break;
      }

      if (response && response.trim().length > 10) {
        return response;
      }
    } catch (error: any) {
      console.error(`[callAI] ${model} failed:`, error.message);
      continue;
    }
  }

  throw new Error('All AI providers failed');
};

// ==================== CONTENT GENERATION ====================

export const generateContent = {
  async generateItems(
    items: ContentItem[],
    callAIFn: any,
    generateImageFn: any,
    context: GenerationContext,
    progressCallback: (progress: { current: number; total: number }) => void,
    stopRef: React.MutableRefObject<Set<string>>
  ) {
    const { dispatch, existingPages, siteInfo, wpConfig, geoTargeting, serperApiKey, neuronConfig } = context;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (stopRef.current.has(item.id)) {
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'idle', statusText: 'Stopped' } });
        continue;
      }

      progressCallback({ current: i + 1, total: items.length });
      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Initializing...' } });
      analytics.reset();

      try {
        // Phase 1: Research & SERP Analysis
        analytics.log('research', 'Starting content research...', { title: item.title });
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '🔍 Researching SERP data...' } });

        let serpData: any[] = [];
        if (serperApiKey) {
          try {
            const serpResponse = await fetchWithProxies('https://google.serper.dev/search', {
              method: 'POST',
              headers: { 'X-API-KEY': serperApiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ q: item.title, num: 10 })
            });
            const serpJson = await serpResponse.json();
            serpData = serpJson.organic || [];
            analytics.log('serp', `Found ${serpData.length} SERP results`);
          } catch (e) {
            analytics.log('warning', 'SERP fetch failed, continuing without SERP data');
          }
        }

        // Phase 2: Semantic Keywords
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '🏷️ Generating semantic keywords...' } });
        
        let semanticKeywords: string[] = [];
        try {
          const keywordResponse = await callAIFn('semantic_keyword_generator', [item.title, geoTargeting.location || null, serpData], 'json');
          const keywordData = JSON.parse(keywordResponse);
          semanticKeywords = keywordData.keywords || keywordData.semanticKeywords || [];
          analytics.log('keywords', `Generated ${semanticKeywords.length} semantic keywords`);
        } catch (e) {
          analytics.log('warning', 'Keyword generation failed, using defaults');
          semanticKeywords = [item.title];
        }

        // Phase 3: YouTube Video
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '📹 Finding relevant YouTube video...' } });
        
        const { html: youtubeHtml, video: youtubeVideo } = await findRelevantYouTubeVideo(
          item.title,
          serperApiKey,
          (msg) => analytics.log('youtube', msg)
        );

        // Phase 4: Main Content Generation
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '✍️ Writing comprehensive content...' } });
        
        const contentResponse = await callAIFn(
          'ultra_sota_article_writer',
          [item.title, semanticKeywords, existingPages, serpData, null, null],
          'html'
        );

        analytics.log('content', 'Main content generated', { length: contentResponse.length });

        // Phase 5: References
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '📚 Fetching verified references...' } });
        
        const { html: referencesHtml, references } = await fetchVerifiedReferences(
          item.title,
          semanticKeywords,
          serperApiKey,
          wpConfig.url,
          (msg) => analytics.log('references', msg)
        );

        // Phase 6: Internal Links
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '🔗 Injecting internal links...' } });
        
        let contentWithLinks = contentResponse;
        let linkResult = { linkCount: 0, links: [] as any[] };
        
        if (existingPages.length > 0) {
          const linkingResult = await generateEnhancedInternalLinks(
            contentResponse,
            existingPages,
            item.title,
            null,
            '',
            (msg) => analytics.log('links', msg)
          );
          contentWithLinks = linkingResult.html;
          linkResult = { linkCount: linkingResult.linkCount, links: linkingResult.links };
        }

        // Phase 7: Assemble Final Content
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '📋 Assembling final content...' } });

        // Insert YouTube video after first H2 or intro
        let finalContent = contentWithLinks;
        if (youtubeHtml) {
          const h2Match = finalContent.match(/<\/h2>/i);
          if (h2Match && h2Match.index !== undefined) {
            const insertPos = h2Match.index + h2Match[0].length;
            const afterH2 = finalContent.substring(insertPos);
            const nextPMatch = afterH2.match(/<\/p>/i);
            if (nextPMatch && nextPMatch.index !== undefined) {
              const finalInsertPos = insertPos + nextPMatch.index + nextPMatch[0].length;
              finalContent = finalContent.substring(0, finalInsertPos) + youtubeHtml + finalContent.substring(finalInsertPos);
            }
          }
        }

        // Add references at the end
        if (referencesHtml) {
          finalContent += referencesHtml;
        }

        // Phase 8: Schema Generation
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '📋 Generating schema markup...' } });
        
        const schemaData = generateFullSchema({
          pageType: item.type === 'pillar' ? 'pillar' : 'article',
          title: item.title,
          description: item.title,
          content: finalContent,
          url: wpConfig.url ? `${wpConfig.url}/${extractSlugFromUrl(item.title)}/` : '',
          datePublished: new Date().toISOString(),
          dateModified: new Date().toISOString(),
          author: siteInfo.authorName || 'Expert Author',
          authorUrl: siteInfo.authorUrl || wpConfig.url || '',
          publisher: siteInfo.orgName || 'Organization',
          publisherLogo: siteInfo.logoUrl || '',
          featuredImage: '',
          wordCount: finalContent.split(/\s+/).length,
          images: [],
          faqs: []
        });

        // Complete
        const generatedContent: GeneratedContent = {
          title: item.title,
          content: finalContent,
          metaDescription: `${item.title} - Comprehensive guide with expert insights, tips, and recommendations.`,
          slug: extractSlugFromUrl(item.title),
          schemaMarkup: JSON.stringify(schemaData, null, 2),
          primaryKeyword: item.title,
          semanticKeywords,
          youtubeVideo: youtubeVideo ? {
            title: youtubeVideo.title,
            videoId: youtubeVideo.videoId,
            embedded: true
          } : null,
          references: references.map(r => ({ title: r.title, url: r.url, verified: r.verified })),
          internalLinks: linkResult.links
        };

        dispatch({ type: 'SET_CONTENT', payload: { id: item.id, content: generatedContent } });
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'done', statusText: '✅ Complete' } });

        const summary = analytics.getSummary();
        analytics.log('success', `Generation complete in ${summary.duration.toFixed(1)}s`, {
          wordCount: finalContent.split(/\s+/).length,
          youtube: youtubeVideo ? 'Yes' : 'No',
          references: references.length,
          internalLinks: linkResult.linkCount
        });

      } catch (error: any) {
        analytics.log('error', `Generation failed: ${error.message}`);
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'error', statusText: error.message } });
      }
    }
  },

  async refreshItem(
    item: ContentItem,
    callAIFn: any,
    context: GenerationContext,
    aiRepairer: any
  ) {
    // Implementation for refreshing existing content
    const { dispatch, existingPages, wpConfig, serperApiKey } = context;
    
    analytics.log('init', 'Starting content refresh...', { title: item.title });
    
    try {
      if (!item.crawledContent) {
        throw new Error('No crawled content available');
      }

      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '🔄 Analyzing existing content...' } });

      // Extract semantic keywords from existing content
      let semanticKeywords: string[] = [];
      try {
        const keywordResponse = await callAIFn('semantic_keyword_extractor', [item.crawledContent, item.title], 'json');
        const parsed = JSON.parse(keywordResponse);
        semanticKeywords = parsed.keywords || [];
      } catch (e) {
        semanticKeywords = [item.title];
      }

      // Optimize content
      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '✨ Optimizing content...' } });
      
      const optimizedContent = await callAIFn(
        'content_refresher',
        [item.crawledContent, item.title, semanticKeywords],
        'html'
      );

      // Get YouTube video
      const { html: youtubeHtml } = await findRelevantYouTubeVideo(item.title, serperApiKey);
      
      // Get references
      const { html: referencesHtml, references } = await fetchVerifiedReferences(
        item.title,
        semanticKeywords,
        serperApiKey,
        wpConfig.url
      );

      // Internal links
      let finalContent = optimizedContent;
      if (existingPages.length > 0) {
        const linkResult = await generateEnhancedInternalLinks(
          optimizedContent,
          existingPages,
          item.title,
          null,
          ''
        );
        finalContent = linkResult.html;
      }

      // Add YouTube and references
      if (youtubeHtml) {
        const insertMatch = finalContent.match(/<\/h2>/i);
        if (insertMatch && insertMatch.index !== undefined) {
          const pos = insertMatch.index + insertMatch[0].length;
          finalContent = finalContent.substring(0, pos) + youtubeHtml + finalContent.substring(pos);
        }
      }

      if (referencesHtml) {
        finalContent += referencesHtml;
      }

      const generatedContent: GeneratedContent = {
        title: item.title,
        content: finalContent,
        metaDescription: `${item.title} - Updated and comprehensive guide.`,
        slug: extractSlugFromUrl(item.originalUrl || item.title),
        schemaMarkup: '',
        primaryKeyword: item.title,
        semanticKeywords,
        references: references.map(r => ({ title: r.title, url: r.url, verified: r.verified }))
      };

      dispatch({ type: 'SET_CONTENT', payload: { id: item.id, content: generatedContent } });
      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'done', statusText: '✅ Refreshed' } });

    } catch (error: any) {
      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'error', statusText: error.message } });
    }
  },

  async analyzeContentGaps(
    existingPages: SitemapPage[],
    topic: string,
    callAIFn: any,
    context: GenerationContext
  ) {
    analytics.log('init', 'Analyzing content gaps...', { pageCount: existingPages.length, topic });
    
    const existingTitles = existingPages.map(p => p.title).join('\n');
    
    const gapResponse = await callAIFn(
      'gap_analyzer',
      [topic, existingTitles],
      'json'
    );

    try {
      const gaps = JSON.parse(gapResponse);
      return gaps.suggestions || gaps.gaps || [];
    } catch (e) {
      return [];
    }
  },

  async analyzePages(
    pages: SitemapPage[],
    callAIFn: any,
    setExistingPages: React.Dispatch<React.SetStateAction<SitemapPage[]>>,
    progressCallback: (progress: { current: number; total: number }) => void,
    shouldStop: () => boolean
  ) {
    for (let i = 0; i < pages.length; i++) {
      if (shouldStop()) break;
      
      const page = pages[i];
      progressCallback({ current: i + 1, total: pages.length });

      setExistingPages(prev => prev.map(p =>
        p.id === page.id ? { ...p, status: 'analyzing' as const } : p
      ));

      try {
        // Crawl content if not already
        let content = page.crawledContent;
        if (!content) {
          content = await smartCrawl(page.id);
        }

        // Analyze with AI
        const analysisResponse = await callAIFn(
          'content_health_analyzer',
          [content, page.title],
          'json'
        );

        const analysis = JSON.parse(analysisResponse);

        setExistingPages(prev => prev.map(p =>
          p.id === page.id ? {
            ...p,
            status: 'analyzed' as const,
            crawledContent: content,
            analysis,
            healthScore: analysis.healthScore || 50,
            updatePriority: analysis.priority || 'Medium'
          } : p
        ));
      } catch (error: any) {
        setExistingPages(prev => prev.map(p =>
          p.id === page.id ? {
            ...p,
            status: 'error' as const,
            justification: error.message
          } : p
        ));
      }
    }
  }
};

// ==================== PUBLISHING ====================

export const publishItemToWordPress = async (
  item: ContentItem,
  password: string,
  status: 'publish' | 'draft' | 'pending',
  fetchFn: typeof fetch,
  wpConfig: WpConfig
): Promise<{ success: boolean; message?: string; url?: string; postId?: number }> => {
  if (!item.generatedContent) {
    return { success: false, message: 'No generated content' };
  }

  if (!wpConfig.url || !wpConfig.username || !password) {
    return { success: false, message: 'WordPress credentials incomplete' };
  }

  const authHeader = `Basic ${btoa(`${wpConfig.username}:${password}`)}`;
  const baseUrl = wpConfig.url.replace(/\/+$/, '');

  try {
    // Check if post exists
    const slug = item.generatedContent.slug || extractSlugFromUrl(item.title);
    const searchResponse = await fetchFn(
      `${baseUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=any`,
      { method: 'GET', headers: { 'Authorization': authHeader } }
    );
    const existingPosts = await searchResponse.json();
    const existingPost = Array.isArray(existingPosts) && existingPosts.length > 0 ? existingPosts[0] : null;

    const postData = {
      title: item.generatedContent.title,
      content: item.generatedContent.content,
      slug,
      status,
      meta: {
        _yoast_wpseo_metadesc: item.generatedContent.metaDescription,
        _yoast_wpseo_focuskw: item.generatedContent.primaryKeyword
      }
    };

    let response;
    if (existingPost) {
      response = await fetchFn(
        `${baseUrl}/wp-json/wp/v2/posts/${existingPost.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(postData)
        }
      );
    } else {
      response = await fetchFn(
        `${baseUrl}/wp-json/wp/v2/posts`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(postData)
        }
      );
    }

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, message: errorData.message || 'Publish failed' };
    }

    const result = await response.json();
    return {
      success: true,
      url: result.link,
      postId: result.id,
      message: existingPost ? 'Updated' : 'Published'
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

// ==================== IMAGE GENERATION ====================

export const generateImageWithFallback = async (
  apiClients: ApiClients,
  prompt: string
): Promise<string | null> => {
  // Try Gemini Imagen first
  if (apiClients.gemini) {
    try {
      const result = await (apiClients.gemini as any).models.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents: prompt,
        generationConfig: { responseModalities: ['image'] }
      });
      
      if (result?.response?.candidates?.[0]?.content?.parts) {
        const imagePart = result.response.candidates[0].content.parts.find(
          (p: any) => p.inlineData?.mimeType?.startsWith('image/')
        );
        if (imagePart?.inlineData?.data) {
          return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        }
      }
    } catch (e) {
      console.error('[Image Gen] Gemini failed:', e);
    }
  }

  // Try OpenAI DALL-E
  if (apiClients.openai) {
    try {
      const response = await (apiClients.openai as OpenAI).images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      });
      
      if (response.data[0]?.b64_json) {
        return `data:image/png;base64,${response.data[0].b64_json}`;
      }
    } catch (e) {
      console.error('[Image Gen] DALL-E failed:', e);
    }
  }

  return null;
};

// ==================== MAINTENANCE ENGINE (GOD MODE) ====================

class MaintenanceEngine {
  isRunning: boolean = false;
  logCallback: ((msg: string) => void) | null = null;
  private context: GenerationContext | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(context: GenerationContext) {
    if (this.isRunning) return;

    // Validate API clients
    const hasValidClient = context.apiClients && (
      context.apiClients.gemini ||
      context.apiClients.anthropic ||
      context.apiClients.openai ||
      context.apiClients.openrouter
    );

    if (!hasValidClient) {
      this.log('❌ CRITICAL ERROR: No AI API client initialized!');
      this.log('🔧 REQUIRED: Configure at least one AI API key in Settings');
      this.log('🛑 STOPPING: God Mode requires a valid AI API client');
      return;
    }

    this.isRunning = true;
    this.context = context;
    this.log('🚀 GOD MODE ACTIVATED - Autonomous Optimization Engine');
    this.log(`📊 Found ${context.existingPages.length} pages in sitemap`);
    this.log(`🎯 Priority URLs: ${context.priorityUrls?.length || 0}`);
    this.log(`🚫 Excluded URLs: ${context.excludedUrls?.length || 0}`);

    // Start optimization cycle
    this.runCycle();
    this.intervalId = setInterval(() => this.runCycle(), 60000); // Every minute
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.log('🛑 GOD MODE DEACTIVATED');
  }

  updateContext(context: GenerationContext) {
    this.context = context;
  }

  private log(msg: string) {
    console.log(`[GOD MODE] ${msg}`);
    if (this.logCallback) {
      this.logCallback(msg);
    }
  }

  private async runCycle() {
    if (!this.isRunning || !this.context) return;

    const { existingPages, priorityUrls, excludedUrls, priorityOnlyMode } = this.context;

    // Get pages to process
    let pagesToProcess = existingPages.filter(page => {
      // Check exclusions
      if (excludedUrls?.some(url => page.id.includes(url))) return false;
      
      // Check if recently processed (within 24 hours)
      const lastProcessed = localStorage.getItem(`sota_last_proc_${page.id}`);
      if (lastProcessed) {
        const hoursSince = (Date.now() - parseInt(lastProcessed)) / (1000 * 60 * 60);
        if (hoursSince < 24) return false;
      }

      return true;
    });

    // Priority mode
    if (priorityOnlyMode && priorityUrls && priorityUrls.length > 0) {
      pagesToProcess = pagesToProcess.filter(page =>
        priorityUrls.some(url => page.id.includes(url))
      );
    } else if (priorityUrls && priorityUrls.length > 0) {
      // Sort priority URLs first
      pagesToProcess.sort((a, b) => {
        const aIsPriority = priorityUrls.some(url => a.id.includes(url));
        const bIsPriority = priorityUrls.some(url => b.id.includes(url));
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;
        return 0;
      });
    }

    if (pagesToProcess.length === 0) {
      this.log('💤 No pages need optimization at this time');
      return;
    }

    const page = pagesToProcess[0];
    this.log(`🎯 Processing: ${page.title || page.id}`);

    try {
      await this.optimizePage(page);
      localStorage.setItem(`sota_last_proc_${page.id}`, Date.now().toString());
      this.log(`✅ SUCCESS|${page.title}|${page.id}`);
    } catch (error: any) {
      this.log(`❌ FAILED: ${page.title} - ${error.message}`);
    }
  }

  private async optimizePage(page: SitemapPage) {
    if (!this.context) throw new Error('No context');

    // Crawl content
    this.log('📥 Crawling page content...');
    const content = await smartCrawl(page.id);
    
    if (!content || content.length < 500) {
      throw new Error('Content too short to optimize');
    }

    // Create AI call function
    const callAIFn = (promptKey: string, args: any[], format: 'json' | 'html' = 'json') => {
      return callAI(
        this.context!.apiClients,
        this.context!.selectedModel,
        this.context!.geoTargeting,
        this.context!.openrouterModels || [],
        this.context!.selectedGroqModel || '',
        promptKey,
        args,
        format
      );
    };

    // Extract keywords
    this.log('🏷️ Extracting semantic keywords...');
    let semanticKeywords: string[] = [];
    try {
      const kwResponse = await callAIFn('semantic_keyword_extractor', [content, page.title], 'json');
      const kwData = JSON.parse(kwResponse);
      semanticKeywords = kwData.keywords || [];
    } catch (e) {
      semanticKeywords = [page.title || 'content'];
    }

    // Optimize content
    this.log('✨ Optimizing content with AI...');
    const optimizedContent = await callAIFn(
      'content_optimizer',
      [content, semanticKeywords, page.title],
      'html'
    );

    // Add YouTube
    this.log('📹 Finding relevant video...');
    const { html: youtubeHtml } = await findRelevantYouTubeVideo(
      page.title || semanticKeywords[0],
      this.context.serperApiKey
    );

    // Add references
    this.log('📚 Fetching verified references...');
    const { html: referencesHtml } = await fetchVerifiedReferences(
      page.title || semanticKeywords[0],
      semanticKeywords,
      this.context.serperApiKey,
      this.context.wpConfig.url
    );

    // Add internal links
    this.log('🔗 Injecting internal links...');
    const linkResult = await generateEnhancedInternalLinks(
      optimizedContent,
      this.context.existingPages,
      page.title || '',
      null,
      ''
    );

    // Assemble final content
    let finalContent = linkResult.html;
    if (youtubeHtml) {
      const match = finalContent.match(/<\/h2>/i);
      if (match && match.index !== undefined) {
        const pos = match.index + match[0].length;
        finalContent = finalContent.substring(0, pos) + youtubeHtml + finalContent.substring(pos);
      }
    }
    if (referencesHtml) {
      finalContent += referencesHtml;
    }

    // Publish to WordPress
    this.log('🌐 Publishing to WordPress...');
    const result = await publishItemToWordPress(
      {
        id: page.id,
        title: page.title || 'Optimized Content',
        type: 'refresh',
        status: 'idle',
        statusText: '',
        generatedContent: {
          title: page.title || 'Optimized Content',
          content: finalContent,
          metaDescription: `${page.title} - Comprehensive guide`,
          slug: page.slug || extractSlugFromUrl(page.id),
          schemaMarkup: '',
          primaryKeyword: page.title || '',
          semanticKeywords
        },
        originalUrl: page.id,
        crawledContent: null
      },
      localStorage.getItem('sota_wp_password') || '',
      'publish',
      fetch,
      this.context.wpConfig
    );

    if (!result.success) {
      throw new Error(result.message || 'Publish failed');
    }

    this.log(`📊 Stats: ${linkResult.linkCount} links, ${semanticKeywords.length} keywords`);
  }
}

export const maintenanceEngine = new MaintenanceEngine();

// ==================== EXPORTS ====================

export {
  analytics as generationAnalytics,
  AnalyticsEngine,
  YouTubeVideo,
  VerifiedReference,
  GenerationAnalytics
};
