"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Home, Package, Plus, ScanSearch, BarChart3, Sparkles, Settings, ChevronRight,
  ChevronLeft, Wifi, Signal, BatteryFull, Boxes, X, Camera, Trash2, Copy, Check,
  Pencil, Archive, RotateCcw, Search, Download, Upload, AlertTriangle, Clock,
  ExternalLink, RefreshCw, Info, TrendingUp, Tag, ShieldAlert, Layers,
  Coins, ShoppingCart, Box, Percent, CalendarDays,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import {
  T, display, body, mono, globalCss,
  STATUSES, UNSOLD, OWNED, STATUS_COLOR, CONDITIONS, PLATFORMS, RATINGS, RATING_COLOR,
} from "./theme";

/* ============================================================
   RESELL HQ — personal Vinted reselling app (full build)
   Stock tracker · Dashboard · AI listing generator ·
   AI opportunity checker · Analytics · Backup & CSV
   ============================================================ */

const APP_VERSION = "v3.0 clean";

/* Unsold items idle past this many days render as "Quiet" instead of their status. */
const STALE_DAYS = 60;

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
    headers: { "Content-Type": "application/json", "x-resellhq-pass": await getPass() },
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
/* Storage keys still say "vault" on purpose: renaming them would orphan stock already saved on your phone. */
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
    accent: { background: T.accent, color: T.accentInk },
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
      color: active ? (color === T.accent ? T.accentInk : T.bg) : (color || T.sec),
      border: `1px solid ${active ? "transparent" : T.border}`,
      borderRadius: 999, padding: small ? "5px 10px" : "7px 13px",
      fontSize: small ? 11.5 : 12.5, fontWeight: 600, cursor: onClick ? "pointer" : "default",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>{label}</button>
  );
}
function StatusPill({ status, age }) {
  const stale = age != null && age > STALE_DAYS;
  const c = stale ? T.a5 : (STATUS_COLOR[status] || T.sec);
  return (
    <span style={{ background: `${c}1F`, color: c, borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {stale ? `Quiet · ${age}d` : status}
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "calc(14px + env(safe-area-inset-top, 0px)) 18px 12px", position: "sticky", top: 0, background: "rgba(11,11,12,0.9)", backdropFilter: "blur(12px)", zIndex: 10, borderBottom: `1px solid ${T.border}` }}>
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
   PRICE CHECK
   Real sold prices beat AI guesses. These build links straight
   to eBay sold listings / Vinted search for an item, and work
   out what you've actually sold similar items for.
   ============================================================ */
const STOP = new Set(["the","and","a","an","of","for","with","in","uk","eu","us","size","mens","men","womens","women","new","used"]);
const tokens = (s) => clean(s).toLowerCase().replace(/[^a-z0-9.]+/g, " ").split(" ").filter((w) => w.length > 1 && !STOP.has(w));
const priceQuery = (it, withSize = true) => [it.brand && !clean(it.name).toLowerCase().includes(clean(it.brand).toLowerCase()) ? it.brand : "", it.name || it.title, withSize && it.size ? it.size : ""].filter(Boolean).join(" ").trim();
const ebaySoldUrl = (q) => "https://www.ebay.co.uk/sch/i.html?_nkw=" + encodeURIComponent(q) + "&LH_Sold=1&LH_Complete=1&_sop=13";
const vintedUrl = (q) => "https://www.vinted.co.uk/catalog?search_text=" + encodeURIComponent(q) + "&order=newest_first";

function similarSold(items, it, excludeId) {
  const q = tokens([it.brand, it.name || it.title].join(" "));
  if (!q.length) return null;
  const qs = new Set(q);
  const hits = items.filter((x) => {
    if (x.id === excludeId || x.status !== "Sold" || !has(x.actualPrice)) return false;
    const xt = new Set(tokens([x.brand, x.name || x.title].join(" ")));
    let overlap = 0;
    qs.forEach((w) => { if (xt.has(w)) overlap++; });
    return overlap / qs.size >= 0.6;
  });
  if (!hits.length) return null;
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const days = hits.map((x) => calc(x).daysToSell).filter((d) => d != null);
  return {
    count: hits.length,
    avgPrice: avg(hits.map((x) => num(x.actualPrice))),
    avgProfit: avg(hits.map((x) => calc(x).profit || 0)),
    low: Math.min(...hits.map((x) => num(x.actualPrice))),
    high: Math.max(...hits.map((x) => num(x.actualPrice))),
    avgDays: days.length ? Math.round(avg(days)) : null,
  };
}

function PriceCheck({ items, it, compact }) {
  const q = priceQuery(it, true);
  const qNoSize = priceQuery(it, false);
  const mine = similarSold(items, it, it.id);
  if (!qNoSize) return null;
  const linkStyle = { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", borderRadius: 12, padding: compact ? "10px 10px" : "12px 12px", fontSize: 13.5, fontWeight: 600 };
  return (
    <div>
      {mine && (
        <div style={{ ...body, fontSize: 13, color: T.sec, marginBottom: 10, lineHeight: 1.5 }}>
          You've sold <b style={{ color: T.text }}>{mine.count}</b> like this for <b style={{ color: T.text }}>{gbp(mine.avgPrice)}</b> avg
          {mine.count > 1 ? ` (${gbp(mine.low)}–${gbp(mine.high)})` : ""}, <b style={{ color: mine.avgProfit >= 0 ? T.pos : T.neg }}>{gbp(mine.avgProfit)}</b> profit
          {mine.avgDays != null ? `, ~${mine.avgDays}d to sell` : ""}.
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <a href={ebaySoldUrl(q)} target="_blank" rel="noreferrer" className="vanim" style={{ ...linkStyle, background: T.text, color: T.bg }}>
          <TrendingUp size={15} /> eBay sold
        </a>
        <a href={vintedUrl(qNoSize)} target="_blank" rel="noreferrer" className="vanim" style={{ ...linkStyle, background: T.raised, color: T.text, border: `1px solid ${T.border}` }}>
          <Search size={15} /> Vinted
        </a>
      </div>
    </div>
  );
}

/* ============================================================
   SHEETS — quick add + quick sell
   Bottom sheets so the two things done most often take seconds,
   not a full form.
   ============================================================ */
function Sheet({ title, onClose, children }) {
  const wide = useLayout() !== "phone";
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <div className="vfade" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, display: "flex", alignItems: wide ? "center" : "flex-end", justifyContent: "center", padding: wide ? 24 : 0 }}>
      <div className={wide ? "vfade" : "vsheet"} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "92%", overflowY: "auto", background: T.surface, border: wide ? `1px solid ${T.border}` : "none", borderTop: `1px solid ${T.border}`, borderRadius: wide ? 22 : "22px 22px 0 0", padding: wide ? "22px 24px 24px" : "10px 18px calc(18px + env(safe-area-inset-bottom, 0px))", boxShadow: wide ? "0 24px 60px rgba(0,0,0,0.5)" : "none" }}>
        {!wide && <div style={{ width: 38, height: 4, borderRadius: 4, background: T.border, margin: "0 auto 14px" }} />}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ ...display, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em" }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: T.raised, border: "none", borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: T.sec, cursor: "pointer" }}>
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const bigInput = { width: "100%", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 14, color: T.text, fontSize: 17, padding: "14px 14px" };
const moneyWrap = (input) => (
  <div style={{ position: "relative" }}>
    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.sec, fontSize: 17 }}>£</span>
    {input}
  </div>
);
const miniLabel = { ...body, fontSize: 12, color: T.sec, fontWeight: 600, marginBottom: 6, letterSpacing: "0.02em" };

