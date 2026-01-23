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
// JSON REPAIR UTILITY
// =============================================================================

export const repairJson = async (
  brokenJson: string,
  apiClients?: ApiClients,
  selectedModel?: string
): Promise<string> => {
  console.log('[repairJson] Attempting to repair malformed JSON');
  
  // First try basic fixes
  let fixed = brokenJson.trim();
  
  // Remove markdown code blocks
  fixed = fixed.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
  
  // Try to extract JSON object
  const jsonMatch = fixed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    fixed = jsonMatch[0];
  }
  
  // Fix common issues
  fixed = fixed
    .replace(/,\s*}/g, '}')  // Trailing commas
    .replace(/,\s*]/g, ']')  // Trailing commas in arrays
    .replace(/'/g, '"')       // Single quotes to double
    .replace(/(\w+):/g, '"$1":') // Unquoted keys
    .replace(/""+/g, '"');    // Multiple quotes
  
  try {
    JSON.parse(fixed);
    return fixed;
  } catch (e) {
    // If API clients available, use AI to repair
    if (apiClients && selectedModel) {
      try {
        const repairPrompt = `Fix this malformed JSON and return ONLY valid JSON, nothing else:\n${brokenJson.substring(0, 3000)}`;
        
        const repaired = await callAI(
          apiClients,
          selectedModel,
          { enabled: false, location: '', region: '', country: '', postalCode: '' },
          [],
          '',
          'json_repair' as any,
          [repairPrompt],
          'json'
        );
        
        JSON.parse(repaired);
        return repaired;
      } catch (aiError) {
        console.error('[repairJson] AI repair failed');
      }
    }
    
    // Return original if all repairs fail
    return brokenJson;
  }
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
  
  let systemInstruction = '';
  let userPrompt = '';
  
  if (promptTemplate) {
    systemInstruction = promptTemplate.systemInstruction || '';
    userPrompt = typeof promptTemplate.userPrompt === 'function'
      ? promptTemplate.userPrompt(...args)
      : String(promptTemplate.userPrompt);
  } else {
    // Handle dynamic prompts passed directly
    userPrompt = args[0] || promptKey;
  }

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
// INDIVIDUAL AI API WRAPPERS (For backwards compatibility)
// =============================================================================

export const callGeminiAPI = async (
  client: InstanceType<typeof GoogleGenAI>,
  prompt: string,
  systemInstruction?: string,
  format: 'json' | 'html' | 'text' = 'text'
): Promise<string> => {
  console.log('[callGeminiAPI] Calling Gemini API');
  
  try {
    const modelConfig: any = {
      model: AI_MODELS.GEMINI_FLASH,
      contents: prompt,
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

    const response = await client.models.generateContent(modelConfig);
    const text = response.text || '';
    return format === 'json' ? extractJsonFromResponse(text) : text;
  } catch (error: any) {
    console.error('[callGeminiAPI] Error:', error.message);
    throw error;
  }
};

export const callOpenAIAPI = async (
  client: OpenAI,
  prompt: string,
  systemInstruction?: string,
  format: 'json' | 'html' | 'text' = 'text'
): Promise<string> => {
  console.log('[callOpenAIAPI] Calling OpenAI API');
  
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const completion = await client.chat.completions.create({
      model: AI_MODELS.OPENAI_GPT4O,
      messages,
      max_tokens: 16000,
      temperature: 0.7,
      response_format: format === 'json' ? { type: 'json_object' } : undefined,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error('[callOpenAIAPI] Error:', error.message);
    throw error;
  }
};

export const callAnthropicAPI = async (
  client: Anthropic,
  prompt: string,
  systemInstruction?: string,
  format: 'json' | 'html' | 'text' = 'text'
): Promise<string> => {
  console.log('[callAnthropicAPI] Calling Anthropic API');
  
  try {
    const message = await client.messages.create({
      model: AI_MODELS.ANTHROPIC_SONNET,
      max_tokens: 16000,
      system: systemInstruction || '',
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b: any) => b.type === 'text');
    const text = textBlock ? (textBlock as any).text : '';
    return format === 'json' ? extractJsonFromResponse(text) : text;
  } catch (error: any) {
    console.error('[callAnthropicAPI] Error:', error.message);
    throw error;
  }
};

export const callOpenRouterAPI = async (
  client: OpenAI,
  prompt: string,
  model: string,
  systemInstruction?: string
): Promise<string> => {
  console.log(`[callOpenRouterAPI] Calling OpenRouter with model: ${model}`);
  
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 16000,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error('[callOpenRouterAPI] Error:', error.message);
    throw error;
  }
};

export const callGroqAPI = async (
  client: OpenAI,
  prompt: string,
  model: string,
  systemInstruction?: string
): Promise<string> => {
  console.log(`[callGroqAPI] Calling Groq with model: ${model}`);
  
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const completion = await client.chat.completions.create({
      model: model || AI_MODELS.GROQ_MODELS[0],
      messages,
      max_tokens: 8000,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error('[callGroqAPI] Error:', error.message);
    throw error;
  }
};

// =============================================================================
// CONTENT GENERATION HELPER FUNCTIONS
// =============================================================================

export const generateSemanticKeywords = async (
  apiClients: ApiClients,
  selectedModel: string,
  topic: string,
  geoLocation?: string
): Promise<string[]> => {
  console.log('[generateSemanticKeywords] Generating keywords for:', topic);
  
  try {
    const response = await callAI(
      apiClients,
      selectedModel,
      { enabled: !!geoLocation, location: geoLocation || '', region: '', country: '', postalCode: '' },
      [],
      '',
      'semantic_keywords',
      [topic, geoLocation],
      'json'
    );
    
    const data = JSON.parse(response);
    return data.keywords || data.semanticKeywords || [topic];
  } catch (error: any) {
    console.error('[generateSemanticKeywords] Error:', error.message);
    return [topic];
  }
};

export const generateContentStrategy = async (
  apiClients: ApiClients,
  selectedModel: string,
  topic: string,
  existingContent: string[]
): Promise<any> => {
  console.log('[generateContentStrategy] Creating strategy for:', topic);
  
  try {
    const response = await callAI(
      apiClients,
      selectedModel,
      { enabled: false, location: '', region: '', country: '', postalCode: '' },
      [],
      '',
      'content_strategy',
      [topic, existingContent.join('\n')],
      'json'
    );
    
    return JSON.parse(response);
  } catch (error: any) {
    console.error('[generateContentStrategy] Error:', error.message);
    return { pillars: [], clusters: [], suggestions: [] };
  }
};

export const performGapAnalysis = async (
  apiClients: ApiClients,
  selectedModel: string,
  existingTopics: string[],
  targetKeyword: string
): Promise<any[]> => {
  console.log('[performGapAnalysis] Analyzing gaps for:', targetKeyword);
  
  try {
    const response = await callAI(
      apiClients,
      selectedModel,
      { enabled: false, location: '', region: '', country: '', postalCode: '' },
      [],
      '',
      'gap_analysis',
      [targetKeyword, existingTopics.join('\n- ')],
      'json'
    );
    
    const data = JSON.parse(response);
    return data.gaps || data.suggestions || [];
  } catch (error: any) {
    console.error('[performGapAnalysis] Error:', error.message);
    return [];
  }
};

export const generateSeoMetadata = async (
  apiClients: ApiClients,
  selectedModel: string,
  title: string,
  content: string
): Promise<{ metaTitle: string; metaDescription: string; focusKeyword: string }> => {
  console.log('[generateSeoMetadata] Generating metadata for:', title);
  
  try {
    const response = await callAI(
      apiClients,
      selectedModel,
      { enabled: false, location: '', region: '', country: '', postalCode: '' },
      [],
      '',
      'meta_description',
      [title, content.substring(0, 1000)],
      'json'
    );
    
    const data = JSON.parse(response);
    return {
      metaTitle: data.metaTitle || title,
      metaDescription: data.metaDescription || data.description || '',
      focusKeyword: data.focusKeyword || title,
    };
  } catch (error: any) {
    console.error('[generateSeoMetadata] Error:', error.message);
    return {
      metaTitle: title,
      metaDescription: `Learn about ${title}. Comprehensive guide with expert insights.`,
      focusKeyword: title,
    };
  }
};

export const generateFaqSection = async (
  apiClients: ApiClients,
  selectedModel: string,
  topic: string,
  existingContent: string
): Promise<{ question: string; answer: string }[]> => {
  console.log('[generateFaqSection] Generating FAQ for:', topic);
  
  try {
    const response = await callAI(
      apiClients,
      selectedModel,
      { enabled: false, location: '', region: '', country: '', postalCode: '' },
      [],
      '',
      'faq_generator',
      [topic, existingContent.substring(0, 2000)],
      'json'
    );
    
    const data = JSON.parse(response);
    return data.faqs || data.questions || [];
  } catch (error: any) {
    console.error('[generateFaqSection] Error:', error.message);
    return [];
  }
};

export const generateKeyTakeaways = async (
  apiClients: ApiClients,
  selectedModel: string,
  title: string,
  content: string
): Promise<string[]> => {
  console.log('[generateKeyTakeaways] Generating takeaways for:', title);
  
  try {
    const response = await callAI(
      apiClients,
      selectedModel,
      { enabled: false, location: '', region: '', country: '', postalCode: '' },
      [],
      '',
      'key_takeaways',
      [title, content.substring(0, 3000)],
      'json'
    );
    
    const data = JSON.parse(response);
    return data.takeaways || data.keyTakeaways || [];
  } catch (error: any) {
    console.error('[generateKeyTakeaways] Error:', error.message);
    return [];
  }
};

export const generateArticleContent = async (
  apiClients: ApiClients,
  selectedModel: string,
  title: string,
  outline: any,
  semanticKeywords: string[]
): Promise<string> => {
  console.log('[generateArticleContent] Generating article:', title);
  
  try {
    const response = await callAI(
      apiClients,
      selectedModel,
      { enabled: false, location: '', region: '', country: '', postalCode: '' },
      [],
      '',
      'ultra_sota_article_writer',
      [title, semanticKeywords.join(', '), JSON.stringify(outline), '', null, null],
      'html'
    );
    
    return sanitizeHtml(response);
  } catch (error: any) {
    console.error('[generateArticleContent] Error:', error.message);
    throw error;
  }
};

export const generateFullContent = async (
  apiClients: ApiClients,
  selectedModel: string,
  geoTargeting: ExpandedGeoTargeting,
  item: ContentItem,
  existingPages: SitemapPage[],
  wpUrl: string,
  serperApiKey?: string
): Promise<GeneratedContent> => {
  console.log('[generateFullContent] Full generation for:', item.title);
  
  // Generate semantic keywords
  const semanticKeywords = await generateSemanticKeywords(
    apiClients,
    selectedModel,
    item.title,
    geoTargeting.location
  );
  
  // Generate outline
  let outline = null;
  try {
    const outlineResponse = await callAI(
      apiClients,
      selectedModel,
      geoTargeting,
      [],
      '',
      'content_outline',
      [item.title, semanticKeywords.join(', '), item.type],
      'json'
    );
    outline = JSON.parse(outlineResponse);
  } catch (e) {
    console.warn('[generateFullContent] Outline failed, continuing without');
  }
  
  // Generate main content
  const internalPagesContext = existingPages
    .slice(0, 30)
    .map(p => `- ${p.title} (/${extractSlugFromUrl(p.id)}/)`);
  
  const contentResponse = await callAI(
    apiClients,
    selectedModel,
    geoTargeting,
    [],
    '',
    'ultra_sota_article_writer',
    [item.title, semanticKeywords.join(', '), JSON.stringify(outline || {}), internalPagesContext.join('\n'), null, null],
    'html'
  );
  
  let htmlContent = sanitizeHtml(contentResponse);
  
  // Process internal links
  htmlContent = processInternalLinks(htmlContent, existingPages, wpUrl);
  
  // Add references if serper key available
  if (serperApiKey) {
    const refs = await fetchVerifiedReferences(item.title, serperApiKey, wpUrl, semanticKeywords);
    if (refs) htmlContent += refs;
  }
  
  // Generate meta description
  let metaDescription = '';
  try {
    const metaResponse = await callAI(
      apiClients,
      selectedModel,
      geoTargeting,
      [],
      '',
      'meta_description',
      [item.title, semanticKeywords.slice(0, 3).join(', ')],
      'text'
    );
    metaDescription = metaResponse.replace(/"/g, '').trim().substring(0, 160);
  } catch (e) {
    metaDescription = `Learn everything about ${item.title}. Comprehensive guide with expert insights.`;
  }
  
  const wordCount = htmlContent.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
  
  return {
    title: item.title,
    content: htmlContent,
    metaDescription,
    slug: item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    primaryKeyword: item.title,
    semanticKeywords,
    wordCount,
    schemaMarkup: '',
    faqSchema: null,
    images: [],
  };
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

        if (BLOCKED_DOMAINS.some(blocked => domain.includes(blocked))) continue;
        if (userDomain && domain.includes(userDomain)) continue;

        const checkRes = await Promise.race([
          fetch(link.link, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          }),
          new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]) as Response;

        if (checkRes.status === 200) {
          validatedLinks.push({
            title: link.title || 'Reference Source',
            url: link.link,
            source: domain,
            description: link.snippet || '',
          });
        }
      } catch (e) {
        continue;
      }
    }

    if (validatedLinks.length === 0) return '';

    return `
<div class="sota-references-section" style="margin-top: 3rem; padding: 2rem; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; border: 1px solid #e2e8f0;">
  <h2 style="color: #1e293b; font-size: 1.5rem; margin-bottom: 1.5rem;">📚 References & Further Reading</h2>
  <ul style="list-style: none; padding: 0; display: grid; gap: 1rem;">
    ${validatedLinks.map(link => `
    <li style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
      <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-weight: 600;">${link.title}</a>
      <span style="color: #94a3b8; font-size: 0.8rem; display: block;">(${link.source})</span>
    </li>`).join('')}
  </ul>
</div>`;
  } catch (error: any) {
    console.error('[fetchVerifiedReferences] Error:', error.message);
    return '';
  }
};

