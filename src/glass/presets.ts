/** Ready-made looks. Explicit props on the surface always win over the preset. */
export type GlassPreset = 'clear' | 'dramatic' | 'calm' | 'frosted';

export interface GlassPresetValues {
  clarity?: number; refraction?: number; aberration?: number; bezel?: number; magnify?: number; interiorWarp?: number;
  frost?: number; rim?: number; glow?: number; pointerLight?: number; appearance?: 'liquid' | 'frosted' | 'solid';
}

export const GLASS_PRESETS: Readonly<Record<GlassPreset, GlassPresetValues>> = {
  /** Thin tint and scrim, soft frost: the see-through look. */
  clear: { clarity: 0.85, frost: 0.18, aberration: 1.5 },
  /** Strong lens for dark backdrops: wide bezel, high refraction and colour fringe, light magnification. */
  dramatic: { refraction: 1.5, bezel: 56, aberration: 5, magnify: 1.12, rim: 1, frost: 0.05 },
  /** Quiet material: weak lens, no fringe, dimmer rim and pointer light. */
  calm: { refraction: 0.5, aberration: 0, rim: 0.7, pointerLight: 0.4 },
  /** Ordinary frosted glass, no lens. */
  frosted: { appearance: 'frosted', frost: 0.45 },
};
