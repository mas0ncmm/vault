/* ============================================================
   RESELL HQ — design tokens (clean)
   Colours, type, global styles, and the shared status/rating
   colour maps. Everything visual that page.tsx used to define
   inline now lives here so the palette can be swapped in one
   place.
   ============================================================ */

export const T = {
  bg: "#0A0A0B",
  surface: "#141416",
  raised: "#1D1D20",
  border: "#29292D",
  text: "#F5F5F4",
  sec: "#A3A3A8",
  dim: "#6B6B72",
  a1: "#4ADE80",
  a2: "#FBBF24",
  a3: "#60A5FA",
  a4: "#A3A3A8",
  a5: "#F87171",
  accent: "#EF3B45",
  accentInk: "#FFFFFF",
  accentSoft: "rgba(239,59,69,0.14)",
  accentLine: "rgba(239,59,69,0.35)",
  pos: "#4ADE80",
  posSoft: "rgba(74,222,128,0.12)",
  neg: "#FF7A7A",
  negSoft: "rgba(248,113,113,0.12)",
  blue: "#60A5FA",
};

export const display = { fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif" };
export const body = { fontFamily: "'Inter', system-ui, sans-serif" };
export const mono = { fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace" };

export const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; }
  .vscroll::-webkit-scrollbar { display: none; }
  .vscroll { scrollbar-width: none; }
  input, select, textarea, button { font-family: 'Inter', system-ui, sans-serif; }
  input:focus, select:focus, textarea:focus { outline: 2px solid rgba(239,59,69,0.6); outline-offset: 0; }
  input::placeholder, textarea::placeholder { color: #6B6B72; }
  .vanim { transition: transform 0.12s ease, opacity 0.12s ease; }
  .vanim:active { transform: scale(0.97); }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .vsheet { animation: sheetUp 0.22s cubic-bezier(.2,.8,.3,1); }
  .vfade { animation: fadeIn 0.18s ease; }
  @media (prefers-reduced-motion: reduce) {
    .vanim, .vsheet, .vfade { transition: none !important; animation: none !important; }
  }
`;

/* ---------- constants ---------- */
export const STATUSES = ["Considering","Purchased","Draft","Ready to List","Listed","Reserved","Sold","Returned","Rejected","Archived"];
export const UNSOLD = ["Purchased","Draft","Ready to List","Listed","Reserved"];
export const OWNED = ["Purchased","Draft","Ready to List","Listed","Reserved","Sold","Returned"];
export const STATUS_COLOR = {
  Considering: T.a4, Purchased: T.a4, Draft: T.a4, "Ready to List": T.a2,
  Listed: T.a3, Reserved: T.a2, Sold: T.a1, "In stock": T.pos, Returned: T.a5, Rejected: T.a5, Archived: T.dim,
};
export const CONDITIONS = ["New with tags","New without tags","Very good","Good","Satisfactory"];
export const PLATFORMS = ["Vinted","eBay","Depop","Facebook Marketplace","Other"];
export const RATINGS = ["Really Bad","Bad","Average","Good","Really Good"];
export const RATING_COLOR = { "Really Bad": T.neg, Bad: T.a4, Average: T.sec, Good: T.pos, "Really Good": T.pos };
