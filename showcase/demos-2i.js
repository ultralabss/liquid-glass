// Showcase: async action components (Part 4). Composes window.UL only. A force-state control, a latency slider and a
// "make it fail" switch let every state be reviewed without a backend.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement, { useState, useRef } = React;
    const H3 = (t) => h('h3', { style: { alignSelf: 'flex-start', margin: '8px 0 0', padding: '4px 10px', borderRadius: '10px', background: 'rgb(11 13 18 / .82)', fontSize: '17px', fontWeight: 600 } }, t);
    const row = (kids) => h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' } }, ...kids);
    const mono = { fontFamily: 'var(--ul-font-mono)', fontSize: '12px', color: 'var(--ul-color-text-2)' };
    const pill = (on) => ({ minHeight: '32px', padding: '0 12px', borderRadius: '999px', border: '1px solid ' + (on ? 'rgb(255 255 255 / .55)' : 'rgb(255 255 255 / .16)'), background: on ? 'rgb(255 255 255 / .14)' : 'transparent', color: 'var(--ul-color-text)', font: 'inherit', fontSize: '13px', cursor: 'pointer' });
    function Actions() {
      const [force, setForce] = useState('auto'), [lat, setLat] = useState(900), [fail, setFail] = useState(false), [loc, setLoc] = useState('en');
      const [dirty, setDirty] = useState(true), [saveSt, setSaveSt] = useState('dirty'), [savedAt, setSavedAt] = useState(null), [fav, setFav] = useState(false), [undo, setUndo] = useState(false);
      const undoRef = useRef(null), last = useRef(''), [log, setLog] = useState('');
      const work = (what) => () => new Promise((res, rej) => setTimeout(() => (fail ? rej(new Error('demo failure')) : res(what)), lat));
      const fs = force === 'auto' ? undefined : force;
      const note = (t) => setLog(t);
      const ctl = h('div', { role: 'group', 'aria-label': 'Review controls', style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' } },
        h('span', { style: mono }, 'FORCE STATE'), ...['auto', 'idle', 'loading', 'success', 'error'].map((s) => h('button', { key: s, type: 'button', 'aria-pressed': force === s, style: pill(force === s), onClick: () => setForce(s) }, s)),
        h('label', { style: Object.assign({ display: 'flex', alignItems: 'center', gap: '8px' }, mono) }, 'latency', h('input', { type: 'range', min: 0, max: 3000, step: 50, value: lat, onChange: (e) => setLat(+e.target.value), style: { width: '140px', accentColor: 'var(--ul-accent)' } }), lat + 'ms'),
        h('button', { type: 'button', 'aria-pressed': fail, style: pill(fail), onClick: () => setFail(!fail) }, 'make it fail'),
        h('span', { style: mono }, 'LOCALE'), ...['en', 'sk', 'de', 'cs'].map((l) => h('button', { key: l, type: 'button', 'aria-pressed': loc === l, style: pill(loc === l), onClick: () => setLoc(l) }, l.toUpperCase())));
      const P = { forceStatus: fs, locale: loc };
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '22px' } },
        ctl,
        h('p', { style: Object.assign({ margin: 0, minHeight: '18px' }, mono) }, log || 'Every action runs against a fake backend (latency + failure above). Announcements go to one polite live region.'),
        H3('ULActionButton · variants × sizes'),
        row(['primary', 'secondary', 'tinted', 'plain', 'destructive'].map((v) => h(UL.ULActionButton, { ...P, key: v, variant: v, onAction: work(v), icons: { idle: h(UL.ULIcon, { name: 'send' }) }, labels: { idle: 'Publish', loading: 'Publishing…', success: 'Published' }, onSuccess: () => note('published (' + v + ')') }))),
        row(['sm', 'md', 'lg'].map((s) => h(UL.ULActionButton, { ...P, key: s, size: s, variant: 'secondary', onAction: work(s), labels: { idle: 'Run ' + s }, widthMode: s === 'lg' ? 'reserve' : 'morph' }))),
        H3('ULCopyButton · icon · button · inline · sensitive'),
        row([
          h(UL.ULCopyButton, { ...P, key: 'i', variant: 'icon', value: 'INV-2026-0042', writer: fail ? () => Promise.reject(new Error('denied')) : undefined }),
          h(UL.ULCopyButton, { ...P, key: 'b', value: () => 'https://ultra-labs.eu/work/client-portal', onCopy: () => note('copied a link (value is never logged)'), writer: fail ? () => Promise.reject(new Error('denied')) : undefined }),
          h('code', { key: 'c', style: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 4px 4px 12px', borderRadius: '10px', background: 'rgb(0 0 0 / .35)', fontFamily: 'var(--ul-font-mono)', fontSize: '13px' } }, 'npm i @ultralabs/glass', h(UL.ULCopyButton, { ...P, variant: 'inline', value: 'npm i @ultralabs/glass' })),
          h(UL.ULCopyButton, { ...P, key: 's', variant: 'icon', label: 'Copy API key', sensitive: true, value: 'sk_live_demo_not_a_real_key' }),
        ]),
        H3('ULSaveButton + ULSaveStatus · shortcut ⌘/Ctrl+S · unsaved guard'),
        h(SaveDemo, { P, work, fail, lat }),
        H3('ULSubmitButton · form-associated'),
        h('form', { onSubmit: (e) => e.preventDefault(), style: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' } },
          h(UL.ULTextField, { label: 'E-mail', type: 'email', name: 'email', required: true, defaultValue: 'jana@novak.sk' }),
          h(UL.ULSubmitButton, { ...P, onSubmit: (d) => work('sent')().then(() => note('submitted ' + (d ? [...d.keys()].join(', ') : ''))) })),
        H3('ULConfirmAction · inline countdown · hold · type to confirm'),
        row([
          h(UL.ULConfirmAction, { ...P, key: 'i', confirm: 'inline', label: 'Delete draft', onConfirm: work('deleted'), onSuccess: () => note('draft deleted') }),
          h(UL.ULConfirmAction, { ...P, key: 'h', confirm: 'hold', label: 'Hold to delete', onConfirm: work('deleted'), onSuccess: () => note('deleted by hold') }),
          h(UL.ULConfirmAction, { ...P, key: 't', confirm: 'type', label: 'Delete project', typeText: 'client-portal', description: 'This removes the project and its 37 invoices.', onConfirm: work('deleted') }),
        ]),
        H3('ULDownloadButton / ULExportButton · progress · format menu'),
        row([
          h(UL.ULDownloadButton, { ...P, key: 'd', filename: 'invoices.csv', onExport: ({ report }) => new Promise((res, rej) => { let p = 0; const t = setInterval(() => { p += 0.1; report(Math.min(1, p)); if (p >= 1) { clearInterval(t); fail ? rej(new Error('x')) : res('id,amount\nINV-1,400\n'); } }, Math.max(30, lat / 10)); }) }),
          h(UL.ULExportButton, { ...P, key: 'e', formats: [{ id: 'csv', label: 'CSV' }, { id: 'json', label: 'JSON' }, { id: 'pdf', label: 'PDF' }], filename: (f) => 'report.' + f, onExport: ({ format }) => work('x')().then(() => (format === 'json' ? '{"ok":true}' : 'a,b\n1,2\n')) }),
        ]),
        H3('ULRefreshButton · updated time · auto refresh (pauses when the tab is hidden)'),
        row([h(UL.ULRefreshButton, { ...P, key: 'r', onRefresh: work('r') }), h(UL.ULRefreshButton, { ...P, key: 'a', autoRefresh: 8000, onRefresh: work('r') })]),
        H3('ULToggleIconButton · optimistic with rollback'),
        row(['star', 'favorite', 'pin', 'bookmark', 'mute'].map((k) => h(UL.ULToggleIconButton, { ...P, key: k, kind: k, label: k[0].toUpperCase() + k.slice(1), onPressedChange: (v) => work(v)() }))),
        H3('Spam test · coalesced toggles (onChange runs once with the final value)'),
        h(SpamPanel, { P }),
        H3('Hold to delete · the fill sweeps the whole button'),
        row([h(UL.ULConfirmAction, { ...P, key: 'h1', confirm: 'hold', label: 'Hold to delete', onConfirm: work('del') }), h(UL.ULConfirmAction, { ...P, key: 'h2', confirm: 'hold', size: 'lg', label: 'Hold to delete project', onConfirm: work('del') }), h(UL.ULConfirmAction, { ...P, key: 'h3', confirm: 'hold', variant: 'secondary', label: 'Hold to archive', onConfirm: work('arch') })]),
        H3('Publish · success ripple from the centre (successTone success | accent)'),
        row([h(UL.ULPublishButton, { ...P, key: 'p1', onPublish: work('pub') }), h(UL.ULPublishButton, { ...P, key: 'p2', successTone: 'accent', onPublish: work('pub') }), h(UL.ULPublishButton, { ...P, key: 'p3', published: true, onUnpublish: work('un'), onPublish: work('pub') }), h(UL.ULSaveButton, { ...P, key: 's', onSave: work('s') }), h(UL.ULSubmitButton, { ...P, key: 'u', onSubmit: work('u') })]),
        H3('ULShareButton · ULUndoToast'),
        row([
          h(UL.ULShareButton, { ...P, key: 's', url: 'https://ultra-labs.eu/work/client-portal', title: 'Client portal', preferNative: false }),
          h(UL.ULButton, { key: 'u', ref: undoRef, variant: 'secondary', onClick: () => setUndo(true) }, 'Archive 3 invoices'),
          h(UL.ULUndoToast, { key: 't', open: undo, onOpenChange: setUndo, anchorRef: undoRef, message: '3 invoices archived', onUndo: work('undo'), locale: loc }),
        ]));
    }
    function SpamPanel({ P }) {
      const [calls, setCalls] = useState(0), [last, setLast] = useState('–'), [failNext, setFailNext] = useState(false), [lat, setLat] = useState(400), [st, setSt] = useState('idle');
      const fn = useRef(failNext); fn.current = failNext;
      const change = (k) => (v) => new Promise((res, rej) => { setCalls((c) => c + 1); setTimeout(() => { if (fn.current) { setFailNext(false); rej(new Error('fail')); } else { setLast(k + ' = ' + v); res(); } }, lat); });
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' } },
          ...['star', 'favorite', 'pin', 'bookmark', 'mute'].map((k) => h(UL.ULToggleIconButton, { key: k, kind: k, label: k[0].toUpperCase() + k.slice(1), locale: P.locale, onPressedChange: change(k), onStatusChange: setSt })),
          h('label', { style: Object.assign({ display: 'flex', alignItems: 'center', gap: '8px' }, mono) }, 'latency', h('input', { type: 'range', min: 0, max: 2000, step: 50, value: lat, onChange: (e) => setLat(+e.target.value), style: { width: '120px', accentColor: 'var(--ul-accent)' } }), lat + 'ms'),
          h('button', { type: 'button', 'aria-pressed': failNext, style: pill(failNext), onClick: () => setFailNext(!failNext) }, 'fail the next call')),
        h('p', { 'data-spam': '', style: Object.assign({ margin: 0 }, mono) }, 'onChange calls: ' + calls + ' · last committed: ' + last + ' · status: ' + st + ' (spam-click a star: it flips at once, the call runs once after ' + (UL.actionText ? '' : '') + '350ms of quiet)'));
    }
    function SaveDemo({ P, work, fail, lat }) {
      const [dirty, setDirty] = useState(true), [st, setSt] = useState('dirty'), [at, setAt] = useState(null);
      UL.useUnsavedChangesGuard(dirty);
      const save = () => { setSt('saving'); return work('saved')().then(() => { setDirty(false); setSt('saved'); setAt(Date.now()); }, (e) => { setSt('error'); throw e; }); };
      return h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' } },
        h(UL.ULTextField, { label: 'Project name', defaultValue: 'Client portal', onValueChange: () => { setDirty(true); setSt('dirty'); } }),
        h(UL.ULSaveButton, { ...P, dirty, shortcut: true, onSave: save }),
        h(UL.ULSaveStatus, { status: st, savedAt: at, onRetry: save, locale: P.locale }));
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Actions });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
