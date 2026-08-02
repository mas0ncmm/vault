"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Home, Package, Plus, ScanSearch, BarChart3, Sparkles, Settings, ChevronRight,
  ChevronLeft, Wifi, Signal, BatteryFull, Boxes, X, Camera, Trash2, Copy, Check,
  Pencil, Archive, RotateCcw, Search, Download, Upload, AlertTriangle, Clock,
  ExternalLink, RefreshCw, Info, TrendingUp, Tag, ShieldAlert, Layers,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

/* ============================================================
   VAULT — personal Vinted reselling app (full build)
   Stock tracker · Dashboard · AI listing generator ·
   AI opportunity checker · Analytics · Backup & CSV
   ============================================================ */

/* ---------- design tokens ---------- */
const APP_VERSION = "web v1.3";
const T = {
  bg: "#0B0B0D",
  surface: "#151518",
  raised: "#1C1C21",
  border: "#26262C",
  text: "#F5F5F3",
  sec: "#8E8E97",
  accent: "#E4B54A",
  accentSoft: "rgba(228,181,74,0.12)",
  pos: "#4CC38A",
  posSoft: "rgba(76,195,138,0.12)",
  neg: "#E5534B",
  negSoft: "rgba(229,83,75,0.12)",
  blue: "#5B9BD5",
};
const display = { fontFamily: "'Archivo', system-ui, sans-serif" };
const body = { fontFamily: "'Instrument Sans', system-ui, sans-serif" };

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Instrument+Sans:wght@400;500;600&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; }
  .vscroll::-webkit-scrollbar { display: none; }
  .vscroll { scrollbar-width: none; }
  input, select, textarea, button { font-family: 'Instrument Sans', system-ui, sans-serif; }
  input:focus, select:focus, textarea:focus { outline: 2px solid rgba(228,181,74,0.5); outline-offset: 0; }
  @media (prefers-reduced-motion: reduce) { .vanim { transition: none !important; } }
