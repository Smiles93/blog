const $ = (selector) => document.querySelector(selector);

const modeInfo = $("#modeInfo");
const postSelect = $("#postSelect");
const titleInput = $("#title");
const slugInput = $("#slug");
const dateInput = $("#date");
const summaryInput = $("#summary");
const tagsInput = $("#tags");
const kindInput = $("#kind");
const draftInput = $("#draft");
const contentInput = $("#content");
const commitInput = $("#commitMessage");
const previewTitle = $("#previewTitle");
const previewMeta = $("#previewMeta");
const previewBody = $("#previewBody");
const statusEl = $("#status");
const saveButton = $("#save");
const postButton = $("#post");

let slugTouched = false;
let commitTouched = false;
let previewTimer = null;

const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`.trim();
}

function updateSlug() {
  if (slugTouched) return;
  slugInput.value = slugify(titleInput.value);
}

function updateCommitMessage() {
  if (commitTouched) return;
  const title = titleInput.value.trim();
  commitInput.value = title ? `post: ${title}` : "";
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 200);
}

async function renderPreview() {
  const title = titleInput.value.trim() || "Untitled";
  const date = dateInput.value || "";
  const tags = tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  previewTitle.textContent = title;
  previewMeta.textContent = [date, tags.join(", ")].filter(Boolean).join(" • ");

  const response = await fetch("/api/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ markdown: contentInput.value }),
  });

  const payload = await response.json();
  if (!payload.ok) {
    previewBody.innerHTML = `<p>Preview error: ${payload.error}</p>`;
    return;
  }
  previewBody.innerHTML = payload.html || "";
}

function collectPayload() {
  const title = titleInput.value.trim();
  const summary = summaryInput.value.trim();
  const slug = slugify(slugInput.value.trim() || title);
  const date = dateInput.value;
  const tags = tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const kind = kindInput.value.trim();

  return {
    title,
    summary,
    slug,
    date,
    tags,
    kind,
    draft: draftInput.checked,
    content: contentInput.value,
    commitMessage: commitInput.value.trim(),
  };
}

function validate(payload) {
  if (!payload.title) return "Title is required.";
  if (!payload.date) return "Date is required.";
  if (!payload.slug) return "Slug is required.";
  return "";
}

async function savePost({ commit, push }) {
  const payload = collectPayload();
  const error = validate(payload);
  if (error) {
    setStatus(error, "error");
    return;
  }

  saveButton.disabled = true;
  postButton.disabled = true;
  setStatus(commit ? "Posting..." : "Saving...");

  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, commit, push }),
    });
    const result = await response.json();
    if (!result.ok) {
      setStatus(result.error || "Failed to save.", "error");
    } else {
      setStatus(commit ? "Posted and pushed successfully." : "Draft saved locally.", "success");
      await loadPosts();
      if (!slugTouched) slugInput.value = payload.slug;
    }
  } catch (err) {
    setStatus(err.message || "Failed to save.", "error");
  } finally {
    saveButton.disabled = false;
    postButton.disabled = false;
  }
}

async function loadConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) return;
  const payload = await response.json();
  if (!payload.ok) return;
  modeInfo.textContent = `Writing to ${payload.blogDir} (${payload.mode})`;
}

async function loadPosts() {
  const response = await fetch("/api/posts");
  const payload = await response.json();
  if (!payload.ok) return;
  postSelect.innerHTML = `<option value="">New post</option>`;
  for (const post of payload.posts) {
    const option = document.createElement("option");
    option.value = post.file;
    option.textContent = post.title || post.file;
    postSelect.appendChild(option);
  }
}

async function loadPost(file) {
  const response = await fetch(`/api/post?file=${encodeURIComponent(file)}`);
  const payload = await response.json();
  if (!payload.ok) {
    setStatus(payload.error || "Failed to load post.", "error");
    return;
  }

  const { data, content } = payload.post;
  titleInput.value = data.title || "";
  summaryInput.value = data.summary || "";
  dateInput.value = data.date || today;
  tagsInput.value = (data.tags || []).join(", ");
  kindInput.value = data.kind || "";
  draftInput.checked = !!data.draft;
  contentInput.value = content;

  slugInput.value = file.replace(/\.(md|mdx)$/i, "");
  slugTouched = true;
  commitTouched = false;
  updateCommitMessage();
  schedulePreview();
}

titleInput.addEventListener("input", () => {
  updateSlug();
  updateCommitMessage();
  schedulePreview();
});

slugInput.addEventListener("input", () => {
  slugTouched = true;
});

commitInput.addEventListener("input", () => {
  commitTouched = true;
});

summaryInput.addEventListener("input", schedulePreview);
tagsInput.addEventListener("input", schedulePreview);
kindInput.addEventListener("change", schedulePreview);
dateInput.addEventListener("input", schedulePreview);
draftInput.addEventListener("change", schedulePreview);
contentInput.addEventListener("input", schedulePreview);

postSelect.addEventListener("change", (event) => {
  const value = event.target.value;
  if (!value) {
    slugTouched = false;
    commitTouched = false;
    titleInput.value = "";
    summaryInput.value = "";
    tagsInput.value = "";
    kindInput.value = "";
    draftInput.checked = false;
    contentInput.value = "";
    dateInput.value = today;
    slugInput.value = "";
    commitInput.value = "";
    schedulePreview();
    return;
  }
  loadPost(value);
});

saveButton.addEventListener("click", () => savePost({ commit: false, push: false }));
postButton.addEventListener("click", () => savePost({ commit: true, push: true }));

Promise.all([loadConfig(), loadPosts()]).then(renderPreview);
