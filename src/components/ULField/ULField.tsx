import * as React from 'react';
import { trackPointer, untrackPointer } from '../../glass/engine.ts';
import { ULSpinner } from '../ULSpinner/ULSpinner.tsx';
import { Icon, cx, useDomId } from '../shared/icons.tsx';
import type { ForceState } from '../ULButton/ULButton.tsx';
import { useBareOnBusy } from '../shared/dev.ts';
import './ULField.css';
import { withContextMenu, type ContextMenuProps } from '../ULContainers/contextTarget.tsx';
import { useFieldCtx, useInputGroupCtx, fieldAria, type FieldCtxValue, type InputGroupCtxValue } from '../ULForms/fieldContext.ts';
import { useMaterial, type Material } from '../../glass/material.tsx';

/* =====================================================================
 * Fields: one shell (label, inset well, icons, helper / error), several
 * inputs. The well is NOT glass (no backdrop-filter) so fields can sit on
 * or inside any glass surface. Inputs never move; they only catch light.
 * ===================================================================== */

export interface FieldBaseProps {
  /** Visible label (required for a11y unless the field sits in ULField, which owns the label). Floats into the well by default. */
  label: string;
  /** false = label above the well. Default true. */
  floating?: boolean;
  /** Help text under the control (aria-describedby). */ helper?: React.ReactNode;
  /** Error message. Sets aria-invalid and replaces the helper. */
  error?: React.ReactNode;
  /** Element before the input (icon, prefix). Decorative icons are aria-hidden. */ leading?: React.ReactNode;
  /** Element after the input (icon, unit, button). */ trailing?: React.ReactNode;
  /** md 56 (default) or compact 44. */
  size?: 'md' | 'compact';
  /** "rounded" (default) | "capsule". */ shape?: 'rounded' | 'capsule';
  /** Shows a spinner and sets aria-busy; the control stays focusable. Default false. */ loading?: boolean;
  /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean;
  /** Marks the control required (aria-required, required marker in the label). Default false. */ required?: boolean;
  /** Id of the control (labels and messages are linked to it). Default: generated. */ id?: string;
  /** Extra class on the root element. */ className?: string;
  /** Inline style on the root element. */ style?: React.CSSProperties;
  /** "flat" | "glass" (inputs category). Flat well: no pointer light. Omit to resolve from ULProvider. @default undefined (resolved: "flat") */
  material?: Material;
  /** @internal */
  forceState?: ForceState;
}

interface ShellProps extends FieldBaseProps {
  ids: FieldIds;
  filled: boolean;
  multiline?: boolean;
  expand?: boolean;
  children: React.ReactNode;
  /** Label is for a group (OTP) instead of one input. */
  groupLabel?: boolean;
}

const BARE_WARN = 'Field sits directly on a busy backdrop. Helper and error text get a backing (--ul-field-msg-backing); put fields on a glass or solid panel for the intended look.';
function FieldShell({ ids, label, floating = true, helper, error, leading, trailing, size = 'md', shape = 'rounded', loading, disabled, required, className, style, forceState, filled, multiline, expand, groupLabel, material, children }: ShellProps) {
  const well = React.useRef<HTMLDivElement | null>(null);
  const root = React.useRef<HTMLDivElement | null>(null);
  const bare = useBareOnBusy(root, BARE_WARN);
  const mat = useMaterial('inputs', material);
  React.useEffect(() => { const el = well.current; if (!el || mat.flat) return; trackPointer(el); return () => untrackPointer(el); }, [mat.flat]);
  const inField = !!ids.ctx, inGroup = !!ids.group;
  const float = floating && !groupLabel && !inField;
  const lab = (
    <label className="ul-field-label" id={ids.label} htmlFor={groupLabel ? undefined : ids.input}>
      {label}{required ? <span aria-hidden="true" className="ul-field-req"> *</span> : null}
    </label>
  );
  return (
    <div
      ref={root}
      className={cx('ul-field', className)}
      style={style}
      data-ul-bare={bare ? '' : undefined}
      data-floating={float ? '' : undefined}
      data-filled={filled ? '' : undefined}
      data-invalid={error || ids.ctx?.invalid ? '' : undefined}
      data-disabled={disabled || ids.ctx?.disabled ? '' : undefined}
      data-in-group={inGroup ? '' : undefined}
      data-size={size}
      data-shape={shape}
      data-expand={expand ? '' : undefined}
      data-ul-force={forceState || undefined}
      data-ul-material={mat.attr}
    >
      {float || inField ? null : lab}
      <div ref={well} className="ul-well" data-multiline={multiline ? '' : undefined} aria-busy={loading || undefined}>
        {leading ? <span className="ul-field-icon" aria-hidden="true">{leading}</span> : null}
        <div className="ul-field-control">
          {float ? lab : null}
          {children}
        </div>
        {loading ? <span className="ul-field-icon"><ULSpinner /></span> : null}
        {trailing}
      </div>
      {inField ? null : error ? (
        <p className="ul-field-msg" id={ids.msg} data-tone="error" aria-live="polite"><span className="ul-field-msg-icon" aria-hidden="true"><Icon name="alert" /></span>{error}</p>
      ) : helper ? <p className="ul-field-msg" id={ids.msg}>{helper}</p> : null}
    </div>
  );
}

