"use client";

import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import type { ExhibitSignal } from "./exhibitSignal";

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
  background: rgba(14, 18, 28, 0.9);
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

const rise = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
`;

/**
 * A pit-board: dark, with the section's colour down its edge and glowing in its corner, the corner
 * cut off like a race number board. (No backdrop blur: blurring the live 3D view behind it costs
 * every frame.)
 */
const Card = styled.aside<{ $on: boolean }>`
  position: fixed;
  right: 24px;
  top: 50%;
  z-index: 46;
  width: min(400px, calc(100vw - 32px));
  max-height: 84vh;
  overflow: hidden;
  pointer-events: none;
  color: #eef2fa;
  font-family: var(--font-nav);
  background:
    radial-gradient(130% 70% at 100% 0%, color-mix(in srgb, var(--c) 26%, transparent) 0%, transparent 60%),
    linear-gradient(165deg, #181d29 0%, #0c0f16 100%);
  border-radius: 16px;
  box-shadow:
    0 26px 60px -20px rgba(0, 0, 0, 0.7),
    inset 0 0 0 1px rgba(255, 255, 255, 0.07);
  clip-path: polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 0 100%);
  transform: translate(${({ $on }) => ($on ? 0 : 40)}px, -50%);
  opacity: ${({ $on }) => ($on ? 1 : 0)};
  transition:
    opacity 0.3s ease,
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);

  /* the section's colour down the left edge */
  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    background: linear-gradient(180deg, var(--c), color-mix(in srgb, var(--c) 40%, transparent));
    box-shadow: 0 0 18px var(--c);
  }

  /* phone, upright: under the minimap, clear of the stick and the F button */
  @media (max-width: 860px) {
    top: 172px;
    right: 12px;
    left: 12px;
    width: auto;
    max-height: calc(100dvh - 172px - 210px);
    transform: translateY(${({ $on }) => ($on ? 0 : -14)}px);
  }
  /* phone on its side: a narrow card top right, above the F button */
  @media (max-width: 1000px) and (max-height: 500px) {
    top: 10px;
    left: auto;
    right: 12px;
    width: min(310px, 40vw);
    max-height: calc(100dvh - 150px);
    transform: translateX(${({ $on }) => ($on ? 0 : 30)}px);
  }
`;

const Inner = styled.div`
  padding: 18px 22px 16px 26px;
  animation: ${rise} 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;

  @media (max-width: 860px), (max-height: 500px) {
    padding: 12px 14px 11px 18px;
  }
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px 4px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--c) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
  color: var(--c);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 1.6px;
  text-transform: uppercase;

  &::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 8px var(--c);
  }
`;

const Count = styled.span`
  font-size: 22px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
  color: #fff;
  padding-right: 18px;

  small {
    font-size: 12px;
    font-weight: 700;
    color: rgba(238, 242, 250, 0.4);
    margin-left: 2px;
  }
`;

const Title = styled.h3`
  margin: 0;
  color: #fff;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.3px;

  @media (max-width: 860px), (max-height: 500px) {
    font-size: 17px;
  }
`;

const Sub = styled.div`
  margin-top: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(238, 242, 250, 0.6);
`;

const Rule = styled.div`
  height: 1px;
  margin: 13px 0 11px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--c) 60%, transparent), rgba(255, 255, 255, 0.06) 70%);

  @media (max-width: 1000px) and (max-height: 500px) {
    margin: 9px 0 0;
  }
`;

/** On a phone only the first line (the billboard has the rest): the car stays in view. */
const Lines = styled.div`
  @media (max-width: 860px), (max-height: 500px) {
    & > div:nth-child(n + 2) {
      display: none;
    }
    & > div {
      font-size: 12px;
      margin-bottom: 5px;
    }
  }
  /* a phone on its side has no height to spare: the title, its line and the tags */
  @media (max-width: 1000px) and (max-height: 500px) {
    display: none;
  }
`;

const Line = styled.div`
  position: relative;
  padding-left: 16px;
  margin-bottom: 7px;
  font-size: 12.8px;
  line-height: 1.55;
  color: #c9d2e3;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.62em;
    width: 7px;
    height: 2px;
    border-radius: 2px;
    background: var(--c);
  }
`;

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 11px;

  @media (max-width: 860px), (max-height: 500px) {
    flex-wrap: nowrap;
    overflow: hidden;
    margin-top: 8px;
    span {
      flex: none;
      font-size: 10px;
      padding: 2px 7px;
    }
  }

  span {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 6px;
    color: #e6ebf5;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
`;

const Link = styled.div`
  margin-top: 12px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--c);

  @media (max-width: 860px), (max-height: 500px) {
    display: none;
  }
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  font-size: 11px;
  color: rgba(238, 242, 250, 0.5);

  @media (max-width: 860px), (max-height: 500px) {
    margin-top: 10px;
    & > span {
      display: none;
    }
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    margin-right: 6px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.92);
    color: #10131a;
    font-family: inherit;
    font-size: 11px;
    font-weight: 800;
  }
`;

/** How far past the billboard you are: fills as you drive by it. */
const Track = styled.div`
  flex: 1;
  height: 3px;
  border-radius: 3px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);

  i {
    display: block;
    height: 100%;
    width: 100%;
    transform-origin: left center;
    background: var(--c);
    box-shadow: 0 0 10px var(--c);
  }
`;

type CardState = Pick<ExhibitSignal, "near" | "open" | "item" | "footer" | "color" | "label" | "counter">;

export default function ExhibitCard({ signalRef }: { signalRef: React.MutableRefObject<ExhibitSignal> }) {
  const [state, setState] = useState<CardState>({ near: false, open: false, item: null });
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { near, open, item, footer, color, label, counter, progress } = signalRef.current;
      setState((s) =>
        s.near === near && s.open === open && s.item === item && s.footer === footer && s.color === color && s.label === label && s.counter?.[0] === counter?.[0]
          ? s
          : { near, open, item, footer, color, label, counter }
      );
      // the progress strip moves every frame: straight on the DOM, no re-render
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, progress ?? 0)).toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [signalRef]);

  const it = state.item;
  const [key, hint] = (state.footer ?? "F — close").split(" — ");
  return (
    <>
      <Hint $on={state.near && !state.open}>
        <Key>F</Key>
        More info
      </Hint>
      <Card $on={state.open && !!it} style={{ ["--c" as string]: state.color ?? "#7c9bff" }} aria-live="polite">
        {it && (
          <Inner key={it.title}>
            <Head>
              <Chip>{state.label ?? "Info"}</Chip>
              {state.counter && (
                <Count>
                  {String(state.counter[0]).padStart(2, "0")}
                  <small>/{state.counter[1]}</small>
                </Count>
              )}
            </Head>
            <Title>{it.title}</Title>
            <Sub>{it.subtitle}</Sub>
            <Rule />
            <Lines>
              {it.lines.map((l, i) => (
                <Line key={i}>{l}</Line>
              ))}
            </Lines>
            {it.tags && (
              <Tags>
                {it.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </Tags>
            )}
            {it.link && <Link>↗ {it.link}</Link>}
            <Foot>
              <Track>
                <i ref={barRef} />
              </Track>
              <span>
                <kbd>{key}</kbd>
                {hint}
              </span>
            </Foot>
          </Inner>
        )}
      </Card>
    </>
  );
}
