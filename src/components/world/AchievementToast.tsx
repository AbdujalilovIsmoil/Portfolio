"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import type { AchievementSignal } from "./achievementSignal";

const Toast = styled.div<{ $shown: boolean }>`
  position: fixed;
  top: 78px;
  left: 50%;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: 14px;
  background: ${({ theme }) => theme.bgElevated};
  border: 1px solid ${({ theme }) => theme.accent};
  box-shadow: ${({ theme }) => theme.shadow};
  color: #fff;
  font-family: var(--font-nav);
  pointer-events: none;
  transform: translate(-50%, ${({ $shown }) => ($shown ? "0" : "-14px")});
  opacity: ${({ $shown }) => ($shown ? 1 : 0)};
  transition: opacity 0.35s ease, transform 0.35s ease;
`;

const Icon = styled.div`
  font-size: 1.4rem;
`;

const Text = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.div`
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: ${({ theme }) => theme.accent};
  font-weight: 700;
`;

const Title = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
`;

export default function AchievementToast({ signalRef }: { signalRef: React.MutableRefObject<AchievementSignal> }) {
  const [shown, setShown] = useState(false);
  const [title, setTitle] = useState("");
  const lastSeen = useRef(0);

  useEffect(() => {
    let raf = 0;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (signalRef.current.value !== lastSeen.current) {
        lastSeen.current = signalRef.current.value;
        setTitle(signalRef.current.title);
        setShown(true);
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setShown(false), 3600);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [signalRef]);

  return (
    <Toast $shown={shown}>
      <Icon>🏆</Icon>
      <Text>
        <Label>Yutuq ochildi</Label>
        <Title>{title}</Title>
      </Text>
    </Toast>
  );
}
