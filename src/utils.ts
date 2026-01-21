/**
 * ============================================================================
 * ENTERPRISE-GRADE UTILITY FUNCTIONS
 * ============================================================================
 * 
 * @fileoverview Production-ready utility functions with robust error handling,
 * retry logic, JSON parsing, and comprehensive helper methods.
 * 
 * @version 2.0.0
 * @license MIT
 * @author Enterprise Solutions Team
 * 
 * Features:
 * - Exponential backoff retry logic
 * - Robust JSON parsing with AI repair fallback
 * - Concurrent processing with controlled parallelism
 * - Type-safe storage helpers
 * - Comprehensive string/URL/array/object utilities
 * 
 * ============================================================================
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error) => boolean;
}

export interface ConcurrencyOptions<T, R> {
  concurrency?: number;
  onProgress?: (current: number, total: number, item: T) => void;
  shouldStop?: () => boolean;
  onError?: (error: Error, item: T, index: number) => R | null;
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Executes an async function with exponential backoff retry logic.
 * 
 * @template T - Return type of the async function
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the function result
 * @throws Last encountered error after all retries exhausted
 * 
 * @example
 * ```typescript
 * const result = await callAiWithRetry(
 *   () => fetchAIResponse(prompt),
 *   { maxRetries: 5, baseDelay: 1000 }
 * );
 * ```
 */
export const callAiWithRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // Check for non-retryable errors
      const statusCode = (error as { status?: number })?.status;
      if (statusCode === 401 || statusCode === 403) {
        throw err;
      }

      // Check custom retry condition
      if (!shouldRetry(err)) {
        throw err;
      }

      // Calculate delay with exponential backoff and jitter
      if (attempt < maxRetries - 1) {
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * exponentialDelay;
        const delay = Math.min(exponentialDelay + jitter, maxDelay);
        
        console.warn(
          `[callAiWithRetry] Attempt ${attempt + 1}/${maxRetries} failed. ` +
          `Retrying in ${Math.round(delay)}ms...`,
          err.message
        );
        
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("All retry attempts failed");
};

// ============================================================================
// DEBOUNCE & THROTTLE
// ============================================================================

/**
 * Creates a debounced version of a function that delays execution
 * until after the specified wait time has elapsed since the last call.
 * 
 * @template T - Function type
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Creates a throttled version of a function that only executes
 * at most once per specified time period.
 * 
 * @template T - Function type
 * @param fn - Function to throttle
 * @param limit - Minimum time between executions in milliseconds
 * @returns Throttled function
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
};

// ============================================================================
// WORDPRESS UTILITIES
// ============================================================================

/**
 * Fetches from WordPress REST API with automatic retry logic.
 * 
 * @param url - WordPress API endpoint URL
 * @param options - Fetch request options
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise resolving to Response object
 */
export const fetchWordPressWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> => {
  return callAiWithRetry(
    async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      
      if (!response.ok && response.status >= 500) {
        throw new Error(`WordPress API error: ${response.status}`);
      }
      
      return response;
    },
    { maxRetries, baseDelay: 1000 }
  );
};

// ============================================================================
// SLUG EXTRACTION
// ============================================================================

/**
 * Extracts the slug from a URL path.
 * 
 * @param url - The URL to extract slug from
 * @returns The extracted slug or empty string
 * 
 * @example
 * ```typescript
 * extractSlugFromUrl("https://example.com/blog/my-post/")
 * // Returns: "my-post"
 * ```
 */
export const extractSlugFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.replace(/\//g, "/");
    const segments = pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || segments[segments.length - 2] || "";
  } catch {
    // If not a valid URL, treat as path or slug
    return url
      .replace(/\//g, "/")
      .split("/")
      .filter(Boolean)
      .pop() || url;
  }
};

// ============================================================================
// TITLE SANITIZATION
// ============================================================================

