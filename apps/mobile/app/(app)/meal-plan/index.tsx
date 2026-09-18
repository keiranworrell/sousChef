import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import type {
  MealPlanWithEntries,
  MealPlanEntry,
  Recipe,
  DayOfWeek,
  MealType,
} from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { unwrap } from "@souschef/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MultiCookLauncher, { type CookCandidate } from "../../../components/MultiCookLauncher";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

// Untagged entries sort after every labelled one, matching the API's ordering.
const MEAL_TYPE_RANK: Record<MealType, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

function mealTypeRank(mealType: MealType | null): number {
  return mealType ? MEAL_TYPE_RANK[mealType] : 99;
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function formatWeekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const fmt = (d: Date): string =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

// A day is the only required choice. Meal type is an optional label chosen in
// the picker, not a slot that must be filled.
type PickerTarget = { dayOfWeek: DayOfWeek };

export default function MealPlanScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [plan, setPlan] = useState<MealPlanWithEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate shopping list
  const [showGenerate, setShowGenerate] = useState(false);
  const [genName, setGenName] = useState("");
  const [generating, setGenerating] = useState(false);

  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  // Which day's recipes are being planned together, if any.
  const [cookTogetherDay, setCookTogetherDay] = useState<DayOfWeek | null>(null);

  // Optional label for the entry about to be added; most entries won't have one.
  const [pickerMealType, setPickerMealType] = useState<MealType | null>(null);
  // How many people the next entry is cooked for. Null = as written. Kept
  // across picks so planning a week for the same household isn't retyped.
  const [planServings, setPlanServings] = useState<number | null>(null);
  const [addingEntry, setAddingEntry] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadPlan = useCallback(async (week: Date): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.mealPlans.get(toISODate(week));
      if ("error" in res) throw new Error(res.error.message);
      setPlan(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meal plan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlan(weekStart);
  }, [weekStart, loadPlan]);

  async function openPicker(target: PickerTarget): Promise<void> {
    setPickerTarget(target);
    setPickerSearch("");
    setPickerMealType(null);
    if (!recipesLoaded) {
      try {
        const api = await getApiClient();
        const res = await api.recipes.list({ limit: 200 });
        if ("error" in res) throw new Error(res.error.message);
        setAllRecipes(res.data.recipes);
        setRecipesLoaded(true);
      } catch {
        // show empty picker
      }
    }
  }

  async function handleAddEntry(recipeId: string): Promise<void> {
    if (!plan || !pickerTarget) return;
    setAddingEntry(true);
    try {
      const api = await getApiClient();
      const res = await api.mealPlans.addEntry(plan.id, {
        recipeId,
        dayOfWeek: pickerTarget.dayOfWeek,
        mealType: pickerMealType,
        servings: planServings,
      });
      if ("error" in res) throw new Error(res.error.message);
      setPlan((prev) => prev ? { ...prev, entries: [...prev.entries, res.data] } : prev);
      setPickerTarget(null);
    } catch {
      // ignore
    } finally {
      setAddingEntry(false);
    }
  }

  async function handleRemoveEntry(entry: MealPlanEntry): Promise<void> {
    if (!plan) return;
    setRemovingId(entry.id);
    try {
      const api = await getApiClient();
      unwrap(await api.mealPlans.removeEntry(plan.id, entry.id));
      setPlan((prev) =>
        prev ? { ...prev, entries: prev.entries.filter((e) => e.id !== entry.id) } : prev,
      );
    } catch {
      // ignore
    } finally {
      setRemovingId(null);
    }
  }

  function openGenerate(): void {
    setGenName(`Week of ${formatWeekLabel(weekStart)}`);
    setShowGenerate(true);
  }

  async function handleGenerate(): Promise<void> {
    if (!plan) return;
    setGenerating(true);
    try {
      const api = await getApiClient();
      const res = await api.mealPlans.generateShoppingList(plan.id, {
        name: genName.trim() || undefined,
      });
      if ("error" in res) throw new Error(res.error.message);
      setShowGenerate(false);
      router.push(`/shopping/${res.data.id}`);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  // A day holds a list. Sorted here because optimistically-added entries are
  // appended to the end of plan.entries whatever day they belong to.
  function getEntriesForDay(dayOfWeek: DayOfWeek): MealPlanEntry[] {
    return (plan?.entries ?? [])
      .filter((e) => Number(e.dayOfWeek) === dayOfWeek)
      .sort((a, b) => {
        const meal = mealTypeRank(a.mealType) - mealTypeRank(b.mealType);
        if (meal !== 0) return meal;
        return a.id.localeCompare(b.id);
      });
  }

  /**
   * The recipes on the chosen day, as planner candidates.
   *
   * De-duplicated by recipe id. A day can legitimately hold the same recipe
   * twice — a batch of flatbreads at lunch and again at dinner — and the server
   * rejects a plan containing a repeat with "Each recipe can only appear once".
   * Two identical rows with one tickbox between them would be a confusing way
   * to hit that.
   */
  const cookCandidates: CookCandidate[] =
    cookTogetherDay === null
      ? []
      : [
          ...new Map(
            getEntriesForDay(cookTogetherDay).map((e) => [
              e.recipeId,
              { recipeId: e.recipeId, title: e.recipe.title },
            ]),
          ).values(),
        ];

  // Generate shopping list view
  if (showGenerate) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Generate shopping list</Text>
          <TouchableOpacity onPress={() => setShowGenerate(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={styles.genField}>
            <Text style={styles.genLabel}>List name</Text>
            <TextInput
              style={styles.searchInput}
              value={genName}
              onChangeText={setGenName}
              placeholder="Meal plan shopping list"
              autoFocus
            />
          </View>
          <TouchableOpacity
            style={[styles.generateBtn, generating && styles.disabled]}
            onPress={() => { void handleGenerate(); }}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateBtnText}>Generate</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Recipe picker view
  if (pickerTarget !== null) {
    const filtered = allRecipes.filter((r) =>
      r.title.toLowerCase().includes(pickerSearch.toLowerCase()),
    );
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.pickerHeader}>
          <View>
            <Text style={styles.pickerTitle}>Choose a recipe</Text>
            <Text style={styles.pickerSubtitle}>{DAYS[pickerTarget.dayOfWeek]}</Text>
          </View>
          <TouchableOpacity onPress={() => setPickerTarget(null)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes…"
            value={pickerSearch}
            onChangeText={setPickerSearch}
            autoFocus
          />
        </View>
        {/* Label is optional, so "None" leads and is the default. */}
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, pickerMealType === null && styles.chipActive]}
            onPress={() => setPickerMealType(null)}
          >
            <Text style={[styles.chipText, pickerMealType === null && styles.chipTextActive]}>
              None
            </Text>
          </TouchableOpacity>
          {MEAL_TYPES.map((mealType) => (
            <TouchableOpacity
              key={mealType}
              style={[styles.chip, pickerMealType === mealType && styles.chipActive]}
              onPress={() => setPickerMealType(mealType)}
            >
              <Text
                style={[styles.chipText, pickerMealType === mealType && styles.chipTextActive]}
              >
                {mealType}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.servingsRow}>
          <Text style={styles.servingsLabel}>Cooking for</Text>
          <TextInput
            style={[styles.searchInput, styles.servingsInput]}
            keyboardType="number-pad"
            placeholder="as written"
            value={planServings === null ? "" : String(planServings)}
            onChangeText={(v) => {
              const trimmed = v.trim();
              setPlanServings(
                trimmed === "" ? null : Math.min(100, Math.max(1, parseInt(trimmed, 10) || 1)),
              );
            }}
          />
          <Text style={styles.servingsHint}>
            {planServings ? "people" : "uses the recipe's own servings"}
          </Text>
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.pickerList}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {allRecipes.length === 0 ? "No recipes found." : "No matches."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.recipeRow, addingEntry && styles.disabled]}
              onPress={() => { void handleAddEntry(item.id); }}
              disabled={addingEntry}
            >
              <Text style={styles.recipeTitle}>{item.title}</Text>
              {item.cuisine ? <Text style={styles.recipeMeta}>{item.cuisine}</Text> : null}
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Week navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setWeekStart((w) => addDays(w, -7))}
        >
          <Text style={styles.navBtnText}>← Prev</Text>
        </TouchableOpacity>
        <View style={styles.weekLabelWrap}>
          <Text style={styles.weekLabel}>{formatWeekLabel(weekStart)}</Text>
          <TouchableOpacity onPress={() => setWeekStart(getMondayOf(new Date()))}>
            <Text style={styles.todayLink}>This week</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setWeekStart((w) => addDays(w, 7))}
        >
          <Text style={styles.navBtnText}>Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Generate shopping list button */}
      {plan && (
        <View style={styles.generateBar}>
          <TouchableOpacity style={styles.generateBtn} onPress={openGenerate}>
            <Text style={styles.generateBtnText}>Generate shopping list</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color="#f97316" />
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && plan && (
        <ScrollView contentContainerStyle={styles.grid}>
          {DAYS.map((dayLabel, dayIdx) => {
            const day = dayIdx as DayOfWeek;
            const date = addDays(weekStart, dayIdx);
            const isToday = toISODate(date) === toISODate(new Date());
            return (
              <View key={dayIdx} style={styles.daySection}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                    {dayLabel}
                  </Text>
                  <Text style={[styles.dayDate, isToday && styles.dayLabelToday]}>
                    {date.getUTCDate()}
                  </Text>
                </View>
                {getEntriesForDay(day).map((entry) => (
                  <View key={entry.id} style={styles.mealSlot}>
                    {/* Untagged entries give their width to the title rather
                        than leaving an empty gutter. */}
                    {entry.mealType ? (
                      <Text style={styles.mealTypeLabel}>{entry.mealType}</Text>
                    ) : null}
                    <View style={styles.entryCard}>
                      <Text style={styles.entryTitle} numberOfLines={2}>
                        {entry.recipe.title}
                        {entry.servings ? (
                          <Text style={styles.entryServings}> ×{entry.servings}</Text>
                        ) : null}
                      </Text>
                      <TouchableOpacity
                        onPress={() => { void handleRemoveEntry(entry); }}
                        disabled={removingId === entry.id}
                        style={styles.removeBtn}
                      >
                        <Text style={styles.removeBtnText}>
                          {removingId === entry.id ? "…" : "✕"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={styles.dayActions}>
                  <TouchableOpacity
                    style={styles.addRow}
                    onPress={() => { void openPicker({ dayOfWeek: day }); }}
                  >
                    <Text style={styles.addSlotText}>+ Add a recipe</Text>
                  </TouchableOpacity>
                  {/* Only offered where it can work. Two recipes is the
                      server's minimum for a plan, and a button that always
                      refuses is worse than one that isn't there. */}
                  {getEntriesForDay(day).length >= 2 && (
                    <TouchableOpacity
                      style={styles.cookTogetherRow}
                      onPress={() => setCookTogetherDay(day)}
                    >
                      <Text style={styles.cookTogetherText}>Cook together</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <MultiCookLauncher
        visible={cookTogetherDay !== null}
        dayLabel={cookTogetherDay !== null ? DAYS[cookTogetherDay]! : ""}
        candidates={cookCandidates}
        onClose={() => setCookTogetherDay(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  navBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  navBtnText: { fontSize: 13, fontWeight: "600", color: "#f97316" },
  weekLabelWrap: { alignItems: "center" },
  weekLabel: { fontSize: 13, fontWeight: "600", color: "#111827" },
  todayLink: { fontSize: 11, color: "#f97316", marginTop: 2 },
  grid: { padding: 12, gap: 12 },
  dayActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cookTogetherRow: { paddingHorizontal: 12, paddingVertical: 10 },
  cookTogetherText: { fontSize: 13, fontWeight: "600", color: "#f97316" },
  daySection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  dayLabel: { fontSize: 12, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase" },
  dayDate: { fontSize: 15, fontWeight: "700", color: "#374151" },
  dayLabelToday: { color: "#f97316" },
  mealSlot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 10,
    minHeight: 44,
  },
  mealTypeLabel: {
    width: 70,
    fontSize: 11,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "capitalize",
  },
  entryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff7ed",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  entryTitle: { flex: 1, fontSize: 13, fontWeight: "500", color: "#111827" },
  entryServings: { fontSize: 12, fontWeight: "400", color: "#f97316" },
  removeBtn: { padding: 2 },
  removeBtnText: { fontSize: 13, color: "#d1d5db" },
  addRow: { paddingHorizontal: 12, paddingVertical: 10 },
  addSlotText: { fontSize: 13, color: "#9ca3af" },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
  },
  chip: {
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActive: { backgroundColor: "#f97316" },
  chipText: { fontSize: 12, color: "#4b5563", textTransform: "capitalize" },
  chipTextActive: { color: "#fff" },
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  servingsLabel: { fontSize: 13, color: "#4b5563" },
  servingsInput: { width: 96 },
  servingsHint: { flex: 1, fontSize: 11, color: "#9ca3af" },
  // Picker
  pickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  pickerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  pickerSubtitle: { fontSize: 12, color: "#9ca3af", marginTop: 2, textTransform: "capitalize" },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#f97316" },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  pickerList: { paddingBottom: 40 },
  recipeRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  recipeTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  recipeMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  emptyText: { fontSize: 14, color: "#9ca3af" },
  errorText: { fontSize: 14, color: "#dc2626" },
  disabled: { opacity: 0.5 },
  // Generate shopping list
  generateBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  generateBtn: {
    backgroundColor: "#f97316",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center" as const,
  },
  generateBtnText: { color: "#fff", fontWeight: "600" as const, fontSize: 14 },
  genField: { gap: 6 },
  genRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  genLabel: { fontSize: 13, fontWeight: "500" as const, color: "#374151" },
});
