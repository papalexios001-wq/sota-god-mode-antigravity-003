// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - PROMPT SUITE v15.0
// =============================================================================
// 🎯 AEO (Answer Engine Optimization) + GEO (Generative Engine Optimization)
// 🎯 Alex Hormozi x Tim Ferriss Writing Style
// 🎯 STRICT 4-7 Word Contextual Rich Anchor Text
// 🎯 15 Uncovered Entity Gap Analysis
// =============================================================================

export interface PromptTemplate {
  systemInstruction: string;
  userPrompt: (...args: any[]) => string;
}

export interface BuildPromptResult {
  systemInstruction: string;
  userPrompt: string;
  system: string;
  user: string;
}

export interface ExistingPage {
  title: string;
  slug: string;
}

export interface ImageContext {
  src: string;
  context: string;
  currentAlt?: string;
}

export interface SerpDataItem {
  title: string;
  snippet?: string;
  link?: string;
}

// =============================================================================
// SOTA SAFE ARRAY UTILITIES - ENTERPRISE GRADE RUNTIME PROTECTION
// =============================================================================
// These utilities prevent "t?.slice(...).join is not a function" errors
// by ensuring array operations only execute on actual arrays.

/**
 * Safely converts any value to an array. Returns empty array if not an array.
 */
function toSafeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Safely slice and join an array with fallback.
 * Handles cases where value might be string, object, undefined, or null.
 */
function safeSliceJoin(
  arr: unknown,
  start: number,
  end: number,
  separator: string = ", ",
  fallback: string = "None"
): string {
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  const result = arr.slice(start, end).join(separator);
  return result || fallback;
}

/**
 * Safely slice, map, and join an array with fallback.
 */
function safeSliceMapJoin<T>(
  arr: unknown,
  start: number,
  end: number,
  mapFn: (item: T) => string,
  separator: string = ", ",
  fallback: string = "None"
): string {
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  const result = arr.slice(start, end).map(mapFn).join(separator);
  return result || fallback;
}

/**
 * Safely join an array with fallback.
 */
function safeJoin(
  arr: unknown,
  separator: string = ", ",
  fallback: string = ""
): string {
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  return arr.join(separator) || fallback;
}

// ==================== BANNED AI PHRASES ====================
export const BANNED_AI_PHRASES: string[] = [
  "delve", "delving", "tapestry", "rich tapestry", "landscape", "digital landscape",
  "realm", "in the realm of", "testament", "symphony", "beacon", "paradigm",
  "synergy", "leverage", "utilize", "facilitate", "endeavor", "comprehensive",
  "robust", "holistic", "cutting-edge", "game-changer", "unlock", "unleash",
  "harness", "empower", "revolutionize", "streamline", "optimize", "maximize",
  "seamless", "innovative", "groundbreaking", "pivotal", "paramount", "transformative",
  "in this article", "in this guide", "in this post", "needless to say",
  "at the end of the day", "when it comes to", "in order to", "a wide range of",
  "it is important to", "it should be noted", "as we all know", "without further ado",
  "basically", "essentially", "actually", "literally", "honestly", "obviously",
  "undoubtedly", "certainly", "definitely", "absolutely", "extremely", "incredibly",
  "foster", "navigate", "embark", "spearhead", "bolster", "myriad", "plethora",
  "multifaceted", "nuanced", "meticulous", "firstly", "secondly", "furthermore",
  "moreover", "consequently", "nevertheless", "hence", "thus", "therefore",
  "in conclusion", "to summarize", "all in all", "last but not least"
];

