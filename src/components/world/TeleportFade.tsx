"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";
import type { TeleportSignal } from "./teleportSignal";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 500;
  background: #000;
  opacity: 0;
  pointer-events: none;
`;

const FADE_MS = 420;

export default function TeleportFade({ signalRef }: { signalRef: React.MutableRefObject<TeleportSignal> }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const lastSeen = useRef(0);

  useEffect(() => {
    let raf = 0;
    let animStart: number | null = null;

    const tick = (now: number) => {
      const el = overlayRef.current;
      if (el) {
        if (signalRef.current.value !== lastSeen.current && animStart === null) {
          lastSeen.current = signalRef.current.value;
          animStart = now;
        }
        if (animStart !== null) {
          const t = now - animStart;
          const half = FADE_MS / 2;
          const opacity = t < half ? t / half : Math.max(0, 1 - (t - half) / half);
          el.style.opacity = String(opacity);
          if (t > FADE_MS) animStart = null;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [signalRef]);

  return <Overlay ref={overlayRef} />;
}
