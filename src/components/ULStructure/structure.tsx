import * as React from 'react';
import { cx, useDomId, ULIcon } from '../shared/icons.tsx';
import { ULCheckMark } from '../shared/ULCheckMark.tsx';
import { ULButton } from '../ULButton/ULButton.tsx';
import { ULActionButton, actionText } from '../actions/core.tsx';
import { ULTypeToConfirm } from '../actions/actions.tsx';
import { ULModal, ULPopover } from '../ULContainers/ULOverlays.tsx';
import { useDialog, type DialogApi } from '../ULContainers/ULDialog.tsx';
import { withContextMenu, type ContextMenuProps } from '../ULContainers/contextTarget.tsx';
import { createLensSelect, type LensSelect } from '../../motion/lensSelect.ts';
import { isMorphReduced, getMorphTimeScale, overshootEase } from '../../motion/anchoredMorph.ts';
import { createAnchoredTooltip } from '../ULTooltip/anchoredTooltip.ts';
import '../shared/lens.css';
import '../ULSegmented/ULSegmented.css';
import './structure.css';
const tokN = (el: Element, k: string, f: number) => { const v = parseFloat(getComputedStyle(el).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };

/* ULKbd lives in kbd.tsx (ULMenu imports it without the rest of this module). */
import { ULKbd, formatKeys, detectPlatform, kloc, type KLoc, type ULKbdProps } from './kbd.tsx';
export { ULKbd, formatKeys, detectPlatform };
export type { ULKbdProps };

/* ---------------- ULSeparator ---------------- */
export interface ULSeparatorProps { orientation?: 'horizontal' | 'vertical'; /** optional centred label (horizontal only) */ label?: React.ReactNode; /** decorative = no separator role (default true when it only spaces content) */ decorative?: boolean; className?: string; style?: React.CSSProperties }
export function ULSeparator({ orientation = 'horizontal', label, decorative = false, className, style }: ULSeparatorProps) {
  const sem = decorative ? { role: 'none' as const } : { role: 'separator' as const, 'aria-orientation': orientation };
  if (label != null && orientation === 'horizontal') return <div {...sem} className={cx('ul-sep', className)} data-orientation={orientation} data-labelled="" style={style}><span className="ul-sep-line" /><span className="ul-sep-label">{label}</span><span className="ul-sep-line" /></div>;
  return <div {...sem} className={cx('ul-sep', className)} data-orientation={orientation} style={style} />;
}

/* ---------------- ULAlert (in-flow, tinted paint; tones shared with ULBanner) ---------------- */
export type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export interface ULAlertProps { tone?: AlertTone; title?: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; icon?: React.ReactNode | false; action?: React.ReactNode; dismissible?: boolean; onDismiss?: () => void; dismissLabel?: string; locale?: string; className?: string; style?: React.CSSProperties }
const DISMISS: Record<KLoc, string> = { en: 'Dismiss', sk: 'Zavrieť', de: 'Schließen', cs: 'Zavřít' };
const ALERT_ICON: Record<AlertTone, string> = { info: 'info', success: 'circle-check', warning: 'warning', danger: 'alert', neutral: 'info' };
export function ULAlert({ tone = 'info', title, description, children, icon, action, dismissible, onDismiss, dismissLabel, locale, className, style }: ULAlertProps) {
  const [gone, setGone] = React.useState(false);
  if (gone) return null;
  const urgent = tone === 'warning' || tone === 'danger';
  return (
    <div role={urgent ? 'alert' : 'status'} className={cx('ul-alert', className)} data-tone={tone} style={style}>
      {icon === false ? null : <span className="ul-alert-ic" aria-hidden="true">{icon ?? <ULIcon name={ALERT_ICON[tone]} size="md" />}</span>}
      <div className="ul-alert-body">
        {title ? <p className="ul-alert-title">{title}</p> : null}
        {description || children ? <div className="ul-alert-desc">{description}{children}</div> : null}
      </div>
      {action ? <div className="ul-alert-action">{action}</div> : null}
      {dismissible ? <button type="button" className="ul-well-btn ul-alert-x" aria-label={dismissLabel ?? DISMISS[kloc(locale)]} onClick={() => { onDismiss?.(); setGone(true); }}><ULIcon name="x" size="sm" /></button> : null}
    </div>
  );
}

/* ---------------- ULAlertDialog (dialog context) + ULConfirmPopover ---------------- */
export interface ULAlertDialogProps {
  /** Controlled open state. */ open: boolean; /** Called with the next open state (trigger, Esc, outside click, close button). */ onOpenChange?: (o: boolean) => void; /** Trigger element: the surface morphs from it and focus returns to it on close. */ triggerRef?: React.RefObject<HTMLElement | null>;
  /** Heading (labels the dialog / popover via aria-labelledby). */ title: React.ReactNode; /** Text explaining the consequence (aria-describedby). */ description?: React.ReactNode; /** Extra content (e.g. ULTypeToConfirm). */ children?: React.ReactNode;
  /** Confirm button label. */ actionLabel?: string; /** Cancel button label. Default localised "Cancel". */ cancelLabel?: string; /** "default" | "destructive" (destructive tone on the action button). */ tone?: 'default' | 'destructive';
  /** async: runs through the action core (loading / success / error); the dialog closes on success */
  onAction: () => Promise<unknown> | unknown;
  /** Called on Cancel / Esc before closing. */ onCancel?: () => void;
  /** type-to-confirm text (reuses ULConfirmAction's field) */
  typeToConfirm?: string;
  /** "en" | "sk" | "de" | "cs" for built-in strings. Default "en". */ locale?: string;
  /** @internal tests */ surfaceRef?: React.MutableRefObject<HTMLElement | null>;
}
function ConfirmFooter({ tone, actionLabel, cancelLabel, onAction, onCancel, onDone, disabled, locale }: { tone: 'default' | 'destructive'; actionLabel?: string; cancelLabel?: string; onAction: () => Promise<unknown> | unknown; onCancel: () => void; onDone: () => void; disabled?: boolean; locale?: string }) {
  return (
    <div className="ul-alertdlg-foot">
      <ULButton variant="secondary" data-ul-alert-cancel="" onClick={onCancel}>{cancelLabel ?? actionText('cancel', locale)}</ULButton>
      <ULActionButton variant={tone === 'destructive' ? 'destructive' : 'primary'} disabled={disabled} locale={locale} labels={{ idle: actionLabel ?? actionText('confirm', locale) }}
        onAction={() => onAction()} onSuccess={() => window.setTimeout(onDone, 300)} data-ul-alert-action="" />
    </div>
  );
}
export function ULAlertDialog({ open, onOpenChange, triggerRef, title, description, children, actionLabel, cancelLabel, tone = 'default', onAction, onCancel, typeToConfirm, locale, surfaceRef }: ULAlertDialogProps) {
  const [typed, setTyped] = React.useState('');
  React.useEffect(() => { if (open) setTyped(''); }, [open]);
  const cancel = () => { onCancel?.(); onOpenChange?.(false); };
  return (
    <ULModal open={open} onOpenChange={(o) => { if (!o) onCancel?.(); onOpenChange?.(o); }} triggerRef={triggerRef} title={title} description={description} size="sm" role="alertdialog" closeOnScrim
      initialFocus="[data-ul-alert-cancel]" surfaceRef={surfaceRef}
      footer={<ConfirmFooter tone={tone} actionLabel={actionLabel} cancelLabel={cancelLabel} onAction={onAction} onCancel={cancel} onDone={() => onOpenChange?.(false)} disabled={typeToConfirm != null && typed.trim() !== typeToConfirm} locale={locale} />}>
      {children}
      {typeToConfirm != null ? <ULTypeToConfirm text={typeToConfirm} value={typed} onValueChange={setTyped} locale={locale} /> : null}
    </ULModal>
  );
}
/** Inside an open dialog: confirm through useDialog().push (same surface morphs, no second modal). Resolves true on action success, false on cancel / back. */
export function useAlertDialog() {
  let api: DialogApi | null = null; try { api = useDialog(); } catch { api = null; }
  return React.useCallback((o: Omit<ULAlertDialogProps, 'open' | 'onOpenChange' | 'triggerRef'> & { triggerRef?: React.RefObject<HTMLElement | null> }) => new Promise<boolean>((resolve) => {
    if (!api) throw new Error('useAlertDialog needs a dialog or <ULDialogProvider>');
    let done = false; const fin = (v: boolean) => { if (!done) { done = true; resolve(v); } };
    const inside = api.depth > 0, leave = () => (inside ? api!.pop() : api!.close());
    const st = { ok: o.typeToConfirm == null, subs: new Set<(ok: boolean) => void>() };
    const Body = () => { const [t, setT] = React.useState(''); return <>{o.children}{o.typeToConfirm != null ? <ULTypeToConfirm text={o.typeToConfirm} value={t} onValueChange={(v) => { setT(v); st.ok = v.trim() === o.typeToConfirm; st.subs.forEach((f) => f(st.ok)); }} locale={o.locale} /> : null}</>; };
    const Foot = () => { const [ok, setOk] = React.useState(st.ok); React.useEffect(() => { st.subs.add(setOk); return () => { st.subs.delete(setOk); }; }, []);
      return <ConfirmFooter tone={o.tone ?? 'default'} actionLabel={o.actionLabel} cancelLabel={o.cancelLabel} locale={o.locale} disabled={!ok} onCancel={() => { o.onCancel?.(); fin(false); leave(); }}
        onAction={async () => { await o.onAction(); }} onDone={() => { fin(true); leave(); }} />; };
    const view = { key: 'ul-confirm-' + Math.random().toString(36).slice(2), title: o.title, description: o.description, size: 'sm' as const, content: <Body />,
      canLeave: () => { fin(false); return true; },
      footer: <Foot /> };
    if (inside) api.push(view); else api.open?.(view, { triggerRef: o.triggerRef });
  }), [api]);
}
export interface ULConfirmPopoverProps { /** Controlled open state. */ open: boolean; /** Called with the next open state (trigger, Esc, outside click, close button). */ onOpenChange: (o: boolean) => void; /** Trigger element: the surface morphs from it and focus returns to it on close. */ triggerRef: React.RefObject<HTMLElement | null>; /** Heading (labels the dialog / popover via aria-labelledby). */ title: React.ReactNode; /** Text under the title. */ description?: React.ReactNode; /** Confirm button label. */ actionLabel?: string; /** Cancel button label. Default localised "Cancel". */ cancelLabel?: string; /** "default" | "destructive" (destructive tone on the action button). */ tone?: 'default' | 'destructive'; /** Runs on confirm; a promise shows loading on the action button. */ onAction: () => Promise<unknown> | unknown; /** Preferred side: "top" | "bottom" | "left" | "right" (flips when there is no room). */ side?: 'top' | 'bottom' | 'left' | 'right'; /** "en" | "sk" | "de" | "cs" for built-in strings. Default "en". */ locale?: string }
/** Quick confirmation on the existing ULPopover (anchored morph, non-modal). Focus starts on Cancel; Esc / outside click cancel. */
export function ULConfirmPopover({ open, onOpenChange, triggerRef, title, description, actionLabel, cancelLabel, tone = 'destructive', onAction, side = 'bottom', locale }: ULConfirmPopoverProps) {
  return (
    <ULPopover open={open} onOpenChange={onOpenChange} triggerRef={triggerRef} side={side} align="center" title={title} className="ul-confirm-pop">
      {description ? <p className="ul-confirm-pop-desc">{description}</p> : null}
      <ConfirmFooter tone={tone} actionLabel={actionLabel} cancelLabel={cancelLabel} onAction={onAction} onCancel={() => onOpenChange(false)} onDone={() => onOpenChange(false)} locale={locale} />
    </ULPopover>
  );
}

/* ---------------- ULToggleGroup ---------------- */
export interface ToggleItem { value: string; label?: React.ReactNode; icon?: React.ReactNode; /** icon-only items: accessible name + tooltip */ tooltip?: string; disabled?: boolean }
export interface ULToggleGroupProps {
  /** "single" (one value, lens indicator) | "multiple" (aria-pressed per item). */ type?: 'single' | 'multiple'; /** Items ({ value, label?, icon?, disabled?, aria-label? }); icon-only items need aria-label. */ items: ToggleItem[];
  /** Controlled value: string (single) or string[] (multiple). */ value?: string | string[]; /** Initial value when uncontrolled. */ defaultValue?: string | string[]; /** Called with the new value (string or string[] per type). */ onValueChange?: (v: string | string[]) => void;
  /** "md" (default) | "sm". */ size?: 'sm' | 'md'; /** Disables the control (not focusable, dimmed). Default false. */ disabled?: boolean; /** Accessible name when there is no visible label. */ 'aria-label'?: string; /** Id of the element that labels the group. */ 'aria-labelledby'?: string; /** Extra class on the root element. */ className?: string; /** Single mode: show the lens bubble while pressing / dragging. Default true. */ lens?: boolean;
}
/** single = radio semantics + the shared lens selection (createLensSelect: one resting indicator, the same code as ULSegmentedControl).
 *  multiple = aria-pressed toggles, flat pressed paint per item (several pressed items cannot share one indicator). Roving tabindex in both. */
export function ULToggleGroup({ type = 'single', items, value, defaultValue, onValueChange, size = 'md', disabled, className, lens = true, ...aria }: ULToggleGroupProps) {
  const multi = type === 'multiple';
  const norm = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const [own, setOwn] = React.useState<string[]>(norm(defaultValue ?? (multi ? [] : items[0]?.value)));
  const vals = value !== undefined ? norm(value) : own;
  const root = React.useRef<HTMLDivElement | null>(null), sel = React.useRef<LensSelect | null>(null), prev = React.useRef<HTMLElement | null>(null);
  const fromDrag = React.useRef(false), viaKey = React.useRef(false), pickRef = React.useRef<(v: string) => void>(() => {});
  const lensOn = React.useRef(!multi && lens && !disabled); lensOn.current = !multi && lens && !disabled;
  const [focusV, setFocusV] = React.useState<string | null>(null);
  const enabled = items.filter((i) => !i.disabled && !disabled);
  const tabV = focusV && enabled.some((i) => i.value === focusV) ? focusV : (vals.find((v) => enabled.some((i) => i.value === v)) ?? enabled[0]?.value);
  const commit = (next: string[]) => { if (value === undefined) setOwn(next); onValueChange?.(multi ? next : next[0] ?? ''); };
  const toggle = (v: string) => { if (multi) commit(vals.includes(v) ? vals.filter((x) => x !== v) : [...vals, v]); else if (!vals.includes(v)) commit([v]); };
  pickRef.current = (v) => { if (!vals.includes(v)) commit([v]); };
  React.useEffect(() => {
    const r = root.current; if (!r || multi) return;
    sel.current = createLensSelect({ list: r, items: () => [...r.querySelectorAll<HTMLElement>('[data-ul-lens-item]:not(:disabled)')], selected: () => r.querySelector<HTMLElement>('[aria-checked="true"]'),
      onSelect: (el) => { fromDrag.current = true; pickRef.current(el.dataset.value!); }, enabled: () => lensOn.current });
    prev.current = r.querySelector<HTMLElement>('[aria-checked="true"]');
    return () => { sel.current?.destroy(); sel.current = null; };
  }, [multi]);
  React.useLayoutEffect(() => {
    if (multi) return;
    const now = root.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? null;
    if (!fromDrag.current && prev.current && now && now !== prev.current) sel.current?.travel(prev.current, now, viaKey.current ? 'key' : 'click'); else if (now) sel.current?.syncRest();
    fromDrag.current = false; viaKey.current = false; prev.current = now;
  }, [vals.join('|'), multi]);
  React.useEffect(() => { const r = root.current; if (!r || !items.some((i) => i.tooltip)) return; const t = createAnchoredTooltip({ container: r, layer: document.body, side: 'top' }); return () => t.destroy(); }, [items.some((i) => i.tooltip)]);
  const focusItem = (v: string) => requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(v)}"]`)?.focus());
  const onKey = (e: React.KeyboardEvent) => {
    const n = enabled.length; if (!n) return;
    const i = Math.max(0, enabled.findIndex((o) => o.value === (focusV ?? tabV)));
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault(); const v = enabled[to].value; setFocusV(v);
    if (!multi) { viaKey.current = true; pickRef.current(v); } // radio: arrows move AND select
    focusItem(v);
  };
  return (
    <div ref={root} role={multi ? 'group' : 'radiogroup'} {...aria} aria-disabled={disabled || undefined} className={cx('ul-seg', 'ul-tgroup', className)} data-size={size} data-type={type} onKeyDown={onKey}>
      {items.map((it) => {
        const on = vals.includes(it.value), iconOnly = it.label == null && it.icon != null;
        const sem = multi ? { 'aria-pressed': on } : { role: 'radio' as const, 'aria-checked': on };
        return (
          <button key={it.value} type="button" {...sem} tabIndex={it.value === tabV ? 0 : -1} disabled={disabled || it.disabled} data-value={it.value} data-on={on ? '' : undefined}
            data-ul-lens-item={multi ? undefined : ''} data-ul-tip={it.tooltip} aria-label={iconOnly ? it.tooltip : undefined} className="ul-seg-item ul-tgroup-item" data-icon-only={iconOnly ? '' : undefined}
            onFocus={() => setFocusV(it.value)} onClick={() => { if (!multi && sel.current?.consumeClick()) return; toggle(it.value); }}>
            {it.icon ? <span className="ul-seg-icon" aria-hidden="true">{it.icon}</span> : null}
            {it.label != null ? <span className="ul-seg-label">{it.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- ULItem ---------------- */
export interface ULItemProps extends ContextMenuProps<{ id?: string }> {
  title: React.ReactNode; description?: React.ReactNode; media?: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode;
  /** interactive: the main area is a button (or a link with href) */
  onClick?: () => void; href?: string;
  selectable?: boolean; selected?: boolean; onSelectedChange?: (s: boolean) => void;
  /** lines of description before truncation (default 1; 0 = wrap) */
  descriptionLines?: number;
  variant?: 'plain' | 'outline' | 'muted'; size?: 'sm' | 'md'; disabled?: boolean; id?: string; className?: string; style?: React.CSSProperties;
}
export function ULItem({ title, description, media, meta, actions, onClick, href, selectable, selected = false, onSelectedChange, descriptionLines = 1, variant = 'plain', size = 'md', disabled, id, className, style, ...ctx }: ULItemProps) {
  const interactive = !!(onClick || href || selectable);
  const body = <>
    {media ? <span className="ul-item-media" aria-hidden={typeof media === 'string' ? undefined : true}>{media}</span> : null}
    <span className="ul-item-body">
      <span className="ul-item-title">{title}</span>
      {description ? <span className="ul-item-desc" data-lines={descriptionLines} style={descriptionLines > 1 ? ({ WebkitLineClamp: descriptionLines } as React.CSSProperties) : undefined}>{description}</span> : null}
    </span>
    {meta ? <span className="ul-item-meta">{meta}</span> : null}
    {selectable ? <span className="ul-item-check" aria-hidden="true"><ULCheckMark checked={selected} /></span> : null}
  </>;
  const main = !interactive ? <div className="ul-item-main">{body}</div>
    : href ? <a className="ul-item-main" href={href} aria-disabled={disabled || undefined} onClick={onClick}>{body}</a>
    : <button type="button" className="ul-item-main" disabled={disabled} aria-pressed={selectable ? selected : undefined} onClick={() => { if (selectable) onSelectedChange?.(!selected); onClick?.(); }}>{body}</button>;
  const el = (
    <div id={id} className={cx('ul-item', className)} style={style} data-variant={variant} data-size={size} data-interactive={interactive ? '' : undefined} data-selected={selectable && selected ? '' : undefined} data-disabled={disabled ? '' : undefined}>
      {main}
      {actions ? <span className="ul-item-actions">{actions}</span> : null}
    </div>
  );
  return withContextMenu(el, ctx, 'ULItem', { kind: 'item', id, data: { id } });
}
export function ULItemGroup({ children, label, className }: { children: React.ReactNode; label?: string; className?: string }) {
  return <div role="list" aria-label={label} className={cx('ul-item-group', className)}>{React.Children.map(children, (c) => (c == null ? null : <div role="listitem">{c}</div>))}</div>;
}

/* ---------------- ULCollapsible (measured height morph, never to auto) ---------------- */
export interface ULCollapsibleProps { title: React.ReactNode; children: React.ReactNode; open?: boolean; defaultOpen?: boolean; onOpenChange?: (o: boolean) => void; disabled?: boolean; trailing?: React.ReactNode; id?: string; className?: string; style?: React.CSSProperties }
export function ULCollapsible({ title, children, open, defaultOpen = false, onOpenChange, disabled, trailing, id, className, style }: ULCollapsibleProps) {
  const [own, setOwn] = React.useState(defaultOpen); const isOpen = open ?? own;
  const uid = useDomId('ul-coll', id), panel = React.useRef<HTMLDivElement | null>(null), inner = React.useRef<HTMLDivElement | null>(null);
  const anim = React.useRef<{ h: Animation | null; c: Animation | null }>({ h: null, c: null }), h0 = React.useRef<number | null>(null), first = React.useRef(true);
  const [shown, setShown] = React.useState(isOpen);
  const set = (o: boolean) => { const p = panel.current; h0.current = p ? p.getBoundingClientRect().height : null; if (o) setShown(true); if (open === undefined) setOwn(o); onOpenChange?.(o); };
  React.useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    const p = panel.current, c = inner.current; if (!p || !c) return;
    const A = anim.current, ts = getMorphTimeScale();
    const from = h0.current ?? p.getBoundingClientRect().height; h0.current = null;
    A.h?.cancel(); A.c?.cancel(); p.style.height = '';
    const to = isOpen ? c.offsetHeight : 0; // measured target (px), never "auto"
    (p as HTMLElement & { __ulColl?: unknown }).__ulColl = { from, to, open: isOpen, t0: document.timeline.currentTime };
    const done = () => { p.style.height = ''; p.style.overflow = ''; p.removeAttribute('data-ul-morphing'); if (!isOpen) setShown(false); };
    if (isMorphReduced()) { A.c = c.animate([{ opacity: isOpen ? 0 : 1 }, { opacity: isOpen ? 1 : 0 }], { duration: 150 * ts }); if (!isOpen) { p.style.height = '0px'; A.c.finished.then(done, () => {}); } else done(); return; }
    const D = tokN(p, '--ul-collapsible-duration', 420) * ts, Din = tokN(p, '--ul-collapsible-content-in', 240) * ts, Dout = tokN(p, '--ul-collapsible-content-out', 140) * ts;
    p.setAttribute('data-ul-morphing', ''); p.style.overflow = 'clip'; p.style.height = `${to}px`;
    A.h = p.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: D, easing: overshootEase(tokN(p, '--ul-collapsible-overshoot', 0)) });
    A.c = c.animate(isOpen ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], { duration: isOpen ? Din : Dout, delay: isOpen ? D * 0.15 : 0, fill: 'both' });
    A.h.finished.then(() => { A.c?.cancel(); done(); }, () => {});
  }, [isOpen]);
  return (
    <div className={cx('ul-coll', className)} style={style} data-open={isOpen ? '' : undefined}>
      <button type="button" className="ul-coll-trigger" id={`${uid}-t`} aria-expanded={isOpen} aria-controls={`${uid}-p`} disabled={disabled} onClick={() => set(!isOpen)}>
        <span className="ul-coll-title">{title}</span>
        {trailing ? <span className="ul-coll-trail">{trailing}</span> : null}
        <span className="ul-coll-chev" aria-hidden="true"><ULIcon name="chevron-down" size="sm" /></span>
      </button>
      <div ref={panel} className="ul-coll-panel" id={`${uid}-p`} role="region" aria-labelledby={`${uid}-t`} hidden={!shown}>
        <div ref={inner} className="ul-coll-inner">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- ULScrollArea (native scrolling + flat overlay thumbs) ---------------- */
/** Thumb maths (exported for tests): size and offset in px for one axis. */
export function scrollThumb(client: number, content: number, pos: number, track: number, min = 24) {
  if (content <= client + 0.5 || track <= 0) return { size: 0, offset: 0, visible: false };
  const size = Math.max(Math.min(min, track), Math.round((track * client) / content));
  const max = content - client, offset = max > 0 ? ((track - size) * Math.min(max, Math.max(0, pos))) / max : 0;
  return { size, offset, visible: true };
}
export interface ULScrollAreaProps { children: React.ReactNode; axis?: 'y' | 'x' | 'both'; maxHeight?: number | string; height?: number | string; /** accessible name: makes the viewport a focusable region (keyboard scrolling) */ label?: string; shadows?: boolean; overscroll?: 'auto' | 'contain'; className?: string; style?: React.CSSProperties; viewportRef?: React.MutableRefObject<HTMLDivElement | null> }
export function ULScrollArea({ children, axis = 'y', maxHeight, height, label, shadows = true, overscroll = 'auto', className, style, viewportRef }: ULScrollAreaProps) {
  const root = React.useRef<HTMLDivElement | null>(null), vp = React.useRef<HTMLDivElement | null>(null);
  const ty = React.useRef<HTMLSpanElement | null>(null), tx = React.useRef<HTMLSpanElement | null>(null);
  React.useEffect(() => {
    const r = root.current, v = vp.current; if (!r || !v) return;
    let raf = 0, idle = 0;
    const paint = () => {
      raf = 0;
      const bh = r.querySelector<HTMLElement>('.ul-scroll-bar[data-axis="y"]'), bw = r.querySelector<HTMLElement>('.ul-scroll-bar[data-axis="x"]');
      const y = scrollThumb(v.clientHeight, v.scrollHeight, v.scrollTop, bh ? bh.clientHeight : v.clientHeight);
      const x = scrollThumb(v.clientWidth, v.scrollWidth, Math.abs(v.scrollLeft), bw ? bw.clientWidth : v.clientWidth);
      if (ty.current) { ty.current.style.height = `${y.size}px`; ty.current.style.transform = `translateY(${y.offset}px)`; }
      if (tx.current) { tx.current.style.width = `${x.size}px`; tx.current.style.transform = `translateX(${x.offset}px)`; }
      r.toggleAttribute('data-y', y.visible); r.toggleAttribute('data-x', x.visible);
      const maxY = v.scrollHeight - v.clientHeight, maxX = v.scrollWidth - v.clientWidth;
      r.toggleAttribute('data-top', v.scrollTop > 1); r.toggleAttribute('data-bottom', v.scrollTop < maxY - 1);
      r.toggleAttribute('data-left', Math.abs(v.scrollLeft) > 1); r.toggleAttribute('data-right', Math.abs(v.scrollLeft) < maxX - 1);
      (r as HTMLElement & { __ulScroll?: unknown }).__ulScroll = { y, x };
    };
    const req = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const onScroll = () => { req(); r.setAttribute('data-active', ''); clearTimeout(idle); idle = window.setTimeout(() => r.removeAttribute('data-active'), tokN(r, '--ul-scroll-idle-ms', 900)); };
    v.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(req); ro.observe(v); if (v.firstElementChild) ro.observe(v.firstElementChild);
    paint();
    return () => { v.removeEventListener('scroll', onScroll); ro.disconnect(); cancelAnimationFrame(raf); clearTimeout(idle); };
  }, []);
  const drag = (ax: 'x' | 'y') => (e: React.PointerEvent<HTMLSpanElement>) => {
    const v = vp.current, bar = e.currentTarget.parentElement; if (!v || !bar || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); const t = e.currentTarget; t.setPointerCapture(e.pointerId);
    const p0 = ax === 'y' ? e.clientY : e.clientX, s0 = ax === 'y' ? v.scrollTop : v.scrollLeft;
    const track = ax === 'y' ? bar.clientHeight : bar.clientWidth, client = ax === 'y' ? v.clientHeight : v.clientWidth, content = ax === 'y' ? v.scrollHeight : v.scrollWidth;
    const th = scrollThumb(client, content, s0, track), k = (content - client) / Math.max(1, track - th.size);
    const mv = (ev: PointerEvent) => { const d = ((ax === 'y' ? ev.clientY : ev.clientX) - p0) * k; if (ax === 'y') v.scrollTop = s0 + d; else v.scrollLeft = s0 + d; };
    const up = () => { t.removeEventListener('pointermove', mv); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); root.current?.removeAttribute('data-dragging'); };
    root.current?.setAttribute('data-dragging', ''); t.addEventListener('pointermove', mv); t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up);
  };
  const page = (ax: 'x' | 'y') => (e: React.PointerEvent<HTMLSpanElement>) => {
    const v = vp.current; if (!v || e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect(), th = (ax === 'y' ? ty : tx).current?.getBoundingClientRect(); if (!th) return;
    const before = ax === 'y' ? e.clientY < th.top : e.clientX < th.left, dist = (ax === 'y' ? v.clientHeight : v.clientWidth) * 0.9 * (before ? -1 : 1);
    v.scrollBy({ [ax === 'y' ? 'top' : 'left']: dist, behavior: isMorphReduced() ? 'auto' : 'smooth' }); void r;
  };
  const setVp = (el: HTMLDivElement | null) => { vp.current = el; if (viewportRef) viewportRef.current = el; };
  return (
    <div ref={root} className={cx('ul-scroll', className)} data-axis={axis} data-shadows={shadows ? '' : undefined} style={{ maxHeight, height, ...style }}>
      <div ref={setVp} className="ul-scroll-vp" data-ul-allow-overflow="" tabIndex={label ? 0 : undefined} role={label ? 'region' : undefined} aria-label={label} style={{ maxHeight, height, overscrollBehavior: overscroll }}>
        <div className="ul-scroll-content">{children}</div>
      </div>
      {axis !== 'x' ? <span className="ul-scroll-bar" data-axis="y" aria-hidden="true" onPointerDown={page('y')}><span ref={ty} className="ul-scroll-thumb" onPointerDown={drag('y')} /></span> : null}
      {axis !== 'y' ? <span className="ul-scroll-bar" data-axis="x" aria-hidden="true" onPointerDown={page('x')}><span ref={tx} className="ul-scroll-thumb" onPointerDown={drag('x')} /></span> : null}
    </div>
  );
}
