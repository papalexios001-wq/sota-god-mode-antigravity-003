// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - TYPE DEFINITIONS v12.0
// Enterprise-Grade TypeScript Interfaces
// =============================================================================

// ==================== API & CLIENT TYPES ====================

export interface ApiClients {
  gemini: any | null;
  openai: any | null;
  anthropic: any | null;
  openrouter: any | null;
  groq: any | null;
}

export interface ApiKeys {
  geminiApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  openrouterApiKey: string;
  serperApiKey: string;
  groqApiKey: string;
}

export type ApiKeyStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export interface ApiKeyStatusMap {
  gemini: ApiKeyStatus;
  openai: ApiKeyStatus;
  anthropic: ApiKeyStatus;
  openrouter: ApiKeyStatus;
  serper: ApiKeyStatus;
  groq: ApiKeyStatus;
}

// ==================== WORDPRESS TYPES ====================

export interface WpConfig {
  url: string;
  username: string;
}

export interface WpPublishResult {
  success: boolean;
  message: string | React.ReactNode;
  link?: string;
  postId?: number;
}

export interface WpDiagnostics {
  status: 'running' | 'success' | 'error';
  posts: WpPost[];
  postTypes: string[];
  customPostTypes: CustomPostType[];
  error: string | null;
}

export interface WpPost {
  id: number;
  slug: string;
  title: { rendered: string } | string;
  status: string;
}

export interface CustomPostType {
  slug: string;
  name: string;
  rest_base: string;
}

// ==================== CONTENT TYPES ====================

export interface ContentItem {
  id: string;
  title: string;
  type: 'standard' | 'pillar' | 'cluster' | 'refresh';
  originalUrl?: string;
  status: 'idle' | 'generating' | 'done' | 'error' | 'publishing';
  statusText: string;
  generatedContent: GeneratedContent | null;
  crawledContent?: string | null;
  analysis?: ContentAnalysis | null;
}

export interface GeneratedContent {
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  primaryKeyword: string;
  semanticKeywords: string[];
  strategy: ContentStrategy;
  jsonLdSchema: Record<string, any>;
  socialMediaCopy: SocialMediaCopy;
  faqSection: FAQItem[];
  keyTakeaways: string[];
  outline: OutlineItem[];
  references: Reference[];
  imageDetails: ImageDetail[];
  serpData?: SerpResult[];
  neuronAnalysis?: NeuronAnalysis;
}

export interface ContentStrategy {
  targetAudience: string;
  searchIntent: string;
  competitorAnalysis: string;
  contentAngle: string;
}

export interface SocialMediaCopy {
  twitter: string;
  linkedIn: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface OutlineItem {
  heading: string;
  wordCount?: number;
  subheadings?: string[];
}

export interface Reference {
  title: string;
  url: string;
  source?: string;
  description?: string;
  verified?: boolean;
}

export interface ImageDetail {
  prompt: string;
  altText: string;
  title: string;
  placeholder: string;
  generatedImageSrc?: string;
}

export interface SerpResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
}

// ==================== SITEMAP & PAGE TYPES ====================

export interface SitemapPage {
  id: string;
  title: string;
  slug: string;
  lastMod: string | null;
  wordCount: number | null;
  crawledContent: string | null;
  healthScore: number | null;
  updatePriority: 'Critical' | 'High' | 'Medium' | 'Healthy' | null;
  justification: string | null;
  daysOld: number | null;
  isStale: boolean;
  publishedState: 'none' | 'draft' | 'published';
  status: 'idle' | 'analyzing' | 'analyzed' | 'error';
  analysis: ContentAnalysis | null;
}

export interface ContentAnalysis {
  critique: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  seoScore: number;
  readabilityScore: number;
}

// ==================== SEO & OPTIMIZATION TYPES ====================

export interface SeoCheck {
  id: string;
  valid: boolean;
  value: string | number;
  text: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  advice: string;
}

export interface ExpandedGeoTargeting {
  enabled: boolean;
  location: string;
  region: string;
  country: string;
  postalCode: string;
}

export interface GapAnalysisSuggestion {
  keyword: string;
  searchVolume?: number;
  difficulty?: number;
  opportunity: string;
  competitorsCovering: number;
  recommendedType: 'pillar' | 'cluster' | 'standard';
}

// ==================== NEURONWRITER TYPES ====================

export interface NeuronConfig {
  apiKey: string;
  projectId: string;
  enabled: boolean;
}

export interface NeuronProject {
  project: string;
  name: string;
  engine: string;
  language: string;
}

export interface NeuronAnalysis {
  terms_txt?: {
    h1?: string;
    title?: string;
    h2?: string;
    content_basic?: string;
    content_extended?: string;
  };
  contentScore?: number;
}

// ==================== SITE INFO TYPES ====================

export interface SiteInfo {
  orgName: string;
  orgUrl: string;
  logoUrl: string;
  orgSameAs: string[];
  authorName: string;
  authorUrl: string;
  authorSameAs: string[];
}

// ==================== GENERATION CONTEXT ====================

export interface GenerationContext {
  dispatch: React.Dispatch<any>;
  existingPages: SitemapPage[];
  siteInfo: SiteInfo;
  wpConfig: WpConfig;
  geoTargeting: ExpandedGeoTargeting;
  serperApiKey: string;
  apiKeyStatus: ApiKeyStatusMap;
  apiClients: ApiClients;
  selectedModel: string;
  openrouterModels: string[];
  selectedGroqModel: string;
  neuronConfig: NeuronConfig;
  excludedUrls?: string[];
  excludedCategories?: string[];
  priorityUrls?: string[];
  priorityOnlyMode?: boolean;
}

