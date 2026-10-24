A portfolio website showcasing some of my past work/projects in the software engineering environment.

## Résumé admin

`/admin/` provides a private résumé uploader. The Cloudflare Pages project needs:

- `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` encrypted secrets
- an R2 bucket binding named `RESUMES`

Uploaded PDFs are stored at `resume/resume.pdf` in R2. The public résumé route serves
that object when available and falls back to the checked-in PDF.

The signed-in admin page also controls Floating ASCII site-wide. The setting is
stored in `settings/site.json` in the existing R2 bucket and defaults to off.
Disabled pages contain no effect UI or asset references; effect asset requests
return 404. Changes apply to new page loads. Storage failures keep the effect off.

## Private performance debugging

After signing in at `/admin/`, choose **Open portfolio debug mode**. This opens
`/?debugPortfolio` with an authenticated, private ASCII preview, regardless of
the public feature switch. It does not enable ASCII for visitors or change their
saved preferences. The debug page and diagnostic assets require a valid admin
session and are served without caching.

The panel records frame gaps over 80 ms, physics/drawing/geometry timing, both
splat renderers, browser long tasks, script attribution where supported, and
heap size where available. Pause workloads or switch cached glyph rendering off
to compare the old text renderer. Clear measurements after startup before each
comparison. Download the JSON report after reproducing a pause; reports stay
local until explicitly downloaded and shared. A blank script attribution does
not identify a specific browser-internal cause. GPU completion is not measured.

Run regression checks with:

```sh
node tests/ascii-physics.test.cjs
node tests/site-settings.test.mjs
node tests/portfolio-debug.test.cjs
```
