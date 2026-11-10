import * as React from 'react';
import { cx } from '../shared/icons.tsx';
import { ULPopover } from '../ULContainers/ULOverlays.tsx';
import { withContextMenu, type ContextMenuProps } from '../ULContainers/contextTarget.tsx';
import type { Side, Align } from '../../motion/placement.ts';
import './batch2.css';

const tokMs = (k: string, f: number) => { if (typeof document === 'undefined') return f; const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
/** One open card per group: opening a card closes the group's current one at once (no exit delay). */
const groups = new Map<string, () => void>();
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export interface ULHoverCardProps extends ContextMenuProps<{ /** Hover cards in the same group hand over without the open delay. */ group: string }> {
  /** The trigger (a link, button or avatar). It keeps its own role; the card is supplementary. */
  children: React.ReactElement;
  /** Card content: avatar, text, ULKeyValue, buttons. Never the only place where information lives. */
  content: React.ReactNode;
  side?: Side; align?: Align; arrow?: boolean;
  /** Accessible name of the card (role dialog, non-modal). */
  label?: string;
  /** Hover-intent delays in ms. Default --ul-hovercard-open-delay (500) / --ul-hovercard-close-delay (250). */
  openDelay?: number; closeDelay?: number;
  /** One card open at a time per group. Default "default". */
  group?: string;
  open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void;
  /** Content components inside the card render their embedded variant (no own card / glass); the card is the one glass surface. Default true. */
  embedded?: boolean;
  disabled?: boolean;
  className?: string;
  /** @internal tests */
  surfaceRef?: React.MutableRefObject<HTMLElement | null>;
}

/**
 * Hover card on the existing ULPopover (anchored morph, anchorVisibility 'above', scroll follow).
 * Pointer: opens after openDelay over the trigger, closes closeDelay after the pointer left both the trigger and the card;
 * an invisible bridge inside the surface covers the --ul-pop-offset gap (same technique as the submenu bridge).
 * Keyboard: opens after openDelay on focus-visible; Tab from the trigger moves into the card when it has controls;
 * stays open while focus is inside; Esc closes and returns focus to the trigger.
 * Touch: first tap opens (the tap's default action is suppressed), a second tap or an outside tap closes.
 */
export function ULHoverCard(props: ULHoverCardProps) {
  const { children, content, side = 'bottom', align = 'center', arrow = false, label, openDelay, closeDelay, group = 'default', open, defaultOpen = false, onOpenChange, embedded = true, disabled, className, surfaceRef, ...ctx } = props;
  const [own, setOwn] = React.useState(defaultOpen); const isOpen = !disabled && (open ?? own);
  const trig = React.useRef<HTMLElement | null>(null), surf = React.useRef<HTMLElement | null>(null);
  const sref = React.useMemo(() => ({ get current() { return surf.current; }, set current(v: HTMLElement | null) { surf.current = v; if (surfaceRef) surfaceRef.current = v; } }), [surfaceRef]) as React.MutableRefObject<HTMLElement | null>;
  const timer = React.useRef(0), pType = React.useRef('mouse'), openRef = React.useRef(isOpen); openRef.current = isOpen;
  const setOpen = React.useCallback((v: boolean) => {
    clearTimeout(timer.current);
    if (v === openRef.current) return;
    if (v) { const prev = groups.get(group); if (prev && prev !== closeNow) prev(); groups.set(group, closeNow); }
    else if (groups.get(group) === closeNow) groups.delete(group);
    if (open === undefined) setOwn(v); onOpenChange?.(v);
  }, [open, onOpenChange, group]);
  const setRef = React.useRef(setOpen); setRef.current = setOpen;
  const closeNow = React.useMemo(() => () => setRef.current(false), []);
  const later = (v: boolean) => { clearTimeout(timer.current); timer.current = window.setTimeout(() => setRef.current(v), v ? openDelay ?? tokMs('--ul-hovercard-open-delay', 500) : closeDelay ?? tokMs('--ul-hovercard-close-delay', 250)); };
  React.useEffect(() => () => { clearTimeout(timer.current); if (groups.get(group) === closeNow) groups.delete(group); }, []);
  const inside = (n: EventTarget | null) => !!n && n instanceof Node && (!!trig.current?.contains(n) || !!surf.current?.contains(n));
  // while open: pointer / focus leaving both trigger and card schedules the close; coming back cancels it
  React.useEffect(() => {
    if (!isOpen) return;
    const over = (e: PointerEvent) => { if (e.pointerType === 'touch') return; if (inside(e.target)) { clearTimeout(timer.current); } else if (!inside(document.activeElement)) later(false); };
    const fin = (e: FocusEvent) => { if (inside(e.target)) clearTimeout(timer.current); else later(false); };
    document.addEventListener('pointerover', over); document.addEventListener('focusin', fin);
    return () => { document.removeEventListener('pointerover', over); document.removeEventListener('focusin', fin); };
  }, [isOpen]);
  const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
  const call = (k: string, e: unknown) => (child.props[k] as ((e: unknown) => void) | undefined)?.(e);
  const trigger = React.cloneElement(child, {
    ref: (el: HTMLElement | null) => { trig.current = el; const r = (child as unknown as { ref?: unknown }).ref; if (typeof r === 'function') r(el); else if (r && typeof r === 'object') (r as React.MutableRefObject<HTMLElement | null>).current = el; },
    'data-ul-hovercard-trigger': '',
    onPointerDown: (e: React.PointerEvent) => { pType.current = e.pointerType; call('onPointerDown', e); },
    onPointerEnter: (e: React.PointerEvent) => { pType.current = e.pointerType; if (e.pointerType !== 'touch' && !disabled) { if (openRef.current) clearTimeout(timer.current); else later(true); } call('onPointerEnter', e); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType !== 'touch' && !openRef.current) clearTimeout(timer.current); call('onPointerLeave', e); },
    onFocus: (e: React.FocusEvent<HTMLElement>) => { let fv = false; try { fv = e.currentTarget.matches(':focus-visible'); } catch { fv = false; } if (fv && !disabled && !openRef.current) later(true); call('onFocus', e); },
    onBlur: (e: React.FocusEvent) => { if (!openRef.current && !inside(e.relatedTarget)) clearTimeout(timer.current); call('onBlur', e); },
    onClick: (e: React.MouseEvent) => { if (pType.current === 'touch' && !disabled) { e.preventDefault(); setRef.current(!openRef.current); pType.current = 'mouse'; } call('onClick', e); },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && openRef.current) { e.preventDefault(); e.stopPropagation(); setRef.current(false); }
      else if (e.key === 'Tab' && !e.shiftKey && openRef.current) { const f = surf.current?.querySelector<HTMLElement>(FOCUSABLE); if (f) { e.preventDefault(); f.focus({ preventScroll: true }); } }
      call('onKeyDown', e);
    },
  });
  const withCtx = withContextMenu(trigger, { ...ctx, onContextMenuOpen: (t) => { setRef.current(false); ctx.onContextMenuOpen?.(t); } }, 'hovercard', { kind: 'trigger', data: { group } });
  return (
    <>
      {withCtx}
      <ULPopover open={isOpen} onOpenChange={(v) => setOpen(v)} triggerRef={trig} side={side} align={align} arrow={arrow} label={label} autoFocus={false}
        anchorVisibility="above" surfaceRef={sref} className={cx('ul-hovercard', className)}>
        <span className="ul-hc-bridge" aria-hidden="true"></span>
        <div className="ul-hc-body" data-ul-embedded={embedded ? '' : undefined}>{content}</div>
      </ULPopover>
    </>
  );
}
