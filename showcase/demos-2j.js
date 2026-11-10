// Motion-test cards: async actions (Part 4). Live rAF clock; uses window.ULDemos.__stage (demos-2g.js).
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value });
    const result = (checks) => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'live rAF' });
    const stage = (...a) => window.ULDemos.__stage(...a);
    const live = () => (document.querySelector('[data-ul-action-live]') || {}).textContent || '';
    const tipText = () => [...document.querySelectorAll('[data-ul-tooltip]')].filter((t) => t.style.visibility !== 'hidden' && t.getClientRects().length && getComputedStyle(t).opacity > 0.05).map((t) => t.textContent).join(' | ');
    const deferred = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };

    /* state machine */
    async function actionMachineTest() {
      const checks = [], c = ck(checks); let D = null, calls = 0, seen = [], setForce = null, mounted = null;
      function Fix() {
        const [st, setSt] = React.useState(undefined); setForce = setSt; const [on, setOn] = React.useState(true); mounted = setOn;
        return h('div', { style: { display: 'flex', gap: '12px' } },
          on ? h(UL.ULActionButton, { 'data-t': 'a', onAction: () => { calls++; D = deferred(); return D.p; }, labels: { idle: 'Run', loading: 'Running', success: 'Ran', error: 'Retry' }, successDuration: 500, errorDuration: 500, minLoadingMs: 300, onStatusChange: (s) => seen.push(s) }) : h('span', null, 'gone'),
          h(UL.ULActionButton, { 'data-t': 'c', status: st, onAction: () => {}, labels: { idle: 'Ctl' } }));
      }
      const S = await stage(() => h(Fix), 520);
      const A = () => S.box.querySelector('[data-t="a"]'), C = () => S.box.querySelector('[data-t="c"]');
      const t0 = performance.now(); A().click(); A().click(); A().click(); await raf();
      c('double', 'double / triple click while loading is ignored (one call)', calls === 1, calls + ' call(s)');
      c('busy', 'loading: aria-busy + aria-disabled, focus kept on the button', A().getAttribute('aria-busy') === 'true' && A().getAttribute('aria-disabled') === 'true', A().getAttribute('aria-busy') + ' / ' + A().getAttribute('aria-disabled'));
      D.res(1); await raf(); await raf();
      const early = A().dataset.status; await wait(360); const tSucc = performance.now() - t0;
      c('min', 'resolves before minLoadingMs → stays loading until ≥ 300ms', early === 'loading' && A().dataset.status === 'success', early + ' → ' + A().dataset.status + ' at ' + Math.round(tSucc) + 'ms');
      // interruption during success: restart cleanly
      A().click(); await raf(); const re = A().dataset.status; D.res(1); await wait(450);
      c('interrupt', 'click during success restarts (loading → success), timers of the old run do not fire', re === 'loading' && A().dataset.status === 'success', re + ' → ' + A().dataset.status);
      await wait(700);
      c('idle', 'success → idle after successDuration', A().dataset.status === 'idle', A().dataset.status);
      A().click(); D.rej(new Error('x')); await wait(400);
      c('error', 'rejection → error (destructive tone) → idle after errorDuration', A().dataset.status === 'error' && A().classList.contains('ul-btn--destructive'), A().dataset.status);
      await wait(600); c('error-idle', 'error returns to idle', A().dataset.status === 'idle', A().dataset.status);
      c('order', 'transition order', seen.join('>').startsWith('loading>success>loading>success>idle>loading>error>idle'), seen.join('>'));
      // controlled
      setForce('success'); await wait(80); const cs = C().dataset.status; setForce('error'); await wait(80); const ce = C().dataset.status; setForce(undefined); await wait(80);
      c('controlled', 'controlled status prop drives the visual state', cs === 'success' && ce === 'error' && C().dataset.status === 'idle', cs + ' / ' + ce + ' / ' + C().dataset.status);
      // unmount while loading: no updates afterwards (React warns otherwise), timers cleared
      const errs = []; const oe = console.error; console.error = (...a) => { errs.push(a.join(' ')); oe(...a); };
      A().click(); mounted(false); await wait(50); D.res(1); await wait(700); console.error = oe;
      c('unmount', 'unmount during loading: timers cleared, no late state updates', errs.length === 0, errs.length + ' console errors');
      await S.done(); return result(checks);
    }

    /* icon + label swap frames, width morph, neighbours */
    async function actionSwapTest() {
      const checks = [], c = ck(checks); let D = null;
      const S = await stage(() => h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h(UL.ULActionButton, { 'data-t': 'm', onAction: () => { D = deferred(); return D.p; }, labels: { idle: 'Save', loading: 'Saving changes…', success: 'Saved' }, minLoadingMs: 0, successDuration: 4000 }),
        h('span', { 'data-t': 'n' }, 'neighbour'),
        h(UL.ULActionButton, { 'data-t': 'r', widthMode: 'reserve', onAction: () => D.p, labels: { idle: 'Go', loading: 'Going somewhere…', success: 'Gone' }, minLoadingMs: 0 }),
        h('span', { 'data-t': 'n2' }, 'neighbour 2')), 640);
      const M = S.box.querySelector('[data-t="m"]'), N = S.box.querySelector('[data-t="n"]'), R = S.box.querySelector('[data-t="r"]'), N2 = S.box.querySelector('[data-t="n2"]');
      const frames = []; M.click(); const t0 = performance.now(); let w = [];
      while (performance.now() - t0 < 500) { await raf(); const cell = M.querySelector('.ul-act-label'), cr = cell.getBoundingClientRect(), texts = [...cell.querySelectorAll('.ul-act-text')];
        frames.push({ n: texts.length, h: cr.height, half: texts.filter((t) => { const b = t.getBoundingClientRect(); return b.bottom > cr.top + 0.5 && b.top < cr.bottom - 0.5; }).length, ics: [...M.querySelectorAll('.ul-act-ic')].filter((i) => +getComputedStyle(i).opacity > 0.05).length });
        w.push(M.getBoundingClientRect().width); }
      const atRest = M.querySelectorAll('.ul-act-label .ul-act-text').length;
      c('overlap', 'old and new label / icon overlap during the swap', frames.some((f) => f.n === 2) && frames.some((f) => f.ics >= 2), 'frames with 2 labels: ' + frames.filter((f) => f.n === 2).length + ' · with 2 icons: ' + frames.filter((f) => f.ics >= 2).length);
      c('row', 'label cell = one glyph row (constant height); at rest one label only', new Set(frames.map((f) => Math.round(f.h))).size === 1 && atRest === 1, 'height ' + Math.round(frames[0].h) + 'px · labels at rest ' + atRest);
      const steps = new Set(w.map((x) => Math.round(x))).size;
      c('morph', 'width morphs through intermediate widths (no jump)', steps >= 5, steps + ' distinct widths ' + Math.round(w[0]) + ' → ' + Math.round(w[w.length - 1]));
      const n2x = N2.getBoundingClientRect().left; R.click(); await wait(400); const n2y = N2.getBoundingClientRect().left;
      c('reserve', 'widthMode reserve: neighbours never move', Math.abs(n2x - n2y) < 0.5, 'Δ ' + (n2y - n2x).toFixed(2) + 'px');
      D.res(1); await wait(400); await S.done(); return result(checks);
    }

    /* copy */
    async function copyTest() {
      const checks = [], c = ck(checks); const writes = []; let mode = 'ok';
      const writer = (t) => { writes.push(t.length); return mode === 'ok' ? Promise.resolve() : Promise.reject(new Error('denied')); };
      const S = await stage((v) => h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
        h(UL.ULCopyButton, { 'data-t': 'b', value: 'INV-42', writer }), h(UL.ULCopyButton, { 'data-t': 's', variant: 'icon', label: 'Copy key', sensitive: true, value: 'sk_secret_123', writer }),
        h(UL.ULCopyButton, { 'data-t': 'l', value: 'x', locale: ['en', 'sk', 'de', 'cs'][v || 0], writer })), 560);
      const B = (t) => S.box.querySelector('[data-t="' + t + '"]');
      B('b').click(); await wait(120);
      c('copy', 'click copies the props value, check draws in, tooltip "Copied to clipboard", live region', writes[0] === 6 && B('b').dataset.status === 'success' && /Copied to clipboard/.test(tipText()) && /Copied to clipboard/.test(live()), 'tooltip "' + tipText() + '" · live "' + live() + '"');
      await wait(900); B('b').click(); await wait(80); const still = tipText(); await wait(1100); const after = tipText();
      c('restart', 'second click restarts the tooltip timer without a re-enter', /Copied/.test(still) && /Copied/.test(after), 'at +1.1s after the 2nd click: "' + after + '"');
      await wait(900); c('timing', 'tooltip hides ≈1600ms after the last click', !/Copied/.test(tipText()), '"' + tipText() + '"');
      // fallback path: real copyText with no clipboard API
      const nav = navigator.clipboard; let fb = null;
      try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); const ex = document.execCommand; document.execCommand = (cmd) => cmd === 'copy'; try { await UL.copyText('abc'); fb = true; } catch (e) { fb = false; } document.execCommand = (cmd) => false; let fail = false; try { await UL.copyText('abc'); } catch (e) { fail = true; } document.execCommand = ex; c('fallback', 'fallback (no Clipboard API): hidden textarea + execCommand; both failing → error', fb === true && fail === true, 'fallback ' + fb + ' · both fail → throws ' + fail); }
      finally { Object.defineProperty(navigator, 'clipboard', { value: nav, configurable: true }); }
      mode = 'fail'; B('b').click(); await wait(150);
      c('fail', 'failure: error state + "Couldn\'t copy"; next click retries', B('b').dataset.status === 'error' && /Couldn.t copy/.test(tipText() + live()), B('b').dataset.status + ' · "' + tipText() + '"');
      mode = 'ok'; B('s').click(); await wait(120);
      const leak = [tipText(), live(), B('s').getAttribute('aria-label'), B('s').getAttribute('title') || '', B('s').getAttribute('data-ul-tip') || '', document.body.innerText].some((t) => t.includes('sk_secret'));
      c('sensitive', 'sensitive: value never in a tooltip, title, aria text or the live region', !leak, leak ? 'LEAK' : 'clean');
      const words = [];
      for (let i = 0; i < 4; i++) { S.set(i); await wait(60); B('l').click(); await wait(120); words.push(live()); await wait(100); }
      c('locale', 'EN / SK / DE / CS strings', words[0] === 'Copied to clipboard' && words[1] === 'Skopírované do schránky' && words[2] === 'In die Zwischenablage kopiert' && words[3] === 'Zkopírováno do schránky', words.join(' · '));
      await S.done(); return result(checks);
    }

    /* save */
    async function saveTest() {
      const checks = [], c = ck(checks); let D = null, n = 0, setDirty = null;
      function Fix() { const [dirty, sd] = React.useState(false); setDirty = sd; const [st, setSt] = React.useState('clean'); UL.useUnsavedChangesGuard(dirty);
        return h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, h(UL.ULSaveButton, { 'data-t': 's', dirty, shortcut: true, minLoadingMs: 0, onSave: () => { n++; setSt('saving'); D = deferred(); return D.p.then(() => { setSt('saved'); sd(false); }, (e) => { setSt('error'); throw e; }); } }), h(UL.ULSaveStatus, { status: st, savedAt: st === 'saved' ? Date.now() : null })); }
      const S = await stage(() => h(Fix), 520); const B = () => S.box.querySelector('[data-t="s"]'), ST = () => S.box.querySelector('.ul-act-status');
      c('clean', 'not dirty: disabled', B().disabled || B().getAttribute('aria-disabled') === 'true', String(B().disabled));
      setDirty(true); await wait(60);
      const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev);
      c('guard', 'useUnsavedChangesGuard: beforeunload blocked while dirty', ev.defaultPrevented, String(ev.defaultPrevented));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, metaKey: true, bubbles: true, cancelable: true })); await wait(60);
      c('shortcut', 'Cmd / Ctrl+S runs the save (preventDefault)', n === 1 && B().dataset.status === 'loading' && /Saving/.test(ST().textContent), n + ' · ' + B().dataset.status + ' · "' + ST().textContent.trim() + '"');
      D.rej(new Error('500')); await wait(120);
      c('error', 'error: "Couldn\'t save", Retry label, stays until retried', B().dataset.status === 'error' && /Retry/.test(B().textContent) && /Couldn.t save/.test(ST().textContent), B().textContent.trim() + ' · ' + ST().textContent.trim());
      await wait(3200); const stays = B().dataset.status === 'error';
      B().click(); await wait(40); D.res(); await wait(150);
      c('retry', 'Retry runs again → saved → "Saved just now"', stays && n === 2 && B().dataset.status === 'success' && /Saved just now/.test(ST().textContent), 'calls ' + n + ' · ' + B().dataset.status + ' · "' + ST().textContent.trim() + '"');
      await S.done(); return result(checks);
    }

    /* confirm modes */
    async function confirmTest() {
      const checks = [], c = ck(checks); let ran = 0;
      const S = await stage(() => h('div', { style: { display: 'flex', gap: '10px' } },
        h(UL.ULConfirmAction, { 'data-t': 'i', confirm: 'inline', timeoutMs: 600, onConfirm: () => { ran++; }, minLoadingMs: 0 }),
        h(UL.ULConfirmAction, { 'data-t': 'h', confirm: 'hold', holdMs: 400, onConfirm: () => { ran += 10; }, minLoadingMs: 0 }),
        h(UL.ULConfirmAction, { 'data-t': 't', confirm: 'type', typeText: 'abc', onConfirm: () => { ran += 100; }, minLoadingMs: 0 })), 640);
      const B = (t) => S.box.querySelector('[data-t="' + t + '"]');
      B('i').click(); await wait(80); const armed = /Confirm/.test(B('i').textContent) && !!B('i').querySelector('.ul-act-count'); await wait(700);
      c('inline-revert', 'inline: first click → "Confirm?" + countdown ring; timeout reverts', armed && !/Confirm/.test(B('i').textContent) && ran === 0, 'armed ' + armed + ' · now "' + B('i').textContent.trim() + '"');
      B('i').click(); await wait(80); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(80);
      const escRev = !/Confirm/.test(B('i').textContent);
      B('i').click(); await wait(80); B('i').click(); await wait(150);
      c('inline-run', 'Esc reverts; second click within the countdown runs', escRev && ran === 1, 'Esc ' + escRev + ' · ran ' + ran);
      const hb = B('h'); hb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); await wait(200); const mid = new DOMMatrixReadOnly(getComputedStyle(hb.querySelector('.ul-act-holdfill')).transform).a;
      hb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); await wait(450); const cancelled = ran === 1;
      hb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); await wait(600);
      c('hold', 'hold: progress fill grows; release cancels; full hold runs', mid > 0.2 && mid < 0.9 && cancelled && ran === 11, 'fill at 200ms ' + mid.toFixed(2) + ' · cancelled ' + cancelled + ' · ran ' + ran);
      hb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      B('t').click(); await wait(800);
      const dlg = [...document.querySelectorAll('.ul-anchored[data-ul-covered-anchor]')].find((n) => n.style.visibility !== 'hidden');
      const act = dlg && [...dlg.querySelectorAll('.ul-act')].pop(), inp = dlg && dlg.querySelector('input');
      const dis0 = act && act.disabled;
      if (inp) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(inp, 'abc'); inp.dispatchEvent(new Event('input', { bubbles: true })); await wait(80); }
      const dis1 = act && act.disabled; act && act.click(); await wait(900);
      c('type', 'type: dialog (existing dialog), action disabled until the text matches, then runs', !!dlg && dis0 === true && dis1 === false && ran === 111, 'dialog ' + !!dlg + ' · disabled ' + dis0 + ' → ' + dis1 + ' · ran ' + ran);
      await wait(600); await S.done(); return result(checks);
    }

    /* export, refresh, toggle, undo, reduced motion */
    async function actionMiscTest() {
      const checks = [], c = ck(checks); let rep = null, D = null, refreshes = 0, tog = null, undone = 0;
      const tRef = { current: null };
      function Fix() {
        const [open, setOpen] = React.useState(false); tog = setOpen;
        return h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
          h(UL.ULDownloadButton, { 'data-t': 'd', filename: 'x.txt', minLoadingMs: 0, onExport: ({ report }) => { rep = report; D = deferred(); return D.p; } }),
          h(UL.ULRefreshButton, { 'data-t': 'r', autoRefresh: 400, onRefresh: () => { refreshes++; }, minLoadingMs: 0 }),
          h(UL.ULToggleIconButton, { 'data-t': 'g', kind: 'star', label: 'Star', onPressedChange: () => new Promise((_, r) => setTimeout(() => r(new Error('no')), 150)) }),
          h('button', { ref: tRef, type: 'button' }, 'anchor'),
          h(UL.ULUndoToast, { open, onOpenChange: setOpen, anchorRef: tRef, message: 'Archived', duration: 1500, onUndo: () => { undone++; } }));
      }
      const S = await stage(() => h(Fix), 640); const B = (t) => S.box.querySelector('[data-t="' + t + '"]');
      B('d').click(); await wait(60); rep(0.4); await wait(80);
      const lab = B('d').textContent, ring = B('d').querySelector('.ul-act-progress');
      const off = ring ? parseFloat(getComputedStyle(ring.querySelector('.ul-act-count-fill')).strokeDashoffset) : NaN;
      const clickSpy = []; const oc = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { clickSpy.push(this.download); };
      D.res('hello'); await wait(150); HTMLAnchorElement.prototype.click = oc;
      c('export', 'export: determinate progress (label + ring), Blob / text saved with the filename, "Downloaded"', /40 %/.test(lab) && Math.abs(off - 60) < 2 && clickSpy[0] === 'x.txt' && B('d').dataset.status === 'success', lab.trim() + ' · ring offset ' + off + ' · saved ' + clickSpy.join());
      const r0 = refreshes; await wait(1100); const r1 = refreshes;
      Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); await wait(900); const r2 = refreshes;
      delete document.hidden; Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); await wait(100); delete document.hidden;
      c('refresh', 'auto refresh runs on the countdown; pauses while the tab is hidden', r1 - r0 >= 2 && r2 === r1, 'runs ' + (r1 - r0) + ' in 1.1s · while hidden +' + (r2 - r1));
      const g = B('g'); g.click(); await raf(); await raf(); const optimistic = g.getAttribute('aria-pressed'); await wait(750); // coalesced: commits after the quiet period
      c('toggle', 'toggle: optimistic aria-pressed, rejection rolls back + error feedback', optimistic === 'true' && g.getAttribute('aria-pressed') === 'false' && /Couldn.t change/.test(live()), optimistic + ' → ' + g.getAttribute('aria-pressed') + ' · "' + live() + '"');
      tog(true); await wait(600);
      const surf = [...document.querySelectorAll('.ul-toast-surface')].find((n) => n.style.visibility !== 'hidden' && n.getClientRects().length);
      const fill = surf && surf.querySelector('.ul-act-count-fill'), anim = fill && fill.getAnimations()[0];
      surf && surf.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false })); surf && surf.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      await wait(1300); const stillOpen = !!surf && surf.style.visibility !== 'hidden' && surf.getClientRects().length > 0;
      const undoBtn = surf && [...surf.querySelectorAll('button')].find((b) => /Undo/.test(b.textContent)); undoBtn && undoBtn.click(); await wait(200);
      c('undo', 'undo toast: countdown ring, timer pauses on hover, Undo runs the async action', !!anim && stillOpen && undone === 1 && /Undone/.test(live()), 'ring ' + !!anim + ' · open after 1.9s hovered ' + stillOpen + ' · undone ' + undone);
      UL.configureMorph({ reducedMotion: 'reduce' });
      B('d').click(); await raf(); const red = B('d').hasAttribute('data-reduced'); const shakes = B('d').getAnimations().filter((a) => a.effect && a.effect.getKeyframes().some((k) => k.translate)).length; D.rej(new Error('x')); await wait(150);
      const shake2 = B('d').getAnimations().filter((a) => a.effect && a.effect.getKeyframes().some((k) => k.translate)).length;
      UL.configureMorph({ reducedMotion: 'auto' });
      c('reduced', 'reduced motion: opacity only (no shake, no ring scale, label fades)', red && shakes === 0 && shake2 === 0, 'data-reduced ' + red + ' · shake animations ' + shake2);
      tog(false); await wait(600); await S.done(); return result(checks);
    }

    window.ULDemos = Object.assign(window.ULDemos || {}, { actionMachineTest, actionSwapTest, copyTest, saveTest, confirmTest, actionMiscTest });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
