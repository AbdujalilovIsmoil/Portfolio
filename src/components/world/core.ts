import {
  Color3,
  Constants,
  DynamicTexture,
  FreeCamera,
  Light,
  PointLight,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  Node,
  PBRMaterial,
  Quaternion,
  Scene,
  ShaderMaterial,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexData,
} from "@babylonjs/core";

export type V3 = [number, number, number];
/** A DOM overlay pinned to a scene node — rendered by React via <HtmlAnchor>. */
export type Anchor =
  | { kind: "portal"; node: TransformNode; label: string; color: string }
  | { kind: "panel"; node: TransformNode; eyebrow: string; title: string; lines: string[]; accent: string; factor?: number }
  | { kind: "holo"; node: TransformNode; title: string; lines: string[]; accent: string }
  | { kind: "ai"; node: TransformNode };

export interface Region {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export function inRegions(regions: Region[], x: number, z: number, m: number) {
  return regions.some((r) => x >= r.x0 + m && x <= r.x1 - m && z >= r.z0 + m && z <= r.z1 - m);
}

/** Closest walkable point (used to keep the camera inside the building). */
export function nearestInRegions(regions: Region[], x: number, z: number, m: number): [number, number] {
  let best: [number, number] = [x, z];
  let bd = Infinity;
  for (const r of regions) {
    const cx = Math.min(r.x1 - m, Math.max(r.x0 + m, x));
    const cz = Math.min(r.z1 - m, Math.max(r.z0 + m, z));
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bd) {
      bd = d;
      best = [cx, cz];
    }
  }
  return best;
}

export interface VehicleState {
  driving: boolean;
  x: number;
  z: number;
  heading: number;
  speed: number;
  /** Where Character should place the player after stepping out. */
  exitAt: [number, number] | null;
}

/** Shared handle every scene module receives — keeps modules free of globals. */
export interface Ctx {
  scene: Scene;
  camera: FreeCamera;
  lowPower: boolean;
  shadow: ShadowGenerator | null;
  /** Player world position (written by Character, read by everything reactive). */
  player: Vector3;
  overlay: HTMLElement;
  vehicle: VehicleState;
  /** Furniture footprints the player can't walk through. */
  colliders: { x: number; z: number; hx: number; hz: number }[];
  /** Walkable floor rectangles (office, doorway, corridor). */
  regions: Region[];
  /** Floor height under (x, z): 0 upstairs, stepped along the stairs, -3.6 on the street. */
  groundY(x: number, z: number): number;
  /** Things you can inspect with F (frames, statues…), from every gallery room. */
  exhibits: { pos: [number, number]; radius: number; info: import("./exhibitSignal").ExhibitInfo; region: Region }[];
  time: number;
  /** Per-frame callback; returns a disposer. Runs in registration order. */
  onFrame(fn: (dt: number, t: number) => void): () => void;
  /** All room lights (data only) — see World.tsx for the pooled real lights. */
  lights: VirtualLight[];
  /** Run a (model-loading) task later, one at a time, so the frame rate never spikes. */
  defer(task: () => void): void;
  /** Callbacks run once the whole scene is built (e.g. mirror render lists). */
  afterBuild: (() => void)[];
  glowTex?: DynamicTexture;
}

/** three.js light intensities are physical (÷π on diffuse); Babylon's aren't. */
export const LIGHT_SCALE = 1 / Math.PI;

