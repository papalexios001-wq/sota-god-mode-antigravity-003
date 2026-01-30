// =============================================================================
// YOUTUBE SERVICE v2.0 - SOTA Enterprise YouTube Integration via Serper API
// CRITICAL FIX: Proper timeouts to prevent 30+ minute hangs
// =============================================================================

import { fetchWithProxies } from './contentUtils';

export interface YouTubeSearchResult {
  title: string;
  videoId: string;
  channel: string;
  description: string;
  thumbnail: string;
  publishedAt?: string;
  viewCount?: string;
  duration?: string;
}

export interface YouTubeEmbedOptions {
  style: 'minimal' | 'featured' | 'card';
  autoplay: boolean;
  showRelated: boolean;
  showInfo: boolean;
}

const DEFAULT_EMBED_OPTIONS: YouTubeEmbedOptions = {
  style: 'featured',
  autoplay: false,
  showRelated: false,
  showInfo: true
};

// Cache for YouTube search results
const youtubeCache = new Map<string, { results: YouTubeSearchResult[]; timestamp: number }>();
const YOUTUBE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Helper function to add timeout to fetch requests
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  }
}

/**
 * Search for YouTube videos via Serper API
 * SOTA v2.0 - FAST with proper timeouts
 * 
 * CRITICAL FIXES:
 * - Single API call per search (not 25!)
 * - 10 second timeout per request
 * - Caching to avoid redundant API calls
 */
