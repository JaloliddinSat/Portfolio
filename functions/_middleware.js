import { isAuthenticated } from './_lib/admin-auth.js';
import { readSiteSettings, DEFAULT_SITE_SETTINGS } from './_lib/site-settings.js';

const version = '20261024-site-controls-2';
const debugAssets = new Set(['/portfolio-debug.js', '/portfolio-debug.css']);
const effectAssets = new Set(['/ascii-physics.js', '/ascii-physics.css']);
const button = `<button class="ascii-toggle" id="ascii-toggle" type="button" aria-label="Turn off floating ASCII" aria-pressed="true" title="Turn off floating ASCII" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-2 18M17 3l-2 18M4 9h16M3 15h16" /></svg><span class="nav-label">ASCII</span></button>`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const isHome = path === '/' || path === '/index.html';
  if (!isHome && !effectAssets.has(path) && !debugAssets.has(path)) return context.next();
  const wantsDebug = isHome && url.searchParams.has('debugPortfolio');
  const authenticated = (wantsDebug || debugAssets.has(path) || effectAssets.has(path)) &&
    await isAuthenticated(context.request, context.env.ADMIN_SESSION_SECRET);
  if (wantsDebug && !authenticated) {
    return new Response(null, { status: 302, headers: { Location: '/admin/', 'Cache-Control': 'no-store' } });
  }
  if (debugAssets.has(path) && !authenticated) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const debug = wantsDebug && authenticated;

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
  if (debug || debugAssets.has(path)) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (!isHome || !enabled || !response.ok || !response.headers.get('Content-Type')?.includes('text/html')) return response;

  return new HTMLRewriter()
    .on('head', { element(element) {
      if (debug) {
        element.append(`<link rel="stylesheet" href="/portfolio-debug.css?v=${version}"><script src="/portfolio-debug.js?v=${version}"></script>`, { html: true });
      }
      element.append(`<link rel="stylesheet" href="/ascii-physics.css?v=${version}">`, { html: true });
    } })
    .on('.header-controls', { element(element) { element.prepend(button, { html: true }); } })
    .on('body', { element(element) {
      element.prepend(`<canvas class="ascii-curtain" id="ascii-curtain" aria-hidden="true" data-ascii-config='${JSON.stringify(settings)}' hidden></canvas>`, { html: true });
      element.append(`<script type="module" src="/ascii-physics.js?v=${version}"></script>`, { html: true });
    } })
    .transform(response);
}
