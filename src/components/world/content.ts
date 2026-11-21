/**
 * Everything the portfolio tells, in one place. The drive-through world (Stations.ts) turns each
 * entry into a roadside billboard and the card you read when you stop by it.
 */

export const PROFILE = {
  name: "Ismoil Abdujalilov",
  role: "Frontend (React) Engineer",
  photo: "/img/abdujalilov-ismoil.jpg",
  website: "abdujalilovismoil.uz",
};

export const ABOUT = {
  lines: [
    "Frontend (React) engineer: I build multilingual, fast and SEO-friendly web platforms with React, Next.js and TypeScript.",
    "Since 2023 I have worked with OKS Technologies, UnitDev, Shams Learning Center, Rentix and Ixlos School.",
    "I also teach frontend (UnitDev, Najot Ta'lim, Alfraganus University) and record React.js video tutorials.",
    "Drive around the map: every glowing circle is a stop. Press F there to read more.",
  ],
  tags: ["React", "Next.js", "TypeScript", "React Native"],
};

export interface Education {
  school: string;
  program: string;
  dates: string;
  color: string;
  lines: string[];
}

export const EDUCATION: Education[] = [
  {
    school: "Najot Ta'lim",
    program: "Frontend Development",
    dates: "August 2022 – January 2023",
    color: "#1f6a4a",
    lines: [
      "A strong foundation in HTML, CSS, SCSS, Bootstrap/MDBootstrap, JavaScript, React, Redux and Redux Toolkit through hands-on, project-based learning.",
      "Built mini projects that simulate real-world scenarios, worked in team projects and mentored peers.",
    ],
  },
  {
    school: "Alfraganus University",
    program: "Computer Engineering · Full Time",
    dates: "September 2024 – Present",
    color: "#3a4a8a",
    lines: [
      "Algorithms, data structures and optimization; 400+ problems solved on LeetCode and Codewars.",
      "Explored prompt engineering and AI-assisted development; taught frontend classes to fellow students.",
    ],
  },
];

export interface Job {
  company: string;
  role: string;
  type: string;
  dates: string;
  /** the year the job started, shown on the timeline */
  year: string;
  color: string;
  tags: string[];
  /** three short highlights for the billboard */
  points: string[];
  /** the full story for the info card */
  lines: string[];
}

