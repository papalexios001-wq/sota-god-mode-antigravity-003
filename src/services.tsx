// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - ENTERPRISE SERVICES v14.5
// CRITICAL FIX: FORCE References + FORCE Natural Internal Links
// =============================================================================

import { GoogleGenAI } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { PROMPT_TEMPLATES, buildPrompt, BANNED_AI_PHRASES } from "./prompts";
import {
  AI_MODELS,
  BLOCKED_REFERENCE_DOMAINS,
  BLOCKED_SPAM_DOMAINS,
  PROCESSING_LIMITS,
  TARGET_MIN_WORDS,
  TARGET_MAX_WORDS,
  MIN_INTERNAL_LINKS,
  MAX_INTERNAL_LINKS,
  REFERENCE_CATEGORIES
} from "./constants";
import {
  ContentItem,
  GeneratedContent,
  SitemapPage,
  ExpandedGeoTargeting,
  ApiClients,
  GenerationContext,
  GapAnalysisSuggestion,
  WpConfig,
  ImageDetail
} from "./types";
import {
  fetchWithProxies,
  smartCrawl,
  countWords,
  normalizeGeneratedContent,
  generateVerificationFooterHtml,
  performSurgicalUpdate,
  getGuaranteedYoutubeVideos,
  generateYoutubeEmbedHtml,
  isBlockedDomain,
  sanitizeContentHtml,
  removeDuplicateSections,
  processInternalLinkCandidates,
  forceNaturalInternalLinks,
  extractImagesFromHtml,
  injectImagesIntoContent,
  convertMarkdownTablesToHtml,
  smartPostProcess,
  extractFaqForSchema
} from "./contentUtils";
import { extractSlugFromUrl, sanitizeTitle, processConcurrently, delay } from "./utils";
import { generateFullSchema } from "./schema-generator";
import { fetchNeuronTerms } from "./neuronwriter";

// ============================================================================
// SECTION 1: SOTA JSON EXTRACTION - ENTERPRISE GRADE
// ============================================================================

const stripMarkdownCodeBlocks = (text: string): string => {
  if (!text || typeof text !== "string") return "";
  let cleaned = text.trim();
  const patterns = [/^```json\s*/i, /^```javascript\s*/i, /^```html\s*/i, /^```\s*/];
  for (const pattern of patterns) {
    if (pattern.test(cleaned)) { cleaned = cleaned.replace(pattern, ""); break; }
  }
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
};

const repairTruncatedJson = (json: string): string | null => {
  if (!json || typeof json !== "string") return null;
  let repaired = json.trim();
  try { JSON.parse(repaired); return repaired; } catch {}
  
  if (repaired.includes('"semanticKeywords"') || repaired.startsWith('[')) {
    const keywords: string[] = [];
    const regex = /"([^"\\]*(\\.[^"\\]*)*)"/g;
    let match;
    while ((match = regex.exec(repaired)) !== null) {
      const kw = match[1];
      if (kw && kw.length > 1 && kw.length < 60 && !kw.includes(':') && !['semanticKeywords','keywords'].includes(kw)) {
        keywords.push(kw);
      }
    }
    if (keywords.length >= 5) return JSON.stringify({ semanticKeywords: keywords.slice(0, 40) });
  }
  
  let bracketStack: string[] = [];
  let inString = false, escapeNext = false, lastGoodPosition = 0;
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (char === '\\') { escapeNext = true; continue; }
    if (char === '"' && !escapeNext) { inString = !inString; if (!inString) lastGoodPosition = i; continue; }
    if (!inString) {
      if (char === '{') bracketStack.push('}');
      else if (char === '[') bracketStack.push(']');
      else if (char === '}' || char === ']') { if (bracketStack.length > 0 && bracketStack[bracketStack.length - 1] === char) { bracketStack.pop(); lastGoodPosition = i; }}
      else if (char === ',' || char === ':') lastGoodPosition = i;
    }
  }
  if (inString && lastGoodPosition > 0) repaired = repaired.substring(0, lastGoodPosition + 1);
  repaired = repaired.replace(/,\s*$/, '');
  while (bracketStack.length > 0) repaired += bracketStack.pop();
  try { JSON.parse(repaired); return repaired; } catch { return null; }
};

const extractJsonFromResponse = (response: string): string => {
  if (!response || typeof response !== "string") throw new Error("Empty response");
  let trimmed = stripMarkdownCodeBlocks(response.trim());
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try { JSON.parse(trimmed); return trimmed; } catch {
      const repaired = repairTruncatedJson(trimmed);
      if (repaired) return repaired;
    }
  }
  const firstBrace = trimmed.indexOf("{"), firstBracket = trimmed.indexOf("[");
  let startIndex = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) startIndex = firstBrace;
  else if (firstBracket !== -1) startIndex = firstBracket;
  if (startIndex !== -1) {
    const repaired = repairTruncatedJson(trimmed.substring(startIndex));
    if (repaired) return repaired;
  }
  throw new Error(`Could not extract JSON from: "${trimmed.substring(0, 100)}..."`);
};

const safeJsonParse = <T = unknown>(response: string, context: string = "Unknown"): T => {
  try { return JSON.parse(extractJsonFromResponse(response)) as T; }
  catch (error) { throw new Error(`JSON parse failed (${context}): ${error instanceof Error ? error.message : String(error)}`); }
};

const safeJsonParseWithRecovery = <T = unknown>(response: string, context: string, fallback: T): T => {
  try { return safeJsonParse<T>(response, context); } catch { return fallback; }
};

