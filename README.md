# @ultralabs/glass

Seed of the UltraLabs design system: a React + TypeScript + plain CSS component library with a dark "chrome glass" material. Original UltraLabs design, inspired by refractive-glass interfaces in current operating systems.

## Principles
- **One material.** Every component is built on `ULGlass`. No component sets its own blur, shadow or rim.
- **Tokens only.** Colors, radii, durations, blur and refraction come from `tokens/tokens.json` via `--ul-*` variables. No literals inside `src/components`.
- **Glass never samples glass.** Nested glass is flattened automatically. Sibling glass goes in `ULGlassGroup`.
- **Capsule-first, concentric.** Inner radius = outer radius − padding (`concentric()`).
- **Materialize, don't fade.** Surfaces appear by growing the lens, not by opacity alone.
- **Library never knows the product.** `src/` has no dashboard code; `dashboard-demo/` consumes `src/`.

## Install and usage
```bash
npm i @ultralabs/glass react@19 react-dom@19   # peer range react / react-dom ^19.0.0 (tested); no runtime dependencies
```
```tsx
import '@ultralabs/glass/tokens.css';           // tokens first
import '@ultralabs/glass/dist/ul-glass.css';    // component styles (the ESM build does not inject CSS)
import { ULProvider, ULAccentScope, ULButton, ULTextField } from '@ultralabs/glass';

<ULProvider material="glass">                    {/* "glass" | "flat" or per category, e.g. { default: 'glass', inputs: 'flat' } */}
  <ULAccentScope accent="violet" strength="tinted">   {/* accent is scoped by ULAccentScope (ULProvider carries material only) */}
    <ULButton variant="primary" onClick={save}>Save changes</ULButton>
    <ULTextField label="E-mail" type="email" helper="We only use it to reply." />
  </ULAccentScope>
</ULProvider>
```
Entry points: `@ultralabs/glass` (ESM `dist/esm/index.js`, types `dist/types/src/index.d.ts`), `/tokens.css`, `/tokens.json`, `/dist/ul-glass.css`, `/dist` and `/dist/min` (window.UL bundles). The public API is snapshotted in docs/api-surface.txt (`npm run check:api`).
Without a bundler: load `tokens/tokens.css`, then `dist/ul-glass.js` (exposes `window.UL`, fires `ul:ready`, needs `window.React` and `window.ReactDOM`). The window.UL bundle injects its CSS; apps that load CSS themselves use `dist/ul-glass.css` with `<link data-ul-css>` and the bundle skips its copy.
Releasing: [docs/release-checklist.md](docs/release-checklist.md).

Put the app over a detailed background (imagery, gradients, type). Glass over a flat color has nothing to refract.

### ULGlass props
| prop | type | default | notes |
|---|---|---|---|
| `as` | ElementType | `'div'` | rendered element |
| `tier` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | controls / cards / menus+sidebars / sheets |
| `variant` | `'clear' \| 'chrome'` | `'clear'` | chrome adds silver/ice sheen |
| `radius` | number \| string | tier radius | use `concentric(outer, padding)` when nested |
| `padding` | number \| string | `0` | |
| `refraction` | number | `1` | multiplier on tier lens scale; `0` = no lens |
| `light` | boolean | `true` | pointer light + rim rotation |
| `visible` | boolean | `true` | toggling materializes / dematerializes |
| `debug` | boolean | `false` | paints the displacement map |
| `accent` | preset \| color | inherited | colors body, backdrop, rim, glow, pointer light |
| `accentStrength` | `'subtle' \| 'tinted' \| 'vivid'` \| 0..1 | inherited (tinted once accented) | how strongly |
| `backdrop` | `'dark' \| 'mid' \| 'light'` | inherited (dark) | selects the contrast scrim |
| `interactive` | boolean | `false` | elastic control (buttons, chips, thumbs) |
| `pressable` | boolean | `false` | press scale + flare |

`ULGlassGroup` — `spacing` (px gap, later the merge distance), `direction`.

Engine (framework-agnostic): `attachGlass`, `detachGlass`, `configureGlass({ strength, forceFallback })`, `supportsRefraction`, `generateDisplacementMap`, `materialize`, `trackPointer`.
Motion: `createSpring`, `springs.{bouncy,smooth,snappy}` (same curves as the `--ul-ease-*` tokens).
Hooks: `usePointerLight`, `useReducedMotion`, `useReducedTransparency`, `useMediaQuery`.

## Performance
```tsx
<ULGlass quality="auto" />                 // default: governed (full within the budget, else lite)
<ULGlass quality="lite" />                 // blur + saturate + CSS colorize, no SVG filter
<ULGlass quality="flat" />                 // no backdrop-filter
<ULGlass priority="overlay" />             // ranked first (anchored surfaces / role=dialog get this automatically)
configureGlass({ budget: 'auto' })         // or an area in px² (e.g. 150000), or Infinity
getGlassStats()                            // { visible, refract, lite, flat, budget, areaUsed, refractCount, degraded, … }
```
Budget and thresholds are tokens (`perf.*`, see DESIGN.md "Performance rules"). Dev HUD: load `showcase/perf-hud.js` before the bundle and press Shift+P (fps, p95 frame time, JS per frame, glass / backdrop-filter / refracted counts, light writes per second, budget; "Run bench" stores idle / scroll / pointer results in localStorage `ul-perf-results`).

## Build
- `npm run check:locked` → `node scripts/check-locked.mjs`: compares tokens.json, tokens.css and DESIGN.md with `scripts/locked-timings.json` (42 locked names) and prints "42 checked, N differences"; exit 1 on any difference. `npm run tokens`, `npm run build` and `build:min` run it too.
- `npm run typecheck` → `tsc --noEmit` over `src/` (tsconfig.json). Not run inside the design tool (no Node); run it locally before a release.
- `npm run build` → `dist/ul-glass.js` (readable) + `dist/ul-glass.css`.
- `npm run build:min` → also `dist/ul-glass.min.js` + `dist/ul-glass.min.js.map`. The min build sets `window.__UL_PROD__ = true`, which turns off dev warnings. Not shipped yet; the landing loads the readable bundle.

## Selection (Phase 2b)
```tsx
<ULCheckbox label="Newsletter" defaultChecked />
<ULRadioGroup label="Billing" defaultValue="monthly"><ULRadio value="monthly" label="Monthly" /><ULRadio value="yearly" label="Yearly" /></ULRadioGroup>
<ULSwitch label="Sync" onCheckedChange={setOn} />
<ULSlider label="Opacity" defaultValue={40} format={(v) => `${v} %`} />  <ULRangeSlider label="Budget" defaultValue={[20, 80]} />
<ULSegmentedControl aria-label="Range" options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />
<ULStepper aria-label="Brief" current={1} steps={[{ label: 'Goal' }, { label: 'Scope' }, { label: 'Budget' }]} />
<ULSelect label="Country" options={[{ value: 'sk', label: 'Slovakia' }]} />  <ULCombobox label="City" options={…} />
<ULDatePicker label="Start" locale="sk" />  <ULColorPicker label="Accent" defaultValue="violet" />
```
Every list / calendar / color panel is a `ULAnchoredSurface` (anchored morph, portal). Labels need a surface on busy backdrops (glass panel or `data-ul-surface="solid"` scrim).
`ULColorPicker presets` takes names or `{ value, disabled?, label? }`; a disabled preset is shown crossed out and skipped by the arrow keys.

## Lens bubble, switch, slider, tabs
- Shared: `LensBubble` + `createLensSelect` (exported). Controls: `ULSwitch lens`, `ULSlider lens / orientation`, `ULRangeSlider`, `ULSegmentedControl lens`, `ULTabs { items: [{ value, label, content? }], orientation, lens }`.
- Switch: drag to set (decided on release), click toggles, Esc / pointercancel restore. onCheckedChange fires once per release, only when the state changes.
- Slider: value commits immediately, the thumb glides on `--ul-slider-follow`; the value tooltip is a child of the thumb.
- Tokens: `--ul-lens-scale` 1.3, `--ul-lens-overshoot` .04, `--ul-lens-grow-duration` 380ms, `--ul-lens-shrink-duration` 320ms, `--ul-lens-drag-stretch` .14, `--ul-lens-magnify` 1.06, `--ul-lens-radius-mode` concentric, `--ul-lens-radius` 12px, `--ul-lens-overgrow-switch` 2px / `-slider` 6px / `-tabs` 2px, `--ul-lens-rubber` .55, `--ul-lens-flick` 140ms, `--ul-lens-lead` 70ms, `--ul-lens-trail` 150ms, `--ul-switch-thumb-ratio` 1.55, `--ul-switch-drag-threshold` 4px, `--ul-slider-thumb-ratio` 1.5, `--ul-slider-follow` 75ms, `--ul-tooltip-hide-delay` 400ms. Switch track 64×28, inset 2.
- Timings: `--ul-lens-grow-duration` 570ms, `--ul-lens-shrink-duration` 300ms, `--ul-lens-settle-hold` 60ms, `--ul-switch-toggle-duration` 560ms, `--ul-tabs-press-glide` 280ms, `--ul-tabs-glide` 300ms, `--ul-lens-follow` 80ms. Switch 62×27, thumb ratio 1.57, `--ul-lens-scale-switch` 1.55, `--ul-lens-overgrow-switch` 5px.
- Tabs / segmented: one indicator node (the bubble rests as a flat capsule in the list).
- Engine: `wakeGlass(el, on)` (visible + measured + tiered now, for display-toggled surfaces).
- Tests: `showcase/motion-test.dc.html` thumb cards (`showcase/thumb-harness.js`). Perf HUD: "Drag bench" (3 s constant drag + flick on the first slider in view: fps, p95, long frames, stalls, max discontinuity, LoAF script / forced-layout ms).
- Screenshots: the bubble layer is fixed at the document root; DOM-based screenshot tools that capture only the page root miss it.

