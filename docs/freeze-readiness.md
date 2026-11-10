# v0.1 freeze readiness (10 Nov 2026, freeze preparation)

## Current numbers (owner-confirmed after 4A–4C+, plus this step)
- typecheck 0 errors · check:locked 42 checked, 0 differences · check:tokens 0 undefined (27 unused, reserved) · check:callbacks 245 files, 0 violations · check:jsdoc 1134 / 1336 (85 %), 0 mismatch.
- Focused runs (Chrome, 120 Hz): motion-test, lens-tests, launcher cards material, hitarea, kbdaudit, otplayout, nested3, feed, select all PASS.
- 170 components (142 stable / 28 draft), docs/component-inventory.md. Public API: 674 exports on `.` (379 values, 295 types), docs/api-surface.txt, `npm run check:api`.
- Package: check:pack (in-tool emulation) 54 files, ≈ 1.27 MB packed / 4.63 MB unpacked before the ESM + types build; limits 2.5 MB / 9 MB.
- Release blockers: no license; dist/esm + dist/types not built yet (owner, docs/release-checklist.md); "private": true stays until the publish step.

## History (9 Nov 2026, after the pre-freeze audit + pre-freeze fixes 1 and 2)

## Verified (who / how)
| area | verified by | evidence |
|---|---|---|
| ULChartV1 removed, no references | Claude, grep (src, showcase, landing, apps, dist) | CHANGELOG 0.1.0 breaking |
| Static pass (imports, cycles, any) | Claude, script | 0 missing, 0 file cycles, 9 `any` (none public) |
| Scatter canvas renderer | Claude, card scattercanvas PASS 10/10 + screenshot | docs/shots/2-scatter-svg-vs-canvas.jpg |
| Columns drag reorder | Claude, card colsdrag PASS 11/11 + screenshot | docs/shots/3-colsdrag-midrag.jpg |
| Keyboard walkthrough | Claude, card kbdaudit (12 sections) | 2 shared bugs fixed (menu initial focus, pagination focus); all PASS except one pointer fixture (initialFocus null) |
| Fallback tiers + reduced transparency | Claude, card fallback × 3 modes + screenshots | docs/fallback-audit.md (6,510 samples, 0 fail) |
| Contrast matrix | Claude, shared tool | docs/contrast-matrix-v0.1.md (20,400 checks, 0 fail after restoring 23 chart tokens) |
| Static a11y | Claude, card a11ystatic | 0 names / labels / ids / tabindex issues; 1 role bug fixed; hit areas open (below) |
| Layout guards with batch 1 / batch 2 / advanced charts | Claude, probe-forms ?guard + probe-charts ?guard | PASS at 1280×800, 924×540, 375×667 (docs/shots/9-guard-*.jpg) |
| Covered modals | owner (focused) | covered 5/5 cold / warm / interrupt |
| Hit areas ≥ 44px (shared hit layer) | Claude, card hitarea (elementFromPoint, frame-independent) + probe-cells | PASS: 1,086 library controls, 609 visually < 44, 0 effective < 44, 0 neighbour overlaps, lens geometry identical on / off; 59 documented exceptions |
| Callback naming | Claude, scripts/check-callbacks.mjs | 237 files, 0 violations; 7 renames in CHANGELOG breaking |
| Token integrity | Claude, scripts/check-tokens.mjs + shared contrast tool | 0 undefined; 9 tokens defined, --ul-chart-ring .52 restored; charts 8,800 rows 0 fail |
| JSDoc on v0.1 families + defaults | Claude, scripts/check-jsdoc.mjs + check-jsdoc-defaults.mjs | 6 families 100 %, overall 85 %; defaults 299 checked, 0 mismatch (40 corrected, 104 reviewed by hand) |
| viewport-tests per frame | Claude, ?frame=1280 / 924 / 375 (lazy harness) | PASS / PASS / PASS, 7 steps each; toast per-frame sampling at preview fps → owner confirms |
| Locked timings | Claude, scripts/check-locked.mjs (in-browser) | 42 checked, 0 differences |

## Still open
- Chart scale colours (seq / div / brush / track …) stay re-derived (no earlier copy proves other values): owner eyeball docs/shots/4-chart-colours-* (app + marketing).
- Calendar day grid stays 43px (adjacent on both axes; documented exception). Typecheck not run here (no Node; no tsc output pasted).
- JSDoc for the remaining families (carousel, menubar, navigation menu, resizable, typography, card / panel, accordion, sidebar, toolbar, island, structure, dashboard blocks 2, glass) = v0.1.1.

## Owner runs that must pass before the freeze (focused tab, ≥ 100 Hz)
Use showcase/focused-runs.dc.html: one link per card (new tab), refresh-rate check with a warning below 100 Hz.
1. `npm run typecheck`, `npm run check:locked`, `npm run check:tokens`, `npm run check:callbacks`, `npm run check:jsdoc` (coverage + defaults) locally.
2. motion-test `?norun&card=` collheight, tglide, advtip, zoomsmooth, streamperf, charttip, chartdraw, chartperf (each ×1, ×5 for the timing ones).
3. motion-test `?norun&card=f3d_hovercard … f3d_typography` (the f3d* cards, ×5).
4. motion-test `?norun&card=kbdaudit` once in a focused tab (also clears the NEEDS FOCUS list: :focus-visible rings, hover card focus-open, tooltip on focus, focusout closing, blur commits, palette hotkey, real Tab order).
5. motion-test full run (autorun), lens-tests full run, viewport-tests `?frame=1280`, `?frame=924`, `?frame=375` (each on screen, ≥ 50 fps), motion-test `?norun&card=hitarea` once; the viewport toast check at ≥ 50 fps on each frame.
6. ×5 cold-first: `?norun&card=select`, `modal`, `cmd`, `ctx`; `?norun&card=coveredanchor` ×5.
7. scattercanvas / colsdrag feel at 50k points / real drag; touch on a phone: columns drag handle, resizable, carousel, hover card tap, context-menu long-press, sheet drag-to-dismiss.
8. Lite and flat tiers by eye on `?glass=lite` and `?glass=flat`; flat tier blur by eye in a real tab (`probe-forms.dc.html?only=feedback&glass=flat`, open "Archive 3 items?") — DOM screenshots do not render backdrop-filter.

## v0.2 backlog
Moved to docs/v0.2-backlog.md.
