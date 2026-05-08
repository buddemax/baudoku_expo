import 'react-native-gesture-handler';

import type { Session } from '@supabase/supabase-js';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { StatusBar } from 'expo-status-bar';
import { LogOut } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  AppHeader,
  Button,
  ConfirmProvider,
  FullscreenLoading,
  Screen,
  Text,
  ToastProvider,
  useToast,
  VStack,
} from './src/components';
import { LoginScreen, PasswordRecoveryScreen } from './src/features/auth/AuthScreens';
import { ProjectCreateScreen } from './src/features/projects/ProjectCreateScreen';
import { ProjectListScreen } from './src/features/projects/ProjectListScreen';
import { ProjectDetailScreen } from './src/features/projects/detail/ProjectDetailScreen';
import { profilesApi, projectsApi, tradesApi } from './src/lib/api';
import { isSupabaseConfigured } from './src/lib/config';
import {
  clearOfflineData,
  readCachedProjects,
  readCachedReferenceData,
  readOutbox,
  readPendingMedia,
  writeReferenceDataCache,
} from './src/lib/offlineStore';
import { supabase } from './src/lib/supabase';
import { syncOfflineQueues } from './src/lib/sync';
import { ThemeProvider, useTheme } from './src/theme';
import { useAppFonts } from './src/theme/fonts';
import type { Profile, Project, Trade } from './src/types/projects';

type ScreenName = 'list' | 'create' | 'detail';

const recoverySessionFromUrl = (url: string): { access_token: string; refresh_token: string } | null => {
  const tokenPart = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
  if (!tokenPart) {
    return null;
  }
  const params = new URLSearchParams(tokenPart);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  if (!accessToken || !refreshToken || type !== 'recovery') {
    return null;
  }
  return { access_token: accessToken, refresh_token: refreshToken };
};

const isOnlineState = (state: NetInfoState) =>
  state.isConnected !== false && state.isInternetReachable !== false;

const AUTO_SYNC_THROTTLE_MS = 10000;

