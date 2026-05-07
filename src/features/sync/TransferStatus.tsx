import { ActivityIndicator, View } from 'react-native';
import { AlertCircle, CheckCircle2, CloudOff, Clock3, RefreshCcw } from 'lucide-react-native';

import { Badge, Button, Surface, Text } from '../../components';
import type { OutboxItem, PendingMediaItem } from '../../lib/offlineStore';
import { useTheme } from '../../theme';
import { deriveTransferStatus, type TransferStatusModel } from './model';

const badgeTone = (tone: TransferStatusModel['tone']) => {
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  if (tone === 'success') return 'success';
  if (tone === 'info') return 'info';
  return 'neutral';
};

const iconColor = (model: TransferStatusModel, theme: ReturnType<typeof useTheme>) => {
  if (model.tone === 'danger') return theme.colors.danger;
  if (model.tone === 'warning') return theme.colors.warning;
  if (model.tone === 'success') return theme.colors.success;
  if (model.tone === 'info') return theme.colors.info;
  return theme.colors.textMuted;
};

const StatusIcon = ({ model }: { model: TransferStatusModel }) => {
  const theme = useTheme();
  const color = iconColor(model, theme);

  if (model.isSyncing) {
    return <ActivityIndicator color={color} size="small" />;
  }
  if (model.state === 'error') {
    return <AlertCircle color={color} size={22} />;
  }
  if (model.state === 'saved') {
    return <CheckCircle2 color={color} size={22} />;
  }
  if (model.state === 'offline') {
    return <CloudOff color={color} size={22} />;
  }
  return <Clock3 color={color} size={22} />;
};

export function TransferStatus({
  busy,
  isSyncing = false,
  lastError,
  networkOnline,
  onRetry,
  outbox,
  pendingMedia,
}: {
  busy?: boolean;
  isSyncing?: boolean;
  lastError?: string | null;
  networkOnline: boolean | null;
  onRetry?: () => void;
  outbox: OutboxItem[];
  pendingMedia: PendingMediaItem[];
}) {
  const theme = useTheme();
  const model = deriveTransferStatus({ outbox, pendingMedia, networkOnline, isSyncing, lastError });
  const retryDisabled = Boolean(busy) || networkOnline === false || model.isSyncing;
  const retryVisible = model.showRetry && onRetry && networkOnline !== false;
  const badgeLabel = model.state === 'error' ? 'Fehler' : model.label;

  return (
    <Surface
      variant="card"
      padding="5"
      elevated
      bordered
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Datenstand: ${model.label}. ${model.message}`}
      style={{ gap: theme.spacing[3] }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
        <View
          style={{
            height: 40,
            width: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radii.md,
            backgroundColor:
              model.tone === 'danger'
                ? theme.colors.dangerSoft
                : model.tone === 'warning'
                  ? theme.colors.warningSoft
                  : model.tone === 'success'
                    ? theme.colors.successSoft
                    : model.tone === 'info'
                      ? theme.colors.infoSoft
                      : theme.colors.surfaceMuted,
          }}
        >
          <StatusIcon model={model} />
        </View>
        <View style={{ flex: 1, gap: theme.spacing[1] }}>
          <Text variant="heading">Datenstand</Text>
          <Text variant="bodyStrong">{model.label}</Text>
          <Text variant="body" tone="secondary">
            {model.message}
          </Text>
        </View>
        <Badge label={badgeLabel} tone={badgeTone(model.tone)} />
      </View>
      {retryVisible ? (
        <Button
          label="Erneut versuchen"
          onPress={onRetry}
          variant="ghost"
          size="md"
          loading={model.isSyncing}
          disabled={retryDisabled}
          leftIcon={<RefreshCcw color={theme.colors.primary} size={20} />}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : null}
    </Surface>
  );
}
