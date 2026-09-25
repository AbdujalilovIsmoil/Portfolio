import type { Node } from "@babylonjs/core";
import { instantiateFit } from "./assets";
import type { ExhibitInfo } from "./exhibitSignal";
import { addPendant } from "./Lamps";
import { ROOM_H } from "./Room";
import { box, canvasTexture, group, lit, plane, unlit, type Ctx, type Region } from "./core";

export const HIST_X0 = -10;
export const HIST_X1 = 1.3;
export const HIST_Z0 = 16.2;
export const HIST_Z1 = 25.8;
export const HISTORY_REGION: Region = { x0: HIST_X0, x1: HIST_X1, z0: HIST_Z0, z1: HIST_Z1 };
const T = 0.2;

interface Job {
  company: string;
  role: string;
  type: string;
  dates: string;
  points: string[];
  tags: string[];
  color: string;
  lines: string[];
}

const JOBS: Job[] = [
  {
    company: "Shams Learning Center",
    role: "Frontend Engineer",
    type: "Contract",
    dates: "May 2025 – April 2026",
    color: "#1f5a8a",
    tags: ["Next.js", "React", "CKEditor 5", "Node.js"],
    points: ["Multilingual site: Uzbek, Russian, English, Arabic (RTL)", "Custom CMS with Admin Panel, REST API & rich-text editor", "@Shams_asisstant_bot — AI Telegram assistant, 24/7 on VPS"],
    lines: [
      "old.shamsoquvmarkaz.uz – Developed a modern, multilingual educational website using Next.js and React to present courses, achievements, and community impact. Implemented full internationalization with Uzbek, Russian, English, and Arabic (RTL) support, delivering a responsive and accessible experience. The platform highlights 1,700+ graduates and a 12,000+ member community.",
      "shamsoquvmarkaz.uz – Built a custom CMS with Admin Panel, REST API, and rich-text editing, including a custom CKEditor 5 plugin for interactive image carousels. Redesigned mobile navigation with animated transitions; improved SEO with JSON-LD and Open Graph metadata.",
      "@Shams_asisstant_bot – Production-ready AI Telegram assistant (Node.js, Telegram Bot API) with inline keyboards and command workflows. Deployed on a VPS with PM2, secure env management, error handling and rate limits. Led the migration from Google Gemini API to ChatGPT API for higher request volumes and better token handling.",
    ],
  },
  {
    company: "Ixlos School",
    role: "Frontend & UI/UX Teacher",
    type: "Part Time",
    dates: "February 2026 – April 2026",
    color: "#6a3a8a",
    tags: ["Figma", "HTML/CSS", "AI tools", "Mentoring"],
    points: ["Taught ChatGPT, Gemini, Google AI Studio, Stitch, Figma AI, Grok, Rork", "Strengthened HTML & CSS foundations through guided practice", "Intermediate UI/UX design with Figma; mentorship & classroom management"],
    lines: [
      "Introduced students to AI platforms and tools such as ChatGPT, Gemini, Google AI Studio, Stitch, Figma AI, Grok, Rork, and other emerging technologies.",
      "Helped students use AI tools effectively for learning, creativity, and productivity.",
      "Reinforced foundational HTML and CSS knowledge through practical exercises and guided lessons.",
      "Taught intermediate UI/UX concepts using Figma so students could create their own responsive, well-structured designs.",
      "Improved communication, mentorship, and classroom management skills; encouraged creativity, independent thinking and problem-solving through hands-on mini projects.",
    ],
  },
  {
    company: "Rentix",
    role: "Frontend Engineer",
    type: "Full Time",
    dates: "October 2025 – April 2026",
    color: "#8a4a1f",
    tags: ["React", "Ant Design", "Formik", "React Query", "FSD"],
    points: ["Refactored the codebase to Feature-Sliced Design (FSD)", "Secure auth (Login, Registration, OTP) and role-based admin panel", "Real-time notifications, custom date-time picker, CRUD modules"],
    lines: [
      "Developed the frontend of the Rentix project and refactored the codebase into Feature-Sliced Design (FSD) architecture, with reusable modular components and a standardized global state.",
      "Built a responsive interface with React, Ant Design, Formik, and React Query for efficient data handling.",
      "Implemented secure authentication (Login, Registration, OTP verification) and advanced order filtering by date and time.",
      "Built role-based access control in the admin panel with dynamic route rendering based on permissions.",
      "Designed reusable UI components and a custom date-time picker; implemented real-time notifications and CRUD modules (regions, cars, managers).",
      "Integrated online/offline state detection to improve reliability and user feedback.",
    ],
  },
  {
    company: "UnitDev",
    role: "Frontend Engineer",
    type: "Contract",
    dates: "April 2024 – October 2025",
    color: "#1f6a4a",
    tags: ["Next.js", "TypeScript", "CKEditor", "SEO"],
    points: ["foragedialog.uz — production platform, 91% SEO · 90% Accessibility", "rtholdings.uz — 83% Performance · 82% A11y · 100% SEO", "Multilingual, role-based, API-driven web platforms"],
    lines: [
      "foragedialog.uz – Rebuilt from scratch a production-grade multilingual platform for the German–Uzbek climate-resilient agriculture program: real-time content management, role-based authentication, API-driven workflows and a customized CKEditor. Achieved 91% SEO and 90% Accessibility (Lighthouse). Fully live and continuously updated.",
      "rtholdings.uz – Modern, high-performance corporate website for a multinational company across Uzbekistan and Central Asia (Next.js, React, TypeScript): dynamic API-driven content, search, secure login. Lighthouse in production: 83% Performance, 82% Accessibility, 100% SEO.",
    ],
  },
  {
    company: "OKS Technologies",
    role: "Frontend Engineer",
    type: "Internship",
    dates: "February 2023 – July 2023",
    color: "#3a4a8a",
    tags: ["Ant Design", "Tailwind", "React Query", "Redux Toolkit"],
    points: ["Admin panel with Ant Design and streamlined form workflows", "Responsive news website UI with Tailwind CSS", "React Query caching + Redux Toolkit auth (persistent login)"],
    lines: [
      "Built an admin panel with Ant Design, customizing components, ensuring responsive layouts, and streamlining form workflows.",
      "Developed a responsive news website UI with Tailwind CSS, accelerating development and optimizing the CSS footprint.",
      "Implemented data fetching with React Query, including caching, retry logic, and category-based filtering hooks, reducing redundant API calls.",
      "Managed global state and user authorization with Redux Toolkit (persistent login, secure logout); integrated Formik with Ant Design for validated forms.",
    ],
  },
];

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  g.fillText(line, x, yy);
  return yy + lh;
}