export async function searchYouTubeVideos(
  keyword: string,
  serperApiKey: string,
  maxResults: number = 5
): Promise<YouTubeSearchResult[]> {
  if (!serperApiKey) {
    console.error('[YouTubeService] ❌ No Serper API key provided');
    return [];
  }

  if (!keyword || keyword.trim() === '') {
    console.error('[YouTubeService] ❌ No keyword provided');
    return [];
  }

  // Check cache first
  const cacheKey = `yt:${keyword.toLowerCase().trim()}`;
  const cached = youtubeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < YOUTUBE_CACHE_TTL_MS) {
    console.log(`[YouTubeService] 📦 Cache hit for: "${keyword}"`);
    return cached.results.slice(0, maxResults);
  }

  console.log(`[YouTubeService] 🎬 Searching YouTube for: "${keyword}"`);

  try {
    // Create optimal search query
    const currentYear = new Date().getFullYear();
    const searchQuery = `${keyword} tutorial ${currentYear}`;

    // Single API call with timeout
    const response = await fetchWithTimeout(
      'https://google.serper.dev/videos',
      {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: searchQuery, num: 20 })
      },
      10000 // 10 second timeout
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[YouTubeService] API error (${response.status}): ${errorText.substring(0, 100)}`);
      return [];
    }

    const data = await response.json();
    const videos = data.videos || [];

    console.log(`[YouTubeService] Found ${videos.length} videos`);

    // Process and filter results
    const results: YouTubeSearchResult[] = [];

    for (const video of videos) {
      if (!video.link?.includes('youtube.com') && !video.link?.includes('youtu.be')) {
        continue;
      }

      const videoId = extractVideoId(video.link);
      if (!videoId) continue;

      // Skip duplicates
      if (results.some(r => r.videoId === videoId)) continue;

      results.push({
        title: video.title || '',
        videoId,
        channel: video.channel || 'YouTube',
        description: video.snippet || video.description || '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: video.duration,
        publishedAt: video.date
      });
    }

    // Score and sort by relevance
    const scored = results.map(video => ({
      ...video,
      score: calculateRelevanceScore(video, keyword)
    }));

    scored.sort((a, b) => b.score - a.score);
    const finalResults = scored.slice(0, maxResults);

    // Cache results
    youtubeCache.set(cacheKey, {
      results: finalResults,
      timestamp: Date.now()
    });

    console.log(`[YouTubeService] ✅ Returning ${finalResults.length} videos`);
    if (finalResults.length > 0) {
      console.log(`[YouTubeService] Best: "${finalResults[0].title.substring(0, 50)}..."`);
    }

    return finalResults;

  } catch (error: any) {
    console.error('[YouTubeService] ❌ Search failed:', error.message);
    return [];
  }
}

/**
 * FAST YouTube video finder - single attempt with fallback query
 * 
 * CRITICAL FIXES:
 * - Max 2 API calls (primary + fallback)
 * - 15 second total timeout
 * - Returns immediately on first success
 */
export async function findBestYouTubeVideo(
  keyword: string,
  serperApiKey: string,
  logCallback?: (msg: string) => void
): Promise<YouTubeSearchResult | null> {
  const TOTAL_TIMEOUT_MS = 15000; // 15 seconds max total
  const startTime = Date.now();

  // CRITICAL: Check API key first
  if (!serperApiKey || serperApiKey.trim().length < 10) {
    console.error('[YouTube] ❌ No valid Serper API key provided');
    logCallback?.('[YouTube] ❌ No Serper API key - CANNOT search YouTube');
    return null;
  }

  console.log(`[YouTube] 🎬 Finding video for: "${keyword}"`);

  // Strategy 1: Primary search with exact keyword
  try {
    const videos = await searchYouTubeVideos(keyword, serperApiKey, 3);

    if (videos.length > 0) {
      console.log(`[YouTube] ✅ Found: "${videos[0].title.substring(0, 50)}..."`);
      return videos[0];
    }
  } catch (error: any) {
    console.error(`[YouTube] Primary search failed:`, error.message);
  }

  // Check timeout before fallback
  if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
    console.warn(`[YouTube] ⏱️ Timeout reached, skipping fallback`);
    return null;
  }

  // Strategy 2: Simplified fallback (only if primary failed)
  try {
    const simplifiedKeyword = keyword
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .slice(0, 2)
      .join(' ');

    if (simplifiedKeyword && simplifiedKeyword !== keyword) {
      console.log(`[YouTube] Fallback search: "${simplifiedKeyword}"`);
      const videos = await searchYouTubeVideos(`${simplifiedKeyword} guide`, serperApiKey, 3);

      if (videos.length > 0) {
        console.log(`[YouTube] ✅ Fallback found: "${videos[0].title.substring(0, 50)}..."`);
        return videos[0];
      }
    }
  } catch (error: any) {
    console.error(`[YouTube] Fallback search failed:`, error.message);
  }

  console.warn(`[YouTube] ⚠️ No videos found for: "${keyword}"`);
  return null;
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url: string): string | null {
  if (!url) return null;

  // Standard YouTube URL
  if (url.includes('youtube.com/watch')) {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('v');
    } catch {
      return null;
    }
  }

  // Short YouTube URL
  if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  // Embed URL
  if (url.includes('youtube.com/embed/')) {
    const match = url.match(/embed\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  return null;
}

/**
 * Calculate relevance score for a video
 */
function calculateRelevanceScore(video: YouTubeSearchResult, keyword: string): number {
  const titleLower = video.title.toLowerCase();
  const keywordLower = keyword.toLowerCase();
  const keywordWords = keywordLower.split(/\s+/).filter(w => w.length > 2);

  let score = 0;

  // Exact keyword match in title - HIGHEST priority
  if (titleLower.includes(keywordLower)) score += 100;

  // Individual keyword word matches
  for (const word of keywordWords) {
    if (titleLower.includes(word)) score += 15;
  }

  // Educational quality indicators
  if (titleLower.includes('tutorial')) score += 30;
  if (titleLower.includes('complete guide') || titleLower.includes('full guide')) score += 35;
  if (titleLower.includes('step by step') || titleLower.includes('step-by-step')) score += 25;
  if (titleLower.includes('how to')) score += 20;
  if (titleLower.includes('explained')) score += 15;

  // Freshness bonus
  const currentYear = new Date().getFullYear();
  if (titleLower.includes(String(currentYear))) score += 40;
  if (titleLower.includes(String(currentYear - 1))) score += 25;

  // Penalties for irrelevant content
  const badIndicators = [
    'reaction', 'unboxing', 'haul', 'vlog', 'drama', 'exposed',
    'prank', 'challenge', 'compilation', 'funny moments'
  ];

  for (const bad of badIndicators) {
    if (titleLower.includes(bad)) score -= 50;
  }

  return Math.max(0, score);
}

/**
 * Generate embed HTML for a YouTube video
 */
export function generateYouTubeEmbed(
  video: YouTubeSearchResult,
  options: Partial<YouTubeEmbedOptions> = {}
): string {
  const opts = { ...DEFAULT_EMBED_OPTIONS, ...options };

  const embedParams = new URLSearchParams({
    rel: opts.showRelated ? '1' : '0',
    modestbranding: '1',
    autoplay: opts.autoplay ? '1' : '0'
  });

  if (opts.style === 'minimal') {
    return `
