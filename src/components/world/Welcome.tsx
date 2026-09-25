"use client";

import styled from "styled-components";
import { motion } from "framer-motion";
import { useLoading } from "./loadingSignal";

const Backdrop = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  padding: 24px;
`;

const Card = styled(motion.div)`
  max-width: 460px;
  width: 100%;
  padding: 36px 30px;
  border-radius: 22px;
  background: ${({ theme }) => theme.bgElevated};
  border: 1px solid ${({ theme }) => theme.border};
  box-shadow: ${({ theme }) => theme.shadow};
  text-align: center;
`;

const Emoji = styled.div`
  font-size: 2.6rem;
  margin-bottom: 14px;
`;

const Heading = styled.h2`
  font-size: 1.3rem;
  margin-bottom: 12px;
`;

const Body = styled.p`
  color: ${({ theme }) => theme.textMuted};
  font-size: 0.9rem;
  line-height: 1.7;
  margin-bottom: 26px;
`;

const StartButton = styled.button<{ $disabled: boolean }>`
  padding: 13px 32px;
  border-radius: 30px;
  border: none;
  background: linear-gradient(120deg, ${({ theme }) => theme.accent}, ${({ theme }) => theme.accent2});
  color: #fff;
  font-weight: 700;
  font-family: var(--font-nav);
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  font-size: 0.9rem;
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
  min-width: 168px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const ProgressTrack = styled.div`
  width: 100%;
  height: 4px;
  border-radius: 4px;
  background: ${({ theme }) => theme.border};
  overflow: hidden;
  margin-bottom: 20px;
`;

const ProgressFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: linear-gradient(90deg, ${({ theme }) => theme.accent}, ${({ theme }) => theme.accent2});
  transition: width 0.2s ease;
`;

export default function Welcome({ onStart }: { onStart: () => void }) {
  const { progress, active } = useLoading();
  const ready = !active && progress >= 100;

  return (
    <Backdrop initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Card
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <Emoji>🕹️</Emoji>
        <Heading>Welcome to this interactive world</Heading>
        <Body>
          Use WASD or the arrow keys to walk around the office and explore the portfolio.
        </Body>
        {!ready && (
          <ProgressTrack>
            <ProgressFill $pct={progress} />
          </ProgressTrack>
        )}
        <StartButton onClick={onStart} disabled={!ready} $disabled={!ready}>
          {ready ? "Start" : `Loading... ${Math.round(progress)}%`}
        </StartButton>
      </Card>
    </Backdrop>
  );
}
