import * as React from 'react';

/** Dev-only checks. Production builds (dist/ul-glass.min.js) set window.__UL_PROD__ = true and every warning is skipped. */
export const isDev = () => typeof window !== 'undefined' && (window as unknown as { __UL_PROD__?: boolean }).__UL_PROD__ !== true;

const warned = new WeakMap<Element, Set<string>>();
/** console.warn once per element and key. */
export function warnOnce(el: Element, key: string, msg: string): void {
  if (!isDev()) return;
  let s = warned.get(el);
  if (!s) { s = new Set(); warned.set(el, s); }
  if (s.has(key)) return;
  s.add(key);
  console.warn(`[UL] ${msg}`, el);
}

export type Surface = 'glass' | 'solid' | 'busy';
/**
 * What the element sits on: the nearest ancestor that paints something. Glass (.ul-glass), an explicit
 * data-ul-surface="solid|busy", an opaque background color (solid) or a background image / gradient (busy).
 */
export function surfaceBehind(el: Element): Surface {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const tag = n.getAttribute('data-ul-surface');
    if (tag === 'busy' || tag === 'solid' || tag === 'glass') return tag;
    if (n.classList.contains('ul-glass')) return 'glass';
    const cs = getComputedStyle(n);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'busy';
    const m = cs.backgroundColor.match(/[\d.]+/g);
    if (m && (m.length < 4 || +m[3] > 0.9)) return 'solid';
  }
  return 'solid';
}

/** Measures the surface once after mount. Returns true when the element sits directly on a busy backdrop. */
export function useBareOnBusy(ref: React.RefObject<HTMLElement | null>, warn?: string): boolean {
  const [bare, setBare] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setBare(surfaceBehind(el) === 'busy');
    // Re-check once styles have settled (token stylesheets can arrive after mount); warn only then.
    const t = window.setTimeout(() => { if (!el.isConnected) return; const busy = surfaceBehind(el) === 'busy'; setBare(busy); if (busy && warn) warnOnce(el, 'surface', warn); }, 1200);
    return () => clearTimeout(t);
  }, []);
  return bare;
}
