import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export function FAB({
  icon,
  label,
  onPress,
  disabled = false,
  extended = true,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  extended?: boolean;
}) {
  const theme = useTheme();
  const handlePress = () => {
    if (disabled) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: theme.spacing[5],
          bottom: theme.spacing[5],
          minHeight: 64,
          minWidth: 64,
          paddingHorizontal: extended ? theme.spacing[5] : 0,
          paddingVertical: theme.spacing[3],
          borderRadius: theme.radii.pill,
          backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
          opacity: disabled ? 0.55 : 1,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: theme.spacing[2],
        },
        theme.shadows.raised,
      ]}
    >
      <View>{icon}</View>
      {extended ? (
        <Text variant="button" style={{ color: theme.colors.onPrimary }}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
