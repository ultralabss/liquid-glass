/**
 * Chart core (React): text, palette cues, responsive size, tween (draw-in + morph), the panel frame with header, toolbar,
 * legend, states, data table, live region, and the snapped hover layer (crosshair + beads + value tooltip).
 * Rules: the panel is the only glass surface (lite); the plot never refracts; pointer moves never set React state; the
 * hover layer writes one transform per frame and touches content only when the snapped point changes.
 */
import * as React from 'react';
import { ULGlass } from '../glass/ULGlass.tsx';
import { accentAttrs, type Accent } from '../glass/accent.tsx';
import { ULIcon, cx, useDomId } from '../components/shared/icons.tsx';
import { ULCheckMark } from '../components/shared/ULCheckMark.tsx';
import { ULEmptyState, ULBadge } from '../components/ULData/ULData.tsx';
import { ULErrorState } from '../components/dashboard/blocks.tsx';
import { ULCopyButton, ULDownloadButton } from '../components/actions/actions.tsx';
import { ULButton } from '../components/ULButton/ULButton.tsx';
import { useContextMenuTarget, type ContextMenuProps, type ContextTarget } from '../components/ULContainers/contextTarget.tsx';
import { isMorphReduced, getMorphTimeScale } from '../motion/anchoredMorph.ts';
import { springs } from '../motion/spring.ts';
import { chartLocale, shapePath, type ChartLocale, type ScatterShape } from './scales.ts';
import './charts.css';

/* ---------- text (EN / SK / DE / CS) ---------- */
const T = {
  en: { table: 'View as table', chart: 'View as chart', loading: 'Loading chart', empty: 'No data for this period', emptyHint: 'Change the time range or filters.', error: 'The chart could not be loaded', stale: 'Stale', other: 'Other', series: 'Series', csv: 'CSV', copy: 'Copy data', download: 'Download CSV', total: 'Total', nav: 'Arrow keys move between points and series, Home and End jump, Enter pins the tooltip, Escape unpins.', from: 'from', to: 'to', low: 'lowest', high: 'highest', pinned: 'pinned', category: 'Category', share: 'Share', win: 'win', loss: 'loss' },
  sk: { table: 'Zobraziť ako tabuľku', chart: 'Zobraziť ako graf', loading: 'Načítava sa graf', empty: 'Pre toto obdobie nie sú dáta', emptyHint: 'Zmeňte časový rozsah alebo filtre.', error: 'Graf sa nepodarilo načítať', stale: 'Neaktuálne', other: 'Ostatné', series: 'Série', csv: 'CSV', copy: 'Kopírovať dáta', download: 'Stiahnuť CSV', total: 'Spolu', nav: 'Šípky presúvajú medzi bodmi a sériami, Home a End skáču na koniec, Enter pripne popis, Escape ho uvoľní.', from: 'od', to: 'do', low: 'najnižšie', high: 'najvyššie', pinned: 'pripnuté', category: 'Kategória', share: 'Podiel', win: 'výhra', loss: 'prehra' },
  de: { table: 'Als Tabelle anzeigen', chart: 'Als Diagramm anzeigen', loading: 'Diagramm wird geladen', empty: 'Keine Daten für diesen Zeitraum', emptyHint: 'Zeitraum oder Filter ändern.', error: 'Das Diagramm konnte nicht geladen werden', stale: 'Veraltet', other: 'Andere', series: 'Reihen', csv: 'CSV', copy: 'Daten kopieren', download: 'CSV herunterladen', total: 'Gesamt', nav: 'Pfeiltasten wechseln Punkte und Reihen, Pos1 und Ende springen, Enter heftet den Tooltip an, Escape löst ihn.', from: 'von', to: 'bis', low: 'niedrigster Wert', high: 'höchster Wert', pinned: 'angeheftet', category: 'Kategorie', share: 'Anteil', win: 'Sieg', loss: 'Niederlage' },
  cs: { table: 'Zobrazit jako tabulku', chart: 'Zobrazit jako graf', loading: 'Načítá se graf', empty: 'Pro toto období nejsou data', emptyHint: 'Změňte časový rozsah nebo filtry.', error: 'Graf se nepodařilo načíst', stale: 'Neaktuální', other: 'Ostatní', series: 'Série', csv: 'CSV', copy: 'Kopírovat data', download: 'Stáhnout CSV', total: 'Celkem', nav: 'Šipky přesouvají mezi body a sériemi, Home a End skáčou na konec, Enter připne popisek, Escape ho uvolní.', from: 'od', to: 'do', low: 'nejnižší', high: 'nejvyšší', pinned: 'připnuto', category: 'Kategorie', share: 'Podíl', win: 'výhra', loss: 'prohra' },
};
export type ChartTextKey = keyof typeof T.en;
export const chartText = (k: ChartTextKey, locale?: string) => T[chartLocale(locale) as ChartLocale][k];

