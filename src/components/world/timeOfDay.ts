import { useSyncExternalStore } from "react";

/**
 * Day / night state shared by the header toggle (React) and the 3D world (read every frame).
 * `night` is the requested mode; the world eases its own 0..1 blend towards it.
 * The choice is remembered per browser and mirrored onto <html data-theme> for the UI colours.
 */
const KEY = "world-time-of-day";
const listeners = new Set<() => void>();

function initial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "night") return true;
    if (saved === "day") return false;
  } catch {}
  return false;
}

export const timeOfDay = {
  night: initial(),
  /** 0 = full day, 1 = full night — eased by the world each frame. */
  blend: 0,
};
timeOfDay.blend = timeOfDay.night ? 1 : 0;

function applyTheme() {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = timeOfDay.night ? "dark" : "light";
}
applyTheme();

export function setNight(night: boolean) {
  if (timeOfDay.night === night) return;
  timeOfDay.night = night;
  try {
    window.localStorage.setItem(KEY, night ? "night" : "day");
  } catch {}
  applyTheme();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useNight() {
  return useSyncExternalStore(subscribe, () => timeOfDay.night, () => false);
}
