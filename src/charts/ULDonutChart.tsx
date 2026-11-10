/**
 * ULDonutChart (pie with innerRadius 0) and ULSparkChart (line, area, bars, win/loss) on the shared chart core.
 */
import * as React from 'react';
import type { Accent } from '../glass/accent.tsx';
import type { ContextMenuProps } from '../components/ULContainers/contextTarget.tsx';
import { cx, useDomId } from '../components/shared/icons.tsx';
import { isMorphReduced, getMorphTimeScale } from '../motion/anchoredMorph.ts';
import { springs } from '../motion/spring.ts';
import { arcPath, linePath, areaPath, makeNumberFormat } from './scales.ts';
import { ChartFrame, ChartLegend, ChartPatterns, slotOf, chartText, useWidth, useChartTween, useChangeFade, useHoverLayer, withChartMenu, splitChartCtx, usePatternPolicy, type PatternMode, type ChartState } from './core.tsx';
import type { ChartPointTarget } from './ULCartesianChart.tsx';

export interface ULDonutChartProps<T = Record<string, unknown>> extends ContextMenuProps<ChartPointTarget> {
  /** Rows. */ data: T[];
  /** Category label accessor (d, i) => string. */ label: (d: T, i: number) => string;
  /** Value accessor (d, i) => number. */ value: (d: T, i: number) => number;
  /** 'donut' (default) or 'pie'. */
  variant?: 'donut' | 'pie';
  /** Slices below this share (0–1) merge into one "Other" slice. Default 0 (off). */
  mergeBelow?: number;
  /** Centre slot (donut): any content, e.g. <ULRollingNumber>. Default: the total. */
  center?: React.ReactNode;
  /** Content in the centre (e.g. a ULRollingNumber total). */ centerLabel?: React.ReactNode;
  /** Chart title (panel heading, names the figure). */ title: React.ReactNode; /** Short description under the title. */ description?: React.ReactNode; /** Text summary for screen readers (read before the data table). */ summary?: string; /** Plot height in px. */ height?: number; /** "en" | "sk" | "de" | "cs" for numbers, dates and built-in strings. Default "en". */ locale?: string;
  /** Intl.NumberFormat options for values (tooltip, table, legend). */ valueFormat?: Intl.NumberFormatOptions; /** Formats values for ticks, tooltip and table: Intl options or (v) => string. */ format?: (v: number) => string;
  /** Accent colour of the panel; series colours derive from it (--ul-chart-s0…s5). */ accent?: Accent; /** Wrap in the one glass chart panel. Default true; false for embedding in another surface. */ panel?: boolean; /** Extra class on the panel. */ className?: string; /** Show the legend (toggles series). Default true for more than one series. */ legend?: boolean; /** Show the toolbar (table, copy, CSV). Default true. */ toolbar?: boolean; /** Base file name of the CSV export. */ filename?: string;
  /** "ready" | "loading" | "empty" | "error" — skeleton, empty and error states keep the panel size. */ state?: ChartState; /** Error state Retry action. */ onRetry?: () => unknown; /** Error state text. Default localised. */ errorMessage?: React.ReactNode; /** Empty state content. Default localised "No data". */ empty?: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }; /** Stale badge (true or a custom label) when the data is old. */ stale?: boolean | string; /** Open with the data table shown. Default false. */ defaultTable?: boolean;
  /** auto (default): slice patterns only with > 4 slices or high-contrast mode. on | off. */
  patterns?: PatternMode;
}
interface Slice { key: string; name: string; value: number; slot: number; merged?: string[] }
const tok = (k: string, f: number) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };

export function ULDonutChart<T>(props: ULDonutChartProps<T>) {
  const [ctx, p] = splitChartCtx(props);
  const { data, label, value, variant = 'donut', mergeBelow = 0, locale, title } = p;
  const id = useDomId('ul-dn');
  const L = (k: Parameters<typeof chartText>[0]) => chartText(k, locale);
  const H = p.height ?? 240;
  const plotRef = React.useRef<HTMLDivElement | null>(null), svgRef = React.useRef<SVGSVGElement | null>(null), liveRef = React.useRef<HTMLDivElement | null>(null);
  const W = useWidth(plotRef);
  const [hidden, setHidden] = React.useState<string[]>([]);
  const fmtN = React.useMemo(() => makeNumberFormat(locale, p.valueFormat), [locale, p.valueFormat]);
  const fmt = (v: number) => (p.format ? p.format(v) : fmtN(v));
  const pct = makeNumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const slices: Slice[] = React.useMemo(() => {
    const all = data.map((d, i) => ({ key: label(d, i), name: label(d, i), value: Math.max(0, value(d, i) || 0) }));
    const tot = all.reduce((a, s) => a + s.value, 0) || 1;
    const keep = all.filter((s) => s.value / tot >= mergeBelow), small = all.filter((s) => s.value / tot < mergeBelow);
    const out: Slice[] = keep.map((s, i) => ({ ...s, slot: slotOf(i) }));
    if (small.length > 1) out.push({ key: '__other', name: L('other'), value: small.reduce((a, s) => a + s.value, 0), slot: 5, merged: small.map((s) => s.name) });
    else if (small.length === 1) out.push({ ...small[0], slot: slotOf(out.length) });
    return out;
  }, [data, mergeBelow, locale]);
  const pol = usePatternPolicy(p.patterns, slices.length);
  const dataKey = slices.map((s) => s.key + ':' + s.value).join('|');
  const w = slices.map((s) => (hidden.includes(s.key) ? 0 : 1));
  const { frame } = useChartTween({ v: [slices.map((s) => s.value)], w, d: [] }, `${dataKey}#${hidden.join()}`);
  useChangeFade(svgRef, dataKey);
  const vals = frame.v[0].map((v, i) => (v ?? 0) * frame.w[i]), total = vals.reduce((a, b) => a + b, 0);
  const shownTotal = slices.reduce((a, s, i) => a + (w[i] ? s.value : 0), 0);
  const cxp = W / 2, cyp = H / 2, R = Math.max(20, Math.min(H, W) / 2 - 8), r0 = variant === 'pie' ? 0 : R * 0.64;
  const angles: [number, number][] = []; { let a = 0; for (const v of vals) { const span = total ? (v / total) * Math.PI * 2 : 0; angles.push([a, a + span]); a += span; } }

  // draw-in: one sweep on mount (mask stroke), reduced = fade
  React.useLayoutEffect(() => {
    const m = svgRef.current?.querySelector<SVGCircleElement>('.ul-donut-sweep'); if (!m) return;
    if (isMorphReduced()) { svgRef.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: tok('--ul-chart-fade', 150) }); return; }
    m.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: tok('--ul-chart-draw', 900) * getMorphTimeScale(), easing: springs.smooth.toCSS(), fill: 'backwards' });
  }, []);

  const hover = useHoverLayer({ width: W, height: H, plot: { l: 0, t: 0, r: 0, b: 0 }, crosshair: false });
  const focusSlice = (i: number | null) => { const g = svgRef.current; if (!g) return; g.querySelector('.ul-donut-seg[data-on]')?.removeAttribute('data-on'); if (i == null || i < 0) { delete g.dataset.hot; return; } g.dataset.hot = ''; g.querySelector(`.ul-donut-seg[data-seg="${i}"]`)?.setAttribute('data-on', ''); };
  const pointAt = (i: number) => {
    const [a0, a1] = angles[i], mid = (a0 + a1) / 2, rr = (R + r0) / 2 || R * 0.6, s = slices[i];
    const sh = shownTotal ? s.value / shownTotal : 0;
    return { index: i, x: cxp + Math.sin(mid) * rr, y: cyp - Math.cos(mid) * rr, title: s.name, beads: [], rows: [{ slot: s.slot, name: s.merged ? s.merged.join(', ') : L('share'), value: `${fmt(s.value)} · ${pct(sh)}`, mark: 'fill' as const }] };
  };
  const latest = React.useRef(pointAt); latest.current = pointAt;
  const visIdx = slices.map((_, i) => i).filter((i) => w[i]);
  const showIdx = (i: number | null, say = false) => {
    focusSlice(i); hover.show(i == null ? null : latest.current(i));
    if (say && i != null && liveRef.current) { const pt = latest.current(i); liveRef.current.textContent = `${pt.title}: ${pt.rows[0].value}`; }
  };
  const segOf = (t: EventTarget | null) => { const el = (t as Element | null)?.closest?.('[data-seg]'); return el ? +(el as HTMLElement).dataset.seg! : null; };
  const onKey = (e: React.KeyboardEvent) => {
    if (!visIdx.length) return;
    const cur = hover.index, pos = cur == null ? -1 : visIdx.indexOf(cur);
    let i: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = visIdx[(pos + 1) % visIdx.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = visIdx[(pos - 1 + visIdx.length) % visIdx.length];
    else if (e.key === 'Home') i = visIdx[0]; else if (e.key === 'End') i = visIdx[visIdx.length - 1];
    else if (e.key === 'Enter' || e.key === ' ') { hover.pin(!hover.pinned); i = cur ?? visIdx[0]; }
    else if (e.key === 'Escape') { hover.pin(false); showIdx(null); return; }
    else return;
    e.preventDefault(); showIdx(i, true);
  };
  React.useEffect(() => { if (hover.index != null && w[hover.index]) showIdx(hover.index); }, [W, frame]);

  const table = { columns: [L('category'), typeof title === 'string' ? title : L('total'), L('share')], rows: slices.map((s) => [s.merged ? `${s.name} (${s.merged.join(', ')})` : s.name, fmt(s.value), pct(s.value / (slices.reduce((a, x) => a + x.value, 0) || 1))]) };
  const summary = p.summary ?? `${L('total')} ${fmt(shownTotal)}. ` + slices.filter((_, i) => w[i]).map((s) => `${s.name} ${pct(s.value / (shownTotal || 1))}`).join(', ') + '.';
  const C = 2 * Math.PI * ((R + r0) / 2 || R / 2);
  const plot = (
    <div ref={plotRef} className="ul-chart2-plot ul-donut" style={{ height: H }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={typeof title === 'string' ? title : undefined} aria-describedby={`${id}-nav`}
      onPointerMove={(e) => { if (hover.pinned) return; const i = segOf(e.target); if (i !== hover.index) showIdx(i); }}
      onPointerLeave={() => { if (!hover.pinned) showIdx(null); }}
      onClick={(e) => { const i = segOf(e.target); if (hover.pinned) { hover.pin(false); showIdx(i); } else if (i != null) { showIdx(i); hover.pin(true); } }}
      onKeyDown={onKey} onBlur={() => { if (!hover.pinned) showIdx(null); }}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-ul-illustration="">
        <defs>
          <ChartPatterns id={id} />
          <mask id={`${id}-m`}><circle className="ul-donut-sweep" cx={cxp} cy={cyp} r={(R + 6) / 2} fill="none" stroke="#fff" strokeWidth={R + 6} pathLength={1} strokeDasharray="1 1" transform={`rotate(-90 ${cxp} ${cyp})`} /></mask>
        </defs>
        <g mask={`url(#${id}-m)`}>
          {slices.map((s, i) => { const [a0, a1] = angles[i]; if (a1 - a0 < 0.0005) return null; const mid = (a0 + a1) / 2; const d = arcPath(cxp, cyp, r0, R, a0, a1, 2);
            return <g key={s.key} className="ul-donut-seg" data-seg={i} data-s={s.slot} style={{ '--dx': `${(Math.sin(mid)).toFixed(3)}`, '--dy': `${(-Math.cos(mid)).toFixed(3)}` } as React.CSSProperties}>
              <path d={d} className="ul-donut-path" />{s.slot && pol.fills ? <path d={d} className="ul-chart-hatch" fill={`url(#${id}-p${s.slot})`} /> : null}
            </g>; })}
        </g>
        {r0 ? <circle cx={cxp} cy={cyp} r={r0 - 1} className="ul-donut-hole" /> : null}
      </svg>
      {r0 ? <div className="ul-donut-center" style={{ width: r0 * 1.5 }}>{p.center ?? <span className="ul-donut-total">{fmt(shownTotal)}</span>}<span className="ul-donut-clabel">{p.centerLabel ?? L('total')}</span></div> : null}
      {hover.layer}
      <span id={`${id}-nav`} className="ul-sr-only">{L('nav')}</span>
    </div>
  );
  void C;
  const legendItems = slices.map((s) => ({ key: s.key, name: s.name, slot: s.slot, mark: 'fill' as const, on: !hidden.includes(s.key), pattern: pol.fills }));
  const node = (
    <ChartFrame title={title} description={p.description} summary={summary} locale={locale} accent={p.accent} panel={p.panel} className={p.className}
      state={!data.length && (p.state ?? 'ready') === 'ready' ? 'empty' : p.state} onRetry={p.onRetry} errorMessage={p.errorMessage} empty={p.empty} stale={p.stale}
      height={H} skeleton="donut" table={table} patterns={pol.state} toolbar={p.toolbar} filename={p.filename} defaultTable={p.defaultTable} liveRef={liveRef}
      legend={p.legend !== false ? <ChartLegend items={legendItems} label={L('series')} onToggle={(k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : h.length + 1 >= slices.length ? h : [...h, k]))} onFocusSeries={(k) => focusSlice(k == null ? null : slices.findIndex((s) => s.key === k))} /> : null}>
      {plot}
    </ChartFrame>
  );
  return withChartMenu<ChartPointTarget>(node, ctx as ContextMenuProps<ChartPointTarget>, (hit) => {
    const chip = hit.closest<HTMLElement>('.ul-chart-lchip'); if (chip) return { kind: 'series', id: chip.dataset.key, data: { series: chip.dataset.key }, el: chip };
    const pl = hit.closest<HTMLElement>('.ul-donut'); if (!pl) return null;
    const i = segOf(hit) ?? hover.index;
    if (i != null) { const s = slices[i]; return { kind: 'point', id: s.key, data: { index: i, label: s.name, values: [{ series: s.name, value: s.value }] }, el: pl }; }
    return { kind: 'plot', data: {}, el: pl };
  });
}
export function ULPieChart<T>(p: Omit<ULDonutChartProps<T>, 'variant'>) { return <ULDonutChart {...p} variant="pie" />; }

