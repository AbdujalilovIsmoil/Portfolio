import { Color3, Matrix, Mesh, Quaternion, Vector3, type Node, type PBRMaterial, type ShaderMaterial, type TransformNode } from "@babylonjs/core";
import { instantiateFit, loadContainer } from "./assets";
import { Batcher } from "./CityKit";
import { CITY_Y, FRONT_DOOR_X, FRONT_Z, GARDEN_REGIONS, PLOT, YARD_REGION } from "./cityLayout";
import { buildHouseAndYard, getCityMaterials, type Collider } from "./House";
import { buildSky } from "./Sky";
import { buildBirds } from "./Birds";
import { buildPoolFx } from "./PoolFx";
import { buildMountains } from "./Mountains";
import { group, hash, lit, points, setEuler, type Ctx, type Region } from "./core";

/** The front yard — the first place you step into from the house. */
export const CITY_REGION: Region = YARD_REGION;
/** The rest of the garden round the house. */
export { GARDEN_REGIONS };
/** Everything inside the property wall (used to switch the outdoor scene on and off). */
export const GROUNDS_REGION: Region = { x0: PLOT.x0, x1: PLOT.x1, z0: PLOT.z0, z1: PLOT.z1 };
const Y = CITY_Y;

export interface CityApi {
  root: TransformNode;
}

/**
 * Outside the house: our hovli and garden inside a brick wall, and beyond it nothing but
 * open country — fields, rows of poplars, a dirt lane and the mountains on the horizon.
 */