interface FieldIds { input: string; label: string; msg: string; ctx: FieldCtxValue | null; group: InputGroupCtxValue | null }
function useIds(id?: string): FieldIds {
  const ctx = useFieldCtx(), group = useInputGroupCtx();
  const base = useDomId('ul-f', id ?? ctx?.id);
  return { input: ctx?.id ?? base, label: ctx?.labelId ?? `${base}-l`, msg: `${base}-m`, ctx, group };
}
/** Inside ULInputGroup: report the text (clear button, counter) and register clear / focus. */
function useGroupBridge(ids: FieldIds, value: string, clear: (() => void) | null, el: React.RefObject<HTMLElement | null>) {
  const g = ids.group, clr = React.useRef(clear); clr.current = clear;
  React.useEffect(() => { g?.report(value); }, [g, value]);
  React.useEffect(() => { if (!g) return; g.register({ clear: () => clr.current?.(), focus: () => el.current?.focus() }); return () => g.register(null); }, [g]);
}
const described = (p: FieldBaseProps, ids: { msg: string; ctx?: FieldCtxValue | null }, extra?: string) => [(p.error || p.helper) && !ids.ctx ? ids.msg : '', extra || ''].filter(Boolean).join(' ') || undefined;

/** Small icon button inside a well (reveal, clear, stepper). Plain, 44px hit area, no glass. */
function WellButton({ label, icon, onClick, pressed, disabled, tabIndex }: { label: string; icon: string; onClick: () => void; pressed?: boolean; disabled?: boolean; tabIndex?: number }) {
  return (
    <button type="button" className="ul-well-btn" aria-label={label} aria-pressed={pressed} disabled={disabled} tabIndex={tabIndex} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}

/* ---------------- Text / password / search ---------------- */
export interface ULTextFieldProps extends FieldBaseProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'id' | 'className' | 'style' | 'disabled' | 'required'> {
  /** Native input type: "text" (default) | "email" | "password" (adds a reveal button) | "search" (adds a clear button, Esc clears) | "url" | "tel". */ type?: 'text' | 'email' | 'password' | 'search' | 'url' | 'tel';
  /** Called with the new string on every input. The native onChange event is still forwarded (documented native wrapper). */ onValueChange?: (value: string) => void;
  /** Search only: collapsed width (--ul-field-search-w) until focused or filled. */
  expandOnFocus?: boolean;
  /** Accessible label of the password reveal button. Default "Show password". */ revealLabel?: string;
  /** Accessible label of the password hide button. Default "Hide password". */ hideLabel?: string;
  /** Accessible label of the search clear button. Default "Clear search". */ clearLabel?: string;
}

export const ULTextField = React.forwardRef<HTMLInputElement, ULTextFieldProps>(function ULTextField(props, ref) {
  const { label, floating, helper, error, leading, trailing, size, shape, loading, disabled, required, id, className, style, forceState,
    type = 'text', value, defaultValue, onChange, onValueChange, expandOnFocus, revealLabel = 'Show password', hideLabel = 'Hide password', clearLabel = 'Clear search', placeholder, onKeyDown, material: _m, ...input } = props;
  const ids = useIds(id);
  const own = React.useRef<HTMLInputElement | null>(null);
  const [inner, setInner] = React.useState(String(defaultValue ?? ''));
  const v = value != null ? String(value) : inner;
  const [shown, setShown] = React.useState(false);
  const search = type === 'search';
  const set = (s: string) => { if (value == null) setInner(s); onValueChange?.(s); };
  const setRef = (el: HTMLInputElement | null) => { own.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; };
  const clear = () => { const el = own.current; set(''); if (el && value == null) el.value = ''; el?.focus(); };
  useGroupBridge(ids, v, clear, own);
  let trail = trailing;
  if (type === 'password') trail = <WellButton label={shown ? hideLabel : revealLabel} icon={shown ? 'eye-off' : 'eye'} pressed={shown} disabled={disabled} onClick={() => setShown((x) => !x)} />;
  if (search && v) trail = <WellButton label={clearLabel} icon="x" disabled={disabled} onClick={clear} />;
  return (
    <FieldShell {...props} ids={ids} filled={v !== ''} leading={search ? leading ?? <Icon name="search" /> : leading} trailing={trail}
      shape={shape ?? (search ? 'capsule' : 'rounded')} size={size ?? (search ? 'compact' : 'md')} floating={search ? false : floating} expand={search && expandOnFocus}>
      <input
        ref={setRef}
        {...input}
        id={ids.input}
        className="ul-field-input"
        type={type === 'password' && shown ? 'text' : search ? 'search' : type}
        value={value != null ? v : undefined}
        defaultValue={value == null ? defaultValue : undefined}
        placeholder={placeholder ?? (search ? label : ' ')}
        aria-label={search ? label : undefined}
        aria-labelledby={search ? undefined : ids.label}
        {...fieldAria(ids.ctx, ids.group, { describedBy: described(props, ids), invalid: !!error })}
        aria-required={required || ids.ctx?.required || undefined}
        maxLength={input.maxLength ?? ids.group?.maxLength}
        disabled={disabled || ids.ctx?.disabled}
        autoComplete={input.autoComplete ?? (type === 'password' ? 'current-password' : undefined)}
        spellCheck={type === 'password' || type === 'email' ? false : input.spellCheck}
        onChange={(e) => { set(e.target.value); onChange?.(e); }}
        onKeyDown={(e) => { if (search && e.key === 'Escape' && v) { e.preventDefault(); clear(); } onKeyDown?.(e); }}
      />
    </FieldShell>
  );
});

/* ---------------- Textarea (auto-grow) ---------------- */
export interface ULTextAreaProps extends FieldBaseProps, Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className' | 'style' | 'disabled' | 'required'> {
  /** Called with the new string on every input. The native onChange event is still forwarded. */ onValueChange?: (value: string) => void;
  /** Default 3. */
  minRows?: number;
  /** Then it scrolls. Default 10. */
  maxRows?: number;
}
export const ULTextArea = React.forwardRef<HTMLTextAreaElement, ULTextAreaProps>(function ULTextArea(props, ref) {
  const { label, floating, helper, error, leading, trailing, size, shape, loading, disabled, required, id, className, style, forceState,
    value, defaultValue, onChange, onValueChange, minRows = 3, maxRows = 10, placeholder, material: _m, ...ta } = props;
  const ids = useIds(id);
  const own = React.useRef<HTMLTextAreaElement | null>(null);
  const [inner, setInner] = React.useState(String(defaultValue ?? ''));
  const v = value != null ? String(value) : inner;
  const fit = React.useCallback(() => {
    const el = own.current; if (!el) return;
    const cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || 22;
    el.style.height = 'auto';
    const h = Math.min(Math.max(el.scrollHeight, lh * minRows), lh * maxRows);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > lh * maxRows + 1 ? 'auto' : 'hidden';
  }, [minRows, maxRows]);
  React.useLayoutEffect(fit, [v, fit]);
  const setRef = (el: HTMLTextAreaElement | null) => { own.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; };
  return (
    <FieldShell {...props} ids={ids} filled={v !== ''} multiline>
      <textarea
        ref={setRef}
        {...ta}
        id={ids.input}
        className="ul-field-input ul-field-textarea"
        rows={minRows}
        value={value != null ? v : undefined}
        defaultValue={value == null ? defaultValue : undefined}
        placeholder={placeholder ?? ' '}
        aria-labelledby={ids.label}
        {...fieldAria(ids.ctx, ids.group, { describedBy: described(props, ids), invalid: !!error })}
        aria-required={required || ids.ctx?.required || undefined}
        disabled={disabled}
        onChange={(e) => { if (value == null) setInner(e.target.value); onValueChange?.(e.target.value); onChange?.(e); }}
      />
    </FieldShell>
  );
});

