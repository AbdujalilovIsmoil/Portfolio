"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";
import { formatLap, type DriveSignal } from "./driveSignal";
import { TILE, TRACK, sampleAt } from "./Track";

/**
 * Top left: a dark dashboard card — the mode, the circuit with everything on it (the billboards in
 * free drive, the rivals in a race, a mission's gates, coins, crates…), the car, a big speed readout
 * with its bar, and the lap time.
 */
const Panel = styled.div<{ $c: string }>`
  --c: ${({ $c }) => $c};
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 50;
  width: 236px;
  padding: 10px 10px 12px;
  border-radius: 18px;
  background:
    radial-gradient(120% 60% at 0% 0%, color-mix(in srgb, var(--c) 22%, transparent), transparent 60%),
    linear-gradient(165deg, #171c28 0%, #0b0e15 100%);
  box-shadow:
    0 18px 40px -18px rgba(0, 0, 0, 0.75),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  color: #eef2fa;
  font-family: var(--font-nav);
  pointer-events: none;

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 2px 0 8px 4px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--c);
  }
  .chip::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 8px var(--c);
  }
  canvas {
    display: block;
    width: 216px;
    height: 150px;
    border-radius: 12px;
  }
  .speed {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin: 10px 4px 0;
  }
  .speed b {
    font-size: 30px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    letter-spacing: -1px;
    line-height: 1;
    color: #fff;
  }
  .speed span {
    font-size: 11px;
    font-weight: 800;
    color: rgba(238, 242, 250, 0.5);
  }
  .speed .lap {
    margin-left: auto;
    font-size: 12px;
    font-weight: 700;
    color: rgba(238, 242, 250, 0.75);
    font-variant-numeric: tabular-nums;
  }
  .gauge {
    height: 4px;
    margin: 8px 4px 0;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }
  .gauge i {
    display: block;
    height: 100%;
    width: 100%;
    transform-origin: left center;
    background: linear-gradient(90deg, #39d0ff, var(--c), #ff3b6b);
  }

  @media (max-width: 860px) {
    top: 10px;
    left: 10px;
    width: 166px;
    padding: 8px 8px 9px;
    border-radius: 14px;
    canvas {
      width: 150px;
      height: 104px;
    }
    .chip {
      margin-bottom: 6px;
      font-size: 9px;
    }
    .speed b {
      font-size: 22px;
    }
    .speed .lap {
      font-size: 10.5px;
    }
  }
`;

/** Map frame: north (+z) up and +x on the LEFT, as you see it driving north. */
function frame(w: number, h: number, pad: number) {
  const B = TRACK.bounds;
  const k = Math.min((w - pad * 2) / (B.x1 - B.x0), (h - pad * 2) / (B.z1 - B.z0));
  const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  return { k, px: (x: number) => w / 2 - (x - cx) * k, pz: (z: number) => h / 2 - (z - cz) * k };
}

