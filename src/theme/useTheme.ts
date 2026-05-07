import { useContext } from 'react';

import { ThemeContext } from './ThemeProvider';
import type { Theme } from './theme';

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider.');
  }
  return context.theme;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used inside ThemeProvider.');
  }
  return context;
}
