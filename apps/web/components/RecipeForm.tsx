"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { CreateRecipeInput, RecipeWithDetails } from "@souschef/shared";
import { getApiClient } from "@/lib/api";

type Props = {
  initial?: RecipeWithDetails;
};

type IngredientField = {
  name: string;
  quantity: string;
  unit: string;
  notes: string;
};

type StepField = {
  instruction: string;
  timerSeconds: string;
};

export default function RecipeForm({ initial }: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = !!initial;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [servings, setServings] = useState(String(initial?.servings ?? 4));
  const [prepTime, setPrepTime] = useState(String(initial?.prepTimeMinutes ?? ""));
  const [cookTime, setCookTime] = useState(String(initial?.cookTimeMinutes ?? ""));
  const [difficulty, setDifficulty] = useState<string>(initial?.difficulty ?? "");
  const [cuisine, setCuisine] = useState(initial?.cuisine ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [tags, setTags] = useState<string[]>(
    initial?.tags.map((t) => t.tag) ?? [],
  );
  const [tagInput, setTagInput] = useState("");

  const [ingredients, setIngredients] = useState<IngredientField[]>(
    initial?.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity != null ? String(i.quantity) : "",
      unit: i.unit ?? "",
      notes: i.notes ?? "",
    })) ?? [{ name: "", quantity: "", unit: "", notes: "" }],
  );

  const [steps, setSteps] = useState<StepField[]>(
    initial?.steps.map((s) => ({
      instruction: s.instruction,
      timerSeconds: s.timerSeconds != null ? String(s.timerSeconds) : "",
    })) ?? [{ instruction: "", timerSeconds: "" }],
  );

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addIngredient(): void {
    setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "", notes: "" }]);
  }

  function removeIngredient(i: number): void {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addStep(): void {
    setSteps((prev) => [...prev, { instruction: "", timerSeconds: "" }]);
  }

  function removeStep(i: number): void {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addTag(value: string): void {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  }

  function removeTag(tag: string): void {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const api = await getApiClient();

      const payload: CreateRecipeInput = {
        title,
        description: description || null,
        servings: parseInt(servings, 10) || 4,
        prepTimeMinutes: prepTime ? parseInt(prepTime, 10) : null,
        cookTimeMinutes: cookTime ? parseInt(cookTime, 10) : null,
        difficulty: (difficulty as CreateRecipeInput["difficulty"]) || null,
        cuisine: cuisine || null,
        isPublic,
        ingredients: ingredients
          .filter((i) => i.name.trim())
          .map((i, idx) => ({
            name: i.name.trim(),
            quantity: i.quantity ? parseFloat(i.quantity) : null,
            unit: i.unit || null,
            notes: i.notes || null,
            orderIndex: idx,
          })),
        tags,
        steps: steps
          .filter((s) => s.instruction.trim())
          .map((s, idx) => ({
            stepNumber: idx + 1,
            instruction: s.instruction.trim(),
            timerSeconds: s.timerSeconds ? parseInt(s.timerSeconds, 10) : null,
          })),
      };

      if (isEdit && initial) {
        const res = await api.recipes.update(initial.id, payload);
        if ("error" in res) throw new Error(res.error.message);
        router.push(`/recipes/${initial.id}`);
      } else {
        const res = await api.recipes.create(payload);
        if ("error" in res) throw new Error(res.error.message);
        if ("data" in res) router.push(`/recipes/${res.data.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic info */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Basic info
        </h2>

        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Sourdough loaf"
          />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional short description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="label">Servings</label>
            <input
              className="input"
              type="number"
              min={1}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Prep (min)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Cook (min)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select
              className="input"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">—</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Cuisine</label>
            <input
              className="input"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="e.g. Italian"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-orange-500"
              />
              <span className="text-sm text-gray-700">Make public</span>
            </label>
          </div>
        </div>

        <div>
          <label className="label">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-orange-400 hover:text-orange-700"
                  aria-label={`Remove ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            className="input"
            placeholder="e.g. vegetarian, pasta, quick — press Enter or comma to add"
            value={tagInput}
            onChange={(e) => {
              const val = e.target.value;
              if (val.endsWith(",")) {
                addTag(val.slice(0, -1));
              } else {
                setTagInput(val);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
          />
          <p className="mt-1 text-xs text-gray-500">Press Enter or type a comma to add a tag</p>
        </div>
      </section>

      {/* Ingredients */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Ingredients
        </h2>
        {ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Ingredient name"
              value={ing.name}
              onChange={(e) =>
                setIngredients((prev) =>
                  prev.map((x, idx) =>
                    idx === i ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
            />
            <input
              className="input w-20"
              placeholder="Qty"
              type="number"
              min={0}
              step="any"
              value={ing.quantity}
              onChange={(e) =>
                setIngredients((prev) =>
                  prev.map((x, idx) =>
                    idx === i ? { ...x, quantity: e.target.value } : x,
                  ),
                )
              }
            />
            <input
              className="input w-20"
              placeholder="Unit"
              value={ing.unit}
              onChange={(e) =>
                setIngredients((prev) =>
                  prev.map((x, idx) =>
                    idx === i ? { ...x, unit: e.target.value } : x,
                  ),
                )
              }
            />
            <button
              type="button"
              onClick={() => removeIngredient(i)}
              className="text-gray-400 hover:text-red-500 transition"
              aria-label="Remove ingredient"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addIngredient}
          className="text-sm text-orange-500 hover:text-orange-600 font-medium"
        >
          + Add ingredient
        </button>
      </section>

      {/* Steps */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Steps
        </h2>
        {steps.map((step, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="mt-2 text-sm font-medium text-gray-400 w-5 shrink-0">
              {i + 1}.
            </span>
            <textarea
              className="input flex-1 resize-y min-h-[64px]"
              placeholder="Describe this step"
              value={step.instruction}
              onChange={(e) =>
                setSteps((prev) =>
                  prev.map((x, idx) =>
                    idx === i ? { ...x, instruction: e.target.value } : x,
                  ),
                )
              }
            />
            <input
              className="input w-24"
              placeholder="Timer (s)"
              type="number"
              min={0}
              value={step.timerSeconds}
              onChange={(e) =>
                setSteps((prev) =>
                  prev.map((x, idx) =>
                    idx === i ? { ...x, timerSeconds: e.target.value } : x,
                  ),
                )
              }
            />
            <button
              type="button"
              onClick={() => removeStep(i)}
              className="mt-2 text-gray-400 hover:text-red-500 transition"
              aria-label="Remove step"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addStep}
          className="text-sm text-orange-500 hover:text-orange-600 font-medium"
        >
          + Add step
        </button>
      </section>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? "Saving…" : isEdit ? "Save changes" : "Create recipe"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
