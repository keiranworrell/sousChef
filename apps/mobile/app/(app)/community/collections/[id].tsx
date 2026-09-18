import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PublicCollectionWithItems } from "@souschef/shared";
import { getApiClient } from "../../../../lib/api";
import { useTheme, useThemedStyles } from "../../../../components/ThemeProvider";
import type { Palette } from "../../../../lib/theme";

/**
 * Someone else's public collection.
 *
 * Read-only by construction: the endpoint is the public one, and nothing here
 * offers to add, remove or rename. A viewer's own collections live under the
 * Menu, and conflating the two would put edit controls on a screen where every
 * one of them would be refused.
 */
export default function PublicCollectionScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [collection, setCollection] = useState<PublicCollectionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.collections.getPublic(id);
        if ("error" in res) throw new Error(res.error.message);
        setCollection(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load that collection");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (error || !collection) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Collection not found"}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={collection.items}
        keyExtractor={(item) => item.recipeId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.back}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{collection.name}</Text>
            <TouchableOpacity onPress={() => router.push(`/(app)/users/${collection.ownerId}`)}>
              <Text style={styles.owner}>by {collection.ownerName}</Text>
            </TouchableOpacity>
            {collection.description && (
              <Text style={styles.description}>{collection.description}</Text>
            )}
            <Text style={styles.count}>
              {collection.recipeCount} {collection.recipeCount === 1 ? "recipe" : "recipes"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Nothing in this collection yet.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            // The community route, not the private one: these are someone
            // else's recipes and the app cannot open them as if they were
            // yours.
            onPress={() => router.push(`/(app)/community/${item.recipeId}`)}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.thumb}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]} />
            )}
            <View style={styles.cardText}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              {(item.cuisine || item.cookTimeMinutes) && (
                <Text style={styles.cardMeta}>
                  {item.cuisine ?? ""}
                  {item.cuisine && item.cookTimeMinutes ? " · " : ""}
                  {item.cookTimeMinutes ? `${item.cookTimeMinutes} min` : ""}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: t.bg,
  },
  list: { padding: 16, gap: 10 },
  header: { gap: 6, marginBottom: 8 },
  back: { alignSelf: "flex-start", paddingVertical: 4 },
  backText: { fontSize: 14, fontWeight: "600", color: t.accent },
  title: { fontSize: 22, fontWeight: "700", color: t.text },
  owner: { fontSize: 13, fontWeight: "600", color: t.accent },
  description: { fontSize: 13, color: t.textMuted, lineHeight: 19, marginTop: 2 },
  count: { fontSize: 12, color: t.textFaint, marginTop: 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    padding: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: t.surfaceSunken },
  thumbEmpty: { borderWidth: 1, borderColor: t.border },
  cardText: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: t.text },
  cardMeta: { fontSize: 12, color: t.textFaint },
  empty: { paddingVertical: 40, textAlign: "center", fontSize: 13, color: t.textFaint },
  error: { color: t.danger, fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
});
