/**
 * Dashboard building blocks (Part 2). Composition only: ULAnchoredSurface (bulk bar), ULMenu / ULMenuButton, ULPopover,
 * ULSelect / fields / pickers, ULCheckMark (via ULMenu), ULRollingNumber, the async action core (ULCopyButton,
 * ULRefreshButton), the shared anchored tooltip (useActionTooltip). No new overlay or animation code, no backend, no URLs.
 */
import * as React from 'react';
import { ULAnchoredSurface } from '../ULAnchoredSurface/ULAnchoredSurface.tsx';
import { ULButton } from '../ULButton/ULButton.tsx';
import { ULMenu, ULMenuButton, type MenuItem } from '../ULContainers/ULMenu.tsx';
import { ULPopover } from '../ULContainers/ULOverlays.tsx';
import { ULSelect } from '../ULListbox/ULListbox.tsx';
import { ULTextField, ULNumberField } from '../ULField/ULField.tsx';
import { ULDateRangePicker } from '../ULPickers/ULPickers.tsx';
import { ULAvatar, ULBadge, ULSkeleton, ULProgress, type TableColumn } from '../ULData/ULData.tsx';
import { ULRollingNumber, ULSparkline } from '../ULData/ULKpi.tsx';
import { ULCopyButton, ULRefreshButton } from '../actions/actions.tsx';
import { useActionTooltip, useAsyncAction, announce, ULActionButton } from '../actions/core.tsx';
import { createVirtualAnchor, edgeRect } from '../../motion/virtualAnchor.ts';
import { isMorphReduced } from '../../motion/anchoredMorph.ts';
import { Icon, ULIcon, cx, useDomId } from '../shared/icons.tsx';
import { startColumnsDrag } from './columnsDrag.ts';
import { useMaterial, type Material } from '../../glass/material.tsx';
import './blocks.css';

/* ---------------- i18n (EN / SK / DE / CS) ---------------- */
const T = {
  en: { selected: '{n} selected', clear: 'Clear selection', selectAll: 'Select all {n}', columns: 'Columns', show: 'Show', pin: 'Pin', pinLeft: 'Pin left', pinRight: 'Pin right', unpin: 'Unpin', moveLeft: 'Move left', moveRight: 'Move right', density: 'Density', compact: 'Compact', cozy: 'Cozy', comfortable: 'Comfortable', reset: 'Reset', addFilter: 'Add filter', field: 'Field', operator: 'Operator', value: 'Value', apply: 'Apply', clearAll: 'Clear all', views: 'Saved views', saveView: 'Save current view…', results: '{n} results', is: 'is', isNot: 'is not', contains: 'contains', gt: 'greater than', lt: 'less than', between: 'between', in: 'is any of', empty: 'is empty', remove: 'Remove filter', edit: 'Edit filter', range: 'Time range', last15m: 'Last 15 minutes', last1h: 'Last hour', last24h: 'Last 24 hours', last7d: 'Last 7 days', last30d: 'Last 30 days', custom: 'Custom…', auto: 'Auto refresh', off: 'Off', pause: 'Pause', resume: 'Resume', reveal: 'Show value', hide: 'Hide value', copy: 'Copy', dismiss: 'Dismiss', of: '{i} of {n}', next: 'Next', operational: 'Operational', degraded: 'Degraded', outage: 'Outage', maintenance: 'Maintenance', unknown: 'Unknown', retry: 'Retry', details: 'Technical details', copyDiag: 'Copy diagnostics', loadFailed: 'Could not load data', used: '{a} of {b} used', depletes: 'Runs out {d}', perDay: '{n} / day', none: '—', moved: '{name}: position {i} of {n}', dragCancel: 'Reorder cancelled' },
  sk: { selected: 'Vybraté: {n}', clear: 'Zrušiť výber', selectAll: 'Vybrať všetkých {n}', columns: 'Stĺpce', show: 'Zobraziť', pin: 'Pripnúť', pinLeft: 'Pripnúť vľavo', pinRight: 'Pripnúť vpravo', unpin: 'Odopnúť', moveLeft: 'Posunúť doľava', moveRight: 'Posunúť doprava', density: 'Hustota', compact: 'Kompaktná', cozy: 'Pohodlná', comfortable: 'Voľná', reset: 'Obnoviť', addFilter: 'Pridať filter', field: 'Pole', operator: 'Operátor', value: 'Hodnota', apply: 'Použiť', clearAll: 'Vymazať všetko', views: 'Uložené pohľady', saveView: 'Uložiť pohľad…', results: 'Výsledky: {n}', is: 'je', isNot: 'nie je', contains: 'obsahuje', gt: 'väčšie ako', lt: 'menšie ako', between: 'medzi', in: 'je niektoré z', empty: 'je prázdne', remove: 'Odstrániť filter', edit: 'Upraviť filter', range: 'Časový rozsah', last15m: 'Posledných 15 minút', last1h: 'Posledná hodina', last24h: 'Posledných 24 hodín', last7d: 'Posledných 7 dní', last30d: 'Posledných 30 dní', custom: 'Vlastný…', auto: 'Automatické obnovenie', off: 'Vypnuté', pause: 'Pozastaviť', resume: 'Pokračovať', reveal: 'Zobraziť hodnotu', hide: 'Skryť hodnotu', copy: 'Kopírovať', dismiss: 'Zavrieť', of: '{i} z {n}', next: 'Ďalej', operational: 'V prevádzke', degraded: 'Obmedzené', outage: 'Výpadok', maintenance: 'Údržba', unknown: 'Neznáme', retry: 'Skúsiť znova', details: 'Technické podrobnosti', copyDiag: 'Kopírovať diagnostiku', loadFailed: 'Údaje sa nepodarilo načítať', used: 'Využité {a} z {b}', depletes: 'Minie sa {d}', perDay: '{n} / deň', none: '—', moved: '{name}: pozícia {i} z {n}', dragCancel: 'Presun zrušený' },
  de: { selected: '{n} ausgewählt', clear: 'Auswahl aufheben', selectAll: 'Alle {n} auswählen', columns: 'Spalten', show: 'Anzeigen', pin: 'Fixieren', pinLeft: 'Links fixieren', pinRight: 'Rechts fixieren', unpin: 'Lösen', moveLeft: 'Nach links', moveRight: 'Nach rechts', density: 'Dichte', compact: 'Kompakt', cozy: 'Normal', comfortable: 'Großzügig', reset: 'Zurücksetzen', addFilter: 'Filter hinzufügen', field: 'Feld', operator: 'Operator', value: 'Wert', apply: 'Anwenden', clearAll: 'Alle löschen', views: 'Gespeicherte Ansichten', saveView: 'Ansicht speichern…', results: '{n} Ergebnisse', is: 'ist', isNot: 'ist nicht', contains: 'enthält', gt: 'größer als', lt: 'kleiner als', between: 'zwischen', in: 'ist eines von', empty: 'ist leer', remove: 'Filter entfernen', edit: 'Filter bearbeiten', range: 'Zeitraum', last15m: 'Letzte 15 Minuten', last1h: 'Letzte Stunde', last24h: 'Letzte 24 Stunden', last7d: 'Letzte 7 Tage', last30d: 'Letzte 30 Tage', custom: 'Benutzerdefiniert…', auto: 'Automatisch aktualisieren', off: 'Aus', pause: 'Pausieren', resume: 'Fortsetzen', reveal: 'Wert anzeigen', hide: 'Wert verbergen', copy: 'Kopieren', dismiss: 'Schließen', of: '{i} von {n}', next: 'Weiter', operational: 'In Betrieb', degraded: 'Eingeschränkt', outage: 'Ausfall', maintenance: 'Wartung', unknown: 'Unbekannt', retry: 'Erneut versuchen', details: 'Technische Details', copyDiag: 'Diagnose kopieren', loadFailed: 'Daten konnten nicht geladen werden', used: '{a} von {b} genutzt', depletes: 'Aufgebraucht {d}', perDay: '{n} / Tag', none: '—', moved: '{name}: Position {i} von {n}', dragCancel: 'Verschieben abgebrochen' },
  cs: { selected: 'Vybráno: {n}', clear: 'Zrušit výběr', selectAll: 'Vybrat všech {n}', columns: 'Sloupce', show: 'Zobrazit', pin: 'Připnout', pinLeft: 'Připnout vlevo', pinRight: 'Připnout vpravo', unpin: 'Odepnout', moveLeft: 'Posunout doleva', moveRight: 'Posunout doprava', density: 'Hustota', compact: 'Kompaktní', cozy: 'Pohodlná', comfortable: 'Volná', reset: 'Obnovit', addFilter: 'Přidat filtr', field: 'Pole', operator: 'Operátor', value: 'Hodnota', apply: 'Použít', clearAll: 'Vymazat vše', views: 'Uložená zobrazení', saveView: 'Uložit zobrazení…', results: 'Výsledky: {n}', is: 'je', isNot: 'není', contains: 'obsahuje', gt: 'větší než', lt: 'menší než', between: 'mezi', in: 'je některé z', empty: 'je prázdné', remove: 'Odebrat filtr', edit: 'Upravit filtr', range: 'Časový rozsah', last15m: 'Posledních 15 minut', last1h: 'Poslední hodina', last24h: 'Posledních 24 hodin', last7d: 'Posledních 7 dní', last30d: 'Posledních 30 dní', custom: 'Vlastní…', auto: 'Automatické obnovení', off: 'Vypnuto', pause: 'Pozastavit', resume: 'Pokračovat', reveal: 'Zobrazit hodnotu', hide: 'Skrýt hodnotu', copy: 'Kopírovat', dismiss: 'Zavřít', of: '{i} z {n}', next: 'Další', operational: 'V provozu', degraded: 'Omezeno', outage: 'Výpadek', maintenance: 'Údržba', unknown: 'Neznámé', retry: 'Zkusit znovu', details: 'Technické podrobnosti', copyDiag: 'Kopírovat diagnostiku', loadFailed: 'Data se nepodařilo načíst', used: 'Využito {a} z {b}', depletes: 'Dojde {d}', perDay: '{n} / den', none: '—', moved: '{name}: pozice {i} z {n}', dragCancel: 'Přesun zrušen' },
};
type Key = keyof typeof T.en;
const LOC: Record<string, string> = { en: 'en-GB', sk: 'sk-SK', de: 'de-DE', cs: 'cs-CZ' };
const lang = (l?: string) => { const v = (l ?? (typeof document !== 'undefined' ? document.documentElement.lang : '') ?? 'en').slice(0, 2).toLowerCase(); return (v in T ? v : 'en') as keyof typeof T; };
export const blockText = (k: Key, locale?: string, vars: Record<string, string | number> = {}) => { let s: string = T[lang(locale)][k] ?? T.en[k]; for (const x in vars) s = s.replace(`{${x}}`, String(vars[x])); return s; };
const intl = (l?: string) => LOC[lang(l)];
const tokN = (k: string, f: number) => { if (typeof document === 'undefined') return f; const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
/** Tooltip only when the element is actually truncated (shared anchored tooltip, lazy). */
function useTruncTip(ref: React.RefObject<HTMLElement | null>, text: string | undefined) {
  const [trunc, setTrunc] = React.useState(false);
  React.useLayoutEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setTrunc(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)); ro.observe(el); return () => ro.disconnect(); }, [text]);
  useActionTooltip(ref, trunc ? text : undefined);
  React.useEffect(() => { if (!trunc) ref.current?.removeAttribute('data-ul-tip'); }, [trunc]);
}

