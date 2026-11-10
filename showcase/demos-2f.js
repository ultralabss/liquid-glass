// 2f tests: leftover surfaces (every overlay + row actions in a 200-row table), nested menu gap, covered modal surfaces,
// scroll frame invariance. Result shape = thumb-harness ({ status, checks: [{ key, label, pass, value }], driver }).
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), raf = () => new Promise((r) => requestAnimationFrame(r));
    const key = (el, k) => el && el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const vis = (n) => n && n.style.visibility !== 'hidden' && n.getClientRects().length > 0;
    const surfaces = () => [...document.querySelectorAll('.ul-anchored')].filter(vis);
    const result = (checks, extra) => Object.assign({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'live rAF (document timeline)' }, extra);
    const until = async (fn, ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await wait(40); } return fn(); };
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    /* ---------- fixture: 200-row table with row actions (scroll container) ---------- */
    const ROWS = Array.from({ length: 200 }, (_, i) => ({ id: 'INV-' + String(1000 + i), client: ['Atlas', 'Borealis', 'Cobalt', 'Delta'][i % 4], amount: 120 + ((i * 37) % 900) }));
    const COLS = [{ key: 'id', header: 'Invoice', sortable: true }, { key: 'client', header: 'Client', sortable: true }, { key: 'amount', header: 'Amount', numeric: true, align: 'end', sortable: true }];
    const ACTIONS = () => [{ id: 'open', label: 'Open' }, { id: 'dup', label: 'Duplicate' }, { type: 'separator' }, { id: 'del', label: 'Delete', destructive: true }];
    function TableFixture() {
      return h('div', { 'data-case': 'table200', style: { width: '520px', maxWidth: '100%' } }, h(UL.ULTable, { label: 'Invoices (200)', columns: COLS, rows: ROWS, rowKey: (r) => r.id, rowActions: ACTIONS, maxHeight: 320, density: 'compact' }));
    }

    /* ---------- A: leftover surfaces ---------- */
    const leftovers = () => {
      const s = surfaces().length, goo = [...document.querySelectorAll('.ul-morph-goo')].length, scrim = [...document.querySelectorAll('.ul-scrim')].length;
      const lock = document.documentElement.hasAttribute('data-ul-scroll-locked');
      const inert = [...document.body.children].filter((n) => n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true').filter((n) => !n.hasAttribute('data-ul-glass-defs') && !n.matches('svg,[data-ul-virtual-anchor]')).length;
      const mounted = document.querySelectorAll('.ul-anchored').length;
      return { s, goo, scrim, lock, inert, mounted };
    };
    async function cycleCase(c, n, minH) {
      let tooSmall = 0, worstH = Infinity, frames = 0, running = true;
      const watch = (async () => { while (running) { await raf(); frames++; for (const s of surfaces()) { if (s.hasAttribute('data-ul-morphing')) continue; const r = s.getBoundingClientRect(); worstH = Math.min(worstH, r.height); if (r.height < minH) tooSmall++; } } })();
      for (let i = 0; i < n; i++) {
        const kind = i % 6, gap = 10 + Math.round(rnd() * (kind === 0 ? 70 : 520));
        if (kind === 1) { c.open(); await wait(10 + rnd() * 70); c.close(); }               // 10–80ms toggle
        else if (kind === 2) { c.open(); c.open(); await wait(gap); c.close(); c.close(); } // double click
        else if (kind === 3) { c.open(); await wait(120 + rnd() * 200); key(document.activeElement || document.body, 'Escape'); }
        else if (kind === 4 && c.scroll) { c.open(); await wait(60 + rnd() * 150); c.scroll(); await wait(80); c.close(); }
        else { c.open(); await wait(gap); c.close(); }
        await wait(10 + rnd() * 120);
      }
      for (let k = 0; k < 4 && surfaces().length; k++) { c.close(); key(document.activeElement || document.body, 'Escape'); await wait(250); }
      await until(() => leftovers().mounted === 0 && !document.documentElement.hasAttribute('data-ul-scroll-locked'), 2500);
      running = false; await watch;
      const L = leftovers();
      return { L, tooSmall, worstH: worstH === Infinity ? null : worstH, frames };
    }
    async function leftoverTest(only) {
      const q = (s) => document.querySelector(s), M2 = window.__mt2c, M2e = window.__mt2e;
      const clickT = (sel) => { let want = false; return { open: () => { const t = q(sel); if (t && t.getAttribute('aria-expanded') !== 'true') t.click(); }, close: () => { const t = q(sel); if (t && t.getAttribute('aria-expanded') === 'true') t.click(); } }; };
      const set = (k) => ({ open: () => M2 && M2.set(k, true), close: () => M2 && M2.set(k, false) });
      const row = () => { const sc = q('[data-case="table200"] .ul-table-scroll'), b = [...(sc ? sc.querySelectorAll('.ul-row-act') : [])]; return { sc, b: b.find((x) => { const r = x.getBoundingClientRect(), R = sc.getBoundingClientRect(); return r.top > R.top + 40 && r.bottom < R.bottom - 10; }) }; };
      const cases = [
        ['Row actions (200-row table)', { open: () => { const { b } = row(); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }, close: () => { const b = q('[data-case="table200"] .ul-row-act[aria-expanded="true"]'); if (b) b.click(); }, scroll: () => { const { sc } = row(); if (sc) sc.scrollTop += 37; } }],
        ['ULSelect', clickT('[data-case="select"] .ul-select-trigger')], ['ULDatePicker', clickT('[data-case="date"] [aria-haspopup="dialog"]')], ['ULColorPicker', clickT('[data-case="color"] [aria-haspopup="dialog"]')],
        ['ULDateRangePicker', clickT('[data-case="range"] .ul-range-open')], ['ULSplitButton menu', clickT('[data-case="split"] [aria-haspopup="menu"]')],
        ['ULModal', set('modal')], ['ULSheet', set('sheet')], ['ULDrawer', set('dr')], ['ULPopover', set('pop')], ['ULToast', set('toast')], ['ULMenu', set('menu')], ['ULCommandPalette', set('cmd')],
        ['ULMenu (radio)', { open: () => M2e && M2e.set('menu', true), close: () => M2e && M2e.set('menu', false) }],
      ].filter(([n]) => !only || only.includes(n));
      const checks = [];
      for (const [name, c] of cases) {
        const r = await cycleCase(c, 30, 24);
        const L = r.L, ok = L.mounted === 0 && L.goo === 0 && L.scrim === 0 && !L.lock && L.inert === 0 && r.tooSmall === 0;
        checks.push({ key: name, label: `${name}: 30 cycles (10–80ms toggles, double clicks, Esc mid-animation${c.scroll ? ', scroll mid-animation' : ''}) → nothing left`, pass: ok,
          value: `surfaces ${L.mounted} · goo ${L.goo} · scrim ${L.scrim} · lock ${L.lock} · inert ${L.inert} · settled frames < 24px: ${r.tooSmall} (min ${r.worstH == null ? '–' : r.worstH.toFixed(0)}px)` });
      }
      return result(checks);
    }

    /* ---------- C: nested menus beside the parent with --ul-submenu-gap ---------- */
    async function submenuTest() {
      const M2 = window.__mt2c, checks = [];
      if (!M2) return result([{ key: 'fx', label: '2c fixtures', pass: false, value: 'missing' }]);
      const gapTok = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ul-submenu-gap')) || 2;
      const menus = () => [...document.querySelectorAll('.ul-menu-surface')].filter(vis);
      const itemOf = (surf, text) => [...surf.querySelectorAll('[data-menu-item]')].find((n) => n.dataset.text === text);
      const measure = (parent, trig, child) => {
        const P = parent.getBoundingClientRect(), C = child.getBoundingClientRect(), T = trig.getBoundingClientRect(), side = child.dataset.side;
        const gap = side === 'left' ? P.left - C.right : C.left - P.right;
        const overlap = Math.max(0, Math.min(P.right, C.right) - Math.max(P.left, C.left)) > 0.5 && Math.max(0, Math.min(P.bottom, C.bottom) - Math.max(P.top, C.top)) > 0.5;
        const first = child.querySelector('[data-menu-item]'), dy = first ? first.getBoundingClientRect().top - T.top : NaN;
        const inside = C.left >= -0.5 && C.right <= innerWidth + 0.5 && C.top >= -0.5 && C.bottom <= innerHeight + 0.5;
        return { gap, overlap, dy, side, inside };
      };
      const openLevels = async () => {
        M2.set('menu', true); await until(() => menus().length >= 1 && !menus()[0].hasAttribute('data-ul-morphing'), 1500); await wait(80);
        const m1 = menus()[0], share = itemOf(m1, 'Share'); share.focus(); key(share, 'ArrowRight');
        const shown = (surf, t) => { const n = itemOf(surf, t); return !!n && n.getClientRects().length > 0 && !n.closest('[hidden],[inert]'); };
        await until(() => (menus().length >= 2 && !menus()[1].hasAttribute('data-ul-morphing')) || (menus().length === 1 && shown(m1, 'More') && !m1.hasAttribute('data-ul-morphing')), 1500); await wait(80);
        if (menus().length === 1) { // phones: same-surface drill-in (viewSwap), no second surface
          const backRow = [...m1.querySelectorAll('.ul-menu-back')].some((n) => n.getClientRects().length && !n.closest('[hidden],[inert]'));
          const lvl2 = shown(m1, 'More') && !shown(m1, 'Share');
          const mo = itemOf(m1, 'More'); mo.focus(); key(mo, 'ArrowRight'); await wait(700);
          const one = menus().length === 1;
          key(document.activeElement, 'ArrowLeft'); await wait(700); const back2 = shown(m1, 'More');
          key(document.activeElement, 'Escape'); await wait(700); const back1 = menus().length === 1 && shown(m1, 'Share');
          return { drill: true, m1, backRow, lvl2, one, back2, back1 };
        }
        const m2 = menus()[1], more = itemOf(m2, 'More'); more.focus(); key(more, 'ArrowRight');
        await until(() => menus().length >= 3 && !menus()[2].hasAttribute('data-ul-morphing'), 1500); await wait(80);
        return { m1, share, m2, more, m3: menus()[2] };
      };
      const L = await openLevels();
      if (L.drill) {
        checks.push({ key: 'drill', label: 'no room beside the parent (narrow viewport): drill-in on the SAME surface, back row, level 2 replaces level 1', pass: L.backRow && L.lvl2 && L.one, value: 'back row ' + L.backRow + ' · level 2 ' + L.lvl2 + ' · one surface ' + L.one });
        checks.push({ key: 'keys', label: 'ArrowLeft / Esc go up one level', pass: L.back2 && L.back1, value: '← level 2 ' + L.back2 + ' · Esc level 1 ' + L.back1 });
        for (let i = 0; i < 3 && menus().length; i++) { key(document.activeElement || document.body, 'Escape'); await wait(500); }
        M2.set('menu', false); await wait(500);
        return result(checks);
      }
      if (!L.m3) { checks.push({ key: 'levels', label: 'three levels open', pass: false, value: menus().length + ' menus' }); }
      else {
        const a = measure(L.m1, L.share, L.m2), b = measure(L.m2, L.more, L.m3);
        if (L.m2.dataset.nest === 'cover') { checks.push({ key: 'drill', label: 'no room beside the parent (narrow viewport): drill-in over the parent, top on the trigger row, inside the viewport', pass: Math.abs(a.dy) <= 1 && a.inside && b.inside, value: `nest ${L.m2.dataset.nest} / ${L.m3.dataset.nest} · row Δ ${a.dy.toFixed(1)} · inside ${a.inside}` }); }
        else for (const [n, r] of [['level 2', a], ['level 3', b]]) checks.push({ key: n, label: `${n}: beside the parent, gap = ${gapTok}px ±0.5, no overlap, first row aligned with the trigger row, inside the viewport`, pass: Math.abs(r.gap - gapTok) <= 0.5 && !r.overlap && Math.abs(r.dy) <= 1 && r.inside, value: `side ${r.side} · gap ${r.gap.toFixed(2)}px · overlap ${r.overlap} · row Δ ${r.dy.toFixed(2)}px · inside ${r.inside}` });
        const ri = (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius);
        checks.push({ key: 'radius', label: 'corner radius: same surface radius on every level, rows follow the item radius rule', pass: ri(L.m1) === ri(L.m2) && ri(L.m2) === ri(L.m3), value: `${ri(L.m1)} / ${ri(L.m2)} / ${ri(L.m3)}px · rows ${parseFloat(getComputedStyle(L.m3.querySelector('[data-menu-item]')).borderTopLeftRadius)}px` });
        // cross the gap: from the trigger row diagonally into level 2 (pointermove events every frame); level 2 must stay
        const T = L.share.getBoundingClientRect(), C = L.m2.getBoundingClientRect(), x0 = T.right - 20, y0 = T.top + T.height / 2, x1 = C.left + 30, y1 = C.top + C.height * 0.8;
        let closed = false;
        for (let i = 0; i <= 14; i++) {
          const x = x0 + (x1 - x0) * i / 14, y = y0 + (y1 - y0) * i / 14, el = document.elementFromPoint(x, y) || document.body;
          el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse' }));
          await raf(); if (!vis(L.m2)) closed = true;
        }
        await wait(300); if (!vis(L.m2)) closed = true;
        const gx = (a.side === 'left' ? L.m1.getBoundingClientRect().left - 1 : L.m1.getBoundingClientRect().right + 1), gy = T.top + T.height / 2, inGap = document.elementFromPoint(gx, gy);
        const drill = L.m2.dataset.nest === 'cover';
        checks.push({ key: 'cross', label: drill ? 'drill-in: pointer path from the trigger into the submenu never closes it (no gap)' : 'crossing the 2px gap diagonally never closes the submenu (hover bridge + safe triangle)', pass: !closed && (drill || (!!inGap && !!inGap.closest('.ul-menu-surface'))), value: `closed ${closed} · gap point hits ${inGap ? (inGap.closest('.ul-menu-surface') ? 'a menu surface (bridge)' : inGap.nodeName) : 'nothing'}` });
        // moving to another parent item closes level 2 (normal exit)
        const dup = itemOf(L.m1, 'Duplicate'), D = dup.getBoundingClientRect();
        for (let i = 0; i < 3; i++) { dup.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: D.left + 20, clientY: D.top + 10, pointerType: 'mouse' })); await raf(); }
        await wait(700);
        checks.push({ key: 'other', label: 'moving to another parent item closes the submenu (normal exit)', pass: menus().length === 1, value: menus().length + ' menus open' });
        // keyboard: ArrowLeft closes one level
        M2.set('menu', false); await wait(700);
      }
      // flip + shift: context menu opened near the right / bottom edge
      const ctx = document.querySelector('[data-case="ctx"]');
      if (ctx) {
        const fire = (x, y) => ctx.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
        fire(innerWidth - 240, Math.min(innerHeight - 40, 200)); await until(() => menus().length >= 1 && !menus()[0].hasAttribute('data-ul-morphing'), 1500); await wait(100);
        const m1 = menus()[0], share = m1 && itemOf(m1, 'Share');
        if (share) { share.focus(); key(share, 'ArrowRight'); await until(() => menus().length >= 2 && !menus()[1].hasAttribute('data-ul-morphing'), 1500); await wait(80); }
        const m2 = menus()[1];
        if (m2 && m2.dataset.nest === 'cover') checks.push({ key: 'flip', label: 'flip case (narrow: drill-in instead)', pass: measure(m1, share, m2).inside, value: 'drill-in' });
        else if (m2) { const r = measure(m1, share, m2); checks.push({ key: 'flip', label: 'no room on the right: flips to the left, still 2px, inside the viewport (shifted if needed)', pass: r.side === 'left' && Math.abs(r.gap - gapTok) <= 0.5 && !r.overlap && r.inside, value: `side ${r.side} · gap ${r.gap.toFixed(2)}px · inside ${r.inside} · row Δ ${r.dy.toFixed(1)}px` }); }
        else checks.push({ key: 'flip', label: 'flip case', pass: false, value: 'submenu did not open' });
        key(document.activeElement, 'Escape'); await wait(300); key(document.activeElement, 'Escape'); await wait(700);
      }
      checks.push({ key: 'sizes', label: 'three viewport sizes (1280×800, 924×540, 375×667)', pass: null, value: 'viewport-tests.dc.html runs this card in each frame' });
      checks.push({ key: 'glass', label: 'submenu material: full glass (overlay priority), its own rim + shadow; 2px of backdrop between the two rims', pass: null, value: 'decision (DESIGN.md)' });
      return result(checks);
    }

    /* ---------- D: modal overlays always cover their trigger ---------- */
    async function coveredTest(label) {
      const M2 = window.__mt2c, checks = [];
      if (!M2) return result([{ key: 'fx', label: '2c fixtures', pass: false, value: 'missing' }]);
      const only = (location.search.match(/[?&]only=([\w,]+)/) || [])[1];
      const cases = [['ULModal', 'modal'], ['alert dialog', 'alert'], ['ULSheet', 'sheet'], ['ULDrawer right', 'dr'], ['ULDrawer left', 'dl'], ['ULCommandPalette', 'cmd']].filter(([, k]) => !only || only.split(',').includes(k));
      const runs = (location.search.match(/[?&]modes=([\w,]+)/) || [])[1]?.split(',') || ['cold', 'warm', 'interrupt'];
      // popover calls during a run (test-only spy, restored at the end)
      const P = HTMLElement.prototype, calls = [], os = P.showPopover, oh = P.hidePopover, tag = (n) => String(n.className || n.tagName).split(' ').filter((c) => c !== 'ul-glass').slice(0, 2).join('.');
      if (os) { P.showPopover = function () { calls.push('show ' + tag(this)); return os.call(this); }; P.hidePopover = function () { calls.push('hide ' + tag(this)); return oh.call(this); }; }
      const desc = (n, trig) => !n ? 'none' : n === trig || trig.contains(n) ? 'TRIGGER' : tag(n.closest('.ul-anchored, .ul-scrim, .ul-morph-goo, [popover]') || n);
      const zchain = (n) => { const out = []; for (let x = n; x && x !== document.documentElement && out.length < 6; x = x.parentElement) { const c = getComputedStyle(x); if (c.zIndex !== 'auto' || c.transform !== 'none' || c.isolation === 'isolate' || c.willChange.includes('transform') || c.position === 'sticky' || x.matches('[popover]')) out.push(tag(x) + '(z ' + c.zIndex + (c.transform !== 'none' ? ' tf' : '') + (c.isolation === 'isolate' ? ' iso' : '') + ')'); } return out.join(' < ') || 'root'; };
      const R = (r) => [r.left, r.top, r.width, r.height].map(Math.round).join(',');
      try {
        for (const [name, k] of cases) {
          const trig = document.querySelector(`[data-case="${k}"] button`); if (!trig) { checks.push({ key: name, label: name + ' fixture', pass: false, value: 'missing' }); continue; }
          const edge = k === 'dr' || k === 'dl';
          for (const run of runs) {
            const tb = trig.getBoundingClientRect(), pts = [[tb.left + tb.width / 2, tb.top + tb.height / 2], [tb.left + 2, tb.top + 2], [tb.right - 2, tb.top + 2], [tb.left + 2, tb.bottom - 2], [tb.right - 2, tb.bottom - 2]];
            let frames = 0, hitTrig = 0, notCovered = 0, transparent = 0, notTop = 0, first = '', fail = '';
            calls.length = 0;
            const t0 = performance.now(); let prev = t0;
            M2.set(k, true);
            let phase = 'open';
            while (performance.now() - t0 < (run === 'interrupt' ? 1400 : 700)) {
              const ft = await raf(); frames++;
              const dt = Math.round(ft - prev); prev = ft;
              const hits = pts.map(([x, y]) => document.elementFromPoint(x, y));
              const hitNow = hits.some((e) => e && (e === trig || trig.contains(e)));
              if (hitNow) hitTrig++;
              const s = [...document.querySelectorAll('.ul-anchored[data-ul-covered-anchor]')].find(vis);
              let bad = hitNow ? 'trigger hit' : '';
              if (s) {
                const r = s.getBoundingClientRect(), tn = trig.getBoundingClientRect();
                if (!first && !edge) { // first frame with a surface: it must sit on the trigger
                  const ix = Math.max(0, Math.min(r.right, tn.right) - Math.max(r.left, tn.left)) * Math.max(0, Math.min(r.bottom, tn.bottom) - Math.max(r.top, tn.top));
                  if (ix < 0.5 * tn.width * tn.height) { notCovered++; bad = bad || 'not on trigger'; }
                  first = `overlap ${Math.round((100 * ix) / (tn.width * tn.height))} % @ frame ${frames} (dt ${dt}ms)`;
                } else if (!first) first = `edge strip @ frame ${frames}`;
                const cs = getComputedStyle(s);
                if (cs.backgroundImage === 'none' || parseFloat(cs.opacity) < 0.01) { transparent++; bad = bad || 'transparent'; }
                if ('showPopover' in P && !s.matches(':popover-open')) { notTop++; bad = bad || 'not in top layer'; }
                if (bad && !fail) fail = `first fail frame ${frames} (${Math.round(ft - t0)}ms, dt ${dt}ms, ${phase}): ${bad} · centre→${desc(hits[0], trig)} corners→${hits.slice(1).map((e) => desc(e, trig)).join('/')} · trigger ${R(tn)} [${zchain(trig)}] · surface ${R(r)} [${zchain(s)}] lite ${cs.getPropertyValue('--ul-lite').trim() || '-'} · top layer: ${[...document.querySelectorAll(':popover-open, dialog[open]')].map(tag).join(' > ')} · popover calls: ${calls.join('; ') || 'none'}`;
              } else if (bad && !fail) fail = `first fail frame ${frames} (${Math.round(ft - t0)}ms, dt ${dt}ms, ${phase}): ${bad} before any surface · popover calls: ${calls.join('; ') || 'none'}`;
              if (run === 'interrupt') {
                const el = performance.now() - t0;
                if (phase === 'open' && el > 200) { M2.set(k, false); phase = 'closing'; }
                else if (phase === 'closing' && el > 300) { M2.set(k, true); phase = 'reopen'; }
              }
            }
            M2.set(k, false); await until(() => !document.querySelector('.ul-anchored[data-ul-covered-anchor]'), 1500); await wait(150);
            checks.push({ key: name + ' ' + run, label: `${name} · ${run}: trigger never hit-testable (centre + 4 corners), surface starts on it then scrim / surface above it every frame, opaque base, top layer`, pass: hitTrig === 0 && notCovered === 0 && transparent === 0 && notTop === 0,
              value: `${frames} frames · trigger hit ${hitTrig} · not covering ${notCovered}${edge ? ' (edge drawer: n/a)' : ''} · transparent ${transparent} · not in top layer ${notTop} · first ${first}${fail ? ' · ' + fail : ''}` });
          }
        }
      } finally { if (os) { P.showPopover = os; P.hidePopover = oh; } }
      checks.push({ key: 'nested', label: 'overlays opened from inside a dialog stay above it (top layer, opened later)', pass: null, value: 'dialog card (push / select inside)' });
      return result(checks);
    }

    /* ---------- B: scroll frame invariance on this page ---------- */
    async function scrollInvariance() {
      if (!window.ULGlassScrollTest) return result([{ key: 'h', label: 'glass-scroll-harness.js loaded', pass: false, value: 'missing' }]);
      const r = await window.ULGlassScrollTest.run({ steps: [1, 3, 20], ms: 2000 });
      const checks = Object.entries(r.steps).map(([k, v]) => ({ key: k, label: `${k} steps for 2s: zero glass state changes + zero filter / surface mutations (${r.surfaces} surfaces)`, pass: v.changes === 0 && v.mutations === 0, value: `changes ${v.changes} · mutations ${v.mutations} · avg ${v.avg}ms · p95 ${v.p95}ms · worst ${v.worst}ms · long ${v.long}${v.examples.length ? ' · ' + v.examples.slice(0, 2).join(' ; ') : ''}` }));
      checks.push({ key: 'pages', label: 'Showcase, Components (Containers), landing × 5 accents × 2 themes', pass: null, value: 'DESIGN.md "Scroll freeze" (run with ULGlassScrollTest on each page)' });
      return result(checks, { driver: r.mode });
    }

    window.ULDemos = Object.assign(window.ULDemos || {}, { TableFixture, leftoverTest, submenuTest, coveredTest, scrollInvariance });
    window.dispatchEvent(new Event('ul:demos-2f'));
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
