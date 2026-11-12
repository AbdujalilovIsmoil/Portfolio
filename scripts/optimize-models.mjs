/**
 * Shrinks every model in public/models: meshopt-compressed geometry + animation, quantized
 * attributes, WebP textures capped to a sensible size, unused data pruned.
 * Node names, material names and animation names are preserved (the code looks them up).
 *
 *   node scripts/optimize-models.mjs            # all models not yet optimized
 *   node scripts/optimize-models.mjs file.glb   # just these
 *
 * The meshopt decoder is self-hosted in public/meshopt (see assets.ts), so nothing loads from a CDN.
 * Already-optimized files (written by glTF-Transform) are skipped, so re-running is safe.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "..", "public/models");
const CLI = ["--yes", "@gltf-transform/cli@4.1.1"];

/** Max texture edge per model; everything else gets DEFAULT_SIZE. */
const TEXTURE_SIZE = {
  "mask.glb": 1024,
  "nemetona.glb": 1024,
  "nefertiti.glb": 1024,
  "steampunk.glb": 1024,
  "rolex.glb": 1024,
  "soldier.glb": 1024,
};
const DEFAULT_SIZE = 512;
/** Very dense scans: decimate (the normal maps keep the surface detail). Value = target triangle ratio. */
const SIMPLIFY = { "nemetona.glb": 0.2, "mask.glb": 0.3, "tennyson.glb": 0.4, "rolex.glb": 0.6, "ferrari.glb": 0.7 };
/** Files to leave untouched. */
const SKIP = new Set([]);

const jsonOf = (file) => {
  const b = readFileSync(file);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};
const extensionsOf = (file) => jsonOf(file).extensionsUsed ?? [];
const alreadyDone = (file) => /glTF-Transform/.test(jsonOf(file).asset?.generator ?? "");

const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(DIR).filter((f) => f.endsWith(".glb"));
for (const f of files) {
  const src = join(DIR, f);
  if (SKIP.has(f) || alreadyDone(src)) continue;
  const before = statSync(src).size;
  const tmp = src + ".tmp.glb";
  execFileSync(
    "npx",
    [
      ...CLI,
      "optimize",
      src,
      tmp,
      // Draco beats meshopt on dense static meshes; meshopt also compresses skinning + animation.
      "--compress", extensionsOf(src).includes("KHR_draco_mesh_compression") || SIMPLIFY[f] ? "draco" : "meshopt",
      "--texture-compress", "webp",
      "--texture-size", String(TEXTURE_SIZE[f] ?? DEFAULT_SIZE),
      // keep the scene graph as-is: code finds wheels, bones and materials by name
      "--flatten", "false",
      "--join", "false",
      "--instance", "false",
      "--palette", "false",
      ...(SIMPLIFY[f] ? ["--simplify", "true", "--simplify-ratio", String(SIMPLIFY[f]), "--simplify-error", "0.002"] : ["--simplify", "false"]),
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  const after = statSync(tmp).size;
  if (after < before) renameSync(tmp, src);
  else execFileSync("rm", [tmp]);
  console.log(`${f.padEnd(26)} ${(before / 1024).toFixed(0).padStart(6)} KB -> ${(Math.min(before, after) / 1024).toFixed(0).padStart(6)} KB`);
}
