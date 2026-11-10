// Motion-test cards: dashboard blocks (Part 3). Live rAF clock; uses ULDemos.__stage.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value });
    const result = (checks) => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'live rAF' });
    const stage = (...a) => window.ULDemos.__stage(...a);
    const vis = (sel) => [...document.querySelectorAll(sel)].filter((n) => n.style.visibility !== 'hidden' && n.getClientRects().length);
    async function blocksTest() {
      const checks = [], c = ck(checks); let setSel = null, store = null;
      const ROWS = Array.from({ length: 12 }, (_, i) => ({ id: 'r' + i, n: i }));
      function Fix() {
        const [sel, ss] = React.useState([]); setSel = ss; store = UL.useLiveStore(null, { key: (r) => r.id, initial: ROWS });
        return h('div', null,
          h(UL.ULTable, { label: 'b', columns: [{ key: 'id', header: 'ID' }, { key: 'n', header: 'N', numeric: true }], store, rowKey: (r) => r.id, selectable: true, selected: sel, onSelectionChange: ss, pinSelection: true, maxHeight: 200 }),
          h(UL.ULBulkActionBar, { selected: sel, total: 12, onClear: () => ss([]), actions: [{ id: 'x', label: 'Export', onAction: () => {} }] }),
          h(UL.ULCopyField, { label: 'Key', value: 'sk_secret_value_123', masked: true, revealTimeout: 400 }),
          h(UL.ULBannerQueue, { items: [{ id: 'a', title: 'First' }, { id: 'b', title: 'Second' }], onDismiss: () => {} }),
          h('span', { 'data-t': 'ago' }, h(UL.ULTimeAgo, { value: Date.now() - 120000 }), h(UL.ULTimeAgo, { value: Date.now() - 7200000 })));
      }
      const S = await stage(() => h(Fix), 560);
      // bulk bar morph + live pin rule
      setSel(['r2', 'r3']); const t0 = performance.now(); const sizes = new Set(); let bar = null;
      while (performance.now() - t0 < 700) { await raf(); bar = vis('.ul-bulk')[0]; if (bar) { const b = bar.getBoundingClientRect(); sizes.add(Math.round(b.width) + 'x' + Math.round(b.height)); } }
      const br = bar && bar.getBoundingClientRect();
      c('bulk', 'bulk bar pours in from the bottom edge (anchored morph, intermediate sizes), inside the viewport', !!bar && sizes.size >= 4 && br.bottom <= innerHeight + 0.5, sizes.size + ' sizes · bottom ' + (br ? Math.round(br.bottom) : '-') + '/' + innerHeight);
      const keys = () => [...S.box.querySelectorAll('tbody tr[data-key]:not([data-exiting])')].map((n) => n.dataset.key);
      const k0 = keys().join(); store.remove('r3'); store.upsert({ id: 'rX', n: -1 }); store.flush(); await wait(300);
      c('pin', 'selected rows pinned while the bar is open: structural changes queue (pill)', keys().join() === k0 && !!S.box.querySelector('.ul-live-pill'), 'rows unchanged ' + (keys().join() === k0));
      setSel([]); await wait(700);
      c('bulkout', 'clearing the selection closes the bar (normal exit)', vis('.ul-bulk').length === 0, vis('.ul-bulk').length + ' visible');
      // copy field mask + reveal timeout
      const cf = S.box.querySelector('.ul-copyfield'), val = () => cf.querySelector('.ul-copyfield-value').textContent;
      const leak0 = [cf.innerText, cf.querySelector('.ul-copyfield-value').getAttribute('aria-label') || '', cf.querySelector('.ul-copyfield-value').getAttribute('data-ul-tip') || ''].some((t) => t.includes('sk_secret'));
      cf.querySelector('[aria-pressed]').click(); await wait(80); const shown = val().includes('sk_secret'); await wait(500);
      c('mask', 'copy field: masked by default (no value in text, aria or tooltip), reveal auto-hides after the timeout', !leak0 && shown && !val().includes('sk_secret'), 'leak ' + leak0 + ' · revealed ' + shown + ' · hidden again ' + !val().includes('sk_secret'));
      // banner queue
      const bq = S.box.querySelector('.ul-banner'); const t1 = bq.textContent; [...bq.querySelectorAll('button')].find((b) => /Next/.test(b.textContent)).click(); await wait(60);
      c('banner', 'banner queue: one at a time, "1 of 2 · Next"', /1 of 2/.test(t1) && /Second/.test(S.box.querySelector('.ul-banner').textContent), t1.slice(0, 40));
      // time ago shared timer + hidden pause
      const st = UL.timeAgoStats();
      Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); const paused = !UL.timeAgoStats().running;
      delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); const resumed = UL.timeAgoStats().running;
      const tg = S.box.querySelector('[data-t="ago"] time');
      c('timeago', 'ULTimeAgo: ONE shared interval for every instance, paused while hidden, <time datetime>', st.running && paused && resumed && !!tg.getAttribute('datetime'), st.subscribers + ' subscribers · 1 interval · paused ' + paused + ' · resumed ' + resumed + ' · "' + tg.textContent + '"');
      // filters: URL round trip + apply
      const F = [{ key: 'n', label: 'N', type: 'number' }, { key: 't', label: 'T', type: 'tags' }, { key: 's', label: 'S', type: 'text' }];
      const fs = [{ id: 'a', field: 'n', op: 'between', value: [2, 5] }, { id: 'b', field: 't', op: 'in', value: ['x', 'y'] }, { id: 'c', field: 's', op: 'contains', value: 'Ab:c' }];
      const back = UL.filtersFromQuery(UL.filtersToQuery(fs), F);
      const same = JSON.stringify(back.map((f) => [f.field, f.op, f.value])) === JSON.stringify(fs.map((f) => [f.field, f.op, f.value]));
      const out = UL.applyFilters([{ n: 1, t: ['x'], s: 'abc' }, { n: 3, t: ['y'], s: 'xAB:Cx' }, { n: 4, t: [], s: 'ab:c' }], fs);
      c('filters', 'filter state ⇄ URL query round trip; client-side apply', same && out.length === 1 && out[0].n === 3, 'round trip ' + same + ' · matched ' + out.length);
      await S.done(); return result(checks);
    }
    async function filterBarTest() {
      const checks = [], c = ck(checks); let value = [];
      const F = [{ key: 'status', label: 'Status', type: 'select', options: [{ value: 'A', label: 'Active' }, { value: 'P', label: 'Paused' }] }, { key: 'mrr', label: 'MRR', type: 'number' }];
      function Fix() { const [v, setV] = React.useState([{ id: 'f1', field: 'status', op: 'is', value: 'A' }, { id: 'f2', field: 'mrr', op: 'gt', value: 10 }]); value = v; return h(UL.ULFilterBar, { fields: F, value: v, onValueChange: setV, count: v.length * 10, views: [{ id: 'paused', name: 'Paused only', filters: [{ id: 'v1', field: 'status', op: 'is', value: 'P' }] }] }); }
      const S = await stage(() => h(Fix), 640);
      const chips = () => S.box.querySelectorAll('.ul-filter-chip').length;
      const x = S.box.querySelectorAll('.ul-filter-chip-x')[1]; const w0 = x.closest('.ul-filter-chip').offsetWidth; x.click(); await wait(80); const mid = S.box.querySelectorAll('.ul-filter-chip')[1]?.offsetWidth ?? 0; await wait(300);
      c('remove', 'remove animates the chip out, then the filter is gone', mid < w0 && chips() === 1 && value.length === 1, w0 + 'px → ' + mid + 'px · chips ' + chips());
      S.box.querySelector('.ul-filter-chip-main').click(); await wait(700);
      const pop = vis('.ul-anchored').find((n) => n.querySelector('.ul-filter-form'));
      c('edit', 'click on a chip opens the editor popover (anchored morph) prefilled', !!pop && /Status/.test(pop.textContent), pop ? 'open' : 'none');
      pop && pop.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(600);
      c('apply', 'apply closes the popover and keeps one filter', !vis('.ul-anchored').some((n) => n.querySelector('.ul-filter-form')) && value.length === 1, value.length + ' filter(s)');
      const roll = S.box.querySelector('.ul-filter-count .ul-roll');
      c('count', 'result count is a rolling number', !!roll, roll ? roll.textContent.trim().slice(0, 12) : 'none');
      // saved view WITHOUT onApplyView: the bar applies the view's filters through onValueChange (was a ReferenceError: onChange)
      { let err = null; const onErr = (e) => { err = e.message || String(e); }; window.addEventListener('error', onErr);
        S.box.querySelector('.ul-filter-views')?.click(); await wait(500);
        const it = [...document.querySelectorAll('.ul-menu-surface [role^=menuitem]')].find((n) => /Paused only/.test(n.textContent)); it?.click(); await wait(400);
        window.removeEventListener('error', onErr); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300);
        c('view', 'saved view without onApplyView applies its filters (onValueChange), no error', !!it && !err && value.length === 1 && value[0].value === 'P', (it ? 'applied ' + JSON.stringify(value.map((f) => f.value)) : 'no view item') + (err ? ' · error ' + err : '')); }
      await S.done(); return result(checks);
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { blocksTest, filterBarTest });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
