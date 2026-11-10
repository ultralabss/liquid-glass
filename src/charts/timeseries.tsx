/**
 * Time-series interaction on top of ULCartesianChart: zoom / pan / range brush (ZoomHost, registered into the chart),
 * pure zoom maths (tested), the overview strip, and streaming: createChartStream (appendPoint / setWindow, bounded
 * buffer, one commit per frame, pause queue, stale) + ULStreamChart (sliding window, pulsing latest bead, live status).
 * Rules: the wheel zooms only with Ctrl / Cmd (pinch on trackpads arrives as Ctrl+wheel) and never blocks page scroll;
 * touch: pinch zooms, one finger pans; drag = brush, Shift+drag = pan; Esc cancels a brush; double-click resets.
 */
import * as React from 'react';
import { ULButton } from '../components/ULButton/ULButton.tsx';
import { ULLiveStatus } from '../live/ULLiveStatus.tsx';
import type { LiveSource, LiveStatus } from '../live/liveSource.ts';
import type { TimeRangeValue } from '../components/dashboard/blocks.tsx';
import { isMorphReduced } from '../motion/anchoredMorph.ts';
import { linePath, scaleLinear, chartLocale } from './scales.ts';
import { CartesianBody, registerZoomHost, type ULCartesianChartProps, type ChartInteraction } from './ULCartesianChart.tsx';
import { useBrush, advText, type BrushRect } from './nav.tsx';
import { lttb } from './decimate.ts';
import './charts-adv.css';

/* ---------------- pure zoom maths ---------------- */
export type Span = [number, number];
/** Zoom around `center` by `factor` (< 1 zooms in), clamped to the full extent and a minimum span. */
export function zoomAt(view: Span, full: Span, center: number, factor: number, minSpan: number): Span {
  const fs = full[1] - full[0], span = Math.max(minSpan, Math.min(fs, (view[1] - view[0]) * factor));
  const k = (center - view[0]) / (view[1] - view[0] || 1);
  return clampView([center - span * k, center - span * k + span], full);
}
export function panBy(view: Span, full: Span, delta: number): Span { return clampView([view[0] + delta, view[1] + delta], full); }
export function clampView(v: Span, full: Span): Span {
  let [a, b] = v; const span = Math.min(b - a, full[1] - full[0]);
  if (a < full[0]) { a = full[0]; b = a + span; } if (b > full[1]) { b = full[1]; a = b - span; }
  return [a, b];
}
export const isFull = (v: Span, full: Span) => Math.abs(v[0] - full[0]) < 1e-6 * (full[1] - full[0] || 1) && Math.abs(v[1] - full[1]) < 1e-6 * (full[1] - full[0] || 1);
/** onRangeChange payload: the ULTimeRange value shape (preset 'custom'); category charts send indices as numbers in from / to via Date(ms = index). */
export const rangeValue = (v: Span): TimeRangeValue => ({ preset: 'custom', from: new Date(v[0]), to: new Date(v[1]), interval: 0 });
const lowerBound = (a: ArrayLike<number>, v: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };
const upperBound = (a: ArrayLike<number>, v: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m + 1; else hi = m; } return lo - 1; };
/** Visible index range for a view (time: values; category: rounded indices). */
export function sliceFor(xs: ArrayLike<number>, v: Span, time: boolean): [number, number] {
  if (!time) return [Math.max(0, Math.ceil(v[0] - 1e-9)), Math.min(xs.length - 1, Math.floor(v[1] + 1e-9))];
  return [lowerBound(xs, v[0]), upperBound(xs, v[1])];
}

