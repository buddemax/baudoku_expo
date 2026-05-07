import type { Session } from '@supabase/supabase-js';

import { config } from './config';
import type {
  AiJob,
  Defect,
  DefectCreateInput,
  DefectMediaLink,
  DefectMediaLinkCreateInput,
  DefectMediaLinkUpdateInput,
  GeneralFinding,
  GeneralFindingCreateInput,
  GeneralFindingUpdateInput,
  MediaAsset,
  MediaSignedUrlResponse,
  MediaAssetUpdateInput,
  MediaCompleteUploadInput,
  MediaInitUpload,
  MediaInitUploadInput,
  PlanCreateInput,
  PlanExportFormat,
  PlanExportResponse,
  PlanFile,
  PlanMarker,
  PlanMarkerCreateInput,
  PlanMarkerUpdateInput,
  Profile,
  ProjectMediaItem,
  ProjectConclusion,
  ProjectConclusionUpsertInput,
  Project,
  ProjectCreateInput,
  ProjectUpdateInput,
  ReportEmailRequest,
  ReportEmailResponse,
  ReportPreview,
  ReportPreviewConfirmation,
  ReportVersion,
  SyncPullResponse,
  SyncPushResponse,
  Trade,
  VoiceNote,
  VoiceNoteCreateInput,
  VoiceNoteUpdateInput,
} from '../types/projects';

type ApiErrorDetail =
  | string
  | {
      message?: string;
      code?: string;
    };

type ApiErrorBody = {
  detail?: ApiErrorDetail;
  code?: string;
  message?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type DefectUpdateInput = Partial<Omit<DefectCreateInput, 'category' | 'trade_name_snapshot'>> & {
  category?: string | null;
  trade_name_snapshot?: string | null;
};

const readBody = async <T>(response: Response): Promise<T | null> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
};

const retryableStatuses = new Set([429, 502, 503, 504]);

const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const errorInfo = (body: ApiErrorBody | null, status: number) => {
  if (typeof body?.detail === 'string') {
    return {
      message: body.detail,
      code: body.code,
    };
  }

  if (body?.detail && typeof body.detail === 'object') {
    return {
      message: body.detail.message ?? body.message ?? `Anfrage fehlgeschlagen (${status}).`,
      code: body.detail.code ?? body.code,
    };
  }

  return {
    message: body?.message ?? `Anfrage fehlgeschlagen (${status}).`,
    code: body?.code,
  };
};

const normalizeProjects = (
  body: Project[] | { items?: Project[]; projects?: Project[] } | null,
  includeDeleted = false,
): Project[] => {
  if (!body) {
    return [];
  }

  if (Array.isArray(body)) {
    return includeDeleted ? body : body.filter((project) => !project.deleted_at);
  }

  const projects = body.items ?? body.projects ?? [];
  return includeDeleted ? projects : projects.filter((project) => !project.deleted_at);
};

const normalizeProject = (body: Project | { project?: Project } | null): Project => {
  if (!body) {
    throw new ApiError('Backend hat kein Projekt zurueckgegeben.', 502, 'EMPTY_PROJECT_RESPONSE');
  }

  if ('project' in body && body.project) {
    return body.project;
  }

  return body as Project;
};

export const apiRequest = async <T>(
  path: string,
  session: Session,
  options: RequestInit = {},
): Promise<T> => {
  const url = `${config.apiUrl}${path}`;
  const headers = new Headers(options.headers);
  const method = String(options.method ?? 'GET').toUpperCase();
  const retryable = method === 'GET';
  const attempts = retryable ? 3 : 1;
  headers.set('Authorization', `Bearer ${session.access_token}`);
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let lastError: ApiError | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch {
      lastError = new ApiError(
        'Backend nicht erreichbar. Bitte Verbindung und API-URL pruefen.',
        0,
        'NETWORK_ERROR',
      );
      if (attempt < attempts) {
        await wait(250 * attempt);
        continue;
      }
      throw lastError;
    }

    const body = await readBody<T | ApiErrorBody>(response);

    if (!response.ok) {
      const { message, code } = errorInfo(body as ApiErrorBody | null, response.status);
      lastError = new ApiError(message, response.status, code);
      if (retryableStatuses.has(response.status) && attempt < attempts) {
        await wait(250 * attempt);
        continue;
      }
      throw lastError;
    }

    return body as T;
  }

  throw lastError ?? new ApiError('Anfrage fehlgeschlagen.', 0, 'REQUEST_FAILED');
};