export default function Minimap({ driveRef, label, color }: { driveRef: React.MutableRefObject<DriveSignal>; label: string; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef<HTMLElement>(null);
  const lapRef = useRef<HTMLSpanElement>(null);
  const gaugeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    let raf = 0;
    let w = 0;
    let h = 0;
    let base: HTMLCanvasElement | null = null;
    let drawnFor: object | null = null;
    let lastSpeed = "";
    let lastLap = "";
    const tick = () => {
      const d = driveRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!base || Math.round(canvas.clientWidth * dpr) !== w || drawnFor !== TRACK) {
        drawnFor = TRACK;
        w = Math.round(canvas.clientWidth * dpr);
        h = Math.round(canvas.clientHeight * dpr);
        canvas.width = w;
        canvas.height = h;
        // the circuit, drawn once (again when the track changes)
        base = document.createElement("canvas");
        base.width = w;
        base.height = h;
        const b = base.getContext("2d")!;
        const f = frame(w, h, 10 * dpr);
        b.fillStyle = "#0e131c";
        b.fillRect(0, 0, w, h);
        b.fillStyle = "rgba(255,255,255,0.035)";
        for (let x = 0; x < w; x += 14 * dpr) b.fillRect(x, 0, 1, h);
        for (let y = 0; y < h; y += 14 * dpr) b.fillRect(0, y, w, 1);
        const line = (filter: (y: number) => boolean, style: string, width: number) => {
          b.strokeStyle = style;
          b.lineWidth = width;
          b.lineCap = "round";
          b.lineJoin = "round";
          b.beginPath();
          let pen = false;
          for (const q of [...TRACK.samples, TRACK.samples[0]]) {
            if (!filter(q.y)) {
              pen = false;
              continue;
            }
            if (pen) b.lineTo(f.px(q.x), f.pz(q.z));
            else b.moveTo(f.px(q.x), f.pz(q.z));
            pen = true;
          }
          b.stroke();
        };
        const roadW = Math.max(3, 0.69 * TILE * f.k);
        line(() => true, "rgba(0,0,0,0.6)", roadW + 3 * dpr);
        line(() => true, "#3a4150", roadW);
        line((y) => y > 1, "#7c8597", Math.max(2, roadW * 0.55));
        line(() => true, "rgba(255,255,255,0.18)", Math.max(1, dpr * 0.8));
        // the start line: a chequered tick across the road
        const st = sampleAt(TRACK.startS);
        b.save();
        b.translate(f.px(st.x), f.pz(st.z));
        b.rotate(-st.heading + Math.PI / 2);
        for (let i = -2; i < 2; i++)
          for (let j = 0; j < 2; j++) {
            b.fillStyle = (i + j) % 2 ? "#ffffff" : "#111111";
            b.fillRect(j * 2.2 * dpr - 2.2 * dpr, i * 2.2 * dpr, 2.2 * dpr, 2.2 * dpr);
          }
        b.restore();
      }
      const f = frame(w, h, 10 * dpr);
      g.clearRect(0, 0, w, h);
      g.drawImage(base, 0, 0);
      // billboards, rivals, a mission's things
      for (const m of d.markers) {
        g.globalAlpha = m.id && d.visited.has(m.id) ? 0.35 : 1;
        g.fillStyle = m.color;
        g.beginPath();
        g.arc(f.px(m.x), f.pz(m.z), (m.ring ? 3.4 : 2.4) * dpr, 0, Math.PI * 2);
        g.fill();
        if (m.ring) {
          g.strokeStyle = "rgba(255,255,255,0.9)";
          g.lineWidth = 1.4 * dpr;
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      // the car: a white arrow with a glow, pointing the way it faces (the map has +x on the left)
      const x = f.px(d.x);
      const y = f.pz(d.z);
      const a = Math.atan2(-Math.cos(d.heading), -Math.sin(d.heading));
      const s = 6.5 * dpr;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.shadowColor = color;
      g.shadowBlur = 10 * dpr;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.moveTo(s, 0);
      g.lineTo(-s * 0.7, s * 0.65);
      g.lineTo(-s * 0.35, 0);
      g.lineTo(-s * 0.7, -s * 0.65);
      g.closePath();
      g.fill();
      g.restore();
      const kmh = Math.round(Math.abs(d.speed) * 3.6);
      if (String(kmh) !== lastSpeed && speedRef.current) {
        lastSpeed = String(kmh);
        speedRef.current.textContent = lastSpeed;
        if (gaugeRef.current) gaugeRef.current.style.transform = `scaleX(${Math.min(1, kmh / 300).toFixed(3)})`;
      }
      const lap = d.lapTime === null ? "" : `⏱ ${formatLap(d.lapTime)}${d.bestLap !== null ? ` · ${formatLap(d.bestLap)}` : ""}`;
      if (lap !== lastLap && lapRef.current) {
        lastLap = lap;
        lapRef.current.textContent = lap;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [driveRef, color]);

  return (
    <Panel aria-hidden $c={color}>
      <div className="chip">{label}</div>
      <canvas ref={canvasRef} />
      <div className="speed">
        <b ref={speedRef}>0</b>
        <span>km/h</span>
        <span className="lap" ref={lapRef} />
      </div>
      <div className="gauge">
        <i ref={gaugeRef} style={{ transform: "scaleX(0)" }} />
      </div>
    </Panel>
  );
}
