"use client";

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import type { PsSignal } from "./psSignal";
import { useWorldInput, type WorldInput } from "./WorldInputContext";
import CsGame from "./CsGame";

const Hint = styled.div<{ $on: boolean }>`
  position: fixed;
  bottom: 70px;
  left: 50%;
  transform: translate(-50%, ${({ $on }) => ($on ? 0 : 8)}px);
  z-index: 45;
  padding: 9px 20px;
  border-radius: 999px;
  background: ${({ theme }) => theme.headerBg};
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.accent};
  color: #fff;
  font-size: 0.82rem;
  font-family: var(--font-nav);
  font-weight: 600;
  pointer-events: none;
  opacity: ${({ $on }) => ($on ? 1 : 0)};
  transition: opacity 0.25s ease, transform 0.25s ease;
`;

function endPlay(signal: React.MutableRefObject<PsSignal>, input: React.MutableRefObject<WorldInput>) {
  signal.current.playing = false;
  input.current.locked = false;
}

export default function PlayStationGame({ signalRef }: { signalRef: React.MutableRefObject<PsSignal> }) {
  const input = useWorldInput();
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = signalRef.current;
      setNear((v) => (v !== s.near ? s.near : v));
      setPlaying((v) => (v !== s.playing ? s.playing : v));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [signalRef]);

  const stableExit = useCallback(() => endPlay(signalRef, input), [signalRef, input]);

  return (
    <>
      <Hint $on={near}>F — play PlayStation</Hint>
      {playing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400 }}>
          <CsGame onExit={stableExit} />
        </div>
      )}
    </>
  );
}
