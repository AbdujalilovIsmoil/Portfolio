/**
 * Thins out the dense Poly Haven plant scans (the shrubs and the flowers) with meshoptimizer's
 * simplifier: hundreds of copies of them stand round the track, and at the distances you see them
 * from the car the originals' tens of thousands of triangles each are invisible detail — on a weak
 * GPU they were most of the frame. Materials, textures, names and the alpha cut-out are untouched.
 *
 *   node scripts/simplify-vegetation.mjs
 *
 * Needs glTF-Transform 4 and meshoptimizer (the versions `npx @gltf-transform/cli@4.1.1` installs,
 * which scripts/optimize-models.mjs uses too): from node_modules if they are installed, else from the
 * npx cache. Files already simplified (asset.extras.simplified) are skipped, so re-running is safe.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DIR = join(import.meta.dirname, "..", "public/models");
/** file → [ratio of triangles to keep, max error as a fraction of the mesh's size] */
const PLANTS = {
  "shrub.glb": [0.22, 0.01],
  "flower-ursinia.glb": [0.3, 0.01],
  "flower-sorrel.glb": [0.4, 0.01],
  "flower-empodium.glb": [0.4, 0.01],
};

/** import a package from node_modules, else from wherever npx cached it */
async function load(pkg, file) {
  try {
    return await import(pkg);
  } catch {
    const cache = join(homedir(), ".npm/_npx");
    for (const d of existsSync(cache) ? readdirSync(cache) : []) {
      const p = join(cache, d, "node_modules", pkg, file);
      if (existsSync(p)) return import(pathToFileURL(p).href);
    }
    throw new Error(`${pkg} not found: run \`npx @gltf-transform/cli@4.1.1 --help\` once (it caches it)`);
  }
}
const { NodeIO } = await load("@gltf-transform/core", "dist/index.js");
const { ALL_EXTENSIONS } = await load("@gltf-transform/extensions", "dist/index.js");
const { weld, simplify, meshopt } = await load("@gltf-transform/functions", "dist/index.js");
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await load("meshoptimizer", "index.js");
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const triangles = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);

for (const [file, [ratio, error]] of Object.entries(PLANTS)) {
  const path = join(DIR, file);
  const doc = await io.read(path);
  const extras = doc.getRoot().getAsset().extras ?? {};
  if (extras.simplified) {
    console.log(`${file.padEnd(22)} already simplified (${extras.simplified})`);
    continue;
  }
  const before = triangles(doc);
  const size = statSync(path).size;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  doc.getRoot().getAsset().extras = { ...extras, simplified: ratio };
  await io.write(path, doc);
  console.log(`${file.padEnd(22)} ${String(before).padStart(6)} → ${String(triangles(doc)).padStart(6)} triangles, ${(size / 1024).toFixed(0)} → ${(statSync(path).size / 1024).toFixed(0)} KB`);
}
