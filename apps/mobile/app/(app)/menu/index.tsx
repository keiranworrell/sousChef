import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import { useUnread } from "../../../components/UnreadProvider";
import type { Palette } from "../../../lib/theme";

type MenuEntry = {
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  href: string;
};

/**
 * Everything that isn't one of the four tabs.
 *
 * Entries appear here as the screens get built, rather than being listed and
 * disabled. A menu of things you cannot tap tells the user what the app cannot
 * do every time they open it, which is a strange thing to volunteer.
 *
 * Ordered roughly by how often you would reach for them, not by theme: the
 * things with something new in them sit at the top, and the account lives at
 * the bottom where it is easy to find precisely because it never moves.
 *
 * Notifications is not in this list. It is the bell in the header instead —
 * a row that sometimes carries a badge is the one thing on this screen you
 * look for rather than read, and putting it in the top-right corner means it
 * is in the same place whether or not anything is waiting.
 */
const ENTRIES: MenuEntry[] = [
  {
    label: "Feed",
    description: "What the cooks you follow are making",
    icon: "newspaper-outline",
    href: "/(app)/feed",
  },
  {
    label: "Collections",
    description: "Group recipes, and see ones shared with you",
    icon: "albums-outline",
    href: "/(app)/collections",
  },
  {
    label: "Rediscover",
    description: "Things worth cooking again, and ones you never tried",
    icon: "sparkles-outline",
    href: "/(app)/rediscover",
  },
  {
    label: "Cook history",
    description: "Everything you've cooked and rated",
    icon: "time-outline",
    href: "/(app)/cook-history",
  },
  {
    label: "Household",
    description: "The people you share lists and plans with",
    icon: "home-outline",
    href: "/(app)/household",
  },
  {
    label: "Fermentation",
    description: "Long-running batches and their logs",
    icon: "flask-outline",
    href: "/(app)/fermentation",
  },
  {
    label: "Profile",
    description: "How you appear to other cooks",
    icon: "person-outline",
    href: "/(app)/profile",
  },
  {
    label: "Settings",
    description: "Account, security and your data",
    icon: "settings-outline",
    href: "/(app)/settings",
  },
];

export default function MenuScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { unread, refresh } = useUnread();

  // Re-counted when the menu regains focus, which is how the dot clears
  // after a trip to the notifications screen marks everything seen.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <TouchableOpacity
          style={styles.bell}
          onPress={() => router.push("/(app)/notifications")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={
            unread > 0
              ? `Notifications, ${unread} unread`
              : "Notifications"
          }
        >
          <Ionicons name="notifications-outline" size={24} color={palette.accent} />
          {unread > 0 && (
            // A dot, not a count. The number does not change what you do next,
            // and a two-digit pill up here would crowd the title.
            <View style={styles.bellDot} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {ENTRIES.map((entry) => (
          <TouchableOpacity
            key={entry.href}
            style={styles.row}
            onPress={() => router.push(entry.href as never)}
            accessibilityLabel={entry.label}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={entry.icon} size={20} color={palette.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{entry.label}</Text>
              <Text style={styles.rowDescription}>{entry.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.borderStrong} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "700", color: t.text },
  bell: { padding: 4 },
  bellDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.danger,
    // Ringed in the page background so the dot stays a distinct shape against
    // the bell's own outline rather than merging into it.
    borderWidth: 1.5,
    borderColor: t.bg,
  },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: t.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: t.accentSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: "600", color: t.text },
  rowDescription: { marginTop: 2, fontSize: 12, color: t.textFaint },
});
