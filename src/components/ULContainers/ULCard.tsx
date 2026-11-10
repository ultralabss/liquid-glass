import * as React from 'react';
import { ULGlass } from '../../glass/ULGlass.tsx';
import type { GlassTier } from '../../glass/engine.ts';
import { accentAttrs, type Accent, type AccentStrength, type Backdrop } from '../../glass/accent.tsx';
import { ULSpinner } from '../ULSpinner/ULSpinner.tsx';
import { cx } from '../shared/icons.tsx';
import './ULContainers.css';
import { withContextMenu, splitCtx, useContextMenuTarget, mergeCtx, type ContextMenuProps } from './contextTarget.tsx';

/* =====================================================================
 * Card + Panel: static containers with header / footer slots and size tiers.
 * Card sm = glass md + small padding; md = glass md; lg = glass lg.
 * Interactive card: ONE real link or button (the title) whose hit area is stretched over the whole card
 * (::after), so nested actions in the footer stay valid, separate buttons. Min height 56px. Pointer light always;
 * elastic (2–3px, ULGlass interactive) only on sm cards. Focus ring is a child (never outlines the lens).
 * Panel: glass lg (default) or a calm surface (surface="calm" | "well") for data and long reading; calm never refracts.
 * ===================================================================== */
type Size = 'sm' | 'md' | 'lg';
type ForceState = 'hover' | 'focus' | 'pressed';
const TIER: Record<Size, GlassTier> = { sm: 'md', md: 'md', lg: 'lg' };

export interface ULCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  size?: Size;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Top-right of the header (badges, a menu button). */
  actions?: React.ReactNode;
  /** Media above the header (image slot, chart). */
  media?: React.ReactNode;
  footer?: React.ReactNode;
  /** Makes the card interactive: the title becomes this link; the whole card is its hit area. */
  href?: string;
  /** Makes the card interactive: the title becomes a button. */
  onPress?: () => void;
  /** aria-current / selected look for picker cards. */
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: React.ReactNode;
  accent?: Accent;
  accentStrength?: AccentStrength;
  backdrop?: Backdrop;
  /** Heading level of the title. Default 3. */
  level?: 2 | 3 | 4;
  /** @internal showcase */
  forceState?: ForceState;
  children?: React.ReactNode;
}

/** Card. contextMenu target: { component: 'card', kind: 'self', id }. */
export function ULCard(props: ULCardProps & ContextMenuProps) { const [c, rest] = splitCtx(props); return withContextMenu(<CardBase {...rest} />, c, 'card', { id: props.id }); }
function CardBase({ size = 'md', title, description, actions, media, footer, href, onPress, selected, disabled, loading, error, accent, accentStrength, backdrop, level = 3, forceState, className, children, ...rest }: ULCardProps) {
  const interactive = !!(href || onPress) && !disabled;
  const H = `h${level}` as 'h3';
  const hit = interactive || (disabled && (href || onPress))
    ? href
      ? <a className="ul-card-hit" href={disabled ? undefined : href} aria-disabled={disabled || undefined} aria-current={selected ? 'true' : undefined}>{title}</a>
      : <button type="button" className="ul-card-hit" onClick={onPress} disabled={disabled} aria-pressed={selected === undefined ? undefined : selected}>{title}</button>
    : title;
  return (
    <ULGlass
      as="article"
      {...rest}
      tier={TIER[size]}
      padding={`var(--ul-card-pad-${size})`}
      accent={accent}
      accentStrength={accentStrength ?? (selected ? 'tinted' : undefined)}
      backdrop={backdrop}
      interactive={interactive && size === 'sm'}
      elasticity={interactive && size === 'sm' ? 1 : undefined}
      pressable={interactive && size === 'sm'}
      aria-busy={loading || undefined}
      aria-disabled={disabled || undefined}
      data-size={size}
      data-interactive-card={interactive ? '' : undefined}
      data-selected={selected ? '' : undefined}
      data-error={error ? '' : undefined}
      data-force={forceState}
      className={cx('ul-card', className)}
    >
      {media ? <div className="ul-card-media">{media}</div> : null}
      {title || actions ? (
        <header className="ul-card-head">
          <div className="ul-card-titles">
            {title ? <H className="ul-card-title">{hit}</H> : null}
            {description ? <p className="ul-card-desc">{description}</p> : null}
          </div>
          {actions ? <div className="ul-card-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children ? <div className="ul-card-body">{children}</div> : null}
      {error ? <p className="ul-card-error" role="alert">{error}</p> : null}
      {footer ? <footer className="ul-card-foot">{footer}</footer> : null}
      {loading ? <div className="ul-card-loading" aria-hidden="true"><ULSpinner /></div> : null}
      {interactive ? <span className="ul-card-ring" aria-hidden="true"></span> : null}
    </ULGlass>
  );
}

export interface ULPanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** glass (lg, default) | calm (flat graphite, never refracts: data, tables, charts) | well (inset). */
  surface?: 'glass' | 'calm' | 'well';
  size?: Size;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  as?: React.ElementType;
  level?: 2 | 3 | 4;
  accent?: Accent;
  accentStrength?: AccentStrength;
  backdrop?: Backdrop;
  loading?: boolean;
  children?: React.ReactNode;
}

/** Panel. contextMenu target: { component: 'panel', kind: 'self', id }. */
export function ULPanel(props: ULPanelProps & ContextMenuProps) { const [c, rest] = splitCtx(props); return withContextMenu(<PanelBase {...rest} />, c, 'panel', { id: props.id }); }
function PanelBase({ surface = 'glass', size = 'md', title, description, actions, footer, as = 'section', level = 2, accent, accentStrength, backdrop, loading, className, children, style, ...rest }: ULPanelProps) {
  const H = `h${level}` as 'h2';
  const inner = (
    <>
      {title || actions ? (
        <header className="ul-panel-head">
          <div className="ul-card-titles">
            {title ? <H className="ul-panel-title">{title}</H> : null}
            {description ? <p className="ul-card-desc">{description}</p> : null}
          </div>
          {actions ? <div className="ul-card-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="ul-panel-body">{children}</div>
      {footer ? <footer className="ul-panel-foot">{footer}</footer> : null}
      {loading ? <div className="ul-card-loading" aria-hidden="true"><ULSpinner /></div> : null}
    </>
  );
  if (surface === 'glass') {
    return (
      <ULGlass as={as} {...rest} style={style} tier={size === 'lg' ? 'xl' : 'lg'} padding={size === 'sm' ? 'var(--ul-card-pad-sm)' : 'var(--ul-panel-pad)'} accent={accent} accentStrength={accentStrength} backdrop={backdrop} aria-busy={loading || undefined} data-size={size} className={cx('ul-panel', className)}>
        {inner}
      </ULGlass>
    );
  }
  const Tag = as as 'section';
  const acc = accentAttrs(accent, accentStrength);
  return (
    <Tag {...rest} className={cx('ul-panel', 'ul-panel--flat', className)} data-surface={surface} data-size={size} data-ul-accent={acc['data-ul-accent']} data-ul-backdrop={backdrop} aria-busy={loading || undefined} style={{ ...acc.style, ...style } as React.CSSProperties}>
      {inner}
    </Tag>
  );
}
