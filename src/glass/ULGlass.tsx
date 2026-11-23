import * as React from 'react';
import { attachGlass, detachGlass, materialize, type GlassTier, type LensMode, type GlassQuality, type GlassPriority } from './engine.ts';
import { GlassGroupContext } from './ULGlassGroup.tsx';
import { accentAttrs, type Accent, type AccentStrength, type Backdrop } from './accent.tsx';
import { useMaterial, useClarity, useAppearance, useGlassMotion, type Material, type MaterialCategory, type Appearance } from './material.tsx';
import { GLASS_PRESETS, type GlassPreset } from './presets.ts';
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
   * 0..1 wavy distortion across the WHOLE surface, not only the bezel ring: text anywhere behind a large surface (dialog, sheet)
   * visibly bends. 0.35 is clear, 1 is strong. Needs refraction (quality "full"); combine with `blur={0}` for pure distortion.
   * Amplitude is up to ±interiorWarp × lens scale / 2 px. Token `--ul-glass-interior-warp`.
   * @default undefined (token, 0)
   */
  interiorWarp?: number;
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
   * full: SVG refraction + aberration + rim + light, regardless of the area budget (a request, not a guarantee: needs Chromium,
   * and nested glass, flat material and anchored overlays never refract). lite: blur + saturate, rim, tint, light on hover.
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
   * Liquid lens, frosted glass or solid. `liquid` = refraction + lens (default), `frosted` = ordinary frosted glass (blur +
   * saturate + tint, no lens; cheap and stable everywhere), `solid` = no transparency. Omit to inherit the nearest ULProvider
   * `appearance` (also per category), else liquid.
   * @default undefined (inherited; liquid)
   */
  appearance?: Appearance;
  /** Ready-made look: clear | dramatic | calm | frosted. Explicit props win over the preset. */
  preset?: GlassPreset;
  /**
   * One lever for the lens, 0..1: 0 = none, 0.5 = the designed strength, 1 = double refraction plus a wavy warp (0.4) across the whole
   * surface. Explicit `refraction` / `interiorWarp` win.
   */
  distortion?: number;
  /** Body tint amount (0 = none, so pure distortion over the backdrop). Overrides the tier token. */
  tint?: number;
  /** Body tint colour (any CSS colour). Default: derived from the accent. */
  tintColor?: string;
  /** Frost 0..1 (backdrop blur, 0 = none, 1 = 32 px). Overrides the tier blur; explicit `blur` wins. */
  frost?: number;
  /** Specular rim strength 0..1 (the 1px lit ring). Default 1. */
  rim?: number;
  /** Accent glow strength, 0..1 (1 = designed). Default 1. */
  glow?: number;
  /** Drop shadow: none | soft | deep, or any CSS box-shadow list. */
  shadow?: 'none' | 'soft' | 'deep' | (string & {});
  /** Pointer light strength: 0 = off, 1 = designed, above 1 = brighter. */
  pointerLight?: number;
  /** How far (px) from the surface the pointer still lights it. Default: --ul-glass-light-proximity (140). Use a small value (1) to light only on hover. */
  proximity?: number;
  /**
   * Clarity 0..1 (Apple's Clear ↔ Tinted): how much body tint, backing scrim and frost this surface carries.
   * 0.5 = the designed material, 1 = clear, 0 = tinted. Omit to inherit the nearest ULProvider `clarity`, else the token
   * --ul-glass-clarity (a CSS ancestor can also set it). Never touches the lens.
   * @default undefined (inherited; 0.5)
   */
  clarity?: number;
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

/** Preset values under explicit props: undefined explicit props never hide a preset value. */
function withPreset(props: ULGlassProps): ULGlassProps {
  const pr = props.preset ? GLASS_PRESETS[props.preset] : undefined;
  if (!pr) return props;
  const out: Record<string, unknown> = { ...pr };
  for (const [k, v] of Object.entries(props)) if (v !== undefined) out[k] = v;
  return out as ULGlassProps;
}

export const ULGlass = React.forwardRef<HTMLElement, ULGlassProps>(function ULGlass(
  rawProps,
  ref,
) {
  let {
    as: Tag = 'div', tier = 'md', variant = 'clear', mode = 'standard', radius, padding, refraction = 1,
    blur, bezel, scale, aberration, magnify, interiorWarp, interactive = false, elasticity, legacyElastic = false, pressable = false, pressScale,
    light = true, visible = true, debug = false, quality, priority, accent, accentStrength, backdrop, clarity, material, materialCategory = 'surfaces',
    appearance, preset: _preset, distortion, tint, tintColor, frost, rim, glow, shadow, pointerLight, proximity, className, style, children, ...rest
  } = withPreset(rawProps) as ULGlassProps & { as?: React.ElementType };
  const ap = useAppearance(materialCategory, appearance);
  const motion = useGlassMotion();
  const mat = useMaterial(materialCategory, material ?? (ap === 'solid' ? 'flat' : undefined));
  const clar = useClarity(clarity);
  quality = quality ?? (ap === 'frosted' ? 'lite' : 'auto');
  if (distortion != null) {
    const d = Math.max(0, Math.min(1, Number(distortion)));
    refraction = Number(refraction) * 2 * d;
    if (interiorWarp == null && d > 0.5) interiorWarp = (d - 0.5) * 0.8;
  }
  if (motion === 'reduced') { interactive = false; pressable = false; }
  if (pointerLight != null && Number(pointerLight) <= 0) light = false;
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
  }, [refraction, light, debug, mode, interactive, elasticity, legacyElastic, pressable, pressScale, quality, priority, tier, radius, padding, blur, bezel, scale, aberration, magnify, interiorWarp]);

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
  if (interiorWarp != null) vars['--ul-glass-interior-warp'] = String(interiorWarp);
  if (tint != null) vars['--ul-glass-tint'] = String(tint);
  if (tintColor != null) vars['--ul-glass-tint-color'] = tintColor;
  if (frost != null && blur == null) vars['--ul-glass-blur'] = `${(Math.max(0, Number(frost)) * 32).toFixed(1)}px`;
  if (rim != null) vars['--ul-rim'] = String(rim);
  if (glow != null) vars['--ul-glow-k'] = String(glow);
  if (shadow != null) vars['--ul-glass-shadow'] = shadow === 'none' ? '0 0 0 0 transparent' : shadow === 'soft' ? 'var(--ul-glass-sm-shadow)' : shadow === 'deep' ? 'var(--ul-glass-xl-shadow)' : shadow;
  if (pointerLight != null && Number(pointerLight) > 0) vars['--ul-glass-light-intensity'] = String(0.16 * Number(pointerLight));
  if (clar != null) vars['--ul-glass-clarity'] = String(clar);
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
      data-ul-appearance={ap}
      data-ul-proximity={proximity != null ? String(proximity) : undefined}
      style={{ ...vars, ...acc.style, ...style } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
});
