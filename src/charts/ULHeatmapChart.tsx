/**
 * ULHeatmapChart (matrix with row / column labels) and ULCalendarHeatmap (days × weekdays). Quantised colour-blind-safe
 * scales (sequential / diverging) with a legend and numeric labels; cell labels pick dark / light ink per step.
 * Hover = ONE shared indicator element (never per-cell glass); grid keyboard navigation; table view.
 */
import * as React from 'react';
import { useDomId } from '../components/shared/icons.tsx';
import type { ContextMenuProps } from '../components/ULContainers/contextTarget.tsx';
import { makeNumberFormat, chartLocale } from './scales.ts';
import { ChartFrame, chartText, useWidth, useHoverLayer, withChartMenu, splitChartCtx, useChangeFade } from './core.tsx';
import type { ChartPointTarget } from './ULCartesianChart.tsx';
import { useMarkNav, advText, baseFrame, useDrawOnce, ctxResolve, leftFor, colorScale, ColorLegend, useCellIndicator, type ChartBaseProps, type ColorScheme } from './nav.tsx';
import './charts-adv.css';

export interface ULHeatmapChartProps<T = Record<string, unknown>> extends ChartBaseProps {
  /** Rows. */ data: T[];
  /** Row accessor (d, i) => string. */ row: (d: T, i: number) => string;
  /** Column accessor (d, i) => string. */ col: (d: T, i: number) => string;
  /** Cell value accessor; null = empty cell. */ value: (d: T, i: number) => number | null | undefined;
  /** Explicit orders (default: first appearance). */
  rows?: string[]; /** Column order (default: first appearance). */ cols?: string[];
  /** Colour scale: "sequential" (default) | "diverging" (--ul-chart-seq-* / --ul-chart-div-*). */ scheme?: ColorScheme; /** Value domain [min, max] of the colour scale. Default: data extent. */ domain?: [number, number]; /** Midpoint of a diverging scale. Default 0. */ mid?: number;
  /** Numbers inside cells: auto = when the cell is ≥ 30 × 18 px. */
  labels?: 'auto' | 'on' | 'off';
  /** Cell height in px. */ cellHeight?: number;
  /** Legend title. */
  scaleLabel?: string;
}
export function ULHeatmapChart<T>(props: ULHeatmapChartProps<T>) {
  const [ctx, p] = splitChartCtx(props);
  const { data, locale, title } = p;
  const id = useDomId('ul-hm');
  const L = (k: Parameters<typeof chartText>[0]) => chartText(k, locale), A = (k: Parameters<typeof advText>[0]) => advText(k, locale);
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const fmtN = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fmt = (v: number | null | undefined) => (v == null ? '–' : p.format ? p.format(v) : fmtN(v));
  const rows = React.useMemo(() => p.rows ?? [...new Set(data.map((d, i) => p.row(d, i)))], [data, p.rows]);
  const cols = React.useMemo(() => p.cols ?? [...new Set(data.map((d, i) => p.col(d, i)))], [data, p.cols]);
  const R = rows.length, C = cols.length;
  const grid = React.useMemo(() => { const g: (number | null)[] = new Array(R * C).fill(null); data.forEach((d, i) => { const r = rows.indexOf(p.row(d, i)), c = cols.indexOf(p.col(d, i)); const v = p.value(d, i); if (r >= 0 && c >= 0) g[r * C + c] = v == null || !Number.isFinite(v) ? null : v; }); return g; }, [data, rows, cols]);
  const sc = colorScale(grid, p.scheme, p.domain, p.mid);
  const dataKey = rows.join('|') + '#' + cols.join('|') + '#' + grid.join(',');
  useChangeFade(svgRef, dataKey);
  const gap = 2, l = Math.min(W * 0.4, leftFor(rows) + 8), t = 22;
  const cw = Math.max(6, (W - l) / Math.max(1, C)), ch = p.cellHeight ?? 30, H = t + R * ch + 2;
  const colStep = Math.max(1, Math.ceil(Math.max(...cols.map((c) => c.length), 1) * 6.4 / cw));
  const showNums = p.labels === 'on' || (p.labels !== 'off' && cw >= 30 && ch >= 18);
  const cell = (i: number) => ({ x: l + (i % C) * cw, y: t + Math.floor(i / C) * ch, w: cw - gap, h: ch - gap });
  useDrawOnce(svgRef, (root, dur) => root.querySelector('.ul-heat-cells')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.5, easing: 'ease-out' }));
  const ind = useCellIndicator();
  const hover = useHoverLayer({ width: W, height: H, plot: { l, t, r: 0, b: 0 }, crosshair: false });
  const pointAt = (i: number) => { const c = cell(i); return { index: i, x: c.x + c.w / 2, y: c.y, title: `${rows[Math.floor(i / C)]} · ${cols[i % C]}`, beads: [], rows: [{ slot: 0, name: p.scaleLabel ?? A('value'), value: fmt(grid[i]), mark: 'fill' as const }] }; };
  const nav = useMarkNav({ hover, count: R * C, pointAt, liveRef, onFocusMark: (i) => ind.place(i == null ? null : { ...cell(i), x: cell(i).x - 1, y: cell(i).y - 1, w: cell(i).w + 2, h: cell(i).h + 2, rx: 5 }),
    move: (cur, k) => { if (cur == null) return 0; const r = Math.floor(cur / C), c = cur % C; if (k === 'up') return Math.max(0, r - 1) * C + c; if (k === 'down') return Math.min(R - 1, r + 1) * C + c; if (k === 'next') return r * C + Math.min(C - 1, c + 1); if (k === 'prev') return r * C + Math.max(0, c - 1); if (k === 'home') return r * C; if (k === 'end') return r * C + C - 1; return null; } });
  const table = { columns: [A('row'), ...cols], rows: rows.map((rn, r) => [rn, ...cols.map((_, c) => fmt(grid[r * C + c]))]) };
  const nums = grid.filter((v): v is number => v != null); let hiI = -1, loI = -1; grid.forEach((v, i) => { if (v == null) return; if (hiI < 0 || v > grid[hiI]!) hiI = i; if (loI < 0 || v < grid[loI]!) loI = i; });
  const summary = p.summary ?? (nums.length ? `${R} × ${C}. ${L('high')} ${rows[Math.floor(hiI / C)]} · ${cols[hiI % C]} ${fmt(grid[hiI])}, ${L('low')} ${rows[Math.floor(loI / C)]} · ${cols[loI % C]} ${fmt(grid[loI])}.` : '');
  const plot = (
    <div ref={plotRef} className="ul-chart2-plot ul-heat" style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`} {...nav.bind}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="">
        {cols.map((c, k) => (k % colStep ? null : <text key={c} x={l + k * cw + (cw - gap) / 2} y={14} textAnchor="middle" className="ul-chart-tick">{c}</text>))}
        {rows.map((r, k) => <text key={r} x={l - 8} y={t + k * ch + (ch - gap) / 2 + 3.5} textAnchor="end" className="ul-chart-tick">{r.length * 6.4 > l - 10 ? r.slice(0, Math.max(3, Math.floor((l - 14) / 6.4))) + '…' : r}</text>)}
        <g className="ul-heat-cells">
          {grid.map((v, i) => { const c = cell(i), q = sc.q(v); return <g key={i} data-mark={i}>
            <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={3} className="ul-heat-cell" data-scheme={sc.scheme} data-q={q < 0 ? undefined : q} data-empty={q < 0 ? '' : undefined} />
            {showNums && v != null ? <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 4} textAnchor="middle" className="ul-heat-num" data-scheme={sc.scheme} data-q={q}>{fmt(v)}</text> : null}
          </g>; })}
        </g>
      </svg>
      {ind.layer}
      {hover.layer}
      <span id={`${id}-nav`} className="ul-sr-only">{L('nav')}</span>
    </div>
  );
  const node = <ChartFrame {...baseFrame(p, data.length)} summary={summary} height={H} skeleton="grid" table={table} patterns="off" liveRef={liveRef} legend={p.legend !== false ? <ColorLegend scale={sc} fmt={(v) => fmt(v)} label={p.scaleLabel ?? A('value')} locale={locale} /> : null}>{plot}</ChartFrame>;
  return withChartMenu<ChartPointTarget>(node, ctx as ContextMenuProps<ChartPointTarget>, ctxResolve('.ul-heat', () => hover.index, (i) => ({ kind: 'cell', id: `${rows[Math.floor(i / C)]}|${cols[i % C]}`, data: { index: i, row: rows[Math.floor(i / C)], col: cols[i % C], label: `${rows[Math.floor(i / C)]} · ${cols[i % C]}`, values: [{ series: p.scaleLabel ?? 'value', value: grid[i] }] } })));
}

/* ---------------- calendar heatmap ---------------- */
export interface ULCalendarHeatmapProps<T = Record<string, unknown>> extends ChartBaseProps {
  /** Rows. */ data: T[];
  /** Date accessor (d, i) => Date | ISO string. */ date: (d: T, i: number) => Date | string | number;
  /** Value accessor; null = no data. */ value: (d: T, i: number) => number | null | undefined;
  /** First day shown. Default: first date in data. */ from?: Date; /** Last day shown. Default: last date in data. */ to?: Date;
  /** Colour scale: "sequential" (default) | "diverging" (--ul-chart-seq-* / --ul-chart-div-*). */ scheme?: ColorScheme; /** Value domain [min, max] of the colour scale. Default: data extent. */ domain?: [number, number]; /** Midpoint of a diverging scale. Default 0. */ mid?: number;
  /** Accessible label of the colour legend. */ scaleLabel?: string;
  /** Max cell size in px. Default 16. */
  cell?: number;
}
const DAY = 864e5;
const dayKey = (t: number) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
export function ULCalendarHeatmap<T>(props: ULCalendarHeatmapProps<T>) {
  const [ctx, p] = splitChartCtx(props);
  const { data, locale, title } = p;
  const id = useDomId('ul-cal');
  const L = (k: Parameters<typeof chartText>[0]) => chartText(k, locale), A = (k: Parameters<typeof advText>[0]) => advText(k, locale);
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const fmtN = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fmt = (v: number | null | undefined) => (v == null ? '–' : p.format ? p.format(v) : fmtN(v));
  const loc = chartLocale(locale);
  const fDay = React.useMemo(() => new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }), [loc]);
  const fMon = React.useMemo(() => new Intl.DateTimeFormat(loc, { month: 'short', timeZone: 'UTC' }), [loc]);
  const fWd = React.useMemo(() => new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: 'UTC' }), [loc]);
  const { days, vals, start } = React.useMemo(() => {
    const m = new Map<number, number>(); let lo = Infinity, hi = -Infinity;
    data.forEach((d, i) => { const raw = p.date(d, i), t = dayKey(raw instanceof Date ? raw.getTime() : new Date(raw).getTime()); const v = p.value(d, i); if (v != null && Number.isFinite(v)) m.set(t, (m.get(t) ?? 0) + v); if (t < lo) lo = t; if (t > hi) hi = t; });
    if (p.from) lo = dayKey(p.from.getTime()); if (p.to) hi = dayKey(p.to.getTime());
    if (!Number.isFinite(lo)) return { days: [] as number[], vals: [] as (number | null)[], start: 0 };
    const wd = (new Date(lo).getUTCDay() + 6) % 7, start = lo - wd * DAY; // Monday first
    const days: number[] = []; for (let t = lo; t <= hi; t += DAY) days.push(t);
    return { days, vals: days.map((t) => m.get(t) ?? null), start };
  }, [data, p.from, p.to]);
  const sc = colorScale(vals, p.scheme, p.domain, p.mid);
  useChangeFade(svgRef, vals.join(','));
  const N = days.length, weeks = N ? Math.floor((days[N - 1] - start) / DAY / 7) + 1 : 0;
  const l = 34, t = 18, size = Math.max(6, Math.min(p.cell ?? 16, Math.floor((W - l) / Math.max(1, weeks)))), gap = size > 9 ? 3 : 2, H = t + 7 * size + 4;
  const pos = (i: number) => { const off = Math.round((days[i] - start) / DAY); return { x: l + Math.floor(off / 7) * size, y: t + (off % 7) * size, w: size - gap, h: size - gap }; };
  useDrawOnce(svgRef, (root, dur) => root.querySelector('.ul-heat-cells')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.5, easing: 'ease-out' }));
  const ind = useCellIndicator();
  const hover = useHoverLayer({ width: W, height: H, plot: { l, t, r: 0, b: 0 }, crosshair: false });
  const pointAt = (i: number) => { const c = pos(i); return { index: i, x: c.x + c.w / 2, y: c.y, title: fDay.format(days[i]), beads: [], rows: [{ slot: 0, name: p.scaleLabel ?? A('value'), value: fmt(vals[i]), mark: 'fill' as const }] }; };
  // calendar grid: ↑ ↓ = previous / next day, ← → = previous / next week
  const nav = useMarkNav({ hover, count: N, pointAt, liveRef, onFocusMark: (i) => ind.place(i == null ? null : { ...pos(i), x: pos(i).x - 1.5, y: pos(i).y - 1.5, w: pos(i).w + 3, h: pos(i).h + 3, rx: 4 }),
    move: (cur, k) => { if (cur == null) return 0; const d = k === 'up' ? -1 : k === 'down' ? 1 : k === 'next' ? 7 : k === 'prev' ? -7 : 0; return d ? Math.max(0, Math.min(N - 1, cur + d)) : null; } });
  const months: { x: number; t: string }[] = []; days.forEach((d, i) => { const dt = new Date(d); if (dt.getUTCDate() === 1 || i === 0) { const x = pos(i).x; if (!months.length || x - months[months.length - 1].x > 30) months.push({ x, t: fMon.format(d) }); } });
  const table = { columns: [A('from'), p.scaleLabel ?? A('value')], rows: days.map((d, i) => [fDay.format(d), fmt(vals[i])]) };
  let hiI = -1; vals.forEach((v, i) => { if (v != null && (hiI < 0 || v > vals[hiI]!)) hiI = i; });
  const total = vals.reduce<number>((a, v) => a + (v ?? 0), 0);
  const summary = p.summary ?? (N ? `${fDay.format(days[0])} – ${fDay.format(days[N - 1])}. ${L('total')} ${fmt(total)}. ${L('high')} ${hiI >= 0 ? fDay.format(days[hiI]) + ' ' + fmt(vals[hiI]) : '–'}.` : '');
  const plot = (
    <div ref={plotRef} className="ul-chart2-plot ul-heat ul-cal" style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`} {...nav.bind}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="">
        {months.map((m) => <text key={m.x} x={m.x} y={12} className="ul-chart-tick">{m.t}</text>)}
        {[0, 2, 4].map((k) => <text key={k} x={l - 6} y={t + k * size + (size - gap) / 2 + 3.5} textAnchor="end" className="ul-chart-tick">{fWd.format(Date.UTC(2024, 0, 1 + k))}</text>)}
        <g className="ul-heat-cells">{days.map((_, i) => { const c = pos(i), q = sc.q(vals[i]); return <rect key={i} data-mark={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={Math.min(3, size / 4)} className="ul-heat-cell" data-scheme={sc.scheme} data-q={q < 0 ? undefined : q} data-empty={q < 0 ? '' : undefined} />; })}</g>
      </svg>
      {ind.layer}
      {hover.layer}
      <span id={`${id}-nav`} className="ul-sr-only">{L('nav')}</span>
    </div>
  );
  const node = <ChartFrame {...baseFrame(p, data.length)} summary={summary} height={H} skeleton="grid" table={table} patterns="off" liveRef={liveRef} legend={p.legend !== false ? <ColorLegend scale={sc} fmt={(v) => fmt(v)} label={p.scaleLabel ?? A('value')} locale={locale} /> : null}>{plot}</ChartFrame>;
  return withChartMenu<ChartPointTarget>(node, ctx as ContextMenuProps<ChartPointTarget>, ctxResolve('.ul-cal', () => hover.index, (i) => (days[i] != null ? { kind: 'cell', id: new Date(days[i]).toISOString().slice(0, 10), data: { index: i, label: fDay.format(days[i]), date: new Date(days[i]).toISOString().slice(0, 10), values: [{ series: p.scaleLabel ?? 'value', value: vals[i] }] } } : null)));
}
