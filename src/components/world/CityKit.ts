import { Color3, Material, Mesh, MeshBuilder, StandardMaterial, Texture, VertexBuffer, VertexData, type DynamicTexture, type Node, type PBRMaterial } from "@babylonjs/core";
import { canvasTexture, hash, lit, type Ctx } from "./core";

/**
 * A material plus a per-vertex tint. Surfaces sharing a material merge into the same draw call
 * whatever their colour — the whole neighbourhood needs only a handful of real materials.
 */
export class Tint {
  constructor(
    public readonly mat: Material,
    public readonly color: Color3
  ) {}
}
export type Surface = Material | Tint;
const WHITE = new Color3(1, 1, 1);

/**
 * Static-geometry batcher for the city: every box/roof added here is merged, per material and per
 * 48 m cell, into ONE mesh. A whole neighbourhood then costs a few dozen draw calls instead of
 * thousands, and camera ray-picks only test the triangles of the cell they actually cross.
 */
export class Batcher {
  private groups = new Map<string, { mat: Material; meshes: Mesh[]; cast: boolean; pickable: boolean }>();
  constructor(private ctx: Ctx, public readonly parent: Node, private cell = 96, private pickableByDefault = true) {}

  add(mesh: Mesh, surface: Surface, o: { cast?: boolean; pickable?: boolean } = {}) {
    const mat = surface instanceof Tint ? surface.mat : surface;
    const c = surface instanceof Tint ? surface.color : WHITE;
    const n = mesh.getTotalVertices();
    const colors = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b, 1], i * 4);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
    mesh.computeWorldMatrix(true);
    const ctr = mesh.getBoundingInfo().boundingBox.centerWorld;
    const cast = o.cast ?? false;
    const pickable = (o.pickable ?? true) && this.pickableByDefault;
    const key = `${mat.uniqueId}|${Math.floor(ctr.x / this.cell)}|${Math.floor(ctr.z / this.cell)}|${cast}|${pickable}`;
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { mat, meshes: [], cast, pickable }));
    g.meshes.push(mesh);
    return mesh;
  }

  /** Axis-aligned (optionally yawed) box with its UVs tiled every `tile` metres (0 = stretch once). */
  box(w: number, h: number, d: number, x: number, y: number, z: number, mat: Surface, o: { yaw?: number; tile?: number; cast?: boolean; pickable?: boolean } = {}) {
    const m = MeshBuilder.CreateBox("b", { width: w, height: h, depth: d }, this.ctx.scene);
    if (o.tile) tileUV(m, w, h, d, o.tile);
    m.position.set(x, y, z);
    if (o.yaw) m.rotation.y = o.yaw;
    return this.add(m, mat, o);
  }

  /** Hip roof over an L (x) × W (z) footprint, eaves at y, ridge `rise` above. */
  roof(L: number, W: number, rise: number, x: number, y: number, z: number, mat: Surface, o: { yaw?: number; cast?: boolean } = {}) {
    const m = hipRoof(this.ctx, L, W, rise);
    m.position.set(x, y, z);
    if (o.yaw) m.rotation.y = o.yaw;
    return this.add(m, mat, { cast: o.cast });
  }

  cylinder(r: number, h: number, x: number, y: number, z: number, mat: Surface, seg = 10) {
    const m = MeshBuilder.CreateCylinder("c", { diameter: r * 2, height: h, tessellation: seg }, this.ctx.scene);
    m.position.set(x, y, z);
    return this.add(m, mat);
  }

  /** Merge everything added so far. Call once, after building. */
  finalize() {
    const out: Mesh[] = [];
    for (const g of this.groups.values()) {
      const merged = g.meshes.length === 1 ? g.meshes[0] : Mesh.MergeMeshes(g.meshes, true, true, undefined, false, false);
      if (!merged) continue;
      merged.material = g.mat;
      merged.hasVertexAlpha = false;
      merged.parent = this.parent;
      merged.receiveShadows = true;
      merged.isPickable = g.pickable;
      if (g.cast && this.ctx.shadow) this.ctx.shadow.addShadowCaster(merged);
      merged.freezeWorldMatrix();
      merged.doNotSyncBoundingInfo = true;
      out.push(merged);
    }
    this.groups.clear();
    return out;
  }
}