/**
 * Sanitizes a title, providing human-readable fallback from slug if needed.
 * 
 * @param title - The title to sanitize
 * @param fallbackSlug - Optional fallback slug to convert to title
 * @returns Sanitized title string
 */
export const sanitizeTitle = (title: string, fallbackSlug?: string): string => {
  const trimmedTitle = title?.trim();
  
  if (!trimmedTitle || trimmedTitle === "Untitled" || trimmedTitle.startsWith("http")) {
    if (fallbackSlug) {
      return fallbackSlug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
    return "Untitled Page";
  }
  
  return trimmedTitle;
};

// ============================================================================
// JSON PARSING - ENTERPRISE GRADE
// ============================================================================

/**
 * Strips markdown code block wrappers from AI responses.
 * Handles various formats: ```json, ```JSON, ```javascript, etc.
 * 
 * @param text - The text to clean
 * @returns Cleaned text without markdown wrappers
 */
export const stripMarkdownCodeBlocks = (text: string): string => {
  if (!text || typeof text !== "string") return "";

  let cleaned = text.trim();

  // Remove opening code block with optional language identifier
  const codeBlockStartRegex = /^```(?:json|JSON|javascript|Javascript|JS|js|typescript|ts|html|HTML)?\s*/;
  const codeBlockEndRegex = /```\s*$/;

  if (codeBlockStartRegex.test(cleaned)) {
    cleaned = cleaned.replace(codeBlockStartRegex, "");
  }

  if (codeBlockEndRegex.test(cleaned)) {
    cleaned = cleaned.replace(codeBlockEndRegex, "");
  }

  return cleaned.trim();
};

/**
 * Extracts JSON from potentially messy AI response text.
 * Handles markdown wrappers, extra text before/after JSON, nested structures.
 * 
 * @param response - The raw response text
 * @returns Extracted JSON string
 * @throws Error if no valid JSON structure found
 */
export const extractJsonFromResponse = (response: string): string => {
  if (!response || typeof response !== "string") {
    throw new Error("Empty or invalid response");
  }

  let cleaned = response.trim();

  // Step 1: Strip markdown code blocks
  cleaned = stripMarkdownCodeBlocks(cleaned);

  // Step 2: Find JSON boundaries using balanced bracket matching
  const jsonObjectMatch = findBalancedJson(cleaned, "{", "}");
  const jsonArrayMatch = findBalancedJson(cleaned, "[", "]");

  // Determine which match to use based on position
  if (jsonObjectMatch && jsonArrayMatch) {
    const objectIndex = cleaned.indexOf(jsonObjectMatch);
    const arrayIndex = cleaned.indexOf(jsonArrayMatch);
    
    if (objectIndex !== -1 && arrayIndex !== -1) {
      cleaned = objectIndex < arrayIndex ? jsonObjectMatch : jsonArrayMatch;
    } else if (objectIndex !== -1) {
      cleaned = jsonObjectMatch;
    } else {
      cleaned = jsonArrayMatch;
    }
  } else if (jsonObjectMatch) {
    cleaned = jsonObjectMatch;
  } else if (jsonArrayMatch) {
    cleaned = jsonArrayMatch;
  }

  return cleaned.trim();
};

/**
 * Finds balanced JSON structure in text using bracket matching.
 * 
 * @param text - Text to search
 * @param openChar - Opening bracket character
 * @param closeChar - Closing bracket character
 * @returns Balanced JSON string or null
 */
const findBalancedJson = (
  text: string,
  openChar: string,
  closeChar: string
): string | null => {
  const startIndex = text.indexOf(openChar);
  if (startIndex === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === openChar) depth++;
      if (char === closeChar) depth--;

      if (depth === 0) {
        return text.substring(startIndex, i + 1);
      }
    }
  }

  // Fallback to simple regex if balanced matching fails
  const simpleRegex = new RegExp(
    `\\${openChar}[\\s\\S]*\\${closeChar}`
  );
  const match = text.match(simpleRegex);
  return match ? match[0] : null;
};

