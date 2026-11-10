// Task 3D item 8: RTL audit sample (ULDemos.Rtl). Renders ten components inside dir="rtl" (and the same set in LTR with ?ltr) for screenshots.
(function () {
  function define() {
    const React = window.React, h = React.createElement, UL = window.UL;
    const cap = { margin: 0, font: '12px/1.4 var(--ul-font-mono, ui-monospace, monospace)', color: 'var(--ul-color-text-2)', direction: 'ltr', textAlign: 'left' };
    const panel = { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, padding: 16, borderRadius: 18, background: 'var(--ul-color-graphite)', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .08)' };
    const Cell = ({ id, label, children }) => h('div', { 'data-rtl': id, style: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 } }, h('p', { style: cap }, label), h('div', { style: panel }, children));
    const rows = [{ id: 1, name: 'Studio', owner: 'Jana', amount: 1240 }, { id: 2, name: 'Identify', owner: 'Tomáš', amount: 860 }, { id: 3, name: 'Glass', owner: 'Filip', amount: 2310 }];
    const data = Array.from({ length: 12 }, (_, i) => ({ m: i, a: 20 + Math.round(10 * Math.sin(i / 2) + i * 2), b: 14 + i }));
    function Toasty() { const t = UL.useToast(); return h(UL.ULButton, { 'data-rtl-toast': '', onClick: () => t.toast({ title: 'Saved', description: 'Changes are live.', tone: 'success' }) }, 'Show toast'); }
    function Rtl() {
      const dir = new URLSearchParams(location.search).has('ltr') ? 'ltr' : 'rtl';
      const [dlg, setDlg] = React.useState(false), b = React.useRef(null);
      return h('div', { dir, lang: dir === 'rtl' ? 'ar' : 'en', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 16, minWidth: 0 } },
        h(UL.ULToastProvider, { position: 'bottom-right' },
          h(Cell, { id: 'button', label: '1 button (icon + label)' }, h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } }, h(UL.ULButton, { variant: 'primary', icon: h(UL.ULIcon, { name: 'plus', size: 'sm' }) }, 'New project'), h(UL.ULButton, { iconEnd: h(UL.ULIcon, { name: 'chevron-right', size: 'sm' }) }, 'Next'))),
          h(Cell, { id: 'field', label: '2 text field (floating label, helper)' }, h(UL.ULTextField, { label: 'Email', helper: 'We send the link here.', defaultValue: 'jana@ultra-labs.eu' })),
          h(Cell, { id: 'group', label: '3 input group (prefix / suffix)' }, h(UL.ULInputGroup, { prefix: 'https://', suffix: '.ultralabs.app' }, h(UL.ULTextField, { label: 'Website', floating: false, defaultValue: 'studio' }))),
          h(Cell, { id: 'select', label: '4 select (chevron, list)' }, h(UL.ULSelect, { label: 'Plan', options: [{ value: 'a', label: 'Free' }, { value: 'b', label: 'Pro' }], defaultValue: 'b', fullWidth: true })),
          h(Cell, { id: 'menu', label: '5 menu (submenu side, shortcut)' }, h(UL.ULMenuButton, { label: 'Actions', items: [{ id: 'dup', label: 'Duplicate', shortcut: 'Mod+D' }, { id: 'move', label: 'Move to', items: [{ id: 'a', label: 'Archive' }] }, { type: 'separator' }, { id: 'del', label: 'Delete', destructive: true }], buttonProps: { 'data-rtl-menu': '' } }, 'Actions')),
          h(Cell, { id: 'tabs', label: '6 tabs (lens, order)' }, h(UL.ULTabs, { label: 'View', items: [{ value: 'o', label: 'Overview' }, { value: 'a', label: 'Activity' }, { value: 's', label: 'Settings' }], defaultValue: 'o' })),
          h(Cell, { id: 'table', label: '7 table (numeric column, sort)' }, h(UL.ULTable, { label: 'Projects', rowKey: (r) => r.id, rows, columns: [{ key: 'name', header: 'Name', sortable: true }, { key: 'owner', header: 'Owner' }, { key: 'amount', header: 'Amount', numeric: true }] })),
          h(Cell, { id: 'toast', label: '8 toast (stack corner, swipe)' }, h(Toasty)),
          h(Cell, { id: 'dialog', label: '9 dialog (close button, footer)' }, h(UL.ULButton, { ref: b, 'data-rtl-dialog': '', onClick: () => setDlg(true) }, 'Open dialog'),
            h(UL.ULModal, { open: dlg, onOpenChange: setDlg, triggerRef: b, title: 'Rename project', description: 'The URL stays the same.', footer: h(UL.ULButton, { variant: 'primary', onClick: () => setDlg(false) }, 'Save') }, h(UL.ULTextField, { label: 'Name', defaultValue: 'Studio' }))),
          h(Cell, { id: 'chart', label: '10 chart (axes, legend, tooltip side)' }, h(UL.ULLineChart, { title: 'Revenue', data, x: (d) => d.m, series: [{ key: 'a', name: 'Web', value: (d) => d.a }, { key: 'b', name: 'App', value: (d) => d.b }], height: 200 }))));
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Rtl });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
