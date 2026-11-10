/**
 * One shared context-menu mechanism (B). Every component that takes `contextMenu` routes through useContextMenuTarget:
 * one handler set on the component ROOT (event delegation, never per row), the menu is the existing ULMenu on a 0 × 0
 * virtual anchor at the pointer (same anchored morph as ULContextMenu), so there is no new overlay or animation code.
 * Right-click, long-press (touch, ~500ms, cancelled by movement; scroll wins), ContextMenu key and Shift+F10.
 * Returning null / [] from the callback keeps the native browser menu.
 */
import * as React from 'react';
import { ULMenu, type MenuItem } from './ULMenu.tsx';
import { createVirtualAnchor, pointRect } from '../../motion/virtualAnchor.ts';

export interface ContextTarget<D = unknown> {
  /** 'table' | 'kpi' | 'chart' | 'card' | … */
  component: string;
  /** what was hit: 'row' | 'cell' | 'header' | 'point' | 'series' | 'plot' | 'tab' | 'item' | 'self' … */
  kind: string;
  id?: string;
  data?: D;
  /** Table: the column key (cell / header). */
  column?: string;
  /** Table: keys the menu acts on (the selection when the row is selected, else just the row). */
  selection?: string[];
  /** The element the menu returns focus to. */
  el: HTMLElement;
}
export type ContextMenuSpec<D = unknown> = MenuItem[] | ((target: ContextTarget<D>) => MenuItem[] | null | undefined);
export interface ContextMenuProps<D = unknown> {
  contextMenu?: ContextMenuSpec<D>;
  onContextMenuOpen?: (t: ContextTarget<D>) => void;
  onContextMenuClose?: (t: ContextTarget<D>) => void;
  /** Called with the chosen item id (items may also carry their own onSelect). */
  onContextMenuAction?: (id: string, t: ContextTarget<D>) => void;
  /** Where the native menu stays: never | on-text-selection | on-editable (default: on-editable + on-text-selection). */
  contextMenuNative?: 'never' | 'on-text-selection' | 'on-editable';
  contextMenuLabel?: string;
}

const visible = (items: MenuItem[]): MenuItem[] => items.filter((i) => !(i as MenuItem & { hidden?: boolean }).hidden).map((i) => (i.items ? { ...i, items: visible(i.items) } : i));
export function resolveMenu<D>(spec: ContextMenuSpec<D> | undefined, t: ContextTarget<D>): MenuItem[] | null {
  if (!spec) return null;
  const r = typeof spec === 'function' ? spec(t) : spec;
  return r && r.length ? visible(r) : null;
}
function keepNative(mode: ContextMenuProps['contextMenuNative'], root: HTMLElement, hit: Element | null) {
  if (mode === 'never') return false;
  const editable = !!hit?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  if (editable && mode !== 'on-text-selection') return true;
  const sel = window.getSelection();
  if (mode !== 'on-editable' && sel && !sel.isCollapsed && sel.toString().trim() && root.contains(sel.anchorNode)) return true;
  return false;
}

export interface UseContextMenuOptions<D> extends ContextMenuProps<D> {
  component: string;
  /** Map the hit element to a target (null = not a target → native menu). Default: the root itself, kind 'self'. */
  resolve?: (hit: Element, root: HTMLElement) => Omit<ContextTarget<D>, 'component'> | null;
  /** Keyboard (ContextMenu / Shift+F10): the point to open at for a target. Default: the focused element's bottom-left. */
  keyPoint?: (t: ContextTarget<D>) => { x: number; y: number } | null;
}
export interface ContextMenuApi<D> {
  /** Spread onto the component root. Empty object when no contextMenu is given (zero cost). */
  bind: { onContextMenu?: React.MouseEventHandler; onKeyDown?: React.KeyboardEventHandler; onPointerDown?: React.PointerEventHandler; 'aria-haspopup'?: 'menu' };
  menu: React.ReactNode;
  /** Target of the open menu (tables pin that row and show it as active). */
  active: ContextTarget<D> | null;
  /** Programmatic open (tests, a visible "more" button). */
  openFor: (t: ContextTarget<D>, x?: number, y?: number) => boolean;
  close: () => void;
}

