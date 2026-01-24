// ==================== CONTENT FRESHNESS ENGINE ====================
// Purpose: Dynamically inject real-time data, trending topics, and temporal relevance
// Impact: Make content appear fresh, current, and algorithmically favored

interface FreshnessSignals {
  lastUpdated: string;
  trendingTopics: string[];
  currentStats: Record<string, string>;
  timeReferences: TimeReference[];
  dynamicData: DynamicDataPoint[];
}

interface TimeReference {
  type: 'relative' | 'absolute' | 'seasonal';
  text: string;
  context: string;
}

interface DynamicDataPoint {
  category: string;
  value: string;
  source: string;
  lastChecked: Date;
}

export async function injectContentFreshness(content: string, topic: string): Promise<string> {
  const freshnessSignals = await gatherFreshnessSignals(topic);
  const timestamped = addTemporalMarkers(content, freshnessSignals);
  const withTrends = injectTrendingContext(timestamped, freshnessSignals);
  const withStats = embedCurrentStatistics(withTrends, freshnessSignals);
  return addFreshnessMetadata(withStats, freshnessSignals);
}

async function gatherFreshnessSignals(topic: string): Promise<FreshnessSignals> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.toLocaleString('en-US', { month: 'long' });
  
  return {
    lastUpdated: now.toISOString(),
    trendingTopics: generateTrendingTopics(topic),
    currentStats: {
      year: currentYear.toString(),
      month: currentMonth,
      quarter: `Q${Math.floor(now.getMonth() / 3) + 1} ${currentYear}`,
      season: getCurrentSeason(now)
    },
    timeReferences: [
      {
        type: 'relative',
        text: 'as of today',
        context: 'current data'
      },
      {
        type: 'absolute',
        text: `in ${currentYear}`,
        context: 'annual reference'
      },
      {
        type: 'seasonal',
        text: `this ${getCurrentSeason(now)}`,
        context: 'seasonal relevance'
      }
    ],
    dynamicData: [
      {
        category: 'market_size',
        value: 'rapidly growing',
        source: 'industry analysis',
        lastChecked: now
      },
      {
        category: 'adoption_rate',
        value: 'accelerating',
        source: 'recent reports',
        lastChecked: now
      },
      {
        category: 'innovation_pace',
        value: 'increasing exponentially',
        source: 'tech trends',
        lastChecked: now
      }
    ]
  };
}

