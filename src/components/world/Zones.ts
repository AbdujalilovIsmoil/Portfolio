import { ABOUT, ACHIEVEMENTS, CONTACT, EDUCATION, JOBS, PROFILE, SKILL_GROUPS, TECHS, TESTIMONIALS, WORKS } from "./content";
import type { ExhibitInfo } from "./exhibitSignal";
import { TILE, TRACK, nearLoop, sampleAt } from "./Track";

/**
 * What you read while you drive (pure data — tested in tests/track.test.ts): one billboard per piece
 * of content, spread evenly round the lap, and its card on screen only while you are at that
 * billboard — from just before it until just past it. In between, nothing covers the view.
 */

export type District = "about" | "experience" | "projects" | "skills" | "testimonials" | "achievements" | "education" | "contact";

export const DISTRICT_COLORS: Record<District, string> = {
  about: "#a99bff",
  experience: "#f0c35a",
  projects: "#39d0ff",
  skills: "#5ee08a",
  testimonials: "#ff7ab8",
  achievements: "#ff9f43",
  education: "#b388ff",
  contact: "#7c9bff",
};
export const DISTRICT_LABELS: Record<District, string> = {
  about: "About me",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  testimonials: "Testimonials",
  achievements: "Achievements",
  education: "Education",
  contact: "Contact",
};

export interface Zone {
  id: string;
  district: District;
  /** which entry of that district's content */
  index: number;
  info: ExhibitInfo;
  /** its place in the list (1-based), for the card's counter */
  n: number;
  /** the card shows from here (metres along the lap, wrapped) … */
  from: number;
  /** … the billboard stands beside the track here … */
  s: number;
  /** … and the card goes again here */
  to: number;
  /** the billboard's centre, and the way its face looks (yaw: 0 = +z) */
  board: { x: number; z: number; yaw: number };
}

// ---------------------------------------------------------------- the main straight

/** Where the start straight ends: the first bend of the track being driven. */
export function mainStraightEnd() {
  const bend = TRACK.pieces.find((p) => /^[RLH]/.test(p.cmd));
  return bend ? bend.s0 : TRACK.length;
}

/** Ground kept clear: the grandstands (and the tents behind them) along the left of the start straight, and round the loop. */
export function reserved(x: number, z: number) {
  const q0 = sampleAt(0);
  const along = (x - q0.x) * Math.sin(q0.heading) + (z - q0.z) * Math.cos(q0.heading);
  const left = (x - q0.x) * Math.cos(q0.heading) - (z - q0.z) * Math.sin(q0.heading);
  if (along > -12 && along < mainStraightEnd() + 12 && left > 0 && left < 70) return true;
  return nearLoop(x, z);
}

/** The card shows from this far before its billboard until this far past it. */
const BEFORE = 22;
const AFTER = 28;
/** Billboard centre's distance from the centre line: past the tile's verge. */
const OFFSET = 0.5 * TILE + 8;

const cut = (lines: string[], n = 3) => lines.slice(0, n);

function contentList(): Omit<Zone, "from" | "s" | "to" | "board" | "n">[] {
  return [
    { id: "about", district: "about", index: 0, info: { title: PROFILE.name, subtitle: PROFILE.role, lines: cut(ABOUT.lines), tags: ABOUT.tags, link: PROFILE.website } },
    ...JOBS.map((j, i) => ({ id: `job-${i}`, district: "experience" as const, index: i, info: { title: j.company, subtitle: `${j.role} · ${j.type} · ${j.dates}`, lines: j.points, tags: j.tags } })),
    ...WORKS.map((w, i) => ({ id: `work-${i}`, district: "projects" as const, index: i, info: { title: w.title, subtitle: w.subtitle, lines: w.lines, tags: w.tags, link: w.link } })),
    ...SKILL_GROUPS.map((g, i) => ({
      id: `skills-${i}`,
      district: "skills" as const,
      index: i,
      info: {
        title: g.title,
        subtitle: g.subtitle,
        lines: g.names.map((n) => `${n} — ${TECHS.find((t) => t.name === n)?.lines[0] ?? ""}`).slice(0, 4),
        tags: g.names,
      },
    })),
    ...TESTIMONIALS.map((t, i) => ({ id: `testimonial-${i}`, district: "testimonials" as const, index: i, info: { title: t.name, subtitle: `${t.role} · ${t.project}`, lines: [`“${t.quote}”`], tags: ["Recommendation letter"] } })),
    ...ACHIEVEMENTS.map((a, i) => ({ id: `achievement-${i}`, district: "achievements" as const, index: i, info: { title: `${a.big} ${a.title}`, subtitle: a.subtitle, lines: a.lines, tags: a.tags } })),
    ...EDUCATION.map((e, i) => ({ id: `education-${i}`, district: "education" as const, index: i, info: { title: e.school, subtitle: `${e.program} · ${e.dates}`, lines: e.lines } })),
    { id: "contact", district: "contact", index: 0, info: { title: "Contact", subtitle: "Let's work together", lines: CONTACT.lines, tags: CONTACT.tags } },
  ];
}