/* ================= 1. Bulk action bar ================= */
export interface BulkAction { id: string; label: string; icon?: React.ReactNode; destructive?: boolean; onAction: (selected: string[]) => unknown; disabled?: boolean }
export interface ULBulkActionBarProps { /** Selected row keys (the bar shows while not empty). */ selected: string[]; /** Total rows (enables "Select all n"). */ total?: number; /** Clears the selection. */ onClear: () => void; /** Selects all rows. */ onSelectAll?: () => void; /** Primary actions ({ id, label, icon?, tone?, onAction }). */ actions: BulkAction[]; /** Extra actions in a menu. */ more?: MenuItem[]; /** Called with (item id, selected keys) from the overflow menu. */ onMore?: (id: string, selected: string[]) => void; /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default "en". */ locale?: string; /** Visible label / accessible name. */ label?: string }
/** Floating glass bar that pours in from the bottom edge (anchored morph on a viewport-edge anchor) while rows are selected. */
export function ULBulkActionBar({ selected, total, onClear, onSelectAll, actions, more, onMore, locale, label }: ULBulkActionBarProps) {
  const n = selected.length, open = n > 0;
  const va = React.useRef<ReturnType<typeof createVirtualAnchor> | null>(null), aRef = React.useRef<HTMLElement | null>(null);
  if (typeof document !== 'undefined' && !va.current) { va.current = createVirtualAnchor(edgeRect('bottom')); aRef.current = va.current.el; }
  React.useEffect(() => () => va.current?.destroy(), []);
  const last = React.useRef(0);
  React.useEffect(() => { if (n !== last.current) { if (n) announce(blockText('selected', locale, { n })); last.current = n; } }, [n]);
  const count = (
    <span className="ul-bulk-count" aria-hidden="true"><ULRollingNumber value={n} reveal={false} locale={locale} /> <span>{blockText('selected', locale, { n: '' }).replace(/[:\s]+$/, '').replace(/^\s*/, '')}</span></span>
  );
  return (
    <ULAnchoredSurface open={open} anchorRef={aRef} side="top" offset={-12} tier="lg" padding="var(--ul-space-2)" radius="var(--ul-radius-capsule)" closeOnOutside={false} closeOnEscape={false}
      scrollBehavior="fixed" role="toolbar" aria-label={label ?? blockText('selected', locale, { n })} className="ul-bulk" onClose={onClear}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClear(); } }}>
      <div className="ul-bulk-row">
        {count}
        {onSelectAll && total != null && total > n ? <ULButton size="sm" variant="plain" onClick={onSelectAll}>{blockText('selectAll', locale, { n: total })}</ULButton> : null}
        <span className="ul-bulk-sep" aria-hidden="true"></span>
        {actions.map((a) => <ULActionButton key={a.id} size="sm" variant={a.destructive ? 'destructive' : 'secondary'} icons={a.icon ? { idle: a.icon } : undefined} disabled={a.disabled} labels={{ idle: a.label }} successEffect="ring" onAction={() => a.onAction(selected)} />)}
        {more?.length ? <ULMenuButton items={more} label={a11yMore(locale)} onAction={(id) => onMore?.(id, selected)} buttonProps={{ className: 'ul-btn ul-bulk-more', 'aria-label': a11yMore(locale) }}><Icon name="menu" /></ULMenuButton> : null}
        <ULButton size="sm" variant="plain" icon={<Icon name="x" />} aria-label={blockText('clear', locale)} onClick={onClear} />
      </div>
    </ULAnchoredSurface>
  );
}
const a11yMore = (l?: string) => ({ en: 'More actions', sk: 'Ďalšie akcie', de: 'Weitere Aktionen', cs: 'Další akce' } as Record<string, string>)[lang(l)];