/** Oldest first: driving out along Experience Road takes you forward in time. */
export const JOBS: Job[] = [
  {
    company: "OKS Technologies",
    role: "Frontend Engineer",
    type: "Internship",
    dates: "February 2023 – July 2023",
    year: "2023",
    color: "#3a4a8a",
    tags: ["Ant Design", "Tailwind", "React Query", "Redux Toolkit"],
    points: ["Admin panel with Ant Design and streamlined form workflows", "Responsive news website UI with Tailwind CSS", "React Query caching + Redux Toolkit auth (persistent login)"],
    lines: [
      "Built an admin panel with Ant Design, customizing components, ensuring responsive layouts, and streamlining form workflows.",
      "Developed a responsive news website UI with Tailwind CSS, accelerating development and optimizing the CSS footprint.",
      "Implemented data fetching with React Query, including caching, retry logic, and category-based filtering hooks, reducing redundant API calls.",
      "Managed global state and user authorization with Redux Toolkit (persistent login, secure logout); integrated Formik with Ant Design for validated forms.",
    ],
  },
  {
    company: "UnitDev",
    role: "Frontend Engineer",
    type: "Contract",
    dates: "April 2024 – October 2025",
    year: "2024",
    color: "#1f6a4a",
    tags: ["Next.js", "TypeScript", "CKEditor", "SEO"],
    points: ["foragedialog.uz — production platform, 91% SEO · 90% Accessibility", "rtholdings.uz — 83% Performance · 82% A11y · 100% SEO", "Multilingual, role-based, API-driven web platforms"],
    lines: [
      "foragedialog.uz – Rebuilt from scratch a production-grade multilingual platform for the German–Uzbek climate-resilient agriculture program: real-time content management, role-based authentication, API-driven workflows and a customized CKEditor. Achieved 91% SEO and 90% Accessibility (Lighthouse). Fully live and continuously updated.",
      "rtholdings.uz – Modern, high-performance corporate website for a multinational company across Uzbekistan and Central Asia (Next.js, React, TypeScript): dynamic API-driven content, search, secure login. Lighthouse in production: 83% Performance, 82% Accessibility, 100% SEO.",
    ],
  },
  {
    company: "Shams Learning Center",
    role: "Frontend Engineer",
    type: "Contract",
    dates: "May 2025 – April 2026",
    year: "2025",
    color: "#1f5a8a",
    tags: ["Next.js", "React", "CKEditor 5", "Node.js"],
    points: ["Multilingual site: Uzbek, Russian, English, Arabic (RTL)", "Custom CMS with Admin Panel, REST API & rich-text editor", "@Shams_asisstant_bot — AI Telegram assistant, 24/7 on VPS"],
    lines: [
      "old.shamsoquvmarkaz.uz – Developed a modern, multilingual educational website using Next.js and React to present courses, achievements, and community impact. Implemented full internationalization with Uzbek, Russian, English, and Arabic (RTL) support, delivering a responsive and accessible experience. The platform highlights 1,700+ graduates and a 12,000+ member community.",
      "shamsoquvmarkaz.uz – Built a custom CMS with Admin Panel, REST API, and rich-text editing, including a custom CKEditor 5 plugin for interactive image carousels. Redesigned mobile navigation with animated transitions; improved SEO with JSON-LD and Open Graph metadata.",
      "@Shams_asisstant_bot – Production-ready AI Telegram assistant (Node.js, Telegram Bot API) with inline keyboards and command workflows. Deployed on a VPS with PM2, secure env management, error handling and rate limits. Led the migration from Google Gemini API to ChatGPT API for higher request volumes and better token handling.",
    ],
  },
  {
    company: "Rentix",
    role: "Frontend Engineer",
    type: "Full Time",
    dates: "October 2025 – April 2026",
    year: "2025",
    color: "#8a4a1f",
    tags: ["React", "Ant Design", "Formik", "React Query", "FSD"],
    points: ["Refactored the codebase to Feature-Sliced Design (FSD)", "Secure auth (Login, Registration, OTP) and role-based admin panel", "Real-time notifications, custom date-time picker, CRUD modules"],
    lines: [
      "Developed the frontend of the Rentix project and refactored the codebase into Feature-Sliced Design (FSD) architecture, with reusable modular components and a standardized global state.",
      "Built a responsive interface with React, Ant Design, Formik, and React Query for efficient data handling.",
      "Implemented secure authentication (Login, Registration, OTP verification) and advanced order filtering by date and time.",
      "Built role-based access control in the admin panel with dynamic route rendering based on permissions.",
      "Designed reusable UI components and a custom date-time picker; implemented real-time notifications and CRUD modules (regions, cars, managers).",
      "Integrated online/offline state detection to improve reliability and user feedback.",
    ],
  },
  {
    company: "Ixlos School",
    role: "Frontend & UI/UX Teacher",
    type: "Part Time",
    dates: "February 2026 – April 2026",
    year: "2026",
    color: "#6a3a8a",
    tags: ["Figma", "HTML/CSS", "AI tools", "Mentoring"],
    points: ["Taught ChatGPT, Gemini, Google AI Studio, Stitch, Figma AI, Grok, Rork", "Strengthened HTML & CSS foundations through guided practice", "Intermediate UI/UX design with Figma; mentorship & classroom management"],
    lines: [
      "Introduced students to AI platforms and tools such as ChatGPT, Gemini, Google AI Studio, Stitch, Figma AI, Grok, Rork, and other emerging technologies.",
      "Helped students use AI tools effectively for learning, creativity, and productivity.",
      "Reinforced foundational HTML and CSS knowledge through practical exercises and guided lessons.",
      "Taught intermediate UI/UX concepts using Figma so students could create their own responsive, well-structured designs.",
      "Improved communication, mentorship, and classroom management skills; encouraged creativity, independent thinking and problem-solving through hands-on mini projects.",
    ],
  },
];

export interface Work {
  title: string;
  kind: string;
  image: string;
  color: string;
  subtitle: string;
  lines: string[];
  tags: string[];
  link: string;
}

