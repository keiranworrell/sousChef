"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";

type NavItem = {
  label: string;
  href: string;
  active: boolean;
};

export default function AppNav(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();

  const navItems: NavItem[] = [
    { label: "Recipes", href: "/recipes", active: pathname.startsWith("/recipes") },
    { label: "Pantry", href: "/pantry", active: pathname.startsWith("/pantry") },
    { label: "Shopping", href: "/shopping", active: pathname.startsWith("/shopping") },
    { label: "Fermentation", href: "/fermentation", active: pathname.startsWith("/fermentation") },
    { label: "Meal Plan", href: "/meal-plan", active: pathname.startsWith("/meal-plan") },
    { label: "Community", href: "/community", active: pathname.startsWith("/community") },
  ];

  // Items not yet built
  const comingSoon = new Set<string>();

  async function handleSignOut(): Promise<void> {
    await signOut();
    router.push("/sign-in");
  }

  return (
    <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 h-14">
        {/* Brand */}
        <Link href="/recipes" className="flex items-center gap-2 text-lg font-bold text-orange-500 tracking-tight">
          <img src="/icon.png" alt="" className="h-7 w-7 rounded-md" />
          sousChef
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navItems.map((item) =>
            comingSoon.has(item.href) ? (
              <span
                key={item.href}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 cursor-default select-none"
                title="Coming soon"
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-orange-50 text-orange-600"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            ),
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={() => { void handleSignOut(); }}
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
