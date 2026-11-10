#!/usr/bin/env node
// JSDoc default accuracy (pre-freeze fixes 2, item 1). For every documented public prop whose JSDoc states a default
// ("Default X", "Default: X", "@default X"), find the default in the source and compare. The code is the truth.
// Sources looked at, in order: destructuring default in the component signature / `const { … } = props` (literal),
// `X.defaultProps`, a token fallback (`readToken('--ul-x', 123)` / `var(--ul-x)`) assigned to the prop.
// Result rows: matched · mismatch (doc ≠ code literal) · undetermined (no static default: localised labels, computed,
// token-only, "first item", …) → reviewed by hand. Dependency-free; design tool:
//   new Function(src.split('// <checker>\n')[1].split('// </checker>')[0].replace(/export /g, '') + 'return checkJsdocDefaults;')()(files)
// Usage: node scripts/check-jsdoc-defaults.mjs [--list] → "N checked · M matched · K mismatch · U undetermined"; exit 1 if K > 0.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

// <checker>
export function checkJsdocDefaults(files) {
  const rows = [];
  // false positives of the static search (reviewed by hand): the `?? ` match belongs to another object with the same key
  const IGNORE = { 'ULGaugeChartProps.label': 'b.label ?? … is the threshold band label, not the prop (prop has no default: the title is used)', 'ULRangeSliderProps.defaultValue': 'shares the ?? pattern with ULSlider; [min, max] is correct', 'ULSliderProps.defaultValue': 'first ?? match is the range slider; ULSlider uses defaultValue ?? o.min ?? 0 (doc: min, 0 when unset)' };
  const norm = (v) => String(v).trim().replace(/^['"`]|['"`]$/g, '').replace(/\s+/g, ' ');
  const literal = (v) => /^(['"`][^'"`]*['"`]|-?\d+(\.\d+)?|true|false|null|undefined)$/.test(v.trim());
  const docDefault = (doc) => { const m = doc.match(/@default\s+([^\s*]+)/) || doc.match(/\bDefault(?::|\s)\s*((?:[^.;(]|\.\d|\([^)]*\))+?)(?:\.(?:\s|$)|;|\s+\(|$)/); return m ? m[1].trim() : null; };
  const fileOf = {}; for (const f of files) fileOf[f.path] = f.text;
  // members with their JSDoc, per exported *Props interface / type
  const ifaceRe = /export\s+(?:interface\s+(\w+Props)\b[^{]*|type\s+(\w+Props)\s*(?:<[^=]*>)?\s*=\s*(?:[\w.<>, |&]*&\s*)?)\{/g;
  const all = files.filter((f) => /\.tsx?$/.test(f.path)).map((f) => f.text).join('\n');
  // component signatures: function X({ a = 1, … }: XProps) / forwardRef<…, XProps>(function X({ … }) / const { … } = props in a function typed XProps
  const sigDefaults = (iface) => {
    const out = {}; const comp = iface.replace(/Props$/, '');
    const pats = [new RegExp('function\\s+' + comp + '\\s*(?:<[^>]*>)?\\s*\\(\\s*\\{', 'g'), new RegExp('forwardRef<[^>]*' + iface + '[^>]*>\\(\\s*function\\s+\\w+\\s*\\(\\s*\\{', 'g'), new RegExp('const\\s+' + comp + '\\s*=\\s*\\(\\s*\\{', 'g')];
    const take = (s, i) => { let d = 1, j = i; for (; j < s.length && d > 0; j++) { const c = s[j]; if (c === '{' || c === '(' || c === '[') d++; else if (c === '}' || c === ')' || c === ']') d--; } return s.slice(i, j - 1); };
    const parse = (body) => { let d = 0, seg = ''; const segs = []; for (const c of body) { if ('{([<'.includes(c)) d++; else if ('})]>'.includes(c)) d--; if (c === ',' && d === 0) { segs.push(seg); seg = ''; } else seg += c; } segs.push(seg); for (const s of segs) { const m = s.trim().match(/^([\w$]+)(?:\s*:\s*[\w$]+)?\s*=\s*([\s\S]+)$/); if (m) out[m[1]] = m[2].trim(); } };
    for (const re of pats) { let m; while ((m = re.exec(all))) parse(take(all, m.index + m[0].length)); }
    // const { … } = props inside a function whose param is typed iface
    const fr = new RegExp('\\(\\s*props\\s*(?::\\s*' + iface + ')?\\s*,?[^)]*\\)[\\s\\S]{0,200}?const\\s*\\{', 'g'); let m2;
    const near = new RegExp('(?:function\\s+' + comp + '|forwardRef<[^>]*' + iface + ')[\\s\\S]{0,160}?\\(\\s*props', 'g');
    while ((m2 = near.exec(all))) { const k = all.indexOf('const {', m2.index); if (k > 0 && k - m2.index < 400) parse(take(all, k + 7)); }
    const dp = all.match(new RegExp(comp + '\\.defaultProps\\s*=\\s*\\{([^}]*)\\}')); if (dp) for (const p of dp[1].split(',')) { const m = p.match(/(\w+)\s*:\s*(.+)/); if (m && !(m[1] in out)) out[m[1]] = m[2].trim(); }
    return out;
  };
  const cache = {};
  for (const { path, text } of files) {
    if (!/\.tsx?$/.test(path) || /\.stories\./.test(path)) continue;
    let m; ifaceRe.lastIndex = 0;
    while ((m = ifaceRe.exec(text))) {
      const iface = m[1] || m[2]; let i = m.index + m[0].length, depth = 1; const start = i;
      for (; i < text.length && depth > 0; i++) { const c = text[i]; if (c === '{') depth++; else if (c === '}') depth--; }
      const body = text.slice(start, i - 1);
      for (const dm of body.matchAll(/\/\*\*([\s\S]*?)\*\/\s*(?:readonly\s+)?['"]?([\w-]+)['"]?\??\s*:/g)) {
        const doc = dm[1].replace(/\s*\*\s?/g, ' ').trim(), prop = dm[2], dd = docDefault(doc);
        if (!dd) continue;
        const defs = cache[iface] || (cache[iface] = sigDefaults(iface)); const code = defs[prop];
        const row = { iface, prop, doc: dd, code: code ?? null, path };
        if (IGNORE[iface + '.' + prop]) { row.status = 'undetermined'; row.note = IGNORE[iface + '.' + prop]; rows.push(row); continue; }
        const src = fileOf[path] || '';
        if (code == null) {
          // implicit defaults (no destructuring default): undefined reads as false; locale via lang() / 'en'; ids via useDomId / useIds
          if (/^false$/.test(dd)) { row.status = 'matched'; row.note = 'implicit undefined'; }
          else if (prop === 'locale' && /^"?en"?$/.test(dd) && /lang\(|\?\? 'en'|= 'en'/.test(src)) { row.status = 'matched'; row.note = 'lang() fallback'; }
          else if (/^generated$/.test(dd) && /useDomId|useIds|useId\(/.test(src)) { row.status = 'matched'; row.note = 'generated id'; }
          else if (/^true\b/.test(dd) && new RegExp('\\b' + prop + '\\s*[!=]==\\s*false').test(src)) { row.status = 'matched'; row.note = 'only false disables'; }
          else { const q = src.match(new RegExp('\\b' + prop + "\\s*\\?\\?\\s*(['\"`][^'\"`]*['\"`]|-?\\d+(?:\\.\\d+)?|true|false|\\[[^\\]]*\\])"));
            const lq = src.match(new RegExp('\\b' + prop + "\\s*\\?\\?\\s*(?:L|t|actionText|blockText)\\(|\\b" + prop + '\\s*\\?\\?\\s*t\\.'));
            if (q) { const c = norm(q[1]).replace(/\s/g, ''), d2 = norm(dd).replace(/\s/g, ''); row.code = q[1]; row.status = d2.startsWith(c) || d2.includes('"' + c + '"') ? 'matched' : 'mismatch'; row.note = '?? fallback'; }
            else if (lq) { row.status = /localised/i.test(dd) ? 'matched' : 'mismatch'; row.note = 'localised fallback (dictionary)'; }
            else row.status = 'undetermined'; }
        } else if (!literal(code)) {
          const tok = (code.match(/var\((--ul-[\w-]+)/) || code.match(/readToken\(\s*['"](--ul-[\w-]+)/) || [])[1];
          if (tok && dd.includes(tok)) { row.status = 'matched'; row.note = 'token ' + tok; } else { row.status = 'undetermined'; row.note = 'computed: ' + code.slice(0, 60); }
        } else {
          const c = norm(code), quoted = (dd.match(/["'`]([^"'`]*)["'`]/) || [])[1], bare = norm(dd.replace(/^localised\s*/i, ''));
          const same = quoted !== undefined ? quoted === c : bare === c || bare.split(/\s+/)[0] === c;
          row.status = same ? (/localised/i.test(dd) && /^['"`]/.test(code.trim()) ? 'mismatch' : 'matched') : 'mismatch';
          if (same && row.status === 'mismatch') row.note = 'code default is a fixed English string, not localised';
        }
        rows.push(row);
      }
    }
  }
  const n = (s) => rows.filter((r) => r.status === s).length;
  return { rows, summary: `${rows.length} checked · ${n('matched')} matched · ${n('mismatch')} mismatch · ${n('undetermined')} undetermined (review by hand)` };
}
// </checker>

function walk(dir, acc = []) { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, acc); else if (/\.tsx?$/.test(f)) acc.push(p); } return acc; }
const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const ds = resolve(dirname(self), '..');
  const r = checkJsdocDefaults(walk(join(ds, 'src')).map((p) => ({ path: relative(ds, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') })));
  console.log(r.summary);
  for (const x of r.rows.filter((x) => x.status === 'mismatch' || process.argv.includes('--list'))) console.log(`  ${x.status} ${x.iface}.${x.prop}: doc ${x.doc} · code ${x.code ?? '–'}${x.note ? ' (' + x.note + ')' : ''}`);
  process.exit(r.rows.some((x) => x.status === 'mismatch') ? 1 : 0);
}