export function buildCity(ctx: Ctx, parent: Node): CityApi {
  const root = group(ctx, { parent });
  const m = getCityMaterials(ctx);
  const b = new Batcher(ctx, root);
  const far = new Batcher(ctx, root, 400, false); // the countryside: big cells, never ray-picked
  const colliders: Collider[] = [];

  // ---- the house, the yard and the garden
  const yard = buildHouseAndYard(ctx, b, colliders);

  // ---- the countryside
  // (four pieces round our plot: inside it the lawn takes over, cut round the pool)
  const G = { x0: -447, x1: 453, z0: -420, z1: 480 };
  const ground = (a: number, c: number, d: number, e: number) => far.box(c - a, 0.2, e - d, (a + c) / 2, Y - 0.12, (d + e) / 2, m.grass, { tile: 5 });
  ground(G.x0, G.x1, G.z0, PLOT.z0);
  ground(G.x0, G.x1, PLOT.z1, G.z1);
  ground(G.x0, PLOT.x0, PLOT.z0, PLOT.z1);
  ground(PLOT.x1, G.x1, PLOT.z0, PLOT.z1);
  // a dirt lane past the gate
  far.box(600, 0.05, 5, 3, Y + 0.0, PLOT.z1 + 5, m.soil, { tile: 3 });
  // fields in strips: wheat, cotton, young green crops, ploughed earth
  const crops = [m.matte("#c9a64a"), m.matte("#e8e4d6"), m.matte("#5f8f34"), m.matte("#7a5a3c"), m.matte("#8aa83c")];
  const field = (x0: number, x1: number, z0: number, z1: number, k: number) => {
    const c = crops[k % crops.length];
    far.box(x1 - x0, 0.08, z1 - z0, (x0 + x1) / 2, Y - 0.02, (z0 + z1) / 2, c);
    for (let x = x0 + 1.5; x < x1; x += 3) far.box(0.6, 0.12, z1 - z0 - 2, x, Y + 0.02, (z0 + z1) / 2, c); // furrows
  };
  let k = 0;
  for (let z = -300; z < 330; z += 46)
    for (let x = -260; x < 270; x += 70) {
      if (x + 70 > PLOT.x0 - 12 && x < PLOT.x1 + 12 && z + 46 > PLOT.z0 - 12 && z < PLOT.z1 + 9) continue; // our own land
      if (z < PLOT.z1 + 9 && z + 46 > PLOT.z1 + 1) continue; // the lane
      field(x + 3, x + 66, z, z + 42, k++ + Math.floor(hash(x, z) * 3));
    }
  // (no tree rows out in the fields for now: open country up to the mountains)

  // ---- garden lamps along the paths
  const lampHeads: Vector3[] = [];
  const lamp = (x: number, z: number) => {
    b.cylinder(0.07, 2.6, x, Y + 1.3, z, m.metal, 8);
    b.box(0.3, 0.1, 0.3, x, Y + 2.95, z, m.metal, { pickable: false });
    lampHeads.push(new Vector3(x, Y + 2.75, z));
    colliders.push({ x, z, hx: 0.12, hz: 0.12 });
  };
  for (const x of [-6, 12]) lamp(x, FRONT_Z + 4.3);
  for (const z of [62, 72]) {
    lamp(FRONT_DOOR_X - 1.4, z);
    lamp(FRONT_DOOR_X + 1.4, z - 5);
  }
  for (const z of [6, 26, 42]) {
    lamp(-15.8, z);
    lamp(20.8, z);
  }
  lamp(-2, PLOT.z0 + 4.3);
  lamp(10, PLOT.z0 + 4.3);
  const headMat = lit(ctx, { color: "#efe6d0", emissive: "#ffd28a", ei: 2 });
  for (const h of lampHeads) b.box(0.24, 0.36, 0.24, h.x, h.y, h.z, headMat, { pickable: false });
  const lampLights = lampHeads.map((h) => {
    const l = { pos: new Vector3(h.x, h.y - 0.2, h.z), color: Color3.FromHexString("#ffcf8a").toLinearSpace(), intensity: 0, range: 11 };
    ctx.lights.push(l);
    return l;
  });
  // lamps under the veranda
  for (const x of [-6, 3, 12]) {
    b.box(0.3, 0.3, 0.3, x, Y + 3.0, FRONT_Z + 1.6, headMat, { pickable: false });
    const l = { pos: new Vector3(x, Y + 2.7, FRONT_Z + 1.6), color: Color3.FromHexString("#ffd9a0").toLinearSpace(), intensity: 0, range: 9 };
    ctx.lights.push(l);
    lampLights.push(l);
    lampHeads.push(new Vector3(x, Y + 3.0, FRONT_Z + 1.6));
  }
  const glowPos = new Float32Array(lampHeads.length * 3);
  lampHeads.forEach((h, i) => glowPos.set([h.x, h.y, h.z], i * 3));
  const glows = points(ctx, { positions: glowPos, sizes: new Float32Array(lampHeads.length).fill(6), phases: new Float32Array(lampHeads.length), color: "#ffd9a0", opacity: 0, speed: 0, pixel: 4, attenuate: true });
  glows.parent = root;
  const glowMat = glows.material as ShaderMaterial;

  b.finalize();
  far.finalize();
  ctx.colliders.push(...colliders);

  // ---- shade trees: real jacaranda models, each one swaying in the wind
  const lazy: (() => void)[] = [];
  const swaying: TransformNode[] = [];
  yard.trees.filter((_, i) => !ctx.lowPower || i % 2 === 0).forEach(([x, z, size], i) => {
    lazy.push(() => {
      instantiateFit(ctx, "jacaranda.glb", root, { pos: [x, Y, z], size, yaw: hash(i, 22) * 6.28 })
        .then((h) => {
          h.metadata = { ...h.metadata, ph: hash(i, 23) * 6.28, yaw: hash(i, 22) * 6.28 };
          for (const mm of h.getChildMeshes()) mm.isPickable = false;
          swaying.push(h);
        })
        .catch(() => {});
    });
  });
  // only the trees near the player cast shadows (each one is ~70k vertices drawn again into the shadow map)
  let shadowClock = 0;
  const casting = new Set<TransformNode>();
  ctx.onFrame((dt) => {
    shadowClock -= dt;
    if (shadowClock > 0 || !ctx.shadow) return;
    shadowClock = 0.5;
    for (const h of swaying) {
      const d = Math.hypot(h.position.x - ctx.player.x, h.position.z - ctx.player.z);
      // indoors only the trees close enough to be seen through a window are drawn at all
      const show = ctx.outdoor > 0.5 || d < 18;
      if (h.isEnabled(false) !== show) h.setEnabled(show);
      const near = ctx.outdoor > 0.05 && d < 16;
      if (near === casting.has(h)) continue;
      for (const mm of h.getChildMeshes()) {
        if (near) ctx.shadow.addShadowCaster(mm, false);
        else ctx.shadow.removeShadowCaster(mm, false);
      }
      if (near) casting.add(h);
      else casting.delete(h);
    }
  });
  ctx.onFrame((_, t) => {
    if (ctx.outdoor < 0.05 && !(ctx.player.z < 5 && Math.abs(ctx.player.x) < 8)) return;
    for (const h of swaying) {
      const ph = h.metadata.ph as number;
      const gust = 0.5 + 0.5 * Math.sin(t * 0.35 + h.position.x * 0.05);
      const a = (0.012 + 0.02 * gust) * Math.sin(t * 1.3 + ph);
      const c = (0.01 + 0.016 * gust) * Math.sin(t * 1.05 + ph * 1.7);
      setEuler(h, a, h.metadata.yaw as number, c);
    }
  });

  // ---- flowers and shrubs: real models, one draw call per model part for all their copies
  const byFile = new Map<string, [number, number, number, number][]>();
  for (const [file, x, z, yaw, sc] of yard.flowers) {
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file)!.push([x, z, yaw, sc]);
  }
  for (const [file, spots] of byFile) lazy.push(() => void thinInstanceModel(ctx, file, root, spots, file === "shrub.glb" ? Y + 0.05 : Y + 0.3).catch(() => {}));

  // ---- night: windows and lamps light up
  ctx.onFrame(() => {
    const k = Math.max(0, (ctx.night - 0.25) / 0.75);
    m.glassLit.emissiveIntensity = k * 0.9;
    m.windowBack.emissiveColor.set(k * 0.7, k * 0.6, k * 0.45);
    (headMat as PBRMaterial).emissiveColor.set(k, k * 0.82, k * 0.54);
    for (const l of lampLights) l.intensity = (k * 12) / Math.PI;
    glows.setEnabled(k > 0.01 && ctx.outdoor > 0.05);
    glowMat.setFloat("uOpacity", k * 0.8);
  });

  buildSky(ctx, root);

  // ---- a flock of swallows over the garden by day
  buildBirds(ctx, root, { x: 3, y: Y, z: 35 });
  buildPoolFx(ctx, root);
  buildMountains(ctx, root, { x: 3, y: Y - 0.5, z: 30 });
  lazy.forEach((f) => ctx.defer(f));

  return { root };
}

