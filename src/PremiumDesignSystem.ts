// ==================== PREMIUM DESIGN SYSTEM ====================
// Modular theme system for generated blog content

export interface BlogPostTheme {
  id: string;
  name: string;
  description: string;
  preview: string; // base64 or URL
  styles: ThemeStyles;
  fonts: ThemeFonts;
  colors: ThemeColors;
}

export interface ThemeStyles {
  container: string;
  heading: string;
  paragraph: string;
  keyTakeaways: string;
  comparisonTable: string;
  faqAccordion: string;
  calloutBox: string;
  stepByStep: string;
  quoteBlock: string;
  productCard: string;
  progressBar: string;
  tableOfContents: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
  accent: string;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  success: string;
  warning: string;
  error: string;
}

// ==================== THEME DEFINITIONS ====================

export const PREMIUM_THEMES: BlogPostTheme[] = [
  {
    id: 'glassmorphism-dark',
    name: 'Glassmorphism Dark',
    description: 'Modern glass-like transparency with dark mode aesthetics',
    preview: '',
    fonts: {
      heading: "'Inter', sans-serif",
      body: "'Inter', sans-serif",
      accent: "'JetBrains Mono', monospace"
    },
    colors: {
      primary: '#8B5CF6',
      secondary: '#EC4899',
      accent: '#3B82F6',
      background: '#0F0F1A',
      surface: 'rgba(255, 255, 255, 0.05)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.7)',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444'
    },
    styles: {
      container: `
        background: linear-gradient(135deg, #0F0F1A 0%, #1E1E2E 100%);
        color: #FFFFFF;
        font-family: 'Inter', sans-serif;
        line-height: 1.8;
        font-size: 18px;
      `,
      heading: `
        font-weight: 800;
        background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 2.5rem 0 1.5rem 0;
      `,
      paragraph: `
        color: rgba(255, 255, 255, 0.9);
        margin-bottom: 1.5rem;
        line-height: 1.9;
      `,
      keyTakeaways: `
        background: rgba(139, 92, 246, 0.1);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 20px;
        padding: 2rem;
        margin: 2.5rem 0;
        box-shadow: 0 8px 32px rgba(139, 92, 246, 0.2);
      `,
      comparisonTable: `
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        overflow: hidden;
        margin: 2rem 0;
      `,
      faqAccordion: `
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        margin-bottom: 12px;
        overflow: hidden;
        transition: all 0.3s ease;
      `,
      calloutBox: `
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
        border-left: 4px solid #3B82F6;
        border-radius: 0 12px 12px 0;
        padding: 1.5rem;
        margin: 2rem 0;
      `,
      stepByStep: `
        position: relative;
        padding-left: 80px;
        margin-bottom: 2rem;
      `,
      quoteBlock: `
        background: rgba(236, 72, 153, 0.1);
        border-left: 4px solid #EC4899;
        border-radius: 0 16px 16px 0;
        padding: 2rem;
        margin: 2rem 0;
        font-style: italic;
        font-size: 1.15rem;
      `,
      productCard: `
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 1.5rem;
        transition: all 0.3s ease;
      `,
      progressBar: `
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        height: 12px;
        overflow: hidden;
        margin: 1rem 0;
      `,
      tableOfContents: `
        position: sticky;
        top: 100px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1.5rem;
        max-height: 70vh;
        overflow-y: auto;
      `
    }
  },
  {
    id: 'clean-minimal',
    name: 'Clean Minimal',
    description: 'Ultra-clean design with maximum readability',
    preview: '',
    fonts: {
      heading: "'Playfair Display', serif",
      body: "'Source Sans Pro', sans-serif",
      accent: "'Fira Code', monospace"
    },
    colors: {
      primary: '#1A1A1A',
      secondary: '#4A4A4A',
      accent: '#2563EB',
      background: '#FFFFFF',
      surface: '#F9FAFB',
      text: '#1A1A1A',
      textMuted: '#6B7280',
      success: '#059669',
      warning: '#D97706',
      error: '#DC2626'
    },
    styles: {
      container: `
        background: #FFFFFF;
        color: #1A1A1A;
        font-family: 'Source Sans Pro', sans-serif;
        line-height: 1.8;
        font-size: 19px;
        max-width: 750px;
        margin: 0 auto;
      `,
      heading: `
        font-family: 'Playfair Display', serif;
        font-weight: 700;
        color: #1A1A1A;
        margin: 3rem 0 1.5rem 0;
        letter-spacing: -0.02em;
      `,
      paragraph: `
        color: #374151;
        margin-bottom: 1.75rem;
        line-height: 1.9;
      `,
      keyTakeaways: `
        background: #F9FAFB;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        padding: 2rem;
        margin: 2.5rem 0;
      `,
      comparisonTable: `
        background: #FFFFFF;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        overflow: hidden;
        margin: 2rem 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      `,
      faqAccordion: `
        border-bottom: 1px solid #E5E7EB;
        padding: 1.5rem 0;
      `,
      calloutBox: `
        background: #EFF6FF;
        border-left: 3px solid #2563EB;
        padding: 1.25rem 1.5rem;
        margin: 2rem 0;
        border-radius: 0 4px 4px 0;
      `,
      stepByStep: `
        position: relative;
        padding-left: 60px;
        margin-bottom: 2rem;
        border-left: 2px solid #E5E7EB;
      `,
      quoteBlock: `
        border-left: 3px solid #1A1A1A;
        padding: 1rem 0 1rem 1.5rem;
        margin: 2rem 0;
        font-style: italic;
        color: #4B5563;
      `,
      productCard: `
        background: #FFFFFF;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        transition: box-shadow 0.2s ease;
      `,
      progressBar: `
        background: #E5E7EB;
        border-radius: 4px;
        height: 8px;
        overflow: hidden;
        margin: 1rem 0;
      `,
      tableOfContents: `
        background: #F9FAFB;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        padding: 1.5rem;
      `
    }
  },
  {
    id: 'magazine-editorial',
    name: 'Magazine Editorial',
    description: 'Bold editorial style with dramatic typography',
    preview: '',
    fonts: {
      heading: "'Oswald', sans-serif",
      body: "'Merriweather', serif",
      accent: "'Roboto Mono', monospace"
    },
    colors: {
      primary: '#000000',
      secondary: '#333333',
      accent: '#FF3366',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      text: '#222222',
      textMuted: '#666666',
      success: '#00C853',
      warning: '#FF9100',
      error: '#FF1744'
    },
    styles: {
      container: `
        background: #FAFAFA;
        color: #222222;
        font-family: 'Merriweather', serif;
        line-height: 1.75;
        font-size: 18px;
      `,
      heading: `
        font-family: 'Oswald', sans-serif;
        font-weight: 700;
        color: #000000;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 3rem 0 1.5rem 0;
        border-bottom: 4px solid #FF3366;
        padding-bottom: 0.5rem;
        display: inline-block;
      `,
      paragraph: `
        color: #333333;
        margin-bottom: 1.5rem;
        text-align: justify;
      `,
      keyTakeaways: `
        background: #000000;
        color: #FFFFFF;
        padding: 2.5rem;
        margin: 3rem -2rem;
        position: relative;
      `,
      comparisonTable: `
        background: #FFFFFF;
        border: 3px solid #000000;
        margin: 2rem 0;
      `,
      faqAccordion: `
        border: 2px solid #000000;
        margin-bottom: 8px;
        background: #FFFFFF;
      `,
      calloutBox: `
        background: #FF3366;
        color: #FFFFFF;
        padding: 2rem;
        margin: 2rem 0;
        font-weight: 600;
      `,
      stepByStep: `
        position: relative;
        padding-left: 80px;
        margin-bottom: 2.5rem;
      `,
      quoteBlock: `
        font-size: 1.5rem;
        font-style: italic;
        border-left: 6px solid #FF3366;
        padding-left: 2rem;
        margin: 3rem 0;
        color: #000000;
      `,
      productCard: `
        background: #FFFFFF;
        border: 2px solid #000000;
        padding: 1.5rem;
        position: relative;
      `,
      progressBar: `
        background: #E0E0E0;
        height: 16px;
        margin: 1rem 0;
      `,
      tableOfContents: `
        background: #000000;
        color: #FFFFFF;
        padding: 2rem;
        font-family: 'Oswald', sans-serif;
      `
    }
  }
];

