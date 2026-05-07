import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import type { RadiusKey, SpacingKey } from '../theme';

type SurfaceVariant = 'plain' | 'card' | 'sunken' | 'muted';

export type SurfaceProps = Omit<ViewProps, 'style'> & {
  variant?: SurfaceVariant;
  padding?: SpacingKey;
  radius?: RadiusKey;
  elevated?: boolean;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Surface({
  variant = 'plain',
  padding,
  radius = 'lg',
  elevated = false,
  bordered = false,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const theme = useTheme();
  const backgroundColor =
    variant === 'card'
      ? theme.colors.surface
      : variant === 'sunken'
        ? theme.colors.surfaceSunken
        : variant === 'muted'
          ? theme.colors.surfaceMuted
          : 'transparent';

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor,
          borderRadius: theme.radii[radius],
          padding: padding ? theme.spacing[padding] : undefined,
          borderWidth: bordered ? 1 : 0,
          borderColor: theme.colors.border,
        },
        elevated ? theme.shadows.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