/**
 * One draw call per mesh of `file` for ALL of `spots` ([x, z, yaw, scale]); the models keep their
 * real-world size (Poly Haven assets are in metres), times `scale`, standing on `baseY`.
 */
async function thinInstanceModel(ctx: Ctx, file: string, parent: Node, spots: [number, number, number, number][], baseY: number) {
  if (!spots.length) return;
  const c = await loadContainer(ctx, file);
  const res = c.instantiateModelsToScene((n) => n, false);
  const holder = group(ctx, { parent });
  for (const r of res.rootNodes) r.parent = holder;
  holder.computeWorldMatrix(true);
  const { min, max } = holder.getHierarchyBoundingVectors(true);
  const meshes = holder.getChildMeshes(false).filter((mm): mm is Mesh => mm instanceof Mesh && mm.getTotalVertices() > 0);
  for (const mesh of meshes) {
    const local = mesh.computeWorldMatrix(true).clone();
    const buf = new Float32Array(spots.length * 16);
    spots.forEach(([x, z, yaw, s], i) => {
      // centre the model's footprint on (x, z) and stand it on the ground
      const centre = Matrix.Translation(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2);
      const place = Matrix.Compose(new Vector3(s, s, s), Quaternion.RotationAxis(Vector3.Up(), yaw), new Vector3(x, baseY, z));
      local.multiply(centre).multiply(place).copyToArray(buf, i * 16);
    });
    mesh.parent = parent;
    mesh.position.setAll(0);
    mesh.rotationQuaternion = null;
    mesh.rotation.setAll(0);
    mesh.scaling.setAll(1);
    mesh.thinInstanceSetBuffer("matrix", buf, 16, true);
    mesh.isPickable = false;
    mesh.thinInstanceRefreshBoundingInfo(false);
    mesh.freezeWorldMatrix();
  }
  holder.dispose(true);
}
