import { useSyncExternalStore } from "react";

interface LoadingState {
  progress: number;
  active: boolean;
}

let total = 0;
let done = 0;
let state: LoadingState = { progress: 0, active: false };
const listeners = new Set<() => void>();

function emit() {
  state = { progress: total ? Math.round((done / total) * 100) : 0, active: done < total };
  listeners.forEach((l) => l());
}

/** Count a promise (a model download) towards the start-screen progress bar. */
export function trackLoad<T>(promise: Promise<T>): Promise<T> {
  total++;
  emit();
  const finish = () => {
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
