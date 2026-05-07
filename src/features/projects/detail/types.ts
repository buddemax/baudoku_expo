import type { DefectCreateInput } from '../../../types/projects';
import type { PendingMediaItem } from '../../../lib/offlineStore';
import type { UploadableAsset } from '../../../lib/uploadProjectFile';

export type WorkspaceTab = 'overview' | 'capture' | 'entries' | 'plans' | 'report';
export type DefectFormState = DefectCreateInput;

export type CaptureEntryDraft = {
  clientId: string;
  form: DefectFormState;
  photoDrafts: PendingMediaItem[];
  voiceAsset: UploadableAsset | null;
  voiceTranscript: string;
  status: 'draft' | 'saving' | 'saved' | 'error';
  error?: string | null;
};

export const workspaceTabs: { key: WorkspaceTab; label: string }[] = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'capture', label: 'Erfassen' },
  { key: 'plans', label: 'Pläne' },
  { key: 'entries', label: 'Einträge' },
  { key: 'report', label: 'Bericht' },
];
