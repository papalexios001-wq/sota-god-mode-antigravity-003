// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - SERVICES v12.1 (HOTFIX)
// Enterprise-Grade AI Services with Robust JSON Parsing
// =============================================================================

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { PROMPT_TEMPLATES, buildPrompt } from './prompts';
import { AI_MODELS, IMGUR_CLIENT_ID, TARGET_MIN_WORDS, TARGET_MAX_WORDS } from './constants';
import {
  ApiClients, GenerationContext, ContentItem, GeneratedContent,
  SitemapPage, ExpandedGeoTargeting, SiteInfo, WpConfig, NeuronConfig
} from './types';
import {
  callAiWithRetry, delay, processConcurrently, parseJsonWithAiRepair,
  extractSlugFromUrl, sanitizeTitle, generateId
} from './utils';
import {
  fetchWithProxies, smartCrawl, normalizeGeneratedContent,
  enforceWordCount, ContentTooShortError, ContentTooLongError,
  getGuaranteedYoutubeVideos, generateVerificationFooterHtml
} from './contentUtils';
import { generateFullSchema } from './schema-generator';
import { fetchNeuronTerms } from './neuronwriter';

// ==================== AI PROVIDER INTERFACE ====================

type PromptKey = keyof typeof PROMPT_TEMPLATES;

/**
 * Universal AI calling function that routes to the correct provider
 */
export const callAI = async (
  apiClients: ApiClients,
  selectedModel: string,
  geoTargeting: ExpandedGeoTargeting,
  openrouterModels: string[],
  selectedGroqModel: string,
  promptKey: PromptKey,
  promptArgs: any[],
  responseFormat: 'json' | 'html' = 'json',
  useGrounding: boolean = false
): Promise<string> => {
  const { system, user } = buildPrompt(promptKey, promptArgs);
  
  // Add geo-targeting context if enabled
  let enhancedUser = user;
  if (geoTargeting.enabled && geoTargeting.location) {
    enhancedUser = `[GEO-TARGETING: ${geoTargeting.location}, ${geoTargeting.region}, ${geoTargeting.country}]\n\n${user}`;
  }

  // Route to appropriate provider
  switch (selectedModel) {
    case 'gemini':
      return callGemini(apiClients.gemini, system, enhancedUser, responseFormat, useGrounding);
    case 'openai':
      return callOpenAI(apiClients.openai, system, enhancedUser, responseFormat);
    case 'anthropic':
      return callAnthropic(apiClients.anthropic, system, enhancedUser, responseFormat);
    case 'openrouter':
      return callOpenRouter(apiClients.openrouter, openrouterModels, system, enhancedUser, responseFormat);
    case 'groq':
      return callGroq(apiClients.groq, selectedGroqModel, system, enhancedUser, responseFormat);
    default:
      // Fallback chain
      if (apiClients.gemini) return callGemini(apiClients.gemini, system, enhancedUser, responseFormat, useGrounding);
      if (apiClients.openai) return callOpenAI(apiClients.openai, system, enhancedUser, responseFormat);
      if (apiClients.anthropic) return callAnthropic(apiClients.anthropic, system, enhancedUser, responseFormat);
      throw new Error('No AI provider configured');
  }
};

// ==================== PROVIDER-SPECIFIC FUNCTIONS ====================

const callGemini = async (
  client: any,
  system: string,
  user: string,
  responseFormat: 'json' | 'html',
  useGrounding: boolean
): Promise<string> => {
  if (!client) throw new Error("Gemini client not initialized");

  const config: any = {
    model: AI_MODELS.GEMINI_FLASH,
    contents: `${system}\n\n${user}`,
  };

  if (responseFormat === 'json') {
    config.generationConfig = {
      responseMimeType: "application/json",
    };
  }

  if (useGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  const result = await callAiWithRetry(() => 
    client.models.generateContent(config)
  );

  return result.response?.text() || result.text || '';
};

const callOpenAI = async (
  client: OpenAI | null,
  system: string,
  user: string,
  responseFormat: 'json' | 'html'
): Promise<string> => {
  if (!client) throw new Error("OpenAI client not initialized");

  const config: any = {
    model: AI_MODELS.OPENAI_GPT4_TURBO,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    max_tokens: 8192,
    temperature: 0.7,
  };

  if (responseFormat === 'json') {
    config.response_format = { type: "json_object" };
  }

  const completion = await callAiWithRetry(() =>
    client.chat.completions.create(config)
  );

  return completion.choices[0]?.message?.content || '';
};

const callAnthropic = async (
  client: Anthropic | null,
  system: string,
  user: string,
  responseFormat: 'json' | 'html'
): Promise<string> => {
  if (!client) throw new Error("Anthropic client not initialized");

  const message = await callAiWithRetry(() =>
    client.messages.create({
      model: AI_MODELS.ANTHROPIC_OPUS,
      max_tokens: 8192,
      system: system,
      messages: [{ role: "user", content: user }],
      temperature: 0.7,
    })
  );

  const content = message.content[0];
  if (content.type === 'text') {
    return content.text;
  }
  return '';
};

const callOpenRouter = async (
  client: OpenAI | null,
  models: string[],
  system: string,
  user: string,
  responseFormat: 'json' | 'html'
): Promise<string> => {
  if (!client) throw new Error("OpenRouter client not initialized");

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const config: any = {
        model: model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        max_tokens: 8192,
        temperature: 0.7,
      };

      const completion = await callAiWithRetry(() =>
        client.chat.completions.create(config)
      );

      return completion.choices[0]?.message?.content || '';
    } catch (error: any) {
      lastError = error;
      console.warn(`[OpenRouter] Model ${model} failed, trying next...`);
      continue;
    }
  }

  throw lastError || new Error('All OpenRouter models failed');
};

