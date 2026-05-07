import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: readonly Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'refreshControl'>;
};

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
  edges = ['bottom'],
  contentStyle,
  keyboardAvoiding = false,
  scrollProps,
}: Props) {
  const theme = useTheme();
  const contentPad = padded
    ? {
        paddingHorizontal: theme.layout.screenPaddingX,
        paddingVertical: theme.layout.screenPaddingY,
        gap: theme.spacing[4],
      }
    : null;

  const inner = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        ) : undefined
      }
      contentContainerStyle={[contentPad, contentStyle]}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentPad, contentStyle]}>{children}</View>
  );

  const keyboardWrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      {keyboardWrapped}
    </SafeAreaView>
  );
}
