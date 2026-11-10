/**
 * ULRadarChart: multi-series polygons over shared axes (one data row per axis, series like ULCartesianChart).
 * Axis labels are HTML (wrap to two lines, then ellipsis; the full name is in the axis tooltip) so they never clip at 375px.
 * Keyboard: ← → axes, ↑ ↓ series, Enter pin, Esc unpin. Legend toggles series; patterns / dash per policy; table view.
 */
import * as React from 'react';
import { useDomId } from '../components/shared/icons.tsx';
import type { ContextMenuProps } from '../components/ULContainers/contextTarget.tsx';
import { niceDomain, linearTicks, makeNumberFormat } from './scales.ts';
import { ChartFrame, ChartLegend, ChartPatterns, slotOf, chartText, useWidth, useChartTween, useChangeFade, useHoverLayer, withChartMenu, splitChartCtx, usePatternPolicy } from './core.tsx';
import type { ChartPointTarget, ChartSeriesDef } from './ULCartesianChart.tsx';
import { useMarkNav, polar, advText, baseFrame, useDrawOnce, ctxResolve, type ChartBaseProps } from './nav.tsx';
import './charts-adv.css';

export interface ULRadarChartProps<T = Record<string, unknown>> extends ChartBaseProps {
  /** One row per axis. */
  data: T[];
  /** Axis name accessor (d, i) => string (one row per axis). */ axis: (d: T, i: number) => string;
  /** Series definitions ({ key, name, value, color?, dash? }). */ series: Pick<ChartSeriesDef<T>, 'key' | 'name' | 'value' | 'slot'>[];
  /** Outer ring value. Default: nice max of the data. */
  max?: number;
  /** Number of grid rings. Default 4. */ rings?: number;
}
export function ULRadarChart<T>(props: ULRadarChartProps<T>) {
  const [ctx, p] = splitChartCtx(props);
  const { data, axis, series, locale, title } = p;
  const id = useDomId('ul-rr');
  const L = (k: Parameters<typeof chartText>[0]) => chartText(k, locale);
  const H = p.height ?? 300;
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const [hidden, setHidden] = React.useState<string[]>([]);
  const fmtN = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fmt = (v: number | null) => (v == null ? '–' : p.format ? p.format(v) : fmtN(v));
  const n = data.length, pol = usePatternPolicy(p.patterns, series.length);
  const slot = (i: number) => slotOf(series[i].slot ?? i);
  const raw = React.useMemo(() => series.map((s) => data.map((d, i) => { const v = s.value(d, i); return v == null || !Number.isFinite(v) ? null : Math.max(0, v); })), [data, series]);
  const names = React.useMemo(() => data.map((d, i) => axis(d, i)), [data]);
  const w = series.map((s) => (hidden.includes(s.key) ? 0 : 1));
  const dmax = p.max ?? niceDomain(0, Math.max(1, ...raw.flatMap((r, si) => (w[si] ? r.filter((v): v is number => v != null) : []))), p.rings ?? 4)[1];
  const dataKey = names.join('|') + '#' + raw.map((r) => r.join(',')).join(';');
  const { frame } = useChartTween({ v: raw, w, d: [dmax] }, `${dataKey}#${hidden.join()}#${dmax}`);
  useChangeFade(svgRef, dataKey);
  const M = frame.d[0] || 1;
  // label room: two lines of ~11px; width budget grows with the plot
  const narrow = W < 420, labW = Math.max(56, Math.min(120, W * 0.2)), padX = labW * (narrow ? 0.62 : 0.7) + 6, padY = 34;
  const R = Math.max(40, Math.min(W / 2 - padX, H / 2 - padY)), cx = W / 2, cy = H / 2;
  const ang = (i: number) => (i / Math.max(1, n)) * Math.PI * 2;
  const ticks = linearTicks(0, M, p.rings ?? 4).filter((t) => t > 0);
  const ringPath = (r: number) => (n >= 3 ? names.map((_, i) => { const [x, y] = polar(cx, cy, r, ang(i)); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('') + 'Z' : `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`);
  const pt = (si: number, i: number) => { const v = frame.v[si]?.[i]; return polar(cx, cy, ((v ?? 0) / M) * R * (frame.w[si] ?? 1), ang(i)); };
  const polyPath = (si: number) => names.map((_, i) => { const [x, y] = pt(si, i); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('') + 'Z';
  useDrawOnce(svgRef, (root, dur, ease) => root.querySelectorAll<SVGGElement>('.ul-radar-series').forEach((g) => g.animate([{ transform: 'scale(0.001)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: dur, easing: ease })));

  const focusS = React.useRef<number | null>(null);
  const setFocusS = (si: number | null) => { focusS.current = si; const g = svgRef.current; if (!g) return; if (si == null) delete g.dataset.focus; else g.dataset.focus = String(slot(si)); };
  const hover = useHoverLayer({ width: W, height: H, plot: { l: 0, t: 0, r: 0, b: 0 }, crosshair: false });
  const visS = series.map((_, si) => si).filter((si) => w[si]);
  const pointAt = (i: number) => {
    const order = focusS.current != null ? [focusS.current, ...visS.filter((s) => s !== focusS.current)] : visS;
    const [ax, ay] = polar(cx, cy, R, ang(i));
    return { index: i, x: ax, y: ay, title: names[i], beads: visS.map((si) => { const [x, y] = pt(si, i); return { slot: slot(si), x, y }; }), rows: order.map((si) => ({ slot: slot(si), name: series[si].name, value: fmt(raw[si][i]), mark: 'line' as const, dash: pol.dash(slot(si), si) })) };
  };
  const nav = useMarkNav({
    hover, count: n, pointAt, liveRef,
    pick: (x, y) => { if (Math.hypot(x - cx, y - cy) > R + padX) return null; let a = Math.atan2(x - cx, cy - y); if (a < 0) a += Math.PI * 2; return Math.round(a / (Math.PI * 2 / Math.max(1, n))) % Math.max(1, n); },
    move: (cur, k) => {
      if (k !== 'up' && k !== 'down') return null;
      if (!visS.length) return cur;
      const pos = focusS.current == null ? -1 : visS.indexOf(focusS.current);
      setFocusS(visS[(pos + (k === 'down' ? 1 : -1) + visS.length) % visS.length]);
      return cur ?? 0;
    },
    say: (pp) => (focusS.current != null ? `${pp.title}, ${series[focusS.current].name}: ${fmt(raw[focusS.current][pp.index])}` : `${pp.title}: ${pp.rows.map((r) => `${r.name} ${r.value}`).join(', ')}`),
    onFocusMark: (i) => { if (i == null) setFocusS(null); },
  });
  React.useEffect(() => { if (hover.index != null) nav.show(hover.index); }, [W, frame]);

  const table = { columns: [advText('axis', locale), ...series.map((s) => s.name)], rows: names.map((nm, i) => [nm, ...series.map((_, si) => fmt(raw[si][i]))]) };
  const summary = p.summary ?? series.filter((_, si) => w[si]).map((s, k) => { const si = series.indexOf(s), vals = raw[si]; let hi = 0, lo = 0; vals.forEach((v, i) => { if ((v ?? -Infinity) > (vals[hi] ?? -Infinity)) hi = i; if ((v ?? Infinity) < (vals[lo] ?? Infinity)) lo = i; }); void k; return `${s.name}: ${L('high')} ${names[hi]} ${fmt(vals[hi])}, ${L('low')} ${names[lo]} ${fmt(vals[lo])}`; }).join('. ') + '.';
  const plot = (
    <div ref={plotRef} className="ul-chart2-plot ul-radar" style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`} {...nav.bind}>
      <svg ref={svgRef} className="ul-chart2-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="">
        <defs><ChartPatterns id={id} /></defs>
        <g className="ul-radar-grid">
          {ticks.map((t) => <path key={t} d={ringPath((t / M) * R)} className="ul-radar-ring" />)}
          {names.map((_, i) => { const [x, y] = polar(cx, cy, R, ang(i)); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="ul-radar-spoke" />; })}
          {ticks.map((t) => { const [x, y] = polar(cx, cy, (t / M) * R, 0); return <text key={t} x={x + 4} y={y + 3} className="ul-chart-tick ul-radar-tick">{fmt(t)}</text>; })}
        </g>
        {series.map((s, si) => w[si] || (frame.w[si] ?? 0) > 0.01 ? <g key={s.key} className="ul-radar-series" data-s={slot(si)} data-key={s.key} style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <path d={polyPath(si)} className="ul-radar-area" />
          {pol.fills && slot(si) ? <path d={polyPath(si)} className="ul-chart-hatch" fill={`url(#${id}-p${slot(si)})`} /> : null}
          <path d={polyPath(si)} className="ul-radar-line" strokeDasharray={pol.dash(slot(si), si) || undefined} />
          {n <= 12 ? names.map((_, i) => raw[si][i] == null ? null : <circle key={i} cx={pt(si, i)[0]} cy={pt(si, i)[1]} r={2.6} className="ul-chart-dot2" />) : null}
        </g> : null)}
      </svg>
      {names.map((nm, i) => { const a = ang(i), [x, y] = polar(cx, cy, R + 10, a), sx = Math.sin(a), sy = -Math.cos(a);
        const al = Math.abs(sx) < 0.2 ? 'c' : sx > 0 ? 'l' : 'r';
        return <span key={i} className="ul-radar-label" data-mark={i} data-al={al} style={{ left: x, top: y, maxWidth: al === 'c' ? labW * 1.6 : Math.min(labW, al === 'l' ? W - x - 2 : x - 2), translate: `${al === 'c' ? '-50%' : al === 'l' ? '0' : '-100%'} ${sy < -0.3 ? '-100%' : sy > 0.3 ? '0' : '-50%'}` }}>{nm}</span>; })}
      {hover.layer}
      <span id={`${id}-nav`} className="ul-sr-only">{L('nav')}</span>
    </div>
  );
  const legendItems = series.map((s, si) => ({ key: s.key, name: s.name, slot: slot(si), mark: 'line' as const, on: !hidden.includes(s.key), dash: pol.dash(slot(si), si) }));
  const node = (
    <ChartFrame {...baseFrame(p, n)} summary={summary} height={H} skeleton="radar" table={table} patterns={pol.state} liveRef={liveRef}
      legend={p.legend !== false ? <ChartLegend items={legendItems} label={L('series')} onToggle={(k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : h.length + 1 >= series.length ? h : [...h, k]))} onFocusSeries={(k) => setFocusS(k == null ? null : series.findIndex((s) => s.key === k))} /> : null}>
      {plot}
    </ChartFrame>
  );
  return withChartMenu<ChartPointTarget>(node, ctx as ContextMenuProps<ChartPointTarget>, (hit) => {
    const poly = hit.closest<HTMLElement>('.ul-radar-series'); const pl = hit.closest<HTMLElement>('.ul-radar');
    if (poly && pl && hover.index == null) return { kind: 'series', id: poly.dataset.key, data: { series: poly.dataset.key }, el: pl };
    return ctxResolve('.ul-radar', () => hover.index, (i) => (names[i] != null ? { kind: 'point', id: names[i], data: { index: i, label: names[i], values: series.map((s, si) => ({ series: s.name, value: raw[si][i] })) } } : null))(hit);
  });
}
