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

  const panelSelector = ".resume-item, .project-card, .contact-card";
  const panels = document.querySelectorAll(panelSelector);
  const cursorGlow = document.createElement("canvas");
  const glowRadius = 100;
  const glowSize = glowRadius * 2;
  const gridSize = 56;
  let pointerClientX = -200;
  let pointerClientY = -200;
  let hasPointer = false;
  let updateFrame = null;
  let activePanel = null;

  cursorGlow.className = "grid-cursor-glow";
  cursorGlow.setAttribute("aria-hidden", "true");
  document.body.prepend(cursorGlow);

  panels.forEach((panel) => {
    const panelGlow = document.createElement("canvas");
    panelGlow.className = "grid-panel-glow";
    panelGlow.setAttribute("aria-hidden", "true");
    panel.prepend(panelGlow);
  });

  const drawGridTexture = (canvas, pageLeft, pageTop, lineAlpha) => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const bitmapSize = Math.round(glowSize * pixelRatio);

    if (canvas.width !== bitmapSize || canvas.height !== bitmapSize) {
      canvas.width = bitmapSize;
      canvas.height = bitmapSize;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, glowSize, glowSize);
    context.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
    context.lineWidth = 1;
    context.beginPath();

    const firstGridX = ((-pageLeft % gridSize) + gridSize) % gridSize;
    const firstGridY = ((-pageTop % gridSize) + gridSize) % gridSize;

    for (let x = firstGridX; x <= glowSize; x += gridSize) {
      context.moveTo(x, 0);
      context.lineTo(x, glowSize);
    }

    for (let y = firstGridY; y <= glowSize; y += gridSize) {
      context.moveTo(0, y);
      context.lineTo(glowSize, y);
    }

    context.stroke();
    context.globalCompositeOperation = "destination-in";

    const falloff = context.createRadialGradient(
      glowRadius,
      glowRadius,
      0,
      glowRadius,
      glowRadius,
      glowRadius,
    );
    falloff.addColorStop(0, "rgba(0, 0, 0, 1)");
    falloff.addColorStop(0.25, "rgba(0, 0, 0, 0.7)");
    falloff.addColorStop(0.5, "rgba(0, 0, 0, 0.4)");
    falloff.addColorStop(0.75, "rgba(0, 0, 0, 0.25)");
    falloff.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = falloff;
    context.fillRect(0, 0, glowSize, glowSize);
    context.globalCompositeOperation = "source-over";
  };

  const hideActivePanelGlow = () => {
    activePanel?.style.setProperty("--grid-panel-opacity", "0");
    activePanel = null;
  };

  const drawGlow = () => {
    const pointerX = pointerClientX + window.scrollX;
    const pointerY = pointerClientY + window.scrollY;
    const glowPageX = pointerX - glowRadius;
    const glowPageY = pointerY - glowRadius;
    const glowViewportX = pointerClientX - glowRadius;
    const glowViewportY = pointerClientY - glowRadius;
    const hoveredElement = document.elementFromPoint(pointerClientX, pointerClientY);
    const hoveredPanel = hoveredElement instanceof Element
      ? hoveredElement.closest(panelSelector)
      : null;

    if (hoveredPanel !== activePanel) {
      hideActivePanelGlow();
      activePanel = hoveredPanel;
    }

    if (activePanel) {
      const rect = activePanel.getBoundingClientRect();

      activePanel.style.setProperty(
        "--grid-panel-translate-x",
        `${pointerClientX - rect.left - glowRadius}px`,
      );
      activePanel.style.setProperty(
        "--grid-panel-translate-y",
        `${pointerClientY - rect.top - glowRadius}px`,
      );
      activePanel.style.setProperty("--grid-panel-opacity", "1");
      drawGridTexture(
        activePanel.querySelector(".grid-panel-glow"),
        glowPageX,
        glowPageY,
        0.055,
      );
    }

    cursorGlow.style.setProperty("--grid-glow-translate-x", `${glowViewportX}px`);
    cursorGlow.style.setProperty("--grid-glow-translate-y", `${glowViewportY}px`);
    drawGridTexture(cursorGlow, glowPageX, glowPageY, 0.42);
    cursorGlow.style.opacity = "1";
    updateFrame = null;
  };

  const requestGlowUpdate = () => {
    if (!hasPointer) {
      return;
    }

    if (updateFrame === null) {
      updateFrame = requestAnimationFrame(drawGlow);
    }
  };

  window.addEventListener("pointermove", (event) => {
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
    hasPointer = true;
    requestGlowUpdate();
  }, { passive: true });

  window.addEventListener("scroll", requestGlowUpdate, { passive: true });
  window.addEventListener("resize", requestGlowUpdate, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => {
    hasPointer = false;
    cursorGlow.style.opacity = "0";
    hideActivePanelGlow();
  });
};

const DEBUG_SPLAT = new URLSearchParams(window.location.search).has("debugSplat");
const DEBUG_STEPNOTE_SPLAT = new URLSearchParams(window.location.search).has(
  "debugStepNoteSplat",
);
const DEBUG_STEPNOTE_SPLAT_ASSET = new URLSearchParams(window.location.search).get(
  "stepNoteSplat",
);
const DEBUG_HERO_TRANSITION = new URLSearchParams(window.location.search).has(
  "debugHeroTransition",
);
const DEBUG_WATONOMOUS_VIDEO = new URLSearchParams(window.location.search).has(
  "debugWatonomousVideo",
);

const SPLAT_RENDERER_URL =
  "https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.7/build/gaussian-splats-3d.module.js";

const SPLAT_DEBUG_STORAGE_KEY = "splatDebugConfig";
const SPLAT_ASSET_VERSION = 3;

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

// The depth transition is evaluated inside the existing splat shader. This keeps
// the effect to one draw pass: no depth render target, second scene, or CPU readback.
const HERO_DEPTH_CONFIG = {
  revealStart: 0.08,
  revealEnd: 0.3,
  collapseStart: 0.3,
  collapseEnd: 0.96,
  near: 0.28,
  far: 1.4,
  recedeDistance: 1.3,
};

const HERO_ABOUT_TRANSITION_CONFIG = {
  start: 0.509,
  speed: 1,
  vignetteFadeEnd: 0.8,
};

let heroVignetteFadeEnd = HERO_ABOUT_TRANSITION_CONFIG.vignetteFadeEnd;

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

