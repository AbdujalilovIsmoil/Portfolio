import { Color3, DynamicTexture, Mesh, MeshBuilder, MirrorTexture, Plane, StandardMaterial, Texture, Vector3, type Node } from "@babylonjs/core";
import type { DoorSystem } from "./Doors";
import { box, group, lit, plane, type Ctx } from "./core";

/** Photos for the picture frames: the portfolio's own project and gallery images. */
export const PICTURES = [
  "/img/masonry-portfolio/masonry-portfolio-1.jpg",
  "/img/masonry-portfolio/masonry-portfolio-2.jpg",
  "/img/masonry-portfolio/masonry-portfolio-3.jpg",
  "/img/masonry-portfolio/masonry-portfolio-4.jpg",
  "/img/masonry-portfolio/masonry-portfolio-5.jpg",
  "/img/masonry-portfolio/masonry-portfolio-6.jpg",
  "/img/masonry-portfolio/masonry-portfolio-7.jpg",
  "/img/masonry-portfolio/masonry-portfolio-8.jpg",
  "/img/masonry-portfolio/masonry-portfolio-9.jpg",
];

/**
 * A framed picture hanging on a wall: (x, y, z) is its centre, `yaw` the way it faces
 * (0 = +z, π/2 = +x, -π/2 = -x), w × h the picture size in metres.
 */
