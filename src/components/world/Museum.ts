import { Texture, type Node } from "@babylonjs/core";
import { instantiateFit } from "./assets";
import type { ExhibitInfo } from "./exhibitSignal";
import { addPendant } from "./Lamps";
import { ROOM_H } from "./Room";
import { box, canvasTexture, cylinder, group, lit, plane, unlit, type Ctx, type Region, type V3 } from "./core";

export const MUSEUM_X0 = 4.7;
export const MUSEUM_X1 = 15;
export const MUSEUM_Z0 = 6.2;
export const MUSEUM_Z1 = 15.8;
export const MUSEUM_REGION: Region = { x0: MUSEUM_X0, x1: MUSEUM_X1, z0: MUSEUM_Z0, z1: MUSEUM_Z1 };
const CZ = 11;
const T = 0.2;

interface Exhibit {
  pos: [number, number]; // where the visitor is "at" the piece
  radius: number;
  info: ExhibitInfo;
}

function textCard(ctx: Ctx, title: string, sub: string, hex: string) {
  return canvasTexture(ctx, 640, 400, (g) => {
    const grd = g.createLinearGradient(0, 0, 640, 400);
    grd.addColorStop(0, "#0f1730");
    grd.addColorStop(1, hex);
    g.fillStyle = grd;
    g.fillRect(0, 0, 640, 400);
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.font = "bold 64px sans-serif";
    g.textAlign = "center";
    g.fillText(title, 320, 190);
    g.font = "28px sans-serif";
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillText(sub, 320, 250);
  });
}

