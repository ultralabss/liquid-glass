import * as React from 'react';
import { trackPointer, untrackPointer } from '../glass/engine.ts';

/**
 * Writes --mx / --my / --ul-light / --ul-rim-angle onto any element from the
 * shared rAF-throttled pointer loop. ULGlass already does this for itself.
 */
export function usePointerLight<T extends HTMLElement>(ref: React.RefObject<T>, enabled = true): void {
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    trackPointer(el);
    return () => untrackPointer(el);
  }, [ref, enabled]);
}
