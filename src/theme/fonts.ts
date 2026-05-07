import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { Saira_600SemiBold, Saira_700Bold } from '@expo-google-fonts/saira';
import { useFonts } from 'expo-font';

/**
 * Load Phase 3 type pair before first paint.
 * Returned `loaded` flag is consumed by AppRoot to gate render.
 */
export function useAppFonts() {
  const [loaded] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    Saira_600SemiBold,
    Saira_700Bold,
  });
  return loaded;
}
