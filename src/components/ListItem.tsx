import * as Haptics from 'expo-haptics';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export function ListItem({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  showChevron = false,
  disabled = false,
  haptic = true,
  style,
  accessibilityLabel,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  disabled?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const content = (
    <>
      {leading ? <View style={{ marginRight: theme.spacing[3] }}>{leading}</View> : null}
      <View style={{ flex: 1, gap: theme.spacing[1] }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={{ marginLeft: theme.spacing[3] }}>{trailing}</View> : null}
      {showChevron ? (
        <ChevronRight color={theme.colors.textMuted} size={22} style={{ marginLeft: theme.spacing[2] }} />
      ) : null}
    </>
  );

  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.layout.touchTargetMin,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  };

  if (!onPress) {
    return <View style={[baseStyle, style]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (haptic) {
          void Haptics.selectionAsync();
        }
        onPress();
      }}
      style={({ pressed }) => [
        baseStyle,
        { backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent' },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}
