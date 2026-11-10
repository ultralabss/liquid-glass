import * as React from 'react';
import { createPortal } from 'react-dom';
import { ULGlass, type GlassVariant , type ULGlassProps } from '../../glass/ULGlass.tsx';
import type { GlassTier } from '../../glass/engine.ts';
import type { Backdrop } from '../../glass/accent.tsx';
import type { Align, Side } from '../../motion/placement.ts';
import type { MorphOptions, AnchoredMorph } from '../../motion/anchoredMorph.ts';
import { useAnchoredMorph } from '../../hooks/useAnchoredMorph.ts';
import { pushOverlay, isTopOverlay, inLaterOverlay, trapFocus, overlayDepth } from '../../motion/overlayStack.ts';
import { prewarmGlass } from '../../glass/engine.ts';
import { toTopLayer } from '../../motion/topLayer.ts';
import './ULAnchoredSurface.css';

export interface ULAnchoredSurfaceProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Accent of the surface glass (forwarded to ULGlass through the rest props; omit to inherit the anchor's accent). */ accent?: ULGlassProps['accent'];
  /** subtle | tinted | vivid, or k 0..1 (forwarded to ULGlass). Omit to inherit. */ accentStrength?: ULGlassProps['accentStrength'];
  /** Controlled open state. */ open: boolean;
  /** Element the surface is anchored to (and morphs from). */ anchorRef: React.RefObject<HTMLElement | null>;
  /** Called on outside pointerdown and Escape (only while this is the top overlay). */
  onClose?: () => void;
  /** Preferred side: "top" | "bottom" | "left" | "right" (flips when there is no room). */ side?: Side;
  /** Alignment on the side: "start" | "center" | "end". */ align?: Align;
  /** Gap between anchor and surface in px. Default --ul-popover-offset. */ offset?: number;
  /** Glass size tier of the surface ("sm" | "md" | "lg" | "xl"). */ tier?: GlassTier;
  /** Glass variant ("regular" | "chrome" | "clear"). */ variant?: GlassVariant;
  /** Inner padding (px or CSS length). */ padding?: number | string;
  /** Corner radius (px or CSS length); list rows derive --ul-item-radius from it. */ radius?: number | string;
  /** Close on pointerdown outside surface and anchor. Default true. */ closeOnOutside?: boolean;
  /** Close on Escape (focus returns to the anchor). Default true. */ closeOnEscape?: boolean;
  /** Render at document.body so transformed / clipped ancestors cannot trap or crop it. Theme, accent and backdrop are copied from the anchor. Default true. */
  portal?: boolean;
  /** Contrast class for the overlay. Default inherits (from the anchor when portalled). */
  backdrop?: Backdrop;
  /** lock (default for role menu / listbox / dialog) | fixed (default for role status / alert: anchored toasts) | follow (default otherwise) | close. */
  scrollBehavior?: 'lock' | 'follow' | 'fixed' | 'close';
  /** Shorthand: scrollLock true = scrollBehavior "lock", false = "follow". */
  scrollLock?: boolean;
  /** Anchor fully out of view: keep (default) | hide | close (calls onClose). */
  onAnchorHidden?: 'keep' | 'hide' | 'close';
  /** Where the surface settles (anchored default; center / edges for modals, sheets, drawers). The morph still starts on the anchor. */
  layout?: MorphOptions['layout'];
  /** Owner lays the surface out itself (toast stack); the morph derives its side from geometry. */
  manual?: boolean;
  /** Soft graphite scrim under the surface (not glass); its opacity rides the morph. Click = outside. */
  scrim?: boolean;
  /** Modal: aria-modal, focus trap, initial focus, focus returns on close. */
  modal?: boolean;
  /** Initial focus inside a modal surface: element or selector. Default [data-autofocus] or the first focusable. */
  initialFocus?: HTMLElement | string | null;
  /** Element focus returns to on close. Default the element focused when it opened. */
  returnFocus?: HTMLElement | null;
  /** Ref to the glass surface element (tests, measurement). */
  surfaceRef?: React.MutableRefObject<HTMLElement | null>;
  /** Ref to the AnchoredMorph instance (owners that drag the settled surface call shiftFinal). */
  morphRef?: React.MutableRefObject<AnchoredMorph | null>;
  /** Join the overlay stack (Esc / outside / focus order). Default true; toasts pass false. */
  stack?: boolean;
  /** Hole that keeps the trigger on top while morphing. Default: auto (false when the trigger lives inside a dialog surface). */
  anchorOnTop?: boolean;
  /**
   * above (default for non-modal overlays): the trigger stays visible + clickable through the clip hole while morphing.
   * covered (default for modal / alertdialog: modal, sheet, drawer, command palette): surface + scrim go into the TOP LAYER
   * from the first frame (popover="manual"), so no trigger, sticky header, island or transformed ancestor can draw above them.
   */
  anchorVisibility?: 'above' | 'covered';
  /** Non-modal covered surfaces: place the surface over the anchor with this inset (px), so the anchor is under the surface in every frame. */
  overlapAnchor?: number;
  /** Small pointer toward the anchor (popover). Flat (tint + rim), never a second glass layer; hidden while morphing. */
  arrow?: boolean;
  /** Surface content (embedded variants inside: no own glass). */ children?: React.ReactNode;
}

