# Phase 2A — State Extraction Blueprint

Authored by the **architect** agent based on full read of ProjectDetailScreen + 5 hook files.

> Original output preserved verbatim below. Source of truth for Phase 2A migration.

---

# State Extraction Blueprint — `ProjectDetailScreen`

Target tree: `/Users/maxbudde/baudoku_app/baudoku_expo/src/features/projects/detail/`
Scope: extract four contexts, hoist primitives, split `useDefectActions`, eliminate cross-tab `setActiveTab` calls.
Out of scope: React Query, zod schemas, React Navigation migration (Phase 2B executes after this blueprint completes).
Constraint: every emitted file ≤ 400 LOC, immutable updates only, offline-first SQLite + outbox semantics preserved 1:1.

## Naming & Layout

```
src/lib/api/
  errors.ts                              [NEW]   isNetworkError, isRetryableNetworkError, isAiUnavailableError

src/features/projects/detail/
  contexts/
    ProjectStatusContext.tsx             [NEW]   busy/error/notice + helpers
    ProjectDetailDataContext.tsx         [NEW]   collections + outbox + pendingMedia + loadDetail
    VoiceRecorderContext.tsx             [NEW]   recorder + transcript drafts + auto-transcription
    CaptureSessionContext.tsx            [NEW]   capture drafts + marker queue + selectedDefectId
    TabRouterContext.tsx                 [NEW]   transitional shim — replaces setActiveTab in hooks
  hooks/
    useProjectDetailLoader.ts            [NEW]
    useAutoTranscription.ts              [NEW]
    useCaptureDraftPersistence.ts        [NEW]
    useDefectActions/
      index.ts                           [REPLACES] facade ≤120 LOC
      useCreateDefect.ts                 [NEW]
      useUpdateDefect.ts                 [NEW]
      useDefectMedia.ts                  [NEW]
      useOutboxRetry.ts                  [NEW]
      shared/
        defectOptimistic.ts              [NEW]   pendingDefectFromPayload, withPendingPhotoLinks…
        outboxAttachments.ts             [NEW]   queuePhotoAttachment, queueVoiceAttachment…
        outboxDefectMutations.ts         [NEW]   defectPayloadFromOutbox, updatePendingDefectOutbox
  ProjectDetailScreen.tsx                [SHRINKS] target ≤350 LOC: shell + provider tree only
```

## Provider Tree (mounted inside ProjectDetailScreen body)

```
<ProjectStatusProvider>                        (1) no deps
  <ProjectDetailDataProvider                   (2) needs status
       project session networkOnline autoSyncing onProjectChanged>
    <TabRouterProvider initialTab="overview">  (3) leaf-independent
      <VoiceRecorderProvider>                  (4) needs Data, Status, TabRouter
        <CaptureSessionProvider>               (5) needs Data, Voice, Status, TabRouter
          <ProjectDetailShell />               (6) consumes everything
        </CaptureSessionProvider>
      </VoiceRecorderProvider>
    </TabRouterProvider>
  </ProjectDetailDataProvider>
</ProjectStatusProvider>
```

## 16 Atomic Migration Steps

Each step compiles, passes tests, preserves behavior, is independently revertable.

| # | Step | Risk | Test gate |
|---|------|------|-----------|
| 1 | Hoist `isNetworkError` to `lib/api/errors.ts` (5 dupes → 1) | none | none |
| 2 | Replace local `clientOperationId/createClientId` (2 dupes → 1) | low (verify backend accepts new format) | outbox roundtrip lock |
| 3 | Add `ProjectStatusContext`, leave screen state in place (provider unused) | none | none |
| 4 | Migrate hooks to consume `useProjectStatus()` (drop prop bag) | low | hooks integration |
| 5 | Add `TabRouterContext`; route screen `setActiveTab` through it | none | none |
| 6 | Migrate hook `setActiveTab` calls to `tabRouter.navigateToTab()` | low | regression for cross-tab calls |
| 7 | Add `ProjectDetailDataProvider` (collections + outbox), screen still owns state | none | snapshot of derived selectors |
| 8 | Move `loadDetail` into `useProjectDetailLoader` inside Data provider | medium | full loader test (4 scenarios) |
| 9 | Migrate hooks to consume `useProjectDetailData()` | low | hooks integration |
| 10 | **Add `VoiceRecorderProvider` + `useAutoTranscription` (timer cleanup fix)** | HIGHEST | timer state machine + project-exit cleanup |
| 11 | Add `CaptureSessionProvider` + `useCaptureDraftPersistence`; `saveCaptureDrafts` returns `{savedDefectIds}` instead of calling `setActiveTab` | HIGH | capture-to-tab-router contract test |
| 12 | Split `useDefectActions` into 4 hooks + 3 shared modules | HIGH | offlineOutboxRoundtrip |
| 13 | Remove screen-level `setActiveTab` calls at lines 1035, 1223 | low | none |
| 14 | Move `defectPayloadFromOutbox` to `shared/outboxDefectMutations.ts` | none | selector test |
| 15 | Final screen slim-down + verify ≤400 LOC per file | none | `wc -l` check |
| 16 | Sanity sweep (grep for stray duplicates) | none | none |

## Critical Behavior Changes (intentional)

1. **`saveCaptureDrafts` no longer calls `setActiveTab`** — it returns `{savedDefectIds}`. Caller decides navigation. Structural fix for P0-3.
2. **Auto-transcription timers cleaned up on `projectId` change AND on provider unmount** — currently only cleaned via screen useEffect. Fix for P1-8.
3. **All hooks read from contexts, not prop bags** — facade pattern in `useDefectActions/index.ts` preserves existing destructure shape during migration.

## Open Questions

1. CI has `@testing-library/react-native`? If not, install is **Step 0**.
2. `selectedDefectId` lives in CaptureSessionContext; EntriesTab + PlansTab read/write through it.
3. `mediaCaptionDrafts` straddles EntriesTab + loader cache reset → defer to Phase 3 follow-up.

## Invariants Preserved

- Outbox semantics 1:1 (every `appendOutbox`/`writeOutbox`/`deleteOutboxItem` call site moves verbatim)
- Pending-media lifecycle 1:1
- Optimistic shadow ID format: `pending-defect:<clientId>`, `pending:<clientId>`, etc.
- Auto-transcription back-off: `[15s, 60s, 180s]`, max 4 attempts
