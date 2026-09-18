import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Household, PublicUserListItem } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { isOwner as isOwnerOf, leaveConsequence } from "../../../lib/household-actions";
import Avatar from "../../../components/Avatar";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import type { Palette } from "../../../lib/theme";

export default function HouseholdScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  // undefined means "not loaded yet"; null means "loaded, and they aren't in
  // one". Collapsing those two would show the create form for a moment on
  // every visit, to someone who already has a household.
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const [householdRes, meRes] = await Promise.all([
          api.households.get(),
          api.users.me(),
        ]);
        if ("error" in householdRes) throw new Error(householdRes.error.message);
        setHousehold(householdRes.data);
        if ("data" in meRes) setCurrentUserId(meRes.data.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load your household");
      }
    }
    void load();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Household</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {household === undefined && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : household === null ? (
        <CreateHousehold onCreated={setHousehold} />
      ) : household ? (
        <HouseholdView
          household={household}
          currentUserId={currentUserId ?? ""}
          onChanged={setHousehold}
          onGone={() => setHousehold(null)}
        />
      ) : null}
    </View>
  );
}

// ── Create ────────────────────────────────────────────────────────────────────

function CreateHousehold({
  onCreated,
}: {
  onCreated: (household: Household) => void;
}): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.households.create(trimmed);
      if ("error" in res) throw new Error(res.error.message);
      onCreated(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that household");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.createBody}>
      <Text style={styles.createTitle}>Create a household</Text>
      <Text style={styles.createBlurb}>
        A household is the people you cook for. Share shopping lists, meal plans
        and collections with everyone in it at once, rather than one by one.
      </Text>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Flat 3"
        placeholderTextColor={palette.textFaint}
        maxLength={60}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.primary, (saving || !name.trim()) && styles.disabled]}
        onPress={() => { void handleCreate(); }}
        disabled={saving || !name.trim()}
      >
        {saving ? <ActivityIndicator color={palette.onAccent} /> : <Text style={styles.primaryText}>Create household</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── View and manage ───────────────────────────────────────────────────────────

function HouseholdView({
  household,
  currentUserId,
  onChanged,
  onGone,
}: {
  household: Household;
  currentUserId: string;
  onChanged: (household: Household) => void;
  onGone: () => void;
}): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const owner = isOwnerOf(household, currentUserId);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(household.name);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRename(): Promise<void> {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === household.name) {
      setRenaming(false);
      setRenameValue(household.name);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const api = await getApiClient();
      const res = await api.households.rename(trimmed);
      if ("error" in res) throw new Error(res.error.message);
      onChanged(res.data);
      setRenaming(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't rename that");
    } finally {
      setBusy(false);
    }
  }

  function confirmLeave(): void {
    const { title, message, destructive } = leaveConsequence(household, currentUserId);
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: destructive ? "Leave and delete" : "Leave",
        style: "destructive",
        onPress: () => { void run(async (api) => { await api.households.leave(); }); },
      },
    ]);
  }

  function confirmDelete(): void {
    Alert.alert(
      `Delete ${household.name}?`,
      "Everything shared through this household goes with it — shopping lists, meal plans and collections. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => { void run(async (api) => { await api.households.delete(); }); },
        },
      ],
    );
  }

  /** Both leaving and deleting end with the user having no household. */
  async function run(
    action: (api: Awaited<ReturnType<typeof getApiClient>>) => Promise<void>,
  ): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      const api = await getApiClient();
      await action(api);
      onGone();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* Name */}
      {renaming ? (
        <View style={styles.renameRow}>
          <TextInput
            style={[styles.input, styles.renameInput]}
            value={renameValue}
            onChangeText={setRenameValue}
            maxLength={60}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.small, busy && styles.disabled]}
            onPress={() => { void handleRename(); }}
            disabled={busy}
          >
            <Text style={styles.smallText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallGhost}
            onPress={() => { setRenaming(false); setRenameValue(household.name); }}
            disabled={busy}
          >
            <Text style={styles.smallGhostText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.nameRow}>
          <Text style={styles.householdName}>{household.name}</Text>
          {owner && (
            <TouchableOpacity
              onPress={() => { setRenameValue(household.name); setRenaming(true); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Rename household"
            >
              <Ionicons name="pencil-outline" size={16} color={palette.textFaint} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <Text style={styles.memberCount}>
        {household.members.length} {household.members.length === 1 ? "member" : "members"}
      </Text>

      {actionError && <Text style={styles.error}>{actionError}</Text>}

      {/* Members */}
      <Text style={styles.sectionLabel}>Members</Text>
      <View style={styles.card}>
        {household.members.map((member, index) => (
          <View key={member.id} style={[styles.memberRow, index > 0 && styles.divided]}>
            <Avatar displayName={member.displayName} avatarUrl={member.avatarUrl} />
            <Text style={styles.memberName} numberOfLines={1}>{member.displayName}</Text>
            {member.userId === household.ownerId && (
              <Text style={styles.ownerBadge}>Owner</Text>
            )}
          </View>
        ))}
      </View>

      <InviteSearch household={household} />

      {/* Manage */}
      <Text style={styles.sectionLabel}>Manage</Text>
      <View style={styles.manageRow}>
        <TouchableOpacity
          style={[styles.secondary, busy && styles.disabled]}
          onPress={confirmLeave}
          disabled={busy}
        >
          <Text style={styles.secondaryText}>Leave household</Text>
        </TouchableOpacity>
        {owner && (
          <TouchableOpacity
            style={[styles.danger, busy && styles.disabled]}
            onPress={confirmDelete}
            disabled={busy}
          >
            <Text style={styles.dangerText}>Delete household</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

// ── Invite ────────────────────────────────────────────────────────────────────

function InviteSearch({ household }: { household: Household }): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const memberIds = new Set(household.members.map((m) => m.userId));

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUserListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string): Promise<void> => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.users.search({ q, limit: 8 });
      if ("error" in res) throw new Error(res.error.message);
      setResults(res.data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced: a phone keyboard produces a request per keystroke otherwise, and
  // the later ones can land out of order and overwrite the right answer.
  useEffect(() => {
    const timer = setTimeout(() => { void search(query); }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  async function invite(userId: string): Promise<void> {
    setInvitingId(userId);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.households.invite(userId);
      if ("error" in res) throw new Error(res.error.message);
      setInvited((prev) => new Set([...prev, userId]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that invite");
    } finally {
      setInvitingId(null);
    }
  }

  return (
    <>
      <Text style={styles.sectionLabel}>Invite someone</Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name…"
        placeholderTextColor={palette.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      {searching && <Text style={styles.searchHint}>Searching…</Text>}

      {results.length > 0 && (
        <View style={styles.card}>
          {results.map((user, index) => {
            const already = memberIds.has(user.id);
            const sent = invited.has(user.id);
            return (
              <View key={user.id} style={[styles.memberRow, index > 0 && styles.divided]}>
                <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} size={32} />
                <Text style={styles.memberName} numberOfLines={1}>{user.displayName}</Text>
                {already ? (
                  <Text style={styles.rowNote}>Already a member</Text>
                ) : sent ? (
                  <Text style={styles.rowSent}>Invited ✓</Text>
                ) : (
                  <TouchableOpacity
                    style={[styles.small, invitingId === user.id && styles.disabled]}
                    onPress={() => { void invite(user.id); }}
                    disabled={invitingId === user.id}
                  >
                    <Text style={styles.smallText}>
                      {invitingId === user.id ? "Inviting…" : "Invite"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {!searching && query.trim() !== "" && results.length === 0 && (
        <Text style={styles.searchHint}>Nobody by that name.</Text>
      )}

      <Text style={styles.inviteFootnote}>
        They'll get a notification and can accept or decline it.
      </Text>
    </>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: t.text },
  body: { padding: 16, paddingBottom: 48, gap: 10 },

  createBody: { padding: 16, paddingTop: 24, gap: 12 },
  createTitle: { fontSize: 18, fontWeight: "700", color: t.text },
  createBlurb: { fontSize: 13, color: t.textMuted, lineHeight: 20, marginBottom: 4 },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  householdName: { fontSize: 20, fontWeight: "700", color: t.text },
  memberCount: { fontSize: 13, color: t.textFaint, marginBottom: 8 },
  renameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  renameInput: { flex: 1 },

  sectionLabel: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: "700",
    color: t.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 12 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  divided: { borderTopWidth: 1, borderTopColor: t.border },
  memberName: { flex: 1, minWidth: 0, fontSize: 14, color: t.text, fontWeight: "500" },
  ownerBadge: {
    fontSize: 11,
    color: t.textFaint,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rowNote: { fontSize: 12, color: t.textFaint },
  rowSent: { fontSize: 12, fontWeight: "600", color: t.accent },
  searchHint: { fontSize: 12, color: t.textFaint, paddingVertical: 6 },
  inviteFootnote: { fontSize: 12, color: t.textFaint, marginTop: 8, lineHeight: 17 },

  manageRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },

  input: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: t.text,
    backgroundColor: t.surface,
  },
  primary: { backgroundColor: t.accent, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: t.onAccent, fontWeight: "600", fontSize: 14 },
  secondary: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: t.surface,
  },
  secondaryText: { color: t.textSecondary, fontWeight: "600", fontSize: 13 },
  danger: {
    borderWidth: 1,
    borderColor: t.dangerBorder,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: t.surface,
  },
  dangerText: { color: t.danger, fontWeight: "600", fontSize: 13 },
  small: { backgroundColor: t.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  smallText: { color: t.onAccent, fontWeight: "600", fontSize: 12 },
  smallGhost: { borderWidth: 1, borderColor: t.borderStrong, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  smallGhostText: { color: t.textSecondary, fontWeight: "600", fontSize: 12 },
  disabled: { opacity: 0.5 },
  error: { color: t.danger, fontSize: 13, paddingHorizontal: 16, paddingVertical: 4 },
});
