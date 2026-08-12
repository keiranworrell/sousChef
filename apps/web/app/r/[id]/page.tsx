import type { Metadata } from "next";
import { fetchRecipeMeta } from "@/lib/metadata";
import PublicRecipePageClient from "./PublicRecipePageClient";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const recipe = await fetchRecipeMeta(id);

  if (!recipe) {
    return { title: "Recipe — sousChef" };
  }

  const title = `${recipe.title} — sousChef`;
  const description =
    recipe.description ??
    `${recipe.cuisine ? `${recipe.cuisine} recipe` : "Recipe"}${recipe.creatorName ? ` by ${recipe.creatorName}` : ""} on sousChef.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(recipe.imageUrl ? { images: [{ url: recipe.imageUrl }] } : {}),
    },
    twitter: {
      card: recipe.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(recipe.imageUrl ? { images: [recipe.imageUrl] } : {}),
    },
  };
}

/**
 * Safely serialise an object for use inside a <script type="application/ld+json"> tag.
 * JSON.stringify does not escape < > & by default, which allows script-injection if
 * user-controlled strings contain </script>. We escape those three characters.
 */
function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export default async function PublicRecipePage({ params }: Props): Promise<React.JSX.Element> {
  const { id } = await params;
  const recipe = await fetchRecipeMeta(id);

  const jsonLd = recipe
    ? {
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: recipe.title,
        ...(recipe.description ? { description: recipe.description } : {}),
        ...(recipe.imageUrl ? { image: recipe.imageUrl } : {}),
        ...(recipe.cuisine ? { recipeCuisine: recipe.cuisine } : {}),
        ...(recipe.creatorName
          ? { author: { "@type": "Person", name: recipe.creatorName } }
          : {}),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
      )}
      <PublicRecipePageClient id={id} />
    </>
  );
}
