import type { Project } from '../types/projects';

export const today = () => new Date().toISOString().slice(0, 10);

export const formatDate = (value?: string) => {
  if (!value) {
    return 'ohne Datum';
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (value?: string) => {
  if (!value) {
    return 'noch nicht bekannt';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const getProjectTitle = (project: Project) => `${project.project_number} - ${project.client_name}`;
