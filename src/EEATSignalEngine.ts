// =============================================================================
// SOTA E-E-A-T SIGNAL INJECTION ENGINE v1.0
// Enterprise-Grade Experience, Expertise, Authoritativeness, Trustworthiness
// =============================================================================

import { SiteInfo } from './types';

// ==================== E-E-A-T INTERFACES ====================

export interface AuthorCredentials {
  name: string;
  title: string;
  organization: string;
  yearsExperience: number;
  certifications: string[];
  socialProfiles: {
    linkedin?: string;
    twitter?: string;
    website?: string;
    googleScholar?: string;
  };
  expertiseAreas: string[];
  notableAchievements: string[];
}

export interface EEATSignals {
  experienceMarkers: string[];
  expertiseIndicators: string[];
  authoritySignals: string[];
  trustSignals: string[];
}

export interface CitationSource {
  title: string;
  url: string;
  domain: string;
  publishDate?: string;
  authorName?: string;
  credibilityScore: number;
  sourceType: 'gov' | 'edu' | 'research' | 'industry' | 'news' | 'other';
}

// ==================== E-E-A-T PROMPT INSTRUCTIONS ====================

export const EEAT_SIGNAL_INSTRUCTIONS = `
===============================================================================
E-E-A-T SIGNAL INJECTION SYSTEM - ENTERPRISE GRADE v1.0
===============================================================================

⚡ EXPERIENCE SIGNALS (First-hand knowledge markers):
- Include specific timeframes: "In my 15 years of experience..."
- Personal testing references: "When I tested this myself..."
- Real-world application stories: "Working with over 500 clients..."
- Specific outcomes: "This approach helped me achieve 340% ROI"
- Behind-the-scenes insights: "What most tutorials don't tell you..."

⚡ EXPERTISE SIGNALS (Deep knowledge indicators):
- Technical precision with correct terminology
- Nuanced explanations that go beyond surface level
- Acknowledgment of edge cases and exceptions
- References to primary research and studies
- Explanation of WHY things work, not just HOW

⚡ AUTHORITATIVENESS SIGNALS (Industry recognition):
- Citation of authoritative sources (.gov, .edu, peer-reviewed)
- Reference to industry standards and best practices
- Mention of recognized certifications or qualifications
- Links to reputable organizations
- Expert quotes with proper attribution

⚡ TRUSTWORTHINESS SIGNALS (Credibility markers):
- Transparent methodology disclosure
- Clear date stamps and "last updated" notices
- Balanced viewpoints including limitations
- Verifiable claims with sources
- Contact information and author credentials

❗ MANDATORY REQUIREMENTS:
1. Include at least 3 first-person experience markers per article
2. Cite minimum 5 authoritative sources (.gov, .edu preferred)
3. Include author credentials section
4. Add "Last Updated: [DATE]" notice
5. Use specific numbers, dates, and verifiable facts
`;

// ==================== EXPERIENCE MARKER TEMPLATES ====================

export const EXPERIENCE_MARKERS = [
  "In my [X] years of working with [topic]...",
  "Having personally tested over [number] solutions...",
  "When I first encountered this problem back in [year]...",
  "Based on my direct experience with [specific case]...",
  "What I've learned from working with [number] clients...",
  "The mistake I made early on was...",
  "Here's what actually works (I've tested it)...",
  "After implementing this for [timeframe]...",
];

// ==================== AUTHORITY SOURCE DOMAINS ====================

export const AUTHORITY_DOMAINS = {
  government: ['.gov', '.gov.uk', '.gov.au', '.europa.eu'],
  educational: ['.edu', '.ac.uk', '.edu.au'],
  research: ['pubmed.ncbi.nlm.nih.gov', 'scholar.google.com', 'jstor.org', 'nature.com', 'sciencedirect.com'],
  industry: ['forbes.com', 'hbr.org', 'mckinsey.com', 'gartner.com', 'statista.com'],
};

// ==================== GENERATE AUTHOR SCHEMA ====================

