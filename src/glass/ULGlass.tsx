import * as React from 'react';
import { attachGlass, detachGlass, materialize, type GlassTier, type LensMode, type GlassQuality, type GlassPriority } from './engine.ts';
import { GlassGroupContext } from './ULGlassGroup.tsx';
import { accentAttrs, type Accent, type AccentStrength, type Backdrop } from './accent.tsx';
import { useMaterial, type Material, type MaterialCategory } from './material.tsx';
import './ULGlass.css';

export type GlassVariant = 'clear' | 'chrome';

/** Element attributes forwarded to the `as` element through the rest props (button / link / form-control hosts). */
export type ULGlassElementAttrs = Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled' | 'name' | 'form'> & Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'download' | 'hrefLang'>;
export interface ULGlassProps extends React.HTMLAttributes<HTMLElement>, ULGlassElementAttrs {
  /** Element to render. Default 'div'. */
  as?: React.ElementType;
  /** Material thickness: sm controls, md cards, lg menus/sidebars, xl sheets. */
  tier?: GlassTier;
  variant?: GlassVariant;
  /** Lens profile: standard | polar | prominent. */
  mode?: LensMode;
  /** Overrides the tier radius. Use concentric() for nested surfaces. */
  radius?: number | string;
  padding?: number | string;
  /** Multiplier on the displacement scale. 0 = no lens. */
  refraction?: number;
  /** Absolute overrides of tier tokens (tuning / special cases). */
  blur?: number | string;
  bezel?: number | string;
  scale?: number;
  aberration?: number;
  magnify?: number;
  /**
   * Elastic surface (hover pull, press/drag stretch). Default false. Use for
   * controls only — buttons, icon buttons, chips, switch/slider thumbs,
   * segmented lens, FAB. Cards, panels, sheets, sidebars, toolbars, tables,
   * inputs and popovers stay rigid (light + rim only).
   */
  interactive?: boolean;
  /** Overrides the size-tier factor (--ul-elasticity-sm/md/lg/xl); still × --ul-elasticity. */
  elasticity?: number;
  /** @internal showcase comparison only */
  legacyElastic?: boolean;
  /** Press feedback: scale down + flare at the pointer. */
  pressable?: boolean;
  /** Pressed scale with `pressable` (engine option). Default .965 (engine default). */
  pressScale?: number;
  /** Pointer light, rim rotation and elasticity. */
  light?: boolean;
  /**
   * full: SVG refraction + aberration + rim + light. lite: blur + saturate, rim, tint, light on hover.
   * flat: no backdrop-filter. auto (default): the governor grants full within the refraction budget.
   */
  quality?: GlassQuality;
  /** Governor priority. overlay > focused/hovered > island > closest to viewport center. Default: overlay for role=dialog / anchored surfaces. */
  priority?: GlassPriority;
  /** Toggling this materializes / dematerializes the surface. */
  visible?: boolean;
  /** Paint the displacement map (debug). */
  debug?: boolean;
  /**
   * Accent preset (ice | violet | emerald | amber | rose) or any CSS color.
   * Omit to inherit the nearest ancestor's accent. Tints the tint, rim, glow
   * and pointer light only; refraction stays neutral; text stays neutral.
   */
  accent?: Accent;
  /** subtle | tinted (default once an accent is set) | vivid, or k 0..1. Omit to inherit. */
  accentStrength?: AccentStrength;
  /** What sits behind this surface; selects the contrast scrim. Omit to inherit (default dark). */
  backdrop?: Backdrop;
  /**
   * "glass" | "flat". Flat = the reduced-transparency fallback (no backdrop-filter, refraction, gloss rim, pointer light);
   * outside the refraction budget. Omit to resolve: nearest ULProvider scope > category default > global default.
   * @default undefined (resolved; "glass" for every category except inputs)
   */
  material?: Material;
  /**
   * Category used to resolve `material` when it is omitted: inputs | controls | surfaces | overlays | chrome.
   * @default "surfaces"
   */
  materialCategory?: MaterialCategory;
}

const len = (v: number | string) => (typeof v === 'number' || /^[\d.]+$/.test(v) ? `${v}px` : v);

export const ULGlass = React.forwardRef<HTMLElement, ULGlassProps>(function ULGlass(
  {
    as: Tag = 'div', tier = 'md', variant = 'clear', mode = 'standard', radius, padding, refraction = 1,
    blur, bezel, scale, aberration, magnify, interactive = false, elasticity, legacyElastic = false, pressable = false, pressScale,
    light = true, visible = true, debug = false, quality = 'auto', priority, accent, accentStrength, backdrop, material, materialCategory = 'surfaces', className, style, children, ...rest
  },
  ref,
) {
  const mat = useMaterial(materialCategory, material);
  if (mat.flat) { quality = 'flat'; light = false; }
  const node = React.useRef<HTMLElement | null>(null);
  const inGroup = React.useContext(GlassGroupContext) !== null;
  const setRef = React.useCallback((el: HTMLElement | null) => {
    node.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
  }, [ref]);

  React.useLayoutEffect(() => {
    if (node.current) attachGlass(node.current, { refraction: Number(refraction), light, debug, mode, interactive, elasticity: elasticity == null ? undefined : Number(elasticity), legacyElastic, pressable, pressScale: pressScale == null ? undefined : Number(pressScale), quality, priority });
  }, [refraction, light, debug, mode, interactive, elasticity, legacyElastic, pressable, pressScale, quality, priority, tier, radius, padding, blur, bezel, scale, aberration, magnify]);

  React.useLayoutEffect(() => {
    const el = node.current;
    return () => { if (el) detachGlass(el); };
  }, []);

  const mounted = React.useRef(false);
  React.useLayoutEffect(() => {
    if (node.current) materialize(node.current, visible, { immediate: !mounted.current });
    mounted.current = true;
  }, [visible]);

  const vars: Record<string, string> = {};
  if (radius != null) vars['--ul-glass-radius'] = len(radius);
  if (padding != null) vars['--ul-glass-padding'] = len(padding);
  if (blur != null) vars['--ul-glass-blur'] = len(blur);
  if (bezel != null) vars['--ul-glass-bezel'] = len(bezel);
  if (scale != null) vars['--ul-glass-refraction'] = String(scale);
  if (aberration != null) vars['--ul-glass-aberration'] = String(aberration);
  if (magnify != null) vars['--ul-glass-magnify'] = String(magnify);
  const acc = accentAttrs(accent, accentStrength);

  return (
    <Tag
      ref={setRef}
      {...rest}
      className={className ? `ul-glass ${className}` : 'ul-glass'}
      data-tier={tier}
      data-variant={variant}
      data-lens={mode}
      data-pressable={pressable ? '' : undefined}
      data-interactive={interactive ? '' : undefined}
      data-in-group={inGroup ? '' : undefined}
      data-ul-accent={acc['data-ul-accent']}
      data-ul-accent-strength={acc['data-ul-accent-strength']}
      data-ul-backdrop={backdrop}
      data-ul-material={mat.attr}
      style={{ ...vars, ...acc.style, ...style } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
});
