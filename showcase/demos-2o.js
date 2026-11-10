// Task 2F: permanent layout guard cards (motion-test + viewport-tests). Composes window.UL only; mock data.
// layoutoverflow · iconsize · ctrltext · coveredanchor. Every card returns { status, checks, driver }.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement, { useState } = React;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value });
    const result = (checks) => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'live rAF' });
    const stage = (...a) => window.ULDemos.__stage(...a);
    const vis = (sel) => [...document.querySelectorAll(sel)].filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
    const esc = () => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    const settle = async (ms = 700) => { await wait(ms); await raf(); await raf(); };
    const NAMES = ['Jana Novak', 'Tomas Kral', 'Lea Wagner'];
    let seq = 0;
    const notif = (over) => Object.assign({ id: 'g' + seq++, title: 'Invoice INV-' + (2000 + seq) + ' paid by accounts-payable-department@very-long-client-domain.example', body: 'A long body that has to wrap inside the popover instead of widening it: https://example.test/a/really/long/path/without/spaces', time: Date.now() - seq * 6e5, read: seq % 2 === 0, tone: 'accent' }, over);
    const EXCLUDE = '[data-ul-allow-overflow], .ul-tooltip, .ul-pop-arrow, .ul-btn-hit, .ul-btn-ring, .ul-act-ring, .ul-morph-goo, .ul-sr-only';

    /** Max px any descendant's border box sticks out of the container's inner (padding-box) rect. Vertical only outside inner scrollers. */
    function overflowOf(box, xOnly) {
      const r = box.getBoundingClientRect(), cs = getComputedStyle(box);
      const L = r.left + parseFloat(cs.borderLeftWidth), R = r.right - parseFloat(cs.borderRightWidth), T = r.top + parseFloat(cs.borderTopWidth), B = r.bottom - parseFloat(cs.borderBottomWidth);
      let worst = 0, who = '';
      box.querySelectorAll('*').forEach((n) => {
        if (n.closest(EXCLUDE)) return;
        const st = getComputedStyle(n); if (st.position === 'fixed' || st.display === 'contents') return;
        const b = n.getBoundingClientRect(); if (!b.width && !b.height) return;
        let scroller = n.parentElement; while (scroller && scroller !== box && !/(auto|scroll|hidden|clip)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
        const inScroller = scroller && scroller !== box;
        const o = Math.max(L - b.left, b.right - R, inScroller || xOnly ? 0 : T - b.top, inScroller || xOnly ? 0 : b.bottom - B);
        if (o > worst) { worst = o; who = (n.getAttribute('class') || n.tagName).toString().split(' ')[0]; }
      });
      return { px: Math.round(worst * 10) / 10, who };
    }
    const surfaces = () => vis('.ul-anchored').filter((n) => !n.hasAttribute('data-ul-morphing'));

    /* ---------- fixtures ---------- */
    function Fixture({ api }) {
      const [items, setItems] = useState(() => [notif(), notif(), notif({ body: undefined })]);
      const [err, setErr] = useState(false), [modal, setModal] = useState(false), [drawer, setDrawer] = useState(false), [pop, setPop] = useState(false);
      const popBtn = React.useRef(null);
      api.current = { setItems, setErr, setModal, setDrawer, setPop, notif };
      const ev = Array.from({ length: 6 }, (_, i) => ({ id: 'e' + i, actor: { name: NAMES[i % 3] }, action: 'updated', target: { label: 'Billing settings for a client with a very long organisation name GmbH & Co. KG' }, time: Date.now() - i * 4e6, kind: 'deploy' }));
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 } },
        h('div', { 'data-g': 'row', style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' } },
          h(UL.ULNotificationCenter, { items: err ? [] : items, error: err ? 'Network error (503): the notifications service did not answer in time' : undefined, onRetry: () => setErr(false), onReadChange: () => {}, onMarkAllRead: () => {}, itemMenu: () => [{ id: 'a', label: 'Archive' }] }),
          h(UL.ULButton, { size: 'sm', ref: popBtn, onClick: () => setPop(true) }, 'Popover'),
          h(UL.ULButton, { size: 'sm', onClick: () => setModal(true) }, 'Modal'),
          h(UL.ULButton, { size: 'sm', onClick: () => setDrawer(true) }, 'Drawer'),
          h(UL.ULBadge, null, 'Badge'), h(UL.ULStatusPill, { status: 'degraded' }), h(UL.ULRefreshControl, { onRefresh: () => wait(200), updatedAt: Date.now() })),
        h(UL.ULFilterBar, { fields: [{ key: 'status', label: 'Status', type: 'select', options: [{ value: 'Paused', label: 'Paused' }] }, { key: 'note', label: 'Note', type: 'text' }], value: [{ id: 'f1', field: 'status', op: 'isNot', value: 'Paused' }, { id: 'f2', field: 'note', op: 'contains', value: 'a very long filter value that must be truncated with a tooltip' }], onValueChange: () => {}, count: 12 }),
        h('div', { 'data-g': 'panels', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '12px' } },
          h(UL.ULCopyField, { label: 'Webhook URL', value: 'https://hooks.example.test/in/9f2c1a7e3b5d4c1f8e6a' }),
          h(UL.ULErrorState, { message: 'The invoices service did not answer in time.', onRetry: () => wait(200), diagnostics: { request: 'req_8f3a2c', status: 504 }, support: 'contact@ultra-labs.eu' }),
          h(UL.ULDescriptionList, { items: [{ label: 'Account', value: 'acc_2s9x1', copy: 'acc_2s9x1' }, { label: 'Billing e-mail', value: 'accounts-payable-department@very-long-client-domain.example', truncate: true }] })),
        h(UL.ULPopover, { open: pop, onOpenChange: setPop, triggerRef: popBtn, title: 'Webhook delivery', label: 'Popover' }, h(UL.ULDescriptionList, { layout: 'stacked', items: [{ label: 'Endpoint', value: 'https://hooks.example.test/in/9f2c1a7e3b5d4c1f8e6a/really/long/path', truncate: true }, { label: 'Status', value: '504 Gateway timeout' }] })),
        h(UL.ULModal, { open: modal, onOpenChange: setModal, title: 'Request failed' }, h(UL.ULErrorState, { embedded: true, message: 'The invoices service did not answer in time.', onRetry: () => wait(200), diagnostics: { request: 'req_8f3a2c', status: 504 } }), h(UL.ULJsonViewer, { data: { id: 'inv_1', note: 'A long description string that keeps going so the viewer has to truncate it', items: [1, 2, 3] }, label: 'Response' })),
        h(UL.ULDrawer, { open: drawer, onOpenChange: setDrawer, title: 'Activity' }, h(UL.ULActivityFeed, { events: ev })));
    }

    async function withFixture(fn, w = Math.min(860, innerWidth - 24)) {
      const api = { current: null };
      const S = await stage(() => h(Fixture, { api }), w);
      try { return await fn(S, api.current); } finally { esc(); await wait(300); esc(); await wait(300); await S.done(); }
    }

    /* ---------- B1 layout overflow ---------- */
    async function layoutOverflowTest() {
      const checks = [], c = ck(checks), size = innerWidth + '×' + innerHeight;
      await withFixture(async (S, api) => {
        const bell = S.box.querySelector('.ul-ntf .ul-btn');
        const probe = (key, label) => { const s = surfaces().find((n) => n.querySelector('.ul-ntf-panel')); const o = s ? overflowOf(s) : { px: NaN, who: 'no surface' }; c(key, `${label} (${size})`, s && o.px <= 0.5, `${o.px}px ${o.who}`); return s; };
        bell.click(); await settle();
        const s = probe('ntf-list', 'notification popover · list');
        const row = s && s.querySelector('.ul-ntf-item');
        if (row) { row.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); row.dispatchEvent(new PointerEvent('pointerenter')); await raf(); probe('ntf-hover', 'notification popover · hover row'); }
        const list = s && s.querySelector('.ul-ntf-list');
        list && list.dispatchEvent(new PointerEvent('pointerenter')); api.setItems((x) => [api.notif()].concat(x)); await settle(200); probe('ntf-queue', 'notification popover · live insert queued (pill)');
        list && list.dispatchEvent(new PointerEvent('pointerleave')); await settle(300); probe('ntf-insert', 'notification popover · live insert applied');
        api.setErr(true); await settle(400); probe('ntf-error', 'notification popover · error (embedded error state)');
        c('ntf-embedded', 'error state inside the popover is the embedded variant (no own card / glass)', !!surfaces().find((n) => n.querySelector('.ul-errorstate[data-embedded]')), '');
        api.setErr(false); api.setItems([]); await settle(400); probe('ntf-empty', 'notification popover · empty');
        api.setItems([]); esc(); await settle(500);
        api.setPop(true); await settle();
        const p = surfaces().find((n) => n.classList.contains('ul-popover') && !n.querySelector('.ul-ntf-panel')); const po = p ? overflowOf(p) : { px: NaN, who: 'none' };
        c('popover', `popover with long values (${size})`, !!p && po.px <= 0.5, `${po.px}px ${po.who}`);
        api.setPop(false); await settle(500);
        api.setModal(true); await settle(900);
        const m = surfaces().find((n) => n.querySelector('.ul-json, .ul-errorstate')); const mo = m ? overflowOf(m) : { px: NaN, who: 'none' };
        c('modal', `modal with embedded error + JSON viewer (${size})`, !!m && mo.px <= 0.5, `${mo.px}px ${mo.who}`);
        m && m.querySelector('.ul-errorstate-dh')?.click(); await settle(200);
        const mo2 = m ? overflowOf(m) : { px: NaN }; c('modal-expanded', `modal · technical details expanded (${size})`, !!m && mo2.px <= 0.5, `${mo2.px}px ${mo2.who || ''}`);
        api.setModal(false); await settle(700);
        api.setDrawer(true); await settle(900);
        const d = surfaces().find((n) => n.querySelector('.ul-feed')); const dO = d ? overflowOf(d) : { px: NaN, who: 'none' };
        c('drawer', `drawer with activity feed (${size})`, !!d && dO.px <= 0.5, `${dO.px}px ${dO.who}`);
        api.setDrawer(false); await settle(700);
        const panels = [...S.box.querySelectorAll('[data-g="panels"] > *')].map((n) => ({ n, o: overflowOf(n) }));
        const bad = panels.filter((x) => x.o.px > 0.5);
        c('panels', `panels (copy field, error card, description list) (${size})`, !bad.length, bad.map((x) => x.n.className.split(' ')[0] + ' ' + x.o.px + 'px ' + x.o.who).join(', ') || panels.length + ' ok');
        const st = overflowOf(S.box, true); c('stage', `fixture row + filter bar inside the stage (${size})`, st.px <= 0.5, `${st.px}px ${st.who}`);
      });
      if (window.ULDemos.__chartGuard) (await window.ULDemos.__chartGuard('layout')).forEach((x) => checks.push(x));
      if (window.ULDemos.__formsGuard) (await window.ULDemos.__formsGuard('layout')).forEach((x) => checks.push(x));
      checks.push({ key: 'sizes', label: 'three viewport sizes (1280×800, 924×540, 375×667)', pass: null, value: 'viewport-tests.dc.html runs this card in each frame' });
      return result(checks);
    }

    /* ---------- B2 icon size scan ---------- */
    function scanIcons(root) {
      const bad = [];
      let n = 0;
      root.querySelectorAll('svg').forEach((s) => {
        if (s.closest('[data-ul-illustration]') || s.parentElement.closest('svg')) return;
        const b = s.getBoundingClientRect(); if (!b.width && !b.height) return; n++;
        const fs = parseFloat(getComputedStyle(s.parentElement).fontSize) || 16;
        const attrW = s.getAttribute('width'), unsized = !s.classList.contains('ul-icon') && (!attrW || /%$/.test(attrW)) && !s.closest('.ul-check, .ul-act-count, .ul-row-check, .ul-check-box, .ul-spinner');
        const big = Math.max(b.width, b.height);
        if (unsized && big > 24) bad.push(`unsized ${s.getAttribute('class') || s.parentElement.className} ${Math.round(big)}px`);
        else if (big > 48 || big > Math.max(2 * fs, 24) + 0.5) bad.push(`${s.getAttribute('class') || s.parentElement.className} ${Math.round(big)}px (font ${fs}px)`);
      });
      return { n, bad };
    }
    async function iconSizeTest() {
      const checks = [], c = ck(checks);
      await withFixture(async (S, api) => {
        const a = scanIcons(S.box);
        c('fixture', 'every component svg in the dashboard fixture: explicit size ≤ 2× font size, ≤ 48px (or data-ul-illustration)', !a.bad.length, a.bad.slice(0, 4).join(' · ') || a.n + ' svgs ok');
        S.box.querySelector('.ul-errorstate-dh')?.click(); await raf();
        const chev = S.box.querySelector('.ul-errorstate-chev svg'), cb = chev && chev.getBoundingClientRect();
        c('chevron', 'error state disclosure chevron is small (≤ 20px)', !!cb && cb.width <= 20 && cb.height <= 20, cb ? Math.round(cb.width) + 'px' : 'none');
        S.box.querySelector('.ul-ntf .ul-btn').click(); await settle();
        const sf = surfaces(); const b = sf.map(scanIcons); const bad = b.flatMap((x) => x.bad);
        c('overlay', 'svgs inside the open notification popover', !bad.length, bad.slice(0, 4).join(' · ') || b.reduce((t, x) => t + x.n, 0) + ' svgs ok');
      });
      if (window.ULDemos.__chartGuard) (await window.ULDemos.__chartGuard('icons')).forEach((x) => checks.push(x));
      if (window.ULDemos.__formsGuard) (await window.ULDemos.__formsGuard('icons')).forEach((x) => checks.push(x));
      const page = scanIcons(document.querySelector('[data-ul-theme]') || document.body);
      c('page', 'svgs on the rest of this page', !page.bad.length, page.bad.slice(0, 4).join(' · ') || page.n + ' svgs ok');
      return result(checks);
    }

    /* ---------- B3 control text centring ---------- */
    const LABEL = [['.ul-btn', '.ul-btn-label'], ['.ul-filter-chip', '.ul-filter-chip-main'], ['.ul-badge', null], ['.ul-statuspill', null], ['.ul-feed-chip', null], ['.ul-select-trigger', '.ul-select-value'], ['.ul-errorstate-dh', null], ['.ul-flat-btn', null], ['.ul-feed-pill', null], ['.ul-chart-lchip', '.ul-chart-lname'], ['.ul-tgroup-item', '.ul-seg-label'], ['.ul-kbd-key', null], ['.ul-iaddon:not(:has(.ul-select))', null], ['.ul-sep-label', null], ['.ul-coll-trigger', '.ul-coll-title'], ['.ul-item-title', null]];
    function textBox(el) {
      const rg = document.createRange(); rg.selectNodeContents(el);
      const rs = [...rg.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5); if (!rs.length) return null;
      const tops = new Set(rs.map((r) => Math.round(r.top + r.height / 2)));
      const top = Math.min(...rs.map((r) => r.top)), bot = Math.max(...rs.map((r) => r.bottom));
      return { lines: [...tops].reduce((a, t, i, arr) => (i && Math.abs(t - arr[i - 1]) <= 2 ? a : a + 1), 0), cy: (top + bot) / 2 };
    }
    function scanControls(root) {
      const bad = []; let n = 0;
      for (const [sel, lab] of LABEL) root.querySelectorAll(sel).forEach((ctl) => {
        if (!ctl.getClientRects().length || ctl.closest('[aria-hidden="true"]')) return;
        const el = lab ? ctl.querySelector(lab) : ctl; if (!el) return;
        const t = textBox(el); if (!t) return; n++;
        const r = ctl.getBoundingClientRect(), cy = r.top + r.height / 2;
        if (t.lines > 1) bad.push(`${sel} "${el.textContent.trim().slice(0, 20)}" ${t.lines} lines`);
        else if (Math.abs(t.cy - cy) > 1) bad.push(`${sel} "${el.textContent.trim().slice(0, 20)}" off ${Math.round((t.cy - cy) * 10) / 10}px`);
      });
      return { n, bad };
    }
    async function controlTextTest() {
      const checks = [], c = ck(checks);
      await withFixture(async (S) => {
        const a = scanControls(S.box);
        c('fixture', 'chips, pills, badges, buttons, select triggers: one line, text centre within 1px of the control centre', !a.bad.length, a.bad.slice(0, 4).join(' · ') || a.n + ' controls ok');
        S.box.querySelector('.ul-ntf .ul-btn').click(); await settle();
        const b = surfaces().map(scanControls), bad = b.flatMap((x) => x.bad);
        c('overlay', 'controls inside the open notification popover', !bad.length, bad.slice(0, 4).join(' · ') || b.reduce((t, x) => t + x.n, 0) + ' controls ok');
      }, Math.min(520, innerWidth - 24));
      if (window.ULDemos.__chartGuard) (await window.ULDemos.__chartGuard('ctrl')).forEach((x) => checks.push(x));
      if (window.ULDemos.__formsGuard) (await window.ULDemos.__formsGuard('ctrl')).forEach((x) => checks.push(x));
      return result(checks);
    }

    /* ---------- B4 covered anchor (notification centre) ---------- */
    async function coveredAnchorTest() {
      const checks = [], c = ck(checks);
      await withFixture(async (S) => {
        const bell = S.box.querySelector('.ul-ntf .ul-btn');
        // centre + the 4 visible corners of the bell's shape (a circle button: points at 45° on 0.9 r; a rect corner of a circle is not part of the bell)
        const pts = () => { const b = bell.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, round = (parseFloat(getComputedStyle(bell).borderTopLeftRadius) || 0) >= Math.min(b.width, b.height) / 2 - 1; const ex = round ? b.width / 2 * 0.9 * Math.SQRT1_2 : b.width / 2 - 1.5, ey = round ? b.height / 2 * 0.9 * Math.SQRT1_2 : b.height / 2 - 1.5; return [[cx, cy], [cx - ex, cy - ey], [cx + ex, cy - ey], [cx - ex, cy + ey], [cx + ex, cy + ey]]; };
        const sample = async (ms, until) => {
          const out = []; const t0 = performance.now();
          while (performance.now() - t0 < ms) { await raf(); const s = surfaces().concat(vis('.ul-anchored[data-ul-morphing]')).find((n) => n.querySelector('.ul-ntf-panel')); out.push(pts().map(([x, y]) => { const e = document.elementFromPoint(x, y); return s && e && s.contains(e) ? 1 : bell.contains(e) ? 'B' : 0; }).join('')); if (until && until()) break; }
          return out;
        };
        const verdict = (key, label, fr) => { const badF = fr.findIndex((f) => f !== '11111'); c(key, label, fr.length > 0 && badF < 0, badF < 0 ? fr.length + ' frames, all covered' : `frame ${badF}: ${fr[badF]} (1 = surface, B = bell) of ${fr.length}`); };
        bell.click(); verdict('cold', 'cold open: bell centre + 4 corners hit the surface in every frame', await sample(700));
        esc(); await settle(800);
        bell.click(); verdict('warm', 'warm open: every frame covered', await sample(700));
        esc(); await wait(90); // interrupt the close: reopen during the exit
        const reopen = vis('.ul-anchored').find((n) => n.querySelector('.ul-ntf-panel'));
        bell.click(); const fr = await sample(700);
        verdict('interrupt', 'interrupted (reopen during close): every frame covered', fr);
        c('aria', 'bell keeps aria-expanded / aria-controls while covered', bell.getAttribute('aria-expanded') === 'true' && !!bell.getAttribute('aria-controls'), `${bell.getAttribute('aria-expanded')} · ${bell.getAttribute('aria-controls')}`);
        const close = surfaces().map((s) => s.querySelector('.ul-popover-close')).find(Boolean);
        c('close', 'visible close affordance in the header', !!close && close.getBoundingClientRect().width >= 24, close ? 'present' : 'none');
        close && close.click(); await settle(800);
        c('refocus', 'close → focus returns to the bell', document.activeElement === bell, document.activeElement ? document.activeElement.className.split(' ')[0] : 'none');
        void reopen;
      });
      return result(checks);
    }

    window.ULDemos = Object.assign(window.ULDemos || {}, { layoutOverflowTest, iconSizeTest, controlTextTest, coveredAnchorTest, __layoutOverflow: overflowOf, __scanIcons: scanIcons, __scanControls: scanControls });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
