# Phase 3 — Design System Upgrade (DONE)

Date: 2026-05-08
Status: ✅ shipped to main, ready for Phase 4 consumption.

## Delivered

### Tokens
- **Type pair**: Saira (display, semibold + bold) + Atkinson Hyperlegible (body, regular + bold), loaded via `@expo-google-fonts` + `expo-font`. Gated by `useAppFonts()` in `App.tsx`.
- **Typography variants**: existing 13 + new `eyebrow` variant (uppercase, letterSpacing 1).
- **Severity ramp** (5 levels × light + dark): info / low / medium / high / critical with matching `*Soft` background tints.
- **alwaysWhite token**: replaces hardcoded `#ffffff` in PlansTab + VoiceInput.

### Primitives (new)
| Component | Purpose |
|-----------|---------|
| `ConfirmSheet` + `useConfirm()` | Imperative `confirm({title, message, destructive})` returning `Promise<boolean>`. Replaces 4 raw `Alert.alert` destructive confirmations. |
| `SeverityBadge` | Severity 5-level pill, **double-encoded** (icon shape + hue) for colorblind + B/W print legibility. |
| `Toast` + `ToastProvider` + `useToast()` | Top-of-screen stack, 4 tones, optional action button, auto-dismiss. Replaces last `Alert.alert` (App.tsx logout cleanup). |
| `SyncStatusPill` | 6-state pill (idle/syncing/pending/errors/offline/synced) with icon + tone. Replaces 7-state buried `listSubtitle` text. |
| `DataState<T>` | Unified loading/error/empty/success branching with skeleton or block fallback. |
| `FormField` + `useZodField` | Single-field zod-driven state machine bound to `Input.errorText`. Validates on blur. |

### Dev tooling
- **`StorybookScreen`** — gallery rendering every primitive in all states. Gated by `__DEV__` via "Dev" button in projects list header.

## Audit fixes locked

| ID | Issue | Resolution |
|----|-------|------------|
| P0-2 | 5 raw `Alert.alert` with broken umlauts | All 5 replaced (4 ConfirmSheet, 1 Toast). Umlauts restored everywhere. |
| P1-3 | Sync status buried in subtitle | `SyncStatusPill` in header trailing slot. |
| P2 | `#ffffff` hardcoded (PlansTab + VoiceInput) | `theme.colors.alwaysWhite`. |
| P3 | Eyebrow typography missing | New variant. |
| P3 | `fontFamily` tokens all `undefined` | Wired to Saira + Atkinson Hyperlegible. |

## Commits (13 total this overhaul)

Phase 3 portion:
- `feat(theme): wire Saira+Atkinson Hyperlegible, severity ramp, alwaysWhite`
- `refactor(theme): replace hardcoded #ffffff with theme.colors.alwaysWhite`
- `feat(components): add ConfirmSheet, replace 4 Alert.alert with confirm()`
- `feat(components): add SeverityBadge + Toast primitives`
- `feat(components): add SyncStatusPill, replace buried sync subtitle`
- `feat(components): add DataState wrapper + FormField with zod`
- `feat(dev): add Storybook gallery screen, gated by __DEV__`

## Open follow-ups (not blocking Phase 4)

- **App.tsx logout** still uses warning toast — could become success on clean wipe. Cosmetic.
- **SyncStatusPill detail sheet** — currently emits toast on tap. Phase 4 should add bottom-sheet showing pending items + last-sync timestamp + retry CTA.
- **`useZodForm`** full-form helper not built. `FormField` + `useZodField` covers per-field; submit-time aggregation done manually for now. Build helper when first 3-field form is rewritten in Phase 4.
- **Brand accent oklch refinement**: current `#1F4FB6` slightly more saturated than the .impeccable.md hypothesis. Acceptable. Refine after Phase 4 visual review.

## Hand-off to Phase 4

All Phase 4 per-screen polish work can now consume:
- New typography (Saira + Atkinson Hyperlegible apply automatically via existing `<Text variant="...">`)
- `SeverityBadge` for defect priority rendering
- `Toast` for save/sync feedback (replace `setNotice` calls)
- `DataState` for unifying screen-level branches
- `FormField` + `useZodField` for forms (LoginScreen, ProjectCreateScreen, defect form, report email)
- `SyncStatusPill` for any header surface needing trust signal

Phase 4 screens ranked by user-loop priority:
1. CaptureTab (hottest)
2. OverviewTab
3. EntriesTab
4. PlansTab
5. ReportTab
6. ProjectListScreen
7. ProjectCreateScreen
8. Login + PasswordRecovery

Phase 2A Steps 7–12 remain blocked on test net. Phase 4 can proceed independently.
