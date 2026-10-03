// Serves dist/ for group.ashikanw.com (behind the Cloudflare Tunnel). No dependencies: node serve.mjs
// "/" goes to /ja-jp/ or /en-us/ (cookie, then the browser's language); unknown paths get that language's 404 page.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const PORT = Number(process.env.PORT || 4400);
const HOST = process.env.HOST || "127.0.0.1";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
};
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

function language(req) {
  const cookie = /(?:^|;\s*)ashika_lang=(ja-jp|en-us)/.exec(req.headers.cookie || "");
  if (cookie) return cookie[1];
  return /^\s*ja\b/i.test(req.headers["accept-language"] || "ja") ? "ja-jp" : "en-us";
}

async function file(path) {
  try {
    const info = await stat(path);
    return info.isDirectory() ? file(join(path, "index.html")) : { body: await readFile(path), path };
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", ...SECURITY }).end();
    return;
  }
  if (url.pathname === "/") {
    res.writeHead(302, { Location: `/${language(req)}/`, Vary: "Accept-Language, Cookie", ...SECURITY }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = "/";
  }
  const target = normalize(join(DIST, pathname));
  let found = target.startsWith(DIST + sep) ? await file(target) : null;
  if (found && /\/(ja-jp|en-us)$/.test(pathname)) {
    res.writeHead(301, { Location: pathname + "/" + url.search, ...SECURITY }).end();
    return;
  }
  let status = 200;
  if (!found) {
    status = 404;
    const lang = pathname.startsWith("/en-us") ? "en-us" : pathname.startsWith("/ja-jp") ? "ja-jp" : language(req);
    found = await file(join(DIST, lang, "404.html"));
  }
  const type = TYPES[extname(found.path)] || "application/octet-stream";
  const cache = found.path.includes(`${sep}assets${sep}`) ? "public, max-age=604800" : "public, max-age=300";
  res.writeHead(status, { "Content-Type": type, "Cache-Control": cache, ...SECURITY });
  res.end(req.method === "HEAD" ? undefined : found.body);
}).listen(PORT, HOST, () => console.log(`ASHIKA Group site on http://${HOST}:${PORT}`));
