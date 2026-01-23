// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - SERVICES v15.0
// Enterprise-Grade API Services with Strict Anchor Validation
// =============================================================================

import { 
  buildPrompt, 
  PROMPT_TEMPLATES, 
  BANNED_AI_PHRASES,
  PROMPT_CONSTANTS 
} from './prompts';

import {
  normalizeGeneratedContent,
  convertMarkdownTablesToHtml,
  removeDuplicateSections,
  smartPostProcess,
  countWords,
  fetchWithProxies,
  generateVerificationFooterHtml,
  performSurgicalUpdate,
  getGuaranteedYoutubeVideos,
  generateYoutubeEmbedHtml,
  extractFaqForSchema,
  isBlockedDomain,
  processLinkCandidatesStrict,
  forceNaturalInternalLinks,
  validateAnchorTextStrict,
  escapeRegExp,
} from './contentUtils';

import {
  AI_MODELS,
  CACHE_TTL,
  API_TIMEOUTS,
  RETRY_CONFIG,
  TARGET_MIN_WORDS,
  TARGET_MAX_WORDS,
  MIN_INTERNAL_LINKS,
  MAX_INTERNAL_LINKS,
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
  status: 'pending' | 'processing' | 'done' | 'error';
  generatedContent?: GeneratedContent;
  error?: string;
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

// ==================== AI PROVIDER FUNCTIONS ====================

/**
 * Call Gemini API
 */
export const callGeminiAPI = async (
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  model: string = AI_MODELS.GEMINI_FLASH
): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.95,
        topK: 40,
      },
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

  if (!text) {
    throw new Error('No content generated from Gemini');
  }

  return text;
};

/**
 * Call OpenAI API
 */
export const callOpenAIAPI = async (
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  model: string = AI_MODELS.OPENAI_GPT4_TURBO
): Promise<string> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('No content generated from OpenAI');
  }

  return text;
};

/**
 * Call Anthropic API
 */
export const callAnthropicAPI = async (
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  model: string = AI_MODELS.ANTHROPIC_SONNET
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
  const text = data.content?.[0]?.text;

  if (!text) {
    throw new Error('No content generated from Anthropic');
  }

  return text;
};

/**
 * Call OpenRouter API
 */
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
      'HTTP-Referer': window.location.origin,
      'X-Title': 'SOTA WP Content Optimizer',
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
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('No content generated from OpenRouter');
  }

  return text;
};

/**
 * Call Groq API
 */
export const callGroqAPI = async (
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  model: string = 'llama3-70b-8192'
): Promise<string> => {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
    throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('No content generated from Groq');
  }

  return text;
};

/**
 * Universal AI call with fallback chain
 */
export const callAI = async (
  apiKeys: ApiKeys,
  systemInstruction: string,
  userPrompt: string,
  preferredModel?: string
): Promise<string> => {
  const errors: string[] = [];

  // Try Gemini first (fastest)
  if (apiKeys.geminiKey) {
    try {
      console.log('[AI] Trying Gemini...');
      return await callGeminiAPI(apiKeys.geminiKey, systemInstruction, userPrompt, preferredModel || AI_MODELS.GEMINI_FLASH);
    } catch (e: any) {
      errors.push(`Gemini: ${e.message}`);
      console.warn('[AI] Gemini failed:', e.message);
    }
  }

  // Try Groq (fast and free)
  if (apiKeys.groqKey) {
    try {
      console.log('[AI] Trying Groq...');
      return await callGroqAPI(apiKeys.groqKey, systemInstruction, userPrompt);
    } catch (e: any) {
      errors.push(`Groq: ${e.message}`);
      console.warn('[AI] Groq failed:', e.message);
    }
  }

  // Try OpenRouter
  if (apiKeys.openrouterKey) {
    try {
      console.log('[AI] Trying OpenRouter...');
      return await callOpenRouterAPI(apiKeys.openrouterKey, systemInstruction, userPrompt);
    } catch (e: any) {
      errors.push(`OpenRouter: ${e.message}`);
      console.warn('[AI] OpenRouter failed:', e.message);
    }
  }

  // Try OpenAI
  if (apiKeys.openaiKey) {
    try {
      console.log('[AI] Trying OpenAI...');
      return await callOpenAIAPI(apiKeys.openaiKey, systemInstruction, userPrompt);
    } catch (e: any) {
      errors.push(`OpenAI: ${e.message}`);
      console.warn('[AI] OpenAI failed:', e.message);
    }
  }

  // Try Anthropic
  if (apiKeys.anthropicKey) {
    try {
      console.log('[AI] Trying Anthropic...');
      return await callAnthropicAPI(apiKeys.anthropicKey, systemInstruction, userPrompt);
    } catch (e: any) {
      errors.push(`Anthropic: ${e.message}`);
      console.warn('[AI] Anthropic failed:', e.message);
    }
  }

  throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
};

