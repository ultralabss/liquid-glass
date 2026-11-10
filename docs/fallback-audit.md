# Blur-only and reduced-transparency audit (v0.1 pre-freeze, item 5)

Modes: `?glass=lite`, `?glass=flat` (forceQuality), reduced transparency forced with `?transparency=reduce` / `<html data-ul-transparency="reduce">` (new: same rules as `@media (prefers-reduced-transparency: reduce)`, which cannot be emulated in the preview; the engine also treats the attribute as "no refraction").
Contrast: card `fallback` (showcase/demos-kbd.js, probe-charts `?cards=fallback&glass=…`), shared tool showcase/ul-contrast.js. Every visible text node in 12 demo sections + up to 4 opened overlays per section; colour composited over the background-colour stack (covering pseudo layers included) down to the first opaque layer, else over dark / mid / light backdrops. Text ≥ 4.5:1 (large ≥ 3:1).

| area | lite | flat | flat + reduced transparency |
|---|---|---|---|
| Selection fixture (switch, slider, range, segmented, tabs, select, combobox, OTP, tags, date, colour; 3 overlays) | 82 · 0 below · worst 6.68 | 82 · 0 · 6.68 | 82 · 0 · 5.92 (calendar day) |
| Action buttons (all states) | 63 · 0 · 10.49 | 63 · 0 · 10.49 | 63 · 0 · 10.49 |
| Containers (modal, sheet, drawer, popover, menu, toast, sidebar, accordion; 4 overlays) | 114 · 0 · 7.08 | 114 · 0 · 7.08 | 114 · 0 · 6.27 |
| Pickers / select fixtures (3 overlays) | 101 · 0 · 6.68 | 101 · 0 · 6.68 | 101 · 0 · 5.92 |
| Data panels, table, KPI cards | 616 · 0 · 6.72 | 616 · 0 · 6.72 | 616 · 0 · 5.76 (badge) |
| Dashboard blocks (filter bar, columns menu, cells) | 626 · 0 · 6.68 | 626 · 0 · 6.68 | 626 · 0 · 5.76 |
| Blocks 2 (inline edit, notification centre, feed, code / JSON) | 100 · 0 · 10.87 | 100 · 0 · 10.87 | 100 · 0 · 10.55 |
| Forms (3C) | 62 · 0 · 9.97 | 62 · 0 · 9.97 | 62 · 0 · 9.97 |
| Feedback + structure (alerts, alert dialog, confirm popover, toggle group, item, collapsible, scroll area) | 144 · 0 · 7.81 | 144 · 0 · 7.81 | 144 · 0 · 7.81 |
| Batch 2 (hover card, menubar, navigation menu, native select, calendar, resizable, carousel, typography) | 153 · 0 · 6.68 | 153 · 0 · 6.68 | 153 · 0 · 6.27 |
| Charts | 51 · 0 · 9.97 | 51 · 0 · 9.97 | 51 · 0 · 9.97 |
| Charts (advanced) | 58 · 0 · 9.97 | 58 · 0 · 9.97 | 58 · 0 · 9.97 |

Totals: 2,170 text samples per mode, 0 below threshold in all three modes. No fallback token changed (nothing failed).

## By eye (screenshots docs/shots/5-fallback-*)
- 5-fallback-flat-charts.jpg / 5-fallback-rt-charts.jpg: chart panel keeps tint + rim in flat; reduced transparency paints the solid surface (deep accent kept). Calm, intentional.
- 5-fallback-flat-feedback.jpg / 5-fallback-rt-feedback.jpg: confirm popover over alerts. Reduced transparency = solid popover, fully legible. In the flat shot the text behind the popover shows through because the DOM screenshot tool does not render backdrop-filter (the blur); in a browser flat = blur + tint. Owner check in a real tab: `probe-forms.dc.html?only=feedback&glass=flat`, open "Archive 3 items?".
- 5-fallback-*-contrast.jpg: the three result tables.
- Nothing clipped (layoutoverflow guard unchanged, all PASS in 3B / 3C / 3D runs); no element became transparent (opacity < 1 only on disabled controls, excluded by rule).

## Limits
- The model uses background colours only; gradients / images in a layer are ignored, blur is not modelled (blur can only lower local variance, the tint is kept). The model-based reports (charts 8800, actions 2340, forms 2400, 3D 350 rows) cover glass over light / mid backdrops and are tier-independent (tint, rim and ink tokens do not change per tier).
- Header island, landing toasts and the mobile bar are landing chrome: checked in landing/chrome/mobile-glass-check (owner), not in this card.
- Full-page DOM screenshots of the Data / Blocks sections time out in this preview (> 7 s capture); those areas are covered by the numbers above.
