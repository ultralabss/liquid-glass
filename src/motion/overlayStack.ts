/**
 * Open-overlay stack (shared by every ULAnchoredSurface). Only the TOP overlay handles Escape, owns the focus trap, and
 * treats a pointerdown inside a LATER overlay (its submenu, a popover or select opened from inside a modal) as inside.
 */
const stack: { el: HTMLElement; parts: HTMLElement[]; modal: boolean }[] = [];
/** Register an open overlay; `parts` (its scrim) count as inside it. A modal marks the layer below as covered. Returns the release. */
export function pushOverlay(el: HTMLElement, parts: (HTMLElement | null | undefined)[] = [], modal = false): () => void {
  const entry = { el, parts: parts.filter(Boolean) as HTMLElement[], modal };
  const below = stack[stack.length - 1];
  if (modal && below?.modal) below.el.setAttribute('data-ul-covered', '');
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry); if (i < 0) return;
    stack.splice(i, 1);
    const b = stack[i - 1]; if (b && !stack.slice(i).some((s) => s.modal)) b.el.removeAttribute('data-ul-covered');
  };
}
export const isTopOverlay = (el: HTMLElement | null) => !!el && stack[stack.length - 1]?.el === el;
export const overlayDepth = () => stack.length;
/** Is `t` inside an overlay opened after `el` (a descendant layer, or its scrim)? */
export function inLaterOverlay(el: HTMLElement, t: Node | null): boolean {
  if (!t) return false;
  const i = stack.findIndex((s) => s.el === el);
  for (let j = i + 1; j < stack.length; j++) if (stack[j].el.contains(t) || stack[j].parts.some((p) => p.contains(t))) return true;
  // tooltips, lens layers and non-modal top layers (toast stack) are never "outside"
  return t instanceof Element && !!t.closest('[data-ul-tooltip],[data-ul-lens-layer],[data-ul-nonmodal-layer]');
}

/* ---------- focus trap ---------- */
const FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[inert],[hidden]') && el.getClientRects().length > 0);
}
export interface TrapOptions { initial?: HTMLElement | string | null; returnTo?: HTMLElement | null }
/** Traps Tab inside `root` while it is the top overlay; focuses the initial element; returns focus on release. */
export function trapFocus(root: HTMLElement, o: TrapOptions = {}): () => void {
  const prev = o.returnTo ?? (document.activeElement as HTMLElement | null);
  const pick = () => {
    const i = o.initial;
    const el = typeof i === 'string' ? root.querySelector<HTMLElement>(i) : i;
    return el ?? root.querySelector<HTMLElement>('[data-autofocus]') ?? focusables(root)[0] ?? root;
  };
  if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
  const t = requestAnimationFrame(() => pick().focus({ preventScroll: true }));
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !isTopOverlay(root)) return;
    const f = focusables(root);
    if (!f.length) { e.preventDefault(); root.focus({ preventScroll: true }); return; }
    const a = document.activeElement, first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (a === first || a === root || !root.contains(a))) { e.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!e.shiftKey && (a === last || !root.contains(a))) { e.preventDefault(); first.focus({ preventScroll: true }); }
  };
  const onIn = (e: FocusEvent) => {
    if (!isTopOverlay(root)) return;
    const t2 = e.target as Node;
    if (root.contains(t2) || inLaterOverlay(root, t2)) return;
    (focusables(root)[0] ?? root).focus({ preventScroll: true });
  };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('focusin', onIn, true);
  return () => {
    cancelAnimationFrame(t);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('focusin', onIn, true);
    const a = document.activeElement;
    if (prev && prev.isConnected && (!a || a === document.body || root.contains(a))) prev.focus({ preventScroll: true });
  };
}
