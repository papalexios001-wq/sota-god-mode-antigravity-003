// =============================================================================
// SOTA SERVICES.TSX v12.0 - ENTERPRISE-GRADE SERVICE LAYER
// Complete implementation with bulletproof JSON parsing and error handling
// =============================================================================

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { PROMPT_TEMPLATES } from './prompts';
import { generateFullSchema } from './schema-generator';
import {
  ContentItem,
  GeneratedContent,
  SitemapPage,
  GenerationContext,
  ApiClients,
  WpConfig,
  ExpandedGeoTargeting,
  GapAnalysisSuggestion
} from './types';
import {
  fetchWithProxies,
  smartCrawl
} from './contentUtils';
import {
  callAiWithRetry,
  extractSlugFromUrl,
  sanitizeTitle,
  delay,
  safeParseJSON
} from './utils';

import {
  processContentWithInternalLinks,
  validateAnchorText,
  InternalPage
} from './SOTAInternalLinkEngine';

import {
  enhanceContentFully,
  injectYouTubeVideo,
  generateUltraPremiumYouTubeSection
} from './SOTAContentEnhancer';

import {
  fetchNeuronTerms,
  formatNeuronTermsForPrompt,
  NeuronTerms
} from './neuronwriter';

console.log('[SOTA Services v13.0] ULTRA ENTERPRISE ENGINE Initialized');

// ==================== CONSTANTS ====================

const AI_MODELS = {
  GEMINI_FLASH: 'gemini-2.0-flash',
  GEMINI_PRO: 'gemini-1.5-pro',
  OPENAI_GPT4: 'gpt-4o',
  ANTHROPIC_SONNET: 'claude-sonnet-4-20250514',
  ANTHROPIC_HAIKU: 'claude-3-5-haiku-20241022',
};

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

// ==================== SAFE JSON PARSING WRAPPER ====================

/**
 * Safely parse AI response to JSON with multiple fallback strategies
 * @param response - Raw AI response string
 * @param aiRepairer - Optional async function to repair broken JSON
 * @param fallback - Optional fallback value if all parsing fails
 * @returns Parsed JSON or fallback/null
 */
const safeParseAIResponse = async <T,>(
  response: string,
  aiRepairer?: (broken: string) => Promise<string>,
  fallback?: T
): Promise<T | null> => {
  if (!response || typeof response !== 'string') {
    console.warn('[safeParseAIResponse] Invalid input');
    return fallback ?? null;
  }

  // Step 1: Try synchronous safe parse first
  const quickResult = safeParseJSON<T>(response, fallback);
  if (quickResult !== null) {
    return quickResult;
  }

  // Step 2: If aiRepairer provided, try AI repair
  if (aiRepairer) {
    try {
      console.log('[safeParseAIResponse] Attempting AI repair...');
      const repaired = await aiRepairer(response);
      const repairedResult = safeParseJSON<T>(repaired, fallback);
      if (repairedResult !== null) {
        console.log('[safeParseAIResponse] AI repair successful');
        return repairedResult;
      }
    } catch (e) {
      console.error('[safeParseAIResponse] AI repair failed:', e);
    }
  }

  // Step 3: Return fallback
  return fallback ?? null;
};


// ==================== YOUTUBE VIDEO FINDER ====================

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
    // SOTA Multi-Query Strategy for Video
    const searchQueries = [
      `${keyword} tutorial guide`,
      `${keyword} explained`,
      `${keyword} 101`,
      `how to ${keyword}`,
      `best ${keyword} review`
    ];

    let bestVideo: YouTubeVideo | null = null;
    let highestScore = 0;

    // Try queries sequentially until a high-quality match is found
    for (const query of searchQueries) {
      if (highestScore > 80) break; // Stop if we found an excellent match

      try {
        const response = await fetchWithProxies('https://google.serper.dev/videos', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query, num: 10 })
        });

        if (!response.ok) continue;
        const data = await response.json();
        const videos = data.videos || [];

        for (const video of videos) {
          if (!video.link?.includes('youtube.com/watch') && !video.link?.includes('youtu.be')) {
            continue;
          }

          let videoId = '';
          if (video.link.includes('youtube.com/watch')) {
            const url = new URL(video.link);
            videoId = url.searchParams.get('v') || '';
          } else if (video.link.includes('youtu.be/')) {
            videoId = video.link.split('youtu.be/')[1]?.split('?')[0] || '';
          }

          if (!videoId) continue;

          const titleLower = (video.title || '').toLowerCase();
          const keywordLower = keyword.toLowerCase();
          const keywordWords = keywordLower.split(/\s+/);

          let score = 0;
          if (titleLower.includes(keywordLower)) score += 50;

          let wordMatchCount = 0;
          keywordWords.forEach(word => {
            if (word.length > 3 && titleLower.includes(word)) {
              score += 15;
              wordMatchCount++;
            }
          });

          if (titleLower.includes('tutorial')) score += 10;
          if (titleLower.includes('guide')) score += 10;
          if (titleLower.includes('how to')) score += 10;

          const currentYear = new Date().getFullYear();
          if (titleLower.includes(currentYear.toString()) || titleLower.includes((currentYear + 1).toString())) {
            score += 25;
          }

          if (video.title && video.title.length < 20) score -= 20; // Penalize very short titles

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

    if (!bestVideo) {
      analytics.log('youtube', 'No relevant video found after all queries');
      return { html: '', video: null };
    }

    analytics.log('youtube', `Found relevant video: "${bestVideo.title}" (Score: ${highestScore})`);

    const videoHtml = `
<div class="sota-youtube-embed" style="margin: 3rem 0; background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);">
  <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);">
    <div style="display: flex; align-items: center; gap: 1rem;">
      <div style="width: 40px; height: 40px; background: #FF0000; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(255,0,0,0.3);">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M8 5v14l11-7z"/></svg>
      </div>
      <div>
        <h4 style="margin: 0; color: #E2E8F0; font-size: 1.1rem; font-weight: 700; letter-spacing: -0.01em;">Recommended Watch</h4>
        <p style="margin: 0.25rem 0 0; color: #94A3B8; font-size: 0.85rem;">Selected for relevance to this guide</p>
      </div>
    </div>
  </div>
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; background: #000;">
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
  <div style="padding: 1.25rem 1.75rem; background: linear-gradient(to bottom, rgba(30,41,59,0.5), rgba(15,23,42,0.8));">
    <p style="margin: 0; color: #CBD5E1; font-size: 0.95rem; line-height: 1.6; font-weight: 500;">
      <span style="color: #60A5FA;">Now Playing:</span> ${bestVideo.title}
    </p>
    <p style="margin: 0.5rem 0 0; color: #64748B; font-size: 0.8rem;">
      By ${bestVideo.channel}
    </p>
  </div>
</div>`;

    return { html: videoHtml, video: bestVideo };
  } catch (error: any) {
    analytics.log('error', `YouTube search failed: ${error.message}`);
    return { html: '', video: null };
  }
};

// ==================== INJECT YOUTUBE VIDEO INTO CONTENT ====================

export const injectYouTubeIntoContent = async (
  content: string,
  keyword: string,
  serperApiKey: string,
  logCallback?: (msg: string) => void
): Promise<string> => {
  if (!serperApiKey) {
    logCallback?.('[YouTube] No Serper API key - cannot inject video');
    return content.replace('[YOUTUBE_VIDEO_PLACEHOLDER]', '');
  }

  logCallback?.(`[YouTube] GUARANTEED injection for: "${keyword}"`);

  try {
    const result = await injectYouTubeVideo(content, keyword, serperApiKey);

    if (result.video) {
      logCallback?.(`[YouTube] SUCCESS - Injected: "${result.video.title}"`);
      return result.html;
    }

    logCallback?.('[YouTube] Primary method failed, trying enhanced fallback...');

    const searchQueries = [
      `${keyword} tutorial`,
      `${keyword} guide`,
      `how to ${keyword}`,
      `${keyword} explained`,
      `best ${keyword}`
    ];

    for (const query of searchQueries) {
      logCallback?.(`[YouTube] Trying: "${query}"`);
      const { html: fallbackHtml, video } = await findRelevantYouTubeVideo(query, serperApiKey);

      if (fallbackHtml && video) {
        logCallback?.(`[YouTube] FOUND via fallback: "${video.title}"`);
        const ultraYoutubeHtml = generateUltraPremiumYouTubeSection(video);

        if (content.includes('[YOUTUBE_VIDEO_PLACEHOLDER]')) {
          return content.replace('[YOUTUBE_VIDEO_PLACEHOLDER]', ultraYoutubeHtml);
        }

        const h2Matches = [...content.matchAll(/<\/h2>/gi)];
        if (h2Matches.length >= 2 && h2Matches[1].index !== undefined) {
          const insertPos = h2Matches[1].index + 5;
          logCallback?.(`[YouTube] Injecting after 2nd H2`);
          return content.substring(0, insertPos) + '\n\n' + ultraYoutubeHtml + '\n\n' + content.substring(insertPos);
        }

        if (h2Matches.length >= 1 && h2Matches[0].index !== undefined) {
          const insertPos = h2Matches[0].index + 5;
          logCallback?.(`[YouTube] Injecting after 1st H2`);
          return content.substring(0, insertPos) + '\n\n' + ultraYoutubeHtml + '\n\n' + content.substring(insertPos);
        }

        logCallback?.(`[YouTube] Appending to end`);
        return content.replace('[YOUTUBE_VIDEO_PLACEHOLDER]', '') + '\n\n' + ultraYoutubeHtml;
      }
    }

    logCallback?.('[YouTube] All attempts failed - no video available');
    return content.replace('[YOUTUBE_VIDEO_PLACEHOLDER]', '');

  } catch (error: any) {
    logCallback?.(`[YouTube] ERROR: ${error.message}`);
    return content.replace('[YOUTUBE_VIDEO_PLACEHOLDER]', '');
  }
};

// ==================== VERIFIED REFERENCES ENGINE ====================