export function buildMuseum(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const colliders: { x: number; z: number; hx: number; hz: number }[] = [];
  const exhibits = { push: (e: Exhibit) => ctx.exhibits.push({ ...e, region: MUSEUM_REGION }) };
  const midX = (MUSEUM_X0 + MUSEUM_X1) / 2;
  const midZ = (MUSEUM_Z0 + MUSEUM_Z1) / 2;
  const W = MUSEUM_X1 - MUSEUM_X0;
  const D = MUSEUM_Z1 - MUSEUM_Z0;
  const wall = lit(ctx, { color: "#e7e1d3", rough: 0.9 });
  const gold = lit(ctx, { color: "#c9a24a", rough: 0.3, metal: 0.85 });
  const wood = lit(ctx, { color: "#3a2618", rough: 0.5 });
  const white = lit(ctx, { color: "#f1efe9", rough: 0.6 });

  // shell
  box(ctx, W, 0.1, D, { parent: root, pos: [midX, -0.05, midZ], receive: true, mat: lit(ctx, { color: "#35323a", rough: 0.25, metal: 0.15 }) });
  box(ctx, W - 1, 0.012, D - 1, { parent: root, pos: [midX, 0.006, midZ], mat: lit(ctx, { color: "#6b1f2a", rough: 1 }) });
  box(ctx, W, 0.1, D, { parent: root, pos: [midX, ROOM_H + 0.05, midZ], mat: lit(ctx, { color: "#f0ece2", rough: 0.95 }) });
  box(ctx, T, ROOM_H, D, { parent: root, pos: [MUSEUM_X1 + T / 2, ROOM_H / 2, midZ], receive: true, mat: wall });
  box(ctx, W, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, MUSEUM_Z0 - T / 2], receive: true, mat: wall });
  box(ctx, W, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, MUSEUM_Z1 + T / 2], receive: true, mat: wall });
  box(ctx, 0.05, 0.16, D, { parent: root, pos: [MUSEUM_X1 - 0.03, 0.08, midZ], mat: wood });
  box(ctx, W, 0.16, 0.05, { parent: root, pos: [midX, 0.08, MUSEUM_Z0 + 0.03], mat: wood });
  box(ctx, W, 0.16, 0.05, { parent: root, pos: [midX, 0.08, MUSEUM_Z1 - 0.03], mat: wood });

  // "MUZEY" sign above the entrance (inside)
  const sign = canvasTexture(ctx, 512, 128, (g) => {
    g.fillStyle = "#1b1410";
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = "#e6c568";
    g.font = "bold 76px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("M U Z E Y", 256, 68);
  });
  const sg = group(ctx, { parent: root, pos: [MUSEUM_X0 + 0.02, 2.75, CZ], rot: [0, Math.PI / 2, 0] });
  box(ctx, 1.5, 0.4, 0.05, { parent: sg, mat: gold });
  plane(ctx, 1.4, 0.35, { parent: sg, pos: [0, 0, 0.03], mat: unlit(ctx, { map: sign, opaque: true, fog: false, double: true }) });

  // ---- framed works on the walls
  const frame = (pos: V3, yaw: number, w: number, h: number, tex: Texture, info: ExhibitInfo, standAt: [number, number]) => {
    const f = group(ctx, { parent: root, pos, rot: [0, yaw, 0] });
    const B = 0.13;
    box(ctx, w + B * 2, B, 0.1, { parent: f, pos: [0, (h + B) / 2, 0], mat: gold });
    box(ctx, w + B * 2, B, 0.1, { parent: f, pos: [0, -(h + B) / 2, 0], mat: gold });
    box(ctx, B, h, 0.1, { parent: f, pos: [(w + B) / 2, 0, 0], mat: gold });
    box(ctx, B, h, 0.1, { parent: f, pos: [-(w + B) / 2, 0, 0], mat: gold });
    box(ctx, w + 0.04, h + 0.04, 0.03, { parent: f, pos: [0, 0, -0.03], mat: white });
    plane(ctx, w - 0.1, h - 0.1, { parent: f, pos: [0, 0, 0.001], mat: unlit(ctx, { map: tex, opaque: true, fog: false, double: true }) });
    // picture light on top
    box(ctx, 0.5, 0.04, 0.16, { parent: f, pos: [0, (h + B) / 2 + 0.16, 0.1], mat: lit(ctx, { color: "#222", metal: 0.8, rough: 0.3 }) });
    box(ctx, 0.44, 0.02, 0.06, { parent: f, pos: [0, (h + B) / 2 + 0.135, 0.15], mat: lit(ctx, { color: "#fff6dc", emissive: "#fff0c0", ei: 2.4 }) });
    exhibits.push({ pos: standAt, radius: 2.3, info });
  };
  const img = (file: string) => new Texture(`/img/works/${file}`, ctx.scene);
  const EX = MUSEUM_X1 - 0.09;
  frame([EX, 1.85, 8.4], -Math.PI / 2, 2.1, 1.15, img("rt-holdings.jpg"), {
    title: "RT Holdings",
    subtitle: "Ish · Korporativ sayt",
    lines: ["Qurilish, sanoat va logistika sohasidagi kompaniya uchun korporativ veb-sayt.", "Next.js / React / TypeScript asosida qurilgan. Lighthouse: 83 / 82 / 100."],
    tags: ["Next.js", "React", "TypeScript"],
    link: "rtholdings.uz",
  }, [EX - 1.6, 8.4]);
  frame([EX, 1.85, 11], -Math.PI / 2, 2.1, 1.15, img("shams-oquv-markaz.png"), {
    title: "Shams O'quv Markazi",
    subtitle: "Ish · Ta'lim platformasi",
    lines: ["Arab tili o'quv markazi uchun ko'p tilli sayt (uz / ru / en / ar-RTL). 1700+ bitiruvchi, 12 000+ jamoa.", "Maxsus CMS va CKEditor5 plagini ishlab chiqilgan."],
    tags: ["Next.js", "i18n", "CMS", "CKEditor5"],
    link: "shamsoquvmarkaz.uz",
  }, [EX - 1.6, 11]);
  frame([EX, 1.85, 13.6], -Math.PI / 2, 2.1, 1.15, img("foragedialog.png"), {
    title: "Foragedialog",
    subtitle: "Ish · Qishloq xo'jaligi platformasi",
    lines: ["Germaniya–O'zbekiston iqlimga chidamli qishloq xo'jaligi platformasi.", "SEO 91%, Accessibility 90%."],
    tags: ["React", "SEO", "A11y"],
    link: "foragedialog.uz",
  }, [EX - 1.6, 13.6]);
  frame([8.4, 1.85, MUSEUM_Z0 + 0.09], 0, 1.35, 1.35, img("shams-asistant-bot.jpg"), {
    title: "Shams Assistant — AI bot",
    subtitle: "Ish · Telegram bot",
    lines: ["Telegram uchun sun'iy intellektli yordamchi bot. Node.js, PM2 bilan VPS'da ishlaydi.", "Gemini'dan ChatGPT API'ga ko'chirilgan."],
    tags: ["Node.js", "PM2", "ChatGPT API"],
    link: "t.me/Shams_asisstant_bot",
  }, [8.4, MUSEUM_Z0 + 1.7]);
  frame([12, 1.85, MUSEUM_Z0 + 0.09], 0, 1.9, 1.15, textCard(ctx, "Printer", "React Native + Kotlin", "#1f5a8a"), {
    title: "Printer [Full Stack]",
    subtitle: "Loyiha · Mobil ilova",
    lines: ["Android uchun termal printer ilovasi: React Native CLI va Kotlin native modul.", "Firebase autentifikatsiya va Firestore."],
    tags: ["React Native", "Kotlin", "Firebase"],
  }, [12, MUSEUM_Z0 + 1.7]);

  // ---- pedestals with real 3D models (loaded when you get close)
  const pedestal = (x: number, z: number, h: number, w = 0.85) => {
    box(ctx, w, h, w, { parent: root, pos: [x, h / 2, z], cast: true, mat: white });
    box(ctx, w + 0.1, 0.06, w + 0.1, { parent: root, pos: [x, h + 0.03, z], mat: white });
    colliders.push({ x, z, hx: w / 2 + 0.05, hz: w / 2 + 0.05 });
    return h + 0.06;
  };
  interface Piece { file: string; x: number; z: number; ph: number; size: number; yaw: number; info: ExhibitInfo; round?: boolean }
  const pieces: Piece[] = [
    { file: "nefertiti.glb", x: 7.4, z: 8.6, ph: 0.95, size: 0.7, yaw: 0.5, info: { title: "Nefertiti byusti", subtitle: "Haykal · Qadimgi Misr", lines: ["Malika Nefertitining mashhur bo'yalgan ohaktosh byusti (miloddan avvalgi ~1345-yil).", "Bugun Berlindagi Neues Museumda saqlanadi."] } },
    { file: "tennyson.glb", x: 7.4, z: 13.4, ph: 0.95, size: 0.7, yaw: 0.6, info: { title: "Tennison byusti", subtitle: "Haykal · Adabiyot", lines: ["Ingliz shoiri Alfred Lord Tennisonning byusti.", "Viktoriya davri she'riyatining eng mashhur namoyandalaridan biri."] } },
    { file: "leeperry.glb", x: 10.3, z: 8.6, ph: 0.95, size: 0.62, yaw: -0.5, info: { title: "Bosh portreti", subtitle: "Haykal · 3D skanerlash", lines: ["Lee Perry-Smith'ning yuqori sifatli 3D-skaner qilingan boshi.", "Real vaqt grafikasi va veb-3D uchun mashhur test modeli."] } },
    { file: "mask.glb", x: 10.3, z: 13.4, ph: 0.95, size: 0.55, yaw: 0.2, info: { title: "Venetsiya niqobi", subtitle: "Suvenir · Italiya", lines: ["Venetsiya karnavalining an'anaviy niqobi.", "Asrlar davomida sirlilik va bayram ramzi."] } },
    { file: "rolex.glb", x: 12.6, z: 9.6, ph: 0.6, size: 0.3, yaw: 0.4, info: { title: "Qo'l soati", subtitle: "Suvenir · Soatsozlik", lines: ["Mexanik qo'l soatining batafsil 3D modeli.", "Detallarga e'tibor — dasturchi uchun ham muhim fazilat."] } },
    { file: "duck.glb", x: 12.6, z: 12.4, ph: 0.6, size: 0.3, yaw: -0.6, info: { title: "Sariq o'rdak", subtitle: "Suvenir · glTF ramzi", lines: ["Khronos glTF formatining norasmiy maskoti.", "3D veb-dunyoda birinchi test modellaridan biri."] } },
    { file: "parrot.glb", x: 14.2, z: 8.2, ph: 0.6, size: 0.42, yaw: -1.2, info: { title: "To'tiqush", subtitle: "Suvenir · Hayvonot", lines: ["Past poligonli animatsiyali to'tiqush modeli."] } },
    { file: "flamingo.glb", x: 14.2, z: 14.6, ph: 0.6, size: 0.55, yaw: -1.9, info: { title: "Flamingo", subtitle: "Suvenir · Hayvonot", lines: ["Pushti qanotli flamingo — past poligonli 3D model."] } },
  ];
  const lazy: (() => void)[] = [];
  pieces.forEach((p) => {
    const top = pedestal(p.x, p.z, p.ph);
    exhibits.push({ pos: [p.x - 1.4, p.z], radius: 2.0, info: p.info });
    lazy.push(() => {
      instantiateFit(ctx, p.file, root, { pos: [p.x, top, p.z], size: p.size, yaw: p.yaw }).catch((e) => console.error(p.file, e));
    });
  });
  // sports-car sculpture on a low round podium + horse statue
  cylinder(ctx, 1.4, 1.5, 0.22, 36, { parent: root, pos: [8.9, 0.11, 11], cast: true, mat: white });
  colliders.push({ x: 8.9, z: 11, hx: 1.4, hz: 1.4 });
  exhibits.push({ pos: [8.9, 11 + 2.2], radius: 2.2, info: { title: "Sport avtomobil", subtitle: "Suvenir · Dizayn", lines: ["Klassik italyan sport avtomobilining 3D modeli.", "Tezlik va nafis shakl uyg'unligi."] } });
  lazy.push(() => {
    instantiateFit(ctx, "ferrari.glb", root, { pos: [8.9, 0.22, 11], size: 2.3, yaw: 0.6 }).catch((e) => console.error("ferrari", e));
  });
  cylinder(ctx, 0.75, 0.85, 0.25, 28, { parent: root, pos: [13.3, 0.125, 11.5], mat: white });
  colliders.push({ x: 13.3, z: 11.5, hx: 0.85, hz: 0.85 });
  exhibits.push({ pos: [12, 11.5], radius: 2.0, info: { title: "Ot haykali", subtitle: "Haykal · Hayvonot", lines: ["Ot — tezlik, kuch va erkinlik ramzi.", "Past poligonli 3D model."] } });
  lazy.push(() => {
    instantiateFit(ctx, "horse.glb", root, { pos: [13.3, 0.25, 11.5], size: 1.5, yaw: -1.3 }).catch((e) => console.error("horse", e));
  });

  // ---- lights
  for (const [lx, lz] of [[7.5, 8.6], [7.5, 13.4], [12.3, 8.6], [12.3, 13.4], [10, 11]]) addPendant(ctx, root, lx, lz, ROOM_H, "#ffe3b8", 12, 11);

  lazy.forEach((f) => ctx.defer(f));

  return { colliders };
}
