/**
 * ULGlass engine — framework-agnostic. Owns the SVG refraction filters, the
 * procedural displacement maps, the quality governor (refraction budget),
 * the shared pointer loop (light, elasticity, press) and materialize.
 * React components call attachGlass/detachGlass.
 */
import { springs } from '../motion/spring.ts';

export type GlassTier = 'sm' | 'md' | 'lg' | 'xl';
/** refract = full (SVG lens). lite = blur + saturate (Chromium, governed). fallback = blur-only because the browser can't refract. flat = no backdrop-filter. */
export type GlassMode = 'refract' | 'lite' | 'fallback' | 'flat';
/** Requested quality. auto (default) lets the governor decide within the refraction budget. */
export type GlassQuality = 'full' | 'lite' | 'flat' | 'auto';
/** Governor priority: overlay > focused/hovered > island > closest to viewport center. */
export type GlassPriority = 'overlay' | 'island' | 'normal';
/** Lens profile. standard: edge-normal bend. polar: radial bend from center. prominent: wider, stronger bezel. */
export type LensMode = 'standard' | 'polar' | 'prominent';
export interface GlassOptions {
  /** Multiplier on the displacement scale. 0 disables the lens. */
  refraction?: number;
  /** Pointer-tracked specular light + rim rotation. Default true. */
  light?: boolean;
  /** Paint the displacement map instead of the material. */
  debug?: boolean;
  mode?: LensMode;
  /**
   * Elastic surface: hover pulls it a few px toward the pointer; press/drag
   * stretches it along the motion. Default false. Controls only (buttons,
   * chips, thumbs, segmented lens, FAB); never cards, panels, sheets.
   */
  interactive?: boolean;
  /** Overrides the size-tier factor (--ul-elasticity-sm/md/lg/xl). Still × --ul-elasticity. */
  elasticity?: number;
  /** Press feedback: scale down + flare at the pointer. */
  pressable?: boolean;
  /** Pressed scale. Default .965; menu items use .98. */
  pressScale?: number;
  /** full | lite | flat | auto (default). */
  quality?: GlassQuality;
  /** Governor priority. Default: overlay for [role=dialog] / anchored surfaces, else normal. */
  priority?: GlassPriority;
  /** @internal Showcase-only: the first, over-strong elasticity model, for comparison. Remove after tuning. */
  legacyElastic?: boolean;
}
export interface GlassConfig {
  strength: number;
  forceFallback: boolean;
  /** Apply the mobile policy on any device (showcase / testing). */
  forceMobile: boolean;
  /** Refraction budget in px² of refracted area per viewport: 'auto' (governed, starts at --ul-perf-refraction-area) or fixed (Infinity = unlimited area and count). */
  budget: 'auto' | number;
  /** Pointer light on/off (measurement / debugging). Default true. */
  light: boolean;
  /** Debug (?glass=full|lite|flat): one tier for every surface, overrides per-surface quality. null = per surface. */
  forceQuality: Exclude<GlassQuality, 'auto'> | null;
}
export interface DisplacementMaps { map: string; rim: string; width: number; height: number; /** both images decoded (a filter only references decoded maps) */ ready?: boolean; decoded?: Promise<void> }
/** Arrow outline (overlays + tooltips, full tier only): the map is built from body ∪ arrow, so the bezel bends into the arrow base. */
export interface MapArrow { edge: 'top' | 'bottom' | 'left' | 'right'; pos: number; half: number; depth: number }
export interface MapOptions { mode?: LensMode; magnify?: number; scale?: number; arrow?: MapArrow }
/** Map generation cost (ms), for the perf report: last plain map, last arrow map, count of each. */
export const mapCost = { plain: 0, arrow: 0, nPlain: 0, nArrow: 0, maxArrow: 0 };
export interface GlassStats {
  instances: number; visible: number; refract: number; lite: number; fallback: number; flat: number;
  /** Refracted-area budget (px²) now / configured; area and count granted at the last governor run. */
  budget: number; maxBudget: number; maxCount: number; areaUsed: number; refractCount: number; degraded: boolean; filters: number; maps: number; lightWrites: number;
}

interface Motion {
  x: number; y: number; vx: number; vy: number; tx: number; ty: number;
  st: number; vst: number; tst: number; ang: number;
  p: number; vp: number; tp: number; flare: number; pressed: boolean;
}

interface FilterRec {
  id: string; el: SVGFilterElement; mapImg: SVGFEImageElement; rimImg: SVGFEImageElement;
  passes: SVGFEDisplacementMapElement[]; flood: SVGFEFloodElement; tintMix: SVGFECompositeElement;
  n: number; refs: number; key: string; last: Record<string, string>;
}

interface GlassState {
  el: HTMLElement;
  opts: GlassOptions;
  /** Current rendered mode. */
  mode: GlassMode;
  /** Mode the surface is heading to (differs from mode while a demotion crossfade runs). */
  target: GlassMode | '';
  nested: boolean;
  visible: boolean;
  canRefract: boolean;
  granted: boolean;
  born: number;
  base: number;
  aberration: number;
  elastic: number;
  /** min(width, height); drives the elasticity size tier and reaction zone. */
  size: number;
  area: number;
  /** Materialize factor 0..1, multiplies the displacement scale. */
  k: number;
  /** Quality crossfade factor 0..1 (lite → full), multiplies the displacement scale and backdrop colorize. */
  q: number;
  key: string;
  maps?: DisplacementMaps;
  raf: number;
  anim: number;
  qAnim: number;
  animating: boolean;
  liveRamp: boolean;
  liveAccent: boolean;
  pending: boolean;
  geo?: { w: number; h: number };
  /** A tier change arrived while an anchored morph ran; applied when the morph ends (releaseGlassTier). */
  tierHeld?: boolean;
  /** The map decoded while a morph ran: the lite → refract crossfade waits for the morph to settle (never mid-travel). */
  fadeHeld?: boolean;
  ro?: ResizeObserver;
  roTimer: number;
  pressBound: boolean;
  hot: number;
  hotUntil: number;
  color: string;
  a: number;
  shared?: FilterRec;
  priv?: FilterRec;
  url: string;
  /** IntersectionObserver result waiting for scroll idle */
  visWant?: boolean;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const states = new Map<HTMLElement, GlassState>();
const motions = new Map<HTMLElement, Motion>();
const config: GlassConfig = { strength: 1, forceFallback: false, forceMobile: false, budget: 'auto', light: true, forceQuality: null };
/** Diagnostics only (scroll flash bisect): each switch disables one subsystem. configureGlass({ bisect: { … } }). */
export interface GlassBisect {
  noAberration?: boolean; noTint?: boolean; noGovern?: boolean; noIO?: boolean; noAccentObserver?: boolean; noMapRegen?: boolean; noHover?: boolean;
  /** Legacy look: R/G/B displaced in three passes (the scroll-flash suspect). Default is ONE pass + CSS bezel fringe. */
  threePass?: boolean;
  /** With threePass: recombine the isolated channels with feComposite arithmetic (exact sum) instead of feBlend screen. */
  compositeRecombine?: boolean;
  /** Cap the filter region (px per side) — tests large-region fallback at tile boundaries. */
  capRegion?: number;
}
const bisect: GlassBisect = {};
/* ---------- Scroll freeze: while the page (or any scroller) scrolls, NO surface changes tier, filter, map, accent or light.
   Decisions queued during scroll run once, ~--ul-perf-scroll-idle (150ms) after the last scroll event. ---------- */
let scrolling = false, idleTimer = 0;
const idleQueue = new Set<() => void>();
/** Run now, or once scrolling is idle (deduplicated by function identity). */
function whenIdle(fn: () => void) { if (!scrolling) fn(); else idleQueue.add(fn); }
function markScrolling() {
  scrolling = true;
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    scrolling = false;
    const q = [...idleQueue]; idleQueue.clear();
    q.forEach((f) => f());
  }, rootNum('--ul-perf-scroll-idle', 150));
}
/** Cold start: build the defs, read perf tokens and park one 1-pass and one 3-pass filter in the recycle pool (idle / trigger hover). */
let warmed = false;
export function prewarmGlass(): void {
  if (warmed || typeof document === 'undefined') return;
  warmed = true;
  if (!perfRead) readPerf();
  if (!supportsRefraction()) return;
  getDefs(); privFree.push(makeFilter(1));
}
/** True while a scroll is in progress (tests, owners). */
export const isGlassScrolling = () => scrolling;
const PROFILE: Record<LensMode, { exp: number; gain: number }> = {
  standard: { exp: 2.2, gain: 1 },
  polar: { exp: 2.2, gain: 1 },
  prominent: { exp: 1.5, gain: 1.2 },
};
let uid = 0;
let defsEl: SVGDefsElement | null = null;

const media = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
const reducedMotion = () => media('(prefers-reduced-motion: reduce)');
const coarseOnly = () => media('(pointer: coarse)') && !media('(any-pointer: fine)');
/** Mobile policy (phones and small tablets with touch): refraction is reduced and only kept on small surfaces. */
export const isMobileGlass = () => config.forceMobile || (media('(pointer: coarse)') && media('(max-width: 1024px)'));
const rootNum = (k: string, f: number) => { if (typeof document === 'undefined') return f; const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
/** Large surfaces on mobile skip the SVG filter (cost grows with area × device pixel ratio²). */
const mobileTooBig = (el: HTMLElement) => isMobileGlass() && el.offsetWidth * el.offsetHeight > rootNum('--ul-mobile-refraction-max-area', 40000);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const now = () => performance.now();

/* ---------- Perf tokens (read once, refreshed by refreshGlass) ---------- */
const perf = { area: 150000, maxCount: 30, smallArea: 16000, frameMs: 18, aberrationArea: 16000, bucket: 4, bucketSmall: 1, demote: 400, crossfade: 320, promoteArea: 160000, margin: 200, bezelMax: 0.35, smallShift: 8 };
let perfRead = false;
function readPerf() {
  perfRead = true;
  perf.area = rootNum('--ul-perf-refraction-area', 150000);
  perf.maxCount = rootNum('--ul-perf-refraction-max-count', 30);
  perf.smallArea = rootNum('--ul-perf-small-area', 16000);
  perf.bucketSmall = Math.max(1, rootNum('--ul-perf-size-bucket-small', 1));
  perf.bezelMax = rootNum('--ul-glass-bezel-max-ratio', 0.35);
  perf.smallShift = rootNum('--ul-glass-small-edge-shift', 8);
  perf.frameMs = rootNum('--ul-perf-frame-budget', 18);
  perf.aberrationArea = rootNum('--ul-perf-aberration-min-area', 16000);
  perf.bucket = Math.max(1, rootNum('--ul-perf-size-bucket', 4));
  perf.demote = rootNum('--ul-perf-demote-delay', 400);
  perf.crossfade = rootNum('--ul-perf-crossfade', 320);
  perf.promoteArea = rootNum('--ul-perf-promote-max-area', 160000);
  perf.margin = rootNum('--ul-perf-offscreen-margin', 200);
  liveBudget = Math.min(liveBudget || perf.area, perf.area) || perf.area;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, String(attrs[k]));
  parent?.appendChild(node);
  return node;
}