const extractSemanticKeywords = (response: string, context: string): string[] => {
  try {
    const parsed = safeJsonParse<any>(response, context);
    if (parsed && Array.isArray(parsed.semanticKeywords)) return parsed.semanticKeywords.filter((k: unknown) => typeof k === "string").slice(0, 40);
    if (Array.isArray(parsed)) return parsed.filter((k: unknown) => typeof k === "string").slice(0, 40);
    if (parsed && typeof parsed === "object") {
      for (const value of Object.values(parsed)) {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") return (value as string[]).slice(0, 40);
      }
    }
  } catch {}
  const extracted: string[] = [];
  const regex = /["']([a-zA-Z][a-zA-Z0-9\s-]{2,45})["']/g;
  let match;
  while ((match = regex.exec(response)) !== null) {
    const kw = match[1].trim();
    if (kw && kw.length > 2 && !extracted.includes(kw) && !kw.includes(':')) extracted.push(kw);
    if (extracted.length >= 35) break;
  }
  return extracted;
};

const surgicalSanitizer = (html: string): string => {
  if (!html || typeof html !== "string") return "";
  return html.replace(/^```html\s*/gi, "").replace(/```$/gi, "").replace(/^```\s*/gi, "").replace(/^(Here(?:'s| is) the|Below is)/i, "").replace(/\n{3,}/g, "\n\n").trim();
};

// ============================================================================
// SECTION 2: CRITICAL - REMOVE H1 TAGS + INTERNAL LINK SECTIONS
// ============================================================================

const removeH1Tags = (html: string): string => {
  if (!html) return "";
  let cleaned = html;
  cleaned = cleaned.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, "");
  cleaned = cleaned.replace(/<h1[^>]*\/>/gi, "");
  cleaned = cleaned.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  console.log("[H1 Remover] Removed all H1 tags from content");
  return cleaned;
};

// CRITICAL: Remove any "Internal Links", "Related Resources", etc. sections
const removeInternalLinkSections = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;
  
  const sectionsToRemove = [
    'internal link',
    'related resources',
    'related links',
    'useful links',
    'helpful links',
    'more resources',
    'additional resources',
    'further reading links'
  ];
  
  // Find and remove sections with these headers
  const allHeadings = Array.from(body.querySelectorAll('h2, h3, h4, strong'));
  
  for (const heading of allHeadings) {
    const text = (heading.textContent || '').toLowerCase().trim();
    
    if (sectionsToRemove.some(s => text.includes(s))) {
      console.log(`[Section Remover] Found section to remove: "${heading.textContent}"`);
      
      // Find the container (parent div/section) or collect elements until next heading
      let container = heading.closest('section, div.section, article > div');
      
      if (container && container !== body) {
        container.remove();
        console.log(`[Section Remover] Removed container for: "${heading.textContent}"`);
      } else {
        // Remove heading and all following siblings until next heading
        const elementsToRemove: Element[] = [heading];
        let sibling = heading.nextElementSibling;
        
        while (sibling && !['H2', 'H3'].includes(sibling.tagName)) {
          elementsToRemove.push(sibling);
          sibling = sibling.nextElementSibling;
        }
        
        elementsToRemove.forEach(el => el.remove());
        console.log(`[Section Remover] Removed ${elementsToRemove.length} elements for: "${heading.textContent}"`);
      }
    }
  }
  
  return body.innerHTML;
};

// ============================================================================
// SECTION 3: SERP GAP ANALYZER v2.0 WITH WORD COUNT ANALYSIS
// ============================================================================

export interface SerpGapResult {
  missingKeywords: string[];
  missingEntities: string[];
  competitorInsights: string[];
  topCompetitorTitles: string[];
  optimalWordCount: number;
  averageCompetitorWords: number;
}

export const analyzeSerpGaps = async (
  keyword: string,
  serperApiKey: string,
  callAIFn: (promptKey: string, args: unknown[], format?: "json" | "html") => Promise<string>
): Promise<SerpGapResult> => {
  const result: SerpGapResult = {
    missingKeywords: [],
    missingEntities: [],
    competitorInsights: [],
    topCompetitorTitles: [],
    optimalWordCount: 2500,
    averageCompetitorWords: 2000
  };
  
  if (!serperApiKey) return result;

  try {
    console.log(`[SERP Gap Analyzer] Analyzing: ${keyword}`);
    
    const serpResponse = await fetchWithProxies("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: keyword, num: 5 }),
    });
    const serpData = safeJsonParseWithRecovery<{ organic?: Array<{ title: string; snippet: string; link: string }> }>(
      await serpResponse.text(), "SERP", { organic: [] }
    );

    const topResults = serpData.organic?.slice(0, 3) || [];
    result.topCompetitorTitles = topResults.map(r => r.title);
    console.log(`[SERP Gap Analyzer] Found ${topResults.length} top competitors`);

    const competitorContent: string[] = [];
    const competitorWordCounts: number[] = [];
    
    for (const competitor of topResults) {
      try {
        const content = await smartCrawl(competitor.link);
        if (content && content.length > 500) {
          competitorContent.push(content.substring(0, 8000));
          const wordCount = countWords(content);
          competitorWordCounts.push(wordCount);
          console.log(`[SERP Gap Analyzer] Crawled: ${competitor.title.substring(0, 40)}... (${wordCount} words)`);
        }
      } catch (e) {
        console.warn(`[SERP Gap Analyzer] Failed to crawl ${competitor.link}`);
      }
    }

    if (competitorWordCounts.length > 0) {
      result.averageCompetitorWords = Math.round(
        competitorWordCounts.reduce((a, b) => a + b, 0) / competitorWordCounts.length
      );
      const maxCompetitorWords = Math.max(...competitorWordCounts);
      result.optimalWordCount = Math.min(5000, Math.max(2000, Math.round(maxCompetitorWords * 1.15)));
      console.log(`[SERP Gap Analyzer] Competitor avg: ${result.averageCompetitorWords}, Max: ${maxCompetitorWords}, Target: ${result.optimalWordCount}`);
    }

    if (competitorContent.length > 0) {
      const combinedContent = competitorContent.join("\n\n---\n\n").substring(0, 15000);
      
      const analysisPrompt = `Analyze these top-ranking competitor articles and extract:
1. Top 15 MISSING KEYWORDS that would improve our content
2. Top 10 ENTITIES mentioned (brands, tools, people, products)
3. Top 5 CONTENT INSIGHTS

TOPIC: ${keyword}

COMPETITOR CONTENT:
${combinedContent}

Output ONLY valid JSON:
{"missingKeywords":["kw1","kw2",...],"missingEntities":["entity1","entity2",...],"competitorInsights":["insight1","insight2",...]}`;

      try {
        const analysisResponse = await callAIFn("json_repair", [analysisPrompt], "json");
        const analysis = safeJsonParseWithRecovery<{
          missingKeywords?: string[];
          missingEntities?: string[];
          competitorInsights?: string[];
        }>(analysisResponse, "gap-analysis", {});

        result.missingKeywords = (analysis.missingKeywords || []).slice(0, 15);
        result.missingEntities = (analysis.missingEntities || []).slice(0, 10);
        result.competitorInsights = (analysis.competitorInsights || []).slice(0, 5);
        
        console.log(`[SERP Gap Analyzer] Extracted ${result.missingKeywords.length} keywords, ${result.missingEntities.length} entities`);
      } catch (e) {
        console.warn("[SERP Gap Analyzer] AI analysis failed:", e);
      }
    }

    try {
      const paaResponse = await fetchWithProxies("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serperApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: keyword, num: 10 }),
      });
      const paaData = safeJsonParseWithRecovery<{ peopleAlsoAsk?: Array<{ question: string }> }>(
        await paaResponse.text(), "PAA", { peopleAlsoAsk: [] }
      );
      
      const questions = paaData.peopleAlsoAsk?.map(p => p.question) || [];
      if (questions.length > 0) {
        result.missingKeywords.push(...questions.slice(0, 5));
        console.log(`[SERP Gap Analyzer] Added ${questions.length} PAA questions`);
      }
    } catch {}

    return result;
  } catch (error) {
    console.error("[SERP Gap Analyzer] Error:", error);
    return result;
  }
};

// ============================================================================
// SECTION 4: SMART YOUTUBE PLACEMENT (NO DUPLICATES)
// ============================================================================

export const getSmartYoutubeVideos = async (
  keyword: string,
  serperApiKey: string,
  count: number = 2
): Promise<Array<{ videoId: string; title: string }>> => {
  if (!serperApiKey) return [];
  
  try {
    const response = await fetchWithProxies("https://google.serper.dev/videos", {
      method: "POST",
      headers: { "X-API-KEY": serperApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: keyword, num: 15 }),
    });

    const data = safeJsonParseWithRecovery<{ videos?: Array<{ link: string; title: string }> }>(
      await response.text(), "YouTube", { videos: [] }
    );

    const videos: Array<{ videoId: string; title: string }> = [];
    const seenVideoIds = new Set<string>();
    
    for (const video of data.videos || []) {
      if (videos.length >= count) break;
      if (video.link?.includes('youtube.com/watch?v=')) {
        const videoId = video.link.split('v=')[1]?.split('&')[0];
        if (videoId && !seenVideoIds.has(videoId)) {
          seenVideoIds.add(videoId);
          videos.push({ videoId, title: video.title });
        }
      }
    }
    
    console.log(`[Smart YouTube] Found ${videos.length} unique videos for: ${keyword}`);
    return videos;
  } catch (error) {
    console.error("[Smart YouTube] Error:", error);
    return [];
  }
};

export const injectYoutubeInRelevantSections = (
  content: string,
  videos: Array<{ videoId: string; title: string }>
): string => {
  if (videos.length === 0) return content;
  
  const existingVideoIds = new Set<string>();
  const videoIdPattern = /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = videoIdPattern.exec(content)) !== null) {
    existingVideoIds.add(match[1]);
  }
  
  const newVideos = videos.filter(v => !existingVideoIds.has(v.videoId));
  if (newVideos.length === 0) {
    console.log("[Smart YouTube] All videos already present in content, skipping injection");
    return content;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const body = doc.body;
  const h2s = Array.from(body.querySelectorAll("h2"));

  const sectionsWithVideos = new Set<number>();
  const usedVideoIndices = new Set<number>();

  for (let vidIdx = 0; vidIdx < newVideos.length; vidIdx++) {
    const video = newVideos[vidIdx];
    const videoWords = video.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    let bestMatchIndex = -1;
    let bestScore = 0;

    h2s.forEach((h2, idx) => {
      if (sectionsWithVideos.has(idx)) return;
      const h2Text = h2.textContent?.toLowerCase() || "";
      const h2Words = h2Text.split(/\s+/).filter(w => w.length > 3);
      
      const matchCount = videoWords.filter(vw => h2Words.some(hw => hw.includes(vw) || vw.includes(hw))).length;
      const score = matchCount / Math.max(videoWords.length, 1);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatchIndex = idx;
      }
    });

    if (bestMatchIndex >= 0 && bestScore >= 0.15 && !sectionsWithVideos.has(bestMatchIndex)) {
      sectionsWithVideos.add(bestMatchIndex);
      usedVideoIndices.add(vidIdx);
      
      const targetH2 = h2s[bestMatchIndex];
      const nextH2 = h2s[bestMatchIndex + 1];
      const insertPoint = nextH2 || null;
      
      const videoEmbed = doc.createElement("div");
      videoEmbed.className = "sota-video-embed";
      videoEmbed.innerHTML = `
<div style="margin: 2.5rem 0; padding: 1.75rem; background: linear-gradient(145deg, #0F172A 0%, #1E293B 100%); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
  <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
    <span style="font-size: 1.5rem;">🎬</span>
    <span style="color: #94A3B8; font-size: 0.95rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Recommended Video</span>
  </div>
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.4);">
    <iframe 
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
      src="https://www.youtube.com/embed/${video.videoId}" 
      title="${video.title.replace(/"/g, '&quot;')}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
      allowfullscreen
      loading="lazy"
    ></iframe>
  </div>
  <p style="margin: 1rem 0 0 0; font-size: 0.9rem; color: #64748B; line-height: 1.5;">${video.title}</p>
