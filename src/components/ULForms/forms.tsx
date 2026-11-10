import * as React from 'react';
import { ULIcon, cx, useDomId } from '../shared/icons.tsx';
import { ULSpinner } from '../ULSpinner/ULSpinner.tsx';
import { announce } from '../actions/core.tsx';
import { ULTruncatedText } from '../dashboard/blocks.tsx';
import { FieldCtx, InputGroupCtx, useFieldCtx, useInputGroupCtx, fieldAria, type FieldCtxValue, type InputGroupCtxValue } from './fieldContext.ts';
import { useMaterial, type Material } from '../../glass/material.tsx';
import './forms.css';

/* =====================================================================
 * Forms (Task 3C): ULField wraps ANY control (native or UL) and owns the
 * label, description, error and aria wiring; ULInputGroup is ONE inset
 * field well with addons. Flat paint only (the well is not glass).
 * ===================================================================== */

type Loc = 'en' | 'sk' | 'de' | 'cs';
const T = {
  en: { optional: 'optional', clear: 'Clear', count: '{n} of {max} characters', left: '{n} characters left', errors: 'Errors' },
  sk: { optional: 'nepovinné', clear: 'Vymazať', count: '{n} z {max} znakov', left: 'Zostáva {n} znakov', errors: 'Chyby' },
  de: { optional: 'optional', clear: 'Löschen', count: '{n} von {max} Zeichen', left: 'Noch {n} Zeichen', errors: 'Fehler' },
  cs: { optional: 'nepovinné', clear: 'Vymazat', count: '{n} z {max} znaků', left: 'Zbývá {n} znaků', errors: 'Chyby' },
};
const loc = (l?: string): Loc => { const k = (l || (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'en').slice(0, 2).toLowerCase(); return (k in T ? k : 'en') as Loc; };
export const formText = (k: keyof typeof T.en, locale?: string, vars: Record<string, string | number> = {}) => T[loc(locale)][k].replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? ''));
const textOf = (n: React.ReactNode): string => (n == null || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(textOf).join(' ') : React.isValidElement(n) ? textOf((n.props as { children?: React.ReactNode }).children) : '');

/* ---------------- ULLabel ---------------- */
export interface ULLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Shows the required marker. Default false. */ required?: boolean;
  /** true = localised "(optional)", or a custom string */
  optional?: boolean | string;
  /** "en" | "sk" | "de" | "cs" for built-in strings and formatting. Default "en". */ locale?: string;
  /** render as <span> (for groups: radio sets, OTP) */
  asSpan?: boolean;
}
export function ULLabel({ required, optional, locale, asSpan, className, children, ...rest }: ULLabelProps) {
  const inner = <>
    <span className="ul-label-text">{children}</span>
    {required ? <span className="ul-label-req" aria-hidden="true">*</span> : null}
    {!required && optional ? <span className="ul-label-opt">({typeof optional === 'string' ? optional : formText('optional', locale)})</span> : null}
  </>;
  return asSpan ? <span {...(rest as React.HTMLAttributes<HTMLSpanElement>)} className={cx('ul-label', className)}>{inner}</span>
    : <label {...rest} className={cx('ul-label', className)}>{inner}</label>;
}

/* ---------------- ULFieldError ---------------- */
export interface ULFieldErrorProps { /** Id referenced by the control's aria-describedby. */ id?: string; /** Error text (alternative to `errors`). */ children?: React.ReactNode; /** List of messages; falsy entries are skipped, several render as a list. */ errors?: (string | null | undefined | false)[]; /** one line with ellipsis + tooltip; default false (wraps) */ truncate?: boolean; /** "en" | "sk" | "de" | "cs" for built-in strings and formatting. Default "en". */ locale?: string; /** Extra class on the root element. */ className?: string }
export function ULFieldError({ id, children, errors, truncate, locale, className }: ULFieldErrorProps) {
  const list = (errors || []).filter(Boolean) as string[];
  if (!children && !list.length) return null;
  const body = list.length > 1
    ? <ul className="ul-ferr-list" aria-label={formText('errors', locale)}>{list.map((e, i) => <li key={i}>{e}</li>)}</ul>
    : truncate ? <ULTruncatedText text={textOf(children ?? list[0])} /> : <span className="ul-ferr-text">{children ?? list[0]}</span>;
  return (
    <div id={id} className={cx('ul-ferr', className)} data-truncate={truncate ? '' : undefined}>
      <span className="ul-ferr-icon" aria-hidden="true"><ULIcon name="alert" size="sm" /></span>
      {body}
    </div>
  );
}

