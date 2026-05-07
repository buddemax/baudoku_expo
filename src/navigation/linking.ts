import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from './types';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'bba-baudoku://'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          ResetPassword: 'reset-password',
        },
      },
      App: {
        screens: {
          ProjectsTab: {
            screens: {
              ProjectsList: 'projects',
              ProjectDetail: 'projects/:projectId',
              EntryCreate: 'projects/:projectId/entries/new',
              EntriesList: 'projects/:projectId/entries',
              PlanViewer: 'projects/:projectId/plans/:planId?',
              Report: 'projects/:projectId/report',
              ProjectCreate: 'projects/new',
              ProjectEdit: 'projects/:projectId/edit',
            },
          },
          MoreTab: 'more',
        },
      },
    },
  },
};

export type RecoverySession = {
  accessToken: string;
  refreshToken: string;
};

export const parseRecoveryUrl = (url: string): RecoverySession | null => {
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
  return { accessToken, refreshToken };
};
