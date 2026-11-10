import * as React from 'react';
import { ULGlass } from '../../glass/ULGlass.tsx';
import { isMorphReduced, getMorphTimeScale, overshootEase } from '../../motion/anchoredMorph.ts';
import { springs } from '../../motion/spring.ts';
import { accentAttrs, type Accent } from '../../glass/accent.tsx';
import { cx, useDomId } from '../shared/icons.tsx';
import { withContextMenu, splitCtx, type ContextMenuProps } from '../ULContainers/contextTarget.tsx';
import './ULKpi.css';

/* =====================================================================
 * Part 2: KPI cards, rolling numbers, delta capsule, animated sparkline, goal bar, KPI grid.
 * All motion is token-driven (--ul-kpi-*), independent of the locked --ul-lens-* timings.
 * ===================================================================== */

const LOCALES: Record<string, string> = { en: 'en-GB', sk: 'sk-SK', de: 'de-DE', cs: 'cs-CZ' };
export const resolveLocale = (l?: string) => (l ? LOCALES[l] ?? l : 'en-GB');
const rootCS = () => getComputedStyle(document.documentElement);
const tokMs = (cs: CSSStyleDeclaration, k: string, f: number) => { const v = parseFloat(cs.getPropertyValue(k)); return (Number.isFinite(v) ? v : f) * getMorphTimeScale(); };
const tokN = (cs: CSSStyleDeclaration, k: string, f: number) => { const v = parseFloat(cs.getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
const easeCache = new Map<number, string>();
const ease = (os: number) => { let e = easeCache.get(os); if (!e) { e = overshootEase(os); easeCache.set(os, e); } return e; };
const fmtCache = new Map<string, Intl.NumberFormat>();
export function numberFormat(locale?: string, o: Intl.NumberFormatOptions = {}, compact = false): Intl.NumberFormat {
  const opts = compact ? { notation: 'compact' as const, maximumFractionDigits: 1, ...o } : o;
  const k = resolveLocale(locale) + JSON.stringify(opts);
  let f = fmtCache.get(k); if (!f) { f = new Intl.NumberFormat(resolveLocale(locale), opts); fmtCache.set(k, f); }
  return f;
}

/* ---------------- Rolling number ---------------- */
interface Cell { pos: number; ch: string; digit: boolean }
const toCells = (s: string): Cell[] => { const a = [...s]; return a.map((ch, i) => ({ pos: a.length - 1 - i, ch, digit: ch >= '0' && ch <= '9' })); };
/* Rest state = ONE static glyph per reel; the strip exists only while rolling and is emptied on settle (no half digits). */
interface Roll { anim: Animation; seq: number[]; down: boolean; dirSign: number }
const rolls = new WeakMap<HTMLElement, Roll>();
function settle(el: HTMLElement) {
  const strip = el.querySelector<HTMLElement>('.ul-roll-strip');
  if (strip) { strip.getAnimations().forEach((a) => a.cancel()); strip.textContent = ''; }
  rolls.delete(el); delete el.dataset.rolling;
}

export interface ULRollingNumberProps {
  /** Number to show; digit cells roll on change (one glyph per cell at rest). */ value: number | null | undefined;
  /** Intl.NumberFormat options (currency, percent, compact…). */ format?: Intl.NumberFormatOptions;
  /** en | sk | de | cs or any BCP 47 tag. Default: the KPI grid context locale, else "en". */
  locale?: string;
  /** 12.4k notation. */
  compact?: boolean;
  /** Animate changes (false or a function returning false = jump; tables pass "row in view"). Default true. */
  animate?: boolean | (() => boolean);
  /** Staggered roll from zero on mount (once). Default true. */
  reveal?: boolean;
  /** Polite live announcements, throttled to --ul-kpi-announce-gap. Default false (the card / table summarizes). */
  announce?: boolean;
  /** Screen-reader prefix, e.g. "Revenue". */
  label?: string;
  /** Text for null / undefined. */
  placeholder?: string;
  /** Extra class on the root element. */ className?: string;
}

/**
 * Every digit is a vertical reel (one text node per reel) that rolls to the new digit; the direction follows the change.
 * Only changed digits roll, staggered (--ul-kpi-roll-order right | left), with a soft blur and a small elastic settle.
 * Digit count changes animate the width per character (no layout jump). More than --ul-kpi-rate-threshold updates per
 * second switch to a coalesced mode (≤ 1 roll per --ul-kpi-coalesce, to the latest value). Reduced motion: crossfade.
 * Screen readers get the formatted final value as text; the reels are aria-hidden.
 */
export function ULRollingNumber({ value, format, locale, compact, animate = true, reveal = true, announce = false, label, placeholder = '–', className }: ULRollingNumberProps) {
  const [shown, setShown] = React.useState(value);
  const latest = React.useRef(value); latest.current = value;
  const times = React.useRef<number[]>([]), lastApply = React.useRef(0), timer = React.useRef(0), coalescing = React.useRef(false);
  React.useEffect(() => {
    if (value === shown) return;
    const now = performance.now(), cs = rootCS();
    const thr = tokN(cs, '--ul-kpi-rate-threshold', 4), gap = tokMs(cs, '--ul-kpi-coalesce', 250) / getMorphTimeScale();
    times.current = [...times.current.filter((t) => now - t < 1000), now];
    coalescing.current = times.current.length > thr;
    clearTimeout(timer.current);
    if (!coalescing.current) { lastApply.current = now; setShown(value); return; }
    timer.current = window.setTimeout(() => { lastApply.current = performance.now(); setShown(latest.current); }, Math.max(0, lastApply.current + gap - now));
  }, [value]);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const text = shown == null || !Number.isFinite(shown) ? placeholder : numberFormat(locale, format, compact).format(shown);
  const cells = React.useMemo(() => toCells(text), [text]);
  // characters that left this render stay as ghosts while their width collapses
  const last = React.useRef<{ text: string; cells: Cell[]; value: number | null | undefined } | null>(null);
  const ghosts = React.useRef(new Map<number, Cell>());
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  if (last.current && last.current.text !== text) {
    const now = new Set(cells.map((c) => c.pos));
    last.current.cells.forEach((c) => { if (!now.has(c.pos)) ghosts.current.set(c.pos, c); });
  }
  const all = [...cells.map((c) => ({ ...c, ghost: false })), ...[...ghosts.current.values()].filter((g) => !cells.some((c) => c.pos === g.pos)).map((g) => ({ ...g, ghost: true }))].sort((a, b) => b.pos - a.pos);
  const vis = React.useRef<HTMLSpanElement | null>(null), rootEl = React.useRef<HTMLSpanElement | null>(null);

  React.useLayoutEffect(() => {
    const box = vis.current; if (!box) return;
    const prev = last.current, cs = rootCS();
    const can = (typeof animate === 'function' ? animate() : animate) && box.isConnected;
    const reduced = isMorphReduced();
    const D = tokMs(cs, '--ul-kpi-roll-duration', 620), stg = tokMs(cs, '--ul-kpi-roll-stagger', 45), blur = tokN(cs, '--ul-kpi-roll-blur', 1.4), Dw = tokMs(cs, '--ul-kpi-width-duration', 320);
    const os = tokN(cs, '--ul-kpi-roll-overshoot', 0.08), order = cs.getPropertyValue('--ul-kpi-roll-order').trim() || 'right';
    // one cell = --ul-kpi-roll-h (em): strips move in the same em unit as their cells, so every stop is an exact cell boundary
    const cellEm = tokN(cs, '--ul-kpi-roll-h', 1.15);
    const reels = new Map<number, HTMLElement>(), statics = new Map<number, HTMLElement>(), gh: HTMLElement[] = [];
    box.querySelectorAll<HTMLElement>('[data-pos]').forEach((n) => { if (n.dataset.ghost != null) gh.push(n); else if (n.dataset.reel != null) reels.set(+n.dataset.pos!, n); else statics.set(+n.dataset.pos!, n); });
    const prevMap = new Map((prev?.cells ?? []).map((c) => [c.pos, c]));
    const dir: 1 | -1 = prev && prev.value != null && shown != null && shown < prev.value ? -1 : 1;
    const changed: number[] = [];
    reels.forEach((el, pos) => { const c = cells.find((x) => x.pos === pos)!, o = prevMap.get(pos); if (!o || !o.digit || o.ch !== c.ch || !prev) changed.push(pos); });
    const first = !prev;
    const rollSet = first ? (reveal && can && !reduced ? [...reels.keys()] : []) : changed;
    const ordered = [...rollSet].sort((a, b) => (order === 'left' ? b - a : a - b));
    reels.forEach((el, pos) => { if (!rollSet.includes(pos) || !can) settle(el); });
    if (can && rollSet.length) {
      ordered.forEach((pos, rank) => {
        const el = reels.get(pos)!, c = cells.find((x) => x.pos === pos)!, d = +c.ch, o = prevMap.get(pos);
        if (reduced) { settle(el); el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 * getMorphTimeScale() }); return; }
        // start digit (+ fraction) = where the reel is NOW: an interrupted roll continues from its visual position
        const run = rolls.get(el);
        let start = first || !o || !o.digit ? 0 : +o.ch, frac = 0;
        if (run) {
          const pr = Math.max(0, Math.min(1, Number(run.anim.effect?.getComputedTiming().progress ?? 1)));
          const at = run.seq.length - 1 > 0 ? pr * (run.seq.length - 1) : 0, i = Math.min(run.seq.length - 1, Math.floor(at));
          start = run.seq[run.down ? run.seq.length - 1 - i : i]; frac = at - i;
          if (run.dirSign !== dir) frac = 0; // reversal: restart from the digit on screen
        }
        // digit sequence in roll order (start → target), at least one full step; first reveal of 0 spins once
        if (!first && start === d) { settle(el); return; }
        const seq = [start]; let k = start; const minSteps = first && d === start ? 10 : 1;
        while ((seq.length - 1 < minSteps || k !== d) && seq.length < 12) { k = (k + dir + 10) % 10; seq.push(k); }
        const strip = el.querySelector<HTMLElement>('.ul-roll-strip')!;
        strip.getAnimations().forEach((x) => x.cancel());
        // up: cells top → bottom = seq, the strip moves up; down: reversed, the strip moves down
        const down = dir < 0, cellsTop = down ? [...seq].reverse() : seq, n = seq.length - 1;
        strip.textContent = '';
        for (const v of cellsTop) { const cell = document.createElement('span'); cell.className = 'ul-roll-cell'; cell.textContent = String(v); strip.appendChild(cell); }
        const y = (idx: number) => `translate3d(0, ${(-idx * cellEm).toFixed(4)}em, 0)`;
        const fromIdx = down ? n - frac : frac, toIdx = down ? 0 : n;
        el.dataset.rolling = '';
        const delay = rank * stg;
        const anim = strip.animate([{ transform: y(fromIdx) }, { transform: y(toIdx) }], { duration: D, delay, easing: ease(os), fill: 'both' });
        if (blur > 0) strip.animate([{ filter: 'blur(0px)' }, { filter: `blur(${blur}px)`, offset: 0.25 }, { filter: 'blur(0px)', offset: 0.7 }], { duration: D, delay });
        rolls.set(el, { anim, seq, down, dirSign: dir });
        anim.finished.then(() => { if (rolls.get(el)?.anim === anim) settle(el); }, () => {});
        if (!first && !o) el.animate([{ width: '0px', opacity: 0 }, { width: `${el.offsetWidth}px`, opacity: 1 }], { duration: Dw, easing: springs.smooth.toCSS() });
      });
    }
    if (can && !first && !reduced) statics.forEach((el, pos) => { const o = prevMap.get(pos), c = cells.find((x) => x.pos === pos)!; if (!o || o.ch !== c.ch) el.animate(o ? [{ opacity: 0 }, { opacity: 1 }] : [{ width: '0px', opacity: 0 }, { width: `${el.offsetWidth}px`, opacity: 1 }], { duration: Dw, easing: springs.smooth.toCSS() }); });
    if (gh.length) {
      const done = () => { gh.forEach((g) => ghosts.current.delete(+g.dataset.pos!)); force(); };
      if (!can || reduced) done();
      else Promise.all(gh.map((g) => g.animate([{ width: `${g.offsetWidth}px`, opacity: 1 }, { width: '0px', opacity: 0 }], { duration: Dw, easing: springs.smooth.toCSS(), fill: 'forwards' }).finished)).then(done, done);
    }
    if (!first || rollSet.length) rootEl.current?.dispatchEvent(new CustomEvent('ul:roll', { bubbles: true, detail: { text, changed: first ? rollSet : changed, dir, coalesced: coalescing.current, animated: can && !reduced, first } }));
    last.current = { text, cells, value: shown };
  }, [text]);

  // throttled polite announcement (trailing)
  const [said, setSaid] = React.useState('');
  const sayT = React.useRef(0), saidAt = React.useRef(0);
  React.useEffect(() => {
    if (!announce) return;
    const gap = tokMs(rootCS(), '--ul-kpi-announce-gap', 5000) / getMorphTimeScale(), wait = Math.max(0, saidAt.current + gap - performance.now());
    clearTimeout(sayT.current);
    sayT.current = window.setTimeout(() => { saidAt.current = performance.now(); setSaid(label ? `${label}: ${text}` : text); }, wait);
    return () => clearTimeout(sayT.current);
  }, [text, announce]);

  return (
    <span ref={rootEl} className={cx('ul-roll', className)} data-roll="">
      <span className="ul-sr-only">{label ? `${label}: ` : ''}{text}</span>
      <span ref={vis} className="ul-roll-vis" aria-hidden="true">
        {all.map((c) => c.digit
          ? <span key={'d' + c.pos} className="ul-roll-reel" data-reel="" data-pos={c.pos} data-ghost={c.ghost ? '' : undefined}><span className="ul-roll-glyph">{c.ch}</span><span className="ul-roll-strip"></span></span>
          : <span key={'s' + c.pos + c.ch} className="ul-roll-ch" data-pos={c.pos} data-ghost={c.ghost ? '' : undefined}>{c.ch}</span>)}
      </span>
      {announce ? <span className="ul-sr-only" aria-live="polite">{said}</span> : null}
    </span>
  );
}

