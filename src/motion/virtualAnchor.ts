/**
 * Virtual anchors: an invisible, fixed, zero-cost element that stands in for a trigger the anchored morph can start from
 * (the morph needs a real element for its rect, radius and hole). Used for:
 * - context menus: the pointer point (0 × 0 rect), so the menu pours out of the cursor;
 * - drawers / edge sheets: a 0-thick strip along a viewport edge, so the surface grows in from that edge;
 * - the command palette without a search trigger: a small capsule at the viewport centre.
 * A 0-size anchor has no hole (nothing to keep visible).
 */
export interface VirtualRect { x: number; y: number; w: number; h: number; r?: number }
export interface VirtualAnchor { el: HTMLElement; set(r: VirtualRect): void; destroy(): void }

export function createVirtualAnchor(r: VirtualRect): VirtualAnchor {
  const el = document.createElement('span');
  el.setAttribute('data-ul-virtual-anchor', '');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;pointer-events:none;visibility:hidden;margin:0;padding:0;border:0;contain:strict';
  const set = (v: VirtualRect) => {
    el.style.left = `${v.x}px`; el.style.top = `${v.y}px`;
    el.style.width = `${Math.max(0, v.w)}px`; el.style.height = `${Math.max(0, v.h)}px`;
    el.style.borderRadius = `${v.r ?? 0}px`;
  };
  set(r);
  document.body.appendChild(el);
  return { el, set, destroy: () => el.remove() };
}

const vw = () => document.documentElement.clientWidth || innerWidth;
export type Edge = 'left' | 'right' | 'top' | 'bottom';
/** 0-thick strip along an edge of the layout viewport. */
export function edgeRect(edge: Edge): VirtualRect {
  const W = vw(), H = innerHeight;
  if (edge === 'left') return { x: 0, y: 0, w: 0, h: H };
  if (edge === 'right') return { x: W, y: 0, w: 0, h: H };
  if (edge === 'top') return { x: 0, y: 0, w: W, h: 0 };
  return { x: 0, y: H, w: W, h: 0 };
}
/** Small capsule at the viewport centre (command palette without a trigger). */
export function centerRect(w = 96, h = 44): VirtualRect { return { x: vw() / 2 - w / 2, y: innerHeight * 0.3 - h / 2, w, h, r: h / 2 }; }
/** The pointer point (context menu). */
export function pointRect(x: number, y: number): VirtualRect { return { x, y, w: 0, h: 0 }; }
