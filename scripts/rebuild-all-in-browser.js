// In-browser full rebuild (design tool, no Node): tokens.css from tokens.json, locked-timings check, dist/ul-glass.js + .css, dist/ul-glass.min.js + .map.
// Usage: const all = new Function('readFile','saveFile','fetch', src)(readFile, saveFile, fetch); log(await all());
// Node equivalent: npm run build:min (build-tokens.mjs and build-bundle.mjs both run check-locked.mjs).
return async function rebuildAll() {
  const P = 'design-system/';
  const cut = (s, a, z) => { const t = s.split(a)[1].split(z)[0]; return t.slice(t.indexOf('\n') + 1).replace(/export function/g, 'function'); };
  const b = await readFile(P + 'scripts/build-tokens.mjs'), c = await readFile(P + 'scripts/check-locked.mjs');
  const mod = new Function(cut(b, '// <builder>', '// </builder>') + cut(c, '// <checker>', '// </checker>') + ';return {checkLocked,buildTokens,springCurve,springToLinear};')();
  const json = JSON.parse(await readFile(P + 'tokens/tokens.json')), css = mod.buildTokens(json);
  await saveFile(P + 'tokens/tokens.css', css);
  const r = mod.checkLocked({ locked: JSON.parse(await readFile(P + 'scripts/locked-timings.json')), json, css, design: await readFile(P + 'DESIGN.md'), ...mod });
  if (r.diffs.length) return { locked: r.summary, diffs: r.diffs, built: false };
  const build = new Function('readFile', 'saveFile', 'fetch', await readFile(P + 'scripts/build-in-browser.js'))(readFile, saveFile, fetch);
  const out = await build();
  const min = new Function('readFile', 'saveFile', 'fetch', await readFile(P + 'scripts/minify-in-browser.js'))(readFile, saveFile, fetch);
  const m = await min();
  return { locked: r.summary, js: out.js, css: out.css, min: m.min };
};
