# Phase 0 — Discovery & Audit Baseline

Date: 2026-05-07
Source: 4 parallel audits (tech / UX critique / performance / decomposition).

---

## Executive Summary

**Codebase health:** strong foundations — solid theme tokens, consistent primitives, sensible offline orchestration, near-zero `any` usage.

**Critical blockers for UX overhaul:**
1. `ProjectDetailScreen.tsx` = 1625 LOC + ~40 `useState` + cross-tab side effects (`setActiveTab` called inside hooks). Cannot migrate to React Navigation cleanly until state is extracted to context.
2. Sync side-effects + timers (auto-transcription, AppState listeners) are owned by the host screen — will leak across navigation if naively split.
3. List rendering uses `.map()` inside ScrollView for defects/markers (O(n²) re-paints). Must convert to FlatList before any pixel-level polish.

**UX baseline scores (0–100):** Visual hierarchy 68 / IA 55 / Cognitive load 48 / Consistency 52 / Tablet-readiness 45 — **Overall ~54**.

**Phase order adjustment:** swap 2A ↔ 2B. State extraction (was 2B) must complete before navigation migration (was 2A). New order below.

---

## Cross-Cutting Themes

| Theme | Severity | Finding |
|-------|----------|---------|
| **Monolith** | P0 | ProjectDetailScreen 1625 LOC + 40 useState; useDefectActions 1004 LOC; useVoiceActions 527 LOC. |
| **Cross-tab coupling** | P0 | Hooks call `setActiveTab('capture')` directly; replace with navigation/context. |
| **Image strategy** | P0 | No expo-image, no caching, no thumbnails. Plans + photos hit memory hard on Android tablets. |
| **List virtualization** | P0 | Defect/marker lists rendered via `.map()` inside ScrollView. Must move to FlatList. |
| **Feedback fragmentation** | P0 | 4 channels (Banner / setNotice / errorText / Alert.alert). Need single toast+banner system. |
| **Broken umlauts in Alerts** | P0 | "loeschen" instead of "löschen" inside `Alert.alert` calls — visible UX bug. |
| **No tablet master-detail** | P1 | List+Detail full-screen swap on 12.9" tablet wastes ~50% canvas. |
| **Sync status buried** | P1 | 7 states packed into header subtitle — killer feature invisible. |
| **No form validation lib** | P1 | Ad-hoc booleans; zod approved → centralize per-form schemas. |
| **A11y gaps** | P1 | Input lacks accessibilityLabel binding; Text has no font-scaling cap; no focus management on Sheet. |
| **Hex color leaks** | P2 | `#ffffff` in PlansTab + VoiceInput. Add `colors.alwaysWhite` token. |
| **Cognitive overload Capture** | P1 | Form + photo grid + voice + plan picker + marker queue all visible at once. |
| **Cold start gates** | P1 | ThemeProvider hydration + auth restore = 2 serial async gates before first paint. |

---

## Prioritized P0 — Blockers

| ID | Issue | File | Fix direction |
|----|-------|------|---------------|
| P0-1 | 1625 LOC god-component | `src/features/projects/detail/ProjectDetailScreen.tsx` | Extract `ProjectDetailDataContext`, `ProjectStatusContext`, `VoiceRecorderContext`, `CaptureSessionContext`. Keep only host shell + tab nav. |
| P0-2 | 5 raw `Alert.alert` with broken umlauts | `EntriesTab.tsx:187,198,205`, `ProjectDetailScreen.tsx:1232`, `App.tsx:308` | Themed `ConfirmSheet` component. Restore `ö/ü/ß`. |
| P0-3 | Cross-tab `setActiveTab` from inside hooks | `useDefectActions.ts`, `useVoiceActions.ts` | Replace with `navigation.navigate(...)` after Phase 2A. |
| P0-4 | List rendered via `.map()` inside ScrollView | `EntriesTab.tsx:241`, `PlansTab.tsx:141,540,689,709` | Convert to FlatList; outer Screen `scroll={false}`. |
| P0-5 | No `expo-image` / no thumbnail pipeline | `PlansTab.tsx:535,575`, `components.tsx:542`, `CaptureTab.tsx:412` | Adopt `expo-image` with `cachePolicy="memory-disk"` + server thumbnails. |
| P0-6 | `isNetworkError` reimplemented in 5 files | various | Hoist to `lib/api/errors.ts`. |
| P0-7 | `clientOperationId`/`createClientId` reimplemented | `useDefectActions:93`, `useMediaActions:44` | Single source: `offlineStore.createClientId`. |
| P0-8 | useDefectActions 1004 LOC cross-cuts capture/entries/plans | `useDefectActions.ts` | Split into `useCreateDefect`, `useUpdateDefect`, `useDefectMedia`, `useOutboxRetry`. |

