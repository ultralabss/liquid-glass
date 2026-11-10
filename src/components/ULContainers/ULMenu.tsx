import * as React from 'react';
import { ULAnchoredSurface } from '../ULAnchoredSurface/ULAnchoredSurface.tsx';
import { ULGlass } from '../../glass/ULGlass.tsx';
import { createNavIndicator, type NavIndicator } from '../ULIsland/navIndicator.ts';
import { createVirtualAnchor, centerRect, pointRect } from '../../motion/virtualAnchor.ts';
import type { Align, Side } from '../../motion/placement.ts';
import type { Accent, Backdrop } from '../../glass/accent.tsx';
import { Icon, cx, useDomId } from '../shared/icons.tsx';
import { ULCheckMark } from '../shared/ULCheckMark.tsx';
import { ULKbd } from '../ULStructure/kbd.tsx';
import { runViewSwap, newSwapAnims, type SwapAnims } from '../../motion/viewSwap.ts';
import type { AnchoredMorph } from '../../motion/anchoredMorph.ts';
import './ULContainers.css';

/* =====================================================================
 * Menu, context menu, nested submenus, command palette.
 * Every surface is ULAnchoredSurface (role menu → page scroll locked). Items are flat rows; ONE flattened glass lens
 * (createNavIndicator, the shared floating indicator) follows hover / keyboard focus. Roles: menu, menuitem,
 * menuitemcheckbox, menuitemradio, separator, group. Keys: ↑ ↓ Home End, typeahead, Enter / Space, → opens a submenu,
 * ← / Esc closes it (focus back on its item), Esc / Tab close the menu. Submenus open on hover after
 * --ul-menu-submenu-delay with safe-triangle hover intent.
 * ===================================================================== */
export interface MenuItem {
  id?: string;
  label?: React.ReactNode;
  /** Text for typeahead / aria when label is not a string. */
  textValue?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  type?: 'item' | 'checkbox' | 'radio' | 'separator' | 'label';
  checked?: boolean;
  onSelect?: () => void;
  /** Nested submenu. */
  items?: MenuItem[];
  /** Not rendered (context menus filter these out). */
  hidden?: boolean;
}
const txt = (it: MenuItem) => it.textValue ?? (typeof it.label === 'string' ? it.label : '');
const actionable = (it: MenuItem) => it.type !== 'separator' && it.type !== 'label';

interface ListProps { open: boolean; items: MenuItem[]; label?: string; onClose: (all: boolean) => void; onAction?: (id: string, it: MenuItem) => void; closeOnSelect: boolean; depth: number; initial?: 'first' | 'last' | null; morphRef?: React.MutableRefObject<AnchoredMorph | null>; backLabel?: string }
interface Level { key: string; items: MenuItem[]; label: string; from: number }

/** No room for a submenu beside this surface on either side (phones): drill in inside the same surface instead. */
function noRoomBeside(box: HTMLElement | null): boolean {
  const s = box?.closest<HTMLElement>('.ul-anchored'); if (!s) return false;
  const r = s.getBoundingClientRect(), gap = parseFloat(getComputedStyle(s).getPropertyValue('--ul-submenu-gap')) || 2, m = 8;
  return innerWidth - r.right - m < r.width + gap && r.left - m < r.width + gap;
}

