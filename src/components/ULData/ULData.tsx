import * as React from 'react';
import { ULGlass } from '../../glass/ULGlass.tsx';
import { ULMenu, type MenuItem } from '../ULContainers/ULMenu.tsx';
import { useContextMenuTarget, mergeCtx, withContextMenu, splitCtx, type ContextMenuSpec, type ContextMenuProps, type ContextTarget } from '../ULContainers/contextTarget.tsx';
import { ULCheckbox } from '../ULSelection/ULSelection.tsx';
import { ULButton } from '../ULButton/ULButton.tsx';
import { ULSegmentedControl } from '../ULSegmented/ULSegmented.tsx';
import { createNavIndicator, type NavIndicator } from '../ULIsland/navIndicator.ts';
import { isMorphReduced, getMorphTimeScale } from '../../motion/anchoredMorph.ts';
import { springs } from '../../motion/spring.ts';
import { accentAttrs, type Accent } from '../../glass/accent.tsx';
import { Icon, ULIcon, cx, useDomId } from '../shared/icons.tsx';
import { ULRollingNumber, ULSparkline, ULKpiDelta } from './ULKpi.tsx';
import type { LiveStore } from '../../live/liveStore.ts';
import './ULData.css';

/* =====================================================================
 * Data components (2d → Part 1 "data glass"). Data stays readable on calm surfaces; glass gives the frame, the
 * controls and the feedback. Panels (stat tile, table, chart) are ONE lite glass surface each; rows and cells are
 * never glass; everything inside a panel is flattened (tint + rim, no backdrop). --ul-data-glass (subtle | rich) and
 * --ul-data-glass-intensity scale the material (--dg). The hovered / focused element is the only thing that promotes.
 * ===================================================================== */
const rootCS = () => getComputedStyle(document.documentElement);
const tokMs = (k: string, f: number) => { const v = parseFloat(rootCS().getPropertyValue(k)); return (Number.isFinite(v) ? v : f) * getMorphTimeScale(); };

/* ---------- Badge (flattened glass capsule) ---------- */
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export interface ULBadgeProps extends React.HTMLAttributes<HTMLSpanElement> { /** Semantic tone: "neutral" | "accent" | "success" | "warning" | "danger" | "info" (--ul-tone-*). */ tone?: Tone; /** "soft" (default) | "solid" | "outline". */ variant?: 'soft' | 'solid' | 'outline'; /** Leading status dot. Default false. */ dot?: boolean; /** Size step (see the type). */ size?: 'sm' | 'md' }
/** Badge. contextMenu target: { component: 'badge', kind: 'self', id }. */
export function ULBadge(props: ULBadgeProps & ContextMenuProps) { const [c, rest] = splitCtx(props); return withContextMenu(<BadgeBase {...rest} />, c, 'badge', { id: props.id }); }
function BadgeBase({ tone = 'neutral', variant = 'soft', dot, size = 'md', className, children, ...rest }: ULBadgeProps) {
  return <span {...rest} className={cx('ul-badge', className)} data-tone={tone} data-variant={variant} data-size={size}>{dot ? <span className="ul-badge-dot" aria-hidden="true"></span> : null}{children}</span>;
}

/* ---------- Avatar ---------- */
export interface ULAvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> { /** Person name: alt text and the initials fallback. */ name: string; /** Image URL; initials show while loading or on error. */ src?: string; /** Size step (see the type). */ size?: 'sm' | 'md' | 'lg'; /** Presence dot: "online" | "away" | "busy" | "offline". */ status?: 'online' | 'away' | 'busy' | 'offline'; /** Accessible text for the presence dot. Default localised from status. */ statusLabel?: string }
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
const hue = (n: string) => [...n].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
/** Avatar. contextMenu target: { component: 'avatar', kind: 'self', id: name }. */
export function ULAvatar(props: ULAvatarProps & ContextMenuProps) { const [c, rest] = splitCtx(props); return withContextMenu(<AvatarBase {...rest} />, c, 'avatar', { id: props.name }); }
function AvatarBase({ name, src, size = 'md', status, statusLabel, className, style, ...rest }: ULAvatarProps) {
  const [broken, setBroken] = React.useState(false);
  return (
    <span {...rest} role="img" aria-label={status ? `${name}, ${statusLabel ?? status}` : name} className={cx('ul-avatar', className)} data-size={size}
      style={{ '--ul-avatar-hue': hue(name), ...style } as React.CSSProperties}>
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : <span aria-hidden="true">{initials(name)}</span>}
      {status ? <span className="ul-avatar-status" data-status={status} aria-hidden="true"></span> : null}
    </span>
  );
}
export interface ULAvatarGroupProps { /** People ({ name, src? }) in display order. */ people: { name: string; src?: string }[]; /** Avatars shown before the "+n" chip. */ max?: number; /** Size step (see the type). */ size?: 'sm' | 'md' | 'lg'; /** Visible label / accessible name. */ label?: string }
export function ULAvatarGroup({ people, max = 4, size = 'md', label }: ULAvatarGroupProps) {
  const shown = people.slice(0, max), more = people.length - shown.length;
  return (
    <span role="group" aria-label={label ?? `${people.length} people`} className="ul-avatar-group" data-size={size}>
      {shown.map((p, i) => <ULAvatar key={i} name={p.name} src={p.src} size={size} />)}
      {more > 0 ? <span className="ul-avatar ul-avatar-more" data-size={size} role="img" aria-label={`and ${more} more`}><span aria-hidden="true">+{more}</span></span> : null}
    </span>
  );
}

/* ---------- Progress (inset well + glass fill with a slow light sweep; ring with a glossy end cap) ---------- */
export interface ULProgressProps { /** Current value; undefined = indeterminate. */ value?: number; /** Maximum value. Default 100. */ max?: number; /** "bar" (default) | "ring". */ kind?: 'bar' | 'ring'; /** Visible label / accessible name. */ label: string; /** Show the formatted value next to the bar / inside the ring. Default true. */ showValue?: boolean; /** Semantic tone: "neutral" | "accent" | "success" | "warning" | "danger" | "info" (--ul-tone-*). */ tone?: Tone; /** Ring diameter in px (kind="ring"). */ size?: number; /** Formats the number for display (Intl options or a function, per prop type). */ format?: (v: number, max: number) => string }
export function ULProgress({ value, max = 100, kind = 'bar', label, showValue = true, tone = 'accent', size, format }: ULProgressProps) {
  const ind = value == null, p = ind ? 0 : Math.min(1, Math.max(0, value / max));
  const txt = ind ? '' : format ? format(value!, max) : `${Math.round(p * 100)} %`;
  const aria = { role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': ind ? undefined : value, 'aria-valuetext': ind ? undefined : txt } as const;
  if (kind === 'ring') {
    const S = size ?? 44, sw = 4, r = (S - sw) / 2, C = 2 * Math.PI * r, a = (ind ? 0.3 : p) * 2 * Math.PI - Math.PI / 2;
    return (
      <span className="ul-progress-ring" data-tone={tone} data-indeterminate={ind ? '' : undefined} style={{ width: S, height: S }} {...aria}>
        <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S} aria-hidden="true" data-ul-illustration="">
          <circle cx={S / 2} cy={S / 2} r={r} className="ul-progress-track" strokeWidth={sw} fill="none" />
          <circle cx={S / 2} cy={S / 2} r={r} className="ul-progress-fill" strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={ind ? C * 0.7 : C * (1 - p)} transform={`rotate(-90 ${S / 2} ${S / 2})`} />
          {!ind && p > 0.02 ? <circle className="ul-progress-cap" cx={S / 2 + r * Math.cos(a)} cy={S / 2 + r * Math.sin(a)} r={sw / 2 + 0.6} /> : null}
        </svg>
        {showValue && !ind && S >= 40 ? <span className="ul-progress-ring-text" aria-hidden="true">{Math.round(p * 100)}</span> : null}
      </span>
    );
  }
  return (
    <div className="ul-progress" data-tone={tone}>
      <div className="ul-progress-head"><span className="ul-progress-label">{label}</span>{showValue && !ind ? <span className="ul-progress-value" aria-hidden="true">{txt}</span> : null}</div>
      <div className="ul-progress-bar" data-indeterminate={ind ? '' : undefined} {...aria}><span className="ul-progress-fill-glass" style={{ transform: `scaleX(${ind ? 0.35 : p})` }}></span></div>
    </div>
  );
}

