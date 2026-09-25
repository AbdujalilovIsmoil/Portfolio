import type { Node } from "@babylonjs/core";
import { instantiateFit } from "./assets";
import type { ExhibitInfo } from "./exhibitSignal";
import { addPendant } from "./Lamps";
import { ROOM_H } from "./Room";
import { box, canvasTexture, group, lit, plane, unlit, type Ctx, type Region } from "./core";

export const TEST_X0 = 4.7;
export const TEST_X1 = 15;
export const TEST_Z0 = 26.2;
export const TEST_Z1 = 35.8;
export const TEST_REGION: Region = { x0: TEST_X0, x1: TEST_X1, z0: TEST_Z0, z1: TEST_Z1 };
const T = 0.2;

interface Testimonial {
  name: string;
  role: string;
  project: string;
  photo: string;
  color: string;
  quote: string;
  full: string[];
}

const PEOPLE: Testimonial[] = [
  {
    name: "Mr. Abdurahmon",
    role: "Founder, Shams O‘quv Markazi",
    project: "shamsoquvmarkaz.uz",
    photo: "/img/testimonials/shams-oquv-markaz.jpeg",
    color: "#1f5a8a",
    quote: "He transformed our ideas into a modern, visually appealing, user-friendly and highly functional website.",
    full: [
      "I am pleased to formally recommend Ismoil for his outstanding work as a web developer. As the founder of Shams O‘quv Markazi, I entrusted him with the development of our official website, shamsoquvmarkaz.uz, and he delivered results that exceeded all of our expectations.",
      "Throughout the entire project, Ismoil demonstrated exceptional technical expertise, professionalism, and a strong sense of responsibility. He transformed our ideas into a modern, visually appealing, user-friendly, and highly functional website.",
      "Beyond his technical skills, Ismoil consistently maintained clear communication, responded promptly, and was always open to feedback. He managed deadlines effectively and proactively suggested improvements that enhanced both performance and user experience.",
      "I am confident that Ismoil will be an invaluable asset to any team or project. He is a talented, dedicated, and trustworthy web developer whom I wholeheartedly recommend.",
    ],
  },
  {
    name: "Abdugafur Mamaraimov",
    role: "MBA Candidate, Pforzheim Business School",
    project: "foragedialog.uz",
    photo: "/img/testimonials/abdugafur.png",
    color: "#6a3a8a",
    quote: "He played a crucial role in the development of foragedialog.uz, delivering results that exceeded our expectations.",
    full: [
      "I am pleased to highly recommend Ismoiljon for his outstanding work as a web developer.",
      "He played a crucial role in the development of foragedialog.uz, delivering results that exceeded our expectations.",
    ],
  },
  {
    name: "Shaxlo (Nazimjonovna) Turayeva",
    role: "Backend Engineer (Python)",
    project: "Rentix",
    photo: "/img/testimonials/shaxlo.png",
    color: "#8a4a1f",
    quote: "One of Ismoiljon’s strongest qualities is his excellent sense of design. He is reliable, professional, and a great team player.",
    full: [
      "I am pleased to write this letter of recommendation for Ismoiljon, who worked on the front-end development of the Rentix project. He demonstrated strong technical skills, creativity, and a deep understanding of modern front-end technologies, and consistently delivered clean, efficient, well-structured code.",
      "One of Ismoiljon’s strongest qualities is his excellent sense of design. He has a sharp eye for detail and a solid understanding of UI/UX principles, which significantly improved the quality and usability of the Rentix platform.",
      "He is a great team player: he communicates clearly, collaborates effectively, adapts quickly to feedback, and is always willing to support his teammates.",
      "I highly recommend Ismoiljon for any front-end development role.",
    ],
  },
];

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 99) {
  const words = text.split(" ");
  let line = "";
  let n = 0;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > maxW && line) {
      if (++n >= maxLines) return g.fillText(line + "…", x, y);
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  g.fillText(line, x, y);
}

