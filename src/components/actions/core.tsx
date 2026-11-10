/**
 * Async actions (Part 1): ONE core for every ready-made action component.
 * useAsyncAction = the state machine (idle → loading → success | error → idle), min loading time, double-submit guard,
 * interruption, controlled mode, timers cleared on unmount. ULActionButton = ULButton + the animated icon / label swap,
 * width morph, success ring, error shake, tooltip feedback (createAnchoredTooltip) and a polite live region.
 * No new overlay or animation system: tooltips are the shared anchored tooltip, the check is ULCheckMark, motion values
 * come from --ul-action-* tokens.
 */
import * as React from 'react';
import { ULButton, type ULButtonProps } from '../ULButton/ULButton.tsx';
import { ULCheckMark } from '../shared/ULCheckMark.tsx';
import { ULSpinner } from '../ULSpinner/ULSpinner.tsx';
import { Icon, cx } from '../shared/icons.tsx';
import { createAnchoredTooltip, type AnchoredTooltip } from '../ULTooltip/anchoredTooltip.ts';
import { springs } from '../../motion/spring.ts';
import { isMorphReduced } from '../../motion/anchoredMorph.ts';
import { setGlassGeometry, releaseGlassTier } from '../../glass/engine.ts';
import './actions.css';

/* ---------------- i18n (EN / SK / DE / CS) ---------------- */
const DICT = {
  en: { working: 'Working…', done: 'Done', failed: 'Something went wrong', retry: 'Retry', copy: 'Copy', copied: 'Copied', copiedLong: 'Copied to clipboard', copyFailed: "Couldn't copy", save: 'Save', saving: 'Saving…', saved: 'Saved', saveFailed: "Couldn't save", unsaved: 'Unsaved changes', savedNow: 'Saved just now', savedAgo: 'Saved {n} min ago', submit: 'Submit', submitting: 'Sending…', submitted: 'Sent', submitFailed: "Couldn't send", confirm: 'Confirm?', hold: 'Hold to confirm', typeToConfirm: 'Type {text} to confirm', cancel: 'Cancel', delete: 'Delete', download: 'Download', exporting: 'Exporting…', downloading: 'Downloading…', downloaded: 'Downloaded', downloadFailed: "Couldn't download", export: 'Export', format: 'Format', refresh: 'Refresh', refreshing: 'Refreshing…', updatedNow: 'Updated just now', updatedAgo: 'Updated {n} min ago', refreshFailed: "Couldn't refresh", share: 'Share', shared: 'Shared', linkCopied: 'Link copied', undo: 'Undo', undone: 'Undone', on: 'On', off: 'Off', changeFailed: "Couldn't change", publish: 'Publish', publishing: 'Publishing…', published: 'Published', unpublish: 'Unpublish', publishFailed: "Couldn't publish" },
  sk: { working: 'Pracuje sa…', done: 'Hotovo', failed: 'Niečo sa pokazilo', retry: 'Skúsiť znova', copy: 'Kopírovať', copied: 'Skopírované', copiedLong: 'Skopírované do schránky', copyFailed: 'Nepodarilo sa skopírovať', save: 'Uložiť', saving: 'Ukladá sa…', saved: 'Uložené', saveFailed: 'Nepodarilo sa uložiť', unsaved: 'Neuložené zmeny', savedNow: 'Uložené práve teraz', savedAgo: 'Uložené pred {n} min', submit: 'Odoslať', submitting: 'Odosiela sa…', submitted: 'Odoslané', submitFailed: 'Nepodarilo sa odoslať', confirm: 'Potvrdiť?', hold: 'Podržte na potvrdenie', typeToConfirm: 'Na potvrdenie napíšte {text}', cancel: 'Zrušiť', delete: 'Odstrániť', download: 'Stiahnuť', exporting: 'Exportuje sa…', downloading: 'Sťahuje sa…', downloaded: 'Stiahnuté', downloadFailed: 'Nepodarilo sa stiahnuť', export: 'Exportovať', format: 'Formát', refresh: 'Obnoviť', refreshing: 'Obnovuje sa…', updatedNow: 'Aktualizované práve teraz', updatedAgo: 'Aktualizované pred {n} min', refreshFailed: 'Nepodarilo sa obnoviť', share: 'Zdieľať', shared: 'Zdieľané', linkCopied: 'Odkaz skopírovaný', undo: 'Späť', undone: 'Vrátené späť', on: 'Zapnuté', off: 'Vypnuté', changeFailed: 'Zmena sa nepodarila', publish: 'Publikovať', publishing: 'Publikuje sa…', published: 'Publikované', unpublish: 'Zrušiť publikovanie', publishFailed: 'Nepodarilo sa publikovať' },
  de: { working: 'Wird ausgeführt…', done: 'Fertig', failed: 'Etwas ist schiefgelaufen', retry: 'Erneut versuchen', copy: 'Kopieren', copied: 'Kopiert', copiedLong: 'In die Zwischenablage kopiert', copyFailed: 'Kopieren fehlgeschlagen', save: 'Speichern', saving: 'Wird gespeichert…', saved: 'Gespeichert', saveFailed: 'Speichern fehlgeschlagen', unsaved: 'Ungespeicherte Änderungen', savedNow: 'Gerade gespeichert', savedAgo: 'Vor {n} Min. gespeichert', submit: 'Senden', submitting: 'Wird gesendet…', submitted: 'Gesendet', submitFailed: 'Senden fehlgeschlagen', confirm: 'Bestätigen?', hold: 'Zum Bestätigen halten', typeToConfirm: 'Zum Bestätigen {text} eingeben', cancel: 'Abbrechen', delete: 'Löschen', download: 'Herunterladen', exporting: 'Wird exportiert…', downloading: 'Wird heruntergeladen…', downloaded: 'Heruntergeladen', downloadFailed: 'Download fehlgeschlagen', export: 'Exportieren', format: 'Format', refresh: 'Aktualisieren', refreshing: 'Wird aktualisiert…', updatedNow: 'Gerade aktualisiert', updatedAgo: 'Vor {n} Min. aktualisiert', refreshFailed: 'Aktualisieren fehlgeschlagen', share: 'Teilen', shared: 'Geteilt', linkCopied: 'Link kopiert', undo: 'Rückgängig', undone: 'Rückgängig gemacht', on: 'An', off: 'Aus', changeFailed: 'Änderung fehlgeschlagen', publish: 'Veröffentlichen', publishing: 'Wird veröffentlicht…', published: 'Veröffentlicht', unpublish: 'Zurückziehen', publishFailed: 'Veröffentlichen fehlgeschlagen' },
  cs: { working: 'Pracuje se…', done: 'Hotovo', failed: 'Něco se pokazilo', retry: 'Zkusit znovu', copy: 'Kopírovat', copied: 'Zkopírováno', copiedLong: 'Zkopírováno do schránky', copyFailed: 'Nepodařilo se zkopírovat', save: 'Uložit', saving: 'Ukládá se…', saved: 'Uloženo', saveFailed: 'Nepodařilo se uložit', unsaved: 'Neuložené změny', savedNow: 'Uloženo právě teď', savedAgo: 'Uloženo před {n} min', submit: 'Odeslat', submitting: 'Odesílá se…', submitted: 'Odesláno', submitFailed: 'Nepodařilo se odeslat', confirm: 'Potvrdit?', hold: 'Podržte pro potvrzení', typeToConfirm: 'Pro potvrzení napište {text}', cancel: 'Zrušit', delete: 'Smazat', download: 'Stáhnout', exporting: 'Exportuje se…', downloading: 'Stahuje se…', downloaded: 'Staženo', downloadFailed: 'Nepodařilo se stáhnout', export: 'Exportovat', format: 'Formát', refresh: 'Obnovit', refreshing: 'Obnovuje se…', updatedNow: 'Aktualizováno právě teď', updatedAgo: 'Aktualizováno před {n} min', refreshFailed: 'Nepodařilo se obnovit', share: 'Sdílet', shared: 'Sdíleno', linkCopied: 'Odkaz zkopírován', undo: 'Zpět', undone: 'Vráceno zpět', on: 'Zapnuto', off: 'Vypnuto', changeFailed: 'Změna se nezdařila', publish: 'Publikovat', publishing: 'Publikuje se…', published: 'Publikováno', unpublish: 'Zrušit publikování', publishFailed: 'Nepodařilo se publikovat' },
};
export type ActionLocale = keyof typeof DICT;
export type ActionStringKey = keyof typeof DICT.en;
const pickLocale = (l?: string): ActionLocale => {
  const v = (l ?? (typeof document !== 'undefined' ? document.documentElement.lang : '') ?? 'en').slice(0, 2).toLowerCase();
  return (v in DICT ? v : 'en') as ActionLocale;
};
/** Localised action string (EN / SK / DE / CS), {n} / {text} replaced. */
export function actionText(key: ActionStringKey, locale?: string, vars: Record<string, string | number> = {}): string {
  let s: string = DICT[pickLocale(locale)][key] ?? DICT.en[key];
  for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
  return s;
}
/** "just now" / "n min ago" from a timestamp (min resolution; the components tick every 15s). */
export function agoText(t: number | null | undefined, now: (k: 'savedNow' | 'updatedNow') => string, ago: (n: number) => string, nowKey: 'savedNow' | 'updatedNow') {
  if (t == null) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? now(nowKey) : ago(m);
}
export function useTicker(ms: number, on = true) {
  const [, tick] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => { if (!on) return; const t = window.setInterval(tick, ms); return () => clearInterval(t); }, [ms, on]);
}

