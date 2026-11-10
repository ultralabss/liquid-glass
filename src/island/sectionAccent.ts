/**
 * Page-aware accent: picks the [data-ul-accent] element under the island's
 * center line and reports its accent. IntersectionObserver tracks which
 * candidates are on screen; geometry decides the winner (deepest element
 * containing the line, so list items beat their section). Hysteresis keeps
 * the current winner until the line is `hysteresis` px past its edge, and a
 * switch only commits after `delay` ms of stability, so fast scrolling never
 * flickers through intermediate sections. Framework-agnostic.
 */
import { isGlassScrolling } from '../glass/engine.ts';
export interface SectionAccentOptions {
  /** The island (or any element whose vertical center is the sampling line). */
  island: HTMLElement;
  /** Where to look for candidates. Default: document. */
  scope?: ParentNode;
  /** Scroll container (IntersectionObserver root). Default: viewport. */
  root?: Element | null;
  selector?: string;
  /** Reported when no candidate is under the island. */
  fallback?: string | null;
  /** Called with the accent under the island (or the fallback) after it settles. */
  onValueChange: (accent: string | null, el: Element | null) => void;
  /** ms of stability before switching. Default --ul-island-switch-delay (140). */
  delay?: number;
  /** px past the current element's edge before it loses. Default --ul-island-hysteresis (24). */
  hysteresis?: number;
}

const token = (name: string, fallback: number) => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
};

export function observeSectionAccent(o: SectionAccentOptions): () => void {
  const sel = o.selector ?? '[data-ul-accent]';
  const scope = o.scope ?? document;
  const delay = o.delay ?? token('--ul-island-switch-delay', 140);
  const hyst = o.hysteresis ?? token('--ul-island-hysteresis', 24);
  const visible = new Set<Element>();
  const observed = new Set<Element>();
  let current: Element | null | undefined;
  let pending: Element | null | undefined;
  let timer = 0, raf = 0, rescanTimer = 0, dead = false;

  const depth = (el: Element) => { let d = 0; for (let n: Element | null = el; n; n = n.parentElement) d++; return d; };
  const lineY = () => { const r = o.island.getBoundingClientRect(); return r.top + r.height / 2; };
  const holds = (el: Element, y: number, m: number) => { const r = el.getBoundingClientRect(); return r.height > 0 && y >= r.top - m && y <= r.bottom + m; };

  const commit = (el: Element | null) => {
    current = el;
    pending = undefined;
    o.onValueChange(el ? el.getAttribute('data-ul-accent') || o.fallback || null : o.fallback ?? null, el);
  };

  const pick = () => {
    raf = 0;
    if (dead) return;
    const y = lineY();
    let best: Element | null = null, bd = -1;
    for (const el of visible) {
      if (o.island.contains(el) || el.contains(o.island)) continue;
      if (!holds(el, y, 0)) continue;
      const d = depth(el);
      if (d > bd) { bd = d; best = el; }
    }
    // hysteresis: the current element keeps the island until the line is well past it (unless we moved into a child of it)
    if (current && current !== best && current.isConnected && holds(current, y, hyst) && !(best && current.contains(best))) best = current;
    if (current === undefined) { commit(best); return; }
    if (best === current) { clearTimeout(timer); pending = undefined; return; }
    if (best === pending) return;
    pending = best;
    clearTimeout(timer);
    // the accent never changes while the page scrolls (glass state is frozen); it commits once scrolling is idle
    const tryCommit = () => { if (isGlassScrolling()) { timer = window.setTimeout(tryCommit, 60); return; } commit(pending ?? null); };
    timer = window.setTimeout(tryCommit, delay);
  };
  const schedule = () => { if (!raf && !dead) raf = requestAnimationFrame(pick); };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); }
    schedule();
  }, { root: o.root ?? null, threshold: [0, 0.5, 1] });

  const rescan = () => {
    if (dead) return;
    const now = new Set(Array.from(scope.querySelectorAll(sel)));
    for (const el of observed) if (!now.has(el)) { io.unobserve(el); observed.delete(el); visible.delete(el); }
    for (const el of now) if (!observed.has(el)) { io.observe(el); observed.add(el); }
    schedule();
  };
  const mo = new MutationObserver(() => { clearTimeout(rescanTimer); rescanTimer = window.setTimeout(rescan, 80); });
  mo.observe(scope instanceof Document ? scope.documentElement : (scope as Element), { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ul-accent'] });
  const scrollTarget: EventTarget = o.root ?? window;
  scrollTarget.addEventListener('scroll', schedule, { passive: true, capture: true });
  window.addEventListener('resize', schedule, { passive: true });
  rescan();

  return () => {
    dead = true;
    clearTimeout(timer); clearTimeout(rescanTimer); cancelAnimationFrame(raf);
    io.disconnect(); mo.disconnect();
    scrollTarget.removeEventListener('scroll', schedule, { capture: true } as EventListenerOptions);
    window.removeEventListener('resize', schedule);
  };
}
