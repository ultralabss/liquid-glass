/**
 * Shared lens bubble (ULSwitch, ULSlider, ULRangeSlider, ULSegmentedControl, ULTabs). One implementation, no copies.
 *
 * A glass rounded rectangle that grows out of a flat thumb / indicator while the control is pressed, dragged or
 * travelling, follows its target with an elastic two-edge model, and shrinks back onto the resting thumb once it has
 * SETTLED. It is the only refracting element of the control; the resting thumb / indicator crossfades out under it.
 *
 * Layering: the bubble is a sibling layer at the document root ([data-ul-lens-layer], position fixed, pointer-events none),
 * so no ancestor overflow, clip-path, radius clipping or backdrop-filter can clip it. It refracts whatever is painted
 * under it: the control's own track / fill / labels and the page behind. Over glass (control inside a glass panel, or a
 * glass wrapper such as the segmented capsule) it would sample glass, so it runs with quality "flat" and the bevel look.
 *
 * Geometry (owner callback, host-local px, read every frame from the owner's CACHED values, never from layout):
 *   c / cc: target centre along / across the axis; w / h / r: resting thumb size and radius;
 *   wrap: { lo, hi } extent along the axis, cross size and radius of the wrapper (track / list) for overgrow + concentric radius.
 * Active size: along = max(w·L, w + 2·og, w + (cross − h)), across = max(h·L, wrap.cross + 2·og). Radius concentric with the
 * wrapper (wrap.r + (across − wrap.cross) / 2) or fixed (--ul-lens-radius-mode / --ul-lens-radius).
 *
 * Motion: grow g (damped spring 0 → 1 with --ul-lens-overshoot, --ul-lens-grow-duration / --ul-lens-shrink-duration);
 * two edges along the axis with separate springs (leading edge stiffer, --ul-lens-lead; trailing softer, --ul-lens-trail):
 * the bubble stretches toward the travel (≤ --ul-lens-drag-stretch), squashes across, and when the target stops the trailing
 * edge catches up and overshoots once. Width / height / radius are written as real size (radius stays correct; the glass map
 * is rescaled, never regenerated) and position as translate3d. Reduced motion: no growth, stretch, overshoot or travel;
 * a 150ms crossfade at the target.
 */
import { attachGlass, detachGlass, setGlassMaterialize, setGlassHot, setGlassGeometry, wakeGlass, releaseGlassTier } from '../glass/engine.ts';
import { getMorphTimeScale, isMorphReduced } from './anchoredMorph.ts';

