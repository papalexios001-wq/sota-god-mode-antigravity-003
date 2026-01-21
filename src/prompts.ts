// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - PROMPT SUITE v12.1
// =============================================================================
// CRITICAL: All template keys support both snake_case AND camelCase for compatibility

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

// ==================== BANNED AI PHRASES ====================
export const BANNED_AI_PHRASES: string[] = [
  "delve", "delving", "delved",
  "tapestry", "rich tapestry",
  "landscape", "digital landscape", "ever-evolving landscape",
  "realm", "in the realm of",
  "testament", "stands as a testament",
  "symphony", "a symphony of",
  "beacon", "serves as a beacon",
  "crucible", "in the crucible of",
  "paradigm", "paradigm shift",
  "synergy", "synergistic",
  "leverage", "leveraging", "leveraged",
  "utilize", "utilizing", "utilized", "utilization",
  "facilitate", "facilitating", "facilitation",
  "endeavor", "endeavors", "endeavoring",
  "comprehensive", "comprehensively",
  "robust", "robustly", "robustness",
  "holistic", "holistically",
  "cutting-edge", "bleeding-edge",
  "game-changer", "game-changing",
  "unlock", "unlocking", "unlocks",
  "unleash", "unleashing", "unleashed",
  "harness", "harnessing", "harnessed",
  "empower", "empowering", "empowerment",
  "revolutionize", "revolutionizing", "revolutionary",
  "streamline", "streamlining", "streamlined",
  "optimize", "optimizing", "optimization",
  "maximize", "maximizing", "maximization",
  "seamless", "seamlessly",
  "innovative", "innovation", "innovating",
  "groundbreaking", "ground-breaking",
  "pivotal", "pivotally",
  "paramount", "of paramount importance",
  "indispensable",
  "transformative", "transformation",
  "dynamic", "dynamically",
  "in this article",
  "in this guide",
  "in this post",
  "needless to say",
  "at the end of the day",
  "when it comes to",
  "in order to",
  "due to the fact that",
  "for the purpose of",
  "in the event that",
  "a wide range of",
  "a variety of",
  "a number of",
  "the fact that",
  "it is important to",
  "it should be noted",
  "as mentioned above",
  "as previously stated",
  "as we all know",
  "without further ado",
  "basically", "essentially", "actually", "literally",
  "honestly", "frankly", "obviously", "clearly",
  "undoubtedly", "certainly", "definitely", "absolutely",
  "extremely", "incredibly", "remarkably", "very",
  "really", "quite", "rather", "somewhat",
  "fairly", "pretty much",
  "foster", "fostering", "fostered",
  "navigate", "navigating", "navigation",
  "embark", "embarking", "embarked",
  "spearhead", "spearheading",
  "bolster", "bolstering", "bolstered",
  "underpin", "underpinning",
  "myriad", "myriad of",
  "plethora", "plethora of",
  "multifaceted",
  "nuanced", "nuances",
  "intricate", "intricacies",
  "meticulous", "meticulously",
  "discern", "discerning",
  "elucidate", "elucidating",
  "underscore", "underscoring",
  "firstly", "secondly", "thirdly",
  "furthermore", "moreover", "additionally",
  "consequently", "subsequently",
  "nevertheless", "nonetheless",
  "hence", "thus", "therefore",
  "in conclusion", "to conclude",
  "in summary", "to summarize",
  "all in all", "overall",
  "last but not least"
];

