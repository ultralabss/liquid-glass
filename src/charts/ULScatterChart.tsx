/**
 * ULScatterChart (scatter + bubble). Numeric x / y, optional size (sqrt area scale with a size legend), series by colour
 * AND shape (circle, square, triangle, diamond), linear trend per series, nearest point through a quadtree (no per-point
 * listeners), keyboard nearest-neighbour walk, rect brush that emits the selected points (Esc cancels / clears).
 */
import * as React from 'react';
import { useDomId } from '../components/shared/icons.tsx';
import type { ContextMenuProps } from '../components/ULContainers/contextTarget.tsx';
import { scaleLinear, niceDomain, makeNumberFormat, shapePath, SCATTER_SHAPES } from './scales.ts';
import { ChartFrame, ChartLegend, slotOf, chartText, useWidth, useChartTween, useChangeFade, useHoverLayer, withChartMenu, splitChartCtx, usePatternPolicy } from './core.tsx';
import type { ChartPointTarget } from './ULCartesianChart.tsx';
import { useMarkNav, advText, baseFrame, useDrawOnce, ChartAxes, leftFor, useBrush, type ChartBaseProps, type BrushRect } from './nav.tsx';
import { buildQuadtree } from './quadtree.ts';
import { canvasThreshold } from './decimate.ts';
import './charts-adv.css';

export { shapePath, SCATTER_SHAPES } from './scales.ts';
export type { ScatterShape } from './scales.ts';
export interface ULScatterChartProps<T = Record<string, unknown>> extends ChartBaseProps {
  /** Rows. */ data: T[];
  /** X accessor (d, i). */ x: (d: T, i: number) => number;
  /** Y accessor (d, i) => number. */ y: (d: T, i: number) => number;
  /** Bubble size value (area-proportional). Omit for a plain scatter. */
  size?: (d: T, i: number) => number;
  /** Series name per point (colour + shape). Default: one series. */
  group?: (d: T, i: number) => string;
  /** Point label for the tooltip / table. */
  pointLabel?: (d: T, i: number) => string;
  /** Axis options per axis ({ x?, y? }: label, ticks, min, max, format). */ axes?: { x?: { label?: string; format?: (v: number) => string; min?: number; max?: number }; y?: { label?: string; format?: (v: number) => string; min?: number; max?: number }; size?: { label?: string; format?: (v: number) => string } };
  /** Least-squares trend line per series. */
  trend?: boolean;
  /** Rect brush; onSelect receives the selected rows (empty = cleared). */
  brush?: boolean;
  /** Called with the rows and indices inside a brush selection. */ onSelect?: (rows: T[], indices: number[]) => void;
  /** Bubble radius range in px. Default [4, 18] (bubble) / 4.5 (scatter). */
  radius?: [number, number];
  /** auto (default): canvas above --ul-chart-canvas-at points (same tooltip, keyboard, brush, shapes, table and context menu). */
  renderer?: 'auto' | 'svg' | 'canvas';
}
const fit = (xs: number[], ys: number[]) => { const n = xs.length; if (n < 2) return null; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; } const den = n * sxx - sx * sx; if (!den) return null; const m = (n * sxy - sx * sy) / den; return { m, b: (sy - m * sx) / n }; };

