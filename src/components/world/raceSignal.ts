/** A race or a mission as the HUD sees it — written by the 3D world every frame (Race.ts, Missions.ts). */
export interface PlaySignal {
  /** "race" | "mission" while one is on; "" in free drive */
  kind: "" | "race" | "mission";
  /** "intro": the camera flies in · "countdown": 3-2-1 · "on": going · "won" / "lost": over */
  state: "intro" | "countdown" | "on" | "won" | "lost";
  /** 3, 2, 1 during the countdown, 0 = GO (shown for a moment) */
  count: number;
  /** seconds since GO */
  time: number;
  /** race: lap (1-based) of `laps`, position of `cars`; mission: progress of `total` */
  lap: number;
  laps: number;
  position: number;
  cars: number;
  bestLap: number | null;
  /** the mission's title and what to do; a short status ("Gate 4 of 10", "Drift ×1.5"…) */
  title: string;
  objective: string;
  progress: number;
  total: number;
  /** seconds left (null: no limit) */
  timeLeft: number | null;
  status: string;
  /** why it ended ("Time's up", "You touched the wall"…) */
  message: string;
  /** the race's finishing order (or the mission's result: one row) */
  results: { name: string; color: string; time: number | null; best: number | null; you: boolean }[];
}

export const createPlaySignal = (): PlaySignal => ({
  kind: "",
  state: "intro",
  count: 3,
  time: 0,
  lap: 0,
  laps: 0,
  position: 0,
  cars: 0,
  bestLap: null,
  title: "",
  objective: "",
  progress: 0,
  total: 0,
  timeLeft: null,
  status: "",
  message: "",
  results: [],
});
