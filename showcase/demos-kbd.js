// Keyboard-only walkthrough (pre-freeze audit, item 4). motion-test ?norun&card=kbdaudit · probe-charts ?cards=kbdaudit.
// Frame-independent: synthetic keydown only. Native default actions cannot be synthesised (Tab moving focus, Enter / Space
// clicking a native button, arrows in native radios / selects, PageUp scrolling): the audit emulates Tab by focusing the next
// tabbable element when the component did not handle the key, and Enter / Space on a native <button> by click() when the
// component did not handle it ("emulated"). Real focus events / :focus-visible / document.hasFocus() = NEEDS FOCUS.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const settle = async (ms = 350) => { await wait(ms); await raf(); await raf(); };
    const load = (file) => new Promise((res) => { const s = document.createElement('script'); s.src = './' + file; s.onload = res; s.onerror = res; document.head.appendChild(s); });
    async function need(name, file) { if (!(window.ULDemos || {})[name]) await load(file); for (let i = 0; i < 60 && !(window.ULDemos || {})[name]; i++) await wait(100); return (window.ULDemos || {})[name]; }
    const SECTIONS = [['Selection', null], ['Actions', 'demos-2i.js'], ['Containers', 'demos-2c.js'], ['PickerFixtures', 'demos-2e.js'], ['Data', 'demos-2d.js'], ['Blocks', 'demos-2l.js'], ['Blocks2', 'demos-2n.js'], ['Forms', 'demos-3e.js'], ['Feedback', 'demos-3f.js'], ['Batch2', 'demos-3h.js'], ['Charts', 'demos-3a.js'], ['ChartsAdv', 'demos-3c.js']];
    const vis = (el) => { if (!el || !el.isConnected || el.closest('[inert],[hidden]')) return false; const r = el.getClientRects(); if (!r.length) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const FOC = 'a[href],button,input:not([type=hidden]),select,textarea,[tabindex],[contenteditable="true"]';
    const tabbables = (root) => { const all = [...root.querySelectorAll(FOC)].filter((el) => !el.disabled && el.tabIndex >= 0 && vis(el)); const seen = new Set(); return all.filter((el) => { if (el.type !== 'radio' || !el.name) return true; const g = (el.form || document).querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`); const pick = [...g].find((x) => x.checked) || g[0]; if (pick !== el || seen.has(el.name)) return false; seen.add(el.name); return true; }); };
    const act = () => document.activeElement;
    const kd = (el, key, o = {}) => { const e = new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, o)); (el || document.body).dispatchEvent(e); (el || document.body).dispatchEvent(new KeyboardEvent('keyup', Object.assign({ key, bubbles: true, cancelable: true }, o))); return e; };
    const surfaces = () => [...document.querySelectorAll('.ul-anchored')].filter((s) => vis(s) && !s.hasAttribute('data-closing') && !s.closest('[data-kbd-host] [data-ul-static]'));
    const popupSurfaces = () => surfaces().filter((s) => s.matches('[role=menu],[role=listbox],[role=dialog],[role=alertdialog],[role=grid]') || s.querySelector('[role=menu],[role=listbox],[role=dialog],[role=alertdialog],[role=grid]'));
    const until = async (fn, ms = 2200) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await wait(60); } return !!fn(); };
    const lost = () => { const a = act(); return !a || a === document.body || a === document.documentElement; };
    const isNativeBtn = (el) => el.tagName === 'BUTTON' || (el.tagName === 'INPUT' && /^(button|submit|reset|checkbox|radio)$/.test(el.type)) || (el.tagName === 'A' && el.hasAttribute('href'));
    /** Enter / Space as a user would: the component's keydown first; a native control's default action is emulated by click(). */
    const press = async (el, key) => { const e = kd(el, key); let emulated = false; if (!e.defaultPrevented && isNativeBtn(el) && !(el.tagName === 'A' && key === ' ')) { el.click(); emulated = true; } await settle(450); return emulated; };
    const kindOf = (el) => {
      const r = el.getAttribute('role'), hp = el.getAttribute('aria-haspopup');
      if (el.hasAttribute('data-ul-hovercard-trigger')) return 'hover card trigger';
      if (r === 'combobox' || el.getAttribute('aria-autocomplete')) return 'combobox';
      if (el.tagName === 'SELECT') return 'native select';
      if (hp && hp !== 'false' && el.hasAttribute('aria-expanded')) return 'popup trigger (' + (hp === 'true' ? 'menu' : hp) + ')';
      if (r === 'tab') return 'tabs';
      if (r === 'slider') return 'slider';
      if (r === 'switch') return 'switch';
      if (r === 'checkbox' || el.type === 'checkbox') return 'checkbox';
      if (r === 'radio' || el.type === 'radio') return 'radio';
      if (r === 'menuitem' && el.closest('[role=menubar]')) return 'menubar';
      if (r === 'grid' || r === 'gridcell' || el.closest('[role=grid]')) return 'grid';
      if (r === 'tree' || r === 'treeitem' || el.closest('[role=tree]')) return 'tree';
      if (el.getAttribute('aria-roledescription') === 'chart') return 'chart plot';
      if (r === 'separator') return 'resize handle';
      if (el.getAttribute('aria-roledescription') === 'carousel' || el.closest('[aria-roledescription=carousel]')) return 'carousel';
      if (el.hasAttribute('aria-expanded')) return 'disclosure';
      if (el.closest('.ul-otp, [data-otp]') && el.matches('input')) return 'otp';
      if (el.matches('input,textarea,[contenteditable="true"]')) return 'text input';
      if (el.closest('[aria-haspopup=menu]') && !el.matches('[aria-haspopup]') && el.matches('[role=row],[role=gridcell],[role=columnheader],[role=option],[role=treeitem],td,th,.ul-item-main,[data-ctx-id],.ul-chart-lchip')) return 'context target';
      return 'button / link';
    };
    const compOf = (sec, el) => { const d = el.closest('[data-demo]'); return sec + (d ? ' › ' + d.getAttribute('data-demo') : '') + ' › ' + kindOf(el); };


    class Safe extends React.Component { constructor(p) { super(p); this.state = { err: null }; } static getDerivedStateFromError(e) { return { err: e }; } render() { return this.state.err ? h('p', { 'data-kbd-err': this.props.id }, this.props.id + ': ' + this.state.err.message) : this.props.children; } }
    const opts = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }];
    function Selection() {
      const cell = (id, el) => h('div', { 'data-demo': id, key: id, style: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, maxWidth: 360 } }, h(Safe, { id }, el));
      return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 } },
        cell('switch', h(UL.ULSwitch, { label: 'Notifications', defaultChecked: false })),
        cell('checkbox', h(UL.ULCheckbox, { label: 'Accept terms' })),
        cell('slider', h(UL.ULSlider, { label: 'Volume', defaultValue: 40, min: 0, max: 100 })),
        cell('rangeslider', h(UL.ULRangeSlider, { label: 'Price', defaultValue: [20, 60], min: 0, max: 100 })),
        cell('segmented', h(UL.ULSegmentedControl, { 'aria-label': 'View', options: opts, defaultValue: 'a' })),
        cell('tabs', h(UL.ULTabs, { 'aria-label': 'Sections', items: opts.map((o) => ({ value: o.value, label: o.label, content: o.label + ' panel' })), defaultValue: 'a' })),
        cell('select', h(UL.ULSelect, { label: 'Plan', options: opts, defaultValue: 'a' })),
        cell('combobox', h(UL.ULCombobox, { label: 'Country', options: opts })),
        cell('otp', h(UL.ULOtpField, { label: 'Code', length: 6 })),
        cell('tagfield', h(UL.ULTagField, { label: 'Tags', defaultValue: ['design'] })),
        cell('date', h(UL.ULDatePicker, { label: 'Start date', locale: 'en' })),
        cell('colour', h(UL.ULColorPicker, { label: 'Accent', defaultValue: 'violet', locale: 'en' })));
    }

    /* ---------- probes: return null (pass) or the first failing step ---------- */
    async function closeAll() { for (let i = 0; i < 4 && popupSurfaces().length; i++) { kd(act() || document.body, 'Escape'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle(300); } }
    async function probePopup(el) {
      // isolation: start from no open popup, no running morph, no page scroll lock (state an earlier card / step may leave)
      const dirty = () => popupSurfaces().length > 0 || !!document.querySelector('[data-ul-morphing]') || document.documentElement.hasAttribute('data-ul-scroll-locked');
      if (dirty()) { await closeAll(); await until(() => !dirty(), 1500); }
      const leftover = dirty() ? `${popupSurfaces().length} popup(s) · morphing ${!!document.querySelector('[data-ul-morphing]')} · scroll locked ${document.documentElement.hasAttribute('data-ul-scroll-locked')}` : '';
      const tryEnter = async () => {
        const before = popupSurfaces().length, who = { cap: false, comp: false };
        // who prevents Enter: a window capture listener registered earlier (leaked) vs the component (React root = host)
        const cap = (e) => { if (e.target === el && e.key === 'Enter') who.cap = e.defaultPrevented; }, root = el.closest('[data-kbd-host]') || document.body;
        const bub = (e) => { if (e.target === el && e.key === 'Enter') who.comp = e.defaultPrevented && !who.cap; };
        addEventListener('keydown', cap, true); root.addEventListener('keydown', bub);
        el.focus(); if (act() !== el) { removeEventListener('keydown', cap, true); root.removeEventListener('keydown', bub); return { fail: 'focus(): element does not take focus' }; }
        const em = await press(el, 'Enter');
        removeEventListener('keydown', cap, true); root.removeEventListener('keydown', bub);
        await until(() => popupSurfaces().some((s) => s.contains(act())) || el.getAttribute('role') === 'combobox', 1600);
        return { em, who, opened: el.getAttribute('aria-expanded') === 'true' || popupSurfaces().length > before };
      };
      let t1 = await tryEnter(); if (t1.fail) return t1;
      const em = t1.em;
      if (!t1.opened) {
        const why = t1.who.cap ? 'Enter keydown was prevented by a window capture listener (state left by an earlier card)' : t1.who.comp ? 'the component prevented Enter' : t1.em ? 'click emulated, nothing opened' : 'Enter keydown prevented outside the component';
        // one clean retry: a component that opens on the retry works from the keyboard; the first miss is leaked state, reported separately
        await closeAll(); el.blur(); await settle(600);
        const t2 = await tryEnter();
        if (t2.fail || !t2.opened) return { fail: `Enter${em ? ' (emulated click)' : ''}: did not open (aria-expanded=${el.getAttribute('aria-expanded')}) · ${why}${leftover ? ' · leftover ' + leftover : ''}` };
        t1 = t2; t1.isolation = `first Enter did not open (${why}${leftover ? '; leftover ' + leftover : ''}); clean retry opened`;
      }
      const s = popupSurfaces().find((x) => x.contains(act())) || popupSurfaces().slice(-1)[0];
      const inside = s && s.contains(act());
      // fixtures that open a menu with initialFocus: null (pointer / motion fixtures) mark the trigger data-kbd-initial-focus="none":
      // focus stays on the trigger by design (same flag as the 2e keyboard card's noFocus list); arrows / Home / End are not probed
      if (el.getAttribute('data-kbd-initial-focus') === 'none') { if (act() !== el && !inside) return { fail: 'initialFocus null: focus left the trigger' }; return { note: 'initialFocus null fixture: focus stays on the trigger (by design)' }; }
      if (s && s.querySelector('[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio]') && !s.matches('[role=dialog]')) {
        if (!inside) return { fail: 'open: focus not in the menu' };
        const a0 = act(); kd(a0, 'ArrowDown'); await raf(); if (act() === a0 && s.querySelectorAll('[role^=menuitem]:not([aria-disabled=true])').length > 1) return { fail: 'ArrowDown: focus did not move in the menu' };
        kd(act(), 'End'); await raf(); kd(act(), 'Home'); await raf(); if (!s.contains(act())) return { fail: 'Home / End: focus left the menu' };
      }
      const dlg = s && (s.matches('[aria-modal=true]') ? s : s.querySelector('[aria-modal=true]'));
      if (dlg) {
        const t = tabbables(dlg); if (t.length) { t[t.length - 1].focus(); const e = kd(act(), 'Tab'); await raf(); if (!e.defaultPrevented && !dlg.contains(act())) return { fail: 'modal: Tab from the last control is not trapped' }; t[0].focus(); const e2 = kd(act(), 'Tab', { shiftKey: true }); await raf(); if (!e2.defaultPrevented && !dlg.contains(act())) return { fail: 'modal: Shift+Tab from the first control is not trapped' }; }
      }
      kd(act() || el, 'Escape'); await settle(600);
      if (el.getAttribute('aria-expanded') === 'true') return { fail: 'Escape: still expanded' };
      if (lost()) return { fail: 'Escape: focus lost to <body> (no focus return)' };
      if (act() !== el && !el.contains(act())) return { fail: 'Escape: focus returned to ' + (act().getAttribute('aria-label') || act().tagName) + ', not the trigger' };
      return { emulated: em, isolation: t1.isolation };
    }
    async function probeContext(el) {
      for (const [key, o, name] of [['ContextMenu', {}, 'ContextMenu key'], ['F10', { shiftKey: true }, 'Shift+F10']]) {
        el.focus(); const before = popupSurfaces().length; kd(el, key, o); await settle(300); await until(() => popupSurfaces().some((s) => s.contains(act())));
        if (popupSurfaces().length <= before) return { fail: name + ': no context menu' };
        if (!popupSurfaces().some((s) => s.contains(act()))) return { fail: name + ': focus not in the context menu' };
        kd(act(), 'Escape'); await settle(800); if (lost()) return { fail: name + ' → Escape: focus lost to <body>' }; if (act() !== el && !el.contains(act()) && !act().contains(el)) return { fail: name + ' → Escape: focus not back on the target' };
      }
      return {};
    }
    async function probeRoving(el, keys, ok) { el.focus(); for (const k of keys) { const a = act(); kd(a, k); await settle(120); if (lost()) return { fail: k + ': focus lost to <body>' }; const r = ok(k, a, act()); if (r) return { fail: k + ': ' + r }; } return {}; }
    const num = (el, a) => parseFloat(el.getAttribute(a));
    async function probe(kind, el) {
      switch (kind) {
        case 'combobox': { el.focus(); kd(el, 'ArrowDown', { altKey: false }); await settle(450); const open = el.getAttribute('aria-expanded') === 'true'; if (!open) return { fail: 'ArrowDown: list not open' }; kd(act(), 'ArrowDown'); await raf(); kd(act(), 'Escape'); await settle(450); if (el.getAttribute('aria-expanded') === 'true') return { fail: 'Escape: still open' }; if (lost()) return { fail: 'Escape: focus lost to <body>' }; return {}; }
        case 'tabs': { const list = el.closest('[role=tablist]'); const tabs = list ? [...list.querySelectorAll('[role=tab]:not([aria-disabled=true]):not([disabled])')] : []; if (tabs.length < 2) return { na: 'single tab' }; const vert = list.getAttribute('aria-orientation') === 'vertical'; const nx = vert ? 'ArrowDown' : 'ArrowRight';
          return probeRoving(el, [nx, 'Home', 'End'], (k, a, b) => (k === nx && b === a ? 'focus did not move' : k === 'Home' && b !== tabs[0] ? 'not on the first tab' : k === 'End' && b !== tabs[tabs.length - 1] ? 'not on the last tab' : null)); }
        case 'slider': { el.focus(); const v0 = num(el, 'aria-valuenow'); kd(el, 'ArrowRight'); await settle(150); const v1 = num(el, 'aria-valuenow'); if (!(v1 > v0) && v0 < num(el, 'aria-valuemax')) return { fail: `ArrowRight: value ${v0} → ${v1}` }; kd(el, 'Home'); await settle(150); if (num(el, 'aria-valuenow') !== num(el, 'aria-valuemin') && !el.closest('[data-range]')) { /* range thumbs clamp at the other thumb */ const lo = num(el, 'aria-valuenow'); if (!(lo <= v0)) return { fail: 'Home: not at the minimum' }; }
          kd(el, 'PageUp'); await settle(150); const vp = num(el, 'aria-valuenow'); kd(el, 'End'); await settle(150); const ve = num(el, 'aria-valuenow'); if (!(ve >= vp)) return { fail: 'End: value went down' }; if (lost()) return { fail: 'focus lost' }; return {}; }
        case 'switch': case 'checkbox': { el.focus(); const st = () => (el.getAttribute('aria-checked') ?? String(!!el.checked)); const a = st(); const em = await press(el, ' '); const b = st(); if (a === b) return { fail: `Space${em ? ' (emulated click)' : ''}: state did not change (${a})` }; await press(el, ' '); if (lost()) return { fail: 'focus lost' }; return { emulated: em }; }
        case 'radio': { if (el.tagName === 'INPUT') return { native: 'native radio (browser arrows)' }; const g = el.closest('[role=radiogroup]'); const rs = g ? [...g.querySelectorAll('[role=radio]:not([aria-disabled=true])')] : []; if (rs.length < 2) return { na: 'single radio' };
          return probeRoving(el, ['ArrowDown', 'ArrowUp'], (k, a, b) => (b === a ? 'focus did not move' : b.getAttribute('aria-checked') !== 'true' ? 'moved but not checked' : null)); }
        case 'menubar': return probeRoving(el, ['ArrowRight', 'ArrowLeft', 'End', 'Home'], (k, a, b) => (b === a && k.startsWith('Arrow') ? 'focus did not move' : !b.closest('[role=menubar],.ul-anchored') ? 'left the menubar' : null)).then(async (r) => { await closeAll(); return r; });
        case 'grid': { const g = el.closest('[role=grid]') || el; el.focus(); const a = act(); kd(a, 'ArrowDown'); await settle(120); const b = act(); kd(b, 'ArrowRight'); await settle(120); const c = act(); if (lost()) return { fail: 'arrows: focus lost' }; if (a === b && b === c) return { fail: 'ArrowDown / ArrowRight: focus did not move in the grid' }; kd(act(), 'Home'); await settle(100); kd(act(), 'End'); await settle(100); if (!g.contains(act())) return { fail: 'Home / End: focus left the grid' }; return {}; }
        case 'tree': return probeRoving(el, ['ArrowDown', 'ArrowUp', 'Home', 'End'], (k, a, b) => (!b.closest('[role=tree]') ? 'left the tree' : null));
        case 'chart plot': { el.focus(); const live = () => ((el.closest('.ul-chart2') || el).querySelector('[aria-live]') || {}).textContent || ''; kd(el, 'Home'); await settle(150); const l0 = live(); kd(el, 'ArrowRight'); await settle(150); const l1 = live(); kd(el, 'End'); await settle(150); kd(el, 'Escape'); await settle(150); if (lost()) return { fail: 'focus lost' }; if (!l0 && !l1) return { fail: 'Home / ArrowRight: no live readout' }; return {}; }
        case 'resize handle': { el.focus(); const v0 = num(el, 'aria-valuenow'); const hz = el.getAttribute('aria-orientation') === 'horizontal'; kd(el, hz ? 'ArrowDown' : 'ArrowRight', { shiftKey: true }); await settle(900); let v1 = num(el, 'aria-valuenow'); if (v1 === v0) { kd(el, hz ? 'ArrowUp' : 'ArrowLeft', { shiftKey: true }); await settle(900); v1 = num(el, 'aria-valuenow'); } kd(el, 'Home'); await settle(200); kd(el, 'End'); await settle(200); kd(el, 'Enter'); await settle(200); kd(el, 'Enter'); await settle(200); if (lost()) return { fail: 'focus lost' }; if (!(v1 !== v0) && Number.isFinite(v0)) return { fail: `Arrow: value ${v0} → ${v1}` }; return {}; }
        case 'carousel': { el.focus(); kd(el, 'ArrowRight'); await settle(500); kd(act(), 'ArrowLeft'); await settle(500); if (lost()) return { fail: 'arrows: focus lost' }; return {}; }
        case 'disclosure': { el.focus(); const a = el.getAttribute('aria-expanded'); const em = await press(el, 'Enter'); const b = el.getAttribute('aria-expanded'); if (a === b) return { fail: `Enter${em ? ' (emulated click)' : ''}: aria-expanded stayed ${a}` }; await press(el, 'Enter'); if (lost()) return { fail: 'focus lost after toggle' }; return { emulated: em }; }
        case 'context target': return probeContext(el);
        case 'native select': return { native: 'browser control' };
        case 'otp': { el.focus(); return act() === el ? {} : { fail: 'focus(): box does not take focus' }; }
        case 'hover card trigger': return { needsFocus: 'opens on :focus-visible (real focus)' };
        default: { if (kind.startsWith('popup')) { const r = await probePopup(el); await closeAll(); return r; } el.focus(); return act() === el ? {} : { fail: 'focus(): element does not take focus' }; }
      }
    }

    /* ---------- Tab / Shift+Tab walk with dead-end and trap detection ---------- */
    async function tabWalk(root, dir) {
      const list = tabbables(root); if (!list.length) return { n: 0, fail: null };
      let cur = dir > 0 ? list[0] : list[list.length - 1]; cur.focus(); const seen = new Set([cur]);
      for (let i = 0; i < list.length * 2 + 4; i++) {
        const a = act(); const e = kd(a, 'Tab', { shiftKey: dir < 0 }); await raf();
        if (lost()) return { n: seen.size, of: list.length, fail: `${dir > 0 ? 'Tab' : 'Shift+Tab'} from ${desc(a)}: focus lost to <body>` };
        if (act() === a) {
          if (e.defaultPrevented && !a.closest('[aria-modal=true]')) return { n: seen.size, of: list.length, fail: `${dir > 0 ? 'Tab' : 'Shift+Tab'} trapped at ${desc(a)} (not a modal)` };
          const fresh = tabbables(root); let k = fresh.indexOf(a);
          if (k < 0) { k = fresh.findIndex((x) => a.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) - (dir > 0 ? 1 : 0); }
          const nx = fresh[k + dir]; if (!nx) break; nx.focus(); if (act() !== nx) return { n: seen.size, of: list.length, fail: `focus(): ${desc(nx)} does not take focus` };
        }
        await closeAll();
        if (!root.contains(act())) { const fresh = tabbables(root); const nx = fresh.find((x) => !seen.has(x)); if (!nx) break; nx.focus(); }
        seen.add(act());
        if (seen.size >= list.length) break;
      }
      return { n: seen.size, of: list.length, fail: seen.size < list.length * 0.9 ? `${dir > 0 ? 'Tab' : 'Shift+Tab'} walk reached ${seen.size} of ${list.length}` : null };
    }
    const desc = (el) => (el ? (el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 24) || el.tagName.toLowerCase()) : 'none');

    async function kbdAuditTest(opts = {}) {
      const q = new URLSearchParams(location.search), rows = new Map(), extra = [], perKind = opts.perKind ?? (Number(q.get('kbdper')) || 2), only = opts.only ?? (q.get('kbdonly') ? q.get('kbdonly').split(',') : null);
      const add = (comp, r) => { const x = rows.get(comp) || { component: comp, tested: 0, pass: 0, fail: 0, native: 0, na: 0, emulated: 0, first: '' }; x.tested++; if (r.fail) { x.fail++; if (!x.first) x.first = r.fail; } else if (r.native) x.native++; else if (r.needsFocus) { x.nf = (x.nf || 0) + 1; if (!x.first) x.first = r.needsFocus; } else if (r.na) x.na++; else x.pass++; if (r.emulated) x.emulated++; if (r.isolation && !x.iso) x.iso = r.isolation; rows.set(comp, x); };
      const posTab = [];
      for (const [name, file] of SECTIONS) {
        if (only && !only.includes(name)) continue;
        const Comp = file ? await need(name, file) : Selection; if (!Comp) { extra.push({ component: name, result: 'NOT LOADED', first: file }); continue; }
        const host = document.createElement('div'); host.setAttribute('data-kbd-host', ''); host.setAttribute('data-ul-theme', 'app'); host.setAttribute('data-ul-accent', 'violet');
        host.style.cssText = 'position:fixed;inset:0;z-index:800;overflow:auto;padding:16px;box-sizing:border-box;background:#0b0d12';
        document.body.appendChild(host); const root = window.ReactDOM.createRoot(host);
        try {
          root.render(h(Comp, { locale: 'en' })); await settle(1200);
          for (let y = 0; y < host.scrollHeight; y += host.clientHeight * 0.8) { host.scrollTop = y; await settle(250); } host.scrollTop = 0; await settle(300);
          host.querySelectorAll('[tabindex]').forEach((el) => { if (el.tabIndex > 0) posTab.push(name + ': ' + desc(el)); });
          const fw = await tabWalk(host, 1); add(name + ' › Tab order', fw.fail ? { fail: fw.fail } : {}); await closeAll();
          const bw = await tabWalk(host, -1); add(name + ' › Shift+Tab order', bw.fail ? { fail: bw.fail } : {}); await closeAll();
          const count = new Map();
          for (const el of tabbables(host)) {
            if (!el.isConnected || !vis(el)) continue;
            const kind = kindOf(el), comp = compOf(name, el), k = comp; const c = count.get(k) || 0; if (c >= perKind) continue; count.set(k, c + 1);
            let r; try { r = await probe(kind, el); } catch (err) { r = { fail: 'threw: ' + err.message }; }
            add(comp, r); await closeAll();
            if (!r.fail && ['grid', 'chart plot', 'tree'].includes(kind) && el.closest('[aria-haspopup=menu]') && !el.matches('[aria-haspopup]') && !count.has(comp + '#ctx')) { count.set(comp + '#ctx', 1); const rc = await probeContext(el); add(name + (el.closest('[data-demo]') ? ' › ' + el.closest('[data-demo]').getAttribute('data-demo') : '') + ' › context menu keys', rc); await closeAll(); }
          }
        } finally { await closeAll(); root.unmount(); host.remove(); await raf(); }
      }
      const table = [...rows.values()].map((x) => ({ component: x.component, result: x.fail ? 'FAIL' : x.pass ? 'PASS' : x.nf ? 'NEEDS FOCUS' : x.native ? 'NATIVE' : 'N/A', tested: x.tested, first: x.first, emulated: x.emulated, iso: x.iso })).concat(extra);
      const needsFocus = ['every :focus-visible ring (ring outside the refracted layer)', 'ULHoverCard open on keyboard focus (focusin)', 'ULTooltip / createAnchoredTooltip on focus (focusin / focusout)', 'focus-out closing of non-modal popovers and menus (focusout)', 'ULInlineEdit commit on blur (focusout)', 'ULField validate on blur', 'ULCommandPalette hotkey while the document has focus (document.hasFocus())', 'real Tab order inside the browser (synthetic Tab is emulated)'];
      window.__kbdAudit = { table, needsFocus, posTab, hasFocus: document.hasFocus() };
      const checks = table.map((r) => ({ key: r.component, label: r.component + ' (' + (r.tested || 0) + ')', pass: r.result === 'FAIL' || r.result === 'NOT LOADED' ? false : true, value: r.result + (r.first ? ' · ' + r.first : '') + (r.emulated ? ' · ' + r.emulated + ' emulated' : '') + (r.iso ? ' · ISOLATION: ' + r.iso : '') }));
      checks.push({ key: 'tabindex>0', label: 'no element has tabindex > 0', pass: posTab.length === 0, value: posTab.length ? posTab.slice(0, 5).join('; ') : '0' });
      checks.push({ key: 'needs-focus', label: 'NEEDS FOCUS (owner, focused tab)', pass: undefined, value: needsFocus.join(' · ') });
      return { status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'frame-independent (synthetic keys)' + (document.hasFocus() ? '' : ' · document not focused') };
    }

    /* ---------- fallback contrast sampler (item 5): text over the composited background-colour stack ---------- */
    async function fallbackAuditTest() {
      const C = window.ULContrast; await C.ready();
      const q = new URLSearchParams(location.search), only = q.get('kbdonly') ? q.get('kbdonly').split(',') : null;
      const mode = (q.get('glass') || 'full') + (document.documentElement.dataset.ulTransparency === 'reduce' ? '+reduced-transparency' : '');
      const BACK = { dark: [11 / 255, 13 / 255, 18 / 255, 1], mid: [0.36, 0.38, 0.44, 1], light: [0.9, 0.91, 0.94, 1] };
      const col = (s) => { try { const p = C.parse(s); return C.toSRGB(p.lsrgb).concat(p.alpha); } catch (e) { return null; } };
      const layers = (el) => { const out = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { for (const ps of ['::after', '::before']) { const cs = getComputedStyle(n, ps); const r = n.getBoundingClientRect(); if (cs.content !== 'none' && cs.position === 'absolute' && parseFloat(cs.width) >= r.width * 0.8 && parseFloat(cs.height) >= r.height * 0.8) { const c = col(cs.backgroundColor); if (c && c[3] > 0.01) out.push(c); } } const c = col(getComputedStyle(n).backgroundColor); if (c && c[3] > 0.01) out.push(c); if (c && c[3] >= 0.999) break; } return out; };
      const rows = []; let total = 0;
      for (const [name, file] of SECTIONS) {
        if (only && !only.includes(name)) continue;
        const Comp = file ? await need(name, file) : Selection; if (!Comp) continue;
        const host = document.createElement('div'); host.setAttribute('data-ul-theme', 'app'); host.setAttribute('data-ul-accent', 'violet');
        host.style.cssText = 'position:fixed;inset:0;z-index:800;overflow:auto;padding:16px;box-sizing:border-box;background:transparent';
        document.body.appendChild(host); const root = window.ReactDOM.createRoot(host);
        let overlays = 0;
        try {
          root.render(h(Comp, { locale: 'en' })); await settle(1500);
          let worst = null, n = 0, fails = 0;
          const sample = (scope) => {
          const els = [...scope.querySelectorAll('*')].filter((e) => vis(e) && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && !e.closest('[aria-hidden="true"],svg,[data-ul-illustration],.ul-sr-only'));
          for (const e of els.slice(0, 600)) {
            const cs = getComputedStyle(e); const fg = col(cs.color); if (!fg) continue; const op = parseFloat(cs.opacity); if (op < 0.99 || e.closest('[aria-disabled="true"],:disabled,[data-disabled]')) continue;
            const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight) >= 700), need = big ? 3 : 4.5;
            const L = layers(e); const opaque = L.some((c) => c[3] >= 0.999);
            for (const [bk, b] of Object.entries(BACK)) {
              if (opaque && bk !== 'dark') continue; // an opaque layer hides the backdrop
              let bg = b; for (let i = L.length - 1; i >= 0; i--) bg = C.over(L[i], bg);
              const r = C.ratio(fg, bg); n++; total++;
              if (r < need) fails++;
              if (!worst || r / need < worst.r / worst.need) worst = { r: C.round(r), need, backdrop: bk, text: (e.textContent || '').trim().slice(0, 28), cls: String(e.className).slice(0, 40) };
            }
          }
          };
          sample(host);
          const trig = [...host.querySelectorAll('[aria-haspopup][aria-expanded]')].filter((x) => vis(x) && !x.hasAttribute('data-ul-hovercard-trigger')).slice(0, 4);
          for (const tg of trig) { tg.click(); await settle(900); for (const s of popupSurfaces()) sample(s); overlays += popupSurfaces().length; await closeAll(); await settle(300); }
          rows.push({ area: name, mode, samples: n, fails, worst, overlays });
        } finally { root.unmount(); host.remove(); await raf(); }
      }
      window.__fallbackAudit = { mode, rows, total };
      const checks = rows.map((r) => ({ key: r.area, label: r.area + ' · ' + r.mode, pass: r.fails === 0, value: `${r.samples} samples (${r.overlays} overlays) · ${r.fails} below · worst ${r.worst ? r.worst.r + ':1 (need ' + r.worst.need + ', ' + r.worst.backdrop + ', "' + r.worst.text + '" .' + r.worst.cls + ')' : '–'}` }));
      return { status: checks.every((c) => c.pass) ? 'pass' : 'fail', checks, driver: 'frame-independent (computed colours, background-colour stack over dark / mid / light backdrops)' };
    }

    /* ---------- static a11y sweep (item 8a) ---------- */
    async function a11yStaticTest() {
      const q = new URLSearchParams(location.search), only = q.get('kbdonly') ? q.get('kbdonly').split(',') : null;
      const P = { noName: [], noLabel: [], roles: [], dupIds: [], hit: [], hitExc: [], posTab: [] }; let scanned = 0, controls = 0;
      const name = (el) => (el.getAttribute('aria-label') || '').trim() || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((i) => document.getElementById(i)?.textContent || '').join('').trim() || (el.textContent || '').trim() || (el.querySelector('img[alt]')?.getAttribute('alt') || '');
      const where = (sec, el) => sec + (el.closest('[data-demo]') ? '›' + el.closest('[data-demo]').getAttribute('data-demo') : '') + ' ' + (el.getAttribute('role') || el.tagName.toLowerCase()) + '.' + String(el.className).split(' ')[0];
      const scan = (sec, scope) => {
        const ids = new Map(); scope.querySelectorAll('[id]').forEach((e) => ids.set(e.id, (ids.get(e.id) || 0) + 1)); ids.forEach((n, id) => { if (n > 1) P.dupIds.push(sec + ' #' + id + ' ×' + n); });
        scope.querySelectorAll('[tabindex]').forEach((e) => { if (e.tabIndex > 0) P.posTab.push(where(sec, e)); });
        for (const el of scope.querySelectorAll('button,a[href],[role=button],[role=link],[role=menuitem],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=option],input,select,textarea,[role=slider],[role=combobox]')) {
          if (!vis(el) || el.closest('[aria-hidden="true"],[inert]')) continue; controls++;
          const r = el.getAttribute('role');
          if (el.matches('input:not([type=hidden]),select,textarea')) { if (!(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && el.type !== 'submit') P.noLabel.push(where(sec, el)); }
          else if (!name(el)) P.noName.push(where(sec, el));
          if (r === 'option' && !el.closest('[role=listbox],[role=grid],[role=tree]')) P.roles.push('option outside listbox: ' + where(sec, el));
          if (/^menuitem/.test(r || '') && !el.closest('[role=menu],[role=menubar],[role=group]')) P.roles.push('menuitem outside menu: ' + where(sec, el));
          if (r === 'tab' && !el.closest('[role=tablist]')) P.roles.push('tab outside tablist: ' + where(sec, el));
          if (r === 'slider' && !(el.hasAttribute('aria-valuenow') && el.hasAttribute('aria-valuemin') && el.hasAttribute('aria-valuemax'))) P.roles.push('slider values: ' + where(sec, el));
          if (!el.disabled && !skipHit(el)) { const hp = probeHit(el, sec, scope); if (hp.bad && hp.bad[0] !== 'scrollbar') P.hit.push(hp.bad[1]); else if (hp.exception) P.hitExc.push(hp.id + ' · ' + hp.exception); } // ONE definition: the hitarea card's probe
        }
        for (const el of scope.querySelectorAll('[role=tab][aria-controls]')) if (!document.getElementById(el.getAttribute('aria-controls')) && el.getAttribute('aria-selected') === 'true') P.roles.push('tab aria-controls missing panel: ' + where(sec, el));
        for (const el of scope.querySelectorAll('[role=gridcell]')) if (!el.closest('[role=row]')) P.roles.push('gridcell outside row: ' + where(sec, el));
        for (const el of scope.querySelectorAll('[role=progressbar]')) if (!el.hasAttribute('aria-valuenow') && el.getAttribute('aria-busy') !== 'true' && !el.hasAttribute('aria-valuetext')) P.roles.push('progressbar (indeterminate, no valuenow — allowed): ' + where(sec, el));
        for (const el of scope.querySelectorAll('[role=dialog],[role=alertdialog]')) { if (!el.getAttribute('aria-labelledby') && !el.getAttribute('aria-label')) P.roles.push('dialog without label: ' + where(sec, el)); }
      };
      for (const [nm, file] of SECTIONS) {
        if (only && !only.includes(nm)) continue;
        const Comp = file ? await need(nm, file) : Selection; if (!Comp) continue;
        const host = document.createElement('div'); host.setAttribute('data-ul-theme', 'app'); host.style.cssText = 'position:fixed;inset:0;z-index:800;overflow:auto;padding:16px;box-sizing:border-box;background:#0b0d12';
        document.body.appendChild(host); const root = window.ReactDOM.createRoot(host);
        try {
          root.render(h(Comp, { locale: 'en' })); await settle(1500); scanned++;
          scan(nm, host);
          const trig = [...host.querySelectorAll('[aria-haspopup][aria-expanded]')].filter((x) => vis(x) && !x.hasAttribute('data-ul-hovercard-trigger')).slice(0, 4);
          for (const tg of trig) { tg.click(); await settle(900); for (const s of popupSurfaces()) { scan(nm + '(overlay)', s); const dl = s.matches('[role=dialog],[role=alertdialog]') ? s : s.querySelector('[role=dialog],[role=alertdialog]'); if (dl && dl.closest('[data-layout=center],[data-layout=bottom],[data-layout=left],[data-layout=right]') && dl.getAttribute('aria-modal') !== 'true') P.roles.push('modal dialog without aria-modal: ' + nm); } await closeAll(); await settle(300); }
        } finally { root.unmount(); host.remove(); await raf(); }
      }
      const hardRoles = P.roles.filter((x) => !/allowed/.test(x));
      window.__a11yStatic = P;
      const chk = (k, l, arr) => ({ key: k, label: l, pass: arr.length === 0, value: arr.length + (arr.length ? ' · ' + [...new Set(arr)].slice(0, 6).join(' ; ') : '') });
      const checks = [chk('name', 'icon-only / unnamed controls have an accessible name', P.noName), chk('label', 'every input has a label or aria-label', P.noLabel), chk('roles', 'role structure + required aria (listbox/option, menu/menuitem, tab/tablist, grid/gridcell, dialog label, slider values)', hardRoles), chk('ids', 'no duplicate ids per section (incl. open overlays)', P.dupIds), chk('hit', 'interactive hit area ≥ 44px (same probe as card hitarea: elementFromPoint in the 44px box)', P.hit), chk('tabindex', 'no tabindex > 0', P.posTab)];
      checks.push({ key: 'hit-exc', label: 'hit-area exceptions (24px min, DESIGN)', pass: undefined, value: P.hitExc.length + (P.hitExc.length ? ' · ' + [...new Set(P.hitExc.map((x) => x.split(' · ')[1]))].join(' ; ') : '') });
      checks.push({ key: 'info', label: 'sections · controls scanned', pass: undefined, value: scanned + ' · ' + controls + (P.roles.length - hardRoles.length ? ' · ' + (P.roles.length - hardRoles.length) + ' indeterminate progressbars (allowed)' : '') });
      return { status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'frame-independent (static DOM)' };
    }
    /* ---------- hit areas (pre-freeze fixes, item 1): elementFromPoint probes, frame-independent ---------- */
    // Row items (tabs, segmented / toggle-group items, carousel dots, chips, pagination) only extend vertically (ROW).
    const HIT = 44, CTRL = '.ul-cell-more,button,a[href],[role=button],[role=link],[role=menuitem],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=option],select,textarea,input:not([type=hidden]),[role=slider],[role=combobox]';
    const ROW = '.ul-cell-more,.ul-crumb-more,.ul-copyfield-well > *,[role=toolbar] > *,[role=group] > *,.ul-btn-row > *,.ul-pagination *,.ul-tab,.ul-seg-item,.ul-tgroup-item,.ul-car-dot,.ul-feed-chip,.ul-filter-chip > button,.ul-hit-y';
    const hitException = (el) => {
      if (el.closest('.ul-table-wrap[data-density="compact"] td')) return 'dense table cell (density=compact, 24px min)';
      if (el.matches('.ul-feed-target') || (el.tagName === 'A' && (getComputedStyle(el).display === 'inline' || el.closest('p,.ul-prose,[data-inline]')))) return 'inline text link (24px min)';
      if (el.closest('.ul-cal-grid,[role=grid].ul-cal')) return 'calendar day grid (adjacent on both axes)';
      return null;
    };
    const skipHit = (el) => {
      if (el.matches('input[type=checkbox],input[type=radio]')) return true; // visually hidden native input: the label row is the target
      if (el.matches('input,textarea,select') && [el.parentElement, el.closest('.ul-well'), el.closest('.ul-igroup'), el.closest('.ul-field')].some((w) => w && w.getBoundingClientRect().height >= HIT - 0.5)) return true; // well is the target
      if (el.getAttribute('role') === 'slider' && el.closest('.ul-slider-track')) return true; // 44px track is the target
      return false;
    };
    const ownerCtrl = (n) => n && n.closest && n.closest(CTRL);
    const clippedAt = (el, x, y) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.contain.includes('paint')) { const r = p.getBoundingClientRect(); if (x < r.left || x > r.right || y < r.top || y > r.bottom) return p.className ? '.' + String(p.className).split(' ')[0] : p.tagName.toLowerCase(); } } return null; };
    const wellRects = (host) => [...host.querySelectorAll('.ul-tabs-list,.ul-seg')].map((w) => [...w.querySelectorAll('*')].map((n) => { const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })).concat([[...document.querySelectorAll('[data-ul-lens-layer] *')].map((n) => { const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })]);
    // scroll every scrolling ancestor so the control is centred in it (no scrollIntoView)
    const reveal = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) { const pr = p.getBoundingClientRect(), r = el.getBoundingClientRect(); p.scrollTop += (r.top + r.height / 2) - (pr.top + Math.min(pr.height, innerHeight) / 2); p.scrollLeft += (r.left + r.width / 2) - (pr.left + Math.min(pr.width, innerWidth) / 2); } } };
    /** THE hit-area definition (cards hitarea + a11ystatic): reveal the control, then probe its own centre + edges (no other control
     * covers it) and points inside its 44px box outside its visual box (row items: vertical only) with elementFromPoint. */
    function probeHit(el, nm, host) {
      reveal(el); const r = el.getBoundingClientRect();
      if (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) return { skip: 'offscreen' };
      const lib = /(^|\s)ul-/.test(String(el.className)) || !!(el.parentElement && el.parentElement.closest('[class*="ul-"]') && el.closest('.ul-tabs,.ul-seg,.ul-car,.ul-feed,.ul-filterbar,.ul-pagination,.ul-cal,.ul-menu,.ul-chip'));
      if (!lib) return { skip: 'demo' };
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      { const c0 = document.elementFromPoint(cx, cy); if (!c0 || !(c0 === el || el.contains(c0) || c0.contains(el))) return { skip: 'covered' }; }
      const id = nm + ' ' + (el.getAttribute('role') || el.tagName.toLowerCase()) + '.' + String(el.className).split(' ')[0] + ' ' + Math.round(r.width) + '×' + Math.round(r.height);
      const out = { id };
      for (const [x, y] of [[cx, cy], [r.left + 2, cy], [r.right - 2, cy], [cx, r.top + 2], [cx, r.bottom - 2]]) { const f = document.elementFromPoint(x, y), o = ownerCtrl(f); if (o && o !== el && !el.contains(o) && !o.contains(el) && host.contains(o)) { out.steal = id + ' ← ' + (o.getAttribute('aria-label') || String(o.className).split(' ')[0]); break; } }
      if (r.width >= HIT - 0.5 && r.height >= HIT - 0.5) return out;
      out.below = true;
      const exc = hitException(el); if (exc) { out.exception = exc; return out; }
      const row = el.matches(ROW), ex = row ? 0 : Math.max(0, (HIT - r.width) / 2), ey = Math.max(0, (HIT - r.height) / 2);
      const pts = []; if (ey) pts.push([cx, r.top - ey + 1], [cx, r.bottom + ey - 1]); if (ex) pts.push([r.left - ex + 1, cy], [r.right + ex - 1, cy]); if (ex && ey) pts.push([r.left - ex + 1, r.top - ey + 1], [r.right + ex - 1, r.bottom + ey - 1]);
      for (const [x, y] of pts) {
        const f = document.elementFromPoint(x, y); if (f && (f === el || el.contains(f))) continue;
        const o = ownerCtrl(f), c = clippedAt(el, x, y), fr = f && f.getBoundingClientRect(), onBar = f && (f.scrollHeight > f.clientHeight || f.scrollWidth > f.clientWidth) && (y > fr.top + f.clientTop + f.clientHeight || x > fr.left + f.clientLeft + f.clientWidth);
        const at = ' at ' + Math.round(x - r.left) + ',' + Math.round(y - r.top);
        out.bad = onBar ? ['scrollbar', id + ' (classic scrollbar of .' + String(f.className).split(' ')[0] + ')'] : c ? ['clipped', id + ' by ' + c] : ['missing', id + ' in .' + String(el.parentElement.className).split(' ')[0] + ' → ' + (o && o !== el ? 'neighbour ' + String(o.className).split(' ')[0] : f ? f.tagName.toLowerCase() + '.' + String(f.className).split(' ')[0] : 'none') + at];
        return out;
      }
      if (row && r.width < HIT - 0.5) out.rowNarrow = true;
      return out;
    }
    async function hitAreaTest() {
      const q = new URLSearchParams(location.search), only = q.get('kbdonly') ? q.get('kbdonly').split(',') : null;
      if (q.get('hit') === 'off') document.documentElement.dataset.ulHitBaseline = '1';
      const R = { controls: 0, visualBelow: 0, effectiveBelow: [], missing: [], scrollbar: [], clipped: [], steals: [], rowNarrow: [], exceptions: [], demo: 0, offscreen: 0, geometry: [], perSection: {} };
      for (const [nm, file] of SECTIONS) {
        if (only && !only.includes(nm)) continue;
        const Comp = file ? await need(nm, file) : Selection; if (!Comp) continue;
        const host = document.createElement('div'); host.setAttribute('data-ul-theme', 'app'); host.style.cssText = 'position:fixed;inset:0;z-index:800;overflow:auto;padding:16px;box-sizing:border-box;background:#0b0d12';
        document.body.appendChild(host); const root = window.ReactDOM.createRoot(host); let n = 0, below = 0;
        try {
          root.render(h(Comp, { locale: 'en' })); await settle(1500);
          // geometry: tabs / segmented / toggle-group items and the lens bubble are identical with the hit layer on and off
          const g0 = JSON.stringify(wellRects(host)); document.documentElement.dataset.ulHit = 'off'; await raf(); await raf();
          const g1 = JSON.stringify(wellRects(host)); if (!document.documentElement.dataset.ulHitBaseline) delete document.documentElement.dataset.ulHit; await raf(); await raf();
          if (g0 !== g1) R.geometry.push(nm);
          const list = [...host.querySelectorAll(CTRL)].filter((el) => vis(el) && !el.closest('[aria-hidden="true"],[inert]') && !el.disabled && !skipHit(el));
          for (const el of list) {
            const p = probeHit(el, nm, host);
            if (p.skip) { R[p.skip]++; continue; }
            n++; R.controls++;
            if (p.steal) R.steals.push(p.steal);
            if (!p.below) continue;
            R.visualBelow++; below++;
            if (p.exception) { R.exceptions.push(p.id + ' · ' + p.exception); continue; }
            if (p.bad) { R[p.bad[0]].push(p.bad[1]); R.effectiveBelow.push(p.id + ' · ' + p.bad[0]); }
            else if (p.rowNarrow) R.rowNarrow.push(p.id + ' · row item, vertical extension only');
          }
        } finally { root.unmount(); host.remove(); await raf(); }
        R.perSection[nm] = n + ' controls · ' + below + ' visually < 44';
      }
      window.__hitArea = R;
      const u = (a) => [...new Set(a)];
      const chk = (k, l, arr) => ({ key: k, label: l, pass: arr.length === 0, value: arr.length + (arr.length ? ' · ' + u(arr).slice(0, 6).join(' ; ') : '') });
      const checks = [
        chk('missing', 'every library control < 44px resolves elementFromPoint to itself in its 44px box (row items: vertical)', R.missing),
        chk('clipped', 'no hit layer clipped by an overflow / paint container', R.clipped),
        chk('steals', 'centre + edges of every control resolve to that control (no hit layer over a neighbour)', R.steals),
        chk('geometry', 'tabs / segmented / toggle-group item rects and the lens bubble identical with the hit layer on and off', R.geometry),
        { key: 'counts', label: 'library controls · visually < 44 · effective hit < 44 (excl. exceptions)', pass: undefined, value: R.controls + ' · ' + R.visualBelow + ' · ' + R.effectiveBelow.length },
        { key: 'scrollbar', label: 'hit box partly on a classic (space-taking) scrollbar of its scroller (platform, listed)', pass: undefined, value: R.scrollbar.length + (R.scrollbar.length ? ' · ' + [...new Set(R.scrollbar)].slice(0, 4).join(' ; ') : '') },
        { key: 'exceptions', label: 'documented exceptions (24px min, DESIGN)', pass: undefined, value: R.exceptions.length + (R.exceptions.length ? ' · ' + u(R.exceptions.map((x) => x.split(' · ')[1])).join(' ; ') : '') },
        { key: 'row', label: 'row items narrower than 44 (vertical only by rule)', pass: undefined, value: R.rowNarrow.length + (R.rowNarrow.length ? ' · ' + u(R.rowNarrow.map((x) => x.split(' ')[1].split(' ')[0])).join(' ; ') : '') },
        { key: 'skip', label: 'demo chrome skipped · off-screen skipped · covered by a non-control layer (loading / scrim) skipped', pass: undefined, value: R.demo + ' · ' + R.offscreen + ' · ' + (R.covered || 0) }];
      return { status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'frame-independent (elementFromPoint, static DOM)' };
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { a11yStaticTest, fallbackAuditTest, kbdAuditTest, hitAreaTest, __kbdTabbables: tabbables });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
