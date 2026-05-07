# Phase 2A — Refactor Safety Net (Test Plan)

Authored by **tdd-guide** agent. Goal: lock current behavior at every offline/sync/voice/capture seam BEFORE the context split lands. ~115 tests across ~3.5 dev-days.

> Original output preserved verbatim below.

---

## Strategy

- **Stay vitest-only for Phase 2A.** Defer `@testing-library/react-native` install to a focused PR; not a refactor blocker.
- **Extract pure logic FIRST**, lock with vitest, then refactor contexts. 80% of safety net value comes from this.
- **Component-level effect tests deferred** (P2 — needs RNTL).

## P0 Surfaces (must be green before Phase 2A Step 7)

| Surface | Covers | Tests |
|---------|--------|-------|
| `outbox-store-contract` | `offlineStore.ts` outbox CRUD | 10 |
| `outbox-payload-guards` | extract from `sync.ts` private helpers | 12 |
| `outbox-merge-selectors` | `pendingDefectsFromOutbox`, `plansWithPendingMarkers` (extract from screen useMemo) | 18 |
| `capture-draft-persistence` | `readCaptureDrafts`/`writeCaptureDrafts`/`deleteCaptureDraft` | 9 |
| `auto-transcription-reducer` | extract reducer + classifiers + delay constants from screen | 16 |

## P1 Surfaces

| Surface | Covers | Tests |
|---------|--------|-------|
| `defect-action-fallback` | extract pure helpers from `useDefectActions.ts` | 12 |
| `pending-media-lifecycle` | `cacheAssetForOffline`, `upsertPendingMedia`, `markPendingMediaLinked` | 12 |
| `sync-orchestration` | `syncOfflineQueues`, `applyLocalDefectMediaOperation`, `waitingForNetwork` | 11 |
| `offline-data-reset` | `clearOfflineData` (logout) | 3 |

## P2 Deferred (needs RNTL)

- Network/AppState reload effects in screen
- Project-id reset effect
- Capture-draft hydration → write race

## Files to Create

```
lib/outboxPayload.ts                                 ~30 LOC
lib/__tests__/helpers/sqliteMock.ts                  ~120 LOC
lib/__tests__/helpers/fsMock.ts                       ~70 LOC
lib/__tests__/outboxPayload.test.ts                   ~80 LOC (12 tests)
lib/__tests__/offlineStore.outbox.test.ts            ~140 LOC (10 tests)
lib/__tests__/offlineStore.pendingMedia.test.ts      ~180 LOC (12 tests)
lib/__tests__/offlineStore.captureDrafts.test.ts     ~140 LOC (9 tests)
lib/__tests__/offlineStore.reset.test.ts              ~50 LOC (3 tests)
lib/__tests__/sync.orchestration.test.ts             ~250 LOC (11 tests)
lib/__tests__/sync.uploadQueuedMedia.test.ts          ~90 LOC (5 tests)
features/projects/detail/outboxSelectors.ts          ~150 LOC
features/projects/detail/__tests__/outboxSelectors.test.ts  ~220 LOC (18 tests)
features/projects/detail/captureDraftIO.ts            ~60 LOC
features/projects/detail/__tests__/captureDraftIO.test.ts   ~90 LOC (7 tests)
features/projects/detail/autoTranscription.ts        ~110 LOC
features/projects/detail/__tests__/autoTranscription.test.ts ~180 LOC (16 tests)
features/projects/detail/__tests__/defectActions.helpers.test.ts ~160 LOC (12 tests)
```

**Totals:** ~350 LOC extractions, ~1670 LOC tests, **~115 tests**.

## Mock Strategy

| Module | Mock approach |
|--------|---------------|
| `expo-sqlite` | `better-sqlite3` (devDep) for real SQL semantics in shared `sqliteMock.ts` |
| `expo-file-system` | hand-rolled in-memory map: tracks files, supports `.copy/.text/.exists/.create/.delete` |
| `@react-native-community/netinfo` | drive `networkOnline` as prop (deferred to RNTL phase) |
| `expo-audio` | tiny fake `useAudioRecorder`/`useAudioRecorderState` |
| `AppState` | capture listener for `'active'`/`'background'` events (deferred) |
| `fetch` / API modules | `vi.mock` at module boundary |

## Refactor Gate (Definition of Done)

Each architect-blueprint step may merge ONLY if its required tests are green:

| Phase 2A step | Required green tests |
|---------------|---------------------|
| Steps 1–6 (low-risk hoists) | existing tests + `outbox-payload-guards` |
| Step 7 (Data provider) | `outbox-store-contract` + `outbox-merge-selectors` |
| Step 8 (loader extraction) | + `sync-orchestration` + `pending-media-lifecycle` |
| Step 10 (VoiceRecorder + AutoTranscription) | + `auto-transcription-reducer` |
| Step 11 (CaptureSession) | + `capture-draft-persistence` + capture-to-tab-router contract |
| Step 12 (split useDefectActions) | + `defect-action-fallback` |

## Sequencing (3.5 dev-days)

| Day | Work |
|-----|------|
| 1.0 | Build sqliteMock + fsMock helpers; write offlineStore.*.test.ts suite (P0 storage lock) |
| 1.5 | Extract outboxPayload.ts + autoTranscription.ts; write their tests |
| 2.0 | Extract outboxSelectors.ts + captureDraftIO.ts; write contract tests against snapshot |
| 2.5 | Write sync.orchestration.test.ts + defectActions.helpers.test.ts |
| 3.0 | Coverage gate ≥80%; hand off to architect for migration steps |

## Critical Lock-First Tests

Before ANY context extraction:

1. **Cross-tab `setActiveTab` regression test** — currently asserts the call IS made; refactor PR flips assertion + removes the call. Locks current behavior + documents the deliberate break.
2. **`pendingDefectsFromOutbox` snapshot test** — table-driven fixture against today's inline `useMemo` output. Refactor must return identical array.
3. **`captureDraftToSnapshot` round-trip** — status normalization (`saving|saved → draft`) is a quirky behavior; lock it.
