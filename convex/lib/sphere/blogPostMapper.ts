import { config } from "../config.js";
import { getTaxonomyBySportId } from "../fedid/sportGroupLookup.js";
import type { SphereContent } from "./types.js";

/**
 * Map a Sphere `how_to_chose` entry to a ContentStack `blog_post` payload.
 *
 * - Taxonomies are derived from the entry's `dd_sports` via the sport group mapping.
 * - `teaser_image` is converted to a `pixl_url` using SPHERE_PIXL_HOST.
 */
export function mapSphereToBlogPost(
  entry: SphereContent
): Record<string, unknown> {
  const ddSports = entry.dd_sports ?? [];

  // Unique taxonomy terms from sport IDs
  const taxonomySet = new Set<string>();
  for (const sportId of ddSports) {
    const term = getTaxonomyBySportId(String(sportId));
    if (term) taxonomySet.add(term);
  }
  const taxonomies = [...taxonomySet].map((term_uid) => ({
    taxonomy_uid: "sport_category",
    term_uid,
  }));

  // article_image from teaser_image
  let articleImage: Record<string, unknown> | undefined;
  if (entry.teaser_image) {
    const { media_id, security_key, alt_title } = entry.teaser_image;
    const numericId = media_id.replace(/\D/g, "");
    const pixlHost =
      config.sphere.pixlHost ?? "https://contents.mediadecathlon.com";
    articleImage = {
      pixl_url: `${pixlHost}/${media_id}/k$${security_key}/${numericId}_default.jpg`,
      alt: alt_title ?? "",
      focal_point: "center",
    };
  }

  // sphere_url: extract path from full URL
  let sphereUrlHref: string | undefined;
  if (entry.url) {
    try {
      sphereUrlHref = new URL(String(entry.url)).pathname;
    } catch {
      sphereUrlHref = String(entry.url);
    }
  }

  const mapped: Record<string, unknown> = {
    title: `${entry.title} ${entry.id}`,
    subtitle: entry.summary ?? "",
    sphere_id: entry.id,
    last_sphere_update: entry.updated_at ?? new Date().toISOString(),
    metadata: {
      title: entry.title,
      description: entry.meta_description ?? "",
      robot_no_follow: false,
    },
    tags: ["content_mapper", "cs_mapper"],
    taxonomies,
  };

  if (sphereUrlHref) {
    mapped["sphere_url"] = { href: sphereUrlHref };
  }

  if (articleImage) {
    mapped["article_image"] = articleImage;
  }

  return mapped;
}
