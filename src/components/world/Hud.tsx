"use client";

import styled from "styled-components";
import { useEffect, useRef } from "react";
import { setNight, useNight } from "./timeOfDay";
import { faceTrack, startFaceTracking, stopFaceTracking, useFaceStatus, type FaceStatus } from "./faceTrack";

const Bar = styled.div`
  position: fixed;
  top: 16px;
  right: 20px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
`;

/** Round button with a face: switches webcam head-tracking on and off. */
const FaceButton = styled.button<{ $on: boolean }>`
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.accent : theme.border)};
  background: ${({ $on, theme }) => ($on ? theme.accent : theme.headerBg)};
  color: ${({ $on }) => ($on ? "#fff" : "var(--hud-text)")};
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.3s ease, border-color 0.3s ease;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.accent};
    outline-offset: 3px;
  }
`;

const Preview = styled.div`
  position: fixed;
  top: 64px;
  right: 20px;
  z-index: 50;
  width: 168px;
  border-radius: 14px;
  overflow: hidden;
  background: ${({ theme }) => theme.headerBg};
  border: 1px solid ${({ theme }) => theme.border};
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.5);
  font-family: var(--font-nav);
  font-size: 0.72rem;
  color: var(--hud-text);

  video {
    display: block;
    width: 100%;
    transform: scaleX(-1);
  }
  div {
    padding: 6px 10px;
  }
`;

const STATUS: Record<FaceStatus, string> = {
  off: "",
  loading: "Starting the camera…",
  searching: "Looking for your face…",
  tracking: "Tracking — turn your head",
  denied: "Camera permission denied",
  error: "Head tracking isn't available",
};

function FaceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" />
      <path d="M8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8" />
      <path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M17 3h2.5A1.5 1.5 0 0 1 21 4.5V7M21 17v2.5a1.5 1.5 0 0 1-1.5 1.5H17M7 21H4.5A1.5 1.5 0 0 1 3 19.5V17" />
    </svg>
  );
}

function FaceTracking() {
  const status = useFaceStatus();
  const holder = useRef<HTMLDivElement>(null);
  const on = status !== "off";
  useEffect(() => {
    const v = faceTrack.video;
    const h = holder.current;
    if (!v || !h || h.contains(v)) return;
    h.prepend(v);
  }, [status]);
  return (
    <>
      <FaceButton
        type="button"
        $on={on}
        aria-pressed={on}
        aria-label={on ? "Stop head tracking" : "Head tracking: your head turns the character's head"}
        title={on ? "Stop head tracking" : "Head tracking (camera)"}
        onClick={(e) => {
          if (on) stopFaceTracking();
          else void startFaceTracking();
          e.currentTarget.blur();
        }}
      >
        <FaceIcon />
      </FaceButton>
      {on && (
        <Preview ref={holder}>
          <div>{STATUS[status]}</div>
        </Preview>
      )}
    </>
  );
}

/** Sun / moon switch: day ⇄ night in the world, light ⇄ dark in the UI. */
const Toggle = styled.button<{ $night: boolean }>`
  position: relative;
  width: 76px;
  height: 38px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid ${({ $night }) => ($night ? "rgba(255,255,255,0.14)" : "rgba(15,40,90,0.12)")};
  background: ${({ $night }) =>
    $night ? "linear-gradient(135deg, #0b1230 0%, #1d2a5c 100%)" : "linear-gradient(135deg, #7cc4ff 0%, #bfe6ff 100%)"};
  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.25);
  cursor: pointer;
  overflow: hidden;
  transition: background 0.5s ease, border-color 0.5s ease;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.accent};
    outline-offset: 3px;
  }
`;

const Stars = styled.span<{ $night: boolean }>`
  position: absolute;
  inset: 0;
  opacity: ${({ $night }) => ($night ? 1 : 0)};
  transition: opacity 0.5s ease;
  background-image: radial-gradient(1.5px 1.5px at 14px 10px, #fff 50%, transparent 51%),
    radial-gradient(1px 1px at 26px 24px, #fff 50%, transparent 51%), radial-gradient(1.2px 1.2px at 20px 16px, #dfe8ff 50%, transparent 51%),
    radial-gradient(1px 1px at 33px 9px, #fff 50%, transparent 51%), radial-gradient(1.4px 1.4px at 10px 27px, #cfdcff 50%, transparent 51%);
`;

const Cloud = styled.span<{ $night: boolean }>`
  position: absolute;
  right: 9px;
  bottom: 7px;
  width: 22px;
  height: 9px;
  border-radius: 999px;
  background: #fff;
  opacity: ${({ $night }) => ($night ? 0 : 0.95)};
  transform: translateY(${({ $night }) => ($night ? 10 : 0)}px);
  transition: opacity 0.4s ease, transform 0.5s ease;

  &::before {
    content: "";
    position: absolute;
    left: 5px;
    top: -5px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #fff;
  }
`;

const Knob = styled.span<{ $night: boolean }>`
  position: absolute;
  top: 4px;
  left: 4px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  transform: translateX(${({ $night }) => ($night ? 38 : 0)}px);
  transition: transform 0.5s cubic-bezier(0.65, 0, 0.35, 1), background 0.5s ease, box-shadow 0.5s ease;
  background: ${({ $night }) => ($night ? "#e8ecf5" : "#ffd23f")};
  box-shadow: ${({ $night }) =>
    $night ? "0 0 12px 2px rgba(220,230,255,0.45), inset -3px -2px 0 rgba(150,160,190,0.35)" : "0 0 14px 4px rgba(255,200,40,0.6)"};

  /* moon craters, only at night */
  &::before,
  &::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    background: rgba(140, 150, 180, 0.45);
    opacity: ${({ $night }) => ($night ? 1 : 0)};
    transition: opacity 0.4s ease;
  }
  &::before {
    width: 7px;
    height: 7px;
    top: 6px;
    left: 8px;
  }
  &::after {
    width: 5px;
    height: 5px;
    top: 15px;
    left: 16px;
  }
`;

const Hint = styled.div`
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  padding: 8px 18px;
  border-radius: 999px;
  background: ${({ theme }) => theme.headerBg};
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.border};
  color: ${({ theme }) => theme.textMuted};
  font-size: 0.8rem;
  font-family: var(--font-nav);
  display: none;
  pointer-events: none;

  @media (min-width: 861px) and (pointer: fine) {
    display: block;
  }
`;

export default function Hud() {
  const night = useNight();
  return (
    <>
      <Bar>
        <FaceTracking />
        <Toggle
          type="button"
          role="switch"
          aria-checked={night}
          aria-label={night ? "Switch to day" : "Switch to night"}
          title={night ? "Day" : "Night"}
          $night={night}
          onClick={(e) => {
            setNight(!night);
            e.currentTarget.blur(); // keep Space for jumping, not re-toggling
          }}
        >
          <Stars $night={night} />
          <Cloud $night={night} />
          <Knob $night={night} />
        </Toggle>
      </Bar>
      <Hint>WASD — walk • Shift — run • Space — jump • mouse — look</Hint>
    </>
  );
}