function getDefs(): SVGDefsElement {
  if (defsEl?.isConnected) return defsEl;
  const root = svgEl('svg', { width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false', 'data-ul-glass-defs': '' });
  root.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  defsEl = svgEl('defs', {}, root);
  document.body.appendChild(root);
  return defsEl;
}

/** backdrop-filter: url(#svg) only renders in Chromium. Everything else gets blur + saturate. */
export function supportsRefraction(): boolean {
  if (typeof window === 'undefined' || config.forceFallback) return false;
  if (media('(prefers-reduced-transparency: reduce)') || document.documentElement.dataset.ulTransparency === 'reduce') return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  if (brands?.length) return brands.some((b) => b.brand === 'Chromium');
  return /\bChrome\/\d+/.test(navigator.userAgent) && !/\bFirefox\//.test(navigator.userAgent);
}

/**
 * Displacement map rendered on canvas, returned as PNG. R/G encode the x/y
 * sample offset (128 = neutral).
 * - Bezel: a FIXED-width band (`bezel` px, independent of element size) with a
 *   steep convex profile (1 − s)^exp — maximum at the very edge, smoothly
 *   reaching neutral `bezel` px inside. Follows `radius`.
 * - Center: a gentle linear gradient that samples toward the center, giving a
 *   `magnify`× lens (needs the real displacement `scale` to compute).
 * Also returns a rim mask used to light the outer 2px with the backdrop's color.
 */
export function generateDisplacementMap(width: number, height: number, radius: number | [number, number, number, number], bezel: number, opts: MapOptions = {}): DisplacementMaps {
  const mode = opts.mode ?? 'standard';
  const { exp } = PROFILE[mode];
  const magnify = opts.magnify ?? 1;
  const scale = opts.scale ?? 0;
  const res = width * height > 260_000 ? 0.5 : 1;
  const W = Math.max(2, Math.round(width * res));
  const H = Math.max(2, Math.round(height * res));
  const hw = W / 2, hh = H / 2;
  const rs = (Array.isArray(radius) ? radius : [radius, radius, radius, radius]).map((v) => Math.min(v * res, hw, hh)); // tl, tr, br, bl
  const b = Math.max(1, Math.min(bezel * res, hw, hh));
  const band = Math.max(1, 2 * res);
  // offset_px = scale * (C/255 − .5); we want offset = −pos * (1 − 1/m)  →  per-real-px coefficient
  const mk = scale > 0 && magnify > 1 ? (2 * (1 - 1 / magnify)) / scale : 0;
  const t0 = performance.now();
  // arrow base (body ∪ arrow): along the arrow edge, inside [pos − half, pos + half], the body has no boundary, so the
  // nearest boundary of the union is a base corner. Distances there are measured to those corners (bezel + rim bend into the arrow).
  const ar = opts.arrow;
  const base = ar ? (() => {
    const horiz = ar.edge === 'top' || ar.edge === 'bottom', c = ar.pos * res - (horiz ? hw : hh), h2 = ar.half * res;
    return { horiz, lo: c - h2, hi: c + h2, e: ar.edge === 'top' ? -hh : ar.edge === 'bottom' ? hh : ar.edge === 'left' ? -hw : hw, sgn: ar.edge === 'top' || ar.edge === 'left' ? -1 : 1 };
  })() : null;
  const mapC = document.createElement('canvas');
  const rimC = document.createElement('canvas');
  mapC.width = rimC.width = W;
  mapC.height = rimC.height = H;
  const mctx = mapC.getContext('2d')!, rctx = rimC.getContext('2d')!;
  const md = mctx.createImageData(W, H), rd = rctx.createImageData(W, H);
  const L = Math.SQRT1_2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const px = x + 0.5 - hw, py = y + 0.5 - hh;
      const r = rs[py < 0 ? (px < 0 ? 0 : 1) : px < 0 ? 3 : 2];
      const ax = Math.abs(px), ay = Math.abs(py);
      const qx = ax - (hw - r), qy = ay - (hh - r);
      let dist: number, nx: number, ny: number;
      if (qx > 0 && qy > 0) {
        const l = Math.hypot(qx, qy) || 1;
        dist = r - l; nx = qx / l; ny = qy / l;
      } else {
        const dx = hw - ax, dy = hh - ay;
        if (dx < dy) { dist = dx; nx = 1; ny = 0; } else { dist = dy; nx = 0; ny = 1; }
      }
      nx *= Math.sign(px) || 1;
      ny *= Math.sign(py) || 1;
      if (base && dist >= 0) { // nearest edge is the arrow edge and the point projects onto the base span → distance to a base corner
        const along = base.horiz ? px : py, onEdge = base.horiz ? ny === base.sgn && Math.abs(py) > 0 : nx === base.sgn;
        if (onEdge && along > base.lo && along < base.hi) {
          const cx = along - base.lo < base.hi - along ? base.lo : base.hi;
          const ex = base.horiz ? cx : base.e, ey = base.horiz ? base.e : cx, l = Math.hypot(ex - px, ey - py) || 1;
          if (l > dist) { dist = l; nx = (ex - px) / l; ny = (ey - py) / l; }
        }
      }
      if (mode === 'polar') { const l = Math.hypot(px, py) || 1; nx = px / l; ny = py / l; }
      const inside = dist >= 0;
      const mag = inside && dist < b ? Math.pow(1 - dist / b, exp) : 0;
      const ox = inside ? clamp(nx * mag + (px / res) * mk, -1, 1) : 0;
      const oy = inside ? clamp(ny * mag + (py / res) * mk, -1, 1) : 0;
      md.data[i] = 128 - ox * 127;
      md.data[i + 1] = 128 - oy * 127;
      md.data[i + 2] = 128;
      md.data[i + 3] = 255;
      let a = 0;
      if (inside && dist < band) {
        const facing = Math.abs(-nx * L - ny * L); // bright top-left and bottom-right
        a = (1 - dist / band) * (0.3 + 0.7 * facing);
      }
      rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = 255;
      rd.data[i + 3] = a * 255;
    }
  }
  mctx.putImageData(md, 0, 0);
  rctx.putImageData(rd, 0, 0);
  const out = { map: mapC.toDataURL('image/png'), rim: rimC.toDataURL('image/png'), width, height };
  const ms = performance.now() - t0;
  if (ar) { mapCost.arrow = ms; mapCost.nArrow++; mapCost.maxArrow = Math.max(mapCost.maxArrow, ms); } else { mapCost.plain = ms; mapCost.nPlain++; }
  return out;
}

/* ---------- Shared displacement maps: one per quantized (size, radius, bezel, magnify, scale, lens) ---------- */
const mapCache = new Map<string, DisplacementMaps>();
function getMaps(key: string, make: () => DisplacementMaps): DisplacementMaps {
  let m = mapCache.get(key);
  if (m) { mapCache.delete(key); mapCache.set(key, m); return m; } // LRU touch
  m = make();
  // decode before any filter references the map: an undecoded feImage renders as empty for a frame, which the
  // per-channel displacement passes turn into red / green / blue fringes
  const mm = m;
  mm.ready = typeof Image === 'undefined';
  if (!mm.ready) {
    const dec = (src: string) => { const im = new Image(); im.src = src; return im.decode().catch(() => {}); };
    mm.decoded = Promise.all([dec(mm.map), dec(mm.rim)]).then(() => new Promise<void>((r) => requestAnimationFrame(() => r()))).then(() => { mm.ready = true; });
  }
  mapCache.set(key, m);
  if (mapCache.size > 48) mapCache.delete(mapCache.keys().next().value as string);
  return m;
}

/* ---------- Filters: shared by identical params; private while a surface animates ---------- */
const ISOLATE = [
  '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
];
const pool = new Map<string, FilterRec>();
let privCount = 0;

