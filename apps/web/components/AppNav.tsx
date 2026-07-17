"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import NotificationPanel from "./NotificationPanel";
import { useTheme } from "./ThemeProvider";
import { getApiClient } from "@/lib/api";

type NavItem = {
  label: string;
  href: string;
  active: boolean;
};

function BellIcon(): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function SunIcon(): React.JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon(): React.JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function AppNav(): React.JSX.Element {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const mainNavItems: NavItem[] = [
    { label: "Recipes", href: "/recipes", active: pathname.startsWith("/recipes") },
    { label: "Pantry", href: "/pantry", active: pathname.startsWith("/pantry") },
    { label: "Shopping", href: "/shopping", active: pathname.startsWith("/shopping") },
    { label: "Meal Plan", href: "/meal-plan", active: pathname.startsWith("/meal-plan") },
    { label: "Community", href: "/community", active: pathname.startsWith("/community") },
    { label: "Feed", href: "/feed", active: pathname.startsWith("/feed") },
  ];

  const moreNavItems: NavItem[] = [
    { label: "Collections", href: "/collections", active: pathname.startsWith("/collections") },
    { label: "Fermentation", href: "/fermentation", active: pathname.startsWith("/fermentation") },
    { label: "Cook History", href: "/cook-history", active: pathname.startsWith("/cook-history") },
    { label: "Rediscover", href: "/rediscover", active: pathname.startsWith("/rediscover") },
    { label: "Household", href: "/household", active: pathname.startsWith("/household") },
    { label: "Profile", href: "/profile", active: pathname.startsWith("/profile") },
  ];

  const allNavItems = [...mainNavItems, ...moreNavItems];
  const activeItem = allNavItems.find((item) => item.active);
  const moreActive = moreNavItems.some((item) => item.active);

  // Load unread notification count on mount
  const loadUnreadCount = useCallback(async (): Promise<void> => {
    try {
      const api = await getApiClient();
      const res = await api.notifications.list();
      if (!("error" in res)) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // Non-fatal — badge just won't show
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();
    // Refresh every 60 seconds
    const timer = setInterval(() => { void loadUnreadCount(); }, 60_000);
    return () => clearInterval(timer);
  }, [loadUnreadCount]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  async function handleSignOut(): Promise<void> {
    await signOut();
    router.push("/sign-in");
  }

  function handleBellClick(): void {
    setNotifOpen(true);
    setMenuOpen(false);
  }

  return (
    <>
      <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
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
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* More dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((o) => !o)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  moreActive
                    ? "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                More
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {moreOpen && (
                <div className="absolute right-0 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  {moreNavItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block px-4 py-2 text-sm font-medium transition-colors ${
                        item.active
                          ? "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop right side: theme toggle + bell + sign out */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Bell */}
            <button
              onClick={handleBellClick}
              aria-label="Notifications"
              className="relative text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-400 ring-2 ring-white dark:ring-gray-900" />
              )}
            </button>

            <button
              onClick={() => { void handleSignOut(); }}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Mobile: bell + hamburger */}
          <div className="flex md:hidden items-center gap-2" ref={menuRef}>
            {/* Show active section label */}
            {activeItem != null && (
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{activeItem.label}</span>
            )}

            {/* Theme toggle */}
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors p-1"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Bell */}
            <button
              onClick={handleBellClick}
              aria-label="Notifications"
              className="relative text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors p-1"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-orange-400 ring-2 ring-white dark:ring-gray-900" />
              )}
            </button>

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
              <div className="absolute top-14 left-0 right-0 bg-white border-b border-gray-200 shadow-sm py-2 px-4 flex flex-col dark:bg-gray-900 dark:border-gray-800">
                {allNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      item.active
                        ? "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="border-t border-gray-100 mt-2 pt-2 dark:border-gray-800">
                  <button
                    onClick={() => { void handleSignOut(); }}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Notification panel (rendered outside nav to avoid z-index issues) */}
      {notifOpen && (
        <NotificationPanel
          onClose={() => setNotifOpen(false)}
          onRead={() => setUnreadCount(0)}
        />
      )}
    </>
  );
}