/* ---------- palette cues ---------- */
/** Secondary cue per series slot (colour is never the only signal): line dash and fill pattern id. Slot 0 is solid. */
export const SERIES_DASH = ['', '7 4', '2 4', '10 3 2 3', '1 3', '12 5'];
export const SERIES_SLOTS = 6;
export const slotOf = (i: number) => i % SERIES_SLOTS;
/* Fill pattern bodies per slot (hatch, dots, cross, rules); slot 0 is always plain. */
const PAT: Record<number, [React.ReactNode, number]> = {
  1: [<path d="M0 6L6 0M-1 1L1 -1M5 7L7 5" />, 6], 2: [<circle cx="3" cy="3" r="1" />, 6], 3: [<path d="M0 0L6 6M6 0L0 6" />, 7], 4: [<path d="M0 3H6" />, 6], 5: [<path d="M3 0V6" />, 6],
};
const patternDef = (id: string, slot: number) => PAT[slot] ? <pattern key={slot} id={`${id}-p${slot}`} width={PAT[slot][1]} height={PAT[slot][1]} patternUnits="userSpaceOnUse" className="ul-chart-pat" data-s={slot}>{PAT[slot][0]}</pattern> : null;
/** <defs> patterns for fills; referenced as url(#{id}-p{slot}). */
export function ChartPatterns({ id }: { id: string }) { return <>{[1, 2, 3, 4, 5].map((sl) => patternDef(id, sl))}</>; }

/* ---------- pattern policy ---------- */
export type PatternMode = 'auto' | 'on' | 'off';
const HC_QUERY = '(prefers-contrast: more), (forced-colors: active)';
function useHighContrast() {
  const [on, setOn] = React.useState(() => typeof matchMedia === 'function' && matchMedia(HC_QUERY).matches);
  React.useEffect(() => { if (typeof matchMedia !== 'function') return; const m = matchMedia(HC_QUERY), f = () => setOn(m.matches); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f); }, []);
  return on;
}
export interface PatternPolicy { mode: PatternMode; fills: boolean; dash(slot: number, order: number): string; state: 'on' | 'auto-fills' | 'auto-lines' | 'off' }
/**
 * auto: series 3+ (order ≥ 2) get a dash on line marks; fills (areas, bars, slices) get patterns only with more than 4
 * series / categories or under prefers-contrast: more / forced-colors. on: every cue. off: none (colour + legend only).
 */
export function usePatternPolicy(mode: PatternMode = 'auto', count: number): PatternPolicy {
  const hc = useHighContrast();
  const fills = mode === 'on' || (mode === 'auto' && (count > 4 || hc));
  const dash = (slot: number, order: number) => (mode === 'off' ? '' : mode === 'on' || hc ? SERIES_DASH[slot] || (order ? SERIES_DASH[order % SERIES_SLOTS] : '') : order >= 2 ? SERIES_DASH[slot] || SERIES_DASH[order % SERIES_SLOTS] || SERIES_DASH[2] : '');
  return { mode, fills, dash, state: mode === 'off' ? 'off' : mode === 'on' ? 'on' : fills ? 'auto-fills' : 'auto-lines' };
}
/** Legend / tooltip key: a short line with the series dash, or a swatch that mirrors the fill pattern. */
export function SeriesKey({ slot, mark = 'line', dash, pattern, shape }: { slot: number; mark?: 'line' | 'fill'; dash?: string; pattern?: boolean; shape?: ScatterShape }) {
  const id = useDomId('ul-key');
  if (shape) return <svg className="ul-chart-keymark" data-s={slot} width="16" height="10" viewBox="0 0 16 10" aria-hidden="true" focusable="false"><path d={shapePath(shape, 8, 5, 3.6)} className="ul-chart-keyfill ul-chart-keyshape" /></svg>;
  const pat = mark === 'fill' && pattern && !!PAT[slot];
  return (
    <svg className="ul-chart-keymark" data-s={slot} width="16" height="10" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      {pat ? <defs>{patternDef(id, slot)}</defs> : null}
      {mark === 'fill' ? <rect x="1" y="1" width="14" height="8" rx="2.5" className="ul-chart-keyfill" /> : <path d="M1 5H15" className="ul-chart-keyline" strokeDasharray={dash || undefined} />}
      {pat ? <rect x="1" y="1" width="14" height="8" rx="2.5" className="ul-chart-hatch" fill={`url(#${id}-p${slot})`} /> : null}
    </svg>
  );
}

