const year = document.querySelector("#year");

if (year) {
  year.textContent = new Date().getFullYear();
}

const cards = document.querySelectorAll(".project-card, .hero-card");

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

const lerp = (from, to, amount) => from + (to - from) * amount;

const getScrollProgress = () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;

  return Math.min(Math.max(progress, 0), 1);
};

const getQuaternionFromEuler = (rotationX, rotationY) => {
  const halfX = rotationX / 2;
  const halfY = rotationY / 2;
  const sinX = Math.sin(halfX);
  const cosX = Math.cos(halfX);
  const sinY = Math.sin(halfY);
  const cosY = Math.cos(halfY);

  return {
    x: sinX * cosY,
    y: cosX * sinY,
    z: sinX * sinY,
    w: cosX * cosY,
  };
};

const rotateVectorByQuaternion = (vector, quaternion) => {
  const { x, y, z } = vector;
  const qx = quaternion.x;
  const qy = quaternion.y;
  const qz = quaternion.z;
  const qw = quaternion.w;

  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
};

const getLocalSplatCenter = (viewer) => {
  const boundingBox = viewer.splatMesh?.computeBoundingBox?.(false, 0);

  if (!boundingBox?.min || !boundingBox?.max) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: (boundingBox.min.x + boundingBox.max.x) / 2,
    y: (boundingBox.min.y + boundingBox.max.y) / 2,
    z: (boundingBox.min.z + boundingBox.max.z) / 2,
  };
};

const setStatus = (state) => {
  if (splatLoader) {
    splatLoader.hidden = state !== "loading";
  }

  if (splatError) {
    splatError.hidden = state !== "error";
  }
};

const getSplatUrl = () => {
  const productionUrl = splatContainer?.dataset.splatSrc;
  const localUrl = splatContainer?.dataset.localSplatSrc;
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  return isLocalhost && localUrl ? localUrl : productionUrl;
};

const initSplat = async () => {
  if (!splatContainer) {
    return;
  }

  const splatUrl = getSplatUrl();

  if (!splatUrl) {
    setStatus("error");
    return;
  }

  setStatus("loading");

  try {
    const GaussianSplats3D = await import(SPLAT_RENDERER_URL);
    const isMobile = window.matchMedia("(max-width: 700px)").matches;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const splatScale = isMobile ? 0.58 : 0.82;

    const viewer = new GaussianSplats3D.Viewer({
      rootElement: splatContainer,
      cameraUp: [0, 1, 0],
      initialCameraPosition: [0, 0.08, isMobile ? 4.2 : 3.6],
      initialCameraLookAt: [0, 0, 0],
      useBuiltInControls: false,
      dynamicScene: true,
      ignoreDevicePixelRatio: isMobile,
      gpuAcceleratedSort: !isMobile,
      sharedMemoryForWorkers: false,
      halfPrecisionCovariancesOnGPU: isMobile,
      sphericalHarmonicsDegree: 0,
      freeIntermediateSplatData: true,
      logLevel: GaussianSplats3D.LogLevel.None,
      renderMode: GaussianSplats3D.RenderMode.Always,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
      webXRMode: GaussianSplats3D.WebXRMode.None,
    });

    await viewer.addSplatScene(splatUrl, {
      format: GaussianSplats3D.SceneFormat.Ply,
      progressiveLoad: true,
      showLoadingUI: false,
      splatAlphaRemovalThreshold: isMobile ? 12 : 5,
      scale: [splatScale, splatScale, splatScale],
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
    });

    const splatScene = viewer.getSplatScene(0);
    const localCenter = getLocalSplatCenter(viewer);
    let currentRotationX = 0;
    let currentRotationY = 0;

    setStatus("ready");
    viewer.start();

    const updateSplatRotation = () => {
      const progress = getScrollProgress();
      const targetRotationY = prefersReducedMotion ? 0 : progress * Math.PI * 2;
      const targetRotationX = prefersReducedMotion ? 0 : progress * 0.25;

      currentRotationY = lerp(currentRotationY, targetRotationY, 0.09);
      currentRotationX = lerp(currentRotationX, targetRotationX, 0.09);

      const quaternion = getQuaternionFromEuler(currentRotationX, currentRotationY);
      const rotatedCenter = rotateVectorByQuaternion(
        {
          x: localCenter.x * splatScale,
          y: localCenter.y * splatScale,
          z: localCenter.z * splatScale,
        },
        quaternion,
      );

      splatScene.quaternion.set(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w,
      );
      splatScene.position.set(
        -rotatedCenter.x,
        -rotatedCenter.y,
        -rotatedCenter.z,
      );

      viewer.splatMesh.updateTransforms();
      viewer.forceRenderNextFrame();
      requestAnimationFrame(updateSplatRotation);
    };

    requestAnimationFrame(updateSplatRotation);
  } catch (error) {
    window.__splatDebugError = error?.stack || error?.message || String(error);
    console.error("Unable to load Gaussian splat:", error);
    setStatus("error");
  }
};

// Production loads the splat from `data-splat-src`, which should be a public R2
// or static asset host URL with CORS enabled. The ignored local `.ply` path is
// only for localhost testing because the file is too large for GitHub/Pages.
initSplat();
