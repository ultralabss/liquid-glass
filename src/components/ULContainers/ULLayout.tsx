import * as React from 'react';
import { ULGlass } from '../../glass/ULGlass.tsx';
import { setGlassGeometry, releaseGlassTier } from '../../glass/engine.ts';
import { createNavIndicator, type NavIndicator } from '../ULIsland/navIndicator.ts';
import { isDev } from '../shared/dev.ts';
import { createAnchoredTooltip } from '../ULTooltip/anchoredTooltip.ts';
import { isMorphReduced, getMorphTimeScale, overshootEase } from '../../motion/anchoredMorph.ts';
import { springs } from '../../motion/spring.ts';
import { useMediaQuery } from '../../hooks/useReducedMotion.ts';
import { ULDrawer } from './ULOverlays.tsx';
import { ULMenu, type MenuItem } from './ULMenu.tsx';
import type { Accent, Backdrop } from '../../glass/accent.tsx';
import { Icon, ULIcon, cx, useDomId } from '../shared/icons.tsx';
import './ULContainers.css';
import { withContextMenu, splitCtx, useContextMenuTarget, mergeCtx, type ContextMenuProps } from './contextTarget.tsx';

const ms = (el: Element, k: string, f: number) => (parseFloat(getComputedStyle(el).getPropertyValue(k)) || f) * getMorphTimeScale();

/* =====================================================================
 * Accordion: header buttons (h3 > button, aria-expanded / aria-controls), region panels.
 * Height is MEASURED, then animated (WAAPI height on the smooth spring); interrupting starts from the current
 * height. Closed panels are `hidden` (not reachable, not in the a11y tree) and their content mounts on first open.
 * Keys: ↑ ↓ Home End move between headers; Enter / Space toggle. single (collapsible) or multiple.
 * ===================================================================== */
export interface AccordionItem { value: string; title: React.ReactNode; content: React.ReactNode; disabled?: boolean }
export interface ULAccordionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  items: AccordionItem[];
  type?: 'single' | 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (v: string[]) => void;
  /** single: allow closing the open item. Default true. */
  collapsible?: boolean;
  level?: 2 | 3 | 4;
}

function AccordionPanel({ id, labelledBy, open, children }: { id: string; labelledBy: string; open: boolean; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const anim = React.useRef<Animation | null>(null);
  const first = React.useRef(true);
  const [seen, setSeen] = React.useState(open);
  if (open && !seen) setSeen(true);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    if (first.current) { first.current = false; el.hidden = !open; return; }
    const from = el.hidden ? 0 : el.getBoundingClientRect().height; // current visual height (also mid-animation)
    anim.current?.cancel();
    el.hidden = false;
    const to = open ? el.scrollHeight : 0;
    if (isMorphReduced()) { el.hidden = !open; return; }
    const a = el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: ms(el, '--ul-accordion-duration', 420), easing: springs.smooth.toCSS() });
    anim.current = a;
    a.finished.then(() => { if (anim.current === a) { anim.current = null; if (!open) el.hidden = true; } }, () => {});
  }, [open]);
  return <div ref={ref} id={id} role="region" aria-labelledby={labelledBy} className="ul-accordion-panel"><div className="ul-accordion-inner">{seen ? children : null}</div></div>;
}

