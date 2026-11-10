/**
 * Elastic anchor-based enter/exit for every anchored overlay (popover, menu,
 * context menu, select/combobox list, tooltip, pickers, toast-from-trigger,
 * sheet-from-button). Components must not implement their own enter/exit.
 *
 * One timeline τ (ms on the enter clock). Enter plays τ → end; exit plays the
 * SAME timeline backwards at exit/enter speed. Interrupting is just reversing
 * direction from the current τ, so geometry and refraction continue from
 * where they are.
 *
 * Layering (works with portals): the surface starts exactly on the anchor's
 * rect + radius and, for the whole morph, is clipped with an even-odd hole at
 * the anchor's CURRENT rect (clip-path path(evenodd, …), keyframed with the pose).
 * The surface is therefore never painted or hit-tested over the anchor, so it
 * reads as sliding out from BEHIND it, wherever the surface lives in the DOM and
 * whatever stacking context traps the anchor. No z-index is changed. The goo
 * helper layer gets the same hole. Hole = anchor, or its nearest
 * [data-ul-morph-occluder] ancestor (e.g. the island pill around a nav item).
 * Translation leads, size follows by --ul-pop-lag. Content fades + slides in
 * once the surface has cleared the anchor (opacity + translate, never blur).
 *
 * Each run dispatches a bubbling "ul:morph" CustomEvent on the surface
 * (detail: { phase: 'enter'|'exit', state: 'start'|'end'|'interrupted', duration, reduced })
 * for tests and instrumentation.
 */
import { createSpring, springs, type Spring } from './spring.ts';
import { computePlacement, type Align, type Side } from './placement.ts';
import { ensureGooFilter } from './goo.ts';
import { measureGlassNow, setGlassMaterialize, setGlassGeometry, releaseGlassTier, decideGlassTier } from '../glass/engine.ts';

export interface MorphTokens {
  enter: number; exit: number; overshoot: number; stretch: number; goo: boolean; stagger: number; offset: number; gooOpacity: number;
  lag: number;
}
export interface MorphParts {
  anchor: HTMLElement; surface: HTMLElement;
  stage?: HTMLElement | null; goo?: HTMLElement | null;
  /** Optional soft scrim (modals, drawers): its opacity follows the same timeline (never glass). */
  scrim?: HTMLElement | null;
}
export interface MorphOptions {
  side?: Side; align?: Align; offset?: number;
  /** The surface is already laid out at its final rect by its owner (no placement); side is derived from geometry. Works inside scaled ancestors. */
  manual?: boolean;
  /**
   * Where the surface settles. anchored (default): beside the anchor (computePlacement). center: viewport centre (modal,
   * command palette). top | bottom | left | right: pinned to that viewport edge (sheets, drawers, mobile bottom sheet).
   * The morph always starts on the anchor (trigger, edge sentinel or pointer point), so the motion is the same.
   */
  layout?: 'anchored' | 'center' | 'top' | 'bottom' | 'left' | 'right';
  /** Keep the anchor visible + clickable through an even-odd hole while morphing (default true). false: the surface is above the anchor from frame one (overlay opened from a button inside another dialog surface). */
  anchorOnTop?: boolean;
  /** Covered (modal) surface: owner put it in the top layer; never a hole; the first map is generated after the first frame. */
  coverAnchor?: boolean;
  /** Placement overlaps the anchor with this inset (px) so the surface covers it in every frame (non-modal covered popovers). */
  overlap?: number;
  /**
   * Page scroll while open. lock: page scroll locked (menus; scrolling inside the surface still works). follow: the surface
   * tracks the anchor's current rect every frame (same frame, transform only, flip re-evaluated). fixed: stays where it
   * opened. close: any scroll outside the surface requests close. Default follow.
   */
  scrollBehavior?: 'lock' | 'follow' | 'fixed' | 'close';
  /** Anchor fully out of view: keep (default) | hide (visually hidden, fades back) | close. */
  onAnchorHidden?: 'keep' | 'hide' | 'close';
  /** Called for scrollBehavior "close" and onAnchorHidden "close". */
  onRequestClose?: () => void;
}

/* ---------- page scroll lock (shared, counted) ---------- */
const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const lockState = { n: 0, x: 0, y: 0, sbw: 0, prev: { overflow: '', paddingRight: '', overscroll: '' }, owners: new Set<HTMLElement>(), ty: 0, tx: 0 };
const ownerOf = (t: EventTarget | null) => { if (!(t instanceof Node)) return null; for (const o of lockState.owners) if (o.contains(t)) return o; return null; };
/** Can an element between t and owner scroll further in this direction? */
function innerCanScroll(t: EventTarget | null, owner: HTMLElement, dx: number, dy: number) {
  for (let n = t instanceof Element ? t : null; n && n !== owner.parentElement; n = n.parentElement) {
    const cs = getComputedStyle(n), oy = /auto|scroll/.test(cs.overflowY), ox = /auto|scroll/.test(cs.overflowX);
    if (oy && dy && n.scrollHeight > n.clientHeight + 1 && (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return true;
    if (ox && dx && n.scrollWidth > n.clientWidth + 1 && (dx < 0 ? n.scrollLeft > 0 : n.scrollLeft + n.clientWidth < n.scrollWidth - 1)) return true;
  }
  return false;
}
const onLockWheel = (e: WheelEvent) => { const o = ownerOf(e.target); if (o && innerCanScroll(e.target, o, e.deltaX, e.deltaY)) return; e.preventDefault(); };
const onLockTouchStart = (e: TouchEvent) => { const t = e.touches[0]; if (t) { lockState.tx = t.clientX; lockState.ty = t.clientY; } };
const onLockTouchMove = (e: TouchEvent) => {
  const t = e.touches[0]; if (!t) return;
  const dx = lockState.tx - t.clientX, dy = lockState.ty - t.clientY;
  const o = ownerOf(e.target); if (o && innerCanScroll(e.target, o, dx, dy)) return;
  if (e.cancelable) e.preventDefault();
};
const onLockKey = (e: KeyboardEvent) => {
  if (!SCROLL_KEYS.has(e.key) || e.defaultPrevented) return;
  const t = e.target as HTMLElement | null;
  if (ownerOf(t)) return; // keys inside the overlay (list navigation, inner scroll)
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest?.('[role="slider"],[role="textbox"],[role="combobox"]'))) return;
  e.preventDefault();
};
const devError = (msg: string, el?: Element) => { if (typeof window !== 'undefined' && !(window as unknown as { __UL_PROD__?: boolean }).__UL_PROD__) console.error(msg, el); };
/** Natural size of a surface measured outside every contained / clipped ancestor: a clone in a fixed, hidden container at
 *  the portal root (same classes, theme scope and inline width constraints). */