/* ================= 2. Columns menu ================= */
export interface ColumnsState { order: string[]; hidden: string[]; pinned: Record<string, 'left' | 'right'>; density?: 'compact' | 'cozy' | 'comfortable' }
export const defaultColumnsState = (cols: { key: string }[]): ColumnsState => ({ order: cols.map((c) => c.key), hidden: [], pinned: {}, density: 'cozy' });
/** Columns for ULTable from a state (visibility, order, pin; pinned-left first, pinned-right last). */
export function applyColumns<R>(cols: TableColumn<R>[], s: ColumnsState): TableColumn<R>[] {
  const by = new Map(cols.map((c) => [c.key, c])), order = [...s.order.filter((k) => by.has(k)), ...cols.map((c) => c.key).filter((k) => !s.order.includes(k))];
  const vis = order.filter((k) => !s.hidden.includes(k)).map((k) => ({ ...by.get(k)!, pin: s.pinned[k] }));
  return [...vis.filter((c) => c.pin === 'left'), ...vis.filter((c) => !c.pin), ...vis.filter((c) => c.pin === 'right')];
}
/** Per-viewer persistence (localStorage, try / catch; never shared). */
export function useColumnsState(cols: { key: string }[], o: { storageKey?: string; /** Called with every committed state. */ onValueChange?: (s: ColumnsState) => void } = {}): [ColumnsState, (s: ColumnsState) => void] {
  const [s, setS] = React.useState<ColumnsState>(() => {
    if (o.storageKey) { try { const v = JSON.parse(localStorage.getItem(o.storageKey) || 'null'); if (v && Array.isArray(v.order)) return { ...defaultColumnsState(cols), ...v }; } catch { /* private mode */ } }
    return defaultColumnsState(cols);
  });
  const set = React.useCallback((n: ColumnsState) => { setS(n); o.onValueChange?.(n); if (o.storageKey) { try { localStorage.setItem(o.storageKey, JSON.stringify(n)); } catch { /* quota / private */ } } }, [o.storageKey]);
  return [s, set];
}
/** One item definition for the toolbar button AND the table's header context menu (contextMenuHeader). */
export function columnsMenuItems(cols: { key: string; header: React.ReactNode }[], s: ColumnsState, set: (s: ColumnsState) => void, o: { locale?: string; column?: string; defaults?: ColumnsState } = {}): MenuItem[] {
  const L = (k: Key) => blockText(k, o.locale), name = (k: string) => { const h = cols.find((c) => c.key === k)?.header; return typeof h === 'string' ? h : k; };
  const order = [...s.order.filter((k) => cols.some((c) => c.key === k)), ...cols.map((c) => c.key).filter((k) => !s.order.includes(k))];
  const move = (k: string, d: number) => { const i = order.indexOf(k), j = i + d; if (j < 0 || j >= order.length) return; const n = [...order]; [n[i], n[j]] = [n[j], n[i]]; set({ ...s, order: n }); };
  const drag = { keys: order, onCommit: (n: string[]) => set({ ...s, order: n }), moved: (k: string, i: number, n: number) => L('moved').replace('{name}', name(k)).replace('{i}', String(i)).replace('{n}', String(n)), cancelled: L('dragCancel') };
  const grip = (k: string) => <span className="ul-cols-grip" data-cols-key={k} onPointerDown={(e) => startColumnsDrag(e, drag)} onClick={(e) => e.stopPropagation()}><ULIcon name="grip-vertical" size="sm" /></span>;
  const pin = (k: string, v?: 'left' | 'right') => { const p = { ...s.pinned }; if (v) p[k] = v; else delete p[k]; set({ ...s, pinned: p }); };
  const colItems = (k: string): MenuItem[] => [
    { id: `move-l:${k}`, label: L('moveLeft'), disabled: order.indexOf(k) === 0, onSelect: () => move(k, -1) },
    { id: `move-r:${k}`, label: L('moveRight'), disabled: order.indexOf(k) === order.length - 1, onSelect: () => move(k, 1) },
    { type: 'separator' },
    { id: `pin-l:${k}`, label: L('pinLeft'), type: 'radio', checked: s.pinned[k] === 'left', onSelect: () => pin(k, 'left') },
    { id: `pin-r:${k}`, label: L('pinRight'), type: 'radio', checked: s.pinned[k] === 'right', onSelect: () => pin(k, 'right') },
    { id: `pin-0:${k}`, label: L('unpin'), type: 'radio', checked: !s.pinned[k], onSelect: () => pin(k) },
  ];
  if (o.column) return [{ id: `hide:${o.column}`, label: `${L('show')}: ${name(o.column)}`, type: 'checkbox', checked: !s.hidden.includes(o.column), onSelect: () => set({ ...s, hidden: s.hidden.includes(o.column!) ? s.hidden.filter((x) => x !== o.column) : [...s.hidden, o.column!] }) }, { type: 'separator' }, ...colItems(o.column), { type: 'separator' }, { id: 'cols', label: L('columns'), items: columnsMenuItems(cols, s, set, { ...o, column: undefined }) }];
  return [
    { type: 'label', label: L('show') },
    ...order.map((k) => ({ id: `vis:${k}`, label: name(k), type: 'checkbox' as const, checked: !s.hidden.includes(k), items: undefined, icon: grip(k), onSelect: () => set({ ...s, hidden: s.hidden.includes(k) ? s.hidden.filter((x) => x !== k) : [...s.hidden, k] }) })),
    { type: 'separator' },
    { id: 'order', label: `${L('moveLeft')} / ${L('moveRight')} · ${L('pin')}`, items: order.map((k) => ({ id: `col:${k}`, label: name(k), items: colItems(k) })) },
    { id: 'density', label: L('density'), items: (['compact', 'cozy', 'comfortable'] as const).map((d) => ({ id: `d:${d}`, label: L(d), type: 'radio' as const, checked: (s.density ?? 'cozy') === d, onSelect: () => set({ ...s, density: d }) })) },
    { type: 'separator' },
    { id: 'reset', label: L('reset'), onSelect: () => set(o.defaults ?? defaultColumnsState(cols)) },
  ];
}
export interface ULColumnsMenuProps { /** All columns ({ key, header }) in default order. */ columns: { key: string; header: React.ReactNode }[]; /** Visible / order / pinned state (controlled; see useColumnsState). */ value: ColumnsState; /** Called with the next state after each change (one commit per drag). */ onValueChange: (s: ColumnsState) => void; /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default "en". */ locale?: string; /** State restored by "Reset". Default: all visible, default order. */ defaults?: ColumnsState }
export function ULColumnsMenu({ columns, value, onValueChange, locale, defaults }: ULColumnsMenuProps) {
  return <ULMenuButton items={columnsMenuItems(columns, value, onValueChange, { locale, defaults })} label={blockText('columns', locale)} closeOnSelect={false} buttonProps={{ className: 'ul-btn ul-btn--secondary ul-cols-btn' }}><Icon name="layout-grid" /><span>{blockText('columns', locale)}</span></ULMenuButton>;
}