## Overlay scroll behavior
- `<ULAnchoredSurface scrollBehavior="lock|follow|fixed|close" onAnchorHidden="keep|hide|close">` (or `scrollLock`). Defaults: role menu / listbox / dialog = lock, otherwise follow + keep. Tooltips: follow + hide. Anchored toasts: pass `fixed`.
- Framework-free: `new AnchoredMorph(parts, { scrollBehavior, onAnchorHidden, onRequestClose })`; `lockPageScroll(owner)` / `unlockPageScroll(owner)` for custom modals.
- Bench: `showcase/scroll-bench.dc.html`. Test: motion-test → Overlay scroll behavior.

## Anchored motion: how to verify
Every anchored overlay opens and closes through `AnchoredMorph` (via `ULAnchoredSurface` / `useAnchoredMorph`, or `new AnchoredMorph(…, { manual: true })` for framework-free owners). Each run dispatches a bubbling `ul:morph` event on the surface: `detail = { phase: 'enter' | 'exit', state: 'start' | 'end' | 'interrupted', duration, reduced, morph }`.
- `showcase/motion-test.dc.html`: select, combobox, date picker, color picker, split-button menu, tooltip, island notification. `landing/chrome/motion-test.dc.html`: megamenu, language popper, studio tooltip. Both auto-run (`?norun` to skip) and show a pass/fail card + w/h curve per overlay.
- Perf HUD (Shift+P) → **Motion test**: runs every visible `[aria-haspopup]` trigger on the current page.
- Checks: t=0 rect = anchor (±2px) and the anchor wins the hit-test · ≥ 5 intermediate widths and heights · overshoot > 0 then settles · enter ≈ `--ul-pop-enter-duration` × time scale, exit ≈ 70 % · anchor hit-testable every frame · surface painted on top of the page in flight · tier frozen · rim ramps from 0 · content hidden at t0 · translation leads size · reduced motion = uniform 150ms scale/fade · interruption 40 % / 60 % without a jump.
- Driver: live `requestAnimationFrame` sampling when the tab renders normally; if rAF is throttled (background tab, headless preview) the harness pauses the morph's WAAPI animations and seeks them in 16.7ms steps, so the geometry is still the real rendered one. The card says which driver ran. Rim (rAF-driven) reads n/a on the virtual clock.
- `configureMorph({ timeScale: 4 })` (the ×0.25 switch) slows every morph; the tests scale their expectations with it. `configureMorph({ reducedMotion: 'reduce' | 'no-preference' | 'auto' })` overrides the media query (tests).

## Containers + overlays (2c)
```tsx
<ULCard size="sm|md|lg" title="Orders" description="12 open" href="/orders" footer={<ULButton size="sm">Archive</ULButton>} />
<ULPanel surface="glass|calm|well" title="Invoices">…</ULPanel>            // calm / well never refract: data goes here
<ULModal open={o} onOpenChange={setO} triggerRef={btn} title="Rename" size="sm|md|reading" role="dialog|alertdialog" footer={…} />
<ULSheet …/>  <ULDrawer side="right|left" … />  <ULPopover triggerRef={btn} arrow reading />  <ULTooltip content="Copy"><button/></ULTooltip>
<ULToastProvider position="bottom-right"> … const { toast } = useToast(); toast({ title, tone, action }) </ULToastProvider>
<ULToast open anchorRef={btn} title="Link copied" />                     // anchored toast, fixed while open
<ULAccordion type="single|multiple" items={[{ value, title, content }]} />
<ULSidebar sections={…} value collapsed onCollapsedChange drawer="auto" /> <ULToolbar label="Formatting" groups={…} />
<ULMenu open anchorRef items={[{ id, label, shortcut, type: 'checkbox'|'radio'|'separator'|'label', items: [submenu] }]} />
<ULMenuButton items={…}>Actions</ULMenuButton>  <ULContextMenu items={…}><div tabIndex={0}/></ULContextMenu>
<ULCommandPalette open onOpenChange items={[{ id, label, group, keywords, onRun }]} triggerRef={search} />   // Cmd / Ctrl + K
```
- Every overlay is `ULAnchoredSurface` (anchored morph + clip-path hole + shared scroll behavior + overlay stack). New props: `layout` (anchored | center | top | bottom | left | right), `scrim`, `modal` (aria-modal + focus trap + focus return), `initialFocus`, `returnFocus`, `manual`, `stack`, `arrow`, `morphRef`.
- Triggerless overlays start from a virtual anchor (`createVirtualAnchor`, `edgeRect`, `centerRect`, `pointRect`): drawers from the viewport edge, context menus from the pointer point (0 × 0), the palette from the centre.
- Esc / outside click close only the top layer (`pushOverlay` / `isTopOverlay`); modals stack (the covered one steps back to `--ul-modal-stack-scale`).

## Data (2d)
```tsx
<ULStatTile label="Revenue" value={22840} format={eur} delta={7.8} sparkline={[…]} loading? />
<ULTable label="Invoices" columns={[{ key, header, sortable, numeric, render, value }]} rows rowKey selectable rowActions={(r) => items}
         density="compact|cozy|comfortable" maxHeight={520} page pageSize onPageChange virtual={{ rowHeight: 48 }} loading empty={…} />
<ULChart kind="line|area|bar" title="Revenue" labels={months} series={[{ name, data }]} format={eur} />
<ULBadge tone variant dot/> <ULAvatar name src status/> <ULAvatarGroup people max/> <ULProgress value label kind="bar|ring"/>
<ULSkeleton shape lines/> <ULEmptyState title description action/> <ULBreadcrumbs items maxItems/> <ULPagination page pageCount onPageChange/>
```
- Data never sits on refracted glass: tables, tiles and charts use `--ul-data-surface` / `--ul-data-well` (calm). Glass appears only in controls, the row-actions menu and the chart value tooltip.
- Table rows use a flat native checkbox (`RowCheck`), not ULCheckbox: 200 rows must not mount 200 glass surfaces. Select-all stays ULCheckbox.
- Table keyboard: one tab stop (role grid); arrows, Home / End, Ctrl+Home / End, PageUp / PageDown move the focused cell; Space selects the row; Enter activates the cell's control.

## Pickers, check mark, item radius (2e)
```tsx
<ULDateRangePicker label="Period" defaultValue={{ start, end }} onValueChange={(r) => …} locale="sk" months={2} presets min={…} max={…} isDateDisabled={(d) => …} />
<ULColorPicker label="Accent" defaultValue="violet" />   // presets + "Custom color" expander (2D field, hue, hex, eyedropper)
<ULCheckMark checked={selected} />                       // the one check for lists, menus and pickers
```
- **ULDateRangePicker**: value `{ start, end }`; `onValueChange` fires once per commit (end chosen, preset, clear), never for the hover / focus preview. Trigger shows two segments ("12 Nov – 20 Nov") and a clear button (`clearable`, default true). Opens in a ULAnchoredSurface (reading variant, portal, scroll lock, anchored morph); below 640px: 1 month in a bottom sheet. Locales EN (en-GB) · SK · DE · CS, Monday first. Presets: Today, Last 7 days, Last 30 days, This month, Last month (`presets` true or a subset).
- Keys: arrows ±1 day / week, PageUp / PageDown ±1 month (Shift ±1 year), Home / End row start / end, Enter / Space pick, Esc cancels a selection in progress (restores the previous range), otherwise closes. Disabled days are skipped. Live region announces the start and the range.
- **ULDatePicker** shares the calendar grid (`isDateDisabled` added).
- **ULColorPicker**: "Custom color" expands the same surface (height measured, never animated to auto); Esc collapses first, then closes. Custom colours go through `guardAccent(color)` (exported): if a colour would break 4.5:1 it is clamped into `--ul-accent-custom-l-min / -l-max / -c-max` (OKLCH) and the picker shows "Adjusted for contrast" with the chosen and the applied swatch. `onValueChange` receives the applied colour.
- **ULCheckMark** (`animateCheck(el, on)` for non-React owners): draw-in enter, fade + scale exit, `--ul-check-*` tokens. No animation on mount / overlay open.
- **Item radius**: rows and the shared hover lens inside every anchored surface use `--ul-item-radius` = clamp(`--ul-menu-item-radius-min`, popper radius − popper padding, `--ul-menu-item-radius-max`). Resolved on the surface, so rows and lens always match.
- **Sheet drag**: mobile bottom sheets (≤ 640px) dismiss by dragging the grabber or the nav bar; content scroll always wins. Desktop sheets have no drag.
- Tests: `showcase/motion-test.dc.html` (overlays, containers, 2e cards), `showcase/lens-tests.dc.html` (lens / thumb cards on their own page), `showcase/viewport-tests.dc.html` (toasts, radius and narrow range at 1280×800, 924×540, 375×667 in iframes).

## Overlay guarantees (2026-11-08)
- `<ULAnchoredSurface anchorVisibility="above|covered">`: covered (default for modal / alertdialog) renders scrim + surface in the top layer from the first frame; above (default otherwise) keeps the trigger visible through the clip hole while morphing.
- After every close the surface and its helpers are unmounted and no inline style survives; owners may clear their anchor or items on close.
- Nested menus sit beside the parent with `--ul-submenu-gap` (2px).
- While anything scrolls, glass state is frozen (`isGlassScrolling()`); tiers, maps and budget update ~150ms after scrolling stops. `showcase/glass-scroll-harness.js` → `ULGlassScrollTest.run({ steps: [1, 3, 20], ms: 2000 })` asserts it on any page.

## Tokens
Edit `tokens/tokens.json`, then `npm run tokens` → `tokens/tokens.css`. Hex colors also emit `--ul-color-*-rgb` triplets for alpha use. Springs emit `linear()` easings plus their natural settle time; pair bouncy with `--ul-duration-slow`, smooth with `base`, snappy with `fast`.