/* ---------------- tokens ---------------- */
const tok = (k: string, f: number) => {
  if (typeof document === 'undefined') return f;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k));
  return Number.isFinite(v) ? v : f;
};

/* ---------------- live region (one per document, polite; never pass secrets) ---------------- */
let live: HTMLElement | null = null, liveT = 0;
export function announce(msg: string) {
  if (typeof document === 'undefined' || !msg) return;
  if (!live || !live.isConnected) {
    live = document.createElement('div');
    live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('data-ul-action-live', '');
    live.className = 'ul-sr-only';
    document.body.appendChild(live);
  }
  clearTimeout(liveT);
  live.textContent = '';
  liveT = window.setTimeout(() => { if (live) live.textContent = msg; }, 40); // re-announces the same text
}

/* ---------------- state machine ---------------- */
export type ActionStatus = 'idle' | 'loading' | 'success' | 'error';
/** Throw / return this from an action to go back to idle without an error (validation failed, share sheet dismissed). */
export const ACTION_CANCEL = Symbol('ul-action-cancel');
export type CoalesceMode = 'none' | 'trailing' | 'leading-trailing';
export interface AsyncActionOptions<R = unknown> {
  successDuration?: number; errorDuration?: number; minLoadingMs?: number;
  /** A second run while loading is ignored. Default true. */
  preventDoubleSubmit?: boolean;
  /** none (default): one run per trigger (preventDoubleSubmit applies) · leading-trailing: the first trigger runs at once,
   *  triggers during the run collapse into ONE follow-up run · trailing: runs once after --ul-action-debounce-ms of quiet
   *  (or at --ul-action-debounce-max-wait-ms). */
  coalesce?: CoalesceMode;
  debounceMs?: number; maxWaitMs?: number;
  disabled?: boolean;
  /** Controlled status (the app owns the state). */
  status?: ActionStatus;
  onStatusChange?: (s: ActionStatus) => void;
  onSuccess?: (result: R) => void;
  onError?: (error: unknown) => void;
  /** Clear timers on unmount (no state updates after unmount). Default true. */
  resetOnUnmount?: boolean;
}
export interface AsyncAction<A extends unknown[]> {
  status: ActionStatus; error: unknown;
  /** Resolves to true (success), false (error), null (ignored / cancelled). */
  run: (...args: A) => Promise<boolean | null>;
  reset: () => void;
}
export function useAsyncAction<A extends unknown[] = unknown[], R = unknown>(fn: ((...args: A) => R | Promise<R>) | undefined, o: AsyncActionOptions<R> = {}): AsyncAction<A> {
  const [own, setOwn] = React.useState<ActionStatus>('idle');
  const [error, setError] = React.useState<unknown>(null);
  const controlled = o.status !== undefined;
  const status = controlled ? o.status! : own;
  const cur = React.useRef<ActionStatus>(status); cur.current = status;
  const timers = React.useRef<number[]>([]), token = React.useRef(0), alive = React.useRef(true);
  const opts = React.useRef(o); opts.current = o;
  const fnRef = React.useRef(fn); fnRef.current = fn;
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const follow = React.useRef<A | null>(null), deb = React.useRef({ t: 0, first: 0, args: null as A | null });
  React.useEffect(() => () => clearTimeout(deb.current.t), []);
  const set = (s: ActionStatus) => { cur.current = s; if (!opts.current.status) setOwn(s); opts.current.onStatusChange?.(s); };
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; if (opts.current.resetOnUnmount !== false) { clear(); token.current++; } }; }, []);
  const run = React.useCallback(async (...args: A) => {
    const O = opts.current;
    if (O.disabled || !fnRef.current) return null;
    const mode = O.coalesce ?? 'none';
    if (mode === 'trailing' && !(args as unknown[] & { __now?: boolean }).__now) { // quiet period, max wait for long bursts
      const d = deb.current, now = performance.now(), q = O.debounceMs ?? tok('--ul-action-debounce-ms', 350), mw = O.maxWaitMs ?? tok('--ul-action-debounce-max-wait-ms', 2000);
      if (!d.first) d.first = now; d.args = args; clearTimeout(d.t);
      d.t = window.setTimeout(() => { const a = d.args as A; d.first = 0; d.t = 0; (a as unknown[] & { __now?: boolean }).__now = true; void runRef.current(...a); }, Math.max(0, Math.min(q, d.first + mw - now)));
      return null;
    }
    if (cur.current === 'loading' && mode === 'leading-trailing') { follow.current = args; return null; }
    if (cur.current === 'loading' && O.preventDoubleSubmit !== false) return null;
    clear();
    const my = ++token.current, t0 = performance.now();
    set('loading'); setError(null);
    let ok = true, res: R | undefined, err: unknown;
    try { res = await fnRef.current(...args); } catch (e) { ok = false; err = e; }
    if (!ok && err === ACTION_CANCEL || res === (ACTION_CANCEL as unknown)) { if (alive.current && my === token.current) set('idle'); return null; }
    const min = O.minLoadingMs ?? tok('--ul-action-min-loading', 350), wait = min - (performance.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (!alive.current || my !== token.current) return null;
    if (ok) {
      set('success'); O.onSuccess?.(res as R);
      const d = O.successDuration ?? tok('--ul-action-success-duration', 1800);
      if (Number.isFinite(d)) timers.current.push(window.setTimeout(() => { if (my === token.current) set('idle'); }, actMs(d)));
    } else {
      setError(err); set('error'); O.onError?.(err);
      const d = O.errorDuration ?? tok('--ul-action-error-duration', 3000);
      if (Number.isFinite(d)) timers.current.push(window.setTimeout(() => { if (my === token.current) set('idle'); }, actMs(d)));
    }
    if (follow.current) { const a = follow.current; follow.current = null; window.setTimeout(() => void runRef.current(...a), 0); } // ONE follow-up, latest wins
    return ok;
  }, []);
  const runRef = React.useRef(run); runRef.current = run;
  const reset = React.useCallback(() => { clear(); token.current++; set('idle'); }, []);
  return { status, error, run, reset };
}