function MenuList({ open, items, label, onClose, onAction, closeOnSelect, depth, initial, morphRef, backLabel = 'Back' }: ListProps) {
  const box = React.useRef<HTMLDivElement | null>(null);
  const lens = React.useRef<HTMLElement | null>(null);
  const ind = React.useRef<NavIndicator | null>(null);
  const [sub, setSub] = React.useState<number>(-1);
  const subRef = React.useRef(-1); subRef.current = sub;
  const timer = React.useRef(0);
  const typed = React.useRef({ s: '', t: 0 });
  const tri = React.useRef<{ x: number; y: number; t: number } | null>(null);
  const subSurf = React.useRef<HTMLElement | null>(null);
  // drill-in stack (phones): every level stays mounted (hidden + inert) while it is on the stack, like dialog views
  const [levels, setLevels] = React.useState<Level[]>([{ key: 'root', items, label: label ?? '', from: -1 }]);
  const [leaving, setLeaving] = React.useState<Level | null>(null);
  const levelEls = React.useRef(new Map<string, HTMLElement>());
  const swapA = React.useRef<SwapAnims>(newSwapAnims());
  const swapDir = React.useRef<1 | -1>(1), focusAfter = React.useRef<number>(0);
  const top = levels[levels.length - 1];
  const cur = top.key === 'root' ? items : top.items;
  React.useEffect(() => { if (!open) { setLevels([{ key: 'root', items, label: label ?? '', from: -1 }]); setLeaving(null); } }, [open]);
  const activeLevel = () => box.current?.querySelector<HTMLElement>('[data-active-level]') ?? box.current;
  const els = () => [...(activeLevel()?.querySelectorAll<HTMLElement>('[data-menu-item]:not([aria-disabled="true"])') ?? [])];
  const focusAt = (i: number) => { const f = els(); if (f.length) f[(i + f.length) % f.length].focus({ preventScroll: true }); };
  React.useEffect(() => {
    if (!box.current || !lens.current) return;
    ind.current = createNavIndicator({ container: box.current, lens: lens.current, items: '[data-active-level] [data-menu-item]:not([aria-disabled="true"])', rest: () => (subRef.current >= 0 ? activeLevel()?.querySelector<HTMLElement>(`[data-index="${subRef.current}"]`) ?? null : null) });
    return () => { ind.current?.destroy(); clearTimeout(timer.current); };
  }, []);
  // initial focus on EVERY open (cold first open included): the surface may not be focusable yet in the first frames
  // (top layer / inert lifted by the morph), so retry per frame for up to 1.5s and once more at the enter morph's end,
  // until focus lands inside or the user moved it.
  React.useEffect(() => {
    if (!open || !initial) return;
    const start = document.activeElement, t0 = performance.now(); let id = 0, done = false;
    const tryFocus = () => {
      if (done) return;
      const a = document.activeElement;
      if (box.current?.contains(a) || (a !== start && a && a !== document.body)) { done = true; return; }
      focusAt(initial === 'last' ? -1 : 0);
      if (box.current?.contains(document.activeElement)) { done = true; return; }
      if (performance.now() - t0 < 1500) id = requestAnimationFrame(tryFocus);
    };
    const surf = box.current?.closest<HTMLElement>('.ul-anchored');
    const onMorph = (e: Event) => { const d = (e as CustomEvent).detail; if (e.target === surf && d?.phase === 'enter' && d.state === 'end') tryFocus(); };
    surf?.addEventListener('ul:morph', onMorph);
    id = requestAnimationFrame(tryFocus);
    return () => { done = true; cancelAnimationFrame(id); surf?.removeEventListener('ul:morph', onMorph); };
  }, [open]);
  React.useEffect(() => { ind.current?.update(); }, [sub, top.key]);

  const drillIn = (it: MenuItem, i: number) => {
    clearTimeout(timer.current); setSub(-1);
    swapDir.current = 1; focusAfter.current = 0;
    setLeaving(top); setLevels((l) => [...l, { key: `${l[l.length - 1].key}.${i}`, items: it.items!, label: txt(it), from: i }]);
  };
  const drillOut = () => {
    if (levels.length < 2) return false;
    swapDir.current = -1; focusAfter.current = top.from;
    setLeaving(top); setLevels((l) => l.slice(0, -1));
    return true;
  };
  // the same-surface swap as dialog push / pop (shared runViewSwap)
  React.useLayoutEffect(() => {
    const s = box.current?.closest<HTMLElement>('.ul-anchored'); if (!s || !leaving || leaving.key === top.key) return;
    const X = levelEls.current.get(leaving.key), Y = levelEls.current.get(top.key); if (!Y) { setLeaving(null); return; }
    runViewSwap({ surface: s, from: X, to: Y, dir: swapDir.current, morph: morphRef?.current ?? null, anims: swapA.current, onDone: () => setLeaving(null) });
    requestAnimationFrame(() => focusAt(swapDir.current < 0 ? Math.max(0, els().findIndex((n) => Number(n.dataset.index) === focusAfter.current)) : 0));
  }, [top.key]);
  React.useLayoutEffect(() => {
    if (leaving) return;
    levelEls.current.forEach((el, k) => { el.style.cssText = ''; el.hidden = k !== top.key; });
    swapA.current.out.forEach((a) => a.cancel()); swapA.current.out = [];
  }, [leaving, top.key]);

  const activate = (it: MenuItem, i: number, viaKey: boolean) => {
    if (it.disabled) return;
    if (it.items) { if (top.key !== 'root' || noRoomBeside(box.current)) { drillIn(it, i); return; } setSub(i); if (viaKey) subInitial.current = 'first'; return; }
    it.onSelect?.();
    if (it.id) onAction?.(it.id, it);
    if (closeOnSelect && it.type !== 'checkbox' && it.type !== 'radio') onClose(true);
  };
  const subInitial = React.useRef<'first' | null>(null);
  // React events bubble through portals: a key / pointer event from a nested submenu surface (a React child, a DOM
  // stranger) reaches every ancestor MenuList. Only this list's own DOM may drive this level (nested = inside, not ours).
  const own = (e: React.SyntheticEvent) => !!box.current && box.current.contains(e.target as Node);
  const onKey = (e: React.KeyboardEvent) => {
    if (!own(e)) return;
    const f = els(), i = f.indexOf(document.activeElement as HTMLElement);
    const el = f[i], idx = el ? Number(el.dataset.index) : -1, it = idx >= 0 ? cur[idx] : undefined;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusAt(i + 1); return;
      case 'ArrowUp': e.preventDefault(); focusAt(i < 0 ? -1 : i - 1); return;
      case 'Home': e.preventDefault(); focusAt(0); return;
      case 'End': e.preventDefault(); focusAt(-1); return;
      case 'ArrowRight': if (it?.items) { e.preventDefault(); if (top.key !== 'root' || noRoomBeside(box.current)) drillIn(it, idx); else { subInitial.current = 'first'; setSub(idx); } } return;
      case 'ArrowLeft': if (levels.length > 1) { e.preventDefault(); e.stopPropagation(); drillOut(); return; } if (depth > 0) { e.preventDefault(); e.stopPropagation(); onClose(false); } return;
      case 'Escape': if (levels.length > 1) { e.preventDefault(); e.stopPropagation(); drillOut(); } return; // one level up; at the root the surface closes
      case 'Tab': e.preventDefault(); onClose(true); return;
      case 'Enter': case ' ': if (el?.dataset.back != null) { e.preventDefault(); drillOut(); return; } if (it) { e.preventDefault(); activate(it, idx, true); } return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const now = performance.now(), wait = parseFloat(getComputedStyle(box.current!).getPropertyValue('--ul-menu-typeahead')) || 600;
          typed.current = { s: (now - typed.current.t > wait ? '' : typed.current.s) + e.key.toLowerCase(), t: now };
          const q = typed.current.s, order = [...f.slice(i + 1), ...f.slice(0, i + 1)];
          const hit = order.find((n) => (n.dataset.text ?? '').toLowerCase().startsWith(q)) ?? (q.length > 1 ? undefined : order.find((n) => (n.dataset.text ?? '').toLowerCase().startsWith(q[0])));
          hit?.focus({ preventScroll: true });
        }
    }
  };
  // hover intent: safe triangle from the last pointer point to the open submenu's near edge
  const inTriangle = (x: number, y: number) => {
    const s = subSurf.current, p = tri.current;
    if (!s || !p || performance.now() - p.t > 400) return false;
    const r = s.getBoundingClientRect(), nx = r.left >= p.x ? r.left : r.right;
    const A = { x: p.x, y: p.y }, B = { x: nx, y: r.top - 8 }, C = { x: nx, y: r.bottom + 8 };
    const sgn = (p1: typeof A, p2: typeof A, p3: typeof A) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const d1 = sgn({ x, y }, A, B), d2 = sgn({ x, y }, B, C), d3 = sgn({ x, y }, C, A);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    // pointer inside a descendant submenu counts as inside this level: cancel a pending switch / close, change nothing
    if (!own(e)) { clearTimeout(timer.current); return; }
    const el = (e.target as Element).closest<HTMLElement>('[data-active-level] [data-menu-item]');
    const keep = sub >= 0 && inTriangle(e.clientX, e.clientY);
    tri.current = { x: e.clientX, y: e.clientY, t: keep ? (tri.current?.t ?? performance.now()) : performance.now() };
    if (keep || !el) return;
    if (document.activeElement !== el && el.getAttribute('aria-disabled') !== 'true') el.focus({ preventScroll: true });
    if (el.dataset.back != null || top.key !== 'root') return; // drilled levels open on click / keys only
    const idx = Number(el.dataset.index);
    clearTimeout(timer.current);
    if (idx === sub) return;
    const delay = parseFloat(getComputedStyle(box.current!).getPropertyValue('--ul-menu-submenu-delay')) || 120;
    timer.current = window.setTimeout(() => setSub(items[idx]?.items && !items[idx].disabled && !noRoomBeside(box.current) ? idx : -1), delay);
  };
  const itemRefs = React.useRef<(HTMLElement | null)[]>([]);
  const closeSub = (all: boolean) => {
    const i = subRef.current;
    setSub(-1);
    if (all) onClose(true); else requestAnimationFrame(() => itemRefs.current[i]?.focus({ preventScroll: true }));
  };
  const renderRows = (list: MenuItem[], root: boolean) => list.map((it, i) => {
    if (it.type === 'separator') return <div key={i} role="separator" className="ul-menu-sep"></div>;
    if (it.type === 'label') return <div key={i} role="presentation" className="ul-menu-label">{it.label}</div>;
    const role = it.type === 'checkbox' ? 'menuitemcheckbox' : it.type === 'radio' ? 'menuitemradio' : 'menuitem';
    return (
      <React.Fragment key={it.id ?? i}>
        <div ref={root ? (n) => { itemRefs.current[i] = n; } : undefined} role={role} tabIndex={-1} data-menu-item="" data-index={i} data-text={txt(it)}
          aria-disabled={it.disabled || undefined} aria-checked={role === 'menuitem' ? undefined : !!it.checked}
          aria-haspopup={it.items ? 'menu' : undefined} aria-expanded={it.items ? root && sub === i : undefined}
          className="ul-menu-item ul-menu-row" data-tone={it.destructive ? 'danger' : undefined} data-open={root && sub === i ? '' : undefined}
          onClick={() => activate(it, i, false)}>
          {role !== 'menuitem' ? <ULCheckMark checked={!!it.checked} className="ul-menu-check" /> : <span className="ul-menu-check" aria-hidden="true"></span>}
          {it.icon ? <span className="ul-btn-icon" aria-hidden="true">{it.icon}</span> : null}
          <span className="ul-menu-text">{it.label}</span>
          {it.shortcut ? <ULKbd keys={it.shortcut} size="sm" className="ul-menu-kbd" /> : null}
          {it.items ? <span className="ul-menu-chev" aria-hidden="true"><Icon name="chevron-right" /></span> : null}
        </div>
        {it.items && root ? (
          <SubMenu open={open && sub === i} anchor={itemRefs.current[i] ?? null} items={it.items} label={txt(it)} depth={depth + 1} initial={subInitial.current}
            surfRef={subSurf} onClose={closeSub} onAction={onAction} closeOnSelect={closeOnSelect} />
        ) : null}
      </React.Fragment>
    );
  });
  const mounted = leaving && !levels.some((l) => l.key === leaving.key) ? [...levels, leaving] : levels;
  return (
    <div ref={box} className="ul-menu ul-menu--glass" role="none" onKeyDown={onKey} onPointerMove={onMove} onPointerLeave={() => clearTimeout(timer.current)}>
      <ULGlass as="span" ref={lens} aria-hidden="true" tier="sm" radius="var(--ul-item-radius, var(--ul-radius-sm))" className="ul-menu-lens" materialCategory="overlays" />
      {mounted.map((lv) => {
        const on = lv.key === top.key, root = lv.key === 'root', parent = levels[levels.indexOf(lv) - 1] ?? leaving;
        return (
          <div key={lv.key} ref={(n) => { if (n) levelEls.current.set(lv.key, n); else levelEls.current.delete(lv.key); }} className="ul-menu-level" role="group" aria-label={root ? undefined : lv.label}
            data-active-level={on ? '' : undefined} hidden={!on && !(leaving && leaving.key === lv.key)} {...(on ? {} : { inert: '' } as Record<string, string>)}>
            {root ? null : (
              <>
              <div role="menuitem" tabIndex={-1} data-menu-item="" data-back="" data-text={backLabel} className="ul-menu-item ul-menu-row ul-menu-back"
                aria-label={`${backLabel}: ${parent?.key === 'root' ? (label ?? '') : parent?.label ?? ''}`.replace(/: $/, '')} onClick={() => drillOut()}>
                <span className="ul-menu-check ul-menu-back-ic" aria-hidden="true"><Icon name="chevron-left" /></span>
                <span className="ul-menu-text">{lv.label}</span>
              </div>
              <div role="separator" className="ul-menu-sep"></div>
              </>
            )}
            {renderRows(root ? items : lv.items, root)}
          </div>
        );
      })}
    </div>
  );
}

