import { Check, ChevronDown, Map as MapIcon, Maximize2, Minus, Plus, Trash2, UploadCloud } from 'lucide-react-native';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Banner, Button, EmptyState, IconButton, Surface, Text, VStack } from '../../../components';
import { useTheme } from '../../../theme';
import type { Defect, PlanFile, PlanMarker } from '../../../types/projects';
import { containedImageRect, displayWorkNumberLabel, mediaImageSize } from './helpers';

type PlanSize = { width: number; height: number };
type ImageRect = { x: number; y: number; width: number; height: number };
type MarkerTarget = Defect & { markerLabel: string; markerCount: number };

const clamp = (value: number, minimum: number, maximum: number) => {
  'worklet';
  return Math.min(maximum, Math.max(minimum, value));
};

const markerLabel = (
  marker: PlanMarker,
  markerIndex: number,
  defectById: Map<string, Defect>,
  defectFallbackLabels: Map<string, string>,
) => {
  const override = marker.label_override?.trim();
  if (override) return displayWorkNumberLabel(override);
  const defect = defectById.get(marker.defect_id);
  if (defect?.report_number != null) return String(defect.report_number);
  const localLabel = defect?.local_label?.trim();
  if (localLabel) return displayWorkNumberLabel(localLabel);
  return defectFallbackLabels.get(marker.defect_id) ?? String(markerIndex + 1);
};

const defectKindLabel = (kind: Defect['kind']) => (kind === 'notice' ? 'Hinweis' : 'Mangel');

const defectTargetLabel = (defect: Defect, fallbackIndex: number) => {
  if (defect.report_number != null) return String(defect.report_number);
  const localLabel = defect.local_label?.trim();
  if (localLabel) return displayWorkNumberLabel(localLabel);
  return String(fallbackIndex + 1);
};

const defectSummary = (defect: Defect) => {
  const summary = defect.description.trim().replace(/\s+/g, ' ');
  if (!summary) return 'Ohne Beschreibung';
  return summary.length > 86 ? `${summary.slice(0, 83)}...` : summary;
};

export function PlansTab({
  busy,
  defects,
  onCreateMarker,
  onDeleteMarker,
  onSelectDefect,
  onUploadPlan,
  planImageSizes,
  planLayouts,
  plans,
  selectedDefectId,
  setPlanImageSizes,
  setPlanLayouts,
}: {
  busy: string | null;
  defects: Defect[];
  onCreateMarker: (plan: PlanFile, xNorm?: number, yNorm?: number) => void;
  onDeleteMarker: (markerId: string) => void;
  onSelectDefect: (defectId: string) => void;
  onUploadPlan: () => void;
  planImageSizes: Record<string, PlanSize>;
  planLayouts: Record<string, PlanSize>;
  plans: PlanFile[];
  selectedDefectId: string | null;
  setPlanImageSizes: Dispatch<SetStateAction<Record<string, PlanSize>>>;
  setPlanLayouts: Dispatch<SetStateAction<Record<string, PlanSize>>>;
}) {
  const theme = useTheme();
  const { height, width } = useWindowDimensions();
  const canvasHeight = Math.round(Math.min(Math.max(height * 0.58, 360), width > height ? height - 170 : 720));
  const defectById = useMemo(() => new Map(defects.map((defect) => [defect.id, defect])), [defects]);
  const defectFallbackLabels = useMemo(
    () => new Map(defects.map((defect, index) => [defect.id, String(index + 1)])),
    [defects],
  );
  const markerCountsByDefectId = useMemo(() => {
    const counts = new Map<string, number>();
    plans.forEach((plan) => {
      plan.markers.forEach((marker) => {
        counts.set(marker.defect_id, (counts.get(marker.defect_id) ?? 0) + 1);
      });
    });
    return counts;
  }, [plans]);
  const markerTargets = useMemo<MarkerTarget[]>(
    () =>
      defects.map((defect, index) => ({
        ...defect,
        markerLabel: defectTargetLabel(defect, index),
        markerCount: markerCountsByDefectId.get(defect.id) ?? 0,
      })),
    [defects, markerCountsByDefectId],
  );
  const selectedTarget = markerTargets.find((target) => target.id === selectedDefectId) ?? null;

  return (
    <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[4] }}>
      <Text variant="heading">Pläne und Marker</Text>
      <Text variant="body" tone="secondary">
        Wähle zuerst die Markierung aus, die du platzieren möchtest. Danach setzt jeder Tipp im Plan genau diese Nummer.
      </Text>
      <MarkerTargetSelector
        busy={busy}
        markerTargets={markerTargets}
        onSelectDefect={onSelectDefect}
        selectedTarget={selectedTarget}
      />
      <Button
        label="Plan oder PDF hochladen"
        onPress={onUploadPlan}
        variant="primary"
        size="lg"
        fullWidth
        leftIcon={<UploadCloud color={theme.colors.onPrimary} size={22} />}
        disabled={Boolean(busy)}
      />
      {plans.length === 0 ? (
        <EmptyState
          title="Noch kein Plan"
          message="Lade zuerst einen Plan oder eine PDF hoch, um Marker zu setzen."
          icon={<MapIcon color={theme.colors.primary} size={28} />}
        />
      ) : null}
      <VStack gap="4">
        {plans.map((plan) => (
          <PlanCard
            busy={busy}
            canvasHeight={canvasHeight}
            defectById={defectById}
            defectFallbackLabels={defectFallbackLabels}
            key={plan.id}
            onCreateMarker={onCreateMarker}
            onDeleteMarker={onDeleteMarker}
            onSelectDefect={onSelectDefect}
            plan={plan}
            planImageSizes={planImageSizes}
            planLayouts={planLayouts}
            selectedTarget={selectedTarget}
            setPlanImageSizes={setPlanImageSizes}
            setPlanLayouts={setPlanLayouts}
          />
        ))}
      </VStack>
    </Surface>
  );
}

