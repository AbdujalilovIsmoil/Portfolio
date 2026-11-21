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
  speedway: { id: "speedway", name: "Speedway", blurb: "A fast oval: under the aquarium, through a tunnel, right-left-left-right up on the hill", layout: "S S S GRID START S S SUB S R3 R3 TUN S UP R2 L2 L2 R2 DN R3 R3".split(" ") },
  valley: { id: "valley", name: "Hairpin Valley", blurb: "Straight under the aquarium, three hairpins, a tunnel and an S-bend on a hilltop", layout: "S S S GRID START SUB S S HR S S TUN S S S S HL S S S S S HR UP L2 R2 R2 L2 DN S R3 S R3 S S".split(" ") },
  mountain: {
    id: "mountain",
    name: "Loop Mountain",
    blurb: "The aquarium, a loop-the-loop, a tunnel and a chicane on top of the second hill",
    layout: "S S S GRID START SUB S S UP BR DN S R3 S S S S LOOP S S R3 S TUN S S UP R2 L2 L2 R2 DN S S S S R3 S S S S S S S S R3".split(" "),
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
  { id: "gates", title: "First Gates", brief: "Drive through all 14 gates, in order — including the S-bend on the hill — before the clock runs out.", track: "speedway", kind: "gates", time: 50, target: 14, icon: "🚩" },
  { id: "coins", title: "Coin Rush", brief: "Collect 30 coins scattered round the valley — some on the hilltop bends.", track: "valley", kind: "coins", time: 90, target: 30, icon: "🪙" },
  { id: "hotlap", title: "Hot Lap", brief: "One lap of the Grand Circuit in under 0:42 — you'll need the nitro.", track: "circuit", kind: "hotlap", time: 42, target: 1, icon: "⏱️" },
  { id: "clean", title: "Clean Sheet", brief: "Two laps without touching a single wall — the chicane on the hill included.", track: "speedway", kind: "clean", time: 110, target: 2, icon: "🧼" },
  { id: "slalom", title: "Slalom", brief: "Thread all 12 cone gates through their middle — miss one and it's over.", track: "mountain", kind: "slalom", time: 95, target: 12, icon: "🔶" },
  { id: "smash", title: "Demolition", brief: "Smash 22 crates left on the road.", track: "valley", kind: "smash", time: 90, target: 22, icon: "📦" },
  { id: "drift", title: "Drift King", brief: "Score 9000 drift points — hit a wall and you lose the drift you're in.", track: "valley", kind: "drift", time: 110, target: 9000, icon: "💨" },
  { id: "speed", title: "Top Speed", brief: "Hit 280 km/h — keep the nitro lit through the bends; the blue pads help.", track: "speedway", kind: "speed", time: 50, target: 280, icon: "🚀" },
  { id: "loops", title: "Loop Master", brief: "Go round the loop-the-loop 4 times.", track: "mountain", kind: "loops", time: 240, target: 4, icon: "➰" },
  { id: "duel", title: "The Rival", brief: "Beat a fast rival to the line over two laps of the Grand Circuit.", track: "circuit", kind: "duel", time: 240, target: 1, icon: "🏁" },
  { id: "parking", title: "Parking Pro", brief: "Stop dead, straight, inside 4 tight bays, one after another.", track: "mountain", kind: "parking", time: 160, target: 4, icon: "🅿️" },
  { id: "courier", title: "Courier", brief: "Pick up 5 parcels and drop each one where it has to go.", track: "circuit", kind: "courier", time: 150, target: 5, icon: "📮" },
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
