import React, { useCallback, useEffect, useRef, useState } from "react";
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
import type { CommunityRecipe, UserProfile } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { canFollow, toggleFollow } from "../../../lib/follow-state";
import Avatar from "../../../components/Avatar";
import FollowButton from "../../../components/FollowButton";
import UserListSheet, { type UserListKind } from "../../../components/UserListSheet";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import type { Palette } from "../../../lib/theme";

export default function PublicProfileScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ownUserId, setOwnUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const inFlight = useRef(false);

  const [panel, setPanel] = useState<UserListKind | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const [profileRes, meRes] = await Promise.all([
          api.users.profile(id),
          api.users.me(),
        ]);
        if ("error" in profileRes) throw new Error(profileRes.error.message);
        setProfile(profileRes.data);
        if ("data" in meRes) setOwnUserId(meRes.data.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load that profile");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  const loadRecipes = useCallback(
    async (pageCursor: string | null): Promise<void> => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (pageCursor !== null) setLoadingMore(true);
      try {
        const api = await getApiClient();
        // creatorId, not creator: the name is not unique and this screen is
        // about one specific person.
        const res = await api.community.list({
          creatorId: id,
          cursor: pageCursor ?? undefined,
        });
        if ("error" in res) throw new Error(res.error.message);
        setRecipes((prev) =>
          pageCursor === null ? res.data.recipes : [...prev, ...res.data.recipes],
        );
        setCursor(res.data.nextCursor);
        setHasMore(res.data.nextCursor !== null);
      } catch {
        // The profile is the point of this screen; a failed recipe page should
        // not replace it with an error. Stop paging and leave what loaded.
        setHasMore(false);
      } finally {
        setLoadingMore(false);
        inFlight.current = false;
      }
    },
    [id],
  );

  useEffect(() => { void loadRecipes(null); }, [loadRecipes]);

  async function handleFollow(): Promise<void> {
    if (!profile) return;
    setFollowBusy(true);
    const wasFollowing = profile.isFollowing;
    setProfile(toggleFollow(profile));
    try {
      const api = await getApiClient();
      const res = wasFollowing
        ? await api.users.unfollow(profile.id)
        : await api.users.follow(profile.id);
      if ("error" in res) throw new Error(res.error.message);
    } catch (err) {
      // Toggling the same value back is exactly the inverse, which is why the
      // counter arithmetic lives in one tested place.
      setProfile((prev) => (prev ? toggleFollow(prev) : prev));
      setError(err instanceof Error ? err.message : "Couldn't update that follow");
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Profile not found"}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={recipes}
        keyExtractor={(r) => r.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!hasMore || inFlight.current) return;
          void loadRecipes(cursor);
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.back}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.identity}>
              <Avatar displayName={profile.displayName} avatarUrl={profile.avatarUrl} size={64} />
              <View style={styles.identityText}>
                <Text style={styles.name}>{profile.displayName}</Text>
                <View style={styles.counts}>
                  <TouchableOpacity onPress={() => setPanel("followers")}>
                    <Text style={styles.count}>
                      <Text style={styles.countValue}>{profile.followerCount}</Text>
                      {profile.followerCount === 1 ? " follower" : " followers"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPanel("following")}>
                    <Text style={styles.count}>
                      <Text style={styles.countValue}>{profile.followingCount}</Text> following
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

            {canFollow(profile.id, ownUserId) && (
              <View style={styles.followRow}>
                <FollowButton
                  isFollowing={profile.isFollowing}
                  busy={followBusy}
                  onPress={() => { void handleFollow(); }}
                />
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.sectionLabel}>
              {recipes.length > 0 ? "Public recipes" : ""}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {profile.displayName} hasn't shared any recipes yet.
          </Text>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={palette.accent} style={styles.footer} /> : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/community/${item.id}`)}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.cardImage}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {item.likeCount} {item.likeCount === 1 ? "like" : "likes"}
            </Text>
          </TouchableOpacity>
        )}
      />

      <UserListSheet
        target={panel ? { userId: profile.id, kind: panel } : null}
        ownUserId={ownUserId}
        onClose={() => setPanel(null)}
      />
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg },
  list: { padding: 16, paddingBottom: 40 },
  column: { gap: 12 },
  header: { gap: 12, marginBottom: 12 },
  back: { alignSelf: "flex-start", paddingVertical: 4 },
  backText: { fontSize: 14, fontWeight: "600", color: t.accent },
  identity: { flexDirection: "row", alignItems: "center", gap: 16 },
  identityText: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 20, fontWeight: "700", color: t.text },
  counts: { flexDirection: "row", gap: 16 },
  count: { fontSize: 13, color: t.textMuted },
  countValue: { fontWeight: "700", color: t.text },
  bio: { fontSize: 14, color: t.textSecondary, lineHeight: 20 },
  followRow: { flexDirection: "row" },
  sectionLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: t.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    flex: 1,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  cardImage: { width: "100%", height: 96, borderRadius: 8, backgroundColor: t.surfaceSunken },
  cardTitle: { fontSize: 13, fontWeight: "600", color: t.text },
  cardMeta: { fontSize: 11, color: t.textFaint },
  empty: { paddingVertical: 32, textAlign: "center", fontSize: 13, color: t.textFaint },
  footer: { paddingVertical: 16 },
  error: { color: t.danger, fontSize: 13 },
});
