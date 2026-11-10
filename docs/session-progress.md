# Session progress (Part 9)
## A. Date range picker — DONE
- Root cause of the reported card failures (skip/kbd/aria/slide/esc2/locale): run collision, not the picker. motion-test autoruns runAll 900ms after load; a card started by hand during it was hit by runAll → resetState Escapes every 160ms (stack-traced), closing the popper mid-card (first failing step: skip, "24 → undefined" = popper closed). Fix: card Run buttons are ignored while a suite run is busy. Use ?norun for single-card runs.
- Shared CalendarGrid: new enabledNear() = roving target is always an ENABLED date (clamp + nearest enabled), used for the initial / open focus of both pickers. Key moves were already date-based (moveKey + focusDayNode).
- Harness ×5 (live, ?norun, foreground): drange 5/5 pass; date (single) 4 pass + 1 WARN (virtual-only, run 1). No step needs NEEDS FOCUS.
## B. Colour picker — DONE (no code change needed): cpx 5/5 pass (aria/focus on expand button, esc1, esc2). Earlier failures = same collision.
## C. Contrast matrix — DONE (300 combos: 5 variants × success/accent tone × app/marketing × 5 accents × light/mid/dark, status=success, live computed colours)
- Check vs disc: worst 6.56:1 (primary/success/app/ice/light). Label over wave peak: worst 6.56:1 (same; accent tone worst primary/marketing/amber/light 6.56). Wave interior (46 % tone) sits over the button glass, so ≥ the idle label contrast.
- FAIL fixed: success ring (green alone) 1.48:1 on light, < 3 on mid. Token --ul-success-ring = 2px success + 3.5px success-ink edge (ink ≥ 4.7:1 light/mid, green 11.7:1 dark). tokens.json/css + actions.css.
## D — IN PROGRESS
- D3 done: setActionTimeScale / getActionTimeScale (core.tsx, exported). Scales action WAAPI anims (wave, ring, shake, width morph) via playbackRate, CSS anims inside .ul-act-body/.ul-btn-fx/.ul-act-ring, and success/error/swap timers (actMs). Press/glass/lens untouched. Control: Components → Actions tab (1× / 0.5× / 0.25×).
- dist rebuilt once (before D3); rebuild again after D.
- D1: ULContextMenu (ctx morph card) 4/5 (run 1 FAIL interrupt, cold first open) · ctxmenu 5/5. Re-run A/B on the new dist: drange 5/5, cpx 5/5, date 4/5 + run 1 WARN (cold first open). Pattern: first morph run after load.
- D2: slider drift NOT reproduced. Probe ×3, clean 120 Hz pacing (median 8.3ms, max 10.3, 0 gaps > 2×): thumb vs ideal on the frame clock 0.00px; on performance.now (old harness clock) ≤ 0.42px. Harness slider ideal now uses document.timeline (same clock as the slider rAF). No lens code / token change.
- lens-tests ×5: all 11 cards 5/5 pass (live).
- lens-tests runAll: 11/11 pass. motion-test full (live, autorun): 49 pass · 2 fail · 3 WARN (select, modal, cmd: virtual-only) · NEEDS FOCUS 0 · of 54.
  Fails: ctx interrupt (max 114.5px/frame vs clean 110.6, reversal excess; ×5 = 4/5, always run 1); covered 0/5 isolated: ULModal warm + interrupt and ULCommandPalette warm (+ interrupt / cold) "trigger hit 0 · not covering 1". NOT traced: first step = verify whether covered failed before this session's dist rebuild (no modal code changed here: pickers, actions core, ring token only).
- Docs updated (DESIGN Part 2D, CHANGELOG, README success wave, CLAUDE.md calendar + success ring). dist rebuilt (1,062,348 bytes unminified). Locked timings: 28 tokens compared with tokens.css, 0 mismatches; springs untouched.
## NOT DONE: viewport-tests run, HUD / own-timer numbers (Data tab, 200-row table, bulk bar, 12 KPI, live table), covered regression trace, ctx interrupt cold-run flake., D runs. dist NOT rebuilt yet (src changed: ULPickers enabledNear).

# Session progress (Part 10)
## A. Covered modals — CODE DONE, LIVE RUNS NOT DONE
- Single card: motion-test.dc.html?norun&card=<id> (covered: &only=modal,alert,sheet,dr,dl,cmd &modes=cold,warm,interrupt). Result in window.__mtCard.
- Covered card now records the first failing frame: elementFromPoint centre + 4 corners, trigger / surface rects, stacking chain, --ul-lite, open top layer, show/hidePopover calls. Cases added: alert dialog, ULDrawer left.
- Live repro not possible this session: my preview runs rAF at ~2 fps (throttled), the user preview did not answer. Throttled probe: covered surface in top layer from frame 0, popover calls scrim → goo → surface, never hidden; no hit on the trigger in cold / warm.
- Root cause (from code, to confirm live): the failing check is "not covering" (trigger hit was 0). A new surface got its first tier decision from the IntersectionObserver AFTER the morph started (the morph freeze only held once a tier was set), so on warm runs (decoded map cached) it switched lite → refract instantly inside the first frames (filter bind on the first frame = late first paint, surface already off the trigger). Cold had no map → stayed lite → passed.
- Fix (shared): engine decideGlassTier() at morph begin (tier fixed before frame 0, constant during the morph); decoded-map crossfade held until settle; interrupted runs never release a held tier; reopen cancels the close's scrim fade; ULAnchoredSurface re-asserts scrim → goo → surface in the top layer on every open. dist rebuilt (1,064,472 B).
## B. Tier before open — CODE DONE (same change as A), live ×5 NOT DONE. No token / spring / tolerance changed. Visible difference: a cold first open now shows the lens after the morph settles (crossfade) instead of switching mid-travel; warm opens unchanged.
## C. NOT DONE (needs a foreground tab at real frame rate): viewport-tests, HUD numbers, full suite.
## Next: in a foreground tab run ?norun&card=covered ×5 (cold / warm / interrupt), select / modal / cmd / ctx cold-first ×5, then C.