/* ---------- size ---------- */
/** Width of the plot box from a ResizeObserver; state changes only when the integer width changes (no thrash). */
export function useWidth(ref: React.RefObject<HTMLElement | null>, fallback = 560) {
  const [w, setW] = React.useState(fallback);
  // The plot element is re-created when the frame switches table → chart; re-attach the observer to the new node.
  const obs = React.useRef<{ el: Element | null; ro: ResizeObserver | null; raf: number }>({ el: null, ro: null, raf: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current, o = obs.current;
    if (el === o.el) return;
    o.ro?.disconnect(); cancelAnimationFrame(o.raf); o.el = el; o.ro = null;
    if (!el) return;
    const read = (cw: number) => { const v = Math.max(120, Math.floor(cw)); setW((p) => (p === v ? p : v)); };
    o.ro = new ResizeObserver((es) => { const cw = es[0].contentRect.width; if (cw < 1) return; /* hidden (table view) or detached: keep the last width */ cancelAnimationFrame(o.raf); o.raf = requestAnimationFrame(() => read(cw)); });
    o.ro.observe(el); if (el.clientWidth >= 1) read(el.clientWidth);
  });
  React.useEffect(() => () => { obs.current.ro?.disconnect(); cancelAnimationFrame(obs.current.raf); }, []);
  return w;
}

/* ---------- tween: draw-in once, morph on data change, nothing on identical data ---------- */
export interface TweenFrame { v: (number | null)[][]; w: number[]; d: number[] }
const tok = (k: string, f: number) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/**
 * Interpolates values (v), series weights (w: legend in/out) and domains (d: axes rescale) together.
 * Same key = same data: no animation. A new target mid-flight starts from the current frame (interruptible).
 * Different shape (length change): jumps, the caller fades. Reduced motion: jumps (caller fades).
 */
/** Test hook (no UI): morph starts and the first value of every applied frame. Read by the chart test cards. */
export const chartStats = { morphs: 0, frames: 0, log: [] as { from: number | null; to: number | null; first: number | null }[], last: null as number | null };
const exposeStats = () => { if (typeof window !== 'undefined' && !(window as unknown as { __ulChartStats?: unknown }).__ulChartStats) (window as unknown as { __ulChartStats: typeof chartStats }).__ulChartStats = chartStats; };
const first = (f: TweenFrame) => { for (const r of f.v) for (const v of r) if (v != null) return v; return null; };
export function useChartTween(target: TweenFrame, key: string, enabled = true): { frame: TweenFrame; morphing: boolean } {
  exposeStats();
  const [frame, setFrame] = React.useState(target);
  const cur = React.useRef(target), prevKey = React.useRef(key), raf = React.useRef(0), [morphing, setMorphing] = React.useState(false);
  React.useEffect(() => {
    if (key === prevKey.current) return;
    prevKey.current = key;
    cancelAnimationFrame(raf.current);
    const from = cur.current;
    const sameShape = from.v.length === target.v.length && from.v.every((r, i) => r.length === target.v[i].length) && from.d.length === target.d.length && from.w.length === target.w.length;
    if (!sameShape || isMorphReduced() || !enabled) { cancelAnimationFrame(raf.current); cur.current = target; setFrame(target); setMorphing(false); return; }
    const dur = tok('--ul-chart-morph', 520) * getMorphTimeScale(), t0 = performance.now(), ease = springs.smooth;
    setMorphing(true);
    chartStats.morphs++; const entry = { from: first(from), to: first(target), first: null as number | null }; chartStats.log.push(entry); if (chartStats.log.length > 20) chartStats.log.shift();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur), e = p >= 1 ? 1 : ease(p);
      const f: TweenFrame = {
        v: target.v.map((row, si) => row.map((b, i) => { const a = from.v[si][i]; return a == null || b == null ? b : lerp(a, b, e); })),
        w: target.w.map((b, i) => lerp(from.w[i], b, e)),
        d: target.d.map((b, i) => lerp(from.d[i], b, e)),
      };
      cur.current = f; setFrame(f); chartStats.frames++; chartStats.last = first(f); if (entry.first == null) entry.first = chartStats.last;
      if (p < 1) raf.current = requestAnimationFrame(step); else setMorphing(false);
    };
    raf.current = requestAnimationFrame(step);
  }, [key]);
  React.useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const ok = frame.v.length === target.v.length && frame.w.length === target.w.length && frame.v.every((r, i) => r.length === target.v[i].length);
  return { frame: ok ? frame : target, morphing };
}
/** One-time draw-in on mount: lines by stroke-dashoffset, bars grow (clip from the baseline), areas reveal left → right. Reduced motion: a short fade. */
export function useDrawIn(svg: React.RefObject<SVGSVGElement | null>, horizontal = false) {
  React.useLayoutEffect(() => {
    const root = svg.current; if (!root) return;
    const reduced = isMorphReduced(), ts = getMorphTimeScale();
    if (reduced) { root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: tok('--ul-chart-fade', 150) }); return; }
    const dur = tok('--ul-chart-draw', 900) * ts, ease = springs.smooth.toCSS();
    root.querySelectorAll<SVGPathElement>('.ul-chart-ln:not([data-dash])').forEach((p) => p.animate([{ strokeDasharray: '0 1' }, { strokeDasharray: '1 0' }], { duration: dur, easing: ease }));
    root.querySelectorAll<SVGPathElement>('.ul-chart-ln[data-dash]').forEach((p) => p.animate([{ clipPath: 'inset(-8px 100% -8px -8px)' }, { clipPath: 'inset(-8px -8px -8px -8px)' }], { duration: dur, easing: ease }));
    root.querySelectorAll<SVGElement>('.ul-chart-areas').forEach((g) => g.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: dur, easing: ease }));
    root.querySelectorAll<SVGElement>('.ul-chart-bars').forEach((g) => g.animate([{ clipPath: horizontal ? 'inset(0 100% 0 0)' : 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: dur * 0.8, easing: springs.snappy.toCSS() }));
    root.querySelectorAll<SVGElement>('.ul-chart-beads').forEach((g) => g.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: dur }));
  }, []);
}
/** Reduced-motion data change: a short fade instead of the morph. */
export function useChangeFade(el: React.RefObject<Element | null>, key: string) {
  const first = React.useRef(true);
  React.useEffect(() => { if (first.current) { first.current = false; return; } if (isMorphReduced()) el.current?.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: tok('--ul-chart-fade', 150) }); }, [key]);
}

