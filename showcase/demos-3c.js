// Task 3B advanced chart demos: ULDemos.ChartsAdv (probe-charts ?adv). Cards mount lazily and animate only when visible.
(function () {
  function define() {
    const React = window.React, h = React.createElement, UL = window.UL;
    const Lazy = (props) => h(window.ULDemos.Lazy, props);
    function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
    const card = { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 };
    const cap = { margin: 0, fontFamily: 'var(--ul-font-mono)', fontSize: 11.5, letterSpacing: '.04em', color: 'var(--ul-color-text-2)' };
    const pill = (on) => ({ height: 32, padding: '0 12px', border: 0, borderRadius: 999, font: '500 13px/1 var(--ul-font-sans)', color: 'var(--ul-color-text)', background: on ? 'rgb(255 255 255 / .2)' : 'rgb(255 255 255 / .06)', cursor: 'pointer', whiteSpace: 'nowrap' });
    const Group = ({ label, opts, value, onChange }) => h('div', { role: 'group', 'aria-label': label, style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
      h('span', { style: cap }, label), opts.map((o) => h('button', { key: String(o[0]), type: 'button', 'aria-pressed': value === o[0], onClick: () => onChange(o[0]), style: pill(value === o[0]) }, o[1])));
    const Cell = ({ label, children, min = 300, span }) => h('div', { style: Object.assign({}, card, span ? { gridColumn: '1 / -1' } : null) }, h('p', { style: cap }, label), h(Lazy, { minHeight: min, label, render: () => children }));
    const menu = (t) => [{ id: 'info', label: t.kind + (t.data && t.data.label != null ? ': ' + t.data.label : t.data && t.data.series ? ': ' + t.data.series : ''), disabled: true }, { id: 'copy', label: 'Copy value' }, { id: 'filter', label: 'Filter to this' }];
    window.__ulAdvRegistry = window.__ulAdvRegistry || {};
    const reg = window.__ulAdvRegistry;

    function ChartsAdv({ only }) {
      const q = new URLSearchParams(location.search);
      const [accent, setAccent] = React.useState(q.get('accent') || 'violet'), [locale, setLocale] = React.useState(q.get('locale') || 'en'), [patterns, setPatterns] = React.useState('auto'), [st, setSt] = React.useState(q.get('state') || 'ready'), [seed, setSeed] = React.useState(1);
      const state = st === 'stale' ? 'ready' : st, stale = st === 'stale';
      const common = { locale, patterns, state, stale, contextMenu: menu, onRetry: () => setSt('ready') };
      const show = (k) => !only || only.split(',').includes(k);
      const r = rng(seed);
      const rings = [{ k: 'Verified', v: 72 + Math.round(r() * 20) }, { k: 'Documents', v: 48 + Math.round(r() * 30) }, { k: 'Liveness', v: 30 + Math.round(r() * 40) }];
      const radar = ['Document verification accuracy', 'Speed', 'Liveness detection', 'Coverage (countries)', 'Price per check', 'Support quality'].map((a) => ({ a, x: 40 + Math.round(r() * 60), y: 30 + Math.round(r() * 70), z: 20 + Math.round(r() * 70) }));
      const bubbles = ['Slovakia', 'Czechia', 'Germany', 'Austria', 'Poland', 'Hungary', 'Italy', 'Spain'].map((k, i) => ({ k, g: i < 4 ? 'DACH + CZ/SK' : 'Other EU', x: Math.round(200 + r() * 1800), y: Math.round(70 + r() * 28), s: Math.round(20 + r() * 300) }));
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hours = ['00', '03', '06', '09', '12', '15', '18', '21'];
      const heat = []; days.forEach((dd, a) => hours.forEach((hh, b) => heat.push({ r: dd, c: hh, v: a > 4 && b < 2 ? null : Math.round((a < 5 ? 60 : 25) * (0.3 + Math.sin((b / 7) * Math.PI)) + r() * 30) })));
      const heatDiv = []; ['Slovakia', 'Czechia', 'Germany', 'Austria', 'Poland'].forEach((cc) => ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'].forEach((w) => heatDiv.push({ r: cc, c: w, v: +((r() - 0.5) * 8).toFixed(1) })));
      const cal = []; const c0 = Date.UTC(2026, 4, 1); for (let i = 0; i < 184; i++) { const wd = new Date(c0 + i * 864e5).getUTCDay(); if (r() < 0.06) continue; cal.push({ t: new Date(c0 + i * 864e5), v: Math.round((wd === 0 || wd === 6 ? 30 : 90) + r() * 60 + i * 0.4) }); }
      const funnel = [{ k: 'Started', v: 12400 }, { k: 'Document uploaded', v: 10100 + Math.round(r() * 500) }, { k: 'Selfie / liveness', v: 8200 + Math.round(r() * 400) }, { k: 'Checks passed', v: 7100 + Math.round(r() * 300) }, { k: 'Approved', v: 6650 + Math.round(r() * 200) }];
      const lat = []; for (let i = 0; i < 2000; i++) { const u = r(); lat.push(Math.max(20, 120 + Math.log(1 / (1 - u * 0.999)) * 70 + (r() - 0.5) * 40)); }
      const tree = { name: 'All products', children: [{ name: 'Identity', children: [{ name: 'Document check', value: 420 }, { name: 'Liveness', value: 260 }, { name: 'AML screening', value: 180 }, { name: 'Address', value: 60 }] }, { name: 'Studio', children: [{ name: 'Seats', value: 300 }, { name: 'Storage', value: 120 }, { name: 'Exports', value: 40 }] }, { name: 'Wallet', children: [{ name: 'Card fees', value: 210 }, { name: 'FX', value: 90 }] }, { name: 'Support', value: 70 }, { name: 'Other', value: 25 }] };
      const latency = 180 + Math.round(r() * 220);
      return h('div', { 'data-ul-accent': accent, style: { display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 } },
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 14 } },
          h(Group, { label: 'accent', value: accent, onChange: setAccent, opts: ['violet', 'ice', 'emerald', 'amber', 'rose'].map((a) => [a, a]) }),
          h(Group, { label: 'locale', value: locale, onChange: setLocale, opts: ['en', 'sk', 'de', 'cs'].map((a) => [a, a.toUpperCase()]) }),
          h(Group, { label: 'patterns', value: patterns, onChange: setPatterns, opts: [['auto', 'auto'], ['on', 'on'], ['off', 'off']] }),
          h(Group, { label: 'state', value: st, onChange: setSt, opts: ['ready', 'loading', 'empty', 'error', 'stale'].map((a) => [a, a]) }),
          h('button', { type: 'button', style: pill(false), onClick: () => setSeed((s) => s + 1) }, 'New data')),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))', gap: 16 } },
          show('radial') && h(Cell, { label: 'ULRadialChart · 3 rings, centre ULRollingNumber' }, h(UL.ULRadialChart, Object.assign({}, common, { title: 'Verification progress', data: state === 'empty' ? [] : rings, label: (d) => d.k, value: (d) => d.v, center: h(UL.ULRollingNumber, { value: rings[0].v, format: { style: 'unit', unit: 'percent' }, locale }), centerLabel: rings[0].k }))),
          show('gauge') && h(Cell, { label: 'ULGaugeChart · fill, thresholds, target, comparison' }, h(UL.ULGaugeChart, Object.assign({}, common, { title: 'p95 latency', label: 'p95 latency', value: state === 'empty' ? null : latency, min: 0, max: 600, format: (v) => Math.round(v) + ' ms', thresholds: [{ to: 250, tone: 'success', label: 'Healthy' }, { to: 450, tone: 'warning', label: 'Degraded' }, { to: 600, tone: 'danger', label: 'Critical' }], target: 300, compare: { value: 260, label: 'Last week' } }))),
          show('needle') && h(Cell, { label: 'ULGaugeChart · needle' }, h(UL.ULGaugeChart, Object.assign({}, common, { title: 'Wallet utilisation', value: state === 'empty' ? null : 64, mode: 'needle', format: (v) => Math.round(v) + ' %', thresholds: [{ to: 60, tone: 'success' }, { to: 85, tone: 'warning' }, { to: 100, tone: 'danger' }], target: 80 })))
,
          show('radar') && h(Cell, { label: 'ULRadarChart · 3 series, long axis labels' }, h(UL.ULRadarChart, Object.assign({}, common, { title: 'Provider comparison', data: state === 'empty' ? [] : radar, axis: (d) => d.a, series: [{ key: 'a', name: 'Provider A', value: (d) => d.x }, { key: 'b', name: 'Provider B', value: (d) => d.y }, { key: 'c', name: 'Provider C', value: (d) => d.z }] })))
,
          show('scatter') && h(Cell, { label: 'ULScatterChart · 3 series (colour + shape), trend, brush' }, h(ScatterDemo, { common, seed })),
          show('bubble') && h(Cell, { label: 'ULScatterChart · bubble (size legend)' }, h(UL.ULScatterChart, Object.assign({}, common, { title: 'Markets', data: state === 'empty' ? [] : bubbles, x: (d) => d.x, y: (d) => d.y, size: (d) => d.s, group: (d) => d.g, pointLabel: (d) => d.k, axes: { x: { label: 'Checks / day' }, y: { label: 'Pass rate', format: (v) => v + ' %' }, size: { label: 'Revenue', format: (v) => '€' + Math.round(v) + 'k' } } })))
,
          show('heatmap') && h(Cell, { label: 'ULHeatmapChart · matrix (sequential)' }, h(UL.ULHeatmapChart, Object.assign({}, common, { title: 'Checks by weekday and hour', data: state === 'empty' ? [] : heat, row: (d) => d.r, col: (d) => d.c, value: (d) => d.v, scaleLabel: 'Checks' }))),
          show('heatdiv') && h(Cell, { label: 'ULHeatmapChart · diverging (change vs last week)' }, h(UL.ULHeatmapChart, Object.assign({}, common, { title: 'Pass rate change (pp)', data: state === 'empty' ? [] : heatDiv, row: (d) => d.r, col: (d) => d.c, value: (d) => d.v, scheme: 'diverging', format: (v) => (v > 0 ? '+' : '') + v.toFixed(1), scaleLabel: 'Change' }))),
          show('calendar') && h(Cell, { label: 'ULCalendarHeatmap · 6 months', span: true }, h(UL.ULCalendarHeatmap, Object.assign({}, common, { title: 'Daily verifications', data: state === 'empty' ? [] : cal, date: (d) => d.t, value: (d) => d.v, scaleLabel: 'Verifications' }))),
          show('funnel') && h(Cell, { label: 'ULFunnelChart · verification steps' }, h(UL.ULFunnelChart, Object.assign({}, common, { title: 'Verification funnel', data: state === 'empty' ? [] : funnel, label: (d) => d.k, value: (d) => d.v }))),
          show('histogram') && h(Cell, { label: 'ULHistogramChart · latency, p50 / p95 / p99' }, h(UL.ULHistogramChart, Object.assign({}, common, { title: 'API latency', values: state === 'empty' ? [] : lat, percentiles: [50, 95, 99], format: (v) => Math.round(v) + ' ms', binOptions: [10, 20, 40] }))),
          show('treemap') && h(Cell, { label: 'ULTreemapChart · drill-in (click a group)' }, h(UL.ULTreemapChart, Object.assign({}, common, { title: 'Spend by product', data: tree, format: (v) => '€' + Math.round(v) + 'k' })))
,
          show('linked') && h(Cell, { label: 'Linked: brush / zoom the chart → ULTimeRange, ULFilterBar, KPI and ULTable filter; hover a row → chart point', span: true, min: 720 }, h(LinkedDemo, { common, seed })),
          show('stream') && h(Cell, { label: 'ULStreamChart · 20 points/s, 60 s window, pause on hover, N new points, stale', span: true }, h(Lazy, { minHeight: 300, label: 'stream', render: (on) => h(StreamDemo, { common, on }) })),
          show('big') && h(Cell, { label: 'ULLineChart · 20 000 points → canvas renderer + LTTB, zoom', span: true }, h(BigDemo, { common, seed }))
        ));
    }
    function LinkedDemo({ common, seed }) {
      const r = rng(seed + 9), t0 = Date.UTC(2026, 7, 1), DAY = 864e5;
      const days = React.useMemo(() => Array.from({ length: 90 }, (_, i) => ({ t: new Date(t0 + i * DAY), orders: Math.round(120 + 40 * Math.sin(i / 6) + r() * 30 + i * 0.6) })), [seed]);
      const rows = React.useMemo(() => Array.from({ length: 200 }, (_, i) => { const di = Math.floor(r() * 90); return { id: 'ord-' + (1000 + i), day: new Date(t0 + di * DAY).toISOString().slice(0, 10), di, amount: Math.round(20 + r() * 480), country: ['SK', 'CZ', 'DE', 'AT'][i % 4] }; }).sort((a, b) => a.di - b.di), [seed]);
      const [range, setRange] = React.useState(null), [hl, setHl] = React.useState(null);
      const iso = (d) => new Date(d).toISOString().slice(0, 10);
      const filters = range ? [{ id: 'range', field: 'day', op: 'between', value: { start: iso(range.from), end: iso(range.to) } }] : [];
      const shown = UL.applyFilters(rows, filters);
      window.__ulLinked = { range, shown: shown.length, sum: shown.reduce((a, x) => a + x.amount, 0), setRange, rows };
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }, 'data-linked': '' },
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' } },
          h(UL.ULTimeRange, { key: range ? +range.from + '-' + +range.to : 'none', value: range ? 'custom' : '30d', custom: range ? { start: new Date(range.from), end: new Date(range.to) } : null, locale: common.locale, onValueChange: (v) => { if (v.preset === 'custom') return; setRange({ from: v.from, to: v.to, preset: 'custom', interval: 0 }); } }),
          h('div', { style: { flex: '1 1 320px', minWidth: 0 } }, h(UL.ULFilterBar, { fields: [{ key: 'day', label: 'Date', type: 'date' }, { key: 'country', label: 'Country', type: 'select', options: ['SK', 'CZ', 'DE', 'AT'].map((v) => ({ value: v, label: v })) }], value: filters, count: shown.length, locale: common.locale, onValueChange: (fs) => { const f = fs.find((x) => x.field === 'day' && x.value && x.value.start); setRange(f ? { from: new Date(f.value.start), to: new Date(new Date(f.value.end).getTime() + DAY - 1), preset: 'custom', interval: 0 } : null); } }))),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 } },
          h(UL.ULKpiCard, { label: 'Orders', value: shown.length, locale: common.locale }),
          h(UL.ULKpiCard, { label: 'Revenue', value: shown.reduce((a, x) => a + x.amount, 0), format: { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }, locale: common.locale })),
        h(UL.ULAreaChart, Object.assign({}, common, { title: 'Orders per day', data: days, x: (d) => d.t, xScale: 'time', series: [{ key: 'orders', name: 'Orders', value: (d) => d.orders }], zoom: { overview: true }, range: range ? { from: range.from, to: range.to } : null, onRangeChange: (v) => setRange(v), highlight: hl, height: 220 })),
        h('div', { onPointerOver: (e) => { const tr = e.target.closest && e.target.closest('tr[data-key]'); const row = tr && rows.find((x) => x.id === tr.dataset.key); setHl(row ? row.di : null); }, onPointerLeave: () => setHl(null) },
          h(UL.ULTable, { label: 'Orders', rows: shown, rowKey: (x) => x.id, maxHeight: 260, stickyHeader: true, density: 'compact', columns: [{ key: 'id', header: 'Order' }, { key: 'day', header: 'Day' }, { key: 'country', header: 'Country' }, { key: 'amount', header: 'Amount', numeric: true, align: 'end' }] })));
    }
    function StreamDemo({ common, on }) {
      const stream = React.useMemo(() => UL.createChartStream({ time: (p) => p.t, windowMs: 60000, staleAfter: 3000 }), []);
      const [run, setRun] = React.useState(true);
      React.useEffect(() => { if (!on || !run) return; let v = 50, t = Date.now(); const id = setInterval(() => { t += 50; v = Math.max(5, v + (Math.random() - 0.5) * 8); stream.appendPoint({ t, v: +v.toFixed(1), u: +(v * 0.6 + Math.random() * 6).toFixed(1) }); }, 50); return () => clearInterval(id); }, [on, run]);
      window.__ulStream = stream;
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h(UL.ULStreamChart, Object.assign({}, common, { title: 'Requests / s (live)', stream, series: [{ key: 'v', name: 'p50', value: (p) => p.v }, { key: 'u', name: 'p10', value: (p) => p.u }], height: 200, kind: 'line' })),
        h('div', { style: { display: 'flex', gap: 8 } }, h('button', { type: 'button', style: pill(!run), onClick: () => setRun((x) => !x) }, run ? 'Stop the source (→ stale after 3 s)' : 'Restart the source')));
    }
    function BigDemo({ common, seed }) {
      const data = React.useMemo(() => { const r = rng(seed + 21), t0 = Date.UTC(2026, 0, 1); let v = 100; return Array.from({ length: 20000 }, (_, i) => ({ t: new Date(t0 + i * 6e4), v: +(v += (r() - 0.5) * 3 + (i === 12345 ? 60 : 0) - (i === 4321 ? 70 : 0)).toFixed(2) })); }, [seed]);
      return h(UL.ULLineChart, Object.assign({}, common, { title: 'Sensor (20 000 points, 1 / min)', data, x: (d) => d.t, xScale: 'time', series: [{ key: 'v', name: 'Value', value: (d) => d.v }], zoom: { overview: true }, height: 220 }));
    }
    function ScatterDemo({ common, seed }) {
      const [selN, setSelN] = React.useState(null);
      const r = rng(seed + 5), pts = [];
      ['Web', 'iOS', 'Android'].forEach((g, k) => { for (let i = 0; i < 40; i++) { const x = 20 + r() * 380; pts.push({ g, x: Math.round(x), y: Math.round(80 + x * (0.4 + k * 0.25) + (r() - 0.5) * 120) }); } });
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        h(UL.ULScatterChart, Object.assign({}, common, { title: 'Session length vs. steps', data: common.state === 'empty' ? [] : pts, x: (d) => d.x, y: (d) => d.y, group: (d) => d.g, trend: true, axes: { x: { label: 'Session (s)' }, y: { label: 'Steps' } }, onSelect: (rows) => setSelN(rows.length) })),
        h('p', { style: cap, 'data-scatter-out': '' }, selN == null ? 'drag a rectangle to select · Esc clears' : 'onSelect: ' + selN + ' rows'));
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { ChartsAdv });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
