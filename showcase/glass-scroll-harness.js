// Glass scroll frame-invariance harness. window.ULGlassScrollTest.run({ scroller?, steps: [1, 3, 20], ms: 2000 })
// Every frame while scrolling, for every glass surface: tier (data-ul-mode), resolved --ul-accent, backdrop-filter string,
// filter id, tint, class list. Any change between frames = a violation. A MutationObserver on the filter defs and on the
// surfaces' class / data-ul-mode / --ul-glass-filter counts mutations during scroll. Frame times + long frames are reported.
(function () {
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const surfacesIn = (root) => [...(root || document).querySelectorAll('.ul-glass')].filter((el) => el.isConnected && el.getClientRects().length);
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > -innerHeight && r.top < innerHeight * 2 && r.width > 0; };
  function snap(el) {
    const cs = getComputedStyle(el);
    const bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
    const id = (bf.match(/url\("?#([^")]+)"?\)/) || [])[1] || '';
    return [el.dataset.ulMode || '', cs.getPropertyValue('--ul-accent').trim(), bf.replace(/url\([^)]*\)/, 'url()'), id, cs.getPropertyValue('--ul-glass-tint').trim(), cs.getPropertyValue('--ul-lite').trim(), el.className].join('|');
  }
  const FIELDS = ['tier', 'accent', 'backdrop-filter', 'filter id', 'tint', 'lite', 'class'];
  function diffField(a, b) { const A = a.split('|'), B = b.split('|'); for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return FIELDS[i] + ': ' + A[i] + ' → ' + B[i]; return ''; }
  async function run(o = {}) {
    const steps = o.steps || [1, 3, 20], ms = o.ms || 2000, sc = o.scroller || document.scrollingElement;
    const out = { steps: {}, mode: document.visibilityState === 'visible' ? 'live' : 'hidden (throttled: invalid)', surfaces: 0 };
    for (const step of steps) {
      sc.scrollTop = o.startTop || 0; await wait(400);
      const els = surfacesIn(o.root).filter(inView); out.surfaces = Math.max(out.surfaces, els.length);
      const last = new Map(els.map((e) => [e, snap(e)]));
      let changes = 0, mut = 0, frames = 0, long = 0, worst = 0; const ex = []; const ft = [];
      const mo = new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === 'attributes' && m.attributeName === 'style') { const el = m.target; if (!el.classList || !el.classList.contains('ul-glass')) continue; const v = el.style.getPropertyValue('--ul-glass-filter'); if (el.__gf === undefined) el.__gf = v; if (el.__gf !== v) { el.__gf = v; mut++; if (ex.length < 8) ex.push('mutation --ul-glass-filter ' + (el.className.split(' ').slice(1, 3).join('.'))); } continue; }
          mut++; if (ex.length < 8) ex.push('mutation ' + m.type + ' ' + (m.attributeName || '') + ' ' + (m.target.nodeName || ''));
        }
      });
      const defs = document.querySelector('[data-ul-glass-defs]');
      if (defs) mo.observe(defs, { subtree: true, childList: true, attributes: true });
      els.forEach((e) => { e.__gf = e.style.getPropertyValue('--ul-glass-filter'); mo.observe(e, { attributes: true, attributeFilter: ['class', 'data-ul-mode', 'style'] }); });
      const t0 = performance.now(); let tl = document.timeline.currentTime, dir = 1;
      while (performance.now() - t0 < ms) {
        const max = sc.scrollHeight - sc.clientHeight;
        if (sc.scrollTop + step > max) dir = -1; else if (sc.scrollTop - step < 0) dir = 1;
        sc.scrollTop += step * dir;
        await raf(); frames++;
        const t = document.timeline.currentTime, dt = t - tl; tl = t; ft.push(dt); if (dt > 50) long++; worst = Math.max(worst, dt);
        for (const e of els) { const s = snap(e); const p = last.get(e); if (p !== s) { changes++; if (ex.length < 8) ex.push(diffField(p, s) + ' @' + (e.className.split(' ').slice(1, 3).join('.'))); last.set(e, s); } }
      }
      await raf(); mo.disconnect();
      ft.sort((a, b) => a - b);
      out.steps[step + 'px'] = { frames, changes, mutations: mut, avg: +(ft.reduce((a, b) => a + b, 0) / Math.max(1, ft.length)).toFixed(1), p95: +(ft[Math.floor(ft.length * 0.95)] || 0).toFixed(1), worst: +worst.toFixed(1), long, examples: ex };
    }
    sc.scrollTop = o.startTop || 0;
    out.pass = Object.values(out.steps).every((s) => s.changes === 0 && s.mutations === 0);
    return out;
  }
  window.ULGlassScrollTest = { run, snap };
})();