export function hash(i: number, salt: number) {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Linear-space colour: Babylon PBR materials/lights expect linear values (three.js converted hex for us). */
export const linear = (hex: string) => Color3.FromHexString(hex).toLinearSpace();

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Rotation in three.js "XYZ" Euler order (Babylon's own Euler order differs). */
export function setEuler(node: TransformNode, x: number, y: number, z: number) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  const q = node.rotationQuaternion ?? (node.rotationQuaternion = new Quaternion());
  q.set(
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3
  );
}

// ---------------------------------------------------------------- materials

export interface MatOpts {
  color?: string;
  emissive?: string;
  ei?: number;
  rough?: number;
  metal?: number;
  opacity?: number;
  double?: boolean;
  fog?: boolean;
  depthWrite?: boolean;
  additive?: boolean;
}

function commonFlags(m: Material, o: MatOpts) {
  m.backFaceCulling = !o.double;
  if (o.fog === false) m.fogEnabled = false;
  if (o.depthWrite === false) m.disableDepthWrite = true;
  if (o.additive) m.alphaMode = Constants.ALPHA_ADD;
}

/** MeshStandardMaterial equivalent. */
export function lit(ctx: Ctx, o: MatOpts = {}) {
  const m = new PBRMaterial("lit", ctx.scene);
  m.albedoColor = linear(o.color ?? "#ffffff");
  if (o.emissive) {
    m.emissiveColor = linear(o.emissive);
    m.emissiveIntensity = o.ei ?? 1;
  }
  m.roughness = o.rough ?? 1;
  m.metallic = o.metal ?? 0;
  m.maxSimultaneousLights = 8;
  m.usePhysicalLightFalloff = false;
  m.environmentIntensity = 0;
  if (o.opacity !== undefined && o.opacity < 1) {
    m.alpha = o.opacity;
    m.transparencyMode = Material.MATERIAL_ALPHABLEND;
  }
  if (o.double) m.twoSidedLighting = true;
  commonFlags(m, o);
  return m;
}

const premultiplied = new WeakSet<Texture>();
function premultiply(t: DynamicTexture) {
  if (premultiplied.has(t)) return;
  premultiplied.add(t);
  const g = t.getContext() as CanvasRenderingContext2D;
  const { width, height } = t.getSize();
  const img = g.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    d[i] *= a;
    d[i + 1] *= a;
    d[i + 2] *= a;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  t.hasAlpha = false;
  t.update(true);
}

/** Animate the strength of an additive unlit material made by unlit(). */
export function setAdditive(m: StandardMaterial, color: string, level: number) {
  m.emissiveColor = Color3.FromHexString(color).scale(level);
}

/** MeshBasicMaterial equivalent (unlit; optional texture used as alpha + tint). */
export function unlit(ctx: Ctx, o: MatOpts & { map?: Texture; opaque?: boolean } = {}) {
  const m = new StandardMaterial("unlit", ctx.scene);
  // With lighting disabled Babylon's StandardMaterial outputs `emissive * baseColor(texture)`.
  m.disableLighting = true;
  m.specularColor = Color3.Black();
  m.diffuseColor = Color3.Black();
  const base = Color3.FromHexString(o.color ?? "#ffffff");
  m.emissiveColor = base;
  if (o.additive && o.map instanceof DynamicTexture) {
    // Premultiplied texture + ONE/ONE == three's SRC_ALPHA/ONE additive blending.
    premultiply(o.map);
    m.diffuseTexture = o.map;
    m.emissiveColor = base.scale(o.opacity ?? 1);
    m.transparencyMode = Material.MATERIAL_ALPHABLEND;
    m.alphaMode = Constants.ALPHA_ONEONE;
    commonFlags(m, { ...o, additive: false });
    return m;
  }
  if (o.map) {
    m.diffuseTexture = o.map;
    if (!o.opaque) {
      o.map.hasAlpha = true;
      m.useAlphaFromDiffuseTexture = true;
    }
  }
  if (o.opacity !== undefined) m.alpha = o.opacity;
  if (o.opacity !== undefined || (o.map && !o.opaque) || o.additive) m.transparencyMode = Material.MATERIAL_ALPHABLEND;
  commonFlags(m, o);
  return m;
}

// ----------------------------------------------------------------- meshes

export interface PlaceOpts {
  pos?: V3;
  rot?: V3;
  scale?: number | V3;
  parent?: Node | null;
  cast?: boolean;
  receive?: boolean;
  mat?: Material;
}

export function place<T extends TransformNode>(ctx: Ctx, n: T, o: PlaceOpts = {}): T {
  if (o.parent) n.parent = o.parent;
  if (o.pos) n.position.set(o.pos[0], o.pos[1], o.pos[2]);
  if (o.rot) setEuler(n, o.rot[0], o.rot[1], o.rot[2]);
  if (o.scale !== undefined) {
    if (typeof o.scale === "number") n.scaling.setAll(o.scale);
    else n.scaling.set(o.scale[0], o.scale[1], o.scale[2]);
  }
  if (n instanceof Mesh) {
    if (o.mat) n.material = o.mat;
    if (o.cast && ctx.shadow) ctx.shadow.addShadowCaster(n);
    if (o.receive) n.receiveShadows = true;
  }
  return n;
}

export const group = (ctx: Ctx, o: PlaceOpts = {}) => place(ctx, new TransformNode("g", ctx.scene), o);

export const box = (ctx: Ctx, w: number, h: number, d: number, o: PlaceOpts) =>
  place(ctx, MeshBuilder.CreateBox("box", { width: w, height: h, depth: d }, ctx.scene), o);

export const sphere = (ctx: Ctx, r: number, seg: number, o: PlaceOpts) =>
  place(ctx, MeshBuilder.CreateSphere("sph", { diameter: r * 2, segments: seg }, ctx.scene), o);

export const cylinder = (ctx: Ctx, rTop: number, rBot: number, h: number, seg: number, o: PlaceOpts, open = false) =>
  place(
    ctx,
    MeshBuilder.CreateCylinder(
      "cyl",
      { diameterTop: rTop * 2, diameterBottom: rBot * 2, height: h, tessellation: seg, cap: open ? Mesh.NO_CAP : Mesh.CAP_ALL },
      ctx.scene
    ),
    o
  );

export const cone = (ctx: Ctx, r: number, h: number, seg: number, o: PlaceOpts, open = false) =>
  cylinder(ctx, 0, r, h, seg, o, open);

/** Torus lying in the XY plane (axis Z), like three.js TorusGeometry. */
export function torus(ctx: Ctx, R: number, r: number, seg: number, o: PlaceOpts) {
  const m = MeshBuilder.CreateTorus("tor", { diameter: R * 2, thickness: r * 2, tessellation: seg }, ctx.scene);
  m.rotation.x = Math.PI / 2;
  m.bakeCurrentTransformIntoVertices();
  m.rotation.set(0, 0, 0);
  return place(ctx, m, o);
}

/** XY-plane quad facing +Z (three.js PlaneGeometry). */
export function plane(ctx: Ctx, w: number, h: number, o: PlaceOpts) {
  const m = MeshBuilder.CreatePlane("pl", { width: w, height: h }, ctx.scene);
  return place(ctx, m, o);
}

function flatFan(name: string, ctx: Ctx, rIn: number, rOut: number, seg: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const rings = rIn > 0 ? 2 : 1;
  if (rIn <= 0) {
    pos.push(0, 0, 0);
    nor.push(0, 0, 1);
    uv.push(0.5, 0.5);
  }
  for (let ring = 0; ring < rings; ring++) {
    const r = rIn > 0 ? (ring === 0 ? rIn : rOut) : rOut;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
      nor.push(0, 0, 1);
      uv.push((Math.cos(a) * r) / rOut / 2 + 0.5, (Math.sin(a) * r) / rOut / 2 + 0.5);
    }
  }
  for (let i = 0; i < seg; i++) {
    if (rIn > 0) {
      const a = i, b = i + 1, c = seg + 1 + i, d = seg + 1 + i + 1;
      idx.push(a, c, b, b, c, d);
    } else {
      idx.push(0, 1 + i + 1, 1 + i);
    }
  }
  const m = new Mesh(name, ctx.scene);
  const vd = new VertexData();
  vd.positions = pos;
  vd.normals = nor;
  vd.uvs = uv;
  vd.indices = idx;
  vd.applyToMesh(m);
  return m;
}