function measureDetached(s: HTMLElement): { w: number; h: number } {
  const host = (s.closest('.ul-portal') as HTMLElement | null) ?? document.body;
  const box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:0;overflow:visible;visibility:hidden;pointer-events:none;contain:none;';
  const c = s.cloneNode(true) as HTMLElement;
  c.removeAttribute('id'); c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  for (const p of ['transform', 'width', 'height', 'clip-path', 'visibility', 'translate']) c.style.removeProperty(p);
  c.style.left = '0px'; c.style.top = '0px';
  box.appendChild(c); host.appendChild(box);
  const out = { w: c.offsetWidth, h: c.offsetHeight };
  box.remove();
  return out;
}
export function lockPageScroll(owner: HTMLElement) {
  lockState.owners.add(owner);
  if (lockState.n++ > 0) return;
  const html = document.documentElement, sbw = Math.max(0, innerWidth - html.clientWidth);
  lockState.x = scrollX; lockState.y = scrollY; lockState.sbw = sbw;
  lockState.prev = { overflow: html.style.overflow, paddingRight: html.style.paddingRight, overscroll: html.style.overscrollBehavior };
  // overflow hidden also stops scrollbar drag; padding keeps the layout where it was (no shift); no position:fixed jump on iOS
  if (sbw) html.style.paddingRight = `calc(${getComputedStyle(html).paddingRight} + ${sbw}px)`;
  html.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  html.setAttribute('data-ul-scroll-locked', '');
  // right-pinned position:fixed chrome adds this to its right offset (the viewport grows by the scrollbar width)
  html.style.setProperty('--ul-scroll-lock-gap', `${sbw}px`);
  addEventListener('wheel', onLockWheel, { passive: false, capture: true });
  addEventListener('touchstart', onLockTouchStart, { passive: true, capture: true });
  addEventListener('touchmove', onLockTouchMove, { passive: false, capture: true });
  addEventListener('keydown', onLockKey, { capture: true });
}
export function unlockPageScroll(owner: HTMLElement) {
  if (!lockState.owners.delete(owner) || --lockState.n > 0) return;
  lockState.n = 0;
  const html = document.documentElement;
  html.style.overflow = lockState.prev.overflow; html.style.paddingRight = lockState.prev.paddingRight; html.style.overscrollBehavior = lockState.prev.overscroll;
  html.removeAttribute('data-ul-scroll-locked');
  html.style.removeProperty('--ul-scroll-lock-gap');
  removeEventListener('wheel', onLockWheel, { capture: true } as EventListenerOptions);
  removeEventListener('touchstart', onLockTouchStart, { capture: true } as EventListenerOptions);
  removeEventListener('touchmove', onLockTouchMove, { capture: true } as EventListenerOptions);
  removeEventListener('keydown', onLockKey, { capture: true } as EventListenerOptions);
  if (scrollX !== lockState.x || scrollY !== lockState.y) scrollTo(lockState.x, lockState.y);
}
export const isPageScrollLocked = () => lockState.n > 0;
/** Layout viewport width without the classic scrollbar, stable across lock / unlock. */
const layoutVW = () => innerWidth - (lockState.n > 0 ? lockState.sbw : Math.max(0, innerWidth - document.documentElement.clientWidth));

const morphConfig: { timeScale: number; reducedMotion: 'auto' | 'reduce' | 'no-preference' } = { timeScale: 1, reducedMotion: 'auto' };
/** Global knobs. `timeScale` 4 = slow motion ×0.25. `reducedMotion` overrides the media query (tests). */
export function configureMorph(next: Partial<typeof morphConfig>) { Object.assign(morphConfig, next); }
export const getMorphTimeScale = () => morphConfig.timeScale;

const media = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
const reduced = () => morphConfig.reducedMotion === 'auto' ? media('(prefers-reduced-motion: reduce)') : morphConfig.reducedMotion === 'reduce';
export const isMorphReduced = reduced;
/** CSS linear() of the shared overshoot spring (--ul-pop-overshoot); for container motion that must match the morph (sidebar width). */
export const overshootEase = (os?: number) => overshootSpring(os ?? readMorphTokens().overshoot).toCSS(48);
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

