// Showcase demos for stage 2c (containers + overlays). Composes window.UL only; no motion or placement of its own.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const { useState, useRef } = React;
    const ic = (n) => h(UL.ULIcon, { name: n });
    const H3 = (t) => h('h3', { style: { alignSelf: 'flex-start', margin: '8px 0 0', padding: '4px 10px', borderRadius: '10px', background: 'rgb(11 13 18 / .82)', fontSize: '17px', fontWeight: 600 } }, t);
    const P = (t) => h('p', { style: { margin: 0, maxWidth: '900px', fontSize: '14px', lineHeight: 1.55, color: 'var(--ul-color-text-2)' } }, t);
    const Pb = (t) => h('p', { style: { margin: 0, alignSelf: 'flex-start', maxWidth: '900px', padding: '8px 12px', borderRadius: '10px', background: 'rgb(11 13 18 / .82)', fontSize: '14px', lineHeight: 1.55, color: 'var(--ul-color-text-2)' } }, t);
    const row = (kids, s) => h('div', { style: Object.assign({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '16px' }, s) }, ...kids);
    const cap = (t) => h('span', { style: { fontFamily: 'var(--ul-font-mono)', fontSize: '11px', letterSpacing: '.08em', color: 'var(--ul-color-text)', textShadow: '0 1px 2px rgb(0 0 0 / .8)' } }, t);
    const Btn = (p, t) => h(UL.ULButton, Object.assign({ variant: 'secondary' }, p), t);
    const lorem = 'Projects are grouped by client. Each one keeps its brief, timeline, files and invoices together, so the whole team sees the same state.';

    function Cards({ backdrop }) {
      const st = ['default', 'hover', 'focus', 'pressed', 'disabled', 'loading', 'error', 'selected'];
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        H3('Card · sizes'),
        row(['sm', 'md', 'lg'].map((s) => h(UL.ULCard, { key: s, size: s, backdrop, title: 'Client portal', description: s.toUpperCase() + ' · static', style: { width: s === 'sm' ? '220px' : s === 'md' ? '300px' : '380px' } }, lorem))),
        H3('Interactive card · states (title is the one link; whole card is its hit area)'),
        row(st.map((s) => h('div', { key: s, style: { display: 'flex', flexDirection: 'column', gap: '8px', width: '210px' } }, cap(s.toUpperCase()),
          h(UL.ULCard, { size: 'sm', backdrop, href: '#card', title: 'Orders', description: '12 open · 3 late', forceState: ['hover', 'focus', 'pressed'].includes(s) ? s : undefined, disabled: s === 'disabled', loading: s === 'loading', error: s === 'error' ? 'Could not load orders' : undefined, selected: s === 'selected' || undefined,
            footer: h(UL.ULButton, { size: 'sm', variant: 'plain', onClick: (e) => e.preventDefault() }, 'Archive') })))),
        H3('Panel · glass · calm · well'),
        row(['glass', 'calm', 'well'].map((s) => h(UL.ULPanel, { key: s, surface: s, backdrop, title: s === 'glass' ? 'Glass panel (lg)' : s === 'calm' ? 'Calm panel (data)' : 'Inset well', description: s === 'glass' ? 'Big surface: lite first under the budget' : 'Never refracts', style: { width: '320px' }, footer: Btn({ size: 'sm' }, 'Open') }, P(lorem)))),
      );
    }

    const MENU = [
      { id: 'new', label: 'New project', icon: ic('plus'), shortcut: '⌘N' },
      { id: 'dup', label: 'Duplicate', shortcut: '⌘D' },
      { id: 'share', label: 'Share', items: [{ id: 'link', label: 'Copy link' }, { id: 'mail', label: 'Send by e-mail' }, { id: 'more', label: 'More', items: [{ id: 'emb', label: 'Embed code' }, { id: 'qr', label: 'QR code' }] }] },
      { type: 'separator' },
      { type: 'label', label: 'View' },
      { id: 'grid', label: 'Show grid', type: 'checkbox', checked: true },
      { id: 'cmp', label: 'Compact rows', type: 'checkbox', checked: false },
      { type: 'separator' },
      { id: 'arch', label: 'Archive', disabled: true },
      { id: 'del', label: 'Delete', destructive: true },
    ];
    const CMDS = [
      { id: 'np', label: 'New project', group: 'Projects', icon: ic('plus'), shortcut: '⌘N' },
      { id: 'op', label: 'Open project…', group: 'Projects', keywords: ['find', 'switch'] },
      { id: 'inv', label: 'Create invoice', group: 'Billing', keywords: ['bill', 'faktura'] },
      { id: 'pay', label: 'Record payment', group: 'Billing' },
      { id: 'th', label: 'Toggle theme', group: 'Settings', keywords: ['dark', 'light'] },
      { id: 'lang', label: 'Change language', group: 'Settings', keywords: ['slovak', 'german', 'czech'] },
      { id: 'inv2', label: 'Invite teammate', group: 'Team', icon: ic('plus') },
      { id: 'logs', label: 'View activity log', group: 'Team', disabled: true },
    ];

    function Overlays({ backdrop, toast }) {
      const [o, setO] = useState({});
      const set = (k, v) => setO((s) => Object.assign({}, s, { [k]: v }));
      const R = { modal: useRef(null), reading: useRef(null), alert: useRef(null), stack: useRef(null), sheet: useRef(null), dr: useRef(null), dl: useRef(null), pop: useRef(null), popR: useRef(null), toast: useRef(null), cmd: useRef(null), menu: useRef(null) };
      const trig = (k, label, extra) => h(UL.ULButton, Object.assign({ ref: R[k], 'data-test': k, onClick: () => set(k, !o[k]), 'aria-haspopup': 'dialog', 'aria-expanded': !!o[k] }, extra), label);
      const [sel, setSel] = useState('');
      const [items, setItems] = useState(MENU);
      const onAction = (id) => { setSel(id); setItems((l) => l.map((x) => (x.id === id && x.type === 'checkbox' ? Object.assign({}, x, { checked: !x.checked }) : x))); };
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        H3('Modal, sheet, drawer, popover, toast, tooltip, command palette'),
        Pb('Every surface below is ULAnchoredSurface: it pours out of its trigger (the trigger stays visible and clickable through the clip-path hole) on the shared morph, and reverses from wherever it is when interrupted. Modals, drawers and menus lock page scroll without layout shift; popovers and tooltips follow their anchor; toasts stay fixed. Esc closes only the top layer.'),
        row([
          trig('modal', 'Modal'), trig('reading', 'Reading modal'), trig('alert', 'Alert dialog'), trig('stack', 'Dialog: push views'), trig('sheet', 'Sheet'),
          h(UL.ULButton, { ref: R.dr, 'data-test': 'dr', onClick: () => set('dr', true) }, 'Drawer (right)'),
          h(UL.ULButton, { ref: R.dl, 'data-test': 'dl', onClick: () => set('dl', true) }, 'Drawer (left, nav)'),
          trig('pop', 'Popover + arrow'), trig('popR', 'Reading popover'),
          h(UL.ULTooltip, { content: 'Copies the share link' }, h(UL.ULButton, { variant: 'secondary', 'data-test': 'tip' }, 'Tooltip')),
          h(UL.ULButton, { ref: R.toast, 'data-test': 'toast', onClick: () => set('toast', true) }, 'Anchored toast'),
          h(UL.ULButton, { ref: R.cmd, 'data-test': 'cmd', icon: ic('search'), onClick: () => set('cmd', true) }, 'Search  ⌘K'),
        ]),
        row([
          h(UL.ULButton, { variant: 'tinted', 'data-test': 'toast-ok', onClick: () => toast.toast({ title: 'Invoice sent', description: 'INV-2026-114 to Novak s.r.o.', tone: 'success' }) }, 'Toast · success'),
          h(UL.ULButton, { variant: 'tinted', onClick: () => toast.toast({ title: 'Project archived', tone: 'neutral', action: { label: 'Undo', onAction: () => toast.toast({ title: 'Restored' }) } }) }, 'Toast · action'),
          h(UL.ULButton, { variant: 'tinted', onClick: () => toast.toast({ title: 'Upload failed', description: 'The file is larger than 25 MB.', tone: 'danger' }) }, 'Toast · error (stays)'),
          h(UL.ULButton, { variant: 'secondary', onClick: () => [1, 2, 3, 4, 5].forEach((n) => toast.toast({ title: 'Queued toast ' + n })) }, 'Queue 5 (max 3)'),
        ]),
        H3('Menu, nested submenus, context menu'),
        row([
          h(UL.ULMenuButton, { items, label: 'Project actions', onAction, buttonProps: { className: 'ul-demo-menu-btn', 'data-test': 'menu', style: { padding: '0 18px', borderRadius: '999px', border: '1px solid rgb(255 255 255 / .2)', background: 'rgb(255 255 255 / .06)', color: 'var(--ul-color-text)', font: 'inherit', cursor: 'pointer' } } }, 'Actions ▾'),
          h(UL.ULContextMenu, { items: MENU, label: 'Canvas', onAction: setSel },
            h('div', { tabIndex: 0, 'data-test': 'ctx', style: { display: 'grid', placeItems: 'center', width: '360px', height: '120px', borderRadius: '20px', border: '1px dashed rgb(255 255 255 / .35)', background: 'var(--ul-panel-bg)', color: 'var(--ul-color-text-2)', fontSize: '14px', outline: 'none' } }, 'Right-click here · Shift+F10 · Menu key')),
          cap('last action: ' + (sel || '—')),
        ]),
        h(UL.ULModal, { open: !!o.modal, onOpenChange: (v) => set('modal', v), triggerRef: R.modal, title: 'Rename project', description: 'The new name is shown to everyone on the project.', backdrop,
          footer: [h(UL.ULButton, { key: 'c', variant: 'secondary', onClick: () => set('modal', false) }, 'Cancel'), h(UL.ULButton, { key: 's', onClick: () => set('modal', false) }, 'Save')] },
          h(UL.ULTextField, { label: 'Project name', defaultValue: 'Client portal', 'data-autofocus': true })),
        h(UL.ULModal, { open: !!o.reading, onOpenChange: (v) => set('reading', v), triggerRef: R.reading, size: 'reading', title: 'Terms of the pilot', description: 'Reading variant: light backdrop class, longer measure.' },
          ...[1, 2, 3, 4, 5, 6].map((i) => h('p', { key: i }, lorem + ' ' + lorem))),
        h(UL.ULModal, { open: !!o.alert, onOpenChange: (v) => set('alert', v), triggerRef: R.alert, role: 'alertdialog', size: 'sm', title: 'Delete project?', description: 'This removes 214 files. It cannot be undone.', hideClose: true,
          footer: [h(UL.ULButton, { key: 'c', variant: 'secondary', 'data-autofocus': true, onClick: () => set('alert', false) }, 'Cancel'), h(UL.ULButton, { key: 'd', variant: 'destructive', onClick: () => set('alert', false) }, 'Delete')] }),
        h(UL.ULModal, { open: !!o.stack, onOpenChange: (v) => set('stack', v), triggerRef: R.stack, title: 'Invite teammates', description: 'Choose role pushes a view into the same surface; Back / Esc pops it.' },
          h(StackInner)),
        h(UL.ULSheet, { open: !!o.sheet, onOpenChange: (v) => set('sheet', v), triggerRef: R.sheet, title: 'Filters', description: 'Drag the grabber down to dismiss.' }, P(lorem), P(lorem)),
        h(UL.ULDrawer, { open: !!o.dr, onOpenChange: (v) => set('dr', v), triggerRef: R.dr, side: 'right', title: 'Account', description: 'Right edge (future user drawer).', footer: h(UL.ULButton, { variant: 'secondary', onClick: () => set('dr', false) }, 'Close') }, P(lorem), h(UL.ULSwitch, { label: 'E-mail notifications', defaultChecked: true })),
        h(UL.ULDrawer, { open: !!o.dl, onOpenChange: (v) => set('dl', v), triggerRef: R.dl, side: 'left', title: 'Navigation' }, ...['Dashboard', 'Projects', 'Clients', 'Invoices', 'Settings'].map((t) => h('a', { key: t, href: '#' + t, style: { display: 'flex', alignItems: 'center', minHeight: '44px', padding: '0 12px', borderRadius: '12px', color: 'var(--ul-color-text)', textDecoration: 'none' } }, t))),
        h(UL.ULPopover, { open: !!o.pop, onOpenChange: (v) => set('pop', v), triggerRef: R.pop, arrow: true, title: 'Share link', side: 'bottom' }, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, 'Anyone with the link can view.', Btn({ size: 'sm' }, 'Copy link'))),
        h(UL.ULPopover, { open: !!o.popR, onOpenChange: (v) => set('popR', v), triggerRef: R.popR, reading: true, side: 'top', label: 'About this metric' }, lorem),
        h(UL.ULToast, { open: !!o.toast, onOpenChange: (v) => set('toast', v), anchorRef: R.toast, title: 'Link copied', tone: 'success', duration: 3500 }),
        h(UL.ULCommandPalette, { open: !!o.cmd, onOpenChange: (v) => set('cmd', v), triggerRef: R.cmd, items: CMDS.map((c) => Object.assign({}, c, { onRun: () => setSel(c.id) })) }),
      );
    }
    // was "stacked modals": now a push inside the SAME surface (no second layer)
    function StackInner() {
      const dlg = UL.useDialog();
      const role = () => dlg.push({ key: 'role', title: 'Choose role', size: 'sm', content: h(UL.ULRadioGroup, { label: 'Role', defaultValue: 'edit' }, h(UL.ULRadio, { value: 'view', label: 'Viewer' }), h(UL.ULRadio, { value: 'edit', label: 'Editor' }), h(UL.ULRadio, { value: 'admin', label: 'Admin' })),
        footer: [h(UL.ULButton, { key: 'b', variant: 'secondary', onClick: () => dlg.pop() }, 'Back'), h(UL.ULButton, { key: 'p', onClick: () => dlg.push({ key: 'perm', title: 'Permissions', size: 'lg', content: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, ...['Projects', 'Invoices', 'Files', 'Team'].map((t) => h(UL.ULSwitch, { key: t, label: t, defaultChecked: t !== 'Team' }))), footer: h(UL.ULButton, { onClick: () => dlg.close() }, 'Send invite') }) }, 'Next')] });
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, h(UL.ULTextField, { label: 'E-mail', placeholder: 'name@company.com' }),
        h(UL.ULButton, { variant: 'secondary', 'data-test': 'stack2', onClick: role }, 'Choose role…'));
    }

    function Layout({ backdrop }) {
      const [col, setCol] = useState(false), [cur, setCur] = useState('dash');
      const sections = [
        { items: [{ id: 'dash', label: 'Dashboard', icon: ic('layout-grid') }, { id: 'proj', label: 'Projects', icon: ic('calendar'), badge: '12' }] },
        { label: 'Billing', items: [{ id: 'inv', label: 'Invoices', icon: ic('menu') }, { id: 'pay', label: 'Payments', icon: ic('check') }, { id: 'old', label: 'Legacy export', icon: ic('x'), disabled: true }] },
      ];
      const tb = [
        { label: 'Text', items: [{ id: 'b', label: 'Bold', icon: h('b', null, 'B'), toggle: true, pressed: true }, { id: 'i', label: 'Italic', icon: h('i', null, 'I'), toggle: true }, { id: 'u', label: 'Underline', icon: h('u', null, 'U'), toggle: true }] },
        { label: 'Insert', items: [{ id: 'img', label: 'Image', icon: ic('plus') }, { id: 'tbl', label: 'Table', icon: ic('layout-grid') }, { id: 'lnk', label: 'Link', icon: ic('chevron-right') }, { id: 'cal', label: 'Date', icon: ic('calendar') }] },
        { label: 'Actions', items: [{ id: 'srch', label: 'Find', icon: ic('search') }, { id: 'del', label: 'Delete', icon: ic('x') }] },
      ];
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        H3('Sidebar (elastic width) · toolbar (overflow menu, roving focus)'),
        h('div', { style: { display: 'flex', gap: '20px', alignItems: 'stretch', height: '420px' } },
          h(UL.ULSidebar, { sections, value: cur, onValueChange: setCur, collapsed: col, onCollapsedChange: setCol, header: h('strong', { style: { fontSize: '15px' } }, 'Ultra Labs'), drawer: 'never', backdrop }),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', flex: '1 1 auto', minWidth: 0 } },
            h('div', { style: { resize: 'horizontal', overflow: 'hidden', maxWidth: '100%', minWidth: '240px', width: '100%' } }, h(UL.ULToolbar, { groups: tb, label: 'Formatting', backdrop })),
            Pb('Drag the corner of the toolbar row to narrow it: items that no longer fit move into the More menu. ← → move between items, one tab stop.'),
            H3('Accordion'),
            h(UL.ULPanel, { surface: 'calm' }, h(UL.ULAccordion, { type: 'single', defaultValue: ['a'], items: [{ value: 'a', title: 'What does the pilot include?', content: lorem }, { value: 'b', title: 'Who owns the code?', content: lorem + ' ' + lorem }, { value: 'c', title: 'Can we cancel?', content: lorem }, { value: 'd', title: 'Disabled item', content: '', disabled: true }] })),
            h(UL.ULTabs, { 'aria-label': 'Project', keepMounted: true, defaultValue: 'o', items: [{ value: 'o', label: 'Overview', content: P('Overview panel (lazy, kept mounted after first visit).') }, { value: 'f', label: 'Files', content: P('Files panel.') }, { value: 'b', label: 'Billing', content: P('Billing panel.') }] }),
          )),
      );
    }

    function Containers(props) {
      const backdrop = props.backdrop;
      return h(UL.ULToastProvider, { position: 'bottom-right' }, h(Inner, { backdrop }));
    }
    function Inner({ backdrop }) {
      const toast = UL.useToast();
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '28px' } }, h(Cards, { backdrop }), h(Overlays, { backdrop, toast }), h(Layout, { backdrop }));
    }
    function PushFixture({ TS }) {
      const dlg = UL.useDialog(); window.__mtDialog = dlg;
      const [name, setName] = useState('Client portal');
      return h('div', { 'data-case': 'stack2', style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, h('input', { 'aria-label': 'Name', value: name, onChange: (e) => setName(e.target.value), style: { minHeight: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #fff4', background: '#0006', color: '#fff' } }),
        h('button', { type: 'button', 'data-mt': 'push', style: TS, onClick: () => dlg.push({ key: 'second', title: 'Second view', size: 'lg', content: h('p', null, lorem + ' ' + lorem) }) }, 'Push second'),
        h(PopIn, { TS }));
    }
    function PopIn({ TS }) { const [o, setO] = useState(false); const r = useRef(null); return h(React.Fragment, null, h('button', { ref: r, type: 'button', 'data-mt': 'inpop', style: TS, onClick: () => setO(!o) }, 'Popover from inside'), h(UL.ULPopover, { open: o, onOpenChange: setO, triggerRef: r, title: 'Inside a dialog', autoFocus: false }, 'Opens above its trigger from frame one.')); }
    // Motion-test fixtures: every 2c overlay, controlled through window.__mt2c.set(key, open).
    function MotionFixtures() {
      return h(UL.ULToastProvider, { position: 'bottom-right' }, h(MFInner));
    }
    function MFInner() {
      const [o, setO] = useState({});
      const toast = UL.useToast();
      const R = { modal: useRef(null), stack1: useRef(null), stack2: useRef(null), sheet: useRef(null), dr: useRef(null), dl: useRef(null), pop: useRef(null), toast: useRef(null), menu: useRef(null), cmd: useRef(null), alert: useRef(null) };
      React.useEffect(() => {
        window.__mt2c = {
          set: (k, v) => setO((s) => Object.assign({}, s, { [k]: v })),
          toast: (v) => (v ? toast.toast({ id: 'mt', title: 'Invoice sent', description: 'INV-2026-114', tone: 'success', duration: 60000 }) : toast.dismiss('mt')),
        };
        window.__mt2cToast = (i) => toast.toast({ id: 'q' + i, title: 'Queued toast ' + (i + 1), description: 'Placement test', duration: 60000 });
        window.__mt2cToastClear = () => toast.dismiss();
        window.dispatchEvent(new Event('ul:mt2c-ready'));
      }, []);
      // plain (non-glass) triggers: the fixture row must not add refraction load to a timing test page
      const TS = { minHeight: '44px', padding: '0 16px', borderRadius: '999px', border: '1px solid rgb(255 255 255 / .35)', background: 'rgb(255 255 255 / .1)', color: '#fff', font: '600 14px/1 inherit', cursor: 'pointer' };
      const b = (k, t) => h('div', { 'data-case': k, key: k }, h('button', { ref: R[k], type: 'button', style: TS, 'aria-expanded': !!o[k], onClick: () => setO((s) => Object.assign({}, s, { [k]: !s[k] })) }, t));
      const close = (k) => (v) => setO((s) => Object.assign({}, s, { [k]: v }));
      return h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' } },
        b('modal', 'Modal'), b('stack1', 'Stacked'), b('sheet', 'Sheet'), b('dr', 'Drawer R'), b('dl', 'Drawer L'), b('pop', 'Popover'), b('toast', 'Toast'), b('menu', 'Menu'), b('cmd', 'Search'), b('alert', 'Alert'),
        h('div', { 'data-case': 'stackorigin', key: 'so' }, h('button', { type: 'button', style: TS, onClick: () => window.__mt2c.toast(true) }, 'Stack toast')),
        h('div', { 'data-case': 'sidebar', style: { height: '260px' } }, h(UL.ULSidebar, { drawer: 'never', value: 'b', sections: [{ items: [{ id: 'a', label: 'Dashboard', icon: ic('layout-grid') }, { id: 'b', label: 'Projects', icon: ic('calendar') }, { id: 'c', label: 'Invoices', icon: ic('menu') }] }] })),
        h(UL.ULContextMenu, { items: MENU, label: 'Canvas' }, h('div', { 'data-case': 'ctx', tabIndex: 0, style: { display: 'grid', placeItems: 'center', width: '220px', height: '80px', borderRadius: '16px', border: '1px dashed rgb(255 255 255 / .4)', color: '#cfd6e2', fontSize: '13px' } }, 'context target')),
        h(UL.ULModal, { open: !!o.modal, onOpenChange: close('modal'), triggerRef: R.modal, title: 'Rename project', footer: h(UL.ULButton, { onClick: () => close('modal')(false) }, 'Save') }, h(UL.ULTextField, { label: 'Name', defaultValue: 'Client portal' })),
        h(UL.ULModal, { open: !!o.stack1, onOpenChange: close('stack1'), triggerRef: R.stack1, title: 'First view' }, h(PushFixture, { TS })),
        h(UL.ULSheet, { open: !!o.sheet, onOpenChange: close('sheet'), triggerRef: R.sheet, title: 'Filters' }, lorem),
        h(UL.ULDrawer, { open: !!o.dr, onOpenChange: close('dr'), triggerRef: R.dr, side: 'right', title: 'Account' }, lorem),
        h(UL.ULDrawer, { open: !!o.dl, onOpenChange: close('dl'), triggerRef: R.dl, side: 'left', title: 'Navigation' }, lorem),
        h(UL.ULPopover, { open: !!o.pop, onOpenChange: close('pop'), triggerRef: R.pop, arrow: true, title: 'Share link', autoFocus: false }, 'Anyone with the link can view.'),
        h(UL.ULToast, { open: !!o.toast, onOpenChange: close('toast'), anchorRef: R.toast, title: 'Link copied', tone: 'success', duration: 60000 }),
        h(UL.ULMenu, { open: !!o.menu, onOpenChange: close('menu'), anchorRef: R.menu, items: MENU, label: 'Actions', initialFocus: null }),
        h(UL.ULCommandPalette, { open: !!o.cmd, onOpenChange: close('cmd'), triggerRef: R.cmd, items: CMDS, hotkey: false }),
        h(UL.ULModal, { open: !!o.alert, onOpenChange: close('alert'), triggerRef: R.alert, role: 'alertdialog', size: 'sm', title: 'Delete project?', footer: h(UL.ULButton, { variant: 'secondary', 'data-autofocus': true, onClick: () => close('alert')(false) }, 'Cancel') }, 'This cannot be undone.'),
      );
    }
    // Automated scroll check for the 2c overlays (motion-test → "2c scroll behavior"). Same result shape as thumb-harness.
    async function scroll2c() {
      const M = window.__mt2c, wait = (ms) => new Promise((r) => setTimeout(r, ms)), html = document.documentElement;
      const checks = [], ck = (key, label, pass, value) => checks.push({ key, label, pass, value });
      const ref = document.querySelector('h1'), surfOf = () => { const s = [...document.querySelectorAll('.ul-anchored')].filter((n) => n.style.visibility !== 'hidden'); return s[s.length - 1] || null; };
      const exp = { modal: 'lock', sheet: 'lock', dr: 'lock', dl: 'lock', menu: 'lock', cmd: 'lock', pop: 'follow', toast: 'fixed' };
      if (document.scrollingElement.scrollHeight <= innerHeight + 200) document.body.style.minHeight = innerHeight * 3 + 'px';
      for (const [k, want] of Object.entries(exp)) {
        const btn = document.querySelector(`[data-case="${k}"] button`); if (!btn) continue;
        const b = btn.getBoundingClientRect(); if (b.top < 120 || b.bottom > innerHeight - 200) { scrollBy(0, b.top - innerHeight * 0.35); await wait(80); }
        const x0 = ref.getBoundingClientRect().left, y0 = scrollY;
        M.set(k, true); await wait(800);
        const locked = html.hasAttribute('data-ul-scroll-locked'), shift = Math.abs(ref.getBoundingClientRect().left - x0);
        const s = surfOf(), r0 = s && s.getBoundingClientRect();
        scrollTo(0, y0 + 60); await wait(120);
        const r1 = s && s.getBoundingClientRect(), moved = r0 && r1 ? r1.top - r0.top : NaN, dy = scrollY - y0;
        let ok;
        if (want === 'lock') ok = locked && shift < 0.5;
        else if (want === 'follow') ok = !locked && Math.abs(moved + dy) < 1.5;
        else ok = !locked && Math.abs(moved) < 0.5;
        ck(k, `${k}: ${want}${want === 'lock' ? ' (no layout shift)' : want === 'follow' ? ' (moves with the anchor)' : ' (stays put)'}`, ok, `locked ${locked} · shift ${shift.toFixed(1)}px · page Δ${dy} · surface Δ${Number.isFinite(moved) ? moved.toFixed(1) : '?'}`);
        scrollTo(0, y0); M.set(k, false); await wait(700);
        ck(k + '-un', `${k}: unlocked + scroll restored after close`, !html.hasAttribute('data-ul-scroll-locked') && Math.abs(scrollY - y0) < 1, `locked ${html.hasAttribute('data-ul-scroll-locked')} · y ${scrollY}/${y0}`);
      }
      // dialog context: push stays in the SAME surface; Esc pops one level, then closes
      M.set('stack1', true); await wait(800);
      const n0 = document.querySelectorAll('.ul-modal-surface').length;
      window.__mtDialog.push({ key: 'second', title: 'Second view', content: 'x' }); await wait(900);
      const n1 = document.querySelectorAll('.ul-modal-surface').length, d1 = window.__mtDialog.depth;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(900);
      const open1 = [...document.querySelectorAll('.ul-modal-surface')].some((n) => n.style.visibility !== 'hidden');
      ck('push', 'push keeps one surface; Esc pops (dialog stays open)', n0 === n1 && open1, `surfaces ${n0} → ${n1} · depth after push ${d1} · open after Esc ${open1}`);
      M.set('stack1', false); await wait(700);
      return { status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'live' };
    }
    // Dialog context test (motion-test → "Dialog: same-surface push / pop"). Per frame, live.
    async function dialogTest() {
      const M = window.__mt2c, wait = (ms) => new Promise((r) => setTimeout(r, ms)), raf = () => new Promise((r) => requestAnimationFrame(r));
      const checks = [], ck = (key, label, pass, value) => checks.push({ key, label, pass, value });
      M.set('stack1', true); await wait(900);
      const s = [...document.querySelectorAll('.ul-dialog')].find((n) => n.style.visibility !== 'hidden');
      if (!s) return { status: 'fail', checks: [{ key: 'open', label: 'dialog opens', pass: false, value: 'no surface' }] };
      const dlg = () => window.__mtDialog;
      const sampleRun = async (act, ms = 760) => {
        const S = []; act(); const t0 = document.timeline.currentTime;
        while (document.timeline.currentTime - t0 < ms) {
          await raf();
          const r = s.getBoundingClientRect(), nav = s.querySelector('.ul-dialog-nav').getBoundingClientRect(), btns = s.querySelectorAll('.ul-dialog-navbtn');
          const op = [...s.querySelectorAll('.ul-dialog-view')].filter((v) => !v.hidden).map((v) => Math.max(0, ...[...v.children].map((k) => +getComputedStyle(k).opacity)) * +getComputedStyle(v).opacity);
          const close = btns[1].getBoundingClientRect(), back = btns[0];
          S.push({ t: document.timeline.currentTime - t0, x: r.left, y: r.top, w: r.width, h: r.height, navDy: nav.top - r.top, navDr: r.right - nav.right, closeDx: r.right - close.right, closeDy: close.top - r.top, backOn: back.hasAttribute('data-show'), vis: op.filter((o) => o > 0.5).length });
        }
        return S;
      };
      const analyse = (S, name) => {
        const sizes = new Set(S.map((p) => Math.round(p.w) + 'x' + Math.round(p.h))).size;
        let maxV = 0; for (let i = 1; i < S.length; i++) { const dt = S[i].t - S[i - 1].t; if (dt < 2) continue; const dd = Math.max(...['x', 'y', 'w', 'h'].map((k) => Math.abs(S[i][k] - S[i - 1][k]))); maxV = Math.max(maxV, dd / dt); }
        const navOk = S.every((p) => Math.abs(p.navDy - S[0].navDy) <= 1 && Math.abs(p.navDr - S[0].navDr) <= 1);
        const closeOk = S.every((p) => Math.abs(p.closeDx - S[0].closeDx) <= 1 && Math.abs(p.closeDy - S[0].closeDy) <= 1);
        const one = S.every((p) => p.vis <= 1);
        return { sizes, maxV, navOk, closeOk, one, last: S[S.length - 1] };
      };
      const input = s.querySelector('input[aria-label="Name"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(input, 'Edited name'); input.dispatchEvent(new Event('input', { bubbles: true })); await wait(50);
      const pushBtn = s.querySelector('[data-mt="push"]'); pushBtn.focus();
      const back0 = s.querySelector('.ul-dialog-navbtn').hasAttribute('data-show');
      const P = await sampleRun(() => pushBtn.click()); const a = analyse(P);
      await wait(150);
      const nat = { w: s.offsetWidth, h: s.offsetHeight };
      const focusY = document.activeElement && document.activeElement.classList.contains('ul-dialog-title');
      ck('steps', 'push: ≥ 5 intermediate sizes', a.sizes >= 7, a.sizes + ' sizes');
      ck('final', 'push: final = measured natural size (±1px)', Math.abs(a.last.w - nat.w) <= 1 && Math.abs(a.last.h - nat.h) <= 1, `${Math.round(a.last.w)}×${Math.round(a.last.h)} vs ${nat.w}×${nat.h}`);
      ck('nav', 'nav bar fixed to the surface (±1px), close top-right every frame', a.navOk && a.closeOk, `nav ${a.navOk} · close ${a.closeOk}`);
      ck('one', 'at most one view above opacity .5 per frame', a.one, a.one ? 'ok' : 'overlap');
      ck('back', 'back arrow only when depth > 1', !back0 && P[P.length - 1].backOn && dlg().depth === 2, `depth ${dlg().depth} · back ${P[P.length - 1].backOn}`);
      ck('focus', 'focus moves to the new view (title)', !!focusY, document.activeElement && document.activeElement.className);
      const Q = await sampleRun(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); const b = analyse(Q);
      await wait(150);
      const inp2 = s.querySelector('input[aria-label="Name"]');
      ck('pop', 'Esc pops: depth 1, back hidden, dialog still open', dlg().depth === 1 && !Q[Q.length - 1].backOn && s.style.visibility !== 'hidden', `depth ${dlg().depth}`);
      ck('state', 'state of the first view restored on pop', inp2 && inp2.value === 'Edited name', inp2 && inp2.value);
      ck('refocus', 'focus returns to the control that pushed', document.activeElement === pushBtn, document.activeElement && (document.activeElement.getAttribute('data-mt') || document.activeElement.tagName));
      ck('popsteps', 'pop: continuous, ≥ 5 sizes, one view visible', b.sizes >= 7 && b.one, `${b.sizes} sizes · max ${b.maxV.toFixed(2)} px/ms`);
      // interruption: push, pop at 40 %, push again at 60 %
      const vClean = Math.max(a.maxV, b.maxV);
      const I = await sampleRun(() => { pushBtn.click(); setTimeout(() => dlg().pop(), 190); setTimeout(() => s.querySelector('[data-mt="push"]').click(), 290); }, 1100);
      const c = analyse(I);
      ck('interrupt', 'interrupt push / pop / push: no jump (px/ms ≤ clean × 1.3 + .15)', c.maxV <= vClean * 1.3 + 0.15 && c.one, `${c.maxV.toFixed(2)} px/ms (clean ${vClean.toFixed(2)}) · one view ${c.one}`);
      await wait(200); dlg().pop(); await wait(800);
      // reduced motion
      window.UL.configureMorph({ reducedMotion: 'reduce' });
      const R = await sampleRun(() => s.querySelector('[data-mt="push"]').click(), 400);
      const rd = analyse(R); window.UL.configureMorph({ reducedMotion: 'auto' });
      ck('reduced', 'reduced motion: size instant, crossfade only', rd.sizes <= 3, rd.sizes + ' sizes');
      dlg().pop(); await wait(500);
      // trigger exception: popover from a button inside the dialog is above it from frame one
      const ib = s.querySelector('[data-mt="inpop"]');
      const first = await new Promise((res) => { const on = (e) => { if (e.detail.phase !== 'enter' || e.detail.state !== 'start') return; document.removeEventListener('ul:morph', on, true); const br = ib.getBoundingClientRect(); const at = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2); res(!!at && e.detail.morph.surface.contains(at)); }; document.addEventListener('ul:morph', on, true); ib.click(); setTimeout(() => res(null), 1500); });
      ck('above', 'overlay from a button inside a dialog: surface above the button from frame one', first === true, String(first));
      await wait(700); ib.click(); await wait(500);
      M.set('stack1', false); await wait(700);
      return { status: checks.every((x) => x.pass !== false) ? 'pass' : 'fail', checks, driver: 'live rAF (document timeline)' };
    }
    // Toast placement: every toast rect inside the visual viewport (with the inset) on every frame while 5 toasts arrive.
    async function toastTest() {
      const M = window.__mt2c, raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const vv = window.visualViewport, inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ul-toast-inset')) || 16;
      let frames = 0, worst = 0, maxVis = 0;
      const t0 = performance.now(); let k = 0;
      const timer = setInterval(() => { if (k < 5) window.__mt2cToast && window.__mt2cToast(k++); }, 140);
      while (performance.now() - t0 < 1800) {
        await raf(); frames++;
        const top = vv ? vv.offsetTop : 0, bottom = vv ? vv.offsetTop + vv.height : innerHeight;
        const ss = [...document.querySelectorAll('.ul-toast-stack .ul-anchored')].filter((s) => s.style.visibility !== 'hidden');
        maxVis = Math.max(maxVis, ss.length);
        for (const s of ss) { const r = s.getBoundingClientRect(); if (r.height < 4) continue; worst = Math.max(worst, (top + inset - 1) - r.top, r.bottom - (bottom - inset + 1)); }
      }
      clearInterval(timer);
      window.__mt2cToastClear && window.__mt2cToastClear(); await wait(800);
      const allow = 2; // the morph's overshoot may reach 2px into the margin, never past the viewport edge
      const ok = worst <= allow;
      return { status: ok ? 'pass' : 'fail', driver: 'live rAF', checks: [
        { key: 'inside', label: `every toast inside the visual viewport − ${inset}px inset (overshoot ≤ 2px into it), every frame (${innerWidth}×${innerHeight})`, pass: ok, value: `${frames} frames · worst overflow ${Math.max(0, worst).toFixed(1)}px · max visible ${maxVis}` },
        { key: 'mobile', label: '375 × 667: run this page in a 375 × 667 window (not automated here)', pass: null, value: 'manual' },
      ] };
    }
    // Sidebar: rigid indicator (layout-follow) during collapse / expand, never clipped.
    async function sidebarTest() {
      const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = document.querySelector('[data-case="sidebar"]'); if (!box) return { status: 'fail', checks: [] };
      const b = box.getBoundingClientRect(); if (b.top < 60 || b.bottom > innerHeight - 20) { scrollBy(0, b.top - 120); await wait(120); }
      const nav = box.querySelector('.ul-side-nav'), lens = nav.querySelector('.ul-menu-lens'), item = () => nav.querySelector('[aria-current="page"]'), tog = box.querySelector('.ul-side-toggle');
      const run = async () => {
        let worstRect = 0, worstScale = 0, clip = 0, n = 0; tog.click(); const t0 = performance.now();
        while (performance.now() - t0 < 700) {
          await raf(); await new Promise((r) => setTimeout(r, 0)); n++; // sample the PAINTED frame (after every rAF callback of that frame)
          const L = lens.getBoundingClientRect(), I = item().getBoundingClientRect(), N = nav.getBoundingClientRect();
          worstRect = Math.max(worstRect, Math.abs(L.left - I.left), Math.abs(L.top - I.top), Math.abs(L.width - I.width), Math.abs(L.height - I.height));
          const m = new DOMMatrixReadOnly(getComputedStyle(lens).transform); worstScale = Math.max(worstScale, Math.abs(Math.hypot(m.a, m.b) - 1));
          clip = Math.max(clip, N.left - L.left, N.top - L.top, L.right - N.right, L.bottom - N.bottom);
        }
        return { worstRect, worstScale, clip, n };
      };
      const c1 = await run(); await wait(300); const c2 = await run(); await wait(300);
      // elastic again afterwards: hover another item → the lens travels on a spring (intermediate frames differ from both rects)
      const other = nav.querySelectorAll('.ul-side-item')[0]; other.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      let mids = 0; const t0 = performance.now(), I0 = item().getBoundingClientRect(), O = other.getBoundingClientRect();
      while (performance.now() - t0 < 300) { await raf(); const L = lens.getBoundingClientRect(); if (Math.abs(L.top - I0.top) > 1 && Math.abs(L.top - O.top) > 1) mids++; }
      nav.dispatchEvent(new PointerEvent('pointerleave')); await wait(300);
      const W = Math.max(c1.worstRect, c2.worstRect), S = Math.max(c1.worstScale, c2.worstScale), C = Math.max(c1.clip, c2.clip);
      const checks = [
        { key: 'rigid', label: 'collapse + expand: indicator rect = item rect (±1px), scale 1, every frame', pass: W <= 1 && S <= 0.005, value: `Δrect ${W.toFixed(2)}px · Δscale ${S.toFixed(3)} · ${c1.n}+${c2.n} frames` },
        { key: 'clip', label: 'indicator never clipped by the scroller', pass: C <= 0.5, value: `worst ${Math.max(0, C).toFixed(1)}px outside` },
        { key: 'elastic', label: 'elastic again afterwards (hover glides through intermediate positions)', pass: mids >= 3, value: mids + ' in-between frames' },
      ];
      return { status: checks.every((x) => x.pass !== false) ? 'pass' : 'fail', checks, driver: 'live rAF' };
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Containers, MotionFixtures, scroll2c, dialogTest, toastTest, sidebarTest });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