/* ---------------- ULField ---------------- */
export type FieldControlProps = ReturnType<typeof fieldAria> & { /** Id of the control (labels and messages are linked to it). Default: generated. */ id: string; /** Id of the element that labels the control. */ 'aria-labelledby'?: string; /** Marks the control required (aria-required, required marker in the label). Default false. */ required?: boolean; /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean };
export interface ULFieldProps {
  /** Field label (owns the accessible name of the control inside). */ label: React.ReactNode;
  /** Secondary text under the label (aria-describedby). */ description?: React.ReactNode;
  /** string, node or a list (several messages). A new error is announced politely; focus never moves. */
  error?: React.ReactNode | (string | null | undefined | false)[];
  /** Marks the control required (aria-required, required marker in the label). Default false. */ required?: boolean;
  /** Shows an "optional" marker (true = localised word, or a custom string). */ optional?: boolean | string;
  /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean;
  /** "vertical" (default, label above) | "horizontal" (label beside, stacks below 480px). */ orientation?: 'vertical' | 'horizontal';
  /** one-line error with tooltip */
  truncateError?: boolean;
  /** announce new errors through the shared polite live region. Default true. */
  announceErrors?: boolean;
  /** native element child: cloned with id + aria; function child: receives the props; UL controls read the context. */
  children: React.ReactNode | ((p: FieldControlProps) => React.ReactNode);
  /** Id of the control (labels and messages are linked to it). Default: generated. */ id?: string;
  /** "en" | "sk" | "de" | "cs" for built-in strings and formatting. Default "en". */ locale?: string;
  /** Extra class on the root element. */ className?: string;
  /** Inline style on the root element. */ style?: React.CSSProperties;
}
export function ULField({ label, description, error, required = false, optional, disabled = false, orientation = 'vertical', truncateError, announceErrors = true, children, id, locale, className, style }: ULFieldProps) {
  const base = useDomId('ul-ff', id);
  const errs = Array.isArray(error) ? (error.filter(Boolean) as string[]) : [];
  const hasErr = Array.isArray(error) ? errs.length > 0 : !!error;
  const errText = Array.isArray(error) ? errs.join('. ') : textOf(error as React.ReactNode);
  const ctx: FieldCtxValue = React.useMemo(() => ({
    id: base, labelId: `${base}-label`, descId: description ? `${base}-desc` : undefined, errId: hasErr ? `${base}-err` : undefined,
    invalid: hasErr, required, disabled,
    describedBy: [description ? `${base}-desc` : '', hasErr ? `${base}-err` : ''].filter(Boolean).join(' ') || undefined,
  }), [base, !!description, hasErr, required, disabled]);
  const prev = React.useRef('');
  React.useEffect(() => { if (announceErrors && errText && errText !== prev.current) announce(errText); prev.current = errText; }, [errText, announceErrors]);
  const cp: FieldControlProps = { id: base, 'aria-labelledby': undefined, ...fieldAria(ctx, null), required: required || undefined, disabled: disabled || undefined };
  let control: React.ReactNode = typeof children === 'function' ? (children as (p: FieldControlProps) => React.ReactNode)(cp) : children;
  if (typeof children !== 'function' && React.isValidElement(children) && typeof children.type === 'string') control = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, { ...cp, ...(children.props as object) });
  return (
    <FieldCtx.Provider value={ctx}>
      <div className={cx('ul-ffield', className)} style={style} data-orientation={orientation} data-invalid={hasErr ? '' : undefined} data-disabled={disabled ? '' : undefined}>
        <div className="ul-ffield-row">
          <div className="ul-ffield-head">
            <ULLabel id={ctx.labelId} htmlFor={base} required={required} optional={optional} locale={locale}>{label}</ULLabel>
            {description ? <p id={ctx.descId} className="ul-ffield-desc">{description}</p> : null}
          </div>
          <div className="ul-ffield-body">
            {control}
            {hasErr ? <ULFieldError id={ctx.errId} errors={errs.length ? errs : undefined} truncate={truncateError} locale={locale}>{Array.isArray(error) ? null : (error as React.ReactNode)}</ULFieldError> : null}
          </div>
        </div>
      </div>
    </FieldCtx.Provider>
  );
}