/** Portrait (circular, gold ring) + name, role and an excerpt, drawn once the photo has loaded. */
function card(ctx: Ctx, p: Testimonial) {
  const W = 1040;
  const H = 640;
  const tex = canvasTexture(ctx, W, H, () => {});
  const g = tex.getContext() as CanvasRenderingContext2D;
  const draw = (img: HTMLImageElement | null) => {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0d1220");
    bg.addColorStop(1, p.color);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(230,197,104,0.85)";
    g.lineWidth = 5;
    g.strokeRect(20, 20, W - 40, H - 40);
    g.strokeStyle = "rgba(230,197,104,0.3)";
    g.lineWidth = 2;
    g.strokeRect(34, 34, W - 68, H - 68);
    // portrait
    const cx = 210;
    const cy = 250;
    const r = 130;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    if (img) g.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    else {
      g.fillStyle = "#222b44";
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.restore();
    g.strokeStyle = "#f0d078";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(cx, cy, r + 6, 0, Math.PI * 2);
    g.stroke();
    // name under portrait
    g.textAlign = "center";
    g.fillStyle = "#f0d078";
    g.font = "bold 40px Georgia, serif";
    let size = 40;
    while (g.measureText(p.name).width > 400 && size > 22) {
      size -= 2;
      g.font = `bold ${size}px Georgia, serif`;
    }
    wrap(g, p.name, cx, 450, 400, 40, 2);
    g.fillStyle = "#e9eefc";
    g.font = "600 24px sans-serif";
    wrap(g, p.role, cx, 512, 400, 30, 2);
    // quote
    g.textAlign = "left";
    g.fillStyle = "rgba(240,208,120,0.35)";
    g.font = "bold 200px Georgia, serif";
    g.fillText("“", 400, 260);
    g.fillStyle = "#ffffff";
    g.font = "italic 36px Georgia, serif";
    wrap(g, p.quote, 440, 190, 540, 52, 7);
    g.fillStyle = "#f0d078";
    g.font = "600 26px sans-serif";
    g.fillText("— " + p.project, 440, 560);
    tex.update(true);
  };
  draw(null);
  const img = new Image();
  img.onload = () => draw(img);
  img.src = p.photo;
  return tex;
}

export function buildTestimonialsRoom(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const colliders: { x: number; z: number; hx: number; hz: number }[] = [];
  const add = (e: { pos: [number, number]; radius: number; info: ExhibitInfo }) => ctx.exhibits.push({ ...e, region: TEST_REGION });
  const midX = (TEST_X0 + TEST_X1) / 2;
  const midZ = (TEST_Z0 + TEST_Z1) / 2;
  const W = TEST_X1 - TEST_X0;
  const D = TEST_Z1 - TEST_Z0;
  const wall = lit(ctx, { color: "#e4d6d0", rough: 0.9 });
  const gold = lit(ctx, { color: "#c9a24a", rough: 0.3, metal: 0.85 });
  const wood = lit(ctx, { color: "#3a2618", rough: 0.5 });
  const marble = lit(ctx, { color: "#eeece6", rough: 0.3 });

  box(ctx, W, 0.1, D, { parent: root, pos: [midX, -0.05, midZ], receive: true, mat: lit(ctx, { color: "#d9d4c8", rough: 0.25, metal: 0.05 }) });
  box(ctx, W - 1.5, 0.012, D - 1.5, { parent: root, pos: [midX, 0.006, midZ], mat: lit(ctx, { color: "#7a2331", rough: 1 }) });
  box(ctx, W, 0.1, D, { parent: root, pos: [midX, ROOM_H + 0.05, midZ], mat: lit(ctx, { color: "#f2eee6", rough: 0.95 }) });
  box(ctx, T, ROOM_H, D, { parent: root, pos: [TEST_X1 + T / 2, ROOM_H / 2, midZ], receive: true, mat: wall });
  box(ctx, W, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, TEST_Z0 - T / 2], receive: true, mat: wall });
  box(ctx, W, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, TEST_Z1 + T / 2], receive: true, mat: wall });
  box(ctx, 0.05, 0.18, D, { parent: root, pos: [TEST_X1 - 0.03, 0.09, midZ], mat: wood });
  box(ctx, W, 0.18, 0.05, { parent: root, pos: [midX, 0.09, TEST_Z0 + 0.03], mat: wood });
  box(ctx, W, 0.18, 0.05, { parent: root, pos: [midX, 0.09, TEST_Z1 - 0.03], mat: wood });

  const sign = canvasTexture(ctx, 640, 128, (g) => {
    g.fillStyle = "#1b1410";
    g.fillRect(0, 0, 640, 128);
    g.fillStyle = "#e6c568";
    g.font = "bold 50px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("T E S T I M O N I A L S", 320, 66);
  });
  const sg = group(ctx, { parent: root, pos: [TEST_X0 + 0.02, 2.75, 29], rot: [0, Math.PI / 2, 0] });
  box(ctx, 2.0, 0.4, 0.05, { parent: sg, mat: gold });
  plane(ctx, 1.9, 0.35, { parent: sg, pos: [0, 0, 0.03], mat: unlit(ctx, { map: sign, opaque: true, fog: false, double: true }) });

  // ---- three framed testimonials: north, east and south walls
  const fw = 2.5;
  const fh = fw * (640 / 1040);
  const B = 0.14;
  const spots: { pos: [number, number, number]; yaw: number; stand: [number, number] }[] = [
    { pos: [9.85, 1.9, TEST_Z0 + 0.1], yaw: 0, stand: [9.85, TEST_Z0 + 1.8] },
    { pos: [TEST_X1 - 0.1, 1.9, 31.0], yaw: -Math.PI / 2, stand: [TEST_X1 - 1.8, 31.0] },
    { pos: [9.85, 1.9, TEST_Z1 - 0.1], yaw: Math.PI, stand: [9.85, TEST_Z1 - 1.8] },
  ];
  PEOPLE.forEach((p, i) => {
    const f = group(ctx, { parent: root, pos: spots[i].pos, rot: [0, spots[i].yaw, 0] });
    box(ctx, fw + B * 2, B, 0.12, { parent: f, pos: [0, (fh + B) / 2, 0], cast: true, mat: gold });
    box(ctx, fw + B * 2, B, 0.12, { parent: f, pos: [0, -(fh + B) / 2, 0], cast: true, mat: gold });
    box(ctx, B, fh, 0.12, { parent: f, pos: [(fw + B) / 2, 0, 0], cast: true, mat: gold });
    box(ctx, B, fh, 0.12, { parent: f, pos: [-(fw + B) / 2, 0, 0], cast: true, mat: gold });
    box(ctx, fw + 0.04, fh + 0.04, 0.03, { parent: f, pos: [0, 0, -0.03], mat: wood });
    plane(ctx, fw, fh, { parent: f, pos: [0, 0, 0.001], mat: unlit(ctx, { map: card(ctx, p), opaque: true, fog: false, double: true }) });
    box(ctx, 0.6, 0.04, 0.16, { parent: f, pos: [0, (fh + B) / 2 + 0.16, 0.1], mat: lit(ctx, { color: "#222", metal: 0.8, rough: 0.3 }) });
    box(ctx, 0.54, 0.02, 0.06, { parent: f, pos: [0, (fh + B) / 2 + 0.135, 0.15], mat: lit(ctx, { color: "#fff6dc", emissive: "#fff0c0", ei: 2.4 }) });
    add({
      pos: spots[i].stand,
      radius: 1.5,
      info: { title: p.name, subtitle: `${p.role} · ${p.project}`, lines: p.full, tags: ["Recommendation letter"] },
    });
  });

  // ---- great figures: marble busts on plinths
  const lazy: (() => void)[] = [];
  const bust = (file: string, x: number, z: number, size: number, yaw: number, info: ExhibitInfo) => {
    box(ctx, 0.85, 1.0, 0.85, { parent: root, pos: [x, 0.5, z], cast: true, mat: marble });
    box(ctx, 0.97, 0.07, 0.97, { parent: root, pos: [x, 1.035, z], mat: marble });
    box(ctx, 0.97, 0.07, 0.97, { parent: root, pos: [x, 0.035, z], mat: marble });
    colliders.push({ x, z, hx: 0.5, hz: 0.5 });
    add({ pos: [x + 1.4, z], radius: 1.7, info });
    lazy.push(() => {
      instantiateFit(ctx, file, root, { pos: [x, 1.07, z], size, yaw }).catch((e) => console.error(file, e));
    });
  };
  bust("nefertiti.glb", 7.2, 28.8, 0.75, 1.2, { title: "Nefertiti", subtitle: "Great figure · Queen of ancient Egypt", lines: ["Queen Nefertiti (14th century BC) is famed for her beauty and her influence in affairs of state.", "Her bust is one of the most recognisable works of art in the world."] });
  bust("tennyson.glb", 7.2, 33.2, 0.75, 1.0, { title: "Alfred Lord Tennyson", subtitle: "Great figure · Poet", lines: ["English poet (1809–1892), one of the most celebrated voices of the Victorian era.", "Known for verse in the spirit of “to strive, to seek, to find, and not to yield.”"] });
  bust("leeperry.glb", 11.6, 31.0, 0.7, 1.4, { title: "Portrait bust", subtitle: "Statue · 3D scan", lines: ["A high-resolution 3D scan of a real person.", "Modern technology makes it possible to preserve a person for centuries."] });

  for (const [lx, lz] of [[7.6, 28.6], [7.6, 33.4], [11.8, 28.6], [11.8, 33.4]]) addPendant(ctx, root, lx, lz, ROOM_H, "#ffe6c8", 14, 11);

  lazy.forEach((f) => ctx.defer(f));

  return { colliders, root };
}
