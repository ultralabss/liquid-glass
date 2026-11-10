/** Point quadtree for nearest-point search (scatter hover, keyboard, brush). Built once per layout; no per-point listeners. */
export interface QuadTree { nearest(x: number, y: number, maxDist?: number): number; within(x0: number, y0: number, x1: number, y1: number): number[]; size: number }
interface Node { x0: number; y0: number; x1: number; y1: number; ids: number[] | null; kids: Node[] | null }
const CAP = 8;
export function buildQuadtree(xs: ArrayLike<number>, ys: ArrayLike<number>, skip?: (i: number) => boolean): QuadTree {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
  for (let i = 0; i < xs.length; i++) { if (skip?.(i) || !Number.isFinite(xs[i]) || !Number.isFinite(ys[i])) continue; n++; if (xs[i] < x0) x0 = xs[i]; if (xs[i] > x1) x1 = xs[i]; if (ys[i] < y0) y0 = ys[i]; if (ys[i] > y1) y1 = ys[i]; }
  const root: Node = { x0, y0, x1: Math.max(x1, x0 + 1), y1: Math.max(y1, y0 + 1), ids: [], kids: null };
  const insert = (nd: Node, i: number, depth: number) => {
    while (nd.kids) { const mx = (nd.x0 + nd.x1) / 2, my = (nd.y0 + nd.y1) / 2; nd = nd.kids[(xs[i] >= mx ? 1 : 0) + (ys[i] >= my ? 2 : 0)]; depth++; }
    nd.ids!.push(i);
    if (nd.ids!.length > CAP && depth < 16) {
      const mx = (nd.x0 + nd.x1) / 2, my = (nd.y0 + nd.y1) / 2, ids = nd.ids!;
      nd.kids = [[nd.x0, nd.y0, mx, my], [mx, nd.y0, nd.x1, my], [nd.x0, my, mx, nd.y1], [mx, my, nd.x1, nd.y1]].map(([a, b, c, d]) => ({ x0: a, y0: b, x1: c, y1: d, ids: [], kids: null }));
      nd.ids = null; for (const j of ids) insert(nd, j, depth);
    }
  };
  if (n) for (let i = 0; i < xs.length; i++) if (!(skip?.(i) || !Number.isFinite(xs[i]) || !Number.isFinite(ys[i]))) insert(root, i, 0);
  const box = (nd: Node, x: number, y: number) => { const dx = Math.max(nd.x0 - x, 0, x - nd.x1), dy = Math.max(nd.y0 - y, 0, y - nd.y1); return dx * dx + dy * dy; };
  return {
    size: n,
    nearest(x, y, maxDist = Infinity) {
      let best = -1, bd = maxDist * maxDist;
      const visit = (nd: Node) => {
        if (box(nd, x, y) > bd) return;
        if (nd.ids) { for (const i of nd.ids) { const d = (xs[i] - x) ** 2 + (ys[i] - y) ** 2; if (d < bd || (d === bd && i < best)) { bd = d; best = i; } } return; }
        const order = nd.kids!.map((k) => [box(k, x, y), k] as const).sort((a, b) => a[0] - b[0]);
        for (const [, k] of order) visit(k);
      };
      if (n) visit(root);
      return best;
    },
    within(ax, ay, bx, by) {
      const lx = Math.min(ax, bx), hx = Math.max(ax, bx), ly = Math.min(ay, by), hy = Math.max(ay, by), out: number[] = [];
      const visit = (nd: Node) => {
        if (nd.x1 < lx || nd.x0 > hx || nd.y1 < ly || nd.y0 > hy) return;
        if (nd.ids) { for (const i of nd.ids) if (xs[i] >= lx && xs[i] <= hx && ys[i] >= ly && ys[i] <= hy) out.push(i); return; }
        nd.kids!.forEach(visit);
      };
      if (n) visit(root);
      return out.sort((a, b) => a - b);
    },
  };
}
/** Brute-force reference (tests). */
export function nearestBrute(xs: ArrayLike<number>, ys: ArrayLike<number>, x: number, y: number) { let best = -1, bd = Infinity; for (let i = 0; i < xs.length; i++) { const d = (xs[i] - x) ** 2 + (ys[i] - y) ** 2; if (d < bd) { bd = d; best = i; } } return best; }
