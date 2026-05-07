import type {
  AiJob,
  Defect,
  DraftStatus,
  GeneralFinding,
  PlanFile,
  VoiceNoteTargetType,
} from '../../../types/projects';
import type { DefectFormState } from './types';

export const initialDefectForm = (localLabel = ''): DefectFormState => ({
  kind: 'defect',
  description: '',
  local_label: localLabel,
  trade_id: null,
  trade_name_snapshot: '',
  category: '',
});

export const displayWorkNumberLabel = (value?: string | number | null, fallback = '') => {
  const text = String(value ?? '').trim();
  if (!text) {
    return fallback;
  }
  return text;
};

export const nextDefectLocalLabelFromLabels = (labels: Array<string | null | undefined>) => {
  const numericLabels = labels
    .map((label) => String(label ?? '').trim())
    .filter((label) => /^\d+$/.test(label))
    .map((label) => Number.parseInt(label, 10))
    .filter((label) => Number.isFinite(label));

  if (numericLabels.length) {
    return String(Math.max(...numericLabels) + 1);
  }

  return String(labels.filter((label) => String(label ?? '').trim()).length + 1);
};

export const nextDefectLocalLabel = (defects: Pick<Defect, 'local_label'>[]) =>
  nextDefectLocalLabelFromLabels(defects.map((defect) => defect.local_label));

export const sortGeneralFindings = (items: GeneralFinding[]) =>
  [...items].sort((left, right) => left.sort_order - right.sort_order || left.created_at.localeCompare(right.created_at));

export const formatDuration = (seconds?: number | null) => {
  if (!seconds) {
    return 'Dauer unbekannt';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')} min`;
};

export const voiceTargetLabel = (target: VoiceNoteTargetType) => {
  if (target === 'general_finding') {
    return 'Allgemeine Feststellung';
  }
  if (target === 'conclusion') {
    return 'Fazit';
  }
  if (target === 'caption') {
    return 'Bildunterschrift';
  }
  return 'Mangel/Hinweis';
};

export const draftStatusLabel = (status: DraftStatus) => {
  if (status === 'open') {
    return 'offen';
  }
  if (status === 'suggested') {
    return 'KI-Vorschlag';
  }
  if (status === 'edited') {
    return 'bearbeitet';
  }
  if (status === 'confirmed') {
    return 'bestätigt';
  }
  return 'Fehler';
};

export const aiJobId = (job: AiJob) => job.id;

export const aiJobText = (job: AiJob) => job.result_text?.trim() || '';

export const isAiJobFinished = (job: AiJob) => job.status === 'done' || job.status === 'failed';

export const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function mediaImageSize(plan: PlanFile): { width: number; height: number } | null {
  const media = plan.preview_media_asset ?? plan.media_asset;
  if (!media?.width || !media.height) {
    return null;
  }
  return { width: media.width, height: media.height };
}

export function containedImageRect(
  container: { width: number; height: number },
  image: { width: number; height: number },
) {
  const containerRatio = container.width / container.height;
  const imageRatio = image.width / image.height;
  if (imageRatio > containerRatio) {
    const height = container.width / imageRatio;
    return { x: 0, y: (container.height - height) / 2, width: container.width, height };
  }
  const width = container.height * imageRatio;
  return { x: (container.width - width) / 2, y: 0, width, height: container.height };
}
