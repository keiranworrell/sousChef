"use client";

/**
 * ActionMenu — responsive action button row.
 *
 * On sm+ screens all actions render as inline buttons.
 * On narrow screens the primary action stays visible; all secondary
 * actions collapse into a ··· dropdown. Use this anywhere a page has
 * a row of 3+ action buttons that overflow on mobile.
 *
 * Usage:
 *   <ActionMenu
 *     primary={{ label: "Start cooking", href: `/recipes/${id}/cook` }}
 *     actions={[
 *       { label: "Log cook", onClick: handleLogCook },
 *       { label: "Edit", href: `/recipes/${id}/edit` },
 *       { label: "Delete", onClick: handleDelete, danger: true },
 *     ]}
 *   />
 */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type ActionItem = {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Renders the item in red */
  danger?: boolean;
  /** Secondary style override on wide screens (default is btn-secondary) */
  className?: string;
};

type Props = {
  /** Optional primary CTA — always visible, rendered as btn-primary */
  primary?: ActionItem;
  /** Secondary actions — the first few inline, the rest behind ··· */
  actions: ActionItem[];
};

/**
 * How many secondary actions stay inline on a wide screen.
 *
 * Three, because this row shares its line with the page title and an unbounded
 * row of buttons takes the width from it — the recipe page reached seven
 * actions and squeezed "Brioche Burger Buns" into one word per line. Capping
 * here rather than in each page means adding an eighth action later cannot
 * reintroduce that.
 */
const MAX_INLINE_ACTIONS = 3;

function ActionButton({
  item,
  className,
  onClick,
}: {
  item: ActionItem;
  className: string;
  onClick?: () => void;
}): React.JSX.Element {
  if (item.href) {
    return (
      <Link href={item.href} className={className} onClick={onClick}>
        {item.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={() => { item.onClick?.(); onClick?.(); }}
      className={`${className} disabled:opacity-50`}
    >
      {item.label}
    </button>
  );
}

export default function ActionMenu({ primary, actions }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [wideOpen, setWideOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const wideMenuRef = useRef<HTMLDivElement>(null);

  const inline = actions.slice(0, MAX_INLINE_ACTIONS);
  const overflow = actions.slice(MAX_INLINE_ACTIONS);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!wideOpen) return;
    function handleClickOutside(e: MouseEvent): void {
      if (wideMenuRef.current && !wideMenuRef.current.contains(e.target as Node)) {
        setWideOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wideOpen]);

  const secondaryClass = (item: ActionItem): string =>
    item.danger
      ? (item.className ?? "btn-secondary text-red-600 border-red-200 hover:bg-red-50")
      : (item.className ?? "btn-secondary");

  return (
    <>
      {/* ── Wide screens: primary + a few inline, rest behind ··· ────── */}
      {/* justify-end so that when the row wraps, the wrapped buttons stay
          aligned with the right edge rather than drifting left. */}
      <div className="hidden sm:flex flex-wrap items-center justify-end gap-2" ref={wideMenuRef}>
        {primary && (
          <ActionButton item={primary} className={primary.className ?? "btn-primary"} />
        )}
        {inline.map((action, i) => (
          <ActionButton key={i} item={action} className={secondaryClass(action)} />
        ))}
        {overflow.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setWideOpen((o) => !o)}
              className="btn-secondary px-3 leading-none"
              aria-label="More actions"
              aria-expanded={wideOpen}
            >
              ···
            </button>
            {wideOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                {overflow.map((action, i) =>
                  action.href ? (
                    <Link
                      key={i}
                      href={action.href}
                      className={`block px-4 py-2.5 text-sm ${action.danger ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                      onClick={() => setWideOpen(false)}
                    >
                      {action.label}
                    </Link>
                  ) : (
                    <button
                      key={i}
                      type="button"
                      disabled={action.disabled}
                      onClick={() => { action.onClick?.(); setWideOpen(false); }}
                      className={`block w-full text-left px-4 py-2.5 text-sm ${action.danger ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"} disabled:opacity-50`}
                    >
                      {action.label}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Narrow screens: primary + ··· overflow menu ──────────────── */}
      <div className="flex sm:hidden items-center gap-2" ref={menuRef}>
        {primary && (
          <ActionButton item={primary} className={primary.className ?? "btn-primary text-sm"} />
        )}
        {actions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="btn-secondary text-sm px-3 py-2 leading-none"
              aria-label="More actions"
              aria-expanded={open}
            >
              ···
            </button>
            {open && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                {actions.map((action, i) => (
                  <React.Fragment key={i}>
                    {action.href ? (
                      <Link
                        href={action.href}
                        className={`block px-4 py-2.5 text-sm ${action.danger ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                        onClick={() => setOpen(false)}
                      >
                        {action.label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={action.disabled}
                        onClick={() => { action.onClick?.(); setOpen(false); }}
                        className={`block w-full text-left px-4 py-2.5 text-sm ${action.danger ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"} disabled:opacity-50`}
                      >
                        {action.label}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
