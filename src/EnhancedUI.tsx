// =============================================================================
// ENHANCED UI V2.0 - SOTA Enterprise Blog Post Editor Integration
// 10000000000000x Quality - Premium Internal Linking with Rich Contextual Anchors
// =============================================================================

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { UltraPremiumAnchorEngineV2, PageContext, UltraAnchorCandidate } from './UltraPremiumAnchorEngineV2';
import { EnterpriseEditorV2, InternalLinkSuggestion, EditorConfig } from './EnterpriseEditorV2';

// Re-export for convenience
export { EnterpriseEditorV2 } from './EnterpriseEditorV2';
export { UltraPremiumAnchorEngineV2 } from './UltraPremiumAnchorEngineV2';

// ==================== ENHANCED TYPES ====================

export interface EnhancedLinkSuggestion {
  id: string;
  anchorText: string;
  targetUrl: string;
  targetTitle: string;
  qualityScore: number;
  metrics: {
    semantic: number;
    contextual: number;
    naturalness: number;
    seo: number;
  };
  contextSnippet: string;
  reasoning: string;
  alternatives: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
}

export interface EnhancedEditorState {
  content: string;
  htmlContent: string;
  wordCount: number;
  paragraphCount: number;
  suggestions: EnhancedLinkSuggestion[];
  selectedSuggestion: string | null;
  isAnalyzing: boolean;
  analysisProgress: number;
  lastAnalyzed: Date | null;
}

export interface EnhancedEditorConfig extends EditorConfig {
  enableRealTimeAnalysis: boolean;
  showQualityMetrics: boolean;
  enableAlternativeSuggestions: boolean;
  colorCodeByQuality: boolean;
  minQualityForAutoAccept: number;
}

const DEFAULT_ENHANCED_CONFIG: EnhancedEditorConfig = {
  minLinksPerPost: 5,
  maxLinksPerPost: 15,
  minWordsPerLink: 150,
  linkDistribution: 'natural',
  autoSuggest: true,
  highlightSuggestions: true,
  qualityThreshold: 75,
  enableRealTimeAnalysis: true,
  showQualityMetrics: true,
  enableAlternativeSuggestions: true,
  colorCodeByQuality: true,
  minQualityForAutoAccept: 90,
};

// ==================== ENHANCED HOOKS ====================

