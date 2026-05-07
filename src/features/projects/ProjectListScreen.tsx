import { Plus, Search, SlidersHorizontal } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import {
  Badge,
  Banner,
  Button,
  ChoiceChips,
  EmptyState,
  FAB,
  IconButton,
  Input,
  ProjectStatusBadge,
  Screen,
  Sheet,
  Skeleton,
  Surface,
  Text,
  VStack,
} from '../../components';
import { Card } from '../../components/Card';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { useTheme } from '../../theme';
import type { AppraisalType, Profile, Project, ProjectStatus } from '../../types/projects';
import { appraisalTypes, projectStatuses } from '../../types/projects';
import { normalizeSearchText, profileById, projectSearchText } from './helpers';

export function ProjectListScreen({
  error,
  loading,
  onCreate,
  onOpenProject,
  onRefresh,
  profiles,
  projects,
  refreshing,
}: {
  error: string | null;
  loading: boolean;
  onCreate: () => void;
  onOpenProject: (project: Project) => void;
  onRefresh: () => void;
  profiles: Profile[];
  projects: Project[];
  refreshing: boolean;
}) {
  const theme = useTheme();
  const [searchText, setSearchText] = useState('');
  const [appraisalFilter, setAppraisalFilter] = useState<AppraisalType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [listMode, setListMode] = useState<'active' | 'deleted'>('active');
  const [filterOpen, setFilterOpen] = useState(false);

  const activeProjects = useMemo(() => projects.filter((p) => !p.deleted_at), [projects]);
  const deletedProjects = useMemo(() => projects.filter((p) => p.deleted_at), [projects]);

  const filteredProjects = useMemo(() => {
    const query = normalizeSearchText(searchText);
    const terms = query.split(/\s+/).filter(Boolean);
    return projects.filter((project) => {
      if (listMode === 'active' && project.deleted_at) return false;
      if (listMode === 'deleted' && !project.deleted_at) return false;
      if (appraisalFilter !== 'all' && project.appraisal_type !== appraisalFilter) return false;
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;
      if (!terms.length) return true;
      const searchable = projectSearchText(project);
      return terms.every((term) => searchable.includes(term));
    });
  }, [appraisalFilter, listMode, projects, searchText, statusFilter]);

  const activeFilterCount =
    (searchText.trim().length > 0 ? 1 : 0) +
    (appraisalFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (listMode !== 'active' ? 1 : 0);

  const clearFilters = () => {
    setSearchText('');
    setAppraisalFilter('all');
    setStatusFilter('all');
    setListMode('active');
  };

  const totalForMode = listMode === 'active' ? activeProjects.length : deletedProjects.length;

  return (
    <Screen scroll={false} padded={false} edges={['bottom']}>
      <VStack gap="4" padding="5" style={{ paddingBottom: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Projekte suchen"
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              leftAdornment={<Search color={theme.colors.textMuted} size={20} />}
            />
          </View>
          <IconButton
            accessibilityLabel="Filter öffnen"
            icon={<SlidersHorizontal color={theme.colors.text} size={22} />}
            onPress={() => setFilterOpen(true)}
            variant="soft"
            size={56}
          />
        </View>

        {activeFilterCount > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
            <Badge label={`${activeFilterCount} Filter aktiv`} tone="primary" />
            <Button label="Filter zurücksetzen" onPress={clearFilters} variant="ghost" size="sm" />
          </View>
        ) : null}

        <Text variant="caption" tone="muted">
          {filteredProjects.length} von {totalForMode} {listMode === 'active' ? 'aktiven' : 'archivierten'} Projekten
        </Text>
      </VStack>

      {error ? (
        <View style={{ paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[3] }}>
          <Banner
            tone="error"
            title="Projektliste nicht erreichbar"
            message={error}
            actionLabel="Erneut laden"
            onAction={onRefresh}
          />
        </View>
      ) : null}

      {loading && projects.length === 0 ? (
        <VStack gap="3" padding="5">
          <Skeleton height={120} radius={theme.radii.lg} />
          <Skeleton height={120} radius={theme.radii.lg} />
          <Skeleton height={120} radius={theme.radii.lg} />
        </VStack>
      ) : (
        <FlatList
          data={filteredProjects}
          keyExtractor={(project) => project.id}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing[5],
            paddingBottom: theme.spacing[12],
            paddingTop: theme.spacing[3],
            gap: theme.spacing[3],
          }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => (
            <ProjectCardItem
              project={item}
              leadProfile={profileById(profiles, item.lead_user_id)}
              onPress={() => onOpenProject(item)}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              projects.length === 0 ? (
                <EmptyState
                  title="Noch keine Projekte"
                  message="Lege dein erstes Projekt an, um mit der Erfassung zu beginnen."
                  actionLabel="Projekt anlegen"
                  onAction={onCreate}
                />
              ) : (
                <EmptyState
                  title="Kein Treffer"
                  message="Kein Projekt passt zu Suche und Filtern."
                  actionLabel="Filter zurücksetzen"
                  onAction={clearFilters}
                />
              )
            ) : null
          }
        />
      )}

      <FAB
        icon={<Plus color={theme.colors.onPrimary} size={26} />}
        label="Neues Projekt"
        onPress={onCreate}
      />

      <Sheet visible={filterOpen} onDismiss={() => setFilterOpen(false)} title="Filter">
        <VStack gap="5">
          <VStack gap="2">
            <Text variant="label">Liste</Text>
            <ChoiceChips<'active' | 'deleted'>
              value={listMode}
              options={[
                { value: 'active', label: `Aktiv (${activeProjects.length})` },
                { value: 'deleted', label: `Archiv (${deletedProjects.length})` },
              ]}
              onChange={setListMode}
            />
          </VStack>
          <VStack gap="2">
            <Text variant="label">Art des Gutachtens</Text>
            <ChoiceChips<AppraisalType | 'all'>
              value={appraisalFilter}
              options={[{ value: 'all', label: 'Alle' }, ...appraisalTypes.map((value) => ({ value, label: value }))]}
              onChange={setAppraisalFilter}
            />
          </VStack>
          <VStack gap="2">
            <Text variant="label">Status</Text>
            <ChoiceChips<ProjectStatus | 'all'>
              value={statusFilter}
              options={[{ value: 'all', label: 'Alle' }, ...projectStatuses.map((value) => ({ value, label: value }))]}
              onChange={setStatusFilter}
            />
          </VStack>
          <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Button label="Zurücksetzen" onPress={clearFilters} variant="secondary" size="md" fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Anwenden" onPress={() => setFilterOpen(false)} variant="primary" size="md" fullWidth />
            </View>
          </View>
        </VStack>
      </Sheet>
    </Screen>
  );
}

function ProjectCardItem({
  project,
  leadProfile,
  onPress,
}: {
  project: Project;
  leadProfile: Profile | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={`Projekt ${project.project_number}, ${project.client_name}`}>
      <View style={{ gap: theme.spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
          <Text variant="captionStrong" tone="primary">
            {project.project_number}
          </Text>
          <ProjectStatusBadge status={project.status} />
        </View>
        <Text variant="subheading" numberOfLines={1}>
          {project.client_name}
        </Text>
        <Text variant="body" tone="secondary" numberOfLines={2}>
          {project.object_address}
        </Text>
        <Surface variant="muted" padding="3" radius="sm" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] }}>
          <Text variant="caption" tone="secondary">
            Termin {formatDate(project.site_visit_date)}
          </Text>
          <Text variant="caption" tone="muted">
            {leadProfile?.display_name ?? 'Ohne Bearbeiter'}
          </Text>
          {project.deleted_at ? (
            <Text variant="caption" tone="warning">
              Archiviert {formatDateTime(project.deleted_at)}
            </Text>
          ) : null}
        </Surface>
      </View>
    </Card>
  );
}
