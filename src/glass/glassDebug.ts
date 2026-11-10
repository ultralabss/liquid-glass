/**
 * Glass debug (scroll colour-flash bisect). URL overrides, applied on load:
 *   ?glass=full|lite|flat   one tier for every surface
 *   ?glassdebug             floating panel; every switch applies live (no reload)
 * The panel can also record real pixels: "Record scroll" asks for a tab capture (getDisplayMedia, current tab),
 * scrolls the nearest scroller in fixed steps and reports per-surface colour deviation from the resting frame.
 */
import { configureGlass, type GlassBisect } from './engine.ts';

type Flag = { key: string; label: string; kind: 'bisect' | 'attr' | 'global' | 'light'; group: string };
const FLAGS: Flag[] = [
  { key: 'threePass', label: 'Legacy 3-pass aberration (R/G/B + feBlend screen)', kind: 'bisect', group: 'Filter graph' },
  { key: 'compositeRecombine', label: '3-pass: recombine with feComposite arithmetic', kind: 'bisect', group: 'Filter graph' },
  { key: 'noAberration', label: 'Aberration off (force single pass)', kind: 'bisect', group: 'Filter graph' },
  { key: 'noMapRegen', label: 'Static map (no feImage swap after first map)', kind: 'bisect', group: 'Filter graph' },
  { key: 'capRegion', label: 'Cap filter region at 1024px', kind: 'bisect', group: 'Filter graph' },
  { key: 'noTint', label: 'Backdrop colorize (feBlend color) off', kind: 'bisect', group: 'Filter graph' },
  { key: 'contain', label: 'will-change + contain: paint on surfaces', kind: 'attr', group: 'Compositing' },
  { key: 'noisolate', label: 'isolation / will-change / contain all off', kind: 'attr', group: 'Compositing' },
  { key: 'nofringe', label: 'CSS bezel fringe off', kind: 'attr', group: 'Compositing' },
  { key: 'light', label: 'Pointer light off', kind: 'light', group: 'State' },
  { key: 'notrans', label: 'Accent / tint / rim / glow transitions off', kind: 'attr', group: 'State' },
  { key: 'noAccentObserver', label: 'Page-aware accent observer off', kind: 'bisect', group: 'State' },
  { key: 'noGovern', label: 'Governor off', kind: 'bisect', group: 'State' },
  { key: 'noIO', label: 'Visibility observer off', kind: 'bisect', group: 'State' },
  { key: 'noTopLayer', label: 'Toast top-layer re-promotion off', kind: 'global', group: 'New code' },
  { key: 'noViewSwap', label: 'viewSwap off (instant swap)', kind: 'global', group: 'New code' },
  { key: 'nocv', label: 'content-visibility / scroll-driven animations off', kind: 'attr', group: 'New code' },
];

export interface GlassDebugFlags { noTopLayer?: boolean; noViewSwap?: boolean }
const g = (typeof window !== 'undefined' ? window : {}) as Window & { __ulGlassDebug?: GlassDebugFlags };
export const debugFlags = (): GlassDebugFlags => g.__ulGlassDebug ?? {};

const on = new Set<string>();
function apply() {
  const bis: GlassBisect = {};
  for (const f of FLAGS) if (f.kind === 'bisect' && on.has(f.key)) (bis as Record<string, unknown>)[f.key] = f.key === 'capRegion' ? 1024 : true;
  configureGlass({ bisect: bis, light: !on.has('light') });
  const attrs = FLAGS.filter((f) => f.kind === 'attr' && on.has(f.key)).map((f) => f.key).join(' ');
  if (attrs) document.documentElement.setAttribute('data-ul-gd', attrs); else document.documentElement.removeAttribute('data-ul-gd');
  g.__ulGlassDebug = { noTopLayer: on.has('noTopLayer'), noViewSwap: on.has('noViewSwap') };
}

/* ---------- animations during scroll (hypothesis e) ---------- */
let animMax = 0; const animNames = new Set<string>();
function watchAnimations() {
  let until = 0, raf = 0;
  const tick = () => {
    raf = 0;
    const list = document.getAnimations().filter((a) => { const t = (a.effect as KeyframeEffect | null)?.target as Element | null; return !!t?.closest?.('.ul-glass'); });
    animMax = Math.max(animMax, list.length);
    list.forEach((a) => animNames.add((a as CSSTransition).transitionProperty || (a as CSSAnimation).animationName || a.id || 'web-animation'));
    if (performance.now() < until) raf = requestAnimationFrame(tick);
    render();
  };
  addEventListener('scroll', () => { until = performance.now() + 300; if (!raf) raf = requestAnimationFrame(tick); }, { passive: true, capture: true });
}

