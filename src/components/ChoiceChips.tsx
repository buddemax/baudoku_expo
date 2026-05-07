import * as Haptics from 'expo-haptics';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type ChoiceOption<TValue extends string> = {
  value: TValue;
  label: string;
};

export function ChoiceChips<TValue extends string>({
  value,
  options,
  onChange,
  style,
  haptic = true,
}: {
  value: TValue;
  options: ChoiceOption<TValue>[];
  onChange: (next: TValue) => void;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            key={option.value}
            onPress={() => {
              if (haptic) {
                void Haptics.selectionAsync();
              }
              onChange(option.value);
            }}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: theme.spacing[4],
              paddingVertical: theme.spacing[2],
              borderRadius: theme.radii.pill,
              backgroundColor: active ? theme.colors.primary : theme.colors.surface,
              borderWidth: 1,
              borderColor: active ? theme.colors.primary : theme.colors.border,
              opacity: pressed ? 0.85 : 1,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text variant="callout" style={{ color: active ? theme.colors.onPrimary : theme.colors.text }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
