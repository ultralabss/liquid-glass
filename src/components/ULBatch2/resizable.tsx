import * as React from 'react';
import { cx, useDomId } from '../shared/icons.tsx';
import { isMorphReduced, getMorphTimeScale } from '../../motion/anchoredMorph.ts';
import './batch2.css';

/* =====================================================================
 * ULResizable: ULResizablePanelGroup > ULResizablePanel + ULResizableHandle.
 * Sizes are percentages in a ref, written as CSS variables (--ul-rs-<i>) once per frame by one rAF follow loop
 * (the slider's critically damped follow, tau = --ul-slider-follow while dragging, --ul-resizable-collapse-tau for
 * collapse / reset / keys). No React state per pointermove; aria-valuenow is written on the handle node.
 * ===================================================================== */
export interface ULResizablePanelProps {
  id?: string;
  /** Percent of the group. Panels without one share what is left. */
  defaultSize?: number;
  minSize?: number; maxSize?: number;
  /** Can collapse to collapsedSize (Enter on its handle, or dragging below minSize / 2). */
  collapsible?: boolean;
  collapsedSize?: number;
  /** Accessible name (handles use it for aria-label). */
  label?: string;
  children?: React.ReactNode;
  className?: string; style?: React.CSSProperties;
  /** @internal */ __i?: number;
}
export interface ULResizableHandleProps { /** Grip dots (default true). */ withGrip?: boolean; label?: string; className?: string; /** @internal */ __i?: number }
export interface ULResizablePanelGroupProps {
  direction?: 'horizontal' | 'vertical';
  /** localStorage key (per viewer, try / catch); restores sizes on mount. */
  storageKey?: string;
  /** Committed layout (pointer up, key, collapse, reset) in percent. */
  onLayout?: (sizes: number[]) => void;
  /** Below this group width (px) the panels stack vertically at their natural height and the handles hide. */
  stackBelow?: number;
  children: React.ReactNode;
  className?: string; style?: React.CSSProperties;
  /** @internal tests */ apiRef?: React.MutableRefObject<ResizableApi | null>;
}
export interface ResizableApi { /** committed layout (targets) */ sizes(): number[]; /** painted sizes this frame */ visual(): number[]; setSizes(s: number[], animate?: boolean): void; collapse(i: number): void; expand(i: number): void; renders(): number }
interface PanelSpec { id: string; def?: number; min: number; max: number; collapsible: boolean; csize: number; label?: string }
interface Ctx { dir: 'horizontal' | 'vertical'; specs: PanelSpec[]; down: (i: number, e: React.PointerEvent) => void; key: (i: number, e: React.KeyboardEvent) => void; reset: (i: number) => void; uid: string; init: number[] }
const RCtx = React.createContext<Ctx | null>(null);
const num = (el: Element, k: string, f: number) => { const v = parseFloat(getComputedStyle(el).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
const r2 = (x: number) => Math.round(x * 100) / 100;

function defaults(specs: PanelSpec[]) {
  const given = specs.reduce((a, s) => a + (s.def ?? 0), 0), free = specs.filter((s) => s.def == null).length;
  return specs.map((s) => (s.def != null ? s.def : free ? Math.max(0, (100 - given) / free) : 0));
}
function load(key: string | undefined, n: number): number[] | null {
  if (!key) return null;
  try { const v = JSON.parse(localStorage.getItem('ul-resizable:' + key) || 'null'); return Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'number') ? v : null; } catch { return null; }
}
function save(key: string | undefined, s: number[]) { if (!key) return; try { localStorage.setItem('ul-resizable:' + key, JSON.stringify(s.map(r2))); } catch { /* private mode / quota */ } }

export function ULResizablePanelGroup({ direction = 'horizontal', storageKey, onLayout, stackBelow, children, className, style, apiRef }: ULResizablePanelGroupProps) {
  const uid = useDomId('ul-rs');
  const renders = React.useRef(0); renders.current++;
  // children → panels (index) + handles (index of the panel before them)
  const specs: PanelSpec[] = []; let pi = -1;
  const kids = React.Children.toArray(children).map((c) => {
    if (!React.isValidElement(c)) return c;
    if (c.type === ULResizablePanel) { pi++; const p = c.props as ULResizablePanelProps; specs.push({ id: p.id ?? `${uid}-p${pi}`, def: p.defaultSize, min: p.minSize ?? 0, max: p.maxSize ?? 100, collapsible: !!p.collapsible, csize: p.collapsedSize ?? 0, label: p.label }); return React.cloneElement(c as React.ReactElement<ULResizablePanelProps>, { __i: pi }); }
    if (c.type === ULResizableHandle) return React.cloneElement(c as React.ReactElement<ULResizableHandleProps>, { __i: pi });
    return c;
  });
  const n = specs.length;
  const [init] = React.useState(() => load(storageKey, n) ?? defaults(specs));
  const root = React.useRef<HTMLDivElement | null>(null);
  const cur = React.useRef<number[]>(init.slice()), tgt = React.useRef<number[]>(init.slice()), raf = React.useRef(0), last = React.useRef(0), tau = React.useRef(75);
  const specsRef = React.useRef(specs); specsRef.current = specs;
  const layoutRef = React.useRef(onLayout); layoutRef.current = onLayout;
  const write = () => {
    const el = root.current; if (!el) return;
    cur.current.forEach((v, i) => el.style.setProperty(`--ul-rs-${i}`, String(r2(v))));
    el.querySelectorAll<HTMLElement>(':scope > .ul-rs-handle').forEach((h) => { const i = Number(h.dataset.i); const v = cur.current[i], A = specsRef.current[i], B = specsRef.current[i + 1]; if (v == null || !A || !B) return; const pair = v + cur.current[i + 1]; h.setAttribute('aria-valuenow', String(Math.round(v))); h.setAttribute('aria-valuemin', String(Math.round(Math.max(A.collapsible ? A.csize : A.min, pair - B.max)))); h.setAttribute('aria-valuemax', String(Math.round(Math.min(A.max, pair - (B.collapsible ? B.csize : B.min))))); });
    el.querySelectorAll<HTMLElement>(':scope > .ul-rs-panel').forEach((p) => { const i = Number(p.dataset.i), s = specsRef.current[i]; p.toggleAttribute('data-collapsed', !!s?.collapsible && cur.current[i] <= s.csize + 0.05); });
  };
  const tick = (now: number) => {
    raf.current = 0;
    const a = 1 - Math.exp(-Math.min(48, now - last.current) / Math.max(1, tau.current * getMorphTimeScale())); last.current = now;
    let moving = false;
    cur.current = cur.current.map((v, i) => { const d = tgt.current[i] - v; if (Math.abs(d) < 0.02) return tgt.current[i]; moving = true; return v + d * a; });
    write();
    if (moving) raf.current = requestAnimationFrame(tick);
  };
  const kick = (t: number, snap = false) => { tau.current = t; if (snap || isMorphReduced()) { cancelAnimationFrame(raf.current); raf.current = 0; cur.current = tgt.current.slice(); write(); return; } if (!raf.current) { last.current = performance.now(); raf.current = requestAnimationFrame(tick); } };
  const commit = () => { const s = tgt.current.map(r2); save(storageKey, s); layoutRef.current?.(s); };
  React.useLayoutEffect(() => { write(); }, []);
  React.useEffect(() => () => cancelAnimationFrame(raf.current), []);
  // move the boundary after panel i by delta percent (i grows, i + 1 shrinks), clamped by both panels
  const shift = (i: number, delta: number, from = tgt.current) => {
    const A = specsRef.current[i], B = specsRef.current[i + 1]; if (!A || !B) return from;
    const s = from.slice(), pair = s[i] + s[i + 1];
    let a = s[i] + delta;
    const aMin = Math.max(A.collapsible ? A.csize : A.min, pair - B.max), aMax = Math.min(A.max, pair - (B.collapsible ? B.csize : B.min));
    // collapsible: below half the min size snaps to collapsed, otherwise at least min
    if (A.collapsible && a < A.min) a = a < A.min / 2 ? A.csize : A.min;
    if (B.collapsible && pair - a < B.min) a = pair - a < B.min / 2 ? pair - B.csize : pair - B.min;
    a = Math.min(aMax, Math.max(aMin, a));
    s[i] = a; s[i + 1] = pair - a; return s;
  };
  const drag = React.useRef<{ i: number; start: number[]; x: number; len: number; id: number } | null>(null);
  const down = (i: number, e: React.PointerEvent) => {
    if (e.button !== 0 || !root.current) return;
    const r = root.current.getBoundingClientRect(), len = direction === 'horizontal' ? r.width : r.height;
    drag.current = { i, start: tgt.current.slice(), x: direction === 'horizontal' ? e.clientX : e.clientY, len, id: e.pointerId };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic / ended pointer */ } (e.currentTarget as HTMLElement).setAttribute('data-dragging', '');
    const move = (ev: PointerEvent) => { const d = drag.current; if (!d || ev.pointerId !== d.id) return; const p = direction === 'horizontal' ? ev.clientX : ev.clientY; tgt.current = shift(d.i, ((p - d.x) / d.len) * 100, d.start); kick(num(root.current!, '--ul-slider-follow', 75)); };
    const up = (ev: PointerEvent) => { const d = drag.current; if (!d || ev.pointerId !== d.id) return; drag.current = null; h.removeAttribute('data-dragging'); h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); commit(); };
    const h = e.currentTarget as HTMLElement;
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    e.preventDefault();
  };
  const toggle = (i: number) => {
    const A = specsRef.current[i], B = specsRef.current[i + 1]; const ct = num(root.current!, '--ul-resizable-collapse-tau', 90);
    const which = A?.collapsible ? i : B?.collapsible ? i + 1 : -1; if (which < 0) return;
    const S = specsRef.current[which], collapsed = tgt.current[which] <= S.csize + 0.05;
    const want = collapsed ? Math.max(S.min, (init[which] > S.csize + 0.05 ? init[which] : defaults(specsRef.current)[which])) : S.csize;
    tgt.current = shift(i, which === i ? want - tgt.current[i] : tgt.current[i + 1] - want); kick(ct); commit();
  };
  const key = (i: number, e: React.KeyboardEvent) => {
    const fwd = direction === 'horizontal' ? 'ArrowRight' : 'ArrowDown', back = direction === 'horizontal' ? 'ArrowLeft' : 'ArrowUp', step = e.shiftKey ? 10 : 1, ct = num(root.current!, '--ul-resizable-collapse-tau', 90);
    let d: number | null = null;
    if (e.key === fwd) d = step; else if (e.key === back) d = -step;
    else if (e.key === 'Home') d = -1000; else if (e.key === 'End') d = 1000;
    else if (e.key === 'Enter') { e.preventDefault(); toggle(i); return; }
    if (d == null) return;
    e.preventDefault();
    // keys step without the collapse snap (1% at a time reaches min, then collapsed only via Enter / Home on a collapsible panel)
    const A = specsRef.current[i], B = specsRef.current[i + 1], s = tgt.current.slice(), pair = s[i] + s[i + 1];
    const lo = Math.max(e.key === 'Home' && A.collapsible ? A.csize : A.min, pair - B.max), hi = Math.min(A.max, pair - (e.key === 'End' && B.collapsible ? B.csize : B.min));
    const a = Math.min(hi, Math.max(lo, s[i] + d)); s[i] = a; s[i + 1] = pair - a; tgt.current = s; kick(ct); commit();
  };
  const reset = (i: number) => { const def = defaults(specsRef.current), s = tgt.current.slice(), pair = s[i] + s[i + 1], dp = def[i] + def[i + 1] || 1; s[i] = pair * (def[i] / dp); s[i + 1] = pair - s[i]; tgt.current = s; kick(num(root.current!, '--ul-resizable-collapse-tau', 90)); commit(); };
  // stack below a width
  const [stacked, setStacked] = React.useState(false);
  React.useEffect(() => {
    if (!stackBelow || !root.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([en]) => setStacked(en.contentRect.width < stackBelow)); ro.observe(root.current.parentElement ?? root.current); return () => ro.disconnect();
  }, [stackBelow]);
  React.useEffect(() => { if (!apiRef) return; apiRef.current = { sizes: () => tgt.current.map(r2), visual: () => cur.current.map(r2), setSizes: (s, an = true) => { tgt.current = s.slice(); kick(num(root.current!, '--ul-resizable-collapse-tau', 90), !an); commit(); }, collapse: (i) => { const S = specsRef.current[i]; if (!S?.collapsible) return; const j = i < n - 1 ? i : i - 1; tgt.current = shift(j, j === i ? S.csize - tgt.current[i] : tgt.current[i] - S.csize); kick(90); commit(); }, expand: (i) => { const j = i < n - 1 ? i : i - 1; if (tgt.current[i] <= specsRef.current[i].csize + 0.05) toggle(j); }, renders: () => renders.current }; });
  const ctx = React.useMemo<Ctx>(() => ({ dir: direction, specs, down, key, reset, uid, init }), [direction, specs.map((s) => `${s.id}:${s.min}:${s.max}:${s.collapsible}`).join('|')]);
  return (
    <RCtx.Provider value={ctx}>
      <div ref={root} className={cx('ul-rs-group', className)} data-direction={direction} data-stacked={stacked ? '' : undefined}
        style={{ ...Object.fromEntries(init.map((v, i) => [`--ul-rs-${i}`, String(r2(v))])), ...style } as React.CSSProperties}>
        {kids}
      </div>
    </RCtx.Provider>
  );
}

