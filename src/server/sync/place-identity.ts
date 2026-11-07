import { places } from "../../../config/places";
/** Reuse persisted slug identities; never move a configured UUID to a different building. */
export function canonicalPlaceIds(rows: { id: string; slug: string }[]) {
  const ids = new Map<string, string>();
  for (const p of places) {
    const bySlug = rows.find((r) => r.slug === p.slug);
    const byId = rows.find((r) => r.id === p.id);
    if (byId && byId.slug !== p.slug)
      throw new Error(`Configured place ID belongs to another slug: ${p.slug}`);
    ids.set(p.id, bySlug?.id ?? p.id);
  }
  return ids;
}