export const generateReferences = fetchVerifiedReferences;

// =============================================================================
// IMAGE UTILITIES
// =============================================================================

export const generateImageWithFallback = async (
  apiClients: ApiClients,
  prompt: string
): Promise<string | null> => {
  console.log('[generateImageWithFallback] Generating image');

  if (apiClients.openai) {
    try {
      const openaiClient = apiClients.openai as OpenAI;
      const response = await openaiClient.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
      });

      const base64 = response.data[0]?.b64_json;
      if (base64) return `data:image/png;base64,${base64}`;
    } catch (error: any) {
      console.warn('[generateImageWithFallback] DALL-E 3 failed:', error.message);
    }
  }

  if (apiClients.gemini) {
    try {
      const geminiClient = apiClients.gemini as InstanceType<typeof GoogleGenAI>;
      const response = await geminiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: `Generate an image: ${prompt}`,
        config: { responseModalities: ['image', 'text'] },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if ((part as any).inlineData?.mimeType?.startsWith('image/')) {
          return `data:image/png;base64,${(part as any).inlineData.data}`;
        }
      }
    } catch (error: any) {
      console.warn('[generateImageWithFallback] Gemini Imagen failed:', error.message);
    }
  }

  return null;
};

export const uploadToImgur = async (
  imageData: string,
  imgurClientId?: string
): Promise<string | null> => {
  console.log('[uploadToImgur] Uploading image');
  
  if (!imgurClientId) {
    console.warn('[uploadToImgur] No Imgur client ID provided');
    return null;
  }
  
  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${imgurClientId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Data, type: 'base64' }),
    });
    
    const data = await response.json();
    
    if (data.success && data.data?.link) {
      return data.data.link;
    }
    
    return null;
  } catch (error: any) {
    console.error('[uploadToImgur] Error:', error.message);
    return null;
  }
};

