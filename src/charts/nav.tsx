/**
 * Shared mark navigation for index-based charts (radial, gauge, radar, scatter, heatmap, funnel, histogram, treemap):
 * pointer → mark (data-mark attribute or a picker such as the quadtree), keyboard walk, Enter / click pin, Esc unpin, the
 * polite live text, and the focus hook for the mark highlight. One implementation; the chart supplies pointAt and moves.
 * Pointer moves never set React state; the hover layer writes content only when the mark changes.
 */
import * as React from 'react';
import type { Accent } from '../glass/accent.tsx';
import type { ContextMenuProps } from '../components/ULContainers/contextTarget.tsx';
import { isMorphReduced, getMorphTimeScale } from '../motion/anchoredMorph.ts';
import { springs } from '../motion/spring.ts';
import type { ChartPointTarget } from './ULCartesianChart.tsx';
import type { PatternMode, ChartState } from './core.tsx';
import type { HoverApi, HoverPoint } from './core.tsx';
import { chartLocale } from './scales.ts';

export type NavKey = 'next' | 'prev' | 'up' | 'down' | 'home' | 'end';
export interface MarkNavOptions {
  hover: HoverApi;
  count: number;
  /** Hidden marks (legend off) are skipped. */
  visible?: (i: number) => boolean;
  pointAt: (i: number) => HoverPoint;
  liveRef: React.RefObject<HTMLDivElement | null>;
  /** Highlight hook (dims the other marks). */
  onFocusMark?: (i: number | null) => void;
  /** Custom moves (grid rows, series walk, nearest neighbour). Return null to fall back to index order. */
  move?: (cur: number | null, k: NavKey, e: React.KeyboardEvent) => number | null | undefined;
  /** Pointer picker in plot coordinates (quadtree). Default: closest [data-mark] element. */
  pick?: (x: number, y: number, target: EventTarget | null) => number | null;
  /** Live text for a mark. Default: title + rows. */
  say?: (p: HoverPoint) => string;
  /** Extra keys (zoom, brush); return true when handled. */
  onKey?: (e: React.KeyboardEvent) => boolean;
}
export const markOf = (t: EventTarget | null) => { const el = (t as Element | null)?.closest?.('[data-mark]'); return el ? +(el as HTMLElement).dataset.mark! : null; };
export const sayPoint = (p: HoverPoint) => `${p.title}: ${p.rows.map((r) => (r.name ? `${r.name} ${r.value}` : r.value)).join(', ')}`;

export function useMarkNav(o: MarkNavOptions) {
  const ref = React.useRef(o); ref.current = o;
  const api = React.useMemo(() => {
    const vis = () => { const { count, visible } = ref.current; const out: number[] = []; for (let i = 0; i < count; i++) if (!visible || visible(i)) out.push(i); return out; };
    const show = (i: number | null, say = false) => {
      const c = ref.current; c.onFocusMark?.(i);
      if (i == null || i < 0 || i >= c.count) { c.hover.show(null); return; }
      const pt = c.pointAt(i); c.hover.show(pt);
      if (say && c.liveRef.current) c.liveRef.current.textContent = (c.say ?? sayPoint)(pt);
    };
    const local = (e: React.PointerEvent | React.MouseEvent) => { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] as const; };
    const hit = (e: React.PointerEvent | React.MouseEvent) => { const c = ref.current; if (c.pick) { const [x, y] = local(e); return c.pick(x, y, e.target); } return markOf(e.target); };
    const onKeyDown = (e: React.KeyboardEvent) => {
      const c = ref.current;
      if (c.onKey?.(e)) return;
      const v = vis(); if (!v.length) return;
      const cur = c.hover.index, pos = cur == null ? -1 : v.indexOf(cur);
      const K: Record<string, NavKey> = { ArrowRight: 'next', ArrowLeft: 'prev', ArrowDown: 'down', ArrowUp: 'up', Home: 'home', End: 'end' };
      let i: number | null | undefined = null;
      if (K[e.key]) {
        i = c.move?.(cur, K[e.key], e);
        if (i == null) { const k = K[e.key]; i = k === 'home' ? v[0] : k === 'end' ? v[v.length - 1] : k === 'next' || k === 'down' ? v[(pos + 1) % v.length] : v[(pos - 1 + v.length) % v.length]; }
      } else if (e.key === 'Enter' || e.key === ' ') { c.hover.pin(!c.hover.pinned); i = cur ?? v[0]; }
      else if (e.key === 'Escape') { if (!c.hover.pinned && cur == null) return; c.hover.pin(false); show(null); e.preventDefault(); return; }
      else return;
      e.preventDefault(); show(i, true);
    };
    return {
      show,
      bind: {
        onPointerMove: (e: React.PointerEvent) => { const c = ref.current; if (c.hover.pinned || e.buttons) return; const i = hit(e); if (i !== c.hover.index) show(i); },
        onPointerLeave: () => { if (!ref.current.hover.pinned) show(null); },
        onClick: (e: React.MouseEvent) => { const c = ref.current, i = hit(e); if (c.hover.pinned) { c.hover.pin(false); show(i); } else if (i != null) { show(i, true); c.hover.pin(true); } },
        onKeyDown,
        onBlur: () => { if (!ref.current.hover.pinned) show(null); },
      },
    };
  }, []);
  return api;
}