// ==================== WRITING STYLE ====================
export const HORMOZI_FERRISS_STYLE = `
WRITING STYLE: ALEX HORMOZI + TIM FERRISS HYBRID

FROM ALEX HORMOZI:
1. Short punchy sentences. Max 15 words average.
2. Numbers everywhere. 73% not most people.
3. Bold claims backed by data. No hedging.
4. Direct address. Use you constantly.
5. Framework obsession. Numbered lists, systems.
6. Zero fluff. Every word earns its place.
7. Pattern interrupts. One-word paragraphs.

FROM TIM FERRISS:
1. Specific over vague. 5 sets of 5 reps at 85% 1RM.
2. Mini case studies. Real examples with names, dates, numbers.
3. Contrarian insights. Challenge conventional wisdom.
4. Tools and resources. Name specific products.
5. 80/20 focus. The vital few that drive results.
6. Actionable next steps. Reader knows exactly what to do.

SENTENCE RULES:
- Vary length: 3 words. Then 25 words. Then 8 words.
- Start with: But. And. Look. The data says.
- Use fragments: Game over. Not even close.
- Questions: So what happened? Traffic jumped 340%.

PARAGRAPH RULES:
- Max 3 sentences per paragraph (usually 1-2)
- One idea per paragraph
- White space is your friend
`;

// ==================== HTML COMPONENTS ====================
export const SOTA_HTML_COMPONENTS = `
VISUAL HTML COMPONENTS (Use 8-12 per article):

1. KEY TAKEAWAYS BOX:
<div style="background: linear-gradient(145deg, #064E3B 0%, #047857 100%); border-radius: 16px; padding: 2rem; margin: 2.5rem 0;">
  <h3 style="color: #ECFDF5; margin: 0 0 1.5rem 0; font-size: 1.3rem;">Key Takeaways</h3>
  <ul style="color: #D1FAE5; margin: 0; padding-left: 1.25rem; line-height: 2;">
    <li><strong>[Takeaway 1]</strong></li>
    <li><strong>[Takeaway 2]</strong></li>
    <li><strong>[Takeaway 3]</strong></li>
  </ul>
</div>

2. PRO TIP BOX:
<div style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border-left: 5px solid #F59E0B; border-radius: 0 12px 12px 0; padding: 1.5rem; margin: 2rem 0;">
  <strong style="color: #92400E; display: block; margin-bottom: 0.5rem;">PRO TIP</strong>
  <p style="color: #78350F; margin: 0; line-height: 1.6;">[Tip content]</p>
</div>

3. WARNING BOX:
<div style="background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%); border-left: 5px solid #EF4444; border-radius: 0 12px 12px 0; padding: 1.5rem; margin: 2rem 0;">
  <strong style="color: #991B1B; display: block; margin-bottom: 0.5rem;">WARNING</strong>
  <p style="color: #7F1D1D; margin: 0; line-height: 1.6;">[Warning content]</p>
</div>

4. COMPARISON TABLE:
<div style="margin: 2.5rem 0; border-radius: 16px; overflow: hidden;">
  <table style="width: 100%; border-collapse: collapse; background: white;">
    <thead>
      <tr style="background: linear-gradient(135deg, #1E40AF 0%, #7C3AED 100%);">
        <th style="padding: 1.25rem; color: white; text-align: left;">Feature</th>
        <th style="padding: 1.25rem; color: white; text-align: center;">Option A</th>
        <th style="padding: 1.25rem; color: white; text-align: center;">Option B</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 1rem;">[Criterion]</td>
        <td style="padding: 1rem; text-align: center;">[Value]</td>
        <td style="padding: 1rem; text-align: center;">[Value]</td>
      </tr>
    </tbody>
  </table>
</div>

5. FAQ SECTION:
<div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 16px; padding: 2rem; margin: 2.5rem 0;">
  <h3 style="color: #111827; margin: 0 0 1.5rem 0;">Frequently Asked Questions</h3>
  <details style="background: white; border-radius: 12px; margin-bottom: 0.75rem; border: 1px solid #E5E7EB;">
    <summary style="padding: 1.25rem; cursor: pointer; font-weight: 600;">[Question]?</summary>
    <div style="padding: 0 1.25rem 1.25rem; color: #4B5563;">[Answer]</div>
  </details>
</div>
`;