/* ---------- Skeleton (light-sweep shimmer) ---------- */
export interface ULSkeletonProps { /** "text" (default, line boxes) | "rect" | "circle". */ shape?: 'text' | 'rect' | 'circle'; /** Number of text lines (shape="text"). Default 1. */ lines?: number; /** Width (px or CSS length). */ width?: number | string; /** Height (px or CSS length). */ height?: number | string; /** Extra class on the root element. */ className?: string }
export function ULSkeleton({ shape = 'text', lines = 1, width, height, className }: ULSkeletonProps) {
  if (shape === 'text' && lines > 1) return <span className={cx('ul-skel-lines', className)} aria-hidden="true">{Array.from({ length: lines }, (_, i) => <span key={i} className="ul-skel" data-shape="text" style={{ width: i === lines - 1 ? '62%' : width ?? '100%' }}></span>)}</span>;
  return <span className={cx('ul-skel', className)} data-shape={shape} aria-hidden="true" style={{ width, height }}></span>;
}

/* ---------- Empty state (calm glass-shape illustration: CSS shapes, flattened) ---------- */
export interface ULEmptyStateProps { /** Illustration icon (ULIcon, decorative). */ icon?: React.ReactNode; /** Heading. */ title: React.ReactNode; /** Explanation under the title. */ description?: React.ReactNode; /** Primary action (button / link). */ action?: React.ReactNode; /** Size step (see the type). */ size?: 'sm' | 'md'; /** Heading level of the title: 2 | 3 (default) | 4. */ level?: 2 | 3 | 4 }
export function ULEmptyState({ icon, title, description, action, size = 'md', level = 3 }: ULEmptyStateProps) {
  const H = `h${level}` as 'h3';
  return (
    <div className="ul-empty" data-size={size}>
      <span className="ul-empty-art" aria-hidden="true"><span className="ul-empty-sheet"></span><span className="ul-empty-sheet"></span><span className="ul-empty-icon">{icon ?? <Icon name="search" />}</span></span>
      <H className="ul-empty-title">{title}</H>
      {description ? <p className="ul-empty-desc">{description}</p> : null}
      {action ? <div className="ul-empty-action">{action}</div> : null}
    </div>
  );
}

/* ---------- Breadcrumbs (chips + the shared hover indicator) ---------- */
export interface Crumb { label: string; href?: string; /** In-app navigation (e.g. treemap drill-up): renders a button. */ onSelect?: () => void }
export interface ULBreadcrumbsProps { /** Crumbs ({ label, href? , onClick? }); the last one is the current page (aria-current). Middle crumbs collapse into a menu when space runs out. */ items: Crumb[]; /** Visible label / accessible name. */ label?: string; /** Collapse the middle into a menu above this count. Default 4. */ maxItems?: number; /** Accessible label of the collapsed-crumbs button. Default localised. */ moreLabel?: string; /** Inside a glass panel (chart, card): the hover lens is flat, no second glass surface. */ embedded?: boolean }
/** Breadcrumbs. contextMenu target: { component: 'breadcrumbs', kind: 'crumb', id: label, data: Crumb }. */
export function ULBreadcrumbs(props: ULBreadcrumbsProps & ContextMenuProps<Crumb>) { const [c, rest] = splitCtx(props); return withContextMenu(<CrumbsBase {...(rest as ULBreadcrumbsProps)} />, c, 'breadcrumbs', undefined, { selector: '.ul-crumbs li', kind: 'crumb', data: (id) => props.items.find((x) => x.label === id) }, true); }
function CrumbsBase({ items, label = 'Breadcrumb', maxItems = 4, moreLabel = 'Show path', embedded }: ULBreadcrumbsProps) {
  const [open, setOpen] = React.useState(false);
  const more = React.useRef<HTMLButtonElement | null>(null);
  const nav = React.useRef<HTMLElement | null>(null), lens = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => { if (!nav.current || !lens.current) return; const ind = createNavIndicator({ container: nav.current, lens: lens.current, items: 'a, button' }); return () => ind.destroy(); }, []);
  const collapse = items.length > maxItems;
  const hidden = collapse ? items.slice(1, items.length - 2) : [];
  const shown: (Crumb | 'more')[] = collapse ? [items[0], 'more', ...items.slice(-2)] : items;
  const menu: MenuItem[] = hidden.map((c, i) => ({ id: String(i), label: c.label, onSelect: () => { if (c.onSelect) c.onSelect(); else if (c.href) location.href = c.href; } }));
  return (
    <nav ref={nav} aria-label={label} className="ul-crumbs" data-embedded={embedded ? '' : undefined}>
      {embedded ? <span ref={lens as React.RefObject<HTMLSpanElement>} aria-hidden="true" className="ul-crumbs-lens" data-flat="" /> : <ULGlass as="span" ref={lens} aria-hidden="true" tier="sm" radius="var(--ul-radius-capsule)" className="ul-crumbs-lens" />}
      <ol>
        {shown.map((c, i) => {
          const last = i === shown.length - 1;
          return (
            <li key={i}>
              {c === 'more'
                ? <button ref={more} type="button" className="ul-crumb-more" aria-haspopup="menu" aria-expanded={open} aria-label={moreLabel} onClick={() => setOpen((o) => !o)}>…</button>
                : last ? <span aria-current="page" className="ul-crumb-cur">{c.label}</span> : c.onSelect ? <button type="button" className="ul-crumb-btn" onClick={c.onSelect}>{c.label}</button> : c.href ? <a href={c.href}>{c.label}</a> : <span>{c.label}</span>}
              {last ? null : <span className="ul-crumb-sep" aria-hidden="true"><Icon name="chevron-right" /></span>}
            </li>
          );
        })}
      </ol>
      {collapse ? <ULMenu open={open} onOpenChange={setOpen} anchorRef={more} items={menu} label={moreLabel} /> : null}
    </nav>
  );
}

