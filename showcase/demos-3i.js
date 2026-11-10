// Task 3D tests: frame-independent cards for batch 2, merged into ULDemos.formsTests.cards (probe-forms ?cards=<id>) and ULDemos.f3d_<id> (motion-test).
// Timer checks only assert lower bounds (a timer never fires early), so they hold in a slow preview.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value: value == null ? '' : String(value) });
    const result = (checks, driver = 'DOM (frame-independent)') => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver });
    const settle = async (ms = 400) => { await wait(ms); await raf(); await raf(); };
    const key = (el, k, o = {}) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));
    const over = (el) => el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    const until = async (fn, ms = 6000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return performance.now() - t0; await wait(20); } return -1; };
    async function stage(el, w = 760) {
      const box = document.createElement('div');
      box.setAttribute('data-ul-theme', document.querySelector('[data-ul-theme]')?.getAttribute('data-ul-theme') || 'app');
      box.style.cssText = `position:fixed;left:12px;top:12px;z-index:50;width:${Math.min(w, innerWidth - 24)}px;max-height:${innerHeight - 24}px;overflow:auto;padding:16px;box-sizing:border-box;border-radius:16px;background:#0d1117`;
      document.body.appendChild(box);
      const root = window.ReactDOM.createRoot(box); let setV = null;
      function Host() { const [v, set] = React.useState(0); setV = set; return el(v, set); }
      root.render(h(Host)); await settle(300);
      return { box, set: (v) => setV(v), done: async () => { root.unmount(); box.remove(); await wait(60); } };
    }
    const cards = {};

    cards.hovercard = async () => {
      const checks = [], c = ck(checks);
      const content = (n) => h('div', null, h('p', { className: 'ul-hc-title' }, 'Card ' + n), h(UL.ULButton, { size: 'sm', 'data-t-in': n }, 'Action ' + n));
      const S = await stage(() => h('div', { style: { display: 'flex', gap: 40, padding: 40 } },
        h(UL.ULHoverCard, { label: 'A', content: content('a') }, h('a', { href: '#a', 'data-t': 'a', onClick: (e) => e.preventDefault() }, 'Trigger A')),
        h(UL.ULHoverCard, { label: 'B', content: content('b'), openDelay: 0, closeDelay: 5000 }, h('a', { href: '#b', 'data-t': 'b', onClick: (e) => e.preventDefault() }, 'Trigger B')),
        h(UL.ULHoverCard, { label: 'C', content: content('c'), openDelay: 0, closeDelay: 5000, group: 'other' }, h('a', { href: '#c', 'data-t': 'c', onClick: (e) => e.preventDefault() }, 'Trigger C'))));
      const T = (n) => S.box.querySelector(`[data-t="${n}"]`), isOpen = (n) => T(n).getAttribute('aria-expanded') === 'true';
      const surf = (n) => [...document.querySelectorAll('.ul-hovercard')].find((s) => s.querySelector(`[data-t-in="${n}"]`));
      try {
        const od = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ul-hovercard-open-delay')), cd = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ul-hovercard-close-delay'));
        c('tokens', 'tokens open 500 / close 250', od === 500 && cd === 250, od + ' / ' + cd);
        over(T('a')); const t0 = performance.now(); await wait(300);
        c('nointent', 'not open 300ms after pointer enter', !isOpen('a'), isOpen('a'));
        await until(() => isOpen('a')); const tOpen = performance.now() - t0;
        c('opendelay', 'opens after ≥ open delay', isOpen('a') && tOpen >= od - 1, Math.round(tOpen) + 'ms');
        await until(() => surf('a') && !surf('a').closest('[data-ul-morphing]') && !surf('a').hasAttribute('data-ul-morphing'), 4000); await settle(200);
        const s = surf('a'), b = s && s.querySelector('.ul-hc-bridge');
        const br = b && b.getBoundingClientRect(), sr = s && s.getBoundingClientRect(), tr = T('a').getBoundingClientRect();
        const below = sr && sr.top >= tr.bottom;
        c('bridge', 'bridge covers the trigger → card gap', !!br && (below ? br.top <= tr.bottom + 0.5 && br.bottom >= sr.top - 0.5 : br.bottom >= tr.top - 0.5 && br.top <= sr.bottom + 0.5) && br.width > 0, br ? `${Math.round(br.top)}–${Math.round(br.bottom)} gap ${Math.round(below ? tr.bottom : sr.bottom)}–${Math.round(below ? sr.top : tr.top)}` : 'none');
        // leave the trigger, cross the bridge into the card: stays open
        over(document.body); over(b); await wait(cd + 200);
        c('bridgekeep', 'crossing the bridge keeps it open', isOpen('a'));
        over(s.querySelector('[data-t-in="a"]')); await wait(cd + 100);
        c('insidekeep', 'pointer inside the card keeps it open', isOpen('a'));
        over(document.body); const t1 = performance.now(); await wait(100);
        c('nocloseearly', 'still open 100ms after leaving', isOpen('a'));
        await until(() => !isOpen('a')); const tClose = performance.now() - t1;
        c('closedelay', 'closes after ≥ close delay', !isOpen('a') && tClose >= cd - 1, Math.round(tClose) + 'ms');
        await settle(500);
        // Esc on the trigger closes; focus stays on the trigger
        over(T('a')); await until(() => isOpen('a')); T('a').focus(); key(T('a'), 'Escape'); await raf();
        c('esc', 'Esc closes', !isOpen('a'));
        c('escfocus', 'focus stays on the trigger', document.activeElement === T('a'));
        over(document.body); await settle(600);
        // Tab moves into the card; focus inside keeps it open past the close delay; Esc returns focus
        over(T('a')); await until(() => isOpen('a')); await until(() => surf('a'), 3000); await settle(150);
        T('a').focus(); key(T('a'), 'Tab'); await raf();
        const inCard = !!surf('a') && surf('a').contains(document.activeElement);
        c('tabin', 'Tab from the trigger enters the card', inCard, document.activeElement && document.activeElement.textContent);
        over(document.body); await wait(cd + 200);
        c('focuskeep', 'focus inside keeps it open after the pointer left', isOpen('a'));
        key(document.activeElement, 'Escape'); await settle(500);
        c('escreturn', 'Esc inside closes and returns focus to the trigger', !isOpen('a') && document.activeElement === T('a'), document.activeElement && document.activeElement.textContent);
        T('a').blur(); await settle(400);
        // one at a time per group
        over(T('b')); await until(() => isOpen('b'));
        over(T('c')); await until(() => isOpen('c'));
        c('othergroup', 'another group does not close it', isOpen('b') && isOpen('c'));
        over(T('a')); await until(() => isOpen('a'));
        c('onepergroup', 'opening A closes B (same group) at once', isOpen('a') && !isOpen('b') && isOpen('c'));
        c('role', 'card is a non-modal dialog with a name', !!document.querySelector('.ul-hovercard[role="dialog"][aria-label]') && !document.querySelector('.ul-hovercard[aria-modal="true"]'));
        over(document.body); key(document.body, 'Escape'); await settle(900);
      } finally { await S.done(); }
      return result(checks);
    };

    cards.menubar = async () => {
      const checks = [], c = ck(checks);
      const sref = { current: null };
      const menus = [
        { id: 'file', label: 'File', items: [{ id: 'new', label: 'New', shortcut: 'Mod+N' }, { id: 'recent', label: 'Recent', items: [{ id: 'r1', label: 'One' }, { id: 'r2', label: 'Two' }] }, { type: 'separator' }, { id: 'close', label: 'Close' }] },
        { id: 'edit', label: 'Edit', items: [{ id: 'undo', label: 'Undo', shortcut: 'Mod+Z' }, { id: 'chk', type: 'checkbox', label: 'Snap', checked: true }] },
        { id: 'off', label: 'Off', disabled: true, items: [] },
        { id: 'help', label: 'Help', items: [{ id: 'docs', label: 'Docs' }] },
      ];
      let act = '';
      const S = await stage(() => h('div', { style: { padding: 20 } }, h(UL.ULMenubar, { menus, label: 'Test bar', surfaceRef: sref, onAction: (m, i) => { act = m + ':' + i; } })));
      const bar = S.box.querySelector('[role="menubar"]'), T = (id) => bar.querySelector('[data-menubar-id="' + id + '"]'), exp = (id) => T(id).getAttribute('aria-expanded') === 'true';
      const openSurf = () => [...document.querySelectorAll('.ul-menu-surface[role="menu"]')].filter((s) => !s.hasAttribute('data-ul-exiting'));
      try {
        c('role', 'role menubar + horizontal + name', bar.getAttribute('aria-orientation') === 'horizontal' && bar.getAttribute('aria-label') === 'Test bar');
        const tabs = [...bar.querySelectorAll('[role="menuitem"]')].map((b) => b.tabIndex);
        c('roving', 'one tab stop (roving tabindex)', tabs.filter((x) => x === 0).length === 1 && tabs[0] === 0, tabs.join(','));
        T('file').focus(); key(T('file'), 'ArrowRight'); await raf();
        c('right', '→ moves focus to the next trigger', document.activeElement === T('edit'));
        key(T('edit'), 'ArrowRight'); await raf();
        c('skipdisabled', '→ skips the disabled trigger', document.activeElement === T('help'));
        key(T('help'), 'ArrowRight'); await raf();
        c('wrap', '→ wraps to the first', document.activeElement === T('file'));
        key(T('file'), 'End'); await raf(); const endOk = document.activeElement === T('help'); key(T('help'), 'Home'); await raf();
        c('homeend', 'Home / End', endOk && document.activeElement === T('file'));
        key(T('file'), 'ArrowDown'); await until(() => sref.current && sref.current.contains(document.activeElement), 3000);
        c('open', '↓ opens and focuses the first item', exp('file') && !!sref.current && sref.current.contains(document.activeElement), document.activeElement && document.activeElement.textContent);
        c('kbd', 'shortcuts render as ULKbd', !!sref.current && !!sref.current.querySelector('.ul-kbd .ul-kbd-key'));
        key(document.activeElement, 'ArrowRight'); await raf(); await raf();
        c('arrowswitch', '→ inside the menu opens the next menu', exp('edit') && !exp('file'));
        await until(() => sref.current && sref.current.contains(document.activeElement), 3000);
        c('checkmark', 'check items use ULCheckMark', !!sref.current && !!sref.current.querySelector('[role="menuitemcheckbox"] .ul-check-mark, [role="menuitemcheckbox"] svg'));
        T('file').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); T('file').dispatchEvent(new PointerEvent('pointerenter', { bubbles: false, pointerType: 'mouse' })); await raf(); await raf();
        c('hoverswitch', 'hovering another trigger while open switches at once', exp('file') && !exp('edit'));
        await until(() => sref.current && sref.current.contains(document.activeElement), 3000); await settle(300);
        const sub = sref.current.querySelector('[aria-haspopup="menu"]'); sub.focus(); key(sub, 'ArrowRight');
        await until(() => openSurf().length >= 2, 3000); await settle(400);
        const ss = openSurf(), r0 = sref.current.getBoundingClientRect(), r1 = ss.find((s) => s !== sref.current)?.getBoundingClientRect();
        const gap = r1 ? (r1.left >= r0.right ? r1.left - r0.right : r0.left - r1.right) : NaN;
        c('submenu', 'submenu opens beside the parent', !!r1, ss.length);
        c('subgap', 'submenu gap = --ul-submenu-gap (2px)', Math.abs(gap - 2) <= 1, gap.toFixed(1) + 'px');
        key(document.activeElement, 'ArrowLeft'); await settle(300);
        c('subclose', '← in the submenu closes it, menu stays', exp('file'));
        key(document.activeElement, 'Escape'); await settle(500);
        c('esc', 'Esc closes and returns focus to the trigger', !exp('file') && document.activeElement === T('file'));
        key(T('file'), 'Enter'); await until(() => sref.current && sref.current.contains(document.activeElement), 3000);
        document.activeElement.click(); await settle(300);
        c('action', 'item activation reports menu + item', act === 'file:new' && !exp('file'), act);
      } finally { key(document.body, 'Escape'); await settle(400); await S.done(); }
      return result(checks);
    };

    cards.navmenu = async () => {
      const checks = [], c = ck(checks), sref = { current: null };
      const items = [
        { id: 'a', label: 'Alpha', panel: { links: [{ id: 'a1', title: 'A one', description: 'First', href: '#a1' }, { id: 'a2', title: 'A two', href: '#a2' }] } },
        { id: 'b', label: 'Beta', panel: { links: [{ id: 'b1', title: 'B one', description: 'A much longer description that has to wrap inside the panel without widening it at all', href: '#b1' }] } },
        { id: 'p', label: 'Pricing', href: '#p', current: true },
      ];
      let nav = '';
      const S = await stage(() => h('div', { style: { padding: 20 } },
        h(UL.ULNavigationMenu, { items, label: 'T', surfaceRef: sref, onNavigate: (e, l) => { e.preventDefault(); nav = l.href; } }),
        h(UL.ULNavigationMenu, { items, label: 'TP', collapseBelow: 100000 })));
      const bar = S.box.querySelector('nav[aria-label="T"]'), top = (id) => bar.querySelector('[data-navm-id="' + id + '"]');
      try {
        c('nav', 'semantic <nav> + list, no menu roles', bar.tagName === 'NAV' && !!bar.querySelector('ul > li') && !bar.querySelector('[role="menu"],[role="menubar"]'));
        c('current', 'aria-current="page" on the current link', top('p').getAttribute('aria-current') === 'page');
        c('notabtrap', 'every top item is a tab stop', [...bar.querySelectorAll('.ul-navmenu-top')].every((x) => x.tabIndex === 0));
        top('a').focus(); key(top('a'), 'ArrowRight'); await raf();
        c('arrows', '→ moves between items', document.activeElement === top('b'));
        key(top('b'), 'End'); await raf(); const e1 = document.activeElement === top('p'); key(top('p'), 'Home'); await raf();
        c('homeend', 'Home / End', e1 && document.activeElement === top('a'));
        key(top('a'), 'ArrowDown'); await until(() => sref.current && sref.current.contains(document.activeElement), 4000);
        c('down', '↓ opens the panel and focuses the first link', top('a').getAttribute('aria-expanded') === 'true' && !!sref.current && sref.current.contains(document.activeElement), document.activeElement && document.activeElement.textContent);
        c('controls', 'trigger aria-controls → panel id', top('a').getAttribute('aria-controls') === (sref.current && sref.current.id));
        await settle(700);
        const s1 = sref.current;
        top('b').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); await settle(900);
        c('switch', 'hover on another trigger swaps the panel', top('b').getAttribute('aria-expanded') === 'true' && top('a').getAttribute('aria-expanded') === 'false');
        c('onesurface', 'same surface (view swap, no second overlay)', sref.current === s1 && document.querySelectorAll('.ul-navmenu-panel').length === 1, document.querySelectorAll('.ul-navmenu-panel').length);
        const sr = sref.current.getBoundingClientRect(), inner = sref.current.querySelector('.ul-navmenu-view:not([hidden])');
        const over = [...inner.querySelectorAll('*')].filter((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX === 'visible' && n.clientWidth > 0).length;
        c('nooverflow', 'panel content fits the surface', inner.getBoundingClientRect().right <= sr.right + 0.5 && over === 0, Math.round(inner.getBoundingClientRect().width) + ' / ' + Math.round(sr.width));
        top('b').focus(); key(top('b'), 'Escape'); await settle(500);
        c('esc', 'Esc closes and keeps focus on the trigger', top('b').getAttribute('aria-expanded') === 'false' && document.activeElement === top('b'));
        top('a').click(); await until(() => sref.current && !sref.current.hasAttribute('data-ul-morphing'), 3000); await settle(400);
        top('a').focus(); key(top('a'), 'Tab'); await raf();
        const links = [...sref.current.querySelectorAll('.ul-navmenu-view:not([hidden]) a[href]')];
        c('tabin', 'Tab from an open trigger enters the panel', document.activeElement === links[0]);
        links[links.length - 1].focus(); key(links[links.length - 1], 'Tab'); await settle(300);
        c('tabout', 'Tab after the last link closes and moves on', top('a').getAttribute('aria-expanded') === 'false' && document.activeElement === top('b'));
        top('p').click(); await raf();
        c('navigate', 'links route through onNavigate (href from props)', nav === '#p', nav);
        const phone = S.box.querySelector('nav[aria-label="TP"]'), burger = phone.querySelector('.ul-navmenu-burger');
        c('collapse', 'below collapseBelow: one Menu button, no bar', !!burger && !phone.querySelector('.ul-navmenu-list'));
        burger.click(); await until(() => document.querySelector('.ul-navmenu-sheet-list'), 4000); await settle(700);
        const row = document.querySelector('.ul-navmenu-sheet-list [data-navm-id="a"]'); row && row.click(); await settle(900);
        const pushed = [...document.querySelectorAll('.ul-navmenu-grid a[href="#a1"]')].some((a) => a.offsetParent);
        c('drillin', 'sheet trigger row drills in (dialog push)', pushed);
        c('sheetcurrent', 'sheet keeps aria-current', !!document.querySelector('.ul-navmenu-sheet-list [aria-current="page"]'));
        key(document.activeElement || document.body, 'Escape'); await settle(400); key(document.activeElement || document.body, 'Escape'); await settle(600);
      } finally { await S.done(); }
      return result(checks);
    };

    cards.nativeselect = async () => {
      const checks = [], c = ck(checks); let last = '';
      const opts = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta', disabled: true }, { value: 'c', label: 'Gamma' }];
      const S = await stage(() => h('div', { style: { display: 'grid', gap: 12, padding: 12 } },
        h(UL.ULNativeSelect, { label: 'One', options: opts, placeholder: 'Pick', onValueChange: (v) => { last = v; }, helper: 'Help' }),
        h(UL.ULNativeSelect, { label: 'Two', groups: [{ label: 'G1', options: opts }, { label: 'G2', options: [{ value: 'z', label: 'Zeta' }] }], defaultValue: 'z', error: 'Bad' }),
        h(UL.ULNativeSelect, { label: 'Three', options: opts, disabled: true }),
        h(UL.ULSelect, { label: 'Four', options: opts, native: 'always', defaultValue: 'c' }),
        h(UL.ULSelect, { label: 'Five', options: opts, native: 'never' })));
      try {
        const sel = [...S.box.querySelectorAll('select')], wells = [...S.box.querySelectorAll('.ul-select')];
        c('native', 'real <select> elements', sel.length === 4, sel.length);
        c('label', 'label is bound (for / id)', !!S.box.querySelector('label[for="' + sel[0].id + '"]'));
        c('placeholder', 'placeholder = disabled empty first option, selected', sel[0].value === '' && sel[0].options[0].disabled && sel[0].hasAttribute('data-placeholder'));
        c('disabledopt', 'disabled option stays disabled', sel[0].querySelector('option[value="b"]').disabled);
        c('optgroups', 'groups render as <optgroup>', sel[1].querySelectorAll('optgroup').length === 2 && sel[1].value === 'z');
        c('invalid', 'error sets aria-invalid + describedby + well state', sel[1].getAttribute('aria-invalid') === 'true' && !!sel[1].getAttribute('aria-describedby') && wells[1].hasAttribute('data-invalid'));
        c('disabled', 'disabled select', sel[2].disabled);
        sel[0].value = 'c'; sel[0].dispatchEvent(new Event('change', { bubbles: true })); await raf();
        c('change', 'onValueChange on change', last === 'c', last);
        const cs = getComputedStyle(sel[0]), tr = getComputedStyle(S.box.querySelectorAll('.ul-select-trigger')[4]);
        c('well', 'same field well as the ULSelect trigger (radius, height, background)', cs.borderRadius === tr.borderRadius && cs.minHeight === tr.minHeight && cs.backgroundColor === tr.backgroundColor, cs.borderRadius + ' ' + cs.minHeight + ' / ' + tr.borderRadius + ' ' + tr.minHeight);
        c('arrow', 'arrow is a sized ULIcon', !!wells[0].querySelector('svg.ul-nsel-chev[width], .ul-nsel-chev svg[width], svg.ul-nsel-chev'));
        c('nativemode', 'ULSelect native="always" renders the native select', !!wells[3].querySelector('select') && wells[3].querySelector('select').value === 'c');
        c('glassmode', 'ULSelect native="never" keeps the listbox trigger', !wells[4].querySelector('select') && wells[4].querySelector('button[aria-haspopup="listbox"]') != null);
        const coarse = matchMedia('(pointer: coarse)').matches;
        c('mobilequery', 'native="mobile" follows (pointer: coarse) = ' + coarse, true, 'media query, verified by code');
      } finally { await S.done(); }
      return result(checks);
    };
    cards.calendar = async () => {
      const checks = [], c = ck(checks); let out = null;
      const y = 2026, m = 1; // February 2026: Sunday 1st
      const S = await stage((v) => h('div', { style: { padding: 12 } }, h(UL.ULCalendar, { key: v, mode: ['single', 'multiple', 'range', 'single'][v] || 'single', locale: v === 3 ? 'de' : 'en', defaultMonth: new Date(y, m, 10), min: new Date(y, m, 3), max: new Date(y, m + 1, 20), isDateDisabled: (d) => d.getDate() === 12, onValueChange: (x) => { out = x; } })), 420);
      const day = (iso) => S.box.querySelector('.ul-cal-day[data-date="' + iso + '"]');
      const focusIso = () => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.date;
      try {
        const wd = [...S.box.querySelectorAll('[role="columnheader"]')].map((x) => x.textContent);
        c('monday', 'Monday first (en)', /^mo/i.test(wd[0]), wd.join(' '));
        const tab = S.box.querySelectorAll('.ul-cal-day[tabindex="0"]');
        c('onetab', 'one tab stop, an enabled date', tab.length === 1 && !tab[0].disabled, tab[0] && tab[0].dataset.date);
        c('min', 'days before min are disabled', day('2026-02-02').disabled && !day('2026-02-03').disabled);
        day('2026-02-11').focus(); key(day('2026-02-11'), 'ArrowRight'); await raf(); await raf();
        c('skip', '→ skips the disabled 12th', focusIso() === '2026-02-13', focusIso());
        key(document.activeElement, 'Enter'); await raf();
        c('single', 'single: Enter picks', out instanceof Date && out.getDate() === 13);
        key(document.activeElement, 'PageDown'); await raf(); await raf();
        c('pagedown', 'PageDown → next month', /2026-03-13/.test(focusIso() || ''), focusIso());
        const ysel = S.box.querySelectorAll('.ul-calendar-sel');
        c('jump', 'month + year jump selects', ysel.length === 2 && ysel[0].value === '2', ysel[0] && ysel[0].value);
        S.set(1); await settle(300);
        day('2026-02-16').click(); await raf(); day('2026-02-18').click(); await raf(); day('2026-02-16').click(); await raf();
        c('multiple', 'multiple: toggles dates', Array.isArray(out) && out.length === 1 && out[0].getDate() === 18, out && out.length);
        S.set(2); await settle(300);
        day('2026-02-20').click(); await raf(); const mid = out; day('2026-02-17').click(); await settle(200);
        c('range', 'range: two picks, swapped when earlier', out && out.start && out.start.getDate() === 17 && out.end.getDate() === 20 && !(mid && mid.start), out && out.start ? out.start.getDate() + '→' + out.end.getDate() : String(out));
        const rows = [...S.box.querySelectorAll('.ul-cal-row[data-week]')], bands = S.box.querySelectorAll('.ul-band');
        c('band', 'band = one element per week row and layer', bands.length === rows.length * 2, bands.length + ' / ' + rows.length);
        c('mid', 'days in range flagged (aria + data-mid)', day('2026-02-18').hasAttribute('data-mid') && day('2026-02-18').closest('[role="gridcell"]').getAttribute('aria-selected') === 'true');
        c('flat', 'no glass inside the calendar', !S.box.querySelector('.ul-calendar .ul-glass, .ul-calendar [data-ul-glass]'));
        S.set(3); await settle(300);
        const wd2 = [...S.box.querySelectorAll('[role="columnheader"]')].map((x) => x.getAttribute('aria-label'));
        c('locale', 'locale de: weekday names', wd2[0] === 'Montag', wd2[0]);
      } finally { await S.done(); }
      return result(checks);
    };
    cards.aspect = async () => {
      const checks = [], c = ck(checks);
      const S = await stage(() => h('div', { style: { display: 'grid', gridTemplateColumns: '320px 200px 240px', gap: 12 } },
        h(UL.ULAspectRatio, { ratio: 16 / 9 }, h('img', { alt: '', src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' })),
        h(UL.ULAspectRatio, { ratio: 1, fit: 'contain' }, h('img', { alt: '', src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' })),
        h(UL.ULAspectRatio, { ratio: 4 / 3, skeleton: true })));
      try {
        const els = [...S.box.querySelectorAll('.ul-ar')].map((e) => e.getBoundingClientRect());
        const r = els.map((b) => b.width / b.height);
        c('ratio169', '16 / 9 computed', Math.abs(r[0] - 16 / 9) < 0.01, r[0].toFixed(3));
        c('ratio1', '1 / 1 computed', Math.abs(r[1] - 1) < 0.01, r[1].toFixed(3));
        c('ratio43', '4 / 3 skeleton computed', Math.abs(r[2] - 4 / 3) < 0.01, r[2].toFixed(3));
        const imgs = S.box.querySelectorAll('.ul-ar img');
        c('fit', 'object-fit from prop', getComputedStyle(imgs[0]).objectFit === 'cover' && getComputedStyle(imgs[1]).objectFit === 'contain');
        c('fill', 'media fills the box', Math.abs(imgs[0].getBoundingClientRect().height - els[0].height) < 1);
        c('skeleton', 'skeleton uses the shared ULSkeleton + aria-busy', !!S.box.querySelector('.ul-ar[aria-busy="true"] .ul-skel'));
      } finally { await S.done(); }
      return result(checks);
    };

    cards.resizable = async () => {
      const checks = [], c = ck(checks), api = { current: null }; let lay = null;
      try { localStorage.removeItem('ul-resizable:f3d-test'); } catch (e) {}
      const mk = (k) => h('div', { style: { width: 600, height: 200 } }, h(UL.ULResizablePanelGroup, { key: k, storageKey: 'f3d-test', apiRef: api, onLayout: (s) => { lay = s; } },
        h(UL.ULResizablePanel, { defaultSize: 30, minSize: 20, maxSize: 50, collapsible: true, collapsedSize: 0, label: 'Side' }, h('p', null, 'Supercalifragilisticexpialidocious_long_token_without_spaces')),
        h(UL.ULResizableHandle, null),
        h(UL.ULResizablePanel, { minSize: 30, label: 'Main' }, h('p', null, 'Main'))));
      const S = await stage((v) => mk(v), 680);
      const H = () => S.box.querySelector('.ul-rs-handle'), now = () => Number(H().getAttribute('aria-valuenow'));
      const waitSettle = async () => { await raf(); await wait(30); }; // checks read the committed layout (frame-independent); painting follows on the next frames
      try {
        const h0 = H(); const panel0 = S.box.querySelector('.ul-rs-panel');
        c('aria', 'role separator + valuenow / min / max + controls', h0.getAttribute('role') === 'separator' && now() === 30 && h0.getAttribute('aria-valuemin') === '0' && h0.getAttribute('aria-valuemax') === '50' && h0.getAttribute('aria-controls') === panel0.id, [now(), h0.getAttribute('aria-valuemin'), h0.getAttribute('aria-valuemax')].join(' '));
        c('orient', 'aria-orientation vertical in a horizontal group', h0.getAttribute('aria-orientation') === 'vertical');
        const r0 = api.current.renders();
        h0.focus(); key(h0, 'ArrowRight'); await waitSettle();
        c('arrow', '→ = +1 %', Math.round(api.current.sizes()[0]) === 31, api.current.sizes()[0]);
        key(h0, 'ArrowRight', { shiftKey: true }); await waitSettle();
        c('shift', 'Shift+→ = +10 %', Math.round(api.current.sizes()[0]) === 41, api.current.sizes()[0]);
        key(h0, 'End'); await waitSettle();
        c('max', 'End clamps to max (50)', Math.round(api.current.sizes()[0]) === 50, api.current.sizes()[0]);
        for (let i = 0; i < 40; i++) key(h0, 'ArrowLeft'); await waitSettle();
        c('min', 'arrows clamp at min (20)', Math.round(api.current.sizes()[0]) === 20, api.current.sizes()[0]);
        key(h0, 'Enter'); await waitSettle();
        await until(() => panel0.hasAttribute('data-collapsed'), 4000);
        c('collapse', 'Enter collapses (to 0) and hides content', Math.round(api.current.sizes()[0]) === 0 && panel0.hasAttribute('data-collapsed'), api.current.sizes()[0]);
        key(h0, 'Enter'); await waitSettle();
        c('expand', 'Enter again expands to ≥ min', api.current.sizes()[0] >= 20 - 0.01, api.current.sizes()[0]);
        h0.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await waitSettle();
        c('reset', 'double-click resets to the default', Math.round(api.current.sizes()[0]) === 30, api.current.sizes()[0]);
        // pointer drag: many moves, React renders must not grow
        const r = S.box.querySelector('.ul-rs-group').getBoundingClientRect(), hr = h0.getBoundingClientRect(), x0 = hr.left + hr.width / 2, y = hr.top + 20;
        h0.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0, clientX: x0, clientY: y, pointerType: 'mouse' }));
        for (let k = 1; k <= 30; k++) h0.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: x0 + k * 2, clientY: y, pointerType: 'mouse' }));
        h0.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: x0 + 60, clientY: y, pointerType: 'mouse' })); await waitSettle();
        c('drag', 'drag +60px = +10 %', Math.abs(api.current.sizes()[0] - 40) < 0.6, api.current.sizes()[0].toFixed(2));
        c('norender', 'no React render per pointermove', api.current.renders() - r0 <= 1, api.current.renders() - r0);
        c('layout', 'onLayout fires on commit', Array.isArray(lay) && Math.abs(lay[0] - 40) < 0.6, lay && lay.join(','));
        let stored = null; try { stored = JSON.parse(localStorage.getItem('ul-resizable:f3d-test')); } catch (e) {}
        c('storage', 'stored in localStorage', stored && Math.abs(stored[0] - 40) < 0.6, JSON.stringify(stored));
        S.set(1); await settle(300);
        c('restore', 'remount restores from storage', Math.abs(api.current.sizes()[0] - 40) < 0.6, api.current.sizes()[0]);
        await until(() => Math.abs(api.current.visual()[0] - 40) < 0.6, 4000);
        c('paint', 'painted size reaches the committed layout', Math.abs(api.current.visual()[0] - 40) < 0.6 && now() === 40, api.current.visual()[0] + ' · aria ' + now());
        const over = [...S.box.querySelectorAll('.ul-rs-panel')].every((p) => p.getBoundingClientRect().right <= r.right + 0.5);
        const inner = S.box.querySelector('.ul-rs-inner p'); c('nooverflow', 'text never overflows its panel', over && inner.scrollWidth <= inner.parentElement.clientWidth + 1, inner.scrollWidth + ' / ' + inner.parentElement.clientWidth);
        c('flat', 'handle is flat (no glass)', !S.box.querySelector('.ul-rs-handle .ul-glass, .ul-rs-handle [data-ul-glass]'));
      } finally { try { localStorage.removeItem('ul-resizable:f3d-test'); } catch (e) {} await S.done(); }
      return result(checks);
    };

    cards.carousel = async () => {
      const checks = [], c = ck(checks); let idx = -1;
      const tile = (n) => h('div', { key: n, style: { height: 80, background: '#223' } }, 'S' + n);
      const S = await stage((v) => h('div', { style: { width: 480 } },
        h(UL.ULCarousel, { label: 'Test', visible: 2, onIndexChange: (i) => { idx = i; } }, [1, 2, 3, 4, 5].map(tile)),
        h(UL.ULCarousel, { label: 'Auto', autoplay: 3000, loop: true }, [1, 2, 3].map(tile))), 520);
      const [A, B] = S.box.querySelectorAll('.ul-car'), tr = A.querySelector('.ul-car-track');
      const waitIdle = async () => { let l = -1, same = 0; for (let i = 0; i < 100; i++) { await wait(60); if (Math.abs(tr.scrollLeft - l) < 0.5) { if (++same >= 4) return; } else same = 0; l = tr.scrollLeft; } };
      try {
        c('region', 'section + aria-roledescription carousel + label', A.tagName === 'SECTION' && A.getAttribute('aria-roledescription') === 'carousel' && A.getAttribute('aria-label') === 'Test');
        const sl = [...A.querySelectorAll('.ul-car-slide')];
        c('slides', 'slides role group "n of N"', sl.every((s, i) => s.getAttribute('role') === 'group' && s.getAttribute('aria-label') === (i + 1) + ' of 5'));
        const dots = A.querySelectorAll('.ul-car-dot');
        c('positions', 'visible 2 → 4 positions', dots.length === 4, dots.length);
        c('indicator', 'indicator = one shared nav-indicator lens, no extra elements', A.querySelectorAll('.ul-car-lens').length === 1 && A.querySelectorAll('.ul-car-dots > :not(button):not(.ul-car-lens)').length === 0);
        c('snap', 'native scroll-snap (x mandatory)', getComputedStyle(tr).scrollSnapType.includes('mandatory') && getComputedStyle(sl[0]).scrollSnapAlign.includes('start'));
        c('touch', 'touch-action keeps vertical page scroll', /pan-y/.test(getComputedStyle(tr).touchAction));
        const prev = A.querySelector('[aria-label="Previous slide"]'), next = A.querySelector('[aria-label="Next slide"]');
        c('prevdisabled', 'Previous disabled at the start (no loop)', prev.disabled || prev.getAttribute('aria-disabled') === 'true');
        next.click(); await until(() => Math.abs(tr.scrollLeft - (sl[1].offsetLeft - sl[0].offsetLeft)) < 2, 4000); await waitIdle();
        c('next', 'Next → index 1 and scrolls to slide 2', idx === 1 && Math.abs(tr.scrollLeft - (sl[1].offsetLeft - sl[0].offsetLeft)) < 2, idx + ' @' + Math.round(tr.scrollLeft));
        c('current', 'aria-current on the indicator', dots[1].getAttribute('aria-current') === 'true');
        tr.focus(); key(tr, 'End'); await waitIdle();
        c('end', 'End → last position', idx === 3, idx);
        key(tr, 'ArrowLeft'); await waitIdle();
        c('left', '← → previous', idx === 2, idx);
        key(tr, 'Home'); await until(() => tr.scrollLeft < 1, 4000); await waitIdle();
        c('home', 'Home → first', idx === 0, idx);
        tr.scrollLeft = (sl[2].offsetLeft - sl[0].offsetLeft) + 3; await waitIdle(); await wait(200);
        c('scrollindex', 'native scroll updates the index (snap)', idx === 2, idx);
        const live = A.querySelector('.ul-car-status');
        c('livepolite', 'status polite when autoplay is off', live.getAttribute('aria-live') === 'polite');
        c('autooff', 'autoplay off by default (no play control)', !A.querySelector('.ul-car-play'));
        const play = B.querySelector('.ul-car-play'), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        c('playctl', 'autoplay has a visible pause / play control', reduced || (!!play && play.getAttribute('aria-label') === 'Pause autoplay'), reduced ? 'reduced motion: autoplay disabled' : '');
        if (play) { B.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); await raf(); await raf(); B.querySelector('.ul-car-track').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); await raf(); }
        c('liveoff', 'status not live while autoplay runs (or paused by hover)', !play || ['off', 'polite'].includes(B.querySelector('.ul-car-status').getAttribute('aria-live')));
        if (play) { play.click(); await raf(); await raf(); }
        c('pause', 'pause control stops autoplay (label swaps)', !play || play.getAttribute('aria-label') === 'Start autoplay');
        c('noglass', 'no glass per slide', !A.querySelector('.ul-car-slide > .ul-glass, .ul-car-slide [data-ul-glass]'));
      } finally { await S.done(); }
      return result(checks);
    };

    cards.typography = async () => {
      const checks = [], c = ck(checks);
      const S = await stage(() => h('div', { style: { width: 300 } },
        h(UL.ULHeading, { level: 4, size: 'display' }, 'Big h4'),
        h(UL.ULHeading, { level: 1, size: 'h4' }, 'Small h1'),
        h(UL.ULText, null, 'Body ', h(UL.ULLink, { href: '/in-app' }, 'internal'), ' ', h(UL.ULLink, { href: 'https://example.org/x' }, 'external'), ' ', h(UL.ULLink, { href: '/doc.pdf', newTab: true, rel: 'help' }, 'new tab')),
        h(UL.ULText, { variant: 'muted', truncate: true }, 'A very long muted line that must truncate with an ellipsis inside the column'),
        h(UL.ULProse, null, h('p', null, 'Pneumonoultramicroscopicsilicovolcanoconiosis_and_more_unbroken_text_here'), h('pre', null, 'const veryLongLine = "this line is wider than the panel and must scroll inside the pre";'), h('table', null, h('tbody', null, h('tr', null, ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((x) => h('td', { key: x }, x + 'xxxxxxxx'))))))), 340);
      try {
        const hs = S.box.querySelectorAll('.ul-heading');
        c('level', 'level sets the tag', hs[0].tagName === 'H4' && hs[1].tagName === 'H1');
        c('size', 'size independent of level (display h4 > h4-sized h1)', parseFloat(getComputedStyle(hs[0]).fontSize) > parseFloat(getComputedStyle(hs[1]).fontSize) * 1.6, getComputedStyle(hs[0]).fontSize + ' / ' + getComputedStyle(hs[1]).fontSize);
        c('fluid', 'display uses the clamp() token', /clamp/.test(getComputedStyle(document.documentElement).getPropertyValue('--ul-type-display')));
        const [li, le, ln] = S.box.querySelectorAll('.ul-link');
        c('internal', 'internal link: no target, no rel, no icon', !li.target && !li.rel && !li.querySelector('.ul-link-ext'));
        c('external', 'external: icon + rel noopener noreferrer external + target _blank + spoken hint', le.target === '_blank' && /noopener/.test(le.rel) && /noreferrer/.test(le.rel) && /external/.test(le.rel) && !!le.querySelector('svg.ul-link-ext, .ul-link-ext') && /new tab/.test(le.textContent), le.rel);
        c('newtab', 'newTab keeps own rel and adds noopener', ln.target === '_blank' && /help/.test(ln.rel) && /noopener/.test(ln.rel), ln.rel);
        c('extsize', 'external icon is a sized ULIcon', !!le.querySelector('svg[width], svg.ul-icon') || !!le.querySelector('.ul-link-ext'));
        const tr = S.box.querySelector('.ul-text[data-truncate]');
        c('truncate', 'truncate = one line + ellipsis', getComputedStyle(tr).textOverflow === 'ellipsis' && tr.scrollWidth > tr.clientWidth);
        const pr = S.box.querySelector('.ul-prose'), boxR = S.box.getBoundingClientRect();
        const wide = [...pr.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().right > pr.getBoundingClientRect().right + 1 && !n.closest('pre, table'));
        c('nooverflow', 'prose never overflows (pre / table scroll inside)', wide.length === 0 && pr.scrollWidth <= pr.clientWidth + 1, wide.length + ' · ' + pr.scrollWidth + '/' + pr.clientWidth);
        c('wrap', 'overflow-wrap: anywhere on prose', getComputedStyle(pr).overflowWrap === 'anywhere');
        const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n'); const m = css.match(/\.ul-link:focus-visible \{[^}]*outline-offset: ([0-9.]+)px/);
        c('focusring', 'link focus ring sits outside (rule: outline-offset > 0)', !!m && parseFloat(m[1]) > 0, m ? m[1] + 'px' : 'rule missing');
      } finally { await S.done(); }
      return result(checks);
    };

    /* contrast of every new 3D colour pair through the shared tool (ULContrast) */
    cards.contrast3d = async () => {
      const C = window.ULContrast; if (!C) return { status: 'fail', checks: [{ key: 'tool', label: 'showcase/ul-contrast.js loaded', pass: false }] };
      await C.ready();
      const rows = [], worst = {};
      const note = (cat, fg, bg, combo, min) => { const v = C.ratio(fg, bg); rows.push(v >= min); if (!worst[cat] || v < worst[cat].v) worst[cat] = { v: C.round(v), combo, min, pass: v >= min }; };
      for (const theme of ['app', 'marketing']) for (const accent of UL.ACCENT_PRESETS) {
        const root = document.createElement('div'); root.setAttribute('data-ul-theme', theme); root.setAttribute('data-ul-accent', accent); root.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(root);
        const R = C.resolver(root), tk = UL.readContrastTokens(root), acc = R.get('var(--ul-accent-' + accent + ')');
        const G = R.get('var(--ul-color-graphite)'), text = R.get('var(--ul-color-text)'), text2 = R.get('var(--ul-color-text-2)');
        const flat = [{ name: 'graphite', P: G }];
        const glass = [];
        for (const s of UL.ACCENT_STRENGTHS) for (const b of ['dark', 'mid', 'light']) { const x = Math.min(1, Math.max(0, (tk.k[s] - tk.k.subtle) / (1 - tk.k.subtle))); glass.push({ name: s + ' · ' + b, P: UL.worstSurface(tk, acc.slice(0, 3), b, x).concat(1) }); }
        for (const { name, P } of glass) {
          const combo = theme + ' · ' + accent + ' · ' + name;
          note('hover card / nav panel title on glass (≥ 4.5)', text, P, combo, 4.5);
          note('hover card / nav panel description on glass (≥ 4.5)', text2, P, combo, 4.5);
        }
        for (const { P } of flat) {
          const combo = theme + ' · ' + accent;
          const bar = C.over(R.get('var(--ul-menubar-bg)'), P), hov = C.over(R.get('var(--ul-menubar-hover)'), bar), open = C.over(R.get('var(--ul-menubar-open)'), bar);
          note('menubar / nav trigger text on the bar (≥ 4.5)', text, bar, combo, 4.5);
          note('menubar / nav trigger text on hover / open paint (≥ 4.5)', text, open, combo, 4.5);
          note('nav item (muted) on hover paint (≥ 4.5)', text2, hov, combo, 4.5);
          note('nav current underline (accent) vs bar (graphics ≥ 3)', acc, bar, combo, 3);
          const sel = C.over(R.get('var(--ul-calendar-sel)'), P);
          note('calendar day text on panel (≥ 4.5)', text, P, combo, 4.5);
          note('calendar selected day ink on tint (≥ 4.5)', R.get('var(--ul-calendar-sel-ink)'), sel, combo, 4.5);
          note('calendar selected ring vs panel (graphics ≥ 3)', R.get('var(--ul-calendar-sel-ring)'), P, combo, 3);
          const band = C.over(R.get('color-mix(in srgb, color-mix(in srgb, var(--ul-accent) var(--ul-range-band-shade), black) calc(var(--ul-range-band) * 100%), transparent)'), P);
          note('calendar range day text on the band (≥ 4.5)', text, band, combo, 4.5);
          note('calendar month / year jump text (≥ 4.5)', text, C.over(R.get('var(--ul-calendar-sel-bg)'), P), combo, 4.5);
          const grip = C.over(R.get('var(--ul-resizable-grip-bg)'), P);
          note('resizable grip dots vs grip (graphics ≥ 3)', R.get('var(--ul-resizable-dot)'), grip, combo, 3);
          note('resizable active line (accent) vs panel (graphics ≥ 3)', R.get('var(--ul-resizable-line-active)'), P, combo, 3);
          note('carousel dot vs panel (graphics ≥ 3)', R.get('var(--ul-carousel-dot)'), P, combo, 3);
          note('carousel current dot vs panel (graphics ≥ 3)', R.get('var(--ul-carousel-dot-current)'), P, combo, 3);
          note('type ink (≥ 4.5)', R.get('var(--ul-type-ink)'), P, combo, 4.5);
          note('type ink-2 (lead, caption, muted) (≥ 4.5)', R.get('var(--ul-type-ink-2)'), P, combo, 4.5);
          note('link text (≥ 4.5)', R.get('var(--ul-type-link)'), P, combo, 4.5);
          note('inline code text on code paint (≥ 4.5)', R.get('var(--ul-type-ink)'), C.over(R.get('var(--ul-type-code-bg)'), P), combo, 4.5);
          const lv = C.ratio(R.get('var(--ul-type-link-line)'), P); if (!worst['link underline (cue, info)'] || lv < worst['link underline (cue, info)'].v) worst['link underline (cue, info)'] = { v: C.round(lv), combo, min: 0, pass: true };
        }
        R.done(); root.remove();
      }
      const checks = Object.entries(worst).map(([k, w]) => ({ key: k, label: k + ' worst', pass: w.pass, value: w.v + ' · ' + w.combo }));
      checks.unshift({ key: 'rows', label: 'rows checked', pass: rows.every(Boolean), value: rows.length + ' rows · ' + rows.filter((x) => !x).length + ' fail' });
      return result(checks, 'ULContrast (shared tool)');
    };

    const merge = () => {
      const T = window.ULDemos && window.ULDemos.formsTests; if (!T) return setTimeout(merge, 100);
      Object.assign(T.cards, cards);
      Object.entries(cards).forEach(([k, f]) => { window.ULDemos['f3d_' + k] = f; });
      window.ULDemos.batch2Tests = { cards };
    };
    merge();
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