// ==================== CONTENT GENERATION ====================

/**
 * Generate semantic keywords
 */
export const generateSemanticKeywords = async (
  apiKeys: ApiKeys,
  primaryKeyword: string
): Promise<string[]> => {
  try {
    const { system, user } = buildPrompt('semantic_keyword_generator', [primaryKeyword]);
    const response = await callAI(apiKeys, system, user);

    // Parse JSON response
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

/**
 * Generate content strategy
 */
export const generateContentStrategy = async (
  apiKeys: ApiKeys,
  topic: string,
  semanticKeywords: string[]
): Promise<ContentStrategy> => {
  try {
    const { system, user } = buildPrompt('content_strategy_generator', [topic, semanticKeywords]);
    const response = await callAI(apiKeys, system, user);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      targetAudience: 'General audience',
      searchIntent: 'informational',
      contentAngle: 'Comprehensive guide',
      keyMessages: [],
      estimatedWordCount: 2800,
    };
  } catch (error) {
    console.error('[generateContentStrategy] Error:', error);
    return {
      targetAudience: 'General audience',
      searchIntent: 'informational',
      contentAngle: 'Comprehensive guide',
      keyMessages: [],
      estimatedWordCount: 2800,
    };
  }
};

/**
 * Perform gap analysis - returns 15 uncovered entities
 */
export const performGapAnalysis = async (
  apiKeys: ApiKeys,
  primaryKeyword: string,
  serpContent: string,
  existingPages: string
): Promise<GapAnalysisResult> => {
  try {
    const { system, user } = buildPrompt('sota_gap_analysis', [primaryKeyword, serpContent, existingPages]);
    const response = await callAI(apiKeys, system, user);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        uncoveredEntities: parsed.uncoveredEntities || [],
        semanticCoverageScore: parsed.semanticCoverageScore || 0,
        recommendations: parsed.recommendations || [],
      };
    }

    return {
      uncoveredEntities: [],
      semanticCoverageScore: 0,
      recommendations: [],
    };
  } catch (error) {
    console.error('[performGapAnalysis] Error:', error);
    return {
      uncoveredEntities: [],
      semanticCoverageScore: 0,
      recommendations: [],
    };
  }
};

/**
 * Generate SEO metadata
 */
export const generateSeoMetadata = async (
  apiKeys: ApiKeys,
  primaryKeyword: string,
  contentSummary: string,
  targetAudience: string,
  geoLocation?: string | null
): Promise<{ seoTitle: string; metaDescription: string; slug: string }> => {
  try {
    const { system, user } = buildPrompt('seo_metadata_generator', [
      primaryKeyword,
      contentSummary,
      targetAudience,
      [],
      geoLocation,
    ]);
    const response = await callAI(apiKeys, system, user);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback
    const slug = primaryKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
      seoTitle: `${primaryKeyword} - Complete Guide ${new Date().getFullYear()}`,
      metaDescription: `Discover everything about ${primaryKeyword}. Expert insights, tips, and strategies. Updated for ${new Date().getFullYear()}.`,
      slug,
    };
  } catch (error) {
    console.error('[generateSeoMetadata] Error:', error);
    const slug = primaryKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
      seoTitle: `${primaryKeyword} - Complete Guide ${new Date().getFullYear()}`,
      metaDescription: `Discover everything about ${primaryKeyword}. Expert insights, tips, and strategies.`,
      slug,
    };
  }
};

/**
 * Generate FAQ section
 */
export const generateFaqSection = async (
  apiKeys: ApiKeys,
  topic: string,
  semanticKeywords: string[]
): Promise<string> => {
  try {
    const { system, user } = buildPrompt('sota_faq_generator', [topic, semanticKeywords]);
    const response = await callAI(apiKeys, system, user);
    return normalizeGeneratedContent(response);
  } catch (error) {
    console.error('[generateFaqSection] Error:', error);
    return '';
  }
};

/**
 * Generate Key Takeaways section
 */
