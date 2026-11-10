import * as React from 'react';
import { createPortal } from 'react-dom';
import { ULAnchoredSurface } from '../ULAnchoredSurface/ULAnchoredSurface.tsx';
import type { AnchoredMorph } from '../../motion/anchoredMorph.ts';
import { isMorphReduced, getMorphTimeScale } from '../../motion/anchoredMorph.ts';
import { springs } from '../../motion/spring.ts';
import { createVirtualAnchor, centerRect, edgeRect, type VirtualRect, type Edge } from '../../motion/virtualAnchor.ts';
import { createAnchoredTooltip } from '../ULTooltip/anchoredTooltip.ts';
import { measureGlassNow } from '../../glass/engine.ts';
import { keepOnTop } from '../../motion/topLayer.ts';
import { useMediaQuery } from '../../hooks/useReducedMotion.ts';
import type { Accent, AccentStrength, Backdrop } from '../../glass/accent.tsx';
import type { Align, Side } from '../../motion/placement.ts';
import { ULButton } from '../ULButton/ULButton.tsx';
import { Icon, cx, useDomId } from '../shared/icons.tsx';
import { ULDialogSurface } from './ULDialog.tsx';
import './ULContainers.css';
import { withContextMenu, splitCtx, type ContextMenuProps } from './contextTarget.tsx';

/* =====================================================================
 * Overlays built on ULAnchoredSurface (anchored morph, clip-path hole, shared scroll behavior, overlay stack).
 * None has its own enter / exit, placement or scrolling. Modal / sheet / drawer: role dialog, aria-modal, focus trap,
 * Esc + scrim close, focus returns, scroll lock (no shift), stacking. Popover: follows its anchor. Toasts: fixed.
 * ===================================================================== */

/** A virtual anchor created synchronously at render (the surface's layout effect runs before the parent's). */
function useVirtualAnchor(active: boolean, rect: () => VirtualRect) {
  const ref = React.useRef<HTMLElement | null>(null);
  const va = React.useRef<ReturnType<typeof createVirtualAnchor> | null>(null);
  const was = React.useRef(false);
  if (typeof document !== 'undefined' && active) {
    if (!va.current) { va.current = createVirtualAnchor(rect()); ref.current = va.current.el; }
    else if (!was.current) va.current.set(rect()); // re-aim on every open
  }
  was.current = active;
  React.useEffect(() => () => { va.current?.destroy(); va.current = null; ref.current = null; }, []);
  return ref;
}

const closeIcon = <Icon name="x" />;

/* ---------------- Modal / Sheet ---------------- */
export interface ULModalProps {
  /** Controlled open state. */ open: boolean;
  /** Called with the next open state (trigger, Esc, outside click, close button). */ onOpenChange?: (open: boolean) => void;
  /** The trigger: the modal morphs out of it and focus returns to it. Without one it grows from the viewport centre. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Heading (labels the dialog / popover via aria-labelledby). */ title: React.ReactNode;
  /** Text under the title (aria-describedby). */ description?: React.ReactNode;
  /** Footer actions (right-aligned row). */ footer?: React.ReactNode;
  /** sm 400 · md 520 · reading 680 (light reading backdrop, larger line length). */
  size?: 'sm' | 'md' | 'reading';
  /** alertdialog: no scrim close, Esc still closes (cancel). */
  role?: 'dialog' | 'alertdialog';
  /** Close when the scrim is clicked. Default true. */ closeOnScrim?: boolean;
  /** Hide the close button (keep another way to close). Default false. */ hideClose?: boolean;
  /** Accessible label of the close button. Default "Close" (English; pass a translated string). */ closeLabel?: string;
  /** auto (default): bottom sheet ≤ 640px; always: always a sheet; never. */
  sheet?: 'auto' | 'always' | 'never';
  /** Element (or selector) focused on open; null = the surface itself. Default: first focusable. */ initialFocus?: HTMLElement | string | null;
  /** Accent colour: accent name ("violet", "ice", "emerald", "amber", "rose") or a CSS colour (checked by guardAccent). */ accent?: Accent;
  /** "subtle" | "tinted" | "vivid" accent intensity of the glass. */ accentStrength?: AccentStrength;
  /** Backdrop hint for the glass: "dark" | "mid" | "light". */ backdrop?: Backdrop;
  /** Extra class on the root element. */ className?: string;
  /** Dialog body. */ children?: React.ReactNode;
  /** @internal tests */
  surfaceRef?: React.MutableRefObject<HTMLElement | null>;
}

