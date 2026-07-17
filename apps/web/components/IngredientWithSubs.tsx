"use client";

import React, { useEffect, useRef, useState } from "react";
import type { RecipeIngredient, Substitution } from "@souschef/shared";
import { getSubstitutions, hasSubstitutions } from "@souschef/shared";
import SubstitutionModal from "./SubstitutionModal";

type Props = {
  ingredient: RecipeIngredient;
  /** Called when the user clicks Replace inside the substitution popup */
  onReplace: (ingredient: RecipeIngredient, sub: Substitution) => void;
  /** Optional extra class names for the root <li> */
  className?: string;
  /**
   * Pre-formatted scaled quantity string. When provided this replaces the raw
   * ingredient.quantity value so the parent can control scaling display.
   */
  scaledQuantity?: string | null;
};

export default function IngredientWithSubs({
  ingredient,
  onReplace,
  className = "",
  scaledQuantity,
}: Props): React.JSX.Element {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const subs = getSubstitutions(ingredient.name);
  const hasSubs = hasSubstitutions(ingredient.name);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent): void {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  function handleReplace(sub: Substitution): void {
    setModalOpen(false);
    setDropdownOpen(false);
    onReplace(ingredient, sub);
  }

  return (
    <>
      <li className={`relative flex gap-2 text-sm text-gray-700 ${className}`}>
        {(scaledQuantity != null || ingredient.quantity != null) && (
          <span className="shrink-0 font-medium text-gray-900">
            {scaledQuantity ?? ingredient.quantity}
            {ingredient.unit ? ` ${ingredient.unit}` : ""}
          </span>
        )}

        {hasSubs ? (
          /* Clickable ingredient name when substitutions exist */
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="rounded px-0.5 text-left text-sm text-gray-700 underline decoration-dotted underline-offset-2 hover:text-orange-600 transition-colors"
              aria-expanded={dropdownOpen}
            >
              {ingredient.name}
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                >
                  <span>🔄</span>
                  <span>Show substitutions</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <span>{ingredient.name}</span>
        )}

        {ingredient.notes && (
          <span className="text-gray-400">({ingredient.notes})</span>
        )}
      </li>

      {/* Substitution popup */}
      {modalOpen && (
        <SubstitutionModal
          ingredientName={ingredient.name}
          substitutions={subs}
          onReplace={handleReplace}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
