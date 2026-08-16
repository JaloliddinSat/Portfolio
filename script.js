const year = document.querySelector("#year");

if (year) {
  year.textContent = new Date().getFullYear();
}

const cards = document.querySelectorAll(".project-card");

cards.forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    card.style.backgroundImage = `radial-gradient(circle at ${x}% ${y}%, rgba(141, 216, 255, 0.18), transparent 28%), linear-gradient(145deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04))`;
  });

  card.addEventListener("pointerleave", () => {
    card.style.backgroundImage = "";
  });
});

const initGridCursorGlow = () => {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return;
  }

  let pointerX = -200;
  let pointerY = -200;
  let updateFrame = null;

  const drawGlow = () => {
    document.body.style.setProperty("--grid-cursor-x", `${pointerX}px`);
    document.body.style.setProperty("--grid-cursor-y", `${pointerY}px`);
    document.body.style.setProperty("--grid-cursor-opacity", "1");
    updateFrame = null;
  };

  window.addEventListener("pointermove", (event) => {
    pointerX = event.pageX;
    pointerY = event.pageY;

    if (updateFrame === null) {
      updateFrame = requestAnimationFrame(drawGlow);
    }
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => {
    document.body.style.setProperty("--grid-cursor-opacity", "0");
  });
};

const DEBUG_SPLAT = new URLSearchParams(window.location.search).has("debugSplat");
const DEBUG_STEPNOTE_SPLAT = new URLSearchParams(window.location.search).has(
  "debugStepNoteSplat",
);
const DEBUG_STEPNOTE_SPLAT_ASSET = new URLSearchParams(window.location.search).get(
  "stepNoteSplat",
);

const SPLAT_RENDERER_URL =
  "https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.7/build/gaussian-splats-3d.module.js";

const SPLAT_DEBUG_STORAGE_KEY = "splatDebugConfig";
const SPLAT_ASSET_VERSION = 2;

const SPLAT_CONFIG = {
  cameraStart: {
    position: [-1.66, 0.3, -1.91],
    lookAt: [-1.82, 0.58, -1.27],
  },
  cameraEnd: {
    position: [-2.26, 0.75, -0.8],
    lookAt: [8.01, 2.05, -5.34],
  },
  splatPosition: [-1.65, 0.87, -0.71],
  splatScale: 0.75,
  alphaThreshold: 5,
  lookAtTiming: 0.1,
  scrollEndAt: 0.18,
};

// Production values captured with ?debugStepNoteSplat.
const STEPNOTE_SPLAT_CONFIG = {
  cameraPosition: [0.15, -0.3, -0.32],
  cameraLookAt: [-0.6400000000000001, 2.3500000000000014, 2.560000000000001],
  splatPosition: [0, 0, 0],
  splatScale: 1,
  alphaThreshold: 1,
  loopKeyframe: [-3, -2.45, 0],
  spinAxis: [0, 1, 0.26],
  rotationOrigin: [0.12, 0, 0],
  orbitStartPercent: -14.2,
  orbitEndPercent: 27.5,
  pingPong: true,
  loopSeconds: 14,
};

const STEPNOTE_SPLAT_DEBUG_STORAGE_KEY = "stepNoteSplatDebugConfig";

const lerpVec3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const cubicBezierVec3 = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return [
    uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0],
    uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1],
    uuu * p0[2] + 3 * uu * t * p1[2] + 3 * u * tt * p2[2] + ttt * p3[2],
  ];
};

// Equivalent to cubic-bezier(0.333, 0, 0.667, 1): zero velocity at both ends.
const easeOrbitPingPong = (progress) => {
  const t = Math.min(1, Math.max(0, progress));
  return t * t * (3 - 2 * t);
};

const inverseOrbitEase = (progress) => {
  const target = Math.min(1, Math.max(0, progress));
  let low = 0;
  let high = 1;

  for (let index = 0; index < 14; index += 1) {
    const midpoint = (low + high) / 2;
    if (easeOrbitPingPong(midpoint) < target) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }

  return (low + high) / 2;
};

const easeInLookAt = (progress) => {
  const t = Math.min(1, Math.max(0, progress));
  const ease = t * t * t;

  return t * 0.3 + ease * 0.7;
};

const computeScrollPosition = (
  progress,
  cameraStart,
  cameraEnd,
  lookAtTiming = 1,
) => {
  const p0 = cameraStart.position;
  const p3 = cameraEnd.position;
  const p1 = lerpVec3(p0, p3, 0.33);
  const p2 = lerpVec3(p0, p3, 0.67);
  const position = cubicBezierVec3(p0, p1, p2, p3, progress);
  const rawLookAt = Math.min(1, Math.max(0, progress * lookAtTiming));
  const lookAtProgress = easeInLookAt(rawLookAt);
  const lookAt = lerpVec3(cameraStart.lookAt, cameraEnd.lookAt, lookAtProgress);

  return { position, lookAt, lookAtProgress };
};

const cloneKeyframe = (keyframe) => ({
  position: [...keyframe.position],
  lookAt: [...keyframe.lookAt],
});

const cloneKeyframes = (keyframes) => ({
  start: cloneKeyframe(keyframes.start),
  end: cloneKeyframe(keyframes.end),
});

const splatContainer = document.querySelector("#splat-viewer");
const splatError = document.querySelector("#splat-error");
const heroScrollTrack = document.querySelector("#hero-scroll-track");

const setStatus = (state, message = "") => {
  if (splatError) {
    splatError.hidden = state !== "error";
    if (message) {
      splatError.textContent = message;
    }
  }
};

