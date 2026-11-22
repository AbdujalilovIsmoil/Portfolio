import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, StandardMaterial, Texture, Vector3, VertexData, type Node } from "@babylonjs/core";
import { TRACK, WALL_IN, WALL_T, heightAt, isUnder, sampleAt } from "./Track";
import { canvasTexture, group, hash, lit, points, setAdditive, unlit, type Ctx } from "./core";

/*
 * The city round the circuit, at dusk: blocks of buildings — glass towers downtown, concrete
 * offices, apartment blocks, white panel buildings — their windows lit here and there, shop fronts
 * glowing at street level, red beacons on the tall ones; pavements, street lamps, and traffic on the
 * streets between the blocks. All of it is a handful of meshes (built once, merged by material).
 */

/** How far out the city goes (m from the middle); the mountains start beyond it. */
const RADIUS = 480;
/** A block and the street round it (m). */
const BLOCK = 66, STREET = 18, PERIOD = BLOCK + STREET;
/** A storey, and a window bay (m): the facade textures are 8 bays × 16 storeys. */
const STOREY = 3.5, BAY = 3.2;

// ------------------------------------------------------------------ textures

type Facade = "glass" | "office" | "flats" | "panel";

/** A facade (by day) and its lit windows (by night): 8 bays across, 16 storeys up, tiling. */
function facade(ctx: Ctx, kind: Facade, seed: number) {
  const W = 512, H = 1024, bw = W / 8, sh = H / 16;
  const day = canvasTexture(ctx, W, H, (g) => {
    const base = { glass: "#1d2a3a", office: "#8d8a84", flats: "#a8907a", panel: "#c9c9c4" }[kind];
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(${hash(i, seed) > 0.5 ? "255,255,255" : "0,0,0"},${0.05 * hash(i, seed + 1)})`;
      g.fillRect(hash(i, seed + 2) * W, hash(i, seed + 3) * H, 3, 3);
    }
    for (let f = 0; f < 16; f++)
      for (let b = 0; b < 8; b++) {
        const x = b * bw, y = f * sh;
        if (kind === "glass") {
          // curtain wall: tinted panes, thin mullions
          const grd = g.createLinearGradient(x, y, x + bw, y + sh);
          grd.addColorStop(0, "#2c4560");
          grd.addColorStop(1, "#15202e");
          g.fillStyle = grd;
          g.fillRect(x + 2, y + 2, bw - 4, sh - 4);
          g.fillStyle = "#596a7c";
          g.fillRect(x, y, bw, 2);
          g.fillRect(x, y, 2, sh);
        } else if (kind === "office") {
          // ribbon windows between concrete spandrels
          g.fillStyle = "#26303a";
          g.fillRect(x, y + sh * 0.3, bw, sh * 0.55);
          g.fillStyle = "#6f7880";
          g.fillRect(x + bw - 3, y + sh * 0.3, 3, sh * 0.55);
        } else if (kind === "flats") {
          // two windows a bay, a balcony slab under every other one
          for (const k of [0.12, 0.58]) {
            g.fillStyle = "#2b2622";
            g.fillRect(x + bw * k, y + sh * 0.25, bw * 0.3, sh * 0.5);
            g.fillStyle = "#e9dfd2";
            g.fillRect(x + bw * k - 2, y + sh * 0.75, bw * 0.3 + 4, 3);
          }
          if ((f + b) % 2 === 0) {
            g.fillStyle = "rgba(60,50,45,0.6)";
            g.fillRect(x + 4, y + sh * 0.82, bw - 8, sh * 0.12);
          }
        } else {
          // white panels, square windows, dark joints
          g.fillStyle = "#3a3d42";
          g.fillRect(x + bw * 0.22, y + sh * 0.2, bw * 0.56, sh * 0.55);
          g.fillStyle = "rgba(90,90,90,0.5)";
          g.fillRect(x, y + sh - 2, bw, 2);
          g.fillRect(x + bw - 2, y, 2, sh);
        }
      }
  });
  // the lit windows: about half of them, warm in homes, cooler in offices — the odd blue of a screen
  const lights = canvasTexture(ctx, W, H, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    for (let f = 0; f < 16; f++)
      for (let b = 0; b < 8; b++) {
        const r = hash(f * 8 + b, seed + 7);
        const on = r < { glass: 0.26, office: 0.3, flats: 0.32, panel: 0.3 }[kind];
        if (!on) continue;
        const tone = hash(f * 8 + b, seed + 8);
        const c = kind === "flats" ? (tone < 0.12 ? "#6f93e0" : tone < 0.6 ? "#f2b062" : "#f7cf8f") : tone < 0.35 ? "#f3cf96" : "#c9dcf5";
        const lvl = 0.35 + 0.65 * hash(f * 8 + b, seed + 9);
        g.globalAlpha = lvl;
        g.fillStyle = c;
        const x = b * bw, y = f * sh;
        if (kind === "glass") g.fillRect(x + 3, y + 3, bw - 6, sh - 6);
        else if (kind === "office") g.fillRect(x, y + sh * 0.32, bw - 3, sh * 0.5);
        else if (kind === "flats") for (const k of [0.12, 0.58]) g.fillRect(x + bw * k + 1, y + sh * 0.26, bw * 0.3 - 2, sh * 0.48);
        else g.fillRect(x + bw * 0.24, y + sh * 0.22, bw * 0.52, sh * 0.5);
        // a room's light isn't flat: brighter up by the ceiling, a blind or a curtain half down here and there
        g.globalAlpha = 1;
        const shade = g.createLinearGradient(0, y, 0, y + sh);
        const blind = hash(f * 8 + b, seed + 10) < 0.3 ? 0.55 : 0;
        shade.addColorStop(0, `rgba(0,0,0,${blind})`);
        shade.addColorStop(blind ? 0.45 : 0.3, `rgba(0,0,0,${blind * 0.9})`);
        shade.addColorStop(1, "rgba(0,0,0,0.45)");
        g.fillStyle = shade;
        g.fillRect(x, y, bw, sh);
      }
    g.globalAlpha = 1;
  });
  for (const t of [day, lights]) t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  lights.hasAlpha = false;
  day.hasAlpha = false;
  return { day, lights };
}

/** Shop fronts: glass, bright interiors and signs, a row of them (u along, v up a 4.5 m storey). */
function shopTexture(ctx: Ctx) {
  const t = canvasTexture(ctx, 1024, 128, (g) => {
    g.fillStyle = "#15171c";
    g.fillRect(0, 0, 1024, 128);
    const signs = ["#ff3b6b", "#39a0ff", "#ffb21f", "#5ee08a", "#c45bff", "#ffffff"];
    for (let i = 0; i < 8; i++) {
      const x = i * 128;
      const inside = g.createLinearGradient(0, 40, 0, 128);
      inside.addColorStop(0, hash(i, 801) < 0.5 ? "#fff1d6" : "#e6f2ff");
      inside.addColorStop(1, "#8a7f70");
      g.fillStyle = inside;
      g.fillRect(x + 6, 44, 116, 80);
      g.fillStyle = "#15171c";
      g.fillRect(x + 62, 44, 4, 80);
      // the sign over it
      g.fillStyle = signs[i % signs.length];
      g.fillRect(x + 10, 12, 108, 20);
    }
  });
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  return t;
}

/** Pavement: concrete slabs with joints (for the city's blocks and the tiles' verges). */
export function pavementTexture(ctx: Ctx, scale: number) {
  const t = canvasTexture(ctx, 512, 512, (g) => {
    g.fillStyle = "#8f8d88";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14000; i++) {
      const v = hash(i, 811);
      g.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.08 * hash(i, 812)})` : `rgba(0,0,0,${0.12 * hash(i, 813)})`;
      g.fillRect(hash(i, 814) * 512, hash(i, 815) * 512, 2, 2);
    }
    g.fillStyle = "rgba(40,40,40,0.55)";
    for (let k = 0; k <= 512; k += 64) {
      g.fillRect(k - 1, 0, 2, 512);
      g.fillRect(0, k - 1, 512, 2);
    }
  });
  t.hasAlpha = false;
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.uScale = t.vScale = scale;
  return t;
}