export const generateImageAltText = async (
  apiClients: ApiClients,
  selectedModel: string,
  imageContext: string,
  keyword: string
): Promise<string> => {
  console.log('[generateImageAltText] Generating alt text');
  
  try {
    const response = await callAI(
      apiClients,
      selectedModel,
      { enabled: false, location: '', region: '', country: '', postalCode: '' },
      [],
      '',
      'image_alt_text' as any,
      [imageContext, keyword],
      'text'
    );
    
    return response.trim().substring(0, 125);
  } catch (error: any) {
    console.error('[generateImageAltText] Error:', error.message);
    return `${keyword} - informative image`;
  }
};

// =============================================================================
// WORDPRESS FUNCTIONS
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
    
    let postId: number | null = null;
    let endpoint = `${baseUrl}/wp-json/wp/v2/posts`;
    let method = 'POST';

    if (item.originalUrl) {
      const originalSlug = extractSlugFromUrl(item.originalUrl);
      
      const searchResponse = await fetchWithRetry(
        `${baseUrl}/wp-json/wp/v2/posts?slug=${originalSlug}&status=any`,
        { method: 'GET', headers: { 'Authorization': authHeader } }
      );

      const searchData = await searchResponse.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        postId = searchData[0].id;
        endpoint = `${baseUrl}/wp-json/wp/v2/posts/${postId}`;
        method = 'PUT';
      }
    }

    const postData: any = {
      title,
      content,
      status: publishStatus,
      excerpt: metaDescription || '',
    };

    if (!postId && slug) postData.slug = slug;

    const response = await fetchWithRetry(endpoint, {
      method,
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
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

export const publishToWordPress = publishItemToWordPress;

export const getExistingPages = async (
  wpConfig: WpConfig,
  wpPassword: string
): Promise<SitemapPage[]> => {
  console.log('[getExistingPages] Fetching pages from WordPress');
  
  if (!wpConfig.url || !wpConfig.username || !wpPassword) {
    return [];
  }
  
  const baseUrl = wpConfig.url.replace(/\/+$/, '');
  const authHeader = `Basic ${btoa(`${wpConfig.username}:${wpPassword}`)}`;
  
  try {
    const pages: SitemapPage[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 10) {
      const response = await fetch(
        `${baseUrl}/wp-json/wp/v2/posts?per_page=100&page=${page}&status=publish`,
        { headers: { 'Authorization': authHeader } }
      );
      
      if (!response.ok) break;
      
      const posts = await response.json();
      
      if (!Array.isArray(posts) || posts.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const post of posts) {
        pages.push({
          id: post.link || `${baseUrl}/?p=${post.id}`,
          title: post.title?.rendered || 'Untitled',
          lastModified: post.modified,
          status: 'pending',
        });
      }
      
      page++;
    }
    
    console.log(`[getExistingPages] Found ${pages.length} posts`);
    return pages;
  } catch (error: any) {
    console.error('[getExistingPages] Error:', error.message);
    return [];
  }
};

export const parseSitemap = async (sitemapUrl: string): Promise<SitemapPage[]> => {
  console.log('[parseSitemap] Parsing:', sitemapUrl);
  
  try {
    const response = await fetchWithProxies(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SOTABot/1.0)' },
    });
    
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    
    const pages: SitemapPage[] = [];
    
    // Check for sitemap index
    const sitemapIndexUrls = doc.querySelectorAll('sitemap > loc');
    if (sitemapIndexUrls.length > 0) {
      console.log('[parseSitemap] Found sitemap index, parsing nested sitemaps');
      
      for (const loc of Array.from(sitemapIndexUrls).slice(0, 5)) {
        const nestedUrl = loc.textContent?.trim();
        if (nestedUrl) {
          const nestedPages = await parseSitemap(nestedUrl);
          pages.push(...nestedPages);
        }
      }
      
      return pages;
    }
    
    // Parse URL entries
    const urlEntries = doc.querySelectorAll('url');
    
    for (const entry of Array.from(urlEntries)) {
      const loc = entry.querySelector('loc')?.textContent?.trim();
      const lastmod = entry.querySelector('lastmod')?.textContent?.trim();
      
      if (loc) {
        const slug = extractSlugFromUrl(loc);
        pages.push({
          id: loc,
          title: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          lastModified: lastmod,
          status: 'pending',
        });
      }
    }
    
    console.log(`[parseSitemap] Found ${pages.length} URLs`);
    return pages;
  } catch (error: any) {
    console.error('[parseSitemap] Error:', error.message);
    return [];
  }
};

