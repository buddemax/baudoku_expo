export const colorsLight = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F2F5',
  surfaceSunken: '#EDEFF3',
  border: '#D4D9E0',
  borderStrong: '#A8B0BC',
  divider: '#E5E8EC',

  text: '#0F172A',
  textSecondary: '#3F4756',
  textMuted: '#5B6472',
  textInverse: '#FFFFFF',
  placeholder: '#7A8290',

  primary: '#1F4FB6',
  primaryHover: '#1A44A0',
  primaryPressed: '#163A8A',
  primarySoft: '#E5ECF9',
  onPrimary: '#FFFFFF',

  success: '#0F7A4F',
  successSoft: '#E1F5EC',
  warning: '#A35B00',
  warningSoft: '#FBEBD2',
  danger: '#A6261C',
  dangerSoft: '#FBE7E4',
  info: '#1F5BA6',
  infoSoft: '#E0EAF8',

  // Severity ramp — derived from oklch, double-encoded with icon shape elsewhere.
  // Designed to remain colorblind-distinguishable AND printable on B/W laser.
  severityInfo: '#3D7DB8',
  severityInfoSoft: '#E2ECF6',
  severityLow: '#1E8C73',
  severityLowSoft: '#DCF1EC',
  severityMedium: '#B3791A',
  severityMediumSoft: '#F8EAD2',
  severityHigh: '#C25826',
  severityHighSoft: '#FCE2D5',
  severityCritical: '#A11E1E',
  severityCriticalSoft: '#F7DBDA',

  // Always-white token (replaces hardcoded #ffffff in PlansTab + VoiceInput).
  // Maps to surface color in dark mode where appropriate.
  alwaysWhite: '#FFFFFF',

  focusRing: '#1F4FB6',
  shadow: 'rgba(15, 23, 42, 0.08)',
  shadowStrong: 'rgba(15, 23, 42, 0.16)',
  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

export type ColorScale = Record<keyof typeof colorsLight, string>;
