import { toRGB, luminance } from './contrast.ts';
import type { Backdrop } from './accent.tsx';

type RGBA = [number, number, number, number];

/** Parse a computed CSS colour into 0..1 rgb + alpha (browsers return rgb()/rgba()/color() for computed values). */
function parseColor(c: string): RGBA | null {
  const t = c.trim();
  if (!t || t === 'transparent') return null;
  const m = t.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map((x) => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x)));
    const a = p.length > 3 ? p[3] : 1;
    return a > 0 ? [p[0] / 255, p[1] / 255, p[2] / 255, a] : null;
  }
  const [r, g, b] = toRGB(t); // color-mix(), oklch() … resolved through canvas
  return [r, g, b, 1];
}

/** Colours in a gradient / image background: gradient stops averaged; url() images are sampled when same-origin. */
function layerColor(el: Element, bgImage: string): RGBA | null {
  if (!bgImage || bgImage === 'none') return null;
  const cols = bgImage.match(/rgba?\([^)]*\)|color\([^)]*\)|oklch\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g);
  if (cols?.length) {
    const rgb = cols.map(parseColor).filter((x): x is RGBA => !!x);
    if (rgb.length) {
      const n = rgb.length, a = rgb.reduce((s, c) => s + c[3], 0) / n;
      return [rgb.reduce((s, c) => s + c[0], 0) / n, rgb.reduce((s, c) => s + c[1], 0) / n, rgb.reduce((s, c) => s + c[2], 0) / n, Math.min(1, a)];
    }
  }
  return null;
}

/** Mean colour of an <img>/<video>/<canvas> element (downscaled); null when tainted or not ready. */
function mediaColor(el: Element): RGBA | null {
  try {
    const src = el as HTMLImageElement & HTMLVideoElement & HTMLCanvasElement;
    if (el instanceof HTMLImageElement && !el.complete) return null;
    if (el instanceof HTMLVideoElement && el.readyState < 2) return null;
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const x = c.getContext('2d', { willReadFrequently: true });
    if (!x) return null;
    x.drawImage(src as CanvasImageSource, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return [r / n / 255, g / n / 255, b / n / 255, 1];
  } catch { return null; } // cross-origin pixels
}

/** Backdrop luminance thresholds (relative luminance 0..1): below DARK → dark, above LIGHT → light, else mid. */
export const BACKDROP_THRESHOLDS = { dark: 0.2, light: 0.5 } as const;

/**
 * Measures what sits behind a glass surface and classifies it: `dark` | `mid` | `light` (the contrast-scrim classes).
 * Looks at the stack of elements under the surface centre (elementsFromPoint, skipping the surface and its descendants), composites
 * their background colours, gradients (stop average), and same-origin images / video / canvas (8×8 downscale) from the top down until
 * opaque, falling back to the root colour. Cross-origin images and CSS `url()` backgrounds cannot be read and count as unknown.
 * Returns { backdrop, luminance }. Cheap enough to call on resize and theme change; never reads pixels of other windows.
 */
export function measureBackdrop(el: HTMLElement): { backdrop: Backdrop; luminance: number } {
  const rect = el.getBoundingClientRect();
  const pts: [number, number][] = rect.width && rect.height
    ? [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].map(([fx, fy]) => [rect.left + rect.width * fx, rect.top + rect.height * fy])
    : [];
  let sum = 0, n = 0;
  for (const [x, y] of pts.length ? pts : [[0, 0] as [number, number]]) {
    const stack = (typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(Math.min(Math.max(x, 0), innerWidth - 1), Math.min(Math.max(y, 0), innerHeight - 1)) : []) as Element[];
    const idx = stack.indexOf(el);
    const under = (idx >= 0 ? stack.slice(idx + 1) : stack.filter((e) => !el.contains(e) && e !== el));
    // top-down alpha composite over unknown; r,g,b accumulate premultiplied, `left` = remaining transparency
    let r = 0, g = 0, b = 0, left = 1;
    for (const e of under) {
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
      const layers: (RGBA | null)[] = [layerColor(e, cs.backgroundImage), parseColor(cs.backgroundColor)];
      if (/^(IMG|VIDEO|CANVAS)$/.test(e.tagName)) layers.unshift(mediaColor(e));
      for (const c of layers) {
        if (!c || left <= 0.02) continue;
        const a = c[3] * parseFloat(cs.opacity || '1');
        r += c[0] * a * left; g += c[1] * a * left; b += c[2] * a * left; left *= 1 - a;
      }
      if (left <= 0.02) break;
    }
    if (left > 0.02) { // open: assume the page colour (canvas default white), blended under what was found
      const root = parseColor(getComputedStyle(document.documentElement).backgroundColor) ?? parseColor(getComputedStyle(document.body).backgroundColor) ?? [1, 1, 1, 1];
      r += root[0] * left; g += root[1] * left; b += root[2] * left;
    }
    sum += luminance([r, g, b]); n++;
  }
  const L = n ? sum / n : 0;
  return { backdrop: L < BACKDROP_THRESHOLDS.dark ? 'dark' : L < BACKDROP_THRESHOLDS.light ? 'mid' : 'light', luminance: L };
}
