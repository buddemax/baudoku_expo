import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme';

export function Skeleton({
  height = 16,
  width = '100%',
  radius = 8,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.85, { duration: 700 }), -1, true);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        animated,
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: theme.colors.surfaceMuted,
        },
        style,
      ]}
    />
  );
}
