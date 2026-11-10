/**
 * Ready-made action components, all thin layers over the core (useAsyncAction + ULActionButton).
 * Copy, Save (+ status, unsaved guard), Submit, Confirm (inline / hold / type), Download / Export, Refresh, Toggle icon,
 * Share, Undo toast. Tooltips are the shared anchored tooltip; overlays are the existing ULMenu / ULModal / ULToast.
 */
import * as React from 'react';
import { ULButton } from '../ULButton/ULButton.tsx';
import { ULMenu, type MenuItem } from '../ULContainers/ULMenu.tsx';
import { ULModal, ULToast } from '../ULContainers/ULOverlays.tsx';
import { ULTextField } from '../ULField/ULField.tsx';
import { Icon, ULIcon, cx } from '../shared/icons.tsx';
import { useInputGroupCtx } from '../ULForms/fieldContext.ts';
import { isMorphReduced } from '../../motion/anchoredMorph.ts';
import { useLiveStatus } from '../../live/liveStore.ts';
import type { LiveSource } from '../../live/liveSource.ts';
import { ULActionButton, useAsyncAction, useActionTooltip, useCoalescedAction, actionText, announce, SwapText, useTicker, ACTION_CANCEL, type ULActionButtonProps, type ActionStatus, type ActionSlots, type CoalesceMode, type CoalescedStatus, type AsyncAction } from './core.tsx';

const tok = (k: string, f: number) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
const Ring = ({ ms, p, keyId }: { ms?: number; p?: number; keyId?: string | number }) => (
  <svg key={keyId} className={cx('ul-act-count', p != null ? 'ul-act-progress' : null)} viewBox="0 0 36 36" aria-hidden="true" style={ms ? ({ '--ul-act-count-ms': `${ms}ms` } as React.CSSProperties) : undefined}>
    <circle className="ul-act-count-track" cx="18" cy="18" r="16" pathLength={100} />
    <circle className="ul-act-count-fill" cx="18" cy="18" r="16" pathLength={100} style={p != null ? { strokeDashoffset: 100 - Math.max(0, Math.min(1, p)) * 100 } : undefined} />
  </svg>
);
type Base = Omit<ULActionButtonProps, 'onAction'>;

/* ---------------- clipboard ---------------- */
/** Copies text (and optional HTML). Clipboard API first; hidden-textarea fallback when the API is missing, the context is
 *  insecure or permission is denied. Throws when both fail. Never logs the value. */
export async function copyText(text: string, html?: string): Promise<void> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  try {
    if (!nav?.clipboard || (typeof window !== 'undefined' && !window.isSecureContext)) throw 0;
    if (html && typeof ClipboardItem !== 'undefined' && nav.clipboard.write) {
      await nav.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
    } else await nav.clipboard.writeText(text);
    return;
  } catch { /* fall back */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true');
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
  const prev = document.activeElement as HTMLElement | null;
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove(); prev?.focus?.({ preventScroll: true });
  if (!ok) throw new Error('copy failed');
}

/* ---------------- ULCopyButton ---------------- */
// native onCopy (clipboard event), value and variant (button material; see buttonVariant) are omitted: onCopy(text) is the documented success callback, value is the text/getter
export interface ULCopyButtonProps extends Omit<Base, 'onCopy' | 'value' | 'variant'> {
  /** Text to copy, or a (async) function returning it at click time. Never logged or announced when `sensitive`. */ value: string | (() => string | Promise<string>);
  /** Rich copy (text/html) where supported. */
  html?: string | (() => string | Promise<string>);
  /** Accessible / visible label. Default: localised ("Copy" in English). */ label?: string;
  /** "button" (default, label + icon) | "icon" (icon only, needs label) | "inline" (plain, for text rows). */ variant?: 'icon' | 'button' | 'inline';
  /** Button material. Default "glass" ("plain" for variant="inline" or inside ULInputGroup). */
  buttonVariant?: 'primary' | 'secondary' | 'tinted' | 'plain';
  /** Called with the copied text after a successful write. */ onCopy?: (text: string) => void;
  /** Tooltip / announce text after success. Default: localised ("Copied to clipboard" in English). */ copiedLabel?: string;
  /** Tooltip / announce text when the clipboard write fails. Default: localised ("Couldn't copy" in English). */ failedLabel?: string;
  /** @internal tests: replace the clipboard writer. */
  writer?: (text: string, html?: string) => Promise<void>;
}
export function ULCopyButton({ value, html, label, variant = 'button', buttonVariant, onCopy, copiedLabel, failedLabel, feedback = 'both', locale, sensitive, writer, ...rest }: ULCopyButtonProps) {
  const L = (k: Parameters<typeof actionText>[0]) => actionText(k, locale);
  const name = label ?? L('copy');
  const icon = variant === 'icon';
  const inGroup = !!useInputGroupCtx(); // inline in ULInputGroup: plain (no glass inside the well)
  return (
    <ULActionButton {...rest} locale={locale} sensitive={sensitive} feedback={icon && feedback === 'both' ? 'tooltip' : feedback}
      variant={buttonVariant ?? (variant === 'inline' || inGroup ? 'plain' : undefined)} size={rest.size ?? (variant === 'inline' ? 'sm' : undefined)}
      iconOnly={icon} successEffect={rest.successEffect ?? 'ring'} aria-label={icon ? name : rest['aria-label']} tooltip={rest.tooltip ?? (icon ? name : undefined)}
      minLoadingMs={rest.minLoadingMs ?? 0} successDuration={rest.successDuration ?? tok('--ul-action-tooltip', 1600)}
      icons={{ idle: <Icon name="copy" />, ...rest.icons }}
      labels={{ idle: name, loading: name, success: L('copied'), error: failedLabel ?? L('copyFailed'), ...rest.labels }}
      messages={{ success: copiedLabel ?? L('copiedLong'), error: failedLabel ?? L('copyFailed'), ...rest.messages }}
      onAction={async () => {
        const text = typeof value === 'function' ? await value() : value;
        const h = typeof html === 'function' ? await html() : html;
        await (writer ?? copyText)(text, h);
        onCopy?.(text);
      }} />
  );
}

