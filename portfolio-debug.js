(() => {
  const frames = [];
  const spans = [];
  const events = [];
  const state = {};
  const viewers = new Map();
  const viewerMetrics = new Map();
  const registeredViewers = new WeakSet();
  const flags = { fogDisabled:false, blurDisabled:false, gradeDisabled:false, overlaysHidden:false, videosPaused:false, heroPaused:false, stepnotePaused:false, floatPaused:false, glowPaused:false, physicsPaused: false, drawingPaused: false, splatsPaused: false, glyphCollisions: true, cachedGlyphs: true, particleLimit: 240 };
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
      const meter=viewerMetrics.get(name);
      const renderer=viewer.renderer || viewer.threeRenderer;
      const mesh=viewer.getSplatMesh?.();
      const geometry=mesh?.geometry;
      const packedBytes=geometry ? Object.values(geometry.attributes||{}).reduce((sum,a)=>sum+(a.array?.byteLength||0),0) : 0;
      meter?.pollGPU();
      const drawWindow=meter?.draws.filter(t=>t>now-10000)||[];
      viewerState[name] = { running: viewer.selfDrivenModeRunning, selfDriven:viewer.selfDrivenMode, sortRunning: viewer.sortRunning,
        drawSubmissions10s:drawWindow.length, drawsPerSecond:round(drawWindow.length/Math.max(.001,Math.min(10,(now-(meter?.started||captureStart))/1000))),
        gpu:meter?.gpu||null, canvas:renderer?.domElement ? {width:renderer.domElement.width,height:renderer.domElement.height,pixels:renderer.domElement.width*renderer.domElement.height}:null,
        geometryInstances:geometry?.instanceCount, geometryAttributeMB:round(packedBytes/1048576), lastSortMs:viewer.lastSortTime,
        effectUniforms:Object.fromEntries(['studioFogBlur','studioFogEnabled','gradeEnabled','cutoffRadius','heroRevealProgress'].filter(k=>mesh?.material?.uniforms?.[k]).map(k=>[k,mesh.material.uniforms[k].value])),
        renderedSplats: viewer.splatRenderCount, totalSplats: viewer.getSplatMesh?.()?.getSplatCount?.(),
        sortCount: viewer.splatSortCount, pixelRatio: viewer.devicePixelRatio };
    }
    return {
      version: 2, captureDurationMs: round(now - captureStart), capturedAt: new Date().toISOString(), elapsed: round(now), recording,
      browser: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      visibility: document.visibilityState, scrollY: round(scrollY), flags: { ...flags }, capabilities,
      frames: { total: totalFrames, gapsOver80ms: frameGaps, maxGap: round(maxGap),
        median: round(percentile(recent.map(frame => frame.gap), 0.5)),
        p95: round(percentile(recent.map(frame => frame.gap), 0.95)) },
      timings, state: { ...state }, viewers: viewerState,
      videos: [...document.querySelectorAll('video')].map(video => ({ id: video.id, paused: video.paused, readyState: video.readyState, currentTime: round(video.currentTime), width:video.videoWidth,height:video.videoHeight, decodedFrames:video.getVideoPlaybackQuality?.().totalVideoFrames,droppedFrames:video.getVideoPlaybackQuality?.().droppedVideoFrames })),
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
      const renderer=viewer.renderer || viewer.threeRenderer;
      const meter={started:performance.now(),draws:[],gpu:{supported:false,samples:0,meanMs:null,p95Ms:null},pending:[],samples:[],lastGPU:0};
      let gl,ext;
      try {gl=renderer?.getContext?.();ext=gl?.createQuery?gl.getExtension('EXT_disjoint_timer_query_webgl2'):null;}catch{}
      meter.gpu.supported=Boolean(ext);
      meter.pollGPU=()=>{
        if(!ext)return;
        const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
        meter.pending=meter.pending.filter(query=>{
          if(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))return true;
          if(!disjoint)append(meter.samples,gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6,120);
          gl.deleteQuery(query);return false;
        });
        if(disjoint)meter.samples.length=0;
        meter.gpu={supported:true,samples:meter.samples.length,meanMs:meter.samples.length?round(meter.samples.reduce((a,b)=>a+b,0)/meter.samples.length):null,p95Ms:round(percentile(meter.samples,.95))};
      };
      meter.reset=()=>{meter.draws.length=meter.samples.length=0;meter.started=performance.now();if(ext){for(const query of meter.pending)gl.deleteQuery(query);meter.pending=[];}meter.gpu.samples=0;meter.gpu.meanMs=null;meter.gpu.p95Ms=null;};
      viewerMetrics.set(name,meter);
      if(renderer?.render){const draw=renderer.render;renderer.render=function(...args){if(recording)append(meter.draws,performance.now(),2400);return draw.apply(this,args);};}
      const savedUniforms=new Map();
      const syncEffects=()=>{
        const uniforms=viewer.getSplatMesh?.()?.material?.uniforms;
        for(const [key,disabled] of [['studioFogEnabled',flags.fogDisabled],['studioFogBlur',flags.blurDisabled],['gradeEnabled',flags.gradeDisabled]]){
          const uniform=uniforms?.[key];if(!uniform)continue;
          if(disabled){if(!savedUniforms.has(key))savedUniforms.set(key,uniform.value);uniform.value=0;}
          else if(savedUniforms.has(key)){uniform.value=savedUniforms.get(key);savedUniforms.delete(key);}
        }
      };
      for (const method of ['update', 'render']) {
        const original = viewer[method];
        if (typeof original !== 'function') continue;
        viewer[method] = function (...args) {
          if (flags.splatsPaused || (name==='hero'&&flags.heroPaused) || (name==='stepnote'&&flags.stepnotePaused)) return;
          syncEffects();
          let query=null;
          if(recording&&method==='render'&&ext&&meter.pending.length<4&&performance.now()-meter.lastGPU>500&&!gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)){
            query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);meter.lastGPU=performance.now();
          }
          const start = performance.now();
          try { return original.apply(this, args); }
          finally {
            if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);meter.pending.push(query);}
            sample(`${name}.${method}`, start, { sorting: Boolean(viewer.sortRunning) });
          }
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
    const viewerLines = Object.entries(report.viewers).map(([name, value]) => `${name}: running ${Boolean(value.running)} · sorting ${Boolean(value.sortRunning)} · splats ${value.renderedSplats ?? 0}/${value.totalSplats ?? 0}\n  Draw submissions ${value.drawsPerSecond}/s · bitmap ${value.canvas?.width}×${value.canvas?.height} · ${round((value.canvas?.pixels||0)/1e6)}MP\n  GPU ${value.gpu?.supported ? `${value.gpu.meanMs ?? '--'}ms avg / ${value.gpu.p95Ms ?? '--'}ms p95 (${value.gpu.samples} samples)` : 'timer unavailable'} · last sort ${value.lastSortMs ?? '--'}ms\n  Effects ${JSON.stringify(value.effectUniforms)}`);
    snapshotText.textContent = [
      `${recording ? 'RECORDING' : 'PAUSED'} · ${document.visibilityState} · scroll ${report.scrollY}`,
      `Capture ${(report.captureDurationMs / 1000).toFixed(1)}s · frames ${totalFrames} · UI tick ${report.frames.median ? Math.round(1000 / report.frames.median) : '--'} Hz`,
      `Frame gaps: median ${report.frames.median}ms · p95 ${report.frames.p95}ms`,
      `Stalls >80ms: ${frameGaps} · worst ${round(maxGap)}ms`,
      '', ...viewerLines, '',
      `ASCII: ${state.ascii?.particles ?? 0}/${state.ascii?.limit ?? flags.particleLimit} · visible ${state.ascii?.visible ?? 0} · steps ${state.ascii?.steps ?? 0} · backlog ${state.ascii?.backlogMs ?? 0}ms`,
      `Saved tuning: rotation ${state.asciiConfig?.rotationMultiplier ?? 1}× · scale ${state.asciiConfig?.scaleMultiplier ?? 1}× · edge spawn ${state.asciiConfig?.spawnWidth ?? 100}%`,
      `Dark cursor: strength ${state.asciiConfig?.cursorStrength ?? 0}px/s² · radius ${state.asciiConfig?.cursorRadius ?? 300}px · falloff ${state.asciiConfig?.cursorFalloff ?? 2} · max ${state.asciiConfig?.maxVelocity ?? 600}px/s`,
      `Light cursor: strength ${state.asciiConfig?.lightCursorStrength ?? 0}px/s² · radius ${state.asciiConfig?.lightCursorRadius ?? 300}px · falloff ${state.asciiConfig?.lightCursorFalloff ?? 2} · max ${state.asciiConfig?.lightMaxVelocity ?? 600}px/s`,
      `Last throw: ${(state.asciiThrow?.speed ?? 0).toFixed(1)}px/s · vx ${(state.asciiThrow?.vx ?? 0).toFixed(1)} · vy ${(state.asciiThrow?.vy ?? 0).toFixed(1)} · samples ${state.asciiThrow?.samples ?? 0}`,
      `Post-release force cooldown: ${state.asciiConfig?.throwCooldown ?? 1.5}s`,
      `Gravity dimming: ${state.asciiConfig?.gravityDimmingEnabled === false ? 'off' : 'on'} · multiplier ${state.asciiConfig?.gravityDimmingMultiplier ?? 0.25}`,
      `Cursor idle: ${state.ascii?.cursorIdle ? 'yes' : 'no'} · timeout ${state.asciiConfig?.cursorIdleTimeout ?? 2}s (dark theme only)`,
      `Pass-through: release ${state.asciiConfig?.releaseDistance ?? 40}px · cooldown ${state.asciiConfig?.cursorCooldown ?? 1}s · nudge ${state.asciiConfig?.escapeNudge ?? 100}px/s`,
      `Pair checks ${state.ascii?.pairChecks ?? 0} · overlaps ${state.ascii?.overlaps ?? 0} · bucket max ${state.ascii?.maxBucket ?? 0}`,
      `Obstacles ${state.ascii?.obstacles ?? 0} · geometry rebuilds ${state.ascii?.geometryRebuilds ?? 0}`,
      `Observers: long tasks ${capabilities.longtask ? 'yes' : 'unavailable'} · script attribution ${capabilities.longAnimationFrame ? 'yes' : 'unavailable'}`,
      ...(report.memory ? [`JS heap: ${report.memory.usedMB}MB / ${report.memory.totalMB}MB`] : []),
      '', ...timingLines,

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
    if (recording && now - lastPaint > 500) {
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
      <p>This debug page forces ASCII on even if public ASCII is off. Compare with the public page. Change one workload at a time, clear measurements, then repeat the same scroll or pointer movement. Draw submissions and optional GPU timings show work that FPS alone misses.</p>
      <canvas width="360" height="80" aria-label="Recent frame gaps: green under 25ms, amber over 25ms, red over 80ms"></canvas>
      <div class="debug-controls">
        <label><input type="checkbox" data-flag="physicsPaused"> Pause physics</label>
        <label><input type="checkbox" data-flag="drawingPaused"> Hide glyph drawing</label>
        <label><input type="checkbox" data-flag="splatsPaused"> Pause splat rendering</label>
        <label><input type="checkbox" data-flag="glyphCollisions" checked> Glyph collisions</label>
        <label><input type="checkbox" data-flag="cachedGlyphs" checked> Cached glyph rendering</label>
        <label><input type="checkbox" data-flag="heroPaused"> Pause hero rendering</label>
        <label><input type="checkbox" data-flag="stepnotePaused"> Pause StepNote rendering</label>
        <label><input type="checkbox" data-flag="blurDisabled"> Bypass splat blur</label>
        <label><input type="checkbox" data-flag="fogDisabled"> Bypass all fog</label>
        <label><input type="checkbox" data-flag="gradeDisabled"> Bypass LUT / curves</label>
        <label><input type="checkbox" data-flag="overlaysHidden"> Hide hero overlays</label>
        <label><input type="checkbox" data-flag="videosPaused"> Pause videos</label>
        <label><input type="checkbox" data-flag="floatPaused"> Pause floating title</label>
        <label><input type="checkbox" data-flag="glowPaused"> Pause grid glow</label>
        <label>Particle cap <input type="number" data-limit min="0" max="500" step="1" value="${flags.particleLimit}"></label>
      </div>
      <div class="debug-buttons"><button data-record>Pause recording</button><button data-clear>Clear measurements</button><button data-export>Download report</button></div>
      <pre id="portfolio-debug-summary"></pre>
      <details open><summary>Recent pauses and correlated work</summary><pre id="portfolio-debug-events"></pre></details>
      <p>JS timings measure submission cost. GPU timings sample asynchronous WebGL timer queries when supported; unavailable does not mean zero GPU cost. This page cannot read Mac temperature, fan speed, system energy or other tabs. Background-tab pauses are excluded. Reports stay in this browser unless you download and share them.</p>
      <a href="/?debugPortfolio&amp;splatPixelRatio=1">Compare at 1× hero resolution (reload)</a> · <a href="/" target="_blank" rel="noopener">Open public page without debug overhead</a><br><a href="/admin/">Back to admin</a></details>`;
    document.body.append(panel);
    const compareStyle=document.createElement('style');
    compareStyle.textContent='html[data-debug-hide-overlays] .splat-stage::before,html[data-debug-hide-overlays] .splat-stage::after {display:none!important} html[data-debug-hide-glow] .grid-cursor-glow,html[data-debug-hide-glow] .grid-panel-glow {display:none!important}';
    document.head.append(compareStyle);
    const playingVideos=new Set();
    document.addEventListener('play',event=>{if(flags.videosPaused&&event.target instanceof HTMLVideoElement)event.target.pause();},true);
    snapshotText = panel.querySelector('#portfolio-debug-summary');
    eventText = panel.querySelector('#portfolio-debug-events');
    graph = panel.querySelector('canvas');
    panel.addEventListener('change', event => {
      if (event.target.dataset.flag) flags[event.target.dataset.flag] = event.target.checked;
      if (event.target.matches('[data-limit]') && event.target.checkValidity()) flags.particleLimit = Number(event.target.value);
      document.documentElement.toggleAttribute('data-debug-hide-overlays',flags.overlaysHidden);
      document.documentElement.toggleAttribute('data-debug-hide-glow',flags.glowPaused);
      document.dispatchEvent(new CustomEvent('portfolio:diagnostics-change'));
      if(flags.videosPaused){for(const video of document.querySelectorAll('video')){if(!video.paused)playingVideos.add(video);video.pause();}}
      else {for(const video of playingVideos){const r=video.getBoundingClientRect();if(!document.hidden&&r.bottom>0&&r.top<innerHeight)video.play().catch(()=>{});}playingVideos.clear();}
      for(const viewer of viewers.values()){viewer.forceRenderNextFrame?.();viewer.render?.();}
      recordEvent('comparison-change', { flags: { ...flags } });
    });
    panel.querySelector('[data-record]').addEventListener('click', event => {
      recording = !recording; previousFrame = 0;
      event.target.textContent = recording ? 'Pause recording' : 'Resume recording';
      paint();
    });
    panel.querySelector('[data-clear]').addEventListener('click', () => {
      frames.length = spans.length = events.length = 0;
      for(const meter of viewerMetrics.values())meter.reset();
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
