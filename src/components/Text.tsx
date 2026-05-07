import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme';
import type { TypographyKey } from '../theme';

type Tone = 'default' | 'secondary' | 'muted' | 'inverse' | 'primary' | 'danger' | 'success' | 'warning';

export type TextProps = Omit<RNTextProps, 'style'> & {
  variant?: TypographyKey;
  tone?: Tone;
  align?: 'auto' | 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
};

export function Text({
  variant = 'body',
  tone = 'default',
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const colorByTone: Record<Tone, string> = {
    default: theme.colors.text,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    inverse: theme.colors.textInverse,
    primary: theme.colors.primary,
    danger: theme.colors.danger,
    success: theme.colors.success,
    warning: theme.colors.warning,
  };

  return (
    <RNText
      {...rest}
      style={[
        theme.typography[variant],
        { color: colorByTone[tone] },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