export const WORKS: Work[] = [
  {
    title: "RT Holdings",
    kind: "Corporate website",
    image: "/img/works/rt-holdings-hd.jpg",
    color: "#1f5a8a",
    subtitle: "Work · Corporate website",
    lines: ["A corporate website for a company in construction, industry and logistics.", "Built with Next.js / React / TypeScript. Lighthouse: 83 / 82 / 100."],
    tags: ["Next.js", "React", "TypeScript"],
    link: "rtholdings.uz",
  },
  {
    title: "Shams Learning Center",
    kind: "Education platform",
    image: "/img/works/shams-oquv-markaz-hd.jpg",
    color: "#1f6a4a",
    subtitle: "Work · Education platform",
    lines: ["A multilingual website (uz / ru / en / ar-RTL) for an Arabic language learning centre. 1,700+ graduates, 12,000+ community members.", "A custom CMS and a CKEditor 5 plugin were developed."],
    tags: ["Next.js", "i18n", "CMS", "CKEditor5"],
    link: "shamsoquvmarkaz.uz",
  },
  {
    title: "Foragedialog",
    kind: "Agriculture platform",
    image: "/img/works/foragedialog-hd.jpg",
    color: "#5a6a1f",
    subtitle: "Work · Agriculture platform",
    lines: ["A German–Uzbek climate-resilient agriculture platform.", "SEO 91%, Accessibility 90%."],
    tags: ["React", "SEO", "A11y"],
    link: "foragedialog.uz",
  },
];

/** Draws a logo into an s×s square (for logos that are a picture rather than letters). */
export type LogoDraw = (g: CanvasRenderingContext2D, s: number) => void;

export interface Tech {
  name: string;
  group: string;
  bg: string;
  fg: string;
  glyph?: string;
  draw?: LogoDraw;
  lines: string[];
  tags?: string[];
}

