// =============================================================================
// SOTA SERVICES V12.0 - ENTERPRISE GRADE CONTENT GENERATION ENGINE
// Complete AI Integration, WordPress Publishing, God Mode Maintenance Engine
// =============================================================================

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { PROMPT_TEMPLATES } from './prompts';
import { AI_MODELS, PROCESSING_LIMITS } from './constants';
import { 
  SitemapPage, 
  ContentItem, 
  GeneratedContent, 
  GenerationContext,
  WpConfig,
  ApiClients,
  ExpandedGeoTargeting,
  NeuronConfig
} from './types';
import { 
  extractSlugFromUrl, 
  sanitizeTitle, 
  parseJsonWithAiRepair,
  processConcurrently,
  delay
} from './utils';
import { 
  fetchWithProxies, 
  smartCrawl, 
  processInternalLinks,
  performSurgicalUpdate,
  escapeRegExp
} from './contentUtils';


console.log('[SOTA Services] Enterprise Engine v12.0 Initialized');

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface AICallOptions {
  format?: 'json' | 'html' | 'text';
  grounding?: boolean;
  maxTokens?: number;
  temperature?: number;
}

interface PublishResult {
  success: boolean;
  message?: string;
  url?: string;
  link?: string;
  postId?: number;
}

interface ReferenceLink {
  title: string;
  url: string;
  source: string;
  description?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/```html\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^\s*<\/?html[^>]*>\s*/gi, '')
    .replace(/^\s*<\/?body[^>]*>\s*/gi, '')
    .replace(/^\s*<\/?head[^>]*>[\s\S]*?<\/head>\s*/gi, '')
    .trim();
};

const extractJsonFromResponse = (text: string): string => {
  // Try to find JSON in code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  
  // Try to find raw JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  return text;
};

const surgicalSanitizer = (html: string): string => {
  if (!html) return '';
  
  let cleaned = html
    .replace(/```html\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .trim();
  
  // Remove any leading/trailing whitespace from each line
  cleaned = cleaned.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
  
  return cleaned;
};

// =============================================================================
// MAIN AI CALLING FUNCTION
// =============================================================================

export const callAI = async (
  apiClients: ApiClients,
  selectedModel: string,
  geoTargeting: ExpandedGeoTargeting,
  openrouterModels: string[],
  selectedGroqModel: string,
  promptKey: keyof typeof PROMPT_TEMPLATES | string,
  args: any[],
  format: 'json' | 'html' | 'text' = 'json',
  grounding: boolean = false
): Promise<string> => {
  const promptTemplate = PROMPT_TEMPLATES[promptKey as keyof typeof PROMPT_TEMPLATES];
  
  if (!promptTemplate) {
    throw new Error(`[callAI] Unknown prompt key: ${promptKey}`);
  }

  const systemInstruction = promptTemplate.systemInstruction || '';
  const userPrompt = typeof promptTemplate.userPrompt === 'function'
    ? promptTemplate.userPrompt(...args)
    : String(promptTemplate.userPrompt);

  // Add geo-targeting context if enabled
  let finalUserPrompt = userPrompt;
  if (geoTargeting.enabled && geoTargeting.location) {
    finalUserPrompt = `[GEO-TARGET: ${geoTargeting.location}, ${geoTargeting.region}, ${geoTargeting.country}]\n\n${userPrompt}`;
  }

  console.log(`[callAI] Calling ${selectedModel} with prompt: ${promptKey}`);

  // Try selected model first, then fallback chain
  const modelPriority = [selectedModel, 'gemini', 'openai', 'anthropic', 'openrouter', 'groq'];
  const uniqueModels = [...new Set(modelPriority)];

  for (const model of uniqueModels) {
    const client = apiClients[model as keyof ApiClients];
    if (!client) continue;

    try {
      switch (model) {
        case 'gemini': {
          const geminiClient = client as InstanceType<typeof GoogleGenAI>;
          const modelConfig: any = {
            model: AI_MODELS.GEMINI_FLASH,
            contents: finalUserPrompt,
          };
          
          if (systemInstruction) {
            modelConfig.config = { systemInstruction };
          }
          
          if (format === 'json') {
            modelConfig.config = {
              ...modelConfig.config,
              responseMimeType: 'application/json',
            };
          }

          const response = await geminiClient.models.generateContent(modelConfig);
          const text = response.text || '';
          return format === 'json' ? extractJsonFromResponse(text) : text;
        }

        case 'openai': {
          const openaiClient = client as OpenAI;
          const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
          
          if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
          }
          messages.push({ role: 'user', content: finalUserPrompt });

          const completion = await openaiClient.chat.completions.create({
            model: AI_MODELS.OPENAI_GPT4O,
            messages,
            max_tokens: 16000,
            temperature: 0.7,
            response_format: format === 'json' ? { type: 'json_object' } : undefined,
          });

          return completion.choices[0]?.message?.content || '';
        }

        case 'anthropic': {
          const anthropicClient = client as Anthropic;
          const message = await anthropicClient.messages.create({
            model: AI_MODELS.ANTHROPIC_SONNET,
            max_tokens: 16000,
            system: systemInstruction,
            messages: [{ role: 'user', content: finalUserPrompt }],
          });

          const textBlock = message.content.find((b: any) => b.type === 'text');
          const text = textBlock ? (textBlock as any).text : '';
          return format === 'json' ? extractJsonFromResponse(text) : text;
        }

        case 'openrouter': {
          const openrouterClient = client as OpenAI;
          const modelsToTry = openrouterModels.length > 0 
            ? openrouterModels 
            : AI_MODELS.OPENROUTER_DEFAULT;

          for (const orModel of modelsToTry) {
            try {
              const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
              if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
              }
              messages.push({ role: 'user', content: finalUserPrompt });

              const completion = await openrouterClient.chat.completions.create({
                model: orModel,
                messages,
                max_tokens: 16000,
              });

              const responseText = completion.choices[0]?.message?.content || '';
              return format === 'json' ? extractJsonFromResponse(responseText) : responseText;
            } catch (e) {
              console.warn(`[callAI] OpenRouter model ${orModel} failed, trying next...`);
              continue;
            }
          }
          throw new Error('All OpenRouter models failed');
        }

        case 'groq': {
          const groqClient = client as OpenAI;
          const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
          
          if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
          }
          messages.push({ role: 'user', content: finalUserPrompt });

          const completion = await groqClient.chat.completions.create({
            model: selectedGroqModel || AI_MODELS.GROQ_MODELS[0],
            messages,
            max_tokens: 8000,
          });

          const responseText = completion.choices[0]?.message?.content || '';
          return format === 'json' ? extractJsonFromResponse(responseText) : responseText;
        }
      }
    } catch (error: any) {
      console.error(`[callAI] ${model} failed:`, error.message);
      continue;
    }
  }

  throw new Error(`[callAI] All AI providers failed for prompt: ${promptKey}`);
};

