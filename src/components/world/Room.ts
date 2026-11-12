import { addPendant } from "./Lamps";
import { wallpaper } from "./decor";
import { instantiate } from "./assets";
import { box, canvasTexture, cylinder, group, hash, lit, plane, staticLight, setEuler, unlit, type Anchor, type Ctx,  } from "./core";

export const ROOM_HX = 7; // half width (x)
export const ROOM_HZ = 5; // half depth (z)
export const ROOM_H = 3.4;

export const DOOR_X = 3.0;
/** Where the desk with the computer stands (in the bedroom, HomeRooms.ts) and its chair (x, z). */
export const DESK = { x: -1.4, z: 40.95 };
export const WORK_SPOTS: [number, number][] = [[DESK.x, DESK.z + 0.85]];
export const DOOR_W = 1.4;

export interface Collider {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

const WALL = "#d9d4c7";
const T = 0.2;

const CODE = [
  "import { useState } from 'react';",
  "",
  "export function Portfolio() {",
  "  const [open, setOpen] = useState(false);",
  "  const skills = ['React', 'Next.js', 'TypeScript'];",
  "",
  "  // 3D portfolio scene, rendered with Babylon.js",
  "  useEffect(() => {",
  "    const engine = new Engine(canvas, true);",
  "    scene.render();",
  "  }, []);",
  "",
  "  return (",
  "    <main className=\"world\">",
  "      {skills.map((s) => <Chip key={s}>{s}</Chip>)}",
  "    </main>",
  "  );",
  "}",
];

/** A monitor that types the code above, character by character, forever. */
function typingScreen(ctx: Ctx) {
  const W = 512;
  const H = 300;
  const tex = canvasTexture(ctx, W, H, () => {});
  const g = tex.getContext() as CanvasRenderingContext2D;
  const total = CODE.reduce((n, l) => n + l.length + 1, 0);
  let typed = 0;
  let hold = 0;
  let acc = 0;
  const colorFor = (tok: string) =>
    /^(import|from|export|function|const|return)$/.test(tok) ? "#c17cff" : /^['"`].*['"`]$/.test(tok) ? "#ffb86b" : /^\/\//.test(tok) ? "#6b7a99" : /^[A-Z]\w*$/.test(tok) ? "#7fe3ff" : "#d7e2ff";
  const draw = (n: number) => {
    g.fillStyle = "#0e1420";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#1c2740";
    g.fillRect(0, 0, W, 22);
    g.fillStyle = "#ff5f57";
    g.fillRect(8, 7, 8, 8);
    g.fillStyle = "#febc2e";
    g.fillRect(22, 7, 8, 8);
    g.fillStyle = "#28c840";
    g.fillRect(36, 7, 8, 8);
    g.fillStyle = "#9bb4ff";
    g.font = "11px monospace";
    g.fillText("Portfolio.tsx", 60, 15);
    g.font = "12px monospace";
    // visible window: keep the last 16 lines
    let left = n;
    const lines: string[] = [];
    for (const l of CODE) {
      if (left <= 0) break;
      lines.push(l.slice(0, Math.max(0, left)));
      left -= l.length + 1;
    }
    const first = Math.max(0, lines.length - 16);
    lines.slice(first).forEach((l, row) => {
      const y = 42 + row * 15;
      g.fillStyle = "#4a5675";
      g.fillText(String(first + row + 1).padStart(2, " "), 8, y);
      let x = 34;
      for (const tok of l.split(/(\s+|[(){}[\],;.<>=]+)/)) {
        if (!tok) continue;
        g.fillStyle = colorFor(tok);
        g.fillText(tok, x, y);
        x += g.measureText(tok).width;
      }
      if (row === lines.length - first - 1 && Math.floor(performance.now() / 450) % 2 === 0) {
        g.fillStyle = "#ffffff";
        g.fillRect(x + 1, y - 10, 6, 12);
      }
    });
    tex.update(true);
  };
  draw(0);
  ctx.onFrame((dt) => {
    // only animate while the desk is in view
    if (Math.hypot(ctx.player.x - WORK_SPOTS[0][0], ctx.player.z - WORK_SPOTS[0][1]) > 9) return;
    acc += dt;
    if (acc < 0.06) return;
    acc = 0;
    if (typed >= total) {
      hold += 0.045;
      if (hold > 3) {
        typed = 0;
        hold = 0;
      }
    } else typed += 1 + (Math.random() < 0.25 ? 1 : 0);
    draw(typed);
  });
  return tex;
}

/** Suzani: big embroidered medallions on cream cloth. */
function suzani(ctx: Ctx) {
  return canvasTexture(ctx, 512, 320, (g) => {
    g.fillStyle = "#efe2c4";
    g.fillRect(0, 0, 512, 320);
    g.strokeStyle = "#8c1c22";
    g.lineWidth = 10;
    g.strokeRect(10, 10, 492, 300);
    const medallion = (cx: number, cy: number, r: number, c1: string, c2: string) => {
      g.fillStyle = c1;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = c2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.2, r * 0.1, a, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
      g.fill();
    };
    medallion(256, 160, 78, "#b0242c", "#f2c230");
    for (const [x, y] of [[96, 90], [416, 90], [96, 230], [416, 230]]) medallion(x, y, 44, "#1d3b6b", "#e8c06a");
    g.fillStyle = "#3f6f2a";
    for (let i = 0; i < 18; i++) {
      g.beginPath();
      g.ellipse(30 + i * 27, 300, 8, 4, 0.6, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** A woven carpet (gilam): red field, a central medallion, borders. */
function gilam(ctx: Ctx) {
  const t = canvasTexture(ctx, 256, 192, (g) => {
    g.fillStyle = "#7a1d22";
    g.fillRect(0, 0, 256, 192);
    g.strokeStyle = "#1f2f55";
    g.lineWidth = 14;
    g.strokeRect(7, 7, 242, 178);
    g.strokeStyle = "#e0b45a";
    g.lineWidth = 3;
    g.strokeRect(18, 18, 220, 156);
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 6; j++) {
        if ((i + j) % 2) continue;
        g.fillStyle = "rgba(224,180,90,0.5)";
        g.beginPath();
        g.moveTo(32 + i * 24, 30 + j * 24);
        g.lineTo(40 + i * 24, 38 + j * 24);
        g.lineTo(32 + i * 24, 46 + j * 24);
        g.lineTo(24 + i * 24, 38 + j * 24);
        g.fill();
      }
    }
    g.fillStyle = "#1f2f55";
    g.beginPath();
    g.moveTo(128, 54);
    g.lineTo(178, 96);
    g.lineTo(128, 138);
    g.lineTo(78, 96);
    g.closePath();
    g.fill();
    g.fillStyle = "#e0b45a";
    g.beginPath();
    g.arc(128, 96, 16, 0, Math.PI * 2);
    g.fill();
  });
  t.hasAlpha = false;
  const m = lit(ctx, { rough: 1 });
  m.albedoTexture = t;
  return m;
}

/**
 * Desk + computer (typing code on screen) + office chair, in the desk's own frame: desk centred on
 * (x, z) with the screen towards local -z, the chair at local +z. Returns colliders (axis-aligned
 * for yaw = 0 or π).
 */
export function buildDesk(ctx: Ctx, parent: import("@babylonjs/core").Node, x: number, y: number, z: number, yaw: number) {
  const root = group(ctx, { parent, pos: [x, y, z], rot: [0, yaw, 0] });
  const wood = lit(ctx, { color: "#6b4a30", rough: 0.55 });
  const darkWood = lit(ctx, { color: "#3f2b1c", rough: 0.6 });
  const metal = lit(ctx, { color: "#20242b", rough: 0.4, metal: 0.6 });
  const plastic = lit(ctx, { color: "#15171b", rough: 0.55, metal: 0.1 });
  const fabric = lit(ctx, { color: "#20242c", rough: 0.9 });
  const screenTex = typingScreen(ctx);
  // a normal-height desk (0.76 m)
  const top = 0.76;
  box(ctx, 1.8, 0.05, 0.8, { parent: root, pos: [0, top, 0], cast: true, receive: true, mat: wood });
  for (const sx of [-0.86, 0.86]) box(ctx, 0.05, top, 0.75, { parent: root, pos: [sx, top / 2, 0], cast: true, mat: wood });
  box(ctx, 0.45, top - 0.05, 0.7, { parent: root, pos: [0.6, (top - 0.05) / 2, 0], mat: darkWood }); // drawers
  for (const dy of [0.15, 0.38, 0.6]) box(ctx, 0.12, 0.02, 0.02, { parent: root, pos: [0.6, dy, 0.36], mat: metal });
  box(ctx, 0.95, 0.56, 0.05, { parent: root, pos: [0, top + 0.46, -0.22], cast: true, mat: metal });
  plane(ctx, 0.89, 0.5, { parent: root, pos: [0, top + 0.46, -0.193], mat: unlit(ctx, { map: screenTex, opaque: true, fog: false, double: true }) });
  box(ctx, 0.06, 0.18, 0.06, { parent: root, pos: [0, top + 0.1, -0.22], mat: metal });
  box(ctx, 0.3, 0.02, 0.2, { parent: root, pos: [0, top + 0.02, -0.2], mat: metal });
  box(ctx, 0.45, 0.02, 0.15, { parent: root, pos: [-0.05, top + 0.03, 0.1], mat: plastic }); // keyboard
  box(ctx, 0.06, 0.02, 0.1, { parent: root, pos: [0.35, top + 0.03, 0.12], mat: plastic }); // mouse
  instantiate(ctx, "mug.glb", root, { pos: [0.7, top + 0.034, 0.05], scale: 0.012 }).catch(() => {});
  instantiate(ctx, "desk-lamp.glb", root, { pos: [-0.72, top, -0.15], rot: [0, 0.6, 0], scale: 0.8, background: true }).catch(() => {});
  instantiate(ctx, "books.glb", root, { pos: [-0.55, top, 0.2], rot: [0, 0.2, 0], scale: 0.9, background: true }).catch(() => {});
  // office chair
  const c = group(ctx, { parent: root, pos: [0, 0, 0.85], rot: [0, Math.PI + 0.2, 0] });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const leg = box(ctx, 0.34, 0.03, 0.055, { parent: c, pos: [Math.cos(a) * 0.17, 0.075, Math.sin(a) * 0.17], mat: plastic });
    setEuler(leg, 0, -a, 0);
    cylinder(ctx, 0.03, 0.03, 0.03, 10, { parent: c, pos: [Math.cos(a) * 0.33, 0.035, Math.sin(a) * 0.33], mat: plastic });
  }
  cylinder(ctx, 0.032, 0.032, 0.32, 10, { parent: c, pos: [0, 0.25, 0], mat: metal });
  box(ctx, 0.5, 0.08, 0.48, { parent: c, pos: [0, 0.44, 0], cast: true, mat: fabric });
  const back = group(ctx, { parent: c, pos: [0, 0.8, -0.24], rot: [-0.12, 0, 0] });
  box(ctx, 0.46, 0.52, 0.07, { parent: back, cast: true, mat: fabric });
  box(ctx, 0.05, 0.3, 0.05, { parent: c, pos: [0, 0.56, -0.2], mat: plastic });
  for (const sx of [-1, 1]) {
    box(ctx, 0.04, 0.2, 0.04, { parent: c, pos: [sx * 0.26, 0.56, -0.02], mat: plastic });
    box(ctx, 0.07, 0.035, 0.3, { parent: c, pos: [sx * 0.26, 0.67, 0.04], mat: plastic });
  }
  const s = Math.cos(yaw) >= 0 ? 1 : -1;
  return [
    { x, z, hx: 0.95, hz: 0.45 },
    { x, z: z + s * 0.85, hx: 0.35, hz: 0.35 },
  ];
}

export function buildRoom(ctx: Ctx, parent: import("@babylonjs/core").Node) {
  const root = group(ctx, { parent });
  const colliders: Collider[] = [];
  const anchors: Anchor[] = [];
  // the living room: warm striped wallpaper, a dark-wood dado rail and a beamed ceiling
  const wall = wallpaper(ctx, "stripes", 7, 1);
  void WALL;
  const wood = lit(ctx, { color: "#6b4a30", rough: 0.55 });
  const darkWood = lit(ctx, { color: "#3f2b1c", rough: 0.6 });
  const metal = lit(ctx, { color: "#20242b", rough: 0.4, metal: 0.6 });

  // floor / ceiling
  box(ctx, ROOM_HX * 2, 0.1, ROOM_HZ * 2, { parent: root, pos: [0, -0.05, 0], receive: true, mat: lit(ctx, { color: "#9a7451", rough: 0.5 }) });
  box(ctx, ROOM_HX * 2, 0.1, ROOM_HZ * 2, { parent: root, pos: [0, ROOM_H + 0.05, 0], mat: lit(ctx, { color: "#ecebe6", rough: 0.95 }) });
  // floor planks
  for (let i = -6; i <= 6; i++) box(ctx, 0.02, 0.005, ROOM_HZ * 2, { parent: root, pos: [i * 1.1, 0.003, 0], mat: lit(ctx, { color: "#5b3f28", rough: 0.6 }) });

  // walls (back wall has a window opening x∈[-0.7,2.7], y∈[0.95,2.6])
  const wz = -ROOM_HZ;
  box(ctx, 6.3 + 0.0, ROOM_H, T, { parent: root, pos: [-3.85, ROOM_H / 2, wz], receive: true, mat: wall });
  box(ctx, 4.3, ROOM_H, T, { parent: root, pos: [4.85, ROOM_H / 2, wz], receive: true, mat: wall });
  box(ctx, 3.4, 0.95, T, { parent: root, pos: [1, 0.475, wz], receive: true, mat: wall });
  box(ctx, 3.4, ROOM_H - 2.6, T, { parent: root, pos: [1, 2.6 + (ROOM_H - 2.6) / 2, wz], mat: wall });
  box(ctx, T, ROOM_H, ROOM_HZ * 2, { parent: root, pos: [-ROOM_HX, ROOM_H / 2, 0], receive: true, mat: wall });
  box(ctx, T, ROOM_H, ROOM_HZ * 2, { parent: root, pos: [ROOM_HX, ROOM_H / 2, 0], receive: true, mat: wall });
  // front wall with a doorway (x 2.3..3.7, h 2.4) leading to the corridor
  box(ctx, 9.3, ROOM_H, T, { parent: root, pos: [-2.35, ROOM_H / 2, ROOM_HZ], receive: true, mat: wall });
  box(ctx, 3.3, ROOM_H, T, { parent: root, pos: [5.35, ROOM_H / 2, ROOM_HZ], receive: true, mat: wall });
  box(ctx, 1.4, ROOM_H - 2.4, T, { parent: root, pos: [3.0, 2.4 + (ROOM_H - 2.4) / 2, ROOM_HZ], mat: wall });
  // dado rail and ceiling beams
  for (const [w_, d_, x_, z_] of [[ROOM_HX * 2, 0.05, 0, -ROOM_HZ + 0.13], [0.05, ROOM_HZ * 2, -ROOM_HX + 0.13, 0], [0.05, ROOM_HZ * 2, ROOM_HX - 0.13, 0]] as [number, number, number, number][])
    box(ctx, w_, 0.07, d_, { parent: root, pos: [x_, 1.0, z_], mat: darkWood });
  for (let x = -5.25; x <= 5.25; x += 3.5) box(ctx, 0.24, 0.22, ROOM_HZ * 2, { parent: root, pos: [x, ROOM_H - 0.11, 0], mat: darkWood });
  // skirting
  box(ctx, ROOM_HX * 2, 0.12, 0.05, { parent: root, pos: [0, 0.06, ROOM_HZ - 0.12], mat: darkWood });
  box(ctx, 0.05, 0.12, ROOM_HZ * 2, { parent: root, pos: [-ROOM_HX + 0.12, 0.06, 0], mat: darkWood });
  box(ctx, 0.05, 0.12, ROOM_HZ * 2, { parent: root, pos: [ROOM_HX - 0.12, 0.06, 0], mat: darkWood });

  // window frame (the house's back wall has a matching opening: the view is the real garden)
  const frame = lit(ctx, { color: "#efefef", rough: 0.5 });
  box(ctx, 3.5, 0.08, 0.3, { parent: root, pos: [1, 0.95, wz + 0.02], mat: frame });
  box(ctx, 0.08, 1.75, 0.16, { parent: root, pos: [1, 1.78, wz], mat: frame });
  box(ctx, 3.4, 0.06, 0.16, { parent: root, pos: [1, 1.78, wz], mat: frame });

  // ---- a reading corner where the old desk stood (the computer is in the bedroom now)
  instantiate(ctx, "armchair.glb", root, { pos: [-2.2, 0, -3.6], rot: [0, 0.35, 0], cast: true, background: true }).catch(() => {});
  instantiate(ctx, "potted-plant-2.glb", root, { pos: [-0.9, 0, -4.3], scale: 1.2, background: true }).catch(() => {});
  instantiate(ctx, "floor-vase.glb", root, { pos: [-3.6, 0, -4.5], scale: 1.3, background: true }).catch(() => {});
  colliders.push({ x: -2.2, z: -3.6, hx: 0.5, hz: 0.5 }, { x: -0.9, z: -4.3, hx: 0.45, hz: 0.45 }, { x: -3.6, z: -4.5, hx: 0.25, hz: 0.25 });

  // ---- a glass-fronted cupboard (javon) with the good china, against the back wall
  const cx_ = 4.8;
  const china = [lit(ctx, { color: "#f4f1ea", rough: 0.3 }), lit(ctx, { color: "#2f5d8a", rough: 0.3 })];
  // open-fronted carcass: back, sides, top and a closed base
  box(ctx, 2.4, 2.3, 0.05, { parent: root, pos: [cx_, 1.15, -ROOM_HZ + 0.15], cast: true, mat: darkWood });
  for (const sx_ of [-1.18, 1.18]) box(ctx, 0.05, 2.3, 0.55, { parent: root, pos: [cx_ + sx_, 1.15, -ROOM_HZ + 0.4], cast: true, mat: darkWood });
  box(ctx, 2.4, 0.08, 0.6, { parent: root, pos: [cx_, 2.3, -ROOM_HZ + 0.4], mat: darkWood });
  box(ctx, 2.36, 0.85, 0.55, { parent: root, pos: [cx_, 0.43, -ROOM_HZ + 0.4], cast: true, mat: darkWood });
  for (let s_ = 0; s_ < 3; s_++) {
    box(ctx, 2.2, 0.04, 0.45, { parent: root, pos: [cx_, 1.1 + s_ * 0.42, -ROOM_HZ + 0.45], mat: wood });
    for (let i = 0; i < 6; i++) {
      const plate = cylinder(ctx, 0.13, 0.13, 0.02, 16, { parent: root, pos: [cx_ - 0.9 + i * 0.36, 1.27 + s_ * 0.42, -ROOM_HZ + 0.35], rot: [Math.PI / 2 - 0.25, 0, 0], mat: china[i % 2] });
      plate.isPickable = false;
    }
  }
  box(ctx, 2.3, 1.3, 0.02, { parent: root, pos: [cx_, 1.55, -ROOM_HZ + 0.69], mat: lit(ctx, { color: "#cfe4ee", rough: 0.05, opacity: 0.25 }) });
  colliders.push({ x: cx_, z: -ROOM_HZ + 0.4, hx: 1.25, hz: 0.35 });

  // (the TV is opposite the sofa now — see TvCorner.ts)
  instantiate(ctx, "potted-plant.glb", root, { pos: [-5.6, 0, -ROOM_HZ + 0.6], scale: 1.1, background: true }).catch(() => {});
  colliders.push({ x: -5.6, z: -ROOM_HZ + 0.6, hx: 0.4, hz: 0.4 });
  // real lounge armchair as decoration in the corner
  instantiate(ctx, "chair.glb", root, { pos: [5.6, 0, 1.4], rot: [0, -Math.PI / 2 - 0.3, 0], scale: 1.45, cast: true }).catch((e) => console.error("chair", e));
  colliders.push({ x: 5.6, z: 1.4, hx: 0.5, hz: 0.5 });

  // ---- bookshelf on left wall (Ko'nikmalar)
  const bx = -ROOM_HX + 0.45;
  box(ctx, 0.05, 2.6, 3.0, { parent: root, pos: [bx - 0.22, 1.3, -0.4], cast: true, mat: darkWood });
  box(ctx, 0.5, 2.6, 0.05, { parent: root, pos: [bx, 1.3, -1.9], cast: true, mat: darkWood });
  box(ctx, 0.5, 2.6, 0.05, { parent: root, pos: [bx, 1.3, 1.1], cast: true, mat: darkWood });
  box(ctx, 0.5, 0.05, 3.0, { parent: root, pos: [bx, 2.62, -0.4], mat: darkWood });
  for (let s = 0; s < 4; s++) {
    box(ctx, 0.44, 0.04, 2.9, { parent: root, pos: [bx, 0.4 + s * 0.6, -0.4], mat: wood });
    let z = -1.75;
    for (let i = 0; i < 16 && z < 1.0; i++) {
      const w = 0.08 + hash(i + s * 20, 4) * 0.1;
      const h = 0.34 + hash(i + s * 20, 5) * 0.16;
      const cols = ["#b03a48", "#3b6ea5", "#d9a441", "#4f8a5b", "#7a5aa6", "#e8e2d0"];
      box(ctx, 0.28, h, w, { parent: root, pos: [bx + 0.03, 0.42 + s * 0.6 + h / 2, z + w / 2], mat: lit(ctx, { color: cols[Math.floor(hash(i * 3 + s, 6) * cols.length)], rough: 0.8 }) });
      z += w + 0.02;
    }
  }
  colliders.push({ x: bx, z: -0.4, hx: 0.3, hz: 1.55 });

  // ---- a suzani (embroidered wall hanging) on the right wall
  box(ctx, 0.04, 0.05, 2.9, { parent: root, pos: [ROOM_HX - 0.12, 2.65, -1.2], mat: darkWood });
  plane(ctx, 2.7, 1.7, { parent: root, pos: [ROOM_HX - 0.14, 1.75, -1.2], rot: [0, -Math.PI / 2, 0], mat: unlit(ctx, { map: suzani(ctx), opaque: true, double: true }) });

  // ---- side table + phone (Bog'lanish)
  const sx = ROOM_HX - 0.7, sz = 3.4;
  cylinder(ctx, 0.45, 0.45, 0.06, 24, { parent: root, pos: [sx, 0.95, sz], mat: wood });
  cylinder(ctx, 0.06, 0.06, 0.92, 10, { parent: root, pos: [sx, 0.46, sz], mat: metal });
  cylinder(ctx, 0.3, 0.3, 0.04, 18, { parent: root, pos: [sx, 0.02, sz], mat: metal });
  box(ctx, 0.16, 0.02, 0.32, { parent: root, pos: [sx, 1.0, sz], rot: [0, 0.4, 0], mat: lit(ctx, { color: "#111", rough: 0.3, metal: 0.5 }) });
  colliders.push({ x: sx, z: sz, hx: 0.5, hz: 0.5 });

  // ---- the sitting area: the TV against the west wall (TvCorner.ts), the sofa facing it across
  // a coffee table and a rug
  const sofaX = -2.9, tvZ = 2.6;
  instantiate(ctx, "sofa-modern.glb", root, { pos: [sofaX, 0, tvZ], rot: [0, -Math.PI / 2, 0], scale: 1, cast: true }).catch((e) => console.error("sofa", e));
  instantiate(ctx, "pillows.glb", root, { pos: [sofaX + 0.05, 0.45, tvZ], rot: [0, -Math.PI / 2, 0], scale: 1, background: true }).catch(() => {});
  colliders.push({ x: sofaX + 0.03, z: tvZ, hx: 0.36, hz: 0.82 });
  instantiate(ctx, "coffee-table.glb", root, { pos: [-4.7, 0, tvZ], scale: 1.0, cast: true }).catch((e) => console.error("table", e));
  colliders.push({ x: -4.7, z: tvZ, hx: 0.5, hz: 0.5 });
  box(ctx, 4.4, 0.02, 3.0, { parent: root, pos: [-4.0, 0.011, tvZ], mat: gilam(ctx) });

  // ---- plants (real models) + vase
  for (const [px, pz] of [[6.2, -4.1], [-6.2, 4.4], [5.8, 4.3]] as [number, number][]) {
    instantiate(ctx, "plant.glb", root, { pos: [px, 0, pz], scale: 0.9, cast: true, background: true }).catch((e) => console.error("plant", e));
    colliders.push({ x: px, z: pz, hx: 0.32, hz: 0.32 });
  }
  instantiate(ctx, "vase.glb", root, { pos: [-4.7, 0.49, 2.6], scale: 1.4 }).catch((e) => console.error("vase", e));

  // ---- lights (pendant lamp models)
  for (const [lx, lz] of [[-3.5, 0], [3.5, 0], [-2.6, -3], [3.5, 3]]) addPendant(ctx, root, lx, lz, ROOM_H, "#ffe6c0", 9, 12);
  staticLight(ctx, root, [-2.2, 1.6, -3.2], "#ffcf8a", 2.5, 5);

  return { anchors, colliders, root };
}
