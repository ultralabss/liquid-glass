import * as React from 'react';
import { AnchoredMorph, type MorphOptions } from '../motion/anchoredMorph.ts';

export interface UseAnchoredMorphOptions extends MorphOptions {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Soft scrim whose opacity rides the morph timeline (modals, drawers). */
  scrimRef?: React.RefObject<HTMLElement | null>;
}

/**
 * The single enter/exit implementation for anchored overlays. Returns refs for
 * the surface, the content stage and the goo layer, plus `mounted`, which
 * stays true until the exit animation has been absorbed into the anchor.
 */
export function useAnchoredMorph({ open, anchorRef, side = 'bottom', align = 'center', offset, scrollBehavior, onAnchorHidden, onRequestClose, layout, manual, anchorOnTop, coverAnchor, overlap, scrimRef }: UseAnchoredMorphOptions) {
  const closeRef = React.useRef(onRequestClose); closeRef.current = onRequestClose;
  const requestClose = React.useCallback(() => closeRef.current?.(), []);
  const surfaceRef = React.useRef<HTMLElement | null>(null);
  const stageRef = React.useRef<HTMLElement | null>(null);
  const gooRef = React.useRef<HTMLElement | null>(null);
  const ctrl = React.useRef<AnchoredMorph | null>(null);
  const [mounted, setMounted] = React.useState(open);
  // Owners may drop the anchor ref while closing (row actions: the row's button is the anchor of the selected row).
  // The exit still runs, back to the last anchor (or a fade at the last position if it is gone).
  const lastAnchor = React.useRef<HTMLElement | null>(null);
  if (anchorRef.current) lastAnchor.current = anchorRef.current;
  if (open && !mounted) setMounted(true);

  React.useLayoutEffect(() => {
    if (!mounted) return;
    const surface = surfaceRef.current, anchor = anchorRef.current ?? lastAnchor.current;
    if (!surface || !anchor) {
      // nothing to animate: never leave a mounted, open-looking surface behind
      if (!open) setMounted(false);
      else if (!anchor && typeof console !== 'undefined') console.error('[UL] useAnchoredMorph: open without an anchor; closing.'), requestClose();
      return;
    }
    if (!ctrl.current) {
      ctrl.current = new AnchoredMorph(
        { anchor, surface, stage: stageRef.current, goo: gooRef.current, scrim: scrimRef?.current ?? null },
        { side, align, offset, scrollBehavior, onAnchorHidden, onRequestClose: requestClose, layout, manual, anchorOnTop, coverAnchor, overlap },
      );
    }
    const c = ctrl.current;
    c.anchor = anchor;
    c.scrim = scrimRef?.current ?? null;
    c.setOptions({ side, align, offset, scrollBehavior, onAnchorHidden, onRequestClose: requestClose, layout, manual, anchorOnTop, coverAnchor, overlap });
    if (open) { void c.enter(); return; }
    let alive = true;
    void c.exit().then((done) => { if (done && alive) setMounted(false); });
    return () => { alive = false; };
  }, [open, mounted, side, align, offset, layout]);

  React.useLayoutEffect(() => {
    if (mounted) return;
    ctrl.current?.destroy();
    ctrl.current = null;
  }, [mounted]);

  React.useEffect(() => () => { ctrl.current?.destroy(); ctrl.current = null; }, []);

  return { mounted, surfaceRef, stageRef, gooRef, morphRef: ctrl };
}
