/**
 * Dashboard blocks, Part 11: inline edit, notification centre, activity feed, code block, JSON viewer.
 * Composition only: ULSaveButton / async action core, ULSelect, ULDatePicker, ULPopover + ULMenu (anchored morph),
 * context menus (withContextMenu), ULRollingNumber, ULTimeAgo, ULTabs (shared lens), ULCopyButton, the live-table queue
 * rule (useLiveQueue). No new overlay or animation code beyond the bell ring (WAAPI, tokens, off in reduced motion).
 */
import * as React from 'react';
import { ULButton } from '../ULButton/ULButton.tsx';
import { ULMenu, type MenuItem } from '../ULContainers/ULMenu.tsx';
import { ULPopover } from '../ULContainers/ULOverlays.tsx';
import { ULSelect } from '../ULListbox/ULListbox.tsx';
import { ULDatePicker } from '../ULPickers/ULPickers.tsx';
import { ULTabs } from '../ULTabs/ULTabs.tsx';
import { ULAvatar, ULEmptyState, ULSkeleton } from '../ULData/ULData.tsx';
import { ULRollingNumber } from '../ULData/ULKpi.tsx';
import { ULCopyButton, ULSaveButton } from '../actions/actions.tsx';
import { announce, type ActionStatus } from '../actions/core.tsx';
import { ULTimeAgo, ULErrorState } from './blocks.tsx';
import { withContextMenu, splitCtx, type ContextMenuProps } from '../ULContainers/contextTarget.tsx';
import { useLiveQueue, useThrottledAnnounce } from '../../live/liveQueue.ts';
import { isMorphReduced, getMorphTimeScale } from '../../motion/anchoredMorph.ts';
import { Icon, cx } from '../shared/icons.tsx';
import './blocks2.css';

/* ---------------- i18n ---------------- */
const T = {
  en: { close: 'Close', edit: 'Edit', save: 'Save', cancel: 'Cancel', number: 'Enter a number', required: 'Required', notifications: 'Notifications', unread: '{n} unread', unreadOne: 'Unread', markRead: 'Mark as read', markUnread: 'Mark as unread', markAll: 'Mark all as read', caughtUp: 'You are all caught up', caughtUpD: 'New notifications appear here.', failed: 'Could not load notifications', newN: '{n} new', newNotifs: '{n} new notifications', actions: 'Actions', activity: 'Activity', all: 'All', details: 'Details', newEvents: '{n} new events', noEvents: 'No activity yet', older: 'Show older', wrap: 'Wrap lines', copyCode: 'Copy code', copyValue: 'Copy value', copyPath: 'Copy path', search: 'Search keys and values', matches: '{n} matches', noMatches: 'No matches', more: 'Show {n} more', full: 'Show full value', less: 'Show less', items: '{n} items', keys: '{n} keys', filter: 'Filter' },
  sk: { close: 'Zavrieť', edit: 'Upraviť', save: 'Uložiť', cancel: 'Zrušiť', number: 'Zadajte číslo', required: 'Povinné', notifications: 'Upozornenia', unread: 'Neprečítané: {n}', unreadOne: 'Neprečítané', markRead: 'Označiť ako prečítané', markUnread: 'Označiť ako neprečítané', markAll: 'Označiť všetko ako prečítané', caughtUp: 'Všetko máte prečítané', caughtUpD: 'Nové upozornenia sa zobrazia tu.', failed: 'Upozornenia sa nepodarilo načítať', newN: 'Nové: {n}', newNotifs: 'Nové upozornenia: {n}', actions: 'Akcie', activity: 'Aktivita', all: 'Všetko', details: 'Podrobnosti', newEvents: 'Nové udalosti: {n}', noEvents: 'Zatiaľ žiadna aktivita', older: 'Zobraziť staršie', wrap: 'Zalamovať riadky', copyCode: 'Kopírovať kód', copyValue: 'Kopírovať hodnotu', copyPath: 'Kopírovať cestu', search: 'Hľadať kľúče a hodnoty', matches: 'Zhody: {n}', noMatches: 'Žiadne zhody', more: 'Zobraziť ďalších {n}', full: 'Zobraziť celú hodnotu', less: 'Zobraziť menej', items: 'Položky: {n}', keys: 'Kľúče: {n}', filter: 'Filter' },
  de: { close: 'Schließen', edit: 'Bearbeiten', save: 'Speichern', cancel: 'Abbrechen', number: 'Zahl eingeben', required: 'Pflichtfeld', notifications: 'Benachrichtigungen', unread: '{n} ungelesen', unreadOne: 'Ungelesen', markRead: 'Als gelesen markieren', markUnread: 'Als ungelesen markieren', markAll: 'Alle als gelesen markieren', caughtUp: 'Alles gelesen', caughtUpD: 'Neue Benachrichtigungen erscheinen hier.', failed: 'Benachrichtigungen konnten nicht geladen werden', newN: '{n} neu', newNotifs: '{n} neue Benachrichtigungen', actions: 'Aktionen', activity: 'Aktivität', all: 'Alle', details: 'Details', newEvents: '{n} neue Ereignisse', noEvents: 'Noch keine Aktivität', older: 'Ältere anzeigen', wrap: 'Zeilen umbrechen', copyCode: 'Code kopieren', copyValue: 'Wert kopieren', copyPath: 'Pfad kopieren', search: 'Schlüssel und Werte suchen', matches: '{n} Treffer', noMatches: 'Keine Treffer', more: '{n} weitere anzeigen', full: 'Ganzen Wert anzeigen', less: 'Weniger anzeigen', items: '{n} Einträge', keys: '{n} Schlüssel', filter: 'Filter' },
  cs: { close: 'Zavřít', edit: 'Upravit', save: 'Uložit', cancel: 'Zrušit', number: 'Zadejte číslo', required: 'Povinné', notifications: 'Oznámení', unread: 'Nepřečtené: {n}', unreadOne: 'Nepřečtené', markRead: 'Označit jako přečtené', markUnread: 'Označit jako nepřečtené', markAll: 'Označit vše jako přečtené', caughtUp: 'Vše máte přečtené', caughtUpD: 'Nová oznámení se zobrazí zde.', failed: 'Oznámení se nepodařilo načíst', newN: 'Nové: {n}', newNotifs: 'Nová oznámení: {n}', actions: 'Akce', activity: 'Aktivita', all: 'Vše', details: 'Podrobnosti', newEvents: 'Nové události: {n}', noEvents: 'Zatím žádná aktivita', older: 'Zobrazit starší', wrap: 'Zalamovat řádky', copyCode: 'Kopírovat kód', copyValue: 'Kopírovat hodnotu', copyPath: 'Kopírovat cestu', search: 'Hledat klíče a hodnoty', matches: 'Shody: {n}', noMatches: 'Žádné shody', more: 'Zobrazit dalších {n}', full: 'Zobrazit celou hodnotu', less: 'Zobrazit méně', items: 'Položky: {n}', keys: 'Klíče: {n}', filter: 'Filtr' },
};
type Key = keyof typeof T.en;
const LOC: Record<string, string> = { en: 'en-GB', sk: 'sk-SK', de: 'de-DE', cs: 'cs-CZ' };
const lang = (l?: string) => { const v = (l ?? (typeof document !== 'undefined' ? document.documentElement.lang : '') ?? 'en').slice(0, 2).toLowerCase(); return (v in T ? v : 'en') as keyof typeof T; };
export const block2Text = (k: Key, locale?: string, vars: Record<string, string | number> = {}) => { let s: string = T[lang(locale)][k] ?? T.en[k]; for (const x in vars) s = s.replace(`{${x}}`, String(vars[x])); return s; };
const tokMs = (k: string, f: number) => { if (typeof document === 'undefined') return f; const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
const focusEl = (n: HTMLElement | null | undefined) => n?.focus({ preventScroll: true });

/** Day groups (Today / Yesterday via Intl, else a medium date), keeping the given order. */
function byDay<T>(list: T[], time: (x: T) => Date | number | string, locale?: string) {
  const rtf = new Intl.RelativeTimeFormat(LOC[lang(locale)], { numeric: 'auto' }), df = new Intl.DateTimeFormat(LOC[lang(locale)], { dateStyle: 'medium' });
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const out: { key: string; label: string; items: T[] }[] = [];
  for (const x of list) {
    const t = new Date(time(x)), d = new Date(t); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - d0.getTime()) / 864e5), key = d.toDateString();
    let g = out[out.length - 1];
    if (!g || g.key !== key) { const r = diff >= -1 ? rtf.format(diff, 'day') : df.format(t); g = { key, label: r.charAt(0).toUpperCase() + r.slice(1), items: [] }; out.push(g); }
    g.items.push(x);
  }
  return out;
}

