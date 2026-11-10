// Motion-test cards: coalesced toggles, hold fill, success ripple (Part 1). Live rAF clock; uses ULDemos.__stage.
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ck = (checks) => (key, label, pass, value) => checks.push({ key, label, pass, value });
    const result = (checks) => ({ status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'live rAF' });
    const stage = (...a) => window.ULDemos.__stage(...a);
    const liveEl = () => document.querySelector('[data-ul-action-live]');
    const tok = (k, f) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
    // contrast helpers (canvas-resolved colours, alpha composited over a dark backdrop)
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const parse = (col) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = col; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 }; };
    const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
    const lum = (q) => { const l = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * l(q.r) + 0.7152 * l(q.g) + 0.0722 * l(q.b); };
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const layers = (el) => { const cs = getComputedStyle(el); const imgs = cs.backgroundImage.match(/(rgba?|oklab|oklch|color)\([^()]*(\([^()]*\)[^()]*)*\)/g) || []; return [parse(cs.backgroundColor)].concat(imgs.map(parse)); };
    const baseOf = (btn) => { let b = { r: 0.1, g: 0.1, b: 0.14, a: 1 }; const pr = document.createElement('span'); pr.style.cssText = 'position:absolute;width:1px;height:1px;background:var(--ul-glass-backing)'; btn.appendChild(pr); b = over(parse(getComputedStyle(pr).backgroundColor), b); pr.remove(); layers(btn).forEach((l) => { b = over(l, b); }); return b; };

    /* ---------- coalesced toggle spam ---------- */
    async function toggleSpamTest() {
      const checks = [], c = ck(checks); let calls = [], inflight = 0, maxPar = 0, mode = 'ok', D = null, unmount = null;
      const onChange = (v) => { calls.push(v); inflight++; maxPar = Math.max(maxPar, inflight); return new Promise((res, rej) => { D = { res: () => { inflight--; res(); }, rej: () => { inflight--; rej(new Error('x')); } }; if (mode === 'auto') setTimeout(() => D.res(), 30); if (mode === 'autofail') setTimeout(() => D.rej(), 30); }); };
      function Fix() { const [on, setOn] = React.useState(true); unmount = setOn; return on ? h(UL.ULToggleIconButton, { 'data-t': 'g', kind: 'star', label: 'Star', onPressedChange: onChange, debounceMs: 300, maxWaitMs: 1500 }) : h('span', null, 'gone'); }
      const S = await stage(() => h(Fix), 360);
      const B = () => S.box.querySelector('[data-t="g"]');
      const spam = async (n, gap) => { for (let i = 0; i < n; i++) { B().click(); if (gap) await wait(gap); } };
      mode = 'auto';
      // aria-pressed instant + only the final state announced
      let announces = 0; const mo = new MutationObserver(() => { if (liveEl() && liveEl().textContent) announces++; }); liveEl() && mo.observe(liveEl(), { childList: true, characterData: true, subtree: true });
      const before = B().getAttribute('aria-pressed'); B().click(); await Promise.resolve(); await Promise.resolve(); const instant = B().getAttribute('aria-pressed'); // same task (React flushes discrete updates in a microtask), no debounce wait
      // icon morph under 20 clicks / s: never stacked animations
      let stacked = 0; const t0 = performance.now(); let k = 0;
      while (performance.now() - t0 < 600) { if (performance.now() - t0 > k * 50) { B().click(); k++; } await raf(); const n = B().querySelector('.ul-tg-icon').getAnimations().length; if (n > 1) stacked++; }
      await wait(600);
      c('instant', 'aria-pressed flips at once (same task as the click, no debounce, optimistic)', before === 'false' && instant === 'true', before + ' → ' + instant);
      c('morph', 'icon morph at 20 clicks / s: one animation at a time (restarts from the current frame)', stacked === 0, stacked + ' stacked frames over ' + k + ' clicks');
      const final1 = B().getAttribute('aria-pressed') === 'true';
      c('spam1', `1 + ${k} clicks → onChange exactly once with the final value (or not at all when it equals the committed one)`, calls.length === (final1 ? 1 : 0) && (!final1 || calls[0] === true), calls.length + ' call(s) ' + JSON.stringify(calls));
      await wait(200); c('announce', 'only the final state is announced, once', announces <= 1, announces + ' announcement(s)');
      mo.disconnect();
      calls = []; const st0 = B().getAttribute('aria-pressed');
      await spam(51, 11); await wait(500);
      c('fifty', '51 clicks within 600ms → one call with the final value', calls.length === 1 && String(calls[0]) === B().getAttribute('aria-pressed') && B().getAttribute('aria-pressed') !== st0, calls.length + ' call(s) ' + JSON.stringify(calls));
      calls = []; await spam(50, 11); await wait(500);
      c('even', 'an even number of clicks (50) → zero calls', calls.length === 0, calls.length + ' call(s)');
      // in flight: clicks while the request runs → exactly ONE follow-up, never parallel
      mode = 'manual'; calls = []; maxPar = 0;
      const v0 = B().getAttribute('aria-pressed') === 'true';
      B().click(); await wait(380); const started = calls.length === 1;
      B().click(); B().click(); B().click(); await wait(380); const during = calls.length; // visible != sent, but no parallel call
      D.res(); await wait(60); const follow = calls.length; D && D.res(); await wait(60);
      c('inflight', 'click during an in-flight request: one follow-up after it settles, never two in parallel', started && during === 1 && follow === 2 && maxPar === 1, 'started ' + started + ' · during ' + during + ' · after settle ' + follow + ' · max parallel ' + maxPar);
      // rejection rolls back + error
      mode = 'autofail'; const vb = B().getAttribute('aria-pressed'); B().click(); await wait(420);
      c('rollback', 'rejection: rolls back to the committed value, error state + "Couldn\'t change"', B().getAttribute('aria-pressed') === vb && B().dataset.status === 'error' && /Couldn.t change/.test((liveEl() || {}).textContent || ''), vb + ' → ' + B().getAttribute('aria-pressed') + ' · ' + B().dataset.status);
      await wait(3100);
      // max wait commits a long burst
      mode = 'auto'; calls = []; const tb = performance.now(); let firstAt = 0;
      while (performance.now() - tb < 2600) { B().click(); await wait(180); if (calls.length && !firstAt) firstAt = performance.now() - tb; }
      c('maxwait', 'a burst longer than maxWait (1500ms) commits at the max wait', firstAt > 1300 && firstAt < 2000, 'first commit at ' + Math.round(firstAt) + 'ms of a 2600ms burst');
      await wait(500);
      // pagehide flush
      calls = []; B().click(); window.dispatchEvent(new Event('pagehide')); await wait(30);
      c('pagehide', 'pagehide commits the pending value at once', calls.length === 1, calls.length + ' call(s) right after pagehide');
      await wait(200);
      // key auto-repeat ignored
      const ev = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }); B().dispatchEvent(ev);
      c('repeat', 'key auto-repeat ignored (only the first keydown counts)', ev.defaultPrevented, 'repeat keydown prevented ' + ev.defaultPrevented);
      // unmount flush
      calls = []; B().click(); unmount(false); await wait(40);
      c('unmount', 'unmount commits the pending value (never dropped)', calls.length === 1, calls.length + ' call(s)');
      await S.done(); return result(checks);
    }

    /* ---------- hold fill across the whole button ---------- */
    async function holdFillTest() {
      const checks = [], c = ck(checks); let ran = 0; const H = 600;
      const S = await stage(() => h('div', { style: { display: 'flex', gap: '10px' } }, h(UL.ULConfirmAction, { 'data-t': 'h', confirm: 'hold', holdMs: H, label: 'Hold to delete project', minLoadingMs: 200, onConfirm: () => { ran++; return new Promise((r) => setTimeout(r, 300)); } })), 480);
      const B = S.box.querySelector('[data-t="h"]'), fx = B.querySelector('.ul-btn-fx'), F = B.querySelector('.ul-act-holdfill');
      const down = () => B.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 3 })), up = () => B.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3 }));
      let rectBad = 0, originBad = 0, nonMono = 0, nonLin = 0, last = -1, n = 0, t0 = 0;
      down();
      while (true) {
        await raf(); const t = performance.now(); if (!t0) t0 = t; n++;
        const br = B.getBoundingClientRect(), xr = fx.getBoundingClientRect(), fr = F.getBoundingClientRect();
        if (Math.abs(xr.left - br.left) > 0.5 || Math.abs(xr.right - br.right) > 0.5 || Math.abs(xr.top - br.top) > 0.5 || Math.abs(xr.bottom - br.bottom) > 0.5 || Math.abs(F.offsetWidth - B.offsetWidth) > 0.5) rectBad++;
        const p = fr.width / br.width; if (p > 0.001 && Math.abs(fr.left - br.left) > 0.5) originBad++;
        if (p + 1e-3 < last) nonMono++; last = p;
        if (p > 0.02 && p < 0.98 && Math.abs(p - (t - t0) / H) > 0.12) nonLin++;
        if (ran || t - t0 > H + 400) break;
      }
      up(); await wait(60);
      c('rect', 'fill layer = the whole button (inset 0, clipped) every frame (±0.5px)', rectBad === 0, rectBad + ' bad of ' + n + ' frames');
      c('origin', 'scaleX from the left edge', originBad === 0, originBad + ' frames off the left edge');
      c('linear', 'progress monotonic and linear in time (frame clock)', nonMono === 0 && nonLin <= 1, 'non-monotonic ' + nonMono + ' · off the time line ' + nonLin);
      c('once', 'completion runs the action exactly once; pressing again while it runs is ignored', ran === 1, 'ran ' + ran);
      down(); await wait(150); up(); await wait(60); const ranAfter = ran;
      await wait(600);
      down(); await wait(H * 0.5); const mid = F.getBoundingClientRect().width / B.getBoundingClientRect().width; up(); await wait(tok('--ul-action-hold-release-ms', 160) + 80);
      const back = F.getBoundingClientRect().width / B.getBoundingClientRect().width;
      c('release', 'release before completion reverses to 0 (~160ms)', mid > 0.3 && back < 0.02 && ran === ranAfter, 'at release ' + mid.toFixed(2) + ' → ' + back.toFixed(3));
      // contrast at 0 / 25 / 50 / 75 / 100 % (label pixels are over the fill or over the base)
      const lab = B.querySelector('.ul-act-text'), ink = parse(getComputedStyle(lab).color), base = baseOf(B), fill = over(parse(getComputedStyle(F).backgroundColor), base);
      const cb = cr(over(ink, base), base), cf = cr(over(ink, fill), fill);
      const at = [0, 0.25, 0.5, 0.75, 1].map((p) => (p === 0 ? cb : p === 1 ? cf : Math.min(cb, cf)));
      c('contrast', 'label ≥ 4.5:1 at 0 / 25 / 50 / 75 / 100 % progress', at.every((x) => x >= 4.5), at.map((x, i) => [0, 25, 50, 75, 100][i] + '% ' + x.toFixed(2)).join(' · '));
      await S.done(); return result(checks);
    }

    /* ---------- success wave (circular) ---------- */
    async function rippleTest() {
      const checks = [], c = ck(checks);
      const S = await stage(() => h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
        h(UL.ULPublishButton, { 'data-t': 'p', onPublish: () => {}, minLoadingMs: 0, widthMode: 'reserve', successDuration: 4000 }), h('span', { 'data-t': 'n' }, 'neighbour'),
        h(UL.ULActionButton, { 'data-t': 'sq', iconOnly: true, 'aria-label': 'ok', successEffect: 'ripple', icons: { idle: h(UL.ULIcon, { name: 'check' }) }, onAction: () => {}, minLoadingMs: 0 }),
        h('div', { style: { width: '100%' } }, h(UL.ULActionButton, { 'data-t': 'fw', fullWidth: true, labels: { idle: 'Save all changes' }, onAction: () => {}, minLoadingMs: 0 }))), 520);
      const B = (t) => S.box.querySelector('[data-t="' + t + '"]');
      const P = B('p'), N = B('n'), host = P.querySelector('.ul-act-ripple'), fx = P.querySelector('.ul-btn-fx');
      const nx = N.getBoundingClientRect().left;
      P.click(); const fr = []; const t0 = performance.now(); let wave = null;
      while (performance.now() - t0 < 1200) { await raf(); wave = host.querySelector('.ul-wave'); if (!wave) { fr.push(null); continue; } const cs = getComputedStyle(wave);
        fr.push({ t: performance.now() - t0, r: parseFloat(cs.getPropertyValue('--ul-wave-r')), r2: parseFloat(cs.getPropertyValue('--ul-wave-r2')), r3: parseFloat(cs.getPropertyValue('--ul-wave-r3')), wx: parseFloat(cs.getPropertyValue('--wx')), wy: parseFloat(cs.getPropertyValue('--wy')), band: parseFloat(cs.getPropertyValue('--ul-wave-band')), max: parseFloat(cs.getPropertyValue('--ul-wave-max')), op: +cs.opacity, w: P.offsetWidth, h: P.offsetHeight, bg: cs.backgroundImage }); }
      const F = fr.filter(Boolean);
      const f0 = F[0];
      c('centre', 'starts at the centre (±1px)', !!f0 && Math.abs(f0.wx - f0.w / 2) <= 1 && Math.abs(f0.wy - f0.h / 2) <= 1, f0 ? 'origin ' + f0.wx + ',' + f0.wy + ' of ' + f0.w + '×' + f0.h : 'no wave');
      let mono = true; for (let i = 1; i < F.length; i++) if (F[i].r + 0.01 < F[i - 1].r) mono = false;
      c('grow', 'radius grows monotonically', mono && F.length > 10, F.length + ' frames · r ' + (F[0] || {}).r + ' → ' + Math.max(...F.map((f) => f.r)).toFixed(1));
      const peak = F.reduce((a, f) => (f.r > a.r ? f : a), F[0] || { r: 0 });
      const far = Math.hypot(peak.w / 2, peak.h / 2);
      // coverage: every corner + the centre lie inside the filled disc (r - feather ≥ distance); the gradient interior is opaque tone there
      const inside = [[0, 0], [peak.w, 0], [0, peak.h], [peak.w, peak.h], [peak.w / 2, peak.h / 2]].every(([x, y]) => Math.hypot(x - peak.wx, y - peak.wy) <= peak.r);
      c('cover', 'peak radius reaches the farthest corner (+ feather): the wave covers the whole button', inside && peak.r >= far, 'peak ' + peak.r.toFixed(1) + ' · farthest corner ' + far.toFixed(1));
      const rad = getComputedStyle(fx).borderTopLeftRadius === getComputedStyle(P).borderTopLeftRadius && getComputedStyle(fx).overflow === 'hidden' && getComputedStyle(P).overflow !== 'visible' || getComputedStyle(fx).overflow === 'hidden';
      c('clip', 'clipped to the button radius (fx wrapper, overflow hidden, outside the refracted layer)', rad && !P.querySelector('.ul-glass .ul-wave'), getComputedStyle(fx).borderTopLeftRadius);
      const bands = new Set(F.map((f) => f.band.toFixed(1)));
      c('ring', 'ring thickness constant (fixed px band, no scale distortion)', bands.size === 1, 'band ' + [...bands].join(',') + 'px');
      const mid = F.find((f) => f.t > 250);
      const trail = !!mid && mid.r2 < mid.r && mid.r3 < mid.r2 && /radial-gradient[\s\S]*radial-gradient[\s\S]*radial-gradient/.test(mid.bg);
      c('trail', 'two trailing wavelets behind the front (90 / 180ms), weaker', trail, mid ? 'r ' + mid.r.toFixed(1) + ' · r2 ' + mid.r2.toFixed(1) + ' · r3 ' + mid.r3.toFixed(1) : '');
      c('shift', 'no layout shift of neighbours', Math.abs(N.getBoundingClientRect().left - nx) < 0.5, 'Δ ' + (N.getBoundingClientRect().left - nx).toFixed(2));
      await wait(200);
      c('clean', 'no leftover layers (wave count back to 0)', host.querySelectorAll('.ul-wave').length === 0, host.querySelectorAll('.ul-wave').length + ' waves');
      // square icon + full-width: covers too
      for (const t of ['sq', 'fw']) { const X = B(t); X.click(); let mx = 0, mxD = 0; const tt = performance.now(); while (performance.now() - tt < 900) { await raf(); const wv = X.querySelector('.ul-wave'); if (wv) { const cs = getComputedStyle(wv); mx = Math.max(mx, parseFloat(cs.getPropertyValue('--ul-wave-r'))); } } mxD = Math.hypot(X.offsetWidth / 2, X.offsetHeight / 2);
        c('cover-' + t, (t === 'sq' ? 'square icon button' : 'full-width button') + ': wave reaches the farthest corner', mx >= mxD, mx.toFixed(1) + ' ≥ ' + mxD.toFixed(1)); }
      // contrast: label over the brightest front (full tone) and after
      const ink = parse(getComputedStyle(P.querySelector('.ul-act-text')).color), base = baseOf(P);
      const tone = parse(getComputedStyle(P).getPropertyValue('--ul-wave-tone').trim() || getComputedStyle(document.documentElement).getPropertyValue('--ul-success-soft').trim()), peakBg = over(tone, base);
      const cp = cr(over(ink, peakBg), peakBg), ca = cr(over(ink, base), base);
      c('contrast', 'label ≥ 4.5:1 over the wave front at full tone and after', cp >= 4.5 && ca >= 4.5, 'peak ' + cp.toFixed(2) + ' · after ' + ca.toFixed(2));
      // restart: a second success mid-wave → one wave element at a time
      await wait(4200); P.click(); await wait(150); let maxW = 0; P.click(); for (let i = 0; i < 20; i++) { await raf(); maxW = Math.max(maxW, host.querySelectorAll('.ul-wave').length); } await wait(1200);
      c('restart', 'restart is clean (≤ 1 wave at a time, none left)', maxW <= 1 && host.querySelectorAll('.ul-wave').length === 0, 'max ' + maxW);
      UL.configureMorph({ reducedMotion: 'reduce' }); await wait(4200);
      P.click(); await raf(); await raf(); const wv = host.querySelector('.ul-wave'); const ra = wv ? wv.getAnimations() : []; const dur = ra.length ? ra[0].effect.getTiming().duration : 0;
      UL.configureMorph({ reducedMotion: 'auto' });
      c('reduced', 'reduced motion: no wave, a 120ms tone fade', !!wv && wv.hasAttribute('data-reduced') && ra.length === 1 && dur <= 130, (wv ? 'fade ' + dur + 'ms' : 'none'));
      await wait(300); await S.done(); return result(checks);
    }

    window.ULDemos = Object.assign(window.ULDemos || {}, { toggleSpamTest, holdFillTest, rippleTest });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
