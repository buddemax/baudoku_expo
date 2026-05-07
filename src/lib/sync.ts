import type { Session } from '@supabase/supabase-js';

import { aiApi, ApiError, defectsApi, plansApi, syncApi, voiceNotesApi } from './api';
import {
  markPendingMediaLinked,
  readPendingMediaByClientId,
  readOutbox,
  readPendingMedia,
  type OutboxItem,
  type PendingMediaItem,
  upsertPendingMedia,
  writeOutbox,
  writeSyncSnapshot,
} from './offlineStore';
import type { Defect, DefectCreateInput } from '../types/projects';
import { appliedOperationIds, rejectedOperationErrors, rejectedOperationMessage } from './syncResult';
import { uploadProjectFile } from './uploadProjectFile';

export type OfflineSyncResult = {
  uploadedMedia: number;
  outboxApplied: number;
  outboxRemaining: number;
  pulled: boolean;
};

export const uploadQueuedMedia = async (
  session: Session,
  item: PendingMediaItem,
): Promise<PendingMediaItem> => {
  const attemptStartedAt = new Date().toISOString();
  let currentItem: PendingMediaItem = {
    ...item,
    status: 'waiting',
    upload_attempts: (item.upload_attempts ?? 0) + 1,
    last_upload_attempt_at: attemptStartedAt,
    updated_at: attemptStartedAt,
    error: null,
  };
  await upsertPendingMedia(currentItem);

  const media = await uploadProjectFile(
    session,
    item.project_id,
    {
      uri: currentItem.local_uri,
      fileName: currentItem.file_name,
      mimeType: currentItem.mime_type,
      fileSize: currentItem.file_size ?? undefined,
      width: currentItem.width ?? undefined,
      height: currentItem.height ?? undefined,
      duration_seconds: currentItem.duration_seconds,
      caption: currentItem.caption ?? null,
    },
    currentItem.media_type,
    {
      clientId: currentItem.client_id,
      reservation: {
        media_id: currentItem.upload_media_id,
        storage_bucket: currentItem.upload_storage_bucket,
        storage_path: currentItem.upload_storage_path,
        upload_token: currentItem.upload_token,
        upload_token_created_at: currentItem.upload_token_created_at,
      },
      onReservation: async (reservation) => {
        currentItem = {
          ...currentItem,
          upload_media_id: reservation.media_id,
          upload_storage_bucket: reservation.storage_bucket,
          upload_storage_path: reservation.storage_path,
          upload_token: reservation.upload_token,
          upload_token_created_at: reservation.upload_token_created_at,
          updated_at: new Date().toISOString(),
        };
        await upsertPendingMedia(currentItem);
      },
    },
  );
  return {
    ...currentItem,
    media_asset_id: media.id,
    media_asset: media,
    status: 'uploaded',
    error: null,
    updated_at: new Date().toISOString(),
  };
};

const localDefectMediaOperationTypes = new Set([
  'defect.create_with_media',
  'defect.create_with_media_and_voice',
  'defect.attach_media',
  'defect.attach_voice',
  'plan_marker.create_for_pending_defect',
  'plan.create_with_source',
]);

const isLocalDefectMediaOperation = (item: OutboxItem) =>
  localDefectMediaOperationTypes.has(item.type);

const pendingMediaByClientId = (items: PendingMediaItem[]) =>
  new Map(items.map((item) => [item.client_id, item]));

const payloadString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : null;
};

const payloadStringList = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
};

const payloadNumber = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const payloadPlanFileType = (payload: Record<string, unknown>) => {
  const value = payload.file_type;
  return value === 'jpg' || value === 'png' || value === 'pdf' ? value : null;
};

const resolveDefectIdByClientId = async (
  session: Session,
  projectId: string,
  clientId: string,
  resolvedDefects: Map<string, string>,
) => {
  const alreadyResolved = resolvedDefects.get(clientId);
  if (alreadyResolved) {
    return alreadyResolved;
  }

  const defects = await defectsApi.list(session, projectId);
  const defect = defects.find((item) => item.client_id === clientId);
  if (!defect) {
    return null;
  }
  resolvedDefects.set(clientId, defect.id);
  return defect.id;
};

