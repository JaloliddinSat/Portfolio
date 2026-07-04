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

const SPLAT_RENDERER_URL =
  "https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.7/build/gaussian-splats-3d.module.js";

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

    const viewer = new GaussianSplats3D.Viewer({
      rootElement: splatContainer,
      cameraUp: [0, -1, 0],
      initialCameraPosition: [0, 0.15, isMobile ? 3.2 : 2.6],
      initialCameraLookAt: [0, 0, 0],
      useBuiltInControls: false,
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
      splatAlphaRemovalThreshold: isMobile ? 12 : 5,
      scale: [isMobile ? 0.55 : 0.75, isMobile ? 0.55 : 0.75, isMobile ? 0.55 : 0.75],
      position: [0, 0, 0],
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

    const cameraRadius = isMobile ? 3.2 : 2.6;

    const animate = () => {
      const progress = getScrollProgress();
      const angle = progress * Math.PI * 2;

      if (viewer.camera) {
        viewer.camera.position.x = Math.sin(angle) * cameraRadius;
        viewer.camera.position.z = Math.cos(angle) * cameraRadius;
        viewer.camera.position.y = 0.15 + progress * 0.35;
        viewer.camera.lookAt(0, 0, 0);
      }

      viewer.forceRenderNextFrame?.();
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  } catch (error) {
    const message = error?.stack || error?.message || String(error);

    window.__splatDebugError = message;
    console.error("[SPLAT] Failed:", error);

    setStatus("error", "The splat could not be loaded. Check console.");
  }
};

initSplat();
