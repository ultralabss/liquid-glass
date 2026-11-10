/**
 * ULCartesianChart: line, area (stacked / percent), bar (grouped / stacked / horizontal) and combo (bars + line, dual axis)
 * on the shared chart core. Wrappers: ULLineChart, ULAreaChart, ULBarChart, ULComboChart. Legacy ULChart maps onto it.
 */
import * as React from 'react';
import type { Accent } from '../glass/accent.tsx';
import type { ContextMenuProps } from '../components/ULContainers/contextTarget.tsx';
import { useDomId } from '../components/shared/icons.tsx';
import { scaleLinear, scaleLog, scaleBand, scalePoint, scaleTime, niceDomain, logDomain, linePath, areaPath, makeNumberFormat, makeTimeFormat, type Pt } from './scales.ts';
import { ChartFrame, ChartLegend, ChartPatterns, SERIES_DASH, slotOf, chartText, useWidth, useChartTween, useDrawIn, useChangeFade, useHoverLayer, withChartMenu, splitChartCtx, SeriesKey, usePatternPolicy, type PatternMode, type ChartState, type HoverPoint } from './core.tsx';
import { lttb, canvasThreshold } from './decimate.ts';
import type { TimeRangeValue } from '../components/dashboard/blocks.tsx';

export interface ChartSeriesDef<T> {
  key: string; name: string;
  value: (d: T, i: number) => number | null | undefined;
  /** Mark type (combo charts mix them). Default: the chart kind. */
  type?: 'line' | 'area' | 'bar';
  /** Value axis. 'right' turns on the second axis (combo). */
  axis?: 'left' | 'right';
  /** Palette slot 0–5 (colour + dash/pattern). Default: series index. */
  slot?: number;
}
export type ChartTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export interface ChartReference { value: number; label?: string; axis?: 'left' | 'right'; tone?: ChartTone }
export interface ChartThreshold { from: number; to: number; label?: string; axis?: 'left' | 'right'; tone?: ChartTone }
export interface ChartAxisConfig { label?: string; format?: (v: number) => string; min?: number; max?: number }
/** Context-menu payload: data point, series (legend chip) or plot background. */
export interface ChartPointTarget { index?: number; label?: string; series?: string; values?: { series: string; value: number | null }[] }

export interface ULCartesianChartProps<T = Record<string, unknown>> extends ContextMenuProps<ChartPointTarget> {
  /** Rows. */ data: T[];
  /** X accessor (d, i). */ x: (d: T, i: number) => string | number | Date;
  /** Series definitions ({ key, name, value, color?, dash? }). */ series: ChartSeriesDef<T>[];
  /** "line" | "area" | "bar". */ kind?: 'line' | 'area' | 'bar';
  /** "none" (default) | "stacked" | "percent". */ stack?: 'none' | 'stacked' | 'percent';
  /** "vertical" (default) | "horizontal" (bars). */ orientation?: 'vertical' | 'horizontal';
  /** "monotone" (default) | "linear". */ curve?: 'monotone' | 'linear';
  /** "category" (default) | "time" (enables zoom / brush with onRangeChange). */ xScale?: 'category' | 'time';
  /** "linear" (default) | "log". */ yScale?: 'linear' | 'log';
  /** Reference lines ({ value, label, tone? }). */ references?: ChartReference[];
  /** Threshold lines / bands ({ value, label?, tone }). */ thresholds?: ChartThreshold[];
  /** Axis options per axis ({ x?, y? }: label, ticks, min, max, format). */ axes?: { x?: Omit<ChartAxisConfig, 'min' | 'max'>; left?: ChartAxisConfig; right?: ChartAxisConfig };
  /** Chart title (panel heading, names the figure). */ title: React.ReactNode;
  /** Short description under the title. */ description?: React.ReactNode;
  /** Screen-reader summary. Default: generated per series (first → last, lowest, highest). */
  summary?: string;
  /** Plot height in px. */ height?: number;
  /** "en" | "sk" | "de" | "cs" for numbers, dates and built-in strings. Default "en". */ locale?: string;
  /** Intl options for values (tooltip, table). Axis ticks use compact notation automatically from 10 000. */
  valueFormat?: Intl.NumberFormatOptions;
  /** Formats values for ticks, tooltip and table: Intl options or (v) => string. */ format?: (v: number, seriesKey: string) => string;
  /** Accent colour of the panel; series colours derive from it (--ul-chart-s0…s5). */ accent?: Accent;
  /** Wrap in the one glass chart panel. Default true; false for embedding in another surface. */ panel?: boolean;
  /** Extra class on the panel. */ className?: string;
  /** Show the legend (toggles series). Default true for more than one series. */ legend?: boolean;
  /** Show the toolbar (table, copy, CSV). Default true. */ toolbar?: boolean;
  /** Base file name of the CSV export. */ filename?: string;
  /** Static point beads: auto = only when ≤ 40 points. The hover bead always shows. */
  beads?: 'auto' | 'always' | 'never';
  /** "ready" | "loading" | "empty" | "error" — skeleton, empty and error states keep the panel size. */ state?: ChartState;
  /** Error state Retry action. */ onRetry?: () => unknown;
  /** Error state text. Default localised. */ errorMessage?: React.ReactNode;
  /** Empty state content. Default localised "No data". */ empty?: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode };
  /** Stale badge (true or a custom label) when the data is old. */ stale?: boolean | string;
  /** Open with the data table shown. Default false. */ defaultTable?: boolean;
  /** Called with { series, index, row } when a point / bar is activated (click, Enter). */ onPointClick?: (t: ChartPointTarget) => void;
  /** Secondary cues. auto (default): dash for series 3+, fill patterns only with > 4 series or high-contrast mode. on | off. */
  patterns?: PatternMode;
  /** Zoom, pan and range brush (line / area / bar). true = brush + wheel (Ctrl / Cmd) + pinch + keyboard; overview adds the mini strip. */
  zoom?: boolean | { brush?: boolean; overview?: boolean };
  /** Controlled view range (time: Date / ms; category: index). null = full. */
  range?: { from: Date | number; to: Date | number } | null;
  /** Fires on brush end, zoom / pan settle and reset (null). Same shape as ULTimeRange's value (preset 'custom'). */
  onRangeChange?: (r: TimeRangeValue | null) => void;
  /** Highlight a data index from outside (e.g. a hovered table row): shows the tooltip unless the user pinned one. */
  highlight?: number | null;
  /** auto (default): canvas above --ul-chart-canvas-at points (line / area only). */
  renderer?: 'auto' | 'svg' | 'canvas';
  /** LTTB decimation for drawing when points exceed the plot pixels (tooltip and table keep every point). Default true. */
  decimate?: boolean;
  /** Time domain override (streaming window). */
  xDomain?: [number, number];
  /** Pulsing bead on the latest point (streaming). */
  liveBead?: boolean;
  /** false: data changes jump (streaming windows, zoom steps). Draw-in on mount still runs. */
  animate?: boolean;
}
/** Internal: what the zoom / stream wrappers inject into the body. */
export interface ChartInteraction {
  bind?: Record<string, (e: never) => unknown>;
  layer?: React.ReactNode;
  onKey?: (e: React.KeyboardEvent) => boolean;
  onGeom?: (g: { l: number; r: number; t: number; b: number; iw: number; ih: number; W: number; H: number; el: HTMLDivElement | null; band: boolean; step: number }) => void;
  footer?: React.ReactNode;
  indexOffset?: number;
  tools?: React.ReactNode;
}

