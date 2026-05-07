import type { SyncPushApplied, SyncPushRejected } from '../types/projects';

export const appliedOperationIds = (items: SyncPushApplied[]) =>
  new Set(
    items
      .map((item) => item.client_operation_id)
      .filter((id): id is string => typeof id === 'string' && Boolean(id.trim())),
  );

export const rejectedOperationMessage = (item: SyncPushRejected) => {
  const message = item.message ?? item.detail;
  if (item.code === 'CONFLICT') {
    return message ? `Konflikt: ${message}` : 'Konflikt mit dem Serverstand.';
  }
  return message ?? 'Sync-Operation wurde vom Server abgelehnt.';
};

export const rejectedOperationErrors = (items: SyncPushRejected[]) =>
  new Map(
    items
      .filter((item) => typeof item.client_operation_id === 'string' && Boolean(item.client_operation_id.trim()))
      .map((item) => [String(item.client_operation_id), rejectedOperationMessage(item)]),
  );
