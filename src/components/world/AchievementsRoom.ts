import type { Node } from "@babylonjs/core";
import { instantiateFit } from "./assets";
import type { ExhibitInfo } from "./exhibitSignal";
import { addPendant } from "./Lamps";
import { ROOM_H } from "./Room";
import { box, canvasTexture, cylinder, group, lit, plane, sphere, unlit, type Ctx, type Region } from "./core";

export const ACH_X0 = -10;
export const ACH_X1 = 1.3;
export const ACH_Z0 = 26.2;
export const ACH_Z1 = 35.8;
export const ACH_REGION: Region = { x0: ACH_X0, x1: ACH_X1, z0: ACH_Z0, z1: ACH_Z1 };
const T = 0.2;

interface Ach {
  title: string;
  big: string;
  sub: string;
  color: string;
  icon: string;
  info: ExhibitInfo;
}

const ACHS: Ach[] = [
  {
    title: "LeetCode",
    big: "50+",
    sub: "masala yechilgan",
    color: "#a06a10",
    icon: "🧩",
    info: { title: "LeetCode", subtitle: "Yutuq · Algoritmlar", lines: ["LeetCode platformasida 50 dan ortiq masala yechganman.", "Algoritmik fikrlash va ma'lumotlar tuzilmalari bo'yicha muntazam mashq."], tags: ["Algorithms", "Problem solving"] },
  },
  {
    title: "Codewars",
    big: "200+",
    sub: "challenge bajarilgan",
    color: "#8a1f2a",
    icon: "⚔️",
    info: { title: "Codewars", subtitle: "Yutuq · Kata mashqlari", lines: ["Codewars'da 200 dan ortiq challenge (kata) yechilgan.", "Codewars Problems & Abdujalilov Ismoil — Founder & Content Creator."], tags: ["Katas", "JavaScript"] },
  },
  {
    title: "ITech YouTube",
    big: "20+",
    sub: "React.js video darslik",
    color: "#a01818",
    icon: "🎬",
    info: { title: "ITech YouTube kanali", subtitle: "Yutuq · Kontent yaratish", lines: ["ITech YouTube kanali uchun React.js bo'yicha 20 dan ortiq video darslik tayyorlaganman.", "Bilimni boshqalar bilan ulashish — o'zim uchun ham eng yaxshi o'rganish usuli."], tags: ["React.js", "Video", "Content"] },
  },
  {
    title: "Frontend Instructor",
    big: "3 ta",
    sub: "UnitDev · Najot Ta'lim · Alfraganus University",
    color: "#1f5a8a",
    icon: "🎓",
    info: { title: "Frontend Instructor", subtitle: "Yutuq · O'qituvchilik", lines: ["UnitDev, Najot Ta'lim va Alfraganus University'da frontend bo'yicha o'qituvchi (instructor) sifatida dars berganman.", "Talabalarga real loyihalar orqali frontend yo'nalishini o'rgatish."], tags: ["Teaching", "Mentoring", "Frontend"] },
  },
];

function plaque(ctx: Ctx, a: Ach) {
  const W = 800;
  const H = 520;
  return canvasTexture(ctx, W, H, (g) => {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0d1220");
    bg.addColorStop(1, a.color);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(230,197,104,0.85)";
    g.lineWidth = 5;
    g.strokeRect(18, 18, W - 36, H - 36);
    g.textAlign = "center";
    g.fillStyle = "#f0d078";
    g.font = "bold 58px Georgia, serif";
    g.fillText(a.title, W / 2, 100);
    g.font = "bold 170px Georgia, serif";
    g.fillStyle = "#ffffff";
    g.shadowColor = "rgba(0,0,0,0.5)";
    g.shadowBlur = 12;
    g.fillText(a.big, W / 2, 285);
    g.shadowBlur = 0;
    g.fillStyle = "#e9eefc";
    let size = 34;
    g.font = `600 ${size}px sans-serif`;
    while (g.measureText(a.sub).width > W - 90 && size > 18) {
      size -= 2;
      g.font = `600 ${size}px sans-serif`;
    }
    g.fillText(a.sub, W / 2, 350);
    g.font = "90px sans-serif";
    g.fillText(a.icon, W / 2, 470);
  });
}