export function ULModal({ open, onOpenChange, triggerRef, title, description, footer, size = 'md', role = 'dialog', closeOnScrim, closeLabel = 'Close', sheet = 'auto', initialFocus, accent, accentStrength, backdrop, className, children, surfaceRef }: ULModalProps) {
  const root = { key: 'root', title, description, footer, content: children, size: size === 'reading' ? 'lg' as const : size };
  return <ULDialogSurface open={open} onOpenChange={onOpenChange} triggerRef={triggerRef} root={root} sheet={sheet} role={role} closeOnScrim={closeOnScrim} closeLabel={closeLabel}
    initialFocus={initialFocus} accent={accent} accentStrength={accentStrength} backdrop={backdrop ?? (size === 'reading' ? 'light' : undefined)} className={className} surfaceRef={surfaceRef} />;
}

/** Bottom sheet on every viewport (same component, sheet="always"). */
export function ULSheet(props: Omit<ULModalProps, 'sheet'>) { return <ULModal {...props} sheet="always" />; }

/* ---------------- Drawer ---------------- */
export interface ULDrawerProps extends Omit<ULModalProps, 'size' | 'sheet' | 'role' | 'triggerRef'> {
  /** right (default; future user drawer) | left (navigation). */
  side?: 'left' | 'right';
  /** The trigger: focus returns to it. The drawer itself grows in from the edge. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** auto (default): bottom sheet ≤ 640px. */
  sheet?: 'auto' | 'never';
}

export function ULDrawer({ open, onOpenChange, side = 'right', triggerRef, title, description, footer, closeOnScrim = true, closeLabel = 'Close', sheet = 'auto', initialFocus, accent, accentStrength, backdrop, className, children, surfaceRef }: ULDrawerProps) {
  const root = { key: 'root', title, description, footer, content: children, size: 'md' as const };
  return <ULDialogSurface open={open} onOpenChange={onOpenChange} triggerRef={triggerRef} root={root} sheet={sheet} edge={side} closeOnScrim={closeOnScrim} closeLabel={closeLabel}
    initialFocus={initialFocus} accent={accent} accentStrength={accentStrength} backdrop={backdrop} className={className} surfaceRef={surfaceRef} />;
}

/* ---------------- Popover ---------------- */
export interface ULPopoverProps {
  /** Controlled open state. */ open: boolean;
  /** Called with the next open state (trigger, Esc, outside click, close button). */ onOpenChange?: (open: boolean) => void;
  /** Trigger element: the surface morphs from it and focus returns to it on close. */ triggerRef: React.RefObject<HTMLElement | null>;
  /** Preferred side: "top" | "bottom" | "left" | "right" (flips when there is no room). */ side?: Side;
  /** Alignment on the side: "start" | "center" | "end". */ align?: Align;
  /** Show the glass arrow toward the trigger. Default false. */ arrow?: boolean;
  /** Reading variant: light backdrop class (dark text scrim stays), wider. */
  reading?: boolean;
  /** Accessible name when there is no visible title. */
  label?: string;
  /** Heading (labels the dialog / popover via aria-labelledby). */ title?: React.ReactNode;
  /** Move focus into the popover on open (default true when it has focusable content). */
  autoFocus?: boolean;
  /** Accent colour: accent name ("violet", "ice", "emerald", "amber", "rose") or a CSS colour (checked by guardAccent). */ accent?: Accent;
  /** Backdrop hint for the glass: "dark" | "mid" | "light". */ backdrop?: Backdrop;
  /** Extra class on the root element. */ className?: string;
  /** Popover body. */ children?: React.ReactNode;
  /** 'covered': the surface starts at the trigger rect in the top layer and covers it from frame 0 (non-modal, no scrim). Default 'above'. */
  anchorVisibility?: 'above' | 'covered';
  /** Close button in the header. Default: on when covered (the trigger is hidden under the surface). */
  closeButton?: boolean;
  /** Accessible label of the close button. Default "Close" (English; pass a translated string). */ closeLabel?: string;
  /** @internal tests */
  surfaceRef?: React.MutableRefObject<HTMLElement | null>;
}