/** n = 3: chromatic aberration (R/G/B displaced separately). n = 1: one displacement pass. */
function makeFilter(n: number): FilterRec {
  const id = `ul-refraction-${++uid}`;
  const f = svgEl('filter', {
    id, x: 0, y: 0, width: 1, height: 1,
    filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB',
  }, getDefs());
  const mapImg = svgEl('feImage', { x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: 'none', result: 'map' }, f);
  const rimImg = svgEl('feImage', { x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: 'none', result: 'rim' }, f);
  let passes: SVGFEDisplacementMapElement[];
  if (n === 3) {
    passes = ISOLATE.map((values, i) => {
      const d = svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G', result: `d${i}` }, f);
      svgEl('feColorMatrix', { in: `d${i}`, type: 'matrix', values, result: `c${i}` }, f);
      return d;
    });
    if (bisect.compositeRecombine) {
      svgEl('feComposite', { in: 'c0', in2: 'c1', operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: 0, result: 'rg' }, f);
      svgEl('feComposite', { in: 'rg', in2: 'c2', operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: 0, result: 'refracted' }, f);
    } else {
      svgEl('feBlend', { in: 'c0', in2: 'c1', mode: 'screen', result: 'rg' }, f);
      svgEl('feBlend', { in: 'rg', in2: 'c2', mode: 'screen', result: 'refracted' }, f);
    }
  } else {
    passes = [svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G', result: 'refracted' }, f)];
  }
  const ct = svgEl('feComponentTransfer', { in: 'refracted', result: 'bright' }, f);
  for (const ch of ['feFuncR', 'feFuncG', 'feFuncB'] as const) svgEl(ch, { type: 'linear', slope: 1.6, intercept: 0.08 }, ct);
  svgEl('feComposite', { in: 'bright', in2: 'rim', operator: 'in', result: 'rimlit' }, f);
  // Tint the BACKDROP: keep the refracted luminance, take the accent's hue + chroma (feBlend mode=color),
  // then mix with the untinted refraction by strength. Refraction and aberration above stay neutral.
  const flood = svgEl('feFlood', { 'flood-color': '#8fb8ff', 'flood-opacity': 1, result: 'flood' }, f);
  svgEl('feBlend', { in: 'flood', in2: 'refracted', mode: 'color', result: 'colorized' }, f);
  const tintMix = svgEl('feComposite', { in: 'colorized', in2: 'refracted', operator: 'arithmetic', k1: 0, k2: 0, k3: 1, k4: 0, result: 'tinted' }, f);
  const merge = svgEl('feMerge', {}, f);
  svgEl('feMergeNode', { in: 'tinted' }, merge);
  svgEl('feMergeNode', { in: 'rimlit' }, merge);
  // every primitive in sRGB (not only the filter element): no linearRGB round trip on any intermediate result
  f.querySelectorAll('*').forEach((node) => node.setAttribute('color-interpolation-filters', 'sRGB'));
  return { id, el: f, mapImg, rimImg, passes, flood, tintMix, n, refs: 0, key: '', last: {} };
}

interface FilterParams { n: number; w: number; h: number; mapKey: string; map: string; rim: string; scales: number[]; color: string; a: number }

function setA(rec: FilterRec, node: Element, slot: string, name: string, v: string) {
  const k = slot + name;
  if (rec.last[k] === v) return;
  rec.last[k] = v;
  node.setAttribute(name, v);
}
function writeFilter(rec: FilterRec, p: FilterParams) {
  const cap = bisect.capRegion || Infinity;
  const w = Math.min(p.w, cap).toFixed(1), h = Math.min(p.h, cap).toFixed(1);
  setA(rec, rec.el, 'f', 'width', w); setA(rec, rec.el, 'f', 'height', h);
  setA(rec, rec.mapImg, 'm', 'width', w); setA(rec, rec.mapImg, 'm', 'height', h);
  setA(rec, rec.rimImg, 'r', 'width', w); setA(rec, rec.rimImg, 'r', 'height', h);
  if (rec.last.mapKey !== p.mapKey) { rec.last.mapKey = p.mapKey; rec.mapImg.setAttribute('href', p.map); rec.rimImg.setAttribute('href', p.rim); }
  rec.passes.forEach((d, i) => setA(rec, d, 'p' + i, 'scale', (p.scales[i] ?? 0).toFixed(2)));
  setA(rec, rec.flood, 'c', 'flood-color', p.color);
  setA(rec, rec.tintMix, 't', 'k2', p.a.toFixed(3));
  setA(rec, rec.tintMix, 't', 'k3', (1 - p.a).toFixed(3));
}
function paramKey(p: FilterParams) {
  return `${p.n}|${p.w.toFixed(0)}x${p.h.toFixed(0)}|${p.mapKey}|${p.scales.map((x) => x.toFixed(1)).join(',')}|${p.color}|${p.a.toFixed(3)}`;
}
/** Filter definitions are static: an unused shared filter stays in the defs (and keeps its decoded feImage) until the pool
 *  exceeds --ul-perf-filter-pool unused entries, and is only ever evicted while scrolling is idle. */
const unused = new Set<FilterRec>();
function release(rec?: FilterRec) {
  if (!rec) return;
  if (--rec.refs <= 0) { rec.refs = 0; unused.add(rec); whenIdle(evict); }
}
function evict() {
  const cap = rootNum('--ul-perf-filter-pool', 48);
  for (const r of unused) { if (unused.size <= cap) break; if (r.refs > 0) { unused.delete(r); continue; } r.el.remove(); pool.delete(r.key); unused.delete(r); }
}
/** Private (animating) filters are recycled, never removed and re-added per animation. */
const privFree: FilterRec[] = [];
function takePriv(n: number): FilterRec { const i = privFree.findIndex((r) => r.n === n); if (i >= 0) return privFree.splice(i, 1)[0]; return makeFilter(n); }
function dropPriv(s: GlassState) { if (s.priv) { privFree.push(s.priv); s.priv = undefined; privCount--; } }

/** Chromatic aberration only on full surfaces at or above --ul-perf-aberration-min-area, and not while the governor is degraded. */
// Default ONE displacement pass: the 3-pass R/G/B recombination could render a single surviving channel for a frame while
// Chromium re-rasterised backdrop tiles during scroll (the red / green / blue scroll flash). The chroma fringe now lives in
// CSS on the bezel (ULGlass.css --ul-glass-fringe), so no channel-separated state can ever reach the screen.
const passesFor = (s: GlassState) => (bisect.threePass && !bisect.noAberration && s.aberration > 0 && !degraded && (s.area >= perf.aberrationArea || (s.area < perf.smallArea && (s.hot > 0 || s.hotUntil > now()))) ? 3 : 1);
const isLive = (s: GlassState) => s.animating || s.liveRamp || s.liveAccent || !!s.geo || s.el.hasAttribute('data-ul-morphing');

function paramsOf(s: GlassState): FilterParams | null {
  if (!s.maps) return null;
  const n = passesFor(s);
  const base = s.base * s.k * s.q * config.strength * (isMobileGlass() ? rootNum('--ul-mobile-refraction-scale', 0.5) : 1);
  const scales = n === 3 ? [1, 1 - 0.05 * s.aberration, 1 - 0.1 * s.aberration].map((f) => base * f) : [base];
  return { n, w: s.geo?.w ?? s.maps.width, h: s.geo?.h ?? s.maps.height, mapKey: s.key, map: s.maps.map, rim: s.maps.rim, scales, color: s.color, a: bisect.noTint ? 0 : s.a * s.q };
}

const LITE_TERM = ' var(--ul-lite-filter)';
function setUrl(s: GlassState, id: string) {
  const u = id ? `url(#${id})${s.liveRamp ? LITE_TERM : ''}` : '';
  if (u === s.url) return;
  s.url = u;
  if (u) s.el.style.setProperty('--ul-glass-filter', u); else s.el.style.removeProperty('--ul-glass-filter');
}

function unbindFilter(s: GlassState) {
  release(s.shared); s.shared = undefined;
  dropPriv(s);
  setUrl(s, '');
}

const waitingMaps = new WeakSet<object>();
/** Point the surface at a filter matching its current params: its own while animating, a shared one at rest. */
function bindFilter(s: GlassState) {
  if (s.mode !== 'refract') { unbindFilter(s); return; }
  if (s.maps && !s.maps.ready) {
    // never show a partially built surface: stay on the calm blur state, crossfade in once the map is decoded
    const m = s.maps; unbindFilter(s); s.q = 0; setLite(s, 1);
    if (waitingMaps.has(m)) return; // bindFilter runs every morph frame: one decode listener per map
    waitingMaps.add(m);
    m.decoded?.then(() => whenIdle(() => {
      if (s.maps !== m || s.mode !== 'refract' || !s.el.isConnected) return;
      if (s.el.hasAttribute('data-ul-morphing')) { s.fadeHeld = true; return; } // upgrade after the morph settles (releaseGlassTier)
      if (reducedMotion()) { s.q = 1; setLite(s, 0); bindFilter(s); } else crossfade(s, 1);
    }));
    return;
  }
  const p = paramsOf(s);
  if (!p) return;
  if (isLive(s)) {
    if (!s.priv || s.priv.n !== p.n) { dropPriv(s); s.priv = takePriv(p.n); s.priv.last = {}; privCount++; }
    writeFilter(s.priv, p);
    setUrl(s, s.priv.id);
    if (s.shared) { release(s.shared); s.shared = undefined; }
    return;
  }
  const key = paramKey(p);
  if (s.shared?.key === key) { setUrl(s, s.shared.id); dropPriv(s); return; }
  let rec = pool.get(key);
  if (!rec) { rec = makeFilter(p.n); rec.key = key; writeFilter(rec, p); pool.set(key, rec); }
  rec.refs++; unused.delete(rec);
  release(s.shared);
  s.shared = rec;
  setUrl(s, rec.id);
  dropPriv(s);
}
const applyScale = bindFilter;

function applyDebug(s: GlassState) {
  const el = s.el;
  if (s.opts.debug && s.maps) {
    el.dataset.ulDebug = '';
    el.style.setProperty('--ul-glass-debug-map', `url("${s.maps.map}")`);
  } else {
    delete el.dataset.ulDebug;
    el.style.removeProperty('--ul-glass-debug-map');
  }
}

function measure(s: GlassState) {
  s.raf = 0;
  const el = s.el;
  if (!el.isConnected || !s.visible) return;
  // Never regenerate while an animation runs (morph radius, materialize, crossfade); catch up afterwards.
  if ((el.hasAttribute('data-ul-morphing') || s.animating || s.liveRamp) && s.key) { s.pending = true; return; }
  if (scrolling && s.key) { s.pending = true; whenIdle(() => { if (s.pending) schedule(s); }); return; }
  if (bisect.noMapRegen && s.key) return;
  s.pending = false;
  const cs = getComputedStyle(el);
  const num = (name: string, fallback: number) => { const v = parseFloat(cs.getPropertyValue(name)); return Number.isFinite(v) ? v : fallback; };
  const w = el.offsetWidth, h = el.offsetHeight;
  s.size = Math.min(w, h);
  s.area = w * h;
  s.elastic = elasticFor(s, num);
  syncMotion(s);
  const can = supportsRefraction() && !mobileTooBig(el);
  if (can !== s.canRefract) { s.canRefract = can; if (isMobileGlass()) el.dataset.ulMobile = ''; else delete el.dataset.ulMobile; applyTier(s, true); }
  const needMaps = s.mode === 'refract' || !!s.opts.debug;
  if (!needMaps || !w || !h) { if (s.mode === 'lite') readAccent(s, cs); applyDebug(s); return; }
  const rad = (v: string) => (v.endsWith('%') ? (parseFloat(v) / 100) * Math.min(w, h) : parseFloat(v) || 0);
  const radii: [number, number, number, number] = [rad(cs.borderTopLeftRadius), rad(cs.borderTopRightRadius), rad(cs.borderBottomRightRadius), rad(cs.borderBottomLeftRadius)];
  const r = radii[0] === radii[1] && radii[1] === radii[2] && radii[2] === radii[3] ? radii[0] : radii;
  const lens = s.opts.mode ?? 'standard';
  // Bezel ≤ --ul-glass-bezel-max-ratio × shorter side, so the lens reaches into small controls instead of washing over them.
  const bezel = Math.round(Math.min(num('--ul-glass-bezel', 32), perf.bezelMax * Math.min(w, h)) * 2) / 2;
  const magnify = num('--ul-glass-magnify', 1);
  s.aberration = num('--ul-glass-aberration', 2);
  s.base = num('--ul-glass-refraction', 70) * Number(s.opts.refraction ?? 1) * PROFILE[lens].gain;
  const small = w * h < perf.smallArea;
  // Small controls: guarantee a visible edge shift (offset at the rim ≈ scale / 2 px).
  if (small && s.base > 0) s.base = Math.max(s.base, perf.smallShift * 2);
  // Quantize to size buckets (rounded UP so the map always covers the element) so similar surfaces share maps and filters. Small surfaces use exact sizes.
  const B = small ? perf.bucketSmall : perf.bucket, W = Math.ceil(w / B) * B, H = Math.ceil(h / B) * B;
  const rk = Array.isArray(r) ? r.map((x) => x.toFixed(1)).join('/') : r.toFixed(1);
  const arrow = arrowOf(s, cs, w, h);
  const ak = arrow ? `a${arrow.edge}${arrow.pos}` : '';
  const key = `${W}x${H}r${rk}b${bezel}m${magnify}s${s.base}${lens}${ak}`;
  if (key !== s.key) { s.key = key; s.maps = getMaps(key, () => generateDisplacementMap(W, H, r, bezel, { mode: lens, magnify, scale: s.base, arrow: arrow ?? undefined })); }
  readAccent(s, cs);
  bindFilter(s);
  applyDebug(s);
}

/**
 * Arrow outline for the map: only overlays (priority overlay) in the full (refract) tier whose surface has a visible
 * .ul-pop-arrow and a data-side. Position bucketed to --ul-perf-bucket px so the map is shared and never regenerated
 * per frame; measure() already refuses to regenerate while a morph / animation runs (the arrow is hidden then anyway).
 */
function arrowOf(s: GlassState, cs: CSSStyleDeclaration, w: number, h: number): MapArrow | null {
  if ((s.opts.priority ?? 'normal') !== 'overlay' || s.mode !== 'refract') return null;
  const side = s.el.dataset.side, a = s.el.querySelector<HTMLElement>(':scope > .ul-pop-arrow');
  if (!a || !side) return null;
  const EDGE = { bottom: 'top', top: 'bottom', right: 'left', left: 'right' } as const;
  const edge = EDGE[side as keyof typeof EDGE]; // was [side as 'top'], which typed edge as 'bottom' only (runtime unchanged)
  if (!edge) return null;
  const size = parseFloat(cs.getPropertyValue('--ul-popover-arrow')) || 10, len = edge === 'top' || edge === 'bottom' ? w : h;
  const raw = cs.getPropertyValue('--ul-arrow-pos').trim(), p = raw.endsWith('%') ? (parseFloat(raw) / 100) * len : parseFloat(raw) || len / 2;
  const B = perf.bucket || 4;
  return { edge, pos: Math.round(p / B) * B, half: size * Math.SQRT1_2, depth: size * Math.SQRT1_2 };
}

/** Accent strength x (0 at subtle, 1 at vivid), as CSS computes --ul-ax. */
function accentX(el: HTMLElement, cs: CSSStyleDeclaration): number {
  if (el.closest('[data-ul-accent-legacy]')) return 0;
  const k = parseFloat(cs.getPropertyValue('--ul-accent-k'));
  const sub = parseFloat(cs.getPropertyValue('--ul-accent-strength-subtle'));
  if (!Number.isFinite(k) || !Number.isFinite(sub) || sub >= 1) return 0;
  return clamp((k - sub) / (1 - sub), 0, 1);
}

/**
 * Hue rotation for the lite tier's CSS colorize (grayscale → sepia → hue-rotate → saturate). CSS hue-rotate is a
 * luminance-preserving matrix, not a true hue shift, so the angle is solved numerically through the same filter
 * matrices (Filter Effects spec) until the result lands on the accent hue. Reds otherwise drift to orange.
 */
let hueCtx: CanvasRenderingContext2D | null = null;
const hueCache = new Map<string, number>();
const hueOf = (r: number, g: number, b: number) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 1e-6) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) % 360 + 360) % 360;
};
const mul = (m: number[], v: number[]) => [0, 1, 2].map((i) => clamp(m[i * 3] * v[0] + m[i * 3 + 1] * v[1] + m[i * 3 + 2] * v[2], 0, 1));
const SEPIA = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];
function hueRotM(deg: number) {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
}
const satM = (s: number) => [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s];
function accentHue(color: string): number {
  let h = hueCache.get(color);
  if (h != null) return h;
  hueCtx ||= document.createElement('canvas').getContext('2d');
  if (!hueCtx) return 0;
  hueCtx.fillStyle = '#000'; hueCtx.fillStyle = color;
  const v = String(hueCtx.fillStyle);
  let r = 0, g = 0, b = 0;
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
  else { const m = v.match(/[\d.]+/g); if (m) { r = +m[0]; g = +m[1]; b = +m[2]; } }
  const target = hueOf(r, g, b);
  const sep = mul(SEPIA, [0.5, 0.5, 0.5]), sat = satM(1 + 0.75 * 2.2); // calibrated at vivid strength, mid gray
  let best = 0, err = 1e9;
  for (let deg = 0; deg < 360; deg += 1) {
    const o = mul(sat, mul(hueRotM(deg), sep));
    const d = Math.abs(((hueOf(o[0], o[1], o[2]) - target + 540) % 360) - 180);
    if (d < err) { err = d; best = deg; }
  }
  hueCache.set(color, best);
  return best;
}
function syncLiteHue(s: GlassState) {
  const v = `${accentHue(s.color).toFixed(1)}deg`;
  if (s.el.style.getPropertyValue('--ul-lite-hue') !== v) s.el.style.setProperty('--ul-lite-hue', v);
  if (s.el.style.getPropertyValue('--ul-lite-ready') !== '1') s.el.style.setProperty('--ul-lite-ready', '1');
}