/* ---------------- Number stepper ---------------- */
export interface ULNumberFieldProps extends FieldBaseProps {
  /** Controlled value; null = empty. */ value?: number | null;
  /** Initial value when uncontrolled; null = empty. */ defaultValue?: number | null;
  /** Called with the parsed number (or null) when the text is committed (blur, Enter, steppers, arrows). */ onValueChange?: (value: number | null) => void;
  /** Earliest / lowest allowed value. */ min?: number;
  /** Latest / highest allowed value. */ max?: number;
  /** Default 1. PageUp/PageDown move 10 steps. */
  step?: number;
  /** Display format (Intl). Default: plain number in the document locale. */
  format?: Intl.NumberFormatOptions;
  /** Number format locale ("en" | "sk" | "de" | "cs"); parsing accepts both separators. Default "en". */ locale?: string;
  /** Accessible label of the − stepper. Default "Decrease". */ decrementLabel?: string;
  /** Accessible label of the + stepper. Default "Increase". */ incrementLabel?: string;
  /** Form field name (native form submission). */ name?: string;
}
export function ULNumberField(props: ULNumberFieldProps) {
  const { value, defaultValue = null, onValueChange, min = -Infinity, max = Infinity, step = 1, format, locale, decrementLabel = 'Decrease', incrementLabel = 'Increase', name, disabled, error, required, id } = props;
  const ids = useIds(id);
  const [inner, setInner] = React.useState<number | null>(defaultValue);
  const n = value !== undefined ? value : inner;
  const fmt = React.useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 6, ...format }), [locale, format]);
  const [text, setText] = React.useState<string | null>(null);
  const clamp = (x: number) => Math.min(max, Math.max(min, x));
  const decimals = (String(step).split('.')[1] || '').length;
  const commit = (x: number | null) => { const c = x == null || Number.isNaN(x) ? null : +clamp(x).toFixed(decimals); if (value === undefined) setInner(c); onValueChange?.(c); setText(null); };
  const parse = (s: string) => { const t = s.replace(/\s/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/[^\d.-]/g, ''); return t === '' || t === '-' ? null : Number(t); };
  const bump = (k: number) => commit((n ?? (Number.isFinite(min) ? min : 0)) + k * step);
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const m: Record<string, () => void> = { ArrowUp: () => bump(1), ArrowDown: () => bump(-1), PageUp: () => bump(10), PageDown: () => bump(-10), Home: () => Number.isFinite(min) && commit(min), End: () => Number.isFinite(max) && commit(max), Enter: () => commit(parse(e.currentTarget.value)) };
    if (m[e.key]) { e.preventDefault(); m[e.key](); }
  };
  const shown = text ?? (n == null ? '' : fmt.format(n));
  return (
    <FieldShell {...props} ids={ids} filled={shown !== ''}
      leading={undefined}
      trailing={<span className="ul-stepper">
        <WellButton label={decrementLabel} icon="minus" tabIndex={-1} disabled={disabled || (n != null && n <= min)} onClick={() => bump(-1)} />
        <WellButton label={incrementLabel} icon="plus" tabIndex={-1} disabled={disabled || (n != null && n >= max)} onClick={() => bump(1)} />
      </span>}>
      <input
        id={ids.input}
        name={name}
        className="ul-field-input ul-field-number"
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        role="spinbutton"
        autoComplete="off"
        aria-labelledby={ids.label}
        {...fieldAria(ids.ctx, ids.group, { describedBy: described(props, ids), invalid: !!error })}
        aria-valuenow={n ?? undefined}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuetext={n == null ? undefined : fmt.format(n)}
        aria-required={required || ids.ctx?.required || undefined}
        disabled={disabled}
        placeholder=" "
        value={shown}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => { if (text != null) commit(parse(e.target.value)); }}
        onKeyDown={onKey}
      />
    </FieldShell>
  );
}

