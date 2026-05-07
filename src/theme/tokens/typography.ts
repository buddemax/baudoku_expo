import type { TextStyle } from 'react-native';

/**
 * Type pair (Phase 3 design system):
 *   display = Saira  — humanist sans with engineered/measurement feel
 *   body    = Atkinson Hyperlegible — designed for outdoor readability + legal-report calm
 *
 * Both load via @expo-google-fonts/* in src/theme/fonts.ts.
 */
export const fontFamily = {
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
  display: 'Saira_600SemiBold',
  displayBold: 'Saira_700Bold',
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const typography = {
  display: {
    fontFamily: fontFamily.displayBold,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  heading: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: fontWeight.semibold,
  },
  subheading: {
    fontFamily: fontFamily.display,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: fontWeight.semibold,
  },
  bodyLarge: {
    fontFamily: fontFamily.body,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: fontWeight.regular,
  },
  bodyStrong: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: fontWeight.semibold,
  },
  callout: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeight.medium,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.regular,
  },
  captionStrong: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
  },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeight.semibold,
  },
  eyebrow: {
    fontFamily: fontFamily.display,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  buttonLarge: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
  },
  button: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyKey = keyof typeof typography;