/** A gallery placard: company name in big gold serif, role/dates, highlights and stack chips. */
function banner(ctx: Ctx, j: Job) {
  const W = 1000;
  const H = 640;
  return canvasTexture(ctx, W, H, (g) => {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0d1220");
    bg.addColorStop(1, j.color);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(230,197,104,0.85)";
    g.lineWidth = 5;
    g.strokeRect(22, 22, W - 44, H - 44);
    g.strokeStyle = "rgba(230,197,104,0.35)";
    g.lineWidth = 2;
    g.strokeRect(36, 36, W - 72, H - 72);
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    // company (auto-fit)
    let size = 92;
    g.font = `bold ${size}px Georgia, serif`;
    while (g.measureText(j.company).width > W - 150 && size > 40) {
      size -= 4;
      g.font = `bold ${size}px Georgia, serif`;
    }
    g.fillStyle = "#f0d078";
    g.shadowColor = "rgba(0,0,0,0.5)";
    g.shadowBlur = 8;
    g.fillText(j.company, W / 2, 130);
    g.shadowBlur = 0;
    g.fillStyle = "#ffffff";
    g.font = "600 40px Georgia, serif";
    g.fillText(j.role, W / 2, 190);
    // type + dates pill
    const pill = `${j.type}  •  ${j.dates}`;
    g.font = "600 27px sans-serif";
    const pw = g.measureText(pill).width + 44;
    g.fillStyle = "rgba(240,208,120,0.18)";
    g.strokeStyle = "rgba(240,208,120,0.8)";
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(W / 2 - pw / 2, 214, pw, 46, 23);
    g.fill();
    g.stroke();
    g.fillStyle = "#f6e6b0";
    g.fillText(pill, W / 2, 246);
    // divider
    g.fillStyle = "rgba(240,208,120,0.6)";
    g.fillRect(W / 2 - 120, 284, 240, 3);
    // highlights
    g.textAlign = "left";
    g.fillStyle = "#e9eefc";
    g.font = "29px sans-serif";
    let y = 335;
    for (const p of j.points) {
      g.fillStyle = "#f0d078";
      g.fillText("◆", 70, y);
      g.fillStyle = "#e9eefc";
      y = wrap(g, p, 110, y, W - 190, 36) + 10;
    }
    // tags
    let x = 70;
    g.font = "600 22px sans-serif";
    for (const t of j.tags) {
      const w = g.measureText(t).width + 30;
      if (x + w > W - 60) break;
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.beginPath();
      g.roundRect(x, H - 100, w, 40, 20);
      g.fill();
      g.fillStyle = "#ffffff";
      g.fillText(t, x + 15, H - 72);
      x += w + 12;
    }
  });
}