/* ---------------- ZoomHost ---------------- */
type Geom = Parameters<NonNullable<ChartInteraction['onGeom']>>[0];
function ZoomHostImpl<T>(props: ULCartesianChartProps<T>) {
  const { data, x, locale } = props;
  const cfg = typeof props.zoom === 'object' ? props.zoom : {};
  const hasBars = props.kind === 'bar' || props.series.some((s) => s.type === 'bar');
  const time = props.xScale === 'time' && !hasBars;
  const xs = React.useMemo(() => Float64Array.from(data.map((d, i) => { if (!time) return i; const v = x(d, i); return v instanceof Date ? v.getTime() : Number(v); })), [data, time]);
  const n = xs.length, full: Span = n ? [xs[0], xs[n - 1]] : [0, 1];
  const minSpan = time ? Math.max((full[1] - full[0]) / 400, n > 1 ? (xs[n - 1] - xs[0]) / (n - 1) * 3 : 1) : Math.min(n - 1, 3);
  const [own, setOwn] = React.useState<Span | null>(null);
  const ctrl = props.range !== undefined;
  const view: Span = ctrl ? (props.range ? clampView([+props.range.from, +props.range.to], full) : full) : own ?? full;
  const vref = React.useRef(view); vref.current = view;
  const geom = React.useRef<Geom | null>(null);
  const [gw, setGw] = React.useState<{ l: number; r: number; W: number } | null>(null);
  const live = React.useRef<HTMLSpanElement | null>(null);
  const spanK = view[1] - view[0] > 864e5 * 2 ? 'd' : view[1] - view[0] > 3e5 ? 'm' : 's';
  const tf = React.useMemo(() => { if (!time) return null; const f = new Intl.DateTimeFormat(chartLocale(locale), spanK === 'd' ? { day: 'numeric', month: 'short' } : spanK === 'm' ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit', second: '2-digit' }); return (v: number) => f.format(v); }, [locale, time, spanK]);
  const xlab = (v: number) => (tf ? tf(v) : (() => { const i = Math.max(0, Math.min(n - 1, Math.round(v))); const xv = n ? x(data[i], i) : ''; return xv instanceof Date ? xv.toLocaleDateString(locale) : String(xv); })());
  const emitT = React.useRef(0);
  const emit = (v: Span | null, now = false) => {
    clearTimeout(emitT.current);
    const go = () => { const full0 = !v || isFull(v, full); props.onRangeChange?.(full0 ? null : rangeValue(v!)); if (live.current) live.current.textContent = full0 ? advText('reset', locale) : `${advText('range', locale)}: ${xlab(v![0])} – ${xlab(v![1])}`; };
    if (now) go(); else emitT.current = window.setTimeout(go, 160);
  };
  const set = (v: Span | null, now = false) => { const nv = v ? clampView(v, full) : null; if (!ctrl) setOwn(nv && !isFull(nv, full) ? nv : null); emit(nv, now); };
  const pxToVal = (px: number) => { const g = geom.current, v = vref.current; if (!g) return v[0]; return v[0] + ((px - g.l) / Math.max(1, g.iw)) * (v[1] - v[0]); };

  // brush (x range): readout = opaque tooltip shape; Esc cancels
  const brush = useBrush({
    mode: 'x', enabled: cfg.brush !== false,
    get plot() { const g = geom.current; return g ? { l: g.l, t: g.t, r: g.r, b: g.b } : { l: 0, t: 0, r: 0, b: 0 }; },
    get W() { return geom.current?.W ?? 0; }, get H() { return geom.current?.H ?? 0; },
    label: (r: BrushRect) => `${xlab(pxToVal(Math.min(r.x0, r.x1)))} – ${xlab(pxToVal(Math.max(r.x0, r.x1)))}`,
    onEnd: (r) => { if (!r) return; const a = pxToVal(Math.min(r.x0, r.x1)), b = pxToVal(Math.max(r.x0, r.x1)); if (b - a >= minSpan * 0.5) set([a, Math.max(b, a + minSpan)], true); },
  } as Parameters<typeof useBrush>[0]);

  // wheel (Ctrl / Cmd only) — native listener so we can preventDefault only when we zoom
  React.useEffect(() => {
    const el = geom.current?.el; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return; // plain wheel scrolls the page
      e.preventDefault();
      const b = el.getBoundingClientRect(), c = pxToVal(e.clientX - b.left);
      set(zoomAt(vref.current, full, c, Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.01), minSpan));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // pointers: Shift+drag / one-finger touch = pan, two fingers = pinch
  const ptr = React.useRef(new Map<number, number>()), pan = React.useRef<{ x: number; v: Span } | null>(null), pinch = React.useRef<{ d: number; v: Span; c: number } | null>(null);
  const local = (e: React.PointerEvent) => e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left;
  const bind = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') { ptr.current.set(e.pointerId, local(e)); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ } }
      if (ptr.current.size === 2) { const [a, b] = [...ptr.current.values()]; pinch.current = { d: Math.abs(a - b) || 1, v: vref.current, c: pxToVal((a + b) / 2) }; pan.current = null; return true; }
      if (e.shiftKey || e.pointerType === 'touch') { pan.current = { x: local(e), v: vref.current }; return e.shiftKey ? true : undefined; }
      brush.bind.onPointerDown(e); return undefined;
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (ptr.current.has(e.pointerId)) ptr.current.set(e.pointerId, local(e));
      if (pinch.current && ptr.current.size === 2) { const [a, b] = [...ptr.current.values()]; const pc = pinch.current; set(zoomAt(pc.v, full, pc.c, pc.d / (Math.abs(a - b) || 1), minSpan)); return true; }
      if (pan.current) { const g = geom.current; if (!g) return true; const dx = local(e) - pan.current.x; if (Math.abs(dx) < 2 && e.pointerType === 'touch') return undefined; const v = pan.current.v; set(panBy(v, full, (-dx / Math.max(1, g.iw)) * (v[1] - v[0]))); return true; }
      return brush.bind.onPointerMove(e) ? true : undefined;
    },
    onPointerUp: (e: React.PointerEvent) => { ptr.current.delete(e.pointerId); if (ptr.current.size < 2) pinch.current = null; if (pan.current) { pan.current = null; emit(vref.current, true); } brush.bind.onPointerUp(); },
    onPointerCancel: (e: React.PointerEvent) => { ptr.current.delete(e.pointerId); pinch.current = null; pan.current = null; brush.cancel(); },
    onClick: () => (brush.swallowClick() ? true : undefined),
    onDoubleClick: () => { set(null, true); return true; },
  };
  const onKey = (e: React.KeyboardEvent) => {
    const v = vref.current, mid = (v[0] + v[1]) / 2, span = v[1] - v[0];
    if (e.key === 'Escape' && brush.cancel()) { e.preventDefault(); return true; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); set(zoomAt(v, full, mid, 1 / 1.5, minSpan), true); return true; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); set(zoomAt(v, full, mid, 1.5, minSpan), true); return true; }
    if (e.key === '0') { e.preventDefault(); set(null, true); return true; }
    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); set(panBy(v, full, (e.key === 'ArrowLeft' ? -0.2 : 0.2) * span), true); return true; }
    return false;
  };
  const zoomed = !isFull(view, full);
  const [a, b] = sliceFor(xs, view, time);
  const slice = React.useMemo(() => data.slice(a, b + 1), [data, a, b]);

  // overview strip (series 0 over the full extent, window rect, drag to pan, click to centre)
  const ov = cfg.overview && gw && n > 1 ? (() => {
    const s0 = props.series[0], Wd = gw.W, OH = 44;
    const sx = scaleLinear(full, [gw.l, Wd - gw.r]);
    const vals = data.map((d, i) => s0.value(d, i) ?? null), nums = vals.filter((v): v is number => v != null);
    const lo = Math.min(...nums), hi = Math.max(...nums), sy = scaleLinear([lo, hi === lo ? lo + 1 : hi], [OH - 4, 4]);
    const keep = lttb(xs, vals, Math.max(32, Math.round(Wd)));
    const d = linePath(keep.map((i) => (vals[i] == null ? null : [sx(xs[i]), sy(vals[i]!)] as [number, number])), 'linear');
    const x0 = sx(view[0]), x1 = sx(view[1]);
    const drag = (e: React.PointerEvent<SVGSVGElement>) => {
      const box = e.currentTarget.getBoundingClientRect(), px = e.clientX - box.left, v = vref.current, span = v[1] - v[0];
      const inside = px >= sx(v[0]) && px <= sx(v[1]);
      const start = { px, v }; e.currentTarget.setPointerCapture(e.pointerId);
      if (!inside) { const c = sx.invert(px); set([c - span / 2, c + span / 2], true); return; }
      const mv = (ev: PointerEvent) => set(panBy(start.v, full, ((ev.clientX - box.left - start.px) / Math.max(1, Wd - gw.l - gw.r)) * (full[1] - full[0])));
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); emit(vref.current, true); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
    return (
      <div className="ul-chart-overview" aria-hidden="true">
        <svg width={Wd} height={OH} viewBox={`0 0 ${Wd} ${OH}`} data-ul-illustration="" onPointerDown={drag}>
          <path d={d} className="ul-chart-ov-line" data-s={s0.slot ?? 0} />
          <rect x={gw.l} y={0} width={Math.max(0, x0 - gw.l)} height={OH} className="ul-chart-ov-dim" />
          <rect x={x1} y={0} width={Math.max(0, Wd - gw.r - x1)} height={OH} className="ul-chart-ov-dim" />
          <rect x={x0} y={1} width={Math.max(2, x1 - x0)} height={OH - 2} rx={4} className="ul-chart-ov-win" />
        </svg>
      </div>
    );
  })() : null;

  const ix: ChartInteraction = {
    bind: bind as unknown as ChartInteraction['bind'], onKey, indexOffset: a,
    layer: <>{brush.layer}<span ref={live} className="ul-sr-only" aria-live="polite"></span></>,
    onGeom: (g) => { geom.current = g; if (!gw || gw.l !== g.l || gw.r !== g.r || gw.W !== g.W) setGw({ l: g.l, r: g.r, W: g.W }); },
    tools: zoomed ? <ULButton variant="plain" size="sm" onClick={() => set(null, true)}>{advText('reset', locale)}</ULButton> : null,
    footer: ov,
  };
  return <CartesianBody {...props} data={slice} xDomain={time ? view : props.xDomain} animate={false} ix={ix} description={props.description ?? undefined} />;
}
registerZoomHost(ZoomHostImpl as never);