/* ---------------- coalesced value (spam-safe toggles) ----------------
 * The visible value changes on every click at once (optimistic); commit(final) runs ONCE after the quiet period (or at the
 * max wait); an even number of clicks commits nothing; one request in flight, clicks meanwhile only move the pending value
 * and settle into ONE follow-up (latest wins); a rejection rolls back to the last committed value. Flushed (never dropped)
 * on unmount, pagehide, tab hidden, blur (flushOnBlur) and flush(). */
export type CoalescedStatus = 'idle' | 'pending' | 'saving' | 'error';
export interface CoalescedOptions<T> {
  value?: T; defaultValue: T;
  commit: (v: T) => Promise<unknown> | unknown;
  mode?: CoalesceMode; debounceMs?: number; maxWaitMs?: number;
  equals?: (a: T, b: T) => boolean;
  onCommitted?: (v: T) => void; onError?: (e: unknown, rolledBackTo: T) => void; onStatusChange?: (s: CoalescedStatus) => void;
  errorDuration?: number;
}
export interface CoalescedAction<T> { value: T; committed: T; status: CoalescedStatus; error: unknown; set: (v: T) => void; flush: () => void }
export function useCoalescedAction<T>(o: CoalescedOptions<T>): CoalescedAction<T> {
  const eq = o.equals ?? Object.is, opts = React.useRef(o); opts.current = o;
  const r = React.useRef({ committed: o.value ?? o.defaultValue, visible: o.value ?? o.defaultValue, sent: undefined as T | undefined, inflight: false, t: 0, first: 0, et: 0, alive: true });
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  const [status, setStatusS] = React.useState<CoalescedStatus>('idle'), [error, setError] = React.useState<unknown>(null);
  const setStatus = (s: CoalescedStatus) => { if (!r.current.alive) return; setStatusS(s); opts.current.onStatusChange?.(s); };
  const render = () => { if (r.current.alive) force(); };
  // app-controlled value: adopt when nothing is pending or in flight
  React.useEffect(() => { const R = r.current; if (o.value !== undefined && !R.inflight && !R.t && !eq(o.value, R.committed)) { R.committed = R.visible = o.value; render(); } }, [o.value]);
  const fire = React.useCallback(() => {
    const R = r.current; clearTimeout(R.t); R.t = 0; R.first = 0;
    if (R.inflight) return; // the settle handler sends the follow-up
    if (eq(R.visible, R.committed)) { setStatus('idle'); return; }
    const v = R.visible; R.inflight = true; R.sent = v; setStatus('saving');
    Promise.resolve().then(() => opts.current.commit(v)).then(() => {
      R.inflight = false; R.committed = v; opts.current.onCommitted?.(v);
      if (!eq(R.visible, R.committed)) { if (!R.t) fire(); else setStatus('pending'); } else setStatus(R.t ? 'pending' : 'idle');
    }, (e) => {
      R.inflight = false; setError(e);
      if (!eq(R.visible, v) && !eq(R.visible, R.committed)) { opts.current.onError?.(e, R.committed); fire(); return; } // follow-up for a different value
      R.visible = R.committed; render(); opts.current.onError?.(e, R.committed); setStatus('error');
      clearTimeout(R.et); R.et = window.setTimeout(() => { if (status !== 'saving') setStatus(R.t ? 'pending' : 'idle'); }, opts.current.errorDuration ?? tok('--ul-action-error-duration', 3000));
    });
  }, []);
  const set = React.useCallback((v: T) => {
    const R = r.current, O = opts.current, mode = O.mode ?? 'trailing';
    R.visible = v; render();
    if (mode === 'none') { fire(); return; }
    const now = performance.now(), q = O.debounceMs ?? tok('--ul-action-debounce-ms', 350), mw = O.maxWaitMs ?? tok('--ul-action-debounce-max-wait-ms', 2000);
    if (!R.first) R.first = now;
    clearTimeout(R.t); R.t = window.setTimeout(fire, Math.max(0, Math.min(q, R.first + mw - now)));
    if (!R.inflight) setStatus('pending');
  }, []);
  const flush = React.useCallback(() => { if (r.current.t) fire(); }, []);
  React.useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide); const R = r.current; if (R.t) fire(); R.alive = false; clearTimeout(R.et); };
  }, []);
  return { value: r.current.visible, committed: r.current.committed, status, error, set, flush };
}

