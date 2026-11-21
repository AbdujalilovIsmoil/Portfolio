import { useSyncExternalStore } from "react";

/**
 * What you have done, kept in this browser (localStorage): the missions you have passed and your
 * best time in each, your best race time and wins per track. Never throws: private windows and
 * blocked storage just don't remember.
 */
export interface Progress {
  missions: Record<string, { best: number }>;
  races: Record<string, { best: number | null; wins: number }>;
}

const KEY = "portfolio-game-v1";
const EMPTY: Progress = { missions: {}, races: {} };
let cache: Progress | null = null;
const listeners = new Set<() => void>();

/** The saved progress as a React store (the server and the first paint see none). */
export function useProgress(): Progress {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (cache ??= loadProgress()),
    () => EMPTY
  );
}

export function loadProgress(): Progress {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const p = raw ? (JSON.parse(raw) as Partial<Progress>) : {};
    return { missions: p.missions ?? {}, races: p.races ?? {} };
  } catch {
    return { missions: {}, races: {} };
  }
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // (storage blocked: fine)
  }
  cache = p;
  listeners.forEach((l) => l());
}

/** A mission passed in `time` seconds (keeps the best). */
export function saveMission(id: string, time: number) {
  const p = loadProgress();
  const old = p.missions[id];
  p.missions[id] = { best: old ? Math.min(old.best, time) : time };
  save(p);
}

/** A race finished in `time` seconds (keeps the best), won or not. */
export function saveRace(track: string, time: number, won: boolean) {
  const p = loadProgress();
  const old = p.races[track] ?? { best: null, wins: 0 };
  p.races[track] = { best: old.best === null ? time : Math.min(old.best, time), wins: old.wins + (won ? 1 : 0) };
  save(p);
}
