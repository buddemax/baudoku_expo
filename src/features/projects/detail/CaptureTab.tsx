import type { useAudioRecorderState } from 'expo-audio';
import { Camera, Image as ImageIcon, Plus, Save, Trash2 } from 'lucide-react-native';
import type { Dispatch, SetStateAction } from 'react';
import { Image, useWindowDimensions, View } from 'react-native';

import {
  Badge,
  Banner,
  Button,
  ChoiceChips,
  Input,
  SegmentedControl,
  Surface,
  Text,
  VoiceInput,
  VStack,
} from '../../../components';
import { useTheme } from '../../../theme';
import type { Defect, PlanFile, Trade } from '../../../types/projects';
import type { CaptureEntryDraft } from './types';
import { PlansTab } from './PlansTab';

type PlanSize = { width: number; height: number };

type CaptureTabProps = {
  activeVoiceDraftId: string | null;
  audioPermissionGranted: boolean | null;
  busy: string | null;
  captureDrafts: CaptureEntryDraft[];
  defects: Defect[];
  markerQueueIds: string[];
  onAddDraft: () => void;
  onAddPhoto: (draftId: string, mode: 'camera' | 'library') => void;
  onChangeDraft: (draftId: string, updater: (draft: CaptureEntryDraft) => CaptureEntryDraft) => void;
  onChangePhotoCaption: (draftId: string, clientId: string, caption: string) => void;
  onCreateMarker: (plan: PlanFile, xNorm?: number, yNorm?: number) => void;
  onDeleteMarker: (markerId: string) => void;
  onDiscardVoice: (draftId: string) => void;
  onRemoveDraft: (draftId: string) => void;
  onRemovePhoto: (draftId: string, clientId: string) => void;
  onRequestMicrophonePermission: () => void;
  onSaveDrafts: () => void;
  onSelectDefect: (defectId: string) => void;
  onStartVoice: (draftId: string) => void;
  onStopVoice: (draftId: string) => void;
  onUploadPlan: () => void;
  planImageSizes: Record<string, PlanSize>;
  planLayouts: Record<string, PlanSize>;
  plans: PlanFile[];
  recorderState: ReturnType<typeof useAudioRecorderState>;
  selectedDefectId: string | null;
  setPlanImageSizes: Dispatch<SetStateAction<Record<string, PlanSize>>>;
  setPlanLayouts: Dispatch<SetStateAction<Record<string, PlanSize>>>;
  trades: Trade[];
};

const photoStatusLabel = (status: CaptureEntryDraft['photoDrafts'][number]['status']) => {
  if (status === 'uploaded') return 'hochgeladen';
  if (status === 'waiting') return 'wartet';
  if (status === 'error') return 'Fehler';
  return 'gesichert';
};

export function CaptureTab({
  activeVoiceDraftId,
  audioPermissionGranted,
  busy,
  captureDrafts,
  defects,
  markerQueueIds,
  onAddDraft,
  onAddPhoto,
  onChangeDraft,
  onChangePhotoCaption,
  onCreateMarker,
  onDeleteMarker,
  onDiscardVoice,
  onRemoveDraft,
  onRemovePhoto,
  onRequestMicrophonePermission,
  onSaveDrafts,
  onSelectDefect,
  onStartVoice,
  onStopVoice,
  onUploadPlan,
  planImageSizes,
  planLayouts,
  plans,
  recorderState,
  selectedDefectId,
  setPlanImageSizes,
  setPlanLayouts,
  trades,
}: CaptureTabProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const sideBySide = width >= 980;
  const saveableCount = captureDrafts.filter(
    (draft) => draft.form.local_label.trim() && (draft.form.description.trim() || draft.voiceAsset),
  ).length;

  return (
    <View
      style={{
        flexDirection: sideBySide ? 'row' : 'column',
        alignItems: 'flex-start',
        gap: theme.spacing[4],
      }}
    >
      <View style={{ width: sideBySide ? '47%' : '100%', minWidth: 0 }}>
        <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[4] }}>
          <View style={{ gap: theme.spacing[1] }}>
            <Text variant="heading">Erfassen</Text>
            <Text variant="body" tone="secondary">
              Mehrere Mängel oder Hinweise untereinander anlegen und danach direkt im Plan markieren.
            </Text>
          </View>

          {markerQueueIds.length ? (
            <Banner
              tone="info"
              title="Marker setzen"
              message={`${markerQueueIds.length} gespeicherte Einträge warten auf eine Position im Plan.`}
            />
          ) : null}

          <VStack gap="4">
            {captureDrafts.map((draft, index) => (
              <CaptureDraftCard
                activeVoiceDraftId={activeVoiceDraftId}
                audioPermissionGranted={audioPermissionGranted}
                busy={busy}
                draft={draft}
                draftCount={captureDrafts.length}
                index={index}
                key={draft.clientId}
                onAddPhoto={onAddPhoto}
                onChangeDraft={onChangeDraft}
                onChangePhotoCaption={onChangePhotoCaption}
                onDiscardVoice={onDiscardVoice}
                onRemoveDraft={onRemoveDraft}
                onRemovePhoto={onRemovePhoto}
                onRequestMicrophonePermission={onRequestMicrophonePermission}
                onStartVoice={onStartVoice}
                onStopVoice={onStopVoice}
                recorderState={recorderState}
                trades={trades}
              />
            ))}
          </VStack>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
            <Button
              label="Weitere Zeile"
              onPress={onAddDraft}
              variant="secondary"
              size="md"
              leftIcon={<Plus color={theme.colors.text} size={20} />}
              disabled={Boolean(busy)}
            />
            <Button
              label={saveableCount > 1 ? `${saveableCount} Einträge speichern` : 'Eintrag speichern'}
              onPress={onSaveDrafts}
              variant="primary"
              size="md"
              leftIcon={<Save color={theme.colors.onPrimary} size={20} />}
              disabled={!saveableCount || Boolean(busy)}
              loading={busy === 'defect'}
            />
          </View>
        </Surface>
      </View>

      <View style={{ width: sideBySide ? '53%' : '100%', minWidth: 0 }}>
        <PlansTab
          busy={busy}
          defects={defects}
          onCreateMarker={onCreateMarker}
          onDeleteMarker={onDeleteMarker}
          onSelectDefect={onSelectDefect}
          onUploadPlan={onUploadPlan}
          planImageSizes={planImageSizes}
          planLayouts={planLayouts}
          plans={plans}
          selectedDefectId={selectedDefectId}
          setPlanImageSizes={setPlanImageSizes}
          setPlanLayouts={setPlanLayouts}
        />
      </View>
    </View>
  );
}

