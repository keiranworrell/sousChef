import React from "react";
import RecipeForm from "@/components/RecipeForm";

export default function NewRecipePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">New recipe</h1>
      <RecipeForm />
    </div>
  );
}