function readAccent(s: GlassState, cs: CSSStyleDeclaration) {
  s.color = cs.getPropertyValue('--ul-accent').trim() || '#8fb8ff';
  if (s.mode !== 'fallback' && !s.nested) syncLiteHue(s);
  const x = accentX(s.el, cs);
  const lo = parseFloat(cs.getPropertyValue('--ul-accent-backdrop-subtle')) || 0;
  const hi = parseFloat(cs.getPropertyValue('--ul-accent-backdrop-vivid')) || 0;
  s.a = clamp(lo + x * (hi - lo), 0, 1);
}

/** Push the current accent + strength into the backdrop colorize step (refracted surfaces only). */
function syncAccent(s: GlassState) {
  if (s.mode !== 'refract' || !s.el.isConnected) return;
  const c = s.color, a = s.a;
  readAccent(s, getComputedStyle(s.el));
  if (c !== s.color || a !== s.a) bindFilter(s);
}

/* Accent transitions run in CSS; the SVG filter can't read CSS vars, so follow them for their duration (private filters meanwhile). */
let accentUntil = 0, accentRaf = 0, accentBound = false;
function accentLoop() {
  accentRaf = 0;
  const running = now() < accentUntil;
  states.forEach((s) => {
    if (s.mode === 'lite' && s.visible) { readAccent(s, getComputedStyle(s.el)); return; }
    if (s.mode !== 'refract') return;
    if (running) s.liveAccent = true;
    syncAccent(s);
    if (!running && s.liveAccent) { s.liveAccent = false; bindFilter(s); }
  });
  if (running) accentRaf = requestAnimationFrame(accentLoop);
}
function kickAccent(ms = 0) {
  if (bisect.noAccentObserver) return;
  accentUntil = Math.max(accentUntil, now() + ms);
  if (!accentRaf) accentRaf = requestAnimationFrame(accentLoop);
}
function bindAccent() {
  if (accentBound || typeof document === 'undefined') return;
  accentBound = true;
  const onRun = (e: Event) => {
    const p = (e as TransitionEvent).propertyName;
    if (p !== '--ul-accent' && p !== '--ul-accent-k') return;
    const d = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ul-accent-duration')) || 600;
    kickAccent(d + 120);
  };
  document.addEventListener('transitionrun', onRun, true);
  document.addEventListener('transitionend', (e) => { const p = (e as TransitionEvent).propertyName; if (p === '--ul-accent' || p === '--ul-accent-k') kickAccent(); }, true);
  new MutationObserver(() => kickAccent(80)).observe(document.documentElement, {
    subtree: true, attributes: true,
    attributeFilter: ['data-ul-accent', 'data-ul-accent-strength', 'data-ul-accent-legacy', 'data-ul-theme'],
  });
}

