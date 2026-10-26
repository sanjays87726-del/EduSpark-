import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/account";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });
