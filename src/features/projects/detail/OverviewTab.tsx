import { ArrowRight, FileText, Map as MapIcon } from 'lucide-react-native';
import { Image, Pressable, View } from 'react-native';

import { Button, MetricTile, Surface, Text, VStack } from '../../../components';
import { TransferStatus } from '../../sync/TransferStatus';
import type { OutboxItem, PendingMediaItem } from '../../../lib/offlineStore';
import { useTheme } from '../../../theme';
import type { Defect, PlanFile } from '../../../types/projects';

export function OverviewTab({
  autoSyncing,
  busy,
  defectsCount,
  networkOnline,
  onOpenCapture,
  onOpenPlans,
  onOpenReport,
  onRetryOutbox,
  outbox,
  pendingMedia,
  plans,
  selectedDefect,
}: {
  autoSyncing: boolean;
  busy: string | null;
  defectsCount: number;
  networkOnline: boolean | null;
  onOpenCapture: () => void;
  onOpenPlans?: () => void;
  onOpenReport: () => void;
  onRetryOutbox: () => void;
  outbox: OutboxItem[];
  pendingMedia: PendingMediaItem[];
  plans?: PlanFile[];
  selectedDefect: Defect | null;
}) {
  const theme = useTheme();
  const pendingPhotoCount = pendingMedia.filter((item) => item.media_type === 'photo').length;
  const heroPlan = plans?.[0] ?? null;
  const heroMedia = heroPlan?.preview_media_asset ?? heroPlan?.media_asset;
  const totalMarkers = (plans ?? []).reduce((sum, plan) => sum + plan.markers.length, 0);

  return (
    <VStack gap="4">
      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        <MetricTile label="Einträge" value={String(defectsCount)} tone="primary" />
        <MetricTile label="Fotos offen" value={String(pendingPhotoCount)} />
      </View>

      {heroPlan && onOpenPlans ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pläne öffnen"
          onPress={onOpenPlans}
          style={({ pressed }) => ({
            borderRadius: theme.radii.lg,
            overflow: 'hidden',
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ height: 220, backgroundColor: theme.colors.surfaceSunken }}>
            {heroMedia?.signed_url ? (
              <Image source={{ uri: heroMedia.signed_url }} resizeMode="cover" style={{ height: '100%', width: '100%' }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <MapIcon color={theme.colors.textMuted} size={32} />
              </View>
            )}
          </View>
          <View style={{ padding: theme.spacing[4], gap: theme.spacing[1] }}>
            <Text variant="captionStrong" tone="primary" style={{ textTransform: 'uppercase' }}>
              Plan
            </Text>
            <Text variant="subheading" numberOfLines={1}>
              {heroPlan.name}
            </Text>
            <Text variant="caption" tone="muted">
              {plans?.length ?? 0} {plans?.length === 1 ? 'Plan' : 'Pläne'} – {totalMarkers} Marker
            </Text>
          </View>
        </Pressable>
      ) : null}

      <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[3] }}>
        <Text variant="heading">Nächste Schritte</Text>
        <Text variant="body" tone="secondary">
          {selectedDefect
            ? `Aktuell ausgewählt: ${selectedDefect.local_label || selectedDefect.description.slice(0, 60)}`
            : 'Kein Eintrag ausgewählt.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Erfassen"
              onPress={onOpenCapture}
              variant="primary"
              size="lg"
              fullWidth
              rightIcon={<ArrowRight color={theme.colors.onPrimary} size={20} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Bericht"
              onPress={onOpenReport}
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={<FileText color={theme.colors.text} size={20} />}
            />
          </View>
        </View>
      </Surface>

      <TransferStatus
        busy={Boolean(busy)}
        isSyncing={autoSyncing || busy === 'sync'}
        networkOnline={networkOnline}
        onRetry={onRetryOutbox}
        outbox={outbox}
        pendingMedia={pendingMedia}
      />
    </VStack>
  );
}
