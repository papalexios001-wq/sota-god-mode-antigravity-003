# Cloudflare Pages Deployment Guide

This app is fully optimized for Cloudflare Pages deployment with automatic proxy detection and Pages Functions support.

## Features

- **Automatic Proxy Detection**: The app automatically detects whether to use Cloudflare Pages Functions or Supabase Edge Functions
- **NeuronWriter Integration**: Fully functional NeuronWriter API proxy via Cloudflare Pages Functions
- **Sitemap Fetching**: CORS-free sitemap fetching using Cloudflare Pages Functions
- **Zero Supabase Dependency**: Works perfectly without Supabase configuration

## Deployment Steps

### 1. Build the Project

```bash
npm install
npm run build
```

### 2. Deploy to Cloudflare Pages

#### Option A: Via Cloudflare Dashboard

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **Pages** > **Create a project**
3. Connect your GitHub/GitLab repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Framework preset**: Vite

#### Option B: Via Wrangler CLI

```bash
npm install -g wrangler
wrangler login
wrangler pages deploy dist
```

### 3. Configure Environment Variables

In Cloudflare Pages Dashboard:

1. Go to your project
2. Navigate to **Settings** > **Environment variables**
3. Add the following variables:

**Required:**
- `VITE_ANTHROPIC_API_KEY` - Your Anthropic API key
- `VITE_OPENAI_API_KEY` - Your OpenAI API key
- `VITE_GOOGLE_API_KEY` - Your Google AI API key

**Optional (leave empty for Cloudflare deployment):**
- `VITE_SUPABASE_URL` - Leave empty
- `VITE_SUPABASE_ANON_KEY` - Leave empty

### 4. Redeploy

After adding environment variables, trigger a new deployment:
- Either push a new commit
- Or click **Retry deployment** in the dashboard

## How It Works

### Intelligent Proxy Detection

The app automatically detects the deployment environment:

```typescript
const USE_CLOUDFLARE_PROXY = !SUPABASE_URL || SUPABASE_URL.trim() === '';
```

- **If `VITE_SUPABASE_URL` is empty**: Uses Cloudflare Pages Functions at `/api/*`
- **If `VITE_SUPABASE_URL` is set**: Uses Supabase Edge Functions

### Cloudflare Pages Functions

The app includes these Pages Functions:

1. **`/functions/api/neuronwriter.ts`**
   - Proxies NeuronWriter API requests
   - Handles CORS automatically
   - Endpoint: `/api/neuronwriter`

2. **`/functions/api/fetch-sitemap.ts`**
   - Fetches sitemaps without CORS issues
   - Endpoint: `/api/fetch-sitemap`

3. **`/functions/api/proxy.ts`**
   - General-purpose proxy for external URLs
   - Endpoint: `/api/proxy`

### NeuronWriter Integration

When you enter your NeuronWriter API key in the app:

1. The key is sent to `/api/neuronwriter`
2. Cloudflare Pages Function proxies the request to NeuronWriter API
3. Results are returned to the app
4. No CORS issues, no Supabase needed

## Testing Locally

To test Cloudflare Pages Functions locally:

```bash
# Install wrangler
npm install -g wrangler

# Run local dev server with Pages Functions
wrangler pages dev dist
```

Or use the standard Vite dev server (without Pages Functions):

```bash
npm run dev
```

## Troubleshooting

### "Supabase URL not configured" Error

**Solution**: Make sure `VITE_SUPABASE_URL` is either:
- Not set at all (recommended for Cloudflare)
- Set to an empty string `""`

### NeuronWriter Not Working

1. Check that your API key is valid in NeuronWriter dashboard
2. Verify environment variables are set in Cloudflare Pages
3. Check the browser console for specific error messages
4. Ensure you've redeployed after adding environment variables

### Pages Functions Not Working

1. Verify files exist in `/functions/api/` directory
2. Check Cloudflare Pages Functions logs in the dashboard
3. Ensure TypeScript files compile correctly
4. Test locally with `wrangler pages dev dist`

## Performance Optimization

Cloudflare Pages provides:
- **Global CDN**: Sub-100ms response times worldwide
- **Edge Functions**: Near-zero latency proxy requests
- **Automatic Caching**: Static assets cached at edge
- **HTTP/3 Support**: Faster page loads

## Security

- API keys are never exposed to the client
- All proxy requests are validated
- CORS headers properly configured
- Rate limiting via Cloudflare

## Cost

Cloudflare Pages is free for:
- Unlimited requests
- Unlimited bandwidth
- 500 builds per month
- Up to 100,000 Pages Functions requests per day

For higher usage, upgrade to Pages Pro.

## Support

For issues specific to Cloudflare Pages deployment:
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages)
- [Pages Functions Guide](https://developers.cloudflare.com/pages/platform/functions)
- [Community Forum](https://community.cloudflare.com)