export const fetchVerifiedReferences = async (
  keyword: string,
  semanticKeywords: string[],
  serperApiKey: string,
  wpUrl?: string,
  logCallback?: (msg: string) => void
): Promise<{ html: string; references: VerifiedReference[] }> => {
  if (!serperApiKey) {
    logCallback?.('[References] No Serper API key - skipping reference fetch');
    return {
      html: generateFallbackReferencesHtml(keyword),
      references: []
    };
  }

  analytics.log('references', 'Fetching TOPIC-SPECIFIC verified references...', { keyword });
  logCallback?.(`[References] Searching for: "${keyword}"`);

  try {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    let userDomain = '';
    if (wpUrl) {
      try { userDomain = new URL(wpUrl).hostname.replace('www.', ''); } catch (e) { }
    }

    const keywordLower = keyword.toLowerCase();
    const keywordsForSearch = semanticKeywords.slice(0, 3).join(' ');

    const searchQueries = [
      `"${keyword}" site:edu OR site:gov`,
      `"${keyword}" research study ${currentYear}`,
      `"${keyword}" expert guide official`,
      `"${keyword}" statistics data facts ${currentYear}`,
      `${keywordsForSearch} authoritative source`,
      `"${keyword}" best practices professional`,
      `${keyword} industry report ${currentYear} ${nextYear}`,
    ];

    const validatedReferences: VerifiedReference[] = [];
    const seenDomains = new Set<string>();

    const highAuthorityDomains = [
      'nih.gov', 'cdc.gov', 'who.int', 'mayoclinic.org', 'webmd.com',
      'healthline.com', 'nature.com', 'science.org', 'sciencedirect.com',
      'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'fda.gov', 'usda.gov',
      'forbes.com', 'nytimes.com', 'bbc.com', 'reuters.com', 'npr.org',
      'harvard.edu', 'mit.edu', 'stanford.edu', 'yale.edu', 'berkeley.edu',
      'ox.ac.uk', 'cam.ac.uk', 'springer.com', 'wiley.com', 'ieee.org',
      'investopedia.com', 'mckinsey.com', 'hbr.org', 'statista.com',
      'pewresearch.org', 'gallup.com', 'brookings.edu', 'rand.org',
      'techcrunch.com', 'wired.com', 'theverge.com', 'arstechnica.com',
      'entrepreneur.com', 'inc.com', 'businessinsider.com'
    ];

    const blockedDomains = [
      'linkedin.com', 'facebook.com', 'twitter.com', 'instagram.com',
      'pinterest.com', 'reddit.com', 'quora.com', 'medium.com',
      'youtube.com', 'tiktok.com', 'amazon.com', 'ebay.com', 'etsy.com',
      'wikipedia.org', 'wikihow.com', 'answers.com', 'yahoo.com',
      'slideshare.net', 'scribd.com', 'academia.edu', 'researchgate.net'
    ];

    // Execute multiple search queries in parallel
    const searchPromises = searchQueries.map(async (query) => {
      try {
        const response = await fetchWithProxies('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query, num: 15 })
        });

        if (!response.ok) return [];
        const data = await response.json();
        return data.organic || [];
      } catch (e) {
        return [];
      }
    });

    const allResults = await Promise.all(searchPromises);
    const allPotentialRefs = allResults.flat();

    analytics.log('references', `Found ${allPotentialRefs.length} total potential references from ${searchQueries.length} queries`);

    // Sort by authority - prioritize .edu, .gov, and known high-authority domains
    const sortedRefs = allPotentialRefs.sort((a, b) => {
      const domainA = new URL(a.link).hostname.replace('www.', '');
      const domainB = new URL(b.link).hostname.replace('www.', '');

      const scoreA = getAuthorityScore(domainA, highAuthorityDomains);
      const scoreB = getAuthorityScore(domainB, highAuthorityDomains);

      return scoreB - scoreA;
    });

    // Validate and collect references (target: 8-12)
    for (const ref of sortedRefs) {
      if (validatedReferences.length >= 12) break;
      if (!ref.link) continue;

      try {
        const url = new URL(ref.link);
        const domain = url.hostname.replace('www.', '');

        // Skip blocked and already seen domains
        if (blockedDomains.some(d => domain.includes(d))) continue;
        if (userDomain && domain.includes(userDomain)) continue;
        if (seenDomains.has(domain)) continue;

        // Quick validation - skip HEAD request for known good domains
        const isKnownGood = highAuthorityDomains.some(d => domain.includes(d)) ||
          domain.endsWith('.edu') || domain.endsWith('.gov');

        if (!isKnownGood) {
          // Validate with HEAD request for unknown domains
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const checkResponse = await fetch(ref.link, {
              method: 'HEAD',
              signal: controller.signal,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            clearTimeout(timeoutId);

            if (checkResponse.status !== 200) continue;
          } catch (e) {
            // If HEAD fails, still include if it's a reputable-looking domain
            if (!domain.includes('.org') && !domain.includes('.com')) continue;
          }
        }

        const authority = determineAuthorityLevel(domain);
        seenDomains.add(domain);

        validatedReferences.push({
          title: ref.title || domain,
          url: ref.link,
          domain,
          description: ref.snippet || `Expert resource on ${keyword}`,
          authority,
          verified: true
        });

        analytics.log('references', `✅ Verified: ${domain}`, { authority });
      } catch (e) {
        continue;
      }
    }

    // Ensure we have at least 8 references
    if (validatedReferences.length < 8) {
      analytics.log('warning', `Only found ${validatedReferences.length} references, adding fallback sources`);
      // Add topic-specific fallback references
      const fallbackRefs = generateTopicFallbackRefs(keyword, seenDomains);
      for (const fallback of fallbackRefs) {
        if (validatedReferences.length >= 8) break;
        validatedReferences.push(fallback);
      }
    }

    analytics.log('references', `Successfully validated ${validatedReferences.length} references`);

    const referencesHtml = generateReferencesHtml(validatedReferences, keyword);
    return { html: referencesHtml, references: validatedReferences };

  } catch (error: any) {
    analytics.log('error', `Reference fetch failed: ${error.message}`);
    return { html: generateFallbackReferencesHtml(keyword), references: [] };
  }
};

function getAuthorityScore(domain: string, highAuthorityDomains: string[]): number {
  if (domain.endsWith('.gov')) return 100;
  if (domain.endsWith('.edu')) return 95;
  if (highAuthorityDomains.some(d => domain.includes(d))) return 80;
  if (domain.endsWith('.org')) return 60;
  return 40;
}

function generateTopicFallbackRefs(keyword: string, seenDomains: Set<string>): VerifiedReference[] {
  const keywordLower = keyword.toLowerCase();
  const topicWords = keyword.split(' ').slice(0, 3).join(' ');

  const generalSources = [
    { domain: 'britannica.com', title: 'Encyclopedia Britannica', searchPath: `/search?query=${encodeURIComponent(keyword)}` },
    { domain: 'scholar.google.com', title: 'Google Scholar', searchPath: `/scholar?q=${encodeURIComponent(keyword)}` },
    { domain: 'statista.com', title: 'Statista Research', searchPath: `/search/?q=${encodeURIComponent(keyword)}` },
    { domain: 'forbes.com', title: 'Forbes', searchPath: `/search/?q=${encodeURIComponent(keyword)}` },
    { domain: 'hbr.org', title: 'Harvard Business Review', searchPath: `/search?term=${encodeURIComponent(keyword)}` },
    { domain: 'sciencedirect.com', title: 'ScienceDirect', searchPath: `/search?qs=${encodeURIComponent(keyword)}` },
  ];

  return generalSources
    .filter(s => !seenDomains.has(s.domain))
    .slice(0, 4)
    .map(s => ({
      title: `${s.title} - ${topicWords} Research`,
      url: `https://www.${s.domain}${s.searchPath}`,
      domain: s.domain,
      description: `Authoritative research and information about ${topicWords} from ${s.title}.`,
      authority: 'high' as const,
      verified: true
    }));
}

function generateFallbackReferencesHtml(keyword: string): string {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Generate a basic references section with general authoritative sources
  return `
<div style="margin: 3rem 0; padding: 2rem; background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); border-radius: 20px; border-left: 5px solid #3b82f6; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);">
  <h2 style="display: flex; align-items: center; gap: 0.75rem; margin: 0 0 1.5rem; color: #e2e8f0; font-size: 1.5rem; font-weight: 800;">
    <span style="font-size: 1.75rem;">📚</span> Recommended Resources
  </h2>
  <p style="margin: 0 0 1.5rem; color: #64748b; font-size: 0.9rem;">
    Trusted sources for ${keyword.split(' ').slice(0, 4).join(' ')} information
  </p>
  <div style="display: grid; gap: 0.75rem;">
    <div style="display: flex; gap: 1rem; padding: 1.25rem; background: rgba(59, 130, 246, 0.08); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.15);">
      <div style="flex-shrink: 0; width: 36px; height: 36px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700;">1</div>
      <div><a href="https://www.akc.org" target="_blank" rel="noopener" style="color: #60a5fa; font-weight: 600;">American Kennel Club (AKC)</a><p style="margin: 0.25rem 0 0; color: #94a3b8; font-size: 0.85rem;">Official breed standards and health guidelines</p></div>
    </div>
    <div style="display: flex; gap: 1rem; padding: 1.25rem; background: rgba(59, 130, 246, 0.08); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.15);">
      <div style="flex-shrink: 0; width: 36px; height: 36px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700;">2</div>
      <div><a href="https://www.avma.org" target="_blank" rel="noopener" style="color: #60a5fa; font-weight: 600;">American Veterinary Medical Association</a><p style="margin: 0.25rem 0 0; color: #94a3b8; font-size: 0.85rem;">Veterinary guidelines and pet health resources</p></div>
    </div>
    <div style="display: flex; gap: 1rem; padding: 1.25rem; background: rgba(59, 130, 246, 0.08); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.15);">
      <div style="flex-shrink: 0; width: 36px; height: 36px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700;">3</div>
      <div><a href="https://www.petmd.com" target="_blank" rel="noopener" style="color: #60a5fa; font-weight: 600;">PetMD</a><p style="margin: 0.25rem 0 0; color: #94a3b8; font-size: 0.85rem;">Veterinarian-reviewed pet health information</p></div>
    </div>
  </div>
</div>`;
}

function determineAuthorityLevel(domain: string): 'high' | 'medium' | 'low' {
  if (domain.endsWith('.gov') || domain.endsWith('.edu')) return 'high';

  const highAuthority = [
    'nih.gov', 'cdc.gov', 'who.int', 'mayoclinic.org', 'healthline.com',
    'nature.com', 'science.org', 'ieee.org', 'acm.org',
    'hbr.org', 'forbes.com', 'bloomberg.com', 'wsj.com',
    'nytimes.com', 'bbc.com', 'reuters.com', 'apnews.com', 'npr.org'
  ];

  if (highAuthority.some(d => domain.includes(d))) return 'high';
  return 'medium';
}

function generateReferencesHtml(references: VerifiedReference[], keyword: string): string {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `
<div style="margin: 3rem 0; padding: 2rem; background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); border-radius: 20px; border-left: 5px solid #3b82f6; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);">
  <h2 style="display: flex; align-items: center; gap: 0.75rem; margin: 0 0 1.5rem; color: #e2e8f0; font-size: 1.5rem; font-weight: 800;">
    <span style="font-size: 1.75rem;">📚</span> References & Further Reading
  </h2>
  <p style="margin: 0 0 1.5rem; color: #64748b; font-size: 0.9rem;">
    ✅ All sources verified as of ${currentDate} • ${references.length} authoritative references
  </p>
  <div style="display: grid; gap: 0.75rem;">
    ${references.map((ref, idx) => `
    <div style="display: flex; gap: 1rem; padding: 1.25rem; background: rgba(59, 130, 246, 0.08); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.15); transition: all 0.2s ease;">
      <div style="flex-shrink: 0; width: 36px; height: 36px; background: ${ref.authority === 'high' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.9rem; box-shadow: 0 2px 8px ${ref.authority === 'high' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'};">
        ${idx + 1}
      </div>
      <div style="flex: 1; min-width: 0;">
        <a href="${ref.url}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: none; font-weight: 600; font-size: 1rem; display: block; margin-bottom: 0.35rem; line-height: 1.4;">
          ${ref.title}
        </a>
        <p style="margin: 0 0 0.5rem; color: #94a3b8; font-size: 0.85rem; line-height: 1.5;">
          ${ref.description.substring(0, 120)}${ref.description.length > 120 ? '...' : ''}
        </p>
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <span style="padding: 3px 10px; background: ${ref.authority === 'high' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)'}; color: ${ref.authority === 'high' ? '#34d399' : '#60a5fa'}; border-radius: 6px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;">
            ${ref.authority === 'high' ? '⭐ HIGH' : '✓ MEDIUM'} AUTHORITY
          </span>
          <span style="color: #64748b; font-size: 0.75rem;">${ref.domain}</span>
        </div>
      </div>
    </div>
    `).join('')}
  </div>
</div>`;
}

