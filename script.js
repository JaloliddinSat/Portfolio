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

const SPLAT_CONFIG = {
  cameraPosition: [-0.95, 0.15, -0.48],
  cameraLookAt: [0, 0, 0],
  splatPosition: [-1.65, 0.87, -0.71],
  splatScale: 0.75,
  alphaThreshold: 5,
};

const splatContainer = document.querySelector("#splat-viewer");
const splatLoader = document.querySelector("#splat-loader");
const splatError = document.querySelector("#splat-error");

const setStatus = (state, message = "") => {
  if (splatLoader) {
    splatLoader.hidden = state !== "loading";
  }

  if (splatError) {
    splatError.hidden = state !== "error";
    if (message) {
      splatError.textContent = message;
    }
  }
};

const getSplatUrl = () => {
  const productionUrl = splatContainer?.dataset.splatSrc;
  const localUrl = splatContainer?.dataset.localSplatSrc;
  const isLocalhost = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
  );

  return isLocalhost && localUrl ? localUrl : productionUrl;
};

const getScrollProgress = () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;

  return Math.min(Math.max(progress, 0), 1);
};

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

    const testResponse = await fetch(splatUrl, {
      method: "HEAD",
    });

    console.log("[SPLAT] HEAD status:", testResponse.status);

    if (!testResponse.ok) {
      throw new Error(`Splat URL failed with status ${testResponse.status}`);
    }

    const GaussianSplats3D = await import(SPLAT_RENDERER_URL);

    console.log("[SPLAT] Renderer loaded:", GaussianSplats3D);

    const isMobile = window.matchMedia("(max-width: 700px)").matches;

    const splatScale = isMobile ? SPLAT_CONFIG.splatScale * 0.73 : SPLAT_CONFIG.splatScale;

    const viewer = new GaussianSplats3D.Viewer({
      rootElement: splatContainer,
      cameraUp: [0, -1, 0],
      initialCameraPosition: [...SPLAT_CONFIG.cameraPosition],
      initialCameraLookAt: [...SPLAT_CONFIG.cameraLookAt],
      useBuiltInControls: DEBUG_SPLAT ? true : false,
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
      dynamicScene: true,
      ignoreDevicePixelRatio: isMobile,
      sphericalHarmonicsDegree: 0,
      renderMode: GaussianSplats3D.RenderMode.Always,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
      webXRMode: GaussianSplats3D.WebXRMode.None,
    });

    const sceneOptions = {
      progressiveLoad: false,
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
    setStatus("ready");

    const [lookAtX, lookAtY, lookAtZ] = SPLAT_CONFIG.cameraLookAt;
    const [baseX, baseY, baseZ] = SPLAT_CONFIG.cameraPosition;
    const cameraRadius = Math.hypot(baseX - lookAtX, baseZ - lookAtZ);

    const animate = () => {
      const progress = getScrollProgress();
      const angle = progress * Math.PI * 2;

      if (viewer.camera) {
        viewer.camera.position.x = lookAtX + Math.sin(angle) * cameraRadius;
        viewer.camera.position.z = lookAtZ + Math.cos(angle) * cameraRadius;
        viewer.camera.position.y = baseY + progress * 0.35;
        viewer.camera.lookAt(lookAtX, lookAtY, lookAtZ);
      }

      viewer.forceRenderNextFrame?.();
      requestAnimationFrame(animate);
    };

    if (DEBUG_SPLAT) {
      initDebugMode(viewer, isMobile);
    } else {
      requestAnimationFrame(animate);
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

const formatSplatConfigSnippet = (config) =>
  `const SPLAT_CONFIG = {
  cameraPosition: [${config.cameraPosition.join(", ")}],
  cameraLookAt: [${config.cameraLookAt.join(", ")}],
  splatPosition: [${config.splatPosition.join(", ")}],
  splatScale: ${config.splatScale},
  alphaThreshold: ${config.alphaThreshold},
};`;

const copyConfig = async (config) => {
  const snippet = formatSplatConfigSnippet(config);

  try {
    await navigator.clipboard.writeText(snippet);
    showToast("Config copied!");
  } catch {
    showToast("Copy failed — see console.");
    console.log("[SPLAT] Config:\n", snippet);
  }

  console.log("[SPLAT] Current config:", config);
  window.__splatConfig = config;
};

const applyConfig = (config, viewer, splatScene, THREE) => {
  if (viewer.camera) {
    viewer.camera.position.set(
      config.cameraPosition[0],
      config.cameraPosition[1],
      config.cameraPosition[2],
    );
    viewer.camera.lookAt(
      config.cameraLookAt[0],
      config.cameraLookAt[1],
      config.cameraLookAt[2],
    );
  }

  if (splatScene) {
    splatScene.position.set(
      config.splatPosition[0],
      config.splatPosition[1],
      config.splatPosition[2],
    );
    splatScene.scale.setScalar(config.splatScale);

    const euler = new THREE.Euler(
      config.splatRotationX,
      config.splatRotationY,
      config.splatRotationZ,
    );
    splatScene.quaternion.setFromEuler(euler);
  }

  if (viewer.splatMesh) {
    viewer.splatMesh.splatAlphaRemovalThreshold = config.alphaThreshold;
    viewer.splatMesh.updateTransforms?.();
  }

  viewer.forceRenderNextFrame?.();
  window.__splatConfig = config;
  console.log("[SPLAT] Config applied:", config);
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
    #splat-debug-panel .splat-debug-hint {
      margin: 8px 0 0;
      color: #64748b;
      font-size: 10px;
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);
};

const buildDebugPanel = ({
  config,
  viewer,
  splatScene,
  defaults,
  THREE,
  onApply,
  onCopy,
  onReset,
  onSave,
  onClear,
}) => {
  injectDebugPanelStyles();

  const existing = document.getElementById("splat-debug-panel");
  existing?.remove();

  const panel = document.createElement("div");
  panel.id = "splat-debug-panel";
  panel.innerHTML = `
    <h2>Splat Debug</h2>
    <div class="splat-debug-section" data-section="camera"></div>
    <div class="splat-debug-section" data-section="splat"></div>
    <div class="splat-debug-actions">
      <button type="button" data-action="copy">Copy Config (C)</button>
      <button type="button" data-action="reset">Reset (R)</button>
      <button type="button" data-action="save">Save to Local Storage</button>
      <button type="button" data-action="clear">Clear Saved Config</button>
    </div>
    <p class="splat-debug-hint">Drag with mouse to orbit. Press C to copy, R to reset. Config is on window.__splatConfig</p>
  `;
  document.body.appendChild(panel);

  const fields = {};
  const cameraSection = panel.querySelector('[data-section="camera"]');
  const splatSection = panel.querySelector('[data-section="splat"]');

  cameraSection.innerHTML =
    '<p class="splat-debug-section-title">Camera</p>';
  splatSection.innerHTML = '<p class="splat-debug-section-title">Splat</p>';

  const addField = (section, key, label, min, max, step, getValue, setValue) => {
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

  const addVectorFields = (section, prefix, labels, targetKey, min, max, step) => {
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
      );
    });
  };

  addVectorFields(cameraSection, "camPos", ["px", "py", "pz"], "cameraPosition", -20, 20, 0.01);
  addVectorFields(
    cameraSection,
    "camLook",
    ["lx", "ly", "lz"],
    "cameraLookAt",
    -10,
    10,
    0.01,
  );
  addVectorFields(splatSection, "splatPos", ["px", "py", "pz"], "splatPosition", -10, 10, 0.01);

  addField(
    splatSection,
    "splatScale",
    "scale",
    0.01,
    5,
    0.01,
    () => config.splatScale,
    (value) => {
      config.splatScale = value;
    },
  );

  addField(
    splatSection,
    "rotX",
    "rx",
    -3.14,
    3.14,
    0.01,
    () => config.splatRotationX,
    (value) => {
      config.splatRotationX = value;
    },
  );
  addField(
    splatSection,
    "rotY",
    "ry",
    -3.14,
    3.14,
    0.01,
    () => config.splatRotationY,
    (value) => {
      config.splatRotationY = value;
    },
  );
  addField(
    splatSection,
    "rotZ",
    "rz",
    -3.14,
    3.14,
    0.01,
    () => config.splatRotationZ,
    (value) => {
      config.splatRotationZ = value;
    },
  );
  addField(
    splatSection,
    "alphaThreshold",
    "alpha",
    0,
    50,
    1,
    () => config.alphaThreshold,
    (value) => {
      config.alphaThreshold = value;
    },
  );

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

  const syncCameraFromViewer = () => {
    if (!viewer.camera) {
      return;
    }

    config.cameraPosition[0] = viewer.camera.position.x;
    config.cameraPosition[1] = viewer.camera.position.y;
    config.cameraPosition[2] = viewer.camera.position.z;

    fields.camPos0.slider.value = String(config.cameraPosition[0]);
    fields.camPos0.number.value = String(config.cameraPosition[0]);
    fields.camPos1.slider.value = String(config.cameraPosition[1]);
    fields.camPos1.number.value = String(config.cameraPosition[1]);
    fields.camPos2.slider.value = String(config.cameraPosition[2]);
    fields.camPos2.number.value = String(config.cameraPosition[2]);

    window.__splatConfig = config;
  };

  return { refreshInputs, syncCameraFromViewer, fields };
};

