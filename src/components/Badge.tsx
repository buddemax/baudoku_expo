import { View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();
  const palette = {
    neutral: { bg: theme.colors.surfaceMuted, fg: theme.colors.textSecondary },
    primary: { bg: theme.colors.primarySoft, fg: theme.colors.primary },
    success: { bg: theme.colors.successSoft, fg: theme.colors.success },
    warning: { bg: theme.colors.warningSoft, fg: theme.colors.warning },
    danger: { bg: theme.colors.dangerSoft, fg: theme.colors.danger },
    info: { bg: theme.colors.infoSoft, fg: theme.colors.info },
  }[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radii.pill,
        backgroundColor: palette.bg,
      }}
    >
      <Text variant="captionStrong" style={{ color: palette.fg }}>
        {label}
      </Text>
    </View>
  );
}
