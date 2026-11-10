/**
 * Contrast guard model. Browsers can't read backdrop pixels, so the guard is
 * declarative: a surface states its backdrop class (dark / mid / light) and
 * receives a deep-accent backing sized for it. This module reproduces the
 * material's layer stack (same order and math as ULGlass.css + the engine's
 * backdrop colorize) to verify, and re-derive, the scrim tokens for every
 * theme, accent and strength. Compositing is modelled in gamma sRGB, like
 * the browser; color-mix(in oklab) is modelled in oklab.
 */
import { ACCENT_PRESETS, ACCENT_STRENGTHS, type Backdrop } from './accent.tsx';

type RGB = [number, number, number];
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const over = (top: RGB, a: number, bot: RGB): RGB => [0, 1, 2].map((i) => a * top[i] + (1 - a) * bot[i]) as RGB;
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const WHITE: RGB = [1, 1, 1], BLACK: RGB = [0, 0, 0];

let ctx: CanvasRenderingContext2D | null = null;
/** Resolve any CSS color string (hex, rgb(), names) to sRGB 0..1. */
export function toRGB(color: string): RGB {
  ctx ??= document.createElement('canvas').getContext('2d');
  ctx!.fillStyle = '#000';
  ctx!.fillStyle = color.trim();
  const v = String(ctx!.fillStyle);
  if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as RGB;
  const m = v.match(/[\d.]+/g) || ['0', '0', '0'];
  return [0, 1, 2].map((i) => Number(m[i]) / 255) as RGB;
}

function toLab(c: RGB) {
  const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromLab([L, a, b]: number[]): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
    .map((v) => clamp(gam(v))) as RGB;
}
/** color-mix(in oklab, a p, b) */
const mixOklab = (a: RGB, p: number, b: RGB): RGB => { const A = toLab(a), B = toLab(b); return fromLab(A.map((v, i) => p * v + (1 - p) * B[i])); };
/** feBlend mode=color: hue + chroma of `src`, luminance of `dst` (W3C SetLum). */
const blendLum = (c: RGB) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
function blendColor(src: RGB, dst: RGB): RGB {
  const d = blendLum(dst) - blendLum(src);
  let c = src.map((v) => v + d) as RGB;
  const l = blendLum(c), n = Math.min(...c), x = Math.max(...c);
  if (n < 0) c = c.map((v) => l + ((v - l) * l) / (l - n)) as RGB;
  if (x > 1) c = c.map((v) => l + ((v - l) * (1 - l)) / (x - l)) as RGB;
  return c;
}