/* ---------------- Save ---------------- */
export interface ULSaveButtonProps extends Base {
  /** Save handler; a returned promise drives loading → success / error (async action core). */ onSave: () => Promise<void> | void;
  /** No unsaved changes: disabled (or hidden with hideWhenClean). Default true. */
  dirty?: boolean;
  /** Hide the button while `dirty` is false. Default false. */ hideWhenClean?: boolean;
  /** Cmd / Ctrl + S runs the save (preventDefault). */
  shortcut?: boolean;
  /** Text for the error tooltip / live region. */
  errorMessage?: (e: unknown) => string;
  /** Idle label. Default: localised ("Save" in English). */ label?: string;
}
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export function ULSaveButton({ onSave, dirty = true, hideWhenClean, shortcut, errorMessage, label, locale, ...rest }: ULSaveButtonProps) {
  const L = (k: Parameters<typeof actionText>[0]) => actionText(k, locale);
  const local = React.useRef<AsyncAction<[React.MouseEvent<HTMLButtonElement>]> | null>(null);
  const ar = rest.actionRef ?? local; // owners (inline edit: Enter) can run the save themselves
  const [st, setSt] = React.useState<ActionStatus>('idle');
  React.useEffect(() => {
    if (!shortcut) return;
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty || st === 'error') void ar.current?.run(undefined as unknown as React.MouseEvent<HTMLButtonElement>); } }; // keyboard save: no click event (onSave takes none)
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [shortcut, dirty, st]);
  if (hideWhenClean && !dirty && st === 'idle') return null;
  const hint = shortcut ? `${label ?? L('save')} (${isMac() ? '⌘S' : 'Ctrl+S'})` : undefined;
  return (
    <ULActionButton {...rest} locale={locale} actionRef={ar} tooltip={rest.tooltip ?? hint} disabled={rest.disabled || (!dirty && st === 'idle')}
      variant={rest.variant ?? 'primary'} errorDuration={rest.errorDuration ?? Infinity} onStatusChange={(s) => { setSt(s); rest.onStatusChange?.(s); }}
      icons={{ idle: <Icon name="save" />, ...rest.icons }} feedback={rest.feedback ?? 'both'}
      labels={{ idle: label ?? L('save'), loading: L('saving'), success: L('saved'), error: L('retry'), ...rest.labels }}
      messages={{ success: L('saved'), error: (e) => (errorMessage ? `${L('saveFailed')}: ${errorMessage(e)}` : L('saveFailed')), ...rest.messages }}
      onAction={() => onSave()} />
  );
}

/** beforeunload while dirty, plus a router-agnostic check: call shouldBlock() before navigating. */
export function useUnsavedChangesGuard(dirty: boolean, o: { message?: string; onBlock?: () => void } = {}) {
  const d = React.useRef(dirty); d.current = dirty;
  React.useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = o.message ?? ''; return o.message ?? ''; };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);
  return React.useMemo(() => ({ shouldBlock: () => { if (d.current) o.onBlock?.(); return d.current; } }), []);
}