export function ULResizablePanel({ __i = 0, children, className, style, id, label }: ULResizablePanelProps) {
  const c = React.useContext(RCtx); const s = c?.specs[__i];
  return (
    <div id={s?.id ?? id} className={cx('ul-rs-panel', className)} data-i={__i} aria-label={label} role={label ? 'region' : undefined}
      style={{ flexBasis: `calc(var(--ul-rs-${__i}) * 1%)`, ...style }}>
      <div className="ul-rs-inner">{children}</div>
    </div>
  );
}

export function ULResizableHandle({ __i = 0, withGrip = true, label, className }: ULResizableHandleProps) {
  const c = React.useContext(RCtx); if (!c) return null;
  const A = c.specs[__i], B = c.specs[__i + 1];
  const pair = (c.init[__i] ?? 0) + (c.init[__i + 1] ?? 0);
  const lo = A && B ? Math.max(A.collapsible ? A.csize : A.min, pair - B.max) : 0, hi = A && B ? Math.min(A.max, pair - (B.collapsible ? B.csize : B.min)) : 100;
  return (
    <div role="separator" tabIndex={0} className={cx('ul-rs-handle', className)} data-i={__i} data-grip={withGrip ? '' : undefined}
      aria-orientation={c.dir === 'horizontal' ? 'vertical' : 'horizontal'} aria-controls={A?.id} aria-label={label ?? A?.label}
      aria-valuemin={Math.round(lo)} aria-valuemax={Math.round(hi)} aria-valuenow={Math.round(c.init[__i] ?? 0)}
      onPointerDown={(e) => c.down(__i, e)} onKeyDown={(e) => c.key(__i, e)} onDoubleClick={() => c.reset(__i)}>
      <span className="ul-rs-line" aria-hidden="true"></span>
      {withGrip ? <span className="ul-rs-grip" aria-hidden="true"><i></i><i></i><i></i></span> : null}
    </div>
  );
}