// ==================== HTML GENERATORS ====================

export const generateKeyTakeawaysHTML = (
  takeaways: string[],
  theme: BlogPostTheme
): string => {
  return `
    <div class="key-takeaways-box" style="${theme.styles.keyTakeaways}">
      <h3 style="margin-top: 0; display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 1.5rem;">⚡</span>
        <span style="font-weight: 800;">Key Takeaways</span>
      </h3>
      <ul style="margin: 0; padding-left: 1.5rem; line-height: 2;">
        ${takeaways.map(t => `<li style="margin-bottom: 0.75rem;"><strong>${t.split(':')[0]}:</strong>${t.split(':').slice(1).join(':')}</li>`).join('')}
      </ul>
    </div>
  `;
};

export const generateComparisonTableHTML = (
  headers: string[],
  rows: string[][],
  theme: BlogPostTheme
): string => {
  const headerBg = theme.id.includes('dark')
    ? 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)'
    : 'linear-gradient(135deg, #1A1A1A 0%, #333333 100%)';

  return `
    <div class="comparison-table" style="${theme.styles.comparisonTable}">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: ${headerBg};">
            ${headers.map(h => `
              <th style="padding: 1rem 1.5rem; text-align: left; color: white; font-weight: 700;">
                ${h}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, idx) => `
            <tr style="background: ${idx % 2 === 0 ? 'transparent' : theme.colors.surface};">
              ${row.map((cell, cidx) => `
                <td style="padding: 1rem 1.5rem; border-bottom: 1px solid ${theme.colors.surface}; ${cidx === 0 ? 'font-weight: 600;' : ''}">
                  ${cell}
                </td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

