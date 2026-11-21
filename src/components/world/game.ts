import { LAYOUT } from "./Track";

/**
 * The game round the portfolio (pure data — tested in tests/game.test.ts): three ways to play, the
 * tracks, and the twelve missions.
 *
 *  - free: the Grand Circuit with the portfolio on its billboards (the cards come up at each one);
 *  - race: three laps against three rivals, on any of the tracks — no billboards;
 *  - mission: twelve challenges on the different tracks — no billboards either.
 */
export type Mode = "free" | "race" | "mission";

export type TrackId = "circuit" | "speedway" | "valley" | "mountain";

export interface TrackDef {
  id: TrackId;
  name: string;
  blurb: string;
  /** turtle commands (see Track.ts) */
  layout: string[];
}

export const TRACKS: Record<TrackId, TrackDef> = {
  circuit: { id: "circuit", name: "Grand Circuit", blurb: "Hairpins, a chicane, two hills and the loop-the-loop", layout: LAYOUT },
  speedway: { id: "speedway", name: "Speedway", blurb: "A fast oval with a hill on the back straight", layout: "S S S GRID START S S S R3 R3 S S UP BR DN S S S R3 R3".split(" ") },
  valley: { id: "valley", name: "Hairpin Valley", blurb: "Three hairpins, then a hill on the long way back", layout: "S S S GRID START S S HR S S S S S HL S S S S S HR S S S UP BR DN S S S R3 S R3 S S".split(" ") },
  mountain: {
    id: "mountain",
    name: "Loop Mountain",
    blurb: "Two hills and a loop-the-loop round a big square",
    layout: "S S S GRID START S S UP BR DN S R3 S S S S LOOP S S R3 S S UP BR BR DN S S S S S S S S R3 S S S S S S S S R3".split(" "),
  },
};

export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];

/** A race is this many laps, against these rivals (the colours their cars are painted). */
export const RACE_LAPS = 3;
export const RIVALS = [
  { name: "Viper", color: "#2f7bff" },
  { name: "Blaze", color: "#b04dff" },
  { name: "Mamba", color: "#2fd07a" },
];

export type MissionKind = "gates" | "coins" | "hotlap" | "clean" | "slalom" | "smash" | "drift" | "speed" | "loops" | "duel" | "parking" | "courier";

export interface MissionDef {
  id: string;
  title: string;
  /** what to do, in one line */
  brief: string;
  track: TrackId;
  kind: MissionKind;
  /** seconds to do it in (for a hot lap: the lap time to beat) */
  time: number;
  /** how many gates / coins / crates / loops / bays / parcels — or the score or the speed (km/h) to reach */
  target: number;
  icon: string;
}

export const MISSIONS: MissionDef[] = [
  { id: "gates", title: "First Gates", brief: "Drive through all 10 gates, in order, before the clock runs out.", track: "speedway", kind: "gates", time: 40, target: 10, icon: "🚩" },
  { id: "coins", title: "Coin Rush", brief: "Collect 20 coins scattered round the valley.", track: "valley", kind: "coins", time: 75, target: 20, icon: "🪙" },
  { id: "hotlap", title: "Hot Lap", brief: "One lap of the Grand Circuit in under 0:50.", track: "circuit", kind: "hotlap", time: 50, target: 1, icon: "⏱️" },
  { id: "clean", title: "Clean Sheet", brief: "A whole lap without touching a single wall.", track: "speedway", kind: "clean", time: 45, target: 1, icon: "🧼" },
  { id: "slalom", title: "Slalom", brief: "Thread all 10 cone gates — miss one and it's over.", track: "speedway", kind: "slalom", time: 90, target: 10, icon: "🔶" },
  { id: "smash", title: "Demolition", brief: "Smash 15 crates left on the road.", track: "valley", kind: "smash", time: 75, target: 15, icon: "📦" },
  { id: "drift", title: "Drift King", brief: "Score 5000 drift points — hold Space to slide through the bends.", track: "valley", kind: "drift", time: 90, target: 5000, icon: "💨" },
  { id: "speed", title: "Top Speed", brief: "Hit 270 km/h — keep the nitro on round the oval; the blue pads help.", track: "speedway", kind: "speed", time: 45, target: 270, icon: "🚀" },
  { id: "loops", title: "Loop Master", brief: "Go round the loop-the-loop 3 times.", track: "mountain", kind: "loops", time: 100, target: 3, icon: "➰" },
  { id: "duel", title: "The Rival", brief: "Beat the rival to the line over one lap of the Grand Circuit.", track: "circuit", kind: "duel", time: 180, target: 1, icon: "🏁" },
  { id: "parking", title: "Parking Pro", brief: "Stop dead inside 3 parking bays, one after another.", track: "mountain", kind: "parking", time: 150, target: 3, icon: "🅿️" },
  { id: "courier", title: "Courier", brief: "Pick up 4 parcels and drop each one where it has to go.", track: "circuit", kind: "courier", time: 150, target: 4, icon: "📮" },
];

export const missionById = (id: string | null | undefined) => MISSIONS.find((m) => m.id === id) ?? null;

/** What is being played: a fresh `key` for every start (the 3D world is rebuilt for it). */
export interface Session {
  mode: Mode;
  track: TrackId;
  mission: string | null;
  key: number;
}

export const FREE_SESSION: Session = { mode: "free", track: "circuit", mission: null, key: 0 };
