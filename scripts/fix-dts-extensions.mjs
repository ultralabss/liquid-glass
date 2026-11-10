#!/usr/bin/env node
// tsc keeps `.ts` / `.tsx` specifiers (allowImportingTsExtensions) in emitted .d.ts files; consumers cannot resolve them.
// Rewrite relative specifiers to `.js` (resolves to the sibling .d.ts). Runs after build:types.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'types');
const re = /(\b(?:from|import)\s*\(?\s*['"])(\.{1,2}\/[^'"]+?)\.tsx?(['"])/g;
let files = 0, edits = 0;
function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.d.ts')) {
      const src = readFileSync(p, 'utf8');
      const out = src.replace(re, (_m, a, b, c) => { edits++; return `${a}${b}.js${c}`; });
      if (out !== src) { writeFileSync(p, out); files++; }
    }
  }
}
walk(root);
console.log(`fix-dts-extensions: ${edits} specifiers rewritten in ${files} files`);