/* ---------------- Delta capsule ---------------- */
export interface ULKpiDeltaProps {
  /** Change in percent (7.8 = +7.8 %) or absolute when `format` says so. */
  value: number | null | undefined;
  /** Formats the number for display (Intl options or a function, per prop type). */ format?: Intl.NumberFormatOptions;
  /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default: the KPI grid context locale, else "en". */ locale?: string;
  /** Which direction is good: up (revenue) or down (latency, errors, costs). Default up. */
  goodDirection?: 'up' | 'down';
  /** "vs previous period" — visible after the capsule and read by screen readers. */
  context?: string;
  /** Animate changes (respects reduced motion). Default true. */ animate?: boolean | (() => boolean);
  /** Accessible text for a rise. Default "Up" (English; pass a translated string). */ upLabel?: string; /** Accessible text for a fall. Default "Down" (English; pass a translated string). */ downLabel?: string;
}
export function ULKpiDelta({ value, format, locale, goodDirection = 'up', context, animate, upLabel = 'Up', downLabel = 'Down' }: ULKpiDeltaProps) {
  if (value == null) return null;
  const up = value >= 0, good = goodDirection === 'up' ? up : !up;
  const f = format ?? { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 };
  const v = f.style === 'percent' ? Math.abs(value) / 100 : Math.abs(value);
  return (
    <span className="ul-kpi-delta" data-good={good ? '' : undefined} data-bad={good ? undefined : ''} data-dir={up ? 'up' : 'down'}>
      <span className="ul-kpi-delta-cap">
        <svg className="ul-kpi-delta-arrow" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 3.2l4.6 5.4H9.4V13H6.6V8.6H3.4z" fill="currentColor" /></svg>
        <span className="ul-sr-only">{up ? upLabel : downLabel} </span>
        <ULRollingNumber value={v} format={f} locale={locale} animate={animate} reveal={false} />
      </span>
      {context ? <span className="ul-kpi-delta-ctx">{context}</span> : null}
    </span>
  );
}

