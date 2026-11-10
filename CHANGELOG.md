# Changelog

## 0.1.0 — 2026-11-10
Not tagged, not published (owner: docs/release-checklist.md). Earlier per-task records below are kept as history.
### Added
- `ULProvider` with `material`: "glass" | "flat" or per category `{ default?, inputs?, controls?, surfaces?, overlays?, chrome? }`. Nearest provider wins per category.
- Instance prop `material` ("glass" | "flat") on ULGlass (+ `materialCategory`), ULButton, ULSwitch, ULTextField, ULTextArea, ULNumberField, ULOtpField, ULTagField, ULSelect, ULCombobox, ULNativeSelect, ULInputGroup, ULCopyField, ULDatePicker, ULDateRangePicker, ULColorPicker, ULTimeRange.
- Non-React path: `data-ul-material="glass|flat"` on any element (nearest attribute wins; engine + CSS).
- Exports: `useMaterial`, `resolveMaterial`, `mergeMaterialScope`, `MATERIAL_DEFAULTS`, `MATERIAL_CATEGORIES`, `isFlatMaterial`; types `Material`, `MaterialCategory`, `MaterialConfig`, `ULProviderProps`.
- Package entry points for consumers: `.` → `dist/esm/index.js` (ESM, React external) with types `dist/types/src/index.d.ts` (types first in the exports map); `./package.json`. Scripts `build:esm`, `build:types` (tsconfig.build.json), `build:release`. Verified 2026-11-10; `build:types` post-processes dist/types (`scripts/fix-dts-extensions.mjs`) so `.d.ts` imports use `.js`.
- `npm run check:api` (scripts/api-surface.mjs, snapshot docs/api-surface.txt: 674 exports on `.`, same surface on `./dist` and `./dist/min`) and `npm run check:pack` (scripts/check-pack.mjs).
- examples/vite-smoke (not published) for the post-publish install test.
### Changed
- Inputs default to flat. Visible change: date / date-range / colour picker triggers (and ULTimeRange's custom range trigger) render the field inset well instead of glass; field wells (text, textarea, number, tag, combobox) lose the pointer light. Select, native select, OTP, input group and copy field were already flat wells: no visible change. Picker / select / combobox popovers stay glass.
- Flat primary / destructive buttons keep their accent fill (shared flat rule in ULGlass.css; was the grey deep-accent plate). Secondary and ghost unchanged; reduced-transparency look unchanged.
- Flat picker triggers (date, date range, colour, ULTimeRange custom range) use the text / select inset well instead of a solid plate. Popovers stay glass.
- ULOtpField sizes to its container (cells 48 → min 36px, gap 8 → 4px); fixes the sixth cell overflowing narrow cards. Normal width unchanged.
- OTP: only the focused box shows the focus ring (all six lit before). --ul-field-rim .14 → .18 (rim vs page 2.83 → 3.11:1).
- Tests: material card + flat-primary, picker-well; new card otplayout (375 / 480 / 720).
- ULTable row actions ⋯: icon-only on hover / focus (no background, no rim; the icon brightens to --ul-color-text); glass only while its menu is open.
- Callback naming, no aliases (breaking vs pre-release): ULDateRangePicker, ULFilterBar, ULTimeRange `onChange` → `onValueChange`; ULColumnsMenu `state` / `onChange` → `value` / `onValueChange`; ULToggleIconButton `onChange` → `onPressedChange`; useColumnsState and observeSectionAccent option `onChange` → `onValueChange`. Added ULCheckbox `onCheckedChange`.
- `ULChartV1` removed; use `ULChart` (same props).
- peerDependencies react / react-dom `^19.0.0` (the tested range; was `>=18.3 <20`).
- package.json: `.` no longer points at `src/index.ts`; `src` is not published (dist/esm + dist/types replace it). `sideEffects` = CSS + the two window.UL bundles. `main` / `module` / `types` point at the ESM build.
### Fixed
- ULOtpField sixth cell overflowing narrow cards; only the focused OTP box shows the ring.
- Context menus: open immediately when closed or closing, re-aim only when open; a pending re-aim is cancelled by any close (interrupt jump, leftover surface).
- ULSwitch flick velocity decays over 60 ms (documented value); ULFilterBar saved view without onApplyView threw (called removed `onChange`).
- ULGlass `pressScale` reaches the engine (picker triggers press at .98 again); ULMenuButton forwards `closeOnSelect`; ULIsland HEADER_DEFAULTS.poppers = ['lang'].
- ULTable overlay horizontal scrollbar covered the last row (reserves --ul-table-hscroll-room); ULCalendar month / year selects 44px; ULMenu focus on every open; ULPagination arrow-key focus; ULTabs aria-controls only for rendered panels.
- ULCodeBlock multi-line block comments; bash `#` only at line start / after whitespace.
### Known limits
- OTP cells shrink to 36px wide at a 280px container; the hitarea card only tests the normal width.
- Flat vs reduced transparency differ for primary / destructive buttons (flat keeps the accent fill, reduced transparency stays a dark deep-accent plate).
- --ul-field-rim raised .14 → .18 (3.11:1); this also affects the field border in glass.
- Timing / fps cards are valid only on a ≥ 100 Hz display in Chrome; Safari runs rAF at 60 Hz.
- Dark-only in v1; no RTL (plan in docs/rtl-audit.md). JSDoc 85 % overall, 33 % in the "other" family (v0.1.1).
- v0.2: ULMenubar re-anchor, header megamenu → ULNavigationMenu, lazy-loaded action icons.
- Copy field well has no hover / invalid / disabled state (no props for them).
- 1 moderate npm audit finding, package not yet identified.

## Pre-release record: 0.1.0 Unreleased (step 4A–4C+)
### Added (public API)
- `ULProvider` with `material`: "glass" | "flat" or per category `{ default?, inputs?, controls?, surfaces?, overlays?, chrome? }`. Nearest provider wins per category.
- Instance prop `material` ("glass" | "flat") on ULGlass (+ `materialCategory`), ULButton, ULSwitch, ULTextField, ULTextArea, ULNumberField, ULOtpField, ULTagField, ULSelect, ULCombobox, ULNativeSelect, ULInputGroup, ULCopyField, ULDatePicker, ULDateRangePicker, ULColorPicker, ULTimeRange.
- Non-React path: `data-ul-material="glass|flat"` on any element (nearest attribute wins; engine + CSS).
- Exports: `useMaterial`, `resolveMaterial`, `mergeMaterialScope`, `MATERIAL_DEFAULTS`, `MATERIAL_CATEGORIES`, `isFlatMaterial`; types `Material`, `MaterialCategory`, `MaterialConfig`, `ULProviderProps`.
### Changed (default look)
- Inputs default to flat. Visible change: date / date-range / colour picker triggers (and ULTimeRange's custom range trigger) render the field inset well instead of glass; field wells (text, textarea, number, tag, combobox) lose the pointer light. Select, native select, OTP, input group and copy field were already flat wells: no visible change. Picker / select / combobox popovers stay glass.
- Flat primary / destructive buttons keep their accent fill (shared flat rule in ULGlass.css; was the grey deep-accent plate). Secondary and ghost unchanged; reduced-transparency look unchanged.
- Flat picker triggers (date, date range, colour, ULTimeRange custom range) use the text / select inset well instead of a solid plate. Popovers stay glass.
- ULOtpField sizes to its container (cells 48 → min 36px, gap 8 → 4px); fixes the sixth cell overflowing narrow cards. Normal width unchanged.
- OTP: only the focused box shows the focus ring (all six lit before). --ul-field-rim .14 → .18 (rim vs page 2.83 → 3.11:1).
- Tests: material card + flat-primary, picker-well; new card otplayout (375 / 480 / 720).
- ULTable row actions ⋯: icon-only on hover / focus (no background, no rim; the icon brightens to --ul-color-text); glass only while its menu is open.

## Pre-release record: pre-freeze audit and fixes
### Pre-freeze fixes
- package: peerDependencies react / react-dom ">=18.3 <20"; devDependencies @types/react ^19, @types/react-dom ^19. ULIsland HEADER_DEFAULTS.poppers = ['lang'] (stale 'acct' rendered a second language button in the fallback tools).
- Typecheck pass (unverified until the owner reruns tsc): ULActionButton family omits the native `onError` (onError = action error callback); ULCopyButton omits native `onCopy` (onCopy(text) kept); ULSubmitButton omits native `onSubmit` (action kept). ULAnchoredSurface types `accent` / `accentStrength` (already forwarded at runtime). ULGlass: `pressScale` now reaches the engine (was leaking to the DOM; picker triggers press at .98 again) and ULGlassProps types the forwarded `type` / `disabled` / `name` / `form` / `href` / `target` / `rel` / `download` / `hrefLang`. ULMenuButton forwards `closeOnSelect` (the columns menu stays open while toggling). ULFilterBar saved view without onApplyView called a removed `onChange` (ReferenceError) → onValueChange. Charts: splitChartCtx generic over the props and inferred target type.
- Focused runs (fixes 3): context menus (ULContextMenu + useContextMenuTarget) open immediately when closed or closing and re-aim on the next frame only when open; a pending re-aim is cancelled by any close (fixes the interrupt jump and the leftover surface after rapid cycles). ULSwitch flick: velocity decays over 60 ms (as documented, was 40) and the flick threshold applies to the gesture speed. ULCodeBlock: multi-line block comments highlighted; bash # only at line start / after whitespace. Tests: limits relative to the measured refresh (p95 ≤ 1.15 × period, fps ≥ 0.9 × rate), segmented well check skips on fallback tiers, one hit-area probe for hitarea + a11ystatic, harness charts marked data-ul-illustration, kbdaudit initialFocus-null fixture flag. showcase/focused-runs.dc.html (owner launcher), lens-tests ?card=<id>, probe-ctx.dc.html.
- Hit area (fixes 2): overlay horizontal scrollbar of ULTable covered the last row's bottom 4px → ULTable reserves --ul-table-hscroll-room (16px, new token) below the table only when it scrolls horizontally with an overlay scrollbar; hit layer in table cells capped to the row height (--ul-hit-size); "+n" tag chip gets the vertical hit layer. showcase/probe-cells.dc.html. hitarea PASS (1,086 controls, 0 effective < 44).
- Visual: ULCalendar month / year native selects 44px tall (were 36px); shot docs/shots/4-calendar-dropdowns.png.
- Decisions recorded (DESIGN "Decisions"): 7 callback renames accepted as breaking for 0.1.0; 27 unused tokens reserved (docs/tokens-reserved.md); calendar day grid = documented 44px exception (43px, WCAG 2.5.8 ≥ 24px).
- JSDoc defaults: scripts/check-jsdoc-defaults.mjs (part of check:jsdoc): 299 checked, 195 matched, 40 docs corrected, 104 reviewed by hand, 0 mismatch.
- 0: typecheck skipped (no tsc output pasted).
- 5: viewport-tests: one frame at a time (`?frame=1280|924|375`; without it the frames run in sequence, only one iframe mounted); vt-frame loads the minified bundle + harness only, every step loads its demos and mounts fixtures lazily; steps toast → radius → narrow → submenu → layout (overflow, icons, control text) → charts (3A + 3B) → batch 1 / 2, sequential with progress, per-step timeout = NEEDS HEALTHY PREVIEW. All three frames PASS in this preview.
- 4: JSDoc on every public prop of actions, fields + pickers, selection, overlays, data and charts (100 % each; overall 26 % → 85 %); scripts/check-jsdoc.mjs + `npm run check:jsdoc` (per-family coverage, `--list` for gaps). Comments only, no behaviour change.
- 3: token integrity: scripts/check-tokens.mjs + `npm run check:tokens` (in build): 268 files, 5,801 reads, 809 names, 0 undefined, 27 tokens unused (docs/_unused-tokens.txt). New tokens (values = the code's former fallbacks): tooltip.bg / tooltip.ink, fgroup.min, ease.spring, field.well-shadow, glass.fringe-w / glass.fringe, color.ink, z.veil. Restored from the DESIGN 3B record: --ul-chart-ring .52 (was re-derived as .50). Chart contrast re-run (shared tool): 8,800 rows, 0 fail. Shots docs/shots/4-chart-colours-*.
- 2: callback naming applied (list under breaking); migrated src, showcase (10 demo files), landing SiteHeader; guard scripts/check-callbacks.mjs + `npm run check:callbacks` (in build / build:min): 237 files checked, 0 violations.
- 1: shared hit layer src/components/shared/hit.css (.ul-hit / .ul-hit-y / .ul-hit-layer, test hook html[data-ul-hit="off"]); replaces five per-component layers; ULSelect trigger gets the layer; ULCalendar month / year native selects 44px min. Card hitarea (guard; motion-test ?norun&card=hitarea, probe-charts ?cards=hitarea): 1,027 library controls, 550 visually < 44; effective < 44: 466 with the layer off → 1 with it (ULCellId copy button in a table cell, open), 0 neighbour overlaps, lens geometry identical.
### Breaking vs pre-release (listed in 0.1.0 Changed)
- Callback naming (pre-freeze fixes, item 2), no aliases: ULDateRangePicker `onChange` → `onValueChange`; ULFilterBar `onChange` → `onValueChange`; ULColumnsMenu `state` → `value`, `onChange` → `onValueChange`; ULTimeRange `onChange` → `onValueChange`; ULToggleIconButton `onChange` → `onPressedChange`; useColumnsState option `onChange` → `onValueChange`; observeSectionAccent option `onChange` → `onValueChange`. Added: ULCheckbox `onCheckedChange` (the inherited native `onChange` event is still forwarded). Same payloads, no meaning change.
- `ULChartV1` export removed (deprecated 2d chart body). Migration: use `ULChart` — same props (`ULChartProps`, `ChartSeries`, `ChartTargetData` unchanged); no ULChart prop changed meaning.
### Audit
- 0: static pass (no tsc output pasted): 0 missing relative imports, 0 file-level import cycles (3 folder-level two-way edges: ULContainers↔ULStructure, ULForms↔actions, ULButton stories↔index), 69 exports not imported anywhere (37 story exports, 16 types, 16 helpers exported for tests/internal use; none removed), 9 `any` in src (no public prop typed any).
- 1: ULChartV1 + private niceMax removed from ULData.tsx and index.ts; grep: no reference in src, showcase, landing, apps; dist rebuilt (ul-glass.js 1,608,854 B · css 272,154 B · min 1,042,501 B).
- 2: ULScatterChart `renderer` 'auto' | 'svg' | 'canvas' (auto above --ul-chart-canvas-at); canvas keeps shapes, trends, selection dimming, tooltip, keys, brush, ctx targets, table. Card scattercanvas (demos-3d.js; motion-test + probe-charts ?cards=scattercanvas). Shots docs/shots/2-scatter-svg-vs-canvas.jpg.
- 3: ULColumnsMenu drag reorder (columnsDrag.ts; grip icon grip-vertical; tokens --ul-cols-drag-bg, --ul-cols-drag-shadow, --ul-cols-grip-ink; strings moved / dragCancel EN·SK·DE·CS). Test hooks reorderKeys, dragSlot, columnsDragStats (@internal). Card colsdrag.
- 4: kbdaudit card (showcase/demos-kbd.js). Fixes: ULMenu moves focus into the menu on every open (cold first open, context-menu reopen) with a per-frame retry + morph-end retry; ULPagination arrow keys keep focus on the selected page (segment values = page numbers).
- 5: forced reduced transparency (`?transparency=reduce`, `html[data-ul-transparency="reduce"]`); card fallback; docs/fallback-audit.md (0 failures in lite / flat / reduced transparency).
- 6: docs/component-inventory.md (170 components, status, API audit).
- 7: docs/contrast-matrix-v0.1.md (20,400 checks, 0 fail). Restored 23 chart tokens missing from tokens.json (heatmap / calendar / treemap scales, radar ring, brush, track, cell ink, danger ink, live pulse, canvas switch point); --ul-chart-danger-ink oklch(0.88 0.075 25).
- 8: card a11ystatic; ULTabs aria-controls only points at a rendered panel; dead CSS removed (old chart / pagination / modal head classes); no module-level listeners in blocks.tsx / charts core; docs/a11y-size-sweep.md (bundle numbers, sideEffects proposal).
- 9: viewport frames load the batch 1 / batch 2 / advanced chart demos; docs/freeze-readiness.md; BRIEF / CLAUDE.md updated. Version not bumped, not tagged.

## 2026-11-09 (Task 3D — shadcn batch 2)
- 0: locked-timing guard. scripts/locked-timings.json lists all 42 locked names (lens 23, switch 3, selection-switch 4, tabs 2, slider 1, pop 6, springs 3); scripts/check-locked.mjs compares tokens.json, tokens.css (:root) and DESIGN.md and prints "42 checked, N differences". Runs in build-tokens, build-bundle and `npm run check:locked`. Current: 42 checked, 0 differences.
- 1: ULHoverCard (src/components/ULBatch2/hovercard.tsx) on ULPopover; tokens --ul-hovercard-open-delay / -close-delay / -w; demos-3h.js (ULDemos.Batch2), Components → "Navigation + layout (3D)" tab, probe-forms ?only=batch2, test card hovercard (demos-3i.js, f3d_hovercard).
- 2: ULMenubar (menubar.tsx) + tokens --ul-menubar-*; menu shortcuts render with ULKbd (ULKbd moved to ULStructure/kbd.tsx, re-exported); card menubar (f3d_menubar). scripts/rebuild-all-in-browser.js (tokens → check → bundle → min).
- 3: ULNavigationMenu (navmenu.tsx) + --ul-navmenu-panel-w; panel swap on one surface via runViewSwap; sheet + drill-in below 640px; card navmenu (f3d_navmenu).
- 4: ULNativeSelect + ULSelect `native` (ULListbox.tsx), ULCalendar (ULPickers.tsx), ULAspectRatio (ULBatch2/layout.tsx); tokens --ul-calendar-*; cards nativeselect, calendar, aspect.
- 5: ULResizablePanelGroup / ULResizablePanel / ULResizableHandle (resizable.tsx) + --ul-resizable-*; card resizable (f3d_resizable).
- 6: ULCarousel (carousel.tsx) + --ul-carousel-*; icons pause / play / external; card carousel (f3d_carousel).
- 7: typography tokens --ul-type-* + ULHeading, ULText, ULCode, ULBlockquote, ULList, ULLink, ULProse (typography.tsx / .css); card typography (f3d_typography).
- 8: RTL audit (showcase/probe-rtl.dc.html + demos-rtl.js, docs/rtl-audit.md; RTL unsupported in v0.1). Guards extended to the 3D demos and overlays (PASS at 1280×800, 924×540, 375×667; fixes: calendar day cells shrink in narrow containers, horizontal scrollers marked data-ul-allow-overflow). Contrast card contrast3d (350 rows, 0 fail). motion-test cases f3d*. dist rebuilt (1,623,783 B; min 1,051,387 B). Locked: 42 checked, 0 differences.

## 2026-11-09 (Task 3C — contrast tool, forms, feedback, coverage)
- Owner fixes: morph stage uses the fractional content size (no text re-wrap during any overlay morph); action buttons inside overlays reset to idle when the overlay closes; ULSelect trigger = field well; accent-tinted field wells and rims (--ul-field-accent-mix, --ul-field-rim-accent-mix + hover).
- 0a: one shared contrast tool showcase/ul-contrast.js (waits for stylesheets / fonts / tokens, CSS Color 4 parsing + gamut mapping, compositing, throws on unresolved). Chart report rewritten on it (per chart type) + new action-button report (probe-charts ?contrast / ?actions).
- 0b: Components → Charts has a lazily mounted "Charts (advanced)" section (same demos as probe-charts ?adv).
- 1: docs/shadcn-coverage.md (shadcn/ui reference list → UL names, status, 3D proposals).
- 2: ULField, ULLabel, ULFieldError, ULFieldGroup, ULFieldSet, ULInputGroup (+ ULInputGroupInput, ULInputGroupButton), field / group context (ULTextField, ULTextArea, ULNumberField, ULOtpField, ULTagField, ULSelect and ULCopyButton read it), ULKbd (needed by input groups). README form recipe.
- 3: ULAlert, ULAlertDialog (+ useAlertDialog push, ULConfirmPopover), ULToggleGroup, ULSeparator, ULKbd, ULItem (+ ULItemGroup), ULCollapsible, ULScrollArea (+ scrollThumb). ULTypeToConfirm shared with ULConfirmAction. ULBanner reads --ul-tone-*. Icons info, warning, circle-check.
- Tokens 3C: --ul-kbd-*, --ul-sep-*, --ul-scroll-*, --ul-item-*, --ul-tone-*, --ul-alert-*, --ul-collapsible-* (aliases of the colour-picker expansion timings).
- 4: Components → Forms and Feedback tabs (lazy); probe-forms.dc.html; 12 test cards (motion-test f3c_*), guard cards extended (3C demos + kbd / toggle / addon / separator / collapsible selectors); contrast fixes --ul-field-error-text 44 %, --ul-scroll-thumb .6 / hover .78, --ul-alert-desc-ink = text.
- Tokens: --ul-chart-bar-fade 0.88 (bar bottom stop, was .72), --ul-chart-spk-bar-opacity 0.88 (was .78), --ul-chart-win / --ul-chart-loss. Chart matrix 8800 rows 0 fail, action matrix 2340 rows 0 fail.

## 2026-11-09 (Task 3B — advanced charts, zoom, streaming, linking)
- motion-test: minified bundle, fixtures mount lazily (ensureFixtures), `?card=` never starts the suite, load meter (showcase/load-meter.js). Loads in ≈ 1.2 s (was: timeout).
- New: ULRadialChart, ULGaugeChart, ULRadarChart, ULScatterChart (+ quadtree, brush), ULHeatmapChart, ULCalendarHeatmap, ULFunnelChart, ULHistogramChart (binValues, quantile), ULTreemapChart (squarify, drill-in).
- Shared: src/charts/nav.tsx (useMarkNav, ChartBaseProps, ChartAxes, useBrush, colorScale + ColorLegend, useCellIndicator, advText), ChartSkeleton shapes gauge / radar / scatter / grid / funnel / treemap, SeriesKey / LegendItem `shape`, useChartTween `enabled`.
- ULCartesianChart: `zoom`, `range`, `onRangeChange`, `highlight`, `renderer`, `decimate`, `xDomain`, `liveBead`, `animate`; time hover uses binary search; tick labels anchor at the plot edges.
- Streaming: createChartStream, ULStreamChart; lttb, canvasThreshold.
- Fixes: ULProgress ring cap had no CSS (rendered black) → shared .ul-gloss-cap; chart empty / error states have a 160px floor (short heatmaps overflowed); ULBreadcrumbs `embedded` (flat lens inside a panel) and `Crumb.onSelect`.
- Tokens: --ul-chart-track, --ul-chart-ring, --ul-chart-seq-0…6, --ul-chart-div-0…6, --ul-chart-cell-ink-dark / -light, --ul-chart-cell-empty, --ul-chart-danger-ink, --ul-chart-brush / -edge, --ul-chart-trend, --ul-chart-overview-h, --ul-chart-live-pulse, --ul-chart-canvas-at.
- Contrast: 4480 rows, 0 fail. Guards: PASS at 1280×800, 924×540, 375×667 (30 panels).

## 2026-11-08 (Task 3B — chart polish and verification)
- `patterns` prop (auto | on | off) on every chart; usePatternPolicy; legend swatches mirror patterns; --ul-chart-pattern-opacity.
- Contrast measured (2060 combinations, 0 fail) after chart-token fixes: --ul-chart-l-min, lighter s1/s3/s5, white pattern ink, --ul-chart-ref-neutral/success/warning/danger, --ul-chart-ref-label, --ul-chart-stale-ink/-bg; threshold bands get tone edges.
- Fixes: table toggle exposes aria-pressed; hidden crosshair band no longer overflows the panel; pinned tooltip clamps to the live plot width.
- Tests: chart part of layoutoverflow / iconsize / ctrltext; ten chart cards; probe-charts ?guard / ?cards; showcase/chart-contrast.js; chartStats test hook.

## 2026-11-08 (Task 3A — charts)
- New shared chart core `src/charts/`: scales (linear, log, band, point, time), nice ticks, locale formats (EN/SK/DE/CS, compact, tabular), monotone / linear paths with null gaps, arcs.
- ULCartesianChart + ULLineChart / ULAreaChart / ULBarChart / ULComboChart; ULDonutChart / ULPieChart; ULSparkChart (line, area, bars, winloss). ULKpiCard `trend`.
- ChartFrame: lite glass panel, title / description, CSV (ULDownloadButton), copy (ULCopyButton), "View as table", legend chips (ULCheckMark), loading / empty / error / stale states, sr summary + polite live region.
- Snapped value tooltip (slider-tooltip shape, opaque), one positioner transform per frame; keyboard navigation, pin / Esc, touch tap, contextMenu targets point / series / plot.
- ULChart keeps its 2d props and renders through the core; the old implementation (ULChartV1) was removed in the pre-freeze audit; no ULChart prop changed.
- Tokens: --ul-chart-pad, -draw, -morph, -fade, -bead-ms, -tick-ink, -tick-size, -band-opacity, -pattern-ink, -dim. Palette --ul-chart-s0…s5 derived from the accent in charts.css.
- Showcase: Components → Charts tab, showcase/probe-charts.dc.html; probe pages load dist/ul-glass.min.js (scripts/minify-in-browser.js).
## 2026-11-08 (Task 2F)
- ULIcon: size token scale --ul-icon-xs/sm/md/lg/max, explicit box (fixes the stretched chevron in ULErrorState and the refresh interval button). Inline svgs migrated; charts / sparkline / progress ring marked data-ul-illustration.
- ULErrorState relaid out + `embedded`; ULFilterBar chip one line (--ul-control-chip-h), truncated value with tooltip; ULCopyField grid + container query; .ul-btn-label one line.
- ULNotificationCenter covered by default (`anchorVisibility`), close button; ULPopover `anchorVisibility` / `closeButton` / `closeLabel`; ULAnchoredSurface `overlapAnchor`; computePlacement `cover`; MorphOptions `overlap` (poses always contain the anchor).
- Popover content width rule; top-layer popovers keep their max-width. ULCopyButton `buttonVariant`; ULCellId copy button plain (no glass per row). ULActionButton: no forced layout per instance on mount.
- Tokens: --ul-icon-*, --ul-control-chip-h, --ul-popover-cover-inset.
- Showcase: demo-lazy.js (lazy sections, live demos only while visible), Components ?tab=, probe-blocks.dc.html (debug: ?which=a|b, skip=, nocell=, rows=, trace); motion-test guard cards layoutoverflow, iconsize, ctrltext, coveredanchor; viewport-tests runs layoutoverflow per frame.

## 2026-11-08 (Part 11)
- ULInlineEdit, ULNotificationCenter, ULActivityFeed, ULCodeBlock (+ tokenizeLine), ULJsonViewer; useLiveQueue / useThrottledAnnounce; icons bell, edit, more, wrap, mail.
- ULSaveButton forwards actionRef.
- Tokens: --ul-ntf-ring-duration / -gap / -angle, --ul-code-bg / -hl / -str / -num / -kw / -key / -flag.
- Showcase: Components → Dashboard blocks (Blocks2, live table + filter bar at 20 updates / s); motion-test cards inlineedit, notif, feed, codejson.

## 2026-11-08 (Part 10)
- engine: decideGlassTier (tier fixed before an open morph); decoded-map crossfade held until the morph settles; one decode listener per map.
- AnchoredMorph: interrupted runs keep held tiers; reopen cancels the close's scrim fade.
- ULAnchoredSurface: covered surfaces re-promoted to the top layer on every open.
- motion-test: ?norun&card=<id>; covered card adds alert dialog + drawer left, first-failing-frame report.

## Pre-release record: stages 2a–2d

### 2D fixes (2026-11-08, latest)
- Pickers: roving focus target is always an enabled date (enabledNear) for the initial and on-open focus; keyboard moves stay date-based.
- New token --ul-success-ring (success + success-ink edge); the success ring passes 3:1 on light, mid and dark backdrops.
- New: setActionTimeScale / getActionTimeScale (action animations only); Components → Actions has a 1× / 0.5× / 0.25× control.
- Tests: card Run buttons ignored while a suite runs; slider follow harness on the frame clock; repeat ×5 lists failing check keys.

### Leftover popper, scroll freeze, nested menu gap, covered modals (2026-11-08, later)
- Fixed: row actions menu left a 236×16 surface after closing (anchor ref and items cleared on close; the exit never ran). useAnchoredMorph keeps the last anchor and always exits; ULAnchoredSurface freezes content while closing; AnchoredMorph.destroy clears its inline styles; place() re-measures sizes below the minimum in a detached container (dev error).
- Fixed: glass flashed red / green / blue while scrolling. Engine scroll freeze (tier, IntersectionObserver results, governor, map regeneration, hover, pointer light queued until 150ms after the last scroll; running crossfades pause), one-viewport IntersectionObserver margin, filter definitions never removed while in use (pooled, recycled), maps decoded before a filter references them, transitionend limited to accent properties, island accent commits when idle. New: `isGlassScrolling`, `prewarmGlass`, `configureGlass({ bisect })` (diagnostics).
- Nested menus open beside the parent surface with `--ul-submenu-gap` 2px, first row aligned to the trigger row, flip / shift, hover bridge.
- ULAnchoredSurface `anchorVisibility` above | covered; modal overlays default to covered (top layer from frame 0, opaque base `--ul-modal-covered-backing`, first map after the first frame, prewarm on idle / hover).
- Tests: `showcase/demos-2f.js` (leftover surfaces ×30 per overlay incl. 200-row table, nested menus, covered modals, scroll invariance), `showcase/glass-scroll-harness.js` (frame-invariance harness for any page). viewport-tests also runs the nested menu card.
- Tokens: `submenu.gap`, `modal.covered-backing`. Locked timings unchanged.

### Pickers, check mark, item radius, sheet drag, glass arrow map, test pages (2026-11-08)
- New: ULDateRangePicker (two months, presets, clearable two-segment trigger, band preview, beads, ripple, swap, restart, Esc cancel, locales EN / SK / DE / CS, bottom sheet below 640px). Shared CalendarGrid (div grid, 6 rows) for ULDatePicker and ULDateRangePicker; ULDatePicker gains `isDateDisabled`.
- New: ULCheckMark + `animateCheck` (draw-in enter, fade / scale exit, 40ms handover). Used by ULSelect, ULCombobox, ULMenu checkbox / radio items, range presets and colour swatches. Selected row wash fades with it.
- ULColorPicker: the hex field became a "Custom color" expander (2D field with a flattened lens bead, hue ULSlider, hex, eyedropper). Height morphs to the measured size; Esc collapses, then closes. Custom colours pass `guardAccent` (new, contrast.ts) and are clamped into `--ul-accent-custom-*` when they would fail; "Adjusted for contrast" note. Also exported: `toOklch`, `fromOklch`.
- Item radius: `--ul-item-radius` on every anchored surface = clamp(`--ul-menu-item-radius-min` 12px, popper radius − padding, `--ul-menu-item-radius-max` 22px); rows and the shared hover lens read it. Landing language popper rows + lens: max(12px, popper 20 − 6) = 14px.
- Mobile bottom sheet: drag to dismiss on the grabber and the nav bar (velocity projection, rubber band, overshoot spring back, click swallowed after a drag). Desktop sheets have no drag. The old unused ULOverlays sheet-drag hook was removed.
- Engine: `MapOptions.arrow` (body ∪ arrow outline: bezel + rim bend into the arrow base), only for priority overlay in the refract tier, keyed into the shared map cache (position bucketed), never built mid-morph. `mapCost` export.
- Fixed: liquid glass flashed olive / green for a frame when it entered the viewport (lite colorize ran with hue 0 before the engine had the accent hue). `--ul-lite-ready` gate set together with `--ul-lite-hue`.
- Toasts: right stacks pour from a point near the right edge; ≤ 480px from the centre with `--ul-toast-overshoot-reserve` (4px) per side, so the locked pop overshoot never reaches into the 16px margin.
- Tests: `showcase/lens-tests.dc.html` (lens / thumb cards on their own page, same reset, Repeat ×5), `showcase/viewport-tests.dc.html` + `vt-frame.dc.html` + `viewport-harness.js` (iframes 1280×800, 924×540, 375×667), `showcase/demos-2e.js` (fixtures + cards: date range, colour expand, check mark, radius, arrow, keyboard walkthrough, blur-only). motion-test keeps overlay / container cards, prints live vs virtual and the flaky list, shows a foreground-tab banner. Scroll bench mounts the 2e fixtures.
- Tokens: `menu.item-radius-min / -max`, `check.*`, `range.*`, `colorpicker.*`, `accent-custom.*`, `toast.overshoot-reserve`. Locked timings unchanged.

### Test reliability, dialog context, toast placement, sidebar indicator (2026-11-07, later)
- New: ULDialogProvider, ULDialogSurface, useDialog (push / replace / pop / close in one surface, persistent nav bar, measured size morph, staggered content, focus + state + scroll restore, dirty guard). ULModal / ULSheet / ULDrawer use it; the stacked-modal demo and fixture are now pushes.
- AnchoredMorph: `anchorOnTop` (auto false for triggers inside a dialog surface), `setFinalRect`, `finalFor`. Tokens: `--ul-dialog-*`.
- Fixed: toast stack surfaces were position:fixed under their slots (child selector never matched): the newest toast hung off screen. Stack now follows the visual viewport and shows fewer toasts when it would not fit.
- createNavIndicator: `setLayoutFollow` (rigid during container morphs), scroll offset in measurement. Sidebar: rigid indicator during collapse / expand, nav padding so the lens is never clipped.
- Tests: frame clock = document timeline, px/ms limits with worst-frame print, WARN state for live FAIL / virtual PASS, per-card reset + leak list, deterministic mode (HUD off, unlimited budget), Repeat ×5 with FLAKY; new cards: dialog push / pop, toast placement, sidebar layout-follow.

### Stage 2c containers + overlays, narrowed 2d data (2026-11-07)
- New: ULCard, ULPanel (glass | calm | well), ULModal, ULSheet, ULDrawer, ULPopover (arrow, reading), ULTooltip (React wrapper of createAnchoredTooltip), ULToast, ULToastProvider + useToast, ULAccordion, ULSidebar, ULToolbar, ULMenu, ULMenuButton, ULContextMenu, ULCommandPalette (+ fuzzyScore).
- New (2d): ULStatTile, ULTable, ULChart, ULBadge, ULAvatar, ULAvatarGroup, ULProgress, ULSkeleton, ULEmptyState, ULBreadcrumbs, ULPagination (+ pageRange).
- AnchoredMorph: `layout` (center / edges), `scrim` part (opacity on the timeline, hole cut while morphing), `shiftFinal` (dragged sheets / toasts), `nextExitFade` (swipe dismiss), padding moves onto the stage while morphing so 0 × 0 anchors work, virtual anchors are never treated as "anchor gone". Exported `overshootEase`.
- New modules: `motion/virtualAnchor.ts`, `motion/overlayStack.ts` (top-layer Esc / outside, focus trap, stacked modals).
- ULAnchoredSurface: layout, scrim, modal, initialFocus, returnFocus, manual, stack, arrow, surfaceRef, morphRef; per-depth z-index (`--ul-depth`).
- ULTabs: `keepMounted` (panels stay lazy; indicator code untouched). createAnchoredTooltip: side left / right (collapsed sidebar).
- FAB: right / centred placements add `--ul-scroll-lock-gap`. Toast stack right edge too.
- Tokens: scrim, modal, sheet, drawer, popover, toast, card, panel, accordion, sidebar, toolbar, menu, palette, data, table, chart, skeleton, progress, avatar, badge. Locked timings unchanged (table in DESIGN.md).
- Tests: 12 new motion-test rows (modal, stacked modal, sheet, drawers, popover, anchored toast, toast stack, menu, submenu, context menu, palette) + "2c overlays: scroll" row; scroll-bench mounts the real 2c overlays. Harness: virtual anchors skip the hit test, centred / edge layouts must keep the trigger clickable only while morphing, lead check needs a ≥ 25 % size change, a failing live run is re-measured on the virtual clock (both shown).

### Slower bubble shrink after release (2026-11-07)
- Shrink 2× slower, same start: `--ul-lens-release-linger` 380 → 570ms (switch, tabs, segmented), `--ul-lens-shrink-duration` 300 → 600ms (slider). Bench defaults updated.

### Release linger (2026-11-07)
- LensBubble `earlyShrink` + `onFrame` (switch, tabs, segmented): elastic settle `--ul-lens-settle-duration` 420ms, shrink starts at `--ul-lens-shrink-start` 0.45, hard cap `--ul-lens-release-linger` 380ms; the switch knob rides the settle spring. Slider unchanged.
- Tests: linger, settle ±15 %, overshoot, no double edge, key path. Bench: settle, shrink start, linger sliders.
- Scroll leftovers: anchored toasts (role status / alert) default to "fixed"; `--ul-scroll-lock-gap` for right-pinned fixed chrome.

### Timing fixes + overlay scroll behavior (2026-11-07)
- Shrink 480 → 300ms, settle hold 120 → 60ms, shrink spring ×0.9; grow 570ms kept; ζ floor 0.55 → 0.64 (one grow spring for all controls).
- A2 cause: not the switch. The switch grow honoured the token (probe: within 2 % at ≈ 540ms); the test took the first RISING pass through the ±2 % band as "settled" (248ms). The test now uses the last entry into the band. The real difference was the slider's ζ 0.55 vs the switch's 0.64 (scale-dependent), fixed by the ζ floor.
- Tabs / segmented: `--ul-tabs-glide` 300ms (new), press glide 400 → 280ms, follow 110 → 80ms; glide speed cap 1.8 %/frame. Dev warning when an ancestor would clip the indicator's overgrow.
- AnchoredMorph: scrollBehavior (lock / follow / fixed / close), onAnchorHidden (keep / hide / close), onRequestClose; `lockPageScroll` / `unlockPageScroll` / `isPageScrollLocked`. ULAnchoredSurface: scrollBehavior, scrollLock, onAnchorHidden; menus pass lock. Tooltip: follow + hide.
- Tests: scroll-harness.js (follow ≤ 1px over 600px / 60 frames, tooltip hide, fixed, flip, layout shift, nested container, reduced motion, menu lock: wheel / touch / keys / scrollbar, no shift, exact restore, inner scroll). Timing card: grow and shrink ±15 %. Bench: showcase/scroll-bench.dc.html; Lens bench defaults updated.

### Polish: switch proportions, slower motion, one indicator (2026-11-07)
- Switch retuned from the iOS 26 screenshots: 64×28 / thumb 37.2×24 (1.55) / inset 2 / bubble ×1.3, overgrow 2 → 62×27 / thumb 36.1×23 (1.57) / inset 2 / bubble ×1.55 (55×36.5), overgrow 5.
- Grow 380 → 570ms, shrink 320 → 480ms, settle hold 70 → 120ms, ζ floor 0.55. New `--ul-switch-toggle-duration` 560ms (click), key / programmatic 70 %.
- Tabs / segmented: one persistent indicator node (rest capsule = bubble), separate hover indicator removed; press glide (`--ul-tabs-press-glide` 400ms) and follow spring (`--ul-lens-follow` 110ms); segmented is a non-glass well.
- LensBubble: `mount: 'host'`, `follow`, `glide()`, `toggle()`, `rest()`, per-kind scale token.
- Tests: timing card, one-indicator / no-teleport / follow cards. Bench: grow, shrink, toggle sliders.
- Not done in this pass: overlay scroll behavior (section 4) and its bench / tests.

### Lens bubble rework, switch drag-to-set, slider follow, tabs (2026-11-07)
- Shared `LensBubble` rewritten: rounded rectangle, concentric radius, overgrow tokens, root-level layer (never clipped), two-edge elastic drag model, settle-then-shrink, pooled elements, reduced-motion crossfade. Supersedes the scaled-circle bubble.
- `createLensSelect`: press-hold-drag selection with the bubble for ULSegmentedControl and the new ULTabs.
- ULSwitch: capsule thumb (ratio 1.55), track 64×28, drag to set with release logic (midpoint + flick, click threshold, Esc / pointercancel), one change event per release, fill preview.
- ULSlider / ULRangeSlider: capsule thumbs, value vs visual split (follow spring), one rAF loop, transform / clip-path only, no React render per pointermove, cached geometry. Stutter cause: step quantisation (282/355 stalled frames → 0).
- createNavIndicator: same overshoot spring as the bubble.
- Engine: `wakeGlass`. Tokens: lens.*, switch.*, slider.*, switch 64×28 / inset 2, slider thumb 24.
- Tests: thumb-harness rewritten (shape, overgrow, press ≤ 100ms, stretch side, overshoot + settle, bounds, stalls, shrink-after-settle, switch release logic + event count, slider follow + tooltip + drag bench, range merge, tabs / segmented hold-drag-release, reduced motion). HUD: Drag bench.
- Showcase: Lens bubble bench (switch states incl. in glass, sliders, range, segmented, tabs, slow motion, bubble on/off, sliders for ratio, overgrow, scale, stretch, overshoot, magnification, follow).

### Motion fixes + slider tooltip + lens bubble (2026-11-07)
- AnchoredMorph: an interruption starts from the surface's current visual rect and blends into the new timeline (no jump when the anchor or final rect changed). Harness: stricter reversal check (first frames after a reversal ≤ pre-reversal velocity + 3px), hit-test misses are logged per frame (phase, frame, ms, elementFromPoint, clip state), runs are serialised. The earlier island / colour-picker failures did not reproduce in 3 live runs; the failing run had twice the frame count, most likely two overlapping runs (page auto-run + a manual or HUD run) toggling the same overlays.
- ULSlider rewritten on one position write per frame (`--ul-p0/--ul-p1`, fill `--ul-f0/--ul-f1`); value tooltip is a child of the thumb (no anchored-tooltip loop, no hover delay), clamp + flip, tabular numbers, hide delay; range merge/split; `orientation="vertical"`; keyboard, click-to-jump and programmatic changes travel on the snappy spring.
- Lens bubble (`LensBubble`, shared/lens.css) on ULSwitch and ULSlider; thumbs are flat at rest; `lens` prop; switch travel now on the snappy spring.
- Engine: `setGlassHot(el, on)`.
- Tokens: lens.*, tooltip.hide-delay, selection.slider-length.
- Tests: thumb-harness.js (tooltip offset per frame, range merge/split, lens bubble incl. reduced motion). Components: Lens bubble bench. Perf HUD: drag scenario.

### Anchored motion fix (2026-11-07)
- Cause: every portalled overlay (ULSelect, ULCombobox, ULDatePicker, ULColorPicker, ULSplitButton menu, ULIsland notification) already went through ULAnchoredSurface and animated (getAnimations() = 1 running, geometry moving), but `raise()` lifted the anchor's stacking-context ancestors, including the page root, above `--ul-z-overlay`, so the morph played behind the page and the surface appeared at the end. Not the cause: missing morph, mount at final size, quality tiers, reduced motion.
- Layering is now an even-odd `clip-path` hole at the anchor (keyframed with the pose); no z-index changes. `[data-ul-morph-occluder]` widens the hole to an ancestor (island pill). SiteHeader and ULIsland mark the pill.
- Content fades + slides in after the surface clears the anchor (stage opacity / translate in the same keyframes).
- Explicit `startTime` per run: a composited stage animation could hold the surface on its t=0 pose for hundreds of ms on a busy frame.
- Tier freeze: `applyTier` holds changes while `data-ul-morphing`; new `releaseGlassTier(el)` applies them when the morph ends.
- `ul:morph` events; `configureMorph({ reducedMotion })`; `isMorphReduced()`.
- Motion test: `showcase/motion-harness.js`, `showcase/motion-test.dc.html`, `landing/chrome/motion-test.dc.html`, HUD button "Motion test".
- ULColorPicker: per-preset `disabled` (`presets: (string | { value, disabled?, label? })[]`), shown crossed out and skipped by arrow keys. Components showcase: emerald disabled.
- 2b decisions recorded: stepper stays a step indicator; EN dates stay day-month, Monday first.

### Phase 2b — selection
- `ULCheckbox`, `ULRadio` / `ULRadioGroup`, `ULSwitch` (lens thumb grows on press, magnifies the textured track), `ULSlider` / `ULRangeSlider` (lens thumbs, shared anchored tooltip while dragging), `ULSegmentedControl` (shared floating indicator), `ULStepper` (step indicator), `ULSelect` / `ULCombobox` (anchored listbox, typeahead, activedescendant, empty / loading), `ULDatePicker` (EN/SK/DE/CS, grid keys), `ULColorPicker` (accent presets + hex).
- Tokens `selection.*`; icons chevron-left / chevron-right / check / calendar / layout-grid / menu in the component icon set.
- Showcase: Selection tab; contrast rows for 2b.

### Fixes after the performance review
- Governor budget is refracted AREA per viewport (`--ul-perf-refraction-area` 150 000 px²) + count cap (`--ul-perf-refraction-max-count` 30); small controls stay full, big surfaces drop first. `getGlassStats()` reports `areaUsed`, `refractCount`.
- Small lenses: bezel ≤ 35 % of the shorter side, minimum edge shift 8 px, exact-size maps under 16 000 px², 3-pass aberration on hovered small controls.
- Lite tier: CSS colorize hue solved numerically through the filter matrices (reds no longer drift to orange), fake lensing (rim hairline, edge shading, bevels).
- Focus ring on glass buttons is a child element (`.ul-btn-ring`); an outline was bent by the lens.
- Displacement maps follow per-corner radii (split button).
- Fields on a busy backdrop get a helper / error backing (`--ul-field-msg-backing`); dev-only warnings for plain buttons and bare fields (`isDev`, `surfaceBehind`; off when `window.__UL_PROD__`).
- Perf HUD: tier outlines (Shift+T), tier counts, refracted area. `configureGlass({ light })` for measurement.
- Icons: C2PA metadata stripped (342 KB → 15 KB for 42 SVGs); originals in `_archive/icons-original/`.
- `npm run build:min` → `dist/ul-glass.min.js` + source map (not run yet).
- Landing header: pill priority island, megamenu and contact morph priority overlay.

### Performance (before Stage 2b)
- Glass quality tiers: `quality` prop / option `full | lite | flat | auto` (default auto) and `priority` (`overlay | island | normal`; role=dialog and anchored surfaces default to overlay). New mode `lite`: blur + saturate + CSS colorize (grayscale → sepia → accent hue), no SVG filter.
- Hover / focus promotion to full with `--ul-perf-demote-delay` and a `--ul-perf-crossfade` ramp of lens + colorize against the lite body (`--ul-lite`), so nothing pops.
- Shared displacement maps (LRU, sizes quantized up to `--ul-perf-size-bucket`) and shared SVG filters for surfaces at rest with identical params; private filters only while a surface animates. Map regeneration debounced (~100 ms) and never during an animation. Chromatic aberration (3 passes) only on full surfaces ≥ `--ul-perf-aberration-min-area`; otherwise 1 pass.
- One shared IntersectionObserver: surfaces beyond `--ul-perf-offscreen-margin` go flat and drop their ResizeObserver and press listener.
- Pointer loop: light / elasticity only on refracted surfaces in view plus the hovered element and its glass ancestor; rect reads batched before writes; light fades out instead of snapping; no pointer listener on touch-only devices; rest-state springs skip style writes.
- Tokens `perf.*`. Showcase: `perf-hud.js` (Shift+P), `ambient-bg.js` (pausable animated background), Components split into tabs with a static background by default and a budget tweak.

### Added
- Phase 2a: `ULButton` (primary, secondary, tinted, plain, destructive; sm/md/lg; capsule, rounded, circle; icon-only; link; loading; toggle), `ULToggleButton`, `ULButtonGroup`, `ULSplitButton`, `ULFab`, `ULSpinner`.
- Phase 2a: `ULTextField` (text, email, password with reveal, search capsule with clear and expand-on-focus, url, tel), `ULTextArea` (auto-grow), `ULNumberField` (stepper), `ULOtpField`, `ULTagField`; floating labels, helper and error text, leading / trailing icons, inset well.
- Tokens: `control.*`, `field.*`, `focus.color|width|offset`, `spinner.*`, `mobile.*`.
- `ULAnchoredSurface`: `portal` (default true) and `backdrop`.
- `createAnchoredTooltip`, `STUDIO_URL`, header config `studioLink`, `isMobileGlass`, `configureGlass({ forceMobile })`.
- `dist/ul-glass.css` next to `dist/ul-glass.js`; `scripts/build-in-browser.js`.
- `showcase/Components.dc.html`.

### Changed
- Showcase loads `dist/ul-glass.js` instead of the in-browser transpile loader.
- The bundle waits for `window.ReactDOM` as well as `window.React`.

### Removed
- Header account popper and `sessionAware` (archived outside the library).

## 2026-11-08 · Part 3
- Rolling number: one static glyph per cell at rest, whole-cell strips only while rolling, one non-wrapping line, KPI value scales with the tile. Fixes half digits and wrapped values (Live tab).
- Context menus: `contextMenu` / `rowMenu` / `contextMenuHeader` / `contextMenuCell` on ULTable; `contextMenu` on ULKpiCard, ULStatTile, ULChart, ULCard, ULPanel, ULBadge, ULAvatar, ULTabs, ULSidebar, ULAccordion, ULBreadcrumbs, ULTagField, ULToast; `ULContextTarget`, `useContextMenuTarget`. MenuItem `hidden`.
- Live layer (createLiveSource, websocket / sse / polling / mock, useLiveStore, ULLiveStatus), KPI cards, data glass levels, Live tab in Components.
- Glass: single displacement pass + CSS bezel fringe; no content-visibility around glass (dev warning); `?glass=full|lite|flat`, `?glassdebug` panel with a pointer / wheel write recorder.
- Tokens: --ul-modal-glass-backing 0.55; --ul-scrim-mid-subtle / -vivid 0.66; tokens.json repaired to match tokens.css (root scrim thresholds, tabs glide group).
- Toast stack re-promotion keeps focus. Motion-test harness: virtual edge anchors count as covered under modal surfaces.
- New motion-test cards: rolling number, context menu, pointer glass stability, drill-in 375px, toast over modal + backing, KPI states, live source, live table, data glass.

## 2026-11-08 · Part 4
- Actions: useAsyncAction, ULActionButton, ULCopyButton (+ copyText), ULSaveButton, ULSaveStatus, useUnsavedChangesGuard, ULSubmitButton, ULConfirmAction (inline / hold / type), ULDownloadButton, ULExportButton, ULRefreshButton, ULToggleIconButton, ULShareButton, ULUndoToast, announce, actionText (EN / SK / DE / CS). Tokens --ul-action-*. Icons: copy, refresh, download, star, heart, pin, bookmark, share, save, undo, volume, volume-x, trash, send.
- Pointer light: ≤ 4 nearest surfaces per frame, one rAF batch with the spring sim, threshold, no writes while scrolling + 150ms (token --ul-glass-light-max).
- Anchored ULToast stays above modals (keepOnTop).
- ULButton passes aria-busy / aria-disabled from props.
- Tests: NEEDS FOCUS status; viewport-tests narrow submenu uses the same-surface drill-in; new action cards; pointer glass card follows the 4-surface rule. Components: Actions tab; copy buttons in the 200-row table.

## 2026-11-08 · Part 6
- useCoalescedAction + coalesce / debounceMs / maxWaitMs on useAsyncAction; ULToggleIconButton coalesced (trailing) with status idle | pending | saving | error, flushRef, flushOnBlur; ULRefreshButton leading-trailing.
- Hold-to-confirm fill across the whole button (fx layer); success ripple from the centre (successEffect), success tone (successTone, --ul-success, --ul-success-soft); ULPublishButton. ULButton `layers` prop.
- Dashboard blocks: ULBulkActionBar, ULColumnsMenu (+ columnsMenuItems, applyColumns, useColumnsState), ULFilterBar (+ filtersToQuery / filtersFromQuery / applyFilters), cell renderers, ULTimeAgo / ULTimestamp, ULTimeRange, ULRefreshControl, ULCopyField, ULStatusDot / ULStatusPill, ULBanner / ULBannerQueue, ULUsageMeter, ULErrorState, ULDescriptionList / ULKeyValue, ULTruncatedText. ULTable: column pin, pinSelection.
- Lens tests: frame-pacing cards report NEEDS FOCUS when the page has no focus or the frame gaps are irregular, with the gaps printed.
- Tokens: --ul-action-debounce-ms, -debounce-max-wait-ms, -hold-ms (replaces -hold), -hold-release-ms, -ripple-ms, -ripple-fade-ms, -ripple-delay; --ul-success, --ul-success-soft, --ul-success-ink.

## 2026-11-08 · Part 7 (partial)
- Success wave: circular, from the centre (or the click point) to the farthest corner, trailing wavelets, registered radius properties; successOrigin prop; --ul-action-ripple-ms 620ms.
- Success check: ink on a --ul-success-soft disc (contrast fix).
- ULDateRangePicker / CalendarGrid: the picked day takes focus and the roving focus follows it (Esc while picking now cancels after a pointer pick). ULColorPicker: the expand button keeps focus on toggle.