/* ---------------- feedback tooltip (the shared anchored tooltip, forced open, no focus steal) ---------------- */
export function useActionTooltip(btn: React.RefObject<HTMLElement | null>, hoverText?: string) {
  const hover = React.useRef<AnchoredTooltip | null>(null), forced = React.useRef<AnchoredTooltip | null>(null), t = React.useRef(0);
  React.useEffect(() => () => { clearTimeout(t.current); hover.current?.destroy(); forced.current?.destroy(); }, []);
  // hover / focus tooltip: created lazily on first pointer or focus (rows with many buttons pay nothing until then)
  React.useEffect(() => {
    const el = btn.current; if (!el || !hoverText) return;
    el.setAttribute('data-ul-tip', hoverText);
    const make = () => { if (!hover.current) { hover.current = createAnchoredTooltip({ container: el, layer: document.body, side: 'top' }); } };
    el.addEventListener('pointerenter', make, { once: true }); el.addEventListener('focusin', make, { once: true });
    return () => { el.removeEventListener('pointerenter', make); el.removeEventListener('focusin', make); };
  }, [hoverText]);
  React.useEffect(() => { const el = btn.current; if (el && hoverText) el.setAttribute('data-ul-tip', hoverText); }, [hoverText]);
  /** Show a message for --ul-action-tooltip ms; repeated calls restart the timer and swap the text without a re-enter. */
  return React.useCallback((msg: string, ms = tok('--ul-action-tooltip', 1600)) => {
    const el = btn.current; if (!el || !msg) return;
    hover.current?.hide();
    if (!forced.current) {
      const box = document.createElement('span'); // no events: only shown / hidden from here
      forced.current = createAnchoredTooltip({ container: box, layer: document.body, side: 'top', items: '[data-ul-act-msg]', text: (n) => n.getAttribute('data-ul-act-msg') || '' });
      forced.current.el.setAttribute('aria-hidden', 'true'); // the live region announces it
    }
    el.setAttribute('data-ul-act-msg', msg);
    forced.current.el.textContent = msg;
    forced.current.show(el);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => { forced.current?.hide(); el.removeAttribute('data-ul-act-msg'); }, ms);
  }, []);
}

