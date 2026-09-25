"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import type { WorkSignal } from "./workSignal";
import { useWorldInput } from "./WorldInputContext";
import { EXERCISES } from "./cssExerciseData";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 420;
  background: rgba(6, 9, 18, 0.94);
  color: #e8edf7;
  font-family: var(--font-nav);
  display: flex;
  flex-direction: column;
  padding: 20px 26px;
  gap: 14px;
`;

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

const Btn = styled.button<{ $primary?: boolean }>`
  padding: 9px 18px;
  border-radius: 9px;
  border: 1px solid #7c9bff;
  background: ${({ $primary }) => ($primary ? "#4d6fe0" : "rgba(20,26,50,0.9)")};
  color: #fff;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
`;

function Workspace({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [code, setCode] = useState<string[]>(() => EXERCISES.map((e) => e.starter));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const ex = EXERCISES[idx];
  const css = code[idx];

  const srcDoc = useMemo(
    () => `<!doctype html><html><head><style>html,body{margin:0;padding:18px;font-family:sans-serif;background:#f4f6fb;color:#111}${css}</style></head><body>${ex.html}</body></html>`,
    [css, ex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.code === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const check = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const ok = ex.check(doc);
    setMsg({ ok, text: ok ? "✅ To'g'ri! Barakalla." : "❌ Hali to'g'ri emas. Vazifani qayta o'qing yoki «Maslahat» tugmasini bosing." });
    if (ok) setDone((d) => ({ ...d, [idx]: true }));
  };
  const go = (i: number) => {
    setIdx(i);
    setMsg(null);
  };

  return (
    <Overlay>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>💻 CSS mashqlari</div>
        <div style={{ opacity: 0.7, fontSize: 14 }}>Bajarildi: {Object.keys(done).length} / {EXERCISES.length}</div>
        <div style={{ flex: 1 }} />
        <Btn onClick={onClose}>Yopish (Esc)</Btn>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {EXERCISES.map((e, i) => (
          <Btn key={i} $primary={i === idx} onClick={() => go(i)} style={{ opacity: done[i] ? 1 : 0.85, borderColor: done[i] ? "#39d98a" : "#7c9bff" }}>
            {done[i] ? "✓ " : ""}
            {i + 1}
          </Btn>
        ))}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{ex.title}</div>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: "#c9d3e6" }}>{ex.task}</div>
      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
        <textarea
          value={css}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value;
            setCode((c) => c.map((x, i) => (i === idx ? v : x)));
            setMsg(null);
          }}
          style={{ flex: 1, resize: "none", background: "#0e1420", color: "#d7e2ff", border: "1px solid #2a3556", borderRadius: 10, padding: 14, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 14, lineHeight: 1.55, outline: "none" }}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.6, letterSpacing: 1 }}>NATIJA</div>
          <iframe ref={frame} title="preview" sandbox="allow-same-origin" srcDoc={srcDoc} style={{ flex: 1, border: "1px solid #2a3556", borderRadius: 10, background: "#f4f6fb" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Btn $primary onClick={check}>Tekshirish</Btn>
        <Btn onClick={() => setMsg({ ok: true, text: "💡 " + ex.hint })}>Maslahat</Btn>
        <Btn onClick={() => setCode((c) => c.map((x, i) => (i === idx ? ex.solution : x)))}>Yechimni ko&apos;rsatish</Btn>
        <Btn onClick={() => setCode((c) => c.map((x, i) => (i === idx ? ex.starter : x)))}>Boshidan</Btn>
        <div style={{ flex: 1 }} />
        <Btn disabled={idx === 0} onClick={() => go(idx - 1)}>← Oldingi</Btn>
        <Btn disabled={idx === EXERCISES.length - 1} onClick={() => go(idx + 1)}>Keyingi →</Btn>
      </div>
      <div style={{ minHeight: 24, fontWeight: 700, color: msg ? (msg.ok ? "#39d98a" : "#ff8a8a") : "transparent" }}>{msg?.text ?? "."}</div>
    </Overlay>
  );
}

function endWork(sig: React.MutableRefObject<WorkSignal>, input: ReturnType<typeof useWorldInput>) {
  sig.current.open = false;
  input.current.locked = false;
}

export default function CssExercises({ signalRef }: { signalRef: React.MutableRefObject<WorkSignal> }) {
  const input = useWorldInput();
  const [state, setState] = useState({ near: false, open: false });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { near, open } = signalRef.current;
      setState((s) => (s.near === near && s.open === open ? s : { near, open }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [signalRef]);

  return (
    <>
      <Hint $on={state.near}>
        <Key>F</Key>
        Kompyuterda CSS mashqlari
      </Hint>
      {state.open && <Workspace onClose={() => endWork(signalRef, input)} />}
    </>
  );
}
