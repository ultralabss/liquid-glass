import tokens from '../../tokens/tokens.json';

export interface SpringParams { stiffness: number; damping: number; mass?: number }

export interface Spring {
  (progress: number): number;
  /** Natural settle time of the spring in ms (pair with the matching duration token). */
  settleMs: number;
  /** CSS `linear()` easing string; identical to the generated --ul-ease-* token. */
  toCSS(points?: number): string;
}

/** Semi-implicit Euler spring from 0 to 1. Same algorithm as scripts/build-tokens.mjs. */
export function createSpring({ stiffness, damping, mass = 1 }: SpringParams): Spring {
  const dt = 1 / 1000;
  let x = 0, v = 0, t = 0;
  const xs: number[] = [0];
  while (t < 4) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt; x += v * dt; t += dt; xs.push(x);
    if (t > 0.05 && Math.abs(x - 1) < 5e-4 && Math.abs(v) < 5e-3) break;
  }
  xs[xs.length - 1] = 1;
  const n = xs.length - 1;
  const fn = ((p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    const f = p * n, i = Math.floor(f);
    return xs[i] + (xs[i + 1] - xs[i]) * (f - i);
  }) as Spring;
  fn.settleMs = Math.round(t * 1000);
  fn.toCSS = (points = 40) =>
    `linear(${Array.from({ length: points + 1 }, (_, i) => +fn(i / points).toFixed(3)).join(', ')})`;
  return fn;
}

export const springs = {
  bouncy: createSpring(tokens.spring.bouncy),
  smooth: createSpring(tokens.spring.smooth),
  snappy: createSpring(tokens.spring.snappy),
};
export type SpringName = keyof typeof springs;
