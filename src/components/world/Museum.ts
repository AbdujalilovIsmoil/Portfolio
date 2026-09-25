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
    g.fillText("M U S E U M", 256, 68);
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
    subtitle: "Work · Corporate website",
    lines: ["A corporate website for a company in construction, industry and logistics.", "Built with Next.js / React / TypeScript. Lighthouse: 83 / 82 / 100."],
    tags: ["Next.js", "React", "TypeScript"],
    link: "rtholdings.uz",
  }, [EX - 1.6, 8.4]);
  frame([EX, 1.85, 11], -Math.PI / 2, 2.1, 1.15, img("shams-oquv-markaz.png"), {
    title: "Shams Learning Center",
    subtitle: "Work · Education platform",
    lines: ["A multilingual website (uz / ru / en / ar-RTL) for an Arabic language learning centre. 1,700+ graduates, 12,000+ community members.", "A custom CMS and a CKEditor 5 plugin were developed."],
    tags: ["Next.js", "i18n", "CMS", "CKEditor5"],
    link: "shamsoquvmarkaz.uz",
  }, [EX - 1.6, 11]);
  frame([EX, 1.85, 13.6], -Math.PI / 2, 2.1, 1.15, img("foragedialog.png"), {
    title: "Foragedialog",
    subtitle: "Work · Agriculture platform",
    lines: ["A German–Uzbek climate-resilient agriculture platform.", "SEO 91%, Accessibility 90%."],
    tags: ["React", "SEO", "A11y"],
    link: "foragedialog.uz",
  }, [EX - 1.6, 13.6]);
  frame([8.4, 1.85, MUSEUM_Z0 + 0.09], 0, 1.35, 1.35, img("shams-asistant-bot.jpg"), {
    title: "Shams Assistant — AI bot",
    subtitle: "Work · Telegram bot",
    lines: ["An AI-powered assistant bot for Telegram. Runs on a VPS with Node.js and PM2.", "Migrated from the Gemini API to the ChatGPT API."],
    tags: ["Node.js", "PM2", "ChatGPT API"],
    link: "t.me/Shams_asisstant_bot",
  }, [8.4, MUSEUM_Z0 + 1.7]);
  frame([12, 1.85, MUSEUM_Z0 + 0.09], 0, 1.9, 1.15, textCard(ctx, "Printer", "React Native + Kotlin", "#1f5a8a"), {
    title: "Printer [Full Stack]",
    subtitle: "Project · Mobile app",
    lines: ["An Android thermal-printer app: React Native CLI with a Kotlin native module.", "Firebase authentication and Firestore."],
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
    { file: "nefertiti.glb", x: 7.4, z: 8.6, ph: 0.95, size: 0.7, yaw: 0.5, info: { title: "Bust of Nefertiti", subtitle: "Statue · Ancient Egypt", lines: ["The famous painted limestone bust of Queen Nefertiti (c. 1345 BC).", "Today it is kept in the Neues Museum in Berlin."] } },
    { file: "tennyson.glb", x: 7.4, z: 13.4, ph: 0.95, size: 0.7, yaw: 0.6, info: { title: "Bust of Tennyson", subtitle: "Statue · Literature", lines: ["A bust of the English poet Alfred, Lord Tennyson.", "One of the best-known voices of Victorian poetry."] } },
    { file: "leeperry.glb", x: 10.3, z: 8.6, ph: 0.95, size: 0.62, yaw: -0.5, info: { title: "Head portrait", subtitle: "Statue · 3D scan", lines: ["A high-quality 3D scan of Lee Perry-Smith's head.", "A well-known test model for real-time graphics and web 3D."] } },
    { file: "mask.glb", x: 10.3, z: 13.4, ph: 0.95, size: 0.55, yaw: 0.2, info: { title: "Venetian mask", subtitle: "Souvenir · Italy", lines: ["A traditional mask of the Venice carnival.", "For centuries a symbol of mystery and celebration."] } },
    { file: "rolex.glb", x: 12.6, z: 9.6, ph: 0.6, size: 0.3, yaw: 0.4, info: { title: "Wristwatch", subtitle: "Souvenir · Watchmaking", lines: ["A detailed 3D model of a mechanical wristwatch.", "Attention to detail — an important quality for a developer, too."] } },
    { file: "duck.glb", x: 12.6, z: 12.4, ph: 0.6, size: 0.3, yaw: -0.6, info: { title: "Yellow duck", subtitle: "Souvenir · glTF icon", lines: ["The unofficial mascot of the Khronos glTF format.", "One of the first test models of the 3D web."] } },
    { file: "parrot.glb", x: 14.2, z: 8.2, ph: 0.6, size: 0.42, yaw: -1.2, info: { title: "Parrot", subtitle: "Souvenir · Wildlife", lines: ["A low-poly animated parrot model."] } },
    { file: "flamingo.glb", x: 14.2, z: 14.6, ph: 0.6, size: 0.55, yaw: -1.9, info: { title: "Flamingo", subtitle: "Souvenir · Wildlife", lines: ["A pink-winged flamingo — a low-poly 3D model."] } },
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
  exhibits.push({ pos: [8.9, 11 + 2.2], radius: 2.2, info: { title: "Sports car", subtitle: "Souvenir · Design", lines: ["A 3D model of a classic Italian sports car.", "Speed and elegant form in harmony."] } });
  lazy.push(() => {
    instantiateFit(ctx, "ferrari.glb", root, { pos: [8.9, 0.22, 11], size: 2.3, yaw: 0.6 }).catch((e) => console.error("ferrari", e));
  });
  cylinder(ctx, 0.75, 0.85, 0.25, 28, { parent: root, pos: [13.3, 0.125, 11.5], mat: white });
  colliders.push({ x: 13.3, z: 11.5, hx: 0.85, hz: 0.85 });
  exhibits.push({ pos: [12, 11.5], radius: 2.0, info: { title: "Horse statue", subtitle: "Statue · Wildlife", lines: ["The horse — a symbol of speed, strength and freedom.", "A low-poly 3D model."] } });
  lazy.push(() => {
    instantiateFit(ctx, "horse.glb", root, { pos: [13.3, 0.25, 11.5], size: 1.5, yaw: -1.3 }).catch((e) => console.error("horse", e));
  });

  // ---- lights
  for (const [lx, lz] of [[7.5, 8.6], [7.5, 13.4], [12.3, 8.6], [12.3, 13.4], [10, 11]]) addPendant(ctx, root, lx, lz, ROOM_H, "#ffe3b8", 12, 11);

  lazy.forEach((f) => ctx.defer(f));

  return { colliders, root };
}
