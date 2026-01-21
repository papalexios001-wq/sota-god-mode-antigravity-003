// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - UTILITY FUNCTIONS v12.0
// Enterprise-Grade Utilities with Error Handling
// =============================================================================

import { SortConfig } from './types';

// ==================== RETRY & RESILIENCE ====================

/**
 * Calls an async function with exponential backoff retry logic
 */
export const callAiWithRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on authentication errors
      if (error?.status === 401 || error?.status === 403) {
        throw error;
      }
      
      // Don't retry on rate limits without waiting
      if (error?.status === 429) {
        const retryAfter = parseInt(error.headers?.['retry-after'] || '60', 10);
        await delay(retryAfter * 1000);
        continue;
      }
      
      if (attempt < maxRetries - 1) {
        const backoffDelay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`[Retry] Attempt ${attempt + 1} failed, retrying in ${Math.round(backoffDelay)}ms...`);
        await delay(backoffDelay);
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
};

/**
 * Fetches WordPress API with retry logic
 */
export const fetchWordPressWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> => {
  return callAiWithRetry(async () => {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok && response.status !== 400 && response.status !== 404) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`WordPress API Error (${response.status}): ${errorText}`);
    }
    
    return response;
  }, maxRetries);
};

// ==================== DEBOUNCE & THROTTLE ====================

/**
 * Creates a debounced version of a function
 */
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Creates a throttled version of a function
 */
export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// ==================== ASYNC UTILITIES ====================

/**
 * Delays execution for specified milliseconds
 */
export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Processes items concurrently with a limit
 */
export const processConcurrently = async <T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrencyLimit: number = 5,
  onProgress?: (current: number, total: number) => void,
  shouldStop?: () => boolean
): Promise<R[]> => {
  const results: R[] = [];
  let currentIndex = 0;
  let completedCount = 0;

  const processNext = async (): Promise<void> => {
    while (currentIndex < items.length) {
      if (shouldStop?.()) return;
      
      const index = currentIndex++;
      const item = items[index];
      
      try {
        const result = await processor(item, index);
        results[index] = result;
      } catch (error) {
        console.error(`Error processing item ${index}:`, error);
        results[index] = null as any;
      }
      
      completedCount++;
      onProgress?.(completedCount, items.length);
    }
  };

  const workers = Array(Math.min(concurrencyLimit, items.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);
  return results;
};

// ==================== STRING UTILITIES ====================

/**
 * Sanitizes a title, extracting from URL if needed
 */
export const sanitizeTitle = (title: string, slug?: string): string => {
  if (!title || title === 'Untitled' || title.startsWith('http')) {
    if (slug) {
      return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
    }
    return 'Untitled';
  }
  return title.trim();
};

/**
 * Extracts slug from a full URL
 */
export const extractSlugFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.replace(/^\/|\/$/g, '');
    const segments = pathname.split('/');
    return segments[segments.length - 1] || segments[segments.length - 2] || 'page';
  } catch {
    // If not a valid URL, treat as slug
    return url.replace(/^\/|\/$/g, '').split('/').pop() || 'page';
  }
};

/**
 * Escapes special regex characters in a string
 */
export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Truncates text to specified length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Converts string to URL-friendly slug
 */
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ==================== JSON UTILITIES ====================

/**
 * Parses JSON with AI-powered repair for malformed JSON
 */
export const parseJsonWithAiRepair = async (
  jsonString: string,
  aiRepairer: (brokenJson: string) => Promise<string>
): Promise<any> => {
  // Clean common issues
  let cleaned = jsonString
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  
  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('[JSON Parse] Initial parse failed, attempting repair...');
  }
  
  // Try to extract JSON from markdown code blocks
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Continue to AI repair
    }
  }
  
  // Use AI to repair
  try {
    const repairedJson = await aiRepairer(cleaned);
    const cleanedRepair = repairedJson
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleanedRepair);
  } catch (e) {
    console.error('[JSON Parse] AI repair failed:', e);
    throw new Error('Failed to parse JSON even after AI repair');
  }
};

/**
 * Safely parses JSON without throwing
 */
export const safeJsonParse = <T>(jsonString: string, defaultValue: T): T => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
};

// ==================== VALIDATION UTILITIES ====================

/**
 * Checks if a value is null or undefined
 */
export const isNullish = (value: any): value is null | undefined => {
  return value === null || value === undefined;
};

/**
 * Validates if a string is a valid sort key
 */
export const isValidSortKey = (key: string, validKeys: string[]): boolean => {
  return validKeys.includes(key);
};

/**
 * Validates URL format
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ==================== SORTING UTILITIES ====================

/**
 * Generic sort function for arrays
 */
export const sortItems = <T>(
  items: T[],
  config: SortConfig,
  getField: (item: T, key: string) => any
): T[] => {
  return [...items].sort((a, b) => {
    const aVal = getField(a, config.key);
    const bVal = getField(b, config.key);
    
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const comparison = aVal < bVal ? -1 : 1;
    return config.direction === 'asc' ? comparison : -comparison;
  });
};

// ==================== DOM UTILITIES ====================

/**
 * Sanitizes HTML content, removing dangerous tags
 */
export const sanitizeHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Remove script tags
  doc.querySelectorAll('script').forEach(el => el.remove());
  
  // Remove on* attributes
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });
  
  return doc.body.innerHTML;
};

/**
 * Extracts plain text from HTML
 */
export const htmlToText = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

/**
 * Counts words in text
 */
export const countWords = (text: string): number => {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
};

// ==================== STORAGE UTILITIES ====================

/**
 * Safely gets item from localStorage
 */
export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

/**
 * Safely sets item in localStorage
 */
export const setStorageItem = (key: string, value: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save to localStorage (key: ${key}):`, e);
  }
};

/**
 * Removes item from localStorage
 */
export const removeStorageItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error(`Failed to remove from localStorage (key: ${key}):`, e);
  }
};

// ==================== DATE UTILITIES ====================

/**
 * Formats date to locale string
 */
export const formatDate = (date: Date | string | number): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Calculates days between two dates
 */
export const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
};

/**
 * Gets relative time string (e.g., "2 days ago")
 */
export const getRelativeTime = (date: Date | string | number): string => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

// ==================== CRYPTO UTILITIES ====================

/**
 * Generates a unique ID
 */
export const generateId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Simple hash function for strings
 */
export const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};
