"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import type { ExhibitInfo, ExhibitSignal } from "./exhibitSignal";

const Hint = styled.div<{ $on: boolean }>`
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

const Card = styled.div<{ $on: boolean }>`
  position: fixed;
  right: 28px;
  top: 50%;
  width: min(430px, calc(100vw - 40px));
  max-height: 88vh;
  overflow: hidden;
  transform: translate(${({ $on }) => ($on ? 0 : 24)}px, -50%);
  opacity: ${({ $on }) => ($on ? 1 : 0)};
  pointer-events: none;
  transition: opacity 0.25s ease, transform 0.25s ease;
  z-index: 46;
  padding: 20px 22px;
  border-radius: 16px;
  background: rgba(14, 18, 28, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid ${({ theme }) => theme.accent};
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
  color: #e8edf7;
  font-family: var(--font-nav);
`;

export default function ExhibitCard({ signalRef }: { signalRef: React.MutableRefObject<ExhibitSignal> }) {
  const [state, setState] = useState<{ near: boolean; open: boolean; item: ExhibitInfo | null }>({ near: false, open: false, item: null });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { near, open, item } = signalRef.current;
      setState((s) => (s.near === near && s.open === open && s.item === item ? s : { near, open, item }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [signalRef]);

  const it = state.item;
  return (
    <>
      <Hint $on={state.near && !state.open}>
        <Key>F</Key>
        Batafsil ma&apos;lumot
      </Hint>
      <Card $on={state.open && !!it}>
        {it && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.7, fontWeight: 700 }}>{it.subtitle}</div>
            <div style={{ fontSize: 20, fontWeight: 800, margin: "4px 0 10px" }}>{it.title}</div>
            {it.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 12.5, lineHeight: 1.55, marginBottom: 6, color: "#c9d3e6" }}>{l}</div>
            ))}
            {it.tags && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {it.tags.map((t) => (
                  <span key={t} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "rgba(124,155,255,0.22)", border: "1px solid rgba(124,155,255,0.5)" }}>{t}</span>
                ))}
              </div>
            )}
            {it.link && <div style={{ marginTop: 12, fontSize: 12.5, color: "#7fe3ff", fontWeight: 700 }}>🔗 {it.link}</div>}
            <div style={{ marginTop: 12, fontSize: 11, opacity: 0.6 }}>F — yopish</div>
          </>
        )}
      </Card>
    </>
  );
}