export function readMorphTokens(): MorphTokens {
  const cs = getComputedStyle(document.documentElement);
  const n = (k: string, f: number) => { const v = parseFloat(cs.getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
  return {
    enter: n('--ul-pop-enter-duration', 500), exit: n('--ul-pop-exit-duration', 350),
    overshoot: n('--ul-pop-overshoot', 0.05), stretch: n('--ul-pop-stretch', 0.06),
    goo: n('--ul-pop-goo', 1) > 0, stagger: n('--ul-pop-stagger', 30), offset: n('--ul-pop-offset', 8),
    gooOpacity: n('--ul-pop-goo-opacity', 0.22), lag: n('--ul-pop-lag', 50),
  };
}

/** Underdamped spring whose first overshoot equals `os` (0 → critically damped). */
const springCache = new Map<number, Spring>();
function overshootSpring(os: number): Spring {
  const key = Math.round(clamp(os, 0, 0.5) * 1000) / 1000;
  let s = springCache.get(key);
  if (s) return s;
  const zeta = key <= 0 ? 1 : -Math.log(key) / Math.sqrt(Math.PI ** 2 + Math.log(key) ** 2);
  const stiffness = 300;
  s = createSpring({ stiffness, damping: 2 * zeta * Math.sqrt(stiffness) });
  springCache.set(key, s);
  return s;
}

/** Stage size for the morph: the USED (fractional) content size. offsetWidth rounds down, and a stage pinned 0.2px narrower than its
 *  laid-out width re-wraps text that just fitted (proved on ULConfirmPopover: 213.16 → 213px wrapped the description during the morph). */
const stageW = (el: HTMLElement | null) => (el ? parseFloat(getComputedStyle(el).width) || el.offsetWidth : 0);
const stageH = (el: HTMLElement | null) => (el ? parseFloat(getComputedStyle(el).height) || el.offsetHeight : 0);
interface Final { L: number; T: number; fw: number; fh: number; fR: number; sw: number; sh: number }
interface Geo extends Final {
  ax: number; ay: number; aw: number; ah: number; aR: number; // anchor rect relative to the surface's final top-left
  fx: number; fy: number; // origin on the surface edge nearest the anchor, as fractions of the final size
  axis: 'x' | 'y';
}
interface Timeline { Tm: number; lag: number; Tt: number }
interface Pose { x: number; y: number; w: number; h: number; r: number; cx: number; cy: number; k: number; goo: number; bridge: number; Ox: number; Oy: number; c: number }

function poseAt(g: Geo, tl: Timeline, tok: MorphTokens, sp: Spring, tau: number): Pose {
  const p = clamp(tau / tl.Tm);
  const pS = clamp((tau - tl.lag) / Math.max(1, tl.Tm - tl.lag)); // size follows translation by `lag`
  const eP = sp(p), eS = sp(pS);
  const bell = Math.sin(Math.PI * clamp(p / 0.7)) * tok.stretch; // squash & stretch, relaxes before settle
  let w = lerp(g.aw, g.fw, eS), h = lerp(g.ah, g.fh, eS);
  if (g.axis === 'y') { h *= 1 + bell; w *= 1 - bell * 0.5; } else { w *= 1 + bell; h *= 1 - bell * 0.5; }
  w = Math.max(1, w); h = Math.max(1, h);
  const Ox = lerp(g.ax + g.fx * g.aw, g.fx * g.fw, eP);
  const Oy = lerp(g.ay + g.fy * g.ah, g.fy * g.fh, eP);
  const k = smooth(clamp((p - 0.08) / 0.47)); // refraction + rim ramp while separating from the anchor
  return {
    x: Ox - g.fx * w, y: Oy - g.fy * h, w, h,
    r: Math.max(0, Math.min(lerp(g.aR, g.fR, clamp(eS)), w / 2, h / 2)),
    cx: -g.fx * (g.fw - w), cy: -g.fy * (g.fh - h),
    k, goo: 1 - clamp((p - 0.4) / 0.2), bridge: 1 - clamp(p / 0.5), Ox, Oy,
    c: smooth(clamp((p - 0.3) / 0.3)), // content: only once the surface has cleared the anchor
  };
}

function radiusOf(el: HTMLElement, w: number, h: number): number {
  const target = el.classList.contains('ul-glass') ? el : (el.querySelector('.ul-glass') as HTMLElement | null) ?? el;
  const r = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
  return Math.min(r, w / 2, h / 2);
}

const PATH_CLIP = typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('clip-path', 'path(evenodd, "M0 0H1V1Z")');
const n1 = (v: number) => v.toFixed(1);
function rrect(x: number, y: number, w: number, h: number, r: number, arcs = false): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r < 0.5 && !arcs) return `M${n1(x)} ${n1(y)}H${n1(x + w)}V${n1(y + h)}H${n1(x)}Z`;
  const a = `A${n1(r)} ${n1(r)} 0 0 1 `;
  return `M${n1(x + r)} ${n1(y)}H${n1(x + w - r)}${a}${n1(x + w)} ${n1(y + r)}V${n1(y + h - r)}${a}${n1(x + w - r)} ${n1(y + h)}H${n1(x + r)}${a}${n1(x)} ${n1(y + h - r)}V${n1(y + r)}${a}${n1(x + r)} ${n1(y)}Z`;
}
/** Even-odd clip: everything in (box grown by m) minus the hole. Margin keeps the shadow. */
function holeClip(w: number, h: number, hx: number, hy: number, hw: number, hh: number, hr: number, m: number): string {
  // Same command structure in every frame (hole always drawn with arcs) so keyframes interpolate.
  if (PATH_CLIP) return `path(evenodd, "${rrect(-m, -m, w + 2 * m, h + 2 * m, 0)}${rrect(hx, hy, hw, hh, hr, true)}")`;
  const P = (x: number, y: number) => `${n1(x)}px ${n1(y)}px`;
  return `polygon(evenodd, ${P(-m, -m)}, ${P(w + m, -m)}, ${P(w + m, h + m)}, ${P(-m, h + m)}, ${P(-m, -m)}, ${P(hx, hy)}, ${P(hx, hy + hh)}, ${P(hx + hw, hy + hh)}, ${P(hx + hw, hy)}, ${P(hx, hy)}, ${P(-m, -m)})`;
}
/**
 * Resolve the start time now instead of leaving the animations "pending". Chrome starts pending animations of one frame
 * together and waits for the compositor when one of them is composited (the stage's transform/opacity); on a slow raster
 * frame that parked the surface on its t=0 pose for hundreds of ms. Explicit startTime = same frame, no wait.
 */
function startNow(...anims: (Animation | null)[]) {
  const t = document.timeline?.currentTime;
  // Only when the timeline is fresh (this frame). A throttled tab keeps a stale frame time; starting there would skip the motion.
  if (t == null || performance.now() - (t as number) > 34) return;
  for (const a of anims) if (a) a.startTime = t as number;
}
const TRAVEL: Record<Side, [number, number]> = { bottom: [0, 1], top: [0, -1], right: [1, 0], left: [-1, 0] };

function bump(el: HTMLElement) {
  if (!el.isConnected || reduced()) return;
  el.animate([{ scale: '1' }, { scale: '0.98' }, { scale: '1' }], { duration: 260 * morphConfig.timeScale, easing: springs.snappy.toCSS() });
}

export class AnchoredMorph {
  anchor: HTMLElement;
  surface: HTMLElement;
  stage: HTMLElement | null;
  goo: HTMLElement | null;
  scrim: HTMLElement | null;
  opts: MorphOptions;
  side: Side = 'bottom';
  private tau = 0;
  private anim: Animation | null = null;
  private stageAnim: Animation | null = null;
  private seg: { t0: number; t1: number; dur: number } | null = null;
  private loop = 0;
  private fin: Final | null = null;
  private geo: Geo | null = null;
  private tl: Timeline | null = null;
  private tok: MorphTokens | null = null;
  private hole: { el: HTMLElement; r: number } | null = null;
  private phase: 'enter' | 'exit' | null = null;
  private k = 1;
  private prevOverflow: string | null = null;
  private prevPadding: string | null = null;
  private follow = 0;
  private followOn = false;
  private fa = { x: 0, y: 0, w: 0, h: 0 };
  private vp = { w: 0, h: 0 };
  private dxy = { x: 0, y: 0 };
  private lastIn: { dx: number; dy: number; ax: number; ay: number } | null = null;
  private lastInAnim = false;
  private hiddenByAnchor = false;
  private closeAsked = false;
  private wroteTranslate = false;
  /** Set by an owner before closing (swipe-dismissed toast): the next exit fades in place instead of returning to the anchor. */
  nextExitFade = false;
  /** Instrumentation: last follow frame. */
  followFrame = { dx: 0, dy: 0, side: '' as string, hidden: false };

  constructor(parts: MorphParts, opts: MorphOptions = {}) {
    this.anchor = parts.anchor;
    this.surface = parts.surface;
    this.stage = parts.stage ?? null;
    this.goo = parts.goo ?? null;
    this.scrim = parts.scrim ?? null;
    this.opts = opts;
    window.addEventListener('scroll', this.onViewport, { passive: true, capture: true });
    window.addEventListener('resize', this.onViewport, { passive: true });
  }

  setOptions(opts: MorphOptions) { this.opts = { ...this.opts, ...opts }; }

  get animating() { return !!this.anim; }

  // resize / scroll repositioning is the follow loop (or nothing for "fixed")
  private onViewport = () => {};