/* ---------------- Sparkline (animated) ---------------- */
export interface ULSparklineProps { /** Values (oldest first). */ data: number[]; /** Width in px. */ width?: number; /** Height in px. */ height?: number; /** Fill under the line. Default true. */ area?: boolean; /** Bead on the last point. Default true. */ bead?: boolean; /** Extra class on the root element. */ className?: string; /** Animate changes (respects reduced motion). Default true. */ animate?: boolean }
const sparkPts = (d: number[], w: number, h: number, pad: number, lo: number, hi: number) => { const k = hi - lo || 1; return d.map((v, i) => [pad + (i / Math.max(1, d.length - 1)) * (w - 2 * pad), pad + (1 - (v - lo) / k) * (h - 2 * pad)] as const); };
/** Draws in on mount; appended points slide in from the right; the end bead (flattened lens) pulses on new data. aria-hidden: the card states the value. */
export function ULSparkline({ data, width = 120, height = 32, area = true, bead = true, className, animate = true }: ULSparklineProps) {
  const id = useDomId('ul-spark');
  const g = React.useRef<SVGGElement | null>(null), path = React.useRef<SVGPathElement | null>(null), beadEl = React.useRef<HTMLSpanElement | null>(null);
  const prev = React.useRef<number[] | null>(null);
  const pad = 3, lo = Math.min(...data), hi = Math.max(...data);
  const pts = data.length > 1 ? sparkPts(data, width, height, pad, lo, hi) : [];
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('');
  const end = pts[pts.length - 1];
  React.useLayoutEffect(() => {
    const p = prev.current, reduced = isMorphReduced(), cs = rootCS();
    prev.current = data.slice();
    if (!animate || reduced || !path.current || data.length < 2) return;
    if (!p) { path.current.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: tokMs(cs, '--ul-kpi-spark-draw', 700), easing: springs.smooth.toCSS() }); return; }
    const shifted = p.length === data.length && p.slice(1).every((v, i) => v === data[i]);
    const grew = data.length === p.length + 1 && p.every((v, i) => v === data[i]);
    if (!shifted && !grew) return;
    const step = (width - 2 * pad) / Math.max(1, data.length - 1);
    if (shifted && g.current) g.current.animate([{ transform: `translateX(${step.toFixed(2)}px)` }, { transform: 'translateX(0)' }], { duration: tokMs(cs, '--ul-kpi-spark-slide', 420), easing: springs.smooth.toCSS() });
    beadEl.current?.animate([{ scale: 1 }, { scale: 1.6, offset: 0.35 }, { scale: 1 }], { duration: 520 * getMorphTimeScale(), easing: springs.bouncy.toCSS() });
  }, [data.join(',')]);
  if (data.length < 2) return null;
  return (
    <span className={cx('ul-spark', className)} aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height} data-ul-illustration="">
        <defs><linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="ul-spark-stop0" /><stop offset="1" className="ul-spark-stop1" /></linearGradient></defs>
        <g ref={g}>
          {area ? <path className="ul-spark-area" d={`${d}L${end[0].toFixed(2)} ${height}L${pts[0][0].toFixed(2)} ${height}Z`} fill={`url(#${id}-a)`} /> : null}
          <path ref={path} className="ul-spark-line" d={d} fill="none" pathLength={1} strokeDasharray="1 0" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      {bead ? <span ref={beadEl} className="ul-spark-bead" style={{ left: `${(end[0] / width) * 100}%`, top: `${(end[1] / height) * 100}%` }}></span> : null}
    </span>
  );
}

