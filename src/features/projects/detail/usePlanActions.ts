import type { Session } from '@supabase/supabase-js';
import * as DocumentPicker from 'expo-document-picker';
import type { Dispatch, SetStateAction } from 'react';

import { ApiError, plansApi } from '../../../lib/api';
import { isNetworkError } from '../../../lib/api/errors';
import { useProjectStatus } from './contexts/ProjectStatusContext';
import {
  appendOutbox,
  cacheAssetForOffline,
  createClientId,
  markPendingMediaLinked,
  readOutbox,
  readPendingMedia,
  type OutboxItem,
  type PendingMediaItem,
  upsertPendingMedia,
  writeOutbox,
} from '../../../lib/offlineStore';
import { uploadQueuedMedia } from '../../../lib/sync';
import { planFileType } from '../../../lib/uploadProjectFile';
import type { PlanFile, PlanMarker, Project } from '../../../types/projects';

const pendingDefectClientId = (defectId: string) =>
  defectId.startsWith('pending-defect:') ? defectId.replace('pending-defect:', '') : null;

export function usePlanActions({
  loadDetail,
  onMarkerCreated,
  plans,
  project,
  selectedDefectId,
  session,
  setOutbox,
  setPendingMedia,
  setPlans,
}: {
  loadDetail: () => Promise<void>;
  onMarkerCreated?: (defectId: string) => void;
  plans: PlanFile[];
  project: Project;
  selectedDefectId: string | null;
  session: Session;
  setOutbox: Dispatch<SetStateAction<OutboxItem[]>>;
  setPendingMedia: Dispatch<SetStateAction<PendingMediaItem[]>>;
  setPlans: Dispatch<SetStateAction<PlanFile[]>>;
}) {
  const { busy, setBusy, setError, setNotice } = useProjectStatus();

  const uploadPlan = async () => {
    if (busy) {
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const fileType = planFileType(asset.name, asset.mimeType);
    const planClientId = createClientId('plan');
    setBusy('plan');
    setError(null);
    setNotice(null);
    let cached: PendingMediaItem | null = null;
    try {
      cached = await cacheAssetForOffline(project.id, asset, 'plan_source', 'document');
      const uploaded = await uploadQueuedMedia(session, cached);
      if (!uploaded.media_asset_id) {
        throw new Error('Plan-Datei wurde nicht hochgeladen.');
      }
      cached = uploaded;
      await upsertPendingMedia(uploaded);
      await plansApi.create(session, project.id, {
        media_asset_id: uploaded.media_asset_id,
        name: asset.name,
        file_type: fileType,
        page_count: fileType === 'pdf' ? 1 : undefined,
        client_id: planClientId,
      });
      await markPendingMediaLinked(cached.client_id);
      await loadDetail();
      setNotice('Plan hochgeladen.');
    } catch (planError) {
      try {
        const fallback = cached ?? (await cacheAssetForOffline(project.id, asset, 'plan_source', 'document'));
        await upsertPendingMedia({
          ...fallback,
          status: isNetworkError(planError) ? 'waiting' : 'error',
          error: planError instanceof Error ? planError.message : 'Plan-Upload wartet.',
          updated_at: new Date().toISOString(),
        });
        await appendOutbox({
          client_operation_id: planClientId,
          type: 'plan.create_with_source',
          payload: {
            project_id: project.id,
            pending_media_client_id: fallback.client_id,
            name: asset.name,
            file_type: fileType,
            page_count: fileType === 'pdf' ? 1 : undefined,
            client_id: planClientId,
          },
          created_at: new Date().toISOString(),
          status: isNetworkError(planError) ? 'waiting' : 'error',
          error: planError instanceof Error ? planError.message : 'Plan-Upload wartet.',
        });
        setOutbox(await readOutbox());
        setPendingMedia(await readPendingMedia(project.id));
        setNotice('Plan lokal gesichert und wird spaeter hochgeladen.');
      } catch (fallbackError) {
        setError(fallbackError instanceof Error ? fallbackError.message : 'Plan konnte nicht lokal gesichert werden.');
      }
    } finally {
      setBusy(null);
    }
  };

  const createMarker = async (plan: PlanFile, xNorm = 0.5, yNorm = 0.5) => {
    if (!selectedDefectId || busy) {
      setError('Bitte zuerst einen Mangel oder Hinweis auswaehlen.');
      return;
    }
    const markerClientId = createClientId('marker');
    const pageNumber = plan.selected_page ?? 1;
    const normalizedX = Math.max(0, Math.min(1, xNorm));
    const normalizedY = Math.max(0, Math.min(1, yNorm));
    const optimisticMarker: PlanMarker = {
      id: `pending-marker:${markerClientId}`,
      project_id: project.id,
      plan_file_id: plan.id,
      defect_id: selectedDefectId,
      page_number: pageNumber,
      x_norm: normalizedX,
      y_norm: normalizedY,
      label_override: null,
      created_by: session.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      client_id: markerClientId,
    };

    const addOptimisticMarker = () => {
      setPlans((current) =>
        current.map((item) =>
          item.id === plan.id
            ? {
                ...item,
                markers: [
                  ...item.markers.filter((marker) => marker.client_id !== markerClientId),
                  optimisticMarker,
                ],
              }
            : item,
        ),
      );
    };

    const queueMarker = async (type: 'plan_marker.create' | 'plan_marker.create_for_pending_defect') => {
      const pendingClientId = pendingDefectClientId(selectedDefectId);
      await appendOutbox({
        client_operation_id: markerClientId,
        type,
        payload: {
          project_id: project.id,
          plan_file_id: plan.id,
          ...(type === 'plan_marker.create_for_pending_defect'
            ? { pending_defect_client_id: pendingClientId }
            : { defect_id: selectedDefectId }),
          x_norm: normalizedX,
          y_norm: normalizedY,
          page_number: pageNumber,
          client_id: markerClientId,
        },
        created_at: new Date().toISOString(),
        status: 'waiting',
      });
      addOptimisticMarker();
      setOutbox(await readOutbox());
      onMarkerCreated?.(selectedDefectId);
      setNotice('Marker lokal gesetzt. Er wird synchronisiert, sobald die Verbindung steht.');
    };

    const pendingClientId = pendingDefectClientId(selectedDefectId);
    if (pendingClientId) {
      await queueMarker('plan_marker.create_for_pending_defect');
      return;
    }

    setBusy('marker');
    setError(null);
    setNotice(null);
    try {
      await plansApi.createMarker(session, plan.id, {
        defect_id: selectedDefectId,
        x_norm: normalizedX,
        y_norm: normalizedY,
        page_number: pageNumber,
        client_id: markerClientId,
      });
      await loadDetail();
      setNotice('Marker gespeichert.');
      onMarkerCreated?.(selectedDefectId);
    } catch (markerError) {
      if (isNetworkError(markerError)) {
        await queueMarker('plan_marker.create');
      } else {
        setError(markerError instanceof Error ? markerError.message : 'Marker konnte nicht gespeichert werden.');
      }
    } finally {
      setBusy(null);
    }
  };

  const deleteMarker = async (markerId: string) => {
    if (markerId.startsWith('pending-marker:')) {
      const markerClientId = markerId.replace('pending-marker:', '');
      const currentOutbox = await readOutbox();
      await writeOutbox(currentOutbox.filter((item) => item.client_operation_id !== markerClientId));
      setOutbox(await readOutbox());
      setPlans((current) =>
        current.map((plan) => ({
          ...plan,
          markers: plan.markers.filter((marker) => marker.id !== markerId && marker.client_id !== markerClientId),
        })),
      );
      setNotice('Lokaler Marker entfernt.');
      return;
    }
    setBusy('marker');
    setError(null);
    setNotice(null);
    const existingMarker = plans
      .flatMap((plan) => plan.markers)
      .find((marker) => marker.id === markerId);
    const removeOptimisticMarker = () => {
      setPlans((current) =>
        current.map((plan) => ({
          ...plan,
          markers: plan.markers.filter((marker) => marker.id !== markerId),
        })),
      );
    };
    try {
      removeOptimisticMarker();
      await plansApi.deleteMarker(session, markerId);
      await loadDetail();
    } catch (markerError) {
      if (isNetworkError(markerError)) {
        await appendOutbox({
          client_operation_id: createClientId('marker-delete'),
          type: 'plan_marker.delete',
          payload: {
            id: markerId,
            project_id: project.id,
            base_revision: existingMarker?.revision,
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: markerError.message,
        });
        setOutbox(await readOutbox());
        setNotice('Marker lokal entfernt.');
      } else {
        if (existingMarker) {
          setPlans((current) =>
            current.map((plan) =>
              plan.id === existingMarker.plan_file_id
                ? { ...plan, markers: [...plan.markers, existingMarker] }
                : plan,
            ),
          );
        }
        setError(markerError instanceof Error ? markerError.message : 'Marker konnte nicht geloescht werden.');
      }
    } finally {
      setBusy(null);
    }
  };

  return {
    createMarker,
    deleteMarker,
    uploadPlan,
  };
}