export default function App() {
  const fontsLoaded = useAppFonts();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {fontsLoaded ? (
            <ToastProvider>
              <ConfirmProvider>
                <AppRoot />
              </ConfirmProvider>
            </ToastProvider>
          ) : (
            <FullscreenLoading label="App wird geladen…" />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppRoot() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    const supabaseClient = supabase;

    supabaseClient.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      setSession(nextSession);
      setAuthLoading(false);
    });

    const handleRecoveryUrl = async (url: string | null) => {
      if (!url) return;
      const recoverySession = recoverySessionFromUrl(url);
      if (!recoverySession) return;
      const { error } = await supabaseClient.auth.setSession(recoverySession);
      if (!error) {
        setPasswordRecovery(true);
      }
    };

    Linking.getInitialURL().then(handleRecoveryUrl).catch(() => undefined);
    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleRecoveryUrl(event.url).catch(() => undefined);
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  if (!isSupabaseConfigured || !supabase) {
    return <ConfigMissingScreen />;
  }

  if (authLoading) {
    return <FullscreenLoading label="Sitzung wird geprüft" />;
  }

  if (passwordRecovery && session) {
    return <PasswordRecoveryScreen onDone={() => setPasswordRecovery(false)} />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <ProjectsApp session={session} />;
}

function ConfigMissingScreen() {
  return (
    <Screen scroll={false} padded edges={['top', 'bottom']}>
      <VStack gap="3" align="center" justify="center" flex={1} padding="6">
        <Text variant="caption" tone="primary" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          BBA Baudoku
        </Text>
        <Text variant="title">Konfiguration fehlt</Text>
        <Text variant="body" tone="muted" align="center">
          EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY müssen gesetzt sein.
        </Text>
      </VStack>
    </Screen>
  );
}

function ProjectsApp({ session }: { session: Session }) {
  const theme = useTheme();
  const toast = useToast();
  const [screen, setScreen] = useState<ScreenName>('list');
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkOnline, setNetworkOnline] = useState<boolean | null>(null);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [transferCounts, setTransferCounts] = useState({ pending: 0, errors: 0 });
  const syncInFlight = useRef(false);
  const previousOnline = useRef<boolean | null>(null);
  const lastAutoSyncStartedAt = useRef(0);

  const refreshTransferCounts = useCallback(async () => {
    const [outbox, pendingMedia] = await Promise.all([readOutbox(), readPendingMedia()]);
    setTransferCounts({
      pending:
        outbox.filter((item) => item.status !== 'error').length +
        pendingMedia.filter((item) => item.status !== 'linked' && item.status !== 'error').length,
      errors: outbox.filter((item) => item.status === 'error').length + pendingMedia.filter((item) => item.status === 'error').length,
    });
  }, []);

  const loadProjects = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [nextProjects, nextProfiles, nextTrades] = await Promise.all([
          projectsApi.list(session, { includeDeleted: true }),
          profilesApi.list(session),
          tradesApi.list(session),
        ]);
        setProjects(nextProjects);
        setProfiles(nextProfiles);
        setTrades(nextTrades);
        await writeReferenceDataCache({ profiles: nextProfiles, trades: nextTrades }).catch(() => undefined);
        setSelectedProject((currentProject) =>
          currentProject ? nextProjects.find((project) => project.id === currentProject.id) ?? currentProject : null,
        );
        await refreshTransferCounts();
      } catch (loadError) {
        const [cachedProjects, cachedReferenceData] = await Promise.all([
          readCachedProjects({ includeDeleted: true }),
          readCachedReferenceData(),
        ]);
        if (cachedProjects.length) {
          setProjects(cachedProjects);
          setProfiles(cachedReferenceData.profiles);
          setTrades(cachedReferenceData.trades);
          setSelectedProject((currentProject) =>
            currentProject ? cachedProjects.find((project) => project.id === currentProject.id) ?? currentProject : null,
          );
          await refreshTransferCounts();
          setError(null);
        } else {
          setError(loadError instanceof Error ? loadError.message : 'Projektliste konnte nicht geladen werden.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshTransferCounts, session],
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const runAutoSync = useCallback(
    async (_reason: 'start' | 'foreground' | 'reconnect', options: { force?: boolean } = {}) => {
      const now = Date.now();
      if (syncInFlight.current) return;
      if (!options.force && now - lastAutoSyncStartedAt.current < AUTO_SYNC_THROTTLE_MS) return;
      syncInFlight.current = true;
      lastAutoSyncStartedAt.current = now;
      setAutoSyncing(true);
      try {
        await syncOfflineQueues(session);
        await loadProjects('refresh');
        setLastSyncedAt(new Date());
      } catch {
        await refreshTransferCounts().catch(() => undefined);
      } finally {
        syncInFlight.current = false;
        setAutoSyncing(false);
      }
    },
    [loadProjects, refreshTransferCounts, session],
  );

  useEffect(() => {
    refreshTransferCounts().catch(() => undefined);
  }, [refreshTransferCounts]);

  useEffect(() => {
    NetInfo.fetch()
      .then((state) => {
        const online = isOnlineState(state);
        setNetworkOnline(online);
        previousOnline.current = online;
        if (online) {
          runAutoSync('start', { force: true }).catch(() => undefined);
        }
      })
      .catch(() => setNetworkOnline(null));
  }, [runAutoSync]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = isOnlineState(state);
      const wasOnline = previousOnline.current;
      previousOnline.current = online;
      setNetworkOnline(online);
      if (online && wasOnline === false) {
        runAutoSync('reconnect').catch(() => undefined);
      }
    });
    return unsubscribe;
  }, [runAutoSync]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      NetInfo.fetch()
        .then((networkState) => {
          const online = isOnlineState(networkState);
          setNetworkOnline(online);
          if (online) {
            runAutoSync('foreground').catch(() => undefined);
          }
        })
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [runAutoSync]);

  const handleLogout = async () => {
    try {
      await clearOfflineData();
    } catch {
      toast.show({
        tone: 'warning',
        message: 'Lokale Offline-Daten konnten nicht vollständig gelöscht werden.',
      });
    }
    await supabase?.auth.signOut();
  };

  const openDetail = (project: Project) => {
    setSelectedProject(project);
    setScreen('detail');
  };

  const handleCreated = (project: Project) => {
    setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
    setSelectedProject(project);
    setScreen('detail');
  };

  const handleProjectChanged = useCallback((project: Project) => {
    setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
    setSelectedProject(project);
  }, []);

  const handleProjectDeleted = useCallback((projectId: string) => {
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setSelectedProject(null);
    setScreen('list');
  }, []);

  const listSubtitle =
    networkOnline === false
      ? transferCounts.pending || transferCounts.errors
        ? 'Offline – Eingaben bleiben gespeichert'
        : 'Offline – bereit zum Weiterarbeiten'
      : autoSyncing
        ? 'Übertragung läuft'
        : transferCounts.errors
          ? 'Übertragung nicht abgeschlossen'
          : transferCounts.pending
            ? `${transferCounts.pending} offen`
            : lastSyncedAt
              ? 'Alles gespeichert'
              : 'Online';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} backgroundColor={theme.colors.background} />
      {screen === 'list' ? (
        <AppHeader
          title="Projekte"
          subtitle={listSubtitle}
          trailing={
            <Button
              label="Abmelden"
              onPress={handleLogout}
              variant="ghost"
              size="sm"
              leftIcon={<LogOut color={theme.colors.text} size={18} />}
            />
          }
        />
      ) : null}

      {screen === 'list' ? (
        <ProjectListScreen
          error={error}
          loading={loading}
          onCreate={() => setScreen('create')}
          onOpenProject={openDetail}
          onRefresh={() => loadProjects('refresh')}
          profiles={profiles}
          projects={projects}
          refreshing={refreshing}
        />
      ) : null}

      {screen === 'create' ? (
        <ProjectCreateScreen
          onCancel={() => setScreen('list')}
          onCreated={handleCreated}
          profiles={profiles}
          session={session}
          userEmail={session.user.email ?? 'aktueller Nutzer'}
        />
      ) : null}

      {screen === 'detail' && selectedProject ? (
        <ProjectDetailScreen
          autoSyncing={autoSyncing}
          networkOnline={networkOnline}
          onBack={() => {
            setScreen('list');
            loadProjects('refresh');
            refreshTransferCounts().catch(() => undefined);
          }}
          onDeleted={handleProjectDeleted}
          onProjectChanged={handleProjectChanged}
          project={selectedProject}
          profiles={profiles}
          session={session}
          trades={trades}
        />
      ) : null}
    </SafeAreaView>
  );
}