export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';
export interface ULSaveStatusProps { /** "clean" | "dirty" | "saving" | "saved" | "error". */ status: SaveState; /** Time of the last save (ms epoch); shown as "Saved 2 min ago" via the shared ULTimeAgo timer. */ savedAt?: number | null; /** Shows a Retry link in the error state. */ onRetry?: () => void; /** "en" | "sk" | "de" | "cs". Default "en". */ locale?: string; /** Extra class on the status line. */ className?: string }
/** Quiet autosave indicator. Same icon / label swap cell, polite announcements on state changes (not on time ticks), no layout jump. */
export function ULSaveStatus({ status, savedAt, onRetry, locale, className }: ULSaveStatusProps) {
  const L = (k: Parameters<typeof actionText>[0], v?: Record<string, number>) => actionText(k, locale, v);
  useTicker(15000, status === 'saved' || status === 'clean');
  const mins = savedAt != null ? Math.floor((Date.now() - savedAt) / 60000) : null;
  const savedTxt = mins == null || mins < 1 ? L('savedNow') : L('savedAgo', { n: mins });
  const text: Record<SaveState, string> = { clean: savedAt != null ? savedTxt : '', dirty: L('unsaved'), saving: L('saving'), saved: savedTxt, error: L('saveFailed') };
  const prev = React.useRef(status);
  React.useEffect(() => { if (prev.current !== status && status !== 'clean') announce(text[status]); prev.current = status; }, [status]);
  const ic = status === 'saving' ? 'loading' : status === 'saved' || status === 'clean' ? 'success' : status === 'error' ? 'error' : 'idle';
  return (
    <span className={cx('ul-act-status', className)} data-tone={status === 'error' ? 'error' : undefined} data-state={status}>
      <span className="ul-act-icon" data-empty={status === 'clean' && savedAt == null ? '' : undefined} aria-hidden="true">
        <span className="ul-act-ic" data-on={ic === 'idle' ? '' : undefined}><ULIcon filled><circle cx="12" cy="12" r="4" /></ULIcon></span>
        <span className="ul-act-ic" data-on={ic === 'loading' ? '' : undefined}><span className="ul-act-spin" style={{ display: 'grid', width: '100%', height: '100%' }}><Icon name="refresh" /></span></span>
        <span className="ul-act-ic" data-on={ic === 'success' ? '' : undefined}><Icon name="check" /></span>
        <span className="ul-act-ic" data-on={ic === 'error' ? '' : undefined}><Icon name="alert" /></span>
      </span>
      <span className="ul-act-labels">
        <span className="ul-act-reserve" aria-hidden="true">{[L('unsaved'), L('saving'), L('savedAgo', { n: 59 }), L('saveFailed')].map((t) => <span key={t}>{t}</span>)}</span>
        <SwapText value={text[status]} k={status} />
      </span>
      {status === 'error' && onRetry ? <ULButton size="sm" variant="plain" onClick={onRetry}>{L('retry')}</ULButton> : null}
    </span>
  );
}

/* ---------------- Submit ---------------- */
// native onSubmit (form event) is omitted: onSubmit is the documented submit action
export interface ULSubmitButtonProps extends Omit<Base, 'onSubmit'> {
  /** Controlled pending (the form library owns the request). */
  pending?: boolean;
  /** Or: the button submits through this promise (receives the form data; validation runs first). */
  onSubmit?: (data: FormData | undefined, form: HTMLFormElement | null) => Promise<unknown> | unknown;
  /** Form element to submit (when the button is outside the form). */ form?: string;
  /** Idle label. Default: localised ("Submit" in English). */ label?: string;
}
export function ULSubmitButton({ pending, onSubmit, form, label, locale, ...rest }: ULSubmitButtonProps) {
  const L = (k: Parameters<typeof actionText>[0]) => actionText(k, locale);
  return (
    <ULActionButton {...rest} locale={locale} type="submit" form={form} variant={rest.variant ?? 'primary'} status={pending ? 'loading' : rest.status}
      labels={{ idle: label ?? L('submit'), loading: L('submitting'), success: L('submitted'), error: L('retry'), ...rest.labels }}
      messages={{ success: L('submitted'), error: L('submitFailed'), ...rest.messages }} icons={{ idle: <Icon name="send" />, ...rest.icons }}
      onAction={onSubmit ? (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        const f = form ? (document.getElementById(form) as HTMLFormElement | null) : e.currentTarget.form;
        if (f && !f.reportValidity()) throw ACTION_CANCEL;
        return onSubmit(f ? new FormData(f) : undefined, f);
      } : undefined} />
  );
}