function SubMenu({ open, anchor, items, label, depth, initial, surfRef, onClose, onAction, closeOnSelect }: { open: boolean; anchor: HTMLElement | null; items: MenuItem[]; label: string; depth: number; initial: 'first' | null; surfRef: React.MutableRefObject<HTMLElement | null>; onClose: (all: boolean) => void; onAction?: ListProps['onAction']; closeOnSelect: boolean }) {
  const aRef = React.useMemo(() => ({ current: anchor }), [anchor]);
  aRef.current = anchor;
  const morphRef = React.useRef<AnchoredMorph | null>(null);
  return (
    <ULAnchoredSurface open={open && !!anchor} anchorRef={aRef} onClose={() => onClose(false)} role="menu" aria-label={label} side="right" align="start"
      tier="lg" padding="var(--ul-space-2)" surfaceRef={surfRef} morphRef={morphRef} closeOnOutside={false} className="ul-menu-surface">
      {/* invisible hover bridge over the --ul-submenu-gap: crossing the gap never leaves a menu surface */}
      <span className="ul-sub-bridge" aria-hidden="true"></span>
      <MenuList open={open} items={items} label={label} depth={depth} initial={initial} onClose={(all) => onClose(all)} onAction={onAction} closeOnSelect={closeOnSelect} morphRef={morphRef} />
    </ULAnchoredSurface>
  );
}

