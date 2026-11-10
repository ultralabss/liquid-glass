/**
 * ULRadialChart (progress ring group) and ULGaugeChart (semi-circle gauge) on the shared chart core.
 * Rings: concentric tracks, rounded caps with the glossy end cap (same .ul-gloss-cap as ULProgress), centre slot,
 * draw-in once, morph on real change. Gauge: threshold bands, fill or needle, min / max / target labels, comparison
 * marker, role="meter" text value.
 */
import * as React from 'react';
import { useDomId } from '../components/shared/icons.tsx';
import { makeNumberFormat } from './scales.ts';
import { ChartFrame, ChartLegend, ChartPatterns, slotOf, chartText, useWidth, useChartTween, useChangeFade, useHoverLayer, withChartMenu, usePatternPolicy, splitChartCtx } from './core.tsx';
import type { ChartPointTarget, ChartTone } from './ULCartesianChart.tsx';
import type { ContextMenuProps } from '../components/ULContainers/contextTarget.tsx';
import { useMarkNav, arcStroke, polar, advText, baseFrame, useDrawOnce, focusMarkIn, ctxResolve, type ChartBaseProps } from './nav.tsx';
import './charts-adv.css';

/* ---------------- radial bar / progress ring group ---------------- */
export interface ULRadialChartProps<T = Record<string, unknown>> extends ChartBaseProps {
  /** Rows. */ data: T[];
  /** Category label accessor (d, i) => string. */ label: (d: T, i: number) => string;
  /** Value accessor (d, i) => number. */ value: (d: T, i: number) => number;
  /** Full-ring value per item (number or accessor). Default 100. */
  max?: number | ((d: T, i: number) => number);
  /** Sweep in degrees (90–360). Default 270 (open at the bottom). */
  sweep?: number;
  /** Centre slot (e.g. <ULRollingNumber>). Default: the first ring's share. */
  center?: React.ReactNode;
  /** Content in the centre (e.g. a ULRollingNumber total). */ centerLabel?: React.ReactNode;
}
export function ULRadialChart<T>(props: ULRadialChartProps<T>) {
  const [ctx, p] = splitChartCtx(props);
  const { data, label, value, locale, title } = p;
  const id = useDomId('ul-rd');
  const L = (k: Parameters<typeof chartText>[0]) => chartText(k, locale);
  const H = p.height ?? 240;
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const [hidden, setHidden] = React.useState<string[]>([]);
  const fmtN = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fmt = (v: number) => (p.format ? p.format(v) : fmtN(v));
  const pct = makeNumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const items = React.useMemo(() => data.map((d, i) => { const mx = typeof p.max === 'function' ? p.max(d, i) : p.max ?? 100; return { key: label(d, i), name: label(d, i), value: value(d, i) || 0, max: mx > 0 ? mx : 1, slot: slotOf(i) }; }), [data, p.max]);
  const pol = usePatternPolicy(p.patterns, items.length);
  const w = items.map((s) => (hidden.includes(s.key) ? 0 : 1));
  const dataKey = items.map((s) => `${s.key}:${s.value}/${s.max}`).join('|');
  const { frame } = useChartTween({ v: [items.map((s) => Math.max(0, Math.min(1, s.value / s.max)))], w, d: [] }, `${dataKey}#${hidden.join()}`);
  useChangeFade(svgRef, dataKey);
  const sweep = Math.max(90, Math.min(360, p.sweep ?? 270)) * Math.PI / 180;
  const a0 = sweep >= Math.PI * 2 - 1e-3 ? 0 : -sweep / 2, a1 = a0 + sweep;
  const cx = W / 2, cy = H / 2 + (sweep < Math.PI * 1.6 ? H * 0.12 : 0), R = Math.max(30, Math.min(W / 2, H / 2) - 8), n = Math.max(1, items.length);
  const inner = R * 0.42, gap = Math.max(3, R * 0.03), th = Math.max(6, Math.min(18, (R - inner) / n - gap));
  const rOf = (i: number) => R - th / 2 - i * (th + gap);
  const endOf = (i: number) => a0 + (a1 - a0) * (frame.v[0][i] ?? 0) * (frame.w[i] ?? 1);
  useDrawOnce(svgRef, (root, dur, ease) => { root.querySelectorAll('.ul-radial-arc, .ul-radial-hatch').forEach((el) => el.animate([{ strokeDasharray: '0 1' }, { strokeDasharray: '1 0' }], { duration: dur, easing: ease })); root.querySelectorAll('.ul-gloss-cap').forEach((el) => el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1 }], { duration: dur })); });

  const hover = useHoverLayer({ width: W, height: H, plot: { l: 0, t: 0, r: 0, b: 0 }, crosshair: false });
  const pointAt = (i: number) => { const s = items[i], [x, y] = polar(cx, cy, rOf(i), endOf(i)); return { index: i, x, y, title: s.name, beads: [], rows: [{ slot: s.slot, name: '', value: `${fmt(s.value)} / ${fmt(s.max)} · ${pct(s.value / s.max)}`, mark: 'fill' as const }] }; };
  const nav = useMarkNav({ hover, count: items.length, visible: (i) => !!w[i], pointAt, liveRef, onFocusMark: (i) => focusMarkIn(svgRef.current, i) });
  React.useEffect(() => { if (hover.index != null && w[hover.index]) nav.show(hover.index); }, [W, frame]);

  const table = { columns: [L('category'), advText('value', locale), advText('max', locale), L('share')], rows: items.map((s) => [s.name, fmt(s.value), fmt(s.max), pct(s.value / s.max)]) };
  const summary = p.summary ?? items.filter((_, i) => w[i]).map((s) => `${s.name} ${fmt(s.value)} / ${fmt(s.max)} (${pct(s.value / s.max)})`).join(', ') + '.';
  const first = items.findIndex((_, i) => w[i]);
  const plot = (
    <div ref={plotRef} className="ul-chart2-plot ul-radial" style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`} {...nav.bind}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="">
        <defs><ChartPatterns id={id} /></defs>
        {items.map((s, i) => { const r = rOf(i), e = endOf(i), d = arcStroke(cx, cy, r, a0, Math.max(e, a0 + 1e-3)), on = (frame.v[0][i] ?? 0) * (frame.w[i] ?? 1) > 0.004, [ex, ey] = polar(cx, cy, r, e);
          return <g key={s.key} data-mark={i} data-s={s.slot} className="ul-radial-ring">
            <path d={arcStroke(cx, cy, r, a0, a1)} className="ul-radial-track" strokeWidth={th} />
            {on ? <path d={d} className="ul-radial-arc" strokeWidth={th} pathLength={1} /> : null}
            {on && s.slot && pol.fills ? <path d={d} className="ul-radial-hatch ul-chart-hatch" strokeWidth={th - 2} stroke={`url(#${id}-p${s.slot})`} pathLength={1} /> : null}
            {on ? <circle cx={ex} cy={ey} r={Math.max(2, th / 2 - 1.5)} className="ul-gloss-cap" /> : null}
          </g>; })}
      </svg>
      <div className="ul-radial-center" style={{ left: cx, top: cy, width: inner * 1.55 }}>
        {p.center ?? (first >= 0 ? <span className="ul-donut-total">{pct(items[first].value / items[first].max)}</span> : null)}
        <span className="ul-donut-clabel">{p.centerLabel ?? (first >= 0 ? items[first].name : '')}</span>
      </div>
      {hover.layer}
      <span id={`${id}-nav`} className="ul-sr-only">{L('nav')}</span>
    </div>
  );
  const legendItems = items.map((s) => ({ key: s.key, name: s.name, slot: s.slot, mark: 'fill' as const, on: !hidden.includes(s.key), pattern: pol.fills }));
  const node = (
    <ChartFrame {...baseFrame(p, data.length)} summary={summary} height={H} skeleton="donut" table={table} patterns={pol.state} liveRef={liveRef}
      legend={p.legend !== false && items.length > 1 ? <ChartLegend items={legendItems} label={L('series')} onToggle={(k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : h.length + 1 >= items.length ? h : [...h, k]))} onFocusSeries={(k) => focusMarkIn(svgRef.current, k == null ? null : items.findIndex((s) => s.key === k))} /> : null}>
      {plot}
    </ChartFrame>
  );
  return withChartMenu<ChartPointTarget>(node, ctx as ContextMenuProps<ChartPointTarget>, ctxResolve('.ul-radial', () => hover.index, (i) => { const s = items[i]; return s ? { kind: 'point', id: s.key, data: { index: i, label: s.name, values: [{ series: s.name, value: s.value }], max: s.max } } : null; }));
}

