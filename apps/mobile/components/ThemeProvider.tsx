import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { paletteFor, type Palette, type ThemeName } from "../lib/theme";
import {
  THEME_PREFERENCE_KEY,
  parsePreference,
  resolveTheme,
  type ThemePreference,
} from "../lib/theme-preference";

type ThemeContextValue = {
  /** The theme being rendered right now. */
  theme: ThemeName;
  /** The colours for it. */
  palette: Palette;
  /** What the user chose, which may be "system". */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  palette: paletteFor("light"),
  preference: "system",
  setPreference: () => undefined,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Styles that depend on the theme.
 *
 * Every screen's `StyleSheet.create` used to run once at module scope, which
 * is why none of them could be themed: module scope has no access to a React
 * context. They are now factories taking a palette, and this calls them.
 *
 * `factory` must be defined at module scope, not inline in the component — an
 * inline arrow is a new function on every render, so the memo would never hit
 * and every stylesheet would be rebuilt on every keystroke.
 */
export function useThemedStyles<T>(factory: (palette: Palette) => T): T {
  const { palette } = useTheme();
  return useMemo(() => factory(palette), [factory, palette]);
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // Read the stored choice once. Until it arrives the default is "system",
  // which is what most people want anyway — so the common case renders
  // correctly from the first frame and only an explicit override can flicker.
  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (!cancelled) setPreferenceState(parsePreference(stored));
      } catch {
        // Unreadable storage is not worth an error on screen; "system" stands.
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const setPreference = useCallback((next: ThemePreference): void => {
    // State first, write second. The tap should land immediately, and a failed
    // write costs the choice next launch, not this one.
    setPreferenceState(next);
    void AsyncStorage.setItem(THEME_PREFERENCE_KEY, next).catch(() => undefined);
  }, []);

  const theme = resolveTheme(preference, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, palette: paletteFor(theme), preference, setPreference }),
    [theme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
