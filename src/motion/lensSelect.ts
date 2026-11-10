/**
 * Press-and-hold / drag selection with the shared lens bubble, for lists with one selected item and a resting indicator
 * (ULSegmentedControl, ULTabs). Framework-free; one implementation for both.
 *
 * Press anywhere in the list: the bubble appears on the indicator (pressed the selected item) or glides to the pressed
 * item. While held it follows the pointer along the axis (rubber band past the first / last item, elastic two-edge
 * model); the item under the bubble centre gets [data-ul-preview]. Release: the bubble settles on the nearest item to
 * its centre (+ flick projection) and THAT item is selected (onSelect, only on release). A press without movement
 * selects the pressed item through the same path. Esc / pointercancel restore. Keyboard / programmatic changes call
 * travel(from, to). Touch: the list keeps touch-action pan-y (horizontal) / pan-x (vertical) so the page still scrolls.
 */
import { LensBubble, rubberBand } from './lensBubble.ts';

export interface LensSelectOptions {
  list: HTMLElement;
  axis?: 'x' | 'y';
  /** Enabled items in visual order. */
  items: () => HTMLElement[];
  selected: () => HTMLElement | null;
  /** Resting indicator(s) hidden while the bubble is visible. */
  indicator?: () => HTMLElement | null;
  onSelect: (item: HTMLElement) => void;
  enabled?: () => boolean;
}
export interface LensSelect { bubble: LensBubble; travel(from: HTMLElement | null, to: HTMLElement | null, kind?: 'click' | 'key'): void; syncRest(): void; consumeClick(): boolean; destroy(): void }

interface Box { el: HTMLElement; c: number; w: number; cc: number; h: number; r: number }

