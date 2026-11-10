/**
 * ULColumnsMenu drag reorder (behaviour only; the rows are ULMenu rows, the handle sits in the row's icon slot).
 * - Visual follow = the slider rule: critically damped follow, tau = --ul-slider-follow, ONE CSS variable write per frame
 *   (--ul-cols-drag-y on the dragged row). No React state per pointermove; the order is committed once on drop.
 * - Other rows shift with FLIP on the shared smooth spring (--ul-ease-smooth / --ul-ease-smooth-settle); interruptible.
 * - Auto-scroll near the scroller's edges, Esc cancels and restores, touch only on the handle (touch-action: none there).
 * - Announces the new position through the one polite live region.
 */
import { announce } from '../actions/core.tsx';
import { isMorphReduced } from '../../motion/anchoredMorph.ts';

export interface ColumnsDragOptions {
  keys: string[];
  onCommit: (order: string[]) => void;
  moved: (key: string, pos: number, total: number) => string;
  cancelled: string;
}
/** Test hook: pointermoves seen, frames written, commits. */
export const columnsDragStats = { moves: 0, frames: 0, commits: 0, writes: 0 };
/** Move one key from index a to index b. */
export function reorderKeys(keys: string[], a: number, b: number): string[] { const n = keys.slice(); const [k] = n.splice(a, 1); n.splice(Math.max(0, Math.min(n.length, b)), 0, k); return n; }
/** Target index for the dragged row (index `from`) whose centre is at y, given the rows' resting centres. */
export function dragSlot(mids: number[], from: number, y: number): number { let t = 0; for (let i = 0; i < mids.length; i++) if (i !== from && mids[i] < y) t++; return t; }

const num = (el: Element, v: string, d: number) => { const x = parseFloat(getComputedStyle(el).getPropertyValue(v)); return Number.isFinite(x) ? x : d; };
const curY = (el: HTMLElement) => { const m = getComputedStyle(el).transform; if (!m || m === 'none') return 0; const p = m.match(/matrix(3d)?\(([^)]+)\)/); if (!p) return 0; const v = p[2].split(',').map(Number); return p[1] ? v[13] : v[5]; };
const anims = new WeakMap<HTMLElement, Animation>();
function slide(el: HTMLElement, from: number, to: number) {
  anims.get(el)?.cancel();
  el.style.transform = to ? `translateY(${to}px)` : '';
  if (from === to) return;
  const reduced = isMorphReduced();
  const a = el.animate([{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }], {
    duration: reduced ? 150 : num(el, '--ul-ease-smooth-settle', 785), easing: reduced ? 'linear' : getComputedStyle(el).getPropertyValue('--ul-ease-smooth').trim() || 'ease-out' });
  anims.set(el, a); a.onfinish = () => { if (anims.get(el) === a) anims.delete(el); };
}
function scrollerOf(el: HTMLElement): HTMLElement | null { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p; if (p.classList.contains('ul-anchored')) break; } return null; }

