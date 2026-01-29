// =============================================================================
// SOTA NEURONWRITER INTEGRATION v13.0 - ENTERPRISE GRADE
// Uses Supabase Edge Function proxy for CORS-free API access
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
  content_basic?: string;
  content_extended?: string;
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

// ==================== PROXY HELPER ====================

const callNeuronWriterProxy = async (
  endpoint: string,
  apiKey: string,
  method: string = 'GET',
  body?: Record<string, unknown>
): Promise<ProxyResponse> => {
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL not configured. Please check your environment variables.');
  }

  const proxyUrl = `${SUPABASE_URL}/functions/v1/neuronwriter-proxy`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'X-NeuronWriter-Key': apiKey,
      },
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
      throw new Error(`Proxy error (${response.status}): ${errorText}`);
    }

    const result: ProxyResponse = await response.json();
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The NeuronWriter API took too long to respond.');
    }

    throw error;
  }
};

// ==================== API FUNCTIONS ====================

export const listNeuronProjects = async (apiKey: string): Promise<NeuronProject[]> => {
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error('Invalid NeuronWriter API key. Please enter a valid key.');
  }

  console.log('[NeuronWriter] Fetching projects via Edge Function...');

  try {
    const result = await callNeuronWriterProxy('/projects', apiKey, 'GET');

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

export const fetchNeuronTerms = async (
  apiKey: string,
  projectId: string,
  query: string
): Promise<NeuronTerms | null> => {
  if (!apiKey || !projectId || !query) {
    console.warn('[NeuronWriter] Missing required parameters');
    return null;
  }

  console.log(`[NeuronWriter] Fetching terms for: "${query}"`);

  try {
    const analysisResult = await callNeuronWriterProxy(
      `/projects/${projectId}/queries`,
      apiKey,
      'POST',
      { query }
    );

    if (!analysisResult.success) {
      console.warn('[NeuronWriter] Query creation failed:', analysisResult.error);
      return null;
    }

    const queryId = analysisResult.data?.id || analysisResult.data?.query_id;

    if (!queryId) {
      console.warn('[NeuronWriter] No query ID returned');
      return null;
    }

    let attempts = 0;
    const maxAttempts = 12;
    let terms: NeuronTerms | null = null;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[NeuronWriter] Polling for terms (attempt ${attempts}/${maxAttempts})...`);

      const termsResult = await callNeuronWriterProxy(
        `/projects/${projectId}/queries/${queryId}/terms`,
        apiKey,
        'GET'
      );

      if (termsResult.success && termsResult.data) {
        const termsData = termsResult.data;

        if (termsData.status === 'completed' || termsData.terms_txt || termsData.terms) {
          const termsTxt = termsData.terms_txt || termsData.terms || {};

          terms = {
            h1: termsTxt.h1 || termsTxt.H1 || '',
            title: termsTxt.title || termsTxt.Title || '',
            h2: termsTxt.h2 || termsTxt.H2 || '',
            content_basic: termsTxt.content_basic || termsTxt.content || '',
            content_extended: termsTxt.content_extended || termsTxt.extended || ''
          };

          console.log('[NeuronWriter] Terms fetched successfully');
          break;
        }

        if (termsData.status === 'failed' || termsData.error) {
          console.warn('[NeuronWriter] Analysis failed:', termsData.error);
          break;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    return terms;
  } catch (error: any) {
    console.error('[NeuronWriter] Failed to fetch terms:', error);
    return null;
  }
};

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
    const result = await callNeuronWriterProxy(
      `/projects/${projectId}/content-editor`,
      apiKey,
      'POST',
      {
        keyword,
        language: 'en',
        country: 'us',
      }
    );

    if (!result.success) {
      console.warn('[NeuronWriter] Content editor request failed:', result.error);
      return null;
    }

    const data = result.data;

    return {
      terms: extractTerms(data.terms || data.nlp_terms || []),
      competitors: extractCompetitors(data.competitors || data.serp || []),
      questions: data.questions || data.paa || data.people_also_ask || [],
      headings: data.headings || data.suggested_headings || [],
    };
  } catch (error: any) {
    console.error('[NeuronWriter] Error:', error.message);
    return null;
  }
};

// ==================== HELPER FUNCTIONS ====================

const extractTerms = (terms: any[]): string[] => {
  if (!Array.isArray(terms)) return [];

  return terms.map((t: any) => {
    if (typeof t === 'string') return t;
    return t.term || t.name || t.keyword || t.text || '';
  }).filter(Boolean);
};

const extractCompetitors = (competitors: any[]): string[] => {
  if (!Array.isArray(competitors)) return [];

  return competitors.map((c: any) => {
    if (typeof c === 'string') return c;
    return c.url || c.link || c.domain || '';
  }).filter(Boolean);
};

export const formatNeuronTermsForPrompt = (terms: NeuronTerms | null): string => {
  if (!terms) return '';

  const sections: string[] = [];

  if (terms.h1) {
    sections.push(`H1 Terms: ${terms.h1}`);
  }

  if (terms.title) {
    sections.push(`Title Terms: ${terms.title}`);
  }

  if (terms.h2) {
    sections.push(`H2 Terms: ${terms.h2}`);
  }

  if (terms.content_basic) {
    sections.push(`Content (Basic): ${terms.content_basic}`);
  }

  if (terms.content_extended) {
    sections.push(`Content (Extended): ${terms.content_extended}`);
  }

  return sections.join('\n');
};

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
  getNeuronWriterData
};
