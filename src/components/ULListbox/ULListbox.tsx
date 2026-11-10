import * as React from 'react';
import { ULGlass } from '../../glass/ULGlass.tsx';
import type { Backdrop } from '../../glass/accent.tsx';
import { useMaterial, type Material } from '../../glass/material.tsx';
import { ULAnchoredSurface } from '../ULAnchoredSurface/ULAnchoredSurface.tsx';
import { ULTextField } from '../ULField/ULField.tsx';
import { ULSpinner } from '../ULSpinner/ULSpinner.tsx';
import { createNavIndicator, type NavIndicator } from '../ULIsland/navIndicator.ts';
import { Icon, cx, useDomId } from '../shared/icons.tsx';
import { ULCheckMark } from '../shared/ULCheckMark.tsx';
import { useFieldCtx, useInputGroupCtx, fieldAria } from '../ULForms/fieldContext.ts';
import { useMediaQuery } from '../../hooks/useReducedMotion.ts';
import './ULListbox.css';

/* =====================================================================
 * Select + combobox. The list is a ULAnchoredSurface (anchored morph,
 * portal, overlay priority = full refraction). Options are flat rows; ONE
 * flattened glass lens (the shared floating indicator) follows hover and
 * the keyboard-active option. Roles: listbox / option, aria-activedescendant.
 * ===================================================================== */
export interface ListOption { value: string; label: string; description?: string; icon?: React.ReactNode; disabled?: boolean }

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface PanelProps {
  id: string; options: ListOption[]; active: number; selected?: string; labelledBy?: string;
  loading?: boolean; loadingText: string; emptyText: string;
  onActive: (i: number) => void; onPick: (i: number) => void;
  focusable?: boolean; onKeyDown?: (e: React.KeyboardEvent) => void; listRef?: React.Ref<HTMLDivElement>;
}
function ListPanel({ id, options, active, selected, labelledBy, loading, loadingText, emptyText, onActive, onPick, focusable, onKeyDown, listRef }: PanelProps) {
  const box = React.useRef<HTMLDivElement | null>(null);
  const lens = React.useRef<HTMLElement | null>(null);
  const ind = React.useRef<NavIndicator | null>(null);
  React.useEffect(() => {
    if (!box.current || !lens.current) return;
    ind.current = createNavIndicator({ container: box.current, lens: lens.current, items: '[role="option"]:not([aria-disabled="true"])', rest: () => box.current?.querySelector<HTMLElement>('[data-active]') ?? null });
    return () => { ind.current?.destroy(); ind.current = null; };
  }, []);
  React.useEffect(() => {
    ind.current?.update();
    const el = box.current?.querySelector<HTMLElement>('[data-active]');
    const sc = box.current;
    if (el && sc) { const t = el.offsetTop, b = t + el.offsetHeight; if (t < sc.scrollTop) sc.scrollTop = t; else if (b > sc.scrollTop + sc.clientHeight) sc.scrollTop = b - sc.clientHeight; }
  }, [active, options.length]);
  const setBox = (n: HTMLDivElement | null) => { box.current = n; if (typeof listRef === 'function') listRef(n); else if (listRef) (listRef as React.MutableRefObject<HTMLDivElement | null>).current = n; };
  const empty = !loading && options.length === 0;
  return (
    <div ref={setBox} id={id} role="listbox" aria-labelledby={labelledBy} aria-busy={loading || undefined} tabIndex={focusable ? -1 : undefined}
      aria-activedescendant={focusable && active >= 0 && options[active] ? `${id}-o${active}` : undefined} className="ul-listbox" onKeyDown={onKeyDown}>
      <ULGlass as="span" ref={lens} aria-hidden="true" tier="sm" radius="var(--ul-item-radius, var(--ul-radius-sm))" className="ul-listbox-lens" materialCategory="overlays" />
      {loading ? <div className="ul-listbox-state" role="status"><ULSpinner />{loadingText}</div> : null}
      {empty ? <div className="ul-listbox-state" role="status">{emptyText}</div> : null}
      {!loading && options.map((o, i) => (
        <div key={o.value} id={`${id}-o${i}`} role="option" aria-selected={o.value === selected} aria-disabled={o.disabled || undefined}
          data-active={i === active ? '' : undefined} className="ul-option"
          onPointerDown={(e) => e.preventDefault()} onPointerMove={() => { if (i !== active && !o.disabled) onActive(i); }}
          onClick={() => { if (!o.disabled) onPick(i); }}>
          {o.icon ? <span className="ul-option-icon" aria-hidden="true">{o.icon}</span> : null}
          <span className="ul-option-text"><span className="ul-option-label">{o.label}</span>{o.description ? <span className="ul-option-desc">{o.description}</span> : null}</span>
          <ULCheckMark checked={o.value === selected} className="ul-option-check" />
        </div>
      ))}
    </div>
  );
}

