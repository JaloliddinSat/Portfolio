# ASCII animation pause investigation

Tested on October 24, 2026 in the desktop in-app Chromium browser, 1280 × 720,
device pixel ratio 2, with a local Cloudflare Pages runtime and isolated admin
credentials. Public feature settings were never enabled for these tests.

## Findings

- The count stops at 240. Spawning is not unbounded.
- An initial 480.8-second recording captured 104 frame gaps over 80 ms, worst
  416.6 ms. At full capacity, the normal physics and drawing JavaScript averaged
  about 0.6 ms per frame. The browser reported long main-thread tasks for the
  pauses, often without script attribution.
- Startup also produced 100–375 ms tasks attributed to the Gaussian splat module.
  These are distinct from the recurring steady-state pauses.
- With physics and drawing paused, the steady-state control recorded no gaps
  over 80 ms. Physics alone at 240 particles also recorded none. Drawing static,
  nonrotating text while physics was paused recorded none.
- A cached-glyph renderer was tested with physics, rotation, and all 240 particles
  active. The measured steady-state window recorded no gaps over 80 ms.
- Switching only cached rendering off in the same loaded page, at scroll position
  2160, reproduced 13 gaps over 80 ms, worst 333.3 ms. Re-enabling the cache and
  clearing measurements again produced no gaps over 80 ms (worst observed
  33.5 ms). Neither splat renderer had update/render work in the recent windows.

The reversal test isolates the recurring pauses in this environment to the
animated `fillText` rendering path rather than physics or particle count. It does
not identify the browser's precise native subsystem (for example, rasterization,
font caching, or garbage collection); the browser did not attribute those tasks
to a specific JavaScript function. Results on other browsers/hardware still need
verification with the private diagnostic view.

## Change

Rasterize the glyph alphabet into a small bitmap atlas once, then rotate and
scale bitmap draws for each character. Rebuild the atlas when the font or theme
changes. Keep all 240 particles, collisions, random sizes, rotation, and pointer
interaction. This targets intermittent pauses, not a lower average JavaScript
cost: bitmap draws were slightly more expensive on average in this test, but
removed the reproduced stalls from the measured windows.

## Reproduction and monitoring

Sign in at `/admin/` and open **Open portfolio debug mode**. The authenticated
preview enables ASCII privately even if the public switch is off. Wait for the
splat loading to finish and the particle count to reach 240. Clear measurements,
then observe at a fixed scroll position. Compare cached glyph rendering on/off,
physics paused, glyph drawing hidden, and splat rendering paused independently.
Clear between comparisons and download the report after reproducing a pause.

Frame gaps, browser long tasks and long animation frames, script/forced-layout
attribution where supported, physics, drawing, geometry rebuilds, collision
counts, splat calls, heap size, lifecycle events, errors, and comparison flags are
captured locally in bounded buffers. The debug panel's own cost is reported.
Background-tab intervals are excluded. No telemetry is uploaded automatically;
GPU completion time is not measured. Feature-off visitors receive no diagnostic
assets or ASCII assets, and public settings are unchanged by private previews.
