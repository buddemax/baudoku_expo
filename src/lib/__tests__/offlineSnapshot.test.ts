import { describe, expect, it } from 'vitest';

import {
  emptySyncSnapshot,
  filterCachedProjects,
  hydrateCachedProjectDetailFromSnapshot,
} from '../offlineSnapshot';
import type { SyncPullResponse } from '../../types/projects';

const baseSnapshot = (): SyncPullResponse => ({
  ...emptySyncSnapshot(),
  projects: [
    {
      id: 'project-1',
      project_number: 'BBA-001',
      client_name: 'Kunde',
      object_address: 'Adresse',
      site_visit_date: '2026-05-06',
      appraisal_type: 'Abnahmebegehung',
      status: 'In Erfassung',
      created_at: '2026-05-06T08:00:00Z',
      updated_at: '2026-05-06T09:00:00Z',
      revision: 1,
    },
  ],
});

describe('offline snapshot hydration', () => {
  it('hydrates a project detail with linked media and applies tombstones', () => {
    const snapshot: SyncPullResponse = {
      ...baseSnapshot(),
      defects: [
        {
          id: 'defect-1',
          project_id: 'project-1',
          kind: 'defect',
          local_label: '1',
          report_sort_order: 1,
          description: 'Riss',
          ai_status: 'open',
          created_by: 'user-1',
          created_at: '2026-05-06T09:00:00Z',
          updated_at: '2026-05-06T09:00:00Z',
          revision: 1,
          media_links: [],
        },
        {
          id: 'defect-2',
          project_id: 'project-1',
          kind: 'notice',
          local_label: '2',
          report_sort_order: 2,
          description: 'Geloescht',
          ai_status: 'open',
          created_by: 'user-1',
          created_at: '2026-05-06T09:05:00Z',
          updated_at: '2026-05-06T09:05:00Z',
          revision: 1,
          media_links: [],
        },
      ],
      media_assets: [
        {
          id: 'media-1',
          project_id: 'project-1',
          media_type: 'photo',
          storage_bucket: 'project-files',
          storage_path: 'projects/project-1/photos/media-1.jpg',
          mime_type: 'image/jpeg',
          caption: 'Detail',
          caption_status: 'confirmed',
          created_by: 'user-1',
          created_at: '2026-05-06T09:10:00Z',
        },
      ],
      defect_media_links: [
        {
          id: 'link-1',
          defect_id: 'defect-1',
          media_asset_id: 'media-1',
          sort_order: 1,
          include_in_report: true,
          created_at: '2026-05-06T09:11:00Z',
        },
      ],
      plan_files: [
        {
          id: 'plan-1',
          project_id: 'project-1',
          media_asset_id: 'media-1',
          name: 'Plan',
          file_type: 'jpg',
          created_by: 'user-1',
          created_at: '2026-05-06T09:12:00Z',
          markers: [],
        },
      ],
      plan_markers: [
        {
          id: 'marker-1',
          project_id: 'project-1',
          plan_file_id: 'plan-1',
          defect_id: 'defect-1',
          page_number: 1,
          x_norm: 0.5,
          y_norm: 0.5,
          created_by: 'user-1',
          created_at: '2026-05-06T09:13:00Z',
          updated_at: '2026-05-06T09:13:00Z',
        },
      ],
      general_findings: [
        {
          id: 'finding-1',
          project_id: 'project-1',
          text: 'Allgemein',
          status: 'confirmed',
          sort_order: 1,
          created_at: '2026-05-06T09:14:00Z',
          updated_at: '2026-05-06T09:14:00Z',
        },
      ],
      project_conclusions: [
        {
          project_id: 'project-1',
          text: 'Fazit',
          status: 'confirmed',
          updated_at: '2026-05-06T09:15:00Z',
        },
      ],
      tombstones: [
        {
          entity_type: 'defect',
          entity_id: 'defect-2',
          project_id: 'project-1',
          deleted_at: '2026-05-06T10:00:00Z',
        },
        {
          entity_type: 'plan_marker',
          entity_id: 'marker-1',
          project_id: 'project-1',
          deleted_at: '2026-05-06T10:00:00Z',
        },
      ],
    };

    const detail = hydrateCachedProjectDetailFromSnapshot(snapshot, 'project-1');

    expect(detail?.defects.map((defect) => defect.id)).toEqual(['defect-1']);
    expect(detail?.defects[0]?.media_links[0]?.media_asset?.caption).toBe('Detail');
    expect(detail?.plans[0]?.markers).toEqual([]);
    expect(detail?.generalFindings[0]?.text).toBe('Allgemein');
    expect(detail?.conclusion?.text).toBe('Fazit');
  });

  it('keeps deleted projects out of active cached lists', () => {
    const snapshot = baseSnapshot();
    snapshot.projects.push({
      ...snapshot.projects[0],
      id: 'project-deleted',
      project_number: 'BBA-002',
      deleted_at: '2026-05-06T10:00:00Z',
    });

    expect(filterCachedProjects(snapshot).map((project) => project.id)).toEqual(['project-1']);
    expect(filterCachedProjects(snapshot, { includeDeleted: true }).map((project) => project.id)).toContain(
      'project-deleted',
    );
  });
});