const TIER_FALLBACK = { sm: 1, md: 0.4, lg: 0, xl: 0 } as const;
/** Effective elasticity = size-tier factor × global --ul-elasticity. 0 unless interactive; 0 under reduced motion and on touch-only devices. */
function elasticFor(s: GlassState, num: (name: string, fallback: number) => number): number {
  if (reducedMotion() || coarseOnly() || !s.opts.interactive) return 0; // nested (flat) glass may still be elastic: motion never samples the backdrop
  if (s.opts.legacyElastic) return 0.25;
  const tier = s.size <= 96 ? 'sm' : s.size <= 240 ? 'md' : s.size <= 480 ? 'lg' : 'xl';
  const factor = s.opts.elasticity != null ? Number(s.opts.elasticity) : num(`--ul-elasticity-${tier}`, TIER_FALLBACK[tier]);
  return clamp(factor * num('--ul-elasticity', 0.6), 0, 1);
}

function syncMotion(s: GlassState) {
  const el = s.el;
  const want = !reducedMotion() && (!!s.opts.interactive || !!s.opts.pressable);
  if (want && !motions.has(el)) {
    motions.set(el, { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, st: 0, vst: 0, tst: 0, ang: 0, p: 1, vp: 0, tp: 1, flare: 0, pressed: false });
  } else if (!want && motions.delete(el)) {
    el.style.translate = ''; el.style.transform = ''; el.style.removeProperty('--ul-flare');
  }
}

/* ---------- Quality tiers ---------- */
/** Material "flat" (nearest data-ul-material attribute, stamped by useMaterial or set by hand): the reduced-transparency look, outside the budget. */
export function isFlatMaterial(el: Element): boolean { return el.closest('[data-ul-material]')?.getAttribute('data-ul-material') === 'flat'; }
function resolveMode(s: GlassState): GlassMode {
  if (s.nested || !s.visible) return 'flat'; // glass never samples glass; off-screen surfaces cost nothing
  const q = config.forceQuality ?? s.opts.quality ?? 'auto';
  if (q === 'flat' || isFlatMaterial(s.el)) return 'flat';
  if (!s.canRefract) return 'fallback';
  if (q === 'full') return 'refract';
  if (q === 'lite') return 'lite';
  return s.granted ? 'refract' : 'lite';
}

function setLite(s: GlassState, v: number | null) {
  if (v == null) s.el.style.removeProperty('--ul-lite'); else s.el.style.setProperty('--ul-lite', v.toFixed(3));
}

function setMode(s: GlassState, m: GlassMode) {
  s.mode = m;
  s.el.dataset.ulMode = m;
  s.el.toggleAttribute('data-ul-top', m === 'flat' && !s.nested);
  s.el.toggleAttribute('data-ul-flat', isFlatMaterial(s.el));
}

function cancelQ(s: GlassState) { if (s.qAnim) { cancelAnimationFrame(s.qAnim); s.qAnim = 0; } s.liveRamp = false; }

/** Crossfade lens + backdrop colorize (q) against the lite body compensation (--ul-lite = 1 − q). */
function crossfade(s: GlassState, to: 0 | 1, done?: () => void) {
  cancelQ(s);
  const from = s.q, t0 = now(), ms = perf.crossfade * Math.abs(to - from);
  if (ms < 16) { s.q = to; setLite(s, 1 - to); bindFilter(s); done?.(); return; }
  s.liveRamp = true;
  poke();
  let start = t0, prev = t0;
  const step = (t: number) => {
    // a crossfade that was already running holds still while the page scrolls (no filter writes), then resumes
    if (scrolling) { start += t - prev; prev = t; s.qAnim = requestAnimationFrame(step); return; }
    prev = t;
    const p = clamp((t - start) / ms, 0, 1), e = p * p * (3 - 2 * p);
    s.q = from + (to - from) * e;
    setLite(s, 1 - s.q);
    bindFilter(s);
    if (p < 1) { s.qAnim = requestAnimationFrame(step); return; }
    s.qAnim = 0; s.liveRamp = false;
    done?.();
    bindFilter(s);
    if (s.pending) schedule(s);
  };
  s.qAnim = requestAnimationFrame(step);
}

function applyTier(s: GlassState, instant = false) {
  if (scrolling) { whenIdle(() => applyTier(s, instant)); return; }
  // Tier is frozen while an anchored morph runs: a governor re-rank must not swap the surface mid-animation.
  if (s.el.hasAttribute('data-ul-morphing') && s.target) { s.tierHeld = resolveMode(s) !== s.target; return; }
  const next = resolveMode(s);
  if (next === s.target) return;
  s.target = next;
  const fade = !instant && !reducedMotion() && now() - s.born > 400;
  if (next === 'refract') {
    const from = s.mode;
    setMode(s, 'refract');
    if (!s.maps) { cancelAnimationFrame(s.raf); measure(s); } else readAccent(s, getComputedStyle(s.el));
    if (fade && (from === 'lite' || from === 'refract')) crossfade(s, 1);
    else { cancelQ(s); s.q = 1; setLite(s, 0); bindFilter(s); }
  } else if (next === 'lite' && s.mode === 'refract' && fade) {
    crossfade(s, 0, () => { if (s.target === 'lite') { setMode(s, 'lite'); unbindFilter(s); setLite(s, 1); } });
  } else {
    cancelQ(s);
    setMode(s, next);
    unbindFilter(s); // next is never 'refract' here (handled above); was `if (next !== 'refract')` + `next === 'refract' ? 1 : 0`
    s.q = 0;
    setLite(s, next === 'lite' || (next === 'flat' && !s.nested) ? 1 : null);
  }
}

/* ---------- Governor: refraction budget + frame-time monitor ---------- */
let liveBudget = 0, degraded = false, govRaf = 0, govTimer = 0, lightWrites = 0, usedArea = 0, usedCount = 0;
const effectiveBudget = () => (config.budget === 'auto' ? liveBudget : config.budget);
function requestGovern() { if (bisect.noGovern) return; if (scrolling) { whenIdle(requestGovern); return; } if (!govRaf && typeof window !== 'undefined') govRaf = requestAnimationFrame(govern); }

function govern() {
  govRaf = 0;
  if (!perfRead) readPerf();
  const t = now(), vw = innerWidth, vh = innerHeight;
  const cand: { s: GlassState; pr: number; d: number; a: number }[] = [];
  let soonest = Infinity;
  states.forEach((s) => {
    if ((s.opts.quality ?? 'auto') !== 'auto' || s.nested || !s.visible || !s.canRefract || isFlatMaterial(s.el)) { s.granted = false; return; } // flat material never counts toward the budget
    const hot = s.hot > 0 || s.hotUntil > t;
    if (!s.hot && s.hotUntil > t) soonest = Math.min(soonest, s.hotUntil - t);
    const pri = s.opts.priority ?? 'normal';
    // overlay > hovered/focused > island > small controls (by distance to center) > everything else (by distance).
    // Hover promotion is skipped for big containers (> --ul-perf-promote-max-area).
    const pr = pri === 'overlay' ? 5 : hot && s.area <= perf.promoteArea ? 4 : pri === 'island' ? 3 : s.area < perf.smallArea ? 2 : 1;
    const r = s.el.getBoundingClientRect();
    if (pr < 3 && (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw)) { s.granted = false; return; } // in the margin, not on screen
    const shown = !(s.k === 0 || s.el.style.visibility === 'hidden' || s.el.hasAttribute('inert'));
    const a = shown ? Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) : 0;
    cand.push({ s, pr, a, d: Math.hypot(r.left + r.width / 2 - vw / 2, r.top + r.height / 2 - vh / 2) });
  });
  cand.sort((a, b) => b.pr - a.pr || a.d - b.d);
  // Budget = refracted PIXEL AREA in the viewport + a count cap. Overlays and hovered/focused surfaces are always full
  // (they count toward the cap, not the area); the rest is granted in priority order while it fits, so big surfaces drop first.
  const unlimited = config.budget === Infinity;
  let areaLeft = effectiveBudget(), countLeft = unlimited ? Infinity : perf.maxCount;
  usedArea = 0; usedCount = 0;
  for (const c of cand) {
    const forced = c.pr >= 4;
    const ok = forced || (countLeft > 0 && c.a <= areaLeft);
    c.s.granted = ok;
    if (!ok) continue;
    countLeft--; usedCount++; usedArea += c.a;
    if (!forced) areaLeft -= c.a;
  }
  states.forEach((s) => applyTier(s));
  clearTimeout(govTimer);
  if (soonest < Infinity) govTimer = window.setTimeout(requestGovern, soonest + 16);
}

let monRaf = 0, monLast = 0, monUntil = 0, overSince = 0, underSince = 0;
const ft: number[] = [];
const p95 = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };
/** Keep the frame-time monitor running for a while (called on pointer, scroll and animations; idle pages run no rAF). */
function poke() {
  if (typeof window === 'undefined' || config.budget !== 'auto') return;
  monUntil = now() + 1500;
  if (!monRaf) monRaf = requestAnimationFrame(monitor);
}
function monitor(t: number) {
  monRaf = 0;
  const dt = t - monLast;
  // > 100 ms is a pause or a throttled/background frame, not jank: ignore it.
  if (monLast && dt < 100 && document.visibilityState === 'visible') { ft.push(dt); if (ft.length > 60) ft.shift(); }
  monLast = t;
  if (ft.length >= 30) {
    const p = p95(ft);
    if (p > perf.frameMs) {
      underSince = 0; overSince ||= t;
      if (t - overSince > 1000) { degrade(); overSince = t; ft.length = 0; }
    } else if (p < perf.frameMs * 0.8) {
      overSince = 0; underSince ||= t;
      if (t - underSince > 3000) { recover(); underSince = t; }
    } else overSince = underSince = 0;
  }
  if (now() < monUntil) monRaf = requestAnimationFrame(monitor);
  else { monLast = 0; ft.length = 0; overSince = underSince = 0; }
}
function rebindAll() { states.forEach((s) => bindFilter(s)); }
function degrade() {
  if (!degraded) { degraded = true; whenIdle(rebindAll); } // aberration 3 passes → 1 (filter graphs change: never mid-scroll)
  liveBudget = Math.max(perf.area * 0.25, liveBudget * 0.75); // area budget steps down 25 % per second of overload
  requestGovern();
}
function recover() {
  liveBudget = Math.min(perf.area, liveBudget * 1.25);
  if (liveBudget >= perf.area && degraded) { degraded = false; whenIdle(rebindAll); }
  requestGovern();
}

