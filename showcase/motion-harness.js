// Dev-only automated motion test for anchored overlays (not part of the library bundle).
// Opens/closes each overlay programmatically, samples the surface rect every animation frame (rAF)
// and asserts the anchored-morph spec. Listens to the "ul:morph" events AnchoredMorph dispatches,
// so it finds the surface + anchor of ANY overlay without knowing its DOM.
//   ULMotionTest.runCase({ id, name, open(), close(), anchor?: () => Element }) → result
//   ULMotionTest.auto() → runs every visible [aria-haspopup] trigger on the page (HUD button)
(function () {
  if (window.ULMotionTest) return;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 50); }); // never hangs when rAF is throttled
  const now = () => performance.now();
  // frame clock: the document timeline time (= rAF frame time, = what WAAPI animations use). performance.now() inside a
  // late callback is up to a frame off and produced fake velocity spikes on 1-2 missed frames at 120 Hz.
  const ft = () => { const t = document.timeline && document.timeline.currentTime; return t == null ? now() : Number(t); };
  const UL = () => window.UL;
  const r2 = (v) => Math.round(v * 2) / 2;
  const rectOf = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  const inside = (p, r, pad = 0) => p[0] >= r.x - pad && p[0] <= r.x + r.w + pad && p[1] >= r.y - pad && p[1] <= r.y + r.h + pad;

  function holeOf(anchor) { return anchor.closest('[data-ul-morph-occluder]') || anchor; }

  function sample(m, t) {
    const s = m.surface, r = rectOf(s), a = rectOf(m.anchor), hole = holeOf(m.anchor), hr = rectOf(hole);
    const c = [a.x + a.w / 2, a.y + a.h / 2];
    const virt = m.anchor.hasAttribute('data-ul-virtual-anchor'); // pointer point / viewport edge / centre: nothing to keep clickable
    const at = virt ? null : document.elementFromPoint(c[0], c[1]);
    // virtual anchors have nothing clickable: under a covered (modal) surface they count as covered, otherwise as visible
    const hit = virt ? !s.hasAttribute('data-ul-covered-anchor') : (!!at && hole.contains(at) && !s.contains(at));
    const miss = hit ? null : { at: at ? (s.contains(at) ? 'surface>' : '') + at.tagName.toLowerCase() + (typeof at.className === 'string' && at.className ? '.' + at.className.split(' ')[0] : '') : 'null', clip: (getComputedStyle(s).clipPath || 'none').slice(0, 18), hole: [hr.x, hr.y, hr.w, hr.h].map(Math.round).join(','), surf: [r.x, r.y, r.w, r.h].map(Math.round).join(','), anims: s.getAnimations().length };
    // a point on the surface that is NOT over the anchor: is the surface actually painted on top there?
    let vis = null, cov = '';
    if (getComputedStyle(s).pointerEvents !== 'none' && !s.closest('[inert]')) { // a closing surface may be inert: not hit-testable, so not measurable
      for (const fx of [0.5, 0.25, 0.75]) for (const fy of [0.75, 0.5, 0.9, 0.25]) {
        const p = [r.x + r.w * fx, r.y + r.h * fy];
        if (inside(p, hr, 3) || p[0] < 1 || p[1] < 1 || p[0] > innerWidth - 1 || p[1] > innerHeight - 1) continue;
        const e = document.elementFromPoint(p[0], p[1]);
        if (!e || e === document.documentElement || e.closest('[data-ul-perf-hud],[data-ul-tier-layer]')) continue; // nothing hit-testable there at all (page inert behind a menu): not measurable
        vis = s.contains(e);
        if (!vis) cov = ((e === document.documentElement ? 'html(' + document.elementsFromPoint(p[0], p[1]).slice(0, 3).map((x) => x.tagName.toLowerCase() + (x === s ? '=surface' : '')).join('>') + ' ' + p.map(Math.round).join(',') + ' s' + [r.x, r.y, r.w, r.h].map(Math.round).join(',') + ')' : '') || (e ? (e.getAttribute('data-ul-tip') ? '[data-ul-tip]' : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') + (e.getAttribute('aria-label') ? '[' + e.getAttribute('aria-label') + ']' : '')) : 'null'));
        break;
      }
    }
    const st = m.stage ? parseFloat(getComputedStyle(m.stage).opacity) : null;
    const tf = getComputedStyle(s).transform, M = tf && tf !== 'none' ? new DOMMatrixReadOnly(tf) : null;
    const sx = M ? Math.hypot(M.a, M.b) : 1, sy = M ? Math.hypot(M.c, M.d) : 1;
    const rim = parseFloat(s.style.getPropertyValue('--ul-rim'));
    return { t, ...r, a, hit, miss, vis, cov, sx, sy, st, rim: Number.isFinite(rim) ? rim : null, mode: s.dataset.ulMode || '', clip: !!s.style.clipPath, morphing: s.hasAttribute('data-ul-morphing'), side: s.dataset.side || 'bottom', layout: s.dataset.layout || 'anchored' };
  }

  /* Two drivers. live: sample on every rAF frame (wall clock). virtual: when the tab throttles rAF
   * (background / headless preview), pause the morph's own WAAPI animations and seek them in 16.7 ms
   * steps, sampling the real rendered geometry at each step; durations come from the animation timing. */
  const DT = 1000 / 60;
  async function rafAlive() {
    const raf2 = new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
    return Promise.race([raf2, sleep(120).then(() => false)]);
  }
  function animsOf(m) {
    return document.getAnimations().filter((a) => {
      const t = a.effect && a.effect.target;
      return t && (t === m.surface || t === m.stage) && a.playState !== 'idle' && a.playState !== 'finished';
    });
  }
  const endOf = (a) => Number(a.effect.getComputedTiming().endTime) || 0;

  /** Run `action`, wait for the next morph start, sample until it ends. `schedule`: [{ at: ms after start, fn }]. */
  function capture(action, opts) {
    const { timeout = 4000, until = null, schedule = [], virtual = false } = opts || {};
    return new Promise((resolve) => {
      let m = null, t0 = 0, vt = 0, done = false, endAt = 0, startEv = null, gotEnd = null;
      const S = [], ev = [], rev = [];
      const clock = () => (virtual ? vt : ft() - t0);
      const finish = (why) => { if (done) return; done = true; document.removeEventListener('ul:morph', on, true); clearTimeout(to); resolve({ m, S, ev, rev, why, start: startEv, virtual }); };
      const on = (e) => {
        const d = e.detail || {};
        if (!d.morph) return;
        // follow the overlay across remounts (a ULAnchoredSurface unmounts after its exit): same anchor = same case
        if (m && d.morph !== m && d.morph.anchor !== m.anchor) return;
        if (m && d.morph !== m && d.state === 'start') m = d.morph;
        if (!m) {
          if (d.state !== 'start') return;
          m = d.morph; t0 = ft(); startEv = d;
          S.push(sample(m, 0)); // synchronous: the exact t=0 pose (first keyframe applied, nothing painted yet)
          if (virtual) queueMicrotask(drive); else { requestAnimationFrame(loop); schedule.forEach((s) => setTimeout(s.fn, s.at)); }
        }
        if (d.state === 'interrupted') rev.push(S.length - 1); // last sample before the reversal
        ev.push({ t: clock(), phase: d.phase, state: d.state, duration: d.duration, reduced: d.reduced });
        if (d.state === 'end' && (!until || until(d))) { endAt = now(); gotEnd && gotEnd(); }
      };
      const loop = () => {
        if (done) return;
        S.push(sample(m, ft() - t0));
        if (endAt && now() - endAt > 40) { finish('end'); return; }
        requestAnimationFrame(loop);
      };
      const drive = async () => {
        clearTimeout(to); // virtual time: the wall-clock timeout must not cut a slow (heavy page) seek loop short
        const plan = schedule.slice().sort((a, b) => a.at - b.at);
        let anims = animsOf(m), base = 0, deferred = false;
        anims.forEach((a) => a.pause());
        for (let guard = 0; guard < 2000 && !done; guard++) {
          const D = Math.max(0, ...anims.map(endOf));
          anims.forEach((a) => { a.currentTime = Math.min(vt - base, endOf(a)); });
          if (vt > 0) S.push(sample(m, vt));
          if (plan.length && vt >= plan[0].at) {
            plan.shift().fn();
            await sleep(0); await sleep(0);
            const next = animsOf(m);
            // only a NEW run (reversal) restarts the local clock; an owner that defers its call (e.g. to the next rAF) keeps the current one
            if (next.length && next.some((a) => !anims.includes(a))) { anims = next; base = vt; deferred = false; } else deferred = true;
            anims.forEach((a) => a.pause());
            continue;
          }
          if (vt - base >= D) {
            // the owner may still start a run on its next frame (deferred reopen): give it a moment, then follow it
            let next = [];
            for (let k = 0; deferred && k < 25 && !next.length; k++) { await sleep(40); next = animsOf(m).filter((a) => !anims.includes(a)); }
            if (next.length) { anims = next; base = vt; deferred = false; anims.forEach((a) => a.pause()); continue; }
            break;
          }
          vt = Math.min(vt + DT, base + D);
        }
        const ended = new Promise((r) => { gotEnd = r; if (endAt) r(); });
        anims.forEach((a) => { try { a.finish(); } catch (e) {} }); // finish(), not play(): play() at the end auto-rewinds and replays
        await Promise.race([ended, sleep(1500)]);
        await sleep(30);
        S.push(sample(m, vt + DT));
        finish(endAt ? 'end' : 'timeout');
      };
      document.addEventListener('ul:morph', on, true);
      const to = setTimeout(() => finish(m ? 'timeout' : 'no-morph'), timeout);
      action();
    });
  }

  const axisOf = (side) => (side === 'left' || side === 'right' ? 'x' : 'y');
  function t50(S, prog) {
    for (let i = 1; i < S.length; i++) { const a = prog(S[i - 1]), b = prog(S[i]); if (a < 0.5 && b >= 0.5) return S[i - 1].t + ((0.5 - a) / (b - a || 1)) * (S[i].t - S[i - 1].t); }
    return null;
  }
  /** Per-frame motion. Same-timestamp pairs (the virtual clock re-samples right after an interruption) must not move > 3px. */
  function speeds(S) {
    let maxPx = 0, maxV = 0, step = 0, worst = null;
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1], b = S[i], dt = b.t - a.t;
      if (b.w < 1 || a.w < 1) continue;
      const d = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.w - a.w), Math.abs(b.h - a.h));
      if (dt < 2) { step = Math.max(step, d); continue; }
      maxPx = Math.max(maxPx, d);
      if (d / dt > maxV) { maxV = d / dt; worst = { d, dt, t: b.t }; }
    }
    return { maxPx, maxV, step, worst };
  }
  /** Reversal: the first frames after each interruption may not move more than the expected velocity + 3px. */
  /** Reversal: the step across each interruption may not exceed the larger of the velocities just before and just after it
   * (the exit runs the timeline back at exit/enter speed, so the new run is legitimately faster) by more than 3px. A position jump fails. */
  function reversalSteps(S, rev) {
    const disp = (a, b) => Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.w - a.w), Math.abs(b.h - a.h));
    let worst = 0;
    for (const i of rev) {
      if (i < 1 || i + 2 >= S.length) continue;
      const p = S[i - 1], a = S[i], b = S[i + 1], c = S[i + 2];
      if (a.w < 1 || b.w < 1) continue;
      const dt = b.t - a.t;
      if (dt < 2) { worst = Math.max(worst, disp(a, b)); continue; } // same timestamp (virtual clock): no motion allowed
      const v0 = disp(p, a) / Math.max(1, a.t - p.t), v1 = disp(b, c) / Math.max(1, c.t - b.t);
      worst = Math.max(worst, disp(a, b) - Math.max(v0, v1) * dt);
    }
    return worst;
  }
  const ck = (key, label, pass, value) => ({ key, label, pass, value });
  const pct = (n, d) => (d ? Math.round((n / d) * 100) + '%' : 'n/a');

  async function settle(ms) { await sleep(ms); await frame(); await frame(); }
  function scrollIntoViewSoft(el) {
    if (!el) return;
    const b = el.getBoundingClientRect();
    const dy = b.top < 80 || b.bottom > innerHeight * 0.45 ? b.top - innerHeight * 0.22 : 0;
    const dx = b.left < 20 || b.right > innerWidth - 20 ? b.left + b.width / 2 - innerWidth / 2 : 0;
    if (dx || dy) window.scrollBy(dx, dy);
  }

  /** Live first; if the tab throttled rAF mid-run (a frame gap > 100 ms), rerun on the virtual clock. */
  let lock = Promise.resolve();
  /** Runs are serialised: two overlapping runs (page auto-run + HUD button) toggle the same overlays and corrupt each other. */
  function runCase(c, onStep) {
    const p = lock.then(() => runCaseLocked(c, onStep));
    lock = p.catch(() => {});
    return p;
  }
  async function runCaseLocked(c, onStep) {
    const r = await runCaseWith(c, onStep, !!window.__ulMotionVirtual);
    // rAF already throttled at the start (background tab / slow preview): the run went straight to the virtual clock.
    // A virtual PASS is never a verdict: NEEDS HEALTHY PREVIEW (a virtual FAIL stays a FAIL)
    if (r.virtual && !window.__ulMotionVirtual && r.status === 'pass') { r.status = 'n/a'; r.preview = 'NEEDS HEALTHY PREVIEW'; r.checks.unshift(ck('preview', 'NEEDS HEALTHY PREVIEW (rAF throttled at the start; virtual clock PASS, not a verdict)', null, 'virtual only')); return r; }
    // throttled tab, or a failing live run with dropped frames (> 2 frames): re-measure on the deterministic virtual clock
    if (!r.virtual && (r.maxGap > 100 || r.status !== 'pass')) {
      const v = await runCaseWith(c, onStep, true);
      v.driver = 'virtual clock (live run ' + r.status + ' with ' + Math.round(r.maxGap) + 'ms frame gap: ' + r.checks.filter((x) => x.pass === false).map((x) => x.key).join(', ') + ')';
      v.live = r;
      // a virtual PASS never turns a live FAIL into a PASS: it is a warning (re-run in a foreground tab on a real machine)
      // a live FAIL measured with a frame gap > 100 ms is not a live result (throttled tab / overloaded preview): NEEDS HEALTHY
      // PREVIEW, never FAIL and never PASS (same verdict as the frame-dependent cards); the owner reruns at >= 100 Hz
      if (r.status !== 'pass' && v.status === 'pass' && r.maxGap > 100) { v.status = 'n/a'; v.preview = 'NEEDS HEALTHY PREVIEW'; v.checks.unshift(ck('preview', 'NEEDS HEALTHY PREVIEW (live run had a ' + Math.round(r.maxGap) + ' ms frame gap; virtual clock PASS, not a verdict)', null, 'live ' + r.checks.filter((x) => x.pass === false).map((x) => x.key).join(', '))); }
      else if (r.status !== 'pass' && v.status === 'pass') { v.status = 'warn'; v.note = (v.note ? v.note + '\n' : '') + 'LIVE FAIL: ' + r.checks.filter((x) => x.pass === false).map((x) => x.key + ' = ' + x.value).join(' | ') + (r.interruptDiag ? '\n' + r.interruptDiag : ''); }
      return v;
    }
    return r;
  }
  async function runCaseWith(c, onStep, forceVirtual) {
    const res = { id: c.id, name: c.name, checks: [], chart: null, status: 'pass', note: '' };
    const step = (s) => onStep && onStep(c.id, s);
    const tok = UL().readMorphTokens(), ts = UL().getMorphTimeScale ? UL().getMorphTimeScale() : 1;
    const Tin = tok.enter * ts, Tout = tok.exit * ts;
    UL().configureMorph({ reducedMotion: 'no-preference' });
    try {
      scrollIntoViewSoft(c.anchor && c.anchor());
      await settle(120);
      const virtual = forceVirtual || !(await rafAlive());
      res.virtual = virtual;
      res.driver = virtual ? 'virtual clock (rAF throttled: seeks the WAAPI timeline in 16.7ms steps)' : 'live rAF';
      // 1. clean enter
      step('enter');
      const en = await capture(c.open, { until: (d) => d.phase === 'enter', timeout: Tin * 3 + 1500, virtual });
      if (!en.m) { res.status = 'fail'; res.note = 'no ul:morph event: the overlay does not go through AnchoredMorph'; res.checks.push(ck('morph', 'uses AnchoredMorph', false, 'no event')); c.close(); return res; }
      const surface = en.m.surface;
      await settle(160);
      const F = rectOf(surface);
      // 2. clean exit
      step('exit');
      const ex = await capture(c.close, { until: (d) => d.phase === 'exit', timeout: Tout * 3 + 1500, virtual });
      await settle(160);
      // 3. reduced motion
      step('reduced');
      UL().configureMorph({ reducedMotion: 'reduce' });
      const rd = await capture(c.open, { until: (d) => d.phase === 'enter', timeout: 2000, virtual });
      await settle(120);
      const rdF = rd.m ? rectOf(rd.m.surface) : F;
      const rdx = await capture(c.close, { until: (d) => d.phase === 'exit', timeout: 2000, virtual });
      UL().configureMorph({ reducedMotion: 'no-preference' });
      await settle(160);
      // 4. interruption: open, close at 40 %, reopen at 60 % of the enter duration
      step('interrupt');
      const it = await capture(c.open, { until: (d) => d.phase === 'enter', timeout: Tin * 4 + 2000, virtual,
        schedule: [{ at: Tin * 0.4, fn: c.close }, { at: Tin * 0.6, fn: c.open }] });
      await settle(160);
      const itF = it.m ? rectOf(it.m.surface) : { x: NaN, y: NaN, w: NaN, h: NaN };
      await capture(c.close, { until: (d) => d.phase === 'exit', timeout: Tout * 3 + 1500, virtual });
      await settle(120);

      /* ---------- analysis ---------- */
      const S = en.S, S0 = S[0], A = S0.a, side = S0.side, ax = axisOf(side);
      const t0ok = Math.abs(S0.x - A.x) <= 2 && Math.abs(S0.y - A.y) <= 2 && Math.abs(S0.w - A.w) <= 2 && Math.abs(S0.h - A.h) <= 2;
      // covered (modal) surfaces invert the layering rule: on top of the trigger from frame 0, trigger never hit-testable
      const cov = !!(en.m && en.m.surface && en.m.surface.hasAttribute('data-ul-covered-anchor'));
      res.covered = cov;
      res.checks.push(ck('t0', cov ? 't=0 rect = anchor (±2px), covering it (anchorVisibility covered)' : 't=0 rect = anchor (±2px), hidden behind it', t0ok && (cov ? !S0.hit : S0.hit),
        `Δ ${[S0.x - A.x, S0.y - A.y, S0.w - A.w, S0.h - A.h].map((v) => Math.round(v)).join('/')}${S0.hit ? '' : ' · surface over anchor'}`));
      const mid = (k, a, f) => new Set(S.map((s) => r2(s[k])).filter((v) => Math.abs(v - r2(a)) > 0.5 && Math.abs(v - r2(f)) > 0.5)).size;
      const iw = mid('w', A.w, F.w), ih = mid('h', A.h, F.h);
      res.checks.push(ck('steps', '≥5 intermediate widths and heights', iw >= 5 && ih >= 5, `w ${iw} · h ${ih}`));
      const os = Math.max(...S.map((s) => Math.max(s.w - F.w, s.h - F.h)));
      const last = S[S.length - 1];
      const settled = Math.abs(last.w - F.w) <= 1 && Math.abs(last.h - F.h) <= 1;
      res.checks.push(ck('overshoot', 'overshoot > 0, then settles', os > 0.5 && settled, `+${os.toFixed(1)}px${settled ? '' : ' · not settled'}`));
      const evS = en.ev.find((e) => e.state === 'start'), evE = en.ev.find((e) => e.state === 'end' && e.phase === 'enter');
      const dIn = virtual ? (evS ? evS.duration : NaN) : evE ? evE.t - evS.t : NaN;
      const xS = ex.ev.find((e) => e.state === 'start'), xE = ex.ev.find((e) => e.state === 'end' && e.phase === 'exit');
      const dOut = virtual ? (xS ? xS.duration : NaN) : xE && xS ? xE.t - xS.t : NaN;
      const tolIn = Math.max(Tin * 0.12, 34);
      res.checks.push(ck('dur', `enter ≈ ${Math.round(Tin)}ms`, Math.abs(dIn - Tin) <= tolIn, `${Math.round(dIn)}ms`));
      const ratio = dOut / dIn;
      res.checks.push(ck('exit', 'exit ≈ 70 % of enter', ratio >= 0.6 && ratio <= 0.8, `${Math.round(dOut)}ms · ${Number.isFinite(ratio) ? Math.round(ratio * 100) : '?'}%`));
      const tag = (X, ph) => X.map((s, i) => ({ ...s, ph, i }));
      // centred / edge layouts (modal, sheet, drawer, palette) may cover their trigger once SETTLED: the rule is "visible + clickable while the morph plays"
      const all = tag(S, 'in').concat(tag(ex.S, 'out'), tag(it.S, 'int')).filter((s) => s.layout === 'anchored' || s.morphing);
      const hits = all.filter((s) => s.hit).length;
      const misses = all.filter((s) => !s.hit);
      res.misses = misses.map((s) => `${s.ph}#${s.i} ${Math.round(s.t)}ms ${s.morphing ? 'morphing' : 'idle'} at=${s.miss && s.miss.at} clip=${s.miss && s.miss.clip} hole=${s.miss && s.miss.hole} surf=${s.miss && s.miss.surf} anims=${s.miss && s.miss.anims}`);
      if (misses.length) console.warn('[motion-test] ' + c.name + ' hit-test misses\n' + res.misses.join('\n'));
      res.checks.push(cov ? ck('hit', 'covered: trigger NEVER hit-testable (surface / scrim above it every frame: enter, exit, interruption)', hits === 0 && all.length > 0, `${hits}/${all.length} frames hit the trigger`) : ck('hit', 'anchor hit-testable every frame (enter, exit, interruption; incl. first/last frame)', hits === all.length && all.length > 0, `${hits}/${all.length}${misses.length ? ' · ' + res.misses.slice(0, 3).join(' | ') : ''}`));
      const vs = all.filter((s) => s.vis !== null), vy = vs.filter((s) => s.vis).length;
      res.checks.push(ck('visible', 'surface painted on top while in flight', vs.length ? vy / vs.length >= 0.9 : null, vs.length ? `${pct(vy, vs.length)} of ${vs.length}${vy < vs.length ? ' · under ' + [...new Set(vs.filter((s) => !s.vis).map((s) => s.cov))].slice(0, 2).join(', ') : ''}` : 'n/a (pointer-events none)'));
      const modes = new Set(S.filter((s) => s.morphing).map((s) => s.mode));
      res.checks.push(ck('tier', 'tier frozen during morph', modes.size <= 1, [...modes].join('→') || '—'));
      const rimOk = virtual ? null : S0.rim !== null ? S0.rim <= 0.05 && Math.max(...S.map((s) => s.rim ?? 1)) >= 0.95 : null;
      res.checks.push(ck('rim', 'refraction / rim ramps from 0', rimOk, virtual ? 'n/a (rim is driven per rAF; throttled)' : S0.rim !== null ? `${S0.rim.toFixed(2)} → ${Math.max(...S.map((s) => s.rim ?? 0)).toFixed(2)}` : 'n/a'));
      const stOk = S0.st !== null ? S0.st <= 0.05 : null;
      const clearT = S.find((s) => (ax === 'y' ? (side === 'bottom' ? s.y >= A.y + A.h : s.y + s.h <= A.y) : (side === 'right' ? s.x >= A.x + A.w : s.x + s.w <= A.x)));
      const stAtClear = clearT ? clearT.st : null;
      res.checks.push(ck('content', 'content fades in after clearing the anchor', stOk, S0.st !== null ? `${S0.st.toFixed(2)} at t0${stAtClear !== null && stAtClear !== undefined ? ` · ${stAtClear.toFixed(2)} at clear` : ''}` : 'n/a (no stage)'));
      // translation leads size
      const pos = (s) => (side === 'bottom' ? s.y : side === 'top' ? s.y + s.h : side === 'right' ? s.x : s.x + s.w);
      const P0 = pos(S0), PF = pos({ ...F }), sz = (s) => (ax === 'y' ? s.h : s.w), Z0 = sz(S0), ZF = sz(F);
      let lead = null;
      if (Math.abs(PF - P0) > 4 && Math.abs(ZF - Z0) > Math.max(4, ZF * 0.25)) { // near-equal sizes: the stretch bell dominates, lead is not measurable
        const a = t50(S, (s) => (pos(s) - P0) / (PF - P0)), b = t50(S, (s) => (sz(s) - Z0) / (ZF - Z0));
        if (a !== null && b !== null) lead = (b - a) / ts;
      }
      res.checks.push(ck('lead', 'translation leads size (~40–60ms)', lead === null ? null : lead >= 15 && lead <= 95, lead === null ? 'n/a' : `${Math.round(lead)}ms`));
      // reduced motion
      // reduced = uniform scale + fade: read the applied transform itself (scaleX = scaleY, never above 1)
      const rS = rd.S.concat(rdx.S).filter((s) => s.w >= 1 && s.h >= 1);
      const aspDev = Math.max(0, ...rS.map((s) => Math.abs(s.sx - s.sy)));
      const rOs = Math.max(0, ...rS.map((s) => (Math.max(s.sx, s.sy) - 1) * Math.max(s.w, s.h)));
      const rE = rd.ev.find((e) => e.state === 'end'), rSv = rd.ev.find((e) => e.state === 'start');
      const rDur = virtual ? (rSv ? rSv.duration : NaN) : rE && rSv ? rE.t - rSv.t : NaN;
      const rFlag = rSv && rSv.reduced;
      res.checks.push(ck('reduced', 'reduced motion: 150ms fade, no stretch/overshoot', !!rFlag && aspDev <= 0.012 && rOs <= 0.5 && Math.abs(rDur - 150 * ts) <= 60 * ts,
        `${Math.round(rDur)}ms · stretch ${(aspDev * 100).toFixed(1)}% · os ${Math.max(0, rOs).toFixed(1)}px`));
      // interruption
      const inFlight = (X) => X.filter((s) => s.morphing);
      const ref = speeds(inFlight(S)), refX = speeds(inFlight(ex.S)), vRef = Math.max(ref.maxV, refX.maxV);
      const iv = speeds(inFlight(it.S)), rStep = reversalSteps(it.S, it.rev || []);
      const iD = Math.max(Math.abs(itF.w - F.w), Math.abs(itF.h - F.h), Math.abs(itF.x - F.x), Math.abs(itF.y - F.y));
      const iS = it.m ? it.m.surface : null;
      for (let k = 0; iS && k < 30 && (iS.hasAttribute('data-ul-morphing') || iS.getAnimations().some((a) => a.playState === 'running' && !(typeof CSSTransition !== 'undefined' && a instanceof CSSTransition))); k++) await sleep(40); // owner may run a deferred step
      const iEnd = !!iS && !iS.hasAttribute('data-ul-morphing') && iS.getAnimations().filter((a) => a.playState === 'running' && !(typeof CSSTransition !== 'undefined' && a instanceof CSSTransition)).length === 0; // settled on its layout rect
      const evStr = (E) => E.map((e) => (e.phase === 'enter' ? 'in' : 'out') + (e.state === 'start' ? '▸' : e.state === 'end' ? '■' : '×')).join(' ');
      const phases = evStr(it.ev);
      const vLim = vRef * 1.3 + 0.15, vOk = iv.maxV <= vLim, w = iv.worst;
      res.interruptDiag = w ? `worst frame: step ${w.d.toFixed(1)}px over dt ${w.dt.toFixed(1)}ms = ${(w.d / w.dt).toFixed(3)} px/ms at ${Math.round(w.t)}ms · limit ${vLim.toFixed(3)} px/ms (clean max ${vRef.toFixed(3)} × 1.3 + 0.15)` : '';
      const sOk = iv.step <= 3 && rStep <= 3 && (it.rev || []).length >= 2, rev = it.ev.some((e) => e.state === 'interrupted');
      if (!vOk || !sOk) res.note = (res.note ? res.note + '\n' : '') + res.interruptDiag;
      res.checks.push(ck('interrupt', 'interrupt 40 % / 60 %: no jump', vOk && sOk && iEnd && rev,
        `max ${iv.maxPx.toFixed(1)}px/frame (clean ${Math.max(ref.maxPx, refX.maxPx).toFixed(1)}) · reversal excess ${Math.max(iv.step, rStep).toFixed(1)}px (≤3px beyond max(velocity before, after), ${(it.rev || []).length} reversals) · ${iEnd ? 'settled' : 'NOT settled'} (Δ${iD.toFixed(1)} vs first open) · ${phases}`));

      const gaps = (X) => X.slice(1).map((s, i) => s.t - X[i].t);
      const gE = gaps(S), gX = gaps(ex.S);
      res.maxGap = Math.max(0, ...gE, ...gX, ...gaps(it.S));
      res.checks.push(ck('pacing', 'frame pacing (first frame · worst · frames)', null, `${gE.length ? Math.round(gE[0]) : '?'}ms · ${Math.round(Math.max(0, ...gE, ...gX))}ms · ${S.length}+${ex.S.length}`));
      res.checks.push(ck('events', 'events (enter · exit)', null, `${evStr(en.ev)} · ${evStr(ex.ev)}`));
      res.chart = {
        A, F, Tin, Tout,
        enter: S.map((s) => [s.t, s.w, s.h]),
        exit: ex.S.map((s) => [s.t, s.w, s.h]),
        inter: it.S.map((s) => [s.t, s.w, s.h]),
      };
      res.side = side;
      res.status = res.checks.every((x) => x.pass !== false) ? 'pass' : 'fail';
    } catch (e) {
      res.status = 'error'; res.note = String(e && e.stack || e);
      try { c.close(); } catch (_) {}
    } finally {
      UL().configureMorph({ reducedMotion: 'auto' });
    }
    return res;
  }

  /** Path strings for a w/h-over-time chart (enter, then exit after a gap). */
  function chartPaths(ch, W = 220, H = 64) {
    if (!ch) return null;
    const segs = [ch.enter, ch.exit];
    const tEnd = ch.enter.length ? ch.enter[ch.enter.length - 1][0] : 1, tEx = ch.exit.length ? ch.exit[ch.exit.length - 1][0] : 1;
    const gap = (tEnd + tEx) * 0.06, T = tEnd + gap + tEx;
    const vmax = Math.max(1, ...segs.flat().map((p) => Math.max(p[1], p[2]))) * 1.06;
    const X = (t, k) => ((k ? tEnd + gap + t : t) / T) * W, Y = (v) => H - (v / vmax) * H;
    const line = (idx) => segs.map((S, k) => S.map((p, i) => `${i ? 'L' : 'M'}${X(p[0], k).toFixed(1)} ${Y(p[idx]).toFixed(1)}`).join('')).join('');
    return { w: line(1), h: line(2), fw: `M0 ${Y(ch.F.w).toFixed(1)}H${W}`, fh: `M0 ${Y(ch.F.h).toFixed(1)}H${W}`, split: `M${X(tEnd + gap / 2, 0).toFixed(1)} 0V${H}` };
  }

  /** HUD: test every visible popup trigger on the current page with click-to-toggle. */
  async function auto(onRow) {
    const trig = [...document.querySelectorAll('[aria-haspopup]:not([disabled]):not([aria-disabled="true"])')].filter((t) => t.getClientRects().length && !t.closest('[inert]'));
    const out = [];
    for (const [i, t] of trig.entries()) {
      const name = `${t.getAttribute('aria-haspopup')} · ${(t.getAttribute('aria-label') || t.textContent || '').trim().slice(0, 22)}`;
      const r = await runCase({ id: 'auto' + i, name, anchor: () => t, open: () => { if (t.getAttribute('aria-expanded') !== 'true') t.click(); }, close: () => { if (t.getAttribute('aria-expanded') === 'true') t.click(); } });
      out.push(r);
      onRow && onRow(r, out);
      await sleep(150);
    }
    return out;
  }

  /* NEEDS FOCUS: a card whose only failing checks depend on page focus (Esc, focus return, keyboard, tab order, press
   * timings) is neither PASS nor FAIL when the page did not have focus during the run. Other failures stay FAIL. */
  let lastBlur = -1;
  window.addEventListener('blur', () => { lastBlur = performance.now(); });
  const FOCUS_RE = /focus|refocus|\besc\b|esc\d|escape|keyboard|\bkbd\b|\bkeys?\b|tab order|press glide|glide|timing|settle|linger|return/i;
  function focusGate(r, t0) {
    if (!r || !r.checks) return r;
    const focused = document.hasFocus() && lastBlur < (t0 || 0);
    if (focused) return r;
    const fails = r.checks.filter((c) => c.pass === false);
    if (!fails.length || !fails.every((c) => FOCUS_RE.test(c.key + ' ' + c.label))) return r;
    fails.forEach((c) => { c.pass = null; c.value = 'NEEDS FOCUS · ' + (c.value ?? ''); });
    r.status = 'focus'; r.note = 'page had no focus during the run';
    return r;
  }
  function text(results) {
    return results.map((r) => `${r.status === 'pass' ? 'PASS' : 'FAIL'}  ${r.virtual ? 'v' : 'L'} ${r.name.padEnd(28).slice(0, 28)} ${r.checks.filter((c) => c.pass === false).map((c) => c.key + '(' + c.value + ')').join(' ') || ''}${r.note ? ' ' + r.note.slice(0, 80) : ''}`).join('\n');
  }

  window.ULMotionTest = { focusGate, runCase, auto, chartPaths, text, capture, sample };
  window.dispatchEvent(new Event('ul:motion-test-ready'));
})();
