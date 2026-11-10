import * as React from 'react';
import { cx, useDomId, ULIcon } from '../shared/icons.tsx';
import { ULAnchoredSurface } from '../ULAnchoredSurface/ULAnchoredSurface.tsx';
import { ULSheet } from '../ULContainers/ULOverlays.tsx';
import { useDialog } from '../ULContainers/ULDialog.tsx';
import { ULItem } from '../ULStructure/structure.tsx';
import { createNavIndicator } from '../ULIsland/navIndicator.ts';
import { runViewSwap, cancelSwap, newSwapAnims, type SwapAnims } from '../../motion/viewSwap.ts';
import type { AnchoredMorph } from '../../motion/anchoredMorph.ts';
import { useMediaQuery } from '../../hooks/useReducedMotion.ts';
import './batch2.css';

export interface NavLink { id: string; title: string; description?: string; href: string; icon?: string; current?: boolean }
export interface NavMenuItem {
  id: string; label: string;
  /** Link item. */
  href?: string;
  /** Marks the current page (aria-current="page"); the indicator rests on it. */
  current?: boolean;
  /** Trigger item: opens a panel with a grid of links. */
  panel?: { links: NavLink[]; /** min column width in px (auto-fill grid). Default 220. */ minColumn?: number; footer?: React.ReactNode };
}
type L = 'en' | 'sk' | 'de' | 'cs';
const T: Record<L, { menu: string; nav: string; back: string; close: string }> = {
  en: { menu: 'Menu', nav: 'Main', back: 'Back', close: 'Close' },
  sk: { menu: 'Menu', nav: 'Hlavná navigácia', back: 'Späť', close: 'Zavrieť' },
  de: { menu: 'Menü', nav: 'Hauptnavigation', back: 'Zurück', close: 'Schließen' },
  cs: { menu: 'Menu', nav: 'Hlavní navigace', back: 'Zpět', close: 'Zavřít' },
};
const loc = (l?: string): L => { const k = (l || (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'en').slice(0, 2).toLowerCase(); return (['en', 'sk', 'de', 'cs'].includes(k) ? k : 'en') as L; };

export interface ULNavigationMenuProps {
  items: NavMenuItem[];
  /** Accessible name of the <nav>. */
  label?: string;
  /** In-app routing: called on link activation (call e.preventDefault() to route yourself). */
  onNavigate?: (e: React.MouseEvent, link: { id: string; href: string }) => void;
  /** Below this width (px) the bar collapses into a button + bottom sheet with drill-in. Default 640. */
  collapseBelow?: number;
  locale?: string;
  /** Sheet title on phones. Default the nav label. */
  sheetTitle?: string;
  className?: string;
  /** @internal tests: the open panel surface */
  surfaceRef?: React.MutableRefObject<HTMLElement | null>;
}

function PanelGrid({ item, onNavigate, idp }: { item: NavMenuItem; onNavigate?: ULNavigationMenuProps['onNavigate']; idp?: string }) {
  const p = item.panel!;
  return (
    <div className="ul-navmenu-grid" style={{ '--ul-navmenu-col': `${p.minColumn ?? 220}px` } as React.CSSProperties}>
      {p.links.map((l) => (
        <ULItem key={l.id} id={idp ? `${idp}-${l.id}` : undefined} title={l.title} description={l.description} href={l.href} size="sm" descriptionLines={2}
          media={l.icon ? <ULIcon name={l.icon} size="md" /> : undefined}
          onClick={onNavigate ? ((e: React.MouseEvent) => onNavigate(e, { id: l.id, href: l.href })) as unknown as () => void : undefined} />
      ))}
      {p.footer ? <div className="ul-navmenu-foot">{p.footer}</div> : null}
    </div>
  );
}

/**
 * Navigation menu: <nav> with link items and trigger items that open a panel (grid of ULItem links).
 * Desktop: one ULAnchoredSurface anchored to the bar (anchored morph, scroll follow); switching panels runs the shared
 * runViewSwap on the same surface (no second overlay). Shared nav indicator follows hover / focus and rests on the current item.
 * Keys: ← → Home End between top items, ↓ / Enter / Space on a trigger opens its panel (↓ focuses the first link), Esc closes and
 * returns focus, Tab runs through the links (Tab after the last link closes and moves on). Below collapseBelow: a Menu button opens
 * a bottom sheet; trigger items drill in through the dialog context (useDialog().push), links come from props only.
 */
export function ULNavigationMenu(props: ULNavigationMenuProps) {
  const { items, label, collapseBelow = 640, locale } = props;
  const narrow = useMediaQuery(`(max-width: ${collapseBelow - 0.02}px)`);
  const t = T[loc(locale)];
  return narrow ? <NavSheet {...props} t={t} /> : <NavBar {...props} label={label ?? t.nav} />;
}

function NavBar({ items, label, onNavigate, className, surfaceRef }: ULNavigationMenuProps) {
  const id = useDomId('ul-navm');
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [leaving, setLeaving] = React.useState<string | null>(null);
  const nav = React.useRef<HTMLElement | null>(null), list = React.useRef<HTMLUListElement | null>(null), lens = React.useRef<HTMLSpanElement | null>(null);
  const surf = React.useRef<HTMLElement | null>(null), morphRef = React.useRef<AnchoredMorph | null>(null), swapA = React.useRef<SwapAnims>(newSwapAnims());
  const sref = React.useMemo(() => ({ get current() { return surf.current; }, set current(v: HTMLElement | null) { surf.current = v; if (surfaceRef) surfaceRef.current = v; } }), [surfaceRef]) as React.MutableRefObject<HTMLElement | null>;
  const panelEls = React.useRef(new Map<string, HTMLElement>()), dir = React.useRef<1 | -1>(1), focusFirst = React.useRef(false);
  const openRef = React.useRef(openId); openRef.current = openId;
  const tops = () => [...(list.current?.querySelectorAll<HTMLElement>(':scope > li > .ul-navmenu-top') ?? [])];
  React.useEffect(() => {
    if (!nav.current || !list.current || !lens.current) return;
    const ind = createNavIndicator({ container: nav.current, lens: lens.current, items: '.ul-navmenu-list > li > .ul-navmenu-top', rest: () => (openRef.current ? list.current?.querySelector<HTMLElement>(`[data-navm-id="${openRef.current}"]`) : null) ?? list.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? null });
    return () => ind.destroy();
  }, [items.length]);
  const open = (next: string | null, viaKey = false) => {
    const cur = openRef.current; if (next === cur) return;
    if (cur && next) { const a = items.findIndex((i) => i.id === cur), b = items.findIndex((i) => i.id === next); dir.current = b >= a ? 1 : -1; setLeaving(cur); }
    focusFirst.current = viaKey; setOpenId(next);
  };
  // same-surface panel swap (shared viewSwap, as dialog push / menu drill-in)
  React.useLayoutEffect(() => {
    const s = surf.current; if (!s || !leaving || !openId || leaving === openId) return;
    const X = panelEls.current.get(leaving), Y = panelEls.current.get(openId); if (!Y) { setLeaving(null); return; }
    runViewSwap({ surface: s, from: X, to: Y, dir: dir.current, morph: morphRef.current, anims: swapA.current, onDone: () => setLeaving(null) });
  }, [openId]);
  React.useEffect(() => { if (!openId) { cancelSwap(swapA.current); setLeaving(null); } }, [openId]);
  React.useEffect(() => {
    if (!openId || !focusFirst.current) return;
    let n = 0; const f = () => { const el = panelEls.current.get(openId)?.querySelector<HTMLElement>('a[href], button'); if (el) el.focus({ preventScroll: true }); else if (n++ < 30) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }, [openId]);
  const close = (refocus: boolean) => { const cur = openRef.current; setOpenId(null); if (refocus && cur) requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-navm-id="${cur}"]`)?.focus({ preventScroll: true })); };
  const onTopKey = (i: number, it: NavMenuItem) => (e: React.KeyboardEvent) => {
    const all = tops(); const go = (j: number) => { all[(j + all.length) % all.length]?.focus({ preventScroll: true }); };
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); go(i + 1); if (openRef.current) { const n = items[(i + 1) % items.length]; open(n.panel ? n.id : null); } return;
      case 'ArrowLeft': e.preventDefault(); go(i - 1); if (openRef.current) { const n = items[(i - 1 + items.length) % items.length]; open(n.panel ? n.id : null); } return;
      case 'Home': e.preventDefault(); go(0); return;
      case 'End': e.preventDefault(); go(all.length - 1); return;
      case 'ArrowDown': if (it.panel) { e.preventDefault(); if (openRef.current === it.id) { focusFirst.current = true; panelEls.current.get(it.id)?.querySelector<HTMLElement>('a[href], button')?.focus(); } else open(it.id, true); } return;
      case 'Escape': if (openRef.current) { e.preventDefault(); close(true); } return;
      case 'Tab': if (!e.shiftKey && it.panel && openRef.current === it.id) { const f = panelEls.current.get(it.id)?.querySelector<HTMLElement>('a[href], button'); if (f) { e.preventDefault(); f.focus({ preventScroll: true }); } } return;
    }
  };
  // Tab past the last link in the panel: close and continue after the trigger
  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !openRef.current) return;
    const p = panelEls.current.get(openRef.current); const f = [...(p?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])];
    const trig = list.current?.querySelector<HTMLElement>(`[data-navm-id="${openRef.current}"]`); const all = tops(); const ti = trig ? all.indexOf(trig) : -1;
    if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); close(false); (all[ti + 1] ?? trig)?.focus({ preventScroll: true }); }
    else if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); trig?.focus({ preventScroll: true }); }
  };
  const shown = items.filter((it) => it.panel && (it.id === openId || it.id === leaving));
  const cur = items.find((it) => it.id === openId);
  return (
    <nav ref={nav} aria-label={label} className={cx('ul-navmenu', className)}>
      <span ref={lens} aria-hidden="true" className="ul-navmenu-lens"></span>
      <ul ref={list} className="ul-navmenu-list" data-ul-allow-overflow="">
        {items.map((it, i) => (
          <li key={it.id}>
            {it.panel ? (
              <button type="button" className="ul-navmenu-top" data-navm-id={it.id} aria-expanded={openId === it.id} aria-controls={openId === it.id ? `${id}-panel` : undefined}
                data-open={openId === it.id ? '' : undefined} data-current={it.current ? '' : undefined}
                onClick={() => open(openId === it.id ? null : it.id)} onKeyDown={onTopKey(i, it)}
                onPointerEnter={(e) => { if (e.pointerType !== 'touch' && openRef.current && openRef.current !== it.id) open(it.id); }}>
                <span className="ul-navmenu-text">{it.label}</span><ULIcon name="chevron-down" size="xs" className="ul-navmenu-chev" />
              </button>
            ) : (
              <a className="ul-navmenu-top" data-navm-id={it.id} href={it.href} aria-current={it.current ? 'page' : undefined} onKeyDown={onTopKey(i, it)}
                onClick={onNavigate && it.href ? (e) => onNavigate(e, { id: it.id, href: it.href! }) : undefined}
                onPointerEnter={(e) => { if (e.pointerType !== 'touch' && openRef.current) open(null); }}>
                <span className="ul-navmenu-text">{it.label}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
      <ULAnchoredSurface open={!!openId} anchorRef={nav} onClose={() => close(true)} id={`${id}-panel`} role="region" aria-label={cur?.label}
        side="bottom" align="start" scrollBehavior="follow" onAnchorHidden="keep" tier="lg" padding="var(--ul-space-3)" surfaceRef={sref} morphRef={morphRef} className="ul-navmenu-panel">
        <div className="ul-navmenu-views" onKeyDown={onPanelKey}>
          {shown.map((it) => (
            <div key={it.id} ref={(n) => { if (n) panelEls.current.set(it.id, n); else panelEls.current.delete(it.id); }} className="ul-navmenu-view" data-panel={it.id}
              hidden={it.id !== openId && it.id !== leaving} {...(it.id !== openId ? { inert: '' } as Record<string, string> : {})}>
              <PanelGrid item={it} onNavigate={onNavigate} />
            </div>
          ))}
        </div>
      </ULAnchoredSurface>
    </nav>
  );
}

function SheetList({ items, onNavigate, t }: ULNavigationMenuProps & { t: typeof T.en }) {
  const dlg = useDialog();
  return (
    <ul className="ul-navmenu-sheet-list">
      {items.map((it) => (
        <li key={it.id}>
          {it.panel ? (
            <button type="button" className="ul-navmenu-row" data-navm-id={it.id} data-current={it.current ? '' : undefined}
              onClick={() => dlg.push({ key: it.id, title: it.label, content: <PanelGrid item={{ ...it, panel: { ...it.panel!, minColumn: 10000 } }} onNavigate={onNavigate} /> })}>
              <span className="ul-navmenu-text">{it.label}</span><ULIcon name="chevron-right" size="sm" className="ul-navmenu-chev" />
            </button>
          ) : (
            <a className="ul-navmenu-row" data-navm-id={it.id} href={it.href} aria-current={it.current ? 'page' : undefined} onClick={onNavigate && it.href ? (e) => onNavigate(e, { id: it.id, href: it.href! }) : undefined}>
              <span className="ul-navmenu-text">{it.label}</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
function NavSheet(p: ULNavigationMenuProps & { t: typeof T.en }) {
  const [open, setOpen] = React.useState(false); const btn = React.useRef<HTMLButtonElement | null>(null);
  return (
    <nav aria-label={p.label ?? p.t.nav} className={cx('ul-navmenu', p.className)} data-collapsed="">
      <button ref={btn} type="button" className="ul-navmenu-burger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <ULIcon name="menu" size="md" /><span>{p.t.menu}</span>
      </button>
      <ULSheet open={open} onOpenChange={setOpen} triggerRef={btn} title={p.sheetTitle ?? p.label ?? p.t.nav} closeLabel={p.t.close}>
        <SheetList {...p} />
      </ULSheet>
    </nav>
  );
}