const callGroq = async (
  client: OpenAI | null,
  model: string,
  system: string,
  user: string,
  responseFormat: 'json' | 'html'
): Promise<string> => {
  if (!client) throw new Error("Groq client not initialized");

  const config: any = {
    model: model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    max_tokens: 8192,
    temperature: 0.7,
  };

  if (responseFormat === 'json') {
    config.response_format = { type: "json_object" };
  }

  const completion = await callAiWithRetry(() =>
    client.chat.completions.create(config)
  );

  return completion.choices[0]?.message?.content || '';
};

// ==================== IMAGE GENERATION ====================

export const generateImageWithFallback = async (
  apiClients: ApiClients,
  prompt: string,
  aspectRatio: string = '16:9'
): Promise<string | null> => {
  // Try Gemini Imagen first
  if (apiClients.gemini) {
    try {
      const result = await apiClients.gemini.models.generateImages({
        model: AI_MODELS.GEMINI_IMAGEN,
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: aspectRatio,
          outputMimeType: 'image/png',
        },
      });

      if (result.generatedImages?.[0]?.image?.imageBytes) {
        const base64 = result.generatedImages[0].image.imageBytes;
        return `data:image/png;base64,${base64}`;
      }
    } catch (error) {
      console.warn('[Image Gen] Gemini Imagen failed, trying OpenAI...');
    }
  }

  // Fallback to OpenAI DALL-E
  if (apiClients.openai) {
    try {
      const size = aspectRatio === '16:9' ? '1792x1024' : 
                   aspectRatio === '9:16' ? '1024x1792' : '1024x1024';
      
      const response = await apiClients.openai.images.generate({
        model: AI_MODELS.OPENAI_DALLE3,
        prompt: prompt,
        n: 1,
        size: size as any,
        response_format: 'b64_json',
      });

      if (response.data[0]?.b64_json) {
        return `data:image/png;base64,${response.data[0].b64_json}`;
      }
    } catch (error) {
      console.warn('[Image Gen] OpenAI DALL-E failed');
    }
  }

  return null;
};

// ==================== REFERENCE VALIDATION ====================

const BLOCKED_DOMAINS = [
  'reddit.com', 'quora.com', 'pinterest.com', 'linkedin.com',
  'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com',
  'youtube.com', 'medium.com', 'wordpress.com', 'blogspot.com',
  'tumblr.com', 'scribd.com', 'slideshare.net'
];