function CaptureDraftCard({
  activeVoiceDraftId,
  audioPermissionGranted,
  busy,
  draft,
  draftCount,
  index,
  onAddPhoto,
  onChangeDraft,
  onChangePhotoCaption,
  onDiscardVoice,
  onRemoveDraft,
  onRemovePhoto,
  onRequestMicrophonePermission,
  onStartVoice,
  onStopVoice,
  recorderState,
  trades,
}: {
  activeVoiceDraftId: string | null;
  audioPermissionGranted: boolean | null;
  busy: string | null;
  draft: CaptureEntryDraft;
  draftCount: number;
  index: number;
  onAddPhoto: (draftId: string, mode: 'camera' | 'library') => void;
  onChangeDraft: (draftId: string, updater: (draft: CaptureEntryDraft) => CaptureEntryDraft) => void;
  onChangePhotoCaption: (draftId: string, clientId: string, caption: string) => void;
  onDiscardVoice: (draftId: string) => void;
  onRemoveDraft: (draftId: string) => void;
  onRemovePhoto: (draftId: string, clientId: string) => void;
  onRequestMicrophonePermission: () => void;
  onStartVoice: (draftId: string) => void;
  onStopVoice: (draftId: string) => void;
  recorderState: ReturnType<typeof useAudioRecorderState>;
  trades: Trade[];
}) {
  const theme = useTheme();
  const activeRecording = activeVoiceDraftId === draft.clientId;
  const rowRecorderState = activeRecording
    ? recorderState
    : { ...recorderState, isRecording: false, durationMillis: 0 };
  const statusTone =
    draft.status === 'error'
      ? 'danger'
      : draft.status === 'saved'
        ? 'success'
        : draft.status === 'saving'
          ? 'warning'
          : 'neutral';
  const statusLabel =
    draft.status === 'error'
      ? 'Fehler'
      : draft.status === 'saved'
        ? 'gespeichert'
        : draft.status === 'saving'
          ? 'speichert'
          : 'Entwurf';

  return (
    <Surface variant="muted" padding="4" radius="md" style={{ gap: theme.spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">Erfassung {index + 1}</Text>
          <Text variant="caption" tone="muted">
            Arbeitsnummer {draft.form.local_label || '-'}
          </Text>
        </View>
        <Badge label={statusLabel} tone={statusTone} />
        {draftCount > 1 ? (
          <Button
            label="Entfernen"
            onPress={() => onRemoveDraft(draft.clientId)}
            variant="ghost"
            size="sm"
            leftIcon={<Trash2 color={theme.colors.danger} size={18} />}
            disabled={Boolean(busy)}
          />
        ) : null}
      </View>

      {draft.error ? <Banner tone="error" message={draft.error} /> : null}

      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Art</Text>
        <SegmentedControl<CaptureEntryDraft['form']['kind']>
          value={draft.form.kind}
          options={[
            { value: 'defect', label: 'Mangel' },
            { value: 'notice', label: 'Hinweis' },
          ]}
          onChange={(value) =>
            onChangeDraft(draft.clientId, (current) => ({
              ...current,
              form: { ...current.form, kind: value },
              status: 'draft',
              error: null,
            }))
          }
        />
      </View>

      <Input
        label="Beschreibung"
        helpText="Was wurde vor Ort festgestellt?"
        multiline
        minHeight={104}
        onChangeText={(value) =>
          onChangeDraft(draft.clientId, (current) => ({
            ...current,
            form: { ...current.form, description: value },
            status: 'draft',
            error: null,
          }))
        }
        placeholder="Kurze, klare Beschreibung"
        value={draft.form.description}
      />

      <Input
        label="Arbeitsnummer"
        helpText="Wird vorgeschlagen und kann angepasst werden."
        onChangeText={(value) =>
          onChangeDraft(draft.clientId, (current) => ({
            ...current,
            form: { ...current.form, local_label: value },
            status: 'draft',
            error: null,
          }))
        }
        placeholder="z.B. 1, 001 oder Ticketnummer 001"
        value={draft.form.local_label}
      />

      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Gewerk</Text>
        <ChoiceChips<string>
          value={draft.form.trade_id ?? '__free'}
          options={[{ value: '__free', label: 'Freitext' }, ...trades.map((trade) => ({ value: trade.id, label: trade.name }))]}
          onChange={(value) =>
            onChangeDraft(draft.clientId, (current) => {
              if (value === '__free') {
                return { ...current, form: { ...current.form, trade_id: null }, status: 'draft', error: null };
              }
              const trade = trades.find((entry) => entry.id === value);
              return {
                ...current,
                form: {
                  ...current.form,
                  trade_id: value,
                  trade_name_snapshot: trade?.name ?? current.form.trade_name_snapshot,
                },
                status: 'draft',
                error: null,
              };
            })
          }
        />
        <Input
          editable={!draft.form.trade_id}
          onChangeText={(value) =>
            onChangeDraft(draft.clientId, (current) => ({
              ...current,
              form: { ...current.form, trade_name_snapshot: value },
              status: 'draft',
              error: null,
            }))
          }
          placeholder={draft.form.trade_id ? 'Gewerk aus Liste gewählt' : 'z.B. Dach, Fenster, Beton'}
          value={draft.form.trade_name_snapshot}
        />
      </View>

      <Input
        label="Kategorie (optional)"
        onChangeText={(value) =>
          onChangeDraft(draft.clientId, (current) => ({
            ...current,
            form: { ...current.form, category: value },
            status: 'draft',
            error: null,
          }))
        }
        placeholder="z.B. Abdichtung, Sicherheit"
        value={draft.form.category}
      />

      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Fotos</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
          <Button
            label="Foto aufnehmen"
            onPress={() => onAddPhoto(draft.clientId, 'camera')}
            variant="primary"
            size="sm"
            leftIcon={<Camera color={theme.colors.onPrimary} size={18} />}
            loading={busy === 'defect-photo'}
            disabled={Boolean(busy)}
          />
          <Button
            label="Galerie"
            onPress={() => onAddPhoto(draft.clientId, 'library')}
            variant="secondary"
            size="sm"
            leftIcon={<ImageIcon color={theme.colors.text} size={18} />}
            disabled={Boolean(busy)}
          />
        </View>
        {draft.photoDrafts.length ? (
          <VStack gap="2">
            {draft.photoDrafts.map((item) => (
              <Surface
                key={item.client_id}
                variant="card"
                padding="3"
                radius="md"
                style={{ flexDirection: 'row', gap: theme.spacing[3] }}
              >
                <Image
                  source={{ uri: item.local_uri }}
                  style={{
                    height: 84,
                    width: 84,
                    borderRadius: theme.radii.sm,
                    backgroundColor: theme.colors.surfaceSunken,
                  }}
                />
                <View style={{ flex: 1, gap: theme.spacing[2], minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                    <Text variant="captionStrong" numberOfLines={1} style={{ flex: 1 }}>
                      {item.file_name || 'Foto'}
                    </Text>
                    <Badge label={photoStatusLabel(item.status)} tone={item.status === 'error' ? 'danger' : 'neutral'} />
                  </View>
                  <Input
                    multiline
                    minHeight={64}
                    onChangeText={(value) => onChangePhotoCaption(draft.clientId, item.client_id, value)}
                    placeholder="Bildunterschrift"
                    value={item.caption ?? ''}
                  />
                  <Button
                    label="Foto entfernen"
                    onPress={() => onRemovePhoto(draft.clientId, item.client_id)}
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 color={theme.colors.danger} size={18} />}
                    disabled={Boolean(busy)}
                  />
                </View>
              </Surface>
            ))}
          </VStack>
        ) : null}
      </View>

      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Audio</Text>
        <VoiceInput
          busy={busy}
          recordedAsset={draft.voiceAsset}
          recorderState={rowRecorderState}
          permissionGranted={audioPermissionGranted}
          onRequestPermission={onRequestMicrophonePermission}
          onStart={() => onStartVoice(draft.clientId)}
          onStop={() => onStopVoice(draft.clientId)}
          onDiscard={() => onDiscardVoice(draft.clientId)}
          hint="Transkript wird beim Speichern automatisch ergänzt."
        />
        <Input
          label="Manueller Audiotext (optional)"
          helpText="Wird zusammen mit der Aufnahme am Eintrag gespeichert."
          multiline
          minHeight={76}
          onChangeText={(value) =>
            onChangeDraft(draft.clientId, (current) => ({
              ...current,
              voiceTranscript: value,
              status: 'draft',
              error: null,
            }))
          }
          placeholder="Falls du das Transkript direkt eintippen möchtest"
          value={draft.voiceTranscript}
        />
      </View>
    </Surface>
  );
}
