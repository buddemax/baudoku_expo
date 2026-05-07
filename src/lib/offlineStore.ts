import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import {
  emptySyncSnapshot,
  filterCachedProjects,
  hydrateCachedProjectDetailFromSnapshot,
  type CachedProjectDetail,
  type SyncEntityCollection,
} from './offlineSnapshot';
import { fallbackMimeType, normalizeMimeType, readAssetByteLength, type UploadableAsset } from './uploadProjectFile';
import type {
  DefectCreateInput,
  MediaAsset,
  MediaType,
  Profile,
  Project,
  SyncPullResponse,
  SyncTombstone,
  Trade,
} from '../types/projects';

export type OutboxItem = {
  client_operation_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  status: 'waiting' | 'error';
  error?: string;
};

export type PendingMediaItem = {
  client_id: string;
  project_id: string;
  media_type: Extract<MediaType, 'photo' | 'plan_source' | 'audio'>;
  local_uri: string;
  file_name?: string | null;
  mime_type: string;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  caption?: string | null;
  upload_media_id?: string | null;
  upload_storage_bucket?: string | null;
  upload_storage_path?: string | null;
  upload_token?: string | null;
  upload_token_created_at?: string | null;
  upload_attempts?: number | null;
  last_upload_attempt_at?: string | null;
  target_defect_id?: string | null;
  target_defect_client_id?: string | null;
  link_client_operation_id?: string | null;
  media_asset_id?: string | null;
  media_asset?: MediaAsset | null;
  status: 'local' | 'waiting' | 'uploaded' | 'linked' | 'error';
  source: 'camera' | 'library' | 'document' | 'recording';
  created_at: string;
  updated_at: string;
  error?: string | null;
};

export type CaptureDraftSnapshot = {
  client_id: string;
  project_id: string;
  form: DefectCreateInput;
  photo_client_ids: string[];
  voice_asset?: UploadableAsset | null;
  voice_transcript: string;
  status: 'draft' | 'saving' | 'saved' | 'error';
  error?: string | null;
  created_at: string;
  updated_at: string;
};

type OfflineStore = {
  outbox: OutboxItem[];
  pending_media: PendingMediaItem[];
};

type OutboxRow = {
  client_operation_id: string;
  type: string;
  payload_json: string;
  created_at: string;
  status: OutboxItem['status'];
  error: string | null;
};

type PendingMediaRow = {
  client_id: string;
  project_id: string;
  media_type: PendingMediaItem['media_type'];
  local_uri: string;
  file_name: string | null;
  mime_type: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  caption: string | null;
  upload_media_id: string | null;
  upload_storage_bucket: string | null;
  upload_storage_path: string | null;
  upload_token: string | null;
  upload_token_created_at: string | null;
  upload_attempts: number | null;
  last_upload_attempt_at: string | null;
  target_defect_id: string | null;
  target_defect_client_id: string | null;
  link_client_operation_id: string | null;
  media_asset_id: string | null;
  media_asset_json: string | null;
  status: PendingMediaItem['status'];
  source: PendingMediaItem['source'];
  created_at: string;
  updated_at: string;
  error: string | null;
};

type CaptureDraftRow = {
  client_id: string;
  project_id: string;
  form_json: string;
  photo_client_ids_json: string;
  voice_asset_json: string | null;
  voice_transcript: string;
  status: CaptureDraftSnapshot['status'];
  error: string | null;
  created_at: string;
  updated_at: string;
};

type SyncEntityRow = {
  collection: string;
  id: string;
  payload_json: string;
  updated_at: string | null;
};

const emptyStore = (): OfflineStore => ({
  outbox: [],
  pending_media: [],
});

export const createClientId = (prefix = 'local') =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const rootDirectory = () => new Directory(Paths.document, 'baudoku');
const storeFile = () => new File(rootDirectory(), 'offline-store.json');
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const ensureRootDirectory = () => {
  const root = rootDirectory();
  if (!root.exists) {
    root.create({ intermediates: true, idempotent: true });
  }
};

const readLegacyJsonStore = async (): Promise<OfflineStore> => {
  ensureRootDirectory();
  const file = storeFile();
  if (!file.exists) {
    return emptyStore();
  }

  try {
    const parsed = JSON.parse(await file.text()) as Partial<OfflineStore>;
    return {
      outbox: Array.isArray(parsed.outbox) ? parsed.outbox : [],
      pending_media: Array.isArray(parsed.pending_media) ? parsed.pending_media : [],
    };
  } catch {
    return emptyStore();
  }
};