---

## Prioritized P1 — High

| ID | Issue | File | Fix direction |
|----|-------|------|---------------|
| P1-1 | Manual `'list'\|'create'\|'detail'` state machine | `App.tsx` | React Navigation Stack + Tabs after P0-1/3 done. |
| P1-2 | No tablet master-detail at width≥900 | `App.tsx`, `ProjectListScreen` | Split-view: list left, detail right. |
| P1-3 | Sync status buried in header subtitle | `App.tsx:335` | Persistent pill badge in `AppHeader.trailing`. |
| P1-4 | Detail tab order Übersicht-first | `WorkspaceTabs` | Reorder: Erfassen / Pläne / Einträge / Bericht / Übersicht. |
| P1-5 | Capture tab cognitive overload | `CaptureTab.tsx` | Progressive disclosure: 3-button capture bar (text/voice/photo) → expand on selection. |
| P1-6 | Inline `renderItem` + missing memo | `ProjectListScreen.tsx:151` | `useCallback` + `React.memo(ProjectCardItem)` + `getItemLayout`. |
| P1-7 | ScrollView wrapping all 5 tabs | `ProjectDetailScreen.tsx:1397` | After 2A: each tab is its own route → no global ScrollView. |
| P1-8 | Auto-transcription timers leak | `ProjectDetailScreen.tsx:233` | Move into `useVoiceActions` with project-exit cleanup. |
| P1-9 | `loadProjects('refresh')` blocks UI after every sync | `App.tsx:236-256` | Stale-while-revalidate; skip `refreshing=true` if cache <30s. |
| P1-10 | Image.getSize per render | `PlansTab.tsx:380` | Cache by `media_asset.id`; prefer API width/height. |
| P1-11 | Input has no accessibilityLabel binding | `Input.tsx` | Pipe `accessibilityLabel`/`accessibilityHint` onto TextInput; live region on errorText. |
| P1-12 | Text has no `maxFontSizeMultiplier` | `Text.tsx` | Cap at 1.4. |
| P1-13 | No form validation library | `package.json` | Add `zod` (+ `react-hook-form` optional); per-form schema files. |
| P1-14 | Outbox-append fallback duplicated 12× | hooks | Extract `withOutboxFallback(op, outboxFactory)`. |
| P1-15 | `PlanMarkerCanvas` not memoized; gestures rebuilt every render | `PlansTab.tsx:436-463` | `useMemo` `Gesture.Simultaneous` keyed by stable deps. |
| P1-16 | `entryEditDraft` overwritten on `selectedDefect` ref change (eats typing) | `EntriesTab.tsx:153` | Track by `selectedDefect.id` only. |
| P1-17 | EmptyState copy too marketing-y | `ProjectListScreen.tsx` | Action-led, du-form, construction-trade vocab. |
| P1-18 | Tab labels mix nominal + verbal register | `WorkspaceTabs` | Pick nominal: "Erfassung", "Pläne", "Einträge", "Bericht", "Übersicht". |
| P1-19 | Server URL exposed to end users | `LoginScreen` (AuthScreens.tsx:131) | Hide `Server: {config.apiUrl}` (dev-only flag). |
| P1-20 | ThemeProvider gates first paint on hydration | `ThemeProvider.tsx:85` | Render with default theme; reconcile when stored mode arrives. |