/* ---------- Pagination (glass segmented control: one shared indicator glides between pages) ---------- */
export interface ULPaginationProps { /** Current page (1-based). */ page: number; /** Total number of pages. */ pageCount: number; /** Called with the new 1-based page. */ onPageChange: (p: number) => void; /** Pages shown on each side of the current one. Default 1. */ siblings?: number; /** Visible label / accessible name. */ label?: string; /** Previous button label. Default "Previous page" (English; pass a translated string). */ prevLabel?: string; /** Next button label. Default "Next page" (English; pass a translated string). */ nextLabel?: string; /** Accessible label per page button, e.g. (p) => `Page ${p}`. */ pageLabel?: (p: number) => string }
export function pageRange(page: number, count: number, sib = 1): (number | '…')[] {
  const out: (number | '…')[] = [], lo = Math.max(2, page - sib), hi = Math.min(count - 1, page + sib);
  out.push(1);
  if (lo > 2) out.push('…');
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < count - 1) out.push('…');
  if (count > 1) out.push(count);
  return out;
}
/** Constant slot count (min(count, 5 + 2·sib)) so the segmented indicator glides between stable slots instead of re-mounting. */
export function pageSlots(page: number, count: number, sib = 1): (number | '…')[] {
  const n = 5 + 2 * sib;
  if (count <= n) return Array.from({ length: count }, (_, i) => i + 1);
  const head = 3 + 2 * sib; // 1 … (window) … N
  if (page <= head - 1) return [...Array.from({ length: head }, (_, i) => i + 1), '…', count];
  if (page >= count - head + 2) return [1, '…', ...Array.from({ length: head }, (_, i) => count - head + 1 + i)];
  return [1, '…', ...Array.from({ length: 2 * sib + 1 }, (_, i) => page - sib + i), '…', count];
}
export function ULPagination({ page, pageCount, onPageChange, siblings = 1, label = 'Pagination', prevLabel = 'Previous page', nextLabel = 'Next page', pageLabel = (p) => `Page ${p}` }: ULPaginationProps) {
  const slots = pageSlots(page, pageCount, siblings);
  return (
    <nav aria-label={label} className="ul-pages">
      <ULButton size="sm" shape="circle" variant="secondary" aria-label={prevLabel} icon={<Icon name="chevron-left" />} disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
      <ULSegmentedControl size="sm" aria-label={label} value={`p${page}`} className="ul-pages-seg"
        options={slots.map((s, i) => (s === '…' ? { value: `e${i}`, label: '…', disabled: true, 'aria-label': 'More pages' } : { value: `p${s}`, label: String(s), 'aria-label': pageLabel(s) }))}
        onValueChange={(v) => { if (v[0] === 'p') onPageChange(+v.slice(1)); }} /* values are page numbers, not slot indices: after the window shifts, arrow-key focus lands on the selected page */ />
      <ULButton size="sm" shape="circle" variant="secondary" aria-label={nextLabel} icon={<Icon name="chevron-right" />} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} />
    </nav>
  );
}

/* ---------- Stat tile (lite glass tile) ---------- */
export interface ULStatTileProps { /** Visible label / accessible name. */ label: string; /** Value to display. */ value?: number | string; /** Formats the number for display (Intl options or a function, per prop type). */ format?: (v: number) => string; /** Change versus the previous period (number; sign decides the arrow). */ delta?: number; /** Formats the delta (default: signed percent). */ deltaFormat?: (d: number) => string; /** Higher is better (default) or worse (costs, errors). */ trend?: 'up-good' | 'down-good'; /** Context for the delta (e.g. "vs last week"). */ deltaLabel?: string; /** Values for the inline sparkline (oldest first). */ sparkline?: number[]; /** Loading state: skeleton / spinner and aria-busy. Default false. */ loading?: boolean; /** Text shown when there is no value / data. Default localised. */ emptyText?: string; /** "calm" (default, flat tint) | "well" (inset). */ surface?: 'calm' | 'well'; /** Accent colour name or CSS colour (checked by guardAccent). */ accent?: Accent; /** Interactive tile: lifts 2px, pointer light, one stretched button. */ onSelect?: () => void }
/** Stat tile. contextMenu target: { component: 'stat', kind: 'self', data: { label, value, delta } }. */
export function ULStatTile(props: ULStatTileProps & ContextMenuProps<{ label: string; value?: number | string; delta?: number }>) { const [c, rest] = splitCtx(props); return withContextMenu(<StatBase {...(rest as ULStatTileProps)} />, c, 'stat', { data: { label: props.label, value: props.value, delta: props.delta } }, undefined, true); }
function StatBase({ label, value, format, delta, deltaFormat, trend = 'up-good', deltaLabel = 'vs previous period', sparkline, loading, emptyText = 'No data yet', surface = 'calm', accent, onSelect }: ULStatTileProps) {
  const id = useDomId('ul-stat');
  const empty = !loading && (value == null || value === '');
  const acc = accentAttrs(accent);
  return (
    <ULGlass as="section" tier="md" quality="lite" padding="0" radius="var(--ul-radius-lg)" className="ul-stat ul-data-panel" data-surface={surface} data-interactive={onSelect ? '' : undefined}
      aria-labelledby={`${id}-l`} aria-busy={loading || undefined} data-ul-accent={acc['data-ul-accent']} style={acc.style as React.CSSProperties}>
      <h3 id={`${id}-l`} className="ul-stat-label">{label}</h3>
      {loading ? <><ULSkeleton width="60%" height="34px" shape="rect" /><ULSkeleton width="40%" /></> : empty ? <p className="ul-stat-empty">{emptyText}</p> : (
        <>
          <p className="ul-stat-value">{typeof value === 'number' && format ? format(value) : value}</p>
          {delta != null ? (deltaFormat
            ? <p className="ul-stat-delta"><ULKpiDelta value={delta} goodDirection={trend === 'up-good' ? 'up' : 'down'} context={deltaLabel} format={{ maximumFractionDigits: 0, signDisplay: 'never' }} /></p>
            : <p className="ul-stat-delta"><ULKpiDelta value={delta} goodDirection={trend === 'up-good' ? 'up' : 'down'} context={deltaLabel} /></p>) : null}
        </>
      )}
      {sparkline && sparkline.length > 1 && !loading && !empty ? <ULSparkline data={sparkline} height={32} className="ul-stat-spark" /> : null}
      {onSelect ? <button type="button" className="ul-kpi-hit" aria-labelledby={`${id}-l`} onClick={onSelect}></button> : null}
    </ULGlass>
  );
}

