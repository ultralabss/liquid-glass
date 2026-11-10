// Showcase: dashboard building blocks (Part 5). Lazy-mounted tab. Composes window.UL only; fake data, no backend.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement, { useState, useMemo } = React;
    const H3 = (t) => h('h3', { style: { alignSelf: 'flex-start', margin: '8px 0 0', padding: '4px 10px', borderRadius: '10px', background: 'rgb(11 13 18 / .82)', fontSize: '17px', fontWeight: 600 } }, t);
    const mono = { fontFamily: 'var(--ul-font-mono)', fontSize: '12px', color: 'var(--ul-color-text-2)' };
    const NAMES = ['Jana Novak', 'Peter Horvath', 'Lena Bergmann', 'Tomas Kovac', 'Eva Svoboda', 'Max Lindner'];
    const ST = [['Active', 'success'], ['Trial', 'accent'], ['Overdue', 'danger'], ['Paused', 'neutral']];
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ROWS = Array.from({ length: +(new URLSearchParams(location.search).get('rows') || 200) }, (_, i) => { const st = ST[Math.floor(rnd() * 4)]; return { id: 'acc_' + (100000 + i * 37).toString(36) + 'x' + i, name: NAMES[i % 6], email: NAMES[i % 6].split(' ')[0].toLowerCase() + '@client' + (i % 9) + '.sk', status: st[0], tone: st[1], plan: ['Starter', 'Team', 'Scale'][i % 3], mrr: Math.round(40 + rnd() * 2400), delta: +(rnd() * 20 - 8).toFixed(1), usage: Math.round(rnd() * 100), seen: Date.now() - Math.round(rnd() * 9e8), tags: ['eu', 'priority', 'beta', 'sso', 'api'].filter(() => rnd() > 0.55), active: rnd() > 0.3, spark: Array.from({ length: 10 }, () => Math.round(rnd() * 40)) }; });
    const FIELDS = [{ key: 'name', label: 'Name', type: 'text' }, { key: 'status', label: 'Status', type: 'select', options: ST.map(([v]) => ({ value: v, label: v })) }, { key: 'plan', label: 'Plan', type: 'select', options: ['Starter', 'Team', 'Scale'].map((v) => ({ value: v, label: v })) }, { key: 'mrr', label: 'MRR', type: 'number' }, { key: 'tags', label: 'Tags', type: 'tags', options: ['eu', 'priority', 'beta', 'sso', 'api'].map((v) => ({ value: v, label: v })) }];
    const eur = { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 };
    const BASE = [
      { key: 'id', header: 'Account', width: 180, render: (r) => h(UL.ULCellId, { value: r.id }) },
      { key: 'name', header: 'Owner', sortable: true, width: 200, render: (r) => h(UL.ULCellPerson, { name: r.name, subtitle: r.email }) },
      { key: 'status', header: 'Status', sortable: true, render: (r) => h(UL.ULCellStatus, { value: r.status, tone: r.tone }) },
      { key: 'plan', header: 'Plan', sortable: true },
      { key: 'mrr', header: 'MRR', sortable: true, numeric: true, render: (r) => h(UL.ULCellNumber, { value: r.mrr, delta: r.delta, format: eur }) },
      { key: 'usage', header: 'Usage', sortable: true, render: (r) => h(UL.ULCellProgress, { value: r.usage, label: 'Usage' }) },
      { key: 'spark', header: 'Trend', render: (r) => h(UL.ULCellSparkline, { data: r.spark }) },
      { key: 'tags', header: 'Tags', render: (r) => h(UL.ULCellTags, { tags: r.tags }) },
      { key: 'active', header: 'SSO', render: (r) => h(UL.ULCellBool, { value: r.active }) },
      { key: 'seen', header: 'Last seen', sortable: true, value: (r) => r.seen, render: (r) => h(UL.ULCellTime, { value: r.seen }) },
    ];
    const NOCELL = (new URLSearchParams(location.search).get('nocell') || '').split(','); // debug: drop a column's renderer
    for (const c of BASE) if (NOCELL.includes(c.key)) delete c.render;
    if (location.search.includes('trace')) { let n = 0; for (const c of BASE) if (c.render) { const r = c.render; c.render = (row) => { if (++n % 50 === 0 || n < 5) console.log('[trace] cell render', c.key, n, Math.round(performance.now())); return r(row); }; } let rf = 0; const RAF = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => { rf++; return RAF(f); }; let lt = 0; try { new PerformanceObserver((x) => x.getEntries().forEach((e) => { lt += e.duration; if (e.duration > 300) console.log('[trace] longtask', Math.round(e.duration), Math.round(e.startTime)); })).observe({ type: 'longtask' }); } catch (e) {} setInterval(() => console.log('[trace] alive', Math.round(performance.now()), 'raf', rf, 'longtask ms', Math.round(lt)), 1000);
      const RO = window.ResizeObserver; let ro = 0; window.ResizeObserver = class extends RO { constructor(cb) { super((e, o) => { if (++ro % 200 === 0) console.log('[trace] RO cb', ro, Math.round(performance.now())); cb(e, o); }); } }; }
    const SKIP = new URLSearchParams(location.search).get('skip') || ''; // debug: ?skip=table,banner,filter,time,copy,usage,error,dl
    const on = (k) => !SKIP.split(',').includes(k);
    function Blocks() {
      const L = window.ULDemos.Lazy;
      const [filters, setFilters] = useState([{ id: 'f1', field: 'status', op: 'isNot', value: 'Paused' }]);
      const [sel, setSel] = useState([]), [cols, setCols] = UL.useColumnsState(BASE, { storageKey: 'ul-demo-cols' });
      const [loading, setLoading] = useState(false), [banners, setBanners] = useState([{ id: 'b1', tone: 'maintenance', title: 'Scheduled maintenance', description: 'Sat 22:00–23:00 CET. Exports are paused.' }, { id: 'b2', tone: 'warning', title: 'Usage at 82 %', description: 'Your team plan resets on 1 December.' }]);
      const [range, setRange] = useState(null), [upd, setUpd] = useState(Date.now());
      const rows = useMemo(() => UL.applyFilters(ROWS, filters), [filters]);
      const columns = useMemo(() => UL.applyColumns(BASE, cols), [cols]);
      const q = UL.filtersToQuery(filters);
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
        on('banner') && h(UL.ULBannerQueue, { items: banners, onDismiss: (id) => setBanners((b) => b.filter((x) => x.id !== id)) }),
        H3('Filter bar · columns menu · cell renderers · bulk bar'),
        on('filter') && h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' } },
          h('div', { style: { flex: '1 1 480px', minWidth: 0 } }, h(UL.ULFilterBar, { fields: FIELDS, value: filters, onValueChange: setFilters, count: rows.length, views: [{ id: 'v1', name: 'Overdue accounts', filters: [{ id: 'v1a', field: 'status', op: 'is', value: 'Overdue' }] }, { id: 'v2', name: 'Big accounts', filters: [{ id: 'v2a', field: 'mrr', op: 'gt', value: 1500 }] }], onSaveView: () => {} })),
          on('cols') && h(UL.ULColumnsMenu, { columns: BASE, value: cols, onValueChange: setCols }),
          on('lbtn') && h(UL.ULButton, { size: 'sm', variant: 'plain', pressed: loading, onPressedChange: setLoading }, 'loading cells')),
        h('p', { style: Object.assign({ margin: 0, overflowWrap: 'anywhere' }, mono) }, 'URL: ?' + q),
        on('table') && h(L, { label: 'blocks-table', minHeight: 560 }, h('div', { 'data-bench': 'blocks-table' }, h(UL.ULTable, {
          label: 'Accounts', columns: loading ? columns.map((c) => ({ ...c, render: () => h(UL.ULCellStatus, { loading: true }) })) : columns, rows, rowKey: (r) => r.id, selectable: true, selected: sel, onSelectionChange: setSel, pinSelection: true,
          density: cols.density, maxHeight: 520, rowMenu: () => [{ id: 'open', label: 'Open' }, { id: 'impersonate', label: 'View as owner' }, { type: 'separator' }, { id: 'suspend', label: 'Suspend', destructive: true }],
          contextMenuHeader: (t) => UL.columnsMenuItems(BASE, cols, setCols, { column: t.column }),
        }))),
        on('bulk') && h(UL.ULBulkActionBar, { selected: sel, total: rows.length, onClear: () => setSel([]), onSelectAll: () => setSel(rows.map((r) => r.id)),
          actions: [{ id: 'export', label: 'Export', icon: h(UL.ULIcon, { name: 'download' }), onAction: () => wait(700) }, { id: 'tag', label: 'Add tag', onAction: () => wait(400) }, { id: 'del', label: 'Suspend', destructive: true, onAction: () => wait(900) }],
          more: [{ id: 'merge', label: 'Merge accounts' }, { id: 'owner', label: 'Change owner' }] }),
        H3('Time range · refresh control · time ago'),
        on('time') && h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', minWidth: 0 } },
          h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '14px' } }, h(UL.ULTimeRange, { value: '24h', onValueChange: setRange }), h(UL.ULRefreshControl, { onRefresh: () => wait(600).then(() => setUpd(Date.now())), updatedAt: upd })),
          h('span', { style: Object.assign({}, mono, { maxWidth: '100%', overflowWrap: 'anywhere' }) }, range ? `{ from: ${range.from.toISOString().slice(0, 16)}, to: ${range.to.toISOString().slice(0, 16)}, interval: ${range.interval} }` : 'pick a range'),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px' } }, h('span', null, 'Deploy ', h(UL.ULTimeAgo, { value: Date.now() - 3e5 })), h('span', null, 'Invoice ', h(UL.ULTimestamp, { value: Date.now() - 864e5 * 3 })))),
        H3('Copy field · status · usage · error state · description list'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'start' } },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            on('copy') && h(UL.ULCopyField, { label: 'Webhook URL', value: 'https://hooks.example.test/in/9f2c1a7e3b5d4c1f8e6a' }),
            on('copy') && h(UL.ULCopyField, { label: 'API key', value: 'sk_live_51Hc_demo_not_real_7d1e', masked: true, revealTimeout: 8000 }),
            on('pills') && h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } }, ...['operational', 'degraded', 'outage', 'maintenance', 'unknown'].map((s) => h(UL.ULStatusPill, { key: s, status: s, live: s === 'operational' })))),
          on('usage') && h(UL.ULUsageMeter, { label: 'API calls this month', value: 82140, limit: 100000, unit: 'calls', burnRate: 3100, history: [20, 31, 28, 40, 44, 52, 61, 70, 76, 82], action: h(UL.ULButton, { size: 'sm', variant: 'tinted' }, 'Upgrade') }),
          on('error') && h(UL.ULErrorState, { message: 'The invoices service did not answer in time.', onRetry: () => wait(800).then(() => { throw new Error('still down'); }), diagnostics: { request: 'req_8f3a2c', status: 504, time: new Date().toISOString() }, support: h('span', { style: mono }, 'contact@ultra-labs.eu') }),
          on('dl') && h(UL.ULDescriptionList, { items: [{ label: 'Account', value: 'acc_2s9x1', copy: 'acc_2s9x1' }, { label: 'Owner', value: 'Jana Novak' }, { label: 'Billing e-mail', value: 'accounts-payable-department@very-long-client-domain.example', truncate: true }, { label: 'Created', value: h(UL.ULTimestamp, { value: Date.now() - 864e5 * 220 }) }] })));
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Blocks });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
