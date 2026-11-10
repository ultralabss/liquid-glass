// Motion-test cards (part 2): context menu, pointer-inclusive glass stability, drill-in at 375px, KPI states, live source,
// live table, data glass levels, toast above modal. Uses window.ULDemos.__stage from demos-2g.js. Live rAF clock.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value });
    const result = (checks, driver = 'live rAF') => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver });
    const stage = (...a) => window.ULDemos.__stage(...a);
    const fireCtx = (el, x, y) => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }); el.dispatchEvent(e); return e.defaultPrevented; };
    const ctxMenus = () => [...document.querySelectorAll('.ul-context-menu')].filter((n) => n.style.visibility !== 'hidden' && n.getClientRects().length && !n.hasAttribute('inert'));
    const escKey = () => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const settled = async (ms = 700) => { await wait(ms); for (let i = 0; i < 40 && document.querySelector('[data-ul-morphing]'); i++) await wait(50); };

    /* ---------- context menu ---------- */
    async function ctxMenuTest() {
      const checks = [], c = ck(checks);
      const ROWS = Array.from({ length: 30 }, (_, i) => ({ id: 'R' + String(i + 1).padStart(2, '0'), name: 'Row ' + (i + 1), v: i * 10 }));
      const ITEMS = (r) => [{ id: 'open', label: 'Open ' + r.id }, { id: 'sub', label: 'Export', items: [{ id: 'csv', label: 'CSV' }] }, { type: 'separator' }, { id: 'del', label: 'Delete', destructive: true }];
      let last = null, opened = 0, closed = 0, storeRef = null;
      function Fix() {
        const store = UL.useLiveStore(null, { key: (r) => r.id, initial: ROWS }); storeRef = store;
        const [sel, setSel] = React.useState(['R03', 'R04']);
        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          h(UL.ULTable, { label: 'ctx fixture', columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'v', header: 'Value', numeric: true }], store, rowKey: (r) => r.id, selectable: true, selected: sel, onSelectionChange: setSel, maxHeight: 260,
            rowMenu: ITEMS, contextMenuHeader: [{ id: 'hide', label: 'Hide column' }], onContextMenuOpen: (t) => { last = t; opened++; }, onContextMenuClose: () => { closed++; } }),
          h(UL.ULContextTarget, { contextMenu: [{ id: 'x', label: 'X' }], contextMenuNative: 'on-editable' }, h('div', { 'data-t': 'native' }, h('input', { 'aria-label': 'native', defaultValue: 'text' }))),
          h(UL.ULContextTarget, { contextMenu: () => null }, h('div', { 'data-t': 'empty', style: { padding: '8px' } }, 'null menu')));
      }
      const S = await stage(() => h(Fix), 640);
      const row = (k) => S.box.querySelector('tbody tr[data-key="' + k + '"]');
      let r = row('R01').getBoundingClientRect(); const px = r.left + 120, py = r.top + 12;
      fireCtx(row('R01').querySelector('td[data-col]'), px, py); await settled();
      const m = ctxMenus()[0], mb = m && m.getBoundingClientRect();
      c('point', 'opens at the pointer (0 × 0 anchor, ±6px)', !!m && Math.abs(mb.left - px) <= 6 && Math.abs(mb.top - py) <= 6, m ? 'offset ' + Math.round(mb.left - px) + ',' + Math.round(mb.top - py) : 'no menu');
      c('row', 'unselected row → only that row; shown active; selection unchanged', !!last && last.kind === 'row' && last.id === 'R01' && last.selection.join() === 'R01' && row('R01').hasAttribute('data-ctx-active') && !row('R01').hasAttribute('data-selected'), last ? last.id + ' / ' + last.selection.join() : 'none');
      const ctxItems = m ? [...m.querySelectorAll('[role^=menuitem]')].map((x) => x.textContent.trim()) : [];
      escKey(); await settled();
      c('focus', 'focus returns to the row cell on close', !!document.activeElement && row('R01').contains(document.activeElement), document.activeElement && document.activeElement.tagName);
      row('R01').querySelector('.ul-row-act').click(); await settled();
      const actItems = [...document.querySelectorAll('.ul-menu-surface')].filter((n) => n.style.visibility !== 'hidden' && n.getClientRects().length && !n.classList.contains('ul-context-menu')).flatMap((n) => [...n.querySelectorAll('[role^=menuitem]')].map((x) => x.textContent.trim()));
      escKey(); await settled();
      c('shared', 'rowMenu feeds the ⋯ button and right-click (same items)', ctxItems.length > 0 && ctxItems.join('|') === actItems.join('|'), ctxItems.join(', ') + ' | ' + actItems.join(', '));
      r = row('R03').getBoundingClientRect(); fireCtx(row('R03').querySelector('td[data-col]'), r.left + 80, r.top + 10); await settled();
      c('selection', 'selected row → targets the whole selection', !!last && last.selection.join() === 'R03,R04', last && last.selection.join());
      storeRef.remove('R03'); storeRef.upsert({ id: 'R00', name: 'new', v: -1 }); storeRef.patch('R04', { v: 999 }); storeRef.flush(); await wait(150);
      const pinned = !!row('R03'), patched = !!row('R04') && row('R04').textContent.includes('999'), pill = S.box.querySelector('.ul-live-pill');
      c('pinned', 'menu open: target row pinned, value updates in place', pinned && patched, 'row kept ' + pinned + ' · patched ' + patched);
      c('queued', 'structural changes queue (N new updates pill)', !!pill, pill ? pill.textContent.trim() : 'no pill');
      escKey(); await settled(900);
      const cell = row('R02').querySelector('td[data-col]'); cell.focus();
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settled();
      const k1 = ctxMenus().length > 0 && last.id === 'R02'; escKey(); await settled();
      cell.focus(); cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true })); await settled();
      const k2 = ctxMenus().length > 0 && last.id === 'R02'; escKey(); await settled();
      c('keys', 'ContextMenu key and Shift+F10 open at the focused row', k1 && k2, 'ContextMenu ' + k1 + ' · Shift+F10 ' + k2);
      const th = S.box.querySelector('thead th[data-colkey]'), hb = th.getBoundingClientRect(); fireCtx(th, hb.left + 10, hb.top + 10); await settled();
      c('header', 'header cell target (contextMenuHeader)', !!last && last.kind === 'header' && last.column === 'id', last && last.kind + ' ' + last.column); escKey(); await settled();
      const inp = S.box.querySelector('[data-t="native"] input'), ib = inp.getBoundingClientRect();
      const prevented = fireCtx(inp, ib.left + 5, ib.top + 5), nullPrevented = fireCtx(S.box.querySelector('[data-t="empty"]'), ib.left + 5, ib.bottom + 20); await wait(200);
      c('native', 'native menu kept on editable fields and when the callback returns null', !prevented && !nullPrevented && ctxMenus().length === 0, 'input prevented ' + prevented + ' · null prevented ' + nullPrevented);
      const t5 = row('R05').querySelector('td[data-col]'), b5 = t5.getBoundingClientRect(), wrapEl = t5.closest('.ul-table-wrap');
      const pev = (type, x, y) => wrapEl.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', clientX: x, clientY: y, pointerId: 7 }));
      t5.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: b5.left + 20, clientY: b5.top + 8, pointerId: 7 })); await wait(650); await settled(300);
      const lp = ctxMenus().length > 0 && last.id === 'R05'; escKey(); await settled();
      t5.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: b5.left + 20, clientY: b5.top + 8, pointerId: 7 })); await wait(100); pev('pointermove', b5.left + 60, b5.top + 40);
      await wait(600); const lpMoved = ctxMenus().length; pev('pointerup', b5.left + 60, b5.top + 40);
      c('longpress', 'long-press ~500ms opens; movement cancels', lp && lpMoved === 0, 'opened ' + lp + ' · after move ' + lpMoved);
      let inside = 0;
      for (const [x, y] of [[innerWidth - 4, 60], [40, innerHeight - 4], [innerWidth - 4, innerHeight - 4]]) { fireCtx(row('R06').querySelector('td[data-col]'), x, y); await settled(); const mm = ctxMenus()[0]; if (mm) { const b = mm.getBoundingClientRect(); if (b.left >= -0.5 && b.top >= -0.5 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5) inside++; } escKey(); await settled(); }
      c('flip', 'flips / shifts inside the viewport (right edge, bottom edge, corner)', inside === 3, inside + '/3 inside at ' + innerWidth + '×' + innerHeight + ' (other sizes: run on viewport-tests)');
      const o0 = opened;
      for (let i = 0; i < 30; i++) { const rr = row('R07').getBoundingClientRect(); fireCtx(row('R07').querySelector('td[data-col]'), rr.left + 30 + i, rr.top + 10); await wait(70); escKey(); await wait(50); }
      await settled(1200);
      const left = [...document.querySelectorAll('.ul-context-menu')].filter((n) => n.style.visibility !== 'hidden' && n.getClientRects().length).length;
      c('leftover', '30 open / close cycles: no leftover surfaces', left === 0 && opened - o0 >= 30, left + ' visible · opened ' + (opened - o0));
      await S.done();
      return result(checks);
    }

    /* ---------- glass stability with a pointer ---------- */
    async function pointerGlassTest() {
      const checks = [], c = ck(checks);
      const surfaces = () => [...document.querySelectorAll('.ul-glass')].filter((n) => !n.parentElement.closest('.ul-glass') && n.getClientRects().length);
      const snap = () => new Map(surfaces().map((n) => { const cs = getComputedStyle(n); return [n, [n.dataset.ulMode, n.style.getPropertyValue('--ul-glass-filter'), cs.getPropertyValue('--ul-accent').trim(), cs.backdropFilter].join('|')]; }));
      const list = surfaces(); if (!list.length) return result([{ key: 'none', label: 'glass on screen', pass: false, value: 'none' }]);
      const sc = document.scrollingElement, y0 = sc.scrollTop;
      const under = new Set(); // surfaces that were under the pointer (their own tier may promote; every other surface must not change)
      const move = (x, y) => { const t = document.elementFromPoint(x, y) || document.body; for (let n = t; n; n = n.parentElement) if (n.classList && n.classList.contains('ul-glass')) under.add(n); t.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse' })); };
      const pts = list.slice(0, 20).map((n) => { const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }).filter(([x, y]) => x > 0 && y > 0 && x < innerWidth && y < innerHeight);
      // (i) cursor path across the surfaces, 3s: per frame at most one surface written
      const before = snap();
      UL.startGlassRecorder();
      const t0 = performance.now(); let i = 0;
      while (performance.now() - t0 < 3000 && pts.length > 1) { const [x, y] = pts[i % pts.length], [x2, y2] = pts[(i + 1) % pts.length]; for (let k = 0; k < 8; k++) { move(x + (x2 - x) * k / 8, y + (y2 - y) * k / 8); await raf(); } i++; }
      const r1 = UL.stopGlassRecorder();
      // (ii) wheel steps with the cursor parked over glass, (iii) both: NO surface written while scrolling (idle decisions are allowed after ~150ms)
      const [px, py] = pts[0] || [innerWidth / 2, innerHeight / 2];
      UL.startGlassRecorder(); let lastScroll = 0;
      for (const step of [1, 3, 20]) for (let k = 0; k < 20; k++) { sc.scrollTop += step; lastScroll = performance.now(); move(px, py); await raf(); }
      for (let k = 0; k < 30; k++) { sc.scrollTop += k % 2 ? 6 : -6; lastScroll = performance.now(); move(px + k * 3, py); await raf(); }
      const r2 = UL.stopGlassRecorder();
      sc.scrollTop = y0; await wait(500);
      const after = snap();
      let changed = 0, changedUnder = 0; before.forEach((v, n) => { if (after.has(n) && after.get(n) !== v) { if (under.has(n)) changedUnder++; else changed++; } });
      const during = r2.perFrame.filter((f) => f.t <= lastScroll + 150 && f.n > 0); // scroll + the 150ms idle window
      const top = (r) => Object.entries(r.props).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + '×' + v).join(', ') || 'none';
      const over4 = r1.perFrame.filter((f) => f.n > 4).length;
      c('path', '(i) cursor path: ≤ 4 surfaces written per frame (nearest within the light radius, one batch)', over4 === 0, over4 + ' frames over 4 of ' + r1.frames + ' · max ' + r1.maxSurfaces + ' / frame · ' + top(r1));
      c('scroll', '(ii)+(iii) wheel with the cursor parked over glass: no surface written while scrolling and 150ms after', during.length === 0, during.length + ' frames with writes during scroll · ' + top(r2));
      c('state', 'no tier / filter / accent / backdrop-filter change on any surface that was not under the pointer', changed === 0, changed + ' of ' + before.size + ' changed · under the pointer (allowed): ' + changedUnder);
      c('defs', 'filter definitions untouched', r1.defFrames + r2.defFrames === 0, (r1.defFrames + r2.defFrames) + ' frames with filter-def writes');
      c('anims', 'no animation on a glass surface or its pseudo-elements (spinner excluded)', r1.animFrames + r2.animFrames === 0, (r1.animFrames + r2.animFrames) + ' frames');
      c('p95', 'frame time p95 (synthetic pointer: :hover CSS is not exercised; owner runs ?glassdebug → Record pointer)', null, r1.p95 + ' / ' + r2.p95 + 'ms');
      return result(checks);
    }

    /* ---------- drill-in at 375 px (iframe) ---------- */
    async function drillTest() {
      const checks = [], c = ck(checks);
      const base = new URL('../', location.href).href;
      const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:12px;bottom:12px;width:375px;height:667px;z-index:60;border:0;border-radius:12px;background:#0b0d12';
      f.srcdoc = '<!doctype html><html data-ul-theme="app"><head><link rel="stylesheet" href="' + base + 'tokens/tokens.css"><style>html,body{margin:0;background:#0b0d12;color:#fff;font-family:system-ui}</style>'
        + '<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></scr' + 'ipt><script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></scr' + 'ipt><script src="' + base + 'dist/ul-glass.js"></scr' + 'ipt></head><body data-ul-accent="violet"><div id="r" style="padding:20px"></div></body></html>';
      document.body.appendChild(f);
      for (let i = 0; i < 120 && !(f.contentWindow && f.contentWindow.UL); i++) await wait(100);
      const W = f.contentWindow, D = W && W.document;
      if (!W || !W.UL) { f.remove(); return result([{ key: 'load', label: 'iframe loads the bundle', pass: false, value: 'timeout' }]); }
      const items = [{ id: 'a', label: 'Open' }, { id: 'share', label: 'Share', items: [{ id: 'mail', label: 'Mail' }, { id: 'more', label: 'More', items: [{ id: 'x', label: 'Deep' }] }] }, { id: 'c', label: 'Rename' }];
      W.ReactDOM.createRoot(D.getElementById('r')).render(W.React.createElement(W.UL.ULMenuButton, { items, label: 'Actions' }, 'Actions'));
      await wait(500);
      const raf2 = () => new Promise((r) => W.requestAnimationFrame(r));
      const menus = () => [...D.querySelectorAll('.ul-menu-surface')].filter((n) => n.style.visibility !== 'hidden' && n.getClientRects().length);
      const shown = (t) => [...D.querySelectorAll('[role^=menuitem]')].some((n) => n.textContent.trim().startsWith(t) && n.getClientRects().length && !n.closest('[hidden],[inert]'));
      const key = (k) => (D.activeElement || D.body).dispatchEvent(new W.KeyboardEvent('keydown', { key: k, bubbles: true }));
      D.querySelector('.ul-menu-trigger').click(); await wait(800);
      const share = [...D.querySelectorAll('[role=menuitem]')].find((n) => n.textContent.includes('Share')); share && share.focus(); key('ArrowRight');
      const S = []; for (let i = 0; i < 45; i++) { await raf2(); S.push(menus().length); }
      await wait(300);
      const back = [...D.querySelectorAll('.ul-menu-back')].find((n) => n.getClientRects().length && !n.closest('[hidden],[inert]'));
      c('one', 'drill-in stays on ONE surface every frame', S.every((n) => n === 1), 'surfaces per frame max ' + Math.max(...S));
      c('back', 'back row at level 2, level 1 items hidden', !!back && shown('Mail') && !shown('Rename'), back ? back.textContent.trim() : 'no back row');
      const more = [...D.querySelectorAll('[role=menuitem]')].find((n) => n.textContent.trim().startsWith('More') && n.getClientRects().length); more && more.focus(); key('ArrowRight'); await wait(800);
      const deep = shown('Deep');
      key('ArrowLeft'); await wait(800); const up1 = menus().length === 1 && shown('Mail') && !shown('Deep');
      key('Escape'); await wait(800); const up2 = menus().length === 1 && shown('Rename');
      key('Escape'); await wait(800); const closed = menus().length === 0;
      c('keys', 'level 3 → ← level 2 → Esc level 1 → Esc closes', deep && up1 && up2 && closed, 'deep ' + deep + ' · ← ' + up1 + ' · Esc ' + up2 + ' · closed ' + closed);
      c('vp', 'viewport (iframe)', null, W.innerWidth + '×' + W.innerHeight);
      f.remove();
      return result(checks);
    }

    /* ---------- KPI states + variants ---------- */
    async function kpiStatesTest() {
      const checks = [], c = ck(checks);
      const S = await stage(() => h(UL.ULKpiGrid, { label: 'states' },
        ...['simple', 'sparkline', 'progress', 'comparison', 'target'].map((v) => h(UL.ULKpiCard, { key: v, variant: v, label: v, value: 640, sparkline: [1, 3, 2, 5, 4], progress: { value: 64 }, previous: 600, target: 800, delta: 3 })),
        h(UL.ULKpiCard, { key: 'l', label: 'loading', state: 'loading' }), h(UL.ULKpiCard, { key: 'e', label: 'empty', state: 'empty', emptyText: 'No data' }),
        h(UL.ULKpiCard, { key: 'x', label: 'error', state: 'error', onRetry: () => {} }), h(UL.ULKpiCard, { key: 's', label: 'stale', value: 1, updatedAt: Date.now() - 60000, staleAfter: 30000 }),
        h(UL.ULKpiCard, { key: 'v', label: 'live', value: 2, live: true, updatedAt: Date.now() }), h(UL.ULKpiCard, { key: 'hero', size: 'hero', label: 'hero', value: 9 })), 900);
      await wait(1200);
      const card = (l) => [...S.box.querySelectorAll('.ul-kpi')].find((n) => (n.querySelector('.ul-kpi-label') || {}).textContent === l);
      const tr = (v) => { const k = card(v); return !!k && !!k.querySelector('.ul-spark, .ul-kpi-prog, .ul-kpi-footer, .ul-kpi-trend'); };
      c('variants', 'variants render their trend / footer slot', ['sparkline', 'progress', 'comparison', 'target'].every(tr), ['sparkline', 'progress', 'comparison', 'target'].map((v) => v + ' ' + tr(v)).join(' · '));
      const L = card('loading'), E = card('empty'), X = card('error'), St = card('stale'), Lv = card('live'), H = card('hero'), Sm = card('simple');
      c('loading', 'loading: skeleton + aria-busy', !!L && !!L.querySelector('.ul-skel') && L.getAttribute('aria-busy') === 'true', '');
      c('empty', 'empty: text, no number', !!E && E.textContent.includes('No data') && !E.querySelector('.ul-roll-reel'), '');
      c('error', 'error: message + retry button', !!X && !!X.querySelector('.ul-kpi-retry'), '');
      c('stale', 'stale badge after staleAfter', !!St && /stale/i.test(St.textContent), St ? St.textContent.slice(0, 40) : '');
      c('live', 'live dot', !!Lv && !!Lv.querySelector('.ul-kpi-live-dot'), '');
      c('hero', 'hero spans two columns when there is room', !!H && !!Sm && H.getBoundingClientRect().width > Sm.getBoundingClientRect().width * 1.5, H ? Math.round(H.getBoundingClientRect().width) + 'px' : '');
      await S.done();
      return result(checks);
    }

    /* ---------- live source ---------- */
    async function liveSourceTest() {
      const checks = [], c = ck(checks);
      const t1 = UL.mock({ rate: 0, generate: (q) => ({ q }), failConnects: 3 });
      const s1 = UL.createLiveSource({ transport: t1, reconnect: { base: 40, max: 300 }, heartbeat: false });
      const waits = []; s1.onStatus((st, i) => { if (i && i.retryIn != null) waits.push([i.attempt, i.retryIn]); }); s1.start();
      for (let i = 0; i < 60 && s1.status !== 'live'; i++) await wait(50);
      c('backoff', 'reconnect: exponential backoff, full jitter (0 ≤ wait ≤ min(max, base·2^n))', s1.status === 'live' && waits.length >= 3 && waits.every(([a, w]) => w >= 0 && w <= Math.min(300, 40 * 2 ** (a - 1))), waits.map((x) => x.join(':')).join(' ') + ' → ' + s1.status);
      s1.stop();
      const t2 = UL.mock({ rate: 0, generate: () => ({}), silent: true });
      const s2 = UL.createLiveSource({ transport: t2, heartbeat: { interval: 80, timeout: 80 }, reconnect: { base: 1000, max: 1000 } }); const st2 = []; s2.onStatus((s) => st2.push(s)); s2.start();
      await wait(500); c('heartbeat', 'heartbeat timeout → reconnecting', st2.includes('reconnecting'), st2.join(' → ')); s2.stop();
      const t3 = UL.mock({ rate: 0, generate: (q) => ({ id: 'm' + q }) }); const got = [];
      const s3 = UL.createLiveSource({ transport: t3, heartbeat: false, idOf: (m) => m.id, seqOf: (m) => (m.k ? { key: m.k, seq: m.seq } : undefined), schema: (m) => typeof m === 'object' && !!m && !m.bad, maxMessageBytes: 200 });
      s3.subscribe((b) => got.push(...b)); s3.start(); await wait(150);
      const inj = (o) => t3.controls.inject(JSON.stringify(o));
      inj({ id: 'a1', k: 'a', seq: 5 }); inj({ id: 'a1', k: 'a', seq: 5 }); inj({ id: 'a2', k: 'a', seq: 3 }); inj({ id: 'a3', bad: true }); inj({ id: 'a4', pad: 'x'.repeat(400) });
      await wait(80);
      const st = s3.stats;
      c('dedupe', 'duplicates and out-of-order messages dropped', st.duplicates === 1 && st.outOfOrder === 1 && got.length === 1, 'dup ' + st.duplicates + ' · out of order ' + st.outOfOrder + ' · delivered ' + got.length);
      c('schema', 'schema rejection + message size limit', st.rejected === 1 && st.oversized === 1, 'rejected ' + st.rejected + ' · oversized ' + st.oversized);
      s3.stop();
      const t4 = UL.mock({ rate: 0, generate: (q) => ({ key: 'k' + (q % 5), q }) }); const got4 = [];
      const s4 = UL.createLiveSource({ transport: t4, heartbeat: false, rateLimit: { max: 20, policy: 'coalesce', key: (m) => m.key } }); s4.subscribe((b) => got4.push(...b)); s4.start(); await wait(150);
      t4.controls.burst(200); await wait(150);
      c('rate', 'rate limit with backpressure: coalesced per key, bounded delivery', got4.length <= 30 && s4.stats.coalesced > 100, 'delivered ' + got4.length + ' · coalesced ' + s4.stats.coalesced);
      s4.stop();
      const t5 = UL.mock({ rate: 0, generate: (q) => ({ q }) }); const s5 = UL.createLiveSource({ transport: t5, heartbeat: false, bufferCap: 50 }); let d5 = 0; s5.subscribe((b) => { d5 += b.length; }); s5.start(); await wait(150);
      s5.pause(); t5.controls.burst(300); await wait(80); const buf = s5.stats.buffered, bmax = s5.stats.bufferMax; s5.resume(); await wait(100);
      c('buffer', 'paused / tab hidden: buffered with a cap, flushed on resume', buf <= 50 && bmax <= 50 && d5 === 50, 'buffered ' + buf + ' (max ' + bmax + ') · delivered after resume ' + d5);
      s5.stop();
      let wsOut = false, tok = false, local = true;
      try { UL.checkLiveUrl('ws://example.com/feed', 'ws'); } catch (e) { wsOut = true; }
      try { UL.checkLiveUrl('wss://example.com/feed?token=abc', 'ws'); } catch (e) { tok = true; }
      try { UL.checkLiveUrl('ws://localhost:8080/feed', 'ws'); } catch (e) { local = false; }
      c('urls', 'ws:// refused outside localhost, allowed on localhost; no token in the URL', wsOut && tok && local, 'remote ws refused ' + wsOut + ' · token refused ' + tok + ' · localhost ok ' + local);
      return result(checks);
    }

    /* ---------- live table ---------- */
    async function liveTableTest() {
      const checks = [], c = ck(checks);
      let store = null;
      const ROWS = Array.from({ length: 20 }, (_, i) => ({ id: 'L' + String(i + 1).padStart(2, '0'), v: i }));
      function Fix() { store = UL.useLiveStore(null, { key: (r) => r.id, initial: ROWS }); return h(UL.ULTable, { label: 'live fixture', columns: [{ key: 'id', header: 'ID', sortable: true }, { key: 'v', header: 'V', numeric: true, sortable: true }], store, rowKey: (r) => r.id, selectable: true, maxHeight: 300, rowMenu: () => [{ id: 'a', label: 'A' }], defaultSort: { key: 'v', dir: 'asc' } }); }
      const S = await stage(() => h(Fix), 520);
      const keys = () => [...S.box.querySelectorAll('tbody tr[data-key]:not([data-exiting])')].map((n) => n.dataset.key);
      const scroller = S.box.querySelector('.ul-table-scroll');
      store.upsert({ id: 'L00', v: -1 }); store.patch('L05', { v: 55 }); store.remove('L10'); store.flush(); await wait(700);
      const k1 = keys();
      c('ops', 'insert, update, remove + reorder apply when idle', k1[0] === 'L00' && !k1.includes('L10') && k1.indexOf('L05') > k1.indexOf('L20'), k1.slice(0, 3).join(',') + ' · L05 at ' + k1.indexOf('L05'));
      scroller.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); await wait(50);
      const cb = S.box.querySelector('tbody tr[data-key="L03"] input'); cb && cb.click();
      const cell = S.box.querySelector('tbody tr[data-key="L04"] td[data-col]'); cell.focus(); scroller.scrollTop = 40; const st0 = scroller.scrollTop;
      const before = keys().join();
      store.upsert({ id: 'L99', v: -5 }); store.remove('L02'); store.patch('L06', { v: 66 }); store.flush(); await wait(400);
      const pill = S.box.querySelector('.ul-live-pill');
      c('hold', 'hovered / focused: no row moves; values update in place', keys().join() === before && S.box.querySelector('tbody tr[data-key="L06"]').textContent.includes('66'), keys().slice(0, 4).join(','));
      c('pill', '"N new updates" pill', !!pill, pill ? pill.textContent.trim() : 'none');
      c('keep', 'focus, selection and scroll position preserved', document.activeElement === cell && !!S.box.querySelector('tbody tr[data-key="L03"][data-selected]') && Math.abs(scroller.scrollTop - st0) <= 1, 'focus ' + (document.activeElement === cell) + ' · scroll ' + scroller.scrollTop + '/' + st0);
      if (pill) { pill.querySelector('button').click(); await wait(800); }
      c('apply', 'the pill applies the queue', keys()[0] === 'L99' && !keys().includes('L02'), keys().slice(0, 3).join(','));
      store.pause(); const v0 = store.version; store.patch('L07', { v: 777 }); await wait(120); const held = store.version === v0; store.resume(); await wait(120);
      c('pause', 'pause holds commits, resume applies', held && store.version > v0, 'held ' + held);
      const live = S.box.querySelector('[aria-live="polite"]'); let changes = 0; const mo = new MutationObserver(() => changes++); if (live) mo.observe(live, { childList: true, characterData: true, subtree: true });
      scroller.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: document.body })); cell.blur();
      for (let i = 0; i < 10; i++) { store.upsert({ id: 'N' + i, v: 100 + i }); store.flush(); await wait(100); }
      await wait(300); mo.disconnect();
      c('announce', 'announcements summarized + throttled (≤ 1 per --ul-live-announce-gap)', changes <= 1, changes + ' announcement(s) in 1.3s');
      await S.done();
      return result(checks);
    }

    /* ---------- data glass levels + contrast ---------- */
    async function dataGlassTest() {
      const checks = [], c = ck(checks);
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
      const parse = (col) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = col; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 }; };
      const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
      const lum = (q) => { const l = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * l(q.r) + 0.7152 * l(q.g) + 0.0722 * l(q.b); };
      const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const S = await stage(() => h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
        h('div', { 'data-lvl': 'rich' }, h(UL.ULKpiCard, { label: 'Revenue', value: 1234, delta: 3.2 })), h('div', { 'data-lvl': 'subtle', 'data-ul-data-glass': 'subtle' }, h(UL.ULKpiCard, { label: 'Revenue', value: 1234, delta: -3.2 }))), 600);
      await wait(1200);
      const backingA = (lvl) => { const pnl = S.box.querySelector('[data-lvl="' + lvl + '"] .ul-data-panel'), pr = document.createElement('span'); pr.style.cssText = 'position:absolute;width:1px;height:1px;background:var(--ul-glass-backing)'; pnl.appendChild(pr); const v = parse(getComputedStyle(pr).backgroundColor); pr.remove(); return v; };
      const ar = backingA('rich').a, as = backingA('subtle').a;
      c('levels', 'basic (subtle) backs more than rich', as > ar, 'α rich ' + ar.toFixed(2) + ' · subtle ' + as.toFixed(2));
      let worst = 99, who = '';
      for (const th of ['app', 'marketing']) for (const ac of ['ice', 'violet', 'emerald', 'amber', 'rose']) {
        S.box.setAttribute('data-ul-theme', th); S.box.setAttribute('data-ul-accent', ac); await wait(700);
        for (const lvl of ['rich', 'subtle']) {
          const bk = backingA(lvl);
          for (const bd of [{ r: 0.1, g: 0.1, b: 0.14, a: 1 }, { r: 0.48, g: 0.48, b: 0.48, a: 1 }]) {
            const surf = over(bk, bd);
            for (const sel of ['.ul-kpi-label', '.ul-kpi-value', '.ul-kpi-delta-cap', '.ul-kpi-delta-ctx']) {
              const el = S.box.querySelector('[data-lvl="' + lvl + '"] ' + sel); if (!el) continue; const cs = getComputedStyle(el); let b = surf;
              const imgs = cs.backgroundImage.match(/(rgba?|oklab|oklch|color)\([^()]*(\([^()]*\)[^()]*)*\)/g) || []; [parse(cs.backgroundColor)].concat(imgs.map(parse)).forEach((l) => { b = over(l, b); });
              const v = cr(over(parse(cs.color), b), b); if (v < worst) { worst = v; who = th + '/' + ac + '/' + lvl + ' ' + sel; }
            }
          }
        }
      }
      c('contrast', 'data text ≥ 4.5:1 (2 themes × 5 accents × basic / rich × dark / mid backdrop)', worst >= 4.5, 'worst ' + worst.toFixed(2) + ' (' + who + ')');
      await S.done();
      return result(checks);
    }

    /* ---------- toast above modal + modal backing ease ---------- */
    async function toastModalTest() {
      const checks = [], c = ck(checks);
      let setOpen = null, api = null;
      function Inner() { api = UL.useToast(); return null; }
      function Fix() {
        const [open, so] = React.useState(false); setOpen = so;
        const trig = React.useRef(null);
        return h(UL.ULToastProvider, null, h(Inner), h('button', { ref: trig, type: 'button' }, 'trigger'),
          h(UL.ULModal, { open, onOpenChange: so, triggerRef: trig, title: 'Modal' }, h('button', { type: 'button', 'data-t': 'inmodal' }, 'inside')));
      }
      const S = await stage(() => h(Fix), 320);
      const tid = api.toast({ title: 'Saved', tone: 'danger', duration: 60000 }); await settled(900);
      setOpen(true);
      const samples = []; const t0 = performance.now();
      while (performance.now() - t0 < 1600) { await raf(); const s = [...document.querySelectorAll('.ul-anchored[data-ul-covered-anchor]')].find((n) => n.style.visibility !== 'hidden'); if (s) samples.push(parseFloat(getComputedStyle(s).getPropertyValue('--ul-lite'))); }
      await settled(400);
      const modal = [...document.querySelectorAll('.ul-anchored[data-ul-covered-anchor]')].find((n) => n.style.visibility !== 'hidden');
      const toast = [...document.querySelectorAll('.ul-toast-stack .ul-anchored')].find((n) => n.style.visibility !== 'hidden' && n.getClientRects().length && !n.closest('[inert]'));
      c('focus', 'modal open: focus inside the modal, never in the toast', !!modal && modal.contains(document.activeElement) && !(toast && toast.contains(document.activeElement)), document.activeElement && document.activeElement.tagName);
      if (toast) { const b = toast.getBoundingClientRect(), at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); c('above', 'toast above the modal scrim (hit-testable, not dimmed)', toast.contains(at), at ? String(at.className).slice(0, 30) : 'null'); }
      else c('above', 'toast visible', false, 'no toast');
      const ib = modal && modal.querySelector('[data-t="inmodal"]'); if (ib) { const b = ib.getBoundingClientRect(); c('clicks', 'modal clicks not blocked by the toast layer', ib.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)), ''); }
      setOpen(false); await settled(900);
      const tb = toast && toast.querySelector('button'); let kept = null;
      if (tb) { tb.focus(); const d = document.createElement('div'); document.body.appendChild(d); UL.toTopLayer(d); await wait(60); kept = document.activeElement === tb; try { d.hidePopover(); } catch (e) { /* */ } d.remove(); }
      c('repromote', 're-promotion keeps focus inside the toast', kept === true, String(kept));
      const lite = samples.filter((x) => Number.isFinite(x)), cs = getComputedStyle(document.documentElement);
      const eased = lite.length > 2 && lite[0] >= 0.99 && lite[lite.length - 1] <= 0.01;
      c('backing', 'modal backing eases ' + cs.getPropertyValue('--ul-modal-covered-backing').trim() + ' → ' + cs.getPropertyValue('--ul-modal-glass-backing').trim() + ' once refraction is ready (dark backdrop 5.71:1 app / 4.98:1 marketing)', eased ? true : null, lite.length ? '--ul-lite ' + lite[0].toFixed(2) + ' → ' + lite[lite.length - 1].toFixed(2) + ' over ' + lite.length + ' frames' : 'n/a (blur-only)');
      api.dismiss(tid); await settled(700); await S.done();
      return result(checks);
    }

    /* ---------- nested menus, 3 levels (hover into level 3 keeps 1 + 2 open; close order; Esc = deepest only) ---------- */
    async function nestedMenuTest() {
      const checks = [], c = ck(checks);
      const ITEMS = [{ id: 'copy', label: 'Copy' }, { id: 'more', label: 'More', items: [{ id: 'share', label: 'Share' }, { id: 'export', label: 'Export', items: [{ id: 'pdf', label: 'PDF' }, { id: 'png', label: 'PNG' }, { id: 'svg', label: 'SVG' }] }, { id: 'archive', label: 'Archive' }] }, { id: 'del', label: 'Delete' }];
      let setO = null;
      function Fix() { const [o, s] = React.useState(false), r = React.useRef(null); setO = s; return h(React.Fragment, null, h('button', { ref: r, type: 'button', onClick: () => s(!o) }, 'Actions'), h(UL.ULMenu, { open: o, onOpenChange: s, anchorRef: r, items: ITEMS, label: 'N1' })); }
      const S = await stage(() => h(Fix), 420);
      const surfs = () => [...document.querySelectorAll('.ul-anchored[role="menu"]')].filter((s) => !s.hasAttribute('data-closing') && s.getClientRects().length);
      const open = () => surfs().map((s) => s.getAttribute('aria-label'));
      const surf = (l) => surfs().find((s) => s.getAttribute('aria-label') === l);
      const item = (l, t) => { const s = surf(l); return s && [...s.querySelectorAll('[data-active-level] [data-menu-item]')].find((n) => n.dataset.text === t); };
      const until = async (f, ms = 2500) => { const t0 = performance.now(); while (!f() && performance.now() - t0 < ms) await wait(40); return f(); };
      const mid = (el, fx = 0.5) => { if (!el) return { x: -1, y: -1 }; const r = el.getBoundingClientRect(); return { x: r.left + r.width * fx, y: r.top + r.height / 2 }; };
      const mv = (p) => (document.elementFromPoint(p.x, p.y) || document.body).dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, pointerType: 'mouse', pointerId: 1, isPrimary: true }));
      const glide = async (a, b, n = 4) => { for (let i = 0; i <= n; i++) { mv({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }); await raf(); } };
      const key = (k) => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      try {
        setO(true); await until(() => item('N1', 'More')); await settled(300);
        await glide(mid(item('N1', 'Copy')), mid(item('N1', 'More')), 2);
        await until(() => item('More', 'Export')); await settled(300);
        if (item('More', 'Export')) { await glide(mid(item('N1', 'More'), 0.9), mid(item('More', 'Share'), 0.3), 3); await glide(mid(item('More', 'Share'), 0.3), mid(item('More', 'Export')), 2); }
        const got3 = await until(() => item('Export', 'PDF'));
        if (got3) await settled(300); // aim at the settled level 3 (mid-morph its rows still sit over level 2)
        c('open3', 'hover opens level 1 → 2 → 3', got3 && open().length === 3, open().join(' › '));
        if (got3) {
          await glide(mid(item('More', 'Export'), 0.9), mid(item('Export', 'PDF'), 0.3), 3);
          await wait(450); // a user resting on level 3 (longer than the safe-triangle window), then moving inside it
          await glide(mid(item('Export', 'PDF')), mid(item('Export', 'SVG')), 4);
          await wait(600);
          c('hold', 'pointer inside level 3, +600 ms: all 3 menus stay open', open().length === 3, open().join(' › '));
          // leave: back to a plain row of level 1 → levels 3 and 2 close (deepest first or together), level 1 stays
          const seen = {}, t0 = performance.now(), at0 = open().length; let rec = true;
          const stamp = () => { const o = open(), t = performance.now() - t0; ['Export', 'More'].forEach((l) => { if (seen[l] == null && !o.includes(l)) seen[l] = t; }); return o; };
          (function loop() { if (!rec) return; stamp(); requestAnimationFrame(loop); })();
          await glide(mid(item('Export', 'SVG')), mid(item('N1', 'Copy')), 6);
          await until(() => stamp().length === 1); rec = false;
          c('leave', 'leaving to a level-1 row closes level 3 then level 2 (3 ≤ 2), level 1 stays open', at0 === 3 && seen.Export != null && seen.More != null && seen.Export <= seen.More && open().join() === 'N1', `${at0} open at start · level 3 at ${seen.Export == null ? '–' : seen.Export.toFixed(0)} ms, level 2 at ${seen.More == null ? '–' : seen.More.toFixed(0)} ms · open ${open().join(' › ')}`);
        }
        // keys: → → reach level 3, Esc closes only the deepest level, focus back on its item
        if (!surf('N1')) { setO(true); await until(() => item('N1', 'More')); await settled(300); }
        item('N1', 'More')?.focus(); key('ArrowRight'); await until(() => document.activeElement && document.activeElement.dataset.text === 'Share');
        key('ArrowDown'); key('ArrowRight'); await until(() => document.activeElement && document.activeElement.dataset.text === 'PDF');
        key('ArrowDown'); await raf();
        c('keys', '→ / ↓ reach level 3; ↓ inside level 3 stays in level 3', open().length === 3 && document.activeElement?.dataset.text === 'PNG', `${open().join(' › ')} · focus ${document.activeElement && document.activeElement.dataset.text}`);
        key('Escape'); await until(() => open().length === 2); await until(() => document.activeElement && document.activeElement.dataset.text === 'Export', 800);
        c('esc', 'Esc closes only the deepest level; focus back on its parent row', open().length === 2 && document.activeElement?.dataset.text === 'Export', `${open().join(' › ')} · focus ${document.activeElement && document.activeElement.dataset.text}`);
        key('Escape'); await until(() => open().length === 1);
        c('esc2', 'Esc again closes level 2 only', open().join() === 'N1', open().join(' › '));
      } finally { setO && setO(false); await settled(); await S.done(); }
      return result(checks, 'live rAF · synthetic pointer (mouse) + keys');
    }

    window.ULDemos = Object.assign(window.ULDemos || {}, { nestedMenuTest, ctxMenuTest, pointerGlassTest, drillTest, kpiStatesTest, liveSourceTest, liveTableTest, dataGlassTest, toastModalTest });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