/* ---------------- Goal bar ---------------- */
export interface ULKpiGoalProps { /** Value to display. */ value: number; /** Goal value; progress = value / target. */ target: number; /** Visible label / accessible name. */ label?: string; /** Formats the number for display (Intl options or a function, per prop type). */ format?: (v: number) => string }
export function ULKpiGoal({ value, target, label = 'Goal', format = (v) => v.toLocaleString() }: ULKpiGoalProps) {
  const p = Math.max(0, Math.min(1.2, target ? value / target : 0)), pct = Math.round((target ? value / target : 0) * 100);
  return (
    <div className="ul-kpi-goal" data-over={p >= 1 ? '' : undefined}>
      <div className="ul-progress-bar ul-kpi-goal-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={value} aria-valuetext={`${pct} % of ${format(target)}`}>
        <span className="ul-progress-fill-glass" style={{ transform: `scaleX(${Math.min(1, p)})` }}></span>
        <i className="ul-kpi-goal-mark" style={{ left: `${Math.min(100, (1 / Math.max(1, p)) * 100)}%` }} aria-hidden="true"></i>
      </div>
      <span className="ul-kpi-goal-text">{pct} % of {label.toLowerCase()} {format(target)}</span>
    </div>
  );
}

/* ---------------- KPI card (slots) ---------------- */
type KpiState = 'ready' | 'loading' | 'empty' | 'error';
interface KpiCtxV { state: KpiState; emptyText: string; errorText: string; flash: (dir: number) => void; locale?: string; hero: boolean; animate?: boolean | (() => boolean) }
const KpiCtx = React.createContext<KpiCtxV>({ state: 'ready', emptyText: '', errorText: '', flash: () => {}, hero: false });
type SlotName = 'label' | 'value' | 'delta' | 'trend' | 'footer' | 'icon' | 'actions' | 'status';
function slot<P>(name: SlotName, C: (p: P) => React.ReactElement | null) { (C as unknown as { __slot: SlotName }).__slot = name; return C; }
const Skel = ({ w, h }: { w: string; h: string }) => <span className="ul-skel" data-shape="rect" aria-hidden="true" style={{ width: w, height: h }}></span>;

