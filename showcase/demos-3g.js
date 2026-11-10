// Task 3C tests: ULDemos.formsTests = { cards, guard, contrast } + ULDemos.__formsGuard(kind) for the shared guard cards.
// Frame-independent cards PASS / FAIL in any preview; frame cards (collheight, tglide) report NEEDS HEALTHY PREVIEW under 50 fps.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value: value == null ? '' : String(value) });
    const result = (checks, driver = 'DOM (frame-independent)') => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver });
    const settle = async (ms = 500) => { await wait(ms); await raf(); await raf(); };
    const key = (el, k, o = {}) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));
    const esc = () => key(document.activeElement || document.body, 'Escape');
    async function stage(el, w = 760) {
      const box = document.createElement('div');
      box.setAttribute('data-ul-theme', document.querySelector('[data-ul-theme]')?.getAttribute('data-ul-theme') || 'app');
      box.style.cssText = `position:fixed;left:12px;top:12px;z-index:50;width:${Math.min(w, innerWidth - 24)}px;max-height:${innerHeight - 24}px;overflow:auto;padding:16px;box-sizing:border-box;border-radius:16px;background:#0d1117;box-shadow:0 10px 40px rgb(0 0 0/.6)`;
      document.body.appendChild(box);
      const root = window.ReactDOM.createRoot(box); let setV = null;
      function Host() { const [v, set] = React.useState(0); setV = set; return el(v); }
      root.render(h(Host)); await settle(300);
      return { box, set: (v) => setV(v), rerender: async () => { setV((x) => x + 1); await settle(120); }, done: async () => { root.unmount(); box.remove(); await wait(60); } };
    }
    // polite live region spy (the shared announce region)
    function liveSpy() {
      const seen = []; const mo = new MutationObserver(() => { document.querySelectorAll('[aria-live]').forEach((n) => { const t = n.textContent.trim(); if (t && !seen.includes(t)) seen.push(t); }); });
      mo.observe(document.body, { subtree: true, childList: true, characterData: true }); return { seen, stop: () => mo.disconnect() };
    }
    async function fps(ms = 500) { let n = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { await raf(); n++; } return (n * 1000) / (performance.now() - t0); }

    /* ---------- cards ---------- */
    async function fieldaria() {
      const checks = [], c = ck(checks); let err = null;
      const S = await stage(() => h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('button', { type: 'button', id: 't-before' }, 'focus here'),
        h(UL.ULField, { id: 't-email', label: 'Email', required: true, description: 'Desc', error: err }, h(UL.ULTextField, { label: 'Email', floating: false })),
        h(UL.ULField, { id: 't-native', label: 'Native', optional: true }, h('input', null)),
        h(UL.ULField, { id: 't-rp', label: 'Render prop', error: ['A', 'B'] }, (p) => h('input', Object.assign({ 'data-rp': '' }, p)))));
      try {
        const inp = S.box.querySelector('#t-email'), lab = S.box.querySelector('label[for="t-email"]');
        c('label', 'label[for] targets the control id (one label, ULTextField drops its own)', !!inp && !!lab && S.box.querySelectorAll('#t-email').length === 1 && !inp.closest('.ul-field').querySelector('.ul-field-label'), inp ? inp.tagName : 'none');
        c('desc', 'aria-describedby = description id (no error yet), aria-required', inp.getAttribute('aria-describedby') === 't-email-desc' && inp.getAttribute('aria-required') === 'true' && !inp.hasAttribute('aria-invalid'), inp.getAttribute('aria-describedby'));
        const before = S.box.querySelector('#t-before'); before.focus();
        const spy = liveSpy(); err = 'Enter a valid email address.'; await S.rerender(); await wait(400); spy.stop();
        const ids = (inp.getAttribute('aria-describedby') || '').split(' ');
        c('err', 'error: aria-invalid, aria-errormessage → error node, describedby = desc + error, nodes exist', inp.getAttribute('aria-invalid') === 'true' && inp.getAttribute('aria-errormessage') === 't-email-err' && ids.includes('t-email-err') && ids.every((i) => !!document.getElementById(i)), inp.getAttribute('aria-describedby'));
        c('announce', 'new error announced once through the polite live region', spy.seen.some((t) => t.includes('valid email')), spy.seen.slice(-2).join(' | ') || 'nothing');
        c('focus', 'focus did not move when the error appeared', document.activeElement === before, document.activeElement && (document.activeElement.id || document.activeElement.tagName));
        c('nolive', 'error node itself has no aria-live (no double announcement)', !document.getElementById('t-email-err')?.closest('[aria-live]'), '');
        const nat = S.box.querySelector('#t-native');
        c('native', 'native child cloned with id (label[for] works)', !!nat && !!S.box.querySelector('label[for="t-native"]'), nat ? 'ok' : 'none');
        const rp = S.box.querySelector('[data-rp]');
        c('renderprop', 'render prop gets id + aria-invalid + aria-errormessage; error list has 2 items', !!rp && rp.id === 't-rp' && rp.getAttribute('aria-invalid') === 'true' && S.box.querySelectorAll('#t-rp-err li').length === 2, rp ? rp.getAttribute('aria-errormessage') : 'none');
        err = null; await S.rerender();
        c('clear', 'error removed: aria-invalid / aria-errormessage gone', !inp.hasAttribute('aria-invalid') && !inp.hasAttribute('aria-errormessage'), inp.getAttribute('aria-describedby'));
      } finally { await S.done(); }
      return result(checks);
    }
    async function inputgroup() {
      const checks = [], c = ck(checks); let v = 'hello';
      const S = await stage(() => h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h(UL.ULField, { id: 'ig-a', label: 'A' }, h(UL.ULInputGroup, { prefix: 'https://', clearable: true, maxLength: 20 }, h(UL.ULInputGroupInput, { value: v, onValueChange: (x) => { v = x; S && S.rerender(); } }))),
        h(UL.ULField, { id: 'ig-b', label: 'B' }, h(UL.ULInputGroup, { suffix: 'kg', clearable: true }, h(UL.ULTextField, { label: 'B', floating: false, defaultValue: 'abc' }))),
        h(UL.ULField, { id: 'ig-c', label: 'C' }, h(UL.ULInputGroup, { actions: h(UL.ULCopyButton, { value: 'x', variant: 'icon' }) }, h(UL.ULSelect, { label: 'C', options: [{ value: 'a', label: 'A' }], defaultValue: 'a' })))));
      try {
        const g = S.box.querySelector('.ul-igroup'), inp = S.box.querySelector('#ig-a');
        inp.focus(); await raf(); await wait(200);
        const gs = getComputedStyle(g).boxShadow, is = getComputedStyle(inp);
        const outer = gs.split(/,(?![^(]*\))/).some((p) => !/inset/.test(p) && /\s0px\s0px\s0px\s[1-9]/.test(p.trim()) || (!/inset/.test(p) && /0px 0px 0px [1-9]/.test(p)));
        c('ring', 'focus ring is OUTSIDE the well (non-inset spread on the group)', outer, gs.slice(0, 90));
        c('noborder', 'inner input: no border, no box-shadow, no outline (one well)', parseFloat(is.borderTopWidth) === 0 && is.boxShadow === 'none' && (is.outlineStyle === 'none' || parseFloat(is.outlineWidth) === 0), `${is.borderTopWidth} · ${is.boxShadow} · ${is.outlineStyle}`);
        const wellB = S.box.querySelectorAll('.ul-igroup')[1].querySelector('.ul-well'), ws = getComputedStyle(wellB);
        c('innerwell', 'ULTextField in a group: its own well is stripped (no background, no rim)', ws.backgroundImage === 'none' && (ws.backgroundColor === 'rgba(0, 0, 0, 0)' || ws.backgroundColor === 'transparent') && ws.boxShadow === 'none', `${ws.backgroundColor} · ${ws.boxShadow}`);
        c('counter', 'counter shows n/max and is in aria-describedby', g.querySelector('.ul-icount')?.textContent === '5/20' && (inp.getAttribute('aria-describedby') || '').includes(g.querySelector('.ul-icount').id), g.querySelector('.ul-icount')?.textContent);
        const clr = g.querySelector('.ul-igroup-clear'); clr && clr.click(); await settle(150);
        c('clear', 'clear button empties the value and focuses the input', !!clr && v === '' && document.activeElement === inp && !g.querySelector('.ul-igroup-clear'), `value "${v}" · focus ${document.activeElement && document.activeElement.id}`);
        const tB = S.box.querySelectorAll('.ul-igroup')[1], clrB = tB.querySelector('.ul-igroup-clear'); clrB && clrB.click(); await settle(150);
        const tIn = tB.querySelector('input');
        c('clearul', 'clear works for ULTextField inside a group (registered clear + focus)', !!clrB && tIn.value === '' && document.activeElement === tIn, tIn.value);
        const trig = S.box.querySelector('.ul-select-trigger'), copy = S.box.querySelectorAll('.ul-igroup')[2].querySelector('.ul-btn');
        c('plain', 'ULSelect trigger is plain in a group (no glass); ULCopyButton plain variant', trig?.hasAttribute('data-plain') && !trig.classList.contains('ul-glass') && !!copy && (copy.getAttribute('data-variant') === 'plain' || copy.className.includes('plain')), `${trig && trig.className} · ${copy && copy.getAttribute('data-variant')}`);
        c('selectlabel', 'select inside ULField: labelled by the field label', (trig?.getAttribute('aria-labelledby') || '').split(' ').includes('ig-c-label'), trig?.getAttribute('aria-labelledby'));
      } finally { await S.done(); }
      return result(checks);
    }
    async function alerts() {
      const checks = [], c = ck(checks); let dismissed = 0;
      const S = await stage(() => h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } }, ['info', 'success', 'warning', 'danger', 'neutral'].map((t) => h(UL.ULAlert, { key: t, tone: t, title: t, description: 'd', dismissible: t === 'success', onDismiss: () => dismissed++ }))));
      try {
        const roles = [...S.box.querySelectorAll('.ul-alert')].map((n) => n.dataset.tone + ':' + n.getAttribute('role'));
        c('roles', 'role="alert" for warning / danger, "status" for info / success / neutral', roles.join(',') === 'info:status,success:status,warning:alert,danger:alert,neutral:status', roles.join(','));
        const glass = [...S.box.querySelectorAll('.ul-alert, .ul-alert *')].filter((n) => { const s = getComputedStyle(n); return (s.backdropFilter && s.backdropFilter !== 'none') || n.classList.contains('ul-glass'); });
        c('flat', 'in-flow tinted paint: no glass / backdrop-filter inside alerts', !glass.length, glass.length + ' glass nodes');
        const x = S.box.querySelector('.ul-alert[data-tone="success"] .ul-alert-x');
        c('xname', 'dismiss button has an accessible name and a 44px hit area', !!x && !!x.getAttribute('aria-label') && x.getBoundingClientRect().width >= 44, x && x.getAttribute('aria-label'));
        x && x.click(); await settle(100);
        c('dismiss', 'dismiss removes the alert and calls onDismiss once', dismissed === 1 && !S.box.querySelector('.ul-alert[data-tone="success"]'), dismissed);
      } finally { await S.done(); }
      return result(checks);
    }
    async function alertdialog() {
      const checks = [], c = ck(checks); let open = false, cancels = 0, mode = 'plain';
      const S = await stage((v) => {
        const ref = React.useRef(null);
        return h('div', null, h(UL.ULButton, { ref, 'data-t-trig': '', onClick: () => { open = true; S.rerender(); } }, 'Delete'),
          h(UL.ULAlertDialog, { open, onOpenChange: (o) => { open = o; S.rerender(); }, triggerRef: ref, tone: 'destructive', title: 'Delete?', description: 'd', actionLabel: 'Delete', onAction: () => wait(50), onCancel: () => cancels++, typeToConfirm: mode === 'type' ? 'yes' : undefined }));
      });
      const surf = () => [...document.querySelectorAll('[role="alertdialog"]')].find((n) => n.getClientRects().length);
      try {
        const trig = S.box.querySelector('[data-t-trig]');
        trig.focus(); trig.click(); await settle(900);
        const s = surf();
        c('role', 'surface role="alertdialog", labelled', !!s && !!s.getAttribute('aria-labelledby'), s ? s.getAttribute('aria-labelledby') : 'none');
        c('initial', 'initial focus on Cancel', document.activeElement && document.activeElement.hasAttribute('data-ul-alert-cancel'), document.activeElement && document.activeElement.textContent);
        const b = trig.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        c('covered', 'covered: the trigger is under the top-layer scrim / surface once settled (not hit)', !trig.contains(hit), hit ? (hit.className || hit.tagName).toString().slice(0, 40) : 'null');
        c('toplayer', 'surface is in the top layer (popover / modal)', !!s && (s.matches(':popover-open') || !!s.closest(':popover-open') || s.matches(':modal') || !!s.closest('dialog[open]')), '');
        esc(); await settle(900);
        c('esc', 'Esc cancels (onCancel) and closes', !surf() && cancels >= 1 && !open, `cancels ${cancels}`);
        c('return', 'focus returns to the trigger', document.activeElement === trig, document.activeElement && document.activeElement.textContent);
        trig.click(); await settle(900);
        const pt = document.elementFromPoint(4, innerHeight - 4); ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((t) => pt && pt.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, { bubbles: true, cancelable: true, clientX: 4, clientY: innerHeight - 4, button: 0 })));
        await settle(900);
        c('scrim', 'scrim click cancels', !surf() && cancels >= 2, `cancels ${cancels}`);
        mode = 'type'; await S.rerender(); trig.click(); await settle(900);
        const act = () => surf()?.querySelector('[data-ul-alert-action]') || surf()?.querySelectorAll('.ul-alertdlg-foot .ul-btn')[1];
        const d0 = act()?.disabled;
        const ti = surf()?.querySelector('.ul-field input');
        if (ti) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(ti, 'yes'); ti.dispatchEvent(new Event('input', { bubbles: true })); }
        await settle(150);
        c('type', 'type-to-confirm: action disabled until the text matches (reuses ULTypeToConfirm)', d0 === true && act()?.disabled === false, `before ${d0} · after ${act()?.disabled}`);
        esc(); await settle(700);
      } finally { esc(); await wait(300); await S.done(); }
      return result(checks);
    }
    async function togglegroup() {
      const checks = [], c = ck(checks);
      let single = 'a', multi = ['x'];
      const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }];
      const S = await stage(() => h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { 'data-t': 'seg' }, h(UL.ULSegmentedControl, { 'aria-label': 'seg', options: items, defaultValue: 'a' })),
        h('div', { 'data-t': 'single' }, h(UL.ULToggleGroup, { 'aria-label': 'single', items, value: single, onValueChange: (v) => { single = v; S.rerender(); } })),
        h('div', { 'data-t': 'multi' }, h(UL.ULToggleGroup, { type: 'multiple', 'aria-label': 'multi', items: [{ value: 'x', label: 'X' }, { value: 'y', icon: h(UL.ULIcon, { name: 'star', size: 'md' }), tooltip: 'Star' }, { value: 'z', label: 'Z' }], value: multi, onValueChange: (v) => { multi = v; S.rerender(); } }))));
      try {
        await settle(300);
        const q = (k) => S.box.querySelector(`[data-t="${k}"]`);
        const lens = (k) => q(k).querySelectorAll('.ul-lens-wrap').length;
        c('indicator', 'single mode: exactly the shared indicator (same .ul-lens-wrap count as ULSegmentedControl); multiple: none', lens('single') === lens('seg') && lens('single') <= 1 && lens('multi') === 0, `seg ${lens('seg')} · single ${lens('single')} · multi ${lens('multi')}`);
        const sg = q('single').querySelector('[role="radiogroup"]'), radios = [...sg.querySelectorAll('[role="radio"]')];
        c('radio', 'single: radiogroup / radio, aria-checked, one tabindex 0', radios.length === 3 && radios.filter((r) => r.tabIndex === 0).length === 1 && radios[0].getAttribute('aria-checked') === 'true', radios.map((r) => r.tabIndex).join(','));
        radios[0].focus(); key(radios[0], 'ArrowRight'); await settle(200);
        c('roving', 'single: ArrowRight moves focus AND selects (roving tabindex follows)', single === 'b' && document.activeElement === radios[1] && radios[1].tabIndex === 0, `value ${single} · focus ${document.activeElement && document.activeElement.textContent}`);
        const mg = q('multi').querySelector('[role="group"]'), btns = [...mg.querySelectorAll('button')];
        c('pressed', 'multiple: group + aria-pressed buttons, no radio roles', btns.length === 3 && btns.every((b) => b.hasAttribute('aria-pressed') && !b.getAttribute('role')) && btns[0].getAttribute('aria-pressed') === 'true', btns.map((b) => b.getAttribute('aria-pressed')).join(','));
        btns[0].focus(); key(btns[0], 'ArrowRight'); await settle(150);
        c('mroving', 'multiple: arrows move focus only (pressed state unchanged), tabindex follows focus', document.activeElement === btns[1] && multi.join() === 'x' && btns[1].tabIndex === 0, `focus ${document.activeElement && document.activeElement.getAttribute('aria-label')} · ${multi}`);
        btns[1].click(); await settle(150);
        c('toggle', 'multiple: click toggles independently', multi.join() === 'x,y', multi.join());
        c('icononly', 'icon-only item: aria-label + data-ul-tip (anchored tooltip), no title attribute', btns[1].getAttribute('aria-label') === 'Star' && btns[1].getAttribute('data-ul-tip') === 'Star' && !btns[1].hasAttribute('title'), btns[1].getAttribute('aria-label'));
      } finally { await S.done(); }
      return result(checks);
    }
    async function separator() {
      const checks = [], c = ck(checks);
      const S = await stage(() => h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } }, h(UL.ULSeparator), h(UL.ULSeparator, { decorative: true }), h(UL.ULSeparator, { label: 'or' }), h('div', { style: { display: 'flex', height: 24 } }, h(UL.ULSeparator, { orientation: 'vertical' }))));
      try {
        const s = [...S.box.querySelectorAll('.ul-sep')];
        c('role', 'role separator + aria-orientation; decorative = role none', s[0].getAttribute('role') === 'separator' && s[0].getAttribute('aria-orientation') === 'horizontal' && s[1].getAttribute('role') === 'none' && s[3].getAttribute('aria-orientation') === 'vertical', s.map((n) => n.getAttribute('role')).join(','));
        const vb = s[3].getBoundingClientRect();
        c('vertical', 'vertical separator: 1px wide, stretches to the row', Math.round(vb.width) === 1 && vb.height >= 20, `${vb.width}×${vb.height}`);
        c('label', 'labelled separator keeps the label on one line', s[2].querySelector('.ul-sep-label')?.getClientRects().length === 1, s[2].textContent);
      } finally { await S.done(); }
      return result(checks);
    }
    async function kbd() {
      const checks = [], c = ck(checks);
      const caps = (combo, p, l) => UL.formatKeys(combo, p, l).map((k) => k.cap).join(' ');
      c('mac', 'mac: Mod+Shift+K → ⌘ ⇧ K', caps('Mod+Shift+K', 'mac') === '⌘ ⇧ K', caps('Mod+Shift+K', 'mac'));
      c('other', 'other: Mod+K → Ctrl K; de → Strg K', caps('Mod+K', 'other', 'en') === 'Ctrl K' && caps('Mod+K', 'other', 'de') === 'Strg K', caps('Mod+K', 'other', 'de'));
      const S = await stage(() => h('div', null, h(UL.ULKbd, { keys: 'Mod+K', platform: 'other' }), ' ', h(UL.ULKbd, { keys: ['G', 'D'], platform: 'mac', locale: 'sk' })));
      try {
        const k = S.box.querySelectorAll('.ul-kbd');
        c('spoken', 'aria-label is the spoken combo; sequence uses the localised "then"', k[0].getAttribute('aria-label') === 'Control + K' && k[1].getAttribute('aria-label') === 'G potom D', `${k[0].getAttribute('aria-label')} · ${k[1].getAttribute('aria-label')}`);
        c('tabular', 'caps use tabular numerals, one line', getComputedStyle(k[0].querySelector('.ul-kbd-key')).fontVariantNumeric.includes('tabular') && k[0].getClientRects().length === 1, getComputedStyle(k[0].querySelector('.ul-kbd-key')).fontVariantNumeric);
        c('platform', 'detectPlatform() returns mac | other', ['mac', 'other'].includes(UL.detectPlatform()), UL.detectPlatform());
      } finally { await S.done(); }
      return result(checks);
    }
    async function item() {
      const checks = [], c = ck(checks); let sel = false, ctx = null;
      const S = await stage(() => h('div', { style: { width: 300 } }, h(UL.ULItemGroup, { label: 'L' },
        h(UL.ULItem, { id: 'it1', title: 'A very long title that must truncate inside the row without overflow', description: 'desc', meta: 'now', selectable: true, selected: sel, onSelectedChange: (s) => { sel = s; S.rerender(); }, contextMenu: [{ id: 'open', label: 'Open' }], onContextMenuOpen: (t) => { ctx = t; } }))));
      try {
        const it = S.box.querySelector('.ul-item'), main = it.querySelector('.ul-item-main');
        c('list', 'group role list / listitem', !!S.box.querySelector('[role="list"] > [role="listitem"] .ul-item'), '');
        main.click(); await settle(150);
        c('select', 'selectable: click toggles aria-pressed + data-selected; ULCheckMark present', sel === true && main.getAttribute('aria-pressed') === 'true' && it.hasAttribute('data-selected') && !!it.querySelector('.ul-item-check .ul-check, .ul-item-check .ul-checkmark, .ul-item-check svg'), `${sel} · ${main.getAttribute('aria-pressed')}`);
        const t = it.querySelector('.ul-item-title');
        c('trunc', 'title truncates (ellipsis) and nothing overflows the row', t.scrollWidth > t.clientWidth && getComputedStyle(t).textOverflow === 'ellipsis' && window.ULDemos.__layoutOverflow(it, true).px <= 0.5, `${t.scrollWidth}/${t.clientWidth}`);
        const b = it.getBoundingClientRect();
        it.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.left + 20, clientY: b.top + 10, button: 2 }));
        await settle(700);
        const menu = [...document.querySelectorAll('[role="menu"]')].find((n) => n.getClientRects().length);
        c('ctx', 'contextMenu: right-click opens the shared menu with the item target', !!menu && !!ctx && (ctx.kind === 'item' || ctx.component === 'ULItem'), `${menu ? 'menu' : 'no menu'} · ${ctx ? (ctx.kind + ' ' + (ctx.id || '')) : 'no target'}`);
        esc(); await settle(500);
      } finally { await S.done(); }
      return result(checks);
    }
    async function collapsible() {
      const checks = [], c = ck(checks);
      const S = await stage(() => h(UL.ULCollapsible, { title: 'More' }, h('div', { style: { height: 120 } }, 'content')));
      try {
        const tr = S.box.querySelector('.ul-coll-trigger'), p = S.box.querySelector('.ul-coll-panel');
        c('aria', 'trigger aria-expanded=false, aria-controls → region panel (hidden)', tr.getAttribute('aria-expanded') === 'false' && tr.getAttribute('aria-controls') === p.id && p.getAttribute('role') === 'region' && p.hidden, tr.getAttribute('aria-controls'));
        tr.click(); await raf(); await raf();
        const info = p.__ulColl, inner = p.querySelector('.ul-coll-inner').offsetHeight;
        const kf = (p.getAnimations()[0]?.effect?.getKeyframes() || []).map((k) => k.height);
        const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
        c('measured', 'open: from = rendered height (0), to = measured content height in px', !!info && info.from === 0 && Math.abs(info.to - inner) < 1 && tr.getAttribute('aria-expanded') === 'true', info ? `${info.from} → ${info.to} (content ${inner})` : 'none');
        c('noauto', 'height keyframes are px values, never auto', reduced || (kf.length >= 2 && kf.every((x) => /px$/.test(x))), kf.join(' → ') || (reduced ? 'reduced motion: opacity only' : 'none'));
        await finished(p);
        c('cleared', 'after the morph: inline height cleared (content can reflow)', p.style.height === '' && !p.hasAttribute('data-ul-morphing'), `"${p.style.height}"`);
        tr.click(); await raf(); await raf();
        const mid = p.__ulColl; tr.click(); await raf(); await raf(); const rev = p.__ulColl;
        c('interrupt', 'interrupt: reversing mid-morph starts from the current rendered height', !!rev && rev.open === true && rev.from >= 0 && rev.from <= mid.from + 1, rev ? `${rev.from.toFixed(1)} → ${rev.to}` : 'none');
        await finished(p); tr.click(); await raf(); await finished(p);
        c('closed', 'closed: aria-expanded=false and panel hidden after the morph', tr.getAttribute('aria-expanded') === 'false' && p.hidden, '');
      } finally { await S.done(); }
      return result(checks);
    }
    async function scrollarea() {
      const checks = [], c = ck(checks);
      const t1 = UL.scrollThumb(200, 800, 0, 194), t2 = UL.scrollThumb(200, 800, 600, 194), t3 = UL.scrollThumb(200, 20000, 300, 194), t4 = UL.scrollThumb(200, 200, 0, 194);
      c('math', 'thumb maths: size = track·client/content (min 24), offset ∝ position, hidden when it fits', t1.size === 49 && t1.offset === 0 && Math.abs(t2.offset - (194 - 49)) < 0.01 && t3.size === 24 && !t4.visible, `${t1.size} · ${t2.offset} · ${t3.size} · ${t4.visible}`);
      const added = [], removed = [], A = EventTarget.prototype.addEventListener, R = EventTarget.prototype.removeEventListener;
      let roN = 0, roD = 0; const RO = window.ResizeObserver;
      window.ResizeObserver = class extends RO { constructor(cb) { super(cb); roN++; } disconnect() { roD++; return super.disconnect(); } };
      EventTarget.prototype.addEventListener = function (t, f, o) { if (this instanceof Element && this.closest && this.closest('.ul-scroll')) added.push(t); return A.call(this, t, f, o); };
      EventTarget.prototype.removeEventListener = function (t, f, o) { if (this instanceof Element && this.closest && this.closest('.ul-scroll')) removed.push(t); return R.call(this, t, f, o); };
      let S;
      try {
        S = await stage(() => h(UL.ULScrollArea, { maxHeight: 200, label: 'Log' }, h('div', { style: { height: 800 } }, 'tall')));
        const r = S.box.querySelector('.ul-scroll'), vp = r.querySelector('.ul-scroll-vp'), th = r.querySelector('.ul-scroll-bar[data-axis="y"] .ul-scroll-thumb'), bar = th.parentElement;
        await settle(100);
        const cs = getComputedStyle(vp);
        c('native', 'viewport is the native scroller (overflow-y auto), focusable region with a name', cs.overflowY === 'auto' && vp.tabIndex === 0 && vp.getAttribute('role') === 'region' && vp.getAttribute('aria-label') === 'Log', `${cs.overflowY} · ${vp.tabIndex}`);
        const exp = UL.scrollThumb(vp.clientHeight, vp.scrollHeight, 0, bar.clientHeight);
        c('size', 'thumb size matches the maths', Math.abs(th.getBoundingClientRect().height - exp.size) <= 1, `${th.getBoundingClientRect().height} vs ${exp.size}`);
        vp.scrollTop = 300; await raf(); await raf(); await raf();
        const e2 = UL.scrollThumb(vp.clientHeight, vp.scrollHeight, vp.scrollTop, bar.clientHeight), m = /translateY\(([-\d.]+)px\)/.exec(th.style.transform);
        c('pos', 'scroll position preserved (native) and thumb offset follows', vp.scrollTop === 300 && !!m && Math.abs(+m[1] - e2.offset) < 0.5, `${vp.scrollTop} · ${m && m[1]} vs ${e2.offset.toFixed(2)}`);
        c('shadows', 'edge shadows: top and bottom flags while in the middle', r.hasAttribute('data-top') && r.hasAttribute('data-bottom'), '');
        c('active', 'thumb becomes visible on scroll (data-active)', r.hasAttribute('data-active'), '');
        vp.focus(); vp.scrollBy({ top: 40 }); await raf();
        c('keyboard', 'keyboard scrolling: viewport focusable and scrolls natively (scrollBy honoured)', document.activeElement === vp && vp.scrollTop === 340, vp.scrollTop);
        const we = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }); vp.dispatchEvent(we);
        c('wheel', 'no wheel hijack: no wheel / touch listeners, wheel event not prevented', !we.defaultPrevented && !added.some((t) => /wheel|touch/.test(t)), added.join(',') || 'none');
        await S.done(); S = null;
        const sc = added.filter((t) => t === 'scroll').length - removed.filter((t) => t === 'scroll').length;
        c('cleanup', 'after unmount: scroll listeners removed, ResizeObserver disconnected', sc === 0 && roD >= 1, `scroll +${added.filter((t) => t === 'scroll').length}/-${removed.filter((t) => t === 'scroll').length} · RO ${roN}/${roD}`);
      } finally { EventTarget.prototype.addEventListener = A; EventTarget.prototype.removeEventListener = R; window.ResizeObserver = RO; if (S) await S.done(); }
      return result(checks);
    }
    // frame-dependent (run only in a healthy preview)
    async function collheight() {
      const f = await fps(); if (f < 50) return { status: 'needs healthy preview', driver: `rAF ${f.toFixed(0)} fps`, checks: [{ label: 'collapsible height per frame (monotonic, no jump > 1/3)', pass: null, value: `preview at ${f.toFixed(0)} fps (< 50): run focused` }] };
      const checks = [], c = ck(checks);
      const S = await stage(() => h(UL.ULCollapsible, { title: 'More' }, h('div', { style: { height: 200 } }, 'x')));
      try {
        const tr = S.box.querySelector('.ul-coll-trigger'), p = S.box.querySelector('.ul-coll-panel'); tr.click();
        const hs = []; const t0 = performance.now(); while (performance.now() - t0 < 700) { await raf(); hs.push(p.getBoundingClientRect().height); }
        const jumps = hs.slice(1).map((v, i) => v - hs[i]), maxJ = Math.max(...jumps);
        c('steps', 'height grows monotonically, no frame jump > 1/3 of the target', jumps.every((d) => d >= -0.5) && maxJ <= 200 / 3 + 1, `${hs.length} frames · max step ${maxJ.toFixed(1)}px`);
      } finally { await S.done(); }
      return result(checks, `live rAF ${f.toFixed(0)} fps`);
    }
    async function tglide() {
      const f = await fps(); if (f < 50) return { status: 'needs healthy preview', driver: `rAF ${f.toFixed(0)} fps`, checks: [{ label: 'toggle group lens glide continuous (same as segmented)', pass: null, value: `preview at ${f.toFixed(0)} fps (< 50): run focused` }] };
      const checks = [], c = ck(checks); let v = 'a';
      const S = await stage(() => h(UL.ULToggleGroup, { 'aria-label': 'g', items: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }], value: v, onValueChange: (x) => { v = x; S.rerender(); } }));
      try {
        await settle(300); const it = S.box.querySelectorAll('[role="radio"]'); it[2].click();
        const xs = []; const t0 = performance.now(); while (performance.now() - t0 < 700) { await raf(); const l = document.querySelector('.ul-lens-wrap:not([data-host])') || S.box.querySelector('.ul-lens-wrap'); if (l) xs.push(l.getBoundingClientRect().left); }
        const d = xs.slice(1).map((x, i) => Math.abs(x - xs[i])), span = Math.abs(it[2].getBoundingClientRect().left - it[0].getBoundingClientRect().left);
        c('glide', 'lens travels without a jump > 1/3 of the distance per frame', xs.length > 5 && Math.max(...d) <= span / 3 + 1, `${xs.length} frames · max ${Math.max(0, ...d).toFixed(1)}px of ${span.toFixed(0)}`);
      } finally { await S.done(); }
      return result(checks, `live rAF ${f.toFixed(0)} fps`);
    }
    const finished = async (el, ms = 5000) => { await Promise.race([Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))), wait(ms)]); await settle(120); };
    const cards = { fieldaria, inputgroup, alerts, alertdialog, togglegroup, separator, kbd, item, collapsible, scrollarea, collheight, tglide };

    /* ---------- guards (layoutoverflow / iconsize / ctrltext) over every new component + states ---------- */
    async function withDemos(fn) {
      for (let i = 0; i < 100 && !(window.ULDemos.Forms && window.ULDemos.Feedback && window.ULDemos.Batch2); i++) await wait(100);
      const S = await stage(() => h('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } }, h(window.ULDemos.Forms), h(window.ULDemos.Feedback), window.ULDemos.Batch2 ? h(window.ULDemos.Batch2) : null), 1240);
      try { await settle(600); return await fn(S); } finally { esc(); await wait(300); esc(); await wait(300); await S.done(); }
    }
    const openSurfaces = async (S) => {
      S.box.querySelector('[data-demo-confirmpop]')?.click(); await settle(800);
      // 3D overlays: hover card, nav panel, menubar menu (opened together; synthetic clicks never close the others)
      S.box.querySelector('[data-demo-hc="c"]')?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      S.box.querySelector('nav[aria-label="Site"] [data-navm-id="products"]')?.click();
      const mb = S.box.querySelector('[data-menubar-id="view"]'); if (mb) { mb.focus(); mb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); }
      await settle(1600);
      const pops = [...document.querySelectorAll('.ul-anchored')].filter((n) => n.getClientRects().length && !n.hasAttribute('data-ul-morphing'));
      return pops;
    };
    async function formsGuard(kind) {
      const out = [], size = innerWidth + '×' + innerHeight;
      await withDemos(async (S) => {
        const cells = [...S.box.querySelectorAll('[data-demo]')];
        if (kind === 'layout') {
          const bad = cells.map((n) => ({ n, o: window.ULDemos.__layoutOverflow(n, true) })).filter((x) => x.o.px > 0.5);
          out.push({ key: 'forms3c', label: `3C + 3D demos: nothing wider than its cell (${cells.length} cells, ${size})`, pass: !bad.length, value: bad.map((x) => x.n.dataset.demo + ' ' + x.o.px + 'px ' + x.o.who).join(', ') || cells.length + ' ok' });
          const errOn = S.box.querySelector('[data-demo-toggle="error"]'); errOn && errOn.click(); await settle(200); errOn && errOn.click(); await settle(200);
          const bad2 = cells.map((n) => ({ n, o: window.ULDemos.__layoutOverflow(n, true) })).filter((x) => x.o.px > 0.5);
          out.push({ key: 'forms3c-states', label: `3C demos after toggling error states (${size})`, pass: !bad2.length, value: bad2.map((x) => x.n.dataset.demo + ' ' + x.o.px + 'px').join(', ') || 'ok' });
          const pops = await openSurfaces(S);
          const pb = pops.map((p) => { const body = p.querySelector('.ul-confirm-pop, .ul-alertdlg-foot')?.closest('.ul-anchored') || p; return window.ULDemos.__layoutOverflow(body, true); }).filter((o) => o.px > 0.5);
          out.push({ key: 'forms3c-pop', label: `confirm popover + hover card + nav panel + menubar menu: content = surface inner width (${size})`, pass: pops.length > 0 && !pb.length, value: pops.length ? (pb.map((o) => o.px + 'px ' + o.who).join(', ') || pops.length + ' surface ok') : 'popover did not open' });
        }
        if (kind === 'icons') {
          const a = window.ULDemos.__scanIcons(S.box);
          out.push({ key: 'forms3c', label: `3C demos: every svg sized through ULIcon (≤ 2× font, ≤ 48px) (${size})`, pass: !a.bad.length, value: a.bad.slice(0, 4).join(' · ') || a.n + ' svgs ok' });
        }
        if (kind === 'ctrl') {
          const a = window.ULDemos.__scanControls(S.box);
          out.push({ key: 'forms3c', label: `3C demos: buttons, toggle items, kbd caps, addons, select triggers one line + centred (${size})`, pass: !a.bad.length, value: a.bad.slice(0, 4).join(' · ') || a.n + ' controls ok' });
          const pops = await openSurfaces(S); const b = pops.map(window.ULDemos.__scanControls), bad = b.flatMap((x) => x.bad);
          out.push({ key: 'forms3c-pop', label: `controls inside the confirm popover, hover card, nav panel, menu (${size})`, pass: !bad.length, value: bad.slice(0, 3).join(' · ') || b.reduce((t, x) => t + x.n, 0) + ' ok' });
        }
      });
      return out;
    }
    async function guard() {
      const checks = [];
      for (const k of ['layout', 'icons', 'ctrl']) (await formsGuard(k)).forEach((x) => checks.push(Object.assign({}, x, { label: ({ layout: 'layoutoverflow', icons: 'iconsize', ctrl: 'ctrltext' })[k] + ' · ' + x.label })));
      return { size: innerWidth + '×' + innerHeight, status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'DOM' };
    }

    /* ---------- contrast (shared tool) ---------- */
    async function contrast() {
      const C = window.ULContrast; await C.ready();
      const rows = [], worst = {};
      const note = (cat, fg, bg, combo, min) => { const v = C.ratio(fg, bg); rows.push(v >= min); if (!worst[cat] || v < worst[cat].v) worst[cat] = { v: C.round(v), combo, min, pass: v >= min }; };
      for (const theme of ['app', 'marketing']) for (const accent of UL.ACCENT_PRESETS) {
        const root = document.createElement('div'); root.setAttribute('data-ul-theme', theme); root.setAttribute('data-ul-accent', accent); root.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(root);
        const R = C.resolver(root), t = UL.readContrastTokens(root); t.text = R.get('var(--ul-color-text)').slice(0, 3); t.text2 = R.get('var(--ul-color-text-2)').slice(0, 3);
        const acc = R.get(`var(--ul-accent-${accent})`), text = R.get('var(--ul-color-text)'), text2 = R.get('var(--ul-color-text-2)'), errInk = R.get('var(--ul-field-error-text)');
        const well = R.get('color-mix(in oklab, var(--ul-field-well), var(--ul-accent) var(--ul-field-accent-mix-hover))'), kbdBg = R.get('var(--ul-kbd-bg)'), kbdInk = R.get('var(--ul-kbd-ink)'), thumb = R.get('var(--ul-scroll-thumb)'), sepL = R.get('var(--ul-sep-label)'), sepC = R.get('var(--ul-sep-color)');
        const selBg = R.get('var(--ul-item-selected-bg)'), desc = R.get('var(--ul-alert-desc-ink)');
        const tones = Object.fromEntries(['info', 'success', 'warning', 'danger', 'neutral'].map((k) => [k, { bg: R.get(`color-mix(in srgb, var(--ul-tone-${k}) var(--ul-alert-tint), var(--ul-alert-base))`), ic: R.get(`color-mix(in oklab, var(--ul-tone-${k}) var(--ul-alert-icon-mix), var(--ul-color-white))`) }]));
        const panels = [{ name: 'graphite', P: R.get('var(--ul-color-graphite)') }];
        for (const s of UL.ACCENT_STRENGTHS) for (const b of ['dark', 'mid', 'light']) { const x = Math.min(1, Math.max(0, (t.k[s] - t.k.subtle) / (1 - t.k.subtle))); panels.push({ name: `${s} · ${b}`, P: UL.worstSurface(t, acc.slice(0, 3), b, x).concat(1) }); }
        for (const { name, P } of panels) {
          const combo = `${theme} · ${accent} · ${name}`;
          for (const [k, v] of Object.entries(tones)) { const B = C.over(v.bg, P); note('alert title (≥ 4.5)', text, B, combo + ' · ' + k, 4.5); note('alert description (≥ 4.5)', desc, B, combo + ' · ' + k, 4.5); note('alert icon (≥ 3)', v.ic, B, combo + ' · ' + k, 3); }
          note('field error text (≥ 4.5)', errInk, P, combo, 4.5);
          note('required asterisk (≥ 3)', errInk, P, combo, 3);
          note('label optional / description text (≥ 4.5)', text2, P, combo, 4.5);
          const W = C.over(well, P);
          note('input group addon / counter text on the well (≥ 4.5)', text2, W, combo, 4.5);
          note('input group value text on the well (≥ 4.5)', text, W, combo, 4.5);
          note('kbd cap text (≥ 4.5)', kbdInk, C.over(kbdBg, P), combo, 4.5);
          note('scroll thumb vs panel (graphics ≥ 3)', thumb, P, combo, 3);
          note('separator label (≥ 4.5)', sepL, P, combo, 4.5);
          note('item / toggle pressed text on selected paint (≥ 4.5)', text, C.over(selBg, P), combo, 4.5);
          const sv = C.ratio(sepC, P); if (!worst['separator line (decorative, info)'] || sv < worst['separator line (decorative, info)'].v) worst['separator line (decorative, info)'] = { v: C.round(sv), combo, min: 0, pass: true };
        }
        R.done(); root.remove();
      }
      return { checked: rows.length, fails: rows.filter((x) => !x).length, worst };
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { formsTests: { cards, guard, contrast }, __formsGuard: formsGuard });
    Object.entries(cards).forEach(([k, f]) => { window.ULDemos['f3c_' + k] = f; });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