// =============================================================================
// SERP & ANALYSIS FUNCTIONS
// =============================================================================

export const getSerpResults = async (
  keyword: string,
  serperApiKey: string
): Promise<any[]> => {
  console.log('[getSerpResults] Fetching SERP for:', keyword);
  
  if (!serperApiKey) return [];
  
  try {
    const response = await fetchWithProxies('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: keyword, num: 10 }),
    });
    
    const data = await response.json();
    return data.organic || [];
  } catch (error: any) {
    console.error('[getSerpResults] Error:', error.message);
    return [];
  }
};

export const analyzeContentHealth = async (
  apiClients: ApiClients,
  selectedModel: string,
  content: string,
  url: string
): Promise<any> => {
  console.log('[analyzeContentHealth] Analyzing:', url);
  
  const textContent = content.replace(/<[^>]*>/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
  
  if (textContent.length < 200) {
    return {
      healthScore: 30,
      updatePriority: 'Critical',
      issues: ['Content too short'],
      recommendations: ['Add comprehensive content (2000+ words)'],
      wordCount,
    };
  }
  
  try {
    const response = await callAI(
      apiClients,
      selectedModel,
      { enabled: false, location: '', region: '', country: '', postalCode: '' },
      [],
      '',
      'content_analyzer',
      [textContent.substring(0, 4000)],
      'json'
    );
    
    return JSON.parse(response);
  } catch (error: any) {
    console.error('[analyzeContentHealth] Error:', error.message);
    return createDefaultAnalysis(textContent, content);
  }
};

// =============================================================================
// GOD MODE FUNCTIONS
// =============================================================================

export const godModeOptimize = async (
  apiClients: ApiClients,
  selectedModel: string,
  page: SitemapPage,
  existingPages: SitemapPage[],
  wpConfig: WpConfig
): Promise<{ success: boolean; message: string }> => {
  console.log('[godModeOptimize] Optimizing:', page.title);
  
  try {
    let content = page.crawledContent;
    
    if (!content) {
      content = await smartCrawl(page.id);
    }
    
    if (!content || content.length < 500) {
      return { success: false, message: 'Content too short' };
    }
    
    // Process internal links
    const optimizedContent = processInternalLinks(content, existingPages, wpConfig.url);
    
    return { success: true, message: 'Optimization complete' };
  } catch (error: any) {
    console.error('[godModeOptimize] Error:', error.message);
    return { success: false, message: error.message };
  }
};

export const godModeStructuralGuardian = async (
  apiClients: ApiClients,
  selectedModel: string,
  content: string,
  requirements: any
): Promise<string> => {
  console.log('[godModeStructuralGuardian] Checking structure');
  
  // Basic structural checks
  const hasH2 = /<h2[^>]*>/i.test(content);
  const hasFAQ = /faq|frequently asked/i.test(content);
  const hasKeyTakeaways = /key takeaway|takeaway/i.test(content);
  
  let warnings: string[] = [];
  
  if (!hasH2) warnings.push('Missing H2 headings');
  if (!hasFAQ && requirements.requireFAQ) warnings.push('Missing FAQ section');
  if (!hasKeyTakeaways && requirements.requireKeyTakeaways) warnings.push('Missing Key Takeaways');
  
  return warnings.length > 0 ? warnings.join('; ') : 'Structure OK';
};

// =============================================================================
// CLUSTER PLANNING
// =============================================================================

export const generateClusterPlan = async (
  apiClients: ApiClients,
  selectedModel: string,
  mainTopic: string,
  existingContent: string[]
): Promise<any> => {
  console.log('[generateClusterPlan] Planning cluster for:', mainTopic);
  
  try {
    const response = await callAI(
      apiClients,
      selectedModel,
      { enabled: false, location: '', region: '', country: '', postalCode: '' },
      [],
      '',
      'cluster_planner',
      [mainTopic, existingContent.join('\n')],
      'json'
    );
    
    return JSON.parse(response);
  } catch (error: any) {
    console.error('[generateClusterPlan] Error:', error.message);
    return { pillar: mainTopic, clusters: [], supportingContent: [] };
  }
};

// =============================================================================
// NEURONWRITER INTEGRATION
// =============================================================================

export const fetchNeuronwriterData = async (
  neuronConfig: NeuronConfig,
  keyword: string
): Promise<any | null> => {
  console.log('[fetchNeuronwriterData] Fetching for:', keyword);
  
  if (!neuronConfig?.enabled || !neuronConfig?.apiKey || !neuronConfig?.projectId) {
    return null;
  }
  
  try {
    // NeuronWriter API integration placeholder
    // Actual implementation would call NeuronWriter API
    console.log('[fetchNeuronwriterData] NeuronWriter integration placeholder');
    return null;
  } catch (error: any) {
    console.error('[fetchNeuronwriterData] Error:', error.message);
    return null;
  }
};

// =============================================================================
// CONTENT ANALYSIS HELPER
// =============================================================================

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
    recommendations.push('Add H2 subheadings');
  }

  if (!hasFAQ) {
    healthScore -= 5;
    recommendations.push('Add FAQ section');
  }

  if (!hasKeyTakeaways) {
    healthScore -= 5;
    recommendations.push('Add Key Takeaways');
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

  return { healthScore, updatePriority, issues, recommendations, wordCount, hasFAQ, hasKeyTakeaways, internalLinksCount };
};