const KLabel = slot('label', ({ children, id }: { children?: React.ReactNode; id?: string }) => <h3 id={id} className="ul-kpi-label">{children}</h3>);
const KIcon = slot('icon', ({ children }: { children?: React.ReactNode }) => <span className="ul-kpi-icon" aria-hidden="true">{children}</span>);
const KActions = slot('actions', ({ children }: { children?: React.ReactNode }) => <span className="ul-kpi-actions">{children}</span>);
const KFooter = slot('footer', ({ children }: { children?: React.ReactNode }) => { const c = React.useContext(KpiCtx); return c.state === 'ready' ? <div className="ul-kpi-footer">{children}</div> : null; });
const KTrend = slot('trend', ({ children }: { children?: React.ReactNode }) => { const c = React.useContext(KpiCtx); if (c.state === 'loading') return <div className="ul-kpi-trend"><Skel w="100%" h="28px" /></div>; return c.state === 'ready' ? <div className="ul-kpi-trend">{children}</div> : null; });
const KDelta = slot('delta', (p: ULKpiDeltaProps) => { const c = React.useContext(KpiCtx); if (c.state === 'loading') return <Skel w="38%" h="22px" />; return c.state === 'ready' ? <ULKpiDelta locale={c.locale} animate={c.animate} {...p} /> : null; });
const KValue = slot('value', ({ value, format, compact, locale, label, children }: { value?: number | null; format?: Intl.NumberFormatOptions; compact?: boolean; locale?: string; label?: string; children?: React.ReactNode }) => {
  const c = React.useContext(KpiCtx);
  const prev = React.useRef(value);
  React.useEffect(() => { if (prev.current != null && value != null && value !== prev.current) c.flash(value - prev.current); prev.current = value; }, [value]);
  if (c.state === 'loading') return <div className="ul-kpi-value"><Skel w="62%" h={c.hero ? '52px' : '36px'} /></div>;
  if (c.state === 'empty') return <p className="ul-kpi-empty">{c.emptyText}</p>;
  if (c.state === 'error') return <p className="ul-kpi-error">{c.errorText}</p>;
  return <p className="ul-kpi-value">{children ?? <ULRollingNumber value={value} format={format} compact={compact} locale={locale ?? c.locale} label={label} animate={c.animate} />}</p>;
});
const KStatus = slot('status', ({ live, updatedAt, staleAfter, liveLabel = 'Live', staleLabel = 'Stale' }: { live?: boolean; updatedAt?: number; staleAfter?: number; liveLabel?: string; staleLabel?: string }) => {
  const [, tick] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => { const t = window.setInterval(tick, 5000); return () => clearInterval(t); }, []);
  const lim = staleAfter ?? tokN(rootCS(), '--ul-kpi-stale-after', 30000);
  const stale = updatedAt != null && Date.now() - updatedAt > lim;
  if (stale) {
    const m = Math.max(1, Math.round((Date.now() - updatedAt!) / 60000));
    return <span className="ul-badge ul-kpi-stale" data-tone="warning" data-size="sm" title={undefined}>{staleLabel} · {m} min</span>;
  }
  return live ? <span className="ul-kpi-live"><span className="ul-kpi-live-dot" aria-hidden="true"></span>{liveLabel}</span> : null;
});

