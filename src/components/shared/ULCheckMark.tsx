import * as React from 'react';
import { isMorphReduced, getMorphTimeScale, overshootEase } from '../../motion/anchoredMorph.ts';
import './ULCheckMark.css';

/* =====================================================================
 * ULCheckMark: the one check for every list, menu and picker.
 * Enter (real change only): stroke draws in, scale --ul-check-from-scale → 1 on a soft overshoot, fade; starts
 * --ul-check-stagger after the change so the previous item's exit (fade + scale → --ul-check-exit-scale) leads and the
 * handover reads as a transfer. First mount / overlay open: the selected item shows its check at once. The slot width
 * is fixed, labels never move. Reduced motion: opacity only, --ul-check-reduced.
 * ===================================================================== */
export interface ULCheckMarkProps { checked: boolean; className?: string }

const num = (cs: CSSStyleDeclaration, k: string, f: number) => { const v = parseFloat(cs.getPropertyValue(k)); return Number.isFinite(v) ? v : f; };

/** Imperative enter / exit on a .ul-check element (exported for owners that toggle outside React). */
export function animateCheck(el: HTMLElement, on: boolean) {
  const svg = el.firstElementChild as SVGElement | null, path = svg?.firstElementChild as SVGPathElement | null;
  if (!svg || !path) return;
  const cs = getComputedStyle(el), ts = getMorphTimeScale();
  // the DOM already shows the NEW rest state: start from the running animation's value, else from the previous rest state
  const running = svg.getAnimations().length > 0, op0 = running ? parseFloat(getComputedStyle(svg).opacity) || 0 : on ? 0 : 1;
  svg.getAnimations().forEach((a) => a.cancel()); path.getAnimations().forEach((a) => a.cancel());
  const info = { on, t0: document.timeline.currentTime as number, from: op0 };
  (el as HTMLElement & { __ulCheck?: typeof info }).__ulCheck = info;
  if (isMorphReduced()) { svg.animate([{ opacity: op0 }, { opacity: on ? 1 : 0 }], { duration: num(cs, '--ul-check-reduced', 100) * ts, easing: 'linear' }); return; }
  if (on) {
    const D = num(cs, '--ul-check-enter', 220) * ts, delay = num(cs, '--ul-check-stagger', 40) * ts, s0 = num(cs, '--ul-check-from-scale', 0.6);
    svg.animate([{ transform: `scale(${s0})` }, { transform: 'scale(1)' }], { duration: D * 1.6, delay, easing: overshootEase(num(cs, '--ul-check-overshoot', 0.12)), fill: 'backwards' });
    svg.animate([{ opacity: op0 }, { opacity: 1 }], { duration: D * 0.7, delay, easing: 'linear', fill: 'backwards' });
    path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: D, delay, easing: 'cubic-bezier(.35,.6,.25,1)', fill: 'backwards' });
  } else {
    const D = num(cs, '--ul-check-exit', 140) * ts, s1 = num(cs, '--ul-check-exit-scale', 0.7);
    svg.animate([{ opacity: op0, transform: 'scale(1)' }, { opacity: 0, transform: `scale(${s1})` }], { duration: D, easing: 'cubic-bezier(.4,0,1,1)' });
  }
}

export function ULCheckMark({ checked, className }: ULCheckMarkProps) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const prev = React.useRef(checked);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prev.current === checked) return;
    prev.current = checked;
    animateCheck(el, checked);
  }, [checked]);
  return (
    <span ref={ref} className={className ? `ul-check ${className}` : 'ul-check'} data-on={checked ? '' : undefined} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false"><path d="M5 12.6l4.3 4.3L19.2 7" pathLength={1}></path></svg>
    </span>
  );
}