export const generateFAQHTML = (
  faqs: Array<{ question: string; answer: string }>,
  theme: BlogPostTheme
): string => {
  return `
    <div class="faq-section" style="margin: 3rem 0;">
      <h2 style="${theme.styles.heading}">❓ Frequently Asked Questions</h2>
      ${faqs.map((faq, idx) => `
        <details style="${theme.styles.faqAccordion}" ${idx === 0 ? 'open' : ''}>
          <summary style="
            padding: 1.25rem;
            cursor: pointer;
            font-weight: 700;
            font-size: 1.05rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            list-style: none;
          ">
            <span>${faq.question}</span>
            <span style="transition: transform 0.3s ease;">+</span>
          </summary>
          <div style="padding: 0 1.25rem 1.25rem; line-height: 1.8; color: ${theme.colors.textMuted};">
            ${faq.answer}
          </div>
        </details>
      `).join('')}
    </div>
  `;
};

export const generateStepByStepHTML = (
  steps: Array<{ title: string; content: string }>,
  theme: BlogPostTheme
): string => {
  const numberBg = theme.id.includes('dark')
    ? 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)'
    : '#1A1A1A';

  return `
    <div class="step-by-step-guide" style="margin: 3rem 0;">
      ${steps.map((step, idx) => `
        <div style="${theme.styles.stepByStep}">
          <div style="
            position: absolute;
            left: 0;
            top: 0;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: ${numberBg};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 1.25rem;
          ">
            ${idx + 1}
          </div>
          <h3 style="margin: 0 0 0.75rem 0; font-weight: 700; font-size: 1.2rem;">
            ${step.title}
          </h3>
          <p style="margin: 0; color: ${theme.colors.textMuted}; line-height: 1.8;">
            ${step.content}
          </p>
        </div>
      `).join('')}
    </div>
  `;
};

export const generateProgressBarHTML = (
  label: string,
  value: number,
  maxValue: number,
  theme: BlogPostTheme
): string => {
  const percentage = (value / maxValue) * 100;
  const barColor = theme.id.includes('dark')
    ? 'linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%)'
    : theme.colors.accent;

  return `
    <div style="margin: 1.5rem 0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span style="font-weight: 600;">${label}</span>
        <span style="color: ${theme.colors.textMuted};">${value}/${maxValue}</span>
      </div>
      <div style="${theme.styles.progressBar}">
        <div style="
          width: ${percentage}%;
          height: 100%;
          background: ${barColor};
          border-radius: inherit;
          transition: width 1s ease;
        "></div>
      </div>
    </div>
  `;
};

