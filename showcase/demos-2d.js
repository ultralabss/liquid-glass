// Showcase demos for stage 2d (data). Composes window.UL only. Data sits on calm panels, never on refracted glass.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement, { useState } = React;
    const H3 = (t) => h('h3', { style: { alignSelf: 'flex-start', margin: '8px 0 0', padding: '4px 10px', borderRadius: '10px', background: 'rgb(11 13 18 / .82)', fontSize: '17px', fontWeight: 600 } }, t);
    const row = (kids, s) => h('div', { style: Object.assign({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }, s) }, ...kids);
    const eur = (v) => '€' + Math.round(v).toLocaleString('en-GB');
    const CLIENTS = ['Novak s.r.o.', 'Horvath & Co', 'Bergmann GmbH', 'Kovac Studio', 'Svoboda a.s.', 'Lindner AG', 'Toth Logistics', 'Marek Retail'];
    const STATUS = [['Paid', 'success'], ['Open', 'accent'], ['Late', 'danger'], ['Draft', 'neutral']];
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ROWS = Array.from({ length: 200 }, (_, i) => { const st = STATUS[Math.floor(rnd() * 4)]; return { id: 'INV-2026-' + String(i + 1).padStart(3, '0'), client: CLIENTS[Math.floor(rnd() * CLIENTS.length)], due: new Date(2026, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27)), amount: Math.round(400 + rnd() * 18000), status: st[0], tone: st[1] }; });
    const fmtD = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const COLS = [
      { key: 'id', header: 'Invoice', sortable: true, render: (r) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, r.id, h(UL.ULCopyButton, { variant: 'icon', size: 'sm', label: 'Copy invoice number', value: r.id })) },
      { key: 'client', header: 'Client', sortable: true },
      { key: 'due', header: 'Due', sortable: true, value: (r) => r.due.getTime(), render: (r) => fmtD.format(r.due) },
      { key: 'status', header: 'Status', sortable: true, render: (r) => h(UL.ULBadge, { tone: r.tone, dot: true }, r.status) },
      { key: 'amount', header: 'Amount', sortable: true, numeric: true, render: (r) => eur(r.amount) },
    ];
    const ACTIONS = () => [{ id: 'open', label: 'Open' }, { id: 'send', label: 'Send reminder' }, { id: 'dup', label: 'Duplicate' }, { type: 'separator' }, { id: 'void', label: 'Void invoice', destructive: true }];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const REV = [12.4, 13.1, 12.8, 14.6, 15.9, 15.2, 16.8, 18.1, 17.4, 19.6, 21.2, 22.8].map((v) => v * 1000);
    const COST = [9.1, 9.4, 9.8, 10.2, 10.1, 10.9, 11.3, 11.0, 11.8, 12.4, 12.1, 12.9].map((v) => v * 1000);

    function Data({ backdrop }) { return h(GlassScope, null, h(DataInner, { backdrop })); }
    function DataInner({ backdrop }) {
      const [density, setDensity] = useState('cozy'), [sel, setSel] = useState([]), [mode, setMode] = useState('scroll'), [page, setPage] = useState(1);
      const [loading, setLoading] = useState(false), [empty, setEmpty] = useState(false), [last, setLast] = useState('');
      const [ctx, ctxLast] = useCtxLog();
      const pill = (on) => ({ minHeight: '32px', padding: '0 12px', borderRadius: '999px', border: '1px solid ' + (on ? 'rgb(255 255 255 / .55)' : 'rgb(255 255 255 / .16)'), background: on ? 'rgb(255 255 255 / .14)' : 'transparent', color: 'var(--ul-color-text)', font: 'inherit', fontSize: '13px', cursor: 'pointer' });
      const opt = (cur, set, vals) => h('div', { role: 'group', style: { display: 'flex', gap: '4px' } }, ...vals.map(([t, v]) => h('button', { key: t, type: 'button', 'aria-pressed': cur === v, style: pill(cur === v), onClick: () => set(v) }, t)));
      const panel = (title, kids, s) => h(UL.ULPanel, { surface: 'calm', title, backdrop, style: s }, kids);
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } },
        h(CtxLine, { last: ctxLast }),
        H3('KPI cards · every variant and state'),
        h(KpiStates, { ctx }),
        H3('Stat tiles · lite glass panel, tabular numbers'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' } },
          h(UL.ULStatTile, { ...ctx, label: 'Revenue (Nov)', value: 22840, format: eur, delta: 7.8, sparkline: REV }),
          h(UL.ULStatTile, { label: 'Open invoices', value: 37, delta: -4.1, trend: 'down-good', sparkline: [44, 41, 43, 40, 39, 38, 37] }),
          h(UL.ULStatTile, { label: 'Late payments', value: 6, delta: 2.0, trend: 'down-good', deltaFormat: (d) => '+' + d.toFixed(0) }),
          h(UL.ULStatTile, { label: 'Churn', loading: true }),
          h(UL.ULStatTile, { label: 'NPS', value: null, emptyText: 'Survey starts 1 Dec' })),
        H3('Chart · line · area · bar (accessible summary + data table)'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '16px' } },
          h(UL.ULChart, { ...ctx, kind: 'line', title: 'Revenue vs costs, 2026', labels: MONTHS, series: [{ name: 'Revenue', data: REV }, { name: 'Costs', data: COST }], format: eur }),
          h(UL.ULChart, { kind: 'area', title: 'Revenue, 2026', labels: MONTHS, series: [{ name: 'Revenue', data: REV }], format: eur }),
          h(UL.ULChart, { kind: 'bar', title: 'Invoices sent per quarter', labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: '2025', data: [41, 48, 52, 57] }, { name: '2026', data: [49, 55, 63, 71] }] })),
        H3('Table · 200 rows · sort, select, sticky header, grid keys, row actions'),
        row([
          opt(density, setDensity, [['compact', 'compact'], ['cozy', 'cozy'], ['comfortable', 'comfortable']]),
          opt(mode, (v) => { setMode(v); setPage(1); }, [['scroll (200)', 'scroll'], ['paginated', 'paged'], ['virtual', 'virtual']]),
          opt(loading, setLoading, [['data', false], ['loading', true]]),
          opt(empty, setEmpty, [['rows', false], ['empty', true]]),
          h('span', { style: { fontFamily: 'var(--ul-font-mono)', fontSize: '12px', color: 'var(--ul-color-text-2)' } }, `${sel.length} selected · ${last || 'no action yet'}`),
        ]),
        h('div', { 'data-bench': 'table' }, h(UL.ULTable, {
          label: 'Invoices', columns: COLS, rows: empty ? [] : ROWS, rowKey: (r) => r.id, density, selectable: true, selected: sel, onSelectionChange: setSel,
          rowMenu: ACTIONS, onRowAction: (id, r) => setLast(id + ' ' + r.id), contextMenuHeader: CTX, onContextMenuOpen: ctx.onContextMenuOpen, onContextMenuAction: ctx.onContextMenuAction, loading, defaultSort: { key: 'due', dir: 'asc' },
          maxHeight: mode === 'paged' ? undefined : 520, page: mode === 'paged' ? page : undefined, pageSize: mode === 'paged' ? 12 : undefined, onPageChange: setPage,
          virtual: mode === 'virtual' ? { rowHeight: density === 'compact' ? 40 : density === 'comfortable' ? 56 : 48 } : undefined,
          empty: h(UL.ULEmptyState, { size: 'sm', title: 'No invoices yet', description: 'Invoices appear here once a project has its first milestone.', action: h(UL.ULButton, { size: 'sm' }, 'Create invoice') }),
        })),
        H3('Badges · avatars · progress · skeleton · breadcrumbs · pagination · empty state'),
        h(UL.ULPanel, { ...ctx, surface: 'calm', backdrop, id: 'misc-panel' }, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
          row([['neutral', 'Draft'], ['accent', 'Open'], ['success', 'Paid'], ['warning', 'Due soon'], ['danger', 'Late']].flatMap(([t, l]) => [h(UL.ULBadge, { key: t, tone: t }, l), h(UL.ULBadge, { key: t + 's', tone: t, variant: 'solid' }, l)])),
          row([h(UL.ULAvatar, { name: 'Jana Novak', size: 'sm', status: 'online' }), h(UL.ULAvatar, { name: 'Peter Horvath', status: 'away' }), h(UL.ULAvatar, { name: 'Lena Bergmann', size: 'lg', status: 'busy' }),
            h(UL.ULAvatarGroup, { people: ['Jana Novak', 'Peter Horvath', 'Lena Bergmann', 'Tomas Kovac', 'Eva Svoboda', 'Max Lindner'].map((name) => ({ name })), max: 4, label: 'Project team' })]),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'center' } },
            h(UL.ULProgress, { label: 'Upload', value: 64 }), h(UL.ULProgress, { label: 'Budget used', value: 92, tone: 'warning' }), h(UL.ULProgress, { label: 'Syncing' }),
            row([h(UL.ULProgress, { kind: 'ring', label: 'Milestone 2', value: 40 }), h(UL.ULProgress, { kind: 'ring', label: 'Done', value: 100, tone: 'success' }), h(UL.ULProgress, { kind: 'ring', label: 'Loading', size: 28 })])),
          h('div', { style: { display: 'grid', gridTemplateColumns: '48px 1fr', gap: '12px', alignItems: 'center', maxWidth: '420px' } }, h(UL.ULSkeleton, { shape: 'circle', width: '44px', height: '44px' }), h(UL.ULSkeleton, { lines: 3 })),
          h(UL.ULBreadcrumbs, { items: [{ label: 'Home', href: '#' }, { label: 'Clients', href: '#c' }, { label: 'Novak s.r.o.', href: '#n' }, { label: 'Projects', href: '#p' }, { label: 'Client portal' }] }),
          h(Pg),
          h(UL.ULEmptyState, { title: 'No reports yet', description: 'Reports are generated on the first of each month.', action: h(UL.ULButton, { variant: 'secondary', size: 'sm' }, 'Generate now') }))),
      );
    }

    const pillS = (on) => ({ minHeight: '32px', padding: '0 12px', borderRadius: '999px', border: '1px solid ' + (on ? 'rgb(255 255 255 / .55)' : 'rgb(255 255 255 / .16)'), background: on ? 'rgb(255 255 255 / .14)' : 'transparent', color: 'var(--ul-color-text)', font: 'inherit', fontSize: '13px', cursor: 'pointer' });
    const mono = { fontFamily: 'var(--ul-font-mono)', fontSize: '12px', color: 'var(--ul-color-text-2)' };
    /* context menu demo: one item builder per target kind + a readable payload line */
    const show = (t) => JSON.stringify({ component: t.component, kind: t.kind, id: t.id, column: t.column, selection: t.selection, data: t.data && typeof t.data === 'object' ? Object.fromEntries(Object.entries(t.data).filter(([, v]) => typeof v !== 'object' || Array.isArray(v)).slice(0, 4)) : t.data }, (k, v) => (Array.isArray(v) && v.length > 6 ? v.slice(0, 6).concat('…') : v));
    const CTX = (t) => {
      const n = t.selection && t.selection.length > 1 ? ' (' + t.selection.length + ' rows)' : '';
      if (t.kind === 'header') return [{ id: 'sort-asc', label: 'Sort ascending' }, { id: 'sort-desc', label: 'Sort descending' }, { type: 'separator' }, { id: 'hide', label: 'Hide column' }];
      if (t.kind === 'row' || t.kind === 'cell') return [{ id: 'open', label: 'Open' + n, disabled: n !== '' }, { id: 'copy', label: t.kind === 'cell' ? 'Copy cell' : 'Copy ID' + n, shortcut: '⌘C' }, { id: 'more', label: 'Export', items: [{ id: 'csv', label: 'CSV' }, { id: 'xlsx', label: 'Excel' }] }, { type: 'separator' }, { id: 'del', label: 'Delete' + n, destructive: true }];
      if (t.kind === 'point') return [{ id: 'pin', label: 'Pin ' + t.data.label }, { id: 'annot', label: 'Add annotation' }];
      if (t.kind === 'series') return [{ id: 'only', label: 'Show only ' + t.data.series }, { id: 'color', label: 'Change colour', disabled: true }];
      if (t.kind === 'plot') return [{ id: 'reset', label: 'Reset zoom' }, { id: 'png', label: 'Save as PNG' }];
      return [{ id: 'details', label: 'Details' }, { id: 'pin', label: 'Pin to dashboard', type: 'checkbox', checked: false }, { type: 'separator' }, { id: 'hide', label: 'Hide', destructive: true }];
    };
    function useCtxLog() { const [last, setLast] = useState(''); return [{ contextMenu: CTX, onContextMenuOpen: (t) => setLast(show(t)), onContextMenuAction: (id, t) => setLast(id + ' → ' + show(t)) }, last]; }
    const CtxLine = ({ last }) => h('p', { style: Object.assign({ margin: 0, minHeight: '18px', overflowWrap: 'anywhere' }, mono) }, last ? 'context target: ' + last : 'Right-click (long-press, ContextMenu key, Shift+F10) a KPI, a chart point, a legend chip, a table row / header or a card.');
    /* basic / rich (--ul-data-glass) + intensity (--ul-data-glass-intensity) for everything inside */
    function GlassScope({ children }) {
      const [kind, setKind] = useState('rich'), [k, setK] = useState(1);
      return h('div', { 'data-ul-data-glass': kind === 'basic' ? 'subtle' : 'rich', style: { '--ul-data-glass': kind === 'basic' ? 'subtle' : 'rich', '--ul-data-glass-intensity': k, display: 'flex', flexDirection: 'column', gap: '24px' } },
        h('div', { role: 'group', 'aria-label': 'Data glass', style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' } },
          h('span', { style: mono }, 'DATA GLASS'),
          ...[['basic', 'basic'], ['rich', 'rich']].map(([t, v]) => h('button', { key: v, type: 'button', 'aria-pressed': kind === v, style: pillS(kind === v), onClick: () => setKind(v) }, t)),
          h('label', { style: Object.assign({ display: 'flex', alignItems: 'center', gap: '8px' }, mono) }, 'intensity',
            h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: k, onChange: (e) => setK(+e.target.value), style: { width: '160px', accentColor: 'var(--ul-accent)' } }), k.toFixed(2))),
        children);
    }
    function KpiStates({ ctx }) {
      const pct = { style: 'percent', maximumFractionDigits: 1 }, money = { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 };
      const old = Date.now() - 90000;
      return h(UL.ULKpiGrid, { label: 'KPI variants' },
        h(UL.ULKpiCard, { ...ctx, size: 'hero', variant: 'sparkline', label: 'Revenue, November', value: 22840, format: money, delta: 7.8, sparkline: REV, live: true, updatedAt: Date.now(), onSelect: () => {} }),
        h(UL.ULKpiCard, { ...ctx, variant: 'simple', label: 'Active clients', value: 48, delta: 4.2 }),
        h(UL.ULKpiCard, { variant: 'progress', label: 'Milestones done', value: 31, progress: { value: 31, max: 40, label: 'Milestones' } }),
        h(UL.ULKpiCard, { variant: 'comparison', label: 'Avg. invoice', value: 4120, format: money, previous: 3890, previousLabel: 'October', delta: 5.9 }),
        h(UL.ULKpiCard, { variant: 'target', label: 'Hours billed', value: 612, target: 720, targetLabel: 'Monthly goal' }),
        h(UL.ULKpiCard, { label: 'Churn', state: 'loading' }),
        h(UL.ULKpiCard, { label: 'NPS', state: 'empty', emptyText: 'Survey starts 1 Dec' }),
        h(UL.ULKpiCard, { label: 'Late payments', state: 'error', errorText: 'Could not load', onRetry: () => {} }),
        h(UL.ULKpiCard, { label: 'Conversion', value: 0.034, format: pct, delta: -0.4, goodDirection: 'up', updatedAt: old, staleAfter: 30000 }));
    }

    /* ---------- Live tab: mock socket → keyed stores → KPI grid + table ---------- */
    const KPI_NAMES = ['Revenue', 'Orders', 'Visitors', 'Signups', 'Tickets', 'MRR', 'Churn', 'Uptime', 'Latency', 'Queue', 'Errors', 'Refunds'];
    function makeKpiGen() {
      const v = KPI_NAMES.map((_, i) => 200 + i * 137), sp = KPI_NAMES.map((_, i) => Array.from({ length: 16 }, (_, j) => v[i] * (0.9 + 0.1 * Math.sin(j / 2 + i))));
      return (seq) => { const i = seq % 12, prev = v[i]; v[i] = Math.max(1, Math.round(prev * (0.97 + Math.random() * 0.065))); sp[i] = sp[i].slice(1).concat(v[i]); return { seq, id: 'k' + i, v: v[i], d: ((v[i] - prev) / prev) * 100, spark: sp[i] }; };
    }
    function makeRowGen(initial) {
      const ids = initial.map((r) => r.id); let n = initial.length;
      return (seq) => {
        const x = Math.random();
        if (x < 0.12 && ids.length < 60) { const r = { id: 'ORD-' + String(++n).padStart(4, '0'), client: CLIENTS[n % CLIENTS.length], amount: Math.round(200 + Math.random() * 9000), status: 'New', tone: 'accent' }; ids.push(r.id); return { seq, op: 'upsert', value: r }; }
        if (x < 0.2 && ids.length > 20) { const id = ids.splice(Math.floor(Math.random() * ids.length), 1)[0]; return { seq, op: 'remove', key: id }; }
        const id = ids[Math.floor(Math.random() * ids.length)], st = STATUS[Math.floor(Math.random() * 3)];
        return { seq, op: 'patch', key: id, value: { amount: Math.round(200 + Math.random() * 9000), status: st[0], tone: st[1] } };
      };
    }
    const LIVE_ROWS = Array.from({ length: 36 }, (_, i) => ({ id: 'ORD-' + String(i + 1).padStart(4, '0'), client: CLIENTS[i % CLIENTS.length], amount: Math.round(400 + ((i * 7919) % 9000)), status: STATUS[i % 3][0], tone: STATUS[i % 3][1] }));
    const LIVE_COLS = [
      { key: 'id', header: 'Order', sortable: true }, { key: 'client', header: 'Client', sortable: true },
      { key: 'status', header: 'Status', render: (r) => h(UL.ULBadge, { tone: r.tone, dot: true }, r.status) },
      { key: 'amount', header: 'Amount', sortable: true, numeric: true, render: (r) => eur(r.amount) },
    ];
    function LiveTile({ store, k, i, ctx }) {
      const r = UL.useLiveRow(store, k) || {};
      const v = ['sparkline', 'simple', 'sparkline', 'comparison'][i % 4];
      return h(UL.ULKpiCard, { ...ctx, variant: v, label: KPI_NAMES[i], value: r.v ?? null, delta: r.d ?? null, sparkline: r.spark, previous: v === 'comparison' ? r.prev : undefined, previousLabel: 'last tick', live: true, updatedAt: r.t, staleAfter: 10000, compact: true, state: r.v == null ? 'loading' : 'ready' });
    }
    function Live() {
      const ref = React.useRef(null);
      if (!ref.current) {
        const kt = UL.mock({ rate: 5, generate: makeKpiGen() }), rt = UL.mock({ rate: 4, generate: makeRowGen(LIVE_ROWS) });
        ref.current = { kt, rt,
          ks: UL.createLiveSource({ transport: kt, idOf: (m) => 'k' + m.seq }),
          rs: UL.createLiveSource({ transport: rt, idOf: (m) => 'r' + m.seq }) };
      }
      const { kt, rt, ks, rs } = ref.current;
      const kStore = UL.useLiveStore(ks, { key: (r) => r.id, autoStart: true, toOps: (m) => ({ op: 'patch', key: m.id, value: { v: m.v, d: m.d, prev: Math.round(m.v / (1 + m.d / 100)), spark: m.spark, t: Date.now() } }), initial: KPI_NAMES.map((_, i) => ({ id: 'k' + i })) });
      const rStore = UL.useLiveStore(rs, { key: (r) => r.id, autoStart: true, toOps: (m) => m, initial: LIVE_ROWS });
      const [ctx, ctxLast] = useCtxLog();
      const [rate, setRate] = useState(5), [dups, setDups] = useState(false), [slow, setSlow] = useState(false), [, tick] = useState(0);
      React.useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t); }, []);
      const both = (o) => { kt.controls.set(o); rt.controls.set(o); };
      const st = ks.stats;
      const btn = (t, fn) => h(UL.ULButton, { size: 'sm', variant: 'secondary', onClick: fn }, t);
      return h(GlassScope, null,
        h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' } },
          h(UL.ULLiveStatus, { source: ks }),
          h('label', { style: Object.assign({ display: 'flex', alignItems: 'center', gap: '8px' }, mono) }, 'rate',
            h('input', { type: 'range', min: 0, max: 60, step: 1, value: rate, onChange: (e) => { const r = +e.target.value; setRate(r); kt.controls.set({ rate: r }); rt.controls.set({ rate: Math.max(0, Math.round(r * 0.8)) }); }, style: { width: '140px', accentColor: 'var(--ul-accent)' } }), rate + '/s'),
          btn('Burst 50', () => { kt.controls.burst(50); rt.controls.burst(20); }),
          btn('Disconnect', () => { kt.controls.disconnect(); rt.controls.disconnect(); }),
          btn('Reconnect', () => { ks.stop(); rs.stop(); ks.start(); rs.start(); }),
          h('button', { type: 'button', 'aria-pressed': dups, style: pillS(dups), onClick: () => { both({ duplicates: dups ? 0 : 0.3 }); setDups(!dups); } }, 'duplicates'),
          h('button', { type: 'button', 'aria-pressed': slow, style: pillS(slow), onClick: () => { both(slow ? { latency: 0, jitter: 0, reorder: 0 } : { latency: 600, jitter: 500, reorder: 0.15 }); setSlow(!slow); } }, 'slow network')),
        h('p', { style: Object.assign({ margin: 0 }, mono) }, `received ${st.received} · delivered ${st.delivered} · duplicates ${st.duplicates} · out of order ${st.outOfOrder} · reconnects ${st.reconnects} · buffered ${st.buffered}`),
        H3('Live KPI grid · 12 tiles'),
        h('div', { 'data-bench': 'kpi12' }, h(UL.ULKpiGrid, { label: 'Live KPIs' }, ...KPI_NAMES.map((_, i) => h(LiveTile, { key: i, store: kStore, k: 'k' + i, i, ctx })))),
        h(CtxLine, { last: ctxLast }),
        H3('Live table · insert / update / remove'),
        h('div', { 'data-bench': 'livetable' }, h(UL.ULTable, { ...ctx, label: 'Live orders', columns: LIVE_COLS, store: rStore, rowKey: (r) => r.id, maxHeight: 420, selectable: true, contextMenuHeader: CTX })),
        H3('Streaming chart'),
        h('div', { role: 'note', style: { display: 'grid', placeItems: 'center', minHeight: '220px', borderRadius: '22px', border: '1px dashed rgb(255 255 255 / .22)', color: 'var(--ul-color-text-2)', fontSize: '14px' } }, 'Streaming chart slot (next step)'));
    }
    function Pg() { const [p, setP] = useState(4); return h(UL.ULPagination, { page: p, pageCount: 17, onPageChange: setP }); }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Data, Live });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
