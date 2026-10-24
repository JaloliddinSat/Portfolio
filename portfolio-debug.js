(() => {
  const frames = [];
  const spans = [];
  const events = [];
  const state = {};
  const viewers = new Map();
  const registeredViewers = new WeakSet();
  const flags = { physicsPaused: false, drawingPaused: false, splatsPaused: false, glyphCollisions: true, cachedGlyphs: true, particleLimit: 240 };
  const capabilities = { longtask: false, longAnimationFrame: false };
  let previousFrame = 0;
  let lastPaint = 0;
  let panel;
  let snapshotText;
  let eventText;
  let graph;
  let frameGaps = 0;
  let maxGap = 0;
  let totalFrames = 0;
  let recording = true;
  let captureStart = performance.now();

  const append = (list, value, limit) => {
    list.push(value);
    if (list.length > limit) list.splice(0, Math.max(list.length - limit, Math.floor(limit / 10)));
  };
  const recordEvent = (type, details = {}, start = performance.now()) => {
    if (recording) append(events, { type, start, ...details }, 200);
  };
  const sample = (name, start, details) => {
    if (!recording) return;
    append(spans, { name, start, duration: performance.now() - start, ...details }, 3000);
  };
  const observe = (type, callback) => {
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return false;
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) callback(entry);
      }).observe({ type, buffered: true });
      return true;
    } catch { return false; }
  };
  if (typeof PerformanceObserver !== 'undefined') {
    capabilities.longtask = observe('longtask', entry => recordEvent('long-task', {
      duration: entry.duration,
      attribution: [...(entry.attribution || [])].map(item => ({ name: item.name, containerType: item.containerType })),
    }, entry.startTime));
    capabilities.longAnimationFrame = observe('long-animation-frame', entry => recordEvent('long-animation-frame', {
      duration: entry.duration, blockingDuration: entry.blockingDuration,
      scripts: [...(entry.scripts || [])].map(script => ({
        source: script.sourceURL?.split('/').pop(), function: script.sourceFunctionName,
        duration: script.duration, forcedLayout: script.forcedStyleAndLayoutDuration,
      })),
    }, entry.startTime));
  }
  const percentile = (values, fraction) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
  };
  const round = value => Math.round(value * 100) / 100;
  const snapshot = () => {
    const now = performance.now();
    const recent = frames.filter(frame => frame.start > now - 10000);
    const timings = {};
    for (const name of new Set(spans.map(span => span.name))) {
      const matching = spans.filter(span => span.name === name && span.start > now - 10000);
      if (!matching.length) continue;
      const durations = matching.map(span => span.duration);
      timings[name] = { calls: matching.length, mean: round(durations.reduce((a, b) => a + b, 0) / durations.length), p95: round(percentile(durations, 0.95)), max: round(Math.max(...durations)) };
    }
    const viewerState = {};
    for (const [name, viewer] of viewers) {
      viewerState[name] = { running: viewer.running, sortRunning: viewer.sortRunning,
        renderedSplats: viewer.splatRenderCount, totalSplats: viewer.getSplatMesh?.()?.getSplatCount?.(),
        sortCount: viewer.splatSortCount, pixelRatio: viewer.devicePixelRatio };
    }
    return {
      version: 1, captureDurationMs: round(now - captureStart), capturedAt: new Date().toISOString(), elapsed: round(now), recording,
      browser: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      visibility: document.visibilityState, scrollY: round(scrollY), flags: { ...flags }, capabilities,
      frames: { total: totalFrames, gapsOver80ms: frameGaps, maxGap: round(maxGap),
        median: round(percentile(recent.map(frame => frame.gap), 0.5)),
        p95: round(percentile(recent.map(frame => frame.gap), 0.95)) },
      timings, state: { ...state }, viewers: viewerState,
      videos: [...document.querySelectorAll('video')].map(video => ({ id: video.id, paused: video.paused, readyState: video.readyState, currentTime: round(video.currentTime) })),
      memory: performance.memory ? { usedMB: round(performance.memory.usedJSHeapSize / 1048576), totalMB: round(performance.memory.totalJSHeapSize / 1048576) } : null,
      events: [...events], recentSpans: [...spans], recentFrames: [...frames],
    };
  };
  window.__portfolioDiagnostics = {
    flags, sample, event: recordEvent, state: (name, value) => { state[name] = value; },
    registerViewer(name, viewer) {
      if (registeredViewers.has(viewer)) return;
      registeredViewers.add(viewer);
      viewers.set(name, viewer);
      for (const method of ['update', 'render']) {
        const original = viewer[method];
        if (typeof original !== 'function') continue;
        viewer[method] = function (...args) {
          if (flags.splatsPaused) return;
          const start = performance.now();
          try { return original.apply(this, args); }
          finally { sample(`${name}.${method}`, start, { sorting: Boolean(viewer.sortRunning) }); }
        };
      }
      const canvas = (viewer.renderer || viewer.threeRenderer)?.domElement;
      canvas?.addEventListener('webglcontextlost', () => recordEvent('webgl-context-lost', { viewer: name }));
      canvas?.addEventListener('webglcontextrestored', () => recordEvent('webgl-context-restored', { viewer: name }));
    },
  };

  const describeGap = gap => {
    const start = gap.start - gap.duration;
    const blocking = events.filter(event => ['long-task', 'long-animation-frame'].includes(event.type) && event.start < gap.start && event.start + event.duration > start);
    const work = spans.filter(span => span.start < gap.start && span.start + span.duration > start).sort((a, b) => b.duration - a.duration);
    if (blocking.length) {
      const scripts = blocking.flatMap(event => event.scripts || []).sort((a, b) => b.duration - a.duration);
      return scripts.length ? `${scripts[0].source || 'script'} / ${scripts[0].function || 'anonymous'} (${round(scripts[0].duration)}ms)` : `Browser long task (${round(Math.max(...blocking.map(event => event.duration)))}ms)`;
    }
    if (work[0]?.duration > 15) return `${work[0].name} (${round(work[0].duration)}ms)`;
    return 'No matching JS blocker captured; inspect rendering/GPU or browser scheduling.';
  };
  const paint = () => {
    if (!panel) return;
    const report = snapshot();
    const limitInput = panel.querySelector('[data-limit]');
    if (document.activeElement !== limitInput) limitInput.value = flags.particleLimit;
    const timingLines = Object.entries(report.timings).map(([name, timing]) => `${name.padEnd(23)} avg ${timing.mean.toFixed(2).padStart(6)}  p95 ${timing.p95.toFixed(2).padStart(6)}  max ${timing.max.toFixed(2).padStart(7)} ms`);
    snapshotText.textContent = [
      `${recording ? 'RECORDING' : 'PAUSED'} · ${document.visibilityState} · scroll ${report.scrollY}`,
      `Capture ${(report.captureDurationMs / 1000).toFixed(1)}s · frames ${totalFrames} · median ${report.frames.median ? Math.round(1000 / report.frames.median) : '--'} FPS`,
      `Frame gaps: median ${report.frames.median}ms · p95 ${report.frames.p95}ms`,
      `Stalls >80ms: ${frameGaps} · worst ${round(maxGap)}ms`,
      `ASCII: ${state.ascii?.particles ?? 0}/${state.ascii?.limit ?? flags.particleLimit} · visible ${state.ascii?.visible ?? 0} · steps ${state.ascii?.steps ?? 0} · backlog ${state.ascii?.backlogMs ?? 0}ms`,
      `Saved tuning: rotation ${state.asciiConfig?.rotationMultiplier ?? 1}× · scale ${state.asciiConfig?.scaleMultiplier ?? 1}× · edge spawn ${state.asciiConfig?.spawnWidth ?? 100}%`,
      `Cursor: strength ${state.asciiConfig?.cursorStrength ?? 0}px/s² · radius ${state.asciiConfig?.cursorRadius ?? 300}px · falloff ${state.asciiConfig?.cursorFalloff ?? 2} · max ${state.asciiConfig?.maxVelocity ?? 600}px/s`,
      `Cursor idle: ${state.ascii?.cursorIdle ? 'yes' : 'no'} · timeout ${state.asciiConfig?.cursorIdleTimeout ?? 2}s (dark theme only)`,
      `Pass-through: release ${state.asciiConfig?.releaseDistance ?? 40}px · cooldown ${state.asciiConfig?.cursorCooldown ?? 1}s · nudge ${state.asciiConfig?.escapeNudge ?? 100}px/s`,
      `Pair checks ${state.ascii?.pairChecks ?? 0} · overlaps ${state.ascii?.overlaps ?? 0} · bucket max ${state.ascii?.maxBucket ?? 0}`,
      `Obstacles ${state.ascii?.obstacles ?? 0} · geometry rebuilds ${state.ascii?.geometryRebuilds ?? 0}`,
      `Observers: long tasks ${capabilities.longtask ? 'yes' : 'unavailable'} · script attribution ${capabilities.longAnimationFrame ? 'yes' : 'unavailable'}`,
      ...(report.memory ? [`JS heap: ${report.memory.usedMB}MB / ${report.memory.totalMB}MB`] : []),
      '', ...timingLines,
      '', ...Object.entries(report.viewers).map(([name, value]) => `${name}: running ${Boolean(value.running)} · sorting ${Boolean(value.sortRunning)} · splats ${value.renderedSplats ?? 0}/${value.totalSplats ?? 0}`),
    ].join('\n');
    eventText.textContent = events.filter(event => event.type === 'frame-gap').slice(-8).reverse().map(event => `${(event.start / 1000).toFixed(1)}s · ${round(event.duration)}ms gap\n  ${describeGap(event)}`).join('\n') || 'No stalls recorded yet.';
    const ctx = graph.getContext('2d');
    ctx.clearRect(0, 0, graph.width, graph.height);
    ctx.strokeStyle = '#59606b';
    ctx.beginPath(); ctx.moveTo(0, 63); ctx.lineTo(graph.width, 63); ctx.stroke();
    const history = frames.slice(-180);
    history.forEach((frame, index) => {
      ctx.fillStyle = frame.gap > 80 ? '#ff8383' : frame.gap > 25 ? '#edc16d' : '#83d9b1';
      ctx.fillRect(index * 2, 80 - Math.min(80, frame.gap), 1.5, Math.min(80, frame.gap));
    });
  };
  const frameLoop = now => {
    if (recording && !document.hidden && previousFrame) {
      const gap = now - previousFrame;
      append(frames, { start: now, gap }, 3600);
      totalFrames += 1;
      maxGap = Math.max(maxGap, gap);
      if (gap > 80) { frameGaps += 1; recordEvent('frame-gap', { duration: gap, flags: { ...flags }, ascii: { ...state.ascii }, heapUsedMB: performance.memory ? round(performance.memory.usedJSHeapSize / 1048576) : null }, now); }
    }
    previousFrame = now;
    if (now - lastPaint > 500) {
      const start = performance.now();
      paint(); sample('debug.panel', start);
      lastPaint = now;
    }
    requestAnimationFrame(frameLoop);
  };
  const start = () => {
    panel = document.createElement('aside');
    panel.id = 'portfolio-debug-panel';
    panel.setAttribute('aria-label', 'Private portfolio performance diagnostics');
    panel.innerHTML = `<details open><summary>Portfolio performance · admin only</summary>
      <p>Private ASCII preview. Public settings are unchanged. Capture a pause, then disable one workload at a time to compare.</p>
      <canvas width="360" height="80" aria-label="Recent frame gaps: green under 25ms, amber over 25ms, red over 80ms"></canvas>
      <div class="debug-controls">
        <label><input type="checkbox" data-flag="physicsPaused"> Pause physics</label>
        <label><input type="checkbox" data-flag="drawingPaused"> Hide glyph drawing</label>
        <label><input type="checkbox" data-flag="splatsPaused"> Pause splat rendering</label>
        <label><input type="checkbox" data-flag="glyphCollisions" checked> Glyph collisions</label>
        <label><input type="checkbox" data-flag="cachedGlyphs" checked> Cached glyph rendering</label>
        <label>Particle cap <input type="number" data-limit min="0" max="500" step="1" value="${flags.particleLimit}"></label>
      </div>
      <div class="debug-buttons"><button data-record>Pause recording</button><button data-clear>Clear measurements</button><button data-export>Download report</button></div>
      <pre id="portfolio-debug-summary"></pre>
      <details open><summary>Recent pauses and correlated work</summary><pre id="portfolio-debug-events"></pre></details>
      <p>Timings measure JavaScript work, not GPU completion. Background-tab pauses are excluded. Reports stay in this browser unless you download and share them.</p>
      <a href="/admin/">Back to admin</a></details>`;
    document.body.append(panel);
    snapshotText = panel.querySelector('#portfolio-debug-summary');
    eventText = panel.querySelector('#portfolio-debug-events');
    graph = panel.querySelector('canvas');
    panel.addEventListener('change', event => {
      if (event.target.dataset.flag) flags[event.target.dataset.flag] = event.target.checked;
      if (event.target.matches('[data-limit]') && event.target.checkValidity()) flags.particleLimit = Number(event.target.value);
      recordEvent('comparison-change', { flags: { ...flags } });
    });
    panel.querySelector('[data-record]').addEventListener('click', event => {
      recording = !recording; previousFrame = 0;
      event.target.textContent = recording ? 'Pause recording' : 'Resume recording';
      paint();
    });
    panel.querySelector('[data-clear]').addEventListener('click', () => {
      frames.length = spans.length = events.length = 0;
      frameGaps = maxGap = totalFrames = 0; previousFrame = 0; captureStart = performance.now();
      recordEvent('measurements-cleared', { flags: { ...flags } }); paint();
    });
    panel.querySelector('[data-export]').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `portfolio-performance-${Date.now()}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    paint();
  };
  document.addEventListener('visibilitychange', () => {
    previousFrame = 0;
    recordEvent('visibility-change', { visibility: document.visibilityState });
  });
  window.addEventListener('error', event => recordEvent('error', { message: event.message, source: event.filename?.split('/').pop(), line: event.lineno }));
  window.addEventListener('unhandledrejection', event => recordEvent('unhandled-rejection', { message: String(event.reason?.message || event.reason) }));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  requestAnimationFrame(frameLoop);
})();
