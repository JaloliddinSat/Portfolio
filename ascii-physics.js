// Coordinates and velocities belong to the document; scrolling only moves the camera.
export function initAsciiPhysics() {
  const canvas = document.querySelector('#ascii-curtain');
  const toggle = document.querySelector('#ascii-toggle');
  const content = document.querySelector('#site-content-transition');
  const context = canvas?.getContext('2d');
  if (!context || !toggle || !content) return;

  const desktop = matchMedia('(min-width: 701px) and (hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'ascii-physics-enabled';
  const glyphs = '#@%+=*:.{}[]<>/01';
  const baseHalf = 6;
  const cellSize = 32;
  const grabPadding = 22;
  const fullTurn = Math.PI * 2;
  const hitboxHalf = (particle) => baseHalf * particle.scale *
    (Math.abs(Math.cos(particle.angle)) + Math.abs(Math.sin(particle.angle)));
  const step = 1 / 120;
  const maxParticles = 240;
  const particles = [];
  let enabled = !reducedMotion.matches;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) enabled = saved === 'true';
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
  let revealFrame = null;
  let color = '#777';

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
  };

  const measure = () => {
    geometryDirty = false;
    width = innerWidth;
    height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
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
          top: rect.top + scrollY, bottom: rect.bottom + scrollY });
      }
    }
    color = document.documentElement.dataset.theme === 'light' ? '#888' : '#777';
  };

  const spawn = () => {
    const scale = 1 + Math.random() * 0.8;
    const angle = Math.random() * fullTurn;
    // Each glyph keeps its own direction and a gentle 5–45 degrees/second spin.
    const angularVelocity = (5 + Math.random() * 40) * Math.PI / 180 *
      (Math.random() < 0.5 ? -1 : 1);
    const particle = { scale, angle, angularVelocity,
      y: spawnTop - 24, vx: (Math.random() - 0.5) * 90, vy: 65 + Math.random() * 95,
      glyph: glyphs[Math.floor(Math.random() * glyphs.length)] };
    const half = hitboxHalf(particle);
    particle.x = half + Math.random() * Math.max(1, width - half * 2);
    particles.push(particle);
  };

  const simulate = () => {
    spawnTime += step;
    while (particles.length < maxParticles && spawnTime >= 1 / 12) {
      spawnTime -= 1 / 12;
      spawn();
    }
    if (particles.length === maxParticles) spawnTime = 0;
    for (const particle of particles) {
      particle.angle = (particle.angle + particle.angularVelocity * step) % fullTurn;
      if (drag?.particle === particle) continue;
      const half = hitboxHalf(particle);
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      if (particle.x < half) { particle.x = half; particle.vx = Math.abs(particle.vx); }
      if (particle.x > width - half) { particle.x = width - half; particle.vx = -Math.abs(particle.vx); }
      if (particle.y < half) { particle.y = half; particle.vy = Math.abs(particle.vy); }
      if (particle.y > worldBottom - half) { particle.y = worldBottom - half; particle.vy = -Math.abs(particle.vy); }
      for (const obstacle of obstacles) {
        const left = obstacle.left - half;
        const right = obstacle.right + half;
        const top = obstacle.top - half;
        const bottom = obstacle.bottom + half;
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
    const cells = new Map();
    for (const particle of particles) {
      const cx = Math.floor(particle.x / cellSize);
      const cy = Math.floor(particle.y / cellSize);
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let y = cy - 1; y <= cy + 1; y++) {
          for (const other of cells.get(`${x},${y}`) || []) {
            if (drag?.particle === particle || drag?.particle === other) continue;
            const dx = particle.x - other.x;
            const dy = particle.y - other.y;
            const combinedHalf = hitboxHalf(particle) + hitboxHalf(other);
            const overlapX = combinedHalf - Math.abs(dx);
            const overlapY = combinedHalf - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) continue;
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
      const key = `${cx},${cy}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(particle);
    }
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);
    if (!activated) return;
    context.fillStyle = color;
    for (const particle of particles) {
      const half = hitboxHalf(particle);
      const x = particle.x - scrollX;
      const y = particle.y - scrollY;
      if (x < -half || x > width + half || y < -half || y > height + half) continue;
      context.save();
      context.translate(x, y);
      context.rotate(particle.angle);
      context.scale(particle.scale, particle.scale);
      context.fillText(particle.glyph, 0, 0);
      context.restore();
    }
  };

  const tick = (time) => {
    frame = null;
    if (geometryDirty) measure();
    // Fixed small steps prevent fast throws tunneling through thin obstacles.
    accumulator += Math.min((time - (lastTime || time)) / 1000, 0.06);
    lastTime = time;
    while (accumulator >= step) { simulate(); accumulator -= step; }
    draw();
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
    } else if (!shouldRun) {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      release();
      context.clearRect(0, 0, width, height);
    }
  };

  const checkReveal = () => {
    // The content reaches the top only once the hero is fully covered.
    // Activation is permanent for this visit, including when scrolling back up.
    if (!activated && content.getBoundingClientRect().top <= 1) {
      activated = true;
      geometryDirty = true;
    }
    sync();
  };

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(storageKey, String(enabled)); } catch { /* Optional. */ }
    checkReveal();
  });
  const canGrab = (event) => desktop.matches && enabled && activated &&
    !event.target.closest('a, button, input, textarea, select, [contenteditable="true"]');
  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !canGrab(event)) return;
    const x = event.clientX + scrollX;
    const y = event.clientY + scrollY;
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
    if (!particle) return;
    drag = { particle, id: event.pointerId, offsetX: particle.x - x, offsetY: particle.y - y, time: performance.now(), clientX: event.clientX, clientY: event.clientY };
    particle.vx = particle.vy = 0;
    document.documentElement.setPointerCapture(event.pointerId);
    document.documentElement.classList.add('ascii-dragging');
    event.preventDefault();
    event.stopPropagation();
  }, true);
  document.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const time = performance.now();
    const elapsed = Math.max(0.008, (time - drag.time) / 1000);
    // Only mouse motion contributes throw velocity, never scroll displacement.
    drag.particle.vx = Math.max(-600, Math.min(600, (event.clientX - drag.clientX) / elapsed));
    drag.particle.vy = Math.max(-600, Math.min(600, (event.clientY - drag.clientY) / elapsed));
    const half = hitboxHalf(drag.particle);
    drag.particle.x = Math.max(half, Math.min(width - half, event.clientX + scrollX + drag.offsetX));
    drag.particle.y = Math.max(half, Math.min(worldBottom - half, event.clientY + scrollY + drag.offsetY));
    Object.assign(drag, { clientX: event.clientX, clientY: event.clientY, time });
  });
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  document.documentElement.addEventListener('lostpointercapture', release);
  window.addEventListener('blur', release);
  window.addEventListener('scroll', () => {
    if (revealFrame !== null) return;
    revealFrame = requestAnimationFrame(() => {
      revealFrame = null;
      checkReveal();
    });
  }, { passive: true });
  window.addEventListener('resize', () => { geometryDirty = true; checkReveal(); });
  window.addEventListener('load', () => { geometryDirty = true; checkReveal(); });
  document.addEventListener('visibilitychange', sync);
  desktop.addEventListener('change', () => { geometryDirty = true; checkReveal(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) enabled = false; sync(); });
  new ResizeObserver(() => { geometryDirty = true; }).observe(content);
  new MutationObserver(() => {
    color = document.documentElement.dataset.theme === 'light' ? '#888' : '#777';
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.fonts?.ready.then(() => { geometryDirty = true; });
  checkReveal();
}