/* ---------------- Publish ---------------- */
export interface ULPublishButtonProps extends Base {
  /** Publish handler (promise → loading / success / error). */ onPublish: () => Promise<unknown> | unknown;
  /** Already published: the button offers Unpublish (secondary) when onUnpublish is given. */
  published?: boolean;
  /** Unpublish handler; when set the button toggles between the two states. */ onUnpublish?: () => Promise<unknown> | unknown;
}
export function ULPublishButton({ onPublish, published, onUnpublish, locale, ...rest }: ULPublishButtonProps) {
  const L = (k: Parameters<typeof actionText>[0]) => actionText(k, locale);
  const un = !!published && !!onUnpublish;
  return (
    <ULActionButton {...rest} locale={locale} variant={rest.variant ?? (un ? 'secondary' : 'primary')} successEffect={rest.successEffect ?? 'ripple'}
      icons={{ idle: <Icon name="send" />, ...rest.icons }}
      labels={un ? { idle: L('unpublish'), loading: L('working'), success: L('done'), error: L('retry'), ...rest.labels } : { idle: L('publish'), loading: L('publishing'), success: L('published'), error: L('retry'), ...rest.labels }}
      messages={{ success: un ? L('done') : L('published'), error: L('publishFailed'), ...rest.messages }}
      onAction={() => (un ? onUnpublish!() : onPublish())} />
  );
}

/* ---------------- Confirm ---------------- */
/** Type-to-confirm field (shared by ULConfirmAction type mode and ULAlertDialog). Match = trimmed value === text. */
export function ULTypeToConfirm({ text, value, onValueChange, locale }: { text: string; value: string; onValueChange: (v: string) => void; locale?: string }) {
  return <ULTextField label={actionText('typeToConfirm', locale, { text })} value={value} onValueChange={onValueChange} autoComplete="off" spellCheck={false} />;
}
export interface ULConfirmActionProps extends Base {
  /** Confirmation style: "inline" (default, second click), "hold" (press and hold) or "type" (type-to-confirm dialog). */ confirm?: 'inline' | 'hold' | 'type';
  /** Runs after confirmation; a promise drives loading / success / error. */ onConfirm: () => Promise<unknown> | unknown;
  /** Idle label (e.g. "Delete"). */ label?: string;
  /** Label while waiting for the confirmation (inline mode). Default: localised ("Confirm?" in English). */ confirmLabel?: string;
  /** type mode: the text to type, dialog title / description. */
  typeText?: string; /** Dialog title for confirm="type". */ title?: string; /** Dialog body for confirm="type". */ description?: React.ReactNode;
  /** Hold duration for confirm="hold". Default --ul-action-hold-ms. */ holdMs?: number; /** Inline mode: time before the armed state resets. Default --ul-action-confirm-timeout. */ timeoutMs?: number;
}
export function ULConfirmAction({ confirm = 'inline', onConfirm, label, confirmLabel, typeText = 'DELETE', title, description, holdMs, timeoutMs, locale, ...rest }: ULConfirmActionProps) {
  const L = (k: Parameters<typeof actionText>[0], v?: Record<string, string>) => actionText(k, locale, v);
  const ar = React.useRef<any>(null), btn = React.useRef<HTMLElement | null>(null);
  const [armed, setArmed] = React.useState(false), [open, setOpen] = React.useState(false), [typed, setTyped] = React.useState('');
  const T = timeoutMs ?? tok('--ul-action-confirm-timeout', 3000), H = holdMs ?? tok('--ul-action-hold-ms', 900);
  // inline: second click within the countdown runs; timeout or Esc reverts
  React.useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), T);
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setArmed(false); };
    document.addEventListener('keydown', k, true);
    return () => { clearTimeout(t); document.removeEventListener('keydown', k, true); };
  }, [armed]);
  // hold: the fill sweeps the WHOLE button (fx layer, inset 0, clipped), driven by the frame clock (time, not frames)
  const hold = React.useRef<{ raf: number; t0: number; p: number; done: boolean; back: Animation | null } | null>(null);
  const fillEl = () => btn.current?.querySelector<HTMLElement>('.ul-act-holdfill') ?? null;
  const setP = (p: number) => { const f = fillEl(); if (f) f.style.transform = `scaleX(${p.toFixed(4)})`; };
  const startHold = () => {
    const b = btn.current; if (!b || hold.current || ar.current?.status === 'loading') return; // pressing again while the action runs is ignored
    const f = fillEl(); f?.getAnimations().forEach((a) => a.cancel());
    const reduced = isMorphReduced(), H0 = H;
    const st = { raf: 0, t0: 0, p: 0, done: false, back: null as Animation | null };
    hold.current = st; b.setAttribute('data-holding', '');
    const step = (t: number) => {
      if (hold.current !== st) return;
      if (!st.t0) st.t0 = t;
      let p = Math.min(1, (t - st.t0) / H0);
      if (reduced) p = Math.floor(p * 8) / 8; // determinate, ~8 discrete steps
      st.p = p; setP(p);
      if (p >= 1 && !st.done) {
        st.done = true; hold.current = null; b.removeAttribute('data-holding');
        if (!reduced) f?.animate([{ opacity: 1 }, { opacity: 0.55, offset: 0.4 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' }).finished.then(() => setP(0), () => {});
        else setP(0);
        void ar.current?.run(); // exactly once
        return;
      }
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  };
  const cancelHold = () => {
    const st = hold.current; if (!st || st.done) return;
    cancelAnimationFrame(st.raf); hold.current = null; btn.current?.removeAttribute('data-holding');
    const f = fillEl(); if (!f) return;
    const from = st.p; setP(0);
    if (from > 0 && !isMorphReduced()) f.animate([{ transform: `scaleX(${from})` }, { transform: 'scaleX(0)' }], { duration: tok('--ul-action-hold-release-ms', 160), easing: 'ease-out' });
  };
  const common = { ...rest, locale, actionRef: ar, ref: btn, variant: rest.variant ?? ('destructive' as const), messages: { success: L('done'), error: L('failed'), ...rest.messages } };
  const name = label ?? L('delete');
  if (confirm === 'hold') {
    return (
      <ULActionButton {...common} before={<span className="ul-act-holdfill"></span>} labels={{ idle: name, ...rest.labels }} tooltip={rest.tooltip ?? L('hold')}
        icons={{ idle: <Icon name="trash" />, ...rest.icons }} onAction={() => onConfirm()} successEffect={rest.successEffect ?? 'ring'}
        onPointerDown={(e) => { if (e.button !== 0) return; try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* synthetic / inactive pointer */ } startHold(); }}
        onPointerUp={cancelHold} onPointerCancel={cancelHold}
        onPointerMove={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cancelHold(); }}
        onContextMenu={(e) => { if (hold.current) e.preventDefault(); }}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat) startHold(); } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') cancelHold(); }}
        onBlur={cancelHold}
        onClickCapture={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); }}>
      </ULActionButton>
    );
  }
  if (confirm === 'type') {
    const match = typed.trim() === typeText;
    return (
      <>
        <ULActionButton {...common} ref={btn} actionRef={undefined} labels={{ idle: name, ...rest.labels }} icons={{ idle: <Icon name="trash" />, ...rest.icons }} onAction={() => { setTyped(''); setOpen(true); throw ACTION_CANCEL; }} minLoadingMs={0} />
        <ULModal open={open} onOpenChange={setOpen} triggerRef={btn} title={title ?? name} description={description}
          footer={<div className="ul-act-group"><ULButton variant="plain" onClick={() => setOpen(false)}>{L('cancel')}</ULButton>
            <ULActionButton variant="destructive" disabled={!match} labels={{ idle: name }} icons={{ idle: <Icon name="trash" /> }} onAction={() => onConfirm()}
              onSuccess={() => window.setTimeout(() => setOpen(false), 500)} messages={{ success: L('done'), error: L('failed') }} locale={locale} /></div>}>
          <ULTypeToConfirm text={typeText} value={typed} onValueChange={setTyped} locale={locale} />
        </ULModal>
      </>
    );
  }
  return (
    <ULActionButton {...common} labels={{ idle: armed ? (confirmLabel ?? L('confirm')) : name, ...rest.labels }} widthMode={rest.widthMode ?? 'morph'}
      icons={{ idle: armed ? <span className="ul-act-ringwrap"><Icon name="trash" /><Ring ms={T} keyId={String(armed)} /></span> : <Icon name="trash" />, ...rest.icons }}
      aria-describedby={rest['aria-describedby']} onAction={() => { if (!armed) { setArmed(true); announce(confirmLabel ?? L('confirm')); throw ACTION_CANCEL; } setArmed(false); return onConfirm(); }} minLoadingMs={rest.minLoadingMs} />
  );
}

