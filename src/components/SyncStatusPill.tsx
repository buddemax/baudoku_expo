import { Check, CircleAlert, Cloud, CloudOff, CloudUpload, RefreshCw } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

type SyncState =
  | { kind: 'syncing' }
  | { kind: 'errors'; count: number }
  | { kind: 'pending'; count: number }
  | { kind: 'offline'; pending: number }
  | { kind: 'synced' }
  | { kind: 'online' };

type IconComponent = ComponentType<{ color: string; size: number }>;

export function SyncStatusPill({
  networkOnline,
  autoSyncing,
  pending,
  errors,
  lastSyncedAt,
  onPress,
}: {
  networkOnline: boolean | null;
  autoSyncing: boolean;
  pending: number;
  errors: number;
  lastSyncedAt: Date | null;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const state = derive({ networkOnline, autoSyncing, pending, errors, lastSyncedAt });
  const palette: Record<
    SyncState['kind'],
    { bg: string; fg: string; icon: IconComponent; label: string }
  > = {
    syncing: {
      bg: theme.colors.infoSoft,
      fg: theme.colors.info,
      icon: RefreshCw,
      label: 'Übertragung läuft',
    },
    errors: {
      bg: theme.colors.dangerSoft,
      fg: theme.colors.danger,
      icon: CircleAlert,
      label: state.kind === 'errors' ? `${state.count} Fehler` : 'Fehler',
    },
    pending: {
      bg: theme.colors.warningSoft,
      fg: theme.colors.warning,
      icon: CloudUpload,
      label: state.kind === 'pending' ? `${state.count} offen` : 'Offen',
    },
    offline: {
      bg: theme.colors.surfaceMuted,
      fg: theme.colors.textSecondary,
      icon: CloudOff,
      label: state.kind === 'offline' && state.pending > 0 ? `Offline · ${state.pending}` : 'Offline',
    },
    synced: {
      bg: theme.colors.successSoft,
      fg: theme.colors.success,
      icon: Check,
      label: 'Gespeichert',
    },
    online: {
      bg: theme.colors.surfaceMuted,
      fg: theme.colors.textSecondary,
      icon: Cloud,
      label: 'Online',
    },
  };
  const { bg, fg, icon: Icon, label } = palette[state.kind];

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingLeft: theme.spacing[3],
        paddingRight: theme.spacing[3],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radii.pill,
        backgroundColor: bg,
        minHeight: 32,
      }}
    >
      {state.kind === 'syncing' ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Icon color={fg} size={16} />
      )}
      <Text variant="captionStrong" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sync-Status: ${label}`}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

function derive({
  networkOnline,
  autoSyncing,
  pending,
  errors,
  lastSyncedAt,
}: {
  networkOnline: boolean | null;
  autoSyncing: boolean;
  pending: number;
  errors: number;
  lastSyncedAt: Date | null;
}): SyncState {
  if (autoSyncing) return { kind: 'syncing' };
  if (errors > 0) return { kind: 'errors', count: errors };
  if (networkOnline === false) return { kind: 'offline', pending };
  if (pending > 0) return { kind: 'pending', count: pending };
  if (lastSyncedAt) return { kind: 'synced' };
  return { kind: 'online' };
}
