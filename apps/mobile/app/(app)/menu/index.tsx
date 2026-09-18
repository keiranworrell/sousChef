import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MenuEntry = {
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  href: string;
};

/**
 * Everything that isn't one of the four tabs.
 *
 * The web app's overflow menu has seven destinations; mobile has screens for
 * two of them. The other five — collections, cook history, rediscover,
 * household, feed — are listed nowhere here rather than listed and disabled.
 * A menu of things you cannot tap tells the user what the app cannot do every
 * time they open it, which is a strange thing to volunteer. This list grows as
 * the screens get built.
 */
const ENTRIES: MenuEntry[] = [
  {
    label: "Fermentation",
    description: "Long-running batches and their logs",
    icon: "flask-outline",
    href: "/(app)/fermentation",
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {ENTRIES.map((entry) => (
          <TouchableOpacity
            key={entry.href}
            style={styles.row}
            onPress={() => router.push(entry.href as never)}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={entry.icon} size={20} color="#f97316" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{entry.label}</Text>
              <Text style={styles.rowDescription}>{entry.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        ))}
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
});