export function buildAchievementsRoom(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const colliders: { x: number; z: number; hx: number; hz: number }[] = [];
  const add = (e: { pos: [number, number]; radius: number; info: ExhibitInfo }) => ctx.exhibits.push({ ...e, region: ACH_REGION });
  const midX = (ACH_X0 + ACH_X1) / 2;
  const midZ = (ACH_Z0 + ACH_Z1) / 2;
  const W = ACH_X1 - ACH_X0;
  const D = ACH_Z1 - ACH_Z0;
  const wall = lit(ctx, { color: "#2a3448", rough: 0.9 });
  const gold = lit(ctx, { color: "#d4af37", rough: 0.22, metal: 0.95 });
  const marble = lit(ctx, { color: "#eeece6", rough: 0.3 });
  const dark = lit(ctx, { color: "#141821", rough: 0.4, metal: 0.3 });

  box(ctx, W, 0.1, D, { parent: root, pos: [midX, -0.05, midZ], receive: true, mat: lit(ctx, { color: "#2c2f3a", rough: 0.25, metal: 0.15 }) });
  box(ctx, W - 1.6, 0.012, D - 1.6, { parent: root, pos: [midX, 0.006, midZ], mat: lit(ctx, { color: "#8a1f2a", rough: 1 }) });
  box(ctx, W, 0.1, D, { parent: root, pos: [midX, ROOM_H + 0.05, midZ], mat: lit(ctx, { color: "#1a1f2e", rough: 0.9 }) });
  box(ctx, T, ROOM_H, D, { parent: root, pos: [ACH_X0 - T / 2, ROOM_H / 2, midZ], receive: true, mat: wall });
  box(ctx, W, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, ACH_Z0 - T / 2], receive: true, mat: wall });
  box(ctx, W, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, ACH_Z1 + T / 2], receive: true, mat: wall });
  box(ctx, 0.05, 0.16, D, { parent: root, pos: [ACH_X0 + 0.03, 0.08, midZ], mat: dark });
  box(ctx, W, 0.16, 0.05, { parent: root, pos: [midX, 0.08, ACH_Z0 + 0.03], mat: dark });
  box(ctx, W, 0.16, 0.05, { parent: root, pos: [midX, 0.08, ACH_Z1 - 0.03], mat: dark });
  // gold trim line
  for (const z of [ACH_Z0 + 0.04, ACH_Z1 - 0.04]) box(ctx, W, 0.04, 0.03, { parent: root, pos: [midX, 2.85, z], mat: gold });
  box(ctx, 0.03, 0.04, D, { parent: root, pos: [ACH_X0 + 0.04, 2.85, midZ], mat: gold });

  const sign = canvasTexture(ctx, 640, 128, (g) => {
    g.fillStyle = "#1b1410";
    g.fillRect(0, 0, 640, 128);
    g.fillStyle = "#e6c568";
    g.font = "bold 54px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("Y U T U Q L A R", 320, 66);
  });
  const sg = group(ctx, { parent: root, pos: [ACH_X1 - 0.02, 2.75, 29], rot: [0, -Math.PI / 2, 0] });
  box(ctx, 2.0, 0.4, 0.05, { parent: sg, mat: gold });
  plane(ctx, 1.9, 0.35, { parent: sg, pos: [0, 0, 0.03], mat: unlit(ctx, { map: sign, opaque: true, fog: false, double: true }) });

  // ---- 4 gold-framed plaques (west wall ×2, north ×1, south ×1), each with a real 3D model on a pedestal below/near
  const fw = 1.9;
  const fh = fw * (520 / 800);
  const B = 0.12;
  const frames: { pos: [number, number, number]; yaw: number; stand: [number, number] }[] = [
    { pos: [ACH_X0 + 0.1, 1.95, 28.4], yaw: Math.PI / 2, stand: [ACH_X0 + 1.9, 28.4] },
    { pos: [ACH_X0 + 0.1, 1.95, 33.6], yaw: Math.PI / 2, stand: [ACH_X0 + 1.9, 33.6] },
    { pos: [-4.7, 1.95, ACH_Z0 + 0.1], yaw: 0, stand: [-4.7, ACH_Z0 + 1.9] },
    { pos: [-4.7, 1.95, ACH_Z1 - 0.1], yaw: Math.PI, stand: [-4.7, ACH_Z1 - 1.9] },
  ];
  ACHS.forEach((a, i) => {
    const f = group(ctx, { parent: root, pos: frames[i].pos, rot: [0, frames[i].yaw, 0] });
    box(ctx, fw + B * 2, B, 0.11, { parent: f, pos: [0, (fh + B) / 2, 0], cast: true, mat: gold });
    box(ctx, fw + B * 2, B, 0.11, { parent: f, pos: [0, -(fh + B) / 2, 0], cast: true, mat: gold });
    box(ctx, B, fh, 0.11, { parent: f, pos: [(fw + B) / 2, 0, 0], cast: true, mat: gold });
    box(ctx, B, fh, 0.11, { parent: f, pos: [-(fw + B) / 2, 0, 0], cast: true, mat: gold });
    box(ctx, fw + 0.04, fh + 0.04, 0.03, { parent: f, pos: [0, 0, -0.03], mat: dark });
    plane(ctx, fw, fh, { parent: f, pos: [0, 0, 0.001], mat: unlit(ctx, { map: plaque(ctx, a), opaque: true, fog: false, double: true }) });
    box(ctx, 0.5, 0.04, 0.15, { parent: f, pos: [0, (fh + B) / 2 + 0.15, 0.1], mat: dark });
    box(ctx, 0.44, 0.02, 0.06, { parent: f, pos: [0, (fh + B) / 2 + 0.125, 0.14], mat: lit(ctx, { color: "#fff6dc", emissive: "#fff0c0", ei: 2.4 }) });
    add({ pos: frames[i].stand, radius: 1.6, info: a.info });
  });

  // ---- trophies (gold cups on marble steps) — built from primitives
  const trophy = (x: number, z: number, s = 1) => {
    const t = group(ctx, { parent: root, pos: [x, 0, z], scale: s });
    cylinder(ctx, 0.5, 0.56, 0.9, 24, { parent: t, pos: [0, 0.45, 0], cast: true, mat: marble });
    cylinder(ctx, 0.62, 0.62, 0.06, 24, { parent: t, pos: [0, 0.93, 0], mat: marble });
    cylinder(ctx, 0.28, 0.16, 0.04, 20, { parent: t, pos: [0, 0.98, 0], mat: gold });
    cylinder(ctx, 0.05, 0.05, 0.3, 12, { parent: t, pos: [0, 1.14, 0], mat: gold });
    cylinder(ctx, 0.3, 0.1, 0.36, 24, { parent: t, pos: [0, 1.46, 0], cast: true, mat: gold });
    sphere(ctx, 0.05, 10, { parent: t, pos: [0, 1.7, 0], mat: gold });
    for (const sx of [-1, 1]) {
      const h = box(ctx, 0.04, 0.24, 0.04, { parent: t, pos: [sx * 0.36, 1.5, 0], mat: gold });
      h.rotation.z = -sx * 0.5;
    }
    colliders.push({ x, z, hx: 0.55 * s, hz: 0.55 * s });
  };
  trophy(-2.2, 28.8, 1.0);
  trophy(-2.2, 33.2, 1.0);
  trophy(-7.2, 31.0, 1.25);

  // ---- real 3D models on pedestals
  const lazy: (() => void)[] = [];
  const piece = (file: string, x: number, z: number, ph: number, size: number, yaw: number, info: ExhibitInfo) => {
    box(ctx, 0.8, ph, 0.8, { parent: root, pos: [x, ph / 2, z], cast: true, mat: marble });
    box(ctx, 0.92, 0.07, 0.92, { parent: root, pos: [x, ph + 0.035, z], mat: marble });
    colliders.push({ x, z, hx: 0.5, hz: 0.5 });
    add({ pos: [x + 1.5, z], radius: 1.6, info });
    lazy.push(() => {
      instantiateFit(ctx, file, root, { pos: [x, ph + 0.07, z], size, yaw }).catch((e) => console.error(file, e));
    });
  };
  piece("gears.glb", -6.4, 28.4, 0.9, 0.7, 0.5, { title: "Shesternyalar", subtitle: "Ramz · Algoritmlar", lines: ["Har bir masala — bir mexanizm: kichik qismlar to'g'ri ulanganda ishlaydi.", "LeetCode va Codewars mashqlari shu fikrlashni charxlaydi."] });
  piece("robot.glb", -6.4, 33.6, 0.9, 1.0, 0.4, { title: "Robot", subtitle: "Ramz · Kod jangchisi", lines: ["Codewars'da kata'larni yechish — kodlash mahoratini ulg'aytiruvchi mashq.", "200+ challenge bajarilgan."] });
  piece("steampunk.glb", -3.4, 26.9, 0.9, 0.7, 0.2, { title: "Kamera", subtitle: "Ramz · Video darsliklar", lines: ["ITech YouTube kanali uchun React.js bo'yicha 20+ video darslik yozib olingan."] });
  piece("leeperry.glb", -3.4, 35.1, 0.9, 0.62, 3.0, { title: "O'qituvchi byusti", subtitle: "Ramz · Ustoz-shogird", lines: ["UnitDev, Najot Ta'lim va Alfraganus University'da frontend o'qituvchisi (instructor) bo'lish tajribasi."] });

  for (const [lx, lz] of [[-7.2, 28.6], [-7.2, 33.4], [-3.6, 31], [-0.6, 31]]) addPendant(ctx, root, lx, lz, ROOM_H, "#ffe2b0", 15, 11);

  lazy.forEach((f) => ctx.defer(f));

  return { colliders };
}
