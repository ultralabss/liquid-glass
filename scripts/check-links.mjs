#!/usr/bin/env node
// Checks every relative markdown link in README.md, DESIGN.md, ../CLAUDE.md and docs/*.md. Usage: node scripts/check-links.mjs (exit 1 on broken links).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// <links>  (dependency-free)
export function relativeLinks(text) {
  const out = [], noCode = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of noCode.matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const t = m[1];
    if (/^([a-z]+:|#|\/\/)/i.test(t)) continue;
    out.push(t.split('#')[0].split('?')[0]);
  }
  return out.filter(Boolean);
}
export function joinPath(dir, rel) {
  const parts = (dir ? dir.split('/') : []).concat(rel.split('/')), st = [];
  for (const p of parts) { if (p === '' || p === '.') continue; if (p === '..') st.pop(); else st.push(p); }
  return st.join('/');
}
// </links>

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const root = resolve(dirname(self), '..');
  const files = ['README.md', 'DESIGN.md', '../CLAUDE.md', ...readdirSync(resolve(root, 'docs')).filter((f) => f.endsWith('.md')).map((f) => 'docs/' + f)];
  let n = 0; const broken = [];
  for (const f of files) {
    const abs = resolve(root, f); if (!existsSync(abs)) continue;
    for (const l of relativeLinks(readFileSync(abs, 'utf8'))) { n++; if (!existsSync(resolve(dirname(abs), l))) broken.push(`${f}: ${l}`); }
  }
  console.log(`${files.length} files, ${n} relative links, ${broken.length} broken`);
  for (const b of broken) console.log('  ' + b);
  process.exit(broken.length ? 1 : 0);
}
