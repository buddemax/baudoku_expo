import type {
  Defect,
  DefectMediaLink,
  GeneralFinding,
  MediaAsset,
  PlanFile,
  PlanMarker,
  Project,
  ProjectConclusion,
  SyncPullResponse,
  SyncTombstone,
  VoiceNote,
} from '../types/projects';

export type SyncEntityCollection = Exclude<keyof SyncPullResponse, 'tombstones'>;

export type CachedProjectDetail = {
  project: Project;
  defects: Defect[];
  mediaAssets: MediaAsset[];
  defectMediaLinks: DefectMediaLink[];
  plans: PlanFile[];
  planMarkers: PlanMarker[];
  voiceNotes: VoiceNote[];
  generalFindings: GeneralFinding[];
  conclusion: ProjectConclusion | null;
};

const tombstoneCollectionByEntityType: Record<string, SyncEntityCollection> = {
  project: 'projects',
  defect: 'defects',
  media_asset: 'media_assets',
  defect_media_link: 'defect_media_links',
  plan_file: 'plan_files',
  plan_marker: 'plan_markers',
  voice_note: 'voice_notes',
  general_finding: 'general_findings',
  project_conclusion: 'project_conclusions',
};

export const collectionForTombstone = (entityType: string): SyncEntityCollection | null =>
  tombstoneCollectionByEntityType[entityType] ?? null;

export const emptySyncSnapshot = (): SyncPullResponse => ({
  projects: [],
  defects: [],
  media_assets: [],
  defect_media_links: [],
  plan_files: [],
  plan_markers: [],
  voice_notes: [],
  general_findings: [],
  project_conclusions: [],
  tombstones: [],
});

const hasDeletedAt = (entity: { deleted_at?: string | null }) => Boolean(entity.deleted_at);

const tombstoneIdsForCollection = (
  tombstones: SyncTombstone[],
  collection: SyncEntityCollection,
) =>
  new Set(
    tombstones
      .filter((tombstone) => collectionForTombstone(tombstone.entity_type) === collection)
      .map((tombstone) => tombstone.entity_id),
  );

const entityId = (entity: { id?: string; project_id?: string }) => entity.id ?? entity.project_id ?? '';

const notDeleted = <T extends { id?: string; project_id?: string; deleted_at?: string | null }>(
  collection: SyncEntityCollection,
  tombstones: SyncTombstone[],
) => {
  const deletedIds = tombstoneIdsForCollection(tombstones, collection);
  return (entity: T) => !hasDeletedAt(entity) && !deletedIds.has(entityId(entity));
};

const sortByNumberThenDate = <T extends { created_at?: string; updated_at?: string | null }>(
  items: T[],
  numberValue: (item: T) => number,
) =>
  [...items].sort((left, right) => {
    const numberDiff = numberValue(left) - numberValue(right);
    if (numberDiff !== 0) {
      return numberDiff;
    }
    return String(left.created_at ?? left.updated_at ?? '').localeCompare(String(right.created_at ?? right.updated_at ?? ''));
  });

export const filterCachedProjects = (
  snapshot: SyncPullResponse,
  options: { includeDeleted?: boolean } = {},
) => {
  const projectTombstones = tombstoneIdsForCollection(snapshot.tombstones ?? [], 'projects');
  const projects = snapshot.projects.filter((project) => {
    if (projectTombstones.has(project.id)) {
      return options.includeDeleted ? Boolean(project.deleted_at) : false;
    }
    return options.includeDeleted ? true : !project.deleted_at;
  });
  return [...projects].sort((left, right) =>
    String(right.updated_at ?? right.created_at ?? '').localeCompare(String(left.updated_at ?? left.created_at ?? '')),
  );
};

export const hydrateCachedProjectDetailFromSnapshot = (
  snapshot: SyncPullResponse,
  projectId: string,
): CachedProjectDetail | null => {
  const project = filterCachedProjects(snapshot, { includeDeleted: true }).find((item) => item.id === projectId);
  if (!project || project.deleted_at) {
    return null;
  }

  const tombstones = snapshot.tombstones ?? [];
  const mediaAssets = snapshot.media_assets.filter(
    (asset) => asset.project_id === projectId && notDeleted('media_assets', tombstones)(asset),
  );
  const mediaById = new Map(mediaAssets.map((asset) => [asset.id, asset]));

  const rawDefects = snapshot.defects.filter(
    (defect) => defect.project_id === projectId && notDeleted('defects', tombstones)(defect),
  );
  const defectIds = new Set(rawDefects.map((defect) => defect.id));
  const defectMediaLinks = snapshot.defect_media_links
    .filter((link) => defectIds.has(link.defect_id) && notDeleted('defect_media_links', tombstones)(link))
    .map((link) => ({
      ...link,
      media_asset: link.media_asset ?? mediaById.get(link.media_asset_id) ?? null,
    }));
  const linksByDefectId = defectMediaLinks.reduce((map, link) => {
    const links = map.get(link.defect_id) ?? [];
    links.push(link);
    map.set(link.defect_id, links);
    return map;
  }, new Map<string, DefectMediaLink[]>());
  const defects = sortByNumberThenDate(
    rawDefects.map((defect) => ({
      ...defect,
      media_links: sortByNumberThenDate(
        linksByDefectId.get(defect.id) ?? defect.media_links ?? [],
        (link) => link.sort_order,
      ),
    })),
    (defect) => defect.report_sort_order,
  );

  const planMarkers = snapshot.plan_markers.filter(
    (marker) => marker.project_id === projectId && notDeleted('plan_markers', tombstones)(marker),
  );
  const markersByPlanId = planMarkers.reduce((map, marker) => {
    const markers = map.get(marker.plan_file_id) ?? [];
    markers.push(marker);
    map.set(marker.plan_file_id, markers);
    return map;
  }, new Map<string, PlanMarker[]>());
  const plans = sortByNumberThenDate(
    snapshot.plan_files
      .filter((plan) => plan.project_id === projectId && notDeleted('plan_files', tombstones)(plan))
      .map((plan) => ({
        ...plan,
        media_asset: plan.media_asset ?? mediaById.get(plan.media_asset_id) ?? null,
        preview_media_asset:
          plan.preview_media_asset ??
          (plan.preview_media_asset_id ? mediaById.get(plan.preview_media_asset_id) ?? null : null),
        markers: sortByNumberThenDate(markersByPlanId.get(plan.id) ?? plan.markers ?? [], (marker) => marker.page_number ?? 1),
      })),
    (plan) => new Date(plan.created_at).getTime(),
  );

  const voiceNotes = sortByNumberThenDate(
    snapshot.voice_notes
      .filter((voiceNote) => voiceNote.project_id === projectId && notDeleted('voice_notes', tombstones)(voiceNote))
      .map((voiceNote) => ({
        ...voiceNote,
        media_asset: voiceNote.media_asset ?? mediaById.get(voiceNote.media_asset_id) ?? null,
      })),
    (voiceNote) => new Date(voiceNote.created_at).getTime(),
  );

  const generalFindings = sortByNumberThenDate(
    snapshot.general_findings.filter(
      (finding) => finding.project_id === projectId && notDeleted('general_findings', tombstones)(finding),
    ),
    (finding) => finding.sort_order,
  );

  const conclusion =
    snapshot.project_conclusions.find(
      (item) => item.project_id === projectId && notDeleted('project_conclusions', tombstones)(item),
    ) ?? null;

  return {
    project,
    defects,
    mediaAssets,
    defectMediaLinks,
    plans,
    planMarkers,
    voiceNotes,
    generalFindings,
    conclusion,
  };
};
