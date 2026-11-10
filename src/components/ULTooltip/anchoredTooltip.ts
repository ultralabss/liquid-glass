/**
 * Shared hover/focus tooltip. Enter/exit and anchoring go through the shared
 * AnchoredMorph (manual placement, so it works inside scaled ancestors).
 * The surface is flattened and opaque: it never samples glass, so it may sit
 * next to (or over) a glass popper without breaking the one-glass-layer rule.
 * Framework-agnostic; events are delegated from `container`.
 */
import { AnchoredMorph } from '../../motion/anchoredMorph.ts';

export interface AnchoredTooltipOptions {
  /** Element whose items get tooltips (events are delegated). */
  container: HTMLElement;
  /** Positioned ancestor the tooltip is laid out in. Must not clip it. */
  layer: HTMLElement;
  /** Item selector. Default: [data-ul-tip]. */
  items?: string;
  /** Tooltip text for an item. Default: its data-ul-tip attribute. */
  text?: (el: HTMLElement) => string;
  side?: 'top' | 'bottom' | 'right' | 'left';
  /** Optional element the tooltip must clear (e.g. the popper the items live in). */
  clear?: () => HTMLElement | null;
  /** Hover delay in ms (keyboard focus shows immediately). Default 350. */
  delay?: number;
}
export interface AnchoredTooltip { readonly el: HTMLElement; /** Show for an item now (specs, tests). */ show(item: HTMLElement): void; hide(): void; destroy(): void }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function createAnchoredTooltip(o: AnchoredTooltipOptions): AnchoredTooltip {
  const sel = o.items ?? '[data-ul-tip]', side = o.side ?? 'bottom', delay = o.delay ?? 350;
  const text = o.text ?? ((n: HTMLElement) => n.getAttribute('data-ul-tip') || '');
  const id = 'ul-tip-' + Math.random().toString(36).slice(2, 8);
  const el = document.createElement('div');
  el.id = id;
  el.setAttribute('role', 'tooltip');
  el.setAttribute('data-ul-tooltip', '');
  Object.assign(el.style, {
    position: 'absolute', left: '0px', top: '0px', zIndex: 'calc(var(--ul-z-overlay, 1000) + 1)', visibility: 'hidden', pointerEvents: 'none',
    boxSizing: 'border-box', padding: '6px 10px', borderRadius: '10px', whiteSpace: 'nowrap',
    background: 'var(--ul-tooltip-bg, #0b0912)', color: 'var(--ul-tooltip-ink, #f4f2f8)',
    boxShadow: '0 0 0 1px rgb(255 255 255 / .14), 0 10px 24px -10px rgb(0 0 0 / .7)',
    font: '500 12.5px/1.3 var(--page-font-body, var(--ul-font-sans, system-ui))', letterSpacing: '0',
  } as Partial<CSSStyleDeclaration>);
  o.layer.appendChild(el);

  let cur: HTMLElement | null = null, shown = false, timer = 0, morph: AnchoredMorph | null = null;

  const place = (a: HTMLElement) => {
    const L = o.layer.getBoundingClientRect(), k = (o.layer.offsetWidth ? L.width / o.layer.offsetWidth : 1) || 1;
    const r = a.getBoundingClientRect(), c = o.clear?.()?.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight, gap = 6;
    if (side === 'right' || side === 'left') { // collapsed sidebar items
      const xs = side === 'right' ? (Math.max(r.right, c ? c.right : -Infinity) - L.left) / k + gap * 1.5 : (Math.min(r.left, c ? c.left : Infinity) - L.left) / k - w - gap * 1.5;
      el.style.left = `${xs.toFixed(1)}px`;
      el.style.top = `${((r.top + r.height / 2 - L.top) / k - h / 2).toFixed(1)}px`;
      return;
    }
    const x = clamp((r.left + r.width / 2 - L.left) / k - w / 2, 4, Math.max(4, o.layer.offsetWidth - w - 4));
    const y = side === 'top'
      ? (Math.min(r.top, c ? c.top : Infinity) - L.top) / k - h - gap
      : (Math.max(r.bottom, c ? c.bottom : -Infinity) - L.top) / k + gap;
    el.style.left = `${x.toFixed(1)}px`;
    el.style.top = `${y.toFixed(1)}px`;
  };

  const show = (a: HTMLElement) => {
    clearTimeout(timer);
    const t = text(a);
    if (!t) { hide(); return; }
    if (shown && cur === a) return;
    if (cur && cur !== a) cur.removeAttribute('aria-describedby');
    cur = a;
    el.textContent = t;
    // name already announced via the item's label → tooltip is visual only; otherwise describe the item
    const label = (a.getAttribute('aria-label') || a.textContent || '').trim();
    if (t === label) el.setAttribute('aria-hidden', 'true'); else { el.removeAttribute('aria-hidden'); a.setAttribute('aria-describedby', id); }
    place(a);
    if (!morph) morph = new AnchoredMorph({ anchor: a, surface: el }, { manual: true, scrollBehavior: 'follow', onAnchorHidden: 'hide' }); // in-flow layer: follows natively; hides with its anchor
    morph.anchor = a;
    shown = true;
    morph.enter();
  };

  const hide = () => {
    clearTimeout(timer);
    if (!shown) return;
    shown = false;
    cur?.removeAttribute('aria-describedby');
    morph ? morph.exit() : (el.style.visibility = 'hidden');
  };

  const itemOf = (n: EventTarget | null) => (n instanceof Element ? (n.closest(sel) as HTMLElement | null) : null);
  const onOver = (e: PointerEvent) => {
    const it = itemOf(e.target);
    if (!it || !o.container.contains(it)) return;
    if (shown) show(it); else { clearTimeout(timer); timer = window.setTimeout(() => show(it), delay); }
  };
  const onLeave = () => hide();
  const onFocusIn = (e: FocusEvent) => { const it = itemOf(e.target); if (it && (e.target as Element).matches(':focus-visible')) show(it); };
  const onFocusOut = (e: FocusEvent) => { if (!o.container.contains(e.relatedTarget as Node)) hide(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
  const onDown = () => hide();

  o.container.addEventListener('pointerover', onOver);
  o.container.addEventListener('pointerleave', onLeave);
  o.container.addEventListener('pointerdown', onDown);
  o.container.addEventListener('focusin', onFocusIn);
  o.container.addEventListener('focusout', onFocusOut);
  o.container.addEventListener('keydown', onKey);

  return {
    el,
    show,
    hide,
    destroy: () => {
      clearTimeout(timer);
      morph?.destroy();
      o.container.removeEventListener('pointerover', onOver);
      o.container.removeEventListener('pointerleave', onLeave);
      o.container.removeEventListener('pointerdown', onDown);
      o.container.removeEventListener('focusin', onFocusIn);
      o.container.removeEventListener('focusout', onFocusOut);
      o.container.removeEventListener('keydown', onKey);
      cur?.removeAttribute('aria-describedby');
      el.remove();
    },
  };
}
