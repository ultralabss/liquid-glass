/**
 * ULFunnelChart (steps, conversion of the first step, drop-off from the previous), ULHistogramChart (bin control,
 * percentile / reference lines), ULTreemapChart (squarified, drill-in with embedded ULBreadcrumbs, labels hide when the
 * tile is too small). Hover = ONE shared indicator element; keyboard; table view; patterns per policy.
 */
import * as React from 'react';
import { useDomId } from '../components/shared/icons.tsx';
import type { ContextMenuProps } from '../components/ULContainers/contextTarget.tsx';
import { ULBreadcrumbs } from '../components/ULData/ULData.tsx';
import { scaleLinear, niceDomain, tickStep, makeNumberFormat } from './scales.ts';
import { ChartFrame, ChartPatterns, slotOf, chartText, useWidth, useChartTween, useChangeFade, useHoverLayer, withChartMenu, splitChartCtx, usePatternPolicy } from './core.tsx';
import type { ChartPointTarget } from './ULCartesianChart.tsx';
import { useMarkNav, advText, baseFrame, useDrawOnce, ctxResolve, ChartAxes, leftFor, useCellIndicator, focusMarkIn, type ChartBaseProps } from './nav.tsx';
import './charts-adv.css';

/* ---------------- funnel ---------------- */
export interface ULFunnelChartProps<T = Record<string, unknown>> extends ChartBaseProps {
  /** Rows. */ data: T[];
  /** Category label accessor (d, i) => string. */ label: (d: T, i: number) => string;
  /** Value accessor (d, i) => number. */ value: (d: T, i: number) => number;
}
export function ULFunnelChart<T>(props: ULFunnelChartProps<T>) {
  const [ctx, p] = splitChartCtx(props);
  const { data, locale, title } = p;
  const id = useDomId('ul-fn');
  const L = (k: Parameters<typeof chartText>[0]) => chartText(k, locale), A = (k: Parameters<typeof advText>[0]) => advText(k, locale);
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const fmtN = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fmt = (v: number) => (p.format ? p.format(v) : fmtN(v));
  const pct = makeNumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const steps = React.useMemo(() => data.map((d, i) => ({ name: p.label(d, i), value: Math.max(0, p.value(d, i) || 0) })), [data]);
  const key = steps.map((s) => s.name + ':' + s.value).join('|');
  const { frame } = useChartTween({ v: [steps.map((s) => s.value)], w: [], d: [] }, key);
  useChangeFade(svgRef, key);
  const first = steps[0]?.value || 1, rowH = 50, H = steps.length * rowH;
  const conv = (i: number) => steps[i].value / first, drop = (i: number) => (i ? 1 - steps[i].value / (steps[i - 1].value || 1) : 0);
  const bar = (i: number) => { const w = Math.max(4, (W - 2) * ((frame.v[0][i] ?? 0) / first)); return { x: (W - w) / 2, y: i * rowH + 22, w, h: 22 }; };
  useDrawOnce(svgRef, (root, dur, ease) => root.querySelectorAll<SVGRectElement>('.ul-funnel-bar').forEach((r, i) => r.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: dur, delay: i * 40, easing: ease, fill: 'backwards' })));
  const ind = useCellIndicator();
  const hover = useHoverLayer({ width: W, height: H, plot: { l: 0, t: 0, r: 0, b: 0 }, crosshair: false });
  const pointAt = (i: number) => { const b = bar(i); return { index: i, x: W / 2, y: b.y, title: steps[i].name, beads: [], rows: [{ slot: 0, name: A('value'), value: fmt(steps[i].value), mark: 'fill' as const }, { slot: 0, name: A('conversion'), value: pct(conv(i)), mark: 'fill' as const }, ...(i ? [{ slot: 4, name: A('dropoff'), value: pct(drop(i)), mark: 'fill' as const }] : [])] }; };
  const nav = useMarkNav({ hover, count: steps.length, pointAt, liveRef, onFocusMark: (i) => { focusMarkIn(svgRef.current, i); ind.place(i == null ? null : { x: bar(i).x - 3, y: bar(i).y - 3, w: bar(i).w + 6, h: bar(i).h + 6, rx: 8 }); } });
  const table = { columns: [A('step'), A('value'), A('conversion'), A('dropoff')], rows: steps.map((s, i) => [s.name, fmt(s.value), pct(conv(i)), i ? pct(drop(i)) : '–']) };
  const worst = steps.reduce((a, _, i) => (i && drop(i) > drop(a) ? i : a), 1);
  const summary = p.summary ?? (steps.length ? `${steps.map((s, i) => `${s.name} ${fmt(s.value)} (${pct(conv(i))})`).join(', ')}.${steps.length > 1 ? ` ${A('dropoff')} ${L('high')}: ${steps[worst].name} ${pct(drop(worst))}.` : ''}` : '');
  const plot = (
    <div ref={plotRef} className="ul-chart2-plot ul-funnel" style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`} {...nav.bind}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="">
        {steps.map((s, i) => { const b = bar(i); return <g key={s.name} data-mark={i} data-s={0}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} className="ul-funnel-bar" style={{ transformOrigin: `${W / 2}px 0` }} />
          {i < steps.length - 1 ? <path d={`M${b.x} ${b.y + b.h}L${bar(i + 1).x} ${bar(i + 1).y}L${bar(i + 1).x + bar(i + 1).w} ${bar(i + 1).y}L${b.x + b.w} ${b.y + b.h}Z`} className="ul-funnel-neck" /> : null}
        </g>; })}
      </svg>
      {steps.map((s, i) => <div key={s.name} className="ul-funnel-row" style={{ top: i * rowH }} data-mark={i}>
        <span className="ul-funnel-name">{s.name}</span>
        <span className="ul-funnel-nums"><b>{fmt(s.value)}</b><span>{pct(conv(i))}</span>{i ? <span className="ul-funnel-drop">−{pct(drop(i))}</span> : null}</span>
      </div>)}
      {ind.layer}
      {hover.layer}
      <span id={`${id}-nav`} className="ul-sr-only">{L('nav')}</span>
    </div>
  );
  const node = <ChartFrame {...baseFrame(p, data.length)} summary={summary} height={H} skeleton="funnel" table={table} patterns="off" liveRef={liveRef}>{plot}</ChartFrame>;
  return withChartMenu<ChartPointTarget>(node, ctx as ContextMenuProps<ChartPointTarget>, ctxResolve('.ul-funnel', () => hover.index, (i) => (steps[i] ? { kind: 'step', id: steps[i].name, data: { index: i, label: steps[i].name, values: [{ series: 'value', value: steps[i].value }], conversion: conv(i), dropoff: drop(i) } } : null)));
}

/* ---------------- histogram ---------------- */
export interface ULHistogramChartProps extends ChartBaseProps {
  /** Raw values; binned automatically. */ values: number[];
  /** Bin count (approximate; edges are nice numbers). Default 'auto' (Sturges). */
  bins?: number | 'auto';
  /** Bin control choices. Default [10, 20, 40]; [] hides the control. */
  binOptions?: number[];
  /** Percentile lines, e.g. [50, 95, 99]. */
  percentiles?: number[];
  /** Reference lines ({ value, label }), e.g. p50 / p95 / p99. */ references?: { value: number; label?: string }[];
  /** X axis label. */ xLabel?: string;
}
export const quantile = (sorted: number[], q: number) => { if (!sorted.length) return NaN; const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo); };
export function binValues(values: number[], bins: number) {
  const v = values.filter((x) => Number.isFinite(x)); if (!v.length) return { edges: [0, 1], counts: [0] };
  let lo = Math.min(...v), hi = Math.max(...v); if (lo === hi) { lo -= 0.5; hi += 0.5; }
  const step = tickStep(lo, hi, bins), a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step + (Math.ceil(hi / step) * step === hi ? step : 0);
  const n = Math.max(1, Math.round((b - a) / step)), counts = new Array(n).fill(0);
  for (const x of v) counts[Math.min(n - 1, Math.floor((x - a) / step))]++;
  return { edges: Array.from({ length: n + 1 }, (_, k) => +(a + k * step).toPrecision(12)), counts };
}
export function ULHistogramChart(props: ULHistogramChartProps) {
  const [ctx, p] = splitChartCtx(props);
  const { values, locale, title, percentiles = [], references = [] } = p;
  const id = useDomId('ul-hg');
  const L = (k: Parameters<typeof chartText>[0]) => chartText(k, locale), A = (k: Parameters<typeof advText>[0]) => advText(k, locale);
  const H = p.height ?? 240;
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const fmtN = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fx = (v: number) => (p.format ? p.format(v) : fmtN(v)), fc = makeNumberFormat(locale, {});
  const auto = Math.max(5, Math.ceil(Math.log2(Math.max(1, values.length)) + 1));
  const [binsSel, setBins] = React.useState<number | 'auto'>(p.bins ?? 'auto');
  const nb = binsSel === 'auto' ? auto : binsSel;
  const { edges, counts } = React.useMemo(() => binValues(values, nb), [values, nb]);
  const sorted = React.useMemo(() => values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b), [values]);
  const yd = niceDomain(0, Math.max(1, ...counts), 4);
  const key = edges.join(',') + '#' + counts.join(',');
  const { frame } = useChartTween({ v: [counts], w: [], d: [yd[1]] }, key);
  useChangeFade(svgRef, key);
  const yTicks = scaleLinear([0, frame.d[0] || 1], [0, 1]).ticks(4);
  const plot = { l: leftFor(yTicks.map((t) => fc(t))), t: 26, r: 12, b: 24 };
  const xs = scaleLinear([edges[0], edges[edges.length - 1]], [plot.l, W - plot.r]), ys = scaleLinear([0, frame.d[0] || 1], [H - plot.b, plot.t]);
  const barOf = (i: number) => { const x0 = xs(edges[i]) + 1, x1 = xs(edges[i + 1]) - 1, y = ys(frame.v[0][i] ?? 0); return { x: x0, y, w: Math.max(1, x1 - x0), h: H - plot.b - y }; };
  useDrawOnce(svgRef, (root, dur) => root.querySelector('.ul-chart-bars')?.animate([{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: dur * 0.8, easing: 'ease-out' }));
  const ind = useCellIndicator();
  const hover = useHoverLayer({ width: W, height: H, plot, crosshair: false });
  const total = sorted.length || 1, pct = makeNumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const pointAt = (i: number) => { const b = barOf(i); return { index: i, x: b.x + b.w / 2, y: b.y, title: `${fx(edges[i])} – ${fx(edges[i + 1])}`, beads: [], rows: [{ slot: 0, name: A('count'), value: `${fc(counts[i])} · ${pct(counts[i] / total)}`, mark: 'fill' as const }] }; };
  const nav = useMarkNav({ hover, count: counts.length, pointAt, liveRef, onFocusMark: (i) => { focusMarkIn(svgRef.current, i); ind.place(i == null ? null : { x: barOf(i).x - 2, y: barOf(i).y - 2, w: barOf(i).w + 4, h: barOf(i).h + 2, rx: 4 }); } });
  const lines = [...percentiles.map((q) => ({ v: quantile(sorted, q / 100), label: `p${q}` })), ...references.map((r) => ({ v: r.value, label: r.label ?? '' }))].filter((l) => Number.isFinite(l.v));
  const placed: { x: number; row: number; label: string; v: number }[] = []; for (const ln of lines.sort((a, b) => a.v - b.v)) { const x = xs(ln.v), w = (ln.label.length + fx(ln.v).length + 1) * 6.4; let row = 0; while (placed.some((q) => q.row === row && Math.abs(q.x - x) < w)) row++; placed.push({ x, row: Math.min(row, 1), label: ln.label, v: ln.v }); }
  const table = { columns: [A('bin'), A('count'), L('share')], rows: counts.map((c, i) => [`${fx(edges[i])} – ${fx(edges[i + 1])}`, fc(c), pct(c / total)]) };
  const summary = p.summary ?? `${fc(sorted.length)} ${A('points')}, ${counts.length} ${A('bins')}. ${percentiles.map((q) => `p${q} ${fx(quantile(sorted, q / 100))}`).join(', ')}`;
  const opts = p.binOptions ?? [10, 20, 40];
  const plotEl = (
    <div ref={plotRef} className="ul-chart2-plot ul-hist" style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`} {...nav.bind}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="">
        <ChartAxes W={W} H={H} plot={plot} xs={xs} ys={ys} xTicks={xs.ticks(Math.max(2, Math.floor(W / 80)))} yTicks={yTicks} xFmt={fx} yFmt={(v) => fc(v)} />
        <g className="ul-chart-bars">{counts.map((_, i) => { const b = barOf(i); return <rect key={i} data-mark={i} data-s={0} x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)} rx={Math.min(3, b.w / 3)} className="ul-hist-bar" />; })}</g>
        {placed.map((q) => <g key={q.label + q.v} className="ul-hist-line"><line x1={q.x} x2={q.x} y1={plot.t - 4 + q.row * 12} y2={H - plot.b} /><text x={q.x} y={plot.t - 8 + q.row * 12} textAnchor={q.x > W - 60 ? 'end' : q.x < 60 ? 'start' : 'middle'} className="ul-chart-tick">{q.label} {fx(q.v)}</text></g>)}
      </svg>
      {ind.layer}
      {hover.layer}
      <span id={`${id}-nav`} className="ul-sr-only">{L('nav')}</span>
    </div>
  );
  const control = opts.length ? (
    <div className="ul-chart-legend2" role="group" aria-label={A('bins')}>
      <span className="ul-hist-ctl-t">{A('bins')}</span>
      {(['auto', ...opts] as (number | 'auto')[]).map((o) => <button key={o} type="button" className="ul-chart-lchip" data-plain="" aria-pressed={binsSel === o} onClick={() => setBins(o)}><span className="ul-chart-lname">{o === 'auto' ? `Auto (${auto})` : o}</span></button>)}
    </div>
  ) : null;
  const node = <ChartFrame {...baseFrame(p, values.length)} summary={summary} height={H} skeleton="bar" table={table} patterns="off" liveRef={liveRef} legend={control}>{plotEl}</ChartFrame>;
  return withChartMenu<ChartPointTarget>(node, ctx as ContextMenuProps<ChartPointTarget>, ctxResolve('.ul-hist', () => hover.index, (i) => (counts[i] != null ? { kind: 'bar', id: String(i), data: { index: i, label: `${fx(edges[i])} – ${fx(edges[i + 1])}`, from: edges[i], to: edges[i + 1], values: [{ series: 'count', value: counts[i] }] } } : null)));
}