---

## Prioritized P2 — Medium

- Hardcoded `#ffffff` (PlansTab + VoiceInput) → `colors.alwaysWhite`.
- Inline magic spacing (Input minHeight 120, Button height 44, bottomTabHeight 72) → layout tokens.
- Filter sheet `Anwenden` button is a no-op → drop, auto-apply, rename reset.
- AppHeader only used on list screen → unify across all screens.
- `getAllAsync` not batched in `refreshTransferCounts` → batch.
- Snapshot pull rewrites multi-MB JSON every cycle → incremental + per-collection upserts.
- Picker quality 0.85 with no resize → 0.7 + `expo-image-manipulator` to 2048px long edge.
- `defectPayloadFromOutbox` hand-rolled guards → zod schema.
- `entryTradeFilter: string | 'all'` weak type → discriminated union.
- `setVoiceDrafts` setter leaked to child → callback API.
- `OverflowMenu` and `Card` missing `accessibilityHint`.
- `Sheet` missing `accessibilityViewIsModal` + autofocus.

---

## Prioritized P3 — Trivial

- Empty CTA + FAB both say "Neues Projekt" (redundant when list empty).
- `letterSpacing:1`+`textTransform:'uppercase'` inline → `eyebrow` typography variant.
- `fontFamily` tokens all `undefined` — wire or delete.
- Lucide icon imports — already named, fine on Hermes.
- `Disclosure` body mounts/unmounts JS-side; minor expand hitch on heavy bodies.

---

## Top 10 Highest-Impact Wins

1. **Extract ProjectDetail state into 4 contexts** → unblocks everything else.
2. **Convert `.map()` lists to FlatList + memoize row components** → eliminates per-keystroke re-render storms.
3. **Adopt `expo-image` + server thumbnails** → biggest perceived-perf + memory win on Android tablets.
4. **Themed ConfirmSheet replaces 5 Alert.alert calls + restores umlauts** → instant consistency win.
5. **Migrate to React Navigation** (after #1) → typed routes, deep links, focus mgmt, master-detail.
6. **Tablet split-view at width≥900** → unlocks the primary device.
7. **Single feedback system: Toast + Banner + Sync pill** → replaces 4 fragmented channels.
8. **Reorder detail tabs, default to Erfassen** → matches actual user loop.
9. **Capture tab progressive disclosure** → ends cognitive overload on hottest screen.
10. **zod + per-form schemas + accessible Input** → form quality bar across app.

---

## Phase Order Adjustment (locked plan v3)

```
0 Audit ✅
1 Shape design brief
2A State extraction + monolith decomposition (was 2B)
2B React Navigation migration (was 2A) — depends on 2A
3 Design system upgrade
4 Per-screen polish (8 screens)
5 Motion & delight
6 Adapt + final polish + sign-off
```

**Why swapped:** code-reviewer flagged hard block — `setActiveTab` called from inside hooks, timer/state ownership tied to host. Migrating routes first would propagate the coupling into Navigation prop-drilling.

---

## Files Surfaced for Active Tracking

- `App.tsx`
- `src/features/projects/detail/ProjectDetailScreen.tsx`
- `src/features/projects/detail/useDefectActions.ts`
- `src/features/projects/detail/useVoiceActions.ts`
- `src/features/projects/detail/PlansTab.tsx`
- `src/features/projects/detail/EntriesTab.tsx`
- `src/features/projects/detail/CaptureTab.tsx`
- `src/features/projects/detail/components.tsx`
- `src/features/projects/ProjectListScreen.tsx`
- `src/components/Input.tsx`
- `src/components/Text.tsx`
- `src/components/VoiceInput.tsx`
- `src/components/Sheet.tsx`
- `src/lib/sync.ts`
- `src/lib/offlineStore.ts`
- `src/theme/ThemeProvider.tsx`
