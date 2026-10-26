import { createFileRoute } from "@tanstack/react-router";
import { ProgressPage } from "@/components/account";

export const Route = createFileRoute("/_app/progress")({ component: ProgressPage });
