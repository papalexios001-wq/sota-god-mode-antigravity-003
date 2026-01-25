// =============================================================================
// ENHANCED FEATURES - Optional YouTube, References, Internal Links
// Add these features WITHOUT breaking existing services.tsx
// =============================================================================

import { fetchWithProxies } from './contentUtils';

// ==================== YOUTUBE FINDER ====================

export interface YouTubeVideo {
  title: string;
  videoId: string;
  channel: string;
  relevanceScore: number;
}

export async function findYouTubeVideo(
  keyword: string,
  serperApiKey: string
): Promise<{ html: string; video: YouTubeVideo | null }> {
  if (!serperApiKey) return { html: '', video: null };

  try {
    const response = await fetchWithProxies('https://google.serper.dev/videos', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: `${keyword} tutorial guide`, num: 10 })
    });

    if (!response.ok) return { html: '', video: null };

    const data = await response.json();
    const videos = data.videos || [];

    for (const video of videos) {
      if (!video.link?.includes('youtube.com')) continue;
      
      let videoId = '';
      try {
        const url = new URL(video.link);
        videoId = url.searchParams.get('v') || '';
      } catch { continue; }

      if (!videoId) continue;

      const titleLower = (video.title || '').toLowerCase();
      const keywordLower = keyword.toLowerCase();
      
      // Simple relevance check
      if (titleLower.includes(keywordLower.split(' ')[0])) {
        const result: YouTubeVideo = {
          title: video.title,
          videoId,
          channel: video.channel || 'YouTube',
          relevanceScore: 80
        };

        const html = `
<div style="margin: 2rem 0; background: #0f0f23; border-radius: 16px; overflow: hidden;">
  <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
    <span style="font-size: 1.5rem;">📹</span>
    <strong style="color: #E2E8F0; margin-left: 0.5rem;">Recommended Video</strong>
  </div>
  <div style="position: relative; padding-bottom: 56.25%; height: 0;">
    <iframe 
      src="https://www.youtube.com/embed/${videoId}?rel=0" 
      title="${video.title}"
      frameborder="0" 
      allowfullscreen
      loading="lazy"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    ></iframe>
  </div>
</div>`;

        return { html, video: result };
      }
    }

    return { html: '', video: null };
  } catch (error) {
    console.error('[YouTube] Search failed:', error);
    return { html: '', video: null };
  }
}

// ==================== REFERENCE FETCHER ====================

export interface Reference {
  title: string;
  url: string;
  domain: string;
  authority: 'high' | 'medium';
}

export async function fetchReferences(
  keyword: string,
  serperApiKey: string,
  wpDomain?: string
): Promise<{ html: string; references: Reference[] }> {
  if (!serperApiKey) return { html: '', references: [] };

  try {
    const year = new Date().getFullYear();
    const response = await fetchWithProxies('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: `${keyword} research study ${year}`, num: 15 })
    });

    if (!response.ok) return { html: '', references: [] };

    const data = await response.json();
    const results = data.organic || [];
    const references: Reference[] = [];

    const blocked = ['linkedin.com', 'facebook.com', 'twitter.com', 'youtube.com', 'reddit.com', 'quora.com'];

    for (const item of results) {
      if (references.length >= 8) break;

      try {
        const url = new URL(item.link);
        const domain = url.hostname.replace('www.', '');

        if (blocked.some(b => domain.includes(b))) continue;
        if (wpDomain && domain.includes(wpDomain)) continue;
        if (references.some(r => r.domain === domain)) continue;

        // Quick HEAD check
        const checkRes = await fetch(item.link, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        }).catch(() => null);

        if (!checkRes || checkRes.status !== 200) continue;

        const authority = domain.endsWith('.gov') || domain.endsWith('.edu') ? 'high' : 'medium';

        references.push({
          title: item.title || domain,
          url: item.link,
          domain,
          authority
        });
      } catch { continue; }
    }

    if (references.length === 0) return { html: '', references: [] };

    const html = `
<div style="margin: 3rem 0; padding: 2rem; background: #f8fafc; border-radius: 16px; border-left: 5px solid #3B82F6;">
  <h2 style="margin: 0 0 1rem; color: #1e293b;">📚 References</h2>
  <ul style="margin: 0; padding: 0; list-style: none;">
    ${references.map(r => `
    <li style="margin-bottom: 0.75rem;">
      <a href="${r.url}" target="_blank" rel="noopener" style="color: #1e40af; font-weight: 600;">${r.title}</a>
      <span style="color: #94a3b8; font-size: 0.85rem; margin-left: 0.5rem;">(${r.domain})</span>
    </li>
    `).join('')}
  </ul>
</div>`;

    return { html, references };
  } catch (error) {
    console.error('[References] Fetch failed:', error);
    return { html: '', references: [] };
  }
}

// ==================== EXPORTS ====================

export default {
  findYouTubeVideo,
  fetchReferences
};

