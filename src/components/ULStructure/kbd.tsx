import * as React from 'react';
import { cx } from '../shared/icons.tsx';
import './kbd.css';

/* ---------------- ULKbd ---------------- */
export type Plat = 'mac' | 'other';
export type KLoc = 'en' | 'sk' | 'de' | 'cs';
export const kloc = (l?: string): KLoc => { const k = (l || (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'en').slice(0, 2).toLowerCase(); return (['en', 'sk', 'de', 'cs'].includes(k) ? k : 'en') as KLoc; };
/** mac-like = macOS / iOS / iPadOS (userAgentData when available, then platform / UA). */
export function detectPlatform(): Plat {
  if (typeof navigator === 'undefined') return 'other';
  const n = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = n.userAgentData?.platform || n.platform || n.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(p) ? 'mac' : 'other';
}
const MAC: Record<string, [string, string]> = { mod: ['⌘', 'Command'], cmd: ['⌘', 'Command'], meta: ['⌘', 'Command'], ctrl: ['⌃', 'Control'], alt: ['⌥', 'Option'], option: ['⌥', 'Option'], shift: ['⇧', 'Shift'] };
const OTHER: Record<KLoc, Record<string, [string, string]>> = {
  en: { mod: ['Ctrl', 'Control'], ctrl: ['Ctrl', 'Control'], cmd: ['Win', 'Windows'], meta: ['Win', 'Windows'], alt: ['Alt', 'Alt'], option: ['Alt', 'Alt'], shift: ['Shift', 'Shift'] },
  sk: { mod: ['Ctrl', 'Control'], ctrl: ['Ctrl', 'Control'], cmd: ['Win', 'Windows'], meta: ['Win', 'Windows'], alt: ['Alt', 'Alt'], option: ['Alt', 'Alt'], shift: ['Shift', 'Shift'] },
  de: { mod: ['Strg', 'Steuerung'], ctrl: ['Strg', 'Steuerung'], cmd: ['Win', 'Windows'], meta: ['Win', 'Windows'], alt: ['Alt', 'Alt'], option: ['Alt', 'Alt'], shift: ['Umschalt', 'Umschalt'] },
  cs: { mod: ['Ctrl', 'Control'], ctrl: ['Ctrl', 'Control'], cmd: ['Win', 'Windows'], meta: ['Win', 'Windows'], alt: ['Alt', 'Alt'], option: ['Alt', 'Alt'], shift: ['Shift', 'Shift'] },
};
const NAMED: Record<KLoc, Record<string, [string, string]>> = {
  en: { enter: ['↵', 'Enter'], return: ['↵', 'Return'], esc: ['Esc', 'Escape'], escape: ['Esc', 'Escape'], tab: ['Tab', 'Tab'], space: ['Space', 'Space'], backspace: ['⌫', 'Backspace'], delete: ['Del', 'Delete'], up: ['↑', 'Up arrow'], down: ['↓', 'Down arrow'], left: ['←', 'Left arrow'], right: ['→', 'Right arrow'], pageup: ['PgUp', 'Page up'], pagedown: ['PgDn', 'Page down'], home: ['Home', 'Home'], end: ['End', 'End'] },
  sk: { enter: ['↵', 'Enter'], return: ['↵', 'Enter'], esc: ['Esc', 'Escape'], escape: ['Esc', 'Escape'], tab: ['Tab', 'Tab'], space: ['Medzera', 'Medzerník'], backspace: ['⌫', 'Backspace'], delete: ['Del', 'Delete'], up: ['↑', 'Šípka hore'], down: ['↓', 'Šípka dole'], left: ['←', 'Šípka vľavo'], right: ['→', 'Šípka vpravo'], pageup: ['PgUp', 'Page Up'], pagedown: ['PgDn', 'Page Down'], home: ['Home', 'Home'], end: ['End', 'End'] },
  de: { enter: ['↵', 'Eingabe'], return: ['↵', 'Eingabe'], esc: ['Esc', 'Escape'], escape: ['Esc', 'Escape'], tab: ['Tab', 'Tabulator'], space: ['Leer', 'Leertaste'], backspace: ['⌫', 'Rücktaste'], delete: ['Entf', 'Entfernen'], up: ['↑', 'Pfeil oben'], down: ['↓', 'Pfeil unten'], left: ['←', 'Pfeil links'], right: ['→', 'Pfeil rechts'], pageup: ['Bild↑', 'Bild auf'], pagedown: ['Bild↓', 'Bild ab'], home: ['Pos1', 'Pos1'], end: ['Ende', 'Ende'] },
  cs: { enter: ['↵', 'Enter'], return: ['↵', 'Enter'], esc: ['Esc', 'Escape'], escape: ['Esc', 'Escape'], tab: ['Tab', 'Tab'], space: ['Mezera', 'Mezerník'], backspace: ['⌫', 'Backspace'], delete: ['Del', 'Delete'], up: ['↑', 'Šipka nahoru'], down: ['↓', 'Šipka dolů'], left: ['←', 'Šipka vlevo'], right: ['→', 'Šipka vpravo'], pageup: ['PgUp', 'Page Up'], pagedown: ['PgDn', 'Page Down'], home: ['Home', 'Home'], end: ['End', 'End'] },
};
const THEN: Record<KLoc, string> = { en: 'then', sk: 'potom', de: 'dann', cs: 'potom' };
/** "Mod+Shift+K" → caps + spoken name for the platform. */
export function formatKeys(combo: string, platform: Plat = detectPlatform(), locale?: string) {
  const l = kloc(locale);
  return combo.split('+').map((raw) => raw.trim()).filter(Boolean).map((k) => {
    const id = k.toLowerCase(), mod = platform === 'mac' ? MAC[id] : OTHER[l][id], named = NAMED[l][id];
    const [cap, name] = mod || named || [k.length === 1 ? k.toUpperCase() : k, k.length === 1 ? k.toUpperCase() : k];
    return { cap, name };
  });
}
export interface ULKbdProps {
  /** "Mod+K" (Mod = ⌘ on Apple, Ctrl elsewhere) or a sequence ["G", "D"] (pressed one after another). Or children for a single literal cap. */
  keys?: string | string[];
  children?: React.ReactNode;
  platform?: 'auto' | Plat;
  size?: 'sm' | 'md';
  locale?: string;
  className?: string;
}
export function ULKbd({ keys, children, platform = 'auto', size = 'md', locale, className }: ULKbdProps) {
  const [plat, setPlat] = React.useState<Plat>(platform === 'auto' ? 'other' : platform);
  React.useEffect(() => { setPlat(platform === 'auto' ? detectPlatform() : platform); }, [platform]);
  if (keys == null) return <kbd className={cx('ul-kbd', className)} data-size={size}><kbd className="ul-kbd-key">{children}</kbd></kbd>;
  const seq = Array.isArray(keys) ? keys : [keys], l = kloc(locale);
  const combos = seq.map((c) => formatKeys(c, plat, locale));
  const spoken = combos.map((c) => c.map((k) => k.name).join(' + ')).join(` ${THEN[l]} `);
  return (
    <kbd className={cx('ul-kbd', className)} data-size={size} data-platform={plat} aria-label={spoken}>
      {combos.map((c, i) => (
        <React.Fragment key={i}>
          {i ? <span className="ul-kbd-then" aria-hidden="true">{THEN[l]}</span> : null}
          <span className="ul-kbd-combo" aria-hidden="true">
            {c.map((k, j) => <React.Fragment key={j}>{j && plat !== 'mac' ? <span className="ul-kbd-plus">+</span> : null}<kbd className="ul-kbd-key">{k.cap}</kbd></React.Fragment>)}
          </span>
        </React.Fragment>
      ))}
    </kbd>
  );
}

