#!/usr/bin/env node
// Asserts what `npm pack` would publish. Usage: node scripts/check-pack.mjs (npm run check:pack). Offline; runs no lifecycle scripts.
// Fails on: src tests / stories, showcase, docs (incl. shots), examples, missing dist entry files, an exports target that is not in the
// tarball, or a size above the limits below.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// <pack>  (dependency-free; report = the first object of `npm pack --dry-run --json`)
export const PACK_LIMITS = { packed: 2_500_000, unpacked: 9_000_000 };
export function checkPack({ pkg, report, limits = PACK_LIMITS }) {
  const paths = new Set(report.files.map((f) => f.path.replace(/^package\//, '')));
  const fails = [];
  const forbidden = [
    [/(^|\/)[^/]+\.(test|spec|stories)\.[cm]?[jt]sx?$/, 'test / story file'],
    [/^src\//, 'source (consumers use dist/esm + dist/types)'],
    [/^showcase\//, 'showcase'],
    [/^docs\//, 'docs'],
    [/^examples\//, 'examples'],
    [/^scripts\//, 'build scripts'],
    [/^_archive\//, 'archive'],
    [/(^|\/)\.storybook\//, 'storybook config'],
  ];
  for (const p of paths) for (const [re, why] of forbidden) if (re.test(p)) fails.push(`forbidden (${why}): ${p}`);
  const required = ['package.json', 'README.md', 'CHANGELOG.md', 'dist/esm/index.js', 'dist/types/src/index.d.ts', 'dist/ul-glass.js', 'dist/ul-glass.min.js', 'dist/ul-glass.css', 'tokens/tokens.css', 'tokens/tokens.json'];
  for (const r of required) if (!paths.has(r)) fails.push('missing: ' + r);
  const targets = [];
  for (const t of Object.values(pkg.exports)) {
    if (typeof t === 'string') targets.push(t); else targets.push(...Object.values(t));
  }
  for (const f of [pkg.main, pkg.module, pkg.types, pkg.style].filter(Boolean)) targets.push(f);
  for (const t of new Set(targets)) if (!paths.has(t.replace(/^\.\//, ''))) fails.push('exports / entry target not in tarball: ' + t);
  if (!pkg.license) fails.push('package.json has no "license"');
  if (pkg.private) fails.push('package.json "private": true (publish would be refused; remove only at the publish step)');
  if (report.size > limits.packed) fails.push(`packed ${report.size} B > limit ${limits.packed} B`);
  if (report.unpackedSize > limits.unpacked) fails.push(`unpacked ${report.unpackedSize} B > limit ${limits.unpacked} B`);
  const summary = `${paths.size} files, packed ${report.size} B (limit ${limits.packed}), unpacked ${report.unpackedSize} B (limit ${limits.unpacked}), ${fails.length} problems`;
  return { summary, fails };
}
// </pack>

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const root = resolve(dirname(self), '..');
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const out = execSync('npm pack --dry-run --json --ignore-scripts --offline', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const report = JSON.parse(out.slice(out.indexOf('[')))[0];
  const r = checkPack({ pkg, report });
  console.log(r.summary);
  for (const f of r.fails) console.log('  ' + f);
  // "private" and "license" are reported but only fail with --strict (the publish step), so the check is usable before release.
  const hard = r.fails.filter((f) => process.argv.includes('--strict') || !/"private"|"license"/.test(f));
  process.exit(hard.length ? 1 : 0);
}
