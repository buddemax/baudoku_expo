import type { Session } from '@supabase/supabase-js';
import type { Dispatch, SetStateAction } from 'react';

import { aiApi, ApiError, mediaApi } from '../../../lib/api';
import { isAiUnavailableError, isNetworkError } from '../../../lib/api/errors';
import {
  appendOutbox,
  deletePendingMedia,
  readPendingMedia,
  type PendingMediaItem,
} from '../../../lib/offlineStore';
import type { Defect, DraftStatus, MediaAsset } from '../../../types/projects';
import { resolveAiJob } from './ai';
import { aiJobText } from './helpers';

export function useMediaActions({
  busy,
  loadDetail,
  mediaCaptionDrafts,
  session,
  setBusy,
  setError,
  setMediaAiSuggestions,
  setMediaCaptionDrafts,
  setDefects,
  setPendingMedia,
  setNotice,
  onCaptionDraftChanged,
  onCaptionSaved,
}: {
  busy: string | null;
  loadDetail: () => Promise<void>;
  mediaCaptionDrafts: Record<string, string>;
  session: Session;
  setBusy: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setMediaAiSuggestions: Dispatch<SetStateAction<Record<string, string>>>;
  setMediaCaptionDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setDefects: Dispatch<SetStateAction<Defect[]>>;
  setPendingMedia: Dispatch<SetStateAction<PendingMediaItem[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  onCaptionDraftChanged?: (mediaAssetId: string) => void;
  onCaptionSaved?: (mediaAssetId: string) => void;
}) {
  const clientOperationId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pendingMediaClientId = (mediaAsset: MediaAsset) =>
    mediaAsset.storage_bucket === 'local-pending' && mediaAsset.id.startsWith('pending:')
      ? mediaAsset.id.replace('pending:', '')
      : null;

  const removeMediaFromDefects = (mediaAssetId: string) => {
    setDefects((current) =>
      current.map((defect) => ({
        ...defect,
        media_links: defect.media_links.filter((link) => link.media_asset_id !== mediaAssetId),
      })),
    );
  };

  const clearMediaDrafts = (mediaAssetId: string) => {
    setMediaCaptionDrafts((current) => {
      const { [mediaAssetId]: omitted, ...next } = current;
      void omitted;
      return next;
    });
    setMediaAiSuggestions((current) => {
      const { [mediaAssetId]: omitted, ...next } = current;
      void omitted;
      return next;
    });
  };

  const startImageDescription = async (mediaAsset: MediaAsset) => {
    if (busy) {
      return;
    }

    setBusy(`media-ai-${mediaAsset.id}`);
    setError(null);
    setNotice(null);
    try {
      const job = await resolveAiJob(session, await aiApi.createImageDescription(session, mediaAsset.id));
      if (job.status === 'failed') {
        setNotice(job.error_message ?? 'KI-Bildbeschreibung konnte nicht erstellt werden.');
        return;
      }

      const caption = aiJobText(job);
      if (job.status === 'done' && caption) {
        setMediaAiSuggestions((current) => ({ ...current, [mediaAsset.id]: caption }));
        setMediaCaptionDrafts((current) => ({ ...current, [mediaAsset.id]: caption }));
        onCaptionDraftChanged?.(mediaAsset.id);
        await loadDetail();
        setNotice('KI-Bildbeschreibung wurde als Vorschlag gespeichert.');
      } else {
        setNotice('KI-Bildbeschreibung gestartet. Bitte spaeter aktualisieren.');
      }
    } catch (imageError) {
      if (isAiUnavailableError(imageError)) {
        setNotice('KI-Bildbeschreibung ist nicht verfuegbar. Foto und Eintrag bleiben nutzbar.');
        return;
      }
      setError(imageError instanceof Error ? imageError.message : 'KI-Bildbeschreibung konnte nicht gestartet werden.');
    } finally {
      setBusy(null);
    }
  };

  const updateMediaCaption = async (
    mediaAsset: MediaAsset,
    status: Extract<DraftStatus, 'edited' | 'confirmed'>,
  ) => {
    const caption = (mediaCaptionDrafts[mediaAsset.id] ?? mediaAsset.caption ?? '').trim();
    if (busy) {
      return;
    }
    if (!caption) {
      setError('Bildunterschrift darf nicht leer sein.');
      return;
    }

    setBusy(`media-caption-${mediaAsset.id}`);
    setError(null);
    setNotice(null);
    try {
      const updated = await mediaApi.update(session, mediaAsset.id, {
        caption,
        caption_status: status,
      });
      setMediaCaptionDrafts((current) => ({ ...current, [updated.id]: updated.caption ?? '' }));
      setMediaAiSuggestions((current) => {
        const { [updated.id]: omitted, ...next } = current;
        void omitted;
        return next;
      });
      onCaptionSaved?.(updated.id);
      await loadDetail();
      setNotice(status === 'confirmed' ? 'Bildunterschrift bestaetigt.' : 'Bildunterschrift gespeichert.');
    } catch (captionError) {
      if (isNetworkError(captionError)) {
        await appendOutbox({
          client_operation_id: clientOperationId(),
          type: 'media.update',
          payload: {
            id: mediaAsset.id,
            caption,
            caption_status: status,
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: captionError.message,
        });
        setNotice('Bildunterschrift lokal gesichert und wird spaeter uebertragen.');
        return;
      }
      setError(captionError instanceof Error ? captionError.message : 'Bildunterschrift konnte nicht gespeichert werden.');
    } finally {
      setBusy(null);
    }
  };

  const deleteMediaAsset = async (mediaAsset: MediaAsset) => {
    if (busy) {
      return;
    }

    setBusy(`media-delete-${mediaAsset.id}`);
    setError(null);
    setNotice(null);
    try {
      const pendingClientId = pendingMediaClientId(mediaAsset);
      if (pendingClientId) {
        await deletePendingMedia(pendingClientId);
        removeMediaFromDefects(mediaAsset.id);
        clearMediaDrafts(mediaAsset.id);
        setPendingMedia(await readPendingMedia(mediaAsset.project_id));
        setNotice('Lokales Foto entfernt.');
        return;
      }

      await mediaApi.remove(session, mediaAsset.id);
      removeMediaFromDefects(mediaAsset.id);
      clearMediaDrafts(mediaAsset.id);
      await loadDetail();
      setNotice('Foto geloescht.');
    } catch (deleteError) {
      if (isNetworkError(deleteError)) {
        await appendOutbox({
          client_operation_id: clientOperationId(),
          type: 'media.delete',
          payload: {
            id: mediaAsset.id,
            project_id: mediaAsset.project_id,
            base_revision: mediaAsset.revision,
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: deleteError.message,
        });
        removeMediaFromDefects(mediaAsset.id);
        clearMediaDrafts(mediaAsset.id);
        setNotice('Foto lokal geloescht und wird spaeter uebertragen.');
        return;
      }
      setError(deleteError instanceof Error ? deleteError.message : 'Foto konnte nicht geloescht werden.');
    } finally {
      setBusy(null);
    }
  };

  return {
    deleteMediaAsset,
    startImageDescription,
    updateMediaCaption,
  };
}
