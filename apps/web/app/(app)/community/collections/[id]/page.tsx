import type { Metadata } from "next";
import { fetchCollectionMeta } from "@/lib/metadata";
import PublicCollectionPageClient from "./PublicCollectionPageClient";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const collection = await fetchCollectionMeta(id);

  if (!collection) {
    return { title: "Collection — sousChef" };
  }

  const title = `${collection.name} — sousChef`;
  const description =
    collection.description ??
    `A collection of ${collection.recipeCount} ${collection.recipeCount === 1 ? "recipe" : "recipes"} by ${collection.ownerName} on sousChef.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicCollectionPage({ params }: Props): Promise<React.JSX.Element> {
  // id is read by the client component via useParams()
  void params;
  return <PublicCollectionPageClient />;
}
