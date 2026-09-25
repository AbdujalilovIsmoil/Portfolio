"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";
import { useWorldInput } from "./WorldInputContext";

const PX_PER_DEG = 3.2;
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function buildTicks() {
  const ticks: { deg: number; label?: string }[] = [];
  for (let base = -720; base <= 1080; base += 15) {
    const norm = ((base % 360) + 360) % 360;
    const label = norm % 45 === 0 ? DIRS[norm / 45] : undefined;
    ticks.push({ deg: base, label });
  }
  return ticks;
}
const TICKS = buildTicks();

const Wrap = styled.div`
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 45;
  width: 168px;
  height: 30px;
  overflow: hidden;
  border-radius: 8px;
  background: ${({ theme }) => theme.headerBg};
  border: 1px solid ${({ theme }) => theme.border};
  backdrop-filter: blur(8px);
  pointer-events: none;

  @media (max-width: 640px) {
    display: none;
  }
`;

const Strip = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  height: 100%;
  display: flex;
`;

const Tick = styled.div<{ $major: boolean }>`
  position: relative;
  width: ${15 * PX_PER_DEG}px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-nav);
  font-size: ${({ $major }) => ($major ? "0.72rem" : "0.5rem")};
  font-weight: ${({ $major }) => ($major ? 800 : 400)};
  color: ${({ $major, theme }) => ($major ? theme.accent : theme.textMuted)};
`;

const Pointer = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: #fff;
  opacity: 0.5;
`;

export default function Compass() {
  const input = useWorldInput();
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = stripRef.current;
      if (el) {
        const deg = (-input.current.look.yaw * 180) / Math.PI;
        el.style.transform = `translateX(calc(-50% - ${deg * PX_PER_DEG}px))`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [input]);

  return (
    <Wrap>
      <Strip ref={stripRef}>
        {TICKS.map((t, i) => (
          <Tick key={i} $major={!!t.label}>
            {t.label}
          </Tick>
        ))}
      </Strip>
      <Pointer />
    </Wrap>
  );
}