/**
 * Cleans up common JSON formatting issues from AI responses.
 * 
 * @param jsonString - The JSON string to clean
 * @returns Cleaned JSON string
 */
const cleanupJsonString = (jsonString: string): string => {
  let cleaned = jsonString;

  // Remove trailing commas before closing brackets
  cleaned = cleaned.replace(/,\s*]/g, "]");
  cleaned = cleaned.replace(/,\s*}/g, "}");

  // Fix unquoted property names
  cleaned = cleaned.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Remove problematic control characters while preserving valid escapes
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Fix single quotes used for strings (careful transformation)
  cleaned = cleaned.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, content) => {
    // Only convert if it looks like a JSON string value
    if (match.includes(":") || match.includes(",")) {
      return match; // Don't transform if it contains JSON syntax
    }
    return `"${content.replace(/"/g, '\\"')}"`;
  });

  return cleaned;
};

/**
 * Parses JSON with multiple fallback strategies and optional AI repair.
 * 
 * @param responseText - The raw response text from AI
 * @param aiRepairer - Optional async function to repair broken JSON using AI
 * @returns Parsed JSON object
 * @throws Error if all parsing attempts fail
 * 
 * @example
 * ```typescript
 * const data = await parseJsonWithAiRepair(
 *   aiResponse,
 *   async (broken) => await askAiToFixJson(broken)
 * );
 * ```
 */
export const parseJsonWithAiRepair = async <T = unknown>(
  responseText: string,
  aiRepairer?: (brokenText: string) => Promise<string>
): Promise<T> => {
  if (!responseText || typeof responseText !== "string") {
    throw new Error("Invalid response text for JSON parsing");
  }

  // Step 1: Extract and clean JSON
  let cleanedJson: string;
  try {
    cleanedJson = extractJsonFromResponse(responseText);
  } catch {
    console.warn("[parseJsonWithAiRepair] Extraction failed, using raw text");
    cleanedJson = responseText.trim();
  }

  // Step 2: Direct parse attempt
  try {
    return JSON.parse(cleanedJson) as T;
  } catch (firstError) {
    console.warn("[parseJsonWithAiRepair] Direct parse failed, attempting cleanup...");
  }

  // Step 3: Parse with cleanup
  try {
    const furtherCleaned = cleanupJsonString(cleanedJson);
    return JSON.parse(furtherCleaned) as T;
  } catch (secondError) {
    console.warn("[parseJsonWithAiRepair] Cleanup parse failed, trying AI repair...");
  }

  // Step 4: AI repair as last resort
  if (aiRepairer) {
    try {
      const repairedText = await aiRepairer(cleanedJson);
      const repairedCleaned = extractJsonFromResponse(repairedText);
      return JSON.parse(repairedCleaned) as T;
    } catch (repairError) {
      console.error("[parseJsonWithAiRepair] AI repair failed:", repairError);
    }
  }

  // Provide detailed error for debugging
  const preview = responseText.substring(0, 200).replace(/\n/g, " ");
  throw new Error(
    `JSON parsing failed after all attempts. ` +
    `Response preview: "${preview}..." ` +
    `(Length: ${responseText.length} chars)`
  );
};

// ============================================================================
// CONCURRENT PROCESSING
// ============================================================================

/**
 * Processes items concurrently with controlled parallelism and progress tracking.
 * 
 * @template T - Input item type
 * @template R - Result type
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param options - Concurrency configuration options
 * @returns Array of results in original order
 * 
 * @example
 * ```typescript
 * const results = await processConcurrently(
 *   urls,
 *   async (url) => await fetchData(url),
 *   { 
 *     concurrency: 5,
 *     onProgress: (current, total) => console.log(`${current}/${total}`)
 *   }
 * );
 * ```
 */