export function generateAuthorSchema(author: AuthorCredentials): Record<string, any> {
  const sameAs: string[] = [];
  if (author.socialProfiles.linkedin) sameAs.push(author.socialProfiles.linkedin);
  if (author.socialProfiles.twitter) sameAs.push(author.socialProfiles.twitter);
  if (author.socialProfiles.website) sameAs.push(author.socialProfiles.website);
  if (author.socialProfiles.googleScholar) sameAs.push(author.socialProfiles.googleScholar);

  return {
    "@type": "Person",
    "name": author.name,
    "jobTitle": author.title,
    "worksFor": {
      "@type": "Organization",
      "name": author.organization
    },
    "sameAs": sameAs,
    "knowsAbout": author.expertiseAreas,
    "hasCredential": author.certifications.map(cert => ({
      "@type": "EducationalOccupationalCredential",
      "credentialCategory": "certification",
      "name": cert
    }))
  };
}

// ==================== GENERATE SPEAKABLE SCHEMA ====================

export function generateSpeakableSchema(cssSelectors: string[]): Record<string, any> {
  return {
    "@type": "SpeakableSpecification",
    "cssSelector": cssSelectors
  };
}

// ==================== CITATION HTML GENERATOR ====================

export function generateCitationHTML(sources: CitationSource[]): string {
  const sortedSources = [...sources].sort((a, b) => b.credibilityScore - a.credibilityScore);
  
  return `
<div class="sota-citations" style="margin: 40px 0; padding: 30px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border-left: 5px solid #0066cc;">
  <h3 style="color: #0066cc; margin-bottom: 20px; font-size: 1.3em;">📚 Sources & References</h3>
  <ol style="padding-left: 20px; line-height: 2;">
    ${sortedSources.map((source, i) => `
    <li style="margin-bottom: 12px;">
      <a href="${source.url}" target="_blank" rel="noopener" style="color: #0066cc; text-decoration: none; font-weight: 500;">
        ${source.title}
      </a>
      <span style="color: #6c757d; font-size: 0.9em;"> - ${source.domain}</span>
      ${source.publishDate ? `<span style="color: #6c757d; font-size: 0.85em;"> (${source.publishDate})</span>` : ''}
      ${source.sourceType === 'gov' || source.sourceType === 'edu' ? 
        `<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; margin-left: 8px;">✓ Verified Source</span>` : ''}
    </li>
    `).join('')}
  </ol>
</div>
  `;
}

// ==================== AUTHOR BIO HTML GENERATOR ====================

export function generateAuthorBioHTML(author: AuthorCredentials): string {
  return `
<div class="sota-author-bio" style="margin: 40px 0; padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);">
  <div style="display: flex; align-items: flex-start; gap: 20px;">
    <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2em;">👤</div>
    <div style="flex: 1;">
      <h3 style="color: #fff; margin: 0 0 5px 0; font-size: 1.4em;">${author.name}</h3>
      <p style="color: rgba(255,255,255,0.9); margin: 0 0 10px 0; font-size: 1em;">${author.title} at ${author.organization}</p>
      <p style="color: rgba(255,255,255,0.8); margin: 0 0 15px 0; font-size: 0.95em;">
        ${author.yearsExperience}+ years of experience in ${author.expertiseAreas.slice(0, 3).join(', ')}
      </p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        ${author.certifications.slice(0, 4).map(cert => 
          `<span style="background: rgba(255,255,255,0.2); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 0.85em;">✓ ${cert}</span>`
        ).join('')}
      </div>
    </div>
  </div>
</div>
  `;
}

// ==================== LAST UPDATED HTML ====================

export function generateLastUpdatedHTML(): string {
  const now = new Date();
  const formatted = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `
<div class="sota-last-updated" style="display: flex; align-items: center; gap: 8px; color: #6c757d; font-size: 0.9em; margin: 20px 0;">
  <span>🕐</span>
  <span><strong>Last Updated:</strong> ${formatted}</span>
  <span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em;">✓ Fact-Checked</span>
</div>
  `;
}

// ==================== DEFAULT EXPORT ====================

export default {
  EEAT_SIGNAL_INSTRUCTIONS,
  EXPERIENCE_MARKERS,
  AUTHORITY_DOMAINS,
  generateAuthorSchema,
  generateSpeakableSchema,
  generateCitationHTML,
  generateAuthorBioHTML,
  generateLastUpdatedHTML,
};