/** A city street: dark asphalt, a dashed centre line and kerb edges, seen from above (tiles every PERIOD m). */
export function streetTexture(ctx: Ctx, scale: number) {
  const t = canvasTexture(ctx, 512, 512, (g) => {
    g.fillStyle = "#2c2d31";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 20000; i++) {
      const v = hash(i, 821);
      g.fillStyle = v > 0.6 ? `rgba(200,200,205,${0.08 * hash(i, 822)})` : `rgba(0,0,0,${0.18 * hash(i, 823)})`;
      g.fillRect(hash(i, 824) * 512, hash(i, 825) * 512, 1.5, 1.5);
    }
  });
  t.hasAlpha = false;
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.uScale = t.vScale = scale;
  return t;
}

// ------------------------------------------------------------------ the city

type Geo = { pos: number[]; uv: number[]; idx: number[]; nor: number[] };
const geo = (): Geo => ({ pos: [], uv: [], idx: [], nor: [] });

/** A box's four walls (and optionally its roof), UVs in bays / storeys from a per-building offset. */
function box(walls: Geo, roof: Geo | null, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, ou: number, ov: number) {
  const sides: [number, number, number, number, number, number][] = [
    [x0, z0, x1, z0, 0, -1],
    [x1, z0, x1, z1, 1, 0],
    [x1, z1, x0, z1, 0, 1],
    [x0, z1, x0, z0, -1, 0],
  ];
  let u = ou;
  for (const [ax, az, bx, bz, nx, nz] of sides) {
    const len = Math.hypot(bx - ax, bz - az);
    const b = walls.pos.length / 3;
    walls.pos.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az);
    const u0 = u / (BAY * 8), u1 = (u + len) / (BAY * 8), v0 = ov + y0 / (STOREY * 16), v1 = ov + y1 / (STOREY * 16);
    walls.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let k = 0; k < 4; k++) walls.nor.push(nx, 0, nz);
    // (wound to face outward, in this right-handed scene)
    walls.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    u += len;
  }
  if (roof) {
    const b = roof.pos.length / 3;
    roof.pos.push(x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1);
    roof.uv.push(x0 / 8, z0 / 8, x1 / 8, z0 / 8, x1 / 8, z1 / 8, x0 / 8, z1 / 8);
    for (let k = 0; k < 4; k++) roof.nor.push(0, 1, 0);
    roof.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
}

