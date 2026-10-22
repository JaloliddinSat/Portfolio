import { readSiteSettings } from './_lib/site-settings.js';

const version = '20261022-site-controls-1';
const effectAssets = new Set(['/ascii-physics.js', '/ascii-physics.css']);
const button = `<button class="ascii-toggle" id="ascii-toggle" type="button" aria-label="Turn off floating ASCII" aria-pressed="true" title="Turn off floating ASCII" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-2 18M17 3l-2 18M4 9h16M3 15h16" /></svg><span class="nav-label">ASCII</span></button>`;

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  const isHome = path === '/' || path === '/index.html';
  if (!isHome && !effectAssets.has(path)) return context.next();

  let enabled = false;
  try {
    enabled = (await readSiteSettings(context.env.RESUMES)).asciiEnabled;
  } catch {
    // Missing or unavailable settings must never enable an unpublished feature.
  }
  const headers = { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' };
  if (effectAssets.has(path) && !enabled) {
    return new Response('Not found', { status: 404, headers });
  }

  const original = await context.next();
  const response = new Response(original.body, original);
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  if (!isHome || !enabled || !response.ok || !response.headers.get('Content-Type')?.includes('text/html')) return response;

  return new HTMLRewriter()
    .on('head', { element(element) {
      element.append(`<link rel="stylesheet" href="/ascii-physics.css?v=${version}">`, { html: true });
    } })
    .on('.header-controls', { element(element) { element.prepend(button, { html: true }); } })
    .on('body', { element(element) {
      element.prepend('<canvas class="ascii-curtain" id="ascii-curtain" aria-hidden="true" hidden></canvas>', { html: true });
      element.append(`<script type="module" src="/ascii-physics.js?v=${version}"></script>`, { html: true });
    } })
    .transform(response);
}