const appendSplatVersion = (url) => {
  if (!url) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}v=${SPLAT_ASSET_VERSION}`;
};

const getSplatUrl = () => {
  const productionUrl = splatContainer?.dataset.splatSrc;
  const localUrl = splatContainer?.dataset.localSplatSrc;
  const isLocalhost = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
  );

  const url = isLocalhost && localUrl ? localUrl : productionUrl;

  return appendSplatVersion(url);
};

const getScrollProgress = () => {
  if (!heroScrollTrack) {
    return 0;
  }

  const scrollRange = heroScrollTrack.offsetHeight - window.innerHeight;

  if (scrollRange <= 0) {
    return 1;
  }

  const trackTop =
    heroScrollTrack.getBoundingClientRect().top + window.scrollY;
  const scrolled = window.scrollY - trackTop;

  return Math.min(Math.max(scrolled / scrollRange, 0), 1);
};

const HERO_SCROLL_ANIM_MS = 1900;

const getHeroTrackEndScrollY = () => {
  if (!heroScrollTrack) {
    return window.scrollY;
  }

  const scrollRange = heroScrollTrack.offsetHeight - window.innerHeight;

  if (scrollRange <= 0) {
    return window.scrollY;
  }

  const trackTop =
    heroScrollTrack.getBoundingClientRect().top + window.scrollY;

  return trackTop + scrollRange;
};

const getElementScrollY = (element) =>
  element.getBoundingClientRect().top + window.scrollY;

const smoothScrollTo = (targetY, duration) => {
  document.documentElement.style.scrollBehavior = "auto";

  return new Promise((resolve) => {
    if (
      duration <= 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      window.scrollTo(0, targetY);
      resolve();
      return;
    }

    const startY = window.scrollY;
    const distance = targetY - startY;

    if (Math.abs(distance) < 1) {
      resolve();
      return;
    }

    const startTime = performance.now();
    const easeInOut = (t) => t * t * (3 - 2 * t);

    const step = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);

      window.scrollTo(0, startY + distance * easeInOut(t));

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(step);
  }).finally(() => {
    document.documentElement.style.scrollBehavior = "";
  });
};

const initHeroActionLinks = () => {
  const links = document.querySelectorAll(".hero-actions .button[href^=\"#\"]");

  if (!links.length) {
    return;
  }

  let isAnimating = false;

  links.forEach((link) => {
    link.addEventListener("click", async (event) => {
      const selector = link.getAttribute("href");

      if (!selector || selector === "#") {
        return;
      }

      const target = document.querySelector(selector);

      if (!target) {
        return;
      }

      event.preventDefault();

      if (isAnimating) {
        return;
      }

      isAnimating = true;

      try {
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;

        if (!reducedMotion && getScrollProgress() < 0.995) {
          const heroEnd = getHeroTrackEndScrollY();
          const remaining = 1 - getScrollProgress();

          await smoothScrollTo(heroEnd, remaining * HERO_SCROLL_ANIM_MS);
        }

        const targetY = getElementScrollY(target);
        const phaseTwoDistance = Math.abs(targetY - window.scrollY);
        const phaseTwoDuration = reducedMotion
          ? 0
          : Math.min(Math.max(phaseTwoDistance * 0.45, 500), 1400);

        await smoothScrollTo(targetY, phaseTwoDuration);
        history.replaceState(null, "", selector);
      } finally {
        isAnimating = false;
      }
    });
  });
};

const mapScrollProgress = (rawProgress, scrollEndAt = 1) => {
  const endAt = Math.max(0.05, Math.min(1, scrollEndAt));

  return Math.min(1, Math.max(0, rawProgress / endAt));
};

const easeScrollProgress = (progress) => {
  const t = Math.min(1, Math.max(0, progress));
  const smooth = t * t * (3 - 2 * t);

  return t * 0.6 + smooth * 0.4;
};

const getAnimationProgress = (rawScrollProgress, scrollEndAt = 1) =>
  easeScrollProgress(mapScrollProgress(rawScrollProgress, scrollEndAt));

const initSplat = async () => {
  if (!splatContainer) {
    return;
  }

  const splatUrl = getSplatUrl();

  if (!splatUrl) {
    setStatus("error", "Missing splat URL.");
    return;
  }

  setStatus("loading");

  try {
    console.log("[SPLAT] Loading from:", splatUrl);

    const GaussianSplats3D = await import(SPLAT_RENDERER_URL);

    console.log("[SPLAT] Renderer loaded:", GaussianSplats3D);

    const isMobile = window.matchMedia("(max-width: 700px)").matches;

    const splatScale = isMobile ? SPLAT_CONFIG.splatScale * 0.73 : SPLAT_CONFIG.splatScale;
    const initialCameraPosition = [...SPLAT_CONFIG.cameraStart.position];
    const initialCameraLookAt = [...SPLAT_CONFIG.cameraStart.lookAt];

    const viewer = new GaussianSplats3D.Viewer({
      rootElement: splatContainer,
      cameraUp: [0, -1, 0],
      initialCameraPosition,
      initialCameraLookAt,
      useBuiltInControls: false,
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
      dynamicScene: true,
      ignoreDevicePixelRatio: isMobile,
      sphericalHarmonicsDegree: 0,
      renderMode: GaussianSplats3D.RenderMode.OnChange,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
      webXRMode: GaussianSplats3D.WebXRMode.None,
    });

    const sceneOptions = {
      progressiveLoad: true,
      showLoadingUI: false,
      splatAlphaRemovalThreshold: SPLAT_CONFIG.alphaThreshold,
      scale: [splatScale, splatScale, splatScale],
      position: [...SPLAT_CONFIG.splatPosition],
      rotation: [0, 0, 0, 1],
    };

    if (splatUrl.toLowerCase().includes(".ksplat")) {
      sceneOptions.format = GaussianSplats3D.SceneFormat.KSplat;
    } else if (splatUrl.toLowerCase().includes(".ply")) {
      sceneOptions.format = GaussianSplats3D.SceneFormat.Ply;
    }

    await viewer.addSplatScene(splatUrl, sceneOptions);

    console.log("[SPLAT] Scene added successfully.");

    viewer.start();
    let viewerRunning = true;

    if (viewer.threeRenderer) {
      viewer.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }

    setStatus("ready");

    let lastScrollY = null;
    let renderFrameId = null;
    let renderStopTimer = null;
    let initialLoadTimer = null;
    let allowIdleStop = false;
    let splatInView = false;
    let forceNextRender = true;

    const stopViewer = () => {
      if (renderStopTimer) {
        clearTimeout(renderStopTimer);
        renderStopTimer = null;
      }

      if (initialLoadTimer) {
        clearTimeout(initialLoadTimer);
        initialLoadTimer = null;
      }

      if (renderFrameId) {
        cancelAnimationFrame(renderFrameId);
        renderFrameId = null;
      }

      if (viewerRunning && typeof viewer.stop === "function") {
        viewer.stop();
        viewerRunning = false;
      }
    };

    const ensureViewerRunning = () => {
      if (!viewerRunning) {
        viewer.start();
        viewerRunning = true;
      }
    };

    const scheduleInitialLoadGrace = () => {
      if (allowIdleStop || initialLoadTimer) {
        return;
      }

      ensureViewerRunning();

      initialLoadTimer = setTimeout(() => {
        allowIdleStop = true;
        initialLoadTimer = null;
        stopViewerAfterIdle(1200);
      }, 6500);
    };

    const stopViewerAfterIdle = (delay = 280) => {
      if (renderStopTimer) {
        clearTimeout(renderStopTimer);
      }

      if (typeof viewer.stop !== "function") {
        return;
      }

      if (!allowIdleStop) {
        return;
      }

      renderStopTimer = setTimeout(() => {
        if (!document.hidden) {
          viewer.stop();
          viewerRunning = false;
        }

        renderStopTimer = null;
      }, delay);
    };

    const renderSplatForScroll = () => {
      renderFrameId = null;

      if (document.hidden || !splatInView) {
        return;
      }

      if (!forceNextRender && window.scrollY === lastScrollY) {
        stopViewerAfterIdle();
        return;
      }

      forceNextRender = false;
      lastScrollY = window.scrollY;

      const progress = easeScrollProgress(getScrollProgress());
      const { position, lookAt } = computeScrollPosition(
        progress,
        SPLAT_CONFIG.cameraStart,
        SPLAT_CONFIG.cameraEnd,
        SPLAT_CONFIG.lookAtTiming ?? 1,
      );

      if (viewer.camera) {
        viewer.camera.position.set(
          position[0],
          position[1],
          position[2],
        );
        viewer.camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
      }

      ensureViewerRunning();
      viewer.forceRenderNextFrame?.();
      stopViewerAfterIdle();
    };

    const requestSplatRender = ({ force = false } = {}) => {
      if (force) {
        forceNextRender = true;
      }

      if (renderFrameId || document.hidden || !splatInView) {
        return;
      }

      renderFrameId = requestAnimationFrame(renderSplatForScroll);
    };

    if (DEBUG_SPLAT) {
      initDebugMode(viewer, isMobile);
    } else {
      const observer = new IntersectionObserver(
        ([entry]) => {
          splatInView = entry.isIntersecting;

          if (splatInView) {
            ensureViewerRunning();
            scheduleInitialLoadGrace();
            requestSplatRender({ force: true });
          } else {
            stopViewer();
          }
        },
        { threshold: 0 },
      );

      observer.observe(splatContainer);

      window.addEventListener("scroll", () => requestSplatRender(), {
        passive: true,
      });
      window.addEventListener("resize", () => requestSplatRender({ force: true }), {
        passive: true,
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          stopViewer();
        } else {
          scheduleInitialLoadGrace();
          requestSplatRender({ force: true });
        }
      });

      splatInView = true;
      scheduleInitialLoadGrace();
      requestSplatRender({ force: true });
    }
  } catch (error) {
    const message = error?.stack || error?.message || String(error);

    window.__splatDebugError = message;
    console.error("[SPLAT] Failed:", error);

    setStatus("error", "The splat could not be loaded. Check console.");
  }
};

const showToast = (message) => {
  const existing = document.querySelector(".splat-debug-toast");
  existing?.remove();

  const toast = document.createElement("div");
  toast.className = "splat-debug-toast";
  toast.textContent = message;
  toast.style.cssText = [
    "position:fixed",
    "bottom:24px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:10001",
    "padding:10px 18px",
    "border-radius:999px",
    "font:600 13px/1.4 Inter,system-ui,sans-serif",
    "color:#07101f",
    "background:linear-gradient(135deg,#8dd8ff,#f0f9ff)",
    "box-shadow:0 12px 32px rgba(0,0,0,0.35)",
    "pointer-events:none",
    "opacity:1",
    "transition:opacity 0.35s ease",
  ].join(";");
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 350);
  }, 2000);
};

const formatSplatConfigSnippet = (keyframes, splatConfig) =>
  `const SPLAT_CONFIG = {
  cameraStart: {
    position: [${keyframes.start.position.join(", ")}],
    lookAt:    [${keyframes.start.lookAt.join(", ")}],
  },
  cameraEnd: {
    position: [${keyframes.end.position.join(", ")}],
    lookAt:    [${keyframes.end.lookAt.join(", ")}],
  },
  splatPosition: [${splatConfig.splatPosition.join(", ")}],
  splatScale: ${splatConfig.splatScale},
  alphaThreshold: ${splatConfig.alphaThreshold},
  lookAtTiming: ${splatConfig.lookAtTiming ?? 1},
  scrollEndAt: ${splatConfig.scrollEndAt ?? 1},
};`;

const copyConfig = async (keyframes, splatConfig) => {
  const snippet = formatSplatConfigSnippet(keyframes, splatConfig);

  try {
    await navigator.clipboard.writeText(snippet);
    showToast("Config copied!");
  } catch {
    showToast("Copy failed — see console.");
    console.log("[SPLAT] Config:\n", snippet);
  }

  console.log("[SPLAT] Current keyframes:", keyframes);
  console.log("[SPLAT] Current splat config:", splatConfig);
  window.__splatConfig = { keyframes, ...splatConfig };
};

const injectDebugPanelStyles = () => {
  if (document.getElementById("splat-debug-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "splat-debug-styles";
  style.textContent = `
    #splat-debug-panel {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 10000;
      width: min(92vw, 320px);
      max-height: calc(100vh - 32px);
      overflow: auto;
      padding: 14px;
      border: 1px solid rgba(141, 216, 255, 0.35);
      border-radius: 16px;
      background: rgba(4, 8, 20, 0.92);
      backdrop-filter: blur(14px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      color: #e2e8f0;
      font: 500 12px/1.4 Inter, system-ui, sans-serif;
    }
    #splat-debug-panel h2 {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    #splat-debug-panel .splat-debug-section {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    #splat-debug-panel .splat-debug-section-title {
      margin: 0 0 8px;
      color: #8dd8ff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    #splat-debug-panel .splat-debug-row {
      display: grid;
      grid-template-columns: 42px 1fr 58px;
      gap: 6px;
      align-items: center;
      margin-bottom: 6px;
    }
    #splat-debug-panel .splat-debug-row label {
      color: #94a3b8;
      font-size: 10px;
      font-weight: 700;
    }
    #splat-debug-panel input[type="range"] {
      width: 100%;
      accent-color: #8dd8ff;
    }
    #splat-debug-panel input[type="number"] {
      width: 100%;
      padding: 4px 6px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      color: #f8fafc;
      font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #splat-debug-panel .splat-debug-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 10px;
    }
    #splat-debug-panel button {
      padding: 8px 10px;
      border: 1px solid rgba(141, 216, 255, 0.35);
      border-radius: 10px;
      background: rgba(141, 216, 255, 0.12);
      color: #e2e8f0;
      font: 700 11px/1 Inter, system-ui, sans-serif;
      cursor: pointer;
    }
    #splat-debug-panel button:hover {
      background: rgba(141, 216, 255, 0.22);
    }
    #splat-debug-panel .splat-debug-caption {
      margin: 0 0 8px;
      color: #64748b;
      font-size: 10px;
      line-height: 1.4;
    }
    #splat-debug-panel .splat-debug-readout {
      margin: 6px 0 0;
      padding: 8px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: #94a3b8;
      font: 600 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: pre-wrap;
      word-break: break-all;
    }
    #splat-debug-panel .splat-debug-keyframe-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 8px 0;
    }
    #splat-debug-panel .splat-debug-keyframe-status {
      margin: 0 0 6px;
      color: #94a3b8;
      font: 600 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #splat-debug-panel button.is-active {
      background: rgba(141, 216, 255, 0.35);
      border-color: rgba(141, 216, 255, 0.7);
    }
    #splat-debug-panel .splat-debug-hint {
      margin: 8px 0 0;
      color: #64748b;
      font-size: 10px;
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);
};

const formatVec3 = (values) =>
  `[${values.map((value) => value.toFixed(3)).join(", ")}]`;

