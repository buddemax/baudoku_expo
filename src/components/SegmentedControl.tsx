import * as Haptics from 'expo-haptics';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export function SegmentedControl<TValue extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: TValue;
  options: { value: TValue; label: string }[];
  onChange: (next: TValue) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radii.md,
          padding: 4,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            key={option.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.sm,
              backgroundColor: active ? theme.colors.surface : 'transparent',
            }}
          >
            <Text variant="captionStrong" style={{ color: active ? theme.colors.text : theme.colors.textSecondary }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
