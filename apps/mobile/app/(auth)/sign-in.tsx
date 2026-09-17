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
import { signIn } from "aws-amplify/auth";
import { Link, useRouter } from "expo-router";

export default function SignInScreen(): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      // Trimmed: an email arriving from autofill or a keyboard suggestion often
      // carries a trailing space, and Cognito rejects it as a wrong username
      // rather than as a malformed one.
      const { isSignedIn, nextStep } = await signIn({
        username: email.trim(),
        password,
      });

      // Deliberately no navigation on success. The root layout listens for the
      // `signedIn` event and does the routing; this screen navigating too was
      // half of the original bug — it pushed to /(app) while the layout still
      // thought the user was signed out, so the guard immediately bounced them
      // back here. One owner for auth navigation, and it is the guard.
      if (isSignedIn) return;

      // Everything below was previously unhandled: a sign-in that needed a
      // further step returned isSignedIn false and the function simply ended,
      // so the button spun, stopped, and nothing whatsoever happened.
      switch (nextStep.signInStep) {
        case "CONFIRM_SIGN_UP":
          router.push({
            pathname: "/(auth)/confirm",
            params: { email: email.trim() },
          });
          return;
        case "RESET_PASSWORD":
          setError("You need to reset your password. You can do that on the website.");
          return;
        default:
          // MFA, a forced new password, TOTP setup — none of it is built on
          // mobile yet. Naming the step beats a button that does nothing.
          setError(
            `This account needs a sign-in step the app doesn't support yet (${nextStep.signInStep}). Try the website.`,
          );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          placeholder="••••••••"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/sign-up" style={styles.link}>
          No account? Sign up
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 24, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827", marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 14, color: "#111827" },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 12 },
  button: { backgroundColor: "#f97316", borderRadius: 6, paddingVertical: 12, alignItems: "center", marginBottom: 16 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  link: { textAlign: "center", color: "#f97316", fontSize: 13 },
});