/* ---------------- label cell: one glyph row, clipped, vertical swap ---------------- */
export function SwapText({ value, k, dir = 1 }: { value: React.ReactNode; k: string; dir?: 1 | -1 }) {
  const [view, setView] = React.useState<{ cur: React.ReactNode; ck: string; old: React.ReactNode | null; ok: string | null }>({ cur: value, ck: k, old: null, ok: null });
  if (k !== view.ck) setView({ cur: value, ck: k, old: view.cur, ok: view.ck });
  else if (value !== view.cur && k === view.ck) setView({ ...view, cur: value });
  React.useEffect(() => {
    if (view.old == null) return;
    const t = window.setTimeout(() => setView((v) => (v.ok === view.ok ? { ...v, old: null, ok: null } : v)), actMs(tok('--ul-action-swap', 220) + 40));
    return () => clearTimeout(t);
  }, [view.ok]);
  return (
    <span className="ul-act-label" data-dir={dir}>
      {view.old != null ? <span key={'o' + view.ok} className="ul-act-text" data-out="" aria-hidden="true">{view.old}</span> : null}
      <span key={'i' + view.ck} className="ul-act-text" data-in={view.old != null ? '' : undefined}>{view.cur}</span>
    </span>
  );
}

/* ---------------- success wave ----------------
 * A circular wave from the origin to the farthest corner (+ feather), clipped by the button's fx wrapper (.ul-btn-fx: inset 0,
 * radius inherit, overflow hidden, outside the refracted layer). ONE element per wave with three radial-gradient layers driven
 * by registered <length> properties (--ul-wave-r, -r2, -r3) on the frame clock: ring thickness is a constant px band (no
 * scale distortion), trailing wavelets 90 / 180ms behind, weaker and thinner. Removed when done (no leftover layers). */
/* ---------------- slow motion (showcase): one time scale for the ACTION animations only ----------------
 * Scales the wave, ring, shake, width morph, icon / label swaps, check draw and the success / error / swap timers.
 * Never touches lens, glass, press or morph timings (locked). 1 | 0.5 | 0.25. */
