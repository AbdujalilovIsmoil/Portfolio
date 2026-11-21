"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";
import { formatLap, type DriveSignal } from "./driveSignal";
import { TILE, TRACK, sampleAt } from "./Track";
import { DISTRICT_COLORS, ZONES, garageSpots } from "./Zones";

const Panel = styled.div`
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 50;
  padding: 8px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid ${({ theme }) => theme.border};
  box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.5);
  color: var(--hud-text);
  font-family: var(--font-nav);
  pointer-events: none;

  canvas {
    display: block;
    width: 210px;
    height: 170px;
    border-radius: 10px;
  }
  @media (max-width: 860px) {
    top: 12px;
    left: 12px;
    padding: 6px;
    canvas {
      width: 140px;
      height: 114px;
    }
  }
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  padding: 6px 4px 0;
  font-size: 0.72rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;

  b {
    font-size: 1rem;
  }
  @media (max-width: 860px) {
    font-size: 0.62rem;
    b {
      font-size: 0.82rem;
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

/** Top-left: the circuit with every info board (dim once read), the car, its speed and the lap time. */
export default function Minimap({ driveRef }: { driveRef: React.MutableRefObject<DriveSignal> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef<HTMLElement>(null);
  const lapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    let raf = 0;
    let w = 0;
    let h = 0;
    let base: HTMLCanvasElement | null = null;
    let seen = -1;
    let lastSpeed = "";
    let lastLap = "";
    const tick = () => {
      const d = driveRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!base || Math.round(canvas.clientWidth * dpr) !== w) {
        w = Math.round(canvas.clientWidth * dpr);
        h = Math.round(canvas.clientHeight * dpr);
        canvas.width = w;
        canvas.height = h;
        base = document.createElement("canvas");
        base.width = w;
        base.height = h;
        seen = -1;
      }
      const f = frame(w, h, 8 * dpr);
      if (d.visited.size !== seen) {
        seen = d.visited.size;
        const b = base.getContext("2d")!;
        b.clearRect(0, 0, w, h);
        b.fillStyle = "#3f7a5f";
        b.fillRect(0, 0, w, h);
        // the road (hills drawn lighter)
        const line = (filter: (y: number) => boolean, color: string, width: number) => {
          b.strokeStyle = color;
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
        line(() => true, "#1c2027", Math.max(3, 0.69 * TILE * f.k));
        line((y) => y > 1, "#5b6070", Math.max(2, 0.4 * TILE * f.k));
        // the start line
        const st = sampleAt(TRACK.startS);
        b.fillStyle = "#ffffff";
        b.beginPath();
        b.arc(f.px(st.x), f.pz(st.z), 2.6 * dpr, 0, Math.PI * 2);
        b.fill();
        // the info boards, and the two garages
        for (const z of ZONES) {
          b.globalAlpha = d.visited.has(z.id) ? 0.35 : 1;
          b.fillStyle = DISTRICT_COLORS[z.district];
          b.beginPath();
          b.arc(f.px(z.board.x), f.pz(z.board.z), 2.4 * dpr, 0, Math.PI * 2);
          b.fill();
        }
        b.globalAlpha = 1;
        const gs = garageSpots();
        for (const [p, c] of [[gs.arcade, "#ff5d5d"], [gs.code, "#2ee6c8"]] as const) {
          b.fillStyle = c;
          b.fillRect(f.px(p.building.x) - 3 * dpr, f.pz(p.building.z) - 3 * dpr, 6 * dpr, 6 * dpr);
        }
      }
      g.clearRect(0, 0, w, h);
      g.drawImage(base, 0, 0);
      // the car: an arrow pointing the way it faces (the map has +x on the left)
      const x = f.px(d.x);
      const y = f.pz(d.z);
      const a = Math.atan2(-Math.cos(d.heading), -Math.sin(d.heading));
      const s = 6 * dpr;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = "#ffffff";
      g.strokeStyle = "#11151f";
      g.lineWidth = 1.6 * dpr;
      g.beginPath();
      g.moveTo(s, 0);
      g.lineTo(-s * 0.7, s * 0.65);
      g.lineTo(-s * 0.35, 0);
      g.lineTo(-s * 0.7, -s * 0.65);
      g.closePath();
      g.stroke();
      g.fill();
      g.restore();
      const kmh = String(Math.round(Math.abs(d.speed) * 3.6));
      if (kmh !== lastSpeed && speedRef.current) {
        lastSpeed = kmh;
        speedRef.current.textContent = kmh;
      }
      const lap = d.lapTime === null ? "—" : formatLap(d.lapTime) + (d.bestLap !== null ? ` · best ${formatLap(d.bestLap)}` : "");
      if (lap !== lastLap && lapRef.current) {
        lastLap = lap;
        lapRef.current.textContent = lap;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [driveRef]);

  return (
    <Panel aria-hidden>
      <canvas ref={canvasRef} />
      <Row>
        <span>
          <b ref={speedRef}>0</b> km/h
        </span>
        <span>
          ⏱ <span ref={lapRef}>—</span>
        </span>
      </Row>
    </Panel>
  );
}
