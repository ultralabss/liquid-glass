// Showcase fixtures + live tests for 2e: date range picker, colour picker expansion, check mark, concentric item radius,
// glass arrow map, keyboard walkthrough, blur-only check. Composes window.UL only. Result shape = thumb-harness
// ({ status, checks: [{ key, label, pass, value }], driver }).
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement, { useState, useRef } = React;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), raf = () => new Promise((r) => requestAnimationFrame(r));
    const now = () => document.timeline.currentTime;
    const key = (el, k, o) => el && el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));
    const vis = (n) => n && n.style.visibility !== 'hidden' && n.getClientRects().length > 0;
    const surfaces = () => [...document.querySelectorAll('.ul-anchored')].filter(vis);
    const result = (checks, extra) => Object.assign({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'live rAF (document timeline)' }, extra);
    const TS = { minHeight: '44px', padding: '0 16px', borderRadius: '999px', border: '1px solid rgb(255 255 255 / .35)', background: 'rgb(255 255 255 / .1)', color: '#fff', font: '600 14px/1 inherit', cursor: 'pointer' };
    const D = (y, m, d) => new Date(y, m - 1, d);

    function PickerFixtures() {
      const [o, setO] = useState({ range: D(2026, 11, 3), rangeEnd: D(2026, 11, 6), locale: 'en', radio: 'week' });
      const R = { menu: useRef(null) };
      React.useEffect(() => {
        window.__mt2e = { set: (k, v) => setO((s) => Object.assign({}, s, { [k]: v })), log: [], get: () => o };
        window.dispatchEvent(new Event('ul:mt2e-ready'));
      }, []);
      const radioItems = [{ type: 'label', label: 'Group by' }].concat(['day', 'week', 'month'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), type: 'radio', checked: o.radio === id })));
      return h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' } },
        h('div', { 'data-case': 'range', style: { width: '300px' } }, h(UL.ULDateRangePicker, {
          label: 'Reporting period', locale: o.locale, presets: true, defaultValue: { start: o.range, end: o.rangeEnd },
          isDateDisabled: (d) => d.getFullYear() === 2026 && d.getMonth() === 10 && d.getDate() === 25,
          onValueChange: (r) => window.__mt2e.log.push(r ? [r.start.toDateString(), r.end.toDateString()] : null),
        })),
        h('div', { 'data-case': 'cpx', style: { width: '240px' } }, h(UL.ULColorPicker, { label: 'Accent', defaultValue: 'violet', presets: ['ice', 'violet', 'emerald', 'amber', 'rose', { value: '#ff6b6b', label: 'Coral' }] })),
        h('div', { 'data-case': 'radio', style: { paddingTop: '26px' } },
          h('button', { ref: R.menu, type: 'button', style: TS, 'aria-haspopup': 'menu', 'aria-expanded': !!o.menu, 'data-kbd-initial-focus': 'none', onClick: () => setO((s) => Object.assign({}, s, { menu: !s.menu })) }, 'Group by'),
          h(UL.ULMenu, { open: !!o.menu, onOpenChange: (v) => setO((s) => Object.assign({}, s, { menu: v })), anchorRef: R.menu, items: radioItems, label: 'Group by', initialFocus: null, onAction: (id) => setO((s) => Object.assign({}, s, { radio: id })) })),
        h('div', { 'data-case': 'tabs2e', style: { width: '360px', paddingTop: '26px' } }, h(UL.ULTabs, { 'aria-label': 'Blur-only tabs', defaultValue: 'a', items: [{ value: 'a', label: 'Overview' }, { value: 'b', label: 'Activity' }, { value: 'c', label: 'Settings' }] })),
      );
    }

    /* ---------- helpers for the range picker ---------- */
    const RQ = (sel) => document.querySelector('[data-case="range"] ' + sel);
    const rangeSurface = () => surfaces().find((s) => s.classList.contains('ul-range-surface'));
    const dayBtn = (y, m, d) => { const s = rangeSurface(); return s && s.querySelector(`.ul-range-track > .ul-range-month .ul-cal-day[data-date="${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}"]`); };
    const over = (el) => el && el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    const clip = (b) => { const m = (b.style.clipPath || '').match(/inset\(([^)]*?)(?: round[^)]*)?\)/); if (!m) return null; const v = m[1].trim().split(/\s+/).map(parseFloat); const [tp, r = tp, bt = tp, l = r] = v; return { r, l }; }; // inset() may be normalised to 1–4 values
    /** Rows (month-major) with the visible extent of a band layer, plus which of their day cells are covered. */
    const bandRows = (k) => {
      const s = rangeSurface(); if (!s) return [];
      return [...s.querySelectorAll('.ul-range-track > .ul-range-month .ul-cal-row[data-week]')].map((row) => {
        const b = row.querySelector(`.ul-band[data-k="${k}"]`), c = clip(b), W = row.clientWidth, on = b.style.opacity !== '0' && getComputedStyle(b).opacity > 0.05 && c && W - c.r - c.l > 1;
        const days = [...row.querySelectorAll('.ul-cal-day')].map((d) => { const cell = d.parentElement, cx = cell.offsetLeft + cell.offsetWidth / 2; return { date: d.dataset.date, covered: !!on && cx > c.l && cx < W - c.r }; });
        return { on: !!on, x0: c ? c.l : 0, x1: c ? W - c.r : 0, days };
      });
    };
    const isoD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const between = (a, b) => { const out = []; for (let d = new Date(a); d <= b; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) out.push(isoD(d)); return out; };

    async function rangeTest() {
      const checks = [], ck = (k, l, p, v) => checks.push({ key: k, label: l, pass: p, value: v });
      const M = window.__mt2e; M.log.length = 0;
      const trig = RQ('.ul-range-open'); if (!trig) return result([{ key: 'fx', label: 'fixture present', pass: false, value: 'no trigger' }]);
      // open: anchored morph (ul:morph enter events from AnchoredMorph)
      let morphEv = 0; const onM = (e) => { if (e.detail && e.detail.phase === 'enter') morphEv++; }; document.addEventListener('ul:morph', onM, true);
      trig.click(); await wait(700); document.removeEventListener('ul:morph', onM, true);
      const s = rangeSurface();
      ck('open', 'opens in a ULAnchoredSurface popper (anchored morph, portal, scroll lock)', !!s && morphEv > 0 && document.documentElement.hasAttribute('data-ul-scroll-locked'), s ? `morph events ${morphEv} · months ${s.dataset.months} · ${s.parentElement === document.body || s.closest('body > *') ? 'portal' : 'inline'}` : 'no surface');
      if (!s) return result(checks);
      const nb = s.querySelectorAll('.ul-band').length, nr = s.querySelectorAll('.ul-range-track .ul-cal-row[data-week]').length;
      ck('bands', 'one band element per visible week row and layer (no per-day backgrounds)', nb === nr * 2 && ![...s.querySelectorAll('.ul-cal-day')].some((d) => /background/.test(getComputedStyle(d).transitionProperty)), `${nb} bands for ${nr} rows`);
      const glass = [...s.querySelectorAll('.ul-glass')].filter((g) => g.offsetParent !== null || g.style.opacity !== '0');
      ck('glass', 'glass inside the popper: 2 beads + 1 hover lens only (day cells are flat)', s.querySelectorAll('.ul-glass').length === 3 && !s.querySelector('.ul-cal-day .ul-glass'), `${s.querySelectorAll('.ul-glass').length} glass nodes · flattened (nested) · ${glass.length} visible`);
      // first click: start bead grows
      const a = dayBtn(2026, 11, 12); a.click(); await raf(); await raf();
      const bead = [...s.querySelectorAll('.ul-range-bead')].find((b) => b.style.opacity === '1');
      const beadAnim = bead && bead.getAnimations().length > 0;
      await wait(420);
      const br = bead && bead.getBoundingClientRect(), ar = a.getBoundingClientRect();
      ck('start', 'first click: start becomes a bead (grows with overshoot), picking state on', !!bead && beadAnim && Math.abs(br.left + br.width / 2 - (ar.left + ar.width / 2)) < 2 && s.querySelector('.ul-range-months').hasAttribute('data-picking'),
        bead ? `bead ${br.width.toFixed(0)}×${br.height.toFixed(0)} centred ${(br.left + br.width / 2 - ar.left - ar.width / 2).toFixed(1)}px · grow anim ${beadAnim}` : 'no bead');
      // hover sweep 12 Nov → 10 Dec, one day per ~3 frames; sample the preview band every frame
      const targets = between(D(2026, 11, 13), D(2026, 12, 10)).map((iso) => { const [y, m, d] = iso.split('-').map(Number); return dayBtn(y, m, d); }).filter((b) => b && !b.disabled);
      let frames = 0, gaps = 0, worstJump = 0, ft = [], lastT = now(), prevX = null;
      for (let i = 0; i < targets.length; i++) {
        over(targets[i]);
        for (let f = 0; f < 3; f++) {
          await raf(); frames++; const t = now(); ft.push(t - lastT); lastT = t;
          const rows = bandRows('preview'), onIdx = rows.map((r, j) => (r.on ? j : -1)).filter((j) => j >= 0);
          if (onIdx.length > 1) for (let j = onIdx[0]; j <= onIdx[onIdx.length - 1]; j++) if (!rows[j].on && rows[j].days.length) gaps++;
          const lastOn = onIdx[onIdx.length - 1];
          if (lastOn != null) { const x = lastOn * 1000 + rows[lastOn].x1; if (prevX != null && Math.floor(prevX / 1000) === lastOn) worstJump = Math.max(worstJump, Math.abs(x - prevX)); prevX = x; }
        }
      }
      await wait(300);
      const want = new Set(between(D(2026, 11, 12), D(2026, 12, 10)));
      const rows = bandRows('preview');
      let miss = 0, extra = 0; const ex = []; rows.forEach((r) => r.days.forEach((d) => { if (want.has(d.date) && !d.covered) miss++; if (!want.has(d.date) && d.covered) { extra++; ex.push(d.date.slice(5)); } }));
      const sorted = ft.slice().sort((x, y) => x - y), p95 = sorted[Math.floor(sorted.length * 0.95)] || 0, avg = ft.reduce((x, y) => x + y, 0) / Math.max(1, ft.length);
      ck('preview', 'preview band continuous across both months and week wraps (every frame, no gap rows)', gaps === 0 && miss === 0 && extra === 0, `${frames} frames · gap rows ${gaps} · settled: missing ${miss} · extra ${extra} days${ex.length ? ' (' + ex.slice(0, 6).join(' ') + ')' : ''}`);
      ck('smooth', 'band edge follows smoothly (per-frame edge step ≤ 1.5 cells)', worstJump <= 66, `worst step ${worstJump.toFixed(1)}px (cell 44px)`);
      ck('fps', 'hover sweep frame time (120 Hz target: p95 ≤ 9.5ms on a 120 Hz display)', null, `avg ${avg.toFixed(1)}ms (${(1000 / avg).toFixed(0)} fps) · p95 ${p95.toFixed(1)}ms`);
      ck('nochange', 'preview never changes the committed value', M.log.length === 0, `onChange calls ${M.log.length}`);
      // second click: commit, firm band, ripple capped, end bead
      const e = dayBtn(2026, 12, 10); e.click(); await raf(); await raf();
      const nums = [...s.querySelectorAll('.ul-cal-day[data-mid] .ul-cal-num')], delays = nums.map((n) => (n.getAnimations()[0] ? n.getAnimations()[0].effect.getTiming().delay : -1)).filter((x) => x >= 0);
      await wait(500);
      const firm = bandRows('firm'); let fmiss = 0; firm.forEach((r) => r.days.forEach((d) => { if (want.has(d.date) && !d.covered) fmiss++; }));
      const beads = [...s.querySelectorAll('.ul-range-bead')].filter((b) => b.style.opacity === '1');
      ck('commit', 'second click: onChange once, band firms up, end bead', M.log.length === 1 && fmiss === 0 && beads.length === 2, `onChange ${M.log.length} ${JSON.stringify(M.log[0] || '')} · firm missing ${fmiss} · beads ${beads.length}`);
      ck('ripple', 'days in between ripple from the start (≈12ms / day, capped ≈180ms)', delays.length > 5 && Math.max(...delays) <= 181 * (window.UL.getMorphTimeScale ? 1 : 1) && delays[1] >= delays[0], `${delays.length} days · delays ${delays.slice(0, 4).map((x) => x.toFixed(0)).join(', ')} … max ${Math.max(...delays, 0).toFixed(0)}ms`);
      // restart + swap
      dayBtn(2026, 11, 20).click(); await wait(260);
      const firmGone = getComputedStyle(s.querySelector('.ul-band[data-k="firm"]')).opacity;
      dayBtn(2026, 11, 15).click(); await wait(400);
      ck('restart', 'click on a complete range starts a new one; old band fades out', parseFloat(firmGone) < 0.2, `firm band opacity while picking ${(+firmGone).toFixed(2)}`);
      ck('swap', 'end earlier than start swaps them', JSON.stringify(M.log[1]) === JSON.stringify([D(2026, 11, 15).toDateString(), D(2026, 11, 20).toDateString()]), JSON.stringify(M.log[1] || null));
      // Esc while picking: cancel + restore; Esc again: close
      dayBtn(2026, 11, 26).click(); await wait(120); key(document.activeElement, 'Escape'); await wait(200);
      const restored = !s.querySelector('.ul-range-months').hasAttribute('data-picking') && M.log.length === 2 && !!rangeSurface() && s.querySelectorAll('.ul-cal-day[data-endpoint]').length === 2;
      ck('esc1', 'Esc while picking cancels and restores the previous range (popper stays)', restored, `onChange ${M.log.length} · endpoints ${s.querySelectorAll('.ul-cal-day[data-endpoint]').length} · open ${!!rangeSurface()}`);
      // disabled day skipped by the keyboard (25 Nov disabled)
      const d24 = dayBtn(2026, 11, 24); d24.focus(); await raf(); key(d24, 'ArrowRight'); await wait(60);
      ck('skip', 'disabled days are faded and skipped by the keyboard', document.activeElement && document.activeElement.dataset.date === '2026-11-26' && dayBtn(2026, 11, 25).disabled, `24 → ${document.activeElement && document.activeElement.dataset.date}`);
      // keyboard selection: Enter, ArrowDown ×2 (preview mirrors focus), Enter
      key(document.activeElement, 'Enter'); await wait(80); key(document.activeElement, 'ArrowDown'); await wait(40); key(document.activeElement, 'ArrowDown'); await wait(300);
      const kp = bandRows('preview'); let kmiss = 0; const kw = new Set(between(D(2026, 11, 26), D(2026, 12, 10))); kp.forEach((r) => r.days.forEach((d) => { if (kw.has(d.date) && !d.covered) kmiss++; }));
      const liveTxt = (s.querySelector('[role="status"]') || {}).textContent || '';
      key(document.activeElement, 'Enter'); await wait(300);
      ck('kbd', 'keyboard: Enter / arrows / Enter; focus preview mirrors hover; live region', M.log.length === 3 && kmiss === 0 && /Start date/.test(liveTxt), `onChange ${M.log.length} ${JSON.stringify(M.log[2] || '')} · preview missing ${kmiss} · live "${liveTxt}"`);
      const sel = [...s.querySelectorAll('[role="gridcell"][aria-selected="true"]')].length, lab = (dayBtn(2026, 11, 26) || {}).getAttribute ? dayBtn(2026, 11, 26).getAttribute('aria-label') : '';
      ck('aria', 'aria-selected + labels for start / end / range', sel >= 15 && /start date/.test(lab), `${sel} selected cells · "${lab}"`);
      // PageDown: next month with the slide; height never jumps
      const hm = s.querySelector('.ul-range-months').offsetHeight, t0 = s.querySelector('.ul-range-month .ul-cal-month').textContent;
      key(document.activeElement, 'PageDown'); key(document.activeElement, 'PageDown'); await raf(); await raf();
      const ghost = !!s.querySelector('.ul-range-ghost'); await wait(400);
      ck('slide', 'month change: direction-aware slide + crossfade, no layout jump', ghost && s.querySelector('.ul-range-months').offsetHeight === hm && s.querySelector('.ul-range-month .ul-cal-month').textContent !== t0, `ghost ${ghost} · height ${hm} → ${s.querySelector('.ul-range-months').offsetHeight} · ${t0} → ${s.querySelector('.ul-range-month .ul-cal-month').textContent}`);
      key(document.activeElement, 'Escape'); await wait(700);
      ck('esc2', 'Esc (not picking) closes; focus returns to the trigger', !rangeSurface() && document.activeElement === trig, `open ${!!rangeSurface()} · focus on trigger ${document.activeElement === trig}`);
      // locale: DE, Monday first, European formats
      M.set('locale', 'de'); await wait(120); trig.click(); await wait(700);
      const s2 = rangeSurface(), wd = s2 ? s2.querySelector('.ul-cal-wdn').textContent : '', mt = s2 ? s2.querySelector('.ul-cal-month').textContent : '';
      ck('locale', 'locale DE: Monday first, German month names, European formats', wd === 'Mo' && /ember|Januar|Oktober|Dezember/.test(mt), `first weekday "${wd}" · "${mt}" · trigger "${trig.textContent.trim()}"`);
      key(s2 && s2.querySelector('.ul-cal-day[tabindex="0"]'), 'Escape'); await wait(700); M.set('locale', 'en'); await wait(100);
      ck('narrow', 'narrow viewport (< 640px): 1 month, bottom sheet', null, 'viewport-tests.dc.html (375 × 667 iframe)');
      return result(checks);
    }

    async function colorTest() {
      const checks = [], ck = (k, l, p, v) => checks.push({ key: k, label: l, pass: p, value: v });
      const trig = document.querySelector('[data-case="cpx"] .ul-select-trigger'); if (!trig) return result([{ key: 'fx', label: 'fixture', pass: false, value: 'none' }]);
      trig.click(); await wait(700);
      const s = surfaces().find((x) => x.classList.contains('ul-cp-surface')); if (!s) return result([{ key: 'open', label: 'opens', pass: false, value: 'no surface' }]);
      const btn = s.querySelector('.ul-cp-custom'), panel = s.querySelector('.ul-cp-panel');
      const sample = async (ms) => { const out = []; const t0 = now(); while (now() - t0 < ms) { await raf(); out.push({ t: now() - t0, h: s.getBoundingClientRect().height, o: panel.hidden ? 0 : +getComputedStyle(panel).opacity }); } return out; };
      const h0 = s.getBoundingClientRect().height;
      btn.focus(); btn.click(); const ex = await sample(760);
      const steps = ex.slice(1).map((f, i) => Math.abs(f.h - ex[i].h)), maxStep = Math.max(...steps), h1 = ex[ex.length - 1].h;
      const tH = (ex.find((f) => f.h > h0 + 2) || {}).t, tC = (ex.find((f) => f.o > 0.05) || {}).t;
      ck('aria', 'aria-expanded / aria-controls on the button, focus stays on it', btn.getAttribute('aria-expanded') === 'true' && btn.getAttribute('aria-controls') === panel.id && document.activeElement === btn, `expanded ${btn.getAttribute('aria-expanded')} · focus ${document.activeElement === btn ? 'button' : (document.activeElement || {}).className}`);
      ck('height', 'height morphs continuously to the measured size (never to auto)', h1 > h0 + 100 && maxStep < (h1 - h0) * 0.25 && ex.filter((f) => f.h > h0 + 1 && f.h < h1 - 1).length >= 8, `${h0.toFixed(0)} → ${h1.toFixed(0)}px · ${ex.length} frames · max step ${maxStep.toFixed(1)}px`);
      ck('order', 'content fades + slides in after the height starts', tH != null && tC != null && tC > tH, `height moves at ${tH && tH.toFixed(0)}ms · content visible at ${tC && tC.toFixed(0)}ms`);
      // Tab enters the panel (field is first)
      ck('tab', 'Tab from the button enters the panel (2D field first)', panel.querySelector('.ul-cp-field').tabIndex === 0 && btn.compareDocumentPosition(panel.querySelector('.ul-cp-field')) & 4, 'DOM order');
      // keyboard on the 2D field
      const f = panel.querySelector('.ul-cp-field'); f.focus(); const v0 = f.getAttribute('aria-valuetext'); key(f, 'ArrowRight', { shiftKey: true }); await wait(80);
      ck('field', '2D field keys (Shift = larger step), aria-valuetext', f.getAttribute('aria-valuetext') !== v0, `${v0} → ${f.getAttribute('aria-valuetext')}`);
      // Esc order: first collapses, second closes
      btn.focus(); key(btn, 'Escape'); const co = await sample(700);
      const tO = (co.find((x) => x.o < 0.05) || {}).t, tS = (co.find((x) => x.h < h1 - 2) || {}).t;
      ck('esc1', 'first Esc collapses (content out first, then height); popper stays', btn.getAttribute('aria-expanded') === 'false' && !!surfaces().find((x) => x === s) && tO != null && tS != null && tO <= tS + 40 && Math.abs(co[co.length - 1].h - h0) < 2, `content out ${tO && tO.toFixed(0)}ms · height leaves at ${tS && tS.toFixed(0)}ms · back to ${co[co.length - 1].h.toFixed(0)}px`);
      key(btn, 'Escape'); await wait(700);
      ck('esc2', 'second Esc closes; focus on the trigger', !surfaces().includes(s) && document.activeElement === trig, `focus ${document.activeElement === trig ? 'trigger' : 'elsewhere'}`);
      // contrast guard for custom accents
      const g = UL.guardAccent('#ffff00'), g2 = UL.guardAccent('#8a2be2'), g3 = UL.guardAccent('#8fb8ff');
      ck('guard', 'custom accent contrast guard (clamped into the safe OKLCH range when it would fail)', !g3.adjusted && g.worst >= 4.5 && g2.worst >= 4.5,
        `#ffff00 → ${g.effective} (${g.adjusted ? 'adjusted' : 'kept'}, worst ${g.worst.toFixed(2)}) · #8a2be2 → ${g2.effective} (${g2.worst.toFixed(2)}) · ice kept (${g3.worst.toFixed(2)})`);
      return result(checks);
    }

    async function checkTest() {
      const checks = [], ck = (k, l, p, v) => checks.push({ key: k, label: l, pass: p, value: v });
      const b = document.querySelector('[data-case="radio"] button'); window.__mt2e.set('radio', 'week'); await wait(50); b.click(); await wait(700);
      const s = surfaces().find((x) => x.classList.contains('ul-menu-surface') && x.querySelector('[role="menuitemradio"]'));
      if (!s) return result([{ key: 'open', label: 'menu opens', pass: false, value: 'none' }]);
      const items = [...s.querySelectorAll('[role="menuitemradio"]')], oldC = items[1].querySelector('.ul-check'), newC = items[2].querySelector('.ul-check');
      ck('mount', 'no animation on open: the selected item shows its check at once', oldC.querySelector('svg').getAnimations().length === 0 && +getComputedStyle(oldC.querySelector('svg')).opacity === 1, `opacity ${getComputedStyle(oldC.querySelector('svg')).opacity}`);
      const lab0 = items[2].querySelector('.ul-menu-text').getBoundingClientRect().left;
      items[2].click();
      const fr = [], t0 = now(); let labMove = 0;
      while (now() - t0 < 420) {
        await raf();
        const so = getComputedStyle(oldC.querySelector('svg')), sn = getComputedStyle(newC.querySelector('svg'));
        const sc = (m) => { const x = (m || '').match(/matrix\(([-\d.]+)/); return x ? +x[1] : 1; };
        fr.push({ t: now() - t0, oo: +so.opacity, on: +sn.opacity, so: sc(so.transform), sn: sc(sn.transform), dash: parseFloat(getComputedStyle(newC.querySelector('path')).strokeDashoffset) });
        labMove = Math.max(labMove, Math.abs(items[2].querySelector('.ul-menu-text').getBoundingClientRect().left - lab0));
      }
      const exitF = fr.filter((f) => f.oo > 0.02 && f.oo < 0.98).length, enterF = fr.filter((f) => f.on > 0.02 && f.on < 0.98 || (f.dash > 0.02 && f.dash < 0.98)).length;
      const overlap = fr.filter((f) => f.oo > 0.02 && f.oo < 0.98 && f.on > 0.02).length + fr.filter((f) => f.oo > 0.02 && f.dash < 0.98 && f.dash > 0.02).length;
      const tExit = (fr.find((f) => f.oo < 0.98) || {}).t, tEnter = (fr.find((f) => f.on > 0.02) || {}).t, minScale = Math.min(...fr.map((f) => f.sn)), maxScale = Math.max(...fr.map((f) => f.sn));
      ck('exit', 'old check exits (fade + scale → 0.7, ≈140ms) — frames sampled', exitF >= 3 && Math.min(...fr.filter((f) => f.oo > 0.02).map((f) => f.so)) < 0.95, `${exitF} exit frames · starts ${tExit && tExit.toFixed(0)}ms`);
      ck('enter', 'new check draws in (stroke + scale 0.6 → 1 with overshoot + fade) — frames sampled', enterF >= 4 && minScale < 0.8 && maxScale > 1.0, `${enterF} enter frames · scale ${minScale.toFixed(2)} → peak ${maxScale.toFixed(3)} · starts ${tEnter && tEnter.toFixed(0)}ms`);
      ck('overlap', 'handover: exit and entrance overlap (≈40ms stagger)', overlap >= 2 && tEnter > tExit, `${overlap} overlapping frames · stagger ${(tEnter - tExit).toFixed(0)}ms`);
      ck('labels', 'labels never move (check slot reserved)', labMove < 0.5, `max label shift ${labMove.toFixed(2)}px`);
      key(document.activeElement || document.body, 'Escape'); window.__mt2e.set('menu', false); await wait(600);
      return result(checks);
    }

    /* item radius = popper radius − popper padding (floor --ul-menu-item-radius-min, cap = pill); lens radius = item radius */
    async function radiusOf(open, close, itemSel, lensSel, name) {
      await open(); await wait(750);
      const s = surfaces().reverse().find((x) => x.querySelector(itemSel)); let row = null;
      if (s) {
        for (let i = 0; i < 40 && s.hasAttribute('data-ul-morphing'); i++) await wait(50);
        const cs = getComputedStyle(s), R = parseFloat(cs.getPropertyValue('--ul-glass-radius')) || parseFloat(cs.borderTopLeftRadius), P = parseFloat(getComputedStyle(s).getPropertyValue('--ul-glass-padding')) || 0, root = getComputedStyle(document.documentElement);
        const min = parseFloat(root.getPropertyValue('--ul-menu-item-radius-min')), max = parseFloat(root.getPropertyValue('--ul-menu-item-radius-max'));
        const it = s.querySelector(itemSel), ln = lensSel && s.querySelector(lensSel);
        const ir = it ? parseFloat(getComputedStyle(it).borderTopLeftRadius) : NaN, lr = ln ? parseFloat(getComputedStyle(ln).borderTopLeftRadius) : NaN;
        const want = Math.min(max, Math.max(min, R - P));
        row = { name, R, P, want, ir, lr, ok: Math.abs(ir - want) <= 0.5 && (isNaN(lr) || Math.abs(lr - ir) <= 0.5) };
      }
      await close(); await wait(600);
      return row || { name, ok: false, R: 0, P: 0, want: 0, ir: NaN, lr: NaN };
    }
    async function radiusTest() {
      const rows = [], q = (s) => document.querySelector(s), M2 = window.__mt2c;
      const clickT = (sel) => async () => { const t = q(sel); if (t) t.click(); };
      const escAll = async () => { for (let i = 0; i < 3 && surfaces().length; i++) { key(document.activeElement || document.body, 'Escape'); await wait(200); } };
      rows.push(await radiusOf(clickT('[data-case="select"] .ul-select-trigger'), escAll, '.ul-option', '.ul-listbox-lens', 'ULSelect (country list)'));
      if (M2) {
        rows.push(await radiusOf(async () => M2.set('menu', true), async () => { M2.set('menu', false); }, '.ul-menu-row', '.ul-menu-lens', 'ULMenu'));
        rows.push(await radiusOf(async () => { M2.set('menu', true); await wait(700); const it = [...document.querySelectorAll('.ul-menu-surface [data-menu-item]')].find((n) => n.dataset.text === 'Share'); it.focus(); key(it, 'ArrowRight'); }, async () => { M2.set('menu', false); }, '.ul-menu-row', '.ul-menu-lens', 'ULMenu nested submenu'));
        rows.push(await radiusOf(async () => M2.set('cmd', true), async () => M2.set('cmd', false), '.ul-menu-row', '.ul-menu-lens', 'ULCommandPalette'));
      }
      rows.push(await radiusOf(clickT('[data-case="cpx"] .ul-select-trigger'), escAll, '.ul-cp-custom', null, 'ULColorPicker (custom row)'));
      const checks = rows.map((r) => ({ key: r.name, label: `${r.name}: item = clamp(min, popper − padding, pill), lens = item`, pass: r.ok, value: `popper ${r.R}px − pad ${r.P}px → want ${r.want}px · item ${r.ir}px · lens ${isNaN(r.lr) ? 'n/a' : r.lr + 'px'}` }));
      checks.push({ key: 'sizes', label: 'three viewport sizes (1280×800, 924×540, 375×667)', pass: null, value: 'viewport-tests.dc.html' });
      return result(checks, { rows });
    }

    async function arrowTest() {
      const M2 = window.__mt2c, checks = []; if (!M2) return result([{ key: 'fx', label: '2c fixtures', pass: false, value: 'missing' }]);
      const before = Object.assign({}, UL.mapCost);
      M2.set('pop', true); await wait(900);
      const s = surfaces().find((x) => x.classList.contains('ul-popover'));
      const mode = s && UL.getGlassMode ? UL.getGlassMode(s) : '?';
      const n = UL.mapCost.nArrow - before.nArrow;
      checks.push({ key: 'gate', label: 'arrow-outline map only for overlays in the full (refract) tier', pass: mode === 'refract' ? n >= 1 : n === 0, value: `mode ${mode} · arrow maps built ${n}` });
      checks.push({ key: 'cost', label: 'map cost (generation, cached by shape key + size bucket)', pass: null, value: `arrow ${UL.mapCost.arrow.toFixed(2)}ms (max ${UL.mapCost.maxArrow.toFixed(2)}) · plain ${UL.mapCost.plain.toFixed(2)}ms` });
      const n0 = UL.mapCost.nArrow; window.dispatchEvent(new Event('resize')); await wait(200);
      checks.push({ key: 'cache', label: 'no regeneration while settled / on re-measure (cache hit)', pass: UL.mapCost.nArrow === n0, value: `${UL.mapCost.nArrow - n0} rebuilds` });
      checks.push({ key: 'limit', label: 'arrow region itself: bent rim + flat tint (backdrop-filter region is the border box; see DESIGN)', pass: null, value: 'trade-off' });
      M2.set('pop', false); await wait(600);
      return result(checks);
    }

    /* keyboard-only walkthrough: focus trigger → open with the keyboard → focus inside → Esc → focus back on the trigger */
    async function keyboardTest() {
      const q = (s) => document.querySelector(s), M2 = window.__mt2c, checks = [];
      const cases = [
        ['ULSelect', '[data-case="select"] .ul-select-trigger', 'ArrowDown'],
        ['ULDatePicker', '[data-case="date"] [aria-haspopup="dialog"]', 'ArrowDown'],
        ['ULColorPicker', '[data-case="color"] [aria-haspopup="dialog"]', 'click'],
        ['ULDateRangePicker', '[data-case="range"] .ul-range-open', 'ArrowDown'],
        ['ULColorPicker (expand)', '[data-case="cpx"] .ul-select-trigger', 'click'],
        ['ULSplitButton menu', '[data-case="split"] [aria-haspopup="menu"]', 'ArrowDown'],
        ['ULMenu (radio)', '[data-case="radio"] button', 'click'],
        ['ULModal', '[data-case="modal"] button', 'click'], ['ULSheet', '[data-case="sheet"] button', 'click'], ['ULDrawer', '[data-case="dr"] button', 'click'],
        ['ULPopover', '[data-case="pop"] button', 'click'], ['ULCommandPalette', '[data-case="cmd"] button', 'click'],
      ];
      const until = async (fn, ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await wait(50); } return fn(); };
      const noFocus = ['ULMenu (radio)', 'ULPopover']; // fixtures opened by click with initialFocus null / autoFocus false: focus stays on the trigger by design
      for (const [name, sel, how] of cases) {
        const t = q(sel); if (!t) { checks.push({ key: name, label: name, pass: null, value: 'fixture not on this page' }); continue; }
        await until(() => surfaces().length === 0, 1500);
        t.focus(); await raf();
        if (how === 'click') t.click(); else key(t, how);
        await until(() => { const s = surfaces().slice(-1)[0]; return !!s && (noFocus.includes(name) || s.contains(document.activeElement)); }, 1200);
        const s = surfaces().slice(-1)[0], inside = !!s && s.contains(document.activeElement);
        // Esc from wherever focus is (inside, or the trigger for click-opened fixtures); pickers with a custom panel need one Esc
        key(document.activeElement || document.body, 'Escape');
        const closed = await until(() => surfaces().length === 0, 1500);
        await until(() => document.activeElement === t || t.contains(document.activeElement), 400);
        const back = document.activeElement === t || t.contains(document.activeElement);
        const okInside = noFocus.includes(name) ? true : inside;
        checks.push({ key: name, label: `${name}: opens from the keyboard, ${noFocus.includes(name) ? 'focus stays on the trigger (fixture: initialFocus null)' : 'focus moves inside'}, Esc closes, focus returns`, pass: !!s && okInside && closed && back, value: `open ${!!s} · focus inside ${inside} · closed ${closed} · focus back ${back}` });
        if (M2) ['modal', 'sheet', 'dr', 'pop', 'cmd'].forEach((k) => M2.set(k, false));
        window.__mt2e && window.__mt2e.set('menu', false);
      }
      checks.push({ key: 'tab', label: 'Tab: listbox / menus close on Tab (focus moves on); dialogs trap Tab (scroll2c + dialog cards)', pass: null, value: 'by design' });
      checks.push({ key: 'native', label: 'synthetic keys cannot press native buttons (Enter / Space use .click())', pass: null, value: 'tab order inside overlays checked by the focus trap tests' });
      return result(checks);
    }

    /* blur-only (no refraction): every surface keeps blur + tint + rim + depth, never a flat grey plate */
    async function blurOnlyTest() {
      const checks = [];
      UL.configureGlass({ forceFallback: true }); await wait(400);
      const look = (el) => { if (!el) return null; const cs = getComputedStyle(el), bf = cs.backdropFilter || cs.webkitBackdropFilter || '', be = getComputedStyle(el, '::before'), af = getComputedStyle(el, '::after');
        return { blur: /blur\(/.test(bf), url: /url\(/.test(bf), tint: cs.backgroundImage !== 'none' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)', rim: be.content !== 'none' && (be.backgroundImage !== 'none' || be.boxShadow !== 'none'), depth: cs.boxShadow !== 'none', mode: UL.getGlassMode ? UL.getGlassMode(el) : '' }; };
      const fmt = (r) => r ? `${r.mode} · blur ${r.blur} · url ${r.url} · tint ${r.tint} · rim ${r.rim} · depth ${r.depth}` : 'not found';
      const okFlat = (r) => !!r && !r.url && r.tint && r.rim; // nested / in-list indicators are flattened by design (no backdrop)
      const ok = (r) => !!r && r.blur && !r.url && r.tint && r.rim;
      const tabs = document.querySelector('[data-case="tabs2e"] .ul-tabs-list .ul-glass, [data-case="tabs2e"] .ul-glass');
      checks.push({ key: 'tabs', label: 'tabs indicator (flat capsule at rest, in-list)', pass: okFlat(look(tabs)), value: fmt(look(tabs)) });
      const side = document.querySelector('[data-case="sidebar"] .ul-glass');
      checks.push({ key: 'side', label: 'sidebar surface', pass: ok(look(side)) || okFlat(look(side)), value: fmt(look(side)) });
      window.__mt2cToast && window.__mt2cToast(0); await wait(700);
      const toast = document.querySelector('.ul-toast-stack .ul-anchored');
      checks.push({ key: 'toast', label: 'toast', pass: ok(look(toast)), value: fmt(look(toast)) });
      window.__mt2cToastClear && window.__mt2cToastClear(); await wait(500);
      for (let i = 0; i < 30 && surfaces().length; i++) await wait(50);
      const rt = document.querySelector('[data-case="range"] .ul-range-open'); rt.click(); for (let i = 0; i < 30 && !surfaces().some((x) => x.classList.contains('ul-range-surface')); i++) await wait(50); await wait(300);
      const rs = surfaces().find((x) => x.classList.contains('ul-range-surface')), bead = rs && rs.querySelector('.ul-range-bead');
      checks.push({ key: 'range', label: 'date range popper', pass: ok(look(rs)), value: fmt(look(rs)) });
      checks.push({ key: 'bead', label: 'range endpoint bead (flattened)', pass: okFlat(look(bead)), value: fmt(look(bead)) });
      key(document.activeElement, 'Escape'); await wait(650);
      for (let i = 0; i < 30 && surfaces().length; i++) await wait(50);
      const ct = document.querySelector('[data-case="cpx"] .ul-select-trigger'); ct.click(); for (let i = 0; i < 30 && !surfaces().some((x) => x.classList.contains('ul-cp-surface')); i++) await wait(50); await wait(300);
      const cs2 = surfaces().find((x) => x.classList.contains('ul-cp-surface'));
      checks.push({ key: 'color', label: 'colour picker popper', pass: ok(look(cs2)), value: fmt(look(cs2)) });
      key(document.activeElement, 'Escape'); await wait(650);
      UL.configureGlass({ forceFallback: false }); await wait(300);
      return result(checks);
    }

    window.ULDemos = Object.assign(window.ULDemos || {}, { PickerFixtures, rangeTest, colorTest, checkTest, radiusTest, arrowTest, keyboardTest, blurOnlyTest });
    window.dispatchEvent(new Event('ul:demos-2e'));
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