// ==================== INTERNAL LINKING ====================
export const INTERNAL_LINKING_RULES = `
INTERNAL LINKING (8-15 LINKS):

ANCHOR TEXT RULES:
- 3-7 words, descriptive
- NO click here, read more, learn more
- Format: [LINK_CANDIDATE: descriptive anchor text]

DISTRIBUTION:
- 2-3 links in intro
- 4-6 links in body
- 2-3 links in FAQ
- 1-2 links in conclusion
`;

// ==================== CORE PROMPT TEMPLATES ====================
const CORE_TEMPLATES: Record<string, PromptTemplate> = {

  // ==================== CONTENT STRATEGY GENERATOR (NEW) ====================
  content_strategy_generator: {
    systemInstruction: `You are a content strategy expert. Analyze the topic and create a comprehensive content strategy.

OUTPUT FORMAT (JSON):
{
  "targetAudience": "Primary audience description",
  "searchIntent": "informational|transactional|navigational|commercial",
  "contentAngle": "Unique angle for this content",
  "competitorAnalysis": "Brief analysis of competition",
  "keyMessages": ["Message 1", "Message 2", "Message 3"],
  "contentStructure": {
    "introduction": "Hook strategy",
    "mainSections": ["Section 1", "Section 2", "Section 3"],
    "conclusion": "CTA strategy"
  },
  "differentiators": ["What makes this content unique"],
  "estimatedWordCount": 2500
}`,

    userPrompt: (
      topic: string = "",
      semanticKeywords: string[] = [],
      serpData: unknown[] = [],
      contentType: string = "article"
    ): string => {
      const keywords = semanticKeywords?.slice(0, 20).join(", ") || "None";
      const serp = Array.isArray(serpData) 
        ? serpData.slice(0, 5).map((s: any) => s?.title || "").filter(Boolean).join("; ") 
        : "None";
      
      return `CREATE CONTENT STRATEGY:

TOPIC: ${topic || "General topic"}
TYPE: ${contentType}
KEYWORDS: ${keywords}
COMPETITOR TITLES: ${serp}

Analyze and output JSON strategy.`;
    }
  },

  // ==================== ULTRA SOTA ARTICLE WRITER ====================
  ultra_sota_article_writer: {
    systemInstruction: `You are an elite SEO content writer using Alex Hormozi + Tim Ferriss style.

${HORMOZI_FERRISS_STYLE}

${SOTA_HTML_COMPONENTS}

${INTERNAL_LINKING_RULES}

BANNED PHRASES: ${BANNED_AI_PHRASES.slice(0, 30).join(", ")}

OUTPUT: Clean HTML only. No markdown. 2500-3000 words.`,

    userPrompt: (
      articlePlan: string = "",
      semanticKeywords: string[] = [],
      strategy: any = {},
      existingPages: ExistingPage[] = [],
      competitorGaps: string[] = [],
      geoLocation: string | null = null,
      neuronData: string | null = null
    ): string => {
      const keywords = semanticKeywords?.slice(0, 40).join(", ") || "None";
      const gaps = competitorGaps?.slice(0, 5).join("; ") || "None";
      const pages = existingPages?.slice(0, 20).map(p => p.title).join(", ") || "None";
      const geo = geoLocation ? `\nGEO-TARGET: ${geoLocation}` : "";
      const neuron = neuronData ? `\nNLP TERMS: ${neuronData.substring(0, 500)}` : "";
      
      return `WRITE ARTICLE:

PLAN: ${articlePlan || "Comprehensive guide"}
TARGET AUDIENCE: ${strategy?.targetAudience || "General"}
SEARCH INTENT: ${strategy?.searchIntent || "Informational"}
CONTENT ANGLE: ${strategy?.contentAngle || "Comprehensive coverage"}${geo}${neuron}

KEYWORDS: ${keywords}

GAPS TO FILL: ${gaps}

LINK TARGETS: ${pages}

STRUCTURE:
1. Hook intro (no generic openers)
2. Key Takeaways box
3. Body sections with H2/H3 + visual components
4. FAQ section (5-7 questions)
5. Conclusion with CTA

REQUIREMENTS:
- 2500+ words
- 8-15 [LINK_CANDIDATE: anchor text] links
- 8+ visual HTML components
- Zero fluff

OUTPUT: HTML only.`;
    }
  },

  // ==================== GOD MODE AUTONOMOUS AGENT ====================
  god_mode_autonomous_agent: {
    systemInstruction: `You optimize existing content to enterprise quality.

${HORMOZI_FERRISS_STYLE}

PRESERVE: All images, videos, iframes, existing links
ENHANCE: Text quality, add visual components
INJECT: 8-12 [LINK_CANDIDATE: anchor text] links

BANNED PHRASES: ${BANNED_AI_PHRASES.slice(0, 20).join(", ")}`,

    userPrompt: (
      existingContent: string = "",
      semanticKeywords: string[] = [],
      existingPages: ExistingPage[] = [],
      topic: string = ""
    ): string => {
      const keywords = semanticKeywords?.slice(0, 25).join(", ") || "None";
      const pages = existingPages?.slice(0, 15).map(p => p.title).join(", ") || "None";
      const content = existingContent?.substring(0, 50000) || "No content";
      
      return `OPTIMIZE:

TOPIC: ${topic || "Extract from content"}
KEYWORDS: ${keywords}
LINK TARGETS: ${pages}

CONTENT:
${content}

TASKS:
1. Rewrite intro as hook
2. Add Key Takeaways if missing
3. Short punchy sentences
4. Add Pro Tip boxes (2-3)
5. Inject 8-12 internal links
6. Add FAQ if missing
7. PRESERVE all images/videos

OUTPUT: Full optimized HTML.`;
    }
  },

  // ==================== DOM CONTENT POLISHER ====================
  dom_content_polisher: {
    systemInstruction: `You enhance text while PRESERVING HTML structure.

RULES:
1. Only modify text between tags
2. Never remove HTML tags
3. Never remove links or images
4. Short punchy sentences
5. Add specific numbers
6. Vary sentence length

BANNED: ${BANNED_AI_PHRASES.slice(0, 15).join(", ")}`,

    userPrompt: (
      htmlFragment: string = "",
      semanticKeywords: string[] = [],
      topic: string = ""
    ): string => {
      const keywords = semanticKeywords?.slice(0, 10).join(", ") || "None";
      const html = htmlFragment?.substring(0, 12000) || "<p>No content</p>";
      
      return `POLISH:

TOPIC: ${topic || "General"}
KEYWORDS: ${keywords}

HTML:
${html}

Keep ALL HTML tags. Only improve text. Output polished HTML.`;
    }
  },

  // ==================== GOD MODE STRUCTURAL GUARDIAN ====================
  god_mode_structural_guardian: {
    systemInstruction: `You refine content while PRESERVING HTML structure.

STRUCTURAL RULES:
1. H2 stays H2. Never downgrade.
2. Lists stay lists. Never flatten.
3. Never merge paragraphs.
4. Keep all links intact.
5. Keep all images intact.

REFINEMENT:
- Update years to 2026
- Remove fluff phrases
- Add specific data
- Vary sentence length

BANNED: ${BANNED_AI_PHRASES.slice(0, 15).join(", ")}`,

    userPrompt: (
      htmlFragment: string = "",
      semanticKeywords: string[] = [],
      topic: string = ""
    ): string => {
      const keywords = Array.isArray(semanticKeywords) 
        ? semanticKeywords.slice(0, 15).join(", ") 
        : "None";
      const html = htmlFragment?.substring(0, 12000) || "";
      
      return `REFINE (preserve structure):

TOPIC: ${topic}
KEYWORDS: ${keywords}

HTML:
${html}

Output refined HTML with identical structure.`;
    }
  },

  // ==================== GOD MODE ULTRA INSTINCT ====================
  god_mode_ultra_instinct: {
    systemInstruction: `You transmute content to highest quality.

TRANSFORMATIONS:
1. Generic to specific with data
2. phone to iPhone 16 Pro
3. algorithm to Google RankBrain
4. Update dates to 2026
5. Mix sentence lengths

BANNED: ${BANNED_AI_PHRASES.slice(0, 20).join(", ")}`,

    userPrompt: (
      htmlFragment: string = "",
      semanticKeywords: string[] = [],
      topic: string = ""
    ): string => {
      const keywords = Array.isArray(semanticKeywords)
        ? semanticKeywords.slice(0, 20).join(", ")
        : "None";
      const html = htmlFragment?.substring(0, 12000) || "";
      
      return `TRANSMUTE:

TOPIC: ${topic}
KEYWORDS: ${keywords}

HTML:
${html}

Output transmuted HTML.`;
    }
  },

  // ==================== SOTA INTRO GENERATOR ====================
  sota_intro_generator: {
    systemInstruction: `You write hook introductions.

FORMULA:
1. Line 1: Surprising stat or bold claim
2. Line 2-3: Challenge conventional wisdom
3. Line 4-5: Promise specific value
4. Include at least ONE number
5. Max 200 words
6. Never start with generic openers`,

    userPrompt: (
      topic: string = "",
      primaryKeyword: string = "",
      targetAudience: string = "",
      uniqueAngle: string = ""
    ): string => {
      return `WRITE INTRO:

Topic: ${topic}
Keyword: ${primaryKeyword}
Audience: ${targetAudience || "General"}
Angle: ${uniqueAngle || "Comprehensive guide"}

Output 100-200 word HTML intro.`;
    }
  },

  // ==================== SOTA TAKEAWAYS GENERATOR ====================
  sota_takeaways_generator: {
    systemInstruction: `Extract KEY TAKEAWAYS from content.

Each must be:
- Specific (include numbers)
- Actionable
- Valuable`,

    userPrompt: (
      topic: string = "",
      content: string = ""
    ): string => {
      const text = content?.substring(0, 5000) || "";
      return `EXTRACT TAKEAWAYS:

Topic: ${topic}
Content: ${text}

Output Key Takeaways HTML box with 5-7 insights.`;
    }
  },

  // ==================== SOTA FAQ GENERATOR ====================
  sota_faq_generator: {
    systemInstruction: `Generate FAQ for Featured Snippets.

Each FAQ:
- Real question people ask
- Direct answer (40-60 words)
- Include number or fact`,

    userPrompt: (
      topic: string = "",
      semanticKeywords: string[] = []
    ): string => {
      const keywords = Array.isArray(semanticKeywords)
        ? semanticKeywords.slice(0, 15).join(", ")
        : "None";
      
      return `GENERATE FAQ:

Topic: ${topic}
Keywords: ${keywords}

Output FAQ HTML with 5-7 questions.`;
    }
  },

  // ==================== SOTA CONCLUSION GENERATOR ====================
  sota_conclusion_generator: {
    systemInstruction: `Write conclusions that drive action.

Structure:
1. Recap 3 key points
2. ONE clear next step
3. Memorable closing
4. 150-200 words max`,

    userPrompt: (
      topic: string = "",
      keyPoints: string[] = [],
      cta: string = ""
    ): string => {
      const points = keyPoints?.join("; ") || "Extract from content";
      return `WRITE CONCLUSION:

Topic: ${topic}
Key Points: ${points}
CTA: ${cta || "Start implementing today"}

Output 150-200 word HTML conclusion.`;
    }
  },

  // ==================== SEMANTIC KEYWORD GENERATOR ====================
  semantic_keyword_generator: {
    systemInstruction: `Generate semantic keyword clusters.

OUTPUT FORMAT (JSON):
{
  "semanticKeywords": ["keyword1", "keyword2", ...]
}

Categories to include:
1. Primary Variations (5-10)
2. LSI Keywords (15-20)
3. Question Keywords (10-15)
4. Long-tail Keywords (15-20)

Total: 60-90 keywords in the array`,

    userPrompt: (
      primaryKeyword: string = "",
      topic: string = "",
      serpData: SerpDataItem[] = []
    ): string => {
      const serp = serpData?.slice(0, 3).map(d => d.title).join("; ") || "None";
      return `GENERATE KEYWORDS:

Primary: ${primaryKeyword}
Topic: ${topic || primaryKeyword}
SERP: ${serp}

Output JSON: { "semanticKeywords": [...] } with 60-90 keywords.`;
    }
  },

  // ==================== COMPETITOR GAP ANALYZER ====================
  competitor_gap_analyzer: {
    systemInstruction: `Identify content gaps competitors miss.

OUTPUT FORMAT (JSON):
{
  "gaps": [
    {
      "topic": "Gap topic",
      "reason": "Why valuable",
      "difficulty": 5,
      "contentType": "article|guide|listicle"
    }
  ]
}

Find 10-15 opportunities.`,

    userPrompt: (
      topic: string = "",
      competitorContent: unknown[] = [],
      existingTitles: string = ""
    ): string => {
      const competitors = Array.isArray(competitorContent)
        ? competitorContent.slice(0, 5).map((c: any) => c?.title || c).filter(Boolean).join("; ")
        : "None";
      return `FIND GAPS:

Topic: ${topic}
Competitors: ${competitors}
Our Content: ${existingTitles || "None"}

Output JSON: { "gaps": [...] } with 10-15 opportunities.`;
    }
  },

  // ==================== SEO METADATA GENERATOR ====================
  seo_metadata_generator: {
    systemInstruction: `Generate SEO metadata.

OUTPUT FORMAT (JSON):
{
  "seoTitle": "50-60 char title with keyword near start",
  "metaDescription": "140-155 char description with benefit",
  "slug": "lowercase-hyphenated-3-5-words"
}`,

    userPrompt: (
      primaryKeyword: string = "",
      contentSummary: string = "",
      targetAudience: string = "",
      competitorTitles: string[] = [],
      location: string | null = null
    ): string => {
      const summary = contentSummary?.substring(0, 500) || "";
      const geo = location ? `\nLocation: ${location}` : "";
      return `GENERATE METADATA:

Keyword: ${primaryKeyword}
Summary: ${summary}${geo}

Output JSON: { "seoTitle": "...", "metaDescription": "...", "slug": "..." }`;
    }
  },

  // ==================== CLUSTER PLANNER ====================
  cluster_planner: {
    systemInstruction: `Create content cluster plans.

Output:
1. ONE Pillar Page (3000+ words)
2. 8-12 Cluster Pages (2000+ words each)`,

    userPrompt: (
      topic: string = "",
      existingContent: string[] = [],
      businessContext: string = ""
    ): string => {
      const existing = existingContent?.slice(0, 10).join("; ") || "None";
      return `CREATE CLUSTER:

Topic: ${topic}
Context: ${businessContext || "Authority building"}
Existing: ${existing}

Output JSON: { pillarTitle, pillarKeyword, clusterPages: [{title, keyword, angle}] }`;
    }
  },

  // ==================== GENERATE INTERNAL LINKS ====================
  generate_internal_links: {
    systemInstruction: `Suggest internal links with rich anchor text.

Anchor: 3-7 words, descriptive
Never: click here, read more`,

    userPrompt: (
      content: string = "",
      existingPages: ExistingPage[] = []
    ): string => {
      const text = content?.substring(0, 6000) || "";
      const pages = existingPages?.slice(0, 20).map(p => p.title + " (/" + p.slug + ")").join("; ") || "None";
      
      return `SUGGEST LINKS:

Content: ${text}
Pages: ${pages}

Output JSON: [{ anchorText, targetSlug, contextSentence }]`;
    }
  },

  // ==================== REFERENCE GENERATOR ====================
  reference_generator: {
    systemInstruction: `Generate authoritative references.

Prefer: .gov, .edu, major publications
Recent: within 2 years`,

    userPrompt: (
      topic: string = "",
      claims: string[] = [],
      existingRefs: string[] = []
    ): string => {
      const claimList = claims?.slice(0, 5).join("; ") || "General coverage";
      return `GENERATE REFERENCES:

Topic: ${topic}
Claims: ${claimList}

Output reference section HTML with 8-12 sources.`;
    }
  },

  // ==================== HEALTH ANALYZER ====================
  health_analyzer: {
    systemInstruction: `Analyze content health comprehensively.

OUTPUT FORMAT (JSON):
{
  "healthScore": 75,
  "wordCount": 1500,
  "issues": [
    {"type": "seo", "issue": "Missing H2 tags", "fix": "Add 3-5 H2 headings"}
  ],
  "recommendations": ["Add more internal links", "Include FAQ section"],
  "critique": "Overall assessment of content quality",
  "strengths": ["Good keyword usage", "Clear structure"],
  "weaknesses": ["Thin content", "No schema markup"]
}

Score: 0-100 based on:
- Word count (target 2500+)
- Keyword optimization
- Readability
- Structure (H2/H3)
- Internal linking
- Schema presence`,

    userPrompt: (
      url: string = "",
      content: string = "",
      targetKeyword: string = ""
    ): string => {
      const text = content?.substring(0, 8000) || "";
      return `ANALYZE:

URL: ${url}
Keyword: ${targetKeyword}
Content: ${text}

Output JSON with healthScore, wordCount, issues array, recommendations array, critique, strengths, and weaknesses.`;
    }
  },

  // ==================== SOTA IMAGE ALT OPTIMIZER ====================
  sota_image_alt_optimizer: {
    systemInstruction: `Write SEO alt text.

Rules:
- Describe image accurately
- Include keyword naturally
- 80-125 characters
- No "image of" prefix`,

    userPrompt: (
      images: ImageContext[] = [],
      primaryKeyword: string = ""
    ): string => {
      const imgList = images?.map((img, i) => (i + 1) + ". " + img.context).join("; ") || "None";
      return `GENERATE ALT TEXT:

Keyword: ${primaryKeyword}
Images: ${imgList}

Output JSON: [{ index, altText }]`;
    }
  },

  // ==================== JSON REPAIR ====================
  json_repair: {
    systemInstruction: `Repair malformed JSON. Return ONLY valid JSON, nothing else.`,
    userPrompt: (brokenJson: string = ""): string => {
      const json = brokenJson?.substring(0, 5000) || "{}";
      return `FIX THIS JSON AND RETURN ONLY VALID JSON:

${json}`;
    }
  },

  // ==================== SCHEMA GENERATOR ====================
  schema_generator: {
    systemInstruction: `Generate valid JSON-LD schema markup for SEO.

Types: Article, FAQPage, HowTo, Product, LocalBusiness`,

    userPrompt: (
      contentType: string = "",
      data: any = {}
    ): string => {
      return `GENERATE SCHEMA:

Type: ${contentType || "Article"}
Data: ${JSON.stringify(data, null, 2)}

Output valid JSON-LD schema markup.`;
    }
  }
};

