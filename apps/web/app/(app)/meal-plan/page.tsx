"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MealPlanWithEntries, MealPlanEntry, Recipe, DayOfWeek, MealType } from "@souschef/shared";
import { getApiClient } from "@/lib/api";
import { unwrap } from "@souschef/shared";

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

// Entries without a meal type sort last, after every labelled one. Mirrors the
// ordering the API applies so an optimistically-added entry lands in the same
// place it will sit after a reload.
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

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  return `${monday.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} – ${sunday.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
}

// A day is the only thing you have to choose. Meal type is a label picked
// inside the overlay, and may be left off entirely.
type PickerTarget = { dayOfWeek: DayOfWeek };

export default function MealPlanPage(): React.JSX.Element {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [plan, setPlan] = useState<MealPlanWithEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate shopping list
  const [showGenerate, setShowGenerate] = useState(false);
  const [genName, setGenName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Recipe picker
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  // Optional label for the entry about to be added. Resets to null each time
  // the picker opens — most entries won't be tagged at all.
  const [pickerMealType, setPickerMealType] = useState<MealType | null>(null);
  const [addingEntry, setAddingEntry] = useState(false);
  const [addEntryError, setAddEntryError] = useState<string | null>(null);
  // How many people the chosen recipe is for. Null = cook it as written.
  // Persisted for the session so planning a week for the same number of people
  // doesn't mean retyping it on every single entry.
  const [planServings, setPlanServings] = useState<number | null>(null);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);

  // Mobile: which day to start the 3-day view on (0=Mon … 4=Fri, max so 3 days always fit)
  const [mobileStartDay, setMobileStartDay] = useState<number>(() => {
    const todayDow = (new Date().getDay() + 6) % 7; // 0=Mon…6=Sun
    return Math.min(todayDow, 4);
  });

  useEffect(() => {
    async function loadHousehold(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.households.get();
        if (!("error" in res) && res.data) {
          setHouseholdName(res.data.name);
        }
      } catch {
        // Non-fatal — header just shows plain title
      }
    }
    void loadHousehold();
  }, []);

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
    setPickerMealType(null);
    setAddEntryError(null);
    if (!recipesLoaded) {
      setRecipesLoading(true);
      setRecipesError(null);
      try {
        const api = await getApiClient();
        const res = await api.recipes.list({ limit: 100 });
        if ("error" in res) throw new Error(res.error.message);
        setAllRecipes(res.data.recipes);
        setRecipesLoaded(true);
      } catch (err) {
        setRecipesError(err instanceof Error ? err.message : "Failed to load recipes");
      } finally {
        setRecipesLoading(false);
      }
    }
  }

  async function handleAddEntry(recipeId: string): Promise<void> {
    if (!plan || !pickerTarget) return;
    setAddingEntry(true);
    setAddEntryError(null);
    try {
      const api = await getApiClient();
      const res = await api.mealPlans.addEntry(plan.id, {
        recipeId,
        dayOfWeek: pickerTarget.dayOfWeek,
        mealType: pickerMealType,
        // null means "cook it as written" — only send a number when the user
        // has actually chosen one, so an unset field doesn't silently pin the
        // entry to whatever the recipe happens to serve today.
        servings: planServings,
      });
      if ("error" in res) throw new Error(res.error.message);
      setPlan((prev) => prev ? { ...prev, entries: [...prev.entries, res.data] } : prev);
      setPickerTarget(null);
    } catch (err) {
      setAddEntryError(err instanceof Error ? err.message : "Could not add recipe");
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
    setGenName(`Week of ${formatWeekRange(weekStart)}`);
    setGenError(null);
    setShowGenerate(true);
  }

  async function handleGenerate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!plan) return;
    setGenError(null);
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
      setGenError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  function prevWeek(): void {
    setWeekStart((w) => addDays(w, -7));
    setMobileStartDay(0);
  }

  function nextWeek(): void {
    setWeekStart((w) => addDays(w, 7));
    setMobileStartDay(0);
  }

  function thisWeek(): void {
    setWeekStart(getMondayOf(new Date()));
    const todayDow = (new Date().getDay() + 6) % 7;
    setMobileStartDay(Math.min(todayDow, 4));
  }

  function prevMobileDay(): void {
    if (mobileStartDay > 0) {
      setMobileStartDay((d) => d - 1);
    } else {
      setWeekStart((w) => addDays(w, -7));
      setMobileStartDay(4);
    }
  }

  function nextMobileDay(): void {
    if (mobileStartDay < 4) {
      setMobileStartDay((d) => d + 1);
    } else {
      setWeekStart((w) => addDays(w, 7));
      setMobileStartDay(0);
    }
  }

  // A day holds a list, not one recipe per slot. Sorted here rather than
  // relying on arrival order, because optimistically-added entries are appended
  // to the end of plan.entries regardless of which day they belong to.
  function getEntriesForDay(dayOfWeek: DayOfWeek): MealPlanEntry[] {
    return (plan?.entries ?? [])
      .filter((e) => Number(e.dayOfWeek) === dayOfWeek)
      .sort((a, b) => {
        const meal = mealTypeRank(a.mealType) - mealTypeRank(b.mealType);
        if (meal !== 0) return meal;
        return a.id.localeCompare(b.id);
      });
  }

  const filteredRecipes = allRecipes.filter((r) =>
    r.title.toLowerCase().includes(pickerSearch.toLowerCase()),
  );

  // One day column: a heading, the recipes planned for that day, and an add
  // button. Shared by the mobile 3-day and desktop 7-day views so the two can't
  // drift apart — they differ only in how many columns are on screen.
  function renderDayColumn(dayIdx: number): React.JSX.Element {
    const day = dayIdx as DayOfWeek;
    const date = addDays(weekStart, dayIdx);
    const isToday = toISODate(date) === toISODate(new Date());
    const entries = getEntriesForDay(day);
    const label = DAYS[dayIdx];

    return (
      <div
        key={dayIdx}
        className={`flex min-w-0 flex-col rounded-xl border p-2 ${
          isToday
            ? "border-orange-200 bg-orange-50/40 dark:border-orange-900 dark:bg-orange-950/20"
            : "border-gray-100 dark:border-gray-800"
        }`}
      >
        <div className="mb-2 px-1 text-center">
          <span
            className={`block text-xs font-semibold uppercase tracking-wide ${isToday ? "text-orange-500" : "text-gray-400"}`}
          >
            {label?.short}
          </span>
          <span
            className={`block text-base font-bold ${isToday ? "text-orange-500" : "text-gray-700 dark:text-gray-300"}`}
          >
            {date.getUTCDate()}
          </span>
        </div>

        <ul className="flex-1 space-y-1.5">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="group relative rounded-lg border border-orange-100 bg-orange-50 p-2 dark:border-orange-900 dark:bg-orange-950"
            >
              {entry.mealType && (
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-orange-400">
                  {entry.mealType}
                </span>
              )}
              <p className="pr-4 text-xs font-medium leading-snug text-gray-800 break-words dark:text-gray-200">
                {entry.recipe.title}
                {entry.servings && (
                  <span className="ml-1.5 text-xs font-normal text-orange-500">
                    ×{entry.servings}
                  </span>
                )}
              </p>
              <button
                onClick={() => { void handleRemoveEntry(entry); }}
                disabled={removingId === entry.id}
                className="absolute right-1 top-1 text-gray-300 opacity-0 transition-opacity hover:text-red-400 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                aria-label={`Remove ${entry.recipe.title}`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={() => { void openPicker({ dayOfWeek: day }); }}
          className="mt-1.5 flex min-h-[40px] w-full items-center justify-center rounded-lg border border-dashed border-gray-200 p-2 text-gray-300 transition-colors hover:border-orange-300 hover:text-orange-400 dark:border-gray-700"
          aria-label={`Add a recipe to ${label?.label}`}
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header + week nav */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {householdName != null ? `${householdName}'s meal plan` : "Meal Plan"}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-secondary py-1.5 px-3 text-sm" onClick={prevWeek}>
            ← Prev
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[200px] text-center">
            {formatWeekRange(weekStart)}
          </span>
          <button className="btn-secondary py-1.5 px-3 text-sm" onClick={nextWeek}>
            Next →
          </button>
          <button className="btn-secondary py-1.5 px-3 text-sm" onClick={thisWeek}>
            This week
          </button>
          {plan && (
            <button
              className="btn-primary py-1.5 px-3 text-sm"
              onClick={openGenerate}
            >
              Generate shopping list
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && plan && (
        <>
          {/* ── Mobile: 3-day view with day-by-day scrolling ─────────────── */}
          <div className="sm:hidden">
            <div className="mb-3 flex items-center justify-between">
              <button
                className="btn-secondary py-1.5 px-3 text-sm"
                onClick={prevMobileDay}
                aria-label="Previous days"
              >
                ←
              </button>
              <span className="text-xs text-gray-500 font-medium">
                {[0, 1, 2].map((offset) => {
                  const d = addDays(weekStart, mobileStartDay + offset);
                  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
                }).join(" – ")}
              </span>
              <button
                className="btn-secondary py-1.5 px-3 text-sm"
                onClick={nextMobileDay}
                aria-label="Next days"
              >
                →
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 items-start">
              {[0, 1, 2].map((offset) => renderDayColumn(mobileStartDay + offset))}
            </div>
          </div>

          {/* ── Desktop: full 7-day table ─────────────────────────────────── */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-7 gap-2 items-start">
              {DAYS.map((_, dayIdx) => renderDayColumn(dayIdx))}
            </div>
          </div>
        </>
      )}

      {/* Generate shopping list modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Generate shopping list</h2>
              <button
                onClick={() => setShowGenerate(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <form
              onSubmit={(e) => { void handleGenerate(e); }}
              className="px-5 py-4 space-y-4"
            >
              <div>
                <label className="label">List name</label>
                <input
                  className="input"
                  value={genName}
                  onChange={(e) => setGenName(e.target.value)}
                  placeholder="Meal plan shopping list"
                  autoFocus
                />
              </div>
              {genError && <p className="text-sm text-red-600">{genError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-primary flex-1" disabled={generating}>
                  {generating ? "Generating…" : "Generate"}
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setShowGenerate(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe picker overlay */}
      {pickerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Choose a recipe</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {DAYS[pickerTarget.dayOfWeek]?.label}
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
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
              <input
                className="input"
                placeholder="Search recipes…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                autoFocus
              />
            </div>
            {/* Meal type is a label, not a slot — "none" is a real choice and
                the default, so it sits first and starts selected. */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <span className="text-sm text-gray-600 dark:text-gray-400">Label</span>
              <button
                type="button"
                onClick={() => setPickerMealType(null)}
                className={`rounded-full px-2.5 py-1 text-xs capitalize transition-colors ${
                  pickerMealType === null
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                }`}
                aria-pressed={pickerMealType === null}
              >
                None
              </button>
              {MEAL_TYPES.map((mealType) => (
                <button
                  key={mealType}
                  type="button"
                  onClick={() => setPickerMealType(mealType)}
                  className={`rounded-full px-2.5 py-1 text-xs capitalize transition-colors ${
                    pickerMealType === mealType
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                  aria-pressed={pickerMealType === mealType}
                >
                  {mealType}
                </button>
              ))}
            </div>
            {/* Servings applies to whichever recipe is picked next. Put above
                the list rather than per-row: the user is planning for a fixed
                number of people, not deciding afresh for each recipe. */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <label htmlFor="planServings" className="text-sm text-gray-600 dark:text-gray-400">
                Cooking for
              </label>
              <input
                id="planServings"
                type="number"
                min={1}
                max={100}
                value={planServings ?? ""}
                placeholder="as written"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setPlanServings(v === "" ? null : Math.max(1, parseInt(v, 10) || 1));
                }}
                className="input w-28 text-sm"
              />
              <span className="text-xs text-gray-400">
                {planServings ? "people" : "uses each recipe's own servings"}
              </span>
            </div>
            {addEntryError && (
              <p className="px-5 pt-2 text-xs text-red-600">{addEntryError}</p>
            )}
            <ul className="overflow-y-auto flex-1 py-2">
              {recipesLoading && (
                <li className="px-5 py-8 text-center text-sm text-gray-400">Loading…</li>
              )}
              {recipesError && (
                <li className="px-5 py-8 text-center text-sm text-red-500">{recipesError}</li>
              )}
              {!recipesLoading && !recipesError && filteredRecipes.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-gray-400">
                  {allRecipes.length === 0 ? "No recipes found." : "No matches."}
                </li>
              )}
              {filteredRecipes.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    className="w-full text-left px-5 py-3 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                    onClick={() => { void handleAddEntry(recipe.id); }}
                    disabled={addingEntry}
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{recipe.title}</span>
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