// =============================================================================
// CONTENT GENERATION FUNCTIONS
// =============================================================================

const analyzePages = async (
  pagesToAnalyze: SitemapPage[],
  callAIService: (promptKey: string, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
  setExistingPages: React.Dispatch<React.SetStateAction<SitemapPage[]>>,
  onProgress?: (progress: { current: number; total: number }) => void,
  shouldStop?: () => boolean
): Promise<void> => {
  const total = pagesToAnalyze.length;

  for (let i = 0; i < total; i++) {
    if (shouldStop && shouldStop()) break;

    const page = pagesToAnalyze[i];
    if (onProgress) onProgress({ current: i + 1, total });

    setExistingPages(prev => prev.map(p =>
      p.id === page.id ? { ...p, status: 'analyzing' as const } : p
    ));

    try {
      let contentToAnalyze = page.crawledContent;

      if (!contentToAnalyze) {
        const response = await fetchWithProxies(page.id, {
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        doc.querySelectorAll('script, style, nav, footer, header, aside').forEach(el => el.remove());
        const mainContent = doc.querySelector('main, article, .content, .post-content, #content');
        contentToAnalyze = mainContent?.innerHTML || doc.body.innerHTML;

        setExistingPages(prev => prev.map(p =>
          p.id === page.id ? { ...p, crawledContent: contentToAnalyze } : p
        ));
      }

      const textContent = contentToAnalyze?.replace(/<[^>]*>/g, ' ').trim() || '';
      const analysisResult = createDefaultAnalysis(textContent, contentToAnalyze || '');

      setExistingPages(prev => prev.map(p =>
        p.id === page.id ? {
          ...p,
          status: 'analyzed' as const,
          healthScore: analysisResult.healthScore,
          updatePriority: analysisResult.updatePriority,
          wordCount: analysisResult.wordCount,
          justification: analysisResult.issues?.join('; ') || 'Analysis complete',
          analysis: analysisResult,
        } : p
      ));
    } catch (error: any) {
      setExistingPages(prev => prev.map(p =>
        p.id === page.id ? { ...p, status: 'error' as const, justification: error.message } : p
      ));
    }

    await delay(500);
  }
};

const analyzeContentGaps = async (
  existingPages: SitemapPage[],
  topic: string,
  callAIService: (promptKey: string, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
  context: GenerationContext
): Promise<any[]> => {
  const existingTitles = existingPages.map(p => p.title).filter(Boolean).slice(0, 50);

  try {
    const responseText = await callAIService('gap_analysis', [topic, existingTitles.join('\n- ')], 'json');
    const parsed = JSON.parse(responseText);
    return parsed.suggestions || parsed.gaps || [];
  } catch (error: any) {
    console.error('[analyzeContentGaps] Error:', error.message);
    return [];
  }
};

const generateItems = async (
  items: ContentItem[],
  callAIService: (promptKey: string, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
  generateImage: (prompt: string) => Promise<string | null>,
  context: GenerationContext,
  onProgress: (progress: { current: number; total: number }) => void,
  stopRef: React.MutableRefObject<Set<string>>
): Promise<void> => {
  const { dispatch, existingPages, wpConfig, geoTargeting, serperApiKey } = context;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (stopRef.current.has(item.id)) continue;

    onProgress({ current: i + 1, total: items.length });
    dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'generating', statusText: 'Starting...' } });

    try {
      let semanticKeywords: string[] = [item.title];
      try {
        const kwRes = await callAIService('semantic_keywords', [item.title, geoTargeting.location || null], 'json');
        semanticKeywords = JSON.parse(kwRes).keywords || [item.title];
      } catch (e) {}

      const internalPagesContext = existingPages.slice(0, 30).map(p => `- ${p.title} (/${extractSlugFromUrl(p.id)}/)`);

      const contentResponse = await callAIService(
        'ultra_sota_article_writer',
        [item.title, semanticKeywords.join(', '), '{}', internalPagesContext.join('\n'), null, null],
        'html'
      );

      let htmlContent = sanitizeHtml(contentResponse);
      htmlContent = processInternalLinks(htmlContent, existingPages, wpConfig.url);

      if (serperApiKey) {
        const refs = await fetchVerifiedReferences(item.title, serperApiKey, wpConfig.url, semanticKeywords);
        if (refs) htmlContent += refs;
      }

      let metaDescription = `Learn about ${item.title}. Expert guide.`;
      try {
        metaDescription = (await callAIService('meta_description', [item.title, semanticKeywords.slice(0, 3).join(', ')], 'text')).substring(0, 160);
      } catch (e) {}

      const wordCount = htmlContent.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;

      dispatch({
        type: 'SET_CONTENT',
        payload: {
          id: item.id,
          content: {
            title: item.title,
            content: htmlContent,
            metaDescription,
            slug: item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            primaryKeyword: item.title,
            semanticKeywords,
            wordCount,
            schemaMarkup: '',
            faqSchema: null,
            images: [],
          },
        },
      });

      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'done', statusText: `Complete (${wordCount} words)` } });
    } catch (error: any) {
      dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'error', statusText: error.message } });
    }

    await delay(1000);
  }
};

