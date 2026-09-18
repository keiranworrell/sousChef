/**
 * Trailing space for the tab bar, which overlays the bottom of every screen.
 *
 * Every screen in this app is a tab route — including the ones hidden from the
 * bar with `href: null` — so the bar is drawn over all of them. expo-router 57
 * moved off `@react-navigation/bottom-tabs` to `standard-navigation`, which has
 * no equivalent of `useBottomTabBarHeight`, so there is nothing to measure
 * against. This is an allowance, and calling it one is more useful than
 * pretending it was derived.
 *
 * It only has to be generous. As trailing padding on a scroll view, too much
 * costs an unnoticed gap below the last control; too little cuts that control
 * in half, which is what it did to "Sign out" in settings and to "Cancel" on
 * the new-recipe form. Add `useSafeAreaInsets().bottom` to it — the gesture bar
 * varies by device, this does not.
 */
export const TAB_BAR_ALLOWANCE = 76;
