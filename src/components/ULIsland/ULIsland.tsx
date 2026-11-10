import * as React from 'react';
import { ULGlass } from '../../glass/ULGlass.tsx';
import { accentAttrs, type Accent, type AccentStrength } from '../../glass/accent.tsx';
import { setGlassGeometry, measureGlassNow } from '../../glass/engine.ts';
import { createSpring } from '../../motion/spring.ts';
import { ULAnchoredSurface } from '../ULAnchoredSurface/ULAnchoredSurface.tsx';
import { createNavIndicator } from './navIndicator.ts';
import { STUDIO_URL, type HeaderConfig } from './headerConfig.ts';
import { createAnchoredTooltip } from '../ULTooltip/anchoredTooltip.ts';
import './ULIsland.css';

export type IslandState = 'compact' | 'expanded' | 'notification';

export interface ULIslandProps extends React.HTMLAttributes<HTMLDivElement> {
  state?: IslandState;
  /**
   * Pill content in the compact state (and under an open notification).
   * Alternatively pass children with data-slot="compact" | "expanded" | "notification" | "tools".
   */
  compact?: React.ReactNode;
  /** Pill content in the expanded state (nav / menu). */
  expanded?: React.ReactNode;
  /** Surface that pours out of the pill in the notification state (shared anchored morph). */
  notification?: React.ReactNode;
  onDismiss?: () => void;
  /** Round controls beside the pill (use ULIslandTool). */
  tools?: React.ReactNode;
  accent?: Accent | null;
  /** Defaults to --ul-island-accent-strength (vivid) when an accent is set. */
  accentStrength?: AccentStrength;
  /** Accessible name for the pill (e.g. "Main"). */
  label?: string;
  /** Render the expanded face (leading, nav with floating indicator, CTA) and tools from one typed config. */
  config?: HeaderConfig;
  /** Current nav key (aria-current); the indicator rests on it when config.indicatorRest. */
  current?: string;
}

const LOGO = <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="M4 12 10 5h12l6 7-12 16z M4 12h24 M10 5l6 7 6-7 M16 12v16" /></svg>;
const BACK = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5 M12 19l-7-7 7-7" /></svg>;

/** Expanded face rendered from a HeaderConfig, with the floating liquid-glass nav indicator. */
function ConfigFace({ config, current }: { config: HeaderConfig; current?: string }) {
  const navRef = React.useRef<HTMLElement | null>(null);
  const lensRef = React.useRef<HTMLSpanElement | null>(null);
  const restRef = React.useRef(config.indicatorRest);
  restRef.current = config.indicatorRest;
  React.useEffect(() => {
    if (!navRef.current || !lensRef.current) return;
    const ind = createNavIndicator({ container: navRef.current, lens: lensRef.current, items: 'a[href], button', rest: () => (restRef.current ? navRef.current?.querySelector('[aria-current="page"]') as HTMLElement | null : null) });
    return () => ind.destroy();
  }, []);
  const lead = config.leading;
  return (
    <div className="ul-island-config">
      {lead.kind === 'back'
        ? <ULGlass as="a" materialCategory="chrome" href={lead.href} aria-label={lead.label} tier="sm" interactive pressable radius="50%" className="ul-island-back">{BACK}</ULGlass>
        : <a href={lead.href} aria-label={lead.label} className="ul-island-logo">{LOGO}</a>}
      <nav ref={navRef as React.RefObject<HTMLElement>} className="ul-island-nav" aria-label={config.variant === 'docs' ? 'Documentation' : 'Main'}>
        <ULGlass as="span" materialCategory="chrome" ref={lensRef as unknown as React.Ref<HTMLElement>} tier="sm" radius="var(--ul-radius-capsule)" className="ul-island-lens" aria-hidden="true" />
        <ul>
          {config.nav.map((n) => (
            <li key={n.key}>
              {n.menu
                ? <button type="button" aria-haspopup="true" aria-current={current === n.key ? 'page' : undefined}>{n.label}<span aria-hidden="true" className="ul-island-chev">▾</span></button>
                : <a href={n.href || '#'} aria-current={current === n.key ? 'page' : undefined}>{n.label}</a>}
            </li>
          ))}
        </ul>
      </nav>
      {config.cta ? <a className="ul-island-cta" href={config.cta.href}>{config.cta.label}</a> : null}
    </div>
  );
}

