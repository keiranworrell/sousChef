import React from "react";
import { View, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../components/ThemeProvider";
import UnreadProvider, { useUnread } from "../../components/UnreadProvider";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

/**
 * Taken from Ionicons rather than written out, because React Navigation hands
 * `tabBarIcon` a `ColorValue` — `string | OpaqueColorValue` — not a string.
 * This was typed as `string` and broke on the Expo 57 upgrade. Deriving it
 * means the next widening of either type passes through instead of failing the
 * build.
 */
type IoniconsColor = React.ComponentProps<typeof Ionicons>["color"];

function TabIcon({
  name,
  color,
  size,
  dot = false,
}: {
  name: IoniconsName;
  color: IoniconsColor;
  size: number;
  /** Draws an unread marker over the icon's top-right. */
  dot?: boolean;
}): React.JSX.Element {
  const { palette } = useTheme();

  if (!dot) return <Ionicons name={name} size={size} color={color} />;

  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {/* Drawn here rather than with React Navigation's `tabBarBadge`.
          expo-router 57 routes through `standard-navigation` rather than
          @react-navigation/bottom-tabs — the same difference that left us
          without `useBottomTabBarHeight` — so badge options are not something
          to rely on. A View we position ourselves works whatever is
          underneath. */}
      <View style={[styles.dot, { backgroundColor: palette.danger, borderColor: palette.surface }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});

export default function AppLayout(): React.JSX.Element {
  return (
    <UnreadProvider>
      <AppTabs />
    </UnreadProvider>
  );
}

function AppTabs(): React.JSX.Element {
  const { palette } = useTheme();
  const { unread } = useUnread();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="recipes"
        options={{
          title: "Recipes",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="book-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: "Lists",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="cart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="meal-plan"
        options={{
          title: "Meal plans",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, size }) => (
            <TabIcon
              name="ellipsis-horizontal"
              color={color}
              size={size}
              // Notifications live behind this tab, so this is the only place
              // in the tab bar that can say something is waiting.
              dot={unread > 0}
            />
          ),
        }}
      />
      {/* Reachable from the Menu tab, not from the bar itself. href: null keeps
          the route registered so it can still be pushed to. */}
      <Tabs.Screen name="collections" options={{ href: null }} />
      <Tabs.Screen name="cook" options={{ href: null }} />
      <Tabs.Screen name="cook-history" options={{ href: null }} />
      <Tabs.Screen name="feed" options={{ href: null }} />
      <Tabs.Screen name="fermentation" options={{ href: null }} />
      <Tabs.Screen name="household" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="rediscover" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="users" options={{ href: null }} />
      {/* Hide the index redirect from the tab bar */}
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
    </Tabs>
  );
}
