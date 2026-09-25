import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3, type Node, type TransformNode } from "@babylonjs/core";
import { instantiateFit } from "./assets";
import { CITY_Y, FRONT_Z, facadeTexture } from "./Stairs";
import { Instancer, box, canvasTexture, glowTexture, group, hash, lit, place, setEuler, sprite, unlit, type Ctx, type Region } from "./core";

export const CITY_REGION: Region = { x0: -60, x1: 75, z0: 50.6, z1: 185 };
const Y = CITY_Y;
const ROAD_Z0 = 56;
const ROAD_Z1 = 66;
const AVE_X0 = 30;
const AVE_X1 = 40;

export interface CityApi {
  /** parking spots: x, z, heading */
  spots: { x: number; z: number; heading: number }[];
  root: TransformNode;
}

export function buildCity(ctx: Ctx, parent: Node): CityApi {
  const root = group(ctx, { parent });
  const asphalt = lit(ctx, { color: "#2b2e33", rough: 0.9 });
  const walk = lit(ctx, { color: "#b4b0a6", rough: 0.85 });
  const paint = unlit(ctx, { color: "#f2f2f2", fog: false });

  // ---- ground, sidewalks, roads
  box(ctx, 420, 0.2, 420, { parent: root, pos: [7, Y - 0.1, 110], receive: true, mat: walk });
  box(ctx, 135, 0.06, ROAD_Z1 - ROAD_Z0, { parent: root, pos: [7.5, Y + 0.03, (ROAD_Z0 + ROAD_Z1) / 2], receive: true, mat: asphalt });
  box(ctx, AVE_X1 - AVE_X0, 0.06, 125, { parent: root, pos: [(AVE_X0 + AVE_X1) / 2, Y + 0.031, 128], receive: true, mat: asphalt });
  // kerbs
  const kerb = lit(ctx, { color: "#8f8b82", rough: 0.8 });
  box(ctx, 135, 0.14, 0.25, { parent: root, pos: [7.5, Y + 0.07, ROAD_Z0 - 0.12], mat: kerb });
  box(ctx, 135, 0.14, 0.25, { parent: root, pos: [7.5, Y + 0.07, ROAD_Z1 + 0.12], mat: kerb });
  // lane dashes (instanced)
  const dash = box(ctx, 3, 0.01, 0.22, { parent: root, mat: paint });
  const dashes: [number, number, number][] = [];
  for (let x = -56; x < 74; x += 6) if (x < AVE_X0 - 2 || x > AVE_X1 + 2) dashes.push([x, 61, 0]);
  for (let z = 72; z < 184; z += 6) dashes.push([35, z, Math.PI / 2]);
  const dinst = new Instancer(dash, dashes.length);
  dashes.forEach(([x, z, r], i) => dinst.set(i, x, Y + 0.075, z, 1, 0, r, 0));
  dinst.flush();
  // crosswalk stripes near the avenue
  for (let k = 0; k < 8; k++) box(ctx, 0.5, 0.01, ROAD_Z1 - ROAD_Z0 - 1, { parent: root, pos: [AVE_X0 - 3 + k * 0.9, Y + 0.075, 61], mat: paint });

  // ---- buildings (deterministic), with window-grid facades
  const tex = [facadeTexture(ctx, "#8c7f74", 8, 10), facadeTexture(ctx, "#6b7a8f", 6, 12), facadeTexture(ctx, "#a08b6d", 10, 8), facadeTexture(ctx, "#5d6470", 8, 14)];
  const facMats = tex.map((t) => {
    const m = lit(ctx, { rough: 0.8 });
    m.albedoTexture = t;
    return m;
  });
  const roofMat = lit(ctx, { color: "#4a4d54", rough: 0.9 });
  const building = (x0: number, x1: number, z0: number, z1: number, h: number, v: number) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const mesh = MeshBuilder.CreateBox("bld", { width: w, depth: d, height: h }, ctx.scene);
    mesh.position.set((x0 + x1) / 2, Y + h / 2, (z0 + z1) / 2);
    mesh.material = facMats[v % facMats.length];
    const uv = mesh.getVerticesData("uv")!;
    for (let i = 0; i < uv.length; i += 2) {
      uv[i] *= Math.max(1, Math.max(w, d) / 8);
      uv[i + 1] *= Math.max(1, h / 9);
    }
    mesh.setVerticesData("uv", uv);
    mesh.parent = root;
    mesh.receiveShadows = true;
    if (ctx.shadow) ctx.shadow.addShadowCaster(mesh);
    box(ctx, w + 0.3, 0.5, d + 0.3, { parent: root, pos: [(x0 + x1) / 2, Y + h + 0.25, (z0 + z1) / 2], mat: roofMat });
    ctx.colliders.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: w / 2, hz: d / 2 });
  };
  // north row (beside our own building) — fronts on z = FRONT_Z
  const nRow: [number, number][] = [[-58, -36], [-34, -13], [17.5, 29], [41, 62], [64, 75]];
  nRow.forEach(([a, b], i) => building(a, b, FRONT_Z - 26, FRONT_Z, 12 + hash(i, 5) * 10, i));
  // south row of the main road
  const sRow: [number, number][] = [[-58, -38], [-36, -14], [-12, 8], [10, 28], [42, 62], [64, 75]];
  sRow.forEach(([a, b], i) => building(a, b, 72, 72 + 20 + hash(i, 9) * 14, 10 + hash(i, 6) * 12, i + 1));
  // avenue sides
  for (let k = 0; k < 4; k++) {
    const z = 96 + k * 22;
    building(10, 28, z, z + 17, 10 + hash(k, 11) * 12, k);
    building(42, 62, z, z + 17, 10 + hash(k, 12) * 12, k + 2);
  }
  // backdrop skyline hiding the void beyond the playable area
  for (let i = 0; i < 12; i++) building(-64 + i * 12, -54 + i * 12, 188, 200, 20 + hash(i, 13) * 10, i);
  building(-72, -62, 60, 190, 24, 1);
  building(76, 86, 60, 190, 26, 3);

  // ---- street lamps (real model) + trees + bushes (lazy)
  const spots: CityApi["spots"] = [
    { x: 8, z: 63.4, heading: Math.PI / 2 },
    { x: -14, z: 63.4, heading: Math.PI / 2 },
    { x: 22, z: 58.6, heading: -Math.PI / 2 },
  ];
  const lazy: (() => void)[] = [];
  const lampSpots: [number, number][] = [];
  for (let x = -50; x < 70; x += 20) lampSpots.push([x, 55.2], [x + 10, 66.8]);
  lampSpots.forEach(([x, z]) =>
    lazy.push(() => {
      instantiateFit(ctx, "lightpost.glb", root, { pos: [x, Y, z], size: 4.2, yaw: z < 60 ? 0 : Math.PI }).catch(() => {});
    })
  );
  const trees: TransformNode[] = [];
  const treeFiles = ["tree1.glb", "tree2.glb", "tree3.glb"];
  const treeSpots: [number, number][] = [];
  for (let x = -54; x < 72; x += 9) {
    if (x > AVE_X0 - 3 && x < AVE_X1 + 3) continue;
    treeSpots.push([x + hash(x, 3) * 3, 52.4 + hash(x, 4) * 1.2]);
    treeSpots.push([x + 4 + hash(x, 5) * 3, 69.3 + hash(x, 6) * 1.2]);
  }
  for (let z = 80; z < 180; z += 11) treeSpots.push([29 + hash(z, 7), z], [41 + hash(z, 8), z + 4]);
  treeSpots.forEach(([x, z], i) => {
    ctx.colliders.push({ x, z, hx: 0.5, hz: 0.5 });
    lazy.push(() => {
      const f = treeFiles[i % treeFiles.length];
      instantiateFit(ctx, f, root, { pos: [x, Y, z], size: 6.5 + hash(i, 21) * 3, yaw: hash(i, 22) * 6.28 })
        .then((h) => {
          h.metadata = { ...h.metadata, ph: hash(i, 23) * 6.28, yaw: hash(i, 22) * 6.28 };
          trees.push(h);
        })
        .catch(() => {});
    });
  });
  // wind: every tree sways with a gust that travels across the city
  ctx.onFrame((_, t) => {
    if (ctx.player.z < 45) return;
    for (const h of trees) {
      const ph = h.metadata.ph as number;
      const gust = 0.5 + 0.5 * Math.sin(t * 0.35 + h.position.x * 0.05);
      const a = (0.018 + 0.03 * gust) * Math.sin(t * 1.5 + ph);
      const b = (0.014 + 0.024 * gust) * Math.sin(t * 1.15 + ph * 1.7);
      setEuler(h, a, h.metadata.yaw as number, b);
    }
  });

  // ---- sky dome, sun and clouds (follow the camera; only drawn outdoors)
  const sky = group(ctx, { parent: root });
  const skyTex = canvasTexture(ctx, 8, 512, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, "#1f6fe0");
    grd.addColorStop(0.35, "#4ea2ff");
    grd.addColorStop(0.5, "#9ad0ff");
    grd.addColorStop(0.62, "#e6f4ff");
    grd.addColorStop(1, "#e6f4ff");
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 512);
  });
  const dome = MeshBuilder.CreateSphere("sky", { diameter: 900, segments: 24, sideOrientation: Mesh.BACKSIDE }, ctx.scene);
  const domeMat = new StandardMaterial("skyMat", ctx.scene);
  domeMat.disableLighting = true;
  domeMat.backFaceCulling = false;
  domeMat.diffuseColor = Color3.Black();
  domeMat.specularColor = Color3.Black();
  domeMat.emissiveTexture = skyTex;
  domeMat.fogEnabled = false;
  domeMat.disableDepthWrite = true;
  dome.material = domeMat;
  dome.infiniteDistance = true; // always centred on the camera
  dome.renderingGroupId = 0;
  dome.isPickable = false;
  dome.alwaysSelectAsActiveMesh = true;
  dome.setEnabled(false);
  const sunDir = new Vector3(-0.35, 0.5, 0.65).normalize(); // toward the sun
  const sun = place(ctx, MeshBuilder.CreateSphere("sun", { diameter: 60, segments: 16 }, ctx.scene), {
    parent: sky,
    pos: [sunDir.x * 800, sunDir.y * 800, sunDir.z * 800],
    mat: unlit(ctx, { color: "#fff4c2", fog: false }),
  });
  sun.isPickable = false;
  const halo = glowTexture(ctx, true);
  const sunGlow = sprite(ctx, halo, { parent: sky, pos: [sunDir.x * 790, sunDir.y * 790, sunDir.z * 790], color: "#ffe9a0", opacity: 0.9, additive: true, size: [420, 420], fog: false });
  sunGlow.isPickable = false;
  const cloudTex = glowTexture(ctx, true);
  for (let i = 0; i < 16; i++) {
    const a = hash(i, 31) * Math.PI * 2;
    const el = 0.12 + hash(i, 32) * 0.55;
    const r = 700;
    for (let k = 0; k < 4; k++) {
      sprite(ctx, cloudTex, {
        parent: sky,
        pos: [Math.cos(a) * r * Math.cos(el) + k * 26, Math.sin(el) * r, Math.sin(a) * r * Math.cos(el) + (k % 2) * 14],
        color: "#ffffff",
        opacity: 0.85,
        size: [150 + hash(i + k, 33) * 60, 55 + hash(i + k, 34) * 20],
        fog: false,
      }).isPickable = false;
    }
  }
  ctx.onFrame(() => {
    const out = ctx.player.z > 45;
    sky.setEnabled(out);
    dome.setEnabled(out);
    if (out) sky.position.copyFrom(ctx.camera.position);
  });

  // ---- birds (real animated models) circling over the city
  const birdFiles: [string, number, number][] = [["stork.glb", 4.2, 0], ["parrot.glb", 2.4, 0], ["flamingo.glb", 3.4, 0], ["stork.glb", 4.2, 0], ["parrot.glb", 2.4, 0], ["flamingo.glb", 3.4, 0]];
  birdFiles.forEach(([file, size, off], i) => {
    lazy.push(() => {
      instantiateFit(ctx, file, root, { pos: [0, 0, 0], size, anim: true })
        .then((b) => {
          const rad = 22 + hash(i, 41) * 36;
          const sp = (0.18 + hash(i, 42) * 0.14) * (i % 2 ? -1 : 1);
          const hgt = 16 + hash(i, 43) * 16;
          const ph = hash(i, 44) * 6.28;
          ctx.onFrame((_, t) => {
            const a = t * sp + ph;
            b.position.set(30 + Math.cos(a) * rad, Y + hgt + Math.sin(t * 0.8 + ph) * 1.2, 115 + Math.sin(a) * rad * 0.8);
            setEuler(b, 0, -a + (sp > 0 ? 0 : Math.PI) + off, Math.sin(t * 0.9 + ph) * 0.15);
          });
        })
        .catch(() => {});
    });
  });

  lazy.forEach((f) => ctx.defer(f));

  return { spots, root };
}