export interface ULKpiCardProps {
  /** "simple" (default) | "sparkline" | "progress". */ variant?: 'simple' | 'sparkline' | 'progress' | 'comparison' | 'target';
  /** "md" (default) | "hero". */ size?: 'md' | 'hero';
  /** "ready" | "loading" | "empty" | "error" | "stale". */ state?: KpiState;
  /** Text shown when there is no value / data. Default localised. */ emptyText?: string;
  /** Error text (state="error"). Default localised. */ errorText?: string;
  /** Shows a Retry action; called when it is pressed. */ onRetry?: () => void;
  /** Retry button label. Default localised. */ retryLabel?: string;
  /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default: the KPI grid context locale, else "en". */ locale?: string;
  /** Accent colour name or CSS colour (checked by guardAccent). */ accent?: Accent;
  /** Interactive tile: lifts 2px on hover with pointer light; the label becomes a button / link stretched over the card. */
  onSelect?: () => void;
  /** Makes the whole card a link (one link, actions above it). */ href?: string;
  /** Pass false (or a function) to stop number animations (e.g. off-screen). */
  animate?: boolean | (() => boolean);
  /* shorthand (used when no slot children are given) */
  /** Visible label / accessible name. */ label?: React.ReactNode;
  /** Value to display. */ value?: number | null;
  /** Formats the number for display (Intl options or a function, per prop type). */ format?: Intl.NumberFormatOptions;
  /** Compact number notation (12.3k). Default false. */ compact?: boolean;
  /** Change versus the previous period (number; sign decides the arrow). */ delta?: number | null;
  /** Context for the delta (e.g. "vs last month"). */ deltaContext?: string;
  /** Which direction is good: "up" (default) | "down" (colours the delta). */ goodDirection?: 'up' | 'down';
  /** Values for the inline sparkline (oldest first). */ sparkline?: number[];
  /** Custom trend (e.g. <ULSparkChart variant="bars" />); replaces the default sparkline. */
  trend?: React.ReactNode;
  /** Progress variant data { value, max }. */ progress?: { value: number; max?: number; label?: string };
  /** Previous-period value shown as context. */ previous?: number | null;
  /** Label for the previous value. Default "Previous period" (English; pass a translated string). */ previousLabel?: string;
  /** Target value shown as context. */ target?: number;
  /** Label for the target. Default "Goal" (English; pass a translated string). */ targetLabel?: string;
  /** Decorative icon next to the label. */ icon?: React.ReactNode;
  /** Live value: rolling updates, flash on change, rate-limited announcements. Default false. */ live?: boolean;
  /** Last update time (ms epoch) for "updated n ago" and staleness. */ updatedAt?: number;
  /** Mark stale after this many ms without updates. Default --ul-kpi-stale-after. */ staleAfter?: number;
  /** Content. */ children?: React.ReactNode;
  /** Extra class on the root element. */ className?: string;
}