const buildDebugPanel = ({
  config,
  keyframes,
  onApplyPosition,
  onApplyLookAt,
  onSetStart,
  onSetEnd,
  onApplyLookAtTiming,
  onApplyScrollEndAt,
  onCopy,
  onReset,
  onSave,
  onClear,
  onPreviewChange,
}) => {
  injectDebugPanelStyles();

  const existing = document.getElementById("splat-debug-panel");
  existing?.remove();

  const panel = document.createElement("div");
  panel.id = "splat-debug-panel";
  panel.innerHTML = `
    <h2>Splat Debug</h2>
    <div class="splat-debug-section" data-section="camera"></div>
    <div class="splat-debug-section" data-section="keyframes"></div>
    <div class="splat-debug-actions">
      <button type="button" data-action="copy">Copy Config (C)</button>
      <button type="button" data-action="reset">Reset (R)</button>
      <button type="button" data-action="save">Save to Local Storage</button>
      <button type="button" data-action="clear">Clear Saved Config</button>
    </div>
    <p class="splat-debug-hint">Position the camera, press Set Start / Set End, then scrub scroll % to preview the bezier path. Press C to copy, R to reset.</p>
  `;
  document.body.appendChild(panel);

  const fields = {};
  const cameraSection = panel.querySelector('[data-section="camera"]');
  const keyframesSection = panel.querySelector('[data-section="keyframes"]');

  cameraSection.innerHTML =
    '<p class="splat-debug-section-title">Camera</p><p class="splat-debug-caption">px/py/pz pan the camera without changing aim. lx/ly/lz adjust where it looks.</p>';
  keyframesSection.innerHTML =
    '<p class="splat-debug-section-title">Keyframes</p><p class="splat-debug-caption">Capture scroll start and end poses, then preview the path between them. Lower look speed slows aim shift vs movement. Lower end-at finishes the path sooner while scrolling.</p>';

  const addField = (
    section,
    key,
    label,
    min,
    max,
    step,
    getValue,
    setValue,
    onApply,
  ) => {
    const row = document.createElement("div");
    row.className = "splat-debug-row";

    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    labelEl.setAttribute("for", `splat-debug-${key}`);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.id = `splat-debug-${key}`;
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(getValue());

    const number = document.createElement("input");
    number.type = "number";
    number.min = String(min);
    number.max = String(max);
    number.step = String(step);
    number.value = String(getValue());

    const syncFromSlider = () => {
      const value = Number(slider.value);
      number.value = String(value);
      setValue(value);
      onApply();
    };

    const syncFromNumber = () => {
      const value = Number(number.value);
      slider.value = String(value);
      setValue(value);
      onApply();
    };

    slider.addEventListener("input", syncFromSlider);
    number.addEventListener("change", syncFromNumber);

    row.append(labelEl, slider, number);
    section.appendChild(row);

    fields[key] = { slider, number, getValue, setValue };
  };

  const addVectorFields = (
    section,
    prefix,
    labels,
    targetKey,
    min,
    max,
    step,
    onApply,
  ) => {
    labels.forEach((label, index) => {
      addField(
        section,
        `${prefix}${index}`,
        label,
        min,
        max,
        step,
        () => config[targetKey][index],
        (value) => {
          config[targetKey][index] = value;
        },
        onApply,
      );
    });
  };

  addVectorFields(
    cameraSection,
    "camPos",
    ["px", "py", "pz"],
    "cameraPosition",
    -20,
    20,
    0.01,
    onApplyPosition,
  );
  addVectorFields(
    cameraSection,
    "camLook",
    ["lx", "ly", "lz"],
    "cameraLookAt",
    -10,
    10,
    0.01,
    onApplyLookAt,
  );

  const keyframeActions = document.createElement("div");
  keyframeActions.className = "splat-debug-keyframe-actions";

  const setStartButton = document.createElement("button");
  setStartButton.type = "button";
  setStartButton.textContent = "Set Start";
  setStartButton.dataset.keyframe = "start";

  const setEndButton = document.createElement("button");
  setEndButton.type = "button";
  setEndButton.textContent = "Set End";
  setEndButton.dataset.keyframe = "end";

  setStartButton.addEventListener("click", onSetStart);
  setEndButton.addEventListener("click", onSetEnd);

  keyframeActions.append(setStartButton, setEndButton);
  keyframesSection.appendChild(keyframeActions);

  const startStatus = document.createElement("p");
  startStatus.className = "splat-debug-keyframe-status";
  startStatus.dataset.keyframeStatus = "start";

  const endStatus = document.createElement("p");
  endStatus.className = "splat-debug-keyframe-status";
  endStatus.dataset.keyframeStatus = "end";

  keyframesSection.append(startStatus, endStatus);

  addField(
    keyframesSection,
    "lookAtTiming",
    "look",
    0.1,
    3,
    0.05,
    () => config.lookAtTiming ?? 1,
    (value) => {
      config.lookAtTiming = value;
    },
    onApplyLookAtTiming,
  );

  addField(
    keyframesSection,
    "scrollEndAt",
    "end",
    0.1,
    1,
    0.05,
    () => config.scrollEndAt ?? 1,
    (value) => {
      config.scrollEndAt = value;
    },
    onApplyScrollEndAt,
  );

  const previewReadout = document.createElement("pre");
  previewReadout.className = "splat-debug-readout";
  previewReadout.textContent = "scroll 0%";

  const previewRow = document.createElement("div");
  previewRow.className = "splat-debug-row";
  previewRow.style.marginTop = "8px";

  const previewLabel = document.createElement("label");
  previewLabel.textContent = "scroll";
  previewLabel.setAttribute("for", "splat-debug-preview");

  const previewSlider = document.createElement("input");
  previewSlider.type = "range";
  previewSlider.id = "splat-debug-preview";
  previewSlider.min = "0";
  previewSlider.max = "100";
  previewSlider.step = "1";
  previewSlider.value = "0";

  const previewNumber = document.createElement("input");
  previewNumber.type = "number";
  previewNumber.min = "0";
  previewNumber.max = "100";
  previewNumber.step = "1";
  previewNumber.value = "0";

  const handlePreviewInput = () => {
    const percent = Number(previewSlider.value);
    previewNumber.value = String(percent);
    onPreviewChange(percent);
  };

  previewSlider.addEventListener("input", handlePreviewInput);
  previewNumber.addEventListener("change", () => {
    previewSlider.value = String(previewNumber.value);
    handlePreviewInput();
  });

  previewRow.append(previewLabel, previewSlider, previewNumber);
  keyframesSection.append(previewRow, previewReadout);

  panel.querySelector('[data-action="copy"]').addEventListener("click", onCopy);
  panel.querySelector('[data-action="reset"]').addEventListener("click", onReset);
  panel.querySelector('[data-action="save"]').addEventListener("click", onSave);
  panel.querySelector('[data-action="clear"]').addEventListener("click", onClear);

  const refreshInputs = () => {
    Object.values(fields).forEach(({ slider, number, getValue }) => {
      const value = getValue();
      slider.value = String(value);
      number.value = String(value);
    });
  };

  const refreshLookAtInputs = () => {
    ["camLook0", "camLook1", "camLook2"].forEach((key) => {
      const field = fields[key];
      if (!field) {
        return;
      }
      const value = field.getValue();
      field.slider.value = String(value);
      field.number.value = String(value);
    });
  };

  const refreshKeyframeReadouts = ({ startSet, endSet }) => {
    startStatus.textContent = startSet
      ? `Start: set\npos ${formatVec3(keyframes.start.position)}\nlook ${formatVec3(keyframes.start.lookAt)}`
      : "Start: not set";
    endStatus.textContent = endSet
      ? `End: set\npos ${formatVec3(keyframes.end.position)}\nlook ${formatVec3(keyframes.end.lookAt)}`
      : "End: not set";
    setStartButton.classList.toggle("is-active", startSet);
    setEndButton.classList.toggle("is-active", endSet);
  };

  const updatePreviewReadout = ({ position, lookAt, lookAtProgress }, progress) => {
    previewReadout.textContent =
      `scroll ${(progress * 100).toFixed(0)}%\n` +
      `aim ${((lookAtProgress ?? progress) * 100).toFixed(0)}%\n` +
      `pos ${formatVec3(position)}\n` +
      `look ${formatVec3(lookAt)}`;
  };

  const resetPreviewControls = () => {
    previewSlider.value = "0";
    previewNumber.value = "0";
  };

  return {
    refreshInputs,
    refreshLookAtInputs,
    refreshKeyframeReadouts,
    updatePreviewReadout,
    resetPreviewControls,
    fields,
  };
};

const cloneDefaultConfig = (defaults) => ({
  cameraPosition: [...defaults.cameraPosition],
  cameraLookAt: [...defaults.cameraLookAt],
  splatPosition: [...defaults.splatPosition],
  splatScale: defaults.splatScale,
  alphaThreshold: defaults.alphaThreshold,
  lookAtTiming: defaults.lookAtTiming ?? 1,
  scrollEndAt: defaults.scrollEndAt ?? 1,
});

const captureCameraPose = (viewer, config) => ({
  position: viewer.camera
    ? [
        viewer.camera.position.x,
        viewer.camera.position.y,
        viewer.camera.position.z,
      ]
    : [...config.cameraPosition],
  lookAt: [...config.cameraLookAt],
});