export const generateKeyTakeaways = async (
  apiKeys: ApiKeys,
  topic: string,
  content: string
): Promise<string> => {
  try {
    const { system, user } = buildPrompt('sota_takeaways_generator', [topic, content]);
    const response = await callAI(apiKeys, system, user);
    return normalizeGeneratedContent(response);
  } catch (error) {
    console.error('[generateKeyTakeaways] Error:', error);
    return '';
  }
};

/**
 * Generate article content - MAIN CONTENT GENERATION FUNCTION
 */
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

  const { system, user } = buildPrompt('ultra_sota_article_writer', [
    topic,
    semanticKeywords,
    strategy,
    existingPages,
    competitorGaps,
    geoLocation,
    neuronData,
  ]);

  let content = await callAI(apiKeys, system, user);

  // Post-process content
  onProgress?.('Post-processing content...');
  content = normalizeGeneratedContent(content);
  content = convertMarkdownTablesToHtml(content);
  content = removeDuplicateSections(content);

  return content;
};

/**
 * Process and inject internal links with STRICT validation
 */
export const processInternalLinks = (
  content: string,
  existingPages: ExistingPage[],
  baseUrl: string,
  targetLinks: number = 12
): { content: string; stats: { injected: number; rejected: number; rejectedAnchors: string[] } } => {
  console.log('[processInternalLinks] Starting STRICT link processing...');

  // First, process [LINK_CANDIDATE:] markers with strict validation
  const { 
    content: processedContent, 
    injectedCount, 
    rejectedCount, 
    rejectedAnchors,
    acceptedAnchors 
  } = processLinkCandidatesStrict(content, existingPages, baseUrl);

  console.log(`[processInternalLinks] Processed markers: ${injectedCount} accepted, ${rejectedCount} rejected`);

  // Calculate remaining links needed
  const remainingLinks = Math.max(0, targetLinks - injectedCount);

  let finalContent = processedContent;

  // Force additional natural links if needed
  if (remainingLinks > 0 && existingPages.length > injectedCount) {
    console.log(`[processInternalLinks] Forcing ${remainingLinks} additional natural links...`);
    
    // Get pages that haven't been linked yet
    const usedSlugs = new Set(acceptedAnchors.map(a => a.toLowerCase()));
    const remainingPages = existingPages.filter(p => !usedSlugs.has(p.slug.toLowerCase()));
    
    if (remainingPages.length > 0) {
      finalContent = forceNaturalInternalLinks(
        finalContent,
        remainingPages,
        baseUrl,
        remainingLinks
      );
    }
  }

  return {
    content: finalContent,
    stats: {
      injected: injectedCount,
      rejected: rejectedCount,
      rejectedAnchors,
    },
  };
};

/**
 * Full content generation pipeline
 */