/** Accordion. contextMenu target: { component: 'accordion', kind: 'header', id: value, data: item } (headers only). */
export function ULAccordion(props: ULAccordionProps & ContextMenuProps<AccordionItem>) { const [c, rest] = splitCtx(props); return withContextMenu(<AccordionBase {...(rest as ULAccordionProps)} />, c, 'accordion', undefined, { selector: '.ul-accordion-trigger', kind: 'header', data: (id) => props.items.find((i) => i.value === id) }); }
function AccordionBase({ items, type = 'single', value, defaultValue, onValueChange, collapsible = true, level = 3, className, ...rest }: ULAccordionProps) {
  const [own, setOwn] = React.useState<string[]>(defaultValue ?? []);
  const v = value ?? own;
  const uid = useDomId('ul-acc');
  const root = React.useRef<HTMLDivElement | null>(null);
  const H = `h${level}` as 'h3';
  const toggle = (val: string) => {
    const on = v.includes(val);
    const next = type === 'multiple' ? (on ? v.filter((x) => x !== val) : [...v, val]) : on ? (collapsible ? [] : v) : [val];
    if (value === undefined) setOwn(next);
    onValueChange?.(next);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const hs = [...(root.current?.querySelectorAll<HTMLButtonElement>('.ul-accordion-trigger:not(:disabled)') ?? [])];
    const i = hs.indexOf(document.activeElement as HTMLButtonElement); if (i < 0) return;
    const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? hs.length - 1 : null;
    if (to === null) return;
    e.preventDefault(); hs[(to + hs.length) % hs.length].focus();
  };
  return (
    <div ref={root} {...rest} className={cx('ul-accordion', className)} onKeyDown={onKey}>
      {items.map((it) => {
        const open = v.includes(it.value);
        return (
          <div key={it.value} className="ul-accordion-item" data-open={open ? '' : undefined}>
            <H className="ul-accordion-h">
              <button type="button" id={`${uid}-h-${it.value}`} className="ul-accordion-trigger" data-value={it.value} aria-expanded={open} aria-controls={`${uid}-p-${it.value}`} disabled={it.disabled} onClick={() => toggle(it.value)}>
                <span className="ul-accordion-title">{it.title}</span>
                <span className="ul-accordion-chev" aria-hidden="true"><Icon name="chevron-down" /></span>
              </button>
            </H>
            <AccordionPanel id={`${uid}-p-${it.value}`} labelledBy={`${uid}-h-${it.value}`} open={open}>{it.content}</AccordionPanel>
          </div>
        );
      })}
    </div>
  );
}

/* =====================================================================
 * Sidebar: glass lg column (governor drops it to lite first), collapsible with an elastic WIDTH morph on the shared
 * overshoot spring (--ul-pop-overshoot); the map is rescaled per frame, regenerated once at the end. Labels fade;
 * collapsed items get tooltips (createAnchoredTooltip, side right). ↑ ↓ Home End move focus between items.
 * The floating indicator (createNavIndicator) rests on aria-current. ≤ 900px it renders as a left ULDrawer.
 * ===================================================================== */
export interface SidebarItem { id: string; label: string; icon?: React.ReactNode; href?: string; badge?: React.ReactNode; disabled?: boolean }
export interface SidebarSection { label?: string; items: SidebarItem[] }
export interface ULSidebarProps {
  sections: SidebarSection[];
  value?: string;
  onValueChange?: (id: string) => void;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (c: boolean) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  label?: string;
  /** auto: drawer ≤ 900px; always: always a drawer (open with mobileOpen); never. */
  drawer?: 'auto' | 'always' | 'never';
  mobileOpen?: boolean;
  onMobileOpenChange?: (o: boolean) => void;
  mobileTriggerRef?: React.RefObject<HTMLElement | null>;
  collapseLabel?: string;
  expandLabel?: string;
  accent?: Accent;
  backdrop?: Backdrop;
  className?: string;
}

