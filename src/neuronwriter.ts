// =============================================================================
// SOTA NEURONWRITER INTEGRATION v16.0 - ENTERPRISE-GRADE FIXED
// CRITICAL FIX: Proper API workflow with existing query lookup
// API Docs: https://neuronwriter.com/faqs/neuronwriter-api-how-to-use/
// =============================================================================

// Vite environment variables
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
const USE_CLOUDFLARE_PROXY = !SUPABASE_URL || SUPABASE_URL.trim() === '';

// ==================== TYPES ====================

export interface NeuronProject {
  project: string;
  name: string;
  engine: string;
  language: string;
}

export interface NeuronTerms {
  h1?: string;
  title?: string;
  h2?: string;
  h3?: string;
  content_basic?: string;
  content_extended?: string;
  entities_basic?: string;
  entities_extended?: string;
  questions?: string[];
  headings?: string[];
}

export interface NeuronWriterData {
  terms: string[];
  competitors: string[];
  questions: string[];
  headings: string[];
}

interface ProxyResponse {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  type?: string;
}

interface CachedQuery {
  queryId: string;
  terms: NeuronTerms;
  timestamp: number;
}

// ==================== CACHES ====================

// Cache for query IDs to avoid creating duplicates
const queryIdCache = new Map<string, { queryId: string; timestamp: number }>();

// Cache for fetched terms
const neuronTermsCache = new Map<string, CachedQuery>();

// Cache TTLs
const QUERY_ID_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for query IDs
const TERMS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for terms

// ==================== PROXY HELPER ====================