export const generateFullContent = async (
  apiKeys: ApiKeys,
  topic: string,
  existingPages: ExistingPage[],
  wpConfig: WpConfig,
  options: {
    geoLocation?: string | null;
    neuronData?: string | null;
    includeVideos?: boolean;
    includeReferences?: boolean;
  } = {},
  onProgress?: (message: string) => void
): Promise<GeneratedContent> => {
  const startTime = Date.now();

  try {
    // Step 1: Generate semantic keywords
    onProgress?.('Generating semantic keywords...');
    const semanticKeywords = await generateSemanticKeywords(apiKeys, topic);
    console.log(`[generateFullContent] Generated ${semanticKeywords.length} semantic keywords`);

    // Step 2: Generate content strategy
    onProgress?.('Analyzing content strategy...');
    const strategy = await generateContentStrategy(apiKeys, topic, semanticKeywords);

    // Step 3: Perform gap analysis for 15 uncovered entities
    onProgress?.('Performing gap analysis...');
    const existingTitles = existingPages.map(p => p.title).join(', ');
    const gapAnalysis = await performGapAnalysis(apiKeys, topic, '', existingTitles);
    const competitorGaps = gapAnalysis.uncoveredEntities.slice(0, 15).map(e => e.entity);
    console.log(`[generateFullContent] Found ${competitorGaps.length} content gaps to cover`);

    // Step 4: Generate main article content
    onProgress?.('Generating article content (this may take 30-60 seconds)...');
    let content = await generateArticleContent(
      apiKeys,
      topic,
      semanticKeywords,
      strategy,
      existingPages,
      competitorGaps,
      options.geoLocation,
      options.neuronData,
      onProgress
    );

    // Step 5: Process internal links with STRICT validation
    onProgress?.('Processing internal links with strict validation...');
    const { content: linkedContent, stats: linkStats } = processInternalLinks(
      content,
      existingPages,
      wpConfig.url,
      12
    );
    content = linkedContent;
    console.log(`[generateFullContent] Links: ${linkStats.injected} injected, ${linkStats.rejected} rejected`);

    if (linkStats.rejectedAnchors.length > 0) {
      console.warn('[generateFullContent] Rejected anchors (bad quality):');
      linkStats.rejectedAnchors.forEach(a => console.warn(`  - ${a}`));
    }

    // Step 6: Add YouTube videos if enabled
    if (options.includeVideos && apiKeys.serperKey) {
      onProgress?.('Finding relevant YouTube videos...');
      const videos = await getGuaranteedYoutubeVideos(topic, apiKeys.serperKey, 2);
      if (videos.length > 0) {
        const videoHtml = generateYoutubeEmbedHtml(videos);
        // Insert videos before FAQ section
        const faqIndex = content.indexOf('<!-- SOTA-FAQ-START -->');
        if (faqIndex > -1) {
          content = content.slice(0, faqIndex) + videoHtml + content.slice(faqIndex);
        } else {
          content += videoHtml;
        }
      }
    }

    // Step 7: Add verification footer
    content += generateVerificationFooterHtml();

    // Step 8: Final cleanup
    onProgress?.('Finalizing content...');
    content = smartPostProcess(content);

    // Step 9: Generate SEO metadata
    onProgress?.('Generating SEO metadata...');
    const contentSummary = content.replace(/<[^>]*>/g, ' ').substring(0, 500);
    const seoMetadata = await generateSeoMetadata(
      apiKeys,
      topic,
      contentSummary,
      strategy.targetAudience,
      options.geoLocation
    );

    // Step 10: Extract FAQ for schema
    const faqItems = extractFaqForSchema(content);

    const wordCount = countWords(content);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[generateFullContent] Complete in ${elapsed}s - ${wordCount} words`);

    return {
      title: seoMetadata.seoTitle,
      content,
      metaDescription: seoMetadata.metaDescription,
      slug: seoMetadata.slug,
      seoTitle: seoMetadata.seoTitle,
      wordCount,
      internalLinksCount: linkStats.injected,
      faqItems,
    };
  } catch (error: any) {
    console.error('[generateFullContent] Error:', error);
    throw error;
  }
};

// ==================== WORDPRESS PUBLISHING ====================

/**
 * Publish content to WordPress
 */
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

    const postData: Record<string, any> = {
      title: content.title || content.seoTitle,
      content: content.content,
      status,
      excerpt: content.metaDescription,
    };

    if (content.slug) {
      postData.slug = content.slug;
    }

    let endpoint = `${baseUrl}/wp-json/wp/v2/posts`;
    let method = 'POST';

    if (existingPostId) {
      endpoint = `${baseUrl}/wp-json/wp/v2/posts/${existingPostId}`;
      method = 'PUT';
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      console.error('[publishToWordPress] Error:', errorMessage);
      return { success: false, message: errorMessage };
    }

    const result = await response.json();
    console.log(`[publishToWordPress] Success: ${result.link} (ID: ${result.id})`);

    return {
      success: true,
      url: result.link,
      postId: result.id,
      message: 'Published successfully',
    };
  } catch (error: any) {
    console.error('[publishToWordPress] Exception:', error);
    return { success: false, message: error.message || 'Unknown error' };
  }
};

/**
 * Publish single item from ContentItem
 */
export const publishItemToWordPress = async (
  item: ContentItem,
  wpPassword: string,
  status: 'publish' | 'draft' | 'pending',
  wpConfig: WpConfig
): Promise<{ success: boolean; message?: string; url?: string; postId?: number }> => {
  if (!item.generatedContent) {
    return { success: false, message: 'No generated content to publish' };
  }

  return publishToWordPress(item.generatedContent, wpConfig, wpPassword, status);
};

// ==================== SERP ANALYSIS ====================

/**
 * Get SERP results for keyword
 */
export const getSerpResults = async (
  keyword: string,
  serperKey: string,
  count: number = 10
): Promise<SerpResult[]> => {
  if (!serperKey) return [];

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: keyword, num: count }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.organic || []).map((result: any, index: number) => ({
      title: result.title,
      snippet: result.snippet || '',
      link: result.link,
      position: index + 1,
    }));
  } catch (error) {
    console.error('[getSerpResults] Error:', error);
    return [];
  }
};

// ==================== SITEMAP PARSING ====================

/**
 * Parse WordPress sitemap
 */
export const parseSitemap = async (
  sitemapUrl: string
): Promise<ExistingPage[]> => {
  try {
    const response = await fetchWithProxies(sitemapUrl);
    const xml = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const pages: ExistingPage[] = [];
    const urls = doc.querySelectorAll('url loc');

    urls.forEach(loc => {
      const url = loc.textContent || '';
      if (url && !url.includes('/wp-content/') && !url.includes('/tag/') && !url.includes('/category/')) {
        const slug = url.split('/').filter(Boolean).pop() || '';
        if (slug && slug !== 'sitemap.xml') {
          // Create title from slug
          const title = slug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
          pages.push({ title, slug });
        }
      }
    });

    console.log(`[parseSitemap] Found ${pages.length} pages`);
    return pages;
  } catch (error) {
    console.error('[parseSitemap] Error:', error);
    return [];
  }
};

/**
 * Get existing pages from WordPress
 */
export const getExistingPages = async (
  wpConfig: WpConfig,
  wpPassword: string
): Promise<ExistingPage[]> => {
  try {
    const baseUrl = wpConfig.url.replace(/\/+$/, '');
    const authHeader = 'Basic ' + btoa(`${wpConfig.username}:${wpPassword}`);

    const pages: ExistingPage[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `${baseUrl}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&status=publish`,
        {
          headers: { 'Authorization': authHeader },
        }
      );

      if (!response.ok) break;

      const posts = await response.json();
      if (posts.length === 0) break;

      posts.forEach((post: any) => {
        pages.push({
          title: post.title.rendered,
          slug: post.slug,
        });
      });

      if (posts.length < perPage) break;
      page++;
    }

    console.log(`[getExistingPages] Found ${pages.length} published pages`);
    return pages;
  } catch (error) {
    console.error('[getExistingPages] Error:', error);
    return [];
  }
};

// ==================== HEALTH ANALYSIS ====================

/**
 * Analyze content health
 */
export const analyzeContentHealth = async (
  apiKeys: ApiKeys,
  url: string,
  content: string,
  targetKeyword: string
): Promise<{
  healthScore: number;
  wordCount: number;
  issues: Array<{ type: string; issue: string; fix: string }>;
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
}> => {
  try {
    const { system, user } = buildPrompt('health_analyzer', [url, content, targetKeyword]);
    const response = await callAI(apiKeys, system, user);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      healthScore: 50,
      wordCount: countWords(content),
      issues: [],
      recommendations: [],
      strengths: [],
      weaknesses: [],
    };
  } catch (error) {
    console.error('[analyzeContentHealth] Error:', error);
    return {
      healthScore: 50,
      wordCount: countWords(content),
      issues: [],
      recommendations: [],
      strengths: [],
      weaknesses: [],
    };
  }
};

// ==================== JSON REPAIR ====================

/**
 * Repair malformed JSON
 */
export const repairJson = async (
  apiKeys: ApiKeys,
  brokenJson: string
): Promise<any> => {
  try {
    // First try direct parse
    return JSON.parse(brokenJson);
  } catch {
    // Use AI to repair
    const { system, user } = buildPrompt('json_repair', [brokenJson]);
    const response = await callAI(apiKeys, system, user);

    const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to repair JSON');
  }
};

// ==================== GOD MODE FUNCTIONS ====================

/**
 * God Mode autonomous content optimization
 */
export const godModeOptimize = async (
  apiKeys: ApiKeys,
  existingContent: string,
  semanticKeywords: string[],
  existingPages: ExistingPage[],
  topic: string,
  onProgress?: (message: string) => void
): Promise<string> => {
  onProgress?.('God Mode: Analyzing content structure...');

  const { system, user } = buildPrompt('god_mode_autonomous_agent', [
    existingContent,
    semanticKeywords,
    existingPages,
    topic,
  ]);

  let optimized = await callAI(apiKeys, system, user);

  onProgress?.('God Mode: Post-processing...');
  optimized = normalizeGeneratedContent(optimized);
  optimized = convertMarkdownTablesToHtml(optimized);
  optimized = removeDuplicateSections(optimized);

  return optimized;
};

/**
 * God Mode structural guardian
 */
export const godModeStructuralGuardian = async (
  apiKeys: ApiKeys,
  htmlFragment: string,
  semanticKeywords: string[],
  topic: string
): Promise<string> => {
  const { system, user } = buildPrompt('god_mode_structural_guardian', [
    htmlFragment,
    semanticKeywords,
    topic,
  ]);

  let refined = await callAI(apiKeys, system, user);
  refined = normalizeGeneratedContent(refined);
  refined = convertMarkdownTablesToHtml(refined);

  return refined;
};

// ==================== IMAGE SERVICES ====================

/**
 * Upload image to Imgur
 */
export const uploadToImgur = async (
  imageData: string,
  clientId: string
): Promise<string> => {
  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      'Authorization': `Client-ID ${clientId}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageData.replace(/^data:image\/\w+;base64,/, ''),
      type: 'base64',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to upload image to Imgur');
  }

  const data = await response.json();
  return data.data.link;
};