/* ---------------- treemap ---------------- */
export interface TreeNode { name: string; value?: number; children?: TreeNode[] }
export interface ULTreemapChartProps extends ChartBaseProps {
  /** Tree ({ name, value?, children? }). */ data: TreeNode;
  /** Controlled drill path (names from the root). */
  path?: string[]; /** Called with the drill-in path (names) when the user drills in or out. */ onPathChange?: (path: string[]) => void;
}
const sumOf = (n: TreeNode): number => (n.children?.length ? n.children.reduce((a, c) => a + sumOf(c), 0) : Math.max(0, n.value ?? 0));
export interface Tile { i: number; x: number; y: number; w: number; h: number; node: TreeNode; value: number }
/** Squarified treemap (Bruls et al.). Items sorted by value desc; returns rects in the given box. */
export function squarify(items: { value: number }[], x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = new Array(items.length);
  const idx = items.map((_, i) => i).filter((i) => items[i].value > 0).sort((a, b) => items[b].value - items[a].value);
  const total = idx.reduce((a, i) => a + items[i].value, 0); if (!total) return items.map(() => ({ x, y, w: 0, h: 0 }));
  const scale = (w * h) / total; let row: number[] = [], bx = x, by = y, bw = w, bh = h;
  const worst = (r: number[], side: number) => { const s = r.reduce((a, i) => a + items[i].value * scale, 0); let mx = 0, mn = Infinity; for (const i of r) { const a = items[i].value * scale; mx = Math.max(mx, a); mn = Math.min(mn, a); } return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
  const lay = (r: number[]) => { const s = r.reduce((a, i) => a + items[i].value * scale, 0); if (bw >= bh) { const cw = s / bh; let yy = by; for (const i of r) { const hh = (items[i].value * scale) / cw; out[i] = { x: bx, y: yy, w: cw, h: hh }; yy += hh; } bx += cw; bw -= cw; } else { const ch = s / bw; let xx = bx; for (const i of r) { const ww = (items[i].value * scale) / ch; out[i] = { x: xx, y: by, w: ww, h: ch }; xx += ww; } by += ch; bh -= ch; } };
  for (const i of idx) { const side = Math.min(bw, bh); if (!row.length || worst([...row, i], side) <= worst(row, side)) row.push(i); else { lay(row); row = [i]; } }
  if (row.length) lay(row);
  items.forEach((_, i) => { if (!out[i]) out[i] = { x, y, w: 0, h: 0 }; });
  return out;
}
export function ULTreemapChart(props: ULTreemapChartProps) {
  const [ctx, p] = splitChartCtx(props);
  const { data, locale, title } = p;
  const id = useDomId('ul-tm');
  const L = (k: Parameters<typeof chartText>[0]) => chartText(k, locale), A = (k: Parameters<typeof advText>[0]) => advText(k, locale);
  const H = p.height ?? 280;
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const [ownPath, setOwnPath] = React.useState<string[]>([]);
  const path = p.path ?? ownPath;
  const go = (np: string[]) => { if (!p.path) setOwnPath(np); p.onPathChange?.(np); hover.pin(false); nav.show(null); };
  const fmtN = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fmt = (v: number) => (p.format ? p.format(v) : fmtN(v));
  const pct = makeNumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  let node: TreeNode = data; const trail: TreeNode[] = [data];
  for (const nm of path) { const c = node.children?.find((x) => x.name === nm); if (!c) break; node = c; trail.push(c); }
  const kids = node.children ?? [];
  const vals = kids.map(sumOf), tot = vals.reduce((a, b) => a + b, 0) || 1;
  const pol = usePatternPolicy(p.patterns, kids.length);
  const tiles: Tile[] = squarify(vals.map((value) => ({ value })), 0, 0, W, H).map((r, i) => ({ ...r, i, node: kids[i], value: vals[i] }));
  const key = path.join('/') + '#' + vals.join(',');
  useChangeFade(svgRef, key);
  const pathKey = path.join('/');
  React.useLayoutEffect(() => { svgRef.current?.querySelector('.ul-tm-tiles')?.animate?.([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' }); }, [pathKey]);
  useDrawOnce(svgRef, () => {});
  const ind = useCellIndicator();
  const hover = useHoverLayer({ width: W, height: H, plot: { l: 0, t: 0, r: 0, b: 0 }, crosshair: false });
  const pointAt = (i: number) => { const t = tiles[i]; return { index: i, x: t.x + t.w / 2, y: t.y + Math.min(t.h / 2, 18), title: [...path, t.node.name].join(' › '), beads: [], rows: [{ slot: slotOf(i), name: A('value'), value: fmt(t.value), mark: 'fill' as const }, { slot: slotOf(i), name: L('share'), value: pct(t.value / tot), mark: 'fill' as const }] }; };
  const nav = useMarkNav({ hover, count: tiles.length, visible: (i) => tiles[i].w > 0.5, pointAt, liveRef, onFocusMark: (i) => { focusMarkIn(svgRef.current, i); const t = i == null ? null : tiles[i]; ind.place(t ? { x: t.x, y: t.y, w: t.w - 2, h: t.h - 2, rx: 6 } : null); },
    onKey: (e) => { const i = hover.index; if ((e.key === 'Enter') && i != null && tiles[i]?.node.children?.length) { e.preventDefault(); go([...path, tiles[i].node.name]); return true; } if (e.key === 'Backspace' && path.length) { e.preventDefault(); go(path.slice(0, -1)); return true; } return false; } });
  const onClick = (e: React.MouseEvent) => { const m = (e.target as Element).closest<HTMLElement>('[data-mark]'); const i = m ? +m.dataset.mark! : null; if (i != null && tiles[i]?.node.children?.length) { go([...path, tiles[i].node.name]); return; } nav.bind.onClick(e); };
  const table = { columns: [A('path'), A('value'), L('share')], rows: tiles.map((t) => [[...path, t.node.name].join(' › '), fmt(t.value), pct(t.value / tot)]) };
  const summary = p.summary ?? `${[data.name, ...path].join(' › ')}: ${L('total')} ${fmt(sumOf(node))}. ${tiles.slice().sort((a, b) => b.value - a.value).slice(0, 3).map((t) => `${t.node.name} ${pct(t.value / tot)}`).join(', ')}.`;
  const crumbs = [data, ...trail.slice(1)].map((n, k) => ({ label: k ? n.name : data.name || A('all'), onSelect: k < trail.length - 1 ? () => go(path.slice(0, k)) : undefined }));
  const fit = (s: string, w: number) => (s.length * 6.8 <= w ? s : s.slice(0, Math.max(0, Math.floor(w / 6.8) - 1)) + '…');
  const plot = (
    <div ref={plotRef} className="ul-chart2-plot ul-tm" style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`} {...nav.bind} onClick={onClick}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="">
        <defs><ChartPatterns id={id} /></defs>
        <g className="ul-tm-tiles" style={{ transformOrigin: `${W / 2}px ${H / 2}px` }}>
          {tiles.map((t) => { if (t.w < 0.5 || t.h < 0.5) return null; const s = slotOf(t.i), name = t.w >= 56 && t.h >= 24, val = name && t.h >= 42;
            return <g key={t.node.name} data-mark={t.i} data-s={s} className="ul-tm-tile" data-drill={t.node.children?.length ? '' : undefined}>
              <rect x={t.x} y={t.y} width={Math.max(0, t.w - 2)} height={Math.max(0, t.h - 2)} rx={Math.min(6, t.w / 4, t.h / 4)} className="ul-tm-rect" />
              {pol.fills && s ? <rect x={t.x} y={t.y} width={Math.max(0, t.w - 2)} height={Math.max(0, t.h - 2)} rx={Math.min(6, t.w / 4, t.h / 4)} className="ul-chart-hatch ul-tm-hatch" fill={`url(#${id}-p${s})`} /> : null}
              {name ? <text x={t.x + 8} y={t.y + 17} className="ul-tm-name">{fit(t.node.name, t.w - 16)}</text> : null}
              {val ? <text x={t.x + 8} y={t.y + 33} className="ul-tm-val">{fit(`${fmt(t.value)} · ${pct(t.value / tot)}`, t.w - 16)}</text> : null}
            </g>; })}
        </g>
      </svg>
      {ind.layer}
      {hover.layer}
      <span id={`${id}-nav`} className="ul-sr-only">{L('nav')} {A('drill')}</span>
    </div>
  );
  const nodeEl = <ChartFrame {...baseFrame(p, kids.length)} summary={summary} height={H} skeleton="treemap" table={table} patterns={pol.state} liveRef={liveRef}
    legend={path.length || p.legend !== false ? <div className="ul-tm-crumbs"><ULBreadcrumbs embedded items={crumbs} label={A('path')} /></div> : null}>{plot}</ChartFrame>;
  return withChartMenu<ChartPointTarget>(nodeEl, ctx as ContextMenuProps<ChartPointTarget>, ctxResolve('.ul-tm', () => hover.index, (i) => (tiles[i] ? { kind: 'segment', id: [...path, tiles[i].node.name].join('/'), data: { index: i, label: tiles[i].node.name, path: [...path, tiles[i].node.name], values: [{ series: 'value', value: tiles[i].value }], hasChildren: !!tiles[i].node.children?.length } } : null)));
}
