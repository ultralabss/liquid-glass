import * as React from 'react';
import type { Accent } from '../../glass/accent.tsx';
import { LensBubble } from '../../motion/lensBubble.ts';
import { getMorphTimeScale, isMorphReduced } from '../../motion/anchoredMorph.ts';
import { springs } from '../../motion/spring.ts';
import { cx, useDomId } from '../shared/icons.tsx';
import '../shared/lens.css';
import './ULSlider.css';

/* =====================================================================
 * Slider + range slider: inset rail (not glass), accent fill, flat capsule thumbs, shared lens bubble.
 *
 * Value vs visual. The committed VALUE follows the pointer immediately (stepped, onValueChange only when it changes,
 * one React render per change). The VISUAL thumb follows on a critically damped spring (--ul-slider-follow): toward the
 * raw pointer while dragging (stepped sliders glide between steps instead of snapping), toward the committed value
 * otherwise (keyboard, click-to-jump, programmatic). ONE rAF loop writes, per frame and from cached geometry only:
 * thumb positioners (translate3d), fill (clip-path inset, no layout), value tooltips (children of the positioners),
 * the merged range tooltip. No layout reads per frame; track / root rects are cached on press, resize and scroll.
 *
 * Value tooltip: child of the thumb positioner, never the anchored-tooltip loop, no hover delay. Spring only for its
 * enter / exit. Shows on press, drag and keyboard changes; hides --ul-tooltip-hide-delay after the thumb settles.
 * Clamped to the control / viewport (body shifts, arrow stays on the thumb), flips when there is no room.
 * Range: merges into one "a – b" tooltip when the two would overlap; the merged one covers exactly their span.
 * Keys: arrows ±step, PageUp/PageDown ±10 steps, Home/End min/max.
 * ===================================================================== */

interface SliderBase {
  label?: React.ReactNode;
  'aria-label'?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Formats the visible value, tooltip and aria-valuetext. */
  format?: (v: number) => string;
  helper?: React.ReactNode;
  accent?: Accent;
  className?: string;
  style?: React.CSSProperties;
  /** Hide the value next to the label. */
  hideValue?: boolean;
  /** horizontal (default) | vertical (length = --ul-selection-slider-length). */
  orientation?: 'horizontal' | 'vertical';
  /** Glass lens bubble while pressed / moving. Default true. */
  lens?: boolean;
  /** @internal */
  forceState?: 'hover' | 'focus' | 'pressed' | (string & {});
}
export interface ULSliderProps extends SliderBase { /** Controlled value. */ value?: number; /** Initial value when uncontrolled. Default min (0 when min is not set). */ defaultValue?: number; /** Called with the new value while dragging (one call per frame) and on keys. */ onValueChange?: (v: number) => void }
export interface ULRangeSliderProps extends SliderBase {
  /** Controlled [low, high]. */ value?: [number, number]; /** Initial [low, high] when uncontrolled. */ defaultValue?: [number, number]; /** Called with [low, high]; thumbs never cross (minimum gap = step). */ onValueChange?: (v: [number, number]) => void;
  /** Accessible names of the two thumbs. Default "Minimum" / "Maximum". */
  thumbLabels?: [string, string];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number, min: number, step: number) => { const n = Math.round((v - min) / step) * step + min; return +n.toFixed(10); };
