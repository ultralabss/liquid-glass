/**
 * Chart core: scales, nice ticks, locale formatting. Pure functions, no DOM.
 * Scales map a domain to a pixel range; every scale exposes ticks() and, where it makes sense, invert().
 */
import { numberFormat, resolveLocale } from '../components/ULData/ULKpi.tsx';

export interface LinearScale { kind: 'linear' | 'log'; domain: [number, number]; range: [number, number]; (v: number): number; ticks(n?: number): number[]; invert(px: number): number }
export interface BandScale { kind: 'band'; count: number; range: [number, number]; (i: number): number; bandwidth: number; step: number; invert(px: number): number }
export interface PointScale { kind: 'point'; count: number; range: [number, number]; (i: number): number; step: number; invert(px: number): number }
export interface TimeScale { kind: 'time'; domain: [number, number]; range: [number, number]; (t: number): number; ticks(n?: number): number[]; invert(px: number): number }

const E10 = Math.sqrt(50), E5 = Math.sqrt(10), E2 = Math.sqrt(2);
/** d3-style tick step: 1, 2 or 5 × 10^k. */
export function tickStep(lo: number, hi: number, count: number) {
  const s0 = Math.abs(hi - lo) / Math.max(1, count), p = Math.pow(10, Math.floor(Math.log10(s0 || 1))), e = s0 / p;
  return (e >= E10 ? 10 : e >= E5 ? 5 : e >= E2 ? 2 : 1) * p;
}
/** Extends a domain to round tick values. Keeps 0 when the data crosses or touches it. */
export function niceDomain(lo: number, hi: number, count = 5): [number, number] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (lo === hi) { if (lo === 0) return [0, 1]; const pad = Math.abs(lo) * 0.1; lo -= pad; hi += pad; }
  for (let k = 0; k < 2; k++) { const s = tickStep(lo, hi, count); lo = Math.floor(lo / s) * s; hi = Math.ceil(hi / s) * s; }
  return [lo, hi];
}
export function linearTicks(lo: number, hi: number, count = 5) {
  const s = tickStep(lo, hi, count), out: number[] = [];
  for (let v = Math.ceil(lo / s) * s; v <= hi + s * 1e-9; v += s) out.push(Math.abs(v) < s * 1e-9 ? 0 : +v.toPrecision(12));
  return out;
}
export function scaleLinear(domain: [number, number], range: [number, number]): LinearScale {
  const [d0, d1] = domain, [r0, r1] = range, k = (r1 - r0) / (d1 - d0 || 1);
  const f = ((v: number) => r0 + (v - d0) * k) as LinearScale;
  return Object.assign(f, { kind: 'linear' as const, domain, range, ticks: (n = 5) => linearTicks(d0, d1, n), invert: (px: number) => d0 + (px - r0) / k });
}
export function scaleLog(domain: [number, number], range: [number, number]): LinearScale {
  const d0 = Math.max(1e-9, domain[0]), d1 = Math.max(d0 * 10, domain[1]), l0 = Math.log10(d0), l1 = Math.log10(d1), [r0, r1] = range, k = (r1 - r0) / (l1 - l0 || 1);
  const f = ((v: number) => r0 + (Math.log10(Math.max(d0, v)) - l0) * k) as LinearScale;
  const ticks = () => { const out: number[] = []; for (let e = Math.floor(l0); e <= Math.ceil(l1); e++) { const v = Math.pow(10, e); if (v >= d0 * 0.999 && v <= d1 * 1.001) out.push(v); } return out; };
  return Object.assign(f, { kind: 'log' as const, domain: [d0, d1] as [number, number], range, ticks, invert: (px: number) => Math.pow(10, l0 + (px - r0) / k) });
}
export function logDomain(lo: number, hi: number): [number, number] { const a = Math.max(1e-9, lo); return [Math.pow(10, Math.floor(Math.log10(a))), Math.pow(10, Math.ceil(Math.log10(Math.max(a * 10, hi))))]; }
export function scaleBand(count: number, range: [number, number], padding = 0.22): BandScale {
  const [r0, r1] = range, step = (r1 - r0) / Math.max(1, count), bw = step * (1 - padding);
  const f = ((i: number) => r0 + i * step + (step - bw) / 2) as BandScale;
  return Object.assign(f, { kind: 'band' as const, count, range, bandwidth: bw, step, invert: (px: number) => Math.max(0, Math.min(count - 1, Math.floor((px - r0) / step))) });
}
export function scalePoint(count: number, range: [number, number]): PointScale {
  const [r0, r1] = range, step = count > 1 ? (r1 - r0) / (count - 1) : 0;
  const f = ((i: number) => (count > 1 ? r0 + i * step : (r0 + r1) / 2)) as PointScale;
  return Object.assign(f, { kind: 'point' as const, count, range, step, invert: (px: number) => (count > 1 ? Math.max(0, Math.min(count - 1, Math.round((px - r0) / step))) : 0) });
}
const TIME_STEPS = [1e3, 5e3, 15e3, 3e4, 6e4, 3e5, 9e5, 18e5, 36e5, 108e5, 216e5, 432e5, 864e5, 1728e5, 6048e5, 2592e6, 7776e6, 31536e6];
export function scaleTime(domain: [number, number], range: [number, number]): TimeScale {
  const [d0, d1] = domain, [r0, r1] = range, k = (r1 - r0) / (d1 - d0 || 1);
  const f = ((t: number) => r0 + (t - d0) * k) as TimeScale;
  const ticks = (n = 6) => { const span = d1 - d0, s = TIME_STEPS.find((x) => span / x <= n) ?? TIME_STEPS[TIME_STEPS.length - 1]; const out: number[] = []; const off = new Date(d0).getTimezoneOffset() * 6e4; for (let t = Math.ceil((d0 - off) / s) * s + off; t <= d1; t += s) out.push(t); return out; };
  return Object.assign(f, { kind: 'time' as const, domain, range, ticks, invert: (px: number) => d0 + (px - r0) / k });
}

