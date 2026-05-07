import type { useAudioRecorderState } from 'expo-audio';
import { Camera, Image as ImageIcon, ImagePlus, Mic, MoveDown, MoveUp, RefreshCcw, Save, ShieldCheck, Square, Trash2, Wand2 } from 'lucide-react-native';
import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Image, ScrollView, View } from 'react-native';

import {
  Badge,
  Banner,
  Button,
  Card,
  ChoiceChips,
  HStack,
  Input,
  MetricTile,
  SegmentedControl,
  Surface,
  Text,
  VStack,
} from '../../../components';
import type { OutboxItem, PendingMediaItem } from '../../../lib/offlineStore';
import type { UploadableAsset } from '../../../lib/uploadProjectFile';
import { formatDateTime } from '../../../lib/formatters';
import { useTheme } from '../../../theme';
import type { Defect, MediaAsset, Trade, VoiceNote } from '../../../types/projects';
import { draftStatusLabel, formatDuration, voiceTargetLabel } from './helpers';
import { workspaceTabs, type DefectFormState, type WorkspaceTab } from './types';

export function WorkspaceTabs({
  activeTab,
  onChange,
}: {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -theme.spacing[2] }}>
      <HStack gap="2" padding="2">
        <SegmentedControl<WorkspaceTab>
          value={activeTab}
          options={workspaceTabs.map((tab) => ({ value: tab.key, label: tab.label }))}
          onChange={onChange}
          style={{ minWidth: 540 }}
        />
      </HStack>
    </ScrollView>
  );
}

export function MetricCard({ label, value, tone }: { label: string; value: string; tone?: 'default' | 'primary' }) {
  return <MetricTile label={label} value={value} tone={tone} />;
}

export function VoiceCapturePanel({
  busy,
  contextLabel,
  saveLabel = 'Sprachnotiz am Eintrag speichern',
  showSave = true,
  title = 'Sprachaufnahme',
  embedded = false,
  onDiscard,
  onRequestPermission,
  onSave,
  onStart,
  onStop,
  onTranscriptChange,
  permissionGranted,
  recordedAsset,
  recorderState,
  transcript,
}: {
  busy: string | null;
  contextLabel?: string;
  saveLabel?: string;
  showSave?: boolean;
  title?: string;
  embedded?: boolean;
  onDiscard: () => void;
  onRequestPermission: () => void;
  onSave?: () => void;
  onStart: () => void;
  onStop: () => void;
  onTranscriptChange: (value: string) => void;
  permissionGranted: boolean | null;
  recordedAsset: UploadableAsset | null;
  recorderState: ReturnType<typeof useAudioRecorderState>;
  transcript: string;
}) {
  const theme = useTheme();
  const isRecording = recorderState.isRecording;
  const durationSeconds = recordedAsset?.duration_seconds ?? Math.round(recorderState.durationMillis / 1000);
  const permissionLabel =
    permissionGranted === true ? 'Mikrofon erlaubt' : permissionGranted === false ? 'Mikrofon erlauben' : 'Berechtigung prüfen';
  const statusText = isRecording
    ? `Aufnahme läuft – ${formatDuration(durationSeconds)}`
    : recordedAsset
      ? `Aufnahme bereit – ${formatDuration(recordedAsset.duration_seconds)}`
      : permissionGranted
        ? 'Bereit zum Aufnehmen'
        : 'Mikrofon nicht erlaubt';

  const Wrapper = embedded ? View : Surface;
  const wrapperProps = embedded
    ? { style: { gap: theme.spacing[3] } }
    : ({ variant: 'card' as const, padding: '5' as const, elevated: true, bordered: true, style: { gap: theme.spacing[3] } });

  return (
    <Wrapper {...wrapperProps}>
      <Text variant="heading">{title}</Text>
      {contextLabel ? (
        <Text variant="caption" tone="muted">
          {contextLabel}
        </Text>
      ) : null}

      <Surface variant="muted" padding="3" radius="sm">
        <Text variant="caption" tone="muted">
          Status
        </Text>
        <Text variant="bodyStrong" tone={isRecording ? 'danger' : 'default'}>
          {statusText}
        </Text>
      </Surface>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
        {permissionGranted !== true ? (
          <Button label={permissionLabel} onPress={onRequestPermission} variant="secondary" size="md" disabled={Boolean(busy)} />
        ) : null}
        {!isRecording ? (
          <Button
            label="Aufnahme starten"
            onPress={onStart}
            variant="primary"
            size="md"
            leftIcon={<Mic color={theme.colors.onPrimary} size={20} />}
            disabled={Boolean(busy) || permissionGranted !== true}
          />
        ) : (
          <Button
            label="Stopp"
            onPress={onStop}
            variant="danger"
            size="md"
            leftIcon={<Square color={theme.colors.danger} size={20} />}
            disabled={Boolean(busy)}
          />
        )}
        {(recordedAsset || isRecording) ? (
          <Button
            label="Verwerfen"
            onPress={onDiscard}
            variant="ghost"
            size="md"
            disabled={Boolean(busy)}
            leftIcon={<Trash2 color={theme.colors.danger} size={20} />}
          />
        ) : null}
      </View>

      <Input
        label="Manueller Text (optional)"
        helpText="Ohne Text wird die Aufnahme online automatisch transkribiert."
        multiline
        minHeight={96}
        onChangeText={onTranscriptChange}
        placeholder="Optionaler manueller Text"
        value={transcript}
      />

      {showSave ? (
        <Button
          label={saveLabel}
          onPress={onSave ?? (() => undefined)}
          variant="primary"
          size="lg"
          fullWidth
          disabled={Boolean(busy) || isRecording || !recordedAsset || !onSave}
          loading={busy === 'voice-save'}
          leftIcon={<Save color={theme.colors.onPrimary} size={20} />}
        />
      ) : null}
    </Wrapper>
  );
}

