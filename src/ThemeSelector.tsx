import React, { useState, useEffect } from 'react';
import { 
  PREMIUM_THEMES, 
  BlogPostTheme,
  generateKeyTakeawaysHTML,
  generateComparisonTableHTML,
  generateFAQHTML,
  generateStepByStepHTML,
  generateQuoteBlockHTML,
  generateProductCardHTML,
  generateProgressBarHTML
} from './PremiumDesignSystem';

interface ThemeSelectorProps {
  currentThemeId: string;
  onThemeChange: (theme: BlogPostTheme) => void;
  previewContent?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentThemeId,
  onThemeChange,
  previewContent
}) => {
  const [selectedTheme, setSelectedTheme] = useState<BlogPostTheme>(
    PREMIUM_THEMES.find(t => t.id === currentThemeId) || PREMIUM_THEMES[0]
  );
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const handleThemeSelect = (theme: BlogPostTheme) => {
    setSelectedTheme(theme);
    onThemeChange(theme);
  };

  // Generate sample content for preview
  const generateSampleContent = (theme: BlogPostTheme): string => {
    const takeaways = [
      'Speed Matters: Pages loading under 2.5s rank 3x higher',
      'Entity Density: Include 15+ named entities per 1000 words',
      'Burstiness: Vary sentence lengths for human-like writing',
      'Featured Snippets: Structure content for position zero',
      'Internal Links: 8-15 contextual links per article'
    ];

    const tableHeaders = ['Feature', 'Basic Plan', 'Pro Plan', 'Enterprise'];
    const tableRows = [
      ['Price', '$29/mo', '$79/mo', '$199/mo'],
      ['Users', '1', '5', 'Unlimited'],
      ['API Calls', '1,000', '10,000', 'Unlimited'],
      ['Support', 'Email', 'Priority', '24/7 Dedicated']
    ];

    const faqs = [
      { question: 'What makes this different from other SEO tools?', answer: 'Our tool uses AI-powered content analysis with entity recognition, burstiness engineering, and real-time SERP tracking to create content that ranks consistently in top positions.' },
      { question: 'How long until I see results?', answer: 'Most users see ranking improvements within 30-60 days for new content, and 14-30 days for refreshed existing content.' },
      { question: 'Is the content AI-detectable?', answer: 'Our burstiness engineering creates sentence variance that mimics human writing patterns, resulting in less than 12% AI detection probability.' }
    ];

    const steps = [
      { title: 'Configure Your API Keys', content: 'Set up your AI provider (Anthropic, OpenAI, or Google) and Serper API keys in the settings panel.' },
      { title: 'Import Your Sitemap', content: 'Connect your WordPress site and import existing pages for internal linking optimization.' },
      { title: 'Generate Content', content: 'Enter your target keyword and let the AI create comprehensive, SEO-optimized content.' },
      { title: 'Review and Publish', content: 'Review the generated content, make any adjustments, and publish directly to WordPress.' }
    ];

    return `
      <div style="${theme.styles.container}">
        <h1 style="${theme.styles.heading}">🚀 Ultimate Guide to SEO Content in 2026</h1>
        
        <p style="${theme.styles.paragraph}">
          <strong>Here's the truth about SEO in 2026:</strong> It's not about keywords anymore. 
          It's about entities, intent, and delivering value that Google's AI can understand and trust.
        </p>

        ${generateKeyTakeawaysHTML(takeaways, theme)}

        <h2 style="${theme.styles.heading}">📊 Pricing Comparison</h2>
        ${generateComparisonTableHTML(tableHeaders, tableRows, theme)}

        <h2 style="${theme.styles.heading}">🔧 How to Get Started</h2>
        ${generateStepByStepHTML(steps, theme)}

        ${generateQuoteBlockHTML(
          "The best content doesn't just rank—it dominates. Focus on being 10x better than what's already on page one.",
          "Alex Hormozi",
          "CEO, Acquisition.com",
          theme
        )}

        ${generateFAQHTML(faqs, theme)}

        ${generateProgressBarHTML('Content Quality Score', 94, 100, theme)}
        ${generateProgressBarHTML('Entity Density', 18, 20, theme)}
        ${generateProgressBarHTML('Readability Score', 72, 100, theme)}
      </div>
    `;
  };

  const getPreviewWidth = () => {
    switch (previewMode) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      default: return '100%';
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1E1E2E 0%, #2D2D44 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '24px',
      border: '1px solid rgba(139, 92, 246, 0.3)'
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
          background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🎨 Premium Design System
        </h2>
        
        <button
          onClick={() => setShowPreview(!showPreview)}
          style={{
            background: showPreview 
              ? 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)'
              : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {showPreview ? '✓ Preview Active' : '👁️ Show Preview'}
        </button>
      </div>

      {/* Theme Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px',
        marginBottom: showPreview ? '24px' : 0
      }}>
        {PREMIUM_THEMES.map(theme => (
          <div
            key={theme.id}
            onClick={() => handleThemeSelect(theme)}
            style={{
              background: selectedTheme.id === theme.id 
                ? 'rgba(139, 92, 246, 0.2)' 
                : 'rgba(255, 255, 255, 0.05)',
              border: selectedTheme.id === theme.id 
                ? '2px solid #8B5CF6' 
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '20px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            {/* Theme Preview Mini */}
            <div style={{
              height: '120px',
              borderRadius: '8px',
              marginBottom: '16px',
              overflow: 'hidden',
              background: theme.colors.background,
              padding: '12px',
              position: 'relative'
            }}>
              {/* Mini preview elements */}
              <div style={{
                height: '12px',
                width: '60%',
                background: theme.colors.primary,
                borderRadius: '4px',
                marginBottom: '8px'
              }} />
              <div style={{
                height: '8px',
                width: '100%',
                background: theme.colors.surface,
                borderRadius: '4px',
                marginBottom: '4px'
              }} />
              <div style={{
                height: '8px',
                width: '80%',
                background: theme.colors.surface,
                borderRadius: '4px',
                marginBottom: '8px'
              }} />
              <div style={{
                height: '40px',
                background: theme.id.includes('dark') 
                  ? 'rgba(139, 92, 246, 0.2)' 
                  : theme.colors.surface,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.accent}`
              }} />
              
              {/* Selected badge */}
              {selectedTheme.id === theme.id && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: '#10B981',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: '700'
                }}>
                  ✓ ACTIVE
                </div>
              )}
            </div>

            <h3 style={{
              margin: '0 0 8px 0',
              color: 'white',
              fontSize: '1.1rem',
              fontWeight: '700'
            }}>
              {theme.name}
            </h3>
            
            <p style={{
              margin: 0,
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.85rem',
              lineHeight: 1.5
            }}>
              {theme.description}
            </p>

            {/* Color swatches */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '12px'
            }}>
              {[theme.colors.primary, theme.colors.accent, theme.colors.success].map((color, idx) => (
                <div
                  key={idx}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: color,
                    border: '2px solid rgba(255, 255, 255, 0.2)'
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Live Preview */}
      {showPreview && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          {/* Preview Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>
              📱 Live Preview: {selectedTheme.name}
            </span>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['desktop', 'tablet', 'mobile'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setPreviewMode(mode)}
                  style={{
                    background: previewMode === mode 
                      ? 'rgba(139, 92, 246, 0.3)' 
                      : 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  {mode === 'desktop' ? '🖥️' : mode === 'tablet' ? '📱' : '📲'} {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Frame */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '24px',
            background: '#1a1a2e'
          }}>
            <div style={{
              width: getPreviewWidth(),
              maxWidth: '100%',
              background: selectedTheme.colors.background,
              borderRadius: '8px',
              overflow: 'auto',
              maxHeight: '600px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}>
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: previewContent || generateSampleContent(selectedTheme) 
                }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Theme CSS Export */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
            💾 Export theme CSS for WordPress
          </span>
          <button
            onClick={() => {
              const css = Object.entries(selectedTheme.styles)
                .map(([key, value]) => `.sota-${key} { ${value} }`)
                .join('\n\n');
              navigator.clipboard.writeText(css);
            }}
            style={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem'
            }}
          >
            📋 Copy CSS
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeSelector;

