import type { Metadata } from "next";
import AmplifyProvider from "@/components/AmplifyProvider";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "sousChef",
  description: "Recipe management and cooking companion",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AmplifyProvider>{children}</AmplifyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