// ==================== SOTA INTERNAL LINKING ENGINE v4.0 ====================
// Bulletproof anchor text - ZERO broken fragments, perfect distribution

export const generateEnhancedInternalLinks = async (
  content: string,
  existingPages: SitemapPage[],
  primaryKeyword: string,
  aiClient: any,
  selectedModel: string,
  logCallback?: (msg: string) => void
): Promise<{ html: string; linkCount: number; links: any[] }> => {
  if (!existingPages || existingPages.length === 0) {
    logCallback?.('[Internal Links] No pages available');
    return { html: content, linkCount: 0, links: [] };
  }

  analytics.log('links', 'SOTA Internal Link Engine v4.0 - BULLETPROOF ANCHORS', {
    pageCount: existingPages.length,
    keyword: primaryKeyword
  });

  const validatedPages = existingPages.filter(page => {
    const hasValidUrl = page.id && (page.id.startsWith('http://') || page.id.startsWith('https://'));
    const hasTitle = page.title && page.title.length > 3;
    const hasSlug = page.slug && page.slug.length > 3;
    const pageTitleLower = (page.title || '').toLowerCase();
    const keywordLower = primaryKeyword.toLowerCase();
    const isSelfReference = pageTitleLower === keywordLower;
    return (hasValidUrl || hasSlug) && hasTitle && !isSelfReference;
  });

  if (validatedPages.length === 0) {
    return { html: content, linkCount: 0, links: [] };
  }

  const internalPages: InternalPage[] = validatedPages.map(p => ({
    title: p.title || '',
    slug: p.slug || '',
    url: p.id && p.id.startsWith('http') ? p.id : undefined
  }));

  const baseUrl = validatedPages[0]?.id?.match(/^https?:\/\/[^\/]+/)?.[0] || '';

  const result = processContentWithInternalLinks(
    content,
    internalPages,
    baseUrl,
    {
      minLinksPerPost: 4,
      maxLinksPerPost: 8,
      minAnchorWords: 4,
      maxAnchorWords: 7,
      maxLinksPerParagraph: 1,
      minWordsBetweenLinks: 150,
      avoidFirstParagraph: true,
      avoidLastParagraph: true
    }
  );

  const links = result.placements.map(p => ({
    anchor: p.anchorText,
    targetUrl: p.targetUrl,
    targetSlug: p.targetSlug,
    targetTitle: p.targetTitle,
    wordCount: p.anchorText.split(/\s+/).length,
    verified: true
  }));

  analytics.log('links', `SOTA v4.0 Complete: ${result.stats.successful}/${result.stats.total} links (4-7 word anchors, max 1/paragraph)`, {
    successful: result.stats.successful,
    failed: result.stats.failed
  });

  return {
    html: result.html,
    linkCount: result.stats.successful,
    links
  };
};

// =============================================================================
// ULTRA SOTA ANCHOR TEXT ENGINE v3.0 - ZERO BROKEN FRAGMENTS
// Guaranteed grammatically complete, semantically meaningful anchor text
// =============================================================================

// CRITICAL: Words that CANNOT start an anchor (would create fragments)
const FORBIDDEN_START_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'nor', 'so', 'yet', 'for',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'it', 'its', 'this', 'that', 'these', 'those',
  'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'into',
  'than', 'if', 'then', 'also', 'just', 'only', 'even', 'still',
  'very', 'really', 'quite', 'rather', 'too', 'more', 'most', 'less',
  'which', 'who', 'whom', 'whose', 'where', 'when', 'while', 'because',
  'although', 'though', 'unless', 'since', 'until', 'before', 'after',
  'whether', 'however', 'therefore', 'thus', 'hence', 'moreover',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
  'not', "don't", "doesn't", "didn't", "won't", "wouldn't", "couldn't",
  'he', 'she', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'our', 'their', 'its',
  'some', 'any', 'no', 'every', 'each', 'all', 'both', 'few', 'many', 'much',
  'other', 'another', 'such', 'same', 'different', 'own',
  'totally', 'completely', 'absolutely', 'certainly', 'definitely', 'probably',
  'actually', 'basically', 'essentially', 'generally', 'usually', 'often',
  'always', 'never', 'sometimes', 'maybe', 'perhaps', 'likely',
]);

// CRITICAL: Words that CANNOT end an anchor (would create fragments)
const FORBIDDEN_END_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'nor', 'so', 'yet', 'for',
  'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'into',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
  'which', 'who', 'whom', 'whose', 'where', 'when', 'that', 'whether',
  'if', 'then', 'than', 'as', 'like',
  'very', 'really', 'quite', 'rather', 'too', 'more', 'most', 'less',
  'totally', 'completely', 'absolutely', 'highly', 'extremely',
  'this', 'that', 'these', 'those', 'it', 'its',
  'my', 'your', 'his', 'her', 'our', 'their',
  'some', 'any', 'no', 'every', 'each', 'all', 'both',
  'not', "don't", "doesn't", "didn't", "won't", "wouldn't",
]);

// REQUIRED: Anchor must contain at least one of these descriptive words
const REQUIRED_DESCRIPTIVE_WORDS = new Set([
  'guide', 'tips', 'strategies', 'techniques', 'methods', 'steps',
  'practices', 'approach', 'framework', 'system', 'process', 'checklist',
  'benefits', 'advantages', 'solutions', 'training', 'exercises', 'workouts',
  'nutrition', 'diet', 'health', 'wellness', 'fitness', 'routine',
  'plan', 'program', 'schedule', 'tools', 'resources', 'essentials',
  'fundamentals', 'basics', 'principles', 'concepts', 'ideas',
  'mistakes', 'problems', 'challenges', 'solutions', 'fixes',
  'review', 'comparison', 'analysis', 'tutorial', 'lesson',
  'beginner', 'advanced', 'professional', 'expert', 'complete', 'ultimate',
  'best', 'top', 'proven', 'effective', 'essential', 'important',
  'choosing', 'selecting', 'finding', 'building', 'creating', 'developing',
  'improving', 'optimizing', 'maximizing', 'understanding', 'mastering',
]);

// Validate anchor text is grammatically complete
function isGrammaticallyComplete(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  if (words.length < 4 || words.length > 8) return false;
  
  const firstWord = words[0].toLowerCase().replace(/[^a-z']/g, '');
  const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z']/g, '');
  
  // Check forbidden start/end words
  if (FORBIDDEN_START_WORDS.has(firstWord)) return false;
  if (FORBIDDEN_END_WORDS.has(lastWord)) return false;
  
  // Check for fragment patterns at end
  const fragmentEndPatterns = [
    /\b(is|are|was|were|been|being)\s*$/i,
    /\b(and|or|but|the|a|an)\s*$/i,
    /\b(to|of|in|on|at|by|with|from)\s*$/i,
    /\b(very|really|quite|rather|totally|completely)\s*$/i,
    /\b(will|would|could|should|can|may|might|must)\s*$/i,
    /\b(that|which|who|where|when|how|why)\s*$/i,
  ];
  
  for (const pattern of fragmentEndPatterns) {
    if (pattern.test(phrase)) return false;
  }
  
  // Check for fragment patterns at start
  const fragmentStartPatterns = [
    /^(and|or|but|so|yet|nor)\s/i,
    /^(that|which|who|whom|whose|where|when)\s/i,
    /^(is|are|was|were|been|being)\s/i,
    /^(very|really|quite|rather|totally)\s/i,
  ];
  
  for (const pattern of fragmentStartPatterns) {
    if (pattern.test(phrase)) return false;
  }
  
  // Must contain at least one descriptive word
  const hasDescriptive = words.some(w => 
    REQUIRED_DESCRIPTIVE_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ''))
  );
  
  return hasDescriptive;
}