const coverInset = () => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ul-popover-cover-inset')); return Number.isFinite(v) ? v : 12; };
export function ULPopover({ open, onOpenChange, triggerRef, side = 'bottom', align = 'center', arrow = false, reading = false, label, title, autoFocus = true, accent, backdrop, className, children, surfaceRef, anchorVisibility, closeButton, closeLabel = 'Close' }: ULPopoverProps) {
  const covered = anchorVisibility === 'covered', showClose = closeButton ?? covered;
  const id = useDomId('ul-pop');
  const own = React.useRef<HTMLElement | null>(null);
  const sref = React.useMemo(() => ({ get current() { return own.current; }, set current(v: HTMLElement | null) { own.current = v; if (surfaceRef) surfaceRef.current = v; } }), [surfaceRef]) as React.MutableRefObject<HTMLElement | null>;
  const close = React.useCallback(() => onOpenChange?.(false), [onOpenChange]);
  // trigger semantics (the trigger stays the caller's element)
  React.useEffect(() => {
    const t = triggerRef.current; if (!t) return;
    t.setAttribute('aria-haspopup', 'dialog'); t.setAttribute('aria-expanded', String(open));
    if (open) t.setAttribute('aria-controls', id); else t.removeAttribute('aria-controls');
  }, [open]);
  // non-modal: focus in on open, back to the trigger when closed from inside
  React.useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const s = own.current; if (!s || !autoFocus) return;
      const f = s.querySelector<HTMLElement>('[data-autofocus], a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
      f?.focus({ preventScroll: true });
    });
    return () => { cancelAnimationFrame(raf); const s = own.current, a = document.activeElement; if (s && (s.contains(a) || a === document.body)) triggerRef.current?.focus({ preventScroll: true }); };
  }, [open]);
  // arrow points at the anchor centre (measured once settled and on follow flips)
  React.useEffect(() => {
    const s = own.current; if (!arrow || !s || !open) return;
    const upd = () => {
      const a = triggerRef.current?.getBoundingClientRect(), r = s.getBoundingClientRect(); if (!a) return;
      const sd = s.dataset.side, vert = sd === 'top' || sd === 'bottom';
      const p = vert ? a.left + a.width / 2 - r.left : a.top + a.height / 2 - r.top, len = vert ? r.width : r.height;
      const v = `${Math.min(Math.max(p, 18), len - 18).toFixed(1)}px`;
      if (s.style.getPropertyValue('--ul-arrow-pos') === v) return;
      s.style.setProperty('--ul-arrow-pos', v);
      if (!s.hasAttribute('data-ul-morphing')) measureGlassNow(s); // arrow-outline map (cached by shape key; never mid-morph)
    };
    const onM = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.state === 'end' && d.phase === 'enter') upd(); };
    s.addEventListener('ul:morph', onM); addEventListener('resize', upd);
    upd();
    return () => { s.removeEventListener('ul:morph', onM); removeEventListener('resize', upd); };
  }, [open, arrow]);
  return (
    <ULAnchoredSurface
      open={open} anchorRef={triggerRef} onClose={close} id={id} role="dialog" aria-label={title ? undefined : label} aria-labelledby={title ? `${id}-t` : undefined}
      side={side} align={align} scrollBehavior="follow" onAnchorHidden="keep" arrow={arrow && !covered} tier="lg" padding="var(--ul-space-4)" anchorVisibility={anchorVisibility} overlapAnchor={covered ? coverInset() : undefined}
      accent={accent} backdrop={backdrop ?? (reading ? 'light' : undefined)} surfaceRef={sref}
      className={cx('ul-popover', className)} data-reading={reading ? '' : undefined}
    >
      {title || showClose ? (
        <div className="ul-popover-head">
          {title ? <h2 id={`${id}-t`} className="ul-popover-title">{title}</h2> : <span></span>}
          {showClose ? <button type="button" className="ul-popover-close" aria-label={closeLabel} onClick={close}><Icon name="x" size="sm" /></button> : null}
        </div>
      ) : null}
      <div className="ul-popover-body">{children}</div>
    </ULAnchoredSurface>
  );
}