/* ---------- pixel capture ---------- */
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function oklch(r: number, gg: number, b: number) {
  const R = lin(r), G = lin(gg), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { C: Math.hypot(A, Bb), h: ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360, gx: gg - Math.max(r, b) };
}
let report = '';
export async function recordScroll(step = 20, frames = 30): Promise<string> {
  const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia(o: unknown): Promise<MediaStream> };
  let stream: MediaStream;
  try { stream = await md.getDisplayMedia({ video: { frameRate: 60 }, preferCurrentTab: true, selfBrowserSurface: 'include' }); }
  catch (e) { return (report = `capture refused: ${(e as Error).message}`); }
  const v = document.createElement('video'); v.muted = true; v.srcObject = stream; await v.play();
  await new Promise((r) => setTimeout(r, 300));
  const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' })!;
  c.width = v.videoWidth; c.height = v.videoHeight;
  const sx = c.width / innerWidth, sy = c.height / innerHeight;
  const surfaces = () => [...document.querySelectorAll<HTMLElement>('.ul-glass')].filter((el) => !el.parentElement?.closest('.ul-glass') && !el.closest('[data-ul-gd-panel]')).map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.width > 16 && r.height > 16 && r.bottom > 0 && r.top < innerHeight).slice(0, 16);
  const sample = () => {
    ctx.drawImage(v, 0, 0);
    return surfaces().map(({ el, r }) => {
      const x = Math.max(0, (r.left + 4) * sx), y = Math.max(0, (r.top + 4) * sy), w = Math.max(1, Math.min(c.width - x, (r.width - 8) * sx)), h = Math.max(1, Math.min(c.height - y, (r.height - 8) * sy));
      const d = ctx.getImageData(x, y, w, h).data; let R = 0, G = 0, B = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
      return { el, ...oklch(R / n, G / n, B / n) };
    });
  };
  const sc = (document.scrollingElement as HTMLElement);
  const rest = sample(), rows: { f: number; worst: number; dH: number; dC: number; gx: number }[] = [];
  for (let f = 0; f < frames; f++) {
    sc.scrollTop += step;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const cur = sample();
    let worst = 0, dH = 0, dC = 0, gx = 0;
    cur.forEach((s) => { const r0 = rest.find((x) => x.el === s.el); if (!r0) return; const jump = s.gx - r0.gx; if (jump > worst) { worst = jump; dH = Math.abs(((s.h - r0.h + 540) % 360) - 180); dC = s.C - r0.C; gx = s.gx; } });
    rows.push({ f, worst, dH, dC, gx });
  }
  stream.getTracks().forEach((t) => t.stop());
  const bad = rows.filter((r) => r.worst > 12);
  const p = (k: 'worst' | 'dC') => rows.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(rows.length * 0.95)] ?? 0;
  report = `${frames} frames @${step}px · ${rest.length} surfaces · switches: [${[...on].join(', ') || 'none'}]\n` +
    `green-excess jump p95 ${p('worst').toFixed(1)}/255 · max ${Math.max(0, ...rows.map((r) => r.worst)).toFixed(1)} · chroma Δ p95 ${p('dC').toFixed(3)} · flagged frames (>12) ${bad.length}` +
    (bad.length ? `\nfirst flagged: ${bad.slice(0, 4).map((r) => `#${r.f} +${r.worst.toFixed(0)} Δh ${r.dH.toFixed(0)}°`).join(', ')}` : '');
  (g as unknown as { __ulGlassReport: unknown }).__ulGlassReport = { rows, switches: [...on] };
  render();
  return report;
}