let topLayerCount = 0;
const topLayerOpen = () => topLayerCount;

/** Theme / accent / backdrop of the anchor, so a portalled overlay looks like it never left. */
function scopeOf(anchor: HTMLElement | null): Record<string, unknown> {
  if (!anchor || typeof getComputedStyle === 'undefined') return {};
  const out: Record<string, unknown> = { className: 'ul-portal' };
  const th = anchor.closest('[data-ul-theme]'); if (th) out['data-ul-theme'] = th.getAttribute('data-ul-theme');
  const bd = anchor.closest('[data-ul-backdrop]'); if (bd) out['data-ul-backdrop'] = bd.getAttribute('data-ul-backdrop');
  const rt = anchor.closest('[data-ul-reduce-transparency]'); if (rt) out['data-ul-reduce-transparency'] = rt.getAttribute('data-ul-reduce-transparency');
  if (anchor.closest('[data-ul-accent]')) {
    const cs = getComputedStyle(anchor);
    out['data-ul-accent'] = 'custom';
    out['data-ul-accent-strength'] = 'custom';
    out.style = { display: 'contents', '--ul-accent': cs.getPropertyValue('--ul-accent').trim(), '--ul-accent-level': cs.getPropertyValue('--ul-accent-k').trim() };
  } else out.style = { display: 'contents' };
  return out;
}

/**
 * Base for every anchored overlay: one glass layer pinned to an anchor with
 * collision-aware placement and the shared elastic morph. Menus, popovers,
 * selects, tooltips, pickers, modals, drawers, toasts and the command palette
 * compose this; none implement their own motion, scrolling or stacking.
 */