export function picture(ctx: Ctx, parent: Node, x: number, y: number, z: number, yaw: number, w: number, h: number, i: number) {
  const g = group(ctx, { parent, pos: [x, y, z], rot: [0, yaw, 0] });
  const frame = lit(ctx, { color: "#6b4a22", rough: 0.4, metal: 0.4 });
  const f = 0.06;
  box(ctx, w + 2 * f, f, 0.04, { parent: g, pos: [0, h / 2 + f / 2, 0.02], mat: frame });
  box(ctx, w + 2 * f, f, 0.04, { parent: g, pos: [0, -h / 2 - f / 2, 0.02], mat: frame });
  box(ctx, f, h, 0.04, { parent: g, pos: [-w / 2 - f / 2, 0, 0.02], mat: frame });
  box(ctx, f, h, 0.04, { parent: g, pos: [w / 2 + f / 2, 0, 0.02], mat: frame });
  box(ctx, w + 0.02, h + 0.02, 0.01, { parent: g, pos: [0, 0, 0.005], mat: lit(ctx, { color: "#f1ece2", rough: 0.9 }) }); // mount
  const tex = new Texture(PICTURES[i % PICTURES.length], ctx.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  tex.anisotropicFilteringLevel = 4;
  const m = lit(ctx, { rough: 0.6, double: true });
  m.albedoTexture = tex;
  const p = plane(ctx, w * 0.88, h * 0.88, { parent: g, pos: [0, 0, 0.016], mat: m });
  p.isPickable = false;
  return g;
}

/**
 * The ornate mirror model with a real reflection in its glass: a mirror render target that only
 * renders while you stand within a few metres of it (you see yourself and the room behind you).
 */
export function mirror(ctx: Ctx, parent: Node, x: number, y: number, z: number, yaw: number, scale: number, reflect = true, room?: { x0: number; x1: number; z0: number; z1: number }) {
  // a plain, well-made mirror: a slim walnut frame round a bevelled glass, w × h metres
  const g = group(ctx, { parent, pos: [x, y, z], rot: [0, yaw, 0] });
  const w = 0.3 * scale, hgt = 0.72 * scale, f = 0.06;
  const wood = lit(ctx, { color: "#4a2e1a", rough: 0.45 });
  const gold = lit(ctx, { color: "#b08a3c", rough: 0.3, metal: 0.8 });
  for (const [bw, bh, bx, by] of [[w + 2 * f, f, 0, hgt / 2 + f / 2], [w + 2 * f, f, 0, -hgt / 2 - f / 2], [f, hgt, -w / 2 - f / 2, 0], [f, hgt, w / 2 + f / 2, 0]] as [number, number, number, number][])
    box(ctx, bw, bh, 0.05, { parent: g, pos: [bx, by, 0.025], mat: wood });
  for (const [bw, bh, bx, by] of [[w + 0.02, 0.012, 0, hgt / 2 + 0.006], [w + 0.02, 0.012, 0, -hgt / 2 - 0.006], [0.012, hgt, -w / 2 - 0.006, 0], [0.012, hgt, w / 2 + 0.006, 0]] as [number, number, number, number][])
    box(ctx, bw, bh, 0.056, { parent: g, pos: [bx, by, 0.028], mat: gold });
  box(ctx, w, hgt, 0.01, { parent: g, pos: [0, 0, 0.005], mat: lit(ctx, { color: "#202428", rough: 0.2 }) });
  for (const m of g.getChildMeshes()) m.isPickable = false;
  if (!reflect) {
    const pane = MeshBuilder.CreatePlane("mirrorPane", { width: w, height: hgt }, ctx.scene);
    pane.parent = g;
    pane.position.z = 0.012;
    pane.isPickable = false;
    const pm = lit(ctx, { color: "#b9c6cf", rough: 0.05, metal: 0.9 });
    pane.material = pm;
    return g;
  }
  const glass = MeshBuilder.CreatePlane("mirrorGlass", { width: w, height: hgt, sideOrientation: Mesh.DOUBLESIDE }, ctx.scene);
  glass.parent = g;
  glass.position.set(0, 0, 0.012);
  glass.isPickable = false;
  const tex = new MirrorTexture("mirror", { ratio: 0.3 }, ctx.scene, true);
  tex.refreshRate = 4; // ~15 updates a second is plenty for a reflection
  const mat = new StandardMaterial("mirrorMat", ctx.scene);
  mat.diffuseColor = new Color3(0.08, 0.08, 0.09);
  mat.specularColor = new Color3(0.4, 0.4, 0.4);
  mat.reflectionTexture = tex;
  (mat.reflectionTexture as MirrorTexture).level = 0.95;
  glass.material = mat;
  const centre = new Vector3();
  const placePlane = () => {
    g.computeWorldMatrix(true);
    glass.computeWorldMatrix(true);
    centre.copyFrom(glass.getAbsolutePosition());
    const n = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    // (the plane's normal must point INTO the wall: the clip plane keeps the side you stand on)
    tex.mirrorPlane = Plane.FromPositionAndNormal(centre, n.negate());
  };
  placePlane();
  // you, and whatever is right in front of the mirror (the full room would cost too much)
  // Only what is IN FRONT of the glass: in this right-handed scene the mirror's clip plane doesn't
  // remove the wall behind it, which then filled the whole reflection. You, plus the room behind
  // you (its walls, floor, furniture) within a few metres.
  const facing = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const tmp = new Vector3();
  tex.renderListPredicate = (m) => {
    if (m === glass || !m.isEnabled() || !m.isVisible || m.parent === g) return false;
    const c = m.getBoundingInfo().boundingSphere.centerWorld;
    c.subtractToRef(centre, tmp);
    if (Vector3.Dot(tmp, facing) < 0.08) return false;
    if (m.skeleton) return true; // you
    if (m.getTotalVertices() > 12000) return false; // dense props (plants, books…) cost too much twice
    // only the room the mirror hangs in (its walls, floor, furniture)
    // the room's shell (big pieces) plus the furniture within a few metres of the glass
    const big = m.getBoundingInfo().boundingSphere.radiusWorld > 1.5;
    if (room) return c.x > room.x0 - 0.6 && c.x < room.x1 + 0.6 && c.z > room.z0 - 0.6 && c.z < room.z1 + 0.6 && c.y < 5 && (big || tmp.lengthSquared() < 4.5 * 4.5);
    return tmp.lengthSquared() < 7 * 7;
  };
  // The material renders its mirror texture every frame while the glass is on screen, so the
  // reflection is only attached while you're close.
  const idle = new Color3(0.55, 0.6, 0.64);
  mat.reflectionTexture = null;
  mat.diffuseColor = idle;
  let on = false;
  ctx.onFrame(() => {
    const near = g.isEnabled() && Vector3.DistanceSquared(ctx.player, centre) < 25;
    if (near === on) return;
    on = near;
    if (near) placePlane();
    // The mirror pass renders with a clip plane; if the main pass has none, every material's
    // shader defines flip twice a frame and get re-prepared (very slow). A clip plane that clips
    // nothing keeps both passes on the same shaders while a mirror is in use.
    if (near && !ctx.scene.clipPlane) ctx.scene.clipPlane = NO_CLIP;
    else if (!near && ctx.scene.clipPlane === NO_CLIP) ctx.scene.clipPlane = null;
    mat.reflectionTexture = near ? tex : null;
    mat.diffuseColor = near ? new Color3(0.08, 0.08, 0.09) : idle;
  });
  return g;
}

/** A clip plane that never clips anything (see mirror()). */
const NO_CLIP = new Plane(0, -1, 0, -100000);

const clothCache = new WeakMap<object, Map<string, ReturnType<typeof lit>>>();
/** Curtain cloth: vertical folds shaded in the given colour. */
function cloth(ctx: Ctx, color: string) {
  let per = clothCache.get(ctx.scene);
  if (!per) clothCache.set(ctx.scene, (per = new Map()));
  let m = per.get(color);
  if (!m) {
    const t = new DynamicTexture("cloth", { width: 64, height: 16 }, ctx.scene, true);
    const g = t.getContext() as CanvasRenderingContext2D;
    for (let x = 0; x < 64; x++) {
      const v = 0.72 + 0.28 * Math.sin((x / 64) * Math.PI * 8);
      g.fillStyle = shade(color, v);
      g.fillRect(x, 0, 1, 16);
    }
    t.update(true);
    t.wrapU = Texture.WRAP_ADDRESSMODE;
    m = lit(ctx, { rough: 1, double: true });
    m.albedoTexture = t;
    per.set(color, m);
  }
  return m;
}
function shade(hex: string, k: number) {
  const c = Color3.FromHexString(hex);
  return new Color3(c.r * k, c.g * k, c.b * k).toHexString();
}

/**
 * Two curtains on a rail in front of a window, opened and closed with E (DoorSystem toggle).
 * `axis`: "z" for a window in a wall along x (facing ±z), "x" for one in a wall along z.
 * `at` is the wall's inner face, `inward` the direction into the room; (u, y) the window centre.
 */
export function curtains(
  ctx: Ctx,
  parent: Node,
  doors: DoorSystem,
  o: { axis: "x" | "z"; at: number; inward: 1 | -1; u: number; y: number; w: number; h: number; color: string; open?: boolean }
) {
  const g = group(ctx, { parent });
  const mat = cloth(ctx, o.color);
  const d = o.at + o.inward * 0.12;
  const H = o.h + 0.5;
  const yc = o.y + 0.08;
  const rail = lit(ctx, { color: "#8a6a3c", rough: 0.4, metal: 0.5 });
  const reach = o.w / 2 + 0.45; // each curtain hangs from the window edge + 45 cm
  const put = (along: number, yy: number, dd: number, w: number, h: number, t: number) =>
    o.axis === "z"
      ? box(ctx, w, h, t, { parent: g, pos: [along, yy, dd], mat })
      : box(ctx, t, h, w, { parent: g, pos: [dd, yy, along], mat });
  const railMesh = o.axis === "z" ? box(ctx, 2 * reach + 0.2, 0.04, 0.04, { parent: g, pos: [o.u, yc + H / 2 + 0.02, d], mat: rail }) : box(ctx, 0.04, 0.04, 2 * reach + 0.2, { parent: g, pos: [d, yc + H / 2 + 0.02, o.u], mat: rail });
  railMesh.isPickable = false;
  const left = put(0, yc, d, 1, H, 0.05);
  const right = put(0, yc, d, 1, H, 0.05);
  for (const p of [left, right]) p.isPickable = false;
  const apply = (t: number) => {
    // closed: the two meet in the middle; open: gathered at the sides
    const width = 0.3 + (1 - t) * (reach - 0.3);
    const centreL = o.u - reach + width / 2;
    const centreR = o.u + reach - width / 2;
    for (const [p, c] of [[left, centreL], [right, centreR]] as const) {
      if (o.axis === "z") {
        p.scaling.x = width;
        p.position.x = c;
      } else {
        p.scaling.z = width;
        p.position.z = c;
      }
      // gathered cloth is bunched (thicker), drawn cloth flat
      if (o.axis === "z") p.scaling.z = 1 + t * 1.6;
      else p.scaling.x = 1 + t * 1.6;
    }
  };
  const fx = o.axis === "z" ? o.u : d + o.inward * 0.9;
  const fz = o.axis === "z" ? d + o.inward * 0.9 : o.u;
  doors.addToggle({ x: fx, z: fz, label: (open) => (open ? "Close the curtains" : "Open the curtains"), apply, open: o.open ?? true });
  return g;
}

/**
 * Wallpaper / wall finishes, drawn once per kind: each room gets its own look.
 * The texture repeats `u` × `v` times across a wall box face.
 */
export function wallpaper(ctx: Ctx, kind: "damask" | "stripes" | "sage" | "plaster", u = 6, v = 2) {
  const t = new DynamicTexture("wallpaper", { width: 256, height: 256 }, ctx.scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  t.anisotropicFilteringLevel = 8;
  const g = t.getContext() as CanvasRenderingContext2D;
  if (kind === "damask") {
    g.fillStyle = "#c9d6dc";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "rgba(90,120,140,0.28)";
    for (const [cx, cy] of [[64, 64], [192, 192], [192, 64 - 128 + 128], [64, 192]] as [number, number][]) {
      if ((cx + cy) % 256 !== 128) continue;
      for (let i = 0; i < 8; i++) {
        g.save();
        g.translate(cx, cy);
        g.rotate((i / 8) * Math.PI * 2);
        g.beginPath();
        g.ellipse(0, -26, 9, 26, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.beginPath();
      g.arc(cx, cy, 10, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "rgba(90,120,140,0.18)";
    for (const [cx, cy] of [[192, 64], [64, 192]] as [number, number][]) {
      g.beginPath();
      g.moveTo(cx, cy - 22);
      g.lineTo(cx + 14, cy);
      g.lineTo(cx, cy + 22);
      g.lineTo(cx - 14, cy);
      g.fill();
    }
  } else if (kind === "stripes") {
    for (let x = 0; x < 256; x += 32) {
      g.fillStyle = "#e9d8bd";
      g.fillRect(x, 0, 20, 256);
      g.fillStyle = "#dcc4a1";
      g.fillRect(x + 20, 0, 12, 256);
      g.fillStyle = "rgba(150,90,50,0.35)";
      g.fillRect(x + 25, 0, 2, 256);
    }
  } else if (kind === "sage") {
    g.fillStyle = "#cfe0d2";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.035)`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  } else {
    g.fillStyle = "#efe4cf";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(0,0,0,0.03)`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  }
  t.update(true);
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.uScale = u;
  t.vScale = v;
  const m = lit(ctx, { rough: 0.9 });
  m.albedoTexture = t;
  return m;
}
