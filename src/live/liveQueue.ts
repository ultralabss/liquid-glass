/**
 * The live-table queue rule for lists (notification centre, activity feed): structural changes (new / removed keys)
 * apply at once while the user is NOT interacting with the list; while the pointer or focus is inside it they queue
 * ("N new" pill) so nothing moves under the pointer. Leaving the list or apply() commits the queue.
 * Inserted rows get the table's soft insert (same tokens: --ul-data-insert-duration / -glow-duration / --ul-data-insert-bg,
 * springs.smooth); none under reduced motion except the glow.
 */
import * as React from 'react';
import { springs } from '../motion/spring.ts';
import { isMorphReduced, getMorphTimeScale } from '../motion/anchoredMorph.ts';

const tokMs = (k: string, f: number) => { if (typeof document === 'undefined') return f; const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };

export interface LiveQueue { shown: string[]; pending: number; apply: () => void; interacting: boolean; /** Callback ref for the list root (pointer / focus tracking + insert animation). */ ref: (el: HTMLElement | null) => void }

export function useLiveQueue(keys: string[], o: { hold?: boolean; animate?: boolean } = {}): LiveQueue {
  const rootRef = React.useRef<HTMLElement | null>(null), off = React.useRef<(() => void) | null>(null);
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  const shownRef = React.useRef<string[] | null>(null), busy = React.useRef(false), force = React.useRef(false);
  const holding = (busy.current || !!o.hold) && !force.current;
  if (shownRef.current === null || !holding) shownRef.current = keys;
  force.current = false;
  const shown = shownRef.current;
  const cur = new Set(keys), was = new Set(shown);
  const pending = keys.filter((k) => !was.has(k)).length + shown.filter((k) => !cur.has(k)).length;
  const apply = React.useCallback(() => { force.current = true; bump(); }, []);
  // pointer / focus inside = interacting (the live-table rule); attached when the list mounts (it may live in a popover)
  const ref = React.useCallback((el: HTMLElement | null) => {
    off.current?.(); off.current = null; rootRef.current = el;
    if (!el) { if (busy.current) { busy.current = false; bump(); } return; }
    let ptr = false, foc = false;
    const set = () => { const v = ptr || foc; if (v === busy.current) return; busy.current = v; if (!v) bump(); };
    const pe = () => { ptr = true; set(); }, pl = () => { ptr = false; set(); };
    const fi = () => { foc = true; set(); }, fo = (e: FocusEvent) => { if (!el.contains(e.relatedTarget as Node)) { foc = false; set(); } };
    el.addEventListener('pointerenter', pe); el.addEventListener('pointerleave', pl); el.addEventListener('focusin', fi); el.addEventListener('focusout', fo);
    off.current = () => { el.removeEventListener('pointerenter', pe); el.removeEventListener('pointerleave', pl); el.removeEventListener('focusin', fi); el.removeEventListener('focusout', fo); };
  }, []);
  React.useEffect(() => () => off.current?.(), []);
  // soft insert for keys that just became visible (never on the first render)
  const prev = React.useRef<Set<string> | null>(null);
  React.useLayoutEffect(() => {
    const p = prev.current; prev.current = new Set(shown);
    const el = rootRef.current; if (!p || !el || o.animate === false) return;
    const added = shown.filter((k) => !p.has(k)); if (!added.length) return;
    const reduced = isMorphReduced(), ts = getMorphTimeScale();
    const bg = getComputedStyle(el).getPropertyValue('--ul-data-insert-bg').trim() || 'rgb(143 184 255 / .3)';
    for (const k of added) {
      const n = el.querySelector<HTMLElement>(`[data-live-key="${CSS.escape(k)}"]`); if (!n) continue;
      if (!reduced) n.animate([{ opacity: 0, transform: 'scaleY(.4)', transformOrigin: '50% 0' }, { opacity: 1, transform: 'scaleY(1)', transformOrigin: '50% 0' }], { duration: tokMs('--ul-data-insert-duration', 360) * ts, easing: springs.smooth.toCSS() });
      n.animate([{ backgroundColor: bg }, { backgroundColor: 'transparent' }], { duration: tokMs('--ul-data-insert-glow-duration', 1600) * ts, easing: 'ease-out' });
    }
  }, [shown]);
  return { shown, pending: holding ? pending : 0, apply, interacting: busy.current, ref };
}

/** Throttled polite summary (one message per --ul-live-announce-gap). */
export function useThrottledAnnounce(say: (msg: string) => void) {
  const acc = React.useRef(0), t = React.useRef(0), fmt = React.useRef<(n: number) => string>(() => '');
  React.useEffect(() => () => clearTimeout(t.current), []);
  return React.useCallback((n: number, f: (n: number) => string) => {
    if (n <= 0) return; acc.current += n; fmt.current = f;
    if (t.current) return;
    t.current = window.setTimeout(() => { t.current = 0; const c = acc.current; acc.current = 0; if (c) say(fmt.current(c)); }, tokMs('--ul-live-announce-gap', 4000));
  }, [say]);
}
