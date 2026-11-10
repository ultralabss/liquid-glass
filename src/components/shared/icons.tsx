import * as React from 'react';
import './icon.css';
import './hit.css';

/** Line icons used inside components (same 24 grid, round caps as icons/*.svg). */
const P: Record<string, string> = {
  eye: 'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  'eye-off': 'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68 M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61 M14.12 14.12a3 3 0 1 1-4.24-4.24 M2 2l20 20',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M20 20l-3.5-3.5',
  x: 'M18 6 6 18 M6 6l12 12',
  minus: 'M5 12h14',
  plus: 'M12 5v14 M5 12h14',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-left': 'm15 18-6-6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  'grip-vertical': 'M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M8 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M14 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M14 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
  check: 'M20 6 9 17l-5-5',
  'layout-grid': 'M4 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1 M14 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1 M14 13h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1 M4 13h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  calendar: 'M8 2v4 M16 2v4 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M3 10h18',
  alert: 'M12 8v4 M12 16h.01 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  info: 'M12 16v-4 M12 8h.01 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  warning: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0 M12 9v4 M12 17h.01',
  'circle-check': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M8.5 12.5l2.5 2.5 4.5-5',
  copy: 'M10 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2 M4 16a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2',
  refresh: 'M3 12a9 9 0 0 1 15.3-6.4L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15.3 6.4L3 16 M3 21v-5h5',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  star: 'M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2L2.9 9.4l6.3-.9z',
  heart: 'M19.5 12.6 12 20l-7.5-7.4A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 7.5 6.6',
  pin: 'M12 17v5 M9 10.8V5h6v5.8l2 3.2H7z M8 2h8',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  share: 'M18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M8.6 13.5l6.8 4 M15.4 6.5l-6.8 4',
  save: 'M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2 M7 3v5h8 M7 21v-7h10v7',
  undo: 'M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  volume: 'M11 5 6 9H2v6h4l5 4z M15.5 8.5a5 5 0 0 1 0 7 M19 5a10 10 0 0 1 0 14',
  'volume-x': 'M11 5 6 9H2v6h4l5 4z M22 9l-6 6 M16 9l6 6',
  trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6',
  send: 'M22 2 11 13 M22 2l-7 20-4-9-9-4z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  wrap: 'M3 6h18 M3 12h15a3 3 0 1 1 0 6h-4 M16 16l-2 2 2 2 M3 18h7',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M22 6l-10 7L2 6',
  back: 'M19 12H5 M12 19l-7-7 7-7',
  pause: 'M8 5v14 M16 5v14',
  play: 'M7 4.5v15l12.5-7.5z',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  pipette: 'm2 22 1-1h3l9-9 M3 21v-3l9-9 M15 6l3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4',
};

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | number | string;
const NAMED = new Set(['xs', 'sm', 'md', 'lg']);
export interface ULIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
  /** Built-in line icon. Or pass path (24 grid) / children for a custom glyph. */
  name?: keyof typeof P | string;
  path?: string;
  /** Token size xs|sm|md|lg (em-based, default md) or an explicit px number / CSS length. A sizing wrapper (.ul-btn-icon etc.) makes it fill the box. */
  size?: IconSize;
  /** Filled glyph (fill currentColor, no stroke). */
  filled?: boolean;
}
/** The one icon primitive: explicit width/height, flex: none, display: block. Never an unsized svg. */
export function ULIcon({ name, path, size, filled, className, style, children, viewBox = '0 0 24 24', ...rest }: ULIconProps) {
  const named = size == null || (typeof size === 'string' && NAMED.has(size));
  const dim = named ? undefined : typeof size === 'number' ? `${size}px` : String(size);
  return (
    <svg viewBox={viewBox} width={dim ?? '1.25em'} height={dim ?? '1.25em'} className={cx('ul-icon', className as string)} data-size={named ? (size ?? 'md') : undefined}
      style={dim ? ({ ...style, '--ul-icon-size': dim } as React.CSSProperties) : style}
      fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children ?? <path d={path ?? P[name ?? ''] ?? ''} />}
    </svg>
  );
}
/** @deprecated alias, same component. */
export const Icon = ULIcon;

/** Stable DOM id from React.useId (colons are not valid in CSS selectors). */
export function useDomId(prefix: string, given?: string) {
  const auto = React.useId().replace(/:/g, '');
  return given || `${prefix}${auto}`;
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