const uploadAndLinkPendingMedia = async (
  session: Session,
  defectId: string,
  clientIds: string[],
) => {
  const currentPendingMedia = pendingMediaByClientId(await readPendingMedia());
  for (const clientId of clientIds) {
    const item = currentPendingMedia.get(clientId);
    if (!item) {
      continue;
    }
    const uploaded = item.media_asset_id ? item : await uploadQueuedMedia(session, item);
    if (!uploaded.media_asset_id) {
      throw new Error('Foto wurde nicht hochgeladen.');
    }
    await upsertPendingMedia(uploaded);
    await defectsApi.linkMedia(session, defectId, uploaded.media_asset_id, {
      client_id: uploaded.link_client_operation_id ?? uploaded.client_id,
    });
    await markPendingMediaLinked(clientId);
  }
};

const uploadAndAttachPendingVoice = async (
  session: Session,
  projectId: string,
  defectId: string,
  clientId: string,
  transcript: string | null,
) => {
  const currentPendingMedia = pendingMediaByClientId(await readPendingMedia());
  const item = currentPendingMedia.get(clientId);
  if (!item) {
    throw new Error('Offline-Sprachnotiz wurde nicht gefunden.');
  }
  const uploaded = item.media_asset_id ? item : await uploadQueuedMedia(session, item);
  if (!uploaded.media_asset_id) {
    throw new Error('Sprachnotiz wurde nicht hochgeladen.');
  }
  await upsertPendingMedia(uploaded);
  const voiceNote = await voiceNotesApi.create(session, projectId, {
    media_asset_id: uploaded.media_asset_id,
    target_type: 'defect_description',
    defect_id: defectId,
    transcript: transcript?.trim() || null,
    transcript_status: transcript?.trim() ? 'edited' : 'open',
    client_id: uploaded.link_client_operation_id ?? uploaded.client_id,
  });
  await markPendingMediaLinked(clientId);
  if (!transcript?.trim()) {
    try {
      await aiApi.createTranscription(session, voiceNote.id);
    } catch {
      // Detail refresh handles automatic retries; sync must not duplicate the voice note.
    }
  }
};