/* ---------- hover layer (crosshair, beads, value tooltip) ---------- */
export interface HoverRow { slot: number; name: string; value: string; mark?: 'line' | 'fill'; dash?: string }
export interface HoverPoint { index: number; x: number; y: number; title: string; rows: HoverRow[]; beads: { slot: number; x: number; y: number }[] }
export interface HoverApi {
  layer: React.ReactNode;
  /** Snap to a point. Writes content only when the index (or pin state) changes; otherwise nothing. */
  show(p: HoverPoint | null): void;
  pin(on: boolean): void;
  readonly pinned: boolean;
  readonly index: number | null;
}
/**
 * The value tooltip follows the slider value-tooltip rule (CLAUDE.md exception): sticky, no spring while tracking, same
 * opaque shape + arrow as createAnchoredTooltip, never glass. One transform write per frame on the positioner.
 */
export function useHoverLayer(opts: { width: number; height: number; plot: { l: number; t: number; r: number; b: number }; orient?: 'v' | 'h'; crosshair?: boolean; /** bar charts: crosshair becomes a band of this size */ band?: number }): HoverApi {
  const root = React.useRef<HTMLDivElement | null>(null), tip = React.useRef<HTMLDivElement | null>(null), xh = React.useRef<HTMLSpanElement | null>(null);
  const st = React.useRef({ index: null as number | null, pinned: false, key: '' });
  const o = React.useRef(opts); o.current = opts;
  // the layer element is attached below (render output); the memoised api is the stable imperative part
  const api = React.useMemo<Omit<HoverApi, 'layer'>>(() => ({
    get pinned() { return st.current.pinned; },
    get index() { return st.current.index; },
    pin(on) { st.current.pinned = on; root.current?.toggleAttribute('data-pinned', on); },
    show(p) {
      const el = root.current, t = tip.current; if (!el || !t) return;
      if (!p) { if (st.current.index == null) return; st.current.index = null; st.current.key = ''; el.removeAttribute('data-on'); return; }
      const key = `${p.index}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.rows.map((r) => r.value).join()}`;
      if (key === st.current.key) return;
      const enter = st.current.index == null;
      st.current.index = p.index; st.current.key = key;
      const { plot, orient = 'v' } = o.current; const W = (el.parentElement as HTMLElement | null)?.clientWidth || o.current.width;
      // content (only on point change)
      (t.querySelector('.ul-chart-tip-x') as HTMLElement).textContent = p.title;
      const rowsBox = t.querySelector('.ul-chart-tip-rows') as HTMLElement;
      if (rowsBox.childElementCount !== p.rows.length) {
        rowsBox.textContent = '';
        for (const _ of p.rows) { const r = document.createElement('span'); r.className = 'ul-chart-tip-row'; r.innerHTML = '<svg class="ul-chart-keymark" width="16" height="10" viewBox="0 0 16 10" aria-hidden="true"><path d="M1 5H15" class="ul-chart-keyline"></path><rect x="1" y="1" width="14" height="8" rx="2.5" class="ul-chart-keyfill"></rect></svg><span class="ul-chart-tip-name"></span><b></b>'; rowsBox.appendChild(r); }
      }
      p.rows.forEach((r, i) => {
        const row = rowsBox.children[i] as HTMLElement; row.dataset.s = String(r.slot); row.dataset.mark = r.mark ?? 'line';
        (row.querySelector('.ul-chart-keyline') as SVGPathElement).setAttribute('stroke-dasharray', r.dash || 'none');
        (row.querySelector('.ul-chart-tip-name') as HTMLElement).textContent = r.name;
        (row.querySelector('b') as HTMLElement).textContent = r.value;
      });
      const beadBox = el.querySelector('.ul-chart-hbeads') as HTMLElement;
      while (beadBox.childElementCount < p.beads.length) { const b = document.createElement('span'); b.className = 'ul-chart-hbead'; beadBox.appendChild(b); }
      Array.from(beadBox.children).forEach((b, i) => {
        const bd = p.beads[i], s = (b as HTMLElement).style;
        if (!bd) { s.display = 'none'; return; }
        s.display = ''; (b as HTMLElement).dataset.s = String(bd.slot); s.translate = `${(bd.x - (orient === 'v' ? p.x : 0)).toFixed(1)}px ${(bd.y - (orient === 'h' ? p.y : 0)).toFixed(1)}px`;
        if (!isMorphReduced()) (b.firstElementChild ?? b).animate?.([{ scale: '1' }, { scale: String(tok('--ul-data-bead-hover', 1.3)) }], { duration: tok('--ul-chart-bead-ms', 380), easing: springs.bouncy.toCSS(), fill: 'forwards' });
      });
      // geometry: tip (measured once per point), then the ONE positioner transform
      const tw = t.offsetWidth, th = t.offsetHeight, gap = 10;
      const ax = orient === 'v' ? 0 : p.x, ay = orient === 'v' ? p.y : 0;
      const absX = orient === 'v' ? p.x : p.x;
      let left = ax - tw / 2;
      left = Math.max(-absX + 2, Math.min(left, W - absX - tw - 2));
      let top = ay - th - gap, flip = false;
      if ((orient === 'v' ? 0 : p.y) + top < 0) { top = ay + gap + 4; flip = true; }
      t.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
      t.toggleAttribute('data-flip', flip);
      (t.querySelector('.ul-chart-tip-arrow') as HTMLElement).style.transform = `translate3d(${Math.max(8, Math.min(tw - 18, ax - left - 5)).toFixed(1)}px, 0, 0)`;
      if (xh.current) xh.current.dataset.o = orient;
      el.style.transform = orient === 'v' ? `translate3d(${p.x.toFixed(1)}px, 0, 0)` : `translate3d(0, ${p.y.toFixed(1)}px, 0)`;
      if (enter) { el.setAttribute('data-on', ''); if (!isMorphReduced()) t.animate([{ opacity: 0, scale: '0.92' }, { opacity: 1, scale: '1' }], { duration: 200 * getMorphTimeScale(), easing: springs.snappy.toCSS() }); }
    },
  }), []);
  const { plot, height, orient = 'v', crosshair = true } = opts;
  const layer = (
    <div ref={root} className="ul-chart-hover" data-o={orient} aria-hidden="true">
      {crosshair ? <span ref={xh} className="ul-chart-xhair" data-band={opts.band ? '' : undefined} style={orient === 'v' ? { top: plot.t, height: Math.max(0, height - plot.t - plot.b), width: opts.band || undefined } : { left: plot.l, width: Math.max(0, opts.width - plot.l - plot.r), height: opts.band || undefined }}></span> : null}
      <span className="ul-chart-hbeads"></span>
      <div ref={tip} className="ul-chart-tip"><span className="ul-chart-tip-body"><span className="ul-chart-tip-x"></span><span className="ul-chart-tip-rows"></span></span><span className="ul-chart-tip-arrow"></span></div>
    </div>
  );
  return Object.assign(api, { layer }) as HoverApi;
}

