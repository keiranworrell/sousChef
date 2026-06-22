"use client";

import React, { useEffect, useState } from "react";
import type { MealPlanWithEntries, MealPlanEntry, Recipe, DayOfWeek, MealType } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

const DAYS: { label: string; short: string }[] = [
  { label: "Monday", short: "Mon" },
  { label: "Tuesday", short: "Tue" },
  { label: "Wednesday", short: "Wed" },
  { label: "Thursday", short: "Thu" },
  { label: "Friday", short: "Fri" },
  { label: "Saturday", short: "Sat" },
  { label: "Sunday", short: "Sun" },
];

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

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  return `${monday.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} – ${sunday.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
}

type PickerTarget = { dayOfWeek: DayOfWeek; mealType: MealType };

export default function MealPlanPage(): React.JSX.Element {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [plan, setPlan] = useState<MealPlanWithEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recipe picker
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [addingEntry, setAddingEntry] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    void loadPlan();
  }, [weekStart]);

  async function loadPlan(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const api = await getApiClient();
      const res = await api.mealPlans.get(toISODate(weekStart));
      if ("error" in res) throw new Error(res.error.message);
      setPlan(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meal plan");
    } finally {
      setLoading(false);
    }
  }

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
        // show empty picker — user can still see the UI
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
      // ignore — picker stays open
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

  const filteredRecipes = allRecipes.filter((r) =>
    r.title.toLowerCase().includes(pickerSearch.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header + week nav */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Meal Plan</h1>
        <div className="flex items-center gap-3">
          <button
            className="btn-secondary py-1.5 px-3 text-sm"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            ← Prev
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
            {formatWeekRange(weekStart)}
          </span>
          <button
            className="btn-secondary py-1.5 px-3 text-sm"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            Next →
          </button>
          <button
            className="btn-secondary py-1.5 px-3 text-sm"
            onClick={() => setWeekStart(getMondayOf(new Date()))}
          >
            This week
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && plan && (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-24 py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400" />
                {DAYS.map((day, i) => {
                  const date = addDays(weekStart, i);
                  const isToday = toISODate(date) === toISODate(new Date());
                  return (
                    <th
                      key={i}
                      className={`py-2 px-1 text-center text-xs font-semibold uppercase tracking-wide ${isToday ? "text-orange-500" : "text-gray-400"}`}
                    >
                      <span className="block">{day.short}</span>
                      <span className={`block text-base font-bold ${isToday ? "text-orange-500" : "text-gray-700"}`}>
                        {date.getUTCDate()}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {MEAL_TYPES.map((mealType) => (
                <tr key={mealType} className="border-t border-gray-100">
                  <td className="py-3 pr-3 text-xs font-semibold capitalize text-gray-400 align-top pt-3.5">
                    {mealType}
                  </td>
                  {DAYS.map((_, dayIdx) => {
                    const day = dayIdx as DayOfWeek;
                    const entry = getEntry(day, mealType);
                    return (
                      <td key={dayIdx} className="p-1 align-top">
                        {entry ? (
                          <div className="group relative rounded-lg bg-orange-50 border border-orange-100 p-2 min-h-[56px]">
                            <p className="text-xs font-medium text-gray-800 leading-snug pr-4">
                              {entry.recipe.title}
                            </p>
                            <button
                              onClick={() => { void handleRemoveEntry(entry); }}
                              disabled={removingId === entry.id}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity disabled:opacity-50"
                              aria-label="Remove"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
                                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { void openPicker({ dayOfWeek: day, mealType }); }}
                            className="w-full rounded-lg border border-dashed border-gray-200 p-2 min-h-[56px] text-gray-300 hover:border-orange-300 hover:text-orange-400 transition-colors flex items-center justify-center"
                            aria-label={`Add ${mealType}`}
                          >
                            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recipe picker overlay */}
      {pickerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Choose a recipe</h2>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">
                  {DAYS[pickerTarget.dayOfWeek]?.label} · {pickerTarget.mealType}
                </p>
              </div>
              <button
                onClick={() => setPickerTarget(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-3 border-b border-gray-100">
              <input
                className="input"
                placeholder="Search recipes…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                autoFocus
              />
            </div>
            <ul className="overflow-y-auto flex-1 py-2">
              {filteredRecipes.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-gray-400">
                  {allRecipes.length === 0 ? "No recipes found." : "No matches."}
                </li>
              )}
              {filteredRecipes.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    className="w-full text-left px-5 py-3 hover:bg-orange-50 transition-colors disabled:opacity-50"
                    onClick={() => { void handleAddEntry(recipe.id); }}
                    disabled={addingEntry}
                  >
                    <span className="text-sm font-medium text-gray-900">{recipe.title}</span>
                    {recipe.cuisine && (
                      <span className="ml-2 text-xs text-gray-400">{recipe.cuisine}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
