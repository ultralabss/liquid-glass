import * as React from 'react';
import type { Accent } from '../../glass/accent.tsx';
import { accentAttrs } from '../../glass/accent.tsx';
import { createLensSelect, type LensSelect } from '../../motion/lensSelect.ts';
import { cx, useDomId } from '../shared/icons.tsx';
import '../shared/lens.css';
import './ULTabs.css';
import { withContextMenu, splitCtx, type ContextMenuProps } from '../ULContainers/contextTarget.tsx';

/* =====================================================================
 * Tabs: an inset tab list (not glass) with a flat resting indicator and the shared lens bubble (createLensSelect).
 * Click / keyboard: the indicator floats to the new tab as the bubble. Press and hold anywhere in the list: the bubble
 * appears on the indicator or glides to the pressed tab; drag moves it (rubber band past the ends); the tab under it is
 * previewed; release selects the nearest tab (+ flick). aria-selected and the panel change only on release.
 * Esc / pointercancel restore. Keys: arrows (by orientation) move focus AND select, Home / End; roving tabindex.
 * ===================================================================== */
export interface TabItem { value: string; label: React.ReactNode; content?: React.ReactNode; disabled?: boolean; icon?: React.ReactNode }
export interface ULTabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** Tabs ({ value, label, content?, icon?, disabled? }); a panel renders only for items with content. */ items: TabItem[];
  /** Controlled selected tab value. */ value?: string;
  /** Initial tab when uncontrolled. Default the first enabled tab. */ defaultValue?: string;
  /** Called with the selected tab value (click, arrows, Home / End). */ onValueChange?: (v: string) => void;
  /** "horizontal" (default) | "vertical"; arrow keys follow it. */ orientation?: 'horizontal' | 'vertical';
  /** Lens bubble on press / drag / selection changes. Default true. */
  lens?: boolean;
  /** Accent colour: accent name ("violet", "ice", "emerald", "amber", "rose") or a CSS colour (checked by guardAccent). */ accent?: Accent;
  /** Accessible name of the tab list. */
  'aria-label'?: string;
  /** Panels mount lazily on first visit; keepMounted keeps visited panels mounted (hidden) instead of unmounting them. */
  keepMounted?: boolean;
}

/** Tabs. contextMenu target: { component: 'tabs', kind: 'tab', id: value, data: TabItem } (tab headers only). */
export function ULTabs(props: ULTabsProps & ContextMenuProps<TabItem>) { const [c, rest] = splitCtx(props); return withContextMenu(<TabsBase {...(rest as ULTabsProps)} />, c, 'tabs', undefined, { selector: '[role="tab"]', kind: 'tab', data: (id) => props.items.find((i) => i.value === id) }); }
function TabsBase({ items, value, defaultValue, onValueChange, orientation = 'horizontal', lens = true, accent, keepMounted = false, className, 'aria-label': ariaLabel, ...rest }: ULTabsProps) {
  const [own, setOwn] = React.useState(defaultValue ?? items.find((i) => !i.disabled)?.value);
  const v = value ?? own;
  const uid = useDomId('ul-tabs');
  const vert = orientation === 'vertical';
  const list = React.useRef<HTMLDivElement | null>(null);
  const sel = React.useRef<LensSelect | null>(null);
  const prevSel = React.useRef<HTMLElement | null>(null);
  const fromDrag = React.useRef(false);
  const viaKey = React.useRef(false);
  const lensOn = React.useRef(lens); lensOn.current = lens;
  const pick = (val: string, focus = false) => {
    if (value === undefined) setOwn(val);
    onValueChange?.(val);
    if (focus) requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(val)}"]`)?.focus());
  };
  const pickRef = React.useRef(pick); pickRef.current = pick;
  React.useEffect(() => {
    const l = list.current;
    if (!l) return;
    sel.current = createLensSelect({
      list: l, axis: vert ? 'y' : 'x', items: () => [...l.querySelectorAll<HTMLElement>('[data-ul-lens-item]:not(:disabled)')],
      selected: () => l.querySelector<HTMLElement>('[aria-selected="true"]'),
      onSelect: (el) => { fromDrag.current = true; pickRef.current(el.dataset.value!); }, enabled: () => lensOn.current,
    });
    prevSel.current = l.querySelector<HTMLElement>('[aria-selected="true"]');
    return () => { sel.current?.destroy(); sel.current = null; };
  }, [vert]);
  React.useLayoutEffect(() => {
    const now = list.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? null;
    if (!fromDrag.current && prevSel.current && now && now !== prevSel.current) sel.current?.travel(prevSel.current, now, viaKey.current ? 'key' : 'click');
    else if (now) sel.current?.syncRest();
    viaKey.current = false;
    fromDrag.current = false;
    prevSel.current = now;
  }, [v]);
  const enabled = items.filter((i) => !i.disabled);
  const onKey = (e: React.KeyboardEvent) => {
    const i = enabled.findIndex((o) => o.value === v), n = enabled.length;
    const next = vert ? ['ArrowDown'] : ['ArrowRight'], prev = vert ? ['ArrowUp'] : ['ArrowLeft'];
    const to = next.includes(e.key) ? (i + 1) % n : prev.includes(e.key) ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to < 0 || !n) return;
    e.preventDefault();
    viaKey.current = true;
    pick(enabled[to].value, true);
  };
  const acc = accentAttrs(accent);
  const current = items.find((i) => i.value === v);
  const visited = React.useRef(new Set<string>());
  if (v) visited.current.add(v);
  const panel = (it: TabItem, on: boolean) => (
    <div key={it.value} id={`${uid}-p-${it.value}`} role="tabpanel" aria-labelledby={`${uid}-t-${it.value}`} tabIndex={0} hidden={!on} className="ul-tabs-panel">{it.content}</div>
  );
  return (
    <div {...rest} className={cx('ul-tabs', className)} data-orientation={orientation} data-ul-accent={acc['data-ul-accent']} style={{ ...acc.style, ...rest.style } as React.CSSProperties}>
      <div ref={list} role="tablist" aria-label={ariaLabel} aria-orientation={orientation} className="ul-tabs-list" onKeyDown={onKey}>
        {items.map((it) => {
          const on = it.value === v;
          return (
            <button key={it.value} id={`${uid}-t-${it.value}`} type="button" role="tab" aria-selected={on} aria-controls={it.content !== undefined && (on || (keepMounted && visited.current.has(it.value))) ? `${uid}-p-${it.value}` : undefined} tabIndex={on ? 0 : -1}
              disabled={it.disabled} data-value={it.value} data-ul-lens-item="" className="ul-tab"
              onClick={() => { if (sel.current?.consumeClick()) return; pick(it.value); }}>
              {it.icon ? <span className="ul-tab-icon" aria-hidden="true">{it.icon}</span> : null}
              <span className="ul-tab-label">{it.label}</span>
            </button>
          );
        })}
      </div>
      {keepMounted
        ? items.filter((it) => it.content !== undefined && visited.current.has(it.value)).map((it) => panel(it, it.value === v))
        : current && current.content !== undefined ? panel(current, true) : null}
    </div>
  );
}
