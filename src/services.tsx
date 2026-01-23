// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - SERVICES v15.0
// Enterprise-Grade API Services
// =============================================================================

import { buildPrompt, BANNED_AI_PHRASES, PROMPT_CONSTANTS } from './prompts';
import {
  normalizeGeneratedContent,
  convertMarkdownTablesToHtml,
  removeDuplicateSections,
  smartPostProcess,
  countWords,
  fetchWithProxies,
  generateVerificationFooterHtml,
  extractFaqForSchema,
  processLinkCandidatesStrict,
  forceNaturalInternalLinks,
  escapeRegExp,
} from './contentUtils';
import {
  AI_MODELS,
  TARGET_MIN_WORDS,
  TARGET_MAX_WORDS,
} from './constants';

// ==================== TYPE DEFINITIONS ====================

export interface ApiKeys {
  geminiKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
  openrouterKey?: string;
  groqKey?: string;
  serperKey?: string;
  imgurClientId?: string;
}

export interface WpConfig {
  url: string;
  username: string;
}

export interface ContentItem {
  id: string;
  title: string;
  originalUrl?: string;
  status: 'pending' | 'processing' | 'done' | 'error' | 'published';
  generatedContent?: GeneratedContent;
  error?: string;
  progress?: number;
}

export interface GeneratedContent {
  title: string;
  content: string;
  metaDescription: string;
  slug: string;
  seoTitle?: string;
  wordCount?: number;
  internalLinksCount?: number;
  faqItems?: Array<{ question: string; answer: string }>;
}

export interface ExistingPage {
  title: string;
  slug: string;
}

export interface SerpResult {
  title: string;
  snippet: string;
  link: string;
  position: number;
}

export interface GapAnalysisResult {
  uncoveredEntities: Array<{
    entity: string;
    priority: number;
    searchIntent: string;
    difficulty: string;
    suggestedTitle: string;
    suggestedAngle: string;
  }>;
  semanticCoverageScore: number;
  recommendations: string[];
}

export interface ContentStrategy {
  targetAudience: string;
  searchIntent: string;
  contentAngle: string;
  keyMessages: string[];
  estimatedWordCount: number;
}

// ==================== AI PROVIDERS ====================

export const callGeminiAPI = async (
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  model: string = 'gemini-2.5-flash'
): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192, topP: 0.95, topK: 40 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content generated from Gemini');
  return text;
};

export const callOpenAIAPI = async (
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  model: string = 'gpt-4o'
): Promise<string> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

export const callAnthropicAPI = async (
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  model: string = 'claude-3-5-sonnet-20241022'
): Promise<string> => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemInstruction,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text || '';
};

export const callOpenRouterAPI = async (
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  model: string = 'google/gemini-2.5-flash'
): Promise<string> => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://sota-app.com',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

export const callGroqAPI = async (
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  model: string = 'llama3-70b-8192'
): Promise<string> => {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

export const callAI = async (
  apiKeys: ApiKeys,
  systemInstruction: string,
  userPrompt: string,
  preferredModel?: string
): Promise<string> => {
  const errors: string[] = [];
  if (apiKeys.geminiKey) {
    try {
      return await callGeminiAPI(apiKeys.geminiKey, systemInstruction, userPrompt);
    } catch (e: any) { errors.push(`Gemini: ${e.message}`); }
  }
  if (apiKeys.groqKey) {
    try {
      return await callGroqAPI(apiKeys.groqKey, systemInstruction, userPrompt);
    } catch (e: any) { errors.push(`Groq: ${e.message}`); }
  }
  if (apiKeys.openrouterKey) {
    try {
      return await callOpenRouterAPI(apiKeys.openrouterKey, systemInstruction, userPrompt);
    } catch (e: any) { errors.push(`OpenRouter: ${e.message}`); }
  }
  if (apiKeys.openaiKey) {
    try {
      return await callOpenAIAPI(apiKeys.openaiKey, systemInstruction, userPrompt);
    } catch (e: any) { errors.push(`OpenAI: ${e.message}`); }
  }
  if (apiKeys.anthropicKey) {
    try {
      return await callAnthropicAPI(apiKeys.anthropicKey, systemInstruction, userPrompt);
    } catch (e: any) { errors.push(`Anthropic: ${e.message}`); }
  }
  throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
};

// ==================== CONTENT GENERATION ====================

export const generateSemanticKeywords = async (apiKeys: ApiKeys, primaryKeyword: string): Promise<string[]> => {
  try {
    const { system, user } = buildPrompt('semantic_keyword_generator', [primaryKeyword]);
    const response = await callAI(apiKeys, system, user);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.semanticKeywords || [];
    }
    return [];
  } catch (error) {
    console.error('[generateSemanticKeywords] Error:', error);
    return [];
  }
};