export type LensKind = 'switch' | 'slider' | 'tabs';
export interface LensTokens {
  scale: number; overshoot: number; grow: number; shrink: number; dragStretch: number; magnify: number;
  rubber: number; flick: number; lead: number; trail: number; overgrow: number; radiusMode: 'concentric' | 'fixed'; radius: number;
  settleHold: number; follow: number; toggle: number; pressGlide: number; zetaMin: number;
  settle: number; shrinkStart: number; linger: number;
}
export interface LensGeometry {
  c: number; cc: number; w: number; h: number; r: number;
  wrap: { lo: number; hi: number; cross: number; r: number };
}
export interface LensOptions {
  kind: LensKind;
  axis?: 'x' | 'y';
  /** Control root: the bubble is positioned relative to its (cached) viewport rect; tokens, theme and accent are read from it. */
  host: HTMLElement;
  geometry: () => LensGeometry;
  /** Resting thumb / indicator elements: hidden while the bubble is visible. */
  knobs?: () => (HTMLElement | null)[];
  /** Persistent + follow: rest size at a position between items (tabs of different widths). */
  geometryAt?: (c: number) => Partial<LensGeometry>;
  /** True while the owner's own target is still moving (slider follow spring, switch travel). */
  busy?: () => boolean;
  /** Bubble shown / hidden (owner can e.g. disable its own transitions). */
  onLive?: (live: boolean) => void;
  /** 'root' (default): pooled element in the root layer, hidden at rest. 'host': ONE persistent element inside the host that
   *  IS the resting indicator (flat capsule at rest, bubble when active): tabs, segmented. */
  mount?: 'root' | 'host';
  /** The bubble follows its target through a critically damped spring (--ul-lens-follow) instead of directly (tabs). */
  follow?: boolean;
  /** Release behaviour (switch, tabs, segmented): the thumb SETTLES on an elastic spring (--ul-lens-settle-duration) and the
   *  bubble starts shrinking at --ul-lens-shrink-start of it; gone ≤ --ul-lens-release-linger after release. The thumb may
   *  finish the settle alone (onFrame keeps reporting the position). Default false (slider: shrink after settle). */
  earlyShrink?: boolean;
  /** Called every frame with the bubble's settled-spring position (host px), null when the motion has ended. */
  onFrame?: (c: number | null) => void;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const zetaFor = (r: number) => (r <= 0.0005 ? 1 : -Math.log(r) / Math.sqrt(Math.PI ** 2 + Math.log(r) ** 2));

export function readLensTokens(el: Element, kind: LensKind): LensTokens {
  const cs = getComputedStyle(el);
  const n = (k: string, f: number) => { const v = parseFloat(cs.getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
  return {
    scale: Math.max(1.01, n(`--ul-lens-scale-${kind}`, n('--ul-lens-scale', 1.3))), overshoot: n('--ul-lens-overshoot', 0.04),
    grow: n('--ul-lens-grow-duration', 380), shrink: n('--ul-lens-shrink-duration', 600),
    dragStretch: n('--ul-lens-drag-stretch', 0.14), magnify: n('--ul-lens-magnify', 1.06),
    rubber: n('--ul-lens-rubber', 0.55), flick: n('--ul-lens-flick', 140), lead: n('--ul-lens-lead', 70), trail: n('--ul-lens-trail', 150),
    overgrow: n(`--ul-lens-overgrow-${kind}`, kind === 'slider' ? 6 : 2),
    radiusMode: cs.getPropertyValue('--ul-lens-radius-mode').trim() === 'fixed' ? 'fixed' : 'concentric', radius: n('--ul-lens-radius', 12),
    settleHold: n('--ul-lens-settle-hold', 120), follow: n('--ul-lens-follow', 110), toggle: n('--ul-switch-toggle-duration', 560),
    pressGlide: n('--ul-tabs-press-glide', 400), zetaMin: n('--ul-lens-zeta-min', 0.62),
    settle: n('--ul-lens-settle-duration', 420), shrinkStart: n('--ul-lens-shrink-start', 0.45), linger: n('--ul-lens-release-linger', 570),
  };
}

/** Rubber band beyond [lo, hi]: excess d → (1 − 1 / (d·c / dim + 1)) · dim (iOS-style). */
export function rubberBand(x: number, lo: number, hi: number, c = 0.55, dim = 40): number {
  if (x < lo) { const d = lo - x; return lo - (1 - 1 / ((d * c) / dim + 1)) * dim; }
  if (x > hi) { const d = x - hi; return hi + (1 - 1 / ((d * c) / dim + 1)) * dim; }
  return x;
}

/* ---------- pooled elements in one root layer ---------- */
let layer: HTMLElement | null = null;
const pool: { wrap: HTMLElement; glass: HTMLElement; quality: string }[] = [];
function getLayer() {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement('div');
  layer.setAttribute('data-ul-lens-layer', '');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;overflow:visible;pointer-events:none;contain:layout style;z-index:calc(var(--ul-z-overlay, 1000) + 5)';
  document.body.appendChild(layer);
  return layer;
}
function take(quality: 'auto' | 'flat') {
  let p = pool.pop();
  if (!p) {
    const wrap = document.createElement('div');
    wrap.className = 'ul-lens-wrap';
    const glass = document.createElement('span');
    glass.className = 'ul-glass ul-lens';
    glass.dataset.tier = 'sm'; glass.dataset.variant = 'clear'; glass.dataset.lens = 'prominent';
    const spec = document.createElement('span');
    spec.className = 'ul-lens-spec';
    glass.appendChild(spec);
    wrap.appendChild(glass);
    getLayer().appendChild(wrap);
    p = { wrap, glass, quality: '' };
  }
  if (p.quality !== quality) { attachGlass(p.glass, { priority: 'overlay', mode: 'prominent', light: false, quality }); p.quality = quality; }
  return p;
}
function give(p: { wrap: HTMLElement; glass: HTMLElement; quality: string }) {
  p.wrap.style.display = 'none';
  wakeGlass(p.glass, false);
  if (pool.length < 4) pool.push(p); else { detachGlass(p.glass); p.wrap.remove(); }
}

interface Spring { x: number; v: number }
function stepSpring(s: Spring, target: number, w: number, z: number, dt: number) {
  const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
  for (let i = 0; i < n; i++) { const a = -w * w * (s.x - target) - 2 * z * w * s.v; s.v += a * h; s.x += s.v * h; }
}

export class LensBubble {
  o: LensOptions;
  enabled = true;
  private el: ReturnType<typeof take> | null = null;
  private tok: LensTokens | null = null;
  private host = { left: 0, top: 0 };
  private pressed = false;
  private holdUntil = 0;
  private quick = 1;
  private g: Spring = { x: 0, v: 0 };
  private a: Spring = { x: 0, v: 0 };
  private b: Spring = { x: 0, v: 0 };
  private fade = 0;
  private lastC = 0;
  private tv = 0;
  private stillMs = 0;
  private raf = 0;
  private last = 0;
  private frozen = false;
  private age = 0;
  private live = false;
  private f: Spring = { x: 0, v: 0 };
  private glideT = 0;
  private pace = 1;
  private holdMs = -1;
  private persistent = false;
  private settleT = 0;
  private releaseAt = 0;
  private relK = 1;
  private coast = false;
  /** Last frame, for tests / instrumentation. */
  frame = { x: 0, y: 0, w: 0, h: 0, r: 0, k: 0, g: 0, alpha: 0, c: 0, t: 0, live: false, mode: '', el: null as HTMLElement | null };

  constructor(o: LensOptions) {
    this.o = o;
    // instrumentation for tests: host.__ulLenses lists the bubbles that belong to a control
    const h = o.host as HTMLElement & { __ulLenses?: LensBubble[] };
    (h.__ulLenses ??= []).push(this);
    if (o.mount === 'host') {
      this.persistent = true;
      const wrap = document.createElement('span');
      wrap.className = 'ul-lens-wrap'; wrap.setAttribute('data-host', ''); wrap.setAttribute('data-rest', ''); wrap.setAttribute('aria-hidden', 'true');
      const glass = document.createElement('span');
      glass.className = 'ul-glass ul-lens'; glass.dataset.tier = 'sm'; glass.dataset.variant = 'clear'; glass.dataset.lens = 'prominent';
      const spec = document.createElement('span'); spec.className = 'ul-lens-spec';
      glass.appendChild(spec); wrap.appendChild(glass);
      o.host.prepend(wrap);
      const q = o.host.closest('.ul-glass') ? 'flat' : 'auto';
      attachGlass(glass, { priority: 'overlay', mode: 'prominent', light: false, quality: q });
      this.el = { wrap, glass, quality: q };
      wakeGlass(glass, false);
    }
  }
  get active() { return this.live; }

  press() { if (!this.enabled) return; this.pressed = true; this.quick = 1; this.pace = 1; this.holdMs = -1; this.settleT = 0; this.releaseAt = 0; this.start(); }
  /** Travel the bubble to the owner's new target on a slow glide (ms on the motion clock). */
  glide(ms: number) { if (!this.enabled) return; this.glideT = ms > 0 ? ms : 0; if (ms > 0) this.start(); }
  /**
   * Click / keyboard / programmatic toggle: grow + travel + settle + shrink in about --ul-switch-toggle-duration
   * (keyboard and programmatic 70 %). Travel 30 % (overlapping the grow), settle hold 11 %, shrink 34 % (measured total ≈ token).
   */
  toggle(kind: 'click' | 'key' = 'click') {
    if (!this.enabled) return;
    if (!this.live) this.show();
    const t = this.tok!, T = t.toggle * (kind === 'key' ? 0.62 : 1) /* the Space press has already started the grow: 0.62 lands at ≈ 70 % total */;
    if (this.o.earlyShrink) {
      const k = kind === 'key' ? 0.7 : 1;
      this.pressed = false; this.glideT = 0; this.settleT = t.settle * k; this.relK = k; this.releaseAt = performance.now();
      this.start();
      return;
    }
    this.glideT = 0.3 * T;
    this.pace = Math.min(1, (0.34 * T) / Math.max(1, t.shrink));
    this.holdMs = 0.11 * T;
    this.holdUntil = Math.max(this.holdUntil, performance.now() + 40 * getMorphTimeScale());
    this.start();
  }
  /** Persistent indicator: place the resting form on the owner's current target (layout change, no press). */
  private warned = false;
  rest() {
    if (!this.persistent || this.live || !this.el) return;
    this.tok = readLensTokens(this.o.host, this.o.kind);
    if (!this.warned) {
      this.warned = true;
      // dev: an overflow-clipping ancestor closer than the overgrow would crop the active indicator
      const hb = this.o.host.getBoundingClientRect(), og = this.tok.overgrow;
      for (let n = this.o.host.parentElement; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.overflow === 'visible' && cs.clipPath === 'none') continue;
        const r = n.getBoundingClientRect();
        if (hb.left - r.left < og || r.right - hb.right < og || hb.top - r.top < og || r.bottom - hb.bottom < og) {
          console.warn('[UL] lens indicator: an ancestor clips its ' + og + 'px overgrow (overflow ' + cs.overflow + '). Give the list ≥ ' + og + 'px of room or overflow: visible.', n);
        }
        break;
      }
    }
    const G = this.o.geometry();
    this.a = { x: G.c - G.w / 2, v: 0 }; this.b = { x: G.c + G.w / 2, v: 0 }; this.f = { x: G.c, v: 0 }; this.g = { x: 0, v: 0 };
    this.write(G);
  }
  release() {
    if (!this.pressed) return;
    this.pressed = false;
    if (this.o.earlyShrink && this.tok) { this.settleT = this.tok.settle; this.glideT = 0; this.releaseAt = performance.now(); this.relK = 1; }
    else this.holdUntil = performance.now() + 30;
    this.start();
  }
  /** Owner's target moved without a press (keyboard, click-to-jump, programmatic): keep the bubble up while it travels. */
  nudge(quick = 1) { if (!this.enabled) return; if (!this.live) this.quick = quick; this.holdUntil = Math.max(this.holdUntil, performance.now() + 60 * getMorphTimeScale()); this.start(); }
  /** Cancel immediately (unmount, disable). */
  kill() { cancelAnimationFrame(this.raf); this.raf = 0; this.pressed = false; this.settleT = this.glideT = 0; if (this.live) this.hide(); this.coast = false; this.o.onFrame?.(null); this.o.onLive?.(false); }
  destroy() { this.kill(); if (this.persistent && this.el) { detachGlass(this.el.glass); this.el.wrap.remove(); this.el = null; } const h = this.o.host as HTMLElement & { __ulLenses?: LensBubble[] }; if (h.__ulLenses) h.__ulLenses = h.__ulLenses.filter((x) => x !== this); }

  private start() {
    this.coast = false;
    if (!this.live) this.show();
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  }

  /** Cache the host rect (no layout reads per frame); refreshed on scroll / resize while live. */
  private measureHost = () => { const r = this.o.host.getBoundingClientRect(); this.host = { left: r.left, top: r.top }; };

  private show() {
    const host = this.o.host;
    this.tok = readLensTokens(host, this.o.kind);
    if (this.persistent) { this.showPersistent(); return; }
    const overGlass = !!host.closest('.ul-glass');
    const p = (this.el = take(overGlass ? 'flat' : 'auto'));
    // theme, backdrop and accent of the control (the layer lives at the root)
    const th = host.closest('[data-ul-theme]'), bd = host.closest('[data-ul-backdrop]');
    if (th) p.wrap.setAttribute('data-ul-theme', th.getAttribute('data-ul-theme')!); else p.wrap.removeAttribute('data-ul-theme');
    if (bd) p.wrap.setAttribute('data-ul-backdrop', bd.getAttribute('data-ul-backdrop')!); else p.wrap.removeAttribute('data-ul-backdrop');
    const cs = getComputedStyle(host);
    for (const k of ['--ul-accent', '--ul-lens-scale', '--ul-lens-magnify', '--ul-accent-level']) { const v = cs.getPropertyValue(k).trim(); if (v) p.wrap.style.setProperty(k, v); else p.wrap.style.removeProperty(k); }
    p.glass.style.setProperty('--ul-glass-magnify', String(this.tok.magnify));
    this.measureHost();
    addEventListener('scroll', this.measureHost, { passive: true, capture: true });
    addEventListener('resize', this.measureHost, { passive: true });
    // start exactly on the resting thumb
    const G = this.o.geometry();
    this.g = { x: 0, v: 0 };
    this.a = { x: G.c - G.w / 2, v: 0 }; this.b = { x: G.c + G.w / 2, v: 0 };
    this.lastC = G.c; this.tv = 0; this.stillMs = 0; this.fade = 0; this.f = { x: G.c, v: 0 };
    // size the element at its ACTIVE size, wake + measure the glass there (map cached per size), then animate from rest
    const act = this.activeSize(G);
    p.wrap.style.display = 'block';
    p.wrap.style.width = `${act.along}px`; p.wrap.style.height = `${act.cross}px`;
    if (this.o.axis === 'y') { p.wrap.style.width = `${act.cross}px`; p.wrap.style.height = `${act.along}px`; }
    p.glass.style.borderRadius = `${act.r}px`;
    p.glass.removeAttribute('data-ul-morphing');
    wakeGlass(p.glass, true);
    setGlassHot(p.glass, true);
    this.frozen = false; this.age = 0;
    this.live = true;
    this.o.onLive?.(true);
    this.write(G);
  }

  /** Same node as the resting indicator: inflate from where it rests now (a/b already there). */
  private showPersistent() {
    const p = this.el!, G = this.o.geometry();
    if (!this.tok) this.tok = readLensTokens(this.o.host, this.o.kind);
    if (!(this.b.x > this.a.x)) { this.a = { x: G.c - G.w / 2, v: 0 }; this.b = { x: G.c + G.w / 2, v: 0 }; }
    this.f = { x: (this.a.x + this.b.x) / 2, v: 0 };
    this.g = { x: 0, v: 0 };
    this.lastC = this.f.x; this.tv = 0; this.stillMs = 0; this.fade = 0;
    p.wrap.removeAttribute('data-rest');
    p.glass.removeAttribute('data-ul-morphing');
    wakeGlass(p.glass, true);
    setGlassHot(p.glass, true);
    this.frozen = false; this.age = 0;
    this.live = true;
    this.o.onLive?.(true);
    this.write(G);
  }

  private hide() {
    const p = this.el;
    if (this.persistent && p) {
      this.live = false;
      p.glass.removeAttribute('data-ul-morphing');
      setGlassHot(p.glass, false);
      setGlassMaterialize(p.glass, 0);
      setGlassGeometry(p.glass);
      releaseGlassTier(p.glass);
      wakeGlass(p.glass, false);
      p.wrap.setAttribute('data-rest', '');
      this.g = { x: 0, v: 0 }; this.pace = 1; this.holdMs = -1; this.releaseAt = 0;
      this.frame = { ...this.frame, live: false, k: 0, g: 0 };
      return;
    }
    this.live = false;
    removeEventListener('scroll', this.measureHost, { capture: true } as EventListenerOptions);
    removeEventListener('resize', this.measureHost);
    for (const k of this.o.knobs?.() ?? []) if (k) k.style.opacity = '';
    if (p) {
      p.glass.removeAttribute('data-ul-morphing');
      setGlassHot(p.glass, false);
      setGlassMaterialize(p.glass, 0);
      setGlassGeometry(p.glass);
      releaseGlassTier(p.glass);
      give(p);
    }
    this.el = null;
    this.releaseAt = 0;
    this.frame = { ...this.frame, live: false, alpha: 0, k: 0, g: 0 };
  }

  private activeSize(G: LensGeometry) {
    const t = this.tok!, L = t.scale;
    const cross = Math.max(G.h * L, G.wrap.cross + 2 * t.overgrow);
    const along = Math.max(G.w * L, G.w + 2 * t.overgrow, G.w + (cross - G.h));
    const r = t.radiusMode === 'fixed' ? t.radius : G.wrap.r + (cross - G.wrap.cross) / 2;
    return { along, cross, r: Math.min(r, cross / 2, along / 2) };
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (!this.live && !this.coast) return;
    const t = this.tok!, ts = getMorphTimeScale() * this.quick;
    const dtw = Math.min(34, Math.max(0, now - this.last)) || 16.7;
    this.last = now;
    const dt = dtw / ts / 1000;
    const G0 = this.o.geometry();
    // target: direct, or through the follow spring (held tabs) / a glide (click, toggle, press on another item)
    const T = this.glideT || (this.o.follow ? t.follow : 0);
    if (this.settleT && !isMorphReduced()) {
      // release / toggle: elastic settle (ζ floor → small overshoot + rebound)
      const zs = t.zetaMin;
      stepSpring(this.f, G0.c, 4 / (zs * Math.max(0.01, (this.settleT * this.relK) / 1000)), zs, dt);
      if (Math.abs(this.f.x - G0.c) < 0.15 && Math.abs(this.f.v) < 4) { this.f = { x: G0.c, v: 0 }; this.settleT = 0; }
    } else if (T && !isMorphReduced()) {
      stepSpring(this.f, G0.c, 5 / Math.max(0.005, T / 1000), 1, dt);
      // glides never jump: at most 1.8 % of the wrapper per frame (edge springs add a little) (far targets take a little longer)
      const vmax = (0.018 * Math.max(1, G0.wrap.hi - G0.wrap.lo)) / Math.max(1e-3, dtw / 1000);
      if (this.glideT && Math.abs(this.f.v) * (dt / Math.max(1e-6, dtw / 1000)) > vmax) { const sg = Math.sign(this.f.v), v2 = vmax / (dt / Math.max(1e-6, dtw / 1000)); this.f.x -= (this.f.v - sg * v2) * dt; this.f.v = sg * v2; }
    }
    else this.f = { x: G0.c, v: 0 };
    if (this.glideT && Math.abs(this.f.x - G0.c) < 0.3 && Math.abs(this.f.v) < 8) this.glideT = 0;
    const G = { ...G0, c: this.f.x };
    if (this.o.follow && this.persistent) Object.assign(G, this.o.geometryAt?.(this.f.x) ?? {});
    const dc = G.c - this.lastC;
    this.lastC = G.c;
    this.tv += ((dc / Math.max(1e-3, dt * 1000)) - this.tv) * 0.5; // px per motion-ms
    const moving = Math.abs(dc) > 0.05 || Math.abs(G0.c - G.c) > 0.3 || !!this.o.busy?.();
    this.stillMs = moving ? 0 : this.stillMs + dt * 1000;
    const act = this.activeSize(G);
    const reduced = isMorphReduced();
    // floatier than the raw overshoot ratio: ζ never below --ul-lens-zeta-min (soft overshoot, no snap)
    const z = Math.max(t.zetaMin, zetaFor(clamp(t.overshoot / (t.scale - 1), 0, 0.6)));
    let settled = true;
    if (reduced) {
      this.g = { x: 1, v: 0 };
      this.a = { x: G.c - G.w / 2, v: 0 }; this.b = { x: G.c + G.w / 2, v: 0 };
    } else {
      // edges (at REST size): leading edge stiffer than trailing, both slightly underdamped; growth is added in write()
      const half = G.w / 2;
      const dir = Math.abs(this.tv) > 0.002 ? Math.sign(this.tv) : 0;
      const wl = 4 / (z * Math.max(0.01, t.lead / 1000)), wt = 4 / (z * Math.max(0.01, t.trail / 1000));
      const [wa, wb] = dir > 0 ? [wt, wl] : dir < 0 ? [wl, wt] : [wl, wl];
      stepSpring(this.a, G.c - half, wa, z, dt);
      stepSpring(this.b, G.c + half, wb, z, dt);
      // stretch limits
      const W = 2 * half, w = this.b.x - this.a.x;
      const maxW = W * (1 + t.dragStretch), minW = W * (1 - t.dragStretch * 0.5);
      if (w > maxW) { if (dir >= 0) this.a.x = this.b.x - maxW; else this.b.x = this.a.x + maxW; }
      if (w < minW) { if (dir >= 0) this.a.x = this.b.x - minW; else this.b.x = this.a.x + minW; }
      settled = Math.abs(this.a.x - (G.c - half)) < 0.35 && Math.abs(this.b.x - (G.c + half)) < 0.35 && Math.abs(this.a.v) < 20 && Math.abs(this.b.v) < 20;
    }
    const hold = this.holdMs >= 0 ? this.holdMs : t.settleHold; // visible settle before the shrink
    const sinceRel = this.releaseAt ? now - this.releaseAt : -1;
    const early = !!this.o.earlyShrink && this.releaseAt > 0 && !this.pressed;
    const held = early
      ? sinceRel < t.shrinkStart * t.settle * this.relK * getMorphTimeScale() // shrink overlaps the settle
      : this.pressed || now < this.holdUntil || this.stillMs < hold || !settled;
    if (reduced) this.fade = clamp(this.fade + (held ? 1 : -1) * (dtw / (150 * getMorphTimeScale())));
    else {
      // shrink: same ζ floor, a touch stiffer (×0.9 time) so the exit is quick but still floats
      // early: the shrink must end by the linger cap → its spring time is what is left of the cap
      const Tg = early && !held
        ? Math.max(0.06, (t.linger * this.relK - t.shrinkStart * t.settle * this.relK) * 0.8) / 1000
        : ((held ? t.grow : t.shrink * 0.9) * this.pace) / 1000;
      stepSpring(this.g, held ? 1 : 0, 4 / (z * Math.max(0.05, Tg)), z, dt);
    }
    if (early && sinceRel >= t.linger * this.relK * getMorphTimeScale() && this.live) { this.g = { x: 0, v: 0 }; this.fade = 0; } // hard cap
    if (!this.frozen && this.el && (++this.age > 6 || this.el.glass.dataset.ulMode === 'refract')) { this.frozen = true; this.el.glass.setAttribute('data-ul-morphing', ''); }
    if (this.live || this.persistent) this.write(G, act);
    this.o.onFrame?.(G.c);
    const done = !held && (reduced ? this.fade <= 0 : Math.abs(this.g.x) < 0.004 && Math.abs(this.g.v) < 0.05);
    if (done && this.live) { this.hide(); this.coast = true; }
    // after the bubble is gone the flat thumb / indicator may still finish its settle alone
    const stillMoving = !!this.settleT || !!this.glideT || !settled;
    if (!this.live && !stillMoving) { this.coast = false; this.o.onFrame?.(null); this.o.onLive?.(false); return; }
    this.raf = requestAnimationFrame(this.tick);
  };

  private write(G: LensGeometry, act = this.activeSize(G)) {
    const p = this.el;
    if (!p) return;
    const reduced = isMorphReduced();
    const g = reduced ? 0 : this.g.x;
    const gk = clamp(g);
    const W = lerp(G.w, act.along, g), H = lerp(G.h, act.cross, g);
    // edges carry the travel + stretch at rest size; the growth (with its overshoot) pushes both outward
    const grow = (W - G.w) / 2;
    const a = this.a.x - grow, b = this.b.x + grow;
    const len = Math.max(1, b - a);
    // squash across in proportion to the stretch along
    const cross = Math.max(1, H * (1 - 0.5 * (len / Math.max(1, W) - 1)));
    const r = Math.max(0, Math.min(lerp(G.r, act.r, gk), cross / 2, len / 2));
    const y = this.o.axis === 'y';
    const x0 = y ? G.cc - cross / 2 : a, y0 = y ? a : G.cc - cross / 2;
    const w = y ? cross : len, h = y ? len : cross;
    const X = this.persistent ? x0 : this.host.left + x0, Y = this.persistent ? y0 : this.host.top + y0;
    p.wrap.style.transform = `translate3d(${X.toFixed(2)}px, ${Y.toFixed(2)}px, 0)`;
    p.wrap.style.width = `${w.toFixed(2)}px`;
    p.wrap.style.height = `${h.toFixed(2)}px`;
    p.wrap.style.borderRadius = `${r.toFixed(2)}px`;
    p.glass.style.borderRadius = `${r.toFixed(2)}px`;
    p.glass.style.setProperty('--ul-glass-radius', `${r.toFixed(2)}px`);
    const k = reduced ? this.fade : gk;
    const alpha = this.persistent ? 1 : reduced ? this.fade : smooth(clamp(g * 3));
    p.wrap.style.opacity = alpha.toFixed(3);
    p.wrap.style.setProperty('--ul-lens-k', k.toFixed(3));
    p.wrap.toggleAttribute('data-fallback', p.glass.dataset.ulMode !== 'refract');
    setGlassGeometry(p.glass, w, h);
    setGlassMaterialize(p.glass, k);
    for (const kn of this.o.knobs?.() ?? []) if (kn) kn.style.opacity = (1 - alpha).toFixed(3);
    this.frame = { x: X, y: Y, w, h, r, k, g, alpha, c: (this.a.x + this.b.x) / 2, t: this.o.geometry().c, live: this.live || this.persistent, mode: p.glass.dataset.ulMode || '', el: p.wrap };
  }
}