## Browser support
| engine | material | notes |
|---|---|---|
| Chromium (Chrome, Edge, Arc, Opera, Android WebView) | full refraction (SVG displacement) | mobile policy: lens ×0.5, surfaces > 40000 px² blur-only |
| Safari / WebKit (macOS, all iOS browsers), Tauri on macOS (WKWebView) | blur-only fallback | tint, rim, depth and accent backing kept; never a flat gray plate |
| Firefox | blur-only fallback | same as WebKit |
| prefers-reduced-transparency | solid surface | deep accent kept |
Refraction uses `backdrop-filter: url(#svg-filter)`, which only Chromium renders. Detection is by engine, not `CSS.supports` (WebKit reports support but renders nothing).

## Showcase
- `showcase/Showcase.dc.html`: material, elasticity, anchored morph, accent, island, tiers. Loads `../dist/ul-glass.js` (no in-browser transpile). `showcase/dev-loader.js` is kept only for live-editing `src/` locally.
- `showcase/Components.dc.html`: Phase 2 components in tabs (one section mounted at a time), every variant × state, theme / accent / backdrop / blur-only / slow-motion / background switches, a live contrast table, Tweaks for the refraction budget (auto / fixed / unlimited) and the perf HUD (Shift+P).
- `showcase/ambient-bg.js`: `<ul-ambient-bg animate>`, the pausable animated backdrop shared by both showcases.

## Buttons (Phase 2a)
`ULButton` props: `variant` primary | secondary (default) | tinted | plain | destructive · `size` sm 36 | md 44 | lg 52 (hit area ≥ 44 always) · `shape` capsule | rounded | circle · `icon`, `iconEnd` (icon with no children = icon-only, needs `aria-label`) · `loading` (width kept, spinner, `aria-busy`, clicks ignored) · `disabled` · `href` (real `<a>`) · `pressed` + `onPressedChange` (toggle, `aria-pressed`) · `accent` · `backdrop` (use `light` on busy backdrops) · `fullWidth`.
- Material: ULGlass tier sm, `interactive` + `pressable` (elastic 2-3px from `--ul-elasticity`, press .97 + flare). primary = vivid accent, tinted = tinted accent, secondary = subtle, destructive = vivid `--ul-color-danger`. plain has no surface and does not move; use it only on solid or glass surfaces.
- `ULToggleButton` (controlled or `defaultPressed`), `ULButtonGroup` (`attached`: one glass capsule, the buttons inside are flattened; `attached={false}`: gap only), `ULSplitButton` (`items`, menu via ULAnchoredSurface, ↓/↑ open, Home/End, Esc returns focus), `ULFab` (56px, `label` for extended, `placement` with safe-area insets).

## Fields (Phase 2a)
Shared props (`FieldBaseProps`): `label` (required, floats by default; `floating={false}` puts it above) · `helper` · `error` (sets `aria-invalid`, replaces helper, polite live region) · `leading` / `trailing` · `size` md 56 | compact 44 · `shape` rounded | capsule · `loading` · `disabled` · `required`.
- `ULTextField` `type` text | email | password (reveal button) | search (capsule, clear button, Esc clears, `expandOnFocus`) | url | tel; `onValueChange`.
- `ULTextArea` auto-grows from `minRows` (3) to `maxRows` (10), then scrolls.
- `ULNumberField` `role="spinbutton"`, −/+ buttons, ↑↓, PageUp/PageDown ×10, Home/End, `min`, `max`, `step`, Intl `format`.
- `ULOtpField` `length` (6), numeric | alphanumeric, paste fills, Backspace goes back, `autocomplete="one-time-code"`, `onComplete`.
- `ULTagField` Enter / comma adds, Backspace removes the last, chips with "Remove {tag}" buttons, announcements in a live region, `validate`, `maxTags`.
- The well is an inset recess, not glass: `--ul-field-well` (graphite 88%) keeps text ≥ 4.5:1 over white and it can sit inside any glass surface. Inputs never move; they only catch pointer light. Put fields on a panel (`ULGlass backdrop="light"`) when the page behind is busy, so the helper and error text have a backing.


## Accent
`--ul-accent` (color) and `--ul-accent-k` (strength) are registered properties, so hue and strength changes animate (`--ul-accent-duration` 600ms, 1ms under reduced motion).
```tsx
<ULGlass accent="violet">…</ULGlass>                       // preset → strength "tinted" by default
<ULGlass accent="amber" accentStrength="vivid">…</ULGlass> // subtle | tinted | vivid | 0..1
<ULGlass accent="#ff7a59">…</ULGlass>                     // any CSS color
<ULAccentScope accent="emerald" strength="subtle">…</ULAccentScope>  // set once, everything inside inherits
<section data-ul-accent="rose" data-ul-accent-strength="vivid">…</section>
setAccent(el, 'violet', 'vivid')                          // imperative (observers, island)
```
Glass without any accent keeps the neutral ice look (subtle).

| strength | k | use |
|---|---|---|
| subtle | .22 | ambient surfaces, close to the stage-B look |
| tinted | .64 | default for accented glass: clearly colored body |
| vivid | 1 | hero elements (island, primary buttons) |

### Contrast guard
Text and icons stay neutral. Declare what's behind the glass with `backdrop` / `data-ul-backdrop`: `dark` (default, luminance ≤ .03), `mid` (≤ .2) or `light`. Each class gets a deep accent backing (accent 32% + black, never neutral gray), sized per strength so that secondary text at rest and primary text under full pointer light both reach 4.5:1 for every preset. `accentContrastReport(el)` re-checks every accent × strength × backdrop for the theme on `el`.

| backing α (subtle / tinted / vivid) | dark | mid | light |
|---|---|---|---|
| app | .02 / .20 / .18 | .63 / .66 / .64 | .84 / .83 / .80 |
| marketing | .12 / .38 / .40 | .72 / .76 / .76 | .88 / .88 / .88 |

## ULIsland (dynamic island)
```tsx
<ULIsland state="compact" accent="violet" label="Main" onDismiss={…}>
  <div data-slot="compact">…</div>
  <div data-slot="expanded">…nav…</div>          // pill swaps content + size on the overshoot spring
  <div data-slot="notification">…</div>          // pours out of the pill (ULAnchoredSurface)
  <div data-slot="tools"><ULIslandTool aria-label="Language">EN</ULIslandTool></div>
</ULIsland>
```
- **States:** `compact`, `expanded`, `notification`. Props `compact / expanded / notification / tools` work as an alternative to slots.
- **Accent:** an accented island defaults to `--ul-island-accent-strength` (vivid). Menus and dialogs opened from it use `tinted` for readability.
- **Elasticity:** `--ul-island-elasticity` (.5 × size tier × global) for the pill and tools; menu items use `--ul-island-item-elasticity` (2.5 → ≈3px pull).
- **Menu blur:** `--ul-island-menu-blur` (16px) overrides the tier blur on island menus only, for text legibility.
- **Page-aware accent:** `observeSectionAccent({ island, scope, root, fallback, onValueChange })` picks the deepest `[data-ul-accent]` element under the island's center line. It uses IntersectionObserver plus geometry, keeps the current element until the line is `--ul-island-hysteresis` (24px) past it, and commits after `--ul-island-switch-delay` (140ms) of stability.
- **Reveal-on-hover rows:** `data-ul-reveal="hover"` on a (nested) ULGlass makes it a glass card only on hover, focus or `aria-current`. Nested glass stays flat (no backdrop) but may be `interactive` (elastic).

### Header config (one typed config, pages only select it)
`src/components/ULIsland/headerConfig.ts` → `HeaderConfig { variant, leading: logo|back, nav[], megamenu, cta, poppers, studioLink, accent, sticky, indicatorRest, legibility }`. `ULIsland config={…}` renders the expanded face from it. On the landing, `chrome/SiteHeader` maps `variant` (`landing` | `docs`; legacy `mode="docs"` still works) to a config. Per-page overrides: `sticky`, `indicatorRest`, `config`.

| variant | leading | nav | megamenu | CTA | poppers · studio link | indicator rests on current |
|---|---|---|---|---|---|---|
| landing | logo → / | Solutions ▾ · Our work ▾ · (Pricing) · Company ▾ | yes | yes | lang · studio | no |
| docs | back arrow → / | Legal · Releases · API · Guides | no (no anchor, no pane) | no | lang · studio | yes |

### Floating nav indicator
`createNavIndicator({ container, lens, items, rest })` (`ULIsland/navIndicator.ts`) drives one flattened glass lens that glides between nav items on hover and keyboard focus.
- **Motion:** spring with ζ ≈ .78 for a tiny overshoot. Squash and stretch along the travel axis, capped at `--ul-pop-stretch` × `--ul-elasticity`. No goo. Every move starts from the current pose.
- **Visibility:** it materializes out when the pointer leaves the nav, and rests on `aria-current` only when `indicatorRest` is set.
- **Re-measures** on resize, font load, item and aria-current changes.
- **Reduced motion:** it jumps and fades instead of sliding.
- **Look:** tint is `--ul-island-lens-tint`. The selected highlight and underline on nav items are gone.

### Overlay legibility
`legibility: 'high'` (the default) puts the megamenu, language popper, mobile sheet and contact brief on the worst-case (`light`) backing class with `--ul-island-menu-blur` 20px and `--ul-island-menu-magnify` 1, so refraction stays in the bezel. Items are real links/buttons with a full-card hit area of at least 44px. Keyboard: Tab, ←/→ in the nav, ↑/↓ inside a pane, Enter/Space, Esc returns focus. Items are flat glass cards: elastic about 3px, press `--ul-island-item-press` .98 with flare.