/** Box UVs in world metres so a texture repeats every `tile` m regardless of the box size. */
function tileUV(m: Mesh, w: number, h: number, d: number, tile: number) {
  const uv = m.getVerticesData("uv")!;
  // CreateBox face order: front, back, right, left, top, bottom (4 verts each)
  const dims: [number, number][] = [[w, h], [w, h], [d, h], [d, h], [w, d], [w, d]];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = (f * 4 + v) * 2;
      uv[i] *= dims[f][0] / tile;
      uv[i + 1] *= dims[f][1] / tile;
    }
  m.setVerticesData("uv", uv);
}

/** Four-sided hip roof (ridge along the longer side), flat-shaded, UVs in metres/2. */
function hipRoof(ctx: Ctx, L: number, W: number, rise: number) {
  const swap = W > L;
  const a = swap ? W : L; // along the ridge
  const b = swap ? L : W;
  const r = Math.max(0, a - b) / 2;
  const P = {
    bl: [-a / 2, 0, -b / 2],
    br: [a / 2, 0, -b / 2],
    fr: [a / 2, 0, b / 2],
    fl: [-a / 2, 0, b / 2],
    rl: [-r, rise, 0],
    rr: [r, rise, 0],
  } as Record<string, number[]>;
  const faces = [
    ["fl", "fr", "rr", "rl"],
    ["br", "bl", "rl", "rr"],
    ["fr", "br", "rr"],
    ["bl", "fl", "rl"],
  ];
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const f of faces) {
    const pts = f.map((k) => P[k]);
    const [p0, p1, p2] = pts;
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((v) => v / len);
    if (n[1] < 0) n = n.map((v) => -v);
    const base = pos.length / 3;
    for (const p of pts) {
      const [x0_, y, z0_] = p;
      let x = x0_;
      let z = z0_;
      if (swap) [x, z] = [z, -x];
      pos.push(x, y, z);
      const nx = swap ? n[2] : n[0];
      const nz = swap ? -n[0] : n[2];
      nor.push(nx, n[1], nz);
      // slope-aligned planar mapping: u along the eave, v up the slope
      uv.push((Math.abs(nx) > Math.abs(nz) ? z : x) / 2, (y + Math.hypot(x * Math.abs(nx), z * Math.abs(nz))) / 2);
    }
    if (pts.length === 4) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else idx.push(base, base + 1, base + 2);
  }
  const m = new Mesh("roof", ctx.scene);
  const vd = new VertexData();
  vd.positions = pos;
  vd.normals = nor;
  vd.uvs = uv;
  vd.indices = idx;
  vd.applyToMesh(m);
  return m;
}

// ----------------------------------------------------------------- textures

