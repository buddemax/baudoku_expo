import type { TextStyle } from 'react-native';

export const fontFamily = {
  regular: undefined,
  medium: undefined,
  bold: undefined,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  heading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: fontWeight.semibold,
  },
  subheading: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: fontWeight.semibold,
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: fontWeight.regular,
  },
  bodyStrong: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: fontWeight.semibold,
  },
  callout: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeight.medium,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.regular,
  },
  captionStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeight.semibold,
  },
  buttonLarge: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
  },
  button: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyKey = keyof typeof typography;
