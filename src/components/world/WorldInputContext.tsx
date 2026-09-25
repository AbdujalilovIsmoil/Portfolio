"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";

export interface MoveState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
}

export interface WorldInput {
  move: MoveState;
  joystick: { x: number; y: number };
  /** Right-side mobile touch stick for camera look, integrated continuously (rate control) rather than applied as an absolute delta. */
  lookJoystick: { x: number; y: number };
  /** Increments on every jump request (key press / tap) — consumers compare against their own last-seen value instead of mutating this ref. */
  jumpId: number;
  /** Increments on every interact (F) press — enter/exit vehicle. */
  interactId: number;
  /** Increments on every E press — open/close doors. */
  doorId: number;
  /** True while a UI game owns the keyboard (movement/jump/interact are ignored). */
  locked: boolean;
  /** Continuous held-state of the jump key/button — used for ascending while flying (a discrete jumpId alone can't express "held"). */
  spaceHeld: boolean;
  /** Accumulated look angles (radians), driven by pointer-lock mouse deltas — like an FPS/CS-style mouselook. */
  look: { yaw: number; pitch: number };
}

const KEY_MAP: Record<string, keyof MoveState> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "backward",
  ArrowDown: "backward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "run",
  ShiftRight: "run",
};

const DEG = Math.PI / 180;
// Kept low enough that the horizon (and the sky above it — moon, stars, comets)
// is actually visible by default, not just when the player looks up.
const INITIAL_PITCH = 19 * DEG;
export const PITCH_MIN = 8 * DEG;
export const PITCH_MAX = 78 * DEG;
const LOOK_SENSITIVITY = 0.0022;

const InputContext = createContext<React.MutableRefObject<WorldInput> | null>(null);

export function WorldInputProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<WorldInput>({
    move: { forward: false, backward: false, left: false, right: false, run: false },
    joystick: { x: 0, y: 0 },
    lookJoystick: { x: 0, y: 0 },
    jumpId: 0,
    interactId: 0,
    doorId: 0,
    locked: false,
    spaceHeld: false,
    look: { yaw: 0, pitch: INITIAL_PITCH },
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (ref.current.locked) return;
      const key = KEY_MAP[e.code];
      if (key) ref.current.move[key] = true;
      if (e.code === "KeyF" && !e.repeat) ref.current.interactId++;
      if (e.code === "KeyE" && !e.repeat) ref.current.doorId++;
      if (e.code === "Space") {
        if (!e.repeat) ref.current.jumpId++;
        ref.current.spaceHeld = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (key) ref.current.move[key] = false;
      if (e.code === "Space") ref.current.spaceHeld = false;
    };
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement == null || ref.current.locked) return;
      const look = ref.current.look;
      look.yaw -= e.movementX * LOOK_SENSITIVITY;
      look.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, look.pitch + e.movementY * LOOK_SENSITIVITY));
    };
    let lockCooldown = false;
    const requestLock = () => {
      if (document.pointerLockElement != null || lockCooldown || ref.current.locked) return;
      const result = document.body.requestPointerLock?.();
      // Some browsers return a Promise (Pointer Lock v2) that rejects when the
      // request can't be honored yet — swallow it and back off briefly instead
      // of spamming retries or leaving an unhandled rejection.
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => {
          lockCooldown = true;
          setTimeout(() => {
            lockCooldown = false;
          }, 1000);
        });
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("click", requestLock);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("click", requestLock);
    };
  }, []);

  return <InputContext.Provider value={ref}>{children}</InputContext.Provider>;
}

export function useWorldInput() {
  const ctx = useContext(InputContext);
  if (!ctx) throw new Error("useWorldInput must be used within WorldInputProvider");
  return ctx;
}
