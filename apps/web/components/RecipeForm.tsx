"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CreateRecipeInput, RecipeWithDetails } from "@souschef/shared";
import { predictTags } from "@souschef/shared";
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

const SUPPORTED_SOURCES = [
  "BBC Good Food",
  "AllRecipes",
  "Serious Eats",
  "NYT Cooking",
  "Bon Appétit",
  "Food Network",
  "Epicurious",
  "most sites using Schema.org recipe markup",
];

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

  const [imageUrl, setImageUrl] = useState<string>(initial?.imageUrl ?? "");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    setImageUploading(true);
    try {
      const api = await getApiClient();
      const presignRes = await api.images.presign(file.type);
      if ("error" in presignRes) throw new Error(presignRes.error.message);
      const { uploadUrl, imageUrl: cdnUrl } = presignRes.data;
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      setImageUrl(cdnUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setImageUploading(false);
    }
  }

  // Premium plan check — fetched on mount so the AI fallback can fire automatically
  const [isPremium, setIsPremium] = useState(false);
  useEffect(() => {
    getApiClient()
      .then((api) => api.users.me())
      .then((res) => {
        if (!("error" in res)) setIsPremium(res.data.planTier === "premium");
      })
      .catch(() => { /* non-critical, leave false */ });
  }, []);

  // Import state (create mode only)
  type ImportMode = "url" | "note";
  const [importMode, setImportMode] = useState<ImportMode>("url");
  const [importUrl, setImportUrl] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "schema" | "ai">("idle");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedWithAi, setImportedWithAi] = useState(false);
  const [imported, setImported] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteImportLoading, setNoteImportLoading] = useState(false);
  const [noteImportError, setNoteImportError] = useState<string | null>(null);

  function applyImportedRecipe(r: CreateRecipeInput): void {
    if (r.title) setTitle(r.title);
    if (r.description) setDescription(r.description);
    if (r.imageUrl) setImageUrl(r.imageUrl);
    if (r.servings) setServings(String(r.servings));
    if (r.prepTimeMinutes != null) setPrepTime(String(r.prepTimeMinutes));
    if (r.cookTimeMinutes != null) setCookTime(String(r.cookTimeMinutes));
    if (r.difficulty) setDifficulty(r.difficulty);
    if (r.cuisine) setCuisine(r.cuisine);
    if (r.tags && r.tags.length > 0) setTags(r.tags);
    if (r.ingredients && r.ingredients.length > 0) {
      setIngredients(
        r.ingredients.map((i) => ({
          name: i.name,
          quantity: i.quantity != null ? String(i.quantity) : "",
          unit: i.unit ?? "",
          notes: i.notes ?? "",
        })),
      );
    }
    if (r.steps && r.steps.length > 0) {
      setSteps(
        r.steps.map((s) => ({
          instruction: s.instruction,
          timerSeconds: s.timerSeconds != null ? String(s.timerSeconds) : "",
        })),
      );
    }
  }

  async function handleImport(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const url = importUrl.trim();
    if (!url) return;
    setImportError(null);
    setImported(false);
    setImportedWithAi(false);
    setImportLoading(true);
    setImportStatus("schema");

    try {
      const api = await getApiClient();

      // Try standard Schema.org import first
      const res = await api.recipes.parse({ url });

      if (!("error" in res)) {
        applyImportedRecipe(res.data);
        setImported(true);
        return;
      }

      // Standard import failed — try AI automatically if user is premium
      if (isPremium) {
        setImportStatus("ai");
        const aiRes = await api.recipes.importAi({ url });
        if (!("error" in aiRes)) {
          applyImportedRecipe(aiRes.data);
          setImported(true);
          setImportedWithAi(true);
          return;
        }
        setImportError(aiRes.error.message);
      } else {
        setImportError(res.error.message);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportLoading(false);
      setImportStatus("idle");
    }
  }

  async function handleNoteImport(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    setNoteImportError(null);
    setImported(false);
    setImportedWithAi(false);
    setNoteImportLoading(true);

    try {
      const api = await getApiClient();
      const res = await api.recipes.importText({ text });
      if ("error" in res) {
        setNoteImportError(res.error.message);
        return;
      }
      applyImportedRecipe(res.data);
      setImported(true);
      setImportedWithAi(true);
    } catch (err) {
      setNoteImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setNoteImportLoading(false);
    }
  }

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
        imageUrl: imageUrl || null,
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

  // Compute dietary tag suggestions from the current ingredient list,
  // filtered down to ones the user hasn't already added.
  const suggestedTags = useMemo(() => {
    const predicted = predictTags(ingredients.map((i) => i.name));
    return predicted.filter((t) => !tags.includes(t));
  }, [ingredients, tags]);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Import (create mode only) */}
      {!isEdit && (
        <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 space-y-3">
          {/* Mode toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Import recipe</p>
            <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => { setImportMode("url"); setImportError(null); setNoteImportError(null); setImported(false); }}
                className={`px-3 py-1.5 transition ${importMode === "url" ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-700"}`}
              >
                From URL
              </button>
              <button
                type="button"
                onClick={() => { setImportMode("note"); setImportError(null); setNoteImportError(null); setImported(false); }}
                className={`px-3 py-1.5 transition ${importMode === "note" ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-700"}`}
              >
                From note
              </button>
            </div>
          </div>

          {imported ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-green-600 font-medium">
                {importedWithAi
                  ? "✓ Imported with AI — review and edit below"
                  : "✓ Recipe imported — review and edit below"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setImported(false);
                  setImportedWithAi(false);
                  setImportUrl("");
                  setNoteText("");
                  setImportError(null);
                  setNoteImportError(null);
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Import another
              </button>
            </div>
          ) : importMode === "url" ? (
            <>
              <p className="text-xs text-gray-400">
                Supported: {SUPPORTED_SOURCES.join(", ")}.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  className="input flex-1 text-sm"
                  placeholder="https://www.bbcgoodfood.com/recipes/…"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  disabled={importLoading}
                />
                <button
                  type="button"
                  onClick={(e) => { void handleImport(e); }}
                  disabled={importLoading || !importUrl.trim()}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  {importStatus === "ai" ? "Analysing with AI…" : importLoading ? "Importing…" : "Import"}
                </button>
              </div>
              {importError && <p className="text-xs text-red-600">{importError}</p>}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400">
                Paste a recipe from your notes app — ingredients, steps, and timings will be extracted automatically.
              </p>
              <textarea
                className="input w-full min-h-[160px] resize-y text-sm font-mono"
                placeholder={"e.g.\n\nBiscoff Banana Bread\n\nIngredients:\n3 ripe bananas\n150g Biscoff spread\n…\n\nMethod:\n1. Preheat oven to 180°C\n…"}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={noteImportLoading}
              />
              <button
                type="button"
                onClick={(e) => { void handleNoteImport(e); }}
                disabled={noteImportLoading || !noteText.trim()}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {noteImportLoading ? "Analysing…" : "Import from note"}
              </button>
              {noteImportError && <p className="text-xs text-red-600">{noteImportError}</p>}
            </>
          )}
        </section>
      )}

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
          <label className="label">Photo</label>
          <div className="flex items-start gap-4">
            {imageUrl && (
              <div className="relative shrink-0">
                <img
                  src={imageUrl}
                  alt="Recipe"
                  className="h-24 w-24 rounded-lg object-cover border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white text-xs hover:bg-red-600"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex-1">
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-500 transition ${imageUploading ? "opacity-50 pointer-events-none" : ""}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => { void handleImageSelect(e); }}
                  disabled={imageUploading}
                />
                {imageUploading ? "Uploading…" : imageUrl ? "Replace photo" : "Upload a photo"}
              </label>
              {imageError && <p className="mt-1 text-xs text-red-600">{imageError}</p>}
            </div>
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

          {suggestedTags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-400 mr-0.5">Suggested:</span>
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-500 hover:text-white hover:border-orange-500"
                >
                  + {tag}
                </button>
              ))}
            </div>
          )}
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