/* ---------- Table ---------- */
function RowCheck({ label, checked, tabIndex, onToggle }: { label: string; checked: boolean; tabIndex: number; onToggle: () => void }) {
  return <label className="ul-row-check"><input type="checkbox" aria-label={label} checked={checked} tabIndex={tabIndex} onChange={onToggle} /><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span></label>;
}
export interface TableColumn<R> {
  key: string; header: React.ReactNode; align?: 'start' | 'end' | 'center'; sortable?: boolean; width?: number | string;
  /** Sort / change-detection value (default row[key]). */ value?: (r: R) => string | number;
  render?: (r: R) => React.ReactNode; numeric?: boolean;
  /** Number cell that rolls (ULRollingNumber) when the value changes; animates only while the row is in view. */
  roll?: { format?: Intl.NumberFormatOptions; locale?: string; compact?: boolean };
  /** Sticky column (ULColumnsMenu / applyColumns). Offsets come from the widths of the pinned columns before it (default 160px). */
  pin?: 'left' | 'right';
}
export type SortState = { key: string; dir: 'asc' | 'desc' } | null;
export interface TableLiveOptions {
  /** Queue inserts / removes / reorders while the pointer or focus is in the table or a row menu is open. Default true. */
  queue?: boolean;
  /** Cell flash + insert glow. Default true. */
  flash?: boolean;
  /** Summarized, throttled polite announcements ("12 new rows"). Default true. */
  announce?: boolean;
  pendingLabel?: (n: number) => string;
  summary?: (s: { inserted: number; removed: number }) => string;
}
export interface ULTableProps<R> {
  /** Column definitions ({ key, header, cell?, sort?, align?, width?, pin? }). */ columns: TableColumn<R>[];
  /** Static rows (or the latest snapshot). Ignored when `store` is given. */
  rows?: R[];
  /** Live keyed store (useLiveStore): rows re-render individually; the table only re-renders on structure changes. */
  store?: LiveStore<R>;
  /** Stable key per row (selection, live updates, row menus). */ rowKey: (r: R) => string;
  /** Visible label / accessible name. */ label: string;
  /** "compact" | "cozy" (default) | "comfortable" row height. Compact cells are a documented 24px hit-area exception. */ density?: 'compact' | 'cozy' | 'comfortable';
  /** Controlled sort { key, dir } or null. */ sort?: SortState;
  /** Initial sort when uncontrolled. Default null. */ defaultSort?: SortState;
  /** Called with the next sort when a header is activated. */ onSortChange?: (s: SortState) => void;
  /** Applies to live rows too. */
  filter?: (r: R) => boolean;
  /** Adds a checkbox column (row + header select-all). Default false. */ selectable?: boolean;
  /** Controlled selected row keys. */ selected?: string[];
  /** Called with the selected row keys. */ onSelectionChange?: (keys: string[]) => void;
  /** Menu items per row (row actions button and right-click share them). */ rowActions?: (r: R) => MenuItem[];
  /** Called with (item id, row) when a row action is chosen. */ onRowAction?: (id: string, r: R) => void;
  /** Loading state: skeleton / spinner and aria-busy. Default false. */ loading?: boolean;
  /** Skeleton rows while loading. Default 6. */ loadingRows?: number;
  /** Content shown when there are no rows. */ empty?: React.ReactNode;
  /** Sticky header row inside the scroll area. Default true. */ stickyHeader?: boolean;
  /** Max height of the scroll area (px or CSS length). */ maxHeight?: number | string;
  /** Controlled 1-based page (with pageSize). */ page?: number;
  /** Rows per page; enables the pagination footer. */ pageSize?: number;
  /** Called with the new 1-based page. */ onPageChange?: (p: number) => void;
  /** Virtualise rows: { rowHeight, overscan? } (fixed row height). */ virtual?: { rowHeight: number; overscan?: number };
  /** Live behaviour (on automatically with `store`). */
  live?: TableLiveOptions | boolean;
  /** Extra class on the root element. */ className?: string;
  /** Row context menu (right-click, long-press, ContextMenu key / Shift+F10). Target: kind 'row', id = row key, data = row,
   *  selection = the selected keys when the row is selected, else [key]. */
  contextMenu?: ContextMenuSpec<R>;
  /** Header cells: kind 'header', column = column key. */
  contextMenuHeader?: ContextMenuSpec<R>;
  /** Single cells: kind 'cell', column = column key (falls back to the row menu). */
  contextMenuCell?: ContextMenuSpec<R>;
  /** ONE item list for the row-actions button AND the row context menu. */
  rowMenu?: (r: R) => MenuItem[];
  /** Called when a row / header context menu opens. */ onContextMenuOpen?: ContextMenuProps<R>['onContextMenuOpen'];
  /** Called when the context menu closes. */ onContextMenuClose?: ContextMenuProps<R>['onContextMenuClose'];
  /** Called with the chosen context-menu item. */ onContextMenuAction?: ContextMenuProps<R>['onContextMenuAction'];
  /** Let the browser menu show (no custom context menu). Default false. */ contextMenuNative?: ContextMenuProps<R>['contextMenuNative'];
  /** Bulk-action mode: while rows are selected, structural live changes queue (selected rows never move or vanish under the bulk bar). */
  pinSelection?: boolean;
}
const cmp = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }));
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const cellVal = <R,>(c: TableColumn<R>, r: R) => (c.value ? c.value(r) : (r as Record<string, unknown>)[c.key]);

