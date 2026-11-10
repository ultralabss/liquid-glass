// Task 3B: chart guard fixture (layoutoverflow / iconsize / ctrltext) + chart test cards (motion-test ?norun&card=<id>).
// Mounts its own fixtures (fixed, on screen). Frame-independent checks always run; frame-dependent ones return
// status 'n/a' with "NEEDS HEALTHY PREVIEW" when the preview runs below 50 fps.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const settle = async (ms = 400) => { await wait(ms); await raf(); await raf(); };
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value });
    const result = (checks, driver = 'live rAF') => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver });
    const stats = () => window.__ulChartStats || { morphs: 0, log: [], last: null };
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const rows = (n, k = 0) => Array.from({ length: n }, (_, i) => ({ x: n <= 12 ? MON[i] : `${MON[i % 12]} ${2020 + Math.floor(i / 12)}`, a: 1000 - i * 13 + (i % 3) * 40 + k, b: 80 + (i % 5) * 5, c: i % 4 === 2 ? null : 50 + i }));
    const S3 = [{ key: 'a', name: 'Alpha', value: (d) => d.a }, { key: 'b', name: 'Beta', value: (d) => d.b }, { key: 'c', name: 'Gamma', value: (d) => d.c }];
    const SHARES = [{ k: 'Card', v: 4820 }, { k: 'Bank transfer', v: 2310 }, { k: 'Apple Pay', v: 1650 }, { k: 'Google Pay', v: 980 }, { k: 'PayPal', v: 240 }, { k: 'Crypto', v: 90 }];
    const HB = [{ k: 'Slovakia', v: 4200 }, { k: 'Czechia', v: 3650 }, { k: 'Germany (Baden-Württemberg region)', v: 2980 }, { k: 'Austria', v: 1420 }];
    const nf = new Intl.NumberFormat('en-GB'), fmt = (v) => (v == null ? '–' : nf.format(v));
    const pct = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 });

    /* ---------- mount ---------- */
    async function mount(el, w) {
      const host = document.createElement('div');
      host.setAttribute('data-ul-theme', 'app'); host.setAttribute('data-ul-accent', 'violet'); host.setAttribute('data-chart-fixture', '');
      const W = Math.min(w || 860, innerWidth - 16);
      host.style.cssText = `position:fixed;left:8px;top:8px;z-index:900;width:${W}px;max-height:${innerHeight - 16}px;overflow:auto;padding:12px;box-sizing:border-box;background:#0b0d12;display:flex;flex-direction:column;gap:12px;border-radius:12px`;
      document.body.appendChild(host);
      const root = window.ReactDOM.createRoot(host); let setEl = null;
      function Holder() { const [e, s] = React.useState(() => el); setEl = s; return e; }
      root.render(h(Holder)); await settle(500);
      return { box: host, set: async (e) => { setEl(() => e); await raf(); await raf(); await wait(30); }, done: async () => { root.unmount(); host.remove(); await raf(); } };
    }
    const fig = (box, i = 0) => box.querySelectorAll('.ul-chart2')[i];
    const plotOf = (f) => f.querySelector('.ul-chart2-plot');
    const keyOn = (el, key) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const live = (f) => (f.querySelector('[aria-live="polite"]') || {}).textContent || '';
    const hoverOf = (f) => f.querySelector('.ul-chart-hover');
    const ptr = (el, type, fx = 0.5, fy = 0.4) => { const r = el.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, pointerType: 'mouse' }; el.dispatchEvent(type === 'click' ? new MouseEvent('click', o) : new PointerEvent(type, o)); };
    const refresh = () => (window.__ulRefreshP = window.__ulRefreshP || new Promise((res) => { const ts = []; const st = (t) => { ts.push(t); if (ts.length < 61) requestAnimationFrame(st); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b), p = d[30]; res({ period: p, hz: 1000 / p, p95Limit: 1.15 * p, fpsTarget: 0.9 * 1000 / p, healthy: 1000 / p >= 50 }); } }; requestAnimationFrame(st); })); // shared: limits relative to the measured display refresh (p95 ≤ 1.15 × period, fps ≥ 0.9 × rate)
    const fps = async (ms = 500) => { let n = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { await raf(); n++; } return (n * 1000) / (performance.now() - t0); };

    /* ---------- guard fixture: every type and state ---------- */
    function GuardFixture() {
      const d = rows(12), C = { locale: 'en' };
      return h(React.Fragment, null,
        h(UL.ULLineChart, Object.assign({}, C, { title: 'Line · references and thresholds with a long title that has to wrap', description: 'Gross, EUR', data: d, x: (r) => r.x, series: S3, references: [{ value: 900, label: 'Target', tone: 'accent' }], thresholds: [{ from: 0, to: 300, tone: 'danger' }], height: 200, contextMenu: () => [{ id: 'x', label: 'X' }] })),
        h(UL.ULAreaChart, Object.assign({}, C, { title: 'Area stacked', data: d, x: (r) => r.x, series: S3, stack: 'stacked', height: 180 })),
        h(UL.ULAreaChart, Object.assign({}, C, { title: 'Area percent', data: d, x: (r) => r.x, series: S3, stack: 'percent', height: 180, patterns: 'on' })),
        h(UL.ULBarChart, Object.assign({}, C, { title: 'Bar grouped', data: d, x: (r) => r.x, series: S3.slice(0, 2), height: 180 })),
        h(UL.ULBarChart, Object.assign({}, C, { title: 'Bar stacked', data: d, x: (r) => r.x, series: S3, stack: 'stacked', height: 180 })),
        h(UL.ULBarChart, Object.assign({}, C, { title: 'Bar horizontal', orientation: 'horizontal', data: HB, x: (r) => r.k, series: [{ key: 'v', name: 'Customers', value: (r) => r.v }], height: 180 })),
        h(UL.ULComboChart, Object.assign({}, C, { title: 'Combo dual axis', data: d, x: (r) => r.x, series: [{ key: 'a', name: 'Sessions', type: 'bar', value: (r) => r.a }, { key: 'b', name: 'Conversion rate', type: 'line', axis: 'right', value: (r) => r.b / 30 }], axes: { left: { label: 'Sessions' }, right: { label: 'Conversion %' } }, height: 180 })),
        h(UL.ULDonutChart, Object.assign({}, C, { title: 'Donut', data: SHARES, label: (r) => r.k, value: (r) => r.v, mergeBelow: 0.02, height: 200, center: h(UL.ULRollingNumber, { value: 10090 }), centerLabel: 'payments' })),
        h(UL.ULPieChart, Object.assign({}, C, { title: 'Pie', data: SHARES.slice(0, 4), label: (r) => r.k, value: (r) => r.v, height: 180 })),
        h(UL.ULLineChart, Object.assign({}, C, { title: 'Line 1000 points', data: rows(1000), x: (r) => r.x, series: S3.slice(0, 2), height: 180 })),
        h(UL.ULLineChart, Object.assign({}, C, { title: 'Loading', data: d, x: (r) => r.x, series: S3, state: 'loading', height: 160 })),
        h(UL.ULLineChart, Object.assign({}, C, { title: 'Empty', data: [], x: (r) => r.x, series: S3, height: 160 })),
        h(UL.ULLineChart, Object.assign({}, C, { title: 'Error', data: d, x: (r) => r.x, series: S3, state: 'error', onRetry: () => wait(100), height: 160 })),
        h(UL.ULLineChart, Object.assign({}, C, { title: 'Stale', data: d, x: (r) => r.x, series: S3, stale: 'Stale · 2 min', height: 160 })),
        h(UL.ULBarChart, Object.assign({}, C, { title: 'Table view', data: d, x: (r) => r.x, series: S3, defaultTable: true, height: 160 })),
        window.ULDemos.AdvGuardFixture ? h(window.ULDemos.AdvGuardFixture) : null,
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 12 } },
          h(UL.ULKpiCard, { variant: 'sparkline', label: 'Revenue', value: 1215, delta: 4.2, trend: h(UL.ULSparkChart, { data: d.map((r) => r.a), variant: 'area', height: 32 }) }),
          h(UL.ULKpiCard, { variant: 'sparkline', label: 'Day change', value: 12, trend: h(UL.ULSparkChart, { data: d.map((r, i) => (i % 2 ? 1 : -1) * r.b), variant: 'winloss', height: 32 }) })));
    }
    /** Runs the chart part of a guard card ('layout' | 'icons' | 'ctrl'); returns check rows. */
    async function chartGuard(kind) {
      const checks = [], c = ck(checks), size = innerWidth + '×' + innerHeight, D = window.ULDemos;
      const M = await mount(h(GuardFixture), Math.min(860, innerWidth - 16));
      try {
        await settle(900);
        // pinned tooltip near the right edge of the first chart
        const f0 = fig(M.box), p0 = plotOf(f0);
        ptr(p0, 'pointerenter', 0.97); ptr(p0, 'pointermove', 0.97); ptr(p0, 'click', 0.97); await settle(1200);
        const pinned = hoverOf(f0).hasAttribute('data-pinned');
        const figs = [...M.box.querySelectorAll('.ul-chart2')], panels = figs.map((f) => f.closest('.ul-chart2-panel') || f);
        if (kind === 'layout') {
          const bad = panels.map((n) => ({ t: n.querySelector('.ul-chart2-title')?.textContent.slice(0, 18), o: D.__layoutOverflow(n) })).filter((x) => x.o.px > 0.5);
          c('chart-panels', `charts: ${panels.length} panels (3A + 3B types, loading, empty, error, stale, table, 1000 points, zoom), nothing outside its panel (${size})`, !bad.length, bad.slice(0, 4).map((x) => `${x.t}: ${x.o.px}px ${x.o.who}`).join(' · ') || panels.length + ' ok');
          const tip = f0.querySelector('.ul-chart-tip-body'), tr = tip.getBoundingClientRect(), pr = p0.getBoundingClientRect();
          c('chart-tip', `pinned tooltip inside its plot and the viewport (${size})`, pinned && tr.left >= pr.left - 0.5 && tr.right <= pr.right + 0.5 && tr.top >= pr.top - 0.5 && tr.bottom <= pr.bottom + 0.5 && tr.right <= innerWidth, `${pinned ? 'pinned' : 'not pinned'} · tip ${Math.round(tr.left - pr.left)}…${Math.round(tr.right - pr.left)} of ${Math.round(pr.width)}`);
          const clipped = figs.flatMap((f) => [...f.querySelectorAll('.ul-chart-tick')].filter((t) => { const r = t.getBoundingClientRect(), q = plotOf(f).getBoundingClientRect(); return r.width && (r.left < q.left - 0.5 || r.right > q.right + 0.5); }).map((t) => t.textContent));
          c('chart-ticks', `axis labels not clipped by the plot (${size})`, !clipped.length, clipped.slice(0, 5).join(', ') || 'ok');
          const legends = [...M.box.querySelectorAll('.ul-chart-legend2')].filter((l) => l.scrollWidth > l.clientWidth + 0.5);
          c('chart-legend', `legends wrap inside the panel (${size})`, !legends.length, legends.length ? legends.map((l) => (l.closest('.ul-chart2')?.querySelector('.ul-chart2-title')?.textContent || '?') + ' ' + l.scrollWidth + '/' + l.clientWidth).join(' · ') : '0 overflowing');
        }
        if (kind === 'icons') { const a = D.__scanIcons(M.box); c('chart-icons', `chart svgs (toolbar, legend keys, check marks, tooltip keys, sparklines): explicit size (${size})`, !a.bad.length, a.bad.slice(0, 4).join(' · ') || a.n + ' svgs ok'); }
        if (kind === 'ctrl') { const a = D.__scanControls(M.box); c('chart-ctrl', `chart legend chips, toolbar buttons, stale badge, retry: one line, centred (${size})`, !a.bad.length, a.bad.slice(0, 4).join(' · ') || a.n + ' controls ok'); }
      } finally { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await M.done(); }
      return checks;
    }
    async function chartGuardAll() { const out = []; for (const k of ['layout', 'icons', 'ctrl']) out.push(...(await chartGuard(k))); return { size: innerWidth + '×' + innerHeight, checks: out, status: out.every((x) => x.pass !== false) ? 'pass' : 'fail' }; }

    /* ---------- card: View as table equals data ---------- */
    async function chartTableTest() {
      const checks = [], c = ck(checks), d = rows(12);
      const cart = [['line', UL.ULLineChart, {}], ['area', UL.ULAreaChart, { stack: 'stacked' }], ['bar', UL.ULBarChart, {}], ['hbar', UL.ULBarChart, { orientation: 'horizontal' }], ['combo', UL.ULComboChart, { series: [{ key: 'a', name: 'Alpha', type: 'bar', value: (r) => r.a }, { key: 'b', name: 'Beta', type: 'line', axis: 'right', value: (r) => r.b }, { key: 'c', name: 'Gamma', type: 'line', value: (r) => r.c }] }]];
      const M = await mount(h('div'), 720);
      const read = async () => { const f = fig(M.box); const btn = f.querySelector('.ul-chart2-tools [aria-pressed]'); btn.click(); await settle(150); const t = f.querySelector('.ul-chart2-table table'); const head = t ? [...t.querySelectorAll('thead th')].map((x) => x.textContent) : []; const body = t ? [...t.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((x) => x.textContent)) : []; return { head, body, pressed: btn.getAttribute('aria-pressed') }; };
      try {
        for (const [name, Comp, extra] of cart) {
          await M.set(h(Comp, Object.assign({ key: name, title: name, data: d, x: (r) => r.x, series: S3 }, extra)));
          await settle(200);
          const r = await read(), exp = d.map((row) => [row.x, fmt(row.a), fmt(row.b), fmt(row.c)]);
          const diff = exp.findIndex((e, i) => JSON.stringify(e) !== JSON.stringify(r.body[i]));
          c('table-' + name, `${name}: table rows = data (${exp.length} rows × 4, nulls as –), header = series names`, r.body.length === exp.length && diff < 0 && r.head.slice(1).join() === 'Alpha,Beta,Gamma' && r.pressed === 'true', diff < 0 ? `${r.body.length} rows ok` : `row ${diff}: ${JSON.stringify(r.body[diff])} ≠ ${JSON.stringify(exp[diff])}`);
        }
        for (const [name, Comp] of [['donut', UL.ULDonutChart], ['pie', UL.ULPieChart]]) {
          await M.set(h(Comp, { key: name, title: 'Payments', data: SHARES, label: (r) => r.k, value: (r) => r.v })); await settle(200);
          const r = await read(), tot = SHARES.reduce((a, s) => a + s.v, 0), exp = SHARES.map((s) => [s.k, fmt(s.v), pct.format(s.v / tot)]);
          const diff = exp.findIndex((e, i) => JSON.stringify(e) !== JSON.stringify(r.body[i]));
          c('table-' + name, `${name}: table rows = slices (label, value, share)`, r.body.length === exp.length && diff < 0, diff < 0 ? `${r.body.length} rows ok` : `row ${diff}: ${JSON.stringify(r.body[diff])} ≠ ${JSON.stringify(exp[diff])}`);
        }
        await M.set(h(UL.ULChart, { key: 'legacy', kind: 'bar', title: 'Legacy', labels: ['Mon', 'Tue', 'Wed'], series: [{ name: 'A', data: [4, 7, 5] }, { name: 'B', data: [3, 4, 6] }] })); await settle(200);
        const r = await read(); c('table-legacy', 'legacy ULChart: table rows = data', JSON.stringify(r.body) === JSON.stringify([['Mon', '4', '3'], ['Tue', '7', '4'], ['Wed', '5', '6']]), JSON.stringify(r.body));
      } finally { await M.done(); }
      return result(checks, 'frame-independent');
    }

    /* ---------- card: legend toggle (visible series + rescaled axes) ---------- */
    async function chartLegendTest() {
      const checks = [], c = ck(checks), d = rows(12);
      const M = await mount(h(UL.ULLineChart, { title: 'Legend', data: d, x: (r) => r.x, series: S3, height: 200 }), 720);
      const f = fig(M.box), lines = () => f.querySelectorAll('.ul-chart-ln').length, top = () => Math.max(...[...f.querySelectorAll('.ul-chart-tick:not(.ul-chart-cat)')].map((t) => parseFloat(t.textContent.replace(/[^\d.-]/g, '')) || 0));
      const until = async (fn, ms = 5000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await wait(50); } return fn(); };
      try {
        await settle(600);
        const top0 = top(), chip = f.querySelector('.ul-chart-lchip[data-key="a"]');
        chip.click(); const ok1 = await until(() => lines() === 2 && top() < 300);
        c('hide', 'hide Alpha: 2 visible lines, chip aria-pressed=false, value axis rescales (max ≈ 1000 → < 300)', ok1 && chip.getAttribute('aria-pressed') === 'false', `lines ${lines()} · axis max ${top0} → ${top()}`);
        chip.click(); const ok2 = await until(() => lines() === 3 && top() >= 900);
        c('show', 'show Alpha again: 3 lines, axis back', ok2 && chip.getAttribute('aria-pressed') === 'true', `lines ${lines()} · axis max ${top()}`);
        f.querySelector('.ul-chart-lchip[data-key="b"]').click(); await wait(30); f.querySelector('.ul-chart-lchip[data-key="c"]').click(); await until(() => lines() === 1);
        f.querySelector('.ul-chart-lchip[data-key="a"]').click(); await settle(100);
        c('last', 'the last visible series cannot be hidden', lines() >= 1 && f.querySelector('.ul-chart-lchip[data-key="a"]').getAttribute('aria-pressed') === 'true', lines() + ' line(s)');
      } finally { await M.done(); }
      return result(checks, 'frame-independent');
    }

    /* ---------- card: contextMenu targets ---------- */
    async function chartCtxTest() {
      const checks = [], c = ck(checks), got = [];
      const fire = (el, fx = 0.5, fy = 0.5) => { const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, button: 2 })); };
      const close = async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle(450); };
      const M = await mount(h(UL.ULLineChart, { title: 'Ctx', data: rows(12), x: (r) => r.x, series: S3, height: 200, contextMenu: () => [{ id: 'x', label: 'Filter' }], onContextMenuOpen: (t) => got.push(t) }), 720);
      const f = fig(M.box), pl = plotOf(f);
      try {
        pl.focus(); keyOn(pl, 'Home'); await settle(100); fire(pl, 0.1); await settle(300);
        const a = got[got.length - 1];
        c('point', 'data point: kind point, index 0, label Jan, 3 values', !!a && a.kind === 'point' && a.data.index === 0 && a.data.label === 'Jan' && a.data.values.length === 3 && a.component === 'chart', a ? JSON.stringify({ k: a.kind, i: a.data.index, l: a.data.label, n: (a.data.values || []).length }) : 'no menu');
        await close();
        const chip = f.querySelector('.ul-chart-lchip[data-key="b"]'); fire(chip); await settle(300);
        const b = got[got.length - 1];
        c('series', 'legend chip: kind series, series Beta', !!b && b !== a && b.kind === 'series' && b.data.series === 'Beta', b ? JSON.stringify({ k: b.kind, s: b.data.series }) : 'no menu');
        await close();
        pl.focus(); keyOn(pl, 'Escape'); pl.blur(); await settle(100); fire(pl, 0.5, 0.5); await settle(300);
        const p = got[got.length - 1];
        c('plot', 'plot background (no point under focus / pointer): kind plot', !!p && p !== b && p.kind === 'plot', p ? p.kind : 'no menu');
        await close();
      } finally { await M.done(); }
      return result(checks, 'frame-independent');
    }

    /* ---------- card: keyboard, live region, pin / Esc ---------- */
    async function chartKeysTest() {
      const checks = [], c = ck(checks);
      const M = await mount(h(UL.ULLineChart, { title: 'Keys', data: rows(12), x: (r) => r.x, series: S3, height: 200 }), 720);
      const f = fig(M.box), pl = plotOf(f), hv = hoverOf(f), seq = [];
      const press = async (k) => { keyOn(pl, k); await raf(); await wait(20); seq.push(k + ' → ' + live(f)); return live(f); };
      try {
        pl.focus();
        const l1 = await press('Home'), l2 = await press('ArrowRight'), l3 = await press('ArrowDown'), l4 = await press('ArrowDown'), l5 = await press('ArrowUp'), l6 = await press('ArrowUp'), l7 = await press('End'), l8 = await press('ArrowRight'), l9 = await press('ArrowLeft');
        c('order', 'Home → Jan, → Feb, End → Dec, → at the end stays Dec, ← Nov', /^Jan:/.test(l1) && /^Feb:/.test(l2) && /^Dec:/.test(l7) && /^Dec:/.test(l8) && /^Nov:/.test(l9), [l1, l2, l7, l8, l9].map((x) => x.split(':')[0]).join(' · '));
        c('series', '↓ walks series (Alpha only, then Beta only), ↑↑ back to all series', /Alpha/.test(l3) && !/Beta/.test(l3) && /Beta/.test(l4) && !/Alpha/.test(l4) && /Alpha/.test(l6) && /Beta/.test(l6) && /Gamma/.test(l6), [l3, l4, l6].join(' | '));
        c('live', 'polite live region reads "label: series value, …"', /^Feb: Alpha [\d,]+, Beta \d+, Gamma [\d,–]+$/.test(l2) && f.querySelector('[aria-live="polite"]').getAttribute('aria-atomic') === 'true', l2);
        await press('Enter'); const pinnedK = hv.hasAttribute('data-pinned') && /pinned/.test(live(f));
        c('enter', 'Enter pins (data-pinned, live text says pinned)', pinnedK, live(f));
        await press('Escape'); c('esc', 'Esc unpins and hides the tooltip', !hv.hasAttribute('data-pinned') && !hv.hasAttribute('data-on'), hv.getAttribute('data-on') == null ? 'hidden' : 'still shown');
        pl.blur(); ptr(pl, 'pointerenter', 0.3); ptr(pl, 'pointermove', 0.3); await raf(); ptr(pl, 'click', 0.3); await raf(); await wait(30);
        const pinnedC = hv.hasAttribute('data-pinned') && hv.hasAttribute('data-on');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await raf();
        c('click', 'click pins, document Esc unpins', pinnedC && !hv.hasAttribute('data-pinned'), `pinned ${pinnedC} · after Esc ${hv.hasAttribute('data-pinned')}`);
        c('nav-hint', 'plot is a focusable group with a keyboard hint (aria-describedby)', pl.tabIndex === 0 && pl.getAttribute('role') === 'group' && !!document.getElementById(pl.getAttribute('aria-describedby')), pl.getAttribute('aria-roledescription'));
      } finally { await M.done(); }
      return result(checks, 'frame-independent');
    }

    /* ---------- card: reduced motion ---------- */
    const anims = (el) => (el ? el.getAnimations({ subtree: true }) : []);
    const onlyOpacity = (a) => a.effect && a.effect.getKeyframes().every((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)).every((p) => p === 'opacity'));
    async function chartReducedTest() {
      const checks = [], c = ck(checks);
      UL.configureMorph({ reducedMotion: 'reduce' });
      let M;
      try {
        M = await mount(h(UL.ULLineChart, { title: 'Reduced', data: rows(12), x: (r) => r.x, series: S3, height: 200 }), 720);
        await wait(10);
        const f = fig(M.box), svg = f.querySelector('svg.ul-chart2-svg');
        const m0 = stats().morphs, a = [], orig = Element.prototype.animate;
        // spy on Element.animate (records every animation started, independent of how long it runs or the frame rate)
        Element.prototype.animate = function (kf, o) { const an = orig.call(this, kf, o); if (svg.contains(this) || this === svg) a.push(an); return an; };
        try { await M.set(h(UL.ULLineChart, { title: 'Reduced', data: rows(12, 300), x: (r) => r.x, series: S3, height: 200 })); await wait(50); } finally { Element.prototype.animate = orig; }
        const durs = a.map((x) => x.effect.getTiming().duration);
        c('change', 'data change: no morph (0 tween starts), a short opacity fade only (≤ 200ms)', stats().morphs === m0 && a.length >= 1 && a.every(onlyOpacity) && durs.every((d) => d <= 200), `tweens +${stats().morphs - m0} · ${a.length} anim(s) ${durs.join('/')}ms opacity-only ${a.every(onlyOpacity)}`);
        await M.done();
        const all = [], orig2 = Element.prototype.animate;
        Element.prototype.animate = function (kf, o) { const an = orig2.call(this, kf, o); all.push(an); return an; };
        try { M = await mount(h(UL.ULDonutChart, { title: 'Reduced donut', data: SHARES, label: (r) => r.k, value: (r) => r.v }), 600); } finally { Element.prototype.animate = orig2; }
        c('drawin', 'mount: no draw-in (no dash / clip / sweep animation), at most a fade', all.every(onlyOpacity), all.length + ' anim(s), opacity-only ' + all.every(onlyOpacity));
      } finally { if (M) await M.done(); UL.configureMorph({ reducedMotion: 'auto' }); }
      return result(checks, 'frame-independent');
    }

    /* ---------- card: identical data = no animation; change = one morph; interrupt = no jump ---------- */
    async function chartMorphTest() {
      const checks = [], c = ck(checks);
      UL.configureMorph({ reducedMotion: 'no-preference', timeScale: 4 });
      const mk = (k) => h(UL.ULLineChart, { title: 'Morph', data: rows(12, k), x: (r) => r.x, series: S3.map((s) => Object.assign({}, s)), height: 200 });
      const M = await mount(mk(0), 720);
      const svg = fig(M.box).querySelector('svg.ul-chart2-svg');
      try {
        for (let i = 0; i < 100 && anims(svg).length; i++) await wait(50);
        const m0 = stats().morphs;
        await M.set(mk(0)); await wait(120);
        c('identical', 're-render with identical data (new arrays / series objects): 0 running animations, 0 tween starts', anims(svg).length === 0 && stats().morphs === m0, `${anims(svg).length} anims · +${stats().morphs - m0} tweens`);
        await M.set(mk(400)); await wait(10);
        const e1 = stats().log[stats().log.length - 1];
        c('one', 'dataset change starts exactly one morph', stats().morphs === m0 + 1 && e1 && e1.to === rows(1, 400)[0].a, `+${stats().morphs - m0} · ${e1 ? e1.from + ' → ' + e1.to : ''}`);
        await wait(250);
        const before = stats().last;
        await M.set(mk(-300)); await wait(10);
        const e2 = stats().log[stats().log.length - 1];
        const between = (v, a, b) => v >= Math.min(a, b) - 1e-6 && v <= Math.max(a, b) + 1e-6;
        const okFrom = e2 && between(e2.from, e1.from, e1.to) && e2.from !== e1.to && Math.abs(e2.from - before) <= Math.abs(e1.to - e1.from) * 0.3;
        const okFirst = e2 && e2.first != null && between(e2.first, e2.from, e2.to);
        c('interrupt', 'second change mid-morph restarts from the current interpolated value (no jump): from ∈ (start, target₁), first frame ∈ [from, target₂]', stats().morphs === m0 + 2 && okFrom && okFirst, e2 ? `painted ${before?.toFixed(1)} · restart from ${e2.from?.toFixed(1)} · first ${e2.first?.toFixed(1)} → ${e2.to}` : 'no restart');
        for (let i = 0; i < 120 && stats().last !== e2.to; i++) await wait(50);
        c('settle', 'ends exactly on the new data', stats().last === e2.to, `${stats().last} = ${e2.to}`);
      } finally { UL.configureMorph({ reducedMotion: 'auto', timeScale: 1 }); await M.done(); }
      return result(checks, 'frame-independent (values, not frames)');
    }

    /* ---------- card: 10 / 100 / 1000 points ---------- */
    async function chartSizesTest() {
      const checks = [], c = ck(checks), D = window.ULDemos;
      const M = await mount(h('div'), Math.min(860, innerWidth - 16));
      try {
        for (const n of [10, 100, 1000]) for (const [k, Comp] of [['line', UL.ULLineChart], ['area', UL.ULAreaChart], ['bar', UL.ULBarChart]]) {
          await M.set(h(Comp, { key: k + n, title: `${k} ${n}`, data: rows(n), x: (r) => r.x, series: S3.slice(0, 2), height: 180 })); await settle(150);
          const f = fig(M.box), panel = f.closest('.ul-chart2-panel') || f, o = D.__layoutOverflow(panel), svg = f.querySelector('svg.ul-chart2-svg'), pl = plotOf(f);
          const cats = f.querySelectorAll('.ul-chart-cat').length;
          c(`${k}-${n}`, `${k} · ${n} points: no overflow, svg ≤ plot width, category labels thinned (≤ plot / 40px)`, o.px <= 0.5 && svg.getBoundingClientRect().width <= pl.clientWidth + 0.5 && cats <= pl.clientWidth / 40, `${o.px}px ${o.who} · ${cats} labels`);
        }
      } finally { await M.done(); }
      return result(checks, 'frame-independent');
    }

    /* ---------- frame-dependent ---------- */
    const NEEDS = (checks, f) => ({ status: 'n/a', checks: checks.concat([{ key: 'preview', label: 'NEEDS HEALTHY PREVIEW (≥ 50 fps, focused tab)', pass: null, value: f.toFixed(0) + ' fps measured' }]), driver: 'live rAF' });
    async function chartTipTest() {
      const checks = [], c = ck(checks), f0 = await fps();
      if (f0 < 50) return NEEDS(checks, f0);
      const M = await mount(h(UL.ULLineChart, { title: 'Tip', data: rows(100), x: (r) => r.x, series: S3, height: 220 }), 760);
      const f = fig(M.box), pl = plotOf(f), hv = hoverOf(f);
      try {
        await settle(1200);
        let writes = []; const mo = new MutationObserver((ms) => ms.forEach((m) => writes.push(m.target)));
        mo.observe(hv, { attributes: true, attributeFilter: ['style'], subtree: false });
        ptr(pl, 'pointerenter', 0.1); let worst = 0, lag = 0, moves = 0, prevX = null;
        for (let i = 0; i < 90; i++) {
          writes = []; ptr(pl, 'pointermove', 0.1 + i * 0.009); await raf(); await new Promise((r) => setTimeout(r, 0));
          moves++; worst = Math.max(worst, new Set(writes).size);
          const x = parseFloat((hv.style.transform.match(/translate3d\(([-\d.]+)/) || [])[1]);
          const expIdx = Math.round(((0.1 + i * 0.009) * pl.clientWidth - 0) / pl.clientWidth * 99);
          if (prevX != null && writes.length === 0 && Math.abs(x - prevX) > 0 && i) lag++;
          prevX = x; void expIdx;
        }
        mo.disconnect();
        c('one-write', 'positioner: at most one style write per pointer move', worst <= 1, `max ${worst} write(s) / move over ${moves} moves`);
        c('same-frame', 'tooltip position updated in the frame of the move (no lag frames)', lag === 0, lag + ' lagging frames');
      } finally { await M.done(); }
      return result(checks);
    }
    async function chartDrawTest() {
      const checks = [], c = ck(checks), f0 = await fps();
      if (f0 < 50) return NEEDS(checks, f0);
      UL.configureMorph({ reducedMotion: 'no-preference' });
      const host = document.createElement('div'); host.setAttribute('data-ul-theme', 'app'); host.style.cssText = 'position:fixed;left:8px;top:8px;width:720px;z-index:900'; document.body.appendChild(host);
      const root = window.ReactDOM.createRoot(host); root.render(h(UL.ULLineChart, { title: 'Draw', data: rows(12), x: (r) => r.x, series: S3.slice(0, 1), height: 200 }));
      const vals = [];
      try {
        for (let i = 0; i < 90; i++) { await raf(); const p = host.querySelector('.ul-chart-ln:not([data-dash])'); if (!p) continue; const da = getComputedStyle(p).strokeDasharray.split(/[ ,]+/).map(parseFloat); vals.push(da.length > 1 ? da[0] : 1); }
        const drops = vals.filter((v, i) => i && v < vals[i - 1] - 1e-3).length;
        c('monotonic', 'line draw-in progress never goes backwards (per frame)', drops === 0 && vals.length > 20, `${vals.length} frames · ${drops} drops · end ${vals[vals.length - 1]}`);
      } finally { root.unmount(); host.remove(); UL.configureMorph({ reducedMotion: 'auto' }); }
      return result(checks);
    }
    async function chartPerfTest() {
      const checks = [], c = ck(checks), f0 = await fps();
      if (f0 < 50) return NEEDS(checks, f0);
      const tRows = Array.from({ length: 200 }, (_, i) => ({ id: 'r' + i, name: 'Customer ' + i, v: (i * 37) % 1000 }));
      const M = await mount(h(React.Fragment, null,
        h(UL.ULLineChart, { title: 'A', data: rows(100), x: (r) => r.x, series: S3, height: 160 }), h(UL.ULAreaChart, { title: 'B', data: rows(100), x: (r) => r.x, series: S3, stack: 'stacked', height: 160 }),
        h(UL.ULBarChart, { title: 'C', data: rows(12), x: (r) => r.x, series: S3, height: 160 }), h(UL.ULDonutChart, { title: 'D', data: SHARES, label: (r) => r.k, value: (r) => r.v, height: 160 }),
        h(UL.ULTable, { label: 'Rows', rowKey: (r) => r.id, rows: tRows, columns: [{ key: 'name', header: 'Name' }, { key: 'v', header: 'Value', align: 'end' }] })), 900);
      try {
        await settle(1500);
        const pl = plotOf(fig(M.box)); ptr(pl, 'pointerenter', 0.1);
        let n = 0; const t0 = performance.now();
        while (performance.now() - t0 < 2000) { ptr(pl, 'pointermove', 0.1 + ((n % 80) / 100)); await raf(); n++; }
        const f = (n * 1000) / (performance.now() - t0);
        { const R = await refresh(); c('fps', `4 charts + 200-row table, pointer moving: ≥ 0.9 × refresh (${R.hz.toFixed(0)} Hz → ≥ ${R.fpsTarget.toFixed(0)} fps)`, f >= R.fpsTarget, f.toFixed(0) + ' fps'); }
      } finally { await M.done(); }
      return result(checks);
    }

    window.ULDemos = Object.assign(window.ULDemos || {}, { __chartGuard: chartGuard, chartGuardAll, chartTableTest, chartLegendTest, chartCtxTest, chartKeysTest, chartReducedTest, chartMorphTest, chartSizesTest, chartTipTest, chartDrawTest, chartPerfTest });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
