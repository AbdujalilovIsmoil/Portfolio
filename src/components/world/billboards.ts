import type { DynamicTexture } from "@babylonjs/core";
import { canvasTexture, type Ctx } from "./core";
import { ABOUT, CONTACT, PROFILE, TECHS, type Achievement, type Education, type Job, type Tech, type Testimonial, type Work } from "./content";
import { DISTRICT_COLORS, DISTRICT_LABELS, type District } from "./Zones";

/** Every big billboard is painted on a 1024 × 640 canvas (its 3D panel is 7 × 4.375 m). */
export const BOARD_W = 1024;
export const BOARD_H = 640;
const W = BOARD_W;
const H = BOARD_H;
const SANS = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const GOLD = "#f0d078";

type G = CanvasRenderingContext2D;

// ------------------------------------------------------------------------ helpers

/** Writes `text` word-wrapped into maxW; returns the y below the last line. */
function wrap(g: G, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 99) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > maxW && line) {
      if (++lines >= maxLines) {
        g.fillText(line + " …", x, y);
        return y + lh;
      }
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  g.fillText(line, x, y);
  return y + lh;
}

/** Sets the largest font (down to `min`) at which `text` fits in maxW. */
function fitFont(g: G, text: string, weight: string, family: string, size: number, maxW: number, min = 24) {
  g.font = `${weight} ${size}px ${family}`;
  while (g.measureText(text).width > maxW && size > min) {
    size -= 3;
    g.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** Dark-to-colour gradient background with the gold double border every board shares. */
function backdrop(g: G, color: string) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1020");
  bg.addColorStop(1, color);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(240,208,120,0.85)";
  g.lineWidth = 5;
  g.strokeRect(20, 20, W - 40, H - 40);
  g.strokeStyle = "rgba(240,208,120,0.3)";
  g.lineWidth = 2;
  g.strokeRect(33, 33, W - 66, H - 66);
}

/** The district label in the top-left corner, in the district's colour. */
function label(g: G, district: District, extra = "") {
  const text = (DISTRICT_LABELS[district] + (extra ? "  ·  " + extra : "")).toUpperCase();
  g.font = `800 24px ${SANS}`;
  const w = g.measureText(text).width + 36;
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath();
  g.roundRect(56, 52, w, 44, 22);
  g.fill();
  g.strokeStyle = DISTRICT_COLORS[district];
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = DISTRICT_COLORS[district];
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillText(text, 74, 75);
  g.textBaseline = "alphabetic";
}

/** A row of rounded tag chips; returns nothing (stops at the right edge). */
function chips(g: G, tags: string[], x: number, y: number, maxX = W - 60) {
  g.font = `600 22px ${SANS}`;
  g.textAlign = "left";
  for (const t of tags) {
    const w = g.measureText(t).width + 30;
    if (x + w > maxX) break;
    g.fillStyle = "rgba(255,255,255,0.14)";
    g.beginPath();
    g.roundRect(x, y, w, 40, 20);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(t, x + 15, y + 28);
    x += w + 12;
  }
}

/** The site's address in the bottom-right corner. */
function hint(g: G, text = PROFILE.website.toUpperCase()) {
  g.font = `700 20px ${SANS}`;
  g.textAlign = "right";
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.fillText(text, W - 58, H - 50);
  g.textAlign = "left";
}

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

/** Draws `img` to cover the box (centre-cropped). */
function cover(g: G, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * A billboard texture. `draw` runs at once (with no image) and again once `image` has loaded,
 * so the board is never blank while the picture downloads.
 */
function board(ctx: Ctx, draw: (g: G, img: HTMLImageElement | null) => void, image?: string, w = W, h = H): DynamicTexture {
  const tex = canvasTexture(ctx, w, h, (g) => draw(g, null));
  tex.hasAlpha = false;
  if (image)
    loadImage(image)
      .then((img) => {
        const g = tex.getContext() as G;
        g.clearRect(0, 0, w, h);
        draw(g, img);
        tex.update(true);
      })
      .catch(() => {});
  return tex;
}

// ------------------------------------------------------------------------ boards

export function aboutBoard(ctx: Ctx) {
  return board(
    ctx,
    (g, img) => {
      backdrop(g, "#24306a");
      label(g, "about", "start here");
      // portrait
      const px = 64, py = 124, pw = 300, ph = 400;
      g.save();
      g.beginPath();
      g.roundRect(px, py, pw, ph, 18);
      g.clip();
      if (img) cover(g, img, px, py, pw, ph);
      else {
        g.fillStyle = "rgba(255,255,255,0.08)";
        g.fillRect(px, py, pw, ph);
      }
      g.restore();
      g.strokeStyle = GOLD;
      g.lineWidth = 4;
      g.beginPath();
      g.roundRect(px, py, pw, ph, 18);
      g.stroke();
      // text
      const tx = 400;
      g.textAlign = "left";
      g.fillStyle = "#ffffff";
      fitFont(g, PROFILE.name, "800", SERIF, 70, W - tx - 60);
      g.fillText(PROFILE.name, tx, 190);
      g.fillStyle = GOLD;
      g.font = `700 34px ${SANS}`;
      g.fillText(PROFILE.role, tx, 238);
      g.fillStyle = "#dfe6f7";
      g.font = `27px ${SANS}`;
      let y = 292;
      for (const l of ABOUT.lines.slice(0, 2)) y = wrap(g, l, tx, y, W - tx - 70, 34, 3) + 10;
      chips(g, ABOUT.tags, tx, H - 112);
      hint(g);
    },
    PROFILE.photo
  );
}

export function jobBoard(ctx: Ctx, j: Job) {
  return board(ctx, (g) => {
    backdrop(g, j.color);
    label(g, "experience", j.type);
    // the year, big, top-right
    g.textAlign = "right";
    g.fillStyle = GOLD;
    g.font = `800 86px ${SERIF}`;
    g.fillText(j.year, W - 60, 128);
    g.textAlign = "left";
    g.fillStyle = "#ffffff";
    fitFont(g, j.company, "800", SERIF, 76, W - 120 - 260);
    g.fillText(j.company, 60, 190);
    g.fillStyle = GOLD;
    g.font = `700 34px ${SANS}`;
    g.fillText(j.role, 60, 240);
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.font = `600 26px ${SANS}`;
    g.fillText(j.dates, 60, 282);
    g.fillStyle = "rgba(240,208,120,0.6)";
    g.fillRect(60, 306, 220, 3);
    g.font = `27px ${SANS}`;
    let y = 356;
    for (const p of j.points) {
      g.fillStyle = GOLD;
      g.fillText("◆", 64, y);
      g.fillStyle = "#e9eefc";
      y = wrap(g, p, 102, y, W - 170, 33, 2) + 8;
    }
    chips(g, j.tags, 60, H - 110);
  });
}

export function workBoard(ctx: Ctx, w: Work) {
  return board(
    ctx,
    (g, img) => {
      backdrop(g, w.color);
      // the screenshot fills the top of the board
      const ix = 44, iy = 44, iw = W - 88, ih = 392;
      g.save();
      g.beginPath();
      g.roundRect(ix, iy, iw, ih, 14);
      g.clip();
      if (img) cover(g, img, ix, iy, iw, ih);
      else {
        g.fillStyle = "rgba(255,255,255,0.06)";
        g.fillRect(ix, iy, iw, ih);
      }
      g.restore();
      label(g, "projects", w.kind);
      g.textAlign = "left";
      g.fillStyle = "#ffffff";
      fitFont(g, w.title, "800", SERIF, 62, W - 480);
      g.fillText(w.title, 60, 512);
      g.fillStyle = "#7fe3ff";
      g.font = `700 28px ${SANS}`;
      g.fillText("🔗 " + w.link, 62, 556);
      chips(g, w.tags, 560, 486);
      hint(g);
    },
    w.image
  );
}

export function testimonialBoard(ctx: Ctx, t: Testimonial) {
  return board(
    ctx,
    (g, img) => {
      backdrop(g, t.color);
      label(g, "testimonials", t.project);
      // photo
      const cx = 210, cy = 300, r = 132;
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.clip();
      if (img) cover(g, img, cx - r, cy - r, r * 2, r * 2);
      else {
        g.fillStyle = "rgba(255,255,255,0.08)";
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      g.restore();
      g.strokeStyle = GOLD;
      g.lineWidth = 5;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      g.textAlign = "center";
      g.fillStyle = "#ffffff";
      fitFont(g, t.name, "800", SANS, 30, 330);
      g.fillText(t.name, cx, 480);
      g.fillStyle = "rgba(255,255,255,0.72)";
      fitFont(g, t.role, "500", SANS, 22, 340, 14);
      g.fillText(t.role, cx, 514);
      // the quote
      g.textAlign = "left";
      g.fillStyle = "rgba(240,208,120,0.9)";
      g.font = `800 150px ${SERIF}`;
      g.fillText("“", 400, 230);
      g.fillStyle = "#f2f5ff";
      g.font = `italic 38px ${SERIF}`;
      wrap(g, t.quote, 420, 230, W - 480, 50, 6);
      hint(g);
    },
    t.photo
  );
}

export function achievementBoard(ctx: Ctx, a: Achievement) {
  return board(ctx, (g) => {
    backdrop(g, a.color);
    label(g, "achievements");
    g.textAlign = "center";
    g.font = `150px ${SANS}`;
    g.fillText(a.icon, 230, 360);
    g.textAlign = "left";
    g.fillStyle = GOLD;
    fitFont(g, a.big, "800", SERIF, 190, 520);
    g.fillText(a.big, 420, 330);
    g.fillStyle = "#ffffff";
    fitFont(g, a.title, "800", SANS, 58, W - 480);
    g.fillText(a.title, 424, 410);
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.font = `28px ${SANS}`;
    wrap(g, a.sub, 426, 460, W - 490, 36, 2);
    chips(g, a.tags, 60, H - 110);
    hint(g);
  });
}

export function educationBoard(ctx: Ctx, e: Education) {
  return board(ctx, (g) => {
    backdrop(g, e.color);
    label(g, "education");
    g.textAlign = "right";
    g.font = `110px ${SANS}`;
    g.fillText("🎓", W - 60, 160);
    g.textAlign = "left";
    g.fillStyle = "#ffffff";
    fitFont(g, e.school, "800", SERIF, 76, W - 300);
    g.fillText(e.school, 60, 200);
    g.fillStyle = GOLD;
    g.font = `700 34px ${SANS}`;
    g.fillText(e.program, 60, 250);
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.font = `600 26px ${SANS}`;
    g.fillText(e.dates, 60, 292);
    g.fillStyle = "#e9eefc";
    g.font = `27px ${SANS}`;
    let y = 358;
    for (const l of e.lines) y = wrap(g, l, 60, y, W - 130, 34, 3) + 10;
    hint(g);
  });
}

export function contactBoard(ctx: Ctx) {
  return board(ctx, (g) => {
    backdrop(g, "#1d3c8a");
    label(g, "contact");
    g.textAlign = "left";
    g.fillStyle = "#ffffff";
    g.font = `800 80px ${SERIF}`;
    g.fillText("Let's work together", 60, 200);
    const icons = ["🐙", "💼", "✈️", "✉️", "🌐"];
    g.font = `30px ${SANS}`;
    CONTACT.lines.forEach((l, i) => {
      g.fillStyle = "#ffffff";
      g.fillText(icons[i] ?? "•", 64, 272 + i * 56);
      g.fillStyle = "#dfe8ff";
      g.fillText(l, 120, 272 + i * 56);
    });
    hint(g);
  });
}

/** A technology's logo in an s×s square at (x, y). */
function drawLogo(g: G, t: Tech, x: number, y: number, size: number) {
  g.save();
  g.translate(x, y);
  g.fillStyle = t.bg;
  g.beginPath();
  g.roundRect(0, 0, size, size, size * 0.16);
  g.fill();
  if (t.draw) {
    g.save();
    t.draw(g, size);
    g.restore();
  }
  if (t.glyph) {
    g.fillStyle = t.fg;
    g.textAlign = "center";
    g.textBaseline = "middle";
    fitFont(g, t.glyph, "800", SANS, size * 0.56, size * 0.8, 12);
    g.fillText(t.glyph, size / 2, size / 2 + size * 0.03);
    g.textBaseline = "alphabetic";
  }
  g.restore();
}

/** A group of technologies: their logos in a row (two rows for six) with the names under them. */
export function skillsBoard(ctx: Ctx, group: { title: string; subtitle: string; names: string[] }) {
  return board(ctx, (g) => {
    backdrop(g, "#173d2b");
    label(g, "skills", group.title);
    const techs = group.names.map((n) => TECHS.find((t) => t.name === n)!).filter(Boolean);
    const perRow = techs.length > 4 ? 3 : techs.length;
    const rows = Math.ceil(techs.length / perRow);
    const size = rows > 1 ? 120 : 170;
    const gapX = (W - 120) / perRow;
    techs.forEach((t, i) => {
      const r = Math.floor(i / perRow), c = i % perRow;
      const cx = 60 + gapX * (c + 0.5);
      const top = rows > 1 ? 130 + r * 230 : 170;
      drawLogo(g, t, cx - size / 2, top, size);
      g.fillStyle = "#ffffff";
      g.textAlign = "center";
      fitFont(g, t.name, "800", SANS, 30, gapX - 20, 16);
      g.fillText(t.name, cx, top + size + 42);
      g.fillStyle = "rgba(255,255,255,0.6)";
      g.font = `600 20px ${SANS}`;
      g.fillText(t.group.toUpperCase(), cx, top + size + 72);
    });
    g.textAlign = "left";
  });
}