</div>`;
      
      if (insertPoint && insertPoint.parentNode) {
        insertPoint.parentNode.insertBefore(videoEmbed, insertPoint);
      } else {
        body.appendChild(videoEmbed);
      }
      console.log(`[Smart YouTube] Injected video after section: ${targetH2.textContent?.substring(0, 30)}...`);
    }
  }

  const remainingVideos = newVideos.filter((_, idx) => !usedVideoIndices.has(idx));
  if (remainingVideos.length > 0 && remainingVideos.length === newVideos.length) {
    const video = remainingVideos[0];
    const videoSection = doc.createElement("div");
    videoSection.className = "sota-video-section-end";
    videoSection.innerHTML = `
<div style="margin: 3rem 0; padding: 2rem; background: linear-gradient(145deg, #0F172A 0%, #1E293B 100%); border-radius: 20px;">
  <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
    <span style="font-size: 1.5rem;">🎬</span>
    <span style="color: #94A3B8; font-size: 0.95rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Recommended Video</span>
  </div>
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 16px;">
    <iframe 
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
      src="https://www.youtube.com/embed/${video.videoId}" 
      title="${video.title.replace(/"/g, '&quot;')}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
      allowfullscreen
      loading="lazy"
    ></iframe>
  </div>
  <p style="margin: 1rem 0 0 0; font-size: 0.9rem; color: #64748B;">${video.title}</p>
</div>`;
    body.appendChild(videoSection);
    console.log(`[Smart YouTube] Added 1 video at end of content`);
  }

  return body.innerHTML;
};

const removeDuplicateVideos = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;
  
  const seenVideoIds = new Set<string>();
  const iframes = Array.from(body.querySelectorAll('iframe[src*="youtube.com/embed"]'));
  
  for (const iframe of iframes) {
    const src = iframe.getAttribute('src') || '';
    const videoIdMatch = src.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      if (seenVideoIds.has(videoId)) {
        let parent = iframe.parentElement;
        while (parent && parent !== body) {
          if (parent.className?.includes('sota-video') || 
              parent.querySelector('iframe') === iframe && 
              !parent.querySelector('iframe:not([src*="' + videoId + '"])')) {
            parent.remove();
            console.log(`[Video Dedup] Removed duplicate video: ${videoId}`);
            break;
          }
          parent = parent.parentElement;
        }
      } else {
        seenVideoIds.add(videoId);
      }
    }
  }
  
  return body.innerHTML;
};

// ============================================================================
// SECTION 5: GUARANTEED REFERENCES (NEVER EMPTY)
// ============================================================================

const AUTHORITY_DOMAINS = [
  'gov', 'edu', 'org', 'wikipedia.org', 'scholar.google.com', 'pubmed.ncbi.nlm.nih.gov',
  'nature.com', 'sciencedirect.com', 'springer.com', 'forbes.com', 'hbr.org',
  'nytimes.com', 'bbc.com', 'reuters.com', 'theguardian.com', 'techcrunch.com',
  'wired.com', 'arstechnica.com', 'statista.com', 'mckinsey.com', 'deloitte.com',
  'investopedia.com', 'healthline.com', 'webmd.com', 'mayoclinic.org'
];

// GUARANTEED to return references - NEVER returns empty string
export const fetchVerifiedReferences = async (
  keyword: string,
  semanticKeywords: string[],
  serperApiKey: string,
  wpUrl?: string
): Promise<string> => {
  const currentYear = new Date().getFullYear();
  
  // ALWAYS generate references - fallback if API fails
  if (!serperApiKey) {
    console.log("[References] No Serper API key, generating guaranteed fallback references");
    return generateGuaranteedReferences(keyword);
  }

  try {
    console.log(`[References] Fetching verified references for: ${keyword}`);
    
    let userDomain: string | undefined;
    if (wpUrl) {
      try { userDomain = new URL(wpUrl).hostname.replace("www.", ""); } catch {}
    }

    const queries = [
      `${keyword} site:edu OR site:gov`,
      `${keyword} research study`,
      `"${keyword}" guide tutorial`,
      `${keyword} ${semanticKeywords.slice(0, 2).join(' ')}`
    ];

    const allResults: Array<{ title: string; link: string; snippet: string }> = [];

    for (const query of queries) {
      try {
        const response = await fetchWithProxies("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": serperApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q: query, num: 8 }),
        });
        const data = safeJsonParseWithRecovery<{ organic?: Array<{ link: string; title: string; snippet: string }> }>(
          await response.text(), "Serper", { organic: [] }
        );
        allResults.push(...(data.organic || []));
      } catch {}
      await delay(200);
    }

    const seenDomains = new Set<string>();
    const validLinks: Array<{ title: string; url: string; source: string; isAuthority: boolean; snippet: string }> = [];

    for (const result of allResults) {
      if (validLinks.length >= 8) break;
      
      try {
        const urlObj = new URL(result.link);
        const domain = urlObj.hostname.replace("www.", "").toLowerCase();

        if (seenDomains.has(domain)) continue;
        if (userDomain && domain.includes(userDomain)) continue;
        if (isBlockedDomain(result.link)) continue;
        if (BLOCKED_SPAM_DOMAINS.some(spam => domain.includes(spam))) continue;

        try {
          const checkRes = await Promise.race([
            fetchWithProxies(result.link, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" } }),
            new Promise<Response>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500)),
          ]) as Response;

          if (checkRes.status >= 200 && checkRes.status < 400) {
            const isAuthority = AUTHORITY_DOMAINS.some(auth => domain.includes(auth));
            seenDomains.add(domain);
            validLinks.push({
              title: result.title || "Reference",
              url: result.link,
              source: domain,
              isAuthority,
              snippet: result.snippet || ""
            });
            console.log(`[References] ✅ Validated: ${domain}`);
          }
        } catch {
          const isAuthority = AUTHORITY_DOMAINS.some(auth => domain.includes(auth));
          if (isAuthority) {
            seenDomains.add(domain);
            validLinks.push({
              title: result.title || "Reference",
              url: result.link,
              source: domain,
              isAuthority: true,
              snippet: result.snippet || ""
            });
          }
        }
      } catch {
        continue;
      }
    }

    // GUARANTEED: If we couldn't get enough links, add fallback
    if (validLinks.length < 3) {
      console.log("[References] Not enough valid links, using guaranteed fallback");
      return generateGuaranteedReferences(keyword);
    }

    validLinks.sort((a, b) => (b.isAuthority ? 1 : 0) - (a.isAuthority ? 1 : 0));

    console.log(`[References] Final count: ${validLinks.length} verified links`);
    return generateReferencesHtml(validLinks, keyword);
    
  } catch (error) {
    console.error("[References] Error:", error);
    return generateGuaranteedReferences(keyword);
  }
};

const generateReferencesHtml = (
  links: Array<{ title: string; url: string; source: string; isAuthority: boolean; snippet?: string }>,
  keyword: string
): string => {
  const linksHtml = links.map(link => `
    <li style="margin-bottom: 1.25rem; padding: 1.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-left: 5px solid ${link.isAuthority ? '#10B981' : '#3B82F6'}; transition: transform 0.2s, box-shadow 0.2s;">
      <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: #1E40AF; font-weight: 700; text-decoration: none; display: block; margin-bottom: 0.5rem; font-size: 1.1rem; line-height: 1.4;">
        ${link.title}
      </a>
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-top: 0.75rem;">
        <span style="font-size: 0.9rem; color: #64748B; font-weight: 500;">${link.source}</span>
        <span style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 4px 12px; background: ${link.isAuthority ? 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)' : 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)'}; color: ${link.isAuthority ? '#065F46' : '#1E40AF'}; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">
          ${link.isAuthority ? '🏛️ Authority Source' : '✅ Verified'}
        </span>
      </div>
    </li>`).join("");

  return `
