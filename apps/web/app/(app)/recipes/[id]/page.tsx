"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { RecipeWithDetails, ShoppingList } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

type AddToListState =
  | { step: "closed" }
  | { step: "picking"; lists: ShoppingList[]; loading: boolean }
  | { step: "new-name"; lists: ShoppingList[]; newName: string }
  | { step: "saving" }
  | { step: "done"; listId: string };

export default function RecipeDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addToList, setAddToList] = useState<AddToListState>({ step: "closed" });

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.recipes.get(id);
        if ("error" in res) throw new Error(res.error.message);
        setRecipe(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recipe");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function handleDelete(): Promise<void> {
    if (!confirm("Delete this recipe?")) return;
    setDeleting(true);
    try {
      const api = await getApiClient();
      await api.recipes.delete(id);
      router.push("/recipes");
    } catch {
      setDeleting(false);
    }
  }

  async function openAddToList(): Promise<void> {
    setAddToList({ step: "picking", lists: [], loading: true });
    try {
      const api = await getApiClient();
      const res = await api.shopping.list();
      const lists = "data" in res ? res.data.lists : [];
      setAddToList({ step: "picking", lists, loading: false });
    } catch {
      setAddToList({ step: "picking", lists: [], loading: false });
    }
  }

  async function addToExistingList(listId: string): Promise<void> {
    if (!recipe) return;
    setAddToList({ step: "saving" });
    const items = recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
    }));
    try {
      const api = await getApiClient();
      await api.shopping.items.bulkAdd(listId, items);
      setAddToList({ step: "done", listId });
    } catch {
      setAddToList({ step: "closed" });
    }
  }

  async function addToNewList(name: string): Promise<void> {
    if (!recipe) return;
    setAddToList({ step: "saving" });
    const items = recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
    }));
    try {
      const api = await getApiClient();
      const created = await api.shopping.create({ name });
      if ("error" in created) throw new Error(created.error.message);
      await api.shopping.items.bulkAdd(created.data.id, items);
      setAddToList({ step: "done", listId: created.data.id });
    } catch {
      setAddToList({ step: "closed" });
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error ?? "Recipe not found"}</p>
        <Link href="/recipes" className="mt-4 inline-block text-sm text-orange-500 hover:underline">
          ← Back to recipes
        </Link>
      </div>
    );
  }

  const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-64 object-cover rounded-xl mb-6"
        />
      )}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/recipes" className="text-sm text-orange-500 hover:underline">
            ← Recipes
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{recipe.title}</h1>
            {recipe.isPublic && (
              <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-600">
                Public
              </span>
            )}
          </div>
          {recipe.description && (
            <p className="mt-2 text-gray-500">{recipe.description}</p>
          )}
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-gray-400 hover:text-orange-500 hover:underline"
            >
              ↗ Original source: {new URL(recipe.sourceUrl).hostname.replace(/^www\./, "")}
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {recipe.steps.length > 0 && (
            <Link href={`/recipes/${id}/cook`} className="btn-primary">
              Start cooking
            </Link>
          )}
          {recipe.ingredients.length > 0 && (
            <button onClick={() => { void openAddToList(); }} className="btn-secondary">
              Add to list
            </button>
          )}
          <Link href={`/recipes/${id}/edit`} className="btn-secondary">
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="mb-4 flex flex-wrap gap-4 text-sm text-gray-500">
        <span>{recipe.servings} servings</span>
        {totalMins > 0 && <span>{totalMins} min total</span>}
        {recipe.prepTimeMinutes && <span>{recipe.prepTimeMinutes} min prep</span>}
        {recipe.cookTimeMinutes && <span>{recipe.cookTimeMinutes} min cook</span>}
        {recipe.difficulty && <span className="capitalize">{recipe.difficulty}</span>}
        {recipe.cuisine && <span>{recipe.cuisine}</span>}
      </div>

      {recipe.tags.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-1.5 border-b border-gray-100 pb-6">
          {recipe.tags.map((t) => (
            <span
              key={t.id}
              className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600"
            >
              {t.tag}
            </span>
          ))}
        </div>
      )}
      {recipe.tags.length === 0 && <div className="mb-8 border-b border-gray-100" />}

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex gap-2 text-sm text-gray-700">
                {ing.quantity != null && (
                  <span className="font-medium text-gray-900">
                    {ing.quantity}{ing.unit ? ` ${ing.unit}` : ""}
                  </span>
                )}
                <span>{ing.name}</span>
                {ing.notes && <span className="text-gray-400">({ing.notes})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Steps */}
      {recipe.steps.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Method</h2>
          <ol className="space-y-4">
            {recipe.steps.map((step) => (
              <li key={step.id} className="flex gap-4">
                <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
                  {step.stepNumber}
                </span>
                <div className="pt-0.5">
                  <p className="text-sm text-gray-700">{step.instruction}</p>
                  {step.timerSeconds && (
                    <p className="mt-1 text-xs text-gray-400">
                      Timer: {Math.round(step.timerSeconds / 60)} min
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Add to list modal */}
      {addToList.step !== "closed" && addToList.step !== "done" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            {addToList.step === "saving" ? (
              <p className="text-sm text-gray-500">Adding ingredients…</p>
            ) : addToList.step === "new-name" ? (
              <>
                <h2 className="mb-4 text-base font-semibold text-gray-900">New shopping list</h2>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="List name"
                  value={addToList.newName}
                  onChange={(e) =>
                    setAddToList({ ...addToList, newName: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && addToList.newName.trim()) {
                      void addToNewList(addToList.newName.trim());
                    }
                  }}
                  autoFocus
                />
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => { void addToNewList(addToList.newName.trim()); }}
                    disabled={!addToList.newName.trim()}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    Create &amp; add
                  </button>
                  <button
                    onClick={() => setAddToList({ step: "picking", lists: addToList.lists, loading: false })}
                    className="btn-secondary"
                  >
                    Back
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="mb-4 text-base font-semibold text-gray-900">Add to shopping list</h2>
                {addToList.loading ? (
                  <p className="text-sm text-gray-400">Loading lists…</p>
                ) : (
                  <div className="space-y-2">
                    {addToList.lists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => { void addToExistingList(list.id); }}
                        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                      >
                        {list.name}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setAddToList({
                          step: "new-name",
                          lists: addToList.lists,
                          newName: `${recipe.title} ingredients`,
                        })
                      }
                      className="w-full rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-left text-sm font-medium text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                    >
                      + New list
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setAddToList({ step: "closed" })}
                  className="mt-4 text-sm text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Success banner */}
      {addToList.step === "done" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 text-sm text-white shadow-lg">
          <span>Added to shopping list</span>
          <Link
            href={`/shopping/${addToList.listId}`}
            className="font-medium text-orange-400 hover:underline"
            onClick={() => setAddToList({ step: "closed" })}
          >
            View list →
          </Link>
          <button
            onClick={() => setAddToList({ step: "closed" })}
            className="ml-2 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
