import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemedStyles } from "./ThemeProvider";
import type { Palette } from "../lib/theme";

type Props = {
  value: number | null;
  /** Omit to render a read-only rating. */
  onChange?: (rating: number | null) => void;
  size?: number;
};

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Five stars, readable or tappable depending on whether onChange is given.
 *
 * Tapping the current rating clears it. Without that there is no way back to
 * "cooked it, no opinion" once a star has been touched, and on a phone a stray
 * tap while holding the thing one-handed is not a rare event.
 */
export default function StarRating({
  value,
  onChange,
  size = 28,
}: Props): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const readOnly = !onChange;

  return (
    <View
      style={styles.row}
      accessibilityRole={readOnly ? "text" : "radiogroup"}
      accessibilityLabel={
        readOnly
          ? `${value ?? 0} out of 5`
          : "Rating"
      }
    >
      {STARS.map((star) => {
        const filled = value !== null && star <= value;
        const glyph = (
          <Text
            style={[
              { fontSize: size, lineHeight: size * 1.15 },
              filled ? styles.filled : styles.empty,
            ]}
          >
            ★
          </Text>
        );

        if (readOnly) return <View key={star}>{glyph}</View>;

        return (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(value === star ? null : star)}
            accessibilityRole="radio"
            accessibilityState={{ selected: filled }}
            accessibilityLabel={
              value === star ? "Clear rating" : `Rate ${star} out of 5`
            }
            // Stars are small and the gap between them is smaller. hitSlop
            // gives each one a target you can actually hit without looking.
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            {glyph}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  filled: { color: t.accent },
  empty: { color: t.border },
});
