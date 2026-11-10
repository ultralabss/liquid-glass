import * as React from 'react';
import { cx, useDomId, ULIcon } from '../shared/icons.tsx';
import { ULButton } from '../ULButton/ULButton.tsx';
import { createNavIndicator } from '../ULIsland/navIndicator.ts';
import { useReducedMotion } from '../../hooks/useReducedMotion.ts';
import './batch2.css';

type L = 'en' | 'sk' | 'de' | 'cs';
const T: Record<L, { carousel: string; slide: string; of: (n: number, N: number) => string; prev: string; next: string; go: (n: number) => string; pause: string; play: string; slides: string }> = {
  en: { carousel: 'carousel', slide: 'slide', of: (n, N) => `${n} of ${N}`, prev: 'Previous slide', next: 'Next slide', go: (n) => `Go to slide ${n}`, pause: 'Pause autoplay', play: 'Start autoplay', slides: 'Slides' },
  sk: { carousel: 'karusel', slide: 'snímka', of: (n, N) => `${n} z ${N}`, prev: 'Predchádzajúca snímka', next: 'Ďalšia snímka', go: (n) => `Prejsť na snímku ${n}`, pause: 'Pozastaviť prehrávanie', play: 'Spustiť prehrávanie', slides: 'Snímky' },
  de: { carousel: 'Karussell', slide: 'Folie', of: (n, N) => `${n} von ${N}`, prev: 'Vorherige Folie', next: 'Nächste Folie', go: (n) => `Zu Folie ${n}`, pause: 'Autoplay anhalten', play: 'Autoplay starten', slides: 'Folien' },
  cs: { carousel: 'karusel', slide: 'snímek', of: (n, N) => `${n} z ${N}`, prev: 'Předchozí snímek', next: 'Další snímek', go: (n) => `Přejít na snímek ${n}`, pause: 'Pozastavit přehrávání', play: 'Spustit přehrávání', slides: 'Snímky' },
};
const loc = (l?: string): L => { const k = (l || (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'en').slice(0, 2).toLowerCase(); return (['en', 'sk', 'de', 'cs'].includes(k) ? k : 'en') as L; };

export interface ULCarouselProps {
  children: React.ReactNode;
  /** Accessible name of the region. */
  label: string;
  /** Slides visible at once (default 1). */
  visible?: number;
  /** Next on the last position goes to the first (and back). Default false. */
  loop?: boolean;
  /** Autoplay interval in ms. Off by default; never runs under reduced motion; pauses on hover and focus. */
  autoplay?: number | false;
  /** Gap between slides (CSS length). Default var(--ul-space-3). */
  gap?: string;
  /** Show previous / next buttons (default true) and position indicators (default true). */
  controls?: boolean; indicators?: boolean;
  index?: number; defaultIndex?: number; onIndexChange?: (i: number) => void;
  locale?: string;
  className?: string; style?: React.CSSProperties;
}

/**
 * Native scroll-snap carousel. Touch = native momentum (no hijacking, vertical page scroll never blocked);
 * mouse drag scrolls the track and snaps to the nearest slide on release. Indicators = buttons with the shared nav
 * indicator resting on the current one (no own indicator element). Keys on the region: ← → Home End.
 * role region + aria-roledescription carousel; slides role group "n of N"; the polite status speaks only when autoplay is off.
 */
export function ULCarousel({ children, label, visible = 1, loop = false, autoplay = false, gap = 'var(--ul-space-3)', controls = true, indicators = true, index, defaultIndex = 0, onIndexChange, locale, className, style }: ULCarouselProps) {
  const t = T[loc(locale)], uid = useDomId('ul-car');
  const slides = React.Children.toArray(children).filter(Boolean);
  const N = slides.length, pos = Math.max(1, N - visible + 1);
  const reduced = useReducedMotion();
  const [own, setOwn] = React.useState(Math.min(defaultIndex, pos - 1)); const cur = Math.min(index ?? own, pos - 1);
  const curRef = React.useRef(cur); curRef.current = cur;
  const track = React.useRef<HTMLDivElement | null>(null), dots = React.useRef<HTMLDivElement | null>(null), lens = React.useRef<HTMLSpanElement | null>(null);
  const [playing, setPlaying] = React.useState(!!autoplay && !reduced);
  const [hold, setHold] = React.useState(false);
  React.useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  const setIdx = (i: number) => { if (i === curRef.current) return; curRef.current = i; if (index === undefined) setOwn(i); onIndexChange?.(i); };
  const prog = React.useRef<number | null>(null);
  const slideEl = (i: number) => track.current?.children[i] as HTMLElement | undefined;
  const go = (i: number, smooth = true) => {
    const el = track.current; if (!el) return;
    const j = loop ? (i + pos) % pos : Math.max(0, Math.min(pos - 1, i));
    const s = slideEl(j); if (!s) return;
    const left = Math.min(el.scrollWidth - el.clientWidth, s.offsetLeft - (el.firstElementChild as HTMLElement).offsetLeft);
    prog.current = Math.abs(el.scrollLeft - left) < 1 ? null : left; // programmatic travel: the index stays on the target until it lands
    el.scrollTo({ left, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    setIdx(j);
  };
  // index from the scroll position (rAF throttled; one state change per new index)
  React.useEffect(() => {
    const el = track.current; if (!el) return; let raf = 0;
    const read = () => { raf = 0; if (prog.current != null) { if (Math.abs(el.scrollLeft - prog.current) < 2) prog.current = null; return; } const first = el.children[0] as HTMLElement | undefined; if (!first) return; const step = (el.children[1] as HTMLElement | undefined) ? (el.children[1] as HTMLElement).offsetLeft - first.offsetLeft : el.clientWidth; const i = Math.max(0, Math.min(pos - 1, Math.round(el.scrollLeft / Math.max(1, step)))); if (!dragRef.current) setIdx(i); };
    const on = () => { if (!raf) raf = requestAnimationFrame(read); };
    const user = () => { prog.current = null; };
    const end = () => { prog.current = null; on(); };
    el.addEventListener('scroll', on, { passive: true }); el.addEventListener('scrollend', end); el.addEventListener('wheel', user, { passive: true }); el.addEventListener('touchstart', user, { passive: true });
    return () => { el.removeEventListener('scroll', on); el.removeEventListener('scrollend', end); el.removeEventListener('wheel', user); el.removeEventListener('touchstart', user); cancelAnimationFrame(raf); };
  }, [pos]);
  React.useEffect(() => { if (index !== undefined && track.current) go(index); }, [index]);
  React.useEffect(() => { if (!indicators || !dots.current || !lens.current) return; const ind = createNavIndicator({ container: dots.current, lens: lens.current, items: 'button', rest: () => dots.current?.querySelector<HTMLElement>('[aria-current="true"]') ?? null }); return () => ind.destroy(); }, [indicators, pos]);
  // autoplay: off by default, paused on hover / focus, never under reduced motion
  React.useEffect(() => {
    if (!autoplay || !playing || hold || reduced) return;
    const id = window.setInterval(() => go(curRef.current + 1 >= pos ? 0 : curRef.current + 1), Math.max(1500, autoplay));
    return () => clearInterval(id);
  }, [autoplay, playing, hold, reduced, pos]);
  // mouse drag (touch / pen keep native scrolling)
  const dragRef = React.useRef<{ x: number; left: number; moved: boolean; id: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !track.current) return;
    prog.current = null; dragRef.current = { x: e.clientX, left: track.current.scrollLeft, moved: false, id: e.pointerId };
    const el = track.current; let raf = 0, want = el.scrollLeft;
    const move = (ev: PointerEvent) => { const d = dragRef.current; if (!d || ev.pointerId !== d.id) return; const dx = ev.clientX - d.x; if (!d.moved && Math.abs(dx) > 4) { d.moved = true; el.setAttribute('data-dragging', ''); try { el.setPointerCapture(ev.pointerId); } catch { /* */ } } if (!d.moved) return; want = d.left - dx; if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.scrollLeft = want; }); };
    const up = (ev: PointerEvent) => {
      const d = dragRef.current; if (!d || ev.pointerId !== d.id) return; dragRef.current = null; cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      if (!d.moved) return;
      el.scrollLeft = want; el.removeAttribute('data-dragging');
      const first = el.children[0] as HTMLElement, step = el.children[1] ? (el.children[1] as HTMLElement).offsetLeft - first.offsetLeft : el.clientWidth;
      go(Math.round(want / Math.max(1, step)));
      const stop = (ce: MouseEvent) => { ce.stopPropagation(); ce.preventDefault(); }; el.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => el.removeEventListener('click', stop, { capture: true } as EventListenerOptions), 0);
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(curRef.current + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(curRef.current - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); } else if (e.key === 'End') { e.preventDefault(); go(pos - 1); }
  };
  const live = !(autoplay && playing && !hold);
  return (
    <section className={cx('ul-car', className)} style={{ '--ul-car-visible': visible, '--ul-car-gap': gap, ...style } as React.CSSProperties}
      aria-roledescription={t.carousel} aria-label={label} onKeyDown={onKey}
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') setHold(true); }} onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHold(false); }}>
      <div ref={track} id={`${uid}-track`} className="ul-car-track" data-ul-allow-overflow="" tabIndex={0} aria-label={t.slides} onPointerDown={onDown}>
        {slides.map((s, i) => (
          <div key={i} className="ul-car-slide" role="group" aria-roledescription={t.slide} aria-label={t.of(i + 1, N)} data-current={i >= cur && i < cur + visible ? '' : undefined}>{s}</div>
        ))}
      </div>
      <div className="ul-car-bar">
        {autoplay && !reduced ? <ULButton size="sm" shape="circle" variant="secondary" className="ul-car-play" aria-label={playing ? t.pause : t.play} icon={<ULIcon name={playing ? 'pause' : 'play'} size="sm" />} onClick={() => setPlaying((p) => !p)} /> : null}
        {indicators && pos > 1 ? (
          <div ref={dots} className="ul-car-dots" role="group" aria-label={t.slides} aria-controls={`${uid}-track`}>
            <span ref={lens} aria-hidden="true" className="ul-car-lens"></span>
            {Array.from({ length: pos }, (_, i) => <button key={i} type="button" className="ul-car-dot" aria-label={t.go(i + 1)} aria-current={i === cur ? 'true' : undefined} onClick={() => go(i)}><span aria-hidden="true"></span></button>)}
          </div>
        ) : <span></span>}
        {controls && pos > 1 ? (
          <div className="ul-car-nav">
            <ULButton size="sm" shape="circle" variant="secondary" aria-label={t.prev} aria-controls={`${uid}-track`} disabled={!loop && cur === 0} icon={<ULIcon name="chevron-left" size="sm" />} onClick={() => go(cur - 1)} />
            <ULButton size="sm" shape="circle" variant="secondary" aria-label={t.next} aria-controls={`${uid}-track`} disabled={!loop && cur >= pos - 1} icon={<ULIcon name="chevron-right" size="sm" />} onClick={() => go(cur + 1)} />
          </div>
        ) : null}
      </div>
      <p className="ul-car-status" aria-live={live ? 'polite' : 'off'} aria-atomic="true">{t.of(cur + 1, pos)}</p>
    </section>
  );
}
