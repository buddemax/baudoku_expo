import type { useAudioRecorderState } from 'expo-audio';
import { Camera, Filter as FilterIcon, Image as ImageIcon, Search, Mic } from 'lucide-react-native';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert, View } from 'react-native';

import {
  Banner,
  Button,
  ChoiceChips,
  Disclosure,
  EmptyState,
  Input,
  Sheet,
  Surface,
  Text,
  VStack,
} from '../../../components';
import type { DefectUpdateInput } from '../../../lib/api';
import type { OutboxItem, PendingMediaItem } from '../../../lib/offlineStore';
import type { UploadableAsset } from '../../../lib/uploadProjectFile';
import { useTheme } from '../../../theme';
import type { Defect, DefectKind, DraftStatus, MediaAsset, VoiceNote } from '../../../types/projects';
import {
  DefectCard,
  MediaCaptionCard,
  OutboxDefectCard,
  VoiceCapturePanel,
  VoiceNoteCard,
} from './components';

export function EntriesTab({
  audioPermissionGranted,
  busy,
  defects,
  entryCategories,
  entryCategoryFilter,
  entryFilteredDefects,
  entryKindFilter,
  entrySearchText,
  entryTradeFilter,
  entryTrades,
  mediaAiSuggestions,
  mediaCaptionDrafts,
  onAddPhotoToDefect,
  onAssignLegacyVoiceNote,
  onDiscardVoice,
  onMoveDefect,
  onRequestMicrophonePermission,
  onSaveVoiceForSelectedDefect,
  onStartImageDescription,
  onStartVoice,
  onStartVoiceForDefect,
  onStartVoiceTranscription,
  onStopVoice,
  onChangeMediaCaptionDraft,
  onDeleteDefect,
  onDeleteMedia,
  onDeleteVoiceNote,
  onUpdateMediaCaption,
  onUpdateDefect,
  onUpdateVoiceTranscript,
  pendingMedia,
  pendingDefectOperations,
  recordedVoiceAsset,
  recorderState,
  selectedDefect,
  selectedDefectId,
  setEntryCategoryFilter,
  setEntryKindFilter,
  setEntrySearchText,
  setEntryTradeFilter,
  setSelectedDefectId,
  setVoiceDrafts,
  setVoiceTranscript,
  voiceDrafts,
  voiceNotes,
  voiceTranscript,
}: {
  audioPermissionGranted: boolean | null;
  busy: string | null;
  defects: Defect[];
  entryCategories: string[];
  entryCategoryFilter: string | 'all';
  entryFilteredDefects: Defect[];
  entryKindFilter: DefectKind | 'all';
  entrySearchText: string;
  entryTradeFilter: string | 'all';
  entryTrades: { key: string; label: string }[];
  mediaAiSuggestions: Record<string, string>;
  mediaCaptionDrafts: Record<string, string>;
  onAddPhotoToDefect: (defectId: string, mode: 'camera' | 'library') => void;
  onAssignLegacyVoiceNote: (voiceNote: VoiceNote, defectId: string) => void;
  onDiscardVoice: () => void;
  onMoveDefect: (defectId: string, direction: -1 | 1) => void;
  onRequestMicrophonePermission: () => void;
  onSaveVoiceForSelectedDefect: () => void;
  onStartImageDescription: (mediaAsset: MediaAsset) => void;
  onStartVoice: () => void;
  onStartVoiceForDefect: (defectId: string) => void;
  onStartVoiceTranscription: (voiceNote: VoiceNote) => void;
  onStopVoice: () => void;
  onChangeMediaCaptionDraft: (mediaAsset: MediaAsset, value: string) => void;
  onDeleteDefect: (defectId: string) => void;
  onDeleteMedia: (mediaAsset: MediaAsset) => void;
  onDeleteVoiceNote: (voiceNote: VoiceNote) => void;
  onUpdateMediaCaption: (mediaAsset: MediaAsset, status: Extract<DraftStatus, 'edited' | 'confirmed'>) => void;
  onUpdateDefect: (defectId: string, input: DefectUpdateInput) => void;
  onUpdateVoiceTranscript: (voiceNote: VoiceNote, status: Extract<DraftStatus, 'edited' | 'confirmed'>) => void;
  pendingMedia: PendingMediaItem[];
  pendingDefectOperations: OutboxItem[];
  recordedVoiceAsset: UploadableAsset | null;
  recorderState: ReturnType<typeof useAudioRecorderState>;
  selectedDefect: Defect | null;
  selectedDefectId: string | null;
  setEntryCategoryFilter: (filter: string | 'all') => void;
  setEntryKindFilter: (filter: DefectKind | 'all') => void;
  setEntrySearchText: (text: string) => void;
  setEntryTradeFilter: (filter: string | 'all') => void;
  setSelectedDefectId: (defectId: string) => void;
  setVoiceDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setVoiceTranscript: (value: string) => void;
  voiceDrafts: Record<string, string>;
  voiceNotes: VoiceNote[];
  voiceTranscript: string;
}) {
  const theme = useTheme();
  const [filterOpen, setFilterOpen] = useState(false);
  const [entryEditDraft, setEntryEditDraft] = useState({
    kind: 'defect' as DefectKind,
    local_label: '',
    trade_name_snapshot: '',
    category: '',
    description: '',
  });

  const selectedPhotoMedia = selectedDefect
    ? selectedDefect.media_links
        .map((link) => link.media_asset)
        .filter((mediaAsset): mediaAsset is MediaAsset => mediaAsset?.media_type === 'photo')
    : [];
  const selectedVoiceNotes = selectedDefect
    ? voiceNotes.filter(
        (voiceNote) => voiceNote.target_type === 'defect_description' && voiceNote.defect_id === selectedDefect.id,
      )
    : [];
  const legacyVoiceNotes = voiceNotes.filter(
    (voiceNote) => voiceNote.target_type !== 'defect_description' || !voiceNote.defect_id,
  );
  const selectedLabel = selectedDefect
    ? selectedDefect.local_label || selectedDefect.description.slice(0, 42)
    : 'kein Eintrag';

  useEffect(() => {
    if (!selectedDefect) {
      return;
    }
    setEntryEditDraft({
      kind: selectedDefect.kind,
      local_label: selectedDefect.local_label,
      trade_name_snapshot: selectedDefect.trade_name_snapshot ?? '',
      category: selectedDefect.category ?? '',
      description: selectedDefect.description,
    });
  }, [selectedDefect]);

  const activeFilterCount =
    (entryKindFilter !== 'all' ? 1 : 0) +
    (entryTradeFilter !== 'all' ? 1 : 0) +
    (entryCategoryFilter !== 'all' ? 1 : 0) +
    (entrySearchText.trim().length > 0 ? 1 : 0);

  const saveSelectedDefect = () => {
    if (!selectedDefect) {
      return;
    }
    onUpdateDefect(selectedDefect.id, {
      kind: entryEditDraft.kind,
      local_label: entryEditDraft.local_label.trim(),
      trade_id: null,
      trade_name_snapshot: entryEditDraft.trade_name_snapshot.trim() || null,
      category: entryEditDraft.category.trim() || null,
      description: entryEditDraft.description.trim(),
    });
  };

  const confirmDeleteDefect = (defect: Defect) => {
    Alert.alert(
      'Eintrag loeschen?',
      `${defect.local_label || defect.description.slice(0, 42)}\n\nDer Eintrag wird inklusive Zuordnungen aus der aktiven Liste entfernt.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Loeschen', onPress: () => onDeleteDefect(defect.id), style: 'destructive' },
      ],
    );
  };

  const confirmDeleteMedia = (mediaAsset: MediaAsset) => {
    Alert.alert('Foto loeschen?', 'Dieses Foto wird vom Eintrag entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Loeschen', onPress: () => onDeleteMedia(mediaAsset), style: 'destructive' },
    ]);
  };

  const confirmDeleteVoiceNote = (voiceNote: VoiceNote) => {
    Alert.alert('Sprachnotiz loeschen?', 'Diese Aufnahme und ihr Transkript werden entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Loeschen', onPress: () => onDeleteVoiceNote(voiceNote), style: 'destructive' },
    ]);
  };

  return (
    <VStack gap="4">
      <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[3] }}>
        <Text variant="heading">Erfasste Einträge</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Nach Text, Nummer, Gewerk filtern"
              value={entrySearchText}
              onChangeText={setEntrySearchText}
              autoCapitalize="none"
              leftAdornment={<Search color={theme.colors.textMuted} size={20} />}
            />
          </View>
          <Button
            label={activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
            onPress={() => setFilterOpen(true)}
            variant="secondary"
            size="md"
            leftIcon={<FilterIcon color={theme.colors.text} size={18} />}
          />
        </View>

        {defects.length === 0 ? (
          <EmptyState title="Noch nichts erfasst" message='Lege deinen ersten Mangel oder Hinweis im Tab "Erfassen" an.' />
        ) : entryFilteredDefects.length === 0 ? (
          <EmptyState title="Kein Treffer" message="Kein Eintrag passt zu Suche und Filtern." />
        ) : null}

        <VStack gap="3">
          {entryFilteredDefects.map((defect) => {
            const index = defects.findIndex((item) => item.id === defect.id);
            return (
              <DefectCard
                key={defect.id}
                active={defect.id === selectedDefectId}
                defect={defect}
                disabled={Boolean(busy)}
                onMoveDown={index >= 0 && index < defects.length - 1 ? () => onMoveDefect(defect.id, 1) : undefined}
                onMoveUp={index > 0 ? () => onMoveDefect(defect.id, -1) : undefined}
                onPress={() => setSelectedDefectId(defect.id)}
                onStartVoice={() => onStartVoiceForDefect(defect.id)}
              />
            );
          })}
          {pendingDefectOperations.map((item) => (
            <OutboxDefectCard item={item} key={item.client_operation_id} pendingMedia={pendingMedia} />
          ))}
        </VStack>

        <Text variant="caption" tone="muted">
          Ausgewählt: {selectedLabel}
        </Text>
      </Surface>

      {selectedDefect ? (
        <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[4] }}>
          <View style={{ gap: theme.spacing[1] }}>
            <Text variant="captionStrong" tone="primary" style={{ textTransform: 'uppercase' }}>
              Ausgewählter Eintrag
            </Text>
            <Text variant="subheading" numberOfLines={2}>
              {selectedLabel}
            </Text>
          </View>

          <Disclosure title="Details bearbeiten" subtitle="Text, Art, Gewerk und Kategorie" defaultOpen={false}>
            <VStack gap="3">
              <View style={{ gap: theme.spacing[2] }}>
                <Text variant="label">Art</Text>
                <ChoiceChips<DefectKind>
                  value={entryEditDraft.kind}
                  options={[
                    { value: 'defect', label: 'Mangel' },
                    { value: 'notice', label: 'Hinweis' },
                  ]}
                  onChange={(kind) => setEntryEditDraft((current) => ({ ...current, kind }))}
                />
              </View>
              <Input
                label="Arbeitsnummer"
                onChangeText={(localLabel) => setEntryEditDraft((current) => ({ ...current, local_label: localLabel }))}
                value={entryEditDraft.local_label}
              />
              <Input
                label="Gewerk"
                onChangeText={(tradeName) =>
                  setEntryEditDraft((current) => ({ ...current, trade_name_snapshot: tradeName }))
                }
                value={entryEditDraft.trade_name_snapshot}
              />
              <Input
                label="Kategorie"
                onChangeText={(category) => setEntryEditDraft((current) => ({ ...current, category }))}
                value={entryEditDraft.category}
              />
              <Input
                label="Beschreibung"
                multiline
                minHeight={120}
                onChangeText={(description) => setEntryEditDraft((current) => ({ ...current, description }))}
                value={entryEditDraft.description}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
                <Button
                  label="Eintrag speichern"
                  onPress={saveSelectedDefect}
                  variant="primary"
                  size="md"
                  disabled={
                    Boolean(busy) ||
                    !entryEditDraft.local_label.trim() ||
                    !entryEditDraft.description.trim()
                  }
                />
                <Button
                  label="Eintrag löschen"
                  onPress={() => confirmDeleteDefect(selectedDefect)}
                  variant="ghost"
                  size="md"
                  disabled={Boolean(busy)}
                />
              </View>
            </VStack>
          </Disclosure>

          <Disclosure
            title={`Fotos (${selectedPhotoMedia.length})`}
            subtitle="Fotos und Bildunterschriften"
            defaultOpen={selectedPhotoMedia.length > 0}
          >
            <View style={{ flexDirection: 'row', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <Button
                label="Foto aufnehmen"
                onPress={() => onAddPhotoToDefect(selectedDefect.id, 'camera')}
                variant="primary"
                size="md"
                leftIcon={<Camera color={theme.colors.onPrimary} size={20} />}
                disabled={Boolean(busy)}
              />
              <Button
                label="Aus Galerie"
                onPress={() => onAddPhotoToDefect(selectedDefect.id, 'library')}
                variant="secondary"
                size="md"
                leftIcon={<ImageIcon color={theme.colors.text} size={20} />}
                disabled={Boolean(busy)}
              />
            </View>
            {selectedPhotoMedia.length === 0 ? (
              <Text variant="caption" tone="muted">
                Noch keine Fotos.
              </Text>
            ) : null}
            {selectedPhotoMedia.map((mediaAsset) => (
              <MediaCaptionCard
                busy={busy}
                draft={mediaCaptionDrafts[mediaAsset.id] ?? mediaAsset.caption ?? ''}
                key={mediaAsset.id}
                mediaAsset={mediaAsset}
                onConfirm={() => onUpdateMediaCaption(mediaAsset, 'confirmed')}
                onDraftChange={(value) => onChangeMediaCaptionDraft(mediaAsset, value)}
                onDelete={() => confirmDeleteMedia(mediaAsset)}
                onSave={() => onUpdateMediaCaption(mediaAsset, 'edited')}
                onStartImageDescription={() => onStartImageDescription(mediaAsset)}
                suggestion={mediaAiSuggestions[mediaAsset.id]}
              />
            ))}
          </Disclosure>

          <View style={{ height: 1, backgroundColor: theme.colors.divider }} />

          <Disclosure
            title={`Sprachnotizen (${selectedVoiceNotes.length})`}
            subtitle="Aufnahmen und Transkripte"
            defaultOpen={false}
          >
            <VoiceCapturePanel
              busy={busy}
              contextLabel={`Ziel: ${selectedLabel}`}
              embedded
              onDiscard={onDiscardVoice}
              onRequestPermission={onRequestMicrophonePermission}
              onSave={onSaveVoiceForSelectedDefect}
              onStart={onStartVoice}
              onStop={onStopVoice}
              onTranscriptChange={setVoiceTranscript}
              permissionGranted={audioPermissionGranted}
              recordedAsset={recordedVoiceAsset}
              recorderState={recorderState}
              saveLabel="Sprachnotiz speichern"
              title="Neue Aufnahme"
              transcript={voiceTranscript}
            />
            {selectedVoiceNotes.length === 0 ? (
              <Text variant="caption" tone="muted">
                Noch keine Sprachnotiz.
              </Text>
            ) : null}
            {selectedVoiceNotes.map((voiceNote) => (
              <VoiceNoteCard
                busy={busy}
                draft={voiceDrafts[voiceNote.id] ?? voiceNote.transcript ?? ''}
                key={voiceNote.id}
                onConfirm={() => onUpdateVoiceTranscript(voiceNote, 'confirmed')}
                onDelete={() => confirmDeleteVoiceNote(voiceNote)}
                onDraftChange={(value) => setVoiceDrafts((current) => ({ ...current, [voiceNote.id]: value }))}
                onSave={() => onUpdateVoiceTranscript(voiceNote, 'edited')}
                onTranscribe={() => onStartVoiceTranscription(voiceNote)}
                voiceNote={voiceNote}
              />
            ))}
          </Disclosure>

          {legacyVoiceNotes.length ? (
            <>
              <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
              <Disclosure
                title={`Ältere Sprachnotizen (${legacyVoiceNotes.length})`}
                subtitle="Aufnahmen ohne Eintrag-Zuordnung"
                defaultOpen={false}
              >
                <Banner
                  tone="info"
                  message="Diese Aufnahmen haben noch keinen Eintrag. Du kannst sie dem ausgewählten Eintrag zuordnen."
                />
                {legacyVoiceNotes.map((voiceNote) => (
                  <Surface key={voiceNote.id} variant="muted" padding="3" radius="md" style={{ gap: theme.spacing[2] }}>
                    <Text variant="bodyStrong">{voiceNote.transcript || 'Freie Sprachnotiz'}</Text>
                    <Text variant="caption" tone="muted">
                      Bisheriges Ziel: {voiceNote.target_type}
                    </Text>
                    <Button
                      label="Diesem Eintrag zuordnen"
                      onPress={() => onAssignLegacyVoiceNote(voiceNote, selectedDefect.id)}
                      variant="secondary"
                      size="sm"
                      leftIcon={<Mic color={theme.colors.text} size={18} />}
                      disabled={Boolean(busy)}
                    />
                    <Button
                      label="Sprachnotiz löschen"
                      onPress={() => confirmDeleteVoiceNote(voiceNote)}
                      variant="ghost"
                      size="sm"
                      disabled={Boolean(busy)}
                    />
                  </Surface>
                ))}
              </Disclosure>
            </>
          ) : null}
        </Surface>
      ) : null}

      <Sheet visible={filterOpen} onDismiss={() => setFilterOpen(false)} title="Filter Einträge">
        <VStack gap="5">
          <VStack gap="2">
            <Text variant="label">Art</Text>
            <ChoiceChips<DefectKind | 'all'>
              value={entryKindFilter}
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'defect', label: 'Mängel' },
                { value: 'notice', label: 'Hinweise' },
              ]}
              onChange={setEntryKindFilter}
            />
          </VStack>
          {entryTrades.length ? (
            <VStack gap="2">
              <Text variant="label">Gewerk</Text>
              <ChoiceChips<string | 'all'>
                value={entryTradeFilter}
                options={[{ value: 'all', label: 'Alle Gewerke' }, ...entryTrades.map((trade) => ({ value: trade.key, label: trade.label }))]}
                onChange={setEntryTradeFilter}
              />
            </VStack>
          ) : null}
          {entryCategories.length ? (
            <VStack gap="2">
              <Text variant="label">Kategorie</Text>
              <ChoiceChips<string | 'all'>
                value={entryCategoryFilter}
                options={[{ value: 'all', label: 'Alle Kategorien' }, ...entryCategories.map((category) => ({ value: category, label: category }))]}
                onChange={setEntryCategoryFilter}
              />
            </VStack>
          ) : null}
          <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Zurücksetzen"
                onPress={() => {
                  setEntryKindFilter('all');
                  setEntryTradeFilter('all');
                  setEntryCategoryFilter('all');
                  setEntrySearchText('');
                }}
                variant="secondary"
                size="md"
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Anwenden" onPress={() => setFilterOpen(false)} variant="primary" size="md" fullWidth />
            </View>
          </View>
        </VStack>
      </Sheet>
    </VStack>
  );
}
