"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import type { DoorSignal } from "./doorSignal";

const Bubble = styled.div<{ $on: boolean }>`
  position: fixed;
  bottom: 120px;
  left: 50%;
  transform: translate(-50%, ${({ $on }) => ($on ? 0 : 8)}px);
  z-index: 45;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px 8px 10px;
  border-radius: 999px;
  background: ${({ theme }) => theme.headerBg};
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.accent};
  color: #fff;
  font-size: 0.85rem;
  font-family: var(--font-nav);
  font-weight: 600;
  pointer-events: none;
  opacity: ${({ $on }) => ($on ? 1 : 0)};
  transition: opacity 0.2s ease, transform 0.2s ease;
`;

const Key = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: #fff;
  color: #111;
  font-weight: 800;
  box-shadow: 0 2px 0 #9aa3b5;
`;

export default function DoorHint({ signalRef }: { signalRef: React.MutableRefObject<DoorSignal> }) {
  const [state, setState] = useState<{ near: boolean; open: boolean; label?: string }>({ near: false, open: false });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { near, open, label } = signalRef.current;
      setState((s) => (s.near === near && s.open === open && s.label === label ? s : { near, open, label }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [signalRef]);

  return (
    <Bubble $on={state.near}>
      <Key>E</Key>
      {state.label ?? (state.open ? "Close the door" : "Open the door")}
    </Bubble>
  );
}
