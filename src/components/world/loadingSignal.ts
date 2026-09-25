import { useSyncExternalStore } from "react";

interface LoadingState {
  progress: number;
  active: boolean;
}

let total = 0;
let done = 0;
let generation = 0;
let state: LoadingState = { progress: 0, active: false };
const listeners = new Set<() => void>();

function emit() {
  state = { progress: total ? Math.round((done / total) * 100) : 0, active: done < total };
  listeners.forEach((l) => l());
}

/** Count a promise (a model download) towards the start-screen progress bar. */
/** Start over (the 3D world is being rebuilt, e.g. React StrictMode remounting it). Old downloads no longer count. */
export function resetLoading() {
  generation++;
  total = 0;
  done = 0;
  emit();
}

export function trackLoad<T>(promise: Promise<T>): Promise<T> {
  const mine = generation;
  total++;
  emit();
  const finish = () => {
    if (mine !== generation) return;
    done++;
    emit();
  };
  promise.then(finish, finish);
  return promise;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Asset-loading state of the models the start screen waits for. */
export function useLoading() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
