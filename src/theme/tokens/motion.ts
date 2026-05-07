import { Easing } from 'react-native-reanimated';

export const motion = {
  duration: {
    instant: 80,
    fast: 140,
    base: 220,
    slow: 320,
    deliberate: 480,
  },
  easing: {
    standard: Easing.bezier(0.2, 0, 0, 1),
    accelerate: Easing.bezier(0.4, 0, 1, 1),
    decelerate: Easing.bezier(0, 0, 0.2, 1),
  },
} as const;

export type MotionKey = keyof typeof motion;
