import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ==================== TYPES ====================
interface SEOMetrics {
  overallScore: number;
  titleScore: number;
  metaDescriptionScore: number;
  keywordDensity: number;
  readabilityScore: number;
  entityDensity: number;
  internalLinkCount: number;
  externalLinkCount: number;
  wordCount: number;
  headingStructure: HeadingAnalysis;
  contentGaps: string[];
}

interface HeadingAnalysis {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4Count: number;
  hasProperHierarchy: boolean;
  issues: string[];
}

interface AIDetectionResult {
  probability: number;
  burstinessScore: number;
  perplexityVariance: number;
  sentenceLengthVariance: number;
  flaggedPhrases: string[];
  humanizationTips: string[];
}

interface CompetitorAnalysis {
  url: string;
  title: string;
  wordCount: number;
  keywordDensity: number;
  entityCount: number;
  headingCount: number;
  uniqueTopics: string[];
  missingInYours: string[];
}

interface EntityHighlight {
  entity: string;
  type: 'PERSON' | 'ORGANIZATION' | 'PRODUCT' | 'LOCATION' | 'DATE' | 'METRIC';
  count: number;
  positions: number[];
  salience: number;
}

interface SERPPreview {
  title: string;
  url: string;
  metaDescription: string;
  structuredData: boolean;
  estimatedCTR: number;
  titlePixelWidth: number;
  descriptionTruncated: boolean;
}

interface DashboardProps {
  content: string;
  title: string;
  metaDescription: string;
  targetKeyword: string;
  existingPages: Array<{ title: string; slug: string; url: string }>;
  serpData?: any[];
  onMetricsUpdate?: (metrics: SEOMetrics) => void;
}

