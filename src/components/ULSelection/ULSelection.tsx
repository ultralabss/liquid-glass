import * as React from 'react';
import { ULGlass } from '../../glass/ULGlass.tsx';
import { useMaterial, type Material } from '../../glass/material.tsx';
import { LensBubble, rubberBand } from '../../motion/lensBubble.ts';
import '../shared/lens.css';
import type { Accent } from '../../glass/accent.tsx';
import { ULSpinner } from '../ULSpinner/ULSpinner.tsx';
import { Icon, cx, useDomId } from '../shared/icons.tsx';
import './ULSelection.css';

/* =====================================================================
 * Checkbox, radio, switch. Real <input type=checkbox|radio> / <button role=switch>,
 * glass boxes and thumbs (tier sm, governed full by default), 44px rows.
 * Inside a glass panel the boxes and thumbs flatten automatically.
 * ===================================================================== */

type Force = 'hover' | 'focus' | 'pressed' | (string & {});
const mergeRef = <T,>(...refs: (React.Ref<T> | undefined)[]) => (n: T | null) => {
  for (const r of refs) { if (typeof r === 'function') r(n); else if (r) (r as React.MutableRefObject<T | null>).current = n; }
};

interface ChoiceBase extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
  /** Secondary line under the label. */
  description?: React.ReactNode;
  /** Error message (sets aria-invalid). */
  error?: React.ReactNode;
  loading?: boolean;
  accent?: Accent;
  /** @internal showcase / visual tests. */
  forceState?: Force;
}

function Msg({ id, error, description }: { id: string; error?: React.ReactNode; description?: React.ReactNode }) {
  if (error) return <span id={id} className="ul-choice-msg" data-tone="error"><span className="ul-choice-msg-icon" aria-hidden="true"><Icon name="alert" /></span>{error}</span>;
  if (description) return <span id={id} className="ul-choice-msg">{description}</span>;
  return null;
}

/* ---------------- Checkbox ---------------- */
export interface ULCheckboxProps extends ChoiceBase {
  /** Mixed state (aria-checked="mixed"). */
  indeterminate?: boolean;
  /** Called with the next checked state. The inherited native `onChange` (DOM event) is still forwarded (documented native wrapper). */
  onCheckedChange?: (checked: boolean) => void;
}
/** Checkbox with a glass box: subtle when off, vivid accent when on or mixed. Space toggles. */
export const ULCheckbox = React.forwardRef<HTMLInputElement, ULCheckboxProps>(function ULCheckbox(
  { label, description, error, loading, accent, forceState, indeterminate, className, style, disabled, checked, defaultChecked, onChange, onCheckedChange, id, ...rest }, ref,
) {
  const inner = React.useRef<HTMLInputElement | null>(null);
  const [own, setOwn] = React.useState(!!defaultChecked);
  const on = checked ?? own;
  const uid = useDomId('ul-cb', id);
  React.useEffect(() => { if (inner.current) inner.current.indeterminate = !!indeterminate; }, [indeterminate]);
  const msg = error || description ? `${uid}-m` : undefined;
  return (
    <label className={cx('ul-choice', className)} style={style} data-disabled={disabled || undefined} data-invalid={error ? '' : undefined} data-loading={loading || undefined} data-ul-force={forceState || undefined}>
      <input ref={mergeRef(inner, ref)} id={uid} type="checkbox" className="ul-choice-input" disabled={disabled || loading} checked={checked} defaultChecked={checked === undefined ? defaultChecked : undefined}
        aria-invalid={error ? true : undefined} aria-describedby={msg} aria-busy={loading || undefined}
        onChange={(e) => { if (checked === undefined) setOwn(e.target.checked); onCheckedChange?.(e.target.checked); onChange?.(e); }} {...rest} />
      <ULGlass as="span" aria-hidden="true" tier="sm" radius="var(--ul-selection-box-radius)" className="ul-check-box" materialCategory="controls" pressable={!disabled && !loading} pressScale={0.92}
        accent={error ? 'var(--ul-color-danger)' : accent} accentStrength={on || indeterminate ? 'vivid' : 'subtle'} data-on={on || indeterminate ? '' : undefined}>
        {loading ? <ULSpinner /> : (
          <svg viewBox="0 0 24 24" className="ul-check-mark" aria-hidden="true">
            {indeterminate ? <path d="M6 12h12" pathLength={1} /> : <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />}
          </svg>
        )}
        <span className="ul-choice-ring" aria-hidden="true" />
      </ULGlass>
      {label || description || error ? (
        <span className="ul-choice-text">
          {label ? <span className="ul-choice-label">{label}</span> : null}
          <Msg id={`${uid}-m`} error={error} description={description} />
        </span>
      ) : null}
    </label>
  );
});

