export interface Exercise {
  /** true when the check needs a real browser (layout or full computed styles; jsdom cannot do it) */
  needsBrowser?: boolean;
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

export const EXERCISES: Exercise[] = [
  {
    title: "1. Colour and background",
    task: "Give `.box` a red background (background-color: red).",
    html: `<div class="box">Hello</div>`,
    starter: ".box {\n  \n}",
    hint: "background-color: red;",
    solution: ".box {\n  background-color: red;\n}",
    check: (d) => cs(d, ".box")?.backgroundColor === "rgb(255, 0, 0)",
  },
  {
    needsBrowser: true,
    title: "2. Text style",
    task: "Make the `.title` text 32px and bold.",
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
    needsBrowser: true,
    title: "3. Circle",
    task: "Turn `.box` (100x100) into a perfect circle (border-radius: 50%).",
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
    needsBrowser: true,
    title: "4. Flexbox: centering",
    task: "Centre `.item` inside `.wrap` both horizontally and vertically (display:flex, justify-content, align-items).",
    html: `<div class="wrap"><div class="item">Centre</div></div>`,
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
    needsBrowser: true,
    title: "5. Flexbox: in a row",
    task: "Lay the three `.card` elements out in one row with a 12px gap (display:flex; gap:12px).",
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
    needsBrowser: true,
    title: "6. Grid: 3 columns",
    task: "Make `.grid` a grid with 3 equal columns (display:grid; grid-template-columns: repeat(3, 1fr)).",
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
    title: "7. Shadow and spacing",
    task: "Give `.card` 20px of padding and a shadow (box-shadow).",
    html: `<div class="card">Card</div>`,
    starter: ".card {\n  background: white;\n  color: #111;\n  \n}",
    hint: "padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,.3);",
    solution: ".card {\n  background: white;\n  color: #111;\n  padding: 20px;\n  box-shadow: 0 4px 12px rgba(0,0,0,.3);\n}",
    check: (d) => {
      const s = cs(d, ".card");
      return !!s && px(s.paddingTop) === 20 && s.boxShadow !== "none";
    },
  },
  {
    needsBrowser: true,
    title: "8. Position: in the corner",
    task: "Place `.badge` in the top-right corner of `.panel` (panel: position:relative; badge: position:absolute; top:0; right:0).",
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
    title: "9. Text colour",
    task: "Make the colour of the `.text` text blue (color: blue).",
    html: `<p class="text">Hello, world!</p>`,
    starter: ".text {\n  \n}",
    hint: "color: blue;",
    solution: ".text {\n  color: blue;\n}",
    check: (d) => cs(d, ".text")?.color === "rgb(0, 0, 255)",
  },
  {
    needsBrowser: true,
    title: "10. Width and height",
    task: "Set the width of `.box` to 200px and its height to 100px.",
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

