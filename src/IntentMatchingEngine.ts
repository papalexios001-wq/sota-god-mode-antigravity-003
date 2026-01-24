// =============================================================================
// SOTA INTENT-MATCHING CONTENT ARCHITECTURE v1.0
// Enterprise-Grade Search Intent Classification & Content Optimization
// =============================================================================

// ==================== INTENT TYPES ====================

export type SearchIntent = 'informational' | 'commercial' | 'transactional' | 'navigational';

export interface IntentAnalysis {
  primaryIntent: SearchIntent;
  confidence: number;
  secondaryIntents: { intent: SearchIntent; confidence: number }[];
  suggestedContentBlocks: ContentBlockType[];
  featuredSnippetOpportunity: SnippetType | null;
}

export type ContentBlockType = 
  | 'definition_box' | 'how_to_steps' | 'comparison_table' | 'pros_cons'
  | 'faq_section' | 'quick_answer' | 'product_comparison' | 'pricing_table'
  | 'cta_block' | 'contact_info' | 'location_map' | 'review_summary';

export type SnippetType = 'paragraph' | 'list' | 'table' | 'video' | 'faq';

// ==================== INTENT CLASSIFICATION PATTERNS ====================

export const INTENT_PATTERNS: Record<SearchIntent, { keywords: string[], modifiers: string[], formats: ContentBlockType[] }> = {
  informational: {
    keywords: ['what is', 'how to', 'why', 'when', 'who', 'guide', 'tutorial', 'learn', 'understand', 'explain', 'definition', 'meaning', 'examples'],
    modifiers: ['best practices', 'tips', 'ideas', 'ways to', 'steps to', 'how does', 'vs', 'versus'],
    formats: ['definition_box', 'how_to_steps', 'faq_section', 'quick_answer']
  },
  commercial: {
    keywords: ['best', 'top', 'review', 'compare', 'vs', 'versus', 'alternative', 'comparison', 'which', 'recommend'],
    modifiers: ['for', 'under', 'cheap', 'affordable', 'premium', 'professional'],
    formats: ['comparison_table', 'pros_cons', 'product_comparison', 'review_summary']
  },
  transactional: {
    keywords: ['buy', 'purchase', 'order', 'subscribe', 'sign up', 'download', 'get', 'deal', 'discount', 'coupon', 'price', 'cost'],
    modifiers: ['free', 'trial', 'demo', 'quote', 'booking'],
    formats: ['pricing_table', 'cta_block', 'product_comparison']
  },
  navigational: {
    keywords: ['login', 'sign in', 'contact', 'support', 'help', 'official', 'website', 'app', 'download'],
    modifiers: ['near me', 'location', 'address', 'phone', 'hours'],
    formats: ['contact_info', 'location_map', 'cta_block']
  }
};

// ==================== INTENT CLASSIFICATION FUNCTION ====================

export function classifySearchIntent(keyword: string): IntentAnalysis {
  const lowerKeyword = keyword.toLowerCase();
  const scores: Record<SearchIntent, number> = {
    informational: 0,
    commercial: 0,
    transactional: 0,
    navigational: 0
  };

  // Score each intent based on keyword matches
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const kw of patterns.keywords) {
      if (lowerKeyword.includes(kw)) {
        scores[intent as SearchIntent] += 2;
      }
    }
    for (const mod of patterns.modifiers) {
      if (lowerKeyword.includes(mod)) {
        scores[intent as SearchIntent] += 1;
      }
    }
  }

  // Determine primary intent
  const sortedIntents = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const maxScore = sortedIntents[0][1];
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;

  const primaryIntent = sortedIntents[0][0] as SearchIntent;
  const confidence = maxScore / totalScore;

  // Determine snippet opportunity
  let featuredSnippetOpportunity: SnippetType | null = null;
  if (lowerKeyword.includes('what is') || lowerKeyword.includes('definition')) {
    featuredSnippetOpportunity = 'paragraph';
  } else if (lowerKeyword.includes('how to') || lowerKeyword.includes('steps')) {
    featuredSnippetOpportunity = 'list';
  } else if (lowerKeyword.includes('vs') || lowerKeyword.includes('compare')) {
    featuredSnippetOpportunity = 'table';
  }

  return {
    primaryIntent,
    confidence: Math.min(confidence, 0.95),
    secondaryIntents: sortedIntents.slice(1).map(([intent, score]) => ({
      intent: intent as SearchIntent,
      confidence: score / totalScore
    })),
    suggestedContentBlocks: INTENT_PATTERNS[primaryIntent].formats,
    featuredSnippetOpportunity
  };
}

