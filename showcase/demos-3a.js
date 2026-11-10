// Task 3A chart demos: ULDemos.Charts. Every card mounts lazily (demo-lazy.js) and only animates when visible.
(function () {
  function define() {
    const React = window.React, h = React.createElement, UL = window.UL;
    const Lazy = (props) => h(window.ULDemos.Lazy, props);
    function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
    const MONTHS = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
    function series(n, seed, base, vol, trend) { const r = rng(seed); let v = base; return Array.from({ length: n }, () => (v = Math.max(base * 0.15, v + (r() - 0.45) * vol + trend))); }
    function makeData(n, seed) {
      const t0 = Date.UTC(2026, 0, 1), day = 864e5;
      const a = series(n, seed, 1200, 160, 6), b = series(n, seed + 7, 800, 120, 3), c = series(n, seed + 13, 420, 80, 2), conv = series(n, seed + 3, 3.2, 0.35, 0.004);
      return Array.from({ length: n }, (_, i) => ({ t: n <= 12 ? MONTHS.en[i % 12] : new Date(t0 + i * day), web: Math.round(a[i]), app: Math.round(b[i]), api: Math.round(c[i]), conv: +conv[i].toFixed(2), gap: i % 9 === 5 ? null : Math.round(a[i] * 0.7) }));
    }
    const S = (key, name, extra) => Object.assign({ key, name, value: (d) => d[key] }, extra);
    const card = { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 };
    const cap = { margin: 0, fontFamily: 'var(--ul-font-mono)', fontSize: 11.5, letterSpacing: '.04em', color: 'var(--ul-color-text-2)' };
    const pill = (on) => ({ height: 32, padding: '0 12px', border: 0, borderRadius: 999, font: '500 13px/1 var(--ul-font-sans)', color: 'var(--ul-color-text)', background: on ? 'rgb(255 255 255 / .2)' : 'rgb(255 255 255 / .06)', cursor: 'pointer', whiteSpace: 'nowrap' });
    const Group = ({ label, opts, value, onChange }) => h('div', { role: 'group', 'aria-label': label, style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
      h('span', { style: cap }, label), opts.map((o) => h('button', { key: String(o[0]), type: 'button', 'aria-pressed': value === o[0], onClick: () => onChange(o[0]), style: pill(value === o[0]) }, o[1])));
    const Cell = ({ label, children, min = 300 }) => h('div', { style: card }, h('p', { style: cap }, label), h(Lazy, { minHeight: min, label, render: () => children }));

    function Charts({ initialSize = 10 }) {
      const [size, setSize] = React.useState(initialSize), [seed, setSeed] = React.useState(1), [accent, setAccent] = React.useState('violet'), [theme, setTheme] = React.useState('app');
      const [stack, setStack] = React.useState('stacked'), [patterns, setPatterns] = React.useState('auto'), [locale, setLocale] = React.useState('en'), [state, setState] = React.useState('loading');
      const data = React.useMemo(() => makeData(size, seed), [size, seed]);
      const isTime = size > 12, xs = (d) => d.t;
      const menu = (t) => [{ id: 'info', label: t.kind === 'point' ? `Point: ${t.data.label}` : t.kind === 'series' ? `Series: ${t.data.series}` : 'Plot background', disabled: true }, { id: 'copy', label: 'Copy value' }, { id: 'filter', label: 'Filter to this' }];
      const common = { locale, patterns, xScale: isTime ? 'time' : 'category', contextMenu: menu };
      const shares = [{ k: 'Card', v: 4820 }, { k: 'Bank transfer', v: 2310 }, { k: 'Apple Pay', v: 1650 }, { k: 'Google Pay', v: 980 }, { k: 'PayPal', v: 240 }, { k: 'Crypto', v: 90 }, { k: 'Voucher', v: 60 }];
      const hbar = [{ k: 'Slovakia', v: 4200 }, { k: 'Czechia', v: 3650 }, { k: 'Germany', v: 2980 }, { k: 'Austria', v: 1420 }, { k: 'Poland', v: 990 }, { k: 'Hungary', v: 610 }];
      const total = shares.reduce((a, s) => a + s.v, 0);
      const spark = data.slice(-24).map((d) => d.web), wl = data.slice(-20).map((d, i, a) => (i ? d.web - a[i - 1].web : 0));
      return h('div', { 'data-ul-theme': theme, 'data-ul-accent': accent, style: { display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 } },
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px 22px', alignItems: 'center' } },
          h(Group, { label: 'points', opts: [[10, '10'], [100, '100'], [1000, '1000']], value: size, onChange: setSize }),
          h(Group, { label: 'theme', opts: [['app', 'App'], ['marketing', 'Marketing']], value: theme, onChange: setTheme }),
          h(Group, { label: 'accent', opts: ['violet', 'ice', 'emerald', 'amber', 'rose'].map((a) => [a, a]), value: accent, onChange: setAccent }),
          h(Group, { label: 'patterns', opts: [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], value: patterns, onChange: setPatterns }),
          h(Group, { label: 'locale', opts: [['en', 'EN'], ['sk', 'SK'], ['de', 'DE'], ['cs', 'CS']], value: locale, onChange: setLocale }),
          h('button', { type: 'button', style: pill(false), onClick: () => setSeed((s) => s + 1), 'data-demo': 'shuffle' }, 'New data (morph)')),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 20, minWidth: 0 } },
          h(Cell, { label: 'line · monotone · gaps · reference + threshold' }, h(UL.ULLineChart, Object.assign({}, common, { title: 'Revenue by channel', description: 'Gross, EUR', data, x: xs, height: 240, filename: 'revenue',
            series: [S('web', 'Web'), S('app', 'App'), S('gap', 'Partners (gaps)')], valueFormat: { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 },
            references: [{ value: 1000, label: 'Target', tone: 'accent' }], thresholds: [{ from: 0, to: 500, tone: 'danger' }] }))),
          h(Cell, { label: 'area · ' + stack }, h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 } },
            h(Group, { label: 'stack', opts: [['none', 'None'], ['stacked', 'Stacked'], ['percent', 'Percent']], value: stack, onChange: setStack }),
            h(UL.ULAreaChart, Object.assign({}, common, { title: 'Requests by surface', data, x: xs, height: 220, stack, series: [S('web', 'Web'), S('app', 'App'), S('api', 'API')] })))),
          h(Cell, { label: 'bar · grouped' }, h(UL.ULBarChart, Object.assign({}, common, { xScale: 'category', title: 'Orders per month', data: data.slice(0, 12), x: (d) => (d.t instanceof Date ? d.t.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : d.t), height: 220, series: [S('web', 'Web'), S('app', 'App')] }))),
          h(Cell, { label: 'bar · stacked' }, h(UL.ULBarChart, Object.assign({}, common, { xScale: 'category', stack: 'stacked', title: 'Orders by surface', data: data.slice(0, 12), x: (d) => (d.t instanceof Date ? d.t.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : d.t), height: 220, series: [S('web', 'Web'), S('app', 'App'), S('api', 'API')] }))),
          h(Cell, { label: 'bar · horizontal' }, h(UL.ULBarChart, { locale, patterns, orientation: 'horizontal', title: 'Customers by country', data: hbar, x: (d) => d.k, height: 240, series: [S('v', 'Customers')], contextMenu: menu })),
          h(Cell, { label: 'combo · bars + line · dual axis' }, h(UL.ULComboChart, Object.assign({}, common, { xScale: 'category', title: 'Sessions and conversion', data: data.slice(0, 12), x: (d) => (d.t instanceof Date ? d.t.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : d.t), height: 220,
            series: [S('web', 'Sessions', { type: 'bar' }), S('conv', 'Conversion', { type: 'line', axis: 'right', slot: 2 })],
            axes: { left: { label: 'Sessions' }, right: { label: 'Conversion %', format: (v) => v.toFixed(1) + ' %' } }, format: (v, k) => (k === 'conv' ? v.toFixed(2) + ' %' : v.toLocaleString(locale)) }))),
          h(Cell, { label: 'donut · rolling number centre · "Other" merged below 3 %' }, h(UL.ULDonutChart, { locale, patterns, title: 'Payments by method', data: shares, label: (d) => d.k, value: (d) => d.v, mergeBelow: 0.03, height: 240, contextMenu: menu,
            center: h(UL.ULRollingNumber, { value: total, locale, format: { maximumFractionDigits: 0 } }), centerLabel: 'payments' })),
          h(Cell, { label: 'pie' }, h(UL.ULPieChart, { locale, patterns, title: 'Plan mix', data: [{ k: 'Free', v: 61 }, { k: 'Pro', v: 27 }, { k: 'Team', v: 9 }, { k: 'Enterprise', v: 3 }], label: (d) => d.k, value: (d) => d.v, height: 220, valueFormat: { style: 'unit', unit: 'percent' } })),
          h(Cell, { label: 'line · log scale' }, h(UL.ULLineChart, Object.assign({}, common, { title: 'Events (log)', data, x: xs, yScale: 'log', height: 220, series: [S('web', 'Web'), S('api', 'API')], curve: 'linear' }))),
          h(Cell, { label: 'sparklines · KPI trend + table cells', min: 260 }, h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 } },
            h(UL.ULKpiGrid || 'div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12 } },
              h(UL.ULKpiCard, { variant: 'sparkline', label: 'Revenue', value: spark[spark.length - 1], delta: 4.2, locale, trend: h(UL.ULSparkChart, { data: spark, variant: 'area', height: 34 }) }),
              h(UL.ULKpiCard, { variant: 'sparkline', label: 'Orders', value: 312, delta: -1.8, locale, trend: h(UL.ULSparkChart, { data: spark.slice(-14), variant: 'bars', height: 34, slot: 1 }) })),
            h(SparkTable, { rows: [['Web', spark, 'line'], ['App', data.slice(-24).map((d) => d.app), 'area'], ['Day change', wl, 'winloss'], ['API', data.slice(-16).map((d) => d.api), 'bars']] }))),
          h(Cell, { label: 'states · ' + state }, h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 } },
            h(Group, { label: 'state', opts: [['loading', 'Loading'], ['empty', 'Empty'], ['error', 'Error'], ['ready', 'Stale']], value: state, onChange: setState }),
            h(UL.ULLineChart, Object.assign({}, common, { title: 'Live throughput', data, x: xs, height: 200, series: [S('web', 'Web')], state, stale: state === 'ready' ? 'Stale · 2 min' : false, onRetry: () => new Promise((r) => setTimeout(r, 900)).then(() => setState('ready')) })))),
          h(Cell, { label: 'bar loading skeleton · donut empty' }, h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 } },
            h(UL.ULBarChart, { title: 'Orders', data: [], x: (d) => d, series: [], state: 'loading', height: 160, locale }),
            h(UL.ULDonutChart, { title: 'Payments', data: [], label: (d) => d, value: () => 0, height: 160, locale }))),
          h(Cell, { label: 'legacy ULChart (2d API → new core)' }, h(UL.ULChart, { kind: 'bar', title: 'Legacy API', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], series: [{ name: 'A', data: [4, 7, 5, 9, 6] }, { name: 'B', data: [3, 4, 6, 5, 8] }], height: 200 }))
        ));
    }
    function SparkTable({ rows }) {
      const th = { textAlign: 'start', padding: '8px 10px', fontWeight: 600, color: 'var(--ul-color-text-2)', fontSize: 12.5 }, td = { padding: '6px 10px', borderTop: '1px solid rgb(255 255 255 / .06)' };
      return h(UL.ULGlass, { tier: 'md', quality: 'lite', padding: '8px', radius: 'var(--ul-radius-lg)', style: { minWidth: 0 } },
        h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5, tableLayout: 'fixed' } },
          h('thead', null, h('tr', null, h('th', { style: th, scope: 'col' }, 'Metric'), h('th', { style: th, scope: 'col' }, 'Variant'), h('th', { style: Object.assign({}, th, { width: '45%' }), scope: 'col' }, 'Trend'))),
          h('tbody', null, rows.map((r) => h('tr', { key: r[0] }, h('th', { scope: 'row', style: Object.assign({}, td, { textAlign: 'start', fontWeight: 500 }) }, r[0]), h('td', { style: Object.assign({}, td, { color: 'var(--ul-color-text-2)' }) }, r[2]),
            h('td', { style: td }, h(UL.ULSparkChart, { data: r[1], variant: r[2], height: 24, label: `${r[0]} trend` })))))));
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Charts });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
