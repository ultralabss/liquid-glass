/**
 * Floating nav indicator: ONE flattened liquid-glass lens that glides between
 * nav items following hover and keyboard focus, and materializes out when the
 * pointer leaves. Spring slide with squash & stretch along the travel axis and
 * a tiny overshoot; every move starts from the current pose (interruptible).
 * The lens lives inside the island pill, so it is flattened glass (never
 * samples the backdrop): tint, rim, pointer light, accent-tinted rim.
 * Framework-agnostic; ULIsland and the landing SiteHeader both use it.
 */
import { getMorphTimeScale } from '../../motion/anchoredMorph.ts';
import { zetaFor } from '../../motion/lensBubble.ts';

export interface NavIndicatorOptions {
  /** Positioned ancestor the lens is laid out in (usually the <nav>). */
  container: HTMLElement;
  /** The lens element (absolute, pointer-events: none, below the item text). */
  lens: HTMLElement;
  /** Selector for indicator targets inside `container`. Default: a, button. */
  items?: string;
  /** Element to rest on when nothing is hovered/focused (e.g. current page). Return null to hide. */
  rest?: () => HTMLElement | null;
  /**
   * Large / live lists (table rows): watch only `root`'s direct children (no subtree, no per-item ResizeObserver).
   * Cell text updates then never re-measure; inserts / removes do.
   */
  shallow?: HTMLElement;
}

export interface NavIndicator {
  update(): void;
  destroy(): void;
  /**
   * Layout-follow mode (container width / height morphs, e.g. a collapsing sidebar): the lens is RIGID and copies the
   * target item's rect every frame (no spring, stretch, overshoot or lag). Turning it off hands over with zero velocity
   * from the exact current rect, so there is no visible jump between modes.
   */
  setLayoutFollow(on: boolean): void;
}

