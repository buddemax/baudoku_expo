import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[4],
        paddingVertical: theme.spacing[7],
        paddingHorizontal: theme.spacing[5],
      }}
    >
      {icon ? (
        <View
          style={{
            height: 72,
            width: 72,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
      ) : null}
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="body" tone="secondary" align="center">
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="primary" size="lg" fullWidth />
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" size="md" />
      ) : null}
    </View>
  );
}
