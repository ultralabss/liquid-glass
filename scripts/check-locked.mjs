#!/usr/bin/env node
// Compares tokens/tokens.json, tokens/tokens.css and DESIGN.md against scripts/locked-timings.json.
// Usage: node scripts/check-locked.mjs  → prints "42 checked, N differences" (+ one line per difference); exit 1 if N > 0.
// Runs inside build-tokens.mjs and build-bundle.mjs, and in the end-of-task step.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildTokens, springCurve, springToLinear } from './build-tokens.mjs';

// <checker>  (dependency-free; buildTokens / springCurve / springToLinear are passed in)
export function checkLocked({ locked, json, css, design, buildTokens, springCurve, springToLinear }) {
  const rootVars = (text) => {
    const m = text.match(/:root\s*\{([\s\S]*?)\n\}/);
    const out = new Map();
    if (m) for (const [, k, v] of m[1].matchAll(/(--ul-[\w-]+)\s*:\s*([^;]+);/g)) if (!out.has(k)) out.set(k, v.trim());
    return out;
  };
  const cssVars = rootVars(css);
  const jsonVars = rootVars(buildTokens(json));
  const rows = new Map();
  for (const line of design.split('\n')) {
    const c = line.split('|').map((s) => s.trim());
    if (line.startsWith('|') && c.length > 3) rows.set(c[1], c[2]);
  }
  const diffs = [];
  for (const e of locked.locked) {
    const d = e.design;
    const cell = rows.get(d.row);
    if (cell == null) diffs.push(`${e.name}: DESIGN.md row ${d.row} missing`);
    else {
      const part = d.part != null ? (cell.split(' / ')[d.part] || '').trim() : cell;
      const want = d.contains || String(e.value);
      const ok = d.contains ? part.includes(want) : part === want || part.startsWith(want + ' ');
      if (!ok) diffs.push(`${e.name}: DESIGN.md "${part}" ≠ ${want}`);
    }
    if (e.group === 'spring') {
      const key = e.name.split('.')[1], v = e.value, j = (json.spring || {})[key] || {};
      if (j.stiffness !== v.stiffness || j.damping !== v.damping || (j.mass ?? 1) !== v.mass)
        diffs.push(`${e.name}: tokens.json ${j.stiffness}/${j.damping}/${j.mass ?? 1} ≠ ${v.stiffness}/${v.damping}/${v.mass}`);
      const curve = springToLinear(springCurve(v).xs);
      if (cssVars.get(`--ul-ease-${key}`) !== curve) diffs.push(`${e.name}: tokens.css --ul-ease-${key} differs from the locked spring`);
      continue;
    }
    const want = String(e.value);
    if (jsonVars.get(e.name) !== want) diffs.push(`${e.name}: tokens.json ${jsonVars.get(e.name)} ≠ ${want}`);
    if (cssVars.get(e.name) !== want) diffs.push(`${e.name}: tokens.css ${cssVars.get(e.name)} ≠ ${want}`);
  }
  const countOk = locked.locked.length === locked.total;
  if (!countOk) diffs.push(`locked-timings.json lists ${locked.locked.length}, total says ${locked.total}`);
  return { checked: locked.locked.length, diffs, summary: `${locked.locked.length} checked, ${diffs.length} differences` };
}
// </checker>

export function runCheckLocked(root) {
  const read = (p) => readFileSync(resolve(root, p), 'utf8');
  const r = checkLocked({
    locked: JSON.parse(read('scripts/locked-timings.json')),
    json: JSON.parse(read('tokens/tokens.json')),
    css: read('tokens/tokens.css'),
    design: read('DESIGN.md'),
    buildTokens, springCurve, springToLinear,
  });
  console.log(r.summary);
  for (const d of r.diffs) console.log('  ' + d);
  return r;
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const r = runCheckLocked(resolve(dirname(self), '..'));
  process.exit(r.diffs.length ? 1 : 0);
}
