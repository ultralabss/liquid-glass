/**
 * Same-surface view swap (shared by ULDialogSurface push / pop and the phone menu drill-in).
 * X fades out with a directional slide, the surface morphs left / top / width / height to Y's MEASURED size on the dialog
 * spring, Y's blocks enter at --ul-dialog-enter-at with --ul-dialog-stagger. Interruptible: it always starts from the
 * surface's current visual rect and X's current opacity. Reduced motion: 150ms crossfade, geometry instant.
 */
import { isMorphReduced, getMorphTimeScale, overshootEase, type AnchoredMorph } from './anchoredMorph.ts';
import { setGlassGeometry, releaseGlassTier } from '../glass/engine.ts';

export interface SwapAnims { surf?: Animation; out: Animation[]; inn: Animation[]; raf: number }
export const newSwapAnims = (): SwapAnims => ({ out: [], inn: [], raf: 0 });
const ms = (el: Element, k: string, f: number) => (parseFloat(getComputedStyle(el).getPropertyValue(k)) || f) * getMorphTimeScale();
const num = (el: Element, k: string, f: number) => { const v = parseFloat(getComputedStyle(el).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };

export interface SwapOptions {
  surface: HTMLElement;
  from: HTMLElement | null | undefined;
  to: HTMLElement;
  /** 1 = forward (push / drill in), −1 = back. */
  dir: 1 | -1;
  morph: AnchoredMorph | null;
  anims: SwapAnims;
  /** Called after X is out of flow and Y is in flow, before measuring (size class changes). */
  prepare?: () => void;
  /** Final placement; default the morph's finalFor(w, h). */
  place?: (w: number, h: number) => { L: number; T: number };
  onDone?: () => void;
}

export function cancelSwap(A: SwapAnims) { A.surf?.cancel(); A.out.forEach((a) => a.cancel()); A.inn.forEach((a) => a.cancel()); cancelAnimationFrame(A.raf); A.surf = undefined; A.out = []; A.inn = []; }

export function runViewSwap(o: SwapOptions): void {
  const { surface: s, from: X, to: Y, dir, morph: m, anims: A } = o;
  const reduced = isMorphReduced() || !!(window as Window & { __ulGlassDebug?: { noViewSwap?: boolean } }).__ulGlassDebug?.noViewSwap;
  const r0 = s.getBoundingClientRect();
  cancelSwap(A);
  const xOp = X ? parseFloat(getComputedStyle(X).opacity) : 0;
  if (X) { X.style.position = 'absolute'; X.style.inset = '0 0 auto 0'; X.style.pointerEvents = 'none'; }
  Y.style.cssText = ''; Y.hidden = false; Y.style.opacity = '0';
  o.prepare?.();
  s.style.width = ''; s.style.height = '';
  const w1 = s.offsetWidth, h1 = s.offsetHeight;
  const fin = o.place ? o.place(w1, h1) : m ? m.finalFor(w1, h1) : { L: r0.left, T: r0.top };
  const shift = num(s, '--ul-dialog-content-shift', 14), blur = num(s, '--ul-dialog-content-blur', 0), mode = s.closest('[data-ul-dialog-mode]')?.getAttribute('data-ul-dialog-mode') ?? 'slide';
  const blurOn = mode !== 'slide' ? Math.max(blur, 4) : blur, slideOn = mode !== 'blur';
  const D = ms(s, '--ul-dialog-morph-duration', 480), Dout = ms(s, '--ul-dialog-content-out', 200), Din = ms(s, '--ul-dialog-content-in', 320), at = num(s, '--ul-dialog-enter-at', 0.6), stagger = ms(s, '--ul-dialog-stagger', 30);
  const done = () => {
    cancelAnimationFrame(A.raf); s.removeAttribute('data-ul-morphing'); setGlassGeometry(s); releaseGlassTier(s);
    m?.setFinalRect(fin.L, fin.T, w1, h1);
    o.onDone?.();
  };
  if (reduced) {
    s.style.left = `${fin.L}px`; s.style.top = `${fin.T}px`;
    A.out = X ? [X.animate([{ opacity: xOp }, { opacity: 0 }], { duration: 150 * getMorphTimeScale(), fill: 'forwards' })] : [];
    A.inn = [Y.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 * getMorphTimeScale(), fill: 'forwards' })];
    A.inn[0].finished.then(() => { Y.style.opacity = ''; A.inn.forEach((a) => a.cancel()); done(); }, () => {});
    return;
  }
  s.setAttribute('data-ul-morphing', '');
  s.style.left = `${fin.L}px`; s.style.top = `${fin.T}px`;
  const ease = overshootEase(num(s, '--ul-dialog-morph-overshoot', 0.035));
  A.surf = s.animate([
    { left: `${r0.left}px`, top: `${r0.top}px`, width: `${r0.width}px`, height: `${r0.height}px` },
    { left: `${fin.L}px`, top: `${fin.T}px`, width: `${w1}px`, height: `${h1}px` },
  ], { duration: D, easing: ease });
  const tick = () => { const b = s.getBoundingClientRect(); setGlassGeometry(s, b.width, b.height); A.raf = requestAnimationFrame(tick); };
  tick();
  const outT = (p: number) => `translate(${slideOn ? (dir * -shift * p).toFixed(1) : 0}px, 0)`;
  A.out = X ? [X.animate([{ opacity: xOp, transform: outT(1 - xOp), filter: `blur(${(blurOn * (1 - xOp)).toFixed(1)}px)` }, { opacity: 0, transform: outT(1), filter: `blur(${blurOn}px)` }],
    { duration: Dout * Math.max(0.3, xOp), easing: 'cubic-bezier(.3,0,.8,.4)', fill: 'forwards' })] : [];
  Y.style.opacity = '1';
  const blocks = [...Y.children] as HTMLElement[];
  const inEase = overshootEase(0.05);
  A.inn = blocks.map((b, i) => b.animate([{ opacity: 0, transform: `translate(${slideOn ? dir * shift : 0}px, 0)`, filter: `blur(${blurOn}px)` }, { opacity: 1, transform: 'translate(0, 0)', filter: 'blur(0px)' }],
    { duration: Din, delay: D * at + i * stagger, easing: inEase, fill: 'backwards' }));
  Promise.all([A.surf.finished, ...A.inn.map((a) => a.finished)]).then(() => { A.inn.forEach((a) => a.cancel()); done(); }, () => {});
}
