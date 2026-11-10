// Dashboard blocks, Part 11: showcase (Components → Dashboard blocks) + motion-test cards. Mock data only.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement, { useState, useRef, useEffect } = React;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const H3 = (t) => h('h3', { style: { margin: '8px 0 0', font: '600 15px/1.3 var(--ul-font-sans)', color: 'var(--ul-color-text)' } }, t);
    const mono = { font: '12px/1.4 var(--ul-font-mono)', color: 'var(--ul-color-text-2)' };
    const row = (...k) => h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' } }, ...k);
    const NAMES = ['Jana Novak', 'Tomas Kral', 'Lea Wagner', 'Petr Dvorak', 'Mia Schulz', 'Ondrej Bily'];
    const ACTS = [['updated', 'deploy'], ['invited a member to', 'member'], ['changed billing for', 'billing'], ['rotated an API key in', 'security'], ['deployed', 'deploy']];
    let seq = 0;
    const mkNotif = (t = Date.now()) => { const i = seq++; return { id: 'n' + i, title: ['Invoice INV-' + (2000 + i) + ' paid', 'Deploy #' + (400 + i) + ' finished', 'New sign-in from Bratislava', 'Usage at 80 % of plan'][i % 4], body: i % 2 ? 'Tap to view the details.' : undefined, time: t, read: false, tone: ['success', 'accent', 'warning', 'neutral'][i % 4] }; };
    const mkEvent = (t = Date.now()) => { const i = seq++, a = ACTS[i % ACTS.length]; return { id: 'e' + i, actor: { name: NAMES[i % NAMES.length] }, action: a[0], target: { label: ['Client portal', 'Acme GmbH', 'prod-eu-1', 'Billing settings'][i % 4] }, time: t, kind: a[1], details: i % 3 === 0 ? h('pre', { style: { margin: 0, font: '12px/1.5 var(--ul-font-mono)', whiteSpace: 'pre-wrap' } }, `ip: 10.0.${i % 255}.4\nuser-agent: Safari 19\nrequest: req_${(1e6 + i).toString(36)}`) : undefined }; };
    const FILTERS = [{ value: 'deploy', label: 'Deploys' }, { value: 'member', label: 'Members' }, { value: 'billing', label: 'Billing' }, { value: 'security', label: 'Security' }];
    const CURL = `curl https://api.example.com/v1/invoices \\\n  -H "Authorization: Bearer $API_KEY" \\\n  -d amount=4200 \\\n  -d currency=eur`;
    const TS = `import { Client } from "@example/sdk";\n\n// one client per process\nconst client = new Client({ apiKey: process.env.API_KEY });\nconst invoice = await client.invoices.create({ amount: 4200, currency: "eur" });\nconsole.log(invoice.id, true, null);`;
    const bigJson = (n) => ({ meta: { request: 'req_8f2k', took_ms: 42, region: 'eu-central-1', cursor: null, note: 'A long description string that keeps going so the viewer has to truncate it and offer a Show full value button for it.' }, items: Array.from({ length: n }, (_, i) => ({ id: 'inv_' + i, amount: 1000 + i * 7, paid: i % 3 === 0, customer: { name: NAMES[i % NAMES.length], email: 'billing' + i + '@example.com' }, tags: ['eu', i % 2 ? 'b2b' : 'b2c'] })) });
    const ROWS = Array.from({ length: 200 }, (_, i) => ({ id: 'o' + i, customer: NAMES[i % NAMES.length], status: ['Active', 'Paused', 'Overdue'][i % 3], mrr: 400 + ((i * 37) % 900), seen: Date.now() - i * 60000 }));
    const FIELDS = [{ key: 'status', label: 'Status', type: 'select', options: [{ value: 'Active', label: 'Active' }, { value: 'Paused', label: 'Paused' }, { value: 'Overdue', label: 'Overdue' }] }, { key: 'mrr', label: 'MRR', type: 'number' }, { key: 'customer', label: 'Customer', type: 'text' }];
    const COLS = [{ key: 'customer', header: 'Customer', sortable: true }, { key: 'status', header: 'Status', render: (r) => h(UL.ULCellStatus, { value: r.status, tone: r.status === 'Active' ? 'success' : r.status === 'Overdue' ? 'danger' : 'neutral' }) }, { key: 'mrr', header: 'MRR', numeric: true, sortable: true, render: (r) => h(UL.ULCellCurrency || 'span', UL.ULCellCurrency ? { value: r.mrr, currency: 'EUR' } : null, UL.ULCellCurrency ? undefined : r.mrr) }, { key: 'seen', header: 'Last seen', render: (r) => h(UL.ULCellTime, { value: r.seen }) }];

    function InlineDemo() {
      const [v, setV] = useState({ name: 'Client portal', seats: 12, plan: 'pro', renew: new Date(Date.now() + 864e5 * 30) });
      const [fail, setFail] = useState(false), failRef = useRef(false); failRef.current = fail;
      const commit = (k) => async (x) => { await wait(500); if (failRef.current) throw new Error('Server rejected the change'); setV((s) => Object.assign({}, s, { [k]: x })); };
      const dl = (label, el) => h('div', { style: { display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', alignItems: 'center', gap: '8px' } }, h('span', { style: mono }, label), el);
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '520px' } },
        dl('Project', h(UL.ULInlineEdit, { label: 'Project name', value: v.name, onCommit: commit('name'), validate: (x) => (String(x || '').trim() ? null : 'Required'), contextMenu: [{ id: 'copy', label: 'Copy value' }] })),
        dl('Seats', h(UL.ULInlineEdit, { label: 'Seats', type: 'number', value: v.seats, onCommit: commit('seats'), validate: (x) => (x < 1 ? 'At least 1' : null) })),
        dl('Plan', h(UL.ULInlineEdit, { label: 'Plan', type: 'select', value: v.plan, options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'team', label: 'Team' }], onCommit: commit('plan') })),
        dl('Renews', h(UL.ULInlineEdit, { label: 'Renewal date', type: 'date', value: v.renew, onCommit: commit('renew') })),
        row(h('button', { type: 'button', 'aria-pressed': fail, className: 'ul-feed-chip', onClick: () => setFail(!fail) }, 'next save fails (rollback)')));
    }
    function NotifDemo({ active = true }) {
      const [items, setItems] = useState(() => [mkNotif(Date.now() - 6e5), mkNotif(Date.now() - 9e7), mkNotif(Date.now() - 2e8)].map((n, i) => Object.assign(n, { read: i > 0 })));
      const [live, setLive] = useState(true), [err, setErr] = useState(false);
      useEffect(() => { if (!live || !active) return; const t = setInterval(() => setItems((s) => [mkNotif()].concat(s).slice(0, 60)), 5000); return () => clearInterval(t); }, [live, active]);
      const menu = (it) => [{ id: 'r', label: it.read ? 'Mark as unread' : 'Mark as read', onSelect: () => setItems((s) => s.map((x) => (x.id === it.id ? Object.assign({}, x, { read: !x.read }) : x))) }, { id: 'd', label: 'Delete', destructive: true, onSelect: () => setItems((s) => s.filter((x) => x.id !== it.id)) }];
      return row(h(UL.ULNotificationCenter, { items: err ? [] : items, error: err ? 'Network error (503)' : undefined, onRetry: () => setErr(false), onReadChange: (id, r) => setItems((s) => s.map((x) => (x.id === id ? Object.assign({}, x, { read: r }) : x))), onMarkAllRead: () => setItems((s) => s.map((x) => Object.assign({}, x, { read: true }))), itemMenu: menu }),
        h('button', { type: 'button', className: 'ul-feed-chip', onClick: () => setItems((s) => [mkNotif()].concat(s)) }, 'add one'),
        h('button', { type: 'button', className: 'ul-feed-chip', 'aria-pressed': live, onClick: () => setLive(!live) }, 'live (every 5 s)'),
        h('button', { type: 'button', className: 'ul-feed-chip', 'aria-pressed': err, onClick: () => setErr(!err) }, 'error state'),
        h('button', { type: 'button', className: 'ul-feed-chip', onClick: () => setItems([]) }, 'empty'));
    }
    function FeedDemo({ active = true }) {
      const [ev, setEv] = useState(() => Array.from({ length: 14 }, (_, i) => mkEvent(Date.now() - i * 4.1e6)));
      const [live, setLive] = useState(true);
      useEffect(() => { if (!live || !active) return; const t = setInterval(() => setEv((s) => [mkEvent()].concat(s).slice(0, 400)), 3000); return () => clearInterval(t); }, [live, active]);
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '640px' } },
        row(h('button', { type: 'button', className: 'ul-feed-chip', 'aria-pressed': live, onClick: () => setLive(!live) }, 'live (every 3 s)')),
        h('div', { 'data-bench': 'feed' }, h(UL.ULActivityFeed, { events: ev, filters: FILTERS, pageSize: 20, onTargetClick: () => {}, contextMenu: [{ id: 'copy', label: 'Copy event ID' }, { id: 'actor', label: 'Filter by actor' }] })));
    }
    const KEY = (r) => r.id;
    function LiveFilterTable({ active = true }) {
      const ref = useRef(null);
      if (!ref.current) { const t = UL.mock({ rate: 20, generate: (q) => { const i = q % 200; return { op: 'patch', key: 'o' + i, value: { mrr: 400 + ((i * 37 + q * 13) % 900), seen: Date.now() } }; } }); ref.current = { t, s: UL.createLiveSource({ transport: t, idOf: (m) => 'p' + Math.random() }) }; }
      const store = UL.useLiveStore(ref.current.s, { key: (r) => r.id, autoStart: false, toOps: (m) => m, initial: ROWS });
      useEffect(() => { const s = ref.current.s; if (active) s.start(); else s.stop(); }, [active]); // live only while on screen
      useEffect(() => () => ref.current.s.stop(), []);
      const [filters, setFilters] = useState([{ id: 'f1', field: 'status', op: 'is', value: 'Active' }]);
      const count = UL.applyFilters(ROWS, filters).length; // only mrr / seen change live
      const flt = React.useCallback((r) => UL.applyFilters([r], filters).length > 0, [filters]);
      return h('div', { 'data-bench': 'livefilter', style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        h(UL.ULFilterBar, { fields: FIELDS, value: filters, onValueChange: setFilters, count }),
        h(UL.ULTable, { label: 'Live accounts', columns: COLS, store, rowKey: KEY, maxHeight: 420, filter: flt }));
    }
    let big = null; const BIG = () => (big ??= bigJson(2000));
    function Blocks2() {
      const L = window.ULDemos.Lazy;
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px', fontFamily: 'var(--ul-font-sans)' } },
        H3('Inline edit · text, number, select, date'), h(L, { label: 'inline', minHeight: 220 }, h(InlineDemo)),
        H3('Notification centre'), h(L, { label: 'notif', minHeight: 60, render: (on) => h(NotifDemo, { active: on }) }),
        H3('Activity feed'), h(L, { label: 'feed', minHeight: 600, render: (on) => h(FeedDemo, { active: on }) }),
        H3('Code block · curl / TypeScript'), h(L, { label: 'code', minHeight: 220 }, h('div', { style: { maxWidth: '720px' } }, h(UL.ULCodeBlock, { label: 'Create an invoice', samples: [{ value: 'curl', label: 'curl', language: 'bash', code: CURL }, { value: 'ts', label: 'TypeScript', language: 'ts', code: TS }], highlight: [4] }))),
        H3('JSON viewer · 2,000 items'), h(L, { label: 'json', minHeight: 320, render: () => h('div', { style: { maxWidth: '720px' } }, h(UL.ULJsonViewer, { data: BIG(), label: 'Response' })) }),
        H3('Live table + filter bar · 20 updates / s (mock transport, runs only while visible)'), h(L, { label: 'livefilter', minHeight: 500, render: (on) => h(LiveFilterTable, { active: on }) }));
    }

    /* ---------------- motion-test cards ---------------- */
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value });
    const result = (checks) => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'live rAF' });
    const stage = (...a) => window.ULDemos.__stage(...a);
    const vis = (sel) => [...document.querySelectorAll(sel)].filter((n) => n.style.visibility !== 'hidden' && n.getClientRects().length);
    const setInput = (el, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    async function inlineEditTest() {
      const checks = [], c = ck(checks); const log = []; let fail = false;
      function Fix() { const [v, setV] = useState('Client portal'); return h('div', null, h(UL.ULInlineEdit, { label: 'Name', value: v, onValueChange: (x) => { log.push(x); setV(x); }, onCommit: async () => { await wait(200); if (fail) throw new Error('nope'); } }), h('span', { 'data-t': 'after' }, 'after')); }
      const S = await stage(() => h(Fix), 520);
      const root = S.box.querySelector('.ul-ie'), after = S.box.querySelector('[data-t="after"]');
      const r0 = root.getBoundingClientRect(), a0 = after.getBoundingClientRect();
      S.box.querySelector('.ul-ie-display').click(); await raf(); await raf();
      const r1 = root.getBoundingClientRect(), a1 = after.getBoundingClientRect(), inp = S.box.querySelector('.ul-ie-input');
      c('box', 'display → edit: same box height and top, following content does not move vertically', Math.abs(r1.height - r0.height) < 0.5 && Math.abs(r1.top - r0.top) < 0.5 && Math.abs(a1.top - a0.top) < 0.5, `h ${r0.height}→${r1.height} · next y ${Math.round(a0.top)}→${Math.round(a1.top)}`);
      c('focusin', 'focus moves to the input (explicit focus call)', document.activeElement === inp, document.activeElement?.className || 'none');
      setInput(inp, 'Portal 2'); await raf(); key(inp, 'Enter'); await wait(60);
      const loading = !!S.box.querySelector('[aria-busy="true"]');
      await wait(2600);
      const disp = S.box.querySelector('.ul-ie-display');
      c('save', 'Enter saves: loading → success → back to display with the new value; focus returns to the display button', loading && !!disp && /Portal 2/.test(disp.textContent) && document.activeElement === disp, `busy ${loading} · ${disp ? disp.textContent : 'still editing'} · focus ${document.activeElement === disp}`);
      fail = true; log.length = 0; disp.click(); await raf(); await raf();
      const inp2 = S.box.querySelector('.ul-ie-input'); setInput(inp2, 'Broken'); await raf(); key(inp2, 'Enter'); await wait(900);
      c('rollback', 'failed save: optimistic value, then rollback; editor stays open on Retry', log.join('|') === 'Broken|Portal 2' && !!S.box.querySelector('.ul-ie-edit'), log.join(' → '));
      fail = false; key(S.box.querySelector('.ul-ie-input'), 'Escape'); await raf(); await raf();
      const d3 = S.box.querySelector('.ul-ie-display');
      c('esc', 'Esc cancels: display shows the committed value, focus back on it', !!d3 && /Portal 2/.test(d3.textContent) && document.activeElement === d3, d3 ? d3.textContent : 'still editing');
      await S.done(); return result(checks);
    }
    async function notifTest() {
      const checks = [], c = ck(checks); let set = null;
      function Fix() { const [it, s] = useState([mkNotif(Date.now() - 6e4), Object.assign(mkNotif(Date.now() - 9e7), { read: true })]); set = s; return h(UL.ULNotificationCenter, { items: it, onMarkAllRead: () => s((x) => x.map((n) => Object.assign({}, n, { read: true }))), onReadChange: () => {}, itemMenu: () => [{ id: 'a', label: 'Archive' }] }); }
      const S = await stage(() => h(Fix), 520);
      const bell = S.box.querySelector('.ul-ntf button'), ico = S.box.querySelector('.ul-ntf-ico');
      set((x) => [mkNotif()].concat(x)); await wait(80);
      const rang = ico.getAnimations().length > 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      set((x) => [mkNotif()].concat(x)); await wait(80);
      const twice = ico.getAnimations().length;
      c('ring', 'bell rings on a new unread item, rate limited (a second item right after: no new ring)', rang && twice <= 1, 'animations ' + twice);
      c('badge', 'unread count is a rolling number on the bell', !!S.box.querySelector('.ul-ntf-badge .ul-roll'), S.box.querySelector('.ul-ntf-badge')?.textContent.trim().slice(0, 6) || 'none');
      bell.click(); const t0 = performance.now(), sizes = new Set(); let pop = null;
      while (performance.now() - t0 < 700) { await raf(); pop = vis('.ul-anchored').find((n) => n.querySelector('.ul-ntf-panel')); if (pop) { const b = pop.getBoundingClientRect(); sizes.add(Math.round(b.width) + 'x' + Math.round(b.height)); } }
      c('open', 'popover pours out of the bell (anchored morph, intermediate sizes)', !!pop && sizes.size >= 4, sizes.size + ' sizes');
      const list = pop && pop.querySelector('.ul-ntf-list');
      const n0 = list ? list.querySelectorAll('.ul-ntf-item').length : 0;
      list && list.dispatchEvent(new PointerEvent('pointerenter')); await raf();
      set((x) => [mkNotif()].concat(x)); await wait(120);
      const held = list.querySelectorAll('.ul-ntf-item').length, pill = pop.querySelector('.ul-feed-pill');
      c('queue', 'pointer inside the list: the new item queues ("1 new" pill), nothing moves', held === n0 && !!pill, `items ${n0}→${held} · pill ${pill ? pill.textContent : 'none'}`);
      pill && pill.click(); await wait(80);
      c('apply', 'pill applies the queue (soft insert)', list.querySelectorAll('.ul-ntf-item').length === n0 + 1, list.querySelectorAll('.ul-ntf-item').length + ' items');
      list.dispatchEvent(new PointerEvent('pointerleave'));
      const it = list.querySelector('.ul-ntf-item'); const b = it.getBoundingClientRect();
      it.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.left + 20, clientY: b.top + 10 })); await wait(600);
      const cm = vis('.ul-menu-surface').length;
      c('ctx', 'right-click on an item opens the item menu (same items as its actions button)', cm > 0, cm + ' menu(s)');
      document.activeElement && key(document.activeElement, 'Escape'); await wait(500);
      [...pop.querySelectorAll('.ul-ntf-head button')].find((x) => /all/i.test(x.textContent))?.click(); await wait(400);
      c('allread', 'mark all as read clears the badge', !S.box.querySelector('.ul-ntf-badge'), S.box.querySelector('.ul-ntf-badge') ? 'badge still shown' : 'no badge');
      key(document.activeElement || document.body, 'Escape'); bell.click(); await wait(600);
      await S.done(); return result(checks);
    }
    async function feedTest() {
      const checks = [], c = ck(checks); let set = null;
      function Fix() { const [ev, s] = useState(() => Array.from({ length: 6 }, (_, i) => mkEvent(Date.now() - i * 3e6))); set = s; return h(UL.ULActivityFeed, { events: ev, filters: FILTERS }); }
      const S = await stage(() => h(Fix), 640);
      const items = () => S.box.querySelectorAll('.ul-feed-item').length;
      // known start: NOT interacting. The stage sits bottom-right; a parked real cursor there (launcher frame) fires a real
      // pointerenter and the feed rightly queues. Release it synthetically; if the real pointer is still over the list, say so.
      const list0 = S.box.querySelector('.ul-feed-list'), realHover = !!list0 && list0.matches(':hover');
      if (list0 && list0.contains(document.activeElement)) document.activeElement.blur();
      list0 && list0.dispatchEvent(new PointerEvent('pointerleave')); await raf();
      const env = (pass) => (pass || !realHover ? pass : null);
      const n0 = items(); set((x) => [mkEvent()].concat(x)); await wait(60);
      const anim = S.box.querySelector('.ul-feed-item')?.getAnimations().length || 0;
      c('insert', 'not interacting: a new event is inserted at once with the soft insert' + (realHover ? ' (NEEDS POINTER OFF THE STAGE: the real cursor is over the list)' : ''), env(items() === n0 + 1 && anim > 0), `${n0}→${items()} · ${anim} anims${realHover ? ' · real :hover' : ''}`);
      const list = S.box.querySelector('.ul-feed-list'); list.dispatchEvent(new PointerEvent('pointerenter')); await raf();
      set((x) => [mkEvent(), mkEvent()].concat(x)); await wait(60);
      const pill = S.box.querySelector('.ul-feed-pill');
      c('queue', 'pointer inside: new events queue behind an "N new events" pill', env(items() === n0 + 1 && !!pill && /2/.test(pill.textContent)), pill ? pill.textContent : 'no pill');
      list.dispatchEvent(new PointerEvent('pointerleave')); await wait(60);
      c('leave', 'leaving the list applies the queue', items() === n0 + 3 && !S.box.querySelector('.ul-feed-pill'), items() + ' items');
      const chip = [...S.box.querySelectorAll('.ul-feed-chip')].find((b) => b.textContent === 'Deploys'); chip.click(); await wait(60);
      const kinds = items();
      c('filter', 'filter chip: aria-pressed + only matching events', chip.getAttribute('aria-pressed') === 'true' && kinds > 0 && kinds < n0 + 3, kinds + ' shown');
      S.box.querySelector('.ul-feed-chip').click(); await wait(60);
      const det = [...S.box.querySelectorAll('.ul-feed-meta button[aria-expanded]')][0];
      det && det.click(); await wait(60);
      c('details', 'details expand (aria-expanded + controlled region)', !!det && det.getAttribute('aria-expanded') === 'true' && !document.getElementById(det.getAttribute('aria-controls')).hidden, det ? det.getAttribute('aria-expanded') : 'no details');
      await S.done(); return result(checks);
    }
    async function codeJsonTest() {
      const checks = [], c = ck(checks);
      const S = await stage(() => h('div', null, h(UL.ULCodeBlock, { samples: [{ value: 'curl', label: 'curl', language: 'bash', code: CURL }, { value: 'ts', label: 'TypeScript', language: 'ts', code: TS }], highlight: [2] }), h(UL.ULJsonViewer, { data: bigJson(2000), pageSize: 100 })), 720);
      const tabs = S.box.querySelectorAll('[role="tab"]');
      tabs[1].click(); await wait(500);
      c('tabs', 'language tabs (shared lens indicator): TypeScript selected, code switches', tabs[1].getAttribute('aria-selected') === 'true' && /import/.test(S.box.querySelector('.ul-code-pre:not([hidden])')?.textContent || S.box.querySelector('.ul-code').textContent), tabs[1].getAttribute('aria-selected'));
      const pre = [...S.box.querySelectorAll('.ul-code-pre')].find((p) => p.getClientRects().length);
      c('tokens', 'tokenizer: keywords, strings, comments; one highlighted line; line numbers not selectable', pre.querySelectorAll('.ul-tk-kw').length > 2 && pre.querySelectorAll('.ul-tk-str').length > 0 && pre.querySelectorAll('.ul-tk-com').length === 1 && pre.querySelectorAll('[data-hl]').length === 1 && getComputedStyle(pre.querySelector('.ul-code-ln')).userSelect === 'none', `kw ${pre.querySelectorAll('.ul-tk-kw').length} · str ${pre.querySelectorAll('.ul-tk-str').length}`);
      S.box.querySelector('.ul-code-tools [aria-pressed]').click(); await raf();
      c('wrap', 'wrap toggle (aria-pressed)', !!S.box.querySelector('.ul-code-pre[data-wrap]'), 'wrap ' + !!S.box.querySelector('.ul-code-pre[data-wrap]'));
      const tree = S.box.querySelector('[role="tree"]'), rows = () => tree.querySelectorAll('[role="treeitem"]');
      c('lazy', 'JSON 2,000 items: collapsed by default, children rendered lazily', rows().length < 20, rows().length + ' rows');
      const first = rows()[0]; first.focus(); key(tree, 'ArrowDown'); await raf(); await raf(); key(tree, 'ArrowDown'); await raf(); await raf();
      const items = tree.querySelector('[aria-selected="true"]'); key(tree, 'ArrowRight'); await raf(); await raf();
      const after = rows().length;
      c('keys', 'keyboard: ↓ moves, → expands (100 rows + "Show more"), ← collapses', items && /items/.test(items.textContent) && after > 100 && after < 110, `${after} rows after →`);
      key(tree, 'ArrowLeft'); await raf();
      const search = S.box.querySelector('.ul-json-search'); setInput(search, 'inv_1999'); await wait(100);
      c('search', 'search finds a deep value and opens its path', !!tree.querySelector('[data-hit]') && /1/.test(S.box.querySelector('.ul-json-count').textContent), S.box.querySelector('.ul-json-count').textContent);
      await S.done(); return result(checks);
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Blocks2, inlineEditTest, notifTest, feedTest, codeJsonTest });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