/* ---------------- Radio + group ---------------- */
interface GroupCtx { name: string; value: string | undefined; set: (v: string) => void; disabled?: boolean; accent?: Accent; invalid?: boolean }
const RadioCtx = React.createContext<GroupCtx | null>(null);

export interface ULRadioProps extends ChoiceBase { /** Value reported to ULRadioGroup.onValueChange when this radio is chosen. */ value: string }
/** One option of a ULRadioGroup. Native radios: arrow keys move and select, one tab stop per group. */
export const ULRadio = React.forwardRef<HTMLInputElement, ULRadioProps>(function ULRadio(
  { label, description, error, loading, accent, forceState, className, style, disabled, value, id, onChange, ...rest }, ref,
) {
  const g = React.useContext(RadioCtx);
  const uid = useDomId('ul-rd', id);
  const on = g ? g.value === value : !!rest.checked;
  const off = disabled || g?.disabled;
  const msg = error || description ? `${uid}-m` : undefined;
  return (
    <label className={cx('ul-choice', className)} style={style} data-disabled={off || undefined} data-invalid={error || g?.invalid ? '' : undefined} data-ul-force={forceState || undefined}>
      <input ref={ref} id={uid} type="radio" className="ul-choice-input" name={g?.name} value={value} disabled={off || loading} checked={g ? on : rest.checked}
        aria-describedby={msg} onChange={(e) => { if (e.target.checked) g?.set(value); onChange?.(e); }} {...rest} />
      <ULGlass as="span" aria-hidden="true" tier="sm" radius="50%" className="ul-radio-box" materialCategory="controls" pressable={!off} pressScale={0.92}
        accent={g?.invalid ? 'var(--ul-color-danger)' : accent ?? g?.accent} accentStrength={on ? 'vivid' : 'subtle'} data-on={on ? '' : undefined}>
        <span className="ul-radio-dot" aria-hidden="true" />
        <span className="ul-choice-ring" aria-hidden="true" />
      </ULGlass>
      {label || description || error ? (
        <span className="ul-choice-text">
          {label ? <span className="ul-choice-label">{label}</span> : null}
          <Msg id={`${uid}-m`} error={error} description={description} />
        </span>
      ) : null}
    </label>
  );
});

export interface ULRadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** Visible group label (or pass aria-label). */
  label?: React.ReactNode;
  /** Form field name (native radios share it). Default: generated. */ name?: string;
  /** Controlled selected value. */ value?: string;
  /** Initial value when uncontrolled. */ defaultValue?: string;
  /** Called with the chosen radio's value. */ onValueChange?: (v: string) => void;
  /** "horizontal" (default) | "vertical"; arrow keys follow it. */ orientation?: 'vertical' | 'horizontal';
  /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean;
  /** Error message; sets aria-invalid and replaces the helper. */ error?: React.ReactNode;
  /** Help text under the group (aria-describedby). */ helper?: React.ReactNode;
  /** Accent colour: accent name ("violet", "ice", "emerald", "amber", "rose") or a CSS colour (checked by guardAccent). */ accent?: Accent;
  /** ULRadio items. */ children?: React.ReactNode;
}
export function ULRadioGroup({ label, name, value, defaultValue, onValueChange, orientation = 'vertical', disabled, error, helper, accent, className, children, ...rest }: ULRadioGroupProps) {
  const uid = useDomId('ul-rg');
  const [own, setOwn] = React.useState(defaultValue);
  const v = value ?? own;
  const ctx = React.useMemo<GroupCtx>(() => ({ name: name ?? uid, value: v, set: (x) => { if (value === undefined) setOwn(x); onValueChange?.(x); }, disabled, accent, invalid: !!error }), [name, uid, v, value, onValueChange, disabled, accent, error]);
  return (
    <div role="radiogroup" aria-labelledby={label ? `${uid}-l` : undefined} aria-describedby={error || helper ? `${uid}-m` : undefined} aria-invalid={error ? true : undefined}
      aria-disabled={disabled || undefined} className={cx('ul-choice-group', className)} data-orientation={orientation} {...rest}>
      {label ? <span id={`${uid}-l`} className="ul-choice-group-label">{label}</span> : null}
      <div className="ul-choice-group-items"><RadioCtx.Provider value={ctx}>{children}</RadioCtx.Provider></div>
      <Msg id={`${uid}-m`} error={error} description={helper} />
    </div>
  );
}

