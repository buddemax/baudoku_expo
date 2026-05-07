import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export function AppHeader({
  title,
  subtitle,
  onBack,
  trailing,
  showBackLabel = false,
  backLabel = 'Zurück',
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  showBackLabel?: boolean;
  backLabel?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
        minHeight: theme.layout.appHeaderHeight,
        backgroundColor: theme.colors.background,
      }}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          style={({ pressed }) => ({
            minHeight: theme.layout.touchTargetMin,
            minWidth: showBackLabel ? undefined : theme.layout.touchTargetMin,
            paddingHorizontal: showBackLabel ? theme.spacing[3] : 0,
            borderRadius: theme.radii.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing[1],
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <ArrowLeft color={theme.colors.text} size={26} />
          {showBackLabel ? <Text variant="callout">{backLabel}</Text> : null}
        </Pressable>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