const TONE: Record<ChartTone, string> = { neutral: 'var(--ul-chart-ref-neutral)', accent: 'var(--ul-chart-s0)', success: 'var(--ul-chart-ref-success)', warning: 'var(--ul-chart-ref-warning)', danger: 'var(--ul-chart-ref-danger)' };
const keyOfData = <T,>(data: T[], series: ChartSeriesDef<T>[], x: ULCartesianChartProps<T>['x']) => {
  let h = data.length + ':' + series.map((s) => s.key).join(',');
  for (let i = 0; i < data.length; i++) { const xv = x(data[i], i); h += '|' + (xv instanceof Date ? xv.getTime() : xv); for (const s of series) h += ',' + (s.value(data[i], i) ?? 'n'); }
  return h;
};

export function ULCartesianChart<T>(props: ULCartesianChartProps<T>) {
  if (props.zoom) return <ZoomHost {...props} />;
  return <CartesianBody {...props} />;
}
let ZoomHost: <T>(p: ULCartesianChartProps<T>) => React.ReactElement = () => { throw new Error('zoom module missing'); };
/** Set by timeseries.tsx (keeps this file free of the zoom code path when unused). */
export const registerZoomHost = (c: typeof ZoomHost) => { ZoomHost = c; };

export function CartesianBody<T>(props: ULCartesianChartProps<T> & { ix?: ChartInteraction }) {
  const [ctx, p] = splitChartCtx(props);
  const ix = p.ix, off = ix?.indexOffset ?? 0;
  const { data, x, series, kind = 'line', stack = 'none', orientation = 'vertical', curve = 'monotone', xScale = 'category', yScale = 'linear', references = [], thresholds = [], axes = {}, title, locale } = p;
  const id = useDomId('ul-cc');
  const L = (k: Parameters<typeof chartText>[0]) => chartText(k, locale);
  const H = p.height ?? 260, horiz = orientation === 'horizontal';
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const [hidden, setHidden] = React.useState<string[]>([]);
  const n = data.length;
  const typeOf = (s: ChartSeriesDef<T>) => s.type ?? kind;
  const slot = (s: ChartSeriesDef<T>, i: number) => slotOf(s.slot ?? i);
  const pol = usePatternPolicy(p.patterns, series.length);
  const dashOf = (s: ChartSeriesDef<T>, i: number) => pol.dash(slot(s, i), i);
  const hasBars = series.some((s) => typeOf(s) === 'bar'), hasRight = series.some((s) => s.axis === 'right');
  const isTime = (xScale === 'time' || !!p.xDomain) && !hasBars && !horiz;
  const xsRaw = React.useMemo(() => data.map((d, i) => x(d, i)), [data]);
  const xNum = xsRaw.map((v) => (v instanceof Date ? v.getTime() : typeof v === 'number' ? v : NaN));
  const spanMs = isTime ? Math.max(...xNum) - Math.min(...xNum) : 0;
  const xLabel = React.useMemo(() => {
    if (axes.x?.format) return (i: number) => axes.x!.format!(xNum[i]);
    if (isTime || xsRaw[0] instanceof Date) { const f = makeTimeFormat(locale, spanMs || 864e5 * 30); return (i: number) => f(xNum[i]); }
    return (i: number) => String(xsRaw[i] ?? '');
  }, [xsRaw, locale, isTime]);
  const fullFmt = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fmt = (v: number | null | undefined, k: string) => (v == null ? '–' : p.format ? p.format(v, k) : fullFmt(v));

  /* ---------- target (data space) ---------- */
  const dataKey = React.useMemo(() => keyOfData(data, series, x), [data, series]);
  const raw = React.useMemo(() => series.map((s) => data.map((d, i) => { const v = s.value(d, i); return v == null || !Number.isFinite(v) ? null : v; })), [dataKey]);
  const weights = series.map((s) => (hidden.includes(s.key) ? 0 : 1));
  const stackOf = (rows: (number | null)[][], w: number[]) => {
    // returns [base, top] per series per point, stacking series of the same type + axis
    const out = rows.map((r) => r.map(() => [0, 0] as [number, number] | null));
    const groups = new Map<string, number[]>();
    series.forEach((s, si) => { const g = stack === 'none' || typeOf(s) === 'line' && kind !== 'line' ? `solo${si}` : `${typeOf(s)}|${s.axis ?? 'left'}`; groups.set(g, [...(groups.get(g) ?? []), si]); });
    for (const idx of groups.values()) {
      for (let i = 0; i < n; i++) {
        let tot = 0; if (stack === 'percent' && idx.length > 1) for (const si of idx) tot += Math.max(0, rows[si][i] ?? 0) * w[si];
        let pos = 0, neg = 0;
        for (const si of idx) {
          const v0 = rows[si][i]; if (v0 == null) { out[si][i] = null; continue; }
          const v = (stack === 'percent' && idx.length > 1 ? (tot ? (v0 / tot) * 100 : 0) : v0) * (idx.length > 1 ? w[si] : 1);
          if (idx.length === 1) { out[si][i] = [0, v]; continue; }
          if (v >= 0) { out[si][i] = [pos, pos + v]; pos += v; } else { out[si][i] = [neg, neg + v]; neg += v; }
        }
      }
    }
    return out;
  };
  const domainFor = (rows: (number | null)[][], w: number[]) => {
    const st = stackOf(rows, w), ext = { left: [Infinity, -Infinity], right: [Infinity, -Infinity] } as Record<'left' | 'right', number[]>;
    series.forEach((s, si) => { if (!w[si]) return; const a = ext[s.axis ?? 'left'], base = typeOf(s) === 'bar' || stack !== 'none'; st[si].forEach((bt) => { if (!bt) return; a[0] = Math.min(a[0], base ? Math.min(bt[0], bt[1]) : bt[1]); a[1] = Math.max(a[1], base ? Math.max(bt[0], bt[1]) : bt[1]); }); });
    for (const r of references) { const a = ext[r.axis ?? 'left']; a[0] = Math.min(a[0], r.value); a[1] = Math.max(a[1], r.value); }
    const fin = (side: 'left' | 'right'): [number, number] => {
      let [lo, hi] = ext[side]; if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
      const cfg = axes[side];
      if (stack === 'percent') return [0, 100];
      if (yScale === 'log') return logDomain(cfg?.min ?? lo, cfg?.max ?? hi);
      if (hasBars || kind === 'area') { lo = Math.min(0, lo); hi = Math.max(0, hi); }
      const nd = niceDomain(cfg?.min ?? lo, cfg?.max ?? hi, horiz ? 6 : Math.max(2, Math.floor(H / 46))); return [cfg?.min ?? nd[0], cfg?.max ?? nd[1]];
    };
    return [...fin('left'), ...fin('right')];
  };
  const target = React.useMemo(() => ({ v: raw, w: weights, d: domainFor(raw, weights) }), [dataKey, hidden.join(), stack, yScale]);
  const { frame } = useChartTween(target, `${dataKey}#${hidden.join()}#${stack}#${yScale}`, p.animate !== false);
  useChangeFade(svgRef, dataKey);

  /* ---------- geometry ---------- */
  const axisFmt = (side: 'left' | 'right') => {
    const cfg = axes[side]; if (cfg?.format) return cfg.format;
    if (stack === 'percent') { const f = makeNumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }); return (v: number) => f(v / 100); }
    const [lo, hi] = side === 'left' ? frame.d.slice(0, 2) : frame.d.slice(2, 4);
    const f = makeNumberFormat(locale, { ...p.valueFormat, maximumFractionDigits: Math.max(Math.abs(lo), Math.abs(hi)) < 10 ? 1 : 0 }, Math.max(Math.abs(lo), Math.abs(hi)) >= 10000);
    return (v: number) => f(v);
  };
  const fL = axisFmt('left'), fR = axisFmt('right');
  const mkY = (d0: number, d1: number, r: [number, number]) => (yScale === 'log' ? scaleLog([d0, d1], r) : scaleLinear([d0, d1], r));
  const pre = mkY(frame.d[0], frame.d[1], [0, 1]), ticksL = pre.ticks(Math.max(2, Math.floor((horiz ? W : H) / (horiz ? 90 : 46))));
  const ticksR = hasRight ? mkY(frame.d[2], frame.d[3], [0, 1]).ticks(ticksL.length) : [];
  const cw = 6.9, catMax = horiz ? Math.min(W * 0.34, Math.max(...data.map((_, i) => xLabel(i).length)) * cw + 12) : 0;
  const m = {
    l: horiz ? catMax : Math.max(30, Math.max(...ticksL.map((t) => fL(t).length)) * cw + 14),
    r: hasRight ? Math.max(30, Math.max(...ticksR.map((t) => fR(t).length)) * cw + 14) : horiz ? 16 : 10,
    t: 10, b: 24,
  };
  const iw = Math.max(10, W - m.l - m.r), ih = Math.max(10, H - m.t - m.b);
  const cat = hasBars || horiz ? scaleBand(n, horiz ? [m.t, m.t + ih] : [m.l, m.l + iw], n > 60 ? 0.12 : 0.24) : isTime ? null : scalePoint(n, [m.l, m.l + iw]);
  const tsc = isTime ? scaleTime(p.xDomain ?? [Math.min(...xNum), Math.max(...xNum)], [m.l, m.l + iw]) : null;
  const geoCb = ix?.onGeom; React.useLayoutEffect(() => { geoCb?.({ l: m.l, r: m.r, t: m.t, b: m.b, iw, ih, W, H, el: plotRef.current, band: !!cat && cat.kind === 'band', step: cat && cat.kind !== 'band' ? (cat as ReturnType<typeof scalePoint>).step : cat ? (cat as ReturnType<typeof scaleBand>).step : 0 }); });
  const catPos = (i: number) => (tsc ? tsc(xNum[i]) : cat!.kind === 'band' ? cat!(i) + (cat as ReturnType<typeof scaleBand>).bandwidth / 2 : cat!(i));
  const yL = mkY(frame.d[0], frame.d[1], horiz ? [m.l, m.l + iw] : [m.t + ih, m.t]);
  const yR = mkY(frame.d[2], frame.d[3], [m.t + ih, m.t]);
  const ys = (s: ChartSeriesDef<T>) => (s.axis === 'right' ? yR : yL);
  const st = stackOf(frame.v, frame.w);
  const barSeries = series.map((s, si) => ({ s, si })).filter(({ s }) => typeOf(s) === 'bar');
  const stackedBars = stack !== 'none';
  const bw = cat && cat.kind === 'band' ? cat.bandwidth : 0;
  const wSum = stackedBars ? 1 : barSeries.reduce((a, { si }) => a + frame.w[si], 0) || 1;
  const subOff = (si: number) => { if (stackedBars) return [0, bw]; let o = 0; for (const b of barSeries) { if (b.si === si) break; o += frame.w[b.si]; } return [(o / wSum) * bw, (frame.w[si] / wSum) * bw]; };

  /* ---------- table, summary ---------- */
  const table = React.useMemo(() => ({ columns: [axes.x?.label ?? L('category'), ...series.map((s) => s.name)], rows: data.map((_, i) => [xLabel(i), ...series.map((s, si) => fmt(raw[si][i], s.key))]) }), [dataKey, locale]);
  const summary = p.summary ?? series.filter((s) => !hidden.includes(s.key)).map((s) => { const si = series.indexOf(s); const vals = raw[si]; const idx = vals.map((v, i) => [v, i] as const).filter(([v]) => v != null) as [number, number][]; if (!idx.length) return ''; const lo = idx.reduce((a, b) => (b[0] < a[0] ? b : a)), hi = idx.reduce((a, b) => (b[0] > a[0] ? b : a)); return `${s.name}: ${L('from')} ${fmt(idx[0][0], s.key)} ${L('to')} ${fmt(idx[idx.length - 1][0], s.key)}, ${L('low')} ${fmt(lo[0], s.key)} (${xLabel(lo[1])}), ${L('high')} ${fmt(hi[0], s.key)} (${xLabel(hi[1])}).`; }).join(' ');

  /* ---------- hover / keyboard ---------- */
  const hover = useHoverLayer({ width: W, height: H, plot: { l: m.l, t: m.t, r: m.r, b: m.b }, orient: horiz ? 'h' : 'v', band: cat && cat.kind === 'band' ? cat.step : 0 });
  const kb = React.useRef({ s: -1 });
  const pointAt = (i: number): HoverPoint => {
    const vis = series.map((s, si) => ({ s, si })).filter(({ s }) => !hidden.includes(s.key));
    const only = kb.current.s >= 0 ? vis.filter(({ si }) => si === kb.current.s) : vis;
    const beads = only.flatMap(({ s, si }) => { const bt = st[si][i]; if (!bt) return []; const yv = ys(s)(bt[1]); if (typeOf(s) === 'bar') { const [o, w] = subOff(si); const c = (horiz ? cat!(i) : cat!(i)) + o + w / 2; return horiz ? [{ slot: slot(s, si), x: yv, y: c }] : [{ slot: slot(s, si), x: c, y: yv }]; } return [{ slot: slot(s, si), x: catPos(i), y: yv }]; });
    const c = catPos(i), ext = beads.length ? (horiz ? Math.max(...beads.map((b) => b.x)) : Math.min(...beads.map((b) => b.y))) : horiz ? m.l : m.t + ih / 2;
    return { index: i, x: horiz ? ext : c, y: horiz ? c : ext, title: xLabel(i), beads: beads.filter((_, k) => typeOf(only[k].s) !== 'bar' || kb.current.s >= 0), rows: only.map(({ s, si }) => ({ slot: slot(s, si), name: s.name, value: fmt(raw[si][i], s.key) + (stack === 'percent' && st[si][i] ? ` · ${Math.round(st[si][i]![1] - st[si][i]![0])} %` : ''), mark: typeOf(s) === 'line' ? 'line' : 'fill', dash: dashOf(s, si) })) };
  };
  const latest = React.useRef(pointAt); latest.current = pointAt;
  const geo = React.useRef({ left: 0, top: 0 }), raf = React.useRef(0), pend = React.useRef<[number, number] | null>(null);
  const idxFromLocal = (lx: number, ly: number) => {
    if (horiz) return (cat as ReturnType<typeof scaleBand>).invert(ly);
    if (tsc) { const t = tsc.invert(lx); let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xNum[mid] < t) lo = mid; else hi = mid; } return Math.abs(xNum[hi] - t) < Math.abs(xNum[lo] - t) ? hi : lo; }
    return cat!.invert(lx);
  };
  const measure = () => { const r = plotRef.current?.getBoundingClientRect(); if (r) geo.current = { left: r.left, top: r.top }; };
  const onMove = (e: React.PointerEvent) => {
    if (hover.pinned || !n) return;
    pend.current = [e.clientX, e.clientY];
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = 0; const q = pend.current; if (!q) return; hover.show(latest.current(idxFromLocal(q[0] - geo.current.left, q[1] - geo.current.top))); });
  };
  const onLeave = () => { cancelAnimationFrame(raf.current); raf.current = 0; pend.current = null; if (!hover.pinned) hover.show(null); };
  const announce = (i: number) => { const pt = latest.current(i); if (liveRef.current) liveRef.current.textContent = `${pt.title}: ${pt.rows.map((r) => `${r.name} ${r.value}`).join(', ')}${hover.pinned ? ` (${L('pinned')})` : ''}`; };
  const setFocusSeries = (k: string | null) => { const si = k == null ? -1 : series.findIndex((s) => s.key === k); if (svgRef.current) { if (si >= 0) svgRef.current.dataset.focus = String(slot(series[si], si)); else delete svgRef.current.dataset.focus; } };
  const onKey = (e: React.KeyboardEvent) => {
    if (ix?.onKey?.(e)) return;
    if (!n) return;
    const vis = series.map((_, si) => si).filter((si) => !hidden.includes(series[si].key));
    let i = hover.index ?? -1, handled = true;
    const nextK = horiz ? ['ArrowDown', 'ArrowUp'] : ['ArrowRight', 'ArrowLeft'], serK = horiz ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    if (e.key === nextK[0]) i = Math.min(n - 1, i + 1);
    else if (e.key === nextK[1]) i = i < 0 ? n - 1 : Math.max(0, i - 1);
    else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n - 1;
    else if (serK.includes(e.key)) { const pos = vis.indexOf(kb.current.s), d = e.key === serK[0] ? 1 : -1; const np = pos + d; kb.current.s = np < 0 || np >= vis.length ? -1 : vis[np]; setFocusSeries(kb.current.s >= 0 ? series[kb.current.s].key : null); if (i < 0) i = 0; }
    else if (e.key === 'Enter' || e.key === ' ') { if (i < 0) i = 0; hover.pin(!hover.pinned); }
    else if (e.key === 'Escape') { if (hover.pinned) { hover.pin(false); } else handled = false; kb.current.s = -1; setFocusSeries(null); hover.show(null); if (liveRef.current) liveRef.current.textContent = ''; if (handled) e.preventDefault(); return; }
    else handled = false;
    if (!handled) return;
    e.preventDefault(); hover.show(latest.current(i)); announce(i);
  };
  const onDown = (e: React.PointerEvent) => {
    measure();
    if (e.pointerType === 'touch') { const i = idxFromLocal(e.clientX - geo.current.left, e.clientY - geo.current.top); if (hover.index === i && hover.pinned) { hover.pin(false); hover.show(null); } else { hover.pin(true); hover.show(latest.current(i)); } }
  };
  const onClick = (e: React.MouseEvent) => {
    if ((e.nativeEvent as PointerEvent).pointerType === 'touch') return;
    const i = idxFromLocal(e.clientX - geo.current.left, e.clientY - geo.current.top);
    if (hover.pinned) { hover.pin(false); onMove(e as unknown as React.PointerEvent); return; }
    hover.show(latest.current(i)); hover.pin(true);
    p.onPointClick?.({ index: i + off, label: xLabel(i), values: series.map((s, si) => ({ series: s.name, value: raw[si][i] })) });
  };
  React.useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && hover.pinned) { hover.pin(false); hover.show(null); } }; document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, []);
  React.useEffect(() => { if (hover.index != null) { const i = Math.min(hover.index, n - 1); if (i >= 0) hover.show(latest.current(i)); else hover.show(null); } }, [W, frame]);
  const hl = p.highlight == null ? null : p.highlight - off;
  React.useEffect(() => { if (hover.pinned || p.highlight === undefined) return; hover.show(hl != null && hl >= 0 && hl < n ? latest.current(hl) : null); }, [hl]);
  useDrawIn(svgRef, horiz);

  /* ---------- marks ---------- */
  const showBeads = p.beads === 'always' || (p.beads !== 'never' && n <= 40 && !hasBars);
  const canvasOn = !hasBars && !horiz && (p.renderer === 'canvas' || (p.renderer !== 'svg' && n > canvasThreshold()));
  const keep = React.useMemo(() => (p.decimate === false || hasBars || horiz || n <= iw * 2 ? null : lttb(xNum.length === n && isTime ? xNum : data.map((_, i) => i), raw[0] ?? [], Math.max(64, Math.round(iw * 2)))), [dataKey, iw, isTime, p.decimate]);
  const pick = <V,>(arr: V[]): V[] => (keep ? keep.map((k) => arr[k]) : arr);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const canvasMarks: { sl: number; top: Pt[]; base: Pt[] | null; dash: string; op: number }[] = [];
  const marks = { areas: [] as React.ReactNode[], bars: [] as React.ReactNode[], lines: [] as React.ReactNode[], beads: [] as React.ReactNode[] };
  series.forEach((s, si) => {
    const sl = slot(s, si), t = typeOf(s), y = ys(s), wv = frame.w[si];
    if (wv <= 0.001 && t !== 'bar') return;
    const op = t === 'bar' ? 1 : wv;
    if (t === 'bar') {
      const [o, w] = subOff(si); if (w < 0.5) return;
      marks.bars.push(<g key={s.key} className="ul-chart-bset" data-s={sl}>{st[si].map((bt, i) => {
        if (!bt) return null;
        const a = y(bt[0]), b = y(bt[1]), lo = Math.min(a, b), len = Math.abs(b - a); if (len < 0.3) return null;
        const c0 = cat!(i) + o + (stackedBars ? 0 : 0.75), thick = Math.max(1, w - (stackedBars ? 0 : 1.5)), r = Math.min(5, thick / 3, len / 2);
        const rect = horiz ? { x: lo, y: c0, width: len, height: thick } : { x: c0, y: lo, width: thick, height: len };
        const neg = bt[1] < bt[0];
        const hi = horiz ? { x: neg ? lo + 1.5 : lo + len - Math.min(6, len - 2) - 1.5, y: c0 + 1.5, width: Math.min(6, Math.max(0, len - 2)), height: Math.max(0, thick - 3) } : { x: c0 + 1.5, y: neg ? lo + len - Math.min(6, len - 2) - 1.5 : lo + 1.5, width: Math.max(0, thick - 3), height: Math.min(6, Math.max(0, len - 2)) };
        return <g key={i}><rect {...rect} rx={r} className="ul-chart-bar2" fill={`url(#${id}-g${sl})`} />{sl && pol.fills ? <rect {...rect} rx={r} className="ul-chart-hatch" fill={`url(#${id}-p${sl})`} /> : null}<rect {...hi} rx={Math.min(2.5, r)} className="ul-chart-bar2-hi" /></g>;
      })}</g>);
      return;
    }
    const top: Pt[] = pick(st[si].map((bt, i) => (bt ? [catPos(i), y(bt[1])] : null)));
    const baseOf = (): Pt[] => pick(st[si].map((bt, i) => (bt ? [catPos(i), y(stack === 'none' ? Math.max(frame.d[s.axis === 'right' ? 2 : 0], Math.min(0, frame.d[s.axis === 'right' ? 3 : 1])) : bt[0])] : null)));
    if (canvasOn) { canvasMarks.push({ sl, top, base: t === 'area' ? baseOf() : null, dash: dashOf(s, si), op }); return; }
    if (t === 'area') {
      const base: Pt[] = baseOf();
      marks.areas.push(<g key={s.key} data-s={sl} style={{ opacity: op }}><path d={areaPath(top, base, curve)} className="ul-chart-area2" fill={`url(#${id}-a${sl})`} />{sl && pol.fills ? <path d={areaPath(top, base, curve)} className="ul-chart-hatch" fill={`url(#${id}-p${sl})`} /> : null}</g>);
    }
    const dsh = dashOf(s, si);
    marks.lines.push(dsh
      ? <path key={s.key} data-s={sl} data-dash="" d={linePath(top, curve)} className="ul-chart-ln" strokeDasharray={dsh} style={{ opacity: op }} fill="none" />
      : <path key={s.key} data-s={sl} d={linePath(top, curve)} className="ul-chart-ln" pathLength={1} strokeDasharray="1 0" style={{ opacity: op }} fill="none" />);
    if (showBeads) marks.beads.push(<g key={s.key} data-s={sl} style={{ opacity: op }}>{top.map((pt, i) => (pt ? <circle key={i} cx={pt[0]} cy={pt[1]} r="2.6" className="ul-chart-dot2" /> : null))}</g>);
  });
  const slots = Array.from(new Set(series.map((s, si) => slot(s, si))));
  React.useLayoutEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const cs = getComputedStyle(cv), sw = parseFloat(cs.getPropertyValue('--ul-chart-stroke')) || 2, ao = parseFloat(cs.getPropertyValue('--ul-chart-area')) || 0.22;
    for (const mk of canvasMarks) {
      const col = cs.getPropertyValue(`--ul-chart-s${mk.sl}`).trim() || '#fff';
      const run = (cb: (x: number, y: number, first: boolean) => void) => { let first = true; for (const q of mk.top) { if (!q) { first = true; continue; } cb(q[0], q[1], first); first = false; } };
      g.globalAlpha = mk.op;
      if (mk.base) { g.beginPath(); let started = false; run((x, y, f) => { if (f && started) { /* gap: close and restart */ } if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y); }); for (let k = mk.base.length - 1; k >= 0; k--) { const q = mk.base[k]; if (q) g.lineTo(q[0], q[1]); } g.closePath(); g.fillStyle = col; g.globalAlpha = mk.op * ao; g.fill(); g.globalAlpha = mk.op; }
      g.beginPath(); run((x, y, f) => (f ? g.moveTo(x, y) : g.lineTo(x, y))); g.strokeStyle = col; g.lineWidth = sw; g.lineJoin = 'round'; g.lineCap = 'round'; g.setLineDash(mk.dash ? mk.dash.split(/[ ,]+/).map(Number) : []); g.stroke();
    }
    g.globalAlpha = 1;
  });
  const lastIdx = (() => { for (let i = n - 1; i >= 0; i--) if (raw[0]?.[i] != null) return i; return -1; })();
  const liveBead = p.liveBead && lastIdx >= 0 && st[0]?.[lastIdx] && !hidden.includes(series[0].key) ? { x: catPos(lastIdx), y: ys(series[0])(st[0][lastIdx]![1]), slot: slot(series[0], 0) } : null;
  const catTicks = (() => { if (tsc) return tsc.ticks(Math.max(2, Math.floor(iw / 80))).map((t) => ({ pos: tsc(t), text: makeTimeFormat(locale, spanMs)(t) })); const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((horiz ? ih / 20 : iw / 64))))); return data.map((_, i) => i).filter((i) => i % every === 0).map((i) => ({ pos: catPos(i), text: xLabel(i) })); })();
  const refY = (r: ChartReference | ChartThreshold, v: number) => (r.axis === 'right' ? yR : yL)(v);

  const plot = (
    <div className="ul-chart2-plotwrap">
      {hasRight || axes.left?.label ? (
        <div className="ul-chart2-axtitles" aria-hidden="true">
          <span className="ul-chart2-axt">{series.filter((s) => (s.axis ?? 'left') === 'left' && hasRight).map((s) => <SeriesKey key={s.key} slot={slot(s, series.indexOf(s))} mark={typeOf(s) === 'line' ? 'line' : 'fill'} dash={dashOf(s, series.indexOf(s))} pattern={pol.fills} />)}<span>{axes.left?.label}</span></span>
          {hasRight ? <span className="ul-chart2-axt" data-side="r"><span>{axes.right?.label}</span>{series.filter((s) => s.axis === 'right').map((s) => <SeriesKey key={s.key} slot={slot(s, series.indexOf(s))} mark={typeOf(s) === 'line' ? 'line' : 'fill'} dash={dashOf(s, series.indexOf(s))} pattern={pol.fills} />)}</span> : null}
        </div>
      ) : null}
      <div ref={plotRef} className="ul-chart2-plot" style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`}
        {...mergeBind({ onPointerEnter: measure, onPointerMove: onMove, onPointerLeave: onLeave, onPointerDown: onDown, onClick, onKeyDown: onKey, onFocus: measure, onBlur: () => { if (!hover.pinned) hover.show(null); kb.current.s = -1; setFocusSeries(null); } }, ix?.bind)}
        data-canvas={canvasOn ? '' : undefined}>
        <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="" className="ul-chart2-svg">
          <defs>
            {slots.map((sl) => <linearGradient key={sl} id={`${id}-a${sl}`} x1="0" y1="0" x2={horiz ? 1 : 0} y2={horiz ? 0 : 1}><stop offset="0" className="ul-chart-gstop" data-s={sl} data-at="a0" /><stop offset="1" className="ul-chart-gstop" data-s={sl} data-at="a1" /></linearGradient>)}
            {slots.map((sl) => <linearGradient key={'g' + sl} id={`${id}-g${sl}`} x1="0" y1={horiz ? 0 : 0} x2={horiz ? 1 : 0} y2={horiz ? 0 : 1}><stop offset="0" className="ul-chart-gstop" data-s={sl} data-at="b0" /><stop offset="1" className="ul-chart-gstop" data-s={sl} data-at="b1" /></linearGradient>)}
            <ChartPatterns id={id} />
          </defs>
          {thresholds.map((t, k) => { const lo0 = horiz ? m.l : m.t, hi0 = horiz ? m.l + iw : m.t + ih, cl = (v: number) => Math.max(lo0, Math.min(hi0, v)); const a = cl(refY(t, t.from)), b = cl(refY(t, t.to)); if (Math.abs(b - a) < 0.5) return null; const c = TONE[t.tone ?? 'neutral'], edges = [a, b].filter((v) => v > lo0 + 0.5 && v < hi0 - 0.5);
            return <g key={'t' + k} className="ul-chart-thr" style={{ color: c }}>{horiz ? <rect x={Math.min(a, b)} y={m.t} width={Math.abs(b - a)} height={ih} className="ul-chart-band" /> : <rect x={m.l} y={Math.min(a, b)} width={iw} height={Math.abs(b - a)} className="ul-chart-band" />}
              {edges.map((v, j) => (horiz ? <line key={j} x1={v} x2={v} y1={m.t} y2={m.t + ih} className="ul-chart-band-edge" /> : <line key={j} x1={m.l} x2={m.l + iw} y1={v} y2={v} className="ul-chart-band-edge" />))}</g>; })}
          <g className="ul-chart-gridg">{ticksL.map((t, k) => { const v = yL(t); return horiz
            ? <g key={k}><line x1={v} x2={v} y1={m.t} y2={m.t + ih} className="ul-chart-grid" /><text x={v} y={H - 6} textAnchor="middle" className="ul-chart-tick">{fL(t)}</text></g>
            : <g key={k}><line x1={m.l} x2={m.l + iw} y1={v} y2={v} className="ul-chart-grid" /><text x={m.l - 8} y={v + 4} textAnchor="end" className="ul-chart-tick">{fL(t)}</text></g>; })}
            {ticksR.map((t, k) => <text key={'r' + k} x={W - m.r + 8} y={yR(t) + 4} textAnchor="start" className="ul-chart-tick" data-side="r">{fR(t)}</text>)}
            {catTicks.map((c, k) => (horiz
              ? <text key={'c' + k} x={m.l - 8} y={c.pos + 4} textAnchor="end" className="ul-chart-tick ul-chart-cat">{c.text.length * cw > m.l - 12 ? c.text.slice(0, Math.max(3, Math.floor((m.l - 12) / cw) - 1)) + '…' : c.text}</text>
              : <text key={'c' + k} x={c.pos} y={H - 6} textAnchor={(k === 0 && !cat?.kind?.startsWith('band') && c.pos - m.l < 20) || c.pos - (c.text.length * cw) / 2 < 0 ? 'start' : c.pos + (c.text.length * cw) / 2 > W ? 'end' : 'middle'} className="ul-chart-tick ul-chart-cat">{c.text}</text>))}
          </g>
          <g className="ul-chart-areas">{marks.areas}</g>
          <g className="ul-chart-bars">{marks.bars}</g>
          <g className="ul-chart-lines">{marks.lines}</g>
          <g className="ul-chart-beads">{marks.beads}</g>
          {references.map((r, k) => { const v = refY(r, r.value); return horiz
            ? <g key={'ref' + k} className="ul-chart-ref" style={{ color: TONE[r.tone ?? 'neutral'] }}><line x1={v} x2={v} y1={m.t} y2={m.t + ih} />{r.label ? <text x={v + 4} y={m.t + 10}>{r.label}</text> : null}</g>
            : <g key={'ref' + k} className="ul-chart-ref" style={{ color: TONE[r.tone ?? 'neutral'] }}><line x1={m.l} x2={m.l + iw} y1={v} y2={v} />{r.label ? <text x={m.l + iw - 4} y={v - 5} textAnchor="end">{r.label}</text> : null}</g>; })}
        </svg>
        {canvasOn ? <canvas ref={canvasRef} className="ul-chart2-canvas" style={{ width: W, height: H }} aria-hidden="true" data-ul-illustration=""></canvas> : null}
        {liveBead ? <span className="ul-chart-livebead" data-s={liveBead.slot} style={{ transform: `translate3d(${liveBead.x.toFixed(1)}px, ${liveBead.y.toFixed(1)}px, 0)` }} aria-hidden="true"></span> : null}
        {ix?.layer}
        {hover.layer}
        {ix?.tools ? <div className="ul-chart2-ztools">{ix.tools}</div> : null}
      </div>
      <span id={`${id}-nav`} className="ul-sr-only">{L('nav')}</span>
    </div>
  );
  const legendItems = series.map((s, si) => ({ key: s.key, name: s.name, slot: slot(s, si), mark: (typeOf(s) === 'line' ? 'line' : 'fill') as 'line' | 'fill', on: !hidden.includes(s.key), dash: dashOf(s, si), pattern: pol.fills }));
  const toggle = (k: string) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : h.length + 1 >= series.length ? h : [...h, k]));
  const node = (
    <ChartFrame title={title} description={p.description} summary={summary} locale={locale} accent={p.accent} panel={p.panel} className={p.className}
      state={n === 0 && (p.state ?? 'ready') === 'ready' ? 'empty' : p.state} onRetry={p.onRetry} errorMessage={p.errorMessage} empty={p.empty} stale={p.stale}
      height={H + (hasRight || axes.left?.label ? 22 : 0)} skeleton={hasBars && !series.every((s) => typeOf(s) === 'bar') ? 'combo' : horiz ? 'hbar' : hasBars ? 'bar' : kind === 'area' ? 'area' : 'line'}
      table={table} patterns={pol.state} toolbar={p.toolbar} filename={p.filename} defaultTable={p.defaultTable} liveRef={liveRef} footer={ix?.footer}
      legend={p.legend !== false && series.length > 1 ? <ChartLegend items={legendItems} onToggle={toggle} onFocusSeries={setFocusSeries} label={`${typeof title === 'string' ? title + ': ' : ''}${L('series')}`} /> : null}>
      {plot}
    </ChartFrame>
  );
  return withChartMenu<ChartPointTarget>(node, ctx as ContextMenuProps<ChartPointTarget>, (hit) => {
    const chip = hit.closest<HTMLElement>('.ul-chart-lchip');
    if (chip) { const s = series.find((x) => x.key === chip.dataset.key); return s ? { kind: 'series', id: s.key, data: { series: s.name }, el: chip } : null; }
    const pl = hit.closest<HTMLElement>('.ul-chart2-plot'); if (!pl) return null;
    const i = hover.index;
    if (i != null) return { kind: 'point', id: String(i + off), data: { index: i + off, label: xLabel(i), series: kb.current.s >= 0 ? series[kb.current.s].name : undefined, values: series.map((s, si) => ({ series: s.name, value: raw[si][i] })) }, el: pl };
    return { kind: 'plot', data: {}, el: pl };
  });
}

/** Merge two handler maps; the injected handler runs first and may stop the body's by returning true. */
function mergeBind(own: Record<string, (e: never) => unknown>, extra?: Record<string, (e: never) => unknown>) {
  if (!extra) return own;
  const out: Record<string, (e: never) => unknown> = { ...own };
  for (const k of Object.keys(extra)) { const a = extra[k], b = own[k]; out[k] = b ? (e: never) => { if (a(e) === true) return; b(e); } : a; }
  return out;
}
type Pre<T> = Omit<ULCartesianChartProps<T>, 'kind'>;
export function ULLineChart<T>(p: Pre<T>) { return <ULCartesianChart {...p} kind="line" />; }
export function ULAreaChart<T>(p: Pre<T>) { return <ULCartesianChart {...p} kind="area" />; }
export function ULBarChart<T>(p: Pre<T>) { return <ULCartesianChart {...p} kind="bar" />; }
/** Bars + line(s), dual axis: give the line series axis: 'right' and label both axes (axes.left.label / axes.right.label). */
export function ULComboChart<T>(p: Pre<T>) { return <ULCartesianChart {...p} kind="bar" />; }

/* ---------- migration: the 2d ULChart API on the new core ---------- */
export interface ULChartLegacyProps extends ContextMenuProps<ChartPointTarget> {
  /** "line" | "area" | "bar". */ kind?: 'line' | 'area' | 'bar'; /** Series ({ name, values }). */ series: { name: string; data: number[] }[]; /** Category labels. */ labels: string[]; /** Chart title (panel heading, names the figure). */ title: string; /** Text summary for screen readers (read before the data table). */ summary?: string; /** Plot height in px. */ height?: number;
  /** Formats values for ticks, tooltip and table: Intl options or (v) => string. */ format?: (v: number) => string; /** Show the data table toggle. Default true. */ showTable?: boolean; /** Accent colour of the panel; series colours derive from it (--ul-chart-s0…s5). */ accent?: Accent; /** Wrap in the one glass chart panel. Default true; false for embedding in another surface. */ panel?: boolean; /** Extra class on the panel. */ className?: string; /** "en" | "sk" | "de" | "cs" for numbers, dates and built-in strings. Default "en". */ locale?: string;
}
/** Drop-in for the 2d ULChart: same props; renders through ULCartesianChart. */
export function ULChart({ kind = 'line', series, labels, title, summary, height, format, showTable, accent, panel, className, locale, ...ctx }: ULChartLegacyProps) {
  const data = React.useMemo(() => labels.map((l, i) => ({ l, i })), [labels]);
  const defs = React.useMemo(() => series.map((s, k) => ({ key: s.name || String(k), name: s.name, value: (d: { i: number }) => s.data[d.i] })), [series]);
  return <ULCartesianChart {...ctx} kind={kind} data={data} x={(d) => d.l} series={defs} title={title} summary={summary} height={height ?? 240} format={format ? (v) => format(v) : undefined} defaultTable={showTable} accent={accent} panel={panel} className={className} locale={locale} />;
}
