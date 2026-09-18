import React from "react";
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useTheme, useThemedStyles } from "./ThemeProvider";
import type { Palette } from "../lib/theme";

type Props = {
  isFollowing: boolean;
  busy?: boolean;
  onPress: () => void;
  size?: "regular" | "small";
};

/**
 * Follow and unfollow, in one button.
 *
 * "Following" rather than "Unfollow" for the active state: the label says what
 * is true, not what tapping does. Unfollowing is the rarer action and the one
 * you would not want to trigger by mis-reading a button, so the destructive
 * reading is the one that has to be deliberate.
 */
export default function FollowButton({
  isFollowing,
  busy = false,
  onPress,
  size = "regular",
}: Props): React.JSX.Element {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const small = size === "small";

  return (
    <TouchableOpacity
      style={[
        styles.base,
        small && styles.small,
        isFollowing ? styles.following : styles.follow,
        busy && styles.busy,
      ]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ selected: isFollowing, busy }}
      accessibilityLabel={isFollowing ? "Following. Tap to unfollow." : "Follow"}
    >
      {busy ? (
        <ActivityIndicator size="small" color={isFollowing ? palette.textMuted : palette.onAccent} />
      ) : (
        <Text
          style={[
            small ? styles.textSmall : styles.text,
            isFollowing ? styles.textFollowing : styles.textFollow,
          ]}
        >
          {isFollowing ? "Following" : "Follow"}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  base: {
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 96,
  },
  small: { paddingHorizontal: 14, paddingVertical: 7, minWidth: 84 },
  follow: { backgroundColor: t.accent },
  following: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong },
  text: { fontSize: 14, fontWeight: "600" },
  textSmall: { fontSize: 12, fontWeight: "600" },
  textFollow: { color: t.onAccent },
  textFollowing: { color: t.textMuted },
  busy: { opacity: 0.7 },
});
