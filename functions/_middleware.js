import { isAuthenticated } from './_lib/admin-auth.js';
import { readSiteSettings, DEFAULT_SITE_SETTINGS } from './_lib/site-settings.js';

const version = '20261027-gpu-diagnostics-2';
const debugAssets = new Set(['/portfolio-debug.js', '/portfolio-debug.css']);
const colorAssets = new Set(['/splat-color-debug.js', '/splat-color-debug.css']);
const cutoffAssets = new Set(['/splat-cutoff-debug.js', '/splat-cutoff-debug.css']);
const fogAssets = new Set(['/splat-fog-debug.js', '/splat-fog-debug.css']);
const overlayAssets = new Set(['/splat-overlay-debug.js', '/splat-overlay-debug.css']);
const washAssets = new Set(['/splat-wash-debug.js', '/splat-wash-debug.css']);
const effectAssets = new Set(['/ascii-physics.js', '/ascii-physics.css']);
const button = `<button class="ascii-toggle" id="ascii-toggle" type="button" aria-label="Turn off floating ASCII" aria-pressed="true" title="Turn off floating ASCII" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-2 18M17 3l-2 18M4 9h16M3 15h16" /></svg><span class="nav-label">ASCII</span></button>`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const isHome = path === '/' || path === '/index.html';
  if (!isHome && !effectAssets.has(path) && !debugAssets.has(path) && !colorAssets.has(path) && !cutoffAssets.has(path) && !fogAssets.has(path) && !overlayAssets.has(path) && !washAssets.has(path)) return context.next();
  const wantsDebug = isHome && url.searchParams.has('debugPortfolio');
  const wantsColor = isHome && url.searchParams.has('debugSplatColor');
  const wantsCutoff = isHome && url.searchParams.has('debugSplatCutoff');
  const wantsFog = isHome && url.searchParams.has('debugSplatFog');
  const wantsOverlay = isHome && url.searchParams.has('debugSplatOverlay');
  const wantsWash = isHome && url.searchParams.has('debugSplatWash');
  const authenticated = (wantsDebug || wantsColor || wantsCutoff || wantsFog || wantsOverlay || wantsWash || washAssets.has(path) || overlayAssets.has(path) || fogAssets.has(path) || cutoffAssets.has(path) || colorAssets.has(path) || debugAssets.has(path) || effectAssets.has(path)) &&
    await isAuthenticated(context.request, context.env.ADMIN_SESSION_SECRET);
  if ((wantsDebug || wantsColor || wantsCutoff || wantsFog || wantsOverlay || wantsWash) && !authenticated) {
    return new Response(null, { status: 302, headers: { Location: '/admin/', 'Cache-Control': 'no-store' } });
  }
  if ((debugAssets.has(path) || colorAssets.has(path) || cutoffAssets.has(path) || overlayAssets.has(path) || washAssets.has(path) || fogAssets.has(path)) && !authenticated) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const debug = wantsDebug && authenticated;
  const colorDebug = wantsColor && authenticated;
  const cutoffDebug = wantsCutoff && authenticated;
  const fogDebug = wantsFog && authenticated;
  const overlayDebug = wantsOverlay && authenticated;
  const washDebug = wantsWash && authenticated;

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
  if (debug || colorDebug || cutoffDebug || fogDebug || overlayDebug || washDebug || debugAssets.has(path) || colorAssets.has(path) || cutoffAssets.has(path) || overlayAssets.has(path) || washAssets.has(path) || fogAssets.has(path)) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (!isHome || !response.ok || !response.headers.get('Content-Type')?.includes('text/html')) return response;

  const rewriter = new HTMLRewriter()
    .on('head', { element(element) {
      if (overlayDebug) element.append('<link rel="stylesheet" href="/splat-overlay-debug.css?v=2"><script type="module" src="/splat-overlay-debug.js?v=5"></script>', { html: true });
      if (washDebug) element.append('<link rel="stylesheet" href="/splat-wash-debug.css?v=1"><script type="module" src="/splat-wash-debug.js?v=1"></script>', { html: true });
      if (colorDebug) element.append('<link rel="stylesheet" href="/splat-color-debug.css?v=1"><script type="module" src="/splat-color-debug.js?v=2"></script>', { html: true });
      if (fogDebug) element.append('<link rel="stylesheet" href="/splat-fog-debug.css?v=1"><script type="module" src="/splat-fog-debug.js?v=4"></script>', { html: true });
      if (cutoffDebug) element.append('<link rel="stylesheet" href="/splat-cutoff-debug.css?v=1"><script type="module" src="/splat-cutoff-debug.js?v=2"></script>', { html: true });
    } })
    .on('html', { element(element) {
      element.setAttribute('data-grid-content-glow-multiplier', String(settings.gridContentGlowMultiplier));
      element.setAttribute('data-hero-camera-duration', String(settings.heroCameraDuration));
      element.setAttribute('data-hero-reveal-duration', String(settings.heroRevealDuration));
    } })
    // Keep cached page assets from pinning the camera implementation to an old
    // script reference during a deployment; settings already bypass page caching.
    .on('script[src^="script.js"], script[src^="/script.js"]', { element(element) {
      element.setAttribute('src', '/script.js?v=20261027-light-wash-3');
    } })
    .on('link[rel="stylesheet"][href^="styles.css"], link[rel="stylesheet"][href^="/styles.css"]', { element(element) {
      element.setAttribute('href', '/styles.css?v=20261027-light-wash');
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
