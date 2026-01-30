// =============================================================================
// SOTA UTILS.TS v1.0 - Core Utility Functions
// =============================================================================

/**
 * Call AI with retry logic and exponential backoff
 * Accepts a function that performs the actual AI call
 */
export const callAiWithRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  logPrefix: string = 'callAiWithRetry',
  retryCondition?: (error: any) => boolean
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry
      if (retryCondition && !retryCondition(error)) {
        throw error;
      }
      
      console.warn(`[${logPrefix}] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const waitTime = delayMs * Math.pow(2, attempt - 1);
        console.log(`[${logPrefix}] Retrying in ${waitTime}ms...`);
        await delay(waitTime);
      }
    }
  }
  
  throw lastError;
};

/**
 * Extract slug from URL or title
 */
export const extractSlugFromUrl = (urlOrTitle: string): string => {
  if (!urlOrTitle) return '';
  
  try {
    // Try to parse as URL first
    const url = new URL(urlOrTitle);
    const segments = url.pathname.split('/').filter(s => s.length > 0);
    if (segments.length > 0) {
      return segments[segments.length - 1];
    }
  } catch {
    // Not a valid URL, treat as title
  }
  
  // Convert title to slug
  return urlOrTitle
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
};

/**
 * Sanitize title for safe use
 */
export const sanitizeTitle = (title: string): string => {
  if (!title) return '';
  
  return title
    .replace(/[<>\"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
};

/**
 * Delay utility for async operations
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Debounce utility function
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
};

/**
 * Fetch from WordPress API with retry logic
 */
export const fetchWordPressWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> => {
  return callAiWithRetry(
    () => fetch(url, options),
    maxRetries,
    1000,
    'fetchWordPressWithRetry',
    (error) => error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')
  );
};

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Get item from localStorage with optional default value
 */
export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
};

/**
 * Set item in localStorage
 */
export const setStorageItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('[setStorageItem] Failed to save:', e);
  }
};

/**
 * Parse JSON with AI repair fallback (uses safeParseJSON internally)
 */
export const parseJsonWithAiRepair = async <T>(
  jsonString: string,
  fallback?: T
): Promise<T | null> => {
  return safeParseJSON<T>(jsonString, fallback ?? undefined);
};

/**
 * Process items concurrently with a limit
 */
export const processConcurrently = async <T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrencyLimit: number = 5
): Promise<R[]> => {
  const results: R[] = [];
  const queue = [...items];
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrencyLimit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      const currentIndex = index++;
      if (item !== undefined) {
        const result = await processor(item, currentIndex);
        results[currentIndex] = result;
      }
    }
  });

  await Promise.all(workers);
  return results;
};

/**
 * Safe JSON parsing with multiple fallback strategies
 */
export const safeParseJSON = <T>(
  jsonString: string,
  fallback?: T
): T | null => {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback ?? null;
  }
  
  // Strategy 1: Direct parse
  try {
    return JSON.parse(jsonString);
  } catch {}
  
  // Strategy 2: Clean and retry
  try {
    let cleaned = jsonString.trim();
    
    // Remove markdown code blocks
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    }
    
    return JSON.parse(cleaned);
  } catch {}
  
  // Strategy 3: Extract JSON from text
  try {
    const jsonMatch = jsonString.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}
  
  // Strategy 4: Fix common issues
  try {
    let fixed = jsonString
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":')
      .replace(/:\s*'([^']*)'/g, ':"$1"');
    
    return JSON.parse(fixed);
  } catch {}
  
  return fallback ?? null;
};

export default {
  callAiWithRetry,
  extractSlugFromUrl,
  sanitizeTitle,
  delay,
  debounce,
  fetchWordPressWithRetry,
  generateId,
  getStorageItem,
  setStorageItem,
  parseJsonWithAiRepair,
  processConcurrently,
  safeParseJSON
};