const database = async () => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('baudoku-offline.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS outbox (
          client_operation_id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT
        );
        CREATE TABLE IF NOT EXISTS pending_media (
          client_id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          media_type TEXT NOT NULL,
          local_uri TEXT NOT NULL,
          file_name TEXT,
          mime_type TEXT NOT NULL,
          file_size INTEGER,
          width INTEGER,
          height INTEGER,
          duration_seconds REAL,
          caption TEXT,
          upload_media_id TEXT,
          upload_storage_bucket TEXT,
          upload_storage_path TEXT,
          upload_token TEXT,
          upload_token_created_at TEXT,
          upload_attempts INTEGER,
          last_upload_attempt_at TEXT,
          target_defect_id TEXT,
          target_defect_client_id TEXT,
          link_client_operation_id TEXT,
          media_asset_id TEXT,
          media_asset_json TEXT,
          status TEXT NOT NULL,
          source TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          error TEXT
        );
        CREATE TABLE IF NOT EXISTS capture_drafts (
          client_id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          form_json TEXT NOT NULL,
          photo_client_ids_json TEXT NOT NULL,
          voice_asset_json TEXT,
          voice_transcript TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_entities (
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          updated_at TEXT,
          PRIMARY KEY (collection, id)
        );
      `);
      await ensurePendingMediaColumns(db);
      await migrateLegacyJsonStore(db);
      return db;
    });
  }
  return databasePromise;
};

const ensurePendingMediaColumns = async (db: SQLite.SQLiteDatabase) => {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(pending_media)');
  const names = new Set(columns.map((column) => column.name));
  const addColumn = async (name: string, definition: string) => {
    if (!names.has(name)) {
      await db.runAsync(`ALTER TABLE pending_media ADD COLUMN ${name} ${definition}`);
    }
  };
  await addColumn('caption', 'TEXT');
  await addColumn('upload_media_id', 'TEXT');
  await addColumn('upload_storage_bucket', 'TEXT');
  await addColumn('upload_storage_path', 'TEXT');
  await addColumn('upload_token', 'TEXT');
  await addColumn('upload_token_created_at', 'TEXT');
  await addColumn('upload_attempts', 'INTEGER');
  await addColumn('last_upload_attempt_at', 'TEXT');
  await addColumn('target_defect_id', 'TEXT');
  await addColumn('target_defect_client_id', 'TEXT');
  await addColumn('link_client_operation_id', 'TEXT');
  const draftColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(capture_drafts)');
  if (!draftColumns.length) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS capture_drafts (
        client_id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        form_json TEXT NOT NULL,
        photo_client_ids_json TEXT NOT NULL,
        voice_asset_json TEXT,
        voice_transcript TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
};

const migrateLegacyJsonStore = async (db: SQLite.SQLiteDatabase) => {
  const migrated = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM metadata WHERE key = ?',
    'legacy_json_migrated',
  );
  if (migrated?.value === 'true') {
    return;
  }

  const legacy = await readLegacyJsonStore();
  for (const item of legacy.outbox) {
    await upsertOutboxRow(db, item);
  }
  for (const item of legacy.pending_media) {
    await upsertPendingMediaRow(db, item);
  }
  await db.runAsync(
    'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
    'legacy_json_migrated',
    'true',
  );
};

const upsertOutboxRow = async (db: SQLite.SQLiteDatabase, item: OutboxItem) => {
  await db.runAsync(
    `INSERT OR REPLACE INTO outbox
      (client_operation_id, type, payload_json, created_at, status, error)
      VALUES (?, ?, ?, ?, ?, ?)`,
    item.client_operation_id,
    item.type,
    JSON.stringify(item.payload),
    item.created_at,
    item.status,
    item.error ?? null,
  );
};

const upsertPendingMediaRow = async (db: SQLite.SQLiteDatabase, item: PendingMediaItem) => {
  await db.runAsync(
    `INSERT OR REPLACE INTO pending_media
      (
        client_id, project_id, media_type, local_uri, file_name, mime_type, file_size, width, height,
        duration_seconds, caption, upload_media_id, upload_storage_bucket, upload_storage_path,
        upload_token, upload_token_created_at, upload_attempts, last_upload_attempt_at,
        target_defect_id, target_defect_client_id, link_client_operation_id,
        media_asset_id, media_asset_json, status, source, created_at, updated_at, error
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.client_id,
    item.project_id,
    item.media_type,
    item.local_uri,
    item.file_name ?? null,
    item.mime_type,
    item.file_size ?? null,
    item.width ?? null,
    item.height ?? null,
    item.duration_seconds ?? null,
    item.caption ?? null,
    item.upload_media_id ?? null,
    item.upload_storage_bucket ?? null,
    item.upload_storage_path ?? null,
    item.upload_token ?? null,
    item.upload_token_created_at ?? null,
    item.upload_attempts ?? null,
    item.last_upload_attempt_at ?? null,
    item.target_defect_id ?? null,
    item.target_defect_client_id ?? null,
    item.link_client_operation_id ?? null,
    item.media_asset_id ?? null,
    item.media_asset ? JSON.stringify(item.media_asset) : null,
    item.status,
    item.source,
    item.created_at,
    item.updated_at,
    item.error ?? null,
  );
};

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const outboxFromRow = (row: OutboxRow): OutboxItem => ({
  client_operation_id: row.client_operation_id,
  type: row.type,
  payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
  created_at: row.created_at,
  status: row.status,
  error: row.error ?? undefined,
});

const pendingMediaFromRow = (row: PendingMediaRow): PendingMediaItem => ({
  client_id: row.client_id,
  project_id: row.project_id,
  media_type: row.media_type,
  local_uri: row.local_uri,
  file_name: row.file_name,
  mime_type: row.mime_type,
  file_size: row.file_size,
  width: row.width,
  height: row.height,
  duration_seconds: row.duration_seconds,
  caption: row.caption,
  upload_media_id: row.upload_media_id,
  upload_storage_bucket: row.upload_storage_bucket,
  upload_storage_path: row.upload_storage_path,
  upload_token: row.upload_token,
  upload_token_created_at: row.upload_token_created_at,
  upload_attempts: row.upload_attempts,
  last_upload_attempt_at: row.last_upload_attempt_at,
  target_defect_id: row.target_defect_id,
  target_defect_client_id: row.target_defect_client_id,
  link_client_operation_id: row.link_client_operation_id,
  media_asset_id: row.media_asset_id,
  media_asset: parseJson<MediaAsset | null>(row.media_asset_json, null),
  status: row.status,
  source: row.source,
  created_at: row.created_at,
  updated_at: row.updated_at,
  error: row.error,
});

const captureDraftFromRow = (row: CaptureDraftRow): CaptureDraftSnapshot => ({
  client_id: row.client_id,
  project_id: row.project_id,
  form: parseJson<DefectCreateInput>(row.form_json, {
    kind: 'defect',
    description: '',
    local_label: '',
  }),
  photo_client_ids: parseJson<string[]>(row.photo_client_ids_json, []),
  voice_asset: parseJson<UploadableAsset | null>(row.voice_asset_json, null),
  voice_transcript: row.voice_transcript,
  status: row.status,
  error: row.error,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const upsertCaptureDraftRow = async (db: SQLite.SQLiteDatabase, draft: CaptureDraftSnapshot) => {
  await db.runAsync(
    `INSERT OR REPLACE INTO capture_drafts
      (
        client_id, project_id, form_json, photo_client_ids_json, voice_asset_json,
        voice_transcript, status, error, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    draft.client_id,
    draft.project_id,
    JSON.stringify(draft.form),
    JSON.stringify(draft.photo_client_ids),
    draft.voice_asset ? JSON.stringify(draft.voice_asset) : null,
    draft.voice_transcript,
    draft.status,
    draft.error ?? null,
    draft.created_at,
    draft.updated_at,
  );
};

const syncCollections: SyncEntityCollection[] = [
  'projects',
  'defects',
  'media_assets',
  'defect_media_links',
  'plan_files',
  'plan_markers',
  'voice_notes',
  'general_findings',
  'project_conclusions',
];

const referenceCollections = ['profiles', 'trades'] as const;
type ReferenceCollection = (typeof referenceCollections)[number];

const entityId = (entity: Record<string, unknown>) => {
  const rawId = entity.id ?? entity.project_id;
  return typeof rawId === 'string' ? rawId : null;
};

const syncEntityUpdatedAt = (entity: Record<string, unknown>) => {
  const updatedAt = entity.updated_at ?? entity.deleted_at ?? entity.created_at;
  return typeof updatedAt === 'string' ? updatedAt : null;
};

const writeCollectionRows = async (
  db: SQLite.SQLiteDatabase,
  collection: string,
  entities: Record<string, unknown>[],
) => {
  await db.runAsync('DELETE FROM sync_entities WHERE collection = ?', collection);
  for (const entity of entities) {
    const id = entityId(entity);
    if (!id) {
      continue;
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_entities (collection, id, payload_json, updated_at)
       VALUES (?, ?, ?, ?)`,
      collection,
      id,
      JSON.stringify(entity),
      syncEntityUpdatedAt(entity),
    );
  }
};

export const readOutbox = async (): Promise<OutboxItem[]> => {
  const db = await database();
  const rows = await db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY created_at ASC');
  return rows.map(outboxFromRow);
};

export const writeOutbox = async (items: OutboxItem[]) => {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM outbox');
    for (const item of items) {
      await upsertOutboxRow(db, item);
    }
  });
};

export const appendOutbox = async (item: OutboxItem) => {
  const current = await readOutbox();
  await writeOutbox([...current, item]);
};

export const deleteOutboxItem = async (clientOperationId: string) => {
  const db = await database();
  await db.runAsync('DELETE FROM outbox WHERE client_operation_id = ?', clientOperationId);
};

export const clearOfflineData = async () => {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM outbox');
    await db.runAsync('DELETE FROM pending_media');
    await db.runAsync('DELETE FROM capture_drafts');
    await db.runAsync('DELETE FROM sync_entities');
    await db.runAsync('DELETE FROM metadata');
  });
  await db.closeAsync();
  databasePromise = null;

  const root = rootDirectory();
  if (root.exists) {
    root.delete();
  }
};

export const readPendingMedia = async (projectId?: string): Promise<PendingMediaItem[]> => {
  const db = await database();
  const rows = projectId
    ? await db.getAllAsync<PendingMediaRow>(
        'SELECT * FROM pending_media WHERE status != ? AND project_id = ? ORDER BY created_at DESC',
        'linked',
        projectId,
      )
    : await db.getAllAsync<PendingMediaRow>(
        'SELECT * FROM pending_media WHERE status != ? ORDER BY created_at DESC',
        'linked',
      );
  return rows.map(pendingMediaFromRow);
};

export const upsertPendingMedia = async (item: PendingMediaItem) => {
  const db = await database();
  await upsertPendingMediaRow(db, item);
};

export const readPendingMediaByClientId = async (clientId: string): Promise<PendingMediaItem | null> => {
  const db = await database();
  const row = await db.getFirstAsync<PendingMediaRow>(
    'SELECT * FROM pending_media WHERE client_id = ?',
    clientId,
  );
  return row ? pendingMediaFromRow(row) : null;
};

export const markPendingMediaLinked = async (clientId: string) => {
  const db = await database();
  await db.runAsync(
    'UPDATE pending_media SET status = ?, updated_at = ?, error = NULL WHERE client_id = ?',
    'linked',
    new Date().toISOString(),
    clientId,
  );
};

export const deletePendingMedia = async (clientId: string) => {
  const db = await database();
  await db.runAsync('DELETE FROM pending_media WHERE client_id = ?', clientId);
};

export const readCaptureDrafts = async (projectId: string): Promise<CaptureDraftSnapshot[]> => {
  const db = await database();
  const rows = await db.getAllAsync<CaptureDraftRow>(
    'SELECT * FROM capture_drafts WHERE project_id = ? ORDER BY created_at ASC',
    projectId,
  );
  return rows.map(captureDraftFromRow);
};

export const writeCaptureDrafts = async (projectId: string, drafts: CaptureDraftSnapshot[]) => {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM capture_drafts WHERE project_id = ?', projectId);
    for (const draft of drafts) {
      await upsertCaptureDraftRow(db, draft);
    }
  });
};

export const deleteCaptureDraft = async (clientId: string) => {
  const db = await database();
  await db.runAsync('DELETE FROM capture_drafts WHERE client_id = ?', clientId);
};

export const writeSyncSnapshot = async (snapshot: SyncPullResponse) => {
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const collection of syncCollections) {
      const entities = snapshot[collection] as Record<string, unknown>[];
      await writeCollectionRows(db, collection, entities);
    }
    await writeCollectionRows(
      db,
      'tombstones',
      (snapshot.tombstones ?? []).map((tombstone) => ({
        ...tombstone,
        id: `${tombstone.entity_type}:${tombstone.entity_id}`,
      })),
    );
  });
};