/**
 * Generate image alt text
 */
export const generateImageAltText = async (
  apiKeys: ApiKeys,
  images: Array<{ src: string; context: string }>,
  primaryKeyword: string
): Promise<Array<{ index: number; altText: string }>> => {
  try {
    const { system, user } = buildPrompt('sota_image_alt_optimizer', [images, primaryKeyword]);
    const response = await callAI(apiKeys, system, user);

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return [];
  } catch (error) {
    console.error('[generateImageAltText] Error:', error);
    return [];
  }
};

// ==================== REFERENCES GENERATION ====================

/**
 * Generate authoritative references
 */
export const generateReferences = async (
  apiKeys: ApiKeys,
  topic: string
): Promise<string> => {
  try {
    const { system, user } = buildPrompt('reference_generator', [topic]);
    const response = await callAI(apiKeys, system, user);
    return normalizeGeneratedContent(response);
  } catch (error) {
    console.error('[generateReferences] Error:', error);
    return '';
  }
};

// ==================== CLUSTER PLANNING ====================

/**
 * Generate content cluster plan
 */
export const generateClusterPlan = async (
  apiKeys: ApiKeys,
  topic: string
): Promise<any> => {
  try {
    const { system, user } = buildPrompt('cluster_planner', [topic]);
    const response = await callAI(apiKeys, system, user);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return null;
  } catch (error) {
    console.error('[generateClusterPlan] Error:', error);
    return null;
  }
};

