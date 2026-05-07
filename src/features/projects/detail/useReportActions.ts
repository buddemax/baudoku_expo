import type { Session } from '@supabase/supabase-js';
import type { Dispatch, SetStateAction } from 'react';

import { ApiError, conclusionsApi, generalFindingsApi, reportsApi } from '../../../lib/api';
import { isNetworkError } from '../../../lib/api/errors';
import { appendOutbox, createClientId, readOutbox, type OutboxItem, writeOutbox } from '../../../lib/offlineStore';
import type {
  GeneralFinding,
  Project,
  ProjectConclusion,
  ReportEmailRequest,
  ReportEmailResponse,
  ReportPreview,
  ReportVersion,
} from '../../../types/projects';
import { sortGeneralFindings } from './helpers';

export function useReportActions({
  busy,
  conclusion,
  conclusionText,
  findingDrafts,
  generalFindings,
  newFindingText,
  project,
  session,
  setBusy,
  setConclusion,
  setConclusionText,
  setError,
  setFindingDrafts,
  setGeneralFindings,
  setNewFindingText,
  setNotice,
  setOutbox,
  setPreview,
  setVersions,
}: {
  busy: string | null;
  conclusion: ProjectConclusion | null;
  conclusionText: string;
  findingDrafts: Record<string, string>;
  generalFindings: GeneralFinding[];
  newFindingText: string;
  project: Project;
  session: Session;
  setBusy: Dispatch<SetStateAction<string | null>>;
  setConclusion: Dispatch<SetStateAction<ProjectConclusion | null>>;
  setConclusionText: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setFindingDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setGeneralFindings: Dispatch<SetStateAction<GeneralFinding[]>>;
  setNewFindingText: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setOutbox: Dispatch<SetStateAction<OutboxItem[]>>;
  setPreview: Dispatch<SetStateAction<ReportPreview | null>>;
  setVersions: Dispatch<SetStateAction<ReportVersion[]>>;
}) {
  const pendingFindingClientId = (findingId: string) =>
    findingId.startsWith('pending-general-finding:') ? findingId.replace('pending-general-finding:', '') : null;
  const refreshOutbox = async () => setOutbox(await readOutbox());

  const updatePendingFindingCreate = async (clientId: string, payload: Record<string, unknown> | null) => {
    const currentOutbox = await readOutbox();
    const nextOutbox = payload
      ? currentOutbox.map((item) =>
          item.type === 'general_finding.create' && item.payload.client_id === clientId
            ? { ...item, payload: { ...item.payload, ...payload }, error: undefined, status: 'waiting' as const }
            : item,
        )
      : currentOutbox.filter((item) => !(item.type === 'general_finding.create' && item.payload.client_id === clientId));
    await writeOutbox(nextOutbox);
    setOutbox(nextOutbox);
  };

  const createGeneralFinding = async () => {
    const text = newFindingText.trim();
    if (busy || !text) {
      return;
    }

    setBusy('finding-create');
    setError(null);
    setNotice(null);
    const clientId = createClientId('finding');
    const lastFinding = generalFindings[generalFindings.length - 1];
    const sortOrder = (lastFinding?.sort_order ?? generalFindings.length) + 1;
    try {
      const finding = await generalFindingsApi.create(session, project.id, {
        text,
        status: 'confirmed',
        sort_order: sortOrder,
        client_id: clientId,
      });
      setGeneralFindings((current) => sortGeneralFindings([...current, finding]));
      setFindingDrafts((current) => ({ ...current, [finding.id]: finding.text }));
      setNewFindingText('');
      setNotice('Allgemeine Feststellung gespeichert.');
    } catch (findingError) {
      if (isNetworkError(findingError)) {
        const now = new Date().toISOString();
        const optimisticFinding: GeneralFinding = {
          id: `pending-general-finding:${clientId}`,
          project_id: project.id,
          text,
          status: 'confirmed',
          sort_order: sortOrder,
          created_at: now,
          updated_at: now,
          created_by: session.user.id,
          revision: 1,
          client_id: clientId,
        };
        await appendOutbox({
          client_operation_id: createClientId('finding-create'),
          type: 'general_finding.create',
          payload: {
            project_id: project.id,
            text,
            status: 'confirmed',
            sort_order: sortOrder,
            client_id: clientId,
          },
          created_at: now,
          status: 'waiting',
          error: findingError.message,
        });
        setGeneralFindings((current) => sortGeneralFindings([...current, optimisticFinding]));
        setFindingDrafts((current) => ({ ...current, [optimisticFinding.id]: optimisticFinding.text }));
        setNewFindingText('');
        await refreshOutbox();
        setNotice('Allgemeine Feststellung lokal gespeichert.');
      } else {
        setError(findingError instanceof Error ? findingError.message : 'Feststellung konnte nicht gespeichert werden.');
      }
    } finally {
      setBusy(null);
    }
  };

  const updateGeneralFinding = async (finding: GeneralFinding) => {
    const text = (findingDrafts[finding.id] ?? finding.text).trim();
    if (busy) {
      return;
    }
    if (!text) {
      setError('Feststellung darf nicht leer sein.');
      return;
    }

    setBusy(`finding-update-${finding.id}`);
    setError(null);
    setNotice(null);
    try {
      const pendingClientId = pendingFindingClientId(finding.id);
      if (pendingClientId) {
        await updatePendingFindingCreate(pendingClientId, { text, status: 'confirmed' });
        const updated = { ...finding, text, status: 'confirmed' as const, updated_at: new Date().toISOString() };
        setGeneralFindings((current) => sortGeneralFindings(current.map((item) => (item.id === finding.id ? updated : item))));
        setFindingDrafts((current) => ({ ...current, [finding.id]: text }));
        setNotice('Lokale Feststellung aktualisiert.');
        return;
      }
      const updated = await generalFindingsApi.update(session, finding.id, {
        text,
        status: 'confirmed',
      });
      setGeneralFindings((current) =>
        sortGeneralFindings(current.map((item) => (item.id === updated.id ? updated : item))),
      );
      setFindingDrafts((current) => ({ ...current, [updated.id]: updated.text }));
      setNotice('Feststellung aktualisiert.');
    } catch (findingError) {
      if (isNetworkError(findingError)) {
        await appendOutbox({
          client_operation_id: createClientId('finding-update'),
          type: 'general_finding.update',
          payload: {
            id: finding.id,
            project_id: project.id,
            text,
            status: 'confirmed',
            base_revision: finding.revision,
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: findingError.message,
        });
        const updated = { ...finding, text, status: 'confirmed' as const, updated_at: new Date().toISOString() };
        setGeneralFindings((current) => sortGeneralFindings(current.map((item) => (item.id === finding.id ? updated : item))));
        setFindingDrafts((current) => ({ ...current, [finding.id]: text }));
        await refreshOutbox();
        setNotice('Feststellung lokal aktualisiert.');
      } else {
        setError(findingError instanceof Error ? findingError.message : 'Feststellung konnte nicht aktualisiert werden.');
      }
    } finally {
      setBusy(null);
    }
  };

  const deleteGeneralFinding = async (findingId: string) => {
    if (busy) {
      return;
    }

    setBusy(`finding-delete-${findingId}`);
    setError(null);
    setNotice(null);
    try {
      const pendingClientId = pendingFindingClientId(findingId);
      if (pendingClientId) {
        await updatePendingFindingCreate(pendingClientId, null);
        setGeneralFindings((current) => current.filter((finding) => finding.id !== findingId));
        setFindingDrafts((current) => {
          const { [findingId]: omitted, ...next } = current;
          void omitted;
          return next;
        });
        setNotice('Lokale Feststellung entfernt.');
        return;
      }
      await generalFindingsApi.remove(session, findingId);
      setGeneralFindings((current) => current.filter((finding) => finding.id !== findingId));
      setFindingDrafts((current) => {
        const { [findingId]: omitted, ...next } = current;
        void omitted;
        return next;
      });
      setNotice('Feststellung geloescht.');
    } catch (findingError) {
      if (isNetworkError(findingError)) {
        const finding = generalFindings.find((item) => item.id === findingId);
        await appendOutbox({
          client_operation_id: createClientId('finding-delete'),
          type: 'general_finding.delete',
          payload: {
            id: findingId,
            project_id: project.id,
            base_revision: finding?.revision,
          },
          created_at: new Date().toISOString(),
          status: 'waiting',
          error: findingError.message,
        });
        setGeneralFindings((current) => current.filter((item) => item.id !== findingId));
        setFindingDrafts((current) => {
          const { [findingId]: omitted, ...next } = current;
          void omitted;
          return next;
        });
        await refreshOutbox();
        setNotice('Feststellung lokal geloescht.');
      } else {
        setError(findingError instanceof Error ? findingError.message : 'Feststellung konnte nicht geloescht werden.');
      }
    } finally {
      setBusy(null);
    }
  };

  const saveConclusion = async () => {
    const text = conclusionText.trim();
    if (busy) {
      return;
    }
    if (!text) {
      setError('Fazit darf nicht leer sein.');
      return;
    }

    setBusy('conclusion-save');
    setError(null);
    setNotice(null);
    const clientId = conclusion?.client_id ?? createClientId('conclusion');
    try {
      const nextConclusion = await conclusionsApi.upsert(session, project.id, {
        text,
        source_voice_note_id: conclusion?.source_voice_note_id ?? undefined,
        status: 'confirmed',
        client_id: clientId,
      });
      setConclusion(nextConclusion);
      setConclusionText(nextConclusion.text);
      setNotice('Fazit gespeichert.');
    } catch (conclusionError) {
      if (isNetworkError(conclusionError)) {
        const now = new Date().toISOString();
        const optimisticConclusion: ProjectConclusion = {
          project_id: project.id,
          text,
          source_voice_note_id: conclusion?.source_voice_note_id ?? null,
          status: 'confirmed',
          updated_at: now,
          updated_by: session.user.id,
          revision: conclusion?.revision ?? 1,
          client_id: clientId,
        };
        await appendOutbox({
          client_operation_id: createClientId('conclusion-upsert'),
          type: 'project_conclusion.upsert',
          payload: {
            project_id: project.id,
            text,
            source_voice_note_id: conclusion?.source_voice_note_id ?? null,
            status: 'confirmed',
            client_id: clientId,
            base_revision: conclusion?.revision,
          },
          created_at: now,
          status: 'waiting',
          error: conclusionError.message,
        });
        setConclusion(optimisticConclusion);
        setConclusionText(text);
        await refreshOutbox();
        setNotice('Fazit lokal gespeichert.');
      } else {
        setError(conclusionError instanceof Error ? conclusionError.message : 'Fazit konnte nicht gespeichert werden.');
      }
    } finally {
      setBusy(null);
    }
  };

  const applyGeneratedReport = (result: {
    version: ReportVersion;
    warnings: ReportPreview['warnings'];
  }) => {
    setVersions((current) => [result.version, ...current.filter((item) => item.id !== result.version.id)]);
    setPreview((current) => (current ? { ...current, warnings: result.warnings } : current));
  };

  const generateReport = async () => {
    if (busy) {
      return;
    }

    setBusy('report');
    setError(null);
    setNotice(null);
    try {
      const result = await reportsApi.generate(session, project.id);
      applyGeneratedReport(result);
      setNotice('Word-Version erzeugt.');
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Word-Version konnte nicht erzeugt werden.');
    } finally {
      setBusy(null);
    }
  };

  const sendReport = async (
    versionId: string | null,
    input: ReportEmailRequest,
  ): Promise<ReportEmailResponse | null> => {
    if (busy) {
      return null;
    }

    const generatedBeforeSend = !versionId;
    setBusy(versionId ? `report-send-${versionId}` : 'report-generate-send');
    setError(null);
    setNotice(null);

    try {
      let targetVersionId = versionId;
      if (!targetVersionId) {
        const result = await reportsApi.generate(session, project.id);
        applyGeneratedReport(result);
        targetVersionId = result.version.id;
        setBusy(`report-send-${targetVersionId}`);
      }

      const response = await reportsApi.send(session, targetVersionId, input);
      const deliveryHint =
        response.delivery_mode === 'links'
          ? 'Die E-Mail enthält Links statt Anhänge.'
          : 'DOCX und PDF wurden als Anhänge versendet.';
      setNotice(
        generatedBeforeSend
          ? `Bericht erzeugt und per E-Mail versendet. ${deliveryHint}`
          : `Bericht per E-Mail versendet. ${deliveryHint}`,
      );
      return response;
    } catch (reportError) {
      const message =
        reportError instanceof Error
          ? reportError.message
          : generatedBeforeSend
            ? 'Bericht konnte nicht erzeugt oder versendet werden.'
            : 'Bericht konnte nicht per E-Mail versendet werden.';
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(null);
    }
  };

  return {
    createGeneralFinding,
    deleteGeneralFinding,
    generateReport,
    saveConclusion,
    sendReport,
    updateGeneralFinding,
  };
}