function mesh(ctx: Ctx, name: string, parent: Node, g: Geo) {
  const m = new Mesh(name, ctx.scene);
  const vd = new VertexData();
  vd.positions = g.pos;
  vd.indices = g.idx;
  vd.uvs = g.uv;
  vd.normals = g.nor;
  vd.applyToMesh(m);
  m.parent = parent;
  m.isPickable = false;
  m.freezeWorldMatrix();
  return m;
}

/**
 * The city: blocks on a grid round the circuit (kept back from the track, the grandstands, the
 * billboards and anything else `free` says is taken), with traffic on the streets and street lamps
 * along the circuit. `free(x, z, margin)`: is that spot clear (by `margin` metres)?
 */
export function buildCity(ctx: Ctx, parent: Node, free: (x: number, z: number, margin: number) => boolean) {
  const root = group(ctx, { parent });
  const kinds: Facade[] = ["glass", "office", "flats", "panel"];
  const walls = Object.fromEntries(kinds.map((k) => [k, geo()])) as Record<Facade, Geo>;
  const roofs = geo(), shops = geo(), pave = geo();
  const beacons: number[] = [];
  const street: number[] = [];
  // downtown: a couple of clusters of towers, out beyond the track on opposite sides
  const B = TRACK.bounds;
  const centres = [
    [B.x0 - 90, (B.z0 + B.z1) / 2 + 60],
    [B.x1 + 90, (B.z0 + B.z1) / 2 - 80],
    [(B.x0 + B.x1) / 2 + 40, B.z1 + 120],
  ];
  const n = Math.ceil(RADIUS / PERIOD);
  for (let gx = -n; gx <= n; gx++)
    for (let gz = -n; gz <= n; gz++) {
      const bx0 = gx * PERIOD + STREET / 2, bz0 = gz * PERIOD + STREET / 2;
      const bx1 = bx0 + BLOCK, bz1 = bz0 + BLOCK;
      const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      if (Math.hypot(cx, cz) > RADIUS) continue;
      // lots: the block whole, or in two, or in four
      const split = hash(gx * 97 + gz, 901);
      const lots: [number, number, number, number][] =
        split < 0.25
          ? [[bx0, bx1, bz0, bz1]]
          : split < 0.5
            ? [
                [bx0, cx, bz0, bz1],
                [cx, bx1, bz0, bz1],
              ]
            : [
                [bx0, cx, bz0, cz],
                [cx, bx1, bz0, cz],
                [bx0, cx, cz, bz1],
                [cx, bx1, cz, bz1],
              ];
      let any = false;
      lots.forEach(([x0, x1, z0, z1], li) => {
        const corners = [
          [x0, z0],
          [x1, z0],
          [x0, z1],
          [x1, z1],
          [(x0 + x1) / 2, (z0 + z1) / 2],
        ];
        if (!corners.every(([x, z]) => free(x, z, 12))) return;
        any = true;
        const id = (gx * 131 + gz) * 7 + li;
        const near = Math.min(...centres.map(([px, pz]) => Math.hypot((x0 + x1) / 2 - px, (z0 + z1) / 2 - pz)));
        const downtown = Math.max(0, 1 - near / 260);
        const r = hash(id, 902);
        const kind: Facade = downtown > 0.45 && r < 0.6 ? "glass" : r < 0.3 ? "office" : r < 0.7 ? "flats" : "panel";
        const tall = kind === "glass" ? 70 + downtown * 110 * hash(id, 903) + 40 * hash(id, 904) : kind === "office" ? 22 + 45 * hash(id, 905) * (0.5 + downtown) : 14 + 26 * hash(id, 906);
        const h = Math.round(tall / STOREY) * STOREY;
        const inset = 2.5 + hash(id, 907) * 3;
        const X0 = x0 + inset, X1 = x1 - inset, Z0 = z0 + inset, Z1 = z1 - inset;
        const ou = Math.floor(hash(id, 908) * 8) * BAY, ov = Math.floor(hash(id, 909) * 16) / 16;
        if (kind === "glass" && h > 60) {
          // a podium, and the tower set back on it
          box(walls.office, roofs, X0, X1, Z0, Z1, 0, 4.5 * 3, ou, ov);
          const s = 3 + hash(id, 910) * 4;
          box(walls.glass, roofs, X0 + s, X1 - s, Z0 + s, Z1 - s, 4.5 * 3, h, ou, ov);
          beacons.push((X0 + X1) / 2, h + 1.5, (Z0 + Z1) / 2);
        } else {
          box(walls[kind], roofs, X0, X1, Z0, Z1, kind === "glass" ? 0 : 4.5, h, ou, ov);
          // the ground floor: shops, a little proud of the wall
          if (kind !== "glass") box(shops, null, X0 - 0.3, X1 + 0.3, Z0 - 0.3, Z1 + 0.3, 0, 4.5, hash(id, 911) * 1000, 0);
        }
      });
      if (!any) continue;
      // the block's pavement (a kerb's height up), and lamps along its edges
      {
        const b = pave.pos.length / 3, y = 0.15;
        pave.pos.push(bx0, y, bz0, bx1, y, bz0, bx1, y, bz1, bx0, y, bz1);
        pave.uv.push(bx0 / 5, bz0 / 5, bx1 / 5, bz0 / 5, bx1 / 5, bz1 / 5, bx0 / 5, bz1 / 5);
        for (let k = 0; k < 4; k++) pave.nor.push(0, 1, 0);
        pave.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        for (let k = 0; k < 4; k++) {
          const t = (k + 0.5) / 4;
          for (const [x, z] of [
            [bx0 + t * BLOCK, bz0 - 1],
            [bx0 + t * BLOCK, bz1 + 1],
            [bx0 - 1, bz0 + t * BLOCK],
            [bx1 + 1, bz0 + t * BLOCK],
          ])
            if (free(x, z, 6)) street.push(x, 7, z);
        }
      }
    }
  // ---- the meshes, one per material
  const facades = Object.fromEntries(kinds.map((k, i) => [k, facade(ctx, k, 920 + i * 13)])) as unknown as Record<Facade, { day: Texture; lights: Texture }>;
  for (const k of kinds) {
    if (!walls[k].pos.length) continue;
    const m = mesh(ctx, `city-${k}`, root, walls[k]);
    const mat = new StandardMaterial(`city-${k}`, ctx.scene);
    mat.diffuseTexture = facades[k].day;
    // (StandardMaterial adds its emissive texture onto emissiveColor: black, so only the lit windows glow)
    mat.emissiveTexture = facades[k].lights;
    mat.emissiveTexture.level = 1.0; // (bright enough against the night to read from across the city)
    mat.emissiveColor = Color3.Black();
    // (added after the lighting, not multiplied by the facade's own dark colour: a lit window glows)
    mat.useEmissiveAsIllumination = true;
    mat.specularColor = k === "glass" ? new Color3(0.5, 0.55, 0.6) : new Color3(0.08, 0.08, 0.08);
    mat.specularPower = k === "glass" ? 96 : 16;
    m.material = mat;
    m.receiveShadows = true;
  }
  {
    const m = mesh(ctx, "city-roofs", root, roofs);
    const mat = lit(ctx, { color: "#3b3c40", rough: 0.95 });
    m.material = mat;
  }
  if (shops.pos.length) {
    const m = mesh(ctx, "city-shops", root, shops);
    // (the shop texture is one storey high: v 0…1 over the 4.5 m)
    const uv = m.getVerticesData("uv")!;
    for (let i = 1; i < uv.length; i += 2) uv[i] = uv[i] > 0.01 ? 1 : 0;
    m.setVerticesData("uv", uv);
    const t = shopTexture(ctx);
    t.uScale = 0.6;
    const mat = new StandardMaterial("city-shops", ctx.scene);
    mat.diffuseTexture = t;
    mat.emissiveTexture = t;
    mat.emissiveTexture.level = 0.9;
    mat.emissiveColor = Color3.Black();
    mat.useEmissiveAsIllumination = true;
    mat.specularColor = new Color3(0.2, 0.2, 0.2);
    m.material = mat;
  }
  {
    const m = mesh(ctx, "city-pavement", root, pave);
    const mat = lit(ctx, { rough: 0.95, double: true });
    mat.albedoTexture = pavementTexture(ctx, 1);
    m.material = mat;
    m.receiveShadows = true;
  }
  // red aircraft beacons on the towers, blinking; the city's street lamps, warm
  if (beacons.length) {
    const p = points(ctx, { positions: new Float32Array(beacons), sizes: new Float32Array(beacons.length / 3).fill(7), phases: new Float32Array(beacons.length / 3).map((_, i) => hash(i, 931)), color: "#ff2a2a", opacity: 1, speed: 0.9, pixel: 4, attenuate: true });
    p.parent = root;
  }
  if (street.length) {
    const p = points(ctx, { positions: new Float32Array(street), sizes: new Float32Array(street.length / 3).fill(6), phases: new Float32Array(street.length / 3).fill(0), color: "#ffcf8a", opacity: 0.95, speed: 0, pixel: 4, attenuate: true });
    p.parent = root;
  }

  buildTraffic(ctx, root, free);
  buildTrackLamps(ctx, root);
}

