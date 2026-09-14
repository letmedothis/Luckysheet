import { createServer } from "node:http";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";

const repositoryRoot = resolve(new URL("../..", import.meta.url).pathname);
const port = Number(process.env.P1_01_PORT || 41731);
const edgeCandidates = [
  process.env.P1_01_BROWSER,
  "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function findBrowser() {
  for (const candidate of edgeCandidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch (_error) {
      // Try the next local browser path.
    }
  }
  throw new Error(
    "No supported local Edge executable found. Set P1_01_BROWSER."
  );
}

function staticServer(request, response) {
  const pathname = decodeURIComponent(
    new URL(request.url, "http://localhost").pathname
  );
  const relative = normalize(pathname).replace(/^([/\\])+/, "");
  const filePath = join(
    repositoryRoot,
    relative || "tests/p1-01/baseline.html"
  );
  if (!filePath.startsWith(repositoryRoot)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  readFile(filePath)
    .then(data => {
      response.writeHead(200, {
        "Content-Type":
          mimeTypes[extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(data);
    })
    .catch(() => response.writeHead(404).end("Not found"));
}

function runBrowser(browser, url) {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-pings",
    "--user-data-dir=C:\\Temp\\luckysheet-p1-01-edge",
    "--window-size=1440,900",
    "--virtual-time-budget=15000",
    "--dump-dom",
    url,
  ];
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(browser, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => (stdout += chunk));
    child.stderr.on("data", chunk => (stderr += chunk));
    child.on("error", rejectPromise);
    child.on("close", code => {
      if (code !== 0) {
        rejectPromise(new Error(`Browser exited with ${code}: ${stderr}`));
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

function parseResult(html) {
  const match = html.match(/<pre id="p1-01-result"[^>]*>([\s\S]*?)<\/pre>/);
  if (!match) throw new Error("Baseline page did not emit a completed result.");
  const decoded = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return JSON.parse(decoded);
}

const browser = await findBrowser();
const server = createServer(staticServer);
await new Promise((resolvePromise, rejectPromise) => {
  server.once("error", rejectPromise);
  server.listen(port, "0.0.0.0", resolvePromise);
});

try {
  const { stdout, stderr } = await runBrowser(
    browser,
    `http://localhost:${port}/tests/p1-01/baseline.html`
  );
  const result = parseResult(stdout);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (stderr.trim()) process.stderr.write(stderr);
  if (result.harnessFailure) process.exitCode = 1;
} finally {
  await new Promise(resolvePromise => server.close(resolvePromise));
}
