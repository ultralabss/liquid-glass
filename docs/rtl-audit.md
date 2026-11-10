# RTL audit (Task 3D, 2026-11-09)

RTL is **not supported in v0.1**. This audit renders ten components inside `dir="rtl"` on showcase/probe-rtl.dc.html (`?ltr` = same set left to right). Shots: docs/shots/01–03-3d-8-rtl.jpg, 01–03-3d-8-rtl-overlays.jpg.

## What breaks
| # | component | finding | cause |
|---|---|---|---|
| 1 | button | Layout mirrors (flex), but directional icons (chevron-right on "Next") do not flip. | No icon mirroring rule. |
| 2 | text field | Floating label stays at the left while the value is right-aligned. | Label positioned with physical left / translate. |
| 3 | input group | Affix text "https://" renders as ":https//"; prefix / suffix order mirrors. | Neutral characters in a RTL run; affixes need dir="ltr" / <bdi>. |
| 4 | select | Trigger mirrors correctly (chevron at the start). The list surface renders LTR. | Portal (see 5). |
| 5 | menu | Surface content is LTR (labels left, chevron right, shortcut right); submenu side is placement-driven only. | ULAnchoredSurface portals to body and copies theme / accent / backdrop from the anchor, not dir. Submenu placement prefers "right". |
| 6 | tabs | Order mirrors, lens follows; arrow keys are not swapped (← moves to the previous item in DOM order, which is visually to the right). | Key handling uses physical arrows. |
| 7 | table | Column order mirrors; numeric column stays right-aligned (should align to the end, i.e. left in RTL). Sort and row-action positions OK. | text-align: right on numeric cells. |
| 8 | toast | Rendered LTR inside the stack; stack corner stays bottom-right. | Portal + physical position tokens. |
| 9 | dialog | Rendered LTR (close button right, label left). | Portal (see 5). |
| 10 | chart | Toolbar, title and legend mirror; axes do not (y axis left, x grows to the right). Tooltip side logic is physical. | SVG coordinates are physical by design. |

New 3D components use logical properties throughout (margin-inline, padding-inline, inset-inline, text-align: start), so in-flow parts mirror; their overlays share finding 5.

## Proposed plan (v0.2, needs owner sign-off)
1. ULAnchoredSurface: copy `dir` (closest [dir]) from the anchor with theme / accent / backdrop; placement maps start / end to physical sides from dir; submenu "beside" = inline-end. One change in the shared surface fixes menus, selects, popovers, hover cards, dialogs, toasts.
2. Keyboard: one helper `inlineKey(e, dir)` that swaps ArrowLeft / ArrowRight for roving lists (tabs, segmented, toggle group, menubar, navigation menu, carousel, resizable, calendar); used by every roving component.
3. Icons: `data-ul-mirror` on directional ULIcons (chevrons, arrows, back) → `scale: -1 1` under [dir="rtl"].
4. Fields: floating label and affixes on logical properties; URL / code affixes wrapped in <bdi dir="ltr">.
5. Table / numeric: `text-align: end` for numeric cells.
6. Toasts: position tokens as inline-start / inline-end.
7. Charts: decide per product whether time axes mirror (Arabic / Hebrew dashboards usually keep LTR time); the shared chart core would read dir once.
8. Lens / indicator motion: verify the lens springs with mirrored geometry (no locked timing changes expected; coordinates only).

## Decision
No safe trivial fix was made in shared CSS: every finding above sits in overlay placement, keyboard handling or field layout, which are frozen or need the plan above. RTL is declared unsupported in v0.1 (DESIGN.md).