export const generateContentStrategy = async (apiKeys: ApiKeys, topic: string, semanticKeywords: string[]): Promise<ContentStrategy> => {
  try {
    const { system, user } = buildPrompt('content_strategy_generator', [topic, semanticKeywords]);
    const response = await callAI(apiKeys, system, user);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { targetAudience: 'General', searchIntent: 'informational', contentAngle: 'Comprehensive guide', keyMessages: [], estimatedWordCount: 2800 };
  } catch (error) {
    return { targetAudience: 'General', searchIntent: 'informational', contentAngle: 'Comprehensive guide', keyMessages: [], estimatedWordCount: 2800 };
  }
};

export const performGapAnalysis = async (apiKeys: ApiKeys, primaryKeyword: string, serpContent: string, existingPages: string): Promise<GapAnalysisResult> => {
  try {
    const { system, user } = buildPrompt('sota_gap_analysis', [primaryKeyword, serpContent, existingPages]);
    const response = await callAI(apiKeys, system, user);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { uncoveredEntities: parsed.uncoveredEntities || [], semanticCoverageScore: parsed.semanticCoverageScore || 0, recommendations: parsed.recommendations || [] };
    }
    return { uncoveredEntities: [], semanticCoverageScore: 0, recommendations: [] };
  } catch (error) {
    return { uncoveredEntities: [], semanticCoverageScore: 0, recommendations: [] };
  }
};

export const generateSeoMetadata = async (
  apiKeys: ApiKeys,
  primaryKeyword: string,
  contentSummary: string,
  targetAudience: string,
  geoLocation?: string | null
): Promise<{ seoTitle: string; metaDescription: string; slug: string }> => {
  try {
    const { system, user } = buildPrompt('seo_metadata_generator', [primaryKeyword, contentSummary, targetAudience, [], geoLocation]);
    const response = await callAI(apiKeys, system, user);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    const slug = primaryKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { seoTitle: `${primaryKeyword} - Complete Guide ${new Date().getFullYear()}`, metaDescription: `Discover everything about ${primaryKeyword}. Expert insights and strategies.`, slug };
  } catch (error) {
    const slug = primaryKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { seoTitle: `${primaryKeyword} - Complete Guide`, metaDescription: `Learn about ${primaryKeyword}.`, slug };
  }
};

export const generateFaqSection = async (apiKeys: ApiKeys, topic: string, semanticKeywords: string[]): Promise<string> => {
  try {
    const { system, user } = buildPrompt('sota_faq_generator', [topic, semanticKeywords]);
    const response = await callAI(apiKeys, system, user);
    return normalizeGeneratedContent(response);
  } catch (error) {
    return '';
  }
};

export const generateKeyTakeaways = async (apiKeys: ApiKeys, topic: string, content: string): Promise<string> => {
  try {
    const { system, user } = buildPrompt('sota_takeaways_generator', [topic, content]);
    const response = await callAI(apiKeys, system, user);
    return normalizeGeneratedContent(response);
  } catch (error) {
    return '';
  }
};

export const generateArticleContent = async (
  apiKeys: ApiKeys,
  topic: string,
  semanticKeywords: string[],
  strategy: ContentStrategy,
  existingPages: ExistingPage[],
  competitorGaps: string[],
  geoLocation?: string | null,
  neuronData?: string | null,
  onProgress?: (message: string) => void
): Promise<string> => {
  onProgress?.('Generating enterprise-grade content...');
  const { system, user } = buildPrompt('ultra_sota_article_writer', [topic, semanticKeywords, strategy, existingPages, competitorGaps, geoLocation, neuronData]);
  let content = await callAI(apiKeys, system, user);
  onProgress?.('Post-processing content...');
  content = normalizeGeneratedContent(content);
  content = convertMarkdownTablesToHtml(content);
  content = removeDuplicateSections(content);
  return content;
};

