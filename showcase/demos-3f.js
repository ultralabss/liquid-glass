// Task 3C demos: ULDemos.Feedback (alerts, alert dialog, confirm popover, toggle group, separator, kbd, item, collapsible, scroll area).
(function () {
  function define() {
    const React = window.React, h = React.createElement, UL = window.UL;
    const cap = { margin: 0, font: '12px/1.4 var(--ul-font-mono, ui-monospace, monospace)', letterSpacing: '.04em', color: 'var(--ul-color-text-2)' };
    const panel = { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, padding: 20, borderRadius: 20, background: 'var(--ul-color-graphite)', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .08)' };
    const Cell = ({ label, children, span, id }) => h('div', { 'data-demo': id, style: Object.assign({ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }, span ? { gridColumn: '1 / -1' } : null) }, h('p', { style: cap }, label), h('div', { style: panel }, children));
    const row = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, minWidth: 0 };
    const icon = (n) => h(UL.ULIcon, { name: n, size: 'md' });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    function DialogDemos({ locale }) {
      const b1 = React.useRef(null), b2 = React.useRef(null), b3 = React.useRef(null), b4 = React.useRef(null);
      const [o1, s1] = React.useState(false), [o2, s2] = React.useState(false), [o3, s3] = React.useState(false), [o4, s4] = React.useState(false), [log, setLog] = React.useState('');
      const Inner = () => { const confirm = UL.useAlertDialog(); return h(UL.ULButton, { variant: 'destructive', 'data-demo-push': '', onClick: async () => { const ok = await confirm({ title: 'Remove member?', description: 'They lose access to every project in this team.', tone: 'destructive', actionLabel: 'Remove', onAction: () => wait(500), locale }); setLog('push → ' + ok); } }, 'Remove member (push)'); };
      return h(React.Fragment, null,
        h('div', { style: row },
          h(UL.ULButton, { ref: b1, variant: 'destructive', 'data-demo-alertdlg': '', onClick: () => s1(true) }, 'Delete project'),
          h(UL.ULButton, { ref: b2, variant: 'secondary', onClick: () => s2(true) }, 'Type to confirm'),
          h(UL.ULButton, { ref: b3, variant: 'secondary', 'data-demo-confirmpop': '', onClick: () => s3((x) => !x) }, 'Quick confirm'),
          h(UL.ULButton, { ref: b4, variant: 'secondary', onClick: () => s4(true) }, 'Dialog → confirm')),
        log ? h('p', { style: cap }, log) : null,
        h(UL.ULAlertDialog, { open: o1, onOpenChange: s1, triggerRef: b1, tone: 'destructive', title: 'Delete project?', description: 'The project, its files and its history are removed. This cannot be undone.', actionLabel: 'Delete', onAction: () => wait(600), onCancel: () => setLog('cancelled'), locale }),
        h(UL.ULAlertDialog, { open: o2, onOpenChange: s2, triggerRef: b2, tone: 'destructive', title: 'Delete workspace?', description: 'Type the name to confirm.', actionLabel: 'Delete workspace', typeToConfirm: 'ultralabs', onAction: () => wait(600), locale }),
        h(UL.ULConfirmPopover, { open: o3, onOpenChange: s3, triggerRef: b3, title: 'Archive 3 items?', description: 'You can restore them from Archive.', actionLabel: 'Archive', tone: 'default', onAction: () => wait(400), locale }),
        h(UL.ULModal, { open: o4, onOpenChange: s4, triggerRef: b4, title: 'Team settings', description: 'Opening a confirmation here pushes a view on the same surface.' }, h(Inner)));
    }
    function ToggleDemos() {
      const [align, setAlign] = React.useState('left'), [fmt, setFmt] = React.useState(['bold']), [view, setView] = React.useState('list');
      return h(React.Fragment, null,
        h(UL.ULToggleGroup, { 'aria-label': 'View', items: [{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }, { value: 'calendar', label: 'Calendar' }], value: view, onValueChange: setView }),
        h(UL.ULToggleGroup, { 'aria-label': 'Alignment', size: 'sm', items: [{ value: 'left', icon: icon('menu'), tooltip: 'Align left' }, { value: 'grid', icon: icon('layout-grid'), tooltip: 'Grid' }, { value: 'cal', icon: icon('calendar'), tooltip: 'Calendar' }], value: align, onValueChange: setAlign }),
        h(UL.ULToggleGroup, { type: 'multiple', 'aria-label': 'Format', items: [{ value: 'bold', label: 'Bold' }, { value: 'star', icon: icon('star'), tooltip: 'Starred' }, { value: 'pin', icon: icon('pin'), tooltip: 'Pinned' }, { value: 'off', label: 'Disabled', disabled: true }], value: fmt, onValueChange: setFmt }),
        h('p', { style: cap }, `single: ${view} · ${align} · multiple: [${fmt.join(', ')}]`));
    }
    function ItemDemos() {
      const [sel, setSel] = React.useState(['a']);
      const tog = (id) => (s) => setSel((x) => (s ? [...x, id] : x.filter((y) => y !== id)));
      const menu = [{ id: 'open', label: 'Open' }, { id: 'rename', label: 'Rename' }, { id: 'del', label: 'Delete', danger: true }];
      const av = (t) => h('span', { style: { display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 999, background: 'rgb(255 255 255 / .1)', font: '600 12px/1 var(--ul-font-sans)', color: 'var(--ul-color-text)' } }, t);
      return h(UL.ULItemGroup, { label: 'Members' },
        h(UL.ULItem, { id: 'a', media: av('AL'), title: 'Ada Lovelace', description: 'ada@ultra-labs.eu · Owner', meta: 'now', selectable: true, selected: sel.includes('a'), onSelectedChange: tog('a'), contextMenu: menu }),
        h(UL.ULItem, { id: 'b', media: av('GH'), title: 'Grace Hopper with a very long display name that truncates', description: 'grace@ultra-labs.eu · Editor · invited 3 days ago from the billing workspace', meta: '2 h', selectable: true, selected: sel.includes('b'), onSelectedChange: tog('b'), contextMenu: menu }),
        h(UL.ULItem, { id: 'c', media: icon('mail'), title: 'Pending invite', description: 'Two-line description: the invite expires in 6 days. Resend it or revoke access from the actions menu.', descriptionLines: 2, variant: 'outline', onClick: () => {}, actions: h(UL.ULButton, { size: 'sm', variant: 'plain' }, 'Resend') }),
        h(UL.ULItem, { id: 'd', media: icon('lock'), title: 'Read-only row', description: 'Not interactive', variant: 'muted' }));
    }
    function ScrollDemos() {
      const pb = React.useRef(null), [po, setPo] = React.useState(false);
      const lines = Array.from({ length: 40 }, (_, i) => h('p', { key: i, style: { margin: 0, padding: '6px 4px', fontSize: 14, color: 'var(--ul-color-text-2)' } }, `Row ${i + 1} · audit event`));
      return h(React.Fragment, null,
        h('div', { style: { borderRadius: 14, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .08)' } }, h(UL.ULScrollArea, { maxHeight: 200, label: 'Audit log', className: 'demo-scroll-y' }, h('div', { style: { padding: '4px 10px' } }, lines))),
        h('div', { style: { borderRadius: 14, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .08)' } }, h(UL.ULScrollArea, { axis: 'x', label: 'Tags' }, h('div', { style: { display: 'flex', gap: 8, padding: 12 } }, Array.from({ length: 24 }, (_, i) => h('span', { key: i, style: { flex: 'none', padding: '6px 12px', borderRadius: 999, background: 'rgb(255 255 255 / .07)', fontSize: 13, whiteSpace: 'nowrap' } }, `tag-${i + 1}`))))),
        h(UL.ULButton, { ref: pb, variant: 'secondary', onClick: () => setPo((x) => !x) }, 'Scroll area in a popover'),
        h(UL.ULPopover, { open: po, onOpenChange: setPo, triggerRef: pb, title: 'Recent', label: 'Recent' }, h(UL.ULScrollArea, { maxHeight: 180, label: 'Recent items' }, lines.slice(0, 20))));
    }
    function Feedback() {
      const [locale, setLocale] = React.useState(new URLSearchParams(location.search).get('locale') || 'en');
      const pill = (on) => ({ minHeight: 32, padding: '0 12px', borderRadius: 999, border: 0, cursor: 'pointer', font: '500 13px/1 var(--ul-font-sans)', color: 'var(--ul-color-text)', background: on ? 'rgb(255 255 255 / .2)' : 'rgb(255 255 255 / .06)' });
      return h(UL.ULDialogProvider, null, h('div', { style: { display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 } },
        h('div', { style: row }, h('span', { style: cap }, 'locale'), ['en', 'sk', 'de', 'cs'].map((l) => h('button', { key: l, type: 'button', 'aria-pressed': locale === l, style: pill(locale === l), onClick: () => setLocale(l) }, l.toUpperCase()))),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: 20, minWidth: 0 } },
          h(Cell, { label: 'ULAlert · 5 tones · status / alert roles · action · dismissible', id: 'alert', span: true },
            h(UL.ULAlert, { tone: 'info', title: 'Maintenance on Sunday', description: 'Studio is read-only from 02:00 to 03:00 CET.', locale }),
            h(UL.ULAlert, { tone: 'success', title: 'Domain verified', description: 'studio.ultralabs.app now serves your site.', dismissible: true, locale }),
            h(UL.ULAlert, { tone: 'warning', title: 'Card expires soon', description: 'Update the payment method before 30 November to avoid interruption.', action: h(UL.ULButton, { size: 'sm', variant: 'secondary' }, 'Update'), dismissible: true, locale }),
            h(UL.ULAlert, { tone: 'danger', title: 'Deploy failed', description: 'Build step "bundle" exited with code 1.', action: h(UL.ULButton, { size: 'sm', variant: 'secondary' }, 'View log'), locale }),
            h(UL.ULAlert, { tone: 'neutral', description: 'Neutral note without a title: changes apply to new projects only.', locale })),
          h(Cell, { label: 'ULAlertDialog · ULConfirmPopover · push inside a dialog', id: 'alertdlg' }, h(DialogDemos, { locale })),
          h(Cell, { label: 'ULToggleGroup · single (lens) · icon-only + tooltips · multiple', id: 'tgroup' }, h(ToggleDemos)),
          h(Cell, { label: 'ULSeparator · ULKbd', id: 'sepkbd' },
            h('p', { style: { margin: 0, fontSize: 14, color: 'var(--ul-color-text-2)' } }, 'Above'), h(UL.ULSeparator, null), h(UL.ULSeparator, { label: 'or continue with', decorative: false }),
            h('div', { style: Object.assign({}, row, { height: 28 }) }, h('span', null, 'Edit'), h(UL.ULSeparator, { orientation: 'vertical' }), h('span', null, 'View'), h(UL.ULSeparator, { orientation: 'vertical' }), h('span', null, 'Help')),
            h('div', { style: row }, h(UL.ULKbd, { keys: 'Mod+K', locale }), h(UL.ULKbd, { keys: 'Mod+Shift+P', locale }), h(UL.ULKbd, { keys: 'Alt+Enter', locale }), h(UL.ULKbd, { keys: ['G', 'D'], locale }), h(UL.ULKbd, { keys: 'Esc', size: 'sm', locale }), h(UL.ULKbd, { keys: 'Mod+K', platform: 'other', locale: 'de' }), h(UL.ULKbd, { keys: 'Mod+K', platform: 'mac' }))),
          h(Cell, { label: 'ULItem · selectable (ULCheckMark) · contextMenu (right-click) · truncation · actions', id: 'item' }, h(ItemDemos)),
          h(Cell, { label: 'ULCollapsible · measured height morph', id: 'coll' },
            h(UL.ULCollapsible, { title: 'Advanced settings', trailing: '3', defaultOpen: false }, h('p', { style: { margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--ul-color-text-2)' } }, 'Webhooks, custom headers and the build cache live here. Changes apply to the next deploy.'), h(UL.ULTextField, { label: 'Build command', defaultValue: 'npm run build' })),
            h(UL.ULCollapsible, { title: 'Release notes', defaultOpen: true }, h('ul', { style: { margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6, color: 'var(--ul-color-text-2)' } }, h('li', null, 'Forms and input groups'), h('li', null, 'Alerts and confirm dialogs'), h('li', null, 'Scroll areas')))),
          h(Cell, { label: 'ULScrollArea · vertical · horizontal · in a popover', id: 'scroll' }, h(ScrollDemos)))));
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Feedback });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