/** Underdamped spring whose first overshoot equals `os`, sampled to WAAPI keyframes. */
function overshootFrames(os: number, from: [number, number], to: [number, number], N = 36): Keyframe[] {
  const zeta = os <= 0 ? 1 : -Math.log(os) / Math.sqrt(Math.PI ** 2 + Math.log(os) ** 2);
  const sp = createSpring({ stiffness: 300, damping: 2 * zeta * Math.sqrt(300) });
  return Array.from({ length: N + 1 }, (_, i) => {
    const e = sp(i / N);
    return { offset: i / N, width: `${from[0] + (to[0] - from[0]) * e}px`, height: `${from[1] + (to[1] - from[1]) * e}px` };
  });
}

/**
 * Dynamic island: one interactive ULGlass pill whose content and size morph
 * between compact and expanded on the shared overshoot spring, plus a
 * notification surface that pours out of the pill via ULAnchoredSurface.
 * Elasticity is very subtle (--ul-island-elasticity × size tier × global).
 */
function slotsOf(children: React.ReactNode) {
  const out: Record<string, React.ReactNode> = {};
  const rest: React.ReactNode[] = [];
  React.Children.forEach(children, (ch) => {
    const slot = React.isValidElement(ch) ? (ch.props as Record<string, unknown>)['data-slot'] : undefined;
    if (typeof slot === 'string') out[slot] = ch; else if (ch != null && ch !== false) rest.push(ch);
  });
  return { out, rest };
}

