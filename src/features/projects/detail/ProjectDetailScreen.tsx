import type { Session } from '@supabase/supabase-js';
import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, View } from 'react-native';

import {
  AppHeader,
  Banner,
  Disclosure,
  LoadingBlock,
  OverflowMenu,
  ProjectStatusBadge,
  Screen,
  Surface,
  Text,
  VStack,
} from '../../../components';
import { DetailRow } from '../../../components/ui';
import { ProjectEditPanel } from '../ProjectEditPanel';
import { normalizeSearchText, profileById, profileLabel } from '../helpers';
import { CaptureTab } from './CaptureTab';
import { WorkspaceTabs } from './components';
import { ProjectStatusProvider } from './contexts/ProjectStatusContext';
import { TabRouterProvider } from './contexts/TabRouterContext';
import { EntriesTab } from './EntriesTab';
import { OverviewTab } from './OverviewTab';
import { PlansTab } from './PlansTab';
import { ReportTab } from './ReportTab';
import { initialDefectForm, nextDefectLocalLabel, nextDefectLocalLabelFromLabels, sortGeneralFindings } from './helpers';
import { VOICE_TRANSCRIPT_PENDING_DESCRIPTION } from './transcripts';
import type { CaptureEntryDraft, DefectFormState, WorkspaceTab } from './types';
import { useDefectActions } from './useDefectActions';
import { useMediaActions } from './useMediaActions';
import { usePlanActions } from './usePlanActions';
import { useReportActions } from './useReportActions';
import { useVoiceActions } from './useVoiceActions';
import {
  ApiError,
  conclusionsApi,
  defectsApi,
  generalFindingsApi,
  plansApi,
  projectsApi,
  reportsApi,
  voiceNotesApi,
} from '../../../lib/api';
import { isNetworkError, isRetryableNetworkError } from '../../../lib/api/errors';
import { formatDate, formatDateTime, getProjectTitle } from '../../../lib/formatters';
import {
  appendOutbox,
  cacheAssetForOffline,
  createClientId,
  deletePendingMedia,
  readCaptureDrafts,
  readCachedProjectDetail,
  type PendingMediaItem,
  readOutbox,
  readPendingMedia,
  readPendingMediaByClientId,
  type OutboxItem,
  upsertPendingMedia,
  writeCaptureDrafts,
} from '../../../lib/offlineStore';
import type { UploadableAsset } from '../../../lib/uploadProjectFile';
import { useTheme } from '../../../theme';
import type {
  Defect,
  DefectKind,
  GeneralFinding,
  MediaAsset,
  PlanFile,
  Profile,
  Project,
  ProjectConclusion,
  ProjectUpdateInput,
  ReportPreview,
  ReportVersion,
  Trade,
  VoiceNote,
} from '../../../types/projects';

const AUTO_TRANSCRIPTION_MAX_ATTEMPTS = 4;
const AUTO_TRANSCRIPTION_RECHECK_DELAYS_MS = [15000, 60000, 180000] as const;

type AutoTranscriptionState = {
  attempts: number;
  inFlight: boolean;
};

const isAutoTranscriptionCandidate = (voiceNote: VoiceNote) => {
  if (voiceNote.target_type !== 'defect_description' || !voiceNote.defect_id) {
    return false;
  }

  const hasTranscript = Boolean(voiceNote.transcript?.trim());
  return (
    voiceNote.transcript_status === 'open' ||
    voiceNote.transcript_status === 'error' ||
    ((voiceNote.transcript_status === 'suggested' || voiceNote.transcript_status === 'edited') && hasTranscript)
  );
};

const pendingDefectId = (clientId: string) => `pending-defect:${clientId}`;

const pendingDefectClientId = (defectId: string) =>
  defectId.startsWith('pending-defect:') ? defectId.replace('pending-defect:', '') : null;

const pendingMediaClientId = (mediaAsset: MediaAsset) =>
  mediaAsset.storage_bucket === 'local-pending' && mediaAsset.id.startsWith('pending:')
    ? mediaAsset.id.replace('pending:', '')
    : null;

const defectPayloadFromOutbox = (item: OutboxItem): DefectFormState | null => {
  if (item.type === 'defect.create') {
    return {
      kind: item.payload.kind === 'notice' ? 'notice' : 'defect',
      description: typeof item.payload.description === 'string' ? item.payload.description : '',
      local_label: typeof item.payload.local_label === 'string' ? item.payload.local_label : '',
      trade_id: typeof item.payload.trade_id === 'string' ? item.payload.trade_id : null,
      trade_name_snapshot:
        typeof item.payload.trade_name_snapshot === 'string' ? item.payload.trade_name_snapshot : '',
      category: typeof item.payload.category === 'string' ? item.payload.category : '',
      client_id: typeof item.payload.client_id === 'string' ? item.payload.client_id : undefined,
    };
  }
  const nested = item.payload.defect;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
    return null;
  }
  const payload = nested as Record<string, unknown>;
  return {
    kind: payload.kind === 'notice' ? 'notice' : 'defect',
    description: typeof payload.description === 'string' ? payload.description : '',
    local_label: typeof payload.local_label === 'string' ? payload.local_label : '',
    trade_id: typeof payload.trade_id === 'string' ? payload.trade_id : null,
    trade_name_snapshot:
      typeof payload.trade_name_snapshot === 'string' ? payload.trade_name_snapshot : '',
    category: typeof payload.category === 'string' ? payload.category : '',
    client_id: typeof payload.client_id === 'string' ? payload.client_id : undefined,
  };
};

