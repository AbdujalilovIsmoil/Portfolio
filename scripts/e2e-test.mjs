/**
 * End-to-end smoke test: loads the production build in Chrome with every external host blocked,
 * waits for all background model loading, and fails on any page error, console error, or failed request.
 *
 *   npm run build && npm run test:e2e
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = process.env.PORT ?? "3101";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!existsSync(CHROME)) {
  console.log(`SKIP: Chrome not found at ${CHROME} (set CHROME_PATH)`);
  process.exit(0);
}

const server = spawn("npx", ["next", "start", "-p", PORT], { stdio: "ignore" });
const problems = [];
const models = new Set();
let draco = false;
let browser;
try {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}`)).ok) break;
    } catch {}
    await sleep(500);
  }
  browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-angle=metal", "--ignore-gpu-blocklist"], defaultViewport: { width: 1280, height: 720 } });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.hostname !== "localhost" && !url.protocol.startsWith("data") && !url.protocol.startsWith("blob")) return req.abort(); // simulate no third-party access
    req.continue();
  });
  page.on("pageerror", (e) => problems.push("page error: " + e.message));
  page.on("console", (m) => m.type() === "error" && problems.push("console error: " + m.text().slice(0, 200)));
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.pathname.endsWith(".glb")) models.add(u.pathname);
    if (u.pathname.startsWith("/draco/")) draco = true;
    if (u.hostname === "localhost" && r.status() >= 400) problems.push(`HTTP ${r.status()} ${u.pathname}`);
  });
  await page.goto(`http://localhost:${PORT}`);
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Start/.test(b.textContent)), { timeout: 90000 });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Start/.test(b.textContent)).click());
  await sleep(45000); // background loading of every room, the city, the cars…

  console.log(`models downloaded: ${models.size}, own Draco decoder used: ${draco}`);
  if (models.size < 25) problems.push(`only ${models.size} models downloaded (expected 25+)`);
  if (!draco) problems.push("the Draco decoder was never fetched from /draco/");
  const relevant = problems.filter((p) => !/googletagmanager|ERR_FAILED|net::ERR_BLOCKED/i.test(p));
  if (relevant.length) {
    console.log("PROBLEMS:\n - " + [...new Set(relevant)].join("\n - "));
    process.exitCode = 1;
  } else console.log("E2E TEST PASSED");
} finally {
  await browser?.close();
  server.kill();
}
