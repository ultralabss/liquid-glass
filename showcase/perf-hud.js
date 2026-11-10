// Dev-only perf HUD for the showcase. Toggle: Shift+P (or ?perf in the URL). Shift+T outlines every glass surface by tier (green full, yellow lite, pink flat, blue fallback). Not part of the library bundle.
// Measures fps, frame time p95, JS time per frame (rAF callbacks), pointer-light writes/s, glass + backdrop-filter counts.
// bench(label) runs idle / scroll / pointer scenarios (4 s each) and stores the result in localStorage "ul-perf-results".
(function () {
  if (window.__ulPerf) return;
  const P = (window.__ulPerf = { on: false, light: 0, js: 0 });
  const HUD_SRC = (document.currentScript && document.currentScript.src) || new URL('./perf-hud.js', location.href).href;
  const raf0 = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return raf0(function (t) { const s = performance.now(); try { cb(t); } finally { P.js += performance.now() - s; } });
  };
  const sp = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (n, v, p) { if (n === '--ul-light') P.light++; return sp.call(this, n, v, p); };

  const KEY = 'ul-perf-results';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const p95 = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };
  function counts() {
    const all = document.querySelectorAll('.ul-glass'), vh = innerHeight, vw = innerWidth;
    let bf = 0, url = 0, urlView = 0;
    all.forEach((el) => {
      const f = getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter || 'none';
      if (f === 'none') return;
      bf++;
      if (f.indexOf('url(') >= 0) { url++; const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width) urlView++; }
    });
    const g = window.UL && window.UL.getGlassStats ? window.UL.getGlassStats() : null;
    const fmt = (n) => (n === Infinity || n == null ? '∞' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n));
    return { glass: all.length, bf, url, urlView, budget: g ? fmt(g.areaUsed) + ' / ' + fmt(g.budget) + ' px², ' + g.refractCount + ' / ' + fmt(g.maxCount) : '—', degraded: g ? g.degraded : false,
      tiers: g ? `full ${g.refract} · lite ${g.lite} · flat ${g.flat} · fallback ${g.fallback}` : '' };
  }

  let box, live, table, frames = [], jsF = [], last = 0, lightT = performance.now(), lightRate = 0, tick = 0, c = null;
  function loop(t) {
    if (!P.on && !P.benching) return;
    if (last) { frames.push(t - last); jsF.push(P.js); if (frames.length > 240) { frames.shift(); jsF.shift(); } }
    P.js = 0; last = t;
    if (P.on && t - tick > 500) {
      tick = t;
      const now = performance.now(); lightRate = (P.light / (now - lightT)) * 1000; P.light = 0; lightT = now;
      if (!P.benching) c = counts();
      render();
    }
    raf0(loop);
  }
  function render() {
    if (!box) return;
    const recent = frames.slice(-120), mean = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
    const js = jsF.slice(-120).reduce((a, b) => a + b, 0) / (jsF.slice(-120).length || 1);
    live.textContent =
      `fps ${(1000 / mean || 0).toFixed(0)}  ·  p95 ${p95(recent).toFixed(1)} ms  ·  js ${js.toFixed(2)} ms/frame\n` +
      (c ? `glass ${c.glass}  ·  backdrop-filter ${c.bf}  ·  refracted ${c.url} (in view ${c.urlView})\n` : '') +
      (c && c.tiers ? `tiers ${c.tiers}\n` : '') +
      `light writes ${lightRate.toFixed(0)}/s  ·  refracted area ${c ? c.budget : '—'}${c && c.degraded ? ' (degraded)' : ''}${P.benching ? '  ·  ' + P.benching : ''}`;
    if (P.tiers) drawTiers();
  }
  // Tier overlay: outlines every glass surface by its rendered tier. Drawn in a separate fixed layer so it never touches the surfaces (an outline would be bent by the lens).
  const TIER = { refract: ['#3dff8b', 'solid', 'full'], lite: ['#ffd23f', 'dashed', 'lite'], flat: ['#ff5a8a', 'dotted', 'flat'], fallback: ['#8fb8ff', 'dashed', 'fallback'] };
  let layer = null, tierRaf = 0;
  function drawTiers() {
    if (!layer) { layer = document.createElement('div'); layer.setAttribute('data-ul-tier-layer', ''); layer.style.cssText = 'position:fixed;inset:0;z-index:2147482999;pointer-events:none'; document.body.appendChild(layer); }
    const vw = innerWidth, vh = innerHeight, out = [];
    document.querySelectorAll('.ul-glass').forEach((el) => {
      const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
      const t = TIER[el.dataset.ulMode] || ['#fff', 'dotted', '?'];
      out.push(`<div style="position:absolute;left:${r.left - 2}px;top:${r.top - 2}px;width:${r.width}px;height:${r.height}px;border:2px ${t[1]} ${t[0]};border-radius:6px"><span style="position:absolute;left:-2px;top:-15px;font:600 10px/13px ui-monospace,monospace;padding:0 4px;border-radius:3px;background:${t[0]};color:#000">${t[2]}</span></div>`);
    });
    layer.innerHTML = out.join('');
  }
  const onTierScroll = () => { if (!tierRaf) tierRaf = raf0(() => { tierRaf = 0; if (P.tiers) drawTiers(); }); };
  P.showTiers = function (on) {
    P.tiers = on == null ? !P.tiers : !!on;
    if (P.tiers) { drawTiers(); addEventListener('scroll', onTierScroll, { passive: true, capture: true }); if (!P.on) { P.on = true; if (!box) build(); box.style.display = 'flex'; last = 0; raf0(loop); } }
    else { removeEventListener('scroll', onTierScroll, { capture: true }); if (layer) layer.innerHTML = ''; }
    return P.tiers;
  };
  function renderTable() {
    if (!table) return;
    const r = load(), rows = [];
    for (const label in r) for (const sc of ['idle', 'scroll', 'pointer', 'drag']) {
      const x = r[label][sc]; if (!x) continue;
      rows.push(`${label.padEnd(26).slice(0, 26)} ${sc.padEnd(7)} ${String(x.fps).padStart(4)} ${String(x.p95).padStart(6)} ${String(x.js).padStart(6)} ${String(x.light).padStart(6)} ${String(x.bf).padStart(4)} ${String(x.url).padStart(4)} ${String(x.urlView).padStart(4)}`);
    }
    table.textContent = rows.length ? 'label                      scen     fps  p95ms  jsms  lit/s   bf  url view\n' + rows.join('\n') : 'No bench results yet.';
  }
  function scenario(name, ms, step) {
    return new Promise((done) => {
      P.benching = name;
      const t0 = performance.now(); let s0 = 0, l0 = 0, collecting = false; const fr = [], jf = [];
      let prev = 0;
      const f = (t) => {
        const el = t - t0;
        if (step) step(el);
        if (!collecting && el > 500) { collecting = true; P.light = 0; l0 = performance.now(); prev = 0; }
        if (collecting) { if (prev) { fr.push(t - prev); jf.push(P.js); } prev = t; }
        P.js = 0;
        if (el < ms + 500) { raf0(f); return; }
        const secs = (performance.now() - l0) / 1000, cc = counts();
        const mean = fr.reduce((a, b) => a + b, 0) / (fr.length || 1);
        done({ fps: +(1000 / mean).toFixed(0), p95: +p95(fr).toFixed(1), js: +(jf.reduce((a, b) => a + b, 0) / (jf.length || 1)).toFixed(2), light: +(P.light / secs).toFixed(0), glass: cc.glass, bf: cc.bf, url: cc.url, urlView: cc.urlView, budget: cc.budget });
      };
      raf0(f);
    });
  }
  P.bench = async function (label) {
    label = label || (document.title.split('·').pop().trim() + (window.UL && window.UL.getGlassStats ? ' · after' : ' · before'));
    const se = document.scrollingElement, max = se.scrollHeight - se.clientHeight, y0 = se.scrollTop;
    const out = {};
    if (!last) raf0(loop);
    out.idle = await scenario('idle', 4000);
    let dir = 1;
    out.scroll = max > 40 ? await scenario('scroll', 4000, () => { let y = se.scrollTop + dir * 14; if (y >= max) { y = max; dir = -1; } if (y <= 0) { y = 0; dir = 1; } se.scrollTop = y; }) : null;
    se.scrollTop = y0;
    const vw = innerWidth, vh = innerHeight;
    out.pointer = await scenario('pointer', 4000, (t) => {
      const x = vw * (0.5 + 0.45 * Math.sin(t / 700)), y = vh * (0.5 + 0.42 * Math.sin(t / 430 + 1));
      const tg = document.elementFromPoint(x, y) || document.body;
      tg.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse', isPrimary: true }));
    });
    // drag: the first slider in the viewport, dragged back and forth (lens bubble + value tooltip live the whole time)
    const sl = [...document.querySelectorAll('.ul-slider:not([data-disabled]) .ul-slider-track')].find((t) => { const b = t.getBoundingClientRect(); return b.top > 40 && b.bottom < vh - 40 && b.width > 80; });
    if (sl) {
      const b = sl.getBoundingClientRect(), y = b.top + b.height / 2, ev = (type, x) => sl.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: 1, pointerId: 77, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y }));
      ev('pointerdown', b.left + b.width / 2);
      out.drag = await scenario('drag', 4000, (t) => ev('pointermove', b.left + b.width * (0.5 + 0.4 * Math.sin(t / 500))));
      ev('pointerup', b.left + b.width / 2);
    } else out.drag = null;
    P.benching = '';
    const all = load(); all[label] = out; localStorage.setItem(KEY, JSON.stringify(all));
    renderTable();
    return out;
  };
  P.results = load;
  /* Drag bench: scripted pointer drag over 3 s at constant speed, a pause, then a fast flick, on the first slider in view
   * (or the given slider root). Reports fps, p95, long frames, stalls (pointer moved, thumb did not), max frame-to-frame
   * discontinuity (change of thumb step between consecutive frames) and long-animation-frame (LoAF) script / forced-layout time. */
  P.dragBench = async function (root) {
    root = root || [...document.querySelectorAll('.ul-slider:not([data-disabled])')].find((t) => { const b = t.getBoundingClientRect(); return b.top > 40 && b.bottom < innerHeight - 40 && b.width > 120; });
    if (!root) return null;
    if (!last) raf0(loop);
    const track = root.querySelector('.ul-slider-track'), thumb = root.querySelector('.ul-slider-thumb');
    const b = track.getBoundingClientRect(), y = b.top + b.height / 2;
    const ev = (type, x) => track.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 78, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y }));
    const loaf = []; let po = null;
    try { po = new PerformanceObserver((l) => loaf.push(...l.getEntries())); po.observe({ type: 'long-animation-frame', buffered: false }); } catch (e) { po = null; }
    const cx = () => { const r = thumb.getBoundingClientRect(); return r.left + r.width / 2; };
    const F = [];
    const x0 = b.left + b.width * 0.15, x1 = b.left + b.width * 0.85, x2 = b.left + b.width * 0.2;
    ev('pointerdown', x0);
    await new Promise((done) => {
      const t0 = performance.now(); let prev = t0, px = x0;
      const f = (t) => {
        const el = t - t0;
        let phase, x;
        if (el < 3000) { phase = 'drag'; x = x0 + (x1 - x0) * (el / 3000); }
        else if (el < 3300) { phase = 'pause'; x = x1; }
        else if (el < 3420) { phase = 'flick'; x = x1 + (x2 - x1) * ((el - 3300) / 120); }
        else if (el < 3900) { phase = 'settle'; x = x2; }
        else { ev('pointerup', x2); done(); return; }
        // two coalesced moves per frame, like a 120 Hz+ mouse
        ev('pointermove', (px + x) / 2); ev('pointermove', x);
        F.push({ t, dt: t - prev, phase, px: x, dpx: x - px, th: cx() });
        prev = t; px = x;
        raf0(f);
      };
      raf0(f);
    });
    await new Promise((r) => setTimeout(r, 120));
    po && po.disconnect();
    const D = F.filter((f) => f.phase === 'drag').slice(6);
    const dts = D.map((f) => f.dt).sort((a, b) => a - b), med = dts[dts.length >> 1] || 16.7;
    let stalls = 0, run = 0, maxRun = 0, disc = 0;
    for (let i = 1; i < D.length; i++) {
      const moved = Math.abs(D[i].th - D[i - 1].th);
      if (Math.abs(D[i].dpx) > 0.5 && moved < 0.05) { stalls++; run++; maxRun = Math.max(maxRun, run); } else run = 0;
      if (i > 1) disc = Math.max(disc, Math.abs((D[i].th - D[i - 1].th) - (D[i - 1].th - D[i - 2].th)));
    }
    const mean = D.reduce((a, f) => a + f.dt, 0) / (D.length || 1);
    const scripts = loaf.flatMap((e) => e.scripts || []);
    const out = {
      frames: D.length, fps: +(1000 / mean).toFixed(0), p95: +p95(D.map((f) => f.dt)).toFixed(1),
      long: D.filter((f) => f.dt > Math.max(25, med * 1.6)).length, stalls, maxStall: maxRun, disc: +disc.toFixed(2),
      loaf: loaf.length, loafMs: +loaf.reduce((a, e) => a + e.duration, 0).toFixed(0),
      scriptMs: +scripts.reduce((a, s) => a + s.duration, 0).toFixed(1), forcedLayoutMs: +scripts.reduce((a, s) => a + (s.forcedStyleAndLayoutDuration || 0), 0).toFixed(1),
      flickEnd: +(F[F.length - 1].th - x2).toFixed(1),
    };
    P.lastDrag = { out, F };
    if (table) table.textContent = 'Drag bench (3 s constant + flick)\n' + Object.entries(out).map(([k, v]) => k.padEnd(15) + v).join('\n');
    return out;
  };
  // Motion test: every visible [aria-haspopup] trigger on this page through the anchored-morph harness (motion-harness.js).
  P.motion = async function () {
    if (!window.ULMotionTest) await new Promise((r, j) => { const s = document.createElement('script'); s.src = new URL('./motion-harness.js', HUD_SRC).href; s.onload = r; s.onerror = j; document.head.appendChild(s); });
    if (!P.on) P.toggle(true);
    const y = scrollY, x = scrollX;
    table.textContent = 'Motion test running…';
    box.style.visibility = 'hidden'; // the HUD must not cover (or be hit-tested over) the overlays it measures
    if (layer) layer.style.visibility = 'hidden';
    let res;
    try { res = await window.ULMotionTest.auto(); } finally { box.style.visibility = ''; if (layer) layer.style.visibility = ''; }
    scrollTo(x, y);
    const pass = res.filter((r) => r.status === 'pass').length;
    table.textContent = `Motion test: ${pass} / ${res.length} pass · full report: showcase/motion-test.dc.html\n` + window.ULMotionTest.text(res);
    return res;
  };
  function build() {
    box = document.createElement('div');
    box.setAttribute('data-ul-perf-hud', '');
    box.style.cssText = 'position:fixed;right:calc(12px + var(--ul-scroll-lock-gap, 0px));bottom:12px;z-index:2147483000;max-width:min(720px,calc(100vw - 24px));padding:12px 14px;border-radius:12px;background:#05070bf2;color:#e8edf5;box-shadow:0 0 0 1px #ffffff26,0 12px 40px #0009;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;flex-direction:column;gap:8px';
    live = document.createElement('pre'); live.style.cssText = 'margin:0;white-space:pre-wrap';
    const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:8px;align-items:center';
    const btn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'font:inherit;color:inherit;background:#ffffff14;border:1px solid #ffffff33;border-radius:8px;padding:4px 10px;cursor:pointer'; b.onclick = fn; bar.appendChild(b); return b; };
    btn('Run bench', () => P.bench());
    btn('Clear results', () => { localStorage.removeItem(KEY); renderTable(); });
    btn('Tiers', () => P.showTiers());
    btn('Motion test', () => P.motion());
    btn('Drag bench', () => P.dragBench());
    const hint = document.createElement('span'); hint.textContent = 'Shift+P hides · Shift+T tiers'; hint.style.opacity = '.6'; bar.appendChild(hint);
    table = document.createElement('pre'); table.style.cssText = 'margin:0;white-space:pre;overflow:auto;max-height:240px;opacity:.9';
    box.append(live, bar, table);
    document.body.appendChild(box);
    renderTable();
  }
  P.toggle = function (on) {
    P.on = on == null ? !P.on : !!on;
    if (P.on && !box) build();
    if (box) box.style.display = P.on ? 'flex' : 'none';
    if (P.on) { last = 0; raf0(loop); }
  };
  addEventListener('keydown', (e) => { if (e.shiftKey && (e.key === 'T' || e.key === 't') && !/INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) P.showTiers(); });
  addEventListener('keydown', (e) => { if (e.shiftKey && (e.key === 'P' || e.key === 'p') && !/INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) P.toggle(); });
  const start = () => { if (/[?&]perf\b/.test(location.search)) P.toggle(true); };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
})();
