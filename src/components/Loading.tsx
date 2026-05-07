import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export function LoadingBlock({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingVertical: theme.spacing[7],
      }}
    >
      <ActivityIndicator color={theme.colors.primary} size="large" />
      {label ? (
        <Text variant="callout" tone="muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function FullscreenLoading({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
        gap: theme.spacing[4],
      }}
    >
      <ActivityIndicator color={theme.colors.primary} size="large" />
      {label ? (
        <Text variant="callout" tone="muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
}