function getCurrentSeason(date: Date): string {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function generateTrendingTopics(mainTopic: string): string[] {
  const trendModifiers = [
    'AI-powered',
    'sustainable',
    'data-driven',
    'cloud-based',
    'mobile-first',
    'enterprise-grade',
    'next-generation',
    'intelligent'
  ];
  
  return trendModifiers.slice(0, 5).map(mod => `${mod} ${mainTopic}`);
}

function addTemporalMarkers(content: string, signals: FreshnessSignals): string {
  let enhanced = content;
  
  // Inject current year references
  const yearPattern = /\b(in recent years|recently|nowadays)\b/gi;
  enhanced = enhanced.replace(yearPattern, `in ${signals.currentStats.year}`);
  
  // Add "as of [date]" to statistics
  const statPattern = /(\d+%|\$[\d,]+|\d+\s+(?:million|billion|users|customers))/gi;
  let statCount = 0;
  enhanced = enhanced.replace(statPattern, (match) => {
    statCount++;
    if (statCount % 3 === 0) {
      return `${match} (as of ${signals.currentStats.month} ${signals.currentStats.year})`;
    }
    return match;
  });
  
  return enhanced;
}

function injectTrendingContext(content: string, signals: FreshnessSignals): string {
  let enhanced = content;
  
  // Insert trending topics section
  const trendingSection = `\n\n<div class="trending-context" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 2rem; border-radius: 12px; border-left: 4px solid #0ea5e9; margin: 2.5rem 0;">\n  <h3 style="color: #0c4a6e; font-size: 1.35rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center;">\n    <span style="margin-right: 0.5rem;">🔥</span> Trending in ${signals.currentStats.year}\n  </h3>\n  <ul style="list-style: none; padding: 0; margin: 0;">\n    ${signals.trendingTopics.slice(0, 3).map(topic => 
      `<li style="padding: 0.75rem 0; border-bottom: 1px solid #bae6fd; color: #075985; font-weight: 500;">\n        <span style="color: #0ea5e9; margin-right: 0.5rem;">▸</span>${topic}\n      </li>`
    ).join('')}\n  </ul>\n</div>`;
  
  // Insert after first major section
  const firstH2 = enhanced.indexOf('</h2>');
  if (firstH2 !== -1) {
    const insertPoint = enhanced.indexOf('</p>', firstH2);
    if (insertPoint !== -1) {
      enhanced = enhanced.slice(0, insertPoint + 4) + trendingSection + enhanced.slice(insertPoint + 4);
    }
  }
  
  return enhanced;
}

function embedCurrentStatistics(content: string, signals: FreshnessSignals): string {
  let enhanced = content;
  
  // Add dynamic stat boxes
  const statsBox = `\n\n<div class="freshness-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin: 3rem 0; padding: 2.5rem; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);">\n  ${signals.dynamicData.map(data => 
    `<div style="text-align: center; padding: 1.5rem; border-radius: 12px; background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);">\n      <div style="font-size: 1.1rem; font-weight: 700; color: #6b21a8; margin-bottom: 0.5rem; text-transform: capitalize;">${data.category.replace('_', ' ')}</div>\n      <div style="font-size: 1.5rem; font-weight: 800; color: #7c3aed; margin-bottom: 0.25rem;">${data.value}</div>\n      <div style="font-size: 0.85rem; color: #9333ea; opacity: 0.8;">Updated: ${signals.currentStats.month} ${signals.currentStats.year}</div>\n    </div>`
  ).join('')}\n</div>`;
  
  // Insert before conclusion
  const conclusionPattern = /<h2[^>]*>\s*(?:conclusion|summary|final thoughts|takeaway)/i;
  const conclusionMatch = enhanced.match(conclusionPattern);
  if (conclusionMatch && conclusionMatch.index !== undefined) {
    enhanced = enhanced.slice(0, conclusionMatch.index) + statsBox + enhanced.slice(conclusionMatch.index);
  } else {
    // Add before last paragraph if no conclusion
    const lastP = enhanced.lastIndexOf('</p>');
    if (lastP !== -1) {
      enhanced = enhanced.slice(0, lastP + 4) + statsBox + enhanced.slice(lastP + 4);
    }
  }
  
  return enhanced;
}

function addFreshnessMetadata(content: string, signals: FreshnessSignals): string {
  // Add schema.org metadata for freshness
  const metadataSchema = `\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "dateModified": "${signals.lastUpdated}",\n  "datePublished": "${signals.lastUpdated}",\n  "backstory": "Updated with latest ${signals.currentStats.year} data and trends"\n}\n</script>`;
  
  // Add visible freshness indicator
  const freshnessIndicator = `\n<div class="freshness-badge" style="display: inline-flex; align-items: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem; font-weight: 600; margin-bottom: 2rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">\n  <span style="margin-right: 0.5rem; font-size: 1.1rem;">✓</span>\n  Updated for ${signals.currentStats.month} ${signals.currentStats.year}\n</div>\n`;
  
  return freshnessIndicator + content + metadataSchema;
}

// ==================== BATCH FRESHNESS UPDATE ====================
export async function batchUpdateContentFreshness(articles: Array<{id: string; content: string; topic: string}>): Promise<Array<{id: string; freshContent: string}>> {
  return Promise.all(
    articles.map(async article => ({
      id: article.id,
      freshContent: await injectContentFreshness(article.content, article.topic)
    }))
  );
}

// ==================== FRESHNESS SCORE CALCULATOR ====================
export function calculateFreshnessScore(content: string): number {
  let score = 0;
  const currentYear = new Date().getFullYear();
  
  // Check for current year mentions
  if (content.includes(currentYear.toString())) score += 25;
  
  // Check for temporal indicators
  const temporalIndicators = ['recently', 'latest', 'current', 'today', 'now', 'this year', 'updated'];
  temporalIndicators.forEach(indicator => {
    if (content.toLowerCase().includes(indicator)) score += 5;
  });
  
  // Check for trending keywords
  const trendingKeywords = ['AI', 'machine learning', 'cloud', 'sustainable', 'data-driven'];
  trendingKeywords.forEach(keyword => {
    if (content.toLowerCase().includes(keyword.toLowerCase())) score += 10;
  });
  
  return Math.min(score, 100);
}

// ==================== INTEGRATION ====================
export async function enhanceWithFreshness(content: string, metadata: { topic: string }): Promise<string> {
  return await injectContentFreshness(content, metadata.topic);
}