export const projectsApi = {
  async list(session: Session, options: { includeDeleted?: boolean } = {}): Promise<Project[]> {
    const params = options.includeDeleted ? '?include_deleted=true' : '';
    const body = await apiRequest<Project[] | { items?: Project[]; projects?: Project[] }>(
      `/v1/projects${params}`,
      session,
    );
    return normalizeProjects(body, options.includeDeleted);
  },

  async get(session: Session, projectId: string): Promise<Project> {
    const body = await apiRequest<Project | { project?: Project }>(`/v1/projects/${projectId}`, session);
    return normalizeProject(body);
  },

  async create(session: Session, input: ProjectCreateInput): Promise<Project> {
    const body = await apiRequest<Project | { project?: Project }>('/v1/projects', session, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return normalizeProject(body);
  },

  async update(session: Session, projectId: string, input: ProjectUpdateInput): Promise<Project> {
    const body = await apiRequest<Project | { project?: Project }>(`/v1/projects/${projectId}`, session, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return normalizeProject(body);
  },

  async remove(session: Session, projectId: string): Promise<void> {
    await apiRequest<void>(`/v1/projects/${projectId}`, session, {
      method: 'DELETE',
    });
  },
};

export const profilesApi = {
  async list(session: Session): Promise<Profile[]> {
    const body = await apiRequest<{ items?: Profile[] }>('/v1/profiles', session);
    return body.items ?? [];
  },
};

export const tradesApi = {
  async list(session: Session): Promise<Trade[]> {
    const body = await apiRequest<{ items?: Trade[] }>('/v1/trades', session);
    return body.items ?? [];
  },
};

export const defectsApi = {
  async list(session: Session, projectId: string): Promise<Defect[]> {
    const body = await apiRequest<{ items?: Defect[] }>(`/v1/projects/${projectId}/defects`, session);
    return body.items ?? [];
  },

  async create(session: Session, projectId: string, input: DefectCreateInput): Promise<Defect> {
    return apiRequest<Defect>(`/v1/projects/${projectId}/defects`, session, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async update(session: Session, defectId: string, input: DefectUpdateInput): Promise<Defect> {
    return apiRequest<Defect>(`/v1/defects/${defectId}`, session, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async remove(session: Session, defectId: string): Promise<void> {
    await apiRequest<void>(`/v1/defects/${defectId}`, session, {
      method: 'DELETE',
    });
  },

  async reorder(session: Session, projectId: string, defectIds: string[]): Promise<Defect[]> {
    const body = await apiRequest<{ items?: Defect[] }>(`/v1/projects/${projectId}/defects/reorder`, session, {
      method: 'POST',
      body: JSON.stringify({ defect_ids: defectIds }),
    });
    return body.items ?? [];
  },

  async linkMedia(
    session: Session,
    defectId: string,
    mediaAssetId: string,
    input: Omit<DefectMediaLinkCreateInput, 'media_asset_id'> = {},
  ): Promise<DefectMediaLink> {
    return apiRequest<DefectMediaLink>(`/v1/defects/${defectId}/media-links`, session, {
      method: 'POST',
      body: JSON.stringify({ media_asset_id: mediaAssetId, ...input }),
    });
  },

  async updateMediaLink(
    session: Session,
    linkId: string,
    input: DefectMediaLinkUpdateInput,
  ): Promise<DefectMediaLink> {
    return apiRequest<DefectMediaLink>(`/v1/defect-media-links/${linkId}`, session, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async deleteMediaLink(session: Session, linkId: string): Promise<void> {
    await apiRequest<void>(`/v1/defect-media-links/${linkId}`, session, {
      method: 'DELETE',
    });
  },
};

export const mediaApi = {
  async list(session: Session, projectId: string): Promise<ProjectMediaItem[]> {
    const body = await apiRequest<{ items?: ProjectMediaItem[] } | ProjectMediaItem[]>(
      `/v1/projects/${projectId}/media`,
      session,
    );
    return Array.isArray(body) ? body : body.items ?? [];
  },

  async initUpload(session: Session, projectId: string, input: MediaInitUploadInput): Promise<MediaInitUpload> {
    return apiRequest<MediaInitUpload>(`/v1/projects/${projectId}/media/init-upload`, session, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async completeUpload(
    session: Session,
    projectId: string,
    input: MediaCompleteUploadInput,
  ): Promise<MediaAsset> {
    return apiRequest<MediaAsset>(`/v1/projects/${projectId}/media/complete-upload`, session, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async update(session: Session, mediaAssetId: string, input: MediaAssetUpdateInput): Promise<MediaAsset> {
    return apiRequest<MediaAsset>(`/v1/media-assets/${mediaAssetId}`, session, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async signedUrl(session: Session, mediaAssetId: string): Promise<MediaSignedUrlResponse> {
    return apiRequest<MediaSignedUrlResponse>(`/v1/media-assets/${mediaAssetId}/signed-url`, session);
  },

  async remove(session: Session, mediaAssetId: string): Promise<void> {
    await apiRequest<void>(`/v1/media-assets/${mediaAssetId}`, session, {
      method: 'DELETE',
    });
  },
};

export const voiceNotesApi = {
  async list(session: Session, projectId: string): Promise<VoiceNote[]> {
    const body = await apiRequest<{ items?: VoiceNote[] }>(`/v1/projects/${projectId}/voice-notes`, session);
    return body.items ?? [];
  },

  async create(session: Session, projectId: string, input: VoiceNoteCreateInput): Promise<VoiceNote> {
    return apiRequest<VoiceNote>(`/v1/projects/${projectId}/voice-notes`, session, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async update(session: Session, voiceNoteId: string, input: VoiceNoteUpdateInput): Promise<VoiceNote> {
    return apiRequest<VoiceNote>(`/v1/voice-notes/${voiceNoteId}`, session, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async remove(session: Session, voiceNoteId: string): Promise<void> {
    await apiRequest<void>(`/v1/voice-notes/${voiceNoteId}`, session, {
      method: 'DELETE',
    });
  },
};

export const aiApi = {
  async createTranscription(session: Session, voiceNoteId: string): Promise<AiJob> {
    return apiRequest<AiJob>('/v1/ai/transcriptions', session, {
      method: 'POST',
      body: JSON.stringify({ voice_note_id: voiceNoteId }),
    });
  },

  async createImageDescription(session: Session, mediaAssetId: string): Promise<AiJob> {
    return apiRequest<AiJob>('/v1/ai/image-descriptions', session, {
      method: 'POST',
      body: JSON.stringify({ media_asset_id: mediaAssetId }),
    });
  },

  async getJob(session: Session, jobId: string): Promise<AiJob> {
    return apiRequest<AiJob>(`/v1/ai/jobs/${jobId}`, session);
  },
};

export const generalFindingsApi = {
  async list(session: Session, projectId: string): Promise<GeneralFinding[]> {
    const body = await apiRequest<{ items?: GeneralFinding[] }>(
      `/v1/projects/${projectId}/general-findings`,
      session,
    );
    return body.items ?? [];
  },

  async create(session: Session, projectId: string, input: GeneralFindingCreateInput): Promise<GeneralFinding> {
    return apiRequest<GeneralFinding>(`/v1/projects/${projectId}/general-findings`, session, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async update(session: Session, findingId: string, input: GeneralFindingUpdateInput): Promise<GeneralFinding> {
    return apiRequest<GeneralFinding>(`/v1/general-findings/${findingId}`, session, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async remove(session: Session, findingId: string): Promise<void> {
    await apiRequest<void>(`/v1/general-findings/${findingId}`, session, {
      method: 'DELETE',
    });
  },
};

export const conclusionsApi = {
  async get(session: Session, projectId: string): Promise<ProjectConclusion | null> {
    return apiRequest<ProjectConclusion | null>(`/v1/projects/${projectId}/conclusion`, session);
  },

  async upsert(
    session: Session,
    projectId: string,
    input: ProjectConclusionUpsertInput,
  ): Promise<ProjectConclusion> {
    return apiRequest<ProjectConclusion>(`/v1/projects/${projectId}/conclusion`, session, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },
};

export const plansApi = {
  async list(session: Session, projectId: string): Promise<PlanFile[]> {
    const body = await apiRequest<{ items?: PlanFile[] }>(`/v1/projects/${projectId}/plans`, session);
    return body.items ?? [];
  },

  async create(
    session: Session,
    projectId: string,
    input: PlanCreateInput,
  ): Promise<PlanFile> {
    return apiRequest<PlanFile>(`/v1/projects/${projectId}/plans`, session, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async createMarker(
    session: Session,
    planId: string,
    input: PlanMarkerCreateInput,
  ): Promise<PlanMarker> {
    return apiRequest<PlanMarker>(`/v1/plans/${planId}/markers`, session, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateMarker(session: Session, markerId: string, input: PlanMarkerUpdateInput): Promise<PlanMarker> {
    return apiRequest<PlanMarker>(`/v1/plan-markers/${markerId}`, session, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async deleteMarker(session: Session, markerId: string): Promise<void> {
    await apiRequest<void>(`/v1/plan-markers/${markerId}`, session, {
      method: 'DELETE',
    });
  },

  async export(
    session: Session,
    planId: string,
    input: { format?: PlanExportFormat } = {},
  ): Promise<PlanExportResponse> {
    return apiRequest<PlanExportResponse>(`/v1/plans/${planId}/export`, session, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

export const reportsApi = {
  async preview(session: Session, projectId: string): Promise<ReportPreview> {
    return apiRequest<ReportPreview>(`/v1/projects/${projectId}/report/preview`, session);
  },

  async generate(
    session: Session,
    projectId: string,
  ): Promise<{ version: ReportVersion; warnings: ReportPreview['warnings'] }> {
    return apiRequest<{ version: ReportVersion; warnings: ReportPreview['warnings'] }>(
      `/v1/projects/${projectId}/report/generate`,
      session,
      { method: 'POST' },
    );
  },

  async versions(session: Session, projectId: string): Promise<ReportVersion[]> {
    const body = await apiRequest<{ items?: ReportVersion[] }>(`/v1/projects/${projectId}/report-versions`, session);
    return body.items ?? [];
  },

  async send(session: Session, versionId: string, input: ReportEmailRequest): Promise<ReportEmailResponse> {
    return apiRequest<ReportEmailResponse>(`/v1/report-versions/${versionId}/email`, session, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async confirmPreview(session: Session, projectId: string): Promise<ReportPreviewConfirmation> {
    return apiRequest<ReportPreviewConfirmation>(`/v1/projects/${projectId}/report/preview/confirm`, session, {
      method: 'POST',
    });
  },
};

export type SyncOperation = {
  client_operation_id?: string;
  type: string;
  payload: Record<string, unknown>;
};

export const syncApi = {
  async pull(session: Session): Promise<SyncPullResponse> {
    return apiRequest<SyncPullResponse>('/v1/sync/pull', session);
  },

  async push(session: Session, operations: SyncOperation[]): Promise<SyncPushResponse> {
    return apiRequest<SyncPushResponse>('/v1/sync/push', session, {
      method: 'POST',
      body: JSON.stringify({ operations }),
    });
  },
};