// Production values captured with ?debugWatonomousVideo.
const WATONOMOUS_VIDEO_CONFIG = {
  src: "/assets/watonomous-video.mp4",
  aspectRatio: 1.66,
  cropX: 50,
  cropY: 51,
  zoom: 1.31,
  shiftX: -15,
  shiftY: -13,
  trimStart: 0,
  trimEnd: 10.77,
};

const WATONOMOUS_VIDEO_DEBUG_STORAGE_KEY = "watonomousVideoDebugConfig";

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

const getHeroViewportHeight = () =>
  heroScrollTrack?.querySelector(".hero")?.offsetHeight || window.innerHeight;

const getScrollProgress = () => {
  if (!heroScrollTrack) {
    return 0;
  }

  const scrollRange = heroScrollTrack.offsetHeight - getHeroViewportHeight();

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

  const scrollRange = heroScrollTrack.offsetHeight - getHeroViewportHeight();

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

const smoothstepRange = (value, start, end) => {
  const range = Math.max(0.0001, end - start);
  const t = Math.min(1, Math.max(0, (value - start) / range));

  return t * t * (3 - 2 * t);
};

const easeOutPowerRange = (value, start, end, exponent = 0.65) => {
  const range = Math.max(0.0001, end - start);
  const t = Math.min(1, Math.max(0, (value - start) / range));

  return t ** exponent;
};

const installHeroDepthShader = (splatMesh) => {
  const material = splatMesh?.material;

  if (
    !material?.isShaderMaterial ||
    !material.vertexShader?.includes("gl_Position = quadPos;") ||
    !material.fragmentShader?.includes("vec3 color = vColor.rgb;")
  ) {
    console.warn("[SPLAT DEPTH] Compatible splat shader was not found.");
    return null;
  }

  material.uniforms.heroDepthMix = { value: 0 };
  material.uniforms.heroDepthCollapse = { value: 0 };
  material.uniforms.heroDepthNear = { value: HERO_DEPTH_CONFIG.near };
  material.uniforms.heroDepthFar = { value: HERO_DEPTH_CONFIG.far };
  material.uniforms.heroDepthRecedeDistance = {
    value: HERO_DEPTH_CONFIG.recedeDistance,
  };

  material.vertexShader = material.vertexShader
    .replace(
      "varying vec4 vColor;",
      "varying vec4 vColor; varying float vHeroCameraDepth;",
    )
    .replace(
      "gl_Position = quadPos;",
      "vHeroCameraDepth = max(0.0, -viewCenter.z); gl_Position = quadPos;",
    );

  material.fragmentShader = material.fragmentShader
    .replace(
      "varying vec4 vColor;",
      `varying vec4 vColor;
       varying float vHeroCameraDepth;
       uniform float heroDepthMix;
       uniform float heroDepthCollapse;
       uniform float heroDepthNear;
       uniform float heroDepthFar;
       uniform float heroDepthRecedeDistance;`,
    )
    .replace(
      "vec3 color = vColor.rgb;",
      `float depthRange = max(0.0001, heroDepthFar - heroDepthNear);
       float recededCameraDepth = vHeroCameraDepth + heroDepthCollapse * heroDepthRecedeDistance;
       float depthValue = clamp((recededCameraDepth - heroDepthNear) / depthRange, 0.0, 1.0);
       depthValue = pow(depthValue, 0.55);
       vec3 depthColor = vec3(1.0 - depthValue);
       vec3 color = mix(vColor.rgb, depthColor, heroDepthMix);`,
    );

  material.needsUpdate = true;
  splatContainer?.setAttribute("data-depth-effect", "ready");

  return (rawProgress) => {
    const depthMix = smoothstepRange(
      rawProgress,
      HERO_DEPTH_CONFIG.revealStart,
      HERO_DEPTH_CONFIG.revealEnd,
    );
    const depthCollapse = easeOutPowerRange(
      rawProgress,
      HERO_DEPTH_CONFIG.collapseStart,
      HERO_DEPTH_CONFIG.collapseEnd,
    );

    material.uniforms.heroDepthMix.value = depthMix;
    material.uniforms.heroDepthCollapse.value = depthCollapse;
    splatContainer?.style.setProperty("--hero-depth-mix", depthMix.toFixed(4));
    splatContainer?.style.setProperty(
      "--hero-depth-collapse",
      depthCollapse.toFixed(4),
    );
  };
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
    const manualRendering = isMobile;

    const splatScale = isMobile ? SPLAT_CONFIG.splatScale * 0.73 : SPLAT_CONFIG.splatScale;
    const initialCameraPosition = [...SPLAT_CONFIG.cameraStart.position];
    const initialCameraLookAt = [...SPLAT_CONFIG.cameraStart.lookAt];

    const viewer = new GaussianSplats3D.Viewer({
      rootElement: splatContainer,
      cameraUp: [0, -1, 0],
      initialCameraPosition,
      initialCameraLookAt,
      useBuiltInControls: false,
      selfDrivenMode: !manualRendering,
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
      dynamicScene: true,
      halfPrecisionCovariancesOnGPU: false,
      freeIntermediateSplatData: true,
      ignoreDevicePixelRatio: isMobile,
      sphericalHarmonicsDegree: 0,
      renderMode: GaussianSplats3D.RenderMode.OnChange,
      sceneRevealMode: isMobile
        ? GaussianSplats3D.SceneRevealMode.Instant
        : GaussianSplats3D.SceneRevealMode.Gradual,
      webXRMode: GaussianSplats3D.WebXRMode.None,
    });

    const splatPixelRatio = isMobile
      ? 1
      : Math.min(window.devicePixelRatio || 1, 1.5);

    viewer.devicePixelRatio = splatPixelRatio;
    viewer.getSplatMesh().devicePixelRatio = splatPixelRatio;
    viewer.renderer.setPixelRatio(splatPixelRatio);

    const sceneOptions = {
      progressiveLoad: !manualRendering,
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

    const updateHeroDepthShader = installHeroDepthShader(viewer.getSplatMesh());

    if (!manualRendering) {
      viewer.start();
    }
    let viewerRunning = true;

    setStatus("ready");

    let lastScrollY = null;
    let renderFrameId = null;
    let renderStopTimer = null;
    let initialLoadTimer = null;
    let allowIdleStop = false;
    const idleStopEnabled = !isMobile;
    let splatInView = false;
    let forceNextRender = true;
    let lastViewportWidth = window.innerWidth;
    let pendingManualSort = null;

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

      if (manualRendering) {
        viewerRunning = false;
      } else if (viewerRunning && typeof viewer.stop === "function") {
        viewer.stop();
        viewerRunning = false;
      }
    };

    const ensureViewerRunning = () => {
      if (!viewerRunning) {
        if (!manualRendering) {
          viewer.start();
        }
        viewerRunning = true;
      }
    };

    const renderManualViewerFrame = () => {
      if (
        !manualRendering ||
        !viewerRunning ||
        document.hidden ||
        !splatInView
      ) {
        return;
      }

      viewer.update();

      if (viewer.shouldRender()) {
        viewer.render();
      }

      viewer.renderNextFrame = false;

      const activeSort = viewer.sortRunning ? viewer.sortPromise : null;
      if (activeSort && activeSort !== pendingManualSort) {
        pendingManualSort = activeSort;
        activeSort.finally(() => {
          if (pendingManualSort === activeSort) {
            pendingManualSort = null;
          }

          if (viewerRunning && splatInView && !document.hidden) {
            requestSplatRender({ force: true });
          }
        });
      }
    };

    const scheduleInitialLoadGrace = () => {
      if (!idleStopEnabled) {
        ensureViewerRunning();
        return;
      }

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
      if (!idleStopEnabled) {
        return;
      }

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

      const rawProgress = getScrollProgress();
      const progress = easeScrollProgress(rawProgress);
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

      updateHeroDepthShader?.(rawProgress);

      ensureViewerRunning();
      viewer.forceRenderNextFrame?.();
      renderManualViewerFrame();
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
      window.addEventListener(
        "resize",
        () => {
          const viewportWidth = window.innerWidth;
          const widthChanged = Math.abs(viewportWidth - lastViewportWidth) > 1;
          lastViewportWidth = viewportWidth;

          // Mobile Safari changes only the viewport height as its toolbar moves.
          // Stable lvh sizing means that event does not require a WebGL resize.
          if (isMobile && !widthChanged) {
            return;
          }

          requestSplatRender({ force: true });
        },
        { passive: true },
      );
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
  } catch (error) {
    console.warn("[STEPNOTE SPLAT] Asset preflight skipped:", error);
  }

  try {
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
    let viewerRunning = true;
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
    let stageInView = false;
    let expanded = true;
    let animationFrameId = null;

    const ensureViewerRunning = () => {
      if (!viewerRunning) {
        viewer.start();
        viewerRunning = true;
      }
    };

    const stopViewer = () => {
      if (viewerRunning) {
        viewer.stop();
        viewerRunning = false;
      }
    };

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
          syncAnimation();
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

    const shouldAnimate = () =>
      !paused && expanded && stageInView && !document.hidden;

    const suspendAnimation = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      stopViewer();
    };

    const animate = (time) => {
      animationFrameId = null;

      if (!shouldAnimate()) {
        suspendAnimation();
        return;
      }

      const durationMs = Math.max(1, config.loopSeconds) * 1000;
      const cycleLegs = config.pingPong ? 2 : 1;
      playbackPhase = ((time - loopStart) / durationMs) % cycleLegs;
      const progress = progressFromPhase(playbackPhase);
      pausedProgress = progress;
      stage.dataset.orbitProgress = progress.toFixed(6);
      const cameraPose = applyLoopTransform(progress);
      const legProgress = config.pingPong
        ? (playbackPhase <= 1 ? playbackPhase : 2 - playbackPhase)
        : playbackPhase;
      debugPanel?.updateProgress(progress, cameraPose, {
        legProgress,
        direction: playbackPhase <= 1 ? "forward" : "reverse",
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    function syncAnimation() {
      if (!shouldAnimate()) {
        suspendAnimation();
        return;
      }

      ensureViewerRunning();
      loopStart = performance.now() - playbackPhase * config.loopSeconds * 1000;

      if (animationFrameId === null) {
        animationFrameId = requestAnimationFrame(animate);
      }
    }

    stage.addEventListener("stepnote-playback-change", (event) => {
      paused = Boolean(event.detail?.paused);
      syncAnimation();
    });

    stage.addEventListener("stepnote-visibility-change", (event) => {
      expanded = Boolean(event.detail?.expanded);
      syncAnimation();
    });

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      stageInView = entry.isIntersecting;
      syncAnimation();
    });
    visibilityObserver.observe(stage);

    document.addEventListener("visibilitychange", syncAnimation);

    applyConfig();
    requestAnimationFrame(syncAnimation);
  } catch (error) {
    stage.dataset.initialized = "false";
    stage.classList.remove("is-loading");
    stage.classList.add("has-error");
    status.textContent = "Add /splats/StepNote.ksplat to activate this rotating preview";
    console.info("[STEPNOTE SPLAT] Waiting for StepNote.ksplat:", error);
  }
};

const initStepNoteProject = () => {
  const playbackToggle = document.querySelector(".stepnote-splat-playback-toggle");
  const stage = document.querySelector("#stepnote-splat-stage");

  if (!playbackToggle || !stage) {
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

  playbackToggle.addEventListener("click", () => {
    setPlaybackPaused(playbackToggle.getAttribute("aria-pressed") !== "true");
  });

  const tryInitSplat = () => {
    if (stage.dataset.initialized === "true") {
      return true;
    }

    const { width, height } = stage.getBoundingClientRect();

    if (width < 2 || height < 2) {
      return false;
    }

    initStepNoteSplat();
    return true;
  };

  if (tryInitSplat()) {
    return;
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) {
        return;
      }

      if (tryInitSplat()) {
        observer.disconnect();
      }
    },
    { rootMargin: "240px 0px", threshold: 0.01 },
  );
  observer.observe(stage);

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(() => {
      if (tryInitSplat()) {
        resizeObserver.disconnect();
        observer.disconnect();
      }
    });
    resizeObserver.observe(stage);
  }
};