export function ULAnchoredSurface({
  open, anchorRef, onClose, side = 'bottom', align = 'center', offset, tier = 'lg', variant = 'clear',
  padding = 'var(--ul-space-2)', radius, closeOnOutside = true, closeOnEscape = true, portal = true, backdrop, scrollBehavior, scrollLock, onAnchorHidden = 'keep',
  layout, manual, scrim = false, modal = false, initialFocus, returnFocus, surfaceRef: outerRef, morphRef, stack = true, arrow = false, anchorOnTop, anchorVisibility, overlapAnchor, className, children, ...rest
}: ULAnchoredSurfaceProps) {
  const role = (rest as { role?: string }).role;
  const covered = (anchorVisibility ?? (modal || role === 'alertdialog' ? 'covered' : 'above')) === 'covered';
  const sb = scrollBehavior ?? (scrollLock === true ? 'lock' : scrollLock === false ? 'follow' : modal || role === 'menu' || role === 'listbox' || role === 'dialog' || role === 'alertdialog' ? 'lock' : role === 'status' || role === 'alert' ? 'fixed' : 'follow'); // anchored toast (status / alert) = fixed
  const scrimRef = React.useRef<HTMLDivElement | null>(null);
  const m = useAnchoredMorph({ open, anchorRef, side, align, offset: offset == null ? undefined : Number(offset), scrollBehavior: sb, onAnchorHidden, onRequestClose: onClose, layout, manual, scrimRef,
    anchorOnTop: covered ? false : anchorOnTop ?? !anchorRef.current?.closest?.('.ul-anchored[role="dialog"], .ul-anchored[role="alertdialog"], .ul-anchored[aria-modal="true"]'), coverAnchor: covered, overlap: covered ? overlapAnchor : undefined });
  // top layer: covered surfaces, and anything opened while a top-layer surface is open (a select inside a modal must stay above it)
  const promote = React.useRef<boolean | null>(null);
  if (m.mounted && promote.current === null) promote.current = (covered || topLayerOpen() > 0) && !(manual && stack === false); // toasts inside the stack ride with the stack's own top-layer entry
  if (!m.mounted) promote.current = null;
  const lift = (n: HTMLElement | null) => { if (n && promote.current) toTopLayer(n); };
  const setSurface = React.useCallback((n: HTMLElement | null) => { (m.surfaceRef as React.MutableRefObject<HTMLElement | null>).current = n; lift(n); }, []);
  const setScrim = React.useCallback((n: HTMLDivElement | null) => { scrimRef.current = n; lift(n); }, []);
  const setGoo = React.useCallback((n: HTMLDivElement | null) => { (m.gooRef as React.MutableRefObject<HTMLElement | null>).current = n; lift(n); }, []);
  React.useEffect(() => { if (!m.mounted || !promote.current) return; topLayerCount++; return () => { topLayerCount--; }; }, [m.mounted]);
  // every open (cold, warm, reopened mid-close) re-asserts scrim → goo → surface in the top layer, same commit, before paint
  React.useLayoutEffect(() => {
    if (!open || !m.mounted || !promote.current) return;
    lift(scrimRef.current); lift(m.gooRef.current); lift(m.surfaceRef.current);
  }, [open, m.mounted]);
  // cold start: warm the filter pool / defs on idle and when the user approaches the trigger
  React.useEffect(() => {
    if (!covered) return;
    const a = anchorRef.current, warm = () => prewarmGlass();
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback;
    if (ric) ric(warm); else setTimeout(warm, 200);
    if (!a) return;
    a.addEventListener('pointerenter', warm); a.addEventListener('focus', warm); a.addEventListener('pointerdown', warm);
    return () => { a.removeEventListener('pointerenter', warm); a.removeEventListener('focus', warm); a.removeEventListener('pointerdown', warm); };
  }, [covered, anchorRef.current]);
  const closeRef = React.useRef(onClose); closeRef.current = onClose;
  // content is frozen during the exit: owners often clear their data when they close (row actions → items []), which
  // would collapse the surface to its padding while it morphs back
  const kids = React.useRef(children); if (open) kids.current = children;
  const content = open ? children : kids.current;
  if (outerRef) outerRef.current = m.surfaceRef.current;
  if (morphRef) morphRef.current = m.morphRef.current;
  // stacking: each overlay opened while others are open sits one layer higher (scrim, goo, surface move together)
  const depthRef = React.useRef(0), wasOpen = React.useRef(false);
  if (open && !wasOpen.current) depthRef.current = overlayDepth();
  wasOpen.current = open;

  React.useEffect(() => {
    const el = m.surfaceRef.current;
    if (outerRef) outerRef.current = el;
    if (morphRef) morphRef.current = m.morphRef.current;
    if (!open || !el) return;
    const pop = stack ? pushOverlay(el, [scrimRef.current], modal) : () => {};
    const release = modal ? trapFocus(el, { initial: initialFocus, returnTo: returnFocus ?? null }) : null;
    const down = (e: PointerEvent) => {
      if (!closeOnOutside || !closeRef.current) return;
      const t = e.target as Node;
      if (el.contains(t) || anchorRef.current?.contains(t) || inLaterOverlay(el, t)) return;
      closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (!closeEscRef.current || e.key !== 'Escape' || !(stack ? isTopOverlay(el) : el.contains(document.activeElement))) return;
      e.preventDefault();
      closeRef.current?.();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => { pop(); release?.(); document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); };
  }, [open, m.mounted, closeOnOutside, modal]);
  const closeEscRef = React.useRef(closeOnEscape); closeEscRef.current = closeOnEscape;

  if (!m.mounted) return null;
  const tree = (
    <>
      {scrim ? <div ref={setScrim} className="ul-scrim" aria-hidden="true" style={{ opacity: 0 }}></div> : null}
      <div ref={setGoo} className="ul-morph-goo" aria-hidden="true"><span></span><span></span><span></span></div>
      <ULGlass
        ref={setSurface}
        materialCategory="overlays"
        data-ul-covered-anchor={covered ? '' : undefined}
        {...rest}
        aria-modal={modal ? true : (rest as { 'aria-modal'?: boolean })['aria-modal']}
        tier={tier}
        variant={variant}
        backdrop={backdrop}
        padding={padding}
        radius={radius}
        priority="overlay"
        data-ul-anchored=""
        data-layout={layout ?? 'anchored'}
        className={className ? `ul-anchored ${className}` : 'ul-anchored'}
      >
        <div ref={m.stageRef as React.RefObject<HTMLDivElement>} className="ul-morph-stage">
          <div className="ul-morph-content">{content}</div>
        </div>
        {arrow ? <span className="ul-pop-arrow" aria-hidden="true"></span> : null}
      </ULGlass>
    </>
  );
  if (!portal || typeof document === 'undefined') return <div style={{ display: 'contents', '--ul-depth': depthRef.current } as React.CSSProperties}>{tree}</div>;
  const sc = scopeOf(anchorRef.current) as { style?: Record<string, unknown> };
  sc.style = { ...(sc.style ?? { display: 'contents' }), '--ul-depth': depthRef.current };
  return createPortal(<div {...(sc as React.HTMLAttributes<HTMLDivElement>)}>{tree}</div>, document.body);
}