/* ---------------- OTP ---------------- */
export interface ULOtpFieldProps extends Omit<FieldBaseProps, 'floating' | 'leading' | 'trailing' | 'shape'> {
  /** Default 6. */
  length?: number;
  /** Controlled code (string of digits / characters). */ value?: string;
  /** Initial code when uncontrolled. */ defaultValue?: string;
  /** Called with the whole code on every change (paste fills all cells). */ onValueChange?: (value: string) => void;
  /** Called once all boxes are filled. */
  onComplete?: (value: string) => void;
  /** Default numeric. */
  mode?: 'numeric' | 'alphanumeric';
  /** aria-label per box, {n} and {total} are replaced. */
  boxLabel?: string;
}
export function ULOtpField(props: ULOtpFieldProps) {
  const { length = 6, value, defaultValue = '', onValueChange, onComplete, mode = 'numeric', boxLabel = 'Character {n} of {total}', disabled, error, required, id, loading } = props;
  const ids = useIds(id);
  const [inner, setInner] = React.useState(defaultValue.slice(0, length));
  const v = (value ?? inner).slice(0, length);
  const boxes = React.useRef<(HTMLInputElement | null)[]>([]);
  const ok = (c: string) => (mode === 'numeric' ? /\d/.test(c) : /[a-z0-9]/i.test(c));
  const set = (s: string, focusAt?: number) => {
    const clean = s.split('').filter(ok).join('').slice(0, length).toUpperCase();
    if (value == null) setInner(clean);
    onValueChange?.(clean);
    if (clean.length === length) onComplete?.(clean);
    if (focusAt != null) requestAnimationFrame(() => boxes.current[Math.min(focusAt, length - 1)]?.focus());
  };
  const onInput = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value.slice(-1);
    if (!typed || !ok(typed)) { e.target.value = v[i] ?? ''; return; }
    const arr = v.padEnd(length, ' ').split(''); arr[i] = typed;
    set(arr.join('').replace(/ /g, ''), i + 1);
  };
  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = v.split('');
      if (arr[i]) { arr.splice(i, 1); set(arr.join(''), i); } else if (i > 0) { arr.splice(i - 1, 1); set(arr.join(''), i - 1); }
    } else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); boxes.current[i - 1]?.focus(); }
    else if (e.key === 'ArrowRight' && i < length - 1) { e.preventDefault(); boxes.current[i + 1]?.focus(); }
  };
  const otpRoot = React.useRef<HTMLDivElement | null>(null);
  const otpBare = useBareOnBusy(otpRoot, BARE_WARN);
  const otpMat = useMaterial('inputs', props.material);
  const onPaste = (e: React.ClipboardEvent) => { e.preventDefault(); set(e.clipboardData.getData('text'), length - 1); };
  return (
    <div ref={otpRoot} data-ul-bare={otpBare ? '' : undefined} className={cx('ul-field', 'ul-otp', props.className)} style={props.style} data-invalid={error ? '' : undefined} data-disabled={disabled ? '' : undefined} data-ul-force={props.forceState || undefined} data-ul-material={otpMat.attr}>
      {ids.ctx ? null : <span className="ul-field-label" id={ids.label}>{props.label}{required ? <span aria-hidden="true" className="ul-field-req"> *</span> : null}</span>}
      <div role="group" aria-labelledby={ids.label} aria-describedby={fieldAria(ids.ctx, null, { describedBy: described(props, ids) })['aria-describedby']} aria-busy={loading || undefined} className="ul-otp-row">
        {Array.from({ length }, (_, i) => (
          <input
            key={i}
            ref={(el) => { boxes.current[i] = el; }}
            id={i === 0 ? ids.input : undefined}
            className="ul-well ul-otp-box"
            inputMode={mode === 'numeric' ? 'numeric' : 'text'}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={2}
            aria-label={boxLabel.replace('{n}', String(i + 1)).replace('{total}', String(length))}
            aria-invalid={error || ids.ctx?.invalid ? true : undefined}
            disabled={disabled}
            value={v[i] ?? ''}
            onChange={(e) => onInput(i, e)}
            onKeyDown={(e) => onKey(i, e)}
            onPaste={onPaste}
            onFocus={(e) => e.currentTarget.select()}
          />
        ))}
        {loading ? <ULSpinner /> : null}
      </div>
      {ids.ctx ? null : error ? <p className="ul-field-msg" id={ids.msg} data-tone="error" aria-live="polite"><span className="ul-field-msg-icon" aria-hidden="true"><Icon name="alert" /></span>{error}</p>
        : props.helper ? <p className="ul-field-msg" id={ids.msg}>{props.helper}</p> : null}
    </div>
  );
}