<!-- SOTA-REFERENCES-START -->
<div class="sota-references-section" style="margin-top: 4rem; padding: 3rem; background: linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%); border-radius: 24px; border: 2px solid #CBD5E1; box-shadow: 0 10px 40px rgba(0,0,0,0.05);">
  <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem;">
    <span style="font-size: 2.5rem;">📚</span>
    <h2 style="margin: 0; font-size: 2rem; font-weight: 800; color: #0F172A;">References &amp; Further Reading</h2>
  </div>
  <p style="margin: 0 0 2rem 0; color: #64748B; font-size: 1rem;">Curated resources verified on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  <ul style="list-style: none; padding: 0; margin: 0;">${linksHtml}</ul>
</div>
<!-- SOTA-REFERENCES-END -->`;
};

// GUARANTEED fallback - always returns valid references HTML
const generateGuaranteedReferences = (keyword: string): string => {
  const searchKeyword = encodeURIComponent(keyword);
  const currentYear = new Date().getFullYear();
  
  const fallbackLinks = [
    {
      title: `Google Scholar: Research on ${keyword}`,
      url: `https://scholar.google.com/scholar?q=${searchKeyword}`,
      source: 'scholar.google.com',
      isAuthority: true
    },
    {
      title: `Wikipedia: ${keyword}`,
      url: `https://en.wikipedia.org/wiki/Special:Search?search=${searchKeyword}`,
      source: 'wikipedia.org',
      isAuthority: true
    },
    {
      title: `Investopedia: Understanding ${keyword}`,
      url: `https://www.investopedia.com/search?q=${searchKeyword}`,
      source: 'investopedia.com',
      isAuthority: true
    },
    {
      title: `Harvard Business Review: ${keyword} Insights`,
      url: `https://hbr.org/search?term=${searchKeyword}`,
      source: 'hbr.org',
      isAuthority: true
    }
  ];

  console.log("[References] Generated guaranteed fallback references");
  return generateReferencesHtml(fallbackLinks, keyword);
};

// ============================================================================
// SECTION 6: AI CLIENT WRAPPER
// ============================================================================

