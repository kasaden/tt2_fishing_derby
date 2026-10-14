// Local development server: serves site/ on localhost, the folder Cloudflare Pages publishes. Copied from tt2_monuments/server.js.
// Usage: node server.js   (PORT=8080 node server.js for another port)

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "site"); // only the published folder, as Cloudflare Pages serves it
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4192);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

/**
 * Maps a URL path to a file inside `root`, or null when the path must not be served:
 * a malformed escape, a backslash or NUL, a step out of the root, a dotfile or dot folder.
 * A path ending with "/" serves that folder's index.html.
 */
export function resolveStaticPath(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\\") || decoded.includes("\0")) return null;

  const segments = decoded.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) return null;

  if (segments.length === 0 || decoded.endsWith("/")) segments.push("index.html");
  return path.join(root, ...segments);
}

/** The request handler: serves files under `root`, 404 for anything it will not serve. */
export function createRequestHandler(root) {
  return async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" }).end("Method not allowed");
      return;
    }

    try {
      // inside the try: a request URL that cannot be parsed must give a 404, not crash the server
      const file = resolveStaticPath(root, new URL(request.url, `http://${HOST}`).pathname);
      if (!file) throw new Error("not served");
      const body = await fs.readFile(file);
      response.writeHead(200, {
        "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store"
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    }
  };
}

function startServer() {
  const server = http.createServer(createRequestHandler(ROOT));
  server.listen(PORT, HOST, () => console.log(`TT2 Fishing Derby Optimizer on http://${HOST}:${PORT}/`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startServer();