/** Props every advanced chart shares (frame, states, toolbar, patterns, context menu). */
export interface ChartBaseProps extends ContextMenuProps<ChartPointTarget> {
  /** Chart title (panel heading, names the figure). */ title: React.ReactNode; /** Short description under the title. */ description?: React.ReactNode; /** Text summary for screen readers (read before the data table). */ summary?: string; /** Plot height in px. */ height?: number; /** "en" | "sk" | "de" | "cs" for numbers, dates and built-in strings. Default "en". */ locale?: string;
  /** Intl.NumberFormat options for values (tooltip, table, legend). */ valueFormat?: Intl.NumberFormatOptions; /** Formats values for ticks, tooltip and table: Intl options or (v) => string. */ format?: (v: number) => string;
  /** Accent colour of the panel; series colours derive from it (--ul-chart-s0…s5). */ accent?: Accent; /** Wrap in the one glass chart panel. Default true; false for embedding in another surface. */ panel?: boolean; /** Extra class on the panel. */ className?: string; /** Show the legend (toggles series). Default true for more than one series. */ legend?: boolean; /** Show the toolbar (table, copy, CSV). Default true. */ toolbar?: boolean; /** Base file name of the CSV export. */ filename?: string;
  /** "ready" | "loading" | "empty" | "error" — skeleton, empty and error states keep the panel size. */ state?: ChartState; /** Error state Retry action. */ onRetry?: () => unknown; /** Error state text. Default localised. */ errorMessage?: React.ReactNode; /** Empty state content. Default localised "No data". */ empty?: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }; /** Stale badge (true or a custom label) when the data is old. */ stale?: boolean | string; /** Open with the data table shown. Default false. */ defaultTable?: boolean;
  /** "auto" (default) | "on" | "off" — dash / hatch cues per the patterns policy. */ patterns?: PatternMode;
}
export const baseFrame = (p: ChartBaseProps, n: number) => ({ title: p.title, description: p.description, locale: p.locale, accent: p.accent, panel: p.panel, className: p.className, onRetry: p.onRetry, errorMessage: p.errorMessage, empty: p.empty, stale: p.stale, toolbar: p.toolbar, filename: p.filename, defaultTable: p.defaultTable, state: !n && (p.state ?? 'ready') === 'ready' ? 'empty' as const : p.state });
/** One-time draw-in on mount; reduced motion = short fade. */
export function useDrawOnce(svg: React.RefObject<SVGSVGElement | null>, run: (root: SVGSVGElement, dur: number, ease: string) => void) {
  React.useLayoutEffect(() => {
    const root = svg.current; if (!root) return;
    if (isMorphReduced()) { root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: cssTok('--ul-chart-fade', 150) }); return; }
    run(root, cssTok('--ul-chart-draw', 900) * getMorphTimeScale(), springs.smooth.toCSS());
  }, []);
}
/** Highlight one mark (others dim through CSS svg[data-hot]). */
export const focusMarkIn = (svg: SVGSVGElement | null, i: number | null) => { if (!svg) return; svg.querySelectorAll('[data-mark][data-on]').forEach((n) => n.removeAttribute('data-on')); if (i == null || i < 0) { delete svg.dataset.hot; return; } svg.dataset.hot = ''; svg.querySelectorAll(`[data-mark="${i}"]`).forEach((n) => n.setAttribute('data-on', '')); };
export const ctxResolve = (plotSel: string, hoverIndex: () => number | null, point: (i: number, hit: Element) => { kind: string; id?: string; data: ChartPointTarget & Record<string, unknown> } | null) => (hit: Element) => {
  const chip = hit.closest<HTMLElement>('.ul-chart-lchip'); if (chip) return { kind: 'series', id: chip.dataset.key, data: { series: chip.dataset.key }, el: chip };
  const pl = hit.closest<HTMLElement>(plotSel); if (!pl) return null;
  const m = hit.closest<HTMLElement>('[data-mark]'), i = m ? +m.dataset.mark! : hoverIndex();
  const r = i != null ? point(i, hit) : null;
  return r ? { ...r, el: pl } : { kind: 'plot', data: {}, el: pl };
};