/* ---------- Visibility: one shared IntersectionObserver ---------- */
let io: IntersectionObserver | null = null;
const extVisible = new WeakMap<HTMLElement, boolean>();
function getIO(): IntersectionObserver | null {
  if (io || typeof IntersectionObserver === 'undefined') return io;
  if (!perfRead) readPerf();
  io = new IntersectionObserver((entries) => {
    if (bisect.noIO) return;
    for (const e of entries) {
      const el = e.target as HTMLElement, s = states.get(el);
      if (!s) { extVisible.set(el, e.isIntersecting); continue; }
      s.visWant = e.isIntersecting;
      whenIdle(() => applyVisibility(s));
    }
    requestGovern();
  }, { rootMargin: `${Math.max(perf.margin, typeof innerHeight === 'number' ? innerHeight : 800)}px ${perf.margin}px` }); // ≈ one viewport above / below: near surfaces keep their tier
  return io;
}
function applyVisibility(s: GlassState) {
  const v = s.visWant ?? s.visible;
  if (s.visible === v || !states.has(s.el)) return;
  s.visible = v;
  if (s.visible) { observeSize(s); bindPress(s); schedule(s); applyTier(s, true); }
  else { s.ro?.disconnect(); s.ro = undefined; unbindPress(s); applyTier(s, true); }
}

function observeSize(s: GlassState) {
  if (s.ro) return;
  s.ro = new ResizeObserver(() => {
    if (!s.key) { schedule(s); return; }
    clearTimeout(s.roTimer); // debounce regeneration on resize: rAF + ~100ms
    s.roTimer = window.setTimeout(() => schedule(s), 100);
  });
  s.ro.observe(s.el);
}

/**
 * Decide the tier BEFORE an open morph starts (AnchoredMorph.enter, before data-ul-morphing); it then stays constant for
 * the whole animation. Refract only if its map is decoded right now; otherwise the surface opens on the calm lite state and
 * upgrades after the morph settles (releaseGlassTier → the normal crossfade). Never builds a map here (no first-frame cost).
 */
export function decideGlassTier(el: HTMLElement): void {
  const s = states.get(el);
  if (!s) return;
  if (!s.visible) { s.visible = true; observeSize(s); bindPress(s); }
  if (resolveMode(s) === 'refract' && !(s.maps && s.maps.ready)) {
    cancelQ(s); s.target = 'lite'; setMode(s, 'lite'); unbindFilter(s); s.q = 0; setLite(s, 1); s.tierHeld = true;
    return;
  }
  applyTier(s, true);
}

/** Apply a tier change that was held back during a morph (called by AnchoredMorph when it ends). */
export function releaseGlassTier(el: HTMLElement): void {
  const s = states.get(el);
  if (!s) return;
  if (s.fadeHeld) {
    s.fadeHeld = false;
    if (s.mode === 'refract' && s.maps?.ready && s.q < 1) { if (reducedMotion()) { s.q = 1; setLite(s, 0); bindFilter(s); } else crossfade(s, 1); }
  }
  if (s.tierHeld) { s.tierHeld = false; applyTier(s); }
  requestGovern();
}

/**
 * Make a just-shown surface (display:none → block) count as visible NOW instead of waiting for the IntersectionObserver,
 * measure it at its current size and resolve its tier in the same frame (lens bubble). on = false hides it again.
 */
export function wakeGlass(el: HTMLElement, on = true): void {
  const s = states.get(el);
  if (!s) return;
  if (on) {
    if (!s.visible) { s.visible = true; observeSize(s); bindPress(s); }
    cancelAnimationFrame(s.raf);
    if (!el.hasAttribute('data-ul-morphing')) measure(s);
    applyTier(s, true);
  } else if (s.visible) {
    s.visible = false; s.ro?.disconnect(); s.ro = undefined; unbindPress(s); applyTier(s, true);
  }
  requestGovern();
}

/** Treat a surface as pressed/active for the governor (same as hover/focus: promoted, 3-pass aberration on small surfaces if allowed). */
export function setGlassHot(el: HTMLElement, on: boolean): void { setHot(states.get(el) ?? null, 8, on); }

/** Sets the materialize factor (0..1) that multiplies the displacement scale. Used by motion helpers. */
export function setGlassMaterialize(el: HTMLElement, k: number): void {
  const s = states.get(el);
  if (s) { s.k = k; applyScale(s); if (k > 0 && k < 1) poke(); }
}

/** Rescale the existing map/filter region to the element's animated size (no regeneration). No args = restore. */
export function setGlassGeometry(el: HTMLElement, w?: number, h?: number): void {
  const s = states.get(el);
  if (!s) return;
  s.geo = w != null && h != null ? { w, h } : undefined;
  if (s.geo) poke();
  bindFilter(s);
  if (!s.geo && s.pending) schedule(s);
}

/** Generate the map synchronously (before a morph starts, while geometry is final). */
export function measureGlassNow(el: HTMLElement): void {
  const s = states.get(el);
  if (!s) return;
  cancelAnimationFrame(s.raf);
  const wasPending = s.pending;
  if (s.animating || el.hasAttribute('data-ul-morphing')) { s.pending = true; return; }
  measure(s);
  if (wasPending && !s.pending) bindFilter(s);
}

/** Crossfade from the blur fallback into refraction: ramps the lens 0 → 1 (no opacity change). */
export function rampGlass(el: HTMLElement, ms = 420): void {
  const s = states.get(el);
  if (!s || s.mode !== 'refract' || reducedMotion()) return;
  cancelAnimationFrame(s.anim);
  const t0 = now();
  s.k = 0; s.animating = true; applyScale(s); poke();
  const step = (t: number) => {
    const p = clamp((t - t0) / ms, 0, 1);
    s.k = p * p * (3 - 2 * p);
    if (p >= 1) s.animating = false;
    applyScale(s);
    if (p < 1) s.anim = requestAnimationFrame(step); else if (s.pending) schedule(s);
  };
  s.anim = requestAnimationFrame(step);
}

/** Re-read tokens on every surface (e.g. after changing --ul-elasticity at runtime). */
export function refreshGlass(): void { readPerf(); states.forEach((s) => { s.key = ''; schedule(s); }); requestGovern(); }

function schedule(s: GlassState) {
  if (s.raf) return;
  s.raf = requestAnimationFrame(() => measure(s));
}

function init(s: GlassState) {
  const el = s.el;
  if (!perfRead) readPerf();
  // Hard rule: glass never samples glass. Any glass inside glass is flattened.
  s.nested = !!el.parentElement?.closest('.ul-glass');
  s.canRefract = supportsRefraction() && !mobileTooBig(el);
  s.target = '';
  const pri = s.opts.priority ?? 'normal';
  s.granted = (s.opts.quality ?? 'auto') === 'auto' && (pri === 'overlay' || pri === 'island'); // provisional until the governor runs
  if (isMobileGlass()) el.dataset.ulMobile = ''; else delete el.dataset.ulMobile;
  setMode(s, 'lite');
  applyTier(s, true);
  observeSize(s);
  schedule(s);
  bindPress(s);
  getIO()?.observe(el);
  if (s.opts.light !== false && !isFlatMaterial(el)) trackPointer(el); else untrackPointer(el);
  bindHover();
  requestGovern();
}

function teardown(s: GlassState) {
  const el = s.el;
  cancelAnimationFrame(s.raf); s.raf = 0;
  cancelQ(s);
  clearTimeout(s.roTimer);
  s.ro?.disconnect(); s.ro = undefined;
  io?.unobserve(el);
  unbindFilter(s);
  s.key = ''; s.maps = undefined; s.target = '';
  unbindPress(s);
  if (motions.delete(el)) { el.style.translate = ''; el.style.transform = ''; el.style.removeProperty('--ul-flare'); }
  setLite(s, null);
  el.style.removeProperty('--ul-lite-hue');
  el.style.removeProperty('--ul-lite-ready');
  delete el.dataset.ulMode;
  el.removeAttribute('data-ul-top');
  applyDebug(s);
}

function bindPress(s: GlassState) {
  const want = !!s.opts.pressable && s.visible;
  if (want === s.pressBound) return;
  if (want) s.el.addEventListener('pointerdown', onPress); else s.el.removeEventListener('pointerdown', onPress);
  s.pressBound = want;
}
function unbindPress(s: GlassState) { if (s.pressBound) { s.el.removeEventListener('pointerdown', onPress); s.pressBound = false; } }

let mediaBound = false;
function bindMedia() {
  if (mediaBound || typeof matchMedia !== 'function') return;
  mediaBound = true;
  const rebuild = () => states.forEach((s) => { teardown(s); init(s); });
  matchMedia('(prefers-reduced-transparency: reduce)').addEventListener('change', rebuild);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', rebuild);
}

const autoPriority = (el: HTMLElement): GlassPriority =>
  el.getAttribute('role') === 'dialog' || el.hasAttribute('data-ul-anchored') ? 'overlay' : 'normal';

/** Attach (or update) the glass material on an element that has class `ul-glass`. */
export function attachGlass(el: HTMLElement, opts: GlassOptions = {}): void {
  if (typeof document === 'undefined') return;
  bindMedia();
  bindAccent();
  const existing = states.get(el);
  if (existing) {
    const prevQ = existing.opts.quality, prevP = existing.opts.priority;
    existing.opts = { ...existing.opts, ...opts, priority: opts.priority ?? existing.opts.priority };
    if (existing.opts.light !== false && !isFlatMaterial(el)) trackPointer(el); else untrackPointer(el);
    bindPress(existing);
    existing.key = '';
    if (prevQ !== existing.opts.quality || prevP !== existing.opts.priority) { applyTier(existing); requestGovern(); }
    schedule(existing);
    return;
  }
  const s: GlassState = {
    el, opts: { ...opts, priority: opts.priority ?? autoPriority(el) }, mode: 'lite', target: '', nested: false, visible: true, canRefract: false, granted: false, born: now(),
    base: 0, aberration: 0, elastic: 0, size: 0, area: el.offsetWidth * el.offsetHeight, k: 1, q: 0, key: '', raf: 0, anim: 0, qAnim: 0,
    animating: false, liveRamp: false, liveAccent: false, pending: false, roTimer: 0, pressBound: false, hot: 0, hotUntil: 0, color: '#8fb8ff', a: 0, url: '',
  };
  states.set(el, s);
  init(s);
  warnHazards(el);
}
/** Dev guard: content-visibility:auto ancestors let Chromium skip / re-raster the subtree at the viewport edge while
 *  scrolling, which drops backdrop-filter results for a frame. Glass must never sit inside one. */