function MarkerTargetSelector({
  busy,
  markerTargets,
  onSelectDefect,
  selectedTarget,
}: {
  busy: string | null;
  markerTargets: MarkerTarget[];
  onSelectDefect: (defectId: string) => void;
  selectedTarget: MarkerTarget | null;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  if (!markerTargets.length) {
    return (
      <Banner tone="warning" message="Lege zuerst einen Mangel oder Hinweis an, bevor du Marker im Plan setzt." />
    );
  }

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <Text variant="captionStrong" tone="primary" style={{ textTransform: 'uppercase' }}>
        Aktive Markierung
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aktive Markierung auswählen"
        accessibilityState={{ expanded: open, disabled: Boolean(busy) }}
        disabled={Boolean(busy)}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => ({
          minHeight: 64,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: open ? theme.colors.primary : theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.86 : 1,
          padding: theme.spacing[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
        })}
      >
        <View
          style={{
            minWidth: 40,
            height: 40,
            paddingHorizontal: theme.spacing[2],
            borderRadius: 20,
            backgroundColor: selectedTarget ? theme.colors.danger : theme.colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="bodyStrong" style={{ color: selectedTarget ? '#ffffff' : theme.colors.textMuted }}>
            {selectedTarget?.markerLabel ?? '-'}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {selectedTarget
              ? `${defectKindLabel(selectedTarget.kind)} ${selectedTarget.markerLabel}`
              : 'Mangel/Hinweis auswählen'}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {selectedTarget
              ? `${defectSummary(selectedTarget)} · ${selectedTarget.markerCount} Marker gesetzt`
              : `${markerTargets.length} Markierungen verfügbar`}
          </Text>
        </View>
        <ChevronDown color={theme.colors.textMuted} size={22} />
      </Pressable>

      {open ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            overflow: 'hidden',
            backgroundColor: theme.colors.surface,
          }}
        >
          {markerTargets.map((target, index) => {
            const active = target.id === selectedTarget?.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${defectKindLabel(target.kind)} ${target.markerLabel} auswählen`}
                key={target.id}
                onPress={() => {
                  onSelectDefect(target.id);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  minHeight: 58,
                  paddingHorizontal: theme.spacing[3],
                  paddingVertical: theme.spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing[3],
                  backgroundColor: active
                    ? theme.colors.primarySoft
                    : pressed
                      ? theme.colors.surfaceMuted
                      : theme.colors.surface,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.colors.divider,
                })}
              >
                <View
                  style={{
                    minWidth: 34,
                    height: 34,
                    paddingHorizontal: theme.spacing[2],
                    borderRadius: 17,
                    backgroundColor: theme.colors.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="captionStrong" style={{ color: '#ffffff' }}>
                    {target.markerLabel}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {defectKindLabel(target.kind)} {target.markerLabel}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {defectSummary(target)} · {target.markerCount} Marker gesetzt
                  </Text>
                </View>
                {active ? <Check color={theme.colors.primary} size={20} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function PlanCard({
  busy,
  canvasHeight,
  defectById,
  defectFallbackLabels,
  onCreateMarker,
  onDeleteMarker,
  onSelectDefect,
  plan,
  planImageSizes,
  planLayouts,
  selectedTarget,
  setPlanImageSizes,
  setPlanLayouts,
}: {
  busy: string | null;
  canvasHeight: number;
  defectById: Map<string, Defect>;
  defectFallbackLabels: Map<string, string>;
  onCreateMarker: (plan: PlanFile, xNorm?: number, yNorm?: number) => void;
  onDeleteMarker: (markerId: string) => void;
  onSelectDefect: (defectId: string) => void;
  plan: PlanFile;
  planImageSizes: Record<string, PlanSize>;
  planLayouts: Record<string, PlanSize>;
  selectedTarget: MarkerTarget | null;
  setPlanImageSizes: Dispatch<SetStateAction<Record<string, PlanSize>>>;
  setPlanLayouts: Dispatch<SetStateAction<Record<string, PlanSize>>>;
}) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  const layout = planLayouts[plan.id];
  const imageSize = planImageSizes[plan.id] ?? mediaImageSize(plan);
  const imageRect: ImageRect | null = layout && imageSize ? containedImageRect(layout, imageSize) : null;
  const displayMedia = plan.preview_media_asset ?? plan.media_asset;
  const selectedMarker = plan.markers.find((marker) => marker.id === selectedMarkerId) ?? null;
  const selectedMarkerIndex = selectedMarker
    ? plan.markers.findIndex((marker) => marker.id === selectedMarker.id)
    : -1;
  const selectedMarkerDefect = selectedMarker ? defectById.get(selectedMarker.defect_id) : null;
  const markerGroups = useMemo(() => {
    const groups = new Map<string, PlanMarker[]>();
    plan.markers.forEach((marker) => {
      groups.set(marker.defect_id, [...(groups.get(marker.defect_id) ?? []), marker]);
    });
    return Array.from(groups.entries());
  }, [plan.markers]);

  useEffect(() => {
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
  }, [layout?.height, layout?.width, plan.id, scale, translateX, translateY]);

  useEffect(() => {
    if (selectedMarkerId && !plan.markers.some((marker) => marker.id === selectedMarkerId)) {
      setSelectedMarkerId(null);
    }
  }, [plan.markers, selectedMarkerId]);

  useEffect(() => {
    if (!displayMedia?.signed_url || imageSize) {
      return;
    }
    let cancelled = false;
    Image.getSize(
      displayMedia.signed_url,
      (imgW, imgH) => {
        if (!cancelled && imgW && imgH) {
          setPlanImageSizes((current) => ({ ...current, [plan.id]: { width: imgW, height: imgH } }));
        }
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [displayMedia?.signed_url, imageSize, plan.id, setPlanImageSizes]);

  const resetZoom = useCallback(() => {
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
  }, [scale, translateX, translateY]);

  const changeZoom = useCallback(
    (direction: 'in' | 'out') => {
      const nextScale = direction === 'in' ? Math.min(4, scale.value * 1.3) : Math.max(1, scale.value / 1.3);
      scale.value = withTiming(nextScale);
      if (nextScale === 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      }
    },
    [scale, translateX, translateY],
  );

  const handleCanvasTap = useCallback(
    (tapX: number, tapY: number, currentScale: number, currentTranslateX: number, currentTranslateY: number) => {
      if (!imageRect) return;
      const centerX = imageRect.width / 2;
      const centerY = imageRect.height / 2;
      const imageX = (tapX - imageRect.x - currentTranslateX - centerX) / currentScale + centerX;
      const imageY = (tapY - imageRect.y - currentTranslateY - centerY) / currentScale + centerY;
      if (imageX < 0 || imageY < 0 || imageX > imageRect.width || imageY > imageRect.height) return;
      const hitMarker = [...plan.markers].reverse().find((marker) => {
        const markerX = marker.x_norm * imageRect.width;
        const markerY = marker.y_norm * imageRect.height;
        return Math.abs(markerX - imageX) <= 24 && Math.abs(markerY - imageY) <= 24;
      });
      if (hitMarker) {
        setSelectedMarkerId(hitMarker.id);
        return;
      }
      setSelectedMarkerId(null);
      if (!selectedTarget) return;
      onCreateMarker(plan, imageX / imageRect.width, imageY / imageRect.height);
    },
    [imageRect, onCreateMarker, plan, selectedTarget],
  );

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, 1, 4);
    });

  const panGesture = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      const maxX = ((imageRect?.width ?? 1) * scale.value) / 2;
      const maxY = ((imageRect?.height ?? 1) * scale.value) / 2;
      translateX.value = scale.value > 1 ? clamp(savedTranslateX.value + event.translationX, -maxX, maxX) : 0;
      translateY.value = scale.value > 1 ? clamp(savedTranslateY.value + event.translationY, -maxY, maxY) : 0;
    });

  const tapGesture = Gesture.Tap()
    .maxDistance(8)
    .onEnd((event) => {
      runOnJS(handleCanvasTap)(event.x, event.y, scale.value, translateX.value, translateY.value);
    });

  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture, tapGesture);

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Surface variant="muted" padding="4" radius="md" style={{ gap: theme.spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[3] }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{plan.name}</Text>
          <Text variant="caption" tone="muted">
            {plan.file_type.toUpperCase()} – {plan.markers.length} Marker
          </Text>
        </View>
        <Button
          label="Marker mittig"
          onPress={() => onCreateMarker(plan)}
          variant="secondary"
          size="sm"
          disabled={!selectedTarget || Boolean(busy)}
        />
      </View>

      {!selectedTarget ? (
        <Banner tone="info" message="Mangel/Hinweis auswählen, dann im Plan tippen." />
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing[2],
            paddingVertical: theme.spacing[2],
          }}
        >
          <Text variant="caption" tone="muted">
            Wird gesetzt:
          </Text>
          <Text variant="captionStrong">
            {defectKindLabel(selectedTarget.kind)} {selectedTarget.markerLabel}
          </Text>
        </View>
      )}

      {displayMedia?.signed_url ? (
        <>
          <GestureDetector gesture={combinedGesture}>
            <View
              onLayout={(event) => {
                const { width: layoutW, height: layoutH } = event.nativeEvent.layout;
                setPlanLayouts((current) => ({ ...current, [plan.id]: { width: layoutW, height: layoutH } }));
              }}
              style={{
                height: canvasHeight,
                backgroundColor: theme.colors.surfaceSunken,
                borderRadius: theme.radii.md,
                overflow: 'hidden',
              }}
            >
              {imageRect ? (
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      height: imageRect.height,
                      left: imageRect.x,
                      top: imageRect.y,
                      width: imageRect.width,
                    },
                    imageAnimatedStyle,
                  ]}
                >
                  <Image
                    resizeMode="stretch"
                    source={{ uri: displayMedia.signed_url }}
                    style={{ height: '100%', width: '100%' }}
                  />
                  {plan.markers.map((marker, index) => (
                    <View
                      key={marker.id}
                      style={{
                        position: 'absolute',
                        left: marker.x_norm * imageRect.width - 60,
                        top: marker.y_norm * imageRect.height,
                        width: 120,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          minWidth: 28,
                          maxWidth: 120,
                          height: 28,
                          paddingHorizontal: 7,
                          borderRadius: 14,
                          borderWidth: 2,
                          borderColor: marker.id === selectedMarkerId ? theme.colors.warning : '#ffffff',
                          backgroundColor: theme.colors.danger,
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: [{ translateY: -14 }],
                        }}
                      >
                        <Text variant="captionStrong" numberOfLines={1} adjustsFontSizeToFit style={{ color: '#ffffff' }}>
                          {markerLabel(marker, index, defectById, defectFallbackLabels)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Animated.View>
              ) : (
                <Image
                  resizeMode="contain"
                  source={{ uri: displayMedia.signed_url }}
                  style={{ height: '100%', width: '100%' }}
                />
              )}
            </View>
          </GestureDetector>
          {selectedMarker ? (
            <View
              style={{
                gap: theme.spacing[3],
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                padding: theme.spacing[3],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] }}>
                <View
                  style={{
                    minWidth: 40,
                    height: 40,
                    paddingHorizontal: theme.spacing[2],
                    borderRadius: 20,
                    backgroundColor: theme.colors.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="bodyStrong" style={{ color: '#ffffff' }}>
                    {markerLabel(selectedMarker, selectedMarkerIndex, defectById, defectFallbackLabels)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">
                    Marker {markerLabel(selectedMarker, selectedMarkerIndex, defectById, defectFallbackLabels)}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {selectedMarkerDefect
                      ? `${defectKindLabel(selectedMarkerDefect.kind)} · ${defectSummary(selectedMarkerDefect)}`
                      : 'Unbekannter Eintrag'}
                  </Text>
                  <Text variant="caption" tone="muted">
                    X {Math.round(selectedMarker.x_norm * 100)}% · Y {Math.round(selectedMarker.y_norm * 100)}%
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
                <Button
                  label="Diesen Eintrag auswählen"
                  onPress={() => onSelectDefect(selectedMarker.defect_id)}
                  variant="secondary"
                  size="sm"
                  disabled={!defectById.has(selectedMarker.defect_id) || Boolean(busy)}
                />
                <Button
                  label="Marker löschen"
                  onPress={() => onDeleteMarker(selectedMarker.id)}
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 color={theme.colors.danger} size={18} />}
                  disabled={Boolean(busy)}
                />
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
            <IconButton
              accessibilityLabel="Verkleinern"
              icon={<Minus color={theme.colors.text} size={22} />}
              onPress={() => changeZoom('out')}
              variant="soft"
              size={56}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom zurücksetzen"
              onPress={resetZoom}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 56,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surfaceMuted,
                opacity: pressed ? 0.85 : 1,
                flexDirection: 'row',
                gap: theme.spacing[2],
              })}
            >
              <Maximize2 color={theme.colors.text} size={20} />
              <Text variant="bodyStrong">Zurücksetzen</Text>
            </Pressable>
            <IconButton
              accessibilityLabel="Vergrößern"
              icon={<Plus color={theme.colors.text} size={22} />}
              onPress={() => changeZoom('in')}
              variant="soft"
              size={56}
            />
          </View>
        </>
      ) : (
        <Surface variant="card" padding="4" bordered style={{ minHeight: 120, justifyContent: 'center' }}>
          <Text variant="body" tone="muted" align="center">
            Plan ist gespeichert. Markerbearbeitung ist möglich, sobald die Vorschau geladen ist.
          </Text>
        </Surface>
      )}

      {plan.markers.length ? (
        <VStack gap="2">
          {markerGroups.map(([defectId, markers]) => {
            const defect = defectById.get(defectId);
            const firstMarker = markers[0];
            const firstMarkerIndex = firstMarker ? plan.markers.findIndex((marker) => marker.id === firstMarker.id) : -1;
            const groupLabel = firstMarker
              ? markerLabel(firstMarker, firstMarkerIndex, defectById, defectFallbackLabels)
              : 'Unbekannt';
            return (
              <View
                key={defectId}
                style={{
                  gap: theme.spacing[2],
                  paddingTop: theme.spacing[3],
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.divider,
                }}
              >
                <Text variant="captionStrong">
                  {defect ? `${defectKindLabel(defect.kind)} ${groupLabel}` : `Unbekannter Eintrag ${groupLabel}`} · {markers.length} Marker
                </Text>
                {markers.map((marker) => {
                  const markerIndex = plan.markers.findIndex((item) => item.id === marker.id);
                  return (
                    <View
                      key={marker.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: theme.spacing[2],
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Marker ${markerLabel(marker, markerIndex, defectById, defectFallbackLabels)} Details anzeigen`}
                        onPress={() => setSelectedMarkerId(marker.id)}
                        style={({ pressed }) => ({
                          flex: 1,
                          minHeight: 44,
                          justifyContent: 'center',
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        <Text variant="caption" tone="secondary">
                          Marker {markerLabel(marker, markerIndex, defectById, defectFallbackLabels)}: {Math.round(marker.x_norm * 100)}% / {Math.round(marker.y_norm * 100)}%
                        </Text>
                      </Pressable>
                      <Button
                        label="Löschen"
                        onPress={() => onDeleteMarker(marker.id)}
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 color={theme.colors.danger} size={18} />}
                      />
                    </View>
                  );
                })}
              </View>
            );
          })}
        </VStack>
      ) : null}
    </Surface>
  );
}