// =============================================================================
// REFERENCE VALIDATION SYSTEM
// =============================================================================

const BLOCKED_DOMAINS = [
  'youtube.com', 'youtu.be', 'facebook.com', 'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com', 'pinterest.com', 'linkedin.com',
  'reddit.com', 'quora.com', 'medium.com', 'wikipedia.org',
];

export const fetchVerifiedReferences = async (
  keyword: string,
  serperApiKey: string,
  wpUrl?: string,
  semanticKeywords: string[] = []
): Promise<string> => {
  if (!serperApiKey) {
    console.warn('[fetchVerifiedReferences] No Serper API key provided');
    return '';
  }

  try {
    let userDomain = '';
    if (wpUrl) {
      try {
        userDomain = new URL(wpUrl).hostname.replace('www.', '');
      } catch (e) {}
    }

    const currentYear = new Date().getFullYear();
    const query = `${keyword} "research" "study" "data" ${currentYear} -site:youtube.com -site:reddit.com`;

    console.log(`[fetchVerifiedReferences] Searching: ${query}`);

    const response = await fetchWithProxies('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 20 }),
    });

    const data = await response.json();
    const potentialLinks = data.organic || [];
    const validatedLinks: ReferenceLink[] = [];

    for (const link of potentialLinks) {
      if (validatedLinks.length >= 8) break;

      try {
        const urlObj = new URL(link.link);
        const domain = urlObj.hostname.replace('www.', '');

        // Skip blocked domains
        if (BLOCKED_DOMAINS.some(blocked => domain.includes(blocked))) continue;
        
        // Skip user's own domain
        if (userDomain && domain.includes(userDomain)) continue;

        // Validate link with HEAD request
        const checkRes = await Promise.race([
          fetch(link.link, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          }),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 5000)
          ),
        ]) as Response;

        if (checkRes.status === 200) {
          validatedLinks.push({
            title: link.title || 'Reference Source',
            url: link.link,
            source: domain,
            description: link.snippet || '',
          });
          console.log(`[fetchVerifiedReferences] ✅ Validated: ${domain}`);
        }
      } catch (e) {
        continue;
      }
    }

    if (validatedLinks.length === 0) {
      console.warn('[fetchVerifiedReferences] No valid references found');
      return '';
    }

    // Generate HTML for references section
    const referencesHtml = `
<div class="sota-references-section" style="margin-top: 3rem; padding: 2rem; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; border: 1px solid #e2e8f0;">
  <h2 style="color: #1e293b; font-size: 1.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
    📚 References & Further Reading
  </h2>
  <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1rem;">
    All sources verified operational with 200 status codes.
  </p>
  <ul style="list-style: none; padding: 0; display: grid; gap: 1rem;">
    ${validatedLinks.map(link => `
    <li style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
      <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-weight: 600;">
        ${link.title}
      </a>
      <span style="color: #94a3b8; font-size: 0.8rem; display: block; margin-top: 0.25rem;">
        (${link.source})
      </span>
      ${link.description ? `<p style="color: #64748b; font-size: 0.85rem; margin-top: 0.5rem;">${link.description.substring(0, 150)}...</p>` : ''}
    </li>
    `).join('')}
  </ul>
</div>`;

    return referencesHtml;
  } catch (error: any) {
    console.error('[fetchVerifiedReferences] Error:', error.message);
    return '';
  }
};

// =============================================================================
// IMAGE GENERATION
// =============================================================================

export const generateImageWithFallback = async (
  apiClients: ApiClients,
  prompt: string
): Promise<string | null> => {
  console.log('[generateImageWithFallback] Generating image for prompt:', prompt.substring(0, 50));

  // Try DALL-E 3 first
  if (apiClients.openai) {
    try {
      const openaiClient = apiClients.openai as OpenAI;
      const response = await openaiClient.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
      });

      const base64 = response.data[0]?.b64_json;
      if (base64) {
        return `data:image/png;base64,${base64}`;
      }
    } catch (error: any) {
      console.warn('[generateImageWithFallback] DALL-E 3 failed:', error.message);
    }
  }

  // Try Gemini Imagen
  if (apiClients.gemini) {
    try {
      const geminiClient = apiClients.gemini as InstanceType<typeof GoogleGenAI>;
      const response = await geminiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: `Generate an image: ${prompt}`,
        config: {
          responseModalities: ['image', 'text'],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if ((part as any).inlineData?.mimeType?.startsWith('image/')) {
          const base64 = (part as any).inlineData.data;
          return `data:image/png;base64,${base64}`;
        }
      }
    } catch (error: any) {
      console.warn('[generateImageWithFallback] Gemini Imagen failed:', error.message);
    }
  }

  console.error('[generateImageWithFallback] All image generation methods failed');
  return null;
};