/* ---------- shared axes (scatter, histogram, streaming) ---------- */
export interface Box { l: number; t: number; r: number; b: number }
export function ChartAxes({ W, H, plot, xs, ys, xTicks, yTicks, xFmt, yFmt, xGrid = false }: { W: number; H: number; plot: Box; xs: (v: number) => number; ys: (v: number) => number; xTicks: number[]; yTicks: number[]; xFmt: (v: number) => string; yFmt: (v: number) => string; xGrid?: boolean }) {
  const x0 = plot.l, x1 = W - plot.r, y0 = plot.t, y1 = H - plot.b;
  const xl = xTicks.map((v) => ({ v, x: xs(v) })).filter((t) => t.x >= x0 - 0.5 && t.x <= x1 + 0.5);
  // drop x labels that would collide (estimated 6.4px per glyph)
  const keep: typeof xl = []; let last = -Infinity; for (const t of xl) { const w = xFmt(t.v).length * 6.4; if (t.x - w / 2 > last + 6 && t.x + w / 2 <= W && t.x - w / 2 >= 0) { keep.push(t); last = t.x + w / 2; } }
  return (
    <g className="ul-chart-axes">
      {yTicks.map((v) => { const y = ys(v); return y < y0 - 0.5 || y > y1 + 0.5 ? null : <g key={'y' + v}><line x1={x0} x2={x1} y1={y} y2={y} className="ul-chart-grid" /><text x={x0 - 6} y={y + 3.5} textAnchor="end" className="ul-chart-tick">{yFmt(v)}</text></g>; })}
      {xGrid ? xl.map((t) => <line key={'g' + t.v} x1={t.x} x2={t.x} y1={y0} y2={y1} className="ul-chart-grid" />) : null}
      <line x1={x0} x2={x1} y1={y1} y2={y1} className="ul-chart-axis-line" />
      {keep.map((t) => <text key={'x' + t.v} x={t.x} y={y1 + 15} textAnchor="middle" className="ul-chart-tick">{xFmt(t.v)}</text>)}
    </g>
  );
}
/** Left margin that fits the widest y tick label. */
export const leftFor = (labels: string[]) => Math.ceil(Math.max(18, ...labels.map((s) => s.length * 6.4)) + 10);

/* ---------- brush (scatter rect, time-series range) ---------- */
export interface BrushRect { x0: number; y0: number; x1: number; y1: number }
/**
 * Drag selection drawn straight to the DOM (no React state per move). mode 'x' spans the plot height.
 * The readout uses the opaque value-tooltip shape (nothing inside the panel samples glass). Esc cancels.
 */
