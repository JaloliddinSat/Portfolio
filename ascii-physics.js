// Coordinates and velocities belong to the document; scrolling only moves the camera.
export function initAsciiPhysics() {
  const diagnostics = window.__portfolioDiagnostics;
  const canvas = document.querySelector('#ascii-curtain');
  const toggle = document.querySelector('#ascii-toggle');
  const content = document.querySelector('#site-content-transition');
  const context = canvas?.getContext('2d');
  if (!context || !toggle || !content) return;

  const desktop = matchMedia('(min-width: 701px) and (hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'ascii-physics-enabled';
  const glyphs = '#@%+=*:.{}[]<>/01';
  let savedConfig = {};
  try { savedConfig = JSON.parse(canvas.dataset.asciiConfig || '{}') || {}; } catch { /* Defaults remain usable. */ }
  const bounded = (key, fallback, min, max) => typeof savedConfig[key] === 'number' &&
    Number.isFinite(savedConfig[key]) && savedConfig[key] >= min && savedConfig[key] <= max ? savedConfig[key] : fallback;
  const rotationMultiplier = bounded('asciiRotationMultiplier', 1, 0, 4);
  const scaleMultiplier = bounded('asciiScaleMultiplier', 1, 0.25, 3);
  const spawnWidth = [20, 40, 60, 80, 100].includes(savedConfig.asciiSpawnWidth) ? savedConfig.asciiSpawnWidth : 100;
  const configuredLimit = bounded('asciiParticleLimit', 240, 0, 500);
  const cursorStrength = bounded('asciiCursorStrength', 0, 0, 3000);
  const cursorRadius = bounded('asciiCursorRadius', 300, 0, 2000);
  const cursorFalloff = bounded('asciiCursorFalloff', 2, 0.25, 6);
  const maxVelocity = bounded('asciiMaxVelocity', 600, 0, 600);
  const radiusSquared = cursorRadius * cursorRadius;
  const maxSpeedSquared = maxVelocity * maxVelocity;
  const clampVelocity = (particle) => {
    const speedSquared = particle.vx * particle.vx + particle.vy * particle.vy;
    if (speedSquared > maxSpeedSquared) {
      const ratio = maxVelocity / Math.sqrt(speedSquared);
      particle.vx *= ratio;
      particle.vy *= ratio;
    }
  };
  const baseHalf = 6;
  // Neighbor cells must cover the largest scaled, rotated collision box.
  const cellSize = Math.max(32, Math.ceil(baseHalf * 2 * 1.8 * scaleMultiplier * Math.SQRT2));
  const grabPadding = 22;
  const fullTurn = Math.PI * 2;
  const hitboxHalf = (particle) => baseHalf * particle.scale *
    (Math.abs(Math.cos(particle.angle)) + Math.abs(Math.sin(particle.angle)));
  const step = 1 / 120;
  const maxParticles = Number.isInteger(configuredLimit) ? configuredLimit : 240;
  if (diagnostics) diagnostics.flags.particleLimit = maxParticles;
  diagnostics?.state('asciiConfig', { rotationMultiplier, scaleMultiplier, spawnWidth, particleLimit: maxParticles, cursorStrength, cursorRadius, cursorFalloff, maxVelocity });
  const particles = [];
  const cells = new Map();
  const cellPool = [];
  let enabled = diagnostics ? true : !reducedMotion.matches;
  try {
    const saved = localStorage.getItem(storageKey);
    if (!diagnostics && saved !== null) enabled = saved === 'true';
  } catch { /* Storage is optional. */ }
  let activated = false;
  let width = 0;
  let height = 0;
  let spawnTop = 0;
  let worldBottom = 0;
  let obstacles = [];
  let frame = null;
  let lastTime = 0;
  let accumulator = 0;
  let spawnTime = 0;
  let geometryDirty = true;
  let drag = null;
  let pointer = null;
  let pointerTargetDirty = false;
  let hovering = false;
  let hoverElement = null;
  let revealFrame = null;
  let color = '#777';
  let geometryRebuilds = 0;
  let pairChecks = 0;
  let overlaps = 0;
  let maxBucket = 0;
  let visible = 0;
  let glyphAtlas = null;
  let atlasColor = '';
  const atlasRatio = Math.max(3, Math.ceil(3 * scaleMultiplier));
  const atlasCell = 32;

  const prepareGlyphAtlas = () => {
    if (glyphAtlas && atlasColor === color) return true;
    const started = diagnostics ? performance.now() : 0;
    glyphAtlas = document.createElement('canvas');
    glyphAtlas.width = glyphs.length * atlasCell * atlasRatio;
    glyphAtlas.height = atlasCell * atlasRatio;
    const atlasContext = glyphAtlas.getContext('2d');
    if (!atlasContext) { glyphAtlas = null; return false; }
    atlasContext.setTransform(atlasRatio, 0, 0, atlasRatio, 0, 0);
    atlasContext.font = '12px "JetBrains Mono", monospace';
    atlasContext.textAlign = 'center';
    atlasContext.textBaseline = 'middle';
    atlasContext.fillStyle = color;
    [...glyphs].forEach((glyph, index) => atlasContext.fillText(glyph, index * atlasCell + atlasCell / 2, atlasCell / 2));
    atlasColor = color;
    diagnostics?.sample('ascii.atlasBuild', started);
    return true;
  };

  const release = () => {
    if (!drag) return;
    if (performance.now() - drag.time > 100) {
      drag.particle.vx = 0;
      drag.particle.vy = 0;
    }
    const pointerId = drag.id;
    drag = null;
    if (document.documentElement.hasPointerCapture(pointerId)) {
      document.documentElement.releasePointerCapture(pointerId);
    }
    document.documentElement.classList.remove('ascii-dragging');
    pointerTargetDirty = true;
    updateHover();
  };

  const measure = () => {
    const measureStart = diagnostics ? performance.now() : 0;
    geometryRebuilds += 1;
    geometryDirty = false;
    width = innerWidth;
    height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const bitmapWidth = Math.round(width * ratio);
    const bitmapHeight = Math.round(height * ratio);
    if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
    if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.font = '12px "JetBrains Mono", monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    spawnTop = content.getBoundingClientRect().top + scrollY;
    worldBottom = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    // Whole cards are solid; standalone text uses individual line rectangles.
    const elements = content.querySelectorAll('.resume-item, .section-title, .subsection-title, h2, h3, p, li, img, video, .stepnote-splat-stage');
    obstacles = [];
    for (const element of elements) {
      if (element.parentElement.closest('.resume-item')) continue;
      if (!element.getClientRects().length) continue;
      let rects;
      if (element.matches('p, h2, h3, li') && !element.matches('.resume-item')) {
        const range = document.createRange();
        range.selectNodeContents(element);
        rects = range.getClientRects();
      } else {
        rects = [element.getBoundingClientRect()];
      }
      for (const rect of rects) {
        if (rect.width < 1 || rect.height < 1) continue;
        obstacles.push({ left: rect.left + scrollX, right: rect.right + scrollX,
          top: rect.top + scrollY - spawnTop, bottom: rect.bottom + scrollY - spawnTop });
      }
    }
    color = document.documentElement.dataset.theme === 'light' ? '#888' : '#777';
    diagnostics?.sample('ascii.geometry', measureStart);
  };

  const spawn = () => {
    const scale = (1 + Math.random() * 0.8) * scaleMultiplier;
    const angle = Math.random() * fullTurn;
    // Preserve the randomized 5–45 degrees/second base spin, then apply the admin multiplier.
    const angularVelocity = (5 + Math.random() * 40) * Math.PI / 180 *
      (Math.random() < 0.5 ? -1 : 1) * rotationMultiplier;
    const particle = { scale, angle, angularVelocity,
      y: 0, vx: (Math.random() - 0.5) * 90, vy: 65 + Math.random() * 95,
      glyph: glyphs[Math.floor(Math.random() * glyphs.length)] };
    const half = hitboxHalf(particle);
    particle.y = spawnTop + half + 1;
    if (spawnWidth === 100) {
      particle.x = half + Math.random() * Math.max(0, width - half * 2);
    } else {
      // Split the allowed width equally between the two outer edges.
      const edgeWidth = width * spawnWidth / 200;
      const offset = half + Math.random() * Math.max(0, edgeWidth - half * 2);
      particle.x = Math.random() < 0.5 ? offset : width - offset;
    }
    clampVelocity(particle);
    particles.push(particle);
  };

  const simulate = () => {
    // Convert the viewport pointer to document coordinates once per step.
    // With strength/radius zero, skip all cursor distance and falloff work.
    const cursorX = pointer ? pointer.clientX + scrollX : 0;
    const cursorY = pointer ? pointer.clientY + scrollY : 0;
    const forceActive = cursorStrength > 0 && cursorRadius > 0 && pointer &&
      pointer.clientX >= 0 && pointer.clientX <= width &&
      pointer.clientY >= 0 && pointer.clientY <= height && cursorY >= spawnTop &&
      desktop.matches && enabled && activated && !document.hidden && !canvas.hidden;
    const forceSign = document.documentElement.dataset.theme === 'light' ? -1 : 1;
    spawnTime += step;
    while (particles.length < (diagnostics?.flags.particleLimit ?? maxParticles) && spawnTime >= 1 / 12) {
      spawnTime -= 1 / 12;
      spawn();
    }
    if (particles.length >= (diagnostics?.flags.particleLimit ?? maxParticles)) spawnTime = 0;
    for (const particle of particles) {
      particle.angle = (particle.angle + particle.angularVelocity * step) % fullTurn;
      if (drag?.particle === particle) continue;
      if (forceActive) {
        const dx = cursorX - particle.x;
        const dy = cursorY - particle.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < radiusSquared && distanceSquared > 0) {
          const distance = Math.sqrt(distanceSquared);
          // Soft core avoids a singularity or an arbitrary kick at the exact center.
          const impulse = forceSign * cursorStrength * Math.pow(1 - distance / cursorRadius, cursorFalloff) *
            step / Math.max(24, distance);
          particle.vx += dx * impulse;
          particle.vy += dy * impulse;
        }
      }
      clampVelocity(particle);
      const half = hitboxHalf(particle);
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      if (particle.x < half) { particle.x = half; particle.vx = Math.abs(particle.vx); }
      if (particle.x > width - half) { particle.x = width - half; particle.vx = -Math.abs(particle.vx); }
      if (particle.y < spawnTop + half) { particle.y = spawnTop + half; particle.vy = Math.abs(particle.vy); }
      if (particle.y > worldBottom - half) { particle.y = worldBottom - half; particle.vy = -Math.abs(particle.vy); }
      for (const obstacle of obstacles) {
        const left = obstacle.left - half;
        const right = obstacle.right + half;
        const top = spawnTop + obstacle.top - half;
        const bottom = spawnTop + obstacle.bottom + half;
        if (particle.x <= left || particle.x >= right || particle.y <= top || particle.y >= bottom) continue;
        const distances = [particle.x - left, right - particle.x, particle.y - top, bottom - particle.y];
        const side = distances.indexOf(Math.min(...distances));
        if (side === 0) { particle.x = left; particle.vx = -Math.abs(particle.vx); }
        if (side === 1) { particle.x = right; particle.vx = Math.abs(particle.vx); }
        if (side === 2) { particle.y = top; particle.vy = -Math.abs(particle.vy); }
        if (side === 3) { particle.y = bottom; particle.vy = Math.abs(particle.vy); }
      }
    }
    // A spatial hash keeps glyph-to-glyph collisions local, including off-screen.
    if (diagnostics?.flags.glyphCollisions === false) return;
    cells.clear();
    let usedCells = 0;
    const columns = Math.ceil(width / cellSize) + 2;
    for (const particle of particles) {
      particle.collisionHalf = hitboxHalf(particle);
    }
    for (const particle of particles) {
      const cx = Math.floor(particle.x / cellSize);
      const cy = Math.floor(particle.y / cellSize);
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let y = cy - 1; y <= cy + 1; y++) {
          const neighbors = cells.get(y * columns + x);
          if (!neighbors) continue;
          for (const other of neighbors) {
            if (diagnostics) pairChecks += 1;
            if (drag?.particle === particle || drag?.particle === other) continue;
            const dx = particle.x - other.x;
            const dy = particle.y - other.y;
            const combinedHalf = particle.collisionHalf + other.collisionHalf;
            const overlapX = combinedHalf - Math.abs(dx);
            const overlapY = combinedHalf - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) continue;
            if (diagnostics) overlaps += 1;
            const axis = overlapX < overlapY ? 'x' : 'y';
            const velocity = axis === 'x' ? 'vx' : 'vy';
            const direction = (axis === 'x' ? dx : dy) >= 0 ? 1 : -1;
            const separation = (axis === 'x' ? overlapX : overlapY) / 2 + 0.01;
            particle[axis] += direction * separation;
            other[axis] -= direction * separation;
            if ((particle[velocity] - other[velocity]) * direction < 0) {
              [particle[velocity], other[velocity]] = [other[velocity], particle[velocity]];
            }
          }
        }
      }
      const key = cy * columns + cx;
      let bucket = cells.get(key);
      if (!bucket) {
        bucket = cellPool[usedCells] || (cellPool[usedCells] = []);
        usedCells += 1;
        bucket.length = 0;
        cells.set(key, bucket);
      }
      bucket.push(particle);
      if (diagnostics) maxBucket = Math.max(maxBucket, bucket.length);
    }
    // Axis exchanges can combine two velocities into a faster diagonal.
    for (const particle of particles) clampVelocity(particle);
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);
    visible = 0;
    if (!activated || diagnostics?.flags.drawingPaused) return;
    context.save();
    context.beginPath();
    context.rect(0, Math.max(0, spawnTop - scrollY), width, height);
    context.clip();
    context.fillStyle = color;
    const useAtlas = (diagnostics?.flags.cachedGlyphs ?? true) && prepareGlyphAtlas();
    for (const particle of particles) {
      const half = hitboxHalf(particle);
      const x = particle.x - scrollX;
      const y = particle.y - scrollY;
      if (x < -half || x > width + half || y < -half || y > height + half) continue;
      visible += 1;
      context.save();
      context.translate(x, y);
      context.rotate(particle.angle);
      context.scale(particle.scale, particle.scale);
      if (useAtlas) {
        const sourceCell = atlasCell * atlasRatio;
        context.drawImage(glyphAtlas, glyphs.indexOf(particle.glyph) * sourceCell, 0, sourceCell, sourceCell,
          -atlasCell / 2, -atlasCell / 2, atlasCell, atlasCell);
      } else {
        context.fillText(particle.glyph, 0, 0);
      }
      context.restore();
    }
    context.restore();
  };

  const tick = (time) => {
    frame = null;
    const frameStart = diagnostics ? performance.now() : 0;
    pairChecks = overlaps = maxBucket = 0;
    if (diagnostics && particles.length > diagnostics.flags.particleLimit) particles.length = diagnostics.flags.particleLimit;
    if (geometryDirty) measure();
    const physicsStart = diagnostics ? performance.now() : 0;
    // Fixed small steps prevent fast throws tunneling through thin obstacles.
    // Carry dropped-frame time forward instead of discarding it. Limit work per
    // frame so catching up cannot monopolize the main thread.
    accumulator = Math.min(0.5, accumulator + (time - (lastTime || time)) / 1000);
    lastTime = time;
    let steps = 0;
    if (diagnostics?.flags.physicsPaused) accumulator = 0;
    while (accumulator >= step && steps < 12) {
      simulate();
      accumulator -= step;
      steps += 1;
    }
    diagnostics?.sample('ascii.physics', physicsStart, { steps, pairChecks, overlaps });
    const drawStart = diagnostics ? performance.now() : 0;
    draw();
    updateHover();
    diagnostics?.sample('ascii.draw', drawStart);
    diagnostics?.sample('ascii.frame', frameStart);
    diagnostics?.state('ascii', { particles: particles.length, limit: diagnostics.flags.particleLimit, rotationMultiplier, scaleMultiplier, spawnWidth, visible, steps, pairChecks, overlaps, maxBucket,
      backlogMs: Math.round(accumulator * 1000), obstacles: obstacles.length, geometryRebuilds });
    frame = requestAnimationFrame(tick);
  };

  const sync = () => {
    toggle.hidden = !desktop.matches;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.title = enabled ? 'Turn off floating ASCII' : 'Turn on floating ASCII';
    toggle.setAttribute('aria-label', toggle.title);
    const shouldRun = desktop.matches && enabled && activated && !document.hidden;
    canvas.hidden = !shouldRun;
    if (shouldRun && frame === null) {
      lastTime = 0;
      accumulator = 0;
      frame = requestAnimationFrame(tick);
      diagnostics?.event('ascii-start', { activated, enabled });
    } else if (!shouldRun) {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        diagnostics?.event('ascii-stop', { enabled, activated, hidden: document.hidden, desktop: desktop.matches });
      }
      frame = null;
      release();
      setHover(false);
      context.clearRect(0, 0, width, height);
    }
  };

  const checkReveal = () => {
    // The content reaches the top only once the hero is fully covered.
    // Activation is permanent for this visit, including when scrolling back up.
    const contentTop = content.getBoundingClientRect().top;
    spawnTop = contentTop + scrollY;
    if (!activated && contentTop <= 1) {
      activated = true;
      geometryDirty = true;
    }
    sync();
  };

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    try { if (!diagnostics) localStorage.setItem(storageKey, String(enabled)); } catch { /* Optional. */ }
    checkReveal();
  });
  const canGrabTarget = (target) => desktop.matches && enabled && activated && !document.hidden &&
    target && !target.closest('#portfolio-debug-panel, a, button, input, textarea, select, [contenteditable="true"]');
  const pickParticle = (clientX, clientY) => {
    if (clientX < 0 || clientX > width || clientY < 0 || clientY > height || clientY + scrollY < spawnTop) return null;
    const x = clientX + scrollX;
    const y = clientY + scrollY;
    let particle = null;
    let nearestDistance = Infinity;
    for (const candidate of particles) {
      const reach = hitboxHalf(candidate) + grabPadding;
      const distance = (candidate.x - x) ** 2 + (candidate.y - y) ** 2;
      if (distance <= reach * reach && distance < nearestDistance) {
        particle = candidate;
        nearestDistance = distance;
      }
    }
    return particle;
  };
  const setHover = (active) => {
    const nextElement = active ? pointer?.target : null;
    if (hovering === active && hoverElement === nextElement) return;
    hoverElement?.classList?.remove('ascii-grabbable');
    hoverElement = nextElement;
    hoverElement?.classList?.add('ascii-grabbable');
    hovering = active;
    document.documentElement.classList.toggle('ascii-hovering', active);
  };
  const updateHover = () => {
    if (!pointer || drag || !desktop.matches || !enabled || !activated || document.hidden || canvas.hidden) {
      setHover(false);
      return;
    }
    const particle = pickParticle(pointer.clientX, pointer.clientY);
    if (particle && pointerTargetDirty) {
      pointer.target = document.elementFromPoint(pointer.clientX, pointer.clientY);
      pointerTargetDirty = false;
    }
    setHover(Boolean(particle && canGrabTarget(pointer.target)));
  };
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') { pointer = null; setHover(false); return; }
    pointer = { clientX: event.clientX, clientY: event.clientY, target: event.target };
    pointerTargetDirty = false;
    updateHover();
    if (event.button !== 0 || !canGrabTarget(event.target)) return;
    const particle = pickParticle(event.clientX, event.clientY);
    if (!particle) return;
    const x = event.clientX + scrollX;
    const y = event.clientY + scrollY;
    setHover(false);
    drag = { particle, id: event.pointerId, offsetX: particle.x - x, offsetY: particle.y - y, time: performance.now(), clientX: event.clientX, clientY: event.clientY };
    particle.vx = particle.vy = 0;
    document.documentElement.setPointerCapture(event.pointerId);
    document.documentElement.classList.add('ascii-dragging');
    event.preventDefault();
    event.stopPropagation();
  }, true);
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') { pointer = null; setHover(false); return; }
    pointer = { clientX: event.clientX, clientY: event.clientY, target: event.target || pointer?.target };
    pointerTargetDirty = false;
    if (!drag) { updateHover(); return; }
    if (drag.id !== event.pointerId) return;
    const time = performance.now();
    const elapsed = Math.max(0.008, (time - drag.time) / 1000);
    // Only mouse motion contributes throw velocity, never scroll displacement.
    drag.particle.vx = Math.max(-600, Math.min(600, (event.clientX - drag.clientX) / elapsed));
    drag.particle.vy = Math.max(-600, Math.min(600, (event.clientY - drag.clientY) / elapsed));
    clampVelocity(drag.particle);
    const half = hitboxHalf(drag.particle);
    drag.particle.x = Math.max(half, Math.min(width - half, event.clientX + scrollX + drag.offsetX));
    drag.particle.y = Math.max(spawnTop + half, Math.min(worldBottom - half, event.clientY + scrollY + drag.offsetY));
    Object.assign(drag, { clientX: event.clientX, clientY: event.clientY, time });
  });
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  document.documentElement.addEventListener('lostpointercapture', release);
  window.addEventListener('blur', () => { release(); pointer = null; setHover(false); });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; setHover(false); });
  window.addEventListener('scroll', () => {
    pointerTargetDirty = true;
    if (revealFrame !== null) return;
    revealFrame = requestAnimationFrame(() => {
      revealFrame = null;
      checkReveal();
    });
  }, { passive: true });
  window.addEventListener('resize', () => { pointerTargetDirty = true; geometryDirty = true; checkReveal(); });
  window.addEventListener('load', () => { geometryDirty = true; checkReveal(); });
  document.addEventListener('visibilitychange', sync);
  desktop.addEventListener('change', () => { geometryDirty = true; checkReveal(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) enabled = false; sync(); });
  new ResizeObserver(() => { geometryDirty = true; }).observe(content);
  new MutationObserver(() => {
    color = document.documentElement.dataset.theme === 'light' ? '#888' : '#777';
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.fonts?.ready.then(() => { geometryDirty = true; glyphAtlas = null; });
  document.addEventListener('portfolio:hero-frame', checkReveal);
  checkReveal();
}

initAsciiPhysics();