// ==================== MAIN COMPONENT ====================
export const ContentIntelligenceDashboard: React.FC<DashboardProps> = ({
  content,
  title,
  metaDescription,
  targetKeyword,
  existingPages,
  serpData,
  onMetricsUpdate
}) => {
  // State Management
  const [seoMetrics, setSeoMetrics] = useState<SEOMetrics | null>(null);
  const [aiDetection, setAiDetection] = useState<AIDetectionResult | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorAnalysis[]>([]);
  const [entities, setEntities] = useState<EntityHighlight[]>([]);
  const [serpPreview, setSerpPreview] = useState<SERPPreview | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'seo' | 'ai' | 'competitors' | 'entities'>('seo');

  // ==================== ANALYSIS FUNCTIONS ====================

  // Real-time SEO Score Calculator
  const calculateSEOScore = useCallback((html: string, keyword: string): SEOMetrics => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const textContent = doc.body.textContent || '';
    const words = textContent.split(/\s+/).filter(w => w.length > 0);

    // Word count analysis
    const wordCount = words.length;
    const wordCountScore = wordCount >= 2500 && wordCount <= 3500 ? 100 :
      wordCount >= 2000 && wordCount <= 4000 ? 80 :
        wordCount >= 1500 ? 60 : 40;

    // Keyword density analysis
    const keywordLower = keyword.toLowerCase();
    const keywordOccurrences = (textContent.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
    const keywordDensity = (keywordOccurrences / wordCount) * 100;
    const densityScore = keywordDensity >= 0.5 && keywordDensity <= 2.5 ? 100 :
      keywordDensity >= 0.3 && keywordDensity <= 3.0 ? 70 : 40;

    // Heading structure analysis
    const h1s = doc.querySelectorAll('h1');
    const h2s = doc.querySelectorAll('h2');
    const h3s = doc.querySelectorAll('h3');
    const h4s = doc.querySelectorAll('h4');

    const headingIssues: string[] = [];
    if (h1s.length !== 1) headingIssues.push(`Found ${h1s.length} H1 tags (should be exactly 1)`);
    if (h2s.length < 4) headingIssues.push(`Only ${h2s.length} H2 tags (recommend 4-10)`);
    if (h2s.length > 0 && h3s.length === 0) headingIssues.push('No H3 subheadings found');

    const headingScore = h1s.length === 1 ? (h2s.length >= 4 ? 100 : 70) : 40;

    // Internal link analysis
    const links = doc.querySelectorAll('a[href]');
    let internalCount = 0;
    let externalCount = 0;

    links.forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href.startsWith('/') || href.includes(window.location.hostname)) {
        internalCount++;
      } else if (href.startsWith('http')) {
        externalCount++;
      }
    });

    const linkScore = internalCount >= 8 && internalCount <= 15 ? 100 :
      internalCount >= 5 ? 70 : 40;

    // Entity density calculation
    const entityPatterns = [
      /\b(Google|Apple|Microsoft|Amazon|Meta|OpenAI|Anthropic)\b/gi,
      /\b(iPhone \d+|Galaxy S\d+|MacBook|iPad|Pixel \d+)\b/gi,
      /\b(WordPress \d+\.\d+|React \d+|Next\.js \d+)\b/gi,
      /\b(202[4-6]|Q[1-4] 202[4-6]|January|February|March|April|May|June|July|August|September|October|November|December 202[4-6])\b/gi,
      /\b(\d+%|\$[\d,]+|\d+\.\d+x|\d+ million|\d+ billion)\b/gi
    ];

    let entityMatches = 0;
    entityPatterns.forEach(pattern => {
      const matches = textContent.match(pattern);
      if (matches) entityMatches += matches.length;
    });

    const entityDensity = (entityMatches / wordCount) * 1000;
    const entityScore = entityDensity >= 15 ? 100 : entityDensity >= 10 ? 80 : entityDensity >= 5 ? 60 : 40;

    // Readability score (Flesch-Kincaid approximation)
    const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgWordsPerSentence = words.length / sentences.length;
    const syllables = words.reduce((acc, word) => acc + countSyllables(word), 0);
    const avgSyllablesPerWord = syllables / words.length;

    const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    const readabilityScore = fleschScore >= 60 ? 100 : fleschScore >= 50 ? 80 : fleschScore >= 40 ? 60 : 40;

    // Title analysis
    const titleLength = title.length;
    const titleScore = titleLength >= 50 && titleLength <= 60 ? 100 :
      titleLength >= 40 && titleLength <= 70 ? 80 : 50;

    // Meta description analysis
    const metaLength = metaDescription.length;
    const metaScore = metaLength >= 150 && metaLength <= 160 ? 100 :
      metaLength >= 120 && metaLength <= 170 ? 80 : 50;

    // Content gaps detection
    const contentGaps: string[] = [];
    if (!html.includes('key-takeaways') && !html.includes('Key Takeaways')) {
      contentGaps.push('Missing Key Takeaways section');
    }
    if (!html.includes('faq-section') && !html.includes('FAQ') && !html.includes('Frequently Asked')) {
      contentGaps.push('Missing FAQ section');
    }
    if (!html.includes('<table')) {
      contentGaps.push('No comparison tables found');
    }
    if (doc.querySelectorAll('img').length < 2) {
      contentGaps.push('Insufficient images (recommend 3-5)');
    }

    // Calculate overall score
    const weights = {
      wordCount: 0.10,
      density: 0.15,
      headings: 0.15,
      links: 0.15,
      entities: 0.15,
      readability: 0.10,
      title: 0.10,
      meta: 0.10
    };

    const overallScore = Math.round(
      wordCountScore * weights.wordCount +
      densityScore * weights.density +
      headingScore * weights.headings +
      linkScore * weights.links +
      entityScore * weights.entities +
      readabilityScore * weights.readability +
      titleScore * weights.title +
      metaScore * weights.meta
    );

    return {
      overallScore,
      titleScore,
      metaDescriptionScore: metaScore,
      keywordDensity,
      readabilityScore: Math.round(fleschScore),
      entityDensity,
      internalLinkCount: internalCount,
      externalLinkCount: externalCount,
      wordCount,
      headingStructure: {
        h1Count: h1s.length,
        h2Count: h2s.length,
        h3Count: h3s.length,
        h4Count: h4s.length,
        hasProperHierarchy: h1s.length === 1 && h2s.length >= 4,
        issues: headingIssues
      },
      contentGaps
    };
  }, [title, metaDescription]);

  // AI Detection Analysis
  const analyzeAIDetection = useCallback((text: string): AIDetectionResult => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);

    // Sentence length variance (burstiness)
    const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
    const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const variance = sentenceLengths.reduce((acc, len) => acc + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
    const stdDev = Math.sqrt(variance);

    // High variance = more human-like
    const burstinessScore = Math.min(100, stdDev * 5);

    // Check for AI trigger phrases
    const aiPhrases = [
      'delve into', 'tapestry', 'landscape', 'testament', 'realm', 'symphony',
      'unlock', 'leverage', 'robust', 'holistic', 'paradigm', 'game-changer',
      'in conclusion', 'it is important to note', 'furthermore', 'moreover',
      'in this article', 'this comprehensive guide', 'without further ado'
    ];

    const flaggedPhrases: string[] = [];
    const textLower = text.toLowerCase();
    aiPhrases.forEach(phrase => {
      if (textLower.includes(phrase)) {
        flaggedPhrases.push(phrase);
      }
    });

    // Calculate perplexity variance (simplified)
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const vocabularyRichness = uniqueWords.size / words.length;
    const perplexityVariance = vocabularyRichness * 100;

    // Overall AI probability
    const phrasesPenalty = flaggedPhrases.length * 10;
    const burstinessBonus = burstinessScore > 50 ? 20 : 0;
    const vocabularyBonus = vocabularyRichness > 0.4 ? 15 : 0;

    let probability = 50 + phrasesPenalty - burstinessBonus - vocabularyBonus;
    probability = Math.max(0, Math.min(100, probability));

    // Humanization tips
    const humanizationTips: string[] = [];
    if (burstinessScore < 40) {
      humanizationTips.push('Vary sentence lengths more (mix 5-word and 25-word sentences)');
    }
    if (flaggedPhrases.length > 0) {
      humanizationTips.push(`Remove AI phrases: ${flaggedPhrases.slice(0, 3).join(', ')}`);
    }
    if (vocabularyRichness < 0.35) {
      humanizationTips.push('Increase vocabulary diversity - avoid repetitive word choices');
    }
    if (avgLength > 20) {
      humanizationTips.push('Add more short, punchy sentences for impact');
    }

    return {
      probability,
      burstinessScore,
      perplexityVariance,
      sentenceLengthVariance: stdDev,
      flaggedPhrases,
      humanizationTips
    };
  }, []);

  // Entity Extraction
  const extractEntities = useCallback((text: string): EntityHighlight[] => {
    const entityPatterns: Array<{ pattern: RegExp; type: EntityHighlight['type'] }> = [
      { pattern: /\b(Google|Apple|Microsoft|Amazon|Meta|OpenAI|Anthropic|Netflix|Tesla|Nvidia)\b/gi, type: 'ORGANIZATION' },
      { pattern: /\b(iPhone \d+( Pro)?|Galaxy S\d+|MacBook|iPad|Pixel \d+|Apple Watch|AirPods)\b/gi, type: 'PRODUCT' },
      { pattern: /\b(Elon Musk|Tim Cook|Sundar Pichai|Satya Nadella|Sam Altman|Jensen Huang)\b/gi, type: 'PERSON' },
      { pattern: /\b(202[4-6]|Q[1-4] 202[4-6]|January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, type: 'DATE' },
      { pattern: /\b(\d+%|\$[\d,]+|\d+\.\d+x|\d+ million|\d+ billion|#\d+)\b/gi, type: 'METRIC' },
      { pattern: /\b(New York|San Francisco|Silicon Valley|London|Tokyo|California|USA|UK)\b/gi, type: 'LOCATION' }
    ];

    const entities: Map<string, EntityHighlight> = new Map();

    entityPatterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const entity = match[0];
        const existing = entities.get(entity.toLowerCase());
        if (existing) {
          existing.count++;
          existing.positions.push(match.index);
        } else {
          entities.set(entity.toLowerCase(), {
            entity,
            type,
            count: 1,
            positions: [match.index],
            salience: 0
          });
        }
      }
    });

    // Calculate salience based on position and frequency
    const textLength = text.length;
    const result = Array.from(entities.values()).map(e => {
      const positionWeight = e.positions.some(p => p < textLength * 0.2) ? 1.5 : 1;
      e.salience = Math.min(100, (e.count * 10 * positionWeight));
      return e;
    });

    return result.sort((a, b) => b.salience - a.salience);
  }, []);

  // SERP Preview Generator
  const generateSERPPreview = useCallback((): SERPPreview => {
    const TITLE_PIXEL_LIMIT = 600;
    const avgPixelPerChar = 8;
    const titlePixelWidth = title.length * avgPixelPerChar;

    const truncatedTitle = titlePixelWidth > TITLE_PIXEL_LIMIT
      ? title.substring(0, Math.floor(TITLE_PIXEL_LIMIT / avgPixelPerChar) - 3) + '...'
      : title;

    const descriptionTruncated = metaDescription.length > 160;
    const truncatedDescription = descriptionTruncated
      ? metaDescription.substring(0, 157) + '...'
      : metaDescription;

    // Estimate CTR based on title and description quality
    let estimatedCTR = 3.0; // baseline
    if (title.includes(targetKeyword)) estimatedCTR += 1.5;
    if (title.match(/\d+/)) estimatedCTR += 0.5; // numbers in title
    if (title.match(/\b(best|top|ultimate|complete|guide)\b/i)) estimatedCTR += 0.8;
    if (metaDescription.includes(targetKeyword)) estimatedCTR += 0.5;
    if (metaDescription.length >= 150) estimatedCTR += 0.3;

    return {
      title: truncatedTitle,
      url: `https://yourdomain.com/${targetKeyword.toLowerCase().replace(/\s+/g, '-')}`,
      metaDescription: truncatedDescription,
      structuredData: content.includes('schema') || content.includes('"@type"'),
      estimatedCTR: Math.min(12, estimatedCTR),
      titlePixelWidth,
      descriptionTruncated
    };
  }, [title, metaDescription, targetKeyword, content]);

  // ==================== EFFECTS ====================

  // Run analysis when content changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (content && content.length > 100) {
        setIsAnalyzing(true);

        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const textContent = doc.body.textContent || '';

        // Calculate all metrics
        const metrics = calculateSEOScore(content, targetKeyword);
        const aiResult = analyzeAIDetection(textContent);
        const entityList = extractEntities(textContent);
        const serp = generateSERPPreview();

        setSeoMetrics(metrics);
        setAiDetection(aiResult);
        setEntities(entityList);
        setSerpPreview(serp);

        if (onMetricsUpdate) {
          onMetricsUpdate(metrics);
        }

        setIsAnalyzing(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [content, targetKeyword, calculateSEOScore, analyzeAIDetection, extractEntities, generateSERPPreview, onMetricsUpdate]);

  // ==================== RENDER HELPERS ====================

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Work';
  };

  // ==================== RENDER ====================
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1E1E2E 0%, #2D2D44 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '24px',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.5rem',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          📊 Content Intelligence Dashboard
        </h2>

        {isAnalyzing && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#8B5CF6'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #8B5CF6',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Analyzing...
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '16px'
      }}>
        {[
          { id: 'seo', label: '📈 SEO Score', icon: '📈' },
          { id: 'ai', label: '🤖 AI Detection', icon: '🤖' },
          { id: 'competitors', label: '🏆 Competitors', icon: '🏆' },
          { id: 'entities', label: '🏷️ Entities', icon: '🏷️' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)'
                : 'rgba(255, 255, 255, 0.05)',
              color: activeTab === tab.id ? 'white' : 'rgba(255, 255, 255, 0.7)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '400px' }}>

        {/* SEO Score Tab */}
        {activeTab === 'seo' && seoMetrics && (
          <div>
            {/* Main Score Circle */}
            <div style={{
              display: 'flex',
              gap: '32px',
              marginBottom: '32px'
            }}>
              <div style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                background: `conic-gradient(${getScoreColor(seoMetrics.overallScore)} ${seoMetrics.overallScore * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                <div style={{
                  width: '150px',
                  height: '150px',
                  borderRadius: '50%',
                  background: '#1E1E2E',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{
                    fontSize: '3rem',
                    fontWeight: '800',
                    color: getScoreColor(seoMetrics.overallScore)
                  }}>
                    {seoMetrics.overallScore}
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}>
                    {getScoreLabel(seoMetrics.overallScore)}
                  </span>
                </div>
              </div>

              {/* SERP Preview */}
              {serpPreview && (
                <div style={{
                  flex: 1,
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  maxWidth: '600px'
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#5F6368',
                    marginBottom: '4px'
                  }}>
                    {serpPreview.url}
                  </div>
                  <div style={{
                    fontSize: '1.25rem',
                    color: '#1A0DAB',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    fontWeight: '400'
                  }}>
                    {serpPreview.title}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#4D5156',
                    lineHeight: '1.5'
                  }}>
                    {serpPreview.metaDescription}
                  </div>
                  <div style={{
                    marginTop: '12px',
                    display: 'flex',
                    gap: '16px',
                    fontSize: '0.75rem'
                  }}>
                    <span style={{ color: serpPreview.titlePixelWidth > 580 ? '#EF4444' : '#10B981' }}>
                      Title: {serpPreview.titlePixelWidth}px / 600px
                    </span>
                    <span style={{ color: '#10B981' }}>
                      Est. CTR: {serpPreview.estimatedCTR.toFixed(1)}%
                    </span>
                    {serpPreview.structuredData && (
                      <span style={{ color: '#8B5CF6' }}>✓ Schema Detected</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Metric Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '24px'
            }}>
              {[
                { label: 'Word Count', value: seoMetrics.wordCount, target: '2500-3500', good: seoMetrics.wordCount >= 2500 },
                { label: 'Keyword Density', value: `${seoMetrics.keywordDensity.toFixed(2)}%`, target: '0.5-2.5%', good: seoMetrics.keywordDensity >= 0.5 && seoMetrics.keywordDensity <= 2.5 },
                { label: 'Internal Links', value: seoMetrics.internalLinkCount, target: '8-15', good: seoMetrics.internalLinkCount >= 8 },
                { label: 'Entity Density', value: `${seoMetrics.entityDensity.toFixed(1)}`, target: '15+/1000w', good: seoMetrics.entityDensity >= 15 }
              ].map((metric, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: `1px solid ${metric.good ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}
                >
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginBottom: '8px'
                  }}>
                    {metric.label}
                  </div>
                  <div style={{
                    fontSize: '1.8rem',
                    fontWeight: '700',
                    color: metric.good ? '#10B981' : '#EF4444'
                  }}>
                    {metric.value}
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'rgba(255, 255, 255, 0.4)',
                    marginTop: '4px'
                  }}>
                    Target: {metric.target}
                  </div>
                </div>
              ))}
            </div>

            {/* Content Gaps */}
            {seoMetrics.contentGaps.length > 0 && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <h4 style={{ color: '#EF4444', margin: '0 0 12px 0' }}>
                  ⚠️ Content Gaps Detected
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {seoMetrics.contentGaps.map((gap, idx) => (
                    <li key={idx} style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* AI Detection Tab */}
        {activeTab === 'ai' && aiDetection && (
          <div>
            {/* AI Probability Gauge */}
            <div style={{
              display: 'flex',
              gap: '32px',
              marginBottom: '32px'
            }}>
              <div style={{
                textAlign: 'center'
              }}>
                <div style={{
                  width: '200px',
                  height: '100px',
                  background: `conic-gradient(
                    from 180deg,
                    #10B981 0deg,
                    #F59E0B 90deg,
                    #EF4444 180deg,
                    transparent 180deg
                  )`,
                  borderRadius: '100px 100px 0 0',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    width: '10px',
                    height: '90px',
                    background: '#1E1E2E',
                    transformOrigin: 'bottom center',
                    transform: `translateX(-50%) rotate(${(aiDetection.probability - 50) * 1.8}deg)`,
                    borderRadius: '5px 5px 0 0'
                  }} />
                </div>
                <div style={{
                  marginTop: '16px',
                  fontSize: '2.5rem',
                  fontWeight: '800',
                  color: aiDetection.probability < 30 ? '#10B981' : aiDetection.probability < 60 ? '#F59E0B' : '#EF4444'
                }}>
                  {aiDetection.probability.toFixed(0)}%
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.6)'
                }}>
                  AI Detection Probability
                </div>
              </div>

              {/* Metrics */}
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '16px'
                }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px' }}>
                      Burstiness Score
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: aiDetection.burstinessScore > 50 ? '#10B981' : '#F59E0B' }}>
                      {aiDetection.burstinessScore.toFixed(1)}
                    </div>
                    <div style={{
                      marginTop: '8px',
                      height: '6px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${aiDetection.burstinessScore}%`,
                        height: '100%',
                        background: aiDetection.burstinessScore > 50 ? '#10B981' : '#F59E0B',
                        borderRadius: '3px'
                      }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px' }}>
                      Higher = More Human-Like
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px' }}>
                      Sentence Variance (σ)
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: aiDetection.sentenceLengthVariance > 8 ? '#10B981' : '#F59E0B' }}>
                      {aiDetection.sentenceLengthVariance.toFixed(1)}
                    </div>
                    <div style={{
                      marginTop: '8px',
                      height: '6px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${Math.min(100, aiDetection.sentenceLengthVariance * 5)}%`,
                        height: '100%',
                        background: aiDetection.sentenceLengthVariance > 8 ? '#10B981' : '#F59E0B',
                        borderRadius: '3px'
                      }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px' }}>
                      Target: σ &gt; 8
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Flagged Phrases */}
            {aiDetection.flaggedPhrases.length > 0 && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <h4 style={{ color: '#EF4444', margin: '0 0 12px 0' }}>
                  🚨 AI Trigger Phrases Detected
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {aiDetection.flaggedPhrases.map((phrase, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#EF4444',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.85rem'
                      }}
                    >
                      "{phrase}"
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Humanization Tips */}
            {aiDetection.humanizationTips.length > 0 && (
              <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <h4 style={{ color: '#8B5CF6', margin: '0 0 12px 0' }}>
                  💡 Humanization Recommendations
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {aiDetection.humanizationTips.map((tip, idx) => (
                    <li key={idx} style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px' }}>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Entities Tab */}
        {activeTab === 'entities' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <div>
                <span style={{ fontSize: '2rem', fontWeight: '800', color: '#8B5CF6' }}>
                  {entities.length}
                </span>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', marginLeft: '8px' }}>
                  Named Entities Detected
                </span>
              </div>
              <div style={{
                background: entities.length >= 15 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: entities.length >= 15 ? '#10B981' : '#F59E0B',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.85rem'
              }}>
                {entities.length >= 15 ? '✓ Good Entity Density' : '⚠️ Add More Entities'}
              </div>
            </div>

            {/* Entity Type Distribution */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '12px',
              marginBottom: '24px'
            }}>
              {['ORGANIZATION', 'PRODUCT', 'PERSON', 'DATE', 'METRIC', 'LOCATION'].map(type => {
                const count = entities.filter(e => e.type === type).length;
                const colors: Record<string, string> = {
                  ORGANIZATION: '#3B82F6',
                  PRODUCT: '#10B981',
                  PERSON: '#F59E0B',
                  DATE: '#8B5CF6',
                  METRIC: '#EC4899',
                  LOCATION: '#6366F1'
                };
                return (
                  <div
                    key={type}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center',
                      borderLeft: `4px solid ${colors[type]}`
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: colors[type] }}>
                      {count}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
                      {type}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Entity List */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '12px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {entities.slice(0, 20).map((entity, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#8B5CF6',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: '600'
                    }}>
                      {entity.type}
                    </span>
                    <span style={{ color: 'white', fontWeight: '500' }}>
                      {entity.entity}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                      {entity.count}x
                    </span>
                    <div style={{
                      width: '60px',
                      height: '6px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${entity.salience}%`,
                        height: '100%',
                        background: '#8B5CF6',
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// ==================== HELPER FUNCTIONS ====================
function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;

  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');

  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

export default ContentIntelligenceDashboard;