/* ---------------- streaming ---------------- */
export interface ChartStreamOptions<P> { time: (p: P) => number; windowMs: number; maxPoints?: number; staleAfter?: number }
export interface ChartStreamSnapshot<P> { points: P[]; version: number; pending: number; lastT: number; lastAt: number; interval: number; windowMs: number }
export interface ChartStream<P> extends Omit<LiveSource<P>, 'subscribe'> {
  appendPoint(p: P | P[]): void;
  setWindow(ms: number): void;
  /** One notification per animation frame at most. */
  subscribe(fn: () => void): () => void;
  snapshot(): ChartStreamSnapshot<P>;
  /** Hold (hover / pin): commits stop, appended points count as pending. Independent of the user pause. */
  hold(on: boolean): void;
  /** Feed from a LiveSource (already batched per frame); map returns the point(s) or null. Returns the unsubscribe. */
  connect<M>(source: LiveSource<M>, map: (m: M) => P | P[] | null | undefined): () => void;
}
export function createChartStream<P>(o: ChartStreamOptions<P>): ChartStream<P> {
  const max = o.maxPoints ?? 20000, staleAfter = o.staleAfter ?? 5000;
  let buf: P[] = [], incoming: P[] = [], windowMs = o.windowMs, version = 0, pending = 0, lastT = 0, lastAt = 0, interval = 1000, raf = 0, userPaused = false, held = 0;
  let snap: ChartStreamSnapshot<P> = { points: [], version: 0, pending: 0, lastT: 0, lastAt: 0, interval, windowMs };
  let status: LiveStatus = 'connecting', staleT = 0;
  const subs = new Set<() => void>(), stat = new Set<(s: LiveStatus) => void>();
  const setStatus = (s: LiveStatus) => { if (s === status) return; status = s; stat.forEach((f) => f(s)); };
  const paused = () => userPaused || held > 0;
  const armStale = () => { clearTimeout(staleT); staleT = window.setTimeout(() => setStatus('stale'), staleAfter); };
  const commit = () => {
    raf = 0;
    if (incoming.length) {
      const add = incoming; incoming = [];
      for (const p of add) { const t = o.time(p); if (buf.length && t < o.time(buf[buf.length - 1])) continue; if (buf.length) interval = interval * 0.8 + (t - o.time(buf[buf.length - 1])) * 0.2; buf.push(p); lastT = t; }
      lastAt = performance.now();
      const cut = lastT - windowMs * 1.5; let k = 0; while (k < buf.length - 2 && o.time(buf[k]) < cut) k++;
      if (k) buf = buf.slice(k); if (buf.length > max) buf = buf.slice(buf.length - max);
      if (paused()) pending += add.length;
      if (!paused()) setStatus('live'); armStale();
    }
    if (paused()) { snap = { ...snap, pending }; subs.forEach((f) => f()); return; }
    version++; pending = 0;
    snap = { points: buf.slice(), version, pending: 0, lastT, lastAt, interval, windowMs };
    subs.forEach((f) => f());
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(commit); };
  const api: ChartStream<P> = {
    appendPoint(p) { if (Array.isArray(p)) incoming.push(...p); else incoming.push(p); schedule(); },
    setWindow(ms) { windowMs = Math.max(1, ms); snap = { ...snap, windowMs }; schedule(); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    snapshot: () => snap,
    hold(on) { held = Math.max(0, held + (on ? 1 : -1)); if (paused()) setStatus('paused'); else { setStatus(status === 'stale' ? 'stale' : 'live'); schedule(); } subs.forEach((f) => f()); },
    connect(source, map) { return source.subscribe((batch) => { const out: P[] = []; for (const m of batch) { const r = map(m); if (r == null) continue; if (Array.isArray(r)) out.push(...r); else out.push(r); } if (out.length) api.appendPoint(out); }); },
    // LiveSource-compatible status surface (ULLiveStatus)
    onStatus(fn) { stat.add(fn as (s: LiveStatus) => void); return () => stat.delete(fn as (s: LiveStatus) => void); },
    get status() { return status; },
    get stats() { return { messages: version } as unknown as LiveSource<P>['stats']; },
    get paused() { return paused(); },
    start() { schedule(); }, stop() { clearTimeout(staleT); setStatus('offline'); },
    pause() { userPaused = true; setStatus('paused'); subs.forEach((f) => f()); },
    resume() { userPaused = false; if (!paused()) { setStatus('live'); schedule(); } subs.forEach((f) => f()); },
    send() { /* charts never send */ }, reconnectNow() { /* n/a */ },
  };
  return api;
}

export interface ULStreamChartProps<P> extends Omit<ULCartesianChartProps<P>, 'data' | 'x' | 'xScale' | 'xDomain' | 'zoom'> {
  /** Stream from createChartStream (one commit per frame, bounded buffer). */ stream: ChartStream<P>;
  /** Time accessor (p, i) => ms epoch | Date. */ x?: (p: P, i: number) => number | Date;
  /** Pause while the pointer is over the plot or a tooltip is pinned. Default true. */
  pauseOnHover?: boolean;
}
export function ULStreamChart<P>(props: ULStreamChartProps<P>) {
  const { stream, pauseOnHover = true, locale } = props;
  const snap = React.useSyncExternalStore(stream.subscribe, stream.snapshot, stream.snapshot);
  const [, tick] = React.useReducer((v: number) => v + 1, 0);
  const [st, setSt] = React.useState(stream.status);
  React.useEffect(() => stream.onStatus((s) => setSt(s)), [stream]);
  const paused = stream.paused, stale = st === 'stale';
  // smooth scroll: re-render once per frame while live (not paused, not reduced motion, tab visible)
  React.useEffect(() => {
    if (paused || stale || isMorphReduced()) return; let r = 0;
    const loop = () => { if (!document.hidden) tick(); r = requestAnimationFrame(loop); }; r = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(r);
  }, [paused, stale]);
  const frozen = React.useRef(0);
  const now = performance.now();
  const end = paused ? frozen.current || snap.lastT : snap.lastT + Math.min(Math.max(0, now - snap.lastAt), snap.interval * 1.5);
  if (!paused) frozen.current = end;
  const x = props.x ?? ((p: P) => (p as unknown as { t: number }).t);
  const tnum = (p: P, i: number) => { const v = x(p, i); return v instanceof Date ? v.getTime() : v; };
  const pts = React.useMemo(() => { const from = end - snap.windowMs; const out: P[] = []; snap.points.forEach((p, i) => { const t = tnum(p, i); if (t >= from && t <= end + 1) out.push(p); }); return out; }, [snap, Math.round(end / 16)]);
  const wrap = React.useRef<HTMLDivElement | null>(null), hovering = React.useRef(false);
  const holdOn = (on: boolean) => { if (!pauseOnHover || hovering.current === on) return; hovering.current = on; stream.hold(on); };
  React.useEffect(() => () => { if (hovering.current) stream.hold(false); }, []);
  const onLeave = () => { const pinned = !!wrap.current?.querySelector('.ul-chart-hover[data-pinned]'); if (!pinned) holdOn(false); };
  React.useEffect(() => { const el = wrap.current; if (!el) return; const mo = new MutationObserver(() => { const pinned = !!el.querySelector('.ul-chart-hover[data-pinned]'); if (pinned) holdOn(true); else if (!el.querySelector('.ul-chart2-plot:hover')) holdOn(false); }); mo.observe(el, { subtree: true, attributes: true, attributeFilter: ['data-pinned'] }); return () => mo.disconnect(); }, []);
  const footer = (
    <div className="ul-chart-livebar">
      <ULLiveStatus source={stream as unknown as LiveSource} labels={{ live: advText('live', locale), paused: advText('paused', locale), stale: advText('stale', locale) }} />
      {paused && snap.pending > 0 ? <button type="button" className="ul-chart-lchip ul-chart-newpts" data-plain="" onClick={() => { if (hovering.current) { hovering.current = false; stream.hold(false); } stream.resume(); }}><span className="ul-chart-lname">{advText('newPts', locale, snap.pending)}</span></button> : null}
    </div>
  );
  const ix: ChartInteraction = { footer, bind: { onPointerEnter: () => { holdOn(true); }, onPointerLeave: () => { onLeave(); } } as unknown as ChartInteraction['bind'] };
  return (
    <div ref={wrap} className="ul-chart-stream" data-paused={paused ? '' : undefined} style={{ display: 'contents' }}>
      <CartesianBody {...(props as unknown as ULCartesianChartProps<P>)} data={pts} x={x} xScale="time" xDomain={[end - snap.windowMs, end]} animate={false} liveBead={props.liveBead ?? true} stale={props.stale ?? stale} ix={ix} />
    </div>
  );
}