function QuickAddSheet({ items, onClose, saveItem, toast, openFull }) {
  const [name, setName] = useState("");
  const [paid, setPaid] = useState("");
  const [size, setSize] = useState("");
  const [target, setTarget] = useState("");
  const [added, setAdded] = useState(0);
  const nameRef = useRef(null);

  useEffect(() => { setTimeout(() => nameRef.current && nameRef.current.focus(), 250); }, []);

  const pastNames = useMemo(() => [...new Set(items.map((i) => i.name).filter(Boolean))].slice(0, 200), [items]);
  const recentSizes = useMemo(() => {
    const seen = [];
    for (const i of items) { const s = clean(i.size).trim(); if (s && !seen.includes(s)) seen.push(s); if (seen.length >= 8) break; }
    return seen;
  }, [items]);
  const last = items[0];
  const mine = name.trim().length > 2 ? similarSold(items, { name }, null) : null;

  const build = () => ({
    ...blankItem(),
    name: name.trim(), size: size.trim(), purchasePrice: paid, expectedPrice: target,
    purchaseDate: todayISO(), status: "Purchased",
    brand: (items.find((i) => i.name === name.trim()) || {}).brand || "",
  });

  const add = async (keepOpen) => {
    if (!name.trim()) { toast("Type what it is first", true); nameRef.current && nameRef.current.focus(); return; }
    try {
      await saveItem(build(), null);
      toast(keepOpen ? `Added — ${added + 1} this go` : "Added to stock");
      if (keepOpen) { setAdded((n) => n + 1); setSize(""); }
      else onClose();
    } catch (e) { toast("Save failed: " + e.message, true); }
  };

  return (
    <Sheet title="Add stock" onClose={onClose}>
      {last && !name && (
        <button onClick={() => { setName(last.name || ""); setPaid(clean(last.purchasePrice)); setSize(clean(last.size)); setTarget(clean(last.expectedPrice)); }}
          className="vanim" style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: T.raised, border: `1px dashed ${T.border}`, borderRadius: 14, padding: "11px 13px", marginBottom: 14, cursor: "pointer", color: T.text, textAlign: "left" }}>
          <Copy size={16} color={T.sec} />
          <span style={{ ...body, fontSize: 13.5, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Same as last: <b>{last.name}</b>{last.size ? ` · ${last.size}` : ""}{has(last.purchasePrice) ? ` · ${gbp(num(last.purchasePrice))}` : ""}
          </span>
        </button>
      )}

      <div style={miniLabel}>WHAT IS IT</div>
      <input ref={nameRef} list="resellhq-names" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nike Dunk Low Panda"
        onKeyDown={(e) => { if (e.key === "Enter") add(false); }} style={{ ...bigInput, marginBottom: 14 }} />
      <datalist id="resellhq-names">{pastNames.map((n) => <option key={n} value={n} />)}</datalist>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={miniLabel}>PAID</div>
          {moneyWrap(<input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" placeholder="0" style={{ ...bigInput, paddingLeft: 30 }} />)}
        </div>
        <div>
          <div style={miniLabel}>AIM TO SELL FOR</div>
          {moneyWrap(<input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="optional" style={{ ...bigInput, paddingLeft: 30 }} />)}
        </div>
      </div>

      <div style={miniLabel}>SIZE</div>
      <div className="vscroll" style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 8 }}>
        {recentSizes.map((s) => <Chip key={s} label={s} active={size === s} onClick={() => setSize(size === s ? "" : s)} color={T.accent} />)}
      </div>
      <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="or type a size (optional)" style={{ ...bigInput, fontSize: 15, padding: "11px 13px", marginBottom: 16 }} />

      {name.trim().length > 2 && (
        <Card style={{ marginBottom: 16, padding: 14, background: T.bg }}>
          <div style={{ ...miniLabel, marginBottom: 10 }}>WHAT'S IT WORTH</div>
          <PriceCheck items={items} it={{ name, size }} compact />
          {!mine && <div style={{ ...body, fontSize: 12, color: T.dim, marginTop: 8 }}>No sales of this yet — your own numbers show up here once you've sold one.</div>}
        </Card>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn kind="accent" style={{ flex: 1.4, fontSize: 15.5, padding: "15px" }} onClick={() => add(false)}><Check size={17} /> Add</Btn>
        <Btn kind="ghost" style={{ flex: 1, fontSize: 14 }} onClick={() => add(true)}><Plus size={16} /> Add + another</Btn>
      </div>
      <button onClick={() => openFull(build())} style={{ background: "none", border: "none", color: T.sec, ...body, fontSize: 13, fontWeight: 500, cursor: "pointer", width: "100%", marginTop: 14, padding: 4 }}>
        Add photos or more details
      </button>
    </Sheet>
  );
}

const K_SELLDEF = "vault-sell-defaults";
const SELL_PLATFORMS = ["Vinted", "eBay", "Depop", "Other"];

function SellSheet({ it, onClose, updateItem, toast }) {
  const [platform, setPlatform] = useState(SELL_PLATFORMS.includes(it.platform) ? it.platform : "Vinted");
  const [price, setPrice] = useState(clean(it.expectedPrice));
  const [fees, setFees] = useState("");
  const [post, setPost] = useState("");
  const [defs, setDefs] = useState({});
  const [showCosts, setShowCosts] = useState(false);
  const priceRef = useRef(null);

  useEffect(() => {
    sGet(K_SELLDEF).then((d) => {
      const all = d && typeof d === "object" ? d : {};
      setDefs(all);
      const mine = all[platform];
      if (mine) { setFees(clean(mine.fees)); setPost(clean(mine.post)); }
    });
    setTimeout(() => priceRef.current && priceRef.current.focus(), 250);
  }, []);

  const pick = (p) => {
    setPlatform(p);
    const d = defs[p];
    setFees(d ? clean(d.fees) : "");
    setPost(d ? clean(d.post) : "");
  };

  const preview = calc({ ...it, status: "Sold", actualPrice: price, platformFees: fees, sellerPostage: post });

  const confirm = async () => {
    if (!has(price)) { toast("What did it sell for?", true); priceRef.current && priceRef.current.focus(); return; }
    const today = todayISO();
    await updateItem({
      ...it, status: "Sold", platform, actualPrice: price, platformFees: fees, sellerPostage: post,
      saleDate: today, listingDate: it.listingDate || it.purchaseDate || "", updatedAt: Date.now(),
    });
    try { await sSet(K_SELLDEF, { ...defs, [platform]: { fees, post } }); } catch {}
    toast(preview.profit != null ? `Sold — ${gbp(preview.profit)} profit` : "Marked as sold");
    onClose();
  };

  return (
    <Sheet title="Sold it" onClose={onClose}>
      <div style={{ ...body, fontSize: 14, color: T.sec, marginBottom: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {it.name || it.title}{it.size ? ` · ${it.size}` : ""}
      </div>
      <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
        {SELL_PLATFORMS.map((p) => <Chip key={p} label={p} active={platform === p} onClick={() => pick(p)} color={T.accent} />)}
      </div>
      <div style={miniLabel}>SOLD FOR</div>
      {moneyWrap(<input ref={priceRef} value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirm(); }}
        inputMode="decimal" placeholder="0" style={{ ...bigInput, fontSize: 26, fontWeight: 700, paddingLeft: 32, ...display }} />)}

      <button onClick={() => setShowCosts(!showCosts)} style={{ background: "none", border: "none", color: T.sec, ...body, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "12px 0 4px" }}>
        {showCosts ? "Hide costs" : `Fees & postage${has(fees) || has(post) ? `: ${gbp(num(fees) + num(post))}` : " (optional)"}`}
      </button>
      {showCosts && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
          <div>
            <div style={miniLabel}>FEES</div>
            {moneyWrap(<input value={fees} onChange={(e) => setFees(e.target.value)} inputMode="decimal" placeholder="0" style={{ ...bigInput, fontSize: 15, paddingLeft: 30 }} />)}
          </div>
          <div>
            <div style={miniLabel}>POSTAGE YOU PAID</div>
            {moneyWrap(<input value={post} onChange={(e) => setPost(e.target.value)} inputMode="decimal" placeholder="0" style={{ ...bigInput, fontSize: 15, paddingLeft: 30 }} />)}
          </div>
          <div style={{ ...body, gridColumn: "1 / -1", fontSize: 11.5, color: T.dim }}>Remembered for next time you sell on {platform}.</div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", margin: "16px 0" }}>
        <span style={{ ...body, fontSize: 13.5, color: T.sec }}>Profit</span>
        <span style={{ ...display, fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: !has(price) ? T.dim : preview.profit >= 0 ? T.pos : T.neg }}>
          {has(price) ? gbp(preview.profit) : "—"}
        </span>
      </div>
      <Btn kind="accent" style={{ width: "100%", fontSize: 15.5, padding: "15px" }} onClick={confirm}><Check size={17} /> Confirm sale</Btn>
    </Sheet>
  );
}

/* ============================================================
   ITEM ROW — shared by Home and Stock
   ============================================================ */
function ItemRow({ it, onOpen, onSell }) {
  const c = calc(it);
  const initial = clean(it.brand || it.name || "?").trim().charAt(0).toUpperCase() || "?";
  const meta = [it.size, c.sold ? it.platform : null, c.age != null ? `${c.age}d` : null].filter(Boolean).join(" · ");
  return (
    <div onClick={onOpen} className="vanim" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, cursor: "pointer" }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: T.raised, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", ...display, fontWeight: 700, fontSize: 17, color: T.sec }}>
        {it.thumb ? <img src={it.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...body, fontWeight: 600, fontSize: 14.5, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name || it.title || "Untitled"}</div>
        <div style={{ ...body, fontSize: 12.5, color: c.age != null && c.age > STALE_DAYS ? T.a2 : T.sec, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {meta || (c.sold ? "Sold" : "In stock")}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {c.sold ? (
          <div style={{ ...display, fontWeight: 700, fontSize: 15.5, color: c.profit >= 0 ? T.pos : T.neg, fontVariantNumeric: "tabular-nums" }}>{c.profit >= 0 ? "+" : ""}{gbp(c.profit)}</div>
        ) : (
          <div style={{ ...display, fontWeight: 600, fontSize: 14.5, color: T.sec, fontVariantNumeric: "tabular-nums" }}>{has(it.purchasePrice) ? gbp(c.tpc) : "—"}</div>
        )}
      </div>
      {onSell && UNSOLD.includes(it.status) && (
        <button onClick={(e) => { e.stopPropagation(); onSell(it.id); }} className="vanim"
          style={{ background: T.accentSoft, color: T.accent, border: `1px solid ${T.accentLine}`, borderRadius: 10, padding: "8px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          Sold
        </button>
      )}
    </div>
  );
}

/* ============================================================
   LAYOUT — phone / tablet / laptop
   Under 768px: phone layout with bottom nav. 768–1099px: icon
   rail sidebar. 1100px+: full sidebar and dashboard grid.
   ============================================================ */
const LayoutCtx = React.createContext("phone");
const useLayout = () => React.useContext(LayoutCtx);
function useViewportMode() {
  const [mode, setMode] = useState("phone");
  useEffect(() => {
    const f = () => { const w = window.innerWidth; setMode(w >= 1100 ? "desktop" : w >= 768 ? "tablet" : "phone"); };
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return mode;
}

function Logo({ size = 26 }) {
  return (
    <span style={{ ...display, fontWeight: 800, fontSize: size, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
      Resell <span style={{ color: T.accent }}>HQ</span>
    </span>
  );
}

const NAV = [
  { id: "home", label: "Dashboard", icon: Home },
  { id: "stock", label: "Stock", icon: Package },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "generator", label: "Listing writer", icon: Sparkles },
  { id: "checker", label: "Buy checker", icon: ScanSearch },
];
function Sidebar({ screen, go, openAdd, compact }) {
  const isActive = (id) => screen === id || (id === "stock" && ["detail", "edit"].includes(screen));
  const NavBtn = ({ n }) => {
    const Icon = n.icon;
    const on = isActive(n.id);
    return (
      <button onClick={() => go({ name: n.id })} title={n.label} className="vanim" style={{
        display: "flex", alignItems: "center", justifyContent: compact ? "center" : "flex-start", gap: 12, width: "100%",
        background: on ? T.accentSoft : "none", color: on ? T.accent : T.sec, border: "none",
        borderLeft: `3px solid ${on ? T.accent : "transparent"}`, borderRadius: 10,
        padding: compact ? "12px 0" : "11px 14px", fontSize: 14.5, fontWeight: on ? 600 : 500, cursor: "pointer",
      }}>
        <Icon size={19} strokeWidth={on ? 2.4 : 2} />{!compact && n.label}
      </button>
    );
  };
  return (
    <div style={{ width: compact ? 76 : 236, flexShrink: 0, background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", padding: compact ? "22px 10px" : "26px 16px", gap: 4 }}>
      <div style={{ padding: compact ? "0 0 22px" : "0 8px 26px", textAlign: compact ? "center" : "left" }}>
        {compact ? <span style={{ ...display, fontWeight: 800, fontSize: 20, color: T.accent }}>HQ</span> : <Logo size={28} />}
      </div>
      {NAV.map((n) => <NavBtn key={n.id} n={n} />)}
      <Btn kind="accent" onClick={openAdd} style={{ marginTop: 16, width: "100%", padding: compact ? "12px 0" : "12px 14px" }}>
        <Plus size={18} />{!compact && "Add item"}
      </Btn>
      <div style={{ flex: 1 }} />
      <NavBtn n={{ id: "settings", label: "Settings", icon: Settings }} />
    </div>
  );
}

/* ---------- dashboard numbers ---------- */
const DAY = 86400000;
function ago(ts) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return m <= 1 ? "just now" : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : fmtDate(new Date(ts));
}
const saleTs = (i) => {
  const d = Date.parse(i.saleDate);
  if (!isFinite(d)) return i.updatedAt || 0;
  return new Date(i.updatedAt || 0).toISOString().slice(0, 10) === i.saleDate ? i.updatedAt : d + 12 * 3600000;
};
const deltaPct = (now, before) => (before > 0 ? ((now - before) / before) * 100 : null);

function dashData(items) {
  const active = items.filter((i) => i.status !== "Archived");
  const unsold = active.filter((i) => UNSOLD.includes(i.status));
  const sold = active.filter((i) => i.status === "Sold" && has(i.actualPrice));
  const now = Date.now();
  const inLast = (i, from, to = 0) => { const t = saleTs(i); return t > now - from * DAY && t <= now - to * DAY; };
  const s30 = sold.filter((i) => inLast(i, 30));
  const sPrev30 = sold.filter((i) => inLast(i, 60, 30));
  const sum = (arr, f) => arr.reduce((a, i) => a + f(i), 0);
  const prof = (i) => calc(i).profit || 0;
  const ym = todayISO().slice(0, 7);
  const lastD = new Date(); lastD.setDate(1); lastD.setMonth(lastD.getMonth() - 1);
  const lym = lastD.toISOString().slice(0, 7);
  const monthSold = sold.filter((i) => clean(i.saleDate).slice(0, 7) === ym);
  const lastMonthSold = sold.filter((i) => clean(i.saleDate).slice(0, 7) === lym);

  const daily = [];
  for (let k = 29; k >= 0; k--) {
    const day = new Date(now - k * DAY).toISOString().slice(0, 10);
    const ds = sold.filter((i) => i.saleDate === day);
    daily.push({ day: new Date(day).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), revenue: sum(ds, (i) => num(i.actualPrice)), profit: sum(ds, prof) });
  }
  const platMap = {};
  s30.forEach((i) => { const p = i.platform || "Other"; platMap[p] = (platMap[p] || 0) + num(i.actualPrice); });
  const platforms = Object.entries(platMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const topMap = {};
  s30.forEach((i) => {
    const key = clean(i.name || i.title).trim().toLowerCase();
    if (!key) return;
    const t = topMap[key] || (topMap[key] = { name: i.name || i.title, count: 0, revenue: 0, thumb: i.thumb });
    t.count++; t.revenue += num(i.actualPrice); if (!t.thumb && i.thumb) t.thumb = i.thumb;
  });
  const top = Object.values(topMap).sort((a, b) => b.count - a.count || b.revenue - a.revenue).slice(0, 4);

  const events = [];
  active.forEach((i) => {
    if (i.status === "Sold" && has(i.actualPrice)) events.push({ type: "sold", ts: saleTs(i), it: i, amount: num(i.actualPrice) });
    if (OWNED.includes(i.status)) events.push({ type: "new", ts: i.createdAt || 0, it: i, amount: calc(i).tpc });
  });
  events.sort((a, b) => b.ts - a.ts);

  return {
    unsold, sold,
    stockCost: sum(unsold, (i) => calc(i).tpc),
    newThisWeek: unsold.filter((i) => (i.createdAt || 0) > now - 7 * DAY).length,
    sales30: sum(s30, (i) => num(i.actualPrice)), salesPrev30: sum(sPrev30, (i) => num(i.actualPrice)),
    profit30: sum(s30, prof), profitPrev30: sum(sPrev30, prof),
    profitMonth: sum(monthSold, prof), profitLastMonth: sum(lastMonthSold, prof), soldMonth: monthSold.length,
    daily, platforms, top, events,
    recentSales: [...sold].sort((a, b) => saleTs(b) - saleTs(a)),
    quiet: unsold.filter((i) => (calc(i).age || 0) > 30).sort((a, b) => (calc(b).age || 0) - (calc(a).age || 0)),
  };
}

/* ---------- dashboard pieces ---------- */
function Delta({ pct: p, suffix = "" }) {
  if (p == null || !isFinite(p)) return null;
  const up = p >= 0;
  return <span style={{ ...body, fontSize: 12.5, fontWeight: 600, color: up ? T.pos : T.neg, whiteSpace: "nowrap" }}>{up ? "▲" : "▼"} {Math.abs(p).toFixed(0)}%{suffix}</span>;
}
function IconTile({ icon: Icon, size = 38 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 11, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon size={size * 0.5} color={T.accent} />
    </div>
  );
}
function Panel({ title, right, children, style, pad = 18 }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: pad, minWidth: 0, ...style }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div style={{ ...display, fontWeight: 700, fontSize: 16.5 }}>{title}</div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
const SeeAll = ({ onClick }) => <button onClick={onClick} style={{ background: "none", border: "none", color: T.sec, ...body, fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2 }}>See all <ChevronRight size={14} /></button>;
const RangeTag = ({ label = "Last 30 days" }) => <span style={{ ...body, fontSize: 12, color: T.sec, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 9px", whiteSpace: "nowrap" }}>{label}</span>;
function Thumb({ it, size = 42 }) {
  const initial = clean((it && (it.brand || it.name)) || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: T.raised, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", ...display, fontWeight: 700, fontSize: size * 0.38, color: T.sec }}>
      {it && it.thumb ? <img src={it.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
    </div>
  );
}

function StatTile({ label, value, icon, delta, sub }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...body, fontSize: 12.5, color: T.sec }}>{label}</div>
          <div style={{ ...display, fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums", marginTop: 4, whiteSpace: "nowrap" }}>{value}</div>
        </div>
        {icon && <IconTile icon={icon} />}
      </div>
      {(delta != null || sub) && <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>{delta}{sub && <span style={{ ...body, fontSize: 12, color: T.dim }}>{sub}</span>}</div>}
    </div>
  );
}

function ActivityList({ events, go, limit }) {
  if (!events.length) return <div style={{ ...body, fontSize: 13, color: T.dim }}>Nothing yet — add some stock.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {events.slice(0, limit).map((e, k) => (
        <div key={k} onClick={() => go({ name: "detail", id: e.it.id })} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: k ? `1px solid ${T.border}` : "none", cursor: "pointer" }}>
          {e.type === "sold" ? <TrendingUp size={17} color={T.pos} /> : <Package size={17} color={T.accent} />}
          <Thumb it={e.it} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...body, fontWeight: 600, fontSize: 14 }}>{e.type === "sold" ? "Sold" : "New stock"}</div>
            <div style={{ ...body, fontSize: 12.5, color: T.sec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.it.name || e.it.title}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ ...display, fontWeight: 700, fontSize: 14.5, fontVariantNumeric: "tabular-nums", color: e.type === "sold" ? T.text : T.sec }}>{gbp(e.amount)}</div>
            <div style={{ ...body, fontSize: 11.5, color: T.dim }}>{ago(e.ts)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopList({ top }) {
  if (!top.length) return <div style={{ ...body, fontSize: 13, color: T.dim }}>No sales in the last 30 days.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {top.map((t, k) => (
        <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 11, background: T.raised, borderRadius: 12, padding: "8px 11px" }}>
          <span style={{ ...display, fontWeight: 700, fontSize: 13, color: T.sec, width: 22, height: 22, borderRadius: 999, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{k + 1}</span>
          <Thumb it={t} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...body, fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
            <div style={{ ...body, fontSize: 12, color: T.sec }}>{t.count} sold</div>
          </div>
          <div style={{ ...display, fontWeight: 700, fontSize: 14.5, fontVariantNumeric: "tabular-nums" }}>{gbp(t.revenue)}</div>
        </div>
      ))}
    </div>
  );
}

const chartTip = { contentStyle: { background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }, labelStyle: { color: T.sec }, formatter: (v) => gbp(v) };
const axis = { stroke: T.dim, fontSize: 11, tickLine: false, axisLine: false };
const PLAT_COLORS = [T.accent, "#FF6B81", "#FF9AA8", "#C9C9CF", "#6B6B72"];

function SalesChart({ daily }) {
  return (
    <div style={{ height: 190 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={daily} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="rhqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={T.accent} stopOpacity={0.45} />
              <stop offset="100%" stopColor={T.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={T.border} vertical={false} />
          <XAxis dataKey="day" {...axis} interval={6} />
          <YAxis {...axis} tickFormatter={(v) => "£" + v} />
          <Tooltip {...chartTip} />
          <Area type="monotone" dataKey="revenue" name="Sales" stroke={T.accent} strokeWidth={2.2} fill="url(#rhqFill)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function ProfitChart({ daily }) {
  return (
    <div style={{ height: 190 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={daily} margin={{ top: 6, right: 6, left: -14, bottom: 0 }} barGap={1}>
          <CartesianGrid stroke={T.border} vertical={false} />
          <XAxis dataKey="day" {...axis} interval={6} />
          <YAxis {...axis} tickFormatter={(v) => "£" + v} />
          <Tooltip {...chartTip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="revenue" name="Revenue" fill="#5A5A62" radius={[3, 3, 0, 0]} />
          <Bar dataKey="profit" name="Profit" fill={T.accent} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function PlatformDonut({ platforms, total }) {
  if (!platforms.length) return <div style={{ ...body, fontSize: 13, color: T.dim }}>No sales in the last 30 days.</div>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ width: 150, height: 150, position: "relative", flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={platforms} dataKey="value" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={2} stroke="none">
              {platforms.map((p, k) => <Cell key={p.name} fill={PLAT_COLORS[k % PLAT_COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ ...display, fontWeight: 800, fontSize: 17 }}>{gbp(total)}</div>
          <div style={{ ...body, fontSize: 11, color: T.sec }}>Total sales</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 9 }}>
        {platforms.map((p, k) => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, ...body, fontSize: 13 }}>
            <span style={{ width: 9, height: 9, borderRadius: 9, background: PLAT_COLORS[k % PLAT_COLORS.length] }} />
            <span style={{ flex: 1 }}>{p.name}</span>
            <span style={{ color: T.sec }}>{total ? Math.round((p.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockTable({ items, go, openSell }) {
  const th = { ...body, fontSize: 12, color: T.sec, fontWeight: 500, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" };
  const td = { ...body, fontSize: 13.5, padding: "10px 10px", borderTop: `1px solid ${T.border}`, whiteSpace: "nowrap" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{["Item", "Brand", "Size", "Paid", "Sell price", "Status", "Platform", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const c = calc(it);
            const age = c.age;
            return (
              <tr key={it.id} onClick={() => go({ name: "detail", id: it.id })} style={{ cursor: "pointer" }}>
                <td style={{ ...td, whiteSpace: "normal" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 180 }}>
                    <Thumb it={it} size={38} />
                    <span style={{ fontWeight: 600 }}>{it.name || it.title || "Untitled"}</span>
                  </div>
                </td>
                <td style={{ ...td, color: T.sec }}>{it.brand || "—"}</td>
                <td style={{ ...td, color: T.sec }}>{it.size || "—"}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{has(it.purchasePrice) ? gbp(c.tpc) : "—"}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{c.sold ? gbp(num(it.actualPrice)) : has(it.expectedPrice) ? gbp(num(it.expectedPrice)) : "—"}</td>
                <td style={td}><StatusPill status={UNSOLD.includes(it.status) && it.status === "Purchased" ? "In stock" : it.status} age={age} /></td>
                <td style={{ ...td, color: T.sec }}>{it.platform || "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {UNSOLD.includes(it.status) && (
                    <button onClick={(e) => { e.stopPropagation(); openSell(it.id); }} className="vanim"
                      style={{ background: T.accentSoft, color: T.accent, border: `1px solid ${T.accentLine}`, borderRadius: 9, padding: "6px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Sold</button>
                  )}
                  {c.sold && <span style={{ ...display, fontWeight: 700, color: c.profit >= 0 ? T.pos : T.neg }}>{c.profit >= 0 ? "+" : ""}{gbp(c.profit)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecentSalesTable({ sales, go }) {
  if (!sales.length) return <div style={{ ...body, fontSize: 13, color: T.dim }}>No sales yet.</div>;
  const th = { ...body, fontSize: 12, color: T.sec, fontWeight: 500, textAlign: "left", padding: "6px 8px", whiteSpace: "nowrap" };
  const td = { ...body, fontSize: 13, padding: "9px 8px", borderTop: `1px solid ${T.border}`, whiteSpace: "nowrap" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Date", "Item", "Platform", "Sold for", "Costs", "Profit"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {sales.map((it) => {
            const c = calc(it);
            return (
              <tr key={it.id} onClick={() => go({ name: "detail", id: it.id })} style={{ cursor: "pointer" }}>
                <td style={{ ...td, color: T.sec }}>{it.saleDate ? new Date(it.saleDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</td>
                <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{it.name || it.title}</td>
                <td style={{ ...td, color: T.sec }}>{it.platform || "—"}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{gbp(num(it.actualPrice))}</td>
                <td style={{ ...td, color: T.neg, fontVariantNumeric: "tabular-nums" }}>{c.tsc ? "-" + gbp(c.tsc) : "—"}</td>
                <td style={{ ...td, fontWeight: 700, color: c.profit >= 0 ? T.pos : T.neg, fontVariantNumeric: "tabular-nums" }}>{gbp(c.profit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   HOME — phone
   ============================================================ */
function HomeScreen({ go, items, openAdd, openSell }) {
  const layout = useLayout();
  const d = useMemo(() => dashData(items), [items]);
  if (layout !== "phone") return <HomeWide go={go} items={items} d={d} openAdd={openAdd} openSell={openSell} />;

  const QA = ({ icon: Icon, label, onClick, primary }) => (
    <button onClick={onClick} className="vanim" style={{ flex: 1, minWidth: 0, background: primary ? T.accentSoft : T.surface, border: `1px solid ${primary ? T.accentLine : T.border}`, borderRadius: 14, padding: "13px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, color: T.text, cursor: "pointer" }}>
      {primary
        ? <span style={{ width: 28, height: 28, borderRadius: 28, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={17} color="#fff" strokeWidth={2.6} /></span>
        : <Icon size={22} color={T.accent} />}
      <span style={{ ...body, fontSize: 12, fontWeight: 500 }}>{label}</span>
    </button>
  );
  const H = ({ children, right }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 10px" }}>
      <div style={{ ...display, fontWeight: 700, fontSize: 18 }}>{children}</div>{right}
    </div>
  );

  return (
    <div style={{ padding: "calc(16px + env(safe-area-inset-top, 0px)) 18px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Logo size={27} />
        <button onClick={() => go({ name: "settings" })} aria-label="Settings" style={{ background: "none", border: "none", color: T.sec, cursor: "pointer", padding: 6 }}>
          <Settings size={21} />
        </button>
      </div>

      <div style={{ background: `linear-gradient(135deg, ${T.raised}, ${T.surface})`, border: `1px solid ${T.border}`, borderRadius: 18, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ ...body, fontSize: 13.5, color: T.sec }}>Total profit (this month)</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <span style={{ ...display, fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{gbp(d.profitMonth)}</span>
            <Delta pct={deltaPct(d.profitMonth, d.profitLastMonth)} />
          </div>
        </div>
        <BarChart3 size={38} color={T.accent} strokeWidth={2.6} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
        {[[Boxes, "Stock value", gbp(d.stockCost)], [Tag, "Items", d.unsold.length], [BarChart3, "Sales (30d)", gbp(d.sales30)]].map(([I, l, v]) => (
          <div key={l} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 11px", minWidth: 0 }}>
            <IconTile icon={I} size={30} />
            <div style={{ ...body, fontSize: 12, color: T.sec, marginTop: 9 }}>{l}</div>
            <div style={{ ...display, fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
          </div>
        ))}
      </div>

      <H right={<SeeAll onClick={() => go({ name: "stock" })} />}>Recent activity</H>
      <Panel pad="6px 14px"><ActivityList events={d.events} go={go} limit={4} /></Panel>

      <H>Quick actions</H>
      <div style={{ display: "flex", gap: 8 }}>
        <QA icon={Plus} label="Add item" onClick={openAdd} primary />
        <QA icon={Check} label="New sale" onClick={() => go({ name: "stock" })} />
        <QA icon={Sparkles} label="Listing" onClick={() => go({ name: "generator" })} />
        <QA icon={ScanSearch} label="Checker" onClick={() => go({ name: "checker" })} />
      </div>

      {d.quiet.length > 0 && (
        <>
          <H>Sitting too long</H>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {d.quiet.slice(0, 3).map((it) => <ItemRow key={it.id} it={it} onOpen={() => go({ name: "detail", id: it.id })} onSell={openSell} />)}
          </div>
        </>
      )}

      <H right={<RangeTag />}>Top selling items</H>
      <TopList top={d.top} />
    </div>
  );
}

/* ============================================================
   HOME — tablet / laptop dashboard
   ============================================================ */
function HomeWide({ go, items, d, openAdd, openSell }) {
  const layout = useLayout();
  const [cat, setCat] = useState("All");
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const stock = d.unsold.filter((i) => cat === "All" || clean(i.category).toLowerCase() === cat.toLowerCase()).slice(0, 8);
  const cats = ["All", ...[...new Set(d.unsold.map((i) => i.category).filter(Boolean))].slice(0, 4)];
  const cols = layout === "desktop";

  return (
    <div style={{ padding: "28px 28px 40px", maxWidth: 1360, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...display, fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em" }}>{greet}, Mason</div>
          <div style={{ ...body, fontSize: 14.5, color: T.sec, marginTop: 4 }}>Here's how the reselling's going.</div>
        </div>
        <RangeTag />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <StatTile label="Stock value (cost)" value={gbp(d.stockCost)} icon={Boxes} />
        <StatTile label="Items in stock" value={d.unsold.length} icon={Tag} sub={d.newThisWeek ? `${d.newThisWeek} new this week` : null} />
        <StatTile label="Total sales" value={gbp(d.sales30)} icon={BarChart3} delta={<Delta pct={deltaPct(d.sales30, d.salesPrev30)} />} sub="vs previous 30d" />
        <StatTile label="Profit" value={gbp(d.profit30)} icon={TrendingUp} delta={<Delta pct={deltaPct(d.profit30, d.profitPrev30)} />} sub="vs previous 30d" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: cols ? "1fr 1fr 0.9fr" : "1fr 1fr", gap: 12, marginTop: 12 }}>
        <Panel title="Sales overview" right={<RangeTag />}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span style={{ ...display, fontSize: 26, fontWeight: 800 }}>{gbp(d.sales30)}</span>
            <Delta pct={deltaPct(d.sales30, d.salesPrev30)} />
          </div>
          <SalesChart daily={d.daily} />
        </Panel>
        <Panel title="Profit overview" right={<RangeTag />}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span style={{ ...display, fontSize: 26, fontWeight: 800 }}>{gbp(d.profit30)}</span>
            <Delta pct={deltaPct(d.profit30, d.profitPrev30)} />
          </div>
          <ProfitChart daily={d.daily} />
        </Panel>
        <Panel title="Sales by platform" style={cols ? {} : { gridColumn: "1 / -1" }}>
          <PlatformDonut platforms={d.platforms} total={d.sales30} />
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: cols ? "2.1fr 0.9fr" : "1fr", gap: 12, marginTop: 12 }}>
        <Panel title="Current stock" right={
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {cats.length > 1 && cats.map((c) => <Chip key={c} label={c} small active={cat === c} onClick={() => setCat(c)} color={T.accent} />)}
            <Btn kind="accent" onClick={openAdd} style={{ padding: "8px 13px", fontSize: 13 }}><Plus size={15} /> Add item</Btn>
          </div>
        }>
          {stock.length ? <StockTable items={stock} go={go} openSell={openSell} /> : <div style={{ ...body, fontSize: 13, color: T.dim }}>No unsold stock.</div>}
          {d.unsold.length > stock.length && <div style={{ marginTop: 10 }}><SeeAll onClick={() => go({ name: "stock" })} /></div>}
        </Panel>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel title="Top selling items" right={<RangeTag />}><TopList top={d.top} /></Panel>
          <Panel title="Recent activity"><ActivityList events={d.events} go={go} limit={5} /></Panel>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel title="Recent sales" right={<SeeAll onClick={() => go({ name: "stock" })} />}>
          <RecentSalesTable sales={d.recentSales.slice(0, 6)} go={go} />
        </Panel>
      </div>
    </div>
  );
}

/* ============================================================
   STOCK LIST
   ============================================================ */
function StockScreen({ items, go, openAdd, openSell }) {
  const wide = useLayout() !== "phone";
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("In stock");
  const [sort, setSort] = useState("Newest");

  const filtered = useMemo(() => {
    let list = items;
    if (tab === "In stock") list = list.filter((i) => UNSOLD.includes(i.status));
    else if (tab === "Sold") list = list.filter((i) => i.status === "Sold");
    else list = list.filter((i) => i.status !== "Archived");
    if (q.trim()) {
      const words = q.trim().toLowerCase().split(/\s+/);
      list = list.filter((i) => {
        const hay = [i.name, i.title, i.brand, i.size, i.colour, i.sku, i.notes, i.storage, i.platform].map(clean).join(" ").toLowerCase();
        return words.every((w) => hay.includes(w));
      });
    }
    const by = {
      Newest: (a, b) => b.createdAt - a.createdAt,
      Oldest: (a, b) => (calc(b).age ?? -1) - (calc(a).age ?? -1) || a.createdAt - b.createdAt,
      "Most profit": (a, b) => (calc(b).profit ?? -1e9) - (calc(a).profit ?? -1e9),
      "Most paid": (a, b) => calc(b).tpc - calc(a).tpc,
      "A–Z": (a, b) => clean(a.name).localeCompare(clean(b.name)),
    };
    return [...list].sort(by[sort] || by.Newest);
  }, [items, q, tab, sort]);

  const counts = {
    "In stock": items.filter((i) => UNSOLD.includes(i.status)).length,
    Sold: items.filter((i) => i.status === "Sold").length,
  };
  const total = tab === "Sold"
    ? filtered.reduce((s, i) => s + (calc(i).profit || 0), 0)
    : filtered.filter((i) => UNSOLD.includes(i.status)).reduce((s, i) => s + calc(i).tpc, 0);

  return (
    <>
      <ScreenHeader title="Stock"
        right={<Btn kind="accent" style={{ padding: "9px 14px", fontSize: 13.5 }} onClick={openAdd}><Plus size={16} /> Add</Btn>} />
      <div style={{ padding: wide ? "20px 28px 32px" : "14px 18px 24px", maxWidth: wide ? 1360 : undefined, margin: "0 auto" }}>
        <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: 3, marginBottom: 10 }}>
          {["In stock", "Sold", "All"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, background: tab === t ? T.raised : "none", color: tab === t ? T.text : T.sec, border: "none", borderRadius: 10, padding: "9px 6px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
              {t}{counts[t] != null ? ` ${counts[t]}` : ""}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} color={T.sec} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
              style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, color: T.text, fontSize: 15, padding: "11px 12px 11px 36px" }} />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)}
            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, color: T.text, fontSize: 13, padding: "0 10px" }}>
            {["Newest", "Oldest", "Most profit", "Most paid", "A–Z"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>

        {filtered.length > 0 && (
          <div style={{ ...body, fontSize: 12.5, color: T.sec, marginBottom: 10 }}>
            {filtered.length} item{filtered.length === 1 ? "" : "s"} · {tab === "Sold" ? `${gbp(total)} profit` : `${gbp(total)} cost`}
          </div>
        )}

        {filtered.length === 0 ? (
          items.length === 0 ? (
            <Empty icon={Boxes} title="No stock yet" desc="Add your first item — name and price is all it needs."
              action={<Btn kind="accent" onClick={openAdd}><Plus size={16} /> Add stock</Btn>} />
          ) : (
            <Empty icon={Search} title="Nothing here" desc={q ? "Nothing matches that search." : tab === "Sold" ? "No sales yet." : "No unsold stock."} />
          )
        ) : (
          wide ? (
            <Panel pad="8px 12px"><StockTable items={filtered} go={go} openSell={openSell} /></Panel>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((it) => <ItemRow key={it.id} it={it} onOpen={() => go({ name: "detail", id: it.id })} onSell={openSell} />)}
            </div>
          )
        )}
      </div>
    </>
  );
}

/* ============================================================
   ITEM DETAIL
   ============================================================ */
function DetailScreen({ items, go, updateItem, deleteItem, duplicateItem, toast, openSell }) {
  const it = items.find((i) => i.id === (go.params && go.params.id));
  return <DetailInner key={it ? it.id : "none"} it={it} items={items} go={go.go} updateItem={updateItem} deleteItem={deleteItem} duplicateItem={duplicateItem} toast={toast} openSell={openSell} />;
}
function DetailInner({ it, items, go, updateItem, deleteItem, duplicateItem, toast, openSell }) {
  const [photos, setPhotos] = useState([]);
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
          <StatusPill status={it.status} age={c.age} />
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
            <div style={{ ...body, fontSize: 12, color: c.age > STALE_DAYS ? T.neg : T.sec, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              In stock for {c.age} days{c.age > STALE_DAYS ? " — consider a price reduction or relist" : ""}
            </div>
          )}
        </Card>

        {UNSOLD.includes(it.status) && (
          <Btn kind="accent" style={{ width: "100%", marginBottom: 12, fontSize: 15.5, padding: "15px" }} onClick={() => openSell(it.id)}>
            <Check size={17} /> Sold it
          </Btn>
        )}

        {it.status !== "Sold" && (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ ...body, fontSize: 12, color: T.sec, fontWeight: 600, letterSpacing: "0.02em", marginBottom: 10 }}>WHAT'S IT WORTH</div>
            <PriceCheck items={items} it={it} />
          </Card>
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
            Old AI guess from the Buy checker: ~{gbp(it.estSnapshot.priceLikely)} resale. Rough only — eBay sold prices above are the real numbers.
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
      <ScreenHeader title="Listing writer" onBack={() => go({ name: "home" })} />
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
                <Banner icon={Camera}>Add photos of one product — front, back, labels, and any flaws. Resell HQ reads them together and drafts an honest listing you can edit.</Banner>
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
      <ScreenHeader title="Buy checker" onBack={() => go({ name: "home" })} />
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

function prevWindow(range) {
  /* the window right before the selected one, for the % change */
  const now = new Date();
  if (!range) return null;
  if (range === "month") { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 1); return [s, e]; }
  if (range === "year") return [new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear(), 0, 1)];
  return [new Date(now - range * 2 * DAY), new Date(now - range * DAY)];
}
const inWindow = (dateStr, w) => { if (!dateStr) return false; const d = new Date(dateStr); return d >= w[0] && d < w[1]; };
const ALL_PLATFORMS = ["Vinted", "eBay", "Depop", "Shopify", "Other"];
const PLAT_COL = { Vinted: T.accent, eBay: "#FF9AA8", Depop: "#FB923C", Shopify: "#A78BFA", Other: "#8A8A92" };

function AnalyticsScreen({ items, go }) {
  const layout = useLayout();
  const wide = layout !== "phone";
  const [tab, setTab] = useState("Overview");
  const [range, setRange] = useState("All time");
  const [series, setSeries] = useState("Both");
  const r = RANGES[range];
  const active = items.filter((i) => i.status !== "Archived");
  const scoped = active.filter((i) => {
    if (!r) return true;
    if (i.status === "Sold") return inRange(i.saleDate, r);
    return inRange(i.purchaseDate || new Date(i.createdAt).toISOString().slice(0, 10), r);
  });
  const g = groupStats(scoped);
  const sold = scoped.filter((i) => i.status === "Sold");
  const owned = scoped.filter((i) => OWNED.includes(i.status));

  const pw = prevWindow(r);
  const prevSold = pw ? active.filter((i) => i.status === "Sold" && inWindow(i.saleDate, pw)) : [];
  const prevRev = prevSold.reduce((s, i) => s + num(i.actualPrice), 0);
  const prevProf = prevSold.reduce((s, i) => s + (calc(i).profit || 0), 0);
  const delta = (now, before) => (pw ? deltaPct(now, before) ?? (now > 0 ? 100 : null) : null);

  const monthly = useMemo(() => {
    const out = [];
    const now = new Date();
    const soldAll = active.filter((i) => i.status === "Sold" && i.saleDate);
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const ms = soldAll.filter((i) => { const s = new Date(i.saleDate); return s.getMonth() === d.getMonth() && s.getFullYear() === d.getFullYear(); });
      out.push({
        m: d.toLocaleDateString("en-GB", { month: "short" }),
        full: d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
        Revenue: +ms.reduce((s, i) => s + num(i.actualPrice), 0).toFixed(2),
        Profit: +ms.reduce((s, i) => s + (calc(i).profit || 0), 0).toFixed(2),
      });
    }
    return out;
  }, [items]);

  const group = (keyFn) => {
    const map = {};
    scoped.forEach((i) => { const k = keyFn(i) || "(none)"; (map[k] = map[k] || []).push(i); });
    return Object.entries(map).map(([name, list]) => ({ name, list, thumb: (list.find((x) => x.thumb) || {}).thumb, ...groupStats(list) }))
      .sort((a, b) => b.sold - a.sold || b.profit - a.profit);
  };
  const brands = group((i) => clean(i.brand).trim()).filter((b) => b.name !== "(none)" || b.sold);
  const categories = group((i) => clean(i.category).trim()).filter((c) => c.name !== "(none)" || c.sold);
  const topItems = group((i) => clean(i.name || i.title).trim()).filter((x) => x.sold).slice(0, 3);
  const platRev = {};
  sold.forEach((i) => { const p = ALL_PLATFORMS.includes(i.platform) ? i.platform : "Other"; platRev[p] = (platRev[p] || 0) + 1; });

  const ageBuckets = useMemo(() => {
    const defs = [["Under 7 days", 0, 7], ["7–30 days", 7, 31], ["31–60 days", 31, 61], ["61–90 days", 61, 91], ["Over 90 days", 91, 1e9]];
    const unsold = active.filter((i) => UNSOLD.includes(i.status));
    return defs.map(([label, lo, hi]) => {
      const list = unsold.filter((i) => { const a = calc(i).age ?? 0; return a >= lo && a < hi; });
      return { label, list, invested: list.reduce((s, i) => s + calc(i).tpc, 0) };
    });
  }, [items]);

  /* ---------- pieces ---------- */
  const Card4 = ({ label, value, icon, sub, d }) => (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: "15px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ ...body, fontSize: 13, color: T.sec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <IconTile icon={icon} size={34} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: -6 }}>
        <span style={{ ...display, fontSize: 25, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{value}</span>
        {d != null && isFinite(d) && <span style={{ ...body, fontSize: 12, fontWeight: 600, color: d >= 0 ? T.pos : T.neg }}>{d >= 0 ? "↗ +" : "↘ "}{d.toFixed(0)}%</span>}
      </div>
      {sub && <div style={{ ...body, fontSize: 13, color: T.sec, marginTop: 6 }}>{sub}</div>}
    </div>
  );
  const Card3 = ({ label, value, icon }) => (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "12px 12px", minWidth: 0, display: "flex", justifyContent: "space-between", gap: 6 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...body, fontSize: 12.5, color: T.sec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ ...display, fontSize: 21, fontWeight: 800, fontVariantNumeric: "tabular-nums", marginTop: 6, whiteSpace: "nowrap" }}>{value}</div>
      </div>
      <IconTile icon={icon} size={32} />
    </div>
  );
  const ShareBar = ({ pct: p }) => (
    <div style={{ height: 5, borderRadius: 5, background: T.raised, marginTop: 7, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, p))}%`, height: "100%", background: T.accent, borderRadius: 5 }} />
    </div>
  );
  const ShareRow = ({ name, thumb, count, total, extra, onClick }) => (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: onClick ? "pointer" : "default" }}>
      <Thumb it={{ thumb, name }} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <span style={{ ...body, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
          {total != null && <span style={{ ...body, fontWeight: 600, fontSize: 13.5 }}>{total ? Math.round((count / total) * 100) : 0}%</span>}
        </div>
        <div style={{ ...body, fontSize: 12.5, color: T.sec }}>{count} sale{count === 1 ? "" : "s"}{extra}</div>
        {total != null && <ShareBar pct={total ? (count / total) * 100 : 0} />}
      </div>
    </div>
  );
  const PanelHead = ({ title, onMore }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <span style={{ ...display, fontWeight: 700, fontSize: 16.5 }}>{title}</span>
      {onMore && <button onClick={onMore} aria-label={"More " + title} style={{ background: "none", border: "none", color: T.sec, cursor: "pointer", padding: 2 }}><ChevronRight size={18} /></button>}
    </div>
  );
  const box = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, minWidth: 0 };
  const empty = (t) => <div style={{ ...body, fontSize: 13, color: T.dim }}>{t}</div>;

  const overview = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 1fr)" : "1fr 1fr", gap: 10 }}>
        <Card4 label="Total revenue" value={gbp(g.revenue)} icon={BarChart3} sub={`${g.sold} sale${g.sold === 1 ? "" : "s"}`} d={delta(g.revenue, prevRev)} />
        <Card4 label="Total profit" value={gbp(g.profit)} icon={Coins} sub={`${g.sold} sale${g.sold === 1 ? "" : "s"}`} d={delta(g.profit, prevProf)} />
        <Card4 label="Stock spend" value={gbp(g.spend)} icon={ShoppingCart} sub={`${owned.length} purchase${owned.length === 1 ? "" : "s"}`} />
        <Card4 label="Invested (unsold)" value={gbp(g.invested)} icon={Box} sub={`${g.unsold} item${g.unsold === 1 ? "" : "s"}`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }}>
        <Card3 label="Avg profit / sale" value={g.avgProfit == null ? "—" : gbp(g.avgProfit)} icon={TrendingUp} />
        <Card3 label="Avg margin" value={pct(g.avgMargin)} icon={Percent} />
        <Card3 label="Avg days to sell" value={g.avgDays == null ? "—" : Math.round(g.avgDays)} icon={CalendarDays} />
      </div>

      <div style={{ ...box, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <span style={{ ...display, fontWeight: 700, fontSize: 17 }}>Revenue & profit</span>
          <div style={{ display: "flex", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 999, padding: 3 }}>
            {["Both", "Revenue", "Profit"].map((s) => (
              <button key={s} onClick={() => setSeries(s)} style={{ background: series === s ? T.accentSoft : "none", color: series === s ? T.text : T.sec, border: series === s ? `1px solid ${T.accentLine}` : "1px solid transparent", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
        </div>
        <div style={{ height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={4}>
              <CartesianGrid stroke={T.border} strokeDasharray="0" />
              <XAxis dataKey="m" {...axis} />
              <YAxis {...axis} tickFormatter={(v) => "£" + v} />
              <Tooltip contentStyle={chartTip.contentStyle} labelStyle={chartTip.labelStyle} formatter={(v) => gbp(v)} cursor={{ fill: "rgba(255,255,255,0.04)" }}
                labelFormatter={(l, p) => (p && p[0] && p[0].payload.full) || l} />
              {series !== "Profit" && <Bar dataKey="Revenue" fill="#7A1C24" radius={[4, 4, 0, 0]} maxBarSize={34} />}
              {series !== "Revenue" && <Bar dataKey="Profit" fill={T.accent} radius={[4, 4, 0, 0]} maxBarSize={34} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: wide ? "1.1fr 1fr 1fr 1fr" : "1fr 1fr", gap: 10, marginTop: 10 }}>
        <div style={box}>
          <PanelHead title="Sales by platform" />
          {!sold.length ? empty("No sales yet.") : (
            <div style={{ display: "flex", flexDirection: wide ? "row" : "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 120, height: 120, position: "relative", flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ALL_PLATFORMS.filter((p) => platRev[p]).map((p) => ({ name: p, value: platRev[p] }))} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={sold.length > 1 ? 2 : 0} stroke="none">
                      {ALL_PLATFORMS.filter((p) => platRev[p]).map((p) => <Cell key={p} fill={PLAT_COL[p]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ ...display, fontWeight: 800, fontSize: 19 }}>{sold.length}</div>
                  <div style={{ ...body, fontSize: 10.5, color: T.sec }}>Total sales</div>
                </div>
              </div>
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 7 }}>
                {ALL_PLATFORMS.map((p) => (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 7, ...body, fontSize: 12.5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 9, background: PLAT_COL[p], flexShrink: 0 }} />
                    <span style={{ flex: 1, color: T.sec }}>{p}</span>
                    <span style={{ fontWeight: 600 }}>{Math.round(((platRev[p] || 0) / sold.length) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={box}>
          <PanelHead title="Top categories" onMore={() => setTab("Categories")} />
          {categories.filter((c) => c.sold).length ? categories.filter((c) => c.sold).slice(0, 3).map((c) => <ShareRow key={c.name} name={c.name} thumb={c.thumb} count={c.sold} total={g.sold} />) : empty("No sales yet.")}
        </div>
        <div style={box}>
          <PanelHead title="Top brands" onMore={() => setTab("Brands")} />
          {brands.filter((b) => b.sold).length ? brands.filter((b) => b.sold).slice(0, 3).map((b) => <ShareRow key={b.name} name={b.name} thumb={b.thumb} count={b.sold} total={g.sold} />) : empty("No sales yet.")}
        </div>
        <div style={box}>
          <PanelHead title="Top items" onMore={() => go({ name: "stock" })} />
          {topItems.length ? topItems.map((t) => (
            <ShareRow key={t.name} name={t.name} thumb={t.thumb} count={t.sold} onClick={t.list.length === 1 ? () => go({ name: "detail", id: t.list[0].id }) : undefined}
              extra={<> · <span style={{ color: t.profit >= 0 ? T.pos : T.neg }}>{gbp(t.profit)} profit</span></>} />
          )) : empty("No sales yet.")}
        </div>
      </div>
    </>
  );

  const groupTable = (rows, label) => (
    rows.length ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((x) => (
          <div key={x.name} style={{ ...box, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Thumb it={{ thumb: x.thumb, name: x.name }} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...body, fontWeight: 600, fontSize: 15 }}>{x.name}</div>
                <div style={{ ...body, fontSize: 12.5, color: T.sec }}>{x.sold} sold · {x.unsold} in stock · {pct(x.sellThrough)} sell-through</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...display, fontWeight: 800, fontSize: 16, color: x.profit >= 0 ? T.pos : T.neg }}>{gbp(x.profit)}</div>
                <div style={{ ...body, fontSize: 11.5, color: T.sec }}>{gbp(x.revenue)} revenue</div>
              </div>
            </div>
            <ShareBar pct={g.profit > 0 ? (Math.max(0, x.profit) / g.profit) * 100 : 0} />
          </div>
        ))}
      </div>
    ) : empty(`Add a ${label} to items to see this breakdown.`)
  );

  const stockAge = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {ageBuckets.map((b) => (
        <div key={b.label} style={{ ...box, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ ...body, fontWeight: 600, fontSize: 15 }}>{b.label}</span>
            <span style={{ ...body, fontSize: 13, color: T.sec }}>{b.list.length} item{b.list.length === 1 ? "" : "s"} · {gbp(b.invested)}</span>
          </div>
          {b.list.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {b.list.slice(0, 5).map((it) => <ItemRow key={it.id} it={it} onOpen={() => go({ name: "detail", id: it.id })} />)}
              {b.list.length > 5 && <div style={{ ...body, fontSize: 12, color: T.dim }}>+{b.list.length - 5} more</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: wide ? "24px 28px 36px" : "calc(14px + env(safe-area-inset-top, 0px)) 16px 28px", maxWidth: wide ? 1360 : undefined, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => go({ name: "home" })} aria-label="Back" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: T.text, cursor: "pointer", flexShrink: 0 }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ ...display, fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em", flex: 1 }}>Analytics</div>
        <select value={range} onChange={(e) => setRange(e.target.value)}
          style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, color: T.text, fontSize: 14, fontWeight: 600, padding: "10px 12px" }}>
          {Object.keys(RANGES).map((k) => <option key={k}>{k}</option>)}
        </select>
      </div>
      <div className="vscroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14 }}>
        {["Overview", "Brands", "Categories", "Stock age"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: wide ? "0 0 auto" : 1, background: tab === t ? T.accentSoft : T.surface, color: tab === t ? T.text : T.sec, border: `1px solid ${tab === t ? T.accent : T.border}`, borderRadius: 999, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{t}</button>
        ))}
      </div>
      {tab === "Overview" && overview}
      {tab === "Brands" && groupTable(brands, "brand")}
      {tab === "Categories" && groupTable(categories, "category")}
      {tab === "Stock age" && stockAge}
    </div>
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
      const backup = { app: "resell-hq", version: 1, exportedAt: new Date().toISOString(), items, checks, images };
      downloadFile(`resell-hq-backup-${todayISO()}.json`, JSON.stringify(backup), "application/json");
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
      if (!["resell-hq", "vault"].includes(data.app) || !Array.isArray(data.items)) throw new Error("That doesn't look like a Resell HQ backup file.");
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
            <Btn kind="ghost" disabled={busy || items.length === 0} onClick={() => { downloadFile(`resell-hq-inventory-${todayISO()}.csv`, toCsv(items), "text/csv"); toast("CSV downloaded"); }}>
              <Download size={15} /> Export inventory CSV
            </Btn>
            <Btn kind="ghost" disabled={busy || items.length === 0} onClick={() => { downloadFile(`resell-hq-sales-${todayISO()}.csv`, toCsv(items.filter((i) => i.status === "Sold")), "text/csv"); toast("Sales CSV downloaded"); }}>
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
            The Listing Generator and Opportunity Checker need this passphrase. It must match RESELL_HQ_PASSPHRASE
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
              const ctx = c.getContext("2d"); ctx.fillStyle = T.accent; ctx.fillRect(0, 0, 8, 8);
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
          Resell HQ {APP_VERSION} · personal reselling app · resale estimates are always estimates, never guarantees
        </div>
      </div>
    </>
  );
}

/* ============================================================
   SHELL, NAV, FRAME
   ============================================================ */
function BottomNav({ screen, go, openAdd }) {
  const items = [
    { id: "home", label: "Home", icon: Home },
    { id: "stock", label: "Stock", icon: Package },
    { id: "add", label: "", icon: Plus, raised: true },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "More", icon: Settings },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: `1px solid ${T.border}`, background: "rgba(11,11,12,0.94)", backdropFilter: "blur(12px)", padding: "8px 6px calc(8px + env(safe-area-inset-bottom, 0px))", flexShrink: 0 }}>
      {items.map((it) => {
        const Icon = it.icon;
        const activeN = screen === it.id || (it.id === "stock" && ["detail", "edit"].includes(screen));
        if (it.raised) {
          return (
            <button key={it.id} onClick={openAdd} aria-label="Add stock" className="vanim"
              style={{ width: 52, height: 52, borderRadius: 18, background: T.accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginTop: -20, boxShadow: "0 6px 20px rgba(239,59,69,0.35)" }}>
              <Icon size={25} color={T.accentInk} strokeWidth={2.6} />
            </button>
          );
        }
        return (
          <button key={it.id} onClick={() => go({ name: it.id })} className="vanim"
            style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 10px", cursor: "pointer", color: activeN ? T.accent : T.sec }}>
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
  const layout = useViewportMode();
  const wide = layout !== "phone";
  const [screen, setScreen] = useState({ name: "home" });
  const [items, setItems] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [editPrefill, setEditPrefill] = useState(null);
  const toastTimer = useRef(null);
  const openAdd = () => setSheet({ type: "add" });
  const openSell = (id) => setSheet({ type: "sell", id });

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

  const go = (s) => { if (!(s.name === "edit" && !s.id)) setEditPrefill(null); setScreen(s); };
  const goObj = { go, params: screen };

  let content;
  if (!loaded) content = <Spinner label="Loading your stock…" />;
  else if (screen.name === "stock") content = <StockScreen items={items} go={go} openAdd={openAdd} openSell={openSell} />;
  else if (screen.name === "detail") content = <DetailScreen items={items} go={goObj} updateItem={updateItem} deleteItem={deleteItem} duplicateItem={duplicateItem} toast={toast} openSell={openSell} />;
  else if (screen.name === "edit" || screen.name === "add") content = <EditScreen items={items} go={goObj} saveItem={saveItem} toast={toast} prefill={editPrefill} />;
  else if (screen.name === "generator") content = <GeneratorScreen go={go} saveItem={saveItem} toast={toast} />;
  else if (screen.name === "checker") content = <CheckerScreen go={go} saveItem={saveItem} saveCheck={saveCheck} toast={toast} />;
  else if (screen.name === "analytics") content = <AnalyticsScreen items={items} checks={checks} go={go} />;
  else if (screen.name === "settings") content = <SettingsScreen items={items} checks={checks} go={go} importData={importData} wipeAll={wipeAll} toast={toast} />;
  else content = <HomeScreen go={go} items={items} openAdd={openAdd} openSell={openSell} />;

  const sellItem = sheet && sheet.type === "sell" ? items.find((i) => i.id === sheet.id) : null;

  const fullWidth = ["home", "stock", "analytics"].includes(screen.name) || !loaded;
  const main = (
    <div key={screen.name + (screen.id || "")} className="vscroll vfade" style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", minWidth: 0 }}>
      {wide && !fullWidth ? <div style={{ maxWidth: 760, margin: "0 auto" }}>{content}</div> : content}
    </div>
  );

  return (
    <LayoutCtx.Provider value={layout}>
      <div style={{ display: "flex", flexDirection: wide ? "row" : "column", height: "100%", background: T.bg, color: T.text, overflow: "hidden", position: "relative" }}>
        {isDesktop && !wide && <StatusBar />}
        {wide && <Sidebar screen={screen.name} go={go} openAdd={openAdd} compact={layout === "tablet"} />}
        {main}
        <Toast msg={toastMsg} />
        {!wide && <BottomNav screen={screen.name} go={go} openAdd={openAdd} />}
        {sheet && sheet.type === "add" && (
          <QuickAddSheet items={items} onClose={() => setSheet(null)} saveItem={saveItem} toast={toast}
            openFull={(prefill) => { setSheet(null); setEditPrefill(prefill); setScreen({ name: "edit", id: null }); }} />
        )}
        {sellItem && <SellSheet it={sellItem} onClose={() => setSheet(null)} updateItem={updateItem} toast={toast} />}
      </div>
    </LayoutCtx.Provider>
  );
}

export default function ResellHQApp() {
  return (
    <div style={{
      ...body, height: "100dvh", background: T.bg,
      paddingLeft: "env(safe-area-inset-left, 0px)",
      paddingRight: "env(safe-area-inset-right, 0px)",
      boxSizing: "border-box",
    }}>
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      <AppShell isDesktop={false} />
    </div>
  );
}