export interface ULMenuProps {
  /** Controlled open state. */ open: boolean;
  /** Called with the next open state (trigger, Esc, outside click, close button). */ onOpenChange?: (open: boolean) => void;
  /** Element the surface is anchored to (and morphs from). */ anchorRef: React.RefObject<HTMLElement | null>;
  /** Menu items (action, checkbox, radio, label, separator, submenu). */ items: MenuItem[];
  /** Accessible name of the menu. */ label?: string;
  /** Preferred side: "top" | "bottom" | "left" | "right" (flips when there is no room). */ side?: Side;
  /** Alignment on the side: "start" | "center" | "end". */ align?: Align;
  /** Gap between anchor and surface in px. Default --ul-popover-offset. */ offset?: number;
  /** Called with the item id when an action item is chosen. */ onAction?: (id: string, item: MenuItem) => void;
  /** Close after an action item is chosen. Default true (checkbox items keep it open). */ closeOnSelect?: boolean;
  /** Focus the first (or last) item on open. Default first; null keeps focus on the trigger. */
  initialFocus?: 'first' | 'last' | null;
  /** Accent colour: accent name ("violet", "ice", "emerald", "amber", "rose") or a CSS colour (checked by guardAccent). */ accent?: Accent;
  /** Backdrop hint for the glass: "dark" | "mid" | "light". */ backdrop?: Backdrop;
  /** Extra class on the root element. */ className?: string;
  /** Label of the back row when a submenu drills in (phones: no room beside the parent). Default "Back". */
  backLabel?: string;
  /** @internal tests */
  surfaceRef?: React.MutableRefObject<HTMLElement | null>;
}

