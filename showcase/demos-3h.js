// Task 3D demos: ULDemos.Batch2 (hover card, menubar, navigation menu, native select, calendar, aspect ratio, resizable, carousel, typography).
(function () {
  function define() {
    const React = window.React, h = React.createElement, UL = window.UL;
    const cap = { margin: 0, font: '12px/1.4 var(--ul-font-mono, ui-monospace, monospace)', letterSpacing: '.04em', color: 'var(--ul-color-text-2)' };
    const panel = { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, padding: 20, borderRadius: 20, background: 'var(--ul-color-graphite)', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .08)' };
    const Cell = ({ label, children, span, id }) => h('div', { 'data-demo': id, style: Object.assign({ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }, span ? { gridColumn: '1 / -1' } : null) }, h('p', { style: cap }, label), h('div', { style: panel }, children));
    const row = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, minWidth: 0 };
    const pill = (on) => ({ font: '12px/1 system-ui', padding: '6px 10px', borderRadius: 999, border: 0, cursor: 'pointer', background: on ? 'var(--ul-accent)' : 'rgb(255 255 255 / .08)', color: on ? 'var(--ul-color-ink, #0b0d12)' : 'var(--ul-color-text)' });
    const link = { color: 'var(--ul-color-text)', textDecoration: 'underline', textUnderlineOffset: 3, fontWeight: 600, borderRadius: 6, padding: '2px 0' };

    function Person({ name, role, team, joined }) {
      return h(React.Fragment, null,
        h('div', { className: 'ul-hc-head' }, h(UL.ULAvatar, { name, size: 'lg' }), h('div', { className: 'ul-hc-titles' }, h('p', { className: 'ul-hc-title' }, name), h('p', { className: 'ul-hc-sub' }, role))),
        h(UL.ULKeyValue, { items: [{ label: 'Team', value: team }, { label: 'Joined', value: joined }] }),
        h('div', { className: 'ul-hc-actions' }, h(UL.ULButton, { size: 'sm', variant: 'secondary' }, 'Message'), h(UL.ULButton, { size: 'sm', variant: 'plain' }, 'View profile')));
    }
    function HoverDemos() {
      const [log, setLog] = React.useState('');
      return h(React.Fragment, null,
        h('p', { style: { margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--ul-color-text-2)' } },
          'Reviewed by ',
          h(UL.ULHoverCard, { label: 'Jana Nováková', content: h(Person, { name: 'Jana Nováková', role: 'Design lead', team: 'Studio', joined: 'March 2024' }), contextMenu: [{ id: 'copy', label: 'Copy name' }], onContextMenuAction: () => setLog('context: copy name') },
            h('a', { href: '#jana', style: link, 'data-demo-hc': 'a', onClick: (e) => e.preventDefault() }, 'Jana Nováková')),
          ' and ',
          h(UL.ULHoverCard, { label: 'Tomáš Král', side: 'top', content: h(Person, { name: 'Tomáš Král', role: 'Frontend', team: 'Platform', joined: 'May 2025' }) },
            h('a', { href: '#tomas', style: link, 'data-demo-hc': 'b', onClick: (e) => e.preventDefault() }, 'Tomáš Král')),
          '.'),
        h('div', { style: row },
          h(UL.ULHoverCard, { label: 'Build status', arrow: true, content: h(React.Fragment, null, h('p', { className: 'ul-hc-title' }, 'Build #482'), h(UL.ULKeyValue, { items: [{ label: 'Branch', value: 'main' }, { label: 'Duration', value: '1 min 12 s' }, { label: 'Status', value: 'Passed' }] })) },
            h(UL.ULButton, { size: 'sm', variant: 'secondary', 'data-demo-hc': 'c' }, 'Build #482'))),
        log ? h('p', { style: cap }, log) : null,
        h('p', { style: cap }, 'Hover 500 ms · leave 250 ms · Tab focus opens · Esc closes · touch: tap / tap again'));
    }

    function MenubarDemo() {
      const [view, setView] = React.useState({ grid: true, rulers: false, zoom: '100' }), [log, setLog] = React.useState('');
      const menus = [
        { id: 'file', label: 'File', items: [{ id: 'new', label: 'New project', shortcut: 'Mod+N' }, { id: 'open', label: 'Open…', shortcut: 'Mod+O' }, { id: 'recent', label: 'Open recent', items: [{ id: 'r1', label: 'Landing 2026' }, { id: 'r2', label: 'Studio dashboard' }, { id: 'more', label: 'More', items: [{ id: 'r3', label: 'Archive' }] }] }, { type: 'separator' }, { id: 'export', label: 'Export', shortcut: 'Mod+Shift+E' }, { id: 'close', label: 'Close', shortcut: 'Mod+W', destructive: true }] },
        { id: 'edit', label: 'Edit', items: [{ id: 'undo', label: 'Undo', shortcut: 'Mod+Z' }, { id: 'redo', label: 'Redo', shortcut: 'Mod+Shift+Z' }, { type: 'separator' }, { id: 'cut', label: 'Cut', shortcut: 'Mod+X' }, { id: 'copy', label: 'Copy', shortcut: 'Mod+C' }, { id: 'paste', label: 'Paste', shortcut: 'Mod+V', disabled: true }] },
        { id: 'view', label: 'View', items: [{ id: 'grid', type: 'checkbox', label: 'Show grid', checked: view.grid, onSelect: () => setView((v) => Object.assign({}, v, { grid: !v.grid })) }, { id: 'rulers', type: 'checkbox', label: 'Show rulers', checked: view.rulers, onSelect: () => setView((v) => Object.assign({}, v, { rulers: !v.rulers })) }, { type: 'separator' }, { type: 'label', label: 'Zoom' }].concat(['50', '100', '200'].map((z) => ({ id: 'z' + z, type: 'radio', label: z + ' %', checked: view.zoom === z, onSelect: () => setView((v) => Object.assign({}, v, { zoom: z })) }))) },
        { id: 'help', label: 'Help', items: [{ id: 'docs', label: 'Documentation' }, { id: 'keys', label: 'Keyboard shortcuts', shortcut: 'Mod+/' }] },
      ];
      return h(React.Fragment, null, h(UL.ULMenubar, { menus, label: 'Editor', onAction: (m, i) => setLog(m + ' → ' + i) }), h('p', { style: cap }, log || '← → move · Enter / ↓ open · hover switches while open · Esc returns'));
    }
    const NAV = [
      { id: 'products', label: 'Products', panel: { links: [
        { id: 'studio', title: 'Studio', description: 'Design, preview and publish sites in one place.', href: '#studio', icon: 'layout-grid' },
        { id: 'identify', title: 'Identify', description: 'Sign-in, sessions and teams for your apps.', href: '#identify', icon: 'check' },
        { id: 'glass', title: 'Glass', description: 'The component library behind every UltraLabs app.', href: '#glass', icon: 'plus' },
        { id: 'charts', title: 'Charts', description: 'Eighteen chart types on one shared core.', href: '#charts', icon: 'calendar' }] } },
      { id: 'solutions', label: 'Solutions', panel: { minColumn: 240, links: [
        { id: 'agency', title: 'Agencies', description: 'Client sites with shared components.', href: '#agency' },
        { id: 'saas', title: 'SaaS dashboards', description: 'Live tables, KPIs and charts.', href: '#saas' },
        { id: 'shop', title: 'Shops', description: 'Fast product pages.', href: '#shop' }] } },
      { id: 'pricing', label: 'Pricing', href: '#pricing', current: true },
      { id: 'docs', label: 'Docs', href: '#docs' },
    ];
    function NavDemo({ locale }) {
      const [log, setLog] = React.useState('');
      const nav = (e, l) => { e.preventDefault(); setLog('navigate → ' + l.href); };
      return h(React.Fragment, null,
        h(UL.ULNavigationMenu, { items: NAV, label: 'Site', onNavigate: nav, locale }),
        h('p', { style: cap }, 'Phone layout (forced with collapseBelow):'),
        h(UL.ULNavigationMenu, { items: NAV, label: 'Site (phone)', onNavigate: nav, locale, collapseBelow: 100000 }),
        h('p', { style: cap }, log || '← → items · ↓ opens a panel · Esc closes · Tab through links · < 640px: sheet + drill-in'));
    }
    function FieldDemos({ locale }) {
      const [v, setV] = React.useState('');
      const plans = [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'team', label: 'Team' }, { value: 'ent', label: 'Enterprise', disabled: true }];
      const groups = [{ label: 'Europe', options: [{ value: 'sk', label: 'Slovakia' }, { value: 'cz', label: 'Czechia' }, { value: 'de', label: 'Germany' }] }, { label: 'Americas', options: [{ value: 'us', label: 'United States' }, { value: 'br', label: 'Brazil' }] }];
      return h(React.Fragment, null,
        h(UL.ULNativeSelect, { label: 'Plan', options: plans, value: v, onValueChange: setV, placeholder: 'Choose a plan', helper: 'Native picker on every device.', fullWidth: true }),
        h(UL.ULNativeSelect, { label: 'Country', groups, defaultValue: 'sk', fullWidth: true }),
        h(UL.ULNativeSelect, { label: 'Region (invalid)', options: plans, placeholder: 'Choose', error: 'Pick a region to continue.', fullWidth: true }),
        h(UL.ULNativeSelect, { label: 'Disabled', options: plans, defaultValue: 'pro', disabled: true, fullWidth: true }),
        h(UL.ULSelect, { label: 'ULSelect native="mobile" (glass list on fine pointers)', options: plans, native: 'mobile', defaultValue: 'pro', fullWidth: true }));
    }
    function CalendarDemos({ locale }) {
      const [mode, setMode] = React.useState('single'), [out, setOut] = React.useState('');
      const today = new Date(); const min = new Date(today.getFullYear(), today.getMonth() - 2, 1), max = new Date(today.getFullYear(), today.getMonth() + 6, 0);
      const fmt = (x) => !x ? '—' : Array.isArray(x) ? x.map((d) => d.toLocaleDateString(locale)).join(', ') || '—' : x.start ? x.start.toLocaleDateString(locale) + ' → ' + x.end.toLocaleDateString(locale) : x.toLocaleDateString(locale);
      return h(React.Fragment, null,
        h('div', { style: row }, ['single', 'multiple', 'range'].map((m) => h('button', { key: m, type: 'button', 'aria-pressed': mode === m, style: pill(mode === m), onClick: () => { setMode(m); setOut(''); } }, m))),
        h(UL.ULCalendar, { key: mode + locale, mode, locale, min, max, isDateDisabled: (d) => d.getDay() === 0, onValueChange: (x) => setOut(fmt(x)), label: 'Calendar ' + mode }),
        h('p', { style: cap }, out || 'Sundays disabled · min / max ±months · month and year jump'));
    }
    function RatioDemos() {
      const stripe = { position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, rgb(255 255 255 / .06) 0 10px, rgb(255 255 255 / .02) 10px 20px)', display: 'grid', placeItems: 'center', font: '12px var(--ul-font-mono, monospace)', color: 'var(--ul-color-text-2)' };
      return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))', gap: 12 } },
        h(UL.ULAspectRatio, { ratio: 16 / 9 }, h('div', { style: stripe }, '16 / 9 media')),
        h(UL.ULAspectRatio, { ratio: 1 }, h('div', { style: stripe }, '1 / 1')),
        h(UL.ULAspectRatio, { ratio: 4 / 3, skeleton: true }));
    }
    function ResizeDemo() {
      const [layout, setLayout] = React.useState('');
      const pane = (t, d) => h('div', { style: { padding: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, lineHeight: 1.5, color: 'var(--ul-color-text-2)' } }, h('strong', { style: { color: 'var(--ul-color-text)' } }, t), d);
      return h(React.Fragment, null,
        h('div', { style: { blockSize: 280, borderRadius: 16, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .1)', background: 'rgb(255 255 255 / .03)' } },
          h(UL.ULResizablePanelGroup, { direction: 'horizontal', storageKey: 'demo-3d', onLayout: (s) => setLayout(s.join(' / ')), stackBelow: 420 },
            h(UL.ULResizablePanel, { defaultSize: 24, minSize: 14, maxSize: 40, collapsible: true, label: 'Sidebar' }, pane('Sidebar', 'Collapsible: Enter on the handle, or drag below half its minimum.')),
            h(UL.ULResizableHandle, null),
            h(UL.ULResizablePanel, { minSize: 30, label: 'Editor' },
              h(UL.ULResizablePanelGroup, { direction: 'vertical' },
                h(UL.ULResizablePanel, { defaultSize: 65, minSize: 20, label: 'Canvas' }, pane('Canvas', 'A nested vertical group. Long words wrap: Donaudampfschifffahrtsgesellschaftskapitän.')),
                h(UL.ULResizableHandle, null),
                h(UL.ULResizablePanel, { minSize: 15, collapsible: true, label: 'Console' }, pane('Console', 'Shift+arrows move 10 %, Home / End jump to the limits.')))),
            h(UL.ULResizableHandle, { withGrip: false }),
            h(UL.ULResizablePanel, { defaultSize: 22, minSize: 15, label: 'Inspector' }, pane('Inspector', 'Double-click a handle to reset.')))),
        h('p', { style: cap }, layout ? 'onLayout: ' + layout : 'drag · arrows 1 % · Shift 10 % · Enter collapse · double-click reset · stored per viewer'));
    }
    function CarouselDemo({ locale }) {
      const kpis = [['Revenue', 22840, 7.8], ['Active users', 1832, 3.1], ['Churn', 2.4, -0.6], ['Orders', 641, 12.4], ['Refunds', 18, -2.0]];
      const tile = (t, i) => h('div', { key: i, style: { blockSize: 120, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'repeating-linear-gradient(135deg, rgb(255 255 255 / .06) 0 10px, rgb(255 255 255 / .02) 10px 20px)', font: '12px var(--ul-font-mono, monospace)', color: 'var(--ul-color-text-2)' } }, t);
      return h(React.Fragment, null,
        h(UL.ULCarousel, { label: 'KPIs', visible: 2, locale }, kpis.map(([l, v, d], i) => h(UL.ULKpiCard, { key: i, label: l, value: v, delta: d }))),
        h(UL.ULCarousel, { label: 'Screens', loop: true, autoplay: 4000, locale }, ['screen 1', 'screen 2', 'screen 3', 'screen 4'].map(tile)),
        h('p', { style: cap }, 'Mouse drag snaps · touch is native · ← → Home End · autoplay off by default (second: 4 s, pauses on hover / focus)'));
    }
    function TypeDemo({ locale }) {
      return h(React.Fragment, null,
        h(UL.ULHeading, { level: 2, size: 'display' }, 'Display, an h2'),
        h(UL.ULHeading, { level: 3, size: 'h2' }, 'Section heading (h3 at h2 size)'),
        h(UL.ULText, { variant: 'lead' }, 'Lead text introduces a section and wraps without orphans.'),
        h(UL.ULText, null, 'Body copy with ', h(UL.ULCode, null, 'inline code'), ', an ', h(UL.ULLink, { href: '#docs' }, 'internal link'), ' and an ', h(UL.ULLink, { href: 'https://example.org/guide', locale }, 'external link'), '.'),
        h(UL.ULText, { variant: 'small', tabular: true }, 'Small · tabular 1 234 567,89 €'),
        h(UL.ULText, { variant: 'caption' }, 'Caption under a chart'),
        h(UL.ULText, { variant: 'muted', truncate: true }, 'Muted and truncated: a long line that ends with an ellipsis when the column is too narrow for it.'),
        h(UL.ULBlockquote, { source: 'UltraLabs' }, 'One glass layer per surface; nothing inside samples glass.'),
        h(UL.ULList, { items: ['Fluid scale with clamp()', 'Level and size are independent', 'overflow-wrap: anywhere'] }),
        h(UL.ULProse, { size: 'sm' }, h('h3', null, 'Prose'), h('p', null, 'Rich content: Donaudampfschifffahrtsgesellschaftskapitänswitwenrentenversicherung wraps. ', h('a', { href: '#x' }, 'A link'), ' and ', h('code', null, 'code'), '.'), h('ol', null, h('li', null, 'First'), h('li', null, 'Second'))));
    }
    function Batch2() {
      const [locale, setLocale] = React.useState('en');
      return h(UL.ULDialogProvider, null, h('div', { style: { display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 } },
        h('div', { style: row }, h('span', { style: cap }, 'locale'), ['en', 'sk', 'de', 'cs'].map((l) => h('button', { key: l, type: 'button', 'aria-pressed': locale === l, style: pill(locale === l), onClick: () => setLocale(l) }, l.toUpperCase()))),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: 20, minWidth: 0 } },
          h(Cell, { label: 'ULHoverCard · hover intent · bridge · focus · Esc · one per group · contextMenu', id: 'hovercard' }, h(HoverDemos, { locale })),
          h(Cell, { label: 'ULNavigationMenu · panels morph on one surface · indicator · aria-current · sheet < 640px', id: 'navmenu', span: true }, h(NavDemo, { locale })),
          h(Cell, { label: 'ULNativeSelect · optgroups · disabled · invalid · ULSelect native', id: 'nativeselect' }, h(FieldDemos, { locale })),
          h(Cell, { label: 'ULCalendar · single / multiple / range · jump · min / max · disabled', id: 'calendar' }, h(CalendarDemos, { locale })),
          h(Cell, { label: 'ULAspectRatio · media · skeleton', id: 'aspect' }, h(RatioDemos)),
          h(Cell, { label: 'ULResizable · nested · collapsible · keyboard · storage · stacks < 420px', id: 'resizable', span: true }, h(ResizeDemo)),
          h(Cell, { label: 'ULCarousel · scroll-snap · shared indicator · KPI cards · loop + autoplay', id: 'carousel' }, h(CarouselDemo, { locale })),
          h(Cell, { label: 'Typography · ULHeading · ULText · ULCode · ULBlockquote · ULList · ULLink · ULProse', id: 'typography' }, h(TypeDemo, { locale })),
          h(Cell, { label: 'ULMenubar · roving · switch on hover / arrows · submenu · ULCheckMark · ULKbd', id: 'menubar' }, h(MenubarDemo)))));
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Batch2 });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