// ==================== HORMOZI + FERRISS WRITING STYLE (ENHANCED) ====================
export const HORMOZI_FERRISS_STYLE = `
═══════════════════════════════════════════════════════════════════════════════
WRITING STYLE: ALEX HORMOZI + TIM FERRISS HYBRID (SOTA v15.0)
═══════════════════════════════════════════════════════════════════════════════

⚡ HORMOZI RULES ($100M Offers Style):
- Short punchy sentences. Max 15 words.
- Numbers EVERYWHERE. "73% of users" not "most users".
- Bold claims backed by data.
- Use "you" constantly. Direct address.
- One-word paragraphs for impact. "Done."

⚡ FERRISS RULES (4-Hour Workweek Style):
- Specific over vague: "5 sets of 5 reps at 185lbs"
- Real examples with names and dates
- 80/20 focus on what matters most

⚡ FORBIDDEN (INSTANT FAIL):
- Passive voice
- Hedge words (might, could, perhaps)
- AI tells (delve, tapestry, landscape, testament, realm)
`;

// ==================== AEO/GEO OPTIMIZATION RULES ====================
export const AEO_GEO_RULES = `
🎯 AEO (Answer Engine Optimization) - FOR AI ASSISTANTS
1. DIRECT ANSWER FIRST: Answer the main question in the FIRST 50 words
2. CONVERSATIONAL Q&A BLOCKS: Include "What is [X]?" sections
3. ENTITY DENSITY: Name specific brands, tools, people, dates
`;

// ==================== INTERNAL LINKING RULES ====================
export const INTERNAL_LINKING_RULES = `
🔗 INTERNAL LINKING - STRICT 4-7 WORD CONTEXTUAL ANCHORS (8-15 LINKS)
MANDATORY: EXACTLY 4-7 words per anchor
FORMAT: [LINK_CANDIDATE: exactly four to seven descriptive words here]
`;

// ==================== VISUAL HTML COMPONENTS ====================
export const SOTA_HTML_COMPONENTS = `
📊 VISUAL HTML COMPONENTS v16.0 - USE 12-18 PER ARTICLE
Output ONLY HTML. NEVER use markdown tables.
`;

// ==================== GAP ANALYSIS PROMPT ====================
export const SOTA_GAP_ANALYSIS_PROMPT = `
BLUE OCEAN GAP ANALYSIS - SEMANTIC ENTITY EXTRACTION (15 UNCOVERED ENTITIES)
Return EXACTLY 15 uncovered keywords/entities, prioritized by ranking potential.
`;

