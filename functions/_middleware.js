import { isAuthenticated } from './_lib/admin-auth.js';
import { readSiteSettings, DEFAULT_SITE_SETTINGS } from './_lib/site-settings.js';

const version = '20261024-half-screen-spawn-1';
const debugAssets = new Set(['/portfolio-debug.js', '/portfolio-debug.css']);
const colorAssets = new Set(['/splat-color-debug.js', '/splat-color-debug.css', '/splat-color-core.mjs']);
const effectAssets = new Set(['/ascii-physics.js', '/ascii-physics.css']);
const button = `<button class="ascii-toggle" id="ascii-toggle" type="button" aria-label="Turn off floating ASCII" aria-pressed="true" title="Turn off floating ASCII" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-2 18M17 3l-2 18M4 9h16M3 15h16" /></svg><span class="nav-label">ASCII</span></button>`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const isHome = path === '/' || path === '/index.html';
  if (!isHome && !effectAssets.has(path) && !debugAssets.has(path) && !colorAssets.has(path)) return context.next();
  const wantsDebug = isHome && url.searchParams.has('debugPortfolio');
  const wantsColor = isHome && url.searchParams.has('debugSplatColor');
  const authenticated = (wantsDebug || wantsColor || colorAssets.has(path) || debugAssets.has(path) || effectAssets.has(path)) &&
    await isAuthenticated(context.request, context.env.ADMIN_SESSION_SECRET);
  if ((wantsDebug || wantsColor) && !authenticated) {
    return new Response(null, { status: 302, headers: { Location: '/admin/', 'Cache-Control': 'no-store' } });
  }
  if ((debugAssets.has(path) || colorAssets.has(path)) && !authenticated) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const debug = wantsDebug && authenticated;
  const colorDebug = wantsColor && authenticated;

  let settings = { ...DEFAULT_SITE_SETTINGS };
  let enabled = false;
  try {
    settings = await readSiteSettings(context.env.RESUMES);
    enabled = settings.asciiEnabled;
  } catch {
    // Missing or unavailable settings must never enable an unpublished feature.
  }
  enabled = enabled || debug;
  const headers = { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' };
  if (effectAssets.has(path) && !enabled && !authenticated) {
    return new Response('Not found', { status: 404, headers });
  }

  const original = await context.next();
  const response = new Response(original.body, original);
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  if (debug || colorDebug || debugAssets.has(path) || colorAssets.has(path)) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (!isHome || !response.ok || !response.headers.get('Content-Type')?.includes('text/html')) return response;

  const rewriter = new HTMLRewriter()
    .on('head', { element(element) {
      if (colorDebug) element.append('<link rel="stylesheet" href="/splat-color-debug.css?v=1"><script type="module" src="/splat-color-debug.js?v=1"></script>', { html: true });
    } })
    .on('html', { element(element) {
      element.setAttribute('data-grid-content-glow-multiplier', String(settings.gridContentGlowMultiplier));
    } });
  if (!enabled) return rewriter.transform(response);
  return rewriter
    .on('head', { element(element) {
      if (debug) {
        element.append(`<link rel="stylesheet" href="/portfolio-debug.css?v=${version}"><script src="/portfolio-debug.js?v=${version}"></script>`, { html: true });
      }
      element.append(`<link rel="stylesheet" href="/ascii-physics.css?v=${version}">`, { html: true });
    } })
    .on('.header-controls', { element(element) { if (debug) element.prepend(button, { html: true }); } })
    .on('body', { element(element) {
      element.prepend(`<canvas class="ascii-curtain" id="ascii-curtain" aria-hidden="true" data-ascii-config='${JSON.stringify(settings)}' hidden></canvas>`, { html: true });
      element.append(`<script type="module" src="/ascii-physics.js?v=${version}"></script>`, { html: true });
    } })
    .transform(response);
}