// ------------------------------------------------------------------ traffic

/** Cars on the city's streets, both ways (lights off: it isn't dark enough for them). */
function buildTraffic(ctx: Ctx, root: Node, free: (x: number, z: number, margin: number) => boolean) {
  // the streets: grid lines between the blocks, cut into runs that keep clear of the circuit
  const runs: { ax: number; az: number; dx: number; dz: number; len: number }[] = [];
  const n = Math.ceil(RADIUS / PERIOD);
  for (const along of ["x", "z"] as const)
    for (let k = -n; k <= n; k++) {
      const c = k * PERIOD; // the street's centre line
      let start: number | null = null;
      for (let t = -RADIUS; t <= RADIUS + 4; t += 4) {
        const [x, z] = along === "x" ? [t, c] : [c, t];
        const ok = t <= RADIUS && Math.hypot(x, z) < RADIUS && free(x, z, 14);
        if (ok && start === null) start = t;
        if (!ok && start !== null) {
          if (t - start > 120) runs.push(along === "x" ? { ax: start, az: c, dx: 1, dz: 0, len: t - start } : { ax: c, az: start, dx: 0, dz: 1, len: t - start });
          start = null;
        }
      }
    }
  if (!runs.length) return;
  const cars: { run: number; dir: 1 | -1; off: number; speed: number; color: string }[] = [];
  const COLORS = ["#d8d8d8", "#1b1c20", "#9a1b1b", "#20355e", "#6d7178", "#e0c74a", "#ffffff"];
  runs.forEach((r, i) => {
    const count = Math.floor(r.len / 55);
    for (let k = 0; k < count; k++) cars.push({ run: i, dir: k % 2 ? 1 : -1, off: hash(i * 31 + k, 941) * r.len, speed: 9 + hash(i * 17 + k, 942) * 7, color: COLORS[(i + k) % COLORS.length] });
  });
  // a car: a body and a cabin (one mesh), coloured per car
  const body = MeshBuilder.CreateBox("trafficBody", { width: 1.8, height: 0.8, depth: 4.4 }, ctx.scene);
  body.position.y = 0.6;
  const cabin = MeshBuilder.CreateBox("trafficCabin", { width: 1.6, height: 0.65, depth: 2.2 }, ctx.scene);
  cabin.position.set(0, 1.3, -0.3);
  const car = Mesh.MergeMeshes([body, cabin], true)!;
  const cm = new StandardMaterial("traffic", ctx.scene);
  cm.diffuseColor = Color3.White();
  cm.specularColor = new Color3(0.4, 0.4, 0.4);
  car.material = cm;
  car.parent = root;
  car.isPickable = false;
  car.alwaysSelectAsActiveMesh = true;
  const N = cars.length;
  const mats = { car: new Float32Array(N * 16) };
  const cols = new Float32Array(N * 4);
  cars.forEach((c, i) => {
    const cc = Color3.FromHexString(c.color);
    cols.set([cc.r, cc.g, cc.b, 1], i * 4);
  });
  car.thinInstanceSetBuffer("matrix", mats.car, 16, false);
  car.thinInstanceSetBuffer("color", cols, 4, true);
  const M = new Matrix(), q = new Quaternion(), one = new Vector3(1, 1, 1), P = new Vector3();
  ctx.onFrame((_, t) => {
    cars.forEach((c, i) => {
      const r = runs[c.run];
      // (keep right: the lane is 3 m off the centre line)
      let a = (c.off + c.speed * t * c.dir) % r.len;
      if (a < 0) a += r.len;
      const lx = -r.dz * c.dir * 3, lz = r.dx * c.dir * 3;
      const x = r.ax + r.dx * a + lx, z = r.az + r.dz * a + lz;
      const yaw = Math.atan2(r.dx * c.dir, r.dz * c.dir);
      Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, q);
      P.set(x, 0, z);
      Matrix.ComposeToRef(one, q, P, M);
      M.copyToArray(mats.car, i * 16);
    });
    car.thinInstanceBufferUpdated("matrix");
  });
}

