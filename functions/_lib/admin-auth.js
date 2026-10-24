export const ADMIN_EMAIL = "jsatimov@uwaterloo.ca";
const COOKIE_NAME = "portfolio_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
const encoder = new TextEncoder();

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

export const constantTimeEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
};

export const digest = async (value) =>
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

export const makeSession = async (secret) => {
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

export const isAuthenticated = async (request, secret) => {
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