export function DefectFormPanel({
  busy,
  form,
  onChange,
  onAddPhoto,
  onChangePhotoCaption,
  onRemovePhoto,
  onSubmit,
  photoDrafts,
  trades,
  voicePanel,
  voiceDraftAttached,
}: {
  busy: string | null;
  form: DefectFormState;
  onChange: Dispatch<SetStateAction<DefectFormState>>;
  onAddPhoto: (mode: 'camera' | 'library') => void;
  onChangePhotoCaption: (clientId: string, caption: string) => void;
  onRemovePhoto: (clientId: string) => void;
  onSubmit: () => void;
  photoDrafts: PendingMediaItem[];
  trades: Trade[];
  voicePanel?: ReactNode;
  voiceDraftAttached?: boolean;
}) {
  const theme = useTheme();

  const photoStatusLabel = (item: PendingMediaItem) => {
    if (item.status === 'uploaded') return 'hochgeladen';
    if (item.status === 'waiting') return 'noch offen';
    if (item.status === 'error') return 'Fehler';
    return 'vorgemerkt';
  };

  const submitLabel =
    voiceDraftAttached && photoDrafts.length
      ? 'Eintrag mit Fotos und Ton speichern'
      : voiceDraftAttached
        ? 'Eintrag mit Sprachnotiz speichern'
        : photoDrafts.length
          ? 'Eintrag mit Fotos speichern'
          : 'Eintrag speichern';

  return (
    <VStack gap="4">
      <FormSection number={1} title="Was ist passiert?" subtitle="Beschreibung per Sprache oder Text">
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Art</Text>
          <SegmentedControl<DefectFormState['kind']>
            value={form.kind}
            options={[
              { value: 'defect', label: 'Mangel' },
              { value: 'notice', label: 'Hinweis' },
            ]}
            onChange={(value) => onChange((current) => ({ ...current, kind: value }))}
          />
        </View>

        {voicePanel ? (
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Beschreibung per Sprache</Text>
            {voicePanel}
          </View>
        ) : null}

        <Input
          label={voicePanel ? 'Oder schriftlich' : 'Beschreibung'}
          helpText="Was wurde vor Ort festgestellt?"
          multiline
          minHeight={120}
          onChangeText={(value) => onChange((current) => ({ ...current, description: value }))}
          placeholder="Kurze, klare Beschreibung"
          value={form.description}
        />

        <Input
          label="Arbeitsnummer"
          helpText="Wird automatisch vorgeschlagen und kann angepasst werden."
          onChangeText={(value) => onChange((current) => ({ ...current, local_label: value }))}
          placeholder="z.B. 1, 001 oder Ticketnummer 001"
          value={form.local_label}
        />
      </FormSection>

      <FormSection number={2} title="Wo gehört es hin?" subtitle="Gewerk und Kategorie">
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Gewerk</Text>
          <ChoiceChips<string>
            value={form.trade_id ?? '__free'}
            options={[{ value: '__free', label: 'Freitext' }, ...trades.map((trade) => ({ value: trade.id, label: trade.name }))]}
            onChange={(value) =>
              onChange((current) => {
                if (value === '__free') {
                  return { ...current, trade_id: null };
                }
                const trade = trades.find((entry) => entry.id === value);
                return { ...current, trade_id: value, trade_name_snapshot: trade?.name ?? current.trade_name_snapshot };
              })
            }
          />
          <Input
            editable={!form.trade_id}
            onChangeText={(value) => onChange((current) => ({ ...current, trade_name_snapshot: value }))}
            placeholder={form.trade_id ? 'Gewerk aus Liste gewählt' : 'z.B. Dach, Fenster, Beton'}
            value={form.trade_name_snapshot}
          />
        </View>

        <Input
          label="Kategorie (optional)"
          onChangeText={(value) => onChange((current) => ({ ...current, category: value }))}
          placeholder="z.B. Abdichtung, Sicherheit"
          value={form.category}
        />
      </FormSection>

      <FormSection number={3} title="Fotos" subtitle="Belege für diesen Eintrag">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
          <Button
            label="Foto aufnehmen"
            onPress={() => onAddPhoto('camera')}
            variant="primary"
            size="md"
            leftIcon={<Camera color={theme.colors.onPrimary} size={20} />}
            loading={busy === 'defect-photo'}
            disabled={Boolean(busy)}
          />
          <Button
            label="Aus Galerie"
            onPress={() => onAddPhoto('library')}
            variant="secondary"
            size="md"
            leftIcon={<ImageIcon color={theme.colors.text} size={20} />}
            disabled={Boolean(busy)}
          />
        </View>

        {photoDrafts.length ? (
          <VStack gap="3">
            {photoDrafts.map((item) => (
              <Surface key={item.client_id} variant="muted" padding="3" radius="md" style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                <Image
                  source={{ uri: item.local_uri }}
                  style={{ height: 88, width: 88, borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceSunken }}
                />
                <View style={{ flex: 1, gap: theme.spacing[2] }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {item.file_name || 'Foto'}
                    </Text>
                    <Badge label={photoStatusLabel(item)} tone={item.status === 'error' ? 'danger' : 'neutral'} />
                  </View>
                  <Input
                    multiline
                    minHeight={70}
                    onChangeText={(value) => onChangePhotoCaption(item.client_id, value)}
                    placeholder="Bildunterschrift"
                    value={item.caption ?? ''}
                  />
                  {item.error ? <Text variant="caption" tone="danger">{item.error}</Text> : null}
                  <Button
                    label="Foto entfernen"
                    onPress={() => onRemovePhoto(item.client_id)}
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
      </FormSection>

      <Surface variant="card" padding="4" elevated bordered>
        <Button
          label={submitLabel}
          onPress={onSubmit}
          variant="primary"
          size="lg"
          fullWidth
          loading={busy === 'defect'}
          disabled={!form.local_label.trim() || (!form.description.trim() && !voiceDraftAttached) || Boolean(busy)}
          leftIcon={<Save color={theme.colors.onPrimary} size={22} />}
        />
      </Surface>
    </VStack>
  );
}

function FormSection({
  number,
  title,
  subtitle,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="bodyStrong" tone="primary">
            {number}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{title}</Text>
          {subtitle ? (
            <Text variant="caption" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
      {children}
    </Surface>
  );
}

export function VoiceNoteCard({
  busy,
  draft,
  onConfirm,
  onDelete,
  onDraftChange,
  onSave,
  onTranscribe,
  voiceNote,
}: {
  busy: string | null;
  draft: string;
  onConfirm: () => void;
  onDelete: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onTranscribe: () => void;
  voiceNote: VoiceNote;
}) {
  const theme = useTheme();
  const transcribing = busy === `voice-ai-${voiceNote.id}`;
  const updating = busy === `voice-update-${voiceNote.id}`;
  const deleting = busy === `voice-delete-${voiceNote.id}`;
  const hasDraft = draft.trim().length > 0;

  const statusTone = voiceNote.transcript_status === 'error' ? 'danger' : voiceNote.transcript_status === 'confirmed' ? 'success' : 'neutral';

  return (
    <Surface variant="muted" padding="4" radius="md" style={{ gap: theme.spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="bodyStrong">{voiceTargetLabel(voiceNote.target_type)}</Text>
        <Badge label={draftStatusLabel(voiceNote.transcript_status)} tone={statusTone} />
      </View>
      <Text variant="caption" tone="muted">
        {formatDateTime(voiceNote.created_at)}
        {voiceNote.media_asset?.duration_seconds ? ` – ${formatDuration(voiceNote.media_asset.duration_seconds)}` : ''}
      </Text>
      {voiceNote.transcript_status === 'error' && voiceNote.error_message ? (
        <Banner tone="error" message={voiceNote.error_message} title="Transkription fehlgeschlagen" />
      ) : null}
      <Input
        multiline
        minHeight={80}
        onChangeText={onDraftChange}
        placeholder="Transkript bearbeiten"
        value={draft}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
        <Button
          label={voiceNote.transcript_status === 'error' ? 'Erneut versuchen' : 'KI-Transkript'}
          onPress={onTranscribe}
          variant="secondary"
          size="sm"
          leftIcon={<Wand2 color={theme.colors.text} size={18} />}
          loading={transcribing}
          disabled={Boolean(busy)}
        />
        <Button
          label="Text speichern"
          onPress={onSave}
          variant="ghost"
          size="sm"
          disabled={Boolean(busy) || !hasDraft}
        />
        <Button
          label="Bestätigen"
          onPress={onConfirm}
          variant="primary"
          size="sm"
          loading={updating || transcribing}
          disabled={Boolean(busy) || !hasDraft}
          leftIcon={<ShieldCheck color={theme.colors.onPrimary} size={18} />}
        />
        <Button
          label="Löschen"
          onPress={onDelete}
          variant="ghost"
          size="sm"
          loading={deleting}
          disabled={Boolean(busy)}
          leftIcon={<Trash2 color={theme.colors.danger} size={18} />}
        />
      </View>
    </Surface>
  );
}

export function MediaCaptionCard({
  busy,
  draft,
  mediaAsset,
  onConfirm,
  onDelete,
  onDraftChange,
  onSave,
  onStartImageDescription,
  suggestion,
}: {
  busy: string | null;
  draft: string;
  mediaAsset: MediaAsset;
  onConfirm: () => void;
  onDelete: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onStartImageDescription: () => void;
  suggestion?: string;
}) {
  const theme = useTheme();
  const generating = busy === `media-ai-${mediaAsset.id}`;
  const updating = busy === `media-caption-${mediaAsset.id}`;
  const deleting = busy === `media-delete-${mediaAsset.id}`;
  const pending = mediaAsset.storage_bucket === 'local-pending';
  const canRetry = !pending && (mediaAsset.caption_status === 'open' || mediaAsset.caption_status === 'error');
  const caption = suggestion || mediaAsset.caption || '';
  const hasDraft = draft.trim().length > 0;

  return (
    <Surface variant="muted" padding="3" radius="md" style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
      <View style={{ height: 96, width: 96, borderRadius: theme.radii.sm, overflow: 'hidden', backgroundColor: theme.colors.surfaceSunken }}>
        {mediaAsset.signed_url ? (
          <Image source={{ uri: mediaAsset.signed_url }} style={{ height: '100%', width: '100%' }} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="caption" tone="muted">
              Foto
            </Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: theme.spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {pending ? 'Foto wird verarbeitet' : 'Foto'}
          </Text>
          <Badge label={draftStatusLabel(mediaAsset.caption_status)} tone={mediaAsset.caption_status === 'error' ? 'danger' : 'neutral'} />
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {pending ? 'Foto und Zuordnung werden im Hintergrund verarbeitet.' : caption || 'Noch keine Beschriftung.'}
        </Text>
        <Input
          multiline
          minHeight={70}
          onChangeText={onDraftChange}
          placeholder="Bildunterschrift bearbeiten"
          value={draft}
        />
        {suggestion ? (
          <Text variant="caption" tone="muted">
            KI-Vorschlag wurde erzeugt.
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
          <Button
            label={mediaAsset.caption_status === 'error' ? 'Erneut versuchen' : 'KI-Beschriftung'}
            onPress={onStartImageDescription}
            variant="secondary"
            size="sm"
            leftIcon={<Wand2 color={theme.colors.text} size={18} />}
            disabled={Boolean(busy) || (!canRetry && !suggestion)}
          />
          <Button
            label="Speichern"
            onPress={onSave}
            variant="ghost"
            size="sm"
            disabled={Boolean(busy) || pending || !hasDraft}
          />
          <Button
            label="Bestätigen"
            onPress={onConfirm}
            variant="primary"
            size="sm"
            loading={updating || generating}
            disabled={Boolean(busy) || pending || !hasDraft}
            leftIcon={<ShieldCheck color={theme.colors.onPrimary} size={18} />}
          />
          <Button
            label="Löschen"
            onPress={onDelete}
            variant="ghost"
            size="sm"
            loading={deleting}
            disabled={Boolean(busy)}
            leftIcon={<Trash2 color={theme.colors.danger} size={18} />}
          />
        </View>
      </View>
    </Surface>
  );
}

export function DefectCard({
  active,
  defect,
  disabled,
  onMoveDown,
  onMoveUp,
  onPress,
  onStartVoice,
}: {
  active: boolean;
  defect: Defect;
  disabled?: boolean;
  onMoveDown?: () => void;
  onMoveUp?: () => void;
  onPress: () => void;
  onStartVoice?: () => void;
}) {
  const theme = useTheme();
  const photos = defect.media_links
    .map((link) => link.media_asset)
    .filter((media): media is MediaAsset => Boolean(media?.signed_url));

  return (
    <Card active={active} disabled={disabled}>
      <View style={{ gap: theme.spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="captionStrong" tone="primary">
            {defect.report_number ? `${defect.report_number}. ` : ''}
            {defect.kind === 'defect' ? 'Mangel' : 'Hinweis'}
          </Text>
          <Text variant="caption" tone="muted">
            {defect.media_links.length} Fotos
          </Text>
        </View>
        <Text variant="bodyStrong">{defect.local_label || defect.trade_name_snapshot || 'Ohne Gewerk'}</Text>
        {defect.category ? (
          <Text variant="caption" tone="muted">
            Kategorie: {defect.category}
          </Text>
        ) : null}
        <Text variant="body" tone="secondary" numberOfLines={3}>
          {defect.description}
        </Text>
        {photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: theme.spacing[1] }}>
            {photos.map((media) => (
              <Image
                key={media.id}
                source={{ uri: media.signed_url ?? '' }}
                style={{ height: 84, width: 84, borderRadius: theme.radii.sm, marginRight: theme.spacing[2], backgroundColor: theme.colors.surfaceSunken }}
              />
            ))}
          </ScrollView>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2], marginTop: theme.spacing[1] }}>
          <Button
            label={active ? 'Ausgewählt' : 'Auswählen'}
            onPress={onPress}
            variant={active ? 'primary' : 'secondary'}
            size="sm"
            disabled={disabled}
          />
          {onMoveUp ? (
            <Button
              label="Nach oben"
              onPress={onMoveUp}
              variant="ghost"
              size="sm"
              leftIcon={<MoveUp color={theme.colors.text} size={18} />}
              disabled={disabled}
            />
          ) : null}
          {onMoveDown ? (
            <Button
              label="Nach unten"
              onPress={onMoveDown}
              variant="ghost"
              size="sm"
              leftIcon={<MoveDown color={theme.colors.text} size={18} />}
              disabled={disabled}
            />
          ) : null}
          {onStartVoice ? (
            <Button
              label="Sprachnotiz"
              onPress={onStartVoice}
              variant="secondary"
              size="sm"
              leftIcon={<Mic color={theme.colors.text} size={18} />}
              disabled={disabled}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export function OutboxDefectCard({
  item,
  pendingMedia,
}: {
  item: OutboxItem;
  pendingMedia: PendingMediaItem[];
}) {
  const theme = useTheme();
  const nestedDefect =
    item.payload.defect && typeof item.payload.defect === 'object' && !Array.isArray(item.payload.defect)
      ? (item.payload.defect as Record<string, unknown>)
      : null;
  const payload = nestedDefect ?? item.payload;
  const kind = payload.kind === 'notice' ? 'Hinweis' : 'Mangel';
  const description = typeof payload.description === 'string' ? payload.description : 'Offline erfasster Eintrag';
  const trade = typeof payload.trade_name_snapshot === 'string' ? payload.trade_name_snapshot : 'Noch offen';
  const pendingMediaClientIds = Array.isArray(item.payload.pending_media_client_ids)
    ? item.payload.pending_media_client_ids.filter((clientId): clientId is string => typeof clientId === 'string')
    : [];
  const pendingPhotos = pendingMedia.filter((media) => pendingMediaClientIds.includes(media.client_id));

  return (
    <Surface
      variant="card"
      padding="4"
      bordered
      style={{ gap: theme.spacing[2], borderColor: theme.colors.warning, backgroundColor: theme.colors.warningSoft }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="captionStrong" tone="warning">
          {kind} (offline)
        </Text>
        <Badge label="Noch offen" tone="warning" />
      </View>
      <Text variant="bodyStrong">{trade || 'Ohne Gewerk'}</Text>
      <Text variant="body" tone="secondary" numberOfLines={2}>
        {description}
      </Text>
      {pendingPhotos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {pendingPhotos.map((photo) => (
            <Image
              key={photo.client_id}
              source={{ uri: photo.local_uri }}
              style={{ height: 80, width: 80, borderRadius: theme.radii.sm, marginRight: theme.spacing[2] }}
            />
          ))}
        </ScrollView>
      ) : null}
    </Surface>
  );
}

// Compatibility: previously this file exported a "ImagePlus"-related helper. Kept for safety.
export { ImagePlus };