// ==================== NEURONWRITER INTEGRATION ====================

/**
 * Fetch NeuronWriter NLP data
 */
export const fetchNeuronwriterData = async (
  queryId: string,
  apiKey: string
): Promise<string | null> => {
  if (!queryId || !apiKey) return null;

  try {
    const response = await fetch(`https://app.neuronwriter.com/api/query/${queryId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`NeuronWriter API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract NLP terms
    const nlpTerms = data.nlp_terms || data.terms || [];
    if (Array.isArray(nlpTerms) && nlpTerms.length > 0) {
      return nlpTerms.slice(0, 50).map((t: any) => t.term || t).join(', ');
    }

    return null;
  } catch (error) {
    console.error('[fetchNeuronwriterData] Error:', error);
    return null;
  }
};

// =============================================================================
// MISSING EXPORTS - ADD THESE TO services.tsx
// =============================================================================

// ==================== MAINTENANCE ENGINE ====================

export const maintenanceEngine = {
  /**
   * Check content freshness
   */
  checkFreshness: async (content: string, publishDate?: string): Promise<{
    needsUpdate: boolean;
    reasons: string[];
    priority: 'high' | 'medium' | 'low';
  }> => {
    const reasons: string[] = [];
    let priority: 'high' | 'medium' | 'low' = 'low';

    // Check for outdated years
    const currentYear = new Date().getFullYear();
    const yearMatches = content.match(/\b(20\d{2})\b/g) || [];
    const outdatedYears = yearMatches.filter(y => parseInt(y) < currentYear - 1);
    
    if (outdatedYears.length > 0) {
      reasons.push(`Contains outdated years: ${[...new Set(outdatedYears)].join(', ')}`);
      priority = 'high';
    }

    // Check word count
    const wordCount = content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
    if (wordCount < 1500) {
      reasons.push(`Content too short: ${wordCount} words (recommend 2500+)`);
      priority = priority === 'high' ? 'high' : 'medium';
    }

    // Check for internal links
    const linkCount = (content.match(/<a\s+[^>]*href/gi) || []).length;
    if (linkCount < 5) {
      reasons.push(`Too few internal links: ${linkCount} (recommend 8-15)`);
      priority = priority === 'high' ? 'high' : 'medium';
    }

    // Check for images
    const imageCount = (content.match(/<img\s/gi) || []).length;
    if (imageCount < 2) {
      reasons.push(`Too few images: ${imageCount} (recommend 3+)`);
    }

    // Check for FAQ section
    if (!content.includes('FAQPage') && !content.includes('faq')) {
      reasons.push('Missing FAQ section');
    }

    return {
      needsUpdate: reasons.length > 0,
      reasons,
      priority,
    };
  },

  /**
   * Auto-update outdated dates
   */
  updateDates: (content: string): string => {
    const currentYear = new Date().getFullYear();
    
    // Replace outdated years in text
    let updated = content.replace(
      /\b(20[12]\d)\b(?![^<]*>)/g,
      (match) => {
        const year = parseInt(match);
        if (year < currentYear - 1) {
          return String(currentYear);
        }
        return match;
      }
    );

    // Update "Last updated" text
    const currentDate = new Date().toISOString().split('T')[0];
    updated = updated.replace(
      /Last updated:\s*[\d\-]+/gi,
      `Last updated: ${currentDate}`
    );

    return updated;
  },

  /**
   * Analyze content for improvements
   */
  analyze: async (content: string): Promise<{
    score: number;
    issues: Array<{ type: string; message: string; priority: string }>;
    suggestions: string[];
  }> => {
    const issues: Array<{ type: string; message: string; priority: string }> = [];
    const suggestions: string[] = [];
    let score = 100;

    const text = content.replace(/<[^>]*>/g, ' ');
    const wordCount = text.trim().split(/\s+/).length;

    // Word count check
    if (wordCount < 2000) {
      issues.push({ type: 'content', message: `Word count low: ${wordCount}`, priority: 'high' });
      score -= 20;
      suggestions.push('Expand content to 2500-3200 words');
    }

    // Heading structure
    const h2Count = (content.match(/<h2/gi) || []).length;
    if (h2Count < 4) {
      issues.push({ type: 'structure', message: `Only ${h2Count} H2 headings`, priority: 'medium' });
      score -= 10;
      suggestions.push('Add more H2 sections (recommend 5-7)');
    }

    // Internal links
    const linkCount = (content.match(/<a\s+[^>]*href/gi) || []).length;
    if (linkCount < 8) {
      issues.push({ type: 'seo', message: `Only ${linkCount} internal links`, priority: 'high' });
      score -= 15;
      suggestions.push('Add 8-15 contextual internal links');
    }

    // Images
    const imageCount = (content.match(/<img\s/gi) || []).length;
    if (imageCount < 3) {
      issues.push({ type: 'media', message: `Only ${imageCount} images`, priority: 'medium' });
      score -= 10;
      suggestions.push('Add relevant images with alt text');
    }

    // FAQ section
    if (!content.toLowerCase().includes('faq') && !content.includes('FAQPage')) {
      issues.push({ type: 'structure', message: 'Missing FAQ section', priority: 'medium' });
      score -= 10;
      suggestions.push('Add FAQ section with schema markup');
    }

    // Key takeaways
    if (!content.toLowerCase().includes('takeaway')) {
      issues.push({ type: 'structure', message: 'Missing key takeaways', priority: 'low' });
      score -= 5;
      suggestions.push('Add Key Takeaways section at top');
    }

    return {
      score: Math.max(0, score),
      issues,
      suggestions,
    };
  },
};

// ==================== IMAGE GENERATION WITH FALLBACK ====================

export const generateImageWithFallback = async (
  apiKeys: ApiKeys,
  prompt: string,
  options: {
    style?: string;
    size?: string;
    quality?: string;
  } = {}
): Promise<{ url: string; source: string } | null> => {
  const { style = 'realistic', size = '1024x1024', quality = 'standard' } = options;

  // Try OpenAI DALL-E first
  if (apiKeys.openaiKey) {
    try {
      console.log('[generateImage] Trying OpenAI DALL-E...');
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeys.openaiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: `${prompt}. Style: ${style}. High quality, professional.`,
          n: 1,
          size,
          quality,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const url = data.data?.[0]?.url;
        if (url) {
          return { url, source: 'openai' };
        }
      }
    } catch (e: any) {
      console.warn('[generateImage] OpenAI failed:', e.message);
    }
  }

  // Try Gemini Imagen
  if (apiKeys.geminiKey) {
    try {
      console.log('[generateImage] Trying Gemini Imagen...');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKeys.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: `${prompt}. Style: ${style}. Professional quality.` }],
            parameters: {
              sampleCount: 1,
              aspectRatio: '1:1',
              safetyFilterLevel: 'block_some',
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const base64 = data.predictions?.[0]?.bytesBase64Encoded;
        if (base64) {
          return { url: `data:image/png;base64,${base64}`, source: 'gemini' };
        }
      }
    } catch (e: any) {
      console.warn('[generateImage] Gemini failed:', e.message);
    }
  }

  console.warn('[generateImage] All providers failed');
  return null;
};