interface RowCtx<R> {
  columns: TableColumn<R>[]; selectable: boolean; actions: boolean; flash: boolean; store?: LiveStore<R>;
  setFocus: (key: string | null, col: number) => void; toggle: (key: string) => void; openMenu: (key: string, el: HTMLElement) => void;
  inView: (tr: HTMLElement | null) => boolean; rowLabel: (i: number) => string; hasCtx?: boolean; pinStyle?: (i: number) => React.CSSProperties | undefined;
}
interface RowProps<R> { k: string; r: R; R: number; on: boolean; focusCol: number; menuOpen: boolean; ctxOn?: boolean; exiting?: boolean; height?: number; ctx: React.MutableRefObject<RowCtx<R>> }
function RowImpl<R>({ k, r: rProp, R, on, focusCol, menuOpen, ctxOn, exiting, height, ctx }: RowProps<R>) {
  const c = ctx.current;
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => (c.store && !exiting ? c.store.subscribeKey(k, force) : undefined), [c.store, k, exiting]);
  const r = (c.store && !exiting ? c.store.get(k) : undefined) ?? rProp;
  const tr = React.useRef<HTMLTableRowElement | null>(null);
  const prev = React.useRef<unknown[] | null>(null), flashAt = React.useRef<number[]>([]);
  const vals = c.columns.map((col) => cellVal(col, r));
  // value change → brief accent tint behind the changed cells (never per-cell glass); rate-limited per cell
  React.useLayoutEffect(() => {
    const p = prev.current; prev.current = vals;
    if (!p || !c.flash || exiting || !tr.current || !c.inView(tr.current)) return;
    const reduced = isMorphReduced(), now = performance.now(), gap = tokMs('--ul-data-flash-min-gap', 250), D = tokMs('--ul-data-flash-duration', 900);
    const tds = tr.current.querySelectorAll<HTMLElement>('td[data-col]'), bg = getComputedStyle(tr.current).getPropertyValue('--ul-data-flash-bg').trim() || 'rgb(143 184 255 / .26)';
    vals.forEach((v, i) => {
      if (Object.is(v, p[i]) || now - (flashAt.current[i] ?? -1e9) < gap) return;
      flashAt.current[i] = now;
      const td = [...tds].find((n) => n.dataset.col === String(i)); if (!td) return;
      td.animate(reduced ? [{ backgroundColor: bg }, { backgroundColor: bg, offset: 0.6 }, { backgroundColor: 'transparent' }] : [{ backgroundColor: bg }, { backgroundColor: 'transparent' }], { duration: D, easing: 'ease-out' });
    });
  });
  let ci = 0;
  const tab = (col: number) => (focusCol === col ? 0 : -1);
  return (
    <tr ref={tr} data-key={k} aria-rowindex={exiting ? undefined : R + 1} aria-selected={c.selectable && !exiting ? on : undefined} data-selected={on ? '' : undefined}
      data-exiting={exiting ? '' : undefined} data-ctx-active={ctxOn ? '' : undefined} aria-haspopup={c.hasCtx && !exiting ? 'menu' : undefined} aria-hidden={exiting || undefined} {...(exiting ? { inert: '' } as Record<string, string> : {})} style={height ? { height } : undefined}>
      {c.selectable ? (() => { const my = ci++; return <td className="ul-td-check" data-cell={exiting ? undefined : `${R}-${my}`} tabIndex={-1}><RowCheck label={c.rowLabel(R - 1)} checked={on} tabIndex={tab(my)} onToggle={() => c.toggle(k)} /></td>; })() : null}
      {c.columns.map((col, i) => { const my = ci++; return (
        <td key={col.key} data-col={i} data-pin={col.pin} style={c.pinStyle?.(i)} data-align={col.align ?? (col.numeric || col.roll ? 'end' : 'start')} data-numeric={col.numeric || col.roll ? '' : undefined} data-cell={exiting ? undefined : `${R}-${my}`} tabIndex={tab(my)} onFocus={() => c.setFocus(k, my)}>
          {col.roll && typeof vals[i] === 'number' ? <ULRollingNumber value={vals[i] as number} format={col.roll.format} locale={col.roll.locale} compact={col.roll.compact} reveal={false} animate={() => c.inView(tr.current)} /> : col.render ? col.render(r) : String(vals[i] ?? '')}
        </td>); })}
      {c.actions ? (() => { const my = ci++; return (
        <td className="ul-td-act" data-cell={exiting ? undefined : `${R}-${my}`}>
          <button type="button" className="ul-row-act" tabIndex={tab(my)} aria-label="Row actions" aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={(e) => { c.setFocus(k, my); c.openMenu(k, e.currentTarget); }}>
            <ULIcon filled size={18}><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></ULIcon>
          </button>
        </td>); })() : null}
    </tr>
  );
}
const Row = React.memo(RowImpl) as typeof RowImpl;