export const processInternalLinks = (
  content: string,
  existingPages: ExistingPage[],
  baseUrl: string,
  targetLinks: number = 12
): { content: string; stats: { injected: number; rejected: number; rejectedAnchors: string[] } } => {
  const { content: processedContent, injectedCount, rejectedCount, rejectedAnchors, acceptedAnchors } = processLinkCandidatesStrict(content, existingPages, baseUrl);
  const remainingLinks = Math.max(0, targetLinks - injectedCount);
  let finalContent = processedContent;
  if (remainingLinks > 0 && existingPages.length > injectedCount) {
    const usedSlugs = new Set(acceptedAnchors.map(a => a.toLowerCase()));
    const remainingPages = existingPages.filter(p => !usedSlugs.has(p.slug.toLowerCase()));
    if (remainingPages.length > 0) {
      finalContent = forceNaturalInternalLinks(finalContent, remainingPages, baseUrl, remainingLinks);
    }
  }
  return { content: finalContent, stats: { injected: injectedCount, rejected: rejectedCount, rejectedAnchors } };
};

export const generateFullContent = async (
  apiKeys: ApiKeys,
  topic: string,
  existingPages: ExistingPage[],
  wpConfig: WpConfig,
  options: { geoLocation?: string | null; neuronData?: string | null; includeVideos?: boolean; includeReferences?: boolean } = {},
  onProgress?: (message: string) => void
): Promise<GeneratedContent> => {
  const startTime = Date.now();
  try {
    onProgress?.('Generating semantic keywords...');
    const semanticKeywords = await generateSemanticKeywords(apiKeys, topic);
    onProgress?.('Analyzing content strategy...');
    const strategy = await generateContentStrategy(apiKeys, topic, semanticKeywords);
    onProgress?.('Performing gap analysis...');
    const existingTitles = existingPages.map(p => p.title).join(', ');
    const gapAnalysis = await performGapAnalysis(apiKeys, topic, '', existingTitles);
    const competitorGaps = gapAnalysis.uncoveredEntities.slice(0, 15).map(e => e.entity);
    onProgress?.('Generating article content...');
    let content = await generateArticleContent(apiKeys, topic, semanticKeywords, strategy, existingPages, competitorGaps, options.geoLocation, options.neuronData, onProgress);
    onProgress?.('Processing internal links...');
    const { content: linkedContent, stats: linkStats } = processInternalLinks(content, existingPages, wpConfig.url, 12);
    content = linkedContent;
    content += generateVerificationFooterHtml();
    onProgress?.('Finalizing content...');
    content = smartPostProcess(content);
    onProgress?.('Generating SEO metadata...');
    const contentSummary = content.replace(/<[^>]*>/g, ' ').substring(0, 500);
    const seoMetadata = await generateSeoMetadata(apiKeys, topic, contentSummary, strategy.targetAudience, options.geoLocation);
    const faqItems = extractFaqForSchema(content);
    const wordCount = countWords(content);
    return { title: seoMetadata.seoTitle, content, metaDescription: seoMetadata.metaDescription, slug: seoMetadata.slug, seoTitle: seoMetadata.seoTitle, wordCount, internalLinksCount: linkStats.injected, faqItems };
  } catch (error: any) {
    throw error;
  }
};

// Alias for compatibility
export const generateContent = generateFullContent;

// ==================== WORDPRESS ====================

