import * as React from 'react';
import { ULGlass } from '../../glass/ULGlass.tsx';
import { ACCENT_PRESETS, type Backdrop } from '../../glass/accent.tsx';
import type { Material } from '../../glass/material.tsx';
import { guardAccent } from '../../glass/contrast.ts';
import { setGlassGeometry, releaseGlassTier } from '../../glass/engine.ts';
import { isMorphReduced, getMorphTimeScale, overshootEase } from '../../motion/anchoredMorph.ts';
import type { AnchoredMorph } from '../../motion/anchoredMorph.ts';
import { useMediaQuery } from '../../hooks/useReducedMotion.ts';
import { ULAnchoredSurface } from '../ULAnchoredSurface/ULAnchoredSurface.tsx';
import { createNavIndicator, type NavIndicator } from '../ULIsland/navIndicator.ts';
import { ULTextField } from '../ULField/ULField.tsx';
import { ULSlider } from '../ULSlider/ULSlider.tsx';
import { ULCheckMark } from '../shared/ULCheckMark.tsx';
import { Icon, ULIcon, cx, useDomId } from '../shared/icons.tsx';
import './ULPickers.css';

/* =====================================================================
 * Date picker, date range picker, color picker. Glass trigger, anchored surface (portal, overlay = full refraction,
 * reading variant by default, menu-type scroll lock). Nothing is stored: values live in props / component state only.
 * ONE calendar grid (CalendarGrid) serves both date pickers.
 * ===================================================================== */
export type PickerLocale = 'en' | 'sk' | 'de' | 'cs' | (string & {});
/** EN uses en-GB formats (day-month order, Monday first) for the European audience; pass "en-US" for US formats. */
const LOCALES: Record<string, string> = { en: 'en-GB', sk: 'sk-SK', de: 'de-DE', cs: 'cs-CZ' };
const loc = (l?: string) => LOCALES[l ?? 'en'] ?? l ?? 'en-GB';
const firstDay = (l: string) => {
  try { const wi = (new Intl.Locale(l) as Intl.Locale & { weekInfo?: { firstDay: number }; getWeekInfo?: () => { firstDay: number } }); const f = wi.getWeekInfo?.().firstDay ?? wi.weekInfo?.firstDay; if (f) return f % 7; } catch { /* older engines */ }
  return /-US$/.test(l) ? 0 : 1;
};
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a?: Date | null, b?: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => { const t = new Date(d.getFullYear(), d.getMonth() + n, 1); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last)); };
const monthOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthDiff = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
const clampDate = (d: Date, min?: Date, max?: Date) => (min && d < day0(min) ? day0(min) : max && d > day0(max) ? day0(max) : d);
/** Roving-focus target: the date clamped to min / max, then the nearest ENABLED date (forward first, then back). Never a disabled day. */
const enabledNear = (d: Date, min?: Date, max?: Date, dis?: (d: Date) => boolean) => {
  const c = clampDate(day0(d), min, max), ok = (x: Date) => !((min && x < day0(min)) || (max && x > day0(max)) || dis?.(x));
  for (let i = 0; i < 62; i++) { const f = addDays(c, i), b = addDays(c, -i); if (ok(f)) return f; if (ok(b)) return b; }
  return c;
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayDiff = (a: Date, b: Date) => Math.round((day0(b).getTime() - day0(a).getTime()) / 864e5);

type Txt = {
  choose: string; prev: string; next: string; today: string; chooseRange: string; clear: string; start: string; end: string; inRange: string;
  liveStart: (d: string) => string; liveRange: (a: string, b: string) => string; liveCancel: string;
  presets: string; p: Record<PresetKey, string>; custom: string; adjusted: string; chosen: string; applied: string; sv: string; svText: (s: number, v: number) => string; hue: string; hex: string; eyedropper: string;
};
const TXT: Record<string, Txt> = {
  en: { choose: 'Choose a date', prev: 'Previous month', next: 'Next month', today: 'today', chooseRange: 'Choose dates', clear: 'Clear dates', start: 'start date', end: 'end date', inRange: 'in range',
    liveStart: (d) => `Start date ${d}, choose an end date`, liveRange: (a, b) => `Selected ${a} to ${b}`, liveCancel: 'Selection cancelled',
    presets: 'Quick ranges', p: { today: 'Today', last7: 'Last 7 days', last30: 'Last 30 days', thisMonth: 'This month', lastMonth: 'Last month' },
    custom: 'Custom color', adjusted: 'Adjusted for contrast', chosen: 'Chosen', applied: 'Applied', sv: 'Saturation and brightness', svText: (s, v) => `Saturation ${s} %, brightness ${v} %`, hue: 'Hue', hex: 'Hex', eyedropper: 'Pick a color from the screen' },
  sk: { choose: 'Vyberte dátum', prev: 'Predchádzajúci mesiac', next: 'Nasledujúci mesiac', today: 'dnes', chooseRange: 'Vyberte dátumy', clear: 'Vymazať dátumy', start: 'začiatok', end: 'koniec', inRange: 'v rozsahu',
    liveStart: (d) => `Začiatok ${d}, vyberte koniec`, liveRange: (a, b) => `Vybrané ${a} až ${b}`, liveCancel: 'Výber zrušený',
    presets: 'Rýchly výber', p: { today: 'Dnes', last7: 'Posledných 7 dní', last30: 'Posledných 30 dní', thisMonth: 'Tento mesiac', lastMonth: 'Minulý mesiac' },
    custom: 'Vlastná farba', adjusted: 'Upravené pre kontrast', chosen: 'Zvolená', applied: 'Použitá', sv: 'Sýtosť a jas', svText: (s, v) => `Sýtosť ${s} %, jas ${v} %`, hue: 'Odtieň', hex: 'Hex', eyedropper: 'Vybrať farbu z obrazovky' },
  de: { choose: 'Datum wählen', prev: 'Vorheriger Monat', next: 'Nächster Monat', today: 'heute', chooseRange: 'Zeitraum wählen', clear: 'Datum löschen', start: 'Startdatum', end: 'Enddatum', inRange: 'im Zeitraum',
    liveStart: (d) => `Startdatum ${d}, wählen Sie ein Enddatum`, liveRange: (a, b) => `Ausgewählt ${a} bis ${b}`, liveCancel: 'Auswahl abgebrochen',
    presets: 'Schnellauswahl', p: { today: 'Heute', last7: 'Letzte 7 Tage', last30: 'Letzte 30 Tage', thisMonth: 'Dieser Monat', lastMonth: 'Letzter Monat' },
    custom: 'Eigene Farbe', adjusted: 'Für Kontrast angepasst', chosen: 'Gewählt', applied: 'Verwendet', sv: 'Sättigung und Helligkeit', svText: (s, v) => `Sättigung ${s} %, Helligkeit ${v} %`, hue: 'Farbton', hex: 'Hex', eyedropper: 'Farbe vom Bildschirm wählen' },
  cs: { choose: 'Vyberte datum', prev: 'Předchozí měsíc', next: 'Následující měsíc', today: 'dnes', chooseRange: 'Vyberte data', clear: 'Vymazat data', start: 'začátek', end: 'konec', inRange: 'v rozsahu',
    liveStart: (d) => `Začátek ${d}, vyberte konec`, liveRange: (a, b) => `Vybráno ${a} až ${b}`, liveCancel: 'Výběr zrušen',
    presets: 'Rychlý výběr', p: { today: 'Dnes', last7: 'Posledních 7 dní', last30: 'Posledních 30 dní', thisMonth: 'Tento měsíc', lastMonth: 'Minulý měsíc' },
    custom: 'Vlastní barva', adjusted: 'Upraveno pro kontrast', chosen: 'Zvolená', applied: 'Použitá', sv: 'Sytost a jas', svText: (s, v) => `Sytost ${s} %, jas ${v} %`, hue: 'Odstín', hex: 'Hex', eyedropper: 'Vybrat barvu z obrazovky' },
};
const txtOf = (l: string) => TXT[String(l).slice(0, 2)] ?? TXT.en;

/* ---------------- shared calendar ---------------- */
interface Cal { L: string; fd: number; t: Txt; weekdays: Date[]; wdShort: Intl.DateTimeFormat; wdLong: Intl.DateTimeFormat; fmtLong: Intl.DateTimeFormat; fmtMonth: Intl.DateTimeFormat }
function useCal(locale: PickerLocale): Cal {
  const L = loc(locale);
  return React.useMemo(() => {
    const fd = firstDay(L), base = new Date(2024, 0, 7 + fd);
    return { L, fd, t: txtOf(locale), weekdays: Array.from({ length: 7 }, (_, i) => addDays(base, i)), wdShort: new Intl.DateTimeFormat(L, { weekday: 'short' }), wdLong: new Intl.DateTimeFormat(L, { weekday: 'long' }), fmtLong: new Intl.DateTimeFormat(L, { dateStyle: 'full' }), fmtMonth: new Intl.DateTimeFormat(L, { month: 'long', year: 'numeric' }) };
  }, [L, locale]);
}
const weeksOf = (month: Date, fd: number) => { const f = monthOf(month), s = addDays(f, -((f.getDay() - fd + 7) % 7)); return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(s, w * 7 + d))); };