export const fetchVerifiedReferences = async (
  keyword: string,
  semanticKeywords: string[],
  serperApiKey: string,
  wpUrl?: string
): Promise<string> => {
  if (!serperApiKey) return "";

  try {
    const currentYear = new Date().getFullYear();
    let userDomain = "";
    
    if (wpUrl) {
      try {
        userDomain = new URL(wpUrl).hostname.replace('www.', '');
      } catch (e) {}
    }

    // Build intelligent search query
    const query = `${keyword} "research" "study" "data" ${currentYear} -site:youtube.com -site:reddit.com -site:quora.com`;

    const response = await fetchWithProxies("https://google.serper.dev/search", {
      method: "POST",
      headers: { 
        "X-API-KEY": serperApiKey, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ q: query, num: 20 }),
    });

    const data = await response.json();
    const potentialLinks = data.organic || [];
    const validLinks: any[] = [];

    // Validate each link
    for (const link of potentialLinks) {
      if (validLinks.length >= 8) break;

      try {
        const urlObj = new URL(link.link);
        const domain = urlObj.hostname.replace("www.", "");

        // Skip blocked domains
        if (BLOCKED_DOMAINS.some(d => domain.includes(d))) continue;
        
        // Skip own domain
        if (userDomain && domain.includes(userDomain)) continue;

        // Validate URL is accessible (200 status)
        const checkRes = await Promise.race([
          fetchWithProxies(link.link, {
            method: "HEAD",
            headers: { "User-Agent": "Mozilla/5.0 (compatible; SOTA-Bot/1.0)" }
          }),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 5000)
          )
        ]) as Response;

        if (checkRes.status === 200) {
          validLinks.push({
            title: link.title,
            url: link.link,
            source: domain,
            snippet: link.snippet
          });
        }
      } catch (e) {
        continue;
      }
    }

    if (validLinks.length === 0) return "";

    // Generate beautiful HTML
    return `
<div class="sota-references-section" style="margin-top: 4rem; padding: 2.5rem; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; border: 1px solid #e2e8f0;">
  <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.75rem;">
    <span style="font-size: 1.8rem;">📚</span> Trusted References & Further Reading
  </h2>
  <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem;">All sources verified and operational as of ${currentYear}.</p>
  <div style="display: grid; gap: 1rem;">
    ${validLinks.map((ref, i) => `
      <div style="padding: 1.25rem; background: white; border-radius: 12px; border: 1px solid #e2e8f0; transition: all 0.2s ease;">
        <a href="${ref.url}" target="_blank" rel="noopener noreferrer" style="font-weight: 700; color: #2563eb; text-decoration: none; font-size: 1rem; display: block; margin-bottom: 0.5rem;">
          ${i + 1}. ${ref.title}
        </a>
        <span style="font-size: 0.8rem; color: #94a3b8; display: flex; align-items: center; gap: 0.5rem;">
          <span style="background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px;">${ref.source}</span>
          <span style="color: #10b981;">✓ Verified</span>
        </span>
        ${ref.snippet ? `<p style="margin: 0.75rem 0 0 0; font-size: 0.9rem; color: #475569; line-height: 1.5;">${ref.snippet.substring(0, 150)}...</p>` : ''}
      </div>
    `).join('')}
  </div>
</div>`;
  } catch (e) {
    console.error('[fetchVerifiedReferences] Error:', e);
    return "";
  }
};

// ==================== CONTENT GENERATION ====================