  /* ---------- scroll behavior while open ---------- */
  private mode() { return this.opts.scrollBehavior ?? 'follow'; }
  private startOpenBehavior() {
    if (this.followOn) return;
    this.followOn = true; this.closeAsked = false; this.hiddenByAnchor = false; this.lastIn = null;
    const m = this.mode();
    if (m === 'lock') lockPageScroll(this.surface);
    if (m === 'close') addEventListener('scroll', this.onCloseScroll, { passive: true, capture: true });
    const b = this.anchor.getBoundingClientRect();
    this.fa = { x: b.left, y: b.top, w: b.width, h: b.height };
    this.vp = { w: innerWidth, h: innerHeight };
    if (!this.follow) this.follow = requestAnimationFrame(this.followTick);
  }
  /** Stop and fold the follow offset into left / top, so exit keyframes start from where the surface is. */
  private stopOpenBehavior() {
    if (!this.followOn) return;
    this.followOn = false;
    cancelAnimationFrame(this.follow); this.follow = 0;
    const m = this.mode();
    if (m === 'lock') unlockPageScroll(this.surface);
    if (m === 'close') removeEventListener('scroll', this.onCloseScroll, { capture: true } as EventListenerOptions);
    if ((this.dxy.x || this.dxy.y) && this.fin && !this.opts.manual) {
      this.fin.L += this.dxy.x; this.fin.T += this.dxy.y;
      this.surface.style.left = `${this.fin.L}px`; this.surface.style.top = `${this.fin.T}px`;
    }
    this.dxy = { x: 0, y: 0 };
    if (this.wroteTranslate) { this.surface.style.translate = ''; this.wroteTranslate = false; }
    if (this.hiddenByAnchor) { this.surface.style.opacity = ''; this.surface.style.pointerEvents = ''; this.hiddenByAnchor = false; }
  }
  private onCloseScroll = (e: Event) => { const t = e.target; if (t instanceof Node && this.surface.contains(t)) return; this.askClose(); };
  private askClose() { if (this.closeAsked) return; this.closeAsked = true; this.opts.onRequestClose?.(); }
  private followTick = () => {
    this.follow = 0;
    if (!this.followOn) return;
    const s = this.surface, a = this.anchor;
    if (!a.isConnected) { this.askClose(); return; }
    const b = a.getBoundingClientRect(); // the ONLY layout read per frame
    const vv = window.visualViewport, VW = vv ? vv.width : innerWidth, VH = vv ? vv.height : innerHeight, ox = vv ? vv.offsetLeft : 0, oy = vv ? vv.offsetTop : 0;
    const out = b.bottom <= oy || b.top >= oy + VH || b.right <= ox || b.left >= ox + VW || b.width === 0;
    const hid = this.opts.onAnchorHidden ?? 'keep';
    if (out && hid === 'close') { this.askClose(); }
    if (hid === 'hide' && out !== this.hiddenByAnchor) {
      this.hiddenByAnchor = out;
      s.style.pointerEvents = out ? 'none' : '';
      if (reduced()) s.style.opacity = out ? '0' : '';
      else s.animate([{ opacity: out ? 1 : 0 }, { opacity: out ? 0 : 1 }], { duration: 120 * morphConfig.timeScale, fill: 'forwards' }).finished.then((an) => { s.style.opacity = out ? '0' : ''; an.cancel(); }, () => {});
    }
    const moved = Math.abs(b.left - this.fa.x) > 0.01 || Math.abs(b.top - this.fa.y) > 0.01 || Math.abs(b.width - this.fa.w) > 0.01 || Math.abs(b.height - this.fa.h) > 0.01
      || ((this.opts.layout ?? 'anchored') !== 'anchored' && (innerWidth !== this.vp.w || innerHeight !== this.vp.h));
    if (moved && this.mode() !== 'fixed' && !this.opts.manual && this.fin) {
      this.fa = { x: b.left, y: b.top, w: b.width, h: b.height };
      this.vp = { w: innerWidth, h: innerHeight };
      // placement against the CURRENT anchor rect with the cached surface size; flip / shift re-evaluated (instant)
      if (this.anim) {
        // during the morph: follow only the anchor's translation (centre delta), never its size (island pill growing)
        const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        if (!this.lastIn || !this.lastInAnim) { this.lastIn = { dx: this.dxy.x, dy: this.dxy.y, ax: cx, ay: cy }; this.lastInAnim = true; }
        this.dxy = { x: this.lastIn.dx + (cx - this.lastIn.ax), y: this.lastIn.dy + (cy - this.lastIn.ay) };
      } else if (!out) {
        const p = this.placeFor(b, this.fin.fw, this.fin.fh);
        this.dxy = { x: p.x - this.fin.L, y: p.y - this.fin.T };
        this.lastIn = { dx: this.dxy.x, dy: this.dxy.y, ax: b.left, ay: b.top };
        this.lastInAnim = false;
        if (p.side !== this.side && !this.anim) { this.side = p.side; s.dataset.side = p.side; }
      } else if (this.lastIn && !this.lastInAnim) {
        // anchor out of view: no viewport clamping, the surface simply moves with the anchor (and comes back with it)
        this.dxy = { x: this.lastIn.dx + (b.left - this.lastIn.ax), y: this.lastIn.dy + (b.top - this.lastIn.ay) };
      }
      s.style.translate = `${this.dxy.x.toFixed(2)}px ${this.dxy.y.toFixed(2)}px`;
      this.wroteTranslate = true;
    }
    this.followFrame = { dx: this.dxy.x, dy: this.dxy.y, side: s.dataset.side || '', hidden: this.hiddenByAnchor };
    this.follow = requestAnimationFrame(this.followTick);
  };

  /** Measure at final size, run collision-aware placement, pin the surface (position: fixed). */
  /** Anchor rect in the surface's local px (divides out ancestor scale in manual mode). */
  private anchorRect(): DOMRect {
    const b = this.anchor.getBoundingClientRect(), k = this.k || 1;
    return k === 1 ? b : new DOMRect(b.left / k, b.top / k, b.width / k, b.height / k);
  }

