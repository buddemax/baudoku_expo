import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react-native';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type BannerTone = 'info' | 'success' | 'warning' | 'error';

const iconByTone = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

export function Banner({
  tone = 'info',
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
  style,
}: {
  tone?: BannerTone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  const palette = {
    info: { bg: theme.colors.infoSoft, fg: theme.colors.info },
    success: { bg: theme.colors.successSoft, fg: theme.colors.success },
    warning: { bg: theme.colors.warningSoft, fg: theme.colors.warning },
    error: { bg: theme.colors.dangerSoft, fg: theme.colors.danger },
  }[tone];

  const Icon = iconByTone[tone];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: theme.spacing[3],
          padding: theme.spacing[4],
          backgroundColor: palette.bg,
          borderRadius: theme.radii.md,
          borderLeftWidth: 4,
          borderLeftColor: palette.fg,
        },
        style,
      ]}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
    >
      <Icon color={palette.fg} size={22} />
      <View style={{ flex: 1, gap: theme.spacing[1] }}>
        {title ? (
          <Text variant="bodyStrong" tone="default">
            {title}
          </Text>
        ) : null}
        <Text variant="body" tone="secondary">
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            style={{ paddingVertical: theme.spacing[2], minHeight: 44, justifyContent: 'center' }}
          >
            <Text variant="bodyStrong" style={{ color: palette.fg }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Schließen"
          onPress={onDismiss}
          style={{
            height: 44,
            width: 44,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: -theme.spacing[2],
          }}
        >
          <X color={theme.colors.textMuted} size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}