export function ULScatterChart<T>(props: ULScatterChartProps<T>) {
  const [ctx, p] = splitChartCtx(props);
  const { data, locale, title, axes = {} } = p;
  const id = useDomId('ul-sc');
  const L = (k: Parameters<typeof chartText>[0]) => chartText(k, locale), A = (k: Parameters<typeof advText>[0], n?: number) => advText(k, locale, n);
  const H = p.height ?? 300;
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), canvasRef = React.useRef<HTMLCanvasElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const [hidden, setHidden] = React.useState<string[]>([]);
  const [sel, setSel] = React.useState<number[]>([]);
  const fmtN = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fx = axes.x?.format ?? ((v: number) => fmtN(v)), fy = axes.y?.format ?? ((v: number) => fmtN(v)), fs = axes.size?.format ?? ((v: number) => fmtN(v));
  const groups = React.useMemo(() => { const g: string[] = []; data.forEach((d, i) => { const k = p.group ? p.group(d, i) : String(p.title ?? ''); if (!g.includes(k)) g.push(k); }); return g; }, [data, p.group]);
  const gi = React.useMemo(() => data.map((d, i) => groups.indexOf(p.group ? p.group(d, i) : String(p.title ?? ''))), [data, groups]);
  const pol = usePatternPolicy(p.patterns, groups.length);
  const raw = React.useMemo(() => [data.map((d, i) => p.x(d, i)), data.map((d, i) => p.y(d, i)), data.map((d, i) => (p.size ? Math.max(0, p.size(d, i) || 0) : 1))], [data]);
  const vis = (i: number) => !hidden.includes(groups[gi[i]]) && Number.isFinite(raw[0][i]) && Number.isFinite(raw[1][i]);
  const ext = (a: number[]) => { let lo = Infinity, hi = -Infinity; a.forEach((v, i) => { if (vis(i)) { if (v < lo) lo = v; if (v > hi) hi = v; } }); return [lo, hi]; };
  const [xl, xh] = ext(raw[0]), [yl, yh] = ext(raw[1]);
  const xd = niceDomain(axes.x?.min ?? Math.min(xl, xh), axes.x?.max ?? xh, 6), yd = niceDomain(axes.y?.min ?? Math.min(yl, yh), axes.y?.max ?? yh, 5);
  const smax = Math.max(1e-9, ...raw[2]);
  const dataKey = React.useMemo(() => data.length + ':' + raw[0].join(',') + ';' + raw[1].join(',') + ';' + (p.size ? raw[2].join(',') : ''), [raw]);
  const { frame } = useChartTween({ v: raw, w: groups.map((g) => (hidden.includes(g) ? 0 : 1)), d: [...xd, ...yd] }, `${dataKey}#${hidden.join()}`);
  useChangeFade(svgRef, dataKey);
  const [d0, d1, d2, d3] = frame.d;
  const yTicksRaw = scaleLinear([d2, d3], [0, 1]).ticks(5);
  const plot = { l: leftFor(yTicksRaw.map(fy)), t: 10, r: 14, b: 24 };
  const xs = scaleLinear([d0, d1], [plot.l, W - plot.r]), ys = scaleLinear([d2, d3], [H - plot.b, plot.t]);
  const [r0, r1] = p.radius ?? (p.size ? [4, Math.max(8, Math.min(18, W / 30))] : [4.5, 4.5]);
  const rad = (s: number) => (p.size ? r0 + (r1 - r0) * Math.sqrt(s / smax) : r0);
  const n = data.length;
  const px = React.useMemo(() => { const X = new Float64Array(n), Y = new Float64Array(n); for (let i = 0; i < n; i++) { X[i] = xs(frame.v[0][i] ?? NaN); Y[i] = ys(frame.v[1][i] ?? NaN); } return { X, Y }; }, [frame, W, H, plot.l]);
  const qt = React.useMemo(() => buildQuadtree(px.X, px.Y, (i) => !vis(i)), [px, hidden]);
  useDrawOnce(svgRef, (_root, dur) => { const g = plotRef.current?.querySelector('.ul-scatter-pts, .ul-chart2-canvas'); g?.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: dur * 0.6, easing: 'ease-out' }); });

  const hover = useHoverLayer({ width: W, height: H, plot, crosshair: false });
  const name = (i: number) => (p.pointLabel ? p.pointLabel(data[i], i) : groups[gi[i]]);
  const pointAt = (i: number) => ({ index: i, x: px.X[i], y: px.Y[i], title: name(i), beads: [{ slot: slotOf(gi[i]), x: px.X[i], y: px.Y[i] }],
    rows: [{ slot: slotOf(gi[i]), name: axes.x?.label ?? A('x'), value: fx(raw[0][i]), mark: 'fill' as const }, { slot: slotOf(gi[i]), name: axes.y?.label ?? A('y'), value: fy(raw[1][i]), mark: 'fill' as const }, ...(p.size ? [{ slot: slotOf(gi[i]), name: axes.size?.label ?? A('size'), value: fs(raw[2][i]), mark: 'fill' as const }] : [])] });
  /** Keyboard: nearest neighbour in the arrow's direction (90° cone), Home / End = leftmost / rightmost. */
  const neighbour = (cur: number | null, k: string) => {
    let best = -1, bd = Infinity;
    if (cur == null || k === 'home' || k === 'end') { for (let i = 0; i < n; i++) if (vis(i)) { const v = k === 'end' ? -px.X[i] : px.X[i]; if (v < bd) { bd = v; best = i; } } return best < 0 ? null : best; }
    const [ux, uy] = k === 'next' ? [1, 0] : k === 'prev' ? [-1, 0] : k === 'down' ? [0, 1] : [0, -1];
    for (let i = 0; i < n; i++) { if (i === cur || !vis(i)) continue; const dx = px.X[i] - px.X[cur], dy = px.Y[i] - px.Y[cur], along = dx * ux + dy * uy, across = Math.abs(dx * uy - dy * ux); if (along <= 0 || across > along) continue; const d = along + across * 2; if (d < bd || (d === bd && i < best)) { bd = d; best = i; } }
    return best < 0 ? cur : best;
  };
  const brush = useBrush({ mode: 'xy', plot, W, H, enabled: p.brush !== false, label: (r) => A('selected', qt.within(r.x0, r.y0, r.x1, r.y1).length), onEnd: (r) => applySel(r) });
  const applySel = (r: BrushRect | null) => { const ids = r ? qt.within(r.x0, r.y0, r.x1, r.y1) : []; setSel(ids); p.onSelect?.(ids.map((i) => data[i]), ids); if (liveRef.current) liveRef.current.textContent = A('selected', ids.length); };
  const nav = useMarkNav({ hover, count: n, visible: vis, pointAt, liveRef, pick: (x, y) => { const i = qt.nearest(x, y, 36); return i < 0 ? null : i; }, move: (cur, k) => neighbour(cur, k),
    onKey: (e) => { if (e.key === 'Escape' && (brush.cancel() || sel.length)) { applySel(null); hover.pin(false); nav.show(null); e.preventDefault(); return true; } return false; } });
  React.useEffect(() => { if (hover.index != null && vis(hover.index)) nav.show(hover.index); }, [W, frame]);
  const bind = {
    ...nav.bind,
    onPointerDown: brush.bind.onPointerDown,
    onPointerUp: brush.bind.onPointerUp,
    onPointerMove: (e: React.PointerEvent) => { if (brush.bind.onPointerMove(e)) { if (!hover.pinned) nav.show(null); return; } nav.bind.onPointerMove(e); },
    onClick: (e: React.MouseEvent) => { if (brush.swallowClick()) return; nav.bind.onClick(e); },
  };

  const trends = p.trend ? groups.map((g, k) => { if (hidden.includes(g)) return null; const X: number[] = [], Y: number[] = []; for (let i = 0; i < n; i++) if (gi[i] === k && vis(i)) { X.push(raw[0][i]); Y.push(raw[1][i]); } const f = fit(X, Y); if (!f) return null; const xa = Math.min(...X), xb = Math.max(...X); return { k, x1: xs(xa), y1: ys(f.m * xa + f.b), x2: xs(xb), y2: ys(f.m * xb + f.b), f }; }) : [];
  const selSet = new Set(sel);
  const canvasOn = p.renderer === 'canvas' || (p.renderer !== 'svg' && n > canvasThreshold());
  React.useLayoutEffect(() => {
    const cv = canvasRef.current; if (!canvasOn || !cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const cs = getComputedStyle(cv), edge = cs.getPropertyValue('--ul-color-graphite').trim() || '#16181d', ink = cs.getPropertyValue('--ul-color-text').trim() || '#fff', dim = parseFloat(cs.getPropertyValue('--ul-chart-dim')) || 0.3;
    /* data order, fill then stroke per point (same paint order as the SVG); selected points on top */
    const cols = groups.map((_, k) => cs.getPropertyValue(`--ul-chart-s${slotOf(k)}`).trim() || '#fff');
    const paint = (i: number, inSel: boolean) => {
      const k = gi[i], path = new Path2D(shapePath(SCATTER_SHAPES[k % 4], px.X[i], px.Y[i], rad(frame.v[2][i] ?? 1))), base = sel.length && !inSel ? dim : 1;
      g.fillStyle = cols[k]; g.globalAlpha = base * (p.size ? 0.78 : 1); g.fill(path); g.globalAlpha = base;
      g.strokeStyle = sel.length && inSel ? ink : p.size ? cols[k] : edge; g.lineWidth = sel.length && inSel ? 1.5 : p.size ? 1.25 : 1; g.stroke(path);
    };
    const ok = (i: number) => vis(i) && Number.isFinite(px.X[i]) && Number.isFinite(px.Y[i]);
    for (let i = 0; i < n; i++) if (ok(i) && !selSet.has(i)) paint(i, false);
    for (let i = 0; i < n; i++) if (ok(i) && selSet.has(i)) paint(i, true);
    g.globalAlpha = 1; g.setLineDash([6, 4]); g.lineCap = 'round'; g.lineWidth = 1.75;
    for (const tr of trends) if (tr) { g.strokeStyle = cs.getPropertyValue(`--ul-chart-s${slotOf(tr.k)}`).trim() || '#fff'; g.beginPath(); g.moveTo(tr.x1, tr.y1); g.lineTo(tr.x2, tr.y2); g.stroke(); }
    g.setLineDash([]);
  });
  const table = { columns: [L('series'), ...(p.pointLabel ? [L('category')] : []), axes.x?.label ?? A('x'), axes.y?.label ?? A('y'), ...(p.size ? [axes.size?.label ?? A('size')] : [])], rows: data.map((d, i) => [groups[gi[i]], ...(p.pointLabel ? [p.pointLabel(d, i)] : []), fx(raw[0][i]), fy(raw[1][i]), ...(p.size ? [fs(raw[2][i])] : [])]) };
  const summary = p.summary ?? `${n} ${A('points')}. ` + groups.map((g, k) => { const t = trends?.[k]; return `${g}${t ? `: ${A('trend')} ${t.f.m >= 0 ? '+' : ''}${fmtN(t.f.m)}` : ''}`; }).join(', ') + '.';
  const sizeLegend = p.size ? [smax * 0.1, smax * 0.5, smax].map((v) => ({ v, r: rad(v) })) : [];
  const plotEl = (
    <div ref={plotRef} className="ul-chart2-plot ul-scatter" data-canvas={canvasOn ? '' : undefined} data-renderer={canvasOn ? 'canvas' : 'svg'} style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`} {...bind}>
      <svg ref={svgRef} className="ul-chart2-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="">
        <ChartAxes W={W} H={H} plot={plot} xs={xs} ys={ys} xTicks={xs.ticks(Math.max(2, Math.floor(W / 90)))} yTicks={yTicksRaw} xFmt={fx} yFmt={fy} xGrid />
        <g className="ul-scatter-pts" data-sel={sel.length ? '' : undefined} style={{ transformOrigin: `${plot.l}px ${H - plot.b}px` }}>
          {canvasOn ? null : data.map((_, i) => { if (!vis(i) || !Number.isFinite(px.X[i])) return null; const k = gi[i]; return <path key={i} d={shapePath(SCATTER_SHAPES[k % 4], px.X[i], px.Y[i], rad(frame.v[2][i] ?? 1))} className="ul-scatter-pt" data-s={slotOf(k)} data-shape={SCATTER_SHAPES[k % 4]} data-in={selSet.has(i) ? '' : undefined} data-bubble={p.size ? '' : undefined} />; })}
        </g>
        {canvasOn ? null : trends.map((t) => (t ? <line key={t.k} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className="ul-scatter-trend" data-s={slotOf(t.k)} strokeDasharray={pol.mode === 'off' ? '6 4' : '6 4'} /> : null))}
      </svg>
      {canvasOn ? <canvas ref={canvasRef} className="ul-chart2-canvas" style={{ width: W, height: H }} aria-hidden="true" data-ul-illustration=""></canvas> : null}
      {brush.layer}
      {hover.layer}
      <span id={`${id}-nav`} className="ul-sr-only">{L('nav')}</span>
    </div>
  );
  const legendItems = groups.map((g, k) => ({ key: g, name: g, slot: slotOf(k), mark: 'fill' as const, shape: SCATTER_SHAPES[k % 4], on: !hidden.includes(g) }));
  const legend = p.legend !== false && (groups.length > 1 || p.size) ? (
    <div className="ul-scatter-legends">
      {groups.length > 1 ? <ChartLegend items={legendItems} label={L('series')} onToggle={(k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : h.length + 1 >= groups.length ? h : [...h, k]))} /> : null}
      {p.size ? <span className="ul-scatter-size" aria-label={axes.size?.label ?? A('size')}><span className="ul-scatter-size-t">{axes.size?.label ?? A('size')}</span>{sizeLegend.map((s, i) => <span key={i} className="ul-scatter-size-i"><svg width={s.r * 2 + 2} height={s.r * 2 + 2} viewBox={`0 0 ${s.r * 2 + 2} ${s.r * 2 + 2}`} aria-hidden="true" data-ul-illustration=""><circle cx={s.r + 1} cy={s.r + 1} r={s.r} className="ul-scatter-size-c" /></svg>{fs(s.v)}</span>)}</span> : null}
    </div>
  ) : null;
  const node = <ChartFrame {...baseFrame(p, n)} summary={summary} height={H} skeleton="scatter" table={table} patterns={pol.state} liveRef={liveRef} legend={legend}>{plotEl}</ChartFrame>;
  return withChartMenu<ChartPointTarget>(node, ctx as ContextMenuProps<ChartPointTarget>, (hit) => {
    const chip = hit.closest<HTMLElement>('.ul-chart-lchip'); if (chip) return { kind: 'series', id: chip.dataset.key, data: { series: chip.dataset.key }, el: chip };
    const pl = hit.closest<HTMLElement>('.ul-scatter'); if (!pl) return null;
    const i = hover.index;
    if (i != null) return { kind: 'point', id: String(i), data: { index: i, label: name(i), series: groups[gi[i]], values: [{ series: 'x', value: raw[0][i] }, { series: 'y', value: raw[1][i] }, ...(p.size ? [{ series: 'size', value: raw[2][i] }] : [])] }, el: pl };
    if (sel.length) return { kind: 'selection', data: { indices: sel } as ChartPointTarget, el: pl };
    return { kind: 'plot', data: {}, el: pl };
  });
}
