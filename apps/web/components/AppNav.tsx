"use client";

import React, { useState, useRef, useEffect } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems: NavItem[] = [
    { label: "Recipes", href: "/recipes", active: pathname.startsWith("/recipes") },
    { label: "Pantry", href: "/pantry", active: pathname.startsWith("/pantry") },
    { label: "Shopping", href: "/shopping", active: pathname.startsWith("/shopping") },
    { label: "Fermentation", href: "/fermentation", active: pathname.startsWith("/fermentation") },
    { label: "Meal Plan", href: "/meal-plan", active: pathname.startsWith("/meal-plan") },
    { label: "Community", href: "/community", active: pathname.startsWith("/community") },
  ];

  const activeItem = navItems.find((item) => item.active);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleSignOut(): Promise<void> {
    await signOut();
    router.push("/sign-in");
  }

  return (
    <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 h-14">
        {/* Brand */}
        <Link
          href="/recipes"
          className="flex items-center gap-2 text-lg font-bold text-orange-500 tracking-tight shrink-0"
        >
          <img src="/icon.png" alt="" className="h-7 w-7 rounded-md" />
          sousChef
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
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
          ))}
        </div>

        {/* Desktop sign out */}
        <button
          onClick={() => { void handleSignOut(); }}
          className="hidden md:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors shrink-0"
        >
          Sign out
        </button>

        {/* Mobile: hamburger + dropdown */}
        <div className="flex md:hidden items-center gap-2" ref={menuRef}>
          {/* Show active section label */}
          {activeItem != null && (
            <span className="text-sm font-medium text-gray-700">{activeItem.label}</span>
          )}

          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="flex flex-col justify-center items-center w-9 h-9 rounded-md hover:bg-gray-50 transition-colors gap-1.5"
          >
            <span
              className={`block h-0.5 w-5 bg-gray-600 transition-transform duration-200 ${
                menuOpen ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-gray-600 transition-opacity duration-200 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-gray-600 transition-transform duration-200 ${
                menuOpen ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </button>

          {menuOpen && (
            <div className="absolute top-14 left-0 right-0 bg-white border-b border-gray-200 shadow-sm py-2 px-4 flex flex-col">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    item.active
                      ? "bg-orange-50 text-orange-600"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <button
                  onClick={() => { void handleSignOut(); }}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