  /** Final top-left + side for the current layout. Side = which side of the anchor the surface sits on (origin + stretch axis). */
  private placeFor(a: DOMRect, w: number, h: number): { x: number; y: number; side: Side } {
    const lay = this.opts.layout ?? 'anchored';
    if (lay === 'anchored') {
      // Nested menu (a menu surface whose trigger row lives inside another menu surface, opening sideways): place BESIDE
      // the parent surface with exactly --ul-submenu-gap, first row aligned with the trigger row (surface top = row top −
      // own padding). computePlacement still flips to the other side (same gap) and shifts into the viewport.
      const nest = this.nestedParent();
      if (nest) {
        const pr = nest.getBoundingClientRect(), gap = parseFloat(getComputedStyle(this.surface).getPropertyValue('--ul-submenu-gap')) || 2;
        const r = new DOMRect(pr.left, a.top - this.nestPad, pr.width, a.height + 2 * this.nestPad);
        const VW = layoutVW(), room = Math.max(VW - 8 - (pr.right + gap), pr.left - gap - 8);
        if (room < w) {
          // no room beside the parent on either side (phones): drill-in. The submenu sits over its parent, top on the
          // trigger row, and still grows out of that row. Marked data-nest="cover" (no gap rule applies).
          this.surface.dataset.nest = 'cover';
          const x = Math.min(Math.max(8, pr.left), VW - 8 - w), y = Math.min(Math.max(8, a.top - this.nestPad), innerHeight - 8 - h);
          return { x, y, side: 'bottom' };
        }
        this.surface.dataset.nest = 'beside';
        return computePlacement(r, w, h, { side: this.opts.side, align: 'start', offset: gap, padding: 8 });
      }
      return computePlacement(a, w, h, { side: this.opts.side, align: this.opts.align, offset: this.opts.offset ?? (this.tok ?? readMorphTokens()).offset, cover: this.opts.overlap });
    }
    const VW = layoutVW(), VH = innerHeight, pad = this.opts.offset ?? (lay === 'center' ? 16 : 0);
    let x = (VW - w) / 2, y = (VH - h) / 2;
    if (lay === 'center') y = Math.max(pad, y);
    else if (lay === 'bottom') y = VH - h - pad;
    else if (lay === 'top') y = pad;
    else if (lay === 'left') x = pad;
    else x = VW - w - pad;
    const acx = a.left + a.width / 2, acy = a.top + a.height / 2;
    let side: Side;
    if (acy <= y) side = 'bottom'; else if (acy >= y + h) side = 'top'; else if (acx <= x) side = 'right'; else if (acx >= x + w) side = 'left';
    else { const dx = (acx - (x + w / 2)) / w, dy = (acy - (y + h / 2)) / h; side = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'bottom' : 'top') : (dx < 0 ? 'right' : 'left'); }
    return { x, y, side };
  }

  private nestPad = 0;
  /** The parent menu surface when this is a sideways menu opened from a row inside another menu surface. */
  private nestedParent(): HTMLElement | null {
    const sd = this.opts.side;
    if ((sd !== 'left' && sd !== 'right') || this.surface.getAttribute('role') !== 'menu') return null;
    const p = this.anchor.closest?.('.ul-anchored[role="menu"]') as HTMLElement | null;
    return p && p !== this.surface ? p : null;
  }

  private scrimTo(v: number) { if (this.scrim) this.scrim.style.opacity = v.toFixed(3); }

  place() {
    const s = this.surface;
    if (this.opts.manual) {
      for (const a of s.getAnimations()) if ('transitionProperty' in a) a.finish(); // land owner CSS transitions on the final rect
      const r = s.getBoundingClientRect();
      const k = (s.offsetWidth ? r.width / s.offsetWidth : 1) || 1;
      this.k = k;
      const a = this.anchorRect();
      const L = r.left / k, T = r.top / k, w = s.offsetWidth || 1, h = s.offsetHeight || 1;
      const acx = a.left + a.width / 2, acy = a.top + a.height / 2;
      this.side = acy <= T ? 'bottom' : acy >= T + h ? 'top' : acx <= L ? 'right' : 'left';
      s.dataset.side = this.side;
      const fR = Math.min(parseFloat(getComputedStyle(s).borderTopLeftRadius) || 0, w / 2, h / 2);
      this.fin = { L, T, fw: w, fh: h, fR, sw: stageW(this.stage), sh: stageH(this.stage) };
      this.geo = this.buildGeo(a);
      return;
    }
    s.style.left = '0px';
    s.style.top = '0px';
    if (this.nestedParent()) this.nestPad = parseFloat(getComputedStyle(s).paddingTop) || 0; // read before begin() moves padding onto the stage
    const a = this.anchor.getBoundingClientRect();
    let w = s.offsetWidth || 1, h = s.offsetHeight || 1;
    // Sanity: a natural size below the anchor (or 24px) means it was measured in a clipped / contained / stale state.
    // Re-measure once in a detached measurement container with the same width constraints; log it in dev.
    const min = (v: number) => Math.min(24, Math.max(1, v || 24));
    if (h < min(a.height) || w < min(a.width)) {
      const m = measureDetached(s);
      devError(`[UL] AnchoredMorph: natural size ${w}×${h} below the minimum; re-measured detached → ${m.w}×${m.h}`, s);
      if (m.h >= h && m.w >= w) { w = m.w; h = m.h; }
    }
    const p = this.placeFor(a, w, h);
    s.style.left = `${p.x}px`;
    s.style.top = `${p.y}px`;
    s.dataset.side = p.side;
    this.side = p.side;
    const fR = Math.min(parseFloat(getComputedStyle(s).borderTopLeftRadius) || 0, w / 2, h / 2);
    this.fin = { L: p.x, T: p.y, fw: w, fh: h, fR, sw: stageW(this.stage), sh: stageH(this.stage) };
    this.geo = this.buildGeo(a);
  }

  private buildGeo(a: DOMRect): Geo {
    const f = this.fin!;
    const acx = a.left + a.width / 2 - f.L, acy = a.top + a.height / 2 - f.T;
    const along = (v: number, size: number) => clamp(v, Math.min(f.fR, size / 2), Math.max(size - f.fR, size / 2)) / size;
    let fx = 0.5, fy = 0;
    switch (this.side) {
      case 'top': fx = along(acx, f.fw); fy = 1; break;
      case 'left': fx = 1; fy = along(acy, f.fh); break;
      case 'right': fx = 0; fy = along(acy, f.fh); break;
      default: fx = along(acx, f.fw); fy = 0;
    }
    return {
      ...f, ax: a.left - f.L, ay: a.top - f.T, aw: Math.max(1, a.width), ah: Math.max(1, a.height),
      aR: radiusOf(this.anchor, a.width, a.height), fx, fy, axis: this.side === 'top' || this.side === 'bottom' ? 'y' : 'x',
    };
  }

  private timeline(tok: MorphTokens): Timeline {
    const Tm = Math.max(1, tok.enter);
    return { Tm, lag: Math.min(tok.lag, Tm * 0.5), Tt: Tm };
  }

  private currentTau(): number {
    if (this.anim && this.seg) {
      const ct = Number(this.anim.currentTime) || 0;
      return lerp(this.seg.t0, this.seg.t1, this.seg.dur ? clamp(ct / this.seg.dur) : 1);
    }
    return this.tau;
  }

  /* ---------- layering: even-odd hole at the anchor (portal-safe, no z-index changes) ---------- */
  private holeRect(): DOMRect {
    const h = this.hole!, b = h.el.getBoundingClientRect(), k = this.k || 1;
    return k === 1 ? b : new DOMRect(b.left / k, b.top / k, b.width / k, b.height / k);
  }

  private ensureHole() {
    if (this.hole) return this.hole;
    const el = (this.anchor.closest('[data-ul-morph-occluder]') as HTMLElement | null) ?? this.anchor;
    const b = el.getBoundingClientRect();
    return (this.hole = { el, r: radiusOf(el, b.width, b.height) });
  }

  /** Surface clip for one pose: even-odd hole at the anchor (zero-size once they no longer overlap). */
  private clipFor(g: Geo, f: Pose, a: DOMRect): string {
    const hx = a.left - (g.L + f.x), hy = a.top - (g.T + f.y);
    const hit = hx < f.w && hy < f.h && hx + a.width > 0 && hy + a.height > 0;
    return hit ? holeClip(f.w, f.h, hx, hy, a.width, a.height, this.hole!.r, 96) : holeClip(f.w, f.h, 0, 0, 0, 0, 0, 96);
  }

  private applyHole() {
    if (this.opts.anchorOnTop === false) return;
    const h = this.ensureHole();
    if ((this.goo || this.scrim) && !this.opts.manual) {
      const b = h.el.getBoundingClientRect();
      const clip = holeClip(innerWidth, innerHeight, b.left, b.top, b.width, b.height, h.r, 0);
      if (this.goo) this.goo.style.clipPath = clip;
      if (this.scrim) this.scrim.style.clipPath = clip; // the trigger stays visible + clickable through the scrim while the morph plays
    }
  }

  private clearHole() {
    this.surface.style.clipPath = '';
    if (this.goo) this.goo.style.clipPath = '';
    if (this.scrim) this.scrim.style.clipPath = '';
    this.hole = null;
  }

  private emit(state: 'start' | 'end' | 'interrupted', duration = 0) {
    if (!this.phase) return;
    this.surface.dispatchEvent(new CustomEvent('ul:morph', { bubbles: true, detail: { phase: this.phase, state, duration, reduced: reduced(), morph: this } }));
  }

  /* ---------- lifecycle ---------- */
  private begin() {
    const s = this.surface, fin = this.fin!;
    s.style.visibility = '';
    s.setAttribute('data-ul-morphing', '');
    s.style.willChange = 'transform, width, height';
    if (this.prevOverflow === null) this.prevOverflow = s.style.overflow;
    s.style.overflow = 'hidden';
    if (this.stage) {
      // padding moves onto the stage while morphing, so the surface can start at a 0 × 0 anchor (pointer point, edge)
      if (this.prevPadding === null) {
        const cs = getComputedStyle(s);
        this.prevPadding = s.style.padding;
        this.stage.style.margin = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`;
        s.style.padding = '0px';
      }
      this.stage.style.width = `${fin.sw}px`;
      this.stage.style.height = `${fin.sh}px`;
      this.stage.style.flex = 'none';
      this.stage.style.willChange = 'transform';
    }
  }

  /** Cancel animations and remove every temporary style (hole included). */
  private stop(settled = true) {
    cancelAnimationFrame(this.loop);
    this.loop = 0;
    const a = this.anim, b = this.stageAnim;
    this.anim = this.stageAnim = null;
    this.seg = null;
    a?.cancel();
    b?.cancel();
    const s = this.surface;
    s.removeAttribute('data-ul-morphing');
    s.style.willChange = '';
    if (this.prevOverflow !== null) { s.style.overflow = this.prevOverflow; this.prevOverflow = null; }
    if (this.prevPadding !== null) { s.style.padding = this.prevPadding; this.prevPadding = null; if (this.stage) this.stage.style.margin = ''; }
    s.style.removeProperty('--ul-rim');
    setGlassGeometry(s);
    if (this.stage) { this.stage.style.width = this.stage.style.height = this.stage.style.flex = this.stage.style.willChange = ''; }
    this.hideGoo();
    this.clearHole();
    if (settled) releaseGlassTier(s); // an interrupted run hands over to the next one: no tier change mid-travel
  }

  /** Visual rect of the surface right now (animation applied), in the surface's local px. Read BEFORE stop(). */
  private visualPose(): { x: number; y: number; w: number; h: number; r: number } | null {
    if (!this.anim) return null;
    const s = this.surface, b = s.getBoundingClientRect(), k = this.k || 1;
    if (!b.width || !b.height) return null;
    return { x: b.left / k, y: b.top / k, w: b.width / k, h: b.height / k, r: parseFloat(getComputedStyle(s).borderTopLeftRadius) || 0 };
  }

  private run(g: Geo, t0: number, t1: number, dur: number, from: { x: number; y: number; w: number; h: number; r: number } | null = null): Promise<boolean> {
    const s = this.surface, tl = this.tl!, tok = this.tok!;
    const sp = overshootSpring(tok.overshoot);
    this.geo = g;
    if (dur <= 1) { this.tau = t1; return Promise.resolve(true); }
    const N = Math.round(clamp(Math.ceil(Math.abs(t1 - t0) / 8), 2, 90));
    const poses = Array.from({ length: N + 1 }, (_, i) => poseAt(g, tl, tok, sp, lerp(t0, t1, i / N)));
    // Interruption: start from the CURRENT visual rect (viewport px → this run's local px), then hand over to the
    // timeline within --ul-pop-lag. If geometry did not change (same anchor, same final rect) the offset is 0.
    if (from) {
      const d = { x: from.x - g.L - poses[0].x, y: from.y - g.T - poses[0].y, w: from.w - poses[0].w, h: from.h - poses[0].h, r: from.r - poses[0].r };
      const blend = Math.max(1, Math.min(dur, tok.lag * 1.6 * morphConfig.timeScale));
      poses.forEach((f, i) => {
        const wgt = 1 - smooth(clamp(((i / N) * dur) / blend));
        if (wgt <= 0) return;
        f.x += d.x * wgt; f.y += d.y * wgt; f.w = Math.max(1, f.w + d.w * wgt); f.h = Math.max(1, f.h + d.h * wgt); f.r = Math.max(0, f.r + d.r * wgt);
      });
    }
    // Covered non-modal surfaces (overlap): every pose contains the anchor's shape (box ⊇ anchor box, corner radius never tighter
    // than the anchor's while the box is tight), so squash / lag / interruption never expose the trigger.
    if (this.opts.overlap != null) for (const f of poses) {
      const x0 = Math.min(f.x, g.ax), y0 = Math.min(f.y, g.ay), x1 = Math.max(f.x + f.w, g.ax + g.aw), y1 = Math.max(f.y + f.h, g.ay + g.ah);
      f.x = x0; f.y = y0; f.w = x1 - x0; f.h = y1 - y0;
      const m = Math.min(g.ax - f.x, g.ay - f.y, f.x + f.w - g.ax - g.aw, f.y + f.h - g.ay - g.ah);
      f.r = Math.min(f.r, Math.max(g.aR, g.aR + m / (1 - Math.SQRT1_2)), f.w / 2, f.h / 2);
    }
    this.ensureHole();
    const ha = this.holeRect(); // anchor's CURRENT rect at the start of this run (enter, exit or reversal)
    const anim = s.animate(poses.map((f, i) => ({
      offset: i / N,
      transform: `translate(${f.x.toFixed(2)}px, ${f.y.toFixed(2)}px)`,
      width: `${f.w.toFixed(2)}px`,
      height: `${f.h.toFixed(2)}px`,
      borderRadius: `${f.r.toFixed(2)}px`,
      ...(this.opts.anchorOnTop === false ? {} : { clipPath: this.clipFor(g, f, ha) }), // the hole is keyframed: always in sync with the pose, no per-frame style writes
    })) as Keyframe[], { duration: dur, easing: 'linear', fill: 'both' });
    this.stageAnim = this.stage
      ? this.stage.animate(poses.map((f, i) => {
        const [dx, dy] = TRAVEL[this.side] ?? TRAVEL.bottom, d = (1 - f.c) * tok.offset;
        return { offset: i / N, opacity: f.c.toFixed(3), transform: `translate(${(f.cx - dx * d).toFixed(2)}px, ${(f.cy - dy * d).toFixed(2)}px)` };
      }), { duration: dur, easing: 'linear', fill: 'both' })
      : null;
    startNow(anim, this.stageAnim);
    this.anim = anim;
    this.seg = { t0, t1, dur };
    const useGoo = !!this.goo && tok.goo && !reduced();
    const tick = () => {
      if (this.anim !== anim) return;
      const tau = lerp(t0, t1, clamp((Number(anim.currentTime) || 0) / dur));
      this.tau = tau;
      const f = poseAt(g, tl, tok, sp, tau);
      setGlassMaterialize(s, f.k);
      s.style.setProperty('--ul-rim', f.k.toFixed(3));
      setGlassGeometry(s, f.w, f.h);
      this.applyHole();
      if (this.scrim) this.scrimTo(smooth(clamp(tau / (tl.Tm * 0.6))));
      if (useGoo) this.drawGoo(g, f, tok);
      this.loop = requestAnimationFrame(tick);
    };
    tick();
    return anim.finished.then(() => { if (this.anim !== anim) return false; this.tau = t1; return true; }, () => false);
  }

  private drawGoo(g: Geo, f: Pose, tok: MorphTokens) {
    const layer = this.goo;
    if (!layer) return;
    const op = f.goo * tok.gooOpacity;
    if (op <= 0.001) { this.hideGoo(); return; }
    layer.style.opacity = String(op);
    layer.style.filter = `url(#${ensureGooFilter()})`;
    const [ab, bb, sb] = Array.from(layer.children) as HTMLElement[];
    if (!ab || !bb || !sb) return;
    const box = (el: HTMLElement, x: number, y: number, w: number, h: number, r: number) => {
      el.style.width = `${w}px`; el.style.height = `${h}px`; el.style.borderRadius = `${r}px`;
      el.style.transformOrigin = '0 0';
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    const ax = g.L + g.ax, ay = g.T + g.ay;
    box(ab, ax, ay, g.aw, g.ah, g.aR);
    box(sb, g.L + f.x, g.T + f.y, f.w, f.h, f.r);
    // Neck: capsule from the anchor center to the surface's origin point, thinning as they separate.
    const cx = ax + g.aw / 2, cy = ay + g.ah / 2;
    const px = g.L + f.Ox, py = g.T + f.Oy;
    const thick = Math.max(0, Math.min(g.aw, g.ah) * 0.55 * f.bridge);
    bb.style.width = `${Math.hypot(px - cx, py - cy)}px`;
    bb.style.height = `${thick}px`;
    bb.style.borderRadius = `${thick / 2}px`;
    bb.style.transformOrigin = '0 50%';
    bb.style.transform = `translate(${cx}px, ${cy - thick / 2}px) rotate(${Math.atan2(py - cy, px - cx)}rad)`;
  }

  private hideGoo() {
    if (!this.goo) return;
    this.goo.style.opacity = '0';
    this.goo.style.filter = 'none';
  }

  /** Slide out from behind the anchor. Resolves true when settled, false if interrupted. */
  enter(): Promise<boolean> {
    const s = this.surface;
    const wasAnimating = !!this.anim;
    const tauC = this.currentTau();
    const o0 = wasAnimating ? parseFloat(getComputedStyle(s).opacity) || 0 : this.tau > 0 ? 1 : 0;
    const vis = wasAnimating && !reduced() ? this.visualPose() : null;
    if (wasAnimating) this.emit('interrupted');
    this.stop(false);
    // reopened during a close: the close's scrim fade must not keep running (it would end at opacity 0 on an open modal)
    this.scrim?.getAnimations().forEach((an) => an.cancel());
    this.phase = 'enter';
    const tok = (this.tok = readMorphTokens());
    this.stopOpenBehavior();
    this.place();
    this.startOpenBehavior();
    // covered surfaces start on their opaque base; the (possibly cold) map is built after the first frame, never blocking it
    if (this.opts.coverAnchor) requestAnimationFrame(() => { if (s.isConnected) measureGlassNow(s); }); else measureGlassNow(s);
    const tl = (this.tl = this.timeline(tok));
    if (reduced()) return this.simple(true, o0);
    const t0 = clamp(tauC, 0, tl.Tt);
    if (t0 <= 0) bump(this.anchor);
    if (!wasAnimating) decideGlassTier(s); // tier fixed before the first frame, constant for the whole morph
    this.begin();
    const dur = (tl.Tt - t0) * morphConfig.timeScale;
    const p = this.run(this.geo!, t0, tl.Tt, dur, vis);
    this.emit('start', dur); // after the first pose is applied: listeners see the t=0 frame
    return p.then((ok) => {
      if (ok) { this.stop(); setGlassMaterialize(s, 1); this.scrimTo(1); this.tau = tl.Tt; this.emit('end', dur); }
      return ok;
    });
  }

  /** Exact time-reverse of enter (faster), back under the anchor's CURRENT rect. Resolves true when absorbed. */
  exit(): Promise<boolean> {
    const s = this.surface;
    const wasAnimating = !!this.anim;
    const tauC = this.currentTau();
    const o0 = wasAnimating ? parseFloat(getComputedStyle(s).opacity) || 0 : 1;
    const vis = wasAnimating && !reduced() ? this.visualPose() : null;
    if (wasAnimating) this.emit('interrupted');
    this.phase = 'exit';
    this.stopOpenBehavior();
    if (!this.fin || !this.tl) { this.stop(); s.style.visibility = 'hidden'; return Promise.resolve(true); }
    if (reduced()) return this.simple(false, o0);
    if (this.nextExitFade) { this.nextExitFade = false; return this.fallbackExit(tauC); }
    if (this.opts.manual && !wasAnimating) this.place(); // owner layout may have moved it since enter (toast stack reflow)
    const b = this.anchor.getBoundingClientRect();
    const virt = this.anchor.hasAttribute('data-ul-virtual-anchor'); // pointer point / edge strip: legitimately 0-wide
    const off = !this.anchor.isConnected || (!virt && b.width === 0 && b.height === 0) || b.bottom < 0 || b.top > window.innerHeight || b.right < 0 || b.left > window.innerWidth;
    if (off) return this.fallbackExit(tauC);
    const a = this.anchorRect();
    this.stop(false);
    const tok = this.tok ?? readMorphTokens();
    this.tok = tok;
    this.begin();
    const speed = tok.exit / Math.max(1, tok.enter);
    const dur = tauC * speed * morphConfig.timeScale;
    const p = this.run(this.buildGeo(a), tauC, 0, dur, vis);
    this.emit('start', dur);
    return p.then((ok) => {
      if (ok) { s.style.visibility = 'hidden'; this.stop(); setGlassMaterialize(s, 0); this.scrimTo(0); this.tau = 0; bump(this.anchor); this.emit('end', dur); }
      return ok;
    });
  }

  /** Anchor gone or off-screen: scale + fade at the last known position. */
  private fallbackExit(tauC: number): Promise<boolean> {
    const s = this.surface, g = this.geo, tl = this.tl, tok = this.tok ?? readMorphTokens();
    this.stop(false);
    if (!g || !tl) { s.style.visibility = 'hidden'; return Promise.resolve(true); }
    const f = poseAt(g, tl, tok, overshootSpring(tok.overshoot), clamp(tauC, 0, tl.Tm));
    const base = { width: `${f.w}px`, height: `${f.h}px`, borderRadius: `${f.r}px` };
    const tr = `translate(${f.x}px, ${f.y}px)`;
    s.style.transformOrigin = 'center';
    s.style.overflow = 'hidden';
    const anim = s.animate([{ ...base, transform: tr, opacity: 1 }, { ...base, transform: `${tr} scale(0.92)`, opacity: 0 }],
      { duration: tok.exit * 0.6 * morphConfig.timeScale, easing: 'ease-in', fill: 'forwards' });
    startNow(anim);
    this.anim = anim;
    if (this.scrim) this.scrim.animate([{ opacity: this.scrim.style.opacity || '1' }, { opacity: 0 }], { duration: tok.exit * 0.6 * morphConfig.timeScale, fill: 'forwards' }).finished.then((an) => { this.scrimTo(0); an.cancel(); }, () => {});
    this.emit('start', tok.exit * 0.6 * morphConfig.timeScale);
    return anim.finished.then(() => {
      if (this.anim !== anim) return false;
      s.style.visibility = 'hidden'; this.stop(); this.tau = 0; s.style.transformOrigin = ''; this.emit('end', tok.exit * 0.6 * morphConfig.timeScale);
      return true;
    }, () => false);
  }

  /** Reduced motion: 150ms opacity + small scale from the anchor side. No stretch, goo or overshoot. */
  private simple(open: boolean, o0: number): Promise<boolean> {
    const s = this.surface, g = this.geo;
    this.stop();
    s.style.visibility = '';
    s.style.transformOrigin = g ? `${g.fx * g.fw}px ${g.fy * g.fh}px` : 'center';
    setGlassMaterialize(s, 1);
    const to = open ? 1 : 0;
    const anim = s.animate(
      [{ opacity: o0, transform: `scale(${0.96 + 0.04 * o0})` }, { opacity: to, transform: `scale(${0.96 + 0.04 * to})` }],
      { duration: 150 * morphConfig.timeScale, easing: 'ease-out', fill: 'both' },
    );
    startNow(anim);
    this.anim = anim;
    if (this.scrim) { const sc = this.scrim; sc.animate([{ opacity: sc.style.opacity || String(o0) }, { opacity: to }], { duration: 150 * morphConfig.timeScale, fill: 'forwards' }).finished.then((an) => { this.scrimTo(to); an.cancel(); }, () => {}); }
    this.emit('start', 150 * morphConfig.timeScale);
    return anim.finished.then(() => {
      if (this.anim !== anim) return false;
      if (!open) s.style.visibility = 'hidden';
      this.anim = null;
      anim.cancel();
      this.tau = open ? this.tl?.Tt ?? 1 : 0;
      this.emit('end', 150 * morphConfig.timeScale);
      return true;
    }, () => false);
  }

  /** Owner resized / moved the SETTLED surface (dialog view swap): the next exit starts from this rect. */
  setFinalRect(L: number, T: number, w: number, h: number) {
    if (!this.fin) return;
    this.fin = { ...this.fin, L, T, fw: w, fh: h, fR: Math.min(parseFloat(getComputedStyle(this.surface).borderTopLeftRadius) || 0, w / 2, h / 2), sw: this.stage ? stageW(this.stage) : this.fin.sw, sh: this.stage ? stageH(this.stage) : this.fin.sh };
    if (!this.opts.manual) { this.surface.style.left = `${L}px`; this.surface.style.top = `${T}px`; }
  }
  /** Final top-left for a surface of this size under the current layout (dialog view swap). */
  finalFor(w: number, h: number) { const p = this.placeFor(this.anchor.getBoundingClientRect(), w, h); return { L: p.x, T: p.y }; }

  /** Owner moved the SETTLED surface (sheet / toast drag): fold the offset into the final rect so the exit starts there. */
  shiftFinal(dx: number, dy: number) {
    if (!this.fin || this.anim) return;
    this.fin.L += dx; this.fin.T += dy;
    if (!this.opts.manual) { this.surface.style.left = `${this.fin.L}px`; this.surface.style.top = `${this.fin.T}px`; }
  }

  destroy() {
    this.stopOpenBehavior();
    this.stop();
    // invariant: nothing temporary survives a close (the owner unmounts the nodes; reused nodes start clean)
    const s = this.surface;
    for (const p of ['left', 'top', 'visibility', 'transform-origin', 'opacity', 'pointer-events', 'translate', 'clip-path', 'overflow', 'will-change']) s.style.removeProperty(p);
    s.getAnimations().forEach((an) => { if (!('transitionProperty' in an)) an.cancel(); });
    if (this.goo) { this.goo.removeAttribute('style'); for (const c of Array.from(this.goo.children) as HTMLElement[]) c.removeAttribute('style'); }
    if (this.scrim) { this.scrim.getAnimations().forEach((an) => an.cancel()); this.scrim.style.removeProperty('clip-path'); }
    window.removeEventListener('scroll', this.onViewport, { capture: true } as EventListenerOptions);
    window.removeEventListener('resize', this.onViewport);
  }
}
