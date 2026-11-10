# Design decisions

## Locked timings (approved, 2026-11-07)
Final and approved. Do not change any value below (tokens, springs or the test tolerances that check them) without explicit sign-off. Stage 2c / 2d work only reads them.

| token / spring | value | used by |
|---|---|---|
| `--ul-lens-scale` | 1.3 | slider, tabs, segmented bubble size |
| `--ul-lens-scale-switch` | 1.55 | switch bubble |
| `--ul-lens-overshoot` | 0.04 | grow / shrink spring (ζ derived) |
| `--ul-lens-zeta-min` | 0.64 | damping floor for every bubble spring |
| `--ul-lens-grow-duration` | 570ms | all bubbles |
| `--ul-lens-shrink-duration` | 600ms | slider shrink |
| `--ul-lens-settle-hold` | 60ms | slider (hold before shrink) |
| `--ul-lens-settle-duration` | 420ms | switch / tabs / segmented thumb settle |
| `--ul-lens-shrink-start` | 0.45 | shrink starts at 0.45 × settle |
| `--ul-lens-release-linger` | 570ms | hard cap: bubble gone after release (switch, tabs, segmented) |
| `--ul-lens-follow` | 80ms | tabs / segmented held follow (critically damped) |
| `--ul-lens-lead` / `--ul-lens-trail` | 70ms / 150ms | leading / trailing edge springs |
| `--ul-lens-stretch` / `--ul-lens-drag-stretch` | 0.06 / 0.14 | stretch along travel |
| `--ul-lens-magnify` | 1.06 | bubble lens |
| `--ul-lens-rubber` | 0.55 | rubber band past the ends |
| `--ul-lens-flick` | 140ms (≥ 0.15 px/ms) | flick projection on release |
| `--ul-lens-overgrow-switch` / `-slider` / `-tabs` | 5px / 6px / 2px | overgrow |
| `--ul-lens-radius-mode` / `--ul-lens-radius` | concentric / 12px | bubble radius |
| `--ul-switch-thumb-ratio` | 1.57 | switch thumb |
| `--ul-switch-toggle-duration` | 560ms | switch click toggle (keyboard / programmatic 70 %) |
| `--ul-switch-drag-threshold` | 4px | click vs drag |
| switch geometry | 62 × 27, inset 2, thumb 23 | `--ul-selection-switch-*` |
| `--ul-tabs-glide` | 300ms (key 70 %, speed cap 1.8 % of wrapper / frame) | tabs / segmented click + keyboard |
| `--ul-tabs-press-glide` | 280ms | press on another tab |
| `--ul-slider-follow` | 75ms (critically damped) | slider visual thumb |
| spring `bouncy` | k 220, c 14, m 1 | selection blobs, switches, lens thumbs |
| spring `smooth` | k 170, c 26, m 1 | materialize, sheets, morphs |
| spring `snappy` | k 380, c 30, m 1 | press feedback, hover |
| `--ul-pop-*` | enter 500ms, exit 350ms, lag 50ms, overshoot 0.05, stretch 0.06, offset 8px | anchored morph (all overlays) |
| test tolerances | grow ±15 %, switch gone ≤ linger × 1.15, interruption ≤ pre-velocity + 3px | thumb-harness.js, motion-harness.js |

## Glass layer model
Every `ULGlass` surface is six layers, bottom to top:

| | layer | implementation |
|---|---|---|
| b | Refraction (first) | `url(#ul-refraction-N)` at the START of `backdrop-filter`, so detail is bent while still sharp. Chromium only. |
| a | Backdrop | then a light `blur(0–4px) saturate(140%) brightness(1.04)` |
| c | Tint | white vertical gradient at `--ul-glass-tint` (chrome: silver → ice → steel + diagonal sheen) |
| d | Specular rim | `::before` 1px masked gradient ring, bright top-left / bottom-right, angle follows pointer; plus inset shadows; plus SVG rim-lighting that brightens the refracted backdrop at the edge so the rim takes the color behind it |
| e | Outer shadow | layered, tinted `--ul-color-shadow` (deep navy, never black), deeper per tier |
| f | Pointer light | `::after` radial gradient at `--mx/--my`, opacity `--ul-light` from one shared rAF loop |

### Refraction filter
`feImage` (map) → three `feDisplacementMap` passes at staggered scales (R largest, B smallest), each isolated to one channel with `feColorMatrix` → recombined with `feBlend mode=screen`. This gives the chromatic edge. A second `feImage` (rim mask) composites a brightened copy of the refracted backdrop onto the outer 1.5px.

The map is drawn on canvas and exported as PNG (an SVG data URI would not respond to CSS).
- **Bezel:** a fixed-width band (`--ul-bezel-width`, 24–40px by tier, independent of element size) with a steep convex profile `(1 − s)^2.2` (`prominent`: `^1.5`, ×1.2 scale). Maximum displacement at the very edge, neutral at the inner edge of the bezel. Follows `border-radius`.
- **Center lens:** a gentle linear gradient that samples toward the center so the backdrop reads `--ul-glass-magnify` (1.04×) larger, like thick glass.
- **Modes:** `standard` (edge-normal bend), `polar` (radial bend from center), `prominent` (wider, stronger).
- **Aberration:** three passes at scale × (1, 1 − .05a, 1 − .1a), a ≈ 2.

It regenerates on `ResizeObserver` and whenever scale/bezel/magnify change. Filter region is `userSpaceOnUse` at exactly the element's size.

### Tiers
| tier | use | scale | bezel | blur | radius |
|---|---|---|---|---|---|
| sm | controls | 60 | 24 | 0 | capsule |
| md | cards, tiles | 70 | 32 | 2 | 22 |
| lg | menus, popovers, sidebars | 76 | 36 | 4 | 28 |
| xl | sheets, modals | 84 | 40 | 4 | 36 |

Tint stays at 4–7% white. Blur stays at 0–4px: the background must stay visible and visibly bent. Thicker material = more displacement and deeper shadow, not more blur.

## Elasticity and press
Opt-in via `interactive` (default false). Elastic: buttons, icon buttons, chips, switch thumb, slider thumb, segmented lens, FAB. Rigid (light + rim rotation only): cards, panels, sheets, sidebars, toolbars, tables, inputs, popovers.

Effective strength `E = --ul-elasticity-{tier} × --ul-elasticity`, where tier comes from the element's shorter side: ≤96px sm (1), ≤240 md (.4), ≤480 lg (0), larger xl (0). Global `--ul-elasticity` defaults to .6 and is 0 under reduced motion.
- Reacts only within 1.5 × the shorter side from the edge.
- Hover: translate toward the pointer, max 4px × E (2.4px at defaults), critically damped, no stretch.
- Press / drag: stretch along the motion axis, max 4% × E (2.4% at defaults), plus scale .965 and a flare at the pointer; release springs back with slight overshoot.

## Rules
**Do**
- Nest with concentric radii: `radius={concentric('var(--ul-glass-xl-radius)', 'var(--ul-space-3)')}`.
- Keep sibling glass in `ULGlassGroup`, non-overlapping.
- Place text on glass at ≥ 4.5:1. If the backdrop is busy, raise `tier` or add a scrim inside the surface.
- Put the app over a detailed background.

**Don't**
- Nest glass expecting two lenses. The inner one is flattened (tint + rim only, no backdrop).
- Set `backdrop-filter`, `box-shadow` or border on a component; that's ULGlass's job.
- Ship flat blur + white border. Without the lens, rim and light it is the wrong material.
- Use `will-change` permanently; only during animation.

## Motion
Springs are defined physically in tokens (stiffness/damping/mass) and compiled to CSS `linear()` plus a JS `createSpring` with the same curve.
- **bouncy** (ζ≈0.47): selection blobs, switches, lens thumbs.
- **smooth** (ζ≈1): materialize, sheets, morphs.
- **snappy** (ζ≈0.77): press feedback, hover.

Materialize: refraction scale 0 → full on the smooth spring while opacity leads and scale goes .97 → 1. Exit collapses the lens first, then fades, then sets `inert`.

## Accessibility fallbacks
- `prefers-reduced-transparency`: solid `--ul-color-surface-solid`, no backdrop, no refraction.
- `prefers-reduced-motion`: duration tokens → 1ms, materialize instant, light transitions off.
- Focus: `--ul-focus-ring` (graphite gap + ice ring) — applied per component from stage 2.

## Anchored overlays (standing rule)
Every overlay with an anchor — popover, dropdown/context menu, submenu, select/combobox list, tooltip, date/color picker, toast from its trigger, sheet from a button — is built on `ULAnchoredSurface` (hook: `useAnchoredMorph`, engine: `AnchoredMorph`). No component has its own enter/exit, mount animation, display toggling or placement. Framework-free owners (landing header, tooltips) call `new AnchoredMorph(…, { manual: true })` directly: same class, same tokens.

