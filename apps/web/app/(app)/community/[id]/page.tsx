import type { Metadata } from "next";
import { fetchRecipeMeta } from "@/lib/metadata";
import CommunityRecipePageClient from "./CommunityRecipePageClient";

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

export default async function CommunityRecipePage({ params }: Props): Promise<React.JSX.Element> {
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

  // id is passed via context — client component reads it with useParams()
  void id;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <CommunityRecipePageClient />
    </>
  );
}