/* ---------- panel ---------- */
let panel: HTMLElement | null = null;
function render() {
  if (!panel) return;
  const st = panel.querySelector<HTMLElement>('[data-st]');
  if (st) st.textContent = `glass animations during scroll: max ${animMax}${animNames.size ? ` (${[...animNames].slice(0, 6).join(', ')})` : ''}` + (report ? `\n${report}` : '');
}
function buildPanel() {
  panel = document.createElement('div');
  panel.setAttribute('data-ul-gd-panel', '');
  panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;width:330px;max-height:70vh;overflow:auto;padding:12px;border-radius:12px;background:#0d1117;color:#e6edf3;font:12px/1.4 ui-monospace,monospace;box-shadow:0 8px 30px rgb(0 0 0/.5);';
  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>glass debug</b><button data-x style="background:none;border:0;color:#e6edf3;cursor:pointer;font:inherit">hide</button></div>';
  let grp = '';
  for (const f of FLAGS) {
    if (f.group !== grp) { grp = f.group; html += `<div style="margin:8px 0 2px;color:#8b949e">${grp}</div>`; }
    html += `<label style="display:flex;gap:6px;align-items:flex-start;padding:2px 0;cursor:pointer"><input type="checkbox" data-k="${f.key}"${on.has(f.key) ? ' checked' : ''}>${f.label}</label>`;
  }
  const q = new URLSearchParams(location.search).get('glass') ?? 'auto';
  html += `<div style="margin:8px 0 2px;color:#8b949e">Tier</div><select data-q style="width:100%;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:3px">${['auto', 'full', 'lite', 'flat'].map((o) => `<option${o === q ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
  html += '<div style="display:flex;gap:6px;margin-top:8px"><button data-rec="20" style="flex:1">Record 20px</button><button data-rec="3" style="flex:1">3px</button><button data-rec="1" style="flex:1">1px</button></div>';
  html += '<div style="display:flex;gap:6px;margin-top:6px"><button data-prec style="flex:1">Record pointer / wheel (5s)</button></div>';
  html += '<pre data-st style="white-space:pre-wrap;margin:8px 0 0;color:#a5d6ff"></pre>';
  panel.innerHTML = html;
  panel.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t.matches('[data-q]')) { const v = t.value; configureGlass({ forceQuality: v === 'auto' ? null : (v as 'full') }); return; }
    const k = t.getAttribute('data-k'); if (!k) return;
    if ((t as HTMLInputElement).checked) on.add(k); else on.delete(k);
    apply(); report = ''; render();
  });
  panel.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches('[data-x]')) panel!.style.display = 'none';
    const s = t.getAttribute('data-rec'); if (s) void recordScroll(+s, s === '20' ? 30 : 40);
    if (t.matches('[data-prec]')) { startGlassRecorder(); report = 'recording 5s: move the mouse / wheel now'; render(); setTimeout(() => { const r = stopGlassRecorder(); report = r ? `${r.frames} frames · p95 ${r.p95}ms · flagged ${r.flagged} (max ${r.maxSurfaces} surfaces, ${r.maxWritesPerFrame} writes / frame) · def frames ${r.defFrames} · anim frames ${r.animFrames}\n${r.examples.join('\n')}` : ''; render(); }, 5000); }
  });
  document.body.appendChild(panel);
  render();
}

export function initGlassDebug(): void {
  if (typeof location === 'undefined') return;
  const p = new URLSearchParams(location.search);
  const q = p.get('glass');
  if (q === 'full' || q === 'lite' || q === 'flat') configureGlass({ forceQuality: q });
  if (p.get('transparency') === 'reduce') document.documentElement.dataset.ulTransparency = 'reduce';
  if (!p.has('glassdebug')) return;
  const go = () => { watchAnimations(); buildPanel(); };
  if (document.body) go(); else addEventListener('DOMContentLoaded', go, { once: true });
}
/** Programmatic access for tests: set switches by key (same keys as the panel). */
export function setGlassDebug(keys: string[]): void { on.clear(); keys.forEach((k) => on.add(k)); apply(); }

/* ---------- write recorder (real mouse / wheel in the owner's browser) ----------
 * Per animation frame: which glass surfaces received a style write (setProperty / removeProperty / style or class
 * attribute), which properties, which filter-def attributes changed, and glass animations. Flags frames where more
 * than one surface was written. startGlassRecorder(); move the mouse / wheel; stopGlassRecorder() → report. */
