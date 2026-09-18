import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from "react-native";
import type { Substitution } from "@souschef/shared";
import { getSubstitutions } from "@souschef/shared";

type Props = {
  /** The ingredient being looked up, or null when the sheet is closed. */
  ingredientName: string | null;
  onReplace: (sub: Substitution) => void;
  onClose: () => void;
};

/**
 * What you can use instead, from the static table in packages/shared.
 *
 * No AI and no network: this is a lookup, it works with no signal, and it costs
 * nothing. Worth stating because the rest of the app's "clever" features are
 * neither, and someone standing in a kitchen without a recipe's third
 * ingredient is exactly the person least able to wait for a model.
 *
 * Replacing swaps the name for the rest of the session and does not save. That
 * matches web, and it is the right default — using oat milk tonight is not a
 * decision about what the recipe is — but the sheet says so, because a change
 * that silently reverts on next open is the kind of thing people assume they
 * imagined.
 */
export default function SubstitutionSheet({
  ingredientName,
  onReplace,
  onClose,
}: Props): React.JSX.Element {
  const subs = ingredientName ? getSubstitutions(ingredientName) : [];

  return (
    <Modal
      visible={ingredientName !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View>
            <Text style={styles.eyebrow}>Instead of</Text>
            <Text style={styles.title}>{ingredientName}</Text>
          </View>

          <ScrollView style={styles.list}>
            {subs.map((sub, i) => (
              <View key={`${sub.name}-${i}`} style={[styles.row, i > 0 && styles.divided]}>
                <View style={styles.rowText}>
                  <Text style={styles.subName}>{sub.name}</Text>
                  {sub.notes && <Text style={styles.subNotes}>{sub.notes}</Text>}
                </View>
                <TouchableOpacity style={styles.use} onPress={() => onReplace(sub)}>
                  <Text style={styles.useText}>Use</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.footnote}>
            Swapping one in changes what you see while you cook. It doesn't
            edit the recipe.
          </Text>

          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
    maxHeight: "80%",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#f97316",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: { marginTop: 2, fontSize: 17, fontWeight: "700", color: "#111827", textTransform: "capitalize" },
  list: { maxHeight: 340 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  divided: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  subName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  subNotes: { fontSize: 12, color: "#9ca3af", lineHeight: 17 },
  use: { borderWidth: 1, borderColor: "#f97316", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  useText: { fontSize: 12, fontWeight: "700", color: "#ea580c" },
  footnote: { fontSize: 12, color: "#9ca3af", lineHeight: 17 },
  close: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeText: { color: "#374151", fontWeight: "600", fontSize: 14 },
});
