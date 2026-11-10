// Runs INSIDE viewport-tests iframes (vt-frame.dc.html). window.__vt.run() → { size, toast, radius, narrow, submenu, layout, charts, batch }.
// Pre-freeze fixes item 5: the frame loads only the bundle + this file; every step loads its demo scripts and mounts its
// fixtures lazily, steps run one after another with progress (postMessage { vtProgress } to the parent + on-frame line).
(function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), raf = () => new Promise((r) => requestAnimationFrame(r));
  const vis = (n) => n && n.style.visibility !== 'hidden' && n.getClientRects().length > 0;
  async function toast(n = 8) {
    const vv = window.visualViewport, inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ul-toast-inset')) || 16;
    let frames = 0, worst = -Infinity, worstSide = '', maxVis = 0, k = 0;
    const t0 = performance.now();
    const timer = setInterval(() => { if (k < n) window.__mt2cToast && window.__mt2cToast(k++); }, 140);
    while (performance.now() - t0 < 140 * n + 1400) {
      await raf(); frames++;
      const L = vv ? vv.offsetLeft : 0, T = vv ? vv.offsetTop : 0, R = L + (vv ? vv.width : innerWidth), B = T + (vv ? vv.height : innerHeight);
      const ss = [...document.querySelectorAll('.ul-toast-stack .ul-anchored')].filter(vis);
      maxVis = Math.max(maxVis, ss.length);
      for (const s of ss) {
        const r = s.getBoundingClientRect(); if (r.height < 4 || r.width < 4) continue;
        for (const [d, side] of [[T + inset - r.top, 'top'], [r.bottom - (B - inset), 'bottom'], [L + inset - r.left, 'left'], [r.right - (R - inset), 'right']]) if (d > worst) { worst = d; worstSide = side; }
      }
    }
    clearInterval(timer);
    window.__mt2cToastClear && window.__mt2cToastClear(); await wait(900);
    return { pass: worst <= 2, frames, worst: Math.max(0, worst), side: worstSide, maxVis, inset };
  }
  async function narrow() {
    const t = document.querySelector('[data-case="range"] .ul-range-open'); if (!t) return { pass: null, note: 'no fixture' };
    for (let i = 0; i < 4 && [...document.querySelectorAll('.ul-anchored')].some(vis); i++) { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300); }
    for (let i = 0; i < 40 && document.querySelector('[data-ul-morphing]:not(.ul-toast-surface)'); i++) await wait(50);
    t.click(); await wait(800);
    const s = [...document.querySelectorAll('.ul-anchored')].filter(vis).find((x) => x.classList.contains('ul-range-surface'));
    const out = s ? (() => { const r = s.getBoundingClientRect(); return { months: +s.dataset.months, layout: s.dataset.layout, w: Math.round(r.width), vw: innerWidth, inside: r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 && r.top >= -0.5, bottomGap: Math.round(innerHeight - r.bottom) }; })() : null;
    (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(700);
    if (!out) return { pass: false, note: 'no surface' };
    const small = innerWidth <= 640;
    out.pass = small ? out.months === 1 && out.layout === 'bottom' && out.inside : out.months === 2 && out.inside;
    return out;
  }
  const load = (f) => new Promise((res) => { if (document.querySelector('script[data-vt="' + f + '"]')) return res(); const s = document.createElement('script'); s.src = './' + f; s.dataset.vt = f; s.onload = res; s.onerror = res; document.head.appendChild(s); });
  const until = async (fn, ms = 15000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await wait(100); } return !!fn(); };
  let fixtures = null;
  async function mountFixtures() {
    if (fixtures) return true;
    await load('demos-2e.js'); await load('demos-2c.js');
    if (!(await until(() => window.ULDemos && window.ULDemos.PickerFixtures && window.ULDemos.MotionFixtures))) return false;
    const host = document.getElementById('vt-fixtures') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'vt-fixtures' }));
    fixtures = window.ReactDOM.createRoot(host);
    fixtures.render(window.React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, window.React.createElement(window.ULDemos.PickerFixtures), window.React.createElement(window.ULDemos.MotionFixtures)));
    return until(() => window.__mt2c && window.__mt2e);
  }
  const progress = (p) => { window.__vtProgress = p; const el = document.getElementById('vt-progress'); if (el) el.textContent = `${p.i} / ${p.n} · ${p.step} ${p.state}`; if (parent !== window) parent.postMessage({ vtProgress: p }, '*'); };
  const withTimeout = (pr, ms) => Promise.race([pr, wait(ms).then(() => ({ status: 'timeout', checks: [], note: 'step did not finish in ' + Math.round(ms / 1000) + 's' }))]);
  const STEPS = [
    ['toast', async () => (await mountFixtures()) ? toast() : { pass: false, note: 'fixtures not ready' }],
    ['radius', async () => (await mountFixtures()) && window.ULDemos.radiusTest ? window.ULDemos.radiusTest() : { status: 'n/a', checks: [] }],
    ['narrow', async () => (await mountFixtures()) ? narrow() : { pass: null }],
    ['submenu', async () => { await load('demos-2f.js'); await load('demos-2g.js'); await until(() => window.ULDemos.submenuTest, 8000); return window.ULDemos.submenuTest ? window.ULDemos.submenuTest() : { status: 'n/a', checks: [] }; }],
    ['layout', async () => { await load('demos-2o.js'); await until(() => window.ULDemos.layoutOverflowTest, 8000); const D = window.ULDemos, out = []; for (const f of ['layoutOverflowTest', 'iconSizeTest', 'controlTextTest']) if (D[f]) { const r = await D[f](); out.push(...r.checks.map((c) => Object.assign({}, c, { key: f.replace('Test', '') + ' · ' + c.key }))); } return { status: out.every((c) => c.pass !== false) ? 'pass' : 'fail', checks: out }; }],
    ['charts', async () => { await load('demos-2o.js'); await load('demos-3d.js'); await load('demos-3b.js'); await until(() => window.ULDemos.chartGuardAll && window.ULDemos.__scanControls, 10000); return window.ULDemos.chartGuardAll ? window.ULDemos.chartGuardAll() : { status: 'n/a', checks: [] }; }],
    ['batch', async () => { for (const f of ['ul-contrast.js', 'demos-3e.js', 'demos-3f.js', 'demos-3h.js', 'demos-3i.js', 'demos-3g.js']) await load(f); await until(() => window.ULDemos.formsTests && window.ULDemos.Forms && window.ULDemos.Feedback && window.ULDemos.Batch2, 12000); return window.ULDemos.formsTests ? window.ULDemos.formsTests.guard() : { status: 'n/a', checks: [] }; }],
  ];
  window.__vt = {
    steps: STEPS.map((s) => s[0]),
    async run(only) {
      const size = `${innerWidth}×${innerHeight}`, out = { size }, list = STEPS.filter(([k]) => !only || only.includes(k));
      for (let i = 0; i < list.length; i++) {
        const [k, fn] = list[i]; progress({ i: i + 1, n: list.length, step: k, state: 'running', size }); const t0 = performance.now();
        try { out[k] = await withTimeout(fn(), k === 'batch' || k === 'charts' ? 180000 : 90000); } catch (e) { out[k] = { status: 'error', checks: [], note: String(e && e.message || e) }; }
        out[k].ms = Math.round(performance.now() - t0);
        progress({ i: i + 1, n: list.length, step: k, state: 'done', size, partial: out });
      }
      window.__vtResult = out; return out;
    },
  };
})();