const atom: LogoDraw = (g, s) => {
  g.strokeStyle = "#61dafb";
  g.lineWidth = s * 0.05;
  g.translate(s / 2, s / 2);
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(0, 0, s * 0.36, s * 0.14, (i * Math.PI) / 3, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "#61dafb";
  g.beginPath();
  g.arc(0, 0, s * 0.06, 0, Math.PI * 2);
  g.fill();
};

export const TECHS: Tech[] = [
  { name: "React", group: "Library", bg: "#20232a", fg: "#61dafb", draw: atom, lines: ["A component-based UI library (Meta).", "My main technology: used in Rentix, RT Holdings, Foragedialog and other projects."], tags: ["Hooks", "Components", "SPA"] },
  { name: "Next.js", group: "Framework", bg: "#000000", fg: "#ffffff", glyph: "N", lines: ["A full-stack framework for React: SSR, SSG, routing, SEO.", "The Shams Learning Center and RT Holdings websites are built with it."], tags: ["SSR", "SEO", "App Router"] },
  { name: "TypeScript", group: "Language", bg: "#3178c6", fg: "#ffffff", glyph: "TS", lines: ["A language that adds static types to JavaScript.", "Catches mistakes early and keeps large codebases readable."], tags: ["Types", "Safety"] },
  { name: "JavaScript", group: "Language", bg: "#f7df1e", fg: "#111111", glyph: "JS", lines: ["The core language of web development.", "My everyday frontend tool since 2021."], tags: ["ES6+", "DOM"] },
  { name: "Redux Toolkit", group: "State", bg: "#764abc", fg: "#ffffff", glyph: "RTK", lines: ["The official, simplified toolset for Redux.", "Used at OKS Technologies for global state and persistent login."], tags: ["Redux", "State"] },
  { name: "TanStack Query", group: "Data fetching", bg: "#ff4154", fg: "#ffffff", glyph: "TQ", lines: ["A library for caching, retrying and synchronising server data (React Query).", "Used in every project to cut down redundant API requests."], tags: ["Cache", "Retry"] },
  { name: "Formik", group: "Forms", bg: "#2563a8", fg: "#ffffff", glyph: "Fk", lines: ["A library for handling forms and validation in React.", "Used together with Ant Design in the Rentix and OKS projects."], tags: ["Forms", "Validation"] },
  { name: "Zustand", group: "State", bg: "#4a3b2a", fg: "#f4c26b", glyph: "Zu", lines: ["A light and simple global-state library.", "A handy alternative to Redux in small and medium projects."], tags: ["State", "Hooks"] },
  { name: "MUI", group: "UI library", bg: "#0b1a2b", fg: "#3f9cf3", glyph: "MUI", lines: ["A set of React components based on Material Design.", "For building fast, consistent interfaces."], tags: ["Material", "Components"] },
  { name: "Ant Design", group: "UI library", bg: "#ffffff", fg: "#1677ff", glyph: "Ant", lines: ["An enterprise-grade React UI library.", "My first choice for admin panels (Rentix, OKS)."], tags: ["Admin", "Tables"] },
  { name: "Tailwind CSS", group: "Styling", bg: "#0f172a", fg: "#38bdf8", glyph: "TW", lines: ["A utility-first CSS framework for fast, consistent styling.", "I have also worked with Tailwind UI components."], tags: ["Utility", "Tailwind UI"] },
  { name: "Sass / SCSS", group: "Styling", bg: "#cc6699", fg: "#ffffff", glyph: "Sass", lines: ["A CSS preprocessor: variables, nesting, mixins.", "Keeps large stylesheets organised."], tags: ["SCSS", "Mixins"] },
  { name: "Bootstrap", group: "Styling", bg: "#7952b3", fg: "#ffffff", glyph: "B", lines: ["One of the most popular CSS frameworks.", "I also have experience with MDBootstrap and Materialize."], tags: ["Grid", "MDB", "Materialize"] },
  { name: "Styled Components", group: "Styling", bg: "#1f1a24", fg: "#db7093", glyph: "SC", lines: ["CSS-in-JS: write styles inside the component.", "This 3D portfolio is styled with it too."], tags: ["CSS-in-JS"] },
  { name: "React Native", group: "Mobile", bg: "#20232a", fg: "#61dafb", draw: atom, lines: ["Building iOS/Android apps with React.", "Printer [Full Stack] — React Native CLI + a Kotlin native module, a thermal-printer app."], tags: ["Android", "Kotlin"] },
  { name: "Firebase", group: "Backend service", bg: "#1a1a1a", fg: "#ffca28", glyph: "FB", lines: ["Google's backend services: authentication, Firestore, hosting.", "Used for auth and the database in the Printer app."], tags: ["Auth", "Firestore"] },
  { name: "Git / GitHub", group: "Tool", bg: "#f05032", fg: "#ffffff", glyph: "Git", lines: ["A version-control system and a team collaboration platform.", "The basis of daily work: branches, pull requests, code review."], tags: ["Version control", "PR"] },
];

/** The technologies, four billboards' worth (names from TECHS). */
export const SKILL_GROUPS: { title: string; subtitle: string; names: string[] }[] = [
  { title: "Core", subtitle: "Skills · Languages & frameworks", names: ["React", "Next.js", "TypeScript", "JavaScript"] },
  { title: "State & data", subtitle: "Skills · State, data fetching, forms", names: ["Redux Toolkit", "TanStack Query", "Zustand", "Formik"] },
  { title: "UI & styling", subtitle: "Skills · Component libraries & CSS", names: ["MUI", "Ant Design", "Tailwind CSS", "Sass / SCSS", "Bootstrap", "Styled Components"] },
  { title: "Mobile & tools", subtitle: "Skills · Apps, backend services, workflow", names: ["React Native", "Firebase", "Git / GitHub"] },
];

export interface Testimonial {
  name: string;
  role: string;
  project: string;
  photo: string;
  color: string;
  quote: string;
  full: string[];
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Mr. Abdurahmon",
    role: "Founder, Shams O‘quv Markazi",
    project: "shamsoquvmarkaz.uz",
    photo: "/img/testimonials/shams-oquv-markaz.jpeg",
    color: "#1f5a8a",
    quote: "He transformed our ideas into a modern, visually appealing, user-friendly and highly functional website.",
    full: [
      "I am pleased to formally recommend Ismoil for his outstanding work as a web developer. As the founder of Shams O‘quv Markazi, I entrusted him with the development of our official website, shamsoquvmarkaz.uz, and he delivered results that exceeded all of our expectations.",
      "Throughout the entire project, Ismoil demonstrated exceptional technical expertise, professionalism, and a strong sense of responsibility. He transformed our ideas into a modern, visually appealing, user-friendly, and highly functional website.",
      "Beyond his technical skills, Ismoil consistently maintained clear communication, responded promptly, and was always open to feedback. He managed deadlines effectively and proactively suggested improvements that enhanced both performance and user experience.",
      "I am confident that Ismoil will be an invaluable asset to any team or project. He is a talented, dedicated, and trustworthy web developer whom I wholeheartedly recommend.",
    ],
  },
  {
    name: "Abdugafur Mamaraimov",
    role: "MBA Candidate, Pforzheim Business School",
    project: "foragedialog.uz",
    photo: "/img/testimonials/abdugafur.png",
    color: "#6a3a8a",
    quote: "He played a crucial role in the development of foragedialog.uz, delivering results that exceeded our expectations.",
    full: [
      "I am pleased to highly recommend Ismoiljon for his outstanding work as a web developer.",
      "He played a crucial role in the development of foragedialog.uz, delivering results that exceeded our expectations.",
    ],
  },
  {
    name: "Shaxlo (Nazimjonovna) Turayeva",
    role: "Backend Engineer (Python)",
    project: "Rentix",
    photo: "/img/testimonials/shaxlo.png",
    color: "#8a4a1f",
    quote: "One of Ismoiljon’s strongest qualities is his excellent sense of design. He is reliable, professional, and a great team player.",
    full: [
      "I am pleased to write this letter of recommendation for Ismoiljon, who worked on the front-end development of the Rentix project. He demonstrated strong technical skills, creativity, and a deep understanding of modern front-end technologies, and consistently delivered clean, efficient, well-structured code.",
      "One of Ismoiljon’s strongest qualities is his excellent sense of design. He has a sharp eye for detail and a solid understanding of UI/UX principles, which significantly improved the quality and usability of the Rentix platform.",
      "He is a great team player: he communicates clearly, collaborates effectively, adapts quickly to feedback, and is always willing to support his teammates.",
      "I highly recommend Ismoiljon for any front-end development role.",
    ],
  },
];

