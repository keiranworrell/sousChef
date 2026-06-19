import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { signOut } from "aws-amplify/auth";
import { useRouter } from "expo-router";

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();

  async function handleSignOut(): Promise<void> {
    await signOut();
    router.replace("/(auth)/sign-in");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>sousChef</Text>
      <Text style={styles.subtitle}>You're in! More coming soon.</Text>
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb", padding: 24 },
  title: { fontSize: 36, fontWeight: "800", color: "#111827", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#6b7280", marginBottom: 40 },
  button: { backgroundColor: "#f97316", borderRadius: 6, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