// ------------------------------------------------------------------ lamps along the circuit

/** Street lamps along the circuit, outside the walls, each throwing a pool of warm light on the road. */
function buildTrackLamps(ctx: Ctx, root: Node) {
  const poles = { pos: [] as number[], idx: [] as number[] };
  const heads: number[] = [];
  const pools: { x: number; y: number; z: number; h: number }[] = [];
  const L = TRACK.length;
  let side = 1;
  for (let s = 10; s < L - 10; s += 26) {
    const p = TRACK.pieces.find((q) => s >= q.s0 && s < q.s0 + q.length);
    // (none on the loop, the ramps or underground — the tunnels have their own lights)
    if (!p || p.cmd === "LOOP" || p.cmd === "UP" || p.cmd === "DN" || isUnder(p.cmd)) continue;
    side = -side;
    const q = sampleAt(s);
    const y = heightAt(s);
    const lx = Math.cos(q.heading) * side, lz = -Math.sin(q.heading) * side;
    const out = WALL_IN + WALL_T + 0.8;
    const bx = q.x + lx * out, bz = q.z + lz * out;
    const H = 9;
    // the pole and its arm reaching over the wall (thin boxes)
    const quad = (ax: number, ay: number, az: number, cx: number, cy: number, cz: number, w: number) => {
      const b = poles.pos.length / 3;
      // a cross of two thin planes along the segment
      const ux = -(cz - az), uz = cx - ax, ul = Math.hypot(ux, uz) || 1;
      const ox = (ux / ul) * w, oz = (uz / ul) * w;
      poles.pos.push(ax - ox, ay, az - oz, ax + ox, ay, az + oz, cx + ox, cy, cz + oz, cx - ox, cy, cz - oz);
      poles.pos.push(ax, ay - w, az, ax, ay + w, az, cx, cy + w, cz, cx, cy - w, cz);
      for (const k of [b, b + 4]) poles.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    };
    const pole = MeshBuilder.CreateCylinder("lampPole", { height: H, diameterTop: 0.22, diameterBottom: 0.32, tessellation: 8 }, ctx.scene);
    pole.position.set(bx, y + H / 2, bz);
    pole.parent = root;
    pole.isPickable = false;
    pole.material = lampPoleMat(ctx);
    const ax = q.x + lx * (out - 4.2), az = q.z + lz * (out - 4.2);
    quad(bx, y + H, bz, ax, y + H + 0.3, az, 0.09);
    heads.push(ax, y + H, az);
    pools.push({ x: q.x + lx * (out - 6.5), y: y + 0.06, z: q.z + lz * (out - 6.5), h: q.heading });
  }
  if (poles.pos.length) {
    const arms = new Mesh("lampArms", ctx.scene);
    const vd = new VertexData();
    vd.positions = poles.pos;
    vd.indices = poles.idx;
    const nor: number[] = [];
    VertexData.ComputeNormals(poles.pos, poles.idx, nor);
    vd.normals = nor;
    vd.applyToMesh(arms);
    arms.material = lampPoleMat(ctx);
    arms.parent = root;
    arms.isPickable = false;
  }
  if (heads.length) {
    const p = points(ctx, { positions: new Float32Array(heads), sizes: new Float32Array(heads.length / 3).fill(9), phases: new Float32Array(heads.length / 3).fill(0), color: "#ffd9a0", opacity: 1, speed: 0, pixel: 4, attenuate: true });
    p.parent = root;
  }
  // the pools of light on the road: one mesh of soft discs
  const tex = canvasTexture(ctx, 128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,225,170,0.9)");
    grd.addColorStop(0.55, "rgba(255,215,160,0.35)");
    grd.addColorStop(1, "rgba(255,210,150,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
  const mat = unlit(ctx, { map: tex, additive: true, depthWrite: false });
  setAdditive(mat, "#ffd9a8", 0.35);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const R = 11;
  for (const p of pools) {
    const b = pos.length / 3;
    const fx = Math.sin(p.h), fz = Math.cos(p.h), rx = Math.cos(p.h), rz = -Math.sin(p.h);
    for (const [u, v] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      pos.push(p.x + rx * u * R + fx * v * R * 1.2, p.y, p.z + rz * u * R + fz * v * R * 1.2);
      uv.push((u + 1) / 2, (v + 1) / 2);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  if (pos.length) {
    const m = new Mesh("lampPools", ctx.scene);
    const vd = new VertexData();
    vd.positions = pos;
    vd.indices = idx;
    vd.uvs = uv;
    vd.normals = pos.map((_, i) => (i % 3 === 1 ? 1 : 0));
    vd.applyToMesh(m);
    m.material = mat;
    mat.backFaceCulling = false;
    m.parent = root;
    m.isPickable = false;
  }
}

let poleMat: ReturnType<typeof lit> | null = null;
function lampPoleMat(ctx: Ctx) {
  if (!poleMat || poleMat.getScene() !== ctx.scene) poleMat = lit(ctx, { color: "#4a4f57", metal: 0.6, rough: 0.5 });
  return poleMat;
}
