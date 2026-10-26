import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin";

export const Route = createFileRoute("/_app/admin")({ component: AdminPage });
