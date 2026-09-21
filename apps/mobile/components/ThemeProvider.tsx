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
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
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

/**
 * Hold the splash until we know which theme to draw.
 *
 * The preference lives in AsyncStorage, which cannot be read synchronously, so
 * the first frames used to render as "system" and then correct themselves.
 * Someone who had chosen Dark on a light-mode phone got a bright flash every
 * launch.
 *
 * The splash already has a dark variant (`userInterfaceStyle: "automatic"`),
 * so keeping it up across that gap covers it with something deliberately
 * coloured instead of whatever the window background happens to be.
 *
 * Failures are swallowed: on a config where the splash is already gone this
 * throws, and a theme provider that refuses to mount because of it would take
 * the whole app down.
 */
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * How long to hold it before giving up and showing the app anyway.
 *
 * Bounded deliberately. An unbounded wait on storage is exactly the shape of
 * the cold-start bug that took four builds to find: a promise that never
 * settles, a splash that never lifts, and no way out but reinstalling. A wrong
 * theme for one frame is a far better failure than a dead launch.
 */
const THEME_LOAD_TIMEOUT_MS = 1500;

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [loaded, setLoaded] = useState(false);

  // Read the stored choice once, with the splash held over it.
  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const stored = await Promise.race([
          AsyncStorage.getItem(THEME_PREFERENCE_KEY),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), THEME_LOAD_TIMEOUT_MS)),
        ]);
        if (!cancelled) setPreferenceState(parsePreference(stored));
      } catch {
        // Unreadable storage is not worth an error on screen; "system" stands.
      } finally {
        if (!cancelled) setLoaded(true);
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
  const palette = paletteFor(theme);

  /**
   * The native window background, which is what shows through any gap React
   * is not currently filling: between the splash lifting and the first screen
   * mounting, and behind a screen transition.
   *
   * `expo-system-ui` has been a declared dependency all along and was never
   * called, so that background stayed the platform default — white. That is
   * the bright flash on launch, and it is not something a React style can
   * reach, because it sits underneath React entirely.
   */
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palette.bg).catch(() => undefined);
  }, [palette.bg]);

  // Only once the theme is known, so the splash covers the gap rather than the
  // app appearing in the wrong colours and correcting itself a frame later.
  useEffect(() => {
    if (!loaded) return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, palette, preference, setPreference }),
    [theme, palette, preference, setPreference],
  );

  // Nothing rendered until the theme is settled. The splash is still up, so
  // this is not a blank screen — it is the launch image staying put for the
  // few milliseconds a storage read takes.
  if (!loaded) return <ThemeContext.Provider value={value}>{null}</ThemeContext.Provider>;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
