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
  if (!serperApiKey) {
    logCallback?.('[References] ⚠️ No Serper API key');
    return { html: '', references: [] };
  }

  const log = (msg: string) => {
    console.log(`[ReferenceService] ${msg}`);
    logCallback?.(msg);
  };

  log('Fetching verified references...');

  try {
    const category = detectCategory(keyword, semanticKeywords);
    const categoryConfig = REFERENCE_CATEGORIES[category];
    const currentYear = new Date().getFullYear();

    log(`Category detected: ${category}`);

    let userDomain = '';
    if (wpUrl) {
      try { userDomain = new URL(wpUrl).hostname.replace('www.', ''); } catch (e) {}
    }

    const searchQueries: string[] = [];
    
    if (categoryConfig) {
      const modifiers = categoryConfig.searchModifiers.slice(0, 2).join(' OR ');
      const domains = categoryConfig.authorityDomains.slice(0, 3).map(d => `site:${d}`).join(' OR ');
      searchQueries.push(`${keyword} "${modifiers}" (${domains}) ${currentYear}`);
      searchQueries.push(`${keyword} research study ${currentYear}`);
    } else {
      searchQueries.push(`${keyword} "research" "study" "data" ${currentYear}`);
      searchQueries.push(`${keyword} official guide ${currentYear}`);
    }

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

    for (const ref of potentialReferences) {
      if (validatedReferences.length >= 10) break;

      try {
        const url = new URL(ref.link);
        const domain = url.hostname.replace('www.', '');

        if (BLOCKED_DOMAINS.some(d => domain.includes(d))) continue;
        if (userDomain && domain.includes(userDomain)) continue;
        if (validatedReferences.some(r => r.domain === domain)) continue;

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

        log(`✅ Verified: ${domain} (${authority} authority)`);
      } catch (e) {
        continue;
      }
    }

    if (validatedReferences.length === 0) {
      log('No references passed validation');
      return { html: '', references: [] };
    }

    log(`Successfully validated ${validatedReferences.length} references`);

    const html = generateReferencesHtml(validatedReferences, category, keyword);

    return { html, references: validatedReferences };
  } catch (error: any) {
    log(`Reference fetch failed: ${error.message}`);
    return { html: '', references: [] };
  }
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
