import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FetchRequest {
  url: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let targetUrl: string | null = null;

    if (req.method === "GET") {
      const params = new URL(req.url).searchParams;
      targetUrl = params.get("url");
    } else if (req.method === "POST") {
      const body: FetchRequest = await req.json();
      targetUrl = body.url;
    }

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: "URL parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      new URL(targetUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContentOptimizer/1.0; +https://gearuptofit.com)",
        "Accept": "application/xml, text/xml, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: `Failed to fetch: HTTP ${response.status}`,
          status: response.status
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const content = await response.text();
    const contentType = response.headers.get("content-type") || "text/plain";

    const isXml = contentType.includes("xml") || content.trim().startsWith("<?xml") || content.includes("<urlset");

    if (req.method === "GET" && isXml) {
      return new Response(content, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
        },
      });
    }

    return new Response(
      JSON.stringify({
        content,
        contentType,
        url: targetUrl,
        size: content.length,
        isXml,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = errorMessage.includes("abort") || errorMessage.includes("timeout");

    return new Response(
      JSON.stringify({
        error: isTimeout ? "Request timed out after 55 seconds" : errorMessage,
        type: isTimeout ? "timeout" : "fetch_error",
      }),
      {
        status: isTimeout ? 408 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
