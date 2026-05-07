import { formatDate, today } from '../../lib/formatters';
import type {
  Profile,
  Project,
  ProjectCreateInput,
  ProjectUpdateInput,
} from '../../types/projects';

export type ProjectFormState = ProjectCreateInput;
export type ProjectEditFormState = ProjectCreateInput;

export const initialProjectForm = (): ProjectFormState => ({
  project_number: '',
  client_name: '',
  object_address: '',
  site_visit_date: today(),
  appraisal_type: 'Abnahmebegehung',
});

export const initialProjectEditForm = (project: Project): ProjectEditFormState => ({
  project_number: project.project_number,
  client_name: project.client_name,
  object_address: project.object_address,
  site_visit_date: project.site_visit_date,
  appraisal_type: project.appraisal_type,
  lead_user_id: project.lead_user_id ?? undefined,
});

export const normalizeSearchText = (value: string) => value.trim().toLocaleLowerCase('de-DE');

export const projectSearchText = (project: Project) =>
  [
    project.project_number,
    project.client_name,
    project.object_address,
    project.site_visit_date,
    formatDate(project.site_visit_date),
    project.appraisal_type,
    project.status,
  ]
    .join(' ')
    .toLocaleLowerCase('de-DE');

export const profileById = (profiles: Profile[], profileId?: string | null) =>
  profiles.find((profile) => profile.id === profileId) ?? null;

export const profileLabel = (profile: Profile | null, fallback?: string | null) =>
  profile ? `${profile.display_name} (${profile.email})` : fallback || 'Nicht gesetzt';

export const toProjectCreateInput = (form: ProjectFormState): ProjectCreateInput => ({
  project_number: form.project_number.trim(),
  client_name: form.client_name.trim(),
  object_address: form.object_address.trim(),
  site_visit_date: form.site_visit_date.trim(),
  appraisal_type: form.appraisal_type,
  lead_user_id: form.lead_user_id ?? undefined,
});

export const toProjectUpdateInput = (form: ProjectEditFormState): ProjectUpdateInput => ({
  ...toProjectCreateInput(form),
});
