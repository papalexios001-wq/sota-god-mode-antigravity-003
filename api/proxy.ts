import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SOTA-Bot/1.0; +https://sota-god-mode.vercel.app)',
        'Accept': 'application/xml, text/xml, text/html, */*',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Upstream returned ${response.status}: ${response.statusText}` 
      });
    }

    const contentType = response.headers.get('content-type') || 'text/plain';
    const text = await response.text();

    res.setHeader('Content-Type', contentType);
    return res.status(200).send(text);
  } catch (error: any) {
    console.error('[Proxy Error]', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch upstream URL' 
    });
  }
}
