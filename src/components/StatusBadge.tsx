import { Badge } from './Badge';
import type { ProjectStatus } from '../types/projects';

const toneByStatus: Record<ProjectStatus, 'neutral' | 'info' | 'primary' | 'success'> = {
  Entwurf: 'neutral',
  'In Erfassung': 'info',
  'Bereit zur Pruefung': 'primary',
  'Bericht generiert': 'success',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const labelMap: Record<ProjectStatus, string> = {
    Entwurf: 'Entwurf',
    'In Erfassung': 'In Erfassung',
    'Bereit zur Pruefung': 'Bereit zur Prüfung',
    'Bericht generiert': 'Bericht fertig',
  };
  return <Badge label={labelMap[status]} tone={toneByStatus[status]} />;
}