/* ================= 1. Inline edit ================= */
export interface ULInlineEditProps<V = unknown> extends ContextMenuProps<{ value: V }> {
  value: V;
  /** Persist. A throw / rejection rolls the optimistic value back and leaves the editor open on Retry. */
  onCommit: (v: V) => Promise<unknown> | unknown;
  /** Optimistic update (called with the new value before onCommit, and with the old one on rollback). */
  onValueChange?: (v: V) => void;
  type?: 'text' | 'number' | 'select' | 'date';
  label: string;
  options?: { value: string; label: string }[];
  format?: (v: V) => React.ReactNode;
  validate?: (v: V) => string | null | undefined;
  placeholder?: string;
  locale?: string;
  disabled?: boolean;
  className?: string;
}
export function ULInlineEdit<V = unknown>(props: ULInlineEditProps<V>) {
  const [ctx, p] = splitCtx(props);
  const { value, onCommit, onValueChange, type = 'text', label, options, format, validate, placeholder, locale, disabled, className } = p as ULInlineEditProps<V>;
  const L = (k: Key, v?: Record<string, string | number>) => block2Text(k, locale, v);
  const [editing, setEditing] = React.useState(false), [draft, setDraft] = React.useState<V>(value), [opt, setOpt] = React.useState<{ v: V } | null>(null);
  const [touched, setTouched] = React.useState(false), [box, setBox] = React.useState<number | null>(null);
  const root = React.useRef<HTMLDivElement | null>(null), disp = React.useRef<HTMLButtonElement | null>(null), ed = React.useRef<HTMLDivElement | null>(null), inp = React.useRef<HTMLInputElement | null>(null);
  const ar = React.useRef<any>(null), st = React.useRef<ActionStatus>('idle'), wasEditing = React.useRef(false), msgId = React.useId();
  React.useEffect(() => { setOpt(null); }, [value]);
  const shown = opt ? opt.v : value;
  const fmt = (v: V): React.ReactNode => {
    if (format) return format(v);
    if (v == null || v === '') return <span className="ul-ie-ph">{placeholder ?? '—'}</span>;
    if (type === 'select') return options?.find((o) => o.value === String(v))?.label ?? String(v);
    if (type === 'date') return new Intl.DateTimeFormat(LOC[lang(locale)], { dateStyle: 'medium' }).format(v as unknown as Date);
    if (type === 'number') return new Intl.NumberFormat(LOC[lang(locale)]).format(Number(v));
    return String(v);
  };
  const text = (n: React.ReactNode) => (typeof n === 'string' || typeof n === 'number' ? String(n) : placeholder ?? '');
  const parse = (s: string): V => (type === 'number' ? (s.trim() === '' ? (null as V) : (Number(s.replace(/\s/g, '').replace(',', '.')) as V)) : (s as V));
  const invalid = (v: V) => (type === 'number' && v != null && !Number.isFinite(v as unknown as number) ? L('number') : validate?.(v) ?? null);
  const err = touched ? invalid(draft) : null;
  const changed = !Object.is(draft, shown) && !(draft instanceof Date && shown instanceof Date && draft.getTime() === shown.getTime());
  const start = () => { if (disabled) return; setBox(disp.current?.offsetWidth ?? null); setDraft(shown); setTouched(false); setEditing(true); };
  const finish = () => { setEditing(false); };
  const cancel = () => { if (st.current === 'loading') return; setDraft(shown); finish(); };
  const save = async () => {
    setTouched(true);
    const e = invalid(draft); if (e) throw new Error(e);
    const prev = shown, next = draft;
    setOpt({ v: next }); onValueChange?.(next);
    try { await onCommit(next); } catch (x) { setOpt(null); onValueChange?.(prev); throw x; }
  };
  const onStatus = (s: ActionStatus) => { const was = st.current; st.current = s; if (was === 'success' && s === 'idle') finish(); };
  // focus: explicit calls both ways (Safari / touch never focus a clicked button)
  React.useLayoutEffect(() => {
    if (editing) { const n = inp.current ?? ed.current?.querySelector<HTMLElement>('button, input'); focusEl(n); inp.current?.select(); }
    else if (wasEditing.current) focusEl(disp.current);
    wasEditing.current = editing;
  }, [editing]);
  const onKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('.ul-anchored') || t.getAttribute('aria-expanded') === 'true') return; // the select / date list handles its own keys
    if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); cancel(); }
    else if (e.key === 'Enter' && t === inp.current) { e.preventDefault(); setTouched(true); if (!invalid(draft) && changed) void ar.current?.run(); }
  };
  const shownNode = fmt(shown);
  const el = (
    <div ref={root} className={cx('ul-ie', className)} data-editing={editing ? '' : undefined} data-type={type} style={editing && box ? { minWidth: `${box}px` } : undefined}>
      {editing ? (
        <div ref={ed} className="ul-ie-edit" role="group" aria-label={label} onKeyDown={onKey}>
          {type === 'select' ? <ULSelect label={label} options={options ?? []} value={draft == null ? undefined : String(draft)} onValueChange={(v: string) => { setDraft(v as V); setTouched(true); }} />
            : type === 'date' ? <ULDatePicker label={label} value={(draft as unknown as Date) ?? null} onValueChange={(d: Date | null) => { setDraft(d as V); setTouched(true); }} locale={lang(locale)} />
              : <input ref={inp} className="ul-ie-input" value={draft == null ? '' : String(draft)} inputMode={type === 'number' ? 'decimal' : undefined} aria-label={label} aria-invalid={err ? true : undefined}
                aria-describedby={err ? msgId : undefined} placeholder={placeholder} onChange={(e) => { setDraft(parse(e.target.value)); setTouched(true); }} />}
          <span className="ul-ie-actions">
            <ULSaveButton size="sm" iconOnly aria-label={L('save')} label={L('save')} locale={locale} onSave={save} dirty={changed && !err} actionRef={ar} onStatusChange={onStatus} successEffect="ripple" />
            <ULButton size="sm" variant="plain" icon={<Icon name="x" />} aria-label={L('cancel')} onClick={cancel} />
          </span>
          <span id={msgId} className="ul-ie-msg" role="alert">{err ?? ''}</span>
        </div>
      ) : (
        <button ref={disp} type="button" className="ul-ie-display" disabled={disabled} aria-label={`${label}: ${text(shownNode) || '—'}. ${L('edit')}`} onClick={start}>
          <span className="ul-ie-text">{shownNode}</span>
          <span className="ul-ie-pen" aria-hidden="true"><Icon name="edit" /></span>
        </button>
      )}
    </div>
  );
  return withContextMenu(el, ctx, 'inlineEdit', { kind: 'self', id: label, data: { value: shown } });
}

