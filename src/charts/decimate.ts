/**
 * Largest-Triangle-Three-Buckets decimation (Steinarsson) for drawing only: tooltip, keyboard and table keep every point.
 * Output: sorted indices, exactly `threshold` long when n > threshold (first, last, one per bucket); the global minimum
 * and maximum are always kept (they replace their bucket's pick). Null values are kept so gaps survive.
 */
export function lttb(xs: ArrayLike<number>, ys: ArrayLike<number | null>, threshold: number): number[] {
  const n = ys.length;
  if (threshold >= n || threshold < 3) return Array.from({ length: n }, (_, i) => i);
  let mn = -1, mx = -1;
  for (let i = 0; i < n; i++) { const v = ys[i]; if (v == null) continue; if (mn < 0 || v < (ys[mn] as number)) mn = i; if (mx < 0 || v > (ys[mx] as number)) mx = i; }
  const out: number[] = [0], every = (n - 2) / (threshold - 2);
  let a = 0;
  for (let b = 0; b < threshold - 2; b++) {
    const s = Math.floor(b * every) + 1, e = Math.min(n - 1, Math.floor((b + 1) * every) + 1);
    const ns = e, ne = Math.min(n, Math.floor((b + 2) * every) + 1);
    let ax = 0, ay = 0, c = 0; for (let j = ns; j < ne; j++) { const v = ys[j]; if (v == null) continue; ax += xs[j]; ay += v; c++; }
    if (c) { ax /= c; ay /= c; } else { ax = xs[Math.min(n - 1, ns)]; ay = (ys[a] as number) ?? 0; }
    let pick = s, best = -1, forced = -1;
    const pa = xs[a], pv = (ys[a] as number) ?? 0;
    for (let j = s; j < e; j++) {
      if (j === mn || j === mx) forced = j;
      const v = ys[j]; if (v == null) { forced = forced < 0 ? j : forced; continue; }
      const area = Math.abs((pa - ax) * (v - pv) - (pa - xs[j]) * (ay - pv));
      if (area > best) { best = area; pick = j; }
    }
    if (forced >= 0) pick = forced;
    out.push(pick); a = pick;
  }
  out.push(n - 1);
  return out;
}
/** Canvas renderer switch point (token --ul-chart-canvas-at, default 5000 points). */
export function canvasThreshold() {
  if (typeof document === 'undefined') return 5000;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ul-chart-canvas-at'));
  return Number.isFinite(v) && v > 0 ? v : 5000;
}
