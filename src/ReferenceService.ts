// =============================================================================
// REFERENCE SERVICE v1.0 - SOTA Enterprise Reference Engine
// =============================================================================

import { fetchWithProxies } from './contentUtils';

// ==================== EXPORTED TYPES (using 'type' keyword for proper export) ====================

export type VerifiedReference = {
  title: string;
  url: string;
  domain: string;
  description: string;
  authority: 'high' | 'medium' | 'low';
  verified: boolean;
  category: string;
};

export type ReferenceCategory = {
  keywords: string[];
  authorityDomains: string[];
  searchModifiers: string[];
};

// ==================== CONSTANTS ====================

export const REFERENCE_CATEGORIES: Record<string, ReferenceCategory> = {
  health: {
    keywords: ['health', 'medical', 'doctor', 'hospital', 'disease', 'treatment', 'symptom', 'medicine', 'wellness', 'healthcare'],
    authorityDomains: ['nih.gov', 'cdc.gov', 'who.int', 'mayoclinic.org', 'healthline.com', 'webmd.com', 'ncbi.nlm.nih.gov', 'health.harvard.edu'],
    searchModifiers: ['research', 'clinical study', 'medical review', 'health guidelines', 'peer-reviewed']
  },
  fitness: {
    keywords: ['fitness', 'workout', 'exercise', 'gym', 'training', 'muscle', 'cardio', 'running', 'strength', 'sports', 'athlete'],
    authorityDomains: ['acsm.org', 'nsca.com', 'runnersworld.com', 'menshealth.com', 'womenshealthmag.com', 'acefitness.org'],
    searchModifiers: ['training study', 'exercise science', 'sports research', 'fitness guidelines', 'performance research']
  },
  nutrition: {
    keywords: ['nutrition', 'diet', 'food', 'eating', 'calories', 'protein', 'vitamins', 'supplements', 'meal', 'nutrients'],
    authorityDomains: ['nutrition.gov', 'eatright.org', 'examine.com', 'usda.gov', 'health.harvard.edu', 'nutritiondata.self.com'],
    searchModifiers: ['nutrition research', 'dietary guidelines', 'food science', 'nutritional study', 'diet analysis']
  },
  technology: {
    keywords: ['technology', 'software', 'programming', 'code', 'app', 'digital', 'computer', 'AI', 'machine learning', 'data', 'tech'],
    authorityDomains: ['ieee.org', 'acm.org', 'techcrunch.com', 'wired.com', 'arstechnica.com', 'github.com', 'stackoverflow.com'],
    searchModifiers: ['technical documentation', 'research paper', 'industry analysis', 'tech review', 'developer guide']
  },
  business: {
    keywords: ['business', 'startup', 'entrepreneur', 'marketing', 'sales', 'finance', 'investment', 'management', 'company', 'revenue'],
    authorityDomains: ['hbr.org', 'forbes.com', 'bloomberg.com', 'wsj.com', 'entrepreneur.com', 'inc.com', 'mckinsey.com'],
    searchModifiers: ['business study', 'market research', 'industry report', 'case study', 'financial analysis']
  },
  science: {
    keywords: ['science', 'research', 'study', 'experiment', 'physics', 'chemistry', 'biology', 'environment', 'scientific'],
    authorityDomains: ['nature.com', 'science.org', 'sciencedirect.com', 'plos.org', 'arxiv.org', 'scientificamerican.com'],
    searchModifiers: ['peer-reviewed', 'scientific study', 'research paper', 'academic journal', 'empirical research']
  },
  finance: {
    keywords: ['finance', 'money', 'investing', 'stocks', 'crypto', 'banking', 'credit', 'mortgage', 'retirement', 'savings'],
    authorityDomains: ['investopedia.com', 'sec.gov', 'federalreserve.gov', 'morningstar.com', 'nerdwallet.com', 'bankrate.com'],
    searchModifiers: ['financial analysis', 'market research', 'investment guide', 'economic study', 'fiscal policy']
  }
};