export const publishToWordPress = async (
  content: GeneratedContent,
  wpConfig: WpConfig,
  wpPassword: string,
  status: 'publish' | 'draft' | 'pending' = 'publish',
  existingPostId?: number
): Promise<{ success: boolean; url?: string; postId?: number; message?: string }> => {
  try {
    if (!wpConfig.url || !wpConfig.username || !wpPassword) {
      return { success: false, message: 'WordPress credentials not configured' };
    }
    const baseUrl = wpConfig.url.replace(/\/+$/, '');
    const authHeader = 'Basic ' + btoa(`${wpConfig.username}:${wpPassword}`);
    const postData: Record<string, any> = { title: content.title || content.seoTitle, content: content.content, status, excerpt: content.metaDescription };
    if (content.slug) postData.slug = content.slug;
    let endpoint = `${baseUrl}/wp-json/wp/v2/posts`;
    let method = 'POST';
    if (existingPostId) { endpoint = `${baseUrl}/wp-json/wp/v2/posts/${existingPostId}`; method = 'PUT'; }
    const response = await fetch(endpoint, { method, headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(postData) });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.message || response.statusText };
    }
    const result = await response.json();
    return { success: true, url: result.link, postId: result.id, message: 'Published successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const publishItemToWordPress = async (
  item: ContentItem,
  wpPassword: string,
  status: 'publish' | 'draft' | 'pending',
  wpConfig: WpConfig
): Promise<{ success: boolean; message?: string; url?: string; postId?: number }> => {
  if (!item.generatedContent) return { success: false, message: 'No generated content' };
  return publishToWordPress(item.generatedContent, wpConfig, wpPassword, status);
};

