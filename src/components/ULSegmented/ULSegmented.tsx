import * as React from 'react';
import { ULGlass } from '../../glass/ULGlass.tsx';
import { accentAttrs, type Accent, type Backdrop } from '../../glass/accent.tsx';
import { createLensSelect, type LensSelect } from '../../motion/lensSelect.ts';
import '../shared/lens.css';
import { Icon, cx, useDomId } from '../shared/icons.tsx';
import './ULSegmented.css';

/* =====================================================================
 * Segmented control: a NON-glass inset well (glass look from tint, rim and inner shadow; no backdrop-filter) so the
 * shared lens bubble can refract the labels. ONE indicator: the bubble's persistent element (flat capsule at rest).
 * Click / keyboard: it inflates, floats to the new segment, settles, shrinks. Press and hold: inflates in place or glides to
 * the pressed segment; drag follows on --ul-lens-follow; release selects the nearest.
 * Keys: arrows move AND select (roving tabindex), Home / End.
 * ===================================================================== */
export interface SegmentOption { value: string; label?: React.ReactNode; icon?: React.ReactNode; disabled?: boolean; 'aria-label'?: string }
export interface ULSegmentedControlProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** Options ({ value, label?, icon?, disabled?, aria-label? }). */ options: SegmentOption[];
  /** Controlled selected value. */ value?: string;
  /** Initial value when uncontrolled. */ defaultValue?: string;
  /** Called with the selected value. */ onValueChange?: (v: string) => void;
  /** "md" (default) | "sm". */ size?: 'sm' | 'md';
  /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean;
  /** Stretch to the container width; items share the width equally. Default false. */ fullWidth?: boolean;
  /** Accent colour: accent name ("violet", "ice", "emerald", "amber", "rose") or a CSS colour (checked by guardAccent). */ accent?: Accent;
  /** Backdrop hint for the glass: "dark" | "mid" | "light". */ backdrop?: Backdrop;
  /** Lens bubble on press / drag / selection changes. Default true. */
  lens?: boolean;
  /** Required unless aria-labelledby is set. */
  'aria-label'?: string;
}

