import * as React from 'react';

/**
 * Material: "glass" | "flat". ONE resolver for every component.
 * Order (most specific wins): instance prop > nearest ULProvider scope > category default > global default.
 * Flat = the reduced-transparency fallback layer (same CSS, same tokens): no backdrop-filter, refraction, gloss rim,
 * pointer light or goo; never counted toward the refraction budget. Non-React path: data-ul-material="glass|flat"
 * on any element (nearest attribute wins; read by the engine and by ULGlass.css).
 */
export type Material = 'glass' | 'flat';
export type MaterialCategory = 'inputs' | 'controls' | 'surfaces' | 'overlays' | 'chrome';
/** A single material for every category, or per category (+ `default` for the categories not named). */
export type MaterialConfig = Material | Partial<Record<'default' | MaterialCategory, Material>>;

export const MATERIAL_CATEGORIES: readonly MaterialCategory[] = ['inputs', 'controls', 'surfaces', 'overlays', 'chrome'];
/** Category defaults: inputs flat, everything else glass. */
export const MATERIAL_DEFAULTS: Readonly<Record<MaterialCategory, Material>> = { inputs: 'flat', controls: 'glass', surfaces: 'glass', overlays: 'glass', chrome: 'glass' };
export const GLOBAL_MATERIAL: Material = 'glass';

type Scope = Partial<Record<MaterialCategory, Material>>;
const MaterialCtx = React.createContext<Scope>({});

/** Pure resolver (tests / non-React callers). `scope` = the merged nearest-scope map. */
export function resolveMaterial(category: MaterialCategory | undefined, instance?: Material, scope: Scope = {}): { material: Material; source: 'instance' | 'scope' | 'category' | 'global' } {
  if (instance) return { material: instance, source: 'instance' };
  if (category && scope[category]) return { material: scope[category]!, source: 'scope' };
  if (category) return { material: MATERIAL_DEFAULTS[category], source: 'category' };
  return { material: GLOBAL_MATERIAL, source: 'global' };
}

/** Merge a provider config onto the parent scope: what this scope names wins; the rest is inherited. */
export function mergeMaterialScope(parent: Scope, config: MaterialConfig | undefined): Scope {
  if (!config) return parent;
  const out: Scope = { ...parent };
  for (const c of MATERIAL_CATEGORIES) {
    const v = typeof config === 'string' ? config : config[c] ?? config.default;
    if (v) out[c] = v;
  }
  return out;
}

/**
 * The one hook every component asks. Returns the resolved material and the attribute to stamp on the component root
 * (`data-ul-material` is stamped when the value is flat or was set explicitly, so a non-React ancestor attribute still
 * applies to defaulted glass).
 */
export function useMaterial(category: MaterialCategory, instance?: Material): { material: Material; flat: boolean; attr: Material | undefined } {
  const scope = React.useContext(MaterialCtx);
  const r = resolveMaterial(category, instance, scope);
  return { material: r.material, flat: r.material === 'flat', attr: r.material === 'flat' || r.source === 'instance' || r.source === 'scope' ? r.material : undefined };
}

/**
 * Glass clarity 0..1 (Apple's "Clear ↔ Tinted"). 0.5 = the designed material; toward 1 the body tint, backing scrim and frost
 * thin out (clear), toward 0 they thicken (tinted). Carried by context so portaled surfaces (menus, popovers, dialogs) get it too.
 */
const ClarityCtx = React.createContext<number | undefined>(undefined);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Resolved clarity for a surface: instance prop > nearest ULProvider > undefined (inherit the CSS token / DOM ancestor). */
export function useClarity(instance?: number): number | undefined {
  const scope = React.useContext(ClarityCtx);
  const v = instance ?? scope;
  return v == null || !Number.isFinite(Number(v)) ? undefined : clamp01(Number(v));
}

export interface ULProviderProps {
  /**
   * Material for this subtree: "glass" | "flat" for every category, or per category
   * `{ default?, inputs?, controls?, surfaces?, overlays?, chrome? }`. Nearest provider wins per category.
   * @default undefined (inherit; category defaults: inputs "flat", the rest "glass")
   */
  material?: MaterialConfig;
  /**
   * Glass clarity for this subtree, 0..1 (Clear ↔ Tinted). 0.5 = the designed material, 1 = clear, 0 = tinted.
   * Reaches every ULGlass below, including portaled menus and popovers. A surface's own `clarity` prop wins.
   * @default undefined (inherit; the token --ul-glass-clarity is 0.5)
   */
  clarity?: number;
  /** Subtree that resolves its material from this scope. */
  children?: React.ReactNode;
}
/** Scope provider (no DOM). Carries `material` and `clarity`. */
export function ULProvider({ material, clarity, children }: ULProviderProps) {
  const parent = React.useContext(MaterialCtx);
  const parentClarity = React.useContext(ClarityCtx);
  const key = typeof material === 'string' ? material : JSON.stringify(material ?? null);
  const value = React.useMemo(() => mergeMaterialScope(parent, material), [parent, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <MaterialCtx.Provider value={value}><ClarityCtx.Provider value={clarity ?? parentClarity}>{children}</ClarityCtx.Provider></MaterialCtx.Provider>;
}

/** Nearest `data-ul-material` attribute (non-React path). */
export function domMaterial(el: Element | null): Material | null {
  const v = el?.closest('[data-ul-material]')?.getAttribute('data-ul-material');
  return v === 'flat' || v === 'glass' ? v : null;
}