export const getExistingPages = async (wpConfig: WpConfig, wpPassword: string): Promise<ExistingPage[]> => {
  try {
    const baseUrl = wpConfig.url.replace(/\/+$/, '');
    const authHeader = 'Basic ' + btoa(`${wpConfig.username}:${wpPassword}`);
    const pages: ExistingPage[] = [];
    let page = 1;
    while (true) {
      const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=100&page=${page}&status=publish`, { headers: { 'Authorization': authHeader } });
      if (!response.ok) break;
      const posts = await response.json();
      if (posts.length === 0) break;
      posts.forEach((post: any) => pages.push({ title: post.title.rendered, slug: post.slug }));
      if (posts.length < 100) break;
      page++;
    }
    return pages;
  } catch (error) {
    return [];
  }
};

export const parseSitemap = async (sitemapUrl: string): Promise<ExistingPage[]> => {
  try {
    const response = await fetchWithProxies(sitemapUrl);
    const xml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const pages: ExistingPage[] = [];
    doc.querySelectorAll('url loc').forEach(loc => {
      const url = loc.textContent || '';
      if (url && !url.includes('/wp-content/') && !url.includes('/tag/') && !url.includes('/category/')) {
        const slug = url.split('/').filter(Boolean).pop() || '';
        if (slug && slug !== 'sitemap.xml') {
          const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          pages.push({ title, slug });
        }
      }
    });
    return pages;
  } catch (error) {
    return [];
  }
};

// ==================== SERP & ANALYSIS ====================

export const getSerpResults = async (keyword: string, serperKey: string, count: number = 10): Promise<SerpResult[]> => {
  if (!serperKey) return [];
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: keyword, num: count }),
    });
    if (!response.ok) throw new Error('Serper API error');
    const data = await response.json();
    return (data.organic || []).map((result: any, index: number) => ({ title: result.title, snippet: result.snippet || '', link: result.link, position: index + 1 }));
  } catch (error) {
    return [];
  }
};

export const analyzeContentHealth = async (apiKeys: ApiKeys, url: string, content: string, targetKeyword: string): Promise<{ healthScore: number; wordCount: number; issues: Array<{ type: string; issue: string; fix: string }>; recommendations: string[]; strengths: string[]; weaknesses: string[] }> => {
  try {
    const { system, user } = buildPrompt('health_analyzer', [url, content, targetKeyword]);
    const response = await callAI(apiKeys, system, user);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { healthScore: 50, wordCount: countWords(content), issues: [], recommendations: [], strengths: [], weaknesses: [] };
  } catch (error) {
    return { healthScore: 50, wordCount: countWords(content), issues: [], recommendations: [], strengths: [], weaknesses: [] };
  }
};

// ==================== GOD MODE ====================

export const godModeOptimize = async (
  apiKeys: ApiKeys,
  existingContent: string,
  semanticKeywords: string[],
  existingPages: ExistingPage[],
  topic: string,
  onProgress?: (message: string) => void
): Promise<string> => {
  onProgress?.('God Mode: Analyzing content...');
  const { system, user } = buildPrompt('god_mode_autonomous_agent', [existingContent, semanticKeywords, existingPages, topic]);
  let optimized = await callAI(apiKeys, system, user);
  onProgress?.('God Mode: Post-processing...');
  optimized = normalizeGeneratedContent(optimized);
  optimized = convertMarkdownTablesToHtml(optimized);
  optimized = removeDuplicateSections(optimized);
  return optimized;
};

// ==================== MAINTENANCE ENGINE (COMPLETE WITH START/STOP) ====================

export const maintenanceEngine = {
  _isRunning: false,
  _intervalId: null as ReturnType<typeof setInterval> | null,
  _context: null as any,

  start: function(context?: any): boolean {
    console.log('[MaintenanceEngine] Starting...');
    this._isRunning = true;
    this._context = context || null;
    if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
    return true;
  },

  stop: function(): boolean {
    console.log('[MaintenanceEngine] Stopping...');
    this._isRunning = false;
    this._context = null;
    if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
    return true;
  },

  isRunning: function(): boolean { return this._isRunning; },

  checkFreshness: async function(content: string): Promise<{ needsUpdate: boolean; reasons: string[]; priority: 'high' | 'medium' | 'low' }> {
    const reasons: string[] = [];
    let priority: 'high' | 'medium' | 'low' = 'low';
    const currentYear = new Date().getFullYear();
    const yearMatches = content.match(/\b(20\d{2})\b/g) || [];
    const outdatedYears = yearMatches.filter(y => parseInt(y) < currentYear - 1);
    if (outdatedYears.length > 0) { reasons.push(`Outdated years: ${[...new Set(outdatedYears)].join(', ')}`); priority = 'high'; }
    const wordCount = content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
    if (wordCount < 1500) { reasons.push(`Short content: ${wordCount} words`); priority = priority === 'high' ? 'high' : 'medium'; }
    const linkCount = (content.match(/<a\s+[^>]*href/gi) || []).length;
    if (linkCount < 5) reasons.push(`Few links: ${linkCount}`);
    return { needsUpdate: reasons.length > 0, reasons, priority };
  },

  updateDates: function(content: string): string {
    const currentYear = new Date().getFullYear();
    return content.replace(/\b(20[12]\d)\b(?![^<]*>)/g, (match) => parseInt(match) < currentYear - 1 ? String(currentYear) : match);
  },

  analyze: async function(content: string): Promise<{ score: number; issues: Array<{ type: string; message: string; priority: string }>; suggestions: string[] }> {
    const issues: Array<{ type: string; message: string; priority: string }> = [];
    const suggestions: string[] = [];
    let score = 100;
    const wordCount = content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
    if (wordCount < 2000) { issues.push({ type: 'content', message: `Word count: ${wordCount}`, priority: 'high' }); score -= 20; suggestions.push('Expand to 2500+ words'); }
    const h2Count = (content.match(/<h2/gi) || []).length;
    if (h2Count < 4) { issues.push({ type: 'structure', message: `H2s: ${h2Count}`, priority: 'medium' }); score -= 10; }
    const linkCount = (content.match(/<a\s+[^>]*href/gi) || []).length;
    if (linkCount < 8) { issues.push({ type: 'seo', message: `Links: ${linkCount}`, priority: 'high' }); score -= 15; }
    return { score: Math.max(0, score), issues, suggestions };
  },
};

// ==================== IMAGE GENERATION ====================

export const generateImageWithFallback = async (
  apiKeys: ApiKeys,
  prompt: string,
  options: { style?: string; size?: string } = {}
): Promise<{ url: string; source: string } | null> => {
  if (apiKeys.openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeys.openaiKey}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt: `${prompt}. Professional, high quality.`, n: 1, size: options.size || '1024x1024' }),
      });
      if (response.ok) {
        const data = await response.json();
        const url = data.data?.[0]?.url;
        if (url) return { url, source: 'openai' };
      }
    } catch (e) { console.warn('[generateImage] OpenAI failed'); }
  }
  return null;
};

// ==================== REFERENCES ====================

export const fetchVerifiedReferences = async (topic: string, serperKey: string, count: number = 8): Promise<Array<{ title: string; url: string; snippet: string; domain: string; isAuthority: boolean }>> => {
  if (!serperKey) return [];
  const authorityDomains = ['nih.gov', 'cdc.gov', 'who.int', 'edu', 'gov', 'mayoclinic.org', 'harvard.edu', 'nature.com'];
  const excludedDomains = ['reddit.com', 'quora.com', 'pinterest.com', 'facebook.com', 'twitter.com', 'medium.com'];
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: `${topic} research site:.edu OR site:.gov OR site:.org`, num: 20 }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const results: Array<{ title: string; url: string; snippet: string; domain: string; isAuthority: boolean }> = [];
    for (const result of data.organic || []) {
      if (results.length >= count) break;
      try {
        const url = new URL(result.link);
        const domain = url.hostname.replace('www.', '');
        if (excludedDomains.some(d => domain.includes(d))) continue;
        const isAuthority = authorityDomains.some(d => domain.includes(d));
        results.push({ title: result.title, url: result.link, snippet: result.snippet || '', domain, isAuthority });
      } catch { continue; }
    }
    return results.sort((a, b) => (b.isAuthority ? 1 : 0) - (a.isAuthority ? 1 : 0));
  } catch (error) { return []; }
};

export const generateReferences = async (apiKeys: ApiKeys, topic: string): Promise<string> => {
  try {
    const { system, user } = buildPrompt('reference_generator', [topic]);
    return normalizeGeneratedContent(await callAI(apiKeys, system, user));
  } catch { return ''; }
};

// ==================== UTILITIES ====================

export const repairJson = async (apiKeys: ApiKeys, brokenJson: string): Promise<any> => {
  try { return JSON.parse(brokenJson); } catch {}
  const { system, user } = buildPrompt('json_repair', [brokenJson]);
  const response = await callAI(apiKeys, system, user);
  const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);
  throw new Error('Failed to repair JSON');
};

export const uploadToImgur = async (imageData: string, clientId: string): Promise<string> => {
  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: { 'Authorization': `Client-ID ${clientId}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData.replace(/^data:image\/\w+;base64,/, ''), type: 'base64' }),
  });
  if (!response.ok) throw new Error('Imgur upload failed');
  const data = await response.json();
  return data.data.link;
};

