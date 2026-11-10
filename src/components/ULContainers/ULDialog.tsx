import * as React from 'react';
import { ULAnchoredSurface } from '../ULAnchoredSurface/ULAnchoredSurface.tsx';
import type { AnchoredMorph } from '../../motion/anchoredMorph.ts';
import { isMorphReduced, getMorphTimeScale, overshootEase } from '../../motion/anchoredMorph.ts';
import { isTopOverlay } from '../../motion/overlayStack.ts';
import { runViewSwap, newSwapAnims, type SwapAnims } from '../../motion/viewSwap.ts';
import { createVirtualAnchor, centerRect, edgeRect, type Edge } from '../../motion/virtualAnchor.ts';
import { useMediaQuery } from '../../hooks/useReducedMotion.ts';
import { rubberBand } from '../../motion/lensBubble.ts';
import type { Accent, AccentStrength, Backdrop } from '../../glass/accent.tsx';
import { Icon, cx, useDomId } from '../shared/icons.tsx';
import './ULContainers.css';

/* =====================================================================
 * Dialog context: ONE surface per dialog. push / replace / pop swap the view INSIDE that surface: the persistent
 * nav bar (back · title · close) stays; the old view's content slides + fades out, the surface morphs width / height /
 * radius to the new view's MEASURED size on the dialog spring, the new view's blocks slide + fade in (staggered) once
 * the size change is ~60 % done. Every view stays mounted while it is in the stack (form state survives), its
 * scroll position is restored on pop. Esc = back (depth > 1) or close. Opening a dialog from inside a dialog never
 * stacks a second surface: use push. The root dialog still opens from its trigger (anchored morph).
 * ===================================================================== */
export interface DialogView {
  key: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** sm 400 · md 520 · lg 680 · auto (intrinsic, max lg). */
  size?: 'sm' | 'md' | 'lg' | 'auto';
  content?: React.ReactNode;
  footer?: React.ReactNode;
  /** Dirty guard: return false (or a promise of false) to keep the view when back / close / replace is requested. */
  canLeave?: () => boolean | Promise<boolean>;
}
export interface DialogApi {
  push(v: DialogView): void;
  replace(v: DialogView): void;
  pop(): void;
  close(): void;
  depth: number;
  /** Outside a dialog (ULDialogProvider): open a root dialog from a trigger. */
  open?(v: DialogView, o?: { triggerRef?: React.RefObject<HTMLElement | null>; sheet?: 'auto' | 'always' | 'never' }): void;
}
const Ctx = React.createContext<DialogApi | null>(null);
const ProviderCtx = React.createContext<DialogApi | null>(null);
/** Inside a dialog: push / replace / pop / close. Outside (under ULDialogProvider): open(). */
export const useDialog = (): DialogApi => { const c = React.useContext(Ctx) ?? React.useContext(ProviderCtx); if (!c) throw new Error('useDialog needs a dialog or <ULDialogProvider>'); return c; };

