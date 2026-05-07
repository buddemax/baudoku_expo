import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, ChoiceChips, Input, Surface, Text } from '../../components';
import { ProjectDatePickerField } from '../../components/ProjectDatePickerField';
import { useTheme } from '../../theme';
import type { Profile, Project, ProjectUpdateInput } from '../../types/projects';
import { appraisalTypes, type AppraisalType } from '../../types/projects';
import { projectDateError, projectDateHint } from './date';
import {
  initialProjectEditForm,
  toProjectUpdateInput,
  type ProjectEditFormState,
} from './helpers';

export function ProjectEditPanel({
  busy,
  onCancel,
  onSubmit,
  profiles,
  project,
}: {
  busy: string | null;
  onCancel: () => void;
  onSubmit: (input: ProjectUpdateInput) => Promise<Project>;
  profiles: Profile[];
  project: Project;
}) {
  const theme = useTheme();
  const [form, setForm] = useState<ProjectEditFormState>(() => initialProjectEditForm(project));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialProjectEditForm(project));
    setError(null);
  }, [project]);

  const submitting = busy === 'project-save';
  const disabled = Boolean(busy);

  const missingFields = useMemo(
    () =>
      [
        form.project_number.trim(),
        form.client_name.trim(),
        form.object_address.trim(),
        form.site_visit_date.trim(),
        form.appraisal_type,
      ].filter((value) => !value).length,
    [form],
  );

  const dateError = projectDateError(form.site_visit_date);
  const canSubmit = missingFields === 0 && !dateError && !disabled;

  const update = (key: keyof ProjectEditFormState, value: string | null) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await onSubmit(toProjectUpdateInput(form));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Projekt konnte nicht gespeichert werden.');
    }
  };

  return (
    <Surface variant="card" padding="5" elevated bordered style={{ gap: theme.spacing[4] }}>
      <Text variant="heading">Projekt bearbeiten</Text>

      <Input
        label="Projektnummer"
        autoCapitalize="characters"
        editable={!disabled}
        onChangeText={(value) => update('project_number', value)}
        placeholder="BBA-2026-001"
        value={form.project_number}
      />

      <Input
        label="Auftraggeber"
        editable={!disabled}
        onChangeText={(value) => update('client_name', value)}
        placeholder="Muster GmbH"
        value={form.client_name}
      />

      <Input
        label="Objektadresse"
        editable={!disabled}
        multiline
        minHeight={96}
        onChangeText={(value) => update('object_address', value)}
        placeholder="Straße, PLZ Ort"
        value={form.object_address}
      />

      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Datum Ortstermin</Text>
        <ProjectDatePickerField
          disabled={disabled}
          onChange={(value) => update('site_visit_date', value)}
          value={form.site_visit_date}
        />
        <Text variant="caption" tone="muted">
          {projectDateHint}
        </Text>
      </View>

      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Art des Gutachtens</Text>
        <ChoiceChips<AppraisalType>
          value={form.appraisal_type}
          options={appraisalTypes.map((type) => ({ value: type, label: type }))}
          onChange={(value) => update('appraisal_type', value)}
        />
      </View>

      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Bearbeiter</Text>
        <ChoiceChips<string>
          value={form.lead_user_id ?? ''}
          options={profiles.map((profile) => ({ value: profile.id, label: profile.display_name }))}
          onChange={(value) => update('lead_user_id', value)}
        />
      </View>

      {error ? <Banner tone="error" title="Speichern fehlgeschlagen" message={error} /> : null}
      {dateError ? <Banner tone="warning" title="Datum prüfen" message={dateError} /> : null}
      {missingFields > 0 ? (
        <Text variant="caption" tone="muted">
          Es fehlen noch {missingFields} Pflichtangaben.
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        <View style={{ flex: 1 }}>
          <Button label="Abbrechen" onPress={onCancel} variant="secondary" size="md" fullWidth disabled={disabled} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Speichern"
            onPress={submit}
            variant="primary"
            size="md"
            fullWidth
            disabled={!canSubmit}
            loading={submitting}
          />
        </View>
      </View>
    </Surface>
  );
}