function noisy(g: CanvasRenderingContext2D, s: number, base: string, amount: number, seed: number) {
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < s * s * 0.06; i++) {
    const v = hash(i, seed);
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${amount * hash(i, seed + 1)})` : `rgba(0,0,0,${amount * hash(i, seed + 2)})`;
    g.fillRect(Math.floor(hash(i, seed + 3) * s), Math.floor(hash(i, seed + 4) * s), 2, 2);
  }
}

function texMat(ctx: Ctx, t: DynamicTexture, o: { rough?: number; color?: string; double?: boolean } = {}) {
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.hasAlpha = false;
  const m = lit(ctx, { color: o.color ?? "#ffffff", rough: o.rough ?? 0.9, double: o.double });
  m.albedoTexture = t;
  return m;
}

export interface CityMaterials {
  plaster: Tint[];
  brick: PBRMaterial;
  stone: PBRMaterial;
  roofs: Tint[];
  paving: PBRMaterial;
  grass: PBRMaterial;
  soil: PBRMaterial;
  asphalt: PBRMaterial;
  sidewalk: PBRMaterial;
  kerb: Tint;
  white: Tint;
  wood: Tint;
  darkWood: Tint;
  metal: Tint;
  gate: Tint[];
  /** any plain matte colour */
  matte: (hex: string) => Tint;
  /** window glass that lights up warm at night */
  glassLit: PBRMaterial;
  /** window glass that stays dark (nobody home) */
  glassDark: PBRMaterial;
  /** see-through glass for the windows that open onto real rooms */
  glassClear: PBRMaterial;
  /** the view behind the glass of windows into rooms we don't model: a lit room with curtains */
  windowBack: PBRMaterial;
  paint: StandardMaterial;
}

export function cityMaterials(ctx: Ctx): CityMaterials {
  const plasterTex = canvasTexture(ctx, 128, 128, (g) => noisy(g, 128, "#ffffff", 0.06, 3));
  const tint = (mat: Material, hex: string) => new Tint(mat, Color3.FromHexString(hex).toLinearSpace());
  const plasterMat = texMat(ctx, plasterTex, { rough: 0.95 });
  const plaster = ["#efe3cc", "#f3ead9", "#e9d6b4", "#f1dcc6", "#dfe6e4", "#f5efe4"].map((c) => tint(plasterMat, c));
  const matteMat = lit(ctx, { rough: 0.75 });
  const metalMat = lit(ctx, { rough: 0.4, metal: 0.55 });

  const brick = texMat(
    ctx,
    canvasTexture(ctx, 256, 256, (g) => {
      g.fillStyle = "#c9b79a";
      g.fillRect(0, 0, 256, 256);
      const bh = 256 / 12;
      for (let r = 0; r < 12; r++)
        for (let c = 0; c < 5; c++) {
          const x = c * 54 + (r % 2 ? 27 : 0) - 27;
          const v = hash(r * 7 + c, 5);
          g.fillStyle = `rgb(${168 + v * 30},${92 + v * 22},${62 + v * 14})`;
          g.fillRect(x + 2, r * bh + 2, 50, bh - 4);
        }
    }),
    { rough: 0.9 }
  );
  const stone = texMat(
    ctx,
    canvasTexture(ctx, 128, 128, (g) => {
      noisy(g, 128, "#9b958a", 0.12, 7);
      g.strokeStyle = "rgba(60,55,50,0.6)";
      g.lineWidth = 2;
      for (let y = 0; y < 128; y += 32) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(128, y);
        g.stroke();
        for (let x = (y / 32) % 2 ? 0 : 24; x < 128; x += 48) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + 32);
          g.stroke();
        }
      }
    }),
    { rough: 0.85 }
  );
  const roofTex = canvasTexture(ctx, 128, 128, (g) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 16) {
      const grd = g.createLinearGradient(x, 0, x + 16, 0);
      grd.addColorStop(0, "rgba(0,0,0,0.25)");
      grd.addColorStop(0.5, "rgba(255,255,255,0.15)");
      grd.addColorStop(1, "rgba(0,0,0,0.25)");
      g.fillStyle = grd;
      g.fillRect(x, 0, 16, 128);
    }
  });
  const roofMat = texMat(ctx, roofTex, { rough: 0.45, double: true });
  roofMat.metallic = 0.35;
  const roofs = ["#3f7a5a", "#8a3b32", "#4f6b8a", "#7a6a5a", "#2f6e78"].map((c) => tint(roofMat, c));
  const paving = texMat(
    ctx,
    canvasTexture(ctx, 128, 128, (g) => {
      g.fillStyle = "#b9b2a6";
      g.fillRect(0, 0, 128, 128);
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 4; c++) {
          const v = hash(r * 4 + c, 9);
          g.fillStyle = `rgb(${176 + v * 26},${168 + v * 24},${156 + v * 22})`;
          g.fillRect(c * 32 + (r % 2 ? 16 : 0) + 1, r * 16 + 1, 30, 14);
        }
    }),
    { rough: 0.8 }
  );
  const grass = texMat(ctx, canvasTexture(ctx, 128, 128, (g) => {
    g.fillStyle = "#5f8a3a";
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2600; i++) {
      const v = hash(i, 13);
      g.fillStyle = v > 0.5 ? "rgba(140,190,80,0.5)" : "rgba(40,70,25,0.45)";
      g.fillRect(hash(i, 14) * 128, hash(i, 15) * 128, 1, 3);
    }
  }), { rough: 1 });
  const soil = texMat(ctx, canvasTexture(ctx, 64, 64, (g) => noisy(g, 64, "#7a5f43", 0.2, 17)), { rough: 1 });
  const asphalt = texMat(ctx, canvasTexture(ctx, 128, 128, (g) => noisy(g, 128, "#34373c", 0.12, 19)), { rough: 0.92 });
  const sidewalk = texMat(
    ctx,
    canvasTexture(ctx, 128, 128, (g) => {
      noisy(g, 128, "#bdb7ab", 0.06, 23);
      g.strokeStyle = "rgba(90,85,78,0.45)";
      g.lineWidth = 2;
      for (let i = 0; i <= 128; i += 64) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, 128);
        g.moveTo(0, i);
        g.lineTo(128, i);
        g.stroke();
      }
    }),
    { rough: 0.85 }
  );
  const gate = ["#2f5d8a", "#6b4a2b", "#3f6d4e", "#8a6d2b", "#5a3a5e"].map((c) => tint(metalMat, c));
  const glassLit = lit(ctx, { color: "#2b3b52", rough: 0.12, metal: 0.6 });
  glassLit.emissiveColor.set(1, 0.72, 0.38);
  glassLit.emissiveIntensity = 0;
  const glassDark = lit(ctx, { color: "#26313f", rough: 0.12, metal: 0.6 });
  const glassClear = lit(ctx, { color: "#cfe6f2", rough: 0.05, metal: 0.1, opacity: 0.16 });
  const backTex = canvasTexture(ctx, 128, 128, (g) => {
    // a warm room interior seen through the glass, with curtains gathered at both sides
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, "#d9c7a6");
    grd.addColorStop(1, "#a88e6a");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#f5e6c8";
    g.beginPath();
    g.arc(64, 22, 9, 0, Math.PI * 2);
    g.fill();
    for (const [x0, w] of [[0, 34], [94, 34]] as [number, number][]) {
      for (let x = x0; x < x0 + w; x += 6) {
        g.fillStyle = (x / 6) % 2 ? "#8c3b4a" : "#a5495a";
        g.fillRect(x, 0, 6, 128);
      }
    }
    g.fillStyle = "#6b4a30";
    g.fillRect(0, 0, 128, 5);
  });
  backTex.hasAlpha = false;
  const windowBack = lit(ctx, { rough: 0.9 });
  windowBack.albedoTexture = backTex;
  windowBack.emissiveTexture = backTex;
  windowBack.emissiveColor.set(0, 0, 0);
  const paint = new StandardMaterial("paint", ctx.scene);
  paint.disableLighting = true;
  paint.emissiveColor.set(0.92, 0.92, 0.9);
  return {
    plaster,
    brick,
    stone,
    roofs,
    paving,
    grass,
    soil,
    asphalt,
    sidewalk,
    kerb: tint(matteMat, "#9a958c"),
    white: tint(matteMat, "#f2f0ea"),
    wood: tint(matteMat, "#8a5a34"),
    darkWood: tint(matteMat, "#5a3a22"),
    metal: tint(metalMat, "#2c3036"),
    gate,
    matte: (hex: string) => tint(matteMat, hex),
    glassLit,
    glassDark,
    glassClear,
    windowBack,
    paint,
  };
}

/**
 * Daytime albedo + night-time emissive pair for an apartment block facade (cols × rows windows per
 * tile). At night only some windows glow — different ones on each variant.
 */
export function apartmentTextures(ctx: Ctx, wall: string, cols: number, rows: number, seed: number) {
  const S = 256;
  const draw = (g: CanvasRenderingContext2D, night: boolean) => {
    g.fillStyle = night ? "#000000" : wall;
    g.fillRect(0, 0, S, S);
    if (!night) {
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(0,0,0,${0.04 * hash(i, seed)})`;
        g.fillRect(hash(i, seed + 1) * S, hash(i, seed + 2) * S, 2, 2);
      }
      // floor slabs
      g.fillStyle = "rgba(0,0,0,0.12)";
      for (let r = 0; r < rows; r++) g.fillRect(0, (r * S) / rows, S, 3);
    }
    const w = S / cols;
    const h = S / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = c * w + w * 0.18;
        const y = r * h + h * 0.22;
        const ww = w * 0.64;
        const hh = h * 0.56;
        if (night) {
          const on = hash(r * 31 + c * 7, seed + 9) < 0.42;
          if (!on) continue;
          const warm = hash(r * 13 + c, seed + 4);
          g.fillStyle = warm > 0.25 ? `rgb(255,${200 + warm * 30},${120 + warm * 40})` : "rgb(170,200,255)";
          g.fillRect(x, y, ww, hh);
        } else {
          g.fillStyle = "#e8e4dc";
          g.fillRect(x - 2, y - 2, ww + 4, hh + 4);
          const sky = g.createLinearGradient(0, y, 0, y + hh);
          sky.addColorStop(0, "#7d9ab8");
          sky.addColorStop(1, "#3e5068");
          g.fillStyle = sky;
          g.fillRect(x, y, ww, hh);
          g.fillStyle = "rgba(232,228,220,0.9)";
          g.fillRect(x + ww / 2 - 1, y, 2, hh);
          // balcony slab under every other window
          if ((c + r) % 3 === 0) {
            g.fillStyle = "rgba(0,0,0,0.18)";
            g.fillRect(x - 4, y + hh + 2, ww + 8, 5);
          }
        }
      }
  };
  const day = canvasTexture(ctx, S, S, (g) => draw(g, false));
  const night = canvasTexture(ctx, S, S, (g) => draw(g, true));
  for (const t of [day, night]) {
    t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
    t.hasAlpha = false;
  }
  return { day, night };
}
