// ==================== EDITORIAL DESIGN SYSTEM ENGINE ====================
// Purpose: Transform blog HTML into stunning, magazine-quality layouts
// Impact: 100000000000000x more beautiful, modern, professional output

interface DesignConfig {
  typography: TypographySystem;
  colorPalette: ColorSystem;
  spacing: SpacingSystem;
  components: ComponentLibrary;
}

interface TypographySystem {
  headings: {
    h1: { fontSize: string; fontWeight: number; lineHeight: number; letterSpacing: string };
    h2: { fontSize: string; fontWeight: number; lineHeight: number; letterSpacing: string };
    h3: { fontSize: string; fontWeight: number; lineHeight: number; letterSpacing: string };
  };
  body: { fontSize: string; lineHeight: number; fontFamily: string };
  premium: { fontFamily: string; fallback: string[] };
}

interface ColorSystem {
  primary: string;
  accent: string;
  semantic: { success: string; warning: string; info: string };
  gradients: { hero: string; section: string };
}

interface SpacingSystem {
  sections: string;
  paragraphs: string;
  elements: string;
}

interface ComponentLibrary {
  hero: string;
  pullQuote: string;
  statBox: string;
  featureGrid: string;
}

export function applyEditorialDesign(html: string, topic: string): string {
  const designSystem = buildDesignSystem();
  const styledHTML = injectDesignSystem(html, designSystem);
  const enhanced = addPremiumComponents(styledHTML, topic);
  return wrapInModernLayout(enhanced, designSystem);
}

function buildDesignSystem(): DesignConfig {
  return {
    typography: {
      headings: {
        h1: {
          fontSize: 'clamp(2.5rem, 5vw, 4rem)',
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: '-0.02em'
        },
        h2: {
          fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: '-0.01em'
        },
        h3: {
          fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: '0'
        }
      },
      body: {
        fontSize: 'clamp(1.0625rem, 1.5vw, 1.125rem)',
        lineHeight: 1.75,
        fontFamily: 'Georgia'
      },
      premium: {
        fontFamily: 'Inter',
        fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      }
    },
    colorPalette: {
      primary: '#1a1a2e',
      accent: '#0066ff',
      semantic: {
        success: '#10b981',
        warning: '#f59e0b',
        info: '#3b82f6'
      },
      gradients: {
        hero: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        section: 'linear-gradient(to right, #f8fafc 0%, #e2e8f0 100%)'
      }
    },
    spacing: {
      sections: 'clamp(3rem, 8vw, 6rem)',
      paragraphs: 'clamp(1.25rem, 2vw, 1.75rem)',
      elements: 'clamp(1rem, 1.5vw, 1.5rem)'
    },
    components: {
      hero: generateHeroComponent(),
      pullQuote: generatePullQuoteComponent(),
      statBox: generateStatBoxComponent(),
      featureGrid: generateFeatureGridComponent()
    }
  };
}

function generateHeroComponent(): string {
  return `
    .article-hero {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: clamp(3rem, 10vw, 8rem) clamp(1.5rem, 5vw, 3rem);
      color: white;
      text-align: center;
      border-radius: 24px;
      margin-bottom: clamp(3rem, 6vw, 5rem);
      box-shadow: 0 20px 60px rgba(102, 126, 234, 0.3);
    }`;
}

function generatePullQuoteComponent(): string {
  return `
    .pull-quote {
      font-size: clamp(1.5rem, 3vw, 2rem);
      font-weight: 600;
      font-style: italic;
      color: #1a1a2e;
      border-left: 5px solid #0066ff;
      padding: 2rem 2.5rem;
      margin: 3rem 0;
      background: linear-gradient(to right, #f0f7ff 0%, #ffffff 100%);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 102, 255, 0.1);
    }`;
}

function generateStatBoxComponent(): string {
  return `
    .stat-box {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 2rem;
      padding: 3rem;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
      margin: 3rem 0;
    }
    .stat-item {
      text-align: center;
      padding: 2rem;
      border-radius: 12px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    }
    .stat-number {
      font-size: 3rem;
      font-weight: 800;
      color: #0066ff;
      line-height: 1;
    }
    .stat-label {
      font-size: 0.95rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 0.5rem;
    }`;
}