// ==================== FETCH VERIFIED REFERENCES ====================

export const fetchVerifiedReferences = async (
  topic: string,
  serperKey: string,
  count: number = 8
): Promise<Array<{
  title: string;
  url: string;
  snippet: string;
  domain: string;
  isAuthority: boolean;
}>> => {
  if (!serperKey) {
    console.warn('[fetchVerifiedReferences] No Serper API key');
    return [];
  }

  // Authority domains we prioritize
  const authorityDomains = [
    'nih.gov', 'cdc.gov', 'who.int', 'edu', 'gov',
    'mayoclinic.org', 'webmd.com', 'healthline.com',
    'harvard.edu', 'stanford.edu', 'mit.edu',
    'nature.com', 'science.org', 'sciencedirect.com',
    'forbes.com', 'hbr.org', 'wsj.com', 'nytimes.com',
  ];

  // Domains to exclude
  const excludedDomains = [
    'reddit.com', 'quora.com', 'pinterest.com',
    'facebook.com', 'twitter.com', 'instagram.com',
    'tiktok.com', 'youtube.com', 'medium.com',
    'wordpress.com', 'blogspot.com', 'tumblr.com',
  ];

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: `${topic} research study site:.edu OR site:.gov OR site:.org`,
        num: 20,
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.statusText}`);
    }

    const data = await response.json();
    const results: Array<{
      title: string;
      url: string;
      snippet: string;
      domain: string;
      isAuthority: boolean;
    }> = [];

    for (const result of data.organic || []) {
      if (results.length >= count) break;

      try {
        const url = new URL(result.link);
        const domain = url.hostname.replace('www.', '');

        // Skip excluded domains
        if (excludedDomains.some(d => domain.includes(d))) continue;

        // Check if authority domain
        const isAuthority = authorityDomains.some(d => domain.includes(d));

        results.push({
          title: result.title,
          url: result.link,
          snippet: result.snippet || '',
          domain,
          isAuthority,
        });
      } catch {
        continue;
      }
    }

    // Sort by authority first
    results.sort((a, b) => (b.isAuthority ? 1 : 0) - (a.isAuthority ? 1 : 0));

    console.log(`[fetchVerifiedReferences] Found ${results.length} references`);
    return results;
  } catch (error) {
    console.error('[fetchVerifiedReferences] Error:', error);
    return [];
  }
};


// ==================== GENERATE CONTENT ALIAS ====================

/**
 * generateContent - Alias for generateFullContent
 * This is the main content generation function used by App.tsx
 */
export const generateContent = async (
  apiKeys: ApiKeys,
  topic: string,
  existingPages: ExistingPage[],
  wpConfig: WpConfig,
  options: {
    geoLocation?: string | null;
    neuronData?: string | null;
    includeVideos?: boolean;
    includeReferences?: boolean;
  } = {},
  onProgress?: (message: string) => void
): Promise<GeneratedContent> => {
  return generateFullContent(apiKeys, topic, existingPages, wpConfig, options, onProgress);
};

export const generateContent = generateFullContent;

// ==================== UPDATE THE DEFAULT EXPORT ====================
// Make sure to add these to the default export object:

export default {
  // AI Providers
  callAI,
  callGeminiAPI,
  callOpenAIAPI,
  callAnthropicAPI,
  callOpenRouterAPI,
  callGroqAPI,

  // Content Generation
  generateContent,  // <-- ADD THIS
  generateSemanticKeywords,
  generateContentStrategy,
  performGapAnalysis,
  generateSeoMetadata,
  generateFaqSection,
  generateKeyTakeaways,
  generateArticleContent,
  generateFullContent,
  processInternalLinks,

  // WordPress
  publishToWordPress,
  publishItemToWordPress,
  getExistingPages,
  parseSitemap,

  // Analysis
  getSerpResults,
  analyzeContentHealth,

  // God Mode
  godModeOptimize,
  godModeStructuralGuardian,

  // Utilities
  repairJson,
  uploadToImgur,
  generateImageAltText,
  generateReferences,
  generateClusterPlan,
  fetchNeuronwriterData,

  // Additional exports
  maintenanceEngine,
  generateImageWithFallback,
  fetchVerifiedReferences,
};
