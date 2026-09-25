import { addPendant } from "./Lamps";
import { instantiate } from "./assets";
import { box, canvasTexture, cylinder, group, hash, lit, plane, staticLight, setEuler, unlit, type Anchor, type Ctx,  } from "./core";

export const ROOM_HX = 7; // half width (x)
export const ROOM_HZ = 5; // half depth (z)
export const ROOM_H = 3.4;

export const DOOR_X = 3.0;
/** Chair positions at the three office computers (x, z). */
export const WORK_SPOTS: [number, number][] = [[-2.6, -3.05], [4.8, -3.05], [-5.6, -3.05]];
export const DOOR_W = 1.4;

export interface Collider {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

const WALL = "#d9d4c7";
const T = 0.2;

function skyTexture(ctx: Ctx) {
  return canvasTexture(ctx, 512, 256, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, "#1b2a55");
    grd.addColorStop(0.6, "#e0805a");
    grd.addColorStop(1, "#f4c27a");
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 26; i++) {
      const w = 22 + hash(i, 1) * 34;
      const h = 50 + hash(i, 2) * 110;
      const x = (i / 26) * 512;
      g.fillStyle = "#151a2b";
      g.fillRect(x, 256 - h, w, h);
      g.fillStyle = "#ffd98a";
      for (let y = 256 - h + 6; y < 250; y += 9)
        for (let xx = x + 3; xx < x + w - 4; xx += 8) if (hash(xx * 7 + y, 3) > 0.55) g.fillRect(xx, y, 3, 4);
    }
  });
}

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
    if (ctx.player.z > 3 || ctx.player.x < -8) return; // only animate while the office is in view
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

function board(ctx: Ctx) {
  return canvasTexture(ctx, 512, 300, (g) => {
    g.fillStyle = "#f5f6f4";
    g.fillRect(0, 0, 512, 300);
    g.strokeStyle = "#3d5a9a";
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(30, 40 + i * 42);
      for (let x = 30; x < 470; x += 20) g.lineTo(x, 40 + i * 42 + (hash(x + i, 9) - 0.5) * 12);
      g.stroke();
    }
  });
}

