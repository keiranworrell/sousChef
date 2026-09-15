import React from "react";
import AppNav from "@/components/AppNav";
import { ToastProvider } from "@/components/ToastProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <ToastProvider>
      <AppNav />
      <main>{children}</main>
    </ToastProvider>
  );
}