const callNeuronWriterProxy = async (
  endpoint: string,
  apiKey: string,
  method: string = 'POST',
  body?: Record<string, unknown>,
  timeoutMs: number = 30000
): Promise<ProxyResponse> => {
  const proxyUrl = USE_CLOUDFLARE_PROXY
    ? '/api/neuronwriter'
    : `${SUPABASE_URL}/functions/v1/neuronwriter-proxy`;

  console.log(`[NeuronWriter] Calling ${endpoint} via ${USE_CLOUDFLARE_PROXY ? 'Cloudflare' : 'Supabase'} proxy`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-NeuronWriter-Key': apiKey,
    };

    if (!USE_CLOUDFLARE_PROXY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    }

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        endpoint,
        method,
        apiKey,
        body
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[NeuronWriter] Proxy error (${response.status}): ${errorText}`);
      return { success: false, status: response.status, error: errorText };
    }

    const result: ProxyResponse = await response.json();
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      console.error('[NeuronWriter] Request timed out');
      return { success: false, error: 'Request timed out', type: 'timeout' };
    }

    console.error('[NeuronWriter] Network error:', error.message);
    return { success: false, error: error.message, type: 'network_error' };
  }
};

// ==================== LIST PROJECTS ====================

export const listNeuronProjects = async (apiKey: string): Promise<NeuronProject[]> => {
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error('Invalid NeuronWriter API key. Please enter a valid key.');
  }

  console.log('[NeuronWriter] Fetching projects...');

  try {
    const result = await callNeuronWriterProxy('/list-projects', apiKey, 'POST', {});

    if (!result.success) {
      throw new Error(result.error || `API error: ${result.status}`);
    }

    const data = result.data;
    if (!data) {
      throw new Error('No data returned from NeuronWriter API');
    }

    const projects = Array.isArray(data) ? data : (data.projects || data.data || []);

    if (!Array.isArray(projects)) {
      console.warn('[NeuronWriter] Unexpected response format:', data);
      throw new Error('Invalid response format from NeuronWriter');
    }

    console.log(`[NeuronWriter] Found ${projects.length} projects`);

    return projects.map((project: any) => ({
      project: project.project || project.id || project.uuid,
      name: project.name || project.title || 'Unnamed Project',
      engine: project.engine || project.search_engine || 'google',
      language: project.language || project.lang || 'en'
    }));
  } catch (error: any) {
    console.error('[NeuronWriter] Failed to list projects:', error);
    throw new Error(`Failed to fetch NeuronWriter projects: ${error.message}`);
  }
};

// ==================== FIND EXISTING QUERY ====================

/**
 * Searches for an existing query with the same keyword to avoid duplicates
 * Uses /list-queries API endpoint
 */
async function findExistingQuery(
  apiKey: string,
  projectId: string,
  keyword: string
): Promise<string | null> {
  const cacheKey = `${projectId}:${keyword.toLowerCase().trim()}`;

  // Check query ID cache first
  const cached = queryIdCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < QUERY_ID_CACHE_TTL_MS) {
    console.log(`[NeuronWriter] 📦 Found cached query ID: ${cached.queryId}`);
    return cached.queryId;
  }

  console.log(`[NeuronWriter] 🔍 Searching for existing query: "${keyword}"`);

  try {
    const result = await callNeuronWriterProxy('/list-queries', apiKey, 'POST', {
      project: projectId,
      status: 'ready',
      // Only search for recent queries to avoid stale data
    }, 15000);

    if (!result.success || !result.data) {
      console.log('[NeuronWriter] Could not fetch existing queries');
      return null;
    }

    const queries = Array.isArray(result.data) ? result.data : [];
    const normalizedKeyword = keyword.toLowerCase().trim();

    // Find a query with matching keyword
    const match = queries.find((q: any) => {
      const queryKeyword = (q.keyword || '').toLowerCase().trim();
      return queryKeyword === normalizedKeyword;
    });

    if (match) {
      const queryId = match.query || match.id;
      console.log(`[NeuronWriter] ✅ Found existing query: ${queryId}`);

      // Cache the query ID
      queryIdCache.set(cacheKey, { queryId, timestamp: Date.now() });

      return queryId;
    }

    console.log('[NeuronWriter] No existing query found for this keyword');
    return null;
  } catch (error: any) {
    console.warn('[NeuronWriter] Error searching for existing queries:', error.message);
    return null;
  }
}

// ==================== FETCH TERMS FROM QUERY ====================

/**
 * Fetches terms from an existing query ID
 * Uses /get-query API endpoint
 */
async function fetchTermsFromQuery(
  apiKey: string,
  queryId: string
): Promise<NeuronTerms | null> {
  console.log(`[NeuronWriter] 📊 Fetching terms from query: ${queryId}`);

  try {
    const result = await callNeuronWriterProxy('/get-query', apiKey, 'POST', {
      query: queryId
    }, 20000);

    if (!result.success || !result.data) {
      console.error('[NeuronWriter] Failed to fetch query data');
      return null;
    }

    const data = result.data;

    // Check if analysis is ready
    if (data.status !== 'ready') {
      console.log(`[NeuronWriter] Query status: ${data.status} (not ready yet)`);
      return null;
    }

    // Extract terms using correct API response structure
    // API returns terms_txt object with title, content_basic, etc.
    const termsTxt = data.terms_txt || data.terms || {};
    const ideas = data.ideas || {};

    const terms: NeuronTerms = {
      h1: extractTermString(termsTxt.h1 || termsTxt.title),
      title: extractTermString(termsTxt.title),
      h2: extractTermString(termsTxt.h2),
      h3: extractTermString(termsTxt.h3),
      content_basic: extractTermString(termsTxt.content_basic),
      content_extended: extractTermString(termsTxt.content_extended || termsTxt.content_basic_w_ranges),
      entities_basic: extractTermString(termsTxt.entities || termsTxt.entities_basic),
      entities_extended: extractTermString(termsTxt.entities_extended),
      questions: extractQuestions([
        ...(ideas.suggest_questions || []),
        ...(ideas.people_also_ask || []),
        ...(ideas.content_questions || [])
      ]),
      headings: extractHeadings(data.headings || data.suggested_headings || [])
    };

    const termCount = countTerms(terms);
    console.log(`[NeuronWriter] ✅ Extracted ${termCount} terms from query`);

    return terms;
  } catch (error: any) {
    console.error('[NeuronWriter] Error fetching terms from query:', error.message);
    return null;
  }
}

// ==================== CREATE NEW QUERY ====================

/**
 * Creates a new query and waits for analysis with REASONABLE timeouts
 * Uses /new-query API endpoint
 */
async function createNewQuery(
  apiKey: string,
  projectId: string,
  keyword: string,
  engine: string = 'google',
  language: string = 'en'
): Promise<{ queryId: string; terms: NeuronTerms } | null> {
  console.log(`[NeuronWriter] 🆕 Creating new query for: "${keyword}"`);

  try {
    // Create the query
    const createResult = await callNeuronWriterProxy('/new-query', apiKey, 'POST', {
      project: projectId,
      keyword: keyword,
      engine: engine,
      language: language
    }, 30000);

    if (!createResult.success) {
      console.error('[NeuronWriter] Failed to create query:', createResult.error);
      return null;
    }

    const queryId = createResult.data?.query || createResult.data?.id;
    if (!queryId) {
      console.error('[NeuronWriter] No query ID in response');
      return null;
    }

    console.log(`[NeuronWriter] ✅ Query created: ${queryId}`);
    console.log(`[NeuronWriter] ⏳ NeuronWriter analysis typically takes 30-60 seconds...`);

    // Cache the query ID immediately
    const cacheKey = `${projectId}:${keyword.toLowerCase().trim()}`;
    queryIdCache.set(cacheKey, { queryId, timestamp: Date.now() });

    // Poll for completion with REASONABLE timeouts
    // NeuronWriter docs say "usually takes around 60 seconds"
    const maxWaitTime = 90000; // 90 seconds max total wait
    const pollInterval = 5000; // Check every 5 seconds
    const startTime = Date.now();
    let pollCount = 0;

    while (Date.now() - startTime < maxWaitTime) {
      pollCount++;

      // Wait before polling
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[NeuronWriter] 🔄 Polling ${pollCount} (${elapsed}s elapsed)...`);

      const terms = await fetchTermsFromQuery(apiKey, queryId);

      if (terms && countTerms(terms) > 0) {
        console.log(`[NeuronWriter] ✅ Analysis complete after ${elapsed}s`);
        return { queryId, terms };
      }
    }

    console.warn(`[NeuronWriter] ⏱️ Analysis not ready after ${maxWaitTime / 1000}s - using fallback`);
    return null;

  } catch (error: any) {
    console.error('[NeuronWriter] Error creating query:', error.message);
    return null;
  }
}