interface Axis { x: number; v: number; t: number }
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function createNavIndicator(o: NavIndicatorOptions): NavIndicator {
  const { container, lens } = o;
  const sel = o.items ?? 'a, button';
  const X: Axis = { x: 0, v: 0, t: 0 }, Y: Axis = { x: 0, v: 0, t: 0 }, W: Axis = { x: 0, v: 0, t: 0 }, H: Axis = { x: 0, v: 0, t: 0 }, A: Axis = { x: 0, v: 0, t: 0 };
  let target: HTMLElement | null = null, hover: HTMLElement | null = null, focus: HTMLElement | null = null;
  let raf = 0, last = 0, dead = false, visible = false, follow = false;
  const cs = () => getComputedStyle(container);
  const num = (k: string, f: number) => { const v = parseFloat(cs().getPropertyValue(k)); return Number.isFinite(v) ? v : f; };

  const measure = (el: HTMLElement) => {
    const c = container.getBoundingClientRect(), r = el.getBoundingClientRect();
    const k = container.offsetWidth ? c.width / container.offsetWidth : 1 || 1;
    // the lens is absolute in the container's SCROLLED content box: add the scroll offset (scrolling sidebar / list)
    return { x: (r.left - c.left) / k + container.scrollLeft, y: (r.top - c.top) / k + container.scrollTop, w: r.width / k, h: r.height / k };
  };

  const retarget = (jump = false) => {
    const next = focus ?? hover ?? o.rest?.() ?? null;
    target = next && container.contains(next) ? next : null;
    if (!target) { A.t = 0; kick(); return; }
    const m = measure(target);
    const appear = !visible || A.x < 0.05 || jump || reduced();
    X.t = m.x; Y.t = m.y; W.t = m.w; H.t = m.h; A.t = 1;
    if (appear) { X.x = m.x; Y.x = m.y; W.x = m.w; H.x = m.h; X.v = Y.v = W.v = H.v = 0; }
    visible = true;
    if (follow) { cancelAnimationFrame(raf); raf = 0; step(performance.now()); return; } // layout-follow: write in the same frame the item moved
    kick();
  };

  const step = (now: number) => {
    raf = 0;
    if (dead) return;
    const ts = getMorphTimeScale();
    const dt = Math.min(0.032, last ? (now - last) / 1000 : 1 / 60) / ts;
    last = now;
    const rm = reduced() || follow;
    if (follow && target) { const m = measure(target); X.t = m.x; Y.t = m.y; W.t = m.w; H.t = m.h; } // the item moves with the container: re-read its rect every frame
    // the shared elastic overshoot spring (same ζ as the lens bubble: --ul-lens-overshoot over --ul-lens-scale − 1);
    // the hover indicator stays a flattened lens: no bubble, no drag
    const z = zetaFor(clamp(num('--ul-lens-overshoot', 0.04) / Math.max(0.01, num('--ul-lens-scale', 1.3) - 1), 0, 0.6));
    const k = 380, c = 2 * z * Math.sqrt(k);
    for (const a of [X, Y, W, H]) {
      if (rm) { a.x = a.t; a.v = 0; continue; }
      a.v += (-k * (a.x - a.t) - c * a.v) * dt; a.x += a.v * dt;
    }
    const ka = 260, ca = 2 * Math.sqrt(ka);
    A.v += (-ka * (A.x - A.t) - ca * A.v) * dt; A.x = clamp(A.x + A.v * dt, 0, 1);
    // squash & stretch along the travel axis, scaled by the elasticity + pop-stretch tokens
    const maxS = num('--ul-pop-stretch', 0.06) * clamp(num('--ul-elasticity', 0.6) / 0.6, 0, 1.5);
    const sx = rm ? 0 : clamp(Math.abs(X.v) / 2400, 0, maxS);
    const sy = rm ? 0 : clamp(Math.abs(Y.v) / 2400, 0, maxS);
    const w = W.x * (1 + sx - sy * 0.5), h = H.x * (1 + sy - sx * 0.5);
    lens.style.width = `${w.toFixed(2)}px`;
    lens.style.height = `${h.toFixed(2)}px`;
    lens.style.transform = `translate(${(X.x - (w - W.x) / 2).toFixed(2)}px, ${(Y.x - (h - H.x) / 2).toFixed(2)}px) scale(${(0.94 + 0.06 * A.x).toFixed(4)})`;
    lens.style.opacity = A.x.toFixed(3);
    lens.style.setProperty('--ul-rim', A.x.toFixed(3));
    const moving = [X, Y, W, H].some((a) => Math.abs(a.x - a.t) > 0.1 || Math.abs(a.v) > 1) || Math.abs(A.x - A.t) > 0.002;
    if (moving || follow) raf = requestAnimationFrame(step);
    else { last = 0; if (A.t === 0) visible = false; }
  };
  const kick = () => { if (!raf && !dead) raf = requestAnimationFrame(step); };

  const itemOf = (n: EventTarget | null) => (n instanceof Element ? (n.closest(sel) as HTMLElement | null) : null);
  const onOver = (e: PointerEvent) => { const it = itemOf(e.target); if (it && container.contains(it) && it !== hover) { hover = it; retarget(); } };
  const onLeave = () => { hover = null; retarget(); };
  const onFocusIn = (e: FocusEvent) => { const it = itemOf(e.target); if (it && (e.target as Element).matches(':focus-visible')) { focus = it; retarget(); } };
  const onFocusOut = (e: FocusEvent) => { if (!container.contains(e.relatedTarget as Node)) { focus = null; retarget(); } };

  container.addEventListener('pointerover', onOver);
  container.addEventListener('pointerleave', onLeave);
  container.addEventListener('focusin', onFocusIn);
  container.addEventListener('focusout', onFocusOut);
  const remeasure = () => { if (target) { if (!target.isConnected) { hover = focus = null; } retarget(); } else if (o.rest?.()) retarget(true); };
  const ro = new ResizeObserver(remeasure);
  ro.observe(container);
  const mo = new MutationObserver(() => { if (o.shallow) { remeasure(); return; } ro.disconnect(); ro.observe(container); container.querySelectorAll(sel).forEach((el) => ro.observe(el)); remeasure(); });
  if (o.shallow) mo.observe(o.shallow, { childList: true });
  else { mo.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current'] }); container.querySelectorAll(sel).forEach((el) => ro.observe(el)); }
  (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(remeasure);
  lens.style.opacity = '0';
  if (o.rest?.()) retarget(true);

  return {
    setLayoutFollow: (on: boolean) => { if (follow === on) return; follow = on; for (const a of [X, Y, W, H]) a.v = 0; if (on) kick(); },
    update: () => remeasure(),
    destroy: () => {
      dead = true; cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect();
      container.removeEventListener('pointerover', onOver);
      container.removeEventListener('pointerleave', onLeave);
      container.removeEventListener('focusin', onFocusIn);
      container.removeEventListener('focusout', onFocusOut);
    },
  };
}