// ==================== CREATE ALIASES FOR BACKWARD COMPATIBILITY ====================
// This ensures both snake_case and camelCase/lowercase versions work

const createAliases = (templates: Record<string, PromptTemplate>): Record<string, PromptTemplate> => {
  const result: Record<string, PromptTemplate> = { ...templates };
  
  // Define explicit aliases (lowercase no underscores -> snake_case)
  const aliasMap: Record<string, string> = {
    // Content generation
    "contentstrategygenerator": "content_strategy_generator",
    "ultrasotaarticlewriter": "ultra_sota_article_writer",
    "godmodeautonomousagent": "god_mode_autonomous_agent",
    "domcontentpolisher": "dom_content_polisher",
    "godmodestructuralguardian": "god_mode_structural_guardian",
    "godmodeultrainstinct": "god_mode_ultra_instinct",
    
    // Section generators
    "sotaintrogenerator": "sota_intro_generator",
    "sotatakeawaysgenerator": "sota_takeaways_generator",
    "sotafaqgenerator": "sota_faq_generator",
    "sotaconclusiongenerator": "sota_conclusion_generator",
    
    // SEO & Analysis
    "semantickeywordgenerator": "semantic_keyword_generator",
    "competitorgapanalyzer": "competitor_gap_analyzer",
    "seometadatagenerator": "seo_metadata_generator",
    "healthanalyzer": "health_analyzer",
    
    // Utilities
    "clusterplanner": "cluster_planner",
    "generateinternallinks": "generate_internal_links",
    "referencegenerator": "reference_generator",
    "sotaimagealtoptimizer": "sota_image_alt_optimizer",
    "jsonrepair": "json_repair",
    "schemagenerator": "schema_generator",
  };
  
  // Add all aliases pointing to the original templates
  for (const [alias, original] of Object.entries(aliasMap)) {
    if (templates[original]) {
      result[alias] = templates[original];
    }
  }
  
  return result;
};