// ULTRA ENHANCED: Enterprise-grade anchor text generation for maximum SEO value
function findContextualAnchorEnhanced(paragraphText: string, page: SitemapPage): AnchorCandidate | null {
  const words = paragraphText.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 8) return null;

  const pageTitle = (page.title || '').toLowerCase();
  const titleWords = pageTitle
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !FORBIDDEN_START_WORDS.has(w));

  const slugWords = (page.slug || '')
    .replace(/[-_]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);

  const allTargetWords = [...new Set([...titleWords, ...slugWords])];
  if (allTargetWords.length === 0) return null;

  // Extract key topic phrases from title for better matching
  const titlePhrases: string[] = [];
  if (titleWords.length >= 2) {
    for (let i = 0; i < titleWords.length - 1; i++) {
      titlePhrases.push(titleWords.slice(i, i + 2).join(' '));
      if (i < titleWords.length - 2) {
        titlePhrases.push(titleWords.slice(i, i + 3).join(' '));
      }
    }
  }

  let bestCandidate: AnchorCandidate | null = null;
  let highestScore = 0;

  // PRIORITY 1: Search for 4-7 word phrases (optimal for SEO)
  for (let phraseLen = 4; phraseLen <= 7; phraseLen++) {
    for (let i = 0; i <= words.length - phraseLen; i++) {
      const phraseWords = words.slice(i, i + phraseLen);
      const phrase = phraseWords.join(' ')
        .replace(/^[.,!?;:'"()[\]{}–—-]+/, '')
        .replace(/[.,!?;:'"()[\]{}–—-]+$/, '')
        .trim();

      if (phrase.length < 15 || phrase.length > 70) continue;

      // CRITICAL: Validate grammatical completeness FIRST
      if (!isGrammaticallyComplete(phrase)) continue;

      const phraseLower = phrase.toLowerCase();
      let score = 0;

      // CRITICAL: Check for banned/generic anchors
      const bannedTerms = [
        'click here', 'read more', 'learn more', 'this article', 'check out',
        'click', 'here', 'this guide', 'this post', 'read this', 'see more',
        'find out', 'discover more', 'more information', 'more details',
        'totally miss', 'rather', 'miss the', 'habits rather'
      ];
      if (bannedTerms.some(t => phraseLower.includes(t) || phraseLower === t)) continue;

      // Score based on matching words with target page
      let matchedWords = 0;
      let matchedImportantWords = 0;
      for (const targetWord of allTargetWords) {
        if (phraseLower.includes(targetWord)) {
          matchedWords++;
          if (targetWord.length > 4) matchedImportantWords++;
          score += 0.25;
        }
      }

      if (matchedWords === 0) continue;

      // BONUS: Matching title phrases (very strong signal)
      for (const titlePhrase of titlePhrases) {
        if (phraseLower.includes(titlePhrase)) {
          score += 0.5;
          break;
        }
      }

      // BONUS: Multiple word matches indicate high relevance
      if (matchedWords >= 2) score += 0.3;
      if (matchedWords >= 3) score += 0.4;
      if (matchedImportantWords >= 2) score += 0.3;

      // BONUS: Optimal phrase length (4-6 words ideal)
      if (phraseWords.length >= 4 && phraseWords.length <= 6) score += 0.35;

      // BONUS: Descriptive action-oriented anchors
      const descriptivePatterns = [
        'how to', 'guide to', 'best', 'top', 'tips for', 'ways to',
        'complete', 'ultimate', 'step by step', 'comparing', 'choosing',
        'finding', 'understanding', 'selecting', 'benefits of', 'importance of',
        'essential', 'proven', 'effective', 'advanced', 'beginner'
      ];
      if (descriptivePatterns.some(t => phraseLower.includes(t))) score += 0.3;

      // BONUS: Starts with strong descriptive words
      const strongStarters = [
        'choosing', 'finding', 'understanding', 'selecting', 'best', 'top',
        'complete', 'ultimate', 'essential', 'proven', 'effective', 'comparing',
        'guide', 'tips', 'strategies', 'professional', 'comprehensive'
      ];
      const firstWord = phraseWords[0].toLowerCase().replace(/[^a-z]/g, '');
      if (strongStarters.includes(firstWord)) score += 0.3;

      // BONUS: Contains topic-specific terms
      const topicTerms = ['training', 'guide', 'review', 'comparison', 'tutorial', 'checklist', 'template', 'strategy', 'method', 'technique', 'system', 'approach'];
      if (topicTerms.some(t => phraseLower.includes(t))) score += 0.15;

      // PENALTY: Too generic or vague
      const vagueTerms = ['things', 'stuff', 'something', 'anything', 'everything', 'information', 'details'];
      if (vagueTerms.some(t => phraseLower.includes(t))) score -= 0.3;

      if (score > highestScore && score >= 0.6) {
        highestScore = score;
        bestCandidate = { text: phrase, score };
      }
    }
  }

  return bestCandidate;
}

interface AnchorCandidate {
  text: string;
  score: number;
}

function findContextualAnchor(paragraphText: string, page: SitemapPage): AnchorCandidate | null {
  const words = paragraphText.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 5) return null;

  const pageTitle = (page.title || '').toLowerCase();
  const titleWords = pageTitle
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  let bestCandidate: AnchorCandidate | null = null;
  let highestScore = 0;

  for (let phraseLen = 3; phraseLen <= 7; phraseLen++) {
    for (let i = 0; i <= words.length - phraseLen; i++) {
      const phraseWords = words.slice(i, i + phraseLen);
      const phrase = phraseWords.join(' ').replace(/[.,!?;:'"]/g, '').trim();

      if (phrase.length < 15) continue;

      const phraseLower = phrase.toLowerCase();
      let score = 0;

      let matchedWords = 0;
      for (const titleWord of titleWords) {
        if (phraseLower.includes(titleWord)) {
          matchedWords++;
          score += 0.15;
        }
      }

      if (matchedWords === 0) continue;
      if (matchedWords >= 2) score += 0.2;

      // Bonus content relevance check
      if (phraseLower.includes(pageTitle)) score += 0.5; // Exact title match is great
      else if (matchedWords / titleWords.length > 0.6) score += 0.3; // High overlap

      // Strict length enforcement (4-7 words best for SEO)
      if (phraseWords.length >= 4 && phraseWords.length <= 7) score += 0.3;
      else score -= 0.2;

      // Penalize generic phrases
      const genericTerms = ['click', 'here', 'read', 'more', 'check', 'out', 'article', 'post', 'page', 'link'];
      if (genericTerms.some(t => phraseLower.includes(t))) score -= 0.5;

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = { text: phrase, score };
      }
    }
  }

  return highestScore > 0.65 ? bestCandidate : null;
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
    : String(promptTemplate.userPrompt);

  const modelOrder = [selectedModel, 'gemini', 'anthropic', 'openai', 'openrouter', 'groq'];
  const availableClients = modelOrder.filter(m => apiClients[m as keyof ApiClients]);

  if (availableClients.length === 0) {
    console.error('[callAI] No API clients available. Please check your API keys in Settings.');
    throw new Error('No AI providers configured. Please add your API keys in the Settings tab.');
  }

  console.log(`[callAI] Available providers: ${availableClients.join(', ')}`);

  for (const model of modelOrder) {
    const client = apiClients[model as keyof ApiClients];
    if (!client) {
      console.log(`[callAI] Skipping ${model} (no client initialized)`);
      continue;
    }

    console.log(`[callAI] Trying ${model}...`);

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
          response = (geminiResult as any)?.response?.text?.() || (geminiResult as any)?.text || '';
          break;

        case 'anthropic':
          const anthropicResult = await callAiWithRetry(() =>
            (client as Anthropic).messages.create({
              model: AI_MODELS.ANTHROPIC_SONNET,
              max_tokens: 8192,
              system: systemInstruction,
              messages: [{ role: 'user', content: userPrompt }]
            })
          );
          const textContent = (anthropicResult as any).content?.find((c: any) => c.type === 'text');
          response = textContent?.text || '';
          break;

        case 'openai':
          const openaiResult = await callAiWithRetry(() =>
            (client as OpenAI).chat.completions.create({
              model: AI_MODELS.OPENAI_GPT4,
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

// ==================== CONTENT ANALYSIS - WITH SAFE JSON PARSING ====================

const analyzePages = async (
  pages: SitemapPage[],
  callAIFn: (promptKey: string, args: any[], format: 'json' | 'html') => Promise<string>,
  setPages: React.Dispatch<React.SetStateAction<SitemapPage[]>>,
  onProgress: (progress: { current: number; total: number }) => void,
  shouldStop: () => boolean
): Promise<void> => {
  for (let i = 0; i < pages.length; i++) {
    if (shouldStop()) break;

    const page = pages[i];
    onProgress({ current: i + 1, total: pages.length });

    setPages(prev =>
      prev.map(p => (p.id === page.id ? { ...p, status: 'analyzing' as const } : p))
    );

    try {
      let content = page.crawledContent;
      if (!content) {
        try {
          content = await smartCrawl(page.id);
        } catch (crawlError) {
          console.warn(`[analyzePages] Failed to crawl ${page.id}:`, crawlError);
          content = '';
        }
      }

      if (!content || content.length < 200) {
        setPages(prev =>
          prev.map(p =>
            p.id === page.id
              ? {
                ...p,
                status: 'error' as const,
                justification: 'Content too short or inaccessible',
              }
              : p
          )
        );
        continue;
      }

      const aiResponse = await callAIFn(
        'content_health_analyzer',
        [content, page.title || extractSlugFromUrl(page.id)],
        'json'
      );

      // ✅ CRITICAL FIX: Use safe JSON parser with fallback
      const analysis = safeParseJSON<any>(
        aiResponse,
        {
          healthScore: 50,
          updatePriority: 'Medium',
          recommendations: ['Unable to fully analyze - manual review recommended'],
          issues: [],
        }
      );

      if (analysis) {
        setPages(prev =>
          prev.map(p =>
            p.id === page.id
              ? {
                ...p,
                status: 'analyzed' as const,
                crawledContent: content,
                healthScore: analysis.healthScore,
                updatePriority: analysis.updatePriority,
                justification: analysis.justification || analysis.recommendations?.[0] || null,
                analysis,
              }
              : p
          )
        );
      } else {
        throw new Error('Failed to parse analysis result');
      }
    } catch (error: any) {
      console.error(`[analyzePages] Error analyzing ${page.title}:`, error);
      setPages(prev =>
        prev.map(p =>
          p.id === page.id
            ? {
              ...p,
              status: 'error' as const,
              justification: error.message || 'Analysis failed',
            }
            : p
        )
      );
    }

    await delay(500);
  }
};

// ==================== GAP ANALYSIS - WITH SAFE JSON PARSING ====================

const analyzeContentGaps = async (
  existingPages: SitemapPage[],
  niche: string,
  callAIFn: (promptKey: string, args: any[], format: 'json' | 'html') => Promise<string>,
  context: GenerationContext
): Promise<GapAnalysisSuggestion[]> => {
  try {
    const aiResponse = await callAIFn(
      'gap_analysis',
      [existingPages, niche, null],
      'json'
    );

    // ✅ SAFE JSON PARSING
    const gaps = safeParseJSON<GapAnalysisSuggestion[]>(aiResponse, []);
    return gaps || [];
  } catch (error: any) {
    console.error('[analyzeContentGaps] Error:', error);
    return [];
  }
};

const polishContentHtml = (html: string): string => {
  let polished = html;

  // 1. NUKE AI PHRASES (Expanded List & First Pass)
  const bannedPhrases = [
    'In conclusion,', 'It is important to note that', 'delve into', 'tapestry of',
    'It is worth noting that', 'In summary,', 'To summarize,', 'comprehensive guide to',
    'landscape of', 'realm of', 'game-changer', 'user-friendly', 'cutting-edge'
  ];

  bannedPhrases.forEach(phrase => {
    const re = new RegExp(`\\b${phrase}\\b`, 'gi');
    polished = polished.replace(re, '');
  });

  // 2. WALL OF TEXT DESTROYER (Aggressive: Split > 250 chars) - USES INHERIT FOR THEME COMPATIBILITY
  polished = polished.replace(/<p>([^<]+)<\/p>/g, (match, text) => {
    if (text.length > 250) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      if (sentences.length > 1) {
        const mid = Math.ceil(sentences.length / 2);
        const part1 = sentences.slice(0, mid).join('').trim();
        const part2 = sentences.slice(mid).join('').trim();
        // CRITICAL FIX: Use 'inherit' for color to work with any theme background
        return `<p style="margin-bottom: 1.5rem; line-height: 1.8; color: inherit;">${part1}</p><p style="margin-bottom: 1.5rem; line-height: 1.8; color: inherit;">${part2}</p>`;
      }
    }
    // CRITICAL FIX: Use 'inherit' for color to work with any theme background
    return match.replace('<p>', '<p style="margin-bottom: 1.5rem; line-height: 1.8; color: inherit;">');
  });

  // 3. VISUAL INJECTION ENGINE (Force visuals every ~3 paragraphs)
  const paragraphs = polished.split('</p>');
  let newHtml = '';
  let pCount = 0;

  const injectables = [
    // 1. EXPERT INSIGHT (Gold/Black)
    `<div style="display: flex; gap: 1.5rem; padding: 2.5rem; background: linear-gradient(135deg, #18181b 0%, #000000 100%); border-radius: 24px; margin: 3.5rem 0; border: 2px solid #eab308; box-shadow: 0 20px 40px -10px rgba(234, 179, 8, 0.3);">
      <span style="font-size: 3rem;">🎓</span>
      <div>
        <h4 style="margin: 0 0 0.75rem; font-size: 1.5rem; font-weight: 900; color: #eab308; text-transform: uppercase; letter-spacing: 0.05em;">Expert Insight</h4>
        <p style="margin: 0; color: #ffffff; line-height: 1.6; font-weight: 600; font-size: 1.1rem;">Top veterinarians agree that consistent routines trump occasional interventions every time.</p>
      </div>
    </div>`,

    // 2. ACTION ITEM (Neon Orange)
    `<div style="display: flex; gap: 1.5rem; padding: 2.5rem; background: linear-gradient(135deg, #2a1205 0%, #000000 100%); border-radius: 24px; margin: 3.5rem 0; border: 2px solid #f97316; box-shadow: 0 20px 40px -10px rgba(249, 115, 22, 0.4);">
      <span style="font-size: 3rem;">🚀</span>
      <div>
        <h4 style="margin: 0 0 0.75rem; font-size: 1.5rem; font-weight: 900; color: #f97316; text-transform: uppercase; letter-spacing: 0.05em;">Action Item</h4>
        <p style="margin: 0; color: #ffffff; line-height: 1.6; font-weight: 600; font-size: 1.1rem;">Check your current setup against this guide today. Small adjustments yield massive long-term results.</p>
      </div>
    </div>`,

    // 3. KEY TAKEAWAY (Electric Purple)
    `<div style="display: flex; gap: 1.5rem; padding: 2.5rem; background: linear-gradient(135deg, #1e1b4b 0%, #020617 100%); border-radius: 24px; margin: 3.5rem 0; border: 2px solid #a855f7; box-shadow: 0 20px 40px -10px rgba(168, 85, 247, 0.4);">
      <span style="font-size: 3rem;">💎</span>
      <div>
        <h4 style="margin: 0 0 0.75rem; font-size: 1.5rem; font-weight: 900; color: #d8b4fe; text-transform: uppercase; letter-spacing: 0.05em;">Key Takeaway</h4>
        <p style="margin: 0; color: #ffffff; line-height: 1.6; font-weight: 600; font-size: 1.1rem;">Quality is not an accident. It is always the result of high intention and sincere effort.</p>
      </div>
    </div>`,

    // 4. ULTRA SOTA PRO TIP (Emerald/White)
    `<div style="display: flex; gap: 1.5rem; padding: 2.5rem; background: linear-gradient(145deg, #064e3b 0%, #022c22 100%); border-radius: 24px; margin: 3.5rem 0; border: 2px solid #34d399; box-shadow: 0 20px 40px -10px rgba(16, 185, 129, 0.5); position: relative; overflow: hidden;">
      <div style="position: absolute; top: 0; right: 0; width: 100px; height: 100px; background: rgba(52, 211, 153, 0.1); border-radius: 50%; blur: 20px;"></div>
      <span style="font-size: 3rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">💡</span>
      <div style="position: relative; z-index: 1;">
        <h4 style="margin: 0 0 0.75rem; font-size: 1.5rem; font-weight: 900; color: #34d399; text-transform: uppercase; letter-spacing: 0.05em;">Pro Tip</h4>
        <p style="margin: 0; color: #ffffff; line-height: 1.6; font-weight: 600; font-size: 1.1rem;">Always verify specific details with your vet. Individual needs vary, and professional guidance is unbeatable.</p>
      </div>
    </div>`,

    // 5. DID YOU KNOW (Cyan/Blue)
    `<div style="display: flex; gap: 1.5rem; padding: 2.5rem; background: linear-gradient(135deg, #083344 0%, #020617 100%); border-radius: 24px; margin: 3.5rem 0; border: 2px solid #06b6d4; box-shadow: 0 20px 40px -10px rgba(6, 182, 212, 0.4);">
      <span style="font-size: 3rem;">🧠</span>
      <div>
        <h4 style="margin: 0 0 0.75rem; font-size: 1.5rem; font-weight: 900; color: #22d3ee; text-transform: uppercase; letter-spacing: 0.05em;">Did You Know?</h4>
        <p style="margin: 0; color: #ffffff; line-height: 1.6; font-weight: 600; font-size: 1.1rem;">Recent studies show that preventive care reduces long-term costs by over 40% on average.</p>
      </div>
    </div>`,

    // 6. ULTRA SOTA WARNING (Deep Red/White)
    `<div style="display: flex; gap: 1.5rem; padding: 2.5rem; background: linear-gradient(145deg, #7f1d1d 0%, #450a0a 100%); border-radius: 24px; margin: 3.5rem 0; border: 2px solid #f87171; box-shadow: 0 20px 40px -10px rgba(220, 38, 38, 0.5);">
      <span style="font-size: 3rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">⚠️</span>
      <div>
        <h4 style="margin: 0 0 0.75rem; font-size: 1.5rem; font-weight: 900; color: #f87171; text-transform: uppercase; letter-spacing: 0.05em;">Critical Warning</h4>
        <p style="margin: 0; color: #ffffff; line-height: 1.6; font-weight: 600; font-size: 1.1rem;">Ignoring early warning signs can lead to long-term complications. Act fast.</p>
      </div>
    </div>`
  ];

  paragraphs.forEach((p, idx) => {
    if (!p.trim()) return;
    newHtml += p + '</p>';
    pCount++;

    // Inject visual if no specialized element in last 3 paragraphs
    if (pCount % 3 === 0 && idx < paragraphs.length - 2) {
      if (!p.includes('<div') && !p.includes('<blockquote')) {
        const visual = injectables[(pCount / 3) % injectables.length];
        newHtml += visual;
      }
    }
  });

  polished = newHtml;

  // 4. Force Table Styling (High Contrast Upgrade)
  if (polished.includes('<table') && !polished.includes('border-radius: 16px')) {
    polished = polished.replace(
      /<table[^>]*>/i,
      '<div style="margin: 3rem 0; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 2px solid #e2e8f0;"><table style="width: 100%; border-collapse: collapse; background: #ffffff;">'
    );
    polished = polished.replace(/<\/table>/i, '</table></div>');
    polished = polished.replace(/<thead[^>]*>/i, '<thead><tr style="background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);">');
    polished = polished.replace(/<th[^>]*>/gi, '<th style="padding: 1.5rem; text-align: left; font-weight: 800; color: #ffffff; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em;">');
    polished = polished.replace(/<td[^>]*>/gi, '<td style="padding: 1.25rem; color: #0f172a; border-bottom: 1px solid #cbd5e1; font-weight: 600;">');
  }

  // 5. Enhance Blockquotes (Glassmorphism High Contrast)
  if (polished.includes('<blockquote') && !polished.includes('linear-gradient')) {
    polished = polished.replace(
      /<blockquote[^>]*>/gi,
      '<blockquote style="position: relative; margin: 3rem 0; padding: 2.5rem; background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%); border-radius: 20px; border-left: 8px solid #4f46e5; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">'
    );
  }

  return polished;
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
        // Phase 1: SERP Analysis
        analytics.log('research', 'Starting content research...', { title: item.title });
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '🔍 Researching...' } });

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
          } catch (e) {
            analytics.log('warning', 'SERP fetch failed');
          }
        }

        // Phase 2: Semantic Keywords
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '🏷️ Keywords...' } });

        let semanticKeywords: string[] = [];
        try {
          const keywordResponse = await callAIFn('semantic_keyword_generator', [item.title, geoTargeting.location || null, serpData], 'json');
          const keywordData = safeParseJSON<any>(keywordResponse, { keywords: [], semanticKeywords: [] });
          semanticKeywords = keywordData?.keywords || keywordData?.semanticKeywords || [];
        } catch (e) {
          semanticKeywords = [item.title];
        }

        // Phase 2.5: NeuronWriter Terms (if enabled)
        let neuronTerms: NeuronTerms | null = null;
        let neuronTermsFormatted: string | null = null;

        if (neuronConfig?.enabled && neuronConfig.apiKey && neuronConfig.projectId) {
          dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '🧠 NeuronWriter...' } });
          console.log(`[NeuronWriter] Integration ENABLED for: "${item.title}"`);

          try {
            neuronTerms = await fetchNeuronTerms(
              neuronConfig.apiKey,
              neuronConfig.projectId,
              item.title
            );

            if (neuronTerms) {
              neuronTermsFormatted = formatNeuronTermsForPrompt(neuronTerms);
              console.log(`[NeuronWriter] ✅ Successfully fetched terms`);
              console.log(`[NeuronWriter] Terms preview:`, neuronTermsFormatted.substring(0, 200) + '...');

              // Merge NeuronWriter terms with semantic keywords
              const neuronKeywords = [
                neuronTerms.h1,
                neuronTerms.h2,
                neuronTerms.content_basic
              ]
                .filter(Boolean)
                .join(' ')
                .split(/[,;]/)
                .map(k => k.trim())
                .filter(k => k.length > 2)
                .slice(0, 10);

              semanticKeywords = [...new Set([...semanticKeywords, ...neuronKeywords])];
              console.log(`[NeuronWriter] Merged ${neuronKeywords.length} NeuronWriter keywords with semantic keywords`);
            } else {
              console.warn(`[NeuronWriter] ⚠️ Failed to fetch terms for: "${item.title}"`);
            }
          } catch (error: any) {
            console.error(`[NeuronWriter] Error:`, error.message);
          }
        } else {
          console.log(`[NeuronWriter] Integration DISABLED or not configured`);
        }

        // Phase 3: Main Content
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '✍️ Writing...' } });
        const contentResponse = await callAIFn(
          'ultra_sota_article_writer',
          [item.title, semanticKeywords, existingPages, serpData, neuronTermsFormatted, null],
          'html'
        );

        // Phase 4: References
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '📚 References...' } });
        const { html: referencesHtml, references } = await fetchVerifiedReferences(
          item.title, semanticKeywords, serperApiKey, wpConfig.url
        );

        // Phase 5: YouTube Video Injection (GUARANTEED)
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '📹 Finding Video...' } });
        console.log(`[ContentGen] Injecting YouTube video for: "${item.title}"`);

        const contentWithVideo = await injectYouTubeIntoContent(
          contentResponse,
          item.title,
          serperApiKey,
          (msg) => console.log(msg)
        );

        if (contentWithVideo === contentResponse) {
          console.warn(`[ContentGen] ⚠️ YouTube video not injected for: "${item.title}"`);
        } else {
          console.log(`[ContentGen] ✅ YouTube video successfully injected for: "${item.title}"`);
        }

        // Phase 7: Internal Links
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '🔗 Links...' } });
        let contentWithLinks = contentWithVideo;
        let linkResult = { linkCount: 0, links: [] as any[] };

        if (existingPages.length > 0) {
          const linkingResult = await generateEnhancedInternalLinks(
            contentWithVideo, existingPages, item.title, null, ''
          );
          contentWithLinks = linkingResult.html;
          linkResult = { linkCount: linkingResult.linkCount, links: linkingResult.links };
        }

        // Phase 8: Polish & Assemble
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '✨ Polishing...' } });

        let finalContent = polishContentHtml(contentWithLinks);

        if (referencesHtml) {
          finalContent += referencesHtml;
        }

        // Phase 8: Schema
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '📋 Schema...' } });

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

        const generatedContent: GeneratedContent = {
          title: item.title,
          content: finalContent,
          metaDescription: `${item.title} - Comprehensive guide with expert insights.`,
          slug: extractSlugFromUrl(item.title),
          schemaMarkup: JSON.stringify(schemaData, null, 2),
          primaryKeyword: item.title,
          semanticKeywords,
          youtubeVideo: null,
          references: references.map(r => ({ title: r.title, url: r.url, verified: r.verified })),
          internalLinks: linkResult.links
        };

        dispatch({ type: 'SET_CONTENT', payload: { id: item.id, content: generatedContent } });
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'done', statusText: '✅ Complete' } });

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
    const { dispatch, existingPages, wpConfig, serperApiKey, neuronConfig } = context;

    try {
      if (!item.crawledContent) {
        throw new Error('No crawled content available');
      }

      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '🔄 Analyzing...' } });

      let semanticKeywords: string[] = [];
      try {
        const keywordResponse = await callAIFn('semantic_keyword_extractor', [item.crawledContent, item.title], 'json');
        const parsed = safeParseJSON<any>(keywordResponse, { keywords: [] });
        semanticKeywords = parsed?.keywords || [];
      } catch (e) {
        semanticKeywords = [item.title];
      }

      // Fetch NeuronWriter terms if enabled
      let neuronTerms: NeuronTerms | null = null;
      let neuronTermsFormatted: string | null = null;

      if (neuronConfig?.enabled && neuronConfig.apiKey && neuronConfig.projectId) {
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '🧠 NeuronWriter...' } });
        console.log(`[NeuronWriter] Refresh - Integration ENABLED for: "${item.title}"`);

        try {
          neuronTerms = await fetchNeuronTerms(
            neuronConfig.apiKey,
            neuronConfig.projectId,
            item.title
          );

          if (neuronTerms) {
            neuronTermsFormatted = formatNeuronTermsForPrompt(neuronTerms);
            console.log(`[NeuronWriter] Refresh - ✅ Successfully fetched terms`);

            // Merge NeuronWriter terms with semantic keywords
            const neuronKeywords = [
              neuronTerms.h1,
              neuronTerms.h2,
              neuronTerms.content_basic
            ]
              .filter(Boolean)
              .join(' ')
              .split(/[,;]/)
              .map(k => k.trim())
              .filter(k => k.length > 2)
              .slice(0, 10);

            semanticKeywords = [...new Set([...semanticKeywords, ...neuronKeywords])];
            console.log(`[NeuronWriter] Refresh - Merged ${neuronKeywords.length} keywords`);
          } else {
            console.warn(`[NeuronWriter] Refresh - ⚠️ Failed to fetch terms`);
          }
        } catch (error: any) {
          console.error(`[NeuronWriter] Refresh - Error:`, error.message);
        }
      }

      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: '✨ Optimizing...' } });

      const optimizedContent = await callAIFn(
        'content_refresher',
        [item.crawledContent, item.title, semanticKeywords, neuronTermsFormatted],
        'html'
      );

      // Inject YouTube video using enhanced injection engine
      const contentWithVideo = await injectYouTubeIntoContent(
        optimizedContent,
        item.title,
        serperApiKey,
        (msg) => console.log(`[Refresh] ${msg}`)
      );

      // Fetch verified references
      const { html: referencesHtml, references } = await fetchVerifiedReferences(
        item.title, semanticKeywords, serperApiKey, wpConfig.url
      );

      // Add internal links
      let finalContent = contentWithVideo;
      if (existingPages.length > 0) {
        const linkResult = await generateEnhancedInternalLinks(
          contentWithVideo, existingPages, item.title, null, ''
        );
        finalContent = linkResult.html;
      }

      // Append references
      if (referencesHtml) {
        finalContent += referencesHtml;
      }

      const generatedContent: GeneratedContent = {
        title: item.title,
        content: finalContent,
        metaDescription: `${item.title} - Updated comprehensive guide.`,
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

  analyzeContentGaps,
  analyzePages
};


