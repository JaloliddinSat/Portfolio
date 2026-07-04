const R2_SPLAT_URL =
  "https://pub-d916d22154a943f291079592fbe25397.r2.dev/University%20District%202.ksplat";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
};

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const upstreamHeaders = new Headers();

  const range = request.headers.get("range");
  if (range) {
    upstreamHeaders.set("range", range);
  }

  const upstreamResponse = await fetch(R2_SPLAT_URL, {
    method: request.method,
    headers: upstreamHeaders,
  });

  const responseHeaders = new Headers(upstreamResponse.headers);

  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type");
  responseHeaders.set("Content-Type", "application/octet-stream");
  responseHeaders.set(
    "Cache-Control",
    "public, max-age=31536000, immutable",
  );

  return new Response(
    request.method === "HEAD" ? null : upstreamResponse.body,
    {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    },
  );
}
