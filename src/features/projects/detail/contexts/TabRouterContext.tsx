import { createContext, useContext, type ReactNode } from 'react';

import type { WorkspaceTab } from '../types';

export type TabRouterValue = {
  activeTab: WorkspaceTab;
  navigateToTab: (tab: WorkspaceTab) => void;
};

const TabRouterContext = createContext<TabRouterValue | null>(null);

export function TabRouterProvider({
  value,
  children,
}: {
  value: TabRouterValue;
  children: ReactNode;
}) {
  return <TabRouterContext.Provider value={value}>{children}</TabRouterContext.Provider>;
}

export function useTabRouter(): TabRouterValue {
  const ctx = useContext(TabRouterContext);
  if (!ctx) {
    throw new Error('useTabRouter must be used within a TabRouterProvider');
  }
  return ctx;
}
