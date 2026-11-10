# shadcn/ui coverage (Task 3C, updated 3D)
Reference list only (component names and composition patterns). No shadcn source, no Radix, no Tailwind. Status: stable = built, documented and covered by tests / guard cards; draft = built, API may still change; missing = not in the library. Items marked draft were built in Task 3C (frame-independent test cards + layout guards pass; API may still change before v0.1). "3D" = proposed for the next task.

| shadcn/ui | UL equivalent | status | notes |
|---|---|---|---|
| Accordion | ULAccordion | stable | |
| Alert | ULAlert | draft | In-flow tinted paint, tones shared with ULBanner (page-level, dismissible queue = ULBannerQueue). |
| Alert Dialog | ULAlertDialog | draft | Confirm on the dialog context (covered). Popover variant reuses ULPopover; type-to-confirm reuses ULConfirmAction. |
| Aspect Ratio | ULAspectRatio | draft | 3D: CSS aspect-ratio wrapper, no JS, object-fit for media, ULSkeleton variant. Card f3d_aspect. |
| Avatar | ULAvatar, ULAvatarGroup | stable | |
| Badge | ULBadge, ULStatusPill, ULStatusDot | stable | |
| Breadcrumb | ULBreadcrumbs | stable | Embedded variant used by the treemap drill-in. |
| Button | ULButton, ULActionButton, ULSubmitButton | stable | Async states through the one action core. |
| Button Group | ULButtonGroup, ULSplitButton, ULToolbar | stable | |
| Calendar | ULCalendar (on CalendarGrid) | draft | 3D: inline single / multiple / range, month + year jump, min / max, disabled, EN/SK/DE/CS, picker keyboard, flat paint, range band via the shared Bands. Card f3d_calendar. |
| Card | ULCard, ULPanel | stable | |
| Carousel | ULCarousel | draft | 3D: native scroll-snap, mouse drag snaps, touch native, prev / next, indicators on the shared nav indicator, keys, loop, autoplay off by default (pause control, pause on hover / focus, never under reduced motion), region + slide groups, polite status only when not autoplaying. Card f3d_carousel. |
| Chart | ULLineChart … ULStreamChart (src/charts) | stable | 18 types on one core. |
| Checkbox | ULCheckbox | stable | |
| Collapsible | ULCollapsible | draft | Measured height morph, never to auto. |
| Combobox | ULCombobox, ULTagField | stable | |
| Command | ULCommandPalette | stable | Covered overlay. |
| Context Menu | ULContextMenu, ULContextTarget, useContextMenuTarget | stable | |
| Data Table | ULTable + ULFilterBar, ULColumnsMenu, ULBulkActionBar, cells | stable | Columns drag reorder still in backlog. |
| Date Picker | ULDatePicker, ULDateRangePicker, ULTimeRange | stable | |
| Dialog | ULModal (ULDialogSurface, useDialog push / replace / pop) | stable | |
| Direction | missing | — | No RTL support anywhere (logical properties partly used). 3D: decide scope (locales are EN/SK/DE/CS, all LTR). |
| Drawer | ULDrawer, ULSheet (mobile bottom sheet with drag) | stable | |
| Dropdown Menu | ULMenu, ULMenuButton | stable | Nested menus beside the parent. |
| Empty | ULEmptyState | stable | |
| Field | ULField, ULFieldGroup, ULFieldSet, ULFieldError | draft | Existing ULTextField / ULNumberField / ULSelect keep their own label; ULField wraps any control. |
| Hover Card | ULHoverCard | draft | 3D: ULPopover (above, scroll follow) on hover / focus-visible with intent delays, hover bridge, one per group, contextMenu on the trigger. Supplementary content only. Card f3d_hovercard. |
| Input | ULTextField, ULNumberField, ULCopyField | stable | |
| Input Group | ULInputGroup | draft | One inset well, addons, inline buttons, counter, clear. |
| Input OTP | ULOtpField | stable | |
| Item | ULItem | draft | Flat rows, contextMenu prop. |
| Kbd | ULKbd | draft | Platform-aware Mod key. |
| Label | ULLabel | draft | |
| Menubar | ULMenubar | draft | 3D: flat bar + shared nav indicator, one ULMenu per trigger (submenus 2px, drill-in, ULCheckMark, ULKbd shortcuts), roving keys, switch on hover / arrows while open (close + open, no re-anchor API). Card f3d_menubar. |
| Native Select | ULNativeSelect, ULSelect native="mobile" | draft | 3D: real <select> in the ULSelect field well, ULIcon arrow, optgroups, disabled, invalid; ULSelect switches to it on coarse pointers. Card f3d_nativeselect. |
| Navigation Menu | ULNavigationMenu (+ ULIsland site header) | draft | 3D: <nav> + list, shared indicator (rests on aria-current / open trigger), panels = one anchored surface with runViewSwap between panels, ULItem link grid; < collapseBelow (640) a Menu button + bottom sheet with dialog drill-in. Header megamenu not extracted (debt in DESIGN). Card f3d_navmenu. |
| Pagination | ULPagination | stable | |
| Popover | ULPopover | stable | |
| Progress | ULProgress, ULUsageMeter, ULStepper | stable | |
| Radio Group | ULRadioGroup, ULRadio | stable | |
| Resizable | ULResizablePanelGroup, ULResizablePanel, ULResizableHandle | draft | 3D: %, min / max, collapsible, nested, keyboard (1 / 10 %, Home End, Enter), role separator + aria values, double-click reset, onLayout, storageKey, stackBelow; flat handle; sizes = CSS variables once per frame. Card f3d_resizable. |
| Scroll Area | ULScrollArea | draft | Native scrolling, flat thumb overlay. |
| Select | ULSelect | stable | |
| Separator | ULSeparator | draft | |
| Sheet | ULSheet, ULDrawer | stable | |
| Sidebar | ULSidebar | stable | |
| Skeleton | ULSkeleton, ChartSkeleton | stable | |
| Slider | ULSlider, ULRangeSlider | stable | |
| Sonner (toasts) | ULToast, ULToastProvider, useToast, ULUndoToast | stable | Top layer above modals. |
| Spinner | ULSpinner | stable | |
| Switch | ULSwitch | stable | |
| Table | ULTable, ULDescriptionList, ULKeyValue | stable | |
| Tabs | ULTabs | stable | |
| Textarea | ULTextArea | stable | |
| Toast | ULToast (same as Sonner) | stable | |
| Toggle | ULToggleButton, ULToggleIconButton | stable | Spam-prone toggles coalesced. |
| Toggle Group | ULToggleGroup | draft | Shared lens / indicator; ULSegmentedControl stays the single-select capsule. |
| Tooltip | ULTooltip, createAnchoredTooltip | stable | |
| Typography | ULHeading, ULText, ULCode, ULBlockquote, ULList, ULLink, ULProse | draft | 3D: --ul-type-* fluid scale (clamp), level ≠ size, truncate / clamp, tabular, safe links (rel / target / external icon), prose wrapper. Card f3d_typography. |

Out of scope: Attachment, Bubble, Marker, Message, Message Scroller (chat).

## 3D result
Built: Hover Card, Menubar, Navigation Menu, Native Select, Calendar, Aspect Ratio, Resizable, Carousel, Typography. Direction (RTL): audited, not supported in v0.1 (docs/rtl-audit.md).
| Direction | — | unsupported (v0.1) | Audit + plan in docs/rtl-audit.md. |