/* ================= 3. Filter bar ================= */
export type FilterType = 'text' | 'number' | 'date' | 'select' | 'tags';
export type FilterOp = 'is' | 'isNot' | 'contains' | 'gt' | 'lt' | 'between' | 'in' | 'empty';
export interface FilterField { key: string; label: string; type: FilterType; options?: { value: string; label: string }[] }
export interface Filter { id: string; field: string; op: FilterOp; value?: string | number | string[] | [number, number] | { start: string; end: string } }
export const OPS: Record<FilterType, FilterOp[]> = { text: ['contains', 'is', 'isNot', 'empty'], number: ['is', 'gt', 'lt', 'between', 'empty'], date: ['between', 'empty'], select: ['is', 'isNot', 'in', 'empty'], tags: ['in', 'empty'] };
/** URL query (filter=field:op:value; arrays joined with |). */
export function filtersToQuery(fs: Filter[]): string {
  const p = new URLSearchParams();
  fs.forEach((f) => { const v = f.value == null ? '' : Array.isArray(f.value) ? f.value.join('|') : typeof f.value === 'object' ? `${(f.value as { start: string }).start}|${(f.value as { end: string }).end}` : String(f.value); p.append('filter', `${f.field}:${f.op}:${v}`); });
  return p.toString();
}
export function filtersFromQuery(q: string, fields: FilterField[]): Filter[] {
  const p = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
  return p.getAll('filter').map((s, i) => {
    const [field, op, ...rest] = s.split(':'), raw = rest.join(':'), f = fields.find((x) => x.key === field); if (!f || !OPS[f.type].includes(op as FilterOp)) return null;
    const parts = raw.split('|');
    const value = op === 'empty' ? undefined : f.type === 'date' ? { start: parts[0], end: parts[1] ?? parts[0] } : op === 'between' ? [Number(parts[0]), Number(parts[1])] as [number, number] : op === 'in' || f.type === 'tags' ? parts.filter(Boolean) : f.type === 'number' ? Number(raw) : raw;
    return { id: `f${i}-${field}`, field, op: op as FilterOp, value };
  }).filter(Boolean) as Filter[];
}
export function applyFilters<R>(rows: R[], fs: Filter[], get: (r: R, field: string) => unknown = (r, k) => (r as Record<string, unknown>)[k]): R[] {
  if (!fs.length) return rows;
  return rows.filter((r) => fs.every((f) => {
    const v = get(r, f.field), x = f.value;
    switch (f.op) {
      case 'empty': return v == null || v === '' || (Array.isArray(v) && !v.length);
      case 'contains': return String(v ?? '').toLowerCase().includes(String(x ?? '').toLowerCase());
      case 'is': return String(v) === String(x);
      case 'isNot': return String(v) !== String(x);
      case 'gt': return Number(v) > Number(x);
      case 'lt': return Number(v) < Number(x);
      case 'between': {
        if (x && typeof x === 'object' && !Array.isArray(x)) { const t = new Date(v as string).getTime(); return t >= new Date((x as { start: string }).start).getTime() && t <= new Date((x as { end: string }).end).getTime() + 864e5 - 1; }
        const [a, b] = x as [number, number]; return Number(v) >= a && Number(v) <= b;
      }
      case 'in': { const set = new Set((x as string[]) ?? []); return Array.isArray(v) ? v.some((y) => set.has(String(y))) : set.has(String(v)); }
    }
    return true;
  }));
}
const valueText = (f: Filter, fd?: FilterField, locale?: string) => {
  const opt = (v: string) => fd?.options?.find((o) => o.value === v)?.label ?? v;
  if (f.op === 'empty' || f.value == null) return '';
  if (Array.isArray(f.value)) return f.op === 'between' ? `${f.value[0]}–${f.value[1]}` : (f.value as string[]).map(opt).join(', ');
  if (typeof f.value === 'object') { const df = new Intl.DateTimeFormat(intl(locale), { day: 'numeric', month: 'short' }); return `${df.format(new Date(f.value.start))}–${df.format(new Date(f.value.end))}`; }
  return fd?.type === 'select' ? opt(String(f.value)) : String(f.value);
};
export interface SavedView { id: string; name: string; filters: Filter[] }
export interface ULFilterBarProps {
  /** Filterable fields ({ key, label, type: "text" | "number" | "select" | "tags" | "date", options? }). */ fields: FilterField[]; /** Current filters ({ id, field, op, value }). */ value: Filter[]; /** Called with the next filter list (add, edit, remove, clear all). */ onValueChange: (f: Filter[]) => void;
  /** Result count shown with a rolling number. */ count?: number;
  /** Saved views shown in the Views menu. */ views?: SavedView[]; /** Called with the chosen saved view. */ onApplyView?: (v: SavedView) => void; /** Adds "Save view"; called with the current filters. */ onSaveView?: (filters: Filter[]) => void;
  /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default "en". */ locale?: string; /** Visible label / accessible name. */ label?: string;
}
export function ULFilterBar({ fields, value, onValueChange, count, views, onApplyView, onSaveView, locale, label }: ULFilterBarProps) {
  const L = (k: Key, v?: Record<string, string | number>) => blockText(k, locale, v);
  const addRef = React.useRef<HTMLElement | null>(null), chipRefs = React.useRef(new Map<string, HTMLElement>());
  const [edit, setEdit] = React.useState<{ id: string | null; anchor: React.RefObject<HTMLElement | null> } | null>(null);
  const remove = (id: string) => {
    const el = chipRefs.current.get(id);
    const done = () => onValueChange(value.filter((f) => f.id !== id));
    if (!el || isMorphReduced()) { done(); return; }
    el.animate([{ width: `${el.offsetWidth}px`, opacity: 1 }, { width: '0px', opacity: 0, marginInline: '-3px', paddingInline: '0px' }], { duration: 220, easing: 'ease-in' }).finished.then(done, done);
    announce(L('remove'));
  };
  const anchorFor = (id: string) => ({ get current() { return chipRefs.current.get(id) ?? null; } }) as React.RefObject<HTMLElement | null>;
  return (
    <div className="ul-filterbar" role="group" aria-label={label ?? L('addFilter')}>
      <ul className="ul-filter-chips">
        {value.map((f) => { const fd = fields.find((x) => x.key === f.field), vt = valueText(f, fd, locale); return (
          <li key={f.id} ref={(n) => { if (n) chipRefs.current.set(f.id, n); else chipRefs.current.delete(f.id); }} className="ul-filter-chip">
            <button type="button" className="ul-filter-chip-main" aria-label={`${L('edit')}: ${fd?.label ?? f.field} ${L(f.op)} ${vt}`} onClick={() => setEdit({ id: f.id, anchor: anchorFor(f.id) })}>
              <span className="ul-filter-k">{fd?.label ?? f.field}</span><span className="ul-filter-op">{L(f.op)}</span>{vt ? <ULTruncatedText className="ul-filter-v" text={vt} /> : null}
            </button>
            <button type="button" className="ul-filter-chip-x" aria-label={`${L('remove')}: ${fd?.label ?? f.field}`} onClick={() => remove(f.id)}><ULIcon name="x" size={14} /></button>
          </li>); })}
      </ul>
      <ULButton ref={addRef} size="sm" variant="secondary" icon={<Icon name="plus" />} aria-haspopup="dialog" aria-expanded={!!edit && edit.id == null} onClick={() => setEdit({ id: null, anchor: addRef })}>{L('addFilter')}</ULButton>
      {views?.length || onSaveView ? <ULMenuButton label={L('views')} items={[...(views ?? []).map((v) => ({ id: v.id, label: v.name })), ...(onSaveView ? [{ type: 'separator' as const }, { id: '__save', label: L('saveView') }] : [])]} onAction={(id) => { if (id === '__save') onSaveView?.(value); else { const v = views?.find((x) => x.id === id); if (v) onApplyView ? onApplyView(v) : onValueChange(v.filters); } }} buttonProps={{ className: 'ul-btn ul-btn--plain ul-filter-views' }}>{L('views')}<Icon name="chevron-down" /></ULMenuButton> : null}
      {value.length ? <ULButton size="sm" variant="plain" onClick={() => onValueChange([])}>{L('clearAll')}</ULButton> : null}
      {count != null ? <span className="ul-filter-count" aria-live="polite"><ULRollingNumber value={count} reveal={false} locale={locale} label={L('results', { n: '' }).trim()} /></span> : null}
      {edit ? <FilterEditor key={edit.id ?? 'new'} fields={fields} filter={edit.id ? value.find((f) => f.id === edit.id) ?? null : null} anchor={edit.anchor} locale={locale}
        onClose={() => setEdit(null)} onApply={(f) => { onValueChange(edit.id ? value.map((x) => (x.id === edit.id ? { ...f, id: edit.id! } : x)) : [...value, { ...f, id: `f${Date.now().toString(36)}` }]); setEdit(null); }} /> : null}
    </div>
  );
}
function FilterEditor({ fields, filter, anchor, locale, onClose, onApply }: { fields: FilterField[]; filter: Filter | null; anchor: React.RefObject<HTMLElement | null>; locale?: string; onClose: () => void; onApply: (f: Filter) => void }) {
  const L = (k: Key) => blockText(k, locale);
  const [field, setField] = React.useState(filter?.field ?? fields[0]?.key), fd = fields.find((f) => f.key === field) ?? fields[0];
  const [op, setOp] = React.useState<FilterOp>(filter?.op ?? OPS[fd.type][0]);
  const [val, setVal] = React.useState<Filter['value']>(filter?.value);
  React.useEffect(() => { if (!OPS[fd.type].includes(op)) setOp(OPS[fd.type][0]); }, [field]);
  const editor = op === 'empty' ? null
    : fd.type === 'number' && op === 'between' ? <div className="ul-filter-row"><ULNumberField label="min" value={Array.isArray(val) ? Number(val[0]) : null} onValueChange={(v) => setVal([v ?? 0, Array.isArray(val) ? Number(val[1]) : 0])} /><ULNumberField label="max" value={Array.isArray(val) ? Number(val[1]) : null} onValueChange={(v) => setVal([Array.isArray(val) ? Number(val[0]) : 0, v ?? 0])} /></div>
    : fd.type === 'number' ? <ULNumberField label={L('value')} value={typeof val === 'number' ? val : null} onValueChange={(v) => setVal(v ?? undefined)} />
    : fd.type === 'date' ? <ULDateRangePicker label={L('value')} locale={lang(locale) as never} value={val && typeof val === 'object' && !Array.isArray(val) ? { start: new Date((val as { start: string }).start), end: new Date((val as { end: string }).end) } : null} onValueChange={(r) => setVal(r ? { start: r.start.toISOString().slice(0, 10), end: r.end.toISOString().slice(0, 10) } : undefined)} />
    : (fd.type === 'select' && op !== 'in') ? <ULSelect label={L('value')} options={fd.options ?? []} value={typeof val === 'string' ? val : undefined} onValueChange={setVal} />
    : fd.type === 'select' || fd.type === 'tags' ? <div className="ul-filter-opts" role="group" aria-label={L('value')}>{(fd.options ?? []).map((o) => { const on = Array.isArray(val) && (val as string[]).includes(o.value); return <ULButton key={o.value} size="sm" variant={on ? 'tinted' : 'secondary'} pressed={on} onPressedChange={() => setVal(on ? (val as string[]).filter((x) => x !== o.value) : [...((val as string[]) ?? []), o.value])}>{o.label}</ULButton>; })}</div>
    : <ULTextField label={L('value')} value={typeof val === 'string' ? val : ''} onValueChange={setVal} />;
  return (
    <ULPopover open onOpenChange={(o) => { if (!o) onClose(); }} triggerRef={anchor} label={filter ? L('edit') : L('addFilter')} className="ul-filter-pop">
      <form className="ul-filter-form" onSubmit={(e) => { e.preventDefault(); onApply({ id: filter?.id ?? '', field, op, value: op === 'empty' ? undefined : val }); }}>
        <ULSelect label={L('field')} options={fields.map((f) => ({ value: f.key, label: f.label }))} value={field} onValueChange={(v) => { setField(v); setVal(undefined); }} />
        <ULSelect label={L('operator')} options={OPS[fd.type].map((o) => ({ value: o, label: L(o) }))} value={op} onValueChange={(v) => setOp(v as FilterOp)} />
        {editor}
        <div className="ul-filter-row ul-filter-actions"><ULButton type="submit" variant="primary" size="sm">{L('apply')}</ULButton></div>
      </form>
    </ULPopover>
  );
}

