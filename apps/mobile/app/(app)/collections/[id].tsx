import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { CollectionWithItems } from "@souschef/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiClient } from "../../../lib/api";
import { TAB_BAR_ALLOWANCE } from "../../../lib/tab-bar";
import { permissionsFor } from "../../../lib/collection-access";
import SharePanel from "../../../components/SharePanel";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import type { Palette } from "../../../lib/theme";

export default function CollectionDetailScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [collection, setCollection] = useState<CollectionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const api = await getApiClient();
      const res = await api.collections.get(id);
      if ("error" in res) throw new Error(res.error.message);
      setCollection(res.data);
      setName(res.data.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that collection");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleRename(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || !collection) return;
    setSaving(true);
    setActionError(null);
    try {
      const api = await getApiClient();
      const res = await api.collections.update(id, { name: trimmed });
      if ("error" in res) throw new Error(res.error.message);
      setCollection({ ...collection, name: res.data.name });
      setRenaming(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't rename it");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveRecipe(recipeId: string): Promise<void> {
    if (!collection) return;
    setRemovingId(recipeId);
    setActionError(null);
    try {
      const api = await getApiClient();
      const res = await api.collections.removeRecipe(id, recipeId);
      if ("error" in res) throw new Error(res.error.message);
      setCollection({
        ...collection,
        items: collection.items.filter((i) => i.recipeId !== recipeId),
        recipeCount: Math.max(0, collection.recipeCount - 1),
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't remove that recipe");
    } finally {
      setRemovingId(null);
    }
  }

  function confirmDelete(): void {
    Alert.alert(
      "Delete this collection?",
      // Said explicitly because it is the obvious fear, and the answer is
      // reassuring: a collection is a grouping, not a container.
      "The recipes in it are not deleted — they stay in your library.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => { void handleDelete(); } },
      ],
    );
  }

  async function handleDelete(): Promise<void> {
    setActionError(null);
    try {
      const api = await getApiClient();
      const res = await api.collections.delete(id);
      if ("error" in res) throw new Error(res.error.message);
      router.back();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't delete it");
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (error || !collection) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.error}>{error ?? "Not found"}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const can = permissionsFor(collection.access);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + TAB_BAR_ALLOWANCE },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>← Collections</Text>
      </TouchableOpacity>

      {renaming ? (
        <View style={styles.renameRow}>
          <TextInput
            style={[styles.input, styles.grow]}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={255}
          />
          <TouchableOpacity
            style={[styles.primarySmall, (saving || !name.trim()) && styles.disabled]}
            onPress={() => { void handleRename(); }}
            disabled={saving || !name.trim()}
          >
            {saving ? <ActivityIndicator color={palette.onAccent} /> : <Text style={styles.primaryText}>Save</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setName(collection.name); setRenaming(false); }}>
            <Text style={styles.link}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.titleRow}>
          <Text style={styles.title}>{collection.name}</Text>
          {can.canEditCollection && (
            <TouchableOpacity onPress={() => setRenaming(true)}>
              <Text style={styles.link}>Rename</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.meta}>
        {collection.recipeCount} {collection.recipeCount === 1 ? "recipe" : "recipes"}
        {collection.ownerName ? ` · from ${collection.ownerName}` : ""}
        {collection.access === "viewer" ? " · view only" : ""}
        {collection.access === "editor" ? " · you can add recipes" : ""}
      </Text>

      {actionError && <Text style={styles.error}>{actionError}</Text>}

      {collection.items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing in here yet.</Text>
          {can.canEditRecipes && (
            <Text style={styles.emptyHint}>
              Open a recipe and use &quot;Add to collection&quot; to put it here.
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.items}>
          {collection.items.map((item) => (
            <View key={item.recipeId} style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => router.push(`/(app)/recipes/${item.recipeId}`)}
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
                  <Text style={styles.cardMeta}>
                    {[
                      item.cuisine,
                      item.cookTimeMinutes ? `${item.cookTimeMinutes} min` : null,
                      item.difficulty,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              </TouchableOpacity>

              {can.canEditRecipes && (
                <TouchableOpacity
                  onPress={() => { void handleRemoveRecipe(item.recipeId); }}
                  disabled={removingId === item.recipeId}
                  style={styles.remove}
                  accessibilityLabel={`Remove ${item.title} from this collection`}
                >
                  {removingId === item.recipeId
                    ? <ActivityIndicator color={palette.textFaint} size="small" />
                    : <Text style={styles.removeText}>✕</Text>}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {can.canShare && <SharePanel collectionId={id} isPublic={collection.isPublic} />}

      {can.canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
          <Text style={styles.deleteText}>Delete collection</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: { alignItems: "center", justifyContent: "center", gap: 10 },
  content: { padding: 16, gap: 12 },
  link: { fontSize: 14, color: t.accent, fontWeight: "500" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: "700", color: t.text },
  meta: { fontSize: 12, color: t.textFaint },
  renameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  grow: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: t.text,
    backgroundColor: t.surface,
  },
  items: { gap: 10, marginTop: 4 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    padding: 10,
  },
  cardMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: t.surfaceSunken },
  thumbEmpty: { borderWidth: 1, borderColor: t.border },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: t.text },
  cardMeta: { marginTop: 2, fontSize: 12, color: t.textFaint },
  remove: { paddingHorizontal: 8, paddingVertical: 8 },
  removeText: { fontSize: 15, color: t.textFaint },
  empty: { paddingVertical: 36, alignItems: "center", gap: 6 },
  emptyText: { fontSize: 15, fontWeight: "600", color: t.textSecondary },
  emptyHint: { fontSize: 13, color: t.textFaint, textAlign: "center" },
  primarySmall: { backgroundColor: t.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  primaryText: { color: t.onAccent, fontWeight: "600", fontSize: 14 },
  deleteButton: { marginTop: 8, alignItems: "center", paddingVertical: 12 },
  deleteText: { color: t.danger, fontWeight: "600", fontSize: 14 },
  error: { color: t.danger, fontSize: 13 },
  disabled: { opacity: 0.5 },
});