// ==================== FINAL PROMPT TEMPLATES WITH ALIASES ====================
export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = createAliases(CORE_TEMPLATES);

// ==================== BUILD PROMPT FUNCTION ====================
export function buildPrompt(
  promptKey: keyof typeof PROMPT_TEMPLATES | string,
  args: any[] = []
): BuildPromptResult {
  const template = PROMPT_TEMPLATES[promptKey as keyof typeof PROMPT_TEMPLATES];

  if (!template) {
    console.error(`[buildPrompt] Unknown prompt key: "${promptKey}"`);
    console.error(`[buildPrompt] Available keys:`, Object.keys(PROMPT_TEMPLATES).join(", "));
    
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

    return {
      systemInstruction,
      userPrompt,
      system: systemInstruction,
      user: userPrompt
    };
  } catch (error) {
    console.error("[buildPrompt] Error building prompt:", error);
    return {
      systemInstruction: template.systemInstruction || "You are a helpful assistant.",
      userPrompt: String(args[0] || ""),
      system: template.systemInstruction || "You are a helpful assistant.",
      user: String(args[0] || "")
    };
  }
}

// ==================== EXPORTS ====================
export const PROMPT_CONSTANTS = {
  BANNED_PHRASES: BANNED_AI_PHRASES,
  MAX_TOKENS: 8192,
  TEMPERATURE: 0.7,
  TARGET_YEAR: 2026,
  MIN_WORD_COUNT: 2500,
  MAX_WORD_COUNT: 3500,
  INTERNAL_LINKS_MIN: 8,
  INTERNAL_LINKS_MAX: 15
};

