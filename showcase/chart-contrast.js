// Chart + action contrast reports (Task 3C 0a). Every colour goes through the shared tool (ul-contrast.js → window.ULContrast):
// computed values in any CSS Color 4 space, CSS gamut mapping to sRGB, translucent layers composited over the modelled panel,
// unresolved tokens throw. Panel = UL.worstSurface (brightest allowed backdrop per class, every accent × strength, both themes,
// no pointer light: large lite panels have none). Run: probe-charts.dc.html?contrast · probe-forms.dc.html?contrast (action matrix).
(function () {
  function define() {
    const UL = window.UL, React = window.React, C = window.ULContrast;
    if (!C) throw new Error('chart-contrast.js needs ul-contrast.js loaded first');
    const r2 = C.round, alpha = (c, a) => [c[0], c[1], c[2], (c[3] ?? 1) * a];
    const opaque = (c) => (c[3] ?? 1) < 1 ? null : c;
    function collector() {
      const rows = [], worst = {};
      const note = (cat, fg, bg, combo, min) => { let v; try { v = C.ratio(fg, bg); } catch (e) { throw new Error(e.message + ' · ' + cat + ' · ' + combo + ' · bg ' + bg.map((x) => +(+x).toFixed(3)).join(',')); } rows.push({ cat, v: r2(v), combo, pass: v >= min }); if (!worst[cat] || v < worst[cat].v) worst[cat] = { v: r2(v), combo, min, pass: v >= min }; };
      const infos = {}; const info = (cat, fg, bg, combo) => { const v = C.ratio(fg, bg); if (!infos[cat] || v < infos[cat].v) infos[cat] = { v: r2(v), combo }; };
      const out = () => { const fails = rows.filter((r) => !r.pass); return { checked: rows.length, fails: fails.length, worst, info: infos, firstFails: fails.slice(0, 8) }; };
      return { note, info, out };
    }
    function themeRoot(theme, accent) {
      const root = document.createElement('div'); root.setAttribute('data-ul-theme', theme); root.setAttribute('data-ul-accent', accent);
      root.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;'; document.body.appendChild(root); return root;
    }
    function tokensFor(root, R) {
      const t = UL.readContrastTokens(root);
      t.text = R.get('var(--ul-color-text)').slice(0, 3); t.text2 = R.get('var(--ul-color-text-2)').slice(0, 3); // library toRGB is canvas-based: replace with resolved values
      return t;
    }
    const panels = (t, acc) => { const list = []; for (const strength of UL.ACCENT_STRENGTHS) for (const backdrop of ['dark', 'mid', 'light']) { const x = Math.min(1, Math.max(0, (t.k[strength] - t.k.subtle) / (1 - t.k.subtle))); list.push({ strength, backdrop, x, P: UL.worstSurface(t, acc.slice(0, 3), backdrop, x).concat(1) }); } return list; };
    async function render(root, el) { const box = document.createElement('div'); root.appendChild(box); const r = window.ReactDOM.createRoot(box); r.render(el); for (let i = 0; i < 20 && !box.firstElementChild; i++) await new Promise((f) => setTimeout(f, 30)); return { box, done: () => { r.unmount(); box.remove(); } }; }

    async function chartContrastReport() {
      await C.ready();
      const { note, info, out } = collector();
      for (const theme of ['app', 'marketing']) for (const accent of UL.ACCENT_PRESETS) {
        const root = themeRoot(theme, accent), R = C.resolver(root, 'ul-chart2'), t = tokensFor(root, R), acc = R.get(`var(--ul-accent-${accent})`);
        const series = [0, 1, 2, 3, 4, 5].map((i) => R.get(`var(--ul-chart-s${i})`));
        const ink = R.get('var(--ul-chart-pattern-ink)'), pOp = R.num('--ul-chart-pattern-opacity'), areaA = Math.min(1, R.num('--ul-chart-area') * 2);
        const text = R.get('var(--ul-color-text)'), tick = R.get('var(--ul-chart-tick-ink)'), refLabel = R.get('var(--ul-chart-ref-label)');
        const tipBg = R.get('var(--ul-tooltip-bg, var(--ul-color-shadow))'), tipInk = R.get('var(--ul-tooltip-ink, rgb(var(--ul-color-white-rgb)))'), tipSub = R.get('color-mix(in srgb, var(--ul-tooltip-ink, #fff) 72%, transparent)');
        const chip = R.get('rgb(var(--ul-color-white-rgb) / .07)');
        const tones = { neutral: R.get('var(--ul-chart-ref-neutral)'), accent: series[0], success: R.get('var(--ul-chart-ref-success)'), warning: R.get('var(--ul-chart-ref-warning)'), danger: R.get('var(--ul-chart-ref-danger)') };
        const win = R.get('var(--ul-chart-win)'), loss = R.get('var(--ul-chart-loss)'), barFade = R.num('--ul-chart-bar-fade'), spkA = R.num('--ul-chart-spk-bar-opacity');
        const staleBg = R.get('var(--ul-chart-stale-bg)'), staleInk = R.get('var(--ul-chart-stale-ink)');
        const seq = [0, 1, 2, 3, 4, 5, 6].map((q) => R.get(`var(--ul-chart-seq-${q})`)), div = [0, 1, 2, 3, 4, 5, 6].map((q) => R.get(`var(--ul-chart-div-${q})`));
        const inkD = R.get('var(--ul-chart-cell-ink-dark)'), ring = R.get('var(--ul-chart-ring)'), brushEdge = R.get('var(--ul-chart-brush-edge)'), dangerInk = R.get('var(--ul-chart-danger-ink)');
        const hatch = (c) => C.over(alpha(ink, pOp), c);
        seq.forEach((c, q) => note('heatmap label on its cell (≥ 4.5)', inkD, opaque(c) || c, `${theme} · ${accent} · seq q${q}`, 4.5));
        div.forEach((c, q) => note('heatmap label on its cell (≥ 4.5)', inkD, opaque(c) || c, `${theme} · ${accent} · div q${q}`, 4.5));
        series.forEach((c, i) => { note('treemap label on its tile (≥ 4.5)', inkD, c, `${theme} · ${accent} · s${i}`, 4.5); note('treemap label on its tile (≥ 4.5)', inkD, C.over(alpha(ink, 0.3 * pOp), c), `${theme} · ${accent} · s${i} + hatch`, 4.5); });
        for (const { strength, backdrop, P } of panels(t, acc)) {
          const combo = `${theme} · ${accent} · ${strength} · ${backdrop}`;
          series.forEach((c, i) => {
            const k = `${combo} · s${i}`, bar = C.over(alpha(c, barFade), P), area = C.over(alpha(c, areaA), P);
            note('line: series stroke vs panel (≥ 3)', c, P, k, 3);
            note('area: edge line vs panel above it (≥ 3)', c, P, k, 3); info('area: edge line vs its own fill top (info, same series)', c, area, k);
            note('bar: fill (bottom stop --ul-chart-bar-fade) vs panel (≥ 3)', bar, P, k, 3);
            note('combo: bar fill and line vs panel (≥ 3)', bar, P, k, 3); note('combo: bar fill and line vs panel (≥ 3)', c, P, k, 3);
            note('donut / pie: slice vs panel (≥ 3)', c, P, k, 3);
            note('patterns: hatched series vs panel (≥ 3)', hatch(c), P, k + ' · slice', 3); note('patterns: hatched series vs panel (≥ 3)', hatch(bar), P, k + ' · bar', 3);
            if (i < 5) { note('sparkline: line / bars vs card (≥ 3)', c, P, k, 3); note('sparkline: line / bars vs card (≥ 3)', C.over(alpha(c, spkA), P), P, k + ' · bar', 3); }
          });
          note('sparkline: line / bars vs card (≥ 3)', C.over(alpha(win, spkA), P), P, combo + ' · win', 3); note('sparkline: line / bars vs card (≥ 3)', C.over(alpha(loss, spkA), P), P, combo + ' · loss', 3);
          note('axis / tick text (≥ 4.5)', tick, P, combo, 4.5);
          note('legend chip text on (≥ 4.5)', text, C.over(chip, P), combo, 4.5);
          note('legend chip text off (≥ 4.5)', tick, P, combo, 4.5);
          for (const [k, c] of Object.entries(tones)) note('reference / threshold line (≥ 3)', c, P, `${combo} · ${k}`, 3);
          note('reference label text (≥ 4.5)', refLabel, P, combo, 4.5);
          note('stale badge text (≥ 4.5)', staleInk, C.over(staleBg, P), combo, 4.5);
          seq.forEach((c, q) => note('heatmap / calendar sequential cell vs panel (≥ 3)', c, P, `${combo} · q${q}`, 3));
          div.forEach((c, q) => note('heatmap diverging cell vs panel (≥ 3)', c, P, `${combo} · q${q}`, 3));
          note('radar rings / spokes (≥ 3)', ring, P, combo, 3);
          for (const k of ['success', 'warning', 'danger']) note('gauge threshold band (≥ 3)', tones[k], P, `${combo} · ${k}`, 3);
          note('gauge target / needle (≥ 3)', text, P, combo, 3); note('gauge comparison marker (≥ 3)', series[5], P, combo, 3);
          note('funnel step (≥ 3)', series[0], P, combo, 3); note('funnel drop-off text (≥ 4.5)', dangerInk, P, combo, 4.5);
          note('brush edge (≥ 3)', brushEdge, P, combo, 3);
          note('hover indicator ring (≥ 3)', text, P, combo, 3);
        }
        const tip = opaque(tipBg); if (!tip) throw new Error('chart tooltip background must be opaque, got alpha ' + tipBg[3]);
        note('tooltip text (≥ 4.5)', tipInk, tip, `${theme} · ${accent}`, 4.5);
        note('tooltip secondary text (≥ 4.5)', tipSub, tip, `${theme} · ${accent} · title row`, 4.5);
        series.forEach((c, i) => note('tooltip key on tooltip (≥ 3)', c, tip, `${theme} · ${accent} · s${i}`, 3));
        R.done(); root.remove();
      }
      return out();
    }

    // Action buttons: label ink read from real rendered ULButtons per variant; surface = worstSurface with the variant's tone.
    async function actionContrastReport() {
      await C.ready();
      const { note, out } = collector();
      const variants = ['primary', 'secondary', 'tinted', 'plain', 'destructive'];
      for (const theme of ['app', 'marketing']) for (const accent of UL.ACCENT_PRESETS) {
        const root = themeRoot(theme, accent), R = C.resolver(root, 'ul-act'), t = tokensFor(root, R), acc = R.get(`var(--ul-accent-${accent})`), danger = R.get('var(--ul-color-danger)');
        const soft = R.get('var(--ul-success-soft)'), green = R.get('var(--ul-success)'), edge = R.get('var(--ul-success-ink)'), accTone = R.get('color-mix(in oklab, var(--ul-accent) 55%, #000)');
        const ink = {};
        for (const v of variants) { const h = await render(root, React.createElement(UL.ULButton, { variant: v }, 'Save')); const b = h.box.querySelector('button'); ink[v] = R.get(getComputedStyle(b).color); h.done(); }
        for (const { strength, backdrop, x } of panels(t, acc)) {
          const page = Array(3).fill(Math.min(1, t.maxLum[backdrop] <= 0.0031308 ? 12.92 * t.maxLum[backdrop] : 1.055 * t.maxLum[backdrop] ** (1 / 2.4) - 0.055)).concat(1);
          const combo = `${theme} · ${accent} · ${strength} · ${backdrop}`;
          for (const v of variants) {
            const tone = v === 'destructive' ? danger : acc, vx = v === 'primary' || v === 'destructive' ? 1 : v === 'tinted' ? x : 0;
            const S = UL.worstSurface(t, tone.slice(0, 3), backdrop, vx).concat(1), L = ink[v];
            note('check on success disc (≥ 4.5)', L, soft, `${combo} · ${v}`, 4.5);
            for (const [tn, tc] of [['success', soft], ['accent', accTone]]) {
              note('label over wave front (≥ 4.5)', L, C.over(tc, S), `${combo} · ${v} · ${tn}`, 4.5);
              note('label over wave interior 46 % (≥ 4.5)', L, C.over(alpha(tc, 0.46), S), `${combo} · ${v} · ${tn}`, 4.5);
            }
          }
          const g = C.ratio(green, page), e = C.ratio(edge, page);
          note('success ring: best of green band / ink edge vs page (≥ 3)', g >= e ? green : edge, page, `${combo} · green ${r2(g)} · edge ${r2(e)}`, 3);
        }
        R.done(); root.remove();
      }
      return out();
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { chartContrastReport, actionContrastReport });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