/* ================= 2. Notification centre ================= */
export interface NotificationItem { id: string; title: React.ReactNode; body?: React.ReactNode; time: Date | number | string; read?: boolean; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'; textValue?: string }
export interface ULNotificationCenterProps extends ContextMenuProps<NotificationItem> {
  items: NotificationItem[];
  onReadChange?: (id: string, read: boolean) => void;
  onMarkAllRead?: () => void;
  /** Per-item actions: the row's actions button AND right-click (one source). */
  itemMenu?: (it: NotificationItem) => MenuItem[];
  loading?: boolean;
  error?: React.ReactNode;
  onRetry?: () => unknown;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
  locale?: string;
  /** Bell ring on new unread items (rate limited; never in reduced motion). Default true. */
  ring?: boolean;
  /** Default 'covered': the popover covers the bell from the first frame (top layer); 'above' opts back to a popover below the bell. */
  anchorVisibility?: 'above' | 'covered';
}
export function ULNotificationCenter(props: ULNotificationCenterProps) {
  const [ctx, p] = splitCtx(props);
  const { items, onReadChange, onMarkAllRead, itemMenu, loading, error, onRetry, open: ctl, onOpenChange, label, locale, ring = true, anchorVisibility = 'covered' } = p as ULNotificationCenterProps;
  const L = (k: Key, v?: Record<string, string | number>) => block2Text(k, locale, v);
  const name = label ?? L('notifications');
  const [own, setOwn] = React.useState(false), open = ctl ?? own;
  const setOpen = (v: boolean) => { if (ctl == null) setOwn(v); onOpenChange?.(v); };
  const bell = React.useRef<HTMLElement | null>(null), ico = React.useRef<HTMLSpanElement | null>(null);
  const unread = items.filter((i) => !i.read).length;
  // bell ring + throttled announcement, only for items that arrive after mount
  const seen = React.useRef<Set<string> | null>(null), lastRing = React.useRef(-1e9);
  const say = useThrottledAnnounce(announce);
  React.useEffect(() => {
    const ids = items.map((i) => i.id);
    if (!seen.current) { seen.current = new Set(ids); return; }
    const fresh = items.filter((i) => !seen.current!.has(i.id) && !i.read); ids.forEach((k) => seen.current!.add(k));
    if (!fresh.length) return;
    say(fresh.length, (n) => L('newNotifs', { n }));
    const now = performance.now();
    if (!ring || isMorphReduced() || !ico.current || now - lastRing.current < tokMs('--ul-ntf-ring-gap', 4000)) return;
    lastRing.current = now;
    const a = tokMs('--ul-ntf-ring-angle', 14);
    ico.current.animate([0, a, -a * 0.7, a * 0.4, -a * 0.18, 0].map((d) => ({ rotate: `${d}deg` })), { duration: tokMs('--ul-ntf-ring-duration', 620) * getMorphTimeScale(), easing: 'ease-out' });
  }, [items]);
  // queue rule
  const byId = React.useRef(new Map<string, NotificationItem>());
  items.forEach((i) => byId.current.set(i.id, i));
  const q = useLiveQueue(items.map((i) => i.id));
  const shown = q.shown.map((k) => byId.current.get(k)!).filter(Boolean);
  React.useEffect(() => { const live = new Set(q.shown); byId.current.forEach((_, k) => { if (!live.has(k) && !items.some((i) => i.id === k)) byId.current.delete(k); }); });
  const groups = byDay(shown, (i) => i.time, locale);
  // per-item actions: one shared menu, anchored to the row's button
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const menuAnchor = React.useRef<HTMLElement | null>(null);
  const menuItems = menuFor && itemMenu ? itemMenu(byId.current.get(menuFor)!) : [];
  const listEl = (
    <div ref={q.ref} className="ul-ntf-list" role="list" aria-label={name}>
      {groups.map((g) => (
        <section key={g.key} className="ul-feed-group" role="listitem" aria-label={g.label}>
          <h3 className="ul-feed-day">{g.label}</h3>
          <ul className="ul-feed-ul">
            {g.items.map((it) => (
              <li key={it.id} className="ul-ntf-item" data-live-key={it.id} data-ctx-id={it.id} data-unread={it.read ? undefined : ''} data-tone={it.tone}>
                <span className="ul-ntf-dot" aria-hidden="true"></span>
                <div className="ul-ntf-main">
                  <p className="ul-ntf-title">{it.read ? null : <span className="ul-sr-only">{L('unreadOne')}: </span>}{it.title}</p>
                  {it.body ? <p className="ul-ntf-body">{it.body}</p> : null}
                  <ULTimeAgo value={it.time} locale={locale} className="ul-ntf-time" />
                </div>
                <span className="ul-ntf-acts">
                  {onReadChange ? <button type="button" className="ul-flat-btn" aria-label={it.read ? L('markUnread') : L('markRead')} onClick={() => onReadChange(it.id, !it.read)}><Icon name={it.read ? 'mail' : 'check'} /></button> : null}
                  {itemMenu ? <button type="button" className="ul-flat-btn" aria-label={L('actions')} aria-haspopup="menu" aria-expanded={menuFor === it.id} onClick={(e) => { menuAnchor.current = e.currentTarget; setMenuFor(it.id); }}><Icon name="more" /></button> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
  const rightClick = ctx.contextMenu ? ctx : itemMenu ? { ...ctx, contextMenu: (t: { data?: NotificationItem }) => (t.data ? itemMenu(t.data) : null) } : ctx;
  return (
    <span className="ul-ntf">
      <ULButton ref={bell} variant="secondary" icon={<span ref={ico} className="ul-ntf-ico"><Icon name="bell" /></span>} aria-label={unread ? `${name}, ${L('unread', { n: unread })}` : name}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} />
      {unread > 0 ? <span className="ul-ntf-badge" aria-hidden="true"><ULRollingNumber value={unread} locale={LOC[lang(locale)]} /></span> : null}
      <ULPopover open={open} onOpenChange={setOpen} triggerRef={bell as React.RefObject<HTMLElement>} side="bottom" align="end" title={name} autoFocus={anchorVisibility === 'covered'} anchorVisibility={anchorVisibility} closeLabel={L('close')} className="ul-ntf-pop">
        <div className="ul-ntf-panel">
          <div className="ul-ntf-head">
            <span className="ul-ntf-count">{unread ? L('unread', { n: unread }) : ''}</span>
            {onMarkAllRead ? <button type="button" className="ul-flat-btn ul-flat-btn--text" disabled={!unread} onClick={onMarkAllRead}>{L('markAll')}</button> : null}
          </div>
          {q.pending > 0 ? <button type="button" className="ul-feed-pill" onClick={q.apply}>{L('newN', { n: q.pending })}</button> : null}
          {error ? <ULErrorState embedded title={L('failed')} message={error} onRetry={onRetry} locale={locale} />
            : loading && !shown.length ? <div className="ul-ntf-skel"><ULSkeleton width="80%" /><ULSkeleton width="60%" /><ULSkeleton width="70%" /></div>
              : !shown.length ? <ULEmptyState size="sm" title={L('caughtUp')} description={L('caughtUpD')} icon={<Icon name="bell" />} />
                : withContextMenu(listEl, rightClick as ContextMenuProps<NotificationItem>, 'notifications', undefined, { selector: '.ul-ntf-item', kind: 'notification', data: (id) => byId.current.get(id) })}
        </div>
      </ULPopover>
      {itemMenu ? <ULMenu open={!!menuFor} onOpenChange={(v) => { if (!v) setMenuFor(null); }} anchorRef={menuAnchor as React.RefObject<HTMLElement>} items={menuItems} label={L('actions')} align="end" /> : null}
    </span>
  );
}

/* ================= 3. Activity feed ================= */
export interface ActivityEvent { id: string; actor: { name: string; src?: string }; action: React.ReactNode; target?: { label: string; href?: string }; time: Date | number | string; details?: React.ReactNode; kind?: string }
export interface ULActivityFeedProps extends ContextMenuProps<ActivityEvent> {
  events: ActivityEvent[];
  /** Filter chips (by event kind). Multi-select; none = all. */
  filters?: { value: string; label: string }[];
  filter?: string[];
  defaultFilter?: string[];
  onFilterChange?: (f: string[]) => void;
  onTargetClick?: (e: ActivityEvent) => void;
  /** Rows rendered before "Show older" (the flat row model is virtualisation-ready). Default 50. */
  pageSize?: number;
  label?: string;
  locale?: string;
}
export function ULActivityFeed(props: ULActivityFeedProps) {
  const [ctx, p] = splitCtx(props);
  const { events, filters, filter: fCtl, defaultFilter = [], onFilterChange, onTargetClick, pageSize = 50, label, locale } = p as ULActivityFeedProps;
  const L = (k: Key, v?: Record<string, string | number>) => block2Text(k, locale, v);
  const [fOwn, setFOwn] = React.useState(defaultFilter), f = fCtl ?? fOwn;
  const setF = (v: string[]) => { if (!fCtl) setFOwn(v); onFilterChange?.(v); };
  const [open, setOpen] = React.useState<Set<string>>(new Set()), [limit, setLimit] = React.useState(pageSize);
  const uid = React.useId();
  const vis = f.length ? events.filter((e) => e.kind && f.includes(e.kind)) : events;
  const byId = React.useRef(new Map<string, ActivityEvent>()); events.forEach((e) => byId.current.set(e.id, e));
  const q = useLiveQueue(vis.map((e) => e.id));
  const shown = q.shown.map((k) => byId.current.get(k)!).filter(Boolean);
  const say = useThrottledAnnounce(announce), seen = React.useRef<Set<string> | null>(null);
  React.useEffect(() => { const ids = events.map((e) => e.id); if (!seen.current) { seen.current = new Set(ids); return; } const n = ids.filter((k) => !seen.current!.has(k)).length; ids.forEach((k) => seen.current!.add(k)); say(n, (c) => L('newEvents', { n: c })); }, [events]);
  // flat row model (day headers + events): a virtualiser can window this array as-is
  const rows = React.useMemo(() => { const r: ({ t: 'day'; key: string; label: string } | { t: 'ev'; e: ActivityEvent })[] = []; byDay(shown, (e) => e.time, locale).forEach((g) => { r.push({ t: 'day', key: g.key, label: g.label }); g.items.forEach((e) => r.push({ t: 'ev', e })); }); return r; }, [shown, locale]);
  let n = 0; const cut = rows.findIndex((r) => r.t === 'ev' && ++n > limit);
  const visibleRows = cut < 0 ? rows : rows.slice(0, cut);
  const toggle = (id: string) => setOpen((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const feed = (
    <div ref={q.ref} className="ul-feed-list">
      <ol className="ul-feed-ul" aria-label={label ?? L('activity')}>
        {visibleRows.map((r) => r.t === 'day' ? <li key={'d' + r.key} className="ul-feed-day" role="presentation"><h3>{r.label}</h3></li> : (
          <li key={r.e.id} className="ul-feed-item" data-live-key={r.e.id} data-ctx-id={r.e.id}>
            <ULAvatar name={r.e.actor.name} src={r.e.actor.src} size="sm" />
            <div className="ul-feed-main">
              <p className="ul-feed-text"><strong>{r.e.actor.name}</strong> {r.e.action}{r.e.target ? <> {r.e.target.href ? <a className="ul-feed-target" href={r.e.target.href} onClick={onTargetClick ? (ev) => { ev.preventDefault(); onTargetClick(r.e); } : undefined}>{r.e.target.label}</a>
                : onTargetClick ? <button type="button" className="ul-feed-target" onClick={() => onTargetClick(r.e)}>{r.e.target.label}</button> : <span className="ul-feed-target">{r.e.target.label}</span>}</> : null}</p>
              <div className="ul-feed-meta">
                <ULTimeAgo value={r.e.time} locale={locale} />
                {r.e.details ? <button type="button" className="ul-flat-btn ul-flat-btn--text" aria-expanded={open.has(r.e.id)} aria-controls={`${uid}-${r.e.id}`} onClick={() => toggle(r.e.id)}>{L('details')}<Icon name="chevron-down" /></button> : null}
              </div>
              {r.e.details ? <div id={`${uid}-${r.e.id}`} className="ul-feed-details" hidden={!open.has(r.e.id)}>{r.e.details}</div> : null}
            </div>
          </li>
        ))}
      </ol>
      {cut >= 0 ? <button type="button" className="ul-flat-btn ul-flat-btn--text ul-feed-older" onClick={() => setLimit((x) => x + pageSize)}>{L('older')}</button> : null}
    </div>
  );
  return (
    <div className="ul-feed">
      {filters?.length ? (
        <div className="ul-feed-filters" role="group" aria-label={L('filter')}>
          <button type="button" className="ul-feed-chip" aria-pressed={!f.length} onClick={() => setF([])}>{L('all')}</button>
          {filters.map((c) => <button key={c.value} type="button" className="ul-feed-chip" aria-pressed={f.includes(c.value)} onClick={() => setF(f.includes(c.value) ? f.filter((x) => x !== c.value) : [...f, c.value])}>{c.label}</button>)}
        </div>
      ) : null}
      {q.pending > 0 ? <button type="button" className="ul-feed-pill" onClick={q.apply}>{L('newEvents', { n: q.pending })}</button> : null}
      {!shown.length ? <ULEmptyState size="sm" title={L('noEvents')} /> : withContextMenu(feed, ctx, 'activity', undefined, { selector: '.ul-feed-item', kind: 'event', data: (id) => byId.current.get(id) })}
    </div>
  );
}

/* ================= 4a. Code block ================= */
type Tok = [string, string | null];
const RX: Record<string, [RegExp, (string | null)[]]> = {
  ts: [/(\/\/[^\n]*|\/\*.*?(?:\*\/|$))|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(\d[\d_.]*)\b|\b(const|let|var|function|return|if|else|for|of|in|while|await|async|import|from|export|default|new|class|extends|type|interface|as|try|catch|throw)\b|\b(true|false|null|undefined)\b/g, ['com', 'str', 'num', 'kw', 'lit']],
  json: [/("(?:\\.|[^"\\])*")(\s*:)?|(-?\b\d[\d.eE+-]*)\b|\b(true|false|null)\b/g, ['str', null, 'num', 'lit']],
  bash: [/((?:^|(?<=\s))#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|(\s-{1,2}[\w-]+)|^(\s*(?:curl|wget|echo|export|npm|npx|pnpm|yarn|cd))\b/g, ['com', 'str', 'flag', 'kw']],
};
RX.js = RX.ts; RX.typescript = RX.ts; RX.javascript = RX.ts; RX.shell = RX.bash; RX.curl = RX.bash; RX.sh = RX.bash;
/** Tiny tokenizer (comments, strings, numbers, keywords, literals, flags). Unknown language = plain text.
 * `state` carries an open block comment across lines (ts / js: a line inside or ending a /* … *\/ block is a comment); bash `#` is a
 * comment only at the line start or after whitespace (not inside URLs). */
export function tokenizeLine(line: string, language?: string, state?: { block?: boolean }): Tok[] {
  const spec = language ? RX[language.toLowerCase()] : undefined; if (!spec) return [[line, null]];
  const [re, cls] = spec, out: Tok[] = []; let i = 0; re.lastIndex = 0; let m: RegExpExecArray | null;
  if (state && spec === RX.ts) {
    if (state.block) { const e = line.indexOf('*/'); if (e < 0) return [[line, 'com']]; out.push([line.slice(0, e + 2), 'com']); i = e + 2; re.lastIndex = i; state.block = false; }
  }
  while ((m = re.exec(line))) {
    if (m[0] === '') { re.lastIndex++; continue; }
    const g = m.findIndex((x, k) => k > 0 && x != null); if (m.index > i) out.push([line.slice(i, m.index), null]);
    let c = cls[g - 1] ?? null; if (language === 'json' && g === 1 && m[2]) c = 'key';
    if (state && spec === RX.ts && c === 'com' && m[0].startsWith('/*') && !m[0].endsWith('*/')) state.block = true;
    out.push([m[0], c]); i = m.index + m[0].length;
  }
  if (i < line.length) out.push([line.slice(i), null]);
  return out;
}
export interface CodeSample { value: string; label: string; language?: string; code: string }
export interface ULCodeBlockProps { code?: string; language?: string; samples?: CodeSample[]; value?: string; defaultValue?: string; onValueChange?: (v: string) => void; lineNumbers?: boolean; highlight?: number[]; wrap?: boolean; defaultWrap?: boolean; onWrapChange?: (w: boolean) => void; label?: string; maxHeight?: number | string; locale?: string; className?: string }
export function ULCodeBlock({ code, language, samples, value, defaultValue, onValueChange, lineNumbers = true, highlight, wrap: wCtl, defaultWrap = false, onWrapChange, label, maxHeight, locale, className }: ULCodeBlockProps) {
  const L = (k: Key) => block2Text(k, locale);
  const list = samples ?? [{ value: 'code', label: label ?? language ?? 'Code', language, code: code ?? '' }];
  const [vOwn, setV] = React.useState(defaultValue ?? list[0]?.value), v = value ?? vOwn;
  const cur = list.find((s) => s.value === v) ?? list[0];
  const [wOwn, setW] = React.useState(defaultWrap), wrap = wCtl ?? wOwn;
  const hl = new Set(highlight ?? []);
  const pre = (s: CodeSample) => (
    <pre className="ul-code-pre" data-wrap={wrap ? '' : undefined} data-ln={lineNumbers ? '' : undefined} tabIndex={0} aria-label={`${label ?? s.label} (${s.language ?? 'text'})`} style={maxHeight != null ? { maxHeight } : undefined}>
      <code>{((st) => s.code.replace(/\n$/, '').split('\n').map((ln, i) => (
        <span key={i} className="ul-code-line" data-hl={hl.has(i + 1) ? '' : undefined}>{lineNumbers ? <span className="ul-code-ln" aria-hidden="true">{i + 1}</span> : null}<span className="ul-code-src">{tokenizeLine(ln, s.language, st).map(([t, c], k) => c ? <span key={k} className={`ul-tk-${c}`}>{t}</span> : t)}{'\n'}</span></span>
      )))({ block: false })}</code>
    </pre>
  );
  return (
    <div className={cx('ul-code', className)} data-tabs={samples && samples.length > 1 ? '' : undefined}>
      <div className="ul-code-tools">
        <button type="button" className="ul-flat-btn" aria-pressed={wrap} aria-label={L('wrap')} onClick={() => { const n = !wrap; if (wCtl == null) setW(n); onWrapChange?.(n); }}><Icon name="wrap" /></button>
        <ULCopyButton variant="icon" value={() => cur.code} label={L('copyCode')} locale={locale} />
      </div>
      {samples && samples.length > 1
        ? <ULTabs items={list.map((s) => ({ value: s.value, label: s.label, content: pre(s) }))} value={v} onValueChange={(x: string) => { if (value == null) setV(x); onValueChange?.(x); }} aria-label={label ?? 'Code'} />
        : <>{label ? <div className="ul-code-label">{label}</div> : null}{pre(cur)}</>}
    </div>
  );
}

/* ================= 4b. JSON viewer ================= */
const isObj = (v: unknown): v is Record<string, unknown> | unknown[] => v !== null && typeof v === 'object';
const ident = /^[A-Za-z_$][\w$]*$/;
const childPath = (p: string, k: string | number) => (typeof k === 'number' ? `${p}[${k}]` : ident.test(k) ? `${p}.${k}` : `${p}[${JSON.stringify(k)}]`);
type JRow = { t: 'node'; path: string; key: string | number | null; v: unknown; depth: number; parent: string | null } | { t: 'more'; path: string; parent: string; depth: number; left: number };
export interface ULJsonViewerProps { data: unknown; label?: string; rootName?: string; defaultExpandDepth?: number; maxString?: number; pageSize?: number; maxHeight?: number | string; onSelect?: (path: string, value: unknown) => void; locale?: string; className?: string }
export function ULJsonViewer({ data, label = 'JSON', rootName = '$', defaultExpandDepth = 1, maxString = 80, pageSize = 100, maxHeight = 420, onSelect, locale, className }: ULJsonViewerProps) {
  const L = (k: Key, v?: Record<string, string | number>) => block2Text(k, locale, v);
  const [exp, setExp] = React.useState<Set<string>>(() => { const s = new Set<string>(); const walk = (v: unknown, p: string, d: number) => { if (!isObj(v) || d >= defaultExpandDepth) return; s.add(p); if (d + 1 < defaultExpandDepth) Object.entries(v).slice(0, pageSize).forEach(([k, x]) => walk(x, childPath(p, Array.isArray(v) ? Number(k) : k), d + 1)); }; walk(data, rootName, 0); return s; });
  const [pages, setPages] = React.useState<Map<string, number>>(new Map()), [full, setFull] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState(''), [sel, setSel] = React.useState(rootName);
  const tree = React.useRef<HTMLDivElement | null>(null), focusOnSel = React.useRef(false);
  // search: matching paths (bounded walk) → their ancestors are forced open
  const search = React.useMemo(() => {
    const qq = query.trim().toLowerCase(); if (!qq) return null;
    const hits = new Set<string>(), open = new Set<string>(); let budget = 50000;
    const walk = (v: unknown, p: string, k: string | number | null, anc: string[]) => {
      if (budget-- <= 0) return;
      const hit = (k != null && String(k).toLowerCase().includes(qq)) || (!isObj(v) && String(v).toLowerCase().includes(qq));
      if (hit) { hits.add(p); anc.forEach((a) => open.add(a)); }
      if (isObj(v)) { const next = [...anc, p]; (Array.isArray(v) ? v.map((x, i) => [i, x] as const) : Object.entries(v)).forEach(([ck, x]) => walk(x, childPath(p, ck), ck, next)); }
    };
    walk(data, rootName, null, []);
    return { hits, open };
  }, [query, data, rootName]);
  const isOpen = (p: string) => exp.has(p) || !!search?.open.has(p);
  const rows = React.useMemo(() => {
    const out: JRow[] = [];
    const walk = (v: unknown, p: string, k: string | number | null, d: number, parent: string | null) => {
      out.push({ t: 'node', path: p, key: k, v, depth: d, parent });
      if (!isObj(v) || !isOpen(p)) return;
      const ents = Array.isArray(v) ? v.map((x, i) => [i, x] as const) : Object.entries(v);
      const n = search ? ents.length : Math.min(ents.length, pages.get(p) ?? pageSize);
      for (let i = 0; i < n; i++) { const [ck, x] = ents[i]; walk(x, childPath(p, ck), ck, d + 1, p); }
      if (n < ents.length) out.push({ t: 'more', path: p + '#more', parent: p, depth: d + 1, left: ents.length - n });
    };
    walk(data, rootName, null, 0, null);
    return out;
  }, [data, exp, pages, search, rootName, pageSize]);
  const byPath = React.useMemo(() => new Map(rows.map((r, i) => [r.path, i])), [rows]);
  const selRow = rows[byPath.get(sel) ?? 0];
  const selVal = selRow?.t === 'node' ? selRow.v : undefined;
  React.useEffect(() => { if (!byPath.has(sel)) setSel(rows[0]?.path ?? rootName); }, [rows]);
  React.useLayoutEffect(() => { if (!focusOnSel.current) return; focusOnSel.current = false; focusEl(tree.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(sel)}"]`)); }, [sel, rows]);
  const go = (p: string) => { focusOnSel.current = true; setSel(p); const r = rows[byPath.get(p) ?? -1]; if (r?.t === 'node') onSelect?.(p, r.v); };
  const toggle = (p: string, open?: boolean) => setExp((s) => { const x = new Set(s); const o = open ?? !isOpen(p); if (o) x.add(p); else x.delete(p); return x; });
  const more = (p: string) => setPages((m) => new Map(m).set(p, (m.get(p) ?? pageSize) + pageSize));
  const onKey = (e: React.KeyboardEvent) => {
    const i = byPath.get(sel) ?? 0, r = rows[i]; if (!r) return;
    const k = e.key; let handled = true;
    if (k === 'ArrowDown') go(rows[Math.min(rows.length - 1, i + 1)].path);
    else if (k === 'ArrowUp') go(rows[Math.max(0, i - 1)].path);
    else if (k === 'Home') go(rows[0].path);
    else if (k === 'End') go(rows[rows.length - 1].path);
    else if (k === 'ArrowRight') { if (r.t === 'node' && isObj(r.v)) { if (!isOpen(r.path)) toggle(r.path, true); else if (rows[i + 1] && rows[i + 1].depth > r.depth) go(rows[i + 1].path); } }
    else if (k === 'ArrowLeft') { if (r.t === 'node' && isObj(r.v) && isOpen(r.path) && !search?.open.has(r.path)) toggle(r.path, false); else if (r.parent) go(r.parent); }
    else if (k === 'Enter' || k === ' ') { if (r.t === 'more') more(r.parent); else if (isObj(r.v)) toggle(r.path); else if (typeof r.v === 'string' && r.v.length > maxString) setFull((s) => { const x = new Set(s); if (x.has(r.path)) x.delete(r.path); else x.add(r.path); return x; }); }
    else handled = false;
    if (handled) e.preventDefault();
  };
  const mark = (s: string) => { const qq = query.trim(); if (!qq) return s; const i = s.toLowerCase().indexOf(qq.toLowerCase()); return i < 0 ? s : <>{s.slice(0, i)}<mark>{s.slice(i, i + qq.length)}</mark>{s.slice(i + qq.length)}</>; };
  const prim = (r: Extract<JRow, { t: 'node' }>) => {
    const v = r.v;
    if (typeof v === 'string') { const long = v.length > maxString, open = full.has(r.path); const s = long && !open ? v.slice(0, maxString) + '…' : v; return <span className="ul-tk-str">"{mark(s)}"{long ? <button type="button" tabIndex={-1} className="ul-json-more" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setFull((x) => { const y = new Set(x); if (open) y.delete(r.path); else y.add(r.path); return y; }); }}>{open ? L('less') : L('full')}</button> : null}</span>; }
    if (typeof v === 'number') return <span className="ul-tk-num">{mark(String(v))}</span>;
    if (v === null || typeof v === 'boolean') return <span className="ul-tk-lit">{mark(String(v))}</span>;
    const n = Array.isArray(v) ? v.length : Object.keys(v as object).length;
    return <span className="ul-json-sum">{Array.isArray(v) ? `[ ${L('items', { n })} ]` : `{ ${L('keys', { n })} }`}</span>;
  };
  return (
    <div className={cx('ul-json', className)}>
      <div className="ul-json-bar">
        <input className="ul-ie-input ul-json-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('search')} aria-label={L('search')} />
        {search ? <span className="ul-json-count" role="status">{search.hits.size ? L('matches', { n: search.hits.size }) : L('noMatches')}</span> : null}
        <span className="ul-json-path" title={undefined}><code>{sel}</code></span>
        <ULCopyButton variant="button" size="sm" value={() => sel} label={L('copyPath')} locale={locale} />
        <ULCopyButton variant="button" size="sm" value={() => (typeof selVal === 'string' ? selVal : JSON.stringify(selVal, null, 2) ?? 'undefined')} label={L('copyValue')} locale={locale} />
      </div>
      <div ref={tree} className="ul-json-tree" role="tree" aria-label={label} onKeyDown={onKey} style={{ maxHeight }}>
        {rows.map((r) => r.t === 'more' ? (
          <div key={r.path} role="treeitem" aria-level={r.depth + 1} data-path={r.path} tabIndex={sel === r.path ? 0 : -1} aria-selected={sel === r.path} className="ul-json-row ul-json-row--more" style={{ '--d': r.depth } as React.CSSProperties} onClick={() => { setSel(r.path); more(r.parent); }}>{L('more', { n: Math.min(pageSize, r.left) })}</div>
        ) : (
          <div key={r.path} role="treeitem" aria-level={r.depth + 1} aria-expanded={isObj(r.v) ? isOpen(r.path) : undefined} aria-selected={sel === r.path} data-path={r.path} data-hit={search?.hits.has(r.path) ? '' : undefined}
            tabIndex={sel === r.path ? 0 : -1} className="ul-json-row" style={{ '--d': r.depth } as React.CSSProperties} onClick={() => { go(r.path); if (isObj(r.v)) toggle(r.path); }}>
            <span className="ul-json-tw" aria-hidden="true">{isObj(r.v) ? <Icon name={isOpen(r.path) ? 'chevron-down' : 'chevron-right'} /> : null}</span>
            {r.key != null ? <span className={typeof r.key === 'number' ? 'ul-json-idx' : 'ul-tk-key'}>{mark(String(r.key))}</span> : <span className="ul-json-root">{rootName}</span>}
            <span className="ul-json-colon">:</span> {prim(r)}
          </div>
        ))}
      </div>
    </div>
  );
}
