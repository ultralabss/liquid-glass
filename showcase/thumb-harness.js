// Thumb / indicator motion tests: shared lens bubble (switch, slider, tabs, segmented), switch drag-to-set logic,
// slider value tooltip + follow spring, range merge/split. Per-frame (rAF) sampling of the real DOM + LensBubble.frame.
//   ULThumbTest.run(kind, el) → { id, name, checks: [{key,label,pass,value}], curves, legend, driver, status }
(function () {
  const refresh = () => (window.__ulRefreshP = window.__ulRefreshP || new Promise((res) => { const ts = []; const st = (t) => { ts.push(t); if (ts.length < 61) requestAnimationFrame(st); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b), p = d[30]; res({ period: p, hz: 1000 / p, p95Limit: 1.15 * p, fpsTarget: 0.9 * 1000 / p, healthy: 1000 / p >= 50 }); } }; requestAnimationFrame(st); })); // shared: limits relative to the measured display refresh (p95 ≤ 1.15 × period, fps ≥ 0.9 × rate)

  if (window.ULThumbTest) return;
  const UL = () => window.UL;
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ck = (key, label, pass, value) => ({ key, label, pass, value });
  const rect = (el) => el.getBoundingClientRect();
  const cx = (el) => { const b = rect(el); return [b.left + b.width / 2, b.top + b.height / 2]; };
  const ts = () => (UL().getMorphTimeScale ? UL().getMorphTimeScale() : 1);
  const num = (el, k, f) => { const v = parseFloat(getComputedStyle(el).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
  let lock = Promise.resolve();
  const serial = (fn) => { const p = lock.then(fn); lock = p.catch(() => {}); return p; };
  async function frames(n, each) { for (let i = 0; i < n; i++) { await raf(); each && (await each(i)); } }
  async function rafAlive() { const t = performance.now(); let n = 0; await Promise.race([(async () => { while (n < 6) { await raf(); n++; } })(), sleep(400)]); return n >= 6 && performance.now() - t < 300; }
  let pid = 60;
  function pe(target, type, x, y, id) { target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, pointerId: id, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y })); }
  function key(el, k, type = 'keydown') { el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true })); }
  const lensOf = (host, i = 0) => (host.__ulLenses || [])[i];
  /** One bubble sample: real rect of the wrap + the bubble's own frame values. */
  function bub(host, i = 0) {
    const L = lensOf(host, i); if (!L) return null;
    const f = L.frame, el = f.el, live = !!(f.live && el && el.style.display !== 'none');
    const b = live ? rect(el) : { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    return { t: performance.now(), live, x: b.left, y: b.top, w: b.width, h: b.height, r: f.r, g: f.g, alpha: f.alpha, k: f.k, c: f.c, tc: f.t, mode: f.mode, pe: el ? getComputedStyle(el).pointerEvents : '', z: el ? (el.hasAttribute('data-host') ? 1000 + (+getComputedStyle(el).zIndex || 0) : +getComputedStyle(el.parentElement).zIndex || 0) : 0 };
  }
  const reducedRun = async (fn) => { UL().configureMorph({ reducedMotion: 'reduce' }); try { return await fn(); } finally { UL().configureMorph({ reducedMotion: 'auto' }); } };
  async function waitIdle(host, max = 400) { for (let i = 0; i < max; i++) { const L = lensOf(host); if (!L || !L.active) return true; await raf(); } return false; }
  const clipAnc = (el) => { for (let n = el && el.parentElement; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.overflow !== 'visible' || s.clipPath !== 'none' || s.backdropFilter !== 'none' && s.backdropFilter !== '') return n.className || n.tagName; } return ''; };

  /* ---------- shared checks on a press sequence ---------- */
  function pressChecks(res, S, t0, ctl, hit) {
    const vis = S.find((s) => s && s.live && s.alpha > 0.5);
    const tVis = vis ? vis.t - t0 : Infinity;
    res.checks.push(ck('press', 'bubble visible ≤ 100ms after pointerdown, no movement', tVis <= 100 * ts() + 20, Number.isFinite(tVis) ? Math.round(tVis) + 'ms' : 'never'));
    const on = S.filter((s) => s && s.live);
    res.checks.push(ck('z', 'above the control (root layer, or above the labels in-list), pointer-events none', on.length > 0 && on.every((s) => s.pe === 'none' && s.z >= 1000), [...new Set(on.map((s) => s.pe + '/z' + s.z))].join(' ')));
    const hits = hit.filter(Boolean).length;
    res.checks.push(ck('hit', 'control hit-testable every frame', hits === hit.length && hit.length > 0, hits + '/' + hit.length));
    const f = on[0] && lensOf(ctl).frame.el;
    res.checks.push(ck('clip', 'not clipped (no clipping ancestor)', !!f && !clipAnc(f), f ? clipAnc(f) || 'root layer' : '—'));
  }

  /* ---------- switch ---------- */
  async function switchCase(btn, reduced) {
    const res = { id: reduced ? 'switch-rm' : 'switch', name: reduced ? 'ULSwitch · reduced motion' : 'ULSwitch: shape, bubble, drag', checks: [], legend: [['#8fb8ff', 'bubble width'], ['#3dff8b', 'bubble centre − target'], ['#ffd23f', 'grow g']] };
    const knob = btn.querySelector('.ul-switch-knob'), track = btn.querySelector('.ul-switch-track');
    const kb = rect(knob), tb = rect(track);
    const ratio = kb.width / kb.height, want = num(btn, '--ul-switch-thumb-ratio', 1.55);
    if (!reduced) res.checks.push(ck('ratio', `resting thumb is a capsule (w/h ≈ ${want})`, Math.abs(ratio - want) <= 0.06 && kb.width > kb.height + 4, `${kb.width.toFixed(1)}×${kb.height.toFixed(1)} = ${ratio.toFixed(2)} · track ${tb.width.toFixed(0)}×${tb.height.toFixed(0)}`));
    const S = [], hit = [];
    const smp = () => { const s = bub(btn); S.push(s); const [hx, hy] = cx(btn); const e = document.elementFromPoint(hx, hy); hit.push(!!e && btn.contains(e)); return s; };
    const id = ++pid, [x0, y0] = [kb.left + kb.width / 2, kb.top + kb.height / 2];
    const t0 = performance.now();
    pe(btn, 'pointerdown', x0, y0, id);
    await frames(Math.round(75 * ts()), smp); // the slower grow peaks at ~0.45 s
    const held = S[S.length - 1];
    // drag across: right (or left if on), stop, then back
    const dir = btn.getAttribute('aria-checked') === 'true' ? -1 : 1, span = tb.width - kb.width;
    const iMove = S.length;
    let x = x0;
    await frames(16, (i) => { smp(); x = x0 + dir * span * Math.min(1, (i + 1) / 12); pe(btn, 'pointermove', x, y0, id); });
    const iStop = S.length;
    await frames(Math.round(30 * ts()), smp);
    const iBack = S.length;
    await frames(16, (i) => { smp(); x = x0 + dir * span * (1 - Math.min(1, (i + 1) / 12)); pe(btn, 'pointermove', x, y0, id); });
    await frames(8, smp);
    const before = btn.getAttribute('aria-checked');
    pe(btn, 'pointerup', x, y0, id);
    const iUp = S.length;
    for (let i = 0; i < 400 && (S.length < iUp + 3 || (S[S.length - 1] && S[S.length - 1].live)); i++) { await raf(); smp(); }
    const after = btn.getAttribute('aria-checked');
    const on = S.filter((s) => s && s.live);
    if (!reduced) {
      // shape at hold
      const H = held || {};
      const expR = (num(btn, '--ul-selection-switch-h', 28) / 2) + (H.h - tb.height) / 2;
      res.checks.push(ck('shape', 'bubble = rounded rectangle, radius concentric with the track (±1px)', H.w > H.h + 4 && Math.abs(H.r - Math.min(expR, H.h / 2)) <= 1, `${(H.w || 0).toFixed(1)}×${(H.h || 0).toFixed(1)} r ${(H.r || 0).toFixed(1)} (exp ${Math.min(expR, (H.h || 0) / 2).toFixed(1)})`));
      const og = num(btn, '--ul-lens-overgrow-switch', 2);
      const ov = [tb.top - H.y, H.y + H.h - tb.bottom, dir > 0 ? tb.left - H.x : H.x + H.w - tb.right];
      res.checks.push(ck('overgrow', `overgrows the track ≥ ${og}px (top, bottom, resting end)`, ov.every((v) => v >= og - 0.5), ov.map((v) => v.toFixed(1)).join(' / ') + 'px'));
      const peakW = Math.max(...S.slice(0, iMove).filter(Boolean).map((s) => s.w));
      res.checks.push(ck('grow', 'grows with visible overshoot, then settles', peakW > H.w + 0.3, `peak ${peakW.toFixed(1)} → ${H.w.toFixed(1)}px`));
      // stretch side: while the target moves, the bubble centre lags behind it and the width grows
      const mv = S.slice(iMove, iStop).filter((s) => s && s.live);
      const lag = mv.filter((s) => Math.sign(s.tc - s.c) === dir).length;
      const maxW = Math.max(...mv.map((s) => s.w));
      res.checks.push(ck('stretch', 'stretches toward the travel (leading edge ahead, width grows)', lag >= mv.length * 0.6 && maxW > H.w + 1, `${lag}/${mv.length} frames lag · width ${H.w.toFixed(1)} → ${maxW.toFixed(1)}`));
      const st = S.slice(iStop, iBack).filter((s) => s && s.live), d0 = st.map((s) => s.c - s.tc);
      const crossed = d0.some((d) => Math.sign(d) === dir), settled = st.length && Math.abs(d0[d0.length - 1]) < 0.4;
      res.checks.push(ck('overshoot', 'after stopping: overshoots the target, then settles', crossed && settled, `max past ${Math.max(0, ...d0.map((d) => d * dir)).toFixed(2)}px · end ${d0.length ? d0[d0.length - 1].toFixed(2) : '?'}px`));
      const lo = tb.left, hi = tb.right, rub = kb.width;
      const out = Math.max(0, ...on.map((s) => Math.max(lo - s.x - rub, s.x + s.w - hi - rub)));
      res.checks.push(ck('bounds', 'stays within the track + rubber band', out <= 0.5, out.toFixed(1) + 'px beyond'));
      let stall = 0, run = 0;
      for (let i = iMove + 1; i < iStop; i++) { const a = S[i - 1], b = S[i]; if (!a || !b) continue; if (Math.abs(b.tc - a.tc) > 0.3 && Math.abs(b.c - a.c) < 0.02) { run++; stall = Math.max(stall, run); } else run = 0; }
      res.checks.push(ck('stall', 'no stalls longer than 2 frames while dragging', stall <= 2, stall + ' frames'));
      const tUp = S[iUp - 1] ? S[iUp - 1].t : 0, gone = S.find((s, i) => i >= iUp && (!s || !s.live));
      const lg = num(btn, '--ul-lens-release-linger', 380) * ts();
      res.checks.push(ck('linger', `release → bubble gone ≤ ${Math.round(lg)}ms (+15 %), shrink overlaps the settle`, !!gone && gone.t - tUp <= lg * 1.15, gone ? Math.round(gone.t - tUp) + 'ms' : 'never'));
    } else {
      const stretch = Math.max(0, ...on.map((s) => Math.abs(s.w - kb.width)));
      res.checks.push(ck('rm', 'reduced motion: no scale, stretch or overshoot (crossfade)', on.length > 0 && stretch <= 0.6, `width dev ${stretch.toFixed(2)}px`));
    }
    res.checks.push(ck('return', 'drag back to the start end keeps the state', before === after, `${before} → ${after}`));
    pressChecks(res, S, t0, btn, hit);
    const T0 = S.find(Boolean)?.t || 0;
    res.curves = [S.map((s) => [(s ? s.t : 0) - T0, s && s.live ? s.w : 0]), S.map((s) => [(s ? s.t : 0) - T0, s && s.live ? (s.c - s.tc) * 4 + 20 : 20]), S.map((s) => [(s ? s.t : 0) - T0, s && s.live ? s.g * 30 : 0])];
    return res;
  }

  async function switchLogicCase(btn, log) {
    const res = { id: 'switch-logic', name: 'ULSwitch: release logic + semantics', checks: [], legend: [] };
    const track = btn.querySelector('.ul-switch-track'), knob = btn.querySelector('.ul-switch-knob');
    const state = () => btn.getAttribute('aria-checked') === 'true';
    const setOff = async () => { if (state()) { btn.click(); await waitIdle(btn); await sleep(80); } };
    const run = async (label, fn, expect, expectEvents) => {
      await setOff(); await waitIdle(btn);
      const n0 = log.length, ariaSeq = [];
      const mo = new MutationObserver(() => ariaSeq.push(btn.getAttribute('aria-checked')));
      mo.observe(btn, { attributes: true, attributeFilter: ['aria-checked'] });
      const midDrag = await fn();
      await frames(3); mo.disconnect();
      const ev = log.length - n0, got = state();
      res.checks.push(ck(label, label, got === expect && ev === expectEvents && (midDrag === undefined || midDrag === false), `→ ${got ? 'on' : 'off'} · ${ev} change event(s)${midDrag ? ' · aria changed during drag' : ''}`));
      await waitIdle(btn);
    };
    const tb = () => rect(track), kc = () => cx(knob);
    const drag = async (to, n = 14, release = 'up', fast = false) => {
      const id = ++pid, [x0, y] = kc(), t = tb(), span = t.width - rect(knob).width;
      pe(btn, 'pointerdown', x0, y, id); await frames(3);
      let changed = false; const a0 = btn.getAttribute('aria-checked');
      let x = x0;
      for (let i = 1; i <= n; i++) { x = x0 + span * to * (i / n); pe(btn, 'pointermove', x, y, id); await raf(); if (btn.getAttribute('aria-checked') !== a0) changed = true; }
      if (!fast) await frames(4);
      if (release === 'esc') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      else if (release === 'cancel') pe(btn, 'pointercancel', x, y, id);
      else pe(btn, 'pointerup', x, y, id);
      if (release !== 'up') pe(btn, 'pointerup', x, y, id);
      return changed;
    };
    await run('release left of the midpoint = off', () => drag(0.4), false, 0);
    await run('release right of the midpoint = on (1 change)', () => drag(0.75), true, 1);
    await run('flick across the midpoint = on', () => drag(0.42, 3, 'up', true), true, 1);
    await run('click without movement toggles', async () => { const id = ++pid, [x, y] = kc(); pe(btn, 'pointerdown', x, y, id); await frames(4); pe(btn, 'pointerup', x, y, id); btn.click(); }, true, 1);
    await run('drag back to the start end keeps the state', async () => { const id = ++pid, [x0, y] = kc(), span = tb().width - rect(knob).width; pe(btn, 'pointerdown', x0, y, id); let x = x0; for (let i = 1; i <= 10; i++) { x = x0 + span * 0.8 * (i / 10); pe(btn, 'pointermove', x, y, id); await raf(); } for (let i = 1; i <= 10; i++) { x = x0 + span * 0.8 * (1 - i / 10); pe(btn, 'pointermove', x, y, id); await raf(); } pe(btn, 'pointerup', x, y, id); }, false, 0);
    await run('Esc while held restores', () => drag(0.8, 14, 'esc'), false, 0);
    await run('pointercancel restores', () => drag(0.8, 14, 'cancel'), false, 0);
    await run('Space toggles', async () => { btn.focus(); key(btn, ' '); await frames(6); key(btn, ' ', 'keyup'); btn.click(); }, true, 1);
    await setOff();
    return res;
  }

  /* ---------- slider ---------- */
  function tipSample(root, i) {
    const pos = root.querySelectorAll('.ul-slider-pos')[i], thumb = pos.querySelector('.ul-slider-thumb');
    const tip = pos.querySelector('.ul-slider-tip'), arrow = tip.querySelector('.ul-slider-tip-arrow'), body = tip.querySelector('.ul-slider-tip-body');
    const vert = root.getAttribute('data-orientation') === 'vertical', shown = tip.hasAttribute('data-show');
    const [tx, ty] = cx(thumb), [ax, ay] = cx(arrow);
    return { t: performance.now(), shown, off: shown ? (vert ? Math.abs(ay - ty) : Math.abs(ax - tx)) : null, th: vert ? ty : tx, text: body.textContent, bw: body.offsetWidth };
  }
  async function sliderCase(root) {
    const res = { id: 'slider', name: 'ULSlider: tooltip + follow spring', checks: [], legend: [['#ff5a8a', 'tooltip − thumb (px ×10)'], ['#8fb8ff', 'thumb'], ['#ffd23f', 'ideal follow']] };
    const track = root.querySelector('.ul-slider-track'), thumb = root.querySelector('.ul-slider-thumb');
    const tb = () => rect(track), at = (f) => { const b = tb(); return [b.left + b.width * f, b.top + b.height / 2]; };
    const T = num(root, '--ul-slider-follow', 75) / 1000 * ts(), w = 5 / T;
    const all = [];
    // 1. drag at constant speed: thumb vs ideal critically damped follow of the pointer
    const id = ++pid; let [x, y] = at(0.2);
    const D = []; let ideal = null, iv = 0, lastT = 0;
    pe(track, 'pointerdown', x, y, id);
    await frames(Math.round(30 * ts())); // let the press glide settle, then follow a constant-speed drag
    ideal = cx(thumb)[0]; lastT = document.timeline.currentTime; // frame clock (same clock as the slider's rAF timestamp)
    for (let i = 0; i < 60; i++) {
      await raf();
      const now = document.timeline.currentTime, dt = (now - lastT) / 1000; lastT = now;
      const s = tipSample(root, 0);
      // advance the ideal follow toward the pointer target of the previous frame
      const n = Math.max(1, Math.ceil(dt / 0.004)); for (let k = 0; k < n; k++) { const h = dt / n, a = -w * w * (ideal - x) - 2 * w * iv; iv += a * h; ideal += iv * h; }
      D.push({ ...s, ideal, px: x });
      [x] = at(0.2 + 0.6 * Math.min(1, (i + 1) / 50)); pe(track, 'pointermove', x, y, id);
    }
    pe(track, 'pointerup', x, y, id);
    await frames(10, () => D.push({ ...tipSample(root, 0), ideal: null, px: x }));
    all.push(...D);
    let stall = 0, run = 0, dev = 0;
    for (let i = 6; i < 60; i++) { const a = D[i - 1], b = D[i]; if (Math.abs(b.px - a.px) > 0.3 && Math.abs(b.th - a.th) < 0.02) { run++; stall = Math.max(stall, run); } else run = 0; const c = D[i + 1]; if (b.ideal !== null && a.ideal !== null) dev = Math.max(dev, Math.min(Math.abs(b.th - b.ideal), Math.abs(b.th - a.ideal), c && c.ideal !== null ? Math.abs(b.th - c.ideal) : Infinity)); } // frame-aligned: the harness rAF may run before or after the slider's in the same frame
    // 2. keyboard
    thumb.focus();
    const K = [];
    for (const k of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'PageDown', 'Home', 'End', 'PageDown']) { key(thumb, k); await frames(4, () => K.push(tipSample(root, 0))); }
    await frames(20, () => K.push(tipSample(root, 0)));
    all.push(...K);
    // 3. click-to-jump
    const J = []; const id2 = ++pid; [x, y] = at(0.1);
    pe(track, 'pointerdown', x, y, id2); await raf(); pe(track, 'pointerup', x, y, id2);
    await frames(30, () => J.push(tipSample(root, 0)));
    all.push(...J);
    const worst = (S) => Math.max(0, ...S.filter((s) => s.off !== null).map((s) => s.off)), n = (S) => S.filter((s) => s.off !== null).length;
    for (const [k, S] of [['drag', D], ['keyboard', K], ['click-to-jump', J]]) res.checks.push(ck('off-' + k, `${k}: tooltip centre = thumb centre (≤1px) every frame`, n(S) > 5 && worst(S) <= 1, `max ${worst(S).toFixed(2)}px over ${n(S)} frames`));
    res.checks.push(ck('stall', 'drag: no stalls longer than 2 frames', stall <= 2, stall + ' frames'));
    res.checks.push(ck('follow', 'drag: deviation from the ideal follow path ≤ 1.5px (frame-aligned)', dev <= 1.5, dev.toFixed(2) + 'px'));
    const moves = new Set(J.map((s) => Math.round(s.th))).size;
    res.checks.push(ck('glide', 'click-to-jump glides on the follow spring', moves >= 4, moves + ' positions'));
    const tab = D.filter((s) => s.shown).every((s, i, A) => i === 0 || Math.abs(s.bw - A[i - 1].bw) <= 0.5 || s.text.length !== A[i - 1].text.length);
    res.checks.push(ck('tabular', 'value text keeps its width (tabular numbers)', tab, tab ? 'stable' : 'jitter'));
    if (window.__ulPerf && window.__ulPerf.dragBench) {
      const b = await window.__ulPerf.dragBench(root);
      const R = await refresh();
      if (b) res.checks.push(ck('bench', `drag bench: stalls ≤ 2 frames, p95 ≤ 1.15 × refresh period (${R.period.toFixed(1)} ms → ${R.p95Limit.toFixed(1)} ms)`, R.healthy ? b.maxStall <= 2 && b.p95 <= R.p95Limit : null, `p95 ${b.p95}ms · ${b.fps} fps · stalls ${b.stalls} (max ${b.maxStall}) · disc ${b.disc}px · long ${b.long}${R.healthy ? '' : ' · NEEDS HEALTHY PREVIEW (' + R.hz.toFixed(0) + ' Hz)'}`));
    }
    const T0 = all[0] ? all[0].t : 0, L = tb().left;
    res.curves = [all.map((s) => [s.t - T0, s.off === null ? 0 : s.off * 10]), all.map((s) => [s.t - T0, s.th - L]), D.filter((s) => s.ideal !== null).map((s) => [s.t - T0, s.ideal - L])];
    return res;
  }
  async function rangeCase(root) {
    const res = { id: 'range', name: 'ULRangeSlider merge / split', checks: [], legend: [['#3dff8b', 'visible tooltip span left'], ['#8fb8ff', 'right'], ['#ffd23f', 'merged']] };
    const thumbs = root.querySelectorAll('.ul-slider-thumb'), t1 = thumbs[1], track = root.querySelector('.ul-slider-track');
    const span = () => {
      const vis = [...root.querySelectorAll('.ul-slider-tip[data-show] > .ul-slider-tip-body')].filter((b) => parseFloat(getComputedStyle(b).opacity) > 0.5);
      if (!vis.length) return null;
      const R = vis.map(rect), sc = vis.map((b) => getComputedStyle(b.parentElement).scale).join(',');
      return { l: Math.min(...R.map((r) => r.left)), r: Math.max(...R.map((r) => r.right)), m: root.hasAttribute('data-tips-merged'), th: cx(t1)[0], t: performance.now(), sc };
    };
    const S = [], grab = () => { const s = span(); s && S.push(s); };
    const id = ++pid, [x1, y] = cx(t1), x0 = cx(thumbs[0])[0];
    pe(track, 'pointerdown', x1, y, id);
    let x = x1;
    await frames(40, (i) => { grab(); x = x1 + (x0 + 6 - x1) * Math.min(1, (i + 1) / 34); pe(track, 'pointermove', x, y, id); });
    await frames(40, (i) => { grab(); x = x0 + 6 + (x1 - x0 - 6) * Math.min(1, (i + 1) / 34); pe(track, 'pointermove', x, y, id); });
    pe(track, 'pointerup', x, y, id);
    await frames(12, grab);
    const settledTip = (s) => s.sc.split(',').every((v) => v === 'none' || v === '1');
    let jump = 0, flips = 0;
    for (let i = 1; i < S.length; i++) { const a = S[i - 1], b = S[i]; if (a.m !== b.m) flips++; if (!settledTip(a) || !settledTip(b)) continue; jump = Math.max(jump, Math.max(Math.abs(b.l - a.l), Math.abs(b.r - a.r)) - Math.abs(b.th - a.th)); }
    res.checks.push(ck('merge', 'merges and splits again', flips >= 2, `${flips} transitions`));
    res.checks.push(ck('nojump', 'visible tooltip span never jumps (≤3px beyond thumb motion)', S.length > 10 && jump <= 3, `max ${jump.toFixed(1)}px · ${S.length} frames`));
    const T0 = S.length ? S[0].t : 0, L = rect(root).left;
    res.curves = [S.map((s) => [s.t - T0, s.l - L]), S.map((s) => [s.t - T0, s.r - L]), S.map((s) => [s.t - T0, s.m ? 60 : 0])];
    return res;
  }

  /* ---------- tabs / segmented ---------- */
  async function tabsCase(list, reduced, name) {
    const res = { id: (name || 'tabs') + (reduced ? '-rm' : ''), name: (name === 'seg' ? 'ULSegmentedControl' : 'ULTabs') + (reduced ? ' · reduced motion' : ': hold, drag, release'), checks: [], legend: [['#8fb8ff', 'bubble centre'], ['#ffd23f', 'pointer'], ['#3dff8b', 'width']] };
    const items = () => [...list.querySelectorAll('[data-ul-lens-item]:not(:disabled)')];
    const selAttr = list.querySelector('[aria-selected]') ? 'aria-selected' : 'aria-checked';
    const selIdx = () => items().findIndex((e) => e.getAttribute(selAttr) === 'true');
    const lb = rect(list);
    const S = [], hit = [], P = [];
    const smp = (px) => { S.push(bub(list)); P.push(px); const [hx, hy] = cx(list); const e = document.elementFromPoint(hx, hy); hit.push(!!e && list.contains(e)); };
    // reset to the first item
    if (selIdx() !== 0) { items()[0].click(); await waitIdle(list); await sleep(60); }
    const it0 = items()[0], [x0, y] = cx(it0);
    const id = ++pid, t0 = performance.now();
    let changedDuring = false;
    pe(it0, 'pointerdown', x0, y, id);
    await frames(Math.round(20 * ts()), () => smp(x0));
    const iMove = S.length;
    const lastI = items().length - 1, xEnd = cx(items()[lastI])[0];
    let x = x0;
    const s0 = selIdx();
    await frames(30, (i) => { smp(x); x = x0 + (xEnd + 60 - x0) * Math.min(1, (i + 1) / 24); pe(list, 'pointermove', x, y, id); if (selIdx() !== s0) changedDuring = true; });
    // back to the second-to-last item and release there
    const xBack = cx(items()[lastI - 1])[0];
    await frames(16, (i) => { smp(x); x = xEnd + 60 + (xBack - xEnd - 60) * Math.min(1, (i + 1) / 12); pe(list, 'pointermove', x, y, id); if (selIdx() !== s0) changedDuring = true; });
    await frames(6, () => smp(x));
    pe(list, 'pointerup', x, y, id);
    for (let i = 0; i < 300 && (S[S.length - 1] && S[S.length - 1].live); i++) { await raf(); smp(x); }
    const on = S.filter((s) => s && s.live);
    pressChecks(res, S, t0, list, hit);
    const rub = rect(items()[0]).width;
    const out = Math.max(0, ...on.map((s) => Math.max(lb.left - s.x - rub, s.x + s.w - lb.right - rub)));
    res.checks.push(ck('bounds', 'never leaves the wrapper by more than the rubber band', out <= 0.5, out.toFixed(1) + 'px beyond'));
    const follows = S.slice(iMove).filter((s) => s && s.live);
    res.checks.push(ck('follow', 'bubble follows the pointer while held', follows.length > 10 && Math.max(...follows.map((s) => s.c)) - Math.min(...follows.map((s) => s.c)) > rect(items()[0]).width, `${follows.length} frames`));
    res.checks.push(ck('release', 'release selects the nearest item', selIdx() === lastI - 1, `selected #${selIdx()} (exp #${lastI - 1})`));
    res.checks.push(ck('aria', `${selAttr} changes only on release`, !changedDuring, changedDuring ? 'changed during drag' : 'only on release'));
    if (reduced) {
      const H = on.length ? Math.max(...on.map((s) => s.h)) : 0, base = rect(items()[0]).height;
      res.checks.push(ck('rm', 'reduced motion: no growth or stretch', on.length > 0 && Math.abs(H - base) <= 0.8, `height ${H.toFixed(1)} vs ${base.toFixed(1)}`));
    }
    // click, Esc, keyboard
    items()[0].click(); await waitIdle(list); await sleep(60);
    res.checks.push(ck('click', 'single click selects', selIdx() === 0, '#' + selIdx()));
    const id2 = ++pid, [xa, ya] = cx(items()[0]);
    pe(items()[0], 'pointerdown', xa, ya, id2); await frames(3);
    for (let i = 1; i <= 10; i++) { pe(list, 'pointermove', xa + (xEnd - xa) * i / 10, ya, id2); await raf(); }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    pe(list, 'pointerup', xEnd, ya, id2);
    await waitIdle(list);
    res.checks.push(ck('esc', 'Esc while held cancels', selIdx() === 0, '#' + selIdx()));
    items()[0].focus(); key(items()[0], 'ArrowRight'); await frames(4);
    res.checks.push(ck('keys', 'keyboard: ArrowRight selects the next item', selIdx() === 1, '#' + selIdx()));
    await waitIdle(list);
    const T0 = S.find(Boolean)?.t || 0;
    res.curves = [S.map((s) => [(s ? s.t : 0) - T0, s && s.live ? s.x + s.w / 2 - lb.left : 0]), P.map((p, i) => [((S[i] && S[i].t) || 0) - T0, p - lb.left]), S.map((s) => [(s ? s.t : 0) - T0, s && s.live ? s.w : 0])];
    return res;
  }

  /* ---------- timing (switch click / key, slider grow + shrink) ---------- */
  async function timingCase(btn, slider) {
    const res = { id: 'timing', name: 'Timings: switch toggle, grow, shrink', checks: [], legend: [['#ffd23f', 'switch grow g (click)'], ['#8fb8ff', 'switch g (Space)'], ['#3dff8b', 'slider g']] };
    const T = num(btn, '--ul-switch-toggle-duration', 560) * ts(), Gd = num(btn, '--ul-lens-grow-duration', 570) * ts(), Sd = num(btn, '--ul-lens-shrink-duration', 480) * ts();
    const runToggle = async (how) => {
      await waitIdle(btn);
      const S = [], t0 = performance.now(), [x, y] = cx(btn.querySelector('.ul-switch-knob')), id = ++pid;
      if (how === 'click') { pe(btn, 'pointerdown', x, y, id); await raf(); pe(btn, 'pointerup', x, y, id); btn.click(); }
      else { btn.focus(); key(btn, ' '); await raf(); key(btn, ' ', 'keyup'); btn.click(); }
      for (let i = 0; i < 600; i++) { await raf(); const s = bub(btn); S.push(s); if (!s || !s.live) break; }
      const total = performance.now() - t0, gs = S.filter((s) => s && s.live);
      // settle hold: frames at full size with the centre on target before the shrink
      let hold = 0; for (const s of gs) if (s.g > 0.97 && Math.abs(s.c - s.tc) < 0.5) hold += 16.7;
      return { total, S, hold, peak: Math.max(0, ...gs.map((s) => s.g)) };
    };
    const LG = num(btn, '--ul-lens-release-linger', 380) * ts(), ST = num(btn, '--ul-lens-settle-duration', 420) * ts();
    const knobRun = async (how) => {
      await waitIdle(btn); await sleep(200);
      const kn = btn.querySelector('.ul-switch-knob'), dot = btn.querySelector('.ul-thumb-knob'), x0 = cx(kn)[0], id = ++pid, [x, y] = cx(kn);
      const P = [];
      if (how === 'click') { pe(btn, 'pointerdown', x, y, id); await raf(); pe(btn, 'pointerup', x, y, id); btn.click(); } else { btn.focus(); key(btn, ' '); await raf(); key(btn, ' ', 'keyup'); btn.click(); }
      const tr = performance.now();
      for (let i = 0; i < 160; i++) { await raf(); const s = bub(btn); P.push({ t: performance.now() - tr, x: cx(kn)[0], live: !!(s && s.live), a: s && s.live ? s.alpha : 0, ko: parseFloat(getComputedStyle(dot).opacity) }); }
      const xf = P[P.length - 1].x, dir = Math.sign(xf - x0);
      const gone = P.find((p) => !p.live), lastOff = [...P].reverse().find((p) => Math.abs(p.x - xf) > 0.3);
      return { gone: gone ? gone.t : Infinity, settle: lastOff ? lastOff.t : 0, over: Math.max(0, ...P.map((p) => (p.x - xf) * dir)), edge: Math.min(...P.map((p) => p.a + p.ko)), P };
    };
    const c = await knobRun('click'), k = await knobRun('key');
    res.checks.push(ck('linger', `click: release → bubble gone ≤ ${Math.round(LG)}ms (+15 %)`, c.gone <= LG * 1.15, Math.round(c.gone) + 'ms'));
    res.checks.push(ck('key', 'Space: about 70 % of the click', k.gone <= LG * 0.7 * 1.2 && k.gone < c.gone, Math.round(k.gone) + 'ms'));
    res.checks.push(ck('settle', `knob settle ≈ ${Math.round(ST)}ms ±15 % (before: ≈ 170ms toggle travel)`, Math.abs(c.settle - ST) <= ST * 0.15, Math.round(c.settle) + 'ms'));
    res.checks.push(ck('overshoot', 'settle overshoots then rebounds', c.over > 0.3, '+' + c.over.toFixed(2) + 'px'));
    res.checks.push(ck('edge', 'no double edge (bubble + knob opacity never both low)', c.edge >= 0.85 && k.edge >= 0.85, c.edge.toFixed(2) + ' · ' + k.edge.toFixed(2)));
    // press-and-hold: full grow and shrink durations (switch + slider)
    const growShrink = async (host, target) => {
      await waitIdle(host);
      const id = ++pid, [x, y] = cx(target), S = [];
      const t0 = performance.now();
      pe(target, 'pointerdown', x, y, id);
      let tg = null, enter = null; for (let i = 0; i < 160; i++) { await raf(); const s = bub(host); S.push(s); const inB = s && Math.abs(s.g - 1) < 0.02; if (inB && enter === null) enter = performance.now() - t0; if (!inB) enter = null; } tg = enter; // settled = LAST entry into ±2 % (a rising pass through the band is not a settle)
      // release without a state change (switch: pointercancel restores), then time until the LAST entry into |g| < 2 % (or hidden)
      if (host.classList.contains('ul-switch')) pe(target, 'pointercancel', x, y, id); else pe(target, 'pointerup', x, y, id);
      const t1 = performance.now(); let tsr = null, ent = null;
      for (let i = 0; i < 200; i++) { await raf(); const s = bub(host); S.push(s); const inB = !s || !s.live || Math.abs(s.g) < 0.02; if (inB && ent === null) ent = performance.now() - t1; if (!inB) ent = null; if (!s || !s.live) break; }
      tsr = ent;
      return { tg, tsr, S };
    };
    const sw = await growShrink(btn, btn.querySelector('.ul-switch-knob'));
    const sl = await growShrink(slider.querySelector('.ul-slider-track'), slider.querySelector('.ul-slider-thumb'));
    const near = (v, want, tol = 0.35) => v !== null && Math.abs(v - want) <= want * tol;
    res.checks.push(ck('grow', `grow settles ≈ ${Math.round(Gd)}ms ±15 % (switch · slider), slower than the shrink`, near(sw.tg, Gd, 0.15) && near(sl.tg, Gd, 0.15) && sw.tg > sw.tsr, `${Math.round(sw.tg)} · ${Math.round(sl.tg)}ms`));
    res.checks.push(ck('shrink', `switch gone ≤ linger · slider shrink unchanged ≈ ${Math.round(Sd + 60 * ts())}ms`, sw.tsr <= num(btn, '--ul-lens-release-linger', 380) * ts() * 1.15 && near(sl.tsr, Sd + 60 * ts(), 0.15), `${Math.round(sw.tsr)} · ${Math.round(sl.tsr)}ms`));
    const T0 = (S) => (S.find(Boolean) || { t: 0 }).t;
    res.curves = [c.P.map((p) => [p.t, p.a * 40]), c.P.map((p) => [p.t, 20 + (p.x - c.P[c.P.length - 1].x)]), sl.S.map((s) => [(s ? s.t : 0) - T0(sl.S), s ? s.g * 40 : 0])];
    res.legend = [['#ffd23f', 'switch bubble opacity (click)'], ['#8fb8ff', 'knob − final (px)'], ['#3dff8b', 'slider g (unchanged)']];
    if (btn.getAttribute('aria-checked') === 'true') { btn.click(); await waitIdle(btn); }
    return res;
  }

  /* ---------- tabs: one indicator, no teleport, follow ---------- */
  async function oneCase(list, name) {
    const res = { id: name + '-one', name: (name === 'seg' ? 'ULSegmentedControl' : 'ULTabs') + ': one indicator, glide, follow', checks: [], legend: [['#8fb8ff', 'indicator centre'], ['#ffd23f', 'pointer / target']] };
    const items = () => [...list.querySelectorAll('[data-ul-lens-item]:not(:disabled)')];
    const selAttr = list.querySelector('[aria-selected]') ? 'aria-selected' : 'aria-checked';
    const ind = () => [...list.querySelectorAll('.ul-lens-wrap, .ul-tabs-ind, .ul-seg-lens')].filter((e) => getComputedStyle(e).display !== 'none' && parseFloat(getComputedStyle(e).opacity) > 0.05);
    const layerN = () => [...document.querySelectorAll('[data-ul-lens-layer] .ul-lens-wrap')].filter((w) => w.style.display === 'block' && rect(w).width && (() => { const b = rect(w), l = rect(list); return b.right > l.left && b.left < l.right && b.bottom > l.top && b.top < l.bottom; })()).length;
    if (items()[0].getAttribute(selAttr) !== 'true') { items()[0].click(); await waitIdle(list); await sleep(80); }
    const node0 = ind()[0];
    const counts = [], nodes = new Set(), S = [];
    const lb = rect(list), W = lb.width; const modes = new Set();
    const smp = (p) => { const I = ind(); counts.push(I.length + layerN()); I.forEach((n) => nodes.add(n)); const b = I[0] ? rect(I[0]) : null; S.push({ t: performance.now(), c: b ? b.left + b.width / 2 - lb.left : NaN, p: p - lb.left, sel: list.querySelectorAll('[' + selAttr + '="true"]')[0] }); };
    // 1. click / keyboard move
    items()[2].click();
    for (let i = 0; i < 120; i++) { await raf(); smp(cx(items()[2])[0]); if (i > 10 && !lensOf(list).active) break; }
    // 2. press-and-hold on a far tab: glide, no teleport
    await waitIdle(list);
    const far = items()[0], [fx, fy] = cx(far), id = ++pid;
    const g0 = S.length, tPress = performance.now();
    pe(far, 'pointerdown', fx, fy, id);
    const target = fx - lb.left;
    let reach = null;
    for (let i = 0; i < 150; i++) { await raf(); smp(fx); const L = lensOf(list); if (L && L.active) modes.add(L.frame.mode); const s = S[S.length - 1]; if (reach === null && Math.abs(s.c - target) < 2) reach = performance.now() - tPress; if (reach !== null && i > 20) break; }
    const glide = S.slice(g0);
    let jump = 0; for (let i = 1; i < glide.length; i++) jump = Math.max(jump, Math.abs(glide[i].c - glide[i - 1].c));
    // 3. while held: follow the pointer (lag) — move to the middle at constant speed
    const xm = lb.left + W * 0.6, f0 = S.length;
    for (let i = 1; i <= 30; i++) { const x = fx + (xm - fx) * (i / 30); pe(list, 'pointermove', x, fy, id); await raf(); smp(x); }
    await frames(60, () => smp(xm));
    const fol = S.slice(f0), lagEnd = Math.abs(fol[fol.length - 1].c - (xm - lb.left));
    const midLag = Math.max(...fol.slice(0, 30).map((s) => Math.abs(s.c - s.p)));
    const selDuring = items().findIndex((e) => e.getAttribute(selAttr) === 'true');
    pe(list, 'pointerup', xm, fy, id);
    const tUp = performance.now(); let gone = null;
    for (let i = 0; i < 120; i++) { await raf(); smp(xm); const L = lensOf(list); if (gone === null && L && (!L.active || L.frame.g < 0.02)) gone = performance.now() - tUp; }
    await waitIdle(list); await frames(4, () => smp(xm));
    const LGt = num(list, '--ul-lens-release-linger', 380) * ts();
    res.checks.push(ck('linger', `release → bubble gone ≤ ${Math.round(LGt)}ms (+15 %)`, gone !== null && gone <= LGt * 1.15, gone === null ? 'never' : Math.round(gone) + 'ms'));
    const node1 = ind()[0];
    res.checks.push(ck('one', 'exactly 1 visible indicator per list on every frame (list + bubble layer)', counts.every((n) => n === 1), `${counts.filter((n) => n === 1).length}/${counts.length} frames · max ${Math.max(...counts)}`));
    res.checks.push(ck('same', 'same DOM node before, during and after', nodes.size === 1 && node0 === node1, `${nodes.size} node(s)`));
    res.checks.push(ck('teleport', 'press on a far tab: no teleport (max step < 2.5 % of width)', jump < W * 0.025, `max ${jump.toFixed(1)}px (limit ${(W * 0.025).toFixed(1)})`));
    res.checks.push(ck('glide', 'press glide takes ≥ 250ms', reach === null || reach >= 250 * ts(), reach === null ? '> 1 s' : Math.round(reach) + 'ms'));
    res.checks.push(ck('follow', 'while held: follow spring (lags, then catches up ≤ 1.5px)', midLag > 2 && lagEnd <= 1.5, `lag ${midLag.toFixed(1)}px · end ${lagEnd.toFixed(2)}px`));
    res.checks.push(ck('sel', 'selection changes only on release', selDuring === 2, `#${selDuring} while held`));
    if (name === 'seg') {
      const bf = getComputedStyle(list).backdropFilter;
      const flatWell = (!bf || bf === 'none') && !list.classList.contains('ul-glass'), refr = modes.has('refract');
      // the well part is display-independent; 'bubble refracts' needs refraction: on a fallback tier (lite / flat, no SVG filter) skip it with a note
      res.checks.push(ck('well', 'segmented is a non-glass well (bubble refracts the labels)', !flatWell ? false : refr ? true : null, `well backdrop-filter ${bf || 'none'} · bubble mode while active: ${[...modes].join('/') || '—'}${flatWell && !refr ? ' · skipped: tier is fallback (refraction unavailable here), the well itself is flat' : ''}`));
    }
    const T0 = S[0] ? S[0].t : 0;
    res.curves = [S.map((s) => [s.t - T0, s.c || 0]), S.map((s) => [s.t - T0, s.p])];
    items()[0].click(); await waitIdle(list);
    return res;
  }

  function finalize(res, alive) {
    res.driver = alive ? 'live rAF' : 'rAF throttled (background / hidden tab): rerun in a foreground tab';
    if (!alive) res.checks.forEach((c) => { if (c.pass === false) c.pass = null; });
    res.status = res.checks.every((c) => c.pass !== false) ? (alive ? 'pass' : 'n/a') : 'fail';
    return res;
  }
  function run(kind, el, extra) {
    return serial(async () => {
      const alive = await rafAlive();
      let r;
      try {
        if (kind === 'switch') r = await switchCase(el, false);
        else if (kind === 'switch-rm') r = await reducedRun(() => switchCase(el, true));
        else if (kind === 'switch-logic') r = await switchLogicCase(el, extra);
        else if (kind === 'slider') r = await sliderCase(el);
        else if (kind === 'range') r = await rangeCase(el);
        else if (kind === 'tabs') r = await tabsCase(el, false, 'tabs');
        else if (kind === 'tabs-rm') r = await reducedRun(() => tabsCase(el, true, 'tabs'));
        else if (kind === 'seg') r = await tabsCase(el, false, 'seg');
        else if (kind === 'timing') r = await timingCase(el, extra);
        else if (kind === 'tabs-one') r = await oneCase(el, 'tabs');
        else if (kind === 'seg-one') r = await oneCase(el, 'seg');
      } catch (e) { return { id: kind, name: kind, checks: [], status: 'error', note: String((e && e.stack) || e), driver: '' }; }
      await sleep(150);
      return finalize(r, alive);
    });
  }
  function paths(curves, W = 240, H = 70) {
    const pts = curves.flat();
    if (!pts.length) return [];
    const tMax = Math.max(1, ...pts.map((p) => p[0])), vMax = Math.max(1, ...pts.map((p) => p[1])), vMin = Math.min(0, ...pts.map((p) => p[1]));
    return curves.map((c) => c.map((p, i) => `${i ? 'L' : 'M'}${((p[0] / tMax) * W).toFixed(1)} ${(H - ((p[1] - vMin) / (vMax - vMin || 1)) * H).toFixed(1)}`).join(''));
  }
  window.ULThumbTest = { run, paths };
})();
