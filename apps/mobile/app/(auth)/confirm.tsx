import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function ConfirmScreen(): React.JSX.Element {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      await confirmSignUp({ username: email ?? "", confirmationCode: code });
      router.replace("/(auth)/sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(): Promise<void> {
    try {
      await resendSignUpCode({ username: email ?? "" });
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification code to{"\n"}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <Text style={styles.label}>Verification code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          placeholder="000000"
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {resent && <Text style={styles.success}>Code resent — check your inbox.</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend}>
          <Text style={styles.link}>Resend code</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 24, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827", marginBottom: 8 },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  email: { fontWeight: "600", color: "#111827" },
  label: { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 14, color: "#111827" },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 12 },
  success: { color: "#16a34a", fontSize: 13, marginBottom: 12 },
  button: { backgroundColor: "#f97316", borderRadius: 6, paddingVertical: 12, alignItems: "center", marginBottom: 16 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  link: { textAlign: "center", color: "#f97316", fontSize: 13 },
});
