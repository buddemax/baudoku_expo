export const appraisalTypes = [
  'Abnahmebegehung',
  'Schadensaufnahme',
  'Baubegleitung',
  'Maengelruege',
] as const;

export type AppraisalType = (typeof appraisalTypes)[number];

export const projectStatuses = [
  'Entwurf',
  'In Erfassung',
  'Bereit zur Pruefung',
  'Bericht generiert',
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export type Project = {
  id: string;
  project_number: string;
  client_name: string;
  object_address: string;
  site_visit_date: string;
  appraisal_type: AppraisalType;
  status: ProjectStatus;
  language?: 'de' | 'en';
  lead_user_id?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  revision?: number;
  client_id?: string | null;
};

export type Profile = {
  id: string;
  display_name: string;
  email: string;
  is_active: boolean;
};

export type Trade = {
  id: string;
  name: string;
  is_active: boolean;
};

export type ProjectCreateInput = {
  project_number: string;
  client_name: string;
  object_address: string;
  site_visit_date: string;
  appraisal_type: AppraisalType;
  lead_user_id?: string | null;
  language?: 'de' | 'en';
};

export type ProjectUpdateInput = Partial<ProjectCreateInput> & {
  lead_user_id?: string | null;
  language?: 'de' | 'en';
};

export type DefectKind = 'defect' | 'notice';

export type MediaType = 'photo' | 'audio' | 'plan_source' | 'plan_render' | 'report_docx' | 'report_pdf';
export type DraftStatus = 'open' | 'suggested' | 'edited' | 'confirmed' | 'error';

export type AiJobStatus = 'queued' | 'processing' | 'done' | 'failed';
export type AiJobType = 'transcribe_audio' | 'describe_image';

export type AiJob = {
  id: string;
  project_id: string;
  media_asset_id?: string | null;
  job_type: AiJobType;
  status: AiJobStatus;
  provider?: string | null;
  input_ref?: string | null;
  result_text?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
};

export type MediaAsset = {
  id: string;
  project_id: string;
  media_type: MediaType;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  caption?: string | null;
  caption_status: DraftStatus;
  created_by: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  revision?: number;
  client_id?: string | null;
  signed_url?: string | null;
};

export type ProjectMediaItem = MediaAsset & {
  defect_links?: DefectMediaLink[];
};

export type MediaSignedUrlResponse = {
  signed_url: string;
  expires_in?: number | null;
};

export type DefectMediaLink = {
  id: string;
  defect_id: string;
  media_asset_id: string;
  sort_order: number;
  include_in_report: boolean;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  revision?: number;
  client_id?: string | null;
  media_asset?: MediaAsset | null;
};

export type DefectMediaLinkCreateInput = {
  media_asset_id: string;
  sort_order?: number;
  include_in_report?: boolean;
  client_id?: string | null;
};

export type DefectMediaLinkUpdateInput = {
  defect_id?: string;
  sort_order?: number;
  include_in_report?: boolean;
};

export type Defect = {
  id: string;
  project_id: string;
  kind: DefectKind;
  local_label: string;
  report_number?: number | null;
  report_sort_order: number;
  trade_id?: string | null;
  trade_name_snapshot?: string | null;
  category?: string | null;
  description: string;
  ai_status: 'open' | 'suggested' | 'edited' | 'confirmed' | 'error';
  created_by: string;
  created_at: string;
  updated_at: string;
  revision: number;
  client_id?: string | null;
  media_links: DefectMediaLink[];
};

export type DefectCreateInput = {
  kind: DefectKind;
  description: string;
  local_label: string;
  trade_id?: string | null;
  trade_name_snapshot?: string;
  category?: string;
  client_id?: string | null;
};

export type MediaInitUploadInput = {
  media_type: MediaType;
  mime_type: string;
  file_name?: string | null;
  client_id?: string | null;
  media_id?: string | null;
  storage_path?: string | null;
};

export type MediaInitUpload = {
  media_id: string;
  storage_bucket: string;
  storage_path: string;
  upload_token: string;
  signed_url: string;
};

export type MediaCompleteUploadInput = {
  media_id: string;
  media_type: MediaType;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  caption?: string | null;
  client_id?: string | null;
};

export type MediaAssetUpdateInput = {
  caption?: string | null;
  caption_status?: DraftStatus;
};

export type VoiceNoteTargetType = 'general_finding' | 'defect_description' | 'caption' | 'conclusion';

export type ReportTextStatus = 'draft' | 'confirmed';

export type VoiceNote = {
  id: string;
  project_id: string;
  media_asset_id: string;
  target_type: VoiceNoteTargetType;
  defect_id?: string | null;
  transcript?: string | null;
  transcript_status: DraftStatus;
  error_message?: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  revision?: number;
  client_id?: string | null;
  media_asset?: MediaAsset | null;
};

export type VoiceNoteCreateInput = {
  media_asset_id: string;
  target_type: VoiceNoteTargetType;
  defect_id?: string | null;
  transcript?: string | null;
  transcript_status?: DraftStatus;
  client_id?: string | null;
};

export type VoiceNoteUpdateInput = Partial<Omit<VoiceNoteCreateInput, 'media_asset_id'>> & {
  media_asset_id?: string;
};

export type GeneralFinding = {
  id: string;
  project_id: string;
  text: string;
  source_voice_note_id?: string | null;
  status: ReportTextStatus;
  sort_order: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  revision?: number;
  client_id?: string | null;
};

export type GeneralFindingCreateInput = {
  text: string;
  source_voice_note_id?: string | null;
  status?: ReportTextStatus;
  sort_order?: number | null;
  client_id?: string | null;
};

export type GeneralFindingUpdateInput = Partial<GeneralFindingCreateInput>;

export type ProjectConclusion = {
  project_id: string;
  text: string;
  source_voice_note_id?: string | null;
  status: ReportTextStatus;
  updated_by?: string | null;
  updated_at: string;
  deleted_at?: string | null;
  revision?: number;
  client_id?: string | null;
};

export type ProjectConclusionUpsertInput = {
  text: string;
  source_voice_note_id?: string | null;
  status?: ReportTextStatus;
  client_id?: string | null;
};

export type PlanMarker = {
  id: string;
  project_id: string;
  plan_file_id: string;
  defect_id: string;
  page_number?: number | null;
  x_norm: number;
  y_norm: number;
  label_override?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  revision?: number;
  client_id?: string | null;
};

export type PlanMarkerCreateInput = {
  defect_id: string;
  page_number?: number | null;
  x_norm: number;
  y_norm: number;
  label_override?: string | null;
  client_id?: string | null;
};

export type PlanMarkerUpdateInput = {
  defect_id?: string;
  page_number?: number | null;
  x_norm?: number;
  y_norm?: number;
  label_override?: string | null;
  client_id?: string | null;
};

export type PlanCreateInput = {
  media_asset_id: string;
  name: string;
  file_type: 'jpg' | 'png' | 'pdf';
  page_count?: number;
  selected_page?: number | null;
  client_id?: string | null;
};

export type PlanFile = {
  id: string;
  project_id: string;
  media_asset_id: string;
  preview_media_asset_id?: string | null;
  name: string;
  file_type: 'jpg' | 'png' | 'pdf';
  page_count?: number | null;
  selected_page?: number | null;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  revision?: number;
  client_id?: string | null;
  media_asset?: MediaAsset | null;
  preview_media_asset?: MediaAsset | null;
  markers: PlanMarker[];
};

export type PlanExportFormat = 'source' | 'image';

export type PlanExportResponse = {
  download_url: string;
  file_name: string;
  mime_type: string;
  expires_in_seconds: number;
};

export type ReportWarning = {
  code: string;
  message: string;
  severity: 'info' | 'warning';
};

export type ReportVersion = {
  id: string;
  project_id: string;
  version_number: number;
  media_asset_id: string;
  pdf_media_asset_id?: string | null;
  generated_by: string;
  generated_at: string;
  warning_count: number;
  warnings_snapshot: ReportWarning[];
  template_version?: string | null;
  report_revision?: number | null;
  download_url?: string | null;
  pdf_download_url?: string | null;
};

export type EmailRecipient = {
  email: string;
  name?: string | null;
};

export type ReportEmailRequest = {
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  subject: string;
  message: string;
  client_send_id?: string | null;
};

export type ReportEmailResponse = {
  message_id: string;
  version_id: string;
  sent_at: string;
  recipient_count: number;
  delivery_mode: 'attachments' | 'links';
  attachment_bytes: number;
  link_expires_at?: string | null;
};

export type ReportPreview = {
  project: Project;
  defects: Defect[];
  general_findings?: GeneralFinding[];
  project_conclusion?: ProjectConclusion | null;
  plans?: PlanFile[];
  voice_notes?: VoiceNote[];
  warnings: ReportWarning[];
  confirmed_by?: string | null;
  confirmed_at?: string | null;
};

export type ReportPreviewConfirmation = {
  project_id: string;
  confirmed_by?: string | null;
  confirmed_at: string;
};

export type SyncPullResponse = {
  projects: Project[];
  defects: Defect[];
  media_assets: MediaAsset[];
  defect_media_links: DefectMediaLink[];
  plan_files: PlanFile[];
  plan_markers: PlanMarker[];
  voice_notes: VoiceNote[];
  general_findings: GeneralFinding[];
  project_conclusions: ProjectConclusion[];
  tombstones: SyncTombstone[];
};

export type SyncTombstone = {
  entity_type: string;
  entity_id: string;
  project_id?: string | null;
  deleted_at: string;
  updated_at?: string | null;
  revision?: number | null;
};

export type SyncPushApplied = {
  client_operation_id?: string | null;
  result?: Record<string, unknown> | null;
};

export type SyncPushRejected = {
  client_operation_id?: string | null;
  code?: string | null;
  message?: string | null;
  detail?: string | null;
  server_entity?: Record<string, unknown> | null;
};

export type SyncPushResponse = {
  applied: SyncPushApplied[];
  rejected: SyncPushRejected[];
};