export function ULTable<R>({ columns, rows = [], store, rowKey, label, density = 'cozy', sort, defaultSort = null, onSortChange, filter, selectable, selected, onSelectionChange, rowActions, onRowAction, loading, loadingRows = 6, empty, stickyHeader = true, maxHeight, page, pageSize, onPageChange, virtual, live, className, contextMenu, contextMenuHeader, contextMenuCell, rowMenu, onContextMenuOpen, onContextMenuClose, onContextMenuAction, contextMenuNative, pinSelection }: ULTableProps<R>) {
  rowActions = rowActions ?? rowMenu;
  const lv: TableLiveOptions = live === false ? { queue: false, flash: false, announce: false } : live === true || live == null ? {} : live;
  const isLive = !!store || live === true || (typeof live === 'object');
  const queueOn = isLive && lv.queue !== false;
  const [ownSort, setOwnSort] = React.useState<SortState>(defaultSort);
  const [ownSel, setOwnSel] = React.useState<string[]>([]);
  const [menu, setMenu] = React.useState<{ key: string; el: HTMLElement } | null>(null);
  const [focus, setFocusS] = React.useState<{ key: string | null; col: number }>({ key: null, col: 0 });
  const [scrollTop, setScrollTop] = React.useState(0);
  const [inside, setInside] = React.useState({ pointer: false, focus: false });
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  const s = sort !== undefined ? sort : ownSort;
  const sel = selected ?? ownSel;
  const rowSpec: ContextMenuSpec<R> | undefined = contextMenu ?? (rowMenu ? (t: ContextTarget<R>) => (t.data ? rowMenu(t.data) : null) : undefined);
  const anyCtx = !!(rowSpec || contextMenuHeader || contextMenuCell);
  const getRowRef = React.useRef<(k: string) => R | undefined>(() => undefined);
  const ctxMenu = useContextMenuTarget<R>({
    component: 'table', contextMenuNative, onContextMenuOpen, onContextMenuClose, onContextMenuAction,
    contextMenu: anyCtx ? (t: ContextTarget<R>) => { const sp = t.kind === 'header' ? contextMenuHeader : t.kind === 'cell' ? contextMenuCell ?? rowSpec : rowSpec; return !sp ? null : typeof sp === 'function' ? sp(t) : sp; } : undefined,
    resolve: (hit) => {
      const th = hit.closest<HTMLElement>('thead th[data-colkey]');
      if (th) return contextMenuHeader ? { kind: 'header', column: th.dataset.colkey, el: th.querySelector<HTMLElement>('button') ?? th } : null;
      const tr = hit.closest<HTMLElement>('tbody tr[data-key]:not([data-exiting])'); if (!tr) return null;
      const k = tr.dataset.key!, r = getRowRef.current(k), td = hit.closest<HTMLElement>('td[data-col]');
      const selection = selRef.current.includes(k) ? [...selRef.current] : [k];
      const el = (td ?? tr.querySelector<HTMLElement>('td[data-col]') ?? tr) as HTMLElement;
      if (td && contextMenuCell) return { kind: 'cell', id: k, data: r, column: columns[+td.dataset.col!]?.key, selection, el };
      return { kind: 'row', id: k, data: r, selection, el };
    },
    keyPoint: (t) => { const tr = t.el.closest('tr'), b = tr?.querySelector('.ul-row-act')?.getBoundingClientRect(); return b ? { x: b.left + b.width / 2, y: b.bottom } : null; },
  });
  const box = React.useRef<HTMLDivElement | null>(null), tbody = React.useRef<HTMLTableSectionElement | null>(null), lens = React.useRef<HTMLElement | null>(null), wrap = React.useRef<HTMLElement | null>(null);
  const menuAnchor = React.useMemo(() => ({ current: null as HTMLElement | null }), []);
  menuAnchor.current = menu?.el ?? null;
  // desired order (sort + filter) from the store or the rows prop
  const desiredOf = React.useCallback((): { keys: string[]; map: Map<string, R> } => {
    let list = store ? store.values() : rows;
    if (filter) list = list.filter(filter);
    if (s) { const c = columns.find((x) => x.key === s.key); if (c) list = [...list].sort((a, b) => cmp(cellVal(c, a), cellVal(c, b)) * (s.dir === 'asc' ? 1 : -1)); }
    const map = new Map<string, R>(); const keys = list.map((r) => { const k = rowKey(r); map.set(k, r); return k; });
    return { keys, map };
  }, [store, rows, filter, s, columns, rowKey]);
  const desired = React.useMemo(desiredOf, [desiredOf, store?.version]);
  const desiredRef = React.useRef(desired); desiredRef.current = desired;
  // store: re-render the TABLE only when the order / membership changes (values re-render their rows)
  React.useEffect(() => store?.subscribe(() => { const d = desiredOf(); if (!same(d.keys, desiredRef.current.keys)) bump(); }), [store, desiredOf]);
  // structural queue while the user interacts
  // a row with an open context menu is pinned: structural changes queue exactly like the hover rule
  const holding = queueOn && (inside.pointer || inside.focus || !!menu || !!ctxMenu.active || (!!pinSelection && sel.length > 0));
  const shownRef = React.useRef<string[] | null>(null), applyNow = React.useRef(false);
  const lastRow = React.useRef(new Map<string, R>());
  let shown = desired.keys;
  if (holding && shownRef.current && !applyNow.current) shown = shownRef.current;
  applyNow.current = false;
  const getRow = (k: string) => desired.map.get(k) ?? (store ? store.get(k) : undefined) ?? lastRow.current.get(k);
  getRowRef.current = getRow;
  // the target row is gone anyway (non-live rows, explicit apply): close with the normal exit
  React.useEffect(() => { const a = ctxMenu.active; if (a?.kind !== 'header' && a?.id && !shown.includes(a.id)) ctxMenu.close(); });
  shown.forEach((k) => { const r = desired.map.get(k) ?? (store ? store.get(k) : undefined); if (r) lastRow.current.set(k, r); });
  let pending = 0;
  if (shown !== desired.keys) {
    const a = new Set(shown), b = new Set(desired.keys);
    pending = desired.keys.filter((k) => !a.has(k)).length + shown.filter((k) => !b.has(k)).length;
    const common = desired.keys.filter((k) => a.has(k)), commonShown = shown.filter((k) => b.has(k));
    pending += common.filter((k, i) => commonShown[i] !== k).length ? 1 : 0;
  }
  const applyQueued = () => { applyNow.current = true; shownRef.current = desired.keys; bump(); };
  // exiting rows (fade + collapse after their removal is applied)
  const exiting = React.useRef(new Map<string, { r: R; at: number }>());
  const prevShown = React.useRef<string[]>(shown);
  if (prevShown.current !== shown && !same(prevShown.current, shown) && isLive && !virtual) {
    const now = new Set(shown);
    prevShown.current.forEach((k, i) => { if (!now.has(k) && !exiting.current.has(k)) { const r = lastRow.current.get(k); if (r) exiting.current.set(k, { r, at: i }); } });
  }
  const paged = page && pageSize ? shown.slice((page - 1) * pageSize, page * pageSize) : shown;
  const pageCount = page && pageSize ? Math.max(1, Math.ceil(shown.length / pageSize)) : 1;
  const display: { k: string; ex: boolean }[] = paged.map((k) => ({ k, ex: false }));
  exiting.current.forEach((v, k) => { if (!paged.includes(k)) display.splice(Math.min(v.at, display.length), 0, { k, ex: true }); });
  const setSort = (key: string) => {
    const next: SortState = !s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null;
    applyNow.current = true; // an explicit sort applies at once
    if (sort === undefined) setOwnSort(next);
    onSortChange?.(next);
  };
  const setSel = (k: string[]) => { if (selected === undefined) setOwnSel(k); onSelectionChange?.(k); };
  const keys = paged;
  const allOn = keys.length > 0 && keys.every((k) => sel.includes(k)), someOn = keys.some((k) => sel.includes(k));
  const cols = (selectable ? 1 : 0) + columns.length + (rowActions ? 1 : 0);
  const rh = virtual?.rowHeight ?? 0, over = virtual?.overscan ?? 6;
  const vh = typeof maxHeight === 'number' ? maxHeight : 480;
  const v0 = virtual ? Math.max(0, Math.floor(scrollTop / rh) - over) : 0;
  const v1 = virtual ? Math.min(display.length, Math.ceil((scrollTop + vh) / rh) + over) : display.length;
  const view = display.slice(v0, v1);
  const focusR = focus.key == null ? 0 : keys.indexOf(focus.key) + 1;
  const moveTo = (r: number, c: number) => {
    const R = Math.max(0, Math.min(keys.length, r)), C = Math.max(0, Math.min(cols - 1, c));
    setFocusS({ key: R === 0 ? null : keys[R - 1], col: C });
    requestAnimationFrame(() => {
      const cell = box.current?.querySelector<HTMLElement>(`[data-cell="${R}-${C}"]`);
      if (!cell) {
        if (virtual && box.current) box.current.scrollTop = Math.max(0, (R - 1) * rh - vh / 2);
        requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-cell="${R}-${C}"]`)?.focus({ preventScroll: false }));
        return;
      }
      const target = cell.querySelector<HTMLElement>('button, a, input') ?? cell;
      target.focus({ preventScroll: true });
      const b = box.current; if (!b) return;
      const cb = cell.getBoundingClientRect(), bb = b.getBoundingClientRect(), head = stickyHeader ? (b.querySelector('thead')?.getBoundingClientRect().height ?? 0) : 0;
      if (cb.top < bb.top + head) b.scrollTop -= bb.top + head - cb.top; else if (cb.bottom > bb.bottom) b.scrollTop += cb.bottom - bb.bottom;
    });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input[type="text"], textarea')) return;
    const r = focusR, c = focus.col, page10 = Math.max(1, Math.floor(vh / (rh || 48)) - 1);
    const k = e.key;
    if (k === 'ArrowDown') moveTo(r + 1, c); else if (k === 'ArrowUp') moveTo(r - 1, c);
    else if (k === 'ArrowRight') moveTo(r, c + 1); else if (k === 'ArrowLeft') moveTo(r, c - 1);
    else if (k === 'Home') moveTo(e.ctrlKey ? 0 : r, 0); else if (k === 'End') moveTo(e.ctrlKey ? keys.length : r, cols - 1);
    else if (k === 'PageDown') moveTo(r + page10, c); else if (k === 'PageUp') moveTo(r - page10, c);
    else if (k === ' ' && selectable && r > 0 && !(e.target as HTMLElement).closest('button')) { const key = keys[r - 1]; setSel(sel.includes(key) ? sel.filter((x) => x !== key) : [...sel, key]); }
    else return;
    e.preventDefault();
  };
  const pinW = (c: TableColumn<R>) => (typeof c.width === 'number' ? c.width : 160), selW = selectable ? 52 : 0;
  const pinStyle = (i: number): React.CSSProperties | undefined => { const c = columns[i]; if (!c?.pin) return undefined; if (c.pin === 'left') return { left: selW + columns.slice(0, i).filter((x) => x.pin === 'left').reduce((a, x) => a + pinW(x), 0) }; return { right: (rowActions ? 52 : 0) + columns.slice(i + 1).filter((x) => x.pin === 'right').reduce((a, x) => a + pinW(x), 0) }; };
  const headTab = (col: number) => (focus.key == null && focus.col === col ? 0 : -1);
  // stable context for memoized rows
  const selRef = React.useRef(sel); selRef.current = sel;
  const ctx = React.useRef<RowCtx<R>>(null as unknown as RowCtx<R>);
  ctx.current = {
    columns, selectable: !!selectable, actions: !!rowActions, flash: isLive && lv.flash !== false, store,
    setFocus: (key, col) => setFocusS((f) => (f.key === key && f.col === col ? f : { key, col })),
    toggle: (key) => { const cur = selRef.current; setSel(cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]); },
    openMenu: (key, el) => setMenu((m) => (m?.key === key ? null : { key, el })),
    inView: (tr) => { const b = box.current; if (!tr || !b) return false; const t = tr.offsetTop - b.scrollTop; return t > -tr.offsetHeight && t < b.clientHeight; },
    pinStyle, rowLabel: (i) => `Select row ${i + 1}`, hasCtx: !!(rowSpec || contextMenuCell),
  };
  // overlay scrollbars (no layout space) sit over the last row's bottom edge and win the hit test there: when the table
  // scrolls horizontally with an overlay scrollbar, reserve --ul-table-hscroll-room below the table (attribute write only on change)
  React.useEffect(() => {
    const sc = box.current; if (!sc || typeof ResizeObserver === 'undefined') return;
    const check = () => { const cs = getComputedStyle(sc), bw = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth); const overlay = sc.scrollWidth > sc.clientWidth + 1 && sc.offsetHeight - bw - sc.clientHeight < 1; if (overlay !== sc.hasAttribute('data-hscroll-overlay')) sc.toggleAttribute('data-hscroll-overlay', overlay); };
    const ro = new ResizeObserver(check); ro.observe(sc); if (sc.firstElementChild) ro.observe(sc.firstElementChild); check();
    return () => ro.disconnect();
  }, []);
  // shared hover / focus lens (ONE flattened indicator, the same as menus): glides between rows
  React.useEffect(() => {
    if (!box.current || !lens.current || !tbody.current) return;
    const ind: NavIndicator = createNavIndicator({ container: box.current, lens: lens.current, items: 'tbody > tr[data-key]:not([data-exiting])', shallow: tbody.current });
    return () => ind.destroy();
  }, [!!tbody.current, loading, display.length === 0]);
  // structure animations: FLIP (moves, inserts) capped to rows in view; scroll position preserved; exit fade
  const pos = React.useRef(new Map<string, number>()), lastKeys = React.useRef<string[] | null>(null), lastScroll = React.useRef(0);
  React.useLayoutEffect(() => {
    const tb = tbody.current, sc = box.current; if (!tb || !sc) { lastKeys.current = shown; return; }
    const els = [...tb.querySelectorAll<HTMLElement>(':scope > tr[data-key]')];
    const next = new Map<string, number>(); els.forEach((n) => next.set(n.dataset.key!, n.offsetTop));
    const prevK = lastKeys.current, changed = prevK && !same(prevK, display.map((d) => d.k));
    if (changed && isLive) {
      const st = lastScroll.current, reduced = isMorphReduced();
      // keep the first visible row where it was (no jump when rows are inserted / removed above)
      if (st > 0) { const anchor = prevK!.find((k) => (pos.current.get(k) ?? -1) >= st - 1 && next.has(k)); if (anchor) { const d = next.get(anchor)! - pos.current.get(anchor)!; if (d) sc.scrollTop = st + d; } }
      const st2 = sc.scrollTop, H = sc.clientHeight, cap = parseInt(rootCS().getPropertyValue('--ul-data-reorder-max-rows'), 10) || 40;
      let n = 0;
      const ibg = getComputedStyle(sc).getPropertyValue('--ul-data-insert-bg').trim() || 'rgb(143 184 255 / .3)';
      const Dm = tokMs('--ul-data-reorder-duration', 420), Di = tokMs('--ul-data-insert-duration', 360), Dg = tokMs('--ul-data-insert-glow-duration', 1600);
      for (const el of els) {
        const k = el.dataset.key!, y = next.get(k)!, top = y - st2;
        if (top < -el.offsetHeight || top > H || n >= cap) continue;
        const old = pos.current.get(k);
        if (old != null) {
          const dy = (old - st) - (y - st2);
          if (Math.abs(dy) > 0.5 && !reduced) { el.animate([{ transform: `translateY(${dy.toFixed(1)}px)` }, { transform: 'translateY(0)' }], { duration: Dm, easing: springs.smooth.toCSS() }); n++; }
        } else if (el.dataset.exiting == null) {
          n++;
          if (!reduced) el.animate([{ opacity: 0, transform: 'scaleY(.4)', transformOrigin: '50% 0' }, { opacity: 1, transform: 'scaleY(1)', transformOrigin: '50% 0' }], { duration: Di, easing: springs.smooth.toCSS() });
          if (lv.flash !== false) el.querySelectorAll<HTMLElement>('td').forEach((td) => td.animate([{ backgroundColor: ibg }, { backgroundColor: 'transparent' }], { duration: Dg, easing: 'ease-out' }));
        }
      }
      // exits: fade + collapse in place, then drop (the rows below FLIP up on the next layout)
      exiting.current.forEach((v, k) => {
        const el = els.find((x) => x.dataset.key === k); if (!el || el.dataset.exitAnim) return;
        el.dataset.exitAnim = '1';
        const D = tokMs('--ul-data-remove-duration', 280);
        const a = reduced ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }) : el.animate([{ opacity: 1, transform: 'scaleY(1)' }, { opacity: 0, transform: 'scaleY(.5)' }], { duration: D, easing: 'ease-in', fill: 'forwards' });
        a.finished.then(() => { exiting.current.delete(k); bump(); }, () => {});
      });
    }
    pos.current = next; lastKeys.current = display.map((d) => d.k); prevShown.current = shown; if (!holding) shownRef.current = shown; else shownRef.current ??= shown;
    lastScroll.current = sc.scrollTop;
  });
  // throttled, summarized announcements
  const [said, setSaid] = React.useState('');
  const acc = React.useRef({ inserted: 0, removed: 0 }), sayT = React.useRef(0), lastDesired = React.useRef<string[]>(desired.keys);
  React.useEffect(() => {
    if (!isLive || lv.announce === false) { lastDesired.current = desired.keys; return; }
    const a = new Set(lastDesired.current), b = new Set(desired.keys);
    acc.current.inserted += desired.keys.filter((k) => !a.has(k)).length; acc.current.removed += lastDesired.current.filter((k) => !b.has(k)).length;
    lastDesired.current = desired.keys;
    if (!acc.current.inserted && !acc.current.removed) return;
    if (sayT.current) return;
    sayT.current = window.setTimeout(() => {
      sayT.current = 0; const c = acc.current; acc.current = { inserted: 0, removed: 0 };
      setSaid(lv.summary ? lv.summary(c) : [c.inserted ? `${c.inserted} new row${c.inserted > 1 ? 's' : ''}` : '', c.removed ? `${c.removed} removed` : ''].filter(Boolean).join(', '));
    }, tokMs('--ul-live-announce-gap', 4000) / getMorphTimeScale());
  }, [desired.keys]);
  React.useEffect(() => () => clearTimeout(sayT.current), []);

  const sortIcon = (key: string) => <svg className="ul-th-icon" data-dir={s?.key === key ? s.dir : 'none'} viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M6 2.5 9.5 7h-7z" fill="currentColor" /></svg>;
  let ci = 0;
  const onFocusIn = () => setInside((x) => (x.focus ? x : { ...x, focus: true }));
  const onFocusOut = (e: React.FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setInside((x) => (x.focus ? { ...x, focus: false } : x)); };
  return (
    <ULGlass ref={wrap} tier="lg" quality="lite" padding="0" radius="var(--ul-radius-lg)" className={cx('ul-table-wrap', 'ul-data-panel', className)} data-density={density} onFocus={onFocusIn} onBlur={onFocusOut} {...mergeCtx({}, { ...ctxMenu.bind, 'aria-haspopup': undefined } as never)}>
      <div ref={box} className="ul-table-scroll" style={{ maxHeight }} onScroll={virtual ? (e) => setScrollTop((e.target as HTMLElement).scrollTop) : undefined}
        onPointerEnter={(e) => { if (e.pointerType !== 'touch') setInside((x) => ({ ...x, pointer: true })); }} onPointerLeave={() => setInside((x) => ({ ...x, pointer: false }))}>
        <ULGlass as="span" ref={lens} aria-hidden="true" tier="sm" radius="var(--ul-radius-md)" className="ul-table-lens" />
        <table role="grid" aria-label={label} aria-rowcount={shown.length + 1} aria-busy={loading || undefined} className="ul-table" data-sticky={stickyHeader ? '' : undefined} onKeyDown={onKey}>
          <thead>
            <tr aria-rowindex={1}>
              {selectable ? <th className="ul-td-check" data-cell={`0-${ci}`} tabIndex={-1} scope="col">
                <ULCheckbox aria-label="Select all rows" checked={allOn} indeterminate={!allOn && someOn} tabIndex={headTab(ci++)} onCheckedChange={() => setSel(allOn ? sel.filter((k) => !keys.includes(k)) : [...new Set([...sel, ...keys])])} />
              </th> : null}
              {columns.map((c) => {
                const my = ci++, on = s?.key === c.key;
                return (
                  <th key={c.key} scope="col" data-colkey={c.key} data-pin={c.pin} data-align={c.align ?? (c.numeric || c.roll ? 'end' : 'start')} data-cell={`0-${my}`} style={{ width: c.width, ...pinStyle(columns.indexOf(c)) }} aria-sort={on ? (s!.dir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined} tabIndex={c.sortable ? undefined : headTab(my)}>
                    {c.sortable ? <button type="button" className="ul-th-sort" tabIndex={headTab(my)} data-on={on ? '' : undefined} onClick={() => { setFocusS({ key: null, col: my }); setSort(c.key); }}>{c.header}{sortIcon(c.key)}</button> : c.header}
                  </th>
                );
              })}
              {rowActions ? <th className="ul-td-act" scope="col" data-cell={`0-${ci}`} tabIndex={headTab(ci++)}><span className="ul-sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody ref={tbody}>
            {loading ? Array.from({ length: loadingRows }, (_, i) => (
              <tr key={'sk' + i} className="ul-tr-skel">{Array.from({ length: cols }, (_, j) => <td key={j}><ULSkeleton width={j === 0 && selectable ? '18px' : `${50 + ((i * 7 + j * 13) % 40)}%`} /></td>)}</tr>
            )) : display.length === 0 ? (
              <tr><td colSpan={cols} className="ul-td-empty">{empty ?? <ULEmptyState size="sm" title="Nothing here yet" description="Rows appear here as soon as there is data." />}</td></tr>
            ) : (
              <>
                {virtual && v0 > 0 ? <tr aria-hidden="true" style={{ height: v0 * rh }}><td colSpan={cols}></td></tr> : null}
                {view.map(({ k, ex }) => {
                  const i = keys.indexOf(k), r = ex ? exiting.current.get(k)!.r : getRow(k)!;
                  if (!r) return null;
                  return <Row key={k} k={k} r={r} R={i + 1} on={sel.includes(k)} focusCol={!ex && focus.key === k ? focus.col : -1} menuOpen={menu?.key === k} ctxOn={!ex && ctxMenu.active?.kind !== 'header' && ctxMenu.active?.id === k} exiting={ex} height={virtual ? rh : undefined} ctx={ctx} />;
                })}
                {virtual && v1 < display.length ? <tr aria-hidden="true" style={{ height: (display.length - v1) * rh }}><td colSpan={cols}></td></tr> : null}
              </>
            )}
          </tbody>
        </table>
      </div>
      {pending > 0 ? <div className="ul-live-pill"><ULButton size="sm" variant="tinted" onClick={applyQueued}>{lv.pendingLabel ? lv.pendingLabel(pending) : `${pending} new update${pending > 1 ? 's' : ''}`}</ULButton></div> : null}
      {isLive ? <div className="ul-sr-only" aria-live="polite">{said}</div> : null}
      {page && pageSize && onPageChange && pageCount > 1 ? <div className="ul-table-foot"><span className="ul-table-count">{(page - 1) * pageSize + 1}–{Math.min(shown.length, page * pageSize)} of {shown.length}</span><ULPagination page={page} pageCount={pageCount} onPageChange={onPageChange} /></div> : null}
      {rowActions ? (() => { const r = menu ? getRow(menu.key) : null; return (
        <ULMenu open={!!menu} onOpenChange={(o) => { if (!o) setMenu(null); }} anchorRef={menuAnchor} align="end" label="Row actions"
          items={r ? rowActions(r) : []} onAction={(id) => { if (r) onRowAction?.(id, r); }} />); })() : null}
      {ctxMenu.menu}
    </ULGlass>
  );
}

/* ---------- Chart (lite glass panel; no refraction on the plot) ---------- */
export interface ChartSeries { name: string; data: number[] }
export interface ULChartProps {
  /** "line" | "area" | "bar". */ kind?: 'line' | 'area' | 'bar';
  /** Series ({ name, values }). */ series: ChartSeries[];
  /** Category labels (x axis). */ labels: string[];
  /** Heading. */ title: string;
  /** Text summary for screen readers. */ summary?: string;
  /** Plot height in px. */ height?: number;
  /** Formats the number for display (Intl options or a function, per prop type). */ format?: (v: number) => string;
  /** Show the data table toggle. Default true. */ showTable?: boolean;
  /** Accent colour name or CSS colour (checked by guardAccent). */ accent?: Accent;
  /** Render inside its own lite glass panel. Default true (pass false when the chart already sits in a panel). */
  panel?: boolean;
  /** Extra class on the root element. */ className?: string;
}
/** Chart context-menu payload: the data point under the pointer, a legend series, or the plot background. */
export interface ChartTargetData { index?: number; label?: string; values?: { series: string; value: number }[]; series?: string }
