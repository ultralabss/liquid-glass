import * as React from 'react';
import { cx, ULIcon } from '../shared/icons.tsx';
import './typography.css';

type L = 'en' | 'sk' | 'de' | 'cs';
const NEWTAB: Record<L, string> = { en: '(opens in a new tab)', sk: '(otvorí sa na novej karte)', de: '(öffnet in neuem Tab)', cs: '(otevře se na nové kartě)' };
const loc = (l?: string): L => { const k = (l || (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'en').slice(0, 2).toLowerCase(); return (['en', 'sk', 'de', 'cs'].includes(k) ? k : 'en') as L; };

export type TypeSize = 'display' | 'h1' | 'h2' | 'h3' | 'h4';
export interface ULHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Document outline level (h1–h6). */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Visual size, independent of the level. Default: h1→h1 … h4+→h4. */
  size?: TypeSize;
  /** Clamp to n lines (ellipsis). */
  lines?: number;
}
export function ULHeading({ level = 2, size, lines, className, style, children, ...rest }: ULHeadingProps) {
  const Tag = `h${level}` as 'h2';
  const s = size ?? (level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4');
  return <Tag {...rest} className={cx('ul-heading', className)} data-size={s} data-lines={lines ? '' : undefined} style={lines ? { WebkitLineClamp: lines, ...style } : style}>{children}</Tag>;
}

export interface ULTextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'body' | 'lead' | 'small' | 'caption' | 'muted';
  as?: 'p' | 'span' | 'div' | 'label' | 'small' | 'strong';
  /** One line with ellipsis. */
  truncate?: boolean;
  /** Clamp to n lines. */
  lines?: number;
  /** Tabular numerals (tables, counters). */
  tabular?: boolean;
}
export function ULText({ variant = 'body', as = 'p', truncate, lines, tabular, className, style, children, ...rest }: ULTextProps) {
  const Tag = as as 'p';
  return <Tag {...rest} className={cx('ul-text', className)} data-variant={variant} data-truncate={truncate ? '' : undefined} data-lines={lines ? '' : undefined} data-tabular={tabular ? '' : undefined}
    style={lines ? { WebkitLineClamp: lines, ...style } : style}>{children}</Tag>;
}

export function ULCode({ children, className, ...rest }: React.HTMLAttributes<HTMLElement>) { return <code {...rest} className={cx('ul-code-inline', className)}>{children}</code>; }

export interface ULBlockquoteProps { children: React.ReactNode; /** Who said it (figcaption). */ source?: React.ReactNode; /** URL of the source (cite attribute). */ cite?: string; className?: string }
export function ULBlockquote({ children, source, cite, className }: ULBlockquoteProps) {
  return <figure className={cx('ul-quote', className)}><blockquote cite={cite}>{children}</blockquote>{source ? <figcaption>{source}</figcaption> : null}</figure>;
}

export interface ULListProps { ordered?: boolean; items?: React.ReactNode[]; children?: React.ReactNode; /** Tighter spacing. */ dense?: boolean; className?: string }
export function ULList({ ordered, items, children, dense, className }: ULListProps) {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className={cx('ul-list', className)} data-dense={dense ? '' : undefined}>{items ? items.map((it, i) => <li key={i}>{it}</li>) : children}</Tag>;
}

export interface ULLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /** External link: icon + rel. Default: auto (absolute URL on another host). */
  external?: boolean;
  /** Open in a new tab (target _blank + rel noopener noreferrer + spoken hint). Default: same as external. */
  newTab?: boolean;
  /** Visual: inline (underlined, in text) or standalone. */
  variant?: 'inline' | 'standalone';
  locale?: string;
}
const isExternal = (href: string) => { try { if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(href)) return false; return typeof location === 'undefined' || new URL(href).host !== location.host; } catch { return false; } };
/** Link: focus ring outside, external indicator via ULIcon, rel / target handled (never a bare target=_blank). */
export function ULLink({ href, external, newTab, variant = 'inline', locale, className, children, rel, target, ...rest }: ULLinkProps) {
  const ext = external ?? isExternal(href), nt = newTab ?? ext;
  const rels = new Set((rel ?? '').split(/\s+/).filter(Boolean)); if (nt) { rels.add('noopener'); rels.add('noreferrer'); } if (ext) rels.add('external');
  return (
    <a {...rest} href={href} className={cx('ul-link', className)} data-variant={variant} data-external={ext ? '' : undefined}
      target={nt ? '_blank' : target} rel={rels.size ? [...rels].join(' ') : undefined}>
      {children}
      {ext ? <ULIcon name="external" size="xs" className="ul-link-ext" aria-hidden="true" /> : null}
      {nt ? <span className="ul-vh">{' ' + NEWTAB[loc(locale)]}</span> : null}
    </a>
  );
}

/** Rich content wrapper: styles h1–h4, p, lists, blockquote, code, pre, a, hr, tables and media with the type scale; safe wrapping. */
export function ULProse({ children, className, size = 'md', ...rest }: React.HTMLAttributes<HTMLDivElement> & { size?: 'sm' | 'md' | 'lg' }) {
  return <div {...rest} className={cx('ul-prose', className)} data-size={size}>{children}</div>;
}