type Frame = { t: number; writes: Map<Element, Set<string>>; defs: Set<string>; anims: number; stack?: string };
let rec: { frames: Frame[]; cur: Frame; raf: number; mo: MutationObserver; restore: () => void } | null = null;
const surfOf = (el: Element | null): Element | null => (el && el.closest ? el.closest('.ul-glass') : null);
const label = (el: Element) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ').filter((c) => c !== 'ul-glass')[0] || 'ul-glass'}`;
export function startGlassRecorder(): void {
  if (rec) return;
  const P = CSSStyleDeclaration.prototype, sp = P.setProperty, rp = P.removeProperty;
  const owner = new WeakMap<CSSStyleDeclaration, Element>();
  const find = (d: CSSStyleDeclaration) => { let o = owner.get(d); if (o) return o; for (const el of document.querySelectorAll<HTMLElement>('.ul-glass, .ul-glass *')) if (el.style === d) { owner.set(d, el); return el; } return null; };
  const note = (el: Element | null, prop: string) => {
    const s = surfOf(el); if (!s || !rec || s !== el) return; // the surface itself (its own style / class / data); content inside it is not glass state
    let set = rec.cur.writes.get(s); if (!set) { set = new Set(); rec.cur.writes.set(s, set); }
    set.add(el === s ? prop : `${label(el!)}>${prop}`);
    if (!rec.cur.stack && rec.cur.writes.size > 1) rec.cur.stack = (new Error().stack || '').split('\n').slice(3, 6).map((l) => l.trim().replace(/\(.*\//, '(')).join(' | ');
  };
  P.setProperty = function (this: CSSStyleDeclaration, k: string, v: string | null, pr?: string) { if (rec) { const el = find(this); if (el) note(el, k); } return sp.call(this, k, v, pr ?? ''); };
  P.removeProperty = function (this: CSSStyleDeclaration, k: string) { if (rec) { const el = find(this); if (el) note(el, '-' + k); } return rp.call(this, k); };
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      const t = m.target as Element;
      if (t.closest?.('[data-ul-glass-defs]')) { rec?.cur.defs.add(`${t.tagName}.${m.attributeName}`); continue; }
      if (m.attributeName === 'style') continue; // counted by the setProperty patch (cssText writes land here too, rarely)
      note(t, '@' + m.attributeName);
    }
  });
  mo.observe(document.documentElement, { subtree: true, attributes: true, attributeOldValue: false });
  const fresh = (): Frame => ({ t: performance.now(), writes: new Map(), defs: new Set(), anims: 0 });
  const tick = () => {
    if (!rec) return;
    mo.takeRecords().forEach(() => {});
    rec.cur.anims = document.getAnimations().filter((a) => { const t = (a.effect as KeyframeEffect | null)?.target as Element | null; return !!t && t.classList?.contains('ul-glass') && (a as CSSAnimation).animationName !== 'ul-spin'; }).length; // the surface or its ::before / ::after
    rec.frames.push(rec.cur); rec.cur = fresh();
    rec.raf = requestAnimationFrame(tick);
  };
  rec = { frames: [], cur: fresh(), raf: requestAnimationFrame(tick), mo, restore: () => { P.setProperty = sp; P.removeProperty = rp; } };
}
export interface RecorderReport { perFrame: { t: number; n: number; props: string[] }[]; frames: number; p95: number; flagged: number; maxSurfaces: number; maxWritesPerFrame: number; defFrames: number; animFrames: number; props: Record<string, number>; examples: string[] }
export function stopGlassRecorder(): RecorderReport | null {
  if (!rec) return null;
  cancelAnimationFrame(rec.raf); rec.mo.disconnect(); rec.restore();
  const F = rec.frames; rec = null;
  const dts = F.slice(1).map((f, i) => f.t - F[i].t).sort((a, b) => a - b);
  const props: Record<string, number> = {};
  F.forEach((f) => f.writes.forEach((set) => set.forEach((p) => { props[p] = (props[p] || 0) + 1; })));
  const flagged = F.filter((f) => f.writes.size > 1);
  const out: RecorderReport = {
    perFrame: F.map((f) => ({ t: f.t, n: f.writes.size, props: [...f.writes.values()].flatMap((x) => [...x]) })),
    frames: F.length, p95: +(dts[Math.floor(dts.length * 0.95)] ?? 0).toFixed(1), flagged: flagged.length,
    maxSurfaces: Math.max(0, ...F.map((f) => f.writes.size)),
    maxWritesPerFrame: Math.max(0, ...F.map((f) => [...f.writes.values()].reduce((n, s) => n + s.size, 0))),
    defFrames: F.filter((f) => f.defs.size).length, animFrames: F.filter((f) => f.anims).length, props,
    examples: flagged.slice(0, 4).map((f) => `${f.writes.size} surfaces: ${[...f.writes].slice(0, 4).map(([el, s]) => `${label(el)}{${[...s].join(',')}}`).join(' ')}${f.defs.size ? ' defs[' + [...f.defs].join(',') + ']' : ''} @ ${f.stack ?? ''}`),
  };
  (g as unknown as { __ulGlassRecord: unknown }).__ulGlassRecord = out;
  return out;
}
initGlassDebug();
