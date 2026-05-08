import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { Banner } from './Banner';
import { EmptyState } from './EmptyState';
import { LoadingBlock } from './Loading';
import { Skeleton } from './Skeleton';

type DataStateProps<T> = {
  loading?: boolean;
  error?: string | null;
  data?: T | null;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  errorTitle?: string;
  onRetry?: () => void;
  loadingFallback?: 'skeleton' | 'block';
  skeletonRows?: number;
  children: (data: T) => ReactNode;
};

export function DataState<T>({
  loading,
  error,
  data,
  isEmpty,
  emptyTitle = 'Keine Daten',
  emptyMessage = 'Es sind noch keine Einträge vorhanden.',
  emptyIcon,
  emptyActionLabel,
  onEmptyAction,
  errorTitle = 'Daten konnten nicht geladen werden',
  onRetry,
  loadingFallback = 'block',
  skeletonRows = 3,
  children,
}: DataStateProps<T>) {
  const theme = useTheme();

  if (loading && !data) {
    if (loadingFallback === 'skeleton') {
      return (
        <View style={{ gap: theme.spacing[3] }}>
          {Array.from({ length: skeletonRows }).map((_, idx) => (
            <Skeleton key={idx} height={64} radius={theme.radii.lg} />
          ))}
        </View>
      );
    }
    return <LoadingBlock />;
  }

  if (error && !data) {
    return (
      <Banner
        tone="error"
        title={errorTitle}
        message={error}
        actionLabel={onRetry ? 'Erneut versuchen' : undefined}
        onAction={onRetry}
      />
    );
  }

  if (data === null || data === undefined || isEmpty?.(data)) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        icon={emptyIcon}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return <>{children(data)}</>;
}