const ms = (el: Element, k: string, f: number) => (parseFloat(getComputedStyle(el).getPropertyValue(k)) || f) * getMorphTimeScale();
const num = (el: Element, k: string, f: number) => { const v = parseFloat(getComputedStyle(el).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };

interface Entry { v: DialogView; opener: HTMLElement | null; scroll: number }

/**
 * Mobile bottom sheet only: drag to dismiss on the grabber and the nav bar (never on the scrolling content, so content
 * scroll always wins). Starts after 6px of mostly vertical travel (a tap on a nav button stays a click). Upward = rubber
 * band. Release: dismiss when the drag, projected by the release velocity over --ul-lens-flick, passes --ul-sheet-dismiss;
 * otherwise springs back on the shared overshoot spring. Esc / close button unchanged.
 */
function useSheetDrag(enabled: boolean, surface: React.MutableRefObject<HTMLElement | null>, morph: React.MutableRefObject<AnchoredMorph | null>, close: () => Promise<boolean | void> | void) {
  return React.useCallback((e: React.PointerEvent) => {
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const s = surface.current; if (!s || s.hasAttribute('data-ul-morphing')) return;
    const target = e.currentTarget as HTMLElement, x0 = e.clientX, y0 = e.clientY, id = e.pointerId;
    let dy = 0, lastY = y0, lastT = performance.now(), v = 0, dragging = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const raw = ev.clientY - y0;
      if (!dragging) {
        if (Math.abs(raw) < 6 || Math.abs(raw) < Math.abs(ev.clientX - x0)) return;
        dragging = true; target.setPointerCapture(id); s.setAttribute('data-ul-dragging', '');
      }
      ev.preventDefault();
      dy = raw >= 0 ? raw : rubberBand(raw, 0, 0, num(s, '--ul-lens-rubber', 0.55), 60);
      const now = performance.now(), dt = Math.max(1, now - lastT); v = 0.6 * v + 0.4 * ((ev.clientY - lastY) / dt); lastY = ev.clientY; lastT = now;
      s.style.translate = `0 ${dy.toFixed(1)}px`;
    };
    const end = async (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', end); target.removeEventListener('pointercancel', end);
      if (!dragging) return;
      s.removeAttribute('data-ul-dragging');
      const swallow = (ce: Event) => { ce.stopPropagation(); ce.preventDefault(); }; // no click after a drag
      target.addEventListener('click', swallow, { capture: true, once: true }); setTimeout(() => target.removeEventListener('click', swallow, { capture: true }), 0);
      if (performance.now() - lastT > 80) v = 0; // held still before release
      const thr = num(s, '--ul-sheet-dismiss', 96), proj = dy + Math.max(0, v) * num(s, '--ul-lens-flick', 140);
      if (ev.type === 'pointerup' && dy > 0 && (proj > thr || (v > 0.6 && dy > 16))) {
        s.style.translate = ''; morph.current?.shiftFinal(0, dy);
        const r = await close(); if (r !== false) return;
        morph.current?.shiftFinal(0, -dy); s.style.translate = `0 ${dy}px`; // dirty guard refused: spring back from where it is
      }
      const from = dy; s.style.translate = '';
      if (!isMorphReduced() && Math.abs(from) > 0.5) s.animate([{ translate: `0 ${from}px` }, { translate: '0 0' }], { duration: ms(s, '--ul-dialog-morph-duration', 480) * 0.8, easing: overshootEase() });
    };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end);
  }, [enabled]);
}

export interface DialogSurfaceProps {
  /** Controlled open state. */ open: boolean;
  /** Called with the next open state (trigger, Esc, outside click, close button). */ onOpenChange?: (o: boolean) => void;
  /** Trigger element: the surface morphs from it and focus returns to it on close. */ triggerRef?: React.RefObject<HTMLElement | null>;
  /** First view of the dialog stack; push / replace views with useDialog() (same surface morphs). */ root: DialogView;
  /** auto: bottom sheet ≤ 640px · always · never. */
  sheet?: 'auto' | 'always' | 'never';
  /** Drawer: pinned to an edge, grows in from it. */
  edge?: 'left' | 'right';
  /** "dialog" (default) | "alertdialog". */ role?: 'dialog' | 'alertdialog';
  /** Close when the scrim is clicked. Default true (false for role="alertdialog"). */ closeOnScrim?: boolean;
  /** Accessible label of the close button. Default localised "Close". */ closeLabel?: string;
  /** Accessible label of the back button on pushed views. Default localised "Back". */ backLabel?: string;
  /** Element (or selector) focused on open; null = the surface itself. Default: first focusable. */ initialFocus?: HTMLElement | string | null;
  /** Accent colour: accent name ("violet", "ice", "emerald", "amber", "rose") or a CSS colour (checked by guardAccent). */ accent?: Accent;
  /** "subtle" | "tinted" | "vivid" accent intensity of the glass. */ accentStrength?: AccentStrength;
  /** Backdrop hint for the glass: "dark" | "mid" | "light". */ backdrop?: Backdrop;
  /** Extra class on the root element. */ className?: string;
  /** @internal tests */
  surfaceRef?: React.MutableRefObject<HTMLElement | null>;
  /** @internal tests: the live api */
  apiRef?: React.MutableRefObject<DialogApi | null>;
}

