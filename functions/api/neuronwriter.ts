/// <reference types="@cloudflare/workers-types" />

/**
 * SOTA NeuronWriter Proxy v2.0 - Enterprise-Grade
 * Cloudflare Pages Function for proxying NeuronWriter API calls
 * 
 * API Docs: https://neuronwriter.com/faqs/neuronwriter-api-how-to-use/
 * API Endpoint: https://app.neuronwriter.com/neuron-api/0.5/writer
 */

const NEURON_API_BASE = "https://app.neuronwriter.com/neuron-api/0.5/writer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-NeuronWriter-Key, X-API-KEY",
};

interface ProxyRequest {
  endpoint: string;
  method?: string;
  apiKey: string;
  body?: Record<string, unknown>;
}

interface NeuronAPIResponse {
  success: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  type?: string;
}

async function makeNeuronRequest(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: Record<string, unknown>,
  timeoutMs: number = 30000
): Promise<Response> {
  const cleanApiKey = apiKey.trim();
  const url = `${NEURON_API_BASE}${endpoint}`;

  console.log(`[NeuronWriter Proxy] ${method} ${endpoint}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "X-API-KEY": cleanApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "SOTAContentOptimizer/2.0",
      },
      signal: controller.signal,
    };

    if (body && (method === "POST" || method === "PUT")) {
      fetchOptions.body = JSON.stringify(body);
      console.log(`[NeuronWriter Proxy] Body:`, JSON.stringify(body).substring(0, 200));
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const responseText = await response.text();
    let responseData: unknown;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error(`[NeuronWriter Proxy] Failed to parse JSON:`, responseText.substring(0, 200));
      responseData = { raw: responseText };
    }

    console.log(`[NeuronWriter Proxy] Response status: ${response.status}`);

    const result: NeuronAPIResponse = {
      success: response.ok,
      status: response.status,
      data: responseData,
    };

    if (!response.ok) {
      result.error = `NeuronWriter API error: ${response.status}`;
      result.type = "api_error";
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200, // Always return 200 to caller, include actual status in body
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = errorMessage.includes("abort") || errorMessage.includes("timeout");

    console.error(`[NeuronWriter Proxy] Error:`, errorMessage);

    const result: NeuronAPIResponse = {
      success: false,
      status: isTimeout ? 408 : 500,
      error: isTimeout ? "Request timed out after 30s" : errorMessage,
      type: isTimeout ? "timeout" : "network_error",
    };

    return new Response(
      JSON.stringify(result),
      {
        status: 200, // Return 200 so client can parse the error
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKeyFromHeader = request.headers.get("X-NeuronWriter-Key") || request.headers.get("X-API-KEY");

    // Handle GET requests (less common for NeuronWriter)
    if (request.method === "GET") {
      const url = new URL(request.url);
      const endpoint = url.searchParams.get("endpoint");
      const apiKey = url.searchParams.get("apiKey") || apiKeyFromHeader;

      if (!endpoint || !apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing endpoint or apiKey", type: "validation_error" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return await makeNeuronRequest(endpoint, "GET", apiKey);
    }

    // Handle POST requests (primary method for NeuronWriter API)
    if (request.method === "POST") {
      let body: ProxyRequest;

      try {
        body = await request.json();
      } catch (parseError) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid JSON body", type: "parse_error" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { endpoint, method = "POST", apiKey, body: requestBody } = body;
      const finalApiKey = apiKey || apiKeyFromHeader;

      if (!endpoint) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing endpoint", type: "validation_error" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!finalApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing API key", type: "validation_error" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Set appropriate timeout based on endpoint
      let timeout = 30000; // Default 30s
      if (endpoint === "/new-query") {
        timeout = 45000; // 45s for creating new queries
      } else if (endpoint === "/get-query") {
        timeout = 20000; // 20s for fetching query data
      } else if (endpoint === "/list-queries" || endpoint === "/list-projects") {
        timeout = 15000; // 15s for listing
      }

      return await makeNeuronRequest(endpoint, method, finalApiKey, requestBody, timeout);
    }

    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed", type: "method_error" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[NeuronWriter Proxy] Unhandled error:`, errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage, type: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};
