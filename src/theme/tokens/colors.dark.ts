import type { ColorScale } from './colors.light';

export const colorsDark: ColorScale = {
  background: '#0E1218',
  surface: '#161B23',
  surfaceMuted: '#1D232C',
  surfaceSunken: '#0B0F14',
  border: '#2A3140',
  borderStrong: '#3F4757',
  divider: '#222934',

  text: '#F4F6FA',
  textSecondary: '#C7CDD8',
  textMuted: '#969EAB',
  textInverse: '#0F172A',
  placeholder: '#737B89',

  primary: '#7FA7FF',
  primaryHover: '#9CBAFF',
  primaryPressed: '#B5CCFF',
  primarySoft: '#1B2A4A',
  onPrimary: '#0A1428',

  success: '#5DCB97',
  successSoft: '#11321F',
  warning: '#E2A155',
  warningSoft: '#3A2710',
  danger: '#F08374',
  dangerSoft: '#3A1A16',
  info: '#7FB3FF',
  infoSoft: '#16243A',

  // Severity ramp — lighter L for dark surface readability, lower C to avoid neon.
  severityInfo: '#7FB0DA',
  severityInfoSoft: '#1A2A38',
  severityLow: '#52C5A8',
  severityLowSoft: '#0F2D26',
  severityMedium: '#E0AC58',
  severityMediumSoft: '#3A2810',
  severityHigh: '#E68A60',
  severityHighSoft: '#3A1E12',
  severityCritical: '#E36C66',
  severityCriticalSoft: '#3A1818',

  alwaysWhite: '#FFFFFF',

  focusRing: '#7FA7FF',
  shadow: 'rgba(0, 0, 0, 0.5)',
  shadowStrong: 'rgba(0, 0, 0, 0.7)',
  overlay: 'rgba(0, 0, 0, 0.65)',
};