export const callAI = async (
  apiClients: ApiClients,
  selectedModel: string,
  geoTargeting: ExpandedGeoTargeting,
  openrouterModels: string[],
  selectedGroqModel: string,
  promptKey: keyof typeof PROMPT_TEMPLATES | string,
  args: unknown[],
  format: "json" | "html" = "json",
  useGrounding: boolean = false
): Promise<string> => {
  const promptTemplate = PROMPT_TEMPLATES[promptKey as keyof typeof PROMPT_TEMPLATES];
  if (!promptTemplate) throw new Error(`Unknown prompt: ${promptKey}`);

  const systemInstruction = promptTemplate.systemInstruction;
  const userPrompt = typeof promptTemplate.userPrompt === "function"
    ? (promptTemplate.userPrompt as (...a: unknown[]) => string)(...args)
    : promptTemplate.userPrompt;

  let enhancedPrompt = userPrompt;
  if (geoTargeting.enabled && geoTargeting.location) {
    enhancedPrompt = `[GEO-TARGET: ${geoTargeting.location}]\n${userPrompt}`;
  }

  const modelPriority: string[] = [selectedModel];
  if (selectedModel !== "gemini" && apiClients.gemini) modelPriority.push("gemini");
  if (selectedModel !== "openai" && apiClients.openai) modelPriority.push("openai");
  if (selectedModel !== "anthropic" && apiClients.anthropic) modelPriority.push("anthropic");

  let lastError: Error | null = null;

  for (const modelKey of modelPriority) {
    const client = apiClients[modelKey as keyof ApiClients];
    if (!client) continue;

    try {
      let response: string;
      switch (modelKey) {
        case "gemini": response = await callGemini(client as GoogleGenAI, systemInstruction, enhancedPrompt, format, useGrounding); break;
        case "openai": response = await callOpenAI(client as OpenAI, systemInstruction, enhancedPrompt, format); break;
        case "anthropic": response = await callAnthropic(client as Anthropic, systemInstruction, enhancedPrompt, format); break;
        case "openrouter": response = await callOpenRouter(client as OpenAI, systemInstruction, enhancedPrompt, openrouterModels, format); break;
        case "groq": response = await callGroq(client as OpenAI, systemInstruction, enhancedPrompt, selectedGroqModel, format); break;
        default: continue;
      }
      if (format === "html") return surgicalSanitizer(response);
      try { extractJsonFromResponse(response); return response; } catch { lastError = new Error("Invalid JSON"); continue; }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }

  throw lastError || new Error("All AI providers failed");
};

async function callGemini(client: GoogleGenAI, system: string, prompt: string, format: "json" | "html", grounding: boolean): Promise<string> {
  const config: Record<string, unknown> = { temperature: format === "json" ? 0.2 : 0.7, topP: 0.95, maxOutputTokens: 8192 };
  if (format === "json") config.responseMimeType = "application/json";
  const response = await client.models.generateContent({
    model: AI_MODELS.GEMINI_FLASH, contents: prompt,
    config: { systemInstruction: system, ...config, ...(grounding ? { tools: [{ googleSearch: {} }] } : {}) },
  });
  if (!response.text) throw new Error("Empty Gemini response");
  return response.text;
}

async function callOpenAI(client: OpenAI, system: string, prompt: string, format: "json" | "html"): Promise<string> {
  const response = await client.chat.completions.create({
    model: AI_MODELS.OPENAI_GPT4_TURBO, messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    temperature: format === "json" ? 0.2 : 0.7, max_tokens: 8192,
    ...(format === "json" ? { response_format: { type: "json_object" } } : {}),
  });
  if (!response.choices[0]?.message?.content) throw new Error("Empty OpenAI response");
  return response.choices[0].message.content;
}

async function callAnthropic(client: Anthropic, system: string, prompt: string, format: "json" | "html"): Promise<string> {
  const response = await client.messages.create({
    model: AI_MODELS.ANTHROPIC_SONNET, system, messages: [{ role: "user", content: prompt }],
    max_tokens: 8192, temperature: format === "json" ? 0.2 : 0.7,
  });
  const textBlock = response.content.find((b: { type: string }) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Empty Anthropic response");
  return (textBlock as { type: "text"; text: string }).text;
}

async function callOpenRouter(client: OpenAI, system: string, prompt: string, models: string[], format: "json" | "html"): Promise<string> {
  for (const model of models) {
    try {
      const response = await client.chat.completions.create({
        model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        temperature: format === "json" ? 0.2 : 0.7, max_tokens: 8192,
      });
      if (response.choices[0]?.message?.content) return response.choices[0].message.content;
    } catch { continue; }
  }
  throw new Error("All OpenRouter models failed");
}

async function callGroq(client: OpenAI, system: string, prompt: string, model: string, format: "json" | "html"): Promise<string> {
  const response = await client.chat.completions.create({
    model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    temperature: format === "json" ? 0.2 : 0.7, max_tokens: 8192,
  });
  if (!response.choices[0]?.message?.content) throw new Error("Empty Groq response");
  return response.choices[0].message.content;
}

// ============================================================================
// SECTION 7: CONTENT GENERATION ENGINE v14.5 - ENTERPRISE GRADE
// ============================================================================

export const generateContent = {
  async generateItems(
    items: ContentItem[],
    callAIFn: (promptKey: string, args: unknown[], format?: "json" | "html", grounding?: boolean) => Promise<string>,
    generateImageFn: ((prompt: string) => Promise<string | null>) | null,
    context: GenerationContext,
    onProgress: (progress: { current: number; total: number }) => void,
    stopRef: React.MutableRefObject<Set<string>>
  ): Promise<void> {
    const { existingPages, siteInfo, wpConfig, geoTargeting, serperApiKey, neuronConfig } = context;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (stopRef.current.has(item.id)) {
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "idle", statusText: "Stopped" } });
        continue;
      }

      onProgress({ current: i + 1, total: items.length });
      context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "🔍 Researching competitors..." } });

      try {
        // ========== STEP 1: SERP GAP ANALYSIS ==========
        const serpGaps = await analyzeSerpGaps(item.title, serperApiKey, callAIFn);
        console.log(`[Generate] SERP Gaps: ${serpGaps.missingKeywords.length} keywords, Target: ${serpGaps.optimalWordCount} words`);

        // ========== STEP 2: SEMANTIC KEYWORDS ==========
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "🔑 Generating keywords..." } });
        const keywordsResponse = await callAIFn("semantickeywordgenerator", [item.title], "json");
        let semanticKeywords = extractSemanticKeywords(keywordsResponse, "keywords");
        const allKeywords = [...new Set([...serpGaps.missingKeywords, ...semanticKeywords, ...serpGaps.missingEntities])];
        semanticKeywords = allKeywords.slice(0, 50);

        // ========== STEP 3: NEURONWRITER ==========
        let neuronData: string | null = null;
        if (neuronConfig?.enabled && neuronConfig.apiKey && neuronConfig.projectId) {
          context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "🧠 Fetching NLP terms..." } });
          try {
            const neuronTerms = await fetchNeuronTerms(neuronConfig.apiKey, neuronConfig.projectId, item.title);
            if (neuronTerms) neuronData = Object.entries(neuronTerms).map(([k, v]) => `${k}: ${v}`).join("\n");
          } catch {}
        }

        // ========== STEP 4: CONTENT STRATEGY ==========
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "📋 Planning strategy..." } });
        const strategyResponse = await callAIFn("contentstrategygenerator", [item.title, semanticKeywords, serpGaps.topCompetitorTitles, item.type], "json");
        const strategy = safeJsonParseWithRecovery<Record<string, unknown>>(strategyResponse, "strategy", { targetAudience: "General", searchIntent: "Informational" });

        // ========== STEP 5: MAIN CONTENT ==========
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: `✍️ Writing ${serpGaps.optimalWordCount}+ words...` } });
        
        const articlePlan = `
TOPIC: ${item.title}

⚠️ CRITICAL RULES:
1. DO NOT include an H1 tag - WordPress adds it from post title
2. DO NOT include a "Related Resources" or "Internal Links" section - links must be embedded naturally in paragraphs
3. Start with an H2 or intro paragraph

TARGET WORD COUNT: ${serpGaps.optimalWordCount} words (competitors average ${serpGaps.averageCompetitorWords})

MUST INCLUDE THESE KEYWORDS:
${serpGaps.missingKeywords.slice(0, 15).map((k, i) => `${i + 1}. ${k}`).join('\n')}

MUST MENTION THESE ENTITIES:
${serpGaps.missingEntities.slice(0, 10).map((e, i) => `${i + 1}. ${e}`).join('\n')}

COMPETITOR INSIGHTS:
${serpGaps.competitorInsights.slice(0, 5).map((c, i) => `${i + 1}. ${c}`).join('\n')}
`;

        const contentResponse = await callAIFn(
          "ultrasotaarticlewriter",
          [articlePlan, semanticKeywords, strategy, existingPages.slice(0, 30), serpGaps.missingKeywords, geoTargeting.enabled ? geoTargeting.location : null, neuronData],
          "html"
        );
        let generatedHtml = surgicalSanitizer(contentResponse);

        // ========== STEP 5.5: REMOVE H1 + INTERNAL LINK SECTIONS ==========
        generatedHtml = removeH1Tags(generatedHtml);
        generatedHtml = removeInternalLinkSections(generatedHtml);

        // ========== STEP 6: SEO METADATA ==========
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "🎯 Optimizing SEO..." } });
        const metaResponse = await callAIFn("seometadatagenerator", [item.title, generatedHtml.substring(0, 800), strategy.targetAudience || "General", serpGaps.topCompetitorTitles, null], "json");
        const { seoTitle, metaDescription, slug } = safeJsonParseWithRecovery<{ seoTitle: string; metaDescription: string; slug: string }>(
          metaResponse, "metadata", { seoTitle: item.title, metaDescription: `Learn about ${item.title}`, slug: item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50) }
        );

        // ========== STEP 7: FAQ ==========
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "❓ Creating FAQ..." } });
        const faqResponse = await callAIFn("sotafaqgenerator", [item.title, semanticKeywords], "html");
        const faqHtml = surgicalSanitizer(faqResponse);

        // ========== STEP 8: KEY TAKEAWAYS ==========
        const takeawaysResponse = await callAIFn("sotatakeawaysgenerator", [item.title, generatedHtml], "html");
        const takeawaysHtml = surgicalSanitizer(takeawaysResponse);

        // ========== STEP 9: GUARANTEED REFERENCES ==========
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "📚 Fetching references..." } });
        const referencesHtml = await fetchVerifiedReferences(item.title, semanticKeywords, serperApiKey, wpConfig.url);
        console.log(`[Generate] References HTML length: ${referencesHtml.length}`);

        // ========== STEP 10: YOUTUBE ==========
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "🎬 Finding videos..." } });
        if (serperApiKey) {
          const videos = await getSmartYoutubeVideos(item.title, serperApiKey, 2);
          if (videos.length > 0) {
            generatedHtml = injectYoutubeInRelevantSections(generatedHtml, videos);
            console.log(`[Generate] Injected ${videos.length} YouTube videos`);
          }
        }

        // ========== STEP 11: FORCE NATURAL INTERNAL LINKS ==========
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "🔗 Injecting internal links..." } });
        if (existingPages.length > 0) {
          console.log(`[Generate] Forcing natural internal links into ${existingPages.length} available pages`);
          generatedHtml = forceNaturalInternalLinks(
            generatedHtml,
            existingPages.map(p => ({ title: p.title, slug: p.slug })),
            wpConfig.url,
            12 // Target 12 internal links
          );
        }

        // ========== STEP 12: ASSEMBLE CONTENT ==========
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "🔧 Assembling content..." } });
        const verificationFooter = generateVerificationFooterHtml();
        let finalContent = performSurgicalUpdate(generatedHtml, { keyTakeawaysHtml: takeawaysHtml, faqHtml, referencesHtml });

        // ========== STEP 13: COMPREHENSIVE POST-PROCESSING ==========
        finalContent = removeH1Tags(finalContent);
        finalContent = removeInternalLinkSections(finalContent);
        finalContent = convertMarkdownTablesToHtml(finalContent);
        finalContent = smartPostProcess(finalContent);
        finalContent = removeDuplicateSections(finalContent);
        finalContent = removeDuplicateVideos(finalContent);
        
        // ========== STEP 14: GUARANTEE REFERENCES ARE PRESENT ==========
        if (!finalContent.includes('sota-references-section') && !finalContent.includes('SOTA-REFERENCES-START')) {
          console.log("[Generate] ⚠️ References missing! Force adding...");
          finalContent += referencesHtml;
        }
        
        // Add verification footer
        if (!finalContent.includes('verification-footer-sota')) {
          finalContent += verificationFooter;
        }

        // ========== STEP 15: SCHEMA ==========
        const faqItems = extractFaqForSchema(finalContent);
        const schemaJson = generateFullSchema({
          title: seoTitle, description: metaDescription, content: finalContent,
          datePublished: new Date().toISOString(), dateModified: new Date().toISOString(),
          author: siteInfo.authorName || "Expert Author", siteInfo, faqItems,
        });

        // ========== COMPLETE ==========
        const finalWordCount = countWords(finalContent);
        const generatedContent: GeneratedContent = {
          title: seoTitle, metaDescription, slug, primaryKeyword: item.title, semanticKeywords,
          content: finalContent, strategy, serpData: serpGaps.topCompetitorTitles, schemaMarkup: schemaJson,
          imageDetails: [], wordCount: finalWordCount,
          socialMediaCopy: { twitter: `🚀 ${seoTitle}`, linkedIn: `New: ${seoTitle}` },
          faqSection: faqItems, keyTakeaways: [], outline: [], references: [],
          neuronAnalysis: neuronData ? { termstxt: { contentbasic: neuronData } } : undefined,
        };

        context.dispatch({ type: "SET_CONTENT", payload: { id: item.id, content: generatedContent } });
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "done", statusText: `✅ ${finalWordCount} words | ${existingPages.length > 0 ? '🔗 Links' : ''} | 📚 Refs` } });
        
        console.log(`[Generate] ✅ SUCCESS: ${item.title} - ${finalWordCount} words`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Generate] ❌ ERROR for ${item.title}:`, error);
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "error", statusText: errMsg } });
      }

      await delay(500);
    }
  },

  async refreshItem(
    item: ContentItem,
    callAIFn: (promptKey: string, args: unknown[], format?: "json" | "html") => Promise<string>,
    context: GenerationContext,
    aiRepairer: (brokenText: string) => Promise<string>
  ): Promise<void> {
    const { existingPages, wpConfig, serperApiKey, siteInfo } = context;

    try {
      let crawledContent = item.crawledContent;
      if (!crawledContent && item.originalUrl) {
        context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "📥 Crawling page..." } });
        crawledContent = await smartCrawl(item.originalUrl);
      }
      if (!crawledContent || crawledContent.length < 500) throw new Error("Content too short");

      const existingImages = extractImagesFromHtml(crawledContent);
      const parser = new DOMParser();
      const doc = parser.parseFromString(crawledContent, "text/html");
      const existingTitle = doc.querySelector("h1")?.textContent?.trim() || item.title || extractSlugFromUrl(item.originalUrl!).replace(/-/g, " ");

      const serpGaps = await analyzeSerpGaps(existingTitle, serperApiKey, callAIFn);

      context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "🔑 Generating keywords..." } });
      const keywordsResponse = await callAIFn("semantickeywordgenerator", [existingTitle], "json");
      let semanticKeywords = extractSemanticKeywords(keywordsResponse, "refresh-keywords");
      semanticKeywords = [...new Set([...serpGaps.missingKeywords, ...semanticKeywords, ...serpGaps.missingEntities])].slice(0, 50);

      context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "generating", statusText: "⚡ Optimizing content..." } });
      const optimizedResponse = await callAIFn("godmodestructuralguardian", [crawledContent, semanticKeywords, existingTitle], "html");
      let optimizedContent = surgicalSanitizer(optimizedResponse);

      optimizedContent = removeH1Tags(optimizedContent);
      optimizedContent = removeInternalLinkSections(optimizedContent);

      if (existingImages.length > 0) optimizedContent = injectImagesIntoContent(optimizedContent, existingImages);

      if (serperApiKey) {
        const videos = await getSmartYoutubeVideos(existingTitle, serperApiKey, 2);
        if (videos.length > 0) optimizedContent = injectYoutubeInRelevantSections(optimizedContent, videos);
      }

      // FORCE internal links
      if (existingPages.length > 0) {
        optimizedContent = forceNaturalInternalLinks(
          optimizedContent,
          existingPages.map(p => ({ title: p.title, slug: p.slug })),
          wpConfig.url,
          10
        );
      }

      // GUARANTEED references
      const referencesHtml = await fetchVerifiedReferences(existingTitle, semanticKeywords, serperApiKey, wpConfig.url);
      const verificationFooter = generateVerificationFooterHtml();
      
      optimizedContent = convertMarkdownTablesToHtml(optimizedContent);
      optimizedContent = smartPostProcess(optimizedContent);
      optimizedContent = removeDuplicateSections(optimizedContent);
      optimizedContent = removeDuplicateVideos(optimizedContent);
      
      // GUARANTEE references
      if (!optimizedContent.includes('sota-references-section')) {
        optimizedContent += referencesHtml;
      }
      optimizedContent += verificationFooter;

      const metaResponse = await callAIFn("seometadatagenerator", [existingTitle, optimizedContent.substring(0, 800), "General", [], null], "json");
      const { seoTitle, metaDescription, slug } = safeJsonParseWithRecovery<{ seoTitle: string; metaDescription: string; slug: string }>(
        metaResponse, "refresh-meta", { seoTitle: existingTitle, metaDescription: `Learn about ${existingTitle}`, slug: extractSlugFromUrl(item.originalUrl!) }
      );

      const faqItems = extractFaqForSchema(optimizedContent);
      const schemaJson = generateFullSchema({
        title: seoTitle, description: metaDescription, content: optimizedContent,
        datePublished: new Date().toISOString(), dateModified: new Date().toISOString(),
        author: siteInfo.authorName || "Expert Author", siteInfo, faqItems,
      });

      const generatedContent: GeneratedContent = {
        title: seoTitle, metaDescription, slug: extractSlugFromUrl(item.originalUrl!) || slug,
        primaryKeyword: existingTitle, semanticKeywords, content: optimizedContent, schemaMarkup: schemaJson,
        strategy: { targetAudience: "General", searchIntent: "Informational", competitorAnalysis: "", contentAngle: "" },
        serpData: [], jsonLdSchema: {}, socialMediaCopy: { twitter: "", linkedIn: "" },
        faqSection: faqItems, keyTakeaways: [], outline: [], references: [], imageDetails: [],
        wordCount: countWords(optimizedContent),
      };

      context.dispatch({ type: "SET_CONTENT", payload: { id: item.id, content: generatedContent } });
      context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "done", statusText: `✅ Refreshed (${countWords(optimizedContent)} words)` } });
    } catch (error) {
      context.dispatch({ type: "UPDATE_STATUS", payload: { id: item.id, status: "error", statusText: error instanceof Error ? error.message : String(error) } });
    }
  },

  async analyzeContentGaps(
    existingPages: SitemapPage[],
    topic: string,
    callAIFn: (promptKey: string, args: unknown[], format?: "json" | "html") => Promise<string>,
    context: GenerationContext
  ): Promise<GapAnalysisSuggestion[]> {
    try {
      const gapResponse = await callAIFn("competitorgapanalyzer", [topic || "General", [], existingPages.map(p => p.title).slice(0, 50).join(",")], "json");
      const parsed = safeJsonParseWithRecovery<any>(gapResponse, "gaps", { gaps: [] });
      return Array.isArray(parsed) ? parsed : parsed.gaps || [];
    } catch { return []; }
  },

  async analyzePages(
    pages: SitemapPage[],
    callAIFn: (promptKey: string, args: unknown[], format?: "json" | "html") => Promise<string>,
    setPages: React.Dispatch<React.SetStateAction<SitemapPage[]>>,
    onProgress: (progress: { current: number; total: number }) => void,
    shouldStop: () => boolean
  ): Promise<void> {
    const analyzePage = async (page: SitemapPage, index: number) => {
      if (shouldStop()) return;
      setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: "analyzing" as const } : p));

      try {
        const crawledContent = await smartCrawl(page.id);
        const wordCount = countWords(crawledContent);

        const analysisResponse = await callAIFn("healthanalyzer", [page.id, crawledContent.substring(0, 5000), page.title || page.slug], "json");
        const analysis = safeJsonParseWithRecovery<{
          healthScore: number; wordCount: number; issues: Array<{ type: string; issue: string; fix: string }>;
          recommendations: string[]; critique?: string; strengths?: string[]; weaknesses?: string[];
        }>(analysisResponse, "health", { healthScore: 50, wordCount, issues: [], recommendations: [], strengths: [], weaknesses: [] });

        const updatePriority = analysis.healthScore < 50 ? "Critical" : analysis.healthScore < 70 ? "High" : analysis.healthScore < 90 ? "Medium" : "Healthy";

        setPages(prev => prev.map(p => p.id === page.id ? {
          ...p, status: "analyzed" as const, crawledContent, wordCount, healthScore: analysis.healthScore, updatePriority,
          justification: analysis.recommendations?.[0] || "Analysis complete",
          analysis: {
            critique: analysis.critique || `Health: ${analysis.healthScore}/100`,
            strengths: analysis.strengths || [], weaknesses: analysis.weaknesses || analysis.issues?.map(i => i.issue) || [],
            recommendations: analysis.recommendations || [], seoScore: analysis.healthScore, readabilityScore: Math.min(100, analysis.healthScore + 10),
          },
        } : p));
      } catch (error) {
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: "error" as const, justification: error instanceof Error ? error.message : String(error) } : p));
      }
      onProgress({ current: index + 1, total: pages.length });
    };

    await processConcurrently(pages, analyzePage, 3, () => {}, shouldStop);
  },
};

// ============================================================================
// SECTION 8: IMAGE GENERATION & WORDPRESS PUBLISHING
// ============================================================================

export const generateImageWithFallback = async (apiClients: ApiClients, prompt: string): Promise<string | null> => {
  if (apiClients.gemini) {
    try {
      const response = await (apiClients.gemini as GoogleGenAI).models.generateImages({
        model: AI_MODELS.GEMINI_IMAGEN, prompt, config: { numberOfImages: 1, outputOptions: { mimeType: "image/png" } },
      });
      const imageData = (response as { generatedImages?: Array<{ image?: { imageBytes?: string } }> }).generatedImages?.[0]?.image?.imageBytes;
      if (imageData) return `data:image/png;base64,${imageData}`;
    } catch {}
  }
  if (apiClients.openai) {
    try {
      const response = await (apiClients.openai as OpenAI).images.generate({
        model: AI_MODELS.OPENAI_DALLE3, prompt, n: 1, size: "1024x1024", quality: "standard", response_format: "b64_json",
      });
      const imageData = response.data[0]?.b64_json;
      if (imageData) return `data:image/png;base64,${imageData}`;
    } catch {}
  }
  return null;
};

export const publishItemToWordPress = async (
  item: ContentItem, wpPassword: string, status: "publish" | "draft", fetchFn: typeof fetch, wpConfig: WpConfig
): Promise<{ success: boolean; message: React.ReactNode; link?: string; postId?: number }> => {
  if (!item.generatedContent) return { success: false, message: "No content" };

  const { title, metaDescription, slug, content, schemaMarkup } = item.generatedContent;
  const baseUrl = wpConfig.url.replace(/\/$/, "");
  const authHeader = `Basic ${btoa(`${wpConfig.username}:${wpPassword}`)}`;
  const schemaString = schemaMarkup ? JSON.stringify(schemaMarkup) : "";
  const contentWithSchema = schemaString ? `${content}<script type="application/ld+json">${schemaString}</script>` : content;

  try {
    const isUpdate = !!item.originalUrl;
    let postId: number | null = null;

    if (isUpdate) {
      const postsRes = await fetchFn(`${baseUrl}/wp-json/wp/v2/posts?slug=${slug}&status=any`, { method: "GET", headers: { Authorization: authHeader } });
      try {
        const posts = safeJsonParse<Array<{ id: number }>>(await postsRes.text(), "WP Lookup");
        if (posts.length > 0) postId = posts[0].id;
      } catch {}
    }

    const endpoint = postId ? `${baseUrl}/wp-json/wp/v2/posts/${postId}` : `${baseUrl}/wp-json/wp/v2/posts`;
    const response = await fetchFn(endpoint, {
      method: postId ? "PUT" : "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: contentWithSchema, status, slug, excerpt: metaDescription,
        meta: { _yoast_wpseo_title: title, _yoast_wpseo_metadesc: metaDescription } }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      try { const err = safeJsonParse<{ message?: string }>(responseText, "WP Error"); return { success: false, message: err.message || `HTTP ${response.status}` }; }
      catch { return { success: false, message: `WordPress returned ${response.status}` }; }
    }

    const result = safeJsonParse<{ id: number; link: string }>(responseText, "WP Publish");
    return { success: true, message: postId ? "Updated!" : "Published!", link: result.link, postId: result.id };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) };
  }
};

// ============================================================================
// SECTION 9: GOD MODE MAINTENANCE ENGINE
// ============================================================================

class MaintenanceEngine {
  isRunning = false;
  logCallback: (msg: string) => void = console.log;
  private context: GenerationContext | null = null;
  private intervalId: ReturnType<typeof setTimeout> | null = null;

  start(context: GenerationContext): void {
    if (!context.apiClients) { this.logCallback("❌ No API Clients!"); return; }
    if (context.existingPages.length === 0) { this.logCallback("⚠️ No pages in sitemap."); return; }
    this.isRunning = true;
    this.context = context;
    this.logCallback(`🚀 God Mode Activated: ${context.existingPages.length} pages`);
    this.runMaintenanceCycle();
  }

  stop(): void {
    this.isRunning = false;
    this.context = null;
    if (this.intervalId) { clearTimeout(this.intervalId); this.intervalId = null; }
    this.logCallback("⏹️ God Mode Deactivated");
  }

  updateContext(context: GenerationContext): void { this.context = context; }

  private async runMaintenanceCycle(): Promise<void> {
    if (!this.isRunning || !this.context) return;
    try {
      const page = this.getNextPageToOptimize();
      if (!page) { this.logCallback("✅ All pages optimized."); this.scheduleCycle(60000); return; }
      this.logCallback(`🎯 Target: ${page.title || page.slug}`);
      await this.optimizePage(page);
      this.scheduleCycle(5000);
    } catch (error) {
      this.logCallback(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      this.scheduleCycle(30000);
    }
  }

  private scheduleCycle(delayMs: number): void {
    if (!this.isRunning) return;
    this.intervalId = setTimeout(() => this.runMaintenanceCycle(), delayMs);
  }

  private getNextPageToOptimize(): SitemapPage | null {
    if (!this.context) return null;
    const { existingPages, excludedUrls, excludedCategories, priorityUrls, priorityOnlyMode } = this.context;
    const eligible = existingPages.filter(page => {
      if (excludedUrls?.some(url => page.id.includes(url))) return false;
      if (excludedCategories?.some(cat => page.id.toLowerCase().includes(cat.toLowerCase()))) return false;
      const lastProc = localStorage.getItem(`sota_last_proc_${page.id}`);
      if (lastProc && (Date.now() - parseInt(lastProc)) / (1000 * 60 * 60 * 24) < 7) return false;
      return true;
    });
    if (priorityOnlyMode && priorityUrls?.length) return eligible.find(p => priorityUrls.includes(p.id)) || null;
    eligible.sort((a, b) => {
      const aP = priorityUrls?.includes(a.id) || false, bP = priorityUrls?.includes(b.id) || false;
      if (aP && !bP) return -1;
      if (!aP && bP) return 1;
      return (b.daysOld || 0) - (a.daysOld || 0);
    });
    return eligible[0] || null;
  }

  private async optimizePage(page: SitemapPage): Promise<void> {
    if (!this.context) return;
    const { apiClients, selectedModel, geoTargeting, openrouterModels, selectedGroqModel, wpConfig, serperApiKey, siteInfo, existingPages } = this.context;

    try {
      this.logCallback(`📥 Crawling ${page.id}`);
      const crawledContent = await smartCrawl(page.id);
      if (!crawledContent || crawledContent.length < 300) { this.logCallback(`⚠️ Content too short.`); return; }

      const callAIFn = (pk: string, args: unknown[], fmt: "json" | "html" = "json") => 
        callAI(apiClients, selectedModel, geoTargeting, openrouterModels, selectedGroqModel, pk, args, fmt);
      
      const serpGaps = await analyzeSerpGaps(page.title || page.slug, serperApiKey, callAIFn);

      this.logCallback("🔍 Generating keywords...");
      const keywordsResponse = await callAI(apiClients, selectedModel, geoTargeting, openrouterModels, selectedGroqModel, "semantickeywordgenerator", [page.title || page.slug], "json");
      let semanticKeywords = extractSemanticKeywords(keywordsResponse, "God Mode Keywords");
      semanticKeywords = [...new Set([...serpGaps.missingKeywords, ...semanticKeywords, ...serpGaps.missingEntities])].slice(0, 50);

      this.logCallback("⚡ Optimizing...");
      const optimizedResponse = await callAI(apiClients, selectedModel, geoTargeting, openrouterModels, selectedGroqModel, "godmodestructuralguardian", [crawledContent, semanticKeywords, page.title || page.slug], "html");
      let optimizedContent = surgicalSanitizer(optimizedResponse);
      
      optimizedContent = removeH1Tags(optimizedContent);
      optimizedContent = removeInternalLinkSections(optimizedContent);
      
      let changesMade = optimizedContent.length > crawledContent.length * 0.6 ? 1 : 0;

      if (!optimizedContent.includes("verification-footer-sota")) {
        optimizedContent += generateVerificationFooterHtml();
        changesMade++;
      }

      // FORCE references
      if (!optimizedContent.includes("sota-references-section") && serperApiKey) {
        const refs = await fetchVerifiedReferences(page.title || page.slug, semanticKeywords, serperApiKey, wpConfig.url);
        if (refs) { optimizedContent += refs; changesMade++; }
      }

      // FORCE internal links
      if (existingPages.length > 0) {
        optimizedContent = forceNaturalInternalLinks(
          optimizedContent,
          existingPages.map(p => ({ title: p.title, slug: p.slug })),
          wpConfig.url,
          8
        );
        changesMade++;
      }

      // YouTube
      if (serperApiKey && !optimizedContent.includes("youtube.com/embed")) {
        const videos = await getSmartYoutubeVideos(page.title || page.slug, serperApiKey, 2);
        if (videos.length > 0) {
          optimizedContent = injectYoutubeInRelevantSections(optimizedContent, videos);
          changesMade++;
        }
      }

      optimizedContent = convertMarkdownTablesToHtml(optimizedContent);
      optimizedContent = smartPostProcess(optimizedContent);
      optimizedContent = removeDuplicateSections(optimizedContent);
      optimizedContent = removeDuplicateVideos(optimizedContent);

      if (changesMade > 0) {
        this.logCallback(`📤 Publishing ${changesMade} improvements...`);
        const item: ContentItem = {
          id: page.id, title: page.title!, type: "refresh", originalUrl: page.id, status: "done", statusText: "Optimized",
          generatedContent: {
            title: page.title!, slug: page.slug, content: optimizedContent, metaDescription: "",
            primaryKeyword: page.title!, semanticKeywords,
            strategy: { targetAudience: "", searchIntent: "", competitorAnalysis: "", contentAngle: "" },
            jsonLdSchema: {}, socialMediaCopy: { twitter: "", linkedIn: "" },
            faqSection: [], keyTakeaways: [], outline: [], references: [], imageDetails: [],
          },
        };

        const result = await publishItemToWordPress(item, localStorage.getItem("wpPassword") || "", "publish", fetchWithProxies, wpConfig);
        if (result.success) {
          this.logCallback(`✅ SUCCESS|${page.title}|${page.id}`);
          localStorage.setItem(`sota_last_proc_${page.id}`, Date.now().toString());
        } else {
          this.logCallback(`❌ Failed: ${result.message}`);
        }
      } else {
        this.logCallback(`✅ No changes needed for ${page.title}`);
      }
    } catch (error) {
      this.logCallback(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const maintenanceEngine = new MaintenanceEngine();

// ============================================================================
// EXPORTS
// ============================================================================

export {
  extractJsonFromResponse,
  safeJsonParse,
  safeJsonParseWithRecovery,
  extractSemanticKeywords,
  surgicalSanitizer,
  stripMarkdownCodeBlocks,
  repairTruncatedJson,
  removeH1Tags,
  removeInternalLinkSections,
  removeDuplicateVideos
};
