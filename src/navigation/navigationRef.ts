import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function resetToResetPassword(): void {
  if (!navigationRef.isReady()) {
    return;
  }
  navigationRef.reset({
    index: 0,
    routes: [{ name: 'Auth', params: { screen: 'ResetPassword' } }],
  });
}

export function resetToLogin(): void {
  if (!navigationRef.isReady()) {
    return;
  }
  navigationRef.reset({
    index: 0,
    routes: [{ name: 'Auth', params: { screen: 'Login' } }],
  });
}
