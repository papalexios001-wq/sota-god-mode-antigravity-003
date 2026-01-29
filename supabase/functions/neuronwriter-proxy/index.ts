import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-NeuronWriter-Key",
};

const NEURON_API_BASE = "https://app.neuronwriter.com/api/v1";

interface ProxyRequest {
  endpoint: string;
  method?: string;
  apiKey: string;
  body?: Record<string, unknown>;
}

async function makeNeuronRequest(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const url = `${NEURON_API_BASE}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "ContentOptimizer/1.0",
      },
      signal: controller.signal,
    };

    if (body && (method === "POST" || method === "PUT")) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const responseText = await response.text();
    let responseData: unknown;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        data: responseData,
      }),
      {
        status: response.ok ? 200 : response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = errorMessage.includes("abort");

    return new Response(
      JSON.stringify({
        success: false,
        error: isTimeout ? "Request timed out" : errorMessage,
        type: isTimeout ? "timeout" : "network_error",
      }),
      {
        status: isTimeout ? 408 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKeyFromHeader = req.headers.get("X-NeuronWriter-Key");

    if (req.method === "GET") {
      const url = new URL(req.url);
      const endpoint = url.searchParams.get("endpoint");
      const apiKey = url.searchParams.get("apiKey") || apiKeyFromHeader;

      if (!endpoint || !apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing endpoint or apiKey" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return await makeNeuronRequest(endpoint, "GET", apiKey);
    }

    if (req.method === "POST") {
      const body: ProxyRequest = await req.json();
      const { endpoint, method = "POST", apiKey, body: requestBody } = body;

      const finalApiKey = apiKey || apiKeyFromHeader;

      if (!endpoint || !finalApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing endpoint or apiKey" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return await makeNeuronRequest(endpoint, method, finalApiKey, requestBody);
    }

    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