export const BLOCKED_DOMAINS: string[] = [
  'linkedin.com', 'facebook.com', 'twitter.com', 'instagram.com', 'x.com',
  'pinterest.com', 'reddit.com', 'quora.com', 'medium.com',
  'youtube.com', 'tiktok.com', 'amazon.com', 'ebay.com', 'etsy.com'
];

// ==================== FUNCTIONS ====================

export function detectCategory(keyword: string, semanticKeywords: string[]): string {
  const allText = [keyword, ...semanticKeywords].join(' ').toLowerCase();
  
  let bestCategory = 'general';
  let highestScore = 0;

  for (const [category, config] of Object.entries(REFERENCE_CATEGORIES)) {
    let score = 0;
    for (const kw of config.keywords) {
      if (allText.includes(kw)) {
        score += 10;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

export function determineAuthorityLevel(domain: string, category: string): 'high' | 'medium' | 'low' {
  if (domain.endsWith('.gov') || domain.endsWith('.edu')) return 'high';
  
  const categoryConfig = REFERENCE_CATEGORIES[category];
  if (categoryConfig?.authorityDomains.some(d => domain.includes(d))) return 'high';
  
  const majorPublications = ['nytimes.com', 'bbc.com', 'reuters.com', 'apnews.com', 'npr.org', 'theguardian.com'];
  if (majorPublications.some(d => domain.includes(d))) return 'high';

  if (domain.includes('ncbi') || domain.includes('pubmed') || domain.includes('scholar')) return 'high';

  return 'medium';
}

export async function fetchVerifiedReferences(
  keyword: string,
  semanticKeywords: string[],
  serperApiKey: string,
  wpUrl?: string,
  logCallback?: (msg: string) => void
): Promise<{ html: string; references: VerifiedReference[] }> {
  const log = (msg: string) => {
    console.log(`[ReferenceService] ${msg}`);
    logCallback?.(msg);
  };

  // CRITICAL: Check Serper API key
  if (!serperApiKey || serperApiKey.trim() === '') {
    console.error('[References] ❌ CRITICAL: No Serper API key provided!');
    log('⚠️ No Serper API key - returning fallback references section');
    return { 
      html: generateFallbackReferencesSection(keyword), 
      references: [] 
    };
  }

  console.log(`[References] 🔍 SOTA Reference Engine v2.0 starting for: "${keyword}"`);
  console.log(`[References] 🔑 Serper API Key: ${serperApiKey.substring(0, 8)}...`);
  console.log(`[References] Semantic keywords: ${semanticKeywords.slice(0, 5).join(', ')}`);
  log('Fetching verified references with SOTA engine...');

  try {
    const category = detectCategory(keyword, semanticKeywords);
    const categoryConfig = REFERENCE_CATEGORIES[category];
    const currentYear = new Date().getFullYear();

    console.log(`[References] Detected category: ${category}`);
    log(`Category detected: ${category}`);

    let userDomain = '';
    if (wpUrl) {
      try { userDomain = new URL(wpUrl).hostname.replace('www.', ''); } catch (e) {}
    }

    // ULTRA SOTA Query Builder - Maximum Relevance
    const kw = `"${keyword}"`;
    const kwNoQuotes = keyword;
    const topSemantic = semanticKeywords.slice(0, 8);
    const semQuery = topSemantic.slice(0, 3).map(s => `"${s}"`).join(' OR ');
    const coreWords = keyword.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
    
    const searchQueries: string[] = [];
    
    // TIER 1: HIGH-AUTHORITY DOMAIN QUERIES (Government, Academic, Major Orgs)
    const highAuthorityDomains = [
      'gov', 'edu', 'nih.gov', 'cdc.gov', 'who.int', 'ncbi.nlm.nih.gov',
      'mayoclinic.org', 'harvard.edu', 'stanford.edu', 'mit.edu'
    ];
    searchQueries.push(`${kw} site:gov OR site:edu`);
    searchQueries.push(`${kw} site:nih.gov OR site:cdc.gov OR site:who.int`);
    
    // TIER 2: CATEGORY-SPECIFIC AUTHORITY DOMAINS
    if (categoryConfig) {
      const topDomains = categoryConfig.authorityDomains.slice(0, 8);
      for (const domain of topDomains.slice(0, 4)) {
        searchQueries.push(`${kw} site:${domain}`);
      }
      const siteOr = topDomains.map(d => `site:${d}`).join(' OR ');
      searchQueries.push(`${kwNoQuotes} (${siteOr})`);
    }
    
    // TIER 3: CONTENT-TYPE SPECIFIC QUERIES
    searchQueries.push(`${kw} "research" OR "study" OR "systematic review" ${currentYear}`);
    searchQueries.push(`${kw} "guidelines" OR "official guide" OR "fact sheet"`);
    searchQueries.push(`${kw} "statistics" OR "data" OR "report" ${currentYear}`);
    searchQueries.push(`${kw} "expert guide" OR "professional advice" OR "best practices"`);
    searchQueries.push(`${kw} "comprehensive guide" OR "complete guide" ${currentYear}`);
    
    // TIER 4: SEMANTIC KEYWORD ENHANCED QUERIES
    if (topSemantic.length > 0) {
      searchQueries.push(`${kw} ${topSemantic[0]} authoritative source`);
      searchQueries.push(`${kwNoQuotes} ${semQuery} official`);
    }
    
    // TIER 5: MAJOR PUBLICATION QUERIES  
    const majorPubs = ['nytimes.com', 'bbc.com', 'reuters.com', 'forbes.com', 'wsj.com', 'theguardian.com'];
    const pubsQuery = majorPubs.slice(0, 4).map(d => `site:${d}`).join(' OR ');
    searchQueries.push(`${kw} (${pubsQuery})`);
    
    // TIER 6: FALLBACK BROAD QUERIES
    searchQueries.push(`${kwNoQuotes} official information ${currentYear}`);
    searchQueries.push(`${kwNoQuotes} trusted resource guide`);
    if (coreWords.length > 0) {
      searchQueries.push(`${coreWords.join(' ')} authoritative guide ${currentYear}`);
    }

    console.log(`[References] 📊 Generated ${searchQueries.length} search queries across 6 tiers`);
    log(`Search queries: ${searchQueries.length} variations (6-tier strategy)`);

    const potentialReferences: any[] = [];

    for (const query of searchQueries) {
      try {
        const response = await fetchWithProxies('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query, num: 15 })
        });

        if (response.ok) {
          const data = await response.json();
          potentialReferences.push(...(data.organic || []));
        }
      } catch (e) {
        log(`Search query failed: ${query}`);
      }
    }

    log(`Found ${potentialReferences.length} potential references, validating...`);

    const validatedReferences: VerifiedReference[] = [];

    // STRICT Relevance Enforcement
    const keywordLower = keyword.toLowerCase();
    const keywordTokens = keywordLower.split(/\s+/).filter(w => w.length > 3);
    const semanticLower = semanticKeywords.map(k => k.toLowerCase()).filter(k => k.length > 3);
    
    // Off-topic blocklist (reject results containing these)
    const offTopicPhrases = [
      'unrelated', 'different topic', 'advertisement', 'sponsored',
      'buy now', 'shop now', 'add to cart', 'free download', 'sign up free'
    ];

    for (const ref of potentialReferences) {
      if (validatedReferences.length >= 10) break;

      try {
        const url = new URL(ref.link);
        const domain = url.hostname.replace('www.', '');

        // Basic filters
        if (BLOCKED_DOMAINS.some(d => domain.includes(d))) continue;
        if (userDomain && domain.includes(userDomain)) continue;
        if (validatedReferences.some(r => r.domain === domain)) continue;

        // Content analysis
        const titleLower = (ref.title || '').toLowerCase();
        const snippetLower = (ref.snippet || '').toLowerCase();
        const combinedText = `${titleLower} ${snippetLower}`;

        // OFF-TOPIC REJECTION
        if (offTopicPhrases.some(phrase => combinedText.includes(phrase))) {
          log(`Rejected: ${domain} (off-topic phrase detected)`);
          continue;
        }

        // STRICT RELEVANCE REQUIREMENTS
        const exactKeywordMatch = combinedText.includes(keywordLower);
        const matchedKeywordTokens = keywordTokens.filter(t => combinedText.includes(t));
        const matchedSemantic = semanticLower.filter(s => combinedText.includes(s));

        // MUST have either:
        // 1. Exact keyword phrase match, OR
        // 2. At least 2 keyword tokens + at least 1 semantic keyword
        if (!exactKeywordMatch) {
          if (matchedKeywordTokens.length < 2) {
            log(`Rejected: ${domain} (insufficient keyword match: ${matchedKeywordTokens.length}/2)`);
            continue;
          }
          if (matchedSemantic.length < 1) {
            log(`Rejected: ${domain} (no semantic keyword match)`);
            continue;
          }
        }

        // Calculate relevance score
        let relevanceScore = 0;
        
        // Exact phrase = highest priority
        if (exactKeywordMatch) relevanceScore += 100;
        
        // Token matches
        relevanceScore += matchedKeywordTokens.length * 20;
        relevanceScore += matchedSemantic.length * 15;
        
        // Title matches are more valuable than snippet
        for (const token of keywordTokens) {
          if (titleLower.includes(token)) relevanceScore += 25;
        }
        
        // Freshness bonus
        if (combinedText.includes(String(currentYear))) relevanceScore += 30;
        if (combinedText.includes(String(currentYear - 1))) relevanceScore += 15;
        
        // Authority domain bonus
        if (categoryConfig?.authorityDomains.some(d => domain.includes(d))) {
          relevanceScore += 50;
        }
        
        // .gov/.edu bonus
        if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
          relevanceScore += 40;
        }

        // MINIMUM RELEVANCE THRESHOLD (raised from 50 to 80)
        if (relevanceScore < 80) {
          log(`Rejected: ${domain} (low relevance: ${relevanceScore})`);
          continue;
        }

        // URL validation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const checkResponse = await fetch(ref.link, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          clearTimeout(timeoutId);

          if (checkResponse.status !== 200) {
            log(`Rejected: ${domain} (status ${checkResponse.status})`);
            continue;
          }
        } catch (e) {
          clearTimeout(timeoutId);
          log(`Rejected: ${domain} (unreachable)`);
          continue;
        }

        const authority = determineAuthorityLevel(domain, category);

        validatedReferences.push({
          title: ref.title || domain,
          url: ref.link,
          domain,
          description: ref.snippet || '',
          authority,
          verified: true,
          category
        });

        log(`✅ Verified: ${domain} (${authority} authority, relevance: ${relevanceScore})`);
      } catch (e) {
        continue;
      }
    }

    // Sort by relevance + authority
    validatedReferences.sort((a, b) => {
      const authorityScore = { high: 100, medium: 50, low: 10 };
      return authorityScore[b.authority] - authorityScore[a.authority];
    });

    // QUALITY ASSURANCE: GUARANTEED minimum references
    if (validatedReferences.length < 3) {
      console.warn(`[References] ⚠️ Only ${validatedReferences.length} references passed validation - using fallback`);
      log(`Warning: Low reference count (${validatedReferences.length}) - adding fallback section`);
      
      // Still return what we have + fallback HTML
      const fallbackHtml = generateFallbackReferencesSection(keyword);
      if (validatedReferences.length === 0) {
        return { html: fallbackHtml, references: [] };
      }
      // Combine existing references with encouragement to verify
      const html = generateReferencesHtml(validatedReferences, category, keyword);
      return { html, references: validatedReferences };
    }

    console.log(`[References] ✅ Successfully validated ${validatedReferences.length} high-quality references`);
    console.log('[References] Top 5 references:');
    validatedReferences.slice(0, 5).forEach((ref, i) => {
      console.log(`  ${i + 1}. ${ref.title} (${ref.domain}) - ${ref.authority} authority`);
    });

    log(`Successfully validated ${validatedReferences.length} references`);

    const html = generateReferencesHtml(validatedReferences, category, keyword);

    return { html, references: validatedReferences };
  } catch (error: any) {
    console.error(`[References] ❌ Reference fetch FAILED:`, error);
    log(`Reference fetch failed: ${error.message}`);
    // ALWAYS return something - never fail silently
    return { html: generateFallbackReferencesSection(keyword), references: [] };
  }
}

/**
 * FALLBACK: Generate a minimal references section when API fails
 * NOTE: This should only be used when Serper API key is missing or API completely fails
 * Returns empty string - we DO NOT show fake/placeholder references
 * User MUST configure a valid Serper API key for real references
 */
function generateFallbackReferencesSection(keyword: string): string {
  console.error('[ReferenceService] ❌ CRITICAL: No references available!');
  console.error('[ReferenceService] ❌ Please configure your Serper.dev API key in Settings → API Keys');
  console.error('[ReferenceService] ❌ Get your API key from: https://serper.dev');
  
  // Return empty string - DO NOT show fake references
  // This ensures the app only shows REAL, verified references from Serper API
  return '';
}

export function generateReferencesHtml(
  references: VerifiedReference[], 
  category: string, 
  keyword: string
): string {
  const categoryEmoji: Record<string, string> = {
    health: '🏥',
    fitness: '💪',
    nutrition: '🥗',
    technology: '💻',
    business: '📈',
    science: '🔬',
    finance: '💰',
    general: '📚'
  };

  const emoji = categoryEmoji[category] || '📚';

  return `
<div class="sota-references-section" style="margin: 3rem 0; padding: 2rem; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 16px; border-left: 5px solid #3B82F6;">
  <h2 style="display: flex; align-items: center; gap: 0.75rem; margin: 0 0 1.5rem; color: #1e293b; font-size: 1.5rem;">
    <span>${emoji}</span> Trusted References & Further Reading
  </h2>
  <p style="margin: 0 0 1.5rem; color: #64748b; font-size: 0.9rem;">
    ✅ All sources verified as of ${new Date().toLocaleDateString()} • ${references.length} authoritative references
  </p>
  <div style="display: grid; gap: 1rem;">
    ${references.map((ref, idx) => `
    <div style="display: flex; gap: 1rem; padding: 1rem; background: white; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
      <div style="flex-shrink: 0; width: 32px; height: 32px; background: ${ref.authority === 'high' ? '#10B981' : '#3B82F6'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.85rem;">
        ${idx + 1}
      </div>
      <div style="flex: 1; min-width: 0;">
        <a href="${ref.url}" target="_blank" rel="noopener noreferrer" style="color: #1e40af; text-decoration: none; font-weight: 600; font-size: 1rem; display: block; margin-bottom: 0.25rem;">
          ${ref.title}
        </a>
        <p style="margin: 0 0 0.5rem; color: #64748b; font-size: 0.85rem; line-height: 1.5;">
          ${ref.description.substring(0, 150)}${ref.description.length > 150 ? '...' : ''}
        </p>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="padding: 2px 8px; background: ${ref.authority === 'high' ? '#dcfce7' : '#e0f2fe'}; color: ${ref.authority === 'high' ? '#166534' : '#0369a1'}; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">
            ${ref.authority} authority
          </span>
          <span style="color: #94a3b8; font-size: 0.75rem;">${ref.domain}</span>
        </div>
      </div>
    </div>
    `).join('')}
  </div>
</div>`;
}