/** Flat annulus in the XY plane facing +Z (three.js RingGeometry). */
export const ring = (ctx: Ctx, rIn: number, rOut: number, seg: number, o: PlaceOpts) =>
  place(ctx, flatFan("ring", ctx, rIn, rOut, seg), o);

/** Flat disc in the XY plane facing +Z (three.js CircleGeometry). */
export const disc = (ctx: Ctx, r: number, seg: number, o: PlaceOpts) => place(ctx, flatFan("disc", ctx, 0, r, seg), o);

// --------------------------------------------------------------- textures

export function canvasTexture(ctx: Ctx, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const t = new DynamicTexture("tex", { width: w, height: h }, ctx.scene, false);
  const g = t.getContext() as CanvasRenderingContext2D;
  draw(g);
  t.update(true);
  t.hasAlpha = true;
  return t;
}

export function glowTexture(ctx: Ctx, fresh = false) {
  if (ctx.glowTex && !fresh) return ctx.glowTex;
  const t = canvasTexture(ctx, 128, 128, (g) => {
    const s = 128;
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.35, "rgba(255,255,255,0.6)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
  if (!fresh) ctx.glowTex = t;
  return t;
}

/** Camera-facing textured quad (three.js Sprite). Size is in world units. */
export function sprite(
  ctx: Ctx,
  tex: Texture,
  o: PlaceOpts & { color?: string; opacity?: number; additive?: boolean; size?: [number, number]; fog?: boolean }
) {
  const m = plane(ctx, 1, 1, o);
  m.billboardMode = Mesh.BILLBOARDMODE_ALL;
  m.material = unlit(ctx, { color: o.color, opacity: o.opacity ?? 1, map: tex, additive: o.additive, depthWrite: false, fog: o.fog, double: true });
  if (o.size) m.scaling.set(o.size[0], o.size[1], 1);
  m.isPickable = false;
  return m;
}

// -------------------------------------------------------------- instancing

/** Thin-instance helper standing in for three.js InstancedMesh + dummy Object3D. */
export class Instancer {
  private buf: Float32Array;
  private m = new Matrix();
  private q = new Quaternion();
  private p = new Vector3();
  private s = new Vector3();
  constructor(public mesh: Mesh, public count: number) {
    this.buf = new Float32Array(count * 16);
    mesh.thinInstanceSetBuffer("matrix", this.buf, 16, false);
    mesh.alwaysSelectAsActiveMesh = true;
  }
  set(i: number, x: number, y: number, z: number, scale: number, rx = 0, ry = 0, rz = 0) {
    const c1 = Math.cos(rx / 2), c2 = Math.cos(ry / 2), c3 = Math.cos(rz / 2);
    const s1 = Math.sin(rx / 2), s2 = Math.sin(ry / 2), s3 = Math.sin(rz / 2);
    this.q.set(
      s1 * c2 * c3 + c1 * s2 * s3,
      c1 * s2 * c3 - s1 * c2 * s3,
      c1 * c2 * s3 + s1 * s2 * c3,
      c1 * c2 * c3 - s1 * s2 * s3
    );
    this.p.set(x, y, z);
    this.s.setAll(scale);
    Matrix.ComposeToRef(this.s, this.q, this.p, this.m);
    this.buf.set(this.m.asArray(), i * 16);
  }
  flush() {
    this.mesh.thinInstanceBufferUpdated("matrix");
  }
}

// ------------------------------------------------------------------ lights

/** A light that only exists as data: the nearest few are mapped onto a fixed pool of real lights. */
export interface VirtualLight {
  pos: Vector3;
  color: Color3;
  intensity: number;
  range: number;
}

/** Room / corridor light. Cheap: no shader cost until it is one of the few nearest to the player. */
export function staticLight(ctx: Ctx, parent: Node, pos: V3, color: string, intensity: number, range: number) {
  const world = Vector3.TransformCoordinates(new Vector3(pos[0], pos[1], pos[2]), (parent as TransformNode).getWorldMatrix());
  ctx.lights.push({ pos: world, color: linear(color), intensity: intensity * LIGHT_SCALE, range });
}

/** A real, always-on point light (use sparingly: each one costs every pixel). */
export function pointLight(ctx: Ctx, parent: Node, pos: V3, color: string, intensity: number, range: number) {
  const l = new PointLight("pl", new Vector3(pos[0], pos[1], pos[2]), ctx.scene);
  l.parent = parent;
  l.diffuse = linear(color);
  l.specular = l.diffuse;
  l.range = range;
  l.falloffType = Light.FALLOFF_GLTF;
  l.intensity = intensity * LIGHT_SCALE;
  return l;
}

// ------------------------------------------------------------ point shader

export interface PointsOpts {
  positions: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  color: string;
  opacity: number;
  /** drift amplitude in world units (0 for static stars) */
  drift?: number;
  speed?: number;
  /** pixel size multiplier; attenuated by distance when `attenuate` */
  pixel: number;
  attenuate?: boolean;
}

export function points(ctx: Ctx, o: PointsOpts) {
  const mesh = new Mesh("points", ctx.scene);
  const vd = new VertexData();
  vd.positions = Array.from(o.positions);
  vd.applyToMesh(mesh, false);
  mesh.setVerticesData("aSize", o.sizes, false, 1);
  mesh.setVerticesData("aPhase", o.phases, false, 1);
  const mat = new ShaderMaterial(
    "pts",
    ctx.scene,
    {
      vertexSource: `
        precision highp float;
        attribute vec3 position; attribute float aSize; attribute float aPhase;
        uniform mat4 worldViewProjection; uniform mat4 worldView;
        uniform float uTime; uniform float uDrift; uniform float uSpeed; uniform float uPixel; uniform float uAtten;
        varying float vTw;
        void main() {
          vec3 p = position;
          float t = uTime * uSpeed + aPhase * 6.2831;
          p += uDrift * vec3(sin(t * 1.3), sin(t * 0.9 + 1.7), cos(t * 1.1 + 0.6));
          vec4 mv = worldView * vec4(p, 1.0);
          gl_Position = worldViewProjection * vec4(p, 1.0);
          float tw = 0.65 + 0.35 * sin(uTime * uSpeed * 5.0 + aPhase * 40.0);
          vTw = tw;
          float att = uAtten > 0.5 ? clamp(40.0 / max(1.0, -mv.z), 0.3, 3.0) : 1.0;
          gl_PointSize = max(1.0, aSize * uPixel * att * tw);
        }`,
      fragmentSource: `
        precision highp float;
        uniform vec3 uColor; uniform float uOpacity; varying float vTw;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d);
          gl_FragColor = vec4(uColor, a * uOpacity * (0.6 + 0.4 * vTw));
        }`,
    },
    {
      attributes: ["position", "aSize", "aPhase"],
      uniforms: ["worldViewProjection", "worldView", "uTime", "uDrift", "uSpeed", "uPixel", "uAtten", "uColor", "uOpacity"],
      needAlphaBlending: true,
    }
  );
  mat.setFloat("uDrift", o.drift ?? 0);
  mat.setFloat("uSpeed", o.speed ?? 0.2);
  mat.setFloat("uPixel", o.pixel * (window.devicePixelRatio || 1));
  mat.setFloat("uAtten", o.attenuate ? 1 : 0);
  mat.setColor3("uColor", Color3.FromHexString(o.color));
  mat.setFloat("uOpacity", o.opacity);
  mat.setFloat("uTime", 0);
  mat.disableDepthWrite = true;
  mat.fogEnabled = false;
  mat.backFaceCulling = false;
  mat.pointsCloud = true;
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  ctx.onFrame((_, t) => mat.setFloat("uTime", t));
  return mesh;
}

export function sparkles(ctx: Ctx, count: number, scale: number, size: number, speed: number, color: string, opacity: number, parent: Node) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (hash(i, 11) - 0.5) * scale;
    positions[i * 3 + 1] = (hash(i, 12) - 0.5) * scale;
    positions[i * 3 + 2] = (hash(i, 13) - 0.5) * scale;
    sizes[i] = size * (0.6 + hash(i, 14) * 0.9);
    phases[i] = hash(i, 15);
  }
  const m = points(ctx, { positions, sizes, phases, color, opacity, drift: 0.5, speed: speed * 2, pixel: 4.5, attenuate: true });
  m.parent = parent;
  return m;
}

// ------------------------------------------------------- custom shader mat

export function shader(
  ctx: Ctx,
  name: string,
  vertexSource: string,
  fragmentSource: string,
  uniforms: string[],
  transparent = false
) {
  const m = new ShaderMaterial(name, ctx.scene, { vertexSource, fragmentSource }, {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection", ...uniforms],
    needAlphaBlending: transparent,
  });
  m.backFaceCulling = false;
  return m;
}