/* ---------------- gauge ---------------- */
export interface GaugeThreshold { /** Upper end of the band (the first band starts at min). */ to: number; tone: ChartTone; label?: string }
export interface ULGaugeChartProps extends ChartBaseProps {
  /** Current value; null = empty state. */ value: number | null;
  /** Scale minimum. */ min?: number; /** Scale maximum. */ max?: number;
  /** Bands ({ to, tone, label? }) from min to max. */ thresholds?: GaugeThreshold[];
  /** Target marker value. */ target?: number; /** Label of the target marker. */ targetLabel?: string;
  /** Comparison marker (e.g. last period). */
  compare?: { value: number; label?: string };
  /** 'fill' (default): the value arc fills in the band colour. 'needle': a needle over the bands. */
  mode?: 'fill' | 'needle';
  /** Name of the measured quantity (meter label). Default: the title. */
  label?: string;
  /** Centre content (e.g. <ULRollingNumber>). Default: the formatted value. */
  center?: React.ReactNode;
}
export function ULGaugeChart(props: ULGaugeChartProps) {
  const [ctx, p] = splitChartCtx(props);
  const { min = 0, max = 100, thresholds = [], mode = 'fill', locale, title } = p;
  const id = useDomId('ul-gg');
  const A = (k: Parameters<typeof advText>[0]) => advText(k, locale);
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const fmtN = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fmt = (v: number | null) => (v == null ? '–' : p.format ? p.format(v) : fmtN(v));
  const span = max - min || 1, clamp = (v: number) => Math.max(min, Math.min(max, v));
  const { frame } = useChartTween({ v: [[p.value == null ? null : clamp(p.value)]], w: [], d: [] }, String(p.value));
  const cur = frame.v[0][0];
  const ang = (v: number) => -Math.PI / 2 + Math.PI * ((clamp(v) - min) / span);
  const needle = mode === 'needle';
  const Hs = p.height ?? 200;
  const R = Math.max(40, Math.min(W / 2 - 34, Hs - (needle ? 70 : 40))), cx = W / 2, cy = R + 34, th = Math.max(10, R * 0.17);
  const H = cy + (needle ? 58 : 28);
  const bands = thresholds.map((b, i) => ({ ...b, from: i ? thresholds[i - 1].to : min }));
  const bandOf = (v: number | null) => (v == null ? -1 : bands.findIndex((b) => v <= b.to));
  const tone = (() => { const b = bands[bandOf(p.value)]; return b ? b.tone : 'accent'; })();
  useDrawOnce(svgRef, (root, dur, ease) => {
    root.querySelector('.ul-gauge-fill')?.animate([{ strokeDasharray: '0 1' }, { strokeDasharray: '1 0' }], { duration: dur, easing: ease });
    const nd = root.querySelector<SVGGElement>('.ul-gauge-needle'); if (nd) nd.animate([{ transform: 'rotate(-90deg)' }, { transform: nd.style.transform }], { duration: dur, easing: ease });
  });
  // marks: 0 value, 1 target, 2.. bands
  const hover = useHoverLayer({ width: W, height: H, plot: { l: 0, t: 0, r: 0, b: 0 }, crosshair: false });
  const bandName = (b: typeof bands[number]) => b.label ?? `${fmt(b.from)}–${fmt(b.to)}`;
  const pointAt = (i: number) => {
    if (i === 0) { const [x, y] = polar(cx, cy, R - th / 2, ang(cur ?? min)); return { index: 0, x, y, title: p.label ?? (typeof title === 'string' ? title : A('value')), beads: [], rows: [{ slot: 0, name: A('value'), value: fmt(p.value), mark: 'fill' as const }, ...(p.compare ? [{ slot: 5, name: p.compare.label ?? A('compare'), value: fmt(p.compare.value), mark: 'line' as const }] : [])] }; }
    if (i === 1) { const [x, y] = polar(cx, cy, R + 6, ang(p.target ?? min)); return { index: 1, x, y, title: p.targetLabel ?? A('target'), beads: [], rows: [{ slot: 0, name: '', value: fmt(p.target ?? null), mark: 'line' as const }] }; }
    const b = bands[i - 2], [x, y] = polar(cx, cy, R + 4, (ang(b.from) + ang(b.to)) / 2); return { index: i, x, y, title: bandName(b), beads: [], rows: [{ slot: 0, name: A('band'), value: `${fmt(b.from)} – ${fmt(b.to)}`, mark: 'fill' as const }] };
  };
  const nav = useMarkNav({ hover, count: 2 + bands.length, visible: (i) => i !== 1 || p.target != null, pointAt, liveRef, onFocusMark: (i) => focusMarkIn(svgRef.current, i) });
  const valueText = `${fmt(p.value)}${p.target != null ? ` · ${A('target')} ${fmt(p.target)}` : ''}`;
  const [lx, ly] = polar(cx, cy, R - th / 2, -Math.PI / 2), [rx] = polar(cx, cy, R - th / 2, Math.PI / 2);
  const deg = ((cur == null ? min : cur) - min) / span * 180 - 90;
  const table = { columns: [A('value'), p.label ?? (typeof title === 'string' ? title : A('value'))], rows: [[A('value'), fmt(p.value)], [A('min'), fmt(min)], [A('max'), fmt(max)], ...(p.target != null ? [[p.targetLabel ?? A('target'), fmt(p.target)]] : []), ...(p.compare ? [[p.compare.label ?? A('compare'), fmt(p.compare.value)]] : []), ...bands.map((b) => [bandName(b), `${fmt(b.from)} – ${fmt(b.to)}`])] };
  const summary = p.summary ?? `${p.label ?? (typeof title === 'string' ? title : A('value'))}: ${fmt(p.value)} (${A('min')} ${fmt(min)}, ${A('max')} ${fmt(max)}${p.target != null ? `, ${A('target')} ${fmt(p.target)}` : ''}).`;
  const plot = (
    <div ref={plotRef} className="ul-chart2-plot ul-gauge" data-mode={mode} style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`} {...nav.bind}>
      <span className="ul-sr-only" role="meter" aria-label={p.label ?? (typeof title === 'string' ? title : A('value'))} aria-valuemin={min} aria-valuemax={max} aria-valuenow={p.value ?? undefined} aria-valuetext={valueText}>{valueText}</span>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="">
        <defs><ChartPatterns id={id} /></defs>
        <path d={arcStroke(cx, cy, R - th / 2, -Math.PI / 2, Math.PI / 2)} className="ul-radial-track" strokeWidth={th} />
        {bands.map((b, i) => <path key={i} data-mark={i + 2} data-tone={b.tone} d={arcStroke(cx, cy, needle ? R - th / 2 : R + 5, ang(b.from) + 0.006, ang(b.to) - 0.006)} className="ul-gauge-band" data-needle={needle ? '' : undefined} strokeWidth={needle ? th : 4} />)}
        {!needle && cur != null && cur > min ? <g data-mark={0}><path d={arcStroke(cx, cy, R - th / 2, -Math.PI / 2, ang(cur))} className="ul-gauge-fill" data-tone={tone} strokeWidth={th} pathLength={1} /><circle className="ul-gloss-cap" {...(() => { const [x, y] = polar(cx, cy, R - th / 2, ang(cur)); return { cx: x, cy: y }; })()} r={Math.min(th / 2 - 2, 6)} /></g> : null}
        {needle ? <g data-mark={0} className="ul-gauge-needle" style={{ transform: `rotate(${deg}deg)`, transformOrigin: `${cx}px ${cy}px` }}><path d={`M${cx - 3.5} ${cy}L${cx} ${cy - R + th + 4}L${cx + 3.5} ${cy}Z`} /><circle cx={cx} cy={cy} r={7} /></g> : null}
        {p.target != null ? (() => { const a = ang(p.target), [x0, y0] = polar(cx, cy, R - th - 3, a), [x1, y1] = polar(cx, cy, R + 9, a), [tx, ty] = polar(cx, cy, R + 20, a); return <g data-mark={1} className="ul-gauge-target"><line x1={x0} y1={y0} x2={x1} y2={y1} /><text x={tx} y={ty} textAnchor={a < -0.2 ? 'end' : a > 0.2 ? 'start' : 'middle'} className="ul-chart-tick">{fmt(p.target)}</text></g>; })() : null}
        {p.compare ? (() => { const a = ang(p.compare.value), [x0, y0] = polar(cx, cy, R - th - 9, a), [x1, y1] = polar(cx, cy, R - th + 2, a); return <line className="ul-gauge-compare" x1={x0} y1={y0} x2={x1} y2={y1} />; })() : null}
        <text x={lx} y={ly + 16} textAnchor="middle" className="ul-chart-tick">{fmt(min)}</text>
        <text x={rx} y={ly + 16} textAnchor="middle" className="ul-chart-tick">{fmt(max)}</text>
      </svg>
      <div className="ul-gauge-center" style={{ left: cx, top: needle ? cy + 30 : cy - 4, maxWidth: (R - th) * 1.6 }} aria-hidden="true">
        {p.center ?? <span className="ul-gauge-value">{fmt(p.value)}</span>}
        {p.compare ? <span className="ul-donut-clabel">{p.compare.label ?? A('compare')} {fmt(p.compare.value)}</span> : null}
      </div>
      {hover.layer}
      <span id={`${id}-nav`} className="ul-sr-only">{A('gaugeNav')}</span>
    </div>
  );
  const node = <ChartFrame {...baseFrame(p, p.value == null ? 0 : 1)} summary={summary} height={H} skeleton="gauge" table={table} patterns={'off'} liveRef={liveRef}>{plot}</ChartFrame>;
  return withChartMenu<ChartPointTarget>(node, ctx as ContextMenuProps<ChartPointTarget>, ctxResolve('.ul-gauge', () => hover.index, (i) => i === 0 ? { kind: 'value', data: { label: A('value'), values: [{ series: A('value'), value: p.value }] } } : i === 1 ? { kind: 'target', data: { label: A('target'), values: [{ series: A('target'), value: p.target ?? null }] } } : bands[i - 2] ? { kind: 'band', id: String(i - 2), data: { index: i - 2, label: bandName(bands[i - 2]), from: bands[i - 2].from, to: bands[i - 2].to } } : null));
}