export function ProjectDetailScreen({
  autoSyncing,
  networkOnline,
  onBack,
  onDeleted,
  onProjectChanged,
  profiles,
  project,
  session,
  trades,
}: {
  autoSyncing: boolean;
  networkOnline: boolean | null;
  onBack: () => void;
  onDeleted: (projectId: string) => void;
  onProjectChanged: (project: Project) => void;
  profiles: Profile[];
  project: Project;
  session: Session;
  trades: Trade[];
}) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [projectEditing, setProjectEditing] = useState(false);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [plans, setPlans] = useState<PlanFile[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [generalFindings, setGeneralFindings] = useState<GeneralFinding[]>([]);
  const [conclusion, setConclusion] = useState<ProjectConclusion | null>(null);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);
  const [defectForm, setDefectForm] = useState<DefectFormState>(() => initialDefectForm());
  const [defectPhotoDrafts, setDefectPhotoDrafts] = useState<PendingMediaItem[]>([]);
  const [captureDrafts, setCaptureDrafts] = useState<CaptureEntryDraft[]>(() => [
    {
      clientId: createClientId('defect'),
      form: initialDefectForm('1'),
      photoDrafts: [],
      voiceAsset: null,
      voiceTranscript: '',
      status: 'draft',
    },
  ]);
  const [captureDraftsHydrated, setCaptureDraftsHydrated] = useState(false);
  const [activeCaptureVoiceDraftId, setActiveCaptureVoiceDraftId] = useState<string | null>(null);
  const [markerQueueIds, setMarkerQueueIds] = useState<string[]>([]);
  const [voiceDraftDefectId, setVoiceDraftDefectId] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceDrafts, setVoiceDrafts] = useState<Record<string, string>>({});
  const [recordedVoiceAsset, setRecordedVoiceAsset] = useState<UploadableAsset | null>(null);
  const [audioPermissionGranted, setAudioPermissionGranted] = useState<boolean | null>(null);
  const [newFindingText, setNewFindingText] = useState('');
  const [findingDrafts, setFindingDrafts] = useState<Record<string, string>>({});
  const [conclusionText, setConclusionText] = useState('');
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null);
  const [entrySearchText, setEntrySearchText] = useState('');
  const [entryKindFilter, setEntryKindFilter] = useState<DefectKind | 'all'>('all');
  const [entryTradeFilter, setEntryTradeFilter] = useState<string | 'all'>('all');
  const [entryCategoryFilter, setEntryCategoryFilter] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [planExportBusy, setPlanExportBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [planLayouts, setPlanLayouts] = useState<Record<string, { width: number; height: number }>>({});
  const [planImageSizes, setPlanImageSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [mediaAiSuggestions, setMediaAiSuggestions] = useState<Record<string, string>>({});
  const [mediaCaptionDrafts, setMediaCaptionDrafts] = useState<Record<string, string>>({});
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioRecorderState = useAudioRecorderState(audioRecorder);
  const autoTranscriptionState = useRef<Record<string, AutoTranscriptionState>>({});
  const autoTranscriptionTimers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});
  const dirtyMediaCaptionDraftIds = useRef<Set<string>>(new Set());

  const clearAutoTranscriptionTimers = useCallback((voiceNoteId?: string) => {
    const clearTimersForVoiceNote = (id: string) => {
      autoTranscriptionTimers.current[id]?.forEach((timer) => clearTimeout(timer));
      delete autoTranscriptionTimers.current[id];
    };

    if (voiceNoteId) {
      clearTimersForVoiceNote(voiceNoteId);
      return;
    }

    Object.keys(autoTranscriptionTimers.current).forEach(clearTimersForVoiceNote);
  }, []);

  const createCaptureDraft = useCallback(
    (existingDrafts: CaptureEntryDraft[] = captureDrafts): CaptureEntryDraft => ({
      clientId: createClientId('defect'),
      form: initialDefectForm(
        nextDefectLocalLabelFromLabels([
          ...defects.map((defect) => defect.local_label),
          ...existingDrafts.map((draft) => draft.form.local_label),
        ]),
      ),
      photoDrafts: [],
      voiceAsset: null,
      voiceTranscript: '',
      status: 'draft',
    }),
    [captureDrafts, defects],
  );

  const updateCaptureDraft = useCallback(
    (clientId: string, updater: (draft: CaptureEntryDraft) => CaptureEntryDraft) => {
      setCaptureDrafts((current) => current.map((draft) => (draft.clientId === clientId ? updater(draft) : draft)));
    },
    [],
  );

  const captureDraftToSnapshot = useCallback(
    (draft: CaptureEntryDraft) => {
      const now = new Date().toISOString();
      return {
        client_id: draft.clientId,
        project_id: project.id,
        form: draft.form,
        photo_client_ids: draft.photoDrafts.map((photo) => photo.client_id),
        voice_asset: draft.voiceAsset,
        voice_transcript: draft.voiceTranscript,
        status: draft.status === 'saving' || draft.status === 'saved' ? 'draft' as const : draft.status,
        error: draft.error ?? null,
        created_at: now,
        updated_at: now,
      };
    },
    [project.id],
  );

  const captureDraftFromSnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof readCaptureDrafts>>[number], pendingItems: PendingMediaItem[]): CaptureEntryDraft => {
      const pendingByClientId = new Map(pendingItems.map((item) => [item.client_id, item]));
      return {
        clientId: snapshot.client_id,
        form: snapshot.form,
        photoDrafts: snapshot.photo_client_ids
          .map((clientId) => pendingByClientId.get(clientId))
          .filter((item): item is PendingMediaItem => Boolean(item)),
        voiceAsset: snapshot.voice_asset ?? null,
        voiceTranscript: snapshot.voice_transcript,
        status: snapshot.status === 'saving' || snapshot.status === 'saved' ? 'draft' : snapshot.status,
        error: snapshot.error ?? null,
      };
    },
    [],
  );

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        defectsResult,
        plansResult,
        voiceNotesResult,
        generalFindingsResult,
        conclusionResult,
        previewResult,
        versionsResult,
        outboxResult,
        pendingMediaResult,
      ] = await Promise.allSettled([
        defectsApi.list(session, project.id),
        plansApi.list(session, project.id),
        voiceNotesApi.list(session, project.id),
        generalFindingsApi.list(session, project.id),
        conclusionsApi.get(session, project.id),
        reportsApi.preview(session, project.id),
        reportsApi.versions(session, project.id),
        readOutbox(),
        readPendingMedia(project.id),
      ]);

      const failures = [
        { label: 'Maengel', result: defectsResult },
        { label: 'Plaene', result: plansResult },
        { label: 'Sprachnotizen', result: voiceNotesResult },
        { label: 'Feststellungen', result: generalFindingsResult },
        { label: 'Fazit', result: conclusionResult },
        { label: 'Vorschau', result: previewResult },
        { label: 'Versionen', result: versionsResult },
        { label: 'wartende Eingaben', result: outboxResult },
        { label: 'Dateien in Übertragung', result: pendingMediaResult },
      ].filter((item) => item.result.status === 'rejected');
      const remoteFailures = failures.filter(
        (item) => !['wartende Eingaben', 'Dateien in Übertragung'].includes(item.label),
      );
      const canUseOfflineDetail =
        remoteFailures.length === 7 &&
        (networkOnline === false ||
          remoteFailures.every((item) => item.result.status === 'rejected' && isNetworkError(item.result.reason)));

      if (canUseOfflineDetail) {
        const cachedDetail = await readCachedProjectDetail(project.id);
        if (cachedDetail) {
          onProjectChanged(cachedDetail.project);
          setDefects(cachedDetail.defects);
          setDefectForm((current) =>
            current.local_label.trim()
              ? current
              : { ...current, local_label: nextDefectLocalLabel(cachedDetail.defects) },
          );
          setSelectedDefectId((current) => current ?? cachedDetail.defects[0]?.id ?? null);
          setPlans(cachedDetail.plans);
          setVoiceNotes(cachedDetail.voiceNotes);
          setVoiceDrafts(
            Object.fromEntries(cachedDetail.voiceNotes.map((voiceNote) => [voiceNote.id, voiceNote.transcript ?? ''])),
          );
          const sortedFindings = sortGeneralFindings(cachedDetail.generalFindings);
          setGeneralFindings(sortedFindings);
          setFindingDrafts(Object.fromEntries(sortedFindings.map((finding) => [finding.id, finding.text])));
          setConclusion(cachedDetail.conclusion);
          setConclusionText(cachedDetail.conclusion?.text ?? '');
          setPreview(null);
          setVersions([]);
          if (outboxResult.status === 'fulfilled') {
            setOutbox(outboxResult.value);
          }
          if (pendingMediaResult.status === 'fulfilled') {
            setPendingMedia(pendingMediaResult.value);
          }
          const linkedMedia = cachedDetail.defects.flatMap((defect) =>
            defect.media_links
              .map((link) => link.media_asset)
              .filter((mediaAsset): mediaAsset is MediaAsset => mediaAsset?.media_type === 'photo'),
          );
          setMediaCaptionDrafts((current) => {
            const next = { ...current };
            linkedMedia.forEach((media) => {
              if (!dirtyMediaCaptionDraftIds.current.has(media.id)) {
                next[media.id] = media.caption ?? '';
              }
            });
            return next;
          });
          setNotice('Offline-Stand geladen. Neue Eingaben werden lokal gesichert.');
          return;
        }
      }

      if (previewResult.status === 'fulfilled' && previewResult.value?.project) {
        onProjectChanged(previewResult.value.project);
      }

      if (defectsResult.status === 'fulfilled') {
        setDefects(defectsResult.value);
        setDefectForm((current) =>
          current.local_label.trim()
            ? current
            : { ...current, local_label: nextDefectLocalLabel(defectsResult.value) },
        );
        setSelectedDefectId((current) => current ?? defectsResult.value[0]?.id ?? null);
      }
      if (plansResult.status === 'fulfilled') {
        setPlans(plansResult.value);
      }
      if (voiceNotesResult.status === 'fulfilled') {
        setVoiceNotes(voiceNotesResult.value);
        setVoiceDrafts(
          Object.fromEntries(voiceNotesResult.value.map((voiceNote) => [voiceNote.id, voiceNote.transcript ?? ''])),
        );
      }
      if (generalFindingsResult.status === 'fulfilled') {
        const sortedFindings = sortGeneralFindings(generalFindingsResult.value);
        setGeneralFindings(sortedFindings);
        setFindingDrafts(Object.fromEntries(sortedFindings.map((finding) => [finding.id, finding.text])));
      }
      if (conclusionResult.status === 'fulfilled') {
        setConclusion(conclusionResult.value);
        setConclusionText(conclusionResult.value?.text ?? '');
      }
      if (previewResult.status === 'fulfilled') {
        setPreview(previewResult.value);
      }
      if (versionsResult.status === 'fulfilled') {
        setVersions(versionsResult.value);
      }
      if (outboxResult.status === 'fulfilled') {
        setOutbox(outboxResult.value);
      }
      if (pendingMediaResult.status === 'fulfilled') {
        setPendingMedia(pendingMediaResult.value);
      }
      if (
        defectsResult.status === 'fulfilled' &&
        pendingMediaResult.status === 'fulfilled'
      ) {
        const linkedMedia = defectsResult.value.flatMap((defect) =>
          defect.media_links
            .map((link) => link.media_asset)
            .filter((mediaAsset): mediaAsset is MediaAsset => mediaAsset?.media_type === 'photo'),
        );
        setMediaCaptionDrafts((current) => {
          const next = { ...current };
          linkedMedia.forEach((media) => {
            if (!dirtyMediaCaptionDraftIds.current.has(media.id)) {
              next[media.id] = media.caption ?? '';
            }
          });
          return next;
        });
      }
      if (remoteFailures.length === 7) {
        setError('Projektdaten konnten nicht aktualisiert werden. Der vorhandene Stand bleibt sichtbar.');
      } else if (failures.length) {
        setNotice(`Teilweise aktualisiert. Nicht geladen: ${failures.map((item) => item.label).join(', ')}.`);
      }
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Projektdaten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [networkOnline, onProjectChanged, project.id, session]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (networkOnline) {
      void loadDetail();
    }
  }, [loadDetail, networkOnline]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && networkOnline !== false) {
        void loadDetail();
      }
    });
    return () => subscription.remove();
  }, [loadDetail, networkOnline]);

  useEffect(() => {
    setProjectEditing(false);
    setRecordedVoiceAsset(null);
    setVoiceTranscript('');
    setVoiceDraftDefectId(null);
    setDefectForm(initialDefectForm());
    setDefectPhotoDrafts([]);
    setCaptureDraftsHydrated(false);
    setCaptureDrafts([
      {
        clientId: createClientId('defect'),
        form: initialDefectForm('1'),
        photoDrafts: [],
        voiceAsset: null,
        voiceTranscript: '',
        status: 'draft',
      },
    ]);
    setActiveCaptureVoiceDraftId(null);
    setMarkerQueueIds([]);
    autoTranscriptionState.current = {};
    clearAutoTranscriptionTimers();
  }, [clearAutoTranscriptionTimers, project.id]);

  useEffect(() => {
    let cancelled = false;
    const restoreCaptureDrafts = async () => {
      try {
        const [snapshots, pendingItems] = await Promise.all([
          readCaptureDrafts(project.id),
          readPendingMedia(project.id),
        ]);
        if (cancelled) {
          return;
        }
        const restored = snapshots
          .map((snapshot) => captureDraftFromSnapshot(snapshot, pendingItems))
          .filter((draft) => draft.form.local_label.trim() || draft.form.description.trim() || draft.photoDrafts.length || draft.voiceAsset);
        setCaptureDrafts(
          restored.length
            ? restored
            : [
                {
                  clientId: createClientId('defect'),
                  form: initialDefectForm('1'),
                  photoDrafts: [],
                  voiceAsset: null,
                  voiceTranscript: '',
                  status: 'draft',
                },
              ],
        );
      } finally {
        if (!cancelled) {
          setCaptureDraftsHydrated(true);
        }
      }
    };
    void restoreCaptureDrafts();
    return () => {
      cancelled = true;
    };
  }, [captureDraftFromSnapshot, project.id]);

  useEffect(() => {
    if (!captureDraftsHydrated) {
      return;
    }
    void writeCaptureDrafts(project.id, captureDrafts.map(captureDraftToSnapshot));
  }, [captureDraftToSnapshot, captureDrafts, captureDraftsHydrated, project.id]);

  useEffect(() => () => clearAutoTranscriptionTimers(), [clearAutoTranscriptionTimers]);

  useEffect(() => {
    if (activeTab === 'capture') {
      setVoiceTranscript('');
    }
  }, [activeTab]);

  useEffect(() => {
    if (!activeCaptureVoiceDraftId || !recordedVoiceAsset || audioRecorderState.isRecording) {
      return;
    }
    setCaptureDrafts((current) =>
      current.map((draft) =>
        draft.clientId === activeCaptureVoiceDraftId
          ? { ...draft, voiceAsset: recordedVoiceAsset, status: 'draft', error: null }
          : draft,
      ),
    );
    setRecordedVoiceAsset(null);
    setVoiceTranscript('');
    setActiveCaptureVoiceDraftId(null);
  }, [activeCaptureVoiceDraftId, audioRecorderState.isRecording, recordedVoiceAsset]);

  useEffect(() => {
    let mounted = true;

    AudioModule.getRecordingPermissionsAsync()
      .then((permission) => {
        if (mounted) {
          setAudioPermissionGranted(permission.granted);
        }
      })
      .catch(() => {
        if (mounted) {
          setAudioPermissionGranted(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const {
    assignVoiceNoteToDefect,
    deleteVoiceNote,
    discardVoiceRecording,
    processVoiceNoteAfterSave,
    requestMicrophonePermission,
    saveVoiceNote,
    startVoiceRecording,
    startVoiceTranscription,
    stopVoiceRecording,
    updateVoiceTranscript,
  } = useVoiceActions({
    audioPermissionGranted,
    audioRecorder,
    audioRecorderState,
    defects,
    loadDetail,
    project,
    recordedVoiceAsset,
    session,
    setAudioPermissionGranted,
    setOutbox,
    setPendingMedia,
    setRecordedVoiceAsset,
    setVoiceDrafts,
    setVoiceNotes,
    setVoiceTranscript,
    voiceDrafts,
    voiceTranscript,
  });

  const scheduleAutoTranscriptionRechecks = useCallback(
    (voiceNoteId: string) => {
      clearAutoTranscriptionTimers(voiceNoteId);
      autoTranscriptionTimers.current[voiceNoteId] = AUTO_TRANSCRIPTION_RECHECK_DELAYS_MS.map((delay) =>
        setTimeout(() => {
          void loadDetail().catch(() => undefined);
        }, delay),
      );
    },
    [clearAutoTranscriptionTimers, loadDetail],
  );

  const runAutoVoiceTranscription = useCallback(
    async (voiceNote: VoiceNote, baseDescription?: string | null): Promise<boolean> => {
      const hasTranscript = Boolean(voiceNote.transcript?.trim());
      if (voiceNote.target_type !== 'defect_description' || !voiceNote.defect_id) {
        return false;
      }
      if (!hasTranscript && (networkOnline === false || !isAutoTranscriptionCandidate(voiceNote))) {
        return false;
      }

      const currentState = autoTranscriptionState.current[voiceNote.id] ?? {
        attempts: 0,
        inFlight: false,
      };
      if (currentState.inFlight) {
        return false;
      }

      if (!hasTranscript && currentState.attempts >= AUTO_TRANSCRIPTION_MAX_ATTEMPTS) {
        return false;
      }

      const nextState = {
        attempts: hasTranscript ? currentState.attempts : currentState.attempts + 1,
        inFlight: true,
      };
      autoTranscriptionState.current[voiceNote.id] = nextState;

      try {
        const applied = await processVoiceNoteAfterSave(voiceNote, baseDescription);
        if (applied) {
          delete autoTranscriptionState.current[voiceNote.id];
          clearAutoTranscriptionTimers(voiceNote.id);
          await loadDetail();
          return true;
        }

        autoTranscriptionState.current[voiceNote.id] = { ...nextState, inFlight: false };
        if (!hasTranscript) {
          scheduleAutoTranscriptionRechecks(voiceNote.id);
        }
        return false;
      } catch (autoError) {
        autoTranscriptionState.current[voiceNote.id] = { ...nextState, inFlight: false };
        if (isRetryableNetworkError(autoError)) {
          scheduleAutoTranscriptionRechecks(voiceNote.id);
          return false;
        }

        setNotice('Sprachnotiz gespeichert. Transkription kann spaeter wiederholt werden.');
        return false;
      }
    },
    [
      clearAutoTranscriptionTimers,
      loadDetail,
      networkOnline,
      processVoiceNoteAfterSave,
      scheduleAutoTranscriptionRechecks,
    ],
  );

  const {
    addDefectPhoto,
    addPhotoToDefect,
    createDefect,
    createDefectWithPayload,
    deleteDefect,
    moveDefect,
    removeDefectPhoto,
    retryOutbox,
    updateDefect,
    updateDefectPhotoCaption,
  } = useDefectActions({
    defects,
    defectForm,
    defectPhotoDrafts,
    loadDetail,
    onVoiceNoteCreated: runAutoVoiceTranscription,
    project,
    recordedVoiceAsset: voiceDraftDefectId ? null : recordedVoiceAsset,
    session,
    setDefectForm,
    setDefectPhotoDrafts,
    setDefects,
    setOutbox,
    setPendingMedia,
    setRecordedVoiceAsset,
    setSelectedDefectId,
    setVoiceNotes,
    setVoiceTranscript,
    voiceTranscript,
  });

  const updatePendingMediaCaptionByClientId = useCallback((clientId: string, caption: string) => {
    const updatedAt = new Date().toISOString();
    setPendingMedia((current) =>
      current.map((item) =>
        item.client_id === clientId ? { ...item, caption, updated_at: updatedAt } : item,
      ),
    );
    setDefects((current) =>
      current.map((defect) => ({
        ...defect,
        media_links: defect.media_links.map((link) =>
          link.media_asset?.id === `pending:${clientId}`
            ? {
                ...link,
                media_asset: {
                  ...link.media_asset,
                  caption,
                  caption_status: caption.trim() ? 'edited' : link.media_asset.caption_status,
                  updated_at: updatedAt,
                },
              }
            : link,
        ),
      })),
    );
    void readPendingMediaByClientId(clientId).then((item) => {
      if (item) {
        return upsertPendingMedia({ ...item, caption, updated_at: updatedAt });
      }
      return undefined;
    });
  }, []);

  const changeMediaCaptionDraft = useCallback(
    (mediaAsset: MediaAsset, value: string) => {
      dirtyMediaCaptionDraftIds.current.add(mediaAsset.id);
      setMediaCaptionDrafts((current) => ({ ...current, [mediaAsset.id]: value }));
      const clientId = pendingMediaClientId(mediaAsset);
      if (clientId) {
        updatePendingMediaCaptionByClientId(clientId, value);
      }
    },
    [updatePendingMediaCaptionByClientId],
  );

  const {
    deleteMediaAsset,
    startImageDescription,
    updateMediaCaption,
  } = useMediaActions({
    loadDetail,
    mediaCaptionDrafts,
    session,
    setDefects,
    setMediaAiSuggestions,
    setMediaCaptionDrafts,
    setPendingMedia,
    onCaptionDraftChanged: (mediaAssetId) => {
      dirtyMediaCaptionDraftIds.current.add(mediaAssetId);
    },
    onCaptionSaved: (mediaAssetId) => {
      dirtyMediaCaptionDraftIds.current.delete(mediaAssetId);
    },
  });

  const handleMarkerCreated = useCallback((defectId: string) => {
    setMarkerQueueIds((current) => {
      const remaining = current.filter((id) => id !== defectId);
      setSelectedDefectId(remaining[0] ?? defectId);
      return remaining;
    });
  }, []);

  const { createMarker, deleteMarker, uploadPlan } = usePlanActions({
    loadDetail,
    onMarkerCreated: handleMarkerCreated,
    plans,
    project,
    selectedDefectId,
    session,
    setOutbox,
    setPendingMedia,
    setPlans,
  });

  const {
    createGeneralFinding,
    deleteGeneralFinding,
    generateReport,
    saveConclusion,
    sendReport,
    updateGeneralFinding,
  } = useReportActions({
    conclusion,
    conclusionText,
    findingDrafts,
    generalFindings,
    newFindingText,
    project,
    session,
    setConclusion,
    setConclusionText,
    setFindingDrafts,
    setGeneralFindings,
    setNewFindingText,
    setOutbox,
    setPreview,
    setVersions,
  });

  const exportPlan = useCallback(
    async (plan: PlanFile, format: 'source' | 'image') => {
      const busyKey = `${plan.id}:${format}`;
      setPlanExportBusy(busyKey);
      setError(null);
      setNotice(null);
      try {
        const result = await plansApi.export(session, plan.id, { format });
        await Linking.openURL(result.download_url);
        setNotice(`${result.file_name} bereitgestellt.`);
      } catch (exportError) {
        setError(
          exportError instanceof Error
            ? exportError.message
            : 'Markierter Plan konnte nicht heruntergeladen werden.',
        );
      } finally {
        setPlanExportBusy(null);
      }
    },
    [session],
  );

  useEffect(() => {
    if (loading || networkOnline === false) {
      return;
    }
    const candidates = voiceNotes.filter(isAutoTranscriptionCandidate);
    if (!candidates.length) {
      return;
    }

    void Promise.allSettled(
      candidates.map((voiceNote) => {
        const defect = defects.find((item) => item.id === voiceNote.defect_id);
        return runAutoVoiceTranscription(voiceNote, defect?.description ?? null);
      }),
    ).then(async (results) => {
      const appliedCount = results.filter(
        (result) => result.status === 'fulfilled' && result.value,
      ).length;
      if (appliedCount) {
        setNotice(`${appliedCount} Sprachnotiz(en) automatisch transkribiert.`);
      }
    });
  }, [defects, loading, networkOnline, runAutoVoiceTranscription, voiceNotes]);

  const updateProject = async (input: ProjectUpdateInput): Promise<Project> => {
    setBusy('project-save');
    setError(null);
    setNotice(null);
    try {
      const updatedProject = await projectsApi.update(session, project.id, input);
      onProjectChanged(updatedProject);
      setProjectEditing(false);
      setNotice('Projektstammdaten gespeichert.');
      return updatedProject;
    } catch (updateError) {
      if (isNetworkError(updateError)) {
        const optimisticProject = {
          ...project,
          ...input,
          updated_at: new Date().toISOString(),
        };
        await appendOutbox({
          client_operation_id: createClientId('project-update'),
          type: 'project.update',
          payload: {
            id: project.id,
            ...input,
            base_revision: project.revision,
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: updateError.message,
        });
        setOutbox(await readOutbox());
        onProjectChanged(optimisticProject);
        setProjectEditing(false);
        setNotice('Projektstammdaten lokal gespeichert und werden spaeter uebertragen.');
        return optimisticProject;
      }
      setError(updateError instanceof Error ? updateError.message : 'Projekt konnte nicht gespeichert werden.');
      throw updateError;
    } finally {
      setBusy(null);
    }
  };

  const deleteProject = async () => {
    setBusy('project-delete');
    setError(null);
    setNotice(null);
    let deleted = false;
    try {
      await projectsApi.remove(session, project.id);
      deleted = true;
      onDeleted(project.id);
    } catch (deleteError) {
      if (isNetworkError(deleteError)) {
        await appendOutbox({
          client_operation_id: createClientId('project-delete'),
          type: 'project.delete',
          payload: {
            id: project.id,
            base_revision: project.revision,
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: deleteError.message,
        });
        deleted = true;
        onProjectChanged({ ...project, deleted_at: new Date().toISOString() });
        onDeleted(project.id);
      } else {
        setError(deleteError instanceof Error ? deleteError.message : 'Projekt konnte nicht geloescht werden.');
      }
    } finally {
      if (!deleted) {
        setBusy(null);
      }
    }
  };

  const discardVoiceDraft = async () => {
    await discardVoiceRecording();
    setVoiceDraftDefectId(null);
  };

  const startVoiceForNewEntry = () => {
    setVoiceDraftDefectId(null);
    startVoiceRecording();
  };

  const startVoiceForSelectedDefect = () => {
    if (!selectedDefectId) {
      setError('Bitte zuerst einen Eintrag auswaehlen.');
      return;
    }
    setVoiceDraftDefectId(selectedDefectId);
    startVoiceRecording();
  };

  const saveVoiceForSelectedDefect = async () => {
    const targetDefectId = voiceDraftDefectId ?? selectedDefectId;
    const saved = await saveVoiceNote(targetDefectId ?? undefined);
    if (saved) {
      setVoiceDraftDefectId(null);
    }
  };

  const startVoiceForDefect = (defectId: string) => {
    setSelectedDefectId(defectId);
    setVoiceDraftDefectId(defectId);
    setActiveTab('entries');
    setNotice('Sprachnotiz wird direkt an diesem Eintrag gespeichert.');
  };

  const addCaptureDraft = () => {
    setCaptureDrafts((current) => [...current, createCaptureDraft(current)]);
  };

  const removeCaptureDraft = async (clientId: string) => {
    const draft = captureDrafts.find((item) => item.clientId === clientId);
    if (!draft || busy) {
      return;
    }
    await Promise.all(draft.photoDrafts.map((item) => deletePendingMedia(item.client_id)));
    setPendingMedia(await readPendingMedia(project.id));
    setCaptureDrafts((current) => {
      const remaining = current.filter((item) => item.clientId !== clientId);
      return remaining.length ? remaining : [createCaptureDraft([])];
    });
    if (activeCaptureVoiceDraftId === clientId) {
      await discardVoiceRecording();
      setActiveCaptureVoiceDraftId(null);
    }
  };

  const addPhotoToCaptureDraft = async (clientId: string, mode: 'camera' | 'library') => {
    if (busy) {
      return;
    }
    if (mode === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Kamerazugriff wurde nicht erlaubt.');
        return;
      }
    }

    const result =
      mode === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) {
      return;
    }

    setBusy('defect-photo');
    setError(null);
    setNotice(null);
    try {
      const cached = await cacheAssetForOffline(project.id, result.assets[0], 'photo', mode);
      updateCaptureDraft(clientId, (draft) => ({
        ...draft,
        photoDrafts: [...draft.photoDrafts, cached],
        status: 'draft',
        error: null,
      }));
      setPendingMedia(await readPendingMedia(project.id));
      setNotice('Foto zur Erfassung hinzugefügt.');
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Foto konnte nicht vorgemerkt werden.');
    } finally {
      setBusy(null);
    }
  };

  const updateCapturePhotoCaption = (draftId: string, clientId: string, caption: string) => {
    updateCaptureDraft(draftId, (draft) => ({
      ...draft,
      photoDrafts: draft.photoDrafts.map((item) => {
        if (item.client_id !== clientId) {
          return item;
        }
        const next = { ...item, caption, updated_at: new Date().toISOString() };
        void upsertPendingMedia(next);
        return next;
      }),
    }));
    setPendingMedia((current) =>
      current.map((item) =>
        item.client_id === clientId ? { ...item, caption, updated_at: new Date().toISOString() } : item,
      ),
    );
  };

  const removeCapturePhoto = async (draftId: string, clientId: string) => {
    if (busy) {
      return;
    }
    setBusy('defect-photo');
    setError(null);
    setNotice(null);
    try {
      await deletePendingMedia(clientId);
      updateCaptureDraft(draftId, (draft) => ({
        ...draft,
        photoDrafts: draft.photoDrafts.filter((item) => item.client_id !== clientId),
      }));
      setPendingMedia(await readPendingMedia(project.id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Foto konnte nicht entfernt werden.');
    } finally {
      setBusy(null);
    }
  };

  const startVoiceForCaptureDraft = (clientId: string) => {
    if (activeCaptureVoiceDraftId && activeCaptureVoiceDraftId !== clientId) {
      setError('Bitte die laufende Aufnahme zuerst stoppen.');
      return;
    }
    setActiveCaptureVoiceDraftId(clientId);
    setVoiceDraftDefectId(null);
    startVoiceRecording();
  };

  const stopVoiceForCaptureDraft = async () => {
    await stopVoiceRecording();
  };

  const discardVoiceForCaptureDraft = async (clientId: string) => {
    if (activeCaptureVoiceDraftId === clientId) {
      await discardVoiceRecording();
      setActiveCaptureVoiceDraftId(null);
      return;
    }
    updateCaptureDraft(clientId, (draft) => ({
      ...draft,
      voiceAsset: null,
      voiceTranscript: '',
    }));
  };

  const saveCaptureDrafts = async () => {
    if (busy) {
      return;
    }
    const saveableDrafts = captureDrafts.filter(
      (draft) => draft.form.local_label.trim() && (draft.form.description.trim() || draft.voiceAsset),
    );
    if (!saveableDrafts.length) {
      setError('Bitte mindestens eine Erfassung mit Arbeitsnummer und Beschreibung oder Audio ausfüllen.');
      return;
    }

    const savedDefects: Defect[] = [];
    for (const draft of saveableDrafts) {
      updateCaptureDraft(draft.clientId, (current) => ({ ...current, status: 'saving', error: null }));
      const description = draft.form.description.trim();
      const payload = {
        ...draft.form,
        description: description || VOICE_TRANSCRIPT_PENDING_DESCRIPTION,
        local_label: draft.form.local_label.trim(),
        trade_id: draft.form.trade_id || undefined,
        trade_name_snapshot: draft.form.trade_name_snapshot?.trim() || undefined,
        category: draft.form.category?.trim() || undefined,
        client_id: draft.clientId,
      };
      const voiceDraft = draft.voiceAsset
        ? { asset: draft.voiceAsset, transcript: draft.voiceTranscript }
        : undefined;
      const saved = await createDefectWithPayload(payload, draft.photoDrafts, voiceDraft, {
        resetForm: false,
        switchToEntries: false,
      });
      if (saved) {
        savedDefects.push(saved);
        updateCaptureDraft(draft.clientId, (current) => ({ ...current, status: 'saved', error: null }));
      } else {
        updateCaptureDraft(draft.clientId, (current) => ({
          ...current,
          status: 'error',
          error: 'Eintrag konnte nicht gespeichert werden.',
        }));
      }
    }

    if (!savedDefects.length) {
      return;
    }

    const savedClientIds = new Set(savedDefects.map((defect) => defect.client_id).filter(Boolean));
    setCaptureDrafts((current) => {
      const remaining = current.filter((draft) => !savedClientIds.has(draft.clientId));
      return remaining.length ? remaining : [createCaptureDraft([])];
    });
    const nextQueue = savedDefects.map((defect) => defect.id);
    setMarkerQueueIds(nextQueue);
    setSelectedDefectId(nextQueue[0] ?? null);
    setActiveTab('capture');
    setNotice(
      savedDefects.length === 1
        ? 'Eintrag gespeichert. Du kannst ihn jetzt im Plan markieren.'
        : `${savedDefects.length} Einträge gespeichert. Setze die Marker nacheinander im Plan.`,
    );
  };

  const confirmDeleteProject = () => {
    Alert.alert(
      'Projekt loeschen?',
      `${project.project_number} - ${project.client_name}\n\nDas Projekt wird aus der aktiven Liste entfernt. Diese Loeschung kann in der App nicht rueckgaengig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Loeschen', onPress: deleteProject, style: 'destructive' },
      ],
    );
  };

  const pendingDefects = useMemo<Defect[]>(() => {
    const existingClientIds = new Set(defects.map((defect) => defect.client_id).filter(Boolean));
    return outbox
      .filter(
        (item) =>
          ['defect.create', 'defect.create_with_media', 'defect.create_with_media_and_voice'].includes(item.type) &&
          item.payload.project_id === project.id,
      )
      .flatMap((item, index): Defect[] => {
        const payload = defectPayloadFromOutbox(item);
        const clientId = payload?.client_id;
        if (!payload || !clientId || existingClientIds.has(clientId)) {
          return [];
        }
        const pendingDefect: Defect = {
          id: pendingDefectId(clientId),
          project_id: project.id,
          kind: payload.kind,
          local_label: payload.local_label,
          report_sort_order: defects.length + index + 1,
          trade_id: payload.trade_id ?? null,
          trade_name_snapshot: payload.trade_name_snapshot ?? null,
          category: payload.category ?? null,
          description: payload.description,
          ai_status: 'open',
          created_by: session.user.id,
          created_at: item.created_at,
          updated_at: item.created_at,
          revision: 1,
          client_id: clientId,
          media_links: [],
        };
        return [pendingDefect];
      });
  }, [defects, outbox, project.id, session.user.id]);

  const visibleDefects = useMemo(() => [...defects, ...pendingDefects], [defects, pendingDefects]);

  const plansWithPendingMarkers = useMemo<PlanFile[]>(() => {
    const pendingMarkers = outbox.filter(
      (item) =>
        ['plan_marker.create', 'plan_marker.create_for_pending_defect'].includes(item.type) &&
        item.payload.project_id === project.id,
    );
    if (!pendingMarkers.length) {
      return plans;
    }
    return plans.map((plan) => {
      const markersForPlan = pendingMarkers
        .filter((item) => item.payload.plan_file_id === plan.id)
        .flatMap((item) => {
          const clientId =
            typeof item.payload.client_id === 'string' ? item.payload.client_id : item.client_operation_id;
          const pendingClientId =
            typeof item.payload.pending_defect_client_id === 'string' ? item.payload.pending_defect_client_id : '';
          const defectId =
            item.type === 'plan_marker.create_for_pending_defect'
              ? pendingClientId
                ? pendingDefectId(pendingClientId)
                : ''
              : String(item.payload.defect_id ?? '');
          if (!defectId) {
            return [];
          }
          const xNorm = typeof item.payload.x_norm === 'number' ? item.payload.x_norm : 0.5;
          const yNorm = typeof item.payload.y_norm === 'number' ? item.payload.y_norm : 0.5;
          return [{
            id: `pending-marker:${clientId}`,
            project_id: project.id,
            plan_file_id: plan.id,
            defect_id: defectId,
            page_number: typeof item.payload.page_number === 'number' ? item.payload.page_number : 1,
            x_norm: xNorm,
            y_norm: yNorm,
            label_override: null,
            created_by: session.user.id,
            created_at: item.created_at,
            updated_at: item.created_at,
            client_id: clientId,
          }];
        })
        .filter((marker) => marker.defect_id && !plan.markers.some((item) => item.client_id === marker.client_id));
      return markersForPlan.length ? { ...plan, markers: [...plan.markers, ...markersForPlan] } : plan;
    });
  }, [outbox, plans, project.id, session.user.id]);

  const selectedDefect = visibleDefects.find((defect) => defect.id === selectedDefectId) ?? null;
  const currentUserProfile = profileById(profiles, session.user.id);
  const selectedVoiceDraftActive = Boolean(voiceDraftDefectId && voiceDraftDefectId === selectedDefectId);
  const entryCategories = useMemo(
    () =>
      Array.from(
        new Set(defects.map((defect) => defect.category?.trim()).filter((value): value is string => Boolean(value))),
      ).sort((left, right) => left.localeCompare(right, 'de-DE')),
    [defects],
  );
  const entryTrades = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string }>();
    defects.forEach((defect) => {
      if (defect.trade_id) {
        byKey.set(`id:${defect.trade_id}`, {
          key: defect.trade_id,
          label: trades.find((trade) => trade.id === defect.trade_id)?.name ?? defect.trade_name_snapshot ?? 'Gewerk',
        });
      } else if (defect.trade_name_snapshot?.trim()) {
        byKey.set(`name:${defect.trade_name_snapshot.trim()}`, {
          key: defect.trade_name_snapshot.trim(),
          label: defect.trade_name_snapshot.trim(),
        });
      }
    });
    return Array.from(byKey.values()).sort((left, right) => left.label.localeCompare(right.label, 'de-DE'));
  }, [defects, trades]);
  const entryFilteredDefects = useMemo(() => {
    const query = normalizeSearchText(entrySearchText);
    const terms = query.split(/\s+/).filter(Boolean);

    return defects.filter((defect) => {
      if (entryKindFilter !== 'all' && defect.kind !== entryKindFilter) {
        return false;
      }
      if (
        entryTradeFilter !== 'all' &&
        defect.trade_id !== entryTradeFilter &&
        defect.trade_name_snapshot !== entryTradeFilter
      ) {
        return false;
      }
      if (entryCategoryFilter !== 'all' && defect.category !== entryCategoryFilter) {
        return false;
      }
      if (!terms.length) {
        return true;
      }

      const searchable = [
        defect.local_label,
        defect.report_number ? String(defect.report_number) : '',
        defect.trade_name_snapshot,
        defect.category,
        defect.kind === 'defect' ? 'Mangel' : 'Hinweis',
        defect.description,
      ]
        .join(' ')
        .toLocaleLowerCase('de-DE');
      return terms.every((term) => searchable.includes(term));
    });
  }, [defects, entryCategoryFilter, entryKindFilter, entrySearchText, entryTradeFilter]);
  const pendingDefectOperations = outbox.filter(
    (item) =>
      ['defect.create', 'defect.create_with_media', 'defect.create_with_media_and_voice'].includes(item.type) &&
      item.payload.project_id === project.id,
  );

  const projectStatusValue = useMemo(
    () => ({ busy, error, notice, setBusy, setError, setNotice }),
    [busy, error, notice],
  );
  const tabRouterValue = useMemo(
    () => ({ activeTab, navigateToTab: setActiveTab }),
    [activeTab],
  );

  return (
    <ProjectStatusProvider value={projectStatusValue}>
      <TabRouterProvider value={tabRouterValue}>
    <Screen scroll padded refreshing={loading} onRefresh={loadDetail}>
      <AppHeader
        title={project.project_number}
        subtitle={project.client_name}
        onBack={onBack}
        showBackLabel
        trailing={
          <OverflowMenu
            items={[
              {
                key: 'edit',
                label: projectEditing ? 'Bearbeiten schließen' : 'Projekt bearbeiten',
                icon: <Pencil color={theme.colors.text} size={20} />,
                onSelect: () => setProjectEditing((current) => !current),
                disabled: Boolean(busy),
              },
              {
                key: 'delete',
                label: 'Projekt löschen',
                icon: <Trash2 color={theme.colors.danger} size={20} />,
                destructive: true,
                onSelect: confirmDeleteProject,
                disabled: Boolean(busy),
              },
            ]}
          />
        }
      />

      <ProjectHeaderCard project={project} profiles={profiles} />

      {projectEditing ? (
        <ProjectEditPanel
          busy={busy}
          onCancel={() => setProjectEditing(false)}
          onSubmit={updateProject}
          profiles={profiles}
          project={project}
        />
      ) : null}

      {error ? <Banner tone="error" title="Fehler" message={error} actionLabel="Erneut laden" onAction={loadDetail} /> : null}
      {notice ? <Banner tone="info" title="Status" message={notice} onDismiss={() => setNotice(null)} /> : null}
      {busy ? <LoadingBlock label="Vorgang läuft" /> : null}

      <WorkspaceTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <OverviewTab
          busy={busy}
          defectsCount={visibleDefects.length}
          onOpenCapture={() => setActiveTab('capture')}
          onOpenPlans={() => setActiveTab('plans')}
          onOpenReport={() => setActiveTab('report')}
          onRetryOutbox={retryOutbox}
          autoSyncing={autoSyncing}
          networkOnline={networkOnline}
          outbox={outbox}
          pendingMedia={pendingMedia}
          plans={plansWithPendingMarkers}
          selectedDefect={selectedDefect}
        />
      ) : null}

      {activeTab === 'capture' ? (
        <CaptureTab
          audioPermissionGranted={audioPermissionGranted}
          activeVoiceDraftId={activeCaptureVoiceDraftId}
          busy={busy}
          captureDrafts={captureDrafts}
          defects={visibleDefects}
          markerQueueIds={markerQueueIds}
          onAddDraft={addCaptureDraft}
          onAddPhoto={addPhotoToCaptureDraft}
          onChangeDraft={updateCaptureDraft}
          onChangePhotoCaption={updateCapturePhotoCaption}
          onCreateMarker={createMarker}
          onDeleteMarker={deleteMarker}
          onDiscardVoice={discardVoiceForCaptureDraft}
          onRemoveDraft={removeCaptureDraft}
          onRemovePhoto={removeCapturePhoto}
          onRequestMicrophonePermission={requestMicrophonePermission}
          onSaveDrafts={saveCaptureDrafts}
          onSelectDefect={setSelectedDefectId}
          onStartVoice={startVoiceForCaptureDraft}
          onStopVoice={stopVoiceForCaptureDraft}
          onUploadPlan={uploadPlan}
          planImageSizes={planImageSizes}
          planLayouts={planLayouts}
          plans={plansWithPendingMarkers}
          recorderState={audioRecorderState}
          selectedDefectId={selectedDefectId}
          setPlanImageSizes={setPlanImageSizes}
          setPlanLayouts={setPlanLayouts}
          trades={trades}
        />
      ) : null}

      {activeTab === 'entries' ? (
        <EntriesTab
          audioPermissionGranted={audioPermissionGranted}
          busy={busy}
          defects={defects}
          entryCategories={entryCategories}
          entryCategoryFilter={entryCategoryFilter}
          entryFilteredDefects={entryFilteredDefects}
          entryKindFilter={entryKindFilter}
          entrySearchText={entrySearchText}
          entryTradeFilter={entryTradeFilter}
          entryTrades={entryTrades}
          mediaAiSuggestions={mediaAiSuggestions}
          mediaCaptionDrafts={mediaCaptionDrafts}
          onAddPhotoToDefect={addPhotoToDefect}
          onAssignLegacyVoiceNote={assignVoiceNoteToDefect}
          onDiscardVoice={discardVoiceDraft}
          onMoveDefect={moveDefect}
          onRequestMicrophonePermission={requestMicrophonePermission}
          onSaveVoiceForSelectedDefect={saveVoiceForSelectedDefect}
          onStartImageDescription={startImageDescription}
          onStartVoice={startVoiceForSelectedDefect}
          onStartVoiceForDefect={startVoiceForDefect}
          onStartVoiceTranscription={startVoiceTranscription}
          onStopVoice={stopVoiceRecording}
          onChangeMediaCaptionDraft={changeMediaCaptionDraft}
          onDeleteDefect={deleteDefect}
          onDeleteMedia={deleteMediaAsset}
          onDeleteVoiceNote={deleteVoiceNote}
          onUpdateDefect={updateDefect}
          onUpdateMediaCaption={updateMediaCaption}
          onUpdateVoiceTranscript={updateVoiceTranscript}
          pendingMedia={pendingMedia}
          pendingDefectOperations={pendingDefectOperations}
          recordedVoiceAsset={selectedVoiceDraftActive ? recordedVoiceAsset : null}
          recorderState={audioRecorderState}
          selectedDefect={selectedDefect}
          selectedDefectId={selectedDefectId}
          setEntryCategoryFilter={setEntryCategoryFilter}
          setEntryKindFilter={setEntryKindFilter}
          setEntrySearchText={setEntrySearchText}
          setEntryTradeFilter={setEntryTradeFilter}
          setSelectedDefectId={setSelectedDefectId}
          setVoiceDrafts={setVoiceDrafts}
          setVoiceTranscript={setVoiceTranscript}
          voiceDrafts={voiceDrafts}
          voiceNotes={voiceNotes}
          voiceTranscript={selectedVoiceDraftActive ? voiceTranscript : ''}
        />
      ) : null}

      {activeTab === 'plans' ? (
        <PlansTab
          busy={busy}
          defects={visibleDefects}
          onCreateMarker={createMarker}
          onDeleteMarker={deleteMarker}
          onSelectDefect={setSelectedDefectId}
          onUploadPlan={uploadPlan}
          planImageSizes={planImageSizes}
          planLayouts={planLayouts}
          plans={plansWithPendingMarkers}
          selectedDefectId={selectedDefectId}
          setPlanImageSizes={setPlanImageSizes}
          setPlanLayouts={setPlanLayouts}
        />
      ) : null}

      {activeTab === 'report' ? (
        <ReportTab
          busy={busy}
          conclusion={conclusion}
          conclusionText={conclusionText}
          currentUserEmail={session.user.email}
          currentUserProfile={currentUserProfile}
          findingDrafts={findingDrafts}
          generalFindings={generalFindings}
          newFindingText={newFindingText}
          onCreateGeneralFinding={createGeneralFinding}
          onDeleteGeneralFinding={deleteGeneralFinding}
          onExportPlan={exportPlan}
          onGenerateReport={generateReport}
          onSaveConclusion={saveConclusion}
          onSendReport={sendReport}
          onUpdateGeneralFinding={updateGeneralFinding}
          plans={plans}
          planExportBusy={planExportBusy}
          preview={preview}
          project={project}
          setConclusionText={setConclusionText}
          setFindingDrafts={setFindingDrafts}
          setNewFindingText={setNewFindingText}
          versions={versions}
        />
      ) : null}
    </Screen>
      </TabRouterProvider>
    </ProjectStatusProvider>
  );
}

function ProjectHeaderCard({ project, profiles }: { project: Project; profiles: Profile[] }) {
  const theme = useTheme();
  return (
    <Surface variant="card" padding="5" elevated bordered>
      <Disclosure
        defaultOpen={false}
        accessibilityLabel="Projektdaten ein- oder ausklappen"
        trigger={
          <View style={{ gap: theme.spacing[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[3] }}>
              <Text variant="captionStrong" tone="primary">
                {project.project_number}
              </Text>
              <ProjectStatusBadge status={project.status} />
            </View>
            <Text variant="subheading" numberOfLines={2}>
              {project.client_name}
            </Text>
          </View>
        }
      >
        <VStack gap="2">
          <DetailRow label="Objektadresse" value={project.object_address} />
          <DetailRow label="Ortstermin" value={formatDate(project.site_visit_date)} />
          <DetailRow label="Art des Gutachtens" value={project.appraisal_type} />
          <DetailRow label="Bearbeiter" value={profileLabel(profileById(profiles, project.lead_user_id), project.lead_user_id)} />
          <DetailRow label="Letzte Änderung" value={formatDateTime(project.updated_at ?? project.created_at ?? project.site_visit_date)} />
        </VStack>
      </Disclosure>
    </Surface>
  );
}