// ==================== CORE PROMPT TEMPLATES ====================
const CORE_TEMPLATES: Record<string, PromptTemplate> = {
  // ==================== CONTENT STRATEGY GENERATOR ====================
  content_strategy_generator: {
    systemInstruction: `You are a content strategy expert. Output ONLY compact JSON.`,
    userPrompt: (topic: string = "", semanticKeywords: unknown = [], serpData: unknown = [], contentType: string = "article"): string => {
      const keywords = safeSliceJoin(semanticKeywords, 0, 10, ", ", "None");
      return `TOPIC: ${topic || "General"}\nTYPE: ${contentType}\nKEYWORDS: ${keywords}\n\nOutput COMPACT JSON strategy.`;
    }
  },

  // ==================== SEMANTIC KEYWORD GENERATOR ====================
  semantic_keyword_generator: {
    systemInstruction: `Generate semantic keywords. Output ONLY valid JSON.`,
    userPrompt: (primaryKeyword: string = ""): string => {
      return `PRIMARY: ${primaryKeyword}\n\nOutput JSON: {"semanticKeywords":[...]} with 25-35 keywords.`;
    }
  },

  // ==================== SOTA GAP ANALYSIS ====================
  sota_gap_analysis: {
    systemInstruction: SOTA_GAP_ANALYSIS_PROMPT,
    userPrompt: (primaryKeyword: string = "", serpContent: string = "", existingPages: string = ""): string => {
      return `PRIMARY KEYWORD: ${primaryKeyword}\nTOP 3 SERP CONTENT: ${serpContent || "Not provided"}\nEXISTING SITE PAGES: ${existingPages || "Not provided"}\nTASK: Identify EXACTLY 15 uncovered keywords/entities. Output valid JSON.`;
    }
  },

  // ==================== ULTRA SOTA ARTICLE WRITER ====================
  ultra_sota_article_writer: {
    systemInstruction: `You are an elite SEO content writer.\n${HORMOZI_FERRISS_STYLE}\n${AEO_GEO_RULES}\n${SOTA_HTML_COMPONENTS}\n${INTERNAL_LINKING_RULES}\nBANNED: ${BANNED_AI_PHRASES.slice(0, 25).join(", ")}`,
    userPrompt: (
      articlePlan: string = "",
      semanticKeywords: unknown = [],
      strategy: any = {},
      existingPages: unknown = [],
      competitorGaps: unknown = [],
      geoLocation: string | null = null,
      neuronData: string | null = null
    ): string => {
      const keywords = safeSliceJoin(semanticKeywords, 0, 25, ", ", "None");
      const gaps = safeSliceJoin(competitorGaps, 0, 15, "; ", "None");
      const pages = safeSliceMapJoin<ExistingPage>(existingPages, 0, 15, (p) => p?.title || "", ", ", "None");
      const geo = geoLocation ? `\nGEO-TARGET: ${geoLocation}` : "";
      const neuron = neuronData ? `\nNLP TERMS: ${String(neuronData).substring(0, 300)}` : "";
      return `WRITE ARTICLE:\nTOPIC: ${articlePlan || "Comprehensive guide"}\nAUDIENCE: ${strategy?.targetAudience || "General"}${geo}${neuron}\nKEYWORDS: ${keywords}\nGAPS: ${gaps}\nLINK TARGETS: ${pages}\n\nOutput: Clean HTML only. 2500-3200 words.`;
    }
  },

  // ==================== GOD MODE STRUCTURAL GUARDIAN ====================
  god_mode_structural_guardian: {
    systemInstruction: `You refine content while PRESERVING structure.\nBANNED: ${BANNED_AI_PHRASES.slice(0, 20).join(", ")}`,
    userPrompt: (htmlFragment: string = "", semanticKeywords: unknown = [], topic: string = ""): string => {
      const keywords = safeSliceJoin(semanticKeywords, 0, 12, ", ", "None");
      const html = String(htmlFragment || "").substring(0, 12000);
      return `REFINE:\nTOPIC: ${topic}\nKEYWORDS: ${keywords}\nHTML:\n${html}\n\nOutput refined HTML.`;
    }
  },

  // ==================== GOD MODE AUTONOMOUS AGENT ====================
  god_mode_autonomous_agent: {
    systemInstruction: `You optimize existing content.\n${HORMOZI_FERRISS_STYLE}\n${INTERNAL_LINKING_RULES}\nBANNED: ${BANNED_AI_PHRASES.slice(0, 20).join(", ")}`,
    userPrompt: (existingContent: string = "", semanticKeywords: unknown = [], existingPages: unknown = [], topic: string = ""): string => {
      const keywords = safeSliceJoin(semanticKeywords, 0, 20, ", ", "None");
      const pages = safeSliceMapJoin<ExistingPage>(existingPages, 0, 10, (p) => p?.title || "", ", ", "None");
      const content = String(existingContent || "No content").substring(0, 40000);
      return `OPTIMIZE:\nTOPIC: ${topic || "Extract from content"}\nKEYWORDS: ${keywords}\nLINK TARGETS: ${pages}\nCONTENT:\n${content}\n\nOutput: Full optimized HTML.`;
    }
  },

  // ==================== SOTA FAQ GENERATOR ====================
  sota_faq_generator: {
    systemInstruction: `Generate FAQ optimized for Featured Snippets. 8 questions with 40-60 word answers.`,
    userPrompt: (topic: string = "", semanticKeywords: unknown = []): string => {
      const keywords = safeSliceJoin(semanticKeywords, 0, 10, ", ", "None");
      return `GENERATE FAQ (8 questions):\nTOPIC: ${topic}\nKEYWORDS: ${keywords}\n\nOutput FAQ HTML.`;
    }
  },

  // ==================== SOTA TAKEAWAYS GENERATOR ====================
  sota_takeaways_generator: {
    systemInstruction: `Extract KEY TAKEAWAYS. EXACTLY 8 items with numbers/stats.`,
    userPrompt: (topic: string = "", content: string = ""): string => {
      const text = String(content || "").substring(0, 4000);
      return `EXTRACT TAKEAWAYS:\nTOPIC: ${topic}\nCONTENT: ${text}\n\nOutput Key Takeaways HTML box.`;
    }
  },

  // ==================== SEO METADATA GENERATOR ====================
  seo_metadata_generator: {
    systemInstruction: `Generate SEO metadata. Output ONLY JSON: {"seoTitle":"50-60 chars","metaDescription":"135-150 chars","slug":"url-slug"}`,
    userPrompt: (primaryKeyword: string = "", contentSummary: string = "", targetAudience: string = "", competitorTitles: unknown = [], location: string | null = null): string => {
      const summary = String(contentSummary || "").substring(0, 300);
      const geo = location ? ` [GEO: ${location}]` : "";
      return `KEYWORD: ${primaryKeyword}${geo}\nSUMMARY: ${summary}\n\nOutput JSON: {"seoTitle":"...","metaDescription":"...","slug":"..."}`;   
    }
  },

  // ==================== COMPETITOR GAP ANALYZER ====================
  competitor_gap_analyzer: {
    systemInstruction: `Identify content gaps. Output COMPACT JSON with EXACTLY 15 gaps.`,
    userPrompt: (topic: string = "", competitorContent: unknown = [], existingTitles: string = ""): string => {
      return `TOPIC: ${topic}\n\nOutput JSON with EXACTLY 15 gap opportunities.`;
    }
  },

  // ==================== HEALTH ANALYZER ====================
  health_analyzer: {
    systemInstruction: `Analyze content health. Output COMPACT JSON.`,
    userPrompt: (url: string = "", content: string = "", targetKeyword: string = ""): string => {
      const text = String(content || "").substring(0, 6000);
      return `URL: ${url}\nKEYWORD: ${targetKeyword}\nCONTENT: ${text}\n\nOutput JSON health analysis.`;
    }
  },

  // ==================== DOM CONTENT POLISHER ====================
  dom_content_polisher: {
    systemInstruction: `Enhance text while PRESERVING HTML structure.\nBANNED: ${BANNED_AI_PHRASES.slice(0, 15).join(", ")}`,
    userPrompt: (htmlFragment: string = "", semanticKeywords: unknown = [], topic: string = ""): string => {
      const keywords = safeSliceJoin(semanticKeywords, 0, 10, ", ", "None");
      const html = String(htmlFragment || "<p>No content</p>").substring(0, 10000);
      return `POLISH:\nTOPIC: ${topic || "General"}\nKEYWORDS: ${keywords}\nHTML:\n${html}\n\nKeep ALL HTML tags.`;
    }
  },

  // ==================== GOD MODE ULTRA INSTINCT ====================
  god_mode_ultra_instinct: {
    systemInstruction: `Transmute content to highest quality. Update dates to 2026.\nBANNED: ${BANNED_AI_PHRASES.slice(0, 20).join(", ")}`,
    userPrompt: (htmlFragment: string = "", semanticKeywords: unknown = [], topic: string = ""): string => {
      const keywords = safeSliceJoin(semanticKeywords, 0, 15, ", ", "None");
      const html = String(htmlFragment || "").substring(0, 10000);
      return `TRANSMUTE:\nTOPIC: ${topic}\nKEYWORDS: ${keywords}\nHTML:\n${html}\n\nOutput enhanced HTML.`;
    }
  },

  // ==================== INTRO/CONCLUSION GENERATORS ====================
  sota_intro_generator: {
    systemInstruction: `Write hook introductions. Start with surprising stat. Max 200 words.`,
    userPrompt: (topic: string = "", primaryKeyword: string = "", targetAudience: string = "", uniqueAngle: string = ""): string => {
      return `WRITE INTRO:\nTopic: ${topic}\nKeyword: ${primaryKeyword}\nAudience: ${targetAudience || "General"}\n\nOutput 100-200 word HTML intro.`;
    }
  },

  sota_conclusion_generator: {
    systemInstruction: `Write conclusions that drive action. 150-200 words max.`,
    userPrompt: (topic: string = "", keyPoints: unknown = [], cta: string = ""): string => {
      const points = safeJoin(keyPoints, "; ", "Extract from content");
      return `WRITE CONCLUSION:\nTopic: ${topic}\nKey Points: ${points}\nCTA: ${cta || "Start today"}\n\nOutput 150-200 word HTML conclusion.`;
    }
  },

  // ==================== ADDITIONAL TEMPLATES ====================
  cluster_planner: {
    systemInstruction: `Create content cluster plans. Output COMPACT JSON.`,
    userPrompt: (topic: string = ""): string => {
      return `TOPIC: ${topic}\n\nOutput JSON cluster plan with 1 pillar + 8-10 cluster pages.`;
    }
  },

  generate_internal_links: {
    systemInstruction: `Suggest internal links with 4-7 word anchors. Output JSON array.`,
    userPrompt: (content: string = "", existingPages: unknown = []): string => {
      const text = String(content || "").substring(0, 5000);
      const pages = safeSliceMapJoin<ExistingPage>(existingPages, 0, 15, (p) => `${p?.title || ""} (/${p?.slug || ""})`, "; ", "None");
      return `CONTENT: ${text}\nPAGES: ${pages}\n\nOutput JSON array with 8-15 link suggestions.`;
    }
  },

  reference_generator: {
    systemInstruction: `Generate authoritative references. Prefer .gov, .edu.`,
    userPrompt: (topic: string = ""): string => {
      return `TOPIC: ${topic}\n\nOutput reference section HTML with 6-8 sources.`;
    }
  },

  sota_image_alt_optimizer: {
    systemInstruction: `Write SEO alt text. Output JSON array.`,
    userPrompt: (images: unknown = [], primaryKeyword: string = ""): string => {
      const imgList = safeSliceMapJoin<ImageContext>(images, 0, 10, (img, i) => `${i + 1}. ${img?.context || ""}`, "; ", "None");
      return `KEYWORD: ${primaryKeyword}\nIMAGES: ${imgList}\n\nOutput JSON array.`;
    }
  },

  json_repair: {
    systemInstruction: `Repair malformed JSON. Return ONLY valid JSON.`,
    userPrompt: (brokenJson: string = ""): string => {
      return `FIX:\n${String(brokenJson || "{}").substring(0, 3000)}`;
    }
  },

  schema_generator: {
    systemInstruction: `Generate valid JSON-LD schema. Output ONLY schema JSON.`,
    userPrompt: (contentType: string = "", data: any = {}): string => {
      return `TYPE: ${contentType || "Article"}\nDATA: ${JSON.stringify(data).substring(0, 500)}\n\nOutput JSON-LD schema.`;
    }
  }
};