// ==================== MAIN FETCH FUNCTION ====================

/**
 * SOTA NeuronWriter Integration v16.0 - Enterprise-Grade
 * 
 * Workflow:
 * 1. Check cache for existing terms
 * 2. Check for existing query using /list-queries (to avoid duplicates)
 * 3. If existing query found, fetch terms using /get-query
 * 4. If no existing query, create new one with /new-query and poll
 * 5. Fallback to synthetic terms if API is slow/unavailable
 */
export const fetchNeuronTerms = async (
  apiKey: string,
  projectId: string,
  query: string
): Promise<NeuronTerms | null> => {
  if (!apiKey || !projectId || !query) {
    console.warn('[NeuronWriter] Missing required parameters');
    return generateFallbackTerms(query, 'Missing required parameters');
  }

  const cacheKey = `terms:${projectId}:${query.toLowerCase().trim()}`;

  // Step 1: Check terms cache
  const cached = neuronTermsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TERMS_CACHE_TTL_MS) {
    console.log(`[NeuronWriter] 📦 Cache hit for terms: "${query}"`);
    return cached.terms;
  }

  console.log(`[NeuronWriter] 🚀 Starting fetch for: "${query}"`);
  console.log(`[NeuronWriter] Project ID: ${projectId.substring(0, 8)}...`);

  try {
    // Step 2: Try to find existing query
    const existingQueryId = await findExistingQuery(apiKey, projectId, query);

    if (existingQueryId) {
      // Step 3: Fetch terms from existing query
      const terms = await fetchTermsFromQuery(apiKey, existingQueryId);

      if (terms && countTerms(terms) > 0) {
        // Cache the terms
        neuronTermsCache.set(cacheKey, {
          queryId: existingQueryId,
          terms,
          timestamp: Date.now()
        });

        logTermStats(terms);
        return terms;
      }
    }

    // Step 4: Create new query if no existing one found
    console.log('[NeuronWriter] No ready query found - creating new one...');

    const newQueryResult = await createNewQuery(apiKey, projectId, query);

    if (newQueryResult && countTerms(newQueryResult.terms) > 0) {
      // Cache the terms
      neuronTermsCache.set(cacheKey, {
        queryId: newQueryResult.queryId,
        terms: newQueryResult.terms,
        timestamp: Date.now()
      });

      logTermStats(newQueryResult.terms);
      return newQueryResult.terms;
    }

    // Step 5: Fallback to synthetic terms
    console.warn('[NeuronWriter] ⚠️ API unavailable - generating fallback terms');
    return generateFallbackTerms(query, 'API unavailable or slow');

  } catch (error: any) {
    console.error('[NeuronWriter] Critical error:', error.message);
    return generateFallbackTerms(query, error.message);
  }
};

// ==================== HELPER FUNCTIONS ====================

