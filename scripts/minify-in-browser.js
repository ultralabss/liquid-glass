// In-browser minifier for the probe pages only (design tool has no Node). Output: dist/ul-glass.min.js + .map.
// Production dist files are untouched. Usage: const min = new Function('readFile','saveFile','fetch', src)(...); await min();
return async function minifyInBrowser() {
  const sm = await (await fetch('https://unpkg.com/source-map@0.6.1/dist/source-map.min.js')).text();
  const mod = { exports: {} }; (new Function('module', 'exports', 'define', sm + ';'))(mod, mod.exports, undefined);
  const g = { sourceMap: mod.exports };
  const t = await (await fetch('https://unpkg.com/terser@5.31.0/dist/bundle.min.js')).text();
  (new Function('window', 'self', 'globalThis', 'sourceMap', 'module', 'exports', 'define', 'require', t + ';'))(g, g, g, mod.exports, undefined, undefined, undefined, () => mod.exports);
  const js = await readFile('design-system/dist/ul-glass.js');
  const m = await g.Terser.minify({ 'ul-glass.js': js }, { compress: { passes: 1 }, mangle: true, sourceMap: { filename: 'ul-glass.min.js', url: 'ul-glass.min.js.map' } });
  await saveFile('design-system/dist/ul-glass.min.js', m.code);
  await saveFile('design-system/dist/ul-glass.min.js.map', typeof m.map === 'string' ? m.map : JSON.stringify(m.map));
  return { js: js.length, min: m.code.length };
};
