// Overlay scroll-behavior test (AnchoredMorph scrollBehavior / onAnchorHidden + page scroll lock). Per frame, live rAF.
//   ULScrollTest.run({ menuTrigger }) → { id, name, checks, curves, legend, driver, status }
(function () {
  if (window.ULScrollTest) return;
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ck = (key, label, pass, value) => ({ key, label, pass, value });
  const R = (el) => el.getBoundingClientRect();
  function mk(tag, css, parent = document.body, text = '') { const e = document.createElement(tag); e.style.cssText = css; if (text) e.textContent = text; parent.appendChild(e); return e; }
  const SURF = 'position:fixed;left:0;top:0;width:180px;height:70px;border-radius:14px;background:#1d2230;color:#fff;font:13px system-ui;display:grid;place-items:center;box-shadow:0 0 0 1px #fff3;z-index:1001;visibility:hidden';
  // gap between anchor and surface along the placement side (handles flips)
  const gap = (a, s, side) => { const A = R(a), S = R(s); return side === 'top' ? A.top - S.bottom : side === 'bottom' ? S.top - A.bottom : side === 'left' ? A.left - S.right : S.left - A.right; };
  const cross = (a, s) => { const A = R(a), S = R(s); return (S.left + S.width / 2) - (A.left + A.width / 2); };

  async function open(anchor, label, opts) {
    const s = mk('div', SURF, document.body, label);
    const m = new window.UL.AnchoredMorph({ anchor, surface: s }, { side: 'bottom', align: 'center', ...opts });
    await m.enter();
    return { s, m };
  }
  async function run(o = {}) {
    const UL = window.UL;
    const res = { id: 'scroll', name: 'Overlay scroll behavior', checks: [], legend: [['#8fb8ff', 'popover gap drift ×10'], ['#ffd23f', 'tooltip gap drift ×10'], ['#3dff8b', 'fixed surface y']] };
    const alive = await Promise.race([(async () => { const t = performance.now(); for (let i = 0; i < 6; i++) await raf(); return performance.now() - t < 300; })(), sleep(500).then(() => false)]);
    const y0 = scrollY;
    const host = mk('div', 'position:relative;height:2600px;padding-top:40px');
    const btn = (label, css = '') => mk('button', 'display:block;margin:0 0 0 120px;min-height:40px;padding:0 16px;' + css, host, label);
    const spacer = mk('div', 'height:0px', host);
    const aPop = btn('popover anchor'), aTip = btn('tooltip anchor', 'margin-top:12px'), aFix = btn('fixed anchor', 'margin-top:12px');
    const nest = mk('div', 'margin:40px 0 0 120px;width:360px;height:220px;overflow:auto;border:1px solid #fff3', host);
    const nIn = mk('div', 'height:900px;padding-top:60px', nest);
    const aNest = mk('button', 'display:block;margin-left:40px;min-height:40px', nIn, 'nested anchor');
    try {
      window.scrollTo(0, R(host).top + scrollY - 60);
      await raf(); await raf();
      const pop = await open(aPop, 'popover · follow', { scrollBehavior: 'follow' });
      const tip = await open(aTip, 'tooltip · follow + hide', { scrollBehavior: 'follow', onAnchorHidden: 'hide' });
      const fix = await open(aFix, 'fixed', { scrollBehavior: 'fixed' });
      const g0 = { p: gap(aPop, pop.s, pop.m.side), t: gap(aTip, tip.s, tip.m.side) }, fy0 = R(fix.s).top;
      const S = [];
      let maxP = 0, maxT = 0, maxX = 0, fixMove = 0, flips = 0, lastSide = pop.m.side;
      for (let i = 0; i < 60; i++) {
        window.scrollBy(0, 10);
        await raf();
        const sp = pop.m.side; if (sp !== lastSide) { flips++; lastSide = sp; }
        const gp = gap(aPop, pop.s, sp), gt = gap(aTip, tip.s, tip.m.side);
        const dp = Math.abs(gp - (sp === pop.m.side ? g0.p : gp)), dt = tip.m.followFrame.hidden ? 0 : Math.abs(gt - g0.t);
        maxP = Math.max(maxP, Math.abs(gp - g0.p)); maxT = Math.max(maxT, dt); maxX = Math.max(maxX, Math.abs(cross(aPop, pop.s)));
        fixMove = Math.max(fixMove, Math.abs(R(fix.s).top - fy0));
        S.push({ t: i, p: gp - g0.p, tt: dt, fy: R(fix.s).top });
      }
      res.checks.push(ck('follow', 'popover follows its anchor in the same frame (gap drift ≤ 1px, 600px / 60 frames)', maxP <= 1 && maxX <= 1, `gap ${maxP.toFixed(2)}px · cross ${maxX.toFixed(2)}px · flips ${flips}`));
      const tipHidden = tip.m.followFrame.hidden, tipOp = parseFloat(getComputedStyle(tip.s).opacity);
      res.checks.push(ck('tip', 'tooltip follows (≤ 1px) and hides when its anchor leaves the view', maxT <= 1 && (R(aTip).bottom > 0 || (tipHidden && tipOp < 0.05)), `drift ${maxT.toFixed(2)}px · anchor ${R(aTip).bottom > 0 ? 'visible' : 'hidden'} · opacity ${tipOp.toFixed(2)}`));
      res.checks.push(ck('fixed', 'fixed overlay does not move', fixMove <= 0.5, fixMove.toFixed(2) + 'px'));
      // flip: scroll the popover anchor to the bottom edge, the surface must flip to the top and stay attached
      window.scrollTo(0, R(aPop).top + scrollY - innerHeight + 50); await raf(); await raf();
      const fs = pop.m.side, fg = gap(aPop, pop.s, fs);
      res.checks.push(ck('flip', 'flips to the side with room and stays attached', fs === 'top' && Math.abs(fg - g0.p) <= 1, `side ${fs} · gap ${fg.toFixed(2)} (exp ${g0.p.toFixed(2)})`));
      // layout shift moves the anchor
      window.scrollTo(0, R(host).top + scrollY - 60); await raf(); await raf();
      spacer.style.height = '40px'; await raf();
      res.checks.push(ck('layout', 'anchor moved by layout: still attached next frame', Math.abs(gap(aPop, pop.s, pop.m.side) - g0.p) <= 1, gap(aPop, pop.s, pop.m.side).toFixed(2) + 'px'));
      // nested scroll container
      nest.scrollIntoView ? null : null;
      window.scrollTo(0, R(nest).top + scrollY - 80); await raf();
      const nst = await open(aNest, 'nested · follow', { scrollBehavior: 'follow' });
      const ng0 = gap(aNest, nst.s, nst.m.side); let nMax = 0;
      for (let i = 0; i < 20; i++) { nest.scrollTop += 4; await raf(); nMax = Math.max(nMax, Math.abs(gap(aNest, nst.s, nst.m.side) - ng0)); }
      res.checks.push(ck('nested', 'nested scroll container: follows (≤ 1px)', nMax <= 1, nMax.toFixed(2) + 'px'));
      await Promise.all([pop.m.exit(), tip.m.exit(), fix.m.exit(), nst.m.exit()]);
      [pop, tip, fix, nst].forEach((x) => { x.m.destroy(); x.s.remove(); });
      // reduced motion: instant follow, same result
      UL.configureMorph({ reducedMotion: 'reduce' });
      try {
        window.scrollTo(0, R(host).top + scrollY - 60); await raf();
        const rp = await open(aPop, 'reduced', { scrollBehavior: 'follow' }); const rg = gap(aPop, rp.s, rp.m.side); let rMax = 0;
        for (let i = 0; i < 20; i++) { window.scrollBy(0, 10); await raf(); rMax = Math.max(rMax, Math.abs(gap(aPop, rp.s, rp.m.side) - rg)); }
        res.checks.push(ck('reduced', 'reduced motion: follows instantly (≤ 1px)', rMax <= 1, rMax.toFixed(2) + 'px'));
        await rp.m.exit(); rp.m.destroy(); rp.s.remove();
      } finally { UL.configureMorph({ reducedMotion: 'auto' }); }
      // scroll lock with a real menu (ULSelect)
      const trig = o.menuTrigger && o.menuTrigger();
      if (trig) {
        window.scrollTo(0, R(trig).top + scrollY - 160); await raf(); await raf();
        const sy = scrollY, probe = R(trig);
        trig.click(); await sleep(700);
        const locked = UL.isPageScrollLocked();
        const ev = (e) => { document.body.dispatchEvent(e); return e.defaultPrevented; };
        const wheel = ev(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
        const keys = ['PageDown', 'End', ' ', 'ArrowDown'].map((k) => ev(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })));
        let touch = null;
        try { document.body.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch({ identifier: 1, target: document.body, clientX: 10, clientY: 300 })] })); touch = ev(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [new Touch({ identifier: 1, target: document.body, clientX: 10, clientY: 200 })] })); } catch (e) { touch = null; }
        const bar = getComputedStyle(document.documentElement).overflow === 'hidden';
        const shift = Math.abs(R(trig).left - probe.left) + Math.abs(R(trig).top - probe.top);
        const list = document.querySelector('.ul-listbox');
        const inner = list ? !ev(Object.defineProperty(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }), 'target', { value: list.firstElementChild || list })) || list.scrollHeight <= list.clientHeight : null;
        trig.click(); await sleep(600);
        res.checks.push(ck('lock', 'menu locks page scroll: wheel, touch, keys (PageDown, End, Space, ArrowDown), scrollbar', locked && wheel && keys.every(Boolean) && touch !== false && bar, `wheel ${wheel} · keys ${keys.map((k) => (k ? '✓' : '✗')).join('')} · touch ${touch === null ? 'n/a' : touch} · scrollbar hidden ${bar}`));
        res.checks.push(ck('shift', 'no layout shift on lock / unlock', shift <= 0.5 && Math.abs(R(trig).left - probe.left) <= 0.5, shift.toFixed(2) + 'px'));
        res.checks.push(ck('restore', 'scroll position restored exactly, lock released', scrollY === sy && !UL.isPageScrollLocked(), `${sy} → ${scrollY}`));
        res.checks.push(ck('inner', 'scrolling inside the menu still works', inner !== false, inner === null ? 'n/a (no list)' : String(inner)));
      }
      res.curves = [S.map((s) => [s.t, 20 + s.p * 10]), S.map((s) => [s.t, 20 + s.tt * 10]), S.map((s) => [s.t, s.fy])];
    } catch (e) { res.note = String((e && e.stack) || e); res.status = 'error'; }
    finally { host.remove(); window.scrollTo(0, y0); }
    res.driver = alive ? 'live rAF' : 'rAF throttled: rerun in a foreground tab';
    if (!res.status) res.status = res.checks.every((c) => c.pass !== false) ? 'pass' : 'fail';
    return res;
  }
  window.ULScrollTest = { run };
})();
