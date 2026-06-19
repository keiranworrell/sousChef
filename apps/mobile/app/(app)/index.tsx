import { Redirect } from "expo-router";
import React from "react";

export default function AppIndex(): React.JSX.Element {
  return <Redirect href="/(app)/recipes" />;
}