export const luminance = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export function contrastRatio(a: RGB | string, b: RGB | string): number {
  const x = luminance(typeof a === 'string' ? toRGB(a) : a), y = luminance(typeof b === 'string' ? toRGB(b) : b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

type Range = { subtle: number; vivid: number };
export interface GlassContrastTokens {
  text: RGB; text2: RGB;
  tint: number; light: number; brightness: number; deep: number;
  k: Record<'subtle' | 'tinted' | 'vivid', number>;
  mixTint: Range; shade: Range; body: Range; wash: Range; lightMix: Range; backdrop: Range;
  scrim: Record<Backdrop, Record<'subtle' | 'tinted' | 'vivid', number>>;
  maxLum: Record<Backdrop, number>; target: number;
}

/** Read the guard inputs from computed tokens on `el` (theme-aware). */
export function readContrastTokens(el: Element = document.documentElement): GlassContrastTokens {
  const cs = getComputedStyle(el);
  const s = (k: string) => cs.getPropertyValue(k).trim();
  const n = (k: string, f: number) => { const v = parseFloat(s(k)); return Number.isFinite(v) ? v : f; };
  const pct = (k: string, f: number) => n(k, f * 100) / 100;
  const r = (name: string, sub: number, viv: number, p = false): Range =>
    p ? { subtle: pct(`--ul-accent-${name}-subtle`, sub), vivid: pct(`--ul-accent-${name}-vivid`, viv) }
      : { subtle: n(`--ul-accent-${name}-subtle`, sub), vivid: n(`--ul-accent-${name}-vivid`, viv) };
  const sc = (c: Backdrop) => ({ subtle: n(`--ul-scrim-${c}-subtle`, 0), tinted: n(`--ul-scrim-${c}-tinted`, 0), vivid: n(`--ul-scrim-${c}-vivid`, 0) });
  return {
    text: toRGB(s('--ul-color-text')), text2: toRGB(s('--ul-color-text-2')),
    tint: Math.max(n('--ul-glass-sm-tint', 0), n('--ul-glass-md-tint', 0), n('--ul-glass-lg-tint', 0), n('--ul-glass-xl-tint', 0), n('--ul-tint-strong', 0.07)),
    light: n('--ul-glass-light-intensity', 0.16), brightness: n('--ul-glass-brightness', 1.04), deep: pct('--ul-accent-deep', 0.28),
    k: { subtle: n('--ul-accent-strength-subtle', 0.22), tinted: n('--ul-accent-strength-tinted', 0.64), vivid: n('--ul-accent-strength-vivid', 1) },
    mixTint: r('tint', 0.12, 1, true), shade: r('shade', 0, 0.35, true), body: r('body', 0, 0.26), wash: r('wash', 0.07, 0.1),
    lightMix: r('light', 0.35, 0.8, true), backdrop: r('backdrop', 0, 0.75),
    scrim: { dark: sc('dark'), mid: sc('mid'), light: sc('light') },
    maxLum: { dark: n('--ul-contrast-dark-max-luminance', 0.03), mid: n('--ul-contrast-mid-max-luminance', 0.2), light: 1 },
    target: n('--ul-contrast-target', 4.5),
  };
}

/** x: 0 at subtle, 1 at vivid (same as --ul-ax). */
export const strengthX = (t: GlassContrastTokens, k: number) => clamp((k - t.k.subtle) / (1 - t.k.subtle));

/** Scrim the CSS applies for a backdrop class at strength x (piecewise subtle → tinted → vivid). */
export function scrimAt(t: GlassContrastTokens, backdrop: Backdrop, x: number): number {
  const xt = strengthX(t, t.k.tinted), s = t.scrim[backdrop];
  const p = clamp(x / xt), q = clamp((x - xt) / (1 - xt));
  return s.subtle + p * (s.tinted - s.subtle) + q * (s.vivid - s.tinted);
}

/** Worst-case surface for a backdrop class: brightest allowed backdrop, colorized, body at its top stop, deep backing, wash, optional full pointer light. */
export function worstSurface(t: GlassContrastTokens, accent: RGB, backdrop: Backdrop, x: number, scrim = scrimAt(t, backdrop, x), withLight = false): RGB {
  const v = (r: Range) => lerp(r.subtle, r.vivid, x);
  const g = Math.min(1, gam(t.maxLum[backdrop]) * t.brightness);
  let c: RGB = [g, g, g];
  c = over(blendColor(accent, c), v(t.backdrop), c);
  c = over(mixOklab(mixOklab(accent, v(t.mixTint), WHITE), 1 - v(t.shade), BLACK), t.tint * 1.5 + v(t.body), c);
  c = over(mixOklab(accent, t.deep, BLACK), scrim, c);
  c = over(accent, v(t.wash), c);
  if (withLight) c = over(mixOklab(accent, v(t.lightMix), WHITE), t.light, c);
  return c;
}

export interface ContrastRow { accent: string; strength: string; backdrop: Backdrop; scrim: number; text2: number; textLit: number; pass: boolean }

/**
 * Pass = secondary text ≥ target at rest AND primary text ≥ target under full pointer light.
 * Covers every accent × strength × backdrop class. `accents` maps a label to a CSS color (defaults to presets).
 */
export function accentContrastReport(el: Element = document.documentElement, accents?: Record<string, string>): ContrastRow[] {
  const t = readContrastTokens(el);
  const cs = getComputedStyle(el);
  const list = accents ?? Object.fromEntries(ACCENT_PRESETS.map((p) => [p, cs.getPropertyValue(`--ul-accent-${p}`).trim()]));
  const rows: ContrastRow[] = [];
  for (const [name, color] of Object.entries(list)) {
    const a = toRGB(color);
    for (const strength of ACCENT_STRENGTHS) {
      const x = strengthX(t, t.k[strength]);
      for (const backdrop of ['dark', 'mid', 'light'] as Backdrop[]) {
        const scrim = scrimAt(t, backdrop, x);
        const text2 = contrastRatio(t.text2, worstSurface(t, a, backdrop, x, scrim));
        const textLit = contrastRatio(t.text, worstSurface(t, a, backdrop, x, scrim, true));
        rows.push({ accent: name, strength, backdrop, scrim: Math.round(scrim * 100) / 100, text2, textLit, pass: text2 >= t.target && textLit >= t.target });
      }
    }
  }
  return rows;
}

const hex = (c: RGB) => '#' + c.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
/** OKLCH of a CSS color: [L, C, h°]. */
export function toOklch(color: string | RGB): [number, number, number] {
  const [L, a, b] = toLab(typeof color === 'string' ? toRGB(color) : color);
  return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}
export const fromOklch = (L: number, C: number, h: number): string => { const r = (h * Math.PI) / 180; return hex(fromLab([L, C * Math.cos(r), C * Math.sin(r)])); };

export interface AccentGuard { chosen: string; effective: string; adjusted: boolean; worst: number }
/**
 * Contrast guard for CUSTOM accents (presets are covered by the scrim tokens). Runs the same worst-case model as
 * accentContrastReport for this one colour; if any row fails it clamps the colour into the safe OKLCH range
 * (--ul-accent-custom-l-min / -l-max / -c-max), then, if still needed, walks chroma down and lightness toward the
 * middle of that range until every row passes. `effective` is what should be applied.
 */
export function guardAccent(color: string, el: Element = document.documentElement): AccentGuard {
  const worstOf = (c: string) => Math.min(...accentContrastReport(el, { c }).map((r) => Math.min(r.text2, r.textLit)));
  const target = readContrastTokens(el).target;
  const chosen = hex(toRGB(color));
  let w = worstOf(chosen);
  if (w >= target) return { chosen, effective: chosen, adjusted: false, worst: w };
  const cs = getComputedStyle(el), n = (k: string, f: number) => { const v = parseFloat(cs.getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
  const lo = n('--ul-accent-custom-l-min', 0.66), hi = n('--ul-accent-custom-l-max', 0.86), cmax = n('--ul-accent-custom-c-max', 0.16), mid = (lo + hi) / 2;
  let [L, C, h] = toOklch(chosen);
  L = clamp(L, lo, hi); C = Math.min(C, cmax);
  let eff = fromOklch(L, C, h);
  for (let i = 0; i < 24 && (w = worstOf(eff)) < target; i++) { C *= 0.85; L += (mid - L) * 0.35; eff = fromOklch(L, C, h); }
  return { chosen, effective: eff, adjusted: eff !== chosen, worst: w };
}

/** Smallest scrim (step .01) that passes for every accent on a backdrop class at strength x. */
export function minScrim(t: GlassContrastTokens, accents: RGB[], backdrop: Backdrop, x: number): number {
  for (let s = 0; s <= 1.0001; s += 0.01) {
    if (accents.every((a) => contrastRatio(t.text2, worstSurface(t, a, backdrop, x, s)) >= t.target && contrastRatio(t.text, worstSurface(t, a, backdrop, x, s, true)) >= t.target)) return Math.round(s * 100) / 100;
  }
  return 1;
}