/** Dropdown menu. Wire the trigger with aria-haspopup="menu" + aria-expanded (ULMenuButton does it). */
export function ULMenu({ open, onOpenChange, anchorRef, items, label, side = 'bottom', align = 'start', offset, onAction, closeOnSelect = true, initialFocus = 'first', accent, backdrop, className, surfaceRef, backLabel }: ULMenuProps) {
  const morphRef = React.useRef<AnchoredMorph | null>(null);
  const close = React.useCallback((refocus = true) => {
    onOpenChange?.(false);
    const a = document.activeElement;
    if (refocus && (!a || a === document.body || a.closest('.ul-menu-surface'))) requestAnimationFrame(() => anchorRef.current?.focus?.({ preventScroll: true }));
  }, [onOpenChange]);
  return (
    <ULAnchoredSurface open={open} anchorRef={anchorRef} onClose={() => close(true)} role="menu" aria-label={label} side={side} align={align} offset={offset}
      tier="lg" padding="var(--ul-space-2)" accent={accent} backdrop={backdrop} surfaceRef={surfaceRef} morphRef={morphRef} className={cx('ul-menu-surface', className)}>
      <MenuList open={open} items={items} label={label} depth={0} initial={initialFocus} onClose={() => close(true)} onAction={onAction} closeOnSelect={closeOnSelect} morphRef={morphRef} backLabel={backLabel} />
    </ULAnchoredSurface>
  );
}