const initDebugMode = async (viewer, isMobile) => {
  const defaultKeyframes = cloneKeyframes({
    start: SPLAT_CONFIG.cameraStart,
    end: SPLAT_CONFIG.cameraEnd,
  });

  const defaults = {
    cameraPosition: [...SPLAT_CONFIG.cameraStart.position],
    cameraLookAt: [...SPLAT_CONFIG.cameraStart.lookAt],
    splatPosition: [...SPLAT_CONFIG.splatPosition],
    splatScale: isMobile ? SPLAT_CONFIG.splatScale * 0.73 : SPLAT_CONFIG.splatScale,
    alphaThreshold: SPLAT_CONFIG.alphaThreshold,
    lookAtTiming: SPLAT_CONFIG.lookAtTiming ?? 1,
    scrollEndAt: SPLAT_CONFIG.scrollEndAt ?? 1,
  };

  let config = cloneDefaultConfig(defaults);
  let keyframes = cloneKeyframes(defaultKeyframes);
  let previewProgress = 0;
  let startSet = false;
  let endSet = false;
  let viewOffset = [
    config.cameraLookAt[0] - config.cameraPosition[0],
    config.cameraLookAt[1] - config.cameraPosition[1],
    config.cameraLookAt[2] - config.cameraPosition[2],
  ];

  const syncViewOffsetFromConfig = () => {
    viewOffset = [
      config.cameraLookAt[0] - config.cameraPosition[0],
      config.cameraLookAt[1] - config.cameraPosition[1],
      config.cameraLookAt[2] - config.cameraPosition[2],
    ];
  };

  const panLookAtWithCamera = () => {
    config.cameraLookAt[0] = config.cameraPosition[0] + viewOffset[0];
    config.cameraLookAt[1] = config.cameraPosition[1] + viewOffset[1];
    config.cameraLookAt[2] = config.cameraPosition[2] + viewOffset[2];
  };

  const refreshKeyframeUi = () => {
    panelApi?.refreshKeyframeReadouts({ startSet, endSet });
  };

  try {
    const saved = localStorage.getItem(SPLAT_DEBUG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      if (parsed.config) {
        config = {
          ...cloneDefaultConfig(defaults),
          ...parsed.config,
          cameraPosition: parsed.config.cameraPosition
            ? [...parsed.config.cameraPosition]
            : [...defaults.cameraPosition],
          cameraLookAt: parsed.config.cameraLookAt
            ? [...parsed.config.cameraLookAt]
            : [...defaults.cameraLookAt],
          splatPosition: parsed.config.splatPosition
            ? [...parsed.config.splatPosition]
            : [...defaults.splatPosition],
        };
      } else {
        config = {
          ...cloneDefaultConfig(defaults),
          ...parsed,
          cameraPosition: parsed.cameraPosition
            ? [...parsed.cameraPosition]
            : [...defaults.cameraPosition],
          cameraLookAt: parsed.cameraLookAt
            ? [...parsed.cameraLookAt]
            : [...defaults.cameraLookAt],
          splatPosition: parsed.splatPosition
            ? [...parsed.splatPosition]
            : [...defaults.splatPosition],
        };
      }

      if (parsed.keyframes) {
        keyframes = cloneKeyframes(parsed.keyframes);
        startSet = Boolean(parsed.startSet);
        endSet = Boolean(parsed.endSet);
      }
    }
  } catch {
    // Ignore invalid saved config.
  }

  syncViewOffsetFromConfig();

  window.__splatConfig = { keyframes, ...config };
  console.log("[SPLAT] Debug mode enabled. Current config:", config);
  console.log("[SPLAT] Debug keyframes:", keyframes);

  let panelApi = null;

  const applyCameraPose = ({ position, lookAt }) => {
    if (!viewer.camera) {
      return;
    }

    viewer.camera.position.set(position[0], position[1], position[2]);
    viewer.camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
    viewer.forceRenderNextFrame?.();
  };

  const updateScrollPreview = () => {
    if (previewProgress === 0) {
      applyPlacement();
      return;
    }

    const { position, lookAt, lookAtProgress } = computeScrollPosition(
      easeScrollProgress(previewProgress),
      keyframes.start,
      keyframes.end,
      config.lookAtTiming ?? 1,
    );

    applyCameraPose({ position, lookAt });
    panelApi?.updatePreviewReadout({ position, lookAt, lookAtProgress }, previewProgress);
    window.__splatConfig = { keyframes, ...config };
  };

  const applyPlacement = () => {
    applyCameraPose({
      position: config.cameraPosition,
      lookAt: config.cameraLookAt,
    });
    window.__splatConfig = { keyframes, ...config };

    if (previewProgress === 0) {
      panelApi?.updatePreviewReadout(
        {
          position: config.cameraPosition,
          lookAt: config.cameraLookAt,
        },
        0,
      );
    } else {
      updateScrollPreview();
    }
  };

  const handleApplyPosition = () => {
    panLookAtWithCamera();
    panelApi?.refreshLookAtInputs();
    applyPlacement();
  };

  const handleApplyLookAt = () => {
    syncViewOffsetFromConfig();
    applyPlacement();
  };

  const handleApplyLookAtTiming = () => {
    if (previewProgress > 0) {
      updateScrollPreview();
    }
    window.__splatConfig = { keyframes, ...config };
  };

  const handleApplyScrollEndAt = () => {
    window.__splatConfig = { keyframes, ...config };
  };

  const handleSetStart = () => {
    const pose = captureCameraPose(viewer, config);
    keyframes.start = cloneKeyframe(pose);
    startSet = true;
    refreshKeyframeUi();
    showToast("Start keyframe set.");
    window.__splatConfig = { keyframes, ...config };

    if (previewProgress > 0) {
      updateScrollPreview();
    }
  };

  const handleSetEnd = () => {
    const pose = captureCameraPose(viewer, config);
    keyframes.end = cloneKeyframe(pose);
    endSet = true;
    refreshKeyframeUi();
    showToast("End keyframe set.");
    window.__splatConfig = { keyframes, ...config };

    if (previewProgress > 0) {
      updateScrollPreview();
    }
  };

  const handleCopy = () => {
    copyConfig(keyframes, config);
  };

  const handleReset = () => {
    previewProgress = 0;
    startSet = false;
    endSet = false;
    Object.assign(config, cloneDefaultConfig(defaults));
    keyframes = cloneKeyframes(defaultKeyframes);
    syncViewOffsetFromConfig();
    applyPlacement();
    panelApi?.resetPreviewControls();
    panelApi?.refreshInputs();
    refreshKeyframeUi();
    showToast("Config reset.");
    console.log("[SPLAT] Config reset:", config);
    console.log("[SPLAT] Keyframes reset:", keyframes);
  };

  const handleSave = () => {
    localStorage.setItem(
      SPLAT_DEBUG_STORAGE_KEY,
      JSON.stringify({
        config,
        keyframes,
        startSet,
        endSet,
      }),
    );
    showToast("Saved to localStorage.");
    console.log("[SPLAT] Config saved:", { config, keyframes, startSet, endSet });
  };

  const handleClear = () => {
    localStorage.removeItem(SPLAT_DEBUG_STORAGE_KEY);
    showToast("Saved config cleared.");
    console.log("[SPLAT] Saved config cleared.");
  };

  const handlePreviewChange = (percent) => {
    previewProgress = percent / 100;

    if (previewProgress === 0) {
      applyPlacement();
    } else {
      updateScrollPreview();
    }
  };

  panelApi = buildDebugPanel({
    config,
    keyframes,
    onApplyPosition: handleApplyPosition,
    onApplyLookAt: handleApplyLookAt,
    onSetStart: handleSetStart,
    onSetEnd: handleSetEnd,
    onApplyLookAtTiming: handleApplyLookAtTiming,
    onApplyScrollEndAt: handleApplyScrollEndAt,
    onCopy: handleCopy,
    onReset: handleReset,
    onSave: handleSave,
    onClear: handleClear,
    onPreviewChange: handlePreviewChange,
  });

  panelApi.refreshInputs();
  refreshKeyframeUi();
  applyPlacement();

  document.addEventListener("keydown", (event) => {
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
      return;
    }

    if (event.key === "c" || event.key === "C") {
      handleCopy();
    }

    if (event.key === "r" || event.key === "R") {
      handleReset();
    }
  });

  const syncLoop = () => {
    viewer.forceRenderNextFrame?.();
    requestAnimationFrame(syncLoop);
  };

  requestAnimationFrame(syncLoop);
};

const cloneStepNoteSplatConfig = (source = STEPNOTE_SPLAT_CONFIG) => ({
  cameraPosition: [...source.cameraPosition],
  cameraLookAt: [...source.cameraLookAt],
  splatPosition: [...source.splatPosition],
  splatScale: source.splatScale,
  alphaThreshold: source.alphaThreshold,
  loopKeyframe: [...source.loopKeyframe],
  spinAxis: [...source.spinAxis],
  rotationOrigin: [...(source.rotationOrigin || [0, 0, 0])],
  orbitStartPercent: source.orbitStartPercent ?? 0,
  orbitEndPercent: source.orbitEndPercent ?? 100,
  pingPong: source.pingPong ?? false,
  loopSeconds: source.loopSeconds,
});

const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;
const radiansToDegrees = (radians) => (radians * 180) / Math.PI;

const quaternionFromEulerDegrees = ([xDegrees, yDegrees, zDegrees]) => {
  const x = degreesToRadians(xDegrees) / 2;
  const y = degreesToRadians(yDegrees) / 2;
  const z = degreesToRadians(zDegrees) / 2;
  const cx = Math.cos(x);
  const sx = Math.sin(x);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cz = Math.cos(z);
  const sz = Math.sin(z);

  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
};

const quaternionFromAxisAngle = (axis, angle) => {
  const length = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const halfAngle = angle / 2;
  const multiplier = Math.sin(halfAngle) / length;

  return [
    axis[0] * multiplier,
    axis[1] * multiplier,
    axis[2] * multiplier,
    Math.cos(halfAngle),
  ];
};

const rotateVectorByQuaternion = ([x, y, z], [qx, qy, qz, qw]) => {
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);

  return [
    x + qw * tx + qy * tz - qz * ty,
    y + qw * ty + qz * tx - qx * tz,
    z + qw * tz + qx * ty - qy * tx,
  ];
};

const rotatePointAroundOrigin = (point, origin, quaternion) => {
  const offset = point.map((value, index) => value - origin[index]);
  const rotatedOffset = rotateVectorByQuaternion(offset, quaternion);

  return origin.map((value, index) => value + rotatedOffset[index]);
};

const eulerDegreesFromQuaternion = ([x, y, z, w]) => {
  const sinXCosY = 2 * (w * x - y * z);
  const cosXCosY = 1 - 2 * (x * x + y * y);
  const sinY = Math.max(-1, Math.min(1, 2 * (w * y + z * x)));
  const sinZCosY = 2 * (w * z - x * y);
  const cosZCosY = 1 - 2 * (y * y + z * z);

  return [
    radiansToDegrees(Math.atan2(sinXCosY, cosXCosY)),
    radiansToDegrees(Math.asin(sinY)),
    radiansToDegrees(Math.atan2(sinZCosY, cosZCosY)),
  ].map((value) => Number(value.toFixed(2)));
};

const formatStepNoteSplatConfig = (config) =>
  `const STEPNOTE_SPLAT_CONFIG = {
  cameraPosition: [${config.cameraPosition.join(", ")}],
  cameraLookAt: [${config.cameraLookAt.join(", ")}],
  splatPosition: [${config.splatPosition.join(", ")}],
  splatScale: ${config.splatScale},
  alphaThreshold: ${config.alphaThreshold},
  loopKeyframe: [${config.loopKeyframe.join(", ")}],
  spinAxis: [${config.spinAxis.join(", ")}],
  rotationOrigin: [${config.rotationOrigin.join(", ")}],
  orbitStartPercent: ${config.orbitStartPercent},
  orbitEndPercent: ${config.orbitEndPercent},
  pingPong: ${config.pingPong},
  loopSeconds: ${config.loopSeconds},
};`;