export const useEnhancedInternalLinking = (
  content: string,
  availablePages: PageContext[],
  config: EnhancedEditorConfig = DEFAULT_ENHANCED_CONFIG
) => {
  const [state, setState] = useState<EnhancedEditorState>({
    content,
    htmlContent: content,
    wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
    paragraphCount: content.split(/\n\n+/).filter(p => p.trim().length > 0).length,
    suggestions: [],
    selectedSuggestion: null,
    isAnalyzing: false,
    analysisProgress: 0,
    lastAnalyzed: null,
  });

  const engineRef = useRef<UltraPremiumAnchorEngineV2 | null>(null);

  useEffect(() => {
    engineRef.current = new UltraPremiumAnchorEngineV2({
      minQualityScore: config.qualityThreshold,
      enforceDescriptive: true,
      avoidGenericAnchors: true,
    });
  }, [config.qualityThreshold]);

  const analyzeContent = useCallback(async () => {
    if (!engineRef.current || !content) return;

    setState(prev => ({ ...prev, isAnalyzing: true, analysisProgress: 0 }));
    engineRef.current.reset();

    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 50);
    const newSuggestions: EnhancedLinkSuggestion[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      setState(prev => ({
        ...prev,
        analysisProgress: Math.round((i / paragraphs.length) * 100),
      }));

      for (const page of availablePages) {
        if (newSuggestions.length >= config.maxLinksPerPost) break;

        const candidate = engineRef.current.findBestAnchor(paragraph, page);
        if (candidate && candidate.qualityScore >= config.qualityThreshold) {
          const alternatives = generateAlternativeAnchors(paragraph, page, candidate);
          
          newSuggestions.push({
            id: `enhanced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            anchorText: candidate.text,
            targetUrl: `/${page.slug}/`,
            targetTitle: page.title,
            qualityScore: candidate.qualityScore,
            metrics: {
              semantic: candidate.semanticScore,
              contextual: candidate.contextualFit,
              naturalness: candidate.naturalness,
              seo: candidate.seoValue,
            },
            contextSnippet: paragraph.slice(0, 200) + '...',
            reasoning: generateReasoning(candidate, page),
            alternatives,
            status: candidate.qualityScore >= config.minQualityForAutoAccept ? 'accepted' : 'pending',
          });
        }
      }

      // Small delay to prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    setState(prev => ({
      ...prev,
      suggestions: newSuggestions,
      isAnalyzing: false,
      analysisProgress: 100,
      lastAnalyzed: new Date(),
    }));
  }, [content, availablePages, config]);

  const updateSuggestion = useCallback((id: string, updates: Partial<EnhancedLinkSuggestion>) => {
    setState(prev => ({
      ...prev,
      suggestions: prev.suggestions.map(s =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  }, []);

  const acceptSuggestion = useCallback((id: string) => {
    updateSuggestion(id, { status: 'accepted' });
  }, [updateSuggestion]);

  const rejectSuggestion = useCallback((id: string) => {
    updateSuggestion(id, { status: 'rejected' });
  }, [updateSuggestion]);

  const modifySuggestion = useCallback((id: string, newAnchor: string) => {
    updateSuggestion(id, { anchorText: newAnchor, status: 'modified' });
  }, [updateSuggestion]);

  const acceptAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      suggestions: prev.suggestions.map(s =>
        s.status === 'pending' ? { ...s, status: 'accepted' } : s
      ),
    }));
  }, []);

  const getAcceptedLinks = useCallback(() => {
    return state.suggestions.filter(s => s.status === 'accepted' || s.status === 'modified');
  }, [state.suggestions]);

  const getStats = useCallback(() => {
    const accepted = state.suggestions.filter(s => s.status === 'accepted').length;
    const rejected = state.suggestions.filter(s => s.status === 'rejected').length;
    const pending = state.suggestions.filter(s => s.status === 'pending').length;
    const modified = state.suggestions.filter(s => s.status === 'modified').length;
    const avgQuality = state.suggestions.length > 0
      ? state.suggestions.reduce((acc, s) => acc + s.qualityScore, 0) / state.suggestions.length
      : 0;

    return { accepted, rejected, pending, modified, total: state.suggestions.length, avgQuality };
  }, [state.suggestions]);

  return {
    state,
    analyzeContent,
    acceptSuggestion,
    rejectSuggestion,
    modifySuggestion,
    acceptAll,
    getAcceptedLinks,
    getStats,
  };
};

// Helper functions
const generateAlternativeAnchors = (
  paragraph: string,
  page: PageContext,
  original: UltraAnchorCandidate
): string[] => {
  const alternatives: string[] = [];
  const words = paragraph.split(/\s+/);
  
  // Generate variations by adjusting word boundaries
    // DEFENSIVE: Early return if original.text is invalid
  if (!original?.text || typeof original.text !== 'string') return alternatives;
  const originalWords = original.text.split(/\s+/);
    if (originalWords.length === 0) return alternatives;
  const startIdx = words.findIndex(w => w.includes(originalWords[0]));
  
  if (startIdx > 0) {
    // Try including previous word
    const extended = words.slice(startIdx - 1, startIdx + originalWords.length).join(' ');
    if (extended !== original.text && extended.length < 60) {
      alternatives.push(extended);
    }
  }
  
  // Try shorter version
  if (originalWords.length > 4) {
    const shorter = originalWords.slice(0, -1).join(' ');
    alternatives.push(shorter);
  }
  
  return alternatives.slice(0, 3);
};

const generateReasoning = (candidate: UltraAnchorCandidate, page: PageContext): string => {
  const reasons: string[] = [];
  
  if (candidate.semanticScore >= 80) {
    reasons.push('High semantic relevance to target page');
  }
  if (candidate.naturalness >= 85) {
    reasons.push('Natural flow within paragraph context');
  }
  if (candidate.seoValue >= 75) {
    reasons.push('Strong SEO value with descriptive anchor');
  }
  if (candidate.wordCount >= 4 && candidate.wordCount <= 6) {
    reasons.push('Optimal anchor text length (4-6 words)');
  }
  
  return reasons.join('. ') || 'Meets quality threshold for internal linking.';
};

// ==================== MAIN COMPONENT ====================

export interface EnhancedUIProps {
  initialContent: string;
  availablePages: PageContext[];
  onSave?: (content: string, links: EnhancedLinkSuggestion[]) => void;
  config?: Partial<EnhancedEditorConfig>;
}

export const EnhancedUI: React.FC<EnhancedUIProps> = ({
  initialContent,
  availablePages,
  onSave,
  config: customConfig,
}) => {
  const config = { ...DEFAULT_ENHANCED_CONFIG, ...customConfig };
  
  const {
    state,
    analyzeContent,
    acceptSuggestion,
    rejectSuggestion,
    modifySuggestion,
    acceptAll,
    getAcceptedLinks,
    getStats,
  } = useEnhancedInternalLinking(initialContent, availablePages, config);

  const stats = getStats();

  const handleSave = useCallback(() => {
    const acceptedLinks = getAcceptedLinks();
    onSave?.(state.content, acceptedLinks);
  }, [state.content, getAcceptedLinks, onSave]);

  return (
    <EnterpriseEditorV2
      initialContent={initialContent}
      availablePages={availablePages}
      onSave={(content, links) => {
        const enhancedLinks = links.map(link => ({
          ...link,
          metrics: { semantic: 0, contextual: 0, naturalness: 0, seo: 0 },
          reasoning: '',
          alternatives: [],
        } as EnhancedLinkSuggestion));
        onSave?.(content, enhancedLinks);
      }}
      config={config}
    />
  );
};

export default EnhancedUI;