export function ULIsland({ state = 'compact', compact, expanded, notification, onDismiss, tools, accent, accentStrength, label, config, current, className, style, children, ...rest }: ULIslandProps) {
  const sl = slotsOf(children);
  if (config && !expanded && !sl.out.expanded) expanded = <ConfigFace config={config} current={current} />;
  compact ??= sl.out.compact ?? (sl.rest.length ? sl.rest : null);
  expanded ??= sl.out.expanded;
  notification ??= sl.out.notification;
  tools ??= sl.out.tools;
  const pillRef = React.useRef<HTMLElement | null>(null);
  const size = React.useRef<[number, number] | null>(null);
  const anim = React.useRef<Animation | null>(null);
  const [elastic, setElastic] = React.useState<number | undefined>(undefined);
  const face = state === 'expanded' && expanded ? 'expanded' : 'compact';

  React.useLayoutEffect(() => {
    const v = parseFloat(getComputedStyle(pillRef.current ?? document.documentElement).getPropertyValue('--ul-island-elasticity'));
    if (Number.isFinite(v)) setElastic(v);
  }, []);

  // FLIP the pill between faces: measure the new natural size, animate from the old one.
  React.useLayoutEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    const cur = anim.current;
    let from = size.current;
    if (cur) { const r = el.getBoundingClientRect(); from = [r.width, r.height]; cur.cancel(); anim.current = null; }
    const to: [number, number] = [el.offsetWidth, el.offsetHeight];
    size.current = to;
    if (!from || (Math.abs(from[0] - to[0]) < 1 && Math.abs(from[1] - to[1]) < 1)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cs = getComputedStyle(el);
    const os = parseFloat(cs.getPropertyValue('--ul-pop-overshoot')) || 0.05;
    const dur = parseFloat(cs.getPropertyValue('--ul-pop-enter-duration')) || 500;
    el.setAttribute('data-ul-morphing', '');
    const a = el.animate(overshootFrames(os, from, to), { duration: dur, easing: 'linear' });
    anim.current = a;
    let raf = 0;
    const tick = () => { const r = el.getBoundingClientRect(); setGlassGeometry(el, el.offsetWidth ? r.width : undefined, r.height); raf = requestAnimationFrame(tick); };
    tick();
    const done = () => { cancelAnimationFrame(raf); if (anim.current === a) anim.current = null; el.removeAttribute('data-ul-morphing'); setGlassGeometry(el); measureGlassNow(el); };
    a.finished.then(done, done);
    return () => cancelAnimationFrame(raf);
  }, [face, config?.variant, config?.nav.length, config?.leading.kind]);

  if (config && !tools && !sl.out.tools && (config.poppers.length || config.studioLink)) {
    tools = <>{config.poppers.map((k) => <ULIslandTool key={k} aria-label="Language"><span className="ul-island-code">EN</span></ULIslandTool>)}{config.studioLink ? <ULIslandTool href={STUDIO_URL} aria-label="Go to studio" tip="Go to studio"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1.5" /><rect width="7" height="7" x="14" y="3" rx="1.5" /><rect width="7" height="7" x="14" y="14" rx="1.5" /><rect width="7" height="7" x="3" y="14" rx="1.5" /></svg></ULIslandTool> : null}</>;
  }
  accent ??= config?.accent ?? undefined;
  const acc = accentAttrs(accent, accentStrength);
  const islandStrength = accent && accentStrength == null;

  return (
    <div
      {...rest}
      className={className ? `ul-island ${className}` : 'ul-island'}
      data-ul-accent={acc['data-ul-accent']}
      data-ul-accent-strength={islandStrength ? 'custom' : acc['data-ul-accent-strength']}
      data-state={state}
      data-variant={config?.variant}
      style={{ ...(islandStrength ? { '--ul-accent-level': 'var(--ul-island-accent-strength)' } : null), ...acc.style, ...style } as React.CSSProperties}
    >
      <ULGlass ref={pillRef} as="nav" materialCategory="chrome" aria-label={label} data-ul-morph-occluder="" tier="sm" priority="island" interactive elasticity={elastic} className="ul-island-pill" radius="var(--ul-radius-capsule)">
        <div className="ul-island-track">
          <div className="ul-island-face" data-active={face === 'compact'} aria-hidden={face !== 'compact'} {...({ inert: face !== 'compact' ? '' : undefined } as Record<string, unknown>)}>{compact}</div>
          {expanded ? (
            <div className="ul-island-face" data-active={face === 'expanded'} aria-hidden={face !== 'expanded'} {...({ inert: face !== 'expanded' ? '' : undefined } as Record<string, unknown>)}>{expanded}</div>
          ) : null}
        </div>
      </ULGlass>
      {tools}
      {notification ? (
        <ULAnchoredSurface open={state === 'notification'} anchorRef={pillRef} onClose={onDismiss} side="bottom" align="center" tier="lg" role="status" aria-live="polite" closeOnOutside={!!onDismiss}>
          {notification}
        </ULAnchoredSurface>
      ) : null}
    </div>
  );
}

export interface ULIslandToolProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Render as a real link (e.g. the Studio entry). */
  href?: string;
  /** Hover/focus tooltip via the shared anchored tooltip (no title attribute). */
  tip?: string;
}

/** Round glass control beside the island (language, studio link). Elastic + pressable. */
export const ULIslandTool = React.forwardRef<HTMLElement, ULIslandToolProps>(function ULIslandTool({ active, className, children, href, tip, ...rest }, ref) {
  const [elastic, setElastic] = React.useState<number | undefined>(undefined);
  const own = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ul-island-elasticity'));
    if (Number.isFinite(v)) setElastic(v);
  }, []);
  React.useEffect(() => {
    const el = own.current, layer = (el?.offsetParent as HTMLElement | null) ?? el?.parentElement; // containing block of the absolute tooltip
    if (!tip || !el || !layer) return;
    const t = createAnchoredTooltip({ container: el, layer });
    return () => t.destroy();
  }, [tip]);
  const setRef = (el: HTMLElement | null) => { own.current = el; if (typeof ref === 'function') ref(el); else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el; };
  const tag = href ? { as: 'a', href } : { as: 'button', type: 'button' };
  return (
    <ULGlass ref={setRef} {...(tag as Record<string, unknown>)} materialCategory="chrome" data-ul-tip={tip} tier="sm" interactive pressable elasticity={elastic} radius="50%"
      className={className ? `ul-island-tool ${className}` : 'ul-island-tool'} data-active={active ? '' : undefined} {...rest}>
      {children}
    </ULGlass>
  );
});