### Loading
Pages load `dist/ul-glass.js` (prebuilt, about 210 KB unminified, no in-browser transpile; CSS inlined). `SiteHeader` injects it while it is being constructed, resolved from `landing/page-tokens.css`. Until then the island shows the calm blur fallback, and `rampGlass` crossfades the lens in over 420ms. Rebuild with `node scripts/build-bundle.mjs` after changing `src/`. The showcase keeps the source loader.

### Language popper and studio link (landing header)
- **Language:** one row of four flag links EN · SK · DE · CS (flag 32px, code in 11px mono below; hit area 56×60 per link; popper 248px wide, 6px padding). Real `<a lang hreflang>`, `aria-label` = full name, `aria-current` + accent dot on the current one. The shared `createNavIndicator` glides horizontally. Keys: ←/→, Home/End, Enter/Space select, Esc closes. Names show in the shared anchored tooltip (no `title`).
- **Flags:** `icons/flags/{en,sk,de,cs}.svg` from circle-flags (MIT, HatScripts). en = us (the code stays EN), cs = cz. See `icons/flags/LICENSE.md`.
- **Studio link:** one round icon button (`icons/layout-grid.svg`), a real `<a>` to `https://studio.ultralabs.app` (`STUDIO_URL`), `aria-label` and tooltip "Go to studio". Same flattened elastic glass as the language button. No popper, no session detection, no cookie: Studio handles its own sign-in redirect. Hide it per variant with `studioLink: false`.
- **Removed:** the account popper (signed-in and signed-out), `sessionAware`, `signedIn`. Archived in `_archive/liquid-glass-old/user-popper/`. `docs/auth-cookie-flag.md` is kept but not used.
- **Contrast** (worst case: light backdrop, all accents, tinted, lens under text + full pointer light): 4.84:1 minimum (amber). Tooltip 17.8:1.

### Anchored tooltip
`createAnchoredTooltip({ container, layer, items?, text?, side?, clear?, delay? })` (`src/components/ULTooltip/anchoredTooltip.ts`). Delegated hover (350ms) and keyboard focus (immediate); Esc, pointer down and leaving hide it. Enter/exit through `AnchoredMorph` (manual placement, works inside scaled ancestors). The surface is opaque and never samples glass. It sets `aria-describedby` only when its text differs from the item's label. `ULIslandTool tip="…"` uses it.

### Mobile bottom bar
`landing/chrome/SiteMobileBar.dc.html` is the only mobile bar. Every page with a mobile bar imports it: AppDetail, AppsHub, CareersPage, CareerDetail (+ v1), ContactPage, DevelopersPage, HubPage (+ pre-wow), PillarPage, PricingPage, VerticalPage, WorkIndex, WorkDetail, the riesenia-v2 spec frame and the chrome/mobil-sheet spec. Props: `variant` (floating pill | docked strip), `top`, `cta`, `ctaHref` (default `/contact`), `glyphColor`, `accent`, `menuOpen` (menu ↔ close icon and label), `onMenu`. Diamond mark → `/`, CTA and menu are interactive glass (press .98, 48px). It loads `dist/ul-glass.js` itself, because the header is not mounted on mobile. `chrome/DocsBottomBar` stays separate (docs section switcher, not this bar).

### Mobile glass policy
`isMobileGlass()` = touch and ≤ 1024px (or `configureGlass({ forceMobile: true })`). Tokens: `--ul-mobile-refraction-scale` (.5, multiplies every lens), `--ul-mobile-refraction-max-area` (40000 CSS px², about 200×200; larger surfaces use the blur fallback), `--ul-mobile-fallback-tint` (.04), `--ul-mobile-fallback-rim` (.22). Result on Android: the sheet is blur-only, the floating bar keeps a lens at ×0.5, the controls inside it are flat. iOS / WebKit never refracts; `[data-ul-mode="fallback"][data-ul-mobile]` adds frost (+14px blur), a brighter top rim, an accent hairline and an inner bevel, on the same accent backing as the megamenu. Check page: `landing/chrome/mobile-glass-check.dc.html`.

### Rebuilding dist without Node
`scripts/build-bundle.mjs` needs esbuild. The design tool rebuilds the same format in the browser: Babel standalone, every module from `src/index.ts` as a `def(id, deps, fn)` CJS block, CSS pushed into `css[]`, header and boot footer kept from the previous `dist/ul-glass.js`.

### On the landing
`landing/chrome/SiteHeader.dc.html` is the single header component, imported by every page (`chrome/SiteHeader`). It keeps its layout, links and behavior and uses the engine directly:
- **Glass:** the pill, the language button, the studio link, the menu panel and the contact surface are ULGlass in the marketing theme.
- **Menus:** mega menu and language open and close with `AnchoredMorph` from their trigger (`manual` placement: the header owns layout; scaled ancestors supported).
- **Menu items:** reveal-on-hover elastic glass cards.
- **CTA:** "Start a project" pours into the contact brief (`contact/ContactDialog`, `entry="brief"`) with the same morph, and reverses on close. The brief resolves from `landing/contact/` for pages in subfolders (chrome/, docs/) via `window.__resources`, no copy.
- **Accent:** taken from the section under the island (`data-ul-accent` on HubPage sections and pillar rows). The fallback is the page's `--page-accent`.
- **Loading:** the library is loaded by the header itself, resolved from `landing/page-tokens.css`.
- **Docs mode** (`mode="docs"`) keeps its previous white glass.

## Project layout
```
design-system/     this library only — never imports from landing/ or apps/
  tokens/          tokens.json (source) → tokens.css (generated, incl. themes)
  scripts/         build-tokens.mjs, build-bundle.mjs, check-locked.mjs + locked-timings.json
  src/glass/       engine.ts, ULGlass, ULGlassGroup, radius.ts
  src/motion/      spring, placement, goo, anchoredMorph
  src/hooks/       usePointerLight, useReducedMotion, useAnchoredMorph
  src/components/  ULAnchoredSurface (more from stage 2)
  icons/           36 line icons + icons.json (carried over from the v0 spec)
  showcase/        live page of every component and state
  dashboard-demo/  (stage 5)
landing/           live marketing site (entry: "Landing Page.dc.html"); may import design-system/
apps/              auth, identify, studio + their shared ds/ tokens
_archive/          moved, never deleted: design-system-v0, liquid-glass-old, qa, Canvas
```
Dependency rule: `design-system → nothing`. `landing` and `apps` may import `design-system`.

