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
  /** Increments on every interact (F) press — the billboards' cards on / off (free drive). */
  interactId: number;
  /** Increments on every R press — put the car back at the start. */
  resetId: number;
  /** Increments on every E press — open/close doors. */
  doorId: number;
  /** True while a UI game owns the keyboard (movement/jump/interact are ignored). */
  locked: boolean;
  /** Continuous held-state of the jump key/button — used for ascending while flying (a discrete jumpId alone can't express "held"). */
  spaceHeld: boolean;
  /** Accumulated look angles (radians): dragging on the 3D view with the mouse (or the touch look stick) turns the camera round the car. */
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
const INITIAL_PITCH = 17 * DEG;
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
    resetId: 0,
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
      if (e.code === "KeyR" && !e.repeat) ref.current.resetId++;
      if (e.code === "Space") {
        e.preventDefault(); // (no page scroll)
        if (!e.repeat) ref.current.jumpId++;
        ref.current.spaceHeld = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (key) ref.current.move[key] = false;
      if (e.code === "Space") ref.current.spaceHeld = false;
    };
    // Looking round: drag on the 3D view with the mouse. (No pointer lock: the pointer stays on
    // screen for the menu and the buttons — it used to vanish on every click.) Pointer events, not
    // mouse events: Babylon cancels pointerdown on its canvas, and then the browser sends no mouse ones.
    let dragging: HTMLCanvasElement | null = null;
    const press = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || ref.current.locked || !(e.target instanceof HTMLCanvasElement)) return;
      dragging = e.target;
      dragging.style.cursor = "grabbing";
    };
    const release = () => {
      if (dragging) dragging.style.cursor = "";
      dragging = null;
    };
    const move = (e: PointerEvent) => {
      if (!dragging || e.pointerType !== "mouse" || ref.current.locked) return;
      dragging.style.cursor = "grabbing"; // (Babylon resets it as the pointer moves over its canvas)
      const look = ref.current.look;
      look.yaw -= e.movementX * LOOK_SENSITIVITY;
      look.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, look.pitch + e.movementY * LOOK_SENSITIVITY));
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, []);

  return <InputContext.Provider value={ref}>{children}</InputContext.Provider>;
}

export function useWorldInput() {
  const ctx = useContext(InputContext);
  if (!ctx) throw new Error("useWorldInput must be used within WorldInputProvider");
  return ctx;
}