/** How sharply the track turns around s (+ right, − left). */
function turnAt(s: number) {
  let d = sampleAt(s + 14).heading - sampleAt(s - 14).heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return -d; // heading grows to the left (towards +x when facing +z)
}

/** Is a point at least `clear` metres from every part of the track more than `skip` metres (along it) from s? */
function clearOfTrack(x: number, z: number, s: number, clear: number, skip = 40) {
  const L = TRACK.length;
  return TRACK.samples.every((q) => {
    const ds = Math.abs(q.s - s);
    if (Math.min(ds, L - ds) < skip) return Math.hypot(q.x - x, q.z - z) > OFFSET - 1;
    return Math.hypot(q.x - x, q.z - z) > clear;
  });
}

function placeZones(): Zone[] {
  const items = contentList();
  const L = TRACK.length;
  const step = L / items.length;
  // the first billboard (About me) stands just ahead of where the car starts (see startPose)
  const first = TRACK.startS - 0.8 * TILE + 6;
  let side = 1;
  return items.map((it, i) => {
    const s = (first + i * step) % L;
    const turn = turnAt(s);
    // on a bend, the outside; on a straight, alternate
    const prefer: 1 | -1 = Math.abs(turn) > 0.25 ? (turn > 0 ? -1 : 1) : (side = -side as 1 | -1);
    // the first clear spot: right here, else a little further along or back (hairpins are tight)
    let board: Zone["board"] | null = null;
    let at = s;
    search: for (const ds of [0, 8, -8, 16, -16, 24, -24, 32, -32, 44, -44])
      for (const sd of [prefer, -prefer as 1 | -1])
        for (const extra of [0, 4, 8]) {
          const q = sampleAt(s + ds);
          // left of the heading is +x when facing +z: (cos h, −sin h)
          const x = q.x + Math.cos(q.heading) * sd * (OFFSET + extra);
          const z = q.z - Math.sin(q.heading) * sd * (OFFSET + extra);
          if (!clearOfTrack(x, z, s + ds, OFFSET + 2) || reserved(x, z)) continue;
          // face back down the road towards the cars coming, turned 25° in towards the road
          // (yaw grows towards +x, which is the left: a board on the left turns that way)
          board = { x, z, yaw: q.heading + Math.PI + (sd * 25 * Math.PI) / 180 };
          at = (s + ds + L) % L;
          break search;
        }
    if (!board) throw new Error(`no room for the ${it.id} billboard`);
    return { ...it, n: i + 1, s: at, from: (at - BEFORE + L) % L, to: (at + AFTER) % L, board };
  });
}

/** The billboards round the Grand Circuit (placed once, when first asked for). */
let placed: { track: object; zones: Zone[] } | null = null;
export function getZones(): Zone[] {
  if (!placed || placed.track !== TRACK) placed = { track: TRACK, zones: placeZones() };
  return placed.zones;
}

/** The billboard you are at, at distance s along the lap (null between them), and how far through its stretch you are (0–1). */
export function zoneAt(s: number): { zone: Zone; k: number } | null {
  const L = TRACK.length;
  let best: { zone: Zone; k: number } | null = null;
  let bestD = Infinity;
  for (const z of getZones()) {
    const d = (s - z.from + L) % L; // how far past where its card starts
    if (d <= BEFORE + AFTER && d < bestD) {
      bestD = d;
      best = { zone: z, k: d / (BEFORE + AFTER) };
    }
  }
  return best;
}