export function createLensSelect(o: LensSelectOptions): LensSelect {
  const { list } = o;
  const vert = o.axis === 'y';
  let boxes: Box[] = [];
  let wrap = { lo: 0, hi: 0, cross: 0, r: 0 };
  const cur = { c: 0 };
  let drag: null | { id: number; p0: number; pressed: Box | null; moved: boolean; lp: number; lt: number; v: number } = null;
  let clickEaten = 0; // time of the last pointer-path release
  let preview: HTMLElement | null = null;

  const measure = () => {
    const lb = list.getBoundingClientRect(), k = list.offsetWidth ? lb.width / list.offsetWidth : 1;
    boxes = o.items().map((el) => {
      const b = el.getBoundingClientRect();
      const x = (b.left - lb.left) / k, y = (b.top - lb.top) / k, w = b.width / k, h = b.height / k;
      const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, Math.min(w, h) / 2);
      return vert ? { el, c: y + h / 2, w: h, cc: x + w / 2, h: w, r } : { el, c: x + w / 2, w, cc: y + h / 2, h, r };
    });
    const r = parseFloat(getComputedStyle(list).borderTopLeftRadius) || 0;
    wrap = { lo: 0, hi: vert ? list.offsetHeight : list.offsetWidth, cross: vert ? list.offsetWidth : list.offsetHeight, r: Math.min(r, (vert ? list.offsetWidth : list.offsetHeight) / 2) };
  };
  const boxOf = (el: HTMLElement | null) => boxes.find((b) => b.el === el) ?? null;
  const nearest = (c: number) => boxes.reduce<Box | null>((best, b) => (!best || Math.abs(b.c - c) < Math.abs(best.c - c) ? b : best), null);
  /** Rest size at a position: interpolated between neighbouring items (tabs of different widths). */
  const restAt = (c: number) => {
    if (!boxes.length) return { w: 1, h: 1, r: 0, cc: 0 };
    if (c <= boxes[0].c) return boxes[0];
    const last = boxes[boxes.length - 1];
    if (c >= last.c) return last;
    for (let i = 0; i < boxes.length - 1; i++) {
      const a = boxes[i], b = boxes[i + 1];
      if (c >= a.c && c <= b.c) { const t = (c - a.c) / (b.c - a.c || 1); return { w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t, r: a.r + (b.r - a.r) * t, cc: a.cc + (b.cc - a.cc) * t }; }
    }
    return last;
  };
  const tok = (k: string, f: number) => { const v = parseFloat(getComputedStyle(list).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };

  // ONE indicator: the bubble is a persistent element in the list (flat capsule at rest, bubble when active)
  const bubble = new LensBubble({
    kind: 'tabs', axis: vert ? 'y' : 'x', host: list, mount: 'host', follow: true, earlyShrink: true,
    geometry: () => { const r = restAt(cur.c); return { c: cur.c, cc: r.cc, w: r.w, h: r.h, r: r.r, wrap }; },
    geometryAt: (c) => { const r = restAt(c); return { cc: r.cc, w: r.w, h: r.h, r: r.r }; },
    busy: () => !!drag,
    onLive: (live) => list.toggleAttribute('data-lens-live', live),
  });
  const syncRest = () => { measure(); const s = boxOf(o.selected()); if (s) { cur.c = s.c; bubble.rest(); } };
  const ro = new ResizeObserver(() => { if (!bubble.active) syncRest(); });
  ro.observe(list);
  requestAnimationFrame(syncRest);
  (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(() => { if (!bubble.active) syncRest(); });
  const on = () => (o.enabled ? o.enabled() : true);
  const setPreview = (el: HTMLElement | null) => {
    if (preview === el) return;
    preview?.removeAttribute('data-ul-preview');
    preview = el;
    el?.setAttribute('data-ul-preview', '');
  };
  const local = (e: PointerEvent) => { const lb = list.getBoundingClientRect(); return vert ? e.clientY - lb.top : e.clientX - lb.left; };

  const end = (cancel: boolean) => {
    const d = drag;
    if (!d) return;
    drag = null;
    let pick: Box | null;
    if (cancel) pick = boxOf(o.selected());
    else if (!d.moved) pick = d.pressed;
    else { const idle = performance.now() - d.lt, v0 = idle > 40 ? 0 : d.v * (1 - idle / 40), v = Math.abs(v0) < 0.15 ? 0 : v0; pick = nearest(cur.c + v * tok('--ul-lens-flick', 140)); }
    clickEaten = performance.now();
    setTimeout(() => { clickEaten = 0; }, 0); // only the click of THIS release is swallowed
    if (pick) cur.c = pick.c;
    setPreview(null);
    if (!cancel && pick && pick.el !== o.selected()) o.onSelect(pick.el);
    bubble.release();
    try { list.releasePointerCapture(d.id); } catch { /* not captured */ }
    removeEventListener('keydown', onEsc, true);
  };
  const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && drag) { e.preventDefault(); e.stopPropagation(); end(true); } };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || !on()) return;
    const item = (e.target as Element).closest?.('[data-ul-lens-item]') as HTMLElement | null;
    if (!item || !list.contains(item) || (item as HTMLButtonElement).disabled) return;
    measure();
    const pressed = boxOf(item), sel = boxOf(o.selected());
    if (!pressed) return;
    // inflate in place on the indicator; pressing another item glides there (no teleport)
    if (!bubble.active) cur.c = (sel ?? pressed).c;
    drag = { id: e.pointerId, p0: local(e), pressed, moved: false, lp: vert ? e.clientY : e.clientX, lt: performance.now(), v: 0 };
    clickEaten = 0;
    bubble.press();
    if (pressed.c !== cur.c) bubble.glide(tok('--ul-tabs-press-glide', 400));
    cur.c = pressed.c;
    try { list.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    addEventListener('keydown', onEsc, true);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    const p = local(e);
    if (!d.moved && Math.abs(p - d.p0) > 4) { d.moved = true; bubble.glide(0); } // dragging: the follow spring takes over from the press glide
    const q = vert ? e.clientY : e.clientX, now = performance.now(), dt = Math.max(1, now - d.lt);
    d.v = d.v * 0.4 + ((q - d.lp) / dt) * 0.6; d.lp = q; d.lt = now;
    if (!d.moved || !boxes.length) return;
    cur.c = rubberBand(p, boxes[0].c, boxes[boxes.length - 1].c, tok('--ul-lens-rubber', 0.55), boxes[0].w);
    setPreview(nearest(cur.c)?.el ?? null);
  };
  const onUp = (e: PointerEvent) => { if (drag && e.pointerId === drag.id) end(false); };
  const onCancel = () => end(true);
  const onLost = () => { if (drag) end(false); };
  const onKeyReset = () => { clickEaten = 0; }; // a keyboard click is never a pointer-path click
  list.addEventListener('keydown', onKeyReset, true);
  list.addEventListener('pointerdown', onDown);
  list.addEventListener('pointermove', onMove);
  list.addEventListener('pointerup', onUp);
  list.addEventListener('pointercancel', onCancel);
  list.addEventListener('lostpointercapture', onLost);

  return {
    bubble,
    travel(from, to, kind = 'click') {
      if (drag || !to) return;
      if (!on()) { syncRest(); return; }
      measure();
      const a = boxOf(from), b = boxOf(to);
      if (!b) return;
      if (!bubble.active && a) cur.c = a.c;
      bubble.toggle(kind);
      cur.c = b.c;
    },
    syncRest,
    /** Items call this in onClick: true = the pointer path already handled (selected on release). */
    consumeClick() { const v = clickEaten && performance.now() - clickEaten < 400; clickEaten = 0; return !!v; },
    destroy() {
      bubble.destroy();
      ro.disconnect();
      list.removeEventListener('keydown', onKeyReset, true);
      list.removeEventListener('pointerdown', onDown);
      list.removeEventListener('pointermove', onMove);
      list.removeEventListener('pointerup', onUp);
      list.removeEventListener('pointercancel', onCancel);
      list.removeEventListener('lostpointercapture', onLost);
      removeEventListener('keydown', onEsc, true);
    },
  };
}
