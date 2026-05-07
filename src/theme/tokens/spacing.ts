export const spacing = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 32,
  '8': 40,
  '9': 48,
  '10': 56,
  '11': 64,
  '12': 80,
} as const;

export type SpacingKey = keyof typeof spacing;

export const layout = {
  screenPaddingX: spacing[5],
  screenPaddingY: spacing[5],
  sectionGap: spacing[6],
  cardPadding: spacing[5],
  inputPaddingX: spacing[4],
  inputPaddingY: spacing[4],
  fabBottomOffset: spacing[7],
  bottomTabHeight: 72,
  appHeaderHeight: 64,
  touchTargetMin: 56,
  touchTargetLarge: 64,
} as const;