let actScale = 1;
export function setActionTimeScale(s: number) { actScale = s > 0 && s <= 1 ? s : 1; }
export const getActionTimeScale = () => actScale;
export const actMs = (ms: number) => ms / actScale;
const actAnim = (a: Animation | undefined) => { if (a && actScale !== 1) a.playbackRate = actScale; return a; };
/** CSS transitions / animations inside the action layers (body, fx, ring); never the button's own press / glass animations. */
export function scaleActionAnims(b: HTMLElement) { if (actScale === 1) return; b.querySelectorAll<HTMLElement>('.ul-act-body, .ul-btn-fx, .ul-act-ring').forEach((n) => n.getAnimations({ subtree: true }).forEach((a) => { a.playbackRate = actScale; })); }
export function clearWaves(host: HTMLElement) { host.querySelectorAll('.ul-wave').forEach((w) => { w.getAnimations().forEach((a) => a.cancel()); w.remove(); }); }
export function playWave(btn: HTMLElement, host: HTMLElement, reduced: boolean, at?: { x: number; y: number } | null) {
  const w = btn.offsetWidth, h = btn.offsetHeight; if (!w || !h) return;
  const ox = at ? Math.max(0, Math.min(w, at.x)) : w / 2, oy = at ? Math.max(0, Math.min(h, at.y)) : h / 2;
  const band = Math.max(8, Math.min(28, 0.3 * Math.hypot(w, h) / 2)), feather = band * 0.6;
  const R = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy)) + feather;
  const el = document.createElement('span');
  el.className = 'ul-wave'; el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `--wx:${ox.toFixed(1)}px;--wy:${oy.toFixed(1)}px;--ul-wave-band:${band.toFixed(1)}px;--ul-wave-feather:${feather.toFixed(1)}px;--ul-wave-max:${R.toFixed(1)}px`;
  if (reduced) { el.setAttribute('data-reduced', ''); host.appendChild(el); actAnim(el.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.4 }, { opacity: 0 }], { duration: 120 }))!.finished.then(() => el.remove(), () => el.remove()); return; }
  host.appendChild(el);
  const D = tok('--ul-action-ripple-ms', 620), F = tok('--ul-action-ripple-fade-ms', 240), ease = springs.smooth.toCSS();
  const grow = (prop: string, delay: number) => actAnim(el.animate([{ [prop]: '0px' }, { [prop]: `${R.toFixed(1)}px` }] as Keyframe[], { duration: D, delay, easing: ease, fill: 'both' }))!;
  const a = [grow('--ul-wave-r', 0), grow('--ul-wave-r2', 90), grow('--ul-wave-r3', 180),
    actAnim(el.animate([{ opacity: 1 }, { opacity: 1, offset: (D + 180) / (D + 180 + F) }, { opacity: 0 }], { duration: D + 180 + F, easing: 'linear', fill: 'both' }))!];
  Promise.all(a.map((x) => x.finished)).then(() => el.remove(), () => {});
}

/* ---------------- ULActionButton ---------------- */
export interface ActionSlots<T = React.ReactNode> { idle?: T; loading?: T; success?: T; error?: T }
// native onError (resource error event) is omitted: onError is the action's error callback (AsyncActionOptions)
export interface ULActionButtonProps extends Omit<ULButtonProps, 'onClick' | 'loading' | 'icon' | 'children' | 'onError'>, AsyncActionOptions {
  /** Sync or async; a throw / rejection is the error state. Receives the click event. */
  onAction?: (e: React.MouseEvent<HTMLButtonElement>) => unknown;
  /** Visible label per state. Default: children for idle, localised Working… / Done / Retry. */
  labels?: ActionSlots;
  /** Icon per state ({ idle, loading, success, error }); the icon cell swaps them (exit / enter). */ icons?: ActionSlots;
  /** Icon-only button (aria-label required). */
  iconOnly?: boolean;
  /** Idle label (the state labels come from `labels`). */ children?: React.ReactNode;
  /** inline = label + icon swap · tooltip = the anchored tooltip shows the message · both. Default inline. */
  feedback?: 'inline' | 'tooltip' | 'both';
  /** Tooltip / live-region message per state (string or from the error). Default: the state label as text. */
  messages?: { success?: string | ((r: unknown) => string); error?: string | ((e: unknown) => string); loading?: string };
  /** Hover / focus tooltip in idle (a hint, e.g. the shortcut). */
  tooltip?: string;
  /** Visual-only loading / success (optimistic toggles). */
  quiet?: boolean;
  /** morph (default): width springs to the new content · reserve: min-width of the widest label, neighbours never move. */
  widthMode?: 'morph' | 'reserve';
  /** Never put the value into any tooltip, title or announcement (copy). Messages stay generic. */
  sensitive?: boolean;
  /** "en" | "sk" | "de" | "cs" for the default state labels. Default "en". */ locale?: string;
  /** @internal tests / showcase: force a visual state. */
  forceStatus?: ActionStatus;
  /** Extra layers across the WHOLE button (inset 0, clipped to its radius, under the content): hold fill. */
  before?: React.ReactNode;
  /** success: the independent --ul-success tone (default) · accent: the button's accent. */
  successTone?: 'success' | 'accent';
  /** ripple: a band from the centre across the whole button · ring: one pulse outside the rim · none. Default "ripple" ("ring" when icon-only). */
  successEffect?: 'ripple' | 'ring' | 'none';
  /** Where the success wave starts: the button centre (default) or the click point (keyboard falls back to the centre). */
  successOrigin?: 'center' | 'pointer';
  /** Bypass the state machine (coalesced toggles drive their own state). */
  onPress?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Escape hatch for wrappers that run the action themselves. */
  actionRef?: React.MutableRefObject<AsyncAction<[React.MouseEvent<HTMLButtonElement>]> | null>;
}

