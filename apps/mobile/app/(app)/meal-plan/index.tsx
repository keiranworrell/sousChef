import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function MealPlanScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meal Plan</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#9ca3af" },
});