const applyLocalDefectMediaOperation = async (
  session: Session,
  item: OutboxItem,
  resolvedDefects: Map<string, string>,
): Promise<Defect | null> => {
  const projectId = payloadString(item.payload, 'project_id');
  const pendingMediaClientIds = payloadStringList(item.payload, 'pending_media_client_ids');
  const pendingVoiceClientId = payloadString(item.payload, 'pending_voice_client_id');
  const voiceTranscript = payloadString(item.payload, 'voice_transcript');
  if (!projectId) {
    throw new Error('Offline-Mangel enthaelt kein Projekt.');
  }

  if (item.type === 'plan_marker.create_for_pending_defect') {
    const planFileId = payloadString(item.payload, 'plan_file_id');
    const pendingDefectClientId = payloadString(item.payload, 'pending_defect_client_id');
    const markerClientId = payloadString(item.payload, 'client_id') ?? item.client_operation_id;
    const xNorm = payloadNumber(item.payload, 'x_norm');
    const yNorm = payloadNumber(item.payload, 'y_norm');
    const pageNumber = payloadNumber(item.payload, 'page_number') ?? 1;
    if (!planFileId || !pendingDefectClientId || xNorm == null || yNorm == null) {
      throw new Error('Offline-Planmarker enthaelt keine gueltigen Markerdaten.');
    }
    const defectId = await resolveDefectIdByClientId(session, projectId, pendingDefectClientId, resolvedDefects);
    if (!defectId) {
      throw new Error('Offline-Planmarker wartet auf den zugehoerigen Mangel.');
    }
    const result = await syncApi.push(session, [
      {
        client_operation_id: item.client_operation_id,
        type: 'plan_marker.create',
        payload: {
          plan_file_id: planFileId,
          defect_id: defectId,
          x_norm: Math.max(0, Math.min(1, xNorm)),
          y_norm: Math.max(0, Math.min(1, yNorm)),
          page_number: pageNumber,
          client_id: markerClientId,
        },
      },
    ]);
    if (result.rejected.length) {
      throw new Error(rejectedOperationMessage(result.rejected[0]));
    }
    return null;
  }

  if (item.type === 'plan.create_with_source') {
    const pendingMediaClientId = payloadString(item.payload, 'pending_media_client_id');
    const name = payloadString(item.payload, 'name');
    const fileType = payloadPlanFileType(item.payload);
    const pageCount = payloadNumber(item.payload, 'page_count') ?? undefined;
    const planClientId = payloadString(item.payload, 'client_id') ?? item.client_operation_id;
    if (!pendingMediaClientId || !name || !fileType) {
      throw new Error('Offline-Plan enthaelt keine gueltigen Dateidaten.');
    }
    const pendingMedia = await readPendingMediaByClientId(pendingMediaClientId);
    if (!pendingMedia) {
      throw new Error('Offline-Plan-Datei wurde nicht gefunden.');
    }
    const uploaded = pendingMedia.media_asset_id ? pendingMedia : await uploadQueuedMedia(session, pendingMedia);
    if (!uploaded.media_asset_id) {
      throw new Error('Offline-Plan-Datei wurde nicht hochgeladen.');
    }
    await upsertPendingMedia(uploaded);
    await plansApi.create(session, projectId, {
      media_asset_id: uploaded.media_asset_id,
      name,
      file_type: fileType,
      page_count: pageCount,
      client_id: planClientId,
    });
    await markPendingMediaLinked(pendingMediaClientId);
    return null;
  }

  if (item.type === 'defect.attach_media') {
    if (!pendingMediaClientIds.length) {
      throw new Error('Offline-Zuordnung enthaelt keine Fotodaten.');
    }
    const defectId = payloadString(item.payload, 'defect_id');
    if (!defectId) {
      throw new Error('Offline-Zuordnung enthaelt keinen Mangel.');
    }
    await uploadAndLinkPendingMedia(session, defectId, pendingMediaClientIds);
    return null;
  }

  if (item.type === 'defect.attach_voice') {
    const defectId = payloadString(item.payload, 'defect_id');
    if (!defectId || !pendingVoiceClientId) {
      throw new Error('Offline-Sprachnotiz enthaelt keinen Mangel oder keine Aufnahme.');
    }
    await uploadAndAttachPendingVoice(session, projectId, defectId, pendingVoiceClientId, voiceTranscript);
    return null;
  }

  const defectPayload = item.payload.defect;
  if (!defectPayload || typeof defectPayload !== 'object' || Array.isArray(defectPayload)) {
    throw new Error('Offline-Mangel enthaelt keine gueltigen Mangeldaten.');
  }

  const defect = await defectsApi.create(session, projectId, defectPayload as DefectCreateInput);
  const defectClientId =
    typeof (defectPayload as DefectCreateInput).client_id === 'string'
      ? (defectPayload as DefectCreateInput).client_id
      : null;
  if (defectClientId) {
    resolvedDefects.set(defectClientId, defect.id);
  }
  if (pendingMediaClientIds.length) {
    await uploadAndLinkPendingMedia(session, defect.id, pendingMediaClientIds);
  }
  if (pendingVoiceClientId) {
    await uploadAndAttachPendingVoice(session, projectId, defect.id, pendingVoiceClientId, voiceTranscript);
  }
  return defect;
};

const waitingForNetwork = (error: unknown) =>
  error instanceof ApiError && (error.code === 'NETWORK_ERROR' || error.status === 0);