const cloneDefaultConfig = (defaults) => ({
  cameraPosition: [...defaults.cameraPosition],
  cameraLookAt: [...defaults.cameraLookAt],
  splatPosition: [...defaults.splatPosition],
  splatScale: defaults.splatScale,
  splatRotationX: defaults.splatRotationX,
  splatRotationY: defaults.splatRotationY,
  splatRotationZ: defaults.splatRotationZ,
  alphaThreshold: defaults.alphaThreshold,
});

const initDebugMode = async (viewer, isMobile) => {
  const THREE = await import("three");

  const splatScene = viewer.getSplatScene(0);
  const defaults = {
    cameraPosition: [...SPLAT_CONFIG.cameraPosition],
    cameraLookAt: [...SPLAT_CONFIG.cameraLookAt],
    splatPosition: [...SPLAT_CONFIG.splatPosition],
    splatScale: isMobile ? SPLAT_CONFIG.splatScale * 0.73 : SPLAT_CONFIG.splatScale,
    splatRotationX: 0,
    splatRotationY: 0,
    splatRotationZ: 0,
    alphaThreshold: SPLAT_CONFIG.alphaThreshold,
  };

  let config = cloneDefaultConfig(defaults);

  try {
    const saved = localStorage.getItem(SPLAT_DEBUG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
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
  } catch {
    // Ignore invalid saved config.
  }

  window.__splatConfig = config;
  console.log("[SPLAT] Debug mode enabled. Current config:", config);

  applyConfig(config, viewer, splatScene, THREE);

  let panelApi = null;

  const handleApply = () => {
    applyConfig(config, viewer, splatScene, THREE);
  };

  const handleCopy = () => {
    copyConfig(config);
  };

  const handleReset = () => {
    Object.assign(config, cloneDefaultConfig(defaults));
    applyConfig(config, viewer, splatScene, THREE);
    panelApi?.refreshInputs();
    showToast("Config reset.");
    console.log("[SPLAT] Config reset:", config);
  };

  const handleSave = () => {
    localStorage.setItem(SPLAT_DEBUG_STORAGE_KEY, JSON.stringify(config));
    showToast("Saved to localStorage.");
    console.log("[SPLAT] Config saved:", config);
  };

  const handleClear = () => {
    localStorage.removeItem(SPLAT_DEBUG_STORAGE_KEY);
    showToast("Saved config cleared.");
    console.log("[SPLAT] Saved config cleared.");
  };

  panelApi = buildDebugPanel({
    config,
    viewer,
    splatScene,
    defaults,
    THREE,
    onApply: handleApply,
    onCopy: handleCopy,
    onReset: handleReset,
    onSave: handleSave,
    onClear: handleClear,
  });

  panelApi.refreshInputs();

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
    panelApi.syncCameraFromViewer();
    viewer.forceRenderNextFrame?.();
    requestAnimationFrame(syncLoop);
  };

  requestAnimationFrame(syncLoop);
};

initSplat();
