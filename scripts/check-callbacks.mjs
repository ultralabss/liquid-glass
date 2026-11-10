#!/usr/bin/env node
// Callback naming guard (pre-freeze fixes, item 2). One rule, no aliases:
//   value / defaultValue / onValueChange · checked / defaultChecked / onCheckedChange · open / defaultOpen / onOpenChange
//   (toggle buttons: pressed / defaultPressed / onPressedChange, ULButton family).
// Fails when (1) a type in src declares a prop named onChange, or (2) src / showcase / landing / apps pass onChange to a UL
// component that is not a documented native wrapper (those forward the native DOM change event, inherited from the HTML attrs).
// Usage: node scripts/check-callbacks.mjs → "N files checked, M violations"; exit 1 if M > 0. Part of npm run build.
// Design tool: new Function(cut('// <checker>', '// </checker>') + 'return checkCallbacks;')()(files).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

// <checker>
export const NATIVE_WRAPPERS = ['ULTextField', 'ULTextArea', 'ULInputGroupInput', 'ULCheckbox', 'ULRadio'];
export function checkCallbacks(files) {
  const out = [];
  const line = (t, i) => t.slice(0, i).split('\n').length;
  for (const { path, text: t } of files) {
    if (/(^|\/)src\/.*\.tsx?$/.test(path)) {
      for (const m of t.matchAll(/\bonChange\??\s*:\s*\(/g)) out.push(`${path}:${line(t, m.index)} declares a public prop "onChange"`);
    }
    const re = /h\((?:UL\.)?(UL\w+),\s*\{|<(UL\w+)\b/g; let m;
    while ((m = re.exec(t))) {
      const name = m[1] || m[2], jsx = !!m[2]; if (NATIVE_WRAPPERS.includes(name)) continue;
      let depth = jsx ? 0 : 1;
      for (let i = m.index + m[0].length; i < t.length; i++) {
        const ch = t[i];
        if (ch === '{' || ch === '(' || ch === '[') depth++;
        else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (!jsx && depth === 0) break; }
        else if (jsx && depth === 0 && ch === '>') break;
        if ((jsx ? depth === 0 : depth === 1) && t.startsWith('onChange', i) && /[\s,{]/.test(t[i - 1]) && (jsx || /[,{]\s*$/.test(t.slice(Math.max(0, i - 40), i))) && (jsx ? t[i + 8] === '=' : /[:,}\s]/.test(t[i + 8]))) out.push(`${path}:${line(t, i)} passes onChange to ${name}`);
      }
    }
  }
  // removed-name references: a component that destructures onValueChange / onPressedChange but still CALLS onChange( in its body
  // (rename leftovers; ReferenceError only when that branch runs, so the type-free bundle never complains)
  for (const { path, text: t } of files) {
    if (!/(^|\/)src\/.*\.tsx?$/.test(path)) continue;
    const fnRe = /export function (\w+)\s*(?:<[^>]*>)?\(\s*\{([^}]*)\}[^)]*\)[^{]*\{/g; let f;
    while ((f = fnRe.exec(t))) {
      const params = f[2]; if (!/\bon(Value|Pressed|Checked)Change\b/.test(params) || /\bonChange\b/.test(params)) continue;
      let d = 1, j = f.index + f[0].length; for (; j < t.length && d > 0; j++) { if (t[j] === '{') d++; else if (t[j] === '}') d--; }
      const body = t.slice(f.index + f[0].length, j);
      for (const m of body.matchAll(/(?<![.\w])onChange\s*\(/g)) out.push(`${path}:${line(t, f.index + f[0].length + m.index)} ${f[1]} calls undefined onChange( (renamed to on…Change)`);
    }
  }
  return { checked: files.length, violations: out, summary: `${files.length} files checked, ${out.length} violations` };
}
// </checker>

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const f of readdirSync(dir)) {
    if (['node_modules', 'dist', '_archive', '.git'].includes(f)) continue;
    const p = join(dir, f), s = statSync(p);
    if (s.isDirectory()) walk(p, acc); else if (/\.(tsx?|jsx?|mjs|html)$/.test(f) && !/support\.js$/.test(f)) acc.push(p);
  }
  return acc;
}
const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const ds = resolve(dirname(self), '..'), root = resolve(ds, '..');
  const paths = [...walk(join(ds, 'src')), ...walk(join(ds, 'showcase')), ...walk(join(root, 'landing')), ...walk(join(root, 'apps'))];
  const r = checkCallbacks(paths.map((p) => ({ path: relative(root, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') })));
  console.log(r.summary); for (const v of r.violations) console.log('  ' + v);
  process.exit(r.violations.length ? 1 : 0);
}