Owner verified (focused tab): covered card 5/5 in cold, warm and interrupt; the first cold open shows refraction fading in after the animation settles (accepted).
# Session progress (Part 11)
## 1. ULInlineEdit — DONE
- blocks2.tsx: text / number / select / date; ULSaveButton (icon, ripple wave) + Cancel; validation slot (absolute, no layout shift); Esc cancels; optimistic onValueChange + rollback, editor stays on Retry; explicit focus in / out; contextMenu. ULSaveButton now forwards actionRef (Enter runs the save).
- Card inlineedit (throttled preview, 1 run): pass (box 44→44, next element y unchanged, focus, save, rollback, Esc).
- Next: 2–4 (notification centre, feed, code / JSON) written; cards notif, feed, codejson.
## 2. ULNotificationCenter — DONE · card notif pass (ring + rate limit, rolling badge, popover morph 5 sizes, queue pill under pointer, ctx menu, mark all read). Popover = ULPopover (anchored morph); item actions = one shared ULMenu (anchored morph) + right-click through withContextMenu (same itemMenu).
## 3. ULActivityFeed — DONE · card feed pass (soft insert, queue pill, apply on leave, filter chips, details). Shared queue rule: src/live/liveQueue.ts (useLiveQueue callback ref + table insert tokens; useThrottledAnnounce).
## 4. ULCodeBlock + ULJsonViewer — DONE · card codejson pass (tabs lens, tokenizer, wrap, lazy 2,000 items, keyboard, search).
- All new cards: 1 run each in my throttled preview, NOT the ×5 live runs. Bundle 1,129 KB.
- Next: 5 (live table + filter bar demo is mounted, data-bench="livefilter"); numbers need a focused tab.
## 5. Live table + filter bar — DEMO DONE, NUMBERS NOT DONE (Components → Dashboard blocks, data-bench="livefilter", mock 20 patches/s, filter Status is Active).
## 6. ColumnsMenu drag reorder — NOT DONE (budget).
## FINAL — partly done
- Not runnable here: my preview runs rAF at ~2 fps and the user preview does not answer → no live suite, lens-tests, viewport-tests, ×5 cold-first, or fps numbers. Run them in a focused tab.
- Contrast (on the code panel ≈ #0d0f15): str 12.6, num 12.3, kw 10.4, key 11.1, flag 12.0, comments 11.7, line numbers 6.6, text 17.7; badge ink on danger 7.4. Pills / chips use --ul-color-text on dark mixes (> 7:1).
- dist rebuilt: 1,129,174 B JS / 189,967 B CSS. Locked timings: 26 values compared with the DESIGN table, 0 changes.

# Session progress (Task 2F)
## A. Visual bugs — DONE (verified on the Blocks / Blocks2 demos via showcase/probe-blocks.dc.html; screenshots docs/shots/*2f-*)
- A1 cause: Icon() defaulted to width/height 100%; inside a button label it stretched to the container (~100px chevron), squeezing Retry to its icon. Fix: ULIcon (shared/icons.tsx + icon.css): token scale --ul-icon-xs/sm/md/lg (em), explicit box, flex none, display block, max --ul-icon-max; sizing wrappers fill via one :where() list. Inline svgs migrated (pipette, toolbar more, row actions, live pause, save-status dot); charts/sparkline/progress ring marked data-ul-illustration. ULErrorState relaid: header row, message, Retry with label, left disclosure with rotating sm chevron, details, support; embedded prop.
- A2 cause: chip button align-items: baseline in a 44px-tall flex box put the text at the top. Fix: chip height --ul-control-chip-h (32), inline-flex centre, line-height 1, nowrap, 44px hit via ::before (overflow clip removed), value truncated with ULTruncatedText (tooltip).
- A3: ULNotificationCenter anchorVisibility='covered' (prop, 'above' opts back). New shared placement option cover (computePlacement) / MorphOptions.overlap / ULAnchoredSurface overlapAnchor; ULPopover anchorVisibility + header close button (default on when covered). Probe: bell centre+4 corners hit the surface from the first rAF frame; Esc → focus on bell, aria-expanded false.
- A4 cause: panel width min(380px) > popover max-width 340 (inner 308), and the top-layer [popover] reset cleared max-width. Fix: popover body min-width 0 / children max-width 100%, restored max-width on top-layer popovers, ntf panel max-width 100%, --ul-popover-max-w 412 for the centre; ULErrorState embedded in the popover. Overflow probe: list / error / empty = 0px.
- A5 cause: copy button was a shrinking flex item. Fix: well = grid minmax(0,1fr) + auto, container query < 240px hides the label (icon + tooltip).
- A6 cause: component bug, same as A1 (refresh interval button had an unsized chevron in its label → tall button overflowing onto the next row) + demo used one wrap row. Fix: ULIcon + .ul-btn-label inline-flex nowrap; demo stacked.
- A7: tabs were already lazy (sc-if). Blocks sections now lazy (showcase/demo-lazy.js IntersectionObserver), live demos (notif, feed, live table) run only while visible + tab visible. Per-row glass found: ULCellId copy button was glass per row → buttonVariant="plain" (ULCopyButton). ULActionButton no longer forces a layout per instance on mount. Measured (trace): Blocks render 30 ms scripting, 85 ms long tasks; page load ≈14 s in my preview = bundle load (1.14 MB), not the tab. My screenshot tool's DOM capture takes ~14 s on the full Blocks tab (tool limit, not the page).
- Next: B guard cards.
## B. Layout guard cards — DONE (showcase/demos-2o.js; motion-test ids layoutoverflow, iconsize, ctrltext, coveredanchor; layoutoverflow also runs in every viewport-tests frame)
- My preview (924×540, ~10 fps): layoutoverflow 14/14 (list, hover, queued + applied live insert, error embedded, empty, popover, modal, modal expanded, drawer, panels, stage = 0px); iconsize 4/4; ctrltext 2/2; coveredanchor 6/6 (cold 8, warm 7, interrupt 7 frames).
- coveredanchor first failed (cold frame 2: bell corners exposed by the squash / size lag). Shared fix in anchoredMorph.run: with overlap every pose contains the anchor box and its radius never tightens below the anchor's. No token or spring changed.
- Sample rate in my preview is ~10 fps: frame checks are a live pass at that rate only; owner: rerun ?norun&card=coveredanchor ×5 in a focused tab.
- viewport-tests (incl. layoutoverflow per frame): 1280×800 PASS, 924×540 PASS, 375×667 PASS. The 924 frame was scrolled off screen by me mid-run (toasts "1 frames" = throttled, not a live result).
## C. NOT DONE
- C1 ColumnsMenu drag reorder: not started (budget).
- C2 suite / lens-tests / ×5 cold-first / fps: my preview runs ~10 fps (rAF) and needs ~15 s per load → no valid numbers. Owner runs (focused tab): motion-test full; lens-tests; viewport-tests; ?norun&card=select|modal|cmd|ctx ×5 cold-first; ?norun&card=coveredanchor ×5; HUD (Shift+P) on Components → Data, 200-row table, data-bench="livefilter", notification centre open, activity feed live.
## D. DONE: DESIGN (Layout rules 2F), README, CHANGELOG, CLAUDE.md (Task 2F rules), dist rebuilt (1,140,526 B JS / 195,478 B CSS). Locked: 33 token names + 3 springs = 36, 0 changes (old 26 / 27 / 28 counted table rows, with combined rows and the geometry row counted differently).

Backlog (not part of this task): ULColumnsMenu drag reorder; owner focused runs (full motion-test, lens-tests, viewport-tests, x5 cold-first select/modal/cmd/ctx, coveredanchor x5, fps numbers).
Decision: large list popovers opened from small icon buttons use anchorVisibility='covered' (menus, selects and small popovers stay 'above'); document it in DESIGN.

# Session progress (Task 3A — charts, design only; owner said skip motion tests)
## 1. Core — DONE (screenshots docs/shots/*3a-*)
- src/charts/scales.ts (linear, log, band, point, time, nice ticks, monotone/linear paths with gaps, arcs, locale number/time formats), core.tsx (text EN/SK/DE/CS, palette slots + dash/pattern cues, useWidth, useChartTween, useDrawIn, hover layer, legend chips with ULCheckMark, skeleton, ChartFrame with table toggle + ULCopyButton + ULDownloadButton CSV, context-menu wrapper), charts.css, tokens --ul-chart-pad/draw/morph/fade/bead-ms/tick-ink/tick-size/band-opacity/pattern-ink/dim.
- ULChart (2d API) now renders through the core; old body kept as ULChartV1 (deprecated).
## 2. Line / area / bar — DONE. Monotone + linear, null gaps, references, thresholds (clamped), stacked / percent, grouped / stacked / horizontal, glassy bar top + rim, glow, gradient, draw-in once, morph (interruptible), fade under reduced motion.
## 3. Combo, donut / pie, sparklines — DONE. Dual axis with keyed axis titles; donut centre slot (ULRollingNumber in demo), mergeBelow → "Other", elastic segment hover, legend-linked highlight; ULSparkChart line/area/bars/winloss; ULKpiCard `trend` prop.
## 4. Interactions — DONE (visual check only). Snapped tooltip, click/Enter pin, Esc unpin, legend toggle animates + rescales, arrows/Home/End/Up-Down series, polite live readout, touch tap (touch-action pan-y), contextMenu point/series/plot.
## 5. States — DONE. Loading skeleton per shape, ULEmptyState, ULErrorState embedded + Retry, stale ULBadge. Panel = the one lite glass surface.
## 6. Showcase — DONE: Components → Charts tab + showcase/probe-charts.dc.html (?n=10|100|1000), size/theme/accent/locale switches. NOT DONE (owner instruction): motion-test cards, guard cards, fps runs.
- Minified bundle for probe pages: dist/ul-glass.min.js + .map via scripts/minify-in-browser.js (terser from CDN, in-browser). Production dist names unchanged.
- Next: owner focused runs; 3B (advanced types, streaming).

# Session progress (Task 3B — chart polish, verification)
## 1. Pattern policy — DONE (shots docs/shots/*3b-patterns*)
- `patterns` prop on every chart: auto (default) | on | off; usePatternPolicy in core. auto: dash only for series 3+ (order ≥ 2); fill patterns on areas / bars / slices only with > 4 series or categories or prefers-contrast: more / forced-colors. Verified: area (3 series) only API dashed, donut (5) patterned, pie (4) plain; "On" patterns everything.
- Legend swatches mirror the pattern (SeriesKey pattern prop), tooltip keys use the same dash. figure[data-ul-patterns] = on | auto-fills | auto-lines | off.
- Token --ul-chart-pattern-opacity 0.2 (was ink alpha .26); --ul-chart-pattern-ink = graphite. Test hook chartStats (window.__ulChartStats) added for the morph cards.
## 2. Contrast — DONE (model: glass contrast worstSurface, 2 themes × 5 accents × 3 strengths × dark/mid/light, no pointer light; showcase/chart-contrast.js → ULDemos.chartContrastReport() on probe-charts)
- Before: 407 / 2420 rows failed (series s4 2.79, pattern-on-series 1.91, danger reference 2.72, accent reference label 4.16, stale badge 3.8). After: 2060 rows, 0 fail.
- Fixes (chart tokens only): --ul-chart-l-min 0.82 (s0/s2/s4 lightness floor), s1/s3/s5 lighter; pattern ink white × --ul-chart-pattern-opacity 0.4 (raises, never lowers, contrast); --ul-chart-ref-neutral/success/warning/danger; reference labels --ul-chart-ref-label (text); thresholds now draw 1px edges in the tone; stale badge --ul-chart-stale-ink / -bg.
- Worst: series 3.86, pattern 5.05, ticks 4.58, chip on 5.77 / off 4.58, ref edge 3.78, ref label 6.9, stale 5.68 (all app · emerald · dark), tooltip 20.25 / 10.36, tooltip keys 10.25.
## 3. Guard cards — DONE: layoutoverflow / iconsize / ctrltext now also run the chart fixture (showcase/demos-3b.js __chartGuard: 15 panels = every type + loading, empty, error, stale, table view, 1000 points, KPI sparklines, pinned tooltip). Runner: probe-charts.dc.html?guard (iframes 1280×800, 924×540, 375×667, one at a time, on screen).
- Result: PASS at all three sizes (15 panels, tooltip inside plot, ticks not clipped, legends wrap, 157 svgs, 57 controls).
- Fixed in the core: hidden crosshair band stuck 10px out of bar / combo panels (now display none while hidden); pinned tooltip clamp used the cached width (now the plot's clientWidth at point change); data table marked data-ul-allow-overflow (own horizontal scroller). ctrltext scans .ul-chart-lchip.
## 4. Chart test cards — DONE (showcase/demos-3b.js; motion-test CASES charttable, chartlegend, chartctx, chartkeys, chartreduced, chartmorph, chartsizes, charttip, chartdraw, chartperf; also probe-charts.dc.html?cards=<ids>|all)
- motion-test itself did not load in the preview (timeout), so the same card functions ran on probe-charts?cards=… (minified bundle). Frame-independent: charttable PASS (8 types), chartlegend PASS, chartctx PASS, chartkeys PASS, chartreduced PASS, chartmorph PASS (restart from 1399.8 painted = 1399.8, first frame 1383.8 → 700), chartsizes PASS (10 / 100 / 1000 × line / area / bar).
- Frame-dependent: charttip, chartdraw, chartperf = N/A · NEEDS HEALTHY PREVIEW (preview at 1–3 fps).
- Fixed: the "View as table" button never exposed aria-pressed (ULButton only sets it through `pressed`); now pressed / onPressedChange. Test fixes: live-region regex (thousands separator), reduced-motion card spies on Element.animate instead of reading running animations.
## 5. Docs + report — DONE. README (patterns, test entry points), DESIGN (pattern policy, measured contrast), CHANGELOG, CLAUDE.md. dist rebuilt (ul-glass.js 1,255,872 B · css 210,509 B · min 809,065 B; production names unchanged). Locked: 33 tokens + 3 springs = 36, 0 differences.
- Owner (focused tab, ≥ 50 fps): motion-test ?norun&card=charttip, chartdraw, chartperf; then the frame-independent chart cards once in motion-test itself (it timed out in this preview); viewport-tests (now includes the chart guard).
- Not done: nothing from 3B; backlog unchanged (ColumnsMenu drag reorder, earlier focused runs).

# Session progress (Task 3B-adv — advanced charts, zoom, streaming)
## Step 0 — BRIEF.md rewritten verbatim, 2F "## Update" kept. 3A+ chart task confirmed done.
## 0. Page loading — DONE (shots docs/shots/3b0-after-*.jpg)
- motion-test: dist/ul-glass.min.js; fixtures (selection overlays, 2c/2e/2f demos) mount only via ensureFixtures() (card that needs them, Run all, scroll into view, "Mount fixtures"); chart* cards skip fixtures; ?card= never starts the suite; "loading… library + harness" summary; showcase/load-meter.js shows marks (script/ul/page/ready/fixtures) + long tasks on the page.
- Before: no load within 30 s (timeout, twice). After (?norun): script 1108 ms · UL ready 1120 ms · page/ready 1195 ms · long tasks 0 reported (the preview does not expose longtask entries, so "0" is not a measurement). ?card=charttable ran alone and PASSed (8/8) without mounting fixtures.
- Still cannot run here: frame-dependent cards (charttip, chartdraw, chartperf, lens/thumb timing, all morph live checks) — preview ≈ 1–10 fps.
## 1. Radial + gauge — DONE (shot 3b1-radial-gauge.jpg, 02-3b2-radar.jpg needle)
- src/charts/ULRadialChart.tsx: ULRadialChart (rings, 270° default sweep, centre slot, glossy cap .ul-gloss-cap now also styles ULProgress' cap which had no CSS = black dot bug), ULGaugeChart (fill | needle, threshold bands, min/max/target labels, comparison marker, sr-only role=meter + valuetext).
- Shared: src/charts/nav.tsx (useMarkNav keyboard/pointer/pin/live, ChartBaseProps, baseFrame, useDrawOnce, focusMarkIn, ctxResolve, advText EN/SK/DE/CS, arcStroke/polar); ChartSkeleton gained gauge/radar/scatter/grid/funnel/treemap shapes; tokens --ul-chart-track + 3B tokens.
## 2. Radar — DONE (shot 03-3b2-radar.jpg): HTML axis labels (2-line clamp, balance, full name in the axis tooltip), rings + tick labels, legend toggle, dash per policy, ← → axes / ↑ ↓ series, table.
## 3. Scatter + bubble — DONE (shots 0x-3b3-scatter.jpg): colour + shape (legend keys show the shape), trend per series, quadtree nearest (src/charts/quadtree.ts), keyboard cone neighbour, rect brush (useBrush, opaque readout) → onSelect, Esc clears; bubble size legend.
- Docs (README/DESIGN/CHANGELOG) for 1–3 are written together in item 8 (context budget).
## 4. Heatmap / calendar / funnel / histogram / treemap — DONE (shots 0x-3b4-matrix.jpg, 0x-3b8-after-contrast.jpg)
- ULHeatmapChart.tsx (matrix + calendar), ULFunnelChart.tsx (funnel, histogram with bin chips + p50/p95/p99, treemap squarify + drill-in via ULBreadcrumbs embedded/onSelect). One flat hover indicator; quantised seq/div scales + ColorLegend; grid keyboard.
## 5. Zoom / pan / brush + linking — DONE (shots 0x-3b5-linked.jpg): ZoomHost in timeseries.tsx (Ctrl/Cmd wheel, pinch, Shift-drag pan, brush, dblclick/0 reset, + - Shift+arrows, Esc), overview strip, onRangeChange = ULTimeRange shape; linked demo: chart ↔ ULTimeRange ↔ ULFilterBar → ULTable + 2 KPIs, row hover → chart highlight.
## 6. Large data + streaming — DONE (shots 0x-3b6-stream.jpg): LTTB (decimate.ts, memoised per data key; not incremental — O(n) per frame), canvas renderer above --ul-chart-canvas-at, createChartStream + ULStreamChart (per-frame scroll, pulsing bead, hold/pause queue, N new points, ULLiveStatus, stale).
## 7. States — DONE: skeleton per new shape, empty/error 160px floor (fixed overflow), stale badge, ctx payload per type, CSV/copy via the frame, patterns policy.
## 8. Tests / contrast / docs — DONE
- Cards (showcase/demos-3d.js; motion-test + probe-charts ?cards=): frame-independent PASS = advtable, advctx, advkeys, quadtree, lttb, canvas, zoom, linked, stream, advreduced. Frame-dependent advtip, zoomsmooth, streamperf = N/A · NEEDS HEALTHY PREVIEW (1.0–1.3 fps).
- Guards (?guard): PASS at 1280×800, 924×540, 375×667 (30 panels, 262 svgs, 96 controls). Fixed: heatmap row-label margin, time tick anchoring at the plot edge, scatter legend hit-area room, empty-state height floor.
- Contrast (?contrast): 4480 rows, 0 fail (report also fixed: oklch / out-of-gamut parsing, waits for tokens.css).
- Docs: README (props per type, zoom/brush/streaming API, linking example), DESIGN, CHANGELOG, CLAUDE.md. dist rebuilt: ul-glass.js 1,424,474 B · css 223,832 B · min 912,269 B. Locked timings: 36 checked, 0 differences.
- Owner focused runs (≥ 50 fps): motion-test ?norun&card=advtip, zoomsmooth, streamperf, charttip, chartdraw, chartperf; then the 3B frame-independent cards once in motion-test itself.
- Not done: incremental LTTB (memoised only); scatter has no canvas fallback (SVG up to a few thousand points); Components page has no 3B tab yet (probe-charts ?adv only).

# Session progress (Task 3C — forms, feedback, coverage)
## Step 0 — DONE: BRIEF.md STATUS + backlog updated ("## Update (Task 3C brief)").
- Not started: 0a contrast tool, 0b Components "Charts (advanced)", 1 coverage table, 2 forms, 3 feedback/structure, 4 showcase/tests/docs.
- Next: start 3C in a fresh chat (previous chat near its context limit). The pasted brief was cut off in item 4 after "alert dialog focus" — paste the rest of item 4.
## 0a. Contrast tool — DONE
- showcase/ul-contrast.js = the one tool (ready(): stylesheets + fonts + tokens; CSS Color 4 parse + gamut map; compositing; throws on unresolved). selfTest PASS. chart-contrast.js rewritten on it + actionContrastReport.
- Charts 8800 rows: 644 fail before (bar .72 stop 2.69, spark loss 2.09). Fixed with --ul-chart-bar-fade / -spk-bar-opacity 0.88, --ul-chart-win / -loss. After 0 fail; worst bar 3.33, spark 3.24, line 3.89.
- Actions 2340 rows 0 fail; worst check 6.56, wave 6.56, ring 4.41 (marketing · rose · vivid · mid).
- dist not rebuilt yet (charts.css changed) → rebuild after 0b.
## 0b. Components "Charts (advanced)" — DONE (shot docs/shots/3c-0b-components-adv.jpg)
- Charts tab: second section mounts ULDemos.ChartsAdv (demos-3c.js, same as probe-charts ?adv) inside ULDemos.Lazy; each card is its own Lazy (active only on screen). Verified on the real Components page: section mounted on scroll, 3 visible cards active, rest unmounted.
- dist rebuilt: ul-glass.js 1,425,393 B · css 223,998 B · min 912,838 B.
- Next: 1 coverage table.
## 1. Coverage table — DONE: docs/shadcn-coverage.md (59 items). Missing → 3D: Hover Card, Calendar export, Native Select, Menubar, Resizable, Carousel, Typography; decisions: Direction (RTL), Aspect Ratio, app Navigation Menu. 3C items marked draft until built.
- Next: 2 forms (ULField, ULLabel, ULFieldError, ULFieldGroup / ULFieldSet, ULInputGroup).
## 2. Forms — DONE (shots docs/shots/0x-3c-2-forms-a/b.jpg on probe-forms ?only=forms)
- src/components/ULForms/ (fieldContext.ts, forms.tsx, forms.css). Shared changes: ULField.tsx FieldShell / useIds read FieldCtx + InputGroupCtx (no own label / messages, stripped well in a group, aria via fieldAria); ULSelect plain trigger in a group; ULCopyButton plain in a group. ULKbd built early (structure.tsx).
- Probe check: email field describedby = desc + err, aria-invalid, aria-errormessage, aria-required, label[for]; 4 group inputs labelled, addon / counter ids in describedby; no duplicate ids.
- Tests / guards / contrast for forms come in item 4. Next: 3 feedback + structure.
## 3. Feedback + structure — DONE (shots docs/shots/0x-3c-3-feedback.jpg on probe-forms ?only=feedback)
- src/components/ULStructure/ (structure.tsx, structure.css). Reuse: ULModal (alertdialog), ULPopover, useDialog push, createLensSelect, createAnchoredTooltip, ULCheckMark, ULActionButton, withContextMenu, ULTypeToConfirm (extracted from ULConfirmAction). No new overlay / animation / indicator code (collapsible uses the colour-picker measure technique with WAAPI).
- dist rebuilt 1,510,799 B · css 246,121 B · min 973,393 B.
- Next: 4 (Components tabs, test cards, guards, contrast, docs, locked timings).
## 4. Showcase, tests, docs — DONE
- Components: Forms + Feedback tabs (lazy, verified by screenshot docs/shots/0x-3c-4-components.jpg; Charts (advanced) from 0b). probe-forms.dc.html modes ?only / ?cards / ?guard / ?contrast.
- Cards (probe-forms ?cards, minified bundle, preview ≈ 2–8 fps): fieldaria, inputgroup, alerts, alertdialog, togglegroup, separator, kbd, item, collapsible, scrollarea = PASS (frame-independent). motion-test ?norun&card=togglegroup PASS. collheight, tglide = NEEDS HEALTHY PREVIEW.
- Guards (?guard): 1280×800 / 924×540 / 375×667 PASS (layoutoverflow, iconsize, ctrltext + confirm popover). Fixes: scroll viewport data-ul-allow-overflow (horizontal scroller), ctrltext skips addons that hold a select.
- Contrast 3C 2400 rows 0 fail after fixes (--ul-field-error-text 44 %, --ul-scroll-thumb .6, alert description = text). Charts 8800 / actions 2340 re-run 0 fail.
- dist: ul-glass.js 1,510,831 B · css 246,121 B · min 973,419 B (production names unchanged). Locked: 38 names checked (29 lens / switch / tabs / slider + 6 --ul-pop-* + 3 springs), 0 value differences (expected 36: the gap is how the --ul-pop-* row is counted, not a changed value).
- Owner focused (≥ 50 fps): motion-test ?norun&card=collheight, tglide; then fieldaria … scrollarea once in motion-test; plus the earlier backlog (advtip, zoomsmooth, streamperf, charttip, chartdraw, chartperf, full motion-test, lens-tests, viewport-tests, x5 cold-first select/modal/cmd/ctx, coveredanchor x5).
- Not done: viewport-tests frames do not load demos-3e/3f/3g yet (3C guard ran via probe-forms ?guard iframes instead); multiple-mode toggle group has no lens (decision); ULAlertDialog keeps the modal close button.
## 3C owner fixes — DONE
- Quick confirm text wrap during the morph: cause = stage pinned to offsetWidth (213.16 → 213px). Fix in anchoredMorph (stageW / stageH). Probe: description 1 line in every morph frame (stage 213.156px).
- "Done" after close: ULActionButton resets on ul:morph exit end of its surface. Probe: reopen of confirm popover and alert dialog → idle.
- ULSelect trigger = field well; field wells / rims accent-tinted (12 % / 32 %). Cards inputgroup, fieldaria PASS; forms contrast 2400 rows 0 fail (addon on tinted well 7.04). dist rebuilt.

## Task 3D (shadcn batch 2)
### 0. Locked-timing guard — done
- scripts/locked-timings.json (42 names, per group: lens 23, switch 3, selection-switch 4, tabs 2, slider 1, pop 6, spring 3) + scripts/check-locked.mjs; wired into build-tokens.mjs, build-bundle.mjs, `npm run check:locked`.
- Result: 42 checked, 0 differences (run through the same checker code in the design tool; mutation test caught a css and a DESIGN.md change).
- Gap explained: the 4 selection-switch tokens were already in the 33; the 6 pop values were the missing part of 36 → 42.
- Not done: a Node run (no Node in the design tool); run `npm run check:locked` locally once.
- Next: item 1 ULHoverCard.
### 1. ULHoverCard — done
- ULPopover-based, intent delays as tokens, bridge, focus / Tab / Esc, one per group, contextMenu, touch tap toggle.
- Card hovercard (probe-forms ?cards=hovercard, minified bundle): PASS 16/16 (open ≥ 500ms measured 523, close ≥ 250 measured 268, bridge covers 87–95 gap).
- Shots: docs/shots/02-3d-1-hovercard-open.jpg (probe). Components tab verified mounted; the open card is in the top layer, which the DOM screenshot misses when the page is scrolled (known, README Screenshots note).
- Not done: touch path only by code review (no touch in preview).
- Next: 2 ULMenubar.
### 2. ULMenubar — done
- Flat bar + shared indicator, one ULMenu per trigger, roving keys, switch on hover / ← → while open, submenu 2px, ULCheckMark, ULKbd shortcuts (shared ULMenu change).
- Card menubar: PASS 17/17 (submenu gap 1.8px). Shot docs/shots/3d-2-menubar.jpg (in the 540px-high preview the View menu shifts over its trigger: viewport clamp, not menubar code).
- Switch = close + open with no delay (no re-anchor in AnchoredMorph; reported in DESIGN).
- Next: 3 ULNavigationMenu.
### 3. ULNavigationMenu — done
- Bar + shared indicator, one anchored panel surface with runViewSwap between panels, ULItem grid, keyboard + Tab flow, sheet + drill-in < 640.
- Card navmenu: PASS 18/18. Shots docs/shots/01/02-3d-3-navmenu.jpg (Products → Solutions swap).
- Header megamenu not extracted (landing DC; header frozen outside ULIsland/SiteHeader) → debt in DESIGN.
- Next: 4 ULNativeSelect, ULCalendar, ULAspectRatio.
### 4. ULNativeSelect, ULCalendar, ULAspectRatio — done
- Cards: nativeselect PASS 13/13, calendar PASS 14/14, aspect PASS 6/6.
- Shots docs/shots/02-3d-4-fields.jpg, 03-3d-4-calendar-range.jpg (selects show their first enabled option in DOM screenshots; values checked in DOM).
- Next: 5 ULResizable.
### 5. ULResizable — done
- Card resizable PASS 17/17 (keyboard, clamp, collapse, reset, drag +10 %, 0 renders per move, onLayout, storage round trip, no overflow). Shot docs/shots/02-3d-5-resizable.jpg (nested).
- Frame-dependent drag smoothness: NEEDS HEALTHY PREVIEW (not run).
- Next: 6 ULCarousel.
### 6. ULCarousel — done
- Card carousel PASS 19/19. Fixed during the run: index walked through intermediate slides during smooth travel (now held on the target until landing).
- Shot docs/shots/02-3d-6-carousel.jpg (DOM screenshots do not keep scrollLeft: tracks paint at slide 1).
- Frame-dependent mouse-drag smoothness: NEEDS HEALTHY PREVIEW.
- Next: 7 Typography.
### 7. Typography — done
- Tokens --ul-type-* (fluid clamp scale, line heights, weights, tracking, numerals, ink / link / rule) + 7 components; scale and rules in DESIGN.
- Card typography PASS 11/11. Shot docs/shots/02-3d-7-type.jpg.
- Next: 8 RTL audit + close (guards, contrast, cards, docs).
### 8. RTL audit + close — done
- RTL: probe-rtl.dc.html, docs/rtl-audit.md, unsupported in v0.1 (no safe trivial fix; plan for v0.2).
- Guards (probe-forms ?guard): 1280×800 PASS, 924×540 PASS, 375×667 PASS (after fixes: calendar cells fit 375, scrollers data-ul-allow-overflow).
- Cards (probe-forms ?cards=…, minified bundle, slow preview, one sequential run): hovercard, menubar, navmenu, nativeselect, calendar, aspect, resizable, carousel, typography, contrast3d = 10/10 PASS. Fixed: resizable card read painted values (now committed), carousel card waited too little.
- Contrast 3D: 350 rows, 0 fail; worst hover-card description on glass 4.56 (marketing · emerald · tinted · dark).
- NEEDS HEALTHY PREVIEW: resizable drag smoothness, carousel mouse drag, collapse height steps; owner runs motion-test ?norun&card=f3d<id> ×5 for the 10 cards.
- dist rebuilt: ul-glass.js 1,623,783 B, ul-glass.min.js 1,051,387 B. Locked: 42 checked, 0 differences.
- Next (not started, per brief): pre-freeze audit.

# Session progress (Pre-freeze audit)
### 0. Typecheck — tsc part skipped (no output pasted). Static pass done: 0 missing imports, 0 file-level cycles (3 folder-level two-way edges, no runtime cycle), 69 exports unused anywhere (37 stories, 16 types, 16 internal helpers; kept), 9 `any`, none in public props.
### 1. ULChartV1 removal — source done
- Removed ULChartV1 (+ its private niceMax) from ULData.tsx and the index.ts export. ULChartProps / ChartSeries / ChartTargetData kept (ULChart uses them), so no ULChart prop breaks.
- Grep: no usage in showcase, landing or apps; only dist (stale) and docs history.
- Done (session 2): dist rebuilt (1,608,854 B · min 1,042,501 B; grep of dist: 0 ULChartV1), CHANGELOG 0.1.0 draft "breaking vs pre-release" lists the removed export. README / DESIGN had no ULChartV1 reference.
- Next: 2 scatter canvas.
### 2. Scatter canvas mode — done
- ULScatterChart renderer auto|svg|canvas, auto above --ul-chart-canvas-at (5000); canvas in data paint order, shapes, trends, selection dim; all interaction from the quadtree (renderer-independent).
- Card scattercanvas (probe-charts ?cards=scattercanvas, minified bundle) PASS 10/10: switch 4999 svg → 5001 canvas; identical tooltip, live readout, brush (874 = 874), ctx target, legend shapes; 10k and 50k: 0px overflow.
- Shots: docs/shots/2-scatter-svg-vs-canvas.jpg (same 5,001 points both renderers), 2-scattercanvas-card.jpg. Frame timing (hover / brush at 50k) NEEDS HEALTHY PREVIEW.
- Next: 3 ColumnsMenu drag reorder.
### 3. ColumnsMenu drag reorder — done
- columnsDrag.ts: grip in the ULMenu icon slot, slider follow (one var write / frame), FLIP on the smooth spring, edge auto-scroll, Esc restore, touch on grip only, one commit + announce.
- Card colsdrag (probe-charts ?cards=colsdrag) PASS 11/11: 12 moves → 0 renders, writes 6 = frames 6, commit +1 render, Esc restores with menu open, touch on row ignored, Move right works. Shot docs/shots/3-colsdrag-midrag.jpg.
- NEEDS HEALTHY PREVIEW: drag smoothness / FLIP feel; touch drag on a phone (owner). Not done: drag inside the header context menu variant (only the toolbar list has grips).
- Next: 4 kbdaudit.
### 4. Keyboard-only walkthrough (kbdaudit) — done
- showcase/demos-kbd.js (card kbdaudit; motion-test + probe-charts ?cards=kbdaudit, &kbdonly=<sections>, &kbdper=N). 12 sections (Selection fixture + Actions, Containers, PickerFixtures, Data, Blocks, Blocks2, Forms, Feedback, Batch2, Charts, ChartsAdv); Tab / Shift+Tab walk, per-kind probes (popup open / arrows / Home / End / Esc + focus return, modal trap, ContextMenu + Shift+F10, tabs, slider, switch, radio, grid, tree, chart keys, resize handle, carousel, disclosure). Synthetic Tab and native-button activation are emulated (counted).
- First full run (motion-test ?norun&card=kbdaudit): 95 / 109 PASS, 12 FAIL. Real bugs fixed in shared code: (1) ULMenu initial focus only on mount, and lost on a cold first open → now on every open, retried per frame (≤ 1.5 s) and at the enter morph end (fixed: context menu keys in Data / Blocks / Blocks2 / Feedback / Charts / ChartsAdv); (2) ULPagination segmented values were slot indices → after the window shifted, ArrowRight focused page 6 while 5 was selected; values are page numbers now. Audit fixes: context-menu probe limited to real targets, hover-card triggers = NEEDS FOCUS, resize probe waits for the committed value.
- Re-run after fixes: all sections PASS except PickerFixtures "Group by" (motion fixture deliberately sets initialFocus: null — not a library path). Selection fixture 15/15 PASS. tabindex > 0: 0.
- NEEDS FOCUS (owner): :focus-visible rings, hover card focus-open, tooltip on focus, focusout closing, inline-edit / field blur, palette hotkey, real browser Tab order.
- Next: 5 fallback matrix.
### 5. Blur-only / reduced-transparency matrix — done
- New override: ?transparency=reduce / html[data-ul-transparency="reduce"] (ULGlass.css, charts.css, engine supportsRefraction, glassDebug). Card fallback (demos-kbd.js): 2,170 text samples × lite / flat / flat+RT, 0 below 4.5 (3 for large); worst 6.68 (lite / flat), 5.76 (RT, badge). No token changed.
- Shots docs/shots/5-fallback-*.jpg (charts, feedback + confirm popover, contrast tables); docs/fallback-audit.md (one line per area + limits). DOM screenshots do not render backdrop-filter → owner checks flat blur by eye in a real tab.
- Next: 6 API + inventory.
### 6. Public API + inventory — done
- docs/component-inventory.md: 170 components (142 stable, 28 draft with reason), category, key props, a11y, limitations, cards; API audit section (663 exports, 0 duplicates, 13 non-UL building blocks, 8 @internal test hooks, naming exceptions onChange × 7, JSDoc 36 % = v0.2 debt).
- index.ts: columns drag hooks exported once under an @internal comment. Nothing removed from the public surface.
- Next: 7 contrast matrix.
### 7. Contrast matrix — done
- docs/contrast-matrix-v0.1.md: 13,890 model rows (charts 8,800, actions 2,340, forms 2,400, 3D 350) + 6,510 live samples (3 tiers) = 20,400, 0 fail.
- Found: 23 chart tokens (track, ring, brush, brush-edge, seq-0…6, div-0…6, cell-empty, cell-ink-dark, danger-ink, live-pulse, canvas-at) were never in tokens.json and were lost on a tokens.css regeneration → restored in tokens.json (values re-derived from the DESIGN rules, owner to eyeball heatmap / treemap colours). --ul-chart-danger-ink lightened (3.78 → 4.98).
- Next: 8 a11y + size sweep.
### 8. A11y + size sweep — done (docs/a11y-size-sweep.md)
- Card a11ystatic: names 0, labels 0, dup ids 0, tabindex>0 0, roles 1 → fixed (ULTabs aria-controls only when the panel exists). Hit areas: 267 below 44px (72 demo chrome; library: sm buttons 36, chips 36, tabs 38, segmented 30/38, carousel dots 28, calendar days 43) — NOT fixed, decision listed.
- Bundle: js 1,621,301 (gz 395,022) · min 1,048,620 (gz 288,284) · css 268,517 (gz 48,936). Dead CSS removed (18 classes / 50 selectors); 43 unused tokens listed, kept. Side effects moved out of module scope (time-ago visibility listener, chart stats hook); sideEffects proposal written.
- Next: 9 docs, viewport tests, freeze readiness.
### 9. Docs, viewport tests, freeze readiness — done
- vt-frame loads demos-3d/3e/3f/3g/3h/3i (+ ul-contrast): viewport-tests 1280×800 PASS incl. chart + 3C/3D guards; 924×540 / 375×667 did not finish (throttled frame in this preview) → owner. Same guards via probe-forms ?guard and probe-charts ?guard: PASS at all three sizes (shots 9-guard-*.jpg).
- docs/freeze-readiness.md (verified by whom, open items, owner run list, v0.2 backlog); BRIEF.md "## Update (pre-freeze audit)"; CLAUDE.md "Pre-freeze audit rules"; CHANGELOG 0.1.0 draft; README audit tests.
- dist rebuilt (names unchanged). Locked: 42 checked, 0 differences. STOP after 9.

# Session progress (Pre-freeze fixes, items 0–6)
### 0. Typecheck — skipped: no tsc output pasted (placeholder only).
### 1. Hit areas — done
- shared/hit.css: one geometry (inset min(0,(100%-44)/2), square), ::after host or .ul-hit-layer child (glass owners: ULButton, ULSelect trigger); .ul-hit both axes, .ul-hit-y rows. Replaced 5 ad-hoc layers. ULCalendar native selects 44px (no pseudo possible).
- Card hitarea (demos-kbd.js, guard list in motion-test; probe-charts ?cards=hitarea, &hit=off = baseline): 1,027 library controls, 550 visually < 44. Effective < 44: 466 (layer off) → 1 (see item 6). Steals 0, clipped 0, lens / item rects identical on / off. Old sweep figure 267 (a11ystatic method; it now credits row / child layers).
- Shots docs/shots/1-hitarea-*.jpg. Next: 2 callback naming.
### 2. Callback naming — done
- Renamed (no aliases): ULDateRangePicker / ULFilterBar / ULTimeRange onChange → onValueChange; ULColumnsMenu state → value + onValueChange; ULToggleIconButton → onPressedChange; useColumnsState + observeSectionAccent options → onValueChange. ULCheckbox gains onCheckedChange (ULTable header uses it).
- Migrated src, showcase (2e 2i 2j 2k 2l 2m 2n 2o 3c 3d), landing SiteHeader; README / inventory / CHANGELOG / DESIGN.
- Guard scripts/check-callbacks.mjs (npm run check:callbacks, in build): 237 files, 0 violations. Native wrappers listed in DESIGN.
- Next: 3 token integrity.
### 3. Token integrity — done
- scripts/check-tokens.mjs (+ npm run check:tokens, in build): 268 files · 5,801 reads · 809 names · 0 undefined (was 9 real after excluding app sheets / JS lookups / prefixes) · 27 unused listed (docs/_unused-tokens.txt).
- Defined in tokens.json: tooltip.bg / ink, fgroup.min, ease.spring, field.well-shadow, glass.fringe-w / fringe, color.ink, z.veil. Restored --ul-chart-ring .52 (DESIGN 3B record). Lost, no value on record: chart cell-ink-light / trend / overview-h (unread). Only earlier copy: _archive v0 (different system).
- Contrast re-run (probe-charts ?contrast, shared tool): 8,800 rows, 0 fail (radar rings 3.28, tooltip 17.8). Shots 4-chart-colours-{app,marketing}-*. dist rebuilt; locked 42/0.
- Next: 4 JSDoc.
### 4. JSDoc coverage — done
- scripts/check-jsdoc.mjs (npm run check:jsdoc, runs in the design tool): counts members of exported *Props interfaces / types (1,318; the audit's 876 counted UL*Props only).
- Documented 771 props: actions 124/124, fields + pickers 218/218, selection 70/70, overlays 161/161, data 240/240, charts 206/206 (each 100 %). Overall 26 % → 85 %. Other families 97/299 = v0.1.1 (listed in component-inventory.md). Comments only; dist size unchanged (types erased).
- Next: 5 viewport-tests.
### 5. Viewport tests — done
- viewport-tests.dc.html ?frame=1280|924|375 (one iframe; no param = sequence, one mounted at a time); vt-frame = min bundle + viewport-harness.js; steps lazy-load demos (2e/2c fixtures, 2f/2g, 2o, 3d/3b, 3e/3f/3h/3i/3g), progress via postMessage, per-step timeout → NEEDS HEALTHY PREVIEW.
- Results (this preview): 1280×800 PASS · 924×540 PASS · 375×667 PASS — all 7 steps each (toast, radius 6, narrow, submenu 8 / 2 at 375, layout 19, charts 6, batch 6 checks), ~75 s per frame. Shots docs/shots/5-vt-*.jpg.
- Toast check samples per rAF at the preview frame rate → owner repeats each ?frame= in a focused tab at ≥ 50 fps.
- Next: 6 docs + report.
### 6. Docs + report — done
- Final hitarea run (probe-charts ?cards=hitarea): 1,026 library controls, 549 visually < 44, effective < 44 = 1 · steals 0 · clipped 0 · geometry identical. Card status FAIL on that 1: Blocks › ULCellId copy button (44×36) in a ULTable cell — 3px below its visual box resolves to .ul-table-scroll (not a scrollbar, no clipping ancestor found). Not traced (the Blocks demo render blocks the preview > 7 s). Resume: mount demos-2l Blocks alone, log td / tr / tbody rects around that button, check whether the row is shorter than 44px or the table body clips (then give .ul-cell-id rows 44px min or move the clip).
- Updated component-inventory (renamed key props, JSDoc per family), freeze-readiness (verified list, owner runs), CHANGELOG, CLAUDE.md (hit layer, naming, tokens, JSDoc), BRIEF STATUS. dist rebuilt (names unchanged). Locked: 42 checked, 0 differences.

# Session progress (Pre-freeze fixes 2, items 0–3)
### 0. Hit-area failure — done
- Probe page showcase/probe-cells.dc.html (one ULTable + every cell renderer; ?rows ?density ?pin ?cols ?probe ?bench=N ?frame).
- Cause: not the truncation wrapper (.ul-cell-id has no overflow; td / tr / scroller: overflow visible, contain none on cells, pointer-events auto). The failing button was in the LAST row with the table scrolled to the end and scrolling horizontally: the scroller's overlay horizontal scrollbar (no layout space, offsetHeight = clientHeight) takes a ~16px hit band at its bottom edge, over the last row's bottom 4px. elementsFromPoint at that point: scroller > table (no tr / td).
- Fix (shared): ULTable sets data-hscroll-overlay on the scroller only when it scrolls horizontally with an overlay scrollbar (ResizeObserver, attribute write only on change) → table margin-block-end --ul-table-hscroll-room (16px, new token). Classic scrollbars: no change. Also: hit layer inside table cells is capped to the row height (--ul-hit-size = min(44px, --row)), so in compact rows it never reaches the next / previous row; .ul-cell-more (focusable "+n" chip) gets the vertical hit layer.
- Preview lock-up: not library work. 200 rows mount (sync render + commit + layout) 84–106 ms; idle after mount: JS < 20 ms in 4 s (rAF / ResizeObserver profile), 0 DOM mutations, 0 running animations, 0 long tasks with the table hidden. The stall comes from the preview's own DOM capture / evaluation of a visible ~12,000-node table (60 nodes per row; the copy button alone is 18: four icon slots). Not changed (motion / action core frozen); option for v0.1.1: render the loading / success / error icon slots on first use. Render time before / after: no library change, so 84–106 ms both.
- hitarea card (probe-charts ?cards=hitarea): PASS · 1,086 library controls · 609 visually < 44 · effective < 44: 0 · steals 0 · clipped 0 · tabs / segmented / toggle-group rects + bubble identical · 59 documented exceptions. Shot docs/shots/0-hitarea-pass.jpg.
### 1. JSDoc accuracy — done
- scripts/check-jsdoc-defaults.mjs (in npm run check:jsdoc; runs in the design tool): reads "Default X" / @default in every documented public prop, finds the code default (destructuring default, defaultProps, `prop ?? literal`, token fallback, dictionary fallback L() / t. / actionText()). Exit 1 on mismatch.
- Result: 299 checked · 195 matched · 0 mismatch now. Corrected (code is the truth): 23 by the script (wrong values: ULProgress showValue true, ULTable loadingRows 6 / stickyHeader true, ULSparkline area true / bead true, ULSlider defaultValue min (0 when unset); labels wrongly called "localised" that are fixed English strings: palette emptyText / recentLabel, modal / popover closeLabel, toast dismissLabel × 2, toast region label, pagination prev / next, KPI delta up / down, KPI previous / target label, tag field remove / added / removed) + 17 from the hand review (localised dictionary labels on copy / save / submit / download / refresh / share / undo / confirm, ULButton shape "circle" when icon-only, dialog closeOnScrim false for alertdialog, copy button variant, success effect "ring" when icon-only, KPI locale from context, colour picker hex label).
- Reviewed by hand: 104 not statically determinable (computed or contextual: "data extent", "first focusable", token-read timeouts, locale context, charts' panel / toolbar / legend rules, 3 known false positives listed in IGNORE). Read the code line for each; the 17 above were the only disagreements.
### 2. Doc fixes — done
- scripts/contrast.mjs: no reference exists in BRIEF, CLAUDE.md, DESIGN, README or docs (grep: 0); DESIGN "Decisions" now states the shared tool is showcase/ul-contrast.js.
- Calendar selects 44px recorded (CHANGELOG, DESIGN) + docs/shots/4-calendar-dropdowns.png (90×44 · 54×44; DOM capture renders native selects with their first option).
- Decisions written to DESIGN + CHANGELOG; docs/tokens-reserved.md lists the 27 reserved tokens.
### 3. Report + status — done
- freeze-readiness (hit areas, callbacks, tokens, JSDoc + defaults verified; owner list + check:jsdoc / check:callbacks / check:tokens, hitarea, viewport toast ≥ 50 fps), component-inventory, BRIEF STATUS, CLAUDE.md, README. dist rebuilt (js 1,625,369 · css 270,818 · min 1,052,030; names unchanged). check:tokens over src: 0 undefined. Locked: 42 checked, 0 differences. STOP after 3.

# Session progress (Focused runs + flaky cards, items 0–5)
### 0. Focused launcher — done
- showcase/focused-runs.dc.html: one link per card (new tab, ?norun&card=<id>): guards (hitarea, kbdaudit), overlays (covered, ctx, ctxmenu, coveredanchor, collheight, tglide), chart timing (chartperf, streamperf, charttip, chartdraw, zoomsmooth, advtip), f3d* (10), lens-tests (switch, switch-logic, slider, range, seg, tabs, timing). Requested names mapped: switch-release → switch / switch-logic, slider-drag → slider, segmented → seg.
- Measures the refresh rate (120 rAF frames, median period) and shows a red warning below 100 Hz. lens-tests gained ?card=<id> (runs one card, deterministic mode, result in window.__ltCard).
- This preview measured 120 Hz (8.3 ms, 3 gaps > 2× in 120 frames). Shot docs/shots/f0-launcher.jpg.
### 1. ULContextMenu — done (real bug, shared pointer-anchor path)
- Probe: showcase/probe-ctx.dc.html (ULContextMenu only + a ULMenu on a button; ?run=interrupt | esc | reopen | cycles).
- Cause: the pointer-anchor open path (ULContextMenu.at in ULMenu.tsx and useContextMenuTarget.openFor in contextTarget.tsx — the one mechanism every context menu uses) always did setOpen(false) + requestAnimationFrame(open). (a) A reopen during the exit waited a frame; under the virtual clock (and any slow frame) the exit finished first, so the menu restarted from the 0×0 point: 421 px/frame jump, 1 reversal, settled 37 px off. (b) An Esc that arrived before that frame closed nothing, then the pending frame opened the menu → the leftover surface after 30 cycles.
- Fix: closed or closing → open immediately (the morph reverses from its current pose — anchoredMorph unchanged); open → re-aim on the next frame; every close / new open cancels a pending re-aim.
- Before → after: motion-test ctx (virtual clock): interrupt FAIL (max 421.3 px/frame, 1 reversal, Δ37.3) → PASS (max 107.0, clean 110.6, 2 reversals, Δ0.0), all 14 checks pass. ctxmenu (live): leftover FAIL (1 visible) → PASS (0 visible, 30 opened); keys / flip pass. Remaining: ctxmenu "point" 6–13 px off in this preview (varies per run; the card's 200-row table causes a 4.8 s long task right before that check) → owner run in the launcher.
### 2. ULSwitch flick — done (release logic was wrong, not the test)
- Cause (ULSelection.tsx endDrag): the release velocity decayed linearly to 0 over 40 ms (the comment says 60 ms) and the flick threshold (0.15 px/ms) was applied to the DECAYED value. The card's flick (0.42 of the span in 3 frames, released one frame after the last move) has a gesture speed of ~0.19 px/ms; one 16.7 ms frame cut it by 42 % → 0.11 → no projection → off, 0 change events.
- Fix: decay over 60 ms as documented; flick decided on the gesture speed, the decayed value only sets the projection. No token touched (--ul-lens-flick 140 unchanged).
- Verified with synthetic gestures on the lens-tests switch (setTimeout spacing, independent of rAF): released 8.3 ms / 16.7 ms after the last move → on (was off at 16.7 ms by the old formula); same distance at 33 ms per move (0.11 px/ms, not a flick) → off. lens-tests ?card=switch-logic in this preview: 7 pass, flick n/a (frame gaps median 133 ms → gated). Owner: launcher → switch-logic ×5 at ≥ 100 Hz.
### 3. Display-independent tests — done
- One refresh measure (median of 60 rAF intervals, cached in window.__ulRefreshP, same helper in thumb-harness, demos-3b, demos-3d): p95 limit = 1.15 × period, fps target = 0.9 × rate. Applied: thumb drag bench (was p95 < 16 ms, impossible on 60 Hz), chartperf fps (was ≥ 100), streamperf fps (was ≥ 100). Below 50 Hz the bench reports NEEDS HEALTHY PREVIEW instead of a verdict.
- Segmented "non-glass well": the flat-well part always PASS / FAIL; the "bubble refracts" part skips (pass null) with "tier is fallback (refraction unavailable here)" when the bubble never reached mode refract.
- kbdaudit: the PickerFixtures "Group by" trigger carries data-kbd-initial-focus="none" (its ULMenu uses initialFocus: null, like the 2e keyboard card's noFocus list); probePopup accepts focus staying on that trigger. Card kbdaudit &kbdonly=PickerFixtures: PASS (was FAIL on that fixture). Shot f3-kbd-pickerfixtures.jpg.
- Not run to the end here: seg-one (preview throttled to ~7 fps during the run) → owner via launcher.
### 4. A11y sweep + svg guard + tokenizer — done
- One hit-area definition: probeHit() in demos-kbd.js (reveal, centre / edge neighbour probes, elementFromPoint inside the 44px box, row items vertical only, exceptions, clipped / scrollbar classes) used by BOTH hitarea and a11ystatic. a11ystatic now: hit 0 (was 6: combobox / tagfield inputs and the 1×1 choice input sit in ≥ 44px wells / labels = skipHit; slider thumbs → 44px track; the Actions 53×32 button has the shared hit layer), 58 documented exceptions listed. Card PASS (12 sections, 1,730 controls). Shot f4-a11ystatic.jpg.
- The 4 × 240px svgs in the motion-test svg guard are the harness's own result charts (240×70 motion curves drawn on cards that have a chart), not components: marked data-ul-illustration (+ aria-hidden). iconsize card in this run: PASS (page 215 svgs).
- ULCodeBlock tokenizer: block comments spanning lines were not highlighted (per-line regex); `/* …` now opens a comment carried to the next lines until `*/` (state per code block); bash `#` only at the line start / after whitespace (not inside URLs). Unit check: "// note", "/**", " * doc", "*/", "/* one-line */" all → comment; `curl …/a#b # comment` → only "# comment".
### 5. Report — done
- Real bugs: context-menu deferred open (interrupt jump + leftover), switch flick decay (40 vs documented 60 ms, threshold on decayed speed), code-block multi-line comments. Test fixes: refresh-relative limits, fallback-tier well skip, one hit-area probe, harness svgs marked, kbd initialFocus flag.
- Cards run here: ctx PASS (virtual), ctxmenu leftover / keys / flip PASS (point FAIL 6–13 px, preview stall), a11ystatic PASS, kbdaudit PickerFixtures PASS, iconsize PASS, codejson PASS, switch-logic 7 pass + flick n/a (throttled; synthetic gesture verified). dist rebuilt; locked 42 checked, 0 differences. STOP after 5.

# Session progress (Typecheck fixes, items 0–6) — every fix UNVERIFIED (no tsc in the design tool; owner reruns npm run typecheck)
### 0. Charts root cause B — done (unverified)
- The shared helper is charts/core.tsx splitChartCtx (not contextTarget.splitCtx): `P extends ContextMenuProps<unknown>` rejects every chart because ContextMenuSpec<T>'s callbacks take T (contravariant), so P failed the constraint and the rest props collapsed to Omit<ContextMenuProps<unknown>, …>. Now generic: `P extends ContextMenuProps<any>, T = CtxTargetOf<P>` (target inferred per chart), returns [ContextMenuProps<T>, Omit<P, keyof ContextMenuProps<T>>]. Types only.
- core.tsx:179: the memoised api is typed Omit<HoverApi, 'layer'> (layer is attached at return via Object.assign, unchanged). Runtime unchanged.
### 1. Real bugs — PARTLY DONE (stopped at the usage limit)
- 1a (real bug, unverified by tsc): ULFilterBar's saved-view menu called the removed `onChange(v.filters)` when no onApplyView is given → ReferenceError on click (rename leftover; check:callbacks only looked at declared / passed props, not calls inside bodies). Fixed → onValueChange. check-callbacks.mjs extended: a component that destructures on(Value|Pressed|Checked)Change but calls onChange( fails (self-test 1 violation; src 0). Guard: filterbar card got a 'view' check — in this preview the card result ends after 'count' (no 'view' / 'filters' rows): debug that first on resume.
- 1b: ULMenuButton dropped closeOnSelect (ULMenu supports it) → the columns menu closed after each toggle. ULMenuButton now forwards closeOnSelect; blocks.tsx passes false (no cast).
- NOT DONE: 1c (accent on ULAnchoredSurface), 1d (ULGlass href / type / pressScale), items 2–6. dist rebuilt; check-locked not run this session.
- Resume: item 1a card debug, then 1c.
### 1 (cont.) — done (types unverified; owner reruns npm run typecheck)
- 1a verified on the card: filterbar ?norun&card=filterbar → "saved view without onApplyView applies its filters, no error" PASS (applied ["P"]). The check had first been inserted into the timeago card by mistake (no filter bar there → ReferenceError ended that card); moved. "remove animates the chip out" FAILs in this preview (timing; long task 3.8 s) → focused run.
- 1c: accent DOES reach the surface at runtime (ULAnchoredSurface spreads ...rest into ULGlass → accentAttrs). Shot t1c-accent-menus.jpg: rose / ice menus, data-ul-accent=rose|ice, --ul-accent rgb(248,134,154) / rgb(143,184,255). Type-only fix: accent / accentStrength added to ULAnchoredSurfaceProps (= ULGlassProps types).
- 1d: type / href WERE forwarded (rest → as element; probe ?glassattrs: picker trigger type="button", 0 form submits, glass link href kept). REAL BUG: pressScale was never consumed by ULGlass → leaked to the DOM as an unknown attribute and never reached the engine (picker triggers pressed at .965, not .98). ULGlass now takes pressScale and passes it to attachGlass (engine option existed). Checkbox / radio boxes are pressable but not interactive: the engine applies pressScale only to interactive glass, so .92 there still has no visual effect (unchanged; listed). ULGlassProps + ULGlassElementAttrs (type, disabled, name, form, href, target, rel, download, hrefLang).
### 2. Actions API — done (unverified; owner reruns npm run typecheck)
- core.tsx: ULActionButtonProps omits the native onError from ULButtonProps → onError is (error: unknown) => void (AsyncActionOptions); fixes core.tsx:293 + :339.
- actions.tsx: ULCopyButtonProps = Omit<Base, 'onCopy'> (onCopy(text) kept), ULSubmitButtonProps = Omit<Base, 'onSubmit'> (onSubmit action kept). ULSaveButton: local actionRef typed AsyncAction<[MouseEvent]> (was a Parameters<> of a ref object); Cmd/Ctrl+S calls run(undefined as MouseEvent) — onSave takes no args, runtime identical.
- Public type changes: ULActionButton family no longer accepts the native img/resource onError; ULCopyButton no longer accepts the native clipboard onCopy; ULSubmitButton no longer accepts the native form onSubmit. Documented callbacks unchanged.
### 3. Small types — done (unverified; owner reruns npm run typecheck)
- headerConfig.ts:33: HEADER_DEFAULTS.poppers ['lang', 'acct'] → ['lang']. Small real bug: HeaderPopper is 'lang' only since the account popper was removed; ULIsland's fallback tools (no tools slot) render one "EN" Language button per popper, so the default showed two. Landing SiteHeader passes its own tools (unaffected). Not screenshotted.
- headerConfig.ts:39: cast via unknown. accent.tsx:24: keeps the '' guard (untyped dc attributes can pass ''), compared via unknown. menubar.tsx:73 skipped (owner: gone with React 19 types).
### 4. Engine — done (unverified by tsc)
- engine.ts:568 (arrowOf): (i) wrong type, real branches. `({…} as const)[side as 'top']` typed edge as 'bottom' only, so edge === 'top' looked impossible; at runtime side is any of four and all branches run. Fix: index with keyof (types only).
- engine.ts:772/773 (applyTier else branch): (ii) dead conditions. `if (next === 'refract')` at 761 takes every refract case, so here next ∈ lite|fallback|flat: `if (next !== 'refract')` was always true, `next === 'refract' ? 1 : 0` always 0. Replaced by unbindFilter(s); s.q = 0 (identical at runtime). Refract path checked after rebuild: probe-cells ?accent → glass modes {refract: 2, flat: 2}, menu backdrop-filter url(#ul-refraction-3) blur(4px) … (shot t4-refract-check).
### 5. react-dom — done
- package.json: devDependencies @types/react ^19.0.0 + @types/react-dom ^19.0.0 (owner installed 19.3); peerDependencies react / react-dom ">=18.3 <20". README "React versions" (types checked on 19; 18.3 in range, not re-tested).
### 6. Report — done. 42 checked, 0 differences. dist rebuilt (names unchanged). Next for the owner: npm run typecheck 2>&1 | tee typecheck.txt

# Session progress (Open items 0–5, 10 Nov 2026)
### 0. Launcher — done
- focused-runs.dc.html: new first group "Open items" with feed (= Activity feed card; its motion-test id is feed, not activity) and select (ULSelect morph). Buttons open motion-test ?norun&card=feed|select in the frame.
- Verified by screenshot of the launcher (group renders, two buttons).
### 1. Nested menus — REAL BUG, fixed in the shared MenuList (ULMenu.tsx; used by ULMenu, context menu, menubar)
- Cause: React synthetic events bubble through portals. A pointermove inside level 3 also ran the onPointerMove of the level-2 and level-1 MenuLists; closest('[data-active-level] [data-menu-item]') matched the level-3 row and each parent read ITS items[thatIndex] (e.g. level 1 index 0 = Copy, no submenu) → setSub(-1) after the submenu delay → levels 3 and 2 collapsed. Same leak for keydown (↓ in level 2/3 moved focus to the parents' rows). Outside-pointer dismiss (inLaterOverlay) was not involved.
- Fix: a list handles keys / pointer only for targets inside its own DOM; a pointer inside a descendant submenu counts as inside the level (cancels its pending switch timer, changes nothing). No timing / token / overlay-morph change.
- Probe showcase/probe-nested.dc.html: before A2 (pointer inside level 3) FAIL → after all 10 steps PASS (shots/nested-before.jpg, shots/nested-after.jpg). New card nested3 (motion-test, demos-2h.js nestedMenuTest): before FAIL hold / keys / esc (shots/nested3-card-before.jpg) → after PASS 6/6 (shots/nested3-card-after.jpg). Card aims at the settled level 3 (mid-morph its rows still sit over level 2). Launcher: nested3 added.
### 2. Activity feed card — TEST FIX (b), component unchanged
- Single run here: PASS 5/5. The owner's exact numbers (6→6, 0 anims; then "3 new events") reproduce only when the list already counts as "interacting" before the first insert: a synthetic pointerenter before step 1 gives 6→6 · 0 anims and "3 new events" (the first event queued too). The stage is fixed bottom-right; in the launcher frame the owner's parked cursor sits over it and fires a real pointerenter, so the feed correctly queued (live-table rule). The card assumed "not interacting" without establishing it.
- Fix (demos-2n.js feedTest): known start = blur focus inside the list + synthetic pointerleave; if the real cursor still matches :hover the two checks report NEEDS POINTER OFF THE STAGE (n/a) instead of FAIL. Verified: card PASS (shots/feed-card-after.jpg).
### 3. Keyboard date / colour popup triggers — NOT REPRODUCED; test isolation hardened + diagnosis (no component change)
- kbdaudit Selection here: PASS (date, colour "1 emulated") singly; after the date + color morph cards; after the 30 cards before kbdaudit in page order (49–78); with deterministic(true); with the page scrolled to 9877 px. A full-order run did not finish in this preview (~8 cards in 4 min; stopped). Code read: no shared trigger / glass / overlay code prevents Enter (ULGlass has no key handler; page-lock keys exclude Enter).
- The owner's text "Enter: did not open" has no "(emulated click)", i.e. the Enter keydown was already defaultPrevented when the probe checked it, which points at a listener left by an earlier step, not at the trigger.
- Test fix (demos-kbd.js probePopup): clean start before each popup probe (close leftovers, wait for morphs + scroll unlock); on a miss it records who prevented Enter (window capture listener = leaked state / the component / outside) and retries once from a clean state. Retry opens → PASS + "ISOLATION: …" note naming the cause; retry fails → FAIL with the cause. Verified with an injected one-shot leaked capture listener: date PASS · ISOLATION: prevented by a window capture listener; clean retry opened.
### 4. ULSelect morph — TEST FIX in the shared morph harness (component unchanged)
- All overlay morph cards (select, combobox, date, color, menus, modal, ctx …) share motion-harness runCaseLocked. Before: a live FAIL with a > 100 ms frame gap became WARN "live FAIL / virtual PASS", and a run throttled from the start went virtual-only and showed PASS (against the rule "virtual PASS is never a PASS"). The frame-dependent cards (collheight, tglide, charts 3B) report NEEDS HEALTHY PREVIEW instead.
- Now: throttled from the start + virtual PASS → NEEDS HEALTHY PREVIEW (n/a); live FAIL with frame gap > 100 ms + virtual PASS → NEEDS HEALTHY PREVIEW (n/a, live failing keys listed); live FAIL without a gap + virtual PASS → WARN as before; any virtual FAIL → FAIL. Verified: select card here = "NEEDS HEALTHY PREVIEW · virtual PASS" (shots/select-needs-healthy.jpg). The gap path (owner's 150 ms case) cannot run here (rAF never alive) → owner rerun.
### 5. Report — done. check-locked: 42 checked, 0 differences. dist rebuilt (ULMenu fix). Side check: existing card submenu = same result on the old and the new bundle here (flip FAIL in both, preview timing).
- Owner reruns in the launcher (focused-runs, "Open items"): feed, select (×5), nested3; then kbdaudit, ctx, ctxmenu. Plus the full motion-test walkthrough once for kbdaudit (look for "ISOLATION:" on date / colour).
- Regression check for the ULMenu change: ctxmenu here 12 pass, point FAIL (offset 14 px, preview stall; same as the previous session's 6–13 px). Shots: docs/shots/nested-before.jpg, nested-after.jpg, nested3-card-before.jpg, nested3-card-after.jpg, feed-card-after.jpg, select-needs-healthy.jpg.


## Material glass | flat (10 Nov 2026)
- 0 Plan: glass applied in ULGlass → engine attachGlass (tiers refract / lite / fallback / flat; governor area budget); reduced-transparency fallback = one rule in ULGlass.css. Field wells, select / native select / OTP / input group / copy field were already non-glass wells (pointer light only); only the date / range / colour picker triggers were ULGlass. Plan: one resolver (glass/material.tsx), flat = add the material selector to the existing fallback rule + engine resolveMode → 'flat' (outside the governor).
- 1 Table ⋯: icon-only on hover / focus-visible, glass only when open (ULData.css). Shots docs/shots/01–08-table-act.png (violet + emerald; focus ring NEEDS FOCUS in the preview). hitarea PASS (missing 0, clipped 0, steals 0, geometry 0). kbdaudit: did not finish in the preview (owner run).
- 2–3 ULProvider + useMaterial + resolveMaterial; ULGlass material / materialCategory; engine isFlatMaterial (resolveMode, governor skip, no pointer light, data-ul-flat stamp); CSS selectors added to the fallback rule + rim / light layers off. Locked 42 checked, 0 differences.
- 4 Inputs read the hook (default flat); other categories pass their category (default glass, output unchanged). Shot docs/shots/01-material-before-after.png.
- 5 Card material (demos-material.js, motion-test + focused-runs): PASS 12/12 + 1 info (contrast flat text 10.5–15.8:1). Shot docs/shots/material-card.png.
- 6 Docs: README "Material: glass and flat", CHANGELOG Unreleased, showcase/material.dc.html. Typecheck unverified, owner reruns npm run typecheck.

# Session progress (Step 4D: material follow-ups)
## 1. Flat primary button — REAL FIX (shot docs/shots/4d-1-flat-buttons.jpg, probe showcase/probe-material-4d.dc.html)
- Cause: the flat rule shared the reduced-transparency background (deep accent × ax·60 % into surface-solid) → vivid primary became a dark plate. Fix in ULGlass.css (shared flat rule only): opaque body colour --ul-glass-tint-color × ax over surface-solid, under the glass contrast backing (deep × scrim × ax). ax 0 (secondary) = surface-solid, identical to before.
- Label contrast (ul-contrast.js): flat primary violet 8.0, amber 5.78; secondary 15.91 (unchanged). Ghost = plain, never glass, unchanged. Disabled = same fill at opacity .42 (unchanged rule).
- Reduced transparency NOT changed: its primary stays the dark deep-accent plate. Difference now: flat primary = accent fill (tint colour), reduced-transparency primary = deep accent 60 % mix. Secondary / ghost identical in both. dist rebuilt.
## 2. Picker triggers in flat — REAL FIX (shots 4d-2-mixed-before.jpg / 4d-2-mixed-after.jpg)
- Date, date-range and colour triggers stay ULGlass (glass mode unchanged); in flat ULListbox.css paints them with the select / text well: --ul-fw / --ul-fwh / --ul-fr / --ul-frh, --ul-field-inset, --ul-field-h-compact, --ul-field-radius, same hover / focus / invalid rules. .ul-picker added to the accent-tinted well vars (ULField.css). No new colours or tokens.
- Time range = ULSelect + ULDateRangePicker, so covered by the same rules. Popovers unchanged (overlays = glass).
- Mixed after: date trigger = same well as Region select next to it (screenshot). dist rebuilt.
## 3. Flat state audit — REAL FIX ×2 (shot 4d-3-flat-states.jpg, probe ?only=states)
- 6 components × rest / hover / focus / disabled / invalid / filled in flat. Lowest (ul-contrast.js, over --ul-color-graphite): text 9.92 (placeholder on hover well), label 9.92, rim 3.11 (was 2.83 < 3:1 → --ul-field-rim .14 → .18 in tokens.json, tokens.css rebuilt), hover rim 4.45, focus ring 12.09, danger ring 7.08, error text 12.42. Disabled = opacity, exempt.
- Fix: OTP focus lit all six boxes (shared .ul-field:focus-within) → only the focused box shows the ring (ULField.css).
- Not a defect, reported: copy field well has no hover / invalid / disabled state (no props; its buttons carry hover + focus ring). Hover/focus for date / copy forced via data-ul-force in the probe.
## 4. OTP overflow — REAL FIX (shots 02-4d-4-otp-widths.jpg, 4d-2-mixed-after.jpg)
- Cause: fixed 48px cells + fixed 8px gap, no shrink. Fix in ULField.css (shared ULOtpField): cell flex 0 1 --ul-field-otp-w, min 75 % (36px); gap clamp(space-1, 2.5 %, space-2). Normal width unchanged (48 × 56, gap 8).
- Measured: containers 720 / 480 / 375 = 48px cells, 320 = 41.7, 280 = 36.0 (min) with 0.3px to spare; 0 overlaps. material.dc.html in 375px iframe: 39.5px cells, right edge = form edge; 480px: 48px. Height 56 (≥ 44) everywhere. Below ~272px container the 36px minimum overflows (by design).
- Minimum width reached: 36px (< 44 wide; height 56). Hit area: hitarea card rerun in item 5.
## 5. Tests — TEST FIX (cards added, run in my preview)
- material (demos-material.js): +flat-primary (fill toward accent, label ≥ 4.5, secondary = surface-solid) +picker-well (date trigger bg + shadow = text well, no bg-image). Result PASS 14/14 (+1 info): primary fill rgb(79 66 126) label 8:1, secondary Δ0.000; trigger = well oklab(0.2333 0.0077 -0.0302 / .894), shadow same.
- New card otplayout (motion-test CASES + focused-runs Guards): 375 / 480 / 720 PASS (48×56, gap 8, edge inside, 0 overlaps).
- hitarea PASS (9 checks). kbdaudit: started, the preview stopped answering after ~60 s (every probe timed out for 4 min) → step NOT observable; owner runs it in Chrome (focused-runs → Guards).
## 6. Docs — DONE: README "Material: glass and flat" (flat keeps accent, picker triggers = inset well, OTP sizing, otplayout card), CHANGELOG Unreleased (5 lines + corrected 4C picker line), DESIGN field-rim note. No prop added or changed → JSDoc @default untouched.
## 7. Report — locked 42 checked, 0 differences. STOP after 7.

# v0.1 freeze preparation (10 Nov 2026)
## 0. Plan — DONE
- Existed: README, CHANGELOG, package.json (exports, files, sideEffects, peers), dist (window.UL bundle + min + css), docs/freeze-readiness.md.
- Missing: LICENSE + "license" (owner decision, blocker), ESM build + .d.ts (exports "." pointed at src/index.ts), api snapshot, pack check, release checklist, smoke example, v0.2 backlog file.
## 1. API surface — DONE (run in-tool via the <surface> core of scripts/api-surface.mjs)
- docs/api-surface.txt: "." 674 exports (379 values, 295 types); ./dist and ./dist/min same surface (window.UL); tokens.json 84 top-level keys; CSS entries 0.
- npm run check:api (fails on any diff; npm run api:snapshot regenerates). Sorted, no dates → stable.
## 2. Package — DONE / UNVERIFIED build
- exports ".": types first → dist/types/src/index.d.ts, import → dist/esm/index.js; main/module/types updated; src no longer published; sideEffects = *.css + the two window.UL bundles; peers ^19.0.0.
- build:esm (esbuild) + build:types (tsconfig.build.json) added: unverified, owner reruns npm run typecheck / build:release.
- @storybook/react kept: 4 *.stories.tsx import its types (no .storybook folder); stories excluded from types build and tarball.
- check:pack (scripts/check-pack.mjs, emulated in-tool): 54 files, ≈1.27 MB packed / 4.63 MB unpacked today; limits 2.5 / 9 MB; fails now on missing dist/esm + dist/types (expected until built); license / private reported (fail only with --strict).
## 3. Release checklist — DONE: docs/release-checklist.md (install → typecheck → checks → build:release → focused cards → audit → tag → publish → smoke → rollback).
## 4. CHANGELOG — DONE: 0.1.0 — 2026-11-10 (Added / Changed / Fixed / Known limits); older records renamed "Pre-release record"; version stays 0.1.0; not tagged.
## 5. Docs freeze — DONE: freeze-readiness current numbers + blockers; inventory totals verified by script (170 / 142 / 28); README install (React ^19, CSS imports, ULProvider material + ULAccentScope accent: ULProvider has no accent prop), Known limits, checklist link. Links: scripts/check-links.mjs, 17 files, 3 relative links, 0 broken.
## 6. Smoke example — DONE (not run): examples/vite-smoke (package.json file:../../ultralabs-glass-0.1.0.tgz, index.html, main.tsx, vite.config.ts, tsconfig.json); outside "files".
## 7. Backlog — DONE: docs/v0.2-backlog.md; freeze-readiness v0.2 section points to it.
## 8. Report — locked 42 checked, 0 differences.

# Release hardening pass (2026-11-10)
## H1. Typecheck — DONE (verified: `npm run typecheck` exit 0, no output after tsc)
- Real bug (types): ULCopyButtonProps extended Omit<Base,'onCopy'> but redefined `value` and `variant` with different types. Fix: Omit<Base,'onCopy'|'value'|'variant'> (actions.tsx:51). `variant` was a second clash revealed after the first fix. Other Actions props interfaces (Submit, ToggleIcon) compile clean.
- Real bug (runtime): headerConfig.ts HEADER_DEFAULTS had the `//` comment on the same line as accent/sticky/indicatorRest/legibility/studioLink, commenting them out (studioLink undefined, legibility not 'high'). Comment moved to its own line, values restored. Showcase check of the header studio link: NOT done here (owner / browser).
## H2. Build — DONE: `npm run build:release` exit 0 (build-tokens no longer imports check-locked; check-locked.mjs in build:min chain; runs standalone: 42/0).
- Real packaging bug: tsc kept `.tsx`/`.ts` specifiers in 46 dist/types .d.ts files (consumers cannot resolve). rewriteRelativeImportExtensions does not touch declaration output. New scripts/fix-dts-extensions.mjs (rewrites to `.js`, 242 specifiers) runs in build:types (which now also does `rm -rf dist/types`). 0 `.ts(x)` specifiers left.
- Noise: ~100 esbuild "ignored-bare-import" warnings (sideEffects "*.css" not matched by esbuild 0.24 in the bundle build). CSS is still in dist/ul-glass.css and the bundles (checked ul-kbd-combo present). Not fixed; candidate: "**/*.css".
- check:pack: 136 files, 1.61 MB packed, 2 problems left: license, private (both owner-only).
## H3. npm audit — esbuild <=0.24.2 (GHSA-67mh-4wv8-2f99, moderate). Dev-only (dev-server `serve` API, not used; not in dist). Direct devDependency + deduped under @storybook/react. Fix NOT applied (see report).
## H4. Smoke test — DONE: npm pack -> examples/vite-smoke: npm install OK, `tsc --noEmit` (skipLibCheck:false) + `vite build` exit 0 (ULProvider, ULAccentScope, ULButton, ULModal, ULLineChart, tokens.css + ul-glass.css all resolve); `vite` dev serves index, main.tsx and the dep bundle (200). Runtime rendering in a browser NOT verified.
## H5. Gates — typecheck 0 · check:locked 42/0 · check:tokens 0 undefined (27 unused) · check:callbacks 245/0 · check:jsdoc 1134/1336 (85%), 0 mismatch · check:api matches (674) · check:pack 2 problems (license, private). No public export changed; api-surface.txt untouched.
## H6. License options prepared: docs/license-options.md (not applied).
## H7. License — MIT applied (owner decision): package.json "license": "MIT", LICENSE added (holder "Ultra Labs", confirm). check:pack: 1 problem left (private: true, removed only at publish). Publish: npm publish --access public.
## H8. Owner decisions applied (2026-11-10)
- LICENSE holder = "ultralabs-liquidglass". Chrome cards ignored by owner.
- Storybook removed: @storybook/react dropped from devDependencies; the 4 *.stories.tsx moved (not deleted) to ../_archive/storybook-stories/. esbuild devDependency ^0.25.0 (installed 0.25.12). npm audit: 0 vulnerabilities.
- Re-run after the change: build:release exit 0, typecheck 0, check:locked 42/0, tokens 0 undefined, callbacks 241 files 0 violations, jsdoc 0 mismatch, api matches (674), check:pack 1 problem (private: true).
- Tag + publish NOT done: `npm whoami` = need auth (owner login), and this folder is not a git repo (no tag possible).
## H9. Package name back to @ultralabs/glass (owner: org `ultralabs` now exists and is owned by fiuipko; temporary org `ultralabss` to be deleted by owner).
- Reverted every reference (package.json, README, checklist, BRIEF, smoke example, scripts, showcase), regenerated docs/api-surface.txt header; CHANGELOG note about @ultralabss removed. Export list unchanged (674).
- Re-run: build:release 0, typecheck 0, check:locked 42/0, callbacks 241/0, jsdoc 0 mismatch, api matches, check:pack 0 problems; npm pack -> ultralabs-glass-0.1.0.tgz (137 files); smoke install + tsc + vite build exit 0.
- Publish NOT done: owner runs `npm publish --access public --ignore-scripts` (2FA). Note: @ultralabss/glass has a pending staged 0.1.0 — delete it with the org.
## H10. Published + GitHub (2026-11-10)
- npm: @ultralabs/glass@0.1.0 live (license MIT, verified with npm view).
- GitHub: https://github.com/ultralabss/liquid-glass (public). Commit 1 = state as published, tag v0.1.0 on it; commit 2 adds repository/homepage/bugs to package.json (shown on npm from the next release). .gitignore excludes node_modules, tgz, dist/esm, dist/types, maps, docs/BRIEF.md (owner notes, contains a real name). showcase quote source changed to "UltraLabs".
- Open: GitHub org is `ultralabss`; the `UltraLabs` org on GitHub belongs to someone else. npm scope `ultralabs` is ours. Delete npm org `ultralabss` (owner). Ledger: UL-613.
