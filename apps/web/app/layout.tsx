import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "sousChef",
  description: "Recipe management and cooking companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
