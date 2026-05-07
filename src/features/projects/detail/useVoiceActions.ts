import type { Session } from '@supabase/supabase-js';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  type useAudioRecorder,
  type useAudioRecorderState,
} from 'expo-audio';
import type { Dispatch, SetStateAction } from 'react';
import { Platform } from 'react-native';

import { aiApi, ApiError, defectsApi, voiceNotesApi } from '../../../lib/api';
import { isNetworkError } from '../../../lib/api/errors';
import {
  appendOutbox,
  cacheAssetForOffline,
  createClientId,
  readOutbox,
  readPendingMedia,
  type OutboxItem,
  type PendingMediaItem,
  upsertPendingMedia,
} from '../../../lib/offlineStore';
import { uploadProjectFile, type UploadableAsset } from '../../../lib/uploadProjectFile';
import type { Defect, DraftStatus, Project, VoiceNote } from '../../../types/projects';
import { resolveAiJob } from './ai';
import { aiJobText } from './helpers';
import { mergeTranscriptIntoDescription } from './transcripts';
import { useProjectStatus } from './contexts/ProjectStatusContext';
import { useTabRouter } from './contexts/TabRouterContext';

export function useVoiceActions({
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
}: {
  audioPermissionGranted: boolean | null;
  audioRecorder: ReturnType<typeof useAudioRecorder>;
  audioRecorderState: ReturnType<typeof useAudioRecorderState>;
  defects: Defect[];
  loadDetail: () => Promise<void>;
  project: Project;
  recordedVoiceAsset: UploadableAsset | null;
  session: Session;
  setAudioPermissionGranted: Dispatch<SetStateAction<boolean | null>>;
  setOutbox: Dispatch<SetStateAction<OutboxItem[]>>;
  setPendingMedia: Dispatch<SetStateAction<PendingMediaItem[]>>;
  setRecordedVoiceAsset: Dispatch<SetStateAction<UploadableAsset | null>>;
  setVoiceDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setVoiceNotes: Dispatch<SetStateAction<VoiceNote[]>>;
  setVoiceTranscript: Dispatch<SetStateAction<string>>;
  voiceDrafts: Record<string, string>;
  voiceTranscript: string;
}) {
  const { busy, setBusy, setError, setNotice } = useProjectStatus();
  const { navigateToTab } = useTabRouter();

  const ensureMicrophonePermission = async () => {
    if (audioPermissionGranted) {
      return true;
    }

    const permission = await AudioModule.requestRecordingPermissionsAsync();
    setAudioPermissionGranted(permission.granted);
    return permission.granted;
  };

  const requestMicrophonePermission = async () => {
    if (busy) {
      return;
    }

    setBusy('voice-permission');
    setError(null);
    setNotice(null);
    try {
      const granted = await ensureMicrophonePermission();
      setNotice(granted ? 'Mikrofonzugriff ist erlaubt.' : null);
      if (!granted) {
        setError('Mikrofonzugriff wurde nicht erlaubt.');
      }
    } catch (permissionError) {
      setError(permissionError instanceof Error ? permissionError.message : 'Mikrofonberechtigung konnte nicht geprueft werden.');
    } finally {
      setBusy(null);
    }
  };

  const startVoiceRecording = async () => {
    if (busy || audioRecorderState.isRecording) {
      return;
    }

    setError(null);
    setNotice(null);
    try {
      const granted = await ensureMicrophonePermission();
      if (!granted) {
        setError('Mikrofonzugriff wurde nicht erlaubt.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        allowsBackgroundRecording: false,
        interruptionMode: 'doNotMix',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      setRecordedVoiceAsset(null);
      await audioRecorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      audioRecorder.record();
      setNotice('Sprachaufnahme laeuft.');
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : 'Sprachaufnahme konnte nicht gestartet werden.');
    }
  };

  const stopVoiceRecording = async () => {
    if (busy || !audioRecorderState.isRecording) {
      return;
    }

    setBusy('voice-stop');
    setError(null);
    setNotice(null);
    try {
      const durationBeforeStop = audioRecorderState.durationMillis;
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const stoppedState = audioRecorder.getStatus();
      const uri = audioRecorder.uri ?? stoppedState.url;
      if (!uri) {
        throw new Error('Aufnahmedatei wurde nicht erstellt.');
      }

      const durationMillis = stoppedState.durationMillis || durationBeforeStop;
      const durationSeconds = durationMillis ? Math.max(1, Math.round(durationMillis / 1000)) : null;
      const fileExtension = Platform.OS === 'web' ? 'webm' : 'm4a';
      const mimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
      setRecordedVoiceAsset({
        uri,
        fileName: `sprachaufnahme-${Date.now()}.${fileExtension}`,
        mimeType,
        duration_seconds: durationSeconds,
      });
      setNotice('Sprachaufnahme ist bereit zum Speichern.');
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : 'Sprachaufnahme konnte nicht beendet werden.');
    } finally {
      setBusy(null);
    }
  };

  const discardVoiceRecording = async () => {
    if (busy) {
      return;
    }

    setError(null);
    setNotice(null);
    try {
      if (audioRecorderState.isRecording) {
        await audioRecorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
      }
      setRecordedVoiceAsset(null);
      setVoiceTranscript('');
      setNotice('Sprachaufnahme verworfen.');
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : 'Sprachaufnahme konnte nicht verworfen werden.');
    }
  };

  const saveVoiceNote = async (defectId?: string): Promise<boolean> => {
    const transcript = voiceTranscript.trim();
    if (busy) {
      return false;
    }
    if (!recordedVoiceAsset) {
      setError('Bitte zuerst eine Sprachaufnahme erstellen.');
      return false;
    }
    if (!defectId) {
      setError('Sprachnotizen muessen einem konkreten Eintrag zugeordnet sein.');
      return false;
    }

    setBusy('voice-save');
    setError(null);
    setNotice(null);
    const voiceClientId = createClientId('voice');
    try {
      const media = await uploadProjectFile(session, project.id, recordedVoiceAsset, 'audio');
      const voiceNote = await voiceNotesApi.create(session, project.id, {
        media_asset_id: media.id,
        target_type: 'defect_description',
        defect_id: defectId,
        transcript: transcript || null,
        transcript_status: transcript ? 'confirmed' : 'open',
        client_id: voiceClientId,
      });
      setVoiceNotes((current) => [
        ...current.filter((item) => item.id !== voiceNote.id),
        voiceNote,
      ]);
      setRecordedVoiceAsset(null);
      setVoiceTranscript('');
      navigateToTab('entries');
      setNotice('Sprachnotiz gespeichert. Transkription laeuft im Hintergrund.');
      if (transcript) {
        void processVoiceNoteAfterSave(voiceNote)
          .then(async (transcriptApplied) => {
            if (transcriptApplied) {
              await loadDetail();
              setNotice('Transkript wurde am Eintrag ergaenzt.');
            }
          })
          .catch(() => {
            setNotice('Sprachnotiz gespeichert. Transkription kann spaeter wiederholt werden.');
          });
      }
      return true;
    } catch (voiceError) {
      if (isNetworkError(voiceError)) {
        if (defectId.startsWith('pending-defect:')) {
          setError('Sprachnotiz kann erst nach der Synchronisierung an diesen lokalen Eintrag angehaengt werden.');
          return false;
        }
        const operationId = voiceClientId;
        const cached = await cacheAssetForOffline(project.id, recordedVoiceAsset, 'audio', 'recording');
        const now = new Date().toISOString();
        await upsertPendingMedia({
          ...cached,
          status: 'waiting',
          target_defect_id: defectId,
          link_client_operation_id: operationId,
          error: voiceError.message,
          updated_at: now,
        });
        await appendOutbox({
          client_operation_id: operationId,
          type: 'defect.attach_voice',
          payload: {
            project_id: project.id,
            defect_id: defectId,
            pending_voice_client_id: cached.client_id,
            voice_transcript: transcript,
          },
          created_at: now,
          status: 'waiting',
          error: voiceError.message,
        });
        setRecordedVoiceAsset(null);
        setVoiceTranscript('');
        navigateToTab('entries');
        setOutbox(await readOutbox());
        setPendingMedia(await readPendingMedia(project.id));
        setNotice('Sprachnotiz lokal gesichert und wird spaeter uebertragen.');
        return true;
      }
      setError(voiceError instanceof Error ? voiceError.message : 'Sprachaufnahme konnte nicht gespeichert werden.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const applyConfirmedVoiceTranscript = async (
    voiceNote: VoiceNote,
    transcript: string,
    baseDescription?: string | null,
  ) => {
    if (voiceNote.target_type === 'defect_description' && voiceNote.defect_id) {
      const defect = defects.find((item) => item.id === voiceNote.defect_id);
      const description = mergeTranscriptIntoDescription(
        baseDescription ?? defect?.description ?? '',
        transcript,
        voiceNote.created_at,
      );
      await defectsApi.update(session, voiceNote.defect_id, { description });
      return;
    }

    throw new Error('Sprachnotiz zuerst einem Eintrag zuordnen.');
  };

  const runVoiceTranscription = async (
    voiceNote: VoiceNote,
    options: { autoConfirm?: boolean; baseDescription?: string | null } = {},
  ) => {
    const job = await resolveAiJob(
      session,
      await aiApi.createTranscription(session, voiceNote.id),
      { attempts: 16, intervalMs: 1250 },
    );
    if (job.status === 'failed') {
      setVoiceNotes((current) =>
        current.map((item) =>
          item.id === voiceNote.id
            ? { ...item, transcript_status: 'error', error_message: job.error_message ?? null }
            : item,
        ),
      );
      await loadDetail();
      return false;
    }

    const transcript = aiJobText(job);
    if (job.status === 'done' && transcript) {
      const status = options.autoConfirm ? 'confirmed' : 'suggested';
      const updated = await voiceNotesApi.update(session, voiceNote.id, {
        transcript,
        transcript_status: status,
      });
      setVoiceNotes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setVoiceDrafts((current) => ({ ...current, [updated.id]: updated.transcript ?? '' }));
      if (options.autoConfirm) {
        await applyConfirmedVoiceTranscript(updated, transcript, options.baseDescription);
      }
      return true;
    }

    return false;
  };

  const processVoiceNoteAfterSave = async (
    voiceNote: VoiceNote,
    baseDescription?: string | null,
  ): Promise<boolean> => {
    const transcript = (voiceNote.transcript ?? '').trim();
    try {
      if (transcript) {
        const updated =
          voiceNote.transcript_status === 'confirmed'
            ? voiceNote
            : await voiceNotesApi.update(session, voiceNote.id, {
                transcript,
                transcript_status: 'confirmed',
              });
        await applyConfirmedVoiceTranscript(updated, transcript, baseDescription);
        return true;
      }
      return runVoiceTranscription(voiceNote, { autoConfirm: true, baseDescription });
    } catch (transcriptionError) {
      if (
        transcriptionError instanceof ApiError &&
        (transcriptionError.status === 503 || transcriptionError.code?.startsWith('AI_'))
      ) {
        return false;
      }
      throw transcriptionError;
    }
  };

  const startVoiceTranscription = async (voiceNote: VoiceNote) => {
    if (busy) {
      return;
    }

    setBusy(`voice-ai-${voiceNote.id}`);
    setError(null);
    setNotice(null);
    try {
      const suggested = await runVoiceTranscription(voiceNote);
      if (suggested) {
        setNotice('KI-Transkription als Vorschlag gespeichert.');
      } else {
        setNotice('Transkription konnte nicht erstellt werden.');
      }
    } catch (transcriptionError) {
      if (
        transcriptionError instanceof ApiError &&
        (transcriptionError.status === 503 || transcriptionError.code?.startsWith('AI_'))
      ) {
        setNotice('KI-Transkription ist nicht verfuegbar. Die Sprachnotiz bleibt gespeichert.');
        return;
      }
      setError(transcriptionError instanceof Error ? transcriptionError.message : 'Transkription konnte nicht gestartet werden.');
    } finally {
      setBusy(null);
    }
  };

  const updateVoiceTranscript = async (voiceNote: VoiceNote, status: Extract<DraftStatus, 'edited' | 'confirmed'>) => {
    const transcript = (voiceDrafts[voiceNote.id] ?? voiceNote.transcript ?? '').trim();
    if (busy) {
      return;
    }
    if (!transcript) {
      setError('Transkript darf nicht leer sein.');
      return;
    }
    if (status === 'confirmed' && (voiceNote.target_type !== 'defect_description' || !voiceNote.defect_id)) {
      setError('Sprachnotiz zuerst einem Eintrag zuordnen.');
      return;
    }

    setBusy(`voice-update-${voiceNote.id}`);
    setError(null);
    setNotice(null);
    try {
      const updated = await voiceNotesApi.update(session, voiceNote.id, {
        transcript,
        transcript_status: status,
      });
      setVoiceNotes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setVoiceDrafts((current) => ({ ...current, [updated.id]: updated.transcript ?? '' }));
      if (status === 'confirmed') {
        await applyConfirmedVoiceTranscript(updated, transcript);
        await loadDetail();
      }
      setNotice(status === 'confirmed' ? 'Transkript bestaetigt und am Eintrag ergaenzt.' : 'Transkript gespeichert.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Transkript konnte nicht gespeichert werden.');
    } finally {
      setBusy(null);
    }
  };

  const deleteVoiceNote = async (voiceNote: VoiceNote) => {
    if (busy) {
      return;
    }

    setBusy(`voice-delete-${voiceNote.id}`);
    setError(null);
    setNotice(null);
    try {
      await voiceNotesApi.remove(session, voiceNote.id);
      setVoiceNotes((current) => current.filter((item) => item.id !== voiceNote.id));
      setVoiceDrafts((current) => {
        const { [voiceNote.id]: omitted, ...next } = current;
        void omitted;
        return next;
      });
      await loadDetail();
      setNotice('Sprachnotiz geloescht.');
    } catch (deleteError) {
      if (isNetworkError(deleteError)) {
        await appendOutbox({
          client_operation_id: createClientId('voice-delete'),
          type: 'voice_note.delete',
          payload: {
            id: voiceNote.id,
            project_id: project.id,
            base_revision: voiceNote.revision,
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: deleteError.message,
        });
        setVoiceNotes((current) => current.filter((item) => item.id !== voiceNote.id));
        setVoiceDrafts((current) => {
          const { [voiceNote.id]: omitted, ...next } = current;
          void omitted;
          return next;
        });
        setOutbox(await readOutbox());
        setNotice('Sprachnotiz lokal geloescht und wird spaeter uebertragen.');
        return;
      }
      setError(deleteError instanceof Error ? deleteError.message : 'Sprachnotiz konnte nicht geloescht werden.');
    } finally {
      setBusy(null);
    }
  };

  const assignVoiceNoteToDefect = async (voiceNote: VoiceNote, defectId: string) => {
    if (busy) {
      return;
    }
    setBusy(`voice-update-${voiceNote.id}`);
    setError(null);
    setNotice(null);
    try {
      const updated = await voiceNotesApi.update(session, voiceNote.id, {
        target_type: 'defect_description',
        defect_id: defectId,
      });
      setVoiceNotes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setVoiceDrafts((current) => ({ ...current, [updated.id]: updated.transcript ?? '' }));
      await loadDetail();
      setNotice('Sprachnotiz dem Eintrag zugeordnet.');
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Sprachnotiz konnte nicht zugeordnet werden.');
    } finally {
      setBusy(null);
    }
  };

  return {
    assignVoiceNoteToDefect,
    deleteVoiceNote,
    discardVoiceRecording,
    requestMicrophonePermission,
    processVoiceNoteAfterSave,
    saveVoiceNote,
    startVoiceRecording,
    startVoiceTranscription,
    stopVoiceRecording,
    updateVoiceTranscript,
  };
}
