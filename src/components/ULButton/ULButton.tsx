import * as React from 'react';
import { ULGlass } from '../../glass/ULGlass.tsx';
import type { Accent, AccentStrength, Backdrop } from '../../glass/accent.tsx';
import type { Material } from '../../glass/material.tsx';
import { ULAnchoredSurface } from '../ULAnchoredSurface/ULAnchoredSurface.tsx';
import { ULSpinner } from '../ULSpinner/ULSpinner.tsx';
import { Icon, cx } from '../shared/icons.tsx';
import { isDev, surfaceBehind, warnOnce } from '../shared/dev.ts';
import './ULButton.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tinted' | 'plain' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonShape = 'capsule' | 'rounded' | 'circle';
/** @internal showcase / visual tests only: render a state without the pointer. */
export type ForceState = 'hover' | 'focus' | 'pressed' | (string & {});

export interface ULButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** primary = vivid accent glass · secondary = neutral glass · tinted = tinted accent glass · plain = no surface (only on solid or glass surfaces) · destructive = vivid danger glass. Default secondary. */
  variant?: ButtonVariant;
  /** Visual height sm 36 / md 44 / lg 52. The hit area never drops below 44px. */
  size?: ButtonSize;
  /** Default "capsule" ("circle" when icon-only). */
  shape?: ButtonShape;
  /** Leading icon (an <svg>). With no children the button is icon-only and needs aria-label. */
  icon?: React.ReactNode;
  /** Icon after the label (e.g. chevron, external). Sized by the button (ULIcon md). */ iconEnd?: React.ReactNode;
  /** Keeps the width, shows a spinner, sets aria-busy and ignores clicks. */
  loading?: boolean;
  /** Renders a real <a>. Disabled links get aria-disabled and leave the tab order. */
  href?: string;
  /** Link target when `href` is set (e.g. "_blank"; rel defaults to "noopener noreferrer"). */ target?: string;
  /** Link rel when `href` is set. Default: "noopener noreferrer" for target="_blank". */ rel?: string;
  /** Toggle button: sets aria-pressed. Use with onPressedChange. */
  pressed?: boolean;
  /** Toggle mode: called with the next pressed state on click (aria-pressed). */ onPressedChange?: (pressed: boolean) => void;
  /** Accent preset or CSS color. Omit to inherit. */
  accent?: Accent;
  /** What sits behind the button. Use "light" (reading variant) on busy or bright backdrops. */
  backdrop?: Backdrop;
  /** "glass" | "flat" (controls category). Omit to resolve from ULProvider. @default undefined (resolved: "glass") */ material?: Material;
  /** Native button type. Default "button" (never submits a form by accident). */ type?: 'button' | 'submit' | 'reset';
  /** Stretch to the container width. Default false. */ fullWidth?: boolean;
  /** Layers drawn across the WHOLE button (inset 0, clipped to its radius, under icon + label): fills, ripples. */
  layers?: React.ReactNode;
  /** @internal */
  forceState?: ForceState;
}

const STRENGTH: Record<ButtonVariant, AccentStrength | undefined> = { primary: 'vivid', secondary: 'subtle', tinted: 'tinted', plain: undefined, destructive: 'vivid' };
const RADIUS: Record<ButtonShape, string> = { capsule: 'var(--ul-radius-capsule)', rounded: 'var(--ul-control-radius)', circle: '50%' };