export function useBrush(o: { mode: 'x' | 'xy'; plot: Box; W: number; H: number; enabled?: boolean; label: (r: BrushRect) => string; onEnd: (r: BrushRect | null) => void; minPx?: number }) {
  const ref = React.useRef(o); ref.current = o;
  const box = React.useRef<HTMLDivElement | null>(null), read = React.useRef<HTMLSpanElement | null>(null);
  const st = React.useRef({ down: null as null | [number, number], active: false, ended: 0, r: null as BrushRect | null, pid: -1 });
  const api = React.useMemo(() => {
    const clampR = (x: number, y: number): [number, number] => { const { plot, W, H } = ref.current; return [Math.max(plot.l, Math.min(W - plot.r, x)), Math.max(plot.t, Math.min(H - plot.b, y))]; };
    const hide = () => { if (box.current) box.current.removeAttribute('data-on'); };
    const draw = (r: BrushRect) => {
      const el = box.current, rd = read.current; if (!el || !rd) return;
      const { mode, plot, H, W } = ref.current, x = Math.min(r.x0, r.x1), w = Math.abs(r.x1 - r.x0), y = mode === 'x' ? plot.t : Math.min(r.y0, r.y1), h = mode === 'x' ? H - plot.t - plot.b : Math.abs(r.y1 - r.y0);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; el.style.width = w.toFixed(1) + 'px'; el.style.height = h.toFixed(1) + 'px'; el.setAttribute('data-on', '');
      rd.textContent = ref.current.label(r);
      const rw = rd.offsetWidth, left = Math.max(-x + 2, Math.min(w / 2 - rw / 2, W - x - rw - 2));
      rd.style.transform = `translate3d(${left.toFixed(1)}px, 0, 0)`;
    };
    const local = (e: React.PointerEvent) => { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] as [number, number]; };
    return {
      cancel() { const s = st.current, was = s.active || !!s.down; s.down = null; s.active = false; s.r = null; hide(); return was; },
      /** True right after a brush ended (the click that follows is not a pin). */
      swallowClick() { return performance.now() - st.current.ended < 250; },
      get active() { return st.current.active; },
      bind: {
        onPointerDown: (e: React.PointerEvent) => { if (ref.current.enabled === false || e.button !== 0 || e.pointerType === 'touch') return; const [x, y] = local(e); const { plot, W, H } = ref.current; if (x < plot.l || x > W - plot.r || y < plot.t || y > H - plot.b) return; st.current.down = [x, y]; st.current.pid = e.pointerId; },
        onPointerMove: (e: React.PointerEvent) => {
          const s = st.current; if (!s.down) return false;
          const [x, y] = clampR(...local(e));
          if (!s.active && Math.hypot(x - s.down[0], y - s.down[1]) < (ref.current.minPx ?? 4)) return false;
          if (!s.active) { s.active = true; try { (e.currentTarget as HTMLElement).setPointerCapture(s.pid); } catch { /* ignore */ } }
          s.r = { x0: s.down[0], y0: s.down[1], x1: x, y1: y }; draw(s.r); return true;
        },
        onPointerUp: () => { const s = st.current; if (!s.down) return; const r = s.active ? s.r : null; s.down = null; if (s.active) { s.active = false; s.ended = performance.now(); hide(); ref.current.onEnd(r); } },
      },
      layer: <div ref={box} className="ul-chart-brush" aria-hidden="true"><span ref={read} className="ul-chart-tip-body ul-chart-brush-read"></span></div>,
    };
  }, []);
  return api;
}