// =============================================================================
// WORDPRESS PUBLISHING
// =============================================================================

export const publishItemToWordPress = async (
  item: ContentItem,
  wpPassword: string,
  publishStatus: 'publish' | 'draft' | 'pending',
  fetchWithRetry: typeof fetch,
  wpConfig: WpConfig
): Promise<PublishResult> => {
  if (!wpConfig.url || !wpConfig.username || !wpPassword) {
    return { success: false, message: 'WordPress credentials not configured' };
  }

  if (!item.generatedContent) {
    return { success: false, message: 'No generated content to publish' };
  }

  const baseUrl = wpConfig.url.replace(/\/+$/, '');
  const authHeader = `Basic ${btoa(`${wpConfig.username}:${wpPassword}`)}`;

  try {
    const { title, content, metaDescription, slug } = item.generatedContent;
    
    // Determine if this is an update or new post
    let postId: number | null = null;
    let endpoint = `${baseUrl}/wp-json/wp/v2/posts`;
    let method = 'POST';

    // Check if updating existing post
    if (item.originalUrl) {
      const originalSlug = extractSlugFromUrl(item.originalUrl);
      
      // Search for existing post by slug
      const searchResponse = await fetchWithRetry(
        `${baseUrl}/wp-json/wp/v2/posts?slug=${originalSlug}&status=any`,
        {
          method: 'GET',
          headers: { 'Authorization': authHeader },
        }
      );

      const searchData = await searchResponse.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        postId = searchData[0].id;
        endpoint = `${baseUrl}/wp-json/wp/v2/posts/${postId}`;
        method = 'PUT';
      }
    }

    const postData: any = {
      title: title,
      content: content,
      status: publishStatus,
      excerpt: metaDescription || '',
    };

    if (!postId && slug) {
      postData.slug = slug;
    }

    console.log(`[publishItemToWordPress] ${method} to ${endpoint}`);

    const response = await fetchWithRetry(endpoint, {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WordPress API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      message: `Successfully ${postId ? 'updated' : 'created'} post`,
      url: result.link,
      link: result.link,
      postId: result.id,
    };
  } catch (error: any) {
    console.error('[publishItemToWordPress] Error:', error);
    return { success: false, message: error.message };
  }
};

// =============================================================================
// CONTENT ANALYSIS FUNCTIONS
// =============================================================================

/**
 * CRITICAL: analyzePages function - This was MISSING and causing the error!
 * Analyzes selected pages for content health and optimization opportunities
 */