/** The one dialog surface: modal, sheet and drawer all render through this. */
export function ULDialogSurface({ open, onOpenChange, triggerRef, root, sheet = 'auto', edge, role = 'dialog', closeOnScrim, closeLabel = 'Close', backLabel = 'Back', initialFocus, accent, accentStrength, backdrop, className, surfaceRef, apiRef }: DialogSurfaceProps) {
  const mobile = useMediaQuery('(max-width: 640px)');
  const asSheet = sheet === 'always' || (sheet === 'auto' && mobile);
  const layoutEdge: Edge | null = asSheet ? 'bottom' : edge ?? null;
  // anchor: the trigger, or a virtual one (edge strip for drawers / sheets without trigger, centre capsule)
  const hasTrigger = !!triggerRef?.current && !edge;
  const vRef = React.useRef<HTMLElement | null>(null), va = React.useRef<ReturnType<typeof createVirtualAnchor> | null>(null), wasOpen = React.useRef(false);
  if (typeof document !== 'undefined' && open && !hasTrigger) {
    const rect = layoutEdge ? edgeRect(layoutEdge) : centerRect();
    if (!va.current) { va.current = createVirtualAnchor(rect); vRef.current = va.current.el; } else if (!wasOpen.current) va.current.set(rect);
  }
  wasOpen.current = open;
  React.useEffect(() => () => va.current?.destroy(), []);
  const id = useDomId('ul-dlg');
  const own = React.useRef<HTMLElement | null>(null), morph = React.useRef<AnchoredMorph | null>(null);
  const sref = React.useMemo(() => ({ get current() { return own.current; }, set current(v: HTMLElement | null) { own.current = v; if (surfaceRef) surfaceRef.current = v; } }), [surfaceRef]) as React.MutableRefObject<HTMLElement | null>;
  const [stack, setStack] = React.useState<Entry[]>([{ v: root, opener: null, scroll: 0 }]);
  const [active, setActive] = React.useState(root.key); // view whose content is shown (lags the stack during a swap)
  const [leaving, setLeaving] = React.useState<string | null>(null);
  const stackRef = React.useRef(stack); stackRef.current = stack;
  // reset to the root view whenever the dialog (re)opens
  React.useLayoutEffect(() => { if (open) { setStack([{ v: root, opener: null, scroll: 0 }]); setActive(root.key); setLeaving(null); } }, [open]);
  React.useEffect(() => { if (!open) return; setStack((s) => s.map((e) => (e.v.key === root.key ? { ...e, v: root } : e))); }, [root]);
  const top = stack[stack.length - 1];
  const viewEls = React.useRef(new Map<string, HTMLElement>());
  const anims = React.useRef<SwapAnims>(newSwapAnims());
  const swapDir = React.useRef<1 | -1>(1);

  /** The surface morph + content choreography from the active view to `to`. */
  const swap = React.useCallback((to: string, dir: 1 | -1) => {
    const s = own.current, from = active;
    swapDir.current = dir;
    if (!s || from === to) { setActive(to); return; }
    setLeaving(from); setActive(to);
  }, [active]);

  React.useLayoutEffect(() => {
    const s = own.current; if (!s || !leaving) return;
    const A = anims.current, dir = swapDir.current;
    const X = viewEls.current.get(leaving), Y = viewEls.current.get(active);
    if (!Y) { setLeaving(null); return; }
    // interrupted swap: anything that is neither the leaving nor the entering view is gone at once
    viewEls.current.forEach((el, k) => { if (k !== leaving && k !== active) { el.getAnimations({ subtree: true }).forEach((a) => a.cancel()); el.hidden = true; el.style.cssText = ''; } });
    runViewSwap({ surface: s, from: X, to: Y, dir, morph: morph.current, anims: A as unknown as SwapAnims,
      prepare: () => s.setAttribute('data-size', stackRef.current.find((e) => e.v.key === active)?.v.size ?? 'md'),
      onDone: () => setLeaving(null) });
    // focus: Y's heading (or first focusable) after the swap; pop restores the opener
    requestAnimationFrame(() => {
      const ent = stackRef.current.find((e) => e.v.key === active);
      if (dir < 0 && restoreFocus.current) { restoreFocus.current.focus({ preventScroll: true }); restoreFocus.current = null; return; }
      (Y.querySelector<HTMLElement>('[data-autofocus]') ?? (s.querySelector(`#${id}-title`) as HTMLElement | null))?.focus({ preventScroll: true });
      void ent;
    });
  }, [leaving, active]);

  // X leaves the DOM order after the swap (stays mounted, hidden) + restore its scroll on return
  React.useLayoutEffect(() => {
    if (leaving) return;
    viewEls.current.forEach((el, k) => {
      if (k === active) { el.hidden = false; el.style.cssText = ''; const e = stackRef.current.find((x) => x.v.key === k); const body = el.querySelector<HTMLElement>('.ul-modal-body'); if (e && body && e.scroll) body.scrollTop = e.scroll; }
      else { el.hidden = true; el.style.cssText = ''; }
    });
    const A = anims.current; A.out.forEach((a) => a.cancel()); A.out = [];
  }, [leaving, active]);

  // async content: the active view grows / shrinks later → animate the height, never jump
  React.useEffect(() => {
    const s = own.current, Y = viewEls.current.get(active); if (!s || !Y || leaving) return;
    let h0 = s.offsetHeight;
    const ro = new ResizeObserver(() => {
      if (s.hasAttribute('data-ul-morphing')) return;
      const h1 = s.offsetHeight; if (Math.abs(h1 - h0) < 1) return;
      const m = morph.current, fin = m ? m.finalFor(s.offsetWidth, h1) : null, from = s.getBoundingClientRect();
      if (fin && !isMorphReduced()) {
        s.animate([{ top: `${from.top + (h1 - h0) * 0}px`, height: `${h0}px` }, { top: `${fin.T}px`, height: `${h1}px` }], { duration: ms(s, '--ul-dialog-morph-duration', 480) * 0.7, easing: overshootEase(0.02) });
      }
      if (fin) m?.setFinalRect(fin.L, fin.T, s.offsetWidth, h1);
      h0 = h1;
    });
    ro.observe(Y);
    return () => ro.disconnect();
  }, [active, leaving]);

  const restoreFocus = React.useRef<HTMLElement | null>(null);
  const close = React.useCallback(async (): Promise<boolean> => {
    for (const e of [...stackRef.current].reverse()) if (e.v.canLeave && !(await e.v.canLeave())) return false;
    onOpenChange?.(false);
    return true;
  }, [onOpenChange]);
  const onDrag = useSheetDrag(asSheet && mobile, own, morph, close);
  const saveScroll = () => { const cur = viewEls.current.get(active)?.querySelector<HTMLElement>('.ul-modal-body'); const st = stackRef.current; if (cur && st.length) st[st.length - 1].scroll = cur.scrollTop; };
  const api = React.useMemo<DialogApi>(() => ({
    depth: stack.length,
    push: (v) => { saveScroll(); const opener = document.activeElement as HTMLElement | null; setStack((s) => [...s, { v, opener, scroll: 0 }]); swap(v.key, 1); },
    replace: async (v) => { const t = stackRef.current[stackRef.current.length - 1]; if (t?.v.canLeave && !(await t.v.canLeave())) return; setStack((s) => [...s.slice(0, -1), { v, opener: s[s.length - 1]?.opener ?? null, scroll: 0 }]); swap(v.key, 1); },
    pop: async () => {
      const s = stackRef.current; if (s.length < 2) { close(); return; }
      const t = s[s.length - 1]; if (t.v.canLeave && !(await t.v.canLeave())) return;
      restoreFocus.current = t.opener;
      const prev = s[s.length - 2];
      setStack(s.slice(0, -1)); swap(prev.v.key, -1);
    },
    close,
  }), [stack.length, swap, close, active]);
  if (apiRef) apiRef.current = api;

  // Esc: back when depth > 1, close at the root (only while this is the top overlay)
  React.useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key !== 'Escape' || !isTopOverlay(own.current)) return; e.preventDefault(); if (stackRef.current.length > 1) api.pop(); else api.close(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, api]);

  const anchor = hasTrigger ? triggerRef! : vRef;
  const depth = stack.length;
  const activeEntry = stack.find((e) => e.v.key === active) ?? top;
  // views to render: everything in the stack + a view that just left (popped / replaced) until its exit ends
  const lastRendered = React.useRef<Map<string, DialogView>>(new Map());
  stack.forEach((e) => lastRendered.current.set(e.v.key, e.v));
  const lv = leaving ? lastRendered.current.get(leaving) : undefined;
  const leavingEntry = lv ? { v: lv } : null; // popped views are no longer in the stack but still on screen until the swap ends
  const keys = [...lastRendered.current.keys()].filter((k) => stack.some((e) => e.v.key === k) || k === leaving);
  React.useEffect(() => { if (!leaving) for (const k of [...lastRendered.current.keys()]) if (!stack.some((e) => e.v.key === k)) lastRendered.current.delete(k); }, [leaving, stack]);
  return (
    <Ctx.Provider value={api}>
      <ULAnchoredSurface
        open={open} anchorRef={anchor} onClose={close} closeOnEscape={false} role={role} modal scrim
        layout={layoutEdge ?? 'center'} offset={layoutEdge ? 8 : undefined}
        closeOnOutside={closeOnScrim ?? role !== 'alertdialog'}
        aria-labelledby={`${id}-title`} tier="xl" padding="0" initialFocus={initialFocus} returnFocus={hasTrigger ? triggerRef!.current : null}
        accent={accent} accentStrength={accentStrength} backdrop={backdrop ?? (activeEntry.v.size === 'lg' ? 'light' : undefined)}
        surfaceRef={sref} morphRef={morph}
        className={cx(edge ? 'ul-drawer-surface' : 'ul-modal-surface', 'ul-dialog', className)} data-size={(leavingEntry ?? activeEntry).v.size ?? 'md'} data-sheet={asSheet ? '' : undefined} data-side-edge={edge}
      >
        <div className="ul-modal ul-dialog-frame">
          {asSheet ? <div className="ul-sheet-grabber" aria-hidden="true" onPointerDown={onDrag}><span></span></div> : null}
          {/* persistent nav bar: never part of the swapping content */}
          <div className="ul-dialog-nav" onPointerDown={onDrag} data-drag={asSheet && mobile ? '' : undefined}>
            <button type="button" className="ul-dialog-navbtn" data-show={depth > 1 ? '' : undefined} aria-hidden={depth > 1 ? undefined : true} tabIndex={depth > 1 ? 0 : -1} aria-label={backLabel} onClick={() => api.pop()}><Icon name="chevron-left" /></button>
            <div className="ul-dialog-titles">
              {leavingEntry ? <span key={'o' + leavingEntry.v.key} className="ul-dialog-title" data-out="" aria-hidden="true">{leavingEntry.v.title}</span> : null}
              <h2 key={'t' + activeEntry.v.key} id={`${id}-title`} tabIndex={-1} className="ul-dialog-title" data-in={leaving ? '' : undefined}>{activeEntry.v.title}</h2>
            </div>
            <button type="button" className="ul-dialog-navbtn" aria-label={closeLabel} onClick={() => api.close()}><Icon name="x" /></button>
          </div>
          <div className="ul-dialog-views">
            {keys.map((k) => {
              const v = lastRendered.current.get(k)!;
              return (
                <section key={k} ref={(n) => { if (n) viewEls.current.set(k, n); else viewEls.current.delete(k); }} className="ul-dialog-view" data-view={k}
                  hidden={leaving ? k !== leaving : k !== active} aria-hidden={k !== active || undefined} {...(k !== active ? ({ inert: '' } as Record<string, string>) : {})}>
                  {v.description ? <p className="ul-card-desc ul-dialog-desc">{v.description}</p> : null}
                  <div className="ul-modal-body">{v.content}</div>
                  {v.footer ? <footer className="ul-modal-foot">{v.footer}</footer> : null}
                </section>
              );
            })}
          </div>
        </div>
      </ULAnchoredSurface>
    </Ctx.Provider>
  );
}

/** App-level provider: useDialog().open(view, { triggerRef }) from anywhere; push / pop inside. */
export function ULDialogProvider({ children }: { children?: React.ReactNode }) {
  const [st, setSt] = React.useState<{ open: boolean; v: DialogView | null; trig?: React.RefObject<HTMLElement | null>; sheet?: 'auto' | 'always' | 'never' }>({ open: false, v: null });
  const inner = React.useRef<DialogApi | null>(null);
  const api = React.useMemo<DialogApi>(() => ({
    depth: 0,
    open: (v, o) => setSt({ open: true, v, trig: o?.triggerRef, sheet: o?.sheet }),
    push: (v) => inner.current ? inner.current.push(v) : setSt({ open: true, v }),
    replace: (v) => inner.current?.replace(v), pop: () => inner.current?.pop(), close: () => setSt((s) => ({ ...s, open: false })),
  }), []);
  return (
    <ProviderCtx.Provider value={api}>
      {children}
      {st.v ? <ULDialogSurface open={st.open} onOpenChange={(o) => setSt((s) => ({ ...s, open: o }))} triggerRef={st.trig} root={st.v} sheet={st.sheet} apiRef={inner} /> : null}
    </ProviderCtx.Provider>
  );
}