const initHeroScrollTransition = () => {
  const hero = document.querySelector(".hero");
  const heroCopy = document.querySelector(".hero-copy");

  if (!hero || !heroCopy) {
    return;
  }

  const COPY_FADE_START = 0.18;
  const COPY_FADE_END = 0.3;

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
    const introOverlay = 1 - fadeBetween(progress, 0.08, heroVignetteFadeEnd);
    const collapseOverlay = fadeBetween(progress, 0.5, 0.98);

    hero.style.setProperty("--hero-copy-opacity", String(copyOpacity));
    hero.style.setProperty("--hero-intro-overlay", String(introOverlay));
    hero.style.setProperty("--hero-collapse-overlay", String(collapseOverlay));

    heroCopy.style.pointerEvents = copyOpacity > 0.4 ? "auto" : "none";

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

const initHeroAboutTransition = () => {
  const hero = document.querySelector(".hero");
  const aboutSection = document.querySelector("#about");
  const siteContent = document.querySelector("#site-content-transition");

  if (!heroScrollTrack || !hero || !aboutSection || !siteContent) {
    return;
  }

  const STORAGE_KEY = "heroAboutTransitionStart";
  const SPEED_STORAGE_KEY = "heroAboutTransitionSpeed";
  const VIGNETTE_STORAGE_KEY = "heroVignetteFadeEnd";
  const clamp = (value, min = 0, max = 1) =>
    Math.min(max, Math.max(min, value));
  const smoothstep = (value) => {
    const t = clamp(value);

    return t * t * (3 - 2 * t);
  };
  const readSavedStart = () => {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);

      if (storedValue === null) {
        return HERO_ABOUT_TRANSITION_CONFIG.start;
      }

      const saved = Number(storedValue);

      return Number.isFinite(saved)
        ? clamp(saved, 0.05, 0.95)
        : HERO_ABOUT_TRANSITION_CONFIG.start;
    } catch (error) {
      console.warn("[HERO TRANSITION DEBUG] Saved value could not be read:", error);
      return HERO_ABOUT_TRANSITION_CONFIG.start;
    }
  };
  const readSavedSpeed = () => {
    try {
      const storedValue = window.localStorage.getItem(SPEED_STORAGE_KEY);

      if (storedValue === null) {
        return HERO_ABOUT_TRANSITION_CONFIG.speed;
      }

      const saved = Number(storedValue);

      return Number.isFinite(saved)
        ? clamp(saved, 1, 10)
        : HERO_ABOUT_TRANSITION_CONFIG.speed;
    } catch (error) {
      console.warn("[HERO TRANSITION DEBUG] Saved speed could not be read:", error);
      return HERO_ABOUT_TRANSITION_CONFIG.speed;
    }
  };
  const readSavedVignetteEnd = () => {
    try {
      const storedValue = window.localStorage.getItem(VIGNETTE_STORAGE_KEY);

      if (storedValue === null) {
        return HERO_ABOUT_TRANSITION_CONFIG.vignetteFadeEnd;
      }

      const saved = Number(storedValue);

      return Number.isFinite(saved)
        ? clamp(saved, 0.12, 0.8)
        : HERO_ABOUT_TRANSITION_CONFIG.vignetteFadeEnd;
    } catch (error) {
      console.warn("[HERO TRANSITION DEBUG] Vignette value could not be read:", error);
      return HERO_ABOUT_TRANSITION_CONFIG.vignetteFadeEnd;
    }
  };
  const speedToDuration = (speed) => 0.26 - clamp(speed, 1, 10) * 0.023;

  let transitionStart = DEBUG_HERO_TRANSITION
    ? readSavedStart()
    : HERO_ABOUT_TRANSITION_CONFIG.start;
  let transitionSpeed = DEBUG_HERO_TRANSITION
    ? readSavedSpeed()
    : HERO_ABOUT_TRANSITION_CONFIG.speed;
  heroVignetteFadeEnd = DEBUG_HERO_TRANSITION
    ? readSavedVignetteEnd()
    : HERO_ABOUT_TRANSITION_CONFIG.vignetteFadeEnd;
  let previewFrame = null;
  let desktopHeaderVisible = false;
  let appliedHeaderVisibility = null;

  document.body.classList.toggle("debug-hero-transition", DEBUG_HERO_TRANSITION);

  const panel = document.createElement("aside");
  panel.className = "hero-transition-debug-panel";
  panel.setAttribute("aria-label", "Hero to About transition controls");
  panel.innerHTML = `
    <div class="hero-transition-debug-heading">
      <div>
        <strong>Hero → About</strong>
        <span>Transition lab</span>
      </div>
      <button type="button" data-debug-close aria-label="Close debug panel">×</button>
    </div>
    <label>
      <span>Hero progress <output data-progress-output>0.0%</output></span>
      <input data-progress type="range" min="0" max="100" step="0.1" value="0" />
    </label>
    <label>
      <span>About starts entering <output data-start-output>${(transitionStart * 100).toFixed(1)}%</output></span>
      <input data-start type="range" min="5" max="95" step="0.1" value="${(transitionStart * 100).toFixed(1)}" />
    </label>
    <label>
      <span>Slide speed <output data-speed-output>${transitionSpeed.toFixed(1)} / 10</output></span>
      <input data-speed type="range" min="1" max="10" step="0.1" value="${transitionSpeed.toFixed(1)}" />
    </label>
    <label>
      <span>Vignette disappears <output data-vignette-output>${(heroVignetteFadeEnd * 100).toFixed(1)}%</output></span>
      <input data-vignette type="range" min="12" max="80" step="0.1" value="${(heroVignetteFadeEnd * 100).toFixed(1)}" />
    </label>
    <p class="hero-transition-debug-range" data-range-output></p>
    <div class="hero-transition-debug-actions">
      <button type="button" data-play>Play preview</button>
      <button type="button" data-reset>Reset</button>
      <button type="button" data-copy>Copy config</button>
    </div>
    <p class="hero-transition-debug-status" data-status aria-live="polite"></p>
  `;
  document.body.appendChild(panel);
  panel.hidden = !DEBUG_HERO_TRANSITION;

  const progressInput = panel.querySelector("[data-progress]");
  const startInput = panel.querySelector("[data-start]");
  const speedInput = panel.querySelector("[data-speed]");
  const vignetteInput = panel.querySelector("[data-vignette]");
  const progressOutput = panel.querySelector("[data-progress-output]");
  const startOutput = panel.querySelector("[data-start-output]");
  const speedOutput = panel.querySelector("[data-speed-output]");
  const vignetteOutput = panel.querySelector("[data-vignette-output]");
  const rangeOutput = panel.querySelector("[data-range-output]");
  const status = panel.querySelector("[data-status]");

  const getScrollRange = () =>
    Math.max(1, heroScrollTrack.offsetHeight - hero.offsetHeight);
  const scrollToProgress = (progress) => {
    const trackTop = heroScrollTrack.getBoundingClientRect().top + window.scrollY;

    window.scrollTo({
      top: trackTop + clamp(progress) * getScrollRange(),
      behavior: "instant",
    });
  };
  const updateRangeText = () => {
    const slideDuration = speedToDuration(transitionSpeed);
    const end = Math.min(1, transitionStart + slideDuration);

    startOutput.value = `${(transitionStart * 100).toFixed(1)}%`;
    speedOutput.value = `${transitionSpeed.toFixed(1)} / 10`;
    vignetteOutput.value = `${(heroVignetteFadeEnd * 100).toFixed(1)}%`;
    rangeOutput.textContent = `Slides from ${(transitionStart * 100).toFixed(1)}% to ${(end * 100).toFixed(1)}% (${(slideDuration * 100).toFixed(1)}% of hero scroll).`;
  };
  const updatePreview = () => {
    previewFrame = null;
    const progress = getScrollProgress();
    const end = Math.min(1, transitionStart + speedToDuration(transitionSpeed));
    const reveal = smoothstep((progress - transitionStart) / Math.max(0.001, end - transitionStart));
    const scrollRange = getScrollRange();
    const viewportHeight = hero.offsetHeight;
    const overlap = viewportHeight + (1 - end) * scrollRange;
    const preEntryOffset = Math.max(
      0,
      viewportHeight - (end - transitionStart) * scrollRange,
    );
    const entryOffset = preEntryOffset * (1 - reveal);
    const contentTop = clamp(
      (end - progress) * scrollRange + entryOffset,
      0,
      viewportHeight,
    );

    siteContent.style.marginTop = `${-overlap.toFixed(3)}px`;
    siteContent.style.setProperty(
      "--site-content-entry-y",
      `${entryOffset.toFixed(3)}px`,
    );
    siteContent.style.pointerEvents = reveal > 0.01 ? "auto" : "none";
    hero.style.setProperty(
      "--hero-content-clip-bottom",
      `${(viewportHeight - contentTop).toFixed(3)}px`,
    );
    progressInput.value = (progress * 100).toFixed(1);
    progressOutput.value = `${(progress * 100).toFixed(1)}%`;

    const siteHeader = document.querySelector(".site-header");

    if (siteHeader) {
      const mobileDock = window.matchMedia("(max-width: 700px)").matches;

      if (progress >= 1 || reveal > 0.65) {
        desktopHeaderVisible = true;
      } else if (reveal < 0.35) {
        desktopHeaderVisible = false;
      }

      const headerVisible = mobileDock || desktopHeaderVisible;

      if (headerVisible !== appliedHeaderVisibility) {
        appliedHeaderVisibility = headerVisible;
        siteHeader.classList.toggle("is-visible", headerVisible);
        siteHeader.setAttribute("aria-hidden", headerVisible ? "false" : "true");
      }
    }
  };
  const requestPreviewUpdate = () => {
    if (previewFrame === null) {
      previewFrame = requestAnimationFrame(updatePreview);
    }
  };
  const saveStart = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(transitionStart));
    } catch (error) {
      console.warn("[HERO TRANSITION DEBUG] Value could not be saved:", error);
    }
  };
  const saveSpeed = () => {
    try {
      window.localStorage.setItem(SPEED_STORAGE_KEY, String(transitionSpeed));
    } catch (error) {
      console.warn("[HERO TRANSITION DEBUG] Speed could not be saved:", error);
    }
  };
  const saveVignetteEnd = () => {
    try {
      window.localStorage.setItem(VIGNETTE_STORAGE_KEY, String(heroVignetteFadeEnd));
    } catch (error) {
      console.warn("[HERO TRANSITION DEBUG] Vignette value could not be saved:", error);
    }
  };

  progressInput.addEventListener("input", () => {
    scrollToProgress(Number(progressInput.value) / 100);
    requestPreviewUpdate();
  });

  startInput.addEventListener("input", () => {
    transitionStart = clamp(Number(startInput.value) / 100, 0.05, 0.95);
    saveStart();
    updateRangeText();
    requestPreviewUpdate();
  });

  speedInput.addEventListener("input", () => {
    transitionSpeed = clamp(Number(speedInput.value), 1, 10);
    saveSpeed();
    updateRangeText();
    requestPreviewUpdate();
  });

  vignetteInput.addEventListener("input", () => {
    heroVignetteFadeEnd = clamp(Number(vignetteInput.value) / 100, 0.12, 0.8);
    saveVignetteEnd();
    updateRangeText();
    window.dispatchEvent(new Event("scroll"));
  });

  panel.querySelector("[data-play]").addEventListener("click", async () => {
    const previewStart = Math.max(0, transitionStart - 0.06);
    const previewEnd = Math.min(
      1,
      transitionStart + speedToDuration(transitionSpeed) + 0.04,
    );
    const range = getScrollRange();
    const trackTop = heroScrollTrack.getBoundingClientRect().top + window.scrollY;

    scrollToProgress(previewStart);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await smoothScrollTo(trackTop + previewEnd * range, 2400);
  });

  panel.querySelector("[data-reset]").addEventListener("click", () => {
    scrollToProgress(Math.max(0, transitionStart - 0.08));
    requestPreviewUpdate();
  });

  panel.querySelector("[data-copy]").addEventListener("click", async () => {
    const value = `start ${(transitionStart * 100).toFixed(1)}%, speed ${transitionSpeed.toFixed(1)}/10, vignette ${(heroVignetteFadeEnd * 100).toFixed(1)}%`;

    try {
      await navigator.clipboard.writeText(value);
      status.textContent = `Copied ${value}`;
    } catch (error) {
      status.textContent = `Use ${value}`;
    }
  });

  panel.querySelector("[data-debug-close]").addEventListener("click", () => {
    panel.hidden = true;
  });

  document.querySelectorAll('a[href="#about"]').forEach((link) => {
    link.addEventListener("click", async (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      const transitionEnd = Math.min(
        1,
        transitionStart + speedToDuration(transitionSpeed),
      );
      const trackTop = heroScrollTrack.getBoundingClientRect().top + window.scrollY;

      await smoothScrollTo(trackTop + transitionEnd * getScrollRange(), 900);
      history.replaceState(null, "", "#about");
    });
  });

  window.addEventListener("scroll", requestPreviewUpdate, { passive: true });
  window.addEventListener("resize", requestPreviewUpdate, { passive: true });
  updateRangeText();
  updatePreview();

  if (window.location.hash === "#about") {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

    const landOnAbout = () => requestAnimationFrame(() => {
      const transitionEnd = Math.min(
        1,
        transitionStart + speedToDuration(transitionSpeed),
      );

      scrollToProgress(transitionEnd);
      requestPreviewUpdate();
      history.replaceState(null, "", "#about");
    });

    if (document.readyState === "complete") {
      landOnAbout();
    } else {
      window.addEventListener("load", landOnAbout, { once: true });
    }
  }
};