const txtOf = (n: React.ReactNode) => (typeof n === 'string' || typeof n === 'number' ? String(n) : '');

export const ULActionButton = React.forwardRef<HTMLElement, ULActionButtonProps>(function ULActionButton(props, ref) {
  const { onAction, labels = {}, icons = {}, iconOnly, children, before, successTone = 'success', successEffect, successOrigin = 'center', onPress, coalesce, debounceMs, maxWaitMs, feedback = 'inline', messages = {}, tooltip, quiet, widthMode = 'morph', sensitive, locale, forceStatus, actionRef,
    successDuration, errorDuration, minLoadingMs, preventDoubleSubmit, disabledWhileLoading = true, status: ctl, onStatusChange, onSuccess, onError, resetOnUnmount,
    variant = 'secondary', className, disabled, type, ...rest } = props as ULActionButtonProps & { disabledWhileLoading?: boolean };
  const A = useAsyncAction<[React.MouseEvent<HTMLButtonElement>]>(onAction, { coalesce, debounceMs, maxWaitMs, successDuration, errorDuration, minLoadingMs, preventDoubleSubmit, disabled, status: forceStatus ?? ctl, onStatusChange, resetOnUnmount,
    onSuccess: (r) => { onSuccess?.(r); }, onError: (e) => { onError?.(e); } });
  if (actionRef) actionRef.current = A;
  const status = quiet && (A.status === 'loading' || A.status === 'success') ? 'idle' : A.status;
  const el = React.useRef<HTMLElement | null>(null);
  const setRef = (n: HTMLElement | null) => { el.current = n; if (typeof ref === 'function') ref(n); else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = n; };
  const showTip = useActionTooltip(el, status === 'idle' ? tooltip : undefined);
  // a button inside a popover / dialog returns to idle once its overlay has closed (no "Done" left over on reopen)
  React.useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail, b = el.current, t = e.target as Node | null;
      if (!b || !d || d.phase !== 'exit' || d.state !== 'end' || !t || !t.contains(b)) return;
      b.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      b.querySelectorAll('.ul-wave').forEach((w) => w.remove());
      A.reset();
    };
    document.addEventListener('ul:morph', on, true);
    return () => document.removeEventListener('ul:morph', on, true);
  }, []);
  const L = (k: ActionStringKey) => actionText(k, locale);
  const label: Record<ActionStatus, React.ReactNode> = { idle: labels.idle ?? children, loading: labels.loading ?? L('working'), success: labels.success ?? L('done'), error: labels.error ?? L('retry') };
  const inline = feedback !== 'tooltip';
  const shownLabel = inline ? label[status] : label.idle;
  // message for tooltip + live region (generic when sensitive)
  const msgFor = (s: ActionStatus, payload?: unknown) => {
    const m = s === 'success' ? messages.success : s === 'error' ? messages.error : messages.loading;
    const v = typeof m === 'function' ? m(payload) : m;
    return v ?? (s === 'success' ? txtOf(label.success) || L('done') : s === 'error' ? L('failed') : txtOf(label.loading));
  };
  // status side effects: announce, tooltip, ring pulse, shake, width morph
  const prev = React.useRef<ActionStatus>(status), w0 = React.useRef(0), origin = React.useRef<{ x: number; y: number } | null>(null);
  React.useLayoutEffect(() => {
    const b = el.current; if (!b) return;
    const was = prev.current; prev.current = status;
    const reduced = isMorphReduced();
    if (b.hasAttribute('data-reduced') !== reduced) b.toggleAttribute('data-reduced', reduced);
    if (was !== status) {
      if (status !== 'idle' && !quiet) { const m = msgFor(status, status === 'error' ? A.error : undefined); if (m && (status !== 'loading' || messages.loading)) announce(m); if (status !== 'loading' && feedback !== 'inline' && m) showTip(m); }
      if (status === 'error' && quiet) { const m = msgFor('error', A.error); announce(m); showTip(m); }
      const fxKind = successEffect ?? (iconOnly ? 'ring' : 'ripple');
      const host = b.querySelector<HTMLElement>('.ul-act-ripple');
      if (host) clearWaves(host); // a new state change during the wave restarts cleanly
      if (status === 'success' && !quiet && fxKind === 'ripple' && host) playWave(b, host, reduced, origin.current);
      origin.current = null;
      if (!reduced && status === 'success' && !quiet && fxKind === 'ring') actAnim(b.querySelector<HTMLElement>('.ul-act-ring')?.animate([{ opacity: 0, transform: 'scale(1)' }, { opacity: 0.85, transform: 'scale(1.04)', offset: 0.35 }, { opacity: 0, transform: 'scale(1.1)' }], { duration: tok('--ul-action-ring-duration', 700), easing: 'ease-out' }));
      if (!reduced && status === 'error') { const s = tok('--ul-action-shake', 3); actAnim(b.animate([0, -s, s, -s * 0.66, s * 0.66, 0].map((x) => ({ translate: `${x}px 0` })), { duration: tok('--ul-action-shake-duration', 320), easing: 'ease-out', composite: 'add' })); }
      // width morph: from the width before this state to the measured width of the new content
      if (widthMode === 'morph' && w0.current) {
        const w1 = b.offsetWidth;
        if (Math.abs(w1 - w0.current) > 0.5) {
          const D = reduced ? 0 : tok('--ul-action-swap', 220) * 1.4;
          if (D) {
            b.setAttribute('data-ul-morphing', '');
            let raf = 0; const tick = () => { setGlassGeometry(b, b.offsetWidth, b.offsetHeight); raf = requestAnimationFrame(tick); }; tick();
            const a = actAnim(b.animate([{ width: `${w0.current}px` }, { width: `${w1}px` }], { duration: D, easing: 'cubic-bezier(.2,.9,.25,1.05)' }))!;
            const end = () => { cancelAnimationFrame(raf); b.removeAttribute('data-ul-morphing'); setGlassGeometry(b); releaseGlassTier(b); };
            a.finished.then(end, end);
          }
        }
      }
    }
    // width is only needed for the morph; never force a layout per button on mount (a table can hold hundreds): first read is deferred to a frame
    if (widthMode === 'morph') { if (was !== status) w0.current = b.offsetWidth; else requestAnimationFrame(() => { if (b.isConnected) w0.current = b.offsetWidth; }); }
    if (was !== status) { scaleActionAnims(b); requestAnimationFrame(() => scaleActionAnims(b)); }
  }, [status]);
  const busy = status === 'loading' && !quiet;
  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // wave origin: the click point (pointer) when asked and the click came from a pointer; keyboard → centre
    if (successOrigin === 'pointer' && e.detail > 0) { const r = e.currentTarget.getBoundingClientRect(); origin.current = { x: e.clientX - r.left, y: e.clientY - r.top }; } else origin.current = null;
    if (onPress) { onPress(e); return; }
    if (busy && coalesce !== 'leading-trailing' && (preventDoubleSubmit !== false || disabledWhileLoading)) { e.preventDefault(); return; }
    if (forceStatus) return;
    if (onAction) void A.run(e);
  };
  const ic = (s: ActionStatus) => (s === 'loading' ? icons.loading ?? <ULSpinner /> : s === 'success' ? icons.success ?? null : s === 'error' ? icons.error ?? <Icon name="alert" /> : icons.idle ?? null);
  const hasIdleIcon = icons.idle != null;
  const iconCell = (
    <span className="ul-act-icon" data-empty={!hasIdleIcon && status === 'idle' && widthMode !== 'reserve' ? '' : undefined} aria-hidden="true">
      <span className="ul-act-ic" data-on={status === 'idle' ? '' : undefined}>{ic('idle')}</span>
      <span className="ul-act-ic" data-on={status === 'loading' ? '' : undefined}>{status === 'loading' || icons.loading ? ic('loading') : null}</span>
      <span className="ul-act-ic" data-on={status === 'success' ? '' : undefined}>{icons.success ?? <ULCheckMark checked={status === 'success'} />}</span>
      <span className="ul-act-ic" data-on={status === 'error' ? '' : undefined}>{ic('error')}</span>
    </span>
  );
  const reserve = widthMode === 'reserve' && inline && !iconOnly
    ? <span className="ul-act-reserve" aria-hidden="true">{(['idle', 'loading', 'success', 'error'] as ActionStatus[]).map((s) => <span key={s}>{label[s]}</span>)}</span> : null;
  return (
    <ULButton ref={setRef as React.Ref<HTMLElement>} {...rest} type={type} variant={status === 'error' && !quiet ? 'destructive' : variant} disabled={disabled}
      shape={rest.shape ?? (iconOnly ? 'circle' : undefined)}
      className={cx('ul-act', className)} data-status={status} data-tone={successTone} data-fx={successEffect ?? (iconOnly ? 'ring' : 'ripple')}
      layers={<>{before}<span className="ul-act-ripple"></span></>} data-act-icon={iconOnly ? '' : undefined} aria-busy={busy || undefined} aria-disabled={busy && disabledWhileLoading ? true : rest['aria-disabled']}
      onClick={onClick}>
      <span className="ul-act-body">
        {iconCell}
        {iconOnly ? null : <span className="ul-act-labels">{reserve}<SwapText value={shownLabel} k={inline ? status : 'idle'} dir={status === 'idle' ? -1 : 1} /></span>}
      </span>
      <span className="ul-act-ring" aria-hidden="true"></span>
    </ULButton>
  );
});
