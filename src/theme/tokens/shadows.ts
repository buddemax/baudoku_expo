import type { ViewStyle } from 'react-native';

import type { ColorScale } from './colors.light';

export const buildShadows = (palette: ColorScale) => ({
  none: {
    boxShadow: 'none',
  },
  card: {
    boxShadow: `0 4px 12px ${palette.shadow}`,
  },
  raised: {
    boxShadow: `0 8px 18px ${palette.shadowStrong}`,
  },
  overlay: {
    boxShadow: `0 16px 28px ${palette.shadowStrong}`,
  },
}) satisfies Record<string, ViewStyle>;

export type Shadows = ReturnType<typeof buildShadows>;
