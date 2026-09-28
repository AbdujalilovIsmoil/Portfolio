import type { Node } from "@babylonjs/core";
import { CITY_Y } from "./Stairs";
import { box, canvasTexture, cylinder, group, lit, plane, type Ctx } from "./core";

type AdDraw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/** A handful of generic, non-branded ad designs — bold colour, a simple mark,
 * short punchy copy — the visual language of roadside billboards without
 * imitating any real company. */
const ADS: AdDraw[] = [
  (g, w, h) => {
    g.fillStyle = "#0f6b4f";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(w * 0.16, h * 0.5, h * 0.28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#0f6b4f";
    g.font = `bold ${h * 0.32}px sans-serif`;
    g.fillText("N", w * 0.16 - h * 0.1, h * 0.62);
    g.fillStyle = "#ffffff";
    g.font = `bold ${h * 0.22}px sans-serif`;
    g.fillText("NOVA MOBILE", w * 0.34, h * 0.44);
    g.font = `${h * 0.12}px sans-serif`;
    g.fillStyle = "#bfe9d8";
    g.fillText("5G tezligida yashang", w * 0.34, h * 0.66);
  },
  (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, "#ff7a00");
    grd.addColorStop(1, "#ffb703");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#1a1200";
    g.font = `bold ${h * 0.3}px sans-serif`;
    g.fillText("CHORSU", w * 0.08, h * 0.45);
    g.font = `bold ${h * 0.16}px sans-serif`;
    g.fillText("BOZOR", w * 0.08, h * 0.68);
    g.strokeStyle = "#1a1200";
    g.lineWidth = h * 0.02;
    g.strokeRect(w * 0.7, h * 0.25, w * 0.22, h * 0.5);
  },
  (g, w, h) => {
    g.fillStyle = "#101820";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#4fd1ff";
    g.font = `bold ${h * 0.34}px sans-serif`;
    g.fillText("IT PARK", w * 0.1, h * 0.45);
    g.fillStyle = "#e8f9ff";
    g.font = `${h * 0.14}px sans-serif`;
    g.fillText("Toshkent Texnopark", w * 0.1, h * 0.66);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? "#4fd1ff" : "#0f6b8f";
      g.fillRect(w * 0.72 + i * (w * 0.045), h * 0.3, w * 0.03, h * 0.4 - i * h * 0.05);
    }
  },
  (g, w, h) => {
    g.fillStyle = "#c8102e";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(w * 0.12, h * 0.5);
    g.lineTo(w * 0.22, h * 0.3);
    g.lineTo(w * 0.32, h * 0.5);
    g.lineTo(w * 0.22, h * 0.7);
    g.closePath();
    g.fill();
    g.font = `bold ${h * 0.24}px sans-serif`;
    g.fillText("ZAMON", w * 0.4, h * 0.44);
    g.font = `bold ${h * 0.24}px sans-serif`;
    g.fillText("BANK", w * 0.4, h * 0.68);
  },
  (g, w, h) => {
    g.fillStyle = "#f4f1e8";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#1eb53a";
    g.fillRect(0, 0, w, h * 0.08);
    g.fillStyle = "#0099b5";
    g.fillRect(0, h * 0.08, w, h * 0.08);
    g.fillStyle = "#c8102e";
    g.fillRect(0, h * 0.92, w, h * 0.08);
    g.fillStyle = "#1a1a1a";
    g.font = `bold ${h * 0.24}px sans-serif`;
    g.textAlign = "center";
    g.fillText("XUSH KELIBSIZ", w / 2, h * 0.48);
    g.font = `${h * 0.14}px sans-serif`;
    g.fillText("TOSHKENT SHAHRIGA", w / 2, h * 0.68);
    g.textAlign = "left";
  },
  (g, w, h) => {
    g.fillStyle = "#1a0e2b";
    g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, "#ff3fa4");
    grd.addColorStop(1, "#7c4dff");
    g.fillStyle = grd;
    g.font = `bold ${h * 0.3}px sans-serif`;
    g.fillText("OSIYO", w * 0.1, h * 0.5);
    g.fillStyle = "#e8dcff";
    g.font = `${h * 0.15}px sans-serif`;
    g.fillText("Moda Markazi", w * 0.1, h * 0.7);
  },
];

function adTexture(ctx: Ctx, i: number) {
  return canvasTexture(ctx, 512, 256, (g) => ADS[i % ADS.length](g, 512, 256));
}

/** A steel-post roadside billboard with a self-lit ad panel. */
function buildBillboard(ctx: Ctx, parent: Node, x: number, z: number, yaw: number, i: number) {
  const root = group(ctx, { parent, pos: [x, CITY_Y, z], rot: [0, yaw, 0] });
  const steel = lit(ctx, { color: "#3a3d42", rough: 0.5, metal: 0.6 });
  const panelH = 4.2;
  const panelW = 7.4;
  const postY = 4.5;
  cylinder(ctx, 0.16, 0.16, postY * 2, 10, { parent: root, pos: [-panelW / 2 + 0.6, postY, 0], mat: steel });
  cylinder(ctx, 0.16, 0.16, postY * 2, 10, { parent: root, pos: [panelW / 2 - 0.6, postY, 0], mat: steel });
  const postOffset = panelW / 2 - 0.6;
  for (const s of [-1, 1]) {
    ctx.colliders.push({ x: x + s * postOffset * Math.cos(yaw), z: z + s * postOffset * Math.sin(yaw), hx: 0.2, hz: 0.2 });
  }
  box(ctx, panelW + 0.3, 0.25, 0.3, { parent: root, pos: [0, postY * 2 - panelH / 2 - 0.1, 0], mat: steel });
  // A backing box, plus a single-sided textured plane facing each direction — a textured
  // *box* shows the same UVs mirrored on its rear face, which is what made the ad copy
  // read backwards from one side; two independent planes each read correctly.
  box(ctx, panelW, panelH, 0.1, { parent: root, pos: [0, postY * 2, 0], mat: steel });
  const face = lit(ctx, { emissive: "#ffffff", ei: 1.1, rough: 0.6 });
  face.emissiveTexture = adTexture(ctx, i);
  face.albedoColor.set(0.05, 0.05, 0.05);
  plane(ctx, panelW, panelH, { parent: root, pos: [0, postY * 2, 0.09], mat: face });
  plane(ctx, panelW, panelH, { parent: root, pos: [0, postY * 2, -0.09], rot: [0, Math.PI, 0], mat: face });
  // a small floodlight strip along the top, aimed down at the panel
  box(ctx, panelW * 0.7, 0.08, 0.08, { parent: root, pos: [0, postY * 2 + panelH / 2 + 0.15, 0.3], mat: lit(ctx, { color: "#111", emissive: "#fff6d8", ei: 0.6 }) });
  return root;
}

/** Roadside billboards along the main road and the avenue — the "reklamalar"
 * that make the street feel like a real city corridor rather than a diorama. */
export function buildBillboards(ctx: Ctx, parent: Node) {
  const root = group(ctx, { parent });
  // Kept to the two sidewalk strips flanking the main road (z 50.6-56 and 66-72), which
  // are always clear of the hash-randomized buildings further down — the avenue's own
  // building depths are randomized per block, so anything placed along it risks clipping.
  const spots: [number, number, number][] = [
    [-40, 54.6, 0],
    [-24, 54.2, 0],
    [58, 54.4, 0],
    [-18, 68.2, 0],
    [8, 68.4, 0],
    [46, 68, 0],
  ];
  spots.forEach(([x, z, yaw], i) => buildBillboard(ctx, root, x, z, yaw, i));
  return root;
}