export interface Achievement {
  title: string;
  big: string;
  sub: string;
  color: string;
  icon: string;
  subtitle: string;
  lines: string[];
  tags: string[];
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    title: "LeetCode",
    big: "50+",
    sub: "problems solved",
    color: "#a06a10",
    icon: "🧩",
    subtitle: "Achievement · Algorithms",
    lines: ["I have solved more than 50 problems on LeetCode.", "Regular practice in algorithmic thinking and data structures."],
    tags: ["Algorithms", "Problem solving"],
  },
  {
    title: "Codewars",
    big: "200+",
    sub: "challenges completed",
    color: "#8a1f2a",
    icon: "⚔️",
    subtitle: "Achievement · Kata practice",
    lines: ["More than 200 challenges (katas) solved on Codewars.", "Codewars Problems & Abdujalilov Ismoil — Founder & Content Creator."],
    tags: ["Katas", "JavaScript"],
  },
  {
    title: "ITech YouTube",
    big: "20+",
    sub: "React.js video tutorials",
    color: "#a01818",
    icon: "🎬",
    subtitle: "Achievement · Content creation",
    lines: ["I created more than 20 video tutorials on React.js for the ITech YouTube channel.", "Sharing knowledge with others is also the best way for me to learn."],
    tags: ["React.js", "Video", "Content"],
  },
  {
    title: "Frontend Instructor",
    big: "3",
    sub: "UnitDev · Najot Ta'lim · Alfraganus University",
    color: "#1f5a8a",
    icon: "🎓",
    subtitle: "Achievement · Teaching",
    lines: ["I have taught frontend as an instructor at UnitDev, Najot Ta'lim and Alfraganus University.", "Teaching students frontend through real projects."],
    tags: ["Teaching", "Mentoring", "Frontend"],
  },
];

export const CONTACT = {
  lines: [
    "GitHub — github.com/AbdujalilovIsmoil",
    "LinkedIn — Ismoil Abdujalilov",
    "Telegram — t.me/ismoilabdujalilov",
    "Email — ismoilbek.abdujalilov@gmail.com",
    `Website — ${PROFILE.website}`,
  ],
  tags: ["Open to work", "Frontend", "React"],
};
