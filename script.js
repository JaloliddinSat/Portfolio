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

const DEBUG_SPLAT = new URLSearchParams(window.location.search).has("debugSplat");

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
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let cellWidth = 15;
  let cellHeight = 18;
  let backgroundColor = "#111111";
  let currentOpacity = 0;
  let currentReveal = 0;
  let frameId = 0;

  const noise = (column, row) => {
    const value = Math.sin(column * 91.73 + row * 17.17) * 43758.5453;

    return value - Math.floor(value);
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    cellWidth = width < 560 ? 12 : 15;
    cellHeight = width < 560 ? 15 : 18;
    context.font = `700 ${cellHeight}px "JetBrains Mono", monospace`;
    context.textBaseline = "top";
    backgroundColor =
      getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() ||
      "#111111";
  };

  const draw = (time = 0) => {
    context.clearRect(0, 0, width, height);

    const columns = Math.ceil(width / cellWidth) + 1;
    const fullEdge = Math.min(height * 0.38, 300);
    const baseEdge = fullEdge * currentReveal - cellHeight * 3;
    const rows = Math.ceil(height / cellHeight) + 1;
    const phase = time * 0.00115;
    const noisePhase = phase * 2.4;
    const noiseFrame = Math.floor(noisePhase);
    const noiseMix = noisePhase - noiseFrame;

    for (let column = 0; column < columns; column += 1) {
      const movingNoise =
        noise(column, noiseFrame + 3) * (1 - noiseMix) +
        noise(column, noiseFrame + 4) * noiseMix;
      const wave =
        Math.sin(column * 0.72 + phase) * cellHeight * 1.5 +
        Math.sin(column * 0.19 - phase * 0.7) * cellHeight * 1.1 +
        (movingNoise - 0.5) * cellHeight * 3.4;
      const edge = baseEdge + wave;

      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.fillStyle = backgroundColor;
      context.fillRect(
        column * cellWidth,
        0,
        cellWidth + 1,
        Math.max(0, edge + cellHeight * 1.5),
      );

      context.globalCompositeOperation = "destination-out";

      for (let row = 0; row < rows; row += 1) {
        const y = row * cellHeight;
        const depth = edge - y;

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
        context.globalAlpha = edgeFade;
        context.fillStyle = "#000000";
        context.fillText(glyphs[glyphIndex], column * cellWidth, y);
      }
    }

    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
  };

  const animate = (time) => {
    frameId = 0;
    const targetOpacity = window.scrollY >= getHeroTrackEndScrollY() ? 1 : 0;
    const opacityEase = targetOpacity > currentOpacity ? 0.16 : 0.075;
    const revealEase = targetOpacity > currentReveal ? 0.085 : 0.055;

    currentOpacity += (targetOpacity - currentOpacity) * opacityEase;
    currentReveal += (targetOpacity - currentReveal) * revealEase;

    if (reducedMotion.matches) {
      currentOpacity = targetOpacity;
      currentReveal = targetOpacity;
    }

    draw(time);
    canvas.style.opacity = currentOpacity.toFixed(3);

    if (
      Math.abs(targetOpacity - currentOpacity) > 0.002 ||
      Math.abs(targetOpacity - currentReveal) > 0.002 ||
      (targetOpacity > 0 && !reducedMotion.matches)
    ) {
      frameId = requestAnimationFrame(animate);
    }
  };

  const requestAnimation = () => {
    if (!frameId) {
      frameId = requestAnimationFrame(animate);
    }
  };

  const handleScroll = () => {
    requestAnimation();
  };

  const handleResize = () => {
    resize();
    requestAnimation();
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  resize();
  requestAnimation();
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
initSplat();