let active = false;
export function isColumnsDragging() { return active; }
export function startColumnsDrag(e: { currentTarget: EventTarget; clientY: number; pointerId: number; pointerType: string; button: number; preventDefault(): void; stopPropagation(): void }, o: ColumnsDragOptions) {
  if (active || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const grip = e.currentTarget as HTMLElement, row = grip.closest<HTMLElement>('[data-menu-item]'), list = row?.parentElement; if (!row || !list) return;
  const grips = [...list.querySelectorAll<HTMLElement>('.ul-cols-grip')], rows = grips.map((g) => g.closest<HTMLElement>('[data-menu-item]')!), keys = grips.map((g) => g.dataset.colsKey!);
  const from = rows.indexOf(row); if (from < 0) return;
  e.preventDefault(); e.stopPropagation(); active = true;
  try { grip.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  rows.forEach((r) => { anims.get(r)?.cancel(); r.style.transform = ''; });
  const rects = rows.map((r) => r.getBoundingClientRect()), tops = rects.map((r) => r.top), mids = rects.map((r) => r.top + r.height / 2);
  const step = rows.length > 1 ? (tops[Math.min(rows.length - 1, from + 1)] - tops[Math.max(0, from - 1)]) / (from > 0 && from < rows.length - 1 ? 2 : 1) : rects[from].height;
  const sc = scrollerOf(row), s0 = sc?.scrollTop ?? 0;
  const st = { y0: e.clientY, py: e.clientY, x: 0, target: from, shifts: rows.map(() => 0), raf: 0, last: performance.now(), id: e.pointerId, done: false };
  row.setAttribute('data-cols-dragging', ''); list.setAttribute('data-cols-drag', '');
  const frame = (now: number) => {
    st.raf = 0; if (st.done) return; columnsDragStats.frames++;
    if (sc) { const r = sc.getBoundingClientRect(), edge = Math.min(40, r.height / 4), sp = 14; if (st.py < r.top + edge) sc.scrollTop -= sp * (1 - (st.py - r.top) / edge); else if (st.py > r.bottom - edge) sc.scrollTop += sp * (1 - (r.bottom - st.py) / edge); }
    const sd = (sc?.scrollTop ?? 0) - s0;
    const raw = Math.max(tops[0] - tops[from], Math.min(tops[tops.length - 1] - tops[from], st.py - st.y0 + sd));
    const tau = num(row, '--ul-slider-follow', 75), a = isMorphReduced() ? 1 : 1 - Math.exp(-Math.min(48, now - st.last) / Math.max(1, tau)); st.last = now;
    st.x += (raw - st.x) * a; row.style.setProperty('--ul-cols-drag-y', `${st.x.toFixed(2)}px`); columnsDragStats.writes++;
    const t = dragSlot(mids, from, mids[from] + st.x);
    if (t !== st.target) {
      st.target = t;
      rows.forEach((r, i) => { if (i === from) return; const want = from < t && i > from && i <= t ? -step : from > t && i >= t && i < from ? step : 0; if (want !== st.shifts[i]) { slide(r, curY(r), want); st.shifts[i] = want; } });
    }
    const edgeScroll = sc && (st.py < sc.getBoundingClientRect().top + 40 || st.py > sc.getBoundingClientRect().bottom - 40);
    if (Math.abs(raw - st.x) > 0.05 || edgeScroll) st.raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!st.raf) st.raf = requestAnimationFrame(frame); };
  const move = (ev: PointerEvent) => { if (ev.pointerId !== st.id) return; columnsDragStats.moves++; st.py = ev.clientY; kick(); };
  const up = (ev: PointerEvent) => { if (ev.pointerId === st.id) end(ev.type === 'pointerup'); };
  const key = (ev: KeyboardEvent) => { if (ev.key !== 'Escape') return; ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); end(false); announce(o.cancelled); };
  const end = (commit: boolean) => {
    if (st.done) return; st.done = true; active = false; cancelAnimationFrame(st.raf);
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); document.removeEventListener('keydown', key, true);
    try { grip.releasePointerCapture(st.id); } catch { /* not captured */ }
    const seen = new Map(rows.map((r, i) => [keys[i], r.getBoundingClientRect().top]));
    const next = commit && st.target !== from ? reorderKeys(keys, from, st.target) : null;
    if (next) { o.onCommit(next); columnsDragStats.commits++; announce(o.moved(keys[from], st.target + 1, keys.length)); }
    // FLIP after the re-render (React flushes before the next frame): every row from where it was seen to its slot
    requestAnimationFrame(() => {
      const now = [...list.querySelectorAll<HTMLElement>('.ul-cols-grip')].map((g) => g.closest<HTMLElement>('[data-menu-item]')!);
      now.forEach((r) => { anims.get(r)?.cancel(); r.style.transform = ''; r.removeAttribute('data-cols-dragging'); r.style.removeProperty('--ul-cols-drag-y'); });
      list.removeAttribute('data-cols-drag');
      now.forEach((r) => { const k = r.querySelector<HTMLElement>('.ul-cols-grip')?.dataset.colsKey; const was = k != null ? seen.get(k) : undefined; if (was == null) return; const d = was - r.getBoundingClientRect().top; if (Math.abs(d) > 0.5) slide(r, d, 0); });
    });
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); document.addEventListener('keydown', key, true);
}