let hazardWarned = false;
function warnHazards(el: HTMLElement) {
  if (hazardWarned) return;
  requestAnimationFrame(() => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (getComputedStyle(p).getPropertyValue('content-visibility') === 'auto') { hazardWarned = true; console.warn('[ul-glass] glass inside content-visibility:auto (scroll flash risk):', p); return; }
    }
  });
}

export function detachGlass(el: HTMLElement): void {
  const s = states.get(el);
  if (!s) return;
  cancelAnimationFrame(s.anim);
  teardown(s);
  untrackPointer(el);
  states.delete(el);
  if (hoverNear === s) hoverNear = null;
  if (hoverTop === s) hoverTop = null;
  requestGovern();
}

/** Global knobs (showcase / debugging). `forceFallback` rebuilds every surface. `budget`: 'auto' | number | Infinity. */
export function configureGlass(next: Partial<GlassConfig> & { bisect?: GlassBisect }): GlassConfig {
  let rebuild = false;
  if (next.bisect) {
    const was = `${!!bisect.threePass}${!!bisect.compositeRecombine}${bisect.capRegion ?? 0}`;
    for (const k of Object.keys(bisect) as (keyof GlassBisect)[]) delete bisect[k];
    Object.assign(bisect, next.bisect); next = { ...next }; delete (next as { bisect?: unknown }).bisect;
    rebuild = was !== `${!!bisect.threePass}${!!bisect.compositeRecombine}${bisect.capRegion ?? 0}`;
    document.documentElement.toggleAttribute('data-ul-three-pass', !!bisect.threePass);
  }
  if (rebuild) { // filter graphs changed: drop every definition, then rebind (debug only)
    states.forEach(unbindFilter);
    pool.forEach((r) => r.el.remove()); pool.clear(); unused.clear();
    privFree.splice(0).forEach((r) => r.el.remove()); privCount = 0;
  }
  const prevQuality = config.forceQuality;
  const prevFallback = config.forceFallback, prevMobile = config.forceMobile, prevBudget = config.budget;
  Object.assign(config, next);
  if (prevFallback !== config.forceFallback || prevMobile !== config.forceMobile) states.forEach((s) => { teardown(s); init(s); });
  else states.forEach(applyScale);
  if (prevQuality !== config.forceQuality) states.forEach((s) => applyTier(s, true));
  if (prevBudget !== config.budget) { if (config.budget === 'auto') { liveBudget = perf.area; degraded = false; states.forEach(bindFilter); } requestGovern(); }
  return { ...config };
}

export function getGlassMode(el: HTMLElement): GlassMode | undefined { return states.get(el)?.mode; }
export function getGlassMaps(el: HTMLElement): DisplacementMaps | undefined { return states.get(el)?.maps; }

/** Counters for the perf HUD and tests. */
export function getGlassStats(): GlassStats {
  const out: GlassStats = { instances: states.size, visible: 0, refract: 0, lite: 0, fallback: 0, flat: 0, budget: effectiveBudget(), maxBudget: config.budget === 'auto' ? perf.area : config.budget, maxCount: perf.maxCount, areaUsed: Math.round(usedArea), refractCount: usedCount, degraded, filters: pool.size + privCount, maps: mapCache.size, lightWrites };
  states.forEach((s) => { if (s.visible) out.visible++; out[s.mode]++; });
  return out;
}

/**
 * Materialize instead of fade: the refraction scale grows from 0 with opacity
 * so the lens forms; hiding collapses the lens first, then fades.
 */
export function materialize(el: HTMLElement, visible: boolean, opts: { immediate?: boolean; duration?: number } = {}): Promise<void> {
  const s = states.get(el);
  const to = visible ? 1 : 0;
  const finish = () => {
    if (s) { s.k = to; s.animating = false; applyScale(s); if (s.pending) schedule(s); }
    el.style.opacity = visible ? '' : '0';
    el.style.scale = '';
    el.toggleAttribute('inert', !visible);
  };
  if (s) cancelAnimationFrame(s.anim);
  if (opts.immediate || reducedMotion()) { finish(); return Promise.resolve(); }
  const from = s ? s.k : 1 - to;
  const dur = opts.duration ?? (parseFloat(getComputedStyle(el).getPropertyValue('--ul-duration-slow')) || 520);
  const ease = springs.smooth;
  const c01 = (v: number) => clamp(v, 0, 1);
  el.removeAttribute('inert');
  if (s) s.animating = true;
  poke();
  return new Promise((resolve) => {
    const t0 = now();
    const step = (t: number) => {
      const p = c01((t - t0) / dur);
      const e = ease(p);
      if (s) { s.k = from + (to - from) * e; applyScale(s); }
      el.style.opacity = String(visible ? c01(p * 2.2) : 1 - c01((p - 0.25) / 0.75));
      el.style.scale = String(0.97 + 0.03 * (visible ? e : 1 - e));
      if (p < 1) { const id = requestAnimationFrame(step); if (s) s.anim = id; }
      else { finish(); resolve(); }
    };
    const id = requestAnimationFrame(step);
    if (s) s.anim = id;
  });
}

/* ---------- Hover / focus promotion ---------- */
let hoverNear: GlassState | null = null, hoverTop: GlassState | null = null, hoverBound = false;
function chain(t: EventTarget | null): [GlassState | null, GlassState | null] {
  let near: GlassState | null = null, top: GlassState | null = null;
  for (let n = t instanceof Element ? t : null; n; n = n.parentElement) {
    const s = states.get(n as HTMLElement);
    if (!s) continue;
    near ||= s;
    if (!s.nested) { top = s; break; }
  }
  return [near, top];
}
function setHot(s: GlassState | null, bit: number, on: boolean) {
  if (!s || bisect.noHover) return;
  if (scrolling && bit === 1) { whenIdle(() => setHot(s, bit, on)); return; }
  const was = s.hot;
  s.hot = on ? s.hot | bit : s.hot & ~bit;
  if (!s.hot && was) s.hotUntil = now() + perf.demote; // demote after a short delay (crossfade, no pop)
  if (!!s.hot !== !!was) requestGovern();
}
function updateHover(t: EventTarget | null) {
  const [near, top] = chain(t);
  if (near !== hoverNear) { setHot(hoverNear, 1, false); hoverNear = near; setHot(near, 1, true); }
  if (top !== hoverTop) { if (hoverTop !== hoverNear) setHot(hoverTop, 1, false); hoverTop = top; setHot(top, 1, true); }
}
let focusNear: GlassState | null = null, focusTop: GlassState | null = null;
function bindHover() {
  if (hoverBound || typeof window === 'undefined') return;
  hoverBound = true;
  if (!coarseOnly()) {
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  document.addEventListener('focusin', (e) => {
    const [near, top] = chain(e.target);
    setHot(focusNear, 2, false); setHot(focusTop, 2, false);
    focusNear = near; focusTop = top;
    setHot(near, 2, true); setHot(top, 2, true);
  });
  document.addEventListener('focusout', () => { setHot(focusNear, 2, false); setHot(focusTop, 2, false); focusNear = focusTop = null; });
}

/* ---------- Pointer loop: light, rim angle, elasticity, press ---------- */
const lit = new Set<HTMLElement>();
/** Elements whose light is fading to 0 after they stopped being candidates (no pop). */
const fading = new Map<HTMLElement, number>();
const lightNow = new Map<HTMLElement, number>();
let px = -1e5, py = -1e5, lastX = NaN, lastY = NaN, pvx = 0, pvy = 0, lastTarget: EventTarget | null = null;
let pointerRaf = 0, proximity = 140, proxRead = false;
let simRaf = 0, simLast = 0, scrollTimer = 0;
/* ONE rAF batch per frame for every pointer-driven write (light + springs). Pointer writes go to at most
   --ul-glass-light-max (4) surfaces, the nearest within the light radius; nothing is written while the page scrolls. */
let frameRaf = 0, wantPointer = false, wantSim = false, lightMax = 4;
const lastPos = new Map<HTMLElement, { x: number; y: number; a: number }>();
function frame(t: number) {
  frameRaf = 0;
  if (scrolling) { if (wantPointer || wantSim) whenIdle(schedFrame); return; } // resumes ~150ms after scrolling stops
  if (wantPointer) { wantPointer = false; flushPointer(); }
  if (wantSim) { wantSim = false; sim(t); }
}
function schedFrame() { if (!frameRaf && typeof window !== 'undefined') frameRaf = requestAnimationFrame(frame); }

/**
 * Candidates: full (refracted) visible surfaces keep proximity light; lite / flat / fallback surfaces and
 * tracked non-glass elements light up only while hovered (or during the demote delay). Never :root, never all instances.
 */
function candidates(t: number): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (!config.light) return out;
  const target = lastTarget instanceof Node ? lastTarget : null;
  for (const el of lit) {
    const s = states.get(el);
    if (s) {
      if (!s.visible) continue;
      // large lite / flat panels (data tables, charts) get no moving light: repainting a big backdrop-filtered surface per
      // pointer frame costs more than it shows (measured: 200-row table 121 → 65 fps)
      if (s.mode !== 'refract' && s.area > perf.promoteArea) continue;
      if (s.mode === 'refract' || s.hot || s.hotUntil > t) out.push(el);
    } else if (extVisible.get(el) !== false && target && el.contains(target)) out.push(el);
  }
  return out;
}