**One timeline.** Enter plays τ forward; exit plays the same τ backwards at `exit/enter` speed (≈70%). Interrupting reverses from the current τ, including the refraction ramp.
**Layering (portal-safe, 2026-11-07).** The surface starts at exactly the anchor's rect and radius and is clipped with an even-odd hole at the anchor's current rect (`clip-path: path(evenodd, …)`, keyframed with the pose so it never lags a frame). Where the hole is, the surface is neither painted nor hit-tested, so it reads as coming from behind the anchor and the anchor stays visible and clickable, wherever the surface sits in the DOM (portal at `body`) and whatever stacking context traps the anchor. No z-index changes. The goo helper gets the same hole. The hole is the anchor, or its nearest `[data-ul-morph-occluder]` ancestor (the island pill, so a megamenu comes from behind the whole island). Trade-off: the anchor is not drawn on top of the surface, the surface is cut out under it. Through a translucent anchor you therefore see the page, not the surface (correct for the one-glass-layer rule: the anchor's glass never samples the overlay), and the surface's shadow is cut where it overlaps the anchor. The previous technique (raising the anchor and every stacking-context ancestor to `--ul-z-overlay + 2`) lifted the page root above portalled overlays, so the whole morph played hidden behind the page. Rejected alternatives: a skin copy of the anchor on top (duplicates glass, re-renders content, drifts on hover / press) and raising with a fallback (needs stacking-context detection and still fails for trapped anchors). The surface is opaque from the start; refraction scale and rim (`--ul-rim`) ramp 0 → 1 while it separates, so there's no double edge around the button.
**Motion.** Translation of the near-edge origin leads; width/height follow `--ul-pop-lag` (50ms) later on the same overshoot spring (`--ul-pop-overshoot`) over `--ul-pop-enter-duration` (500ms; exit 350ms), with `--ul-pop-stretch` along the travel axis. Radius morphs anchor → surface. The gooey neck (helper layer, below the anchor) joins them until it detaches at 40–60%. The settled surface sits `--ul-pop-offset` away from the anchor.
**Exit.** The surface collapses under the anchor's current rect, the neck reconnects, refraction and rim drop to 0, and the anchor bumps .98 → 1 on absorption. If the anchor is gone or off-screen, the surface scales and fades at its last position.
**Content.** The stage fades in (opacity) and slides `--ul-pop-offset` along the travel axis once the surface has cleared the anchor (τ 30–60 %); never a blur reveal. Exit plays it backwards first.
**Start time.** Runs set an explicit `startTime` on the current frame, so a composited sibling (the stage) cannot hold the surface on its t=0 pose while the compositor is busy. Skipped when the timeline is stale (background tab) so nothing jumps ahead.
**Tiers.** While `data-ul-morphing` is set the governor may re-rank but does not apply tier changes to that surface; `releaseGlassTier` applies the held change when the morph ends. Overlays are priority overlay, so they run at full.
**Rules:** interruptible from the current pose. Placement flips and shifts on collision, and origin and stretch axis follow the final side. Only transform, opacity and radius animate (WAAPI); will-change and goo only while animating. Overlays add a graphite scrim (`--ul-pop-scrim`) under the tint for text contrast. Reduced motion: 150ms opacity + small scale (uniform, ≤ 1, no stretch, no overshoot).
**Interruption.** A reversal starts from the surface's CURRENT visual rect (read before the old run is cancelled), blended into the new timeline within ~1.6 × --ul-pop-lag, so even a changed anchor or final rect never jumps. The test fails if any of the first frames after a reversal moves more than the pre-reversal velocity + 3px.
**Proof.** `showcase/motion-test.dc.html` (library overlays) and `landing/chrome/motion-test.dc.html` (megamenu, language popper, studio tooltip) run `showcase/motion-harness.js`: per overlay, a clean enter, clean exit, reduced-motion run and an interruption (close at 40 %, reopen at 60 %), sampled every frame, with a pass/fail table and a w/h curve. The perf HUD has a Motion test button for any page. Every new overlay gets a row there before it ships.

## Themes
`app` is the reference material. `marketing` only lowers lens strength, aberration, saturation, light and motion, and switches to the landing's ink, type and radii. It never changes blur, bezel or tint. One component code path serves both.

## Accent system (colored glass)
Every accent effect is `lerp(subtle, vivid, x)`, where `x = (k − k_subtle) / (1 − k_subtle)` (CSS `--ul-ax`). Tokens hold the subtle and vivid ends, so the slider and the three levels share one path.

Layer stack (bottom → top), with app values at subtle → vivid:
1. **Backdrop colorize** (Chromium, inside the refraction filter): `feFlood`(accent) → `feBlend mode=color` (accent hue and chroma, backdrop luminance) → mixed into the refracted image 0 → .75. Then CSS `saturate()` is boosted ×(1 + 0 → .5). Bending stays sharp and the content takes the hue. Refraction displacement and the RGB aberration passes stay neutral (they run before the colorize).
2. **Body:** the tint color goes from white + 12% accent to pure accent shaded 35% toward black (a saturated mid-tone, not pastel). Alpha = the tuned tint + 0 → .28.
3. **Deep backing:** accent 32% + black at the backdrop-class α (table in README). It sits above the body so it governs text contrast. Over dark backdrops it is minimal, so the body glows.
4. **Wash:** an accent radial from the bottom edge, .07 → .11.
5. **Rim:** the top-left highlight stays neutral white (reads as glass). The rest of the ring is white mixed with 30 → 80% accent. A neutral 1px inner top line is always present.
6. **Glow:** an accent shadow below, .24 → .55, spread +24px at vivid.
7. **Pointer light:** white mixed with 35 → 80% accent.

**Fallback** (Safari, Firefox, WebKit): there is no backdrop colorize, so the body gets an extra +.08 α at vivid.
**Engine sync:** the SVG filter can't read CSS variables, so the engine follows `transitionrun` on `--ul-accent` / `--ul-accent-k` for the transition's duration, and watches accent/strength/theme attributes.
**Guard model:** `src/glass/contrast.ts` reproduces this stack (W3C SetLum for the color blend, oklab for color-mix, gamma-space compositing). The scrim tokens are the per-level minimum plus .02, for all presets in both themes.

**Do:** use `vivid` for one hero element per view; declare `backdrop="light"` over paper or photos.
**Don't:** color text with the accent, or stack vivid surfaces next to each other.

## Island
One interactive sm pill: the only glass on the marketing page, plus what it opens. Size morphs (compact ↔ expanded) are FLIP on width/height with the shared overshoot spring. The glass map is stretched during the morph and regenerated at the end. Anything that appears *from* the island (menus, notification, contact dialog) is an anchored morph from its trigger, so the standing overlay rule holds. Elasticity stays very subtle on the pill. Menu items are the one place nested glass is elastic: they are flat (no backdrop sampling), so the pull is safe.

**Page-aware accent:** sections declare `data-ul-accent`. The island samples its own center line; the deepest match wins, with hysteresis and debounce so fast scrolling never flickers. The transition is the registered `--ul-accent` (600ms).

## Header: one component, everywhere
- The library owns the island: `src/components/ULIsland/` (ULIsland, ULIslandTool, headerConfig, navIndicator, sectionAccent).
- The landing has exactly one consumer wrapper, `landing/chrome/SiteHeader.dc.html`. It holds the landing copy and menus and maps `variant` → HeaderConfig.
- **Header changes are made only in these two places.** New pages import `chrome/SiteHeader` and select a variant; they never copy header markup, styles or logic.
- `landing/chrome/header-spec.dc.html` shows every state. It renders the same component, so it can't drift.
- **Indicator = flattened glass.** Real refraction for the lens would need a second backdrop-filter inside the pill. That root samples only the pill's own content, not the page, and doubles the filter cost, so it isn't real glass. The lens stays flat: tint, rim, pointer light, accent rim and inner shadow.

## Header tools (2026-11-06)
- Beside the island: the language button and one studio link. No account popper. The marketing site (ultra-labs.eu) is a different site than ultralabs.app and cannot know who is signed in, so it does not pretend to.
- Language is a single row: four equal targets read faster than a grid and keep the indicator on one axis.
- Tooltips are opaque, not glass: they sit beside glass surfaces and must never sample them. They still enter and exit through the anchored morph.
- Mobile: the sheet is one lg glass surface (accent tinted, worst-case backing like the megamenu). The bottom bar's CTA and menu are sm interactive glass; the floating bar is one glass pill with flattened controls inside.
- Copy: the nav item is "Our work" (EN). SK and DE stay "Referencie" / "Referenzen".

## Mobile glass (2026-11-06)
- WebKit (all iOS browsers) cannot refract; the blur fallback is the main mobile look, not an edge case. It must read as glass: frost, top rim, accent hairline, inner bevel, accent backing. Never a flat gray plate.
- The SVG displacement filter costs roughly area × DPR² × 3 passes per frame whenever the backdrop moves. A full-width sheet (≈ 360×560 CSS px) at DPR 3 is about 1.8 M device px per pass, ≈ 6–8 full-surface operations per frame. On a mid-range phone (Adreno 6xx / Mali-G7x class) that is an estimated 6–12 ms per frame while scrolling or morphing, which drops frames. So large surfaces on mobile use blur only; small controls (bar pill ≈ 351×60) keep a lens at half strength, an estimated 1–2 ms.
- One mobile bar for the whole site. Pages pass copy and position only.

## Performance rules (2026-11-06)
- **Refraction is budgeted by area.** The governor allows `--ul-perf-refraction-area` (150 000 px²) of SVG-refracted glass inside the viewport plus a cap of `--ul-perf-refraction-max-count` (30) surfaces. Priority: overlay > hovered / focused > island > small controls (< `--ul-perf-small-area`, 16 000 px²) closest to the center > everything else, so big surfaces (cards, panels) drop to lite first and small controls stay full. Overlays and hovered / focused surfaces are always full and only count toward the cap. Under sustained load (p95 frame > 18 ms for 1 s) the area shrinks 25 % per second and aberration drops to one pass; both restore after 3 s stable.
- **Pick the tier by role, or leave `auto`.** full: overlays (popover, menu, sheet, modal, select / picker lists), the header island, the element under the pointer or keyboard focus, small controls (buttons, icon buttons, chips, toggles, segmented control, checkbox / radio boxes, switch and slider thumbs) while the area allows. lite: cards, panels and big static containers first. flat: anything nested in glass (automatic) and anything off-screen (automatic). Explicit `quality="full"` bypasses the budget; use it for one hero surface only.
- **Small lenses must read.** The bezel is clamped to `--ul-glass-bezel-max-ratio` (35 %) of the shorter side and small surfaces get at least `--ul-glass-small-edge-shift` (8 px) of edge shift; their maps use exact sizes (no 4 px rounding). Hovered small controls get 3-pass aberration.
- **Never outline a refracted surface.** An outline or focus ring painted by the glass element itself is bent by its own lens. Focus rings are children (`.ul-btn-ring`, `.ul-choice-ring`, `.ul-slider-ring`). Debug tier outlines are drawn in a separate layer (perf HUD, Shift+T).
- **Lite must read as the same material.** Same tint, rim, shadow and light; the SVG backdrop colorize is replaced by a CSS colorize (grayscale → sepia → accent hue, × colorize strength) plus a small accent wash. Promotion and demotion crossfade the lens and colorize over `--ul-perf-crossfade` (320 ms) after a `--ul-perf-demote-delay` (400 ms); never switch tiers instantly while visible.
- **No glass inside glass.** Nested glass is flat and never samples the backdrop.
- **Aberration is for large full surfaces only** (≥ `--ul-perf-aberration-min-area`, 16 000 px²). Small controls use one displacement pass.
- **Pointer work stays local.** One global pointermove, rAF-throttled; CSS variables are written only on refracted surfaces in view and the hovered element (+ its glass ancestor). Never on :root, never on every instance. Off on touch-only devices.
- **Pause animated backgrounds.** Every backdrop-filter re-renders each frame the backdrop moves. Animated backgrounds animate transform only and pause when the tab is hidden, while scrolling fast, after `--ul-perf-ambient-idle` (3 s) without input, and when more than `--ul-perf-ambient-max-glass` (12) surfaces are visible. Component showcases default to a static background.
- **Pages with many components** mount one section at a time (tabs or lazy sections). Never put `content-visibility: auto` around glass (Chromium skips / re-rasters the subtree at the viewport edge while scrolling and the backdrop filter drops a frame); the engine warns in dev.

## Phase 2 rules (all components)
- Real elements (button, a, input), hit area ≥ 44px (56 for cards), `:focus-visible` ring = `--ul-focus-width` solid `--ul-focus-color` (accent 70% + white) at `--ul-focus-offset`.
- States: default, hover, focus-visible, pressed, disabled, loading, error. `forceState` (internal) renders hover / focus / pressed without a pointer for the showcase and visual tests.
- Elastic only: buttons, chips, switch / slider thumbs, segmented lens, FAB (2-3px via `--ul-elasticity`). Fields, cards, panels: pointer light only.
- Overlays: ULAnchoredSurface, `portal` default on (theme, accent and backdrop copied from the anchor). Never a mount animation, CSS enter transition or display toggle of its own; layering is the anchor hole, never z-index.
- Tokens only. New groups in 2a: `control.*`, `field.*`, `focus.color|width|offset`, `spinner.*`.
- Do not: put backdrop-filter on anything inside glass (ULGlass flattens nested glass; fields are wells, not glass), color text with the accent, use plain buttons on busy backdrops.

## Component index
| component | status | states | a11y | themes | blur-only |
|---|---|---|---|---|---|
| ULGlass | stable | materialize, press, light, flat, fallback, reduced transparency | decorative surface, content keeps semantics | app, marketing | yes |
| ULAnchoredSurface | stable | enter / exit / interrupt, portal | Esc + outside close, role passed through | both | yes |
| ULIsland, ULIslandTool | stable | compact, expanded, notification | nav landmark, aria-expanded | both | yes |
| createNavIndicator | stable | hover, focus, rest | follows :focus-visible | both | yes |
| createAnchoredTooltip | stable | hover (350ms), focus, Esc | role=tooltip, aria-describedby when text ≠ label | both | opaque |
| ULSpinner | stable | spinning, reduced motion (slower) | role=status only with label | both | n/a |
| ULButton | draft | default, hover, focus, pressed, disabled, loading; variants primary, secondary, tinted, plain, destructive; sm/md/lg; capsule/rounded/circle; icon-only; link | native button / a, aria-busy, aria-pressed, aria-disabled on links, 44px hit | both | yes |
| ULToggleButton | draft | off, on + all button states | aria-pressed | both | yes |
| ULButtonGroup | draft | attached (one glass layer), separate, vertical | role=group + aria-label | both | yes |
| ULSplitButton | draft | closed, open, disabled, loading | aria-haspopup=menu, aria-expanded, menuitems, ↓↑ Home End Esc | both | yes |
| ULFab | draft | icon, extended, fixed placements | icon-only needs aria-label | both | yes |
| ULTextField | draft | default, hover, focus, filled, disabled, loading, error; password reveal; search capsule / expand / clear | label + aria-describedby + aria-invalid, live error | both | not glass |
| ULTextArea | draft | as text field + auto-grow | same | both | not glass |
| ULNumberField | draft | as text field + min/max limits | role=spinbutton, aria-value*, keyboard | both | not glass |
| ULOtpField | draft | empty, partial, complete, error, disabled, loading | role=group labelled, per-box labels, one-time-code | both | not glass |
| ULTagField | draft | empty, tags, error, disabled | chip remove buttons, live announcements | both | not glass |
| ULCheckbox | draft | default, hover, focus, pressed, on, mixed, disabled, loading, error | native checkbox, aria-invalid, describedby, Space | both | yes |
| ULRadio, ULRadioGroup | draft | default, hover, focus, pressed, on, disabled, error; vertical / horizontal | native radios: one tab stop, arrows move + select; role=radiogroup | both | yes |
| ULSwitch | draft | off, on, pressed (thumb grows), disabled, loading, error | button role=switch aria-checked, Space / Enter | both | yes |
| ULSlider, ULRangeSlider | draft | default, hover, focus, dragging (thumb grows), disabled; value tooltip | role=slider, valuenow / valuetext, ← → ↑ ↓ PageUp PageDown Home End, thumbs never cross | both | yes |
| ULSegmentedControl | draft | default, hover, focus, selected, disabled (item / all); sm, md, icon | role=radiogroup / radio, roving tabindex, arrows select, Home End | both | yes |
| ULStepper | draft | done, current, todo; horizontal / vertical; optional jump back | nav + ol, aria-current=step, polite "Step n of m" | both | yes |
| ULSelect | draft | closed, open, hover, focus, disabled, loading, empty, error | button aria-haspopup=listbox, listbox / option, aria-activedescendant, typeahead, ↑ ↓ Home End Enter Esc Tab | both | yes |
| ULCombobox | draft | typing, open, filtered, empty, loading, error | input role=combobox, aria-autocomplete=list, aria-activedescendant | both | yes |
| ULDatePicker | draft | closed, open, today, selected, outside month, disabled (min / max) | dialog + role=grid, ← → ↑ ↓ PageUp/Down (+Shift = year) Home End Enter Esc; EN / SK / DE / CS via Intl | both | yes |
| ULColorPicker | draft | presets, custom hex, invalid hex | dialog, native radio group, labelled hex input; nothing stored | both | yes |
| ULCard, ULPanel | draft | default, hover, focus, pressed, disabled, loading, error, selected; sm / md / lg; panel glass / calm / well | one stretched link / button, footer actions stay separate, 56px min | both | yes |
| ULModal, ULSheet | draft | closed, enter, open, exit, interrupted, stacked (covered), reading, alertdialog, mobile sheet (drag to dismiss) | role dialog / alertdialog, aria-modal, labelled + described, focus trap, focus returns, Esc + scrim | both | yes |
| ULDrawer | draft | right / left, mobile bottom sheet | same as modal | both | yes |
| ULPopover | draft | anchored, arrow, flip, reading | role dialog, aria-haspopup / expanded / controls on the trigger, focus in + back | both | yes |
| ULTooltip | stable (wrapper) | hover, focus, Esc | createAnchoredTooltip | both | opaque |
| ULToast, ULToastProvider | draft | success, neutral, warning, danger (stays), action, queued, paused, swiped | persistent polite / assertive live regions, Esc when focused, timers pause on hover / focus | both | yes |
| ULAccordion | draft | open, closed, disabled; single / multiple | h3 > button aria-expanded / controls, region, ↑ ↓ Home End | both | not glass |
| ULSidebar | draft | expanded, collapsed (tooltips), active, disabled, drawer ≤ 900px | nav + aria-current, toggle aria-expanded, ↑ ↓ Home End | both | yes |
| ULToolbar | draft | items, toggles, overflow menu | role toolbar, one tab stop, ← → Home End | both | yes |
| ULMenu, ULMenuButton, ULContextMenu | draft | items, checkbox, radio, separator, label, disabled, destructive, submenu | menu / menuitem / menuitemcheckbox / menuitemradio, typeahead, → ← Esc Tab, Menu key + Shift+F10 | both | yes |
| ULCommandPalette | draft | recent, grouped, filtered, empty, disabled | dialog + combobox / listbox, aria-activedescendant, polite result count | both | yes |
| ULStatTile | draft | value, delta up / down (good / bad), sparkline, loading, empty | section labelled, delta read as "Up / Down" | both | calm |
| ULTable | draft | sort, select (all / some), hover, density ×3, sticky header, loading (skeleton), empty, paginated, virtual | role grid, aria-sort, aria-selected, one tab stop + grid keys | both | calm |
| ULChart | draft | line, area, bar, hover / focus value, data table | role img + generated summary, data table, ← → Home End, polite value | both | calm (tooltip glass) |
| ULBadge, ULAvatar, ULAvatarGroup, ULProgress, ULSkeleton, ULEmptyState, ULBreadcrumbs, ULPagination | draft | tones / variants, status, +N, bar / ring / indeterminate, shapes, collapsed crumbs, current page | progressbar values, img labels, nav + aria-current | both | calm |

Draft = API may still change before 1.0; stable = used on the landing or in apps.


## Selection (2b, 2026-11-06)
- Boxes (checkbox, radio), switch / slider thumbs, the segmented capsule and select / picker triggers are glass sm. Tracks and rails are inset (not glass) with a fine texture so the lens visibly magnifies them.
- One indicator implementation: the segmented lens and the list hover lens are `createNavIndicator` (same as the island nav). Segmented passes no hover items, so the lens only follows the selection.
- Lists, calendars and color panels are `ULAnchoredSurface` (portal, overlay priority, reading variant `backdrop="light"` by default). Options are flat rows; the one lens is flattened glass inside the overlay.
- Labels need a surface: on busy backdrops put rows on a scrim (`data-ul-surface="solid"`) or a glass panel.
- Dates: Intl formats; EN maps to en-GB (day-month order, Monday first) for the European audience. Pass a full locale (en-US) to change it.


## Value tooltips (slider)
- A slider's value tooltip is a child of the thumb's positioner. The positioner, the fill (clip-path) and the merged range tooltip are written by ONE rAF loop from cached geometry, so tooltip and thumb move in the same frame: offset 0 during drag, keyboard steps, click-to-jump and programmatic changes.
- Never position a value tooltip through the anchored tooltip's spring / reposition loop and never give it a hover delay. The spring is only its enter (scale 0.6 → 1 + fade, snappy) and exit.
- The text shows the committed value (tabular numbers). Shown instantly on press, drag and keyboard changes; hides `--ul-tooltip-hide-delay` after the thumb has settled. Clamped to the control and viewport (body shifts, arrow stays on the thumb); flips below (vertical: to the other side) when there is no room.
- Range: both values show together; when they would overlap, or their span gets narrower than the merged label, they swap instantly for one "a – b" label that covers exactly their span (no jump), then split the same way. Opaque, never glass. The clip-path layering of anchored overlays does not apply.

## Slider follow rule (2026-11-07)
- The committed VALUE follows the pointer immediately (stepped; onValueChange only when it changes; one React render per change, never per pointermove).
- The VISUAL thumb follows on a critically damped spring (`--ul-slider-follow`, 75ms): toward the raw pointer while dragging (stepped sliders glide between steps, aria still announces discrete values), toward the committed value otherwise (keyboard, click-to-jump, programmatic).
- Per frame only transform (translate3d), clip-path and the tooltip shift are written. Track / root rects are cached on press, resize and scroll. Pointer capture; touch-action pan-y (horizontal) / pan-x (vertical).
- Cause of the old stutter (measured with the HUD drag bench): not frame time (120 fps, p95 8.7ms, no long frames) but quantisation. The thumb was drawn at the stepped value, so with step 1 on a 640px track it jumped 6.4px every ~5 frames: 282 of 355 frames were stalls (pointer moved, thumb did not), max frame-to-frame discontinuity 6.4px. After: 0 stalls, 0.8px max discontinuity, p95 9.8ms.

## Lens bubble (shared, 2026-11-07)
- One implementation: `LensBubble` (src/motion/lensBubble.ts) for ULSwitch, ULSlider, ULRangeSlider, ULSegmentedControl and ULTabs; `createLensSelect` (src/motion/lensSelect.ts) adds press-hold-drag selection for lists (segmented, tabs). No control has its own copy. The hover indicator (`createNavIndicator`: header nav, language popper, list hover) uses the same overshoot spring (ζ from `--ul-lens-overshoot` / (`--ul-lens-scale` − 1)) but no bubble and no drag; it stays a flattened lens.
- Shape: a rounded RECTANGLE, never a circle. Radius concentric with the wrapper (`--ul-lens-radius-mode: concentric | fixed`, `--ul-lens-radius`). Active size: along = max(rest·L, rest + 2·overgrow, rest + cross growth); across = max(rest·L, wrapper + 2·overgrow). Overgrow: switch `--ul-lens-overgrow-switch` 2px, slider `--ul-lens-overgrow-slider` 6px around the thumb row, tabs / segmented `--ul-lens-overgrow-tabs` 2px.
- Layering: a sibling layer at the document root (`[data-ul-lens-layer]`, fixed, pointer-events none, above overlays), so overflow, clip-path, radius clipping or backdrop-filter of an ancestor can never clip it. It refracts what is painted under it: the control's own track, fill or labels and the page behind. Over glass (inside a glass panel, or the glass segmented capsule) it would sample glass, so it runs flat with the bevel look. Trade-off: it sits above everything at that spot (incl. a sticky header passing over the control while it is held), and the segmented capsule never gets a refracting bubble.
- Motion: grow g (damped spring, overshoot `--ul-lens-overshoot`, `--ul-lens-grow-duration` / `--ul-lens-shrink-duration`). Two edges along the axis with separate springs (leading `--ul-lens-lead` 70ms stiffer, trailing `--ul-lens-trail` 150ms softer), so the bubble stretches toward the travel (≤ `--ul-lens-drag-stretch` 0.14), squashes across, and when the target stops the trailing edge catches up and overshoots once. Shrink only after it has SETTLED (edges on target, no target motion for 70ms, owner not busy), with a slight undershoot; refraction k = g. Rubber band past the ends (`--ul-lens-rubber` 0.55), flick projection on release (`--ul-lens-flick` 140ms, only ≥ 0.15 px/ms).
- Radius stays correct while stretching: the bubble is written as real width / height / radius on its own fixed, isolated element (one small layout, no reflow of the page) and the glass map is rescaled (setGlassGeometry), never regenerated. Position is translate3d. A scale transform would have distorted the corners by up to 14 %.
- Quality: priority overlay, made visible synchronously (`wakeGlass`) so the first frame already resolves its tier, 3-pass aberration while held if the governor is not degraded (`setGlassHot`), tier frozen (data-ul-morphing) until it has shrunk. Pool of ≤ 4 elements, hidden ones are display:none and cost nothing.
- Reduced motion: no growth, stretch, overshoot or travel; a 150ms crossfade at the target. Dragging still sets / selects on release.

## Switch (2026-11-07)
- Shape: track 64×28, inset 2px; thumb a capsule 24px high × `--ul-switch-thumb-ratio` (1.55) = 37.2px, radius concentric with the track (14 − 2 = 12), same in both states. Bubble = the thumb shape grown to 48.9×32.4 (overgrows the track by 2.2px).
- Drag to set: on pointerdown (or Space) the bubble grows on the thumb, no movement needed. While held it follows the pointer along the track with the rubber band and the elastic model. State is decided ON RELEASE from the bubble centre (+ flick): past the midpoint = on. A press that moves < `--ul-switch-drag-threshold` (4px) is a click and toggles. The bubble settles on that end, then shrinks onto the thumb.
- Semantics: role="switch", aria-checked and onCheckedChange change only on release, exactly once, never when unchanged. The fill previews the drag position (--ul-switch-p) without touching aria-checked. Esc / pointercancel restore with no event. Keyboard unchanged; programmatic toggles run the same sequence 1.7× quicker. touch-action pan-y; hit area 64×44; disabled / loading ignore drag; the focus ring is outside the bubble and does not change size.

## Tabs and segmented (2026-11-07)
- Click / keyboard: the indicator floats to the new item as the bubble. Press and hold anywhere in the list: the bubble appears on the indicator (pressed = selected) or glides to the pressed item. While held it follows the pointer, rubber band past the first / last item; the item under its centre is previewed ([data-ul-preview]). Release: the nearest item to its centre (+ flick) is selected; aria-selected / aria-checked and the panel change only then. A plain click selects through the same path. Esc / pointercancel restore. Keys unchanged (arrows by orientation, Home, End, roving tabindex).
- ULTabs (new, pulled forward from 2c for this): inset tab list (not glass) so the bubble refracts the labels; panel = role tabpanel.

## One indicator rule (2026-11-07)
- Tabs and segmented have exactly ONE indicator node: the lens bubble's persistent element inside the list (`LensBubble mount: 'host'`). Rest = flat capsule ([data-rest], no backdrop-filter, glass asleep); active = the bubble (refraction, elevation, overgrow). It inflates from where it rests, glides, settles and shrinks back into the same node. No createNavIndicator in tabs / segmented; hover only brightens the label.
- The hover indicator (createNavIndicator) stays for the header nav, language popper and menus (no selected state).
- Press on another tab: glides there on `--ul-tabs-press-glide` (critically damped, no teleport). While held after moving: follows the pointer through `--ul-lens-follow` (critically damped). Selection only on release.
- The segmented control is a NON-glass inset well (tint, rim, inner shadow); its bubble refracts the labels. Trade-off of the in-list indicator: an ancestor with overflow hidden can clip the 2px overgrow (the switch / slider bubble stays in the root layer).

## Timing (2026-11-07)
- Grow 380 → 570ms (kept). Shrink 320 → 480 → 300ms, settle hold 70 → 120 → 60ms, shrink spring ×0.9 stiffer. Damping floor ζ ≥ 0.64 (`--ul-lens-zeta-min`, was 0.55): the grow spring is now the same for every control (the slider's scale 1.3 had produced ζ 0.55 and a different settle than the switch's ζ 0.64).
- Tabs / segmented: click / keyboard glide `--ul-tabs-glide` 300ms (key 70 %), press glide `--ul-tabs-press-glide` 400 → 280ms, held follow `--ul-lens-follow` 110 → 80ms. Glides are speed-capped at 1.8 % of the wrapper per frame (no teleport), so a far tab takes ≈ 400ms instead of 280ms.
- Switch click toggle: `--ul-switch-toggle-duration` 560ms total (travel 30 %, overlapping the grow; hold 11 %; shrink 34 %). Keyboard / programmatic 70 %. Drag unchanged.
- Switch proportions measured from the iOS 26 screenshots (3× captures): track 186×81 → 62×27pt (2.30:1), thumb 110×70 → 36.7×23.3 (1.57), inset ≈ 1.8pt, pressed bubble 170×113 → 56.7×37.7 (×1.55 along, ×1.62 across), overgrows the track by ≈ 5.3pt top / bottom. Tokens: switch 62×27, inset 2, thumb ratio 1.57, `--ul-lens-scale-switch` 1.55, `--ul-lens-overgrow-switch` 5px.

## Overlay scroll behavior (2026-11-07)
One implementation in AnchoredMorph (used by ULAnchoredSurface, useAnchoredMorph and the manual tooltip). Props: `scrollBehavior` lock | follow | fixed | close, `scrollLock` (shorthand), `onAnchorHidden` keep | hide | close.
- Defaults: menus (select / combobox list, date / colour picker, split-button menu; role menu, listbox or dialog) = lock; popovers = follow + keep; tooltip = follow + hide; anchored toast = fixed (pass it). Island and contact brief keep their own behavior.
- follow: one rAF loop while open reads ONLY the anchor rect and writes `translate` (transform-only, same frame as the scroll). Placement and flip are re-evaluated against the current anchor rect with the cached surface size (flip is instant). When the anchor is out of view, no viewport clamping: the surface moves with it. During the morph only the anchor's centre translation is followed (never its size). The offset is folded into left / top when the exit starts, so the exit keyframes and the clip-path hole stay aligned.
- lock: counted, shared. html overflow hidden (also stops scrollbar drag) + padding-right = scrollbar width (no shift) + overscroll-behavior none; wheel / touchmove / scroll keys (Space, PageUp/Down, Home, End, arrows) are prevented outside the overlay unless an inner scroller of the overlay can still scroll that way; text inputs and sliders keep their keys. No position:fixed trick (no jump on iOS). Unlock restores the exact scroll position.
- fixed: no repositioning or flipping. close: any scroll outside the surface calls onClose.
- hide: the surface fades out (120ms, instant with reduced motion) and is not hit-testable while the anchor is out of view, then fades back.
- Trade-off: lock adds padding to <html>; position:fixed page chrome that is right-aligned keeps its spot only if it also adds the scrollbar width (`html[data-ul-scroll-locked]` is set for that).

## Release linger (2026-11-07)
- Switch, tabs, segmented (`earlyShrink`): after release (or click / keyboard toggle, pointercancel, Esc) the thumb / indicator settles on an elastic spring `--ul-lens-settle-duration` 420ms (before: ≈ 170ms switch toggle travel, 300ms tab glide; ζ floor 0.64 keeps a small overshoot + rebound). The bubble starts shrinking at `--ul-lens-shrink-start` 0.45 of the settle and is gone ≤ `--ul-lens-release-linger` 380ms after release (hard cap); the flat thumb / indicator finishes the settle alone. The settle hold does not apply to these controls. Keyboard / programmatic: 70 %. The slider is unchanged (shrink after settle, 300ms + 60ms hold).
- Measured (live): switch click: bubble gone 387ms, Space 273ms, knob settle 403ms, overshoot +1.6px, no double edge (bubble + knob opacity ≥ 1.0 on every frame). Tabs 265ms, segmented 266ms. Far-tab glide 441–458ms (speed cap), near tabs ≈ 280–300ms.

## Scroll lock and fixed chrome
- While a menu or modal locks the page, `html[data-ul-scroll-locked]` is set and `--ul-scroll-lock-gap` holds the removed scrollbar width. In-flow content (including the landing header, which is in flow and pinned by translate) does not move because html gets the same padding. Right-pinned `position: fixed` chrome must add the gap: `right: calc(12px + var(--ul-scroll-lock-gap, 0px))` (perf HUD does). Centered fixed chrome subtracts half of it.
- Anchored toasts (ULAnchoredSurface role status / alert) default to scrollBehavior "fixed".
- 2026-11-07 (later): the bubble's shrink after release is 2× slower, start unchanged (it still begins right after release). Switch / tabs / segmented: shrink window = linger − 0.45 × settle, linger 380 → 570ms (shrink ≈ 190 → 380ms). Slider: `--ul-lens-shrink-duration` 300 → 600ms. Thumb settle (420ms) and grow (570ms) unchanged.

## Containers + overlays (2c, 2026-11-07)
- **One overlay path.** Modal, sheet, drawer, popover, toast, menu, submenu, context menu and command palette are all ULAnchoredSurface: same morph, same clip-path hole, same scroll behavior, same overlay stack. None has its own enter / exit, placement or scrolling.
- **Layouts.** `layout` decides where the surface settles (anchored | center | top | bottom | left | right); the morph always starts on an anchor. Without a trigger the anchor is virtual: the viewport edge (drawer, sheet), the pointer point 0 × 0 (context menu), a small capsule at the centre (palette without a search trigger). Virtual anchors have no hole and are never "gone".
- **0 × 0 anchors.** While morphing the surface's padding moves onto the stage (margin), so the surface itself can start at 0 × 0 and the content does not shift.
- **Scrim.** Plain graphite (`--ul-scrim-color`), never glass. Its opacity rides the same timeline; it gets the same anchor hole while morphing, so the trigger stays visible and clickable during the morph. Once settled a centred modal may cover its trigger (that is what a modal is); the harness only checks the hole while morphing for non-anchored layouts.
- **Stack.** `pushOverlay` / `isTopOverlay`: only the top layer handles Esc, outside clicks inside a later layer (submenu, select inside a modal, stacked modal's scrim) are inside, a modal covered by another modal steps back (scale `--ul-modal-stack-scale`, container transition, not an enter / exit). Each layer is `--ul-depth` × 4 higher (scrim, goo, surface move together). Toasts and tooltips are not in the stack.
- **Focus.** `trapFocus` (modal, drawer, palette): initial focus = initialFocus, [data-autofocus] or the first focusable; Tab cycles; focus returns to the trigger. Popover is non-modal: focus in on open, back to the trigger when closed from inside.
- **Sheets / toasts drag.** Drag the sheet grabber down (> `--ul-sheet-dismiss` or a fast flick) to dismiss: `shiftFinal` folds the drag into the final rect, so the exit morph starts where it was released. Toast swipe (> `--ul-toast-swipe`): `nextExitFade` makes that exit fade in place.
- **Toast stack.** Manual layout: each toast slot has an inert, non-glass sizer, the surface is absolute at the slot's top-left so the morph origin is stable; slot reflow is a FLIP on the smooth spring (container motion). Gooey neck only during the morph. Queue limit `--ul-toast-max` (3); danger toasts stay until dismissed. Announcements go through two persistent live regions (polite, assertive), because live roles on freshly mounted nodes are unreliable.
- **Sidebar.** Width morph on `overshootEase()` (the shared --ul-pop-overshoot spring) over `--ul-sidebar-duration`; data-ul-morphing during the morph, glass map rescaled per frame (setGlassGeometry) and regenerated once at the end. Labels fade (160ms opacity). Collapsed items use createAnchoredTooltip side right (added left / right sides to the one tooltip implementation).
- **Menus.** Rows are flat; ONE flattened lens (createNavIndicator) follows hover and keyboard focus and rests on the item whose submenu is open. Safe triangle: while the pointer moves inside the triangle from its last point to the submenu's near edge (≤ 400ms), hover does not switch items.
- **Popover arrow.** Flat (deep backing + 1px rim), outside the lens, hidden while morphing. Trade-off: it is not refracted, so on a very bright backdrop it reads slightly darker than the glass body.
- **Cards.** One real link / button (the title) with its hit area stretched over the card; footer and header actions sit above it (z-index), so there is no interactive nesting. Elastic only on sm cards (2.4px at defaults).

## Data (2d, 2026-11-07)
- **Calm surfaces.** `--ul-data-surface` (graphite 92 %), `--ul-data-well` (95 %), `--ul-panel-bg` (88 %). Never refracted. Glass only in the select-all checkbox, buttons, the row-actions menu and the chart value tooltip.
- **Table.** role grid with one tab stop. Row checkboxes are native inputs styled flat (200 rows would otherwise be 200 glass surfaces; the governor would flatten most of them anyway, but each still costs an observer and a map). Sticky header inside the scroller; densities 40 / 48 / 56px; sort cycles asc → desc → none; skeleton rows while loading; ULEmptyState when empty; pagination via page / pageSize / onPageChange; `virtual` renders only the window (+ overscan) with spacer rows.
- **Chart.** SVG, measured width (ResizeObserver), `niceMax` axis. Series colours: accent, ice and accent × warning, plus dashes for series 2 and 3 so colour is never the only cue. Value tooltip follows the slider rule (same frame as the pointer, transform only, no spring, no hover delay; only the enter is animated). Accessible: role img with a generated summary (start, end, min, max per series), a real data table (visually hidden until toggled), ← → Home End move the focused point, polite value announcement. No draw-in animation, so reduced motion needs no special case.

## Contrast (2c / 2d, worst case: all accents, tinted, dark / mid / light backdrops; computed with contrast.ts)
| surface | app | marketing |
|---|---|---|
| overlay text (modal, drawer, popover, menu, palette, toast) | 6.91 | 8.20 |
| overlay text-2 (descriptions) | 4.58 | 4.56 |
| overlay text, vivid | 6.90 | 8.22 |
| card / glass panel text, subtle | 7.05 | 8.21 |
| card text-2, subtle | 4.68 | 4.57 |
| calm panel text / text-2 (over white) | 13.25 / 8.78 | 14.07 / 7.83 |
| data surface text / text-2 / text-3 (over white) | 14.98 / 9.93 / 5.58 | 15.75 / 8.76 / 5.30 |
| table header text-2 | 10.55 | 9.79 |
| success / danger / warning on data surface | 9.81 / 5.91 / 10.33 | 10.58 / 6.37 / 11.13 |

## Performance (2c / 2d, live HUD bench, 120 Hz display)
| tab | idle | scroll | pointer | glass | notes |
|---|---|---|---|---|---|
| Containers (2c) | 121 fps · p95 9.1ms | 94 fps · p95 16.8ms | 121 fps · p95 9.3ms | 35 | scroll: 19 refracted in view, governor area shrank to 113k |
| Data (2d, 200-row table) | 121 · 9.1 | 121 · 9.1 | 121 · 9.3 | 5 | 0–1 refracted |
| Table inner scroll (200 rows, 3 s up + down) | | 121 fps · p95 9.1ms · 0 long frames | | | no virtualisation needed at 200 rows |

## Test reliability (2026-11-07, later)
- **Clock.** The motion harness samples on the document timeline (= the rAF frame time WAAPI uses). It used performance.now() inside late callbacks, which turned 1–2 missed frames at 120 Hz (13–21ms gaps) into fake velocity spikes. Velocity limits are px per ms; a failing interruption prints the worst frame (step, dt, px/ms, limit).
- **Verdicts.** A virtual-clock re-measure never turns a live FAIL into a PASS: it shows as WARN (live FAIL / virtual PASS) and is counted separately. Final verdict only from a live run in a foreground tab on a real machine (banner on the page).
- **Isolation.** Every card starts from a reset state (overlays closed, morphs and tier freezes ended, scroll unlocked, focus cleared, morph config restored); leaks found at the start are listed on the card. While the suite runs the perf HUD is off and the governor budget is unlimited. Repeat ×5 (button, or `__mtRepeat(ids)`) gives a pass rate and marks FLAKY.
- **Sampling paint, not callbacks.** Checks that compare two things written by different rAF callbacks (indicator vs item) sample after the frame (rAF → setTimeout 0); reading inside a rAF callback can see one side a frame early.
- **Known flaky (full-suite sequence only).** ULSlider follow, Timings, ULTabs / segmented one-indicator and the dialog focus checks fail only in the full 36-card sequence; isolated ×5 and pairwise (each card after its predecessor) they pass 5/5. Root cause not found yet; the code under test is unchanged (locked). Suspect: cumulative state of one long page run. Next step: run the lens cards on their own page.

## Dialog context (2026-11-07)
- **One surface.** Opening a dialog from inside a dialog never stacks a second surface. `useDialog()` → `push / replace / pop / close` swap the VIEW inside the same surface; the root opens from its trigger. ULModal, ULSheet and ULDrawer render through `ULDialogSurface`, so every modal can push. Layered modals are not supported by default (ask before adding a layered case); quick confirmations are a push / replace or an anchored popover.
- **Nav bar** (persistent, never swaps): back (44px, left, only at depth > 1, scale + fade, its slot is always reserved so the title never shifts), title (crossfade, centred, labels the dialog), close (44px, right, closes everything). Esc = back at depth > 1, close at the root.
- **Swap X → Y.** X fades out with a 14px directional slide (`--ul-dialog-content-out` 200ms; blur optional via `--ul-dialog-content-blur` / bench mode slide | slide-blur | blur). The surface morphs left / top / width / height (radius follows the tier) on the dialog spring (`overshootEase(--ul-dialog-morph-overshoot)` over `--ul-dialog-morph-duration` 480ms) to Y's MEASURED size (Y laid out at its size class, X taken out of flow; never animated to auto). Y's blocks enter at `--ul-dialog-enter-at` 0.6 with `--ul-dialog-stagger` 30ms and a soft elastic settle. At most one view is above opacity .5 on any frame. Back is the mirror. An interrupted swap continues from the current rect and opacities.
- **State.** Every view stays mounted (hidden + inert) while in the stack, so form state survives; scroll position is restored on pop; focus goes to Y's [data-autofocus] or the title and returns to the opener on pop. Async height changes animate (ResizeObserver), never jump. `canLeave` is the dirty guard. AnchoredMorph keeps the exit aligned via `setFinalRect`.
- **Trigger exception.** An overlay opened from a button inside a dialog surface gets no clip-path hole (`anchorOnTop` auto-false, explicit prop available): it is above the button from frame one. Page-level triggers keep the hole.
- **Reduced motion.** 150ms crossfade, size and position instant.
- **Trade-off.** The sheet drag-to-dismiss was not carried over to the dialog surface yet (sheets close with the button, Esc or the scrim).

## Toast placement
The surface sits inside a display:contents depth wrapper, so the slot rule is a descendant selector (the old child selector never matched and left surfaces position:fixed below their slots: the newest toast hung off the screen). The stack is positioned in the VISUAL viewport (`--ul-vv-bottom` / `--ul-vv-top` from visualViewport, + inset + safe-area + scroll-lock gap). If the stack would leave the visual viewport, fewer toasts are shown (the rest stay queued). Test: every toast inside the viewport − inset (morph overshoot ≤ 2px into the margin) on every frame (924 × 540 automated; 375 × 667 manual).

## Sidebar layout-follow
createNavIndicator `setLayoutFollow(on)`: rigid lens (no spring, stretch, overshoot or lag; target re-read every frame and written in the same frame the item moved) from the toggle until the width settles + 100ms; off hands over with zero velocity, so there is no jump. The lens is positioned in the scroller's scrolled content box (scroll offset added) and the nav scroller has 6px padding (≥ the overgrow) so it is never clipped; dev warning if the padding drops below 4px.

## Item radius rule (2026-11-08)
- Rows inside an anchored surface (menu, select / combobox list, context menu, submenu, command palette, picker rows) use `--ul-item-radius` = clamp(`--ul-menu-item-radius-min` 12px, popper radius − popper padding, `--ul-menu-item-radius-max` 22px = half the 44px row). It is resolved on the surface (custom property with var() resolves where it is declared) and inherited, so rows and the shared hover lens always use the same value. If concentric is too tight the item grows, never the popper.
- Old → new (app / marketing): select + combobox lists 10 → 20 / 16 · menu, context menu, nested submenu, split-button menu 10 → 20 / 16 · command palette (xl 36, pad 8) 10 → 22 (pill cap) / 22 · colour picker rows 10 → 20 / 16 · landing language popper (radius 20, pad 6) rows 12 → 14, lens 14 → 14 · megamenu rows (pad 18 → concentric 2 → floor 12) keep 12 / 14 · sidebar (not anchored) unchanged 10.
- Measured (viewport-tests, 1280×800 · 924×540 · 375×667): select, menu, nested submenu, palette, colour picker: item = expected within 0.5px, lens = item, at all three sizes.

## Check mark (2026-11-08)
- One ULCheckMark everywhere (select, combobox, menu checkbox / radio, range presets, colour swatches). Enter: stroke draw-in `--ul-check-enter` 220ms + scale 0.6 → 1 on the overshoot spring (`--ul-check-overshoot` 0.12) + fade, delayed `--ul-check-stagger` 40ms. Exit: fade + scale → 0.7 in `--ul-check-exit` 140ms, starts at once. Selected wash fades with the same timing (CSS transition, enter delayed by the stagger). Slot is a fixed 16px, labels never move. No animation on mount or when an overlay opens. Reduced motion: opacity only, 100ms.
- Measured live: 16 exit frames, 20 enter frames, 24 overlapping frames, stagger 34ms, scale 0.60 → peak 1.047, label shift 0.00px.

## Date range picker (2026-11-08)
- One CalendarGrid (div grid: grid / row / gridcell / columnheader, always 6 rows so height never jumps) serves ULDatePicker and ULDateRangePicker.
- Glass inside the popper: two endpoint beads + one shared hover / focus lens (createNavIndicator). Day cells are flat buttons.
- Band: per week row ONE element per layer (firm, preview) whose clip-path inset follows its target on a first-order follow (`--ul-range-follow` 70ms). Rows before the range collapse at their right end, rows after it at their left end, so the band wraps row to row and continues across both months. No per-day backgrounds. The colour is the accent shaded toward black (`--ul-range-band-shade` 50%) at `--ul-range-band` 0.30 / preview 0.18, because pastel accents at full brightness lifted the surface under light text below 4.5:1 (first measurement 3.60).
- Flow: first click = start bead (grow `--ul-range-bead-grow` 360ms, overshoot 0.08) and picking state (old band fades); hover / focus previews; second click commits (onChange once), band firms up (firm fades in, preview out), days in between ripple 12ms / day capped 180ms; earlier end swaps; click on a complete range restarts; Esc while picking restores the previous range, otherwise closes. Month change: the old months are cloned into a ghost layer and slide + fade out while the new ones slide in (`--ul-range-slide` 280ms, 18px); beads hide during the slide.
- Below 640px: 1 month, the popper settles as a bottom sheet (layout bottom). Measured 375×667: 359px wide, inside the viewport.
- Contrast (worst case over all accents, dark / mid / light backdrops, subtle / tinted, full pointer light): app band 5.09 · preview 5.00 · endpoint 5.13 (emerald, dark); marketing ≥ these (band 4.46 before the shade fix).
- Measured live: hover sweep across both months avg 7.0–8.2ms (121–143 fps), p95 9.1–9.4ms on a 120 Hz display; gap rows 0, missing 0, extra 0; ripple max 180ms.

## Colour picker expansion (2026-11-08)
- "Custom color" button (swatch + chevron, aria-expanded / aria-controls) expands the same surface. Same measuring technique as the dialog morph: the visual rect is captured before React re-renders, the target height is measured with the panel shown / hidden, height + top animate on the shared overshoot spring (`--ul-colorpicker-expand-duration` 420ms, overshoot 0.03), glass geometry follows per frame, `setFinalRect` at the end. Expand: height first, content fades + slides in at 30 %. Collapse: content out first, height after. Interruptible from the current rect. Esc: first collapses (focus on the button), second closes.
- Panel: 2D saturation / brightness field with a flattened lens bead as thumb (grows on press, `--ul-colorpicker-bead-press`), hue = ULSlider (its lens thumb) with a hue rail, hex field, eyedropper when `window.EyeDropper` exists. Field drag follows on the slider follow spring (`--ul-slider-follow`) and commits on release (no per-move React state). Trade-off: the bead is not a LensBubble (that class is 1D); it reuses the lens tokens and the flattened lens look.
- Contrast guard: presets are covered by the scrim tokens; custom colours go through `guardAccent` (same worst-case model). Failing colours are clamped into OKLCH L 0.66–0.86, C ≤ 0.16 (`--ul-accent-custom-*`), then walked toward the middle until every row passes; the note shows chosen → applied. Measured: #ffff00 → #cccd5c (worst 4.63), #8a2be2 kept (5.84), ice kept (4.89).
- Measured live: 226 → 541px, height moves at 21ms, content visible at 150ms; collapse content out 159ms, height leaves 159ms.

## Dialog + sidebar notes (2026-11-08)
- No layered dialogs: push / replace / pop only (decision).
- Drag to dismiss is back for the MOBILE bottom sheet only (≤ 640px): grabber + nav bar, starts after 6px of mostly vertical travel (a tap stays a click; the click after a drag is swallowed), upward rubber band (`--ul-lens-rubber`), release projects the velocity over `--ul-lens-flick` and dismisses past `--ul-sheet-dismiss`, else springs back on the shared overshoot spring. Content scroll is never a drag zone. Dirty guard refusing a close springs the sheet back. Desktop sheets / dialogs do not drag.
- Sidebar: unchanged (rigid layout-follow); blur-only check passes.

## Glass arrow (2026-11-08)
- The engine builds the popover map from body ∪ arrow: along the arrow edge, inside the arrow base, distances go to the base corners, so the bezel and the rim bend into the arrow instead of cutting across it. Gated: priority overlay, refract tier only; position bucketed (`--ul-perf-bucket`), cached with the other maps, never built while `data-ul-morphing` (the arrow is hidden then anyway). Cost: 4.2ms per arrow map vs 2.4ms plain, once per shape key; 0 rebuilds on re-measure.
- The arrow region itself does not refract: backdrop-filter samples only the element's border box, and extending the box + clip-path to include the arrow would clip the depth shadow (clip-path clips box-shadow). So the arrow stays flat tint + rim (fallback "bent rim + blur" without true refraction on the arrow; the arrow has no blur either, since nothing inside glass may sample). Tooltips are opaque by rule, so no arrow refraction there. Decision needed if true arrow refraction is still wanted: a separate non-glass shadow helper + clip-path box extension.

## Data redesign (Part 5)
Not done in this turn: the Part 5 specification from the earlier message is not available in this session. Data surfaces stay calm (see "Data (2d)").

## Glass entering the viewport
A lite surface ran its CSS colorize (grayscale → sepia → hue-rotate(--ul-lite-hue)) before the engine knew the accent hue: sepia at hue 0 + saturate showed olive / green for a frame. `--ul-lite-ready` (set together with the hue, removed on detach) gates the colorize, so the first frame is neutral.

## Toast margin (2026-11-08)
Right stacks pour from a point 28px inside the right edge (the width overshoot grows inward); ≤ 480px from the centre with `--ul-toast-overshoot-reserve` 4px per side (the locked pop overshoot / stretch would otherwise reach 3.2px into the margin). Measured live in iframes, every frame, 8 toasts: 1280×800 0.48px · 924×540 0.49px · 375×667 0.38px (allowance 2px).

## Tests (2026-11-08)
- Pages: motion-test (overlays + containers + 2e cards), lens-tests (lens / thumb cards, own page, same reset, Repeat ×5), viewport-tests (three iframe sizes; a frame is scrolled on screen while it runs because off-screen iframes get throttled rAF). Each page prints the mode, live and virtual counts separately, the flaky list and a foreground-tab banner.
- Live results (user preview, 120 Hz): 2e cards PASS (date range, colour expand, check mark, radius, arrow, keyboard walkthrough 12 / 12, blur-only 6 / 6). Containers: scroll, scroll2c, dialog, toasts, sidebar PASS. Isolated ×5: date picker, modal, menu, toast, toast stack 5 / 5. Long sequence: 9 overlay cards WARN (live FAIL / virtual PASS: enter 566–657ms, fewer steps) and context menu interrupt FAIL — the same cards pass ×5 isolated, so this is still the long-run state / pacing problem. lens-tests: 9 / 11 in sequence; timing and seg-one fail once in sequence and pass 5 / 5 alone (FLAKY in sequence only).
- Keyboard walkthrough covers select, date, colour, date range, colour expand, split-button menu, radio menu, modal, sheet, drawer, popover, palette: open from the keyboard, focus inside (click-opened fixtures with initialFocus null keep it on the trigger by design), Esc closes, focus returns. Tab: listbox / menus close on Tab, dialogs trap it.
- Blur-only (forceFallback): tabs indicator, sidebar, toast, range popper, colour popper keep blur + tint + rim + depth; the range bead is flattened (tint + rim + depth, no backdrop) by design.
- Synthetic keyboard events in a window without system focus do not fire focus events; the pickers therefore take the start day from the DOM target (keyFrom), and the range keyboard sub-checks are only valid with the preview window focused.

## Row actions leftover popper (2026-11-08, later)
- Reproduced (script, Components → Data, 200-row table): open → 236×209 with 4 items; close → a 236×16 surface stays on screen with 0 items; reopen / close repeats it.
- Cause (checked against all five suspects): the open state and the anchor got out of sync. ULTable clears its menu state on close, which sets the menu's anchorRef to null AND empties its items. useAnchoredMorph returned early when the anchor was null, so exit() never ran and the surface stayed mounted; the emptied items collapsed it to its padding (2 × 8px). No cancelled exit, stale rect, contained measurement or virtualisation was involved (the surface is portalled; the row button stays mounted).
- Shared fixes: useAnchoredMorph keeps the last anchor and always runs the exit (a fade at the last position if the anchor is gone); a surface without anything to animate unmounts at once. ULAnchoredSurface freezes its children while closing. AnchoredMorph.destroy clears every inline style it wrote (surface, goo children, scrim clip). place() re-measures a natural size below min(24px, anchor) once in a detached container (clone at the portal root, same classes and width constraints) and logs a dev error. Anchor unmounted or virtualised away while open → the follow loop sees it disconnected and requests close (already the behaviour; documented).
- Leftover test (30 cycles each: 10–80ms toggles, double clicks, Esc mid-animation, table scroll mid-animation): row actions, select, date, colour, date range, split-button menu, modal, sheet, drawer, popover, toast, menu, palette, radio menu → 0 surfaces, 0 goo, 0 scrims, no lock, no inert / aria-hidden, no settled surface below 24px.

## Scroll freeze (2026-11-08, later)
- Symptom: every glass surface flashed green / red / blue while scrolling, scroll caught.
- Bisect (Components → Containers, live 120 Hz, 2s per step; baseline 1 / 3 / 20px: 1 / 178 / 497 state changes, 3 / 743 / 2072 mutations incl. filter defs childList). Off one at a time: aberration 187 / 585 changes, accent tint 181 / 486, pointer light 186 / 486, accent observer 202 / 528, map regeneration 172 / 471, hover 182 / 526 (no effect); governor 9 / 51 (most of it); IntersectionObserver swaps 0 / 39 / 16 (removes the flash at 1px).
- Cause: (c) + (a). The IntersectionObserver (rootMargin 200px, no hysteresis) flipped surfaces between flat and lite / full while scrolling and immediately ran the governor, which re-ranked the budget mid-scroll. Each change released or created SVG filters: unused filters were removed from the defs and re-created later with a fresh feImage, whose data-URL map is not decoded on its first frame, so the three per-channel displacement passes ran against an empty map and showed as red / green / blue fringes. (b) ruled out: every filter already had color-interpolation-filters="sRGB". (d) ruled out: --ul-accent did not change. (e) partly: the scroll handler re-lit the pointer light per frame and hover changed the "hot" surface mid-scroll.
- Fix (engine): while any scroll is active (capture listener, passive), tier changes, IntersectionObserver results, governor runs, map regeneration, degrade / recover rebinding, hover promotion and pointer re-lighting are queued and run once, --ul-perf-scroll-idle (150ms) after the last scroll event; a crossfade already running pauses. IntersectionObserver rootMargin = one viewport vertically. Filter definitions are never removed while in use: unused shared filters stay in the defs (cap --ul-perf-filter-pool 48, evicted only when idle), private filters are recycled. Every map is decoded (Image.decode + one frame) before a filter references it; until then the surface stays on the calm lite state and crossfades in. transitionend only follows accent properties. The page-aware island accent commits only when scrolling is idle.
- After (live, Components → Containers, 5 accents × 2 themes, 1 / 3 / 20px): 0 state changes and 0 mutations in 29 of 30 runs; the one exception (ice / marketing 3px) was a crossfade that had started before the scroll, now paused. Frame times: before avg 8.3 / 8.3 / 9.6ms, p95 9.0 / 9.0 / 16.7ms (20px); after avg 8.3–8.7ms, p95 9.0–9.4ms, 0 long frames (one 58ms frame in rose / marketing 1px, at the theme switch). motion-test page: 0 / 0 / 0 changes, p95 9.3–9.6ms.
- Trade-off: a surface that scrolls into view keeps the tier it had (flat if it was more than one viewport away) until 150ms after scrolling stops, then crossfades.

## Nested menus (2026-11-08, later)
- A sideways menu whose trigger row lives inside another menu surface is placed against the PARENT SURFACE edge with --ul-submenu-gap (2px), top = trigger row top − own padding, so its first row lines up with the trigger row. computePlacement flips (same gap) and shifts into the viewport. Rule lives in AnchoredMorph (automatic for role menu + side left / right), no per-menu code. The morph still grows out of the trigger row.
- Hover: an invisible bridge (transparent span, never glass) covers the gap plus 1px of the parent; the safe triangle and the submenu delay stay. Moving to another parent row closes with the normal exit; → opens and focuses the first row, ← / Esc close one level.
- Material: full glass on every level (overlay priority). With 2px between them neither surface samples the other; each keeps its own rim and shadow. Measured: no overlap, gap 2.00px, row Δ 0.00px, surface radius 28px on all levels, rows 20px.
- No room beside the parent on either side (phones, e.g. 375px: two 236px menus + 2px do not fit): drill-in, the submenu sits over its parent with its top on the trigger row (data-nest="cover"), still growing out of that row. Decision needed: keep drill-in, or a bottom sheet for nested menus on phones?
- Measured at 1280×800 and 924×540: gap 2.00px at levels 2 and 3, no overlap, row Δ 0.00px, flip at 2.00px; 375×667: drill-in, inside the viewport, row Δ 0.0px.
- Measured: 3 levels (level 3 flips left when there is no room), context menu near the right edge flips left at 2.00px, crossing the gap diagonally never closes it.

## Modal overlays are covered (2026-11-08, later)
- ULAnchoredSurface anchorVisibility: 'above' (non-modal default: clip hole keeps the trigger visible) | 'covered' (default for modal and alertdialog: ULModal, ULSheet, ULDrawer, alert dialogs, command palette). Covered: no hole; scrim, goo and surface enter the TOP LAYER (popover="manual", shown in that order) from their first frame, so no trigger, sticky header, island or transformed ancestor can paint above them. Anything opened while a top-layer surface is open is lifted too (opened later = above). No popover API: z-index 2147483000.
- Pre-glass: covered surfaces use --ul-modal-covered-backing (0.82) as their minimum backing, so nothing behind shows through before refraction is ready. Their first map is built after the first frame (never blocks it); until it is decoded they run on the calm lite state and crossfade in.
- Cold start: prewarmGlass() on idle and on trigger pointerenter / focus / pointerdown (defs, perf tokens, one 1-pass and one 3-pass filter parked for reuse).
- Measured (cold, warm, interrupt 40 % / 60 %): trigger hit-testable in 0 frames for modal, sheet, drawer, palette; first sampled frame overlaps 62–85 % of the trigger (the surface starts exactly on it; one frame of travel); always in the top layer; never transparent.
- Trade-off: toasts from ULToastProvider are not in the top layer, so a toast shown while a modal is open sits under its scrim. Decision needed: lift the toast stack into the top layer too?
- Decision recorded: covered modals look less transparent than before (backing 0.82 instead of 0.55).

## Locked timings check (2026-11-08, later)
Compared with the table at the top: --ul-lens-scale: 1.3 · --ul-lens-scale-switch: 1.55 · --ul-lens-overshoot: 0.04 · --ul-lens-zeta-min: 0.64 · --ul-lens-grow-duration: 570ms · --ul-lens-shrink-duration: 600ms · --ul-lens-settle-hold: 60ms · --ul-lens-settle-duration: 420ms · --ul-lens-shrink-start: 0.45 · --ul-lens-release-linger: 570ms · --ul-lens-follow: 80ms · --ul-switch-thumb-ratio: 1.57 · --ul-switch-toggle-duration: 560ms · --ul-tabs-glide: 300ms · --ul-tabs-press-glide: 280ms · --ul-slider-follow: 75ms · --ul-pop-enter-duration: 500ms · --ul-pop-exit-duration: 350ms · --ul-pop-overshoot: 0.05 · --ul-pop-stretch: 0.06 · --ul-pop-lag: 50ms · --ul-pop-offset: 8px. All unchanged; springs and the tolerances in thumb-harness.js / motion-harness.js not edited (motion-harness only gained the covered-surface variant of the layering checks). New tokens only: --ul-submenu-gap, --ul-modal-covered-backing.

## Part 3 decisions (2026-11-08)
- **viewSwap** (src/motion/viewSwap.ts): one same-surface swap for dialog push / pop and the phone menu drill-in. X fades with a directional slide, the surface morphs to Y's measured size on the dialog spring, Y's blocks enter at --ul-dialog-enter-at with --ul-dialog-stagger. Interruptible from the current rect and opacity. Reduced motion: 150ms crossfade.
- **Top layer** (src/motion/topLayer.ts): modal (covered) surfaces lift scrim → goo → surface. The toast stack registers keepOnTop() and is re-promoted after any later lift, so it stays above modals; it is never focused by us, never "outside" for a modal's trap, never dimmed. Re-promotion restores focus if it was inside the stack.
- **Modal backing**: covered modals start at --ul-modal-covered-backing (0.82, opaque while the lens builds) and ease with --ul-lite to --ul-modal-glass-backing (0.55: dark backdrop 5.71:1 app, 4.98:1 marketing); mid / light backdrops are held by --ul-glass-scrim (mid scrim 0.66 → app 4.67:1, marketing 4.66:1).
- **Single displacement pass.** The R/G/B 3-pass recombination is gone from the default path; the chroma fringe is two inset paints on the bezel (--ul-glass-fringe). ?glassdebug keeps the legacy graph as a switch for comparison.
- **Data glass levels**: --ul-data-glass rich | subtle (or data-ul-data-glass on an ancestor) × --ul-data-glass-intensity → --dg. Panels are one lite surface; rows, cells and plot marks are never glass; the shared row indicator is one flattened lens.
- **KPI + rolling number**: one glyph per cell at rest; strips of whole cells only while rolling; one non-wrapping line; tiles scale the value (container query) instead of wrapping. Coalescing above --ul-kpi-rate-threshold updates / s.
- **Live layer**: transport-agnostic sources, no URLs or tokens in the library, wss only, auth through getAuth, dedupe / order guard, schema, size limit, token-bucket rate limit (drop | coalesce), backoff with full jitter, heartbeat, buffer cap while paused / hidden. Keyed store commits once per frame; tables re-render only changed rows.
- **Context menus**: useContextMenuTarget / the contextMenu prop on every listed component, built on ULMenu + the anchored morph at a pointer anchor (no new overlay or animation code). One handler set per component root. A row with an open menu is pinned like a hovered row.
- **Glass stability rule**: scrolling never changes glass state; decisions run ~150ms after scroll stops. A pointer move may write only to the surface under the pointer. Known gap (open): the proximity light still writes --ul-light / --mx / --my to every full-tier surface within --ul-glass-light-proximity, and hover promotion can switch a surface's tier; the pointer card reports both.

## Actions (2026-11-08)
- **One state machine** (useAsyncAction): idle → loading → success | error → idle. A run while loading is ignored (preventDoubleSubmit); a run during success / error restarts cleanly (token per run, old timers never fire); results arriving before minLoadingMs (350ms) wait so the spinner never flickers; ACTION_CANCEL returns to idle silently (validation failed, share sheet dismissed, confirm armed). Controlled `status` overrides the visual state. Timers are cleared on unmount.
- **Motion** (tokens --ul-action-*, no locked timing touched): icon slots are stacked; the old one fades + scales to .7, the new one enters, the check draws (ULCheckMark), the spinner crossfades. The label lives in a clipped cell exactly one glyph row high (same rule as the rolling number): the old text slides out, the new one slides in, at rest only one text node. Width: from the previous width to the measured width of the new content (WAAPI on width with the glass geometry frozen, never width: auto); `widthMode="reserve"` stacks all labels invisibly so neighbours never move. Success = one accent ring pulse just outside the rim; error = destructive variant + 3px shake (composite add, so the press / elastic translate is kept). Reduced motion: opacity only, 100ms, no shake, no ring scale.
- **Feedback**: `inline` (label + icon), `tooltip` (the shared anchored tooltip forced open for --ul-action-tooltip; repeated triggers restart the timer and swap the text without a re-enter; created lazily, so table rows cost nothing until hovered), `both`. Every success / error also goes to ONE polite live region; tooltips are aria-hidden for those messages.
- **Accessibility**: the real button keeps focus (aria-disabled, not disabled, while loading); aria-busy while loading; toggles use aria-pressed; sensitive values never reach a tooltip, title, aria text or the live region; contrast: success keeps the button's variant, error uses the destructive variant (both already covered by the button contrast table, ≥ 4.5:1).
- **Pointer light (0a)**: pointer-driven writes go to at most --ul-glass-light-max (4) surfaces, the nearest within the light radius, in ONE rAF batch per frame together with the spring sim, skipped below 0.5px / 0.5°; nothing is written while scrolling or for ~150ms after; idle pointer = no writes. Lite / flat surfaces larger than --ul-perf-promote-max-area (data tables, charts) get no moving light: repainting a big backdrop-filtered panel per pointer frame took the 200-row table from 121 to 65 fps. Hover tier promotion only for the surface under the pointer, never during scroll.
- **Anchored toasts** register keepOnTop like the stack: above modals, re-promoted in creation order, non-modal, never focused, not dimmed.
- **Tests**: a card whose only failing checks need page focus reports NEEDS FOCUS (neither PASS nor FAIL) when the page had no focus; the banner lists them.

## Part 6 (2026-11-08)
- **Coalescing** (useCoalescedAction; coalesce on useAsyncAction): spam-prone toggles show every click at once (aria-pressed, icon) and commit ONCE with the final value after --ul-action-debounce-ms of quiet or at --ul-action-debounce-max-wait-ms; final = committed → no call; one request in flight, later clicks become ONE follow-up (latest wins); a rejection rolls back to the committed value; pending values flush on unmount, pagehide, tab hidden, blur and flush(), never dropped; key auto-repeat is ignored. Refresh is leading-trailing. Only the committed final state is announced.
- **Fx layers** (hold fill, success ripple): ONE wrapper `.ul-btn-fx`, a direct child of the button, inset 0, border-radius inherit, overflow hidden, under icon + label. Plain paint, never a second glass surface; the button's backdrop-filter samples only what is behind the button, so the layers never feed the refraction. Root cause of the old label-only fill: ULActionButton passed the fill as a child, and ULButton wraps children in `.ul-btn-label` (position: relative), so inset 0 resolved to the label box.
- **Hold**: transform scaleX from the left, linear on the frame clock (time, not frames), release reverses in --ul-action-hold-release-ms, runs once at 100 %, a short tone flourish, then the async states. The fill DARKENS (rgb 0 0 0 / .34), so the white label only gains contrast: 8.66:1 over the base, 12.53:1 over the fill (destructive, app). Reduced motion: 8 discrete steps.
- **Ripple**: clip-path inset(0 50% 0 50%) → inset(0) on the smooth spring (--ul-action-ripple-ms 520), then fades (--ul-action-ripple-fade-ms 240); the check / label start at the ripple front (--ul-action-ripple-delay). Tone --ul-success-soft (a deep green, so white labels pass: 6.56:1 at the peak, 7.01:1 after). Reduced motion: a 120ms tone fade.
- **Success tone** --ul-success / --ul-success-soft, independent of the accent and the theme accent; used for the check, ring, ripple and saved / copied / published accents, never as a button background. successTone="accent" opts out.
- **No moving light on large lite / flat panels** (tables, charts larger than --ul-perf-promote-max-area): the light stays on small and refracted surfaces.
- **Clipboard fallback**: Clipboard API, else the legacy textarea + execCommand copy inside the click handler (also on http pages and when permission is denied); both failing = error state; values never logged.
- **Dashboard blocks**: composition only. The bulk bar is a ULAnchoredSurface on a viewport-bottom virtual anchor (pours in from the edge); pinSelection on ULTable holds structural live changes while rows are selected. Columns menu items are one definition for the toolbar and the header context menu. Drag reorder (pre-freeze audit, src/components/dashboard/columnsDrag.ts): the grip sits in the ULMenu row's icon slot (no ULMenu change); the row follows the pointer with the slider follow rule (tau --ul-slider-follow, one CSS variable write per frame, no React state per move), other rows FLIP on --ul-ease-smooth, auto-scroll at the scroller edges, Esc cancels and FLIPs back, touch only on the grip (touch-action none there), one commit + polite announcement on drop. Lifted row = flat paint (--ul-cols-drag-bg / -shadow), the menu lens hides during the drag. Grip glyph 16px + 12px ::before = 40px target inside a ≥ 44px row (the row stays the checkbox target). ULTimeAgo uses one shared interval for all instances, stopped while the tab is hidden.

## Success wave (2026-11-08, replaces the band ripple)
- A circular wave from the origin (`successOrigin`: centre by default, the click point with 'pointer'; keyboard → centre) to the FARTHEST corner + feather, so the peak covers every pixel. ONE `.ul-wave` element per wave inside the fx wrapper (inset 0, clipped by the button radius, under the content, outside the refracted layer, never a second glass surface); removed when done.
- Implementation: three radial-gradient layers driven by registered `<length>` properties (--ul-wave-r, -r2, -r3; @property) animated with WAAPI on the frame clock. Chosen over a scaled circle because the ring thickness stays a constant px band (scale would thin / thicken it) and a single small element repaints cheaply. Front: feathered ring (band ≈ 30 % of the half-diagonal, 8–28px) brighter at the front, gentle interior behind it; two trailing wavelets 90 / 180ms behind, thinner and weaker. Tokens: --ul-action-ripple-ms 620, --ul-action-ripple-fade-ms 240, --ul-action-ripple-delay.
- Contrast: label over the full tone 6.56:1 (app) / 7.67:1 (marketing), every accent and variant. The success CHECK is now the label ink on a --ul-success-soft disc: a bare green stroke measured 1.97:1 on light secondary glass over a mid backdrop.
- Pickers: the picked day takes focus and the roving focus follows it (Safari / touch / programmatic clicks do not focus buttons; Esc, arrows and Enter are handled inside the popper).

## Part 2D fixes (2026-11-08, latest)
- **Calendar focus rule** (shared CalendarGrid): keyboard moves are computed on DATES (moveKey: disabled and out-of-range dates skipped, Page by month / Shift+Page by year and Home / End clamp to the nearest enabled date), then the DOM node of that date is focused (focusDayNode). Exactly one day has tabindex 0 and it is always an ENABLED date: enabledNear() (clamp to min / max, then nearest enabled, forward first) sets the initial and on-open focus of both pickers. Never rely on focus() succeeding on a disabled button.
- **Colour picker**: the expand button keeps focus and the second Esc closes; no code change was needed (5/5). Earlier failures were a test collision (below).
- **Success ring pairing**: green alone measured 1.48:1 on a light and < 3:1 on a mid backdrop. --ul-success-ring = 2px --ul-success + an outer --ul-success-ink edge to 3.5px: ink ≥ 4.7:1 on light / mid, green 11.7:1 on dark. Check on its disc and label over the wave peak: worst 6.56:1 across 300 combinations (5 variants × success / accent tone × app / marketing × 5 accents × light / mid / dark).
- **Slow motion for actions**: setActionTimeScale(1 | 0.5 | 0.25) scales only the action animations (wave, ring, shake, width morph, CSS swaps inside .ul-act-body / .ul-btn-fx / .ul-act-ring via playbackRate) and the success / error / swap timers. Press, glass, morph and lens timings are not touched.
- **Tests**: motion-test autoruns the whole suite 900ms after load; a card started by hand during it collided with resetState (Escape every 160ms closed the popper mid-card). Card Run buttons are ignored while a suite run is busy; use ?norun for single cards. The slider follow harness integrates the ideal path on document.timeline (the slider's rAF clock).

## Covered surfaces and tier timing (2026-11-08, Part 10)
- **Tier decided before open.** AnchoredMorph.enter calls decideGlassTier before data-ul-morphing: refract only if the map is decoded now, otherwise lite. The tier stays constant for the whole morph; the lite → refract upgrade runs after it settles with the existing crossfade (--ul-perf-crossfade). Interrupted runs (reverse, reopen) never apply a held tier. No map is built at the decision.
- **Covered promotion.** Every open (cold, warm, reopened during a close) re-asserts scrim → goo → surface in the top layer in the same commit, before paint. A reopen during a close cancels the close's scrim fade.
- **Single card.** showcase/motion-test.dc.html?norun&card=<id>; the covered card also takes &only=<keys> and &modes=cold,warm,interrupt, and reports the first failing frame (hit test centre + corners, rects, stacking chain, top layer, popover calls).

## Dashboard blocks 2 (2026-11-08, Part 11)
- **Inline edit**: one 44px box in both modes (edit keeps the display width as min-width; the validation message is absolutely positioned, never adds height). Focus moves by explicit calls both ways (Safari / touch do not focus clicked buttons). Save = ULSaveButton (icon, ripple success wave); success → idle closes the editor.
- **Live list queue** (src/live/liveQueue.ts): the live-table rule for lists. Inserts animate with the table's insert tokens; announcements are throttled by --ul-live-announce-gap.
- **Bell ring**: WAAPI rotate on the bell icon only for new unread items, ≥ --ul-ntf-ring-gap apart (--ul-ntf-ring-duration / -angle), never in reduced motion. The one new motion in this part; no locked token involved.
- **Notification items** use flat buttons (no glass inside the popover glass); item actions = one shared ULMenu + right-click with the same itemMenu.
- **Code / JSON**: flat panels (--ul-code-bg), syntax colours --ul-code-* (≥ 7:1 on the panel), no external highlighter; the JSON tree renders only expanded children, `pageSize` at a time; search walks at most 50,000 nodes.

## Layout rules (Task 2F, 2026-11-08)
- **ULIcon** (src/components/shared/icons.tsx + icon.css) is the one icon primitive: `size` xs | sm | md | lg → `--ul-icon-xs/sm/md/lg` (0.875 / 1 / 1.25 / 1.5em, default md), or a px number / CSS length. Always an explicit box, `flex: none`, `display: block`, capped at `--ul-icon-max` (48px). Sizing wrappers (.ul-btn-icon, .ul-field-icon, .ul-act-ic …, or `[data-ul-icon-box]`) make it fill their token box. Never an unsized svg; charts, sparklines and progress rings carry `data-ul-illustration`. Cause of the 2F bugs: the old Icon defaulted to 100% and stretched to its container.
- **Control text**: button labels, chips, pills are one line (nowrap, line-height 1, inline-flex centred). Filter chip visual height `--ul-control-chip-h` (32px); the 44px hit area is a ::before on each button, never overflow-clipped.
- **Overlay content width = surface inner width**: `.ul-popover-body` min-width 0 + overflow-wrap anywhere, its children max-width 100%; top-layer popovers restore their max-width (the UA [popover] reset clears it). Components inside a popper ask for a preferred width but never more than 100%.
- **Embedded variant**: a component placed inside a popper / drawer / dialog drops its own card, border and glass (`ULErrorState embedded`; ULNotificationCenter uses it). Glass inside glass stays forbidden. Data cells and list rows use `buttonVariant="plain"` (ULCopyButton) — no glass per cell or row (ULCellId was glass per row).
- **Notification centre is covered** (`anchorVisibility="covered"` default, `'above'` opts back): top layer from frame 0, non-modal (no scrim; outside click / Esc close, focus returns to the bell, aria-expanded / aria-controls stay on the bell), close button in the popover header. Placement `cover` (inset `--ul-popover-cover-inset` 12px) puts the surface over the bell; AnchoredMorph with `overlap` keeps the anchor's box and radius inside every pose (squash, lag and interruptions never expose the trigger). Recommendation: the same rule for large list popovers opened from small icon triggers (e.g. a future inbox / user drawer popover); menus, selects and small popovers stay "above".
- **Guard cards** (showcase/demos-2o.js): layoutoverflow (no descendant > 0.5px outside its popper / drawer / dialog / panel inner rect in list, hover, live insert, error, empty, expanded; also in each viewport-tests frame), iconsize (≤ 2× font size, ≤ 48px, no unsized svg), ctrltext (one line, text centre ±1px), coveredanchor (bell centre + 4 shape corners hit the surface in every frame, cold / warm / interrupted).
- **Showcase load**: Dashboard blocks sections lazy-mount near the viewport (showcase/demo-lazy.js); live demos run only while visible and the tab is visible. ULActionButton never forces a layout per instance on mount.

## Charts (Task 3A, 2026-11-08)
- **One core.** Every chart is built on src/charts (scales, ChartFrame, hover layer, legend, tween). No chart library. The panel is the only glass surface (ULGlass md, quality lite, no moving light on large panels); plot, legend chips, tooltip and table are flat.
- **Tooltip.** Chart value tooltips follow the slider value-tooltip rule: opaque, same shape and arrow as createAnchoredTooltip, sticky, no spring while tracking. The hover layer is ONE positioner: pointer moves write at most one transform per frame (rAF-batched) and never set React state; content, beads and tip offset are written only when the snapped point changes. Flips below when there is no room above.
- **Animation.** Draw-in once on mount (lines by dash, dashed lines and areas by clip reveal, bars grow from the baseline). Data change = morph of values, series weights and domains together (`--ul-chart-morph`, smooth spring, interruptible from the current frame). Same data = no animation. Length change = jump + fade. Reduced motion = 150ms fade only. Hover bead 1.3× bouncy; donut segment moves --ul-data-elastic (2px) outward.
- **Palette.** Six slots --ul-chart-s0…s5 derived from the accent (oklch relative colour, lightness floor --ul-chart-l-min 0.82, hues spread 62–205°; colour-mix fallback). Secondary cues: line dash (solid, 7 4, 2 4, 10 3 2 3, 1 3, 12 5) and fill pattern (hatch, dots, cross, rules).
- **Pattern policy (Task 3B).** `patterns` auto | on | off, default auto. auto = series 3+ get a dash on line marks; fills (areas, bars, donut / pie slices) get patterns only with more than 4 series or categories, or under prefers-contrast: more / forced-colors. Patterns are light ink (white × --ul-chart-pattern-opacity 0.4) so they raise, never lower, the series-to-panel contrast. Legend swatches mirror them.
- **Measured contrast (Task 3B, model = glass worstSurface, 2 themes × 5 accents × subtle / tinted / vivid × dark / mid / light, 2060 rows, 0 fail).** Worst cases (all app · emerald · dark): series 3.86 (s4, vivid), pattern on series 5.05, axis ticks 4.58, legend chip text on 5.77 / off 4.58, reference and threshold edges 3.78 (danger), reference labels 6.9, stale badge 5.68; tooltip text 20.25, tooltip title row 10.36, series keys on the tooltip 10.25. Pinned tooltip = same surface. Before the fixes 407 rows failed (s4 2.79, pattern 1.91, danger line 2.72, accent label 4.16, stale badge 3.8). Reference lines use --ul-chart-ref-*; labels --ul-chart-ref-label; thresholds draw a 1px edge in their tone (the 16 % band alone is not a 3:1 graphic).
- **Accessibility.** Plot = focusable group (aria-roledescription chart) with a nav hint; generated summary per series; polite live readout on keyboard moves; "View as table" swaps the plot for a real table (caption, th scope); legend chips are aria-pressed toggles (last visible series cannot be hidden).
- **Layout.** Width from ResizeObserver (state only on integer width change); margins from tick label length; category labels thin out by width; plot overflow hidden; control text one line (rule 9).
- **Covered popovers (decision, Task 3A step 0).** Large list popovers opened from small icon buttons use anchorVisibility="covered"; menus, selects and small popovers stay "above".


## Advanced charts (Task 3B, 2026-11-09)
- Types: radial ring group, gauge (fill / needle), radar, scatter / bubble, heatmap (matrix, calendar), funnel, histogram, treemap. All on the chart core + src/charts/nav.tsx; one implementation of mark navigation (useMarkNav), axes (ChartAxes), brush (useBrush), colour scales (colorScale), hover indicator (useCellIndicator).
- Hover: cells, bars and tiles use ONE flat indicator element moved by transform (never per-cell glass). The value tooltip is the shared opaque one. The brush readout uses the same opaque tooltip shape (decision: the brief said "glass readout"; glass inside the panel would break the one-glass rule).
- Colour is never the only cue: scatter series = colour + shape (legend keys show the shape), radar / line series dash per policy, treemap and radial fills hatch per policy, heatmaps quantise to 7 steps with numbers in cells when they fit and a numeric legend. Gauge / heatmap / funnel ignore `patterns` (tones + labels / numbers carry the meaning).
- Scales: sequential = purple → blue → teal → green → yellow, lightness 0.80 → 0.97; diverging = blue ↔ neutral ↔ orange, lightness ≥ 0.80. Labels on cells and tiles use --ul-chart-cell-ink-dark.
- Radar labels are HTML (2-line clamp, balanced, never clipped at 375px; the full name is in the axis tooltip).
- Treemap: squarified; names hide below 56 × 24 px, values below 42 px height; drill-in through embedded ULBreadcrumbs.

### Zoom rules
- Plain wheel never zooms and never calls preventDefault (page scroll wins). Ctrl / Cmd + wheel (trackpad pinch) and touch pinch zoom around the pointer; Shift+drag and one-finger touch pan; drag = brush; Esc cancels a brush; double-click / "Reset zoom" / `0` reset; `+ -` and Shift+← → for keyboard users.
- The view is a domain [from, to]; the body renders the visible slice with `xDomain` = view (time), ticks recomputed per view, the tooltip stays on real points. Zoom steps jump (`animate: false`); onRangeChange is debounced 160 ms for continuous gestures, immediate for brush / keys / reset.

### Decimation and the canvas fallback
- LTTB (drawing only) when points exceed 2 × plot pixels; first, last, global min and max kept. Above --ul-chart-canvas-at (5000) line / area marks draw on one canvas under the same HTML hover layer: tooltip, beads, keyboard and table are identical to SVG mode.
- Scatter / bubble (pre-freeze audit): same switch point and `renderer` prop. Canvas paints in data order, fill then stroke per point (same order as SVG), selected points last; trends on the canvas after the points. Tooltip, keyboard nearest neighbour, brush and context menu read the same quadtree / pixel arrays, so they do not depend on the renderer (card scattercanvas). Trade-off: no per-point DOM in canvas mode, so CSS hooks on .ul-scatter-pt do not apply there.

### Streaming rules
- createChartStream commits at most once per animation frame; bounded buffer (maxPoints, and points older than 1.5 × window are dropped); out-of-order points are dropped.
- Hover / pin holds the view (hold), the user pause comes from ULLiveStatus; both queue and show "N new points" (liveQueue rule); resume applies everything at once.
- The window scrolls per frame only while live, visible and not reduced motion; reduced motion = the window jumps per commit and the bead does not pulse. Stale after `staleAfter` ms without points (ULLiveStatus + stale badge).

### Measured contrast (3B additions, worst case, model = glass worstSurface, 2 themes × 5 accents × 3 strengths × 3 backdrops)
heatmap label on cell 9.89 · treemap label on tile 9.68 · sequential cell vs panel 3.93 · diverging cell vs panel 3.87 · radar rings 3.28 · gauge band 3.77 · gauge target / needle 6.9 · comparison marker 4.89 · funnel step 4.33 · funnel drop-off text 5.26 · brush edge 3.98 · hover indicator 6.9 · tooltip 20.25. Fixed with tokens: --ul-chart-seq-* / --ul-chart-div-* lightness floor 0.80 (was 0.56 / 0.60: 1.56 / 1.89), --ul-chart-ring .52 (grid .08: 2.06 at .3), needle-mode bands use the tone directly (2.41), funnel drop-off text --ul-chart-danger-ink (3.77).

## Task 3C (2026-11-09)
### Contrast tool (one implementation)
- showcase/ul-contrast.js (window.ULContrast) is the only contrast tool; every probe page loads it. ready() waits for every stylesheet, document.fonts.ready and resolved tokens; resolver(root).get(expr) parses the computed colour in any CSS Color 4 space and maps it to sRGB with the CSS Color 4 gamut-mapping algorithm (oklch chroma reduction, deltaEOK JND 0.02); unresolved tokens and unparseable values throw. ratio(fg, bg) composites a translucent fg over an opaque bg and refuses a translucent bg. selfTest() checks known conversions.
- The library's contrast.ts toRGB (canvas fillStyle) is not used by the reports; readContrastTokens' text colours are replaced with resolved values.
- Re-measured chart matrix (8800 rows: 7 everyday types + 3B types, 2 themes × 5 accents × 3 strengths × 3 backdrops): before fixes 644 fail (bar bottom stop .72 → 2.69, sparkline loss bar 2.09 / win, area line vs own fill). Fixed with chart tokens: --ul-chart-bar-fade 0.88 (was a literal .72), --ul-chart-spk-bar-opacity 0.88 (was .78), --ul-chart-win / --ul-chart-loss (= reference success / danger tones instead of the raw status colours). After: 0 fail. Worst: line / area / donut 3.89, bar / combo 3.33, sparkline 3.24, patterns 4.69, ticks 4.58, chip on 5.77 / off 4.58, reference line 3.77, ref label 6.9, stale badge 5.71, tooltip 20.25 / secondary 10.36 / keys 10.53 (all app · emerald · vivid · dark except tooltip).
- Area: the requirement is the edge line vs the panel (3.89). Line vs its own translucent fill (2.1) is reported as info only: same series, the fill is decorative.
- Action matrix (2340 rows, label ink read from rendered ULButtons per variant): 0 fail. Worst: check on disc 6.56, label over wave front 6.56, wave interior 6.74, success ring (best of green / ink edge vs page) 4.41 (marketing · rose · vivid · mid; green alone 2.54, so the ink edge carries it on mid).
### Coverage
- docs/shadcn-coverage.md is the coverage decision list (names only; shadcn is a reference, never a source). It decides what 3D builds.
### Fields and input groups (3C)
- ULField wraps any control and owns label, description and error; controls get id + aria-describedby (description, addons, counter, error) + aria-invalid + aria-errormessage + aria-required via context (UL controls) or clone (native) or render prop. One label per control (UL controls drop their own label / messages inside ULField).
- A new error is announced through the one polite live region; never focus-stealing, never aria-live on the error node (double announcements). Field set errors use the same rule.
- Error text wraps by default (overflow-wrap anywhere, never wider than the field); truncate = one line + the shared truncation tooltip. Error ink = --ul-field-error-text.
- Horizontal fields and column groups collapse to one column below 480px of their own width (container queries).
- ULInputGroup = ONE inset well (field tokens), not glass; inner controls lose their well, label and messages; no second border. Focus ring is outside the well (--ul-focus-width ring), invalid = danger rim. Inline buttons are plain (.ul-well-btn, 44px hit); ULSelect uses a plain trigger and ULCopyButton the plain variant inside a group (no glass inside the well). Addons are one line, max 45% of the width, ellipsis.
### Feedback + structure (3C)
- Glass budget for in-flow components: ULAlert, ULItem, ULSeparator, ULCollapsible, ULScrollArea and the ULKbd caps are flat or tinted paint, never a glass surface per instance. Glass stays on overlays (dialog, popover) and controls (buttons, segmented well lens).
- Alert tones: --ul-tone-info / success / warning / danger / neutral, shared with ULBanner (banner now reads the same tokens). Alert = colour-mix(tone 13 %, --ul-alert-base) + 1px tone rim, title = text, description = text-2, icon = tone 70 % white. role="alert" for warning / danger, role="status" for info / success / neutral.
- ULAlertDialog = ULModal role alertdialog on the dialog surface (covered, top layer). Initial focus = Cancel; Esc and scrim cancel; focus returns to the trigger. Inside an open dialog use useAlertDialog() (push, same surface). Type-to-confirm reuses ULTypeToConfirm (also used by ULConfirmAction). Quick cases: ULConfirmPopover on ULPopover (non-modal, 'above').
- ULToggleGroup single = createLensSelect (the segmented / tabs implementation: one resting indicator, no new indicator code), radio semantics, arrows move and select. Multiple = aria-pressed, arrows move focus only, pressed items flat paint (one indicator cannot mark several items). Icon-only items need tooltip (= aria-label + createAnchoredTooltip).
- ULCollapsible: measured height morph (from = current rendered height, also mid-animation; to = measured content height or 0), WAAPI px → px, inline height cleared on finish: never animated to auto. Timing aliases the colour-picker expansion tokens (--ul-collapsible-* → --ul-colorpicker-*), overshoot 0 for in-flow content. Reduced motion: 150ms opacity.
- ULScrollArea: the viewport is the native scroller (wheel, touch momentum, keyboard when focused); no wheel / touch listeners, one passive scroll listener + ResizeObserver, painting batched per frame. Native bars hidden; flat overlay thumb (--ul-scroll-thumb) appears on hover / scroll / focus and fades after --ul-scroll-idle-ms; drag on the thumb and page click on the track. Edge shadows (flat gradients) show only where more content exists. Works in popovers and drawers (plain box, max-height).
### Measured contrast (3C, shared tool, 2 themes × 5 accents × graphite + 3 strengths × 3 backdrops, 2400 rows, 0 fail)
alert title / description 5.24 (description ink is now --ul-color-text: text-2 measured 3.48 on vivid emerald), alert icon 3.21, field error 4.78 (--ul-field-error-text danger 44 % white, was 50 % = 4.49), required asterisk 4.78, label optional / description 4.56, input group addon 9.22 / value 16.57, kbd cap 5.49, scroll thumb 3.83 (--ul-scroll-thumb white .6, was .42 = 2.68), separator label 4.58, pressed item / toggle text 5.0. Separator line 1.39 is decorative (info only). Charts (8800) and actions (2340) re-run after these changes: 0 fail, worst cases unchanged.
### 3C owner fixes (9 Nov 2026)
- Morph text re-wrap (shared, proved bug): the morph stage was pinned to offsetWidth (rounded down: 213.16 → 213px), so text that just fitted wrapped for the whole morph (ULConfirmPopover description). The stage now uses the used fractional size (stageW / stageH from getComputedStyle). Applies to every anchored overlay; no timing or token changed.
- Buttons in overlays reset on close: ULActionButton listens for the shared ul:morph exit end of the surface that contains it, cancels its animations, removes the wave and resets the action to idle. Content that unmounts on close was already idle; this covers kept-mounted content.
- ULSelect trigger is the field well (same well, rim, inset, hover, focus ring as text fields), not glass. The list stays a glass popper.
- Field wells and rims carry the local accent: --ul-field-accent-mix 12 % (hover 16 %), --ul-field-rim-accent-mix 32 % (hover 46 %), mixed on the field container (.ul-field, .ul-ffield, .ul-igroup, .ul-select, .ul-combobox) so the nearest data-ul-accent applies. Addon text on the tinted well measured 7.04 (worst), 0 fail in 2400 rows.

- Field rim --ul-field-rim .18 (was .14): rim over the well vs the page 3.11:1 (was 2.83, below 3:1), Step 4D.

## Locked timings guard (2026-11-09)
The table at the top is the source; `scripts/locked-timings.json` mirrors it name by name (42: 23 lens, 3 switch, 4 `--ul-selection-switch-*` w / h / inset / thumb, `--ul-tabs-glide`, `--ul-tabs-press-glide`, `--ul-slider-follow`, 6 `--ul-pop-*` enter / exit / lag / overshoot / stretch / offset, springs bouncy / smooth / snappy). The earlier "36" counted the 33 tokens + 3 springs and left out the 6 pop values; the 4 selection-switch tokens were part of the 33. `scripts/check-locked.mjs` compares tokens.json, the first `:root` block of tokens.css (theme and reduced-motion overrides of pop overshoot / stretch are intentional and not compared) and DESIGN.md; springs are compared as k / c / m in tokens.json and as the generated `--ul-ease-*` curve in tokens.css. Reports state only "42 checked, N differences".

## Hover card (2026-11-09, Task 3D)
- ULHoverCard = ULPopover (anchorVisibility above, scroll follow, autoFocus off). No new overlay or motion code.
- Intent: open after --ul-hovercard-open-delay (500ms) of hover or after focus-visible; close --ul-hovercard-close-delay (250ms) after the pointer left trigger and card and focus is outside. One document pointerover / focusin listener while open decides inside vs outside.
- Bridge: .ul-hc-bridge inside the surface covers the --ul-pop-offset gap on the placed side (the .ul-sub-bridge technique), hidden while morphing.
- One open card per `group` (module registry); opening closes the previous one at once.
- Not essential information: touch tap toggles (default action of the tap suppressed), mouse users can always reach the same data elsewhere. Keyboard: Tab from the trigger enters the card when it has controls.

## Menubar (2026-11-09, Task 3D)
- Flat paint bar (--ul-menubar-*), the shared createNavIndicator with a flat lens resting on the open trigger. No glass in the bar.
- One ULMenu per trigger. Switching while open closes the current menu and opens the next in the same frame (old surface exits, new one enters). AnchoredMorph has no re-anchor entry point and overlay code is frozen, so no surface travel between triggers; add a re-anchor API only with sign-off.
- ← / → inside an open menu are taken by the bar only when the menu did not consume them (submenu open / close / drill-out keep priority).
- ULKbd moved to src/components/ULStructure/kbd.tsx (re-exported from structure.tsx, public API unchanged) so ULMenu can render `shortcut` strings with it without importing the structure module.

## Navigation menu (2026-11-09, Task 3D)
- Desktop: flat list + shared nav indicator (rest = open trigger, else aria-current). One ULAnchoredSurface anchored to the <nav> (align start, scroll follow, role region); switching panels keeps the surface open and runs the shared runViewSwap (same as dialog push and menu drill-in), so panel changes morph size on one surface.
- Phones (< collapseBelow, 640): Menu button → ULSheet; panel items push a view through the dialog context (drill-in), never a second modal.
- Debt: the landing megamenu lives in landing/chrome/SiteHeader.dc.html (marketing DC), not in the library. Extracting it would change the header, which may only change in ULIsland + SiteHeader; it stays as is. Converging the header megamenu onto ULNavigationMenu is a v0.2 candidate (needs owner review of the header).

## Native select, calendar, aspect ratio (2026-11-09, Task 3D)
- ULNativeSelect is a real <select> with the ULSelect trigger classes (.ul-select-trigger[data-plain] = the field well), so well, rim, accent tint, focus and invalid states are the same rules. ULSelect native="mobile" renders it under (pointer: coarse); "always" everywhere.
- ULCalendar lives in ULPickers.tsx and uses the one CalendarGrid, enabledNear, moveKey and the Bands class (one band element per week row and layer). Flat: selected = --ul-calendar-sel tint + accent ring, ink = text; no beads, no lens, no glass.
- ULAspectRatio is CSS only (aspect-ratio + object-fit on media children); skeleton = ULSkeleton.
- DOM screenshot tools paint <select> with its first enabled option; read select values from the DOM (cards do).

## Resizable (2026-11-09, Task 3D)
- Sizes live in a ref (percent) and are written as --ul-rs-<i> by one rAF loop: the slider's critically damped follow (tau --ul-slider-follow while dragging, read only) and --ul-resizable-collapse-tau (90ms) for keys, collapse and reset. No React state per pointermove; aria-valuenow / min / max are written on the handle node.
- Collapse is that same follow toward a measured percent (never auto); reduced motion snaps. Dragging below half of minSize snaps a collapsible panel closed.
- Handle = flat line + grip (--ul-resizable-*), accent on hover / focus / drag, 44px hit area via ::before. No glass.
- stackBelow: a ResizeObserver on the group's parent stacks panels vertically at natural height and hides the handles.

## Carousel (2026-11-09, Task 3D)
- Native scroll-snap (x mandatory, snap-stop always); touch keeps native momentum (touch-action pan-x pan-y, no wheel / touch listeners that prevent default). Mouse drag writes scrollLeft once per frame with snapping off, then snaps to the nearest slide.
- Programmatic travel (buttons, keys, dots, autoplay) keeps the index on the target until the track lands (scrollend / position), so the indicator never walks through intermediate slides.
- Indicators are buttons; the shared createNavIndicator lens rests on aria-current. No own indicator code.
- Autoplay is opt-in, never under reduced motion, pauses on hover and focus; the status line is aria-live polite only while autoplay is not running.
- New icons: pause, play, external.

## Typography (2026-11-09, Task 3D)
| token | value | use |
|---|---|---|
| --ul-type-display | clamp(2.25rem, 1.6rem + 2.6vw, 3.75rem) | hero / page title, once per view |
| --ul-type-h1 | clamp(1.875rem, 1.45rem + 1.7vw, 2.75rem) | page title |
| --ul-type-h2 | clamp(1.5rem, 1.25rem + 1vw, 2.125rem) | section |
| --ul-type-h3 | clamp(1.25rem, 1.12rem + .5vw, 1.5rem) | sub-section, card title on pages |
| --ul-type-h4 | 1.125rem | group title |
| --ul-type-lead | clamp(1.125rem, 1.05rem + .3vw, 1.3125rem) | intro paragraph |
| --ul-type-body / small / caption | 1rem / .875rem / .8125rem | text, dense UI, captions |
| line heights | tight 1.15 · heading 1.25 · body 1.6 · small 1.45 | |
| weights | display 700 · heading 650 · strong 600 · body 400 | |
| tracking | display −0.02em · heading −0.01em · caps 0.06em | |
- Rules: heading level follows the outline, size follows the design (ULHeading level + size). One display per view. Body never below --ul-type-small in reading text; captions only for metadata. Numbers in tables and counters use tabular (ULText tabular / --ul-type-numeric). Measure 68ch for prose.
- Ink: --ul-type-ink (text) and --ul-type-ink-2 (muted); links keep text ink with an accent underline, so contrast does not depend on the accent. Links: focus ring outside (outline-offset 3px), external links get the ULIcon external glyph, rel noopener noreferrer external, target _blank and a spoken "opens in a new tab" (EN / SK / DE / CS).
- Wrapping: overflow-wrap anywhere on all type and prose; pre and tables scroll inside their own box. Existing components keep --ul-text-* (component scale); --ul-type-* is the page / content scale.

## Direction (RTL) (2026-11-09, Task 3D)
RTL is not supported in v0.1. Audit and plan: docs/rtl-audit.md (probe: showcase/probe-rtl.dc.html). Main gaps: portalled overlays do not inherit dir, physical arrow keys, unmirrored directional icons, field label / affix bidi, numeric alignment, chart axes. New components use logical properties so the in-flow parts already mirror. No locked value is involved in the plan.

## Test pages (Task 3D)
- probe-forms.dc.html ?only=batch2 (demos), ?cards=<id> (hovercard, menubar, navmenu, nativeselect, calendar, aspect, resizable, carousel, typography, contrast3d), ?guard (1280×800, 924×540, 375×667, now incl. 3D demos and their overlays). motion-test ids f3d<id> (?norun&card=f3d<id>).
- Horizontal scrollers (carousel track, menubar, navigation list) carry data-ul-allow-overflow for layoutoverflow.

## Keyboard audit (pre-freeze, 2026-11-09)
- One card, kbdaudit (showcase/demos-kbd.js), drives every demo section with synthetic keys. Native default actions are emulated and counted (Tab = focus the next tabbable when the component did not handle it; Enter / Space on a native button = click()). Real focus events, :focus-visible and document.hasFocus() are NEEDS FOCUS.
- Menu initial focus rule: focus moves into a menu on every open, not only on mount; when the surface is not focusable yet (cold first open, reopen during the exit), the move is retried per frame for up to 1.5 s and once at the enter morph's end. Opened with initialFocus null (pointer fixtures) it stays on the trigger.
- ULPagination: the segmented values are page numbers so roving focus follows the selected page when the window of page numbers shifts.
- Reduced transparency can be forced (`html[data-ul-transparency="reduce"]`, `?transparency=reduce`): same solid-surface rules as the media query and no refraction; used by the fallback audit and available as a user setting.

## Hit areas (pre-freeze fixes, 2026-11-09)
- One shared hit layer: src/components/shared/hit.css (imported with ULIcon, so every component has it). Geometry: `position:absolute; inset: min(0px, (100% - --ul-control-hit-min) / 2)`, square (hit testing follows border-radius), invisible. The visual box, layout, getBoundingClientRect and the focus ring (painted on the control) do not change.
- Hosts: `::after` on plain controls (`.ul-hit`, `.ul-hit-y` or the component list in hit.css: chip remove, bulk more, columns button, tab, segmented / toggle-group item, carousel dot, feed chip / pill, filter chip buttons); a `<span class="ul-hit-layer">` child where glass owns ::before / ::after (ULButton, ULSelect trigger). The five per-component layers (ULButton .ul-btn-hit transform, segmented sm ::after, carousel dot ::before, chip-x ::before, filter chip ::before) are replaced by it.
- Axes: `.ul-hit` = both (icon-only / isolated). `.ul-hit-y` = vertical only for controls in a row (tabs, segmented and toggle-group items, chips, carousel dots, pagination, buttons inside [role=toolbar] / [role=group] / .ul-btn-row / .ul-copyfield-well), so no layer takes area from a neighbour.
- Lens geometry: the layer is a pseudo / absolute child, the lens bubble measures the item's own rect. Card hitarea asserts every tabs / segmented / toggle-group item rect and every bubble rect are identical with the layer on and off (`html[data-ul-hit="off"]`, test hook).
- Native `<select>` cannot carry a pseudo: ULCalendar month / year selects use the real 44px minimum.
- Documented exceptions (WCAG 2.5.8, 24px minimum): dense table cells (`density="compact"`), inline text links (incl. feed inline targets), calendar day grid (43px, adjacent on both axes). Open: one ULCellId copy button in a table cell loses its bottom 3px to the table scroller (card hitarea lists it).

## Callback naming (pre-freeze fixes, 2026-11-09)
- value / defaultValue / onValueChange (value controls) · checked / defaultChecked / onCheckedChange (ULSwitch, ULCheckbox) · pressed / defaultPressed / onPressedChange (toggle buttons: ULButton, ULToggleButton, ULToggleIconButton) · open / defaultOpen / onOpenChange (overlays, collapsible, hover card).
- Before: onChange × 7 (ULDateRangePicker, ULToggleIconButton, ULColumnsMenu, ULFilterBar, ULTimeRange, useColumnsState option, observeSectionAccent option); onValueChange × 22 (Accordion, Sidebar, TextField, TextArea, NumberField, OtpField, TagField, InputGroupInput, Select, NativeSelect, DatePicker, ColorPicker, Calendar, SegmentedControl, RadioGroup, Slider, RangeSlider, ToggleGroup, Tabs, async action mode, InlineEdit, CodeBlock). After: onChange × 0 declared.
- Documented native wrappers (forward the native DOM change event via the inherited HTML attribute, never redeclared): ULTextField, ULTextArea, ULInputGroupInput, ULCheckbox, ULRadio. scripts/check-callbacks.mjs fails on any declared onChange prop in src or onChange passed to any other UL component.

## Token integrity (pre-freeze fixes, 2026-11-09)
- Tokens live only in tokens/tokens.json; tokens.css is generated. scripts/check-tokens.mjs (npm run check:tokens, in build; runnable in the design tool) checks every var(--ul-*) read in src, showcase, landing, apps and tokens.css: defined in tokens.css, registered (@property / registerProperty), set in code (setProperty, style objects, inline style), declared on a component selector, or in an app token sheet (apps/ds/tokens.css). Prefix reads (var(--ul-chart-s${i})) match by prefix. JS lookups count as reads for the unused list.
- First run: 66 used-but-undefined → after counting app sheets / JS lookups / prefixes, 9 real: defined in tokens.json with the values the code already fell back to: --ul-tooltip-bg #0b0912 / --ul-tooltip-ink #f4f2f8 (the ULTooltip values; chart and slider tooltips now share them), --ul-fgroup-min 220px, --ul-ease-spring cubic-bezier(.3, 1.4, .5, 1), --ul-field-well-shadow, --ul-glass-fringe-w 1.5px, --ul-glass-fringe .05, --ul-color-ink #0b0d12 (dark ink on accent fills), --ul-z-veil calc(--ul-z-overlay − 1) (app transition veil, under modals). Ignored on purpose: --ul-does-not-exist (contrast tool self-test).
- Earlier copies: only _archive/design-system-v0/tokens.css (a superseded token layer, different names / rem scale; not a copy of this file) and the 3B record in DESIGN / CHANGELOG. DESIGN 3B proves --ul-chart-ring .52 → restored (re-derived value was .50; radar rings 3.28:1 again). Named in CHANGELOG 3B but absent and unread: --ul-chart-cell-ink-light, --ul-chart-trend, --ul-chart-overview-h (no value on record, not restored). No other value is proven; the remaining re-derived chart scale values stay (owner eyeball: docs/shots/4-chart-colours-*).

## JSDoc rule (pre-freeze fixes, 2026-11-09)
- Every public prop of a new or changed component gets a JSDoc line: what it does, default, allowed values (and a short example when not obvious). Short props may share a line: `/** … */ a?: T; /** … */ b?: U;`. Coverage per family: scripts/check-jsdoc.mjs.

## Viewport tests harness (pre-freeze fixes, 2026-11-09)
- One frame at a time (?frame=1280|924|375). vt-frame loads only the bundle and showcase/viewport-harness.js; each step loads its own demo scripts and mounts fixtures when it starts; steps run sequentially (toast, radius, narrow, submenu, layout, charts, batch) and post progress; a step past its timeout reports NEEDS HEALTHY PREVIEW instead of stalling the run.

## Decisions (owner, 9 Nov 2026)
- The 7 callback renames (CHANGELOG "0.1.0 breaking vs pre-release") are accepted as breaking for 0.1.0; no aliases.
- The 27 unused tokens are kept and reserved (docs/tokens-reserved.md); not removed or renamed in 0.1.x.
- The calendar day grid is a documented exception to the 44px rule: 43px cells, adjacent on both axes, above the WCAG 2.5.8 minimum of 24px.
- Visual change: ULCalendar's native month / year selects are 44px tall (were 36px), because a native select cannot carry the invisible hit layer. Shot docs/shots/4-calendar-dropdowns.png (DOM capture shows the first option of a native select; the live control shows the current month / year).
- Table hit areas: the hit layer in a table cell never grows past the row height; ULTable reserves --ul-table-hscroll-room below the table only when an overlay horizontal scrollbar is present (classic scrollbars take their own space).
- Contrast numbers come only from showcase/ul-contrast.js (the shared tool; there is no scripts/contrast.mjs).

## Pointer-anchor open rule (2026-11-09)
- Context menus (ULContextMenu, useContextMenuTarget): closed or closing → open in the same task (a reopen during the exit reverses the morph from its current pose); open → re-aim = exit, then a new enter from the new point on the next frame; any close or new open cancels a pending re-aim. Never defer the first open.
- Switch release: flick velocity decays linearly to 0 over 60 ms after the last move; a flick is a gesture ≥ 0.15 px/ms; projection = decayed velocity × --ul-lens-flick.
- Frame-timing tests: limits relative to the measured refresh (median rAF period): p95 ≤ 1.15 × period, fps ≥ 0.9 × rate; below 50 Hz → NEEDS HEALTHY PREVIEW.