export const syncOfflineQueues = async (session: Session): Promise<OfflineSyncResult> => {
  let uploadedMedia = 0;
  let outboxApplied = 0;

  const pendingMediaItems = await readPendingMedia();
  for (const item of pendingMediaItems) {
    if (item.status === 'uploaded' || item.status === 'linked') {
      continue;
    }
    try {
      await upsertPendingMedia(await uploadQueuedMedia(session, item));
      uploadedMedia += 1;
    } catch (uploadError) {
      const latestItem = (await readPendingMediaByClientId(item.client_id)) ?? item;
      await upsertPendingMedia({
        ...latestItem,
        status: waitingForNetwork(uploadError) ? 'waiting' : 'error',
        error: uploadError instanceof Error ? uploadError.message : 'Upload fehlgeschlagen.',
        updated_at: new Date().toISOString(),
      });
    }
  }

  const currentOutbox = await readOutbox();
  const locallyAppliedIds = new Set<string>();
  const serverAppliedIds = new Set<string>();
  const localFailures = new Map<string, OutboxItem>();
  const resolvedDefects = new Map<string, string>();
  const pendingMarkerItems = currentOutbox.filter((item) => item.type === 'plan_marker.create_for_pending_defect');
  const primaryLocalItems = currentOutbox
    .filter(isLocalDefectMediaOperation)
    .filter((item) => item.type !== 'plan_marker.create_for_pending_defect');

  for (const item of primaryLocalItems) {
    try {
      await applyLocalDefectMediaOperation(session, item, resolvedDefects);
      locallyAppliedIds.add(item.client_operation_id);
    } catch (localError) {
      localFailures.set(item.client_operation_id, {
        ...item,
        status: waitingForNetwork(localError) ? 'waiting' : 'error',
        error: localError instanceof Error ? localError.message : 'Offline-Sync fehlgeschlagen.',
      });
    }
  }

  const serverOutbox = currentOutbox.filter(
    (item) => !isLocalDefectMediaOperation(item) && !locallyAppliedIds.has(item.client_operation_id),
  );
  if (serverOutbox.length) {
    const result = await syncApi.push(
      session,
      serverOutbox.map((item) => ({
        client_operation_id: item.client_operation_id,
        type: item.type,
        payload: item.payload,
      })),
    );
    const appliedIds = appliedOperationIds(result.applied);
    const rejectedErrors = rejectedOperationErrors(result.rejected);
    appliedIds.forEach((id) => serverAppliedIds.add(id));
    rejectedErrors.forEach((message, id) => {
      const outboxItem = serverOutbox.find((item) => item.client_operation_id === id);
      if (outboxItem) {
        localFailures.set(id, {
          ...outboxItem,
          status: 'error',
          error: message,
        });
      }
    });
  }

  for (const item of pendingMarkerItems) {
    if (locallyAppliedIds.has(item.client_operation_id) || serverAppliedIds.has(item.client_operation_id)) {
      continue;
    }
    try {
      await applyLocalDefectMediaOperation(session, item, resolvedDefects);
      locallyAppliedIds.add(item.client_operation_id);
    } catch (localError) {
      localFailures.set(item.client_operation_id, {
        ...item,
        status: waitingForNetwork(localError) ? 'waiting' : 'error',
        error: localError instanceof Error ? localError.message : 'Offline-Sync fehlgeschlagen.',
      });
    }
  }

  if (currentOutbox.length) {
    const appliedIds = new Set([...locallyAppliedIds, ...serverAppliedIds]);
    outboxApplied = appliedIds.size;
    await writeOutbox(
      currentOutbox
        .filter((item) => !appliedIds.has(item.client_operation_id))
        .map((item) => localFailures.get(item.client_operation_id) ?? item),
    );
  }

  const snapshot = await syncApi.pull(session);
  await writeSyncSnapshot(snapshot);
  const remainingOutbox = await readOutbox();

  return {
    uploadedMedia,
    outboxApplied,
    outboxRemaining: remainingOutbox.length,
    pulled: true,
  };
};