/* ================= 5. Time ago / timestamp (ONE shared timer, paused while hidden) ================= */
const subs = new Set<() => void>(); let ticker = 0;
function tick() { subs.forEach((f) => f()); }
let visBound = false; // bound on first use (no module-level side effect: tree-shakeable)
function startTicker() { if (typeof window === 'undefined') return; if (!visBound) { visBound = true; document.addEventListener('visibilitychange', () => { if (document.hidden) stopTicker(); else if (subs.size) { tick(); startTicker(); } }); } if (ticker || document.hidden) return; ticker = window.setInterval(tick, 10000); }
function stopTicker() { clearInterval(ticker); ticker = 0; }
/** For tests / HUD: number of live subscribers and whether the one interval runs. */
export const timeAgoStats = () => ({ subscribers: subs.size, running: !!ticker });
export function useSharedNow() {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => { subs.add(force); startTicker(); return () => { subs.delete(force); if (!subs.size) stopTicker(); }; }, []);
  return Date.now();
}
export function relTime(t: number, now: number, locale?: string) {
  const s = Math.round((t - now) / 1000), a = Math.abs(s), rtf = new Intl.RelativeTimeFormat(intl(locale), { numeric: 'auto' });
  if (a < 45) return rtf.format(0, 'second');
  if (a < 2700) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 79200) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 2160000) return rtf.format(Math.round(s / 86400), 'day');
  if (a < 26e6) return rtf.format(Math.round(s / 2592000), 'month');
  return rtf.format(Math.round(s / 31536000), 'year');
}
export interface ULTimeAgoProps { /** Date or ms epoch; updates on the one shared timer (paused while the tab is hidden). */ value: Date | number | string; /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default "en". */ locale?: string; /** IANA time zone for the full date in the title tooltip. */ timeZone?: string; /** Extra class on the root element. */ className?: string }
export function ULTimeAgo({ value, locale, timeZone, className }: ULTimeAgoProps) {
  const now = useSharedNow(), t = new Date(value).getTime(), ref = React.useRef<HTMLElement | null>(null);
  const abs = new Intl.DateTimeFormat(intl(locale), { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(t);
  useActionTooltip(ref, abs);
  return <time ref={ref as React.Ref<HTMLTimeElement>} className={cx('ul-timeago', className)} dateTime={new Date(t).toISOString()} aria-label={abs} tabIndex={0}>{relTime(t, now, locale)}</time>;
}
export function ULTimestamp({ value, locale, timeZone, className, format = { dateStyle: 'medium', timeStyle: 'short' } }: ULTimeAgoProps & { format?: Intl.DateTimeFormatOptions }) {
  const t = new Date(value).getTime(), ref = React.useRef<HTMLElement | null>(null), now = useSharedNow();
  useActionTooltip(ref, relTime(t, now, locale));
  return <time ref={ref as React.Ref<HTMLTimeElement>} className={cx('ul-timeago', className)} dateTime={new Date(t).toISOString()} tabIndex={0}>{new Intl.DateTimeFormat(intl(locale), { ...format, timeZone }).format(t)}</time>;
}

/* ================= 4. Table cell renderers (flat, no glass per cell) ================= */
const Skel = ({ w = '70%' }: { w?: string }) => <ULSkeleton width={w} />;
const Empty = ({ locale }: { locale?: string }) => <span className="ul-cell-empty" aria-label="empty">{blockText('none', locale)}</span>;
interface CellBase { loading?: boolean; locale?: string }
export const ULCellStatus = ({ value, tone = 'neutral', loading, locale }: CellBase & { value?: string | null; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }) => loading ? <Skel w="60px" /> : value ? <ULBadge tone={tone} dot>{value}</ULBadge> : <Empty locale={locale} />;
export const ULCellProgress = ({ value, max = 100, label = 'Progress', loading, locale }: CellBase & { value?: number | null; max?: number; label?: string }) => loading ? <Skel w="90px" /> : value == null ? <Empty locale={locale} /> : <span className="ul-cell-prog"><ULProgress value={value} max={max} label={label} showValue={false} /><span>{Math.round((value / max) * 100)} %</span></span>;
export const ULCellPerson = ({ name, subtitle, src, loading, locale }: CellBase & { name?: string | null; subtitle?: string; src?: string }) => loading ? <span className="ul-cell-person"><ULSkeleton shape="circle" width="28px" height="28px" /><Skel w="90px" /></span> : !name ? <Empty locale={locale} /> : <span className="ul-cell-person"><ULAvatar name={name} src={src} size="sm" /><span className="ul-cell-person-t"><span className="ul-cell-person-n">{name}</span>{subtitle ? <span className="ul-cell-person-s">{subtitle}</span> : null}</span></span>;
export function ULCellNumber({ value, delta, format, compact, loading, locale }: CellBase & { value?: number | null; delta?: number | null; format?: Intl.NumberFormatOptions; compact?: boolean }) {
  if (loading) return <Skel w="60px" />;
  if (value == null) return <Empty locale={locale} />;
  const nf = new Intl.NumberFormat(intl(locale), compact ? { notation: 'compact', ...format } : format);
  return <span className="ul-cell-num">{nf.format(value)}{delta != null ? <span className="ul-cell-delta" data-dir={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '▲' : '▼'} {new Intl.NumberFormat(intl(locale), { maximumFractionDigits: 1 }).format(Math.abs(delta))} %</span> : null}</span>;
}
export const ULCellTime = ({ value, loading, locale }: CellBase & { value?: Date | number | string | null }) => loading ? <Skel w="70px" /> : value == null ? <Empty locale={locale} /> : <ULTimeAgo value={value} locale={locale} />;
export const ULCellSparkline = ({ data, loading, locale }: CellBase & { data?: number[] | null }) => loading ? <Skel w="80px" /> : !data?.length ? <Empty locale={locale} /> : <span className="ul-cell-spark"><ULSparkline data={data} width={80} height={22} bead={false} animate={false} /></span>;
export function ULCellTags({ tags, max = 2, loading, locale }: CellBase & { tags?: string[] | null; max?: number }) {
  const more = React.useRef<HTMLElement | null>(null);
  const rest = (tags ?? []).slice(max);
  useActionTooltip(more, rest.length ? rest.join(', ') : undefined);
  if (loading) return <Skel w="100px" />;
  if (!tags?.length) return <Empty locale={locale} />;
  return <span className="ul-cell-tags">{tags.slice(0, max).map((t) => <ULBadge key={t} size="sm">{t}</ULBadge>)}{rest.length ? <span ref={more} className="ul-cell-more" tabIndex={0} aria-label={rest.join(', ')}>+{rest.length}</span> : null}</span>;
}
export function ULCellId({ value, loading, locale, copyLabel }: CellBase & { value?: string | null; copyLabel?: string }) {
  const ref = React.useRef<HTMLElement | null>(null);
  useTruncTip(ref, value ?? undefined);
  if (loading) return <Skel w="90px" />;
  if (!value) return <Empty locale={locale} />;
  return <span className="ul-cell-id"><span ref={ref} className="ul-cell-id-t">{value}</span><ULCopyButton variant="icon" buttonVariant="plain" size="sm" label={copyLabel ?? blockText('copy', locale)} value={value} locale={locale} /></span>;
}
export const ULCellActions = ({ items, onAction, label = 'Row actions', loading }: CellBase & { items: MenuItem[]; onAction?: (id: string) => void; label?: string }) => loading ? <Skel w="24px" /> : <ULMenuButton items={items} label={label} onAction={onAction} align="end" buttonProps={{ className: 'ul-row-act', 'aria-label': label }}><Icon name="menu" /></ULMenuButton>;
export const ULCellBool = ({ value, loading, locale, labels = ['No', 'Yes'] }: CellBase & { value?: boolean | null; labels?: [string, string] }) => loading ? <Skel w="18px" /> : value == null ? <Empty locale={locale} /> : <span className="ul-cell-bool" data-on={value ? '' : undefined} role="img" aria-label={labels[value ? 1 : 0]}>{value ? <Icon name="check" /> : <Icon name="minus" />}</span>;
export const ULCellLink = ({ href, children, loading, locale }: CellBase & { href?: string | null; children?: React.ReactNode }) => loading ? <Skel w="80px" /> : !href ? <Empty locale={locale} /> : <a className="ul-cell-link" href={href}>{children ?? href}</a>;

/* ================= 6. Time range + refresh control ================= */
export type RangePreset = '15m' | '1h' | '24h' | '7d' | '30d' | 'custom';
export interface TimeRangeValue { preset: RangePreset; from: Date; to: Date; interval: number }
const PRESET_MS: Record<Exclude<RangePreset, 'custom'>, number> = { '15m': 9e5, '1h': 36e5, '24h': 864e5, '7d': 6048e5, '30d': 2592e6 };
const PRESET_KEY: Record<RangePreset, Key> = { '15m': 'last15m', '1h': 'last1h', '24h': 'last24h', '7d': 'last7d', '30d': 'last30d', custom: 'custom' };
export const resolveRange = (preset: RangePreset, custom?: { start: Date; end: Date } | null, now = Date.now()) => preset === 'custom' && custom ? { from: custom.start, to: new Date(custom.end.getTime() + 864e5 - 1) } : { from: new Date(now - PRESET_MS[preset as '1h']), to: new Date(now) };
export interface ULTimeRangeProps { /** Selected preset ("15m" | "1h" | "24h" | "7d" | "30d" | "custom"). Default "24h". */ value?: RangePreset; /** Called with { preset, from, to, interval } on every change. */ onValueChange?: (v: TimeRangeValue) => void; /** Auto-refresh interval in ms (0 = off). */ interval?: number; /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default "en". */ locale?: string; /** Custom range { start, end } for value="custom". */ custom?: { start: Date; end: Date } | null; /** "flat" | "glass" for both triggers (inputs category). @default undefined (resolved: "flat") */ material?: Material }
export function ULTimeRange({ value = '24h', onValueChange, interval = 0, locale, custom, material }: ULTimeRangeProps) {
  const L = (k: Key) => blockText(k, locale);
  const [preset, setPreset] = React.useState<RangePreset>(value), [range, setRange] = React.useState(custom ?? null);
  const emit = (p: RangePreset, r = range) => { const x = resolveRange(p, r); onValueChange?.({ preset: p, ...x, interval }); };
  return (
    <span className="ul-timerange">
      <ULSelect material={material} label={L('range')} options={(Object.keys(PRESET_KEY) as RangePreset[]).map((p) => ({ value: p, label: L(PRESET_KEY[p]) }))} value={preset} onValueChange={(v) => { setPreset(v as RangePreset); if (v !== 'custom') emit(v as RangePreset); }} />
      {preset === 'custom' ? <ULDateRangePicker material={material} label={L('custom').replace('…', '')} locale={lang(locale) as never} value={range} onValueChange={(r) => { setRange(r); if (r) emit('custom', r); }} /> : null}
    </span>
  );
}
export interface ULRefreshControlProps { /** Refresh handler (promise → spinner, then "updated"). */ onRefresh: () => Promise<unknown> | unknown; /** Auto-refresh interval in ms (0 = off). */ interval?: number; /** Called with the chosen auto-refresh interval. */ onIntervalChange?: (ms: number) => void; /** Offered intervals in ms (0 = off). */ intervals?: number[]; /** Last update time (ms epoch). */ updatedAt?: number | null; /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default "en". */ locale?: string }
/** Refresh button (leading-trailing coalescing, countdown ring, hidden-tab pause) + interval menu + pause / resume. */
export function ULRefreshControl({ onRefresh, interval: ctl, onIntervalChange, intervals = [0, 5000, 15000, 30000, 60000, 300000], updatedAt, locale }: ULRefreshControlProps) {
  const L = (k: Key) => blockText(k, locale);
  const [own, setOwn] = React.useState(0), [paused, setPaused] = React.useState(false), iv = ctl ?? own;
  const menuBtn = React.useRef<HTMLElement | null>(null), [open, setOpen] = React.useState(false);
  const fmt = (ms: number) => (ms === 0 ? L('off') : ms < 60000 ? `${ms / 1000} s` : `${ms / 60000} min`);
  const set = (ms: number) => { setOwn(ms); onIntervalChange?.(ms); };
  return (
    <span className="ul-act-group ul-refreshctl">
      <ULRefreshButton onRefresh={onRefresh} autoRefresh={iv && !paused ? iv : undefined} updatedAt={updatedAt} locale={locale} />
      <ULButton ref={menuBtn} size="sm" variant="plain" aria-haspopup="menu" aria-expanded={open} aria-label={`${L('auto')}: ${fmt(iv)}`} onClick={() => setOpen((o) => !o)}>{fmt(iv)}<Icon name="chevron-down" /></ULButton>
      <ULMenu open={open} onOpenChange={setOpen} anchorRef={menuBtn} label={L('auto')} align="end" items={intervals.map((ms) => ({ id: String(ms), label: fmt(ms), type: 'radio' as const, checked: ms === iv }))} onAction={(id) => set(Number(id))} />
      {iv ? <ULButton size="sm" variant="plain" pressed={paused} onPressedChange={setPaused} aria-label={paused ? L('resume') : L('pause')}>{paused ? L('resume') : L('pause')}</ULButton> : null}
    </span>
  );
}

/* ================= 7. Copy field (optional mask) ================= */
const COPYFIELD_NARROW = 240;
export interface ULCopyFieldProps { /** Visible label / accessible name. */ label: string; /** Value shown and copied (monospace, truncated in the middle of the well). */ value: string; /** Mask the value with a reveal toggle (re-masks after revealTimeout); never announced. Default false. */ masked?: boolean; /** Auto-hide the revealed value after ms. Default 15000. */ revealTimeout?: number; /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default "en". */ locale?: string; /** Extra class on the root element. */ className?: string; /** "flat" | "glass" (inputs category). @default undefined (resolved: "flat") */ material?: Material }
export function ULCopyField({ label, value, masked = false, revealTimeout = 15000, locale, className, material }: ULCopyFieldProps) {
  const L = (k: Key) => blockText(k, locale);
  const [shown, setShown] = React.useState(!masked), id = React.useId(), ref = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => { if (!masked || !shown) return; const t = window.setTimeout(() => setShown(false), revealTimeout); return () => clearTimeout(t); }, [shown, masked, revealTimeout]);
  const hidden = masked && !shown;
  const mat = useMaterial('inputs', material);
  useTruncTip(ref, hidden ? undefined : value); // never a tooltip with the value while masked
  // Below COPYFIELD_NARROW the copy label is hidden by the container query (blocks.css); the same threshold turns on its tooltip.
  const root = React.useRef<HTMLDivElement | null>(null), [narrow, setNarrow] = React.useState(false);
  React.useLayoutEffect(() => { const el = root.current; if (!el) return; const ro = new ResizeObserver(() => setNarrow(el.clientWidth < COPYFIELD_NARROW)); ro.observe(el); return () => ro.disconnect(); }, []);
  return (
    <div ref={root} className={cx('ul-copyfield', className)} data-ul-material={mat.attr} role="group" aria-labelledby={id}>
      <span id={id} className="ul-copyfield-label">{label}</span>
      <div className="ul-copyfield-well">
        <span ref={ref} className="ul-copyfield-value" aria-label={hidden ? `${label}: ••••` : undefined}>{hidden ? '•'.repeat(Math.min(24, Math.max(8, value.length))) : value}</span>
        {masked ? <ULButton size="sm" variant="plain" pressed={shown} onPressedChange={setShown} icon={<ULIcon name={shown ? 'eye-off' : 'eye'} />} aria-label={shown ? L('hide') : L('reveal')} /> : null}
        <ULCopyButton variant="inline" className="ul-copyfield-copy" value={value} sensitive={masked} label={L('copy')} aria-label={L('copy')} tooltip={narrow ? L('copy') : undefined} locale={locale} />
      </div>
    </div>
  );
}

/* ================= 8. Status + banner ================= */
export type OpStatus = 'operational' | 'degraded' | 'outage' | 'maintenance' | 'unknown';
export const ULStatusDot = ({ status, live, label, locale }: { status: OpStatus; live?: boolean; label?: string; locale?: string }) => <span className="ul-statusdot" data-status={status} data-live={live ? '' : undefined} role="img" aria-label={label ?? blockText(status, locale)}></span>;
export const ULStatusPill = ({ status, live, label, locale }: { status: OpStatus; live?: boolean; label?: string; locale?: string }) => <span className="ul-statuspill" data-status={status}><ULStatusDot status={status} live={live} label="" locale={locale} /><span>{label ?? blockText(status, locale)}</span></span>;
export type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'maintenance';
export interface BannerItem { id: string; tone?: BannerTone; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; dismissible?: boolean }
export interface ULBannerProps extends Omit<BannerItem, 'id'> { /** Shows a dismiss button. */ onDismiss?: () => void; /** Stick to the top of the scroll container. Default false. */ sticky?: boolean; /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default "en". */ locale?: string; /** Extra row under the text. */ footer?: React.ReactNode }
export function ULBanner({ tone = 'info', title, description, action, dismissible = true, onDismiss, sticky, locale, footer }: ULBannerProps) {
  const ic = tone === 'success' ? 'check' : tone === 'info' || tone === 'maintenance' ? 'alert' : 'alert';
  return (
    <div className="ul-banner" data-tone={tone} data-sticky={sticky ? '' : undefined} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="ul-banner-ic" aria-hidden="true"><Icon name={ic} /></span>
      <div className="ul-banner-t"><strong>{title}</strong>{description ? <span>{description}</span> : null}</div>
      {action ? <div className="ul-banner-a">{action}</div> : null}
      {footer}
      {dismissible && onDismiss ? <ULButton size="sm" variant="plain" icon={<Icon name="x" />} aria-label={blockText('dismiss', locale)} onClick={onDismiss} /> : null}
    </div>
  );
}
/** One banner at a time; the rest wait in order ("1 of 3 · Next"). */
export function ULBannerQueue({ items, onDismiss, sticky, locale }: { items: BannerItem[]; onDismiss: (id: string) => void; sticky?: boolean; locale?: string }) {
  const [i, setI] = React.useState(0); const cur = items[Math.min(i, items.length - 1)];
  React.useEffect(() => { if (i >= items.length) setI(Math.max(0, items.length - 1)); }, [items.length]);
  if (!cur) return null;
  return <ULBanner key={cur.id} {...cur} sticky={sticky} locale={locale} onDismiss={() => onDismiss(cur.id)}
    footer={items.length > 1 ? <span className="ul-banner-q"><span>{blockText('of', locale, { i: Math.min(i, items.length - 1) + 1, n: items.length })}</span><ULButton size="sm" variant="plain" onClick={() => setI((x) => (x + 1) % items.length)}>{blockText('next', locale)}</ULButton></span> : undefined} />;
}

/* ================= 12. Usage meter ================= */
export interface ULUsageMeterProps { /** Visible label / accessible name. */ label: string; /** Value to display. */ value: number; /** Plan limit; usage = value / limit. */ limit: number; /** Unit after the numbers (e.g. "GB"). */ unit?: string; /** per day, for the burn rate and the projected depletion date */ burnRate?: number; /** Recent values for the inline sparkline. */ history?: number[]; /** Warning threshold as a fraction of the limit (e.g. .8). */ warning?: number; /** Critical threshold as a fraction of the limit (e.g. .95). */ critical?: number; /** Action (e.g. upgrade link) shown past the warning threshold. */ action?: React.ReactNode; /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default "en". */ locale?: string }
export function ULUsageMeter({ label, value, limit, unit = '', burnRate, history, warning = 0.75, critical = 0.9, action, locale }: ULUsageMeterProps) {
  const p = limit ? value / limit : 0, tone = p >= critical ? 'danger' : p >= warning ? 'warning' : 'accent';
  const nf = new Intl.NumberFormat(intl(locale), { maximumFractionDigits: 0 });
  const days = burnRate && burnRate > 0 ? (limit - value) / burnRate : null;
  const dep = days != null && days > 0 ? new Intl.DateTimeFormat(intl(locale), { day: 'numeric', month: 'short' }).format(Date.now() + days * 864e5) : null;
  return (
    <section className="ul-usage" data-tone={tone} aria-label={label}>
      <div className="ul-usage-head"><span className="ul-usage-label">{label}</span>{action}</div>
      <div className="ul-usage-value"><ULRollingNumber value={value} reveal={false} locale={locale} /> <span className="ul-usage-of">/ {nf.format(limit)} {unit}</span></div>
      <ULProgress value={Math.min(value, limit)} max={limit} tone={tone as never} label={blockText('used', locale, { a: nf.format(value), b: nf.format(limit) })} showValue={false} />
      <div className="ul-usage-foot">
        {burnRate != null ? <span>{blockText('perDay', locale, { n: nf.format(burnRate) })}</span> : null}
        {dep ? <span>{blockText('depletes', locale, { d: dep })}</span> : null}
        {history?.length ? <ULSparkline data={history} width={90} height={20} bead={false} animate={false} /> : null}
      </div>
    </section>
  );
}

/* ================= 14. Error state ================= */
export interface ULErrorStateProps { /** Heading. */ title?: React.ReactNode; /** What went wrong, in plain words. */ message?: React.ReactNode; /** Shows a Retry action; called when it is pressed. */ onRetry?: () => Promise<unknown> | unknown; /** Key / value details in a disclosure (copyable; never put secrets here). */ diagnostics?: Record<string, string | number>; /** Support hint or link. */ support?: React.ReactNode; /** "en" | "sk" | "de" | "cs" for built-in strings, numbers and dates. Default "en". */ locale?: string;
  /** Inside a popover / drawer / card: no own card, border or glass (no glass inside glass). */
  embedded?: boolean }
export function ULErrorState({ title, message, onRetry, diagnostics, support, locale, embedded }: ULErrorStateProps) {
  const L = (k: Key) => blockText(k, locale); const [open, setOpen] = React.useState(false), id = useDomId('ul-err');
  const diag = diagnostics ? Object.entries(diagnostics).map(([k, v]) => `${k}: ${v}`).join('\n') : '';
  return (
    <section className="ul-errorstate" role="alert" data-embedded={embedded ? '' : undefined}>
      <div className="ul-errorstate-h">
        <span className="ul-errorstate-ic" aria-hidden="true"><ULIcon name="alert" /></span>
        <h3 className="ul-errorstate-t">{title ?? L('loadFailed')}</h3>
      </div>
      {message ? <p className="ul-errorstate-m">{message}</p> : null}
      {onRetry ? <div className="ul-errorstate-a"><ULActionButton variant="primary" size="sm" icons={{ idle: <ULIcon name="refresh" /> }} labels={{ idle: L('retry') }} successEffect="ring" onAction={() => onRetry()} /></div> : null}
      {diagnostics ? (
        <div className="ul-errorstate-disc">
          <button type="button" className="ul-errorstate-dh" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
            <span className="ul-errorstate-chev" aria-hidden="true"><ULIcon name="chevron-right" size="sm" /></span><span>{L('details')}</span>
          </button>
          <div id={id} hidden={!open} className="ul-errorstate-d"><pre>{diag}</pre><ULCopyButton size="sm" value={diag} label={L('copyDiag')} locale={locale} /></div>
        </div>
      ) : null}
      {support ? <div className="ul-errorstate-s">{support}</div> : null}
    </section>
  );
}

/* ================= 15. Description list + truncated text ================= */
export interface KeyValueItem { label: React.ReactNode; value: React.ReactNode; copy?: string; truncate?: boolean }
export function ULDescriptionList({ items, layout = 'grid', locale }: { items: KeyValueItem[]; layout?: 'grid' | 'stacked'; locale?: string }) {
  return <dl className="ul-dl" data-layout={layout}>{items.map((it, i) => <div key={i} className="ul-dl-row"><dt>{it.label}</dt><dd>{it.truncate && typeof it.value === 'string' ? <ULTruncatedText text={it.value} /> : it.value}{it.copy ? <ULCopyButton variant="icon" buttonVariant="plain" size="sm" value={it.copy} label={blockText('copy', locale)} locale={locale} /> : null}</dd></div>)}</dl>;
}
export const ULKeyValue = ULDescriptionList;
export function ULTruncatedText({ text, lines = 1, className }: { text: string; lines?: number; className?: string }) {
  const ref = React.useRef<HTMLElement | null>(null); useTruncTip(ref, text);
  return <span ref={ref} className={cx('ul-trunc', className)} style={lines > 1 ? ({ WebkitLineClamp: lines, display: '-webkit-box', WebkitBoxOrient: 'vertical', whiteSpace: 'normal' } as React.CSSProperties) : undefined} tabIndex={-1}>{text}</span>;
}
void useAsyncAction; void tokN;