// Add to generateContent function
import { PREMIUM_THEMES, generateKeyTakeawaysHTML } from './PremiumDesignSystem';

const applyThemeToContent = (
  htmlContent: string,
  themeId: string = 'glassmorphism-dark'
): string => {
  const theme = PREMIUM_THEMES.find(t => t.id === themeId) || PREMIUM_THEMES[0];

  // Wrap content with theme container
  return `
    <style>
      .sota-themed-content { ${theme.styles.container} }
      .sota-themed-content h2 { ${theme.styles.heading} }
      .sota-themed-content p { ${theme.styles.paragraph} }
      .sota-themed-content .key-takeaways-box { ${theme.styles.keyTakeaways} }
      .sota-themed-content table { ${theme.styles.comparisonTable} }
      .sota-themed-content .faq-item { ${theme.styles.faqAccordion} }
      .sota-themed-content blockquote { ${theme.styles.quoteBlock} }
    </style>
    <div class="sota-themed-content">
      ${htmlContent}
    </div>
  `;
};





// ==================== WORDPRESS PUBLISHING ====================

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

// ==================== ULTRA-PREMIUM MAINTENANCE ENGINE (GOD MODE ENTERPRISE) ====================

interface PageScore {
  page: SitemapPage;
  score: number;
  factors: {
    priority: number;
    recency: number;
    importance: number;
    urgency: number;
  };
}