function logTermStats(terms: NeuronTerms): void {
  console.log(`[NeuronWriter] 📊 Term Statistics:`);
  console.log(`   H1: ${terms.h1?.split(',').length || 0} terms`);
  console.log(`   H2: ${terms.h2?.split(',').length || 0} terms`);
  console.log(`   Content Basic: ${terms.content_basic?.split(',').length || 0} terms`);
  console.log(`   Content Extended: ${terms.content_extended?.split(',').length || 0} terms`);
  console.log(`   Entities: ${terms.entities_basic?.split(',').length || 0} entities`);
  console.log(`   Questions: ${terms.questions?.length || 0}`);
  console.log(`   Headings: ${terms.headings?.length || 0}`);
}

function extractTermString(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(v => {
      if (typeof v === 'string') return v;
      return v?.term || v?.name || v?.keyword || v?.text || '';
    }).filter(Boolean).join(', ');
  }
  return '';
}

function extractQuestions(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(v => {
      if (typeof v === 'string') return v;
      return v?.q || v?.question || v?.text || v?.title || '';
    }).filter(Boolean).slice(0, 15);
  }
  return [];
}

function extractHeadings(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(v => {
      if (typeof v === 'string') return v;
      return v?.heading || v?.text || v?.title || v?.h2 || '';
    }).filter(Boolean).slice(0, 15);
  }
  return [];
}

function countTerms(terms: NeuronTerms): number {
  let count = 0;
  if (terms.h1) count += terms.h1.split(',').length;
  if (terms.h2) count += terms.h2.split(',').length;
  if (terms.h3) count += terms.h3.split(',').length;
  if (terms.content_basic) count += terms.content_basic.split(',').length;
  if (terms.content_extended) count += terms.content_extended.split(',').length;
  if (terms.entities_basic) count += terms.entities_basic.split(',').length;
  if (terms.entities_extended) count += terms.entities_extended.split(',').length;
  if (terms.questions) count += terms.questions.length;
  if (terms.headings) count += terms.headings.length;
  return count;
}

/**
 * Generate synthetic SEO terms when NeuronWriter API is unavailable
 * This ensures content generation never blocks
 */
function generateFallbackTerms(keyword: string, reason: string): NeuronTerms {
  console.log(`[NeuronWriter] 🔧 Generating fallback terms (reason: ${reason})`);

  const words = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const baseWord = words[0] || keyword.split(' ')[0];

  const relatedTerms = words.length > 1
    ? words.slice(1).map(w => `${baseWord} ${w}`).join(', ')
    : `${baseWord} guide, ${baseWord} tips, ${baseWord} best practices`;

  return {
    h1: keyword,
    title: `${keyword}, ultimate guide, comprehensive`,
    h2: `how ${keyword} works, benefits of ${keyword}, ${keyword} tips, why ${keyword}, getting started with ${keyword}`,
    h3: `${keyword} basics, ${keyword} examples, common ${keyword} mistakes`,
    content_basic: `${keyword}, ${relatedTerms}, best, guide, tips, how to, what is, why, important, consider`,
    content_extended: `comprehensive, ultimate, professional, expert, effective, essential, proven, practical, step-by-step`,
    entities_basic: words.join(', '),
    entities_extended: '',
    questions: [
      `What is ${keyword}?`,
      `How does ${keyword} work?`,
      `Why is ${keyword} important?`,
      `What are the benefits of ${keyword}?`,
      `How to get started with ${keyword}?`
    ],
    headings: [
      `What is ${keyword}?`,
      `How ${keyword} Works`,
      `Benefits of ${keyword}`,
      `Getting Started with ${keyword}`,
      `${keyword} Best Practices`,
      `Common ${keyword} Mistakes to Avoid`
    ]
  };
}

/**
 * Clear all NeuronWriter caches
 */
export function clearNeuronWriterCache(): void {
  neuronTermsCache.clear();
  queryIdCache.clear();
  console.log('[NeuronWriter] 🧹 All caches cleared');
}

/**
 * Clear only terms cache (keeps query IDs)
 */
export function clearTermsCache(): void {
  neuronTermsCache.clear();
  console.log('[NeuronWriter] 🧹 Terms cache cleared');
}

// ==================== LEGACY COMPATIBILITY ====================