/* ---------------- Download / Export ---------------- */
export type ExportResult = Blob | string;
export interface ULDownloadButtonProps extends Base {
  /** Returns a Blob, a URL or text (the component never fetches by itself). report(p) for determinate progress 0..1. */
  onExport: (o: { format?: string; report: (p: number) => void }) => ExportResult | Promise<ExportResult>;
  /** File name, or a function of the chosen format. Default "download". */ filename?: string | ((format?: string) => string);
  /** Controlled progress 0..1 (else onExport's report). */
  progress?: number | null;
  /** Offered formats ({ id, label }); more than one shows a format menu. */ formats?: { id: string; label: string }[];
  /** Format used by a plain click. Default the first of `formats`. */ defaultFormat?: string;
  /** Idle label. Default: localised ("Download" in English). */ label?: string;
}
function saveResult(res: ExportResult, name: string) {
  const isUrl = typeof res === 'string' && /^(https?:|blob:|data:|\/)/.test(res);
  const href = isUrl ? (res as string) : URL.createObjectURL(res instanceof Blob ? res : new Blob([res], { type: 'text/plain' }));
  const a = document.createElement('a'); a.href = href; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  if (!isUrl) window.setTimeout(() => URL.revokeObjectURL(href), 4000);
}
export function ULDownloadButton({ onExport, filename = 'download', progress, formats, defaultFormat, label, locale, ...rest }: ULDownloadButtonProps) {
  const L = (k: Parameters<typeof actionText>[0]) => actionText(k, locale);
  const [p, setP] = React.useState<number | null>(null), [fmt, setFmt] = React.useState(defaultFormat ?? formats?.[0]?.id), [menu, setMenu] = React.useState(false);
  const ar = React.useRef<any>(null), more = React.useRef<HTMLElement | null>(null), fmtRef = React.useRef(fmt); fmtRef.current = fmt;
  const pp = progress ?? p;
  const btn = (
    <ULActionButton {...rest} locale={locale} actionRef={ar}
      icons={{ idle: <Icon name="download" />, loading: pp != null ? <span className="ul-act-ringwrap"><Ring p={pp} /></span> : undefined, ...rest.icons }}
      labels={{ idle: label ?? L('download'), loading: pp != null ? `${Math.round(pp * 100)} %` : L('downloading'), success: L('downloaded'), error: L('retry'), ...rest.labels }}
      messages={{ success: L('downloaded'), error: L('downloadFailed'), ...rest.messages }}
      onAction={async () => {
        setP(null);
        const f = fmtRef.current;
        const res = await onExport({ format: f, report: (v) => setP(v) });
        saveResult(res, typeof filename === 'function' ? filename(f) : filename);
        setP(null);
      }} />
  );
  if (!formats?.length) return btn;
  const items: MenuItem[] = formats.map((x) => ({ id: x.id, label: x.label, type: 'radio' as const, checked: x.id === fmt }));
  return (
    <span className="ul-act-group">
      {btn}
      <ULButton ref={more} variant={rest.variant} size={rest.size} icon={<Icon name="chevron-down" />} aria-label={`${L('format')}: ${formats.find((x) => x.id === fmt)?.label ?? ''}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)} />
      <ULMenu open={menu} onOpenChange={setMenu} anchorRef={more} items={items} label={L('format')} align="end" onAction={(id) => { setFmt(id); fmtRef.current = id; void ar.current?.run(); }} />
    </span>
  );
}
/** Same component with export wording. */
export function ULExportButton(props: ULDownloadButtonProps) {
  const L = (k: Parameters<typeof actionText>[0]) => actionText(k, props.locale);
  return <ULDownloadButton {...props} labels={{ idle: props.label ?? L('export'), loading: props.progress != null ? undefined : L('exporting'), ...props.labels } as ActionSlots} />;
}

/* ---------------- Refresh ---------------- */
export interface ULRefreshButtonProps extends Base {
  /** Refresh handler (promise → spinner, then "Updated just now"). Clicks while running coalesce into one follow-up. */ onRefresh?: () => Promise<unknown> | unknown;
  /** Last update time (controlled); else the last successful refresh. */
  updatedAt?: number | null;
  /** Show "Updated n min ago" next to the button. Default true. */ showUpdated?: boolean;
  /** Auto refresh every n ms with a countdown ring; pauses while the tab is hidden. */
  autoRefresh?: number;
  /** Follow a live source: refresh = reconnect; "updated" follows its live status. */
  source?: LiveSource | null;
  /** Accessible label. Default: localised ("Refresh" in English). */ label?: string;
}
export function ULRefreshButton({ onRefresh, updatedAt, showUpdated = true, autoRefresh, source, label, locale, iconOnly = true, ...rest }: ULRefreshButtonProps) {
  const L = (k: Parameters<typeof actionText>[0], v?: Record<string, number>) => actionText(k, locale, v);
  const [last, setLast] = React.useState<number | null>(null), [hidden, setHidden] = React.useState(typeof document !== 'undefined' && document.hidden), [cycle, setCycle] = React.useState(0);
  const ar = React.useRef<any>(null);
  const live = useLiveStatus(source ?? null);
  React.useEffect(() => { if (source && live.status === 'live') setLast(Date.now()); }, [live.status]);
  React.useEffect(() => { const on = () => setHidden(document.hidden); document.addEventListener('visibilitychange', on); return () => document.removeEventListener('visibilitychange', on); }, []);
  React.useEffect(() => {
    if (!autoRefresh || hidden) return;
    const t = window.setTimeout(() => { void ar.current?.run().then(() => setCycle((c) => c + 1)); }, autoRefresh);
    return () => clearTimeout(t);
  }, [autoRefresh, hidden, cycle]);
  useTicker(15000, showUpdated);
  const at = updatedAt ?? last, mins = at != null ? Math.floor((Date.now() - at) / 60000) : null;
  const upd = at == null ? '' : mins! < 1 ? L('updatedNow') : L('updatedAgo', { n: mins! });
  const name = label ?? L('refresh');
  const idleIcon = autoRefresh ? <span className="ul-act-ringwrap" data-ul-paused={hidden ? '' : undefined}><Icon name="refresh" /><Ring ms={autoRefresh} keyId={cycle} /></span> : <Icon name="refresh" />;
  return (
    <span className="ul-act-group" data-ul-paused={hidden ? '' : undefined}>
      <ULActionButton {...rest} coalesce={rest.coalesce ?? 'leading-trailing'} locale={locale} actionRef={ar} iconOnly={iconOnly} aria-label={iconOnly ? name : rest['aria-label']} tooltip={rest.tooltip ?? name}
        feedback={rest.feedback ?? (iconOnly ? 'tooltip' : 'inline')}
        icons={{ idle: idleIcon, loading: <span className="ul-act-spin" style={{ display: 'grid', width: '100%', height: '100%' }}><Icon name="refresh" /></span>, ...rest.icons }}
        labels={{ idle: name, loading: L('refreshing'), success: L('updatedNow'), error: L('retry'), ...rest.labels }}
        messages={{ success: L('updatedNow'), error: L('refreshFailed'), ...rest.messages }}
        onSuccess={(r) => { setLast(Date.now()); setCycle((c) => c + 1); rest.onSuccess?.(r); }}
        onAction={() => (onRefresh ? onRefresh() : source ? source.reconnectNow() : undefined)} />
      {showUpdated && upd ? <span className="ul-act-status">{upd}</span> : null}
    </span>
  );
}

/* ---------------- Toggle icon (favorite, pin, bookmark, mute, star, like) ----------------
 * Spam-safe: every click flips aria-pressed and the icon at once; onPressedChange(final) runs ONCE after the quiet period
 * (useCoalescedAction, mode trailing). Status for the app: idle | pending | saving | error. */
const KINDS = { favorite: 'heart', like: 'heart', star: 'star', pin: 'pin', bookmark: 'bookmark', mute: 'volume-x' } as const;
export interface ULToggleIconButtonProps extends Omit<Base, 'labels' | 'icons' | 'onStatusChange' | 'status'> {
  /** Preset icon + labels: "star" (default) | "favorite" | "like" | "pin" | "bookmark" | "mute". */ kind?: keyof typeof KINDS;
  /** Custom icon when off (overrides `kind`). */ icon?: React.ReactNode; /** Custom icon when on. */ iconOn?: React.ReactNode;
  /** Controlled pressed state. */ pressed?: boolean; /** Initial pressed state when uncontrolled. Default false. */ defaultPressed?: boolean;
  /** Called once with the final value after the clicks settle; a rejection rolls back. Not called when the final value equals the committed one. */
  onPressedChange?: (next: boolean) => Promise<unknown> | unknown;
  /** Accessible name (required, icon-only control). */ label: string; /** Tooltip / announce text when it turns on (e.g. "Starred"). */ labelOn?: string; /** Tooltip / announce text when it turns off. */ labelOff?: string;
  /** useCoalescedAction mode: "trailing" (default, one commit after the quiet period) | "leading-trailing". */ coalesce?: CoalesceMode; /** Quiet period before the commit. Default --ul-action-debounce-ms. */ debounceMs?: number; /** Commit at the latest after this long of continuous clicking. Default --ul-action-debounce-max-wait-ms. */ maxWaitMs?: number;
  /** Commit the pending value when the button loses focus. Default true. */
  flushOnBlur?: boolean;
  /** Called with "idle" | "pending" | "saving" | "error". */ onStatusChange?: (s: CoalescedStatus) => void;
  /** flush() handle (forms, route changes). */
  flushRef?: React.MutableRefObject<(() => void) | null>;
}
export function ULToggleIconButton({ kind = 'star', icon, iconOn, pressed, defaultPressed = false, onPressedChange, label, labelOn, labelOff, locale, coalesce = 'trailing', debounceMs, maxWaitMs, flushOnBlur = true, onStatusChange, flushRef, ...rest }: ULToggleIconButtonProps) {
  const C = useCoalescedAction<boolean>({ value: pressed, defaultValue: defaultPressed, commit: (v) => onPressedChange?.(v), mode: coalesce, debounceMs, maxWaitMs, onStatusChange,
    onCommitted: (v) => announce(`${label}: ${actionText(v ? 'on' : 'off', locale)}`) });
  if (flushRef) flushRef.current = C.flush;
  const on = C.value;
  const btn = React.useRef<HTMLElement | null>(null), popA = React.useRef<Animation | null>(null);
  const pop = () => {
    if (isMorphReduced()) return;
    const el = btn.current?.querySelector<HTMLElement>('.ul-tg-icon'); if (!el) return;
    const cur = new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform).a || 1; // restart from the current frame, never stack
    popA.current?.cancel();
    popA.current = el.animate([{ transform: `scale(${cur})` }, { transform: 'scale(1.16)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  };
  const ic = <span className="ul-tg-icon" style={{ display: 'grid', width: '100%', height: '100%' }}>{on && iconOn ? iconOn : icon ?? <Icon name={KINDS[kind]} />}</span>;
  return (
    <ULActionButton {...rest} ref={btn} locale={locale} iconOnly aria-label={label} pressed={on} onPressedChange={() => {}} feedback="tooltip" successEffect="none"
      forceStatus={C.status === 'error' ? 'error' : undefined} data-coalesce={C.status}
      tooltip={on ? (labelOn ?? `${label}: ${actionText('on', locale)}`) : (labelOff ?? label)}
      icons={{ idle: ic, error: ic }} messages={{ error: actionText('changeFailed', locale) }}
      onPress={() => { C.set(!on); pop(); }}
      onKeyDown={(e) => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault(); rest.onKeyDown?.(e as never); }}
      onBlur={(e) => { if (flushOnBlur) C.flush(); rest.onBlur?.(e as never); }} />
  );
}

/* ---------------- Share ---------------- */
export interface ULShareButtonProps extends Base { /** URL to share / copy. */ url: string; /** Share sheet title (navigator.share). */ title?: string; /** Share sheet text (navigator.share). */ text?: string; /** Use navigator.share when available, else copy the link. Default true. */ preferNative?: boolean; /** Accessible / visible label. Default: localised ("Share" in English). */ label?: string }
export function ULShareButton({ url, title, text, preferNative = true, label, locale, ...rest }: ULShareButtonProps) {
  const L = (k: Parameters<typeof actionText>[0]) => actionText(k, locale);
  const how = React.useRef<'native' | 'copy'>('copy');
  return (
    <ULActionButton {...rest} locale={locale} feedback={rest.feedback ?? 'both'} minLoadingMs={0} icons={{ idle: <Icon name="share" />, ...rest.icons }}
      labels={{ idle: label ?? L('share'), loading: label ?? L('share'), success: L('shared'), error: L('retry'), ...rest.labels }}
      messages={{ success: () => (how.current === 'native' ? L('shared') : L('linkCopied')), error: L('copyFailed'), ...rest.messages }}
      aria-label={rest.iconOnly ? (label ?? L('share')) : rest['aria-label']} tooltip={rest.tooltip ?? (rest.iconOnly ? (label ?? L('share')) : undefined)}
      onAction={async () => {
        const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
        if (preferNative && nav.share) {
          how.current = 'native';
          try { await nav.share({ url, title, text }); return; } catch (e) { if ((e as Error)?.name === 'AbortError') throw ACTION_CANCEL; }
        }
        how.current = 'copy';
        await copyText(url);
      }} />
  );
}

/* ---------------- Undo toast ---------------- */
export interface ULUndoToastProps { /** Controlled open state. */ open: boolean; /** Called with false when the toast closes (timeout, undo, Esc). */ onOpenChange?: (o: boolean) => void; /** Trigger the toast morphs from (anchored morph). */ anchorRef: React.RefObject<HTMLElement | null>; /** Toast text (e.g. "3 invoices archived"). */ message: React.ReactNode; /** Undo handler; a promise shows loading on the Undo button. */ onUndo: () => Promise<unknown> | unknown; /** Auto-close after this many ms (paused on hover / focus). Default 5000. */ duration?: number; /** Undo button label. Default: localised ("Undo" in English). */ undoLabel?: string; /** "en" | "sk" | "de" | "cs". Default "en". */ locale?: string }
/** ULToast with Undo and a countdown ring; the toast's own timer and the ring pause on hover / focus. */
export function ULUndoToast({ open, onOpenChange, anchorRef, message, onUndo, duration = 5000, undoLabel, locale }: ULUndoToastProps) {
  const A = useAsyncAction(() => onUndo(), { minLoadingMs: 0, onSuccess: () => announce(actionText('undone', locale)), onError: () => announce(actionText('failed', locale)) });
  return (
    <ULToast open={open} onOpenChange={onOpenChange} anchorRef={anchorRef} duration={duration} tone="neutral"
      title={<span className="ul-act-undo"><Ring ms={duration} keyId={String(open)} /><span>{message}</span></span>}
      action={{ label: undoLabel ?? actionText('undo', locale), onAction: () => { void A.run(); } }} />
  );
}
export { ULActionButton, useAsyncAction, useActionTooltip, useCoalescedAction, actionText, announce, ACTION_CANCEL };
export type { ULActionButtonProps, ActionStatus };