/* ---------------- Sparkline variants ---------------- */
export interface ULSparkChartProps {
  /** Values (oldest first). */ data: (number | null)[];
  /** "line" (default) | "area" | "bars" | "winloss". */ variant?: 'line' | 'area' | 'bars' | 'winloss';
  /** Width in px or CSS length. */ width?: number | string; /** Plot height in px. */ height?: number;
  /** Palette slot or tone. 'auto' (winloss/bars): positive = series, negative = danger. */
  slot?: number;
  /** Accessible label; without it the sparkline is decorative (aria-hidden), the host (KPI card, table cell) states the value. */
  label?: string;
  /** Reference line (e.g. target or 0). */
  reference?: number;
  /** Highlight the last point (bead) / bar. Default true. */
  emphasizeLast?: boolean;
  /** Draw in once and morph on real data change (reduced motion = fade). Default true. */ animate?: boolean;
  /** Extra class on the panel. */ className?: string;
}
/** Small inline chart for ULKpiCard (trend prop) and table cells. No axes, no tooltip, no glass. Draws in once; identical data never re-animates. */
export function ULSparkChart({ data, variant = 'line', width = '100%', height = 28, slot = 0, label, reference, emphasizeLast = true, animate = true, className }: ULSparkChartProps) {
  const id = useDomId('ul-sk');
  const svg = React.useRef<SVGSVGElement | null>(null);
  const key = data.join(',');
  const VW = 100, n = data.length, pad = 2;
  const nums = data.filter((v): v is number => v != null);
  const lo = Math.min(0, ...(variant === 'bars' || variant === 'winloss' ? nums : []), ...(variant === 'line' || variant === 'area' ? nums : []), reference ?? Infinity), hi = Math.max(...nums, reference ?? -Infinity, variant === 'bars' ? 0 : -Infinity);
  const lo2 = variant === 'line' || variant === 'area' ? Math.min(...nums, reference ?? Infinity) : lo;
  const Y = (v: number) => pad + (1 - (v - lo2) / (hi - lo2 || 1)) * (height - 2 * pad);
  const X = (i: number) => (n > 1 ? (i / (n - 1)) * VW : VW / 2);
  const first = React.useRef(true), prevKey = React.useRef(key);
  React.useLayoutEffect(() => {
    const el = svg.current; if (!el || !animate) return;
    if (!first.current && prevKey.current === key) return;
    const wasFirst = first.current; first.current = false; prevKey.current = key;
    if (isMorphReduced()) { if (!wasFirst) el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150 }); return; }
    if (!wasFirst) return;
    const dur = tok('--ul-kpi-spark-draw', 700) * getMorphTimeScale();
    el.querySelector('.ul-spk-line')?.animate([{ strokeDasharray: '0 1' }, { strokeDasharray: '1 0' }], { duration: dur, easing: springs.smooth.toCSS() });
    el.querySelectorAll('.ul-spk-bars, .ul-spk-area').forEach((g) => g.animate([{ clipPath: variant === 'area' ? 'inset(0 100% 0 0)' : 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: dur, easing: springs.snappy.toCSS() }));
  }, [key]);
  let body: React.ReactNode = null;
  if (variant === 'line' || variant === 'area') {
    const pts = data.map((v, i) => (v == null ? null : [X(i), Y(v)] as [number, number]));
    const base = data.map((v, i) => (v == null ? null : [X(i), height - pad] as [number, number]));
    const lastI = data.map((v, i) => (v == null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
    body = <>
      {variant === 'area' ? <path className="ul-spk-area" d={areaPath(pts, base, 'monotone')} fill={`url(#${id}-a)`} /> : null}
      <path className="ul-spk-line" d={linePath(pts, 'monotone')} pathLength={1} strokeDasharray="1 0" fill="none" vectorEffect="non-scaling-stroke" />
    </>;
    if (emphasizeLast && lastI >= 0) body = <>{body}</>;
    return (
      <span className={cx('ul-spk', className)} data-s={slot} style={{ width, height }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <svg ref={svg} viewBox={`0 0 ${VW} ${height}`} preserveAspectRatio="none" width="100%" height={height} data-ul-illustration="">
          <defs><linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="ul-spk-stop" data-at="0" /><stop offset="1" className="ul-spk-stop" data-at="1" /></linearGradient></defs>
          {reference != null ? <line x1="0" x2={VW} y1={Y(reference)} y2={Y(reference)} className="ul-spk-ref" vectorEffect="non-scaling-stroke" /> : null}
          {body}
        </svg>
        {emphasizeLast && lastI >= 0 ? <span className="ul-spk-bead" style={{ left: `${(X(lastI) / VW) * 100}%`, top: `${(Y(data[lastI]!) / height) * 100}%` }}></span> : null}
      </span>
    );
  }
  const step = VW / Math.max(1, n), bw = step * 0.68;
  const zero = variant === 'winloss' ? height / 2 : Y(Math.max(lo, Math.min(0, hi)));
  body = <g className="ul-spk-bars">{data.map((v, i) => {
    if (v == null) return null;
    const x = i * step + (step - bw) / 2, neg = v < 0;
    const [y, h] = variant === 'winloss' ? (v === 0 ? [zero - 1, 2] : neg ? [zero + 1, height / 2 - pad - 1] : [pad, zero - pad - 1]) : neg ? [zero, Y(v) - zero] : [Y(v), zero - Y(v)];
    return <rect key={i} x={x} y={y} width={bw} height={Math.max(1, h)} rx={Math.min(1.5, bw / 3)} className="ul-spk-bar" data-neg={neg ? '' : undefined} data-last={emphasizeLast && i === n - 1 ? '' : undefined} />;
  })}</g>;
  return (
    <span className={cx('ul-spk', className)} data-s={slot} data-v={variant} style={{ width, height }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg ref={svg} viewBox={`0 0 ${VW} ${height}`} preserveAspectRatio="none" width="100%" height={height} data-ul-illustration="">
        {variant === 'winloss' ? <line x1="0" x2={VW} y1={zero} y2={zero} className="ul-spk-ref" vectorEffect="non-scaling-stroke" /> : reference != null ? <line x1="0" x2={VW} y1={Y(reference)} y2={Y(reference)} className="ul-spk-ref" vectorEffect="non-scaling-stroke" /> : null}
        {body}
      </svg>
    </span>
  );
}
