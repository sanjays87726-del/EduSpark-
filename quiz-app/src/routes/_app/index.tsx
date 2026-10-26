import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/dashboard";

export const Route = createFileRoute("/_app/")({
  component: HomePage,
});
