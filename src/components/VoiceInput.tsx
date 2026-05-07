import type { useAudioRecorderState } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Mic, Square, Trash2 } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import type { UploadableAsset } from '../lib/uploadProjectFile';
import { Banner } from './Banner';
import { Text } from './Text';

const formatDuration = (seconds?: number | null): string => {
  if (!seconds || seconds < 0) {
    return '0:00';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

export function VoiceInput({
  busy,
  recordedAsset,
  recorderState,
  permissionGranted,
  onRequestPermission,
  onStart,
  onStop,
  onDiscard,
  hint,
}: {
  busy: string | null;
  recordedAsset: UploadableAsset | null;
  recorderState: ReturnType<typeof useAudioRecorderState>;
  permissionGranted: boolean | null;
  onRequestPermission: () => void;
  onStart: () => void;
  onStop: () => void;
  onDiscard: () => void;
  hint?: string;
}) {
  const theme = useTheme();
  const isRecording = recorderState.isRecording;
  const liveSeconds = Math.round(recorderState.durationMillis / 1000);
  const ready = !isRecording && Boolean(recordedAsset);
  const disabled = Boolean(busy);

  if (permissionGranted === false) {
    return (
      <Banner
        tone="warning"
        title="Mikrofon nicht erlaubt"
        message="Bitte Mikrofon-Zugriff in den Einstellungen erlauben, um Audio aufzunehmen."
        actionLabel="Erlauben"
        onAction={onRequestPermission}
      />
    );
  }

  const containerColor = isRecording
    ? theme.colors.dangerSoft
    : ready
      ? theme.colors.successSoft
      : theme.colors.surfaceMuted;
  const borderColor = isRecording
    ? theme.colors.danger
    : ready
      ? theme.colors.success
      : theme.colors.border;

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          minHeight: theme.layout.touchTargetMin,
          paddingHorizontal: theme.spacing[3],
          paddingVertical: theme.spacing[2],
          backgroundColor: containerColor,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor,
        }}
      >
        {isRecording ? (
          <>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: theme.colors.danger,
              }}
              accessibilityLabel="Aufnahme läuft"
            />
            <Text variant="bodyStrong" tone="danger" style={{ flex: 1 }}>
              Aufnahme – {formatDuration(liveSeconds)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Aufnahme stoppen"
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onStop();
              }}
              disabled={disabled}
              style={({ pressed }) => ({
                minHeight: 44,
                minWidth: 44,
                paddingHorizontal: theme.spacing[3],
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.danger,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: theme.spacing[1],
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Square color={theme.colors.alwaysWhite} size={18} fill={theme.colors.alwaysWhite} />
              <Text variant="captionStrong" style={{ color: theme.colors.alwaysWhite }}>
                Stop
              </Text>
            </Pressable>
          </>
        ) : ready ? (
          <>
            <Mic color={theme.colors.success} size={20} />
            <Text variant="bodyStrong" tone="success" style={{ flex: 1 }}>
              Audio bereit – {formatDuration(recordedAsset?.duration_seconds)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Aufnahme verwerfen"
              onPress={() => {
                void Haptics.selectionAsync();
                onDiscard();
              }}
              disabled={disabled}
              style={({ pressed }) => ({
                minHeight: 44,
                minWidth: 44,
                paddingHorizontal: theme.spacing[3],
                borderRadius: theme.radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: theme.spacing[1],
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Trash2 color={theme.colors.danger} size={18} />
              <Text variant="captionStrong" tone="danger">
                Verwerfen
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aufnahme starten"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (permissionGranted !== true) {
                onRequestPermission();
                return;
              }
              onStart();
            }}
            disabled={disabled}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing[2],
              minHeight: 44,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Mic color={theme.colors.primary} size={22} />
            <Text variant="bodyStrong" tone="primary">
              Aufnahme starten
            </Text>
          </Pressable>
        )}
      </View>
      {hint && !isRecording ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
      {ready ? (
        <Text variant="caption" tone="muted">
          Transkript wird beim Speichern automatisch erstellt.
        </Text>
      ) : null}
    </View>
  );
}