export const processConcurrently = async <T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: ConcurrencyOptions<T, R> = {}
): Promise<R[]> => {
  const {
    concurrency = 3,
    onProgress,
    shouldStop,
    onError,
  } = options;

  const results: R[] = new Array(items.length);
  let currentIndex = 0;
  let completedCount = 0;
  const total = items.length;

  const processNext = async (): Promise<void> => {
    while (currentIndex < items.length) {
      if (shouldStop?.()) {
        console.log("[processConcurrently] Stop signal received, halting...");
        break;
      }

      const index = currentIndex++;
      const item = items[index];

      try {
        const result = await processor(item, index);
        results[index] = result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`[processConcurrently] Error at index ${index}:`, err.message);
        
        if (onError) {
          const fallback = onError(err, item, index);
          results[index] = fallback as R;
        } else {
          results[index] = null as R;
        }
      }

      completedCount++;
      onProgress?.(completedCount, total, item);
    }
  };

  // Initialize worker pool
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => processNext());
  await Promise.all(workers);

  return results;
};

// ============================================================================
// STORAGE HELPERS
// ============================================================================

/**
 * Retrieves an item from localStorage with type-safe JSON parsing.
 * 
 * @template T - Expected return type
 * @param key - Storage key
 * @param defaultValue - Default value if key not found or parse fails
 * @returns Stored value or default
 */
export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item === null || item === undefined) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`[getStorageItem] Parse error for "${key}":`, error);
    return defaultValue;
  }
};

/**
 * Stores an item in localStorage with JSON stringification.
 * 
 * @template T - Value type
 * @param key - Storage key
 * @param value - Value to store
 * @returns Success boolean
 */