export const getNeuronWriterData = async (
  apiKey: string,
  projectId: string,
  keyword: string
): Promise<NeuronWriterData | null> => {
  if (!apiKey || !projectId) {
    console.warn('[NeuronWriter] Missing API key or project ID');
    return null;
  }

  console.log(`[NeuronWriter] Fetching content editor data for: "${keyword}"`);

  try {
    const terms = await fetchNeuronTerms(apiKey, projectId, keyword);

    if (!terms) {
      return null;
    }

    return {
      terms: [
        terms.content_basic,
        terms.content_extended
      ].filter(Boolean).join(', ').split(',').map(t => t.trim()).filter(Boolean),
      competitors: [],
      questions: terms.questions || [],
      headings: terms.headings || []
    };
  } catch (error: any) {
    console.error('[NeuronWriter] Error:', error.message);
    return null;
  }
};

// ==================== PROMPT FORMATTER ====================

export const formatNeuronTermsForPrompt = (terms: NeuronTerms | null): string => {
  if (!terms) return '';

  const sections: string[] = [];

  sections.push('=== NEURONWRITER SEO OPTIMIZATION TERMS ===');
  sections.push('CRITICAL: Use these terms to achieve 90%+ NeuronWriter score!\n');

  if (terms.h1) {
    sections.push(`## H1 TERMS (Must use in main heading):\n${terms.h1}\n`);
  }

  if (terms.title) {
    sections.push(`## TITLE TERMS (Use in page title):\n${terms.title}\n`);
  }

  if (terms.h2) {
    sections.push(`## H2 TERMS (Must use in subheadings):\n${terms.h2}\n`);
  }

  if (terms.h3) {
    sections.push(`## H3 TERMS (Use in sub-subheadings):\n${terms.h3}\n`);
  }

  if (terms.content_basic) {
    sections.push(`## CONTENT BASIC TERMS (REQUIRED - Use ALL of these in body text):\n${terms.content_basic}\n`);
  }

  if (terms.content_extended) {
    sections.push(`## CONTENT EXTENDED TERMS (Use as many as possible):\n${terms.content_extended}\n`);
  }

  if (terms.entities_basic) {
    sections.push(`## ENTITIES BASIC (Named entities to include):\n${terms.entities_basic}\n`);
  }

  if (terms.entities_extended) {
    sections.push(`## ENTITIES EXTENDED (Additional named entities):\n${terms.entities_extended}\n`);
  }

  if (terms.questions && terms.questions.length > 0) {
    sections.push(`## QUESTIONS TO ANSWER (Include in FAQ or content):\n${terms.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`);
  }

  if (terms.headings && terms.headings.length > 0) {
    sections.push(`## SUGGESTED H2 HEADINGS:\n${terms.headings.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n`);
  }

  sections.push('\n=== END NEURONWRITER TERMS ===');
  sections.push('INSTRUCTION: Incorporate ALL basic terms and as many extended terms as possible for maximum SEO score.');

  return sections.join('\n');
};

// ==================== SCORING ====================

export const calculateNeuronContentScore = (
  content: string,
  terms: NeuronTerms
): number => {
  if (!content || !terms) return 0;

  const contentLower = content.toLowerCase();
  let totalTerms = 0;
  let foundTerms = 0;

  const allTermsText = [
    terms.h1,
    terms.title,
    terms.h2,
    terms.content_basic,
    terms.content_extended
  ].filter(Boolean).join(' ');

  const termsList = allTermsText
    .split(/[,;]/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 2);

  totalTerms = termsList.length;

  for (const term of termsList) {
    if (contentLower.includes(term)) {
      foundTerms++;
    }
  }

  if (totalTerms === 0) return 100;

  return Math.round((foundTerms / totalTerms) * 100);
};

export const getMissingNeuronTerms = (
  content: string,
  terms: NeuronTerms,
  maxTerms: number = 20
): string[] => {
  if (!content || !terms) return [];

  const contentLower = content.toLowerCase();
  const missing: string[] = [];

  const allTermsText = [
    terms.content_basic,
    terms.content_extended,
    terms.h2
  ].filter(Boolean).join(' ');

  const termsList = allTermsText
    .split(/[,;]/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 2);

  for (const term of termsList) {
    if (!contentLower.includes(term)) {
      missing.push(term);
    }

    if (missing.length >= maxTerms) break;
  }

  return missing;
};

// ==================== EXPORTS ====================

export default {
  listNeuronProjects,
  fetchNeuronTerms,
  formatNeuronTermsForPrompt,
  calculateNeuronContentScore,
  getMissingNeuronTerms,
  getNeuronWriterData,
  clearNeuronWriterCache,
  clearTermsCache
};
