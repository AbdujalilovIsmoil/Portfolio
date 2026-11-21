/** The car as the HUD sees it (minimap, speedometer, lap times). Written by the 3D world every frame. */
export interface DriveSignal {
  x: number;
  z: number;
  heading: number;
  /** metres per second (negative when reversing) */
  speed: number;
  /** ids of the info zones (Zones.ts) already shown */
  visited: Set<string>;
  /** seconds into the current lap (null until you first cross the start line) */
  lapTime: number | null;
  lastLap: number | null;
  bestLap: number | null;
  laps: number;
}

export const createDriveSignal = (): DriveSignal => ({ x: 0, z: 0, heading: 0, speed: 0, visited: new Set(), lapTime: null, lastLap: null, bestLap: null, laps: 0 });

/** 83.4 → "1:23.4" */
export function formatLap(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}
