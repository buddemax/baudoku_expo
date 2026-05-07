import { useState } from 'react';
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  helpText?: string;
  errorText?: string;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  multiline?: boolean;
  minHeight?: number;
};

export function Input({
  label,
  helpText,
  errorText,
  leftAdornment,
  rightAdornment,
  containerStyle,
  multiline,
  minHeight,
  onFocus,
  onBlur,
  editable = true,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const errored = Boolean(errorText);

  const borderColor = errored
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={[{ gap: theme.spacing[2] }, containerStyle]}>
      {label ? (
        <Text variant="label" tone="default">
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceMuted,
          borderColor,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.layout.inputPaddingX,
          paddingVertical: multiline ? theme.spacing[3] : 0,
          minHeight: minHeight ?? (multiline ? 120 : theme.layout.touchTargetMin),
        }}
      >
        {leftAdornment ? <View style={{ marginRight: theme.spacing[2] }}>{leftAdornment}</View> : null}
        <TextInput
          {...rest}
          editable={editable}
          multiline={multiline}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={theme.colors.placeholder}
          style={{
            flex: 1,
            color: theme.colors.text,
            ...theme.typography.body,
            paddingVertical: multiline ? 0 : theme.spacing[2],
            textAlignVertical: multiline ? 'top' : 'auto',
          }}
        />
        {rightAdornment ? <View style={{ marginLeft: theme.spacing[2] }}>{rightAdornment}</View> : null}
      </View>
      {errorText ? (
        <Text variant="caption" tone="danger">
          {errorText}
        </Text>
      ) : helpText ? (
        <Text variant="caption" tone="muted">
          {helpText}
        </Text>
      ) : null}
    </View>
  );
}