const analyzePages = async (
  pagesToAnalyze: SitemapPage[],
  callAIService: (promptKey: string, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
  setExistingPages: React.Dispatch<React.SetStateAction<SitemapPage[]>>,
  onProgress?: (progress: { current: number; total: number }) => void,
  shouldStop?: () => boolean
): Promise<void> => {
  const total = pagesToAnalyze.length;
  console.log(`[analyzePages] Starting analysis of ${total} pages`);

  for (let i = 0; i < total; i++) {
    // Check if should stop
    if (shouldStop && shouldStop()) {
      console.log('[analyzePages] Stopped by user');
      break;
    }

    const page = pagesToAnalyze[i];

    // Update progress
    if (onProgress) {
      onProgress({ current: i + 1, total });
    }

    // Mark as analyzing
    setExistingPages(prev => prev.map(p =>
      p.id === page.id ? { ...p, status: 'analyzing' as const } : p
    ));

    try {
      // Crawl page content if not already crawled
      let contentToAnalyze = page.crawledContent;

      if (!contentToAnalyze) {
        try {
          console.log(`[analyzePages] Crawling: ${page.id}`);
          const response = await fetchWithProxies(page.id, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          const html = await response.text();

          // Extract main content
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // Remove scripts, styles, nav, footer
          const elementsToRemove = doc.querySelectorAll(
            'script, style, nav, footer, header, aside, .sidebar, .comments, .advertisement, .cookie-notice'
          );
          elementsToRemove.forEach(el => el.remove());

          // Get main content
          const mainContent = doc.querySelector('main, article, .content, .post-content, .entry-content, #content');
          contentToAnalyze = mainContent?.innerHTML || doc.body.innerHTML;

          // Update crawled content
          setExistingPages(prev => prev.map(p =>
            p.id === page.id ? { ...p, crawledContent: contentToAnalyze } : p
          ));
        } catch (crawlError: any) {
          console.error(`[analyzePages] Failed to crawl ${page.id}:`, crawlError.message);

          setExistingPages(prev => prev.map(p =>
            p.id === page.id ? {
              ...p,
              status: 'error' as const,
              justification: `Crawl failed: ${crawlError.message}`,
            } : p
          ));
          continue;
        }
      }

      // Skip if content is too short
      const textContent = contentToAnalyze?.replace(/<[^>]*>/g, ' ').trim() || '';
      const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

      if (textContent.length < 200) {
        setExistingPages(prev => prev.map(p =>
          p.id === page.id ? {
            ...p,
            status: 'analyzed' as const,
            healthScore: 30,
            updatePriority: 'Critical',
            wordCount: wordCount,
            justification: 'Content too short or empty',
            analysis: {
              wordCount: wordCount,
              issues: ['Content is too short'],
              recommendations: ['Add comprehensive content (2000+ words)'],
              score: 30,
            },
          } : p
        ));
        continue;
      }

      // Analyze content with AI
      const analysisPrompt = `Analyze this webpage content for SEO health and content quality. Return JSON only:
{
  "healthScore": 0-100,
  "updatePriority": "Critical" | "High" | "Medium" | "Healthy",
  "issues": ["issue1", "issue2"],
  "recommendations": ["rec1", "rec2"],
  "wordCount": number,
  "hasStructuredData": boolean,
  "hasFAQ": boolean,
  "hasKeyTakeaways": boolean,
  "internalLinksCount": number,
  "outdatedInfo": boolean,
  "readabilityScore": 0-100
}

Content (first 4000 chars):
${textContent.substring(0, 4000)}`;

      let analysisResult: any;

      try {
        const aiResponse = await callAIService(
          'content_analyzer',
          [analysisPrompt],
          'json',
          false
        );

        // Try to parse JSON response
        try {
          analysisResult = JSON.parse(aiResponse);
        } catch {
          // If JSON parsing fails, create default analysis based on content
          analysisResult = createDefaultAnalysis(textContent, contentToAnalyze || '');
        }
      } catch (aiError: any) {
        console.warn(`[analyzePages] AI analysis failed for ${page.id}:`, aiError.message);
        // Fallback to basic analysis
        analysisResult = createDefaultAnalysis(textContent, contentToAnalyze || '');
      }

      // Update page with analysis results
      setExistingPages(prev => prev.map(p =>
        p.id === page.id ? {
          ...p,
          status: 'analyzed' as const,
          healthScore: analysisResult.healthScore,
          updatePriority: analysisResult.updatePriority,
          wordCount: analysisResult.wordCount,
          justification: analysisResult.issues?.join('; ') || 'Analysis complete',
          analysis: {
            wordCount: analysisResult.wordCount,
            issues: analysisResult.issues || [],
            recommendations: analysisResult.recommendations || [],
            score: analysisResult.healthScore,
            hasStructuredData: analysisResult.hasStructuredData,
            hasFAQ: analysisResult.hasFAQ,
            hasKeyTakeaways: analysisResult.hasKeyTakeaways,
            internalLinksCount: analysisResult.internalLinksCount,
            outdatedInfo: analysisResult.outdatedInfo,
          },
        } : p
      ));

    } catch (error: any) {
      console.error(`[analyzePages] Error analyzing ${page.id}:`, error.message);

      setExistingPages(prev => prev.map(p =>
        p.id === page.id ? {
          ...p,
          status: 'error' as const,
          justification: `Analysis failed: ${error.message}`,
        } : p
      ));
    }

    // Small delay between analyses to avoid rate limiting
    await delay(500);
  }

  console.log(`[analyzePages] Completed. Analyzed ${pagesToAnalyze.length} pages.`);
};

/**
 * Create default analysis when AI analysis fails
 */
const createDefaultAnalysis = (textContent: string, htmlContent: string): any => {
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
  const hasH2 = /<h2[^>]*>/i.test(htmlContent);
  const hasFAQ = /faq|frequently asked/i.test(htmlContent);
  const hasKeyTakeaways = /key takeaway|takeaway|summary/i.test(htmlContent);
  const internalLinksCount = (htmlContent.match(/<a[^>]+href=["'][^"']*["']/gi) || []).length;

  let healthScore = 50;
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (wordCount < 1000) {
    healthScore -= 20;
    issues.push('Content is too short');
    recommendations.push('Expand content to 2000+ words');
  } else if (wordCount >= 2000) {
    healthScore += 15;
  }

  if (!hasH2) {
    healthScore -= 10;
    issues.push('Missing H2 headings');
    recommendations.push('Add H2 subheadings for better structure');
  }

  if (!hasFAQ) {
    healthScore -= 5;
    recommendations.push('Consider adding FAQ section');
  }

  if (!hasKeyTakeaways) {
    healthScore -= 5;
    recommendations.push('Add Key Takeaways section');
  }

  if (internalLinksCount < 3) {
    healthScore -= 10;
    issues.push('Too few internal links');
    recommendations.push('Add 8-15 internal links');
  }

  healthScore = Math.max(0, Math.min(100, healthScore));

  let updatePriority: string;
  if (healthScore >= 80) updatePriority = 'Healthy';
  else if (healthScore >= 60) updatePriority = 'Medium';
  else if (healthScore >= 40) updatePriority = 'High';
  else updatePriority = 'Critical';

  return {
    healthScore,
    updatePriority,
    issues,
    recommendations,
    wordCount,
    hasStructuredData: false,
    hasFAQ,
    hasKeyTakeaways,
    internalLinksCount,
    outdatedInfo: false,
    readabilityScore: 65,
  };
};

// =============================================================================
// CONTENT GAP ANALYSIS
// =============================================================================

const analyzeContentGaps = async (
  existingPages: SitemapPage[],
  topic: string,
  callAIService: (promptKey: string, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
  context: GenerationContext
): Promise<any[]> => {
  console.log('[analyzeContentGaps] Starting gap analysis for topic:', topic);

  const existingTitles = existingPages.map(p => p.title).filter(Boolean).slice(0, 50);
  const existingTitlesStr = existingTitles.join('\n- ');

  try {
    const responseText = await callAIService(
      'gap_analysis',
      [topic, existingTitlesStr],
      'json'
    );

    const parsed = JSON.parse(responseText);
    const suggestions = parsed.suggestions || parsed.gaps || [];

    console.log(`[analyzeContentGaps] Found ${suggestions.length} content gaps`);

    return suggestions.map((s: any) => ({
      keyword: s.keyword || s.topic || s.title,
      opportunity: s.opportunity || s.description || s.reason,
      priority: s.priority || 'medium',
      searchVolume: s.searchVolume || null,
      difficulty: s.difficulty || null,
    }));
  } catch (error: any) {
    console.error('[analyzeContentGaps] Error:', error.message);
    return [];
  }
};

// =============================================================================
// CONTENT GENERATION
// =============================================================================

const generateItems = async (
  items: ContentItem[],
  callAIService: (promptKey: string, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
  generateImage: (prompt: string) => Promise<string | null>,
  context: GenerationContext,
  onProgress: (progress: { current: number; total: number }) => void,
  stopRef: React.MutableRefObject<Set<string>>
): Promise<void> => {
  const { dispatch, existingPages, siteInfo, wpConfig, geoTargeting, serperApiKey, neuronConfig } = context;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (stopRef.current.has(item.id)) {
      console.log(`[generateItems] Skipping stopped item: ${item.title}`);
      continue;
    }

    onProgress({ current: i + 1, total: items.length });

    dispatch({
      type: 'UPDATE_STATUS',
      payload: { id: item.id, status: 'generating', statusText: 'Starting generation...' },
    });

    try {
// Step 1: NeuronWriter data (placeholder - function not implemented)
let neuronData = null;
if (neuronConfig?.enabled && neuronConfig?.apiKey && neuronConfig?.projectId) {
  console.log('[generateItems] NeuronWriter enabled but getNeuronWriterData not implemented');
  // NeuronWriter integration placeholder - will proceed without NLP terms
}


      // Step 2: Generate semantic keywords
      dispatch({
        type: 'UPDATE_STATUS',
        payload: { id: item.id, status: 'generating', statusText: 'Generating semantic keywords...' },
      });

      let semanticKeywords: string[] = [];
      try {
        const keywordsResponse = await callAIService(
          'semantic_keywords',
          [item.title, geoTargeting.location || null],
          'json'
        );
        const keywordsData = JSON.parse(keywordsResponse);
        semanticKeywords = keywordsData.keywords || keywordsData.semanticKeywords || [];
      } catch (e) {
        console.warn('[generateItems] Semantic keywords generation failed');
        semanticKeywords = [item.title];
      }

      // Step 3: Generate content outline
      dispatch({
        type: 'UPDATE_STATUS',
        payload: { id: item.id, status: 'generating', statusText: 'Creating content outline...' },
      });

      let outline: any = null;
      try {
        const outlineResponse = await callAIService(
          'content_outline',
          [item.title, semanticKeywords.join(', '), item.type],
          'json'
        );
        outline = JSON.parse(outlineResponse);
      } catch (e) {
        console.warn('[generateItems] Outline generation failed, using default');
      }

      // Step 4: Generate main content
      dispatch({
        type: 'UPDATE_STATUS',
        payload: { id: item.id, status: 'generating', statusText: 'Writing article content...' },
      });

      const internalPagesContext = existingPages
        .slice(0, 30)
        .map(p => `- ${p.title} (/${extractSlugFromUrl(p.id)}/)`);

      const contentResponse = await callAIService(
        'ultra_sota_article_writer',
        [
          item.title,
          semanticKeywords.join(', '),
          JSON.stringify(outline || {}),
          internalPagesContext.join('\n'),
          neuronData ? JSON.stringify(neuronData) : null,
          null, // recent news
        ],
        'html'
      );

      let htmlContent = sanitizeHtml(contentResponse);

      // Step 5: Process internal links
      dispatch({
        type: 'UPDATE_STATUS',
        payload: { id: item.id, status: 'generating', statusText: 'Adding internal links...' },
      });

      htmlContent = processInternalLinks(htmlContent, existingPages, wpConfig.url);

      // Step 6: Generate and add references
      dispatch({
        type: 'UPDATE_STATUS',
        payload: { id: item.id, status: 'generating', statusText: 'Validating references...' },
      });

      if (serperApiKey) {
        const referencesHtml = await fetchVerifiedReferences(item.title, serperApiKey, wpConfig.url, semanticKeywords);
        if (referencesHtml) {
          htmlContent += referencesHtml;
        }
      }

      // Step 7: Generate meta description
      let metaDescription = '';
      try {
        const metaResponse = await callAIService(
          'meta_description',
          [item.title, semanticKeywords.slice(0, 3).join(', ')],
          'text'
        );
        metaDescription = metaResponse.replace(/"/g, '').trim().substring(0, 160);
      } catch (e) {
        metaDescription = `Learn everything about ${item.title}. Comprehensive guide with expert insights and actionable tips.`;
      }

      // Step 8: Generate schema
      dispatch({
        type: 'UPDATE_STATUS',
        payload: { id: item.id, status: 'generating', statusText: 'Generating schema...' },
      });

      let schemaMarkup = '';
      try {
        const schemaResponse = await callAIService(
          'schema_generator',
          [item.title, metaDescription, htmlContent.substring(0, 2000)],
          'json'
        );
        schemaMarkup = schemaResponse;
      } catch (e) {
        console.warn('[generateItems] Schema generation failed');
      }

      // Calculate word count
      const textOnly = htmlContent.replace(/<[^>]*>/g, ' ');
      const wordCount = textOnly.split(/\s+/).filter(w => w.length > 0).length;

      // Create generated content object
      const generatedContent: GeneratedContent = {
        title: item.title,
        content: htmlContent,
        metaDescription,
        slug: item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        primaryKeyword: item.title,
        semanticKeywords,
        wordCount,
        schemaMarkup,
        faqSchema: null,
        images: [],
      };

      dispatch({
        type: 'SET_CONTENT',
        payload: { id: item.id, content: generatedContent },
      });

      dispatch({
        type: 'UPDATE_STATUS',
        payload: { id: item.id, status: 'done', statusText: `Complete (${wordCount} words)` },
      });

      console.log(`[generateItems] ✅ Generated: ${item.title} (${wordCount} words)`);

    } catch (error: any) {
      console.error(`[generateItems] ❌ Failed: ${item.title}`, error);
      dispatch({
        type: 'UPDATE_STATUS',
        payload: { id: item.id, status: 'error', statusText: error.message },
      });
    }

    // Delay between items
    await delay(1000);
  }
};

// =============================================================================
// CONTENT REFRESH
// =============================================================================

const refreshItem = async (
  item: ContentItem,
  callAIService: (promptKey: string, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
  context: GenerationContext,
  aiRepairer: (brokenJson: string) => Promise<string>
): Promise<void> => {
  const { dispatch, existingPages, siteInfo, wpConfig, geoTargeting, serperApiKey, neuronConfig } = context;

  console.log(`[refreshItem] Starting refresh for: ${item.title}`);

  try {
    // Get existing content
    let existingContent = item.crawledContent;

    if (!existingContent && item.originalUrl) {
      dispatch({
        type: 'UPDATE_STATUS',
        payload: { id: item.id, status: 'generating', statusText: 'Crawling existing content...' },
      });

      existingContent = await smartCrawl(item.originalUrl);
      dispatch({
        type: 'SET_CRAWLED_CONTENT',
        payload: { id: item.id, content: existingContent },
      });
    }

    if (!existingContent || existingContent.length < 500) {
      throw new Error('Existing content too short or unavailable');
    }

    // Extract title from content
    const titleMatch = existingContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : item.title;

    // Generate semantic keywords
    dispatch({
      type: 'UPDATE_STATUS',
      payload: { id: item.id, status: 'generating', statusText: 'Analyzing content...' },
    });

    let semanticKeywords: string[] = [];
    try {
      const keywordsResponse = await callAIService(
        'semantic_keywords',
        [pageTitle, geoTargeting.location || null],
        'json'
      );
      const keywordsData = JSON.parse(keywordsResponse);
      semanticKeywords = keywordsData.keywords || [];
    } catch (e) {
      semanticKeywords = [pageTitle];
    }

    // Perform surgical DOM optimization
    dispatch({
      type: 'UPDATE_STATUS',
      payload: { id: item.id, status: 'generating', statusText: 'Optimizing content...' },
    });

    let optimizedContent = existingContent;

    try {
      // Parse and optimize DOM
      const parser = new DOMParser();
      const doc = parser.parseFromString(existingContent, 'text/html');

      // Find text nodes to optimize
      const paragraphs = doc.querySelectorAll('p, li');
      const nodesToProcess = Array.from(paragraphs)
        .filter(node => {
          const text = node.textContent || '';
          if (text.length < 50) return false;
          if (node.closest('table, .amazon-box, .key-takeaways-box, .faq-section')) return false;
          if (node.querySelectorAll('a').length > 2) return false;
          return true;
        })
        .slice(0, 20);

      // Process in batches
      const batchSize = 4;
      for (let i = 0; i < nodesToProcess.length; i += batchSize) {
        const batch = nodesToProcess.slice(i, i + batchSize);
        const batchHtml = batch.map(n => n.outerHTML).join('\n');

        try {
          const optimizedBatch = await callAIService(
            'dom_content_polisher',
            [batchHtml, semanticKeywords.join(', '), pageTitle],
            'html'
          );

          const cleanedBatch = surgicalSanitizer(optimizedBatch);
          if (cleanedBatch && cleanedBatch.length > batchHtml.length * 0.5) {
            // Apply optimizations
            const tempDoc = parser.parseFromString(cleanedBatch, 'text/html');
            const newNodes = tempDoc.body.children;

            for (let j = 0; j < Math.min(batch.length, newNodes.length); j++) {
              if (batch[j].parentNode) {
                batch[j].innerHTML = newNodes[j]?.innerHTML || batch[j].innerHTML;
              }
            }
          }
        } catch (e) {
          console.warn('[refreshItem] Batch optimization failed, skipping');
        }

        await delay(300);
      }

      optimizedContent = doc.body.innerHTML;
    } catch (domError: any) {
      console.warn('[refreshItem] DOM optimization failed:', domError.message);
    }

    // Process internal links
    dispatch({
      type: 'UPDATE_STATUS',
      payload: { id: item.id, status: 'generating', statusText: 'Updating internal links...' },
    });

    optimizedContent = processInternalLinks(optimizedContent, existingPages, wpConfig.url);

    // Add/update references
    if (serperApiKey) {
      dispatch({
        type: 'UPDATE_STATUS',
        payload: { id: item.id, status: 'generating', statusText: 'Validating references...' },
      });

      // Remove existing references section
      optimizedContent = optimizedContent.replace(
        /<div[^>]*class="[^"]*references[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
        ''
      );

      const referencesHtml = await fetchVerifiedReferences(pageTitle, serperApiKey, wpConfig.url, semanticKeywords);
      if (referencesHtml) {
        optimizedContent += referencesHtml;
      }
    }

    // Generate meta description
    let metaDescription = '';
    try {
      const metaResponse = await callAIService(
        'meta_description',
        [pageTitle, semanticKeywords.slice(0, 3).join(', ')],
        'text'
      );
      metaDescription = metaResponse.replace(/"/g, '').trim().substring(0, 160);
    } catch (e) {
      metaDescription = `Updated guide on ${pageTitle}. Expert insights and comprehensive information.`;
    }

    // Calculate word count
    const textOnly = optimizedContent.replace(/<[^>]*>/g, ' ');
    const wordCount = textOnly.split(/\s+/).filter(w => w.length > 0).length;

    const generatedContent: GeneratedContent = {
      title: pageTitle,
      content: optimizedContent,
      metaDescription,
      slug: extractSlugFromUrl(item.originalUrl || item.id),
      primaryKeyword: pageTitle,
      semanticKeywords,
      wordCount,
      schemaMarkup: '',
      faqSchema: null,
      images: [],
    };

    dispatch({
      type: 'SET_CONTENT',
      payload: { id: item.id, content: generatedContent },
    });

    dispatch({
      type: 'UPDATE_STATUS',
      payload: { id: item.id, status: 'done', statusText: `Refreshed (${wordCount} words)` },
    });

    console.log(`[refreshItem] ✅ Refreshed: ${pageTitle} (${wordCount} words)`);

  } catch (error: any) {
    console.error('[refreshItem] Error:', error);
    dispatch({
      type: 'UPDATE_STATUS',
      payload: { id: item.id, status: 'error', statusText: error.message },
    });
  }
};

// =============================================================================
// GENERATE CONTENT EXPORT OBJECT
// =============================================================================

export const generateContent = {
  generateItems,
  refreshItem,
  analyzeContentGaps,
  analyzePages, // ✅ CRITICAL: This was the missing function!
};

// =============================================================================
// GOD MODE MAINTENANCE ENGINE
// =============================================================================

class MaintenanceEngine {
  isRunning: boolean = false;
  logCallback: (msg: string) => void = console.log;
  private context: GenerationContext | null = null;
  private stopRequested: boolean = false;
  private cycleInterval: ReturnType<typeof setInterval> | null = null;

  start(context: GenerationContext): void {
    if (this.isRunning) {
      this.logCallback('⚠️ God Mode is already running');
      return;
    }

    // Validate API clients
    const selectedClient = context.apiClients[context.selectedModel as keyof ApiClients];
    if (!selectedClient) {
      const availableClients = Object.entries(context.apiClients)
        .filter(([_, client]) => client !== null)
        .map(([name]) => name);

      if (availableClients.length === 0) {
        this.logCallback('❌ CRITICAL ERROR: No AI API clients initialized!');
        this.logCallback('🔧 REQUIRED: Configure at least one API key in Settings');
        this.logCallback('🛑 STOPPING: God Mode requires a valid AI API client');
        return;
      }

      this.logCallback(`⚠️ Selected model "${context.selectedModel}" not available`);
      this.logCallback(`📋 Available: ${availableClients.join(', ')}`);
    }

    this.isRunning = true;
    this.stopRequested = false;
    this.context = context;
    this.logCallback('🚀 God Mode Activated: Autonomous Optimization Engine Starting...');

    // Start the optimization cycle
    this.runOptimizationCycle();

    // Set up interval for continuous optimization (every 5 minutes)
    this.cycleInterval = setInterval(() => {
      if (this.isRunning && !this.stopRequested) {
        this.runOptimizationCycle();
      }
    }, 5 * 60 * 1000);
  }

  stop(): void {
    this.stopRequested = true;
    this.isRunning = false;

    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = null;
    }

    this.logCallback('🛑 God Mode Stopped');
  }

  updateContext(context: GenerationContext): void {
    this.context = context;
    this.logCallback('🔄 Context Updated');
  }

  private async runOptimizationCycle(): Promise<void> {
    if (!this.context || this.stopRequested) return;

    const { existingPages, excludedUrls, excludedCategories, priorityUrls, priorityOnlyMode } = this.context;

    // Filter pages
    let pagesToProcess = existingPages.filter(page => {
      // Exclude specified URLs
      if (excludedUrls?.some(url => page.id.includes(url))) return false;

      // Exclude specified categories
      if (excludedCategories?.some(cat => page.id.includes(cat))) return false;

      // Check if recently processed
      const lastProcessed = localStorage.getItem(`sota_last_proc_${page.id}`);
      if (lastProcessed) {
        const hoursSince = (Date.now() - parseInt(lastProcessed)) / (1000 * 60 * 60);
        if (hoursSince < 24) return false; // Skip if processed in last 24 hours
      }

      return true;
    });

    // Apply priority mode
    if (priorityOnlyMode && priorityUrls && priorityUrls.length > 0) {
      pagesToProcess = pagesToProcess.filter(page =>
        priorityUrls.some(url => page.id.includes(url))
      );
      this.logCallback(`🎯 Priority Mode: ${pagesToProcess.length} priority URLs to process`);
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
      this.logCallback('💤 No pages available for optimization (all recently processed or excluded)');
      return;
    }

    this.logCallback(`📋 Found ${pagesToProcess.length} pages eligible for optimization`);

    // Process one page at a time
    const pageToOptimize = pagesToProcess[0];
    await this.optimizePage(pageToOptimize);
  }

  private async optimizePage(page: SitemapPage): Promise<void> {
    if (!this.context || this.stopRequested) return;

    this.logCallback(`🎯 Target Acquired: "${page.title || page.id}"`);

    try {
      // Create AI service caller
      const serviceCallAI = (
        promptKey: string,
        args: any[],
        format: 'json' | 'html' | 'text' = 'json',
        grounding: boolean = false
      ) => callAI(
        this.context!.apiClients,
        this.context!.selectedModel,
        this.context!.geoTargeting || { enabled: false, location: '', region: '', country: '', postalCode: '' },
        this.context!.openrouterModels || [],
        this.context!.selectedGroqModel || '',
        promptKey,
        args,
        format,
        grounding
      );

      // Crawl the page
      this.logCallback(`📄 Crawling: ${page.id}`);
      let pageContent = page.crawledContent;

      if (!pageContent) {
        try {
          pageContent = await smartCrawl(page.id);
        } catch (e: any) {
          this.logCallback(`❌ Crawl failed: ${e.message}`);
          return;
        }
      }

      if (!pageContent || pageContent.length < 500) {
        this.logCallback(`⚠️ Content too short, skipping`);
        return;
      }

      // Extract title
      const titleMatch = pageContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : page.title || 'Untitled';

      // Generate semantic keywords
      this.logCallback(`🔍 Analyzing: "${pageTitle}"`);
      let semanticKeywords: string[] = [];

      try {
        const kwResponse = await serviceCallAI('semantic_keywords', [pageTitle], 'json');
        const kwData = JSON.parse(kwResponse);
        semanticKeywords = kwData.keywords || [pageTitle];
      } catch (e) {
        semanticKeywords = [pageTitle];
      }

      // Optimize content
      this.logCallback(`⚡ Optimizing content...`);
      let optimizedContent = pageContent;
      let changesMade = 0;

      try {
        // Parse DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(pageContent, 'text/html');

        // Find paragraphs to optimize
        const paragraphs = Array.from(doc.querySelectorAll('p, li'))
          .filter(node => {
            const text = node.textContent || '';
            if (text.length < 60) return false;
            if (node.closest('table, .amazon-box, blockquote')) return false;
            if (node.querySelectorAll('a').length > 2) return false;
            return true;
          })
          .slice(0, 16);

        // Process in batches
        const batchSize = 4;
        let consecutiveErrors = 0;

        for (let i = 0; i < paragraphs.length && consecutiveErrors < 3; i += batchSize) {
          if (this.stopRequested) break;

          const batch = paragraphs.slice(i, i + batchSize);
          const batchHtml = batch.map(n => n.outerHTML).join('\n');

          try {
            const optimized = await serviceCallAI(
              'dom_content_polisher',
              [batchHtml, semanticKeywords.join(', '), pageTitle],
              'html'
            );

            const cleaned = surgicalSanitizer(optimized);
            if (cleaned && cleaned.length > batchHtml.length * 0.5) {
              const tempDoc = parser.parseFromString(cleaned, 'text/html');
              const newNodes = tempDoc.body.children;

              for (let j = 0; j < Math.min(batch.length, newNodes.length); j++) {
                if (batch[j].parentNode && newNodes[j]) {
                  const newContent = newNodes[j].innerHTML;
                  if (newContent && newContent !== batch[j].innerHTML) {
                    batch[j].innerHTML = newContent;
                    changesMade++;
                  }
                }
              }
              consecutiveErrors = 0;
            }
          } catch (e: any) {
            consecutiveErrors++;
            this.logCallback(`⚠️ Batch ${Math.floor(i / batchSize) + 1} failed: ${e.message}`);

            if (e.message?.includes('not initialized')) {
              this.logCallback(`❌ FATAL: API Client error. Stopping.`);
              break;
            }
          }

          await delay(500);
        }

        optimizedContent = doc.body.innerHTML;
      } catch (domError: any) {
        this.logCallback(`⚠️ DOM optimization error: ${domError.message}`);
      }

      // Add internal links
      this.logCallback(`🔗 Adding internal links...`);
      optimizedContent = processInternalLinks(
        optimizedContent,
        this.context!.existingPages,
        this.context!.wpConfig.url
      );

      // Verify changes were made
      if (changesMade === 0) {
        this.logCallback(`⚠️ No changes made to "${pageTitle}". Not marking as optimized.`);
        this.logCallback(`💡 This page will be retried on next cycle.`);
        return;
      }

      // Publish to WordPress
      this.logCallback(`💾 Publishing ${changesMade} improvements...`);

      const generatedContent: GeneratedContent = {
        title: pageTitle,
        content: optimizedContent,
        metaDescription: '',
        slug: extractSlugFromUrl(page.id),
        primaryKeyword: pageTitle,
        semanticKeywords,
        wordCount: optimizedContent.replace(/<[^>]*>/g, ' ').split(/\s+/).length,
        schemaMarkup: '',
        faqSchema: null,
        images: [],
      };

      const publishResult = await publishItemToWordPress(
        { ...page, generatedContent } as any,
        localStorage.getItem('sota_wp_password') || '',
        'publish',
        fetch,
        this.context!.wpConfig
      );

      if (publishResult.success) {
        localStorage.setItem(`sota_last_proc_${page.id}`, Date.now().toString());
        this.logCallback(`✅ SUCCESS|${pageTitle}|${publishResult.link || page.id}`);
      } else {
        this.logCallback(`❌ Publish failed: ${publishResult.message}`);
      }

    } catch (error: any) {
      this.logCallback(`❌ GOD MODE ERROR: ${error.message}`);
    }
  }
}

// Export singleton instance
export const maintenanceEngine = new MaintenanceEngine();

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  callAI,
  generateContent,
  publishItemToWordPress,
  fetchVerifiedReferences,
  callGeminiAPI,
  callOpenAIAPI,
  callAnthropicAPI,
  callOpenRouterAPI,
  callGroqAPI,
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
};
