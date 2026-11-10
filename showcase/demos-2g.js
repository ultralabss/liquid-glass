// Motion-test cards for Part 3 (rolling number, context menu, pointer-inclusive glass stability, KPI, live layer, data glass,
// drill-in, toast over modal). Composes window.UL only. Every test runs on the live rAF clock and returns { status, checks, driver }.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value });
    const result = (checks, driver = 'live rAF') => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver });
    /** Mount a throwaway React tree in a fixed on-screen stage (rAF is not throttled for on-screen content). */
    async function stage(el, w = 860) {
      const box = document.createElement('div');
      box.setAttribute('data-ul-theme', document.querySelector('[data-ul-theme]')?.getAttribute('data-ul-theme') || 'app');
      box.style.cssText = `position:fixed;right:12px;bottom:12px;z-index:50;width:${w}px;max-height:70vh;overflow:auto;padding:12px;border-radius:16px;background:#0d1117;box-shadow:0 10px 40px rgb(0 0 0/.6)`;
      document.body.appendChild(box);
      const root = window.ReactDOM.createRoot(box);
      let setV = null;
      function Host() { const [v, set] = React.useState(0); setV = set; return el(v); }
      root.render(h(Host));
      await wait(300);
      return { box, set: (v) => setV(v), done: async () => { root.unmount(); box.remove(); await wait(50); } };
    }

    /* ---------- A: rolling number, one glyph per cell ---------- */
    function rollProbe(root) {
      const o = { rolling: 0, restBad: 0, winBad: 0, lines: 0, neighbours: 0, stripOff: 0, n: 0, ex: [] };
      root.querySelectorAll('.ul-roll').forEach((r) => {
        const reels = [...r.querySelectorAll('.ul-roll-reel:not([data-ghost])')];
        const tops = new Set([...r.querySelector('.ul-roll-vis').children].filter((c) => c.dataset.ghost == null).map((c) => Math.round(c.getBoundingClientRect().top)));
        if (tops.size > 1) { o.lines++; o.ex.push('wrap: ' + r.textContent.slice(0, 24)); }
        reels.forEach((el) => {
          o.n++;
          const g = el.querySelector('.ul-roll-glyph'), er = el.getBoundingClientRect(), cell = parseFloat(getComputedStyle(g).height);
          if (Math.abs(er.height - cell) > 0.5) { o.winBad++; o.ex.push(`window ${er.height.toFixed(2)} ≠ cell ${cell.toFixed(2)}`); }
          const strip = el.querySelector('.ul-roll-strip');
          if (el.dataset.rolling == null) {
            if (strip.childElementCount || getComputedStyle(strip).display !== 'none') { o.restBad++; o.ex.push('strip visible at rest'); }
            if (Math.abs(g.getBoundingClientRect().top - er.top) > 0.5) { o.restBad++; o.ex.push('glyph offset at rest'); }
          } else {
            o.rolling++;
            // cells that intersect the window: during motion at most two (the leaving and the arriving digit)
            const vis = [...strip.children].filter((c) => { const b = c.getBoundingClientRect(); return b.bottom > er.top + 0.5 && b.top < er.bottom - 0.5; });
            if (vis.length > 2) { o.neighbours++; o.ex.push(`${vis.length} cells in window`); }
            const st = new DOMMatrixReadOnly(getComputedStyle(strip).transform);
            const anim = strip.getAnimations()[0];
            if (anim && anim.playState === 'finished') { const off = Math.abs(st.m42) / cell; if (Math.abs(off - Math.round(off)) * cell > 0.5) o.stripOff++; }
          }
        });
      });
      return o;
    }
    async function rollTest() {
      const checks = [], c = ck(checks);
      const L = ['en', 'sk', 'de', 'cs'];
      const vals = [[1234567.89, 12400, 0.034, -842], [1234598.12, 12990, 0.041, -799], [999999.99, 9800, 0.039, -1203], [1000000.01, 10100, 0.1, 8]];
      const tile = (k, i, v, loc) => h('div', { key: k + i, style: { width: '200px' } }, h(UL.ULKpiCard, {
        label: `${k} · ${loc}`, value: v, locale: loc, delta: i === 0 ? 3.9 : -2.4, compact: k === 'compact',
        format: k === 'eur' ? { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 } : k === 'pct' ? { style: 'percent', maximumFractionDigits: 1 } : undefined }));
      const S = await stage((v) => h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
        ...L.flatMap((loc, li) => ['eur', 'compact', 'pct', 'neg'].map((k, ki) => tile(k, li, vals[v][ki], loc)))));
      await wait(1400); // reveal
      const agg = { rolling: 0, restBad: 0, winBad: 0, lines: 0, neighbours: 0, stripOff: 0, frames: 0, n: 0 }, ex = [];
      let rest0 = rollProbe(S.box);
      for (let u = 1; u < vals.length; u++) {
        S.set(u);
        const t0 = performance.now(); let sawRoll = false;
        while (performance.now() - t0 < 2000) {
          await raf(); agg.frames++;
          const o = rollProbe(S.box); if (o.rolling) sawRoll = true;
          for (const k of ['restBad', 'winBad', 'lines', 'neighbours', 'stripOff']) agg[k] += o[k];
          agg.rolling += o.rolling; agg.n = o.n; ex.push(...o.ex);
        }
        if (!sawRoll) ex.push(`update ${u}: no roll seen`);
      }
      const end = rollProbe(S.box);
      c('rest', 'at rest: one static glyph per cell (strip empty, glyph on the window)', rest0.restBad + end.restBad === 0 && end.rolling === 0, `${end.n} reels · rest violations ${rest0.restBad + end.restBad} · still rolling ${end.rolling}`);
      c('window', 'clip window = cell height (±0.5px)', agg.winBad === 0, `${agg.winBad} violations over ${agg.frames} frames`);
      c('line', 'value is one line (4 locales, EUR, compact, %, negative, 200px tiles)', agg.lines === 0, `${agg.lines} wrapped samples`);
      c('motion', 'while rolling: ≤ 2 cells in the window, finished strip on a cell boundary', agg.neighbours + agg.stripOff === 0, `${agg.rolling} rolling reel-frames · neighbours ${agg.neighbours} · off-boundary ${agg.stripOff}`);
      c('dpr', `DPR ${devicePixelRatio} · zoom 100 % (DPR 2 / 3 and 90–125 % zoom cannot be set from the page: run manually)`, null, 'manual');
      if (ex.length) console.warn('[rollTest]\n' + [...new Set(ex)].slice(0, 20).join('\n'));
      await S.done();
      return result(checks);
    }

    window.ULDemos = Object.assign(window.ULDemos || {}, { rollTest, __stage: stage, __rollProbe: rollProbe });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