/** The day the key event came from (DOM focus is the truth; state can lag when the window has no system focus). */
const dateOfEvent = (e: React.KeyboardEvent) => { const d = (e.target as Element).closest?.<HTMLElement>('.ul-cal-day')?.dataset.date; return d ? new Date(d + 'T00:00') : null; };
/** Start day for a key press: the DOM-focused day, unless DOM focus has not caught up with the previous key yet (fast repeats). */
function keyFrom(e: React.KeyboardEvent, k: { target: Date | null; next: Date | null; t?: number }, focus: Date) {
  const tg = dateOfEvent(e);
  // only a FAST repeat (DOM focus not caught up yet) continues from the previous result; a stale ref from an earlier press /
  // an earlier open must never win over the day that actually has DOM focus
  const fresh = k.t != null && performance.now() - k.t < 150;
  return fresh && k.target && k.next && tg && sameDay(tg, k.target) && !sameDay(tg, k.next) ? k.next : tg ?? focus;
}
/** Move DOM focus to an enabled day by DATE (the roving state is set too). Never relies on focus events: without system focus
 *  Chromium defers focus / focusin, so state that waited for onFocus went stale and an equal-state move never refocused. */
function focusDayNode(box: HTMLElement | null, d: Date, sel = '.ul-cal-day') {
  requestAnimationFrame(() => {
    const b = box?.querySelector<HTMLButtonElement>(`${sel}[data-date="${iso(d)}"]`);
    if (b && !b.disabled && document.activeElement !== b) b.focus({ preventScroll: true });
  });
}
/** Keyboard move with disabled days skipped (same direction). null = key not handled. */
function moveKey(focus: Date, e: React.KeyboardEvent, fd: number, off: (d: Date) => boolean, min?: Date, max?: Date): Date | null {
  const k = e.key; let n: Date | null = null, step = 0;
  if (k === 'ArrowLeft') step = -1; else if (k === 'ArrowRight') step = 1; else if (k === 'ArrowUp') step = -7; else if (k === 'ArrowDown') step = 7;
  if (step) n = addDays(focus, step);
  else if (k === 'PageUp' || k === 'PageDown') { n = addMonths(focus, (k === 'PageUp' ? -1 : 1) * (e.shiftKey ? 12 : 1)); step = k === 'PageUp' ? -1 : 1; }
  else if (k === 'Home') { n = addDays(focus, -((focus.getDay() - fd + 7) % 7)); step = 1; }
  else if (k === 'End') { n = addDays(focus, 6 - ((focus.getDay() - fd + 7) % 7)); step = -1; }
  if (!n) return null;
  n = clampDate(n, min, max);
  for (let i = 0; i < 62 && off(n); i++) { const m = clampDate(addDays(n, step > 0 ? 1 : -1), min, max); if (sameDay(m, n)) break; n = m; }
  return off(n) ? focus : n;
}