const initMobileDockNavigation = () => {
  const mobileQuery = window.matchMedia("(max-width: 700px)");
  const dockLinks = [...document.querySelectorAll(".site-header a[href^=\"#\"]")];
  const targets = dockLinks.flatMap((link) => {
    const selector = link.getAttribute("href");
    const target = selector === "#top"
      ? document.querySelector("#hero-scroll-track")
      : document.querySelector(selector);

    return target ? [{ link, target }] : [];
  });

  if (!targets.length || !("IntersectionObserver" in window)) {
    return;
  }

  const visibleTargets = new Set();
  const setActiveLink = (activeLink) => {
    dockLinks.forEach((link) => {
      if (link === activeLink && mobileQuery.matches) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const updateActiveLink = () => {
    if (!mobileQuery.matches) {
      setActiveLink(null);
      return;
    }

    const viewportCenter = window.innerHeight / 2;
    const candidates = targets
      .filter(({ target }) => visibleTargets.has(target))
      .map((item) => ({ ...item, rect: item.target.getBoundingClientRect() }));
    const centered = candidates
      .filter(({ rect }) => rect.top <= viewportCenter && rect.bottom >= viewportCenter)
      .sort((a, b) => b.rect.top - a.rect.top);
    const active = centered[0] || candidates.sort(
      (a, b) =>
        Math.abs(a.rect.top - viewportCenter) -
        Math.abs(b.rect.top - viewportCenter),
    )[0];

    setActiveLink(active?.link || null);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        visibleTargets.add(entry.target);
      } else {
        visibleTargets.delete(entry.target);
      }
    });
    updateActiveLink();
  });

  targets.forEach(({ target }) => observer.observe(target));
  dockLinks.forEach((link) => {
    link.addEventListener("click", () => setActiveLink(link));
  });
  mobileQuery.addEventListener?.("change", updateActiveLink);
};