/** Trigger + menu in one: a button with aria-haspopup / aria-expanded; ↓ / Enter / Space open on the first item, ↑ on the last. */
export function ULMenuButton({ children, items, label, onAction, side, align, buttonProps, className, closeOnSelect }: { children: React.ReactNode; items: MenuItem[]; label?: string; onAction?: ULMenuProps['onAction']; side?: Side; align?: Align; buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>; className?: string; /** Forwarded to ULMenu (false keeps the menu open after an action, e.g. the columns menu). */ closeOnSelect?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [initial, setInitial] = React.useState<'first' | 'last'>('first');
  const ref = React.useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={ref} type="button" {...buttonProps} className={cx('ul-menu-trigger', className, buttonProps?.className)} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)} onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setInitial(e.key === 'ArrowUp' ? 'last' : 'first'); setOpen(true); } buttonProps?.onKeyDown?.(e); }}>
        {children}
      </button>
      <ULMenu open={open} onOpenChange={setOpen} anchorRef={ref} items={items} label={label} onAction={onAction} side={side} align={align} initialFocus={initial} closeOnSelect={closeOnSelect} />
    </>
  );
}

/* ---------------- Context menu ---------------- */
export interface ULContextMenuProps extends Omit<ULMenuProps, 'open' | 'onOpenChange' | 'anchorRef' | 'side' | 'align'> {
  /** Target element; right-click, long-press, ContextMenu key and Shift+F10 open the menu at the pointer / element. */ children: React.ReactElement;
  /** Ignore context-menu gestures (the browser menu shows). Default false. */ disabled?: boolean;
}

/**
 * Right-click (or long-press, Menu key, Shift+F10 on the focused target): the menu pours out of the POINTER point
 * (0 × 0 virtual anchor) with the same morph. Keyboard: from the focused element's bottom-left corner.
 */
export function ULContextMenu({ children, items, label, onAction, disabled, closeOnSelect, accent, backdrop, className, surfaceRef }: ULContextMenuProps) {
  const [open, setOpen] = React.useState(false);
  const va = React.useRef<ReturnType<typeof createVirtualAnchor> | null>(null);
  const aRef = React.useRef<HTMLElement | null>(null);
  const target = React.useRef<HTMLElement | null>(null);
  const isOpen = React.useRef(false), pend = React.useRef(0);
  isOpen.current = open;
  React.useEffect(() => () => { va.current?.destroy(); cancelAnimationFrame(pend.current); }, []);
  // closed or closing: open NOW (a reopen during the exit reverses the same morph from its current pose). Open: re-aim = exit +
  // new enter from the new point one frame later; any close / new open cancels a pending re-aim (no stale open after Esc).
  const setO = (v: boolean) => { cancelAnimationFrame(pend.current); pend.current = 0; setOpen(v); };
  const ownSurf = React.useRef<HTMLElement | null>(null), surf = surfaceRef ?? ownSurf;
  const at = (x: number, y: number) => {
    const wasOpen = isOpen.current;
    if (!va.current) va.current = createVirtualAnchor(pointRect(x, y)); else if (!wasOpen) va.current.set(pointRect(x, y));
    aRef.current = va.current.el;
    if (!wasOpen) { setO(true); return; }
    setO(false);
    pend.current = requestAnimationFrame(() => { pend.current = 0; va.current?.set(pointRect(x, y)); setOpen(true); });
  };
  const child = React.Children.only(children);
  const p = child.props as { onContextMenu?: React.MouseEventHandler; onKeyDown?: React.KeyboardEventHandler };
  return (
    <>
      {React.cloneElement(child, {
        ref: (n: HTMLElement | null) => { target.current = n; },
        onContextMenu: (e: React.MouseEvent) => { p.onContextMenu?.(e); if (disabled || e.defaultPrevented) return; e.preventDefault(); at(e.clientX, e.clientY); },
        onKeyDown: (e: React.KeyboardEvent) => {
          p.onKeyDown?.(e);
          if (disabled || !(e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) return;
          e.preventDefault();
          const r = ((document.activeElement as HTMLElement | null) ?? target.current)?.getBoundingClientRect();
          if (r) at(r.left + Math.min(16, r.width / 2), r.bottom - Math.min(8, r.height / 2));
        },
      } as Record<string, unknown>)}
      <ULMenu open={open} onOpenChange={(o) => { setO(o); if (!o) requestAnimationFrame(() => target.current?.focus?.({ preventScroll: true })); }} anchorRef={aRef} items={items} label={label}
        side="bottom" align="start" offset={2} onAction={onAction} closeOnSelect={closeOnSelect} accent={accent} backdrop={backdrop} className={cx('ul-context-menu', className)} surfaceRef={surf} />
    </>
  );
}

/* ---------------- Command palette ---------------- */
export interface CommandItem { id: string; label: string; group?: string; keywords?: string[]; icon?: React.ReactNode; shortcut?: string; disabled?: boolean; onRun?: () => void }
export interface ULCommandPaletteProps {
  /** Controlled open state. */ open: boolean;
  /** Called with the next open state (trigger, Esc, outside click, close button). */ onOpenChange: (open: boolean) => void;
  /** Commands ({ id, label, group?, keywords?, shortcut?, onSelect? }). */ items: CommandItem[];
  /** Search trigger it morphs from; otherwise it grows from the viewport centre. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Register Cmd / Ctrl + K. Default true. */
  hotkey?: boolean;
  /** Placeholder of the search input. */ placeholder?: string;
  /** Accessible name of the palette dialog. */ label?: string;
  /** Text when nothing matches. Default "No matching commands" (English; pass a translated string). */ emptyText?: string;
  /** Heading of the recent group. Default "Recent" (English; pass a translated string). */ recentLabel?: string;
  /** Recent command ids (controlled). Default: kept in memory for the session (never persisted). */
  recent?: string[];
  /** Called with the recent command ids after a run (persist them yourself). */ onRecentChange?: (ids: string[]) => void;
  /** Wide reading layout (--ul-modal-w-reading). Default false. */ reading?: boolean;
  /** Accent colour: accent name ("violet", "ice", "emerald", "amber", "rose") or a CSS colour (checked by guardAccent). */ accent?: Accent;
  /** Extra class on the root element. */ className?: string;
  /** @internal tests */
  surfaceRef?: React.MutableRefObject<HTMLElement | null>;
}

/** Subsequence fuzzy score: consecutive and word-start matches score higher; -1 = no match. */
export function fuzzyScore(q: string, s: string): number {
  if (!q) return 0;
  q = q.toLowerCase(); s = s.toLowerCase();
  let qi = 0, score = 0, run = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) { run++; score += 1 + run * 2 + (i === 0 || /[\s\-_/]/.test(s[i - 1]) ? 6 : 0); qi++; } else run = 0;
  }
  return qi === q.length ? score - s.length * 0.05 : -1;
}