export function buildRoom(ctx: Ctx, parent: import("@babylonjs/core").Node) {
  const root = group(ctx, { parent });
  const colliders: Collider[] = [];
  const anchors: Anchor[] = [];
  const wall = lit(ctx, { color: WALL, rough: 0.9 });
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
  // skirting
  box(ctx, ROOM_HX * 2, 0.12, 0.05, { parent: root, pos: [0, 0.06, ROOM_HZ - 0.12], mat: darkWood });
  box(ctx, 0.05, 0.12, ROOM_HZ * 2, { parent: root, pos: [-ROOM_HX + 0.12, 0.06, 0], mat: darkWood });
  box(ctx, 0.05, 0.12, ROOM_HZ * 2, { parent: root, pos: [ROOM_HX - 0.12, 0.06, 0], mat: darkWood });

  // window: dusk city behind glass
  plane(ctx, 26, 13, { parent: root, pos: [1, 4.5, wz - 6], mat: unlit(ctx, { map: skyTexture(ctx), opaque: true, fog: false, double: true }) });
  const frame = lit(ctx, { color: "#efefef", rough: 0.5 });
  box(ctx, 3.5, 0.08, 0.3, { parent: root, pos: [1, 0.95, wz + 0.02], mat: frame });
  box(ctx, 0.08, 1.75, 0.16, { parent: root, pos: [1, 1.78, wz], mat: frame });
  box(ctx, 3.4, 0.06, 0.16, { parent: root, pos: [1, 1.78, wz], mat: frame });

  // ---- workstations: desk + computer + office chair facing it
  const screenTex = typingScreen(ctx);
  const dz = -4.1;
  const plastic = lit(ctx, { color: "#15171b", rough: 0.55, metal: 0.1 });
  const fabric = lit(ctx, { color: "#20242c", rough: 0.9 });
  const officeChair = (x: number, z: number, yaw: number) => {
    const c = group(ctx, { parent: root, pos: [x, 0, z], rot: [0, yaw, 0] });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const leg = box(ctx, 0.34, 0.03, 0.055, { parent: c, pos: [Math.cos(a) * 0.17, 0.075, Math.sin(a) * 0.17], mat: plastic });
      setEuler(leg, 0, -a, 0);
      cylinder(ctx, 0.03, 0.03, 0.03, 10, { parent: c, pos: [Math.cos(a) * 0.33, 0.035, Math.sin(a) * 0.33], mat: plastic });
    }
    cylinder(ctx, 0.032, 0.032, 0.38, 10, { parent: c, pos: [0, 0.28, 0], mat: metal });
    box(ctx, 0.5, 0.08, 0.48, { parent: c, pos: [0, 0.5, 0], cast: true, mat: fabric });
    box(ctx, 0.46, 0.05, 0.44, { parent: c, pos: [0, 0.555, -0.01], mat: fabric });
    const back = group(ctx, { parent: c, pos: [0, 0.86, -0.24], rot: [-0.12, 0, 0] });
    box(ctx, 0.46, 0.52, 0.07, { parent: back, cast: true, mat: fabric });
    box(ctx, 0.3, 0.14, 0.06, { parent: back, pos: [0, 0.32, 0], mat: fabric });
    box(ctx, 0.05, 0.3, 0.05, { parent: c, pos: [0, 0.62, -0.2], mat: plastic });
    for (const sx of [-1, 1]) {
      box(ctx, 0.04, 0.2, 0.04, { parent: c, pos: [sx * 0.26, 0.62, -0.02], mat: plastic });
      box(ctx, 0.07, 0.035, 0.3, { parent: c, pos: [sx * 0.26, 0.73, 0.04], mat: plastic });
    }
    return c;
  };
  const workstation = (dx: number, chairYaw: number, withMug: boolean) => {
    box(ctx, 2.4, 0.08, 1.1, { parent: root, pos: [dx, 1.0, dz], cast: true, receive: true, mat: wood });
    for (const sx of [-1.1, 1.1]) box(ctx, 0.08, 1.0, 1.0, { parent: root, pos: [dx + sx, 0.5, dz], cast: true, mat: metal });
    box(ctx, 2.2, 0.5, 0.05, { parent: root, pos: [dx, 0.7, dz - 0.45], mat: darkWood });
    box(ctx, 1.25, 0.72, 0.06, { parent: root, pos: [dx, 1.75, dz - 0.2], cast: true, mat: metal });
    plane(ctx, 1.17, 0.64, { parent: root, pos: [dx, 1.75, dz - 0.165], mat: unlit(ctx, { map: screenTex, opaque: true, fog: false, double: true }) });
    box(ctx, 0.08, 0.32, 0.08, { parent: root, pos: [dx, 1.22, dz - 0.2], mat: metal });
    box(ctx, 0.4, 0.03, 0.25, { parent: root, pos: [dx, 1.05, dz - 0.15], mat: metal });
    box(ctx, 0.75, 0.03, 0.26, { parent: root, pos: [dx - 0.05, 1.05, dz + 0.25], mat: metal });
    box(ctx, 0.07, 0.03, 0.11, { parent: root, pos: [dx + 0.55, 1.05, dz + 0.25], mat: metal });
    officeChair(dx, dz + 1.05, Math.PI + chairYaw);
    if (withMug) instantiate(ctx, "mug.glb", root, { pos: [dx + 0.95, 1.04 + 0.034, dz + 0.1], scale: 0.012 }).catch((e) => console.error("mug", e));
    colliders.push({ x: dx, z: dz, hx: 1.3, hz: 0.65 }, { x: dx, z: dz + 1.05, hx: 0.4, hz: 0.4 });
  };
  workstation(-2.6, 0.25, true);
  workstation(4.8, -0.35, false);
  workstation(-5.6, 0.1, false);
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

  // ---- whiteboard on right wall (Tajriba)
  box(ctx, 0.06, 1.6, 2.8, { parent: root, pos: [ROOM_HX - 0.13, 1.85, -1.2], mat: metal });
  plane(ctx, 2.7, 1.5, { parent: root, pos: [ROOM_HX - 0.165, 1.85, -1.2], rot: [0, -Math.PI / 2, 0], mat: unlit(ctx, { map: board(ctx), opaque: true, fog: false, double: true }) });

  // ---- side table + phone (Bog'lanish)
  const sx = ROOM_HX - 0.7, sz = 3.4;
  cylinder(ctx, 0.45, 0.45, 0.06, 24, { parent: root, pos: [sx, 0.95, sz], mat: wood });
  cylinder(ctx, 0.06, 0.06, 0.92, 10, { parent: root, pos: [sx, 0.46, sz], mat: metal });
  cylinder(ctx, 0.3, 0.3, 0.04, 18, { parent: root, pos: [sx, 0.02, sz], mat: metal });
  box(ctx, 0.16, 0.02, 0.32, { parent: root, pos: [sx, 1.0, sz], rot: [0, 0.4, 0], mat: lit(ctx, { color: "#111", rough: 0.3, metal: 0.5 }) });
  colliders.push({ x: sx, z: sz, hx: 0.5, hz: 0.5 });

  // ---- real sofa model + coffee table + rug
  instantiate(ctx, "sofa.glb", root, { pos: [-ROOM_HX + 1.2, 0, 3.0], rot: [0, Math.PI / 2, 0], scale: 1.4, cast: true }).catch((e) => console.error("sofa", e));
  colliders.push({ x: -ROOM_HX + 1.2, z: 3.0, hx: 0.75, hz: 1.7 });
  box(ctx, 1.2, 0.05, 0.8, { parent: root, pos: [-3.7, 0.5, 3.0], cast: true, mat: wood });
  for (const [ax, az] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) box(ctx, 0.05, 0.48, 0.05, { parent: root, pos: [-3.7 + ax, 0.24, 3.0 + az], mat: metal });
  colliders.push({ x: -3.7, z: 3.0, hx: 0.65, hz: 0.45 });
  box(ctx, 4.2, 0.02, 3.0, { parent: root, pos: [-2.4, 0.011, 2.2], mat: lit(ctx, { color: "#7a3b3b", rough: 1 }) });

  // ---- plants (real models) + vase
  for (const [px, pz] of [[6.2, -4.1], [-6.1, 4.2], [5.8, 4.3]] as [number, number][]) {
    instantiate(ctx, "plant.glb", root, { pos: [px, 0, pz], scale: 0.9, cast: true, background: true }).catch((e) => console.error("plant", e));
    colliders.push({ x: px, z: pz, hx: 0.32, hz: 0.32 });
  }
  instantiate(ctx, "vase.glb", root, { pos: [-3.7, 0.525, 3.0], scale: 1.6 }).catch((e) => console.error("vase", e));

  // ---- lights (pendant lamp models)
  for (const [lx, lz] of [[-3.5, 0], [3.5, 0], [-2.6, -3], [3.5, 3]]) addPendant(ctx, root, lx, lz, ROOM_H, "#ffe6c0", 9, 12);
  staticLight(ctx, root, [-1.7, 1.6, dz + 0.3], "#ffcf8a", 2.5, 5);

  return { anchors, colliders, root };
}
