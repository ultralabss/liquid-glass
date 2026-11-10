/*
 * NOT used by the showcase anymore (it loads ../dist/ul-glass.js). Keep for live-editing src/ without a rebuild:
 * swap the showcase <script> to ./dev-loader.js locally. Never ship it.
 *
 * Bundler-free dev loader for the showcase: fetches ../src/index.ts and its
 * relative imports, transpiles TS/TSX in the browser with Babel, injects CSS
 * imports as <link>, and exposes the library as window.UL (fires "ul:ready").
 * The showcase therefore renders the real library source, not a copy.
 * In an app, import from '@ultralabs/glass' through Vite/tsup instead.
 */
(function () {
  if (window.__ulLoader) return;
  window.__ulLoader = true;
  var me = document.currentScript || Array.prototype.find.call(document.scripts, function (s) { return /dev-loader\.js/.test(s.src); });
  var ENTRY = new URL('../src/index.ts', me.src).href;
  var BABEL = 'https://unpkg.com/@babel/standalone@7.26.4/babel.min.js';
  var mods = new Map();
  var externals = { react: function () { return window.React; }, 'react-dom': function () { return window.ReactDOM; } };

  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function wait(test) {
    return new Promise(function (res) { (function poll() { test() ? res() : setTimeout(poll, 30); })(); });
  }

  function load(url) {
    if (mods.has(url)) return mods.get(url).p;
    var rec = {};
    mods.set(url, rec);
    rec.p = (async function () {
      if (/\.css$/.test(url)) {
        rec.kind = 'css';
        if (!document.querySelector('link[data-ul-src="' + url + '"]')) {
          var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; l.dataset.ulSrc = url; document.head.appendChild(l);
        }
        return;
      }
      var res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error('[ul-loader] ' + res.status + ' ' + url);
      var text = await res.text();
      if (/\.json$/.test(url)) { rec.kind = 'json'; rec.exports = JSON.parse(text); return; }
      rec.kind = 'js';
      rec.code = window.Babel.transform(text, {
        filename: new URL(url).pathname,
        presets: [['typescript', { allExtensions: true, isTSX: /\.tsx$/.test(url) }], ['react', { runtime: 'classic' }]],
        plugins: ['transform-modules-commonjs'],
      }).code;
      rec.deps = {};
      var re = /require\((["'])([^"']+)\1\)/g, m, rel = [];
      while ((m = re.exec(rec.code))) if (m[2][0] === '.') rel.push(m[2]);
      await Promise.all(rel.map(function (spec) { var u = new URL(spec, url).href; rec.deps[spec] = u; return load(u); }));
    })();
    return rec.p;
  }

  function req(url) {
    var rec = mods.get(url);
    if (rec.kind === 'css') return {};
    if (rec.kind === 'json') return rec.exports;
    if (rec.module) return rec.module.exports;
    var module = { exports: {} };
    rec.module = module;
    var localRequire = function (spec) {
      if (spec[0] === '.') return req(rec.deps[spec]);
      if (externals[spec]) return externals[spec]();
      throw new Error('[ul-loader] unknown module ' + spec);
    };
    new Function('require', 'module', 'exports', rec.code + '\n//# sourceURL=' + url)(localRequire, module, module.exports);
    return module.exports;
  }

  (async function () {
    try {
      if (!window.Babel) await loadScript(BABEL);
      await load(ENTRY);
      await wait(function () { return !!window.React; });
      window.UL = req(ENTRY);
      window.dispatchEvent(new Event('ul:ready'));
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('ul:error', { detail: String(e) }));
    }
  })();
})();