// ==================== CREATE ALIASES ====================
const createAliases = (templates: Record<string, PromptTemplate>): Record<string, PromptTemplate> => {
  const result: Record<string, PromptTemplate> = { ...templates };
  const aliasMap: Record<string, string> = {
    "contentstrategygenerator": "content_strategy_generator",
    "ultrasotaarticlewriter": "ultra_sota_article_writer",
    "godmodeautonomousagent": "god_mode_autonomous_agent",
    "domcontentpolisher": "dom_content_polisher",
    "godmodestructuralguardian": "god_mode_structural_guardian",
    "godmodeultrainstinct": "god_mode_ultra_instinct",
    "sotaintrogenerator": "sota_intro_generator",
    "sotatakeawaysgenerator": "sota_takeaways_generator",
    "sotafaqgenerator": "sota_faq_generator",
    "sotaconclusiongenerator": "sota_conclusion_generator",
    "semantickeywordgenerator": "semantic_keyword_generator",
    "competitorgapanalyzer": "competitor_gap_analyzer",
    "seometadatagenerator": "seo_metadata_generator",
    "healthanalyzer": "health_analyzer",
    "clusterplanner": "cluster_planner",
    "generateinternallinks": "generate_internal_links",
    "referencegenerator": "reference_generator",
    "sotaimagealtoptimizer": "sota_image_alt_optimizer",
    "jsonrepair": "json_repair",
    "schemagenerator": "schema_generator",
    "sotagapanalysis": "sota_gap_analysis",
    "gapanalysis": "sota_gap_analysis",
  };
  for (const [alias, original] of Object.entries(aliasMap)) {
    if (templates[original]) result[alias] = templates[original];
  }
  return result;
};

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = createAliases(CORE_TEMPLATES);

