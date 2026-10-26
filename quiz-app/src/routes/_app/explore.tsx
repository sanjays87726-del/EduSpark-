import { createFileRoute } from "@tanstack/react-router";
import { ExplorePage, type ExploreSearch } from "@/components/browse";

export const Route = createFileRoute("/_app/explore")({
  validateSearch: (search: Record<string, unknown>): ExploreSearch => {
    const next: ExploreSearch = {};
    if (typeof search.catalog === "string" && search.catalog) next.catalog = search.catalog.slice(0, 40);
    if (typeof search.subject === "string" && search.subject) next.subject = search.subject.slice(0, 40);
    if (typeof search.kind === "string" && search.kind) next.kind = search.kind.slice(0, 20);
    return next;
  },
  component: function ExploreRoute() {
    const search = Route.useSearch();
    return <ExplorePage search={search} />;
  },
});
