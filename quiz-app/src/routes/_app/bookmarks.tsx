import { createFileRoute } from "@tanstack/react-router";
import { BookmarksPage } from "@/components/account";

export const Route = createFileRoute("/_app/bookmarks")({ component: BookmarksPage });