// ==================== QUALITY VALIDATION TYPES ====================

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  checks: QualityCheck[];
  recommendations: string[];
}

export interface QualityCheck {
  name: string;
  passed: boolean;
  value: string | number;
  target: string | number;
  weight: number;
}

// ==================== PERFORMANCE TYPES ====================

export interface PerformanceMetrics {
  optimizationSpeed: number;
  contentQualityScore: number;
  internalLinkDensity: number;
  semanticRichness: number;
  aeoScore: number;
  timestamp: number;
}

export interface OptimizationRecord {
  id: string;
  url: string;
  title: string;
  timestamp: number;
  beforeScore: number;
  afterScore: number;
  improvements: string[];
  duration: number;
}

// ==================== INTERNAL LINKING TYPES ====================

export interface InternalLinkSuggestion {
  anchorText: string;
  targetSlug: string;
  targetUrl: string;
  context: string;
  relevanceScore: number;
  placement: string;
}

export interface TopicCluster {
  pillarPage: SitemapPage;
  clusterPages: SitemapPage[];
  topicRelevance: number;
  keywords: string[];
}

// ==================== AEO TYPES ====================

export interface AEOSnippet {
  type: 'featured' | 'paragraph' | 'list' | 'table' | 'faq';
  content: string;
  score: number;
  optimization: string;
}

export interface AEOOptimizationResult {
  snippets: AEOSnippet[];
  overallScore: number;
  recommendations: string[];
  optimizedContent: string;
}

// ==================== AI TASK TYPES ====================

export interface AITask {
  id: string;
  promptKey: string;
  args: any[];
  model: string;
  priority: 'high' | 'medium' | 'low';
  retryCount?: number;
  maxRetries?: number;
}

export interface AITaskResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

// ==================== URL BATCH OPTIMIZER TYPES ====================

export interface URLQueueItem {
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  addedAt: string;
  result?: URLAnalysisResult;
}

export interface URLAnalysisResult {
  url: string;
  title: string;
  score: number;
  gaps: string[];
  opportunities: string[];
  recommendations: string[];
  error?: string;
}

export interface URLAnalysisRequest {
  urls: string[];
  analysisType: 'gap' | 'competitive' | 'seo-audit' | 'content-opportunity';
  focusKeywords?: string[];
  depth?: 'light' | 'medium' | 'deep';
}

// ==================== REFERENCE TYPES ====================

export interface ValidatedReference {
  title: string;
  url: string;
  source: string;
  description: string;
  category: string;
  verified: boolean;
  statusCode?: number;
}

export interface ReferenceCategory {
  name: string;
  authorityDomains: string[];
  searchModifiers: string[];
  excludeDomains: string[];
}

// ==================== COMPETITOR ANALYSIS TYPES ====================

export interface CompetitorGap {
  type: 'missing_topic' | 'outdated_data' | 'shallow_coverage' | 'missing_examples';
  topic: string;
  opportunity: string;
  priority: 'high' | 'medium' | 'low';
  competitorsCovering: number;
}

export interface CompetitorAnalysis {
  gaps: CompetitorGap[];
  competitorKeywords: string[];
  missingKeywords: string[];
  contentStrengths: string[];
  recommendedTopics: string[];
}

// ==================== STATE ACTION TYPES ====================

export type ItemsAction =
  | { type: 'SET_ITEMS'; payload: Partial<ContentItem>[] }
  | { type: 'UPDATE_STATUS'; payload: { id: string; status: ContentItem['status']; statusText: string } }
  | { type: 'SET_CONTENT'; payload: { id: string; content: GeneratedContent } }
  | { type: 'SET_CRAWLED_CONTENT'; payload: { id: string; content: string } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'CLEAR_ALL' };

// ==================== UTILITY TYPES ====================

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export interface ProgressState {
  current: number;
  total: number;
}

export interface BulkPublishLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

// ==================== PROMPT TYPES ====================

export interface PromptTemplate {
  systemInstruction: string;
  userPrompt: (...args: any[]) => string;
}

export interface PromptTemplates {
  [key: string]: PromptTemplate;
}


// =============================================================================
// ADD THESE NEW TYPES TO YOUR EXISTING types.ts FILE
// =============================================================================

// YouTube Video Type
export interface YouTubeVideo {
  title: string;
  videoId: string;
  channel: string;
  description: string;
  thumbnail: string;
  relevanceScore: number;
}

// Verified Reference Type
export interface VerifiedReference {
  title: string;
  url: string;
  domain: string;
  description: string;
  authority: 'high' | 'medium' | 'low';
  verified: boolean;
  category?: string;
}

// Generation Analytics Type
export interface GenerationAnalytics {
  phase: string;
  progress: number;
  details: Record<string, any>;
  timestamp: Date;
}

// Enhanced Generated Content (update existing if present)
export interface GeneratedContent {
  title: string;
  content: string;
  metaDescription: string;
  slug: string;
  schemaMarkup: string;
  primaryKeyword: string;
  semanticKeywords: string[];
  // NEW FIELDS:
  youtubeVideo?: {
    title: string;
    videoId: string;
    embedded: boolean;
  } | null;
  references?: {
    title: string;
    url: string;
    verified: boolean;
  }[];
  internalLinks?: {
    anchor: string;
    targetSlug: string;
    targetTitle: string;
    score: number;
    wordCount: number;
  }[];
}

// Internal Link Candidate Type
export interface InternalLinkCandidate {
  anchorText: string;
  targetSlug: string;
  targetTitle: string;
  qualityScore: number;
  wordCount: number;
  semanticRelevance: number;
  contextualFit: number;
  position: number;
  paragraphIndex: number;
}
