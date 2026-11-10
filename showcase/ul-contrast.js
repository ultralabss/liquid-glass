// Shared contrast tool (Task 3C 0a). One implementation for every probe page: window.ULContrast.
// - ready(): waits for every stylesheet, document.fonts.ready and resolved tokens (getComputedStyle), throws on timeout.
// - resolver(root).get(expr): resolves a CSS colour expression in the cascade of `root` (theme / accent attributes apply),
//   parses the computed value in ANY CSS Color 4 space (rgb, color(srgb|srgb-linear|display-p3|rec2020|xyz…), lab, lch,
//   oklab, oklch), converts to sRGB with the CSS Color 4 gamut-mapping algorithm (oklch chroma reduction, JND 0.02),
//   and THROWS if the expression does not resolve (invalid at computed-value time → inherited sentinel detected).
// - over(top, bottom): source-over in gamma sRGB (what the browser does); ratio(fg, bg): WCAG ratio, fg composited over bg.
(function () {
  const lin = (c) => { const a = Math.abs(c); return a <= 0.04045 ? c / 12.92 : Math.sign(c) * ((a + 0.055) / 1.055) ** 2.4; };
  const gam = (c) => { const a = Math.abs(c); return a <= 0.0031308 ? 12.92 * c : Math.sign(c) * (1.055 * a ** (1 / 2.4) - 0.055); };
  const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const XYZ_TO_LSRGB = [[3.2409699419045226, -1.537383177570094, -0.4986107602930034], [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559], [0.05563007969699366, -0.20397695888897652, 1.0569715142428786]];
  const P3_TO_XYZ = [[0.4865709486482162, 0.26566769316909306, 0.1982172852343625], [0.2289745640697488, 0.6917385218365064, 0.079286914093745], [0, 0.04511338185890264, 1.043944368900976]];
  const R2020_TO_XYZ = [[0.6369580483012914, 0.14461690358620832, 0.1688809751641721], [0.2627002120112671, 0.6779980715188708, 0.05930171646986196], [0, 0.028072693049087428, 1.060985057710791]];
  const D50_TO_D65 = [[0.955473421488075, -0.02309845494876471, 0.06325924320057072], [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323], [0.012314014864481998, -0.020507649298898964, 1.330365926242124]];
  const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
  // linear sRGB <-> oklab (Ottosson)
  const lsrgbToOklab = ([r, g, b]) => {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const oklabToLsrgb = ([L, a, b]) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  };
  const labToXyz65 = ([L, a, b]) => {
    const k = 24389 / 27, e = 216 / 24389, fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
    const xyz = [fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k, L > k * e ? fy ** 3 : L / k, fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k].map((v, i) => v * D50[i]);
    return mul(D50_TO_D65, xyz);
  };
  const polar = ([L, C, H]) => [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];
  const num = (t) => (t === 'none' ? 0 : t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t));
  /** computed colour string → { lsrgb (linear sRGB, may be out of gamut), alpha } */
  function parse(s) {
    s = s.trim();
    let m = /^rgba?\(\s*([^)]+)\)$/.exec(s);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean); return { lsrgb: p.slice(0, 3).map((v) => lin(num(v) * (v.endsWith('%') ? 1 : 1 / 255))), alpha: p[3] == null ? 1 : num(p[3]) }; }
    m = /^(color|oklch|oklab|lab|lch)\(\s*([^)]+)\)$/.exec(s);
    if (!m) throw new Error(`ULContrast: cannot parse computed colour "${s}"`);
    const [main, al] = m[2].split('/'), p = main.trim().split(/\s+/), alpha = al == null ? 1 : num(al.trim());
    const fn = m[1];
    if (fn === 'oklab') return { lsrgb: oklabToLsrgb([num(p[0]), num(p[1]) * (p[1].endsWith('%') ? 0.4 : 1), num(p[2]) * (p[2].endsWith('%') ? 0.4 : 1)]), alpha };
    if (fn === 'oklch') return { lsrgb: oklabToLsrgb(polar([num(p[0]), num(p[1]) * (p[1].endsWith('%') ? 0.4 : 1), num(p[2])])), alpha };
    if (fn === 'lab') return { lsrgb: mul(XYZ_TO_LSRGB, labToXyz65([parseFloat(p[0]), num(p[1]), num(p[2])])), alpha };
    if (fn === 'lch') return { lsrgb: mul(XYZ_TO_LSRGB, labToXyz65(polar([parseFloat(p[0]), num(p[1]), num(p[2])]))), alpha };
    const sp = p[0], c = p.slice(1, 4).map(num);
    if (sp === 'srgb') return { lsrgb: c.map(lin), alpha };
    if (sp === 'srgb-linear') return { lsrgb: c, alpha };
    if (sp === 'display-p3') return { lsrgb: mul(XYZ_TO_LSRGB, mul(P3_TO_XYZ, c.map(lin))), alpha };
    if (sp === 'rec2020') { const a = 1.09929682680944, b = 0.018053968510807; const t = (v) => (v < b * 4.5 ? v / 4.5 : ((v + a - 1) / a) ** (1 / 0.45)); return { lsrgb: mul(XYZ_TO_LSRGB, mul(R2020_TO_XYZ, c.map(t))), alpha }; }
    if (sp === 'xyz' || sp === 'xyz-d65') return { lsrgb: mul(XYZ_TO_LSRGB, c), alpha };
    if (sp === 'xyz-d50') return { lsrgb: mul(XYZ_TO_LSRGB, mul(D50_TO_D65, c)), alpha };
    throw new Error(`ULContrast: unsupported colour space "${sp}" in "${s}"`);
  }
  const inGamut = (rgb, e = 1e-5) => rgb.every((v) => v >= -e && v <= 1 + e);
  const clip = (rgb) => rgb.map((v) => Math.min(1, Math.max(0, v)));
  const dEok = (a, b) => { const A = lsrgbToOklab(a.map(lin)), B = lsrgbToOklab(b.map(lin)); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  /** CSS Color 4 gamut mapping to sRGB (binary search on oklch chroma, deltaEOK JND 0.02). Returns gamma sRGB 0..1. */
  function toSRGB(lsrgb) {
    const g = lsrgb.map(gam);
    if (inGamut(g)) return clip(g);
    const lab = lsrgbToOklab(lsrgb), L = lab[0], C = Math.hypot(lab[1], lab[2]), H = Math.atan2(lab[2], lab[1]);
    if (L >= 1) return [1, 1, 1]; if (L <= 0) return [0, 0, 0];
    const at = (c) => oklabToLsrgb([L, c * Math.cos(H), c * Math.sin(H)]).map(gam);
    const JND = 0.02, EPS = 0.0001; let lo = 0, hi = C, loIn = true, cur = at(C), clipped = clip(cur);
    if (dEok(clipped, cur) < JND) return clipped;
    while (hi - lo > EPS) {
      const c = (lo + hi) / 2; cur = at(c);
      if (loIn && inGamut(cur)) { lo = c; continue; }
      clipped = clip(cur); const E = dEok(clipped, cur);
      if (E < JND) { if (JND - E < EPS) return clipped; loIn = false; lo = c; } else hi = c;
    }
    return clip(cur);
  }
  const over = (top, bot) => { const a = top[3] ?? 1, b = bot[3] ?? 1, o = a + b * (1 - a); if (o === 0) return [0, 0, 0, 0]; return [0, 1, 2].map((i) => (top[i] * a + bot[i] * b * (1 - a)) / o).concat(o); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  function ratio(fg, bg) {
    if ((bg[3] ?? 1) < 0.999) throw new Error('ULContrast: ratio() needs an opaque backdrop (composite it first)');
    const f = (fg[3] ?? 1) < 1 ? over(fg, bg) : fg, x = lum(f), y = lum(bg);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function resolver(root, cls) {
    const wrap = document.createElement('span'), probe = document.createElement('span');
    if (cls) { wrap.className = cls; } wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    wrap.appendChild(probe); root.appendChild(wrap);
    const cache = new Map();
    const get = (expr) => {
      if (cache.has(expr)) return cache.get(expr);
      probe.style.color = ''; probe.style.color = expr;
      if (!probe.style.color) throw new Error(`ULContrast: invalid colour expression "${expr}"`);
      wrap.style.color = 'rgb(1, 2, 3)'; const a = getComputedStyle(probe).color;
      wrap.style.color = 'rgb(4, 5, 6)'; const b = getComputedStyle(probe).color;
      if (a !== b) throw new Error(`ULContrast: unresolved colour "${expr}" on [${root.getAttribute('data-ul-theme') || ''} ${root.getAttribute('data-ul-accent') || ''}] (a token is missing or invalid at computed-value time)`);
      const p = parse(a), v = toSRGB(p.lsrgb).concat(p.alpha); cache.set(expr, v); return v;
    };
    const tok = (k) => { const v = getComputedStyle(probe).getPropertyValue(k).trim(); if (!v) throw new Error(`ULContrast: token ${k} is not defined`); return v; };
    const numTok = (k) => { const v = parseFloat(tok(k)); if (!Number.isFinite(v)) throw new Error(`ULContrast: token ${k} is not a number`); return v; };
    return { get, tok, num: numTok, probe, done: () => wrap.remove() };
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ready({ tokens = ['--ul-color-text', '--ul-color-text-2', '--ul-accent', '--ul-color-graphite', '--ul-success-soft', '--ul-chart-s0'], cls = 'ul-chart2', timeout = 20000 } = {}) {
    const t0 = performance.now(), left = () => timeout - (performance.now() - t0);
    for (const l of document.querySelectorAll('link[rel="stylesheet"]')) {
      if (l.sheet) continue;
      await new Promise((res, rej) => { l.addEventListener('load', res, { once: true }); l.addEventListener('error', () => rej(new Error('ULContrast: stylesheet failed ' + l.href)), { once: true }); setTimeout(() => rej(new Error('ULContrast: stylesheet timeout ' + l.href)), Math.max(0, left())); });
    }
    if (!document.querySelector('style[data-ul-bundle-css], link[data-ul-css]') && !window.UL) throw new Error('ULContrast: UL bundle CSS not present');
    await document.fonts.ready;
    const root = document.createElement('div'); root.setAttribute('data-ul-theme', 'app'); root.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(root);
    let missing = tokens;
    try {
      while (left() > 0) {
        const R = resolver(root, cls); missing = [];
        for (const k of tokens) { try { R.tok(k); if (!/-(ms|at)$/.test(k)) R.get(`var(${k})`); } catch (e) { missing.push(k); } }
        R.done(); if (!missing.length) break; await sleep(100);
      }
    } finally { root.remove(); }
    if (missing.length) throw new Error('ULContrast: tokens not resolved after ' + timeout + 'ms: ' + missing.join(', '));
    return { waitedMs: Math.round(performance.now() - t0) };
  }
  /** Self-test: known conversions (fails loudly if the parser / gamut mapping regress). */
  function selfTest() {
    const R = resolver(document.body), near = (a, b) => b.every((v, i) => Math.abs(v - a[i]) < 0.004);
    const cases = [['#ff0000', [1, 0, 0]], ['oklch(0.627955 0.257683 29.234)', [1, 0, 0]], ['color(display-p3 1 0 0)', null], ['oklch(0.84 0.2 140)', null], ['rgb(255 255 255 / .5)', [1, 1, 1, 0.5]]];
    const out = cases.map(([e, want]) => { const v = R.get(e); return { e, v: v.map((x) => +x.toFixed(3)), ok: want ? near(v, want) : v.slice(0, 3).every((x) => x >= 0 && x <= 1) }; });
    let threw = false; try { R.get('var(--ul-does-not-exist)'); } catch (e) { threw = true; }
    out.push({ e: 'unresolved var throws', ok: threw }); R.done();
    return { pass: out.every((o) => o.ok), cases: out };
  }
  window.ULContrast = { ready, resolver, parse, toSRGB, over, ratio, lum, selfTest, round: (v) => Math.round(v * 100) / 100 };
})();