export function useContextMenuTarget<D = unknown>(o: UseContextMenuOptions<D>): ContextMenuApi<D> {
  const on = !!o.contextMenu;
  const [state, setState] = React.useState<{ t: ContextTarget<D>; items: MenuItem[]; open: boolean } | null>(null);
  const va = React.useRef<ReturnType<typeof createVirtualAnchor> | null>(null), aRef = React.useRef<HTMLElement | null>(null);
  const opts = React.useRef(o); opts.current = o;
  const lp = React.useRef<{ timer: number; x: number; y: number; fired: number } | null>(null);
  const pend = React.useRef(0), isOpen = React.useRef(false), surf = React.useRef<HTMLElement | null>(null); isOpen.current = !!state?.open;
  React.useEffect(() => () => { va.current?.destroy(); cancelAnimationFrame(pend.current); if (lp.current) clearTimeout(lp.current.timer); }, []);
  const full = (hit: Element, root: HTMLElement): ContextTarget<D> | null => {
    const r = opts.current.resolve ? opts.current.resolve(hit, root) : { kind: 'self', el: root };
    return r ? { component: opts.current.component, ...r } : null;
  };
  const openFor = React.useCallback((t: ContextTarget<D>, x?: number, y?: number) => {
    const items = resolveMenu(opts.current.contextMenu, t);
    if (!items) return false;
    if (x == null || y == null) { const p = opts.current.keyPoint?.(t); const r = t.el.getBoundingClientRect(); x = p?.x ?? r.left + Math.min(16, r.width / 2); y = p?.y ?? r.bottom - Math.min(8, r.height / 2); }
    // pointer-anchor rule (same as ULContextMenu): closed or closing → open NOW (a reopen during the exit reverses the same morph from
    // its current pose; the old deferred open let the exit finish and restart from the point = jump, and an Esc before the deferred
    // frame left a stale open menu). Open → re-aim: exit + enter from the new point on the next frame; close / a new open cancel it.
    cancelAnimationFrame(pend.current); pend.current = 0;
    const px = x, py = y, wasOpen = isOpen.current;
    if (!va.current) va.current = createVirtualAnchor(pointRect(px, py)); else if (!wasOpen) va.current.set(pointRect(px, py));
    aRef.current = va.current.el;
    if (!wasOpen) { setState({ t, items, open: true }); opts.current.onContextMenuOpen?.(t); return true; }
    setState((s) => (s ? { ...s, open: false } : s));
    pend.current = requestAnimationFrame(() => { pend.current = 0; va.current?.set(pointRect(px, py)); setState({ t, items, open: true }); opts.current.onContextMenuOpen?.(t); });
    return true;
  }, []);
  const close = React.useCallback(() => { cancelAnimationFrame(pend.current); pend.current = 0; setState((s) => (s ? { ...s, open: false } : s)); }, []);
  const bind = React.useMemo<ContextMenuApi<D>['bind']>(() => {
    if (!on) return {};
    return {
      'aria-haspopup': 'menu',
      onContextMenu: (e) => {
        const root = e.currentTarget as HTMLElement, hit = e.target as Element;
        if (lp.current && performance.now() - lp.current.fired < 800) { e.preventDefault(); return; } // the OS long-press menu after ours
        if (e.defaultPrevented || keepNative(opts.current.contextMenuNative, root, hit)) return;
        const t = full(hit, root); if (!t) return;
        if (openFor(t, e.clientX, e.clientY)) e.preventDefault();
      },
      onKeyDown: (e) => {
        if (!(e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) return;
        const root = e.currentTarget as HTMLElement, hit = (document.activeElement as Element) ?? root;
        const t = full(hit, root); if (!t) return;
        if (openFor(t)) { e.preventDefault(); e.stopPropagation(); }
      },
      onPointerDown: (e) => {
        if (e.pointerType !== 'touch') return;
        const root = e.currentTarget as HTMLElement, hit = e.target as Element, x0 = e.clientX, y0 = e.clientY;
        if (lp.current) clearTimeout(lp.current.timer);
        const cancel = () => { if (lp.current) clearTimeout(lp.current.timer); root.removeEventListener('pointermove', mv); root.removeEventListener('pointerup', cancel); root.removeEventListener('pointercancel', cancel); window.removeEventListener('scroll', cancel, true); };
        const mv = (m: PointerEvent) => { if (Math.hypot(m.clientX - x0, m.clientY - y0) > 8) cancel(); };
        root.addEventListener('pointermove', mv); root.addEventListener('pointerup', cancel); root.addEventListener('pointercancel', cancel); window.addEventListener('scroll', cancel, { capture: true, passive: true });
        lp.current = { x: x0, y: y0, fired: 0, timer: window.setTimeout(() => { cancel(); const t = full(hit, root); if (t && openFor(t, x0, y0) && lp.current) lp.current.fired = performance.now(); }, 500) };
      },
    };
  }, [on, openFor]);
  const menu = state ? (
    <ULMenu open={state.open} anchorRef={aRef} items={state.items} label={o.contextMenuLabel ?? 'Context menu'} side="bottom" align="start" offset={2} className="ul-context-menu" surfaceRef={surf}
      onAction={(id) => opts.current.onContextMenuAction?.(id, state.t)}
      onOpenChange={(v) => {
        if (v) return;
        const t = state.t;
        cancelAnimationFrame(pend.current); pend.current = 0;
        setState((s) => (s ? { ...s, open: false } : s));
        opts.current.onContextMenuClose?.(t);
        requestAnimationFrame(() => {
          if (!t.el.isConnected || !(!document.activeElement || document.activeElement === document.body || document.activeElement.closest('.ul-context-menu'))) return;
          const f = t.el.matches('a[href], button, input, select, textarea, [tabindex]') ? t.el : t.el.querySelector<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]');
          if (f) { f.focus({ preventScroll: true }); return; }
          t.el.setAttribute('tabindex', '-1'); t.el.focus({ preventScroll: true });
          t.el.addEventListener('blur', () => t.el.removeAttribute('tabindex'), { once: true });
        });
      }} />
  ) : null;
  return { bind, menu, active: state?.open ? state.t : null, openFor, close };
}

