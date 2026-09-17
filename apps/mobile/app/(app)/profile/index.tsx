import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { signOut } from "aws-amplify/auth";

export default function ProfileScreen(): React.JSX.Element {
  const [loading, setLoading] = useState(false);

  async function handleSignOut(): Promise<void> {
    setLoading(true);
    try {
      // No navigation here: the root layout hears `signedOut` and routes. Two
      // places steering auth navigation is what broke sign-in, and it would
      // break the same way here the moment the timings shifted.
      await signOut();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <TouchableOpacity
        style={[styles.signOutButton, loading && styles.disabled]}
        onPress={() => { void handleSignOut(); }}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.signOutText}>Sign out</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb", padding: 24 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 32 },
  signOutButton: { backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 13, paddingHorizontal: 32, alignItems: "center" },
  disabled: { opacity: 0.5 },
  signOutText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