const nextEnabled = (opts: ListOption[], from: number, dir: 1 | -1) => {
  for (let k = 1; k <= opts.length; k++) { const i = (from + dir * k + opts.length * 2) % opts.length; if (!opts[i].disabled) return i; }
  return -1;
};
const edge = (opts: ListOption[], last: boolean) => { const idx = opts.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0); return last ? idx[idx.length - 1] ?? -1 : idx[0] ?? -1; };

/* ---------------- Select ---------------- */
export interface ULSelectProps {
  /** Visible label (required for an accessible name unless inside ULField). */ label: string;
  /** Options ({ value, label, disabled?, description? }). */ options: ListOption[];
  /** Controlled selected value. */ value?: string;
  /** Initial value when uncontrolled. */ defaultValue?: string;
  /** Called with the picked value. */ onValueChange?: (v: string) => void;
  /** Placeholder shown while empty. */ placeholder?: string;
  /** Help text under the control (aria-describedby). */ helper?: React.ReactNode;
  /** Error message; sets aria-invalid and replaces the helper. Inside ULField the field owns the message. */ error?: React.ReactNode;
  /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean;
  /** Shows a spinner and sets aria-busy; the control stays focusable. Default false. */ loading?: boolean;
  /** Text shown in the list while loading. Default localised "Loading…". */ loadingText?: string;
  /** Text shown when there are no options. Default localised "No options". */ emptyText?: string;
  /** Overlay contrast class. Default "light" (reading variant). */
  backdrop?: Backdrop;
  /** Stretch to the container width. Default false. */ fullWidth?: boolean;
  /** Extra class on the root element. */ className?: string;
  /** Inline style on the root element. */ style?: React.CSSProperties;
  /** Id of the control (labels and messages are linked to it). Default: generated. */ id?: string;
  /** Trigger material "flat" | "glass" (inputs category); the list popper stays an overlay (glass). @default undefined (resolved: "flat") */ material?: Material;
  /** Native picker: 'mobile' = ULNativeSelect on coarse pointers (phones / tablets), 'always' = always native, 'never' (default) = the glass list. */
  native?: 'never' | 'mobile' | 'always';
  /** @internal */
  forceState?: 'hover' | 'focus' | 'pressed' | (string & {});
}
/**
 * Keys on the trigger: ↓ / ↑ / Enter / Space open; a printable key opens and jumps (typeahead).
 * In the list: ↑ ↓ Home End, typeahead, Enter / Space pick, Esc closes and refocuses the trigger, Tab closes.
 */
const PlainTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function PlainTrigger(p, ref) { return <button ref={ref} {...p} data-plain="" />; });
export function ULSelect(props: ULSelectProps) {
  const coarse = useMediaQuery('(pointer: coarse)');
  const nat = props.native === 'always' || (props.native === 'mobile' && coarse);
  if (nat) { const { native: _n, loading: _l, loadingText: _lt, emptyText: _e, backdrop: _b, forceState: _f, ...rest } = props; return <ULNativeSelect {...rest} />; }
  return <SelectPopper {...props} />;
}
function SelectPopper({ label, options, value, defaultValue, onValueChange, placeholder = 'Select…', helper, error, disabled, loading, loadingText = 'Loading…', emptyText = 'No options', backdrop = 'light', fullWidth, className, style, id, forceState, material }: ULSelectProps) {
  const mat = useMaterial('inputs', material);
  const [own, setOwn] = React.useState(defaultValue);
  const v = value ?? own;
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const trig = React.useRef<HTMLElement | null>(null);
  const list = React.useRef<HTMLDivElement | null>(null);
  const fctx = useFieldCtx(), group = useInputGroupCtx();
  const uid = useDomId('ul-sel', id ?? fctx?.id);
  const typed = React.useRef({ s: '', t: 0 });
  const sel = options.find((o) => o.value === v);
  const selIdx = options.findIndex((o) => o.value === v);
  const show = (at: number) => { setActive(at); setOpen(true); requestAnimationFrame(() => requestAnimationFrame(() => list.current?.focus({ preventScroll: true }))); };
  const close = (refocus = true) => { setOpen(false); if (refocus) trig.current?.focus(); };
  const pick = (i: number) => { const o = options[i]; if (!o || o.disabled) return; if (value === undefined) setOwn(o.value); onValueChange?.(o.value); close(); };
  const ahead = (key: string, from: number) => {
    const now = Date.now(), b = typed.current;
    b.s = now - b.t > 600 ? key : b.s + key; b.t = now;
    const q = norm(b.s), n = options.length;
    for (let k = b.s.length > 1 ? 0 : 1; k <= n; k++) { const i = (from + k + n) % n; if (!options[i].disabled && norm(options[i].label).startsWith(q)) return i; }
    return -1;
  };
  const onTrigKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(selIdx >= 0 ? selIdx : e.key === 'ArrowUp' ? edge(options, true) : edge(options, false)); }
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) { const i = ahead(e.key, selIdx); if (i >= 0) { e.preventDefault(); show(i); } }
  };
  const onListKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k === 'ArrowDown') { e.preventDefault(); setActive((a) => nextEnabled(options, a, 1)); }
    else if (k === 'ArrowUp') { e.preventDefault(); setActive((a) => nextEnabled(options, a < 0 ? 0 : a, -1)); }
    else if (k === 'Home' || k === 'End') { e.preventDefault(); setActive(edge(options, k === 'End')); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (active >= 0) pick(active); }
    else if (k === 'Tab') close(false);
    else if (k.length === 1 && !e.metaKey && !e.ctrlKey) { const i = ahead(k, active); if (i >= 0) setActive(i); }
  };
  return (
    <div className={cx('ul-select', className)} style={style} data-ul-material={mat.attr} data-full={fullWidth ? '' : undefined} data-invalid={error || fctx?.invalid ? '' : undefined} data-disabled={disabled || undefined} data-in-group={group ? '' : undefined}>
      {fctx ? null : <span id={`${uid}-l`} className="ul-select-label">{label}</span>}
      {/* trigger = the field well (same look as text fields); inside ULInputGroup it drops the well. The list stays a glass popper. */}
      <PlainTrigger ref={trig as React.RefObject<HTMLButtonElement>} type="button" id={uid}
        className="ul-select-trigger" data-ul-force={forceState || undefined} data-open={open ? '' : undefined} disabled={disabled || fctx?.disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${uid}-list` : undefined} aria-labelledby={`${fctx ? fctx.labelId : uid + '-l'} ${uid}`}
        {...fieldAria(fctx, group, { describedBy: (error || helper) && !fctx ? `${uid}-m` : undefined, invalid: !!error })} aria-busy={loading || undefined}
        onClick={() => (open ? close() : show(selIdx >= 0 ? selIdx : edge(options, false)))} onKeyDown={onTrigKey}>
        <span className="ul-hit-layer" aria-hidden="true" />
        <span className="ul-select-value" data-placeholder={sel ? undefined : ''}>{sel ? sel.label : placeholder}</span>
        {loading ? <ULSpinner /> : <span className="ul-select-chev" aria-hidden="true"><Icon name="chevron-down" /></span>}
      </PlainTrigger>
      {fctx ? null : error ? <p id={`${uid}-m`} className="ul-select-msg" data-tone="error" aria-live="polite"><span className="ul-select-msg-icon" aria-hidden="true"><Icon name="alert" /></span>{error}</p>
        : helper ? <p id={`${uid}-m`} className="ul-select-msg">{helper}</p> : null}
      <ULAnchoredSurface scrollBehavior="lock" open={open} anchorRef={trig} onClose={() => close()} side="bottom" align="start" backdrop={backdrop} className="ul-listbox-surface">
        <ListPanel id={`${uid}-list`} options={options} active={active} selected={v} labelledBy={`${uid}-l`} loading={loading} loadingText={loadingText} emptyText={emptyText}
          onActive={setActive} onPick={pick} focusable onKeyDown={onListKey} listRef={list} />
      </ULAnchoredSurface>
    </div>
  );
}

/* ---------------- Combobox / autocomplete ---------------- */
export interface ULComboboxProps extends Omit<ULSelectProps, 'placeholder' | 'fullWidth'> {
  /** Text in the input (controlled). */
  inputValue?: string;
  /** Called with the typed text (filter remote options here). */ onInputChange?: (text: string) => void;
  /** Filter options by the typed text (accent- and case-insensitive). Default true; pass false when options come from a server. */
  filter?: boolean;
  /** Placeholder shown while empty. */ placeholder?: string;
}
/** Editable input + list. Focus stays in the input; the active option is announced via aria-activedescendant. */
export function ULCombobox({ label, options, value, defaultValue, onValueChange, inputValue, onInputChange, filter = true, helper, error, disabled, loading, loadingText = 'Loading…', emptyText = 'No results', backdrop = 'light', className, style, id, placeholder, forceState, material }: ULComboboxProps) {
  const [own, setOwn] = React.useState(defaultValue);
  const v = value ?? own;
  const init = options.find((o) => o.value === v)?.label ?? '';
  const [ownText, setOwnText] = React.useState(init);
  const text = inputValue ?? ownText;
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const anchor = React.useRef<HTMLDivElement | null>(null);
  const uid = useDomId('ul-cb', id);
  const shown = React.useMemo(() => (filter && text && text !== options.find((o) => o.value === v)?.label ? options.filter((o) => norm(o.label).includes(norm(text))) : options), [filter, text, options, v]);
  const setText = (t: string) => { if (inputValue === undefined) setOwnText(t); onInputChange?.(t); };
  const pick = (i: number) => {
    const o = shown[i]; if (!o || o.disabled) return;
    if (value === undefined) setOwn(o.value);
    onValueChange?.(o.value);
    setText(o.label);
    setOpen(false);
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const k = e.key;
    if (k === 'ArrowDown') { e.preventDefault(); if (!open) { setOpen(true); setActive(edge(shown, false)); } else setActive((a) => nextEnabled(shown, a, 1)); }
    else if (k === 'ArrowUp') { e.preventDefault(); if (!open) { setOpen(true); setActive(edge(shown, true)); } else setActive((a) => nextEnabled(shown, a < 0 ? 0 : a, -1)); }
    else if (k === 'Enter' && open && active >= 0) { e.preventDefault(); pick(active); }
    else if (k === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (k === 'Tab') setOpen(false);
  };
  return (
    <div ref={anchor} className={cx('ul-combobox', className)} style={style}>
      <ULTextField
        label={label} helper={helper} error={error} disabled={disabled} loading={loading} forceState={forceState} placeholder={placeholder} material={material}
        value={text} id={uid}
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${uid}-list` : undefined}
        aria-activedescendant={open && active >= 0 && shown[active] ? `${uid}-list-o${active}` : undefined}
        autoComplete="off"
        onValueChange={(t) => { setText(t); setOpen(true); setActive(t ? edge(options.filter((o) => norm(o.label).includes(norm(t))), false) : -1); }}
        onKeyDown={onKey}
        onBlur={() => setOpen(false)}
        trailing={<span className="ul-select-chev" aria-hidden="true" onPointerDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}><Icon name="chevron-down" /></span>}
      />
      <ULAnchoredSurface scrollBehavior="lock" open={open} anchorRef={anchor} onClose={() => setOpen(false)} side="bottom" align="start" backdrop={backdrop} className="ul-listbox-surface" closeOnEscape={false}>
        <ListPanel id={`${uid}-list`} options={shown} active={active} selected={v} labelledBy={undefined} loading={loading} loadingText={loadingText} emptyText={emptyText}
          onActive={setActive} onPick={pick} />
      </ULAnchoredSurface>
    </div>
  );
}

