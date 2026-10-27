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

Characters start spawning once the grid section reaches halfway up the viewport,
while the upper half still shows the hero. They remain confined below the grid
boundary, and activation persists if the visitor scrolls back up.

Animation settings in admin also control rotation (0–4×), scale (0.25–3×),
the total character limit (0–500), and an edge spawn width (20%, 40%, 60%,
80%, or 100% of the top edge). For example, 20% uses the outer 10% on each
side and leaves the middle 80% empty. Saving these controls preserves the public
enable switch. Reload the portfolio or private debug preview to apply changes.
Existing settings keep the original defaults: 1× rotation, 1× scale, 240
characters, and full-width spawning.

Cursor gravity controls include strength (0–3000 px/s², default 0/off), influence
radius (0–2000 px, default 300), falloff exponent (0.25–6, default 2), and maximum
speed (0–600 px/s, default 600). Dark theme attracts; light theme repels. Inside
the radius, acceleration scales by `(1 - distance / radius)^falloff`, softened
within 24 px of the cursor. A higher exponent concentrates influence nearer the
cursor; at half the radius, exponent 2 gives 25% strength. Strength or radius 0
skips force calculations. Speed caps include spawns, throws, and collisions;
speed 0 stops travel but allows manual dragging and rotation. Forces ignore the
hero, a cursor outside the window, and the particle being dragged. The private
debugger reports the saved force configuration alongside existing timing data.

Dark-theme attraction also uses a per-character pass-through cooldown. Within the
release distance (default 40 px, configurable 0–500 and capped at the influence
radius), attraction pauses for at least the cooldown (default 1 second, 0–10).
It resumes only after the character is 1.5× the release distance away. Slow
characters inside the release zone receive an outward escape speed (default
100 px/s, configurable 0–600), capped by maximum speed; faster characters retain
their momentum. A slowdown after a collision can trigger another nudge while
inside the zone. Release distance 0 disables pass-through; nudge 0 keeps only
the cooldown. Light-theme repulsion is unchanged.

The cursor idle timeout (default 2 seconds, configurable 0–60) switches off all
cursor forces in dark theme, including escape nudges, once the pointer stops
moving. Characters keep their velocity and collisions; dragging still works.
Real pointer movement restores attraction, subject to per-character cooldowns.
Clicks at the same position, scrolling, and duplicate pointer events do not
restart the timer. Timing uses wall-clock time, including background pauses.
Set 0 to disable the timeout. Light-theme repulsion remains active while idle.

Grid glow has an independent `gridContentGlowMultiplier` setting (0–1, default
0.25) in admin. When the pointer overlaps a content hitbox, both background and
card-local glow brightness use this multiplier; empty space stays at 1×. A value
of 0 hides the glow over content, and 1 disables dimming. This works in both
themes with floating ASCII disabled. The main glow and physics share
`content-hitboxes.js`: cards use full rectangles, standalone text uses line
rectangles, and images/videos use their bounds. Glow geometry is cached and
invalidated on resize, font readiness and content size changes; scrolling and
hero transitions update the pointer overlap without a continuous animation loop.

Gravity dimming is independently controlled in admin (enabled by default,
multiplier 0.25, range 0–1). When the cursor overlaps the shared content map,
both dark attraction and light repulsion use this strength multiplier; escape
nudges scale with it too. A multiplier of 0 disables cursor forces over content,
and 1 preserves full strength. Empty space retains full strength. The glow
brightness setting does not change the gravity multiplier.

The public portfolio has no ASCII menu switch. The admin site-wide control
remains authoritative, and reduced-motion preferences still suppress the effect.
Old visitor toggle preferences are ignored on the public page. A comparison
switch remains available only in the authenticated debug preview.

Cursor gravity is split into **Light theme — cursor repulsion** and **Dark theme
— cursor attraction** in admin. Strength, radius, falloff and maximum speed are
independent. Old shared settings initialize the new light controls on first
load; saving one theme does not change the other. Idle cutoff and pass-through
settings remain dark-only; gravity dimming continues to affect both themes.