/* ---------------- ULFieldGroup / ULFieldSet ---------------- */
interface Layout { orientation?: 'vertical' | 'horizontal'; /** number of columns at full width, or 'auto' (fill by --ul-fgroup-min). Collapses to one column below --ul-fgroup-collapse. */ columns?: number | 'auto'; gap?: 'sm' | 'md' | 'lg' }
const layoutAttrs = ({ orientation = 'vertical', columns = 1, gap = 'md' }: Layout) => ({ 'data-orientation': orientation, 'data-cols': String(columns), 'data-gap': gap, style: typeof columns === 'number' && columns > 1 ? ({ '--ul-fgroup-cols': columns } as React.CSSProperties) : undefined });
export interface ULFieldGroupProps extends Layout { /** Fields laid out in a responsive grid (column min --ul-fgroup-min). */ children: React.ReactNode; /** Extra class on the root element. */ className?: string; /** Inline style on the root element. */ style?: React.CSSProperties; /** Accessible name when there is no visible label. */ 'aria-label'?: string }
export function ULFieldGroup({ children, className, style, ...l }: ULFieldGroupProps) {
  const a = layoutAttrs(l);
  return <div className={cx('ul-fgroup', className)} role={l['aria-label'] ? 'group' : undefined} aria-label={l['aria-label']} {...a} style={{ ...a.style, ...style }}><div className="ul-fgroup-grid">{children}</div></div>;
}
export interface ULFieldSetProps extends Layout { /** Group legend (fieldset name). */ legend: React.ReactNode; /** Secondary text under the label (aria-describedby). */ description?: React.ReactNode; /** Group-level error (e.g. "Pick at least one"); announced through announce(). */ error?: React.ReactNode; /** Marks the control required (aria-required, required marker in the label). Default false. */ required?: boolean; /** Shows an "optional" marker (true = localised word, or a custom string). */ optional?: boolean | string; /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean; /** Controls of the group. */ children: React.ReactNode; /** "en" | "sk" | "de" | "cs" for built-in strings and formatting. Default "en". */ locale?: string; /** Extra class on the root element. */ className?: string; /** Inline style on the root element. */ style?: React.CSSProperties; /** Id of the control (labels and messages are linked to it). Default: generated. */ id?: string }
export function ULFieldSet({ legend, description, error, required, optional, disabled, children, locale, className, style, id, ...l }: ULFieldSetProps) {
  const base = useDomId('ul-fs', id), a = layoutAttrs(l), errText = textOf(error);
  const prev = React.useRef('');
  React.useEffect(() => { if (errText && errText !== prev.current) announce(errText); prev.current = errText; }, [errText]);
  return (
    <fieldset className={cx('ul-fieldset', className)} disabled={disabled} aria-describedby={[description ? `${base}-d` : '', error ? `${base}-e` : ''].filter(Boolean).join(' ') || undefined}
      aria-invalid={error ? true : undefined} {...a} style={{ ...a.style, ...style }}>
      <legend className="ul-fieldset-legend"><ULLabel asSpan required={required} optional={optional} locale={locale}>{legend}</ULLabel></legend>
      {description ? <p id={`${base}-d`} className="ul-ffield-desc">{description}</p> : null}
      <div className="ul-fgroup-grid">{children}</div>
      {error ? <ULFieldError id={`${base}-e`} locale={locale}>{error}</ULFieldError> : null}
    </fieldset>
  );
}

