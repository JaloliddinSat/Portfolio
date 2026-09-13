const RESUME_KEY = "resume/resume.pdf";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname !== "/resume/resume.pdf") {
    return env.ASSETS.fetch(request);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  if (env.RESUMES) {
    const object = await env.RESUMES.get(RESUME_KEY, {
      range: request.headers,
    });

    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("ETag", object.httpEtag);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");

      if (object.range) {
        const offset = object.range.offset || 0;
        const length = object.range.length || object.size;
        headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
        headers.set("Content-Length", String(length));
      } else {
        headers.set("Content-Length", String(object.size));
      }

      return new Response(request.method === "HEAD" ? null : object.body, {
        status: object.range ? 206 : 200,
        headers,
      });
    }
  }

  const fallbackUrl = new URL(request.url);
  fallbackUrl.pathname = "/resume/resume.pdf";
  return env.ASSETS.fetch(new Request(fallbackUrl, request));
}