/* ---------------- Tags ---------------- */
export interface ULTagFieldProps extends FieldBaseProps {
  /** Controlled tag list. */ value?: string[];
  /** Initial tags when uncontrolled. */ defaultValue?: string[];
  /** Called with the next tag list (add on Enter / separator, remove on × or Backspace). */ onValueChange?: (tags: string[]) => void;
  /** Placeholder shown while empty. */ placeholder?: string;
  /** Characters (besides Enter) that commit a tag. Default [',']. */
  separators?: string[];
  /** Maximum number of tags; further input is ignored and announced. */ maxTags?: number;
  /** Return false to reject a tag. */
  validate?: (tag: string) => boolean;
  /** Accessible label of a tag's remove button; "{tag}" is replaced. Default "Remove {tag}" (English; pass a translated string). */ removeLabel?: string;
  /** Polite announcement after adding; "{tag}" is replaced. Default "{tag} added" (English; pass a translated string). */ addedText?: string;
  /** Polite announcement after removing; "{tag}" is replaced. Default "{tag} removed" (English; pass a translated string). */ removedText?: string;
}
/** Tags: contextMenu target { component: 'tagfield', kind: 'tag', id: tag text } (tags only; the input keeps the native menu). */
export function ULTagField(props: ULTagFieldProps & ContextMenuProps<string>) {
  const { value, defaultValue = [], onValueChange, placeholder, separators = [','], maxTags = Infinity, validate, removeLabel = 'Remove {tag}', addedText = '{tag} added', removedText = '{tag} removed', disabled, error, required, id } = props;
  const ids = useIds(id);
  const [inner, setInner] = React.useState<string[]>(defaultValue);
  const tags = value ?? inner;
  const [draft, setDraft] = React.useState('');
  const [said, setSaid] = React.useState('');
  const input = React.useRef<HTMLInputElement | null>(null);
  const set = (t: string[]) => { if (value == null) setInner(t); onValueChange?.(t); };
  const add = (raw: string) => {
    const t = raw.trim(); if (!t || tags.includes(t) || tags.length >= maxTags || (validate && !validate(t))) return false;
    set([...tags, t]); setSaid(addedText.replace('{tag}', t)); return true;
  };
  const remove = (i: number) => { const t = tags[i]; set(tags.filter((_, j) => j !== i)); setSaid(removedText.replace('{tag}', t)); input.current?.focus(); };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || separators.includes(e.key)) { if (draft.trim()) { e.preventDefault(); if (add(draft)) setDraft(''); } }
    else if (e.key === 'Backspace' && !draft && tags.length) { e.preventDefault(); remove(tags.length - 1); }
  };
  return (
    <FieldShell {...props} ids={ids} filled={tags.length > 0 || draft !== ''} multiline>
      {withContextMenu(<div className="ul-tags">
        {tags.length ? (
          <ul className="ul-tags-list" aria-label={props.label}>
            {tags.map((t, i) => (
              <li key={t} className="ul-chip" data-value={t}>
                <span className="ul-chip-label">{t}</span>
                <button type="button" className="ul-chip-x" aria-label={removeLabel.replace('{tag}', t)} disabled={disabled} onClick={() => remove(i)}><Icon name="x" /></button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          ref={input}
          id={ids.input}
          className="ul-field-input ul-tags-input"
          aria-labelledby={ids.label}
          {...fieldAria(ids.ctx, ids.group, { describedBy: described(props, ids), invalid: !!error })}
          aria-required={required || ids.ctx?.required || undefined}
          disabled={disabled}
          placeholder={placeholder ?? ' '}
          value={draft}
          onChange={(e) => { const s = e.target.value; const last = s.slice(-1); if (separators.includes(last)) { if (add(s.slice(0, -1))) setDraft(''); } else setDraft(s); }}
          onKeyDown={onKey}
          onBlur={() => { if (draft.trim() && add(draft)) setDraft(''); }}
        />
      </div>, props, 'tagfield', undefined, { selector: '.ul-chip', kind: 'tag', data: (id) => id }, true)}
      <span className="ul-sr-only" aria-live="polite">{said}</span>
    </FieldShell>
  );
}