/* ---------- formatting ---------- */
export type ChartLocale = 'en' | 'sk' | 'de' | 'cs';
export function chartLocale(locale?: string): ChartLocale { const l = resolveLocale(locale).slice(0, 2).toLowerCase(); return (['en', 'sk', 'de', 'cs'].includes(l) ? l : 'en') as ChartLocale; }
/** Axis / tooltip number formatter: tabular-friendly, compact notation (1,2 tis. / 1.2K / 1.200) by locale. */
export function makeNumberFormat(locale?: string, opts: Intl.NumberFormatOptions = {}, compact = false) {
  const f = numberFormat(locale, opts, compact);
  return (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '–' : f.format(v));
}
const timeFmt = new Map<string, Intl.DateTimeFormat>();
export function makeTimeFormat(locale: string | undefined, spanMs: number) {
  const o: Intl.DateTimeFormatOptions = spanMs > 2 * 31536e6 ? { year: 'numeric' } : spanMs > 864e5 * 60 ? { month: 'short' } : spanMs > 864e5 * 2 ? { day: 'numeric', month: 'short' } : spanMs > 3e5 ? { hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const key = resolveLocale(locale) + JSON.stringify(o);
  let f = timeFmt.get(key); if (!f) { f = new Intl.DateTimeFormat(resolveLocale(locale), o); timeFmt.set(key, f); }
  return (t: number) => f!.format(t);
}

/* ---------- paths ---------- */
export type Pt = [number, number] | null;
/** Linear or monotone-x (Fritsch–Carlson) path; null points split the line (gaps). */
export function linePath(pts: Pt[], curve: 'linear' | 'monotone' = 'monotone'): string {
  let d = '';
  for (const seg of segments(pts)) d += curve === 'monotone' && seg.length > 2 ? monotone(seg) : seg.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return d;
}
/** Area between top points and a baseline (per point, for stacking); gaps split the area. */
export function areaPath(top: Pt[], base: Pt[], curve: 'linear' | 'monotone' = 'monotone'): string {
  let d = '', run: number[] = [];
  const flush = () => {
    if (!run.length) return;
    const t = run.map((i) => top[i]!) as [number, number][], b = run.map((i) => base[i]!).reverse() as [number, number][];
    const up = curve === 'monotone' && t.length > 2 ? monotone(t) : t.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
    const down = curve === 'monotone' && b.length > 2 ? monotone(b).replace(/^M/, 'L') : b.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join('');
    d += up + down + 'Z'; run = [];
  };
  top.forEach((p, i) => { if (p && base[i]) run.push(i); else flush(); }); flush();
  return d;
}
function segments(pts: Pt[]) { const out: [number, number][][] = []; let cur: [number, number][] = []; for (const p of pts) { if (p) cur.push(p); else if (cur.length) { out.push(cur); cur = []; } } if (cur.length) out.push(cur); return out; }
function monotone(p: [number, number][]): string {
  const n = p.length, dx: number[] = [], m: number[] = [], t: number[] = new Array(n);
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / (dx[i] || 1); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += `C${(p[i][0] + h).toFixed(1)} ${(p[i][1] + h * t[i]).toFixed(1)} ${(p[i + 1][0] - h).toFixed(1)} ${(p[i + 1][1] - h * t[i + 1]).toFixed(1)} ${p[i + 1][0].toFixed(1)} ${p[i + 1][1].toFixed(1)}`; }
  return d;
}
/** Donut / pie segment path (angles in radians, 0 = 12 o'clock, clockwise). */
export function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, padPx = 0): string {
  const span = a1 - a0; if (span <= 0) return '';
  const full = span >= Math.PI * 2 - 1e-6, pad1 = Math.min(span / 3, padPx / Math.max(1, r1)), pad0 = r0 > 0 ? Math.min(span / 3, padPx / r0) : 0;
  const P = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  if (full) return `M${P(r1, 0)}A${r1} ${r1} 0 1 1 ${P(r1, Math.PI)}A${r1} ${r1} 0 1 1 ${P(r1, 0)}` + (r0 > 0 ? `M${P(r0, 0)}A${r0} ${r0} 0 1 0 ${P(r0, Math.PI)}A${r0} ${r0} 0 1 0 ${P(r0, 0)}` : '') + 'Z';
  const b0 = a0 + pad1 / 2, b1 = a1 - pad1 / 2, large = b1 - b0 > Math.PI ? 1 : 0;
  let d = `M${P(r1, b0)}A${r1} ${r1} 0 ${large} 1 ${P(r1, b1)}`;
  if (r0 > 0) { const c0 = a0 + pad0 / 2, c1 = a1 - pad0 / 2, l2 = c1 - c0 > Math.PI ? 1 : 0; d += `L${P(r0, c1)}A${r0} ${r0} 0 ${l2} 0 ${P(r0, c0)}`; } else d += `L${cx} ${cy}`;
  return d + 'Z';
}

/* ---------- scatter shapes (colour is never the only cue) ---------- */
export type ScatterShape = 'circle' | 'square' | 'triangle' | 'diamond';
export const SCATTER_SHAPES: ScatterShape[] = ['circle', 'square', 'triangle', 'diamond'];
export const shapePath = (shape: ScatterShape, x: number, y: number, r: number) => {
  if (shape === 'square') { const s = r * 0.89; return `M${x - s} ${y - s}h${2 * s}v${2 * s}h${-2 * s}Z`; }
  if (shape === 'triangle') { const s = r * 1.2; return `M${x} ${y - s}L${x + s * 0.94} ${y + s * 0.6}L${x - s * 0.94} ${y + s * 0.6}Z`; }
  if (shape === 'diamond') { const s = r * 1.22; return `M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`; }
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
};
