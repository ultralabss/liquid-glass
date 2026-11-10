/**
 * One typed header config. ULIsland renders from it; the landing SiteHeader
 * maps its `variant` to one of these. Pages only select a config, they never
 * copy header markup.
 */
import type { Accent } from '../../glass/accent.tsx';

export type HeaderPopper = 'lang';
/** The one app entry beside the island: a link to Studio (Studio handles its own sign-in redirect). */
export const STUDIO_URL = 'https://studio.ultralabs.app';
export interface HeaderLeading { kind: 'logo' | 'back'; href: string; label: string }
export interface HeaderNavItem { key: string; label: string; href?: string; /** opens a megamenu pane */ menu?: boolean }
export interface HeaderCta { label: string; href: string }

export interface HeaderConfig {
  variant: string;
  leading: HeaderLeading;
  nav: HeaderNavItem[];
  megamenu: boolean;
  cta: HeaderCta | false;
  poppers: HeaderPopper[];
  accent: Accent | null;
  sticky: boolean;
  /** Let the floating indicator rest on the current page's item (default off). */
  indicatorRest: boolean;
  /** Overlay reading variant: 'high' = strong blur + worst-case backing. */
  legibility: 'high' | 'normal';
  /** Show the "Go to studio" link button next to the language button. */
  studioLink: boolean;
}

export const HEADER_DEFAULTS: Omit<HeaderConfig, 'variant' | 'leading' | 'nav'> = {
  // account popper removed (CLAUDE.md); 'acct' rendered a second language button in the fallback tools
  megamenu: true, cta: false, poppers: ['lang'],
  accent: null, sticky: false, indicatorRest: false, legibility: 'high', studioLink: true,
};

/** Merge a base variant with per-page overrides (undefined keys are ignored). */
export function resolveHeaderConfig(base: HeaderConfig, over: Partial<HeaderConfig> = {}): HeaderConfig {
  const out: HeaderConfig = { ...base };
  for (const [k, v] of Object.entries(over)) if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  if (!out.megamenu) out.nav = out.nav.map((n) => ({ ...n, menu: false }));
  return out;
}