const injectStepNoteDebugStyles = () => {
  if (document.getElementById("stepnote-splat-debug-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "stepnote-splat-debug-styles";
  style.textContent = `
    #stepnote-splat-debug-panel {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 10000;
      width: min(92vw, 340px);
      max-height: calc(100vh - 32px);
      overflow: auto;
      padding: 14px;
      border: 1px solid rgba(141, 216, 255, 0.35);
      border-radius: 16px;
      color: #e2e8f0;
      background: rgba(4, 8, 20, 0.94);
      backdrop-filter: blur(14px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      font: 500 12px/1.4 Inter, system-ui, sans-serif;
    }
    #stepnote-splat-debug-panel h2,
    #stepnote-splat-debug-panel p { margin-top: 0; }
    #stepnote-splat-debug-panel h2 { margin-bottom: 6px; font-size: 14px; }
    #stepnote-splat-debug-panel .stepnote-debug-caption {
      margin-bottom: 12px;
      color: #64748b;
      font-size: 10px;
      line-height: 1.5;
    }
    #stepnote-splat-debug-panel .stepnote-debug-section {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    #stepnote-splat-debug-panel .stepnote-debug-title {
      margin-bottom: 8px;
      color: #8dd8ff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    #stepnote-splat-debug-panel .stepnote-debug-row {
      display: grid;
      grid-template-columns: 44px 1fr 62px;
      gap: 6px;
      align-items: center;
      margin-bottom: 6px;
    }
    #stepnote-splat-debug-panel label {
      color: #94a3b8;
      font-size: 10px;
      font-weight: 700;
    }
    #stepnote-splat-debug-panel input[type="range"] {
      width: 100%;
      accent-color: #8dd8ff;
    }
    #stepnote-splat-debug-panel input[type="number"] {
      width: 100%;
      padding: 4px 6px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      color: #f8fafc;
      background: rgba(255, 255, 255, 0.06);
      font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #stepnote-splat-debug-panel .stepnote-debug-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    #stepnote-splat-debug-panel button {
      padding: 8px 10px;
      border: 1px solid rgba(141, 216, 255, 0.35);
      border-radius: 10px;
      color: #e2e8f0;
      background: rgba(141, 216, 255, 0.12);
      font: 700 11px/1.2 Inter, system-ui, sans-serif;
      cursor: pointer;
    }
    #stepnote-splat-debug-panel button:hover { background: rgba(141, 216, 255, 0.22); }
    #stepnote-splat-debug-panel .stepnote-debug-wide { grid-column: 1 / -1; }
    #stepnote-splat-debug-panel .stepnote-debug-output {
      margin: 10px 0 0;
      color: #94a3b8;
      font: 600 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: pre-line;
    }
  `;
  document.head.appendChild(style);
};

const buildStepNoteDebugPanel = ({
  config,
  onChange,
  onSetKeyframe,
  onPause,
  onProgressChange,
}) => {
  injectStepNoteDebugStyles();

  const panel = document.createElement("aside");
  panel.id = "stepnote-splat-debug-panel";
  panel.setAttribute("aria-label", "StepNote splat debug controls");
  panel.innerHTML = `
    <h2>StepNote Splat Debug</h2>
    <p class="stepnote-debug-caption">The keyframe sets the splat pose while the camera follows the configured orbit. Tune the live preview, save it in this browser, then copy the config into script.js to make it permanent.</p>
    <div class="stepnote-debug-section" data-debug-section="camera"><p class="stepnote-debug-title">Camera</p><p class="stepnote-debug-caption">px / py / pz pan the camera and aim together. lx / ly / lz change only where the camera looks.</p></div>
    <div class="stepnote-debug-section" data-debug-section="placement"><p class="stepnote-debug-title">Splat placement</p></div>
    <div class="stepnote-debug-section" data-debug-section="rotation"><p class="stepnote-debug-title">Camera orbit</p><p class="stepnote-debug-caption">x° / y° / z° set the splat pose. ax / ay / az set the camera-orbit axis. ox / oy / oz set the world-space orbit origin. Time travels from ${config.orbitStartPercent}% (${(100 + config.orbitStartPercent).toFixed(1)}%) to ${config.orbitEndPercent}% and then reverses. Press Play to preview it.</p></div>
    <div class="stepnote-debug-actions">
      <button type="button" class="stepnote-debug-wide" data-debug-action="keyframe">Set current splat pose</button>
      <button type="button" data-debug-action="pause">Play orbit</button>
      <button type="button" data-debug-action="copy">Copy config</button>
      <button type="button" data-debug-action="save">Save in browser</button>
      <button type="button" data-debug-action="reset">Reset defaults</button>
      <button type="button" data-debug-action="download">Download JSON</button>
      <button type="button" data-debug-action="clear">Clear saved data</button>
    </div>
    <p class="stepnote-debug-output" data-debug-output>Orbit paused</p>
  `;
  document.body.appendChild(panel);

  const fields = [];
  const addField = (sectionName, label, targetKey, index, min, max, step) => {
    const section = panel.querySelector(`[data-debug-section="${sectionName}"]`);
    const row = document.createElement("div");
    row.className = "stepnote-debug-row";
    const id = `stepnote-debug-${targetKey}-${index ?? "value"}`;
    const readValue = () =>
      index === null ? config[targetKey] : config[targetKey][index];
    const writeValue = (value) => {
      if (index === null) {
        config[targetKey] = value;
      } else {
        config[targetKey][index] = value;
      }
    };

    row.innerHTML = `
      <label for="${id}">${label}</label>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${readValue()}">
      <input type="number" min="${min}" max="${max}" step="${step}" value="${readValue()}">
    `;
    const [slider, number] = row.querySelectorAll("input");
    const apply = (value) => {
      const parsed = Number(value);
      const previousValue = readValue();
      slider.value = String(parsed);
      number.value = String(parsed);
      writeValue(parsed);
      onChange({ targetKey, index, previousValue, value: parsed });
    };
    slider.addEventListener("input", () => apply(slider.value));
    number.addEventListener("change", () => apply(number.value));
    section.appendChild(row);
    fields.push({ slider, number, readValue });
  };

  ["x", "y", "z"].forEach((axis, index) => {
    addField("camera", `p${axis}`, "cameraPosition", index, -10, 10, 0.01);
  });
  ["x", "y", "z"].forEach((axis, index) => {
    addField("camera", `l${axis}`, "cameraLookAt", index, -10, 10, 0.01);
  });
  ["x", "y", "z"].forEach((axis, index) => {
    addField("placement", axis, "splatPosition", index, -10, 10, 0.01);
  });
  addField("placement", "scale", "splatScale", null, 0.05, 5, 0.01);
  addField("placement", "alpha", "alphaThreshold", null, 0, 255, 1);
  ["x°", "y°", "z°"].forEach((axis, index) => {
    addField("rotation", axis, "loopKeyframe", index, -180, 180, 1);
  });
  ["ax", "ay", "az"].forEach((axis, index) => {
    addField("rotation", axis, "spinAxis", index, -1, 1, 0.01);
  });
  ["ox", "oy", "oz"].forEach((axis, index) => {
    addField("rotation", axis, "rotationOrigin", index, -10, 10, 0.01);
  });
  addField("rotation", "secs", "loopSeconds", null, 1, 30, 0.25);

  const rotationSection = panel.querySelector('[data-debug-section="rotation"]');
  const timeMin = config.pingPong ? config.orbitStartPercent : 0;
  const timeMax = config.pingPong ? config.orbitEndPercent : 100;
  const progressRow = document.createElement("div");
  progressRow.className = "stepnote-debug-row";
  progressRow.innerHTML = `
    <label for="stepnote-debug-progress">time</label>
    <input id="stepnote-debug-progress" type="range" min="${timeMin}" max="${timeMax}" step="0.1" value="${timeMin}">
    <input type="number" min="${timeMin}" max="${timeMax}" step="0.1" value="${timeMin}" aria-label="Orbit position percent">
  `;
  rotationSection.appendChild(progressRow);
  const [progressSlider, progressNumber] = progressRow.querySelectorAll("input");
  let isScrubbingProgress = false;

  const applyProgress = (percent) => {
    const safePercent = Math.min(timeMax, Math.max(timeMin, Number(percent)));
    progressSlider.value = String(safePercent);
    progressNumber.value = String(Number(safePercent.toFixed(1)));
    onProgressChange(safePercent / 100);
  };

  progressSlider.addEventListener("pointerdown", () => {
    isScrubbingProgress = true;
  });
  window.addEventListener("pointerup", () => {
    isScrubbingProgress = false;
  });
  progressSlider.addEventListener("input", () => applyProgress(progressSlider.value));
  progressNumber.addEventListener("change", () => applyProgress(progressNumber.value));

  const refresh = () => {
    fields.forEach(({ slider, number, readValue }) => {
      const value = readValue();
      slider.value = String(value);
      number.value = String(value);
    });
  };

  const output = panel.querySelector("[data-debug-output]");
  const pauseButton = panel.querySelector('[data-debug-action="pause"]');
  let paused = true;

  panel.querySelector('[data-debug-action="keyframe"]').addEventListener("click", () => {
    onSetKeyframe();
    refresh();
    showToast("Splat pose captured.");
  });
  pauseButton.addEventListener("click", () => {
    paused = !paused;
    pauseButton.textContent = paused ? "Play orbit" : "Pause orbit";
    onPause(paused);
  });
  panel.querySelector('[data-debug-action="copy"]').addEventListener("click", async () => {
    const snippet = formatStepNoteSplatConfig(config);
    try {
      await navigator.clipboard.writeText(snippet);
      showToast("StepNote config copied.");
    } catch {
      console.log("[STEPNOTE SPLAT] Config:\n", snippet);
      showToast("Copy failed — config is in the console.");
    }
  });
  panel.querySelector('[data-debug-action="save"]').addEventListener("click", () => {
    localStorage.setItem(STEPNOTE_SPLAT_DEBUG_STORAGE_KEY, JSON.stringify(config));
    showToast("StepNote config saved in this browser.");
  });
  panel.querySelector('[data-debug-action="reset"]').addEventListener("click", () => {
    Object.assign(config, cloneStepNoteSplatConfig());
    refresh();
    onChange();
    showToast("StepNote config reset.");
  });
  panel.querySelector('[data-debug-action="download"]').addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stepnote-splat-config.json";
    link.click();
    URL.revokeObjectURL(url);
  });
  panel.querySelector('[data-debug-action="clear"]').addEventListener("click", () => {
    localStorage.removeItem(STEPNOTE_SPLAT_DEBUG_STORAGE_KEY);
    showToast("Saved StepNote config cleared.");
  });

  return {
    refresh,
    updateProgress(progress, cameraPose, playback = {}) {
      const percent = progress * 100;
      const normalizedPercent = ((percent % 100) + 100) % 100;
      const span = Math.max(0.0001, config.orbitEndPercent - config.orbitStartPercent);
      const legProgress = playback.legProgress ??
        Math.min(1, Math.max(0, (percent - config.orbitStartPercent) / span));
      const currentSeconds = legProgress * config.loopSeconds;

      if (
        !isScrubbingProgress &&
        document.activeElement !== progressNumber
      ) {
        progressSlider.value = String(percent);
        progressNumber.value = String(Number(percent.toFixed(1)));
      }

      output.textContent =
        `Orbit: ${percent.toFixed(1)}% (${normalizedPercent.toFixed(1)}%) · ` +
        `${currentSeconds.toFixed(2)}s / ${config.loopSeconds.toFixed(2)}s one way` +
        (playback.direction ? ` · ${playback.direction}` : " · paused") +
        (cameraPose
          ? `\ncam ${formatVec3(cameraPose.position)}` +
            `\naim ${formatVec3(cameraPose.lookAt)}`
          : "");
    },
  };
};

