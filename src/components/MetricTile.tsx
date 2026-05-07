import { View } from 'react-native';

import { useTheme } from '../theme';
import { Surface } from './Surface';
import { Text } from './Text';

export function MetricTile({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'primary' }) {
  const theme = useTheme();
  return (
    <Surface variant="card" padding="4" elevated bordered style={{ flex: 1, gap: theme.spacing[2] }}>
      <Text variant="title" tone={tone === 'primary' ? 'primary' : 'default'}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View />
    </Surface>
  );
}
