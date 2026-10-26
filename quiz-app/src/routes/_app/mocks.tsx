import { createFileRoute } from "@tanstack/react-router";
import { MocksPage } from "@/components/browse";

export const Route = createFileRoute("/_app/mocks")({ component: MocksPage });
