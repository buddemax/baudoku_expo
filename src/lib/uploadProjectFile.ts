import type { Session } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { mediaApi } from './api';
import { supabase } from './supabase';
import type { MediaAsset, MediaType } from '../types/projects';

export type UploadableAsset = {
  uri: string;
  fileName?: string | null;
  name?: string;
  mimeType?: string | null;
  fileSize?: number;
  size?: number;
  width?: number;
  height?: number;
  duration_seconds?: number | null;
  caption?: string | null;
};

export type UploadReservation = {
  media_id?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  upload_token?: string | null;
  upload_token_created_at?: string | null;
};

export type UploadProjectFileOptions = {
  clientId?: string | null;
  reservation?: UploadReservation | null;
  onReservation?: (reservation: Required<UploadReservation>) => void | Promise<void>;
};

const maxUploadBytes = 50 * 1024 * 1024;
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function uploadProjectFile(
  session: Session,
  projectId: string,
  asset: UploadableAsset,
  mediaType: MediaType,
  options: UploadProjectFileOptions = {},
): Promise<MediaAsset> {
  if (!supabase) {
    throw new Error('Supabase ist nicht konfiguriert.');
  }

  const mimeType = normalizeMimeType(asset.mimeType || fallbackMimeType(asset.fileName ?? asset.name, mediaType));
  const fileName = asset.fileName ?? asset.name ?? undefined;
  assertSupportedUpload(mimeType, mediaType);
  const bytes = await readAssetBytes(asset.uri);
  const fileSize = bytes.byteLength;
  if (fileSize <= 0) {
    throw new Error('Datei ist leer oder konnte nicht vollstaendig gelesen werden.');
  }
  if (fileSize > maxUploadBytes) {
    throw new Error('Datei ist groesser als 50 MiB und bleibt lokal fuer eine spaetere Verarbeitung gesichert.');
  }

  const reserved = options.reservation;
  if (reserved?.media_id && reserved.storage_bucket && reserved.storage_path) {
    try {
      return await mediaApi.completeUpload(session, projectId, {
        media_id: reserved.media_id,
        media_type: mediaType,
        storage_bucket: reserved.storage_bucket,
        storage_path: reserved.storage_path,
        mime_type: mimeType,
        file_size: fileSize,
        width: asset.width,
        height: asset.height,
        duration_seconds: asset.duration_seconds,
        caption: asset.caption ?? null,
        client_id: options.clientId ?? null,
      });
    } catch {
      // The reserved object is not complete yet; continue with a fresh signed token for the same path.
    }
  }

  const init = await mediaApi.initUpload(session, projectId, {
    media_type: mediaType,
    mime_type: mimeType,
    file_name: fileName,
    client_id: options.clientId ?? null,
    media_id: reserved?.media_id ?? null,
    storage_path: reserved?.storage_path ?? null,
  });
  if (options.onReservation) {
    await options.onReservation({
      media_id: init.media_id,
      storage_bucket: init.storage_bucket,
      storage_path: init.storage_path,
      upload_token: init.upload_token,
      upload_token_created_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase.storage
    .from(init.storage_bucket)
    .uploadToSignedUrl(init.storage_path, init.upload_token, bytes, {
      contentType: mimeType,
    });

  if (error) {
    const details = [
      error.message,
      `Pfad: ${init.storage_path}`,
      `Typ: ${mimeType}`,
      `Groesse: ${fileSize} Bytes`,
    ].join(' | ');
    throw new Error(details);
  }

  return mediaApi.completeUpload(session, projectId, {
    media_id: init.media_id,
    media_type: mediaType,
    storage_bucket: init.storage_bucket,
    storage_path: init.storage_path,
    mime_type: mimeType,
    file_size: fileSize,
    width: asset.width,
    height: asset.height,
    duration_seconds: asset.duration_seconds,
    caption: asset.caption ?? null,
    client_id: options.clientId ?? null,
  });
}

export async function readAssetByteLength(uri: string): Promise<number | null> {
  if (Platform.OS !== 'web') {
    try {
      const info = new File(uri).info();
      if (typeof info.size === 'number') {
        return info.size;
      }
    } catch {
      // Fall back to reading the file below.
    }
  }

  try {
    return (await readAssetBytes(uri)).byteLength;
  } catch {
    return null;
  }
}

async function readAssetBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS !== 'web') {
    try {
      return await new File(uri).bytes();
    } catch {
      // Some picker sources can only be read through fetch; try that before failing.
    }
  }

  const response = await fetch(uri);
  if (!response.ok && !uri.startsWith('file:') && !uri.startsWith('content:')) {
    throw new Error(`Datei konnte nicht gelesen werden (${response.status}).`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export function fallbackMimeType(fileName: string | null | undefined, mediaType: MediaType): string {
  const lower = fileName?.toLowerCase() ?? '';
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (mediaType === 'report_docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (mediaType === 'report_pdf') {
    return 'application/pdf';
  }
  if (mediaType === 'audio') {
    return 'audio/mp4';
  }
  if (mediaType === 'plan_source' && (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))) {
    return 'image/jpeg';
  }
  return mediaType === 'plan_source' ? 'application/pdf' : 'image/jpeg';
}

export function normalizeMimeType(mimeType: string | null | undefined): string {
  const normalized = String(mimeType || '').trim().toLowerCase();
  if (normalized === 'image/jpg') {
    return 'image/jpeg';
  }
  return normalized || 'application/octet-stream';
}

function assertSupportedUpload(mimeType: string, mediaType: MediaType) {
  if (mediaType === 'photo' && !imageMimeTypes.has(mimeType)) {
    throw new Error(`Bildformat ${mimeType} wird nicht direkt hochgeladen. Foto bleibt lokal gesichert.`);
  }
  if (mediaType === 'plan_source') {
    const supported = mimeType === 'application/pdf' || imageMimeTypes.has(mimeType);
    if (!supported) {
      throw new Error(`Planformat ${mimeType} wird nicht direkt hochgeladen. Datei bleibt lokal gesichert.`);
    }
  }
}

export function planFileType(name: string, mimeType?: string): 'jpg' | 'png' | 'pdf' {
  const lower = name.toLowerCase();
  if (mimeType === 'image/png' || lower.endsWith('.png')) {
    return 'png';
  }
  if (
    mimeType === 'image/jpeg' ||
    mimeType === 'image/webp' ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp')
  ) {
    return 'jpg';
  }
  return 'pdf';
}
