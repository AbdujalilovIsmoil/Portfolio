/**
 * End-to-end smoke test: loads the production build in Chrome with every external host blocked,
 * waits for all background model loading, and fails on any page error, console error, or failed request.
 *
 *   npm run build && npm run test:e2e
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = process.env.PORT ?? "3101";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Which decoders the shipped models actually need (then the page must fetch our own copies). */
const extensionsOf = (f) => {
  const b = readFileSync(f);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()).extensionsUsed ?? [];
};
/** Does any of these downloaded models (paths like /models/car.glb) need the given extension? */
const anyNeeds = (paths, ext) => [...paths].some((u) => extensionsOf("public" + u).includes(ext));
if (!existsSync(CHROME)) {
  console.log(`SKIP: Chrome not found at ${CHROME} (set CHROME_PATH)`);
  process.exit(0);
}

const server = spawn("npx", ["next", "start", "-p", PORT], { stdio: "ignore" });
const problems = [];
const models = new Set();
let draco = false;
let meshopt = false;
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
    if (u.pathname.startsWith("/meshopt/")) meshopt = true;
    if (u.hostname === "localhost" && r.status() >= 400) problems.push(`HTTP ${r.status()} ${u.pathname}`);
  });
  await page.goto(`http://localhost:${PORT}`);
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Start/.test(b.textContent)), { timeout: 90000 });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Start/.test(b.textContent)).click());
  await sleep(20000); // background loading + shader warm-up
  // drive a little: forward, a turn, the handbrake, reverse
  for (const [key, ms] of [["KeyW", 2500], ["KeyA", 1200], ["Space", 600], ["KeyS", 1500]]) {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
  }
  await sleep(1500);

  console.log(`models downloaded: ${models.size}, own Draco decoder used: ${draco}, own meshopt decoder used: ${meshopt}`);
  if (!models.has("/models/race.glb")) problems.push("the car model was never downloaded");
  if (!models.has("/models/roadStraight.glb")) problems.push("the track tiles were never downloaded");
  // (only for what was actually downloaded: the Arcade game's model loads only when you play)
  if (anyNeeds(models, "KHR_draco_mesh_compression") && !draco) problems.push("the Draco decoder was never fetched from /draco/");
  if (anyNeeds(models, "EXT_meshopt_compression") && !meshopt) problems.push("the meshopt decoder was never fetched from /meshopt/");
  const relevant = problems.filter((p) => !/googletagmanager|ERR_FAILED|net::ERR_BLOCKED/i.test(p));
  if (relevant.length) {
    console.log("PROBLEMS:\n - " + [...new Set(relevant)].join("\n - "));
    process.exitCode = 1;
  } else console.log("E2E TEST PASSED");
} finally {
  await browser?.close();
  server.kill();
}
