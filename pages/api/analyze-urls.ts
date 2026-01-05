import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/src/services';

export const config = {
  maxDuration: 60,
};

interface URLAnalysisRequest {
  urls: string[];
  analysisType: 'gap' | 'competitive' | 'seo-audit' | 'content-opportunity';
  focusKeywords?: string[];
  depth?: 'light' | 'medium' | 'deep';
}

interface URLAnalysisResult {
  url: string;
  status: 'success' | 'error' | 'pending';
  analysis?: {
    title: string;
    metaDescription: string;
    contentLength: number;
    headings: { level: string; text: string }[];
    keywords: { term: string; density: number }[];
    gaps: { type: string; description: string; priority: 'high' | 'medium' | 'low' }[];
    opportunities: string[];
    recommendations: string[];
    score: number;
  };
  error?: string;
}

interface AnalysisQueueItem {
  id: string;
  url: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: URLAnalysisResult;
  error?: string;
}

export default async function handler(
  req: NextRequest
): Promise<NextResponse> {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    const body: URLAnalysisRequest = await req.json();
    const { urls, analysisType, focusKeywords = [], depth = 'medium' } = body;

    // Validate input
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (urls.length > 25) {
      return NextResponse.json(
        { error: 'Maximum 25 URLs allowed per request' },
        { status: 400 }
      );
    }

    // Create analysis queue
    const queue: AnalysisQueueItem[] = urls.map((url, index) => ({
      id: `${Date.now()}-${index}`,
      url,
      priority: index === 0 ? 'high' : 'medium',
      status: 'pending',
    }));

    // Process URLs with AI analysis
    const results: URLAnalysisResult[] = await Promise.all(
      urls.map(async (url, index) => {
        try {
          // Validate URL
          let cleanUrl = url.trim();
          if (!cleanUrl.startsWith('http')) {
            cleanUrl = `https://${cleanUrl}`;
          }

          // Call AI for analysis
          const analysisPrompt = `Analyze this website URL for ${analysisType} analysis:
URL: ${cleanUrl}
Focus Keywords: ${focusKeywords.join(', ') || 'None specified'}
Analysis Depth: ${depth}
Provide detailed analysis including gaps, opportunities, and recommendations in JSON format.`;

          const aiResponse = await callAI('url_analysis_engine', [
            cleanUrl,
            analysisType,
            focusKeywords,
            depth,
          ], 'json');

          // Parse AI response
          const parsedAnalysis = typeof aiResponse === 'string'
            ? JSON.parse(aiResponse)
            : aiResponse;

          return {
            url: cleanUrl,
            status: 'success' as const,
            analysis: {
              title: parsedAnalysis.title || 'N/A',
              metaDescription: parsedAnalysis.metaDescription || 'N/A',
              contentLength: parsedAnalysis.contentLength || 0,
              headings: parsedAnalysis.headings || [],
              keywords: parsedAnalysis.keywords || [],
              gaps: parsedAnalysis.gaps || [],
              opportunities: parsedAnalysis.opportunities || [],
              recommendations: parsedAnalysis.recommendations || [],
              score: parsedAnalysis.score || 0,
            },
          };
        } catch (error: any) {
          return {
            url,
            status: 'error' as const,
            error: `Failed to analyze URL: ${error.message}`,
          };
        }
      })
    );

    // Generate comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      analysisType,
      totalUrls: urls.length,
      successCount: results.filter(r => r.status === 'success').length,
      failureCount: results.filter(r => r.status === 'error').length,
      results,
      summary: {
        averageScore: (
          results
            .filter(r => r.status === 'success' && r.analysis)
            .reduce((sum, r) => sum + (r.analysis?.score || 0), 0) /
          results.filter(r => r.status === 'success').length
        ).toFixed(2),
        topGaps: extractTopGaps(results),
        topOpportunities: extractTopOpportunities(results),
      },
    };

    return NextResponse.json(report, { status: 200 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

function extractTopGaps(
  results: URLAnalysisResult[]
): { gap: string; frequency: number }[] {
  const gapMap = new Map<string, number>();
  results.forEach(result => {
    if (result.analysis?.gaps) {
      result.analysis.gaps.forEach(gap => {
        const key = gap.type;
        gapMap.set(key, (gapMap.get(key) || 0) + 1);
      });
    }
  });
  return Array.from(gapMap.entries())
    .map(([gap, frequency]) => ({ gap, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);
}

function extractTopOpportunities(
  results: URLAnalysisResult[]
): { opportunity: string; frequency: number }[] {
  const oppMap = new Map<string, number>();
  results.forEach(result => {
    if (result.analysis?.opportunities) {
      result.analysis.opportunities.forEach(opp => {
        oppMap.set(opp, (oppMap.get(opp) || 0) + 1);
      });
    }
  });
  return Array.from(oppMap.entries())
    .map(([opportunity, frequency]) => ({ opportunity, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);
}
