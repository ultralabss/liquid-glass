/**
 * Shared top-layer helper (popover="manual"; fallback max z-index). Order of calls = paint order.
 * Modal (covered) surfaces lift scrim → goo → surface. Non-modal layers that must stay above every modal
 * (the toast stack) register with keepOnTop(): they are re-promoted after any later lift, so a modal opened
 * AFTER a toast still paints below it. Non-modal layers carry data-ul-nonmodal-layer: never "outside" for a
 * modal's outside-click / focus trap, never focused by us, never dimmed by a scrim (they are above it).
 */
export const hasPopoverApi = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
type PopEl = HTMLElement & { showPopover(): void; hidePopover(): void };
const onTop = new Set<HTMLElement>();
let queued = false;

function show(n: HTMLElement) {
  n.setAttribute('data-ul-top-layer', '');
  if (!hasPopoverApi) return;
  if (!n.hasAttribute('popover')) n.setAttribute('popover', 'manual');
  try { if (!n.matches(':popover-open')) (n as PopEl).showPopover(); } catch { /* detached */ }
}
/** Re-insert keep-on-top layers at the end of the top layer (hide + show; manual popovers never move focus). */
function repromote() {
  queued = false;
  if ((window as Window & { __ulGlassDebug?: { noTopLayer?: boolean } }).__ulGlassDebug?.noTopLayer) return; // glass debug switch
  onTop.forEach((n) => {
    if (!n.isConnected || !hasPopoverApi) return;
    // hidePopover drops focus to <body> when it sits inside the layer: keep it where it was
    const f = document.activeElement as HTMLElement | null, inside = !!f && n.contains(f);
    try { if (n.matches(':popover-open')) (n as PopEl).hidePopover(); (n as PopEl).showPopover(); } catch { /* detached */ }
    if (inside && f && f.isConnected && document.activeElement !== f) f.focus({ preventScroll: true });
  });
  if (!hasPopoverApi) onTop.forEach((n) => n.style.setProperty('z-index', String(2147483000 + 10)));
}
export function toTopLayer(n: HTMLElement) {
  if (n.closest('[data-ul-nonmodal-layer]') && !onTop.has(n)) return; // children of a keep-on-top layer ride with it
  show(n);
  if (!onTop.has(n) && onTop.size && !queued) { queued = true; queueMicrotask(repromote); }
}
/** Register a non-modal layer that stays above every modal. Returns the release. */
export function keepOnTop(n: HTMLElement): () => void {
  n.setAttribute('data-ul-nonmodal-layer', '');
  onTop.add(n); show(n);
  return () => { onTop.delete(n); try { if (hasPopoverApi && n.matches(':popover-open')) (n as PopEl).hidePopover(); } catch { /* */ } n.removeAttribute('data-ul-top-layer'); };
}
/** Test hook: top-layer order of the open popovers we manage (last = topmost). */
export const topLayerOrder = () => [...document.querySelectorAll<HTMLElement>('[data-ul-top-layer]')];
