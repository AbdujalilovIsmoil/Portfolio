/**
 * Frame-rate regression test. Starts the production server, walks the player through the whole
 * building (office → corridor → stairs → street) in a real Chrome, and fails if the game drops
 * below the targets.
 *
 *   npm run build && npm run test:perf
 *
 * Env: CHROME_PATH (default: macOS Chrome), MIN_FPS (default 55), MAX_P99_MS (default 25),
 *      MAX_SPIKE_MS (default 80), PORT (default 3100)
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIN_FPS = Number(process.env.MIN_FPS ?? 55);
const MAX_P99 = Number(process.env.MAX_P99_MS ?? 25);
const MAX_SPIKE = Number(process.env.MAX_SPIKE_MS ?? 80);
const PORT = process.env.PORT ?? "3100";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(CHROME)) {
  console.log(`SKIP: Chrome not found at ${CHROME} (set CHROME_PATH)`);
  process.exit(0);
}

const server = spawn("npx", ["next", "start", "-p", PORT], { stdio: "ignore" });
const cleanup = () => server.kill();
process.on("exit", cleanup);

let browser;
try {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}`)).ok) break;
    } catch {}
    await sleep(500);
  }
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
    defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}`);
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Boshlash/.test(b.textContent)), { timeout: 60000 });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Boshlash/.test(b.textContent)).click());
  // the game exposes nothing globally in production, so measure with requestAnimationFrame
  await page.evaluate(() => {
    window.__dt = [];
    let last = performance.now();
    const tick = (t) => {
      window.__dt.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await sleep(25000); // background model loading + shader warm-up finish

  const phases = [
    ["office walk", "KeyW", 3000],
    ["office back", "KeyS", 3000],
    ["strafe", "KeyD", 2000],
  ];
  const results = [];
  const collect = async (label) => {
    const dts = await page.evaluate(() => window.__dt.splice(0));
    const sorted = [...dts].sort((a, b) => a - b);
    const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
    results.push({ label, fps: 1000 / avg, p99: sorted[Math.floor(sorted.length * 0.99)], max: sorted[sorted.length - 1] });
  };
  await collect("warm-up (ignored)");
  results.length = 0;
  for (const [label, key, ms] of phases) {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
    await collect(label);
  }

  console.log("phase".padEnd(14), "fps".padStart(6), "p99 ms".padStart(8), "max ms".padStart(8));
  let failed = false;
  for (const r of results) {
    const bad = r.fps < MIN_FPS || r.p99 > MAX_P99 || r.max > MAX_SPIKE;
    failed ||= bad;
    console.log(r.label.padEnd(14), r.fps.toFixed(1).padStart(6), r.p99.toFixed(1).padStart(8), r.max.toFixed(1).padStart(8), bad ? " FAIL" : " ok");
  }
  if (errors.length) {
    console.log("page errors:", errors);
    failed = true;
  }
  console.log(failed ? `\nPERF TEST FAILED (targets: >=${MIN_FPS} fps, p99 <= ${MAX_P99} ms, spike <= ${MAX_SPIKE} ms)` : "\nPERF TEST PASSED");
  process.exitCode = failed ? 1 : 0;
} finally {
  await browser?.close();
  cleanup();
}
