import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import type { CreateRecipeInput } from "@souschef/shared";
import { getApiClient } from "../../../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ImportTabs, { type ImportMode } from "../../../components/ImportTabs";
import { draftToFormFields } from "../../../lib/recipe-draft";
import { TAB_BAR_ALLOWANCE } from "../../../lib/tab-bar";
import { useTheme, useThemedStyles } from "../../../components/ThemeProvider";
import type { Palette } from "../../../lib/theme";

type IngredientField = { name: string; quantity: string; unit: string };
type StepField = { instruction: string; timerSeconds: string };

export default function NewRecipeScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("4");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">("");
  const [cuisine, setCuisine] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientField[]>([
    { name: "", quantity: "", unit: "" },
  ]);
  const [steps, setSteps] = useState<StepField[]>([{ instruction: "", timerSeconds: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<ImportMode>("manual");
  // Undefined until loaded, null on premium. Only used to show the free-tier
  // count, so a failure to fetch it simply shows nothing rather than blocking
  // the screen — the server enforces the quota regardless of what we display.
  const [aiImportsRemaining, setAiImportsRemaining] = useState<number | null | undefined>(
    undefined,
  );

  useEffect(() => {
    async function loadQuota(): Promise<void> {
      try {
        const api = await getApiClient();
        const res = await api.users.me();
        if ("data" in res) setAiImportsRemaining(res.data.aiImportsRemaining);
      } catch {
        // Non-critical.
      }
    }
    void loadQuota();
  }, []);

  /**
   * A photo or paste import hands back a parsed recipe rather than saving one.
   * It fills the form in and switches to it, so the user reviews an extraction
   * before it becomes a recipe they rely on.
   */
  function applyDraft(draft: CreateRecipeInput): void {
    const fields = draftToFormFields(draft);
    setTitle(fields.title);
    setDescription(fields.description);
    setServings(fields.servings);
    setPrepTime(fields.prepTime);
    setCookTime(fields.cookTime);
    setDifficulty(fields.difficulty);
    setCuisine(fields.cuisine);
    setIngredients(fields.ingredients);
    setSteps(fields.steps);
    setError(null);
    setMode("manual");
  }

  async function handleSubmit(): Promise<void> {
    if (!title.trim()) { setError("Title is required"); return; }
    setError(null);
    setLoading(true);
    try {
      const api = await getApiClient();
      const payload: CreateRecipeInput = {
        title: title.trim(),
        description: description.trim() || null,
        servings: parseInt(servings, 10) || 4,
        prepTimeMinutes: prepTime ? parseInt(prepTime, 10) : null,
        cookTimeMinutes: cookTime ? parseInt(cookTime, 10) : null,
        difficulty: difficulty || null,
        cuisine: cuisine.trim() || null,
        isPublic,
        ingredients: ingredients
          .filter((i) => i.name.trim())
          .map((i, idx) => ({
            name: i.name.trim(),
            quantity: i.quantity ? parseFloat(i.quantity) : null,
            unit: i.unit.trim() || null,
            orderIndex: idx,
          })),
        steps: steps
          .filter((s) => s.instruction.trim())
          .map((s, idx) => ({
            stepNumber: idx + 1,
            instruction: s.instruction.trim(),
            timerSeconds: s.timerSeconds ? parseInt(s.timerSeconds, 10) : null,
          })),
      };
      const res = await api.recipes.create(payload);
      if ("error" in res) throw new Error(res.error.message);
      if ("data" in res) router.replace(`/(app)/recipes/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + TAB_BAR_ALLOWANCE },
        ]}
      >
        <Text style={styles.pageTitle}>New recipe</Text>

        <ImportTabs
          mode={mode}
          onModeChange={setMode}
          onDraft={applyDraft}
          onImported={(recipeId) => router.replace(`/(app)/recipes/${recipeId}`)}
          aiImportsRemaining={aiImportsRemaining}
        />

        {/* The form is always the destination: the import tabs fill it in, and
            this is where anything gets saved from. Hidden while an import tab
            is open so the screen is not a wall of empty fields under a picker
            the user has not finished with. */}
        {mode === "manual" && (
          <>
        <Section title="Basic info">
          <Field label="Title">
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Sourdough loaf" />
          </Field>
          <Field label="Description">
            <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Optional short description" multiline numberOfLines={3} />
          </Field>
          <View style={styles.row}>
            <Field label="Servings" style={{ flex: 1 }}>
              <TextInput style={styles.input} value={servings} onChangeText={setServings} keyboardType="number-pad" />
            </Field>
            <Field label="Prep (min)" style={{ flex: 1 }}>
              <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} keyboardType="number-pad" />
            </Field>
            <Field label="Cook (min)" style={{ flex: 1 }}>
              <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime} keyboardType="number-pad" />
            </Field>
          </View>
          <View style={styles.row}>
            <Field label="Difficulty" style={{ flex: 1 }}>
              <View style={styles.segmented}>
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.segment, difficulty === d && styles.segmentActive]}
                    onPress={() => setDifficulty(difficulty === d ? "" : d)}
                  >
                    <Text style={[styles.segmentText, difficulty === d && styles.segmentTextActive]}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
            <Field label="Cuisine" style={{ flex: 1 }}>
              <TextInput style={styles.input} value={cuisine} onChangeText={setCuisine} placeholder="e.g. Italian" />
            </Field>
          </View>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.fieldLabel}>Make public</Text>
              <Text style={styles.switchHint}>Others can find and save this recipe</Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: palette.borderStrong, true: palette.accentStrong }}
              thumbColor={isPublic ? palette.accent : palette.onAccent}
            />
          </View>
        </Section>

        <Section title="Ingredients">
          {ingredients.map((ing, i) => (
            <View key={i} style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                placeholder="Ingredient"
                value={ing.name}
                onChangeText={(v) => setIngredients((prev) => prev.map((x, idx) => idx === i ? { ...x, name: v } : x))}
              />
              <TextInput
                style={[styles.input, { width: 60 }]}
                placeholder="Qty"
                keyboardType="decimal-pad"
                value={ing.quantity}
                onChangeText={(v) => setIngredients((prev) => prev.map((x, idx) => idx === i ? { ...x, quantity: v } : x))}
              />
              <TextInput
                style={[styles.input, { width: 60 }]}
                placeholder="Unit"
                value={ing.unit}
                onChangeText={(v) => setIngredients((prev) => prev.map((x, idx) => idx === i ? { ...x, unit: v } : x))}
              />
              <TouchableOpacity onPress={() => setIngredients((prev) => prev.filter((_, idx) => idx !== i))}>
                <Text style={styles.removeBtn}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "" }])}>
            <Text style={styles.addLink}>+ Add ingredient</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Steps">
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNum}>{i + 1}.</Text>
              <TextInput
                style={[styles.input, styles.multiline, { flex: 1 }]}
                placeholder="Describe this step"
                value={step.instruction}
                onChangeText={(v) => setSteps((prev) => prev.map((x, idx) => idx === i ? { ...x, instruction: v } : x))}
                multiline
              />
              <TouchableOpacity onPress={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}>
                <Text style={styles.removeBtn}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => setSteps((prev) => [...prev, { instruction: "", timerSeconds: "" }])}>
            <Text style={styles.addLink}>+ Add step</Text>
          </TouchableOpacity>
        </Section>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={palette.onAccent} /> : <Text style={styles.submitButtonText}>Create recipe</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: "700", color: t.text, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: t.textFaint, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: t.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: t.borderStrong, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: t.text, backgroundColor: t.surface },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  segmented: { flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: t.borderStrong, overflow: "hidden" },
  segment: { flex: 1, paddingVertical: 8, alignItems: "center", backgroundColor: t.surface },
  segmentActive: { backgroundColor: t.accent },
  segmentText: { fontSize: 12, fontWeight: "500", color: t.textSecondary },
  segmentTextActive: { color: t.onAccent },
  stepRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 8 },
  stepNum: { fontSize: 13, fontWeight: "600", color: t.textFaint, marginTop: 10, width: 18 },
  removeBtn: { fontSize: 20, color: t.textFaint, marginTop: 6 },
  addLink: { fontSize: 13, fontWeight: "600", color: t.accent, marginTop: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  switchHint: { fontSize: 11, color: t.textFaint, marginTop: 1 },
  error: { color: t.danger, fontSize: 13, marginBottom: 12 },
  footer: { gap: 10 },
  submitButton: { backgroundColor: t.accent, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  disabled: { opacity: 0.5 },
  submitButtonText: { color: t.onAccent, fontWeight: "600", fontSize: 15 },
  cancelButton: { borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  cancelButtonText: { color: t.textSecondary, fontWeight: "600", fontSize: 15 },
});