/* ---------------- Tooltip (React wrapper around the one createAnchoredTooltip) ---------------- */
export interface ULTooltipProps { /** Tooltip text (opaque anchored tooltip; never put secrets here). */ content: string; /** Preferred side. Default "top". */ side?: 'top' | 'bottom' | 'left' | 'right'; /** Open delay in ms. Default the shared tooltip delay. */ delay?: number; /** Trigger element (must be focusable). */ children: React.ReactElement }
export function ULTooltip({ content, side = 'top', delay, children }: ULTooltipProps) {
  const box = React.useRef<HTMLSpanElement | null>(null);
  React.useEffect(() => {
    if (!box.current) return;
    const t = createAnchoredTooltip({ container: box.current, layer: document.body, side, delay });
    return () => t.destroy();
  }, [side, delay]);
  return <span ref={box} className="ul-tooltip-host">{React.cloneElement(children, { 'data-ul-tip': content } as Record<string, unknown>)}</span>;
}

/* ---------------- Toast ---------------- */
export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';
export interface ToastOptions { title: React.ReactNode; description?: React.ReactNode; tone?: ToastTone; action?: { label: string; onAction: () => void }; duration?: number; id?: string }
interface ToastEntry extends ToastOptions { id: string; open: boolean; text: string }

const toastIcon: Record<ToastTone, string> = { neutral: 'alert', success: 'check', warning: 'alert', danger: 'alert' };
const textOf = (n: React.ReactNode): string => (typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(textOf).join(' ') : React.isValidElement(n) ? textOf((n.props as { children?: React.ReactNode }).children) : '');

/** Timer that pauses while `paused` is true (hover / focus) and resumes with the remaining time. */
function usePausableTimer(active: boolean, ms: number, paused: boolean, done: () => void) {
  const left = React.useRef(ms), start = React.useRef(0), t = React.useRef(0);
  const doneRef = React.useRef(done); doneRef.current = done;
  React.useEffect(() => { left.current = ms; }, [ms]);
  React.useEffect(() => {
    if (!active || !Number.isFinite(ms) || ms <= 0) return;
    if (paused) return;
    start.current = performance.now();
    t.current = window.setTimeout(() => doneRef.current(), left.current);
    return () => { clearTimeout(t.current); left.current -= performance.now() - start.current; };
  }, [active, paused]);
}

/** Swipe to dismiss (horizontal). Past --ul-toast-swipe the toast fades where it was released. */
function useSwipe(surface: React.MutableRefObject<HTMLElement | null>, morph: React.MutableRefObject<AnchoredMorph | null>, dismiss: () => void) {
  return React.useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as Element).closest('button, a, input')) return;
    const s = surface.current; if (!s) return;
    const x0 = e.clientX; let dx = 0, v = 0, lx = x0, lt = performance.now();
    const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => { dx = ev.clientX - x0; const n = performance.now(); v = (ev.clientX - lx) / Math.max(1, n - lt); lx = ev.clientX; lt = n; s.style.translate = `${dx.toFixed(1)}px 0`; s.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 240)); };
    const up = () => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      const thr = parseFloat(getComputedStyle(s).getPropertyValue('--ul-toast-swipe')) || 64;
      if (Math.abs(dx) > thr || Math.abs(v) > 0.6) { if (morph.current) morph.current.nextExitFade = true; s.style.opacity = ''; dismiss(); return; }
      s.style.opacity = '';
      if (!isMorphReduced()) s.animate([{ translate: `${dx}px 0` }, { translate: '0 0' }], { duration: 380 * getMorphTimeScale(), easing: springs.snappy.toCSS() });
      s.style.translate = '';
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }, []);
}

