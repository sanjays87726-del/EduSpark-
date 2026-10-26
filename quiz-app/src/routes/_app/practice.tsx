import { createFileRoute } from "@tanstack/react-router";
import { PracticePage } from "@/components/browse";

export const Route = createFileRoute("/_app/practice")({ component: PracticePage });