/** Merge the context-menu handlers into existing element props (keeps the element's own handlers). */
export function mergeCtx<P extends Record<string, unknown>>(props: P, bind: ContextMenuApi<unknown>['bind']): P {
  if (!bind.onContextMenu) return props;
  const out: Record<string, unknown> = { ...props, 'aria-haspopup': props['aria-haspopup'] ?? bind['aria-haspopup'] };
  for (const k of ['onContextMenu', 'onKeyDown', 'onPointerDown'] as const) {
    const a = props[k] as ((e: unknown) => void) | undefined, b = bind[k] as ((e: unknown) => void) | undefined;
    out[k] = a && b ? (e: unknown) => { a(e); b(e); } : a ?? b;
  }
  return out as P;
}

/** Generic wrapper for anything without its own prop: <ULContextTarget contextMenu={…} target={{ kind, id, data }}>{child}</ULContextTarget>. */
export interface ULContextTargetProps<D = unknown> extends ContextMenuProps<D> {
  children: React.ReactElement;
  component?: string;
  target?: { kind?: string; id?: string; data?: D };
  disabled?: boolean;
}
export function ULContextTarget<D = unknown>({ children, component = 'custom', target, disabled, ...p }: ULContextTargetProps<D>) {
  const api = useContextMenuTarget<D>({ ...p, contextMenu: disabled ? undefined : p.contextMenu, component, resolve: (_h, root) => ({ kind: target?.kind ?? 'self', id: target?.id, data: target?.data, el: root }) });
  const child = React.Children.only(children);
  return <>{React.cloneElement(child, mergeCtx(child.props as Record<string, unknown>, api.bind as ContextMenuApi<unknown>['bind']))}{api.menu}</>;
}

const CTX_KEYS = ['contextMenu', 'onContextMenuOpen', 'onContextMenuClose', 'onContextMenuAction', 'contextMenuNative', 'contextMenuLabel'] as const;
/** Split the context-menu props off a props object (so they never reach the DOM). */
export function splitCtx<T extends object>(props: T): [ContextMenuProps<any>, Omit<T, (typeof CTX_KEYS)[number]>] {
  const ctx: Record<string, unknown> = {}, rest: Record<string, unknown> = { ...(props as Record<string, unknown>) };
  for (const k of CTX_KEYS) if (k in rest) { ctx[k] = rest[k]; delete rest[k]; }
  return [ctx as ContextMenuProps<any>, rest as Omit<T, (typeof CTX_KEYS)[number]>];
}
/** List-like components: the target is the item under the pointer (selector), its id from data-value / data-ctx-id / text. */
export interface CtxItems<D> { selector: string; kind: string; data?: (id: string, el: HTMLElement) => D | undefined }
/** Wrap a component's root element when (and only when) it has a contextMenu prop. */
export function withContextMenu<D>(el: React.ReactElement, p: ContextMenuProps<D>, component: string, target?: { kind?: string; id?: string; data?: D }, items?: CtxItems<D>, contents = false): React.ReactElement {
  if (!p.contextMenu) return el;
  return <CtxWrap<D> p={p} component={component} target={target} items={items} contents={contents}>{el}</CtxWrap>;
}
/** contents: the handlers sit on a display:contents span (components whose root does not take extra props); the layout is unchanged. */
function CtxWrap<D>({ p, component, target, items, contents, children }: { p: ContextMenuProps<D>; component: string; target?: { kind?: string; id?: string; data?: D }; items?: CtxItems<D>; contents?: boolean; children: React.ReactElement }) {
  const api = useContextMenuTarget<D>({ ...p, component, resolve: (hit, root) => {
    if (items) {
      const it = hit.closest<HTMLElement>(items.selector); if (!it || !root.contains(it)) return null;
      const id = it.dataset.value ?? it.dataset.ctxId ?? (it.textContent ?? '').trim();
      return { kind: items.kind, id, data: items.data?.(id, it), el: it };
    }
    const el = contents ? ((root.firstElementChild as HTMLElement | null) ?? root) : root;
    return { kind: target?.kind ?? 'self', id: target?.id, data: target?.data, el };
  } });
  const bind = items ? { ...api.bind, 'aria-haspopup': undefined } : api.bind; // list items carry their own aria-haspopup
  if (contents) return <span className="ul-ctx-target" style={{ display: 'contents' }} {...(bind as Record<string, unknown>)}>{children}{api.menu}</span>;
  return <>{React.cloneElement(children, mergeCtx(children.props as Record<string, unknown>, bind as ContextMenuApi<unknown>['bind']))}{api.menu}</>;
}