<div class="youtube-embed-minimal" style="margin: 1.5rem 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
  <div style="position: relative; padding-bottom: 56.25%; height: 0;">
    <iframe 
      src="https://www.youtube.com/embed/${video.videoId}?${embedParams.toString()}"
      title="${video.title.replace(/"/g, '&quot;')}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      loading="lazy"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    ></iframe>
  </div>
</div>`;
  }

  if (opts.style === 'card') {
    return `
<div class="youtube-embed-card" style="margin: 2rem 0; background: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
  <div style="position: relative; padding-bottom: 56.25%; height: 0;">
    <iframe 
      src="https://www.youtube.com/embed/${video.videoId}?${embedParams.toString()}"
      title="${video.title.replace(/"/g, '&quot;')}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      loading="lazy"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    ></iframe>
  </div>
  <div style="padding: 1rem;">
    <h4 style="margin: 0 0 0.5rem; font-size: 1rem; color: #1e293b;">${video.title}</h4>
    <p style="margin: 0; font-size: 0.85rem; color: #64748b;">${video.channel}</p>
  </div>
</div>`;
  }

  // Featured (default)
  return `
<div class="youtube-embed-featured" style="margin: 2.5rem 0; background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
  <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <span style="font-size: 1.5rem;">📹</span>
      <div>
        <h4 style="margin: 0; color: #E2E8F0; font-size: 1rem; font-weight: 600;">Recommended Video</h4>
        <p style="margin: 0.25rem 0 0; color: #94A3B8; font-size: 0.85rem;">${video.channel}</p>
      </div>
    </div>
  </div>
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
    <iframe 
      src="https://www.youtube.com/embed/${video.videoId}?${embedParams.toString()}"
      title="${video.title.replace(/"/g, '&quot;')}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      loading="lazy"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    ></iframe>
  </div>
  <div style="padding: 1rem 1.5rem; background: rgba(0,0,0,0.2);">
    <p style="margin: 0; color: #CBD5E1; font-size: 0.9rem; line-height: 1.5;">
      <strong style="color: #E2E8F0;">${video.title}</strong>
    </p>
  </div>
</div>`;
}

/**
 * Find and embed the most relevant YouTube video for a topic
 */
export async function findAndEmbedYouTubeVideo(
  topic: string,
  serperApiKey: string,
  options?: Partial<YouTubeEmbedOptions>
): Promise<{ html: string; video: YouTubeSearchResult | null }> {
  const video = await findBestYouTubeVideo(topic, serperApiKey);

  if (!video) {
    return { html: '', video: null };
  }

  const html = generateYouTubeEmbed(video, options);
  return { html, video };
}

/**
 * Generate WordPress Gutenberg-safe YouTube embed block
 */
export function generateWordPressYouTubeEmbed(videoId: string, videoTitle: string = ''): string {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const safeTitle = videoTitle.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  return `
<!-- wp:embed {"url":"${url}","type":"video","providerNameSlug":"youtube","responsive":true,"className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->
<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio" style="margin: 2.5rem 0;">
  <div class="wp-block-embed__wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
    <iframe 
      src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1" 
      title="${safeTitle}"
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen
      loading="lazy"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    ></iframe>
  </div>
  <figcaption style="text-align: center; color: #64748b; font-size: 0.9rem; margin-top: 0.75rem;">📹 ${safeTitle}</figcaption>
</figure>
<!-- /wp:embed -->
`.trim();
}

/**
 * Generate ultra-premium styled YouTube embed HTML
 */
function generateUltraPremiumYouTubeHtml(video: YouTubeSearchResult): string {
  return `
<div class="sota-youtube-ultra" style="margin: 3.5rem 0; padding: 2.5rem; background: linear-gradient(145deg, #0a0a14 0%, #111827 100%); border-radius: 24px; border: 2px solid rgba(99, 102, 241, 0.3); box-shadow: 0 30px 80px rgba(99, 102, 241, 0.15);">
  <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.75rem; padding-bottom: 1.25rem; border-bottom: 1px solid rgba(99, 102, 241, 0.2);">
    <div style="display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 14px; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.35);">
      <span style="font-size: 1.5rem;">▶</span>
    </div>
    <div>
      <h3 style="margin: 0; font-size: 1.35rem; font-weight: 800; color: #f1f5f9; letter-spacing: -0.02em;">Helpful Video Guide</h3>
      <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: #94a3b8;">${video.channel}</p>
    </div>
  </div>
  <div style="border-radius: 16px; overflow: hidden; box-shadow: 0 15px 50px rgba(0, 0, 0, 0.4);">
    <div style="position: relative; padding-bottom: 56.25%; height: 0;">
      <iframe
        src="https://www.youtube.com/embed/${video.videoId}?rel=0&modestbranding=1"
        title="${video.title.replace(/"/g, '&quot;')}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
      ></iframe>
    </div>
  </div>
  <div style="margin-top: 1.25rem; padding: 1rem 1.5rem; background: rgba(255, 255, 255, 0.05); border-radius: 12px;">
    <p style="margin: 0; color: #e2e8f0; font-weight: 600; font-size: 1rem;">${video.title}</p>
  </div>
