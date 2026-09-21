import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getApiClient } from "../lib/api";
import {
  DEFAULT_FILTERS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  SORT_LABELS,
  SORT_ORDER,
  hasActiveFilters,
  type RecipeFilters,
} from "../lib/recipe-filters";
import { useTheme, useThemedStyles } from "./ThemeProvider";
import type { Palette } from "../lib/theme";

type Props = {
  open: boolean;
  filters: RecipeFilters;
  onChange: (filters: RecipeFilters) => void;
  onClose: () => void;
};

/**
 * Search and filters, as a panel above the list rather than a modal.
 *
 * A modal would cover the thing it is filtering, which means tapping a tag and
 * then having to dismiss something to find out what it did. Inline, the list
 * re-sorts underneath as you touch the controls.
 *
 * Cuisine is not a filter here, and that is not an omission: `/recipes` has no
 * cuisine parameter. `q` searches title, ingredients *and* cuisine, which is
 * why the placeholder says so — web works the same way and its own placeholder
 * says "Search by title, ingredient, cuisine…".
 */
export default function RecipeSearchDrawer({
  open,
  filters,
  onChange,
  onClose,
}: Props): React.JSX.Element | null {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [tags, setTags] = useState<string[]>([]);

  // Fetched once, the first time the drawer is opened. Tags only change when
  // the user edits a recipe, and paying for this on every app launch to
  // populate a control most people never open is the wrong trade.
  useEffect(() => {
    if (!open || tags.length > 0) return;
    let cancelled = false;
    async function loadTags(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.recipes.tags();
        if (!cancelled && "data" in res) setTags(res.data.tags);
      } catch {
        // The tag row simply does not appear. Text search and difficulty still
        // work, which is better than an error over a list that is fine.
      }
    }
    void loadTags();
    return () => { cancelled = true; };
  }, [open, tags.length]);

  if (!open) return null;

  function set<K extends keyof RecipeFilters>(key: K, value: RecipeFilters[K]): void {
    onChange({ ...filters, [key]: value });
  }

  return (
    <View style={styles.drawer}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={palette.textFaint} />
        <TextInput
          style={styles.input}
          value={filters.q}
          onChangeText={(q) => set("q", q)}
          placeholder="Search by title, ingredient, cuisine…"
          placeholderTextColor={palette.textFaint}
          autoFocus
          returnKeyType="search"
          autoCapitalize="none"
        />
        {filters.q !== "" && (
          <TouchableOpacity
            onPress={() => set("q", "")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={17} color={palette.textFaint} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.label}>Sort</Text>
      <View style={styles.chipRow}>
        {SORT_ORDER.map((option) => {
          const active = filters.sort === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => set("sort", option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {SORT_LABELS[option]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Difficulty</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, filters.difficulty === "" && styles.chipActive]}
          onPress={() => set("difficulty", "")}
          accessibilityRole="radio"
          accessibilityState={{ selected: filters.difficulty === "" }}
        >
          <Text style={[styles.chipText, filters.difficulty === "" && styles.chipTextActive]}>
            Any
          </Text>
        </TouchableOpacity>
        {DIFFICULTY_ORDER.map((option) => {
          const active = filters.difficulty === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => set("difficulty", active ? "" : option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {DIFFICULTY_LABELS[option]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Hidden rather than shown empty: a "Tags" heading over nothing reads
          as something failing to load. */}
      {tags.length > 0 && (
        <>
          <Text style={styles.label}>Tag</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagRow}
          >
            <TouchableOpacity
              style={[styles.chip, filters.tag === "" && styles.chipActive]}
              onPress={() => set("tag", "")}
            >
              <Text style={[styles.chipText, filters.tag === "" && styles.chipTextActive]}>
                Any
              </Text>
            </TouchableOpacity>
            {tags.map((tag) => {
              const active = filters.tag === tag;
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, active && styles.chipActive]}
                  // Tapping the active tag clears it, so there is a way back to
                  // "any" without hunting for the Any chip at the far left.
                  onPress={() => set("tag", active ? "" : tag)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      <View style={styles.actions}>
        {hasActiveFilters(filters) && (
          <TouchableOpacity onPress={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}>
            {/* Sort is kept. It is a preference about how you like to read the
                list, not part of the search you are abandoning. */}
            <Text style={styles.clear}>Clear filters</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.done} onPress={onClose}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  drawer: {
    backgroundColor: t.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 6,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: t.bg,
  },
  input: { flex: 1, paddingVertical: 9, fontSize: 14, color: t.text },
  label: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: t.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagRow: { flexDirection: "row", gap: 6, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: t.accentSurface, borderColor: t.accent },
  chipText: { fontSize: 12, color: t.textMuted, fontWeight: "500" },
  chipTextActive: { color: t.accentText, fontWeight: "700" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  clear: { fontSize: 13, fontWeight: "600", color: t.textMuted },
  done: {
    marginLeft: "auto",
    backgroundColor: t.accentSurface,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  doneText: { fontSize: 13, fontWeight: "700", color: t.accentText },
});