/* ---------------- ULInputGroup ---------------- */
export interface ULInputGroupProps {
  /** ULInputGroupInput plus addons (ULInputAddon, ULSelect, ULCopyButton…) in one inset well. */ children: React.ReactNode;
  /** leading addon(s): text, ULIcon, ULKbd … */
  prefix?: React.ReactNode;
  /** trailing addon(s) */
  suffix?: React.ReactNode;
  /** inline buttons at the end (ULCopyButton, ULButton variant plain, ULInputGroupButton) */
  actions?: React.ReactNode;
  /** Shows a spinner and sets aria-busy; the control stays focusable. Default false. */ loading?: boolean;
  /** Shows a clear button while the input has a value. Default false. */ clearable?: boolean;
  /** Called after the clear button empties the input. */ onClear?: () => void;
  /** character counter (+ maxLength on the inner text control) */
  maxLength?: number;
  /** Shows the character count (with maxLength: "12 / 80"). Default false. */ showCount?: boolean;
  /** "md" (default, 56px well) | "compact" (44px). */ size?: 'md' | 'compact';
  /** "rounded" (default) | "capsule". */ shape?: 'rounded' | 'capsule';
  /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean;
  /** Marks the well invalid (aria-invalid on the input). */ invalid?: boolean;
  /** "en" | "sk" | "de" | "cs" for built-in strings and formatting. Default "en". */ locale?: string;
  /** Extra class on the root element. */ className?: string;
  /** Inline style on the root element. */ style?: React.CSSProperties;
  /** "flat" | "glass" (inputs category); inner controls follow the group. @default undefined (resolved: "flat") */ material?: Material;
}
export function ULInputGroup({ children, prefix, suffix, actions, loading, clearable, onClear, maxLength, showCount, size = 'md', shape = 'rounded', disabled, invalid, locale, className, style, material }: ULInputGroupProps) {
  const f = useFieldCtx();
  const base = useDomId('ul-ig');
  const mat = useMaterial('inputs', material);
  const [val, setVal] = React.useState('');
  const api = React.useRef<{ clear: () => void; focus: () => void } | null>(null);
  const count = showCount ?? maxLength != null;
  const ids = [prefix ? `${base}-pre` : '', suffix ? `${base}-suf` : '', count ? `${base}-cnt` : ''].filter(Boolean).join(' ') || undefined;
  const lastLeft = React.useRef<number | null>(null);
  const report = React.useCallback((v: string) => {
    setVal(v);
    if (maxLength != null) { const left = maxLength - v.length, band = left <= 0 ? 0 : left <= 10 ? 10 : null; if (band != null && band !== lastLeft.current) announce(formText('left', locale, { n: Math.max(0, left) })); lastLeft.current = band; }
  }, [maxLength, locale]);
  const ctx: InputGroupCtxValue = React.useMemo(() => ({ report, register: (a) => { api.current = a; }, extraDescribedBy: ids, maxLength }), [report, ids, maxLength]);
  const off = disabled || f?.disabled;
  const clear = () => { api.current?.clear(); onClear?.(); setVal(''); api.current?.focus(); };
  return (
    <InputGroupCtx.Provider value={ctx}>
      <div className={cx('ul-igroup', className)} style={style} data-ul-material={mat.attr} data-size={size} data-shape={shape} data-invalid={invalid || f?.invalid ? '' : undefined} data-disabled={off ? '' : undefined} aria-busy={loading || undefined}
        onPointerDown={(e) => { const t = e.target as HTMLElement; if (t === e.currentTarget || t.classList.contains('ul-iaddon')) { e.preventDefault(); api.current?.focus(); } }}>
        {prefix ? <span id={`${base}-pre`} className="ul-iaddon" data-side="start">{prefix}</span> : null}
        <div className="ul-igroup-control">{children}</div>
        {loading ? <span className="ul-iaddon" data-kind="spinner"><ULSpinner /></span> : null}
        {clearable && val && !off ? <button type="button" className="ul-well-btn ul-igroup-clear" aria-label={formText('clear', locale)} onClick={clear}><ULIcon name="x" size="md" /></button> : null}
        {count ? <span id={`${base}-cnt`} className="ul-iaddon ul-icount" data-over={maxLength != null && val.length >= maxLength ? '' : undefined} aria-label={maxLength != null ? formText('count', locale, { n: val.length, max: maxLength }) : undefined}>{maxLength != null ? `${val.length}/${maxLength}` : val.length}</span> : null}
        {suffix ? <span id={`${base}-suf`} className="ul-iaddon" data-side="end">{suffix}</span> : null}
        {actions ? <span className="ul-iactions">{actions}</span> : null}
      </div>
    </InputGroupCtx.Provider>
  );
}

/** Bare native input for ULInputGroup (no own border). Reads ULField + group context. */
export const ULInputGroupInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { onValueChange?: (v: string) => void }>(function ULInputGroupInput({ onValueChange, onChange, className, ...p }, ref) {
  const f = useFieldCtx(), g = useInputGroupCtx(), own = React.useRef<HTMLInputElement | null>(null), auto = useDomId('ul-igi');
  const setRef = (el: HTMLInputElement | null) => { own.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; };
  React.useEffect(() => { g?.report(String(p.value ?? own.current?.value ?? '')); }, [g, p.value]);
  React.useEffect(() => {
    if (!g) return;
    g.register({ clear: () => { const el = own.current; if (!el) return; if (p.value == null) el.value = ''; onValueChange?.(''); g.report(''); }, focus: () => own.current?.focus() });
    return () => g.register(null);
  }, [g, onValueChange, p.value]);
  return <input ref={setRef} id={p.id ?? f?.id ?? auto} className={cx('ul-field-input ul-igroup-input', className)} maxLength={p.maxLength ?? g?.maxLength} disabled={p.disabled ?? f?.disabled}
    {...fieldAria(f, g, { describedBy: p['aria-describedby'] as string | undefined, invalid: !!p['aria-invalid'] })} {...p}
    aria-describedby={fieldAria(f, g, { describedBy: p['aria-describedby'] as string | undefined })['aria-describedby']}
    onChange={(e) => { g?.report(e.target.value); onValueChange?.(e.target.value); onChange?.(e); }} />;
});

/** Plain icon button for ULInputGroup actions (44px hit area, flat). */
export function ULInputGroupButton({ label, icon, onClick, disabled, pressed }: { label: string; icon: string; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return <button type="button" className="ul-well-btn" aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}><ULIcon name={icon} size="md" /></button>;
}