/** Glass button. Elastic (2-3px, --ul-elasticity) and pressable; plain has no surface and does not move. */
export const ULButton = React.forwardRef<HTMLElement, ULButtonProps>(function ULButton(
  { variant = 'secondary', size = 'md', shape, icon, iconEnd, loading = false, href, target, rel, pressed, onPressedChange, accent, backdrop,
    type = 'button', fullWidth, forceState, disabled, className, children, onClick, layers, material, ...rest },
  ref,
) {
  const iconOnly = !!icon && (children == null || children === '' || children === false);
  const sh = shape ?? (iconOnly ? 'circle' : 'capsule');
  const isToggle = pressed !== undefined;
  const inert = disabled || loading;
  if (iconOnly && !rest['aria-label'] && !rest['aria-labelledby'] && typeof console !== 'undefined') console.warn('[ULButton] icon-only buttons need aria-label');
  const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (inert) { e.preventDefault(); return; }
    if (isToggle) onPressedChange?.(!pressed);
    onClick?.(e);
  };
  const cls = cx('ul-btn', `ul-btn--${variant}`, className);
  const data = {
    'data-size': size, 'data-shape': sh, 'data-icon-only': iconOnly ? '' : undefined, 'data-loading': loading ? '' : undefined,
    'data-full': fullWidth ? '' : undefined, 'data-active': isToggle && pressed ? '' : undefined, 'data-ul-force': forceState || undefined,
  };
  const aria = {
    'aria-busy': loading || (rest['aria-busy'] as boolean | undefined) || undefined, 'aria-pressed': isToggle ? !!pressed : undefined,
    'aria-disabled': href && inert ? true : loading ? true : (rest['aria-disabled'] as boolean | undefined) || undefined,
  };
  const tag = href ? { href: inert ? undefined : href, target, rel: rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined), role: inert ? 'link' : undefined, tabIndex: disabled ? -1 : undefined } : { type, disabled: disabled || undefined };
  const body = (
    <>
      <span className="ul-btn-hit ul-hit-layer" aria-hidden="true" />
      {layers ? <span className="ul-btn-fx" aria-hidden="true">{layers}</span> : null}
      {variant === 'plain' ? null : <span className="ul-btn-ring" aria-hidden="true" />}
      {icon ? <span className="ul-btn-icon" aria-hidden="true">{icon}</span> : null}
      {iconOnly ? null : <span className="ul-btn-label">{children}</span>}
      {iconEnd ? <span className="ul-btn-icon" aria-hidden="true">{iconEnd}</span> : null}
      {loading ? <ULSpinner /> : null}
    </>
  );
  const plainRef = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    const el = plainRef.current;
    if (variant !== 'plain' || !el || !isDev()) return;
    const t = window.setTimeout(() => { // after styles settle
      if (el.isConnected && surfaceBehind(el) === 'busy') warnOnce(el, 'plain', 'ULButton variant="plain" has no solid or glass surface behind it; its label can drop below 4.5:1 on a busy backdrop. Use secondary, or place it on a panel.');
    }, 1200);
    return () => clearTimeout(t);
  }, [variant]);
  if (variant === 'plain') {
    const Tag = (href ? 'a' : 'button') as React.ElementType;
    const setPlain = (n: HTMLElement | null) => { plainRef.current = n; if (typeof ref === 'function') ref(n); else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = n; };
    return <Tag ref={setPlain} {...rest} {...tag} {...aria} {...data} className={cls} style={{ borderRadius: RADIUS[sh], ...rest.style }} onClick={handle}>{body}</Tag>;
  }
  const strength = isToggle && variant === 'secondary' && pressed ? 'tinted' : STRENGTH[variant];
  return (
    <ULGlass
      ref={ref}
      as={href ? 'a' : 'button'}
      {...rest}
      {...tag}
      {...aria}
      {...data}
      tier="sm"
      radius={RADIUS[sh]}
      interactive={!inert}
      pressable={!inert}
      accent={variant === 'destructive' ? 'var(--ul-color-danger)' : accent}
      accentStrength={strength}
      backdrop={backdrop}
      material={material}
      materialCategory="controls"
      className={cls}
      onClick={handle}
    >
      {body}
    </ULGlass>
  );
});

/* ---------------- Toggle ---------------- */
export interface ULToggleButtonProps extends Omit<ULButtonProps, 'pressed' | 'onPressedChange'> {
  /** Controlled pressed state (aria-pressed). */ pressed?: boolean;
  /** Initial pressed state when uncontrolled. Default false. */ defaultPressed?: boolean;
  /** Called with the next pressed state on every click. */ onPressedChange?: (pressed: boolean) => void;
}
/** On/off button (aria-pressed). Controlled with pressed, or uncontrolled with defaultPressed. */
export const ULToggleButton = React.forwardRef<HTMLElement, ULToggleButtonProps>(function ULToggleButton({ pressed, defaultPressed = false, onPressedChange, ...rest }, ref) {
  const [own, setOwn] = React.useState(defaultPressed);
  const on = pressed ?? own;
  return <ULButton ref={ref} {...rest} pressed={on} onPressedChange={(v) => { if (pressed === undefined) setOwn(v); onPressedChange?.(v); }} />;
});

/* ---------------- Group ---------------- */
export interface ULButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Required: what the group is for. */
  'aria-label'?: string;
  /** One glass capsule with flattened buttons inside (default), or separate buttons with a gap. */
  attached?: boolean;
  /** "horizontal" (default) | "vertical". Buttons inside use the vertical-only hit layer. */ orientation?: 'horizontal' | 'vertical';
  /** Backdrop hint for the glass ("dark" | "mid" | "light"), passed to every button. */ backdrop?: Backdrop;
}
/** Related actions. Attached groups are ONE glass layer; the buttons inside are flattened (they never sample glass). */
export function ULButtonGroup({ attached = true, orientation = 'horizontal', backdrop, className, children, ...rest }: ULButtonGroupProps) {
  const cls = cx('ul-btn-group', attached && 'ul-btn-group--attached', className);
  if (!attached) return <div role="group" {...rest} data-orientation={orientation} className={cls}>{children}</div>;
  return (
    <ULGlass role="group" {...rest} materialCategory="controls" tier="sm" radius="var(--ul-radius-capsule)" backdrop={backdrop} data-orientation={orientation} className={cls}>
      {children}
    </ULGlass>
  );
}

