const MAX_FILE_SIZE = 10 * 1024 * 1024;

const loadingView = document.querySelector("#loading-view");
const loginView = document.querySelector("#login-view");
const uploadView = document.querySelector("#upload-view");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const uploadForm = document.querySelector("#upload-form");
const uploadStatus = document.querySelector("#upload-status");
const fileInput = document.querySelector("#resume-file");
const dropZone = document.querySelector("#drop-zone");
const fileRow = document.querySelector("#file-row");
const fileName = document.querySelector("#file-name");
const fileSize = document.querySelector("#file-size");
const uploadButton = document.querySelector("#upload-button");
const progress = document.querySelector("#progress");
const progressBar = document.querySelector("#progress-bar");
const currentFile = document.querySelector("#current-file");
const currentFileDate = document.querySelector("#current-file-date");
let selectedFile = null;

const setStatus = (element, message = "", state = "") => {
  element.textContent = message;
  element.dataset.state = state;
};

const showView = (view) => {
  [loadingView, loginView, uploadView].forEach((element) => {
    element.hidden = element !== view;
  });
};

const formatDate = (value) => {
  if (!value) return "";
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))}`;
};

const updatePublishedFile = (resume) => {
  currentFile.hidden = !resume;
  currentFileDate.textContent = resume ? formatDate(resume.uploadedAt) : "";
};

const request = async (path, options = {}) => {
  const response = await fetch(`/api/admin/${path}`, {
    credentials: "same-origin",
    ...options,
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(result.error || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }

  return result;
};

const clearSelectedFile = () => {
  selectedFile = null;
  fileInput.value = "";
  fileRow.hidden = true;
  uploadButton.disabled = true;
  setStatus(uploadStatus);
};

const selectFile = (file) => {
  if (!file) return;

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    clearSelectedFile();
    setStatus(uploadStatus, "Please choose a PDF file.", "error");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    clearSelectedFile();
    setStatus(uploadStatus, "The PDF must be 10 MB or smaller.", "error");
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  fileRow.hidden = false;
  uploadButton.disabled = false;
  setStatus(uploadStatus);
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  setStatus(loginStatus, "Signing in…");

  try {
    const formData = new FormData(loginForm);
    const result = await request("login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    updatePublishedFile(result.resume);
    loginForm.reset();
    showView(uploadView);
  } catch (error) {
    setStatus(loginStatus, error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await request("logout", { method: "POST" });
  } finally {
    clearSelectedFile();
    showView(loginView);
    document.querySelector("#password").focus();
  }
});

fileInput.addEventListener("change", () => selectFile(fileInput.files[0]));
document.querySelector("#clear-file").addEventListener("click", clearSelectedFile);

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
});

dropZone.addEventListener("drop", (event) => selectFile(event.dataTransfer.files[0]));

uploadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedFile) return;

  uploadButton.disabled = true;
  progress.hidden = false;
  progressBar.style.width = "0%";
  setStatus(uploadStatus, "Uploading…");

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/admin/resume");
  xhr.setRequestHeader("Content-Type", "application/pdf");
  xhr.setRequestHeader("X-File-Name", encodeURIComponent(selectedFile.name));
  xhr.upload.addEventListener("progress", (progressEvent) => {
    if (progressEvent.lengthComputable) {
      progressBar.style.width = `${Math.round((progressEvent.loaded / progressEvent.total) * 100)}%`;
    }
  });
  xhr.addEventListener("load", () => {
    const result = (() => {
      try { return JSON.parse(xhr.responseText); } catch (_) { return {}; }
    })();

    progressBar.style.width = xhr.status >= 200 && xhr.status < 300 ? "100%" : "0%";
    if (xhr.status >= 200 && xhr.status < 300) {
      setStatus(uploadStatus, "Your résumé is now live.", "success");
      updatePublishedFile(result.resume);
      selectedFile = null;
      fileInput.value = "";
      fileRow.hidden = true;
    } else if (xhr.status === 401) {
      showView(loginView);
      setStatus(loginStatus, "Your session expired. Please sign in again.", "error");
    } else {
      setStatus(uploadStatus, result.error || "The upload failed. Please try again.", "error");
    }
    uploadButton.disabled = !selectedFile;
    window.setTimeout(() => { progress.hidden = true; }, 500);
  });
  xhr.addEventListener("error", () => {
    setStatus(uploadStatus, "The upload failed. Check your connection and try again.", "error");
    uploadButton.disabled = false;
    progress.hidden = true;
  });
  xhr.send(selectedFile);
});

const themeToggle = document.querySelector("#theme-toggle");
const themeLabel = document.querySelector("[data-theme-label]");
const syncThemeLabel = () => {
  const isLight = document.documentElement.dataset.theme === "light";
  themeLabel.textContent = isLight ? "Dark" : "Light";
  themeToggle.setAttribute("aria-label", `Switch to ${isLight ? "dark" : "light"} theme`);
};

themeToggle.addEventListener("click", () => {
  const isLight = document.documentElement.dataset.theme === "light";
  document.documentElement.dataset.theme = isLight ? "dark" : "light";
  localStorage.setItem("site-theme", isLight ? "dark" : "light");
  syncThemeLabel();
});
syncThemeLabel();

request("session")
  .then((result) => {
    updatePublishedFile(result.resume);
    showView(uploadView);
  })
  .catch(() => showView(loginView));
