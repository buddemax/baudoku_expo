import * as Haptics from 'expo-haptics';
import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme';
import type { Theme } from '../theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'lg' | 'md' | 'sm';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Variants = {
  container: ViewStyle;
  containerPressed: ViewStyle;
  containerDisabled: ViewStyle;
  textTone: 'default' | 'inverse' | 'danger' | 'primary';
};

const variantStyles = (theme: Theme): Record<ButtonVariant, Variants> => ({
  primary: {
    container: { backgroundColor: theme.colors.primary, borderWidth: 0 },
    containerPressed: { backgroundColor: theme.colors.primaryPressed },
    containerDisabled: { backgroundColor: theme.colors.primarySoft },
    textTone: 'inverse',
  },
  secondary: {
    container: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    containerPressed: { backgroundColor: theme.colors.surfaceMuted },
    containerDisabled: { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
    textTone: 'default',
  },
  danger: {
    container: {
      backgroundColor: theme.colors.dangerSoft,
      borderWidth: 1,
      borderColor: theme.colors.danger,
    },
    containerPressed: { backgroundColor: theme.colors.danger },
    containerDisabled: { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.border },
    textTone: 'danger',
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderWidth: 0 },
    containerPressed: { backgroundColor: theme.colors.surfaceMuted },
    containerDisabled: { backgroundColor: 'transparent' },
    textTone: 'primary',
  },
});

const sizeStyles = (theme: Theme): Record<ButtonSize, { height: number; px: number; textVariant: 'buttonLarge' | 'button' | 'callout' }> => ({
  lg: { height: theme.layout.touchTargetLarge, px: theme.spacing[5], textVariant: 'buttonLarge' },
  md: { height: theme.layout.touchTargetMin, px: theme.spacing[4], textVariant: 'button' },
  sm: { height: 44, px: theme.spacing[3], textVariant: 'callout' },
});

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  haptic = true,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const variants = useMemo(() => variantStyles(theme), [theme]);
  const sizes = useMemo(() => sizeStyles(theme), [theme]);
  const v = variants[variant];
  const s = sizes[size];
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (isDisabled) {
      return;
    }
    if (haptic) {
      void Haptics.impactAsync(
        variant === 'danger' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
      );
    }
    onPress();
  };

  const textColor: TextStyle['color'] =
    v.textTone === 'inverse'
      ? theme.colors.onPrimary
      : v.textTone === 'danger'
        ? theme.colors.danger
        : v.textTone === 'primary'
          ? theme.colors.primary
          : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: theme.radii.md,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        v.container,
        pressed && !isDisabled ? v.containerPressed : null,
        isDisabled ? v.containerDisabled : null,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor as string} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={{ marginRight: theme.spacing[2] }}>{leftIcon}</View> : null}
          <Text variant={s.textVariant} style={{ color: textColor }}>
            {label}
          </Text>
          {rightIcon ? <View style={{ marginLeft: theme.spacing[2] }}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
