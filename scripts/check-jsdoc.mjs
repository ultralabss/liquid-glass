#!/usr/bin/env node
// Public prop JSDoc coverage (pre-freeze fixes, item 4). Counts members of exported `*Props` interfaces / types in src
// that carry a /** … */ comment, grouped per family. Dependency-free; the checker also runs in the design tool:
//   new Function(src.split('// <checker>\n')[1].split('// </checker>')[0].replace(/export /g, '') + 'return checkJsdoc;')()(files)
// Usage: node scripts/check-jsdoc.mjs [--list] → one line per family "documented / total (pct)"; --list prints undocumented props.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

// <checker>
export const FAMILIES = [
  ['actions', /(^|\/)(actions|ULButton)\//, /^UL(Button|IconButton|ToggleButton|Fab|ButtonGroup|SplitButton|ActionButton|SaveButton|SubmitButton|CopyButton|DeleteButton|ConfirmButton|HoldButton|DownloadButton|ExportButton|RefreshButton|ShareButton|ToggleIconButton|UndoToast|TypeToConfirm)Props$|^AsyncActionOptions$/],
  ['fields + pickers', /(^|\/)(ULField|ULPickers|ULListbox|ULForms)\//, null],
  ['selection', /(^|\/)(ULSelection|ULSlider|ULSegmented|ULTabs)\//, /^ULToggleGroupProps$/],
  ['overlays', /(^|\/)(ULContainers\/(ULOverlays|ULMenu|ULDialog)|ULTooltip|ULAnchoredSurface)/, /^UL(AlertDialog|ConfirmPopover|HoverCard)Props$/],
  ['data', /(^|\/)(ULData\/|live\/|dashboard\/blocks\.tsx)/, null],
  ['charts', /(^|\/)charts\//, null],
];
export function checkJsdoc(files) {
  const fam = {}; const undocumented = {};
  const familyOf = (path, name) => { for (const [f, , re] of FAMILIES) if (re && re.test(name)) return f; for (const [f, p] of FAMILIES) if (p.test(path)) return f; return 'other (v0.1.1)'; };
  for (const { path, text } of files) {
    if (!/\.tsx?$/.test(path) || /\.stories\./.test(path)) continue;
    const re = /export\s+(?:interface\s+(\w+Props)\b[^{]*|type\s+(\w+Props)\s*(?:<[^=]*>)?\s*=\s*(?:[\w.<>, |&]*&\s*)?)\{/g; let m;
    while ((m = re.exec(text))) {
      const name = m[1] || m[2]; let i = m.index + m[0].length, depth = 1, start = i;
      for (; i < text.length && depth > 0; i++) { const c = text[i]; if (c === '{') depth++; else if (c === '}') depth--; }
      const body = text.slice(start, i - 1); const f = familyOf(path, name);
      // walk top-level members
      let d = 0, j = 0, lastDoc = false, seg = '';
      const members = [];
      while (j < body.length) {
        if (body.startsWith('/**', j)) { const e = body.indexOf('*/', j); if (d === 0 && !seg.trim()) lastDoc = true; j = e + 2; continue; }
        if (body.startsWith('//', j)) { j = body.indexOf('\n', j); if (j < 0) break; continue; }
        const c = body[j];
        if ('{(<['.includes(c)) d++; else if ('})>]'.includes(c) && !(c === '>' && body[j - 1] === '=')) d--;
        if (d === 0 && (c === ';' || c === '\n' || c === ',')) { const mm = seg.trim().match(/^(readonly\s+)?['"]?([\w-]+)['"]?\??\s*:/); if (mm) members.push([mm[2], lastDoc]); if (seg.trim()) lastDoc = false; seg = ''; j++; continue; }
        seg += c; j++;
      }
      { const mm = seg.trim().match(/^(readonly\s+)?['"]?([\w-]+)['"]?\??\s*:/); if (mm) members.push([mm[2], lastDoc]); }
      const F = fam[f] || (fam[f] = { documented: 0, total: 0, interfaces: 0 }); F.interfaces++;
      for (const [p, doc] of members) { F.total++; if (doc) F.documented++; else (undocumented[f] = undocumented[f] || []).push(`${name}.${p} (${path.split('/').slice(-2).join('/')})`); }
    }
  }
  const rows = Object.entries(fam).map(([f, v]) => ({ family: f, ...v, pct: v.total ? Math.round((v.documented / v.total) * 100) : 100 }));
  const tot = rows.reduce((a, r) => ({ d: a.d + r.documented, t: a.t + r.total }), { d: 0, t: 0 });
  return { rows, undocumented, summary: `${tot.d} / ${tot.t} public props documented (${Math.round((tot.d / tot.t) * 100)} %)` };
}
// </checker>

function walk(dir, acc = []) { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, acc); else if (/\.tsx?$/.test(f)) acc.push(p); } return acc; }
const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const ds = resolve(dirname(self), '..');
  const r = checkJsdoc(walk(join(ds, 'src')).map((p) => ({ path: relative(ds, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') })));
  console.log(r.summary); for (const x of r.rows) console.log(`  ${x.family}: ${x.documented} / ${x.total} (${x.pct} %)`);
  if (process.argv.includes('--list')) for (const [f, l] of Object.entries(r.undocumented)) console.log(`\n${f}:\n  ` + l.join('\n  '));
}