export function buildHistoryRoom(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  const colliders: { x: number; z: number; hx: number; hz: number }[] = [];
  const add = (e: { pos: [number, number]; radius: number; info: ExhibitInfo }) => ctx.exhibits.push({ ...e, region: HISTORY_REGION });
  const midX = (HIST_X0 + HIST_X1) / 2;
  const midZ = (HIST_Z0 + HIST_Z1) / 2;
  const W = HIST_X1 - HIST_X0;
  const D = HIST_Z1 - HIST_Z0;
  const wall = lit(ctx, { color: "#d9c9a8", rough: 0.92 });
  const woodDark = lit(ctx, { color: "#2c1c12", rough: 0.5 });
  const gold = lit(ctx, { color: "#c9a24a", rough: 0.3, metal: 0.85 });
  const stone = lit(ctx, { color: "#b9b2a4", rough: 0.85 });

  // shell: dark parquet floor, parchment walls, timber beams
  box(ctx, W, 0.1, D, { parent: root, pos: [midX, -0.05, midZ], receive: true, mat: lit(ctx, { color: "#3a2718", rough: 0.4 }) });
  box(ctx, W - 1, 0.012, D - 1, { parent: root, pos: [midX, 0.006, midZ], mat: lit(ctx, { color: "#2e3f5a", rough: 1 }) });
  box(ctx, W, 0.1, D, { parent: root, pos: [midX, ROOM_H + 0.05, midZ], mat: lit(ctx, { color: "#e9dfc8", rough: 0.95 }) });
  for (let x = HIST_X0 + 1.5; x < HIST_X1; x += 3.3) box(ctx, 0.28, 0.24, D, { parent: root, pos: [x, ROOM_H - 0.12, midZ], mat: woodDark });
  box(ctx, T, ROOM_H, D, { parent: root, pos: [HIST_X0 - T / 2, ROOM_H / 2, midZ], receive: true, mat: wall });
  box(ctx, W, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, HIST_Z0 - T / 2], receive: true, mat: wall });
  box(ctx, W, ROOM_H, T, { parent: root, pos: [midX, ROOM_H / 2, HIST_Z1 + T / 2], receive: true, mat: wall });
  box(ctx, 0.05, 0.18, D, { parent: root, pos: [HIST_X0 + 0.03, 0.09, midZ], mat: woodDark });
  box(ctx, W, 0.18, 0.05, { parent: root, pos: [midX, 0.09, HIST_Z0 + 0.03], mat: woodDark });
  box(ctx, W, 0.18, 0.05, { parent: root, pos: [midX, 0.09, HIST_Z1 - 0.03], mat: woodDark });

  // sign over the entrance (inside)
  const sign = canvasTexture(ctx, 640, 128, (g) => {
    g.fillStyle = "#1b1410";
    g.fillRect(0, 0, 640, 128);
    g.fillStyle = "#e6c568";
    g.font = "bold 58px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("E X P E R I E N C E   H A L L", 320, 66);
  });
  const sg = group(ctx, { parent: root, pos: [HIST_X1 - 0.02, 2.75, 20], rot: [0, -Math.PI / 2, 0] });
  box(ctx, 2.0, 0.4, 0.05, { parent: sg, mat: gold });
  plane(ctx, 1.9, 0.35, { parent: sg, pos: [0, 0, 0.03], mat: unlit(ctx, { map: sign, opaque: true, fog: false, double: true }) });

  // ---- experience placards in ornate frames
  const B = 0.14;
  const fw = 2.3;
  const fh = fw * 0.64;
  const frame = (pos: [number, number, number], yaw: number, job: Job, stand: [number, number]) => {
    const f = group(ctx, { parent: root, pos, rot: [0, yaw, 0] });
    box(ctx, fw + B * 2, B, 0.12, { parent: f, pos: [0, (fh + B) / 2, 0], cast: true, mat: gold });
    box(ctx, fw + B * 2, B, 0.12, { parent: f, pos: [0, -(fh + B) / 2, 0], cast: true, mat: gold });
    box(ctx, B, fh, 0.12, { parent: f, pos: [(fw + B) / 2, 0, 0], cast: true, mat: gold });
    box(ctx, B, fh, 0.12, { parent: f, pos: [-(fw + B) / 2, 0, 0], cast: true, mat: gold });
    box(ctx, fw + 0.04, fh + 0.04, 0.03, { parent: f, pos: [0, 0, -0.03], mat: woodDark });
    plane(ctx, fw, fh, { parent: f, pos: [0, 0, 0.001], mat: unlit(ctx, { map: banner(ctx, job), opaque: true, fog: false, double: true }) });
    box(ctx, 0.6, 0.04, 0.16, { parent: f, pos: [0, (fh + B) / 2 + 0.16, 0.1], mat: lit(ctx, { color: "#222", metal: 0.8, rough: 0.3 }) });
    box(ctx, 0.54, 0.02, 0.06, { parent: f, pos: [0, (fh + B) / 2 + 0.135, 0.15], mat: lit(ctx, { color: "#fff6dc", emissive: "#fff0c0", ei: 2.4 }) });
    add({
      pos: stand,
      radius: 2.4,
      info: { title: job.company, subtitle: `${job.role} · ${job.type} · ${job.dates}`, lines: job.lines, tags: job.tags },
    });
  };
  const WX = HIST_X0 + 0.1;
  const y = 1.95;
  frame([WX, y, 18.5], Math.PI / 2, JOBS[0], [WX + 1.7, 18.5]);
  frame([WX, y, 21.0], Math.PI / 2, JOBS[1], [WX + 1.7, 21.0]);
  frame([WX, y, 23.5], Math.PI / 2, JOBS[2], [WX + 1.7, 23.5]);
  frame([-6.8, y, HIST_Z1 - 0.1], Math.PI, JOBS[3], [-6.8, HIST_Z1 - 1.7]);
  frame([-3.4, y, HIST_Z1 - 0.1], Math.PI, JOBS[4], [-3.4, HIST_Z1 - 1.7]);

  // ---- historical pieces on stone plinths (real models, loaded when you approach)
  const lazy: (() => void)[] = [];
  const plinth = (x: number, z: number, h: number, w = 0.9) => {
    box(ctx, w, h, w, { parent: root, pos: [x, h / 2, z], cast: true, mat: stone });
    box(ctx, w + 0.12, 0.07, w + 0.12, { parent: root, pos: [x, h + 0.035, z], mat: stone });
    box(ctx, w + 0.12, 0.07, w + 0.12, { parent: root, pos: [x, 0.035, z], mat: stone });
    colliders.push({ x, z, hx: w / 2 + 0.06, hz: w / 2 + 0.06 });
    return h + 0.07;
  };
  const piece = (file: string, x: number, z: number, h: number, size: number, yaw: number, info: ExhibitInfo) => {
    const top = plinth(x, z, h);
    add({ pos: [x + 1.5, z], radius: 2.1, info });
    lazy.push(() => {
      instantiateFit(ctx, file, root, { pos: [x, top, z], size, yaw }).catch((e) => console.error(file, e));
    });
  };
  piece("steampunk.glb", -2.6, 18.8, 0.75, 0.75, 0.7, {
    title: "Antique camera",
    subtitle: "Historical exhibit · Photography",
    lines: ["A steampunk-style camera inspired by Victorian-era photographic equipment.", "Photography emerged in the 19th century — the beginning of today's imaging technology."],
  });
  piece("nemetona.glb", -2.6, 23.0, 0.8, 1.1, 0.4, {
    title: "Statue of Nemetona",
    subtitle: "Historical exhibit · Celtic mythology",
    lines: ["Nemetona — the Celtic goddess of sacred groves and sanctuaries.", "One of the vivid symbols of ancient European culture."],
  });
  // cannon on a low wooden deck
  box(ctx, 1.7, 0.16, 1.1, { parent: root, pos: [-5.2, 0.08, 21], cast: true, mat: woodDark });
  colliders.push({ x: -5.2, z: 21, hx: 0.9, hz: 0.6 });
  add({
    pos: [-5.2, 22.6],
    radius: 2.0,
    info: {
      title: "Ship's cannon",
      subtitle: "Historical exhibit · Naval history",
      lines: ["A naval cannon from the age of sail (17th–18th centuries).", "For centuries the main weapon of fleets and pirates alike."],
    },
  });
  lazy.push(() => {
    instantiateFit(ctx, "cannon.glb", root, { pos: [-5.2, 0.16, 21], size: 1.4, yaw: Math.PI / 2 }).catch((e) => console.error("cannon", e));
  });

  // a timeline stripe on the floor with dates
  const years = ["2023", "2024", "2025", "2026"];
  years.forEach((yr, i) => {
    const t = canvasTexture(ctx, 256, 96, (g) => {
      g.fillStyle = "rgba(0,0,0,0)";
      g.clearRect(0, 0, 256, 96);
      g.fillStyle = "#e6c568";
      g.font = "bold 72px Georgia, serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(yr, 128, 50);
    });
    const p = plane(ctx, 0.9, 0.34, { parent: root, pos: [-8.6 + i * 1.0, 0.02, 25.0], rot: [-Math.PI / 2, 0, 0], mat: unlit(ctx, { map: t, opacity: 0.9, double: true }) });
    p.isPickable = false;
  });
  box(ctx, 4.0, 0.01, 0.06, { parent: root, pos: [-7.0, 0.018, 24.75], mat: lit(ctx, { color: "#c9a24a", emissive: "#c9a24a", ei: 0.8 }) });

  for (const [lx, lz] of [[-7.5, 18.8], [-7.5, 23.2], [-4.2, 21], [-0.9, 21]]) addPendant(ctx, root, lx, lz, ROOM_H, "#ffdca8", 11, 11);

  lazy.forEach((f) => ctx.defer(f));

  return { colliders, root };
}
