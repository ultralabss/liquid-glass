#!/usr/bin/env node
// Generates tokens/tokens.css from tokens/tokens.json. Usage: node scripts/build-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// <builder>  (kept dependency-free so it can also run in a browser)
export function springCurve({ stiffness, damping, mass = 1 }) {
  const dt = 1 / 1000;
  let x = 0, v = 0, t = 0;
  const xs = [0];
  while (t < 4) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt; x += v * dt; t += dt; xs.push(x);
    if (t > 0.05 && Math.abs(x - 1) < 5e-4 && Math.abs(v) < 5e-3) break;
  }
  xs[xs.length - 1] = 1;
  return { xs, settleMs: Math.round(t * 1000) };
}

export function springToLinear(xs, points = 40) {
  const n = xs.length - 1;
  const at = (p) => { if (p >= 1) return 1; const f = p * n, i = Math.floor(f); return xs[i] + (xs[i + 1] - xs[i]) * (f - i); };
  return `linear(${Array.from({ length: points + 1 }, (_, i) => +at(i / points).toFixed(3)).join(', ')})`;
}

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`; };

function flatten(obj, path = [], out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$')) continue;
    const p = k === 'DEFAULT' ? [...path] : [...path, k]; // DEFAULT → --ul-<group>
    if (p[0] === 'spring' && p.length === 2) {
      const { xs, settleMs } = springCurve(v);
      out.push([`ease-${k}`, springToLinear(xs)], [`ease-${k}-settle`, `${settleMs}ms`]);
      continue;
    }
    if (v && typeof v === 'object') { flatten(v, p, out); continue; }
    out.push([p.join('-'), v]);
    if (p[0] === 'color' && /^#[0-9a-f]{6}$/i.test(v)) out.push([`${p.join('-')}-rgb`, hexRgb(v)]);
  }
  return out;
}

export function buildTokens(tokens) {
  const block = (sel, pairs, ind = '') =>
    `${ind}${sel} {\n${pairs.map(([k, v]) => `${ind}  --ul-${k}: ${v};`).join('\n')}\n${ind}}`;
  const parts = [
    '/* Generated from tokens.json by scripts/build-tokens.mjs. Do not edit by hand. */',
    block(':root', flatten(tokens)),
  ];
  // Themes: selected with data-ul-theme on the root. `app` is the default (:root values);
  // every key any theme overrides is re-declared on [data-ul-theme="app"] so themes can nest.
  const themes = Object.entries(tokens.$themes || {});
  const base = new Map(flatten(tokens));
  const overridden = new Set(themes.flatMap(([, t]) => flatten(t.tokens || {}).map(([k]) => k)));
  for (const [name, theme] of themes) {
    const pairs = name === 'app'
      ? [...overridden].filter((k) => base.has(k)).map((k) => [k, base.get(k)])
      : flatten(theme.tokens || {});
    if (pairs.length) parts.push(`/* theme: ${name}${theme.$description ? ' — ' + theme.$description : ''} */\n${block(`[data-ul-theme="${name}"]`, pairs)}`);
  }
  for (const [name, mode] of Object.entries(tokens.$modes || {})) {
    parts.push(`/* mode: ${name} */\n@media ${mode.media} {\n${block(':root', flatten(mode.tokens), '  ')}\n}`);
  }
  return parts.join('\n\n') + '\n';
}
// </builder>

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const root = resolve(dirname(self), '..');
  const json = JSON.parse(readFileSync(resolve(root, 'tokens/tokens.json'), 'utf8'));
  writeFileSync(resolve(root, 'tokens/tokens.css'), buildTokens(json));
  console.log('tokens/tokens.css written');
}