export const generateQuoteBlockHTML = (
  quote: string,
  author: string,
  role?: string,
  theme?: BlogPostTheme
): string => {
  const defaultStyle = `
    border-left: 4px solid #8B5CF6;
    padding: 1.5rem 2rem;
    margin: 2rem 0;
    background: rgba(139, 92, 246, 0.1);
    border-radius: 0 12px 12px 0;
  `;

  return `
    <blockquote style="${theme?.styles.quoteBlock || defaultStyle}">
      <p style="margin: 0 0 1rem 0; font-size: 1.15rem; font-style: italic;">
        "${quote}"
      </p>
      <footer style="display: flex; align-items: center; gap: 12px;">
        <div style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
        ">
          ${author.charAt(0)}
        </div>
        <div>
          <div style="font-weight: 700;">${author}</div>
          ${role ? `<div style="font-size: 0.85rem; opacity: 0.7;">${role}</div>` : ''}
        </div>
      </footer>
    </blockquote>
  `;
};

export const generateProductCardHTML = (
  product: {
    name: string;
    image: string;
    rating: number;
    price: string;
    features: string[];
    pros: string[];
    cons: string[];
  },
  theme: BlogPostTheme
): string => {
  const stars = '★'.repeat(Math.floor(product.rating)) + '☆'.repeat(5 - Math.floor(product.rating));

  return `
    <div style="${theme.styles.productCard}">
      <div style="display: flex; gap: 24px;">
        <div style="flex-shrink: 0;">
          <img src="${product.image}" alt="${product.name}" style="
            width: 200px;
            height: 200px;
            object-fit: cover;
            border-radius: 12px;
          " />
        </div>
        <div style="flex: 1;">
          <h3 style="margin: 0 0 8px 0; font-size: 1.3rem;">${product.name}</h3>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="color: #F59E0B; font-size: 1.1rem;">${stars}</span>
            <span style="color: ${theme.colors.textMuted};">(${product.rating}/5)</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 800; color: ${theme.colors.primary}; margin-bottom: 16px;">
            ${product.price}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <div style="font-weight: 600; color: ${theme.colors.success}; margin-bottom: 8px;">✓ Pros</div>
              <ul style="margin: 0; padding-left: 16px; font-size: 0.9rem;">
                ${product.pros.map(p => `<li style="margin-bottom: 4px;">${p}</li>`).join('')}
              </ul>
            </div>
            <div>
              <div style="font-weight: 600; color: ${theme.colors.error}; margin-bottom: 8px;">✗ Cons</div>
              <ul style="margin: 0; padding-left: 16px; font-size: 0.9rem;">
                ${product.cons.map(c => `<li style="margin-bottom: 4px;">${c}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

export const generateTableOfContentsHTML = (
  headings: Array<{ level: number; text: string; id: string }>,
  theme: BlogPostTheme
): string => {
  return `
    <nav style="${theme.styles.tableOfContents}" class="floating-toc">
      <h4 style="margin: 0 0 16px 0; font-weight: 700;">📑 Table of Contents</h4>
      <ul style="margin: 0; padding: 0; list-style: none;">
        ${headings.map(h => `
          <li style="margin-bottom: 8px; padding-left: ${(h.level - 2) * 16}px;">
            <a href="#${h.id}" style="
              color: ${theme.colors.textMuted};
              text-decoration: none;
              font-size: ${h.level === 2 ? '0.95rem' : '0.85rem'};
              font-weight: ${h.level === 2 ? '600' : '400'};
              display: block;
              padding: 4px 0;
              transition: color 0.2s ease;
            " onmouseover="this.style.color='${theme.colors.primary}'" onmouseout="this.style.color='${theme.colors.textMuted}'">
              ${h.text}
            </a>
          </li>
        `).join('')}
      </ul>
    </nav>
  `;
};

// ==================== THEME SELECTOR COMPONENT ====================

export const ThemeSelectorHTML = (currentThemeId: string): string => {
  return `
    <div style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(30, 30, 46, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 20px;
      border: 1px solid rgba(139, 92, 246, 0.3);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      z-index: 1000;
    ">
      <h4 style="margin: 0 0 16px 0; color: white; font-size: 0.9rem;">🎨 Theme</h4>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${PREMIUM_THEMES.map(theme => `
          <button 
            onclick="window.setTheme('${theme.id}')"
            style="
              padding: 10px 16px;
              border-radius: 8px;
              border: ${currentThemeId === theme.id ? '2px solid #8B5CF6' : '1px solid rgba(255,255,255,0.1)'};
              background: ${currentThemeId === theme.id ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
              color: white;
              cursor: pointer;
              text-align: left;
              font-size: 0.85rem;
              transition: all 0.2s ease;
            "
          >
            ${theme.name}
          </button>
        `).join('')}
      </div>
    </div>
  `;
};

// ==================== CALLOUT BOX GENERATORS ====================

export const generateCalloutBoxHTML = (
  type: 'info' | 'warning' | 'success' | 'danger' | 'tip',
  title: string,
  content: string,
  theme: BlogPostTheme
): string => {
  const icons: Record<string, string> = {
    info: '💡',
    warning: '⚠️',
    success: '✅',
    danger: '🚨',
    tip: '💎'
  };

  const colors: Record<string, { bg: string; border: string; text: string }> = {
    info: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3B82F6', text: '#93C5FD' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: '#F59E0B', text: '#FCD34D' },
    success: { bg: 'rgba(16, 185, 129, 0.1)', border: '#10B981', text: '#6EE7B7' },
    danger: { bg: 'rgba(239, 68, 68, 0.1)', border: '#EF4444', text: '#FCA5A5' },
    tip: { bg: 'rgba(139, 92, 246, 0.1)', border: '#8B5CF6', text: '#C4B5FD' }
  };

  const colorSet = colors[type] || colors.info;

  return `
    <div class="callout-box callout-${type}" style="
      background: ${colorSet.bg};
      border-left: 4px solid ${colorSet.border};
      border-radius: 0 12px 12px 0;
      padding: 1.5rem;
      margin: 2rem 0;
    ">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <span style="font-size: 1.5rem;">${icons[type]}</span>
        <strong style="font-size: 1.1rem; color: ${colorSet.text};">${title}</strong>
      </div>
      <div style="color: ${theme.colors.textMuted}; line-height: 1.8;">
        ${content}
      </div>
    </div>
  `;
};

// ==================== CTA BUTTON GENERATOR ====================

export const generateCTAButtonHTML = (
  text: string,
  href: string,
  variant: 'primary' | 'secondary' | 'outline' = 'primary',
  theme: BlogPostTheme
): string => {
  const styles: Record<string, string> = {
    primary: `
      background: linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.accent} 100%);
      color: white;
      border: none;
      box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
    `,
    secondary: `
      background: ${theme.colors.surface};
      color: ${theme.colors.text};
      border: 1px solid ${theme.colors.primary};
    `,
    outline: `
      background: transparent;
      color: ${theme.colors.primary};
      border: 2px solid ${theme.colors.primary};
    `
  };

  return `
    <a href="${href}" target="_blank" rel="noopener noreferrer" style="
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 14px 32px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 1rem;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.3s ease;
      ${styles[variant]}
    " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
      ${text}
      <span style="margin-left: 8px;">→</span>
    </a>
  `;
};

// ==================== BADGE GENERATOR ====================

export const generateBadgeHTML = (
  text: string,
  variant: 'default' | 'success' | 'warning' | 'danger' | 'premium' = 'default',
  theme: BlogPostTheme
): string => {
  const colors: Record<string, { bg: string; text: string }> = {
    default: { bg: 'rgba(255, 255, 255, 0.1)', text: theme.colors.text },
    success: { bg: 'rgba(16, 185, 129, 0.2)', text: '#10B981' },
    warning: { bg: 'rgba(245, 158, 11, 0.2)', text: '#F59E0B' },
    danger: { bg: 'rgba(239, 68, 68, 0.2)', text: '#EF4444' },
    premium: { bg: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', text: 'white' }
  };

  const colorSet = colors[variant] || colors.default;

  return `
    <span style="
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: ${colorSet.bg};
      color: ${colorSet.text};
    ">
      ${text}
    </span>
  `;
};

// ==================== STAT CARD GENERATOR ====================

export const generateStatCardHTML = (
  stats: Array<{ label: string; value: string; icon?: string }>,
  theme: BlogPostTheme
): string => {
  return `
    <div style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin: 2rem 0;
    ">
      ${stats.map(stat => `
        <div style="
          background: ${theme.colors.surface};
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        ">
          ${stat.icon ? `<span style="font-size: 2rem; margin-bottom: 8px; display: block;">${stat.icon}</span>` : ''}
          <div style="font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.accent} 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            ${stat.value}
          </div>
          <div style="font-size: 0.85rem; color: ${theme.colors.textMuted}; margin-top: 4px;">
            ${stat.label}
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

// ==================== TIMELINE GENERATOR ====================

export const generateTimelineHTML = (
  events: Array<{ date: string; title: string; description: string }>,
  theme: BlogPostTheme
): string => {
  return `
    <div style="position: relative; margin: 3rem 0; padding-left: 40px;">
      <div style="
        position: absolute;
        left: 15px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: linear-gradient(to bottom, ${theme.colors.primary}, ${theme.colors.secondary || theme.colors.accent});
      "></div>
      ${events.map((event, idx) => `
        <div style="position: relative; margin-bottom: 2rem;">
          <div style="
            position: absolute;
            left: -32px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: ${theme.colors.primary};
            border: 3px solid ${theme.colors.background};
          "></div>
          <div style="
            background: ${theme.colors.surface};
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 1.25rem;
          ">
            <div style="font-size: 0.8rem; color: ${theme.colors.primary}; font-weight: 600; margin-bottom: 4px;">
              ${event.date}
            </div>
            <h4 style="margin: 0 0 8px 0; font-weight: 700;">${event.title}</h4>
            <p style="margin: 0; color: ${theme.colors.textMuted}; line-height: 1.6;">${event.description}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

// ==================== IMAGE GALLERY GENERATOR ====================

export const generateImageGalleryHTML = (
  images: Array<{ src: string; alt: string; caption?: string }>,
  theme: BlogPostTheme
): string => {
  return `
    <div style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin: 2.5rem 0;
    ">
      ${images.map(img => `
        <figure style="margin: 0;">
          <div style="
            overflow: hidden;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          ">
            <img 
              src="${img.src}" 
              alt="${img.alt}"
              loading="lazy"
              style="width: 100%; height: 200px; object-fit: cover; transition: transform 0.3s ease;"
              onmouseover="this.style.transform='scale(1.05)'"
              onmouseout="this.style.transform='scale(1)'"
            />
          </div>
          ${img.caption ? `
            <figcaption style="
              margin-top: 8px;
              font-size: 0.85rem;
              color: ${theme.colors.textMuted};
              text-align: center;
            ">
              ${img.caption}
            </figcaption>
          ` : ''}
        </figure>
      `).join('')}
    </div>
  `;
};

// ==================== AUTHOR BIO BOX ====================

export const generateAuthorBioHTML = (
  author: {
    name: string;
    avatar?: string;
    title: string;
    bio: string;
    socials?: Array<{ platform: string; url: string }>;
  },
  theme: BlogPostTheme
): string => {
  return `
    <div style="
      background: ${theme.colors.surface};
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 2rem;
      margin: 3rem 0;
      display: flex;
      gap: 24px;
      align-items: flex-start;
    ">
      <div style="
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.accent} 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        ${author.avatar ? `background-image: url('${author.avatar}'); background-size: cover;` : ''}
      ">
        ${!author.avatar ? `<span style="font-size: 2rem; color: white; font-weight: 700;">${author.name.charAt(0)}</span>` : ''}
      </div>
      <div style="flex: 1;">
        <h4 style="margin: 0 0 4px 0; font-weight: 700; font-size: 1.2rem;">${author.name}</h4>
        <div style="color: ${theme.colors.primary}; font-size: 0.9rem; margin-bottom: 12px;">${author.title}</div>
        <p style="margin: 0 0 16px 0; color: ${theme.colors.textMuted}; line-height: 1.7;">${author.bio}</p>
        ${author.socials ? `
          <div style="display: flex; gap: 12px;">
            ${author.socials.map(s => `
              <a href="${s.url}" target="_blank" rel="noopener noreferrer" style="
                color: ${theme.colors.textMuted};
                text-decoration: none;
                font-size: 0.85rem;
                transition: color 0.2s ease;
              " onmouseover="this.style.color='${theme.colors.primary}'" onmouseout="this.style.color='${theme.colors.textMuted}'">
                ${s.platform}
              </a>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
};

// ==================== READING PROGRESS BAR ====================

export const generateReadingProgressBarCSS = (theme: BlogPostTheme): string => {
  return `
    <style>
      .reading-progress-bar {
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 4px;
        background: linear-gradient(90deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.accent} 100%);
        z-index: 9999;
        transition: width 0.1s ease;
      }
    </style>
    <div class="reading-progress-bar" id="reading-progress"></div>
    <script>
      window.addEventListener('scroll', function() {
        var winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        var scrolled = (winScroll / height) * 100;
        document.getElementById('reading-progress').style.width = scrolled + '%';
      });
    </script>
  `;
};

// ==================== THEME UTILITIES ====================

export const getThemeById = (id: string): BlogPostTheme | undefined => {
  return PREMIUM_THEMES.find(theme => theme.id === id);
};

export const getDefaultTheme = (): BlogPostTheme => {
  return PREMIUM_THEMES[0];
};

export const applyThemeToContent = (content: string, theme: BlogPostTheme): string => {
  return `
    <div class="themed-content" style="${theme.styles.container}">
      ${content}
    </div>
  `;
};

export const generateThemeStylesheet = (theme: BlogPostTheme): string => {
  return `
    <style>
      .themed-content { ${theme.styles.container} }
      .themed-content h1, .themed-content h2, .themed-content h3 { ${theme.styles.heading} }
      .themed-content p { ${theme.styles.paragraph} }
      .themed-content .key-takeaways-box { ${theme.styles.keyTakeaways} }
      .themed-content .comparison-table { ${theme.styles.comparisonTable} }
      .themed-content .faq-section details { ${theme.styles.faqAccordion} }
      .themed-content blockquote { ${theme.styles.quoteBlock} }
      .themed-content .product-card { ${theme.styles.productCard} }
      .themed-content .floating-toc { ${theme.styles.tableOfContents} }
      
      /* Smooth scrolling */
      html { scroll-behavior: smooth; }
      
      /* FAQ accordion animation */
      .themed-content details[open] summary span:last-child {
        transform: rotate(45deg);
      }
      
      /* Product card hover */
      .themed-content .product-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
      }
      
      /* Link hover effects */
      .themed-content a:not(.btn) {
        color: ${theme.colors.primary};
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s ease;
      }
      .themed-content a:not(.btn):hover {
        border-bottom-color: ${theme.colors.primary};
      }
      
      /* Selection color */
      ::selection {
        background: ${theme.colors.primary};
        color: white;
      }
    </style>
  `;
};

// ==================== EXPORT ALL ====================

export default {
  PREMIUM_THEMES,
  generateKeyTakeawaysHTML,
  generateComparisonTableHTML,
  generateFAQHTML,
  generateStepByStepHTML,
  generateProgressBarHTML,
  generateQuoteBlockHTML,
  generateProductCardHTML,
  generateTableOfContentsHTML,
  generateCalloutBoxHTML,
  generateCTAButtonHTML,
  generateBadgeHTML,
  generateStatCardHTML,
  generateTimelineHTML,
  generateImageGalleryHTML,
  generateAuthorBioHTML,
  generateReadingProgressBarCSS,
  getThemeById,
  getDefaultTheme,
  applyThemeToContent,
  generateThemeStylesheet,
  ThemeSelectorHTML
};