export function ULSegmentedControl({ options, value, defaultValue, onValueChange, size = 'md', disabled, fullWidth, accent, backdrop, lens: lensOn = true, className, ...rest }: ULSegmentedControlProps) {
  const [own, setOwn] = React.useState(defaultValue ?? options[0]?.value);
  const v = value ?? own;
  const root = React.useRef<HTMLDivElement | null>(null);
  const uid = useDomId('ul-seg');
  const pickRef = React.useRef<(v: string) => void>(() => {});
  const sel = React.useRef<LensSelect | null>(null);
  const prevSel = React.useRef<HTMLElement | null>(null);
  const fromDrag = React.useRef(false);
  const viaKey = React.useRef(false);
  const lensRef = React.useRef(lensOn && !disabled); lensRef.current = lensOn && !disabled;
  React.useEffect(() => {
    const r = root.current;
    if (!r) return;
    sel.current = createLensSelect({
      list: r, items: () => [...r.querySelectorAll<HTMLElement>('[data-ul-lens-item]:not(:disabled)')],
      selected: () => r.querySelector<HTMLElement>('[aria-checked="true"]'),
      onSelect: (el) => { fromDrag.current = true; pickRef.current(el.dataset.value!); }, enabled: () => lensRef.current,
    });
    prevSel.current = r.querySelector<HTMLElement>('[aria-checked="true"]');
    return () => { sel.current?.destroy(); sel.current = null; };
  }, []);
  React.useLayoutEffect(() => {
    const r = root.current, now = r?.querySelector<HTMLElement>('[aria-checked="true"]') ?? null;
    if (!fromDrag.current && prevSel.current && now && now !== prevSel.current) sel.current?.travel(prevSel.current, now, viaKey.current ? 'key' : 'click');
    else if (now) sel.current?.syncRest();
    fromDrag.current = false; viaKey.current = false;
    prevSel.current = now;
  }, [v]);
  const enabled = options.filter((o) => !o.disabled && !disabled);
  const pick = (val: string, focus = false) => {
    if (value === undefined) setOwn(val);
    onValueChange?.(val);
    if (focus) requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(val)}"]`)?.focus());
  };
  pickRef.current = (val: string) => pick(val);
  const onKey = (e: React.KeyboardEvent) => {
    const i = enabled.findIndex((o) => o.value === v);
    const n = enabled.length;
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to < 0 || !n) return;
    e.preventDefault();
    viaKey.current = true;
    pick(enabled[to].value, true);
  };
  const acc = accentAttrs(accent);
  return (
    <div ref={root} role="radiogroup" aria-disabled={disabled || undefined} {...rest} data-ul-accent={acc['data-ul-accent']} data-ul-backdrop={backdrop}
      style={{ ...acc.style, ...rest.style } as React.CSSProperties}
      className={cx('ul-seg', className)} data-size={size} data-full={fullWidth ? '' : undefined} onKeyDown={onKey}>
      {options.map((o) => {
        const on = o.value === v;
        return (
          <button key={o.value} id={`${uid}-${o.value}`} type="button" role="radio" aria-checked={on} aria-label={o['aria-label']} tabIndex={on ? 0 : -1}
            disabled={disabled || o.disabled} data-value={o.value} data-ul-lens-item="" className="ul-seg-item" onClick={() => { if (sel.current?.consumeClick()) return; pick(o.value); }}>
            {o.icon ? <span className="ul-seg-icon" aria-hidden="true">{o.icon}</span> : null}
            {o.label != null ? <span className="ul-seg-label">{o.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* =====================================================================
 * Stepper = step indicator (current / total with labels) for multi-step
 * flows (onboarding, checkout, contact brief). Not a numeric stepper —
 * that is ULNumberField. Current step is a vivid glass dot, done steps tinted.
 * ===================================================================== */
export interface StepItem { label: React.ReactNode; description?: React.ReactNode }
export interface ULStepperProps extends React.HTMLAttributes<HTMLElement> {
  /** Steps ({ label, description?, state?: "done" | "current" | "todo" }); done steps are buttons when onStep is set. */ steps: StepItem[];
  /** 0-based index of the current step. */
  current: number;
  /** "Step 2 of 4" — localize here. */
  countLabel?: (current: number, total: number) => string;
  /** Screen-reader state words. Default English. */
  stateLabels?: { done: string; current: string; todo: string };
  /** "horizontal" (default) | "vertical"; arrow keys follow it. */ orientation?: 'horizontal' | 'vertical';
  /** Lets users jump back to completed steps. */
  onStepSelect?: (index: number) => void;
  /** Accent colour: accent name ("violet", "ice", "emerald", "amber", "rose") or a CSS colour (checked by guardAccent). */ accent?: Accent;
  /** Accessible name when there is no visible label. */ 'aria-label'?: string;
}
export function ULStepper({ steps, current, countLabel = (c, t) => `Step ${c} of ${t}`, stateLabels = { done: 'completed', current: 'current', todo: 'not started' }, orientation = 'horizontal', onStepSelect, accent, className, ...rest }: ULStepperProps) {
  return (
    <nav {...rest} className={cx('ul-steps', className)} data-orientation={orientation}>
      <ol className="ul-steps-list">
        {steps.map((s, i) => {
          const st = i < current ? 'done' : i === current ? 'current' : 'todo';
          const dot = st === 'todo'
            ? <span className="ul-step-dot" aria-hidden="true">{i + 1}</span>
            : <ULGlass as="span" aria-hidden="true" tier="sm" radius="50%" className="ul-step-dot" materialCategory="controls" accent={accent} accentStrength={st === 'current' ? 'vivid' : 'tinted'}>{st === 'done' ? <Icon name="check" /> : i + 1}</ULGlass>;
          const body = (<>{dot}<span className="ul-step-text"><span className="ul-step-label">{s.label}</span>{s.description ? <span className="ul-step-desc">{s.description}</span> : null}<span className="ul-visually-hidden">, {stateLabels[st]}</span></span></>);
          return (
            <li key={i} className="ul-step" data-state={st} aria-current={st === 'current' ? 'step' : undefined}>
              {onStepSelect && st === 'done' ? <button type="button" className="ul-step-hit" onClick={() => onStepSelect(i)}>{body}</button> : <span className="ul-step-hit">{body}</span>}
            </li>
          );
        })}
      </ol>
      <p className="ul-steps-count" aria-live="polite">{countLabel(Math.min(current + 1, steps.length), steps.length)}</p>
    </nav>
  );
}