## Themes
Same tokens, different values, selected with `data-ul-theme` on the root (or any subtree):
- `app` (default, no attribute needed): full glass, the tuned refraction, bezel, blur and tint.
- `marketing`: restrained, matches the landing (graphite #060509, Poppins / Geist Mono, 24/32px radii, lens scale about 55%, aberration 1, softer light, elasticity .3, no goo, minimal overshoot). Blur, bezel and tint are unchanged.

Defined in `tokens.json → $themes`. Themes override leaf tokens directly, because a `var()` inside a custom property resolves where it is declared.

## Stages
1. ✅ Tokens, ULGlass primitive, showcase skeleton
2. Phase 2 core components: ✅ 2a buttons + inputs · ✅ 2b selection · ✅ 2c containers + overlays · ✅ 2d data (narrowed). Next: v0.1 freeze (docs/v0.1-freeze-checklist.md), then app shell (not started).
See `DESIGN.md → Component index` for status and `CHANGELOG.md`.

## Live data, KPI and context menus (Part 3, 2026-11-08)
### Live source (WebSocket)
The library ships no server URL and no token. The app supplies the target and the auth.
```tsx
const source = createLiveSource<Msg>({
  transport: websocket('wss://api.example.com/live'),   // wss only; ws:// only on localhost; credentials in the URL are refused
  getAuth: async () => ({ token: await session.getAccessToken() }), // called before every (re)connect, never put in the URL
  idOf: (m) => m.id,                                   // dedupe
  seqOf: (m) => ({ key: m.key, seq: m.seq }),          // drop out-of-order
  schema: (m) => isMsg(m),                             // or a zod-like { safeParse }
  rateLimit: { max: 60, policy: 'coalesce', key: (m) => m.key },
  reconnect: { base: 500, max: 30000 },                // exponential backoff, full jitter
  heartbeat: { interval: 15000, timeout: 5000, ping: () => ({ t: 'ping' }), isPong: (m) => m.t === 'pong' },
});
source.onStatus((s, info) => console.log(s, info?.retryIn)); // connecting | live | reconnecting | stale | offline | paused | error
<ULLiveStatus source={source} />                              // dot + label + pause / resume (WCAG 2.2.2)
```
Auth: the transport receives `ctx.auth` and decides how to send it (subprotocol or a first message the app controls). SSE (`sse(url, { withCredentials })`) authenticates with cookies only. `polling(fn, ms)` and `mock({ rate, latency, jitter, drops, duplicates, reorder, failConnects, silent, generate })` share the same API.
### Store → table and KPI grid
```tsx
const rows = useLiveStore<Order, Msg>(source, { key: (r) => r.id, initial, toOps: (m) => m.op === 'del' ? { op: 'remove', key: m.id } : { op: 'upsert', value: m.row } });
<ULTable store={rows} rowKey={(r) => r.id} columns={cols} label="Orders" rowMenu={(r) => items(r)} />   // only changed rows re-render; structural changes queue while hovered
function Tile({ k }) { const r = useLiveRow(kpis, k); return <ULKpiCard label={r?.label} value={r?.v ?? null} delta={r?.d} live updatedAt={r?.t} />; }
<ULKpiGrid label="Live KPIs">{keys.map((k) => <Tile key={k} k={k} />)}</ULKpiGrid>
```
One commit per frame (`--ul-live-max-fps`), messages batched per frame, buffered with a cap while paused or hidden.
### Context menus
`contextMenu?: MenuItem[] | ((target) => MenuItem[] | null)` (null / [] keeps the native menu), plus `onContextMenuOpen`, `onContextMenuClose`, `onContextMenuAction(id, target)`, `contextMenuNative: 'never' | 'on-text-selection' | 'on-editable'`. Right-click, long-press (500ms, movement cancels, scroll wins), ContextMenu key, Shift+F10. Built on ULMenu + the anchored morph at a 0 × 0 pointer anchor; one handler set per component root.
| component | target |
|---|---|
| ULTable `contextMenu` / `contextMenuCell` / `contextMenuHeader` / `rowMenu` | `{ component: 'table', kind: 'row' \| 'cell' \| 'header', id: rowKey, data: row, column, selection }` — selection = the selected keys when the row is selected, else [key]. `rowMenu` feeds the ⋯ button AND right-click. |
| ULKpiCard | `{ component: 'kpi', kind: 'self', data: { label, value, delta, state } }` |
| ULStatTile | `{ component: 'stat', kind: 'self', data: { label, value, delta } }` |
| ULChart | `{ component: 'chart', kind: 'point', data: { index, label, values } }` · `kind: 'series', data: { series }` (legend chip) · `kind: 'plot'` |
| ULCard / ULPanel / ULBadge / ULAvatar / ULToast | `{ kind: 'self', id }` (ULToast: data = the toast options) |
| ULTabs / ULSidebar / ULAccordion / ULBreadcrumbs / ULTagField | `{ kind: 'tab' \| 'item' \| 'header' \| 'crumb' \| 'tag', id, data }` (items only) |
| anything else | `<ULContextTarget contextMenu={…} target={{ kind, id, data }}>{child}</ULContextTarget>` |
While a row's menu is open the row is pinned (structural changes queue like the hover rule; value updates apply); the menu closes with the normal exit if the row is removed anyway. Focus returns to the row / cell.
### Rolling number
One cell = `--ul-kpi-roll-h` (em). At rest each digit is ONE static glyph; while it rolls a strip of whole cells (start → target) moves in the same unit and is removed on settle. The value is one non-wrapping row; separators, currency, % and k are static glyphs. KPI values scale with the tile (`min(3xl, 13.5cqi)`) instead of wrapping.
### Tests
motion-test cards: rolling number, context menu, pointer glass stability, drill-in 375px, toast over modal + backing, KPI states, live source, live table, data glass. `?glassdebug` → "Record pointer / wheel" records style writes per frame with the real mouse.

## Actions (Part 4, 2026-11-08)
One core: `useAsyncAction` (idle → loading → success | error → idle) + `ULActionButton` (ULButton + icon / label swap, width morph, success ring, error shake). Every component below is a thin layer over it. Feedback goes through the shared anchored tooltip AND one polite live region (`announce`). Labels are localised EN / SK / DE / CS (`locale` prop, else `<html lang>`).
```tsx
<ULActionButton onAction={() => api.publish()} labels={{ idle: 'Publish', loading: 'Publishing…', success: 'Published' }} icons={{ idle: <ULIcon name="send" /> }}
  successDuration={1800} errorDuration={3000} minLoadingMs={350} feedback="inline|tooltip|both" widthMode="morph|reserve" status={controlled} onSuccess onError />
const { status, error, run, reset } = useAsyncAction(save, { minLoadingMs: 350 });     // headless; throw ACTION_CANCEL to go back to idle silently

<ULCopyButton value="INV-2026-0042" />                                   // button: Copy → Copied, tooltip "Copied to clipboard"
<ULCopyButton variant="icon" label="Copy API key" sensitive value={() => vault.key()} />   // value never in tooltip / aria / live region
<ULCopyButton variant="inline" value="npm i @ultralabs/glass" html={richHtml} onCopy={() => track('copy')} />

<ULSaveButton dirty={dirty} onSave={() => api.save(doc)} shortcut />     // ⌘ / Ctrl+S; error → "Retry" until retried
<ULSaveStatus status="clean|dirty|saving|saved|error" savedAt={t} onRetry={save} />
const guard = useUnsavedChangesGuard(dirty); if (guard.shouldBlock()) …   // beforeunload + router-agnostic check

<ULSubmitButton onSubmit={(data, form) => api.send(data)} />            // validates the form first; or pending={isSubmitting}
<ULConfirmAction confirm="inline" label="Delete draft" onConfirm={del} />           // "Confirm?" + 3s countdown ring, Esc / timeout reverts
<ULConfirmAction confirm="hold" holdMs={1200} onConfirm={del} />                    // press and hold (Space / Enter too)
<ULConfirmAction confirm="type" typeText="client-portal" description="…" onConfirm={del} />   // opens ULModal, action disabled until it matches
<ULDownloadButton filename="invoices.csv" onExport={({ report }) => buildCsv(report)} />      // Blob | URL | text; report(0..1) = determinate ring
<ULExportButton formats={[{ id: 'csv', label: 'CSV' }, { id: 'json', label: 'JSON' }]} filename={(f) => 'report.' + f} onExport={({ format }) => exportAs(format)} />
<ULRefreshButton onRefresh={reload} autoRefresh={30000} />              // "Updated just now / n min ago", countdown ring, pauses when hidden; source={liveSource}
<ULToggleIconButton kind="star|favorite|pin|bookmark|mute" label="Star" onPressedChange={(on) => api.star(id, on)} />   // optimistic, rollback on reject
<ULShareButton url={href} title="Client portal" />                       // navigator.share when available, else copies the link
<ULUndoToast open={open} onOpenChange={setOpen} anchorRef={btn} message="3 invoices archived" onUndo={restore} />
```
Rules: the real `<button>`; `aria-busy` + `aria-disabled` (not `disabled`) while loading, so focus stays; no title attributes; never log or announce secrets; glass only where the button is glass (the swap happens inside it); 44px hit area. Tokens: `--ul-action-*`.

## Spam-safe actions, hold, ripple, success tone (Part 6, 2026-11-08)
```tsx
<ULToggleIconButton kind="star" label="Star" onPressedChange={(on) => api.star(id, on)} debounceMs={350} />   // flips at once; onPressedChange(final) once after 350ms of quiet
const C = useCoalescedAction({ defaultValue: false, commit: (v) => api.save(v) });   // C.value, C.status idle|pending|saving|error, C.set(v), C.flush()
<ULRefreshButton onRefresh={reload} />                       // coalesce="leading-trailing": runs now, clicks meanwhile = ONE follow-up
<ULActionButton coalesce="trailing" debounceMs={500} onAction={search} />
<ULConfirmAction confirm="hold" holdMs={900} onConfirm={del} />   // the fill sweeps the whole button (--ul-action-hold-ms)
<ULPublishButton onPublish={publish} published={isLive} onUnpublish={unpublish} />
<ULActionButton successEffect="ripple|ring|none" successTone="success|accent" … />   // ripple: save / submit / publish; ring: copy + icon buttons
```
Defaults: toggles trailing; refresh leading-trailing; copy, save, submit, confirm, download, share none (preventDoubleSubmit). Tokens: --ul-action-debounce-ms 350, --ul-action-debounce-max-wait-ms 2000, --ul-action-hold-ms 900, --ul-action-hold-release-ms 160, --ul-action-ripple-ms 520, --ul-action-ripple-fade-ms 240, --ul-action-ripple-delay 80ms, --ul-success, --ul-success-soft.
Clipboard: `copyText` uses the Clipboard API, else (missing API, http page, permission denied) the legacy hidden-textarea + execCommand copy, always inside the click handler (user gesture); both failing = error state. The value is never logged.

## Dashboard blocks (Part 6)
```tsx
<ULFilterBar fields={fields} value={filters} onValueChange={setFilters} count={rows.length} views={views} onSaveView={save} />
const rows = applyFilters(all, filters); const q = filtersToQuery(filters); const back = filtersFromQuery(q, fields);
const [cols, setCols] = useColumnsState(columns, { storageKey: 'accounts-cols' });   // per viewer, try / catch
<ULColumnsMenu columns={columns} value={cols} onValueChange={setCols} />          // drag the grip to reorder (Esc cancels); Move left / right stays for keys
<ULTable columns={applyColumns(columns, cols)} density={cols.density} contextMenuHeader={(t) => columnsMenuItems(columns, cols, setCols, { column: t.column })}
  selected={sel} onSelectionChange={setSel} pinSelection />                         // pin: 'left' | 'right' on a column = sticky
<ULBulkActionBar selected={sel} total={rows.length} onClear={() => setSel([])} onSelectAll={…} actions={[{ id: 'export', label: 'Export', onAction: (ids) => … }]} more={[…]} />
cells: <ULCellStatus value tone /> <ULCellProgress value /> <ULCellPerson name subtitle /> <ULCellNumber value delta format /> <ULCellTime value /> <ULCellSparkline data />
       <ULCellTags tags max /> <ULCellId value /> <ULCellActions items onAction /> <ULCellBool value /> <ULCellLink href />   (each: loading, empty)
<ULTimeAgo value={date} /> <ULTimestamp value={date} />                                // ONE shared timer, paused while the tab is hidden
<ULTimeRange value="24h" onValueChange={({ from, to, interval }) => …} /> <ULRefreshControl onRefresh={reload} />
<ULCopyField label="API key" value={key} masked revealTimeout={15000} />
<ULStatusPill status="operational|degraded|outage|maintenance|unknown" live /> <ULBanner tone title description action /> <ULBannerQueue items onDismiss />
<ULUsageMeter label value limit burnRate history warning critical action /> <ULErrorState message onRetry diagnostics support />
<ULDescriptionList items={[{ label, value, copy, truncate }]} layout="grid|stacked" /> <ULTruncatedText text lines />
```

### Success wave
`<ULActionButton successEffect="ripple|ring|none" successOrigin="center|pointer" successTone="success|accent" … />` — ripple is now a circular wave from the origin to the farthest corner (save, submit, publish); copy and icon buttons keep 'ring'.
Slow motion (showcase / review): `UL.setActionTimeScale(0.5 | 0.25)` scales only the action animations and their timers; `1` restores. The ring uses `--ul-success-ring` (green + success-ink edge, ≥ 3:1 on any backdrop).

## Dashboard blocks 2 (Part 11)
```tsx
<ULInlineEdit label="Seats" type="number" value={seats} onValueChange={setSeats} onCommit={(v) => api.save({ seats: v })} validate={(v) => (v < 1 ? 'At least 1' : null)} />
<ULNotificationCenter items={items} onReadChange={markRead} onMarkAllRead={markAll} itemMenu={(n) => [{ id: 'archive', label: 'Archive', onSelect: () => archive(n.id) }]} />
<ULActivityFeed events={events} filters={[{ value: 'deploy', label: 'Deploys' }]} onTargetClick={open} contextMenu={eventMenu} />
<ULCodeBlock samples={[{ value: 'curl', label: 'curl', language: 'bash', code }, { value: 'ts', label: 'TypeScript', language: 'ts', code: ts }]} highlight={[4]} />
<ULJsonViewer data={payload} label="Response" defaultExpandDepth={1} pageSize={100} />
```
- Inline edit: click / Enter edits, Enter saves (ULSaveButton states + success wave), Esc cancels; optimistic onValueChange, rolled back when onCommit throws (editor stays on Retry). Same 44px box in both modes.
- Lists that receive live items use `useLiveQueue(keys)` (callback ref on the list): changes apply at once unless the pointer or focus is inside; then an "N new" pill queues them.
- JSON viewer keys: ↑ ↓ Home End move, → expands / enters, ← collapses / goes to the parent, Enter toggles (or loads more / expands a long string).

## Icons, embedded, covered notification centre (Task 2F)
```tsx
<ULIcon name="refresh" />                    // md = var(--ul-icon-md) (1.25em); xs | sm | md | lg or a px number
<ULIcon name="x" size={14} />
<ULIcon filled><circle cx="12" cy="12" r="4" /></ULIcon>   // custom glyph, same box rules
<ULErrorState embedded message="…" onRetry={retry} />       // inside a popover / drawer / dialog: no card, no glass
<ULCopyButton variant="icon" buttonVariant="plain" value={id} />  // in table cells and rows
<ULNotificationCenter items={items} anchorVisibility="covered" />  // default; "above" keeps it below the bell
<ULPopover anchorVisibility="covered" closeButton closeLabel="Close" … />
```
Every svg a component renders is a ULIcon (explicit size) or carries `data-ul-illustration`. Overlay content is never wider than the surface's inner width. Guard cards: motion-test `?norun&card=layoutoverflow | iconsize | ctrltext | coveredanchor`.

## Charts (Task 3A)
```tsx
<ULLineChart title="Revenue" data={rows} x={(d) => d.date} xScale="time" locale="sk"
  series={[{ key: 'web', name: 'Web', value: (d) => d.web }, { key: 'app', name: 'App', value: (d) => d.app }]}
  valueFormat={{ style: 'currency', currency: 'EUR' }} references={[{ value: 1000, label: 'Target', tone: 'accent' }]}
  thresholds={[{ from: 0, to: 500, tone: 'danger' }]} curve="monotone" yScale="linear|log" contextMenu={(t) => items} />
<ULAreaChart stack="none|stacked|percent" … />
<ULBarChart stack="stacked" orientation="horizontal" … />
<ULComboChart series={[{ key: 's', name: 'Sessions', type: 'bar', value }, { key: 'c', name: 'Conversion', type: 'line', axis: 'right', value }]}
  axes={{ left: { label: 'Sessions' }, right: { label: 'Conversion %', format: (v) => v + ' %' } }} … />
<ULDonutChart title="Payments" data={rows} label={(d) => d.k} value={(d) => d.v} mergeBelow={0.03} center={<ULRollingNumber value={total} />} centerLabel="payments" />
<ULPieChart … />
<ULSparkChart data={[…]} variant="line|area|bars|winloss" height={24} label="Revenue trend" />   // aria-hidden without label
<ULKpiCard variant="sparkline" label="Orders" value={312} trend={<ULSparkChart data={d} variant="bars" />} />
```
- Every chart: `state` ready | loading | empty | error (+ `onRetry`), `stale` (true or text), `panel` (default true = one lite glass panel), `toolbar` (table toggle, copy, CSV), `legend`, `defaultTable`, `filename`, `accent`, `locale`, `summary` (default generated).
- Keyboard on the plot: ← → points (↑ ↓ on horizontal bars), ↑ ↓ series, Home / End, Enter pins, Esc unpins. Click pins, touch tap shows (vertical scroll stays native).
- Migration: `<ULChart kind series labels …>` (2d) works unchanged and renders through the core. Building blocks are exported (ChartFrame, ChartLegend, useHoverLayer, useChartTween, scales).
- Fast preview: `showcase/probe-charts.dc.html?n=10|100|1000` (minified bundle).
### Chart patterns (Task 3B)
```tsx
<ULAreaChart patterns="auto" … />   // default: dash for series 3+, fill patterns only with > 4 series / slices or prefers-contrast: more / forced-colors
<ULBarChart patterns="on" … />      // every series dashed / patterned (print, accessibility exports)
<ULDonutChart patterns="off" … />   // colour + legend only
```
- Legend swatches mirror the pattern; tooltip keys use the same dash. The figure carries `data-ul-patterns` = on | auto-fills | auto-lines | off.
- Tests: `showcase/probe-charts.dc.html?guard` (layout guards at 1280×800, 924×540, 375×667), `?cards=all` (chart cards), `ULDemos.chartContrastReport()` on the probe page. motion-test: `?norun&card=charttable` (chartlegend, chartctx, chartkeys, chartreduced, chartmorph, chartsizes, charttip, chartdraw, chartperf).


## Charts 3B — advanced types, zoom, streaming, linking
Every type renders inside the shared ChartFrame (one lite glass panel; toolbar = table view, copy data, Download CSV; states `loading | empty | error` + `stale`; `patterns`; `contextMenu` / `onContextMenu*`; EN/SK/DE/CS via `locale`). Shared props (`ChartBaseProps`): `title, description, summary, height, locale, valueFormat, format, accent, panel, className, legend, toolbar, filename, state, onRetry, errorMessage, empty, stale, defaultTable, patterns`.

| component | own props | context-menu kinds |
|---|---|---|
| `ULRadialChart` | `data, label, value, max (number or accessor, default 100), sweep (90–360°, default 270), center, centerLabel` | point, series |
| `ULGaugeChart` | `value, min, max, thresholds [{ to, tone, label }], target, targetLabel, compare { value, label }, mode 'fill' \| 'needle', label, center` | value, target, band |
| `ULRadarChart` | `data (one row per axis), axis, series [{ key, name, value, slot }], max, rings` | point (axis), series |
| `ULScatterChart` | `data, x, y, size (bubble), group, pointLabel, axes { x, y, size }, trend, brush, onSelect(rows, indices), radius, renderer 'auto' \| 'svg' \| 'canvas'` | point, selection, series, plot |
| `ULHeatmapChart` | `data, row, col, value, rows, cols, scheme 'sequential' \| 'diverging', domain, mid, labels 'auto' \| 'on' \| 'off', cellHeight, scaleLabel` | cell |
| `ULCalendarHeatmap` | `data, date, value, from, to, scheme, domain, mid, scaleLabel, cell` | cell (date) |
| `ULFunnelChart` | `data, label, value` (conversion of the first step, drop-off from the previous) | step |
| `ULHistogramChart` | `values, bins (number \| 'auto'), binOptions ([] hides the control), percentiles [50, 95, 99], references, xLabel` | bar (bin) |
| `ULTreemapChart` | `data: TreeNode { name, value?, children? }, path, onPathChange` (drill-in, embedded ULBreadcrumbs) | segment |

Keyboard: arrows move (grid rows ↑ ↓ in heatmaps, weeks ← → in the calendar, ↑ ↓ = series in radar, cone nearest neighbour in scatter), Home / End, Enter pins (treemap: Enter opens a group, Backspace goes up), Esc unpins / clears a brush. Every move is announced in the polite live region.

### Zoom, pan, brush (ULLineChart / ULAreaChart / ULBarChart)
`zoom: true | { brush?: boolean; overview?: boolean }`, `range` (controlled `{ from, to }`, time = Date / ms, category = index; `null` = full), `onRangeChange(v: TimeRangeValue | null)` (same shape as ULTimeRange: `{ preset: 'custom', from, to, interval }`), `highlight` (data index from outside, e.g. a hovered table row).
Gestures: drag = range brush (opaque readout), Shift+drag or one-finger touch = pan, pinch / Ctrl or Cmd + wheel = zoom (a plain wheel always scrolls the page), double-click or "Reset zoom" = full range, keys `+ - 0`, Shift+← →, Esc cancels a brush. Pure helpers: `zoomAt, panBy, clampView, sliceFor, rangeValue`.

```tsx
const [range, setRange] = useState<TimeRangeValue | null>(null);
const filters = range ? [{ id: 'range', field: 'day', op: 'between', value: { start: iso(range.from), end: iso(range.to) } }] : [];
const rows = applyFilters(allRows, filters);
<ULTimeRange key={String(range?.from)} value={range ? 'custom' : '30d'} custom={range && { start: range.from, end: range.to }} onValueChange={(v) => v.preset !== 'custom' && setRange(v)} />
<ULFilterBar fields={[{ key: 'day', label: 'Date', type: 'date' }]} value={filters} count={rows.length} onValueChange={…} />
<ULAreaChart … xScale="time" zoom={{ overview: true }} range={range} onRangeChange={setRange} highlight={hoveredRow?.dayIndex} />
<ULTable rows={rows} … />   {/* wrap it and map tr[data-key] hover → highlight */}
```
(Full linked demo: showcase/demos-3c.js LinkedDemo, probe-charts `?adv&only=linked`.)

### Large data and streaming
- `renderer: 'auto' | 'svg' | 'canvas'` (auto: canvas above `--ul-chart-canvas-at` = 5000 points, line / area / scatter / bubble), `decimate` (LTTB for drawing when points > 2 × plot px; tooltip, keyboard and table keep every point). `lttb(xs, ys, threshold)` keeps first, last, global min and max.
- `createChartStream({ time, windowMs, maxPoints = 20000, staleAfter = 5000 })` → `appendPoint(p | p[])`, `setWindow(ms)`, `connect(liveSource, map)`, `hold(on)`, `pause() / resume()`, `snapshot()`; one commit per animation frame; LiveSource-compatible status (pass it to ULLiveStatus).
- `<ULStreamChart stream={s} series={…} x={(p) => p.t} />`: sliding window that scrolls per frame, pulsing bead on the latest point, pause on hover / pin with "N new points" (liveQueue rule), ULLiveStatus (live / paused / stale), stale badge when the source stops, Download CSV = the current window.

## Contrast tool (Task 3C)
`<script src="showcase/ul-contrast.js">` → `await ULContrast.ready()`, `const R = ULContrast.resolver(el, 'ul-chart2'); R.get('var(--ul-chart-s0)')` → [r, g, b, a] gamma sRGB (gamut mapped), `ULContrast.ratio(fg, bg)`, `ULContrast.over(top, bottom)`. Reports: probe-charts.dc.html?contrast (charts), ?actions (action buttons), probe-forms.dc.html?contrast (forms / feedback).
Showcase: Components → Charts has the everyday types and a "Charts (advanced)" section (lazy, visible-only), same demos as probe-charts.dc.html?adv.

Coverage against the shadcn/ui component list: docs/shadcn-coverage.md.

## Forms (Task 3C)
```tsx
<ULField label="Email" required description="We send the sign-in link here." error={errors.email}>
  <ULTextField label="Email" type="email" floating={false} size="compact" {...register('email')} />
</ULField>
<ULField label="Bio" optional><textarea rows={3} /></ULField>               {/* native child: cloned with id + aria */}
<ULField label="Name">{(p) => <MyInput {...p} />}</ULField>                  {/* render prop: id, aria-describedby, aria-invalid, aria-errormessage, aria-required */}
<ULField label="Role" orientation="horizontal"><ULSelect label="Role" options={roles} /></ULField>
<ULFieldSet legend="Billing address" columns={2} error={setError}>…ULField…</ULFieldSet>   {/* columns: number | 'auto'; one column below 480px */}
<ULFieldGroup orientation="horizontal">…</ULFieldGroup>
<ULFieldError truncate>Long message…</ULFieldError>  ·  <ULFieldError errors={['a', 'b']} />
<ULLabel htmlFor="x" required | optional>Label</ULLabel>
<ULInputGroup prefix="https://" suffix=".ultralabs.app"><ULTextField label="Website" floating={false} /></ULInputGroup>
<ULInputGroup prefix={<ULIcon name="search" size="md" />} suffix={<ULKbd keys="Mod+K" size="sm" />} clearable loading={busy} shape="capsule"><ULInputGroupInput type="search" value={q} onValueChange={setQ} /></ULInputGroup>
<ULInputGroup maxLength={40} clearable><ULInputGroupInput value={bio} onValueChange={setBio} /></ULInputGroup>   {/* counter + "N characters left" announcements */}
<ULInputGroup suffix="kg"><ULNumberField label="Weight" floating={false} /></ULInputGroup>
<ULInputGroup actions={<ULCopyButton value={key} variant="icon" sensitive />}><ULInputGroupInput value={key} readOnly /></ULInputGroup>
```
- ULField owns label, description and error; UL controls inside it read the field context (no own label / messages). A NEW error text is announced once through the shared polite live region (`announce`); focus never moves. `announceErrors={false}` opts out.
- In ULInputGroup the inner control has no second border or well; ULSelect switches to a plain trigger, ULCopyButton to the plain variant. Addon / counter ids join the control's aria-describedby.

### Recipe: form with validation timing, submit and unsaved guard (no dependency; react-hook-form style)
```tsx
function useForm(initial, rules) {           // validate on blur, then on every change once touched
  const [values, set] = useState(initial), [touched, setT] = useState({}), [errors, setE] = useState({});
  const check = (k, v) => rules[k]?.(v) || null;
  const register = (k) => ({ value: values[k],
    onValueChange: (v) => { set((s) => ({ ...s, [k]: v })); if (touched[k]) setE((e) => ({ ...e, [k]: check(k, v) })); },
    onBlur: () => { setT((t) => ({ ...t, [k]: true })); setE((e) => ({ ...e, [k]: check(k, values[k]) })); } });
  const dirty = Object.keys(initial).some((k) => values[k] !== initial[k]);
  const validateAll = () => { const e = Object.fromEntries(Object.keys(rules).map((k) => [k, check(k, values[k])])); setE(e); setT(Object.fromEntries(Object.keys(rules).map((k) => [k, true]))); return !Object.values(e).some(Boolean); };
  return { values, errors, register, dirty, validateAll };
}
const f = useForm({ email: '' }, { email: (v) => (!/^\S+@\S+\.\S+$/.test(v) ? 'Enter a valid email address.' : null) });
const guard = useUnsavedChangesGuard(f.dirty);          // beforeunload + guard.shouldBlock() before in-app navigation
<form noValidate onSubmit={(e) => e.preventDefault()}>
  <ULField label="Email" required error={f.errors.email}><ULTextField label="Email" floating={false} {...f.register('email')} /></ULField>
  <ULSubmitButton onSubmit={async () => { if (!f.validateAll()) throw ACTION_CANCEL; await api.save(f.values); }} />
</form>
```
With react-hook-form: `const { register, formState: { errors } } = useForm({ mode: 'onTouched' })` gives the same timing; pass `error={errors.email?.message}` to ULField and map `register`'s onChange to onValueChange.

## Feedback + structure (Task 3C)
```tsx
<ULAlert tone="warning" title="Card expires soon" description="…" action={<ULButton size="sm">Update</ULButton>} dismissible onDismiss={…} />   {/* info | success | warning | danger | neutral */}
<ULAlertDialog open={o} onOpenChange={setO} triggerRef={btn} tone="destructive" title="Delete project?" description="…" actionLabel="Delete" onAction={() => api.delete()} typeToConfirm="my-project" />
const confirm = useAlertDialog();  await confirm({ title, description, tone: 'destructive', onAction })   // inside a dialog: push on the same surface; resolves true / false
<ULConfirmPopover open={o} onOpenChange={setO} triggerRef={btn} title="Archive 3 items?" onAction={archive} />
<ULToggleGroup aria-label="View" items={[{ value: 'list', label: 'List' }, …]} value={v} onValueChange={setV} />            {/* single: radio + lens */}
<ULToggleGroup type="multiple" aria-label="Format" items={[{ value: 'star', icon: <ULIcon name="star" />, tooltip: 'Starred' }]} />   {/* aria-pressed */}
<ULSeparator /> <ULSeparator orientation="vertical" /> <ULSeparator label="or continue with" />
<ULKbd keys="Mod+K" /> <ULKbd keys={['G', 'D']} /> <ULKbd keys="Mod+K" platform="other" locale="de" />                  {/* Mod = ⌘ on Apple, Ctrl / Strg elsewhere */}
<ULItemGroup label="Members"><ULItem media={…} title="Ada" description="…" meta="now" selectable selected={s} onSelectedChange={setS} contextMenu={items} actions={…} descriptionLines={2} /></ULItemGroup>
<ULCollapsible title="Advanced settings" defaultOpen={false}>…</ULCollapsible>
<ULScrollArea maxHeight={240} label="Audit log" axis="y | x | both" shadows>…</ULScrollArea>                              {/* scrollThumb(client, content, pos, track) is exported */}
```

### 3C tests
- probe-forms.dc.html (minified bundle, lazy demos): ?only=forms|feedback · ?cards=fieldaria,inputgroup,alerts,alertdialog,togglegroup,separator,kbd,item,collapsible,scrollarea|all · ?guard (1280×800, 924×540, 375×667) · ?contrast. Same cards in motion-test.dc.html?norun&card=<id> (fn f3c_<id>); frame cards collheight, tglide need ≥ 50 fps.
- The shared guard cards (layoutoverflow, iconsize, ctrltext) also scan every 3C demo when demos-3g.js is loaded (motion-test loads it).

## Navigation, layout + typography (Task 3D)
```tsx
<ULHoverCard label="Jana Nováková" content={<><ULAvatar name="Jana Nováková" /><ULKeyValue items={[{ label: 'Team', value: 'Studio' }]} /></>}>
  <a href="/people/jana">Jana Nováková</a>
</ULHoverCard>
```
- ULHoverCard: `content`, `side` / `align` / `arrow`, `openDelay` / `closeDelay` (default --ul-hovercard-open-delay 500 / -close-delay 250), `group` (one open card per group), `open` / `defaultOpen` / `onOpenChange`, `contextMenu` on the trigger, `embedded` (default true: content components use their embedded variant). Hover or keyboard focus opens; Tab moves into the card; Esc closes and returns focus. Touch: tap opens, second tap or outside tap closes. The card is supplementary: never put information or actions only there.

```tsx
<ULMenubar label="Editor" menus={[
  { id: 'file', label: 'File', items: [{ id: 'new', label: 'New', shortcut: 'Mod+N' }, { id: 'recent', label: 'Open recent', items: [...] }, { type: 'separator' }, { id: 'close', label: 'Close' }] },
  { id: 'view', label: 'View', items: [{ id: 'grid', type: 'checkbox', label: 'Show grid', checked: grid, onSelect: toggleGrid }] },
]} onAction={(menuId, itemId) => …} />
```
- ULMenubar: role menubar, roving tabindex (← → wrap, Home / End, disabled triggers skipped), Enter / Space / ↓ open on the first item, ↑ on the last; while open, ← → inside the menu or hovering another trigger switches menus at once; Esc returns focus to the trigger. Menu `shortcut` strings now render through ULKbd everywhere (ULMenu, command palette).

```tsx
<ULNavigationMenu label="Site" locale="sk" onNavigate={(e, l) => { e.preventDefault(); router.push(l.href); }} items={[
  { id: 'products', label: 'Products', panel: { links: [{ id: 'studio', title: 'Studio', description: '…', href: '/studio', icon: 'layout-grid' }] } },
  { id: 'pricing', label: 'Pricing', href: '/pricing', current: true },
]} />
```
- ULNavigationMenu: link items (`href`, `current` → aria-current="page") and panel items (grid of ULItem links, `minColumn`, `footer`). ← → Home End, ↓ / Enter opens (↓ focuses the first link), Esc closes, Tab runs through the links. `collapseBelow` (default 640) switches to a Menu button + bottom sheet with drill-in. No URLs inside the component.

```tsx
<ULNativeSelect label="Country" groups={[{ label: 'Europe', options: [{ value: 'sk', label: 'Slovakia' }] }]} placeholder="Choose" error={err} />
<ULSelect label="Plan" options={plans} native="mobile" />           // native picker on coarse pointers
<ULCalendar mode="range" locale="sk" min={min} max={max} isDateDisabled={(d) => d.getDay() === 0} onValueChange={(r) => …} />
<ULAspectRatio ratio={16 / 9} fit="cover"><img src={…} alt="…" /></ULAspectRatio>   // skeleton for loading
```
- ULCalendar `mode` single (Date) | multiple (Date[]) | range ({ start, end }); `jump` month / year selects; same keys as the pickers; Esc cancels a half-picked range.

```tsx
<ULResizablePanelGroup direction="horizontal" storageKey="editor" onLayout={(s) => …} stackBelow={420}>
  <ULResizablePanel defaultSize={24} minSize={14} maxSize={40} collapsible label="Sidebar">…</ULResizablePanel>
  <ULResizableHandle />
  <ULResizablePanel minSize={30} label="Editor">…</ULResizablePanel>
</ULResizablePanelGroup>
```
- Handle keys: ← → (↑ ↓ vertical) 1 %, Shift 10 %, Home / End to the limits, Enter collapses / expands the collapsible neighbour; double-click resets. Storage: `ul-resizable:<storageKey>` in localStorage (try / catch, per viewer).

```tsx
<ULCarousel label="KPIs" visible={2} locale="sk" onIndexChange={…}>{kpis.map((k) => <ULKpiCard key={k.id} {...k} />)}</ULCarousel>
<ULCarousel label="Screens" loop autoplay={4000}>…</ULCarousel>   // autoplay is opt-in
```

```tsx
<ULHeading level={2} size="display">Pricing</ULHeading>          // outline level and visual size are independent
<ULText variant="lead">…</ULText>  <ULText variant="muted" truncate>…</ULText>  <ULText lines={2}>…</ULText>
<ULLink href="https://example.org">Guide</ULLink>                 // external: icon + target _blank + rel noopener noreferrer external + spoken hint
<ULProse>{markdownHtml}</ULProse>
```

Direction: RTL is not supported in v0.1 (docs/rtl-audit.md).

### React versions
Peer range `react` / `react-dom` ^19.0.0. Types are checked against React 19 (`@types/react` + `@types/react-dom` ^19, the owner's strict `npm run typecheck`); the showcase runs on React 19. React 18 is not supported in 0.1.0.

### Callback naming (0.1.0)
One rule, no aliases: value controls `value / defaultValue / onValueChange`; checked controls `checked / defaultChecked / onCheckedChange`; toggle buttons `pressed / defaultPressed / onPressedChange`; open state `open / defaultOpen / onOpenChange`. Native wrappers that also forward the DOM `onChange` event (inherited from the HTML attributes, never redeclared): ULTextField, ULTextArea, ULInputGroupInput, ULCheckbox, ULRadio. Guard: `npm run check:callbacks` (scripts/check-callbacks.mjs, part of build).

### Viewport tests
`showcase/viewport-tests.dc.html?frame=1280` (or 924, 375) runs one frame; without `?frame` the three run in sequence with one iframe mounted at a time. Steps load their demos lazily and report progress; a step that does not finish is NEEDS HEALTHY PREVIEW.

### JSDoc coverage
`npm run check:jsdoc` prints public prop JSDoc coverage per family (`--list` shows undocumented props) and checks every documented default against the code (scripts/check-jsdoc-defaults.mjs). v0.1: actions, fields + pickers, selection, overlays, data and charts at 100 %; the other families are v0.1.1 (docs/component-inventory.md).

### Token integrity
Tokens are added only in tokens/tokens.json (tokens.css is generated). `npm run check:tokens` (scripts/check-tokens.mjs, part of build) fails on any var(--ul-*) that nothing defines and lists unused tokens (docs/_unused-tokens.txt).

### Hit areas
Every control below 44px gets the shared invisible hit layer (src/components/shared/hit.css): `.ul-hit` (both axes, isolated / icon-only), `.ul-hit-y` (vertical only, controls in a row), `.ul-hit-layer` child where glass owns the pseudo-elements. App code uses the same classes for custom controls. Exceptions (24px min): compact table cells, inline text links. Card `hitarea`.

### Pre-freeze audit tests
- Keyboard: motion-test `?norun&card=kbdaudit` (or probe-charts `?cards=kbdaudit&kbdonly=Selection,Data`, `&kbdper=3`): table component → PASS / FAIL (first failing step) / NATIVE / NEEDS FOCUS in `window.__kbdAudit`. Takes several minutes in a slow preview.
- Scatter canvas: `?cards=scattercanvas` · columns drag: `?cards=colsdrag`.
- Fallbacks: any page `?glass=lite` / `?glass=flat`; reduced transparency forced with `?transparency=reduce` or `<html data-ul-transparency="reduce">` (same rules as the media query).

## Material: glass and flat
Resolution (most specific wins): instance `material` prop > nearest `<ULProvider material>` > category default > global default ("glass").
```tsx
<ULProvider material="flat">…</ULProvider>
<ULProvider material={{ default: 'glass', inputs: 'flat' }}>…</ULProvider>
<ULTextField label="Name" material="glass" />
```
| Category | Default | Components |
|---|---|---|
| inputs | flat | text, textarea, number, OTP, tag field, select, combobox, native select, date / range / colour picker triggers, time range, input group, copy field (their popovers are overlays) |
| controls | glass | buttons, button group, switch, checkbox, radio, step dots |
| surfaces | glass | ULGlass default, cards, panels, KPI / stat / table panels |
| overlays | glass | ULAnchoredSurface (popovers, menus, dialogs, sheets), list / menu / calendar lenses |
| chrome | glass | island, sidebar, toolbar, side nav |

Flat = the reduced-transparency fallback (same base, same tokens): no backdrop-filter, no refraction, no gloss rim, no pointer light, no goo. Colour stays: accented glass (primary, destructive) keeps its accent fill in flat (opaque body colour × accent strength under the contrast backing; flat primary label 8:1 violet, 5.8:1 amber). Subtle glass (secondary) = --ul-color-surface-solid, identical to reduced transparency. Reduced transparency itself is unchanged: its primary is the darker deep-accent plate. Flat surfaces are never granted refraction and add no area to the refraction budget (engine `isFlatMaterial`). Lens bubbles on flat controls keep the same geometry and the locked timings (flat pill). Field wells were never glass: flat only removes their pointer light. Custom picker triggers (date, date range, colour; time range) use the same inset well as text and select in flat (--ul-fw / --ul-fr, inset, hover, focus, invalid); in glass they stay glass triggers. Popovers stay glass.
OTP sizes to its container: cells shrink from --ul-field-otp-w (48px) to 75 % (36px), the gap from 8 to 4px; height stays --ul-field-h. Normal form widths are unchanged; below ~272px the 36px minimum overflows.
Non-React: `data-ul-material="flat"` (or "glass") on any element; the nearest attribute wins. Components stamp the resolved value on their root when it is flat or set explicitly.
Test: motion-test `?norun&card=material` and `?norun&card=otplayout` (also in showcase/focused-runs). Showcase: showcase/material.dc.html (same form in glass, flat, mixed, before).

## Known limits (0.1.0)
- OTP cells shrink to 36px wide at a 280px container; the hitarea card only tests the normal width.
- Flat vs reduced transparency differ for primary / destructive buttons: flat keeps the accent fill, reduced transparency stays a dark deep-accent plate.
- `--ul-field-rim` was raised .14 → .18 (3.11:1); it also affects the field border in glass.
- Timing / fps test cards are valid only on a ≥ 100 Hz display in Chrome; Safari runs rAF at 60 Hz.
- Dark-only in v1. No RTL (plan in [docs/rtl-audit.md](docs/rtl-audit.md)). JSDoc covers 85 % overall, 33 % in the "other" family (v0.1.1).
- v0.2: ULMenubar re-anchor, header megamenu → ULNavigationMenu, lazy-loaded action icons ([docs/v0.2-backlog.md](docs/v0.2-backlog.md)).
- The copy field well has no hover / invalid / disabled state (no props for them).
- One moderate npm audit finding, package not yet identified (dev-only or runtime: see the release checklist).
