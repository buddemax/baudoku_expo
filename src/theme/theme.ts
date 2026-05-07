import { colorsDark, colorsLight, type ColorScale } from './tokens';
import { buildShadows, type Shadows } from './tokens/shadows';
import { layout, spacing } from './tokens/spacing';
import { radii } from './tokens/radii';
import { typography, fontWeight } from './tokens/typography';
import { motion } from './tokens/motion';

export type ThemeScheme = 'light' | 'dark';

export type Theme = {
  scheme: ThemeScheme;
  colors: ColorScale;
  spacing: typeof spacing;
  layout: typeof layout;
  radii: typeof radii;
  typography: typeof typography;
  fontWeight: typeof fontWeight;
  shadows: Shadows;
  motion: typeof motion;
};

export const buildTheme = (scheme: ThemeScheme): Theme => {
  const colors = scheme === 'dark' ? colorsDark : colorsLight;
  return {
    scheme,
    colors,
    spacing,
    layout,
    radii,
    typography,
    fontWeight,
    shadows: buildShadows(colors),
    motion,
  };
};

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');