export const generateClusterPlan = async (apiKeys: ApiKeys, topic: string): Promise<any> => {
  try {
    const { system, user } = buildPrompt('cluster_planner', [topic]);
    const response = await callAI(apiKeys, system, user);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch { return null; }
};

export const fetchNeuronwriterData = async (queryId: string, apiKey: string): Promise<string | null> => {
  if (!queryId || !apiKey) return null;
  try {
    const response = await fetch(`https://app.neuronwriter.com/api/query/${queryId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const nlpTerms = data.nlp_terms || data.terms || [];
    return Array.isArray(nlpTerms) && nlpTerms.length > 0 ? nlpTerms.slice(0, 50).map((t: any) => t.term || t).join(', ') : null;
  } catch { return null; }
};

export const getGuaranteedYoutubeVideos = async (keyword: string, serperApiKey: string, count: number = 2): Promise<Array<{ videoId: string; title: string }>> => {
  if (!serperApiKey) return [];
  try {
    const response = await fetch('https://google.serper.dev/videos', {
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
    return videos;
  } catch { return []; }
};

// ==================== DEFAULT EXPORT ====================

export default {
  callAI, callGeminiAPI, callOpenAIAPI, callAnthropicAPI, callOpenRouterAPI, callGroqAPI,
  generateContent, generateFullContent, generateSemanticKeywords, generateContentStrategy, performGapAnalysis,
  generateSeoMetadata, generateFaqSection, generateKeyTakeaways, generateArticleContent, processInternalLinks,
  publishToWordPress, publishItemToWordPress, getExistingPages, parseSitemap,
  getSerpResults, analyzeContentHealth, godModeOptimize,
  maintenanceEngine, generateImageWithFallback, fetchVerifiedReferences, generateReferences,
  repairJson, uploadToImgur, generateClusterPlan, fetchNeuronwriterData, getGuaranteedYoutubeVideos,
};