interface DayState { selected?: boolean; start?: boolean; end?: boolean; mid?: boolean }
interface GridProps {
  month: Date; cal: Cal; focus: Date; today: Date; titleId: string; hideOutside?: boolean; band?: boolean;
  off: (d: Date) => boolean; state: (d: Date) => DayState; bead?: boolean;
  onPick: (d: Date) => void; onFocusDay: (d: Date) => void; onKeyDown: (e: React.KeyboardEvent) => void;
}
/** One month as role=grid. Rows are role=row (6 always, so the height never changes); band layers live inside the rows. */
function CalendarGrid({ month, cal, focus, today, titleId, hideOutside, band, off, state, bead, onPick, onFocusDay, onKeyDown }: GridProps) {
  const { t } = cal, weeks = weeksOf(month, cal.fd), m = month.getMonth();
  return (
    <div role="grid" aria-labelledby={titleId} className="ul-cal-grid" onKeyDown={onKeyDown}>
      <div role="row" className="ul-cal-row ul-cal-wd">
        {cal.weekdays.map((d) => <span key={d.getDay()} role="columnheader" aria-label={cal.wdLong.format(d)} className="ul-cal-wdn">{cal.wdShort.format(d).replace('.', '').slice(0, 2)}</span>)}
      </div>
      {weeks.map((w, wi) => (
        <div key={wi} role="row" className="ul-cal-row" data-week={wi}>
          {band ? <><span className="ul-band" data-k="firm" aria-hidden="true"></span><span className="ul-band" data-k="preview" aria-hidden="true"></span></> : null}
          {w.map((d, ci) => {
            const other = d.getMonth() !== m;
            if (other && hideOutside) return <div key={ci} role="gridcell" className="ul-cal-cell" data-empty=""></div>;
            const st = state(d), isFocus = sameDay(d, focus), dis = off(d), isToday = sameDay(d, today);
            const sel = !!(st.selected || st.start || st.end || st.mid);
            const lab = `${cal.fmtLong.format(d)}${st.start ? `, ${t.start}` : ''}${st.end ? `, ${t.end}` : ''}${st.mid ? `, ${t.inRange}` : ''}${isToday ? `, ${t.today}` : ''}`;
            return (
              <div key={ci} role="gridcell" className="ul-cal-cell" aria-selected={sel || undefined}>
                <button type="button" tabIndex={isFocus ? 0 : -1} className="ul-cal-day" data-date={iso(d)} data-selected={st.selected ? '' : undefined}
                  data-endpoint={st.start || st.end ? '' : undefined} data-mid={st.mid ? '' : undefined} data-outside={other ? '' : undefined} data-today={isToday ? '' : undefined}
                  disabled={dis} aria-label={lab} aria-current={isToday ? 'date' : undefined}
                  onClick={(e) => { // the picked day takes focus: Safari / touch / programmatic clicks do not focus buttons, and Esc, arrows and Enter
                    // are handled inside the popper (closeOnEscape is off while picking), so focus must be in the grid after a pointer pick
                    const host = e.currentTarget.closest<HTMLElement>('.ul-anchored'); if (document.activeElement !== e.currentTarget) e.currentTarget.focus({ preventScroll: true }); onPick(d);
                    // the pick can re-render / re-key the months (commit, view change): focus the picked DATE again, not the old node
                    requestAnimationFrame(() => { const a = document.activeElement; if (host && (!a || a === document.body || !host.contains(a))) host.querySelector<HTMLButtonElement>(`.ul-cal-day[data-date="${iso(d)}"]:not([disabled])`)?.focus({ preventScroll: true }); }); }} onFocus={() => { if (!isFocus) onFocusDay(d); }}>
                  {bead && st.selected ? <ULGlass as="span" aria-hidden="true" tier="sm" radius="50%" className="ul-cal-sel" materialCategory="overlays" accentStrength="vivid" /> : null}
                  <span className="ul-cal-num">{d.getDate()}</span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Date picker ---------------- */
export interface ULDatePickerProps {
  /** Visible label (required for an accessible name unless inside ULField). */ label: string;
  /** Controlled date; null = empty. */ value?: Date | null;
  /** Initial date when uncontrolled. */ defaultValue?: Date | null;
  /** Called with the picked date. */ onValueChange?: (d: Date) => void;
  /** Calendar locale ("en" | "sk" | "de" | "cs"): month names, week start. Default "en". */ locale?: PickerLocale;
  /** Earliest / lowest allowed value. */ min?: Date;
  /** Latest / highest allowed value. */ max?: Date;
  /** Return true to disable a date (e.g. weekends). Disabled dates are skipped by keyboard moves. */ isDateDisabled?: (d: Date) => boolean;
  /** Placeholder shown while empty. */ placeholder?: string;
  /** Help text under the control (aria-describedby). */ helper?: React.ReactNode;
  /** Error message; sets aria-invalid and replaces the helper. Inside ULField the field owns the message. */ error?: React.ReactNode;
  /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean;
  /** Backdrop hint for the glass: "dark" | "mid" | "light". Default "light" for pickers. */ backdrop?: Backdrop;
  /** Extra class on the root element. */ className?: string;
  /** Inline style on the root element. */ style?: React.CSSProperties;
  /** Id of the control (labels and messages are linked to it). Default: generated. */ id?: string;
  /** @internal open on mount (showcase). */
  defaultOpen?: boolean;
  /** Trigger material "flat" | "glass" (inputs category); the picker popover stays glass (overlays). @default undefined (resolved: "flat") */
  material?: Material;
}
/**
 * Grid keys: ← → ±1 day, ↑ ↓ ±1 week, PageUp / PageDown ±1 month (Shift: ±1 year), Home / End start / end of week,
 * Enter / Space pick, Esc close (focus returns to the trigger). Disabled days are skipped.
 */
export function ULDatePicker({ label, value, defaultValue = null, onValueChange, locale = 'en', min, max, isDateDisabled, placeholder, helper, error, disabled, backdrop = 'light', className, style, id, defaultOpen, material }: ULDatePickerProps) {
  const cal = useCal(locale), t = cal.t;
  const [own, setOwn] = React.useState<Date | null>(defaultValue);
  const v = value === undefined ? own : value;
  const [open, setOpen] = React.useState(!!defaultOpen);
  const [focus, setFocus] = React.useState<Date>(() => enabledNear(v ?? new Date(), min, max, isDateDisabled));
  const keyRef = React.useRef<{ target: Date | null; next: Date | null; t?: number }>({ target: null, next: null });
  const trig = React.useRef<HTMLElement | null>(null);
  const box = React.useRef<HTMLDivElement | null>(null);
  const uid = useDomId('ul-dp', id);
  const today = day0(new Date());
  const fmtShort = React.useMemo(() => new Intl.DateTimeFormat(cal.L, { day: 'numeric', month: 'short', year: 'numeric' }), [cal.L]);
  const off = (d: Date) => !!((min && d < day0(min)) || (max && d > day0(max)) || isDateDisabled?.(d));
  const openIt = () => { setFocus(enabledNear(v ?? new Date(), min, max, isDateDisabled)); setOpen(true); };
  const close = (refocus = true) => { setOpen(false); if (refocus) trig.current?.focus(); };
  const pick = (d: Date) => { if (off(d)) return; if (value === undefined) setOwn(d); onValueChange?.(d); close(); };
  React.useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => box.current?.querySelector<HTMLButtonElement>('.ul-cal-day[tabindex="0"]')?.focus({ preventScroll: true })));
    return () => cancelAnimationFrame(r);
  }, [open, focus.getTime()]);
  const onGridKey = (e: React.KeyboardEvent) => {
    const from = keyFrom(e, keyRef.current, focus);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(from); return; }
    const n = moveKey(from, e, cal.fd, off, min, max);
    keyRef.current = { target: dateOfEvent(e), next: n, t: performance.now() };
    if (n) { e.preventDefault(); setFocus(n); focusDayNode(box.current, n); }
  };
  return (
    <div className={cx('ul-picker', className)} style={style} data-invalid={error ? '' : undefined}>
      <span id={`${uid}-l`} className="ul-select-label">{label}</span>
      <ULGlass ref={trig} as="button" type="button" id={uid} tier="sm" radius="var(--ul-control-radius)" interactive={!disabled} pressable={!disabled} pressScale={0.98} material={material} materialCategory="inputs"
        className="ul-select-trigger" disabled={disabled} data-open={open ? '' : undefined} accent={error ? 'var(--ul-color-danger)' : undefined}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${uid}-dlg` : undefined} aria-labelledby={`${uid}-l ${uid}-v`}
        aria-describedby={error || helper ? `${uid}-m` : undefined} aria-invalid={error ? true : undefined}
        onClick={() => (open ? close() : openIt())}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); openIt(); } }}>
        <span className="ul-picker-icon" aria-hidden="true"><Icon name="calendar" /></span>
        <span id={`${uid}-v`} className="ul-select-value" data-placeholder={v ? undefined : ''}>{v ? fmtShort.format(v) : placeholder ?? t.choose}</span>
        <span className="ul-btn-ring" aria-hidden="true" />
      </ULGlass>
      {error ? <p id={`${uid}-m`} className="ul-select-msg" data-tone="error" aria-live="polite">{error}</p> : helper ? <p id={`${uid}-m`} className="ul-select-msg">{helper}</p> : null}
      <ULAnchoredSurface scrollBehavior="lock" open={open} anchorRef={trig} onClose={() => close()} side="bottom" align="start" backdrop={backdrop} role="dialog" id={`${uid}-dlg`} aria-modal="false" aria-label={label} className="ul-picker-surface">
        <div ref={box} className="ul-cal">
          <div className="ul-cal-head">
            <button type="button" className="ul-cal-nav" aria-label={t.prev} onClick={() => setFocus(clampDate(addMonths(focus, -1), min, max))}><Icon name="chevron-left" /></button>
            <h2 id={`${uid}-month`} className="ul-cal-month" aria-live="polite">{cal.fmtMonth.format(focus)}</h2>
            <button type="button" className="ul-cal-nav" aria-label={t.next} onClick={() => setFocus(clampDate(addMonths(focus, 1), min, max))}><Icon name="chevron-right" /></button>
          </div>
          <CalendarGrid month={focus} cal={cal} focus={focus} today={today} titleId={`${uid}-month`} off={off} bead
            state={(d) => ({ selected: sameDay(d, v) })} onPick={pick} onFocusDay={setFocus} onKeyDown={onGridKey} />
        </div>
      </ULAnchoredSurface>
    </div>
  );
}

/* ---------------- Date range picker ---------------- */
export interface DateRange { start: Date; end: Date }
export type PresetKey = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth';
const PRESETS: PresetKey[] = ['today', 'last7', 'last30', 'thisMonth', 'lastMonth'];
const presetRange = (k: PresetKey, today: Date): DateRange => {
  if (k === 'today') return { start: today, end: today };
  if (k === 'last7') return { start: addDays(today, -6), end: today };
  if (k === 'last30') return { start: addDays(today, -29), end: today };
  if (k === 'thisMonth') return { start: monthOf(today), end: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
  const p = addMonths(monthOf(today), -1); return { start: p, end: new Date(p.getFullYear(), p.getMonth() + 1, 0) };
};
export interface ULDateRangePickerProps {
  /** Visible label (required for an accessible name unless inside ULField). */ label: string;
  /** Controlled range { start, end }; null = empty. */ value?: DateRange | null;
  /** Initial range when uncontrolled. */ defaultValue?: DateRange | null;
  /** Fires once per committed range (when the end is chosen, a preset is picked or the field is cleared). The hover / focus preview never changes the value. */
  onValueChange?: (r: DateRange | null) => void;
  /** Calendar locale ("en" | "sk" | "de" | "cs"): month names, week start. Default "en". */ locale?: PickerLocale;
  /** Earliest / lowest allowed value. */ min?: Date;
  /** Latest / highest allowed value. */ max?: Date;
  /** Return true to disable a date (e.g. weekends). Disabled dates are skipped by keyboard moves. */ isDateDisabled?: (d: Date) => boolean;
  /** Months side by side. Default 2; automatically 1 below 640px, where the popper becomes a bottom sheet. */
  months?: 1 | 2;
  /** Quick-range chips (true = all five, or a subset in order). */
  presets?: boolean | PresetKey[];
  /** Clear button in the trigger. Default true. */
  clearable?: boolean;
  /** Placeholder shown while empty. */ placeholder?: string;
  /** Help text under the control (aria-describedby). */ helper?: React.ReactNode;
  /** Error message; sets aria-invalid and replaces the helper. Inside ULField the field owns the message. */ error?: React.ReactNode;
  /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean;
  /** Backdrop hint for the glass: "dark" | "mid" | "light". Default "light" for pickers. */ backdrop?: Backdrop;
  /** Extra class on the root element. */ className?: string;
  /** Inline style on the root element. */ style?: React.CSSProperties;
  /** Id of the control (labels and messages are linked to it). Default: generated. */ id?: string;
  /** @internal */
  defaultOpen?: boolean;
  /** Trigger material "flat" | "glass" (inputs category); the picker popover stays glass (overlays). @default undefined (resolved: "flat") */
  material?: Material;
}

const nmb = (el: Element, k: string, f: number) => { const v = parseFloat(getComputedStyle(el).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };

/**
 * Band controller: per visible week row and layer (firm | preview), ONE element whose clip-path inset (left, right)
 * follows its target on a critically damped first-order follow (--ul-range-follow). No per-day backgrounds. Rows before
 * the range collapse at their right end, rows after it at their left end, so a growing band wraps row to row and
 * continues across both months. Geometry comes from the cells' offsets (rows are the offset parents).
 */
class Bands {
  box: HTMLElement; rows: { el: HTMLElement; days: { t: number; l: number; r: number }[]; W: number; L: Record<string, HTMLElement>; s: Record<string, { x0: number; x1: number; t0: number; t1: number; vis: boolean }> }[] = [];
  raf = 0; last = 0; tgt: Record<string, [number, number] | null> = { firm: null, preview: null };
  constructor(box: HTMLElement) { this.box = box; }
  bind() {
    this.rows = [...this.box.querySelectorAll<HTMLElement>('.ul-range-track > .ul-range-month .ul-cal-row[data-week]')].map((el) => {
      const days = [...el.querySelectorAll<HTMLElement>('.ul-cal-day')].map((b) => { const c = b.parentElement as HTMLElement; return { t: new Date(b.dataset.date + 'T00:00').getTime(), l: c.offsetLeft, r: c.offsetLeft + c.offsetWidth }; });
      const L: Record<string, HTMLElement> = {}; el.querySelectorAll<HTMLElement>('.ul-band').forEach((b) => { L[b.dataset.k!] = b; });
      return { el, days, W: el.clientWidth, L, s: { firm: { x0: 0, x1: 0, t0: 0, t1: 0, vis: false }, preview: { x0: 0, x1: 0, t0: 0, t1: 0, vis: false } } };
    });
    this.retarget(true);
  }
  set(k: 'firm' | 'preview', a: Date | null, b?: Date | null, snap = false) {
    this.tgt[k] = a ? [Math.min(day0(a).getTime(), day0(b ?? a).getTime()), Math.max(day0(a).getTime(), day0(b ?? a).getTime())] : null;
    this.retarget(snap, k);
  }
  private retarget(snap: boolean, only?: string) {
    const pad = 2;
    for (const row of this.rows) for (const k of ['firm', 'preview']) {
      if (only && k !== only) continue;
      const st = row.s[k], g = this.tgt[k];
      if (!row.days.length || !g) { st.t0 = st.t1 = st.x0; if (!g) { st.x0 = st.x1 = st.t0; } }
      else {
        const inn = row.days.filter((d) => d.t >= g[0] && d.t <= g[1]);
        if (inn.length) { st.t0 = inn[0].l + pad; st.t1 = inn[inn.length - 1].r - pad; }
        else if (row.days[row.days.length - 1].t < g[0]) st.t0 = st.t1 = row.days[row.days.length - 1].r - pad;
        else st.t0 = st.t1 = row.days[0].l + pad;
      }
      if (snap || isMorphReduced()) { st.x0 = st.t0; st.x1 = st.t1; }
      this.write(row, k);
    }
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  }
  private write(row: Bands['rows'][number], k: string) {
    const st = row.s[k], el = row.L[k]; if (!el) return;
    const vis = st.x1 - st.x0 > 1;
    if (vis !== st.vis) { st.vis = vis; el.style.opacity = vis ? '' : '0'; }
    if (vis) el.style.clipPath = `inset(0 ${(row.W - st.x1).toFixed(2)}px 0 ${st.x0.toFixed(2)}px round 999px)`;
  }
  private tick = (now: number) => {
    this.raf = 0;
    const tau = nmb(this.box, '--ul-range-follow', 70) * getMorphTimeScale(), dt = Math.min(48, now - this.last); this.last = now;
    const a = 1 - Math.exp(-dt / Math.max(1, tau));
    let moving = false;
    for (const row of this.rows) for (const k of ['firm', 'preview']) {
      const st = row.s[k];
      if (Math.abs(st.t0 - st.x0) < 0.25 && Math.abs(st.t1 - st.x1) < 0.25) { if (st.x0 !== st.t0 || st.x1 !== st.t1) { st.x0 = st.t0; st.x1 = st.t1; this.write(row, k); } continue; }
      st.x0 += (st.t0 - st.x0) * a; st.x1 += (st.t1 - st.x1) * a; moving = true; this.write(row, k);
    }
    if (moving) this.raf = requestAnimationFrame(this.tick);
  };
  destroy() { cancelAnimationFrame(this.raf); }
}

/**
 * Range selection: first click sets the start (a flattened lens bead grows on it), hover / focus previews the band, the
 * second click sets the end (band firms up, the days in between ripple, the end gets its bead; earlier than the start =
 * swapped). A click on a complete range starts a new one (old band fades). Esc while picking cancels and restores the
 * previous range; otherwise Esc closes. onValueChange fires once per commit.
 * Glass inside the popper: the two beads and ONE shared hover / focus lens. Day cells are flat buttons.
 */
export function ULDateRangePicker({ label, value, defaultValue = null, onValueChange, locale = 'en', min, max, isDateDisabled, months = 2, presets, clearable = true, placeholder, helper, error, disabled, backdrop = 'light', className, style, id, defaultOpen, material }: ULDateRangePickerProps) {
  const cal = useCal(locale), t = cal.t;
  const narrow = useMediaQuery('(max-width: 640px)');
  const n = narrow ? 1 : months;
  const [own, setOwn] = React.useState<DateRange | null>(defaultValue);
  const v = value === undefined ? own : value;
  const [open, setOpen] = React.useState(!!defaultOpen);
  const today = day0(new Date());
  const init = () => enabledNear(v?.start ?? today, min, max, isDateDisabled);
  const [focus, setFocus] = React.useState<Date>(init);
  const keyRef = React.useRef<{ target: Date | null; next: Date | null; t?: number }>({ target: null, next: null });
  const [view, setView] = React.useState<Date>(() => monthOf(init()));
  const [draft, setDraft] = React.useState<Date | null>(null);
  const [live, setLive] = React.useState('');
  const trig = React.useRef<HTMLButtonElement | null>(null);
  const box = React.useRef<HTMLDivElement | null>(null);
  const lens = React.useRef<HTMLElement | null>(null);
  const beadEls = [React.useRef<HTMLElement | null>(null), React.useRef<HTMLElement | null>(null)];
  const bands = React.useRef<Bands | null>(null);
  const slide = React.useRef<{ dir: number; ghost: HTMLElement | null }>({ dir: 0, ghost: null });
  const commitT = React.useRef(0);
  const uid = useDomId('ul-dr', id);
  const fmtTrig = React.useMemo(() => new Intl.DateTimeFormat(cal.L, { day: 'numeric', month: 'short' }), [cal.L]);
  const fmtTrigY = React.useMemo(() => new Intl.DateTimeFormat(cal.L, { day: 'numeric', month: 'short', year: 'numeric' }), [cal.L]);
  const fmtLive = React.useMemo(() => new Intl.DateTimeFormat(cal.L, { day: 'numeric', month: 'long' }), [cal.L]);
  const seg = (d: Date) => (d.getFullYear() === today.getFullYear() ? fmtTrig : fmtTrigY).format(d);
  const off = (d: Date) => !!((min && d < day0(min)) || (max && d > day0(max)) || isDateDisabled?.(d));
  const monthsShown = Array.from({ length: n }, (_, i) => addMonths(view, i));
  const lastShown = monthsShown[n - 1];
  const canPrev = !min || monthDiff(monthOf(min), view) > 0, canNext = !max || monthDiff(lastShown, monthOf(max)) > 0;
  const plist = presets === true ? PRESETS : Array.isArray(presets) ? presets : [];

  const commit = (r: DateRange | null) => { if (value === undefined) setOwn(r); onValueChange?.(r); };
  const close = (refocus = true) => { setOpen(false); if (refocus) trig.current?.focus(); };
  const openIt = () => { const f = init(); setFocus(f); setView(monthOf(f)); setDraft(null); setOpen(true); };
  /** View change with the direction-aware slide + crossfade (old months cloned into a ghost layer). */
  const goView = (next: Date, dir: number, moveFocus = false) => {
    next = monthOf(next);
    if (monthDiff(view, next) === 0) return;
    if (moveFocus) { const k = monthDiff(next, monthOf(focus)); if (k < 0 || k >= n) { const m = k < 0 ? next : addMonths(next, n - 1); setFocus(clampDate(new Date(m.getFullYear(), m.getMonth(), Math.min(focus.getDate(), new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate())), min, max)); } }
    const track = box.current?.querySelector<HTMLElement>('.ul-range-track');
    if (track && !isMorphReduced()) {
      slide.current.ghost?.remove();
      const g = document.createElement('div'); g.className = 'ul-range-ghost'; g.setAttribute('aria-hidden', 'true'); g.setAttribute('inert', '');
      track.querySelectorAll(':scope > .ul-range-month').forEach((m) => { const c = m.cloneNode(true) as HTMLElement; c.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id')); c.querySelectorAll('[tabindex]').forEach((x) => x.setAttribute('tabindex', '-1')); g.appendChild(c); });
      track.appendChild(g); slide.current = { dir, ghost: g };
    }
    setView(next);
  };
  const ensureVisible = (d: Date) => {
    const k = monthDiff(view, monthOf(d));
    if (k < 0) goView(monthOf(d), -1); else if (k >= n) goView(addMonths(monthOf(d), -(n - 1)), 1);
  };
  const preview = (d: Date | null) => { if (draft && bands.current) bands.current.set('preview', draft, d ?? draft); };

  const pick = (d: Date) => {
    if (off(d)) return;
    setFocus(d); // roving focus follows the picked day, so the refocus effect lands on it (not on the previous tabindex=0 day / body)
    if (!draft) {
      setDraft(d);
      setLive(t.liveStart(fmtLive.format(d)));
      return;
    }
    const a = d < draft ? d : draft, b = d < draft ? draft : d;
    setDraft(null);
    commitT.current = performance.now();
    commit({ start: a, end: b });
    setLive(t.liveRange(fmtLive.format(a), fmtLive.format(b)));
  };
  const cancel = () => { setDraft(null); setLive(t.liveCancel); };
  const onGridKey = (e: React.KeyboardEvent) => {
    const from = keyFrom(e, keyRef.current, focus);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(from); return; }
    const nx = moveKey(from, e, cal.fd, off, min, max);
    keyRef.current = { target: dateOfEvent(e), next: nx, t: performance.now() };
    if (nx) { e.preventDefault(); setFocus(nx); ensureVisible(nx); preview(nx); focusDayNode(box.current, nx, '.ul-range-track > .ul-range-month .ul-cal-day'); }
  };
  const onRootKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    if (draft) cancel(); else close();
  };

  // keep DOM focus on the focused day while open
  React.useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => {
      const bx = box.current, b = bx?.querySelector<HTMLButtonElement>('.ul-range-track > .ul-range-month .ul-cal-day[tabindex="0"]'), a = document.activeElement;
      const inSurface = !!a && !!bx?.closest('.ul-anchored')?.contains(a);
      if (b && a !== b && (!inSurface || (bx!.contains(a) && !(a as HTMLElement).classList.contains('ul-cal-nav')))) b.focus({ preventScroll: true });
    }));
    return () => cancelAnimationFrame(r);
  }, [open, focus.getTime(), view.getTime()]);
  React.useEffect(() => { if (!open) setDraft(null); }, [open]);

  // hover lens + band controller (one per open)
  React.useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => {
      const b = box.current; if (!b) return;
      bands.current = new Bands(b); bands.current.bind();
      if (lens.current) ind.current = createNavIndicator({ container: b, lens: lens.current, items: '.ul-range-track > .ul-range-month .ul-cal-day:not(:disabled)' });
      sync(true);
    });
    return () => { cancelAnimationFrame(r); bands.current?.destroy(); bands.current = null; ind.current?.destroy(); ind.current = null; };
  }, [open]);
  const ind = React.useRef<NavIndicator | null>(null);

  /* endpoint beads: two slots, keyed by date; a new endpoint takes a free slot and grows, a removed one fades */
  const slots = React.useRef<(number | null)[]>([null, null]);
  const placeBeads = (animateNew: boolean) => {
    const b = box.current; if (!b) return;
    const ends = draft ? [draft] : v ? (sameDay(v.start, v.end) ? [v.start] : [v.start, v.end]) : [];
    const want = ends.map((d) => day0(d).getTime());
    const keep = slots.current.map((s) => (s != null && want.includes(s) ? s : null));
    const fresh = want.filter((w) => !keep.includes(w));
    const next = keep.slice(); const grown: number[] = [];
    fresh.forEach((w) => { const i = next.indexOf(null); if (i >= 0) { next[i] = w; grown.push(i); } });
    const offIn = (el: HTMLElement) => { let x = 0, y = 0, n2: HTMLElement | null = el; while (n2 && n2 !== b) { x += n2.offsetLeft; y += n2.offsetTop; n2 = n2.offsetParent as HTMLElement | null; } return { x, y }; };
    next.forEach((w, i) => {
      const el = beadEls[i].current; if (!el) return;
      const btn = w != null ? b.querySelector<HTMLElement>(`.ul-range-track > .ul-range-month .ul-cal-day[data-date="${iso(new Date(w))}"]`) : null;
      if (!btn) {
        if (slots.current[i] != null && el.style.opacity !== '0' && !isMorphReduced()) el.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.7)' }], { duration: nmb(b, '--ul-check-exit', 140) * getMorphTimeScale(), easing: 'ease-in' });
        el.style.opacity = '0'; return;
      }
      const cell = btn.parentElement as HTMLElement, o = offIn(cell), inset = 3;
      Object.assign(el.style, { left: `${o.x + inset}px`, top: `${o.y + inset}px`, width: `${cell.offsetWidth - 2 * inset}px`, height: `${cell.offsetHeight - 2 * inset}px`, opacity: '1' });
      if (animateNew && grown.includes(i) && !isMorphReduced()) {
        el.getAnimations().forEach((a) => a.cancel());
        el.animate([{ transform: 'scale(.45)', opacity: 0.2 }, { transform: 'scale(1)', opacity: 1 }], { duration: nmb(b, '--ul-range-bead-grow', 360) * getMorphTimeScale(), easing: overshootEase(nmb(b, '--ul-range-bead-overshoot', 0.08)) });
      }
    });
    slots.current = next;
  };
  /** Push value / draft into beads and bands. */
  const sync = (snap: boolean) => {
    const B = bands.current, b = box.current; if (!B || !b) return;
    if (draft) { b.setAttribute('data-picking', ''); B.set('preview', draft, focusIsHover.current ?? draft, false); }
    else { b.removeAttribute('data-picking'); B.set('firm', v?.start ?? null, v?.end ?? null, true); }
    placeBeads(!snap);
  };
  const focusIsHover = React.useRef<Date | null>(null);
  const prevDraft = React.useRef<Date | null>(null);
  React.useLayoutEffect(() => {
    if (!open || !bands.current) { prevDraft.current = draft; return; }
    const B = bands.current, b = box.current!;
    if (draft && !prevDraft.current) { focusIsHover.current = null; B.set('preview', draft, draft, true); b.setAttribute('data-picking', ''); }
    if (!draft && prevDraft.current) {
      b.removeAttribute('data-picking');
      B.set('firm', v?.start ?? null, v?.end ?? null, true);
      if (v && performance.now() - commitT.current < 100) ripple(v);
    }
    prevDraft.current = draft;
    placeBeads(true);
  }, [draft, v?.start?.getTime(), v?.end?.getTime()]);
  const ripple = (r: DateRange) => {
    const b = box.current; if (!b || isMorphReduced()) return;
    const step = nmb(b, '--ul-range-ripple-step', 12) * getMorphTimeScale(), cap = nmb(b, '--ul-range-ripple-max', 180) * getMorphTimeScale();
    b.querySelectorAll<HTMLElement>('.ul-range-track > .ul-range-month .ul-cal-day[data-mid] .ul-cal-num').forEach((num) => {
      const d = new Date((num.parentElement as HTMLElement).dataset.date + 'T00:00');
      num.animate([{ opacity: 0.55, transform: 'scale(.86)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 240 * getMorphTimeScale(), delay: Math.min(cap, dayDiff(r.start, d) * step), easing: overshootEase(0.06), fill: 'backwards' });
    });
  };

  // after a view change: rebind bands to the new rows, slide old (ghost) out and new in, re-place beads
  React.useLayoutEffect(() => {
    if (!open) return;
    const b = box.current; if (!b) return;
    bands.current?.bind(); ind.current?.update();
    if (draft) bands.current?.set('preview', draft, focusIsHover.current ?? focus, true);
    const { dir, ghost } = slide.current;
    const months = [...b.querySelectorAll<HTMLElement>('.ul-range-track > .ul-range-month')];
    const beads = beadEls.map((r) => r.current).filter(Boolean) as HTMLElement[];
    if (ghost && dir) {
      const D = nmb(b, '--ul-range-slide', 280) * getMorphTimeScale(), sh = nmb(b, '--ul-range-slide-shift', 18);
      ghost.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-dir * sh}px)` }], { duration: D * 0.7, easing: 'cubic-bezier(.3,0,.7,1)', fill: 'forwards' }).finished.then(() => ghost.remove(), () => ghost.remove());
      months.forEach((m) => m.animate([{ opacity: 0, transform: `translateX(${dir * sh}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: D, easing: 'cubic-bezier(.2,.7,.2,1)' }));
      beads.forEach((el) => el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: D }));
      slide.current = { dir: 0, ghost: null };
    }
    placeBeads(false);
  }, [view.getTime(), n]);

  const onOver = (e: React.PointerEvent) => {
    if (!draft || e.pointerType === 'touch') return;
    const btn = (e.target as Element).closest<HTMLElement>('.ul-cal-day:not(:disabled)');
    if (!btn || !btn.dataset.date) return;
    const d = new Date(btn.dataset.date + 'T00:00');
    if (focusIsHover.current && sameDay(focusIsHover.current, d)) return;
    focusIsHover.current = d; preview(d);
  };

  const state = (d: Date): DayState => {
    if (draft) return { start: sameDay(d, draft) };
    if (!v) return {};
    const s = sameDay(d, v.start), e2 = sameDay(d, v.end);
    return { start: s, end: e2, mid: !s && !e2 && d > v.start && d < v.end };
  };
  const pressed = (k: PresetKey) => { const r = presetRange(k, today); return !!v && sameDay(v.start, r.start) && sameDay(v.end, r.end); };
  const pickPreset = (k: PresetKey) => {
    const r = presetRange(k, today); if (off(r.start) || off(r.end)) return;
    setDraft(null); commitT.current = performance.now(); commit(r);
    setFocus(r.start); const m = monthDiff(view, monthOf(r.start)); if (m < 0 || m >= n) goView(monthOf(r.start), m < 0 ? -1 : 1);
    setLive(t.liveRange(fmtLive.format(r.start), fmtLive.format(r.end)));
  };

  return (
    <div className={cx('ul-picker ul-range', className)} style={style} data-invalid={error ? '' : undefined}>
      <span id={`${uid}-l`} className="ul-select-label">{label}</span>
      <ULGlass as="div" tier="sm" radius="var(--ul-control-radius)" interactive={!disabled} material={material} materialCategory="inputs" className="ul-select-trigger ul-range-trigger" data-open={open ? '' : undefined} data-disabled={disabled || undefined} accent={error ? 'var(--ul-color-danger)' : undefined}>
        <button ref={trig} type="button" id={uid} className="ul-range-open" disabled={disabled}
          aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${uid}-dlg` : undefined} aria-labelledby={`${uid}-l ${uid}-v`}
          aria-describedby={error || helper ? `${uid}-m` : undefined} aria-invalid={error ? true : undefined}
          onClick={() => (open ? close() : openIt())} onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); openIt(); } }}>
          <span className="ul-picker-icon" aria-hidden="true"><Icon name="calendar" /></span>
          <span id={`${uid}-v`} className="ul-select-value ul-range-value" data-placeholder={v ? undefined : ''}>
            {v ? <><span className="ul-range-seg">{seg(v.start)}</span><span className="ul-range-sep" aria-hidden="true">–</span><span className="ul-range-seg">{seg(v.end)}</span></> : placeholder ?? t.chooseRange}
          </span>
        </button>
        {clearable && v && !disabled ? <button type="button" className="ul-range-clear" aria-label={t.clear} onClick={() => { commit(null); setLive(''); trig.current?.focus(); }}><Icon name="x" /></button> : null}
        <span className="ul-btn-ring" aria-hidden="true" />
      </ULGlass>
      {error ? <p id={`${uid}-m`} className="ul-select-msg" data-tone="error" aria-live="polite">{error}</p> : helper ? <p id={`${uid}-m`} className="ul-select-msg">{helper}</p> : null}
      <ULAnchoredSurface scrollBehavior="lock" open={open} anchorRef={trig as React.RefObject<HTMLElement | null>} onClose={() => close(false)} closeOnEscape={false}
        side="bottom" align="start" layout={narrow ? 'bottom' : undefined} offset={narrow ? 8 : undefined} backdrop={backdrop}
        role="dialog" id={`${uid}-dlg`} aria-modal="false" aria-label={label} className="ul-picker-surface ul-range-surface" data-months={n}>
        <div className="ul-range-pop" onKeyDown={onRootKey}>
          {plist.length ? (
            <div role="group" aria-label={t.presets} className="ul-range-presets">
              {plist.map((k) => (
                <button key={k} type="button" className="ul-range-chip" aria-pressed={pressed(k)} onClick={() => pickPreset(k)}>
                  <ULCheckMark checked={pressed(k)} className="ul-chip-check" />{t.p[k]}
                </button>
              ))}
            </div>
          ) : null}
          <div ref={box} className="ul-range-months" onPointerOver={onOver}>
            <ULGlass as="span" ref={lens} aria-hidden="true" tier="sm" radius="999px" className="ul-range-lens" materialCategory="overlays" />
            <ULGlass as="span" ref={beadEls[0]} aria-hidden="true" tier="sm" radius="999px" accentStrength="vivid" materialCategory="overlays" className="ul-range-bead" style={{ opacity: 0 }} />
            <ULGlass as="span" ref={beadEls[1]} aria-hidden="true" tier="sm" radius="999px" accentStrength="vivid" materialCategory="overlays" className="ul-range-bead" style={{ opacity: 0 }} />
            <div className="ul-range-track">
              {monthsShown.map((m, i) => (
                <div key={iso(m)} className="ul-range-month">
                  <div className="ul-cal-head">
                    {i === 0 ? <button type="button" className="ul-cal-nav" aria-label={t.prev} disabled={!canPrev} onClick={() => goView(addMonths(view, -1), -1, true)}><Icon name="chevron-left" /></button> : <span className="ul-cal-navslot" aria-hidden="true"></span>}
                    <h2 id={`${uid}-m${i}`} className="ul-cal-month">{cal.fmtMonth.format(m)}</h2>
                    {i === n - 1 ? <button type="button" className="ul-cal-nav" aria-label={t.next} disabled={!canNext} onClick={() => goView(addMonths(view, 1), 1, true)}><Icon name="chevron-right" /></button> : <span className="ul-cal-navslot" aria-hidden="true"></span>}
                  </div>
                  <CalendarGrid month={m} cal={cal} focus={focus} today={today} titleId={`${uid}-m${i}`} hideOutside band off={off} state={state}
                    onPick={pick} onFocusDay={(d) => { setFocus(d); if (draft) { focusIsHover.current = d; preview(d); } }} onKeyDown={onGridKey} />
                </div>
              ))}
            </div>
          </div>
          <div className="ul-sr-only" role="status" aria-live="polite">{live}</div>
        </div>
      </ULAnchoredSurface>
    </div>
  );
}