export function containsBannedPhrase(text: string): { contains: boolean; phrases: string[] } {
  const lowerText = text.toLowerCase();
  const foundPhrases = BANNED_AI_PHRASES.filter(phrase => 
    lowerText.includes(phrase.toLowerCase())
  );
  return {
    contains: foundPhrases.length > 0,
    phrases: foundPhrases
  };
}

export function getAvailablePromptKeys(): string[] {
  return Object.keys(PROMPT_TEMPLATES);
}

export function isValidPromptKey(key: string): key is keyof typeof PROMPT_TEMPLATES {
  return key in PROMPT_TEMPLATES;
}

// Utility to normalize prompt keys (for debugging)
export function normalizePromptKey(key: string): string {
  // Try exact match first
  if (key in PROMPT_TEMPLATES) return key;
  
  // Try lowercase
  const lower = key.toLowerCase();
  if (lower in PROMPT_TEMPLATES) return lower;
  
  // Try snake_case conversion
  const snake = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  if (snake in PROMPT_TEMPLATES) return snake;
  
  return key;
}

export default {
  PROMPT_TEMPLATES,
  buildPrompt,
  BANNED_AI_PHRASES,
  SOTA_HTML_COMPONENTS,
  HORMOZI_FERRISS_STYLE,
  INTERNAL_LINKING_RULES,
  PROMPT_CONSTANTS,
  containsBannedPhrase,
  getAvailablePromptKeys,
  isValidPromptKey,
  normalizePromptKey
};
