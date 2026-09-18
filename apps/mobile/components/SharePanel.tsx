import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import type {
  CollectionShare,
  CollectionShareRole,
  Household,
  PublicUserListItem,
} from "@souschef/shared";
import { getApiClient } from "../lib/api";

const ROLE_LABEL: Record<CollectionShareRole, string> = {
  viewer: "Can view",
  editor: "Can add and remove",
};

type Props = {
  collectionId: string;
  /** Drives the editor warning — the consequence differs on a public collection. */
  isPublic?: boolean;
};

/**
 * Sharing a collection with a person or a household.
 *
 * Owner-only; the detail screen decides whether to render this at all. Access
 * granted here reaches outside the household, so the role picker says what each
 * one actually permits rather than naming it and leaving the reader to guess.
 */
export default function SharePanel({ collectionId, isPublic = false }: Props): React.JSX.Element {
  const [shares, setShares] = useState<CollectionShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<CollectionShareRole>("viewer");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUserListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  // Distinct from `household === null`, which is also true while the request is
  // in flight. Without it the "you have no household" hint flashes up on every
  // open, including for people who do have one.
  const [householdChecked, setHouseholdChecked] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadShares = useCallback(async (): Promise<void> => {
    try {
      const api = await getApiClient();
      const res = await api.collections.shares(collectionId);
      if ("error" in res) throw new Error(res.error.message);
      setShares(res.data.shares);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load who this is shared with");
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    void loadShares();
    async function loadHousehold(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.households.get();
        if ("data" in res) setHousehold(res.data);
      } catch {
        // Not being in a household is normal, not an error worth showing.
      } finally {
        setHouseholdChecked(true);
      }
    }
    void loadHousehold();
  }, [loadShares]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const api = await getApiClient();
          const res = await api.users.search({ q, limit: 8 });
          if ("data" in res) setResults(res.data.users);
        } catch {
          // A failed search shows no results rather than an error — the user is
          // mid-typing and a message under the box would flash on every keystroke.
        } finally {
          setSearching(false);
        }
      })();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function share(
    target: { userId: string } | { householdId: string },
    key: string,
  ): Promise<void> {
    setBusyId(key);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.collections.share(collectionId, { ...target, role });
      if ("error" in res) throw new Error(res.error.message);
      setQuery("");
      setResults([]);
      await loadShares();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't share it");
    } finally {
      setBusyId(null);
    }
  }

  function confirmRevoke(shareItem: CollectionShare): void {
    const who = shareItem.user?.displayName ?? shareItem.household?.name ?? "them";
    Alert.alert("Remove access?", `${who} will no longer see this collection.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => { void revoke(shareItem.id); },
      },
    ]);
  }

  async function revoke(shareId: string): Promise<void> {
    setBusyId(shareId);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.collections.revokeShare(collectionId, shareId);
      if ("error" in res) throw new Error(res.error.message);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove access");
    } finally {
      setBusyId(null);
    }
  }

  const alreadyShared = new Set(
    shares.map((s) => s.user?.id ?? s.household?.id).filter(Boolean) as string[],
  );

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Sharing</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.roles}>
        {(["viewer", "editor"] as const).map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRole(r)}
            accessibilityRole="radio"
            accessibilityState={{ selected: role === r }}
            style={[styles.role, role === r && styles.roleActive]}
          >
            <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
              {ROLE_LABEL[r]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* What "editor" costs differs by whether the collection is public, and
          the difference matters enough to say out loud before they pick it. */}
      {role === "editor" && (
        <Text style={styles.hint}>
          {isPublic
            ? "This collection is public, so editors can't add to it — adding would publish their own recipe. They'll be able to remove recipes only."
            : "Editors can add their own recipes here. Anything they add becomes readable by everyone this collection is shared with."}
        </Text>
      )}

      {household && !alreadyShared.has(household.id) && (
        <TouchableOpacity
          style={styles.targetRow}
          onPress={() => { void share({ householdId: household.id }, household.id); }}
          disabled={busyId === household.id}
        >
          <View style={styles.targetText}>
            <Text style={styles.targetName}>{household.name}</Text>
            <Text style={styles.targetMeta}>Your household</Text>
          </View>
          {busyId === household.id
            ? <ActivityIndicator color="#f97316" size="small" />
            : <Text style={styles.link}>Share</Text>}
        </TouchableOpacity>
      )}

      {/* Until this release the phone could share *with* a household but had no
          screen to make one, so there was nothing useful to say here. There is
          now. */}
      {householdChecked && !household && (
        <Text style={styles.hint}>
          Sharing with a whole household is one tap instead of several. You can
          set one up under Menu → Household.
        </Text>
      )}

      <TextInput
        style={styles.input}
        placeholder="Search for someone by name"
        placeholderTextColor="#9ca3af"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      {searching && <ActivityIndicator color="#f97316" size="small" style={styles.searching} />}

      {results
        .filter((person) => !alreadyShared.has(person.id))
        .map((person) => (
          <TouchableOpacity
            key={person.id}
            style={styles.targetRow}
            onPress={() => { void share({ userId: person.id }, person.id); }}
            disabled={busyId === person.id}
          >
            <View style={styles.targetText}>
              <Text style={styles.targetName}>{person.displayName}</Text>
            </View>
            {busyId === person.id
              ? <ActivityIndicator color="#f97316" size="small" />
              : <Text style={styles.link}>Share</Text>}
          </TouchableOpacity>
        ))}

      {loading ? (
        <ActivityIndicator color="#f97316" size="small" style={styles.searching} />
      ) : shares.length === 0 ? (
        <Text style={styles.hint}>Not shared with anyone yet.</Text>
      ) : (
        <View style={styles.shares}>
          {shares.map((s) => (
            <View key={s.id} style={styles.targetRow}>
              <View style={styles.targetText}>
                <Text style={styles.targetName}>
                  {s.user?.displayName ?? s.household?.name ?? "Someone"}
                </Text>
                <Text style={styles.targetMeta}>
                  {ROLE_LABEL[s.role]}
                  {s.household ? " · household" : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => confirmRevoke(s)} disabled={busyId === s.id}>
                {busyId === s.id
                  ? <ActivityIndicator color="#9ca3af" size="small" />
                  : <Text style={styles.revoke}>Remove</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 10,
  },
  heading: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  roles: { flexDirection: "row", gap: 8 },
  role: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  roleActive: { backgroundColor: "#f97316", borderColor: "#f97316" },
  roleText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  roleTextActive: { color: "#fff" },
  hint: { fontSize: 12, color: "#9ca3af", lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: "#111827",
  },
  searching: { alignSelf: "flex-start" },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  targetText: { flex: 1, minWidth: 0 },
  targetName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  targetMeta: { marginTop: 2, fontSize: 12, color: "#9ca3af" },
  shares: { marginTop: 4 },
  link: { fontSize: 13, fontWeight: "600", color: "#f97316" },
  revoke: { fontSize: 13, fontWeight: "600", color: "#dc2626" },
  error: { color: "#dc2626", fontSize: 13 },
});