export function ULCommandPalette({ open, onOpenChange, items, triggerRef, hotkey = true, placeholder = 'Search commands…', label = 'Command palette', emptyText = 'No matching commands', recentLabel = 'Recent', recent, onRecentChange, reading, accent, className, surfaceRef }: ULCommandPaletteProps) {
  const id = useDomId('ul-cmd');
  const [q, setQ] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [ownRecent, setOwnRecent] = React.useState<string[]>([]);
  const rec = recent ?? ownRecent;
  const box = React.useRef<HTMLDivElement | null>(null), lens = React.useRef<HTMLElement | null>(null), ind = React.useRef<NavIndicator | null>(null);
  const openRef = React.useRef(open); openRef.current = open;
  // centre fallback anchor
  const va = React.useRef<ReturnType<typeof createVirtualAnchor> | null>(null);
  const vRef = React.useRef<HTMLElement | null>(null);
  const hasTrigger = !!triggerRef?.current;
  if (typeof document !== 'undefined' && open && !hasTrigger) { if (!va.current) va.current = createVirtualAnchor(centerRect()); vRef.current = va.current.el; }
  React.useEffect(() => () => va.current?.destroy(), []);
  React.useEffect(() => {
    if (!hotkey) return;
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); onOpenChange(!openRef.current); } };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [hotkey, onOpenChange]);
  React.useEffect(() => { if (open) { setQ(''); setActive(0); } }, [open]);

  const groups = React.useMemo(() => {
    const on = items;
    if (!q) {
      const r = rec.map((rid) => items.find((i) => i.id === rid)).filter(Boolean).slice(0, parseInt(typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--ul-palette-recent') : '5', 10) || 5) as CommandItem[];
      const out: { name: string; items: CommandItem[] }[] = r.length ? [{ name: recentLabel, items: r }] : [];
      const by = new Map<string, CommandItem[]>();
      on.forEach((i) => { if (r.includes(i)) return; const g = i.group ?? ''; by.set(g, [...(by.get(g) ?? []), i]); });
      by.forEach((v, k) => out.push({ name: k, items: v }));
      return out;
    }
    const scored = on.map((i) => ({ i, s: Math.max(fuzzyScore(q, i.label), ...(i.keywords ?? []).map((k) => fuzzyScore(q, k) - 2)) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s);
    const by = new Map<string, CommandItem[]>();
    scored.forEach(({ i }) => { const g = i.group ?? ''; by.set(g, [...(by.get(g) ?? []), i]); });
    return [...by].map(([name, v]) => ({ name, items: v }));
  }, [items, q, rec]);
  const flat = groups.flatMap((g) => g.items);
  const act = Math.min(active, flat.length - 1);
  React.useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => {
      if (!box.current || !lens.current || ind.current) return;
      ind.current = createNavIndicator({ container: box.current, lens: lens.current, items: '[role="option"]:not([aria-disabled="true"])', rest: () => box.current?.querySelector<HTMLElement>('[data-active]') ?? null });
    });
    return () => { cancelAnimationFrame(t); ind.current?.destroy(); ind.current = null; };
  }, [open]);
  React.useEffect(() => { ind.current?.update(); }, [act, q]);
  React.useEffect(() => { // keep the active option in view (no scrollIntoView)
    const el = box.current?.querySelector<HTMLElement>('[data-active]'), b = box.current;
    if (!el || !b) return;
    const top = el.offsetTop, bot = top + el.offsetHeight;
    if (top < b.scrollTop) b.scrollTop = top - 8; else if (bot > b.scrollTop + b.clientHeight) b.scrollTop = bot - b.clientHeight + 8;
  }, [act, q]);
  const run = (c: CommandItem | undefined) => {
    if (!c || c.disabled) return;
    const next = [c.id, ...rec.filter((x) => x !== c.id)].slice(0, 8);
    if (recent === undefined) setOwnRecent(next);
    onRecentChange?.(next);
    onOpenChange(false);
    c.onRun?.();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const n = flat.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((act + 1) % Math.max(1, n)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((act - 1 + n) % Math.max(1, n)); }
    else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); setActive(n - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); run(flat[act]); }
  };
  let k = -1;
  return (
    <ULAnchoredSurface open={open} anchorRef={hasTrigger ? triggerRef! : vRef} onClose={() => onOpenChange(false)} role="dialog" aria-label={label} modal scrim
      layout="top" offset={typeof window !== 'undefined' ? Math.round(innerHeight * 0.14) : 96} tier="xl" padding="var(--ul-space-2)" returnFocus={hasTrigger ? triggerRef!.current : null}
      backdrop={reading ? 'light' : undefined} accent={accent} surfaceRef={surfaceRef} className={cx('ul-palette', className)} initialFocus="input">
      <div className="ul-palette-search">
        <span className="ul-palette-ic" aria-hidden="true"><Icon name="search" /></span>
        <input role="combobox" aria-expanded="true" aria-controls={`${id}-l`} aria-autocomplete="list" aria-activedescendant={flat[act] ? `${id}-o${act}` : undefined}
          aria-label={label} placeholder={placeholder} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} className="ul-palette-input" autoComplete="off" spellCheck={false} />
        <kbd className="ul-menu-kbd">Esc</kbd>
      </div>
      <div ref={box} id={`${id}-l`} role="listbox" aria-label={label} className="ul-palette-list">
        <ULGlass as="span" ref={lens} aria-hidden="true" tier="sm" radius="var(--ul-item-radius, var(--ul-radius-sm))" className="ul-menu-lens" materialCategory="overlays" />
        {flat.length === 0 ? <p className="ul-palette-empty" role="status">{emptyText}</p> : null}
        {groups.map((g, gi) => (
          <div key={g.name + gi} role="group" aria-labelledby={g.name ? `${id}-g${gi}` : undefined} className="ul-palette-group">
            {g.name ? <div id={`${id}-g${gi}`} className="ul-menu-label" role="presentation">{g.name}</div> : null}
            {g.items.map((c) => {
              k++; const i = k;
              return (
                <div key={c.id + '-' + i} id={`${id}-o${i}`} role="option" aria-selected={i === act} aria-disabled={c.disabled || undefined} data-active={i === act ? '' : undefined}
                  className="ul-menu-item ul-menu-row" onPointerMove={() => i !== act && setActive(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => run(c)}>
                  {c.icon ? <span className="ul-btn-icon" aria-hidden="true">{c.icon}</span> : <span className="ul-menu-check" aria-hidden="true"></span>}
                  <span className="ul-menu-text">{c.label}</span>
                  {c.shortcut ? <ULKbd keys={c.shortcut} size="sm" className="ul-menu-kbd" /> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="ul-sr-only" role="status" aria-live="polite">{q ? `${flat.length} results` : ''}</div>
    </ULAnchoredSurface>
  );
}
