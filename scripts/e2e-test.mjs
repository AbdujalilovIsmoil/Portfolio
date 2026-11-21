/**
 * End-to-end smoke test: loads the production build in Chrome with every external host blocked,
 * plays each mode a little (free drive, a race against the rivals, a mission) and fails on any page
 * error, console error, or failed request.
 *
 *   npm run build && npm run test:e2e
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = process.env.PORT ?? "3101";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Drive: forward, a turn, the handbrake, reverse. */
const drive = async (page) => {
  for (const [key, ms] of [["KeyW", 2500], ["KeyA", 1200], ["Space", 600], ["KeyS", 1500]]) {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
  }
};
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
  /** Click the menu button whose text matches. */
  const pick = async (re) => {
    await page.waitForFunction((src) => [...document.querySelectorAll("button")].some((b) => new RegExp(src).test(b.textContent)), { timeout: 90000 }, re.source);
    await page.evaluate((src) => [...document.querySelectorAll("button")].find((b) => new RegExp(src).test(b.textContent)).click(), re.source);
  };
  /** The pick has loaded and started: the menu has gone. */
  const started = () => page.waitForFunction(() => !document.querySelector("[data-menu]"), { timeout: 120000 });

  await page.goto(`http://localhost:${PORT}`);
  // free drive (the portfolio): every model in, every shader compiled, then it starts
  await pick(/Free drive/);
  await started();
  await sleep(4000);
  await drive(page);
  await sleep(1500);
  // a race: the rivals' cars (repainted at load), the countdown, racing
  await page.keyboard.press("Escape");
  await pick(/^\W*Race/);
  await pick(/Speedway/);
  await started();
  await sleep(6500); // the fly-in and 3 – 2 – 1
  await drive(page);
  // a mission
  await page.keyboard.press("Escape");
  await pick(/^\W*Missions/);
  await pick(/2\. Coin Rush/);
  await started();
  await sleep(6500);
  await drive(page);
  await sleep(1500);

  console.log(`models downloaded: ${models.size}, own Draco decoder used: ${draco}, own meshopt decoder used: ${meshopt}`);
  if (!models.has("/models/race.glb")) problems.push("the car model was never downloaded");
  if (!models.has("/models/roadStraight.glb")) problems.push("the track tiles were never downloaded");
  // (only for what was actually downloaded)
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
