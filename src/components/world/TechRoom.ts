import type { Node } from "@babylonjs/core";
import { instantiateFit } from "./assets";
import type { ExhibitInfo } from "./exhibitSignal";
import { addPendant } from "./Lamps";
import { ROOM_H } from "./Room";
import { box, canvasTexture, cylinder, group, lit, plane, setEuler, unlit, type Ctx, type Region } from "./core";

export const TECH_X0 = 4.7;
export const TECH_X1 = 15;
export const TECH_Z0 = 16.2;
export const TECH_Z1 = 25.8;
export const TECH_REGION: Region = { x0: TECH_X0, x1: TECH_X1, z0: TECH_Z0, z1: TECH_Z1 };
const T = 0.2;

type Draw = (g: CanvasRenderingContext2D, s: number) => void;
interface Tech {
  name: string;
  group: string;
  bg: string;
  fg: string;
  glyph?: string;
  draw?: Draw;
  lines: string[];
  tags?: string[];
}

const atom: Draw = (g, s) => {
  g.strokeStyle = "#61dafb";
  g.lineWidth = s * 0.05;
  g.translate(s / 2, s / 2);
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(0, 0, s * 0.36, s * 0.14, (i * Math.PI) / 3, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "#61dafb";
  g.beginPath();
  g.arc(0, 0, s * 0.06, 0, Math.PI * 2);
  g.fill();
};

const TECHS: Tech[] = [
  { name: "React", group: "Kutubxona", bg: "#20232a", fg: "#61dafb", draw: atom, lines: ["Komponentlarga asoslangan UI kutubxonasi (Meta).", "Men ishlaydigan asosiy texnologiyam: Rentix, RT Holdings, Foragedialog va boshqa loyihalarda ishlatganman."], tags: ["Hooks", "Components", "SPA"] },
  { name: "Next.js", group: "Freymvork", bg: "#000000", fg: "#ffffff", glyph: "N", lines: ["React uchun full-stack freymvork: SSR, SSG, marshrutlash, SEO.", "Shams Learning Center va RT Holdings saytlari shu asosda qurilgan."], tags: ["SSR", "SEO", "App Router"] },
  { name: "TypeScript", group: "Til", bg: "#3178c6", fg: "#ffffff", glyph: "TS", lines: ["JavaScript'ga statik tiplar qo'shuvchi til.", "Katta loyihalarda xatolarni oldindan topish va kodni tushunarli qilish uchun."], tags: ["Types", "Safety"] },
  { name: "JavaScript", group: "Til", bg: "#f7df1e", fg: "#111111", glyph: "JS", lines: ["Veb-dasturlashning asosiy tili.", "2021-yildan beri frontend bo'yicha kundalik ish quroli."], tags: ["ES6+", "DOM"] },
  { name: "Redux Toolkit", group: "State", bg: "#764abc", fg: "#ffffff", glyph: "RTK", lines: ["Redux'ning rasmiy, soddalashtirilgan to'plami.", "OKS Technologies'da global holat va persistent login uchun ishlatganman."], tags: ["Redux", "State"] },
  { name: "TanStack Query", group: "Ma'lumot olish", bg: "#ff4154", fg: "#ffffff", glyph: "TQ", lines: ["Server ma'lumotlarini keshlash, qayta urinish va sinxronlash kutubxonasi (React Query).", "Ortiqcha API so'rovlarini kamaytirish uchun har loyihada."], tags: ["Cache", "Retry"] },
  { name: "Formik", group: "Formalar", bg: "#2563a8", fg: "#ffffff", glyph: "Fk", lines: ["React'da formalar va validatsiyani boshqarish kutubxonasi.", "Ant Design bilan birga Rentix va OKS loyihalarida ishlatilgan."], tags: ["Forms", "Validation"] },
  { name: "Zustand", group: "State", bg: "#4a3b2a", fg: "#f4c26b", glyph: "Zu", lines: ["Yengil va sodda global holat kutubxonasi.", "Kichik va o'rta loyihalarda Redux'ga qulay muqobil."], tags: ["State", "Hooks"] },
  { name: "MUI", group: "UI kutubxona", bg: "#0b1a2b", fg: "#3f9cf3", glyph: "MUI", lines: ["Material Design asosidagi React komponentlari to'plami.", "Tez va izchil interfeys yaratish uchun."], tags: ["Material", "Components"] },
  { name: "Ant Design", group: "UI kutubxona", bg: "#ffffff", fg: "#1677ff", glyph: "Ant", lines: ["Korxona darajasidagi React UI kutubxonasi.", "Admin panellarda (Rentix, OKS) asosiy tanlovim."], tags: ["Admin", "Tables"] },
  { name: "Tailwind CSS", group: "Stil", bg: "#0f172a", fg: "#38bdf8", glyph: "TW", lines: ["Utility-first CSS freymvork: tez va izchil stillash.", "Tailwind UI komponentlari bilan ham ishlaganman."], tags: ["Utility", "Tailwind UI"] },
  { name: "Sass / SCSS", group: "Stil", bg: "#cc6699", fg: "#ffffff", glyph: "Sass", lines: ["CSS preprosessori: o'zgaruvchilar, ichma-ich qoidalar, mixin'lar.", "Katta stil kodini tartibli saqlash uchun."], tags: ["SCSS", "Mixins"] },
  { name: "Bootstrap", group: "Stil", bg: "#7952b3", fg: "#ffffff", glyph: "B", lines: ["Eng mashhur CSS freymvorklaridan biri.", "MDBootstrap va Materialize bilan ham tajribam bor."], tags: ["Grid", "MDB", "Materialize"] },
  { name: "Styled Components", group: "Stil", bg: "#1f1a24", fg: "#db7093", glyph: "SC", lines: ["CSS-in-JS: stillarni komponent ichida yozish.", "Ushbu 3D portfolio ham shu bilan stillangan."], tags: ["CSS-in-JS"] },
  { name: "React Native", group: "Mobil", bg: "#20232a", fg: "#61dafb", draw: atom, glyph: "", lines: ["React bilan iOS/Android ilovalari yaratish.", "Printer [Full Stack] — React Native CLI + Kotlin native modul, termal printer ilovasi."], tags: ["Android", "Kotlin"] },
  { name: "Firebase", group: "Backend xizmati", bg: "#1a1a1a", fg: "#ffca28", glyph: "FB", lines: ["Google'ning backend xizmatlari: autentifikatsiya, Firestore, hosting.", "Printer ilovasida auth va ma'lumotlar bazasi uchun."], tags: ["Auth", "Firestore"] },
  { name: "Git / GitHub", group: "Asbob", bg: "#f05032", fg: "#ffffff", glyph: "Git", lines: ["Versiyalarni boshqarish tizimi va jamoaviy ishlash platformasi.", "Har kungi ish jarayonining asosi: branch, PR, code review."], tags: ["Version control", "PR"] },
];

function logoTex(ctx: Ctx, t: Tech) {
  const S = 256;
  const tex = canvasTexture(ctx, S, S, (g) => {
    g.fillStyle = t.bg;
    g.fillRect(0, 0, S, S);
    g.save();
    if (t.draw) t.draw(g, S);
    g.restore();
    if (t.glyph) {
      g.fillStyle = t.fg;
      g.textAlign = "center";
      g.textBaseline = "middle";
      let size = 150;
      g.font = `800 ${size}px sans-serif`;
      while (g.measureText(t.glyph).width > S - 50 && size > 30) {
        size -= 6;
        g.font = `800 ${size}px sans-serif`;
      }
      g.fillText(t.glyph, S / 2, t.draw ? S - 36 : S / 2 + 6);
    }
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 6;
    g.strokeRect(3, 3, S - 6, S - 6);
  });
  tex.uScale = -1; // boxes are mirrored in the right-handed scene
  tex.uOffset = 1;
  return tex;
}

function nameTex(ctx: Ctx, t: Tech) {
  return canvasTexture(ctx, 512, 128, (g) => {
    g.fillStyle = "#c9a24a";
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = "rgba(60,40,5,0.7)";
    g.lineWidth = 5;
    g.strokeRect(6, 6, 500, 116);
    g.fillStyle = "#2c1d05";
    g.textAlign = "center";
    g.textBaseline = "middle";
    let size = 62;
    g.font = `700 ${size}px Georgia, serif`;
    while (g.measureText(t.name).width > 470 && size > 24) {
      size -= 3;
      g.font = `700 ${size}px Georgia, serif`;
    }
    g.fillText(t.name, 256, 50);
    g.font = "600 24px sans-serif";
    g.fillText(t.group, 256, 100);
  });
}

export function buildTechRoom(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const colliders: { x: number; z: number; hx: number; hz: number }[] = [];
  const add = (e: { pos: [number, number]; radius: number; info: ExhibitInfo }) => ctx.exhibits.push({ ...e, region: TECH_REGION });
  const midX = (TECH_X0 + TECH_X1) / 2;
  const midZ = (TECH_Z0 + TECH_Z1) / 2;
  const W = TECH_X1 - TECH_X0;
  const D = TECH_Z1 - TECH_Z0;
  const wall = lit(ctx, { color: "#3b4666", rough: 0.85 });
  const trim = lit(ctx, { color: "#39d0ff", emissive: "#39d0ff", ei: 1.6 });
  const dark = lit(ctx, { color: "#10131c", rough: 0.4, metal: 0.4 });
  const white = lit(ctx, { color: "#e9edf5", rough: 0.35 });

  box(ctx, W, 0.1, D, { parent: root, pos: [midX, -0.05, midZ], receive: true, mat: lit(ctx, { color: "#3a4256", rough: 0.35, metal: 0.1 }) });
  box(ctx, W, 0.1, D, { parent: root, pos: [midX, ROOM_H + 0.05, midZ], mat: lit(ctx, { color: "#2a3046", rough: 0.9 }) });
  box(ctx, T, ROOM_H, D, { parent: root, pos: [TECH_X1 + T / 2, ROOM_H / 2, midZ], receive: true, mat: wall });
  box(ctx, W, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, TECH_Z0 - T / 2], receive: true, mat: wall });
  box(ctx, W, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, TECH_Z1 + T / 2], receive: true, mat: wall });
  // neon strips
  box(ctx, 0.04, 0.05, D, { parent: root, pos: [TECH_X1 - 0.03, 2.9, midZ], mat: trim });
  box(ctx, W, 0.05, 0.04, { parent: root, pos: [midX, 2.9, TECH_Z0 + 0.03], mat: trim });
  box(ctx, W, 0.05, 0.04, { parent: root, pos: [midX, 2.9, TECH_Z1 - 0.03], mat: trim });
  box(ctx, 0.05, 0.14, D, { parent: root, pos: [TECH_X1 - 0.03, 0.07, midZ], mat: dark });

  const sign = canvasTexture(ctx, 640, 128, (g) => {
    g.fillStyle = "#0c1018";
    g.fillRect(0, 0, 640, 128);
    g.fillStyle = "#39d0ff";
    g.font = "bold 54px monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("< TEXNOLOGIYALAR />", 320, 66);
  });
  const sg = group(ctx, { parent: root, pos: [TECH_X0 + 0.02, 2.75, 20], rot: [0, Math.PI / 2, 0] });
  box(ctx, 2.0, 0.4, 0.05, { parent: sg, mat: dark });
  plane(ctx, 1.9, 0.35, { parent: sg, pos: [0, 0, 0.03], mat: unlit(ctx, { map: sign, opaque: true, fog: false, double: true }) });

  // ---- one pedestal per technology: a slowly spinning logo cube + engraved plate
  const rows: [number, number][] = [[17.7, 6], [21.9, 6], [24.4, 5]];
  const cubes: { node: ReturnType<typeof group>; y0: number; x: number; z: number; ph: number }[] = [];
  let k = 0;
  const pedMat = white;
  for (const [z, n] of rows) {
    for (let i = 0; i < n; i++) {
      const t = TECHS[k++];
      const x = 5.9 + i * 1.6;
      box(ctx, 0.7, 0.95, 0.7, { parent: root, pos: [x, 0.475, z], cast: true, mat: pedMat });
      box(ctx, 0.82, 0.06, 0.82, { parent: root, pos: [x, 0.98, z], mat: dark });
      box(ctx, 0.82, 0.05, 0.82, { parent: root, pos: [x, 0.025, z], mat: dark });
      plane(ctx, 0.56, 0.14, { parent: root, pos: [x, 0.7, z + 0.355], mat: unlit(ctx, { map: nameTex(ctx, t), opaque: true, fog: false, double: true }) });
      const cube = group(ctx, { parent: root, pos: [x, 1.42, z] });
      box(ctx, 0.5, 0.5, 0.5, { parent: cube, cast: true, mat: unlit(ctx, { map: logoTex(ctx, t), opaque: true, fog: false }) });
      // glow disc under the cube
      cylinder(ctx, 0.3, 0.3, 0.012, 24, { parent: root, pos: [x, 1.015, z], mat: lit(ctx, { color: "#39d0ff", emissive: "#39d0ff", ei: 1.4 }) });
      cubes.push({ node: cube, y0: 1.42, x, z, ph: k * 0.9 });
      colliders.push({ x, z, hx: 0.42, hz: 0.42 });
      add({ pos: [x, z + 1.0], radius: 1.15, info: { title: t.name, subtitle: `Texnologiya · ${t.group}`, lines: t.lines, tags: t.tags } });
    }
  }
  ctx.onFrame((_, now) => {
    if (ctx.player.x < 3.5 || ctx.player.z < 15) return;
    for (const c of cubes) {
      c.node.position.y = c.y0 + Math.sin(now * 1.4 + c.ph) * 0.04;
      setEuler(c.node, 0, now * 0.7 + c.ph, 0);
    }
  });

  // ---- featured 3D models on the right-hand wall
  const lazy: (() => void)[] = [];
  const feature = (file: string, x: number, z: number, size: number, yaw: number, info: ExhibitInfo) => {
    cylinder(ctx, 0.5, 0.56, 0.5, 28, { parent: root, pos: [x, 0.25, z], cast: true, mat: white });
    colliders.push({ x, z, hx: 0.55, hz: 0.55 });
    add({ pos: [x - 1.25, z], radius: 1.5, info });
    lazy.push(() => {
      instantiateFit(ctx, file, root, { pos: [x, 0.5, z], size, yaw }).catch((e) => console.error(file, e));
    });
  };
  feature("robot.glb", 14.3, 20.0, 1.2, -Math.PI / 2, { title: "Robot yordamchi", subtitle: "3D model · Animatsiyali personaj", lines: ["Veb-3D'da ishlatiladigan animatsiyali robot personaj modeli.", "Bu portfolio ham shunday real vaqt 3D texnologiyasi — Babylon.js — asosida ishlaydi."], tags: ["Babylon.js", "glTF"] });
  feature("gears.glb", 14.3, 18.4, 0.9, 0.5, { title: "Shesternyalar", subtitle: "3D model · Mexanizm", lines: ["Ichma-ich tishli g'ildiraklar — yaxshi arxitekturaning ramzi: har bir modul o'z vazifasini bajaradi.", "Feature-Sliced Design (FSD) tamoyili ham shunga o'xshaydi."], tags: ["FSD", "Architecture"] });
  feature("ion.glb", 14.3, 24.8, 1.3, -1.2, { title: "Ion dvigateli", subtitle: "3D model · Kelajak texnologiyasi", lines: ["Kosmik ion dvigatelining detalli modeli.", "Doimo yangi texnologiyalarni o'rganish — dasturchining asosiy odati."] });

  for (const [lx, lz] of [[7.4, 18.4], [11.8, 18.4], [7.4, 23.2], [11.8, 23.2]]) addPendant(ctx, root, lx, lz, ROOM_H, "#cfeaff", 26, 12);

  lazy.forEach((f) => ctx.defer(f));

  return { colliders, root };
}
