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
} from "react-native";
import type {
  MealPlanWithEntries,
  MealPlanEntry,
  Recipe,
  DayOfWeek,
  MealType,
} from "@souschef/shared";
import { getApiClient } from "../../../lib/api";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

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

type PickerTarget = { dayOfWeek: DayOfWeek; mealType: MealType };

export default function MealPlanScreen(): React.JSX.Element {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [plan, setPlan] = useState<MealPlanWithEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
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
        mealType: pickerTarget.mealType,
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
      await api.mealPlans.removeEntry(plan.id, entry.id);
      setPlan((prev) =>
        prev ? { ...prev, entries: prev.entries.filter((e) => e.id !== entry.id) } : prev,
      );
    } catch {
      // ignore
    } finally {
      setRemovingId(null);
    }
  }

  function getEntry(dayOfWeek: DayOfWeek, mealType: MealType): MealPlanEntry | undefined {
    return plan?.entries.find(
      (e) => Number(e.dayOfWeek) === dayOfWeek && e.mealType === mealType,
    );
  }

  // Recipe picker view
  if (pickerTarget !== null) {
    const filtered = allRecipes.filter((r) =>
      r.title.toLowerCase().includes(pickerSearch.toLowerCase()),
    );
    return (
      <View style={styles.container}>
        <View style={styles.pickerHeader}>
          <View>
            <Text style={styles.pickerTitle}>Choose a recipe</Text>
            <Text style={styles.pickerSubtitle}>
              {DAYS[pickerTarget.dayOfWeek]} · {pickerTarget.mealType}
            </Text>
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
    <View style={styles.container}>
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
                {MEAL_TYPES.map((mealType) => {
                  const entry = getEntry(day, mealType);
                  return (
                    <View key={mealType} style={styles.mealSlot}>
                      <Text style={styles.mealTypeLabel}>{mealType}</Text>
                      {entry ? (
                        <View style={styles.entryCard}>
                          <Text style={styles.entryTitle} numberOfLines={2}>
                            {entry.recipe.title}
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
                      ) : (
                        <TouchableOpacity
                          style={styles.addSlot}
                          onPress={() => { void openPicker({ dayOfWeek: day, mealType }); }}
                        >
                          <Text style={styles.addSlotText}>+ Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
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
  removeBtn: { padding: 2 },
  removeBtnText: { fontSize: 13, color: "#d1d5db" },
  addSlot: { flex: 1 },
  addSlotText: { fontSize: 13, color: "#d1d5db" },
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
});
