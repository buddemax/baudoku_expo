import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

type IconButtonVariant = 'plain' | 'soft' | 'solid';

export function IconButton({
  accessibilityLabel,
  icon,
  onPress,
  variant = 'plain',
  size = 56,
  disabled = false,
  haptic = true,
  style,
}: {
  accessibilityLabel: string;
  icon: ReactNode;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: number;
  disabled?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const handlePress = () => {
    if (disabled) {
      return;
    }
    if (haptic) {
      void Haptics.selectionAsync();
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          justifyContent: 'center',
          height: size,
          width: size,
          borderRadius: theme.radii.pill,
          backgroundColor:
            variant === 'solid'
              ? theme.colors.primary
              : variant === 'soft'
                ? theme.colors.surfaceMuted
                : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}