const numVar = (el: Element, k: string, f: number) => { const v = parseFloat(getComputedStyle(el).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };

function useSliderCore(vals: number[], setVals: (v: number[]) => void, o: SliderBase & { names: (string | undefined)[] }) {
  const { min = 0, max = 100, step = 1, disabled } = o;
  const vert = o.orientation === 'vertical';
  const fmt = o.format ?? ((v: number) => String(v));
  const range = max - min || 1;
  const root = React.useRef<HTMLDivElement | null>(null);
  const track = React.useRef<HTMLDivElement | null>(null);
  const fill = React.useRef<HTMLSpanElement | null>(null);
  const pos = React.useRef<(HTMLElement | null)[]>([]);
  const thumbs = React.useRef<(HTMLElement | null)[]>([]);
  const knobs = React.useRef<(HTMLElement | null)[]>([]);
  const tips = React.useRef<(HTMLElement | null)[]>([]); // [0], [1], [2] = merged
  const bodies = React.useRef<(HTMLElement | null)[]>([]);
  const lenses = React.useRef<(LensBubble | null)[]>([]);
  const [drag, setDrag] = React.useState(-1);
  const uid = useDomId('ul-sl');
  const m = React.useRef({
    vals: vals.slice(), raw: [0, 0], vis: [0, 0], vv: [0, 0], dragI: -1, raf: 0, last: 0, init: false,
    W: 0, ext: 0, tw: 36, th: 24, trackRect: { left: 0, top: 0, right: 0, bottom: 0 }, rootRect: { left: 0, top: 0, right: 0, bottom: 0 },
    shown: [false, false, false], shift: [0, 0, 0], bw: [0, 0, 0], nat: 0, merged: false, hide: 0, pid: -1,
  });
  m.current.vals = vals.slice();
  const px = (v: number) => ((v - min) / range) * m.current.W;

  /* ---------- cached geometry ---------- */
  const measure = () => {
    const s = m.current, t = track.current, r = root.current;
    if (!t || !r) return;
    s.W = vert ? t.offsetHeight : t.offsetWidth;
    const k = thumbs.current[0];
    if (k) { s.tw = vert ? k.offsetHeight : k.offsetWidth; s.th = vert ? k.offsetWidth : k.offsetHeight; }
    s.ext = r.hasAttribute('data-range') ? 0 : s.tw / 2;
    const tb = t.getBoundingClientRect(), rb = r.getBoundingClientRect();
    s.trackRect = { left: tb.left, top: tb.top, right: tb.right, bottom: tb.bottom };
    s.rootRect = { left: rb.left, top: rb.top, right: rb.right, bottom: rb.bottom };
  };
  const measureText = () => {
    const s = m.current, size = (b: HTMLElement | null) => (b ? (vert ? b.offsetHeight : b.offsetWidth) : 0);
    s.bw = [size(bodies.current[0]), size(bodies.current[1]), 0];
    const mb = bodies.current[2];
    if (mb) { const p = vert ? 'minHeight' : 'minWidth'; const keep = mb.style[p]; mb.style[p] = ''; s.nat = size(mb); mb.style[p] = keep; }
  };

  /* ---------- per-frame write (style only) ---------- */
  const write = () => {
    const s = m.current, n = vals.length;
    for (let i = 0; i < n; i++) {
      const p = pos.current[i];
      if (p) p.style.transform = vert ? `translate3d(0, ${(-s.vis[i]).toFixed(2)}px, 0)` : `translate3d(${s.vis[i].toFixed(2)}px, 0, 0)`;
    }
    const f = fill.current;
    if (f) {
      const a = (n > 1 ? s.vis[0] : -s.ext) + s.ext, b = s.W + s.ext - (n > 1 ? s.vis[1] : s.vis[0]);
      const rr = 'round 999px';
      f.style.clipPath = vert ? `inset(${Math.max(0, b).toFixed(2)}px 0 ${Math.max(0, a).toFixed(2)}px 0 ${rr})` : `inset(0 ${Math.max(0, b).toFixed(2)}px 0 ${Math.max(0, a).toFixed(2)}px ${rr})`;
    }
    if (s.shown.some(Boolean)) syncTips();
  };
  const syncTips = () => {
    const s = m.current, t = s.trackRect, r = s.rootRect;
    // bounds in track-local px along the axis (control ∩ viewport)
    const lo = vert ? Math.max(4, r.top) - t.top : Math.max(4, r.left) - t.left;
    const hi = vert ? Math.min(innerHeight - 4, r.bottom) - t.top : Math.min(innerWidth - 4, r.right) - t.left;
    // along-axis screen coordinate of a track px (vertical: measured from the bottom)
    const at = (x: number) => (vert ? s.W - x : x);
    let mid = 0, moff = 0;
    if (vals.length > 1) {
      const c0 = s.vis[0], c1 = s.vis[1], gap = 6, span = Math.abs(c1 - c0) + (s.bw[0] + s.bw[1]) / 2;
      const merged = Math.abs(c1 - c0) < (s.bw[0] + s.bw[1]) / 2 + gap || span <= s.nat;
      if (merged !== s.merged) { s.merged = merged; root.current?.toggleAttribute('data-tips-merged', merged); }
      mid = (c0 + c1) / 2; moff = (s.bw[1] - s.bw[0]) / 4;
      const mt = tips.current[2], mb = bodies.current[2];
      if (mt) mt.style.transform = vert ? `translate3d(0, ${(-mid).toFixed(2)}px, 0)` : `translate3d(${mid.toFixed(2)}px, 0, 0)`;
      if (mb) { if (vert) mb.style.minHeight = `${span.toFixed(2)}px`; else mb.style.minWidth = `${span.toFixed(2)}px`; }
      s.bw[2] = Math.max(span, s.nat);
    }
    for (let i = 0; i < 3; i++) {
      const b = bodies.current[i];
      if (!b || !s.shown[i]) continue;
      const c = i === 2 ? mid : s.vis[i];
      const want = i === 2 ? (vert ? -moff : moff) : 0;
      const z = s.bw[i], a = at(c) - z / 2 + want;
      const sh = want + (z >= hi - lo ? 0 : clamp(0, lo - a, hi - (a + z)));
      if (Math.abs(sh - s.shift[i]) > 0.01) { s.shift[i] = sh; b.style.translate = vert ? `0 ${sh.toFixed(2)}px` : `${sh.toFixed(2)}px 0`; }
    }
  };

  /* ---------- tooltip show / hide ---------- */
  const tipAnim = (el: HTMLElement | null, show: boolean) => {
    if (!el) return;
    const red = isMorphReduced(), ts = getMorphTimeScale();
    el.getAnimations().forEach((a) => a.cancel());
    if (show) el.setAttribute('data-show', '');
    const from = { opacity: 0, scale: red ? '1' : '0.6' }, to = { opacity: 1, scale: '1' };
    const a = el.animate(show ? [from, to] : [to, from], { duration: (red ? 150 : show ? 260 : 140) * ts, easing: show && !red ? springs.snappy.toCSS() : 'ease-in', fill: show ? 'none' : 'forwards' });
    if (!show) a.finished.then(() => { el.removeAttribute('data-show'); a.cancel(); }, () => {});
  };
  const flipCheck = () => {
    const s = m.current, r = root.current, b = bodies.current[0];
    if (!r || !b) return;
    const need = (vert ? b.offsetWidth : b.offsetHeight) + s.th + 20;
    r.toggleAttribute('data-tip-flip', vert ? s.trackRect.right + need > innerWidth : s.trackRect.top - need < 0);
  };
  const onScroll = () => measure();
  const showTip = (i: number) => {
    const s = m.current;
    clearTimeout(s.hide); s.hide = 0;
    if (!s.shown.some(Boolean)) { measure(); flipCheck(); addEventListener('scroll', onScroll, { passive: true, capture: true }); }
    for (const j of vals.length > 1 ? [0, 1, 2] : [i]) if (!s.shown[j]) { s.shown[j] = true; tipAnim(tips.current[j], true); }
    measureText();
    syncTips();
  };
  const hideTips = () => {
    const s = m.current;
    s.hide = 0;
    s.shown.forEach((on, i) => { if (on) { s.shown[i] = false; tipAnim(tips.current[i], false); } });
    removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
  };
  const scheduleHide = () => {
    const s = m.current;
    if (s.dragI >= 0 || s.raf || !s.shown.some(Boolean)) return;
    clearTimeout(s.hide);
    s.hide = window.setTimeout(hideTips, numVar(root.current ?? document.documentElement, '--ul-tooltip-hide-delay', 400) * getMorphTimeScale());
  };

  /* ---------- ONE rAF loop: visual follow spring ---------- */
  const targetOf = (i: number) => { const s = m.current; return s.dragI === i ? s.raw[i] : px(s.vals[i]); };
  const settled = (i: number) => { const s = m.current; return Math.abs(s.vis[i] - targetOf(i)) < 0.05 && Math.abs(s.vv[i]) < 2; };
  const tick = (t: number) => {
    const s = m.current;
    s.raf = 0;
    const dt = Math.min(0.034, (t - s.last) / 1000 || 1 / 60) / getMorphTimeScale();
    s.last = t;
    const T = numVar(root.current ?? document.documentElement, '--ul-slider-follow', 75) / 1000;
    const w = 5 / Math.max(0.005, T), red = isMorphReduced();
    let busy = false;
    for (let i = 0; i < vals.length; i++) {
      const tg = targetOf(i);
      if (red) { s.vis[i] = tg; s.vv[i] = 0; continue; }
      const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (let k = 0; k < n; k++) { const a = -w * w * (s.vis[i] - tg) - 2 * w * s.vv[i]; s.vv[i] += a * h; s.vis[i] += s.vv[i] * h; }
      if (Math.abs(s.vis[i] - tg) < 0.05 && Math.abs(s.vv[i]) < 2) { s.vis[i] = tg; s.vv[i] = 0; } else busy = true;
    }
    write();
    if (busy || s.dragI >= 0) s.raf = requestAnimationFrame(tick);
    else scheduleHide();
  };
  const kick = () => { const s = m.current; if (!s.raf) { s.last = performance.now(); s.raf = requestAnimationFrame(tick); } };

  /* ---------- lifecycle ---------- */
  React.useLayoutEffect(() => {
    const s = m.current;
    measure();
    if (!s.init) { s.init = true; vals.forEach((v, i) => { s.vis[i] = px(v); }); write(); return; }
    measureText();
    if (s.dragI < 0) vals.forEach((v, i) => { if (Math.abs(px(v) - s.vis[i]) > 0.05) lenses.current[i]?.nudge(s.pid === -2 ? 1 : 0.6); });
    s.pid = -1;
    kick();
  }, [vals[0], vals[1], min, max]);
  React.useEffect(() => {
    const t = track.current;
    if (!t) return;
    const ro = new ResizeObserver(() => { const s = m.current, W0 = s.W; measure(); if (W0 && s.W !== W0) { vals.forEach((v, i) => { s.vis[i] = px(s.vals[i]); }); write(); } });
    ro.observe(t);
    return () => ro.disconnect();
  }, []);
  React.useEffect(() => {
    const t = track.current;
    if (!t) return;
    lenses.current = vals.map((_, i) => new LensBubble({
      kind: 'slider', axis: vert ? 'y' : 'x', host: t,
      geometry: () => { const s = m.current, c = vert ? s.W - s.vis[i] : s.vis[i], cross = vert ? t.offsetWidth : 44; return { c, cc: (vert ? t.offsetWidth : t.offsetHeight) / 2 || cross / 2, w: s.tw, h: s.th, r: s.th / 2, wrap: { lo: 0, hi: s.W, cross: s.th, r: s.th / 2 } }; },
      knobs: () => [knobs.current[i]],
      busy: () => m.current.dragI === i || !settled(i),
    }));
    return () => { lenses.current.forEach((l) => l?.destroy()); lenses.current = []; };
  }, [vals.length, vert]);
  React.useEffect(() => { lenses.current.forEach((l) => { if (l) { l.enabled = o.lens !== false && !disabled; if (!l.enabled) l.kill(); } }); }, [o.lens, disabled, vals.length]);
  React.useEffect(() => { if (o.forceState !== 'pressed') return; const l = lenses.current[0]; measure(); l?.press(); return () => l?.release(); }, [o.forceState]);
  React.useEffect(() => () => { cancelAnimationFrame(m.current.raf); clearTimeout(m.current.hide); removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions); }, []);

  /* ---------- input ---------- */
  const commit = (i: number, v: number) => {
    const s = m.current;
    const lo = i === 1 ? s.vals[0] : min, hi = i === 0 && s.vals.length > 1 ? s.vals[1] : max;
    const next = s.vals.slice();
    next[i] = clamp(snap(v, min, step), lo, hi);
    if (next[i] === s.vals[i]) return false;
    s.vals = next;
    setVals(next);
    return true;
  };
  const local = (e: { clientX: number; clientY: number }) => { const s = m.current, t = s.trackRect; return vert ? s.W - (e.clientY - t.top) : e.clientX - t.left; };
  const valueAt = (p: number) => min + clamp(p / (m.current.W || 1), 0, 1) * range;
  const rawClamp = (i: number, p: number) => { const s = m.current, lo = i === 1 ? px(s.vals[0]) : 0, hi = i === 0 && s.vals.length > 1 ? px(s.vals[1]) : s.W; return clamp(p, lo, hi); };
  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    const s = m.current;
    measure();
    const p = local(e), v = valueAt(p);
    const i = vals.length > 1 ? (Math.abs(v - vals[0]) <= Math.abs(v - vals[1]) ? (v < vals[0] || vals[0] !== vals[1] ? 0 : 1) : 1) : 0;
    s.dragI = i; s.pid = e.pointerId;
    s.raw[i] = rawClamp(i, p);
    lenses.current[i]?.press();
    showTip(i);
    commit(i, v);
    setDrag(i);
    thumbs.current[i]?.focus({ preventScroll: true });
    try { track.current!.setPointerCapture(e.pointerId); } catch { /* synthetic pointer (tests) */ }
    kick();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = m.current, i = s.dragI;
    if (i < 0) return;
    const p = local(e);
    s.raw[i] = rawClamp(i, p);
    commit(i, valueAt(p));
    kick();
  };
  const onPointerUp = () => {
    const s = m.current, i = s.dragI;
    if (i < 0) return;
    s.dragI = -1;
    lenses.current[i]?.release();
    setDrag(-1);
    kick(); // glide from the raw pointer position onto the committed (stepped) value
  };
  const onKey = (i: number) => (e: React.KeyboardEvent) => {
    if (disabled) return;
    const v = m.current.vals[i], big = step * 10;
    const map: Record<string, number> = { ArrowRight: v + step, ArrowUp: v + step, ArrowLeft: v - step, ArrowDown: v - step, PageUp: v + big, PageDown: v - big, Home: min, End: max };
    if (!(e.key in map)) return;
    e.preventDefault();
    showTip(i);
    m.current.pid = -2; // own change: full-speed bubble
    if (!commit(i, map[e.key])) scheduleHide();
  };
  const onFocus = (i: number) => (e: React.FocusEvent<HTMLElement>) => { if (e.currentTarget.matches(':focus-visible') && m.current.dragI < 0) { showTip(i); scheduleHide(); } };
  const onBlur = () => { if (m.current.dragI < 0) hideTips(); };
  const tipText = vals.length > 1 ? `${fmt(vals[0])} – ${fmt(vals[1])}` : '';

  return (
    <div ref={root} className={cx('ul-slider', o.className)} style={o.style} data-orientation={vert ? 'vertical' : undefined} data-range={vals.length > 1 ? '' : undefined} data-disabled={disabled || undefined} data-dragging={drag >= 0 || o.forceState === 'pressed' ? '' : undefined} data-ul-force={o.forceState || undefined}>
      {o.label ? (
        <div className="ul-slider-head">
          <span id={`${uid}-l`} className="ul-slider-label">{o.label}</span>
          {o.hideValue ? null : <output className="ul-slider-value" htmlFor={vals.map((_, i) => `${uid}-t${i}`).join(' ')}>{vals.map(fmt).join(' – ')}</output>}
        </div>
      ) : null}
      <div ref={track} className="ul-slider-track" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onLostPointerCapture={onPointerUp}>
        <span className="ul-slider-rail" aria-hidden="true" />
        <span ref={fill} className="ul-slider-fill" aria-hidden="true" />
        {vals.map((v, i) => (
          <span key={i} ref={(n) => { pos.current[i] = n; }} className="ul-slider-pos" data-i={i} data-active={drag === i ? '' : undefined}>
            <span
              ref={(n) => { thumbs.current[i] = n; }}
              id={`${uid}-t${i}`} role="slider" tabIndex={disabled ? -1 : 0}
              aria-valuemin={i === 1 ? vals[0] : min} aria-valuemax={i === 0 && vals.length > 1 ? vals[1] : max} aria-valuenow={v} aria-valuetext={fmt(v)}
              aria-orientation={vert ? 'vertical' : 'horizontal'} aria-disabled={disabled || undefined}
              aria-label={o.names[i] ?? (o.label ? undefined : o['aria-label'])} aria-labelledby={o.label && !o.names[i] ? `${uid}-l` : undefined}
              aria-describedby={o.helper ? `${uid}-h` : undefined}
              className="ul-slider-thumb" onKeyDown={onKey(i)} onFocus={onFocus(i)} onBlur={onBlur}
            >
              <span ref={(n) => { knobs.current[i] = n; }} className="ul-thumb-knob" aria-hidden="true" />
              <span className="ul-slider-ring" aria-hidden="true" />
            </span>
            <span ref={(n) => { tips.current[i] = n; }} className="ul-slider-tip" data-i={i} aria-hidden="true">
              <span ref={(n) => { bodies.current[i] = n; }} className="ul-slider-tip-body">{fmt(v)}</span>
              <span className="ul-slider-tip-arrow" />
            </span>
          </span>
        ))}
        {vals.length > 1 ? (
          <span ref={(n) => { tips.current[2] = n; }} className="ul-slider-tip ul-slider-tip-merged" aria-hidden="true">
            <span ref={(n) => { bodies.current[2] = n; }} className="ul-slider-tip-body">{tipText}</span>
            <span className="ul-slider-tip-arrow" />
          </span>
        ) : null}
      </div>
      {o.helper ? <p id={`${uid}-h`} className="ul-slider-helper">{o.helper}</p> : null}
    </div>
  );
}

/** Single-value slider. */
export function ULSlider({ value, defaultValue, onValueChange, ...o }: ULSliderProps) {
  const [own, setOwn] = React.useState(defaultValue ?? o.min ?? 0);
  const v = value ?? own;
  return useSliderCore([v], (n) => { if (value === undefined) setOwn(n[0]); onValueChange?.(n[0]); }, { ...o, names: [undefined] });
}

/** Two-thumb range slider. Thumbs never cross. */
export function ULRangeSlider({ value, defaultValue, onValueChange, thumbLabels = ['Minimum', 'Maximum'], ...o }: ULRangeSliderProps) {
  const [own, setOwn] = React.useState<[number, number]>(defaultValue ?? [o.min ?? 0, o.max ?? 100]);
  const v = value ?? own;
  return useSliderCore(v, (n) => { const t = [n[0], n[1]] as [number, number]; if (value === undefined) setOwn(t); onValueChange?.(t); }, { ...o, names: thumbLabels });
}