function generateFeatureGridComponent(): string {
  return `
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2.5rem;
      margin: 4rem 0;
    }
    .feature-card {
      padding: 2.5rem;
      background: white;
      border-radius: 16px;
      border: 2px solid #e2e8f0;
      transition: all 0.3s ease;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    }
    .feature-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0, 102, 255, 0.15);
      border-color: #0066ff;
    }`;
}

function injectDesignSystem(html: string, design: DesignConfig): string {
  let styled = html;
  
  // Apply typography
  styled = styled.replace(/<h1>/g, `<h1 style="font-size: ${design.typography.headings.h1.fontSize}; font-weight: ${design.typography.headings.h1.fontWeight}; line-height: ${design.typography.headings.h1.lineHeight}; letter-spacing: ${design.typography.headings.h1.letterSpacing}; color: ${design.colorPalette.primary}; margin-bottom: 1.5rem;">`);
  styled = styled.replace(/<h2>/g, `<h2 style="font-size: ${design.typography.headings.h2.fontSize}; font-weight: ${design.typography.headings.h2.fontWeight}; line-height: ${design.typography.headings.h2.lineHeight}; letter-spacing: ${design.typography.headings.h2.letterSpacing}; color: ${design.colorPalette.primary}; margin-top: 3rem; margin-bottom: 1.25rem;">`);
  styled = styled.replace(/<h3>/g, `<h3 style="font-size: ${design.typography.headings.h3.fontSize}; font-weight: ${design.typography.headings.h3.fontWeight}; line-height: ${design.typography.headings.h3.lineHeight}; color: #374151; margin-top: 2.5rem; margin-bottom: 1rem;">`);
  
  // Apply paragraph styling
  styled = styled.replace(/<p>/g, `<p style="font-size: ${design.typography.body.fontSize}; line-height: ${design.typography.body.lineHeight}; color: #4b5563; margin-bottom: ${design.spacing.paragraphs}; font-family: ${design.typography.body.fontFamily}, serif;">`);
  
  // Enhance lists
  styled = styled.replace(/<ul>/g, '<ul style="margin: 2rem 0; padding-left: 1.5rem;">');
  styled = styled.replace(/<li>/g, '<li style="margin-bottom: 0.75rem; line-height: 1.75; color: #4b5563;">');
  
  return styled;
}

function addPremiumComponents(html: string, topic: string): string {
  let enhanced = html;
  
  // Add hero section
  const heroSection = `<div class="article-hero">
    <h1 style="color: white; margin: 0; font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 800;">${topic}</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 1.25rem; margin-top: 1.5rem; max-width: 700px; margin-left: auto; margin-right: auto;">Expert insights and comprehensive guide</p>
  </div>`;
  
  enhanced = heroSection + enhanced;
  
  return enhanced;
}

function wrapInModernLayout(html: string, design: DesignConfig): string {
  return `
    <style>
      ${design.components.hero}
      ${design.components.pullQuote}
      ${design.components.statBox}
      ${design.components.featureGrid}
      
      .modern-article-container {
        max-width: 850px;
        margin: 0 auto;
        padding: clamp(2rem, 5vw, 4rem) clamp(1rem, 3vw, 2rem);
        font-family: ${design.typography.premium.fontFamily}, ${design.typography.premium.fallback.join(', ')};
        background: #ffffff;
        min-height: 100vh;
      }
      
      .content-wrapper {
        background: white;
      }
      
      img {
        max-width: 100%;
        height: auto;
        border-radius: 12px;
        margin: 2.5rem 0;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      }
      
      a {
        color: ${design.colorPalette.accent};
        text-decoration: none;
        font-weight: 600;
        border-bottom: 2px solid transparent;
        transition: border-color 0.2s;
      }
      
      a:hover {
        border-bottom-color: ${design.colorPalette.accent};
      }
      
      blockquote {
        ${design.components.pullQuote.replace('.pull-quote {', '').replace('}', '')}
      }
      
      @media (max-width: 768px) {
        .modern-article-container {
          padding: 1.5rem 1rem;
        }
      }
    </style>
    
    <div class="modern-article-container">
      <div class="content-wrapper">
        ${html}
      </div>
    </div>
  `;
}

// ==================== INTEGRATION ====================
export function enhanceContentWithEditorialDesign(content: string, metadata: { topic: string }): string {
  return applyEditorialDesign(content, metadata.topic);
}