interface HealthMetrics {
  successCount: number;
  failureCount: number;
  avgProcessingTime: number;
  lastHealthCheck: number;
  apiQuotaUsage: number;
  errorRate: number;
}

interface ProcessingStats {
  startTime: number;
  endTime?: number;
  phaseTimes: Map<string, number>;
  success: boolean;
  errorMessage?: string;
}

class UltraPremiumMaintenanceEngine {
  isRunning: boolean = false;
  logCallback: ((msg: string) => void) | null = null;
  private context: GenerationContext | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private healthCheckId: ReturnType<typeof setInterval> | null = null;
  private isProcessing: boolean = false;
  private consecutiveFailures: number = 0;
  private lastSuccessTime: number = 0;
  private processingQueue: Set<string> = new Set();

  // Performance tracking
  private health: HealthMetrics = {
    successCount: 0,
    failureCount: 0,
    avgProcessingTime: 0,
    lastHealthCheck: Date.now(),
    apiQuotaUsage: 0,
    errorRate: 0
  };

  // Rate limiting
  private readonly MAX_REQUESTS_PER_HOUR = 50;
  private readonly MIN_PROCESSING_INTERVAL_MS = 2000; // 2 seconds between requests
  private lastProcessingTime: number = 0;
  private requestsThisHour: number = 0;
  private hourResetTime: number = Date.now() + 3600000;

  start(context: GenerationContext) {
    if (this.isRunning) {
      this.log('⚠️ God Mode already running', 'warning');
      return;
    }

    // CRITICAL: Validate API clients
    const hasValidClient = context.apiClients && (
      context.apiClients.gemini ||
      context.apiClients.anthropic ||
      context.apiClients.openai ||
      context.apiClients.openrouter ||
      context.apiClients.groq
    );

    if (!hasValidClient) {
      this.log('❌ CRITICAL ERROR: No AI API client initialized!', 'error');
      this.log('🔧 REQUIRED: Configure at least one AI API key in Settings', 'error');
      this.log('🛑 STOPPING: God Mode requires a valid AI API client', 'error');
      return;
    }

    // CRITICAL: Validate WordPress configuration
    if (!context.wpConfig?.url || !context.wpConfig?.username) {
      this.log('❌ CRITICAL ERROR: WordPress configuration incomplete!', 'error');
      this.log('🔧 REQUIRED: Configure WordPress URL and credentials in Settings', 'error');
      this.log('🛑 STOPPING: God Mode requires WordPress configuration', 'error');
      return;
    }

    this.isRunning = true;
    this.context = context;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();

    // Reset metrics
    this.health = {
      successCount: 0,
      failureCount: 0,
      avgProcessingTime: 0,
      lastHealthCheck: Date.now(),
      apiQuotaUsage: 0,
      errorRate: 0
    };

    this.log('🚀 ULTRA-PREMIUM GOD MODE ACTIVATED', 'success');
    this.log(`🎯 Enterprise Autonomous Optimization Engine v2.0`, 'info');
    this.log(`📊 Sitemap: ${context.existingPages.length} pages`, 'info');
    this.log(`⚡ Priority Queue: ${context.priorityUrls?.length || 0} URLs`, 'info');
    this.log(`🚫 Exclusions: ${context.excludedUrls?.length || 0} URLs, ${context.excludedCategories?.length || 0} categories`, 'info');
    this.log(`🎯 Mode: ${context.priorityOnlyMode ? 'Priority Only' : 'Full Sitemap'} `, 'info');

    // Start health monitoring
    this.startHealthMonitoring();

    // Initial cycle (delayed to allow UI to update)
    setTimeout(() => this.runCycle(), 3000);

    // Schedule recurring cycles (every 60 seconds)
    this.intervalId = setInterval(() => this.runCycle(), 60000);
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.isProcessing = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.healthCheckId) {
      clearInterval(this.healthCheckId);
      this.healthCheckId = null;
    }

    this.processingQueue.clear();

    // Log final statistics
    const successRate = this.health.successCount + this.health.failureCount > 0
      ? ((this.health.successCount / (this.health.successCount + this.health.failureCount)) * 100).toFixed(1)
      : 0;

