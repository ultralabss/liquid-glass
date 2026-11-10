// Task 3B advanced chart test cards + guard fixture part. motion-test ?norun&card=<id> and probe-charts ?cards=<id>.
// Frame-independent checks always PASS / FAIL; frame-dependent cards return 'n/a' (NEEDS HEALTHY PREVIEW) below 50 fps.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const settle = async (ms = 400) => { await wait(ms); await raf(); await raf(); };
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value: String(value) });
    const result = (checks, driver = 'frame-independent') => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver });
    const refresh = () => (window.__ulRefreshP = window.__ulRefreshP || new Promise((res) => { const ts = []; const st = (t) => { ts.push(t); if (ts.length < 61) requestAnimationFrame(st); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b), p = d[30]; res({ period: p, hz: 1000 / p, p95Limit: 1.15 * p, fpsTarget: 0.9 * 1000 / p, healthy: 1000 / p >= 50 }); } }; requestAnimationFrame(st); })); // shared: limits relative to the measured display refresh (p95 ≤ 1.15 × period, fps ≥ 0.9 × rate)
    const fps = async (ms = 600) => { let n = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { await raf(); n++; } return (n * 1000) / (performance.now() - t0); };
    async function mount(el, w = 760) {
      const host = document.createElement('div'); host.setAttribute('data-ul-theme', 'app'); host.setAttribute('data-ul-accent', 'violet'); host.setAttribute('data-chart-fixture', '');
      host.style.cssText = `position:fixed;left:8px;top:8px;z-index:900;width:${Math.min(w, innerWidth - 16)}px;max-height:${innerHeight - 16}px;overflow:auto;padding:12px;box-sizing:border-box;background:#0b0d12;display:flex;flex-direction:column;gap:12px;border-radius:12px`;
      document.body.appendChild(host);
      const root = window.ReactDOM.createRoot(host); root.render(el); await settle(600);
      return { box: host, render: async (e) => { root.render(e); await settle(200); }, done: async () => { root.unmount(); host.remove(); await raf(); } };
    }
    const key = (el, k, o = {}) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));
    const at = (el, type, fx, fy, o = {}) => { const r = el.getBoundingClientRect(); const e = Object.assign({ bubbles: true, cancelable: true, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, pointerType: 'mouse', pointerId: 7, button: 0 }, o); el.dispatchEvent(type === 'click' || type === 'contextmenu' || type === 'dblclick' ? new MouseEvent(type, e) : new PointerEvent(type, e)); };
    const liveOf = (f) => (f.querySelector('.ul-chart2 > [aria-live="polite"]') || {}).textContent || '';
    const tipText = (f) => { const t = f.querySelector('.ul-chart-tip-body'); return t ? t.textContent : ''; };
    const nf = new Intl.NumberFormat('en-GB'), F = (v) => (v == null ? '–' : nf.format(v)), P = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 }), P0 = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 0 });

    /* ---------- fixtures (deterministic) ---------- */
    const RINGS = [{ k: 'Verified', v: 82 }, { k: 'Documents', v: 61 }, { k: 'Liveness', v: 44 }];
    const RADAR = ['Document verification accuracy', 'Speed', 'Liveness', 'Coverage', 'Price', 'Support'].map((a, i) => ({ a, x: 40 + i * 9, y: 90 - i * 8 }));
    const SC = Array.from({ length: 60 }, (_, i) => ({ g: ['Web', 'iOS', 'Android'][i % 3], x: (i * 37) % 400, y: 50 + ((i * 53) % 300), s: 10 + (i % 7) * 20 }));
    const HEAT = []; ['Mon', 'Tue', 'Wed'].forEach((r, a) => ['00', '06', '12', '18'].forEach((c, b) => HEAT.push({ r, c, v: a === 2 && b === 0 ? null : (a + 1) * 10 + b * 5 })));
    const CAL = Array.from({ length: 40 }, (_, i) => ({ t: new Date(Date.UTC(2026, 4, 4) + i * 864e5), v: (i * 7) % 50 }));
    const FUN = [{ k: 'Started', v: 1000 }, { k: 'Uploaded', v: 800 }, { k: 'Liveness', v: 600 }, { k: 'Approved', v: 540 }];
    const LAT = Array.from({ length: 500 }, (_, i) => 100 + ((i * 7919) % 400));
    const TREE = { name: 'All', children: [{ name: 'Identity', children: [{ name: 'Docs', value: 40 }, { name: 'Liveness', value: 20 }] }, { name: 'Studio', value: 30 }, { name: 'Wallet', value: 10 }] };
    const C = { locale: 'en', toolbar: true };
    const types = (extra = {}) => [
      ['radial', h(UL.ULRadialChart, Object.assign({}, C, extra, { title: 'Radial', data: RINGS, label: (d) => d.k, value: (d) => d.v }))],
      ['gauge', h(UL.ULGaugeChart, Object.assign({}, C, extra, { title: 'Gauge', value: 320, max: 600, thresholds: [{ to: 250, tone: 'success', label: 'Healthy' }, { to: 450, tone: 'warning', label: 'Degraded' }, { to: 600, tone: 'danger', label: 'Critical' }], target: 300, compare: { value: 260, label: 'Last week' } }))],
      ['radar', h(UL.ULRadarChart, Object.assign({}, C, extra, { title: 'Radar', data: RADAR, axis: (d) => d.a, series: [{ key: 'x', name: 'A', value: (d) => d.x }, { key: 'y', name: 'B', value: (d) => d.y }] }))],
      ['scatter', h(UL.ULScatterChart, Object.assign({}, C, extra, { title: 'Scatter', data: SC, x: (d) => d.x, y: (d) => d.y, size: (d) => d.s, group: (d) => d.g, trend: true }))],
      ['heatmap', h(UL.ULHeatmapChart, Object.assign({}, C, extra, { title: 'Heatmap', data: HEAT, row: (d) => d.r, col: (d) => d.c, value: (d) => d.v }))],
      ['calendar', h(UL.ULCalendarHeatmap, Object.assign({}, C, extra, { title: 'Calendar', data: CAL, date: (d) => d.t, value: (d) => d.v }))],
      ['funnel', h(UL.ULFunnelChart, Object.assign({}, C, extra, { title: 'Funnel', data: FUN, label: (d) => d.k, value: (d) => d.v }))],
      ['histogram', h(UL.ULHistogramChart, Object.assign({}, C, extra, { title: 'Histogram', values: LAT, bins: 10, percentiles: [50, 95, 99] }))],
      ['treemap', h(UL.ULTreemapChart, Object.assign({}, C, extra, { title: 'Treemap', data: TREE }))],
    ];
    const tableOf = (f) => [...f.querySelectorAll('.ul-chart2-table tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));

    /* ---------- guard fixture part (used by demos-3b chartGuard) ---------- */
    function AdvGuardFixture() {
      const menu = () => [{ id: 'x', label: 'X' }];
      return h(React.Fragment, null, ...types({ contextMenu: menu }).map(([k, el]) => h(React.Fragment, { key: k }, el)),
        h(UL.ULRadialChart, Object.assign({}, C, { key: 'ld', title: 'Radial loading', data: RINGS, label: (d) => d.k, value: (d) => d.v, state: 'loading' })),
        h(UL.ULHeatmapChart, Object.assign({}, C, { key: 'em', title: 'Heatmap empty', data: [], row: (d) => d.r, col: (d) => d.c, value: (d) => d.v })),
        h(UL.ULScatterChart, Object.assign({}, C, { key: 'er', title: 'Scatter error', data: SC, x: (d) => d.x, y: (d) => d.y, state: 'error', onRetry: () => wait(50) })),
        h(UL.ULFunnelChart, Object.assign({}, C, { key: 'st', title: 'Funnel stale', data: FUN, label: (d) => d.k, value: (d) => d.v, stale: 'Stale · 2 min' })),
        h(UL.ULTreemapChart, Object.assign({}, C, { key: 'tt', title: 'Treemap table', data: TREE, defaultTable: true })),
        h(UL.ULLineChart, Object.assign({}, C, { key: 'zm', title: 'Zoom + overview', data: Array.from({ length: 200 }, (_, i) => ({ t: new Date(Date.UTC(2026, 0, 1) + i * 36e5), v: 100 + Math.sin(i / 9) * 30 })), x: (d) => d.t, xScale: 'time', series: [{ key: 'v', name: 'V', value: (d) => d.v }], zoom: { overview: true }, range: { from: Date.UTC(2026, 0, 3), to: Date.UTC(2026, 0, 6) } })));
    }

    /* ---------- card: table view equals data for every new type ---------- */
    async function advTableTest() {
      const checks = [], c = ck(checks);
      const exp = {
        radial: RINGS.map((r) => [r.k, F(r.v), '100', P0.format(r.v / 100)]),
        radar: RADAR.map((r) => [r.a, F(r.x), F(r.y)]),
        funnel: FUN.map((s, i) => [s.k, F(s.v), P.format(s.v / 1000), i ? P.format(1 - s.v / FUN[i - 1].v) : '–']),
        heatmap: ['Mon', 'Tue', 'Wed'].map((r) => [r, ...['00', '06', '12', '18'].map((cc) => { const x = HEAT.find((q) => q.r === r && q.c === cc); return F(x.v); })]),
      };
      for (const [k, el] of types({ defaultTable: true })) {
        const M = await mount(el, 640);
        try {
          const f = M.box.querySelector('.ul-chart2'), rows = tableOf(f);
          if (exp[k]) { const e = exp[k], ok = e.length === rows.length && e.every((r, i) => r.every((v, j) => (k === 'radial' && j === 3 ? rows[i][j].replace('.0', '') === v.replace('.0', '') : rows[i][j] === v))); c('t-' + k, `${k}: table rows = data`, ok, ok ? rows.length + ' rows ok' : JSON.stringify(rows.slice(0, 2)) + ' vs ' + JSON.stringify(e.slice(0, 2))); }
          else if (k === 'gauge') { const ok = rows[0] && rows[0][1] === '320' && rows.some((r) => r[1] === '300') && rows.length === 8; c('t-gauge', 'gauge: value, min, max, target, comparison, 3 bands', ok, rows.length + ' rows · ' + (rows[0] || []).join('|')); }
          else if (k === 'scatter') { const ok = rows.length === SC.length && rows.every((r, i) => r[0] === SC[i].g && r[1] === F(SC[i].x) && r[2] === F(SC[i].y) && r[3] === F(SC[i].s)); c('t-scatter', 'scatter: one row per point (series, x, y, size)', ok, rows.length + ' rows'); }
          else if (k === 'calendar') { const ok = rows.length === 40 && rows.every((r, i) => r[1] === F(CAL[i].v)); c('t-cal', 'calendar: one row per day, value', ok, rows.length + ' rows'); }
          else if (k === 'histogram') { const b = UL.binValues(LAT, 10), ok = rows.length === b.counts.length && rows.every((r, i) => +r[1].replace(/,/g, '') === b.counts[i]) && b.counts.reduce((a, x) => a + x, 0) === LAT.length; c('t-hist', 'histogram: rows = bins, counts sum to n', ok, rows.length + ' bins · Σ ' + b.counts.reduce((a, x) => a + x, 0)); }
          else if (k === 'treemap') { const ok = rows.length === 3 && rows[0][0] === 'Identity' && rows[0][1] === '60'; c('t-tree', 'treemap: rows = tiles of the current level, sums of children', ok, rows.map((r) => r[0] + '=' + r[1]).join(', ')); }
        } finally { await M.done(); }
      }
      return result(checks);
    }

    /* ---------- card: contextMenu target payload for each type ---------- */
    async function advCtxTest() {
      const checks = [], c = ck(checks); let got = null;
      const spec = (t) => { got = t; return [{ id: 'x', label: 'X' }]; };
      const plan = { radial: ['.ul-radial-arc', 'point'], gauge: ['.ul-gauge-band', 'band'], radar: [null, 'point', 0.62, 0.3], scatter: [null, 'point'], heatmap: ['.ul-heat-cell', 'cell'], calendar: ['.ul-heat-cell', 'cell'], funnel: ['.ul-funnel-bar', 'step'], histogram: ['.ul-hist-bar', 'bar'], treemap: ['.ul-tm-rect', 'segment'] };
      for (const [k, el] of types({ contextMenu: spec })) {
        const M = await mount(el, 640);
        try {
          const f = M.box.querySelector('.ul-chart2'), pl = f.querySelector('.ul-chart2-plot'); got = null;
          const [sel, kind, fx = 0.5, fy = 0.5] = plan[k];
          let target = sel ? f.querySelector(sel) : pl;
          if (k === 'scatter') { const pt = f.querySelector('.ul-scatter-pt'); const r = pt.getBoundingClientRect(), pr = pl.getBoundingClientRect(); at(pl, 'pointermove', (r.left + r.width / 2 - pr.left) / pr.width, (r.top + r.height / 2 - pr.top) / pr.height); target = pl; await raf(); at(pl, 'contextmenu', (r.left + r.width / 2 - pr.left) / pr.width, (r.top + r.height / 2 - pr.top) / pr.height, { button: 2 }); }
          else { if (!sel) at(pl, 'pointermove', fx, fy); await raf(); at(target, 'contextmenu', 0.5, 0.5, { button: 2 }); }
          await settle(250);
          const a = got && got.kind === kind && got.component === 'chart' && got.data;
          got = null; const chip = f.querySelector('.ul-chart-lchip'); if (chip && k !== 'histogram') { at(chip, 'contextmenu', 0.5, 0.5, { button: 2 }); await settle(150); }
          const s = !chip || k === 'histogram' || (got && got.kind === 'series');
          got = null; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle(120);
          c('x-' + k, `${k}: ${kind} payload (+ series chip where there is a legend)`, !!a && s, a ? JSON.stringify(a).slice(0, 70) : 'no payload');
        } finally { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await M.done(); }
      }
      return result(checks);
    }

    /* ---------- card: keyboard + live region ---------- */
    async function advKeysTest() {
      const checks = [], c = ck(checks);
      for (const [k, el] of types()) {
        const M = await mount(el, 640);
        try {
          const f = M.box.querySelector('.ul-chart2'), pl = f.querySelector('.ul-chart2-plot');
          pl.focus(); key(pl, 'Home'); await raf(); const a = liveOf(f);
          key(pl, k === 'heatmap' ? 'ArrowDown' : 'ArrowRight'); await raf(); const b = liveOf(f);
          key(pl, 'Enter'); await raf(); const pinned = !!f.querySelector('.ul-chart-hover[data-pinned]');
          key(pl, 'Escape'); await raf(); const un = !f.querySelector('.ul-chart-hover[data-pinned]') && !f.querySelector('.ul-chart-hover[data-on]');
          let extra = true, ev = '';
          if (k === 'heatmap') { extra = /Tue · 00/.test(b); ev = ' · ↓ = next row'; }
          if (k === 'calendar') { extra = b !== a && /:/.test(b); ev = ' · → = next week'; }
          if (k === 'radar') { key(pl, 'Home'); key(pl, 'ArrowDown'); await raf(); extra = /Document verification accuracy, A: /.test(liveOf(f)); ev = ' · ↓ = series'; key(pl, 'Escape'); }
          if (k === 'treemap') { key(pl, 'Home'); key(pl, 'Enter'); await settle(150); const t = tableOf(f); extra = !!f.querySelector('.ul-crumbs') && /Identity|Docs/.test(f.textContent); key(f.querySelector('.ul-chart2-plot'), 'Backspace'); await settle(120); ev = ' · Enter drills, Backspace up'; void t; }
          c('k-' + k, `${k}: Home / arrow move + polite text, Enter pin, Esc unpin${ev}`, !!a && !!b && a !== b && pinned && un && extra, `${a.slice(0, 32)} → ${b.slice(0, 32)}`);
        } finally { await M.done(); }
      }
      return result(checks);
    }

    /* ---------- card: quadtree nearest point = brute force ---------- */
    async function quadtreeTest() {
      const checks = [], c = ck(checks); let s = 7; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const N = 3000, xs = Float64Array.from({ length: N }, () => r() * 800), ys = Float64Array.from({ length: N }, () => r() * 400);
      for (let k = 0; k < 40; k++) { xs[k * 3] = 100; ys[k * 3] = 100; } // duplicates
      const qt = UL.buildQuadtree(xs, ys); let bad = 0, worst = '';
      for (let q = 0; q < 1000; q++) { const x = r() * 820 - 10, y = r() * 420 - 10, a = qt.nearest(x, y), b = UL.nearestBrute(xs, ys, x, y); const da = (xs[a] - x) ** 2 + (ys[a] - y) ** 2, db = (xs[b] - x) ** 2 + (ys[b] - y) ** 2; if (Math.abs(da - db) > 1e-9) { bad++; worst = `${a} vs ${b}`; } }
      c('qt-near', '1000 random queries over 3000 points (with duplicates): nearest = brute force', bad === 0, bad ? bad + ' wrong · ' + worst : 'all equal');
      const w = qt.within(200, 50, 420, 260), wb = []; for (let i = 0; i < N; i++) if (xs[i] >= 200 && xs[i] <= 420 && ys[i] >= 50 && ys[i] <= 260) wb.push(i);
      c('qt-within', 'rect query = brute force (brush selection)', w.length === wb.length && w.every((v, i) => v === wb[i]), w.length + ' points');
      c('qt-max', 'nearest with maxDist returns -1 outside the radius', qt.nearest(5000, 5000, 30) === -1, String(qt.nearest(5000, 5000, 30)));
      return result(checks);
    }

    /* ---------- card: LTTB ---------- */
    async function lttbTest() {
      const checks = [], c = ck(checks);
      const n = 20000, xs = Array.from({ length: n }, (_, i) => i), ys = xs.map((i) => Math.sin(i / 300) * 50 + (i === 12345 ? 400 : 0) - (i === 4321 ? 380 : 0));
      const out = UL.lttb(xs, ys, 800); let mn = 0, mx = 0; ys.forEach((v, i) => { if (v < ys[mn]) mn = i; if (v > ys[mx]) mx = i; });
      c('lttb-len', 'output length = threshold (800 of 20 000)', out.length === 800, out.length);
      c('lttb-ends', 'first and last points kept, indices sorted', out[0] === 0 && out[out.length - 1] === n - 1 && out.every((v, i) => !i || v > out[i - 1]), `${out[0]} … ${out[out.length - 1]}`);
      c('lttb-ext', 'global min and max kept', out.includes(mn) && out.includes(mx), `min ${mn} ${out.includes(mn)} · max ${mx} ${out.includes(mx)}`);
      const small = UL.lttb([0, 1, 2], [1, 2, 3], 800); c('lttb-small', 'n ≤ threshold returns every index', small.length === 3, small.join(','));
      const t0 = performance.now(); for (let k = 0; k < 10; k++) UL.lttb(xs, ys, 800); c('lttb-cost', '20 000 → 800 cost per call', (performance.now() - t0) / 10 < 30, ((performance.now() - t0) / 10).toFixed(2) + ' ms');
      return result(checks);
    }

    /* ---------- card: canvas fallback at the threshold, identical tooltip ---------- */
    async function canvasTest() {
      const checks = [], c = ck(checks), at0 = UL.canvasThreshold();
      const mk = (n) => Array.from({ length: n }, (_, i) => ({ t: new Date(Date.UTC(2026, 0, 1) + i * 6e4), v: 100 + Math.sin(i / 50) * 20 }));
      const chart = (n) => h(UL.ULLineChart, { locale: 'en', title: 'C' + n, data: mk(n), x: (d) => d.t, xScale: 'time', series: [{ key: 'v', name: 'V', value: (d) => d.v }], height: 180 });
      const M = await mount(chart(at0 - 1), 700);
      try {
        const f = () => M.box.querySelector('.ul-chart2'), pl = () => f().querySelector('.ul-chart2-plot');
        const svgMode = !pl().hasAttribute('data-canvas'); pl().focus(); key(pl(), 'Home'); key(pl(), 'ArrowRight'); await raf(); const t1 = tipText(f());
        await M.render(chart(at0 + 1)); await settle(300);
        const cvMode = pl().hasAttribute('data-canvas') && !!pl().querySelector('canvas'); pl().focus(); key(pl(), 'Home'); key(pl(), 'ArrowRight'); await raf(); const t2 = tipText(f());
        c('cv-switch', `threshold ${at0}: ${at0 - 1} points → SVG, ${at0 + 1} → canvas`, svgMode && cvMode, `${svgMode ? 'svg' : 'canvas'} → ${cvMode ? 'canvas' : 'svg'}`);
        c('cv-tip', 'same tooltip content for the same point (keyboard Home → →)', !!t1 && t1 === t2, `${t1.slice(0, 40)} | ${t2.slice(0, 40)}`);
        const paths = pl().querySelectorAll('.ul-chart-ln').length; c('cv-nosvg', 'canvas mode draws no SVG line paths (hidden layer, hover beads stay HTML)', getComputedStyle(pl().querySelector('.ul-chart-lines')).display === 'none', paths + ' path nodes hidden');
      } finally { await M.done(); }
      return result(checks);
    }


    /* ---------- card: scatter canvas renderer = SVG (tooltip, keys, brush, ctx, table), 10k / 50k no overflow ---------- */
    async function scatterCanvasTest() {
      const checks = [], c = ck(checks), at0 = UL.canvasThreshold(); let s = 11; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const mk = (n) => { s = 11; return Array.from({ length: n }, (_, i) => ({ g: ['Web', 'iOS', 'Android'][i % 3], x: Math.round(r() * 4000) / 10, y: Math.round(r() * 3000) / 10 })); };
      let sel = null, got = null; const data = mk(at0 + 1), dataLo = mk(at0 - 1);
      const chart = (d, renderer) => h(UL.ULScatterChart, { locale: 'en', title: 'S', data: d, x: (q) => q.x, y: (q) => q.y, group: (q) => q.g, trend: true, renderer, height: 260, onSelect: (_, ids) => { sel = ids.slice().sort((a, b) => a - b).join(','); }, contextMenu: (q) => { got = q; return [{ id: 'x', label: 'X' }]; } });
      const M = await mount(chart(dataLo), 720);
      try {
        const fr = () => M.box.querySelector('.ul-chart2'), pl = () => fr().querySelector('.ul-chart2-plot');
        const mode = () => pl().getAttribute('data-renderer'); const tip = () => { const q = fr().querySelector('.ul-chart-tip .ul-chart-tip-body'); return q ? q.textContent : ''; };
        const lo = mode(); await M.render(chart(data)); await settle(300); const hi = mode();
        c('sc-switch', `threshold ${at0}: ${at0 - 1} points → svg, ${at0 + 1} → canvas (renderer auto)`, lo === 'svg' && hi === 'canvas' && !!pl().querySelector('canvas.ul-chart2-canvas') && !pl().querySelector('.ul-scatter-pt'), lo + ' → ' + hi);
        const probe = async (renderer) => {
          await M.render(chart(data, renderer)); await settle(250); const out = {};
          pl().focus(); key(pl(), 'Home'); key(pl(), 'ArrowRight'); key(pl(), 'ArrowUp'); await raf(); out.tip = tip(); out.live = liveOf(fr());
          key(pl(), 'End'); await raf(); out.end = tip();
          sel = null; at(pl(), 'pointerdown', 0.3, 0.25); at(pl(), 'pointermove', 0.45, 0.4); at(pl(), 'pointermove', 0.62, 0.7); at(pl(), 'pointerup', 0.62, 0.7); await settle(150); out.sel = sel;
          key(pl(), 'Escape'); await raf();
          got = null; key(pl(), 'Home'); await raf(); at(pl(), 'contextmenu', 0.5, 0.5, { button: 2 }); await settle(200); out.ctx = got ? got.kind + ':' + (got.data && got.data.index) : 'none';
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle(120);
          out.chips = [...fr().querySelectorAll('.ul-chart-lchip')].map((q) => q.textContent + ':' + ((q.querySelector('svg') || {}).innerHTML || '').replace(/\s+/g, '').length).join('|');
          out.mode = mode(); return out;
        };
        const A = await probe('svg'), B = await probe('auto');
        c('sc-tip', 'same tooltip content (Home → ↑ and End)', !!A.tip && A.tip === B.tip && A.end === B.end, A.tip.slice(0, 36) + ' | ' + B.tip.slice(0, 36));
        c('sc-keys', 'same nearest-neighbour live readout', A.live === B.live, A.live.slice(0, 40));
        c('sc-brush', 'same brush selection (indices)', A.sel != null && A.sel.length > 0 && A.sel === B.sel, (A.sel || '').split(',').length + ' / ' + (B.sel || '').split(',').length + ' points');
        c('sc-ctx', 'same contextMenu target (point + index)', A.ctx === B.ctx && A.ctx.startsWith('point'), A.ctx + ' | ' + B.ctx);
        c('sc-legend', 'legend chips keep series shapes', A.chips === B.chips && A.chips.length > 0, B.chips.slice(0, 60));
        c('sc-mode', 'probe ran svg then canvas', A.mode === 'svg' && B.mode === 'canvas', A.mode + ' / ' + B.mode);
        for (const n of [10000, 50000]) {
          const t0 = performance.now(); await M.render(chart(mk(n))); await settle(300); const ms = performance.now() - t0;
          const F = fr(), over = Math.max(0, F.scrollWidth - F.clientWidth, pl().scrollWidth - pl().clientWidth, F.getBoundingClientRect().right - M.box.getBoundingClientRect().right + 1);
          c('sc-' + n, n.toLocaleString('en') + ' points: canvas, no overflow', mode() === 'canvas' && over <= 1, `overflow ${over.toFixed(1)}px · mount+settle ${Math.round(ms)}ms (not a timing verdict)`);
        }
      } finally { await M.done(); }
      return result(checks);
    }


    /* ---------- card: ULColumnsMenu drag reorder (frame-independent) ---------- */
    async function colsDragTest() {
      const checks = [], c = ck(checks), S = UL.columnsDragStats;
      const R = UL.reorderKeys(['a', 'b', 'c', 'd'], 0, 2).join(''), R2 = UL.reorderKeys(['a', 'b', 'c', 'd'], 3, 0).join('');
      c('cd-math', 'reorderKeys a→2 = bcad, d→0 = dabc', R === 'bcad' && R2 === 'dabc', R + ' · ' + R2);
      const mids = [10, 30, 50, 70]; const sl = [UL.dragSlot(mids, 0, 10), UL.dragSlot(mids, 0, 55), UL.dragSlot(mids, 3, 5), UL.dragSlot(mids, 1, 69)].join(',');
      c('cd-slot', 'dragSlot from centres (0@10→0, 0@55→2, 3@5→0, 1@69→2)', sl === '0,2,0,2', sl);
      const cols = ['Name', 'Status', 'Owner', 'Updated', 'Region', 'Plan'].map((k) => ({ key: k, header: k }));
      let renders = 0, state = UL.defaultColumnsState(cols);
      function Host() { const [s, set] = React.useState(state); renders++; state = s; return h(UL.ULColumnsMenu, { columns: cols, value: s, onValueChange: set, locale: 'en' }); }
      const M = await mount(h(Host), 420);
      try {
        const btn = M.box.querySelector('.ul-cols-btn'); btn.click(); await settle(700);
        const grips = () => [...document.querySelectorAll('.ul-anchored .ul-cols-grip')], row = (g) => g.closest('[data-menu-item]');
        c('cd-handles', 'one handle per column row, touch-action none on the handle only', grips().length === 6 && getComputedStyle(grips()[0]).touchAction === 'none' && getComputedStyle(row(grips()[0])).touchAction !== 'none', grips().length + ' handles');
        const g0 = grips()[0], r0 = row(g0).getBoundingClientRect(), r2 = row(grips()[2]).getBoundingClientRect();
        const pe = (el, type, y, o = {}) => el.dispatchEvent(new PointerEvent(type, Object.assign({ bubbles: true, cancelable: true, clientX: r0.left + 10, clientY: y, pointerId: 31, pointerType: 'mouse', button: 0, isPrimary: true }, o)));
        const rBefore = renders, m0 = S.moves, w0 = S.writes, f0 = S.frames;
        pe(g0, 'pointerdown', r0.top + r0.height / 2);
        const y1 = r2.top + r2.height / 2 + 4; for (let k = 1; k <= 12; k++) { pe(window, 'pointermove', r0.top + r0.height / 2 + (y1 - r0.top - r0.height / 2) * k / 12); }
        await settle(500);
        const dragging = !!document.querySelector('[data-cols-dragging]'), shifted = getComputedStyle(row(grips()[1])).transform !== 'none';
        c('cd-norender', 'no React render during the drag (12 pointermoves)', renders === rBefore && S.moves - m0 === 12, `renders +${renders - rBefore} · moves ${S.moves - m0} · var writes ${S.writes - w0}`);
        c('cd-follow', 'one CSS variable write per frame; neighbour shifted (FLIP)', dragging && shifted && S.writes - w0 > 0 && S.writes - w0 === S.frames - f0, `dragging ${dragging} · shifted ${shifted} · writes ${S.writes - w0} / frames ${S.frames - f0}`);
        pe(window, 'pointerup', y1); await settle(900);
        const ord = state.order.slice(0, 3).join(',');
        c('cd-commit', 'drop commits once: Name → position 3', ord === 'Status,Owner,Name' && renders === rBefore + 1, ord + ' · renders +' + (renders - rBefore));
        const lr = [...document.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent).join(' | ');
        c('cd-announce', 'polite announcement of the new position', /Name: position 3 of 6/.test(lr), lr.slice(-60));
        const open1 = !!document.querySelector('.ul-anchored .ul-cols-grip');
        const g1 = grips()[0], q0 = row(g1).getBoundingClientRect(), before = state.order.join(','); const rb = renders;
        pe(g1, 'pointerdown', q0.top + q0.height / 2); for (let k = 1; k <= 6; k++) pe(window, 'pointermove', q0.top + q0.height / 2 + k * 14); await settle(300);
        (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await settle(900);
        const stillOpen = !!document.querySelector('.ul-anchored .ul-cols-grip'), clean = !document.querySelector('[data-cols-dragging]') && grips().every((g) => getComputedStyle(row(g)).transform === 'none');
        c('cd-esc', 'Esc cancels: order restored, menu stays open, no row offset left', state.order.join(',') === before && renders === rb && open1 && stillOpen && clean, `order same ${state.order.join(',') === before} · open ${stillOpen} · clean ${clean}`);
        const tq = row(grips()[2]).getBoundingClientRect(); pe(row(grips()[2]), 'pointerdown', tq.top + 8, { pointerType: 'touch', pointerId: 32 }); pe(window, 'pointermove', tq.top + 60, { pointerType: 'touch', pointerId: 32 }); await settle(200);
        const noTouch = !document.querySelector('[data-cols-dragging]'); pe(window, 'pointerup', tq.top + 60, { pointerType: 'touch', pointerId: 32 });
        c('cd-touch', 'touch on the row (not the handle) never starts a drag', noTouch, String(noTouch));
        const items = UL.columnsMenuItems(cols, state, (s) => { state = s; }, { column: 'Owner', locale: 'en' }); const mr = items.find((x) => x.id === 'move-r:Owner'); const o0 = state.order.indexOf('Owner'); mr.onSelect();
        c('cd-keys', 'keyboard path (Move right) still moves one step', state.order.indexOf('Owner') === o0 + 1, o0 + ' → ' + state.order.indexOf('Owner'));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle(300);
      } finally { await M.done(); }
      return result(checks);
    }

    /* ---------- card: zoom maths, onRangeChange payload, brush Esc cancel ---------- */
    async function zoomTest() {
      const checks = [], c = ck(checks);
      const full = [0, 1000];
      let v = UL.zoomAt([0, 1000], full, 250, 0.5, 10); c('z-at', 'zoomAt keeps the point under the cursor (250 stays at 25 %)', Math.abs(v[0] - 125) < 1e-9 && Math.abs(v[1] - 625) < 1e-9, v.join('–'));
      v = UL.zoomAt([0, 1000], full, 500, 0.0001, 10); c('z-min', 'zoom in is clamped to the minimum span', Math.abs(v[1] - v[0] - 10) < 1e-9, v.join('–'));
      v = UL.zoomAt([100, 200], full, 150, 100, 10); c('z-max', 'zoom out is clamped to the full extent', v[0] === 0 && v[1] === 1000, v.join('–'));
      v = UL.panBy([800, 900], full, 300); c('z-pan', 'pan is clamped at the edge, span kept', v[0] === 900 && v[1] === 1000, v.join('–'));
      const sl = UL.sliceFor(Float64Array.from([0, 10, 20, 30, 40]), [5, 31], true); c('z-slice', 'visible slice for a time view (binary search)', sl[0] === 1 && sl[1] === 3, sl.join('–'));
      const pay = []; const data = Array.from({ length: 100 }, (_, i) => ({ t: new Date(Date.UTC(2026, 0, 1) + i * 864e5), v: i }));
      const M = await mount(h(UL.ULLineChart, { locale: 'en', title: 'Z', data, x: (d) => d.t, xScale: 'time', series: [{ key: 'v', name: 'V', value: (d) => d.v }], zoom: true, height: 200, onRangeChange: (r) => pay.push(r) }), 700);
      try {
        const pl = M.box.querySelector('.ul-chart2-plot');
        at(pl, 'pointerdown', 0.3, 0.5); at(pl, 'pointermove', 0.5, 0.5, { buttons: 1 }); await raf();
        const shown = !!M.box.querySelector('.ul-chart-brush[data-on]'), read = (M.box.querySelector('.ul-chart-brush-read') || {}).textContent || '';
        key(pl, 'Escape'); at(pl, 'pointerup', 0.5, 0.5); await settle(250);
        c('z-esc', 'Esc cancels a brush: rect hidden, no onRangeChange', shown && !M.box.querySelector('.ul-chart-brush[data-on]') && pay.length === 0, `shown ${shown} · readout "${read}" · payloads ${pay.length}`);
        at(pl, 'pointerdown', 0.3, 0.5); at(pl, 'pointermove', 0.6, 0.5, { buttons: 1 }); at(pl, 'pointerup', 0.6, 0.5); await settle(250);
        const p = pay[pay.length - 1];
        const ok = p && p.preset === 'custom' && p.from instanceof Date && p.to instanceof Date && p.to > p.from && p.interval === 0 && p.from >= data[0].t && p.to <= data[99].t;
        c('z-pay', 'brush end → onRangeChange { preset: custom, from: Date, to: Date, interval } (ULTimeRange shape)', !!ok, p ? `${p.from.toISOString().slice(0, 10)} → ${p.to.toISOString().slice(0, 10)}` : 'none');
        const ticks = [...M.box.querySelectorAll('.ul-chart-cat')].map((t) => t.textContent); c('z-ticks', 'axis ticks re-computed for the zoomed view', ticks.length >= 2, ticks.slice(0, 4).join(', '));
        c('z-reset-btn', '"Reset zoom" button shown while zoomed', !!M.box.querySelector('.ul-chart2-ztools button'), M.box.querySelector('.ul-chart2-ztools') ? 'shown' : 'missing');
        pl.focus(); key(pl, '+'); await settle(80); key(pl, 'ArrowRight', { shiftKey: true }); await settle(250); const n0 = pay.length;
        at(pl, 'dblclick', 0.5, 0.5); await settle(250);
        c('z-keys-reset', 'keyboard + / Shift+→ emit; double-click resets (payload null)', n0 >= 3 && pay[pay.length - 1] === null && !M.box.querySelector('.ul-chart2-ztools button'), `${n0} payloads, last ${JSON.stringify(pay[pay.length - 1])}`);
        let prevented = null; const ev = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }); pl.dispatchEvent(ev); prevented = ev.defaultPrevented;
        const ev2 = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true, clientX: pl.getBoundingClientRect().left + 200 }); pl.dispatchEvent(ev2);
        c('z-wheel', 'plain wheel never blocked (page scroll); Ctrl+wheel zooms', prevented === false && ev2.defaultPrevented === true, `plain prevented ${prevented} · ctrl prevented ${ev2.defaultPrevented}`);
      } finally { await M.done(); }
      return result(checks);
    }

    /* ---------- card: linked demo (brush filters table + KPI) ---------- */
    function Linked({ onState }) {
      const t0 = Date.UTC(2026, 7, 1), DAY = 864e5;
      const days = React.useMemo(() => Array.from({ length: 60 }, (_, i) => ({ t: new Date(t0 + i * DAY), v: 10 + (i % 7) })), []);
      const rows = React.useMemo(() => Array.from({ length: 200 }, (_, i) => ({ id: 'r' + i, day: new Date(t0 + (i % 60) * DAY).toISOString().slice(0, 10), di: i % 60, amount: 10 + (i % 9) })), []);
      const [range, setRange] = React.useState(null), [hl, setHl] = React.useState(null);
      const fs = range ? [{ id: 'range', field: 'day', op: 'between', value: { start: range.from.toISOString().slice(0, 10), end: range.to.toISOString().slice(0, 10) } }] : [];
      const shown = UL.applyFilters(rows, fs);
      React.useEffect(() => { onState({ range, shown, rows, setHl }); });
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        h(UL.ULKpiCard, { label: 'Rows', value: shown.length, animate: false }),
        h(UL.ULLineChart, { locale: 'en', title: 'Linked', data: days, x: (d) => d.t, xScale: 'time', series: [{ key: 'v', name: 'V', value: (d) => d.v }], zoom: true, onRangeChange: setRange, range: range ? { from: range.from, to: range.to } : null, highlight: hl, height: 160 }),
        h(UL.ULTable, { label: 'Rows', rows: shown, rowKey: (r) => r.id, maxHeight: 200, columns: [{ key: 'id', header: 'Id' }, { key: 'day', header: 'Day' }] }));
    }
    async function linkedTest() {
      const checks = [], c = ck(checks); let S = null;
      const M = await mount(h(Linked, { onState: (s) => { S = s; } }), 700);
      try {
        const pl = M.box.querySelector('.ul-chart2-plot');
        at(pl, 'pointerdown', 0.25, 0.5); at(pl, 'pointermove', 0.55, 0.5, { buttons: 1 }); at(pl, 'pointerup', 0.55, 0.5); await settle(400);
        const exp = S.rows.filter((r) => { const t = Date.parse(r.day); return t >= Date.parse(S.range.from.toISOString().slice(0, 10)) && t <= Date.parse(S.range.to.toISOString().slice(0, 10)) + 864e5 - 1; }).length;
        const trs = M.box.querySelectorAll('tbody tr[data-key]').length, kpi = (M.box.querySelector('.ul-kpi') || M.box).textContent;
        c('l-table', 'brush → table rows = rows inside the range', S.range && S.shown.length === exp && exp > 0 && exp < 200, `${S.shown.length} of 200 (expected ${exp}) · DOM rows ${trs}`);
        c('l-kpi', 'brush → KPI value = filtered count', kpi.includes(String(S.shown.length)), kpi.replace(/\s+/g, ' ').slice(0, 40));
        S.setHl(S.shown[Math.floor(S.shown.length / 2)].di); await settle(200);
        const tip = M.box.querySelector('.ul-chart-hover[data-on]'); c('l-hover', 'table-row hover → the chart shows that point (tooltip)', !!tip, tip ? tipText(M.box).slice(0, 40) : 'no tooltip');
        S.setHl(null); await settle(120);
      } finally { await M.done(); }
      return result(checks);
    }

    /* ---------- card: streaming window + pause queue ---------- */
    async function streamTest() {
      const checks = [], c = ck(checks);
      const s = UL.createChartStream({ time: (p) => p.t, windowMs: 1000, maxPoints: 500, staleAfter: 400 });
      let notes = 0; const off = s.subscribe(() => notes++);
      for (let i = 0; i < 10; i++) s.appendPoint({ t: i * 10, v: i });
      await raf(); await raf();
      c('s-batch', '10 appends in one frame → one commit, 10 points', s.snapshot().points.length === 10 && notes === 1, `${s.snapshot().points.length} points · ${notes} commits`);
      s.hold(true); for (let i = 10; i < 15; i++) s.appendPoint({ t: i * 10, v: i }); await raf(); await raf();
      c('s-hold', 'hold (hover / pin): snapshot frozen, pending = 5, status paused', s.snapshot().points.length === 10 && s.snapshot().pending === 5 && s.status === 'paused', `${s.snapshot().points.length} · pending ${s.snapshot().pending} · ${s.status}`);
      s.hold(false); await raf(); await raf();
      c('s-resume', 'release → all points applied, pending 0, live', s.snapshot().points.length === 15 && s.snapshot().pending === 0 && s.status === 'live', `${s.snapshot().points.length} · ${s.status}`);
      s.pause(); s.appendPoint({ t: 160, v: 1 }); await raf(); await raf(); const up = s.snapshot().pending; s.resume(); await raf(); await raf();
      c('s-user', 'user pause (ULLiveStatus) queues the same way', up === 1 && s.snapshot().points.length === 16, `pending ${up}`);
      for (let i = 0; i < 2000; i++) s.appendPoint({ t: 200 + i * 5, v: i }); await raf(); await raf();
      const p = s.snapshot().points, span = p[p.length - 1].t - p[0].t;
      c('s-window', 'sliding window: points older than 1.5 × window dropped; buffer ≤ maxPoints', span <= 1500 && p.length <= 500, `${p.length} points · span ${span} ms`);
      s.appendPoint({ t: 1, v: 0 }); await raf(); await raf(); c('s-order', 'out-of-order point dropped', s.snapshot().points[s.snapshot().points.length - 1].t !== 1, 'last t ' + s.snapshot().points[s.snapshot().points.length - 1].t);
      await wait(520); c('s-stale', 'no points for staleAfter → status stale', s.status === 'stale', s.status);
      off();
      return result(checks);
    }

    /* ---------- card: reduced motion paths ---------- */
    async function advReducedTest() {
      const checks = [], c = ck(checks);
      UL.configureMorph({ reducedMotion: 'reduce' });
      try {
        for (const [k, el] of types()) {
          const M = await mount(el, 600);
          try {
            const f = M.box.querySelector('.ul-chart2'), svg = f.querySelector('.ul-chart2-plot svg');
            const anims = [...f.querySelectorAll('*')].flatMap((n) => (n.getAnimations ? n.getAnimations() : [])).filter((a) => a.playState !== 'finished');
            const kinds = anims.map((a) => (a.effect && a.effect.getKeyframes ? Object.keys(a.effect.getKeyframes()[0] || {}).filter((x) => !['offset', 'easing', 'composite', 'computedOffset'].includes(x)).join('+') : '?'));
            const okk = kinds.every((x) => x === 'opacity' || x === '');
            c('r-' + k, `${k}: no draw-in / morph, only a short opacity fade`, okk, kinds.join(', ') || 'none running');
            void svg;
          } finally { await M.done(); }
        }
      } finally { UL.configureMorph({ reducedMotion: 'auto' }); }
      return result(checks);
    }

    /* ---------- frame-dependent cards ---------- */
    async function healthy() { const f = await fps(600); return { f, ok: f >= 50 }; }
    const na = (f, label) => ({ status: 'n/a', checks: [{ key: 'fps', label: `${label}: NEEDS HEALTHY PREVIEW (≥ 50 fps)`, pass: null, value: f.toFixed(1) + ' fps' }], driver: 'live rAF · not run' });
    async function advTipTest() {
      const H0 = await healthy(); if (!H0.ok) return na(H0.f, 'scatter tooltip follows the pointer within a frame');
      const checks = [], c = ck(checks); const M = await mount(types()[3][1], 700);
      try {
        const f = M.box.querySelector('.ul-chart2'), pl = f.querySelector('.ul-chart2-plot'), hv = f.querySelector('.ul-chart-hover'); let lag = 0, n = 0;
        for (let k = 0; k < 40; k++) { const pt = f.querySelectorAll('.ul-scatter-pt')[k]; const r = pt.getBoundingClientRect(), pr = pl.getBoundingClientRect(); at(pl, 'pointermove', (r.left + r.width / 2 - pr.left) / pr.width, (r.top + r.height / 2 - pr.top) / pr.height); const m = /translate3d\(([-\d.]+)px/.exec(hv.style.transform); if (m && Math.abs(+m[1] - (r.left + r.width / 2 - pr.left)) > 1.5) lag++; n++; await raf(); }
        c('tip-sync', 'positioner written in the same event as the move (no frame lag)', lag === 0, `${lag} of ${n} lagged`);
      } finally { await M.done(); }
      return result(checks, 'live rAF');
    }
    async function streamPerfTest() {
      const H0 = await healthy(); if (!H0.ok) return na(H0.f, '4 streaming charts at 20 points/s + 200-row table ≈ 120 fps');
      const checks = [], c = ck(checks);
      const streams = [0, 1, 2, 3].map(() => UL.createChartStream({ time: (p) => p.t, windowMs: 30000 }));
      const rows = Array.from({ length: 200 }, (_, i) => ({ id: 'r' + i, a: i, b: i * 3 }));
      const M = await mount(h(React.Fragment, null, ...streams.map((s, i) => h(UL.ULStreamChart, { key: i, title: 'S' + i, stream: s, series: [{ key: 'v', name: 'V', value: (p) => p.v }], height: 120, pauseOnHover: false })), h(UL.ULTable, { label: 'T', rows, rowKey: (r) => r.id, maxHeight: 200, columns: [{ key: 'id', header: 'Id' }, { key: 'a', header: 'A', numeric: true }] })), 760);
      let t = Date.now(); const id = setInterval(() => { t += 50; streams.forEach((s, i) => s.appendPoint({ t, v: 50 + Math.sin(t / 900 + i) * 20 })); }, 50);
      try { await settle(600); const f = await fps(3000), R = await refresh(); c('perf', `4 streaming charts + 200-row table: ≥ 0.9 × refresh (${R.hz.toFixed(0)} Hz → ≥ ${R.fpsTarget.toFixed(0)} fps)`, f >= R.fpsTarget, f.toFixed(1) + ' fps'); }
      finally { clearInterval(id); await M.done(); }
      return result(checks, 'live rAF');
    }
    async function zoomSmoothTest() {
      const H0 = await healthy(); if (!H0.ok) return na(H0.f, 'zoom / pan smoothness (frame time while panning)');
      const checks = [], c = ck(checks);
      const data = Array.from({ length: 3000 }, (_, i) => ({ t: new Date(Date.UTC(2026, 0, 1) + i * 6e4), v: Math.sin(i / 40) * 30 }));
      const M = await mount(h(UL.ULLineChart, { title: 'Z', data, x: (d) => d.t, xScale: 'time', series: [{ key: 'v', name: 'V', value: (d) => d.v }], zoom: true, range: null, height: 200 }), 760);
      try {
        const pl = M.box.querySelector('.ul-chart2-plot'); pl.focus(); for (let k = 0; k < 4; k++) key(pl, '+'); await settle(200);
        let worst = 0, last = performance.now(); for (let k = 0; k < 60; k++) { key(pl, 'ArrowRight', { shiftKey: true }); await raf(); const now = performance.now(); worst = Math.max(worst, now - last); last = now; }
        c('pan', 'Shift+→ pan: worst frame during 60 steps', worst < 34, worst.toFixed(1) + ' ms');
      } finally { await M.done(); }
      return result(checks, 'live rAF');
    }

    window.ULDemos = Object.assign(window.ULDemos || {}, { AdvGuardFixture, advTableTest, advCtxTest, advKeysTest, quadtreeTest, lttbTest, canvasTest, scatterCanvasTest, colsDragTest, zoomTest, linkedTest, streamTest, advReducedTest, advTipTest, streamPerfTest, zoomSmoothTest });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
