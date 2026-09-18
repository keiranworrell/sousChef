import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiClient } from "../../../lib/api";

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
 */
const ENTRIES: MenuEntry[] = [
  {
    label: "Notifications",
    description: "Invites and collections shared with you",
    icon: "notifications-outline",
    href: "/(app)/notifications",
  },
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  /**
   * The unread count, refreshed whenever the menu comes back into focus.
   *
   * There is no count endpoint, so this reads the list and counts locally.
   * That is fine at the sizes involved and avoids inventing a second source of
   * truth, but it is worth knowing it is a full fetch rather than a cheap one.
   *
   * A failure is swallowed on purpose: the badge is a nicety, and a menu that
   * shows an error banner because a count did not load is worse than a menu
   * with no badge.
   */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function count(): Promise<void> {
        try {
          const api = await getApiClient();
          const res = await api.notifications.list();
          if (cancelled || "error" in res) return;
          setUnread(res.data.notifications.filter((n) => n.seenAt === null).length);
        } catch {
          // Deliberately ignored — see above.
        }
      }
      void count();
      return () => { cancelled = true; };
    }, []),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {ENTRIES.map((entry) => {
          const badge = entry.href === "/(app)/notifications" && unread > 0 ? unread : 0;
          return (
            <TouchableOpacity
              key={entry.href}
              style={styles.row}
              onPress={() => router.push(entry.href as never)}
              accessibilityLabel={
                badge > 0
                  ? `${entry.label}, ${badge} unread`
                  : entry.label
              }
            >
              <View style={styles.iconWrap}>
                <Ionicons name={entry.icon} size={20} color="#f97316" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{entry.label}</Text>
                <Text style={styles.rowDescription}>{entry.description}</Text>
              </View>
              {badge > 0 && (
                <View style={styles.badge}>
                  {/* Capped, because the pill stops being round after two
                      digits and the exact number stops mattering long before
                      then. */}
                  <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: "600", color: "#111827" },
  rowDescription: { marginTop: 2, fontSize: 12, color: "#9ca3af" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
