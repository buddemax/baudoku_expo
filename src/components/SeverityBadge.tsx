import { AlertOctagon, AlertTriangle, Diamond, Info, Square } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

const labels: Record<Severity, string> = {
  info: 'Info',
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
};

type IconComponent = ComponentType<{ color: string; size: number }>;

// Double-encoding: each severity gets a unique icon shape so colorblind users
// + B/W report printouts can distinguish levels without relying on hue alone.
const icons: Record<Severity, IconComponent> = {
  info: Info,
  low: Square,
  medium: Diamond,
  high: AlertTriangle,
  critical: AlertOctagon,
};

export function SeverityBadge({
  severity,
  label,
  size = 'md',
}: {
  severity: Severity;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const theme = useTheme();
  const Icon = icons[severity];
  const fg = theme.colors[`severity${capitalize(severity)}` as const];
  const bg = theme.colors[`severity${capitalize(severity)}Soft` as const];
  const iconSize = size === 'sm' ? 12 : 14;
  const padX = size === 'sm' ? theme.spacing[2] : theme.spacing[3];
  const padY = size === 'sm' ? 2 : theme.spacing[1];

  return (
    <View
      accessibilityLabel={`Schweregrad: ${label ?? labels[severity]}`}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
        paddingHorizontal: padX,
        paddingVertical: padY,
        borderRadius: theme.radii.pill,
        backgroundColor: bg,
      }}
    >
      <Icon color={fg} size={iconSize} />
      <Text variant="captionStrong" style={{ color: fg }}>
        {label ?? labels[severity]}
      </Text>
    </View>
  );
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}