export const readSyncSnapshot = async (): Promise<SyncPullResponse> => {
  const db = await database();
  const rows = await db.getAllAsync<SyncEntityRow>('SELECT * FROM sync_entities');
  const snapshot = emptySyncSnapshot();
  const collections = new Set<string>(syncCollections);
  for (const row of rows) {
    if (row.collection === 'tombstones') {
      const tombstone = parseJson<(SyncTombstone & { id?: string }) | null>(row.payload_json, null);
      if (tombstone?.entity_type && tombstone.entity_id && tombstone.deleted_at) {
        const { id: _ignored, ...cleanTombstone } = tombstone;
        void _ignored;
        snapshot.tombstones.push(cleanTombstone);
      }
      continue;
    }
    if (!collections.has(row.collection)) {
      continue;
    }
    const entity = parseJson<Record<string, unknown> | null>(row.payload_json, null);
    if (entity) {
      (snapshot[row.collection as SyncEntityCollection] as Record<string, unknown>[]).push(entity);
    }
  }
  return snapshot;
};

export const readCachedProjects = async (
  options: { includeDeleted?: boolean } = {},
): Promise<Project[]> => filterCachedProjects(await readSyncSnapshot(), options);

export const readCachedProjectDetail = async (projectId: string): Promise<CachedProjectDetail | null> =>
  hydrateCachedProjectDetailFromSnapshot(await readSyncSnapshot(), projectId);

export const writeReferenceDataCache = async ({
  profiles,
  trades,
}: {
  profiles: Profile[];
  trades: Trade[];
}) => {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await writeCollectionRows(db, 'profiles', profiles as unknown as Record<string, unknown>[]);
    await writeCollectionRows(db, 'trades', trades as unknown as Record<string, unknown>[]);
  });
};

const readReferenceCollection = async <T extends Profile | Trade>(collection: ReferenceCollection): Promise<T[]> => {
  const db = await database();
  const rows = await db.getAllAsync<SyncEntityRow>(
    'SELECT * FROM sync_entities WHERE collection = ? ORDER BY updated_at DESC',
    collection,
  );
  return rows
    .map((row) => parseJson<T | null>(row.payload_json, null))
    .filter((item): item is T => Boolean(item));
};

export const readCachedReferenceData = async (): Promise<{ profiles: Profile[]; trades: Trade[] }> => ({
  profiles: await readReferenceCollection<Profile>('profiles'),
  trades: await readReferenceCollection<Trade>('trades'),
});

export const cacheAssetForOffline = async (
  projectId: string,
  asset: UploadableAsset,
  mediaType: Extract<MediaType, 'photo' | 'plan_source' | 'audio'>,
  source: PendingMediaItem['source'],
): Promise<PendingMediaItem> => {
  const clientId = createClientId(mediaType);
  const mimeType = normalizeMimeType(asset.mimeType || fallbackMimeType(asset.fileName ?? asset.name, mediaType));
  const fileName = asset.fileName ?? asset.name ?? `${clientId}.${extensionFor(mimeType, mediaType)}`;
  const createdAt = new Date().toISOString();
  const localUri = copyAssetToProjectDirectory(projectId, clientId, asset, mimeType, mediaType);
  const measuredFileSize = await readAssetByteLength(localUri);
  const fileSize = measuredFileSize ?? asset.fileSize ?? asset.size ?? null;
  if (fileSize !== null && fileSize <= 0) {
    throw new Error('Offline-Datei ist leer oder konnte nicht vollstaendig gelesen werden.');
  }

  const item: PendingMediaItem = {
    client_id: clientId,
    project_id: projectId,
    media_type: mediaType,
    local_uri: localUri,
    file_name: fileName,
    mime_type: mimeType,
    file_size: fileSize,
    width: asset.width ?? null,
    height: asset.height ?? null,
    duration_seconds: asset.duration_seconds ?? null,
    caption: asset.caption ?? null,
    status: 'local',
    source,
    created_at: createdAt,
    updated_at: createdAt,
  };

  await upsertPendingMedia(item);
  return item;
};

const copyAssetToProjectDirectory = (
  projectId: string,
  clientId: string,
  asset: UploadableAsset,
  mimeType: string,
  mediaType: MediaType,
) => {
  const mediaDirectory = new Directory(rootDirectory(), 'projects', projectId, 'media');
  if (!mediaDirectory.exists) {
    mediaDirectory.create({ intermediates: true, idempotent: true });
  }

  const target = new File(mediaDirectory, `${clientId}.${extensionFor(mimeType, mediaType)}`);
  const source = new File(asset.uri);
  source.copy(target);
  return target.uri;
};

const extensionFor = (mimeType: string, mediaType: MediaType) => {
  if (mimeType === 'image/png') {
    return 'png';
  }
  if (mimeType === 'image/webp') {
    return 'webp';
  }
  if (mimeType === 'image/heic') {
    return 'heic';
  }
  if (mimeType === 'image/heif') {
    return 'heif';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (mediaType === 'audio') {
    return 'm4a';
  }
  return 'jpg';
};
