import type { NavigatorScreenParams } from '@react-navigation/native';

import type { Project } from '../types/projects';

export type AuthStackParamList = {
  Login: undefined;
  ResetPassword: undefined;
};

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectCreate: undefined;
  ProjectDetail: { projectId: string };
  ProjectEdit: { projectId: string };
  EntryCreate: { projectId: string };
  EntriesList: { projectId: string };
  PlanViewer: { projectId: string; planId?: string };
  Report: { projectId: string };
};

export type AppTabParamList = {
  ProjectsTab: NavigatorScreenParams<ProjectsStackParamList>;
  MoreTab: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppTabParamList>;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

export type ProjectListItem = Project;