function SidebarNav({ sections, value, onValueChange, collapsed, label, indRef }: Pick<ULSidebarProps, 'sections' | 'value' | 'onValueChange' | 'collapsed' | 'label'> & { indRef?: React.MutableRefObject<NavIndicator | null> }) {
  const nav = React.useRef<HTMLElement | null>(null), lens = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (!nav.current || !lens.current) return;
    const ind = createNavIndicator({ container: nav.current, lens: lens.current, items: '.ul-side-item', rest: () => nav.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? null });
    if (indRef) indRef.current = ind;
    // the lens (incl. its stretch) must never be clipped: the scroller needs padding ≥ the overgrow (same rule as the tabs indicator)
    if (isDev()) { const cs = getComputedStyle(nav.current), pad = Math.min(parseFloat(cs.paddingLeft), parseFloat(cs.paddingTop)); if (cs.overflow !== 'visible' && pad < 4) console.warn('[UL] ULSidebar: the nav scroller clips the indicator (padding < 4px). Keep .ul-side-nav padding ≥ the lens overgrow.', nav.current); }
    return () => { ind.destroy(); if (indRef) indRef.current = null; };
  }, []);
  React.useEffect(() => {
    if (!nav.current || !collapsed) return;
    const tip = createAnchoredTooltip({ container: nav.current, layer: document.body, side: 'right', delay: 200 });
    return () => tip.destroy();
  }, [collapsed]);
  const onKey = (e: React.KeyboardEvent) => {
    const f = [...(nav.current?.querySelectorAll<HTMLElement>('.ul-side-item:not([aria-disabled="true"])') ?? [])];
    const i = f.indexOf(document.activeElement as HTMLElement); if (i < 0) return;
    const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? f.length - 1 : null;
    if (to === null) return;
    e.preventDefault(); f[(to + f.length) % f.length].focus();
  };
  return (
    <nav ref={nav} aria-label={label} className="ul-side-nav" onKeyDown={onKey}>
      <ULGlass as="span" ref={lens} materialCategory="chrome" aria-hidden="true" tier="sm" radius="var(--ul-radius-md)" className="ul-menu-lens" />
      {sections.map((s, si) => (
        <div key={si} className="ul-side-section" role={s.label ? 'group' : undefined} aria-label={s.label}>
          {s.label ? <div className="ul-side-section-label" aria-hidden="true">{s.label}</div> : null}
          <ul className="ul-side-list">
            {s.items.map((it) => {
              const cur = it.id === value;
              const P = {
                className: 'ul-side-item', 'data-value': it.id, 'aria-current': cur ? ('page' as const) : undefined, 'aria-disabled': it.disabled || undefined,
                'data-ul-tip': collapsed ? it.label : undefined, 'aria-label': collapsed ? it.label : undefined,
                onClick: (e: React.MouseEvent) => { if (it.disabled) { e.preventDefault(); return; } onValueChange?.(it.id); },
              };
              const inner = (
                <>
                  <span className="ul-side-icon" aria-hidden="true">{it.icon ?? <Icon name="layout-grid" />}</span>
                  <span className="ul-side-label">{it.label}</span>
                  {it.badge != null ? <span className="ul-side-badge">{it.badge}</span> : null}
                </>
              );
              return <li key={it.id}>{it.href ? <a href={it.href} {...P}>{inner}</a> : <button type="button" {...P}>{inner}</button>}</li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sidebar. contextMenu target: { component: 'sidebar', kind: 'item', id, data: SidebarItem }. */
export function ULSidebar(props: ULSidebarProps & ContextMenuProps<SidebarItem>) { const [c, rest] = splitCtx(props); return withContextMenu(<SidebarBase {...(rest as ULSidebarProps)} />, c, 'sidebar', undefined, { selector: '.ul-side-item', kind: 'item', data: (id) => props.sections.flatMap((x) => x.items).find((x) => x.id === id) }, true); }
function SidebarBase({ sections, value, onValueChange, collapsed, defaultCollapsed = false, onCollapsedChange, header, footer, label = 'Main', drawer = 'auto', mobileOpen = false, onMobileOpenChange, mobileTriggerRef, collapseLabel = 'Collapse sidebar', expandLabel = 'Expand sidebar', accent, backdrop, className }: ULSidebarProps) {
  const narrow = useMediaQuery('(max-width: 900px)');
  const asDrawer = drawer === 'always' || (drawer === 'auto' && narrow);
  const [own, setOwn] = React.useState(defaultCollapsed);
  const c = collapsed ?? own;
  const el = React.useRef<HTMLElement | null>(null);
  const first = React.useRef(true);
  const navId = useDomId('ul-side');
  const ind = React.useRef<NavIndicator | null>(null);
  // elastic width morph (container motion on the shared overshoot spring, not an overlay enter / exit)
  React.useLayoutEffect(() => {
    const s = el.current; if (!s) return;
    if (first.current) { first.current = false; return; }
    const cs = getComputedStyle(s);
    const to = parseFloat(cs.getPropertyValue(c ? '--ul-sidebar-w-collapsed' : '--ul-sidebar-w')) || (c ? 72 : 260);
    const from = parseFloat((s as HTMLElement & { __w?: string }).dataset.w || '') || (c ? 260 : 72);
    s.dataset.w = String(to);
    if (isMorphReduced()) return;
    s.getAnimations().forEach((a) => { if ((a as Animation & { id: string }).id === 'ul-side-w') a.cancel(); });
    s.setAttribute('data-ul-morphing', '');
    ind.current?.setLayoutFollow(true); // rigid indicator while the width morphs
    const a = s.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration: ms(s, '--ul-sidebar-duration', 500), easing: overshootEase() });
    (a as Animation & { id: string }).id = 'ul-side-w';
    let raf = 0;
    const tick = () => { setGlassGeometry(s, s.offsetWidth, s.offsetHeight); raf = requestAnimationFrame(tick); };
    tick();
    const end = () => { cancelAnimationFrame(raf); s.removeAttribute('data-ul-morphing'); setGlassGeometry(s); releaseGlassTier(s); setTimeout(() => ind.current?.setLayoutFollow(false), 100); };
    a.finished.then(end, end);
    return () => cancelAnimationFrame(raf);
  }, [c]);
  const setC = (v: boolean) => { if (collapsed === undefined) setOwn(v); onCollapsedChange?.(v); };
  if (asDrawer) {
    return (
      <ULDrawer open={mobileOpen} onOpenChange={(o) => onMobileOpenChange?.(o)} side="left" title={label} triggerRef={mobileTriggerRef} accent={accent} backdrop={backdrop} className="ul-side-drawer">
        {header}
        <SidebarNav sections={sections} value={value} onValueChange={(id) => { onValueChange?.(id); onMobileOpenChange?.(false); }} collapsed={false} label={label} />
        {footer}
      </ULDrawer>
    );
  }
  return (
    <ULGlass as="aside" ref={el} materialCategory="chrome" tier="lg" padding="var(--ul-space-3)" accent={accent} backdrop={backdrop} aria-label={label} id={navId}
      data-collapsed={c ? '' : undefined} className={cx('ul-sidebar', className)}>
      <div className="ul-side-top">
        {header ? <div className="ul-side-header">{header}</div> : null}
        <button type="button" className="ul-side-toggle" aria-expanded={!c} aria-controls={navId} aria-label={c ? expandLabel : collapseLabel} data-ul-tip={c ? expandLabel : undefined} onClick={() => setC(!c)}>
          <Icon name={c ? 'chevron-right' : 'chevron-left'} />
        </button>
      </div>
      <SidebarNav sections={sections} value={value} onValueChange={onValueChange} collapsed={c} label={label} indRef={ind} />
      {footer ? <div className="ul-side-footer">{footer}</div> : null}
    </ULGlass>
  );
}

/* =====================================================================
 * Toolbar: role toolbar, ONE tab stop (roving tabindex, ← → Home End), groups (role group), and an overflow menu
 * ("More", ULMenu) for items that do not fit (measured with a ResizeObserver). Glass md bar; items are flat.
 * ===================================================================== */
export interface ToolbarItem { id: string; label: string; icon?: React.ReactNode; onSelect?: () => void; toggle?: boolean; pressed?: boolean; disabled?: boolean }
export interface ToolbarGroup { label: string; items: ToolbarItem[] }
export interface ULToolbarProps { groups: ToolbarGroup[]; label: string; moreLabel?: string; /** Show labels next to icons. Default false (icon + tooltip). */ labels?: boolean; accent?: Accent; backdrop?: Backdrop; className?: string; end?: React.ReactNode }

export function ULToolbar({ groups, label, moreLabel = 'More', labels = false, accent, backdrop, className, end }: ULToolbarProps) {
  const bar = React.useRef<HTMLDivElement | null>(null);
  const more = React.useRef<HTMLButtonElement | null>(null);
  const [fit, setFit] = React.useState(Infinity);
  const [focusIdx, setFocusIdx] = React.useState(0);
  const [menu, setMenu] = React.useState(false);
  const all = groups.flatMap((g, gi) => g.items.map((it) => ({ ...it, gi })));
  React.useLayoutEffect(() => {
    const b = bar.current; if (!b) return;
    const measure = () => {
      const items = [...b.querySelectorAll<HTMLElement>('[data-tb-item]')];
      const right = b.getBoundingClientRect().right - (more.current?.offsetWidth ?? 48) - 16 - ((b.querySelector('.ul-toolbar-end') as HTMLElement | null)?.offsetWidth ?? 0);
      let n = items.length;
      for (let i = 0; i < items.length; i++) { items[i].style.visibility = ''; if (items[i].getBoundingClientRect().right > right) { n = i; break; } }
      setFit((f) => (f === n ? f : n));
    };
    const ro = new ResizeObserver(() => { setFit(Infinity); requestAnimationFrame(measure); });
    ro.observe(b);
    measure();
    return () => ro.disconnect();
  }, [groups.length, all.length, labels]);
  const visibleCount = Math.min(fit, all.length);
  const overflow = all.slice(visibleCount);
  const stops = visibleCount + (overflow.length ? 1 : 0);
  const onKey = (e: React.KeyboardEvent) => {
    const to = e.key === 'ArrowRight' ? focusIdx + 1 : e.key === 'ArrowLeft' ? focusIdx - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? stops - 1 : null;
    if (to === null || !stops) return;
    e.preventDefault();
    const n = (to + stops) % stops;
    setFocusIdx(n);
    bar.current?.querySelector<HTMLElement>(`[data-tb-stop="${n}"]`)?.focus();
  };
  const tipBox = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => { if (labels || !bar.current) return; const t = createAnchoredTooltip({ container: bar.current, layer: document.body, side: 'bottom' }); return () => t.destroy(); }, [labels]);
  let k = -1;
  const menuItems: MenuItem[] = overflow.map((it) => ({ id: it.id, label: it.label, icon: it.icon, disabled: it.disabled, type: it.toggle ? 'checkbox' : 'item', checked: it.pressed, onSelect: it.onSelect }));
  return (
    <ULGlass ref={bar as React.Ref<HTMLElement>} materialCategory="chrome" tier="md" padding="var(--ul-space-1) var(--ul-space-2)" radius="var(--ul-radius-xl)" accent={accent} backdrop={backdrop}
      role="toolbar" aria-label={label} aria-orientation="horizontal" className={cx('ul-toolbar', className)} onKeyDown={onKey}>
      <div ref={tipBox} className="ul-toolbar-groups">
        {groups.map((g, gi) => (
          <div key={gi} role="group" aria-label={g.label} className="ul-toolbar-group">
            {g.items.map((it) => {
              k++; const i = k, hidden = i >= visibleCount;
              return (
                <button key={it.id} type="button" data-tb-item="" data-tb-stop={hidden ? undefined : i} tabIndex={hidden ? -1 : i === focusIdx ? 0 : -1} hidden={hidden && fit !== Infinity}
                  className="ul-toolbar-btn" aria-pressed={it.toggle ? !!it.pressed : undefined} aria-label={labels ? undefined : it.label} data-ul-tip={labels ? undefined : it.label}
                  disabled={it.disabled} onClick={() => { setFocusIdx(i); it.onSelect?.(); }} style={hidden && fit === Infinity ? { visibility: 'hidden' } : undefined}>
                  {it.icon ? <span className="ul-btn-icon" aria-hidden="true">{it.icon}</span> : null}
                  {labels || !it.icon ? <span>{it.label}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {overflow.length ? (
        <button ref={more} type="button" className="ul-toolbar-btn" data-tb-stop={visibleCount} tabIndex={focusIdx === visibleCount ? 0 : -1} aria-haspopup="menu" aria-expanded={menu}
          aria-label={moreLabel} data-ul-tip={moreLabel} onClick={() => { setFocusIdx(visibleCount); setMenu((m) => !m); }}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setMenu(true); } }}>
          <span className="ul-btn-icon" aria-hidden="true"><ULIcon filled><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></ULIcon></span>
        </button>
      ) : <span ref={more as React.Ref<HTMLSpanElement>} className="ul-toolbar-more-sizer" aria-hidden="true"></span>}
      {end ? <div className="ul-toolbar-end">{end}</div> : null}
      <ULMenu open={menu} onOpenChange={setMenu} anchorRef={more} items={menuItems} label={moreLabel} align="end" />
    </ULGlass>
  );
}
