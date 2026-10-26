import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/account";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });
