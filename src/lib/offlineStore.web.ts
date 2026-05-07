import type { UploadableAsset } from './uploadProjectFile';
import { fallbackMimeType, normalizeMimeType } from './uploadProjectFile';
import type { CachedProjectDetail } from './offlineSnapshot';
import type { DefectCreateInput, MediaAsset, MediaType, Profile, Project, SyncPullResponse, Trade } from '../types/projects';

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
  local_blob_key?: string | null;
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

const memoryOutbox: OutboxItem[] = [];
const memoryPending: PendingMediaItem[] = [];
const memoryDrafts: CaptureDraftSnapshot[] = [];
const memoryBlobs = new Map<string, Blob>();

const dbName = 'baudoku-offline';
const dbVersion = 1;
const outboxStore = 'outbox';
const pendingStore = 'pending_media';
const draftStore = 'capture_drafts';
const blobStore = 'media_blobs';

let dbPromise: Promise<IDBDatabase | null> | null = null;

export const createClientId = (prefix = 'local') =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const database = () => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    const indexedDBRef = globalThis.indexedDB;
    if (!indexedDBRef) {
      resolve(null);
      return;
    }
    const request = indexedDBRef.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(outboxStore)) {
        db.createObjectStore(outboxStore, { keyPath: 'client_operation_id' });
      }
      if (!db.objectStoreNames.contains(pendingStore)) {
        db.createObjectStore(pendingStore, { keyPath: 'client_id' });
      }
      if (!db.objectStoreNames.contains(draftStore)) {
        db.createObjectStore(draftStore, { keyPath: 'client_id' });
      }
      if (!db.objectStoreNames.contains(blobStore)) {
        db.createObjectStore(blobStore);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
};

const transactionStore = async (name: string, mode: IDBTransactionMode) => {
  const db = await database();
  if (!db) {
    return null;
  }
  return db.transaction(name, mode).objectStore(name);
};

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const readAll = async <T>(storeName: string, memoryItems: T[]): Promise<T[]> => {
  const store = await transactionStore(storeName, 'readonly');
  if (!store) {
    return [...memoryItems];
  }
  try {
    return await requestResult<T[]>(store.getAll());
  } catch {
    return [...memoryItems];
  }
};

const putItem = async <T>(storeName: string, item: T, memoryItems: T[], key: keyof T) => {
  const index = memoryItems.findIndex((entry) => entry[key] === item[key]);
  if (index >= 0) {
    memoryItems[index] = item;
  } else {
    memoryItems.push(item);
  }
  const store = await transactionStore(storeName, 'readwrite');
  if (!store) {
    return;
  }
  await requestResult(store.put(item));
};

const putStoreItem = async <T>(storeName: string, item: T) => {
  const store = await transactionStore(storeName, 'readwrite');
  if (!store) {
    return;
  }
  await requestResult(store.put(item));
};

const clearStore = async (storeName: string) => {
  const store = await transactionStore(storeName, 'readwrite');
  if (!store) {
    return;
  }
  await requestResult(store.clear());
};

const deleteStoreKey = async (storeName: string, keyValue: string) => {
  const store = await transactionStore(storeName, 'readwrite');
  if (!store) {
    return;
  }
  await requestResult(store.delete(keyValue));
};

const deleteItem = async <T>(storeName: string, keyValue: string, memoryItems: T[], key: keyof T) => {
  const index = memoryItems.findIndex((entry) => entry[key] === keyValue);
  if (index >= 0) {
    memoryItems.splice(index, 1);
  }
  const store = await transactionStore(storeName, 'readwrite');
  if (!store) {
    return;
  }
  await requestResult(store.delete(keyValue));
};

const blobForKey = async (key: string) => {
  if (memoryBlobs.has(key)) {
    return memoryBlobs.get(key) ?? null;
  }
  const store = await transactionStore(blobStore, 'readonly');
  if (!store) {
    return null;
  }
  try {
    const blob = await requestResult<Blob | undefined>(store.get(key));
    if (blob) {
      memoryBlobs.set(key, blob);
    }
    return blob ?? null;
  } catch {
    return null;
  }
};

const putBlob = async (key: string, blob: Blob) => {
  memoryBlobs.set(key, blob);
  const store = await transactionStore(blobStore, 'readwrite');
  if (!store) {
    return;
  }
  await requestResult(store.put(blob, key));
};

const deleteBlob = async (key: string) => {
  memoryBlobs.delete(key);
  const store = await transactionStore(blobStore, 'readwrite');
  if (!store) {
    return;
  }
  await requestResult(store.delete(key));
};

const withHydratedBlobUri = async (item: PendingMediaItem): Promise<PendingMediaItem> => {
  if (!item.local_blob_key) {
    return item;
  }
  const blob = await blobForKey(item.local_blob_key);
  if (!blob) {
    return item;
  }
  return { ...item, local_uri: URL.createObjectURL(blob) };
};

export const readOutbox = async (): Promise<OutboxItem[]> =>
  (await readAll<OutboxItem>(outboxStore, memoryOutbox)).sort((a, b) => a.created_at.localeCompare(b.created_at));

export const writeOutbox = async (items: OutboxItem[]) => {
  memoryOutbox.length = 0;
  memoryOutbox.push(...items);
  await clearStore(outboxStore);
  await Promise.all(items.map((item) => putStoreItem(outboxStore, item)));
};