function ToastBody({ t, onDismiss, dismissLabel }: { t: ToastOptions; onDismiss: () => void; dismissLabel: string }) {
  const tone = t.tone ?? 'neutral';
  return (
    <div className="ul-toast" data-tone={tone}>
      <span className="ul-toast-icon" aria-hidden="true"><Icon name={toastIcon[tone]} /></span>
      <div className="ul-toast-text">
        <p className="ul-toast-title">{t.title}</p>
        {t.description ? <p className="ul-toast-desc">{t.description}</p> : null}
      </div>
      {t.action ? <ULButton variant="secondary" size="sm" onClick={() => { t.action!.onAction(); onDismiss(); }}>{t.action.label}</ULButton> : null}
      <ULButton variant="plain" size="sm" shape="circle" icon={closeIcon} aria-label={dismissLabel} onClick={onDismiss} />
    </div>
  );
}

/** One toast anchored to its trigger (e.g. "Copied" from a copy button). Fixed while open; Esc (focus inside) / swipe / timer dismiss. */
export interface ULToastProps extends ToastOptions, ContextMenuProps<ToastOptions> { /** Controlled open state. */ open: boolean; /** Called with the next open state (trigger, Esc, outside click, close button). */ onOpenChange?: (open: boolean) => void; /** Trigger the toast morphs from (optional; without it the toast enters from its stack). */ anchorRef: React.RefObject<HTMLElement | null>; /** Preferred side: "top" | "bottom" | "left" | "right" (flips when there is no room). */ side?: Side; /** Accessible label of the dismiss button. Default "Dismiss" (English; pass a translated string). */ dismissLabel?: string }
/** contextMenu target: { component: 'toast', kind: 'self', data: the toast options }. */
export function ULToast({ open, onOpenChange, anchorRef, side = 'top', dismissLabel = 'Dismiss', duration, ...t0 }: ULToastProps) {
  const [ctxP, t] = splitCtx(t0) as [ContextMenuProps<ToastOptions>, ToastOptions];
  const [paused, setPaused] = React.useState(false);
  const own = React.useRef<HTMLElement | null>(null), morph = React.useRef<AnchoredMorph | null>(null);
  const close = React.useCallback(() => onOpenChange?.(false), [onOpenChange]);
  const ms = duration ?? (parseFloat(typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--ul-toast-duration') : '') || 5000);
  usePausableTimer(open, ms, paused, close);
  const swipe = useSwipe(own, morph, close);
  // anchored toasts stay above modals like the stack (same keepOnTop, re-promoted in creation order); released once the exit is done
  React.useEffect(() => {
    if (!open) return;
    let release: (() => void) | null = null, raf = 0, poll = 0;
    const grab = () => { const el = own.current; if (el) release = keepOnTop(el); else raf = requestAnimationFrame(grab); };
    grab();
    return () => {
      cancelAnimationFrame(raf);
      const el = own.current;
      poll = window.setInterval(() => { if (!el || !el.isConnected || el.style.visibility === 'hidden' || !el.getClientRects().length) { clearInterval(poll); release?.(); } }, 120);
    };
  }, [open]);
  return (
    <ULAnchoredSurface open={open} anchorRef={anchorRef} onClose={close} role={t.tone === 'danger' ? 'alert' : 'status'} aria-live={t.tone === 'danger' ? 'assertive' : 'polite'}
      side={side} stack={false} closeOnOutside={false} tier="lg" padding="var(--ul-space-2) var(--ul-space-2) var(--ul-space-2) var(--ul-space-4)" surfaceRef={own} morphRef={morph}
      className="ul-toast-surface" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} onPointerDown={swipe}>
      {withContextMenu(<div className="ul-toast-ctx" style={{ display: 'contents' }}><ToastBody t={t} onDismiss={close} dismissLabel={dismissLabel} /></div>, ctxP, 'toast', { data: t })}
    </ULAnchoredSurface>
  );
}

/* ---------------- Toast stack (provider) ---------------- */
interface ToastApi { toast(o: ToastOptions): string; dismiss(id?: string): void }
const ToastCtx = React.createContext<ToastApi | null>(null);
export const useToast = () => { const c = React.useContext(ToastCtx); if (!c) throw new Error('useToast needs <ULToastProvider>'); return c; };

export interface ULToastProviderProps { /** Stack position: "bottom-right" (default) | "bottom-center" | "top-right" | "top-center". */ position?: 'bottom-right' | 'bottom-center' | 'top-right' | 'top-center'; /** Visible at once; the rest wait in a queue. Default --ul-toast-max (3). */ max?: number; /** Accessible label of the dismiss button. Default "Dismiss" (English; pass a translated string). */ dismissLabel?: string; /** Accessible name of the toast region. Default "Notifications" (English; pass a translated string). */ label?: string; /** App content. */ children?: React.ReactNode }

export function ULToastProvider({ position = 'bottom-right', max, dismissLabel = 'Dismiss', label = 'Notifications', children }: ULToastProviderProps) {
  const [list, setList] = React.useState<ToastEntry[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [live, setLive] = React.useState({ polite: '', assertive: '' });
  const seq = React.useRef(0);
  const origin = React.useRef<HTMLSpanElement | null>(null);
  const cap = max ?? (typeof document !== 'undefined' ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ul-toast-max'), 10) || 3 : 3);
  const api = React.useMemo<ToastApi>(() => ({
    toast(o) {
      const id = o.id ?? `t${++seq.current}`;
      const text = [textOf(o.title), textOf(o.description)].filter(Boolean).join('. ');
      setList((l) => [...l.filter((x) => x.id !== id), { ...o, id, open: true, text }]);
      setLive((v) => (o.tone === 'danger' ? { ...v, assertive: text } : { ...v, polite: text }));
      return id;
    },
    dismiss(id) { setList((l) => l.map((x) => (!id || x.id === id ? { ...x, open: false } : x))); },
  }), []);
  // never beyond the visual viewport: fewer visible toasts when the stack would not fit (the rest stay queued)
  const [fit, setFit] = React.useState(cap);
  const stackRef = React.useRef<HTMLElement | null>(null);
  // toasts paint above modal scrims: the stack is a non-modal top layer, re-promoted after every later lift
  React.useEffect(() => { const s = stackRef.current; return s ? keepOnTop(s) : undefined; }, []);
  React.useEffect(() => {
    const vv = window.visualViewport;
    const sync = () => { const s = stackRef.current; if (!s) return; const vb = vv ? innerHeight - (vv.offsetTop + vv.height) : 0; s.style.setProperty('--ul-vv-bottom', `${Math.max(0, vb).toFixed(1)}px`); s.style.setProperty('--ul-vv-top', `${(vv ? vv.offsetTop : 0).toFixed(1)}px`); setFit(cap); };
    sync(); vv?.addEventListener('resize', sync); vv?.addEventListener('scroll', sync); addEventListener('resize', sync);
    return () => { vv?.removeEventListener('resize', sync); vv?.removeEventListener('scroll', sync); removeEventListener('resize', sync); };
  }, [cap]);
  React.useLayoutEffect(() => {
    const s = stackRef.current; if (!s) return;
    const vv = window.visualViewport, top = vv ? vv.offsetTop : 0, bottom = vv ? vv.offsetTop + vv.height : innerHeight;
    const inset = parseFloat(getComputedStyle(s).getPropertyValue('--ul-toast-inset')) || 16, r = s.getBoundingClientRect();
    if ((r.top < top + inset || r.bottom > bottom - inset + 0.5) && fit > 1) setFit((f) => Math.max(1, f - 1));
  });
  const visible = list.filter((x) => x.open).slice(-Math.min(cap, fit)).map((x) => x.id);
  const shown = list.filter((x) => !x.open || visible.includes(x.id));
  const removed = (id: string) => setList((l) => l.filter((x) => x.id !== id));
  // Stack reflow (container motion, not a toast's enter / exit): FLIP the slots that moved on the smooth spring.
  const listRef = React.useRef<HTMLOListElement | null>(null);
  const rects = React.useRef(new Map<string, number>());
  React.useLayoutEffect(() => {
    const ol = listRef.current; if (!ol) return;
    const next = new Map<string, number>();
    ol.querySelectorAll<HTMLElement>('[data-toast-id]').forEach((li) => {
      const id = li.dataset.toastId!, top = li.getBoundingClientRect().top, old = rects.current.get(id);
      next.set(id, top);
      if (old != null && Math.abs(old - top) > 0.5 && !isMorphReduced()) li.animate([{ translate: `0 ${(old - top).toFixed(1)}px` }, { translate: '0 0' }], { duration: 420 * getMorphTimeScale(), easing: springs.smooth.toCSS() });
    });
    rects.current = next;
  });
  const stackEl = typeof document === 'undefined' ? null : createPortal(
    <section ref={stackRef as React.RefObject<HTMLElement>} className="ul-toast-stack" data-position={position} aria-label={label}
      onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false); }}>
      <span ref={origin} className="ul-toast-origin" data-ul-virtual-anchor="" aria-hidden="true"></span>
      <ol ref={listRef} className="ul-toast-list">
        {(position.startsWith('top') ? [...shown].reverse() : shown).map((t) => <StackToast key={t.id} t={t} origin={origin} paused={paused} dismissLabel={dismissLabel} onDismiss={() => api.dismiss(t.id)} onGone={() => removed(t.id)} />)}
      </ol>
      <div className="ul-sr-only" role="status" aria-live="polite">{live.polite}</div>
      <div className="ul-sr-only" role="alert" aria-live="assertive">{live.assertive}</div>
    </section>, document.body);
  return <ToastCtx.Provider value={api}>{children}{stackEl}</ToastCtx.Provider>;
}