const initDesktopSidebar = () => {
  const sidebar = document.querySelector(".site-header");
  const toggle = document.querySelector("#sidebar-toggle");
  const toggleLabel = toggle?.querySelector("[data-sidebar-toggle-label]");
  const desktopQuery = window.matchMedia("(min-width: 701px)");
  const storageKey = "desktopSidebarExpanded";

  if (!sidebar || !toggle) {
    return;
  }

  const readSavedState = () => {
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch (error) {
      console.warn("[SIDEBAR] Preference could not be read:", error);
      return false;
    }
  };

  let expanded = readSavedState();

  const applyState = ({ persist = false } = {}) => {
    const desktopExpanded = desktopQuery.matches && expanded;
    const action = desktopExpanded ? "Collapse" : "Expand";

    sidebar.classList.toggle("is-expanded", desktopExpanded);
    toggle.setAttribute("aria-expanded", String(desktopExpanded));
    toggle.setAttribute("aria-label", `${action} navigation`);
    toggle.title = `${action} navigation`;

    if (toggleLabel) {
      toggleLabel.textContent = `${action} menu`;
    }

    if (persist) {
      try {
        window.localStorage.setItem(storageKey, expanded ? "1" : "0");
      } catch (error) {
        console.warn("[SIDEBAR] Preference could not be saved:", error);
      }
    }
  };

  toggle.addEventListener("click", () => {
    expanded = !expanded;
    applyState({ persist: true });
  });

  sidebar.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      if (!desktopQuery.matches || !expanded) {
        return;
      }

      expanded = false;
      applyState({ persist: true });
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && desktopQuery.matches && expanded) {
      expanded = false;
      applyState({ persist: true });
      toggle.focus();
    }
  });

  desktopQuery.addEventListener("change", () => applyState());
  applyState();
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
  let terminalPixels = null;
  let splatRect = null;
  let terminalRect = null;
  let surfaceColorRegions = [];
  let foregroundColorRegions = [];
  let liveSplatCaptured = false;
  let liveSplatCapturePending = false;
  const asciiEnabled = true;
  let asciiCanvasHasContent = false;
  let asciiScrollFrame = null;

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
      ".project-cards",
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
    sampleColorRegion(surfaceColorRegions, x, y) ||
    sampleRegion(splatPixels, splatRect, x, y, "cover") ||
    backgroundGlyphColor;

  const updateTransitionOpacity = () => {
    if (!asciiEnabled) {
      return;
    }

    const fadeStart = overlayStart + window.innerHeight * 0.08;
    const fadeEnd = overlayStart + window.innerHeight * 0.42;
    const linearProgress = Math.min(
      1,
      Math.max(0, (window.scrollY - fadeStart) / (fadeEnd - fadeStart)),
    );
    const easedProgress =
      linearProgress * linearProgress * (3 - 2 * linearProgress);

    canvas.style.opacity = (easedProgress * 0.2).toFixed(3);
  };

  const resize = () => {
    if (!asciiEnabled) {
      return;
    }

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
    renderTerminalPixels();
    buildColorRegions();

    updateTransitionOpacity();
  };

  const draw = () => {
    if (!asciiEnabled) {
      return;
    }

    if (window.scrollY + window.innerHeight < overlayStart) {
      if (asciiCanvasHasContent) {
        context.clearRect(0, 0, width, window.innerHeight);
        asciiCanvasHasContent = false;
      }

      return;
    }

    context.clearRect(0, 0, width, window.innerHeight);
    asciiCanvasHasContent = true;

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
    if (!asciiEnabled || asciiScrollFrame !== null) {
      return;
    }

    asciiScrollFrame = requestAnimationFrame(() => {
      asciiScrollFrame = null;

      if (
        window.scrollY + window.innerHeight < overlayStart &&
        !asciiCanvasHasContent
      ) {
        return;
      }

      if (window.scrollY >= overlayStart - window.innerHeight * 0.12) {
        requestLiveSplatCapture();
      }

      updateTransitionOpacity();
      draw();
    });
  };

  const handleResize = () => {
    if (!asciiEnabled) {
      return;
    }

    resize();
    draw();
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  canvas.hidden = false;
  resize();
  draw();
  loadPixels("/splats/Color.png")
    .then((loadedSplatPixels) => {
      splatPixels = loadedSplatPixels;
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

const initWatonomousVideo = () => {
  const frame = document.querySelector("#watonomous-video-frame");
  const video = document.querySelector("#watonomous-video");

  if (!frame || !video) {
    return;
  }

  const defaults = { ...WATONOMOUS_VIDEO_CONFIG };
  let config = { ...defaults };
  let duration = 0;
  let loopFrame = null;
  let localVideoUrl = null;
  let panel = null;

  if (DEBUG_WATONOMOUS_VIDEO) {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(WATONOMOUS_VIDEO_DEBUG_STORAGE_KEY) || "null",
      );

      if (saved && typeof saved === "object") {
        config = { ...config, ...saved, src: defaults.src };
      }
    } catch (error) {
      console.warn("[WATonomous video] Saved debug config could not be read:", error);
    }
  }

  const clamp = (value, minimum, maximum) =>
    Math.min(maximum, Math.max(minimum, Number(value)));

  const normalizeConfig = () => {
    config.aspectRatio = clamp(config.aspectRatio, 0.5, 2.4);
    config.cropX = clamp(config.cropX, 0, 100);
    config.cropY = clamp(config.cropY, 0, 100);
    config.zoom = clamp(config.zoom, 1, 3);
    config.shiftX = clamp(config.shiftX, -100, 100);
    config.shiftY = clamp(config.shiftY, -100, 100);
    config.trimStart = duration > 0
      ? clamp(config.trimStart, 0, duration)
      : Math.max(0, Number(config.trimStart) || 0);

    if (duration > 0) {
      const requestedEnd = config.trimEnd == null ? duration : Number(config.trimEnd);
      config.trimEnd = clamp(requestedEnd, 0, duration);

      if (config.trimEnd <= config.trimStart) {
        config.trimEnd = Math.min(duration, config.trimStart + 0.05);
      }
    }
  };

  const getTrimEnd = () =>
    duration > 0
      ? clamp(config.trimEnd == null ? duration : config.trimEnd, 0, duration)
      : 0;

  const applyCrop = () => {
    normalizeConfig();
    frame.style.setProperty("--watonomous-video-aspect", String(config.aspectRatio));
    frame.style.setProperty("--watonomous-video-crop-x", `${config.cropX}%`);
    frame.style.setProperty("--watonomous-video-crop-y", `${config.cropY}%`);
    frame.style.setProperty("--watonomous-video-zoom", String(config.zoom));
    frame.style.setProperty("--watonomous-video-shift-x", `${config.shiftX}%`);
    frame.style.setProperty("--watonomous-video-shift-y", `${config.shiftY}%`);
  };

  const formatSeconds = (value) => `${Number(value || 0).toFixed(2)}s`;

  const buildExportConfig = () => ({
    src: "/assets/watonomous-video.mp4",
    aspectRatio: Number(config.aspectRatio.toFixed(4)),
    cropX: Number(config.cropX.toFixed(1)),
    cropY: Number(config.cropY.toFixed(1)),
    zoom: Number(config.zoom.toFixed(2)),
    shiftX: Number(config.shiftX.toFixed(1)),
    shiftY: Number(config.shiftY.toFixed(1)),
    trimStart: Number(config.trimStart.toFixed(2)),
    trimEnd: Number((getTrimEnd() || 0).toFixed(2)),
  });

  const formatExportSnippet = () =>
    `const WATONOMOUS_VIDEO_CONFIG = ${JSON.stringify(buildExportConfig(), null, 2)};`;

  const setStatus = (message) => {
    const status = panel?.querySelector("[data-video-debug-status]");

    if (status) {
      status.textContent = message;
    }
  };

  const refreshPanel = () => {
    if (!panel) {
      return;
    }

    const values = {
      aspectRatio: config.aspectRatio,
      cropX: config.cropX,
      cropY: config.cropY,
      zoom: config.zoom,
      shiftX: config.shiftX,
      shiftY: config.shiftY,
      trimStart: config.trimStart,
      trimEnd: getTrimEnd(),
      timeline: video.currentTime || 0,
    };

    Object.entries(values).forEach(([key, value]) => {
      const input = panel.querySelector(`[data-video-control="${key}"]`);
      const output = panel.querySelector(`[data-video-output="${key}"]`);

      if (input) {
        input.value = String(value);
      }

      if (output) {
        if (key === "aspectRatio") {
          output.textContent = `${Number(value).toFixed(2)}:1`;
        } else if (key === "cropX" || key === "cropY" || key === "shiftX" || key === "shiftY") {
          output.textContent = `${Number(value).toFixed(0)}%`;
        } else if (key === "zoom") {
          output.textContent = `${Number(value).toFixed(2)}×`;
        } else {
          output.textContent = formatSeconds(value);
        }
      }
    });

    panel.querySelectorAll("[data-duration-range]").forEach((input) => {
      input.max = String(duration || 0);
      input.disabled = duration <= 0;
    });

    const durationOutput = panel.querySelector("[data-video-duration]");
    const playButton = panel.querySelector('[data-video-action="play"]');

    if (durationOutput) {
      const selectedLength = Math.max(0, getTrimEnd() - config.trimStart);
      durationOutput.textContent = duration > 0
        ? `Source ${formatSeconds(duration)} · loop ${formatSeconds(selectedLength)}`
        : "Choose a local video to begin.";
    }

    if (playButton) {
      playButton.textContent = video.paused ? "Play loop" : "Pause";
    }
  };

  const enforceLoop = () => {
    loopFrame = null;

    if (video.paused || duration <= 0) {
      refreshPanel();
      return;
    }

    const trimEnd = getTrimEnd();

    if (video.currentTime < config.trimStart || video.currentTime >= trimEnd - 0.025) {
      video.currentTime = config.trimStart;
    }

    refreshPanel();
    loopFrame = window.requestAnimationFrame(enforceLoop);
  };

  const startLoopWatcher = () => {
    if (loopFrame === null) {
      loopFrame = window.requestAnimationFrame(enforceLoop);
    }
  };

  const loadConfiguredVideo = () => {
    if (!config.src) {
      return;
    }

    video.src = config.src;
    video.hidden = false;
    video.load();
  };

  video.addEventListener("loadedmetadata", () => {
    duration = Number.isFinite(video.duration) ? video.duration : 0;
    normalizeConfig();
    video.currentTime = config.trimStart;
    applyCrop();
    refreshPanel();

    if (!DEBUG_WATONOMOUS_VIDEO) {
      video.play().catch(() => {});
    }
  });

  video.addEventListener("play", startLoopWatcher);
  video.addEventListener("pause", refreshPanel);
  video.addEventListener("seeked", refreshPanel);

  applyCrop();
  loadConfiguredVideo();

  if (!DEBUG_WATONOMOUS_VIDEO) {
    return;
  }

  document.body.classList.add("debug-watonomous-video");
  panel = document.createElement("aside");
  panel.className = "watonomous-video-debug-panel";
  panel.setAttribute("aria-label", "WATonomous video editor");
  panel.innerHTML = `
    <h2>WATonomous video editor</h2>
    <p class="watonomous-video-debug-caption">Choose a video from this device. Crop and trim values are non-destructive and will be applied by the production player.</p>
    <label class="watonomous-video-debug-file">
      Local video
      <input type="file" accept="video/*" data-video-file>
    </label>
    <p class="watonomous-video-debug-caption" data-video-duration>Choose a local video to begin.</p>
    <div class="watonomous-video-debug-divider"></div>
    <div class="watonomous-video-debug-control">
      <label for="wat-video-aspect">Aspect</label>
      <input id="wat-video-aspect" type="range" min="0.5" max="2.4" step="0.01" data-video-control="aspectRatio">
      <output data-video-output="aspectRatio"></output>
    </div>
    <div class="watonomous-video-debug-control">
      <label for="wat-video-x">Crop X</label>
      <input id="wat-video-x" type="range" min="0" max="100" step="1" data-video-control="cropX">
      <output data-video-output="cropX"></output>
    </div>
    <div class="watonomous-video-debug-control">
      <label for="wat-video-y">Crop Y</label>
      <input id="wat-video-y" type="range" min="0" max="100" step="1" data-video-control="cropY">
      <output data-video-output="cropY"></output>
    </div>
    <div class="watonomous-video-debug-control">
      <label for="wat-video-zoom">Zoom</label>
      <input id="wat-video-zoom" type="range" min="1" max="3" step="0.01" data-video-control="zoom">
      <output data-video-output="zoom"></output>
    </div>
    <div class="watonomous-video-debug-control">
      <label for="wat-video-shift-x">Shift X</label>
      <input id="wat-video-shift-x" type="range" min="-100" max="100" step="1" data-video-control="shiftX">
      <output data-video-output="shiftX"></output>
    </div>
    <div class="watonomous-video-debug-control">
      <label for="wat-video-shift-y">Shift Y</label>
      <input id="wat-video-shift-y" type="range" min="-100" max="100" step="1" data-video-control="shiftY">
      <output data-video-output="shiftY"></output>
    </div>
    <div class="watonomous-video-debug-divider"></div>
    <div class="watonomous-video-debug-control">
      <label for="wat-video-start">Trim start</label>
      <input id="wat-video-start" type="range" min="0" max="0" step="0.01" data-duration-range data-video-control="trimStart">
      <output data-video-output="trimStart"></output>
    </div>
    <div class="watonomous-video-debug-control">
      <label for="wat-video-end">Trim end</label>
      <input id="wat-video-end" type="range" min="0" max="0" step="0.01" data-duration-range data-video-control="trimEnd">
      <output data-video-output="trimEnd"></output>
    </div>
    <div class="watonomous-video-debug-control">
      <label for="wat-video-time">Timeline</label>
      <input id="wat-video-time" type="range" min="0" max="0" step="0.01" data-duration-range data-video-control="timeline">
      <output data-video-output="timeline"></output>
    </div>
    <div class="watonomous-video-debug-actions">
      <button type="button" data-video-action="play">Play loop</button>
      <button type="button" data-video-action="copy">Copy config</button>
      <button type="button" data-video-action="save">Save settings</button>
      <button type="button" data-video-action="reset">Reset</button>
    </div>
    <p class="watonomous-video-debug-status" data-video-debug-status aria-live="polite"></p>
  `;
  document.body.appendChild(panel);

  panel.querySelector("[data-video-file]").addEventListener("change", (event) => {
    const [file] = event.target.files || [];

    if (!file) {
      return;
    }

    if (localVideoUrl) {
      URL.revokeObjectURL(localVideoUrl);
    }

    localVideoUrl = URL.createObjectURL(file);
    video.src = localVideoUrl;
    video.hidden = false;
    video.load();
    setStatus(`${file.name} loaded locally. The file is not uploaded.`);
  });

  panel.querySelectorAll("[data-video-control]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.videoControl;
      const value = Number(input.value);

      if (key === "timeline") {
        if (duration > 0) {
          video.currentTime = clamp(value, 0, duration);
        }
      } else if (key === "trimStart") {
        config.trimStart = Math.min(value, Math.max(0, getTrimEnd() - 0.05));

        if (video.currentTime < config.trimStart) {
          video.currentTime = config.trimStart;
        }
      } else if (key === "trimEnd") {
        config.trimEnd = Math.max(value, config.trimStart + 0.05);

        if (video.currentTime >= config.trimEnd) {
          video.currentTime = config.trimStart;
        }
      } else {
        config[key] = value;
        applyCrop();
      }

      refreshPanel();
    });
  });

  panel.querySelector('[data-video-action="play"]').addEventListener("click", () => {
    if (duration <= 0) {
      setStatus("Choose a video first.");
      return;
    }

    if (video.paused) {
      if (video.currentTime < config.trimStart || video.currentTime >= getTrimEnd()) {
        video.currentTime = config.trimStart;
      }

      video.play().catch(() => setStatus("Playback could not start."));
    } else {
      video.pause();
    }
  });

  panel.querySelector('[data-video-action="copy"]').addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(formatExportSnippet());
      setStatus("Config copied. Paste it into script.js when the video is added.");
    } catch (error) {
      console.warn("[WATonomous video] Clipboard unavailable:", error);
      setStatus("Clipboard unavailable. Use Save settings for now.");
    }
  });

  panel.querySelector('[data-video-action="save"]').addEventListener("click", () => {
    try {
      window.localStorage.setItem(
        WATONOMOUS_VIDEO_DEBUG_STORAGE_KEY,
        JSON.stringify(buildExportConfig()),
      );
      setStatus("Crop and trim settings saved in this browser.");
    } catch (error) {
      console.warn("[WATonomous video] Config could not be saved:", error);
      setStatus("Settings could not be saved.");
    }
  });

  panel.querySelector('[data-video-action="reset"]').addEventListener("click", () => {
    config = { ...defaults, trimEnd: duration || null };
    applyCrop();

    if (duration > 0) {
      video.currentTime = 0;
    }

    refreshPanel();
    setStatus("Controls reset to defaults.");
  });

  refreshPanel();
};

initHeroScrollTransition();
initHeroAboutTransition();
initDesktopSidebar();
initMobileDockNavigation();
initAsciiCurtain();
initHeroActionLinks();
initHeroMotion();
initGridCursorGlow();
initStepNoteProject();
initWatonomousVideo();
initSplat();
