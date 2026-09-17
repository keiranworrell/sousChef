import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Padding for a screen that renders its own header rather than using a
 * navigator's.
 *
 * Android 16 (API 36) enforces edge-to-edge and removes the opt-out, so content
 * starts at pixel zero — under the clock and the battery icon. Several screens
 * currently carry a hardcoded `paddingTop: 16` or `20`, which was correct while
 * the system inset a window for us and is wrong now.
 *
 * The base value keeps the spacing those screens were designed with; the inset
 * is added on top rather than replacing it, so the gap below the status bar
 * still looks deliberate instead of flush.
 *
 * Screens still to migrate, each replacing a hardcoded paddingTop:
 *   (app)/recipes/index.tsx        header
 *   (app)/shopping/index.tsx       container
 *   (app)/shopping/[id].tsx        header
 *   (app)/fermentation/index.tsx   container
 *   (app)/community/index.tsx      container
 *   (app)/meal-plan/index.tsx      container
 *
 * Screens inside a navigator with a visible header don't need this — React
 * Navigation applies the inset itself, given a SafeAreaProvider at the root.
 */
export function useScreenTopPadding(base = 16): number {
  const insets = useSafeAreaInsets();
  return insets.top + base;
}

/**
 * Bottom padding for a scroll view whose content would otherwise end underneath
 * the gesture bar.
 *
 * Only needed where a screen paints to the bottom edge itself. The tab bar
 * already accounts for its own inset.
 */
export function useScreenBottomPadding(base = 16): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + base;
}