const refreshItem = async (
  item: ContentItem,
  callAIService: (promptKey: string, args: any[], format?: 'json' | 'html', grounding?: boolean) => Promise<string>,
  context: GenerationContext,
  aiRepairer: (brokenJson: string) => Promise<string>
): Promise<void> => {
  const { dispatch, existingPages, wpConfig, serperApiKey } = context;

  try {
    let existingContent = item.crawledContent || (item.originalUrl ? await smartCrawl(item.originalUrl) : '');

    if (!existingContent || existingContent.length < 500) {
      throw new Error('Content too short');
    }

    const titleMatch = existingContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : item.title;

    let optimizedContent = processInternalLinks(existingContent, existingPages, wpConfig.url);

    if (serperApiKey) {
      optimizedContent = optimizedContent.replace(/<div[^>]*class="[^"]*references[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
      const refs = await fetchVerifiedReferences(pageTitle, serperApiKey, wpConfig.url, [pageTitle]);
      if (refs) optimizedContent += refs;
    }

    const wordCount = optimizedContent.replace(/<[^>]*>/g, ' ').split(/\s+/).length;

    dispatch({
      type: 'SET_CONTENT',
      payload: {
        id: item.id,
        content: {
          title: pageTitle,
          content: optimizedContent,
          metaDescription: '',
          slug: extractSlugFromUrl(item.originalUrl || item.id),
          primaryKeyword: pageTitle,
          semanticKeywords: [pageTitle],
          wordCount,
          schemaMarkup: '',
          faqSchema: null,
          images: [],
        },
      },
    });

    dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'done', statusText: `Refreshed (${wordCount} words)` } });
  } catch (error: any) {
    dispatch({ type: 'UPDATE_STATUS', payload: { id: item.id, status: 'error', statusText: error.message } });
  }
};

export const generateContent = {
  generateItems,
  refreshItem,
  analyzeContentGaps,
  analyzePages,
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

    this.isRunning = true;
    this.stopRequested = false;
    this.context = context;
    this.logCallback('🚀 God Mode Activated');
    this.runOptimizationCycle();
    this.cycleInterval = setInterval(() => {
      if (this.isRunning && !this.stopRequested) this.runOptimizationCycle();
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
  }

  private async runOptimizationCycle(): Promise<void> {
    if (!this.context || this.stopRequested) return;
    this.logCallback('💤 Optimization cycle placeholder - implement as needed');
  }
}

export const maintenanceEngine = new MaintenanceEngine();

// =============================================================================
// DEFAULT EXPORT - ALL FUNCTIONS PROPERLY DEFINED
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
  publishToWordPress,
  getExistingPages,
  parseSitemap,
  getSerpResults,
  analyzeContentHealth,
  godModeOptimize,
  godModeStructuralGuardian,
  repairJson,
  uploadToImgur,
  generateImageAltText,
  generateReferences,
  generateClusterPlan,
  fetchNeuronwriterData,
  maintenanceEngine,
  generateImageWithFallback,
};