/* ---------- colour scales (heatmap, calendar, treemap) ---------- */
export type ColorScheme = 'sequential' | 'diverging';
export interface ColorScale { q(v: number | null | undefined): number; lo: number; hi: number; edges: number[]; scheme: ColorScheme; steps: number }
/** Quantised, colour-blind-safe scale over the --ul-chart-seq-* / --ul-chart-div-* tokens (7 steps). Diverging is symmetric around mid. */
export function colorScale(values: (number | null | undefined)[], scheme: ColorScheme = 'sequential', domain?: [number, number], mid = 0, steps = 7): ColorScale {
  let lo = Infinity, hi = -Infinity; for (const v of values) if (v != null && Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (domain) [lo, hi] = domain; if (!Number.isFinite(lo)) { lo = 0; hi = 1; } if (hi === lo) hi = lo + 1;
  if (scheme === 'diverging') { const m = Math.max(Math.abs(lo - mid), Math.abs(hi - mid)) || 1; lo = mid - m; hi = mid + m; }
  const edges = Array.from({ length: steps + 1 }, (_, k) => lo + ((hi - lo) * k) / steps);
  return { lo, hi, edges, scheme, steps, q: (v) => (v == null || !Number.isFinite(v) ? -1 : Math.max(0, Math.min(steps - 1, Math.floor(((v - lo) / (hi - lo)) * steps)))) };
}
export function ColorLegend({ scale, fmt: fmt0, label, locale }: { scale: ColorScale; fmt: (v: number) => string; label: string; locale?: string }) {
  const mid = Math.floor(scale.steps / 2), fmt = (v: number) => fmt0(Math.abs(scale.hi - scale.lo) >= 10 ? Math.round(v) : +v.toPrecision(3));
  return (
    <div className="ul-chart-scale" role="img" aria-label={`${label}: ${fmt(scale.lo)} – ${fmt(scale.hi)}`}>
      <span className="ul-chart-scale-t" aria-hidden="true">{advText('less', locale)}</span>
      <span className="ul-chart-scale-bar" aria-hidden="true">
        {Array.from({ length: scale.steps }, (_, k) => <span key={k} className="ul-chart-scale-sw" data-scheme={scale.scheme} data-q={k}>{k === 0 || k === mid || k === scale.steps - 1 ? <span className="ul-chart-scale-n" data-at={k === 0 ? 's' : k === mid ? 'm' : 'e'}>{fmt(k === 0 ? scale.lo : k === mid ? (scale.scheme === 'diverging' ? (scale.lo + scale.hi) / 2 : scale.edges[mid]) : scale.hi)}</span> : null}</span>)}
      </span>
      <span className="ul-chart-scale-t" aria-hidden="true">{advText('more', locale)}</span>
    </div>
  );
}
/** ONE flattened hover indicator (ring) shared by every cell / bar / tile: a single element moved by transform. Never glass. */
export function useCellIndicator() {
  const el = React.useRef<HTMLSpanElement | null>(null);
  return React.useMemo(() => ({
    place(r: { x: number; y: number; w: number; h: number; rx?: number } | null) { const s = el.current; if (!s) return; if (!r) { s.removeAttribute('data-on'); return; } s.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`; s.style.width = r.w.toFixed(1) + 'px'; s.style.height = r.h.toFixed(1) + 'px'; s.style.borderRadius = (r.rx ?? 4) + 'px'; s.setAttribute('data-on', ''); },
    layer: <span ref={el} className="ul-chart-cellind" aria-hidden="true"></span>,
  }), []);
}

/** Stroke arc (angles in radians, 0 = 12 o'clock, clockwise). */
export function arcStroke(cx: number, cy: number, r: number, a0: number, a1: number) {
  const span = Math.max(0, a1 - a0); if (span <= 1e-4) return '';
  if (span >= Math.PI * 2 - 1e-4) a1 = a0 + Math.PI * 2 - 1e-3;
  const p = (a: number) => `${(cx + Math.sin(a) * r).toFixed(2)} ${(cy - Math.cos(a) * r).toFixed(2)}`;
  return `M${p(a0)}A${r.toFixed(2)} ${r.toFixed(2)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
}
export const polar = (cx: number, cy: number, r: number, a: number) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r] as [number, number];
/* Text for the advanced chart types (EN / SK / DE / CS). {n} = number placeholder. */
const A = {
  en: { min: 'Minimum', max: 'Maximum', target: 'Target', compare: 'Comparison', value: 'Value', axis: 'Axis', x: 'X', y: 'Y', size: 'Size', trend: 'Trend', selected: '{n} points selected', step: 'Step', conversion: 'Conversion', dropoff: 'Drop-off', of: 'of first step', bin: 'Range', count: 'Count', bins: 'Bins', all: 'All', path: 'Path', reset: 'Reset zoom', zin: 'Zoom in', zout: 'Zoom out', range: 'Selected range', live: 'Live', paused: 'Paused', newPts: '{n} new points', resume: 'Resume', overview: 'Overview', row: 'Row', col: 'Column', less: 'Less', more: 'More', band: 'Band', share: 'Share', gaugeNav: 'Arrow keys move between the value, target and threshold bands.', zoomNav: 'Plus and minus zoom, Shift and arrows pan, 0 resets. Ctrl or Cmd with the wheel zooms.', stale: 'Stream stopped', points: 'points', from: 'From', to: 'To', drill: 'Enter opens the group, Backspace goes up.' },
  sk: { min: 'Minimum', max: 'Maximum', target: 'Cieľ', compare: 'Porovnanie', value: 'Hodnota', axis: 'Os', x: 'X', y: 'Y', size: 'Veľkosť', trend: 'Trend', selected: 'Vybrané body: {n}', step: 'Krok', conversion: 'Konverzia', dropoff: 'Odpad', of: 'z prvého kroku', bin: 'Rozsah', count: 'Počet', bins: 'Intervaly', all: 'Všetko', path: 'Cesta', reset: 'Zrušiť priblíženie', zin: 'Priblížiť', zout: 'Oddialiť', range: 'Vybraný rozsah', live: 'Naživo', paused: 'Pozastavené', newPts: 'Nové body: {n}', resume: 'Pokračovať', overview: 'Prehľad', row: 'Riadok', col: 'Stĺpec', less: 'Menej', more: 'Viac', band: 'Pásmo', share: 'Podiel', gaugeNav: 'Šípky presúvajú medzi hodnotou, cieľom a pásmami.', zoomNav: 'Plus a mínus približujú, Shift so šípkami posúva, 0 obnoví. Ctrl alebo Cmd s kolieskom približuje.', stale: 'Prúd dát sa zastavil', points: 'bodov', from: 'Od', to: 'Do', drill: 'Enter otvorí skupinu, Backspace ide o úroveň vyššie.' },
  de: { min: 'Minimum', max: 'Maximum', target: 'Ziel', compare: 'Vergleich', value: 'Wert', axis: 'Achse', x: 'X', y: 'Y', size: 'Größe', trend: 'Trend', selected: '{n} Punkte ausgewählt', step: 'Schritt', conversion: 'Konversion', dropoff: 'Abbruch', of: 'vom ersten Schritt', bin: 'Bereich', count: 'Anzahl', bins: 'Klassen', all: 'Alle', path: 'Pfad', reset: 'Zoom zurücksetzen', zin: 'Vergrößern', zout: 'Verkleinern', range: 'Ausgewählter Bereich', live: 'Live', paused: 'Pausiert', newPts: '{n} neue Punkte', resume: 'Fortsetzen', overview: 'Übersicht', row: 'Zeile', col: 'Spalte', less: 'Weniger', more: 'Mehr', band: 'Band', share: 'Anteil', gaugeNav: 'Pfeiltasten wechseln zwischen Wert, Ziel und Schwellenbändern.', zoomNav: 'Plus und Minus zoomen, Umschalt mit Pfeilen verschiebt, 0 setzt zurück. Strg oder Cmd mit dem Mausrad zoomt.', stale: 'Datenstrom gestoppt', points: 'Punkte', from: 'Von', to: 'Bis', drill: 'Enter öffnet die Gruppe, Rücktaste geht eine Ebene hoch.' },
  cs: { min: 'Minimum', max: 'Maximum', target: 'Cíl', compare: 'Srovnání', value: 'Hodnota', axis: 'Osa', x: 'X', y: 'Y', size: 'Velikost', trend: 'Trend', selected: 'Vybrané body: {n}', step: 'Krok', conversion: 'Konverze', dropoff: 'Odpad', of: 'z prvního kroku', bin: 'Rozsah', count: 'Počet', bins: 'Intervaly', all: 'Vše', path: 'Cesta', reset: 'Zrušit přiblížení', zin: 'Přiblížit', zout: 'Oddálit', range: 'Vybraný rozsah', live: 'Živě', paused: 'Pozastaveno', newPts: 'Nové body: {n}', resume: 'Pokračovat', overview: 'Přehled', row: 'Řádek', col: 'Sloupec', less: 'Méně', more: 'Více', band: 'Pásmo', share: 'Podíl', gaugeNav: 'Šipky přesouvají mezi hodnotou, cílem a pásmy.', zoomNav: 'Plus a mínus přibližují, Shift se šipkami posouvá, 0 obnoví. Ctrl nebo Cmd s kolečkem přibližuje.', stale: 'Proud dat se zastavil', points: 'bodů', from: 'Od', to: 'Do', drill: 'Enter otevře skupinu, Backspace jde o úroveň výš.' },
};
export type AdvTextKey = keyof typeof A.en;
export const advText = (k: AdvTextKey, locale?: string, n?: number | string) => { return A[chartLocale(locale)][k].replace('{n}', n == null ? '' : String(n)); };
export const cssTok = (k: string, f: number) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