const initStepNoteSplat = async () => {
  const stage = document.querySelector("#stepnote-splat-stage");
  const container = document.querySelector("#stepnote-splat-viewer");
  const status = document.querySelector("#stepnote-splat-status");

  if (!stage || !container || stage.dataset.initialized === "true") {
    return;
  }

  stage.dataset.initialized = "true";
  stage.classList.remove("has-error");
  stage.classList.add("is-loading");
  status.hidden = false;
  status.textContent = "Loading StepNote 3D preview…";

  const splatUrl =
    (DEBUG_STEPNOTE_SPLAT && DEBUG_STEPNOTE_SPLAT_ASSET) || stage.dataset.splatSrc;

  try {
    const assetResponse = await fetch(splatUrl, {
      method: "HEAD",
      cache: "no-store",
    });

    if (!assetResponse.ok) {
      throw new Error(`StepNote splat asset returned ${assetResponse.status}.`);
    }

    const GaussianSplats3D = await import(SPLAT_RENDERER_URL);
    const isMobile = window.matchMedia("(max-width: 700px)").matches;
    let config = cloneStepNoteSplatConfig();

    if (DEBUG_STEPNOTE_SPLAT) {
      try {
        const saved = JSON.parse(
          localStorage.getItem(STEPNOTE_SPLAT_DEBUG_STORAGE_KEY) || "null",
        );
        if (saved) {
          config = cloneStepNoteSplatConfig({ ...STEPNOTE_SPLAT_CONFIG, ...saved });
        }
      } catch {
        // Ignore incomplete or invalid browser-saved calibration data.
      }
    }

    const initialRotation = quaternionFromEulerDegrees(config.loopKeyframe);
    const viewer = new GaussianSplats3D.Viewer({
      rootElement: container,
      cameraUp: [0, -1, 0],
      initialCameraPosition: [...config.cameraPosition],
      initialCameraLookAt: [...config.cameraLookAt],
      useBuiltInControls: false,
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
      dynamicScene: true,
      ignoreDevicePixelRatio: isMobile,
      sphericalHarmonicsDegree: 2,
      renderMode: GaussianSplats3D.RenderMode.OnChange,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
      webXRMode: GaussianSplats3D.WebXRMode.None,
    });
    const sceneOptions = {
      progressiveLoad: true,
      showLoadingUI: false,
      splatAlphaRemovalThreshold: config.alphaThreshold,
      scale: [config.splatScale, config.splatScale, config.splatScale],
      position: [...config.splatPosition],
      rotation: initialRotation,
    };

    if (splatUrl.toLowerCase().includes(".ksplat")) {
      sceneOptions.format = GaussianSplats3D.SceneFormat.KSplat;
    } else if (splatUrl.toLowerCase().includes(".ply")) {
      sceneOptions.format = GaussianSplats3D.SceneFormat.Ply;
    }

    await viewer.addSplatScene(splatUrl, sceneOptions);
    viewer.start();
    const scene = viewer.getSplatScene(0);
    stage.classList.remove("is-loading");
    status.hidden = true;

    if (viewer.threeRenderer) {
      viewer.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    let paused = DEBUG_STEPNOTE_SPLAT || stage.dataset.playbackPaused === "true";
    let playbackPhase = 0;
    const orbitStart = () => config.orbitStartPercent / 100;
    const orbitEnd = () => config.orbitEndPercent / 100;
    const progressFromPhase = (phase) => {
      if (!config.pingPong) return phase % 1;
      const legProgress = phase <= 1 ? phase : 2 - phase;
      const easedProgress = easeOrbitPingPong(legProgress);
      return orbitStart() + (orbitEnd() - orbitStart()) * easedProgress;
    };
    let pausedProgress = progressFromPhase(playbackPhase);
    let loopStart = performance.now();
    let currentQuaternion = initialRotation;
    let debugPanel = null;

    stage.addEventListener("stepnote-playback-change", (event) => {
      paused = Boolean(event.detail?.paused);
      if (!paused) {
        loopStart = performance.now() - playbackPhase * config.loopSeconds * 1000;
      }
    });

    const applyLoopTransform = (progress) => {
      const baseRotation = quaternionFromEulerDegrees(config.loopKeyframe);
      const orbitRotation = quaternionFromAxisAngle(
        config.spinAxis,
        progress * Math.PI * 2,
      );
      currentQuaternion = baseRotation;

      scene.position.set(...config.splatPosition);
      scene.quaternion.set(...currentQuaternion);
      scene.updateMatrixWorld(true);
      viewer.getSplatMesh?.()?.updateTransforms();

      const cameraPosition = rotatePointAroundOrigin(
        config.cameraPosition,
        config.rotationOrigin,
        orbitRotation,
      );
      const cameraLookAt = rotatePointAroundOrigin(
        config.cameraLookAt,
        config.rotationOrigin,
        orbitRotation,
      );
      viewer.camera?.position.set(...cameraPosition);
      viewer.camera?.lookAt(...cameraLookAt);
      viewer.forceRenderNextFrame?.();

      return { position: cameraPosition, lookAt: cameraLookAt };
    };

    const applyConfig = () => {
      scene.scale.set(config.splatScale, config.splatScale, config.splatScale);
      scene.minimumAlpha = config.alphaThreshold;
      pausedProgress = progressFromPhase(playbackPhase);
      loopStart = performance.now() - playbackPhase * config.loopSeconds * 1000;
      const cameraPose = applyLoopTransform(pausedProgress);
      window.__stepNoteSplatConfig = cloneStepNoteSplatConfig(config);
      debugPanel?.updateProgress(pausedProgress, cameraPose, {
        legProgress: playbackPhase <= 1 ? playbackPhase : 2 - playbackPhase,
      });
    };

    const applyDebugChange = (change) => {
      if (change?.targetKey === "cameraPosition" && change.index !== null) {
        config.cameraLookAt[change.index] += change.value - change.previousValue;
        debugPanel?.refresh();
      }

      applyConfig();
    };

    if (DEBUG_STEPNOTE_SPLAT) {
      debugPanel = buildStepNoteDebugPanel({
        config,
        onChange: applyDebugChange,
        onSetKeyframe: () => {
          config.loopKeyframe = eulerDegreesFromQuaternion(currentQuaternion);
          playbackPhase = 0;
          pausedProgress = progressFromPhase(playbackPhase);
          loopStart = performance.now();
          applyConfig();
        },
        onPause: (shouldPause) => {
          paused = shouldPause;
          if (!paused) {
            loopStart = performance.now() - playbackPhase * config.loopSeconds * 1000;
          }
        },
        onProgressChange: (progress) => {
          pausedProgress = Math.min(orbitEnd(), Math.max(orbitStart(), progress));
          const orbitSpan = Math.max(0.0001, orbitEnd() - orbitStart());
          const easedProgress = (pausedProgress - orbitStart()) / orbitSpan;
          playbackPhase = inverseOrbitEase(easedProgress);
          loopStart = performance.now() - playbackPhase * config.loopSeconds * 1000;
          const cameraPose = applyLoopTransform(pausedProgress);
          debugPanel?.updateProgress(pausedProgress, cameraPose, {
            legProgress: playbackPhase,
          });
        },
      });
      window.__stepNoteSplatConfig = cloneStepNoteSplatConfig(config);
      console.log("[STEPNOTE SPLAT] Debug mode enabled:", config);
    }

    const animate = (time) => {
      const details = document.querySelector("#stepnote-project-details");
      const inView = stage.getBoundingClientRect().bottom > 0 &&
        stage.getBoundingClientRect().top < window.innerHeight;
      const shouldUpdateLoop = DEBUG_STEPNOTE_SPLAT || inView;

      if (!document.hidden && !details?.hidden && shouldUpdateLoop) {
        const durationMs = Math.max(1, config.loopSeconds) * 1000;
        if (!paused) {
          const cycleLegs = config.pingPong ? 2 : 1;
          playbackPhase = ((time - loopStart) / durationMs) % cycleLegs;
        }
        const progress = paused ? pausedProgress : progressFromPhase(playbackPhase);
        pausedProgress = progress;
        stage.dataset.orbitProgress = progress.toFixed(6);
        const cameraPose = applyLoopTransform(progress);
        const legProgress = config.pingPong
          ? (playbackPhase <= 1 ? playbackPhase : 2 - playbackPhase)
          : playbackPhase;
        debugPanel?.updateProgress(progress, cameraPose, {
          legProgress,
          direction: paused ? null : playbackPhase <= 1 ? "forward" : "reverse",
        });
      }

      requestAnimationFrame(animate);
    };

    applyConfig();
    requestAnimationFrame(animate);
  } catch (error) {
    stage.dataset.initialized = "false";
    stage.classList.remove("is-loading");
    stage.classList.add("has-error");
    status.textContent = "Add /splats/StepNote.ksplat to activate this rotating preview";
    console.info("[STEPNOTE SPLAT] Waiting for StepNote.ksplat:", error);
  }
};

const initStepNoteProject = () => {
  const toggle = document.querySelector(".stepnote-project-toggle");
  const playbackToggle = document.querySelector(".stepnote-splat-playback-toggle");
  const details = document.querySelector("#stepnote-project-details");
  const stage = document.querySelector("#stepnote-splat-stage");

  if (!toggle || !playbackToggle || !details || !stage) {
    return;
  }

  const setPlaybackPaused = (paused) => {
    stage.dataset.playbackPaused = String(paused);
    playbackToggle.classList.toggle("is-paused", paused);
    playbackToggle.setAttribute("aria-pressed", String(paused));
    playbackToggle.setAttribute(
      "aria-label",
      paused ? "Resume StepNote animation" : "Pause StepNote animation",
    );
    stage.dispatchEvent(new CustomEvent("stepnote-playback-change", {
      detail: { paused },
    }));
  };

  const setExpanded = (expanded) => {
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.closest(".stepnote-project")?.classList.toggle("is-expanded", expanded);
    details.hidden = !expanded;
    stage.hidden = !expanded;

    if (expanded) {
      initStepNoteSplat();
    }
  };

  toggle.addEventListener("click", () => {
    setExpanded(toggle.getAttribute("aria-expanded") !== "true");
  });

  playbackToggle.addEventListener("click", () => {
    setPlaybackPaused(playbackToggle.getAttribute("aria-pressed") !== "true");
  });

  if (DEBUG_STEPNOTE_SPLAT) {
    setExpanded(true);
  }
};

const initHeroScrollTransition = () => {
  const hero = document.querySelector(".hero");
  const heroCopy = document.querySelector(".hero-copy");
  const heroToc = document.querySelector(".hero-toc");
  const siteHeader = document.querySelector(".site-header");

  if (!hero || !heroCopy || !heroToc) {
    return;
  }

  const COPY_FADE_START = 0.34;
  const COPY_FADE_END = 0.47;
  const TOC_FADE_START = 0.48;
  const TOC_FADE_END = 0.61;

  const smoothstep = (value) => {
    const t = Math.min(1, Math.max(0, value));

    return t * t * (3 - 2 * t);
  };

  const fadeBetween = (progress, start, end) =>
    smoothstep((progress - start) / (end - start));

  let ticking = false;

  const update = () => {
    ticking = false;
    const progress = getScrollProgress();
    const copyOpacity = 1 - fadeBetween(progress, COPY_FADE_START, COPY_FADE_END);
    const tocOpacity = fadeBetween(progress, TOC_FADE_START, TOC_FADE_END);

    hero.style.setProperty("--hero-copy-opacity", String(copyOpacity));
    hero.style.setProperty("--hero-toc-opacity", String(tocOpacity));
    hero.style.setProperty("--hero-toc-shift", `${(1 - tocOpacity) * 16}px`);
    hero.style.setProperty("--splat-panel", String(tocOpacity));

    heroCopy.style.pointerEvents = copyOpacity > 0.4 ? "auto" : "none";
    heroToc.style.pointerEvents = tocOpacity > 0.4 ? "auto" : "none";
    heroToc.setAttribute("aria-hidden", tocOpacity < 0.5 ? "true" : "false");

    if (siteHeader) {
      const pastSplat = progress >= 1;
      siteHeader.classList.toggle("is-visible", pastSplat);
      siteHeader.setAttribute("aria-hidden", pastSplat ? "false" : "true");
    }
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
};

const initAsciiCurtain = () => {
  const canvas = document.querySelector("#ascii-curtain");

  if (!canvas || !heroScrollTrack) {
    return;
  }

  const context = canvas.getContext("2d");
  const glyphs = "#@%+=*:.";
  let width = 0;
  let documentHeight = 0;
  let cellWidth = 15;
  let cellHeight = 18;
  const backgroundGlyphColor = "#292929";
  let overlayStart = 0;
  let splatPixels = null;
  let resumePixels = null;
  let terminalPixels = null;
  let splatRect = null;
  let resumeRect = null;
  let terminalRect = null;
  let surfaceColorRegions = [];
  let foregroundColorRegions = [];
  let liveSplatCaptured = false;
  let liveSplatCapturePending = false;

  const noise = (column, row) => {
    const value = Math.sin(column * 91.73 + row * 17.17) * 43758.5453;

    return value - Math.floor(value);
  };

  const loadPixels = async (source) => {
    if (!source) {
      return null;
    }

    const image = new Image();
    image.src = source;
    await image.decode();

    const buffer = document.createElement("canvas");
    const bufferContext = buffer.getContext("2d", { willReadFrequently: true });
    buffer.width = image.naturalWidth;
    buffer.height = image.naturalHeight;
    bufferContext.drawImage(image, 0, 0);

    return {
      width: buffer.width,
      height: buffer.height,
      data: bufferContext.getImageData(0, 0, buffer.width, buffer.height).data,
    };
  };

  const captureLiveSplatPixels = () => {
    liveSplatCapturePending = false;

    if (liveSplatCaptured) {
      return;
    }

    const source = document.querySelector("#splat-viewer canvas");

    if (!source || source.width <= 0 || source.height <= 0) {
      return;
    }

    try {
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / source.width);
      const buffer = document.createElement("canvas");
      const bufferContext = buffer.getContext("2d", { willReadFrequently: true });
      buffer.width = Math.max(1, Math.round(source.width * scale));
      buffer.height = Math.max(1, Math.round(source.height * scale));
      bufferContext.drawImage(source, 0, 0, buffer.width, buffer.height);

      const imageData = bufferContext.getImageData(
        0,
        0,
        buffer.width,
        buffer.height,
      );
      let darkest = 255;
      let lightest = 0;
      let visibleSamples = 0;
      const sampleStride = Math.max(4, Math.floor(imageData.data.length / 1600 / 4) * 4);

      for (let index = 0; index < imageData.data.length; index += sampleStride) {
        if (imageData.data[index + 3] < 8) {
          continue;
        }

        const brightness =
          (imageData.data[index] +
            imageData.data[index + 1] +
            imageData.data[index + 2]) /
          3;
        darkest = Math.min(darkest, brightness);
        lightest = Math.max(lightest, brightness);
        visibleSamples += 1;
      }

      if (visibleSamples < 20 || lightest - darkest < 12) {
        return;
      }

      splatPixels = {
        width: buffer.width,
        height: buffer.height,
        data: imageData.data,
      };
      liveSplatCaptured = true;
      draw();
    } catch (error) {
      console.warn("[ASCII] Live splat sampling unavailable:", error);
    }
  };

  const requestLiveSplatCapture = () => {
    if (liveSplatCaptured || liveSplatCapturePending) {
      return;
    }

    liveSplatCapturePending = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(captureLiveSplatPixels);
    });
  };

  const getDocumentRect = (element) => {
    if (!element) {
      return null;
    }

    const rect = element.getBoundingClientRect();

    return {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  };

  const getSamplingRect = (element) => {
    const terminal = element?.closest?.(".terminal-window");

    if (!terminal) {
      return getDocumentRect(element);
    }

    const terminalRect = terminal.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const projectedTerminalLeft = (width - terminalRect.width) / 2;
    const projectedTerminalTop =
      overlayStart + (window.innerHeight - terminalRect.height) / 2;

    return {
      left: projectedTerminalLeft + elementRect.left - terminalRect.left,
      top: projectedTerminalTop + elementRect.top - terminalRect.top,
      width: elementRect.width,
      height: elementRect.height,
    };
  };

  const readPixel = (asset, x, y) => {
    const pixelX = Math.max(0, Math.min(asset.width - 1, Math.round(x)));
    const pixelY = Math.max(0, Math.min(asset.height - 1, Math.round(y)));
    const index = (pixelY * asset.width + pixelX) * 4;

    return `rgb(${asset.data[index]}, ${asset.data[index + 1]}, ${asset.data[index + 2]})`;
  };

  const blendColor = (color, backdrop = [17, 17, 17]) => {
    const channels = color.match(/[\d.]+/g)?.map(Number);

    if (!channels || channels.length < 3) {
      return color;
    }

    const alpha = channels.length > 3 ? channels[3] : 1;
    const blended = channels.slice(0, 3).map((channel, index) =>
      Math.round(channel * alpha + backdrop[index] * (1 - alpha)),
    );

    return `rgb(${blended[0]}, ${blended[1]}, ${blended[2]})`;
  };

  const buildColorRegions = () => {
    const surfaceSelectors = [
      ".terminal-window",
      ".terminal-titlebar",
      ".terminal-body",
      ".terminal-dot--close",
      ".terminal-dot--minimize",
      ".terminal-dot--maximize",
      ".resume-item",
      ".project-card",
      ".project-list-card",
      ".resume-panel",
      ".button",
      ".brand-mark",
    ];
    const foregroundSelector = [
      "h1",
      "h2",
      "h3",
      ".section-title",
      ".subsection-title",
      ".eyebrow",
      ".terminal-title",
      ".nav-links a",
      ".hero-toc-list a",
      ".button",
      "p",
      "li",
    ].join(",");

    surfaceColorRegions = surfaceSelectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)].flatMap((element) => {
        if (element.closest(".hero")) {
          return [];
        }

        const rect = getSamplingRect(element);
        const style = getComputedStyle(element);
        const surfaceColor = element.matches(".terminal-titlebar")
          ? "rgb(241, 241, 241)"
          : style.backgroundColor;

        if (
          !rect ||
          rect.width <= 0 ||
          rect.height <= 0 ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          surfaceColor === "rgba(0, 0, 0, 0)"
        ) {
          return [];
        }

        return [{ ...rect, color: blendColor(surfaceColor) }];
      }),
    );

    foregroundColorRegions = [...document.querySelectorAll(foregroundSelector)].flatMap(
      (element) => {
        if (element.closest(".hero")) {
          return [];
        }

        const rect = getSamplingRect(element);
        const style = getComputedStyle(element);

        if (
          !rect ||
          rect.width <= 0 ||
          rect.height <= 0 ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0
        ) {
          return [];
        }

        return [{ ...rect, color: blendColor(style.color) }];
      },
    );
  };

  const sampleColorRegion = (regions, x, y) => {
    for (let index = regions.length - 1; index >= 0; index -= 1) {
      const region = regions[index];

      if (
        x >= region.left &&
        x <= region.left + region.width &&
        y >= region.top &&
        y <= region.top + region.height
      ) {
        return region.color;
      }
    }

    return null;
  };

  const sampleRegion = (asset, rect, x, y, fit = "stretch") => {
    if (
      !asset ||
      !rect ||
      x < rect.left ||
      x > rect.left + rect.width ||
      y < rect.top ||
      y > rect.top + rect.height
    ) {
      return null;
    }

    if (fit === "cover") {
      const scale = Math.max(rect.width / asset.width, rect.height / asset.height);
      const drawnWidth = asset.width * scale;
      const drawnHeight = asset.height * scale;
      const sourceX = (x - rect.left + (drawnWidth - rect.width) / 2) / scale;
      const sourceY = (y - rect.top + (drawnHeight - rect.height) / 2) / scale;

      return readPixel(asset, sourceX, sourceY);
    }

    return readPixel(
      asset,
      ((x - rect.left) / rect.width) * asset.width,
      ((y - rect.top) / rect.height) * asset.height,
    );
  };

  const renderTerminalPixels = () => {
    const terminal = document.querySelector(".terminal-window");

    if (!terminal) {
      terminalPixels = null;
      terminalRect = null;
      return;
    }

    const sourceRect = terminal.getBoundingClientRect();
    const scale = 2;
    const buffer = document.createElement("canvas");
    const bufferContext = buffer.getContext("2d", { willReadFrequently: true });
    const titlebar = terminal.querySelector(".terminal-titlebar");
    const titlebarRect = titlebar.getBoundingClientRect();

    buffer.width = Math.max(1, Math.round(sourceRect.width * scale));
    buffer.height = Math.max(1, Math.round(sourceRect.height * scale));
    bufferContext.scale(scale, scale);
    bufferContext.save();
    bufferContext.beginPath();
    bufferContext.roundRect(0, 0, sourceRect.width, sourceRect.height, 10);
    bufferContext.clip();
    bufferContext.fillStyle = "#0a0a0a";
    bufferContext.fillRect(0, 0, sourceRect.width, sourceRect.height);

    const titleGradient = bufferContext.createLinearGradient(
      0,
      titlebarRect.top - sourceRect.top,
      0,
      titlebarRect.bottom - sourceRect.top,
    );
    titleGradient.addColorStop(0, "#f5f5f5");
    titleGradient.addColorStop(1, "#ececec");
    bufferContext.fillStyle = titleGradient;
    bufferContext.fillRect(
      titlebarRect.left - sourceRect.left,
      titlebarRect.top - sourceRect.top,
      titlebarRect.width,
      titlebarRect.height,
    );

    terminal.querySelectorAll(".terminal-dot").forEach((dot) => {
      const rect = dot.getBoundingClientRect();
      const style = getComputedStyle(dot);
      const centerX = rect.left - sourceRect.left + rect.width / 2;
      const centerY = rect.top - sourceRect.top + rect.height / 2;

      bufferContext.beginPath();
      bufferContext.arc(centerX, centerY, rect.width / 2, 0, Math.PI * 2);
      bufferContext.fillStyle = style.backgroundColor;
      bufferContext.fill();
    });

    terminal.querySelectorAll(".hero-toc-list li:not(:last-child)").forEach((item) => {
      const rect = item.getBoundingClientRect();
      bufferContext.fillStyle = "rgba(255, 255, 255, 0.08)";
      bufferContext.fillRect(
        rect.left - sourceRect.left,
        rect.bottom - sourceRect.top - 1,
        rect.width,
        1,
      );
    });

    const walker = document.createTreeWalker(terminal, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();

    while (textNode) {
      const text = textNode.nodeValue.replace(/\s+/g, " ").trim();
      const parent = textNode.parentElement;

      if (text && parent) {
        const range = document.createRange();
        range.selectNodeContents(textNode);
        const rect = range.getBoundingClientRect();
        const style = getComputedStyle(parent);

        if (rect.width > 0 && rect.height > 0 && style.visibility !== "hidden") {
          bufferContext.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          bufferContext.textBaseline = "top";
          bufferContext.fillStyle = style.color;
          bufferContext.fillText(
            text,
            rect.left - sourceRect.left,
            rect.top - sourceRect.top,
          );
        }
      }

      textNode = walker.nextNode();
    }

    bufferContext.restore();
    bufferContext.strokeStyle = "rgba(255, 255, 255, 0.12)";
    bufferContext.lineWidth = 1;
    bufferContext.beginPath();
    bufferContext.roundRect(0.5, 0.5, sourceRect.width - 1, sourceRect.height - 1, 10);
    bufferContext.stroke();

    terminalPixels = {
      width: buffer.width,
      height: buffer.height,
      data: bufferContext.getImageData(0, 0, buffer.width, buffer.height).data,
    };
    terminalRect = {
      left: (width - sourceRect.width) / 2,
      top: overlayStart + (window.innerHeight - sourceRect.height) / 2,
      width: sourceRect.width,
      height: sourceRect.height,
    };
  };

  const sampleColor = (x, y) =>
    sampleRegion(terminalPixels, terminalRect, x, y) ||
    sampleColorRegion(foregroundColorRegions, x, y) ||
    sampleRegion(resumePixels, resumeRect, x, y) ||
    sampleColorRegion(surfaceColorRegions, x, y) ||
    sampleRegion(splatPixels, splatRect, x, y, "cover") ||
    backgroundGlyphColor;

  const updateTransitionOpacity = () => {
    const fadeStart = overlayStart + window.innerHeight * 0.08;
    const fadeEnd = overlayStart + window.innerHeight * 0.42;
    const linearProgress = Math.min(
      1,
      Math.max(0, (window.scrollY - fadeStart) / (fadeEnd - fadeStart)),
    );
    const easedProgress =
      linearProgress * linearProgress * (3 - 2 * linearProgress);

    canvas.style.opacity = easedProgress.toFixed(3);
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    documentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    cellWidth = width < 560 ? 12 : 15;
    cellHeight = width < 560 ? 15 : 18;
    context.font = `700 ${cellHeight}px "JetBrains Mono", monospace`;
    context.textBaseline = "top";
    overlayStart = getHeroTrackEndScrollY();
    splatRect = {
      left: 0,
      top: overlayStart,
      width,
      height: window.innerHeight,
    };
    resumeRect = getDocumentRect(document.querySelector(".resume-preview img"));
    renderTerminalPixels();
    buildColorRegions();

    updateTransitionOpacity();
  };

  const draw = () => {
    context.clearRect(0, 0, width, window.innerHeight);

    if (window.scrollY + window.innerHeight < overlayStart) {
      return;
    }

    const columns = Math.ceil(width / cellWidth) + 1;
    const viewportMaskTop = Math.max(
      overlayStart,
      window.scrollY + window.innerHeight * 0.05,
    );
    const maskNoisePosition = viewportMaskTop / cellHeight;
    const noiseFrame = Math.floor(maskNoisePosition);
    const noiseMix = maskNoisePosition - noiseFrame;
    const firstDocumentRow = Math.max(
      Math.floor(overlayStart / cellHeight),
      Math.floor(window.scrollY / cellHeight),
    );

    for (let column = 0; column < columns; column += 1) {
      const movingNoise =
        noise(column, noiseFrame + 3) * (1 - noiseMix) +
        noise(column, noiseFrame + 4) * noiseMix;
      const wave =
        Math.sin(column * 0.72 + maskNoisePosition * 0.11) * cellHeight * 1.5 +
        Math.sin(column * 0.19 - maskNoisePosition * 0.07) * cellHeight * 1.1 +
        (movingNoise - 0.5) * cellHeight * 3.4;
      const edge = Math.max(overlayStart, viewportMaskTop + wave);
      const endRow = Math.ceil((edge + cellHeight * 2.5) / cellHeight);
      const edgeOnScreen = edge - window.scrollY;

      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.fillStyle = "rgba(17, 17, 17, 0.88)";
      context.fillRect(
        column * cellWidth,
        0,
        cellWidth + 1,
        Math.max(0, edgeOnScreen + cellHeight * 1.5),
      );

      for (let row = firstDocumentRow; row < endRow; row += 1) {
        const documentY = row * cellHeight;
        const screenY = documentY - window.scrollY;
        const depth = edge - documentY;

        if (depth < -cellHeight * 2.5) {
          continue;
        }

        const random = noise(column, row);
        const edgeFade = Math.min(
          1,
          Math.max(0, (depth + cellHeight * 2.5) / (cellHeight * 5)),
        );
        const density = 0.3 + edgeFade * 0.7;

        if (random > density) {
          continue;
        }

        const glyphIndex = Math.floor(noise(row + 11, column + 7) * glyphs.length);
        const sampleX =
          column * cellWidth + noise(column + 31, row + 41) * cellWidth;
        const sampleY =
          documentY + noise(column + 53, row + 61) * cellHeight;
        context.globalAlpha = edgeFade;
        context.fillStyle = sampleColor(sampleX, sampleY);
        context.fillText(glyphs[glyphIndex], column * cellWidth, screenY);
      }
    }

    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
  };

  const handleScroll = () => {
    if (window.scrollY >= overlayStart - window.innerHeight * 0.12) {
      requestLiveSplatCapture();
    }

    updateTransitionOpacity();
    draw();
  };

  const handleResize = () => {
    resize();
    draw();
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  Promise.all([
    loadPixels("/splats/Color.png"),
    loadPixels(document.querySelector(".resume-preview img")?.currentSrc),
  ])
    .then(([loadedSplatPixels, loadedResumePixels]) => {
      splatPixels = loadedSplatPixels;
      resumePixels = loadedResumePixels;
    })
    .catch((error) => {
      console.warn("[ASCII] Pixel sampling fallback active:", error);
    })
    .finally(() => {
      resize();
      draw();
    });
};

const initHeroMotion = () => {
  const motionTargets = [
    { element: document.querySelector(".hero-copy"), phase: 0, float: 3, tilt: 8 },
    { element: document.querySelector(".hero-toc"), phase: 1.4, float: 2, tilt: 6 },
  ].filter(({ element }) => element);

  if (
    motionTargets.length === 0 ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  motionTargets.forEach(({ element, tilt }) => {
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      element.style.setProperty("--tilt-x", `${(-y * tilt).toFixed(2)}deg`);
      element.style.setProperty("--tilt-y", `${(x * tilt).toFixed(2)}deg`);
    });

    element.addEventListener("pointerleave", () => {
      element.style.setProperty("--tilt-x", "0deg");
      element.style.setProperty("--tilt-y", "0deg");
    });
  });

  const floatLoop = (time) => {
    const seconds = time / 1000;

    motionTargets.forEach(({ element, phase, float }) => {
      const y = Math.sin(seconds * 0.75 + phase) * float;
      const rotate = Math.cos(seconds * 0.55 + phase) * 0.18;

      element.style.setProperty("--float-y", `${y.toFixed(2)}px`);
      element.style.setProperty("--float-rotate", `${rotate.toFixed(3)}deg`);
    });

    requestAnimationFrame(floatLoop);
  };

  requestAnimationFrame(floatLoop);
};

initHeroScrollTransition();
initAsciiCurtain();
initHeroActionLinks();
initHeroMotion();
initGridCursorGlow();
initStepNoteProject();
initSplat();
