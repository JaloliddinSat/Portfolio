const ADMIN_EMAIL = "jsatimov@uwaterloo.ca";
const COOKIE_NAME = "portfolio_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const RESUME_KEY = "resume/resume.pdf";
const encoder = new TextEncoder();

const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });

const bytesToBase64Url = (bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const base64UrlToBytes = (value) => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const constantTimeEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
};

const digest = async (value) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));

const sign = async (value, secret) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
};

const makeSession = async (secret) => {
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ email: ADMIN_EMAIL, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })),
  );
  return `${payload}.${await sign(payload, secret)}`;
};

const getCookie = (request, name) => {
  const cookies = request.headers.get("Cookie") || "";
  for (const item of cookies.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
};

const isAuthenticated = async (request, secret) => {
  if (!secret) return false;
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  try {
    const expected = await sign(payload, secret);
    if (!constantTimeEqual(base64UrlToBytes(signature), base64UrlToBytes(expected))) return false;
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    return session.email === ADMIN_EMAIL && session.exp > Math.floor(Date.now() / 1000);
  } catch (_) {
    return false;
  }
};

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
