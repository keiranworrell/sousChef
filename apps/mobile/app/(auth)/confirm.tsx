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
import { useTheme, useThemedStyles } from "../../components/ThemeProvider";
import type { Palette } from "../../lib/theme";

export default function ConfirmScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
            <ActivityIndicator color={palette.onAccent} />
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

const makeStyles = (t: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg, justifyContent: "center", padding: 24 },
  card: { backgroundColor: t.surface, borderRadius: 12, padding: 24, shadowColor: t.shadow, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  title: { fontSize: 24, fontWeight: "700", color: t.text, marginBottom: 8 },
  subtitle: { fontSize: 13, color: t.textMuted, marginBottom: 20 },
  email: { fontWeight: "600", color: t.text },
  label: { fontSize: 13, fontWeight: "500", color: t.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: t.borderStrong, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 14, color: t.text },
  error: { color: t.danger, fontSize: 13, marginBottom: 12 },
  success: { color: t.success, fontSize: 13, marginBottom: 12 },
  button: { backgroundColor: t.accent, borderRadius: 6, paddingVertical: 12, alignItems: "center", marginBottom: 16 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: t.onAccent, fontWeight: "600", fontSize: 14 },
  link: { textAlign: "center", color: t.accent, fontSize: 13 },
});