// ==================== INTENT-SPECIFIC CONTENT INSTRUCTIONS ====================

export const INTENT_CONTENT_INSTRUCTIONS: Record<SearchIntent, string> = {
  informational: `
📚 INFORMATIONAL INTENT - Education-First Content:
- Answer the main question in the FIRST 50 words (featured snippet optimization)
- Include a "Quick Answer" box at the top
- Use clear H2/H3 structure for scanability
- Add "What is [X]?" definition boxes
- Include step-by-step tutorials with numbered lists
- Add FAQ section (5-8 questions)
- Use educational diagrams and infographics
- Link to authoritative sources for credibility
`,
  commercial: `
📊 COMMERCIAL INTENT - Comparison-Focused Content:
- Lead with a comparison summary table
- Include detailed pros/cons for each option
- Add "Best For" recommendations (beginners, professionals, budget, etc.)
- Include pricing comparison where applicable
- Add user review summaries and ratings
- Use "Winner" callout boxes
- Include alternative options section
- Add "Our Verdict" conclusion
`,
  transactional: `
💰 TRANSACTIONAL INTENT - Conversion-Optimized Content:
- Lead with clear pricing/offer information
- Include prominent CTAs above the fold
- Add trust signals (reviews, guarantees, security badges)
- Use urgency elements (limited time, stock levels)
- Include FAQ addressing purchase concerns
- Add comparison with competitors
- Include multiple CTA placements throughout
- Add "How to Buy/Order" section
`,
  navigational: `
📍 NAVIGATIONAL INTENT - Quick Access Content:
- Provide direct links/buttons to destination
- Include contact information prominently
- Add location map if applicable
- Include hours of operation
- Add quick FAQ for common questions
- Include alternative contact methods
- Add breadcrumb navigation
- Keep content concise and action-oriented
`
};

// ==================== FEATURED SNIPPET OPTIMIZER ====================

export function generateFeaturedSnippetHTML(
  snippetType: SnippetType,
  content: { question: string; answer: string } | { items: string[] } | { headers: string[]; rows: string[][] }
): string {
  switch (snippetType) {
    case 'paragraph':
      const pContent = content as { question: string; answer: string };
      return `
<div class="sota-featured-snippet" style="background: #e7f3ff; border-left: 5px solid #1a73e8; padding: 20px; margin: 25px 0; border-radius: 8px;">
  <h3 style="color: #1a73e8; margin: 0 0 10px 0; font-size: 1.2em;">🔍 ${pContent.question}</h3>
  <p style="margin: 0; line-height: 1.7; color: #333;">${pContent.answer}</p>
</div>`;

    case 'list':
      const lContent = content as { items: string[] };
      return `
<div class="sota-featured-snippet-list" style="background: #e7f3ff; border-left: 5px solid #1a73e8; padding: 20px; margin: 25px 0; border-radius: 8px;">
  <ol style="margin: 0; padding-left: 20px; line-height: 2;">
    ${lContent.items.map((item, i) => `<li style="color: #333;"><strong>Step ${i + 1}:</strong> ${item}</li>`).join('\n    ')}
  </ol>
</div>`;

    case 'table':
      const tContent = content as { headers: string[]; rows: string[][] };
      return `
<div class="sota-featured-snippet-table" style="overflow-x: auto; margin: 25px 0;">
  <table style="width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <thead style="background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%);">
      <tr>
        ${tContent.headers.map(h => `<th style="padding: 15px; color: #fff; text-align: left;">${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${tContent.rows.map((row, i) => `
      <tr style="background: ${i % 2 === 0 ? '#f8f9fa' : '#fff'};">
        ${row.map(cell => `<td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${cell}</td>`).join('')}
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;

    default:
      return '';
  }
}

// ==================== PEOPLE ALSO ASK GENERATOR ====================

export function generatePAASection(questions: { question: string; answer: string }[]): string {
  return `
<div class="sota-paa-section" style="margin: 30px 0;">
  <h2 style="color: #1a73e8; margin-bottom: 20px;">👥 People Also Ask</h2>
  <div style="display: flex; flex-direction: column; gap: 10px;">
    ${questions.map(q => `
    <details style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px;">
      <summary style="cursor: pointer; font-weight: 600; color: #333;">${q.question}</summary>
      <p style="margin: 15px 0 0 0; color: #555; line-height: 1.7;">${q.answer}</p>
    </details>`).join('')}
  </div>
</div>`;
}

// ==================== DEFAULT EXPORT ====================

export default {
  INTENT_PATTERNS,
  INTENT_CONTENT_INSTRUCTIONS,
  classifySearchIntent,
  generateFeaturedSnippetHTML,
  generatePAASection,
};
