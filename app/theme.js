/* ============================================================
   VAULT — design tokens (aurora)
   Colours, type, global styles, and the shared status/rating
   colour maps. Everything visual that page.tsx used to define
   inline now lives here so the palette can be swapped in one
   place.
   ============================================================ */

export const T = {
  bg: "#010207",
  surface: "#0B0F1A",
  raised: "#131826",
  border: "#1E2434",
  text: "#EDEFF5",
  sec: "#8A93AC",
  dim: "#5E6884",
  a1: "#3AE8C8",
  a2: "#4AC8FF",
  a3: "#7B96FF",
  a4: "#A98CFF",
  a5: "#E08CD8",
  accent: "#4AC8FF",
  accentSoft: "rgba(74,200,255,0.12)",
  pos: "#3AE8C8",
  posSoft: "rgba(58,232,200,0.12)",
  neg: "#E08CD8",
  negSoft: "rgba(224,140,216,0.12)",
  blue: "#7B96FF",
};

export const display = { fontFamily: "'Archivo', system-ui, sans-serif" };
export const body = { fontFamily: "'Instrument Sans', system-ui, sans-serif" };
export const mono = { fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace" };

export const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@200;500;600;700&family=Instrument+Sans:wght@400;500;600&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; }
  .vscroll::-webkit-scrollbar { display: none; }
  .vscroll { scrollbar-width: none; }
  input, select, textarea, button { font-family: 'Instrument Sans', system-ui, sans-serif; }
  input:focus, select:focus, textarea:focus { outline: 2px solid rgba(74,200,255,0.5); outline-offset: 0; }

  /* ---- constellation home ---- */
  @keyframes orbBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  @keyframes starTwinkle { 0%, 100% { opacity: var(--tw-op, 0.4); } 50% { opacity: 0.08; } }
  @keyframes linePulse { 0%, 100% { opacity: 0.30; } 50% { opacity: 0.66; } }
  @keyframes orbBurst { from { transform: scale(0.35); opacity: 0.9; } to { transform: scale(11); opacity: 0; } }
  .cbreathe { animation: orbBreathe 4.4s ease-in-out infinite; }
  .ctwinkle { animation: starTwinkle var(--tw-dur, 3.4s) ease-in-out infinite; }
  .cpulse { animation: linePulse 5.2s ease-in-out infinite backwards; }
  .cburst { animation: orbBurst 560ms cubic-bezier(.22,.7,.3,1) forwards; }

  @media (prefers-reduced-motion: reduce) {
    .vanim { transition: none !important; }
    .cbreathe, .ctwinkle, .cpulse, .cburst { animation: none !important; }
  }
`;

/* ---------- constants ---------- */
export const STATUSES = ["Considering","Purchased","Draft","Ready to List","Listed","Reserved","Sold","Returned","Rejected","Archived"];
export const UNSOLD = ["Purchased","Draft","Ready to List","Listed","Reserved"];
export const OWNED = ["Purchased","Draft","Ready to List","Listed","Reserved","Sold","Returned"];
export const STATUS_COLOR = {
  Considering: T.a4, Purchased: T.a4, Draft: T.a4, "Ready to List": T.a2,
  Listed: T.a3, Reserved: T.a2, Sold: T.a1, Returned: T.a1, Rejected: T.a5, Archived: T.dim,
};
export const CONDITIONS = ["New with tags","New without tags","Very good","Good","Satisfactory"];
export const PLATFORMS = ["Vinted","eBay","Depop","Facebook Marketplace","Other"];
export const RATINGS = ["Really Bad","Bad","Average","Good","Really Good"];
export const RATING_COLOR = { "Really Bad": T.neg, Bad: T.a4, Average: T.sec, Good: T.pos, "Really Good": T.pos };
