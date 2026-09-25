import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const models = join(root, "public/models");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : []));

const referencedModels = new Set(
  sourceFiles(join(root, "src")).flatMap((f) => [...readFileSync(f, "utf8").matchAll(/["'`]([\w-]+\.glb)["'`]/g)].map((m) => m[1]))
);

const extensionsOf = (file: string): string[] => {
  const b = readFileSync(join(models, file));
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  return json.extensionsUsed ?? [];
};

describe("3D model files", () => {
  it("every model the code references exists", () => {
    expect(referencedModels.size).toBeGreaterThan(20);
    for (const m of referencedModels) expect(existsSync(join(models, m)), `${m} is missing`).toBe(true);
  });

  it("no unused models are shipped", () => {
    const shipped = readdirSync(models).filter((f) => f.endsWith(".glb"));
    expect(shipped.filter((f) => !referencedModels.has(f))).toEqual([]);
  });

  it("every model is a valid binary glTF", () => {
    for (const f of readdirSync(models).filter((x) => x.endsWith(".glb"))) {
      const b = readFileSync(join(models, f));
      expect(b.toString("ascii", 0, 4), f).toBe("glTF");
      expect(b.readUInt32LE(4), f).toBe(2);
    }
  });

  it("uses only extensions that ship with our own files (no CDN decoders)", () => {
    const needsDraco = readdirSync(models).filter((f) => f.endsWith(".glb") && extensionsOf(f).includes("KHR_draco_mesh_compression"));
    if (needsDraco.length) for (const f of ["draco_wasm_wrapper_gltf.js", "draco_decoder_gltf.wasm", "draco_decoder_gltf.js"]) expect(existsSync(join(root, "public/draco", f)), f).toBe(true);
    for (const f of readdirSync(models).filter((x) => x.endsWith(".glb"))) {
      const bad = extensionsOf(f).filter((e) => /meshopt|basisu|ktx/i.test(e));
      expect(bad, `${f} needs a decoder we do not host`).toEqual([]);
    }
  });

  it("no model is huge", () => {
    for (const f of readdirSync(models).filter((x) => x.endsWith(".glb"))) expect(readFileSync(join(models, f)).length, f).toBeLessThan(6e6);
  });
});
