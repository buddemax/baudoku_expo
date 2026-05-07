import { View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

const initialsFor = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: size,
        width: size,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel={`Profil ${name}`}
    >
      <Text variant="captionStrong" style={{ color: theme.colors.primary }}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}