export const setStorageItem = <T>(key: string, value: T): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[setStorageItem] Failed to save "${key}":`, error);
    return false;
  }
};

/**
 * Removes an item from localStorage.
 * 
 * @param key - Storage key to remove
 * @returns Success boolean
 */
export const removeStorageItem = (key: string): boolean => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`[removeStorageItem] Failed to remove "${key}":`, error);
    return false;
  }
};

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generates a unique ID combining timestamp and random string.
 * 
 * @returns Unique ID string
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Generates a cryptographically-suitable UUID v4.
 * Uses crypto API when available, falls back to Math.random.
 * 
 * @returns UUID v4 string
 */
export const generateUUID = (): string => {
  // Use crypto API if available for better randomness
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ============================================================================
// TEXT UTILITIES
// ============================================================================

/**
 * Truncates text to specified length with configurable ellipsis.
 * 
 * @param text - Text to truncate
 * @param maxLength - Maximum length including ellipsis
 * @param ellipsis - Ellipsis string (default: "...")
 * @returns Truncated text
 */
export const truncateText = (
  text: string,
  maxLength: number,
  ellipsis: string = "..."
): string => {
  if (!text || text.length <= maxLength) return text || "";
  return text.substring(0, maxLength - ellipsis.length) + ellipsis;
};

/**
 * Escapes special regex characters in a string for safe regex construction.
 * 
 * @param string - String to escape
 * @returns Escaped string safe for regex
 */
export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Converts a string to Title Case.
 * 
 * @param str - String to convert
 * @returns Title case string
 */
export const toTitleCase = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Converts a string to URL-safe slug format.
 * 
 * @param str - String to convert
 * @returns Slug string
 */
export const toSlug = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * Strips HTML tags from a string, preserving text content.
 * 
 * @param html - HTML string
 * @returns Plain text string
 */
export const stripHtmlTags = (html: string): string => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "");
};

/**
 * Decodes HTML entities in a string.
 * 
 * @param text - Text with HTML entities
 * @returns Decoded text
 */
export const decodeHtmlEntities = (text: string): string => {
  if (!text) return "";
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };
  return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
};

// ============================================================================
// URL UTILITIES
// ============================================================================

/**
 * Validates if a string is a valid URL.
 * 
 * @param urlString - String to validate
 * @returns True if valid URL
 */
export const isValidUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Normalizes a URL by standardizing protocol and removing trailing slashes.
 * 
 * @param url - URL to normalize
 * @returns Normalized URL
 */
export const normalizeUrl = (url: string): string => {
  let normalized = url.trim();

  // Add https if no protocol specified
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = "https://" + normalized;
  }

  // Remove trailing slash (but preserve root path)
  if (normalized.endsWith("/") && normalized.split("/").length > 4) {
    normalized = normalized.replace(/\/$/, "");
  }

  return normalized;
};

/**
 * Extracts the domain from a URL without www prefix.
 * 
 * @param url - URL to extract domain from
 * @returns Domain string or empty string on error
 */
export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/**
 * Parses URL query parameters into an object.
 * 
 * @param url - URL to parse
 * @returns Object containing URL parameters
 */
export const getUrlParams = (url: string): Record<string, string> => {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
};

/**
 * Builds a URL with query parameters.
 * 
 * @param baseUrl - Base URL
 * @param params - Query parameters object
 * @returns URL with encoded query parameters
 */
export const buildUrl = (
  baseUrl: string,
  params: Record<string, string | number | boolean>
): string => {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

/**
 * Returns a promise that resolves after specified delay.
 * 
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after delay
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Executes a promise with a timeout.
 * 
 * @template T - Promise return type
 * @param promise - Promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom timeout error message
 * @returns Promise result or throws on timeout
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = "Operation timed out"
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
};

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

/**
 * Creates a deep clone of an object using structured cloning when available.
 * 
 * @template T - Object type
 * @param obj - Object to clone
 * @returns Deep cloned object
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== "object") return obj;
  
  // Use structured clone if available (modern browsers)
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(obj);
    } catch {
      // Fall through to JSON method
    }
  }
  
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
};

/**
 * Checks if an object is empty (has no own enumerable properties).
 * 
 * @param obj - Object to check
 * @returns True if object is empty
 */
export const isEmptyObject = (obj: Record<string, unknown>): boolean => {
  return obj !== null && typeof obj === "object" && Object.keys(obj).length === 0;
};

/**
 * Picks specified keys from an object.
 * 
 * @template T - Source object type
 * @template K - Key type
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns New object with only picked keys
 */
export const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  });
  return result;
};

/**
 * Omits specified keys from an object.
 * 
 * @template T - Source object type
 * @template K - Key type
 * @param obj - Source object
 * @param keys - Keys to omit
 * @returns New object without omitted keys
 */
export const omit = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
};

/**
 * Deep merges multiple objects together.
 * 
 * @template T - Object type
 * @param target - Target object
 * @param sources - Source objects to merge
 * @returns Merged object
 */
export const deepMerge = <T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T => {
  if (!sources.length) return target;
  
  const source = sources.shift();
  if (!source) return target;

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        sourceValue &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        target[key] = deepMerge(
          { ...targetValue } as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        target[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return deepMerge(target, ...sources);
};

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Removes duplicate values from an array.
 * 
 * @template T - Array element type
 * @param arr - Array to deduplicate
 * @returns Array with unique values
 */
export const uniqueArray = <T>(arr: T[]): T[] => {
  return [...new Set(arr)];
};

/**
 * Removes duplicate objects from array based on a key.
 * 
 * @template T - Array element type
 * @param arr - Array to deduplicate
 * @param key - Key to use for uniqueness comparison
 * @returns Array with unique objects
 */
export const uniqueByKey = <T extends Record<string, unknown>>(
  arr: T[],
  key: keyof T
): T[] => {
  const seen = new Set();
  return arr.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

/**
 * Splits an array into chunks of specified size.
 * 
 * @template T - Array element type
 * @param arr - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 */
export const chunkArray = <T>(arr: T[], size: number): T[][] => {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

/**
 * Shuffles an array using Fisher-Yates algorithm.
 * 
 * @template T - Array element type
 * @param arr - Array to shuffle
 * @returns New shuffled array
 */
export const shuffleArray = <T>(arr: T[]): T[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Groups array elements by a key function.
 * 
 * @template T - Array element type
 * @template K - Key type
 * @param arr - Array to group
 * @param keyFn - Function to extract group key
 * @returns Map of grouped elements
 */
export const groupBy = <T, K extends string | number | symbol>(
  arr: T[],
  keyFn: (item: T) => K
): Record<K, T[]> => {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
};

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Formats a date to ISO date string (YYYY-MM-DD).
 * 
 * @param date - Date to format
 * @returns ISO date string
 */
export const formatDateISO = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

/**
 * Gets the current year.
 * 
 * @returns Current year number
 */
export const getCurrentYear = (): number => {
  return new Date().getFullYear();
};

/**
 * Calculates the number of days between two dates.
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days between dates
 */
export const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
};

/**
 * Checks if a date is today.
 * 
 * @param date - Date to check
 * @returns True if date is today
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return formatDateISO(date) === formatDateISO(today);
};

/**
 * Formats a date to relative time string (e.g., "2 hours ago").
 * 
 * @param date - Date to format
 * @returns Relative time string
 */
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  
  return formatDateISO(date);
};

// ============================================================================
// NUMBER UTILITIES
// ============================================================================

/**
 * Clamps a number between minimum and maximum values.
 * 
 * @param num - Number to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped number
 */
export const clamp = (num: number, min: number, max: number): number => {
  return Math.min(Math.max(num, min), max);
};

/**
 * Formats a number with locale-specific thousand separators.
 * 
 * @param num - Number to format
 * @param locale - Locale string (default: "en-US")
 * @returns Formatted number string
 */
export const formatNumber = (num: number, locale: string = "en-US"): string => {
  return num.toLocaleString(locale);
};

/**
 * Rounds a number to specified decimal places.
 * 
 * @param num - Number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
export const roundTo = (num: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

/**
 * Formats bytes to human-readable string.
 * 
 * @param bytes - Number of bytes
 * @param decimals - Decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 MB")
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates an email address format.
 * 
 * @param email - Email to validate
 * @returns True if valid email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Checks if a value is nullish (null or undefined).
 * 
 * @param value - Value to check
 * @returns True if nullish
 */
export const isNullish = (value: unknown): value is null | undefined => {
  return value === null || value === undefined;
};

/**
 * Checks if a value is a non-empty string.
 * 
 * @param value - Value to check
 * @returns True if non-empty string
 */
export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Retry & Async
  callAiWithRetry,
  debounce,
  throttle,
  delay,
  withTimeout,
  
  // WordPress
  fetchWordPressWithRetry,
  extractSlugFromUrl,
  sanitizeTitle,
  
  // JSON Parsing
  stripMarkdownCodeBlocks,
  extractJsonFromResponse,
  parseJsonWithAiRepair,
  
  // Concurrent Processing
  processConcurrently,
  
  // Storage
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  
  // ID Generation
  generateId,
  generateUUID,
  
  // Text
  truncateText,
  escapeRegExp,
  toTitleCase,
  toSlug,
  stripHtmlTags,
  decodeHtmlEntities,
  
  // URL
  isValidUrl,
  normalizeUrl,
  extractDomain,
  getUrlParams,
  buildUrl,
  
  // Object
  deepClone,
  isEmptyObject,
  pick,
  omit,
  deepMerge,
  
  // Array
  uniqueArray,
  uniqueByKey,
  chunkArray,
  shuffleArray,
  groupBy,
  
  // Date
  formatDateISO,
  getCurrentYear,
  daysBetween,
  isToday,
  formatRelativeTime,
  
  // Number
  clamp,
  formatNumber,
  roundTo,
  formatBytes,
  
  // Validation
  isValidEmail,
  isNullish,
  isNonEmptyString,
};
