"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import type { WorkSignal } from "./workSignal";
import { useWorldInput } from "./WorldInputContext";

interface Exercise {
  title: string;
  task: string;
  html: string;
  starter: string;
  hint: string;
  solution: string;
  check: (doc: Document) => boolean;
}

const px = (v: string) => parseFloat(v) || 0;
const cs = (doc: Document, sel: string) => {
  const el = doc.querySelector(sel);
  return el ? doc.defaultView!.getComputedStyle(el) : null;
};

const EXERCISES: Exercise[] = [
  {
    title: "1. Rang va fon",
    task: "`.box` ga qizil fon bering (background-color: red).",
    html: `<div class="box">Salom</div>`,
    starter: ".box {\n  \n}",
    hint: "background-color: red;",
    solution: ".box {\n  background-color: red;\n}",
    check: (d) => cs(d, ".box")?.backgroundColor === "rgb(255, 0, 0)",
  },
  {
    title: "2. Matn stili",
    task: "`.title` matnini 32px qiling va qalin (bold) qiling.",
    html: `<h1 class="title">Portfolio</h1>`,
    starter: ".title {\n  \n}",
    hint: "font-size: 32px; font-weight: bold;",
    solution: ".title {\n  font-size: 32px;\n  font-weight: bold;\n}",
    check: (d) => {
      const s = cs(d, ".title");
      return !!s && px(s.fontSize) === 32 && Number(s.fontWeight) >= 700;
    },
  },
  {
    title: "3. Doira",
    task: "`.box` (100x100) ni to'liq doiraga aylantiring (border-radius: 50%).",
    html: `<div class="box"></div>`,
    starter: ".box {\n  width: 100px;\n  height: 100px;\n  background: #4d9bff;\n  \n}",
    hint: "border-radius: 50%;",
    solution: ".box {\n  width: 100px;\n  height: 100px;\n  background: #4d9bff;\n  border-radius: 50%;\n}",
    check: (d) => {
      const s = cs(d, ".box");
      return !!s && (s.borderTopLeftRadius === "50%" || px(s.borderTopLeftRadius) >= 50);
    },
  },
  {
    title: "4. Flexbox: markazlash",
    task: "`.wrap` ichidagi `.item` ni gorizontal va vertikal markazga joylang (display:flex, justify-content, align-items).",
    html: `<div class="wrap"><div class="item">Markaz</div></div>`,
    starter: ".wrap {\n  width: 300px;\n  height: 160px;\n  background: #222;\n  \n}\n.item {\n  background: gold;\n  padding: 8px;\n}",
    hint: "display: flex; justify-content: center; align-items: center;",
    solution: ".wrap {\n  width: 300px;\n  height: 160px;\n  background: #222;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n.item {\n  background: gold;\n  padding: 8px;\n}",
    check: (d) => {
      const w = d.querySelector(".wrap") as HTMLElement | null;
      const i = d.querySelector(".item") as HTMLElement | null;
      if (!w || !i) return false;
      const a = w.getBoundingClientRect();
      const b = i.getBoundingClientRect();
      return Math.abs(a.left + a.width / 2 - (b.left + b.width / 2)) < 2 && Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) < 2;
    },
  },
  {
    title: "5. Flexbox: qatorda",
    task: "Uchta `.card` ni bir qatorda, oralari 12px bo'sh joy bilan joylang (display:flex; gap:12px).",
    html: `<div class="row"><div class="card">1</div><div class="card">2</div><div class="card">3</div></div>`,
    starter: ".row {\n  \n}\n.card {\n  width: 60px;\n  height: 60px;\n  background: #7c9bff;\n}",
    hint: "display: flex; gap: 12px;",
    solution: ".row {\n  display: flex;\n  gap: 12px;\n}\n.card {\n  width: 60px;\n  height: 60px;\n  background: #7c9bff;\n}",
    check: (d) => {
      const cards = [...d.querySelectorAll(".card")].map((c) => c.getBoundingClientRect());
      return cards.length === 3 && Math.abs(cards[0].top - cards[2].top) < 1 && Math.abs(cards[1].left - cards[0].right - 12) < 1.5;
    },
  },
  {
    title: "6. Grid: 3 ustun",
    task: "`.grid` ni 3 teng ustunli grid qiling (display:grid; grid-template-columns: repeat(3, 1fr)).",
    html: `<div class="grid"><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i></div>`,
    starter: ".grid {\n  width: 300px;\n  \n}\n.grid i {\n  background: #9be38a;\n  padding: 10px;\n  text-align: center;\n}",
    hint: "display: grid; grid-template-columns: repeat(3, 1fr);",
    solution: ".grid {\n  width: 300px;\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n}\n.grid i {\n  background: #9be38a;\n  padding: 10px;\n  text-align: center;\n}",
    check: (d) => {
      const it = [...d.querySelectorAll(".grid i")].map((e) => e.getBoundingClientRect());
      return it.length === 6 && Math.abs(it[0].top - it[2].top) < 1 && it[3].top > it[0].top + 5;
    },
  },
  {
    title: "7. Soya va oraliq",
    task: "`.card` ga 20px padding va soya (box-shadow) bering.",
    html: `<div class="card">Kartochka</div>`,
    starter: ".card {\n  background: white;\n  color: #111;\n  \n}",
    hint: "padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,.3);",
    solution: ".card {\n  background: white;\n  color: #111;\n  padding: 20px;\n  box-shadow: 0 4px 12px rgba(0,0,0,.3);\n}",
    check: (d) => {
      const s = cs(d, ".card");
      return !!s && px(s.paddingTop) === 20 && s.boxShadow !== "none";
    },
  },
  {
    title: "8. Position: burchakda",
    task: "`.badge` ni `.panel` ning o'ng yuqori burchagiga joylang (panel: position:relative; badge: position:absolute; top:0; right:0).",
    html: `<div class="panel"><span class="badge">NEW</span></div>`,
    starter: ".panel {\n  width: 240px;\n  height: 120px;\n  background: #333;\n  \n}\n.badge {\n  background: crimson;\n  color: white;\n  padding: 4px 8px;\n  \n}",
    hint: ".panel { position: relative } .badge { position: absolute; top: 0; right: 0 }",
    solution: ".panel {\n  width: 240px;\n  height: 120px;\n  background: #333;\n  position: relative;\n}\n.badge {\n  background: crimson;\n  color: white;\n  padding: 4px 8px;\n  position: absolute;\n  top: 0;\n  right: 0;\n}",
    check: (d) => {
      const p = d.querySelector(".panel")?.getBoundingClientRect();
      const b = d.querySelector(".badge")?.getBoundingClientRect();
      return !!p && !!b && Math.abs(p.right - b.right) < 1.5 && Math.abs(p.top - b.top) < 1.5;
    },
  },
  {
    title: "9. Matn rangi",
    task: "`.text` matnining rangini ko'k (color: blue) qiling.",
    html: `<p class="text">Salom, dunyo!</p>`,
    starter: ".text {\n  \n}",
    hint: "color: blue;",
    solution: ".text {\n  color: blue;\n}",
    check: (d) => cs(d, ".text")?.color === "rgb(0, 0, 255)",
  },
  {
    title: "10. Kenglik va balandlik",
    task: "`.box` ning kengligini 200px, balandligini 100px qiling.",
    html: `<div class="box"></div>`,
    starter: ".box {\n  background: orange;\n  \n}",
    hint: "width: 200px; height: 100px;",
    solution: ".box {\n  background: orange;\n  width: 200px;\n  height: 100px;\n}",
    check: (d) => {
      const s = cs(d, ".box");
      return !!s && px(s.width) === 200 && px(s.height) === 100;
    },
  },
];

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
