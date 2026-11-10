import * as React from 'react';

export const ACCENT_PRESETS = ['ice', 'violet', 'emerald', 'amber', 'rose'] as const;
export type AccentPreset = (typeof ACCENT_PRESETS)[number];
/** A preset name or any CSS color. */
export type Accent = AccentPreset | (string & {});
export type Backdrop = 'dark' | 'mid' | 'light';
export const ACCENT_STRENGTHS = ['subtle', 'tinted', 'vivid'] as const;
/** subtle (ambient) · tinted (default for accented glass) · vivid (hero), or a raw k in 0..1. */
export type AccentStrength = (typeof ACCENT_STRENGTHS)[number] | number;

export const isAccentPreset = (v: unknown): v is AccentPreset => ACCENT_PRESETS.includes(v as AccentPreset);

type Attrs = { 'data-ul-accent'?: string; 'data-ul-accent-strength'?: string; style?: Record<string, string> };

/** Attributes/style that set an accent and/or strength on an element. */
export function accentAttrs(accent?: Accent | null, strength?: AccentStrength | null): Attrs {
  const out: Attrs = {};
  const style: Record<string, string> = {};
  if (accent) {
    if (isAccentPreset(accent)) out['data-ul-accent'] = accent;
    else { out['data-ul-accent'] = 'custom'; style['--ul-accent'] = accent; }
  }
  if (strength != null && (strength as unknown) !== '') { // '' can arrive from untyped hosts (dc attributes)
    if (typeof strength === 'number' || /^[\d.]+$/.test(String(strength))) {
      out['data-ul-accent-strength'] = 'custom';
      style['--ul-accent-level'] = String(Math.min(1, Math.max(0, Number(strength))));
    } else out['data-ul-accent-strength'] = String(strength);
  }
  if (Object.keys(style).length) out.style = style;
  return out;
}

/** Imperative version (observers, island). null removes the value so the element inherits again. */
export function setAccent(el: HTMLElement, accent?: Accent | null, strength?: AccentStrength | null): void {
  const a = accentAttrs(accent, strength);
  if (accent !== undefined) {
    if (a['data-ul-accent']) el.setAttribute('data-ul-accent', a['data-ul-accent']); else el.removeAttribute('data-ul-accent');
    if (a.style?.['--ul-accent']) el.style.setProperty('--ul-accent', a.style['--ul-accent']); else el.style.removeProperty('--ul-accent');
  }
  if (strength !== undefined) {
    if (a['data-ul-accent-strength']) el.setAttribute('data-ul-accent-strength', a['data-ul-accent-strength']); else el.removeAttribute('data-ul-accent-strength');
    if (a.style?.['--ul-accent-level']) el.style.setProperty('--ul-accent-level', a.style['--ul-accent-level']); else el.style.removeProperty('--ul-accent-level');
  }
}

export interface ULAccentScopeProps extends React.HTMLAttributes<HTMLElement> {
  accent?: Accent | null;
  strength?: AccentStrength | null;
  /** What sits behind glass inside this scope; selects the contrast scrim. */
  backdrop?: Backdrop;
  /** Render as a layout-less wrapper (display: contents). Default true. */
  contents?: boolean;
  as?: React.ElementType;
}

/** Sets an accent / strength / backdrop once for everything inside. Changes animate. */
export function ULAccentScope({ accent, strength, backdrop, contents = true, as: Tag = 'div', style, children, ...rest }: ULAccentScopeProps) {
  const a = accentAttrs(accent, strength);
  return (
    <Tag
      {...rest}
      data-ul-accent={a['data-ul-accent']}
      data-ul-accent-strength={a['data-ul-accent-strength']}
      data-ul-backdrop={backdrop}
      style={{ ...(contents ? { display: 'contents' } : null), ...a.style, ...style } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