/* ---------- legend ---------- */
export interface LegendItem { key: string; name: string; slot: number; mark?: 'line' | 'fill'; on: boolean; dash?: string; pattern?: boolean; shape?: ScatterShape }
export function ChartLegend({ items, onToggle, onFocusSeries, label }: { items: LegendItem[]; onToggle?: (key: string) => void; onFocusSeries?: (key: string | null) => void; label: string }) {
  return (
    <div className="ul-chart-legend2" role="group" aria-label={label}>
      {items.map((it) => (
        <button key={it.key} type="button" className="ul-chart-lchip" data-s={it.slot} data-key={it.key} aria-pressed={it.on} disabled={!onToggle}
          onClick={() => onToggle?.(it.key)} onPointerEnter={() => onFocusSeries?.(it.key)} onPointerLeave={() => onFocusSeries?.(null)} onFocus={() => onFocusSeries?.(it.key)} onBlur={() => onFocusSeries?.(null)}>
          {onToggle ? <ULCheckMark checked={it.on} className="ul-chart-lcheck" /> : null}
          <SeriesKey slot={it.slot} mark={it.mark} dash={it.dash} pattern={it.pattern} shape={it.shape} />
          <span className="ul-chart-lname">{it.name}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- skeleton in the plot shape ---------- */
export function ChartSkeleton({ shape, height }: { shape: 'line' | 'area' | 'bar' | 'hbar' | 'donut' | 'combo' | 'gauge' | 'radar' | 'scatter' | 'grid' | 'funnel' | 'treemap'; height: number }) {
  const W = 600, H = height;
  const wave = Array.from({ length: 13 }, (_, i) => `${i ? 'L' : 'M'}${(i / 12) * W} ${H * (0.55 + 0.18 * Math.sin(i * 0.9) - i * 0.012)}`).join('');
  const R = Math.min(W, H) * 0.42, poly = (r: number, n = 6) => Array.from({ length: n }, (_, i) => `${i ? 'L' : 'M'}${(W / 2 + Math.sin((i / n) * Math.PI * 2) * r).toFixed(1)} ${(H / 2 - Math.cos((i / n) * Math.PI * 2) * r).toFixed(1)}`).join('') + 'Z';
  const adv = shape === 'gauge' ? <path d={`M${W / 2 - H * 0.7} ${H * 0.86}A${H * 0.7} ${H * 0.7} 0 0 1 ${W / 2 + H * 0.7} ${H * 0.86}`} className="ul-chart-skel-ring" strokeWidth={H * 0.12} fill="none" />
    : shape === 'radar' ? <>{[1, 0.66, 0.33].map((k) => <path key={k} d={poly(R * k)} className="ul-chart-grid" fill="none" />)}<path d={poly(R * 0.7)} className="ul-chart-skel-mark" opacity=".6" /></>
    : shape === 'scatter' ? Array.from({ length: 28 }, (_, i) => <circle key={i} cx={((i * 137) % 97) / 97 * (W - 40) + 20} cy={H * (0.85 - (i / 28) * 0.6) + Math.sin(i * 2.1) * H * 0.08} r={5 + (i % 4) * 2} className="ul-chart-skel-mark" />)
    : shape === 'grid' ? Array.from({ length: 7 * 12 }, (_, i) => <rect key={i} x={(i % 12) * (W / 12) + 2} y={Math.floor(i / 12) * (H / 7) + 2} width={W / 12 - 4} height={H / 7 - 4} rx="3" className="ul-chart-skel-mark" opacity={0.35 + 0.5 * Math.abs(Math.sin(i * 0.7))} />)
    : shape === 'funnel' ? Array.from({ length: 5 }, (_, i) => { const w = W * (0.95 - i * 0.16); return <rect key={i} x={(W - w) / 2} y={i * (H / 5) + 4} width={w} height={H / 5 - 8} rx="6" className="ul-chart-skel-mark" />; })
    : shape === 'treemap' ? [[0, 0, 0.55, 1], [0.55, 0, 0.45, 0.6], [0.55, 0.6, 0.25, 0.4], [0.8, 0.6, 0.2, 0.4]].map(([x, y, w, h], i) => <rect key={i} x={x * W + 2} y={y * H + 2} width={w * W - 4} height={h * H - 4} rx="6" className="ul-chart-skel-mark" />)
    : null;
  return (
    <div className="ul-chart-skel" style={{ height }} role="img" aria-busy="true">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" data-ul-illustration="">
        {[0.2, 0.4, 0.6, 0.8].map((y) => <line key={y} x1="0" x2={W} y1={H * y} y2={H * y} className="ul-chart-grid" />)}
        {adv ?? (shape === 'donut' ? <circle cx={W / 2} cy={H / 2} r={H * 0.36} className="ul-chart-skel-ring" strokeWidth={H * 0.12} vectorEffect="non-scaling-stroke" />
          : shape === 'bar' || shape === 'combo' ? Array.from({ length: 10 }, (_, i) => { const h = H * (0.25 + 0.45 * Math.abs(Math.sin(i * 1.3 + 0.4))); return <rect key={i} x={i * 60 + 14} y={H - h} width="32" height={h} rx="5" className="ul-chart-skel-mark" />; })
          : shape === 'hbar' ? Array.from({ length: 6 }, (_, i) => <rect key={i} x="0" y={i * (H / 6) + 6} width={W * (0.35 + 0.5 * Math.abs(Math.cos(i * 1.1)))} height={H / 6 - 14} rx="5" className="ul-chart-skel-mark" />)
          : <><path d={wave + `L${W} ${H}L0 ${H}Z`} className="ul-chart-skel-mark" opacity=".5" /><path d={wave} className="ul-chart-skel-line" vectorEffect="non-scaling-stroke" /></>)}
      </svg>
    </div>
  );
}

/* ---------- frame ---------- */
export type ChartState = 'ready' | 'loading' | 'empty' | 'error';
export interface ChartTable { columns: string[]; rows: (string | number)[][]; rowHeader?: boolean }
export interface ChartFrameProps {
  /** Chart title (panel heading, names the figure). */ title: React.ReactNode; /** Short description under the title. */ description?: React.ReactNode; /** Text summary for screen readers (read before the data table). */ summary: string; /** "en" | "sk" | "de" | "cs" for numbers, dates and built-in strings. Default "en". */ locale?: string; /** Accent colour of the panel; series colours derive from it (--ul-chart-s0…s5). */ accent?: Accent; /** Wrap in the one glass chart panel. Default true; false for embedding in another surface. */ panel?: boolean; /** Extra class on the panel. */ className?: string;
  /** "ready" | "loading" | "empty" | "error" — skeleton, empty and error states keep the panel size. */ state?: ChartState; /** Error state Retry action. */ onRetry?: () => unknown; /** Error state text. Default localised. */ errorMessage?: React.ReactNode; /** Empty state content. Default localised "No data". */ empty?: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode };
  /** Stale badge (true or a custom label) when the data is old. */ stale?: boolean | string; /** Plot height in px. */ height: number; /** Skeleton shape shown while loading. */ skeleton: Parameters<typeof ChartSkeleton>[0]['shape'];
  /** Data table definition (columns + rows) for the table view and CSV. */ table: ChartTable; /** Legend element (ChartLegend). */ legend?: React.ReactNode; /** "auto" (default) | "on" | "off" — dash / hatch cues per the patterns policy. */ patterns?: PatternPolicy['state']; /** Show the toolbar (table, copy, CSV). Default true. */ toolbar?: boolean; /** Base file name of the CSV export. */ filename?: string; /** Open with the data table shown. Default false. */ defaultTable?: boolean; /** Ref of the polite live region (announcements of the chart). */ liveRef?: React.Ref<HTMLDivElement>;
  /** Chart body. */ children: React.ReactNode; /** Content under the plot. */ footer?: React.ReactNode;
}
const csvCell = (v: string | number) => { const s = String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const tableToCsv = (t: ChartTable) => [t.columns, ...t.rows].map((r) => r.map(csvCell).join(',')).join('\n');
export const tableToTsv = (t: ChartTable) => [t.columns, ...t.rows].map((r) => r.join('\t')).join('\n');

export function ChartFrame(p: ChartFrameProps) {
  const id = useDomId('ul-ch');
  const [tbl, setTbl] = React.useState(!!p.defaultTable);
  const L = (k: ChartTextKey) => chartText(k, p.locale);
  const state = p.state ?? 'ready', ready = state === 'ready';
  const acc = accentAttrs(p.accent);
  const staleText = typeof p.stale === 'string' ? p.stale : L('stale');
  const body = (
    <figure className={cx('ul-chart2', p.panel === false ? p.className : null)} data-ul-patterns={p.patterns} aria-labelledby={`${id}-t`} aria-describedby={p.description ? `${id}-d` : undefined} aria-busy={state === 'loading' || undefined}>
      <div className="ul-chart2-head">
        <div className="ul-chart2-titles">
          <figcaption id={`${id}-t`} className="ul-chart2-title">{p.title}</figcaption>
          {p.description ? <p id={`${id}-d`} className="ul-chart2-desc">{p.description}</p> : null}
        </div>
        <div className="ul-chart2-tools">
          {p.stale ? <ULBadge tone="warning" dot size="sm">{staleText}</ULBadge> : null}
          {ready && p.toolbar !== false ? <>
            <ULButton variant="plain" size="sm" shape="circle" aria-label={tbl ? L('chart') : L('table')} pressed={tbl} onPressedChange={setTbl} aria-controls={`${id}-b`} icon={<ULIcon name={tbl ? 'layout-grid' : 'menu'} size="sm" />} />
            <ULCopyButton variant="icon" buttonVariant="plain" size="sm" label={L('copy')} value={() => tableToTsv(p.table)} locale={p.locale} />
            <ULDownloadButton variant="plain" size="sm" label={L('csv')} aria-label={L('download')} filename={`${p.filename ?? 'chart'}.csv`} onExport={() => new Blob([tableToCsv(p.table)], { type: 'text/csv;charset=utf-8' })} locale={p.locale} />
          </> : null}
        </div>
      </div>
      <div id={`${id}-b`} className="ul-chart2-body" style={{ minHeight: state === 'ready' ? p.height : Math.max(160, p.height) }}>
        {state === 'loading' ? <><ChartSkeleton shape={p.skeleton} height={p.height} /><span className="ul-sr-only" role="status">{L('loading')}</span></>
          : state === 'empty' ? <div className="ul-chart2-state" style={{ minHeight: Math.max(160, p.height) }}><ULEmptyState size="sm" title={p.empty?.title ?? L('empty')} description={p.empty?.description ?? L('emptyHint')} action={p.empty?.action} level={4} /></div>
          : state === 'error' ? <div className="ul-chart2-state" style={{ minHeight: Math.max(160, p.height) }}><ULErrorState embedded title={L('error')} message={p.errorMessage} onRetry={p.onRetry} locale={p.locale as never} /></div>
          : <>{tbl ? <ChartDataTable table={p.table} caption={typeof p.title === 'string' ? p.title : L('table')} height={p.height} /> : null}<div className="ul-chart2-view" hidden={tbl}>{p.children}</div></>}
      </div>
      {ready && !tbl ? p.legend : null}
      {p.footer}
      <p className="ul-sr-only">{p.summary}</p>
      <div ref={p.liveRef} className="ul-sr-only" aria-live="polite" aria-atomic="true"></div>
    </figure>
  );
  if (p.panel === false) return body;
  return <ULGlass tier="md" quality="lite" padding="var(--ul-chart-pad)" radius="var(--ul-radius-lg)" className={cx('ul-chart2-panel', p.className)} data-ul-accent={acc['data-ul-accent'] as string} style={acc.style as React.CSSProperties}>{body}</ULGlass>;
}

export function ChartDataTable({ table, caption, height }: { table: ChartTable; caption: string; height: number }) {
  return (
    <div className="ul-chart2-table" style={{ maxHeight: Math.max(height, 160) }} tabIndex={0} role="region" aria-label={caption}>
      <table data-ul-allow-overflow="">
        <caption className="ul-sr-only">{caption}</caption>
        <thead><tr>{table.columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
        <tbody>{table.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => (ci === 0 && table.rowHeader !== false ? <th key={ci} scope="row">{c}</th> : <td key={ci}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}

/* ---------- context menu wrapper ---------- */
export function withChartMenu<D>(node: React.ReactElement, ctx: ContextMenuProps<D>, resolve: (hit: Element, root: HTMLElement) => Omit<ContextTarget<D>, 'component'> | null) {
  return <ChartCtx node={node} ctx={ctx} resolve={resolve} />;
}
function ChartCtx<D>({ node, ctx, resolve }: { node: React.ReactElement; ctx: ContextMenuProps<D>; resolve: (hit: Element, root: HTMLElement) => Omit<ContextTarget<D>, 'component'> | null }) {
  const api = useContextMenuTarget<D>({ ...ctx, component: 'chart', resolve });
  if (!ctx.contextMenu) return node;
  return <span className="ul-ctx-target" style={{ display: 'contents' }} {...(api.bind as Record<string, unknown>)}>{node}{api.menu}</span>;
}
/** Splits ContextMenuProps off a props object. */
// generic over the target type T and the full props P: `P extends ContextMenuProps<unknown>` rejected every chart (ContextMenuSpec<T>
// is not assignable to ContextMenuSpec<unknown>: the callbacks take T), which collapsed the rest props. Types only; runtime unchanged.
/** Target type carried by a props type's contextMenu spec (inferred per chart: points, cells, tiles, steps …). */
export type CtxTargetOf<P> = P extends ContextMenuProps<infer T> ? T : unknown;
export function splitChartCtx<P extends ContextMenuProps<any>, T = CtxTargetOf<P>>(p: P): [ContextMenuProps<T>, Omit<P, keyof ContextMenuProps<T>>] {
  const { contextMenu, onContextMenuOpen, onContextMenuClose, onContextMenuAction, contextMenuNative, contextMenuLabel, ...rest } = p as P & Record<string, unknown>;
  return [{ contextMenu, onContextMenuOpen, onContextMenuClose, onContextMenuAction, contextMenuNative, contextMenuLabel } as ContextMenuProps<T>, rest as unknown as Omit<P, keyof ContextMenuProps<T>>];
}
