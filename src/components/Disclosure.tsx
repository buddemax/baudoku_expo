import * as Haptics from 'expo-haptics';
import { ChevronDown } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme';
import { Text } from './Text';

type DisclosureProps = {
  title?: string;
  subtitle?: string;
  defaultOpen?: boolean;
  trigger?: ReactNode;
  triggerStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  haptic?: boolean;
  accessibilityLabel?: string;
};

export function Disclosure({
  title,
  subtitle,
  defaultOpen = false,
  trigger,
  triggerStyle,
  bodyStyle,
  children,
  haptic = true,
  accessibilityLabel,
}: DisclosureProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const rotation = useSharedValue(defaultOpen ? 1 : 0);

  const toggle = () => {
    if (haptic) {
      void Haptics.selectionAsync();
    }
    rotation.value = withTiming(open ? 0 : 1, { duration: theme.motion.duration.base });
    setOpen((current) => !current);
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing[3],
            minHeight: theme.layout.touchTargetMin,
            opacity: pressed ? 0.85 : 1,
          },
          triggerStyle,
        ]}
      >
        <View style={{ flex: 1 }}>
          {trigger ?? (
            <View style={{ gap: 2 }}>
              {title ? <Text variant="bodyStrong">{title}</Text> : null}
              {subtitle ? (
                <Text variant="caption" tone="muted">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          )}
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown color={theme.colors.textMuted} size={22} />
        </Animated.View>
      </Pressable>
      {open ? (
        <View style={[{ marginTop: theme.spacing[3], gap: theme.spacing[3] }, bodyStyle]}>{children}</View>
      ) : null}
    </View>
  );
}
