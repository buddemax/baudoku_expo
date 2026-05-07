import type { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import type { Dispatch, SetStateAction } from 'react';

import { ApiError, defectsApi, type DefectUpdateInput, voiceNotesApi } from '../../../lib/api';
import { isNetworkError } from '../../../lib/api/errors';
import {
  appendOutbox,
  cacheAssetForOffline,
  deletePendingMedia,
  deleteOutboxItem,
  markPendingMediaLinked,
  type PendingMediaItem,
  readOutbox,
  readPendingMedia,
  readPendingMediaByClientId,
  type OutboxItem,
  upsertPendingMedia,
  writeOutbox,
} from '../../../lib/offlineStore';
import { syncOfflineQueues, uploadQueuedMedia } from '../../../lib/sync';
import type { UploadableAsset } from '../../../lib/uploadProjectFile';
import type {
  Defect,
  DefectCreateInput,
  DefectMediaLink,
  MediaAsset,
  Project,
  VoiceNote,
} from '../../../types/projects';
import { initialDefectForm, nextDefectLocalLabelFromLabels } from './helpers';
import { VOICE_TRANSCRIPT_PENDING_DESCRIPTION } from './transcripts';
import type { DefectFormState } from './types';
import { useProjectStatus } from './contexts/ProjectStatusContext';
import { useTabRouter } from './contexts/TabRouterContext';

type DefectVoiceDraft = {
  asset: UploadableAsset;
  transcript: string;
};

type CreateDefectOptions = {
  resetForm?: boolean;
  switchToEntries?: boolean;
};

export function useDefectActions({
  defects,
  defectForm,
  defectPhotoDrafts,
  loadDetail,
  project,
  recordedVoiceAsset,
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
  onVoiceNoteCreated,
  voiceTranscript,
}: {
  defects: Defect[];
  defectForm: DefectFormState;
  defectPhotoDrafts: PendingMediaItem[];
  loadDetail: () => Promise<void>;
  project: Project;
  recordedVoiceAsset: UploadableAsset | null;
  session: Session;
  setDefectForm: Dispatch<SetStateAction<DefectFormState>>;
  setDefectPhotoDrafts: Dispatch<SetStateAction<PendingMediaItem[]>>;
  setDefects: Dispatch<SetStateAction<Defect[]>>;
  setOutbox: Dispatch<SetStateAction<OutboxItem[]>>;
  setPendingMedia: Dispatch<SetStateAction<PendingMediaItem[]>>;
  setRecordedVoiceAsset: Dispatch<SetStateAction<UploadableAsset | null>>;
  setSelectedDefectId: Dispatch<SetStateAction<string | null>>;
  setVoiceNotes: Dispatch<SetStateAction<VoiceNote[]>>;
  setVoiceTranscript: Dispatch<SetStateAction<string>>;
  onVoiceNoteCreated?: (voiceNote: VoiceNote, baseDescription: string) => Promise<boolean>;
  voiceTranscript: string;
}) {
  const { busy, setBusy, setError, setNotice } = useProjectStatus();
  const { navigateToTab } = useTabRouter();
  const clientOperationId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pendingDefectId = (clientId: string) => `pending-defect:${clientId}`;
  const pendingDefectClientId = (defectId: string) =>
    defectId.startsWith('pending-defect:') ? defectId.replace('pending-defect:', '') : null;

  const resetDefectForm = (extraLocalLabel?: string) => {
    setDefectForm(
      initialDefectForm(
        nextDefectLocalLabelFromLabels([
          ...defects.map((defect) => defect.local_label),
          extraLocalLabel,
        ]),
      ),
    );
  };

  const refreshOfflineState = async () => {
    const [nextOutbox, nextPendingMedia] = await Promise.all([
      readOutbox(),
      readPendingMedia(project.id),
    ]);
    setOutbox(nextOutbox);
    setPendingMedia(nextPendingMedia);
  };

  const markPhotosWaiting = async (
    items: PendingMediaItem[],
    error: unknown,
    target?: { defectId?: string | null; defectClientId?: string | null; linkOperationId?: string | null },
  ) => {
    const status = isNetworkError(error) ? 'waiting' : 'error';
    const message = error instanceof Error ? error.message : 'Foto bleibt gesichert.';
    await Promise.all(
      items.map((item) =>
        upsertPendingMedia({
          ...item,
          status,
          error: message,
          target_defect_id: target?.defectId ?? item.target_defect_id ?? null,
          target_defect_client_id: target?.defectClientId ?? item.target_defect_client_id ?? null,
          link_client_operation_id: target?.linkOperationId ?? item.link_client_operation_id ?? null,
          updated_at: new Date().toISOString(),
        }),
      ),
    );
  };

  const markVoiceWaiting = async (item: PendingMediaItem, error: unknown) => {
    const status = isNetworkError(error) ? 'waiting' : 'error';
    const latestItem = await readPendingMediaByClientId(item.client_id);
    const baseItem = latestItem
      ? {
          ...item,
          ...latestItem,
          target_defect_id: item.target_defect_id ?? latestItem.target_defect_id ?? null,
          link_client_operation_id: item.link_client_operation_id ?? latestItem.link_client_operation_id ?? null,
        }
      : item;
    await upsertPendingMedia({
      ...baseItem,
      status,
      error: error instanceof Error ? error.message : 'Sprachnotiz bleibt gesichert.',
      updated_at: new Date().toISOString(),
    });
  };

  const uploadAndLinkPhotos = async (defectId: string, items: PendingMediaItem[]) => {
    let linkedPhotos: { clientId: string; link: DefectMediaLink }[] = [];
    for (const item of items) {
      const prepared = {
        ...item,
        target_defect_id: defectId,
        link_client_operation_id: item.link_client_operation_id ?? item.client_id,
        updated_at: new Date().toISOString(),
      };
      await upsertPendingMedia(prepared);
      const uploaded = prepared.media_asset_id ? prepared : await uploadQueuedMedia(session, prepared);
      if (!uploaded.media_asset_id) {
        throw new Error('Foto wurde nicht hochgeladen.');
      }
      await upsertPendingMedia(uploaded);
      const link = await defectsApi.linkMedia(session, defectId, uploaded.media_asset_id, {
        client_id: uploaded.link_client_operation_id ?? uploaded.client_id,
      });
      mergeMediaLinkIntoDefect(defectId, link, uploaded.client_id);
      await markPendingMediaLinked(uploaded.client_id);
      linkedPhotos = [...linkedPhotos, { clientId: uploaded.client_id, link }];
    }
    return linkedPhotos;
  };

  const uploadAndAttachVoice = async (
    defectId: string,
    draft: DefectVoiceDraft,
    pendingVoice: PendingMediaItem,
  ) => {
    const uploaded = pendingVoice.media_asset_id ? pendingVoice : await uploadQueuedMedia(session, pendingVoice);
    if (!uploaded.media_asset_id) {
      throw new Error('Sprachnotiz wurde nicht hochgeladen.');
    }
    await upsertPendingMedia(uploaded);
    const voiceNote = await voiceNotesApi.create(session, project.id, {
      media_asset_id: uploaded.media_asset_id,
      target_type: 'defect_description',
      defect_id: defectId,
      transcript: draft.transcript.trim() || null,
      transcript_status: draft.transcript.trim() ? 'confirmed' : 'open',
      client_id: uploaded.link_client_operation_id ?? uploaded.client_id,
    });
    await markPendingMediaLinked(uploaded.client_id);
    return voiceNote;
  };

  const cacheVoiceDraft = async (draft: DefectVoiceDraft) =>
    cacheAssetForOffline(project.id, draft.asset, 'audio', 'recording');

  const clearDefectVoiceDraft = () => {
    setRecordedVoiceAsset(null);
    setVoiceTranscript('');
  };

  const pendingMediaAssetId = (clientId: string) => `pending:${clientId}`;
  const pendingMediaLinkId = (clientId: string) => `pending-link:${clientId}`;

  const pendingDefectFromPayload = (
    payload: DefectCreateInput,
    photoDrafts: PendingMediaItem[] = [],
  ): Defect => {
    const now = new Date().toISOString();
    const clientId = payload.client_id || clientOperationId();
    const defectId = pendingDefectId(clientId);
    const base: Defect = {
      id: defectId,
      project_id: project.id,
      kind: payload.kind,
      local_label: payload.local_label,
      report_sort_order: defects.length + 1,
      trade_id: payload.trade_id ?? null,
      trade_name_snapshot: payload.trade_name_snapshot ?? null,
      category: payload.category ?? null,
      description: payload.description,
      ai_status: 'open',
      created_by: session.user.id,
      created_at: now,
      updated_at: now,
      revision: 1,
      client_id: clientId,
      media_links: [],
    };
    return withPendingPhotoLinks(base, photoDrafts);
  };

  const pendingPhotoMediaAsset = (item: PendingMediaItem): MediaAsset => ({
    id: pendingMediaAssetId(item.client_id),
    project_id: item.project_id,
    media_type: 'photo',
    storage_bucket: 'local-pending',
    storage_path: item.local_uri,
    mime_type: item.mime_type,
    file_size: item.file_size,
    width: item.width,
    height: item.height,
    duration_seconds: item.duration_seconds,
    caption: item.caption,
    caption_status: item.caption?.trim() ? 'edited' : item.status === 'error' ? 'error' : 'open',
    created_by: session.user.id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    signed_url: item.local_uri,
  });

  const pendingPhotoLink = (
    defectId: string,
    item: PendingMediaItem,
    sortOrder: number,
  ): DefectMediaLink => ({
    id: pendingMediaLinkId(item.client_id),
    defect_id: defectId,
    media_asset_id: pendingMediaAssetId(item.client_id),
    sort_order: sortOrder,
    include_in_report: true,
    created_at: item.created_at,
    client_id: item.client_id,
    media_asset: pendingPhotoMediaAsset(item),
  });

  const withPendingPhotoLinks = (defect: Defect, items: PendingMediaItem[]): Defect => ({
    ...defect,
    media_links: [
      ...defect.media_links.filter(
        (link) => !items.some((item) => link.client_id === item.client_id),
      ),
      ...items.map((item, index) =>
        pendingPhotoLink(defect.id, item, defect.media_links.length + index),
      ),
    ],
  });

  const mergeMediaLinkIntoDefect = (
    defectId: string,
    link: DefectMediaLink,
    replacedClientId?: string,
  ) => {
    setDefects((current) =>
      current.map((defect) =>
        defect.id === defectId
          ? {
              ...defect,
              media_links: [
                ...defect.media_links.filter(
                  (existing) =>
                    existing.id !== link.id &&
                    existing.media_asset_id !== link.media_asset_id &&
                    existing.client_id !== replacedClientId &&
                    existing.id !== (replacedClientId ? pendingMediaLinkId(replacedClientId) : ''),
                ),
                link,
              ].sort((left, right) => left.sort_order - right.sort_order),
            }
          : defect,
      ),
    );
  };

  const mergeVoiceNote = (voiceNote: VoiceNote) => {
    setVoiceNotes((current) => [
      ...current.filter((item) => item.id !== voiceNote.id),
      voiceNote,
    ]);
  };

  const outboxDefectClientId = (item: OutboxItem) => {
    if (typeof item.payload.client_id === 'string') {
      return item.payload.client_id;
    }
    const nested = item.payload.defect;
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
      return null;
    }
    const clientId = (nested as Record<string, unknown>).client_id;
    return typeof clientId === 'string' ? clientId : null;
  };

  const updatePendingDefectOutbox = async (clientId: string, input: DefectUpdateInput | null) => {
    const currentOutbox = await readOutbox();
    await writeOutbox(
      currentOutbox.flatMap((item) => {
        if (outboxDefectClientId(item) !== clientId) {
          return [item];
        }
        if (!input) {
          return [];
        }
        if (item.payload.defect && typeof item.payload.defect === 'object' && !Array.isArray(item.payload.defect)) {
          return [
            {
              ...item,
              payload: {
                ...item.payload,
                defect: {
                  ...(item.payload.defect as Record<string, unknown>),
                  ...input,
                },
              },
            },
          ];
        }
        return [
          {
            ...item,
            payload: {
              ...item.payload,
              ...input,
            },
          },
        ];
      }),
    );
    setOutbox(await readOutbox());
  };

  const queueDefectWithAttachments = async (
    payload: DefectCreateInput,
    items: PendingMediaItem[],
    voiceDraft?: DefectVoiceDraft,
    error: unknown = new ApiError('Offline gespeichert.', 0, 'NETWORK_ERROR'),
  ): Promise<Defect> => {
    await markPhotosWaiting(items, new ApiError('Offline gespeichert.', 0, 'NETWORK_ERROR'), {
      defectClientId: payload.client_id ?? null,
    });
    const pendingVoice = voiceDraft ? await cacheVoiceDraft(voiceDraft) : null;
    if (pendingVoice) {
      await markVoiceWaiting(pendingVoice, error);
    }
    const outboxItem: OutboxItem = {
      client_operation_id: clientOperationId(),
      type: pendingVoice ? 'defect.create_with_media_and_voice' : 'defect.create_with_media',
      payload: {
        project_id: project.id,
        defect: payload,
        pending_media_client_ids: items.map((item) => item.client_id),
        ...(pendingVoice ? { pending_voice_client_id: pendingVoice.client_id } : {}),
        ...(pendingVoice ? { voice_transcript: voiceDraft?.transcript ?? '' } : {}),
      },
      created_at: new Date().toISOString(),
      status: 'waiting',
    };
    await appendOutbox(outboxItem);
    const pendingDefect = pendingDefectFromPayload(payload, items);
    setDefects((current) => [
      ...current.filter((item) => item.id !== pendingDefect.id && item.client_id !== pendingDefect.client_id),
      pendingDefect,
    ]);
    setSelectedDefectId(pendingDefect.id);
    await refreshOfflineState();
    resetDefectForm(payload.local_label);
    setDefectPhotoDrafts([]);
    if (pendingVoice) {
      clearDefectVoiceDraft();
    }
    setNotice(pendingVoice ? 'Eintrag, Fotos und Ton gesichert.' : 'Eintrag und Fotos gesichert.');
    return pendingDefect;
  };

  const queuePhotoAttachment = async (
    defectId: string,
    items: PendingMediaItem[],
    error: unknown,
  ) => {
    const linkOperationId =
      items.find((item) => item.link_client_operation_id)?.link_client_operation_id ?? clientOperationId();
    await markPhotosWaiting(items, error, { defectId, linkOperationId });
    const currentOutbox = await readOutbox();
    if (currentOutbox.some((item) => item.client_operation_id === linkOperationId)) {
      await refreshOfflineState();
      return linkOperationId;
    }
    await appendOutbox({
      client_operation_id: linkOperationId,
      type: 'defect.attach_media',
      payload: {
        project_id: project.id,
        defect_id: defectId,
        pending_media_client_ids: items.map((item) => item.client_id),
      },
      created_at: new Date().toISOString(),
      status: isNetworkError(error) ? 'waiting' : 'error',
      error: error instanceof Error ? error.message : 'Foto-Zuordnung wartet.',
    });
    await refreshOfflineState();
    return linkOperationId;
  };

  const queueVoiceAttachment = async (
    defectId: string,
    voiceDraft: DefectVoiceDraft,
    error: unknown,
    existingPendingVoice?: PendingMediaItem,
  ) => {
    const pendingVoice = existingPendingVoice ?? (await cacheVoiceDraft(voiceDraft));
    const operationId = pendingVoice.link_client_operation_id ?? clientOperationId();
    const queuedPendingVoice = {
      ...pendingVoice,
      target_defect_id: defectId,
      link_client_operation_id: operationId,
    };
    await markVoiceWaiting(queuedPendingVoice, error);
    const currentOutbox = await readOutbox();
    if (currentOutbox.some((item) => item.client_operation_id === operationId)) {
      await refreshOfflineState();
      return { operationId, pendingVoice: queuedPendingVoice };
    }
    await appendOutbox({
      client_operation_id: operationId,
      type: 'defect.attach_voice',
      payload: {
        project_id: project.id,
        defect_id: defectId,
        pending_voice_client_id: pendingVoice.client_id,
        voice_transcript: voiceDraft.transcript,
      },
      created_at: new Date().toISOString(),
      status: isNetworkError(error) ? 'waiting' : 'error',
      error: error instanceof Error ? error.message : 'Sprachnotiz wartet.',
    });
    await refreshOfflineState();
    return { operationId, pendingVoice: queuedPendingVoice };
  };

  const currentDefectPayload = (allowVoiceOnly = false): DefectCreateInput | null => {
    const description = defectForm.description.trim();
    const localLabel = defectForm.local_label.trim();
    if (!description && !allowVoiceOnly) {
      return null;
    }
    if (!localLabel) {
      return null;
    }
    return {
      kind: defectForm.kind,
      description: description || VOICE_TRANSCRIPT_PENDING_DESCRIPTION,
      local_label: localLabel,
      trade_id: defectForm.trade_id || undefined,
      trade_name_snapshot: defectForm.trade_name_snapshot?.trim() || undefined,
      category: defectForm.category?.trim() || undefined,
      client_id: defectForm.client_id || undefined,
    };
  };

  const createDefectWithPayload = async (
    payload: DefectCreateInput,
    photoDrafts: PendingMediaItem[] = [],
    voiceDraft?: DefectVoiceDraft,
    options: CreateDefectOptions = {},
  ): Promise<Defect | null> => {
    const shouldResetForm = options.resetForm ?? true;
    const shouldSwitchToEntries = options.switchToEntries ?? true;
    const payloadWithClientId = {
      ...payload,
      client_id: payload.client_id || clientOperationId(),
    };
    setBusy('defect');
    setError(null);
    setNotice(null);
    try {
      const defect = await defectsApi.create(session, project.id, payloadWithClientId);
      const defectWithClientId = {
        ...defect,
        client_id: defect.client_id ?? payloadWithClientId.client_id,
      };
      const optimisticDefect = withPendingPhotoLinks(defectWithClientId, photoDrafts);
      setDefects((current) => [
        ...current.filter((item) => item.id !== defect.id && item.client_id !== optimisticDefect.client_id),
        optimisticDefect,
      ]);
      setSelectedDefectId(defect.id);
      if (shouldSwitchToEntries) {
        navigateToTab('entries');
      }
      if (shouldResetForm) {
        resetDefectForm(defect.local_label);
      }
      if (voiceDraft) {
        clearDefectVoiceDraft();
      }
      if (shouldResetForm) {
        setDefectPhotoDrafts([]);
      }
      setNotice(
        photoDrafts.length || voiceDraft
          ? 'Eintrag gespeichert. Fotos und Ton werden im Hintergrund verarbeitet.'
          : 'Eintrag gespeichert.',
      );
      void processDefectAttachmentsInBackground(defectWithClientId, payloadWithClientId, photoDrafts, voiceDraft);
      return optimisticDefect;
    } catch (createError) {
      if (createError instanceof ApiError && createError.code === 'NETWORK_ERROR') {
        if (photoDrafts.length || voiceDraft) {
          const queuedDefect = await queueDefectWithAttachments(
            payloadWithClientId,
            photoDrafts,
            voiceDraft,
            createError,
          );
          if (shouldSwitchToEntries) {
            navigateToTab('entries');
          }
          return queuedDefect;
        } else {
          const outboxItem: OutboxItem = {
            client_operation_id: clientOperationId(),
            type: 'defect.create',
            payload: { ...payloadWithClientId, project_id: project.id },
            created_at: new Date().toISOString(),
            status: 'waiting',
          };
          await appendOutbox(outboxItem);
          const pendingDefect = pendingDefectFromPayload(payloadWithClientId);
          setDefects((current) => [
            ...current.filter((item) => item.id !== pendingDefect.id && item.client_id !== pendingDefect.client_id),
            pendingDefect,
          ]);
          setSelectedDefectId(pendingDefect.id);
          setOutbox(await readOutbox());
          if (shouldResetForm) {
            resetDefectForm(payloadWithClientId.local_label);
          }
          setNotice('Eintrag gesichert.');
          if (shouldSwitchToEntries) {
            navigateToTab('entries');
          }
          return pendingDefect;
        }
      } else {
        setError(createError instanceof Error ? createError.message : 'Eintrag konnte nicht gespeichert werden.');
      }
      return null;
    } finally {
      setBusy(null);
    }
  };

  const processDefectAttachmentsInBackground = async (
    defect: Defect,
    payload: DefectCreateInput,
    photoDrafts: PendingMediaItem[],
    voiceDraft?: DefectVoiceDraft,
  ) => {
    if (photoDrafts.length) {
      let linkedClientIds: string[] = [];
      const linkOperationId = await queuePhotoAttachment(
        defect.id,
        photoDrafts,
        new ApiError('Foto-Zuordnung vorgemerkt.', 0, 'NETWORK_ERROR'),
      );
      try {
        const linkedPhotos = await uploadAndLinkPhotos(defect.id, photoDrafts);
        linkedClientIds = linkedPhotos.map((item) => item.clientId);
        await deleteOutboxItem(linkOperationId);
        await refreshOfflineState();
        setNotice('Fotos am Eintrag gespeichert.');
      } catch (photoError) {
        const remainingPhotos = photoDrafts.filter(
          (item) => !linkedClientIds.includes(item.client_id),
        );
        await queuePhotoAttachment(defect.id, remainingPhotos, photoError);
        setNotice('Eintrag bleibt sichtbar. Fotos bleiben gesichert.');
      }
    }

    if (voiceDraft) {
      const { operationId, pendingVoice } = await queueVoiceAttachment(
        defect.id,
        voiceDraft,
        new ApiError('Sprachnotiz vorgemerkt.', 0, 'NETWORK_ERROR'),
      );
      try {
        const voiceNote = await uploadAndAttachVoice(defect.id, voiceDraft, pendingVoice);
        mergeVoiceNote(voiceNote);
        await deleteOutboxItem(operationId);
        await refreshOfflineState();
        setNotice('Sprachnotiz gespeichert. Transkription laeuft im Hintergrund.');
        if (onVoiceNoteCreated) {
          void onVoiceNoteCreated(voiceNote, payload.description)
            .then(async (applied) => {
              if (applied) {
                await loadDetail();
              }
              setNotice(
                applied
                  ? 'Transkript wurde am Eintrag ergaenzt.'
                  : 'Sprachnotiz gespeichert. Transkription kann spaeter wiederholt werden.',
              );
            })
            .catch(() => {
              setNotice('Sprachnotiz gespeichert. Transkription kann spaeter wiederholt werden.');
            });
        }
      } catch (voiceError) {
        const latestPendingVoice = await readPendingMediaByClientId(pendingVoice.client_id);
        await markVoiceWaiting(latestPendingVoice ?? pendingVoice, voiceError);
        await refreshOfflineState();
        setNotice('Eintrag bleibt sichtbar. Sprachnotiz bleibt gesichert.');
      }
    }
  };

  const createDefect = async () => {
    const voiceDraft = recordedVoiceAsset ? { asset: recordedVoiceAsset, transcript: voiceTranscript } : undefined;
    if (!defectForm.local_label.trim()) {
      setError('Bitte eine Arbeitsnummer eintragen.');
      return;
    }
    const payload = currentDefectPayload(Boolean(voiceDraft));
    if (!payload || busy) {
      return;
    }
    await createDefectWithPayload(payload, defectPhotoDrafts, voiceDraft);
  };

  const updateDefectPhotoCaption = (clientId: string, caption: string) => {
    setDefectPhotoDrafts((current) =>
      current.map((item) => {
        if (item.client_id !== clientId) {
          return item;
        }
        const next = { ...item, caption, updated_at: new Date().toISOString() };
        void upsertPendingMedia(next);
        return next;
      }),
    );
    setPendingMedia((current) =>
      current.map((item) =>
        item.client_id === clientId ? { ...item, caption, updated_at: new Date().toISOString() } : item,
      ),
    );
  };

  const addDefectPhoto = async (mode: 'camera' | 'library') => {
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
      setDefectPhotoDrafts((current) => [...current, cached]);
      setPendingMedia(await readPendingMedia(project.id));
      setNotice('Foto zum neuen Eintrag hinzugefuegt.');
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Foto konnte nicht vorgemerkt werden.');
    } finally {
      setBusy(null);
    }
  };

  const addPhotoToDefect = async (defectId: string, mode: 'camera' | 'library') => {
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
    let cached: PendingMediaItem | null = null;
    try {
      cached = await cacheAssetForOffline(project.id, result.assets[0], 'photo', mode);
      mergeMediaLinkIntoDefect(defectId, pendingPhotoLink(defectId, cached, 0), cached.client_id);
      const linkOperationId = await queuePhotoAttachment(
        defectId,
        [cached],
        new ApiError('Foto-Zuordnung vorgemerkt.', 0, 'NETWORK_ERROR'),
      );
      setNotice('Foto am Eintrag gesichert.');
      void (async () => {
        try {
          await uploadAndLinkPhotos(defectId, [cached]);
          await deleteOutboxItem(linkOperationId);
          await refreshOfflineState();
          setNotice('Foto am Eintrag gespeichert.');
        } catch (photoError) {
          const fallback = cached ?? (await cacheAssetForOffline(project.id, result.assets[0], 'photo', mode));
          await queuePhotoAttachment(defectId, [fallback], photoError);
        }
      })();
    } catch (photoError) {
      const fallback = cached ?? (await cacheAssetForOffline(project.id, result.assets[0], 'photo', mode));
      mergeMediaLinkIntoDefect(defectId, pendingPhotoLink(defectId, fallback, 0), fallback.client_id);
      await queuePhotoAttachment(defectId, [fallback], photoError);
      setNotice('Foto am Eintrag gesichert.');
    } finally {
      setBusy(null);
    }
  };

  const removeDefectPhoto = async (clientId: string) => {
    if (busy) {
      return;
    }
    setBusy('defect-photo');
    setError(null);
    setNotice(null);
    try {
      await deletePendingMedia(clientId);
      setDefectPhotoDrafts((current) => current.filter((item) => item.client_id !== clientId));
      setPendingMedia(await readPendingMedia(project.id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Foto konnte nicht entfernt werden.');
    } finally {
      setBusy(null);
    }
  };

  const updateDefect = async (defectId: string, input: DefectUpdateInput) => {
    if (busy) {
      return;
    }
    const defect = defects.find((item) => item.id === defectId);
    if (!defect) {
      setError('Eintrag wurde nicht gefunden.');
      return;
    }

    const optimisticDefect = {
      ...defect,
      ...input,
      trade_name_snapshot:
        input.trade_name_snapshot === undefined ? defect.trade_name_snapshot : input.trade_name_snapshot,
      category: input.category === undefined ? defect.category : input.category,
      updated_at: new Date().toISOString(),
    };

    setBusy(`defect-update-${defectId}`);
    setError(null);
    setNotice(null);
    setDefects((current) => current.map((item) => (item.id === defectId ? optimisticDefect : item)));
    try {
      const pendingClientId = pendingDefectClientId(defectId);
      if (pendingClientId) {
        await updatePendingDefectOutbox(pendingClientId, input);
        setNotice('Lokalen Eintrag aktualisiert.');
        return;
      }

      const updated = await defectsApi.update(session, defectId, input);
      setDefects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await loadDetail();
      setNotice('Eintrag gespeichert.');
    } catch (updateError) {
      if (isNetworkError(updateError)) {
        await appendOutbox({
          client_operation_id: clientOperationId(),
          type: 'defect.update',
          payload: {
            id: defectId,
            project_id: project.id,
            ...input,
            base_revision: defect.revision,
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: updateError.message,
        });
        setOutbox(await readOutbox());
        setNotice('Eintrag lokal gespeichert und wird spaeter uebertragen.');
      } else {
        setDefects((current) => current.map((item) => (item.id === defectId ? defect : item)));
        setError(updateError instanceof Error ? updateError.message : 'Eintrag konnte nicht gespeichert werden.');
      }
    } finally {
      setBusy(null);
    }
  };

  const deleteDefect = async (defectId: string) => {
    if (busy) {
      return;
    }
    const defect = defects.find((item) => item.id === defectId);
    if (!defect) {
      setError('Eintrag wurde nicht gefunden.');
      return;
    }
    const remainingDefects = defects.filter((item) => item.id !== defectId);

    setBusy(`defect-delete-${defectId}`);
    setError(null);
    setNotice(null);
    setDefects(remainingDefects);
    setSelectedDefectId((current) => (current === defectId ? remainingDefects[0]?.id ?? null : current));
    try {
      const pendingClientId = pendingDefectClientId(defectId);
      if (pendingClientId) {
        await updatePendingDefectOutbox(pendingClientId, null);
        setNotice('Lokalen Eintrag geloescht.');
        return;
      }

      await defectsApi.remove(session, defectId);
      await loadDetail();
      setNotice('Eintrag geloescht.');
    } catch (deleteError) {
      if (isNetworkError(deleteError)) {
        await appendOutbox({
          client_operation_id: clientOperationId(),
          type: 'defect.delete',
          payload: {
            id: defectId,
            project_id: project.id,
            base_revision: defect.revision,
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: deleteError.message,
        });
        setOutbox(await readOutbox());
        setNotice('Eintrag lokal geloescht und wird spaeter uebertragen.');
      } else {
        setDefects(defects);
        setSelectedDefectId(defectId);
        setError(deleteError instanceof Error ? deleteError.message : 'Eintrag konnte nicht geloescht werden.');
      }
    } finally {
      setBusy(null);
    }
  };

  const moveDefect = async (defectId: string, direction: -1 | 1) => {
    const currentIndex = defects.findIndex((defect) => defect.id === defectId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= defects.length || busy) {
      return;
    }

    const reordered = defects.map((defect, index) => {
      if (index === currentIndex) {
        return defects[nextIndex];
      }
      if (index === nextIndex) {
        return defects[currentIndex];
      }
      return defect;
    });

    setBusy('defect-reorder');
    setError(null);
    setNotice(null);
    setDefects(reordered);
    try {
      const nextDefects = await defectsApi.reorder(
        session,
        project.id,
        reordered.map((defect) => defect.id),
      );
      setDefects(nextDefects);
      setNotice('Eintragsreihenfolge gespeichert.');
    } catch (reorderError) {
      if (isNetworkError(reorderError)) {
        await appendOutbox({
          client_operation_id: clientOperationId(),
          type: 'defects.reorder',
          payload: {
            project_id: project.id,
            defect_ids: reordered.map((defect) => defect.id),
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: reorderError.message,
        });
        setOutbox(await readOutbox());
        setNotice('Eintragsreihenfolge lokal gespeichert.');
      } else {
        setDefects(defects);
        setError(reorderError instanceof Error ? reorderError.message : 'Reihenfolge konnte nicht gespeichert werden.');
      }
    } finally {
      setBusy(null);
    }
  };

  const retryOutbox = async () => {
    const [currentOutbox, currentPendingMedia] = await Promise.all([
      readOutbox(),
      readPendingMedia(project.id),
    ]);
    if ((!currentOutbox.length && !currentPendingMedia.length) || busy) {
      return;
    }
    setBusy('sync');
    setError(null);
    try {
      await syncOfflineQueues(session);
      const remaining = await readOutbox();
      setOutbox(remaining);
      setPendingMedia(await readPendingMedia(project.id));
      await loadDetail();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Übertragung konnte nicht abgeschlossen werden.');
    } finally {
      setBusy(null);
    }
  };

  return {
    addDefectPhoto,
    addPhotoToDefect,
    createDefect,
    createDefectWithPayload,
    deleteDefect,
    currentDefectPayload,
    moveDefect,
    removeDefectPhoto,
    retryOutbox,
    updateDefect,
    updateDefectPhotoCaption,
  };
}