// ==================== BUILD PROMPT ====================
export function buildPrompt(promptKey: keyof typeof PROMPT_TEMPLATES | string, args: any[] = []): BuildPromptResult {
  const template = PROMPT_TEMPLATES[promptKey as keyof typeof PROMPT_TEMPLATES];
  if (!template) {
    console.error(`[buildPrompt] Unknown: "${promptKey}".`);
    return {
      systemInstruction: "You are a helpful assistant.",
      userPrompt: String(args[0] || ""),
      system: "You are a helpful assistant.",
      user: String(args[0] || "")
    };
  }
  try {
    const systemInstruction = template.systemInstruction;
    const userPrompt = template.userPrompt(...args);
    return { systemInstruction, userPrompt, system: systemInstruction, user: userPrompt };
  } catch (error) {
    console.error("[buildPrompt] Error:", error);
    return {
      systemInstruction: template.systemInstruction || "You are a helpful assistant.",
      userPrompt: String(args[0] || ""),
      system: template.systemInstruction || "You are a helpful assistant.",
      user: String(args[0] || "")
    };
  }
}

// ==================== CONSTANTS & UTILITIES ====================
export const PROMPT_CONSTANTS = {
  BANNED_PHRASES: BANNED_AI_PHRASES,
  MAX_TOKENS: 8192,
  TEMPERATURE: 0.7,
  TARGET_YEAR: 2026,
  MIN_WORD_COUNT: 2500,
  MAX_WORD_COUNT: 3200,
  INTERNAL_LINKS_MIN: 8,
  INTERNAL_LINKS_MAX: 15,
};

export function containsBannedPhrase(text: string): { contains: boolean; phrases: string[] } {
  const lowerText = text.toLowerCase();
  const foundPhrases = BANNED_AI_PHRASES.filter(phrase => lowerText.includes(phrase.toLowerCase()));
  return { contains: foundPhrases.length > 0, phrases: foundPhrases };
}

export function getAvailablePromptKeys(): string[] {
  return Object.keys(PROMPT_TEMPLATES);
}

export function isValidPromptKey(key: string): key is keyof typeof PROMPT_TEMPLATES {
  return key in PROMPT_TEMPLATES;
}

// ==================== DEFAULT EXPORT ====================
export default {
  PROMPT_TEMPLATES,
  buildPrompt,
  BANNED_AI_PHRASES,
  SOTA_HTML_COMPONENTS,
  HORMOZI_FERRISS_STYLE,
  AEO_GEO_RULES,
  INTERNAL_LINKING_RULES,
  SOTA_GAP_ANALYSIS_PROMPT,
  PROMPT_CONSTANTS,
  containsBannedPhrase,
  getAvailablePromptKeys,
  isValidPromptKey,
  // Safe utilities for external use
  toSafeArray,
  safeSliceJoin,
  safeSliceMapJoin,
  safeJoin,
};