export const generateContent = {
  /**
   * Generate content for multiple items in parallel
   */
  async generateItems(
    items: ContentItem[],
    serviceCallAI: (promptKey: PromptKey, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
    serviceGenerateImage: (prompt: string) => Promise<string | null>,
    context: GenerationContext,
    onProgress: (progress: { current: number; total: number }) => void,
    shouldStopRef: React.MutableRefObject<Set<string>>
  ): Promise<void> {
    const { dispatch, existingPages, siteInfo, wpConfig, geoTargeting, serperApiKey, neuronConfig } = context;

    // Helper for JSON repair
    const aiRepairer = (brokenText: string) => serviceCallAI('json_repair', [brokenText], 'json');

    const processItem = async (item: ContentItem, index: number): Promise<void> => {
      if (shouldStopRef.current.has(item.id)) {
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'idle', statusText: 'Stopped' } });
        return;
      }

      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Initializing...' } });

      try {
        // Step 1: Generate semantic keywords
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Generating keywords...' } });
        
        const location = geoTargeting.enabled ? geoTargeting.location : null;
        const keywordsJson = await serviceCallAI('semantic_keyword_generator', [item.title, [], location], 'json');
        // FIX: Use Safe Parse
        const semanticKeywords: string[] = await parseJsonWithAiRepair(keywordsJson, aiRepairer);

        if (shouldStopRef.current.has(item.id)) return;

        // Step 2: Fetch NeuronWriter terms if enabled
        let neuronData: string | null = null;
        if (neuronConfig?.enabled && neuronConfig.apiKey && neuronConfig.projectId) {
          dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Fetching NLP terms...' } });
          try {
            const neuronTerms = await fetchNeuronTerms(neuronConfig.apiKey, neuronConfig.projectId, item.title);
            if (neuronTerms) {
              neuronData = Object.entries(neuronTerms)
                .map(([key, val]) => `${key}: ${val}`)
                .join('\n');
            }
          } catch (e) {
            console.warn('[NeuronWriter] Failed to fetch terms:', e);
          }
        }

        // Step 3: Competitor gap analysis
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Analyzing competitors...' } });
        
        let competitorGaps: string[] = [];
        if (serperApiKey) {
          try {
            const serpResponse = await fetchWithProxies("https://google.serper.dev/search", {
              method: 'POST',
              headers: { 'X-API-KEY': serperApiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ q: item.title, num: 5 })
            });
            const serpData = await serpResponse.json();
            const competitorContent = (serpData.organic || []).slice(0, 3).map((r: any) => r.snippet).filter(Boolean);
            
            if (competitorContent.length > 0) {
              const gapAnalysisJson = await serviceCallAI('competitor_gap_analyzer', [item.title, competitorContent, null], 'json');
              // FIX: Use Safe Parse
              const gapAnalysis = await parseJsonWithAiRepair(gapAnalysisJson, aiRepairer);
              competitorGaps = gapAnalysis.gaps?.map((g: any) => g.opportunity) || [];
            }
          } catch (e) {
            console.warn('[Gap Analysis] Failed:', e);
          }
        }

        if (shouldStopRef.current.has(item.id)) return;

        // Step 4: Build article plan
        const articlePlan = {
          title: item.title,
          primaryKeyword: item.title,
          semanticKeywords,
          outline: [
            { heading: "Introduction", wordCount: 250 },
            { heading: "Key Takeaways", wordCount: 150 },
            { heading: `Understanding ${item.title}`, wordCount: 400 },
            { heading: "Expert Strategies", wordCount: 450 },
            { heading: "Common Challenges", wordCount: 350 },
            { heading: "Advanced Techniques", wordCount: 400 },
            { heading: "FAQ", wordCount: 300 },
            { heading: "Conclusion", wordCount: 200 }
          ]
        };

        // Step 5: Generate main content
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Writing article...' } });
        
        let contentHtml = await serviceCallAI(
          'ultra_sota_article_writer',
          [articlePlan, semanticKeywords, competitorGaps, existingPages, neuronData, null],
          'html'
        );

        // Clean content
        contentHtml = contentHtml
          .replace(/```html\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        if (shouldStopRef.current.has(item.id)) return;

        // Step 6: Validate word count
        try {
          enforceWordCount(contentHtml, TARGET_MIN_WORDS, TARGET_MAX_WORDS);
        } catch (e) {
          if (e instanceof ContentTooShortError) {
            dispatch({ type: 'UPDATE_STATUS', payload: { 
              id: item.id, 
              status: 'error', 
              statusText: `TOO SHORT: ${e.wordCount} words (min ${TARGET_MIN_WORDS})` 
            } });
            return;
          }
          if (e instanceof ContentTooLongError) {
            // Content too long is acceptable, just log it
            console.warn(`[Content] ${item.title} is ${e.wordCount} words (over ${TARGET_MAX_WORDS})`);
          }
        }

        // Step 7: Generate images
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Generating images...' } });
        
        const imagePrompts = [
          `Professional featured image for article about ${item.title}, modern design, high quality`,
          `Infographic showing key concepts of ${item.title}, clean design, educational`
        ];

        const imageDetails = await Promise.all(
          imagePrompts.map(async (prompt, idx) => {
            const src = await serviceGenerateImage(prompt);
            return {
              prompt,
              altText: `${item.title} - Image ${idx + 1}`,
              title: `${item.title.toLowerCase().replace(/\s+/g, '-')}-image-${idx + 1}`,
              placeholder: `[IMAGE_${idx + 1}_PLACEHOLDER]`,
              generatedImageSrc: src || undefined
            };
          })
        );

        if (shouldStopRef.current.has(item.id)) return;

        // Step 8: Process internal links
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Adding internal links...' } });
        contentHtml = processInternalLinks(contentHtml, existingPages, wpConfig.url);

        // Step 9: Add verification footer
        contentHtml += generateVerificationFooterHtml();

        // Step 10: Fetch and add references
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Validating references...' } });
        
        if (serperApiKey) {
          const referencesHtml = await fetchVerifiedReferences(item.title, semanticKeywords, serperApiKey, wpConfig.url);
          if (referencesHtml) {
            contentHtml += referencesHtml;
          }
        }

        // Step 11: Generate SEO metadata
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Optimizing metadata...' } });
        
        const contentSummary = contentHtml.replace(/<[^>]+>/g, ' ').substring(0, 500);
        const metadataJson = await serviceCallAI(
          'seo_metadata_generator',
          [item.title, contentSummary, 'General audience', [], location],
          'json'
        );
        // FIX: Use Safe Parse
        const metadata = await parseJsonWithAiRepair(metadataJson, aiRepairer);

        // Step 12: Generate schema
        const jsonLdSchema = generateFullSchema(
          item.title,
          metadata.metaDescription,
          siteInfo.authorName,
          new Date().toISOString(),
          wpConfig.url,
          siteInfo
        );

        // Step 13: Build final generated content object
        const generatedContent: GeneratedContent = {
          title: metadata.seoTitle || item.title,
          slug: item.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
          content: contentHtml,
          metaDescription: metadata.metaDescription,
          primaryKeyword: item.title,
          semanticKeywords,
          strategy: {
            targetAudience: 'General audience',
            searchIntent: 'Informational',
            competitorAnalysis: competitorGaps.join(', '),
            contentAngle: 'Comprehensive guide'
          },
          jsonLdSchema,
          socialMediaCopy: {
            twitter: `${metadata.seoTitle} - Check it out! 🚀`,
            linkedIn: `New article: ${metadata.seoTitle}. Learn everything you need to know.`
          },
          faqSection: [],
          keyTakeaways: [],
          outline: articlePlan.outline,
          references: [],
          imageDetails,
          neuronAnalysis: neuronData ? { terms_txt: { content_basic: neuronData } } : undefined
        };

        dispatch({ type: 'SET_CONTENT', payload: { id: item.id, content: generatedContent } });
        dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'done', statusText: 'Complete!' } });

      } catch (error: any) {
        console.error(`[generateItems] Error for ${item.title}:`, error);
        dispatch({ type: 'UPDATE_STATUS', payload: { 
          id: item.id, 
          status: 'error', 
          statusText: error.message || 'Generation failed' 
        } });
      }
    };

    // Process items with concurrency limit
    await processConcurrently(
      items,
      processItem,
      3, // Process 3 items at a time
      onProgress,
      () => false
    );
  },

  /**
   * Refresh existing content while preserving images
   */
  async refreshItem(
    item: ContentItem,
    serviceCallAI: (promptKey: PromptKey, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
    context: GenerationContext,
    aiRepairer: (brokenJson: string) => Promise<string>
  ): Promise<void> {
    const { dispatch, existingPages, siteInfo, wpConfig, geoTargeting, serperApiKey } = context;

    try {
      if (!item.crawledContent) {
        throw new Error('No crawled content available for refresh');
      }

      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Analyzing content...' } });

      // Extract existing images to preserve
      const existingImages = extractExistingImages(item.crawledContent);
      console.log(`[Refresh] Preserving ${existingImages.length} images`);

      // Generate semantic keywords
      const location = geoTargeting.enabled ? geoTargeting.location : null;
      const keywordsJson = await serviceCallAI('semantic_keyword_generator', [item.title, [], location], 'json');
      // FIX: Use Safe Parse
      const semanticKeywords: string[] = await parseJsonWithAiRepair(keywordsJson, aiRepairer);

      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Rewriting content...' } });

      // Build article plan for refresh
      const articlePlan = {
        title: item.title,
        primaryKeyword: item.title,
        semanticKeywords,
        outline: []
      };

      // Generate refreshed content
      let contentHtml = await serviceCallAI(
        'ultra_sota_article_writer',
        [articlePlan, semanticKeywords, [], existingPages, null, null],
        'html'
      );

      contentHtml = contentHtml.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

      // Reinject preserved images
      contentHtml = injectImagesIntoContent(contentHtml, existingImages);

      // Process internal links
      contentHtml = processInternalLinks(contentHtml, existingPages, wpConfig.url);

      // Add verification footer
      contentHtml += generateVerificationFooterHtml();

      // Add references
      if (serperApiKey) {
        const referencesHtml = await fetchVerifiedReferences(item.title, semanticKeywords, serperApiKey, wpConfig.url);
        if (referencesHtml) {
          contentHtml += referencesHtml;
        }
      }

      // Generate metadata
      const contentSummary = contentHtml.replace(/<[^>]+>/g, ' ').substring(0, 500);
      const metadataJson = await serviceCallAI(
        'seo_metadata_generator',
        [item.title, contentSummary, 'General audience', [], location],
        'json'
      );
      // FIX: Use Safe Parse
      const metadata = await parseJsonWithAiRepair(metadataJson, aiRepairer);

      const generatedContent: GeneratedContent = {
        title: metadata.seoTitle || item.title,
        slug: extractSlugFromUrl(item.originalUrl || item.title),
        content: contentHtml,
        metaDescription: metadata.metaDescription,
        primaryKeyword: item.title,
        semanticKeywords,
        strategy: { targetAudience: '', searchIntent: '', competitorAnalysis: '', contentAngle: '' },
        jsonLdSchema: {},
        socialMediaCopy: { twitter: '', linkedIn: '' },
        faqSection: [],
        keyTakeaways: [],
        outline: [],
        references: [],
        imageDetails: existingImages.map((img, idx) => ({
          prompt: 'Preserved from original',
          altText: img.alt || `Image ${idx + 1}`,
          title: `image-${idx + 1}`,
          placeholder: '',
          generatedImageSrc: img.src
        }))
      };

      dispatch({ type: 'SET_CONTENT', payload: { id: item.id, content: generatedContent } });

    } catch (error: any) {
      console.error('[refreshItem] Error:', error);
      dispatch({ type: 'UPDATE_STATUS', payload: { 
        id: item.id, 
        status: 'error', 
        statusText: error.message || 'Refresh failed' 
      } });
      throw error;
    }
  },

  /**
   * Analyze pages for content health
   */
  async analyzePages(
    pages: SitemapPage[],
    serviceCallAI: (promptKey: PromptKey, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
    setExistingPages: React.Dispatch<React.SetStateAction<SitemapPage[]>>,
    onProgress: (progress: { current: number; total: number }) => void,
    shouldStop: () => boolean
  ): Promise<void> {
    // Helper for JSON repair
    const aiRepairer = (brokenText: string) => serviceCallAI('json_repair', [brokenText], 'json');

    const processPage = async (page: SitemapPage, index: number): Promise<void> => {
      if (shouldStop()) return;

      setExistingPages(prev => prev.map(p => 
        p.id === page.id ? { ...p, status: 'analyzing' } : p
      ));

      try {
        // Crawl content
        const crawledContent = await smartCrawl(page.id);
        
        // Analyze with AI
        const analysisJson = await serviceCallAI(
          'health_analyzer',
          [page.id, crawledContent, page.title],
          'json'
        );
        
        // FIX: Use Safe Parse
        const analysis = await parseJsonWithAiRepair(analysisJson, aiRepairer);

        setExistingPages(prev => prev.map(p => 
          p.id === page.id ? {
            ...p,
            status: 'analyzed',
            crawledContent,
            healthScore: analysis.healthScore,
            updatePriority: analysis.healthScore < 50 ? 'Critical' : analysis.healthScore < 70 ? 'High' : analysis.healthScore < 90 ? 'Medium' : 'Healthy',
            justification: analysis.recommendations?.[0] || 'Analysis complete',
            analysis: {
              critique: "Automated analysis completed",
              strengths: [],
              weaknesses: analysis.issues || [],
              recommendations: analysis.recommendations || [],
              seoScore: analysis.healthScore,
              readabilityScore: 0
            }
          } : p
        ));

      } catch (error: any) {
        setExistingPages(prev => prev.map(p => 
          p.id === page.id ? { 
            ...p, 
            status: 'error', 
            justification: error.message 
          } : p
        ));
      }
    };

    await processConcurrently(pages, processPage, 3, onProgress, shouldStop);
  },

  /**
   * Analyze content gaps vs competitors
   */
  async analyzeContentGaps(
    existingPages: SitemapPage[],
    topic: string,
    serviceCallAI: (promptKey: PromptKey, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
    context: GenerationContext
  ): Promise<any[]> {
    const existingTitles = existingPages.map(p => p.title).slice(0, 50);
    const aiRepairer = (brokenText: string) => serviceCallAI('json_repair', [brokenText], 'json');
    
    const gapAnalysisJson = await serviceCallAI(
      'gap_analyzer',
      [existingTitles, [], topic],
      'json'
    );
    
    // FIX: Use Safe Parse
    const gapAnalysis = await parseJsonWithAiRepair(gapAnalysisJson, aiRepairer);
    
    return Array.isArray(gapAnalysis) ? gapAnalysis : (gapAnalysis.gaps || []);
  }
};

// ==================== INTERNAL LINKING HELPERS ====================

function processInternalLinks(content: string, existingPages: SitemapPage[], baseUrl: string): string {
  // Find link candidates in content
  const linkPattern = /\[LINK_CANDIDATE:\s*([^\]]+)\]/g;
  let processedContent = content;
  let linkCount = 0;
  const maxLinks = 12;

  processedContent = processedContent.replace(linkPattern, (match, anchorText) => {
    if (linkCount >= maxLinks) return anchorText; // Just return text without link

    const targetPage = findBestMatchingPage(anchorText, existingPages);
    
    if (targetPage) {
      linkCount++;
      const url = `${baseUrl.replace(/\/+$/, '')}/${targetPage.slug}`;
      return `<a href="${url}" title="${targetPage.title}">${anchorText}</a>`;
    }
    
    return anchorText; // No match found, return plain text
  });

  console.log(`[Internal Links] Added ${linkCount} links`);
  return processedContent;
}

function findBestMatchingPage(anchorText: string, pages: SitemapPage[]): SitemapPage | null {
  const anchorWords = anchorText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  let bestMatch: SitemapPage | null = null;
  let bestScore = 0;

  for (const page of pages) {
    const titleWords = page.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    // Count matching words
    const matchingWords = anchorWords.filter(w => 
      titleWords.some(tw => tw.includes(w) || w.includes(tw))
    );
    
    const score = matchingWords.length / Math.max(anchorWords.length, 1);
    
    if (score > bestScore && score >= 0.4) { // 40% match threshold
      bestScore = score;
      bestMatch = page;
    }
  }

  return bestMatch;
}

function extractExistingImages(html: string): Array<{ src: string; alt: string }> {
  const images: Array<{ src: string; alt: string }> = [];
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    images.push({
      src: match[1],
      alt: match[2] || ''
    });
  }

  // Also extract iframes (videos)
  const iframePattern = /<iframe[^>]+src=["']([^"']+)["'][^>]*>[^<]*<\/iframe>/gi;
  while ((match = iframePattern.exec(html)) !== null) {
    images.push({
      src: match[1],
      alt: 'Embedded video'
    });
  }

  return images;
}

function injectImagesIntoContent(content: string, images: Array<{ src: string; alt: string }>): string {
  if (images.length === 0) return content;

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const body = doc.body;
  
  // Get all H2 elements
  const h2s = Array.from(body.querySelectorAll('h2'));
  
  // Distribute images after H2s
  images.forEach((img, idx) => {
    const targetH2 = h2s[idx % h2s.length];
    if (targetH2) {
      const imgEl = doc.createElement('img');
      imgEl.src = img.src;
      imgEl.alt = img.alt;
      imgEl.loading = 'lazy';
      imgEl.style.cssText = 'width: 100%; height: auto; border-radius: 12px; margin: 1.5rem 0;';
      
      // Insert after H2's next sibling (after first paragraph)
      const nextSibling = targetH2.nextElementSibling;
      if (nextSibling?.nextSibling) {
        nextSibling.parentNode?.insertBefore(imgEl, nextSibling.nextSibling);
      } else {
        targetH2.parentNode?.insertBefore(imgEl, targetH2.nextSibling);
      }
    }
  });

  return body.innerHTML;
}

// ==================== GOD MODE MAINTENANCE ENGINE ====================

class MaintenanceEngine {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private context: GenerationContext | null = null;
  public logCallback: ((msg: string) => void) | null = null;

  start(context: GenerationContext): void {
    if (this.isRunning) return;

    // Validate API clients
    const selectedModel = context.selectedModel as keyof ApiClients;
    if (!context.apiClients[selectedModel]) {
      this.log(`❌ CRITICAL ERROR: AI API Client not initialized!`);
      this.log(`🔧 REQUIRED: Configure ${context.selectedModel.toUpperCase()} API key in Settings`);
      this.log(`🛑 STOPPING: God Mode requires a valid AI API client`);
      return;
    }

    this.isRunning = true;
    this.context = context;
    this.log('🚀 God Mode Activated: Autonomous Optimization Engine Started');

    // Run optimization cycle every 5 minutes
    this.intervalId = setInterval(() => {
      this.runOptimizationCycle();
    }, 5 * 60 * 1000);

    // Run first cycle immediately
    this.runOptimizationCycle();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.log('🛑 God Mode Deactivated');
  }

  updateContext(context: GenerationContext): void {
    this.context = context;
  }

  private log(message: string): void {
    console.log(`[GOD MODE] ${message}`);
    if (this.logCallback) {
      this.logCallback(message);
    }
  }

  private async runOptimizationCycle(): Promise<void> {
    if (!this.context || !this.isRunning) return;

    const { existingPages, excludedUrls = [], excludedCategories = [], priorityUrls = [], priorityOnlyMode = false } = this.context;

    this.log('🔍 Scanning for optimization targets...');

    // Filter pages
    let candidatePages = existingPages.filter(page => {
      // Skip excluded URLs
      if (excludedUrls.some(url => page.id.includes(url))) return false;
      
      // Skip excluded categories
      if (excludedCategories.some(cat => page.id.toLowerCase().includes(cat.toLowerCase()))) return false;
      
      // Check if already processed recently (24h cooldown)
      const lastProcessed = localStorage.getItem(`sota_last_proc_${page.id}`);
      if (lastProcessed) {
        const timeSince = Date.now() - parseInt(lastProcessed);
        if (timeSince < 24 * 60 * 60 * 1000) return false;
      }
      
      return true;
    });

    // Priority mode: only process priority URLs
    if (priorityOnlyMode && priorityUrls.length > 0) {
      candidatePages = candidatePages.filter(page => 
        priorityUrls.some(url => page.id === url || page.id.includes(url))
      );
    } else if (priorityUrls.length > 0) {
      // Sort priority URLs to front
      candidatePages.sort((a, b) => {
        const aIsPriority = priorityUrls.some(url => a.id === url);
        const bIsPriority = priorityUrls.some(url => b.id === url);
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;
        return 0;
      });
    }

    if (candidatePages.length === 0) {
      this.log('✅ All pages optimized or excluded. Waiting for next cycle...');
      return;
    }

    // Select up to 3 pages to optimize
    const pagesToOptimize = candidatePages.slice(0, 3);

    for (const page of pagesToOptimize) {
      if (!this.isRunning) break;

      this.log(`🎯 Target Acquired: "${page.title}"`);

      try {
        await this.optimizePage(page);
        
        // Mark as processed
        localStorage.setItem(`sota_last_proc_${page.id}`, Date.now().toString());
        this.log(`✅ GOD MODE SUCCESS|${page.title}|${page.id}`);

      } catch (error: any) {
        this.log(`❌ GOD MODE ERROR: ${error.message}`);
        // Don't mark as processed on error - will retry next cycle
      }

      // Cool down between pages
      await delay(10000);
    }
  }

  private async optimizePage(page: SitemapPage): Promise<void> {
    if (!this.context) return;

    const { apiClients, selectedModel, geoTargeting, openrouterModels, selectedGroqModel, serperApiKey, wpConfig, existingPages } = this.context;

    // Crawl current content
    this.log(`  📥 Crawling content...`);
    const currentContent = await smartCrawl(page.id);

    if (currentContent.length < 300) {
      this.log(`  ⚠️ Content too short to optimize (${currentContent.length} chars)`);
      return;
    }

    // Generate semantic keywords
    this.log(`  🔑 Generating semantic keywords...`);
    const serviceCallAI = (promptKey: PromptKey, args: any[], format: 'json' | 'html' = 'json') => 
      callAI(apiClients, selectedModel, geoTargeting, openrouterModels, selectedGroqModel, promptKey, args, format);

    const keywordsJson = await serviceCallAI('semantic_keyword_generator', [page.title, [], null], 'json');
    const aiRepairer = (brokenText: string) => serviceCallAI('json_repair', [brokenText], 'json');
    // FIX: Use Safe Parse
    const semanticKeywords: string[] = await parseJsonWithAiRepair(keywordsJson, aiRepairer);

    // Perform surgical DOM optimization
    this.log(`  ⚡ Performing surgical optimization...`);
    let optimizedContent = await this.optimizeDOMSurgically(currentContent, semanticKeywords, page.title, serviceCallAI);

    // Add references if missing
    if (!optimizedContent.includes('references-section') && serperApiKey) {
      this.log(`  📚 Adding verified references...`);
      const referencesHtml = await fetchVerifiedReferences(page.title, semanticKeywords, serperApiKey, wpConfig.url);
      if (referencesHtml) {
        optimizedContent += referencesHtml;
      }
    }

    // Add verification footer if missing
    if (!optimizedContent.includes('verification-footer-sota')) {
      optimizedContent += generateVerificationFooterHtml();
    }

    // Publish update
    this.log(`  💾 Publishing update...`);
    const item: ContentItem = {
      id: page.id,
      title: page.title,
      type: 'refresh',
      originalUrl: page.id,
      status: 'done',
      statusText: 'Optimized',
      generatedContent: {
        title: page.title,
        slug: page.slug,
        content: optimizedContent,
        metaDescription: '',
        primaryKeyword: page.title,
        semanticKeywords,
        strategy: { targetAudience: '', searchIntent: '', competitorAnalysis: '', contentAngle: '' },
        jsonLdSchema: {},
        socialMediaCopy: { twitter: '', linkedIn: '' },
        faqSection: [],
        keyTakeaways: [],
        outline: [],
        references: [],
        imageDetails: []
      }
    };

    const wpPassword = localStorage.getItem('wpPassword') || '';
    const result = await publishItemToWordPress(item, wpPassword, 'publish', fetchWithProxies, wpConfig);

    if (!result.success) {
      throw new Error(`Publish failed: ${result.message}`);
    }
  }

  private async optimizeDOMSurgically(
    html: string,
    semanticKeywords: string[],
    topic: string,
    serviceCallAI: (promptKey: PromptKey, args: any[], format: 'json' | 'html') => Promise<string>
  ): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    // Get content nodes to optimize
    const contentNodes = Array.from(body.querySelectorAll('p, li, h2, h3, h4, blockquote'))
      .filter(node => {
        const text = node.textContent || '';
        
        // Skip very short content
        if (text.length < 50) return false;
        
        // Skip nodes with tables, images, etc.
        if (node.querySelector('table, img, iframe, video')) return false;
        
        // Skip nodes with many links (likely navigation)
        const links = node.querySelectorAll('a');
        if (links.length > 2) return false;
        
        return true;
      })
      .slice(0, 30); // Process max 30 nodes

    if (contentNodes.length === 0) {
      this.log(`  ⚠️ No optimizable content nodes found`);
      return html;
    }

    // Process in batches of 5
    const batchSize = 5;
    let changesCount = 0;

    for (let i = 0; i < contentNodes.length; i += batchSize) {
      const batch = contentNodes.slice(i, i + batchSize);
      const batchHtml = batch.map(n => n.outerHTML).join('\n');

      try {
        const optimizedHtml = await serviceCallAI(
          'dom_content_polisher',
          [batchHtml, semanticKeywords, topic],
          'html'
        );

        // Validate output
        const cleanHtml = optimizedHtml
          .replace(/```html\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        // If AI returned empty (garbage detection) or too short, skip
        if (!cleanHtml || cleanHtml.length < batchHtml.length * 0.5) {
          continue;
        }

        // Parse and replace nodes
        const tempDoc = parser.parseFromString(cleanHtml, 'text/html');
        const newNodes = Array.from(tempDoc.body.children);

        batch.forEach((oldNode, idx) => {
          if (newNodes[idx] && oldNode.parentNode) {
            oldNode.parentNode.replaceChild(newNodes[idx].cloneNode(true), oldNode);
            changesCount++;
          }
        });

      } catch (error: any) {
        this.log(`  ⚠️ Batch ${i / batchSize + 1} failed: ${error.message}`);
        continue;
      }

      // Brief cooldown between batches
      await delay(500);
    }

    this.log(`  ✅ Applied ${changesCount} optimizations`);
    return body.innerHTML;
  }
}

// Export singleton instance
export const maintenanceEngine = new MaintenanceEngine();

// ==================== EXPORTS ====================

export {
  callGemini,
  callOpenAI,
  callAnthropic,
  callOpenRouter,
  callGroq,
  processInternalLinks,
  extractExistingImages,
  injectImagesIntoContent
};
