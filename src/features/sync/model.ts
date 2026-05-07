import type { OutboxItem, PendingMediaItem } from '../../lib/offlineStore';

export type TransferStatusState = 'offline' | 'syncing' | 'waiting' | 'error' | 'saved';

export type TransferStatusModel = {
  state: TransferStatusState;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  label: string;
  message: string;
  pendingEntries: number;
  pendingMedia: number;
  errorCount: number;
  isSyncing: boolean;
  showRetry: boolean;
};

type TransferStatusInput = {
  outbox: OutboxItem[];
  pendingMedia: PendingMediaItem[];
  networkOnline: boolean | null;
  isSyncing?: boolean;
  lastError?: string | null;
};

const waitingOutboxItems = (items: OutboxItem[]) => items.filter((item) => item.status !== 'error');
const errorOutboxItems = (items: OutboxItem[]) => items.filter((item) => item.status === 'error');

const waitingMediaItems = (items: PendingMediaItem[]) =>
  items.filter((item) => item.status !== 'linked' && item.status !== 'error');

const errorMediaItems = (items: PendingMediaItem[]) => items.filter((item) => item.status === 'error');

const formatCount = (count: number, singular: string, plural: string) => {
  if (!count) return null;
  return `${count} ${count === 1 ? singular : plural}`;
};

const joinParts = (parts: string[]) => {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}`;
};

const pendingSummary = (pendingEntries: number, mediaItems: PendingMediaItem[]) => {
  const photos = mediaItems.filter((item) => item.media_type === 'photo').length;
  const audio = mediaItems.filter((item) => item.media_type === 'audio').length;
  const files = mediaItems.length - photos - audio;
  const parts = [
    formatCount(pendingEntries, 'Eingabe', 'Eingaben'),
    formatCount(photos, 'Foto', 'Fotos'),
    formatCount(audio, 'Aufnahme', 'Aufnahmen'),
    formatCount(files, 'Datei', 'Dateien'),
  ].filter((part): part is string => Boolean(part));

  return joinParts(parts);
};

export function deriveTransferStatus({
  outbox,
  pendingMedia,
  networkOnline,
  isSyncing = false,
  lastError,
}: TransferStatusInput): TransferStatusModel {
  const waitingEntries = waitingOutboxItems(outbox).length;
  const mediaWaiting = waitingMediaItems(pendingMedia);
  const errorCount = errorOutboxItems(outbox).length + errorMediaItems(pendingMedia).length + (lastError ? 1 : 0);
  const pendingMediaCount = mediaWaiting.length;
  const pendingText = pendingSummary(waitingEntries, mediaWaiting);
  const hasPending = waitingEntries + pendingMediaCount > 0;

  if (errorCount) {
    return {
      state: 'error',
      tone: 'danger',
      label: 'Übertragung nicht abgeschlossen',
      message: hasPending
        ? `${pendingText} bleiben gesichert. Bitte Verbindung prüfen und erneut versuchen.`
        : 'Ein Abgleich konnte nicht abgeschlossen werden. Bitte Verbindung prüfen und erneut versuchen.',
      pendingEntries: waitingEntries,
      pendingMedia: pendingMediaCount,
      errorCount,
      isSyncing,
      showRetry: true,
    };
  }

  if (isSyncing) {
    return {
      state: 'syncing',
      tone: 'info',
      label: 'Übertragung läuft',
      message: hasPending ? `${pendingText} werden gerade übertragen.` : 'Daten werden abgeglichen.',
      pendingEntries: waitingEntries,
      pendingMedia: pendingMediaCount,
      errorCount,
      isSyncing: true,
      showRetry: false,
    };
  }

  if (networkOnline === false) {
    return {
      state: 'offline',
      tone: hasPending ? 'warning' : 'neutral',
      label: hasPending ? 'Noch offen' : 'Offline',
      message: hasPending
        ? `${pendingText} werden übertragen, sobald Verbindung besteht. Du kannst weiterarbeiten.`
        : 'Du kannst weiterarbeiten. Neue Eingaben bleiben auf dem Gerät gespeichert.',
      pendingEntries: waitingEntries,
      pendingMedia: pendingMediaCount,
      errorCount,
      isSyncing,
      showRetry: false,
    };
  }

  if (hasPending) {
    return {
      state: 'waiting',
      tone: 'warning',
      label: 'Noch offen',
      message: `${pendingText} werden automatisch übertragen.`,
      pendingEntries: waitingEntries,
      pendingMedia: pendingMediaCount,
      errorCount,
      isSyncing,
      showRetry: true,
    };
  }

  return {
    state: 'saved',
    tone: 'success',
    label: 'Alles gespeichert',
    message: 'Alle Eingaben sind auf dem aktuellen Stand.',
    pendingEntries: 0,
    pendingMedia: 0,
    errorCount,
    isSyncing,
    showRetry: false,
  };
}
