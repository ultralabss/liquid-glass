#!/usr/bin/env node
// Token integrity guard (pre-freeze fixes, item 3). Scans src, showcase, landing, apps (+ tokens.css itself) for every
// var(--ul-*) read and every inline custom-property write (style="--ul-x: …", { '--ul-x': … }, setProperty('--ul-x')).
// App token sheets (apps/ds/tokens.css) count as local definitions for the apps that load them. JS-only lookups
// (readToken('--ul-x')) count as reads for the unused list but are not required to be defined (they have JS defaults).
// A read is defined when the name is declared in tokens/tokens.css, registered (@property / CSS.registerProperty), set in
// code (setProperty / style objects / inline style strings), or declared on a component selector in a stylesheet (local).
// Reports used-but-undefined (fails the build) and defined-but-unused tokens.css names (listed, not removed).
// Usage: node scripts/check-tokens.mjs → "N reads, M names · U undefined · K unused"; exit 1 if U > 0. Part of npm run build.
// Design tool: new Function(src.split('// <checker>\n')[1].split('// </checker>')[0].replace(/export /g, '') + 'return checkTokens;')()({ tokensCss, files }).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

// <checker>
export function checkTokens({ tokensCss, files }) {
  const NAME = '--ul-[A-Za-z0-9_-]*[A-Za-z0-9_]';
  const tokens = new Set(), registered = new Set(), code = new Set(), local = new Set(), prefixes = new Set();
  const reads = new Map(); // name -> { where: [], fallback: bool }
  const add = (set, n) => { if (/\$\{|\$$/.test(n)) return; set.add(n); };
  const stripComments = (t, css) => css ? t.replace(/\/\*[\s\S]*?\*\//g, '') : t;
  const rootBlock = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of rootBlock.matchAll(new RegExp('(' + NAME + ')\\s*:', 'g'))) tokens.add(m[1]);
  const all = [{ path: 'tokens/tokens.css', text: tokensCss, isTokens: true }, ...files];
  for (const f of all) {
    const css = /\.css$/.test(f.path), t = stripComments(f.text, css);
    for (const m of t.matchAll(new RegExp('@property\\s+(' + NAME + ')', 'g'))) registered.add(m[1]);
    for (const m of t.matchAll(new RegExp("registerProperty\\(\\s*\\{[^}]*name:\\s*['\"](" + NAME + ")", 'g'))) registered.add(m[1]);
    for (const m of t.matchAll(new RegExp("setProperty\\(\\s*['\"`](" + NAME + ")(\\$\\{)?", 'g'))) (m[2] ? prefixes : code).add(m[1]);
    for (const m of t.matchAll(new RegExp("['\"](" + NAME + ")['\"]\\s*[:\\]]", 'g'))) code.add(m[1]); // style object keys
    for (const m of t.matchAll(new RegExp("\\[\\s*`(" + NAME + ")\\$\\{", 'g'))) prefixes.add(m[1]);
    if (!f.isTokens) {
      if (css) for (const m of t.matchAll(new RegExp('(' + NAME + ')\\s*:(?!:)', 'g'))) local.add(m[1]);
      else for (const m of t.matchAll(new RegExp('(?:style=["\'][^"\']*?|;\\s*|\\{\\s*)(' + NAME + ')\\s*:', 'g'))) code.add(m[1]); // inline style strings / helmet css
    }
    // prefix reads: var(--ul-x-${i}) · 'var(--ul-x-' + i · --ul-x-{{ n }} · readToken(`--ul-x-${k}`)
    const PRE = '(-?\\$\\{|-[\'"`]\\s*\\+|-\\{\\{)?';
    if (!css) for (const m of t.matchAll(new RegExp("['\"`](" + NAME + ')' + PRE + "(?!\\s*:)", 'g'))) { // JS lookups: readToken('--ul-x'), getPropertyValue('--ul-x')
      if (m[2]) { prefixes.add('read:' + m[1]); continue; }
      const r = reads.get(m[1]) || { where: [], fallback: true, js: true }; r.where.push(f.path); reads.set(m[1], r);
    }
    for (const m of t.matchAll(new RegExp('var\\(\\s*(' + NAME + ')' + PRE + '\\s*(,)?', 'g'))) {
      if (m[2]) { prefixes.add('read:' + m[1]); continue; }
      const r = reads.get(m[1]) || { where: [], fallback: true }; r.where.push(f.path); r.fallback = r.fallback && !!m[3]; r.js = false; reads.set(m[1], r);
    }
  }
  const pre = [...prefixes].filter((p) => !p.startsWith('read:'));
  const defined = (n) => tokens.has(n) || registered.has(n) || code.has(n) || local.has(n) || pre.some((p) => n.startsWith(p));
  const IGNORE = ['--ul-does-not-exist']; // ul-contrast.js self-test: an unresolved token must throw
  const undefinedNames = [...reads].filter(([n, r]) => !r.js && !defined(n) && !IGNORE.includes(n)).map(([n, r]) => ({ name: n, fallback: r.fallback, files: [...new Set(r.where)].slice(0, 4) }));
  const readPrefixes = [...prefixes].filter((p) => p.startsWith('read:')).map((p) => p.slice(5));
  const unused = [...tokens].filter((n) => !reads.has(n) && !readPrefixes.some((p) => n.startsWith(p))).sort();
  const writesUnread = [...code].filter((n) => !reads.has(n) && !tokens.has(n) && !readPrefixes.some((p) => n.startsWith(p))).sort();
  let readCount = 0; reads.forEach((r) => { readCount += r.where.length; });
  return { reads: readCount, names: reads.size, tokens: tokens.size, undefinedNames, unused, writesUnread,
    summary: `${readCount} reads, ${reads.size} names · ${undefinedNames.length} undefined · ${unused.length} tokens unused` };
}
// </checker>

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const f of readdirSync(dir)) {
    if (['node_modules', 'dist', '_archive', '.git', 'docs'].includes(f)) continue;
    const p = join(dir, f), s = statSync(p);
    if (s.isDirectory()) walk(p, acc); else if (/\.(tsx?|jsx?|mjs|html|css)$/.test(f) && !/support\.js$/.test(f) && p !== join(dirname(fileURLToPath(import.meta.url)), '..', 'tokens', 'tokens.css')) acc.push(p);
  }
  return acc;
}
export function runCheckTokens(ds) {
  const root = resolve(ds, '..');
  const paths = [...walk(join(ds, 'src')), ...walk(join(ds, 'showcase')), ...walk(join(root, 'landing')), ...walk(join(root, 'apps'))];
  const r = checkTokens({ tokensCss: readFileSync(join(ds, 'tokens/tokens.css'), 'utf8'), files: paths.map((p) => ({ path: relative(root, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') })) });
  console.log(r.summary);
  for (const u of r.undefinedNames) console.log(`  undefined ${u.name}${u.fallback ? ' (always with a fallback)' : ''} · ${u.files.join(', ')}`);
  if (r.unused.length) console.log(`  unused (listed, kept): ${r.unused.join(' ')}`);
  return r;
}
const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const r = runCheckTokens(resolve(dirname(self), '..'));
  process.exit(r.undefinedNames.length ? 1 : 0);
}