/* ---------------- Native select (same field well as the ULSelect trigger) ---------------- */
export interface NativeOptGroup { label: string; options: ListOption[]; disabled?: boolean }
export interface ULNativeSelectProps {
  /** Visible label (required for an accessible name unless inside ULField). */ label: string;
  /** Options ({ value, label, disabled? }) rendered as native <option>s. */ options?: ListOption[];
  /** Option groups (rendered as <optgroup>), after the plain options. */
  groups?: NativeOptGroup[];
  /** Controlled selected value. */ value?: string; /** Initial value when uncontrolled. */ defaultValue?: string; /** Called with the picked value (native change). */ onValueChange?: (v: string) => void;
  /** Shown as a disabled first option while nothing is chosen. */
  placeholder?: string;
  /** Help text under the control (aria-describedby). */ helper?: React.ReactNode; /** Error message; sets aria-invalid and replaces the helper. Inside ULField the field owns the message. */ error?: React.ReactNode;
  /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean; /** Marks the control required (aria-required, required marker in the label). Default false. */ required?: boolean; /** Form field name (native form submission). */ name?: string;
  /** Stretch to the container width. Default false. */ fullWidth?: boolean; /** Extra class on the root element. */ className?: string; /** Inline style on the root element. */ style?: React.CSSProperties; /** Id of the control (labels and messages are linked to it). Default: generated. */ id?: string;
  /** "flat" | "glass" (inputs category). @default undefined (resolved: "flat") */ material?: Material;
}
/** A real <select> in the field well: the platform picker (wheel / sheet on phones), keyboard and form behaviour are native. Arrow = ULIcon. */
export function ULNativeSelect({ label, options = [], groups, value, defaultValue, onValueChange, placeholder, helper, error, disabled, required, name, fullWidth, className, style, id, material }: ULNativeSelectProps) {
  const fctx = useFieldCtx(), group = useInputGroupCtx();
  const uid = useDomId('ul-nsel', id ?? fctx?.id);
  const mat = useMaterial('inputs', material);
  const [own, setOwn] = React.useState(defaultValue ?? '');
  const v = value ?? own;
  const opt = (o: ListOption) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>;
  return (
    <div className={cx('ul-select ul-nsel', className)} style={style} data-ul-material={mat.attr} data-full={fullWidth ? '' : undefined} data-invalid={error || fctx?.invalid ? '' : undefined} data-disabled={disabled || undefined} data-in-group={group ? '' : undefined}>
      {fctx ? null : <label htmlFor={uid} id={`${uid}-l`} className="ul-select-label">{label}</label>}
      <span className="ul-nsel-wrap">
        <select id={uid} name={name} required={required} disabled={disabled || fctx?.disabled} className="ul-select-trigger ul-nsel-control" data-plain="" data-placeholder={v === '' && placeholder ? '' : undefined}
          value={v} onChange={(e) => { if (value === undefined) setOwn(e.target.value); onValueChange?.(e.target.value); }}
          aria-labelledby={fctx ? fctx.labelId : undefined}
          {...fieldAria(fctx, group, { describedBy: (error || helper) && !fctx ? `${uid}-m` : undefined, invalid: !!error })}>
          {placeholder ? <option value="" disabled>{placeholder}</option> : null}
          {options.map(opt)}
          {groups?.map((g) => <optgroup key={g.label} label={g.label} disabled={g.disabled}>{g.options.map(opt)}</optgroup>)}
        </select>
        <Icon name="chevron-down" size="sm" className="ul-nsel-chev" aria-hidden="true" />
      </span>
      {fctx ? null : error ? <p id={`${uid}-m`} className="ul-select-msg" data-tone="error" aria-live="polite"><span className="ul-select-msg-icon" aria-hidden="true"><Icon name="alert" /></span>{error}</p>
        : helper ? <p id={`${uid}-m`} className="ul-select-msg">{helper}</p> : null}
    </div>
  );
}