function writeLight(el: HTMLElement, v: number) {
  const prev = lightNow.get(el) ?? -1;
  if (Math.abs(prev - v) < 0.002) return;
  lightNow.set(el, v);
  lightWrites++;
  el.style.setProperty('--ul-light', v.toFixed(3));
}

function flushPointer() {
  pointerRaf = 0;
  if (!proxRead) { proxRead = true; proximity = rootNum('--ul-glass-light-proximity', 140); lightMax = Math.max(1, rootNum('--ul-glass-light-max', 4)); }
  const t = now();
  updateHover(lastTarget);
  const all = candidates(t);
  const allRects = all.map((el) => el.getBoundingClientRect()); // all reads first, then writes
  // nearest first; only surfaces within the light radius; at most lightMax minus the ones still fading out
  const distOf = (b: DOMRect, el: HTMLElement) => { const m = motions.get(el), ox = m ? m.x : 0, oy = m ? m.y : 0; return Math.hypot(Math.max(b.left - ox - px, 0, px - (b.right - ox)), Math.max(b.top - oy - py, 0, py - (b.bottom - oy))); };
  const ranked = all.map((el, i) => ({ el, b: allRects[i], d: distOf(allRects[i], el) })).filter((x) => x.d < proximity).sort((a, b) => a.d - b.d);
  const keep = ranked.slice(0, lightMax);
  const list = keep.map((x) => x.el), rects = keep.map((x) => x.b);
  const vh = window.innerHeight;
  const live = new Set<HTMLElement>();
  list.forEach((el, i) => {
    const m = motions.get(el);
    const s = states.get(el);
    const b = rects[i];
    const ox = m ? m.x : 0, oy = m ? m.y : 0; // measure the untranslated rect
    const left = b.left - ox, top = b.top - oy, right = b.right - ox, bottom = b.bottom - oy;
    if (bottom < -proximity || top > vh + proximity) return;
    live.add(el);
    fading.delete(el);
    const dx = Math.max(left - px, 0, px - right);
    const dy = Math.max(top - py, 0, py - bottom);
    const near = Math.hypot(dx, dy);
    const light = near === 0 ? 1 : Math.max(0, 1 - near / proximity);
    writeLight(el, light);
    const cx = px - (left + right) / 2, cy = py - (top + bottom) / 2;
    if (light > 0) {
      const mx = px - b.left, my = py - b.top, ang = (Math.atan2(-cx, cy) * 180) / Math.PI, lp = lastPos.get(el);
      // below the threshold (0.5px / 0.5deg): no write
      if (!lp || Math.abs(lp.x - mx) >= 0.5 || Math.abs(lp.y - my) >= 0.5 || Math.abs(lp.a - ang) >= 0.5) {
        lastPos.set(el, { x: mx, y: my, a: ang });
        el.style.setProperty('--mx', `${mx.toFixed(1)}px`);
        el.style.setProperty('--my', `${my.toFixed(1)}px`);
        el.style.setProperty('--ul-rim-angle', `${ang.toFixed(1)}deg`);
      }
    }
    if (m && s) {
      const E = s.elastic;
      const speed = Math.hypot(pvx, pvy);
      if (s.opts.legacyElastic) {
        if (E > 0 && light > 0) {
          const maxT = 40 * E;
          m.tx = clamp(cx * E * 0.12 * light, -maxT, maxT);
          m.ty = clamp(cy * E * 0.12 * light, -maxT, maxT);
          m.tst = Math.min(0.1, speed * 0.012 * E) * light;
          if (speed > 0.5) m.ang = Math.atan2(pvy, pvx);
        } else { m.tx = m.ty = 0; m.tst = 0; }
      } else {
        const w = right - left, h = bottom - top;
        const zone = 1.5 * Math.min(w, h); // react only within ~1.5× the element's size from its edge
        const f = E > 0 ? (near === 0 ? 1 : Math.max(0, 1 - near / zone)) : 0;
        const maxT = 4 * E; // ≤ 4px at full strength, 2.4px at defaults
        m.tx = f > 0 ? clamp(cx / (w / 2), -1, 1) * maxT * f : 0;
        m.ty = f > 0 ? clamp(cy / (h / 2), -1, 1) * maxT * f : 0;
        // Hover = translate only. Stretch only while pressed or dragged: ≤ 4% × E on the motion axis.
        if (m.pressed && E > 0) {
          m.tst = Math.min(0.04 * E, speed * 0.004 * E);
          if (speed > 0.5) m.ang = Math.atan2(pvy, pvx);
        } else m.tst = 0;
      }
    }
  });
  // Elements that dropped out: release elasticity, fade light out over a few frames.
  for (const [el, v] of lightNow) {
    if (live.has(el) || v <= 0) continue;
    const m = motions.get(el);
    if (m) { m.tx = m.ty = 0; if (!m.pressed) m.tst = 0; }
    fading.set(el, v);
  }
  let again = false, budget = Math.max(0, lightMax - live.size);
  for (const [el, v] of fading) {
    if (budget-- <= 0) { again = true; break; } // over the per-frame budget: continue next frame
    const nv = Math.max(0, v - 0.12);
    writeLight(el, nv);
    if (nv > 0) { fading.set(el, nv); again = true; } else { fading.delete(el); lightNow.delete(el); lastPos.delete(el); }
  }
  kickSim();
  if (again) requestFlush();
}

function spring(x: number, v: number, target: number, k: number, c: number, dt: number): [number, number] {
  v += (-k * (x - target) - c * v) * dt;
  return [x + v * dt, v];
}

function sim(t: number) {
  simRaf = 0;
  const dt = Math.min(0.032, simLast ? (t - simLast) / 1000 : 1 / 60);
  simLast = t;
  const decay = Math.pow(0.82, dt * 60);
  pvx *= decay; pvy *= decay;
  let active = false;
  for (const [el, m] of motions) {
    const moving = m.pressed || m.flare > 0 ||
      Math.abs(m.x - m.tx) > 0.05 || Math.abs(m.y - m.ty) > 0.05 || Math.abs(m.vx) > 0.05 || Math.abs(m.vy) > 0.05 ||
      Math.abs(m.st - m.tst) > 1e-4 || Math.abs(m.vst) > 1e-3 || Math.abs(m.p - m.tp) > 1e-4 || Math.abs(m.vp) > 1e-3;
    if (!moving && !m.x && !m.y && !m.st && m.p === 1) continue; // at rest: skip writes entirely
    const legacy = !!states.get(el)?.opts.legacyElastic;
    m.tst *= decay;
    // Hover/stretch: critically damped (no overshoot). Press release: slight overshoot (ζ ≈ .6).
    const cT = legacy ? 14 : 26, cS = legacy ? 16 : 32, cP = legacy ? 20 : 24;
    [m.x, m.vx] = spring(m.x, m.vx, m.tx, 170, cT, dt);
    [m.y, m.vy] = spring(m.y, m.vy, m.ty, 170, cT, dt);
    [m.st, m.vst] = spring(m.st, m.vst, m.tst, 260, cS, dt);
    [m.p, m.vp] = spring(m.p, m.vp, m.tp, 420, cP, dt);
    if (!m.pressed) m.flare = Math.max(0, m.flare - dt * 2.2);
    if (moving) active = true;
    const rest = !moving && Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05 && m.st < 1e-3 && Math.abs(m.p - 1) < 1e-3;
    if (rest) { m.x = m.y = m.vx = m.vy = m.st = m.vst = m.vp = 0; m.p = 1; el.style.translate = ''; el.style.transform = ''; }
    else {
      el.style.translate = `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
      el.style.transform = `rotate(${m.ang}rad) scale(${(1 + m.st).toFixed(4)}, ${(1 - m.st * 0.5).toFixed(4)}) rotate(${-m.ang}rad) scale(${m.p.toFixed(4)})`;
    }
    const fl = m.flare.toFixed(3); // write only on change: idle surfaces in the spring loop must not get a style write every frame
    if ((m as { lastFlare?: string }).lastFlare !== fl) { (m as { lastFlare?: string }).lastFlare = fl; el.style.setProperty('--ul-flare', fl); }
  }
  if (active) { wantSim = true; schedFrame(); } else simLast = 0;
}
const kickSim = () => { if (motions.size) { wantSim = true; schedFrame(); } };

function onPress(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--fx', `${(e.clientX - r.left).toFixed(1)}px`);
  el.style.setProperty('--fy', `${(e.clientY - r.top).toFixed(1)}px`);
  const m = motions.get(el);
  if (m) { m.pressed = true; m.tp = Number(states.get(el)?.opts.pressScale ?? 0.965); m.flare = 1; kickSim(); }
  else el.style.setProperty('--ul-flare', '0.6');
  const up = () => {
    if (m) { m.pressed = false; m.tp = 1; kickSim(); } else el.style.setProperty('--ul-flare', '0');
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

const requestFlush = () => { wantPointer = true; schedFrame(); };
const onMove = (e: PointerEvent) => {
  if (e.pointerType === 'touch') return;
  if (Number.isFinite(lastX)) { pvx = pvx * 0.5 + (e.clientX - lastX) * 0.5; pvy = pvy * 0.5 + (e.clientY - lastY) * 0.5; }
  lastX = px = e.clientX; lastY = py = e.clientY;
  lastTarget = e.target;
  requestFlush();
  poke();
};
const onLeave = () => { px = py = -1e5; lastX = lastY = NaN; lastTarget = null; requestFlush(); };
/** Scroll: re-light under the pointer; re-rank the budget only once scrolling settles (no churn mid-scroll). */
const onScroll = () => {
  // passive, no style writes, no layout reads: only mark the scroll; light + hover + budget update once idle
  markScrolling();
  poke();
  whenIdle(requestFlush);
  void scrollTimer;
};

export function trackPointer(el: HTMLElement): void {
  lit.add(el);
  if (!states.has(el)) getIO()?.observe(el);
  bindHover();
}

export function untrackPointer(el: HTMLElement): void {
  lit.delete(el);
  fading.delete(el);
  lightNow.delete(el);
  if (!states.has(el)) io?.unobserve(el);
  el.style.removeProperty('--ul-light');
}
