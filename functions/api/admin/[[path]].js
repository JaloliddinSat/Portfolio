import { readSiteSettings, SITE_SETTINGS_KEY, validateSiteSettingsPatch } from '../../_lib/site-settings.js';

import { ADMIN_EMAIL, SESSION_TTL_SECONDS, constantTimeEqual, digest, makeSession, isAuthenticated } from '../../_lib/admin-auth.js';

const COOKIE_NAME = "portfolio_admin_session";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const RESUME_KEY = "resume/resume.pdf";
const json = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: { "Cache-Control": "no-store", ...headers },
});

const sameOrigin = (request) => {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
};

const currentResume = async (bucket) => {
  if (!bucket) return null;
  const object = await bucket.head(RESUME_KEY);
  if (!object) return null;
  return { uploadedAt: object.uploaded.toISOString(), size: object.size };
};

export async function onRequest(context) {
  const { request, env } = context;
  const route = new URL(request.url).pathname.replace(/^\/api\/admin\/?/, "").replace(/\/$/, "");

  if (request.method === "POST" && !sameOrigin(request)) {
    return json({ error: "Request origin was not accepted." }, 403);
  }

  if (route === "login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
      return json({ error: "Admin access has not been configured yet." }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: "Invalid sign-in request." }, 400);
    }

    const emailMatches = String(body.email || "").trim().toLowerCase() === ADMIN_EMAIL;
    const suppliedDigest = await digest(String(body.password || ""));
    const expectedDigest = await digest(env.ADMIN_PASSWORD);
    const passwordMatches = constantTimeEqual(suppliedDigest, expectedDigest);

    if (!emailMatches || !passwordMatches) {
      return json({ error: "The email or password is incorrect." }, 401);
    }

    const session = await makeSession(env.ADMIN_SESSION_SECRET);
    return json(
      { ok: true, resume: await currentResume(env.RESUMES) },
      200,
      {
        "Set-Cookie": `${COOKIE_NAME}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
      },
    );
  }

  if (route === "logout" && request.method === "POST") {
    return json(
      { ok: true },
      200,
      { "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` },
    );
  }

  if (!(await isAuthenticated(request, env.ADMIN_SESSION_SECRET))) {
    return json({ error: "Please sign in to continue." }, 401);
  }

  if (route === "session" && request.method === "GET") {
    return json({ authenticated: true, resume: await currentResume(env.RESUMES) });
  }

  if (route === "settings" && (request.method === "GET" || request.method === "POST")) {
    if (!env.RESUMES) return json({ error: "Site settings storage is unavailable." }, 503);
    try {
      if (request.method === "GET") return json(await readSiteSettings(env.RESUMES));
      let body;
      try { body = await request.json(); } catch { return json({ error: "Invalid settings request." }, 400); }
      try { validateSiteSettingsPatch(body); } catch (error) { return json({ error: error.message }, 400); }
      const settings = { ...await readSiteSettings(env.RESUMES), ...body };
      await env.RESUMES.put(SITE_SETTINGS_KEY, JSON.stringify(settings), {
        httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
      });
      return json(settings);
    } catch {
      return json({ error: "Site settings could not be saved or loaded. Please try again." }, 503);
    }
  }

  if (route === "resume" && request.method === "POST") {
    if (!env.RESUMES) {
      return json({ error: "Resume storage has not been configured yet." }, 503);
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_FILE_SIZE) {
      return json({ error: "The PDF must be 10 MB or smaller." }, 413);
    }

    const file = await request.arrayBuffer();
    if (!file.byteLength || file.byteLength > MAX_FILE_SIZE) {
      return json({ error: "The PDF must be between 1 byte and 10 MB." }, 413);
    }

    const signature = new TextDecoder().decode(file.slice(0, 5));
    if (signature !== "%PDF-") {
      return json({ error: "The selected file is not a valid PDF." }, 415);
    }

    const uploadedAt = new Date();
    await env.RESUMES.put(RESUME_KEY, file, {
      httpMetadata: {
        contentType: "application/pdf",
        contentDisposition: 'inline; filename="Jalol-Satimov-Resume.pdf"',
        cacheControl: "public, max-age=0, must-revalidate",
      },
      customMetadata: {
        uploadedAt: uploadedAt.toISOString(),
      },
    });

    return json({
      ok: true,
      resume: { uploadedAt: uploadedAt.toISOString(), size: file.byteLength },
    });
  }

  return json({ error: "Not found." }, 404);
}