/* ---------------- Color picker ---------------- */
export interface ULColorPickerProps {
  /** Visible label (required for an accessible name unless inside ULField). */ label: string;
  /** A preset name (ice, violet, …) or a hex color. */
  value?: string;
  /** Initial colour (accent name or #hex) when uncontrolled. */ defaultValue?: string;
  /** Called with the picked accent name or #hex (custom colours go through guardAccent). */ onValueChange?: (v: string) => void;
  /** Preset names (ice, violet, …) or objects; `{ value, disabled: true }` shows a preset that cannot be picked (skipped by arrow keys). */
  presets?: readonly (string | ULColorPreset)[];
  /** "Custom color" expander (2D field, hue, hex, eyedropper). Default true. */
  allowCustom?: boolean;
  /** Names for presets / UI text. */
  names?: Partial<Record<string, string>>;
  /** Calendar locale ("en" | "sk" | "de" | "cs"): month names, week start. Default "en". */ locale?: PickerLocale;
  /** Label of the hex input. Default: localised ("Hex" in English). */ hexLabel?: string;
  /** Message for an invalid hex value. Default localised. */ invalidHex?: string;
  /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean;
  /** Backdrop hint for the glass: "dark" | "mid" | "light". Default "light" for pickers. */ backdrop?: Backdrop;
  /** Extra class on the root element. */ className?: string;
  /** Inline style on the root element. */ style?: React.CSSProperties;
  /** Id of the control (labels and messages are linked to it). Default: generated. */ id?: string;
  /** @internal */
  defaultOpen?: boolean;
  /** @internal open with the custom panel expanded */
  defaultExpanded?: boolean;
  /** Trigger material "flat" | "glass" (inputs category); the picker popover stays glass (overlays). @default undefined (resolved: "flat") */
  material?: Material;
}
export interface ULColorPreset { value: string; disabled?: boolean; label?: string }
const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;
const toHex = (s: string) => { const m = s.trim().match(HEX); if (!m) return null; let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return `#${h.toLowerCase()}`; };
const swatch = (v: string) => (HEX.test(v) ? toHex(v)! : `var(--ul-accent-${v})`);
type HSV = { h: number; s: number; v: number };
const hsvToHex = ({ h, s, v }: HSV) => {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
};
const hexToHsv = (hex: string): HSV => {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round((h * 60 + 360) % 360), s: mx ? d / mx : 0, v: mx };
};
const PIPETTE = <ULIcon name="pipette" />;