function StackToast({ t, origin, paused, dismissLabel, onDismiss, onGone }: { t: ToastEntry; origin: React.RefObject<HTMLElement | null>; paused: boolean; dismissLabel: string; onDismiss: () => void; onGone: () => void }) {
  const own = React.useRef<HTMLElement | null>(null), morph = React.useRef<AnchoredMorph | null>(null), slot = React.useRef<HTMLLIElement | null>(null);
  const ms = t.duration ?? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ul-toast-duration')) || 5000);
  usePausableTimer(t.open, t.tone === 'danger' && t.duration == null ? Infinity : ms, paused, onDismiss);
  const swipe = useSwipe(own, morph, onDismiss);
  const goneRef = React.useRef(onGone); goneRef.current = onGone;
  React.useEffect(() => {
    if (t.open) return;
    const s = own.current; if (!s) { goneRef.current(); return; }
    const onM = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.phase === 'exit' && d.state === 'end') setTimeout(() => goneRef.current(), 0); };
    s.addEventListener('ul:morph', onM);
    return () => s.removeEventListener('ul:morph', onM);
  }, [t.open]);
  const pad = 'var(--ul-space-2) var(--ul-space-2) var(--ul-space-2) var(--ul-space-4)';
  return (
    <li ref={slot} className="ul-toast-slot" data-toast-id={t.id}>
      {/* in-flow sizer (not glass, inert): gives the slot the toast's final size so the morph's top-left is stable */}
      <div className="ul-toast-sizer" aria-hidden="true" {...({ inert: '' } as Record<string, string>)} style={{ padding: pad }}><ToastBody t={t} onDismiss={() => {}} dismissLabel={dismissLabel} /></div>
      <ULAnchoredSurface open={t.open} anchorRef={origin} manual portal={false} stack={false} closeOnOutside={false} onClose={onDismiss} scrollBehavior="fixed"
        role="group" aria-label={t.text} tier="lg" padding={pad} surfaceRef={own} morphRef={morph}
        className="ul-toast-surface" onPointerDown={swipe}>
        <ToastBody t={t} onDismiss={onDismiss} dismissLabel={dismissLabel} />
      </ULAnchoredSurface>
    </li>
  );
}