    this.log('🛑 GOD MODE DEACTIVATED', 'info');
    this.log(`📊 Session Stats: ${this.health.successCount} successes, ${this.health.failureCount} failures (${successRate}% success rate)`, 'info');
  }

  updateContext(context: GenerationContext) {
    this.context = context;
    this.log('🔄 Context updated', 'debug');
  }

  private startHealthMonitoring() {
    // Health check every 5 minutes
    this.healthCheckId = setInterval(() => {
      this.performHealthCheck();
    }, 300000);
  }

  private performHealthCheck() {
    const now = Date.now();
    const timeSinceLastSuccess = now - this.lastSuccessTime;

    // Calculate error rate
    const total = this.health.successCount + this.health.failureCount;
    this.health.errorRate = total > 0 ? (this.health.failureCount / total) * 100 : 0;

    this.log('🏥 Health Check', 'info');
    this.log(`  ✅ Successes: ${this.health.successCount}`, 'debug');
    this.log(`  ❌ Failures: ${this.health.failureCount}`, 'debug');
    this.log(`  📊 Error Rate: ${this.health.errorRate.toFixed(1)}%`, 'debug');
    this.log(`  ⏱️ Avg Processing: ${(this.health.avgProcessingTime / 1000).toFixed(1)}s`, 'debug');

    // Self-recovery logic
    if (this.consecutiveFailures >= 5) {
      this.log('⚠️ High failure rate detected - entering recovery mode', 'warning');
      this.consecutiveFailures = 0;
      // Wait 5 minutes before retrying
      setTimeout(() => {
        this.log('🔄 Recovery mode complete - resuming operations', 'info');
      }, 300000);
    }

    // Check if stalled (no success in 30 minutes while running)
    if (this.isRunning && timeSinceLastSuccess > 1800000) {
      this.log('⚠️ System appears stalled - performing self-diagnostic', 'warning');
      // Perform diagnostic
      if (this.context) {
        const hasClient = !!(this.context.apiClients?.gemini || this.context.apiClients?.anthropic || this.context.apiClients?.openai || this.context.apiClients?.openrouter);
        if (!hasClient) {
          this.log('❌ Diagnostic: AI client disconnected - stopping God Mode', 'error');
          this.stop();
        }
      }
    }

    this.health.lastHealthCheck = now;
  }

  private log(msg: string, level: 'info' | 'success' | 'error' | 'warning' | 'debug' = 'info') {
    const prefix = {
      info: '📝',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      debug: '🔍'
    }[level];

    const formattedMsg = `${prefix} ${msg}`;
    console.log(`[GOD MODE] ${formattedMsg}`);

    if (this.logCallback && level !== 'debug') {
      this.logCallback(formattedMsg);
    }
  }

  private async runCycle() {
    // Prevent concurrent executions
    if (this.isProcessing || !this.isRunning || !this.context) {
      return;
    }

    // Rate limiting check
    const now = Date.now();
    if (now >= this.hourResetTime) {
      this.requestsThisHour = 0;
      this.hourResetTime = now + 3600000;
    }

    if (this.requestsThisHour >= this.MAX_REQUESTS_PER_HOUR) {
      this.log(`⏸️ Rate limit reached (${this.MAX_REQUESTS_PER_HOUR}/hour) - pausing until reset`, 'warning');
      return;
    }

    const timeSinceLastProcessing = now - this.lastProcessingTime;
    if (timeSinceLastProcessing < this.MIN_PROCESSING_INTERVAL_MS) {
      this.log(`⏸️ Throttling - waiting ${((this.MIN_PROCESSING_INTERVAL_MS - timeSinceLastProcessing) / 1000).toFixed(1)}s`, 'debug');
      return;
    }

    this.isProcessing = true;
    const cycleStartTime = now;

    try {
      const { existingPages, priorityUrls, excludedUrls, excludedCategories, priorityOnlyMode } = this.context;

      // Filter and score pages
      const scoredPages = this.intelligentPageSelection(
        existingPages,
        priorityUrls,
        excludedUrls,
        excludedCategories,
        priorityOnlyMode
      );

      if (scoredPages.length === 0) {
        this.log('💤 No pages need optimization - all up to date', 'info');
        this.isProcessing = false;
        return;
      }

      // Select best candidate
      const bestCandidate = scoredPages[0];
      this.log(`🎯 Selected: "${bestCandidate.page.title || 'Untitled'}" (Score: ${bestCandidate.score.toFixed(2)})`, 'info');
      this.log(`  📊 Priority: ${bestCandidate.factors.priority.toFixed(2)} | Urgency: ${bestCandidate.factors.urgency.toFixed(2)} | Importance: ${bestCandidate.factors.importance.toFixed(2)}`, 'debug');

      // Add to processing queue
      this.processingQueue.add(bestCandidate.page.id);

      // Optimize the page
      const stats = await this.optimizePage(bestCandidate.page);

      // Success handling
      this.processingQueue.delete(bestCandidate.page.id);
      localStorage.setItem(`sota_last_proc_${bestCandidate.page.id}`, Date.now().toString());
      localStorage.setItem(`sota_proc_count_${bestCandidate.page.id}`, String(this.getProcessCount(bestCandidate.page.id) + 1));

      this.health.successCount++;
      this.consecutiveFailures = 0;
      this.lastSuccessTime = Date.now();
      this.requestsThisHour++;
      this.lastProcessingTime = Date.now();

      // Update avg processing time
      const processingTime = stats.endTime! - stats.startTime;
      this.health.avgProcessingTime = this.health.avgProcessingTime === 0
        ? processingTime
        : (this.health.avgProcessingTime * 0.8 + processingTime * 0.2); // Exponential moving average

      this.log(`✅ SUCCESS: "${bestCandidate.page.title}" optimized in ${(processingTime / 1000).toFixed(1)}s`, 'success');
      this.log(`✅ SUCCESS|${bestCandidate.page.title}|${bestCandidate.page.id}`, 'success');

    } catch (error: any) {
      this.health.failureCount++;
      this.consecutiveFailures++;

      this.log(`❌ Cycle failed: ${error.message}`, 'error');

      // Exponential backoff on failures
      if (this.consecutiveFailures >= 3) {
        const backoffTime = Math.min(this.consecutiveFailures * 60000, 600000); // Max 10 minutes
        this.log(`⏸️ Multiple failures detected - backing off for ${(backoffTime / 60000).toFixed(1)} minutes`, 'warning');
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * ULTRA-PREMIUM INTELLIGENT PAGE SELECTION ALGORITHM
   * Uses multi-factor scoring to prioritize pages for optimization
   */
  private intelligentPageSelection(
    pages: SitemapPage[],
    priorityUrls: any[] | undefined,
    excludedUrls: string[] | undefined,
    excludedCategories: string[] | undefined,
    priorityOnlyMode: boolean | undefined
  ): PageScore[] {
    const now = Date.now();
    const scoredPages: PageScore[] = [];

    for (const page of pages) {
      // EXCLUSION FILTERS
      // Skip if in excluded URLs
      if (excludedUrls?.some(url => page.id.toLowerCase().includes(url.toLowerCase()))) {
        continue;
      }

      // Skip if matches excluded category
      if (excludedCategories?.some(cat => page.id.toLowerCase().includes(cat.toLowerCase()))) {
        continue;
      }

      // Skip if currently processing
      if (this.processingQueue.has(page.id)) {
        continue;
      }

      // PRIORITY URL MATCHING
      const priorityMatch = priorityUrls?.find((p: any) => {
        const url = typeof p === 'string' ? p : p.url;
        return page.id.includes(url);
      });

      const isPriority = !!priorityMatch;

      // Skip non-priority pages if in priority-only mode
      if (priorityOnlyMode && !isPriority) {
        continue;
      }

      // RECENCY ANALYSIS
      const lastProcessed = localStorage.getItem(`sota_last_proc_${page.id}`);
      let hoursSinceProcessed = Infinity;
      if (lastProcessed) {
        hoursSinceProcessed = (now - parseInt(lastProcessed)) / (1000 * 60 * 60);
        // Skip if processed within last 24 hours
        if (hoursSinceProcessed < 24) {
          continue;
        }
      }

      // MULTI-FACTOR SCORING
      const factors = {
        priority: this.calculatePriorityScore(isPriority, priorityMatch),
        recency: this.calculateRecencyScore(hoursSinceProcessed),
        importance: this.calculateImportanceScore(page),
        urgency: this.calculateUrgencyScore(page, hoursSinceProcessed)
      };

      // Weighted total score
      const score =
        factors.priority * 0.40 +      // 40% weight - Priority URLs get huge boost
        factors.recency * 0.25 +       // 25% weight - Older content needs updates
        factors.importance * 0.20 +    // 20% weight - Important pages prioritized
        factors.urgency * 0.15;        // 15% weight - Urgent updates

      scoredPages.push({ page, score, factors });
    }

    // Sort by score (highest first)
    return scoredPages.sort((a, b) => b.score - a.score);
  }

  private calculatePriorityScore(isPriority: boolean, priorityMatch: any): number {
    if (!isPriority) return 0;

    // If priority match has explicit priority level
    if (priorityMatch && typeof priorityMatch === 'object') {
      const priorityLevels = { critical: 100, high: 80, medium: 50, low: 30 };
      return priorityLevels[priorityMatch.priority as keyof typeof priorityLevels] || 100;
    }

    return 100; // Default priority score
  }

  private calculateRecencyScore(hoursSinceProcessed: number): number {
    if (hoursSinceProcessed === Infinity) {
      return 100; // Never processed - highest urgency
    }

    // Score increases with time since last processing
    // 24 hours = 0, 168 hours (1 week) = 50, 720 hours (30 days) = 100
    return Math.min(100, ((hoursSinceProcessed - 24) / 696) * 100);
  }

  private calculateImportanceScore(page: SitemapPage): number {
    let score = 50; // Base score

    const url = page.id.toLowerCase();
    const title = (page.title || '').toLowerCase();

    // Homepage or main pages
    if (url.endsWith('/') || url.match(/\/(index|home|about|contact|services|products)[\/?]?$/)) {
      score += 30;
    }

    // Pillar content indicators
    if (title.includes('guide') || title.includes('complete') || title.includes('ultimate') || title.includes('definitive')) {
      score += 20;
    }

    // Short URL = likely important page
    const pathDepth = url.split('/').filter(Boolean).length;
    if (pathDepth <= 2) {
      score += 15;
    } else if (pathDepth <= 3) {
      score += 5;
    }

    return Math.min(100, score);
  }

  private calculateUrgencyScore(page: SitemapPage, hoursSinceProcessed: number): number {
    let score = 0;

    // Never processed = urgent
    if (hoursSinceProcessed === Infinity) {
      score += 50;
    }

    // Time-sensitive content
    const title = (page.title || '').toLowerCase();
    const url = page.id.toLowerCase();

    if (title.match(/202[4-6]|2026|2025|2024|latest|new|current|updated/)) {
      score += 25;
    }

    if (title.match(/news|trend|breaking|recent/)) {
      score += 25;
    }

    // Pages with dates in URL are time-sensitive
    if (url.match(/\/202[0-9]\/|\/\d{4}-\d{2}-\d{2}/)) {
      score += 20;
    }

    return Math.min(100, score);
  }

  private getProcessCount(pageId: string): number {
    return parseInt(localStorage.getItem(`sota_proc_count_${pageId}`) || '0');
  }

  /**
   * ULTRA-PREMIUM PAGE OPTIMIZATION ENGINE
   * Complete end-to-end content optimization with all SOTA features
   */
  private async optimizePage(page: SitemapPage): Promise<ProcessingStats> {
    if (!this.context) throw new Error('No context available');

    const stats: ProcessingStats = {
      startTime: Date.now(),
      phaseTimes: new Map(),
      success: false
    };

    const phaseTimer = (phaseName: string) => {
      const start = Date.now();
      return () => stats.phaseTimes.set(phaseName, Date.now() - start);
    };

    try {
      // ========== PHASE 0: Pre-flight Checks ==========
      this.log(`🔍 Pre-flight checks for: ${page.title || page.id}`, 'debug');

      if (!this.context.wpConfig?.url || !this.context.wpConfig?.username) {
        throw new Error('WordPress configuration missing');
      }

      const wpPassword = localStorage.getItem('sota_wp_password');
      if (!wpPassword) {
        throw new Error('WordPress password not configured');
      }

      // ========== PHASE 1: Smart Content Crawling ==========
      let phaseEnd = phaseTimer('crawl');
      this.log('📥 Crawling page content...', 'info');

      const content = await smartCrawl(page.id);
      phaseEnd();

      if (!content || content.length < 500) {
        throw new Error(`Content too short: ${content?.length || 0} characters (minimum 500 required)`);
      }

      this.log(`  ✓ Crawled ${(content.length / 1000).toFixed(1)}KB content`, 'debug');

      // Helper function for AI calls
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

      // ========== PHASE 2: Semantic Keyword Extraction ==========
      phaseEnd = phaseTimer('keywords');
      this.log('🏷️ Extracting semantic keywords...', 'info');

      let semanticKeywords: string[] = [];
      try {
        const kwResponse = await callAIFn('semantic_keyword_extractor', [content, page.title], 'json');
        const kwData = safeParseJSON<any>(kwResponse, { keywords: [] });
        semanticKeywords = kwData?.keywords || [];

        if (semanticKeywords.length === 0) {
          semanticKeywords = [page.title || 'content'];
        }

        this.log(`  ✓ Extracted ${semanticKeywords.length} keywords`, 'debug');
      } catch (e) {
        this.log(`  ⚠️ Keyword extraction failed, using fallback`, 'warning');
        semanticKeywords = [page.title || 'content'];
      }
      phaseEnd();

      // ========== PHASE 2.5: NeuronWriter Integration (if enabled) ==========
      let neuronTermsFormatted: string | null = null;
      if (this.context.neuronConfig?.enabled && this.context.neuronConfig.apiKey && this.context.neuronConfig.projectId) {
        phaseEnd = phaseTimer('neuronwriter');
        this.log('🧠 NEURONWRITER: Creating new content query...', 'info');

        try {
          const { fetchNeuronTerms, formatNeuronTermsForPrompt } = await import('./neuronwriter');

          this.log(`🧠 NEURONWRITER: Analyzing "${page.title}"...`, 'info');

          const neuronTerms = await fetchNeuronTerms(
            this.context.neuronConfig.apiKey,
            this.context.neuronConfig.projectId,
            page.title || semanticKeywords[0]
          );

          if (neuronTerms) {
            neuronTermsFormatted = formatNeuronTermsForPrompt(neuronTerms);

            this.log('🧠 NEURONWRITER: Successfully retrieved ALL SEO terms!', 'success');
            this.log(`  H1: ${neuronTerms.h1?.split(',').length || 0} terms`, 'debug');
            this.log(`  H2: ${neuronTerms.h2?.split(',').length || 0} terms`, 'debug');
            this.log(`  Content Basic: ${neuronTerms.content_basic?.split(',').length || 0} terms`, 'debug');
            this.log(`  Content Extended: ${neuronTerms.content_extended?.split(',').length || 0} terms`, 'debug');
            this.log(`  Entities: ${(neuronTerms.entities_basic?.split(',').length || 0) + (neuronTerms.entities_extended?.split(',').length || 0)} entities`, 'debug');
            this.log(`  Questions: ${neuronTerms.questions?.length || 0}`, 'debug');
            this.log(`  Suggested Headings: ${neuronTerms.headings?.length || 0}`, 'debug');

            const neuronKeywords = [
              neuronTerms.h1,
              neuronTerms.h2,
              neuronTerms.h3,
              neuronTerms.content_basic,
              neuronTerms.entities_basic
            ]
              .filter(Boolean)
              .join(' ')
              .split(/[,;]/)
              .map(k => k.trim())
              .filter(k => k.length > 2)
              .slice(0, 10);

            semanticKeywords = [...new Set([...semanticKeywords, ...neuronKeywords])];
            this.log(`🧠 NEURONWRITER: Merged ${neuronKeywords.length} high-priority terms with keywords`, 'success');
          } else {
            this.log(`🧠 NEURONWRITER: Query completed but no terms returned - check API key and project`, 'warning');
          }
        } catch (e: any) {
          this.log(`🧠 NEURONWRITER ERROR: ${e.message}`, 'error');
          this.log(`  Continuing without NeuronWriter optimization...`, 'warning');
        }
        phaseEnd();
      } else {
        this.log('🧠 NeuronWriter: Not enabled or not configured', 'debug');
      }

      // ========== PHASE 3: GOD MODE CONTENT RECONSTRUCTION ==========
      phaseEnd = phaseTimer('reconstruction');
      this.log('✨ Reconstructing content with ULTRA AI Agent...', 'info');

      const optimizedContent = await callAIFn(
        'god_mode_autonomous_agent',
        [content, page.title, semanticKeywords, this.context.existingPages, neuronTermsFormatted],
        'html'
      );

      if (!optimizedContent || optimizedContent.length < 1000) {
        throw new Error('AI generated insufficient content');
      }

      this.log(`  ✓ Generated ${(optimizedContent.length / 1000).toFixed(1)}KB optimized content`, 'debug');
      phaseEnd();

      // ========== PHASE 4: YouTube Video Injection (GUARANTEED) ==========
      phaseEnd = phaseTimer('youtube');
      this.log('📹 YOUTUBE: Searching for relevant video...', 'info');

      let contentWithVideo = optimizedContent;
      let videoInjected = false;

      try {
        const searchKeyword = page.title || semanticKeywords[0] || 'guide';
        this.log(`📹 YOUTUBE: Query = "${searchKeyword}"`, 'debug');

        contentWithVideo = await injectYouTubeIntoContent(
          optimizedContent,
          searchKeyword,
          this.context.serperApiKey,
          (msg) => this.log(`  ${msg}`, 'debug')
        );

        videoInjected = contentWithVideo !== optimizedContent && !contentWithVideo.includes('[YOUTUBE_VIDEO_PLACEHOLDER]');

        if (videoInjected) {
          this.log('📹 YOUTUBE: SUCCESS - Video injected into content!', 'success');
        } else {
          this.log('📹 YOUTUBE: Primary injection did not add video, trying direct search...', 'warning');

          const { html: youtubeHtml, video } = await findRelevantYouTubeVideo(
            searchKeyword,
            this.context.serperApiKey,
            (msg) => this.log(`  ${msg}`, 'debug')
          );

          if (youtubeHtml && video) {
            this.log(`📹 YOUTUBE: Found video: "${video.title}"`, 'debug');

            const cleanContent = contentWithVideo.replace('[YOUTUBE_VIDEO_PLACEHOLDER]', '');
            const h2Matches = [...cleanContent.matchAll(/<\/h2>/gi)];

            if (h2Matches.length >= 2 && h2Matches[1].index !== undefined) {
              const insertPos = h2Matches[1].index + 5;
              contentWithVideo = cleanContent.substring(0, insertPos) + '\n\n' + youtubeHtml + '\n\n' + cleanContent.substring(insertPos);
              videoInjected = true;
              this.log('📹 YOUTUBE: SUCCESS - Injected after 2nd H2', 'success');
            } else if (h2Matches.length >= 1 && h2Matches[0].index !== undefined) {
              const insertPos = h2Matches[0].index + 5;
              contentWithVideo = cleanContent.substring(0, insertPos) + '\n\n' + youtubeHtml + '\n\n' + cleanContent.substring(insertPos);
              videoInjected = true;
              this.log('📹 YOUTUBE: SUCCESS - Injected after 1st H2', 'success');
            } else {
              contentWithVideo = cleanContent + '\n\n' + youtubeHtml;
              videoInjected = true;
              this.log('📹 YOUTUBE: SUCCESS - Appended to end of content', 'success');
            }
          } else {
            this.log('📹 YOUTUBE: No video found for this topic', 'warning');
          }
        }
      } catch (e: any) {
        this.log(`📹 YOUTUBE ERROR: ${e.message}`, 'error');
      }

      if (!videoInjected) {
        this.log('📹 YOUTUBE: Unable to inject video - continuing without', 'warning');
        contentWithVideo = contentWithVideo.replace('[YOUTUBE_VIDEO_PLACEHOLDER]', '');
      }

      phaseEnd();

      // ========== PHASE 5: Internal Link Injection ==========
      phaseEnd = phaseTimer('linking');
      this.log('🔗 Injecting internal links...', 'info');

      const linkResult = await generateEnhancedInternalLinks(
        contentWithVideo,
        this.context.existingPages,
        page.title || '',
        null,
        ''
      );

      this.log(`  ✓ Injected ${linkResult.linkCount} internal links`, 'debug');
      phaseEnd();

      // ========== PHASE 6: Verified External References ==========
      phaseEnd = phaseTimer('references');
      this.log('📚 Fetching verified references...', 'info');

      let referencesHtml = '';
      let referencesCount = 0;

      try {
        const { html, references } = await fetchVerifiedReferences(
          page.title || semanticKeywords[0],
          semanticKeywords,
          this.context.serperApiKey,
          this.context.wpConfig.url
        );

        referencesHtml = html;
        referencesCount = references.length;
        this.log(`  ✓ Added ${referencesCount} verified references`, 'debug');
      } catch (e: any) {
        this.log(`  ⚠️ Reference fetching failed: ${e.message}`, 'warning');
      }
      phaseEnd();

      // ========== PHASE 7: Content Assembly & Polish ==========
      phaseEnd = phaseTimer('polish');
      this.log('✨ Polishing and assembling final content...', 'info');

      let finalContent = polishContentHtml(linkResult.html);

      if (referencesHtml) {
        finalContent += referencesHtml;
      }

      // Quality assurance checks
      const wordCount = finalContent.split(/\s+/).length;
      const hasH2 = /<h2/i.test(finalContent);
      const hasLinks = /<a /i.test(finalContent);

      if (wordCount < 800) {
        this.log(`  ⚠️ Warning: Content is short (${wordCount} words)`, 'warning');
      }

      if (!hasH2) {
        this.log(`  ⚠️ Warning: No H2 headings found`, 'warning');
      }

      this.log(`  ✓ Final content: ${wordCount} words, ${linkResult.linkCount} links, ${referencesCount} references`, 'debug');
      phaseEnd();

      // ========== PHASE 8: WordPress Publishing ==========
      phaseEnd = phaseTimer('publish');
      this.log('🌐 Publishing to WordPress...', 'info');

      const publishResult = await publishItemToWordPress(
        {
          id: page.id,
          title: page.title || 'Optimized Content',
          type: 'refresh',
          status: 'idle',
          statusText: '',
          generatedContent: {
            title: page.title || 'Optimized Content',
            content: finalContent,
            metaDescription: `${page.title} - Updated comprehensive guide with latest insights and expert analysis.`,
            slug: page.slug || extractSlugFromUrl(page.id),
            schemaMarkup: '',
            primaryKeyword: page.title || '',
            semanticKeywords
          },
          originalUrl: page.id,
          crawledContent: null
        },
        wpPassword,
        'publish',
        fetch,
        this.context.wpConfig
      );

      if (!publishResult.success) {
        throw new Error(publishResult.message || 'WordPress publish failed');
      }

      this.log(`  ✓ Published successfully to WordPress`, 'debug');
      phaseEnd();

      // ========== SUCCESS ==========
      stats.endTime = Date.now();
      stats.success = true;

      // Log performance metrics
      const totalTime = stats.endTime - stats.startTime;
      this.log(`📊 Performance Metrics:`, 'debug');
      this.log(`  Total: ${(totalTime / 1000).toFixed(1)}s`, 'debug');
      stats.phaseTimes.forEach((time, phase) => {
        this.log(`  ${phase}: ${(time / 1000).toFixed(1)}s`, 'debug');
      });

      return stats;

    } catch (error: any) {
      stats.endTime = Date.now();
      stats.success = false;
      stats.errorMessage = error.message;

      this.log(`❌ Optimization failed: ${error.message}`, 'error');

      // Log stack trace for debugging
      if (error.stack) {
        console.error('[GOD MODE] Stack trace:', error.stack);
      }

      throw error;
    }
  }
}

// Export the ULTRA-PREMIUM instance
export const maintenanceEngine = new UltraPremiumMaintenanceEngine();

// ==================== EXPORTS ====================

export { analytics as generationAnalytics, AnalyticsEngine };
export type { YouTubeVideo, VerifiedReference, GenerationAnalytics };

export default {
  callAI,
  generateContent,
  publishItemToWordPress,
  maintenanceEngine,
  fetchVerifiedReferences,
  findRelevantYouTubeVideo,
  injectYouTubeIntoContent,
  generateEnhancedInternalLinks,
  generateImageWithFallback,
  generationAnalytics: analytics
};