/**
 * Presets as a radio group (arrow keys) plus a "Custom color" button that EXPANDS the same surface (height morphs to the
 * measured content size, content fades + slides in; reverse on collapse). Esc: first collapses, second closes.
 * Custom colours go through the contrast guard: if one would break the target it is clamped into the safe OKLCH range and
 * a note shows chosen vs applied (the applied one is what onValueChange receives).
 */
export function ULColorPicker({ label, value, defaultValue = 'violet', onValueChange, presets = ACCENT_PRESETS, allowCustom = true, names = {}, locale = 'en', hexLabel, invalidHex = 'Use 6 hex digits, like #8fb8ff.', disabled, backdrop = 'light', className, style, id, defaultOpen, defaultExpanded, material }: ULColorPickerProps) {
  const t = txtOf(locale);
  const [own, setOwn] = React.useState(defaultValue);
  const v = value ?? own;
  const [open, setOpen] = React.useState(!!defaultOpen);
  const [expanded, setExpanded] = React.useState(!!defaultExpanded);
  const [shown, setShown] = React.useState(!!defaultExpanded);
  const [hsv, setHsv] = React.useState<HSV>(() => hexToHsv(HEX.test(v) ? toHex(v)! : '#8fb8ff'));
  const [hex, setHex] = React.useState(HEX.test(v) ? toHex(v)! : hsvToHex(hexToHsv('#8fb8ff')));
  const [bad, setBad] = React.useState(false);
  const [note, setNote] = React.useState<{ chosen: string; effective: string } | null>(null);
  const trig = React.useRef<HTMLElement | null>(null);
  const box = React.useRef<HTMLDivElement | null>(null);
  const btn = React.useRef<HTMLButtonElement | null>(null);
  const panel = React.useRef<HTMLDivElement | null>(null);
  const field = React.useRef<HTMLDivElement | null>(null);
  const bead = React.useRef<HTMLElement | null>(null);
  const surf = React.useRef<HTMLElement | null>(null);
  const morph = React.useRef<AnchoredMorph | null>(null);
  const uid = useDomId('ul-cp', id);
  const list = presets.map((p) => (typeof p === 'string' ? { value: p } : p)) as ULColorPreset[];
  const name = (p: string) => list.find((x) => x.value === p)?.label ?? names[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
  const set = (x: string) => { if (value === undefined) setOwn(x); onValueChange?.(x); };
  const close = (refocus = true) => { setOpen(false); if (refocus) trig.current?.focus(); };
  const skip = React.useRef(false);
  const openIt = () => { if (expanded !== !!defaultExpanded) { skip.current = true; setExpanded(!!defaultExpanded); setShown(!!defaultExpanded); } setOpen(true); };
  React.useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => box.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked:not(:disabled), input[type="radio"]:not(:disabled)')?.focus({ preventScroll: true })));
    return () => cancelAnimationFrame(r);
  }, [open]);
  const custom = HEX.test(v);
  const commitCustom = (h: string) => {
    const g = guardAccent(h, surf.current ?? document.documentElement);
    setNote(g.adjusted ? { chosen: g.chosen, effective: g.effective } : null);
    set(g.effective);
  };

  /* expand / collapse: same measuring technique as the dialog morph (never animate to auto) */
  const anim = React.useRef<{ s: Animation | null; c: Animation | null; raf: number }>({ s: null, c: null, raf: 0 });
  /** Visual state captured BEFORE React re-renders (the layout effect already sees the new DOM). */
  const pre = React.useRef<{ r0: DOMRect; pOp: number } | null>(null);
  const capture = () => { const s = surf.current, p = panel.current; if (s && p) pre.current = { r0: s.getBoundingClientRect(), pOp: p.hidden ? 0 : parseFloat(getComputedStyle(p).opacity) }; };
  const firstRun = React.useRef(true);
  React.useLayoutEffect(() => {
    if (firstRun.current || skip.current) { firstRun.current = false; skip.current = false; return; }
    const s = surf.current, p = panel.current; if (!s || !p || !open) return;
    const A = anim.current, ts = getMorphTimeScale();
    const r0 = pre.current?.r0 ?? s.getBoundingClientRect(), pOp = pre.current ? pre.current.pOp : p.hidden ? 0 : parseFloat(getComputedStyle(p).opacity);
    pre.current = null;
    A.s?.cancel(); A.c?.cancel(); cancelAnimationFrame(A.raf);
    s.style.height = '';
    p.hidden = !expanded; const h1 = s.offsetHeight, w1 = s.offsetWidth; p.hidden = false;
    const m = morph.current, fin = m ? m.finalFor(w1, h1) : { L: r0.left, T: r0.top };
    const D = nmb(s, '--ul-colorpicker-expand-duration', 420) * ts, Din = nmb(s, '--ul-colorpicker-content-in', 240) * ts, Dout = nmb(s, '--ul-colorpicker-content-out', 140) * ts;
    (s as HTMLElement & { __ulExpand?: unknown }).__ulExpand = { expanded, t0: document.timeline.currentTime, D, Din, Dout, h0: r0.height, h1 };
    const done = () => {
      cancelAnimationFrame(A.raf); s.removeAttribute('data-ul-morphing'); s.style.overflow = ''; A.c?.cancel(); A.c = null;
      setGlassGeometry(s); releaseGlassTier(s); m?.setFinalRect(fin.L, fin.T, w1, h1);
      if (!expanded) setShown(false);
    };
    s.style.left = `${fin.L}px`; s.style.top = `${fin.T}px`;
    if (isMorphReduced()) {
      A.c = p.animate([{ opacity: pOp }, { opacity: expanded ? 1 : 0 }], { duration: 100 * ts, fill: 'forwards' });
      if (!expanded) A.c.finished.then(done, () => {}); else { A.c.finished.then(() => { A.c?.cancel(); }, () => {}); done(); }
      return;
    }
    s.setAttribute('data-ul-morphing', ''); s.style.overflow = 'clip';
    A.s = s.animate([{ top: `${r0.top}px`, height: `${r0.height}px` }, { top: `${fin.T}px`, height: `${h1}px` }],
      { duration: D, delay: expanded ? 0 : Dout * Math.max(0.3, pOp), easing: overshootEase(nmb(s, '--ul-colorpicker-expand-overshoot', 0.03)), fill: 'backwards' });
    const tick = () => { const b = s.getBoundingClientRect(); setGlassGeometry(s, b.width, b.height); A.raf = requestAnimationFrame(tick); };
    tick();
    A.c = expanded
      ? p.animate([{ opacity: pOp, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: Din, delay: pOp > 0.01 ? 0 : D * 0.3, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' })
      : p.animate([{ opacity: pOp, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: Dout * Math.max(0.3, pOp), easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    const sA = A.s, cA = A.c;
    Promise.all([sA.finished, cA.finished]).then(done, () => {});
  }, [expanded]);
  const toggle = () => { capture(); if (!expanded) setShown(true); setExpanded((x) => !x); if (document.activeElement !== btn.current) btn.current?.focus({ preventScroll: true }); };
  const onRootKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    if (expanded) { capture(); setExpanded(false); btn.current?.focus({ preventScroll: true }); } else close();
  };

  /* 2D field: the bead follows on the slider follow spring; value commits on release (no per-move React state) */
  const drag = React.useRef<{ s: number; v: number; x: number; y: number; raf: number; last: number; on: boolean }>({ s: 0, v: 0, x: 0, y: 0, raf: 0, last: 0, on: false });
  const placeBead = (sx: number, vy: number) => {
    const f = field.current, b = bead.current; if (!f || !b) return;
    b.style.transform = `translate(${(sx * f.clientWidth).toFixed(2)}px, ${((1 - vy) * f.clientHeight).toFixed(2)}px) translate(-50%, -50%)`;
  };
  React.useLayoutEffect(() => { if (!drag.current.on && shown) { drag.current.x = hsv.s; drag.current.y = hsv.v; placeBead(hsv.s, hsv.v); } });
  const writeLive = (s: number, vv: number) => {
    const h = hsvToHex({ h: hsv.h, s, v: vv }), f = field.current;
    f?.setAttribute('aria-valuetext', t.svText(Math.round(s * 100), Math.round(vv * 100)));
    f?.setAttribute('aria-valuenow', String(Math.round(s * 100)));
    const inp = panel.current?.querySelector<HTMLInputElement>('.ul-cp-row input'); if (inp) inp.value = h;
    const sw = btn.current?.querySelector<HTMLElement>('.ul-swatch'); if (sw) sw.style.background = h;
  };
  const follow = (now: number) => {
    const d = drag.current, f = field.current; d.raf = 0; if (!f) return;
    const tau = nmb(f, '--ul-slider-follow', 75) * getMorphTimeScale(), a = 1 - Math.exp(-Math.min(48, now - d.last) / Math.max(1, tau)); d.last = now;
    d.x += (d.s - d.x) * a; d.y += (d.v - d.y) * a; placeBead(d.x, d.y);
    if (Math.abs(d.s - d.x) > 0.001 || Math.abs(d.v - d.y) > 0.001) d.raf = requestAnimationFrame(follow);
  };
  const onFieldDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const f = e.currentTarget, r = f.getBoundingClientRect(), d = drag.current;
    f.setPointerCapture(e.pointerId); f.focus({ preventScroll: true }); f.setAttribute('data-pressed', '');
    d.on = true;
    const at = (cx: number, cy: number) => { d.s = Math.min(1, Math.max(0, (cx - r.left) / r.width)); d.v = Math.min(1, Math.max(0, 1 - (cy - r.top) / r.height)); writeLive(d.s, d.v); if (!d.raf) { d.last = performance.now(); d.raf = requestAnimationFrame(follow); } };
    at(e.clientX, e.clientY);
    const mv = (ev: PointerEvent) => at(ev.clientX, ev.clientY);
    const up = () => {
      f.removeEventListener('pointermove', mv); f.removeEventListener('pointerup', up); f.removeEventListener('pointercancel', up); f.removeAttribute('data-pressed');
      d.on = false; const nx = { h: hsv.h, s: d.s, v: d.v }; setHsv(nx); const h = hsvToHex(nx); setHex(h); setBad(false); commitCustom(h);
    };
    f.addEventListener('pointermove', mv); f.addEventListener('pointerup', up); f.addEventListener('pointercancel', up);
  };
  const onFieldKey = (e: React.KeyboardEvent) => {
    const st = e.shiftKey ? 0.1 : 0.01; let { s, v: vv } = hsv;
    if (e.key === 'ArrowLeft') s -= st; else if (e.key === 'ArrowRight') s += st; else if (e.key === 'ArrowUp') vv += st; else if (e.key === 'ArrowDown') vv -= st;
    else if (e.key === 'Home') s = 0; else if (e.key === 'End') s = 1; else return;
    e.preventDefault();
    const nx = { h: hsv.h, s: Math.min(1, Math.max(0, s)), v: Math.min(1, Math.max(0, vv)) }; setHsv(nx); const h = hsvToHex(nx); setHex(h); setBad(false); commitCustom(h);
  };
  const eye = typeof window !== 'undefined' && 'EyeDropper' in window;
  const pickScreen = async () => {
    try { const ED = (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper; const r = await new ED().open(); const h = toHex(r.sRGBHex); if (h) { setHex(h); setHsv(hexToHsv(h)); commitCustom(h); } } catch { /* cancelled */ }
  };
  const customHex = custom ? toHex(v)! : hex;
  return (
    <div className={cx('ul-picker', className)} style={style}>
      <span id={`${uid}-l`} className="ul-select-label">{label}</span>
      <ULGlass ref={trig} as="button" type="button" id={uid} tier="sm" radius="var(--ul-control-radius)" interactive={!disabled} pressable={!disabled} pressScale={0.98} material={material} materialCategory="inputs"
        className="ul-select-trigger" disabled={disabled} data-open={open ? '' : undefined}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${uid}-dlg` : undefined} aria-labelledby={`${uid}-l ${uid}-v`}
        onClick={() => (open ? close() : openIt())}>
        <span className="ul-swatch" aria-hidden="true" style={{ background: swatch(v) }} />
        <span id={`${uid}-v`} className="ul-select-value">{custom ? toHex(v) : name(v)}</span>
        <span className="ul-select-chev" aria-hidden="true"><Icon name="chevron-down" /></span>
        <span className="ul-btn-ring" aria-hidden="true" />
      </ULGlass>
      <ULAnchoredSurface scrollBehavior="lock" open={open} anchorRef={trig} onClose={() => close()} closeOnEscape={false} side="bottom" align="start" backdrop={backdrop} role="dialog" id={`${uid}-dlg`} aria-modal="false" aria-label={label}
        className="ul-picker-surface ul-cp-surface" surfaceRef={surf} morphRef={morph}>
        <div ref={box} className="ul-colors" onKeyDown={onRootKey}>
          <div role="radiogroup" aria-label={label} className="ul-swatches">
            {list.map(({ value: p, disabled: off }) => (
              <label key={p} className="ul-swatch-opt" data-disabled={off ? '' : undefined}>
                <input type="radio" name={`${uid}-p`} value={p} checked={v === p} disabled={off} onChange={() => { if (off) return; set(p); setNote(null); setBad(false); }} className="ul-choice-input" aria-label={name(p)} />
                <span className="ul-swatch ul-swatch--lg" aria-hidden="true" style={HEX.test(p) ? { background: toHex(p)! } : { background: `var(--ul-accent-${p})` }}>
                  <ULCheckMark checked={v === p} className="ul-swatch-check" />
                </span>
                <span className="ul-swatch-name">{name(p)}</span>
              </label>
            ))}
          </div>
          {allowCustom ? (
            <>
              <button ref={btn} type="button" className="ul-cp-custom" aria-expanded={expanded} aria-controls={`${uid}-panel`} onClick={toggle}>
                <span className="ul-swatch" aria-hidden="true" style={{ background: customHex }}>{custom ? <ULCheckMark checked className="ul-swatch-check" /> : null}</span>
                <span className="ul-cp-custom-l">{t.custom}</span>
                <span className="ul-cp-custom-v">{custom ? customHex : ''}</span>
                <span className="ul-select-chev" aria-hidden="true"><Icon name="chevron-down" /></span>
              </button>
              <div id={`${uid}-panel`} ref={panel} className="ul-cp-panel" role="group" aria-label={t.custom} hidden={!shown}>
                <div ref={field} className="ul-cp-field" role="slider" tabIndex={0} aria-label={t.sv} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s * 100)}
                  aria-valuetext={t.svText(Math.round(hsv.s * 100), Math.round(hsv.v * 100))} style={{ '--h': hsv.h } as React.CSSProperties} onPointerDown={onFieldDown} onKeyDown={onFieldKey}>
                  <ULGlass as="span" ref={bead} aria-hidden="true" tier="sm" radius="999px" className="ul-cp-bead" materialCategory="overlays" />
                </div>
                <ULSlider className="ul-cp-hue" label={t.hue} min={0} max={359} step={1} value={hsv.h} hideValue format={(x) => `${x}°`}
                  onValueChange={(h) => { const nx = { ...hsv, h }; setHsv(nx); const hx = hsvToHex(nx); setHex(hx); setBad(false); commitCustom(hx); }} />
                <div className="ul-cp-row">
                  <ULTextField label={hexLabel ?? t.hex} value={hex} placeholder="#8fb8ff" spellCheck={false} autoComplete="off" error={bad ? invalidHex : undefined}
                    leading={<span className="ul-swatch" aria-hidden="true" style={{ background: toHex(hex) ?? 'transparent' }} />}
                    onValueChange={(s) => { setHex(s); const h = toHex(s); if (h) { setBad(false); setHsv(hexToHsv(h)); commitCustom(h); } }}
                    onBlur={() => setBad(!!hex && !toHex(hex))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const h = toHex(hex); if (h) { commitCustom(h); close(); } else setBad(true); } }} />
                  {eye ? <button type="button" className="ul-cal-nav ul-cp-eye" aria-label={t.eyedropper} onClick={pickScreen}>{PIPETTE}</button> : null}
                </div>
                {note ? (
                  <p className="ul-cp-note" role="status">
                    <span className="ul-swatch" aria-hidden="true" style={{ background: note.chosen }}></span><span className="ul-cp-note-k">{t.chosen} {note.chosen}</span>
                    <span aria-hidden="true">→</span>
                    <span className="ul-swatch" aria-hidden="true" style={{ background: note.effective }}></span><span className="ul-cp-note-k">{t.applied} {note.effective}</span>
                    <span className="ul-cp-note-t">{t.adjusted}</span>
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </ULAnchoredSurface>
    </div>
  );
}

/* ---------------- Standalone calendar (inline, flat on its panel; the one CalendarGrid) ---------------- */
type CalMode = 'single' | 'multiple' | 'range';
export interface ULCalendarProps {
  /** "single" (default) | "multiple" | "range". */ mode?: CalMode;
  /** single: Date | null · multiple: Date[] · range: DateRange | null */
  value?: Date | null | Date[] | DateRange;
  /** Initial value when uncontrolled (Date, Date[] or { start, end } per mode). */ defaultValue?: Date | null | Date[] | DateRange;
  /** Called with the new value (shape per mode). */ onValueChange?: (v: Date | Date[] | DateRange | null) => void;
  /** Calendar locale ("en" | "sk" | "de" | "cs"): month names, week start. Default "en". */ locale?: PickerLocale;
  /** Earliest / lowest allowed value. */ min?: Date; /** Latest / highest allowed value. */ max?: Date;
  /** Return true to disable a date (e.g. weekends). Disabled dates are skipped by keyboard moves. */ isDateDisabled?: (d: Date) => boolean;
  /** Month shown first (default: the value, else today). */
  defaultMonth?: Date;
  /** Month / year jump selects in the header. Default true. Years: min..max, else ±10 around today. */
  jump?: boolean;
  /** Accessible name of the calendar group. */
  label?: string;
  /** Extra class on the root element. */ className?: string; /** Inline style on the root element. */ style?: React.CSSProperties; /** Id of the control (labels and messages are linked to it). Default: generated. */ id?: string;
}
const JUMP: Record<string, { month: string; year: string }> = { en: { month: 'Month', year: 'Year' }, sk: { month: 'Mesiac', year: 'Rok' }, de: { month: 'Monat', year: 'Jahr' }, cs: { month: 'Měsíc', year: 'Rok' } };
/**
 * Inline calendar on CalendarGrid: single, multiple and range. Same keyboard as the pickers (arrows, Home / End, PageUp / Down,
 * Shift+PageUp / Down for years, Enter / Space pick); the tab stop is always an enabled date (enabledNear). Range: first pick = start,
 * hover / focus previews, second pick = end (swapped if earlier); band = one element per week row and layer (Bands). Flat paint, no glass.
 */
export function ULCalendar({ mode = 'single', value, defaultValue, onValueChange, locale = 'en', min, max, isDateDisabled, defaultMonth, jump = true, label, className, style, id }: ULCalendarProps) {
  const cal = useCal(locale), t = cal.t, J = JUMP[String(locale).slice(0, 2)] ?? JUMP.en;
  const uid = useDomId('ul-calendar', id);
  const [own, setOwn] = React.useState<ULCalendarProps['value']>(defaultValue ?? (mode === 'multiple' ? [] : null));
  const v = value === undefined ? own : value;
  const today = day0(new Date());
  const single = mode === 'single' ? (v as Date | null) : null, multi = mode === 'multiple' ? ((v as Date[]) ?? []) : [], range = mode === 'range' ? (v as DateRange | null) : null;
  const anchor = defaultMonth ?? single ?? multi[0] ?? range?.start ?? today;
  const [focus, setFocus] = React.useState<Date>(() => enabledNear(anchor, min, max, isDateDisabled));
  const [draft, setDraft] = React.useState<Date | null>(null);
  const keyRef = React.useRef<{ target: Date | null; next: Date | null; t?: number }>({ target: null, next: null });
  const box = React.useRef<HTMLDivElement | null>(null), bands = React.useRef<Bands | null>(null);
  const off = (d: Date) => !!((min && d < day0(min)) || (max && d > day0(max)) || isDateDisabled?.(d));
  const commit = (nv: ULCalendarProps['value']) => { if (value === undefined) setOwn(nv); onValueChange?.(nv as Date | Date[] | DateRange | null); };
  const pick = (d: Date) => {
    if (off(d)) return; setFocus(d);
    if (mode === 'single') commit(d);
    else if (mode === 'multiple') commit(multi.some((x) => sameDay(x, d)) ? multi.filter((x) => !sameDay(x, d)) : [...multi, d].sort((a, b) => a.getTime() - b.getTime()));
    else if (!draft) setDraft(d);
    else { const a = draft < d ? draft : d, b = draft < d ? d : draft; setDraft(null); commit({ start: a, end: b }); }
  };
  const inR = (d: Date, a: Date, b: Date) => { const x = d.getTime(), lo = Math.min(a.getTime(), b.getTime()), hi = Math.max(a.getTime(), b.getTime()); return x > lo && x < hi; };
  const state = (d: Date): DayState => {
    if (mode === 'single') return { selected: sameDay(d, single) };
    if (mode === 'multiple') return { selected: multi.some((x) => sameDay(x, d)) };
    if (draft) return { start: sameDay(d, draft) };
    if (!range) return {};
    return { start: sameDay(d, range.start), end: sameDay(d, range.end), mid: inR(d, range.start, range.end) };
  };
  // range band (shared Bands: one element per week row and layer)
  React.useLayoutEffect(() => {
    if (mode !== 'range' || !box.current) return;
    bands.current?.destroy(); bands.current = new Bands(box.current); bands.current.bind();
    if (draft) bands.current.set('preview', draft, focus, true); else bands.current.set('firm', range?.start ?? null, range?.end ?? null, true);
    return () => bands.current?.destroy();
  }, [mode, focus.getFullYear(), focus.getMonth()]);
  React.useEffect(() => { const B = bands.current; if (!B) return; if (draft) { B.set('firm', null); B.set('preview', draft, draft); } else { B.set('preview', null); B.set('firm', range?.start ?? null, range?.end ?? null); } }, [draft, range?.start?.getTime(), range?.end?.getTime()]);
  const onOver = (e: React.PointerEvent) => { if (!draft || !bands.current) return; const ds = (e.target as Element).closest?.<HTMLElement>('.ul-cal-day:not(:disabled)')?.dataset.date; if (ds) bands.current.set('preview', draft, new Date(ds + 'T00:00')); };
  const onGridKey = (e: React.KeyboardEvent) => {
    const from = keyFrom(e, keyRef.current, focus);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(from); return; }
    if (e.key === 'Escape' && draft) { e.preventDefault(); setDraft(null); return; }
    const n = moveKey(from, e, cal.fd, off, min, max);
    keyRef.current = { target: dateOfEvent(e), next: n, t: performance.now() };
    if (n) { e.preventDefault(); setFocus(n); if (draft) bands.current?.set('preview', draft, n); requestAnimationFrame(() => focusDayNode(box.current, n)); }
  };
  const goMonth = (m: Date) => setFocus(enabledNear(new Date(m.getFullYear(), m.getMonth(), Math.min(focus.getDate(), 28)), min, max, isDateDisabled));
  const y0 = min ? min.getFullYear() : today.getFullYear() - 10, y1 = max ? max.getFullYear() : today.getFullYear() + 10;
  const monthFmt = React.useMemo(() => new Intl.DateTimeFormat(cal.L, { month: 'long' }), [cal.L]);
  const prevOk = !min || addMonths(monthOf(focus), -1) >= monthOf(min), nextOk = !max || addMonths(monthOf(focus), 1) <= monthOf(max);
  return (
    <div role="group" aria-label={label ?? t.choose} id={uid} className={cx('ul-cal ul-calendar', className)} style={style} data-mode={mode} data-picking={draft ? '' : undefined}>
      <div className="ul-cal-head">
        <button type="button" className="ul-cal-nav" aria-label={t.prev} disabled={!prevOk} onClick={() => goMonth(addMonths(focus, -1))}><Icon name="chevron-left" /></button>
        {jump ? (
          <span className="ul-calendar-jump">
            <select aria-label={J.month} className="ul-calendar-sel" value={focus.getMonth()} onChange={(e) => goMonth(new Date(focus.getFullYear(), Number(e.target.value), 1))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i} disabled={(min && new Date(focus.getFullYear(), i + 1, 0) < day0(min)) || (max && new Date(focus.getFullYear(), i, 1) > day0(max)) || undefined}>{monthFmt.format(new Date(2024, i, 1))}</option>)}
            </select>
            <select aria-label={J.year} className="ul-calendar-sel" value={focus.getFullYear()} onChange={(e) => goMonth(new Date(Number(e.target.value), focus.getMonth(), 1))}>
              {Array.from({ length: y1 - y0 + 1 }, (_, i) => <option key={i} value={y0 + i}>{y0 + i}</option>)}
            </select>
          </span>
        ) : null}
        <h2 id={`${uid}-month`} className="ul-cal-month" aria-live="polite" data-visually-hidden={jump ? '' : undefined}>{cal.fmtMonth.format(focus)}</h2>
        <button type="button" className="ul-cal-nav" aria-label={t.next} disabled={!nextOk} onClick={() => goMonth(addMonths(focus, 1))}><Icon name="chevron-right" /></button>
      </div>
      <div ref={box} className="ul-calendar-body" onPointerOver={onOver}>
        <div className="ul-range-track"><div className="ul-range-month">
          <CalendarGrid month={focus} cal={cal} focus={focus} today={today} titleId={`${uid}-month`} off={off} band={mode === 'range'}
            state={state} onPick={pick} onFocusDay={setFocus} onKeyDown={onGridKey} />
        </div></div>
      </div>
    </div>
  );
}
