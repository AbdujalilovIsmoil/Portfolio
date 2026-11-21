"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useWorldInput, PITCH_MIN, PITCH_MAX } from "./WorldInputContext";

const LOOK_JOYSTICK_RATE = 1.6;

const Wrap = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: none;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 22px 28px;
  pointer-events: none;

  @media (max-width: 860px), (pointer: coarse) {
    display: flex;
  }
`;

const Base = styled.div`
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  position: relative;
  pointer-events: auto;
  touch-action: none;
`;

const Stick = styled.div`
  position: absolute;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: ${({ theme }) => theme.accent};
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
`;

/** The touch version of the F key: the billboards' cards on / off (free drive). */
const ActionButton = styled.button`
  width: 68px;
  height: 68px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, ${({ theme }) => theme.accent}, ${({ theme }) => theme.accent2});
  color: #fff;
  font-weight: 800;
  font-size: 1.3rem;
  pointer-events: auto;
  box-shadow: ${({ theme }) => theme.shadow};
`;

const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
`;

const RightRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 14px;
`;

/** The touch version of Shift: the nitro, for as long as you hold it. */
const NitroButton = styled.button`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  background: radial-gradient(circle at 35% 30%, #ffd36b, #ff6a1f 55%, #c2261a);
  color: #fff;
  font: 900 13px var(--font-nav);
  letter-spacing: 0.4px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  box-shadow: 0 8px 20px -6px rgba(255, 90, 30, 0.75);
  transition: transform 0.08s, filter 0.08s;
  &[data-on="true"] {
    transform: scale(0.92);
    filter: brightness(1.2);
  }
`;

const LookBase = styled.div`
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  position: relative;
  pointer-events: auto;
  touch-action: none;
  opacity: 0.85;
`;

const LookStick = styled.div`
  position: absolute;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: ${({ theme }) => theme.accent2};
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
`;

export default function MobileControls({ action = true }: { action?: boolean }) {
  const input = useWorldInput();
  const baseRef = useRef<HTMLDivElement>(null);
  const lookBaseRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [lookStick, setLookStick] = useState({ x: 0, y: 0 });
  const activeTouch = useRef<number | null>(null);
  const activeLookTouch = useRef<number | null>(null);

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    function handleMove(clientX: number, clientY: number) {
      const rect = base!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = (clientX - cx) / (rect.width / 2);
      let dy = (clientY - cy) / (rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      setStick({ x: dx * 30, y: dy * 30 });
      input.current.joystick = { x: dx, y: dy };
    }

    function reset() {
      setStick({ x: 0, y: 0 });
      input.current.joystick = { x: 0, y: 0 };
      activeTouch.current = null;
    }

    function onTouchStart(e: TouchEvent) {
      const t = e.changedTouches[0];
      activeTouch.current = t.identifier;
      handleMove(t.clientX, t.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === activeTouch.current) {
          handleMove(t.clientX, t.clientY);
        }
      }
    }
    function onTouchEnd(e: TouchEvent) {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === activeTouch.current) reset();
      }
    }

    base.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      base.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [input]);

  useEffect(() => {
    const base = lookBaseRef.current;
    if (!base) return;

    function handleMove(clientX: number, clientY: number) {
      const rect = base!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = (clientX - cx) / (rect.width / 2);
      let dy = (clientY - cy) / (rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      setLookStick({ x: dx * 26, y: dy * 26 });
      input.current.lookJoystick = { x: dx, y: dy };
    }

    function reset() {
      setLookStick({ x: 0, y: 0 });
      input.current.lookJoystick = { x: 0, y: 0 };
      activeLookTouch.current = null;
    }

    function onTouchStart(e: TouchEvent) {
      const t = e.changedTouches[0];
      activeLookTouch.current = t.identifier;
      handleMove(t.clientX, t.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === activeLookTouch.current) {
          handleMove(t.clientX, t.clientY);
        }
      }
    }
    function onTouchEnd(e: TouchEvent) {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === activeLookTouch.current) reset();
      }
    }

    base.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      base.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [input]);

  // Continuously integrates the look-stick into look.yaw/pitch (a rate input,
  // unlike mouse deltas which write those angles directly) — done in a plain
  // rAF loop rather than useFrame, matching how the move joystick's input.current
  // writes are already handled above, outside the R3F render loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const stick = input.current.lookJoystick;
      if (stick.x !== 0 || stick.y !== 0) {
        input.current.look.yaw -= stick.x * LOOK_JOYSTICK_RATE * dt;
        input.current.look.pitch = Math.min(
          PITCH_MAX,
          Math.max(PITCH_MIN, input.current.look.pitch + stick.y * LOOK_JOYSTICK_RATE * dt)
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [input]);

  // the nitro: held down, Shift
  const [nitro, setNitro] = useState(false);
  const hold = (on: boolean) => {
    /* eslint-disable react-hooks/immutability */
    input.current.move.run = on;
    /* eslint-enable react-hooks/immutability */
    setNitro(on);
  };

  function interact() {
    // Imperative input ref, intentionally mutated outside React's render cycle.
    /* eslint-disable react-hooks/immutability */
    input.current.interactId++;
    /* eslint-enable react-hooks/immutability */
  }

  return (
    <Wrap>
      <Base ref={baseRef}>
        <Stick style={{ transform: `translate(calc(-50% + ${stick.x}px), calc(-50% + ${stick.y}px))` }} />
      </Base>
      <RightColumn>
        {action && (
          <ActionButton type="button" aria-label="F: show or hide the cards" onPointerDown={interact}>
            F
          </ActionButton>
        )}
        <RightRow>
          <NitroButton
            type="button"
            aria-label="Nitro (hold)"
            data-on={nitro}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              hold(true);
            }}
            onPointerUp={() => hold(false)}
            onPointerCancel={() => hold(false)}
            onLostPointerCapture={() => hold(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            N₂O
          </NitroButton>
          <LookBase ref={lookBaseRef}>
            <LookStick style={{ transform: `translate(calc(-50% + ${lookStick.x}px), calc(-50% + ${lookStick.y}px))` }} />
          </LookBase>
        </RightRow>
      </RightColumn>
    </Wrap>
  );
}
