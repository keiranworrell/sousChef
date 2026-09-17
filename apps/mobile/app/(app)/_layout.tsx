import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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
}: {
  name: IoniconsName;
  color: IoniconsColor;
  size: number;
}): React.JSX.Element {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function AppLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#f97316",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e5e7eb",
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
          title: "Shopping",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="cart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="meal-plan"
        options={{
          title: "Plan",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="fermentation"
        options={{
          title: "Ferment",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="flask-outline" color={color} size={size} />
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
      {/* Profile tab hidden — sign-out moved to Community screen header */}
      <Tabs.Screen
        name="profile"
        options={{ href: null }}
      />
      {/* Hide the index redirect from the tab bar */}
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
    </Tabs>
  );
}