/* ---------------- Switch ---------------- */
export interface ULSwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'type'> {
  /** Visible label / accessible name. */ label?: React.ReactNode;
  /** Secondary text (aria-describedby). */ description?: React.ReactNode;
  /** "glass" | "flat" (controls category); flat keeps the lens geometry and timing as a flat pill. @default undefined (resolved: "glass") */ material?: Material;
  /** Controlled on / off state (role="switch"). */ checked?: boolean;
  /** Initial state when uncontrolled. Default false. */ defaultChecked?: boolean;
  /** Called with the next state (click, Space / Enter, thumb drag). */ onCheckedChange?: (on: boolean) => void;
  /** Shows a spinner and sets aria-busy; stays focusable. Default false. */ loading?: boolean;
  /** Error message; sets aria-invalid and replaces the helper. */ error?: React.ReactNode;
  /** Accent colour: accent name ("violet", "ice", "emerald", "amber", "rose") or a CSS colour (checked by guardAccent). */ accent?: Accent;
  /** Glass lens bubble while pressed / travelling. Default true. */
  lens?: boolean;
  /** @internal */
  forceState?: Force;
}
/**
 * Switch: inset track + flat capsule thumb (width = height × --ul-switch-thumb-ratio, concentric with the track).
 * Drag to set: on press the shared lens bubble grows on the thumb; while held it follows the pointer along the track
 * (rubber band past the ends, elastic two-edge model). The state is decided ON RELEASE from the bubble centre
 * (+ flick projection): past the midpoint = on. A press without moving beyond --ul-switch-drag-threshold is a click and
 * toggles. aria-checked / onCheckedChange change only on release, exactly once, never if unchanged. Esc / pointercancel
 * restore. During the drag the fill previews the position (--ul-switch-p) without changing aria-checked.
 * Space / Enter toggle (native button) through the same bubble path, shortened.
 */
