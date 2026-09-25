import "@babylonjs/loaders/glTF";
import { AssetContainer, DracoCompression, Light, PBRMaterial, SceneLoader, TransformNode, type Node, type Scene } from "@babylonjs/core";
import { place, type Ctx, type PlaceOpts } from "./core";
import { trackLoad } from "./loadingSignal";

// Draco-compressed models decode with our own copy of the decoder (public/draco) instead of Babylon's CDN,
// so nothing depends on cdn.babylonjs.com being reachable.
DracoCompression.Configuration = {
  decoder: {
    wasmUrl: "/draco/draco_wasm_wrapper_gltf.js",
    wasmBinaryUrl: "/draco/draco_decoder_gltf.wasm",
    fallbackUrl: "/draco/draco_decoder_gltf.js",
  },
};

const cache = new WeakMap<Scene, Map<string, Promise<AssetContainer>>>();

/** Loads a .glb once per scene; `instantiate` then makes cheap copies sharing geometry/materials. */
export function loadContainer(ctx: Ctx, file: string) {
  let perScene = cache.get(ctx.scene);
  if (!perScene) cache.set(ctx.scene, (perScene = new Map()));
  let p = perScene.get(file);
  if (!p) {
    p = SceneLoader.LoadAssetContainerAsync("/models/", file, ctx.scene);
    perScene.set(file, p);
  }
  return p;
}

export interface ModelOpts extends PlaceOpts {
  /** start the model's animation groups (looping) */
  anim?: boolean;
  /** give this copy its own materials (so it can be tinted) */
  clone?: boolean;
  /** never hold back the start button for this model (decor that may pop in a moment later) */
  background?: boolean;
}

let critical = false;

/** Models requested between begin() and end() hold back the start button until they have loaded. */
export const criticalLoads = {
  begin: () => void (critical = true),
  end: () => void (critical = false),
};

export function instantiate(ctx: Ctx, file: string, parent: Node, o: ModelOpts = {}) {
  const p = doInstantiate(ctx, file, parent, o);
  return critical && !o.background ? trackLoad(p) : p;
}

async function doInstantiate(ctx: Ctx, file: string, parent: Node, o: ModelOpts) {
  const container = await loadContainer(ctx, file);
  const res = container.instantiateModelsToScene((n) => n, !!o.clone);
  const holder = new TransformNode("model", ctx.scene);
  place(ctx, holder, { ...o, parent });
  for (const r of res.rootNodes) {
    (r as TransformNode).parent = holder;
    for (const n of [r, ...r.getDescendants(false)]) {
      if (n instanceof Light) n.dispose(); // KHR_lights_punctual bundled with sample assets
    }
  }
  for (const m of holder.getChildMeshes()) {
    m.receiveShadows = true;
    if (o.cast && ctx.shadow) ctx.shadow.addShadowCaster(m);
    if (m.material instanceof PBRMaterial) {
      m.material.maxSimultaneousLights = 8;
      m.material.environmentIntensity = 0.25;
    }
  }
  res.animationGroups.forEach((g) => (o.anim ? g.start(true, 1) : g.stop()));
  holder.metadata = { anims: res.animationGroups };
  return holder;
}

/** Instantiate a model and scale it so its largest side is `size`, standing on `pos` (y = its base). */
export async function instantiateFit(ctx: Ctx, file: string, parent: Node, o: { pos: [number, number, number]; size: number; yaw?: number; anim?: boolean; clone?: boolean }) {
  const holder = await instantiate(ctx, file, parent, { pos: [0, 0, 0], rot: [0, o.yaw ?? 0, 0], anim: o.anim, clone: o.clone });
  const measure = () => {
    holder.computeWorldMatrix(true);
    holder.getChildMeshes().forEach((m) => m.computeWorldMatrix(true));
    return holder.getHierarchyBoundingVectors(true);
  };
  let { min, max } = measure();
  const ext = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) || 1;
  holder.scaling.setAll(o.size / ext);
  ({ min, max } = measure());
  holder.position.set(o.pos[0] - (min.x + max.x) / 2, o.pos[1] - min.y, o.pos[2] - (min.z + max.z) / 2);
  return holder;
}