`;

/* ---------- constants ---------- */
const STATUSES = ["Considering","Purchased","Draft","Ready to List","Listed","Reserved","Sold","Returned","Rejected","Archived"];
const UNSOLD = ["Purchased","Draft","Ready to List","Listed","Reserved"];
const OWNED = ["Purchased","Draft","Ready to List","Listed","Reserved","Sold","Returned"];
const STATUS_COLOR = {
  Considering: T.blue, Purchased: T.accent, Draft: T.sec, "Ready to List": T.accent,
  Listed: T.blue, Reserved: "#B58BD8", Sold: T.pos, Returned: T.neg, Rejected: T.neg, Archived: T.sec,
};
const CONDITIONS = ["New with tags","New without tags","Very good","Good","Satisfactory"];
const PLATFORMS = ["Vinted","eBay","Depop","Facebook Marketplace","Other"];
const RATINGS = ["Really Bad","Bad","Average","Good","Really Good"];
const RATING_COLOR = { "Really Bad": T.neg, Bad: "#E08B4C", Average: T.sec, Good: T.pos, "Really Good": T.pos };

/* ---------- helpers ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const has = (v) => v !== "" && v != null && isFinite(parseFloat(v));
const gbp = (n) => (n == null || !isFinite(n) ? "—" : (n < 0 ? "-£" : "£") + Math.abs(n).toFixed(2));
const pct = (n) => (n == null || !isFinite(n) ? "—" : n.toFixed(1) + "%");
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => {
  if (!a || !b) return null;
  const d = Math.round((new Date(b) - new Date(a)) / 86400000);
  return isFinite(d) ? d : null;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const clean = (s) => (s == null ? "" : String(s));

function extractJson(text) {
  const t = String(text).replace(/```json|```/g, "").trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s === -1 || e === -1 || e <= s) throw new Error("The AI reply did not contain readable data. Try again.");
  return JSON.parse(t.slice(s, e + 1));
}

const shrinkForAI = (dataUrl, maxDim = 640, q = 0.6) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale === 1) return resolve(dataUrl);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const AI_MODELS = ["claude-sonnet-5", "claude-haiku-4-5-20251001"];
const K_PASS = "vault-pass";
let passCache = null;
async function getPass() {
  if (passCache !== null) return passCache;
  passCache = (await sGet(K_PASS)) || "";
  return passCache;
}
async function setPass(v) { passCache = v || ""; await sSet(K_PASS, passCache); }

async function aiCallOnce(model, content, useSearch) {
  const bodyObj = { model, max_tokens: 3000, messages: [{ role: "user", content }] };
  if (useSearch) bodyObj.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-vault-pass": await getPass() },
    body: JSON.stringify(bodyObj),
  });
  let data = null;
  try { data = await res.json(); } catch { throw new Error("HTTP " + res.status + ": the AI service sent an unreadable reply"); }
  if (data.error) {
    const err = new Error((data.error.message || "AI request failed") + " [HTTP " + res.status + ", model " + model + "]");
    err.status = res.status;
    throw err;
  }
  const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
  if (!text) throw new Error("The AI sent an empty reply [model " + model + "]");
  return text;
}
async function askClaude({ prompt, images = [], useSearch = false }) {
  const small = [];
  for (const img of images) small.push(await shrinkForAI(img));
  const content = [];
  for (const img of small) {
    const m = /^data:(.*?);base64,(.*)$/.exec(img);
    if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  content.push({ type: "text", text: prompt });
  const errors = [];
  let authStop = false;
  outer: for (const model of AI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await aiCallOnce(model, content, useSearch); }
      catch (e) {
        errors.push(e);
        if (e.status === 401 || e.status === 403) { authStop = true; break outer; }
        await new Promise((r) => setTimeout(r, e.status === 429 ? 6000 : 1100));
      }
    }
  }
  if (!authStop && useSearch) return askClaude({ prompt: prompt + " (Web search is unavailable — use general knowledge and set confidence to Low.)", images, useSearch: false });
  if (!authStop && images.length > 1) return askClaude({ prompt: prompt + " (Note: only the first photo is attached.)", images: images.slice(0, 1), useSearch });
  const authErr = errors.find((e) => e.status === 401 || e.status === 403);
  if (authErr && /PASSPHRASE/.test(authErr.message)) throw new Error("PASSPHRASE: The app passphrase is missing or wrong. Open Settings and enter it. If you have forgotten it, check VAULT_PASSPHRASE in Vercel under Settings then Environment Variables.");
  if (authErr) throw new Error("AUTH: The API key was rejected. Check ANTHROPIC_API_KEY in Vercel (Settings then Environment Variables), make sure the key is correct and the billing account has credit, then redeploy. [" + authErr.message + "]");
  const rateErr = errors.find((e) => e.status === 429);
  if (rateErr) throw new Error("Rate limited by the AI service — wait a minute or two, then try again. [" + rateErr.message + "]");
  const msgs = [...new Set(errors.map((e) => e && e.message).filter(Boolean))].join(" | ");
  throw new Error((msgs || "AI request failed") + (images.length ? " — failed even with a single photo. Run the AI diagnostic in Settings." : ""));
}

function compressImage(file, maxDim = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith("image/")) return reject(new Error("Only image files are supported."));
    if (file.size > 15 * 1024 * 1024) return reject(new Error("Image is too large (15MB max)."));
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = r.result;
    };
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}
const makeThumb = (dataUrl) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 96 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      return true;
    } catch { return false; }
  }
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- storage ---------- */
const storageOK = typeof indexedDB !== "undefined";
const DB_NAME = "vault-db", DB_STORE = "kv";
let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Could not open local database"));
  });
  return dbPromise;
}
function idbRun(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, mode);
    const req = fn(tx.objectStore(DB_STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Storage operation failed"));
  }));
}
async function sGet(key) {
  if (!storageOK) return null;
  try { const v = await idbRun("readonly", (st) => st.get(key)); return v == null ? null : JSON.parse(v); }
  catch { return null; }
}
async function sSet(key, val) {
  if (!storageOK) throw new Error("Storage unavailable in this browser");
  await idbRun("readwrite", (st) => st.put(JSON.stringify(val), key));
}
async function sDel(key) {
  if (!storageOK) return;
  try { await idbRun("readwrite", (st) => st.delete(key)); } catch {}
}
const K_ITEMS = "vault-items";
const K_CHECKS = "vault-checks";
const imgKey = (id) => "vault-imgs-" + id;

/* ---------- calculations ---------- */
function calc(it) {
  const tpc = num(it.purchasePrice) + num(it.buyerProtection) + num(it.purchasePostage) + num(it.otherPurchaseCosts);
  const tsc = num(it.platformFees) + num(it.sellerPostage) + num(it.packagingCost) + num(it.otherSellingCosts);
  const sold = it.status === "Sold" && has(it.actualPrice);
  const profit = sold ? num(it.actualPrice) - tpc - tsc : null;
  const margin = sold && num(it.actualPrice) > 0 ? (profit / num(it.actualPrice)) * 100 : null;
  const roi = sold && tpc > 0 ? (profit / tpc) * 100 : null;
  const daysToSell = it.saleDate && it.listingDate ? daysBetween(it.listingDate, it.saleDate) : null;
  const age = it.purchaseDate && UNSOLD.includes(it.status) ? daysBetween(it.purchaseDate, todayISO()) : null;
  return { tpc, tsc, profit, margin, roi, daysToSell, age, sold };
}

function blankItem() {
  return {
    id: uid(), name: "", title: "", brand: "", model: "", category: "", subcategory: "",
    size: "", colour: "", condition: "", quantity: "1",
    purchasePrice: "", buyerProtection: "", purchasePostage: "", otherPurchaseCosts: "",
    expectedPrice: "", actualPrice: "", platform: "Vinted",
    platformFees: "", buyerPostagePaid: "", sellerPostage: "", packagingCost: "", otherSellingCosts: "",
    purchaseDate: "", listingDate: "", saleDate: "",
    storage: "", supplier: "", source: "", notes: "", tags: "", status: "Purchased",
    listingUrl: "", sku: "", barcode: "", tracking: "", buyerUsername: "", orderRef: "",
    description: "", thumb: null, imgCount: 0, checkId: null, estSnapshot: null,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

/* ============================================================
   SHARED UI
   ============================================================ */
const btnBase = { border: "none", borderRadius: 14, cursor: "pointer", fontWeight: 600, fontSize: 14.5, padding: "13px 18px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 };
function Btn({ kind = "primary", children, style, disabled, ...p }) {
  const kinds = {
    primary: { background: T.text, color: T.bg },
    accent: { background: T.accent, color: "#141210" },
    ghost: { background: T.surface, color: T.text, border: `1px solid ${T.border}` },
    danger: { background: T.negSoft, color: T.neg, border: `1px solid ${T.negSoft}` },
  };
  return (
    <button {...p} disabled={disabled} className="vanim" style={{ ...btnBase, ...kinds[kind], opacity: disabled ? 0.45 : 1, ...style }}>
      {children}
    </button>
  );
}
function Chip({ label, color, active, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      background: active ? (color || T.text) : T.surface,
      color: active ? T.bg : (color || T.sec),
      border: `1px solid ${active ? "transparent" : T.border}`,
      borderRadius: 999, padding: small ? "5px 10px" : "7px 13px",
      fontSize: small ? 11.5 : 12.5, fontWeight: 600, cursor: onClick ? "pointer" : "default",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>{label}</button>
  );
}
function StatusPill({ status }) {
  const c = STATUS_COLOR[status] || T.sec;
  return (
    <span style={{ background: `${c}1F`, color: c, borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}
function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, cursor: onClick ? "pointer" : "default", ...style }}>
      {children}
    </div>
  );
}
function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "13px 14px", minWidth: 128, flexShrink: 0 }}>
      <div style={{ ...body, fontSize: 11.5, color: T.sec, fontWeight: 500, marginBottom: 5 }}>{label}</div>
      <div style={{ ...display, fontSize: 19, fontWeight: 700, color: color || T.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ ...body, fontSize: 11, color: T.sec, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
function Fi({ label, value, onChange, type = "text", placeholder, money, textarea, options, hint }) {
  const base = {
    width: "100%", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 12,
    color: T.text, fontSize: 14.5, padding: money ? "12px 12px 12px 26px" : "12px 12px",
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ ...body, fontSize: 12.5, color: T.sec, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ position: "relative" }}>
        {money && <span style={{ position: "absolute", left: 11, top: 12, color: T.sec, fontSize: 14.5 }}>£</span>}
        {options ? (
          <select value={clean(value)} onChange={(e) => onChange(e.target.value)} style={{ ...base, appearance: "none", padding: "12px" }}>
            <option value="">—</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : textarea ? (
          <textarea value={clean(value)} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ ...base, resize: "vertical", lineHeight: 1.5 }} />
        ) : (
          <input
            type={type} value={clean(value)} placeholder={placeholder}
            inputMode={money ? "decimal" : undefined}
            onChange={(e) => onChange(e.target.value)}
            style={base}
          />
        )}
      </div>
      {hint && <div style={{ ...body, fontSize: 11, color: T.sec, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
function SectionBox({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, marginBottom: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 16px", cursor: "pointer", color: T.text }}>
        <span style={{ ...display, fontWeight: 600, fontSize: 15 }}>{title}</span>
        <ChevronRight size={17} color={T.sec} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && <div style={{ padding: "2px 16px 14px" }}>{children}</div>}
    </div>
  );
}
function Banner({ icon: Icon = Info, children, color = T.sec, bg = T.surface }) {
  return (
    <div style={{ display: "flex", gap: 10, background: bg, border: `1px solid ${T.border}`, borderRadius: 14, padding: "11px 13px", marginBottom: 12 }}>
      <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ ...body, fontSize: 12.5, color: T.sec, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
function Empty({ icon: Icon, title, desc, action }) {
  return (
    <div style={{ textAlign: "center", padding: "44px 24px" }}>
      <div style={{ width: 60, height: 60, borderRadius: 18, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <Icon size={26} color={T.accent} />
      </div>
      <div style={{ ...display, fontWeight: 700, fontSize: 18, color: T.text, marginBottom: 7 }}>{title}</div>
      <div style={{ ...body, fontSize: 13.5, color: T.sec, lineHeight: 1.55, maxWidth: 270, margin: "0 auto 20px" }}>{desc}</div>
      {action}
    </div>
  );
}
function Spinner({ label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "36px 20px" }}>
      <RefreshCw size={22} color={T.accent} style={{ animation: "vspin 1s linear infinite" }} />
      <style>{`@keyframes vspin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ ...body, fontSize: 13.5, color: T.sec, textAlign: "center" }}>{label}</div>
    </div>
  );
}
function ScreenHeader({ title, onBack, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "calc(14px + env(safe-area-inset-top, 0px)) 18px 12px", position: "sticky", top: 0, background: "rgba(11,11,13,0.92)", backdropFilter: "blur(12px)", zIndex: 10, borderBottom: `1px solid ${T.border}` }}>
      {onBack && (
        <button onClick={onBack} aria-label="Back" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: T.text, cursor: "pointer", flexShrink: 0 }}>
          <ChevronLeft size={18} />
        </button>
      )}
      <div style={{ ...display, fontWeight: 700, fontSize: 19, color: T.text, flex: 1, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      {right}
    </div>
  );
}
function PhotoGrid({ photos, onRemove, onAdd, max = 6 }) {
  const ref = useRef(null);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "1", background: T.raised }}>
            <img src={p} alt={"Photo " + (i + 1)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {onRemove && (
              <button onClick={() => onRemove(i)} aria-label="Remove photo" style={{ position: "absolute", top: 5, right: 5, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 8, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {onAdd && photos.length < max && (
          <button onClick={() => ref.current && ref.current.click()} style={{ aspectRatio: "1", borderRadius: 12, border: `1.5px dashed ${T.border}`, background: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: T.sec, cursor: "pointer" }}>
            <Camera size={20} />
            <span style={{ fontSize: 11, fontWeight: 500 }}>Add</span>
          </button>
        )}
      </div>
      {onAdd && (
        <input ref={ref} type="file" accept="image/*" multiple style={{ display: "none" }}
          onChange={async (e) => {
            const files = Array.from(e.target.files || []).slice(0, max - photos.length);
            e.target.value = "";
            await onAdd(files);
          }} />
      )}
    </div>
  );
}

/* ============================================================
   HOME
   ============================================================ */
function HomeScreen({ go, items }) {
  const soldProfit = items.filter((i) => i.status === "Sold").reduce((s, i) => s + (calc(i).profit || 0), 0);
  const unsold = items.filter((i) => UNSOLD.includes(i.status));
  const invested = unsold.reduce((s, i) => s + calc(i).tpc, 0);
  const cards = [
    { id: "stock", title: "Stock Tracker", desc: "Purchases, inventory, listings, sales and profit.", icon: Boxes },
    { id: "generator", title: "Listing Generator", desc: "Turn product photos into honest, searchable Vinted listings.", icon: Sparkles },
    { id: "checker", title: "Opportunity Checker", desc: "Analyse a listing before you buy it to resell.", icon: ScanSearch },
    { id: "analytics", title: "Analytics", desc: "What makes money, what sells fast, where cash is tied up.", icon: BarChart3 },
  ];
  return (
    <div style={{ padding: "calc(22px + env(safe-area-inset-top, 0px)) 18px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ ...display, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", color: T.text }}>Vault</div>
          <div style={{ ...body, fontSize: 13.5, color: T.sec, marginTop: 3 }}>Your reselling HQ · <b style={{ color: T.accent }}>{APP_VERSION}</b></div>
        </div>
        <button onClick={() => go({ name: "settings" })} aria-label="Settings" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: T.sec, cursor: "pointer" }}>
          <Settings size={18} />
        </button>
      </div>

      {items.length > 0 && (
        <div className="vscroll" style={{ display: "flex", gap: 10, overflowX: "auto", marginTop: 18, paddingBottom: 2 }}>
          <StatCard label="Total profit" value={gbp(soldProfit)} color={soldProfit > 0 ? T.pos : soldProfit < 0 ? T.neg : T.text} />
          <StatCard label="In stock" value={unsold.length} sub="unsold items" />
          <StatCard label="Invested" value={gbp(invested)} sub="in unsold stock" />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
        {cards.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => go({ name: s.id })} className="vanim"
              style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: "17px 16px", cursor: "pointer", color: T.text }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={22} color={T.accent} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...display, fontWeight: 600, fontSize: 16, marginBottom: 3 }}>{s.title}</div>
                <div style={{ ...body, fontSize: 13, color: T.sec, lineHeight: 1.45 }}>{s.desc}</div>
              </div>
              <ChevronRight size={18} color={T.sec} style={{ flexShrink: 0 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   STOCK LIST + DASHBOARD
   ============================================================ */
function StockScreen({ items, go }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("Newest");
  const [showDash, setShowDash] = useState(true);

  const brands = useMemo(() => [...new Set(items.map((i) => i.brand).filter(Boolean))].sort(), [items]);
  const cats = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    let list = items.filter((i) => (status === "Archived" ? i.status === "Archived" : i.status !== "Archived"));
    if (status !== "All" && status !== "Archived") list = list.filter((i) => i.status === status);
    if (brand) list = list.filter((i) => i.brand === brand);
    if (category) list = list.filter((i) => i.category === category);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((i) =>
        [i.name, i.title, i.brand, i.category, i.size, i.colour, i.sku, i.notes, i.storage]
          .some((f) => clean(f).toLowerCase().includes(s))
      );
    }
    const by = {
      Newest: (a, b) => b.createdAt - a.createdAt,
      Oldest: (a, b) => a.createdAt - b.createdAt,
      "Price high": (a, b) => num(b.purchasePrice) - num(a.purchasePrice),
      "Price low": (a, b) => num(a.purchasePrice) - num(b.purchasePrice),
      "Profit high": (a, b) => (calc(b).profit ?? -1e9) - (calc(a).profit ?? -1e9),
      "Profit low": (a, b) => (calc(a).profit ?? 1e9) - (calc(b).profit ?? 1e9),
      "Margin high": (a, b) => (calc(b).margin ?? -1e9) - (calc(a).margin ?? -1e9),
      "Oldest unsold": (a, b) => (calc(b).age ?? -1) - (calc(a).age ?? -1),
      "A–Z": (a, b) => clean(a.name).localeCompare(clean(b.name)),
    };
    return [...list].sort(by[sort] || by.Newest);
  }, [items, q, status, brand, category, sort]);

  const active = items.filter((i) => i.status !== "Archived");
  const soldItems = active.filter((i) => i.status === "Sold");
  const revenue = soldItems.reduce((s, i) => s + num(i.actualPrice), 0);
  const profit = soldItems.reduce((s, i) => s + (calc(i).profit || 0), 0);
  const spent = active.filter((i) => OWNED.includes(i.status)).reduce((s, i) => s + calc(i).tpc, 0);
  const unsoldItems = active.filter((i) => UNSOLD.includes(i.status));
  const invested = unsoldItems.reduce((s, i) => s + calc(i).tpc, 0);
  const estValue = unsoldItems.reduce((s, i) => s + num(i.expectedPrice), 0);
  const soldDays = soldItems.map((i) => calc(i).daysToSell).filter((d) => d != null);
  const avgDays = soldDays.length ? soldDays.reduce((a, b) => a + b, 0) / soldDays.length : null;

  return (
    <>
      <ScreenHeader title="Stock" onBack={() => go({ name: "home" })}
        right={<Btn kind="accent" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => go({ name: "edit", id: null })}><Plus size={15} /> Add</Btn>} />
      <div style={{ padding: "14px 18px 18px" }}>
        <button onClick={() => setShowDash(!showDash)} style={{ background: "none", border: "none", color: T.sec, ...body, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 8 }}>
          {showDash ? "Hide" : "Show"} dashboard
        </button>
        {showDash && (
          <div className="vscroll" style={{ display: "flex", gap: 10, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
            <StatCard label="Revenue" value={gbp(revenue)} sub={`${soldItems.length} sold`} />
            <StatCard label="Profit" value={gbp(profit)} color={profit > 0 ? T.pos : profit < 0 ? T.neg : T.text} />
            <StatCard label="Spent on stock" value={gbp(spent)} />
            <StatCard label="Invested (unsold)" value={gbp(invested)} sub={`${unsoldItems.length} items`} />
            <StatCard label="Est. unsold value" value={gbp(estValue)} sub="from expected prices" />
            <StatCard label="Avg days to sell" value={avgDays == null ? "—" : Math.round(avgDays)} />
          </div>
        )}

        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={16} color={T.sec} style={{ position: "absolute", left: 12, top: 13 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, brand, SKU, notes…"
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, color: T.text, fontSize: 14, padding: "12px 12px 12px 36px" }} />
        </div>

        <div className="vscroll" style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 10, paddingBottom: 2 }}>
          {["All", ...STATUSES].map((s) => (
            <Chip key={s} label={s} active={status === s} onClick={() => setStatus(s)} color={s !== "All" ? STATUS_COLOR[s] : undefined} small />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[["Brand", brand, setBrand, brands], ["Category", category, setCategory, cats]].map(([lab, val, set, opts]) => (
            <select key={lab} value={val} onChange={(e) => set(e.target.value)}
              style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, color: val ? T.text : T.sec, fontSize: 12.5, padding: "9px 10px" }}>
              <option value="">{lab}: all</option>
              {opts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          <select value={sort} onChange={(e) => setSort(e.target.value)}
            style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, color: T.text, fontSize: 12.5, padding: "9px 10px" }}>
            {["Newest","Oldest","Price high","Price low","Profit high","Profit low","Margin high","Oldest unsold","A–Z"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          items.length === 0 ? (
            <Empty icon={Boxes} title="No stock yet" desc="Add your first item and Vault will start tracking costs, profit and selling speed."
              action={<Btn kind="accent" onClick={() => go({ name: "edit", id: null })}><Plus size={16} /> Add first item</Btn>} />
          ) : (
            <Empty icon={Search} title="Nothing matches" desc="No items match the current search and filters." />
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((it) => {
              const c = calc(it);
              return (
                <Card key={it.id} onClick={() => go({ name: "detail", id: it.id })} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: T.raised, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {it.thumb ? <img src={it.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Tag size={18} color={T.sec} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...body, fontWeight: 600, fontSize: 14.5, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {it.name || it.title || "Untitled item"}
                    </div>
                    <div style={{ ...body, fontSize: 12, color: T.sec, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {[it.brand, it.size, it.category].filter(Boolean).join(" · ") || "No details"}
                    </div>
                    <div style={{ marginTop: 5, display: "flex", gap: 6, alignItems: "center" }}>
                      <StatusPill status={it.status} />
                      {c.age != null && c.age > 30 && (
                        <span style={{ ...body, fontSize: 10.5, color: c.age > 60 ? T.neg : T.sec }}>{c.age}d in stock</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {c.sold ? (
                      <>
                        <div style={{ ...display, fontWeight: 700, fontSize: 15, color: c.profit >= 0 ? T.pos : T.neg, fontVariantNumeric: "tabular-nums" }}>{gbp(c.profit)}</div>
                        <div style={{ ...body, fontSize: 11, color: T.sec }}>profit</div>
                      </>
                    ) : (
                      <>
                        <div style={{ ...display, fontWeight: 700, fontSize: 15, color: T.text, fontVariantNumeric: "tabular-nums" }}>{has(it.purchasePrice) ? gbp(c.tpc) : "—"}</div>
                        <div style={{ ...body, fontSize: 11, color: T.sec }}>cost</div>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================
   ITEM DETAIL
   ============================================================ */
function DetailScreen({ items, go, updateItem, deleteItem, duplicateItem, toast }) {
  const it = items.find((i) => i.id === (go.params && go.params.id));
  return <DetailInner key={it ? it.id : "none"} it={it} go={go.go} updateItem={updateItem} deleteItem={deleteItem} duplicateItem={duplicateItem} toast={toast} />;
}
function DetailInner({ it, go, updateItem, deleteItem, duplicateItem, toast }) {
  const [photos, setPhotos] = useState([]);
  const [soldPanel, setSoldPanel] = useState(false);
  const [soldPrice, setSoldPrice] = useState("");
  const [soldDate, setSoldDate] = useState(todayISO());
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    let live = true;
    if (it && it.imgCount > 0) sGet(imgKey(it.id)).then((p) => { if (live && Array.isArray(p)) setPhotos(p); });
    return () => { live = false; };
  }, [it && it.id, it && it.imgCount]);

  if (!it) return <Empty icon={AlertTriangle} title="Item not found" desc="This item may have been deleted." action={<Btn onClick={() => go({ name: "stock" })}>Back to stock</Btn>} />;

  const c = calc(it);
  const rows = [
    ["Brand", it.brand], ["Model", it.model], ["Category", [it.category, it.subcategory].filter(Boolean).join(" / ")],
    ["Size", it.size], ["Colour", it.colour], ["Condition", it.condition], ["Quantity", it.quantity],
    ["Platform", it.platform], ["Storage location", it.storage], ["Supplier", it.supplier], ["Source", it.source],
    ["SKU", it.sku], ["Order ref", it.orderRef], ["Buyer", it.buyerUsername], ["Tracking", it.tracking],
    ["Purchased", it.purchaseDate ? fmtDate(it.purchaseDate) : ""], ["Listed", it.listingDate ? fmtDate(it.listingDate) : ""],
    ["Sold", it.saleDate ? fmtDate(it.saleDate) : ""], ["Tags", it.tags],
  ].filter(([, v]) => clean(v).trim() !== "");

  const markSold = () => {
    if (!has(soldPrice)) { toast("Enter the sale price first", true); return; }
    updateItem({ ...it, status: "Sold", actualPrice: soldPrice, saleDate: soldDate, updatedAt: Date.now() });
    setSoldPanel(false);
    toast("Marked as sold");
  };

  return (
    <>
      <ScreenHeader title={it.name || "Item"} onBack={() => go({ name: "stock" })}
        right={<Btn kind="ghost" style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => go({ name: "edit", id: it.id })}><Pencil size={14} /> Edit</Btn>} />
      <div style={{ padding: "16px 18px 24px" }}>
        {photos.length > 0 && (
          <div className="vscroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14 }}>
            {photos.map((p, i) => (
              <img key={i} src={p} alt={"Photo " + (i + 1)} style={{ height: 150, borderRadius: 14, flexShrink: 0 }} />
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <StatusPill status={it.status} />
          <select value={it.status} onChange={(e) => { updateItem({ ...it, status: e.target.value, updatedAt: Date.now() }); toast("Status updated"); }}
            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 12.5, padding: "7px 9px" }}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          {it.listingUrl && (
            <a href={it.listingUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.blue, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
              <ExternalLink size={13} /> Open listing
            </a>
          )}
        </div>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ ...body, fontSize: 11.5, color: T.sec }}>Total purchase cost</div>
              <div style={{ ...display, fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{gbp(c.tpc)}</div>
            </div>
            <div>
              <div style={{ ...body, fontSize: 11.5, color: T.sec }}>Selling costs</div>
              <div style={{ ...display, fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{gbp(c.tsc)}</div>
            </div>
            <div>
              <div style={{ ...body, fontSize: 11.5, color: T.sec }}>{c.sold ? "Sold for" : "Expected price"}</div>
              <div style={{ ...display, fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {c.sold ? gbp(num(it.actualPrice)) : has(it.expectedPrice) ? gbp(num(it.expectedPrice)) : "—"}
              </div>
            </div>
            <div>
              <div style={{ ...body, fontSize: 11.5, color: T.sec }}>Profit</div>
              <div style={{ ...display, fontSize: 18, fontWeight: 700, color: c.profit == null ? T.sec : c.profit >= 0 ? T.pos : T.neg, fontVariantNumeric: "tabular-nums" }}>
                {c.profit == null ? "Not sold yet" : gbp(c.profit)}
              </div>
            </div>
          </div>
          {c.sold && (
            <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              <div style={{ ...body, fontSize: 12, color: T.sec }}>Margin <b style={{ color: T.text }}>{pct(c.margin)}</b></div>
              <div style={{ ...body, fontSize: 12, color: T.sec }}>ROI <b style={{ color: T.text }}>{pct(c.roi)}</b></div>
              {c.daysToSell != null && <div style={{ ...body, fontSize: 12, color: T.sec }}>Sold in <b style={{ color: T.text }}>{c.daysToSell}d</b></div>}
            </div>
          )}
          {!c.sold && c.age != null && (
            <div style={{ ...body, fontSize: 12, color: c.age > 60 ? T.neg : T.sec, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              In stock for {c.age} days{c.age > 60 ? " — consider a price reduction or relist" : ""}
            </div>
          )}
        </Card>

        {it.status !== "Sold" && (
          <div style={{ marginBottom: 12 }}>
            {!soldPanel ? (
              <Btn kind="accent" style={{ width: "100%" }} onClick={() => { setSoldPrice(clean(it.actualPrice) || clean(it.expectedPrice)); setSoldPanel(true); }}>
                <Check size={16} /> Mark as sold
              </Btn>
            ) : (
              <Card>
                <Fi label="Sold for" value={soldPrice} onChange={setSoldPrice} money placeholder="0.00" />
                <Fi label="Sale date" value={soldDate} onChange={setSoldDate} type="date" />
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn kind="accent" style={{ flex: 1 }} onClick={markSold}>Confirm sale</Btn>
                  <Btn kind="ghost" onClick={() => setSoldPanel(false)}>Cancel</Btn>
                </div>
              </Card>
            )}
          </div>
        )}

        {(it.title || it.description) && (
          <Card style={{ marginBottom: 12 }}>
            {it.title && <div style={{ ...body, fontWeight: 600, fontSize: 14, marginBottom: it.description ? 8 : 0 }}>{it.title}</div>}
            {it.description && <div style={{ ...body, fontSize: 13, color: T.sec, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{it.description}</div>}
            <Btn kind="ghost" style={{ marginTop: 12, padding: "9px 14px", fontSize: 13 }}
              onClick={async () => { const ok = await copyText([it.title, it.description].filter(Boolean).join("\n\n")); toast(ok ? "Listing copied" : "Copy failed", !ok); }}>
              <Copy size={14} /> Copy listing text
            </Btn>
          </Card>
        )}

        {it.estSnapshot && (
          <Banner icon={ScanSearch}>
            From Opportunity Checker: rated <b style={{ color: RATING_COLOR[it.estSnapshot.rating] }}>{it.estSnapshot.rating}</b>, estimated resale {gbp(it.estSnapshot.priceLikely)} / profit {gbp(it.estSnapshot.profitLikely)} ({it.estSnapshot.confidence} confidence). Estimates, not guarantees.
          </Banner>
        )}

        {rows.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ ...body, fontSize: 12.5, color: T.sec }}>{k}</span>
                <span style={{ ...body, fontSize: 12.5, color: T.text, textAlign: "right", fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </Card>
        )}
        {it.notes && (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ ...body, fontSize: 12, color: T.sec, marginBottom: 5, fontWeight: 600 }}>Notes</div>
            <div style={{ ...body, fontSize: 13, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{it.notes}</div>
          </Card>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn kind="ghost" style={{ flex: 1 }} onClick={() => { duplicateItem(it); toast("Item duplicated"); }}><Layers size={15} /> Duplicate</Btn>
          {it.status !== "Archived" ? (
            <Btn kind="ghost" style={{ flex: 1 }} onClick={() => { updateItem({ ...it, status: "Archived", updatedAt: Date.now() }); toast("Archived"); }}><Archive size={15} /> Archive</Btn>
          ) : (
            <Btn kind="ghost" style={{ flex: 1 }} onClick={() => { updateItem({ ...it, status: "Draft", updatedAt: Date.now() }); toast("Restored to Draft"); }}><RotateCcw size={15} /> Restore</Btn>
          )}
          <Btn kind="danger" style={{ width: "100%" }} onClick={() => {
            if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3500); return; }
            deleteItem(it.id); go({ name: "stock" }); toast("Item deleted");
          }}>
            <Trash2 size={15} /> {confirmDel ? "Tap again to permanently delete" : "Delete item"}
          </Btn>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   ITEM FORM (add / edit)
   ============================================================ */
function EditScreen({ items, go, saveItem, toast, prefill }) {
  const editingId = go.params && go.params.id;
  const existing = editingId ? items.find((i) => i.id === editingId) : null;
  return <EditInner key={editingId || "new"} existing={existing} prefill={prefill} go={go.go} saveItem={saveItem} toast={toast} />;
}
function EditInner({ existing, prefill, go, saveItem, toast }) {
  const [it, setIt] = useState(() => existing ? { ...existing } : { ...blankItem(), ...(prefill || {}) });
  const [photos, setPhotos] = useState(prefill && prefill.__photos ? prefill.__photos : []);
  const [photosLoaded, setPhotosLoaded] = useState(!existing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    if (existing && existing.imgCount > 0) {
      sGet(imgKey(existing.id)).then((p) => { if (live) { if (Array.isArray(p)) setPhotos(p); setPhotosLoaded(true); } });
    } else setPhotosLoaded(true);
    return () => { live = false; };
  }, []);

  const set = (k) => (v) => setIt((prev) => ({ ...prev, [k]: v }));

  const addPhotos = async (files) => {
    const out = [];
    for (const f of files) {
      try { out.push(await compressImage(f)); }
      catch (e) { toast(e.message, true); }
    }
    setPhotos((p) => [...p, ...out].slice(0, 6));
  };

  const doSave = async () => {
    if (!clean(it.name).trim() && !clean(it.title).trim()) { toast("Give the item a name first", true); return; }
    setSaving(true);
    try {
      const thumb = photos.length ? await makeThumb(photos[0]) : null;
      const rec = { ...it, thumb, imgCount: photos.length, updatedAt: Date.now() };
      await saveItem(rec, photos);
      toast(existing ? "Item updated" : "Item added");
      go({ name: "detail", id: rec.id });
    } catch (e) {
      toast("Save failed: " + e.message, true);
    } finally { setSaving(false); }
  };

  return (
    <>
      <ScreenHeader title={existing ? "Edit item" : "Add item"} onBack={() => go(existing ? { name: "detail", id: existing.id } : { name: "stock" })} />
      <div style={{ padding: "16px 18px 24px" }}>
        <SectionBox title="Photos">
          {photosLoaded ? <PhotoGrid photos={photos} onRemove={(i) => setPhotos((p) => p.filter((_, x) => x !== i))} onAdd={addPhotos} /> : <Spinner label="Loading photos…" />}
        </SectionBox>

        <SectionBox title="Basics">
          <Fi label="Item name *" value={it.name} onChange={set("name")} placeholder="e.g. Carhartt hoodie grey L" />
          <Fi label="Listing title" value={it.title} onChange={set("title")} placeholder="Title used on Vinted" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10 }}>
            <Fi label="Brand" value={it.brand} onChange={set("brand")} />
            <Fi label="Model" value={it.model} onChange={set("model")} />
            <Fi label="Category" value={it.category} onChange={set("category")} placeholder="e.g. Hoodies" />
            <Fi label="Subcategory" value={it.subcategory} onChange={set("subcategory")} />
            <Fi label="Size" value={it.size} onChange={set("size")} />
            <Fi label="Colour" value={it.colour} onChange={set("colour")} />
            <Fi label="Condition" value={it.condition} onChange={set("condition")} options={CONDITIONS} />
            <Fi label="Quantity" value={it.quantity} onChange={set("quantity")} type="text" />
            <Fi label="Status" value={it.status} onChange={set("status")} options={STATUSES} />
            <Fi label="Platform" value={it.platform} onChange={set("platform")} options={PLATFORMS} />
          </div>
          <Fi label="Tags" value={it.tags} onChange={set("tags")} placeholder="comma, separated, tags" />
        </SectionBox>

        <SectionBox title="Buying costs">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10 }}>
            <Fi label="Purchase price" value={it.purchasePrice} onChange={set("purchasePrice")} money placeholder="0.00" />
            <Fi label="Buyer protection fee" value={it.buyerProtection} onChange={set("buyerProtection")} money placeholder="0.00" />
            <Fi label="Postage you paid" value={it.purchasePostage} onChange={set("purchasePostage")} money placeholder="0.00" />
            <Fi label="Other buying costs" value={it.otherPurchaseCosts} onChange={set("otherPurchaseCosts")} money placeholder="0.00" />
          </div>
          <Fi label="Expected selling price" value={it.expectedPrice} onChange={set("expectedPrice")} money placeholder="0.00" />
        </SectionBox>

        <SectionBox title="Sale details" defaultOpen={it.status === "Sold"}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10 }}>
            <Fi label="Actual selling price" value={it.actualPrice} onChange={set("actualPrice")} money placeholder="0.00" />
            <Fi label="Platform fees" value={it.platformFees} onChange={set("platformFees")} money placeholder="0.00" hint="Usually £0 on Vinted" />
            <Fi label="Postage buyer paid" value={it.buyerPostagePaid} onChange={set("buyerPostagePaid")} money placeholder="0.00" />
            <Fi label="Postage you paid" value={it.sellerPostage} onChange={set("sellerPostage")} money placeholder="0.00" />
            <Fi label="Packaging cost" value={it.packagingCost} onChange={set("packagingCost")} money placeholder="0.00" />
            <Fi label="Other selling costs" value={it.otherSellingCosts} onChange={set("otherSellingCosts")} money placeholder="0.00" />
          </div>
        </SectionBox>

        <SectionBox title="Dates" defaultOpen={false}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10 }}>
            <Fi label="Purchase date" value={it.purchaseDate} onChange={set("purchaseDate")} type="date" />
            <Fi label="Listing date" value={it.listingDate} onChange={set("listingDate")} type="date" />
            <Fi label="Sale date" value={it.saleDate} onChange={set("saleDate")} type="date" />
          </div>
        </SectionBox>

        <SectionBox title="References & logistics" defaultOpen={false}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10 }}>
            <Fi label="Storage location" value={it.storage} onChange={set("storage")} placeholder="e.g. Box 2" />
            <Fi label="Supplier / seller" value={it.supplier} onChange={set("supplier")} />
            <Fi label="Source" value={it.source} onChange={set("source")} placeholder="e.g. Vinted, car boot" />
            <Fi label="SKU / stock no." value={it.sku} onChange={set("sku")} />
            <Fi label="Barcode" value={it.barcode} onChange={set("barcode")} />
            <Fi label="Order reference" value={it.orderRef} onChange={set("orderRef")} />
            <Fi label="Buyer username" value={it.buyerUsername} onChange={set("buyerUsername")} />
            <Fi label="Tracking number" value={it.tracking} onChange={set("tracking")} />
          </div>
          <Fi label="Listing URL" value={it.listingUrl} onChange={set("listingUrl")} placeholder="https://…" />
        </SectionBox>

        <SectionBox title="Listing text & notes" defaultOpen={false}>
          <Fi label="Description" value={it.description} onChange={set("description")} textarea placeholder="Listing description" />
          <Fi label="Notes" value={it.notes} onChange={set("notes")} textarea placeholder="Private notes" />
        </SectionBox>

        <Btn kind="accent" style={{ width: "100%" }} disabled={saving} onClick={doSave}>
          {saving ? "Saving…" : existing ? "Save changes" : "Add to stock"}
        </Btn>
      </div>
    </>
  );
}

/* ============================================================
   LISTING GENERATOR
   ============================================================ */
const GEN_HONESTY = `HONESTY RULES: Never claim the item is authentic, genuine, new, unused, sealed, complete, undamaged, rare, vintage, limited edition, or a specific exact model unless the user's confirmed details say so or it is clearly visible. Never invent measurements, materials, or product history. Never hide flaws. If unsure about something, list it in "needsConfirmation" instead of guessing. Do not add the word "authentic" for search optimisation.`;

function GeneratorScreen({ go, saveItem, toast }) {
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [d, setD] = useState({});
  const [out, setOut] = useState(null);
  const [copied, setCopied] = useState(null);

  const setF = (k) => (v) => setD((p) => ({ ...p, [k]: v }));

  const addPhotos = async (files) => {
    const outP = [];
    for (const f of files) { try { outP.push(await compressImage(f)); } catch (e) { toast(e.message, true); } }
    setPhotos((p) => [...p, ...outP].slice(0, 6));
  };

  const analyse = async () => {
    setBusy("Looking at your photos…"); setErr(null);
    try {
      const text = await askClaude({
        images: photos,
        prompt: `You are helping a UK Vinted reseller. All the attached photos show ONE product. Identify what you can actually see. ${GEN_HONESTY}
Respond with ONLY a JSON object, no other text:
{"name":"short internal item name","brand":"","model":"","category":"","subcategory":"","size":"","colour":"","condition":"one of: New with tags, New without tags, Very good, Good, Satisfactory","visibleFlaws":"","materials":"","keywords":["..."],"needsConfirmation":["things you could not verify from photos"]}
Use "" for anything you cannot see. Never guess sizes from photos unless a label is clearly readable.`,
      });
      const j = extractJson(text);
      setD({
        name: clean(j.name), brand: clean(j.brand), model: clean(j.model), category: clean(j.category),
        subcategory: clean(j.subcategory), size: clean(j.size), colour: clean(j.colour),
        condition: CONDITIONS.includes(j.condition) ? j.condition : "", visibleFlaws: clean(j.visibleFlaws),
        materials: clean(j.materials), measurements: "", missingParts: "", sealed: "", used: "",
        packaging: "", packagingCondition: "", ageYear: "", other: "",
        needsConfirmation: Array.isArray(j.needsConfirmation) ? j.needsConfirmation : [],
      });
      setStep(2);
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const generate = async (modifier) => {
    setBusy(modifier ? "Rewriting…" : "Writing your listing…"); setErr(null);
    try {
      const confirmed = { ...d }; delete confirmed.needsConfirmation;
      const text = await askClaude({
        images: photos,
        prompt: `You are writing a Vinted UK listing. The photos show one product. The seller has CONFIRMED these details (treat them as true, do not contradict them): ${JSON.stringify(confirmed)}.
${GEN_HONESTY}
${modifier ? "Adjustment requested: " + modifier + (out ? " Current title: " + JSON.stringify(out.title) + " Current description: " + JSON.stringify(out.description) : "") : ""}
Write a searchable Vinted title (under 70 characters, key search words first, no emoji spam) and an honest, clear description (short paragraphs, mention condition and any flaws, no false claims). Suggest a realistic UK resale price range — this is an estimate from general knowledge, not live market data.
Respond with ONLY a JSON object:
{"title":"","description":"","keywords":["..."],"priceLow":0,"priceLikely":0,"priceHigh":0,"needsConfirmation":["..."]}`,
      });
      const j = extractJson(text);
      setOut({
        title: clean(j.title), description: clean(j.description),
        keywords: Array.isArray(j.keywords) ? j.keywords : [],
        priceLow: num(j.priceLow), priceLikely: num(j.priceLikely), priceHigh: num(j.priceHigh),
        needsConfirmation: Array.isArray(j.needsConfirmation) ? j.needsConfirmation : [],
      });
      setStep(3);
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const doCopy = async (what, textV) => {
    const ok = await copyText(textV);
    if (ok) { setCopied(what); setTimeout(() => setCopied(null), 1800); }
    else toast("Copy failed", true);
  };

  const saveToStock = async (asDraft) => {
    setBusy("Saving…");
    try {
      const thumb = photos.length ? await makeThumb(photos[0]) : null;
      const rec = {
        ...blankItem(),
        name: d.name || out.title.slice(0, 40), title: out.title, description: out.description,
        brand: d.brand, model: d.model, category: d.category, subcategory: d.subcategory,
        size: d.size, colour: d.colour, condition: d.condition,
        expectedPrice: out.priceLikely ? String(out.priceLikely) : "",
        keywords: undefined, tags: (out.keywords || []).slice(0, 6).join(", "),
        status: asDraft ? "Draft" : "Ready to List", platform: "Vinted",
        notes: [d.visibleFlaws && "Flaws: " + d.visibleFlaws, d.materials && "Materials: " + d.materials, d.measurements && "Measurements: " + d.measurements].filter(Boolean).join("\n"),
        thumb, imgCount: photos.length,
      };
      await saveItem(rec, photos);
      toast("Saved to stock");
      go({ name: "detail", id: rec.id });
    } catch (e) { toast("Save failed: " + e.message, true); }
    finally { setBusy(null); }
  };

  const reset = () => { setStep(1); setPhotos([]); setD({}); setOut(null); setErr(null); };

  return (
    <>
      <ScreenHeader title="Listing Generator" onBack={() => go({ name: "home" })} />
      <div style={{ padding: "16px 18px 24px" }}>
        {busy ? <Spinner label={busy} /> : (
          <>
            {err && (
              <Banner icon={AlertTriangle} color={T.neg} bg={T.negSoft}>
                {err} <button onClick={() => setErr(null)} style={{ background: "none", border: "none", color: T.neg, fontWeight: 600, cursor: "pointer", fontSize: 12.5, padding: 0, marginLeft: 4 }}>Dismiss</button>
              </Banner>
            )}

            {step === 1 && (
              <>
                <Banner icon={Camera}>Add photos of one product — front, back, labels, and any flaws. Vault reads them together and drafts an honest listing you can edit.</Banner>
                <Card style={{ marginBottom: 14 }}>
                  <PhotoGrid photos={photos} onRemove={(i) => setPhotos((p) => p.filter((_, x) => x !== i))} onAdd={addPhotos} />
                </Card>
                <Btn kind="accent" style={{ width: "100%" }} disabled={photos.length === 0} onClick={analyse}>
                  <Sparkles size={16} /> Analyse photos
                </Btn>
                <div style={{ ...body, fontSize: 11.5, color: T.sec, marginTop: 10, lineHeight: 1.5 }}>
                  Photos are sent to Claude (Anthropic) for analysis. Nothing else in your inventory is shared.
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <Banner icon={Info}>This is what was detected from the photos. <b>Check everything</b> — correct anything wrong before generating. The listing will only claim what you confirm here.</Banner>
                {d.needsConfirmation && d.needsConfirmation.length > 0 && (
                  <Banner icon={AlertTriangle} color={T.accent}>
                    Couldn't verify from photos: {d.needsConfirmation.join("; ")}
                  </Banner>
                )}
                <SectionBox title="Product details">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10 }}>
                    <Fi label="Brand" value={d.brand} onChange={setF("brand")} />
                    <Fi label="Model" value={d.model} onChange={setF("model")} />
                    <Fi label="Category" value={d.category} onChange={setF("category")} />
                    <Fi label="Subcategory" value={d.subcategory} onChange={setF("subcategory")} />
                    <Fi label="Size" value={d.size} onChange={setF("size")} />
                    <Fi label="Colour" value={d.colour} onChange={setF("colour")} />
                  </div>
                  <Fi label="Condition" value={d.condition} onChange={setF("condition")} options={CONDITIONS} />
                  <Fi label="Measurements" value={d.measurements} onChange={setF("measurements")} placeholder="e.g. pit to pit 58cm" />
                  <Fi label="Visible flaws" value={d.visibleFlaws} onChange={setF("visibleFlaws")} placeholder="Be honest — buyers check" />
                  <Fi label="Missing parts" value={d.missingParts} onChange={setF("missingParts")} />
                  <Fi label="Materials" value={d.materials} onChange={setF("materials")} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10 }}>
                    <Fi label="Sealed?" value={d.sealed} onChange={setF("sealed")} options={["Yes","No","Unknown"]} />
                    <Fi label="Used?" value={d.used} onChange={setF("used")} options={["Yes","No","Unknown"]} />
                    <Fi label="Packaging included?" value={d.packaging} onChange={setF("packaging")} options={["Yes","No","Unknown"]} />
                    <Fi label="Age / release year" value={d.ageYear} onChange={setF("ageYear")} />
                  </div>
                  <Fi label="Anything else important" value={d.other} onChange={setF("other")} textarea />
                </SectionBox>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn kind="ghost" onClick={() => setStep(1)}>Back</Btn>
                  <Btn kind="accent" style={{ flex: 1 }} onClick={() => generate(null)}><Sparkles size={16} /> Generate listing</Btn>
                </div>
              </>
            )}

            {step === 3 && out && (
              <>
                {out.needsConfirmation.length > 0 && (
                  <Banner icon={AlertTriangle} color={T.accent}>Still needs your confirmation: {out.needsConfirmation.join("; ")}</Banner>
                )}
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ ...body, fontSize: 12, color: T.sec, fontWeight: 600, marginBottom: 6 }}>Title ({out.title.length} chars)</div>
                  <textarea value={out.title} onChange={(e) => setOut({ ...out, title: e.target.value })} rows={2}
                    style={{ width: "100%", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, fontSize: 14.5, padding: 12, resize: "vertical", lineHeight: 1.4 }} />
                  <div style={{ ...body, fontSize: 12, color: T.sec, fontWeight: 600, margin: "12px 0 6px" }}>Description</div>
                  <textarea value={out.description} onChange={(e) => setOut({ ...out, description: e.target.value })} rows={8}
                    style={{ width: "100%", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, fontSize: 14, padding: 12, resize: "vertical", lineHeight: 1.55 }} />
                </Card>

                <Card style={{ marginBottom: 12 }}>
                  <div style={{ ...body, fontSize: 12, color: T.sec, fontWeight: 600, marginBottom: 8 }}>Suggested price range (AI estimate — not live market data)</div>
                  <div style={{ display: "flex", gap: 14 }}>
                    {[["Low", out.priceLow], ["Likely", out.priceLikely], ["High", out.priceHigh]].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ ...body, fontSize: 11, color: T.sec }}>{k}</div>
                        <div style={{ ...display, fontSize: 17, fontWeight: 700, color: k === "Likely" ? T.accent : T.text, fontVariantNumeric: "tabular-nums" }}>{gbp(v)}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="vscroll" style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
                  <Chip label="↻ Title" onClick={() => generate("Rewrite ONLY the title, keep the description the same.")} small />
                  <Chip label="↻ Description" onClick={() => generate("Rewrite ONLY the description, keep the title the same.")} small />
                  <Chip label="Shorter" onClick={() => generate("Make the description shorter and punchier.")} small />
                  <Chip label="More detailed" onClick={() => generate("Make the description more detailed.")} small />
                  <Chip label="More searchable" onClick={() => generate("Make the title and keywords more searchable for Vinted search.")} small />
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <Btn kind="ghost" style={{ flex: 1 }} onClick={() => doCopy("title", out.title)}>{copied === "title" ? <Check size={15} /> : <Copy size={15} />} Title</Btn>
                  <Btn kind="ghost" style={{ flex: 1 }} onClick={() => doCopy("desc", out.description)}>{copied === "desc" ? <Check size={15} /> : <Copy size={15} />} Description</Btn>
                  <Btn kind="ghost" style={{ flex: 1 }} onClick={() => doCopy("all", out.title + "\n\n" + out.description)}>{copied === "all" ? <Check size={15} /> : <Copy size={15} />} All</Btn>
                </div>
                <Btn kind="accent" style={{ width: "100%", marginBottom: 8 }} onClick={() => saveToStock(false)}><Package size={16} /> Save to Stock Tracker</Btn>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn kind="ghost" style={{ flex: 1 }} onClick={() => saveToStock(true)}>Save as draft</Btn>
                  <Btn kind="ghost" style={{ flex: 1 }} onClick={reset}>Start again</Btn>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ============================================================
   OPPORTUNITY CHECKER
   ============================================================ */
function CheckerScreen({ go, saveItem, saveCheck, toast }) {
  const [step, setStep] = useState(1);
  const [shots, setShots] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [f, setFAll] = useState({});
  const [notConfirmed, setNotConfirmed] = useState([]);
  const [a, setA] = useState(null);

  const setF = (k) => (v) => setFAll((p) => ({ ...p, [k]: v }));

  const addShots = async (files) => {
    const out = [];
    for (const file of files) { try { out.push(await compressImage(file)); } catch (e) { toast(e.message, true); } }
    setShots((p) => [...p, ...out].slice(0, 6));
  };

  const readListing = async () => {
    setBusy("Reading the listing screenshots…"); setErr(null);
    try {
      const text = await askClaude({
        images: shots,
        prompt: `The attached screenshots are all from ONE online marketplace listing (likely Vinted UK). Treat them as one listing, not separate products. Extract only what is actually shown. Do NOT invent anything. If a field is not visible, use "".
Respond with ONLY a JSON object:
{"title":"","brand":"","model":"","type":"","category":"","size":"","colour":"","condition":"","askingPrice":0,"buyerProtection":0,"postage":0,"platform":"","description":"","flawsMentioned":"","flawsVisible":"","packaging":"","accessories":"","sellerInfo":"","notConfirmed":["fields that were missing or unclear"],"possibleInterpretations":["only if genuinely unsure between options"]}`,
      });
      const j = extractJson(text);
      setFAll({
        title: clean(j.title), brand: clean(j.brand), model: clean(j.model), type: clean(j.type),
        category: clean(j.category), size: clean(j.size), colour: clean(j.colour), condition: clean(j.condition),
        askingPrice: j.askingPrice ? String(j.askingPrice) : "", buyerProtection: j.buyerProtection ? String(j.buyerProtection) : "",
        postage: j.postage ? String(j.postage) : "", platform: clean(j.platform) || "Vinted",
        description: clean(j.description), flawsMentioned: clean(j.flawsMentioned), flawsVisible: clean(j.flawsVisible),
        packaging: clean(j.packaging), accessories: clean(j.accessories), sellerInfo: clean(j.sellerInfo), listingUrl: "",
      });
      const nc = Array.isArray(j.notConfirmed) ? j.notConfirmed : [];
      const pi = Array.isArray(j.possibleInterpretations) ? j.possibleInterpretations : [];
      setNotConfirmed([...nc, ...pi.map((p) => "Unsure: " + p)]);
      setStep(2);
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const totalCost = num(f.askingPrice) + num(f.buyerProtection) + num(f.postage);

  const analyseOpp = async () => {
    setBusy("Researching resale value and analysing the deal… this can take up to a minute."); setErr(null);
    try {
      const details = { ...f, totalPurchaseCost: totalCost };
      const text = await askClaude({
        useSearch: true,
        prompt: `You are analysing a resale opportunity for a UK Vinted reseller. They are CONSIDERING BUYING this item to resell. Confirmed listing details: ${JSON.stringify(details)}.
The asking price is what they would PAY — it is NOT proof of resale value.
Use web search to look for recent sold/completed prices for this exact brand+model+size+condition on UK resale platforms (eBay sold listings are most reliable; Vinted sold data is rarely public). Prioritise sold prices over asking prices. Ignore outliers and different models. If you cannot find solid sold-price evidence, say so, base the estimate on general knowledge, and set confidence to "Low".
Never guarantee authenticity from photos or listing text. Flag authenticity risk if the price looks too good, branding looks off, or details contradict.
Rating scale rules: "Really Good" needs strong profit AND strong demand AND supporting market evidence — cheap alone is not enough. "Really Bad" = likely loss or serious risk.
Respond with ONLY a JSON object (numbers in GBP, no currency symbols):
{"rating":"Really Bad|Bad|Average|Good|Really Good","priceLow":0,"priceLikely":0,"priceHigh":0,"estSellingFees":0,"estPostage":0,"estPackaging":0.5,"demand":"Low|Medium|High","sellingSpeed":"Slow|Average|Fast","estTimeToSell":"e.g. 2-4 weeks","competition":"Low|Medium|High","positives":["..."],"risks":["..."],"toCheck":["questions to ask the seller"],"recommendation":"Buy|Send an Offer|Avoid","confidence":"Low|Medium|High","confidenceReason":"","evidence":"what comparables you found, how many, rough date range — or state that none were found","maxBuyPrice":0,"offerPrice":0}`,
      });
      const j = extractJson(text);
      const fees = num(j.estSellingFees), post = num(j.estPostage), pack = num(j.estPackaging);
      const mk = (p) => num(p) - totalCost - fees - post - pack;
      setA({
        rating: RATINGS.includes(j.rating) ? j.rating : "Average",
        priceLow: num(j.priceLow), priceLikely: num(j.priceLikely), priceHigh: num(j.priceHigh),
        estSellingFees: fees, estPostage: post, estPackaging: pack,
        profitLow: mk(j.priceLow), profitLikely: mk(j.priceLikely), profitHigh: mk(j.priceHigh),
        margin: num(j.priceLikely) > 0 ? (mk(j.priceLikely) / num(j.priceLikely)) * 100 : null,
        roi: totalCost > 0 ? (mk(j.priceLikely) / totalCost) * 100 : null,
        demand: clean(j.demand), sellingSpeed: clean(j.sellingSpeed), estTimeToSell: clean(j.estTimeToSell),
        competition: clean(j.competition),
        positives: Array.isArray(j.positives) ? j.positives : [], risks: Array.isArray(j.risks) ? j.risks : [],
        toCheck: Array.isArray(j.toCheck) ? j.toCheck : [],
        recommendation: clean(j.recommendation), confidence: clean(j.confidence) || "Low",
        confidenceReason: clean(j.confidenceReason), evidence: clean(j.evidence),
        maxBuyPrice: num(j.maxBuyPrice), offerPrice: num(j.offerPrice),
      });
      setStep(3);
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const saveOutcome = async (outcome) => {
    setBusy("Saving…");
    try {
      const check = {
        id: uid(), date: todayISO(), outcome, fields: { ...f, totalPurchaseCost: totalCost }, analysis: a, itemId: null,
      };
      if (outcome === "Purchased") {
        const thumb = shots.length ? await makeThumb(shots[0]) : null;
        const rec = {
          ...blankItem(),
          name: f.title ? f.title.slice(0, 50) : [f.brand, f.type].filter(Boolean).join(" ") || "Checked item",
          title: f.title, brand: f.brand, model: f.model, category: f.category || f.type,
          size: f.size, colour: f.colour, condition: f.condition,
          purchasePrice: f.askingPrice, buyerProtection: f.buyerProtection, purchasePostage: f.postage,
          expectedPrice: a.priceLikely ? String(a.priceLikely) : "",
          purchaseDate: todayISO(), status: "Purchased", platform: "Vinted",
          source: f.platform || "Vinted", listingUrl: f.listingUrl, notes: f.description ? "Seller description: " + f.description : "",
          thumb, imgCount: shots.length, checkId: check.id,
          estSnapshot: { rating: a.rating, priceLikely: a.priceLikely, profitLikely: a.profitLikely, confidence: a.confidence },
        };
        check.itemId = rec.id;
        await saveItem(rec, shots);
        await saveCheck(check);
        toast("Saved and added to stock");
        go({ name: "detail", id: rec.id });
        return;
      }
      await saveCheck(check);
      toast(outcome === "Rejected" ? "Saved as rejected" : "Saved as considering");
      setStep(1); setShots([]); setFAll({}); setA(null); setNotConfirmed([]);
    } catch (e) { toast("Save failed: " + e.message, true); }
    finally { setBusy(null); }
  };

  return (
    <>
      <ScreenHeader title="Opportunity Checker" onBack={() => go({ name: "home" })} />
      <div style={{ padding: "16px 18px 24px" }}>
        {busy ? <Spinner label={busy} /> : (
          <>
            {err && (
              <Banner icon={AlertTriangle} color={T.neg} bg={T.negSoft}>
                {err} <button onClick={() => setErr(null)} style={{ background: "none", border: "none", color: T.neg, fontWeight: 600, cursor: "pointer", fontSize: 12.5, padding: 0, marginLeft: 4 }}>Dismiss</button>
              </Banner>
            )}

            {step === 1 && (
              <>
                <Banner icon={ScanSearch}>Upload screenshots from <b>one listing</b> you're thinking of buying — photos, title, price, description, postage. They're analysed together as one listing.</Banner>
                <Card style={{ marginBottom: 14 }}>
                  <PhotoGrid photos={shots} onRemove={(i) => setShots((p) => p.filter((_, x) => x !== i))} onAdd={addShots} />
                </Card>
                <Btn kind="accent" style={{ width: "100%" }} disabled={shots.length === 0} onClick={readListing}>
                  <ScanSearch size={16} /> Read listing
                </Btn>
              </>
            )}

            {step === 2 && (
              <>
                <Banner icon={Info}>Extracted from the screenshots — <b>check and correct everything</b> before analysing. Nothing here is invented; blank means it wasn't visible.</Banner>
                {notConfirmed.length > 0 && (
                  <Banner icon={AlertTriangle} color={T.accent}>Not confirmed: {notConfirmed.join("; ")}</Banner>
                )}
                <SectionBox title="Listing details">
                  <Fi label="Listing title" value={f.title} onChange={setF("title")} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10 }}>
                    <Fi label="Brand" value={f.brand} onChange={setF("brand")} />
                    <Fi label="Model" value={f.model} onChange={setF("model")} />
                    <Fi label="Product type" value={f.type} onChange={setF("type")} />
                    <Fi label="Category" value={f.category} onChange={setF("category")} />
                    <Fi label="Size" value={f.size} onChange={setF("size")} />
                    <Fi label="Colour" value={f.colour} onChange={setF("colour")} />
                  </div>
                  <Fi label="Condition (as listed)" value={f.condition} onChange={setF("condition")} />
                  <Fi label="Flaws mentioned" value={f.flawsMentioned} onChange={setF("flawsMentioned")} />
                  <Fi label="Flaws visible in photos" value={f.flawsVisible} onChange={setF("flawsVisible")} />
                  <Fi label="Seller description" value={f.description} onChange={setF("description")} textarea />
                </SectionBox>
                <SectionBox title="Cost to buy">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10 }}>
                    <Fi label="Asking price" value={f.askingPrice} onChange={setF("askingPrice")} money />
                    <Fi label="Buyer protection" value={f.buyerProtection} onChange={setF("buyerProtection")} money />
                    <Fi label="Postage" value={f.postage} onChange={setF("postage")} money />
                    <Fi label="Platform" value={f.platform} onChange={setF("platform")} options={PLATFORMS} />
                  </div>
                  <Fi label="Listing URL (optional)" value={f.listingUrl} onChange={setF("listingUrl")} placeholder="https://…" />
                  <div style={{ ...body, fontSize: 13, color: T.text, background: T.raised, borderRadius: 12, padding: "11px 13px" }}>
                    Total cost to you: <b style={{ ...display, fontSize: 15 }}>{gbp(totalCost)}</b>
                  </div>
                </SectionBox>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn kind="ghost" onClick={() => setStep(1)}>Back</Btn>
                  <Btn kind="accent" style={{ flex: 1 }} disabled={!has(f.askingPrice)} onClick={analyseOpp}>Confirm & analyse</Btn>
                </div>
                {!has(f.askingPrice) && <div style={{ ...body, fontSize: 11.5, color: T.sec, marginTop: 8 }}>Enter the asking price to analyse.</div>}
              </>
            )}

            {step === 3 && a && (
              <>
                <Card style={{ marginBottom: 12, textAlign: "center", padding: 20 }}>
                  <div style={{ ...body, fontSize: 12, color: T.sec, marginBottom: 6 }}>Overall rating</div>
                  <div style={{ ...display, fontSize: 26, fontWeight: 700, color: RATING_COLOR[a.rating] }}>{a.rating}</div>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 8 }}>
                    <Chip label={a.recommendation || "—"} color={a.recommendation === "Avoid" ? T.neg : T.pos} active />
                    <Chip label={`${a.confidence} confidence`} small />
                  </div>
                </Card>

                <Card style={{ marginBottom: 12 }}>
                  <div style={{ ...body, fontSize: 12, color: T.sec, fontWeight: 600, marginBottom: 8 }}>Estimated resale price</div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                    {[["Low", a.priceLow], ["Likely", a.priceLikely], ["High", a.priceHigh]].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ ...body, fontSize: 11, color: T.sec }}>{k}</div>
                        <div style={{ ...display, fontSize: 17, fontWeight: 700, color: k === "Likely" ? T.accent : T.text, fontVariantNumeric: "tabular-nums" }}>{gbp(v)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ ...body, fontSize: 12, color: T.sec, fontWeight: 600, marginBottom: 8 }}>Estimated profit after all costs</div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[["Low", a.profitLow], ["Likely", a.profitLikely], ["High", a.profitHigh]].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ ...body, fontSize: 11, color: T.sec }}>{k}</div>
                        <div style={{ ...display, fontSize: 17, fontWeight: 700, color: v >= 0 ? T.pos : T.neg, fontVariantNumeric: "tabular-nums" }}>{gbp(v)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, flexWrap: "wrap" }}>
                    <span style={{ ...body, fontSize: 12, color: T.sec }}>Margin <b style={{ color: T.text }}>{pct(a.margin)}</b></span>
                    <span style={{ ...body, fontSize: 12, color: T.sec }}>ROI <b style={{ color: T.text }}>{pct(a.roi)}</b></span>
                    <span style={{ ...body, fontSize: 12, color: T.sec }}>Your cost <b style={{ color: T.text }}>{gbp(totalCost)}</b></span>
                    <span style={{ ...body, fontSize: 12, color: T.sec }}>Est. selling costs <b style={{ color: T.text }}>{gbp(a.estSellingFees + a.estPostage + a.estPackaging)}</b></span>
                  </div>
                </Card>

                <Card style={{ marginBottom: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[["Max price to pay", gbp(a.maxBuyPrice)], ["Suggested offer", gbp(a.offerPrice)], ["Demand", a.demand || "—"], ["Competition", a.competition || "—"], ["Selling speed", a.sellingSpeed || "—"], ["Time to sell", a.estTimeToSell || "—"]].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ ...body, fontSize: 11, color: T.sec }}>{k}</div>
                        <div style={{ ...body, fontSize: 14, fontWeight: 600, color: T.text }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {[["Why it could work", a.positives, T.pos], ["Risks", a.risks, T.neg], ["Check with the seller first", a.toCheck, T.accent]].map(([titleV, list, colorV]) =>
                  list.length > 0 ? (
                    <Card key={titleV} style={{ marginBottom: 12 }}>
                      <div style={{ ...body, fontSize: 12.5, fontWeight: 600, color: colorV, marginBottom: 8 }}>{titleV}</div>
                      {list.map((x, i) => (
                        <div key={i} style={{ ...body, fontSize: 13, color: T.text, lineHeight: 1.5, padding: "3px 0" }}>• {x}</div>
                      ))}
                    </Card>
                  ) : null
                )}

                <Banner icon={ShieldAlert}>
                  <b>Evidence:</b> {a.evidence || "None stated."} <b>Confidence:</b> {a.confidence} — {a.confidenceReason || "no reason given"}. Resale prices are estimates, never guaranteed, and photo analysis can't confirm authenticity.
                </Banner>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn kind="accent" style={{ width: "100%" }} onClick={() => saveOutcome("Purchased")}><Package size={16} /> I bought it — add to stock</Btn>
                  <Btn kind="ghost" style={{ flex: 1 }} onClick={() => saveOutcome("Considering")}>Save as considering</Btn>
                  <Btn kind="ghost" style={{ flex: 1 }} onClick={() => saveOutcome("Rejected")}>Reject</Btn>
                  <Btn kind="ghost" style={{ width: "100%" }} onClick={() => setStep(2)}>Edit details & recalculate</Btn>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ============================================================
   ANALYTICS
   ============================================================ */
const RANGES = { "All time": null, "Last 30 days": 30, "Last 90 days": 90, "This month": "month", "This year": "year" };
function inRange(dateStr, range) {
  if (!range || !dateStr) return !range;
  const d = new Date(dateStr);
  const now = new Date();
  if (range === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (range === "year") return d.getFullYear() === now.getFullYear();
  return (now - d) / 86400000 <= range;
}

function groupStats(list) {
  const sold = list.filter((i) => i.status === "Sold");
  const unsold = list.filter((i) => UNSOLD.includes(i.status));
  const owned = list.filter((i) => OWNED.includes(i.status));
  const profit = sold.reduce((s, i) => s + (calc(i).profit || 0), 0);
  const revenue = sold.reduce((s, i) => s + num(i.actualPrice), 0);
  const margins = sold.map((i) => calc(i).margin).filter((m) => m != null);
  const days = sold.map((i) => calc(i).daysToSell).filter((d) => d != null);
  return {
    purchased: owned.length, sold: sold.length, unsold: unsold.length,
    spend: owned.reduce((s, i) => s + calc(i).tpc, 0),
    revenue, profit,
    invested: unsold.reduce((s, i) => s + calc(i).tpc, 0),
    avgProfit: sold.length ? profit / sold.length : null,
    avgMargin: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
    avgDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
    sellThrough: owned.length ? (sold.length / owned.length) * 100 : null,
    returned: list.filter((i) => i.status === "Returned").length,
  };
}

function AnalyticsScreen({ items, checks, go }) {
  const [tab, setTab] = useState("Overview");
  const [range, setRange] = useState("All time");
  const active = items.filter((i) => i.status !== "Archived");
  const r = RANGES[range];
  const scoped = active.filter((i) => {
    if (!r) return true;
    if (i.status === "Sold") return inRange(i.saleDate, r);
    return inRange(i.purchaseDate || new Date(i.createdAt).toISOString().slice(0, 10), r);
  });
  const g = groupStats(scoped);
  const soldAll = active.filter((i) => i.status === "Sold");

  const monthly = useMemo(() => {
    const out = [];
    const now = new Date();
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const label = d.toLocaleDateString("en-GB", { month: "short" });
      const monthSold = soldAll.filter((i) => {
        if (!i.saleDate) return false;
        const s = new Date(i.saleDate);
        return s.getMonth() === d.getMonth() && s.getFullYear() === d.getFullYear();
      });
      out.push({
        m: label,
        Revenue: +monthSold.reduce((s, i) => s + num(i.actualPrice), 0).toFixed(2),
        Profit: +monthSold.reduce((s, i) => s + (calc(i).profit || 0), 0).toFixed(2),
      });
    }
    return out;
  }, [items]);

  const byKey = (key) => {
    const map = {};
    scoped.forEach((i) => {
      const k = clean(i[key]).trim() || "(none)";
      if (!map[k]) map[k] = [];
      map[k].push(i);
    });
    return Object.entries(map).map(([name, list]) => ({ name, ...groupStats(list) }))
      .sort((x, y) => y.profit - x.profit);
  };

  const ageBuckets = useMemo(() => {
    const defs = [["Under 7 days", 0, 7], ["7–14 days", 7, 15], ["15–30 days", 15, 31], ["31–60 days", 31, 61], ["61–90 days", 61, 91], ["Over 90 days", 91, 1e9]];
    const unsold = active.filter((i) => UNSOLD.includes(i.status));
    return defs.map(([label, lo, hi]) => {
      const list = unsold.filter((i) => {
        const a = calc(i).age;
        return a != null && a >= lo && a < hi;
      });
      return { label, count: list.length, invested: list.reduce((s, i) => s + calc(i).tpc, 0), estValue: list.reduce((s, i) => s + num(i.expectedPrice), 0), items: list };
    });
  }, [items]);

  const insights = useMemo(() => {
    const out = [];
    const sold = scoped.filter((i) => i.status === "Sold");
    const brandsG = byKey("brand").filter((b) => b.name !== "(none)");
    if (brandsG.length && brandsG[0].sold >= 2) out.push(`${brandsG[0].name} generated your highest total profit (${gbp(brandsG[0].profit)}) in this period.`);
    const catsG = byKey("category").filter((c) => c.name !== "(none)" && c.unsold > 0).sort((a, b) => b.invested - a.invested);
    if (catsG.length && catsG[0].invested > 0) out.push(`${catsG[0].name} has the most money tied up in unsold stock (${gbp(catsG[0].invested)}).`);
    const old60 = active.filter((i) => (calc(i).age || 0) > 60).length;
    if (old60 > 0) out.push(`${old60} item${old60 > 1 ? "s have" : " has"} been unsold for more than 60 days — consider price drops or relisting.`);
    if (sold.length >= 4) {
      const bands = [["£0–£10", 0, 10], ["£10–£20", 10, 20], ["£20–£40", 20, 40], ["£40+", 40, 1e9]];
      const best = bands.map(([lab, lo, hi]) => {
        const list = sold.filter((i) => num(i.actualPrice) >= lo && num(i.actualPrice) < hi);
        const d = list.map((i) => calc(i).daysToSell).filter((x) => x != null);
        return { lab, n: list.length, avg: d.length ? d.reduce((a, b) => a + b, 0) / d.length : null };
      }).filter((b) => b.n >= 2 && b.avg != null).sort((a, b) => a.avg - b.avg)[0];
      if (best) out.push(`Items priced ${best.lab} sold fastest (avg ${Math.round(best.avg)} days).`);
    }
    const withEst = soldAll.filter((i) => i.estSnapshot);
    if (withEst.length >= 2) {
      const goodRated = withEst.filter((i) => ["Good", "Really Good"].includes(i.estSnapshot.rating));
      const rest = withEst.filter((i) => !["Good", "Really Good"].includes(i.estSnapshot.rating));
      if (goodRated.length >= 2 && rest.length >= 2) {
        const avg = (l) => l.reduce((s, i) => s + (calc(i).profit || 0), 0) / l.length;
        out.push(`Items the checker rated Good or better averaged ${gbp(avg(goodRated))} profit vs ${gbp(avg(rest))} for lower-rated buys.`);
      }
    }
    return out;
  }, [items, range]);

  const decisions = useMemo(() => {
    const counts = {};
    RATINGS.forEach((rt) => (counts[rt] = 0));
    checks.forEach((c) => { if (c.analysis && counts[c.analysis.rating] != null) counts[c.analysis.rating]++; });
    const purchased = checks.filter((c) => c.outcome === "Purchased").length;
    const rejected = checks.filter((c) => c.outcome === "Rejected").length;
    const soldWithEst = active.filter((i) => i.status === "Sold" && i.estSnapshot && has(i.actualPrice));
    let priceErr = null, profitDiff = null, profitablePct = null;
    if (soldWithEst.length) {
      const errs = soldWithEst.map((i) => Math.abs(num(i.actualPrice) - i.estSnapshot.priceLikely) / Math.max(1, i.estSnapshot.priceLikely) * 100);
      priceErr = errs.reduce((a, b) => a + b, 0) / errs.length;
      const diffs = soldWithEst.map((i) => (calc(i).profit || 0) - i.estSnapshot.profitLikely);
      profitDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      profitablePct = (soldWithEst.filter((i) => (calc(i).profit || 0) > 0).length / soldWithEst.length) * 100;
    }
    return { counts, purchased, rejected, total: checks.length, priceErr, profitDiff, profitablePct, soldN: soldWithEst.length };
  }, [checks, items]);

  const tabs = ["Overview", "Brands", "Categories", "Stock age", "Insights"];
  const listBlock = (rowsV) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rowsV.length === 0 && <Banner icon={Info}>No data yet for this period.</Banner>}
      {rowsV.map((b) => (
        <Card key={b.name}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={{ ...body, fontWeight: 600, fontSize: 14.5 }}>{b.name}</div>
            <div style={{ ...display, fontWeight: 700, fontSize: 15, color: b.profit > 0 ? T.pos : b.profit < 0 ? T.neg : T.text, fontVariantNumeric: "tabular-nums" }}>{gbp(b.profit)}</div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[["Sold", `${b.sold}/${b.purchased}`], ["Revenue", gbp(b.revenue)], ["Avg margin", pct(b.avgMargin)], ["Invested", gbp(b.invested)], b.avgDays != null ? ["Avg days", Math.round(b.avgDays)] : null].filter(Boolean).map(([k, v]) => (
              <span key={k} style={{ ...body, fontSize: 11.5, color: T.sec }}>{k} <b style={{ color: T.text }}>{v}</b></span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <>
      <ScreenHeader title="Analytics" onBack={() => go({ name: "home" })}
        right={
          <select value={range} onChange={(e) => setRange(e.target.value)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 12, padding: "7px 8px" }}>
            {Object.keys(RANGES).map((k) => <option key={k}>{k}</option>)}
          </select>
        } />
      <div style={{ padding: "14px 18px 24px" }}>
        <div className="vscroll" style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
          {tabs.map((t) => <Chip key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
        </div>

        {active.length === 0 ? (
          <Empty icon={BarChart3} title="No data yet" desc="Analytics build themselves as you add stock and record sales." />
        ) : tab === "Overview" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <StatCard label="Revenue" value={gbp(g.revenue)} sub={`${g.sold} sales`} />
              <StatCard label="Profit" value={gbp(g.profit)} color={g.profit > 0 ? T.pos : g.profit < 0 ? T.neg : T.text} />
              <StatCard label="Stock spend" value={gbp(g.spend)} sub={`${g.purchased} purchases`} />
              <StatCard label="Invested (unsold)" value={gbp(g.invested)} sub={`${g.unsold} items`} />
              <StatCard label="Avg profit / sale" value={gbp(g.avgProfit)} />
              <StatCard label="Avg margin" value={pct(g.avgMargin)} />
              <StatCard label="Avg days to sell" value={g.avgDays == null ? "—" : Math.round(g.avgDays)} />
              <StatCard label="Sell-through" value={pct(g.sellThrough)} sub="sold ÷ purchased" />
            </div>
            <Card>
              <div style={{ ...body, fontSize: 12.5, fontWeight: 600, color: T.sec, marginBottom: 10 }}>Last 6 months (by sale date)</div>
              <div style={{ width: "100%", height: 190 }}>
                <ResponsiveContainer>
                  <BarChart data={monthly} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={T.border} vertical={false} />
                    <XAxis dataKey="m" tick={{ fill: T.sec, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: T.sec, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }} formatter={(v) => "£" + v} />
                    <Bar dataKey="Revenue" fill={T.sec} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Profit" fill={T.accent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            {g.returned > 0 && <Banner icon={RotateCcw}>{g.returned} item{g.returned > 1 ? "s" : ""} returned in this period.</Banner>}
          </>
        ) : tab === "Brands" ? (
          listBlock(byKey("brand"))
        ) : tab === "Categories" ? (
          listBlock(byKey("category"))
        ) : tab === "Stock age" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ageBuckets.every((b) => b.count === 0) && <Banner icon={Info}>No unsold stock with a purchase date set.</Banner>}
            {ageBuckets.filter((b) => b.count > 0).map((b, idx) => (
              <Card key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ ...body, fontWeight: 600, fontSize: 14 }}>{b.label}</div>
                  <div style={{ ...body, fontSize: 12.5, color: T.sec }}>{b.count} item{b.count > 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 14, marginBottom: 8 }}>
                  <span style={{ ...body, fontSize: 12, color: T.sec }}>Invested <b style={{ color: T.text }}>{gbp(b.invested)}</b></span>
                  <span style={{ ...body, fontSize: 12, color: T.sec }}>Est. value <b style={{ color: T.text }}>{b.estValue ? gbp(b.estValue) : "—"}</b></span>
                </div>
                <div style={{ ...body, fontSize: 12, color: idx >= 3 ? T.neg : T.sec, lineHeight: 1.5 }}>
                  {idx <= 1 ? "Suggestion: keep the current price — still fresh." :
                   idx === 2 ? "Suggestion: refresh photos or tweak the title if views are low." :
                   idx === 3 ? "Suggestion: consider a price reduction or relisting." :
                   "Suggestion: reduce price, bundle, relist, or try another platform to free up cash."}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div style={{ ...display, fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Insights</div>
            {insights.length === 0 ? (
              <Banner icon={Info}>Not enough recorded data for insights yet — they appear as sales build up.</Banner>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                {insights.map((s, i) => (
                  <Card key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <TrendingUp size={15} color={T.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ ...body, fontSize: 13, lineHeight: 1.5 }}>{s}</div>
                  </Card>
                ))}
              </div>
            )}
            <div style={{ ...display, fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Buying decisions</div>
            {decisions.total === 0 ? (
              <Banner icon={Info}>Use the Opportunity Checker before buying and Vault will track how accurate its calls were.</Banner>
            ) : (
              <Card>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {RATINGS.map((rt) => decisions.counts[rt] > 0 && (
                    <Chip key={rt} label={`${rt}: ${decisions.counts[rt]}`} color={RATING_COLOR[rt]} small />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {[["Checks", decisions.total], ["Bought", decisions.purchased], ["Rejected", decisions.rejected],
                    decisions.priceErr != null ? ["Avg price error", decisions.priceErr.toFixed(0) + "%"] : null,
                    decisions.profitDiff != null ? ["Profit vs estimate", (decisions.profitDiff >= 0 ? "+" : "") + gbp(decisions.profitDiff)] : null,
                    decisions.profitablePct != null ? ["Profitable buys", decisions.profitablePct.toFixed(0) + "%"] : null,
                  ].filter(Boolean).map(([k, v]) => (
                    <span key={k} style={{ ...body, fontSize: 12, color: T.sec }}>{k} <b style={{ color: T.text }}>{v}</b></span>
                  ))}
                </div>
                {decisions.soldN === 0 && <div style={{ ...body, fontSize: 11.5, color: T.sec, marginTop: 10 }}>Accuracy stats appear once checked items sell.</div>}
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ============================================================
   SETTINGS
   ============================================================ */
const CSV_COLS = ["name","title","brand","model","category","subcategory","size","colour","condition","quantity","status","platform","purchasePrice","buyerProtection","purchasePostage","otherPurchaseCosts","expectedPrice","actualPrice","platformFees","buyerPostagePaid","sellerPostage","packagingCost","otherSellingCosts","purchaseDate","listingDate","saleDate","storage","supplier","source","sku","listingUrl","tags","notes"];
function toCsv(items) {
  const esc = (v) => `"${clean(v).replace(/"/g, '""')}"`;
  const head = [...CSV_COLS, "profit", "margin", "roi"].join(",");
  const rows = items.map((i) => {
    const c = calc(i);
    return [...CSV_COLS.map((k) => esc(i[k])), c.profit == null ? "" : c.profit.toFixed(2), c.margin == null ? "" : c.margin.toFixed(1), c.roi == null ? "" : c.roi.toFixed(1)].join(",");
  });
  return [head, ...rows].join("\n");
}

function SettingsScreen({ items, checks, go, importData, wipeAll, toast }) {
  const fileRef = useRef(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState(null);
  const [pass, setPassField] = useState("");
  const [passLoaded, setPassLoaded] = useState(false);
  useEffect(() => { getPass().then((p) => { setPassField(p); setPassLoaded(true); }); }, []);

  const exportBackup = async () => {
    setBusy(true);
    try {
      const images = {};
      for (const it of items) {
        if (it.imgCount > 0) {
          const p = await sGet(imgKey(it.id));
          if (Array.isArray(p)) images[it.id] = p;
        }
      }
      const backup = { app: "vault", version: 1, exportedAt: new Date().toISOString(), items, checks, images };
      downloadFile(`vault-backup-${todayISO()}.json`, JSON.stringify(backup), "application/json");
      toast("Backup downloaded");
    } catch (e) { toast("Export failed: " + e.message, true); }
    finally { setBusy(false); }
  };

  const onImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.app !== "vault" || !Array.isArray(data.items)) throw new Error("That doesn't look like a Vault backup file.");
      const result = await importData(data);
      toast(`Restored ${result.added} item${result.added === 1 ? "" : "s"}${result.skipped ? `, skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}` : ""}`);
    } catch (err2) { toast("Import failed: " + err2.message, true); }
    finally { setBusy(false); }
  };

  return (
    <>
      <ScreenHeader title="Settings" onBack={() => go({ name: "home" })} />
      <div style={{ padding: "16px 18px 24px" }}>
        {!storageOK && <Banner icon={AlertTriangle} color={T.neg} bg={T.negSoft}>Your browser is blocking local storage, so nothing will be saved. Turn off Private Browsing and reload.</Banner>}
        <SectionBox title="Data & backups">
          <div style={{ ...body, fontSize: 12.5, color: T.sec, lineHeight: 1.55, marginBottom: 12 }}>
            {items.length} item{items.length === 1 ? "" : "s"} and {checks.length} opportunity check{checks.length === 1 ? "" : "s"} stored in this browser on this device. Export a backup regularly — clearing browser data will erase it.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Btn kind="ghost" disabled={busy || items.length === 0} onClick={() => { downloadFile(`vault-inventory-${todayISO()}.csv`, toCsv(items), "text/csv"); toast("CSV downloaded"); }}>
              <Download size={15} /> Export inventory CSV
            </Btn>
            <Btn kind="ghost" disabled={busy || items.length === 0} onClick={() => { downloadFile(`vault-sales-${todayISO()}.csv`, toCsv(items.filter((i) => i.status === "Sold")), "text/csv"); toast("Sales CSV downloaded"); }}>
              <Download size={15} /> Export sales CSV
            </Btn>
            <Btn kind="ghost" disabled={busy} onClick={exportBackup}>
              <Download size={15} /> Export full backup (with photos)
            </Btn>
            <Btn kind="ghost" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>
              <Upload size={15} /> Restore from backup
            </Btn>
            <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onImportFile} />
          </div>
        </SectionBox>

        <SectionBox title="AI access" defaultOpen={false}>
          <div style={{ fontSize: 13, color: T.sec, lineHeight: 1.5, marginBottom: 10 }}>
            The Listing Generator and Opportunity Checker need this passphrase. It must match VAULT_PASSPHRASE
            in Vercel (Settings then Environment Variables). It stops other people using the AI on your account.
          </div>
          <Fi
            label="Passphrase"
            value={pass}
            onChange={setPassField}
            placeholder={passLoaded ? "Enter passphrase" : "Loading…"}
          />
          <Btn
            kind="ghost"
            style={{ width: "100%" }}
            onClick={async () => { await setPass((pass || "").trim()); toast("Passphrase saved"); }}
          >
            Save passphrase
          </Btn>
        </SectionBox>

        <SectionBox title="AI & privacy" defaultOpen={false}>
          <Btn kind="ghost" style={{ width: "100%", marginBottom: 10 }} disabled={busy || diag === "running"} onClick={async () => {
            setDiag("running");
            const lines = [];
            let textOK = false, imgOK = false;
            try { await askClaude({ prompt: "Reply with exactly one word: OK" }); textOK = true; lines.push("✓ Text request — working"); }
            catch (e) { lines.push("✗ Text request — " + e.message); }
            try {
              const c = document.createElement("canvas"); c.width = 8; c.height = 8;
              const ctx = c.getContext("2d"); ctx.fillStyle = "#E4B54A"; ctx.fillRect(0, 0, 8, 8);
              await askClaude({ prompt: "Reply with exactly one word: OK", images: [c.toDataURL("image/jpeg", 0.7)] });
              imgOK = true; lines.push("✓ Image request — working");
            } catch (e) { lines.push("✗ Image request — " + e.message); }
            lines.push("");
            const authy = lines.some((l) => l.includes("AUTH:"));
            if (textOK && imgOK) lines.push("Verdict: AI is fully working here. If a feature still fails, try again — it may have been temporary.");
            else if (authy) lines.push("Verdict: the API key is missing, wrong, or out of credit. Go to Vercel, then Settings, then Environment Variables, check ANTHROPIC_API_KEY, then redeploy. Nothing is wrong with the app or your photos.");
            else if (textOK && !imgOK) lines.push("Verdict: text works but images are blocked in this viewer. Open this artifact in Safari (claude.ai) and use it there instead.");
            else lines.push("Verdict: the AI service can't be reached from this viewer at all. Open this artifact in Safari at claude.ai — if it works there, use Safari + Add to Home Screen as your app.");
            setDiag(lines.join("\n"));
          }}>
            <Sparkles size={15} /> {diag === "running" ? "Testing…" : "Run AI diagnostic"}
          </Btn>
          {diag && diag !== "running" && (
            <div style={{ ...body, fontSize: 12, color: T.text, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 13px", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 12 }}>
              {diag}
            </div>
          )}
          <div style={{ ...body, fontSize: 12.5, color: T.sec, lineHeight: 1.6 }}>
            When you use the Listing Generator or Opportunity Checker, the photos or screenshots you upload for that task — plus the details you confirm — are sent through this site's own server to Anthropic's API to be analysed. The API key stays on the server and is never visible in the app. The Opportunity Checker may also run web searches for resale prices. The rest of your inventory, sales figures and analytics never leave this app's storage.
          </div>
        </SectionBox>

        <SectionBox title="Danger zone" defaultOpen={false}>
          <Btn kind="danger" style={{ width: "100%" }} disabled={busy} onClick={async () => {
            if (!confirmWipe) { setConfirmWipe(true); setTimeout(() => setConfirmWipe(false), 4000); return; }
            setBusy(true);
            try { await wipeAll(); toast("All data deleted"); }
            catch (e) { toast("Delete failed: " + e.message, true); }
            finally { setBusy(false); setConfirmWipe(false); }
          }}>
            <Trash2 size={15} /> {confirmWipe ? "Tap again to delete EVERYTHING" : "Delete all data"}
          </Btn>
          <div style={{ ...body, fontSize: 11.5, color: T.sec, marginTop: 8 }}>Export a backup first — this can't be undone.</div>
        </SectionBox>

        <div style={{ ...body, fontSize: 11.5, color: T.sec, textAlign: "center", marginTop: 10 }}>
          Vault {APP_VERSION} · personal reselling app · resale estimates are always estimates, never guarantees
        </div>
      </div>
    </>
  );
}

/* ============================================================
   SHELL, NAV, FRAME
   ============================================================ */
function BottomNav({ screen, go }) {
  const items = [
    { id: "home", label: "Home", icon: Home },
    { id: "stock", label: "Stock", icon: Package },
    { id: "add", label: "", icon: Plus, raised: true },
    { id: "checker", label: "Checker", icon: ScanSearch },
    { id: "analytics", label: "Stats", icon: BarChart3 },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: `1px solid ${T.border}`, background: "rgba(11,11,13,0.94)", backdropFilter: "blur(12px)", padding: "8px 6px calc(8px + env(safe-area-inset-bottom, 0px))", flexShrink: 0 }}>
      {items.map((it) => {
        const Icon = it.icon;
        const activeN = screen === it.id || (it.id === "stock" && ["detail", "edit"].includes(screen));
        if (it.raised) {
          return (
            <button key={it.id} onClick={() => go({ name: "edit", id: null })} aria-label="Add item" className="vanim"
              style={{ width: 48, height: 48, borderRadius: 16, background: T.accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginTop: -18, boxShadow: "0 6px 18px rgba(228,181,74,0.35)" }}>
              <Icon size={24} color="#141210" strokeWidth={2.5} />
            </button>
          );
        }
        return (
          <button key={it.id} onClick={() => go({ name: it.id })} className="vanim"
            style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 10px", cursor: "pointer", color: activeN ? T.text : T.sec }}>
            <Icon size={21} strokeWidth={activeN ? 2.4 : 2} />
            <span style={{ ...body, fontSize: 10.5, fontWeight: activeN ? 600 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StatusBar() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px 6px", flexShrink: 0 }}>
      <span style={{ ...body, fontSize: 13.5, fontWeight: 600, color: T.text }}>
        {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.text }}>
        <Signal size={14} /><Wifi size={14} /><BatteryFull size={16} />
      </div>
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position: "absolute", bottom: 86, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 50, pointerEvents: "none" }}>
      <div style={{ ...body, background: msg.bad ? T.neg : T.raised, border: `1px solid ${msg.bad ? T.neg : T.border}`, color: "#fff", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 500, maxWidth: "85%", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
        {msg.text}
      </div>
    </div>
  );
}

function AppShell({ isDesktop }) {
  const [screen, setScreen] = useState({ name: "home" });
  const [items, setItems] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);

  const toast = (text, bad = false) => {
    setToastMsg({ text, bad });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  };

  useEffect(() => {
    (async () => {
      const [i, c] = await Promise.all([sGet(K_ITEMS), sGet(K_CHECKS)]);
      if (Array.isArray(i)) setItems(i);
      if (Array.isArray(c)) setChecks(c);
      setLoaded(true);
    })();
  }, []);

  const persistItems = async (next) => {
    setItems(next);
    try { await sSet(K_ITEMS, next); }
    catch (e) { toast("Warning: couldn't save — " + e.message, true); }
  };
  const persistChecks = async (next) => {
    setChecks(next);
    try { await sSet(K_CHECKS, next); }
    catch (e) { toast("Warning: couldn't save — " + e.message, true); }
  };

  const saveItem = async (rec, photos) => {
    if (photos && photos.length) await sSet(imgKey(rec.id), photos);
    else if (photos && photos.length === 0) await sDel(imgKey(rec.id));
    const exists = items.some((i) => i.id === rec.id);
    await persistItems(exists ? items.map((i) => (i.id === rec.id ? rec : i)) : [rec, ...items]);
  };
  const updateItem = (rec) => persistItems(items.map((i) => (i.id === rec.id ? rec : i)));
  const deleteItem = async (id) => {
    await sDel(imgKey(id));
    await persistItems(items.filter((i) => i.id !== id));
  };
  const duplicateItem = async (it) => {
    const copy = { ...it, id: uid(), name: it.name + " (copy)", status: "Draft", actualPrice: "", saleDate: "", buyerUsername: "", orderRef: "", tracking: "", createdAt: Date.now(), updatedAt: Date.now(), checkId: null, estSnapshot: null };
    if (it.imgCount > 0) {
      const p = await sGet(imgKey(it.id));
      if (Array.isArray(p)) { try { await sSet(imgKey(copy.id), p); } catch {} }
    }
    await persistItems([copy, ...items]);
  };
  const saveCheck = (check) => persistChecks([check, ...checks]);

  const importData = async (data) => {
    const existingIds = new Set(items.reduce((acc, i) => (acc.push(i.id), acc), []));
    const incoming = data.items.filter((i) => i && i.id && !existingIds.has(i.id));
    for (const it of incoming) {
      const imgs = data.images && data.images[it.id];
      if (Array.isArray(imgs) && imgs.length) { try { await sSet(imgKey(it.id), imgs); } catch {} }
    }
    await persistItems([...incoming, ...items]);
    if (Array.isArray(data.checks)) {
      const cid = new Set(checks.reduce((acc, c) => (acc.push(c.id), acc), []));
      await persistChecks([...data.checks.filter((c) => c && c.id && !cid.has(c.id)), ...checks]);
    }
    return { added: incoming.length, skipped: data.items.length - incoming.length };
  };

  const wipeAll = async () => {
    for (const it of items) await sDel(imgKey(it.id));
    await sDel(K_ITEMS); await sDel(K_CHECKS);
    setItems([]); setChecks([]);
  };

  const go = (s) => setScreen(s);
  const goObj = { go, params: screen };

  let content;
  if (!loaded) content = <Spinner label="Loading your stock…" />;
  else if (screen.name === "home") content = <HomeScreen go={go} items={items} />;
  else if (screen.name === "stock") content = <StockScreen items={items} go={go} />;
  else if (screen.name === "detail") content = <DetailScreen items={items} go={goObj} updateItem={updateItem} deleteItem={deleteItem} duplicateItem={duplicateItem} toast={toast} />;
  else if (screen.name === "edit" || screen.name === "add") content = <EditScreen items={items} go={goObj} saveItem={saveItem} toast={toast} />;
  else if (screen.name === "generator") content = <GeneratorScreen go={go} saveItem={saveItem} toast={toast} />;
  else if (screen.name === "checker") content = <CheckerScreen go={go} saveItem={saveItem} saveCheck={saveCheck} toast={toast} />;
  else if (screen.name === "analytics") content = <AnalyticsScreen items={items} checks={checks} go={go} />;
  else if (screen.name === "settings") content = <SettingsScreen items={items} checks={checks} go={go} importData={importData} wipeAll={wipeAll} toast={toast} />;
  else content = <HomeScreen go={go} items={items} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: T.bg, color: T.text, overflow: "hidden", position: "relative" }}>
      {isDesktop && <StatusBar />}
      <div className="vscroll" style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>
        {content}
      </div>
      <Toast msg={toastMsg} />
      <BottomNav screen={screen.name} go={go} />
    </div>
  );
}

export default function VaultApp() {
  return (
    <div style={{
      ...body, height: "100dvh", background: T.bg,
      paddingLeft: "env(safe-area-inset-left, 0px)",
      paddingRight: "env(safe-area-inset-right, 0px)",
      boxSizing: "border-box",
    }}>
      <style>{globalCss}</style>
      <AppShell isDesktop={false} />
    </div>
  );
}