</div>`;
}

/**
 * GUARANTEED YouTube video injection at the FINAL stage
 */
export function guaranteedYouTubeInjection(
  html: string,
  video: YouTubeSearchResult
): string {
  const videoId = video.videoId;

  // Check if video already exists
  if (html.includes(videoId)) {
    console.log('[YouTubeGuaranteed] Video already present');
    return html;
  }

  // Generate both embed formats for maximum compatibility
  const wpEmbed = generateWordPressYouTubeEmbed(videoId, video.title);
  const styledEmbed = generateUltraPremiumYouTubeHtml(video);

  const embedHtml = `
<div class="sota-youtube-guaranteed" data-video-id="${videoId}">
  ${styledEmbed}
  ${wpEmbed}
</div>
`.trim();

  // Strategy 1: Replace placeholder
  if (html.includes('[YOUTUBE_VIDEO_PLACEHOLDER]')) {
    console.log('[YouTubeGuaranteed] ✅ Replaced placeholder');
    return html.replace('[YOUTUBE_VIDEO_PLACEHOLDER]', embedHtml);
  }

  // Strategy 2: Insert after 2nd H2 (middle of content)
  const h2Matches = [...html.matchAll(/<\/h2>/gi)];
  if (h2Matches.length >= 2) {
    const insertIdx = h2Matches[1].index! + h2Matches[1][0].length;
    const afterH2 = html.substring(insertIdx);
    const nextP = afterH2.match(/<\/p>/i);
    if (nextP && nextP.index !== undefined) {
      const finalPos = insertIdx + nextP.index + nextP[0].length;
      console.log('[YouTubeGuaranteed] ✅ Inserted after 2nd H2');
      return html.substring(0, finalPos) + '\n\n' + embedHtml + '\n\n' + html.substring(finalPos);
    }
  }

  // Strategy 3: Insert before references section
  const refMatch = html.match(/<div[^>]*class="[^"]*sota-references[^"]*"[^>]*>/i);
  if (refMatch && refMatch.index !== undefined) {
    console.log('[YouTubeGuaranteed] ✅ Inserted before references');
    return html.substring(0, refMatch.index) + embedHtml + '\n\n' + html.substring(refMatch.index);
  }

  // Strategy 4: Insert at content midpoint
  const midPoint = Math.floor(html.length * 0.5);
  const searchStart = Math.max(0, midPoint - 500);
  const searchEnd = Math.min(html.length, midPoint + 500);
  const midSection = html.substring(searchStart, searchEnd);
  const midPMatch = midSection.match(/<\/p>/i);
  if (midPMatch && midPMatch.index !== undefined) {
    const insertPos = searchStart + midPMatch.index + midPMatch[0].length;
    console.log('[YouTubeGuaranteed] ✅ Inserted at content midpoint');
    return html.substring(0, insertPos) + '\n\n' + embedHtml + '\n\n' + html.substring(insertPos);
  }

  // Strategy 5: Append at end (fallback)
  console.log('[YouTubeGuaranteed] ✅ Appended at end');
  return html + '\n\n' + embedHtml;
}

/**
 * Clear YouTube cache
 */
export function clearYouTubeCache(): void {
  youtubeCache.clear();
  console.log('[YouTubeService] 🧹 Cache cleared');
}

export default {
  searchYouTubeVideos,
  findBestYouTubeVideo,
  generateYouTubeEmbed,
  findAndEmbedYouTubeVideo,
  generateWordPressYouTubeEmbed,
  guaranteedYouTubeInjection,
  clearYouTubeCache
};