**Post-release force cooldown** is shared across themes (default 1.5 seconds,
range 0–10). Each dropped or thrown glyph ignores all cursor forces, including
escape nudges, until its release deadline. Normal movement, collisions, spin
and the active theme's speed limit continue. Switching themes during this
period does not bypass immunity. Set 0 for immediate cursor influence.

Throw velocity uses a fixed 32-sample ring of client coordinates (768 bytes),
reused across drags. Moves record samples in constant time; release alone scans
up to 32 samples to estimate recent direction and speed. Duplicate stationary
events do not erase momentum. A brief pause preserves the fling, then throw
speed fades smoothly from 80 to 260 ms of stillness, allowing deliberate placement.
Scrolling never contributes velocity. Cancellation releases without a fling.
The private debugger shows the last release velocity and sample count.

## Private performance debugging

### Hero scene reveal

On desktop and mobile, the Fairview hero reveals outward through 3D geometry
over 3 seconds from a point on the torso, with a soft, noise-shaped boundary.
The shader uses each splat's horizontal XZ distance from that point in scene space,
independent of camera projection. Distance and noise ignore height, producing a
vertical cylinder that reveals the head and body together. The same model-space
origin follows both scene scales.
Unrevealed geometry appears as sparse monochrome dots; the same draw morphs
them into full-sized, graded splats as the cylinder passes. Dot selection stays
stable, and their tone follows the site theme.
The radius grows through the nearby body and furniture before reaching the
capture's distant background shell. The existing frame driver keeps the mobile
renderer awake through the final frame, then returns to its usual idle behavior.
No extra rendering pass is added during the animation.

Both devices download the complete scene, finish the visibility tree and final
sort, then compile and render the graded scene and active reveal while hidden.
GPU fences yield until that work finishes before starting the animation clock.
The offscreen StepNote renderer initializes near its section so its scene loading
does not compete with the hero intro; its dedicated debug mode still loads at once.
The full-scene poster stays hidden until completion and returns on failure.
Immediate scrolling completes the reveal before the depth transition takes over.
Reduced motion and camera debug mode skip the reveal. Refresh to replay it.

The camera starts almost directly above the body. After the loaded scene begins
its cylinder reveal, it holds overhead for 350 ms, then follows a 2.2-second arc
to the original hero camera position and aim. Mobile transforms the overhead
origin with the scene scale. The same readiness and hidden GPU warm-up gate both
animations; reduced motion skips the camera move as well. Scrolling takes over
immediately, and the normal scroll path and pointer parallax resume after landing.
Higher angles can expose stretched or sparse peripheral geometry in this capture.

### Hero splat color grading

Choose **Color grade the hero splat** in admin to open `/?debugSplatColor`.
This authenticated preview grades the real Fairview renderer with master RGB,
red, green, and blue curves, plus eight selectable choices including no LUT.
The seven creative looks are generated 16³ LUTs, not film-stock emulations or
camera conversion LUTs. LUT strength blends the look before the curves, and
the existing depth transition is preserved. **Show original** bypasses grading.

Drag one of nine fixed input anchors or edit its 0–255 output with the keyboard.
The draft saves only in this browser. **Copy settings** copies versioned JSON
with the target asset, LUT, strength, and all four curves; paste it into chat to
request a permanent grade. The expandable settings field provides a manual-copy
fallback. The public hero currently uses **Warm film at 100%** with neutral curves, selected
from the studio. The shared grading runtime applies the same grade before the
depth transition; the StepNote splat is unchanged.
The studio UI and preview require an admin session and are served uncached.
The grading math and renderer modules are public dependencies of the hero.

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
node tests/admin-settings.test.cjs
node tests/splat-color.test.mjs
node tests/splat-reveal.test.mjs
node tests/splat-camera-intro.test.mjs
```
