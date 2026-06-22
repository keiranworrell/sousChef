import React from "react";
import AppNav from "@/components/AppNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <AppNav />
      <main>{children}</main>
    </>
  );
}