export const appendOutbox = async (item: OutboxItem) => {
  await putItem(outboxStore, item, memoryOutbox, 'client_operation_id');
};

export const deleteOutboxItem = async (clientOperationId: string) => {
  await deleteItem(outboxStore, clientOperationId, memoryOutbox, 'client_operation_id');
};

export const clearOfflineData = async () => {
  memoryOutbox.length = 0;
  memoryPending.length = 0;
  memoryDrafts.length = 0;
  memoryBlobs.clear();
  const db = await database();
  if (!db) {
    return;
  }
  await Promise.all(
    [outboxStore, pendingStore, draftStore, blobStore].map(async (storeName) => {
      const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
      await requestResult(store.clear());
    }),
  );
};

export const readPendingMedia = async (projectId?: string): Promise<PendingMediaItem[]> => {
  const items = await readAll<PendingMediaItem>(pendingStore, memoryPending);
  const filtered = items.filter((item) => item.status !== 'linked' && (!projectId || item.project_id === projectId));
  const hydrated = await Promise.all(filtered.map(withHydratedBlobUri));
  return hydrated.sort((a, b) => b.created_at.localeCompare(a.created_at));
};

export const readPendingMediaByClientId = async (clientId: string): Promise<PendingMediaItem | null> => {
  const store = await transactionStore(pendingStore, 'readonly');
  const memoryItem = memoryPending.find((item) => item.client_id === clientId) ?? null;
  if (!store) {
    return memoryItem;
  }
  try {
    const item = await requestResult<PendingMediaItem | undefined>(store.get(clientId));
    return item ? withHydratedBlobUri(item) : memoryItem;
  } catch {
    return memoryItem;
  }
};

export const upsertPendingMedia = async (item: PendingMediaItem) => {
  await putItem(pendingStore, item, memoryPending, 'client_id');
};

export const markPendingMediaLinked = async (clientId: string) => {
  const item = await readPendingMediaByClientId(clientId);
  if (item) {
    await upsertPendingMedia({ ...item, status: 'linked', updated_at: new Date().toISOString(), error: null });
  }
};

export const deletePendingMedia = async (clientId: string) => {
  const item = await readPendingMediaByClientId(clientId);
  await deleteItem(pendingStore, clientId, memoryPending, 'client_id');
  if (item?.local_blob_key) {
    await deleteBlob(item.local_blob_key);
  }
};

export const readCaptureDrafts = async (projectId: string): Promise<CaptureDraftSnapshot[]> =>
  (await readAll<CaptureDraftSnapshot>(draftStore, memoryDrafts))
    .filter((draft) => draft.project_id === projectId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

export const writeCaptureDrafts = async (projectId: string, drafts: CaptureDraftSnapshot[]) => {
  const current = await readAll<CaptureDraftSnapshot>(draftStore, memoryDrafts);
  const otherDrafts = memoryDrafts.filter((draft) => draft.project_id !== projectId);
  memoryDrafts.length = 0;
  memoryDrafts.push(...otherDrafts, ...drafts);
  await Promise.all(
    current
      .filter((draft) => draft.project_id === projectId)
      .map((draft) => deleteStoreKey(draftStore, draft.client_id)),
  );
  await Promise.all(drafts.map((draft) => putStoreItem(draftStore, draft)));
};

export const deleteCaptureDraft = async (clientId: string) => {
  await deleteItem(draftStore, clientId, memoryDrafts, 'client_id');
};

export const writeSyncSnapshot = async (_snapshot: SyncPullResponse) => {
  // No-op on web preview.
};

export const readSyncSnapshot = async (): Promise<SyncPullResponse> => ({
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

export const readCachedProjects = async (_options: { includeDeleted?: boolean } = {}): Promise<Project[]> => [];

export const readCachedProjectDetail = async (_projectId: string): Promise<CachedProjectDetail | null> => null;

export const writeReferenceDataCache = async (_data: { profiles: Profile[]; trades: Trade[] }) => {
  // Native offline-read cache only.
};

export const readCachedReferenceData = async (): Promise<{ profiles: Profile[]; trades: Trade[] }> => ({
  profiles: [],
  trades: [],
});

export const cacheAssetForOffline = async (
  projectId: string,
  asset: UploadableAsset,
  mediaType: PendingMediaItem['media_type'],
  source: PendingMediaItem['source'],
): Promise<PendingMediaItem> => {
  const clientId = createClientId(mediaType);
  const createdAt = new Date().toISOString();
  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error(`Datei konnte nicht lokal gesichert werden (${response.status}).`);
  }
  const blob = await response.blob();
  if (blob.size <= 0) {
    throw new Error('Offline-Datei ist leer oder konnte nicht vollstaendig gelesen werden.');
  }
  await putBlob(clientId, blob);
  const mimeType = normalizeMimeType(asset.mimeType || blob.type || fallbackMimeType(asset.fileName ?? asset.name, mediaType));
  const localUri = URL.createObjectURL(blob);
  const item: PendingMediaItem = {
    client_id: clientId,
    project_id: projectId,
    media_type: mediaType,
    local_uri: localUri,
    local_blob_key: clientId,
    file_name: asset.fileName ?? asset.name ?? clientId,
    mime_type: mimeType,
    file_size: asset.fileSize ?? asset.size ?? blob.size,
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
