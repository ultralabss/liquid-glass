# Reserved tokens (decision 9 Nov 2026)
These 27 tokens are defined in tokens/tokens.json but nothing in src, showcase, landing or apps reads them (scripts/check-tokens.mjs). They are kept as reserved public API (scale steps, rgb triplets for consumers, locked names) and must not be removed or renamed in 0.1.x. Re-check with `npm run check:tokens`.

| token | group |
|---|---|
| `--ul-color-danger-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-color-graphite-2` | colour scale |
| `--ul-color-graphite-2-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-color-graphite-3-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-color-ink-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-color-steel-2` | colour scale |
| `--ul-color-steel-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-color-success-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-color-surface-solid-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-color-text-2-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-color-text-3-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-color-text-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-color-warning-rgb` | rgb triplet (consumers: rgb(var(--x) / a)) |
| `--ul-data-sweep-duration` | component default |
| `--ul-kpi-reveal-delay` | component default |
| `--ul-lens-stretch` | locked / lens timing |
| `--ul-modal-w-reading` | component default |
| `--ul-progress-ring` | component default |
| `--ul-selection-slider-press` | component default |
| `--ul-selection-switch-thumb` | component default |
| `--ul-selection-thumb-press` | component default |
| `--ul-space-0` | spacing scale step |
| `--ul-space-12` | spacing scale step |
| `--ul-space-16` | spacing scale step |
| `--ul-space-8` | spacing scale step |
| `--ul-tabs-glide` | locked / lens timing |
| `--ul-type-track-caps` | component default |