/* ---------------- Split button ---------------- */
export interface SplitItem { label: string; onSelect?: () => void; icon?: React.ReactNode; disabled?: boolean; destructive?: boolean }
export interface ULSplitButtonProps extends Omit<ULButtonProps, 'icon' | 'iconEnd' | 'shape' | 'pressed' | 'onPressedChange' | 'href'> {
  /** Menu items of the secondary part (ULMenu items, opened from the chevron). */ items: SplitItem[];
  /** aria-label of the menu trigger. Default "More options". */
  menuLabel?: string;
  /** Render the menu at the page root (works inside transformed ancestors). Default true. */
  portal?: boolean;
}
/**
 * Main action + a menu of related actions. The menu is a ULAnchoredSurface:
 * it pours out from behind the trigger with the shared anchored morph.
 * Keys: ArrowDown / Enter / Space on the trigger opens and focuses the first item; ArrowUp/Down, Home/End move; Escape closes.
 */
export function ULSplitButton({ items, menuLabel = 'More options', portal = true, variant = 'primary', size = 'md', disabled, loading, children, className, style, accent, backdrop, ...rest }: ULSplitButtonProps) {
  const [open, setOpen] = React.useState(false);
  const trig = React.useRef<HTMLElement | null>(null);
  const menu = React.useRef<HTMLDivElement | null>(null);
  const focusAt = (i: number) => {
    const f = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    if (f.length) f[(i + f.length) % f.length].focus();
  };
  const openAndFocus = (i: number) => { setOpen(true); requestAnimationFrame(() => requestAnimationFrame(() => focusAt(i))); };
  const close = (refocus = true) => { setOpen(false); if (refocus) trig.current?.focus(); };
  const onTrigKey = (e: React.KeyboardEvent) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openAndFocus(e.key === 'ArrowUp' ? -1 : 0); } };
  const onMenuKey = (e: React.KeyboardEvent) => {
    const f = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const i = f.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(-1); }
    else if (e.key === 'Tab') close(false);
  };
  const id = React.useId().replace(/:/g, '');
  return (
    <div className={cx('ul-split', className)} style={style} data-size={size}>
      <ULButton {...rest} variant={variant} size={size} disabled={disabled} loading={loading} accent={accent} backdrop={backdrop} className="ul-split-main">{children}</ULButton>
      <ULButton
        ref={trig}
        variant={variant}
        size={size}
        accent={accent}
        backdrop={backdrop}
        disabled={disabled || loading}
        className="ul-split-trigger"
        icon={<Icon name="chevron-down" />}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `ul-split-${id}` : undefined}
        onClick={() => (open ? close() : openAndFocus(0))}
        onKeyDown={onTrigKey}
      />
      <ULAnchoredSurface scrollBehavior="lock" open={open} anchorRef={trig} onClose={() => close()} side="bottom" align="end" portal={portal} role="menu" id={`ul-split-${id}`} aria-label={menuLabel} backdrop="light">
        <div ref={menu} className="ul-menu" onKeyDown={onMenuKey}>
          {items.map((it, i) => (
            <button key={i} type="button" role="menuitem" className="ul-menu-item" data-tone={it.destructive ? 'danger' : undefined} disabled={it.disabled}
              onClick={() => { it.onSelect?.(); close(); }}>
              {it.icon ? <span className="ul-btn-icon" aria-hidden="true">{it.icon}</span> : null}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      </ULAnchoredSurface>
    </div>
  );
}

/* ---------------- FAB ---------------- */
export interface ULFabProps extends Omit<ULButtonProps, 'size' | 'shape'> {
  /** Extended FAB: a label next to the icon. Without it the FAB is icon-only (aria-label required). */
  label?: string;
  /** Fixed placement with safe-area insets, or 'none' to place it yourself. Default 'none'. */
  placement?: 'none' | 'bottom-end' | 'bottom-start' | 'bottom-center';
}
/** Floating action button: 56px, vivid accent glass, elastic. */
export const ULFab = React.forwardRef<HTMLElement, ULFabProps>(function ULFab({ label, placement = 'none', variant = 'primary', className, ...rest }, ref) {
  return (
    <ULButton ref={ref} {...rest} variant={variant} size="lg" shape={label ? 'capsule' : 'circle'} className={cx('ul-fab', placement !== 'none' && `ul-fab--${placement}`, className)}>
      {label}
    </ULButton>
  );
});
