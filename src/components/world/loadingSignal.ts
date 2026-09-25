import { useSyncExternalStore } from "react";

interface LoadingState {
  progress: number;
  active: boolean;
}

let state: LoadingState = { progress: 0, active: false };
const listeners = new Set<() => void>();

export function setLoading(progress: number, active: boolean) {
  state = { progress, active };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Drop-in for drei's useProgress(): asset-loading state of the 3D scene. */
export function useLoading() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
