import * as React from 'react';
import { cx, useDomId } from '../shared/icons.tsx';
import { ULMenu, type MenuItem } from '../ULContainers/ULMenu.tsx';
import { createNavIndicator } from '../ULIsland/navIndicator.ts';
import './batch2.css';

export interface MenubarMenu { id: string; label: string; items: MenuItem[]; disabled?: boolean }
export interface ULMenubarProps {
  menus: MenubarMenu[];
  /** Accessible name of the bar. */
  label?: string;
  onAction?: (menuId: string, itemId: string, item: MenuItem) => void;
  /** Label of the back row when a submenu drills in (phones). */
  backLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
  /** @internal tests: surface of the open menu */
  surfaceRef?: React.MutableRefObject<HTMLElement | null>;
}

/**
 * Menubar: a flat paint bar of menu triggers (role menubar), the shared nav indicator follows hover / focus.
 * Each trigger owns one ULMenu (anchored morph; submenus beside with the 2px gap, drill-in on phones; check items = ULCheckMark; shortcuts = ULKbd).
 * Keys on the bar: ← → (wrap) Home End move, Enter / Space / ↓ open on the first item, ↑ on the last.
 * While a menu is open, ← → inside it (when no submenu handles the key) or hovering another trigger switch menus at once:
 * the old surface exits and the new one enters with no delay (AnchoredMorph has no re-anchor; overlay code is frozen).
 */
export function ULMenubar({ menus, label, onAction, backLabel, size = 'md', className, surfaceRef }: ULMenubarProps) {
  const id = useDomId('ul-mbar');
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [initial, setInitial] = React.useState<'first' | 'last'>('first');
  const [focusIdx, setFocusIdx] = React.useState(0);
  const bar = React.useRef<HTMLDivElement | null>(null), lens = React.useRef<HTMLSpanElement | null>(null);
  const refs = React.useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({});
  for (const m of menus) refs.current[m.id] ??= React.createRef<HTMLButtonElement>();
  const enabled = menus.map((m, i) => (m.disabled ? -1 : i)).filter((i) => i >= 0);
  const openRef = React.useRef(openId); openRef.current = openId;
  React.useEffect(() => { if (!bar.current || !lens.current) return; const ind = createNavIndicator({ container: bar.current, lens: lens.current, items: '[role="menuitem"]:not([aria-disabled="true"])', rest: () => (openRef.current ? refs.current[openRef.current]?.current ?? null : null) }); return () => ind.destroy(); }, [menus.length]);
  const move = (from: number, d: number | 'home' | 'end') => {
    if (!enabled.length) return from;
    const at = enabled.indexOf(from);
    const n = d === 'home' ? enabled[0] : d === 'end' ? enabled[enabled.length - 1] : enabled[((at < 0 ? 0 : at) + d + enabled.length) % enabled.length];
    setFocusIdx(n); refs.current[menus[n].id]?.current?.focus({ preventScroll: true }); return n;
  };
  const openAt = (i: number, first: 'first' | 'last' = 'first') => { setInitial(first); setFocusIdx(i); setOpenId(menus[i].id); };
  // ← → inside an open menu (not consumed by a submenu) switch to the neighbouring menu
  React.useEffect(() => {
    if (!openId) return;
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      const a = document.activeElement as HTMLElement | null; if (!a || !a.closest('.ul-menu-surface')) return;
      e.preventDefault();
      const cur = menus.findIndex((m) => m.id === openRef.current); const n = move(cur, e.key === 'ArrowRight' ? 1 : -1); openAt(n);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [openId, menus]);
  const onKey = (i: number) => (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); { const n = move(i, 1); if (openId) openAt(n); } return;
      case 'ArrowLeft': e.preventDefault(); { const n = move(i, -1); if (openId) openAt(n); } return;
      case 'Home': e.preventDefault(); move(i, 'home'); return;
      case 'End': e.preventDefault(); move(i, 'end'); return;
      case 'ArrowDown': case 'Enter': case ' ': e.preventDefault(); openAt(i, 'first'); return;
      case 'ArrowUp': e.preventDefault(); openAt(i, 'last'); return;
    }
  };
  return (
    <div ref={bar} role="menubar" aria-label={label} aria-orientation="horizontal" id={id} className={cx('ul-menubar', className)} data-size={size} data-ul-allow-overflow="">
      <span ref={lens} aria-hidden="true" className="ul-menubar-lens"></span>
      {menus.map((m, i) => (
        <React.Fragment key={m.id}>
          <button ref={refs.current[m.id]} type="button" role="menuitem" className="ul-menubar-trigger" tabIndex={i === (enabled.includes(focusIdx) ? focusIdx : enabled[0]) ? 0 : -1}
            aria-haspopup="menu" aria-expanded={openId === m.id} aria-disabled={m.disabled || undefined} data-open={openId === m.id ? '' : undefined} data-menubar-id={m.id}
            onClick={() => { if (m.disabled) return; setFocusIdx(i); setInitial('first'); setOpenId((o) => (o === m.id ? null : m.id)); }}
            onPointerEnter={(e) => { if (e.pointerType !== 'touch' && openRef.current && openRef.current !== m.id && !m.disabled) openAt(i); }}
            onFocus={() => setFocusIdx(i)} onKeyDown={m.disabled ? undefined : onKey(i)}>
            <span className="ul-menubar-text">{m.label}</span>
          </button>
          <ULMenu open={openId === m.id} onOpenChange={(o) => { if (!o) setOpenId((cur) => (cur === m.id ? null : cur)); }} anchorRef={refs.current[m.id]} items={m.items} label={m.label}
            side="bottom" align="start" initialFocus={initial} backLabel={backLabel} surfaceRef={openId === m.id ? surfaceRef : undefined}
            onAction={(itemId, it) => onAction?.(m.id, itemId, it)} />
        </React.Fragment>
      ))}
    </div>
  );
}