export const ULSwitch = React.forwardRef<HTMLButtonElement, ULSwitchProps>(function ULSwitch(
  { label, description, material, checked, defaultChecked = false, onCheckedChange, loading, error, accent, lens = true, forceState, disabled, className, style, id, onClick, onKeyDown, onKeyUp, onPointerDown, ...rest }, ref,
) {
  const [own, setOwn] = React.useState(defaultChecked);
  const [pressed, setPressed] = React.useState(false);
  const on = checked ?? own;
  const onRef = React.useRef(on); onRef.current = on;
  const uid = useDomId('ul-sw', id);
  const mat = useMaterial('controls', material);
  const off = disabled || loading;
  const btn = React.useRef<HTMLButtonElement | null>(null);
  const knob = React.useRef<HTMLSpanElement | null>(null);
  const setBtn = React.useCallback((n: HTMLButtonElement | null) => { btn.current = n; if (typeof ref === 'function') ref(n); else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = n; }, [ref]);
  const bubble = React.useRef<LensBubble | null>(null);
  // cached geometry (button-local px), measured on press / show, never per frame
  const G = React.useRef({ W: 64, H: 44, th: 24, tw: 37, TH: 28, inset: 2, offC: 20, onC: 44, cc: 22, thr: 4, flick: 140, rubber: 0.55 });
  const cur = React.useRef({ c: 0 });
  const drag = React.useRef<null | { id: number; x0: number; c0: number; on0: boolean; moved: boolean; lx: number; lt: number; v: number }>(null);
  const viaKey = React.useRef(false);
  const handled = React.useRef(0); // time of the last pointer-path release: the click that follows it is not a second toggle
  const measure = () => {
    const b = btn.current, k = knob.current?.parentElement;
    if (!b || !k) return;
    const cs = getComputedStyle(b);
    const n = (p: string, f: number) => { const v = parseFloat(cs.getPropertyValue(p)); return Number.isFinite(v) ? v : f; };
    const W = b.offsetWidth, H = b.offsetHeight, tw = k.offsetWidth, th = k.offsetHeight, inset = n('--ul-selection-switch-inset', 2), TH = n('--ul-selection-switch-h', 28);
    G.current = { W, H, th, tw, TH, inset, offC: inset + tw / 2, onC: W - inset - tw / 2, cc: H / 2, thr: n('--ul-switch-drag-threshold', 4), flick: n('--ul-lens-flick', 140), rubber: n('--ul-lens-rubber', 0.55) };
  };
  const restC = (v: boolean) => (v ? G.current.onC : G.current.offC);
  React.useEffect(() => {
    const b = btn.current;
    if (!b) return;
    measure();
    cur.current.c = restC(onRef.current);
    const lb = new LensBubble({
      kind: 'switch', axis: 'x', host: b,
      geometry: () => { const g = G.current; return { c: cur.current.c, cc: g.cc, w: g.tw, h: g.th, r: g.th / 2, wrap: { lo: 0, hi: g.W, cross: g.TH, r: g.TH / 2 } }; },
      knobs: () => [knob.current],
      busy: () => !!drag.current,
      earlyShrink: true,
      // the flat knob rides the same settle spring, so it can finish the settle alone after the bubble is gone
      onFrame: (c) => { const k = knob.current?.parentElement; if (!k) return; k.style.translate = c === null ? '' : `${(c - G.current.offC).toFixed(2)}px -50%`; },
      onLive: (live) => b.toggleAttribute('data-lens-live', live),
    });
    bubble.current = lb;
    return () => { lb.destroy(); bubble.current = null; };
  }, []);
  React.useEffect(() => { if (bubble.current) { bubble.current.enabled = lens && !off; if (!bubble.current.enabled) bubble.current.kill(); } }, [lens, off]);
  React.useEffect(() => { if (forceState !== 'pressed') return; const b = bubble.current; measure(); cur.current.c = restC(onRef.current); b?.press(); return () => b?.release(); }, [forceState]);
  // programmatic / keyboard changes: travel from the old end to the new one (quicker), then settle and shrink
  const fromUs = React.useRef(false);
  const first = React.useRef(true);
  React.useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    const self = fromUs.current; fromUs.current = false;
    if (drag.current) return;
    const lb = bubble.current;
    if (!lb || !lb.enabled) { cur.current.c = restC(on); return; }
    const kind = self && !viaKey.current ? 'click' : 'key'; // keyboard + programmatic: 70 % of the click toggle
    viaKey.current = false;
    if (!lb.active) { measure(); cur.current.c = restC(!on); } // appear on the old end…
    lb.toggle(kind);
    cur.current.c = restC(on); // …and glide to the new one
  }, [on]);
  const commit = (next: boolean) => {
    if (next === onRef.current) return;
    fromUs.current = true;
    if (checked === undefined) setOwn(next);
    onCheckedChange?.(next);
  };
  const preview = (p: number | null) => { const b = btn.current; if (!b) return; if (p === null) b.style.removeProperty('--ul-switch-p'); else b.style.setProperty('--ul-switch-p', p.toFixed(3)); };
  const endDrag = (cancel: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setPressed(false);
    const g = G.current;
    let next = d.on0;
    if (!cancel) {
      if (!d.moved) { next = !d.on0; bubble.current?.toggle('click'); } // click: the calm toggle path
      else {
        // flick projection with the velocity at release, decaying to 0 when the pointer rested 60ms (as documented; the code used 40ms,
        // so one 16.7ms frame between the last move and pointerup at 60 Hz cut a flick's velocity by 42 % and dropped it below the
        // threshold). Whether it is a flick is decided on the gesture speed (≥ 0.15 px/ms), not on the decayed value.
        const idle = performance.now() - d.lt, v0 = idle > 60 ? 0 : d.v * (1 - idle / 60), v = Math.abs(d.v) < 0.15 ? 0 : v0;
        next = cur.current.c + v * g.flick > (g.offC + g.onC) / 2;
      }
    }
    cur.current.c = restC(next);
    handled.current = performance.now();
    setTimeout(() => { handled.current = 0; }, 0); // only the click of THIS release is swallowed
    preview(null);
    commit(next);
    bubble.current?.release();
    try { btn.current?.releasePointerCapture(d.id); } catch { /* not captured */ }
  };
  React.useEffect(() => {
    if (!pressed) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && drag.current) { e.preventDefault(); endDrag(true); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [pressed]);
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(e);
    if (off || e.button !== 0 || e.defaultPrevented) return;
    measure();
    const c0 = restC(onRef.current);
    cur.current.c = c0;
    drag.current = { id: e.pointerId, x0: e.clientX, c0, on0: onRef.current, moved: false, lx: e.clientX, lt: performance.now(), v: 0 };
    handled.current = 0;
    setPressed(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    bubble.current?.press();
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const g = G.current, dx = e.clientX - d.x0, now = performance.now();
    if (!d.moved && Math.abs(dx) > g.thr) d.moved = true;
    const dt = Math.max(1, now - d.lt);
    d.v = d.v * 0.4 + ((e.clientX - d.lx) / dt) * 0.6; d.lx = e.clientX; d.lt = now;
    if (!d.moved) return;
    cur.current.c = rubberBand(d.c0 + dx, g.offC, g.onC, g.rubber, g.tw);
    preview(Math.min(1, Math.max(0, (cur.current.c - g.offC) / (g.onC - g.offC))));
  };
  const msg = error || description ? `${uid}-m` : undefined;
  return (
    <div className={cx('ul-switch-row', className)} style={style} data-ul-material={mat.attr} data-disabled={disabled || undefined} data-invalid={error ? '' : undefined} data-ul-force={forceState || undefined}>
      <button ref={setBtn} id={uid} type="button" role="switch" aria-checked={on} aria-labelledby={label ? `${uid}-l` : undefined} aria-describedby={msg} aria-busy={loading || undefined}
        aria-invalid={error ? true : undefined} disabled={off} className="ul-switch" data-on={on ? '' : undefined} data-pressed={pressed || forceState === 'pressed' ? '' : undefined}
        data-no-lens={lens ? undefined : ''}
        onClick={(e) => { if (handled.current && performance.now() - handled.current < 400) { handled.current = 0; onClick?.(e); return; } handled.current = 0; if (!off) commit(!onRef.current); onClick?.(e); }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={(e) => { if (drag.current && e.pointerId === drag.current.id) endDrag(false); }}
        onPointerCancel={() => endDrag(true)}
        onLostPointerCapture={() => { if (drag.current) endDrag(false); }}
        onKeyDown={(e) => { handled.current = 0; if (e.key === ' ' || e.key === 'Enter') viaKey.current = true; if (e.key === ' ' && !off && !e.repeat) { setPressed(true); measure(); cur.current.c = restC(onRef.current); bubble.current?.press(); } onKeyDown?.(e); }}
        onKeyUp={(e) => { if (e.key === ' ') { setPressed(false); bubble.current?.release(); } onKeyUp?.(e); }}
        onBlur={() => { if (drag.current) endDrag(true); else if (pressed) { setPressed(false); bubble.current?.release(); } }}
        {...rest}>
        <span className="ul-switch-track" aria-hidden="true"><span className="ul-switch-fill" /></span>
        <span className="ul-switch-knob" aria-hidden="true">
          <span ref={knob} className="ul-thumb-knob" />
          {loading ? <ULSpinner /> : null}
        </span>
        <span className="ul-choice-ring ul-switch-ring" aria-hidden="true" />
      </button>
      {label || description || error ? (
        <span className="ul-choice-text">
          {label ? <span id={`${uid}-l`} className="ul-choice-label" onClick={() => { if (!off) commit(!onRef.current); }}>{label}</span> : null}
          <Msg id={`${uid}-m`} error={error} description={description} />
        </span>
      ) : null}
    </div>
  );
});
