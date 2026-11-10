export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';
export interface PlacementOptions { side?: Side; align?: Align; offset?: number; padding?: number;
  /** Cover the anchor instead of sitting beside it: the surface overlaps the anchor rect with this inset on the leading edge and the aligned edge (covered non-modal popovers). */
  cover?: number }
export interface Placement { x: number; y: number; side: Side; align: Align }

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Side/alignment with collision detection: flips to the opposite side if it has more room, then shifts into the viewport. */
export function computePlacement(a: DOMRect, w: number, h: number, { side = 'bottom', align = 'center', offset = 8, padding = 8, cover }: PlacementOptions = {}): Placement {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (cover != null) {
    // grows from the anchor's far edge over the anchor: bottom → top edge at a.top − cover; aligned edge outset by cover
    const v = side === 'top' || side === 'bottom';
    let s = side;
    if (v) { const room = s === 'bottom' ? vh - a.top : a.bottom; if (room < h + padding && (s === 'bottom' ? a.bottom : vh - a.top) > room) s = s === 'bottom' ? 'top' : 'bottom'; }
    else { const room = s === 'right' ? vw - a.left : a.right; if (room < w + padding && (s === 'right' ? a.right : vw - a.left) > room) s = s === 'right' ? 'left' : 'right'; }
    let x: number, y: number;
    if (v) { y = s === 'bottom' ? a.top - cover : a.bottom + cover - h; x = align === 'start' ? a.left - cover : align === 'end' ? a.right + cover - w : a.left + a.width / 2 - w / 2; }
    else { x = s === 'right' ? a.left - cover : a.right + cover - w; y = align === 'start' ? a.top - cover : align === 'end' ? a.bottom + cover - h : a.top + a.height / 2 - h / 2; }
    return { x: clamp(x, padding, vw - padding - w), y: clamp(y, padding, vh - padding - h), side: s, align };
  }
  const space: Record<Side, number> = { top: a.top, bottom: vh - a.bottom, left: a.left, right: vw - a.right };
  const vertical = (s: Side) => s === 'top' || s === 'bottom';
  const need = (vertical(side) ? h : w) + offset + padding;
  let s = side;
  if (space[s] < need && space[OPPOSITE[s]] > space[s]) s = OPPOSITE[s];
  let x: number, y: number;
  if (vertical(s)) {
    y = s === 'bottom' ? a.bottom + offset : a.top - offset - h;
    x = align === 'start' ? a.left : align === 'end' ? a.right - w : a.left + a.width / 2 - w / 2;
  } else {
    x = s === 'right' ? a.right + offset : a.left - offset - w;
    y = align === 'start' ? a.top : align === 'end' ? a.bottom - h : a.top + a.height / 2 - h / 2;
  }
  return { x: clamp(x, padding, vw - padding - w), y: clamp(y, padding, vh - padding - h), side: s, align };
}