/** contextMenu target: { component: 'kpi', kind: 'self', data: { label, value, delta, state } }. */
function CardCtx(props: ULKpiCardProps & ContextMenuProps<{ label?: React.ReactNode; value?: number | null; delta?: number | null; state?: string }>) { const [c, rest] = splitCtx(props); return withContextMenu(<Card {...(rest as ULKpiCardProps)} />, c, 'kpi', { data: { label: props.label, value: props.value, delta: props.delta, state: props.state ?? 'ready' } }, undefined, true); }
function Card({ variant = 'simple', size = 'md', state = 'ready', emptyText = 'No data yet', errorText = 'Could not load', onRetry, retryLabel = 'Retry', locale, accent, onSelect, href, animate, children, className, ...s }: ULKpiCardProps) {
  const id = useDomId('ul-kpi');
  const flashEl = React.useRef<HTMLSpanElement | null>(null), lastFlash = React.useRef(0);
  const flash = React.useCallback((dir: number) => {
    const el = flashEl.current, cs = rootCS(); if (!el || isMorphReduced()) return;
    const now = performance.now(); if (now - lastFlash.current < tokMs(cs, '--ul-kpi-flash-min-gap', 1500)) return;
    lastFlash.current = now;
    el.dataset.dir = dir >= 0 ? 'up' : 'down';
    el.animate([{ opacity: 0 }, { opacity: tokN(cs, '--ul-kpi-flash', 0.55), offset: 0.18 }, { opacity: 0 }], { duration: tokMs(cs, '--ul-kpi-flash-duration', 760), easing: 'ease-out' });
  }, []);
  const ctx = React.useMemo<KpiCtxV>(() => ({ state, emptyText, errorText, flash, locale, hero: size === 'hero', animate }), [state, emptyText, errorText, flash, locale, size, animate]);
  // slots: explicit children, or built from the shorthand props + variant
  let kids: React.ReactNode = children;
  if (kids == null) {
    const pct = { style: 'percent', maximumFractionDigits: 0 } as const;
    kids = <>
      {s.icon ? <KIcon>{s.icon}</KIcon> : null}
      <KLabel>{s.label}</KLabel>
      {s.live || s.updatedAt != null ? <KStatus live={s.live} updatedAt={s.updatedAt} staleAfter={s.staleAfter} /> : null}
      <KValue value={s.value} format={s.format} compact={s.compact} label={typeof s.label === 'string' ? s.label : undefined} />
      {s.delta != null ? <KDelta value={s.delta} goodDirection={s.goodDirection} context={s.deltaContext ?? (variant === 'comparison' ? undefined : 'vs previous period')} /> : null}
      {variant === 'sparkline' && s.trend ? <KTrend>{s.trend}</KTrend> : variant === 'sparkline' && s.sparkline ? <KTrend><ULSparkline data={s.sparkline} height={size === 'hero' ? 56 : 34} /></KTrend> : null}
      {variant === 'progress' && s.progress ? <KTrend><div className="ul-kpi-prog"><div className="ul-progress-bar" role="progressbar" aria-label={s.progress.label ?? 'Progress'} aria-valuemin={0} aria-valuemax={s.progress.max ?? 100} aria-valuenow={s.progress.value}><span className="ul-progress-fill-glass" style={{ transform: `scaleX(${Math.min(1, s.progress.value / (s.progress.max ?? 100))})` }}></span></div><span className="ul-kpi-prog-v"><ULRollingNumber value={s.progress.value / (s.progress.max ?? 100)} format={pct} locale={locale} reveal={false} animate={animate} /></span></div></KTrend> : null}
      {variant === 'target' && s.target != null && s.value != null ? <KTrend><ULKpiGoal value={s.value} target={s.target} label={s.targetLabel ?? 'Goal'} format={(v) => numberFormat(locale, s.format, s.compact).format(v)} /></KTrend> : null}
      {variant === 'comparison' && s.previous != null ? <KFooter><span className="ul-kpi-cmp">{s.previousLabel ?? 'Previous period'}</span><span className="ul-kpi-cmp-v"><ULRollingNumber value={s.previous} format={s.format} compact={s.compact} locale={locale} reveal={false} animate={animate} /></span></KFooter> : null}
    </>;
  }
  const buckets: Record<SlotName, React.ReactNode[]> = { label: [], value: [], delta: [], trend: [], footer: [], icon: [], actions: [], status: [] };
  const walk = (n: React.ReactNode) => React.Children.forEach(n, (c) => {
    if (!React.isValidElement(c)) return;
    if (c.type === React.Fragment) { walk((c.props as { children?: React.ReactNode }).children); return; }
    const sl = (c.type as { __slot?: SlotName }).__slot;
    if (sl) buckets[sl].push(sl === 'label' ? React.cloneElement(c as React.ReactElement<{ id?: string }>, { id: `${id}-l` }) : c); else buckets.footer.push(c);
  });
  walk(kids);
  const interactive = !!(onSelect || href);
  const acc = accentAttrs(accent);
  const stretch = interactive ? (href ? <a className="ul-kpi-hit" href={href} aria-labelledby={`${id}-l`}></a> : <button type="button" className="ul-kpi-hit" aria-labelledby={`${id}-l`} onClick={onSelect}></button>) : null;
  return (
    <KpiCtx.Provider value={ctx}>
      <ULGlass as="section" tier="md" quality="lite" padding="0" radius="var(--ul-radius-lg)" accent={accent} className={cx('ul-kpi', 'ul-data-panel', className)}
        data-size={size} data-variant={variant} data-state={state} data-interactive={interactive ? '' : undefined} aria-labelledby={`${id}-l`} aria-busy={state === 'loading' || undefined}
        data-ul-accent={acc['data-ul-accent']} style={acc.style as React.CSSProperties}>
        <span ref={flashEl} className="ul-kpi-flash" aria-hidden="true"></span>
        <div className="ul-kpi-head">{buckets.icon}{buckets.label}<span className="ul-kpi-spacer"></span>{buckets.status}{buckets.actions}</div>
        {buckets.value}
        {buckets.delta.length ? <div className="ul-kpi-deltas">{buckets.delta}</div> : null}
        {buckets.trend}
        {buckets.footer}
        {state === 'error' && onRetry ? <div className="ul-kpi-footer"><button type="button" className="ul-kpi-retry" onClick={onRetry}>{retryLabel}</button></div> : null}
        {stretch}
      </ULGlass>
    </KpiCtx.Provider>
  );
}
/** KPI card with compound slots: ULKpiCard.Label / Value / Delta / Trend / Footer / Icon / Actions / Status. */
export const ULKpiCard = Object.assign(CardCtx, { Label: KLabel, Value: KValue, Delta: KDelta, Trend: KTrend, Footer: KFooter, Icon: KIcon, Actions: KActions, Status: KStatus });

/* ---------------- KPI grid ---------------- */
export interface ULKpiGridProps { /** Content. */ children?: React.ReactNode; /** Minimum card width before wrapping (px or CSS length). */ minWidth?: number | string; /** Gap between cards (px or CSS length). */ gap?: number | string; /** Visible label / accessible name. */ label?: string; /** Extra class on the root element. */ className?: string }
/** Responsive columns (auto-fill, min --ul-kpi-min-w); hero cards span two columns when there is room. No drag-to-reorder (not cheap enough without a layout engine; skipped). */
export function ULKpiGrid({ children, minWidth, gap, label, className }: ULKpiGridProps) {
  return <div className={cx('ul-kpi-grid', className)} role={label ? 'region' : undefined} aria-label={label}
    style={{ '--ul-kpi-min-w': typeof minWidth === 'number' ? `${minWidth}px` : minWidth, '--ul-kpi-gap': typeof gap === 'number' ? `${gap}px` : gap } as React.CSSProperties}>{children}</div>;
}
