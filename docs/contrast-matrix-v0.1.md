# Contrast matrix v0.1 (pre-freeze audit, item 7, 9 Nov 2026)

One tool: showcase/ul-contrast.js (self-test PASS). Model reports: 2 themes (app, marketing) × 5 accents (ice, violet, emerald, amber, rose) × 3 strengths (subtle, tinted, vivid) × dark / mid / light backdrops, glass worstSurface model. Tint, rim and ink tokens do not change per tier, so the model rows hold for full, lite and flat; the live sampler (card `fallback`, docs/fallback-audit.md) measured the rendered lite / flat / reduced-transparency pages separately.

**Total: 13,890 model rows + 6,510 live samples (2,170 × 3 tiers) = 20,400 checks, 0 fail (after one fix).**

| family | source | rows | worst case | combination |
|---|---|---|---|---|
| Charts (everyday) | probe-charts ?contrast | 8,800 (shared with advanced) | 3.24 sparkline loss bar vs card (≥ 3) · 4.58 axis ticks (≥ 4.5) | app · emerald · vivid · dark |
| Charts (advanced) | same | (in 8,800) | 3.15 radar rings (≥ 3) · 4.98 funnel drop-off text (≥ 4.5) | app · emerald · vivid · dark |
| Buttons and actions | probe-charts ?actions | 2,340 | 4.41 success ring edge (≥ 3) · 6.56 check on disc | marketing · rose · vivid · mid / app · rose · vivid · light |
| Fields, forms, alerts, separators, kbd, item, scroll area | probe-forms ?contrast | 2,400 | 4.56 optional / description text | marketing · emerald · tinted · dark |
| Hover card, menubar, navigation, calendar, resizable, carousel, typography | probe-forms ?cards=contrast3d | 350 | 4.56 hover card description on glass | marketing · emerald · tinted · dark |
| Selection controls (switch, slider, range, segmented, tabs, select, combobox, OTP, tags, date, colour) | live sampler, 3 tiers | 246 | 5.92 calendar day (reduced transparency) | app · violet |
| Overlays + menus (modal, sheet, drawer, popover, menu, toast, sidebar, accordion, pickers) | live sampler | 645 | 5.92 menu label (reduced transparency) | app · violet |
| Data, tables, KPI | live sampler | 1,848 | 5.76 badge (reduced transparency) | app · violet |
| Dashboard blocks | live sampler | 2,178 | 5.76 overdue badge (reduced transparency) | app · violet |
| Typography | contrast3d | (in 350) | 11.9 ink-2 | app · rose |
| Alerts and banners | probe-forms ?contrast | (in 2,400) | 3.21 alert icon (≥ 3) · 5.24 title | app · amber / emerald |
| Navigation | contrast3d | (in 350) | 6.5 current underline (≥ 3) · 7.22 muted item | app · violet / marketing · rose |
| Calendar | contrast3d | (in 350) | 8.61 selected day ink | app · ice |
| Hover card | contrast3d | (in 350) | 4.56 description | marketing · emerald · tinted · dark |

Fix (non-locked tokens only): the 3B chart tokens (track, ring, brush, brush-edge, seq-0…6, div-0…6, cell-empty, cell-ink-dark, danger-ink, live-pulse, canvas-at) had only ever lived in a hand-edited tokens.css and were lost when tokens.css was regenerated from tokens.json (heatmap / calendar / treemap colours, radar rings, brush and the canvas switch point had no value). They are now in tokens.json (`chart` group). First run after restoring: 31 fails, all funnel drop-off text (--ul-chart-danger-ink 3.78); --ul-chart-danger-ink → oklch(0.88 0.075 25): 0 fail, worst 4.98.

Screenshots: docs/shots/7-contrast-charts.jpg, 7-contrast-charts-2.jpg, 7-contrast-actions.jpg, 7-contrast-forms.jpg, 7-contrast-3d.jpg; live tiers 5-fallback-*-contrast.jpg.
