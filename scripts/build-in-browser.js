// In-browser twin of build-bundle.mjs (used by the design tool, which has no Node).
// Usage (inside a script runner with readFile/saveFile): const build = new Function('readFile','saveFile','fetch', src)(...); await build();
// Output format matches dist/ul-glass.js: def(id, deps, fn) CJS modules, CSS injected once, React/ReactDOM from window.
return async function buildInBrowser() {
  const btxt = await (await fetch('https://unpkg.com/@babel/standalone@7.26.4/babel.min.js')).text();
  const g = {}; (new Function('window', 'self', 'globalThis', btxt + ';'))(g, g, g);
  const Babel = g.Babel, ROOT = 'design-system/';
  const norm = (p) => { const out = []; for (const s of p.split('/')) { if (s === '..') out.pop(); else if (s !== '.' && s !== '') out.push(s); } return out.join('/'); };
  const idOf = (full) => (full.startsWith(ROOT + 'src/') ? full.slice((ROOT + 'src/').length) : full);
  const seen = new Set(), out = [], cssParts = [];
  async function visit(full) {
    if (seen.has(full)) return; seen.add(full);
    const id = idOf(full), src = await readFile(full);
    if (full.endsWith('.css')) { cssParts.push(`/* ${id} */\n${src}`); out.push('css.push(' + JSON.stringify(src) + ');\ndef(' + JSON.stringify(id) + ', {}, function(){});'); return; }
    if (full.endsWith('.json')) { out.push('def(' + JSON.stringify(id) + ', {}, function(module){ module.exports = ' + src.trim() + '; });'); return; }
    const code = Babel.transform(src, { filename: full, presets: [['typescript', { allExtensions: true, isTSX: full.endsWith('.tsx') }], ['react', { runtime: 'classic' }]], plugins: ['transform-modules-commonjs'] }).code;
    const deps = {}, re = /require\((["'])([^"']+)\1\)/g, dir = full.slice(0, full.lastIndexOf('/') + 1), rel = [];
    let m; while ((m = re.exec(code))) if (m[2][0] === '.') rel.push(m[2]);
    for (const spec of rel) { const f = norm(dir + spec); deps[spec] = idOf(f); await visit(f); }
    out.push('def(' + JSON.stringify(id) + ', ' + JSON.stringify(deps) + ', function(module, exports, require){\n' + code + '\n});');
  }
  await visit(ROOT + 'src/index.ts');
  const head = '/* @ultralabs/glass — prebuilt browser bundle generated from design-system/src (scripts/build-bundle.mjs). Do not edit. Exposes window.UL, fires "ul:ready". */\n(function(){ if (window.UL) return;\nvar M = {}, D = {};\nfunction req(from, spec){ if (spec === \'react\') return window.React; if (spec === \'react-dom\') return window.ReactDOM; var id = D[from][spec]; var m = M[id]; if (!m.loaded) { m.loaded = true; m.fn(m.module, m.module.exports, function(s){ return req(id, s); }); } return m.module.exports; }\nfunction def(id, deps, fn){ D[id] = deps; M[id] = { fn: fn, module: { exports: {} }, loaded: false }; }\nvar css = [];\n';
  const tail = "var st = document.createElement('style'); st.setAttribute('data-ul-bundle-css', ''); st.textContent = css.join('\\n'); if (!document.querySelector('link[data-ul-css]')) document.head.appendChild(st);\nfunction boot(){ if (!window.React || !window.ReactDOM) { setTimeout(boot, 20); return; } D.__entry = { e: 'index.ts' }; window.UL = req('__entry', 'e'); window.__ulLoader = true; window.dispatchEvent(new Event('ul:ready')); }\nboot();\n})();\n";
  const js = head + out.join('\n') + '\n' + tail;
  const css = '/* @ultralabs/glass — standalone stylesheet (same rules the JS bundle injects). Load tokens/tokens.css first. Add data-ul-css to the <link> to stop the bundle from injecting its copy. */\n' + cssParts.join('\n');
  await saveFile(ROOT + 'dist/ul-glass.js', js);
  await saveFile(ROOT + 'dist/ul-glass.css', css);
  return { modules: out.length, js: js.length, css: css.length };
};
