// Card "material": glass | flat resolution + flat = reduced-transparency fallback + budget exclusion. Frame-independent (static DOM + getComputedStyle).
(function () {
  function define() {
    const UL = window.UL, React = window.React, h = React.createElement;
    const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const settle = async (ms = 400) => { await wait(ms); await raf(); await raf(); };
    const bf = (el) => { const cs = el && getComputedStyle(el); return cs ? (cs.backdropFilter || cs.webkitBackdropFilter || 'none') : 'missing'; };
    async function materialTest() {
      const checks = [], add = (key, label, pass, value) => checks.push({ key, label, pass, value: String(value) });
      // 1. category defaults
      const cats = UL.MATERIAL_CATEGORIES, want = { inputs: 'flat', controls: 'glass', surfaces: 'glass', overlays: 'glass', chrome: 'glass' };
      const got = cats.map((c) => c + '=' + UL.resolveMaterial(c).material);
      add('defaults', 'category defaults (inputs flat, rest glass) · global glass', cats.every((c) => UL.resolveMaterial(c).material === want[c]) && UL.resolveMaterial(undefined).material === 'glass', got.join(' '));
      const host = document.createElement('div'); host.setAttribute('data-ul-theme', 'app'); host.setAttribute('data-ul-accent', 'violet');
      host.style.cssText = 'position:fixed;inset:0;z-index:800;overflow:auto;padding:24px;box-sizing:border-box;background:linear-gradient(135deg,#3a2a6a,#0b0d12 60%,#14324a);display:flex;flex-flow:row wrap;gap:12px;align-items:flex-start;align-content:flex-start';
      document.body.appendChild(host); const root = window.ReactDOM.createRoot(host);
      const P = UL.ULProvider, B = (p) => h(UL.ULButton, p, p.t), T = (p) => h(UL.ULTextField, { label: p.t, ...p });
      try {
        root.render(h(React.Fragment, null,
          h('div', { 'data-t': 'pick' }, h(UL.ULDatePicker, { label: 'Date', defaultOpen: true })),
          h('div', { 'data-t': 'attr', 'data-ul-material': 'flat' }, h(UL.ULGlass, { tier: 'md', padding: 16, style: { width: 320, height: 120 } }, 'Attribute flat')),
          h('div', { 'data-t': 'attrg', 'data-ul-material': 'flat' }, h('div', { 'data-ul-material': 'glass' }, h(UL.ULGlass, { tier: 'md', padding: 16, style: { width: 320, height: 60 } }, 'Nearest attribute glass'))),
          h('div', { 'data-t': 'def' }, B({ t: 'Default button' }), T({ t: 'Default field' }), h(UL.ULDatePicker, { label: 'Closed date' })),
          h('div', { 'data-t': 'fbtn' }, h(P, { material: 'flat' }, B({ t: 'Flat primary', variant: 'primary' }), B({ t: 'Flat secondary', variant: 'secondary' }))),
          h('div', { 'data-t': 'prov' }, h(P, { material: 'flat' }, B({ t: 'Provider flat' }))),
          h('div', { 'data-t': 'inst' }, h(P, { material: 'flat' }, B({ t: 'Instance glass', material: 'glass' }))),
          h('div', { 'data-t': 'near' }, h(P, { material: { default: 'flat' } }, h(P, { material: { controls: 'glass' } }, B({ t: 'Nearest glass' }), T({ t: 'Inherited flat' })))),
          h('div', { 'data-t': 'gin' }, h(P, { material: { inputs: 'glass' } }, T({ t: 'Inputs glass' }))),
        ));
        await settle(1600);
        const q = (t, s) => host.querySelector(`[data-t="${t}"] ${s}`);
        const mat = (el) => (el ? el.getAttribute('data-ul-material') || (el.hasAttribute('data-ul-flat') ? 'flat(attr)' : 'glass(default)') : 'missing');
        const isFlat = (el) => !!el && (el.getAttribute('data-ul-material') === 'flat' || el.hasAttribute('data-ul-flat'));
        const defBtn = q('def', '.ul-btn'), defField = q('def', '.ul-field');
        add('default-dom', 'no config: button glass (no attribute), field flat', !isFlat(defBtn) && defField?.getAttribute('data-ul-material') === 'flat', mat(defBtn) + ' · ' + mat(defField));
        add('provider', 'ULProvider material="flat" → button flat', isFlat(q('prov', '.ul-btn')), mat(q('prov', '.ul-btn')));
        add('instance', 'instance prop beats provider (flat scope, material="glass")', q('inst', '.ul-btn')?.getAttribute('data-ul-material') === 'glass', mat(q('inst', '.ul-btn')));
        add('nearest', 'nearest scope wins per category ({default:flat} > {controls:glass}: button glass, field flat)', q('near', '.ul-btn')?.getAttribute('data-ul-material') === 'glass' && q('near', '.ul-field')?.getAttribute('data-ul-material') === 'flat', mat(q('near', '.ul-btn')) + ' · ' + mat(q('near', '.ul-field')));
        add('inputs-glass', 'ULProvider {inputs:"glass"} → field glass', q('gin', '.ul-field')?.getAttribute('data-ul-material') === 'glass', mat(q('gin', '.ul-field')));
        const attrEl = q('attr', '.ul-glass'), attrG = q('attrg', '.ul-glass');
        add('attribute', 'data-ul-material="flat" on an ancestor (non-React) → flat, nearest attribute glass wins', isFlat(attrEl) && attrEl.dataset.ulMode === 'flat' && !isFlat(attrG), mat(attrEl) + ' mode=' + attrEl?.dataset.ulMode + ' · ' + mat(attrG) + ' mode=' + attrG?.dataset.ulMode + ' (mode flat on glass = off-screen / nested)');
        const flatEls = [q('prov', '.ul-btn'), attrEl], glassEls = [defBtn, q('inst', '.ul-btn'), attrG];
        const fb = flatEls.map(bf), gb = glassEls.map(bf);
        const reduce = document.documentElement.dataset.ulTransparency === 'reduce' || matchMedia('(prefers-reduced-transparency: reduce)').matches;
        add('backdrop', 'flat: backdrop-filter none · glass: backdrop-filter set (getComputedStyle)', fb.every((v) => v === 'none') && (reduce || gb.every((v) => v !== 'none' && v !== 'missing')), 'flat ' + fb.join(' | ') + ' · glass ' + gb.join(' | ') + (reduce ? ' (reduced transparency: glass check skipped)' : ''));
        const rim = getComputedStyle(attrEl, '::before').opacity, light = getComputedStyle(attrEl, '::after').opacity;
        add('rim-light', 'flat: gloss rim + pointer light layers off', rim === '0' && light === '0', 'rim ' + rim + ' · light ' + light);
        // budget: flat surfaces are never granted refraction and add no refracted area
        const s0 = UL.getGlassStats(), area0 = s0.areaUsed;
        attrEl.closest('[data-t]').removeAttribute('data-ul-material'); UL.refreshGlass?.(attrEl); await settle(600);
        const s1 = UL.getGlassStats();
        attrEl.closest('[data-t]').setAttribute('data-ul-material', 'flat'); UL.refreshGlass?.(attrEl); await settle(600);
        const s2 = UL.getGlassStats();
        add('budget', 'flat does not count toward the refraction budget (area with flat = area without the surface)', s2.areaUsed <= area0 && attrEl.dataset.ulMode === 'flat', `areaUsed flat ${Math.round(area0)} → as glass ${Math.round(s1.areaUsed)} (${attrEl ? 'mode then ' : ''}${s1.refractCount} refracting) → flat again ${Math.round(s2.areaUsed)}`);
        const trig = q('pick', '.ul-select-trigger');
        const dlg = trig && document.getElementById(trig.getAttribute('aria-controls') || '');
        const pop = dlg ? (dlg.closest('.ul-glass') || dlg.querySelector('.ul-glass')) : null;
        add('popover', 'date picker: trigger flat, its popover stays glass (overlays)', isFlat(trig) && !!pop && !isFlat(pop) && (reduce || bf(pop) !== 'none'), 'trigger ' + mat(trig) + ' ' + bf(trig) + ' · popover ' + (pop ? mat(pop) + ' ' + bf(pop) : 'not found'));
        // contrast in flat (ul-contrast.js: CSS Color 4 parse, compositing over the darkest page backing)
        const C = window.ULContrast;
        if (C) {
          await C.ready();
          const res = C.resolver(host), page = res.get('var(--ul-color-graphite)'), col = (el, p) => { const cs = getComputedStyle(el); const v = C.parse(cs[p]); return C.toSRGB(v.lsrgb).concat(v.alpha); };
          const comp = (bg) => C.over(bg, page.concat ? page.slice(0, 3).concat(1) : page);
          const rows = [], push = (nm, fg, bg, min) => { const r = C.round(C.ratio(fg, comp(bg))); rows.push({ nm, r, ok: r >= min, min }); };
          const tv = trig.querySelector('.ul-select-value') || trig;
          push('date trigger value', col(tv, 'color'), col(trig, 'backgroundColor'), 4.5);
          push('date trigger placeholder (text-2)', res.get('var(--ul-color-text-2)'), col(trig, 'backgroundColor'), 4.5);
          const well = q('def', '.ul-well'), inp = q('def', '.ul-field-input'), lab = q('def', '.ul-field-label');
          const wb = col(well, 'backgroundColor');
          push('field text', col(inp, 'color'), wb, 4.5);
          push('field floating label (text-2)', col(lab, 'color'), wb, 4.5);
          const rim = res.get(getComputedStyle(q('def', '.ul-field')).getPropertyValue('--ul-fr').trim() || 'var(--ul-field-rim)');
          const rimR = C.round(C.ratio(C.over(rim, comp(wb)), comp(page.slice(0, 3).concat(1)))), rr = C.round(C.ratio(comp(wb), comp(page.slice(0, 3).concat(1))));
          add('contrast', 'flat inputs: text ≥ 4.5:1 on the well / fallback trigger (ul-contrast.js)', rows.every((x) => x.ok), rows.map((x) => `${x.nm} ${x.r}`).join(' · '));
          add('contrast-edge', 'flat field edge: rim over well vs page (info, unchanged from glass: the well was never glass)', undefined, `rim ${rimR}:1 · well vs page ${rr}:1`);
          // 4D: flat primary keeps its accent fill (opaque body colour × ax under the backing); flat secondary = surface-solid
          const fp = q('fbtn', '.ul-btn--primary'), fs = q('fbtn', '.ul-btn--secondary');
          const fill = (b) => { const R = C.resolver(b); try { return C.over(R.get('color-mix(in srgb, var(--ul-glass-deep) calc(var(--ul-glass-scrim) * var(--ul-ax) * 100%), transparent)'), R.get('color-mix(in oklab, var(--ul-glass-tint-color) calc(var(--ul-ax) * 100%), var(--ul-color-surface-solid))')); } finally { R.done(); } };
          const solid = res.get('var(--ul-color-surface-solid)'), dist = (a, b) => a.slice(0, 3).reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
          const pf = fill(fp), sf = fill(fs), acc = res.get('var(--ul-accent)');
          const pr = C.round(C.ratio(col(fp.querySelector('.ul-btn-label'), 'color'), pf));
          const towardAccent = dist(pf, acc) < dist(solid, acc) - 0.15;
          add('flat-primary', 'flat primary keeps its accent fill (not the surface-solid / deep plate), label ≥ 4.5:1; flat secondary = surface-solid', isFlat(fp) && towardAccent && pr >= 4.5 && dist(sf, solid) < 0.02 && bf(fp) === 'none',
            `primary fill rgb(${pf.slice(0, 3).map((v) => Math.round(v * 255)).join(' ')}) label ${pr}:1 · secondary Δ${dist(sf, solid).toFixed(3)} from surface-solid`);
          // 4D: picker trigger (flat) = the same well as the text field (background + rim shadow)
          const dt = q('def', '.ul-picker .ul-select-trigger'), tw = q('def', '.ul-field .ul-well');
          const cd = dt && getComputedStyle(dt), ct = tw && getComputedStyle(tw);
          const same = !!cd && !!ct && cd.backgroundColor === ct.backgroundColor && cd.boxShadow === ct.boxShadow && cd.backgroundImage === 'none';
          add('picker-well', 'flat date trigger resolves to the same surface token as the text field well (background, rim / inset shadow), no plate gradient', same && isFlat(dt),
            cd && ct ? `trigger ${cd.backgroundColor} · well ${ct.backgroundColor} · shadow ${cd.boxShadow === ct.boxShadow ? 'same' : 'differs'} · bg-image ${cd.backgroundImage.slice(0, 24)}` : 'missing');
          res.done();
        } else add('contrast', 'ul-contrast.js loaded', false, 'missing');
      } finally { await wait(50); root.unmount(); host.remove(); }
      return { status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'frame-independent (static DOM, getComputedStyle, getGlassStats)' };
    }
    // Showcase: the same form in a given material mode. mode: glass | flat | mixed (defaults) | before ({inputs:'glass'} = the look before v0.1 material)
    function MaterialForm({ mode = 'mixed' }) {
      const cfg = mode === 'glass' ? 'glass' : mode === 'flat' ? 'flat' : mode === 'before' ? { inputs: 'glass' } : undefined;
      const opts = [{ value: 'eu', label: 'Europe' }, { value: 'us', label: 'United States' }, { value: 'ap', label: 'Asia Pacific' }];
      return h(UL.ULProvider, { material: cfg }, h('div', { 'data-mf': mode, style: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 } },
        h(UL.ULTextField, { label: 'Workspace name', defaultValue: 'Ultra Labs' }),
        h(UL.ULSelect, { label: 'Region', options: opts, defaultValue: 'eu' }),
        h(UL.ULCombobox, { label: 'Owner', options: [{ value: 'a', label: 'Ada Lovelace' }, { value: 'g', label: 'Grace Hopper' }] }),
        h(UL.ULDatePicker, { label: 'Start date' }),
        h(UL.ULOtpField, { label: 'Verification code', length: 6 }),
        h(UL.ULCopyField, { label: 'API key', value: 'ul_live_3f9a2c7e1b', masked: true }),
        h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
          h(UL.ULSwitch, { label: 'Notify me', defaultChecked: true }),
          h(UL.ULButton, { variant: 'secondary' }, 'Cancel'), h(UL.ULButton, { variant: 'primary' }, 'Save')),
      ));
    }
    // Card "otplayout": the OTP group fits its container at 375 / 480 / 720px (cells shrink to 75 %, gap shrinks), no overlap, height ≥ 44.
    async function otpLayoutTest() {
      const checks = [], add = (key, label, pass, value) => checks.push({ key, label, pass, value: String(value) });
      const host = document.createElement('div'); host.setAttribute('data-ul-theme', 'app');
      host.style.cssText = 'position:fixed;inset:0;z-index:800;overflow:auto;padding:16px;box-sizing:border-box;background:#0b0d12;display:flex;flex-direction:column;gap:12px';
      document.body.appendChild(host); const root = window.ReactDOM.createRoot(host);
      const W = [375, 480, 720];
      try {
        root.render(h(React.Fragment, null, W.map((w) => h('div', { key: w, 'data-w': w, style: { width: w, boxSizing: 'border-box', padding: 16 } }, h(UL.ULOtpField, { label: 'Code ' + w, length: 6 })))));
        await settle(500);
        for (const w of W) {
          const c = host.querySelector(`[data-w="${w}"]`), cr = c.getBoundingClientRect(), right = cr.right - 16;
          const b = [...c.querySelectorAll('.ul-otp-box')].map((x) => x.getBoundingClientRect());
          let ov = 0; for (let i = 1; i < b.length; i++) if (b[i].left < b[i - 1].right - 0.5) ov++;
          const edge = b[b.length - 1].right - right, hmin = Math.min(...b.map((r) => r.height));
          add('otp' + w, `${w}px container: right edge inside, no cell overlaps, cells ≥ 44px tall`, edge <= 0.5 && ov === 0 && hmin >= 44, `cell ${b[0].width.toFixed(1)}×${hmin.toFixed(0)} · gap ${(b[1].left - b[0].right).toFixed(1)} · edge ${edge.toFixed(1)} · overlaps ${ov}`);
        }
      } finally { await wait(50); root.unmount(); host.remove(); }
      return { status: checks.every((c) => c.pass !== false) ? 'pass' : 'fail', checks, driver: 'frame-independent (getBoundingClientRect)' };
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { materialTest, otpLayoutTest, MaterialForm });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
