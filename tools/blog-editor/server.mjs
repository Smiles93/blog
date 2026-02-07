import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { marked } from "marked";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");
const PUBLIC_DIR = path.join(__dirname, "public");
const ASTRO_BLOG_DIR = path.join(ROOT_DIR, "src", "content", "blog");
const HUGO_BLOG_DIR = path.join(ROOT_DIR, "content", "blog");
const PORT = Number(process.env.PORT || 4322);
const HOST = process.env.HOST || "127.0.0.1";
let BLOG_DIR = ASTRO_BLOG_DIR;
let MODE = "astro";

try {
  await fs.access(HUGO_BLOG_DIR);
  BLOG_DIR = HUGO_BLOG_DIR;
  MODE = "hugo";
} catch {
  // fallback to astro
}

const EXTENSION = MODE === "hugo" ? ".md" : ".mdx";
const VALID_EXTENSIONS = MODE === "hugo" ? [".md"] : [".md", ".mdx"];

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, body) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

async function sendFile(res, filePath) {
  try {
    const file = await fs.readFile(filePath);
    const contentType = MIME.get(path.extname(filePath)) || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    res.end(file);
  } catch {
    sendText(res, 404, "Not found");
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function sanitizeSlug(slug) {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function yamlString(value) {
  const safe = String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${safe}"`;
}

function buildAstroFrontmatter(data) {
  const lines = ["---"];
  lines.push(`title: ${yamlString(data.title)}`);
  lines.push(`description: ${yamlString(data.summary)}`);
  lines.push(`pubDate: ${yamlString(data.date)}`);
  if (data.tags?.length) {
    lines.push(`tags: [${data.tags.map(yamlString).join(", ")}]`);
  }
  if (data.kind) lines.push(`kind: ${yamlString(data.kind)}`);
  if (data.draft === true) lines.push("published: false");
  lines.push("---");
  return lines.join("\n");
}

function buildHugoFrontmatter(data) {
  const lines = ["---"];
  lines.push(`title: ${yamlString(data.title)}`);
  lines.push(`date: ${yamlString(data.date)}`);
  if (data.summary) lines.push(`summary: ${yamlString(data.summary)}`);
  if (data.tags?.length) {
    lines.push(`tags: [${data.tags.map(yamlString).join(", ")}]`);
  }
  if (data.kind) lines.push(`kind: ${yamlString(data.kind)}`);
  if (data.draft === true) lines.push("draft: true");
  lines.push("---");
  return lines.join("\n");
}

function buildFrontmatter(mode, data) {
  return mode === "hugo" ? buildHugoFrontmatter(data) : buildAstroFrontmatter(data);
}

function parseDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

async function runGit(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: ROOT_DIR });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `git ${args.join(" ")} failed`));
      }
    });
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/config") {
    return sendJson(res, 200, {
      ok: true,
      mode: MODE,
      blogDir: path.relative(ROOT_DIR, BLOG_DIR),
      extension: EXTENSION,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/posts") {
    try {
      const entries = await fs.readdir(BLOG_DIR, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => !name.startsWith("_"))
        .filter((name) => VALID_EXTENSIONS.includes(path.extname(name)));

      const posts = [];
      for (const name of files) {
        const filePath = path.join(BLOG_DIR, name);
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = matter(raw);
        const dateValue =
          MODE === "hugo"
            ? parsed.data.date || parsed.data.publishDate || parsed.data.pubDate
            : parsed.data.pubDate;
        posts.push({
          file: name,
          title: parsed.data.title || name,
          pubDate: parseDate(dateValue),
        });
      }
      posts.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || ""));
      return sendJson(res, 200, { ok: true, posts });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/post") {
    const file = url.searchParams.get("file");
    if (!file) return sendJson(res, 400, { ok: false, error: "Missing file" });
    const safeName = path.basename(file);
    if (safeName.startsWith("_")) {
      return sendJson(res, 400, { ok: false, error: "Invalid file name" });
    }
    if (!VALID_EXTENSIONS.includes(path.extname(safeName))) {
      return sendJson(res, 400, { ok: false, error: "Invalid file type" });
    }
    const filePath = path.join(BLOG_DIR, safeName);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = matter(raw);
      const dateValue =
        MODE === "hugo"
          ? parsed.data.date || parsed.data.publishDate || parsed.data.pubDate
          : parsed.data.pubDate;
      const summaryValue =
        MODE === "hugo"
          ? parsed.data.summary || parsed.data.description || ""
          : parsed.data.description || "";
      const draftValue =
        MODE === "hugo" ? parsed.data.draft === true : parsed.data.published === false;
      return sendJson(res, 200, {
        ok: true,
        post: {
          file: safeName,
          data: {
            title: parsed.data.title || "",
            summary: summaryValue || "",
            date: parseDate(dateValue),
            tags: parsed.data.tags || [],
            kind: parsed.data.kind || "",
            draft: draftValue,
          },
          content: parsed.content.trimStart(),
        },
      });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/preview") {
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { ok: false, error: "Invalid JSON" });
    const html = marked.parse(body.markdown || "");
    return sendJson(res, 200, { ok: true, html });
  }

  if (req.method === "POST" && url.pathname === "/api/save") {
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { ok: false, error: "Invalid JSON" });

    const slug = sanitizeSlug(body.slug || "");
    if (!slug) return sendJson(res, 400, { ok: false, error: "Slug is required" });
    if (!body.title || !body.date) {
      return sendJson(res, 400, { ok: false, error: "Title and date are required" });
    }
    if (MODE === "astro" && !body.summary) {
      return sendJson(res, 400, { ok: false, error: "Summary is required" });
    }

    const filename = `${slug}${EXTENSION}`;
    const filePath = path.join(BLOG_DIR, filename);
    const relPath = path.relative(ROOT_DIR, filePath);

    const frontmatter = buildFrontmatter(MODE, {
      title: body.title,
      summary: body.summary || "",
      date: body.date,
      tags: body.tags || [],
      kind: body.kind || "",
      draft: body.draft === true,
    });

    const content = `${frontmatter}\n\n${body.content || ""}\n`;

    try {
      await fs.writeFile(filePath, content, "utf8");
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }

    if (body.commit) {
      try {
        await runGit(["add", relPath]);
        const commitMessage = body.commitMessage || `post: ${body.title}`;
        await runGit(["commit", "-m", commitMessage]);
      } catch (error) {
        return sendJson(res, 500, { ok: false, error: error.message });
      }
    }

    if (body.push) {
      try {
        const { stdout } = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
        const branch = stdout.trim();
        await runGit(["push", "origin", branch]);
      } catch (error) {
        return sendJson(res, 500, { ok: false, error: error.message });
      }
    }

    return sendJson(res, 200, { ok: true, file: filename });
  }

  return sendJson(res, 404, { ok: false, error: "Not found" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    return handleApi(req, res, url);
  }

  if (req.method === "GET" && url.pathname === "/") {
    return sendFile(res, path.join(PUBLIC_DIR, "index.html"));
  }

  if (req.method === "GET" && url.pathname === "/app.js") {
    return sendFile(res, path.join(PUBLIC_DIR, "app.js"));
  }

  if (req.method === "GET" && url.pathname === "/style.css") {
    return sendFile(res, path.join(PUBLIC_DIR, "style.css"));
  }

  return sendText(res, 404, "Not found");
});

server.listen(PORT, HOST, () => {
  const hostLabel = HOST === "127.0.0.1" ? "localhost" : HOST;
  console.log(`Blog editor running on http://${hostLabel}:${PORT}`);
});
