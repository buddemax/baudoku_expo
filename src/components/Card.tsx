import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Surface } from './Surface';

type CardProps = {
  onPress?: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Card({ onPress, children, active = false, disabled = false, haptic = true, style, accessibilityLabel }: CardProps) {
  const theme = useTheme();
  const surfaceStyle: StyleProp<ViewStyle> = [
    active ? { borderColor: theme.colors.primary, borderWidth: 2 } : null,
    style,
  ];

  if (!onPress) {
    return (
      <Surface variant="card" padding="5" elevated bordered={!active} style={surfaceStyle}>
        {children}
      </Surface>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={() => {
        if (haptic) {
          void Haptics.selectionAsync();
        }
        onPress();
      }}
      style={({ pressed }) => [
        { borderRadius: theme.radii.lg, opacity: disabled ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      <Surface variant="card" padding="5" elevated bordered={!active} style={surfaceStyle}>
        <View>{children}</View>
      </Surface>
    </Pressable>
  );
}
